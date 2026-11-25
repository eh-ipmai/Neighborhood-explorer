import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SUBGRID_DIV, getNavigationSubgrid } from "../src/subgrid.js";
import { createMapCollider, moveWithCollision, DEFAULT_HITBOX, TILE_SIZE } from "../src/player.js";
import { createSafetySystem, resolveActionIntent } from "../src/safety.js";
import { buildRoadTraffic, updateRoadTraffic, checkTrafficCollision, isVehicleFootprintOnRoad } from "../src/traffic.js";

function loadLiveMap() {
  return JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
}

test("4px sub-cell navigation grid subdivides every 16px tile into 4x4 sub-cells aligned with vectorRoads", () => {
  const worldMap = loadLiveMap();
  const sg = getNavigationSubgrid(worldMap);

  assert.equal(SUBGRID_DIV, 4);
  assert.equal(sg.subCellSize, 4, "sub-cells must be 4px (1/4 of 16px tiles)");
  assert.equal(sg.subW, worldMap.dimensions.width * 4);
  assert.equal(sg.subH, worldMap.dimensions.height * 4);
  assert.equal(sg.hasVectorRoads, true);

  // Caching returns the exact same WeakMap instance
  assert.equal(getNavigationSubgrid(worldMap), sg);

  // Home Base spawn must be strictly walkable & off-road on the 4px subgrid!
  const spawn = worldMap.origin.spawnTile;
  const spX = spawn.x * TILE_SIZE + TILE_SIZE / 2;
  const spY = spawn.y * TILE_SIZE + TILE_SIZE / 2;
  const collider = createMapCollider(worldMap);
  const safety = createSafetySystem(worldMap);
  assert.equal(
    collider.isBoxBlocked(spX, spY, DEFAULT_HITBOX),
    false,
    "Home Base spawn must not be blocked on 4px subgrid"
  );
  assert.equal(
    safety.isBoxOnRoad(spX, spY, DEFAULT_HITBOX),
    false,
    "Home Base spawn must sit cleanly off-road on the sidewalk"
  );

  // Verify sub-tile precision: a diagonal vector road leaves partial corners of 16px tiles walkable
  const synthetic = {
    tileSize: 16,
    dimensions: { width: 20, height: 20 },
    legend: { "0": "grass", "1": "sidewalk", "2": "residential_road", "3": "main_road", "4": "crosswalk", "12": "highway", "13": "highway_median" },
    layers: {
      base: new Array(400).fill(1),
      collision: new Array(400).fill(0),
    },
    streetZones: [],
    vectorRoads: {
      version: 1,
      roads: [
        {
          id: "diag_ave",
          name: "Diagonal Ave",
          cls: "main",
          lanes: 2,
          lanesFwd: 1,
          lanesBwd: 1,
          oneway: false,
          divider: "double_yellow",
          widthTiles: 1.2,
          pts: [2, 10, 18, 6],
        },
      ],
      crosswalks: [],
      turningCircles: [],
      medians: [],
    },
  };
  const synSg = getNavigationSubgrid(synthetic);
  let mixedTiles = 0;
  for (let ty = 4; ty <= 12; ty++) {
    for (let tx = 2; tx <= 17; tx++) {
      let roadSubs = 0;
      let walkSubs = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          if (synSg.isRoadAtSub(tx * 4 + dx, ty * 4 + dy)) roadSubs++;
          else walkSubs++;
        }
      }
      if (roadSubs > 0 && walkSubs > 0) mixedTiles++;
    }
  }
  assert.ok(
    mixedTiles >= 10,
    `4px sub-cells must resolve fine sub-tile curbs along diagonal streets (found ${mixedTiles} mixed tiles)`
  );
});

