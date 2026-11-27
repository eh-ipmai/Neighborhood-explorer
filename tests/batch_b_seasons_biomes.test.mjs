import test from "node:test";
import assert from "node:assert/strict";

import {
  BIOME_PRESETS,
  SEASONS,
  detectBiomeForLocation,
  detectSeasonForLocation,
  detectLocalQuirks,
  applySeasonToBiomeConfig,
  getBiomeConfig,
} from "../src/biomes.js";
import { PALETTES, bakeSnesBuildingCanvas, buildSnesSpriteAtlas } from "../src/tileset.js";
import { buildNeighborhoodPackage } from "../src/generator/pack_builder.js";

function installMockCanvasDom() {
  if (typeof globalThis.document !== "undefined") return () => {};
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};
      const calls = [];
      return {
        width: 0,
        height: 0,
        _calls: calls,
        getContext() {
          return {
            imageSmoothingEnabled: false,
            fillStyle: "",
            fillRect(x, y, w, h) {
              calls.push([x, y, w, h, this.fillStyle]);
            },
            beginPath() {},
            ellipse() {},
            fill() {},
            save() {},
            restore() {},
            translate() {},
            scale() {},
            drawImage() {},
          };
        },
      };
    },
  };
  return () => {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  };
}

test("4-season detection handles Northern/Southern hemispheres & regional winter geography accurately", () => {
  const jan = new Date(Date.UTC(2026, 0, 15));
  const jul = new Date(Date.UTC(2026, 6, 15));
  const apr = new Date(Date.UTC(2026, 3, 15));
  const oct = new Date(Date.UTC(2026, 9, 15));

  // Northern Hemisphere
  assert.equal(detectSeasonForLocation({ lat: 42.3, date: jan }), "winter");
  assert.equal(detectSeasonForLocation({ lat: 42.3, date: apr }), "spring");
  assert.equal(detectSeasonForLocation({ lat: 42.3, date: jul }), "summer");
  assert.equal(detectSeasonForLocation({ lat: 42.3, date: oct }), "fall");

  // Southern Hemisphere flips cleanly!
  assert.equal(detectSeasonForLocation({ lat: -33.86, date: jan }), "summer");
  assert.equal(detectSeasonForLocation({ lat: -33.86, date: jul }), "winter");

  // Newton default stays fall for backward compatibility
  assert.equal(detectSeasonForLocation({ lat: 42.3, date: jan, isNewton: true }), "fall");

  // Winter in New England -> Snow Day (snow ground, snow roofs, snowflakes, ice rinks!)
  const neWinter = applySeasonToBiomeConfig(BIOME_PRESETS.new_england_autumn, "winter");
  assert.equal(neWinter.paletteKey, "winter_snow");
  assert.equal(neWinter.hasSnowGround, true);
  assert.equal(neWinter.hasSnowRoofs, true);
  assert.equal(neWinter.ambientParticleStyle, "snowflakes");
  assert.equal(neWinter.parkSports, "winter_ice");

  // Winter in Jerusalem -> Lush emerald green hills + red kalaniyot (NOT arctic snow tundra!)
  const jWinter = applySeasonToBiomeConfig(BIOME_PRESETS.israel_jerusalem, "winter");
  assert.equal(jWinter.paletteKey, "israel_winter_green");
  assert.equal(jWinter.hasSnowGround, false);
  assert.equal(jWinter.hasSnowRoofs, false);

  // Spring in New England -> Cherry/almond blossom trees & pink petals!
  const neSpring = applySeasonToBiomeConfig(BIOME_PRESETS.new_england_autumn, "spring");
  assert.equal(neSpring.paletteKey, "spring_blossom");
  assert.equal(neSpring.treeStyle, "spring_blossom");
  assert.equal(neSpring.ambientParticleStyle, "spring_petals");
});

test("Expanded world biomes (Tundra, Alpine, Tropical, European, East Asian) detect & map to valid palettes", () => {
  assert.equal(detectBiomeForLocation({ lat: 64.1466, lon: -21.9426, countryCode: "is", townName: "Reykjavik, Iceland" }), "tundra");
  assert.equal(detectBiomeForLocation({ lat: 46.0207, lon: 7.7491, countryCode: "ch", townName: "Zermatt, Switzerland" }), "alpine");
  assert.equal(detectBiomeForLocation({ lat: 35.7148, lon: 139.7967, countryCode: "jp", townName: "Tokyo, Japan" }), "east_asian_urban");
  assert.equal(detectBiomeForLocation({ lat: 21.3069, lon: -157.8583, countryCode: "us", townName: "Honolulu, HI" }), "tropical_coastal");
  assert.equal(detectBiomeForLocation({ lat: 48.8566, lon: 2.3522, countryCode: "fr", townName: "Paris, France" }), "european_historic");

  for (const preset of Object.values(BIOME_PRESETS)) {
    assert.ok(PALETTES[preset.paletteKey], `Missing palette ${preset.paletteKey} for biome ${preset.id}`);
    for (const season of Object.keys(SEASONS)) {
      const seasonal = applySeasonToBiomeConfig(preset, season);
      assert.ok(
        PALETTES[seasonal.paletteKey],
        `Missing seasonal palette ${seasonal.paletteKey} for ${preset.id} in ${season}`
      );
    }
  }
});

