#!/usr/bin/env node
/**
 * One-Command Neighborhood Explorer Packager (Cross-Platform ESM).
 *
 * Give it ANY address in the country (plus optional custom places & goals) and it:
 *   1. Geocodes the address via OpenStreetMap Nominatim
 *   2. Downloads real roads, buildings, parks, water, trails, cemeteries & local POIs
 *   3. Rasterizes + enriches the playable SNES world map & HD vectorRoads
 *   4. Auto-discovers real nearby landmarks & builds tailored multi-step quests
 *   5. Writes world_map.json, landmarks.json, quests.json, house_colors.json,
 *      AND a portable neighborhood_pack.json bundle!
 *
 * Examples:
 *   npm run create:neighborhood -- --address "1204 Barton Springs Rd, Austin, TX" --hero "Maya"
 *   npm run create:neighborhood -- --address "1600 Pennsylvania Ave NW, Washington, DC" --size walkable --out-dir packs/dc
 *   npm run create:neighborhood -- --address "123 Main St, Portland, OR" --places my_places.json
 */

import dns from "node:dns";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DEFAULT_CONFIG,
  computeBoundingBox,
  rasterizeOsmData,
  enrichWorldMap,
} from "./build_map.mjs";
import { geocodeAddress } from "../src/generator/geocode.js";
import { fetchOsmDataForBbox } from "../src/generator/osm_fetch.js";
import { generateLandmarksAndQuests } from "../src/generator/poi_landmarks.js";
import { slugifyNeighborhood } from "../src/neighborhood_meta.js";

dns.setDefaultResultOrder("ipv4first");

export const SIZE_PRESETS = {
  walkable: { width: 256, height: 256, scale: 6, label: "Walkable (~0.95 mi × 0.95 mi)" },
  standard: { width: 384, height: 384, scale: 6, label: "Standard (~1.4 mi × 1.4 mi)" },
  full: { width: 512, height: 512, scale: 6, label: "Full Town (~1.9 mi × 1.9 mi)" },
};

export function parseCreateArgs(argv) {
  const args = {
    address: "",
    lat: null,
    lon: null,
    hero: "Explorer",
    town: "",
    size: "walkable",
    width: null,
    height: null,
    scale: 6,
    placesFile: "",
    outDir: path.resolve(process.cwd(), "data"),
    offlineFixture: "",
    preferOverpass: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--address" && argv[i + 1]) args.address = argv[++i];
    else if (a === "--lat" && argv[i + 1]) args.lat = Number(argv[++i]);
    else if (a === "--lon" && argv[i + 1]) args.lon = Number(argv[++i]);
    else if (a === "--hero" && argv[i + 1]) args.hero = argv[++i];
    else if (a === "--town" && argv[i + 1]) args.town = argv[++i];
    else if (a === "--size" && argv[i + 1]) args.size = String(argv[++i]).toLowerCase();
    else if (a === "--width" && argv[i + 1]) args.width = Number(argv[++i]);
    else if (a === "--height" && argv[i + 1]) args.height = Number(argv[++i]);
    else if (a === "--scale" && argv[i + 1]) args.scale = Number(argv[++i]);
    else if (a === "--places" && argv[i + 1]) args.placesFile = path.resolve(process.cwd(), argv[++i]);
    else if (a === "--out-dir" && argv[i + 1]) args.outDir = path.resolve(process.cwd(), argv[++i]);
    else if (a === "--offline-fixture" && argv[i + 1]) args.offlineFixture = path.resolve(process.cwd(), argv[++i]);
    else if (a === "--overpass") args.preferOverpass = true;
  }

  return args;
}

function printHelp() {
  console.log(`
Neighborhood Explorer — Universal Neighborhood Generator

Usage:
  npm run create:neighborhood -- --address "<street, city, state>" [options]

Options:
  --address "<str>"        Starting Home Base street address (geocoded automatically)
  --lat <num> --lon <num>  Optional explicit coordinates (skips address geocoding)
  --hero "<name>"          Kid / explorer name (default: "Explorer")
  --town "<name>"          Optional town display name override (e.g., "Austin, TX")
  --size <preset>          walkable (256x256, ~20-35s, default) | standard (384x384) | full (512x512, ~1-2m)
  --places <file.json>     Optional JSON file with custom places & quests (see docs/examples/custom_places.example.json)
  --out-dir <dir>          Output directory (default: data/ — use e.g. packs/austin to keep Newton intact)
  --overpass               Prefer Overpass API mirrors over tiled OSM API
  --offline-fixture <file> Build from a saved local OSM JSON elements file (no network)
`);
}

