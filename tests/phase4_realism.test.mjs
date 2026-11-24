import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  TILE_IDS,
  LEGEND,
  HOUSE_ARCH_TYPES,
  classifyBuildingKind,
  classifyHouseArch,
  simplifyRoadPolyline,
  simplifyGridPaths,
  slimOversizedSidewalks,
  enlargeBuildingFootprints,
  buildOfflineMap,
  rasterizeOsmData,
} from "../scripts/build_map.mjs";
import { createSafetySystem, SAFE_CROSSING_DURATION_SEC } from "../src/safety.js";
import {
  TILE_SIZE,
  DEFAULT_HITBOX,
  createMapCollider,
  moveWithCollision,
} from "../src/player.js";
import {
  BUILDING_STYLE_PRESETS,
  normalizeAddress,
  resolveHouseStyle,
} from "../src/tileset.js";
import { buildParkFeatures, buildWoodlandTreeGrid } from "../src/parks.js";
import { buildGraveyardFeatures } from "../src/graveyards.js";

test("all high-fidelity ground types exist in TILE_IDS, LEGEND, offline map, and world_map.json", () => {
  const required = [
    "grass",
    "sidewalk",
    "residential_road",
    "main_road",
    "highway",
    "water",
    "park",
    "dirt",
    "sand",
  ];
  const legendValues = new Set(Object.values(LEGEND));
  for (const name of required) {
    assert.ok(legendValues.has(name), `LEGEND must contain ground type "${name}"`);
  }

  const offline = buildOfflineMap();
  const offlineTypes = new Set(offline.layers.base.map((id) => offline.legend[String(id)]));
  for (const name of required) {
    assert.ok(offlineTypes.has(name), `Offline map must showcase ground type "${name}"`);
  }

  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const liveTypes = new Set(worldMap.layers.base.map((id) => worldMap.legend[String(id)]));
  for (const name of required) {
    assert.ok(liveTypes.has(name), `data/world_map.json must contain ground type "${name}"`);
  }
});

test("distinct building kinds (13) and residential house architectures (12) classify cleanly", () => {
  assert.equal(classifyBuildingKind({ amenity: "library" }), "library");
  assert.equal(classifyBuildingKind({ amenity: "school" }), "school");
  assert.equal(classifyBuildingKind({ amenity: "place_of_worship" }), "civic");
  assert.equal(classifyBuildingKind({ amenity: "fire_station" }), "fire_station");
  assert.equal(classifyBuildingKind({ building: "greenhouse" }), "greenhouse");
  assert.equal(classifyBuildingKind({ shop: "bakery" }), "bakery_cafe");
  assert.equal(classifyBuildingKind({ shop: "books" }), "corner_market");
  assert.equal(classifyBuildingKind({ building: "office" }), "office_plaza");
  assert.equal(classifyBuildingKind({ building: "commercial" }), "commercial");
  assert.equal(classifyBuildingKind({ building: "apartments" }), "apartments");
  assert.equal(classifyBuildingKind({ building: "garage" }), "garage");
  assert.equal(
    classifyBuildingKind({ building: "yes" }, { minX: 0, minY: 0, maxX: 1, maxY: 1 }, "", ""),
    "garage"
  );
  assert.equal(
    classifyBuildingKind({ building: "yes" }, { minX: 0, minY: 0, maxX: 3, maxY: 3 }, "12;14 Centre St", ""),
    "duplex"
  );

  // Home Base stays classic Colonial; OSM tags & footprints select appropriate architectures across all 12 styles
  assert.equal(classifyHouseArch({ isHomeBase: true }), "colonial");
  assert.equal(classifyHouseArch({ tags: { "building:architecture": "tudor" } }), "tudor");
  assert.equal(classifyHouseArch({ tags: { building: "villa" } }), "victorian");
  assert.equal(classifyHouseArch({ tags: { "building:architecture": "craftsman" } }), "craftsman");
  assert.equal(classifyHouseArch({ tags: { "roof:shape": "gambrel" } }), "gambrel");
  assert.equal(classifyHouseArch({ tags: { "building:architecture": "brownstone" } }), "brownstone");
  assert.equal(classifyHouseArch({ tags: { "building:architecture": "stone" } }), "stone_manor");
  assert.equal(classifyHouseArch({ tags: { "roof:shape": "saltbox" } }), "saltbox");
  assert.equal(classifyHouseArch({ tags: { building: "farmhouse" } }), "farmhouse");
  assert.equal(classifyHouseArch({ tags: { building: "bungalow" } }), "ranch");
  assert.equal(classifyHouseArch({ tags: { "roof:shape": "skillion" } }), "modern");

  // Live world_map.json contains all 12 residential architectures & all 13 building kinds!
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  assert.equal(HOUSE_ARCH_TYPES.length, 12);
  const archs = new Set(worldMap.buildings.filter((b) => b.arch).map((b) => b.arch));
  for (const a of HOUSE_ARCH_TYPES) {
    assert.ok(archs.has(a), `world_map.json should include residential house architecture "${a}"`);
  }
  const kinds = new Set(worldMap.buildings.map((b) => b.kind));
  for (const k of [
    "house",
    "duplex",
    "garage",
    "greenhouse",
    "commercial",
    "bakery_cafe",
    "corner_market",
    "office_plaza",
    "fire_station",
    "apartments",
    "library",
    "school",
    "civic",
  ]) {
    assert.ok(kinds.has(k), `world_map.json should include building kind "${k}"`);
  }
});

