import test from "node:test";
import assert from "node:assert/strict";

import {
  BIOME_PRESETS,
  detectBiomeForLocation,
  getBiomeConfig,
  getDrivingSideForCountry,
  formatBilingualName,
  formatInternationalAddress,
} from "../src/biomes.js";
import {
  slugifyNeighborhood,
  parseAddressParts,
  getNeighborhoodMeta,
} from "../src/neighborhood_meta.js";
import {
  normalizeStreetKey,
  extractStreetFromAddress,
  extractHouseNumber,
  createStreetSignSystem,
} from "../src/streetsigns.js";
import { parseNominatimResult } from "../src/generator/geocode.js";
import { buildNeighborhoodPackage } from "../src/generator/pack_builder.js";
import { buildParkFeatures } from "../src/parks.js";
import { buildStreetLife } from "../src/streetlife.js";
import { buildRoadTraffic } from "../src/traffic.js";
import { PALETTES, HOUSE_COLOR_PRESETS, resolveHouseStyle, getBuildingVisualCategory } from "../src/tileset.js";

test("detectBiomeForLocation maps Israel's 4 regions and global biomes accurately", () => {
  // Jerusalem (German Colony / Emek Refaim)
  assert.equal(
    detectBiomeForLocation({ lat: 31.7634, lon: 35.2179, countryCode: "il", townName: "Jerusalem, Israel" }),
    "israel_jerusalem"
  );
  // Tel Aviv Coast
  assert.equal(
    detectBiomeForLocation({ lat: 32.0809, lon: 34.774, countryCode: "il", townName: "Tel Aviv, Israel" }),
    "israel_coastal"
  );
  // Galilee / Safed
  assert.equal(
    detectBiomeForLocation({ lat: 32.9646, lon: 35.496, countryCode: "il", townName: "Safed, Israel" }),
    "israel_galilee"
  );
  // Negev / Be'er Sheva
  assert.equal(
    detectBiomeForLocation({ lat: 31.253, lon: 34.7915, countryCode: "il", townName: "Be'er Sheva, Israel" }),
    "israel_desert"
  );
  // Newton Centre stays New England Autumn
  assert.equal(
    detectBiomeForLocation({ lat: 42.3192, lon: -71.1927, countryCode: "us", townName: "Newton, MA", preset: "newton" }),
    "new_england_autumn"
  );
  // US Southwest Desert (Phoenix / Tucson)
  assert.equal(
    detectBiomeForLocation({ lat: 33.4484, lon: -112.074, countryCode: "us", townName: "Phoenix, AZ" }),
    "southwest_desert"
  );
  // UK -> Historic European Quarter + Left-Hand Traffic
  assert.equal(
    detectBiomeForLocation({ lat: 51.5074, lon: -0.1278, countryCode: "gb", townName: "London, UK" }),
    "european_historic"
  );
  assert.equal(getDrivingSideForCountry("gb"), "left");
  assert.equal(getDrivingSideForCountry("jp"), "left");
  assert.equal(getDrivingSideForCountry("il"), "right");
  assert.equal(getDrivingSideForCountry("us"), "right");
});

test("Every biome preset maps to a valid tileset palette and Jerusalem Stone presets exist", () => {
  for (const [id, cfg] of Object.entries(BIOME_PRESETS)) {
    assert.ok(PALETTES[cfg.paletteKey], `Biome ${id} must reference a valid paletteKey (${cfg.paletteKey})`);
  }
  assert.equal(HOUSE_COLOR_PRESETS.jerusalem_stone.isJerusalemStone, true);
  const style = resolveHouseStyle(
    { id: "j1", kind: "house", bounds: { minX: 10, minY: 10, maxX: 12, maxY: 12 }, isHomeBase: false },
    {},
    BIOME_PRESETS.israel_jerusalem
  );
  assert.equal(style.isJerusalemStone, true);
  assert.equal(
    getBuildingVisualCategory({ kind: "civic", name: "Beit Knesset · בית הכנסת הגדול", address: "" }),
    "synagogue"
  );
});