async function resolveCustomPlaces(rawConfig, { geocodeFn = geocodeAddress, townHint = "" } = {}) {
  const places = Array.isArray(rawConfig?.places)
    ? rawConfig.places
    : Array.isArray(rawConfig)
      ? rawConfig
      : [];
  const quests = Array.isArray(rawConfig?.quests) ? rawConfig.quests : [];
  const resolvedPlaces = [];

  for (const p of places) {
    if (!p || !p.name) continue;
    if (
      (typeof p.lat === "number" && typeof p.lon === "number") ||
      (typeof p.tileX === "number" && typeof p.tileY === "number")
    ) {
      resolvedPlaces.push(p);
      continue;
    }
    if (p.address) {
      const q = townHint && !p.address.includes(",") ? `${p.address}, ${townHint}` : p.address;
      console.log(`  Geocoding custom place "${p.name}" (${q})...`);
      try {
        const geo = await geocodeFn(q);
        resolvedPlaces.push({
          ...p,
          lat: geo.lat,
          lon: geo.lon,
          address: geo.homeAddress || p.address,
        });
        // Polite 1s Nominatim spacing between requests
        await new Promise((r) => setTimeout(r, 1100));
      } catch (err) {
        console.warn(`  Warning: could not geocode custom place "${p.name}": ${err.message}`);
      }
    }
  }

  return { places: resolvedPlaces, quests };
}

/**
 * Programmatic neighborhood package generator (used by CLI & tests).
 */
export async function buildNeighborhoodPackage({
  address = "",
  lat = null,
  lon = null,
  heroName = "Explorer",
  townOverride = "",
  size = "walkable",
  width = null,
  height = null,
  scale = 6,
  customPlacesConfig = null,
  osmElements = null,
  geocodeFn = geocodeAddress,
  fetchOsmFn = fetchOsmDataForBbox,
  onProgress = null,
  preferOverpass = false,
} = {}) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.walkable;
  const gridW = width || preset.width;
  const gridH = height || preset.height;
  const gridScale = scale || preset.scale;

  let geo = null;
  if (typeof lat === "number" && Number.isFinite(lat) && typeof lon === "number" && Number.isFinite(lon)) {
    const cleanAddr = address || "Home Base";
    const town = townOverride || "Your Neighborhood";
    geo = {
      lat,
      lon,
      homeAddress: cleanAddr,
      townName: town,
      cityShort: town.split(",")[0].trim() || "Town",
    };
  } else {
    onProgress?.({ stage: "geocode", completed: 0, total: 1, message: `Looking up "${address}"...` });
    geo = await geocodeFn(address);
    if (townOverride) {
      geo.townName = townOverride;
      geo.cityShort = townOverride.split(",")[0].trim() || geo.cityShort;
    }
    onProgress?.({
      stage: "geocode",
      completed: 1,
      total: 1,
      message: `Found ${geo.homeAddress} in ${geo.townName} (${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)})`,
    });
  }

  const meta = {
    id: slugifyNeighborhood(`${geo.homeAddress}_${geo.townName}`),
    preset: "generic",
    townName: geo.townName,
    cityShort: geo.cityShort,
    homeAddress: geo.homeAddress,
    heroName: heroName || "Explorer",
    generatedAt: new Date().toISOString(),
  };

  const config = {
    tileSize: DEFAULT_CONFIG.tileSize,
    scaleMetersPerTile: gridScale,
    width: gridW,
    height: gridH,
    origin: {
      lat: geo.lat,
      lon: geo.lon,
      address: geo.homeAddress,
      name: `Home Base (${geo.homeAddress})`,
    },
    mapCenter: { lat: geo.lat, lon: geo.lon },
    meta,
  };

  const bbox = computeBoundingBox(geo.lat, geo.lon, gridW, gridH, gridScale);
  const gridMeters = Math.max(gridW, gridH) * gridScale;

  const elements =
    Array.isArray(osmElements)
      ? osmElements
      : await fetchOsmFn(bbox, { gridMeters, onProgress, preferOverpass });

  onProgress?.({
    stage: "rasterize",
    completed: 0,
    total: 2,
    message: `Rasterizing ${elements.length.toLocaleString()} real-world features into ${gridW}×${gridH} tiles...`,
  });

  const rawMap = rasterizeOsmData(elements, config);
  const worldMap = enrichWorldMap(rawMap);

  onProgress?.({
    stage: "rasterize",
    completed: 1,
    total: 2,
    message: "Discovering local landmarks & creating starter quests...",
  });

  const resolvedCustom = customPlacesConfig
    ? await resolveCustomPlaces(customPlacesConfig, { geocodeFn, townHint: geo.townName })
    : { places: [], quests: [] };

  const { landmarks, quests } = generateLandmarksAndQuests({
    elements,
    worldMap,
    customPlaces: resolvedCustom.places,
    customQuests: resolvedCustom.quests,
    meta,
  });

  const houseColors = {
    _comment: `Custom house colors for ${geo.townName}. Paint houses in-game (press P) and export here!`,
  };

  onProgress?.({
    stage: "done",
    completed: 2,
    total: 2,
    message: `Ready! ${worldMap.buildings.length} buildings, ${landmarks.length} landmarks, ${quests.length} quests!`,
  });

  return {
    formatVersion: 1,
    meta,
    worldMap,
    landmarks,
    quests,
    houseColors,
  };
}

