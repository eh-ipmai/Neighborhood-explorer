import test from "node:test";
import assert from "node:assert/strict";

import { parseNominatimResult, geocodeAddress } from "../src/generator/geocode.js";
import { buildOverpassQuery, fetchOsmDataForBbox } from "../src/generator/osm_fetch.js";
import { generateLandmarksAndQuests } from "../src/generator/poi_landmarks.js";
import { buildNeighborhoodPackage, parseCreateArgs } from "../scripts/create_neighborhood.mjs";
import { createQuestSystem } from "../src/quests.js";
import { createStreetSignSystem } from "../src/streetsigns.js";
import { buildStreetLife } from "../src/streetlife.js";
import { buildGraveyardFeatures } from "../src/graveyards.js";

function buildRichTownElements(originLat = 45.5231, originLon = -122.6765) {
  return [
    // Roads forming a clean neighborhood grid
    {
      type: "way",
      id: 101,
      tags: { highway: "secondary", name: "Hawthorne Boulevard" },
      geometry: [
        { lat: originLat - 0.0005, lon: originLon - 0.006 },
        { lat: originLat - 0.0005, lon: originLon + 0.006 },
      ],
    },
    {
      type: "way",
      id: 102,
      tags: { highway: "residential", name: "SE 34th Avenue" },
      geometry: [
        { lat: originLat - 0.005, lon: originLon + 0.0004 },
        { lat: originLat + 0.005, lon: originLon + 0.0004 },
      ],
    },
    {
      type: "way",
      id: 103,
      tags: { highway: "residential", name: "SE Yamhill Street" },
      geometry: [
        { lat: originLat + 0.0022, lon: originLon - 0.005 },
        { lat: originLat + 0.0022, lon: originLon + 0.005 },
      ],
    },
    // Home Base building
    {
      type: "way",
      id: 201,
      tags: { building: "house", "addr:housenumber": "3412", "addr:street": "SE Hawthorne Blvd" },
      geometry: [
        { lat: originLat + 0.00005, lon: originLon - 0.00015 },
        { lat: originLat + 0.00005, lon: originLon + 0.00015 },
        { lat: originLat + 0.00028, lon: originLon + 0.00015 },
        { lat: originLat + 0.00028, lon: originLon - 0.00015 },
        { lat: originLat + 0.00005, lon: originLon - 0.00015 },
      ],
    },
    // Real OSM Park
    {
      type: "way",
      id: 301,
      tags: { leisure: "park", name: "Laurelhurst Park" },
      geometry: [
        { lat: originLat + 0.0026, lon: originLon + 0.0018 },
        { lat: originLat + 0.0026, lon: originLon + 0.0038 },
        { lat: originLat + 0.0042, lon: originLon + 0.0038 },
        { lat: originLat + 0.0042, lon: originLon + 0.0018 },
        { lat: originLat + 0.0026, lon: originLon + 0.0018 },
      ],
    },
    // Real OSM Cemetery
    {
      type: "way",
      id: 302,
      tags: { landuse: "cemetery", name: "Lone Fir Cemetery", start_date: "1855" },
      geometry: [
        { lat: originLat + 0.0024, lon: originLon - 0.0042 },
        { lat: originLat + 0.0024, lon: originLon - 0.0024 },
        { lat: originLat + 0.0040, lon: originLon - 0.0024 },
        { lat: originLat + 0.0040, lon: originLon - 0.0042 },
        { lat: originLat + 0.0024, lon: originLon - 0.0042 },
      ],
    },
    // Real OSM POIs
    {
      type: "node",
      id: 401,
      lat: originLat + 0.0018,
      lon: originLon + 0.0026,
      tags: { amenity: "library", name: "Belmont Public Library", "addr:housenumber": "1038", "addr:street": "SE Cesar Chavez Blvd" },
    },
    {
      type: "node",
      id: 402,
      lat: originLat - 0.0014,
      lon: originLon + 0.0022,
      tags: { amenity: "ice_cream", name: "Salt & Straw Ice Cream", "addr:housenumber": "3345", "addr:street": "SE Division St" },
    },
    {
      type: "node",
      id: 403,
      lat: originLat - 0.0018,
      lon: originLon - 0.0025,
      tags: { shop: "books", name: "Powell's Hawthorne Books" },
    },
    {
      type: "node",
      id: 404,
      lat: originLat + 0.0009,
      lon: originLon - 0.0028,
      tags: { amenity: "fire_station", name: "Portland Fire Station 9" },
    },
    {
      type: "node",
      id: 405,
      lat: originLat - 0.0028,
      lon: originLon + 0.0008,
      tags: { amenity: "place_of_worship", name: "Congregation Shaarie Torah" },
    },
  ];
}

