import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  isNewtonCentreMap,
  getNeighborhoodMeta,
  parseAddressParts,
  LEGACY_SAVE_STORAGE_KEY,
  LEGACY_HOUSE_COLORS_STORAGE_KEY,
} from "../src/neighborhood_meta.js";
import {
  rasterizeOsmData,
  enrichWorldMap,
  extractGraveyardsFromOsm,
  TILE_IDS,
} from "../scripts/build_map.mjs";
import { getGraveyardZones, buildGraveyardFeatures } from "../src/graveyards.js";
import { buildParkFeatures } from "../src/parks.js";
import { createQuestSystem, getItemMeta } from "../src/quests.js";
import { createHomeInteriorSystem } from "../src/house_interior.js";
import { buildStreetLife, interactWithStreetLife } from "../src/streetlife.js";

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    keys: () => [...store.keys()],
  };
}

function buildSyntheticAustinOsm() {
  const originLat = 30.2615;
  const originLon = -97.7625;
  return {
    config: {
      width: 128,
      height: 128,
      tileSize: 16,
      scaleMetersPerTile: 6,
      origin: {
        lat: originLat,
        lon: originLon,
        name: "Home Base (1204 Barton Springs Rd)",
        address: "1204 Barton Springs Rd",
      },
      mapCenter: { lat: originLat, lon: originLon },
      meta: {
        preset: "generic",
        townName: "Austin, TX",
        cityShort: "Austin",
        homeAddress: "1204 Barton Springs Rd",
        heroName: "Maya",
      },
    },
    elements: [
      // Main road running E-W just south of origin
      {
        type: "way",
        id: 1001,
        tags: { highway: "residential", name: "Barton Springs Road" },
        geometry: [
          { lat: originLat - 0.0004, lon: originLon - 0.0025 },
          { lat: originLat - 0.0004, lon: originLon + 0.0025 },
        ],
      },
      // Cross street running N-S
      {
        type: "way",
        id: 1002,
        tags: { highway: "residential", name: "Lamar Boulevard" },
        geometry: [
          { lat: originLat - 0.0022, lon: originLon + 0.0008 },
          { lat: originLat + 0.0022, lon: originLon + 0.0008 },
        ],
      },
      // Home Base house at 1204 Barton Springs Rd
      {
        type: "way",
        id: 2001,
        tags: {
          building: "house",
          "addr:housenumber": "1204",
          "addr:street": "Barton Springs Rd",
        },
        geometry: [
          { lat: originLat + 0.00005, lon: originLon - 0.0001 },
          { lat: originLat + 0.00005, lon: originLon + 0.00015 },
          { lat: originLat + 0.00025, lon: originLon + 0.00015 },
          { lat: originLat + 0.00025, lon: originLon - 0.0001 },
          { lat: originLat + 0.00005, lon: originLon - 0.0001 },
        ],
      },
      // Real OSM cemetery in the NE quadrant
      {
        type: "way",
        id: 3001,
        tags: {
          landuse: "cemetery",
          name: "Oakwood Cemetery",
          start_date: "1839",
        },
        geometry: [
          { lat: originLat + 0.0010, lon: originLon + 0.0012 },
          { lat: originLat + 0.0010, lon: originLon + 0.0022 },
          { lat: originLat + 0.0020, lon: originLon + 0.0022 },
          { lat: originLat + 0.0020, lon: originLon + 0.0012 },
          { lat: originLat + 0.0010, lon: originLon + 0.0012 },
        ],
      },
      // Real OSM park in the NW quadrant
      {
        type: "way",
        id: 4001,
        tags: {
          leisure: "park",
          name: "Zilker Neighborhood Park",
        },
        geometry: [
          { lat: originLat + 0.0008, lon: originLon - 0.0024 },
          { lat: originLat + 0.0008, lon: originLon - 0.0012 },
          { lat: originLat + 0.0020, lon: originLon - 0.0012 },
          { lat: originLat + 0.0020, lon: originLon - 0.0024 },
          { lat: originLat + 0.0008, lon: originLon - 0.0024 },
        ],
      },
    ],
  };
}