test("Liam glides smoothly along curved 4px sidewalks and stops crisply at straight curbs to Look Both Ways", () => {
  // Synthetic gently-curving street running E-W with a slight northward bend
  const map = {
    tileSize: 16,
    dimensions: { width: 24, height: 16 },
    legend: { "0": "grass", "1": "sidewalk", "2": "residential_road", "3": "main_road", "4": "crosswalk" },
    layers: {
      base: new Array(24 * 16).fill(1),
      collision: new Array(24 * 16).fill(0),
    },
    streetZones: [],
    vectorRoads: {
      version: 1,
      roads: [
        {
          id: "curvy_st",
          name: "Curvy Street",
          cls: "main",
          lanes: 2,
          lanesFwd: 1,
          lanesBwd: 1,
          oneway: false,
          divider: "double_yellow",
          widthTiles: 1.4,
          pts: [2, 8.0, 12, 7.2, 22, 6.4],
        },
      ],
      crosswalks: [],
      turningCircles: [],
      medians: [],
    },
  };

  const collider = createMapCollider(map);
  const safety = createSafetySystem(map);
  const isPreferredPathPx = (px, py) => {
    const t = safety.getTileTypeAtPx(px, py);
    return t === "sidewalk" || t === "grass";
  };

  // Start on the northern sidewalk right next to the gently rising road curb at x=48 (tx=3), y=104 (ty=6.5)
  const player = { x: 48, y: 104, facing: "right" };
  assert.equal(safety.isBoxOnRoad(player.x, player.y, DEFAULT_HITBOX), false, "start must be on sidewalk");

  // Hold RIGHT for 2 seconds -> Liam should smoothly glide east AND gently follow the upward curb curve!
  const startX = player.x;
  for (let i = 0; i < 40; i++) {
    const rb = safety.createRoadAwareBlocker(collider.isBoxBlocked, player.x, player.y, false, DEFAULT_HITBOX);
    const moved = moveWithCollision(player, { x: 1, y: 0 }, 0.05, rb.isBoxBlocked, {
      maxSlidePx: 6,
      isPreferredPathPx,
      tileSize: 16,
    });
    player.x = moved.x;
    player.y = moved.y;
    assert.equal(
      safety.isBoxOnRoad(player.x, player.y, DEFAULT_HITBOX),
      false,
      "gliding along curved sidewalk must NEVER accidentally step onto unchecked asphalt"
    );
  }
  assert.ok(
    player.x - startX > 100,
    `Liam should travel smoothly >100px along curved sidewalk without snagging (moved ${(player.x - startX).toFixed(1)}px)`
  );
  assert.ok(
    player.y < 104,
    `Liam should gently follow the northward curb curve (y moved from 104 to ${player.y.toFixed(1)})`
  );

  // Now walk straight SOUTH into the unchecked road -> MUST stop cleanly at the curb!
  let blockedByRoad = false;
  for (let i = 0; i < 15; i++) {
    const rb = safety.createRoadAwareBlocker(collider.isBoxBlocked, player.x, player.y, false, DEFAULT_HITBOX);
    const moved = moveWithCollision(player, { x: 0, y: 1 }, 0.05, rb.isBoxBlocked, {
      maxSlidePx: 6,
      isPreferredPathPx,
      tileSize: 16,
    });
    player.x = moved.x;
    player.y = moved.y;
    if (rb.wasBlockedByRoad()) {
      blockedByRoad = true;
      break;
    }
  }
  assert.equal(blockedByRoad, true, "walking straight into an unchecked road curb must stop cleanly");

  // Facing directly into the unchecked road curb resolves to look_both_ways via 4px pixel check!
  const intent = resolveActionIntent({
    playerTileX: Math.floor(player.x / 16),
    playerTileY: Math.floor(player.y / 16),
    playerX: player.x,
    playerY: player.y,
    facing: "down",
    isOnRoad: false,
    safeCrossingActive: false,
    nearbyInteraction: { kind: "sign", target: { id: "s1" } },
    isRoadTileFn: safety.isRoadTile,
    isRoadAtPxFn: safety.isRoadAtPx,
  });
  assert.equal(intent.mode, "look_both_ways");
});

test("vector-road traffic stays 100% on paved 4px road lanes (ZERO sidewalk driving) across simulation", () => {
  const worldMap = loadLiveMap();
  const subgrid = getNavigationSubgrid(worldMap);
  const traffic = buildRoadTraffic(worldMap, { spawnTile: worldMap.origin.spawnTile });

  assert.equal(traffic.mode, "vector", "live map must drive traffic on real OSM vector road polylines");
  assert.ok(traffic.vehicles.length >= 60, `expected lively fleet (got ${traffic.vehicles.length})`);

  // Simulate driving near 3 busy Newton focal spots: Home Base/Route 9, Newton Centre, and Comm Ave!
  const focalSpots = [
    { x: worldMap.origin.spawnTile.x * 16 + 8, y: worldMap.origin.spawnTile.y * 16 + 8 },
    { x: 250 * 16, y: 238 * 16 }, // Newton Centre Square (curved & diagonal avenues!)
    { x: 220 * 16, y: 95 * 16 },  // Commonwealth Ave & Ward St
  ];

  let totalChecks = 0;
  let sidewalkViolations = 0;
  let curvedAnglesSeen = 0;
  const violationSamples = [];

  for (const spot of focalSpots) {
    const observer = { x: spot.x, y: spot.y };
    for (let step = 0; step < 30; step++) {
      updateRoadTraffic(traffic, 0.05, observer, worldMap, {
        tileSize: 16,
        safeCrossingActive: false,
      });
      for (const v of traffic.vehicles) {
        if (Math.hypot(v.x - spot.x, v.y - spot.y) > 440) continue;
        totalChecks++;
        if (Math.abs(v.rotDeg || 0) >= 5) curvedAnglesSeen++;
        if (!subgrid.isDrivableAtPx(v.x, v.y) || !isVehicleFootprintOnRoad(subgrid, v.x, v.y, v.dx, v.dy, v.kind)) {
          sidewalkViolations++;
          if (violationSamples.length < 5) {
            violationSamples.push(
              `${v.id} (${v.kind}) at (${v.x.toFixed(1)},${v.y.toFixed(1)}) on surface=${subgrid.getSurfaceTypeAtPx(v.x, v.y)}`
            );
          }
        }
      }
    }
  }

  assert.ok(totalChecks >= 500, `expected >= 500 active vehicle step checks (got ${totalChecks})`);
  assert.ok(curvedAnglesSeen >= 20, `expected cars to smoothly rotate along curved Newton roads (got ${curvedAnglesSeen})`);
  assert.equal(
    sidewalkViolations,
    0,
    `ZERO vehicles may ever drive on a sidewalk/off-road! Violations: ${violationSamples.join("; ")}`
  );

  // Oriented bounding box check: Liam standing safely 12px to the side of a car's lane is NOT hit!
  const sampleCar = traffic.vehicles.find((v) => v.kind === "car");
  const len = Math.hypot(sampleCar.dx, sampleCar.dy) || 1;
  const rnx = -(sampleCar.dy / len);
  const rny = sampleCar.dx / len;
  assert.equal(
    checkTrafficCollision(
      { vehicles: [sampleCar] },
      { x: sampleCar.x + rnx * 12, y: sampleCar.y + rny * 12 }
    ),
    null,
    "standing safely on the sidewalk beside a car's lane must NOT trigger a collision"
  );
  assert.ok(
    checkTrafficCollision({ vehicles: [sampleCar] }, { x: sampleCar.x, y: sampleCar.y }),
    "standing directly in a car's path must still trigger collision"
  );
});