test("resolveHouseStyle applies arch and kind overrides from house_colors.json", () => {
  const houseColors = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "house_colors.json"), "utf8")
  );
  const overrideMap = {};
  for (const [k, v] of Object.entries(houseColors)) {
    if (k.startsWith("_")) continue;
    overrideMap[normalizeAddress(k)] = v;
  }

  const tudorNeighbor = resolveHouseStyle(
    { id: "osm_2", address: "559 Boylston St", kind: "house", bounds: { minX: 1, minY: 1, maxX: 4, maxY: 4 } },
    overrideMap
  );
  assert.equal(tudorNeighbor.arch, "tudor");
  assert.equal(tudorNeighbor.label, "Cream Stucco");

  const medicalShop = resolveHouseStyle(
    { id: "osm_3", address: "575 Boylston St", kind: "house", bounds: { minX: 1, minY: 1, maxX: 5, maxY: 4 } },
    overrideMap
  );
  assert.equal(medicalShop.overrideKind, "commercial");
  assert.ok(BUILDING_STYLE_PRESETS.victorian);
});

test("safety system differentiates highway caution vs walkable parks, dirt trails, and sand beaches", () => {
  const offline = buildOfflineMap();
  const safety = createSafetySystem(offline);

  assert.equal(safety.getSpeedMultiplier("highway", true, false), 1);
  assert.ok(safety.getSpeedMultiplier("park", true, false) > 1);
  assert.ok(safety.getSpeedMultiplier("dirt", true, false) > 1);
  assert.ok(safety.getSpeedMultiplier("sand", true, false) > 1);
  assert.ok(
    safety.getSpeedMultiplier("sand", true, false) < safety.getSpeedMultiplier("sidewalk", true, false),
    "sand should feel slightly softer/slower than smooth sidewalk"
  );

  // Standing beside Boylston Highway away from crosswalk triggers highway caution (+3 XP)
  const boylstonY = Math.floor(offline.dimensions.height / 2) + 4;
  const hwRes = safety.inspectCrossingContext(10, boylstonY - 2);
  assert.equal(hwRes.context, "highway");
  assert.equal(hwRes.xpReward, 3);
});

test("OSM rasterizer classifies unpaved dirt paths, sandy beaches, parks, and Boylston highway", () => {
  const originLat = 42.3192;
  const originLon = -71.1927;
  const elements = [
    {
      type: "way",
      id: 10,
      tags: { highway: "primary", name: "Boylston Street" },
      geometry: [
        { lat: originLat, lon: originLon - 0.0008 },
        { lat: originLat, lon: originLon + 0.0008 },
      ],
    },
    {
      type: "way",
      id: 11,
      tags: { highway: "path", surface: "dirt", name: "Oakdale Trail" },
      geometry: [
        { lat: originLat - 0.0004, lon: originLon - 0.0005 },
        { lat: originLat - 0.0004, lon: originLon + 0.0005 },
      ],
    },
    {
      type: "way",
      id: 12,
      tags: { natural: "beach" },
      geometry: [
        { lat: originLat + 0.0006, lon: originLon - 0.0002 },
        { lat: originLat + 0.0006, lon: originLon + 0.0002 },
        { lat: originLat + 0.0003, lon: originLon + 0.0002 },
        { lat: originLat + 0.0003, lon: originLon - 0.0002 },
        { lat: originLat + 0.0006, lon: originLon - 0.0002 },
      ],
    },
  ];

  const map = rasterizeOsmData(elements, {
    width: 64,
    height: 64,
    scaleMetersPerTile: 5,
    origin: { lat: originLat, lon: originLon, name: "Test Origin" },
  });

  const ids = new Set(map.layers.base);
  assert.ok(ids.has(TILE_IDS.HIGHWAY), "Boylston St primary road should rasterize as HIGHWAY");
  assert.ok(ids.has(TILE_IDS.DIRT), "Unpaved dirt trail should rasterize as DIRT");
  assert.ok(ids.has(TILE_IDS.SAND), "Beach polygon should rasterize as SAND");
});

