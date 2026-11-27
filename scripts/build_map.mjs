#!/usr/bin/env node
/**
 * Cross-platform OpenStreetMap -> RPG Tile Grid CLI (world_map.json).
 * Re-exports the shared pure-JS rasterizer from src/generator/rasterizer.js
 * and adds Node disk caching + CLI flags.
 */

import dns from "node:dns";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { extractVectorRoadsFromOsm } from "../src/vector_roads.js";
import { isNewtonCentreMap } from "../src/neighborhood_meta.js";
import {
  TILE_IDS,
  LEGEND,
  HOUSE_ARCH_TYPES,
  DEFAULT_CONFIG,
  projectLatLonToTile,
  computeBoundingBox,
  classifyBuildingKind,
  classifyHouseArch,
  simplifyRoadPolyline,
  straightenResidentialRoadChains,
  widenResidentialStreets,
  straightenMajorRoadBands,
  simplifyGridPaths,
  regularizeRoadShapes,
  sanitizeRoadHierarchy,
  carveCommonwealthCarriageway,
  repairStreetConnectivity,
  eliminateDiagonalRoadPinches,
  normalizeCrosswalkBlobs,
  validateAndCleanCrosswalks,
  prioritizeNewtonCentreRoads,
  enforceContinuousRoadSidewalks,
  slimOversizedSidewalks,
  tightenBuildingBoundsToWalls,
  enlargeBuildingFootprints,
  applyHighwayMedianBarriers,
  extractGraveyardsFromOsm,
  rasterizeOsmData,
  buildOfflineMap,
  enrichWorldMap as enrichWorldMapCore,
} from "../src/generator/rasterizer.js";

export {
  TILE_IDS,
  LEGEND,
  HOUSE_ARCH_TYPES,
  DEFAULT_CONFIG,
  projectLatLonToTile,
  computeBoundingBox,
  classifyBuildingKind,
  classifyHouseArch,
  simplifyRoadPolyline,
  straightenResidentialRoadChains,
  widenResidentialStreets,
  straightenMajorRoadBands,
  simplifyGridPaths,
  regularizeRoadShapes,
  sanitizeRoadHierarchy,
  carveCommonwealthCarriageway,
  repairStreetConnectivity,
  eliminateDiagonalRoadPinches,
  normalizeCrosswalkBlobs,
  validateAndCleanCrosswalks,
  prioritizeNewtonCentreRoads,
  enforceContinuousRoadSidewalks,
  slimOversizedSidewalks,
  tightenBuildingBoundsToWalls,
  enlargeBuildingFootprints,
  applyHighwayMedianBarriers,
  extractGraveyardsFromOsm,
  rasterizeOsmData,
  buildOfflineMap,
};

