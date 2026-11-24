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
  DIRT: 9,
  SAND: 10,
  PARK: 11,
  HIGHWAY: 12,
  HIGHWAY_MEDIAN: 13,
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
  "9": "dirt",
  "10": "sand",
  "11": "park",
  "12": "highway",
  "13": "highway_median",
};

export const HOUSE_ARCH_TYPES = [
  "colonial",
  "cape",
  "craftsman",
  "gambrel",
  "tudor",
  "victorian",
  "brownstone",
  "stone_manor",
  "saltbox",
  "farmhouse",
  "ranch",
  "modern",
];

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

function isHighwayRoadName(name = "") {
  const lower = String(name).toLowerCase();
  return (
    lower.includes("boylston") ||
    lower.includes("route 9") ||
    lower.includes("parkway") ||
    lower.includes("turnpike") ||
    lower.includes("expressway") ||
    lower.includes("highway")
  );
}

function isTrailName(name = "") {
  const lower = String(name).toLowerCase();
  return (
    lower.includes("trail") ||
    lower.includes("greenway") ||
    lower.includes("treeway") ||
    lower.includes("bridle") ||
    lower.includes("woods")
  );
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
    hw === "motorway_link" ||
    hw === "trunk_link" ||
    (hw === "primary" && isHighwayRoadName(tags.name))
  ) {
    return { tile: TILE_IDS.HIGHWAY, zoneType: "arterial", radius: 1 };
  }
  if (
    hw === "primary" ||
    hw === "secondary" ||
    hw === "tertiary" ||
    hw === "primary_link" ||
    hw === "secondary_link"
  ) {
    return { tile: TILE_IDS.MAIN_ROAD, zoneType: "arterial", radius: 1 };
  }
  if (
    hw === "residential" ||
    hw === "living_street" ||
    hw === "unclassified"
  ) {
    return { tile: TILE_IDS.RESIDENTIAL_ROAD, zoneType: "residential", radius: 0 };
  }
  const surface = String(tags.surface || "").toLowerCase();
  const isUnpavedSurface =
    surface === "dirt" ||
    surface === "earth" ||
    surface === "ground" ||
    surface === "unpaved" ||
    surface === "gravel" ||
    surface === "fine_gravel" ||
    surface === "woodchips" ||
    surface === "mud";
  if (hw === "service") {
    // Parking aisles stay part of the parking lot; driveways, park service lanes & sidepaths are walkable paths — never full roads!
    if (String(tags.service || "").toLowerCase() === "parking_aisle") {
      return { tile: TILE_IDS.PARKING_LOT, zoneType: "parking", radius: 0 };
    }
    if (isUnpavedSurface || isTrailName(tags.name)) {
      return { tile: TILE_IDS.DIRT, zoneType: "trail", radius: 0 };
    }
    return { tile: TILE_IDS.SIDEWALK, zoneType: "sidewalk", radius: 0 };
  }
  if (
    hw === "track" ||
    hw === "bridleway" ||
    (hw === "path" && (isUnpavedSurface || isTrailName(tags.name) || !surface))
  ) {
    return { tile: TILE_IDS.DIRT, zoneType: "trail", radius: 0 };
  }
  if (
    hw === "footway" ||
    hw === "path" ||
    hw === "pedestrian" ||
    hw === "cycleway" ||
    hw === "steps"
  ) {
    if (isUnpavedSurface || isTrailName(tags.name)) {
      return { tile: TILE_IDS.DIRT, zoneType: "trail", radius: 0 };
    }
    return { tile: TILE_IDS.SIDEWALK, zoneType: "sidewalk", radius: 0 };
  }
  return null;
}

export function classifyBuildingKind(tags = {}, bounds = null, address = "", name = "") {
  const b = String(tags.building || "yes").toLowerCase();
  const amenity = String(tags.amenity || "").toLowerCase();
  const lowerName = String(name || tags.name || "").toLowerCase();

  if (amenity === "library" || b === "library" || lowerName.includes("library")) return "library";
  if (
    amenity === "fire_station" ||
    b === "fire_station" ||
    lowerName.includes("fire station") ||
    lowerName.includes("fire hq") ||
    lowerName.includes("firehouse")
  ) {
    return "fire_station";
  }
  if (b === "greenhouse" || b === "conservatory" || lowerName.includes("greenhouse") || lowerName.includes("conservatory")) {
    return "greenhouse";
  }
  if (
    amenity === "school" ||
    amenity === "college" ||
    amenity === "university" ||
    b === "school" ||
    b === "university" ||
    b === "college" ||
    lowerName.includes("school") ||
    lowerName.includes("elementary") ||
    lowerName.includes("boston college") ||
    lowerName.includes("bc law") ||
    lowerName.includes("bc ") ||
    lowerName.includes("college") ||
    lowerName.includes("university") ||
    lowerName.includes("cushing hall") ||
    lowerName.includes("hardey house") ||
    lowerName.includes("barat house") ||
    lowerName.includes("duchesne") ||
    lowerName.includes("stuart hall") ||
    lowerName.includes("keyes") ||
    lowerName.includes("mary house") ||
    lowerName.includes("medeiros") ||
    lowerName.includes("claver") ||
    lowerName.includes("more hall")
  ) {
    return "school";
  }
  if (
    amenity === "place_of_worship" ||
    amenity === "townhall" ||
    amenity === "community_centre" ||
    b === "church" ||
    b === "synagogue" ||
    b === "chapel" ||
    b === "civic" ||
    b === "public" ||
    lowerName.includes("church") ||
    lowerName.includes("parish") ||
    lowerName.includes("chapel") ||
    lowerName.includes("temple") ||
    lowerName.includes("congregation") ||
    lowerName.includes("beth el")
  ) {
    return "civic";
  }
  if (
    b === "garage" ||
    b === "garages" ||
    b === "shed" ||
    b === "carport" ||
    b === "outbuilding" ||
    b === "barn"
  ) {
    return "garage";
  }
  if (
    amenity === "cafe" ||
    amenity === "ice_cream" ||
    tags.shop === "bakery" ||
    tags.shop === "pastry" ||
    tags.shop === "coffee" ||
    lowerName.includes("bakery") ||
    lowerName.includes("bagel") ||
    lowerName.includes("licks") ||
    lowerName.includes("dunkin") ||
    lowerName.includes("cafe") ||
    lowerName.includes("coffee")
  ) {
    return "bakery_cafe";
  }
  if (
    tags.shop === "books" ||
    tags.shop === "convenience" ||
    tags.shop === "supermarket" ||
    tags.shop === "greengrocer" ||
    b === "supermarket" ||
    lowerName.includes("market") ||
    lowerName.includes("books") ||
    lowerName.includes("taqueria") ||
    lowerName.includes("pharmacy")
  ) {
    return "corner_market";
  }
  if (
    b === "office" ||
    tags.office ||
    amenity === "bank" ||
    amenity === "clinic" ||
    amenity === "doctors" ||
    lowerName.includes("medical") ||
    lowerName.includes("office") ||
    lowerName.includes("bank")
  ) {
    return "office_plaza";
  }
  if (
    b === "commercial" ||
    b === "retail" ||
    b === "kiosk" ||
    tags.shop ||
    amenity === "restaurant" ||
    amenity === "pharmacy"
  ) {
    return "commercial";
  }
  if (
    b === "apartments" ||
    b === "terrace" ||
    b === "dormitory" ||
    b === "hotel" ||
    b === "residential"
  ) {
    return "apartments";
  }
  if (b === "semidetached_house" || b === "duplex") {
    return "duplex";
  }

  // Footprint & multi-unit address heuristics for untagged OSM building=yes polygons
  if (bounds) {
    const w = bounds.maxX - bounds.minX + 1;
    const h = bounds.maxY - bounds.minY + 1;
    const area = w * h;
    if (!address && !lowerName && w <= 2 && h <= 2) {
      return "garage";
    }
    if (String(address).includes(";")) {
      const units = String(address).split(";").length;
      if (units >= 3 || area >= 25) return "apartments";
      return "duplex";
    }
    if (area >= 64 && !lowerName.includes("house")) {
      return "apartments";
    }
  }
  return "house";
}

export function classifyHouseArch({ id = "", address = "", bounds = null, isHomeBase = false, tags = {} } = {}) {
  if (isHomeBase) return "colonial";
  const b = String(tags.building || "").toLowerCase();
  const archTag = String(tags["building:architecture"] || "").toLowerCase();
  const roofShape = String(tags["roof:shape"] || "").toLowerCase();

  if (archTag.includes("tudor")) return "tudor";
  if (archTag.includes("victorian") || archTag.includes("queen_anne") || b === "villa") return "victorian";
  if (archTag.includes("craftsman") || archTag.includes("arts_and_crafts")) return "craftsman";
  if (archTag.includes("gambrel") || archTag.includes("dutch") || roofShape === "gambrel") return "gambrel";
  if (archTag.includes("brownstone") || archTag.includes("rowhouse")) return "brownstone";
  if (archTag.includes("manor") || archTag.includes("stone") || archTag.includes("chateau")) return "stone_manor";
  if (archTag.includes("saltbox") || roofShape === "saltbox") return "saltbox";
  if (archTag.includes("farmhouse") || b === "farmhouse") return "farmhouse";
  if (archTag.includes("colonial")) return "colonial";
  if (archTag.includes("modern") || archTag.includes("contemporary") || roofShape === "flat" || roofShape === "skillion") return "modern";
  if (b === "bungalow" || roofShape === "hipped") return "ranch";
  if (b === "cottage") return "cape";

  const w = bounds ? bounds.maxX - bounds.minX + 1 : 3;
  const h = bounds ? bounds.maxY - bounds.minY + 1 : 3;
  const key = address || id || `${bounds?.minX || 0}_${bounds?.minY || 0}`;
  const hash = hashString(key);

  // Subtle footprint hints while keeping rich variety across ALL 12 residential architectures!
  if (w >= h + 3 && hash % 3 === 0) {
    const wideStyles = ["ranch", "modern", "farmhouse", "craftsman"];
    return wideStyles[hash % wideStyles.length];
  }
  if (h >= w + 2 && hash % 3 === 0) {
    const tallStyles = ["brownstone", "victorian", "stone_manor", "tudor"];
    return tallStyles[hash % tallStyles.length];
  }
  return HOUSE_ARCH_TYPES[hash % HOUSE_ARCH_TYPES.length];
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

function isSandFeature(tags = {}) {
  const surface = String(tags.surface || "").toLowerCase();
  return (
    tags.natural === "sand" ||
    tags.natural === "beach" ||
    surface === "sand" ||
    tags.leisure === "sandbox" ||
    tags.sport === "beachvolleyball"
  );
}

function isDirtFeature(tags = {}) {
  const surface = String(tags.surface || "").toLowerCase();
  return (
    surface === "dirt" ||
    surface === "earth" ||
    surface === "clay" ||
    surface === "gravel" ||
    surface === "unpaved" ||
    tags.landuse === "construction" ||
    tags.landuse === "brownfield" ||
    tags.sport === "baseball"
  );
}

function isManicuredParkFeature(tags = {}) {
  return (
    tags.leisure === "park" ||
    tags.leisure === "pitch" ||
    tags.leisure === "playground" ||
    tags.leisure === "garden" ||
    tags.landuse === "recreation_ground" ||
    tags.landuse === "village_green"
  );
}

function isParkFeature(tags = {}) {
  return (
    isManicuredParkFeature(tags) ||
    tags.leisure === "nature_reserve" ||
    tags.landuse === "grass" ||
    tags.landuse === "forest" ||
    tags.landuse === "meadow" ||
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
    tags.leisure === "nature_reserve"
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
 * Perpendicular distance from point p to segment a->b (used for Ramer-Douglas-Peucker).
 */
function pointToSegmentDist(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function douglasPeucker(points, epsilon) {
  if (points.length <= 2) return points.slice();
  let maxDist = -1;
  let maxIdx = 0;
  const start = points[0];
  const end = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToSegmentDist(points[i], start, end);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
    const right = douglasPeucker(points.slice(maxIdx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [start, end];
}

/**
 * Simplify & straighten road/path polylines so tiny OSM bends and slight off-axis wiggles
 * become crisp, easy-to-navigate SNES avenues instead of busy 1-tile stair-step zig-zags.
 */
export function simplifyRoadPolyline(points, { epsilon = 2.4, snapMaxDrift = 3, snapSlope = 0.28 } = {}) {
  if (!Array.isArray(points) || points.length <= 1) return points ? points.slice() : [];
  // 1. Deduplicate consecutive identical tile coordinates
  const dedup = [{ x: Math.round(points[0].x), y: Math.round(points[0].y) }];
  for (let i = 1; i < points.length; i++) {
    const px = Math.round(points[i].x);
    const py = Math.round(points[i].y);
    const prev = dedup[dedup.length - 1];
    if (px !== prev.x || py !== prev.y) dedup.push({ x: px, y: py });
  }
  if (dedup.length <= 2) {
    // Still snap a single near-cardinal segment so gentle tilts become clean straight runs
    if (dedup.length === 2) {
      const a = { ...dedup[0] };
      const b = { ...dedup[1] };
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      if (dx >= 4 && dy > 0 && dy <= snapMaxDrift && dy / dx <= snapSlope) {
        const midY = Math.round((a.y + b.y) / 2);
        return [{ x: a.x, y: midY }, { x: b.x, y: midY }];
      }
      if (dy >= 4 && dx > 0 && dx <= snapMaxDrift && dx / dy <= snapSlope) {
        const midX = Math.round((a.x + b.x) / 2);
        return [{ x: midX, y: a.y }, { x: midX, y: b.y }];
      }
    }
    return dedup;
  }

  // 2. Ramer-Douglas-Peucker simplification erases small micro-bends
  const simplified = douglasPeucker(dedup, epsilon).map((p) => ({ x: p.x, y: p.y }));

  // 3. Snap nearly-horizontal and nearly-vertical segments to crisp cardinal axes
  for (let i = 0; i < simplified.length - 1; i++) {
    const a = simplified[i];
    const b = simplified[i + 1];
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    if (dx >= 4 && dy > 0 && dy <= snapMaxDrift && dy / dx <= snapSlope) {
      b.y = a.y;
    } else if (dy >= 4 && dx > 0 && dx <= snapMaxDrift && dx / dy <= snapSlope) {
      b.x = a.x;
    }
  }

  // 4. Remove any newly collinear intermediate points
  const clean = [simplified[0]];
  for (let i = 1; i < simplified.length - 1; i++) {
    const prev = clean[clean.length - 1];
    const cur = simplified[i];
    const next = simplified[i + 1];
    const sameX = prev.x === cur.x && cur.x === next.x;
    const sameY = prev.y === cur.y && cur.y === next.y;
    if (!sameX && !sameY) clean.push(cur);
  }
  const last = simplified[simplified.length - 1];
  const prevLast = clean[clean.length - 1];
  if (last.x !== prevLast.x || last.y !== prevLast.y) clean.push(last);
  return clean;
}

/**
 * Draw a simplified road/path segment using chunky cardinal runs on gentle slopes
 * (instead of noisy 1-tile Bresenham stair-steps every few tiles).
 */
function drawSimplifiedSegment(grid, width, height, x0, y0, x1, y1, value, radius = 0, filterFn = null) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);

  // Already axis-aligned or true steep diagonal -> standard line
  if (adx === 0 || ady === 0) {
    drawLine(grid, width, height, x0, y0, x1, y1, value, radius, filterFn);
    return;
  }

  // Gentle horizontal tilt: break into long straight horizontal stretches with clean vertical jogs
  if (adx >= ady * 2.4) {
    const steps = Math.max(1, Math.min(ady, Math.floor(adx / 10)));
    let cx = x0;
    let cy = y0;
    for (let s = 1; s <= steps; s++) {
      const midX = Math.round(x0 + (dx * (s - 0.5)) / steps);
      const nextY = Math.round(y0 + (dy * s) / steps);
      drawLine(grid, width, height, cx, cy, midX, cy, value, radius, filterFn);
      drawLine(grid, width, height, midX, cy, midX, nextY, value, radius, filterFn);
      cx = midX;
      cy = nextY;
    }
    drawLine(grid, width, height, cx, cy, x1, y1, value, radius, filterFn);
    return;
  }

  // Gentle vertical tilt: break into long straight vertical stretches with clean horizontal jogs
  if (ady >= adx * 2.4) {
    const steps = Math.max(1, Math.min(adx, Math.floor(ady / 10)));
    let cx = x0;
    let cy = y0;
    for (let s = 1; s <= steps; s++) {
      const midY = Math.round(y0 + (dy * (s - 0.5)) / steps);
      const nextX = Math.round(x0 + (dx * s) / steps);
      drawLine(grid, width, height, cx, cy, cx, midY, value, radius, filterFn);
      drawLine(grid, width, height, cx, midY, nextX, midY, value, radius, filterFn);
      cx = nextX;
      cy = midY;
    }
    drawLine(grid, width, height, cx, cy, x1, y1, value, radius, filterFn);
    return;
  }

  drawLine(grid, width, height, x0, y0, x1, y1, value, radius, filterFn);
}

/**
 * Trace unbranched RESIDENTIAL_ROAD chains between intersections/anchors, simplify with
 * aggressive Douglas-Peucker, and re-rasterize as crisp, long cardinal SNES avenues with
 * clean 90° L-corners (picking the L-bend orientation that avoids buildings & water!).
 */
export function straightenResidentialRoadChains(base, width, height) {
  const isMajorOrCross = (t) =>
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.CROSSWALK;
  const isRes = (x, y) => inBounds(x, y, width, height) && base[y * width + x] === TILE_IDS.RESIDENTIAL_ROAD;

  // 1. Mark anchor tiles (intersections, endpoints, tiles touching major roads/crosswalks/borders)
  const anchors = new Uint8Array(width * height);
  const resNeighbors8 = (x, y) => {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (isRes(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
      }
    }
    return out;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (base[idx] !== TILE_IDS.RESIDENTIAL_ROAD) continue;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) {
        anchors[idx] = 1;
        continue;
      }
      let touchesMajor = false;
      let resDeg = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nt = base[(y + dy) * width + (x + dx)];
          if (isMajorOrCross(nt)) touchesMajor = true;
          if (nt === TILE_IDS.RESIDENTIAL_ROAD) resDeg++;
        }
      }
      if (touchesMajor || resDeg !== 2) {
        anchors[idx] = 1;
      }
    }
  }

  // 2. Trace every maximal non-anchor chain connecting anchor -> ... -> anchor
  const visitedEdge = new Set();
  const visitedInterior = new Uint8Array(width * height);
  const chains = [];
  const edgeKey = (ax, ay, bx, by) =>
    ax < bx || (ax === bx && ay < by) ? `${ax},${ay}-${bx},${by}` : `${bx},${by}-${ax},${ay}`;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const startIdx = y * width + x;
      if (!anchors[startIdx]) continue;
      for (const nb of resNeighbors8(x, y)) {
        const nbIdx = nb.y * width + nb.x;
        if (anchors[nbIdx] || visitedInterior[nbIdx]) continue;
        const ek = edgeKey(x, y, nb.x, nb.y);
        if (visitedEdge.has(ek)) continue;

        const chain = [{ x, y }, { x: nb.x, y: nb.y }];
        visitedEdge.add(ek);
        visitedInterior[nbIdx] = 1;

        let prev = { x, y };
        let cur = { x: nb.x, y: nb.y };
        let safety = 0;
        while (safety++ < 600) {
          const nbs = resNeighbors8(cur.x, cur.y);
          // Prefer non-visited neighbor that isn't prev
          let next = null;
          for (const c of nbs) {
            if (c.x === prev.x && c.y === prev.y) continue;
            const cIdx = c.y * width + c.x;
            if (!anchors[cIdx] && visitedInterior[cIdx]) continue;
            next = c;
            break;
          }
          if (!next) break;
          chain.push(next);
          visitedEdge.add(edgeKey(cur.x, cur.y, next.x, next.y));
          if (anchors[next.y * width + next.x]) break;
          visitedInterior[next.y * width + next.x] = 1;
          prev = cur;
          cur = next;
        }

        if (chain.length >= 5) {
          chains.push(chain);
        }
      }
    }
  }

  // Helper: build a clean chunky-cardinal path between two points, choosing H-first vs V-first to avoid water/buildings
  const buildCleanLegTiles = (x0, y0, x1, y1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const addSeg = (list, ax, ay, bx, by) => {
      let cx = ax;
      let cy = ay;
      const sx = ax < bx ? 1 : -1;
      const sy = ay < by ? 1 : -1;
      while (cx !== bx) {
        list.push({ x: cx, y: cy });
        cx += sx;
      }
      while (cy !== by) {
        list.push({ x: cx, y: cy });
        cy += sy;
      }
      list.push({ x: bx, y: by });
    };

    if (adx === 0 || ady === 0) {
      const pts = [];
      addSeg(pts, x0, y0, x1, y1);
      return pts;
    }

    // Build two clean orthogonalized candidates (H-first vs V-first) with long straight runs & crisp 90° turns!
    const makeCandidate = (horizFirst) => {
      const pts = [];
      const minSpan = Math.min(adx, ady);
      const steps = Math.max(1, Math.ceil(minSpan / 6));
      let cx = x0;
      let cy = y0;
      for (let s = 1; s <= steps; s++) {
        const nx = Math.round(x0 + (dx * s) / steps);
        const ny = Math.round(y0 + (dy * s) / steps);
        if (horizFirst) {
          addSeg(pts, cx, cy, nx, cy);
          addSeg(pts, nx, cy, nx, ny);
        } else {
          addSeg(pts, cx, cy, cx, ny);
          addSeg(pts, cx, ny, nx, ny);
        }
        cx = nx;
        cy = ny;
      }
      return pts;
    };

    const scoreCandidate = (pts) => {
      let score = 0;
      for (const p of pts) {
        if (!inBounds(p.x, p.y, width, height)) return 1e9;
        const t = base[p.y * width + p.x];
        if (t === TILE_IDS.WATER) score += 1000;
        else if (t === TILE_IDS.BUILDING_WALL) score += 25;
        else if (t === TILE_IDS.PARK || t === TILE_IDS.SAND) score += 6;
        else if (t === TILE_IDS.RESIDENTIAL_ROAD || t === TILE_IDS.SIDEWALK) score -= 2;
      }
      return score;
    };

    const candA = makeCandidate(true);
    const candB = makeCandidate(false);
    return scoreCandidate(candA) <= scoreCandidate(candB) ? candA : candB;
  };

  // 3. Replace each wiggly chain with its simplified orthogonalized SNES street (strictly staying in its real corridor!)
  const erasedRoadTiles = [];
  for (const chain of chains) {
    const start = chain[0];
    const end = chain[chain.length - 1];
    // Erase 1-3 tile micro-bends so streets run in long, straight, easy-to-navigate lines!
    const simplified = simplifyRoadPolyline(chain, { epsilon: 2.5, snapMaxDrift: 3, snapSlope: 0.28 });
    // Keep exact anchor endpoints pinned so intersections never disconnect!
    simplified[0] = { x: start.x, y: start.y };
    simplified[simplified.length - 1] = { x: end.x, y: end.y };

    const newTiles = [];
    let hitsWater = false;
    let wallHits = 0;
    let maxDev = 0;
    for (let i = 0; i < simplified.length - 1; i++) {
      const seg = buildCleanLegTiles(
        simplified[i].x,
        simplified[i].y,
        simplified[i + 1].x,
        simplified[i + 1].y
      );
      for (const p of seg) {
        if (!inBounds(p.x, p.y, width, height)) continue;
        const t = base[p.y * width + p.x];
        if (t === TILE_IDS.WATER) hitsWater = true;
        if (t === TILE_IDS.BUILDING_WALL) wallHits++;
        // Measure closest distance back to original street chain so no road ever jumps out of its real block!
        let minD = Infinity;
        for (const orig of chain) {
          const d = Math.hypot(p.x - orig.x, p.y - orig.y);
          if (d < minD) minD = d;
        }
        if (minD > maxDev) maxDev = minD;
        newTiles.push(p);
      }
    }
    if (hitsWater || wallHits > 4 || maxDev > 3.6 || newTiles.length === 0) continue;

    // Clear old interior chain tiles (preserve anchors!)
    for (let i = 1; i < chain.length - 1; i++) {
      const p = chain[i];
      if (!anchors[p.y * width + p.x] && base[p.y * width + p.x] === TILE_IDS.RESIDENTIAL_ROAD) {
        base[p.y * width + p.x] = TILE_IDS.GRASS;
        erasedRoadTiles.push(p);
      }
    }

    // Paint clean orthogonalized residential road (never overwrite major roads, crosswalks, or water)
    for (const p of newTiles) {
      const idx = p.y * width + p.x;
      const cur = base[idx];
      if (!isMajorOrCross(cur) && cur !== TILE_IDS.WATER) {
        base[idx] = TILE_IDS.RESIDENTIAL_ROAD;
      }
    }
  }

  // Clean up leftover orphan sidewalks that flanked the erased old wiggly curves
  const isAnyRoad = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.CROSSWALK;
  for (const p of erasedRoadTiles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = p.x + dx;
        const ny = p.y + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        const nIdx = ny * width + nx;
        if (base[nIdx] !== TILE_IDS.SIDEWALK) continue;
        let nearRoad = false;
        for (let oy = -1; oy <= 1 && !nearRoad; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const rx = nx + ox;
            const ry = ny + oy;
            if (!inBounds(rx, ry, width, height)) continue;
            const rt = base[ry * width + rx];
            if (isAnyRoad(rt) || rt === TILE_IDS.PARKING_LOT || rt === TILE_IDS.DIRT) {
              nearRoad = true;
              break;
            }
          }
        }
        if (!nearRoad) base[nIdx] = TILE_IDS.GRASS;
      }
    }
  }
}