test("mandatory look-both-ways blocks stepping onto any road until checked, then resets after crossing without trapping mid-road", () => {
  // 7x7 grid:
  // row 2 = sidewalk, row 3 = highway, row 4 = crosswalk, row 5 = sidewalk
  const width = 7;
  const height = 7;
  const base = new Array(width * height).fill(TILE_IDS.GRASS);
  const collision = new Array(width * height).fill(0);
  for (let x = 0; x < width; x++) {
    base[2 * width + x] = TILE_IDS.SIDEWALK;
    base[3 * width + x] = TILE_IDS.HIGHWAY;
    base[4 * width + x] = TILE_IDS.CROSSWALK;
    base[5 * width + x] = TILE_IDS.SIDEWALK;
  }

  const map = {
    tileSize: TILE_SIZE,
    dimensions: { width, height },
    legend: { ...LEGEND },
    layers: { base, collision },
    streetZones: [],
  };
  const collider = createMapCollider(map);
  const safety = createSafetySystem(map);

  // Start on north sidewalk at tile (3, 2) -> center (56, 40); highway starts at y = 48
  const p = {
    x: 3 * TILE_SIZE + 8,
    y: 2 * TILE_SIZE + 11, // hitbox bottom = 48 (right at curb edge!)
    facing: "down",
    safeCrossingTimer: 0,
    hasEnteredRoadSinceLook: false,
  };

  // 1. Trying to walk south into highway WITHOUT looking both ways MUST be blocked!
  const blockedAttempt = safety.createRoadAwareBlocker(
    collider.isBoxBlocked,
    p.x,
    p.y,
    p.safeCrossingTimer > 0,
    DEFAULT_HITBOX
  );
  const resBlocked = moveWithCollision(p, { x: 0, y: 1 }, 0.1, blockedAttempt.isBoxBlocked);
  assert.equal(resBlocked.y, p.y, "player must stop at the curb without looking both ways");
  assert.equal(blockedAttempt.wasBlockedByRoad(), true);

  // 2. Walking parallel east along the sidewalk MUST stay smooth & unblocked!
  const parallelAttempt = safety.createRoadAwareBlocker(
    collider.isBoxBlocked,
    p.x,
    p.y,
    false,
    DEFAULT_HITBOX
  );
  const resParallel = moveWithCollision(p, { x: 1, y: 0 }, 0.1, parallelAttempt.isBoxBlocked);
  assert.ok(resParallel.x > p.x, "sidewalk walking parallel to road must remain unblocked");
  assert.equal(parallelAttempt.wasBlockedByRoad(), false);

  // 3. Look Both Ways -> safeCrossingTimer activates -> stepping onto highway succeeds!
  p.safeCrossingTimer = SAFE_CROSSING_DURATION_SEC;
  p.hasEnteredRoadSinceLook = false;
  const allowedAttempt = safety.createRoadAwareBlocker(
    collider.isBoxBlocked,
    p.x,
    p.y,
    p.safeCrossingTimer > 0,
    DEFAULT_HITBOX
  );
  const resCross = moveWithCollision(p, { x: 0, y: 1 }, 0.2, allowedAttempt.isBoxBlocked);
  assert.ok(resCross.y > p.y, "player can step into road after looking both ways");
  p.x = resCross.x;
  p.y = resCross.y;
  assert.equal(safety.isBoxOnRoad(p.x, p.y, DEFAULT_HITBOX), true);
  assert.equal(safety.updateCrossingProgress(p, true).finishedCrossing, false);
  assert.equal(p.hasEnteredRoadSinceLook, true);

  // 4. Even if safeCrossingTimer expires while STILL mid-road, player is NEVER trapped!
  p.safeCrossingTimer = 0;
  const midRoadAttempt = safety.createRoadAwareBlocker(
    collider.isBoxBlocked,
    p.x,
    p.y,
    false,
    DEFAULT_HITBOX
  );
  const resMidRoad = moveWithCollision(p, { x: 0, y: 1 }, 0.2, midRoadAttempt.isBoxBlocked);
  assert.ok(resMidRoad.y > p.y, "player already in road must be able to finish crossing");

  // 5. Reaching the far south sidewalk finishes the crossing & resets safeCrossingTimer!
  p.safeCrossingTimer = 3.0;
  p.y = 5 * TILE_SIZE + 8; // completely on south sidewalk (off road)
  assert.equal(safety.isBoxOnRoad(p.x, p.y, DEFAULT_HITBOX), false);
  const finish = safety.updateCrossingProgress(p, false);
  assert.equal(finish.finishedCrossing, true);
  assert.equal(p.safeCrossingTimer, 0, "safeCrossingTimer must reset after finishing a crossing");
  assert.equal(p.hasEnteredRoadSinceLook, false);

  // 6. Trying to step back north into the crosswalk without looking again is blocked!
  p.y = 5 * TILE_SIZE + 5; // hitbox top = 80 (right at south curb)
  const backAttempt = safety.createRoadAwareBlocker(
    collider.isBoxBlocked,
    p.x,
    p.y,
    p.safeCrossingTimer > 0,
    DEFAULT_HITBOX
  );
  const resBack = moveWithCollision(p, { x: 0, y: -1 }, 0.1, backAttempt.isBoxBlocked);
  assert.equal(resBack.y, p.y, "stepping onto next road without looking again must be blocked");
  assert.equal(backAttempt.wasBlockedByRoad(), true);
});