test("geocodeAddress parses Nominatim results cleanly and abbreviates US states", async () => {
  const sample = {
    lat: "45.51223",
    lon: "-122.65872",
    display_name: "3412, Southeast Hawthorne Boulevard, Sunnyside, Portland, Multnomah County, Oregon, 97214, United States",
    address: {
      house_number: "3412",
      road: "SE Hawthorne Blvd",
      city: "Portland",
      state: "Oregon",
      postcode: "97214",
    },
  };
  const parsed = parseNominatimResult(sample);
  assert.equal(parsed.homeAddress, "3412 SE Hawthorne Blvd");
  assert.equal(parsed.townName, "Portland, OR");
  assert.equal(parsed.cityShort, "Portland");
  assert.equal(parsed.state, "OR");

  const mockFetch = async () => ({
    ok: true,
    json: async () => [sample],
  });
  const geo = await geocodeAddress("3412 SE Hawthorne Blvd, Portland, OR", { fetchImpl: mockFetch });
  assert.equal(geo.homeAddress, "3412 SE Hawthorne Blvd");
  assert.equal(geo.townName, "Portland, OR");

  await assert.rejects(
    () => geocodeAddress("Nowhereville XYZ", { fetchImpl: async () => ({ ok: true, json: async () => [] }) }),
    /Could not find address/
  );
});

test("fetchOsmDataForBbox downloads tiled OSM data with progress and falls back cleanly to Overpass", async () => {
  const bbox = { south: 45.51, west: -122.68, north: 45.52, east: -122.67 };
  assert.ok(buildOverpassQuery(bbox).includes('way["building"]'));

  const progressEvents = [];
  let osmApiCalls = 0;
  const tiledOkFetch = async (url) => {
    if (url.includes("api.openstreetmap.org")) {
      osmApiCalls++;
      return {
        ok: true,
        json: async () => ({
          elements: [{ type: "node", id: osmApiCalls, lat: 45.515, lon: -122.675, tags: {} }],
        }),
      };
    }
    throw new Error("unexpected URL");
  };

  const els = await fetchOsmDataForBbox(bbox, {
    gridMeters: 800,
    fetchImpl: tiledOkFetch,
    onProgress: (ev) => progressEvents.push(ev),
  });
  assert.equal(osmApiCalls, 4); // 2x2 grid for 800m
  assert.equal(els.length, 4);
  assert.ok(progressEvents.length >= 4);

  // Fallback to Overpass when OSM API fails
  let overpassCalled = false;
  const fallbackFetch = async (url) => {
    if (url.includes("api.openstreetmap.org")) {
      return { ok: false, status: 503, statusText: "Unavailable" };
    }
    overpassCalled = true;
    return {
      ok: true,
      json: async () => ({ elements: [{ type: "node", id: 99, lat: 45.515, lon: -122.675 }] }),
    };
  };
  const fallbackEls = await fetchOsmDataForBbox(bbox, { gridMeters: 800, fetchImpl: fallbackFetch });
  assert.equal(overpassCalled, true);
  assert.equal(fallbackEls.length, 1);
});