dns.setDefaultResultOrder("ipv4first");

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export function enrichWorldMap(worldMap, opts = {}) {
  const extraProtectedTiles = [...(opts.extraProtectedTiles || [])];
  const { width, height } = worldMap.dimensions || {};
  const landmarksPath = path.resolve(process.cwd(), "data", "landmarks.json");
  if (isNewtonCentreMap(worldMap) && width === 512 && height === 512 && fs.existsSync(landmarksPath)) {
    try {
      const lms = JSON.parse(fs.readFileSync(landmarksPath, "utf8"));
      if (Array.isArray(lms)) {
        for (const lm of lms) {
          if (typeof lm.tileX === "number" && typeof lm.tileY === "number") {
            extraProtectedTiles.push({ x: lm.tileX, y: lm.tileY, radius: 1 });
          }
        }
      }
    } catch {
      // ignore if landmarks.json is absent or malformed
    }
  }
  return enrichWorldMapCore(worldMap, { ...opts, extraProtectedTiles });
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
 * Fetch complete raw OpenStreetMap elements via the official OSM API v0.6 tiled bbox endpoint.
 * Fast, globally portable, and avoids Overpass gateway timeouts when splitting into ~600m tiles.
 */
async function fetchOsmApiGrid(bbox, gridMeters) {
  const cacheKey = `${bbox.south.toFixed(5)}_${bbox.west.toFixed(5)}_${bbox.north.toFixed(5)}_${bbox.east.toFixed(5)}`;
  const cacheDir = path.join(os.tmpdir(), "neighborhood_explorer_osm_api_cache_v1");
  const cacheFile = path.join(cacheDir, `${cacheKey}.json`);
  if (fs.existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      if (Array.isArray(cached) && cached.length > 0) {
        console.log(`Using cached OSM API grid (${cached.length} features)`);
        return cached;
      }
    } catch {
      // Ignore corrupt cache
    }
  }

  // Also reuse local temp full-OSM cache if present for matching Newton bbox
  const quickCache = path.join(os.tmpdir(), "newton_osm_full.json");
  if (
    Math.abs(bbox.south - 42.3154) < 0.001 &&
    Math.abs(bbox.north - 42.343) < 0.001 &&
    fs.existsSync(quickCache)
  ) {
    try {
      const cached = JSON.parse(fs.readFileSync(quickCache, "utf8"));
      if (Array.isArray(cached) && cached.length > 0) {
        console.log(`Using pre-fetched Newton OSM cache (${cached.length} features)`);
        return cached;
      }
    } catch {
      // Ignore
    }
  }

  const tilesPerSide = gridMeters > 2400 ? 5 : gridMeters > 1400 ? 3 : 2;
  const total = tilesPerSide * tilesPerSide;
  const latStep = (bbox.north - bbox.south) / tilesPerSide;
  const lonStep = (bbox.east - bbox.west) / tilesPerSide;
  const dedup = new Map();

  let n = 0;
  for (let r = 0; r < tilesPerSide; r++) {
    for (let c = 0; c < tilesPerSide; c++) {
      n++;
      const s = bbox.south + r * latStep;
      const north = bbox.south + (r + 1) * latStep;
      const w = bbox.west + c * lonStep;
      const e = bbox.west + (c + 1) * lonStep;
      const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${w.toFixed(6)},${s.toFixed(6)},${e.toFixed(6)},${north.toFixed(6)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "NeighborhoodExplorerRPG/0.1 (educational kid RPG project)",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`OSM API tile ${n}/${total} HTTP ${res.status}`);
      const data = await res.json();
      for (const el of data.elements || []) {
        dedup.set(`${el.type}:${el.id}`, el);
      }
      if (n % 5 === 0 || n === total) {
        console.log(`  OSM API tile ${n}/${total} done (${dedup.size} unique features)`);
      }
    }
  }

  const all = Array.from(dedup.values());
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(all), "utf8");
  return all;
}

/**
 * Automatically split large bounding boxes into ~1km x 1km Overpass tiles so
 * big neighborhood maps (e.g., 3km x 3km covering Home Base -> Newton Free Library)
 * fetch reliably without Overpass gateway timeouts, deduplicating elements by type+id.
 * Falls back cleanly to official OSM API v0.6 tiled grid if Overpass is overloaded.
 */
async function fetchOsmElements(bbox, gridMeters) {
  try {
    return await fetchOsmApiGrid(bbox, gridMeters);
  } catch (apiErr) {
    console.warn(`OSM API grid fetch failed (${apiErr.message}); falling back to Overpass API...`);
  }

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
    enrich: false,
    enrichRoads: false,
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
    else if (a === "--enrich-roads") args.enrichRoads = true;
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
  if (args.enrichRoads) {
    console.log(`Enriching ${args.out} with real-geometry OpenStreetMap HD vectorRoads...`);
    const existing = JSON.parse(fs.readFileSync(args.out, "utf8"));
    const mc = existing.mapCenter || existing.origin || config.mapCenter;
    const w = existing.dimensions.width;
    const h = existing.dimensions.height;
    const scale = existing.scaleMetersPerTile || config.scaleMetersPerTile;
    const bbox = computeBoundingBox(mc.lat, mc.lon, w, h, scale);
    const gridMeters = Math.max(w, h) * scale;
    const elements = await fetchOsmElements(bbox, gridMeters);
    const vectorRoads = extractVectorRoadsFromOsm(elements, {
      width: w,
      height: h,
      mapCenter: mc,
      origin: existing.origin,
      scaleMetersPerTile: scale,
    });
    console.log(
      `Extracted vectorRoads: ${vectorRoads.roads.length} road polylines, ${vectorRoads.crosswalks.length} angled crosswalks, ${vectorRoads.turningCircles.length} cul-de-sacs, ${vectorRoads.medians.length} divided-highway medians`
    );
    worldMap = {
      ...existing,
      vectorRoads,
    };
  } else if (args.enrich) {
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

