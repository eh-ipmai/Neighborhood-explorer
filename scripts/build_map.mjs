#!/usr/bin/env node
/**
 * Cross-platform OpenStreetMap -> RPG Tile Grid generator (world_map.json)
 * Implements GDD Section 2:
 *   Step 1: Bounding box & Equirectangular projection (1 tile = 5m x 5m)
 *   Step 2: 5-layer rasterization priority (Water -> Parks -> Roads/Sidewalks -> Crosswalks -> Buildings)
 *   Step 3: Street metadata & zone tagging (streetZones)
 *
 * Usage:
 *   node scripts/build_map.mjs                  # Live OSM Overpass build for Newton Centre
 *   node scripts/build_map.mjs --offline        # Deterministic offline Newton Centre layout
 *   node scripts/build_map.mjs --lat 42.3204 --lon -71.1965 --width 320 --height 320
 */

import dns from "node:dns";
import fs from "node:fs";
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
};

export const LEGEND = {
  "0": "grass",
  "1": "sidewalk",
  "2": "residential_road",
  "3": "main_road",
  "4": "crosswalk",
  "5": "building_wall",
  "6": "water",
};

export const DEFAULT_CONFIG = {
  tileSize: 16,
  scaleMetersPerTile: 5,
  width: 192,  // 192 * 5m = 960m (~0.6 mile x 0.6 mile neighborhood core)
  height: 192, // 192 * 5m = 960m
  origin: {
    lat: 42.3192253,
    lon: -71.1926696,
    name: "Home Base (565 Boylston St)",
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
  if (points.length < 3) return;
  let minY = height;
  let maxY = -1;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));

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
        }
      }
    }
  }
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
 * If none is found nearby, clear a small patio at center so player is never stuck.
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

  // Fallback: nearest non-colliding tile
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

  // Last resort: clear a 3x3 sidewalk around target
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
 * following strict 5-layer priority order and generating collision + streetZones.
 */