test("multi-lane divided highway places solid impassable median barrier between directions while keeping crosswalks open", () => {
  const offline = buildOfflineMap();
  const { width } = offline.dimensions;
  const boylstonY = Math.floor(offline.dimensions.height / 2) + 4;

  // Mid-block along Boylston St Highway: center row MUST be solid HIGHWAY_MEDIAN, flanked by walkable HIGHWAY lanes
  const midBlockX = 10;
  assert.equal(offline.layers.base[(boylstonY - 1) * width + midBlockX], TILE_IDS.HIGHWAY);
  assert.equal(offline.layers.base[boylstonY * width + midBlockX], TILE_IDS.HIGHWAY_MEDIAN);
  assert.equal(offline.layers.base[(boylstonY + 1) * width + midBlockX], TILE_IDS.HIGHWAY);
  assert.equal(offline.layers.collision[boylstonY * width + midBlockX], 1, "highway median must be solid");

  // Crosswalk across Boylston St MUST stay open (no median blocking crosswalks!)
  const cx = Math.floor(width / 2);
  assert.equal(offline.layers.base[boylstonY * width + cx], TILE_IDS.CROSSWALK);
  assert.equal(offline.layers.collision[boylstonY * width + cx], 0);

  // Even AFTER looking both ways (safeCrossingActive = true), player CANNOT cross the median barrier!
  const collider = createMapCollider(offline);
  const safety = createSafetySystem(offline);
  const p = {
    x: midBlockX * TILE_SIZE + 8,
    y: (boylstonY - 1) * TILE_SIZE + 11, // hitbox bottom touches top of median barrier
    facing: "down",
  };
  const blocker = safety.createRoadAwareBlocker(collider.isBoxBlocked, p.x, p.y, true, DEFAULT_HITBOX);
  const moved = moveWithCollision(p, { x: 0, y: 1 }, 0.1, blocker.isBoxBlocked);
  assert.equal(moved.y, p.y, "player must not be able to cross the highway median barrier");
  assert.equal(blocker.wasBlockedByMedian(), true);

  // Live 512x512 world_map.json has solid highway_median tiles right along Route 9 / Boylston St
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const medianCount = worldMap.layers.base.filter((id) => id === TILE_IDS.HIGHWAY_MEDIAN).length;
  assert.ok(medianCount > 100, "world_map.json must contain divided highway median barrier tiles");
});

test("every road has an unobstructed continuous sidewalk, zero buildings overlap sidewalks, and sidepaths are walking paths (not roads)", () => {
  // 1. OSM highway=service sidepaths/driveways must rasterize as walkable paths, NEVER residential roads
  const originLat = 42.3192;
  const originLon = -71.1927;
  const serviceMap = rasterizeOsmData(
    [
      {
        type: "way",
        id: 99,
        tags: { highway: "service", service: "driveway" },
        geometry: [
          { lat: originLat, lon: originLon - 0.0005 },
          { lat: originLat, lon: originLon + 0.0005 },
        ],
      },
    ],
    { width: 48, height: 48, scaleMetersPerTile: 5, origin: { lat: originLat, lon: originLon, name: "Test" } }
  );
  assert.equal(
    serviceMap.layers.base.includes(TILE_IDS.RESIDENTIAL_ROAD),
    false,
    "highway=service sidepath/driveway must not become a residential road"
  );
  assert.equal(
    serviceMap.layers.base.includes(TILE_IDS.SIDEWALK),
    true,
    "paved highway=service sidepath/driveway should become a walkable sidewalk/path"
  );

  // 2. Live 512x512 world_map.json invariants:
  //    a) Zero drivable roads touch a BUILDING_WALL tile (cardinally or diagonally)
  //    b) Zero building bounds overlap a sidewalk or road tile
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const isDrivable = (t) => t === TILE_IDS.RESIDENTIAL_ROAD || t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.HIGHWAY;
  const isPathOrRoad = (t) =>
    t === TILE_IDS.SIDEWALK ||
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.CROSSWALK ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.HIGHWAY_MEDIAN ||
    t === TILE_IDS.DIRT;

  let roadTouchesWall = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!isDrivable(base[y * width + x])) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (base[(y + dy) * width + (x + dx)] === TILE_IDS.BUILDING_WALL) {
            roadTouchesWall++;
          }
        }
      }
    }
  }
  assert.equal(roadTouchesWall, 0, "no road tile may touch a building wall (must have continuous sidewalk)");

  let overlappingBuildings = 0;
  for (const b of worldMap.buildings) {
    const { minX, minY, maxX, maxY } = b.bounds;
    let bad = false;
    for (let y = minY; y <= maxY && !bad; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (isPathOrRoad(base[y * width + x])) {
          bad = true;
          break;
        }
      }
    }
    if (bad) overlappingBuildings++;
  }
  assert.equal(overlappingBuildings, 0, "zero buildings may have rendered bounds overlapping sidewalks or roads");
});

