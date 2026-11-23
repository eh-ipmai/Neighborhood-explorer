import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  TILE_SIZE,
  normalizeMoveInput,
  resolveCardinalFacing,
  createMapCollider,
  moveWithCollision,
} from "../src/player.js";
import { createSafetySystem } from "../src/safety.js";
import {
  TILE_IDS,
  projectLatLonToTile,
  rasterizeOsmData,
  buildOfflineMap,
} from "../scripts/build_map.mjs";

test("8-way movement normalizes diagonal vectors by 1/sqrt(2)", () => {
  const diag = normalizeMoveInput(1, -1);
  assert.ok(Math.abs(diag.x - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(diag.y + Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.y) - 1) < 1e-6);

  const card = normalizeMoveInput(1, 0);
  assert.deepEqual(card, { x: 1, y: 0 });
});

test("4-way cardinal facing locks cleanly during diagonal movement", () => {
  assert.equal(resolveCardinalFacing(0, -1, "down"), "up");
  assert.equal(resolveCardinalFacing(1, 1, "down"), "down");
  assert.equal(resolveCardinalFacing(1, 1, "left"), "right");
  assert.equal(resolveCardinalFacing(0, 0, "left"), "left");
});

test("solid collision stops player and 4px corner sliding nudges around tile edges", () => {
  // 5x5 grid with a single solid wall tile at (2, 1)
  const width = 5;
  const height = 5;
  const base = new Array(width * height).fill(TILE_IDS.SIDEWALK);
  const collision = new Array(width * height).fill(0);
  base[1 * width + 2] = TILE_IDS.BUILDING_WALL;
  collision[1 * width + 2] = 1;

  const map = {
    tileSize: TILE_SIZE,
    dimensions: { width, height },
    legend: { "1": "sidewalk", "5": "building_wall" },
    layers: { base, collision },
    streetZones: [],
  };
  const collider = createMapCollider(map);

  // Dead-center into wall at (2,1): tile (2,1) spans x=[32,48), y=[16,32)
  // Player hitbox is 10x10 (half=5). At x=26, y=24 moving right hits center of wall (8px from both edges -> >4px)
  const blockedCenter = moveWithCollision(
    { x: 26.5, y: 24, facing: "right" },
    { x: 1, y: 0 },
    0.05,
    collider.isBoxBlocked
  );
  assert.equal(blockedCenter.x, 26.5);
  assert.equal(blockedCenter.slidCorner, false);

  // Clipping the bottom corner of wall (2,1) by 3px:
  // Wall bottom is y=32. Hitbox top is y-5. At y=34, hitbox top=29 -> overlaps wall by 3px (<= 4px).
  const slidDown = moveWithCollision(
    { x: 27, y: 34, facing: "right" },
    { x: 1, y: 0 },
    0.05,
    collider.isBoxBlocked
  );
  assert.equal(slidDown.slidCorner, true);
  assert.ok(slidDown.y > 34, "player should slide downward around bottom corner");
});

test("diagonal movement slides cleanly along walls", () => {
  // 5x5 grid with vertical wall at x=2
  const width = 5;
  const height = 5;
  const base = new Array(width * height).fill(TILE_IDS.SIDEWALK);
  const collision = new Array(width * height).fill(0);
  for (let y = 0; y < height; y++) {
    base[y * width + 2] = TILE_IDS.BUILDING_WALL;
    collision[y * width + 2] = 1;
  }

  const map = {
    tileSize: TILE_SIZE,
    dimensions: { width, height },
    legend: { "1": "sidewalk", "5": "building_wall" },
    layers: { base, collision },
    streetZones: [],
  };
  const collider = createMapCollider(map);

  // Adjacent to wall at x=27 (right edge at 32), moving down-right should slide smoothly down
  const res = moveWithCollision(
    { x: 27, y: 24, facing: "right" },
    { x: 1, y: 1 },
    0.1,
    collider.isBoxBlocked
  );
  assert.equal(res.x, 27);
  assert.ok(res.y > 24, "should continue sliding south while pressing SE against vertical wall");
});