test("neighborhood metadata preserves legacy Newton Centre defaults and isolates custom cities", () => {
  const newtonMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  assert.equal(isNewtonCentreMap(newtonMap), true);
  const newtonMeta = getNeighborhoodMeta(newtonMap);
  assert.equal(newtonMeta.isNewton, true);
  assert.equal(newtonMeta.homeAddress, "565 Boylston St");
  assert.equal(newtonMeta.townName, "Newton Centre");
  assert.equal(newtonMeta.heroName, "Liam");
  assert.equal(newtonMeta.saveStorageKey, LEGACY_SAVE_STORAGE_KEY);
  assert.equal(newtonMeta.houseColorsStorageKey, LEGACY_HOUSE_COLORS_STORAGE_KEY);

  const customMap = {
    origin: { lat: 30.2615, lon: -97.7625, name: "Home Base (1204 Barton Springs Rd)" },
    meta: {
      preset: "generic",
      townName: "Austin, TX",
      cityShort: "Austin",
      homeAddress: "1204 Barton Springs Rd",
      heroName: "Maya",
    },
  };
  assert.equal(isNewtonCentreMap(customMap), false);
  const customMeta = getNeighborhoodMeta(customMap);
  assert.equal(customMeta.isNewton, false);
  assert.equal(customMeta.homeAddress, "1204 Barton Springs Rd");
  assert.equal(customMeta.cityShort, "Austin");
  assert.equal(customMeta.heroName, "Maya");
  assert.notEqual(customMeta.saveStorageKey, LEGACY_SAVE_STORAGE_KEY);
  assert.notEqual(customMeta.houseColorsStorageKey, LEGACY_HOUSE_COLORS_STORAGE_KEY);

  assert.deepEqual(parseAddressParts("1204 Barton Springs Rd"), {
    houseNumber: "1204",
    streetToken: "barton springs",
  });
});

test("OSM rasterizer builds any US city cleanly, tags custom Home Base, and extracts real OSM cemeteries", () => {
  const { config, elements } = buildSyntheticAustinOsm();
  const austinMap = rasterizeOsmData(elements, config);

  assert.equal(isNewtonCentreMap(austinMap), false);
  const home = austinMap.buildings.find((b) => b.isHomeBase);
  assert.ok(home, "Home Base building should be identified");
  assert.equal(home.address, "1204 Barton Springs Rd");
  assert.ok(!home.address.includes("565 Boylston"), "Never stamp Newton address on non-Newton map");

  // Auto-extracted OSM cemetery
  assert.ok(Array.isArray(austinMap.graveyards), "graveyards array should be attached");
  assert.equal(austinMap.graveyards.length, 1);
  assert.equal(austinMap.graveyards[0].name, "Oakwood Cemetery");
  assert.equal(austinMap.graveyards[0].founded, 1839);

  // Graveyard runtime uses extracted OSM cemetery (never Newton fallbacks!)
  const zones = getGraveyardZones(austinMap);
  assert.equal(zones.length, 1);
  assert.equal(zones[0].name, "Oakwood Cemetery");
  const graveFeatures = buildGraveyardFeatures(austinMap);
  assert.ok(graveFeatures.props.length > 0, "Extracted OSM cemetery populates tombstones/props");

  // Park runtime populates parks cleanly without Newton hardcodes
  const parks = buildParkFeatures(austinMap, graveFeatures.graveyardGrid);
  assert.ok(parks.occupiedGrid.length === 128 * 128);

  // Enriching a non-Newton map stays clean and never injects Newton BC campus halls
  const enriched = enrichWorldMap(austinMap);
  assert.equal(
    enriched.buildings.some((b) => b.bcCampus),
    false,
    "Non-Newton enriched maps never inject Boston College halls"
  );
});

