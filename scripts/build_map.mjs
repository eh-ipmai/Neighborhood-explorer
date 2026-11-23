#!/usr/bin/env node
/**
 * Cross-platform OpenStreetMap -> RPG Tile Grid generator (world_map.json)
 * Implements GDD Section 2:
 *   Step 1: Bounding box & Equirectangular projection (1 tile = 5m x 5m)
 *   Step 2: 5-layer rasterization priority (Water -> Parks/Tall Grass -> Roads/Sidewalks -> Crosswalks -> Per-Address Buildings)
 *   Step 3: Street metadata & zone tagging (streetZones) + 1-to-1 per-address buildings[]
 *
 * Usage:
 *   node scripts/build_map.mjs                  # Live OSM Overpass build for Newton Centre
 *   node scripts/build_map.mjs --offline        # Deterministic offline Newton Centre layout
 *   node scripts/build_map.mjs --lat 42.3192 --lon -71.1927 --width 192 --height 192
 */

import dns from "node:dns";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

dns.setDefaultResultOrder("ipv4first");

export const TILE_IDS = {
  GRASS: 0,
  SIDEWALK: 1,
  RESIDENTIAL_ROAD: 2,
  MAIN_ROAD: 3,
  CROSSWALK: 4,
  BUILDING_WALL: 5,
  WATER: 6,
  TALL_GRASS: 7,
  PARKING_LOT: 8,
};

export const LEGEND = {
  "0": "grass",
  "1": "sidewalk",
  "2": "residential_road",
  "3": "main_road",
  "4": "crosswalk",
  "5": "building_wall",
  "6": "water",
  "7": "tall_grass",
  "8": "parking_lot",
};

export const DEFAULT_CONFIG = {
  tileSize: 16,
  scaleMetersPerTile: 6,
  width: 512,  // 512 * 6m = 3,072m (~1.9 miles x 1.9 miles: Home Base to Newton Free Library, Beth El, Ward & Weeks Fields!)
  height: 512, // 512 * 6m = 3,072m
  origin: {
    lat: 42.3192253,
    lon: -71.1926696,
    name: "Home Base (565 Boylston St)",
  },
  mapCenter: {
    lat: 42.3292,
    lon: -71.1942,
  },
};

const METERS_PER_DEG_LAT = 111320;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/**
 * Step 1: Equirectangular projection relative to origin (lat, lon) -> tile (x, y).
 * North is -Y (top of map), East is +X (right of map).
 */
export function projectLatLonToTile(
  lat,
  lon,
  originLat,
  originLon,
  width,
  height,
  scaleMetersPerTile = 5
) {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  const dxMeters = (lon - originLon) * metersPerDegLon;
  const dyMeters = (originLat - lat) * METERS_PER_DEG_LAT;

  const tileX = Math.floor(width / 2 + dxMeters / scaleMetersPerTile);
  const tileY = Math.floor(height / 2 + dyMeters / scaleMetersPerTile);
  return { x: tileX, y: tileY };
}

/**
 * Compute geographic bounding box [south, west, north, east] covering the tile grid.
 */
export function computeBoundingBox(originLat, originLon, width, height, scaleMetersPerTile = 5) {
  const halfWidthMeters = (width * scaleMetersPerTile) / 2;
  const halfHeightMeters = (height * scaleMetersPerTile) / 2;
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);

  const dLat = halfHeightMeters / METERS_PER_DEG_LAT;
  const dLon = halfWidthMeters / metersPerDegLon;

  return {
    south: originLat - dLat,
    west: originLon - dLon,
    north: originLat + dLat,
    east: originLon + dLon,
  };
}

function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Bresenham line rasterizer with configurable brush radius.
 */
function drawLine(grid, width, height, x0, y0, x1, y1, value, radius = 0, filterFn = null) {
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    for (let oy = -radius; oy <= radius; oy++) {
      for (let ox = -radius; ox <= radius; ox++) {
        const px = cx + ox;
        const py = cy + oy;
        if (!inBounds(px, py, width, height)) continue;
        const idx = py * width + px;
        if (!filterFn || filterFn(grid[idx], px, py)) {
          grid[idx] = value;
        }
      }
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

/**
 * Scanline polygon fill (even-odd rule) for water bodies, parks, and buildings.
 */
function fillPolygon(grid, width, height, points, value, filterFn = null) {
  if (points.length < 3) return 0;
  let minY = height;
  let maxY = -1;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));

  let painted = 0;
  for (let y = minY; y <= maxY; y++) {
    const scanY = y + 0.5;
    const intersections = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const pi = points[i];
      const pj = points[j];
      if ((pi.y > scanY) !== (pj.y > scanY)) {
        const x = pi.x + ((scanY - pi.y) * (pj.x - pi.x)) / (pj.y - pi.y);
        intersections.push(x);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let k = 0; k + 1 < intersections.length; k += 2) {
      const xStart = Math.max(0, Math.floor(intersections[k]));
      const xEnd = Math.min(width - 1, Math.floor(intersections[k + 1]));
      const rowOffset = y * width;
      for (let x = xStart; x <= xEnd; x++) {
        const idx = rowOffset + x;
        if (!filterFn || filterFn(grid[idx], x, y)) {
          grid[idx] = value;
          painted++;
        }
      }
    }
  }
  return painted;
}