test("parks automatically feature baseball diamonds, basketball hoops/courts, soccer fields, and playgrounds", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const features = buildParkFeatures(worldMap);
  const fieldKinds = new Set(features.fields.map((f) => f.kind));
  const propSprites = new Set(features.props.map((p) => p.sprite));

  assert.ok(fieldKinds.has("baseball_diamond"), "parks should include baseball diamonds");
  assert.ok(fieldKinds.has("basketball_court"), "parks should include basketball courts");
  assert.ok(fieldKinds.has("soccer_field"), "parks should include soccer fields");
  assert.ok(fieldKinds.has("playground"), "parks should include playgrounds");
  assert.ok(propSprites.has("baseball_backstop"), "baseball diamonds should include standing backstops");
  assert.ok(propSprites.has("hoop_left") && propSprites.has("hoop_right"), "basketball courts should include standing hoops");
  assert.ok(propSprites.has("soccer_goal_left") && propSprites.has("soccer_goal_right"), "soccer fields should include standing goals");
  assert.ok(propSprites.has("swing_set"), "playgrounds should include swing sets");

  // Also verify offline map gets park fields cleanly
  const offlineFeatures = buildParkFeatures(buildOfflineMap());
  assert.ok(offlineFeatures.fields.length >= 2, "offline map parks should include athletic fields");
});

test("all 25 neighborhood landmarks are within bounds, snap cleanly off-road, and have valid reward metadata", async () => {
  const { createQuestSystem, getItemMeta } = await import("../src/quests.js");
  const { isRoadTileType } = await import("../src/safety.js");
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const landmarks = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "landmarks.json"), "utf8")
  );
  const quests = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "quests.json"), "utf8")
  );
  assert.ok(landmarks.length >= 20, "neighborhood should have rich landmark coverage for navigation");

  const { width, height } = worldMap.dimensions;
  const qs = createQuestSystem({ landmarks, quests, worldMap });
  for (const npc of qs.npcs) {
    assert.ok(npc.tileX >= 0 && npc.tileX < width && npc.tileY >= 0 && npc.tileY < height);
    const idx = npc.walkTileY * width + npc.walkTileX;
    assert.equal(worldMap.layers.collision[idx], 0, `${npc.id} must be walkable`);
    const tileType = worldMap.legend[String(worldMap.layers.base[idx])];
    assert.equal(isRoadTileType(tileType), false, `${npc.id} should stand off-road (got ${tileType})`);
    if (npc.rewardItem) {
      assert.ok(getItemMeta(npc.rewardItem).name, `${npc.id} reward item must have metadata`);
    }
  }
});

test("road polyline simplification & grid path smoothing erase small bends and parking-lot road clutter", () => {
  // 1. Vector polyline with a tiny 1-tile wiggle along a horizontal block snaps into a clean straight run
  const wiggly = [
    { x: 10, y: 20 },
    { x: 16, y: 21 },
    { x: 22, y: 20 },
    { x: 30, y: 21 },
    { x: 40, y: 20 },
  ];
  const clean = simplifyRoadPolyline(wiggly, { epsilon: 2.4 });
  assert.equal(clean.length, 2, "small 1-tile wiggles should collapse into one clean straight segment");
  assert.equal(clean[0].y, clean[1].y, "straightened horizontal road should share one Y row");

  // 2. Grid smoothing converts parking-lot road aisles to PARKING_LOT, prunes stray crosswalks, and flattens 1-tile road wiggles
  const w = 16;
  const h = 12;
  const base = new Array(w * h).fill(TILE_IDS.GRASS);
  // Horizontal residential road at y=3 with a 1-tile downward wiggle at x=6..8
  for (let x = 2; x <= 13; x++) base[3 * w + x] = TILE_IDS.RESIDENTIAL_ROAD;
  for (let x = 6; x <= 8; x++) {
    base[3 * w + x] = TILE_IDS.SIDEWALK;
    base[4 * w + x] = TILE_IDS.RESIDENTIAL_ROAD;
  }
  // Parking lot with an interior residential_road aisle at (4, 8)
  for (let y = 7; y <= 9; y++) {
    for (let x = 3; x <= 5; x++) base[y * w + x] = TILE_IDS.PARKING_LOT;
  }
  base[8 * w + 4] = TILE_IDS.RESIDENTIAL_ROAD;
  // Stray isolated crosswalk sitting on a plaza sidewalk (away from any road) at (12, 9)
  for (let x = 10; x <= 14; x++) base[9 * w + x] = TILE_IDS.SIDEWALK;
  base[9 * w + 12] = TILE_IDS.CROSSWALK;

  simplifyGridPaths(base, w, h);

  assert.equal(base[3 * w + 7], TILE_IDS.RESIDENTIAL_ROAD, "1-tile road wiggle should flatten onto row 3");
  assert.notEqual(base[4 * w + 7], TILE_IDS.RESIDENTIAL_ROAD, "displaced road wiggle bulge should be cleared off row 4");
  assert.equal(base[8 * w + 4], TILE_IDS.PARKING_LOT, "parking-lot aisle should become walkable parking_lot");
  assert.equal(base[9 * w + 12], TILE_IDS.SIDEWALK, "stray off-road crosswalk in a plaza should become sidewalk");
});

