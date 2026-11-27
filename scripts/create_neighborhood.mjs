#!/usr/bin/env node
/**
 * One-Command Neighborhood Explorer Packager (Cross-Platform ESM).
 *
 * Uses the exact same pure-JS generator core (`src/generator/pack_builder.js`)
 * as the in-browser "Build My Neighborhood" Studio so CLI-generated packs and
 * browser-generated packs are 100% interchangeable!
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
  SIZE_PRESETS,
  buildNeighborhoodPackage,
} from "../src/generator/pack_builder.js";

export { SIZE_PRESETS, buildNeighborhoodPackage };

dns.setDefaultResultOrder("ipv4first");

export function parseCreateArgs(argv) {
  const args = {
    address: "",
    lat: null,
    lon: null,
    hero: "Explorer",
    town: "",
    biome: "auto",
    labelMode: "bilingual",
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
    else if (a === "--biome" && argv[i + 1]) args.biome = String(argv[++i]).toLowerCase();
    else if (a === "--labels" && argv[i + 1]) args.labelMode = String(argv[++i]).toLowerCase();
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
  --biome <id|auto>        Regional biome preset (default: "auto"; e.g., israel_jerusalem, european_historic, tundra)
  --labels <mode>          Street & place label mode: bilingual (default) | en | local
  --size <preset>          walkable (256x256, ~20-40s, default) | standard (384x384) | full (512x512, ~1-2m)
  --width <n> --height <n> Optional custom tile dimensions (overrides --size)
  --scale <meters>         Real-world meters per 16px tile (default: 6)
  --places <file.json>     Optional JSON file with custom places & quests (see docs/examples/custom_places.example.json)
  --out-dir <dir>          Output directory (default: data/ — use e.g. packs/austin to keep Newton intact)
  --overpass               Prefer Overpass API mirrors over tiled OSM API
  --offline-fixture <file> Build from a saved local OSM JSON elements file (no network)
`);
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
    biome: args.biome,
    labelMode: args.labelMode,
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