/**
 * Widen narrow 1-tile residential streets into bold, easy-to-navigate 2-tile-wide
 * neighborhood streets along straight stretches wherever space permits (strictly avoiding
 * water, buildings, parks, highways, and protected spawn/landmark tiles!).
 * Idempotent: already-2-tile stretches are untouched.
 */
export function widenResidentialStreets(base, width, height, protectedTiles = []) {
  const snap = base.slice();
  const protectedSet = new Set();
  for (const pt of protectedTiles) {
    if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number") continue;
    const r = pt.radius ?? 1;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.floor(pt.x) + dx;
        const py = Math.floor(pt.y) + dy;
        if (inBounds(px, py, width, height)) protectedSet.add(py * width + px);
      }
    }
  }

  const isResSnap = (x, y) => inBounds(x, y, width, height) && snap[y * width + x] === TILE_IDS.RESIDENTIAL_ROAD;
  const canWidenInto = (x, y, sideX, sideY) => {
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) return false;
    const idx = y * width + x;
    if (protectedSet.has(idx)) return false;
    const cur = base[idx];
    if (cur !== TILE_IDS.GRASS && cur !== TILE_IDS.SIDEWALK) return false;
    // Keep a clear 1-tile sidewalk buffer beyond the widened lane (never crush buildings or water!)
    const beyondX = x + sideX;
    const beyondY = y + sideY;
    if (!inBounds(beyondX, beyondY, width, height)) return false;
    const beyond = base[beyondY * width + beyondX];
    if (beyond === TILE_IDS.WATER || beyond === TILE_IDS.BUILDING_WALL || beyond === TILE_IDS.HIGHWAY || beyond === TILE_IDS.HIGHWAY_MEDIAN) {
      return false;
    }
    return true;
  };

  // 1. Widen straight 1-tile horizontal residential street runs consistently onto South or North side
  for (let y = 2; y < height - 2; y++) {
    let x = 2;
    while (x < width - 2) {
      const isHorizSingle = (cx) =>
        isResSnap(cx, y) &&
        !isResSnap(cx, y - 1) &&
        !isResSnap(cx, y + 1) &&
        (isResSnap(cx - 1, y) || isResSnap(cx + 1, y));

      if (!isHorizSingle(x)) {
        x++;
        continue;
      }
      const xStart = x;
      while (x < width - 2 && isHorizSingle(x)) x++;
      const xEnd = x - 1;
      if (xEnd - xStart + 1 < 3) continue;

      let southOk = 0;
      let northOk = 0;
      for (let cx = xStart; cx <= xEnd; cx++) {
        if (canWidenInto(cx, y + 1, 0, 1)) southOk++;
        if (canWidenInto(cx, y - 1, 0, -1)) northOk++;
      }
      const dy = southOk >= northOk ? 1 : -1;
      for (let cx = xStart; cx <= xEnd; cx++) {
        if (canWidenInto(cx, y + dy, 0, dy)) {
          base[(y + dy) * width + cx] = TILE_IDS.RESIDENTIAL_ROAD;
        }
      }
    }
  }

  // 2. Widen straight 1-tile vertical residential street runs consistently onto East or West side
  for (let x = 2; x < width - 2; x++) {
    let y = 2;
    while (y < height - 2) {
      const isVertSingle = (cy) =>
        isResSnap(x, cy) &&
        !isResSnap(x - 1, cy) &&
        !isResSnap(x + 1, cy) &&
        (isResSnap(x, cy - 1) || isResSnap(x, cy + 1));

      if (!isVertSingle(y)) {
        y++;
        continue;
      }
      const yStart = y;
      while (y < height - 2 && isVertSingle(y)) y++;
      const yEnd = y - 1;
      if (yEnd - yStart + 1 < 3) continue;

      let eastOk = 0;
      let westOk = 0;
      for (let cy = yStart; cy <= yEnd; cy++) {
        if (canWidenInto(x + 1, cy, 1, 0)) eastOk++;
        if (canWidenInto(x - 1, cy, -1, 0)) westOk++;
      }
      const dx = eastOk >= westOk ? 1 : -1;
      for (let cy = yStart; cy <= yEnd; cy++) {
        if (canWidenInto(x + dx, cy, dx, 0)) {
          base[cy * width + (x + dx)] = TILE_IDS.RESIDENTIAL_ROAD;
        }
      }
    }
  }
}

/**
 * Smooth 1-tile wobbles & stair-step edges along multi-lane MAIN_ROAD & HIGHWAY boulevards
 * using a 9-tile directional majority edge-filter (while keeping crosswalks & water untouched!).
 */
export function straightenMajorRoadBands(base, width, height) {
  const isMajor = (t) => t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.HIGHWAY;
  const isMajorOrCross = (t) => isMajor(t) || t === TILE_IDS.CROSSWALK;
  const nearCrossOrWater = (snap, x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        const t = snap[ny * width + nx];
        if (t === TILE_IDS.CROSSWALK || t === TILE_IDS.WATER) return true;
      }
    }
    return false;
  };

  for (let pass = 0; pass < 2; pass++) {
    const snap = base.slice();
    for (let y = 4; y < height - 4; y++) {
      for (let x = 4; x < width - 4; x++) {
        const idx = y * width + x;
        const cur = snap[idx];
        if (cur !== TILE_IDS.MAIN_ROAD && cur !== TILE_IDS.HIGHWAY && cur !== TILE_IDS.SIDEWALK) continue;
        if (nearCrossOrWater(snap, x, y)) continue;

        // Horizontal window [x-4..x+4] for E-W boulevards (count crosswalks as part of road continuity!)
        let hMain = 0;
        let hHw = 0;
        let hCross = 0;
        for (let dx = -4; dx <= 4; dx++) {
          const t = snap[y * width + (x + dx)];
          if (t === TILE_IDS.MAIN_ROAD) hMain++;
          else if (t === TILE_IDS.HIGHWAY) hHw++;
          else if (t === TILE_IDS.CROSSWALK) hCross++;
        }
        // Vertical window [y-4..y+4] for N-S avenues (count crosswalks as part of road continuity!)
        let vMain = 0;
        let vHw = 0;
        let vCross = 0;
        for (let dy = -4; dy <= 4; dy++) {
          const t = snap[(y + dy) * width + x];
          if (t === TILE_IDS.MAIN_ROAD) vMain++;
          else if (t === TILE_IDS.HIGHWAY) vHw++;
          else if (t === TILE_IDS.CROSSWALK) vCross++;
        }

        const hCount = hMain + hHw + hCross;
        const vCount = vMain + vHw + vCross;
        if (cur === TILE_IDS.SIDEWALK) {
          // Fill ONLY shallow horizontal or vertical curb dents along genuinely straight boulevards (never widen diagonals!)
          if (hMain + hHw >= 7 && (isMajor(snap[(y - 1) * width + x]) || isMajor(snap[(y + 1) * width + x]))) {
            base[idx] = hHw >= hMain ? TILE_IDS.HIGHWAY : TILE_IDS.MAIN_ROAD;
          } else if (vMain + vHw >= 7 && (isMajor(snap[y * width + (x - 1)]) || isMajor(snap[y * width + (x + 1)]))) {
            base[idx] = vHw >= vMain ? TILE_IDS.HIGHWAY : TILE_IDS.MAIN_ROAD;
          }
        } else {
          // Shave ONLY isolated 1-tile outward bumps sticking off a straight boulevard edge (never sever a road!)
          const nMaj = isMajorOrCross(snap[(y - 1) * width + x]);
          const sMaj = isMajorOrCross(snap[(y + 1) * width + x]);
          const wMaj = isMajorOrCross(snap[y * width + (x - 1)]);
          const eMaj = isMajorOrCross(snap[y * width + (x + 1)]);
          if ((nMaj && sMaj) || (wMaj && eMaj)) continue;
          if (!nMaj && sMaj && hCount <= 2 && vCount <= 3 && (wMaj || eMaj)) {
            base[idx] = TILE_IDS.SIDEWALK;
          } else if (!sMaj && nMaj && hCount <= 2 && vCount <= 3 && (wMaj || eMaj)) {
            base[idx] = TILE_IDS.SIDEWALK;
          } else if (!wMaj && eMaj && vCount <= 2 && hCount <= 3 && (nMaj || sMaj)) {
            base[idx] = TILE_IDS.SIDEWALK;
          } else if (!eMaj && wMaj && vCount <= 2 && hCount <= 3 && (nMaj || sMaj)) {
            base[idx] = TILE_IDS.SIDEWALK;
          }
        }
      }
    }
  }
}

/**
 * Grid-level path & road de-cluttering:
 *  - Converts parking-lot interior road slivers into walkable PARKING_LOT
 *  - Cleans stray off-road CROSSWALK tiles sitting in sidewalks/plazas into SIDEWALK
 *  - Straightens residential road chains into crisp orthogonalized SNES avenues
 *  - Smooths major avenue & highway edges with a 9-tile directional filter
 *  - Flattens tiny 1-tile micro-bends, fills 1-tile curb pockets, and clears detached sidewalk confetti
 */