test("enlargeBuildingFootprints scales small houses to SNES proportions while keeping neighbor separation and road clearance", () => {
  const w = 20;
  const h = 16;
  const base = new Array(w * h).fill(TILE_IDS.GRASS);
  // Two small 2x2 houses separated by grass, plus a road along bottom row y=14
  for (let x = 0; x < w; x++) {
    base[13 * w + x] = TILE_IDS.SIDEWALK;
    base[14 * w + x] = TILE_IDS.RESIDENTIAL_ROAD;
  }
  const buildings = [
    { id: "h1", kind: "house", bounds: { minX: 3, minY: 9, maxX: 4, maxY: 10 } },
    { id: "h2", kind: "house", bounds: { minX: 10, minY: 9, maxX: 11, maxY: 10 } },
  ];
  for (const b of buildings) {
    for (let y = b.bounds.minY; y <= b.bounds.maxY; y++) {
      for (let x = b.bounds.minX; x <= b.bounds.maxX; x++) base[y * w + x] = TILE_IDS.BUILDING_WALL;
    }
  }

  const grown = enlargeBuildingFootprints(buildings, base, w, h);
  const b1 = grown[0].bounds;
  const b2 = grown[1].bounds;
  assert.ok(b1.maxX - b1.minX + 1 >= 4, "small house should expand to at least 4 tiles wide");
  assert.ok(b1.maxY - b1.minY + 1 >= 3, "small house should expand to at least 3 tiles tall");
  assert.ok(b2.minX - b1.maxX >= 2, "neighboring houses must retain at least a 1-tile grass gap between them");
  assert.ok(b1.maxY <= 12, "growing house must never encroach onto sidewalk/road");

  // Running a second time must be idempotent!
  const grownAgain = enlargeBuildingFootprints(grown, base, w, h);
  assert.deepEqual(grownAgain[0].bounds, b1, "enlargeBuildingFootprints must be idempotent");
});

test("sidewalk bend-glide smoothly follows a 1-tile diagonal sidewalk bend without bypassing straight road curbs", () => {
  // 8x6 grid:
  // Sidewalk steps 1 tile north as you walk east:
  //   (2,3) & (3,3) = sidewalk; (4,3) = road; (3,2) & (4,2) = sidewalk; (4,4) = road
  const w = 8;
  const h = 6;
  const base = new Array(w * h).fill(TILE_IDS.GRASS);
  const collision = new Array(w * h).fill(0);
  base[3 * w + 2] = TILE_IDS.SIDEWALK;
  base[3 * w + 3] = TILE_IDS.SIDEWALK;
  base[2 * w + 3] = TILE_IDS.SIDEWALK;
  base[2 * w + 4] = TILE_IDS.SIDEWALK;
  base[2 * w + 5] = TILE_IDS.SIDEWALK;
  base[3 * w + 4] = TILE_IDS.RESIDENTIAL_ROAD;
  base[3 * w + 5] = TILE_IDS.RESIDENTIAL_ROAD;
  base[4 * w + 4] = TILE_IDS.RESIDENTIAL_ROAD;

  const map = {
    tileSize: TILE_SIZE,
    dimensions: { width: w, height: h },
    legend: { ...LEGEND },
    layers: { base, collision },
    streetZones: [],
  };
  const collider = createMapCollider(map);
  const safety = createSafetySystem(map);
  const isPreferredPathTile = (tx, ty) => safety.getTileType(tx, ty) === "sidewalk";

  // Player at right edge of sidewalk (3, 3), pressing East straight into the bend where road starts at (4, 3)
  const p = { x: 3 * TILE_SIZE + 11, y: 3 * TILE_SIZE + 8, facing: "right" };
  const blocker = safety.createRoadAwareBlocker(collider.isBoxBlocked, p.x, p.y, false, DEFAULT_HITBOX);
  const moved = moveWithCollision(p, { x: 1, y: 0 }, 0.1, blocker.isBoxBlocked, {
    isPreferredPathTile,
    tileSize: TILE_SIZE,
  });

  assert.equal(moved.glidedBend, true, "walking east into a 1-tile upward sidewalk bend should smoothly glide north");
  assert.ok(moved.y < p.y, "player should smoothly shift north toward continuing sidewalk (4,2)");
  assert.equal(safety.isBoxOnRoad(moved.x, moved.y, DEFAULT_HITBOX), false, "bend-glide must never step onto the road");
});