test("buildNeighborhoodPackage generates complete playable town with auto-discovered POIs, custom places & quests", async () => {
  const originLat = 45.5231;
  const originLon = -122.6765;
  const mockElements = buildRichTownElements(originLat, originLon);

  const pack = await buildNeighborhoodPackage({
    address: "3412 SE Hawthorne Blvd, Portland, OR",
    heroName: "Leo",
    size: "walkable",
    width: 192,
    height: 192,
    osmElements: mockElements,
    geocodeFn: async () => ({
      lat: originLat,
      lon: originLon,
      homeAddress: "3412 SE Hawthorne Blvd",
      townName: "Portland, OR",
      cityShort: "Portland",
      state: "OR",
    }),
    customPlacesConfig: {
      places: [
        {
          id: "grandmas_house",
          name: "Grandma's House",
          lat: originLat + 0.0012,
          lon: originLon + 0.0012,
          npcName: "Grandma",
          healHearts: 5,
          givesSnacks: true,
          dialogue: ["Warm cookies for Leo!"],
        },
      ],
      quests: [
        {
          title: "Visit Grandma First",
          description: "Walk to Grandma's House for warm cookies!",
          targetPlaceIds: ["grandmas_house"],
        },
      ],
    },
  });

  assert.equal(pack.formatVersion, 1);
  assert.equal(pack.meta.townName, "Portland, OR");
  assert.equal(pack.meta.heroName, "Leo");
  assert.equal(pack.worldMap.dimensions.width, 192);
  assert.ok(pack.worldMap.graveyards.length === 1);
  assert.equal(pack.worldMap.graveyards[0].name, "Lone Fir Cemetery");

  // Landmarks include Home Base, custom Grandma's House, AND auto-discovered Portland POIs!
  const lmIds = new Set(pack.landmarks.map((l) => l.id));
  assert.ok(lmIds.has("home_base"));
  assert.ok(lmIds.has("grandmas_house"));
  assert.ok(pack.landmarks.some((l) => l.name === "Belmont Public Library"));
  assert.ok(pack.landmarks.some((l) => l.name === "Salt & Straw Ice Cream"));
  assert.ok(pack.landmarks.some((l) => l.name === "Lone Fir Cemetery"));

  // Sword & Siddur are guaranteed earnable!
  assert.ok(
    pack.landmarks.some((l) => l.rewardItem === "graveyard_sword" || l.bonusItem === "graveyard_sword"),
    "Every generated town must grant the Graveyard Sword"
  );
  assert.ok(
    pack.landmarks.some((l) => l.rewardItem === "pocket_siddur" || l.bonusItem === "pocket_siddur"),
    "Every generated town must grant the Pocket Siddur"
  );

  // Quests include custom quest, scout quest, wooden chest riddle, grand delivery, AND spooky tour!
  assert.ok(pack.quests.some((q) => q.title === "Visit Grandma First"));
  assert.ok(pack.quests.some((q) => q.id === "quest_02_riddle_hunt"));
  assert.ok(pack.quests.some((q) => q.id === "quest_04_spooky_tour"));

  // Every quest target landmark ID exists and every landmark is strictly in-bounds
  for (const lm of pack.landmarks) {
    assert.ok(lm.tileX >= 0 && lm.tileX < 192);
    assert.ok(lm.tileY >= 0 && lm.tileY < 192);
  }
  for (const q of pack.quests) {
    for (const s of q.steps) {
      if (s.targetLandmarkId) {
        assert.ok(lmIds.has(s.targetLandmarkId), `Missing targetLandmarkId ${s.targetLandmarkId}`);
      }
      if (s.targetTile) {
        assert.ok(s.targetTile.x >= 0 && s.targetTile.x < 192);
        assert.ok(s.targetTile.y >= 0 && s.targetTile.y < 192);
      }
    }
  }

  // Plug generated package straight into ALL core runtime game systems — zero crashes!
  const qs = createQuestSystem({ landmarks: pack.landmarks, quests: pack.quests, worldMap: pack.worldMap });
  const graves = buildGraveyardFeatures(pack.worldMap);
  const signs = createStreetSignSystem(pack.worldMap, { landmarks: qs.landmarks });
  const streetLife = buildStreetLife(pack.worldMap, {
    graveyardGrid: graves.graveyardGrid,
    graveyardZones: graves.zones,
    landmarks: qs.landmarks,
  });

  assert.ok(qs.landmarks.length >= 6);
  assert.ok(graves.zones.length === 1);
  assert.ok(signs.signs.length > 0);
  assert.equal(streetLife.cityShort, "Portland");
});

test("generateLandmarksAndQuests creates scenic fallback landmarks for sparse areas with zero named OSM POIs", () => {
  const sparseMap = {
    dimensions: { width: 128, height: 128 },
    scaleMetersPerTile: 6,
    origin: { lat: 41.2, lon: -96.0, name: "Home Base (10 Country Ln)", spawnTile: { x: 64, y: 64 } },
    mapCenter: { lat: 41.2, lon: -96.0 },
    meta: { preset: "generic", townName: "Omaha, NE", cityShort: "Omaha", homeAddress: "10 Country Ln", heroName: "Sam" },
    layers: {
      base: new Array(128 * 128).fill(0),
      collision: new Array(128 * 128).fill(0),
    },
    graveyards: [],
  };

  const { landmarks, quests } = generateLandmarksAndQuests({
    elements: [],
    worldMap: sparseMap,
  });
  assert.ok(landmarks.length >= 4, "Sparse areas still get at least 4 landmarks");
  assert.ok(quests.length >= 2, "Sparse areas still get starter quests");
  assert.equal(parseCreateArgs(["--address", "10 Country Ln", "--size", "full"]).size, "full");
});