function classifyRoad(tags = {}) {
  const hw = tags.highway;
  if (!hw) return null;

  if (hw === "crossing" || tags.footway === "crossing" || tags.crossing) {
    return { tile: TILE_IDS.CROSSWALK, zoneType: "crosswalk", radius: 0 };
  }
  if (
    hw === "motorway" ||
    hw === "trunk" ||
    hw === "primary" ||
    hw === "secondary" ||
    hw === "tertiary" ||
    hw === "trunk_link" ||
    hw === "primary_link" ||
    hw === "secondary_link"
  ) {
    return { tile: TILE_IDS.MAIN_ROAD, zoneType: "arterial", radius: 1 };
  }
  if (
    hw === "residential" ||
    hw === "living_street" ||
    hw === "unclassified" ||
    hw === "service"
  ) {
    return { tile: TILE_IDS.RESIDENTIAL_ROAD, zoneType: "residential", radius: 0 };
  }
  if (
    hw === "footway" ||
    hw === "path" ||
    hw === "pedestrian" ||
    hw === "cycleway" ||
    hw === "steps" ||
    hw === "track"
  ) {
    return { tile: TILE_IDS.SIDEWALK, zoneType: "sidewalk", radius: 0 };
  }
  return null;
}

function classifyBuildingKind(tags = {}) {
  const b = String(tags.building || "yes").toLowerCase();
  const amenity = String(tags.amenity || "").toLowerCase();
  if (amenity === "library" || b === "library") return "library";
  if (amenity === "school" || b === "school") return "school";
  if (amenity === "place_of_worship" || b === "church" || b === "synagogue") return "civic";
  if (b === "garage" || b === "shed" || b === "carport" || b === "outbuilding") return "garage";
  if (b === "commercial" || b === "retail" || b === "office" || tags.shop) return "commercial";
  if (b === "apartments" || b === "terrace") return "apartments";
  return "house";
}

function isWaterFeature(tags = {}) {
  return (
    tags.natural === "water" ||
    tags.waterway === "riverbank" ||
    tags.waterway === "river" ||
    tags.waterway === "stream" ||
    tags.waterway === "canal" ||
    Boolean(tags.water)
  );
}

function isParkFeature(tags = {}) {
  return (
    tags.leisure === "park" ||
    tags.leisure === "pitch" ||
    tags.leisure === "playground" ||
    tags.leisure === "garden" ||
    tags.leisure === "nature_reserve" ||
    tags.landuse === "grass" ||
    tags.landuse === "forest" ||
    tags.landuse === "meadow" ||
    tags.landuse === "recreation_ground" ||
    tags.landuse === "village_green" ||
    tags.natural === "wood" ||
    tags.natural === "grassland"
  );
}

function isTallGrassFeature(tags = {}) {
  return (
    tags.natural === "wood" ||
    tags.natural === "grassland" ||
    tags.landuse === "forest" ||
    tags.landuse === "meadow" ||
    tags.leisure === "nature_reserve" ||
    tags.leisure === "park"
  );
}

/**
 * Chunk a road polyline into tight bounding-box streetZones so diagonal roads
 * report accurate street names without huge overlapping rectangles.
 */
function addPolylineStreetZones(streetZones, name, type, points, width, height, pad = 2) {
  if (!name || points.length === 0) return;
  const CHUNK_LEN = 6;
  for (let i = 0; i < points.length; i += CHUNK_LEN - 1) {
    const slice = points.slice(i, Math.min(points.length, i + CHUNK_LEN));
    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    for (const p of slice) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const cMinX = Math.max(0, minX - pad);
    const cMaxX = Math.min(width - 1, maxX + pad);
    const cMinY = Math.max(0, minY - pad);
    const cMaxY = Math.min(height - 1, maxY + pad);
    if (cMinX <= cMaxX && cMinY <= cMaxY) {
      streetZones.push({
        name,
        type,
        bounds: { minX: cMinX, maxX: cMaxX, minY: cMinY, maxY: cMaxY },
      });
    }
  }
}

/**
 * Find nearest walkable sidewalk/road tile to center for Home Base spawn.
 */
export function ensureWalkableSpawn(base, collision, width, height, targetX, targetY) {
  const maxRadius = 18;
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = targetX + dx;
        const ty = targetY + dy;
        if (!inBounds(tx, ty, width, height)) continue;
        const idx = ty * width + tx;
        if (collision[idx] === 0 && base[idx] === TILE_IDS.SIDEWALK) {
          return { x: tx, y: ty };
        }
      }
    }
  }

  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = targetX + dx;
        const ty = targetY + dy;
        if (!inBounds(tx, ty, width, height)) continue;
        if (collision[ty * width + tx] === 0) {
          return { x: tx, y: ty };
        }
      }
    }
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = targetX + dx;
      const ty = targetY + dy;
      if (inBounds(tx, ty, width, height)) {
        base[ty * width + tx] = TILE_IDS.SIDEWALK;
        collision[ty * width + tx] = 0;
      }
    }
  }
  return { x: targetX, y: targetY };
}