test("Bilingual naming, Unicode street keys, slugs & Israeli <Street> <Number> addresses work cleanly", () => {
  assert.equal(
    formatBilingualName({ name: "רחוב עמק רפאים", "name:en": "Emek Refaim St" }, { labelMode: "bilingual" }),
    "Emek Refaim St · רחוב עמק רפאים"
  );
  assert.equal(
    formatBilingualName({ name: "רחוב עמק רפאים", "name:en": "Emek Refaim St" }, { labelMode: "en" }),
    "Emek Refaim St"
  );
  assert.equal(
    formatBilingualName({ name: "רחוב עמק רפאים", "name:en": "Emek Refaim St" }, { labelMode: "local" }),
    "רחוב עמק רפאים"
  );

  // Unicode street keys MUST NOT strip Hebrew or non-Latin street names!
  const heKey = normalizeStreetKey("רחוב עמק רפאים");
  assert.ok(heKey.includes("עמק"), `Expected Hebrew street key to survive normalization, got "${heKey}"`);
  assert.equal(heKey, normalizeStreetKey("עמק רפאים"));

  const biKey = normalizeStreetKey("Emek Refaim St · רחוב עמק רפאים");
  assert.ok(biKey.includes("emek refaim"));
  assert.ok(biKey.includes("עמק רפאים"));

  // Non-Latin slugs produce unique deterministic non-colliding IDs
  const slugA = slugifyNeighborhood("רחוב יפו 40, ירושלים");
  const slugB = slugifyNeighborhood("רחוב עמק רפאים 24, ירושלים");
  assert.notEqual(slugA, slugB);
  assert.notEqual(slugA, "custom_neighborhood");

  // Israeli street-first address parsing
  assert.deepEqual(parseAddressParts("Emek Refaim 24"), { houseNumber: "24", streetToken: "emek refaim" });
  assert.deepEqual(parseAddressParts("עמק רפאים 24"), { houseNumber: "24", streetToken: "עמק רפאים" });
  assert.deepEqual(parseAddressParts("565 Boylston St"), { houseNumber: "565", streetToken: "boylston" });
  assert.equal(extractHouseNumber("Emek Refaim 24"), "#24");
  assert.equal(extractStreetFromAddress("Emek Refaim 24"), "emek refaim");

  assert.equal(
    formatInternationalAddress(
      { "addr:housenumber": "24", "addr:street": "עמק רפאים", "addr:street:en": "Emek Refaim" },
      { labelMode: "bilingual", countryCode: "il" }
    ),
    "Emek Refaim · עמק רפאים 24"
  );

  // Nominatim parsing for Jerusalem, Israel
  const parsed = parseNominatimResult({
    lat: "31.7634",
    lon: "35.2179",
    display_name: "24, Emek Refaim, German Colony, Jerusalem, Jerusalem District, Israel",
    address: {
      house_number: "24",
      road: "Emek Refaim",
      city: "Jerusalem",
      country: "Israel",
      country_code: "il",
    },
  });
  assert.equal(parsed.countryCode, "il");
  assert.equal(parsed.drivingSide, "right");
  assert.equal(parsed.homeAddress, "Emek Refaim 24");
  assert.equal(parsed.townName, "Jerusalem, Israel");
});