test("Old City of Jerusalem quirk detects walls, rasterizes barrier=city_wall, and bakes vaulted stone domes & snow roofs", async () => {
  const quirks = detectLocalQuirks({
    lat: 31.7767,
    lon: 35.2289,
    townName: "Jerusalem, Israel",
    address: "Jaffa Gate, Old City",
    countryCode: "il",
  });
  assert.ok(quirks.includes("jerusalem_old_city"), "Should detect Old City of Jerusalem quirk");
  assert.ok(quirks.includes("jerusalem_stone"), "Should also include Jerusalem Stone quirk");

  const mockOldCityOsm = [
    { type: "node", id: 1, lat: 31.7764, lon: 35.2284 },
    { type: "node", id: 2, lat: 31.7764, lon: 35.2294 },
    { type: "node", id: 3, lat: 31.7771, lon: 35.2285 },
    { type: "node", id: 4, lat: 31.7771, lon: 35.2289 },
    { type: "node", id: 5, lat: 31.7768, lon: 35.2289 },
    { type: "node", id: 6, lat: 31.7768, lon: 35.2285 },
    { type: "node", id: 7, lat: 31.7760, lon: 35.2279 },
    { type: "node", id: 8, lat: 31.7774, lon: 35.2279 },
    {
      type: "way",
      id: 101,
      nodes: [1, 2],
      tags: { highway: "pedestrian", name: "רחוב דוד", "name:en": "David Street" },
    },
    {
      type: "way",
      id: 102,
      nodes: [3, 4, 5, 6, 3],
      tags: { building: "yes", "addr:street": "David Street", "addr:housenumber": "12" },
    },
    {
      type: "way",
      id: 103,
      nodes: [7, 8],
      tags: { barrier: "city_wall", historic: "citywalls", name: "חומות ירושלים", "name:en": "Old City Walls" },
    },
  ];

  const pack = await buildNeighborhoodPackage({
    address: "Jaffa Gate, Old City, Jerusalem, Israel",
    lat: 31.7767,
    lon: 35.2289,
    townOverride: "Old City, Jerusalem, Israel",
    countryCode: "il",
    size: "walkable",
    width: 64,
    height: 64,
    osmElements: mockOldCityOsm,
  });

  assert.ok(pack.meta.quirks?.includes("jerusalem_old_city"));
  const cityWall = pack.worldMap.buildings.find((b) => b.kind === "city_wall");
  assert.ok(cityWall, "Should rasterize OSM barrier=city_wall as fortified city_wall building");
  const house = pack.worldMap.buildings.find((b) => b.kind === "house");
  assert.ok(house?.isOldCity, "Buildings inside Old City should be tagged isOldCity");

  const cleanup = installMockCanvasDom();
  try {
    const oldCityBiome = getBiomeConfig(pack.worldMap);
    const bakedWall = bakeSnesBuildingCanvas(cityWall, 32, {}, oldCityBiome);
    assert.ok(bakedWall.canvas.width > 0);
    const bakedDomeHouse = bakeSnesBuildingCanvas(house, 32, {}, oldCityBiome);
    assert.ok(bakedDomeHouse.canvas._calls.some((c) => c[4] === "#faf5e8"), "Old City house should bake white stone dome");

    // Winter Snow atlas & snow-capped roof bake cleanly!
    const winterBiome = applySeasonToBiomeConfig(BIOME_PRESETS.new_england_autumn, "winter");
    const winterAtlas = buildSnesSpriteAtlas(winterBiome.paletteKey, winterBiome, { season: "winter" });
    assert.ok(winterAtlas.tree_oak_0);
    assert.ok(winterAtlas.fx_leaf_0);
    const snowHouse = bakeSnesBuildingCanvas(
      { id: "h_win", kind: "house", arch: "colonial", bounds: { minX: 5, minY: 5, maxX: 8, maxY: 7 } },
      32,
      {},
      winterBiome
    );
    assert.ok(snowHouse.canvas._calls.some((c) => c[4] === "#ffffff"), "Winter house roof should have white snow cap");
  } finally {
    cleanup();
  }
});
