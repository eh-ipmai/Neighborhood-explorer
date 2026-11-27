import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  classifyBuildingKind,
  computeBuildingPlacementMeta,
  rasterizeOsmData,
} from "../src/generator/rasterizer.js";
import { buildOverpassQuery } from "../src/generator/osm_fetch.js";
import {
  BUILDING_STYLE_PRESETS,
  getBuildingVisualCategory,
  getBuildingSignText,
  bakeSnesBuildingCanvas,
} from "../src/tileset.js";
import { NON_RESIDENTIAL_MAP_INK } from "../src/papermap.js";
import { buildParkFeatures, buildWoodlandTreeGrid, buildCurbAlignedFurniture } from "../src/parks.js";
import { buildGraveyardMask } from "../src/graveyards.js";
import { getNavigationSubgrid } from "../src/subgrid.js";
import { BIOME_PRESETS } from "../src/biomes.js";

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

test("Expanded building taxonomy classifies, signs, colors & bakes all 8 new municipal/industrial kinds + mosque", () => {
  const cases = [
    [{ amenity: "post_office" }, "post_office", "POST"],
    [{ amenity: "townhall" }, "city_hall", "CITY HALL"],
    [{ amenity: "police" }, "police_station", "POLICE"],
    [{ amenity: "recycling" }, "sanitation", "DPW"],
    [{ building: "industrial" }, "industrial", "WORKS"],
    [{ amenity: "hospital" }, "hospital_clinic", "HOSPITAL"],
    [{ railway: "station" }, "transit_station", "STATION"],
    [{ tourism: "museum" }, "museum", "MUSEUM"],
  ];

  const cleanup = installMockCanvasDom();
  try {
    for (const [tags, expectedKind, expectedSign] of cases) {
      const kind = classifyBuildingKind(tags, { minX: 0, minY: 0, maxX: 4, maxY: 4 }, "", "");
      assert.equal(kind, expectedKind, `Expected ${expectedKind} for ${JSON.stringify(tags)}`);
      assert.ok(BUILDING_STYLE_PRESETS[expectedKind], `Missing BUILDING_STYLE_PRESETS.${expectedKind}`);
      assert.ok(NON_RESIDENTIAL_MAP_INK[expectedKind], `Missing NON_RESIDENTIAL_MAP_INK.${expectedKind}`);

      const b = { id: `test_${expectedKind}`, kind: expectedKind, bounds: { minX: 10, minY: 10, maxX: 14, maxY: 13 } };
      const cat = getBuildingVisualCategory(b);
      assert.equal(cat, expectedKind);
      assert.equal(getBuildingSignText(b, cat), expectedSign);

      const baked = bakeSnesBuildingCanvas(b, 32, {}, BIOME_PRESETS.israel_jerusalem);
      assert.ok(baked.canvas.width > 0 && baked.canvas.height > 0);
      assert.ok(baked.canvas._calls.length > 20, `${expectedKind} should render detailed 2x HD pixel geometry`);
    }

    // Mosque inside civic
    const mosque = { id: "m1", kind: "civic", name: "Al-Aqsa Mosque", bounds: { minX: 10, minY: 10, maxX: 14, maxY: 13 } };
    assert.equal(getBuildingVisualCategory(mosque), "mosque");
    assert.equal(getBuildingSignText(mosque, "mosque"), "MOSQUE");
    const bakedMosque = bakeSnesBuildingCanvas(mosque, 32, {}, BIOME_PRESETS.israel_jerusalem);
    assert.ok(bakedMosque.canvas._calls.length > 20);
  } finally {
    cleanup();
  }
});

test("Overpass query fetches real OSM trees, tree rows & city walls, and rasterizer preserves osmTrees + building facing", () => {
  const q = buildOverpassQuery({ south: 31.76, west: 35.21, north: 31.77, east: 35.22 });
  assert.ok(q.includes('node["natural"="tree"]'));
  assert.ok(q.includes('way["natural"="tree_row"]'));
  assert.ok(q.includes('way["barrier"="city_wall"]'));

  const mockOsm = [
    // East-west road at lat 31.7632
    { type: "node", id: 1, lat: 31.7632, lon: 35.2185 },
    { type: "node", id: 2, lat: 31.7632, lon: 35.2215 },
    // Building just NORTH of the road -> should face south ("s")!
    { type: "node", id: 3, lat: 31.7637, lon: 35.2197 },
    { type: "node", id: 4, lat: 31.7637, lon: 35.2201 },
    { type: "node", id: 5, lat: 31.7634, lon: 35.2201 },
    { type: "node", id: 6, lat: 31.7634, lon: 35.2197 },
    // Real OSM tree in open lawn well away from building & road!
    { type: "node", id: 7, lat: 31.7642, lon: 35.2190, tags: { natural: "tree", leaf_type: "needleleaved" } },
    { type: "node", id: 8, lat: 31.7642, lon: 35.2208, tags: { natural: "tree" } },
    {
      type: "way",
      id: 10,
      nodes: [1, 2],
      tags: { highway: "residential", name: "Test Lane" },
    },
    {
      type: "way",
      id: 11,
      nodes: [3, 4, 5, 6, 3],
      tags: { building: "house", "addr:housenumber": "10", "addr:street": "Test Lane" },
    },
  ];

  const wm = rasterizeOsmData(mockOsm, {
    width: 64,
    height: 64,
    tileSize: 16,
    scaleMetersPerTile: 6,
    origin: { lat: 31.7634, lon: 35.22, name: "Home Base (10 Test Lane)" },
    mapCenter: { lat: 31.7634, lon: 35.22 },
    meta: { preset: "generic", biome: "israel_jerusalem", countryCode: "il" },
  });

  assert.ok(Array.isArray(wm.osmTrees) && wm.osmTrees.length === 2, "Should preserve real OSM natural=tree points");
  assert.equal(wm.osmTrees[0].kind, 2, "needleleaved tree should map to evergreen kind=2");
  assert.equal(wm.osmTrees[1].kind, 1, "default tree should map to deciduous kind=1");

  const house = wm.buildings.find((b) => b.houseNumber === "10");
  assert.ok(house, "House should exist");
  assert.equal(house.facing, "s", "House north of road should face south toward the street");
  assert.ok(house.centroid && typeof house.centroid.x === "number");

  // Verify buildWoodlandTreeGrid places our real OSM trees!
  const treeGrid = buildWoodlandTreeGrid(wm);
  const t0 = wm.osmTrees[0];
  assert.equal(treeGrid[t0.ty * 64 + t0.tx], 2, "Real OSM needleleaved tree should be stamped at its exact tile!");
});