test("slimOversizedSidewalks trims bloated multi-tile sidewalk slabs down to crisp 1-tile road sidewalks", () => {
  const w = 14;
  const h = 10;
  const base = new Array(w * h).fill(TILE_IDS.GRASS);
  // Horizontal road at y=5 surrounded by an overly fat 3-tile-wide sidewalk slab on top (y=2..4) and bottom (y=6..8)
  for (let x = 1; x < w - 1; x++) {
    for (let y = 2; y <= 8; y++) base[y * w + x] = TILE_IDS.SIDEWALK;
    base[5 * w + x] = TILE_IDS.RESIDENTIAL_ROAD;
  }

  slimOversizedSidewalks(base, w, h);

  // Crisp 1-tile road-adjacent sidewalks at y=4 and y=6 MUST remain intact!
  assert.equal(base[4 * w + 7], TILE_IDS.SIDEWALK, "road-adjacent north sidewalk must stay intact");
  assert.equal(base[6 * w + 7], TILE_IDS.SIDEWALK, "road-adjacent south sidewalk must stay intact");
  // Excess outer sidewalk apron rows y=2,3 and y=7,8 MUST be trimmed back to grass!
  assert.equal(base[2 * w + 7], TILE_IDS.GRASS, "bloated outer sidewalk apron should be trimmed back to grass");
  assert.equal(base[3 * w + 7], TILE_IDS.GRASS, "2nd-row outer sidewalk apron should be trimmed back to grass");
  assert.equal(base[7 * w + 7], TILE_IDS.GRASS, "2nd-row south outer sidewalk apron should be trimmed back to grass");
});

test("Boston College school buildings render as Collegiate Gothic campus halls across live & offline maps", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const houseColors = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "house_colors.json"), "utf8")
  );
  const overrideMap = {};
  for (const [k, v] of Object.entries(houseColors)) {
    if (k.startsWith("_")) continue;
    overrideMap[normalizeAddress(k)] = v;
  }

  // Classify BC buildings cleanly as "school"
  assert.equal(classifyBuildingKind({ building: "yes" }, null, "885 Centre Street", "BC Law — Stuart Hall"), "school");
  assert.equal(classifyBuildingKind({ building: "yes" }, null, "855 Centre Street", "Cushing Hall"), "school");
  assert.equal(classifyBuildingKind({ building: "yes" }, null, "", "Boston College Law Library"), "library");

  // Live 512x512 world_map.json includes >= 10 BC school buildings (Stuart Hall, Duchesne, Cushing, Hardey, Barat, Keyes, Messina, etc.)
  const bcSchools = worldMap.buildings.filter((b) => b.bcCampus && b.kind === "school");
  assert.ok(bcSchools.length >= 10, `expected >= 10 BC school buildings, found ${bcSchools.length}`);

  const stuart = bcSchools.find((b) => b.id === "bc_law_stuart_west");
  const eastWing = bcSchools.find((b) => b.id === "bc_law_east_wing");
  const duchesne = bcSchools.find((b) => b.id === "bc_duchesne_hall");
  assert.ok(stuart && eastWing && duchesne, "BC Law Stuart Hall, East Wing, and Duchesne Hall must exist");

  const bcStyle = resolveHouseStyle(stuart, overrideMap);
  assert.equal(bcStyle.label, "BC Collegiate Gothic");
  assert.equal(bcStyle.overrideKind, "school");

  // Offline demo map also showcases a Boston College school building
  const offline = buildOfflineMap();
  assert.ok(
    offline.buildings.some((b) => b.bcCampus && b.kind === "school"),
    "offline map should include a Boston College school building"
  );
});