export function simplifyGridPaths(base, width, height) {
  const isDrivable = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY;
  const isAnyRoad = (t) =>
    isDrivable(t) || t === TILE_IDS.CROSSWALK || t === TILE_IDS.HIGHWAY_MEDIAN;

  // 1. Convert ONLY dead-end parking-lot interior road slivers into PARKING_LOT
  //    (NEVER eat real through-streets or street mouths bordering a parking lot!)
  for (let pass = 0; pass < 2; pass++) {
    const snap = base.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (snap[idx] !== TILE_IDS.RESIDENTIAL_ROAD) continue;
        let parkCard = 0;
        let roadNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nt = snap[(y + dy) * width + (x + dx)];
            if ((dx === 0 || dy === 0) && nt === TILE_IDS.PARKING_LOT) parkCard++;
            if (isAnyRoad(nt)) roadNeighbors++;
          }
        }
        // Only absorb a road tile if it is surrounded on 3+ cardinal sides by parking lot
        // AND is a dead-end stub (<= 1 road neighbor), so named streets are never severed!
        if (parkCard >= 3 && roadNeighbors <= 1) {
          base[idx] = TILE_IDS.PARKING_LOT;
        }
      }
    }
  }

  // 2. Clean stray off-road CROSSWALK tiles not actually crossing a drivable road
  for (let pass = 0; pass < 2; pass++) {
    const snap = base.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (snap[idx] !== TILE_IDS.CROSSWALK) continue;
        let roadNear = 0;
        let cwCard = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const n = snap[(y + dy) * width + (x + dx)];
            if (isDrivable(n)) roadNear++;
            if ((dx === 0 || dy === 0) && n === TILE_IDS.CROSSWALK) cwCard++;
          }
        }
        if (roadNear === 0 && cwCard <= 1) {
          base[idx] = TILE_IDS.SIDEWALK;
        }
      }
    }
  }

  // 2b. Vectorize & orthogonalize wiggly residential street chains + smooth major road bands
  straightenResidentialRoadChains(base, width, height);
  straightenMajorRoadBands(base, width, height);

  // 3. Flatten short 1-tile micro-bends ("jog-out and jog-back" wiggles) along E-W and N-S roads
  //    Strictly refuses to fill Y-intersections or widen thin residential streets!
  const MAX_WIGGLE_LEN = 8;
  for (let iter = 0; iter < 2; iter++) {
    // 3a. Horizontal micro-bends along rows
    for (let y = 2; y < height - 2; y++) {
      let x = 2;
      while (x < width - 2) {
        const prev = base[y * width + (x - 1)];
        const cur = base[y * width + x];
        if (!isDrivable(prev) || cur === prev) {
          x++;
          continue;
        }
        let endX = -1;
        for (let k = 1; k <= MAX_WIGGLE_LEN && x + k < width - 1; k++) {
          const t = base[y * width + (x + k)];
          if (t === prev) {
            endX = x + k - 1;
            break;
          }
          if (isAnyRoad(t) || t === TILE_IDS.WATER || t === TILE_IDS.BUILDING_WALL) break;
        }
        if (endX >= x) {
          const spanLen = endX - x + 1;
          for (const dir of [-1, 1]) {
            let matchesShift = true;
            let hasBranch = false;
            let oppositeHasRoad = false;
            for (let sx = x; sx <= endX; sx++) {
              if (base[(y + dir) * width + sx] !== prev) {
                matchesShift = false;
                break;
              }
              if (isAnyRoad(base[(y + dir * 2) * width + sx])) hasBranch = true;
              if (isAnyRoad(base[(y - dir) * width + sx])) oppositeHasRoad = true;
            }
            if (!matchesShift) continue;

            if (prev === TILE_IDS.RESIDENTIAL_ROAD) {
              // Only straighten a residential road if it's a pure 1-tile wiggle out & back (not a Y-fork!)
              const canClearBulge =
                !hasBranch &&
                !oppositeHasRoad &&
                base[(y + dir) * width + (x - 1)] !== prev &&
                base[(y + dir) * width + (endX + 1)] !== prev;
              if (canClearBulge) {
                for (let sx = x; sx <= endX; sx++) {
                  base[y * width + sx] = prev;
                  base[(y + dir) * width + sx] = TILE_IDS.SIDEWALK;
                }
                break;
              }
            } else if (spanLen <= 4 && !oppositeHasRoad) {
              // Shallow 1-tile edge dent on a multi-lane MAIN_ROAD or HIGHWAY
              for (let sx = x; sx <= endX; sx++) {
                base[y * width + sx] = prev;
              }
              break;
            }
          }
          x = endX + 1;
        } else {
          x++;
        }
      }
    }

    // 3b. Vertical micro-bends along columns
    for (let x = 2; x < width - 2; x++) {
      let y = 2;
      while (y < height - 2) {
        const prev = base[(y - 1) * width + x];
        const cur = base[y * width + x];
        if (!isDrivable(prev) || cur === prev) {
          y++;
          continue;
        }
        let endY = -1;
        for (let k = 1; k <= MAX_WIGGLE_LEN && y + k < height - 1; k++) {
          const t = base[(y + k) * width + x];
          if (t === prev) {
            endY = y + k - 1;
            break;
          }
          if (isAnyRoad(t) || t === TILE_IDS.WATER || t === TILE_IDS.BUILDING_WALL) break;
        }
        if (endY >= y) {
          const spanLen = endY - y + 1;
          for (const dir of [-1, 1]) {
            let matchesShift = true;
            let hasBranch = false;
            let oppositeHasRoad = false;
            for (let sy = y; sy <= endY; sy++) {
              if (base[sy * width + (x + dir)] !== prev) {
                matchesShift = false;
                break;
              }
              if (isAnyRoad(base[sy * width + (x + dir * 2)])) hasBranch = true;
              if (isAnyRoad(base[sy * width + (x - dir)])) oppositeHasRoad = true;
            }
            if (!matchesShift) continue;

            if (prev === TILE_IDS.RESIDENTIAL_ROAD) {
              const canClearBulge =
                !hasBranch &&
                !oppositeHasRoad &&
                base[(y - 1) * width + (x + dir)] !== prev &&
                base[(endY + 1) * width + (x + dir)] !== prev;
              if (canClearBulge) {
                for (let sy = y; sy <= endY; sy++) {
                  base[sy * width + x] = prev;
                  base[sy * width + (x + dir)] = TILE_IDS.SIDEWALK;
                }
                break;
              }
            } else if (spanLen <= 4 && !oppositeHasRoad) {
              for (let sy = y; sy <= endY; sy++) {
                base[sy * width + x] = prev;
              }
              break;
            }
          }
          y = endY + 1;
        } else {
          y++;
        }
      }
    }
  }

  // 4. Fill 1-tile jagged sidewalk pockets trapped on 3 sides by road, and trim ONLY true 1-tile dead-end road nubs
  //    (NEVER erase connected diagonal streets!)
  for (let pass = 0; pass < 2; pass++) {
    const snap = base.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const cur = snap[idx];
        const n = snap[(y - 1) * width + x];
        const s = snap[(y + 1) * width + x];
        const w = snap[y * width + (x - 1)];
        const e = snap[y * width + (x + 1)];

        // Fill 1-tile curb pocket surrounded on 3+ cardinal sides by drivable road
        if (cur === TILE_IDS.SIDEWALK) {
          const roadNeighbors = [n, s, w, e].filter(isDrivable);
          if (roadNeighbors.length >= 3) {
            base[idx] = roadNeighbors[0];
          }
          continue;
        }

        // Trim ONLY true isolated 1-tile nubs (<= 1 total 8-way road/crosswalk neighbor)
        // OR 1-tile outward teeth sticking off a thick MAIN_ROAD/HIGHWAY edge
        if (isDrivable(cur)) {
          let cardRoads = 0;
          let total8Roads = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              if (isAnyRoad(snap[(y + dy) * width + (x + dx)])) {
                total8Roads++;
                if (dx === 0 || dy === 0) cardRoads++;
              }
            }
          }
          if (total8Roads <= 1) {
            base[idx] = TILE_IDS.SIDEWALK;
          } else if (
            (cur === TILE_IDS.MAIN_ROAD || cur === TILE_IDS.HIGHWAY) &&
            cardRoads === 1 &&
            total8Roads <= 2
          ) {
            // Shave single-tile edge tooth off a thick avenue/highway without disconnecting anything
            base[idx] = TILE_IDS.SIDEWALK;
          }
        }
      }
    }
  }

  // 5. Remove tiny detached 1-3 tile sidewalk confetti islands floating inside open grass backyards
  const visitedSw = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const startIdx = y * width + x;
      if (base[startIdx] !== TILE_IDS.SIDEWALK || visitedSw[startIdx]) continue;
      // Small BFS capped at 6 tiles: if the entire sidewalk island is <= 3 tiles and touches NO road/dirt/parking, clear to GRASS
      const comp = [startIdx];
      visitedSw[startIdx] = 1;
      let touchesNetwork = false;
      for (let q = 0; q < comp.length; q++) {
        const ci = comp[q];
        const cx = ci % width;
        const cy = (ci / width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            const ny = cy + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            const ni = ny * width + nx;
            const nt = base[ni];
            if (isAnyRoad(nt) || nt === TILE_IDS.PARKING_LOT || nt === TILE_IDS.DIRT) {
              touchesNetwork = true;
            } else if (nt === TILE_IDS.SIDEWALK && !visitedSw[ni]) {
              visitedSw[ni] = 1;
              if (comp.length < 6) comp.push(ni);
              else touchesNetwork = true;
            }
          }
        }
      }
      if (!touchesNetwork && comp.length <= 3) {
        for (const ci of comp) base[ci] = TILE_IDS.GRASS;
      }
    }
  }
}

/**
 * Simplicity-first road network connectivity & clean-intersection repair pass:
 *  1. Reconnects severed street mouths (like Jackson St meeting Boylston St) where a
 *     named streetZone continues toward a nearby road or a road tip stops just short of
 *     an avenue/highway/crosswalk, paving a crisp, walkable orthogonal SNES connector
 *     around buildings & water (never punching through genuine cul-de-sacs).
 *  2. Bridges small disconnected road islands back into the main road network, or clears
 *     tiny detached <= 8-tile road scraps into clean sidewalks/grass.
 *  3. Cleans awkward parallel highway-shoulder road slivers so side streets join major
 *     boulevards at crisp, legible T-intersections.
 */