async function main() {
  const args = parseCreateArgs(process.argv.slice(2));
  if (args.help || (!args.address && (args.lat === null || args.lon === null))) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  let customPlacesConfig = null;
  if (args.placesFile) {
    customPlacesConfig = JSON.parse(fs.readFileSync(args.placesFile, "utf8"));
  }
  let osmElements = null;
  if (args.offlineFixture) {
    const raw = JSON.parse(fs.readFileSync(args.offlineFixture, "utf8"));
    osmElements = Array.isArray(raw) ? raw : raw.elements || [];
  }

  const presetInfo = SIZE_PRESETS[args.size] || SIZE_PRESETS.walkable;
  console.log(`\n🗺️  Neighborhood Explorer — Building custom neighborhood package`);
  console.log(`   Size: ${args.width || presetInfo.width}x${args.height || presetInfo.height} (${presetInfo.label})`);
  console.log(`   Hero: ${args.hero}`);
  console.log(`   Output: ${args.outDir}\n`);

  const pack = await buildNeighborhoodPackage({
    address: args.address,
    lat: args.lat,
    lon: args.lon,
    heroName: args.hero,
    townOverride: args.town,
    size: args.size,
    width: args.width,
    height: args.height,
    scale: args.scale,
    customPlacesConfig,
    osmElements,
    preferOverpass: args.preferOverpass,
    onProgress: (ev) => {
      console.log(`  [${ev.stage}] ${ev.message}`);
    },
  });

  fs.mkdirSync(args.outDir, { recursive: true });
  fs.writeFileSync(path.join(args.outDir, "world_map.json"), JSON.stringify(pack.worldMap), "utf8");
  fs.writeFileSync(path.join(args.outDir, "landmarks.json"), JSON.stringify(pack.landmarks, null, 2), "utf8");
  fs.writeFileSync(path.join(args.outDir, "quests.json"), JSON.stringify(pack.quests, null, 2), "utf8");
  fs.writeFileSync(path.join(args.outDir, "house_colors.json"), JSON.stringify(pack.houseColors, null, 2), "utf8");
  fs.writeFileSync(path.join(args.outDir, "neighborhood_pack.json"), JSON.stringify(pack), "utf8");

  console.log(`\n✅ Built neighborhood package for ${pack.meta.homeAddress} (${pack.meta.townName})!`);
  console.log(`   • Buildings:  ${pack.worldMap.buildings.length}`);
  console.log(`   • Roads:      ${pack.worldMap.vectorRoads?.roads?.length || 0} vector segments`);
  console.log(`   • Graveyards: ${(pack.worldMap.graveyards || []).length}`);
  console.log(`   • Landmarks:  ${pack.landmarks.length}`);
  console.log(`   • Quests:     ${pack.quests.length}`);
  console.log(`   • Files written to: ${args.outDir}\n`);
  console.log(`Next step: run "npm run dev" to play immediately, or "npm run build" to deploy!\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`\n❌ Failed to build neighborhood: ${err.message}\n`);
    process.exit(1);
  });
}