test("Newton graveyards feature spooky tombstones, crypts, ghosts, bats, pumpkins & stay free of park sports courts", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const { width } = worldMap.dimensions;
  const base = worldMap.layers.base;

  const gf = buildGraveyardFeatures(worldMap);
  assert.ok(gf.zones.length >= 2, "live Newton map should include both East Parish Burying Ground & Newton Cemetery");
  const propKinds = new Set(gf.props.map((p) => p.kind));
  for (const required of ["tombstone", "gate", "mausoleum", "obelisk", "spooky_tree", "pumpkin", "lantern", "fence", "black_cat"]) {
    assert.ok(propKinds.has(required), `graveyards must feature spooky prop kind "${required}"`);
  }
  assert.ok(gf.ghosts.length >= 4, "graveyards should have friendly floating ghosts");
  assert.ok(gf.bats.length >= 2, "graveyards should have flapping pixel bats");
  assert.ok(gf.wisps.length >= 4, "graveyards should have ghostly will-o'-the-wisps");

  // Every graveyard prop sits strictly off roads, sidewalks, water, and building walls
  for (const prop of gf.props) {
    const t = base[prop.ty * width + prop.tx];
    assert.ok(
      t === TILE_IDS.GRASS || t === TILE_IDS.PARK || t === TILE_IDS.TALL_GRASS,
      `spooky prop ${prop.sprite} at (${prop.tx},${prop.ty}) must sit on open turf (got tile ${t})`
    );
  }

  // Park athletic fields must NEVER overlap graveyard zones (e.g., East Parish Burying Ground)
  const parkFeatures = buildParkFeatures(worldMap, gf.graveyardGrid);
  for (const field of parkFeatures.fields) {
    for (let y = field.ty; y < field.ty + field.h; y++) {
      for (let x = field.tx; x < field.tx + field.w; x++) {
        assert.equal(
          gf.graveyardGrid[y * width + x],
          0,
          `park field ${field.id} must not overlap graveyard at (${x},${y})`
        );
      }
    }
  }

  // Offline demo map also generates spooky graveyard features
  const offlineGf = buildGraveyardFeatures(buildOfflineMap());
  assert.ok(offlineGf.props.length > 0 && offlineGf.ghosts.length > 0, "offline map should include spooky graveyard props & ghosts");
});

test("truly wooded forest areas receive dense New England tree canopies while keeping yards, trails & graveyards clean", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const gf = buildGraveyardFeatures(worldMap);
  const pf = buildParkFeatures(worldMap, gf.graveyardGrid);
  const treeGrid = buildWoodlandTreeGrid(worldMap, pf.occupiedGrid, gf.graveyardGrid);

  let woodsTiles = 0;
  let woodsTrees = 0;
  let parkTiles = 0;
  let parkTrees = 0;
  for (let i = 0; i < width * height; i++) {
    const t = base[i];
    if (treeGrid[i] !== 0) {
      assert.equal(gf.graveyardGrid[i], 0, "green oak/pine trees must not overwrite spooky graveyard turf");
      assert.equal(pf.occupiedGrid[i], 0, "trees must not spawn inside athletic park fields");
      assert.ok(t === TILE_IDS.GRASS || t === TILE_IDS.TALL_GRASS || t === TILE_IDS.PARK, "trees must sit only on green ground");
    }
    if (t === TILE_IDS.TALL_GRASS && gf.graveyardGrid[i] === 0) {
      woodsTiles++;
      if (treeGrid[i] !== 0) woodsTrees++;
    } else if (t === TILE_IDS.PARK && gf.graveyardGrid[i] === 0 && pf.occupiedGrid[i] === 0) {
      parkTiles++;
      if (treeGrid[i] !== 0) parkTrees++;
    }
  }

  const woodsDensity = woodsTrees / Math.max(1, woodsTiles);
  const parkDensity = parkTrees / Math.max(1, parkTiles);
  assert.ok(
    woodsDensity >= 0.35,
    `truly wooded areas should have dense tree canopy >= 35% (got ${(woodsDensity * 100).toFixed(1)}%)`
  );
  assert.ok(
    woodsDensity > parkDensity * 8,
    `woods density (${(woodsDensity * 100).toFixed(1)}%) should be dramatically denser than manicured parks (${(parkDensity * 100).toFixed(1)}%)`
  );
});

test("highway median barriers always run in strictly straight unbroken lines with zero bends or isolated stubs", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;

  let medianCount = 0;
  let isolated = 0;
  let bends = 0;
  let diagTouches = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (base[y * width + x] !== TILE_IDS.HIGHWAY_MEDIAN) continue;
      medianCount++;
      const n = base[(y - 1) * width + x] === TILE_IDS.HIGHWAY_MEDIAN;
      const s = base[(y + 1) * width + x] === TILE_IDS.HIGHWAY_MEDIAN;
      const w = base[y * width + (x - 1)] === TILE_IDS.HIGHWAY_MEDIAN;
      const e = base[y * width + (x + 1)] === TILE_IDS.HIGHWAY_MEDIAN;
      if (!n && !s && !w && !e) isolated++;
      if ((n || s) && (w || e)) bends++;
      if (
        base[(y - 1) * width + (x - 1)] === TILE_IDS.HIGHWAY_MEDIAN ||
        base[(y - 1) * width + (x + 1)] === TILE_IDS.HIGHWAY_MEDIAN ||
        base[(y + 1) * width + (x - 1)] === TILE_IDS.HIGHWAY_MEDIAN ||
        base[(y + 1) * width + (x + 1)] === TILE_IDS.HIGHWAY_MEDIAN
      ) {
        diagTouches++;
      }
    }
  }

  assert.ok(medianCount >= 100, `expected substantial highway barriers (got ${medianCount})`);
  assert.equal(isolated, 0, "highway barriers must have zero isolated 1-tile stubs");
  assert.equal(bends, 0, "highway barriers must never form L-bends or T-junctions");
  assert.equal(diagTouches, 0, "highway barriers must never stair-step diagonally");
});