export function repairStreetConnectivity(base, streetZones = [], width, height) {
  const isDrivable = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY;
  const isAnyRoad = (t) =>
    isDrivable(t) || t === TILE_IDS.CROSSWALK;
  const isMajor = (t) =>
    t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.HIGHWAY || t === TILE_IDS.CROSSWALK;

  // Build quick lookup: for any tile, which named residential/arterial streetZones cover it
  const zoneBuckets = new Map();
  const BUCKET = 16;
  for (const z of streetZones || []) {
    if (!z || !z.bounds || !z.name) continue;
    if (z.type !== "residential" && z.type !== "arterial") continue;
    const minCx = Math.floor(z.bounds.minX / BUCKET);
    const maxCx = Math.floor(z.bounds.maxX / BUCKET);
    const minCy = Math.floor(z.bounds.minY / BUCKET);
    const maxCy = Math.floor(z.bounds.maxY / BUCKET);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx},${cy}`;
        let list = zoneBuckets.get(key);
        if (!list) {
          list = [];
          zoneBuckets.set(key, list);
        }
        list.push(z);
      }
    }
  }

  const getRoadZoneNamesAt = (tx, ty, pad = 1) => {
    const names = new Set();
    const minCx = Math.floor((tx - pad) / BUCKET);
    const maxCx = Math.floor((tx + pad) / BUCKET);
    const minCy = Math.floor((ty - pad) / BUCKET);
    const maxCy = Math.floor((ty + pad) / BUCKET);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = zoneBuckets.get(`${cx},${cy}`);
        if (!list) continue;
        for (const z of list) {
          const b = z.bounds;
          if (tx + pad >= b.minX && tx - pad <= b.maxX && ty + pad >= b.minY && ty - pad <= b.maxY) {
            names.add(z.name);
          }
        }
      }
    }
    return names;
  };

  // Helper: check if (sx, sy) is a road endpoint (all 8-way road neighbors form <= 1 connected cluster)
  const isRoadTip = (sx, sy) => {
    const nbs = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = sx + dx;
        const ny = sy + dy;
        if (inBounds(nx, ny, width, height) && isAnyRoad(base[ny * width + nx])) {
          nbs.push({ dx, dy });
        }
      }
    }
    if (nbs.length === 0) return true;
    if (nbs.length === 1) return true;
    if (nbs.length > 2) return false;
    // 2 neighbors are only a tip if they share an edge (Manhattan dist 1: e.g. a 2-wide stub corner),
    // NEVER a 90-degree L-turn like (1,0) & (0,1) whose Manhattan dist is 2!
    return Math.abs(nbs[0].dx - nbs[1].dx) + Math.abs(nbs[0].dy - nbs[1].dy) === 1;
  };

  // Helper: local BFS along existing road tiles up to maxSteps to find already-connected nearby roads
  const markLocallyReachableRoads = (startX, startY, maxSteps = 26) => {
    const reached = new Set();
    const startKey = startY * width + startX;
    const queue = [{ idx: startKey, d: 0 }];
    reached.add(startKey);
    for (let q = 0; q < queue.length; q++) {
      const { idx, d } = queue[q];
      if (d >= maxSteps) continue;
      const cx = idx % width;
      const cy = (idx - cx) / width;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const nIdx = ny * width + nx;
          if (reached.has(nIdx)) continue;
          if (isAnyRoad(base[nIdx])) {
            reached.add(nIdx);
            queue.push({ idx: nIdx, d: d + 1 });
          }
        }
      }
    }
    return reached;
  };

  // Helper: find a crisp 4-way orthogonal bridge path from (sx, sy) to (gx, gy) avoiding buildings & water!
  const findCleanBridgePath = (sx, sy, gx, gy, maxCost = 18) => {
    const pad = 4;
    const minX = Math.max(1, Math.min(sx, gx) - pad);
    const maxX = Math.min(width - 2, Math.max(sx, gx) + pad);
    const minY = Math.max(1, Math.min(sy, gy) - pad);
    const maxY = Math.min(height - 2, Math.max(sy, gy) + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;

    const toLocal = (x, y) => (y - minY) * w + (x - minX);
    const dist = new Float32Array(w * h).fill(1e9);
    const prev = new Int32Array(w * h).fill(-1);
    const prevDir = new Int8Array(w * h).fill(-1);
    const open = [];

    const startL = toLocal(sx, sy);
    const goalL = toLocal(gx, gy);
    dist[startL] = 0;
    open.push({ l: startL, f: Math.abs(gx - sx) + Math.abs(gy - sy) });

    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    while (open.length > 0) {
      let bestI = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestI].f) bestI = i;
      }
      const cur = open.splice(bestI, 1)[0];
      if (cur.l === goalL) break;
      if (dist[cur.l] > maxCost) continue;

      const lx = cur.l % w;
      const ly = (cur.l - lx) / w;
      const cx = lx + minX;
      const cy = ly + minY;

      for (let d = 0; d < 4; d++) {
        const nx = cx + dirs[d][0];
        const ny = cy + dirs[d][1];
        if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
        const t = base[ny * width + nx];
        const isGoal = nx === gx && ny === gy;
        // Never punch through buildings, water, or highway median barriers!
        if (!isGoal && (t === TILE_IDS.BUILDING_WALL || t === TILE_IDS.WATER || t === TILE_IDS.HIGHWAY_MEDIAN)) {
          continue;
        }
        // Keep bridge tiles at least 1 tile clear of BUILDING_WALL when possible so sidewalks stay clean
        let nearWallPenalty = 0;
        if (!isGoal) {
          for (const [wx, wy] of dirs) {
            if (inBounds(nx + wx, ny + wy, width, height) && base[(ny + wy) * width + (nx + wx)] === TILE_IDS.BUILDING_WALL) {
              nearWallPenalty += 1.6;
            }
          }
        }
        // Small turn penalty favors crisp, straight 90-degree SNES streets!
        const turnPenalty = prevDir[cur.l] !== -1 && prevDir[cur.l] !== d ? 0.45 : 0;
        const baseStep =
          t === TILE_IDS.SIDEWALK || t === TILE_IDS.PARKING_LOT || isAnyRoad(t)
            ? 1.0
            : t === TILE_IDS.GRASS || t === TILE_IDS.DIRT || t === TILE_IDS.PARK
              ? 1.25
              : 1.8;
        const nextCost = dist[cur.l] + baseStep + turnPenalty + nearWallPenalty;
        const nl = toLocal(nx, ny);
        if (nextCost < dist[nl]) {
          dist[nl] = nextCost;
          prev[nl] = cur.l;
          prevDir[nl] = d;
          open.push({ l: nl, f: nextCost + Math.abs(gx - nx) + Math.abs(gy - ny) });
        }
      }
    }

    if (prev[goalL] === -1) return null;
    const path = [];
    let cur = goalL;
    while (cur !== -1) {
      const lx = cur % w;
      const ly = (cur - lx) / w;
      path.push({ x: lx + minX, y: ly + minY });
      cur = prev[cur];
    }
    path.reverse();
    return path;
  };

  // --- Pass 1: Reconnect severed street mouths (where a named streetZone continues to a nearby road,
  //             or a road tip stops <= 4 tiles short of a major avenue/highway/crosswalk) ---
  const tips = [];
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (base[y * width + x] !== TILE_IDS.RESIDENTIAL_ROAD) continue;
      if (isRoadTip(x, y)) tips.push({ x, y });
    }
  }

  for (const tip of tips) {
    if (base[tip.y * width + tip.x] !== TILE_IDS.RESIDENTIAL_ROAD) continue;
    if (!isRoadTip(tip.x, tip.y)) continue;

    const tipZones = getRoadZoneNamesAt(tip.x, tip.y, 1);
    const localReach = markLocallyReachableRoads(tip.x, tip.y, 26);

    let bestTarget = null;
    const maxRadius = tipZones.size > 0 ? 10 : 4;

    for (let r = 2; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = tip.x + dx;
          const ny = tip.y + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const nIdx = ny * width + nx;
          const nt = base[nIdx];
          if (!isAnyRoad(nt)) continue;
          if (localReach.has(nIdx)) continue;

          // Decide if this target is a legitimate street-mouth reconnection:
          //  a) Within 4 tiles of a major road/highway/crosswalk, OR
          //  b) Same named streetZone covers the target (proving the street was severed, like Jackson St -> Boylston St!)
          const targetZones = getRoadZoneNamesAt(nx, ny, 2);
          let sharesStreetZone = false;
          for (const zn of tipZones) {
            if (targetZones.has(zn)) {
              sharesStreetZone = true;
              break;
            }
          }
          const isShortMajorGap = r <= 4 && isMajor(nt);
          if (!sharesStreetZone && !isShortMajorGap) continue;

          const score = r + (isMajor(nt) ? 0 : 0.6) + (Math.min(Math.abs(dx), Math.abs(dy)) * 0.25);
          if (!bestTarget || score < bestTarget.score) {
            bestTarget = { x: nx, y: ny, r, score };
          }
        }
      }
      if (bestTarget) break;
    }

    if (!bestTarget) continue;
    const bridge = findCleanBridgePath(tip.x, tip.y, bestTarget.x, bestTarget.y, bestTarget.r * 2.2 + 4);
    if (!bridge || bridge.length < 2) continue;

    for (const pt of bridge) {
      const idx = pt.y * width + pt.x;
      const cur = base[idx];
      if (!isAnyRoad(cur) && cur !== TILE_IDS.WATER && cur !== TILE_IDS.BUILDING_WALL && cur !== TILE_IDS.HIGHWAY_MEDIAN) {
        base[idx] = TILE_IDS.RESIDENTIAL_ROAD;
      }
    }
  }

  // --- Pass 2: Reconnect small disconnected road islands (<= 140 tiles) to the main road network,
  //             or clean up tiny detached <= 8-tile road scraps into sidewalks/grass ---
  const compId = new Int32Array(width * height).fill(-1);
  const comps = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = y * width + x;
      if (!isAnyRoad(base[startIdx]) || compId[startIdx] !== -1) continue;
      const id = comps.length;
      const tiles = [startIdx];
      compId[startIdx] = id;
      let touchesBorder = false;
      for (let q = 0; q < tiles.length; q++) {
        const ci = tiles[q];
        const cx = ci % width;
        const cy = (ci - cx) / width;
        if (cx <= 1 || cy <= 1 || cx >= width - 2 || cy >= height - 2) touchesBorder = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            const ni = ny * width + nx;
            if (isAnyRoad(base[ni]) && compId[ni] === -1) {
              compId[ni] = id;
              tiles.push(ni);
            }
          }
        }
      }
      comps.push({ id, tiles, touchesBorder });
    }
  }

  let mainCompId = -1;
  let mainCompSize = 0;
  for (const c of comps) {
    if (c.tiles.length > mainCompSize) {
      mainCompSize = c.tiles.length;
      mainCompId = c.id;
    }
  }

  for (const c of comps) {
    if (c.id === mainCompId || c.touchesBorder) continue;
    // Try to bridge to the main road network if within 9 tiles
    let bestPair = null;
    for (const ti of c.tiles) {
      const tx = ti % width;
      const ty = (ti - tx) / width;
      for (let r = 2; r <= 9; r++) {
        if (bestPair && r >= bestPair.r) break;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const nx = tx + dx;
            const ny = ty + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            if (compId[ny * width + nx] === mainCompId) {
              bestPair = { sx: tx, sy: ty, gx: nx, gy: ny, r };
              break;
            }
          }
          if (bestPair && bestPair.r <= r) break;
        }
      }
    }

    let bridged = false;
    if (bestPair) {
      const bridge = findCleanBridgePath(bestPair.sx, bestPair.sy, bestPair.gx, bestPair.gy, bestPair.r * 2.2 + 4);
      if (bridge && bridge.length >= 2) {
        for (const pt of bridge) {
          const idx = pt.y * width + pt.x;
          const cur = base[idx];
          if (!isAnyRoad(cur) && cur !== TILE_IDS.WATER && cur !== TILE_IDS.BUILDING_WALL && cur !== TILE_IDS.HIGHWAY_MEDIAN) {
            base[idx] = TILE_IDS.RESIDENTIAL_ROAD;
          }
        }
        bridged = true;
      }
    }

    // If it's a tiny isolated <= 8-tile road scrap that cannot connect anywhere, clean it to SIDEWALK!
    if (!bridged && c.tiles.length <= 8) {
      for (const ti of c.tiles) {
        if (base[ti] === TILE_IDS.RESIDENTIAL_ROAD || base[ti] === TILE_IDS.CROSSWALK) {
          base[ti] = TILE_IDS.SIDEWALK;
        }
      }
    }
  }

  // --- Pass 3: Clean stray parallel residential slip-lane slivers glued directly along highway shoulders ---
  //     (e.g. messy 1-tile `rr` scraps hugging Route 9 that don't actually connect to any incoming street!)
  const snap = base.slice();
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const idx = y * width + x;
      if (snap[idx] !== TILE_IDS.RESIDENTIAL_ROAD) continue;
      const n = snap[(y - 1) * width + x];
      const s = snap[(y + 1) * width + x];
      const w = snap[y * width + (x - 1)];
      const e = snap[y * width + (x + 1)];
      const touchesHwNS = n === TILE_IDS.HIGHWAY || s === TILE_IDS.HIGHWAY;
      const touchesHwEW = w === TILE_IDS.HIGHWAY || e === TILE_IDS.HIGHWAY;
      if (touchesHwNS) {
        // Only keep a RESIDENTIAL_ROAD tile glued to an E-W highway if a road feeds into it from the OTHER side (N or S)!
        const opp = n === TILE_IDS.HIGHWAY ? s : n;
        if (opp !== TILE_IDS.RESIDENTIAL_ROAD && opp !== TILE_IDS.MAIN_ROAD && opp !== TILE_IDS.CROSSWALK) {
          base[idx] = TILE_IDS.SIDEWALK;
        }
      } else if (touchesHwEW) {
        const opp = w === TILE_IDS.HIGHWAY ? e : w;
        if (opp !== TILE_IDS.RESIDENTIAL_ROAD && opp !== TILE_IDS.MAIN_ROAD && opp !== TILE_IDS.CROSSWALK) {
          base[idx] = TILE_IDS.SIDEWALK;
        }
      }
    }
  }
}

/**
 * Eliminate diagonal-only road pinches across the entire map so diagonal streets
 * are cleanly 4-way continuous (never breaking into jagged diagonal steps or
 * disconnected 4-way road components) while strictly respecting water, buildings,
 * and divided highway median barriers.
 */
export function eliminateDiagonalRoadPinches(base, width, height) {
  const isDrivable = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY;
  const isRoadOrCross = (t) => isDrivable(t) || t === TILE_IDS.CROSSWALK;
  const isFillable = (t) =>
    t === TILE_IDS.SIDEWALK ||
    t === TILE_IDS.GRASS ||
    t === TILE_IDS.PARKING_LOT ||
    t === TILE_IDS.PARK ||
    t === TILE_IDS.DIRT ||
    t === TILE_IDS.TALL_GRASS ||
    t === TILE_IDS.SAND;

  const roadRank = (t) =>
    t === TILE_IDS.HIGHWAY ? 3 : t === TILE_IDS.MAIN_ROAD ? 2 : t === TILE_IDS.RESIDENTIAL_ROAD ? 1 : 0;

  const scoreCorner = (snap, x, y) => {
    const t = snap[y * width + x];
    if (!isFillable(t)) return -1e9;
    let score = t === TILE_IDS.SIDEWALK ? 4 : t === TILE_IDS.GRASS ? 2 : 1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      const nt = snap[ny * width + nx];
      if (isRoadOrCross(nt)) score += 3;
      if (nt === TILE_IDS.BUILDING_WALL || nt === TILE_IDS.WATER || nt === TILE_IDS.HIGHWAY_MEDIAN) {
        score -= 10;
      }
    }
    return score;
  };

  for (let pass = 0; pass < 2; pass++) {
    const snap = base.slice();
    for (let y = 1; y < height - 2; y++) {
      for (let x = 1; x < width - 2; x++) {
        const tl = snap[y * width + x];
        const tr = snap[y * width + (x + 1)];
        const bl = snap[(y + 1) * width + x];
        const br = snap[(y + 1) * width + (x + 1)];

        // Case A: TL and BR are roads, TR and BL are NOT roads (diagonal pinch!)
        if (isRoadOrCross(tl) && isRoadOrCross(br) && !isRoadOrCross(tr) && !isRoadOrCross(bl)) {
          const sTR = scoreCorner(snap, x + 1, y);
          const sBL = scoreCorner(snap, x, y + 1);
          if (Math.max(sTR, sBL) > -1e8) {
            const fillTile =
              roadRank(tl) >= roadRank(br)
                ? (isDrivable(tl) ? tl : TILE_IDS.RESIDENTIAL_ROAD)
                : (isDrivable(br) ? br : TILE_IDS.RESIDENTIAL_ROAD);
            if (sTR >= sBL) base[y * width + (x + 1)] = fillTile;
            else base[(y + 1) * width + x] = fillTile;
          }
        }
        // Case B: TR and BL are roads, TL and BR are NOT roads (diagonal pinch!)
        if (isRoadOrCross(tr) && isRoadOrCross(bl) && !isRoadOrCross(tl) && !isRoadOrCross(br)) {
          const sTL = scoreCorner(snap, x, y);
          const sBR = scoreCorner(snap, x + 1, y + 1);
          if (Math.max(sTL, sBR) > -1e8) {
            const fillTile =
              roadRank(tr) >= roadRank(bl)
                ? (isDrivable(tr) ? tr : TILE_IDS.RESIDENTIAL_ROAD)
                : (isDrivable(bl) ? bl : TILE_IDS.RESIDENTIAL_ROAD);
            if (sTL >= sBR) base[y * width + x] = fillTile;
            else base[(y + 1) * width + (x + 1)] = fillTile;
          }
        }
      }
    }
  }

  // Final micro-pass: clear tiny 1-3 tile detached road crumbs not touching any other road
  const vis = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const si = y * width + x;
      if (!isRoadOrCross(base[si]) || vis[si]) continue;
      const comp = [si];
      vis[si] = 1;
      let touchesEdge = false;
      for (let q = 0; q < comp.length; q++) {
        const ci = comp[q];
        const cx = ci % width;
        const cy = (ci - cx) / width;
        if (cx <= 1 || cy <= 1 || cx >= width - 2 || cy >= height - 2) touchesEdge = true;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            const ni = ny * width + nx;
            if (isRoadOrCross(base[ni]) && !vis[ni]) {
              vis[ni] = 1;
              comp.push(ni);
            }
          }
        }
      }
      if (!touchesEdge && comp.length <= 3) {
        for (const ci of comp) base[ci] = TILE_IDS.SIDEWALK;
      }
    }
  }
}

/**
 * De-bloat oversized multi-tile crosswalk swamps across the entire map back into crisp,
 * legible 1-to-2-tile pedestrian zebra crossings while restoring surrounding asphalt
 * (HIGHWAY, MAIN_ROAD, or RESIDENTIAL_ROAD) and removing truly detached off-road crosswalk clusters.
 */
export function normalizeCrosswalkBlobs(base, width, height) {
  const isDrivable = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY;

  // Find every 4-way connected CROSSWALK component (so interior tiles of a wide crossing are NEVER treated as stray!)
  const visited = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = y * width + x;
      if (base[startIdx] !== TILE_IDS.CROSSWALK || visited[startIdx]) continue;
      const comp = [startIdx];
      visited[startIdx] = 1;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      let sumX = 0;
      let sumY = 0;
      let hwNear = 0;
      let mainNear = 0;
      let resNear = 0;
      let ewContacts = 0;
      let nsContacts = 0;

      for (let q = 0; q < comp.length; q++) {
        const ci = comp[q];
        const cx = ci % width;
        const cy = (ci - cx) / width;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        sumX += cx;
        sumY += cy;

        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const ni = ny * width + nx;
          const nt = base[ni];
          if (nt === TILE_IDS.CROSSWALK && !visited[ni]) {
            visited[ni] = 1;
            comp.push(ni);
          } else if (isDrivable(nt)) {
            if (nt === TILE_IDS.HIGHWAY) hwNear++;
            else if (nt === TILE_IDS.MAIN_ROAD) mainNear++;
            else resNear++;
            if (dx !== 0) ewContacts++;
            else nsContacts++;
          }
        }
      }

      const totalDrivableContacts = hwNear + mainNear + resNear;
      if (totalDrivableContacts === 0) {
        // Truly detached off-road crosswalk sitting on a sidewalk/plaza -> clean SIDEWALK!
        for (const ci of comp) base[ci] = TILE_IDS.SIDEWALK;
        continue;
      }

      const spanX = maxX - minX + 1;
      const spanY = maxY - minY + 1;
      if (comp.length < 8 && !(spanX >= 3 && spanY >= 3)) continue;

      const roadTile =
        hwNear >= 2
          ? TILE_IDS.HIGHWAY
          : mainNear >= 2 || (mainNear >= 1 && resNear === 0)
            ? TILE_IDS.MAIN_ROAD
            : TILE_IDS.RESIDENTIAL_ROAD;

      const midX = Math.round(sumX / comp.length);
      const midY = Math.round(sumY / comp.length);
      const isEwTraffic = ewContacts >= nsContacts;
      const perpSpan = isEwTraffic ? spanY : spanX;
      const bandWidth = roadTile === TILE_IDS.HIGHWAY && perpSpan <= 5 ? 2 : 1;

      const keepSet = new Set();
      if (isEwTraffic) {
        for (const ci of comp) {
          const cx = ci % width;
          const cy = (ci / width) | 0;
          if (cx >= midX && cx < midX + bandWidth && Math.abs(cy - midY) <= 3) keepSet.add(ci);
        }
      } else {
        for (const ci of comp) {
          const cx = ci % width;
          const cy = (ci / width) | 0;
          if (cy >= midY && cy < midY + bandWidth && Math.abs(cx - midX) <= 3) keepSet.add(ci);
        }
      }

      // Guarantee at least one crossing stripe remains if the cluster is concave
      if (keepSet.size === 0) {
        const bestX = comp[0] % width;
        const bestY = (comp[0] / width) | 0;
        for (const ci of comp) {
          if (isEwTraffic ? (ci % width) === bestX : ((ci / width) | 0) === bestY) {
            keepSet.add(ci);
          }
        }
      }

      for (const ci of comp) {
        if (!keepSet.has(ci)) {
          base[ci] = roadTile;
        }
      }
    }
  }
}

/**
 * Authoritative road-first layout for Newton Centre proper (Centre St, Cypress St,
 * Beacon St, Langley Rd, Sumner St, Willow St, Crescent Ave, Union St, Braeland Ave,
 * Herrick Rd, Chase St, Paul St, Pelham St, Pleasant St, Lyman St, Centre Green,
 * Ripley Ter, Beacon Pl, Chesley Rd, Warren St, Ripley St, Trowbridge St, Glazer Rd).
 *
 * Strictly prioritizes real-world OpenStreetMap road geometry & crisp intersection
 * crosswalks over buildings, parking lots, sidewalks, parks, and bloated crosswalk blobs,
 * guaranteeing clean, unbroken street corridors (including the Centre St / Cypress St
 * Y-junction and Newton Centre Square) that stitch seamlessly to surrounding streets.
 * Idempotent: running multiple times produces the exact same road layout.
 */
export function prioritizeNewtonCentreRoads(base, width, height) {
  if (width !== 512 || height !== 512) return;

  const X0 = 216;
  const X1 = 312;
  const Y0 = 201;
  const Y1 = 285;

  // 1. Wipe old tangled roads, bloated crosswalk swamps, and stale sidewalks inside Newton Centre core
  for (let y = Y0; y <= Y1; y++) {
    const rowOff = y * width;
    for (let x = X0; x <= X1; x++) {
      const t = base[rowOff + x];
      if (
        t === TILE_IDS.MAIN_ROAD ||
        t === TILE_IDS.RESIDENTIAL_ROAD ||
        t === TILE_IDS.CROSSWALK ||
        t === TILE_IDS.SIDEWALK
      ) {
        base[rowOff + x] = TILE_IDS.GRASS;
      }
    }
  }

  // Road-priority rasterizer: roads ALWAYS overwrite buildings, parking lots, parks, and grass!
  const paintRoadPolyline = (pts, tileId, thickness = 1) => {
    const stamp = (px, py) => {
      if (thickness === 2) {
        for (let oy = 0; oy <= 1; oy++) {
          for (let ox = 0; ox <= 1; ox++) {
            const nx = px + ox;
            const ny = py + oy;
            if (!inBounds(nx, ny, width, height)) continue;
            const idx = ny * width + nx;
            if (tileId === TILE_IDS.MAIN_ROAD || base[idx] !== TILE_IDS.MAIN_ROAD) {
              base[idx] = tileId;
            }
          }
        }
      } else {
        if (!inBounds(px, py, width, height)) return;
        const idx = py * width + px;
        if (tileId === TILE_IDS.MAIN_ROAD || base[idx] !== TILE_IDS.MAIN_ROAD) {
          base[idx] = tileId;
        }
      }
    };

    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      let cx = x0;
      let cy = y0;
      const dx = Math.abs(x1 - x0);
      const dy = Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx - dy;

      while (true) {
        stamp(cx, cy);
        if (cx === x1 && cy === y1) break;
        const prevX = cx;
        const prevY = cy;
        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          cx += sx;
        }
        if (e2 < dx) {
          err += dx;
          cy += sy;
        }
        // Keep 1-tile streets cleanly 4-connected on diagonal steps
        if (thickness === 1 && cx !== prevX && cy !== prevY) {
          stamp(cx, prevY);
        }
      }
    }
  };

  // 2. Village & residential streets (exact OSM geometry, stitched cleanly to outer streets)
  const residentialStreets = [
    // Pelham Street (west from Centre St, cleanly NORTH of Pelham Street Lot)
    [[249, 219], [241, 220], [232, 221], [222, 222], [215, 222], [212, 222]],
    // Pleasant Street (west from Centre St)
    [[251, 210], [240, 209], [230, 210], [218, 212], [211, 213]],
    // Lyman Street (east from Centre St to Sumner St)
    [[253, 200], [259, 202], [269, 204], [279, 207], [284, 207]],
    // Centre Green (north-south connecting Lyman St down to Langley Rd)
    [[259, 202], [258, 204], [257, 209], [257, 212], [255, 219]],
    // Beacon Place (short lane west off Centre St)
    [[247, 233], [242, 233], [238, 232]],
    // Herrick Road (SE from Beacon St, then S past Union, Braeland, Chase, stitching cleanly to Herrick Cir)
    [[254, 238], [257, 242], [261, 246], [265, 249], [266, 258], [267, 263], [268, 271], [271, 280], [275, 285], [277, 287]],
    [[275, 285], [273, 286], [272, 287]],
    // Union Street (ENE from Herrick Rd across Langley Rd to Beacon St)
    [[265, 249], [268, 251], [272, 250], [280, 246], [288, 242], [293, 239], [295, 235], [300, 231], [304, 228]],
    // Braeland Avenue (ENE from Cypress St across Herrick Rd to Langley Rd)
    [[252, 273], [260, 268], [267, 263], [274, 258], [285, 252], [295, 247], [301, 244]],
    // Chase Street (NE from Herrick Rd to Langley Rd)
    [[271, 280], [278, 274], [284, 270], [293, 262], [303, 253], [307, 248]],
    // Paul Street (SW from Cypress St toward Centre St)
    [[255, 280], [252, 281], [245, 286], [238, 291], [231, 296]],
    // Ripley Terrace (NW from Centre St)
    [[239, 258], [233, 254], [228, 250], [226, 249]],
    // Chesley Road (N from Beacon St)
    [[301, 228], [301, 220], [302, 212], [304, 201], [305, 199]],
    // Warren Street (E from Langley Rd)
    [[307, 248], [312, 248], [320, 249]],
    // Ripley Street (SE from Chase St)
    [[283, 271], [288, 274], [297, 282], [303, 287]],
    // Trowbridge Street (NW from Centre St)
    [[221, 282], [211, 275]],
    // Glazer Road (SW from Langley Rd)
    [[316, 263], [313, 266], [310, 269], [309, 269]],
  ];
  for (const pts of residentialStreets) {
    paintRoadPolyline(pts, TILE_IDS.RESIDENTIAL_ROAD, 1);
  }

  // 3. Major Newton Centre arterials (bold 2-tile-wide avenues — highest priority!)
  const mainAvenues = [
    // Centre Street (continuous N-S-SW spine through Newton Centre Square & Centre/Cypress fork)
    [[254, 199], [253, 200], [251, 210], [249, 218], [248, 231], [247, 239], [246, 246], [244, 249], [242, 252], [241, 254], [239, 258], [235, 263], [231, 269], [226, 276], [221, 282], [215, 290]],
    // Cypress Street (forks cleanly SSE from Centre St at (246,246) past Braeland & Paul)
    [[246, 246], [245, 249], [245, 253], [246, 259], [248, 264], [250, 268], [251, 272], [252, 273], [255, 280], [257, 284], [259, 289]],
    // Beacon Street (continuous W-E avenue across Centre St, Herrick, Langley/Sumner, Union)
    [[211, 233], [221, 235], [232, 238], [240, 239], [247, 239], [254, 238], [263, 236], [274, 234], [282, 232], [294, 230], [304, 228], [316, 225]],
    // Langley Road (NW-SE village avenue from Centre St past J.P. Licks, Union, Braeland, Chase)
    [[249, 218], [255, 219], [262, 223], [275, 229], [282, 232], [290, 237], [293, 239], [301, 244], [307, 248], [312, 255], [318, 263]],
    // Sumner Street (N from Beacon & Langley / J.P. Licks to Lyman & Willow)
    [[282, 232], [281, 229], [281, 225], [284, 212], [284, 207], [286, 203], [289, 192]],
    // Willow Street (NW from Sumner & Lyman)
    [[284, 207], [283, 205], [279, 200], [275, 194]],
    // Crescent Avenue (NW from Centre St at (231,269))
    [[231, 269], [221, 262], [215, 258], [208, 253]],
  ];
  for (const pts of mainAvenues) {
    paintRoadPolyline(pts, TILE_IDS.MAIN_ROAD, 2);
  }

  // 4. Crisp 1-tile village triangle connectors (keeps Newton Centre's real triangles legible!)
  const villageLinks = [
    // Centre <-> Cypress cross-connector just south of the fork
    [[241, 254], [245, 253]],
    // Centre/Cypress <-> Beacon/Herrick slip lane (frames South Newton Centre Green)
    [[246, 248], [249, 243], [254, 238]],
    // Langley <-> Beacon connector (frames east side of Langley Lot)
    [[275, 229], [274, 234]],
    // Langley <-> Sumner connector (right north of J.P. Licks)
    [[275, 229], [281, 229]],
  ];
  for (const pts of villageLinks) {
    paintRoadPolyline(pts, TILE_IDS.MAIN_ROAD, 1);
  }

  // 5. Clear isolated 1-tile parking-lot crumbs trapped along newly prioritized street edges
  const lotSnap = base.slice();
  for (let y = Y0; y <= Y1; y++) {
    for (let x = X0; x <= X1; x++) {
      const idx = y * width + x;
      if (lotSnap[idx] !== TILE_IDS.PARKING_LOT) continue;
      let lotCard = 0;
      if (lotSnap[(y - 1) * width + x] === TILE_IDS.PARKING_LOT) lotCard++;
      if (lotSnap[(y + 1) * width + x] === TILE_IDS.PARKING_LOT) lotCard++;
      if (lotSnap[y * width + (x - 1)] === TILE_IDS.PARKING_LOT) lotCard++;
      if (lotSnap[y * width + (x + 1)] === TILE_IDS.PARKING_LOT) lotCard++;
      if (lotCard === 0) base[idx] = TILE_IDS.GRASS;
    }
  }

  // 6. Crisp, clean pedestrian crosswalks ONLY at major Newton Centre intersections (spanning full carriageway width!)
  const crosswalkTiles = [
    // Centre St & Beacon St (all 4 legs)
    [247, 237], [248, 237],
    [246, 241], [247, 241],
    [244, 239], [244, 240],
    [250, 239], [250, 240],
    // Centre St & Cypress St / Rosenfeld's Bagels
    [245, 248], [246, 248], [247, 248],
    [240, 257], [241, 257],
    [245, 256], [246, 256],
    // Centre St & Langley Rd / Pelham St
    [250, 216], [251, 216],
    [253, 218], [253, 219],
    [247, 219],
    // Centre St & Pleasant St
    [251, 208], [252, 208], [253, 208],
    // Beacon St & Herrick Rd
    [256, 237], [256, 238],
    // Beacon St & Langley Rd & Sumner St (J.P. Licks)
    [278, 233], [278, 234],
    [286, 231], [286, 232],
    [281, 227], [282, 227],
    [286, 235], [287, 235],
    // Langley Rd & Union St
    [291, 238], [292, 238],
    // Beacon St & Union St / Chesley Rd
    [299, 229], [299, 230],
    // Langley Rd & Braeland Ave
    [299, 243], [300, 243],
    // Langley Rd & Chase St / Warren St
    [305, 247], [306, 247],
    // Centre St & Crescent Ave
    [233, 266], [234, 266], [235, 266],
    [228, 267], [229, 267],
    // Cypress St & Braeland Ave
    [250, 271], [251, 271], [252, 271],
    [254, 272],
    // Cypress St & Paul St
    [254, 278], [255, 278],
    // Sumner St & Lyman St / Willow St
    [284, 209], [285, 209],
    [281, 207],
  ];
  for (const [cx, cy] of crosswalkTiles) {
    if (!inBounds(cx, cy, width, height)) continue;
    const idx = cy * width + cx;
    if (base[idx] === TILE_IDS.MAIN_ROAD || base[idx] === TILE_IDS.RESIDENTIAL_ROAD) {
      base[idx] = TILE_IDS.CROSSWALK;
    }
  }
}

/**
 * Slim bloated multi-tile sidewalk slabs down to crisp 1-tile sidewalks framing every road
 * (plus neat 1-tile standalone footpaths) so roads stand out boldly instead of getting
 * swallowed by 3-to-6 tile wide concrete aprons!
 */
export function slimOversizedSidewalks(base, width, height, protectedTiles = []) {
  const isRoad = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.CROSSWALK;

  const protectedSet = new Set();
  for (const pt of protectedTiles) {
    if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number") continue;
    const r = pt.radius ?? 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.floor(pt.x) + dx;
        const py = Math.floor(pt.y) + dy;
        if (inBounds(px, py, width, height)) protectedSet.add(py * width + px);
      }
    }
  }

  // Mark every sidewalk tile that directly borders a road/crosswalk (8-way -> essential continuous road sidewalk!)
  const roadAdjSw = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (base[idx] !== TILE_IDS.SIDEWALK) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (inBounds(nx, ny, width, height) && isRoad(base[ny * width + nx])) {
            roadAdjSw[idx] = 1;
            break;
          }
        }
        if (roadAdjSw[idx]) break;
      }
    }
  }

  // Pick natural replacement ground (PARK if next to park/tall_grass, else GRASS)
  const naturalReplacement = (snap, x, y) => {
    let parkHits = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        const t = snap[ny * width + nx];
        if (t === TILE_IDS.PARK || t === TILE_IDS.TALL_GRASS) parkHits++;
      }
    }
    return parkHits >= 2 ? TILE_IDS.PARK : TILE_IDS.GRASS;
  };

  // Pass 1: Trim redundant 2nd/3rd-row outer sidewalk aprons bulging off road-adjacent sidewalks
  //         AND thin fat 2x2+ non-road sidewalk slabs down to neat 1-tile footpaths!
  for (let pass = 0; pass < 3; pass++) {
    const snap = base.slice();
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (snap[idx] !== TILE_IDS.SIDEWALK) continue;
        if (roadAdjSw[idx] === 1 || protectedSet.has(idx)) continue;

        // Check if this outer sidewalk tile is just a 2nd-row apron glued onto a road-adjacent sidewalk
        let cardRoadAdjSw = 0;
        let touchesParkingOrDirt = false;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const ni = (y + dy) * width + (x + dx);
          if (roadAdjSw[ni] === 1) cardRoadAdjSw++;
          if (snap[ni] === TILE_IDS.PARKING_LOT || snap[ni] === TILE_IDS.DIRT) {
            touchesParkingOrDirt = true;
          }
        }
        if (cardRoadAdjSw >= 1 && !touchesParkingOrDirt) {
          // Only keep if it's the narrow 1-tile entrance of a standalone footpath extending away from the road
          let cardNonRoadSw = 0;
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
            const ni = (y + dy) * width + (x + dx);
            if (snap[ni] === TILE_IDS.SIDEWALK && roadAdjSw[ni] === 0) cardNonRoadSw++;
          }
          if (cardNonRoadSw !== 1) {
            base[idx] = naturalReplacement(snap, x, y);
            continue;
          }
        }

        // Check if this non-road sidewalk tile is part of a fat 2x2+ solid sidewalk slab -> thin from edges!
        const isSw = (ax, ay) => snap[ay * width + ax] === TILE_IDS.SIDEWALK;
        const in2x2 =
          (isSw(x - 1, y) && isSw(x, y - 1) && isSw(x - 1, y - 1)) ||
          (isSw(x + 1, y) && isSw(x, y - 1) && isSw(x + 1, y - 1)) ||
          (isSw(x - 1, y) && isSw(x, y + 1) && isSw(x - 1, y + 1)) ||
          (isSw(x + 1, y) && isSw(x, y + 1) && isSw(x + 1, y + 1));
        if (in2x2) {
          // Peel outer edge tiles of fat sidewalk slabs (preserving thin 1-tile footpaths)
          const nonSwCard =
            (isSw(x, y - 1) ? 0 : 1) +
            (isSw(x, y + 1) ? 0 : 1) +
            (isSw(x - 1, y) ? 0 : 1) +
            (isSw(x + 1, y) ? 0 : 1);
          if (nonSwCard >= 1) {
            base[idx] = naturalReplacement(snap, x, y);
          }
        }
      }
    }
  }
}

/**
 * Expand undersized OSM building footprints cleanly into their own empty GRASS yards
 * up to classic 16-bit SNES RPG proportions (e.g. 4x3 to 5x4 for houses) so neighborhoods
 * feel rich and substantial instead of tiny boxes floating in empty green grids.
 * Strictly preserves:
 *  - 1-house-per-address separation (minimum 1-tile grass gap between distinct buildings)
 *  - Continuous unobstructed sidewalks (never encroaches on sidewalks, roads, parks, water, or landmarks)
 *  - Deterministic idempotency (running twice yields the exact same footprints!)
 */
export function enlargeBuildingFootprints(buildings, base, width, height, protectedTiles = []) {
  if (!Array.isArray(buildings) || buildings.length === 0) return buildings;

  const isRoadOrCross = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.CROSSWALK;

  const protectedSet = new Set();
  for (const pt of protectedTiles) {
    if (!pt || typeof pt.x !== "number" || typeof pt.y !== "number") continue;
    const r = pt.radius ?? 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = Math.floor(pt.x) + dx;
        const py = Math.floor(pt.y) + dy;
        if (inBounds(px, py, width, height)) protectedSet.add(py * width + px);
      }
    }
  }

  // Clone bounds and tag current BUILDING_WALL ownership per building index
  const nextBuildings = buildings.map((b) => ({
    ...b,
    bounds: b.bounds ? { ...b.bounds } : null,
  }));

  const ownerGrid = new Int32Array(width * height).fill(-1);
  for (let i = 0; i < nextBuildings.length; i++) {
    const b = nextBuildings[i];
    if (!b.bounds) continue;
    const { minX, minY, maxX, maxY } = b.bounds;
    for (let y = minY; y <= maxY; y++) {
      const off = y * width;
      for (let x = minX; x <= maxX; x++) {
        if (!inBounds(x, y, width, height)) continue;
        if (base[off + x] === TILE_IDS.BUILDING_WALL && ownerGrid[off + x] === -1) {
          ownerGrid[off + x] = i;
        }
      }
    }
  }

  const canClaimGrassTile = (tx, ty, bIdx) => {
    if (!inBounds(tx, ty, width, height)) return false;
    const idx = ty * width + tx;
    const cur = base[idx];
    // Allow claiming empty GRASS or unused residential outer SIDEWALK apron tiles (NEVER road-adjacent sidewalks
    // or 2-tile-wide major avenue/highway promenades!)
    if (cur !== TILE_IDS.GRASS && cur !== TILE_IDS.SIDEWALK) return false;
    if (protectedSet.has(idx)) return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        const nIdx = ny * width + nx;
        const nTile = base[nIdx];
        if (isRoadOrCross(nTile)) return false;
        if (cur === TILE_IDS.SIDEWALK && (nTile === TILE_IDS.PARKING_LOT || nTile === TILE_IDS.DIRT || nTile === TILE_IDS.PARK)) {
          return false;
        }
        if ((dx === 0 || dy === 0) && nTile === TILE_IDS.BUILDING_WALL && ownerGrid[nIdx] !== bIdx) {
          return false;
        }
      }
    }
    // Keep generous 2-tile promenade sidewalks completely open along highways & major town avenues
    if (cur === TILE_IDS.SIDEWALK) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const nt = base[ny * width + nx];
          if (nt === TILE_IDS.HIGHWAY || nt === TILE_IDS.MAIN_ROAD || nt === TILE_IDS.CROSSWALK) {
            return false;
          }
        }
      }
    }
    return true;
  };

  // Step 1: Fill interior GRASS pockets inside each building's own rectangle so collision matches drawn SNES sprite
  for (let i = 0; i < nextBuildings.length; i++) {
    const b = nextBuildings[i];
    if (!b.bounds) continue;
    const { minX, minY, maxX, maxY } = b.bounds;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (canClaimGrassTile(x, y, i)) {
          base[y * width + x] = TILE_IDS.BUILDING_WALL;
          ownerGrid[y * width + x] = i;
        }
      }
    }
  }

  // Deterministic regular SNES target footprints by building kind (idempotent!)
  const getTargetSize = (b) => {
    if (b.isHomeBase) return { tw: 4, th: 3 };
    const kind = b.kind || "house";
    if (kind === "garage") return { tw: 2, th: 2 };
    if (kind === "greenhouse") return { tw: 3, th: 3 };
    if (kind === "duplex") return { tw: 5, th: 3 };
    if (
      kind === "commercial" ||
      kind === "bakery_cafe" ||
      kind === "corner_market" ||
      kind === "office_plaza" ||
      kind === "fire_station"
    ) {
      return { tw: 5, th: 4 };
    }
    if (kind === "apartments" || kind === "library" || kind === "school" || kind === "civic") {
      return { tw: 6, th: 4 };
    }
    // Regular, harmonious New England house lots (4x3 & 4x4) so neighbors stay cohesive in size!
    const h = hashString(b.id || b.address || `${b.bounds?.minX}_${b.bounds?.minY}`) % 3;
    const houseTargets = [
      { tw: 4, th: 3 },
      { tw: 4, th: 3 },
      { tw: 4, th: 4 },
    ];
    return houseTargets[h];
  };

  const canExpandDir = (bIdx, dir) => {
    const { minX, minY, maxX, maxY } = nextBuildings[bIdx].bounds;
    if (dir === "N") {
      const ny = minY - 1;
      for (let x = minX; x <= maxX; x++) if (!canClaimGrassTile(x, ny, bIdx)) return false;
      return true;
    }
    if (dir === "S") {
      const ny = maxY + 1;
      for (let x = minX; x <= maxX; x++) if (!canClaimGrassTile(x, ny, bIdx)) return false;
      return true;
    }
    if (dir === "W") {
      const nx = minX - 1;
      for (let y = minY; y <= maxY; y++) if (!canClaimGrassTile(nx, y, bIdx)) return false;
      return true;
    }
    if (dir === "E") {
      const nx = maxX + 1;
      for (let y = minY; y <= maxY; y++) if (!canClaimGrassTile(nx, y, bIdx)) return false;
      return true;
    }
    return false;
  };

  const applyExpandDir = (bIdx, dir) => {
    const bd = nextBuildings[bIdx].bounds;
    if (dir === "N") {
      bd.minY -= 1;
      for (let x = bd.minX; x <= bd.maxX; x++) {
        base[bd.minY * width + x] = TILE_IDS.BUILDING_WALL;
        ownerGrid[bd.minY * width + x] = bIdx;
      }
    } else if (dir === "S") {
      bd.maxY += 1;
      for (let x = bd.minX; x <= bd.maxX; x++) {
        base[bd.maxY * width + x] = TILE_IDS.BUILDING_WALL;
        ownerGrid[bd.maxY * width + x] = bIdx;
      }
    } else if (dir === "W") {
      bd.minX -= 1;
      for (let y = bd.minY; y <= bd.maxY; y++) {
        base[y * width + bd.minX] = TILE_IDS.BUILDING_WALL;
        ownerGrid[y * width + bd.minX] = bIdx;
      }
    } else if (dir === "E") {
      bd.maxX += 1;
      for (let y = bd.minY; y <= bd.maxY; y++) {
        base[y * width + bd.maxX] = TILE_IDS.BUILDING_WALL;
        ownerGrid[y * width + bd.maxX] = bIdx;
      }
    }
  };

  // Order: Home Base & named landmarks first, then smaller buildings so undersized houses grow fairly
  const order = nextBuildings.map((_, idx) => idx);
  order.sort((ia, ib) => {
    const a = nextBuildings[ia];
    const b = nextBuildings[ib];
    if (a.isHomeBase !== b.isHomeBase) return a.isHomeBase ? -1 : 1;
    const aNamed = Boolean(a.name);
    const bNamed = Boolean(b.name);
    if (aNamed !== bNamed) return aNamed ? -1 : 1;
    const aArea = a.bounds ? (a.bounds.maxX - a.bounds.minX + 1) * (a.bounds.maxY - a.bounds.minY + 1) : 999;
    const bArea = b.bounds ? (b.bounds.maxX - b.bounds.minX + 1) * (b.bounds.maxY - b.bounds.minY + 1) : 999;
    return aArea - bArea;
  });

  // Round-robin 1-tile-per-pass growth so adjacent neighbors share yard space fairly!
  for (let pass = 0; pass < 6; pass++) {
    let anyExpanded = false;
    for (const bIdx of order) {
      const b = nextBuildings[bIdx];
      if (!b.bounds) continue;
      const { tw, th } = getTargetSize(b);
      const curW = b.bounds.maxX - b.bounds.minX + 1;
      const curH = b.bounds.maxY - b.bounds.minY + 1;

      // Expand height (preferring North into backyards before South!)
      if (curH < th) {
        if (canExpandDir(bIdx, "N")) {
          applyExpandDir(bIdx, "N");
          anyExpanded = true;
        } else if (canExpandDir(bIdx, "S")) {
          applyExpandDir(bIdx, "S");
          anyExpanded = true;
        }
      }
      // Expand width (alternating E/W balance)
      if (curW < tw) {
        const dirs = (bIdx + pass) % 2 === 0 ? ["E", "W"] : ["W", "E"];
        for (const d of dirs) {
          if (canExpandDir(bIdx, d)) {
            applyExpandDir(bIdx, d);
            anyExpanded = true;
            break;
          }
        }
      }
    }
    if (!anyExpanded) break;
  }

  return nextBuildings;
}

/**
 * Guarantee a continuous, unobstructed walkable sidewalk along ALL 8 neighbors
 * (cardinal + diagonal corners!) of every drivable road tile so houses never
 * pinch off sidewalks on curves or block pedestrian navigation along any street.
 */
export function enforceContinuousRoadSidewalks(base, width, height) {
  const isDrivableRoad = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY;
  const isWalkablePathOrRoad = (t) =>
    t === TILE_IDS.SIDEWALK ||
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.CROSSWALK ||
    t === TILE_IDS.PARKING_LOT ||
    t === TILE_IDS.DIRT ||
    t === TILE_IDS.WATER;

  const snap = base.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isDrivableRoad(snap[y * width + x])) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const nIdx = ny * width + nx;
          if (!isWalkablePathOrRoad(base[nIdx])) {
            base[nIdx] = TILE_IDS.SIDEWALK;
          }
        }
      }
    }
  }
}

/**
 * Tighten every building's bounding box strictly to its actual remaining BUILDING_WALL
 * tiles (and trim any edge row/column that would overlap a sidewalk or road), so
 * rendered house sprites NEVER visually overlap sidewalks or roads!
 */
export function tightenBuildingBoundsToWalls(buildings, base, width, height) {
  const isPathOrRoad = (t) =>
    t === TILE_IDS.SIDEWALK ||
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.CROSSWALK ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.DIRT;

  const kept = [];
  for (const b of buildings) {
    if (!b.bounds) continue;
    let { minX, minY, maxX, maxY } = b.bounds;
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(width - 1, Math.floor(maxX));
    maxY = Math.min(height - 1, Math.floor(maxY));

    // 1. Tight bounding box of actual BUILDING_WALL (5) tiles inside original footprint
    let wMinX = width;
    let wMaxX = -1;
    let wMinY = height;
    let wMaxY = -1;
    for (let y = minY; y <= maxY; y++) {
      const rowOff = y * width;
      for (let x = minX; x <= maxX; x++) {
        if (base[rowOff + x] === TILE_IDS.BUILDING_WALL) {
          if (x < wMinX) wMinX = x;
          if (x > wMaxX) wMaxX = x;
          if (y < wMinY) wMinY = y;
          if (y > wMaxY) wMaxY = y;
        }
      }
    }
    if (wMinX > wMaxX || wMinY > wMaxY) continue; // Building was completely cleared for sidewalk/road

    // 2. Iteratively trim any outer edge of the bounding rectangle that overlaps a sidewalk/road
    //    (e.g. from rotated/L-shaped footprints) so the drawn rectangle stays strictly off sidewalks!
    let changed = true;
    while (changed && wMinX <= wMaxX && wMinY <= wMaxY) {
      changed = false;
      const rowHasPath = (y) => {
        const off = y * width;
        for (let x = wMinX; x <= wMaxX; x++) {
          if (isPathOrRoad(base[off + x])) return true;
        }
        return false;
      };
      const colHasPath = (x) => {
        for (let y = wMinY; y <= wMaxY; y++) {
          if (isPathOrRoad(base[y * width + x])) return true;
        }
        return false;
      };

      if (wMaxY > wMinY && rowHasPath(wMaxY)) { wMaxY--; changed = true; continue; }
      if (wMinY < wMaxY && rowHasPath(wMinY)) { wMinY++; changed = true; continue; }
      if (wMaxX > wMinX && colHasPath(wMaxX)) { wMaxX--; changed = true; continue; }
      if (wMinX < wMaxX && colHasPath(wMinX)) { wMinX++; changed = true; continue; }
    }

    // Verify at least 1 BUILDING_WALL tile remains and no road tile sits inside final bounds
    let wallCount = 0;
    let hasPathOverlap = false;
    for (let y = wMinY; y <= wMaxY; y++) {
      const off = y * width;
      for (let x = wMinX; x <= wMaxX; x++) {
        const t = base[off + x];
        if (t === TILE_IDS.BUILDING_WALL) wallCount++;
        if (isPathOrRoad(t)) hasPathOverlap = true;
      }
    }
    if (wallCount === 0 || hasPathOverlap) continue;

    kept.push({
      ...b,
      bounds: { minX: wMinX, minY: wMinY, maxX: wMaxX, maxY: wMaxY },
    });
  }
  return kept;
}

/**
 * Place solid concrete median barriers (HIGHWAY_MEDIAN = 13) in clean, straight, unbroken lines
 * down the centerline of multi-lane divided highways (e.g., Route 9 / Boylston St, Hammond Pond Pkwy)
 * between opposing traffic directions, while keeping crosswalks and road intersections open.
 *
 * Guarantees:
 *   - Every barrier segment is a strictly straight horizontal or vertical line (0 bends, 0 zig-zags).
 *   - Minimum straight segment length >= 4 tiles (0 isolated 1-tile stubs or tiny scraps).
 *   - Clean transition spacing wherever a real-world highway curves to a new row/column.
 */
export function applyHighwayMedianBarriers(base, width, height) {
  const snap = base.slice();
  const isHw = (x, y) => inBounds(x, y, width, height) && snap[y * width + x] === TILE_IDS.HIGHWAY;

  const isCrossTile = (t) =>
    t === TILE_IDS.CROSSWALK || t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.RESIDENTIAL_ROAD;

  const isImmediateIntersection = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!inBounds(x + dx, y + dy, width, height)) continue;
        if (isCrossTile(snap[(y + dy) * width + (x + dx)])) return true;
      }
    }
    return false;
  };

  const ewCandidate = new Uint8Array(width * height);
  const nsCandidate = new Uint8Array(width * height);
  const colIdealY = new Int16Array(width * height);
  const rowIdealX = new Int16Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (snap[y * width + x] !== TILE_IDS.HIGHWAY) continue;
      if (isImmediateIntersection(x, y)) continue;

      let top = y;
      let bot = y;
      while (top > 0 && isHw(x, top - 1)) top--;
      while (bot < height - 1 && isHw(x, bot + 1)) bot++;
      const spanV = bot - top + 1;

      let left = x;
      let right = x;
      while (left > 0 && isHw(left - 1, y)) left--;
      while (right < width - 1 && isHw(right + 1, y)) right++;
      const spanH = right - left + 1;

      if (spanV >= 3 && spanV <= 9 && spanV <= spanH) {
        let northCross = false;
        let southCross = false;
        for (let dx = -1; dx <= 1; dx++) {
          if (inBounds(x + dx, top - 1, width, height) && isCrossTile(snap[(top - 1) * width + (x + dx)])) {
            northCross = true;
          }
          if (inBounds(x + dx, bot + 1, width, height) && isCrossTile(snap[(bot + 1) * width + (x + dx)])) {
            southCross = true;
          }
        }
        if (northCross && southCross) continue;
        if (y > top && y < bot && isHw(x, y - 1) && isHw(x, y + 1)) {
          const midY = Math.ceil((top + bot) / 2);
          const targetY = midY < bot ? midY : Math.floor((top + bot) / 2);
          // Only allow centerline candidates that sit within 1 tile of the true highway center (prevents slicing diagonally across 45° parkways!)
          if (Math.abs(y - targetY) <= 1) {
            ewCandidate[y * width + x] = 1;
            colIdealY[y * width + x] = targetY;
          }
        }
      } else if (spanH >= 3 && spanH <= 9 && spanH < spanV) {
        let westCross = false;
        let eastCross = false;
        for (let dy = -1; dy <= 1; dy++) {
          if (inBounds(left - 1, y + dy, width, height) && isCrossTile(snap[(y + dy) * width + (left - 1)])) {
            westCross = true;
          }
          if (inBounds(right + 1, y + dy, width, height) && isCrossTile(snap[(y + dy) * width + (right + 1)])) {
            eastCross = true;
          }
        }
        if (westCross && eastCross) continue;
        if (x > left && x < right && isHw(x - 1, y) && isHw(x + 1, y)) {
          const midX = Math.ceil((left + right) / 2);
          const targetX = midX < right ? midX : Math.floor((left + right) / 2);
          if (Math.abs(x - targetX) <= 1) {
            nsCandidate[y * width + x] = 1;
            rowIdealX[y * width + x] = targetX;
          }
        }
      }
    }
  }

  const MIN_STRAIGHT_RUN = 4;
  const placed = new Uint8Array(width * height); // 1 = horizontal, 2 = vertical

  const hasNonCollinearNeighbor = (x, y, allowDir) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        const p = placed[ny * width + nx];
        if (p === 0) continue;
        if (allowDir === 1 && dy === 0 && p === 1) continue;
        if (allowDir === 2 && dx === 0 && p === 2) continue;
        return true;
      }
    }
    return false;
  };

  // 1. Lock maximal STRAIGHT HORIZONTAL barrier lines on E-W highways
  const hRuns = [];
  for (let y = 1; y < height - 1; y++) {
    let x = 1;
    while (x < width - 1) {
      if (!ewCandidate[y * width + x]) {
        x++;
        continue;
      }
      const xStart = x;
      let centerErrSum = 0;
      while (x < width - 1 && ewCandidate[y * width + x]) {
        centerErrSum += Math.abs(y - colIdealY[y * width + x]);
        x++;
      }
      const xEnd = x - 1;
      const len = xEnd - xStart + 1;
      const drift = len > 0 ? Math.abs(colIdealY[y * width + xEnd] - colIdealY[y * width + xStart]) : 0;
      if (len >= MIN_STRAIGHT_RUN && drift <= Math.floor(len / 6)) {
        const avgErr = centerErrSum / len;
        hRuns.push({ y, xStart, xEnd, len, score: len - avgErr * 4 });
      }
    }
  }
  hRuns.sort((a, b) => b.score - a.score || b.len - a.len);

  for (const run of hRuns) {
    let x = run.xStart;
    while (x <= run.xEnd) {
      const blockedHere = (cx) => {
        for (let dy = -4; dy <= 4; dy++) {
          const ny = run.y + dy;
          if (ny >= 0 && ny < height && placed[ny * width + cx] !== 0) return true;
        }
        return hasNonCollinearNeighbor(cx, run.y, 1);
      };
      while (x <= run.xEnd && blockedHere(x)) x++;
      const segStart = x;
      while (x <= run.xEnd && !blockedHere(x)) x++;
      const segEnd = x - 1;
      if (segEnd - segStart + 1 >= MIN_STRAIGHT_RUN) {
        let trimStart = segStart;
        let trimEnd = segEnd;
        const nearOffsetBarrier = (cx) => {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
              if (dy === 0) continue;
              const nx = cx + dx;
              const ny = run.y + dy;
              if (inBounds(nx, ny, width, height) && placed[ny * width + nx] !== 0) return true;
            }
          }
          return false;
        };
        while (trimStart <= trimEnd && nearOffsetBarrier(trimStart)) trimStart++;
        while (trimEnd >= trimStart && nearOffsetBarrier(trimEnd)) trimEnd--;
        if (trimEnd - trimStart + 1 >= MIN_STRAIGHT_RUN) {
          for (let cx = trimStart; cx <= trimEnd; cx++) {
            placed[run.y * width + cx] = 1;
            base[run.y * width + cx] = TILE_IDS.HIGHWAY_MEDIAN;
          }
        }
      }
    }
  }

  // 2. Lock maximal STRAIGHT VERTICAL barrier lines on N-S highways
  const vRuns = [];
  for (let x = 1; x < width - 1; x++) {
    let y = 1;
    while (y < height - 1) {
      if (!nsCandidate[y * width + x]) {
        y++;
        continue;
      }
      const yStart = y;
      let centerErrSum = 0;
      while (y < height - 1 && nsCandidate[y * width + x]) {
        centerErrSum += Math.abs(x - rowIdealX[y * width + x]);
        y++;
      }
      const yEnd = y - 1;
      const len = yEnd - yStart + 1;
      const drift = len > 0 ? Math.abs(rowIdealX[yEnd * width + x] - rowIdealX[yStart * width + x]) : 0;
      if (len >= MIN_STRAIGHT_RUN && drift <= Math.floor(len / 6)) {
        const avgErr = centerErrSum / len;
        vRuns.push({ x, yStart, yEnd, len, score: len - avgErr * 4 });
      }
    }
  }
  vRuns.sort((a, b) => b.score - a.score || b.len - a.len);

  for (const run of vRuns) {
    let y = run.yStart;
    while (y <= run.yEnd) {
      const blockedHere = (cy) => {
        for (let dx = -4; dx <= 4; dx++) {
          const nx = run.x + dx;
          if (nx >= 0 && nx < width && placed[cy * width + nx] !== 0) return true;
        }
        return hasNonCollinearNeighbor(run.x, cy, 2);
      };
      while (y <= run.yEnd && blockedHere(y)) y++;
      const segStart = y;
      while (y <= run.yEnd && !blockedHere(y)) y++;
      const segEnd = y - 1;
      if (segEnd - segStart + 1 >= MIN_STRAIGHT_RUN) {
        let trimStart = segStart;
        let trimEnd = segEnd;
        const nearOffsetBarrier = (cy) => {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              if (dx === 0) continue;
              const nx = run.x + dx;
              const ny = cy + dy;
              if (inBounds(nx, ny, width, height) && placed[ny * width + nx] !== 0) return true;
            }
          }
          return false;
        };
        while (trimStart <= trimEnd && nearOffsetBarrier(trimStart)) trimStart++;
        while (trimEnd >= trimStart && nearOffsetBarrier(trimEnd)) trimEnd--;
        if (trimEnd - trimStart + 1 >= MIN_STRAIGHT_RUN) {
          for (let cy = trimStart; cy <= trimEnd; cy++) {
            placed[cy * width + run.x] = 2;
            base[cy * width + run.x] = TILE_IDS.HIGHWAY_MEDIAN;
          }
        }
      }
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
  const sandWays = [];
  const dirtWays = [];
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
    } else if (isSandFeature(tags)) {
      sandWays.push(way);
    } else if (isDirtFeature(tags)) {
      dirtWays.push(way);
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

  // Priority 2: Parks, Athletic Fields & Wild Woods
  for (const way of parkWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      const tile = isTallGrassFeature(way.tags)
        ? TILE_IDS.TALL_GRASS
        : isManicuredParkFeature(way.tags)
          ? TILE_IDS.PARK
          : TILE_IDS.GRASS;
      fillPolygon(base, width, height, pts, tile, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  // Priority 2.2: Sand Beaches / Playgrounds & Dirt Infields / Bare Earth
  for (const way of sandWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      fillPolygon(base, width, height, pts, TILE_IDS.SAND, (cur) => cur !== TILE_IDS.WATER);
    }
  }
  for (const way of dirtWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      fillPolygon(base, width, height, pts, TILE_IDS.DIRT, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  // Priority 2.5: Surface Parking Lots (amenity=parking)
  for (const way of parkingWays) {
    const pts = getWayPoints(way);
    if (pts.length >= 3) {
      fillPolygon(base, width, height, pts, TILE_IDS.PARKING_LOT, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  const isNaturalGround = (cur) =>
    cur === TILE_IDS.GRASS ||
    cur === TILE_IDS.TALL_GRASS ||
    cur === TILE_IDS.PARK ||
    cur === TILE_IDS.DIRT ||
    cur === TILE_IDS.SAND;

  // Priority 3: Dirt Trails, Sidewalks, Streets, Main Avenues & Highways (with small-bend simplification!)
  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.PARKING_LOT) continue;
    const pts = simplifyRoadPolyline(getWayPoints(way), { epsilon: 1.8 });
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.PARKING_LOT, 0, (cur) => cur !== TILE_IDS.WATER);
    }
  }

  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.DIRT) continue;
    const pts = simplifyRoadPolyline(getWayPoints(way), { epsilon: 2.0 });
    for (let i = 0; i < pts.length - 1; i++) {
      drawSimplifiedSegment(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.DIRT, 0, (cur) => cur !== TILE_IDS.WATER);
    }
    if (way.tags?.name) {
      addPolylineStreetZones(streetZones, way.tags.name, "trail", pts, width, height, 1);
    }
  }

  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.SIDEWALK) continue;
    const pts = simplifyRoadPolyline(getWayPoints(way), { epsilon: 2.0 });
    for (let i = 0; i < pts.length - 1; i++) {
      drawSimplifiedSegment(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.SIDEWALK, 0);
    }
    if (way.tags?.name) {
      addPolylineStreetZones(streetZones, way.tags.name, "sidewalk", pts, width, height, 1);
    }
  }

  for (const { way, roadInfo } of roadWays) {
    if (roadInfo.tile !== TILE_IDS.RESIDENTIAL_ROAD) continue;
    const pts = simplifyRoadPolyline(getWayPoints(way), { epsilon: 2.4 });
    for (let i = 0; i < pts.length - 1; i++) {
      drawSimplifiedSegment(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        TILE_IDS.SIDEWALK,
        1,
        isNaturalGround
      );
    }
    for (let i = 0; i < pts.length - 1; i++) {
      drawSimplifiedSegment(
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
    if (roadInfo.tile !== TILE_IDS.MAIN_ROAD && roadInfo.tile !== TILE_IDS.HIGHWAY) continue;
    const pts = simplifyRoadPolyline(getWayPoints(way), { epsilon: 2.8 });
    const roadTile = roadInfo.tile;
    // Crisp 1-tile sidewalks flanking busy arterial avenues & highways (radius 2 around radius-1 road = 1-tile border!)
    for (let i = 0; i < pts.length - 1; i++) {
      drawSimplifiedSegment(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        TILE_IDS.SIDEWALK,
        2,
        isNaturalGround
      );
    }
    for (let i = 0; i < pts.length - 1; i++) {
      drawSimplifiedSegment(
        base,
        width,
        height,
        pts[i].x,
        pts[i].y,
        pts[i + 1].x,
        pts[i + 1].y,
        roadTile,
        1
      );
    }
    if (way.tags?.name) {
      addPolylineStreetZones(streetZones, way.tags.name, roadInfo.zoneType, pts, width, height, 3);
    }
  }

  // Priority 4: Pedestrian Crossings (crisp 1-tile-deep zebra stripes across the road width, never 3x3 crosswalk swamps!)
  for (const way of crossingWays) {
    const pts = getWayPoints(way);
    for (let i = 0; i < pts.length - 1; i++) {
      drawLine(base, width, height, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, TILE_IDS.CROSSWALK, 0, (cur) =>
        cur === TILE_IDS.HIGHWAY || cur === TILE_IDS.MAIN_ROAD || cur === TILE_IDS.RESIDENTIAL_ROAD
      );
    }
  }
  const isDrivableRoadTile = (t) =>
    t === TILE_IDS.HIGHWAY || t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.RESIDENTIAL_ROAD;
  for (const node of crossingNodes) {
    const pt = projectNode(node);
    if (!inBounds(pt.x, pt.y, width, height)) continue;
    const centerTile = base[pt.y * width + pt.x];
    if (!isDrivableRoadTile(centerTile)) continue;
    // Detect road travel axis so the crosswalk spans cleanly across lanes without bloating lengthwise
    let ewRoad = 0;
    let nsRoad = 0;
    for (let d = 1; d <= 2; d++) {
      if (inBounds(pt.x - d, pt.y, width, height) && isDrivableRoadTile(base[pt.y * width + (pt.x - d)])) ewRoad++;
      if (inBounds(pt.x + d, pt.y, width, height) && isDrivableRoadTile(base[pt.y * width + (pt.x + d)])) ewRoad++;
      if (inBounds(pt.x, pt.y - d, width, height) && isDrivableRoadTile(base[(pt.y - d) * width + pt.x])) nsRoad++;
      if (inBounds(pt.x, pt.y + d, width, height) && isDrivableRoadTile(base[(pt.y + d) * width + pt.x])) nsRoad++;
    }
    base[pt.y * width + pt.x] = TILE_IDS.CROSSWALK;
    if (ewRoad >= nsRoad) {
      // E-W road -> stripe north/south across the carriageway
      for (const oy of [-1, 1]) {
        const py = pt.y + oy;
        if (inBounds(pt.x, py, width, height) && isDrivableRoadTile(base[py * width + pt.x])) {
          base[py * width + pt.x] = TILE_IDS.CROSSWALK;
        }
      }
    } else {
      // N-S road -> stripe east/west across the carriageway
      for (const ox of [-1, 1]) {
        const px = pt.x + ox;
        if (inBounds(px, pt.y, width, height) && isDrivableRoadTile(base[pt.y * width + px])) {
          base[pt.y * width + px] = TILE_IDS.CROSSWALK;
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
        if (
          nVal === TILE_IDS.HIGHWAY ||
          nVal === TILE_IDS.MAIN_ROAD ||
          nVal === TILE_IDS.RESIDENTIAL_ROAD ||
          nVal === TILE_IDS.CROSSWALK
        ) {
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
        if (
          cur === TILE_IDS.GRASS ||
          cur === TILE_IDS.TALL_GRASS ||
          cur === TILE_IDS.PARK ||
          cur === TILE_IDS.DIRT ||
          cur === TILE_IDS.SAND ||
          cur === TILE_IDS.BUILDING_WALL
        ) {
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
      if (isNaturalGround(base[idx])) {
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

    const address = houseNumber && street
      ? `${houseNumber} ${street}`
      : houseNumber || bName || "";
    const bounds = { minX, minY, maxX, maxY };
    const isHomeBase =
      (houseNumber === "565" && street.toLowerCase().includes("boylston")) ||
      (homeX >= minX && homeX <= maxX && homeY >= minY && homeY <= maxY);

    const kind = isHomeBase ? "house" : classifyBuildingKind(tags, bounds, address, bName);
    const id = way.id ? `osm_${way.id}` : `b_${minX}_${minY}`;
    const styleKey = address || String(way.id || `${minX}_${minY}`);
    const styleIndex = isHomeBase ? 0 : (hashString(styleKey) % 7) + 1;
    const arch =
      kind === "house"
        ? classifyHouseArch({ id, address: isHomeBase ? "565 Boylston St" : address, bounds, isHomeBase, tags })
        : undefined;
    const osmColor = tags["building:colour"] ? String(tags["building:colour"]) : "";
    const osmRoofColor = tags["roof:colour"] ? String(tags["roof:colour"]) : "";

    buildings.push({
      id,
      houseNumber,
      street,
      address: isHomeBase ? "565 Boylston St" : address,
      name: isHomeBase ? "Home Base" : bName,
      kind,
      ...(arch ? { arch } : {}),
      isHomeBase,
      styleIndex,
      ...(osmColor ? { osmColor } : {}),
      ...(osmRoofColor ? { osmRoofColor } : {}),
      bounds,
    });
  }

  // Local neighborhood detail: small parking lot immediately to the left (west) of 575 Boylston St
  // (NEVER overwrite RESIDENTIAL_ROAD so Jackson Street stays cleanly connected to Boylston St!)
  const b575 = buildings.find(
    (b) => b.houseNumber === "575" && b.street.toLowerCase().includes("boylston")
  );
  if (b575) {
    const lotMinX = Math.max(0, b575.bounds.minX - 2);
    const lotMaxX = Math.max(0, b575.bounds.minX - 1);
    const lotMinY = b575.bounds.minY;
    const lotMaxY = Math.max(lotMinY, b575.bounds.maxY - 1);
    for (let ty = lotMinY; ty <= lotMaxY; ty++) {
      for (let tx = lotMinX; tx <= lotMaxX; tx++) {
        const idx = ty * width + tx;
        const cur = base[idx];
        if (cur === TILE_IDS.GRASS || cur === TILE_IDS.TALL_GRASS) {
          base[idx] = TILE_IDS.PARKING_LOT;
        }
      }
    }
  }

  // Smooth small road kinks, normalize bloated crosswalk swamps, eliminate diagonal pinches,
  // repair severed street mouths, prioritize Newton Centre proper roads, guarantee crisp 1-tile sidewalks
  simplifyGridPaths(base, width, height);
  normalizeCrosswalkBlobs(base, width, height);
  eliminateDiagonalRoadPinches(base, width, height);
  repairStreetConnectivity(base, streetZones, width, height);
  prioritizeNewtonCentreRoads(base, width, height);
  eliminateDiagonalRoadPinches(base, width, height);
  enforceContinuousRoadSidewalks(base, width, height);
  slimOversizedSidewalks(base, width, height, [{ x: homeX, y: homeY, radius: 1 }]);
  enforceContinuousRoadSidewalks(base, width, height);
  const preEnlargedBuildings = tightenBuildingBoundsToWalls(buildings, base, width, height);
  const enlargedBuildings = enlargeBuildingFootprints(preEnlargedBuildings, base, width, height, [
    { x: homeX, y: homeY, radius: 1 },
  ]);
  const cleanBuildings = tightenBuildingBoundsToWalls(enlargedBuildings, base, width, height);

  // Clear any unowned orphan BUILDING_WALL tiles inside Newton Centre proper after road-priority trimming
  if (width === 512 && height === 512) {
    const covered = new Uint8Array(width * height);
    for (const b of cleanBuildings) {
      if (!b.bounds) continue;
      for (let y = b.bounds.minY; y <= b.bounds.maxY; y++) {
        for (let x = b.bounds.minX; x <= b.bounds.maxX; x++) {
          if (inBounds(x, y, width, height)) covered[y * width + x] = 1;
        }
      }
    }
    for (let y = 199; y <= 288; y++) {
      for (let x = 212; x <= 316; x++) {
        const idx = y * width + x;
        if (base[idx] === TILE_IDS.BUILDING_WALL && covered[idx] === 0) {
          base[idx] = TILE_IDS.GRASS;
        }
      }
    }
  }

  // Place solid concrete Jersey median barriers down multi-lane divided highways
  applyHighwayMedianBarriers(base, width, height);

  // Derive collision layer (1 = solid wall/water/median barrier, 0 = walkable)
  const collision = base.map((tileId) =>
    tileId === TILE_IDS.BUILDING_WALL ||
    tileId === TILE_IDS.WATER ||
    tileId === TILE_IDS.HIGHWAY_MEDIAN
      ? 1
      : 0
  );

  // Guarantee walkable Home Base spawn right on the sidewalk by Home Base (565 Boylston St)
  const spawnTile = ensureWalkableSpawn(base, collision, width, height, homeX, homeY);

  // If no building explicitly matched 565 Boylston St, tag the closest residential house to origin as Home Base
  if (cleanBuildings.length > 0 && !cleanBuildings.some((b) => b.isHomeBase)) {
    let closest = null;
    let bestDist = Infinity;
    for (const b of cleanBuildings) {
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
    buildings: cleanBuildings,
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

  // Crystal Lake / Pond in NW quadrant with natural sandy beach shore
  for (let y = 13; y <= 30; y++) {
    for (let x = 13; x <= 34; x++) {
      const dx = (x - 23) / 9;
      const dy = (y - 21) / 7;
      const r2 = dx * dx + dy * dy;
      if (r2 <= 1) {
        base[y * width + x] = TILE_IDS.WATER;
      } else if (r2 <= 1.38) {
        base[y * width + x] = TILE_IDS.SAND;
      }
    }
  }

  // Manicured public park & baseball field (NE / Weeks Field style)
  for (let y = cy - 18; y <= cy - 6; y++) {
    for (let x = cx + 24; x <= cx + 44; x++) {
      if (inBounds(x, y, width, height) && base[y * width + x] === TILE_IDS.GRASS) {
        base[y * width + x] = TILE_IDS.PARK;
      }
    }
  }
  // Dirt baseball diamond + sandy warning track inside the park
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const tx = cx + 34 + dx;
      const ty = cy - 12 + dy;
      if (inBounds(tx, ty, width, height) && Math.abs(dx) + Math.abs(dy) <= 3) {
        base[ty * width + tx] = TILE_IDS.DIRT;
      }
    }
  }
  for (let x = cx + 26; x <= cx + 30; x++) {
    base[(cy - 8) * width + x] = TILE_IDS.SAND;
    base[(cy - 9) * width + x] = TILE_IDS.SAND;
  }

  // Oakdale Woods tall grass park patch (SE quadrant) with manicured park edge
  for (let y = cy + 16; y <= cy + 34; y++) {
    for (let x = cx + 4; x <= cx + 40; x++) {
      if (inBounds(x, y, width, height) && base[y * width + x] === TILE_IDS.GRASS) {
        const isEdge = y <= cy + 17 || y >= cy + 33 || x <= cx + 5 || x >= cx + 39;
        base[y * width + x] = isEdge ? TILE_IDS.PARK : TILE_IDS.TALL_GRASS;
      }
    }
  }

  // Boylston St (Route 9 Highway) running E-W
  const boylstonY = cy + 4;
  for (let x = 0; x < width; x++) {
    base[(boylstonY - 2) * width + x] = TILE_IDS.SIDEWALK;
    base[(boylstonY - 1) * width + x] = TILE_IDS.HIGHWAY;
    base[boylstonY * width + x] = TILE_IDS.HIGHWAY;
    base[(boylstonY + 1) * width + x] = TILE_IDS.HIGHWAY;
    base[(boylstonY + 2) * width + x] = TILE_IDS.SIDEWALK;
  }

  // Parker St (Residential Street) running N-S
  const parkerX = cx - 10;
  for (let y = 0; y < height; y++) {
    if (base[y * width + parkerX] === TILE_IDS.WATER) continue;
    base[y * width + (parkerX - 1)] = TILE_IDS.SIDEWALK;
    base[y * width + parkerX] = TILE_IDS.RESIDENTIAL_ROAD;
    base[y * width + (parkerX + 1)] = TILE_IDS.SIDEWALK;
  }

  // Centre St (Main Town Avenue) running N-S
  const centreX = cx + 18;
  for (let y = 0; y < height; y++) {
    base[y * width + (centreX - 1)] = TILE_IDS.SIDEWALK;
    base[y * width + centreX] = TILE_IDS.MAIN_ROAD;
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

  // Oakdale Woods unpaved dirt trail
  for (let x = cx + 6; x <= cx + 38; x++) {
    base[(cy + 24) * width + x] = TILE_IDS.DIRT;
  }

  // Crosswalks across Boylston St
  for (const crossX of [parkerX, cx, centreX]) {
    for (let y = boylstonY - 1; y <= boylstonY + 1; y++) {
      base[y * width + crossX] = TILE_IDS.CROSSWALK;
      base[y * width + (crossX + 1)] = TILE_IDS.CROSSWALK;
    }
  }

  // Distinct 1-house-per-address buildings across architectures & building kinds
  const rawBuildings = [
    { id: "home_565", houseNumber: "565", street: "Boylston St", name: "Home Base", kind: "house", arch: "colonial", isHomeBase: true, styleIndex: 0, x: cx - 3, y: cy - 3, w: 6, h: 4 },
    { id: "house_557", houseNumber: "557", street: "Boylston St", name: "", kind: "house", arch: "tudor", isHomeBase: false, styleIndex: 1, x: cx - 22, y: cy - 3, w: 6, h: 4 },
    { id: "house_573", houseNumber: "573", street: "Boylston St", name: "", kind: "house", arch: "victorian", isHomeBase: false, styleIndex: 2, x: cx + 7, y: cy - 3, w: 6, h: 4 },
    { id: "shop_46", houseNumber: "46", street: "Langley Rd", name: "J.P. Licks", kind: "commercial", isHomeBase: false, styleIndex: 6, x: centreX + 3, y: cy - 3, w: 6, h: 4 },
    { id: "garage_565", houseNumber: "", street: "Boylston St", name: "", kind: "garage", isHomeBase: false, styleIndex: 0, x: cx - 6, y: cy - 3, w: 2, h: 2 },
    { id: "library_330", houseNumber: "330", street: "Homer St", name: "Newton Free Library", kind: "library", isHomeBase: false, styleIndex: 3, x: centreX + 6, y: wardY - 10, w: 10, h: 7 },
    { id: "bethel_561", houseNumber: "561", street: "Ward St", name: "Congregation Beth El", kind: "civic", isHomeBase: false, styleIndex: 4, x: parkerX - 14, y: wardY - 9, w: 9, h: 6 },
    { id: "school_34", houseNumber: "34", street: "Philbrick Rd", name: "Maimonides School", kind: "school", isHomeBase: false, styleIndex: 3, x: centreX + 8, y: boylstonY + 8, w: 10, h: 7 },
    { id: "bc_stuart_offline", houseNumber: "885", street: "Centre St", name: "Boston College — Stuart Hall", kind: "school", bcCampus: true, isHomeBase: false, styleIndex: 3, x: cx - 10, y: 12, w: 10, h: 6 },
    { id: "salzberg_12", houseNumber: "12", street: "Centre St", name: "The Salzberg House", kind: "house", arch: "ranch", isHomeBase: false, styleIndex: 5, x: centreX + 22, y: cy - 12, w: 6, h: 4 },
    { id: "apts_89", houseNumber: "89", street: "Centre St", name: "Centre Court Apartments", kind: "apartments", isHomeBase: false, styleIndex: 4, x: parkerX - 14, y: boylstonY + 8, w: 8, h: 5 },
  ];

  const buildings = [];
  for (const b of rawBuildings) {
    for (let y = b.y; y < b.y + b.h; y++) {
      for (let x = b.x; x < b.x + b.w; x++) {
        if (
          inBounds(x, y, width, height) &&
          (base[y * width + x] === TILE_IDS.GRASS ||
            base[y * width + x] === TILE_IDS.TALL_GRASS ||
            base[y * width + x] === TILE_IDS.PARK)
        ) {
          base[y * width + x] = TILE_IDS.BUILDING_WALL;
        }
      }
    }
    buildings.push({
      id: b.id,
      houseNumber: b.houseNumber,
      street: b.street,
      address: b.houseNumber ? `${b.houseNumber} ${b.street}` : "",
      name: b.name,
      kind: b.kind,
      ...(b.arch ? { arch: b.arch } : {}),
      ...(b.bcCampus ? { bcCampus: true } : {}),
      isHomeBase: b.isHomeBase,
      styleIndex: b.styleIndex,
      bounds: { minX: b.x, minY: b.y, maxX: b.x + b.w - 1, maxY: b.y + b.h - 1 },
    });
  }

  // Add divided highway median barrier along Boylston St (open at crosswalks & intersections)
  enforceContinuousRoadSidewalks(base, width, height);
  const cleanOfflineBuildings = tightenBuildingBoundsToWalls(buildings, base, width, height);
  applyHighwayMedianBarriers(base, width, height);

  const collision = base.map((t) =>
    t === TILE_IDS.BUILDING_WALL || t === TILE_IDS.WATER || t === TILE_IDS.HIGHWAY_MEDIAN ? 1 : 0
  );
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
    buildings: cleanOfflineBuildings,
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
  way["natural"~"sand|beach"](${bboxStr});
  way["waterway"~"riverbank|river|stream|canal"](${bboxStr});
  way["leisure"~"park|pitch|playground|garden|nature_reserve|sandbox"](${bboxStr});
  way["landuse"~"grass|forest|meadow|recreation_ground|village_green|cemetery|grave_yard"](${bboxStr});
  way["amenity"="grave_yard"](${bboxStr});
  way["natural"~"wood|grassland"](${bboxStr});
  way["surface"~"sand|dirt|earth|gravel|unpaved"](${bboxStr});
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

/**
 * Deterministically enrich an existing OpenStreetMap world_map.json with higher ground
 * fidelity (highway, dirt trails/infields, sandy beaches/playgrounds, manicured parks)
 * and distinct per-building architectural varieties without losing real OSM footprints.
 */
export function enrichWorldMap(worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base.slice();
  const streetZones = worldMap.streetZones || [];

  // 1. Upgrade major state highways (Boylston St / Route 9, Hammond Pond Parkway) from main_road -> highway
  //    (First reset any prior HIGHWAY_MEDIAN back to HIGHWAY so --enrich is idempotent!)
  for (let i = 0; i < base.length; i++) {
    if (base[i] === TILE_IDS.HIGHWAY_MEDIAN) base[i] = TILE_IDS.HIGHWAY;
  }
  const nonHwArterialGrid = new Uint8Array(width * height);
  for (const z of streetZones) {
    if (!z || !z.bounds || z.type !== "arterial" || isHighwayRoadName(z.name)) continue;
    const minX = Math.max(0, Math.floor(z.bounds.minX));
    const maxX = Math.min(width - 1, Math.floor(z.bounds.maxX));
    const minY = Math.max(0, Math.floor(z.bounds.minY));
    const maxY = Math.min(height - 1, Math.floor(z.bounds.maxY));
    for (let ty = minY; ty <= maxY; ty++) {
      const rowOffset = ty * width;
      for (let tx = minX; tx <= maxX; tx++) {
        nonHwArterialGrid[rowOffset + tx] = 1;
      }
    }
  }
  for (const z of streetZones) {
    if (!z || !z.bounds || !isHighwayRoadName(z.name)) continue;
    const minX = Math.max(0, Math.floor(z.bounds.minX));
    const maxX = Math.min(width - 1, Math.floor(z.bounds.maxX));
    const minY = Math.max(0, Math.floor(z.bounds.minY));
    const maxY = Math.min(height - 1, Math.floor(z.bounds.maxY));
    for (let ty = minY; ty <= maxY; ty++) {
      const rowOffset = ty * width;
      for (let tx = minX; tx <= maxX; tx++) {
        if (base[rowOffset + tx] === TILE_IDS.MAIN_ROAD) {
          base[rowOffset + tx] = TILE_IDS.HIGHWAY;
        }
      }
    }
  }
  // Keep incoming cross-arterial branches (like Clark St, Centre St, Parker St) as MAIN_ROAD right up to the
  // Route 9 carriageway so highway asphalt & concrete medians NEVER leak up into cross-streets!
  const hwSnap = base.slice();
  for (let ty = 2; ty < height - 2; ty++) {
    for (let tx = 2; tx < width - 2; tx++) {
      const idx = ty * width + tx;
      if (hwSnap[idx] !== TILE_IDS.HIGHWAY || nonHwArterialGrid[idx] !== 1) continue;
      const isHw = (x, y) => hwSnap[y * width + x] === TILE_IDS.HIGHWAY || hwSnap[y * width + x] === TILE_IDS.CROSSWALK;
      const inEwHighway = isHw(tx - 2, ty) && isHw(tx + 2, ty) && isHw(tx - 1, ty) && isHw(tx + 1, ty);
      const inNsHighway = isHw(tx, ty - 2) && isHw(tx, ty + 2) && isHw(tx, ty - 1) && isHw(tx, ty + 1);
      if (!inEwHighway && !inNsHighway) {
        base[idx] = TILE_IDS.MAIN_ROAD;
      }
    }
  }

  // 1b. Convert ONLY short unnamed service driveways / park sidepaths (components <= 18 tiles outside
  //     named streetZones) into neat 1-tile SIDEWALK or DIRT paths, while KEEPING longer real unnamed
  //     streets as RESIDENTIAL_ROAD so real roads are never swallowed up into giant sidewalk slabs!
  const namedRoadGrid = new Uint8Array(width * height);
  for (const z of streetZones) {
    if (!z || !z.bounds || (z.type !== "residential" && z.type !== "arterial")) continue;
    const minX = Math.max(0, Math.floor(z.bounds.minX));
    const maxX = Math.min(width - 1, Math.floor(z.bounds.maxX));
    const minY = Math.max(0, Math.floor(z.bounds.minY));
    const maxY = Math.min(height - 1, Math.floor(z.bounds.maxY));
    for (let ty = minY; ty <= maxY; ty++) {
      const rowOffset = ty * width;
      for (let tx = minX; tx <= maxX; tx++) {
        namedRoadGrid[rowOffset + tx] = 1;
      }
    }
  }
  const unnamedSnap = base.slice();
  const unnamedVis = new Uint8Array(width * height);
  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const startIdx = ty * width + tx;
      if (unnamedSnap[startIdx] !== TILE_IDS.RESIDENTIAL_ROAD || namedRoadGrid[startIdx] === 1 || unnamedVis[startIdx]) {
        continue;
      }
      const comp = [startIdx];
      unnamedVis[startIdx] = 1;
      for (let q = 0; q < comp.length; q++) {
        const ci = comp[q];
        const cx = ci % width;
        const cy = (ci / width) | 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            const ni = ny * width + nx;
            if (unnamedSnap[ni] === TILE_IDS.RESIDENTIAL_ROAD && namedRoadGrid[ni] === 0 && !unnamedVis[ni]) {
              unnamedVis[ni] = 1;
              comp.push(ni);
            }
          }
        }
      }
      // Keep long unnamed streets (>= 19 tiles) as real RESIDENTIAL_ROAD! Only convert short driveways/sidepaths.
      if (comp.length > 18) continue;
      for (const ci of comp) {
        const cx = ci % width;
        const cy = (ci / width) | 0;
        let inNature = false;
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const n = unnamedSnap[ny * width + nx];
          if (n === TILE_IDS.PARK || n === TILE_IDS.TALL_GRASS || n === TILE_IDS.DIRT) {
            inNature = true;
            break;
          }
        }
        base[ci] = inNature ? TILE_IDS.DIRT : TILE_IDS.SIDEWALK;
      }
    }
  }

  // 2. Upgrade named woodland / aqueduct trails from sidewalk -> dirt
  for (const z of streetZones) {
    if (!z || !z.bounds || !isTrailName(z.name)) continue;
    const minX = Math.max(0, Math.floor(z.bounds.minX));
    const maxX = Math.min(width - 1, Math.floor(z.bounds.maxX));
    const minY = Math.max(0, Math.floor(z.bounds.minY));
    const maxY = Math.min(height - 1, Math.floor(z.bounds.maxY));
    for (let ty = minY; ty <= maxY; ty++) {
      const rowOffset = ty * width;
      for (let tx = minX; tx <= maxX; tx++) {
        if (base[rowOffset + tx] === TILE_IDS.SIDEWALK) {
          base[rowOffset + tx] = TILE_IDS.DIRT;
        }
      }
    }
  }

  // 3. Gradate parks vs wild woods: manicured public parks become PARK (11) (leaving deep forest cores
  //    5+ tiles inside large woodlands as wild swaying TALL_GRASS (7)). Skip if map already has PARK tiles (idempotent).
  const alreadyHasParks = base.some((t) => t === TILE_IDS.PARK);
  if (!alreadyHasParks) {
    const parkSnapshot = base.slice();
    for (let ty = 1; ty < height - 1; ty++) {
      for (let tx = 1; tx < width - 1; tx++) {
        const idx = ty * width + tx;
        if (parkSnapshot[idx] !== TILE_IDS.TALL_GRASS) continue;
        let nearNonWoods = false;
        for (let dy = -5; dy <= 5 && !nearNonWoods; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            const nx = tx + dx;
            const ny = ty + dy;
            if (!inBounds(nx, ny, width, height)) continue;
            const nVal = parkSnapshot[ny * width + nx];
            if (nVal !== TILE_IDS.TALL_GRASS && nVal !== TILE_IDS.WATER) {
              nearNonWoods = true;
              break;
            }
          }
        }
        if (nearNonWoods) {
          base[idx] = TILE_IDS.PARK;
        }
      }
    }
  }

  // 4. Real Newton Centre park fields, baseball diamond, dirt woodland trails & sandy beaches (512x512 map)
  if (width === 512 && height === 512) {
    const paintCircle = (cx, cy, rx, ry, tileId, filterFn) => {
      for (let ty = Math.max(0, cy - ry); ty <= Math.min(height - 1, cy + ry); ty++) {
        for (let tx = Math.max(0, cx - rx); tx <= Math.min(width - 1, cx + rx); tx++) {
          const ndx = (tx - cx) / Math.max(1, rx);
          const ndy = (ty - cy) / Math.max(1, ry);
          if (ndx * ndx + ndy * ndy <= 1) {
            const idx = ty * width + tx;
            if (!filterFn || filterFn(base[idx], tx, ty)) {
              base[idx] = tileId;
            }
          }
        }
      }
    };

    const isOpenLawn = (cur) =>
      cur === TILE_IDS.GRASS || cur === TILE_IDS.TALL_GRASS || cur === TILE_IDS.PARK;

    // Weeks Field (around 208, 358): lush manicured athletic park + sandy playground + dirt walking loop
    paintCircle(208, 358, 12, 10, TILE_IDS.PARK, isOpenLawn);
    paintCircle(205, 362, 3, 2, TILE_IDS.SAND, (cur) => cur === TILE_IDS.PARK || cur === TILE_IDS.GRASS);
    drawLine(base, width, height, 200, 354, 214, 360, TILE_IDS.DIRT, 0, (cur) => cur === TILE_IDS.PARK || cur === TILE_IDS.GRASS);

    // Ward Elementary Baseball Field (around 472, 38): manicured park outfield + dirt baseball diamond + sandy warning track
    paintCircle(472, 38, 14, 12, TILE_IDS.PARK, isOpenLawn);
    paintCircle(472, 34, 9, 6, TILE_IDS.SAND, (cur, tx, ty) => cur === TILE_IDS.PARK && ty <= 31);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 4) {
          const tx = 472 + dx;
          const ty = 40 + dy;
          if (inBounds(tx, ty, width, height) && (base[ty * width + tx] === TILE_IDS.PARK || base[ty * width + tx] === TILE_IDS.GRASS)) {
            base[ty * width + tx] = TILE_IDS.DIRT;
          }
        }
      }
    }

    // Oakdale Woods Trailhead (around 182, 457): woodland park & winding dirt trail into Oakdale Woods
    paintCircle(178, 462, 12, 9, TILE_IDS.TALL_GRASS, (cur) => cur === TILE_IDS.GRASS);
    paintCircle(182, 457, 6, 5, TILE_IDS.PARK, (cur) => cur === TILE_IDS.GRASS || cur === TILE_IDS.TALL_GRASS);
    drawLine(base, width, height, 182, 456, 174, 466, TILE_IDS.DIRT, 0, isOpenLawn);
    drawLine(base, width, height, 174, 466, 166, 463, TILE_IDS.DIRT, 0, isOpenLawn);

    // Small neighborhood pocket park & dirt shortcut near Home Base (Lantern Ln / Boylston edge)
    paintCircle(269, 434, 4, 3, TILE_IDS.PARK, (cur) => cur === TILE_IDS.GRASS);
    drawLine(base, width, height, 267, 436, 272, 433, TILE_IDS.DIRT, 0, (cur) => cur === TILE_IDS.PARK || cur === TILE_IDS.GRASS);
  }

  // 5. Natural sandy beaches & shorelines along lakes & ponds (Crystal Lake, Hammond Pond, etc.)
  const waterSnapshot = base.slice();
  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const idx = ty * width + tx;
      const cur = waterSnapshot[idx];
      if (cur !== TILE_IDS.GRASS && cur !== TILE_IDS.TALL_GRASS && cur !== TILE_IDS.PARK) continue;
      let waterNeighbors = 0;
      let southOrEastShore = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (waterSnapshot[(ty + dy) * width + (tx + dx)] === TILE_IDS.WATER) {
            waterNeighbors++;
            if (dy <= 0) southOrEastShore = true; // land sits south of water -> sunlit beach
          }
        }
      }
      if (waterNeighbors >= 2 || (waterNeighbors === 1 && southOrEastShore && ((tx * 7 + ty * 13) % 3 !== 0))) {
        base[idx] = TILE_IDS.SAND;
      }
    }
  }
  // Slightly wider 2-tile sandy beach cove on sunlit south shore of major lakes
  const sandSnapshot = base.slice();
  for (let ty = 2; ty < height - 2; ty++) {
    for (let tx = 2; tx < width - 2; tx++) {
      const idx = ty * width + tx;
      const cur = sandSnapshot[idx];
      if (cur !== TILE_IDS.GRASS && cur !== TILE_IDS.PARK) continue;
      if (
        sandSnapshot[(ty - 1) * width + tx] === TILE_IDS.SAND &&
        sandSnapshot[(ty - 2) * width + tx] === TILE_IDS.WATER &&
        ((tx * 5 + ty * 11) % 2 === 0)
      ) {
        base[idx] = TILE_IDS.SAND;
      }
    }
  }

  // 6. Enrich every building with refined kind & architectural style (12 residential architectures + 13 building kinds!)
  const villageCenters =
    width === 512 && height === 512
      ? [
          { cx: 256, cy: 238, r: 28 }, // Newton Centre Square (Centre St / Beacon St / Langley Rd)
          { cx: 74, cy: 388, r: 16 },  // Newton Highlands Village (Lincoln St / Walnut St)
          { cx: 486, cy: 408, r: 22 }, // Chestnut Hill / Route 9 Commercial Corridor
        ]
      : [];
  const villageShopKinds = ["bakery_cafe", "corner_market", "commercial", "office_plaza"];

  const buildings = (worldMap.buildings || []).map((b) => {
    const next = { ...b };
    if (next.isHomeBase) {
      next.kind = "house";
      next.arch = "colonial";
      return next;
    }

    const lowerAddr = String(next.address || "").toLowerCase();
    const lowerName = String(next.name || "").toLowerCase();

    // Boston College (BC) Newton Campus, Upper Campus & Messina College school buildings!
    const isBcCampusBuilding =
      lowerName.includes("boston college") ||
      lowerName.includes("bc law") ||
      lowerName.includes("bc ") ||
      lowerName.includes("cushing hall") ||
      lowerName.includes("hardey house") ||
      lowerName.includes("barat house") ||
      lowerName.includes("duchesne") ||
      lowerName.includes("stuart hall") ||
      lowerName.includes("stuart commons") ||
      lowerName.includes("keyes") ||
      lowerName.includes("mary house") ||
      lowerName.includes("trinity chapel") ||
      lowerName.includes("medeiros") ||
      lowerName.includes("claver") ||
      lowerName.includes("more hall") ||
      lowerAddr.includes("885 centre") ||
      lowerAddr.includes("855 centre") ||
      lowerAddr.includes("300 hammond pond") ||
      lowerAddr.includes("60 tudor") ||
      lowerAddr.includes("40;42;44;46 tudor");

    // Newton Cemetery Gothic Chapel & Mausoleum Crypts (791 Walnut St)
    if (next.id === "osm_214738001") {
      next.kind = "civic";
      next.name = "Newton Cemetery Chapel";
      next.address = "791 Walnut Street";
      next.gothicCrypt = true;
    } else if (next.id === "osm_214738698" || next.id === "osm_214739197") {
      next.name = next.name || "Stone Mausoleum";
      next.gothicCrypt = true;
    } else if (isBcCampusBuilding) {
      next.bcCampus = true;
      if (lowerName.includes("library")) {
        next.kind = "library";
      } else if (lowerName.includes("chapel")) {
        next.kind = "civic";
      } else {
        next.kind = "school";
        if (next.id === "osm_29779641") next.name = "BC Keyes Hall";
        if (next.id === "osm_29887382") next.name = "BC Messina College";
        if (next.id === "osm_29779950") next.name = "BC Medeiros Hall";
        if (next.id === "osm_29779724") next.name = "BC More Hall";
      }
    } else if (
      // Exact Newton landmark building kinds (Fire Stations, Bakeries, Bookshops, Medical Plazas)
      lowerAddr.includes("1164 centre") ||
      lowerAddr.includes("31 willow") ||
      lowerName.includes("fire")
    ) {
      next.kind = "fire_station";
    } else if (
      lowerAddr.includes("1280 centre") ||
      lowerAddr.includes("46 langley") ||
      lowerAddr.includes("940 boylston")
    ) {
      next.kind = "bakery_cafe";
    } else if (lowerAddr.includes("10 langley") || lowerAddr.includes("27 lincoln")) {
      next.kind = "corner_market";
    } else if (next.kind === "house" || !next.kind) {
      const inferredKind = classifyBuildingKind({}, next.bounds, next.address, next.name);
      next.kind = inferredKind;
    }

    // Keep residential homes strictly residential! Only refine buildings already tagged commercial
    // (or real village-square storefronts) so residential streets never get fake cafes or office plazas.
    if (next.bounds && (next.kind === "commercial" || next.kind === "garage")) {
      const bCx = Math.floor((next.bounds.minX + next.bounds.maxX) / 2);
      const bCy = Math.floor((next.bounds.minY + next.bounds.maxY) / 2);
      const bHash = hashString(next.id || next.address || `${bCx}_${bCy}`);

      if (next.kind === "commercial") {
        const inVillage = villageCenters.some((vc) => Math.hypot(bCx - vc.cx, bCy - vc.cy) <= vc.r);
        if (inVillage) {
          next.kind = villageShopKinds[bHash % villageShopKinds.length];
        }
      } else if (next.kind === "garage" && bHash % 7 === 0) {
        // Turn occasional sunny yard/park-edge outbuildings into charming glass greenhouses!
        let nearParkOrGrass = false;
        for (let dy = -3; dy <= 3 && !nearParkOrGrass; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = bCx + dx;
            const ny = bCy + dy;
            if (inBounds(nx, ny, width, height) && (base[ny * width + nx] === TILE_IDS.PARK || base[ny * width + nx] === TILE_IDS.TALL_GRASS)) {
              nearParkOrGrass = true;
              break;
            }
          }
        }
        if (nearParkOrGrass || bHash % 14 === 0) {
          next.kind = "greenhouse";
        }
      }
    }

    if (next.kind === "house") {
      next.arch = classifyHouseArch({
        id: next.id,
        address: next.address,
        bounds: next.bounds,
        isHomeBase: false,
      });
    } else {
      delete next.arch;
    }
    return next;
  });

  // 6b. Simplify busy micro-bends/kinks on roads & paths, de-bloat crosswalk swamps,
  //     eliminate diagonal road pinches, repair severed street mouths, widen straight
  //     residential streets, prioritize Newton Centre proper roads, slim overgrown sidewalks,
  //     regularize house footprints, and place dead-straight highway median barriers.
  simplifyGridPaths(base, width, height);
  normalizeCrosswalkBlobs(base, width, height);
  eliminateDiagonalRoadPinches(base, width, height);
  repairStreetConnectivity(base, streetZones, width, height);

  const protectedTiles = [];
  if (worldMap.origin?.spawnTile) {
    protectedTiles.push({ x: worldMap.origin.spawnTile.x, y: worldMap.origin.spawnTile.y, radius: 1 });
  }
  const landmarksPath = path.resolve(process.cwd(), "data", "landmarks.json");
  if (width === 512 && height === 512 && fs.existsSync(landmarksPath)) {
    try {
      const lms = JSON.parse(fs.readFileSync(landmarksPath, "utf8"));
      if (Array.isArray(lms)) {
        for (const lm of lms) {
          if (typeof lm.tileX === "number" && typeof lm.tileY === "number") {
            protectedTiles.push({ x: lm.tileX, y: lm.tileY, radius: 1 });
          }
        }
      }
    } catch {
      // ignore if landmarks.json is absent or malformed
    }
  }

  widenResidentialStreets(base, width, height, protectedTiles);
  prioritizeNewtonCentreRoads(base, width, height);
  eliminateDiagonalRoadPinches(base, width, height);
  enforceContinuousRoadSidewalks(base, width, height);

  slimOversizedSidewalks(base, width, height, protectedTiles);
  enforceContinuousRoadSidewalks(base, width, height);

  // 6c. Restore & add Boston College Newton Campus academic school buildings on the 512x512 map
  //     AFTER road/sidewalk slimming so crisp, path-safe Collegiate Gothic school buildings always stamp cleanly!
  if (width === 512 && height === 512) {
    const isBlockedBcTile = (t) =>
      t === TILE_IDS.RESIDENTIAL_ROAD ||
      t === TILE_IDS.MAIN_ROAD ||
      t === TILE_IDS.CROSSWALK ||
      t === TILE_IDS.HIGHWAY ||
      t === TILE_IDS.HIGHWAY_MEDIAN ||
      t === TILE_IDS.WATER ||
      t === TILE_IDS.DIRT;
    const isDrivableRoadTile = (t) =>
      t === TILE_IDS.RESIDENTIAL_ROAD || t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.HIGHWAY;

    const bcCampusSpecs = [
      {
        id: "bc_law_stuart_west",
        houseNumber: "885",
        street: "Centre Street",
        address: "885 Centre Street",
        name: "BC Law — Stuart Hall",
        kind: "school",
        bcCampus: true,
        isHomeBase: false,
        styleIndex: 3,
        bounds: { minX: 245, minY: 14, maxX: 251, maxY: 22 },
      },
      {
        id: "bc_law_stuart_commons",
        houseNumber: "885",
        street: "Centre Street",
        address: "885 Centre Street",
        name: "BC Law — Stuart Commons",
        kind: "school",
        bcCampus: true,
        isHomeBase: false,
        styleIndex: 3,
        bounds: { minX: 257, minY: 17, maxX: 261, maxY: 24 },
      },
      {
        id: "bc_law_east_wing",
        houseNumber: "885",
        street: "Centre Street",
        address: "885 Centre Street",
        name: "BC Law — East Wing",
        kind: "school",
        bcCampus: true,
        isHomeBase: false,
        styleIndex: 3,
        bounds: { minX: 262, minY: 27, maxX: 269, maxY: 29 },
      },
      {
        id: "bc_duchesne_hall",
        houseNumber: "885",
        street: "Centre Street",
        address: "885 Centre Street",
        name: "BC Duchesne Hall",
        kind: "school",
        bcCampus: true,
        isHomeBase: false,
        styleIndex: 3,
        bounds: { minX: 226, minY: 9, maxX: 231, maxY: 16 },
      },
      {
        id: "bc_trinity_chapel_nave",
        houseNumber: "885",
        street: "Centre Street",
        address: "885 Centre Street",
        name: "BC Trinity Chapel",
        kind: "civic",
        bcCampus: true,
        isHomeBase: false,
        styleIndex: 3,
        bounds: { minX: 263, minY: 1, maxX: 266, maxY: 6 },
      },
    ];

    const existingIds = new Set(buildings.map((b) => b.id));
    for (const spec of bcCampusSpecs) {
      const { minX, minY, maxX, maxY } = spec.bounds;
      let canStamp = true;
      for (let y = minY; y <= maxY && canStamp; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (!inBounds(x, y, width, height) || isBlockedBcTile(base[y * width + x])) {
            canStamp = false;
            break;
          }
          // Ensure no drivable road touches the new building footprint (continuous sidewalk invariant)
          for (let dy = -1; dy <= 1 && canStamp; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx;
              const ny = y + dy;
              if (inBounds(nx, ny, width, height) && isDrivableRoadTile(base[ny * width + nx])) {
                canStamp = false;
                break;
              }
            }
          }
        }
      }
      if (!canStamp) continue;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          base[y * width + x] = TILE_IDS.BUILDING_WALL;
        }
      }
      if (!existingIds.has(spec.id)) {
        buildings.push(spec);
        existingIds.add(spec.id);
      }
    }
  }

  const baseTightBuildings = tightenBuildingBoundsToWalls(buildings, base, width, height);
  const enlargedBuildings = enlargeBuildingFootprints(
    baseTightBuildings,
    base,
    width,
    height,
    protectedTiles
  );
  const tightenedBuildings = tightenBuildingBoundsToWalls(enlargedBuildings, base, width, height);

  // Clear any leftover unowned orphan BUILDING_WALL tiles inside BC Newton Campus & Newton Centre proper
  // so no invisible solid wall blocks the player walking across BC Law's quad or newly widened village roads!
  if (width === 512 && height === 512) {
    const bcCovered = new Uint8Array(width * height);
    for (const b of tightenedBuildings) {
      if (!b.bounds) continue;
      for (let y = b.bounds.minY; y <= b.bounds.maxY; y++) {
        for (let x = b.bounds.minX; x <= b.bounds.maxX; x++) {
          if (inBounds(x, y, width, height)) bcCovered[y * width + x] = 1;
        }
      }
    }
    for (let y = 0; y <= 31; y++) {
      for (let x = 235; x <= 292; x++) {
        const idx = y * width + x;
        if (base[idx] === TILE_IDS.BUILDING_WALL && bcCovered[idx] === 0) {
          base[idx] = TILE_IDS.GRASS;
        }
      }
    }
    for (let y = 199; y <= 288; y++) {
      for (let x = 212; x <= 316; x++) {
        const idx = y * width + x;
        if (base[idx] === TILE_IDS.BUILDING_WALL && bcCovered[idx] === 0) {
          base[idx] = TILE_IDS.GRASS;
        }
      }
    }
  }

  applyHighwayMedianBarriers(base, width, height);

  // 7. Recompute collision cleanly and keep spawnTile walkable
  const collision = base.map((tileId) =>
    tileId === TILE_IDS.BUILDING_WALL ||
    tileId === TILE_IDS.WATER ||
    tileId === TILE_IDS.HIGHWAY_MEDIAN
      ? 1
      : 0
  );
  const spawn = worldMap.origin?.spawnTile;
  if (spawn && inBounds(spawn.x, spawn.y, width, height)) {
    const sIdx = spawn.y * width + spawn.x;
    if (collision[sIdx] === 1) {
      base[sIdx] = TILE_IDS.SIDEWALK;
      collision[sIdx] = 0;
    }
  }

  return {
    ...worldMap,
    legend: { ...LEGEND },
    layers: {
      base,
      collision,
    },
    buildings: tightenedBuildings,
  };
}

function parseCliArgs(argv) {
  const args = {
    offline: false,
    enrich: false,
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
    else if (a === "--enrich") args.enrich = true;
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
  if (args.enrich) {
    console.log(`Enriching existing ${args.out} with high-fidelity terrain & building varieties...`);
    const existing = JSON.parse(fs.readFileSync(args.out, "utf8"));
    worldMap = enrichWorldMap(existing);
  } else if (args.offline) {
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