/**
 * Step 2 & 3: Rasterize OSM elements (Overpass JSON `elements`) onto the tile grid
 * following strict 5-layer priority order and preserving 1-to-1 per-address buildings[].
 */
export function rasterizeOsmData(elements, config = DEFAULT_CONFIG) {
  const width = config.width ?? DEFAULT_CONFIG.width;
  const height = config.height ?? DEFAULT_CONFIG.height;
  const tileSize = config.tileSize ?? DEFAULT_CONFIG.tileSize;
  const scaleMetersPerTile = config.scaleMetersPerTile ?? DEFAULT_CONFIG.scaleMetersPerTile;
  const origin = { ...DEFAULT_CONFIG.origin, ...(config.origin || {}) };
  const mapCenter = config.mapCenter || { lat: origin.lat, lon: origin.lon };

  const base = new Array(width * height).fill(TILE_IDS.GRASS);
  const streetZones = [];
  const buildings = [];

  const nodes = new Map();
  const ways = [];
  const crossingNodes = [];
  const addressNodes = [];

  const projectNode = (n) =>
    projectLatLonToTile(n.lat, n.lon, mapCenter.lat, mapCenter.lon, width, height, scaleMetersPerTile);

  const originTile = projectLatLonToTile(
    origin.lat,
    origin.lon,
    mapCenter.lat,
    mapCenter.lon,
    width,
    height,
    scaleMetersPerTile
  );

  for (const el of elements) {
    if (el.type === "node") {
      nodes.set(el.id, el);
      if (el.tags && (el.tags.highway === "crossing" || el.tags.crossing)) {
        crossingNodes.push(el);
      }
      if (el.tags && el.tags["addr:housenumber"]) {
        const pt = projectNode(el);
        addressNodes.push({
          x: pt.x,
          y: pt.y,
          houseNumber: String(el.tags["addr:housenumber"]),
          street: el.tags["addr:street"] ? String(el.tags["addr:street"]) : "",
          name: el.tags.name ? String(el.tags.name) : "",
        });
      }
    } else if (el.type === "way") {
      ways.push(el);
    }
  }

  function getWayPoints(way) {
    if (Array.isArray(way.geometry) && way.geometry.length > 0) {
      return way.geometry.map((pt) =>
        projectLatLonToTile(pt.lat, pt.lon, mapCenter.lat, mapCenter.lon, width, height, scaleMetersPerTile)
      );
    }
    if (Array.isArray(way.nodes)) {
      const pts = [];
      for (const nid of way.nodes) {
        const n = nodes.get(nid);
        if (n) pts.push(projectNode(n));
      }
      return pts;
    }
    return [];
  }

  const waterWays = [];
  const parkWays = [];
  const parkingWays = [];
  const roadWays = [];
  const crossingWays = [];
  const buildingWays = [];

  for (const way of ways) {
    const tags = way.tags || {};
    if (isWaterFeature(tags)) {
      waterWays.push(way);
    } else if (tags.building) {
      buildingWays.push(way);
    } else if (tags.amenity === "parking") {
      parkingWays.push(way);
    } else if (tags.highway === "crossing" || tags.footway === "crossing") {
      crossingWays.push(way);
    } else if (tags.highway) {
      const roadInfo = classifyRoad(tags);
      if (roadInfo) roadWays.push({ way, roadInfo });
    } else if (isParkFeature(tags)) {
      parkWays.push(way);
    }
  }

  // Priority 1: Water
  for (const way of waterWays) {
    const pts = getWayPoints(way);
    if (pts.length < 2) continue;
    const isClosed =
      pts.length >= 3 && pts[0].x === pts[pts.length - 1].x && pts[0].y === pts[pts.length - 1].y;
    if (isClosed && way.tags?.waterway !== "stream") {
      fillPolygon(base, width, height, pts, TILE_IDS.WATER);
    } else {
      for (let i = 0; i < pts.length - 1; i++) {
        drawLine(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.WATER, 1);
      }
    }
  }

  // Priority 2: Parks & Greenery (woods/parks get lush tall_grass for rustle particles)
  for (const way of parkWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      const tile = isTallGrassFeature(way.tags) ? TILE_IDS.TALL_GRASS : TILE_IDS.GRASS;
      fillPolygon(base, width, height, pts, tile, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  // Priority 2.5: Surface Parking Lots (amenity=parking)
  for (const way of parkingWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      fillPolygon(base, width, height, pts, TILE_IDS.PARKING_LOT, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  // Priority 3: Roads & Sidewalks
  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.SIDEWALK) continue;
    const pts = getWayPoints(way);
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.SIDEWALK, 0);
    }
    if (way.tags?.name) {
      addPolylineStreetZones(streetZones, way.tags.name, "sidewalk", pts, width, height, 1);
    }
  }

  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.RESIDENTIAL_ROAD) continue;
    const pts = getWayPoints(way);
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        TILE_IDS.SIDEWALK,
        1,
        (cur) => cur === TILE_IDS.GRASS || cur === TILE_IDS.TALL_GRASS
      );
    }
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        TILE_IDS.RESIDENTIAL_ROAD,
        0
      );
    }
    if (way.tags?.name) {
      addPolylineStreetZones(streetZones, way.tags.name, "residential", pts, width, height, 2);
    }
  }

  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.MAIN_ROAD) continue;
    const pts = getWayPoints(way);
    // Wider 2-tile promenade sidewalks flanking busy arterial avenues (e.g. Boylston St)
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        TILE_IDS.SIDEWALK,
        3,
        (cur) => cur === TILE_IDS.GRASS || cur === TILE_IDS.TALL_GRASS
      );
    }
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        TILE_IDS.MAIN_ROAD,
        1
      );
    }
    if (way.tags?.name) {
      addPolylineStreetZones(streetZones, way.tags.name, "arterial", pts, width, height, 3);
    }
  }

  // Priority 4: Pedestrian Crossings
  for (const way of crossingWays) {
    const pts = getWayPoints(way);
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.CROSSWALK, 0);
    }
  }
  for (const node of crossingNodes) {
    const pt = projectNode(node);
    if (!inBounds(pt.x, pt.y, width, height)) continue;
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const px = pt.x + ox;
        const py = pt.y + oy;
        if (!inBounds(px, py, width, height)) continue;
        const cur = base[py * width + px];
        if (cur === TILE_IDS.MAIN_ROAD || cur === TILE_IDS.RESIDENTIAL_ROAD) {
          base[py * width + px] = TILE_IDS.CROSSWALK;
        }
      }
    }
  }

  // Priority 5: Building Footprints (1 distinct record per real house/address)
  const homeX = Math.max(0, Math.min(width - 1, originTile.x));
  const homeY = Math.max(0, Math.min(height - 1, originTile.y));
  const usedAddrIndices = new Set();

  for (const way of buildingWays) {
    const pts = getWayPoints(way);
    if (pts.length < 3) continue;

    let minX = width;
    let maxX = -1;
    let minY = height;
    let maxY = -1;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    // Clamp building bounds to map; skip completely out-of-bounds polygons
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(width - 1, maxX);
    maxY = Math.min(height - 1, maxY);
    if (minX > maxX || minY > maxY) continue;

    const isAdjacentToRoad = (tx, ty) => {
      for (const [ox, oy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const nx = tx + ox;
        const ny = ty + oy;
        if (!inBounds(nx, ny, width, height)) continue;
        const nVal = base[ny * width + nx];
        if (nVal === TILE_IDS.MAIN_ROAD || nVal === TILE_IDS.RESIDENTIAL_ROAD || nVal === TILE_IDS.CROSSWALK) {
          return true;
        }
      }
      return false;
    };

    const painted = fillPolygon(
      base,
      width,
      height,
      pts,
      TILE_IDS.BUILDING_WALL,
      (cur, tx, ty) => {
        if (cur === TILE_IDS.GRASS || cur === TILE_IDS.TALL_GRASS || cur === TILE_IDS.BUILDING_WALL) {
          return true;
        }
        // Allow building to claim interior buffer sidewalk only if it doesn't break a road-adjacent sidewalk
        if (cur === TILE_IDS.SIDEWALK) {
          return !isAdjacentToRoad(tx, ty);
        }
        return false;
      }
    );

    // Ensure very small house polygons still claim at least their center tile if walkable grass
    if (painted === 0) {
      const mx = Math.floor((minX + maxX) / 2);
      const my = Math.floor((minY + maxY) / 2);
      const idx = my * width + mx;
      if (base[idx] === TILE_IDS.GRASS || base[idx] === TILE_IDS.TALL_GRASS) {
        base[idx] = TILE_IDS.BUILDING_WALL;
      } else {
        continue;
      }
    }

    const tags = way.tags || {};
    let houseNumber = tags["addr:housenumber"] ? String(tags["addr:housenumber"]) : "";
    let street = tags["addr:street"] ? String(tags["addr:street"]) : "";
    let bName = tags.name ? String(tags.name) : "";

    // Match nearby OSM address node if the building polygon itself lacks addr:housenumber
    if (!houseNumber) {
      let bestIdx = -1;
      let bestDist = Infinity;
      const bCx = (minX + maxX) / 2;
      const bCy = (minY + maxY) / 2;
      for (let i = 0; i < addressNodes.length; i++) {
        if (usedAddrIndices.has(i)) continue;
        const an = addressNodes[i];
        if (an.x >= minX - 1 && an.x <= maxX + 1 && an.y >= minY - 1 && an.y <= maxY + 1) {
          const d = Math.hypot(an.x - bCx, an.y - bCy);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
      }
      if (bestIdx !== -1) {
        usedAddrIndices.add(bestIdx);
        houseNumber = addressNodes[bestIdx].houseNumber;
        street = street || addressNodes[bestIdx].street;
        bName = bName || addressNodes[bestIdx].name;
      }
    }

    const kind = classifyBuildingKind(tags);
    const address = houseNumber && street
      ? `${houseNumber} ${street}`
      : houseNumber || bName || "";

    const isHomeBase =
      (houseNumber === "565" && street.toLowerCase().includes("boylston")) ||
      (homeX >= minX && homeX <= maxX && homeY >= minY && homeY <= maxY);

    const styleKey = address || String(way.id || `${minX}_${minY}`);
    const styleIndex = isHomeBase ? 0 : (hashString(styleKey) % 7) + 1;
    const osmColor = tags["building:colour"] ? String(tags["building:colour"]) : "";
    const osmRoofColor = tags["roof:colour"] ? String(tags["roof:colour"]) : "";

    buildings.push({
      id: way.id ? `osm_${way.id}` : `b_${minX}_${minY}`,
      houseNumber,
      street,
      address: isHomeBase ? "565 Boylston St" : address,
      name: isHomeBase ? "Home Base" : bName,
      kind,
      isHomeBase,
      styleIndex,
      ...(osmColor ? { osmColor } : {}),
      ...(osmRoofColor ? { osmRoofColor } : {}),
      bounds: { minX, minY, maxX, maxY },
    });
  }

  // Local neighborhood detail: small parking lot immediately to the left (west) of 575 Boylston St
  const b575 = buildings.find(
    (b) => b.houseNumber === "575" && b.street.toLowerCase().includes("boylston")
  );
  if (b575) {
    const lotMinX = Math.max(0, b575.bounds.minX - 4);
    const lotMaxX = Math.max(0, b575.bounds.minX - 1);
    const lotMinY = b575.bounds.minY;
    const lotMaxY = Math.max(lotMinY, b575.bounds.maxY - 1);
    for (let ty = lotMinY; ty <= lotMaxY; ty++) {
      for (let tx = lotMinX; tx <= lotMaxX; tx++) {
        const idx = ty * width + tx;
        const cur = base[idx];
        if (
          cur === TILE_IDS.GRASS ||
          cur === TILE_IDS.TALL_GRASS ||
          cur === TILE_IDS.SIDEWALK ||
          cur === TILE_IDS.RESIDENTIAL_ROAD
        ) {
          base[idx] = TILE_IDS.PARKING_LOT;
        }
      }
    }
  }

  // Derive collision layer (1 = solid wall/water, 0 = walkable)
  const collision = base.map((tileId) =>
    tileId === TILE_IDS.BUILDING_WALL || tileId === TILE_IDS.WATER ? 1 : 0
  );

  // Guarantee walkable Home Base spawn right on the sidewalk by Home Base (565 Boylston St)
  const spawnTile = ensureWalkableSpawn(base, collision, width, height, homeX, homeY);

  // If no building explicitly matched 565 Boylston St, tag the closest residential house to origin as Home Base
  if (buildings.length > 0 && !buildings.some((b) => b.isHomeBase)) {
    let closest = null;
    let bestDist = Infinity;
    for (const b of buildings) {
      if (b.kind === "garage") continue;
      const bx = (b.bounds.minX + b.bounds.maxX) / 2;
      const by = (b.bounds.minY + b.bounds.maxY) / 2;
      const d = Math.hypot(bx - homeX, by - homeY);
      if (d < bestDist) {
        bestDist = d;
        closest = b;
      }
    }
    if (closest) {
      closest.isHomeBase = true;
      closest.address = "565 Boylston St";
      closest.name = "Home Base";
      closest.styleIndex = 0;
    }
  }

  return {
    tileSize,
    scaleMetersPerTile,
    origin: {
      ...origin,
      spawnTile,
    },
    mapCenter,
    dimensions: { width, height },
    legend: { ...LEGEND },
    layers: {
      base,
      collision,
    },
    streetZones,
    buildings,
  };
}

/**
 * Deterministic offline Newton Centre neighborhood layout with 1-house-per-address buildings[].
 */
export function buildOfflineMap(config = {}) {
  const width = config.width ?? 128;
  const height = config.height ?? 128;
  const tileSize = config.tileSize ?? DEFAULT_CONFIG.tileSize;
  const scaleMetersPerTile = config.scaleMetersPerTile ?? DEFAULT_CONFIG.scaleMetersPerTile;
  const origin = { ...DEFAULT_CONFIG.origin, ...(config.origin || {}) };

  const base = new Array(width * height).fill(TILE_IDS.GRASS);
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);

  // Crystal Lake / Pond in NW quadrant
  for (let y = 14; y <= 28; y++) {
    for (let x = 14; x <= 32; x++) {
      const dx = (x - 23) / 9;
      const dy = (y - 21) / 7;
      if (dx * dx + dy * dy <= 1) {
        base[y * width + x] = TILE_IDS.WATER;
      }
    }
  }

  // Oakdale Woods tall grass park patch (SE quadrant)
  for (let y = cy + 16; y <= cy + 34; y++) {
    for (let x = cx + 4; x <= cx + 40; x++) {
      if (inBounds(x, y, width, height) && base[y * width + x] === TILE_IDS.GRASS) {
        base[y * width + x] = TILE_IDS.TALL_GRASS;
      }
    }
  }

  // Boylston St (Route 9) running E-W
  const boylstonY = cy + 4;
  for (let x = 0; x < width; x++) {
    base[(boylstonY - 2) * width + x] = TILE_IDS.SIDEWALK;
    base[(boylstonY - 1) * width + x] = TILE_IDS.MAIN_ROAD;
    base[boylstonY * width + x] = TILE_IDS.MAIN_ROAD;
    base[(boylstonY + 1) * width + x] = TILE_IDS.MAIN_ROAD;
    base[(boylstonY + 2) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Parker St running N-S
  const parkerX = cx - 10;
  for (let y = 0; y < height; y++) {
    if (base[y * width + parkerX] === TILE_IDS.WATER) continue;
    base[y * width + (parkerX - 1)] = TILE_IDS.SIDEWALK;
    base[y * width + parkerX] = TILE_IDS.RESIDENTIAL_ROAD;
    base[y * width + (parkerX + 1)] = TILE_IDS.SIDEWALK;
  }

  // Centre St running N-S
  const centreX = cx + 18;
  for (let y = 0; y < height; y++) {
    base[y * width + (centreX - 1)] = TILE_IDS.SIDEWALK;
    base[y * width + centreX] = TILE_IDS.RESIDENTIAL_ROAD;
    base[y * width + (centreX + 1)] = TILE_IDS.SIDEWALK;
  }

  // Ward St running E-W
  const wardY = cy - 22;
  for (let x = 8; x < width - 8; x++) {
    if (base[wardY * width + x] === TILE_IDS.WATER) continue;
    base[(wardY - 1) * width + x] = TILE_IDS.SIDEWALK;
    base[wardY * width + x] = TILE_IDS.RESIDENTIAL_ROAD;
    base[(wardY + 1) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Oakdale Woods footpath
  for (let x = cx + 6; x <= cx + 38; x++) {
    base[(cy + 24) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Crosswalks across Boylston St
  for (const crossX of [parkerX, cx, centreX]) {
    for (let y = boylstonY - 1; y <= boylstonY + 1; y++) {
      base[y * width + crossX] = TILE_IDS.CROSSWALK;
      base[y * width + (crossX + 1)] = TILE_IDS.CROSSWALK;
    }
  }

  // Distinct 1-house-per-address buildings
  const rawBuildings = [
    { id: "home_565", houseNumber: "565", street: "Boylston St", name: "Home Base", kind: "house", isHomeBase: true, styleIndex: 0, x: cx - 3, y: cy - 3, w: 6, h: 4 },
    { id: "house_557", houseNumber: "557", street: "Boylston St", name: "", kind: "house", isHomeBase: false, styleIndex: 1, x: cx - 22, y: cy - 3, w: 6, h: 4 },
    { id: "house_573", houseNumber: "573", street: "Boylston St", name: "", kind: "house", isHomeBase: false, styleIndex: 2, x: cx + 7, y: cy - 3, w: 6, h: 4 },
    { id: "library_330", houseNumber: "330", street: "Homer St", name: "Newton Free Library", kind: "library", isHomeBase: false, styleIndex: 3, x: centreX + 6, y: wardY - 10, w: 10, h: 7 },
    { id: "bethel_561", houseNumber: "561", street: "Ward St", name: "Congregation Beth El", kind: "civic", isHomeBase: false, styleIndex: 4, x: parkerX - 14, y: wardY - 9, w: 9, h: 6 },
    { id: "school_34", houseNumber: "34", street: "Philbrick Rd", name: "Maimonides School", kind: "school", isHomeBase: false, styleIndex: 3, x: centreX + 8, y: boylstonY + 8, w: 10, h: 7 },
    { id: "salzberg_12", houseNumber: "12", street: "Centre St", name: "The Salzberg House", kind: "house", isHomeBase: false, styleIndex: 5, x: centreX + 22, y: cy - 12, w: 6, h: 5 },
  ];

  const buildings = [];
  for (const b of rawBuildings) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (inBounds(x, y, width, height) && (base[y * width + x] === TILE_IDS.GRASS || base[y * width + x] === TILE_IDS.TALL_GRASS)) {
          base[y * width + x] = TILE_IDS.BUILDING_WALL;
        }
      }
    }
    buildings.push({
      id: b.id,
      houseNumber: b.houseNumber,
      street: b.street,
      address: `${b.houseNumber} ${b.street}`,
      name: b.name,
      kind: b.kind,
      isHomeBase: b.isHomeBase,
      styleIndex: b.styleIndex,
      bounds: { minX: b.x, minY: b.y, maxX: b.x + b.w - 1, maxY: b.y + b.h - 1 },
    });
  }

  const collision = base.map((t) => (t === TILE_IDS.BUILDING_WALL || t === TILE_IDS.WATER ? 1 : 0));
  const spawnTile = { x: cx, y: boylstonY - 2 };
  base[spawnTile.y * width + spawnTile.x] = TILE_IDS.SIDEWALK;
  collision[spawnTile.y * width + spawnTile.x] = 0;

  const streetZones = [
    {
      name: "Boylston Street (Route 9)",
      type: "arterial",
      bounds: { minX: 0, maxX: width - 1, minY: boylstonY - 2, maxY: boylstonY + 2 },
    },
    {
      name: "Parker Street",
      type: "residential",
      bounds: { minX: parkerX - 1, maxX: parkerX + 1, minY: 0, maxY: height - 1 },
    },
    {
      name: "Centre Street",
      type: "residential",
      bounds: { minX: centreX - 1, maxX: centreX + 1, minY: 0, maxY: height - 1 },
    },
    {
      name: "Ward Street",
      type: "residential",
      bounds: { minX: 8, maxX: width - 9, minY: wardY - 1, maxY: wardY + 1 },
    },
    {
      name: "Oakdale Woods Trail",
      type: "sidewalk",
      bounds: { minX: cx + 6, maxX: cx + 38, minY: cy + 23, maxY: cy + 25 },
    },
  ];

  return {
    tileSize,
    scaleMetersPerTile,
    origin: {
      ...origin,
      spawnTile,
    },
    dimensions: { width, height },
    legend: { ...LEGEND },
    layers: { base, collision },
    streetZones,
    buildings,
  };
}

async function fetchOsmChunk(bbox, label = "") {
  const bboxStr = `${bbox.south.toFixed(6)},${bbox.west.toFixed(6)},${bbox.north.toFixed(6)},${bbox.east.toFixed(6)}`;
  const cacheDir = path.join(os.tmpdir(), "neighborhood_explorer_osm_cache_v2");
  const cacheFile = path.join(cacheDir, `${bboxStr.replace(/[^0-9.-]/g, "_")}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (Array.isArray(cached)) {
        console.log(`Using cached OSM chunk ${label} (${cached.length} features)`);
        return cached;
      }
    } catch {
      // Ignore corrupt cache
    }
  }

  const query = `
[out:json][timeout:45];
(
  way["natural"="water"](${bboxStr});
  way["waterway"~"riverbank|river|stream|canal"](${bboxStr});
  way["leisure"~"park|pitch|playground|garden|nature_reserve"](${bboxStr});
  way["landuse"~"grass|forest|meadow|recreation_ground|village_green"](${bboxStr});
  way["natural"~"wood|grassland"](${bboxStr});
  way["highway"](${bboxStr});
  way["amenity"="parking"](${bboxStr});
  node["highway"="crossing"](${bboxStr});
  way["building"](${bboxStr});
);
out tags geom;
`;

  // Retry primary Overpass endpoint cleanly on transient 429/502/504 before trying mirrors
  const attempts = [
    { endpoint: OVERPASS_ENDPOINTS[0], delayMs: 0 },
    { endpoint: OVERPASS_ENDPOINTS[0], delayMs: 4000 },
    { endpoint: OVERPASS_ENDPOINTS[0], delayMs: 8000 },
    { endpoint: OVERPASS_ENDPOINTS[1], delayMs: 2000 },
    { endpoint: OVERPASS_ENDPOINTS[2], delayMs: 2000 },
  ];

  let lastError = null;
  for (const { endpoint, delayMs } of attempts) {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50000);
      console.log(`Querying OpenStreetMap Overpass API ${label}: ${endpoint}`);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "NeighborhoodExplorerRPG/0.1 (educational kid RPG project)",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data.elements)) {
        fs.mkdirSync(cacheDir, { recursive: true });
        fs.writeFileSync(cacheFile, JSON.stringify(data.elements), "utf8");
        return data.elements;
      }
      throw new Error("Invalid Overpass response");
    } catch (err) {
      lastError = err;
      console.warn(`Overpass attempt failed ${label} (${endpoint}): ${err.message}`);
    }
  }
  throw lastError || new Error("All Overpass attempts failed");
}

/**
 * Automatically split large bounding boxes into ~1km x 1km Overpass tiles so
 * big neighborhood maps (e.g., 3km x 3km covering Home Base -> Newton Free Library)
 * fetch reliably without Overpass gateway timeouts, deduplicating elements by type+id.
 */
async function fetchOsmElements(bbox, gridMeters) {
  const chunksPerSide = gridMeters > 2100 ? 3 : gridMeters > 1100 ? 2 : 1;
  if (chunksPerSide === 1) {
    return fetchOsmChunk(bbox);
  }

  const totalChunks = chunksPerSide * chunksPerSide;
  const latStep = (bbox.north - bbox.south) / chunksPerSide;
  const lonStep = (bbox.east - bbox.west) / chunksPerSide;
  const dedup = new Map();

  let n = 0;
  for (let row = 0; row < chunksPerSide; row++) {
    for (let col = 0; col < chunksPerSide; col++) {
      n++;
      const subBox = {
        south: bbox.south + row * latStep,
        north: bbox.south + (row + 1) * latStep,
        west: bbox.west + col * lonStep,
        east: bbox.west + (col + 1) * lonStep,
      };
      const els = await fetchOsmChunk(subBox, `[chunk ${n}/${totalChunks}]`);
      for (const el of els) {
        dedup.set(`${el.type}:${el.id}`, el);
      }
      console.log(`  Chunk ${n}/${totalChunks} done (${els.length} raw, ${dedup.size} unique total)`);
      if (n < totalChunks) {
        await new Promise((r) => setTimeout(r, 2500));
      }
    }
  }
  return Array.from(dedup.values());
}

function parseCliArgs(argv) {
  const args = {
    offline: false,
    lat: DEFAULT_CONFIG.origin.lat,
    lon: DEFAULT_CONFIG.origin.lon,
    centerLat: DEFAULT_CONFIG.mapCenter.lat,
    centerLon: DEFAULT_CONFIG.mapCenter.lon,
    customOrigin: false,
    customCenter: false,
    name: DEFAULT_CONFIG.origin.name,
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
    scale: DEFAULT_CONFIG.scaleMetersPerTile,
    out: path.resolve(process.cwd(), "data", "world_map.json"),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") args.offline = true;
    else if (a === "--lat" && argv[i + 1]) { args.lat = Number(argv[++i]); args.customOrigin = true; }
    else if (a === "--lon" && argv[i + 1]) { args.lon = Number(argv[++i]); args.customOrigin = true; }
    else if (a === "--center-lat" && argv[i + 1]) { args.centerLat = Number(argv[++i]); args.customCenter = true; }
    else if (a === "--center-lon" && argv[i + 1]) { args.centerLon = Number(argv[++i]); args.customCenter = true; }
    else if (a === "--name" && argv[i + 1]) args.name = argv[++i];
    else if (a === "--width" && argv[i + 1]) args.width = Number(argv[++i]);
    else if (a === "--height" && argv[i + 1]) args.height = Number(argv[++i]);
    else if (a === "--scale" && argv[i + 1]) args.scale = Number(argv[++i]);
    else if (a === "--out" && argv[i + 1]) args.out = path.resolve(process.cwd(), argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const mapCenter = args.customCenter
    ? { lat: args.centerLat, lon: args.centerLon }
    : args.customOrigin
      ? { lat: args.lat, lon: args.lon }
      : { lat: args.centerLat, lon: args.centerLon };

  const config = {
    tileSize: DEFAULT_CONFIG.tileSize,
    scaleMetersPerTile: args.scale,
    width: args.width,
    height: args.height,
    origin: {
      lat: args.lat,
      lon: args.lon,
      name: args.name,
    },
    mapCenter,
  };

  let worldMap;
  if (args.offline) {
    console.log("Building deterministic offline Newton Centre world_map.json...");
    worldMap = buildOfflineMap({
      ...config,
      width: args.width === DEFAULT_CONFIG.width ? 128 : args.width,
      height: args.height === DEFAULT_CONFIG.height ? 128 : args.height,
    });
  } else {
    const bbox = computeBoundingBox(
      config.mapCenter.lat,
      config.mapCenter.lon,
      config.width,
      config.height,
      config.scaleMetersPerTile
    );
    const gridMeters = Math.max(config.width, config.height) * config.scaleMetersPerTile;
    console.log(
      `Origin: ${config.origin.name} (${config.origin.lat}, ${config.origin.lon}) | Map Center: (${config.mapCenter.lat}, ${config.mapCenter.lon}) | Grid: ${config.width}x${config.height} (${config.scaleMetersPerTile}m/tile = ${gridMeters}m)`
    );
    try {
      const elements = await fetchOsmElements(bbox, gridMeters);
      console.log(`Fetched ${elements.length} unique OpenStreetMap features. Rasterizing layers...`);
      worldMap = rasterizeOsmData(elements, config);
    } catch (err) {
      console.warn(`Live Overpass fetch unavailable (${err.message}). Falling back to offline map.`);
      worldMap = buildOfflineMap({ ...config, width: 128, height: 128 });
    }
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(worldMap), "utf8");

  const tileCounts = {};
  for (const id of worldMap.layers.base) {
    const label = worldMap.legend[String(id)] || String(id);
    tileCounts[label] = (tileCounts[label] || 0) + 1;
  }

  const addressedCount = (worldMap.buildings || []).filter((b) => b.houseNumber).length;
  console.log(`Wrote ${args.out}`);
  console.log(
    `Dimensions: ${worldMap.dimensions.width}x${worldMap.dimensions.height} | Spawn: (${worldMap.origin.spawnTile.x}, ${worldMap.origin.spawnTile.y}) | Street Zones: ${worldMap.streetZones.length} | Buildings: ${worldMap.buildings.length} (${addressedCount} with street addresses)`
  );
  console.log("Tile summary:", tileCounts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