test("Equirectangular projection maps origin to grid center and North to smaller Y", () => {
  const center = projectLatLonToTile(42.3177, -71.1922, 42.3177, -71.1922, 100, 100, 5);
  assert.deepEqual(center, { x: 50, y: 50 });

  const north = projectLatLonToTile(42.3186, -71.1922, 42.3177, -71.1922, 100, 100, 5);
  assert.ok(north.y < center.y);
  assert.equal(north.x, center.x);
});

test("OSM rasterizer enforces 5-layer priority and tags streetZones", () => {
  const originLat = 42.3177;
  const originLon = -71.1922;
  const elements = [
    {
      type: "way",
      id: 1,
      tags: { highway: "primary", name: "Boylston Street" },
      geometry: [
        { lat: originLat, lon: originLon - 0.001 },
        { lat: originLat, lon: originLon + 0.001 },
      ],
    },
    {
      type: "node",
      id: 2,
      lat: originLat,
      lon: originLon,
      tags: { highway: "crossing" },
    },
  ];

  const map = rasterizeOsmData(elements, {
    width: 64,
    height: 64,
    scaleMetersPerTile: 5,
    origin: { lat: originLat, lon: originLon, name: "Test Origin" },
  });

  assert.equal(map.layers.base.length, 64 * 64);
  assert.equal(map.layers.collision.length, 64 * 64);
  assert.equal(map.layers.base[32 * 64 + 32], TILE_IDS.CROSSWALK);
  assert.ok(map.streetZones.some((z) => z.name === "Boylston Street" && z.type === "arterial"));

  const safety = createSafetySystem(map);
  const zone = safety.getStreetZoneAt(32, 32);
  assert.equal(zone?.name, "Boylston Street");
});

test("pre-compiled data/world_map.json exists, matches schema, and has walkable spawn", () => {
  const mapPath = path.resolve(process.cwd(), "data", "world_map.json");
  assert.ok(fs.existsSync(mapPath), "data/world_map.json must be pre-compiled and committed");

  const worldMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  const { width, height } = worldMap.dimensions;
  assert.equal(worldMap.tileSize, 16);
  assert.equal(worldMap.layers.base.length, width * height);
  assert.equal(worldMap.layers.collision.length, width * height);

  const spawn = worldMap.origin.spawnTile;
  assert.ok(spawn && typeof spawn.x === "number" && typeof spawn.y === "number");
  assert.equal(
    worldMap.layers.collision[spawn.y * width + spawn.x],
    0,
    "Home Base spawnTile must be walkable"
  );
  assert.ok(Array.isArray(worldMap.streetZones) && worldMap.streetZones.length > 0);
});

test("offline map builder produces valid walkable Newton Centre map", () => {
  const offline = buildOfflineMap();
  assert.equal(offline.dimensions.width, 128);
  assert.equal(offline.dimensions.height, 128);
  const { x, y } = offline.origin.spawnTile;
  assert.equal(offline.layers.collision[y * 128 + x], 0);
});

test("WebGL probe safely returns false in non-browser environments", async () => {
  const { isWebGLSupported } = await import("../src/renderer.js");
  assert.equal(isWebGLSupported(), false);
});

test("FASTER button speeds up on sidewalks/parks and slows near unchecked roads", () => {
  const offline = buildOfflineMap();
  const safety = createSafetySystem(offline);

  assert.ok(safety.getSpeedMultiplier("sidewalk", true, false) > 1);
  assert.ok(safety.getSpeedMultiplier("grass", true, false) > 1);
  assert.equal(safety.getSpeedMultiplier("main_road", true, false), 1);
  assert.equal(safety.getSpeedMultiplier("crosswalk", true, false), 1);
  assert.ok(safety.getSpeedMultiplier("crosswalk", true, true) > 1);
});

test("LOOK BOTH WAYS detects crosswalks and awards Safety XP", () => {
  const offline = buildOfflineMap();
  const safety = createSafetySystem(offline);
  // In offline map, Boylston crosswalk sits right at (64, 67..69)
  const cwResult = safety.inspectCrossingContext(64, 66);
  assert.equal(cwResult.context, "crosswalk");
  assert.equal(cwResult.xpReward, 5);
});