export function rasterizeOsmData(elements, config = DEFAULT_CONFIG) {
  const width = config.width ?? DEFAULT_CONFIG.width;
  const height = config.height ?? DEFAULT_CONFIG.height;
  const tileSize = config.tileSize ?? DEFAULT_CONFIG.tileSize;
  const scaleMetersPerTile = config.scaleMetersPerTile ?? DEFAULT_CONFIG.scaleMetersPerTile;
  const origin = { ...DEFAULT_CONFIG.origin, ...(config.origin || {}) };

  const base = new Array(width * height).fill(TILE_IDS.GRASS);
  const streetZones = [];

  const nodes = new Map();
  const ways = [];
  const crossingNodes = [];

  for (const el of elements) {
    if (el.type === "node") {
      nodes.set(el.id, el);
      if (el.tags && (el.tags.highway === "crossing" || el.tags.crossing)) {
        crossingNodes.push(el);
      }
    } else if (el.type === "way") {
      ways.push(el);
    }
  }

  const projectNode = (n) =>
    projectLatLonToTile(n.lat, n.lon, origin.lat, origin.lon, width, height, scaleMetersPerTile);

  function getWayPoints(way) {
    if (Array.isArray(way.geometry) && way.geometry.length > 0) {
      return way.geometry.map((pt) =>
        projectLatLonToTile(pt.lat, pt.lon, origin.lat, origin.lon, width, height, scaleMetersPerTile)
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
  const roadWays = [];
  const crossingWays = [];
  const buildingWays = [];

  for (const way of ways) {
    const tags = way.tags || {};
    if (isWaterFeature(tags)) {
      waterWays.push(way);
    } else if (tags.building) {
      buildingWays.push(way);
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

  // Priority 2: Parks & Greenery (overwrites grass cleanly, preserves water)
  for (const way of parkWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      fillPolygon(base, width, height, pts, TILE_IDS.GRASS, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  // Priority 3: Roads & Sidewalks
  // Pass 3a: Footways & sidewalks first
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

  // Pass 3b: Residential roads (with flanking sidewalk buffer)
  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.RESIDENTIAL_ROAD) continue;
    const pts = getWayPoints(way);
    // Flanking sidewalks on grass tiles first
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
        (cur) => cur === TILE_IDS.GRASS
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

  // Pass 3c: Arterial / main roads (wider road + flanking sidewalk buffer)
  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.MAIN_ROAD) continue;
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
        2,
        (cur) => cur === TILE_IDS.GRASS
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

  // Priority 4: Pedestrian Crossings (OSM crossing ways + crossing nodes)
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

  // Priority 5: Building Footprints (avoid overwriting roads/crosswalks so streets stay passable)
  for (const way of buildingWays) {
    const pts = getWayPoints(way);
    if (pts.length < 3) continue;
    fillPolygon(
      base,
      width,
      height,
      pts,
      TILE_IDS.BUILDING_WALL,
      (cur) =>
        cur === TILE_IDS.GRASS ||
        cur === TILE_IDS.SIDEWALK ||
        cur === TILE_IDS.BUILDING_WALL
    );
  }

  // Derive collision layer (1 = solid wall/water, 0 = walkable)
  const collision = base.map((tileId) =>
    tileId === TILE_IDS.BUILDING_WALL || tileId === TILE_IDS.WATER ? 1 : 0
  );

  // Guarantee walkable Home Base spawn near map center
  const spawnTile = ensureWalkableSpawn(
    base,
    collision,
    width,
    height,
    Math.floor(width / 2),
    Math.floor(height / 2)
  );

  return {
    tileSize,
    scaleMetersPerTile,
    origin: {
      ...origin,
      spawnTile,
    },
    dimensions: { width, height },
    legend: { ...LEGEND },
    layers: {
      base,
      collision,
    },
    streetZones,
  };
}

/**
 * Deterministic offline Newton Centre neighborhood layout for zero-network development & testing.
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

  // Crystal Lake / Pond in NW quadrant (Water priority 1)
  for (let y = 14; y <= 28; y++) {
    for (let x = 14; x <= 32; x++) {
      const dx = (x - 23) / 9;
      const dy = (y - 21) / 7;
      if (dx * dx + dy * dy <= 1) {
        base[y * width + x] = TILE_IDS.WATER;
      }
    }
  }

  // Boylston St (Route 9) running E-W through center (arterial road + sidewalks)
  const boylstonY = cy + 4;
  for (let x = 0; x < width; x++) {
    base[(boylstonY - 2) * width + x] = TILE_IDS.SIDEWALK;
    base[(boylstonY - 1) * width + x] = TILE_IDS.MAIN_ROAD;
    base[boylstonY * width + x] = TILE_IDS.MAIN_ROAD;
    base[(boylstonY + 1) * width + x] = TILE_IDS.MAIN_ROAD;
    base[(boylstonY + 2) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Parker St running N-S (residential road + sidewalks)
  const parkerX = cx - 10;
  for (let y = 0; y < height; y++) {
    if (base[y * width + parkerX] === TILE_IDS.WATER) continue;
    base[y * width + (parkerX - 1)] = TILE_IDS.SIDEWALK;
    base[y * width + parkerX] = TILE_IDS.RESIDENTIAL_ROAD;
    base[y * width + (parkerX + 1)] = TILE_IDS.SIDEWALK;
  }

  // Centre St running N-S east of Home Base
  const centreX = cx + 18;
  for (let y = 0; y < height; y++) {
    base[y * width + (centreX - 1)] = TILE_IDS.SIDEWALK;
    base[y * width + centreX] = TILE_IDS.RESIDENTIAL_ROAD;
    base[y * width + (centreX + 1)] = TILE_IDS.SIDEWALK;
  }

  // Ward St running E-W north of Home Base
  const wardY = cy - 22;
  for (let x = 8; x < width - 8; x++) {
    if (base[wardY * width + x] === TILE_IDS.WATER) continue;
    base[(wardY - 1) * width + x] = TILE_IDS.SIDEWALK;
    base[wardY * width + x] = TILE_IDS.RESIDENTIAL_ROAD;
    base[(wardY + 1) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Oakdale Woods footpath loop in SE quadrant
  for (let x = cx + 6; x <= cx + 38; x++) {
    base[(cy + 24) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Crosswalks across Boylston St at Parker St, Home Base, and Centre St
  for (const crossX of [parkerX, cx, centreX]) {
    for (let y = boylstonY - 1; y <= boylstonY + 1; y++) {
      base[y * width + crossX] = TILE_IDS.CROSSWALK;
      base[y * width + (crossX + 1)] = TILE_IDS.CROSSWALK;
    }
  }

  // Neighborhood houses & landmark buildings
  const buildings = [
    // Home Base house right north of Boylston sidewalk
    { x: cx - 3, y: cy - 3, w: 6, h: 4 },
    // Neighbor houses along Boylston St
    { x: cx - 22, y: cy - 3, w: 6, h: 4 },
    { x: cx + 7, y: cy - 3, w: 6, h: 4 },
    // Newton Free Library (NE)
    { x: centreX + 6, y: wardY - 10, w: 10, h: 7 },
    // Congregation Beth El-Atereth Israel (NW along Ward St)
    { x: parkerX - 14, y: wardY - 9, w: 9, h: 6 },
    // School building (SE)
    { x: centreX + 8, y: boylstonY + 8, w: 10, h: 7 },
    // Salzberg House (NE)
    { x: centreX + 22, y: cy - 12, w: 6, h: 5 },
  ];

  for (const b of buildings) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (inBounds(x, y, width, height) && base[y * width + x] === TILE_IDS.GRASS) {
          base[y * width + x] = TILE_IDS.BUILDING_WALL;
        }
      }
    }
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
  };
}

async function fetchOsmElements(bbox) {
  const bboxStr = `${bbox.south.toFixed(6)},${bbox.west.toFixed(6)},${bbox.north.toFixed(6)},${bbox.east.toFixed(6)}`;
  const query = `
[out:json][timeout:40];
(
  way["natural"="water"](${bboxStr});
  way["waterway"~"riverbank|river|stream|canal"](${bboxStr});
  way["leisure"~"park|pitch|playground|garden|nature_reserve"](${bboxStr});
  way["landuse"~"grass|forest|meadow|recreation_ground|village_green"](${bboxStr});
  way["natural"~"wood|grassland"](${bboxStr});
  way["highway"](${bboxStr});
  node["highway"="crossing"](${bboxStr});
  way["building"](${bboxStr});
);
out tags geom;
`;

  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      console.log(`Querying OpenStreetMap Overpass API: ${endpoint}`);
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
      if (Array.isArray(data.elements) && data.elements.length > 0) {
        return data.elements;
      }
      throw new Error("Empty Overpass response");
    } catch (err) {
      lastError = err;
      console.warn(`Overpass mirror failed (${endpoint}): ${err.message}`);
    }
  }
  throw lastError || new Error("All Overpass mirrors failed");
}

function parseCliArgs(argv) {
  const args = {
    offline: false,
    lat: DEFAULT_CONFIG.origin.lat,
    lon: DEFAULT_CONFIG.origin.lon,
    name: DEFAULT_CONFIG.origin.name,
    width: DEFAULT_CONFIG.width,
    height: DEFAULT_CONFIG.height,
    scale: DEFAULT_CONFIG.scaleMetersPerTile,
    out: path.resolve(process.cwd(), "data", "world_map.json"),
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--offline") args.offline = true;
    else if (a === "--lat" && argv[i + 1]) args.lat = Number(argv[++i]);
    else if (a === "--lon" && argv[i + 1]) args.lon = Number(argv[++i]);
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
      config.origin.lat,
      config.origin.lon,
      config.width,
      config.height,
      config.scaleMetersPerTile
    );
    console.log(
      `Origin: ${config.origin.name} (${config.origin.lat}, ${config.origin.lon}) | Grid: ${config.width}x${config.height} (${config.scaleMetersPerTile}m/tile)`
    );
    try {
      const elements = await fetchOsmElements(bbox);
      console.log(`Fetched ${elements.length} OpenStreetMap features. Rasterizing layers...`);
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

  console.log(`Wrote ${args.out}`);
  console.log(
    `Dimensions: ${worldMap.dimensions.width}x${worldMap.dimensions.height} | Spawn: (${worldMap.origin.spawnTile.x}, ${worldMap.origin.spawnTile.y}) | Street Zones: ${worldMap.streetZones.length}`
  );
  console.log("Tile summary:", tileCounts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