test("Precision placement invariants hold across live Newton Centre world_map.json (zero road/door/building collisions)", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const tileSize = worldMap.tileSize || 16;
  const subgrid = getNavigationSubgrid(worldMap);
  const { graveyardGrid } = buildGraveyardMask(worldMap);
  const parkFeatures = buildParkFeatures(worldMap, graveyardGrid);

  const treeGrid = buildWoodlandTreeGrid(worldMap, parkFeatures.occupiedGrid, graveyardGrid);
  const { streetLamps, hydrants, parkBenches } = buildCurbAlignedFurniture(worldMap, {
    treeGrid,
    parkOccupiedGrid: parkFeatures.occupiedGrid,
    graveyardGrid,
  });

  // Build front-door lookup for zero-doorway-block invariant
  const doorTiles = new Set();
  for (const b of worldMap.buildings || []) {
    if (!b?.bounds) continue;
    const midX = Math.floor((b.bounds.minX + b.bounds.maxX) / 2);
    doorTiles.add(`${midX},${b.bounds.maxY + 1}`);
  }

  // 1. Tree invariants: ZERO trees on roads, sidewalks, buildings, water, park fields, graveyards, or front doors!
  let treeCount = 0;
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const idx = ty * width + tx;
      if (treeGrid[idx] === 0) continue;
      treeCount++;
      const t = base[idx];
      assert.ok(t === 0 || t === 7 || t === 11, `Tree at (${tx},${ty}) on non-green tile ${t}`);
      assert.equal(parkFeatures.occupiedGrid[idx], 0, `Tree at (${tx},${ty}) overlaps park sports field`);
      assert.equal(graveyardGrid[idx], 0, `Tree at (${tx},${ty}) overlaps graveyard`);
      assert.equal(doorTiles.has(`${tx},${ty}`), false, `Tree at (${tx},${ty}) blocks building doorway`);
      if (subgrid.hasVectorRoads) {
        const px = tx * tileSize + tileSize * 0.5;
        const py = ty * tileSize + tileSize * 0.5;
        assert.equal(subgrid.isRoadAtPx(px, py), false, `Tree at (${tx},${ty}) clips vector road`);
      }
    }
  }
  assert.ok(treeCount > 1000, "Newton Centre should remain lushly forested");

  // 2. Curb-aligned street furniture invariants: every lamp & hydrant sits on walkable sidewalk, clear of vector roads & doors, with curbSide!
  assert.ok(streetLamps.length > 20, "Should place curb-aligned street lamps");
  assert.ok(hydrants.length > 5, "Should place curb-aligned fire hydrants");
  for (const item of [...streetLamps, ...hydrants]) {
    assert.ok(["n", "s", "e", "w"].includes(item.curbSide), "Lamp/hydrant must have valid curbSide");
    assert.equal(base[item.ty * width + item.tx], 1, "Lamp/hydrant must sit strictly on sidewalk tile");
    assert.equal(doorTiles.has(`${item.tx},${item.ty}`), false, "Lamp/hydrant must not block front door");
    if (subgrid.hasVectorRoads) {
      const px = item.tx * tileSize + tileSize * 0.5;
      const py = item.ty * tileSize + tileSize * 0.5;
      assert.equal(subgrid.isRoadAtPx(px, py), false, "Lamp/hydrant must never clip vector road asphalt");
    }
  }
  for (const bench of parkBenches) {
    assert.equal(base[bench.ty * width + bench.tx], 11, "Park bench must sit strictly on park turf");
    assert.equal(treeGrid[bench.ty * width + bench.tx], 0, "Park bench must not overlap a tree");
  }

  // 3. Tight building neighbor visual clamping prevents house canvas overlap!
  const cleanup = installMockCanvasDom();
  try {
    const tightHouse = {
      id: "tight_1",
      kind: "house",
      arch: "colonial",
      bounds: { minX: 10, minY: 10, maxX: 11, maxY: 11 },
      maxVisualTilesW: 2,
    };
    const wideHouse = {
      id: "wide_1",
      kind: "house",
      arch: "colonial",
      bounds: { minX: 10, minY: 10, maxX: 11, maxY: 11 },
    };
    const bakedTight = bakeSnesBuildingCanvas(tightHouse, 32);
    const bakedWide = bakeSnesBuildingCanvas(wideHouse, 32);
    assert.ok(
      bakedTight.canvas.width < bakedWide.canvas.width,
      "Tight neighbor house canvas should clamp narrower than detached house to prevent overlap"
    );
  } finally {
    cleanup();
  }
});