test("non-Newton 512x512 map with no cemeteries gets zero hardcoded Newton graveyards", () => {
  const empty512 = {
    dimensions: { width: 512, height: 512 },
    origin: { lat: 39.7392, lon: -104.9903, name: "Home Base (100 Colfax Ave)" },
    meta: { preset: "generic", townName: "Denver, CO", homeAddress: "100 Colfax Ave" },
    layers: {
      base: new Array(512 * 512).fill(TILE_IDS.GRASS),
      collision: new Array(512 * 512).fill(0),
    },
    buildings: [],
    streetZones: [],
  };
  assert.deepEqual(getGraveyardZones(empty512), []);
});

test("quest system, home interior, and streetlife adapt cleanly to custom neighborhoods with isolated saves", () => {
  const { config, elements } = buildSyntheticAustinOsm();
  const austinMap = rasterizeOsmData(elements, config);
  const storage = createMemoryStorage();

  const landmarks = [
    {
      id: "home_base",
      name: "Maya's House (1204 Barton Springs Rd)",
      tileX: austinMap.origin.spawnTile.x,
      tileY: austinMap.origin.spawnTile.y,
      npcName: "Mom",
      healHearts: 5,
      dialogue: ["Welcome home, Maya!"],
    },
    {
      id: "barton_tacos",
      name: "Barton Springs Taco Stand",
      tileX: austinMap.origin.spawnTile.x + 4,
      tileY: austinMap.origin.spawnTile.y,
      npcName: "Chef Rosa",
      healHearts: 2,
      givesSnacks: true,
      dialogue: ["Have a warm breakfast taco!"],
      rewardItem: "austin_breakfast_taco",
      rewardItemMeta: {
        name: "Austin Breakfast Taco",
        icon: "🌮",
        sprite: "item_challah",
        desc: "Warm neighborhood taco from Barton Springs!",
      },
    },
  ];

  const qs = createQuestSystem({
    landmarks,
    quests: [],
    worldMap: austinMap,
    storage,
  });

  // Dynamic item metadata registered cleanly
  assert.equal(getItemMeta("austin_breakfast_taco").name, "Austin Breakfast Taco");

  // Save slot is isolated from Newton's legacy key
  qs.useSnack();
  const interactRes = qs.interactWithNpc("barton_tacos");
  assert.ok(interactRes.gainedSnacks > 0, "Custom snack landmark restocks snacks");
  assert.ok(storage.keys().length > 0);
  assert.equal(storage.getItem(LEGACY_SAVE_STORAGE_KEY), null, "Must not overwrite Newton save slot");

  // Home interior adapts to 1204 Barton Springs Rd & Austin
  const interior = createHomeInteriorSystem(qs, { worldMap: austinMap });
  const entered = interior.enterHouse(100, 100);
  assert.ok(entered.room.name.includes("1204 BARTON SPRINGS RD"));
  const exitProp = interior.getRoomInteractables().find((p) => p.id === "exit_door");
  assert.ok(exitProp.label.includes("1204 Barton Springs Rd"));
  const wizardRes = interior.interactWithInteriorProp("statue_wizard");
  assert.ok(wizardRes.lines[0].includes("Austin"));

  // Street life adapts chants & toasts away from Newton-specific names
  const sl = buildStreetLife(austinMap, { landmarks: qs.landmarks });
  assert.equal(sl.isNewton, false);
  assert.equal(sl.cityShort, "Austin");
  if (sl.protestors.length > 0) {
    const noSnackRes = interactWithStreetLife(
      sl,
      { kind: "protestor", target: sl.protestors[0] },
      sl.protestors[0].x,
      sl.protestors[0].y,
      { hasSnack: false }
    );
    assert.ok(!noSnackRes.toast.includes("J.P. Licks"), "Custom town toast omits Newton shops");
  }

  // Standalone cemetery extraction helper works directly too
  const graves = extractGraveyardsFromOsm(elements, {
    width: 128,
    height: 128,
    mapCenter: config.mapCenter,
    scaleMetersPerTile: 6,
  });
  assert.equal(graves.length, 1);
  assert.equal(graves[0].name, "Oakwood Cemetery");
});