test("End-to-end offline Jerusalem bilingual neighborhood pack builds with Jerusalem biome, bilingual signs, multipolygons, soccer parks & street cats", async () => {
  const originLat = 31.7634;
  const originLon = 35.2179;

  const jerusalemOsmFixture = [
    // Emek Refaim (Main N-S Jerusalem avenue with Hebrew + English tags!)
    {
      type: "way",
      id: 101,
      tags: { highway: "secondary", name: "רחוב עמק רפאים", "name:en": "Emek Refaim St", lanes: "2" },
      geometry: [
        { lat: originLat - 0.0025, lon: originLon },
        { lat: originLat, lon: originLon },
        { lat: originLat + 0.0025, lon: originLon },
      ],
    },
    // Rachel Imeinu (Cross E-W residential street)
    {
      type: "way",
      id: 102,
      tags: { highway: "residential", name: "רחוב רחל אמנו", "name:en": "Rachel Imeinu St" },
      geometry: [
        { lat: originLat, lon: originLon - 0.003 },
        { lat: originLat, lon: originLon },
        { lat: originLat, lon: originLon + 0.003 },
      ],
    },
    // Crosswalk at Emek Refaim & Rachel Imeinu
    {
      type: "node",
      id: 103,
      lat: originLat,
      lon: originLon,
      tags: { highway: "crossing" },
    },
    // Home Base building (Emek Refaim 24)
    {
      type: "way",
      id: 201,
      tags: {
        building: "apartments",
        "addr:housenumber": "24",
        "addr:street": "עמק רפאים",
        "addr:street:en": "Emek Refaim",
      },
      geometry: [
        { lat: originLat + 0.00025, lon: originLon + 0.0002 },
        { lat: originLat + 0.00025, lon: originLon + 0.00042 },
        { lat: originLat + 0.00048, lon: originLon + 0.00042 },
        { lat: originLat + 0.00048, lon: originLon + 0.0002 },
        { lat: originLat + 0.00025, lon: originLon + 0.0002 },
      ],
    },
    // Multipolygon public park (Gan HaPa'amon / Liberty Bell Park!)
    {
      type: "relation",
      id: 301,
      tags: { type: "multipolygon", leisure: "park", name: "גן הפעמון", "name:en": "Liberty Bell Park" },
      members: [
        {
          type: "way",
          role: "outer",
          geometry: [
            { lat: originLat + 0.0008, lon: originLon - 0.0022 },
            { lat: originLat + 0.0008, lon: originLon - 0.0005 },
            { lat: originLat + 0.0022, lon: originLon - 0.0005 },
            { lat: originLat + 0.0022, lon: originLon - 0.0022 },
            { lat: originLat + 0.0008, lon: originLon - 0.0022 },
          ],
        },
      ],
    },
    // Local Jerusalem POIs (Synagogue, Bakery/Glida, Falafel, Park)
    {
      type: "node",
      id: 401,
      lat: originLat + 0.0011,
      lon: originLon + 0.0004,
      tags: { amenity: "place_of_worship", name: "בית הכנסת עמק רפאים", "name:en": "Emek Refaim Synagogue" },
    },
    {
      type: "node",
      id: 402,
      lat: originLat - 0.001,
      lon: originLon + 0.0004,
      tags: { shop: "bakery", name: "מאפיית אנג׳ל", "name:en": "Angel Bakery" },
    },
    {
      type: "node",
      id: 403,
      lat: originLat + 0.0014,
      lon: originLon - 0.0013,
      tags: { leisure: "park", name: "גן הפעמון", "name:en": "Liberty Bell Park" },
    },
    {
      type: "node",
      id: 404,
      lat: originLat - 0.0006,
      lon: originLon - 0.0012,
      tags: { amenity: "fast_food", name: "פלאפל שלום", "name:en": "Shalom Falafel" },
    },
  ];

  const pack = await buildNeighborhoodPackage({
    address: "Emek Refaim 24",
    lat: originLat,
    lon: originLon,
    townOverride: "Jerusalem, Israel",
    countryCode: "il",
    heroName: "Noa",
    width: 128,
    height: 128,
    scale: 6,
    labelMode: "bilingual",
    osmElements: jerusalemOsmFixture,
  });

  // 1. Metadata & Auto-Detected Jerusalem Stone Biome
  assert.equal(pack.meta.biome, "israel_jerusalem");
  assert.equal(pack.meta.countryCode, "il");
  assert.equal(pack.meta.drivingSide, "right");
  assert.equal(pack.meta.labelMode, "bilingual");
  const resolvedMeta = getNeighborhoodMeta(pack.worldMap);
  assert.equal(resolvedMeta.biome, "israel_jerusalem");
  assert.equal(getBiomeConfig(pack.worldMap).houseStyle, "jerusalem_stone");

  // 2. Bilingual Street Zones & Working Street Signs with Hebrew + English!
  const hasBilingualStreet = pack.worldMap.streetZones.some(
    (z) => z.name.includes("Emek Refaim") && z.name.includes("עמק רפאים")
  );
  assert.ok(hasBilingualStreet, "Expected bilingual English + Hebrew streetZone for Emek Refaim");

  const signSys = createStreetSignSystem(pack.worldMap, { landmarks: pack.landmarks });
  assert.ok(signSys.signs.length > 0, "Expected bilingual Jerusalem street signs to spawn cleanly");
  assert.ok(
    signSys.signs.some((s) => s.label.includes("Emek Refaim") && s.label.includes("עמק רפאים")),
    "Expected bilingual street sign label"
  );

  // 3. Multipolygon park rasterized into TILE_PARK (11) & parks place soccer/basketball (ZERO baseball diamonds!)
  const parkTiles = pack.worldMap.layers.base.filter((t) => t === 11).length;
  assert.ok(parkTiles >= 30, `Expected multipolygon Liberty Bell Park to rasterize park tiles, got ${parkTiles}`);
  const parkFeatures = buildParkFeatures(pack.worldMap);
  assert.equal(
    parkFeatures.fields.filter((f) => f.kind === "baseball_diamond").length,
    0,
    "Jerusalem parks should favor soccer/basketball/playgrounds, not US baseball diamonds"
  );

  // 4. Bilingual POIs discovered cleanly
  assert.ok(
    pack.landmarks.some((l) => l.name.includes("Angel Bakery") && l.name.includes("מאפיית אנג׳ל")),
    "Expected bilingual Angel Bakery landmark"
  );
  assert.ok(
    pack.landmarks.some((l) => l.name.includes("Emek Refaim Synagogue") && l.name.includes("בית הכנסת")),
    "Expected bilingual Synagogue landmark"
  );

  // 5. Israeli Street Life: Street cats & dogs, ZERO wild New England turkeys!
  const streetLife = buildStreetLife(pack.worldMap, { landmarks: pack.landmarks });
  assert.equal(streetLife.turkeys.length, 0, "Jerusalem should not spawn wild New England turkeys");
  assert.ok(streetLife.cats.length >= 2, `Expected friendly Jerusalem street cats, got ${streetLife.cats.length}`);

  // 6. Traffic initializes cleanly
  const traffic = buildRoadTraffic(pack.worldMap);
  assert.ok(Array.isArray(traffic.vehicles));
});
