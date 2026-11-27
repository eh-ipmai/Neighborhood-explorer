import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createStreetSignSystem,
  findVectorRoadIntersections,
  abbreviateStreetName,
  extractHouseNumber,
  extractStreetFromAddress,
  normalizeStreetKey,
} from "../src/streetsigns.js";
import { createQuestSystem } from "../src/quests.js";
import { HERO_OUTFITS } from "../src/tileset.js";
import { normalizeMoveInput } from "../src/player.js";
import { repairStreetConnectivity, prioritizeNewtonCentreRoads, TILE_IDS } from "../scripts/build_map.mjs";

const worldMap = JSON.parse(
  fs.readFileSync(path.resolve("data/world_map.json"), "utf8")
);
const landmarks = JSON.parse(
  fs.readFileSync(path.resolve("data/landmarks.json"), "utf8")
);
const quests = JSON.parse(
  fs.readFileSync(path.resolve("data/quests.json"), "utf8")
);

test("active street sign system places reachable intersection signs across Newton Centre & near Home Base", () => {
  const sys = createStreetSignSystem(worldMap, { landmarks });
  assert.ok(sys.signs.length >= 200, `Expected rich street-sign network, got ${sys.signs.length}`);

  const intersections = sys.signs.filter((s) => s.isIntersection);
  assert.ok(intersections.length >= 100, `Expected >= 100 real cross-street signs, got ${intersections.length}`);

  const { width } = worldMap.dimensions;
  const collision = worldMap.layers.collision;
  for (const s of sys.signs) {
    assert.equal(collision[s.ty * width + s.tx], 0, `Sign ${s.id} (${s.label}) must stand on a walkable tile`);
    assert.ok(s.streets.length >= 1, `Sign ${s.id} must have at least one named street`);
    assert.ok(s.branches.length >= 1, `Sign ${s.id} must include branch metadata`);
  }

  // Must have a street sign easily reachable near Home Base spawn
  const spawn = worldMap.origin.spawnTile;
  const nearSpawn = sys.findNearbySign(spawn.x, spawn.y, 12);
  assert.ok(nearSpawn, "Expected an active street sign within 12 tiles of Home Base spawn");
  assert.ok(nearSpawn.sign.label.length > 0);
  assert.equal(nearSpawn.sign.isIntersection, true, "Nearest sign to Home Base should be a real street intersection");

  // Real-life street-sign placement invariant: signs sit at real geometric intersections, NOT random mid-block spots!
  const geomIntersections = findVectorRoadIntersections(worldMap.vectorRoads);
  assert.ok(geomIntersections.length >= 200, "Expected geometric vectorRoad intersections in Newton Centre");
  const intersectionRatio = intersections.length / Math.max(1, sys.signs.length);
  assert.ok(
    intersectionRatio >= 0.98,
    `Expected >= 98% of street signs to be real intersections (got ${(intersectionRatio * 100).toFixed(1)}%)`
  );
  for (const s of intersections) {
    const nearGeom = geomIntersections.some((g) => Math.hypot(g.x - s.tx, g.y - s.ty) <= 5.5);
    assert.ok(nearGeom, `Intersection sign ${s.id} (${s.label}) must sit right beside a real geometric road intersection`);
  }
});

test("street-sign directions engine computes real street-following turn-by-turn routes", () => {
  const sys = createStreetSignSystem(worldMap, { landmarks });
  const spawn = worldMap.origin.spawnTile;
  const nearHomeSign = sys.findNearbySign(spawn.x, spawn.y, 12).sign;

  const jpLicks = landmarks.find((l) => l.id === "jp_licks");
  assert.ok(jpLicks, "Expected J.P. Licks landmark");

  const route = sys.computeDirections(
    nearHomeSign.tx,
    nearHomeSign.ty,
    jpLicks.tileX,
    jpLicks.tileY,
    "J.P. Licks"
  );

  assert.ok(route.steps.length >= 2, `Expected multi-step directions, got ${route.steps.length}`);
  assert.ok(route.firstDir, "Expected immediate compass departure direction for chalk arrow");
  assert.ok(route.summary.length > 0, "Expected compact tracker summary");
  assert.equal(route.steps[route.steps.length - 1].kind, "arrive");
  assert.ok(
    route.steps.some((st) => st.shortStreet && st.shortStreet.length > 0),
    "Expected at least one named street leg in directions"
  );

  // Nearby landmarks list from sign
  const nearby = sys.getNearbyLandmarksForSign(nearHomeSign, 3);
  assert.ok(nearby.length >= 1, "Expected nearby landmarks from Home Base street sign");
  assert.ok(nearby[0].dir && nearby[0].name);

  // Already-arrived target returns immediate arrival step
  const closeRoute = sys.computeDirections(jpLicks.tileX, jpLicks.tileY, jpLicks.tileX + 1, jpLicks.tileY, "J.P. Licks");
  assert.equal(closeRoute.steps.length, 1);
  assert.equal(closeRoute.steps[0].kind, "arrive");
});

test("quest system records checked street signs, awards first-visit XP, anchors Last Sign, and defaults GPS Assist off", () => {
  const mem = new Map();
  const storage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
    removeItem: (k) => mem.delete(k),
  };

  const sys = createStreetSignSystem(worldMap, { landmarks });
  const sign = sys.signs.find((s) => s.isIntersection);
  assert.ok(sign);

  const qs = createQuestSystem({ landmarks, quests, worldMap, storage });
  assert.equal(qs.state.gpsAssist, false, "Signpost Mode (gpsAssist=false) should be default");
  assert.equal(qs.state.checkedSigns.size, 0);
  assert.equal(qs.state.lastCheckedSignId, null);

  // First read awards +2 XP and logs streets
  const first = qs.recordSignCheck(sign);
  assert.equal(first.isNew, true);
  assert.equal(first.xpEarned, 2);
  assert.equal(qs.state.safetyXP, 2);
  assert.equal(qs.state.lastCheckedSignId, sign.id);
  assert.ok(qs.state.checkedSigns.has(sign.id));
  for (const norm of sign.streetNorms) {
    assert.ok(qs.state.checkedStreets.has(norm));
  }

  // Repeat read does not farm XP
  const second = qs.recordSignCheck(sign);
  assert.equal(second.isNew, false);
  assert.equal(second.xpEarned, 0);
  assert.equal(qs.state.safetyXP, 2);

  // 3-way nav mode cycle: signs -> hard (rotating screen) -> gps -> signs
  assert.equal(qs.state.navMode, "signs");
  assert.equal(qs.cycleNavMode(), "hard");
  assert.equal(qs.state.hardMode, true);
  assert.equal(qs.state.gpsAssist, false);
  assert.equal(qs.cycleNavMode(), "gps");
  assert.equal(qs.state.gpsAssist, true);
  assert.equal(qs.state.hardMode, false);

  // Reload from storage verifies persistence
  const qsReloaded = createQuestSystem({ landmarks, quests, worldMap, storage });
  assert.equal(qsReloaded.state.lastCheckedSignId, sign.id);
  assert.ok(qsReloaded.state.checkedSigns.has(sign.id));
  assert.equal(qsReloaded.state.gpsAssist, true);
  assert.equal(qsReloaded.state.navMode, "gps");

  // Hard Mode persistence & quest selection check
  assert.equal(qsReloaded.setNavMode("hard"), "hard");
  const qsHardReload = createQuestSystem({ landmarks, quests, worldMap, storage });
  assert.equal(qsHardReload.state.navMode, "hard");
  assert.equal(qsHardReload.state.hardMode, true);
  assert.ok(qsHardReload.setActiveQuest("quest_01_first_steps"));
  assert.equal(qsHardReload.getActiveQuest().id, "quest_01_first_steps");

  // Liam's outfits: starts with ONLY Polo & Kippah unlocked; earns Little League, Wetsuit & Link via quests & persists!
  assert.ok(HERO_OUTFITS.polo && HERO_OUTFITS.baseball && HERO_OUTFITS.wetsuit && HERO_OUTFITS.link);
  assert.deepEqual(qsReloaded.getUnlockedOutfits(), ["polo"]);
  assert.equal(qsReloaded.state.heroOutfit, "polo");
  assert.equal(qsReloaded.toggleHeroOutfit(), "polo");
  qsReloaded.unlockOutfit("baseball");
  qsReloaded.unlockOutfit("wetsuit");
  qsReloaded.unlockOutfit("link");
  assert.equal(qsReloaded.toggleHeroOutfit(), "baseball");
  const qsOutfitReload = createQuestSystem({ landmarks, quests, worldMap, storage });
  assert.equal(qsOutfitReload.state.heroOutfit, "baseball");
  assert.equal(qsOutfitReload.toggleHeroOutfit(), "wetsuit");
  assert.equal(qsOutfitReload.toggleHeroOutfit(), "link");
  assert.equal(qsOutfitReload.toggleHeroOutfit(), "polo");
});

test("address helpers hide street names behind porch numbers cleanly in Signpost Mode", () => {
  assert.equal(abbreviateStreetName("Boylston Street"), "Boylston St");
  assert.equal(abbreviateStreetName("Langley Road"), "Langley Rd");
  assert.equal(extractHouseNumber("565 Boylston St"), "#565");
  assert.equal(extractStreetFromAddress("565 Boylston Street"), normalizeStreetKey("Boylston St"));
});

test("Hard Mode heading vectors normalize dead-straight across all 8 compass headings and mid-turn angles", () => {
  for (const deg of [0, 45, 90, 135, 180, 225, 270, 315, 22.5, 112.5]) {
    const rad = (deg * Math.PI) / 180;
    const rawX = Math.sin(rad);
    const rawY = -Math.cos(rad);
    const norm = normalizeMoveInput(rawX, rawY);
    const expectedX = Math.abs(rawX) < 1e-6 ? 0 : rawX;
    const expectedY = Math.abs(rawY) < 1e-6 ? 0 : rawY;
    assert.ok(
      Math.abs(norm.x - expectedX) < 1e-6 && Math.abs(norm.y - expectedY) < 1e-6,
      `Heading ${deg}° drifted: got (${norm.x}, ${norm.y}), expected (${expectedX}, ${expectedY})`
    );
  }
});

test("repairStreetConnectivity reconnects severed street mouths (including Jackson St -> Boylston St) and eliminates tiny road scraps", () => {
  // 1. Synthetic unit test: a severed named street stopping 5 tiles short of a highway gets bridged cleanly at 90 degrees
  const w = 24;
  const h = 24;
  const base = new Array(w * h).fill(TILE_IDS.GRASS);
  // Horizontal highway along y=18..19
  for (let x = 1; x < w - 1; x++) {
    base[18 * w + x] = TILE_IDS.HIGHWAY;
    base[19 * w + x] = TILE_IDS.HIGHWAY;
  }
  // Vertical residential street from y=4..12 at x=12, severed by a parking lot at y=13..17
  for (let y = 4; y <= 12; y++) base[y * w + 12] = TILE_IDS.RESIDENTIAL_ROAD;
  for (let y = 13; y <= 17; y++) {
    for (let x = 10; x <= 14; x++) base[y * w + x] = TILE_IDS.PARKING_LOT;
  }
  const zones = [
    { name: "Jackson Street", type: "residential", bounds: { minX: 11, maxX: 13, minY: 4, maxY: 19 } },
    { name: "Boylston Street", type: "arterial", bounds: { minX: 1, maxX: 22, minY: 17, maxY: 20 } },
  ];
  repairStreetConnectivity(base, zones, w, h);

  // Verify continuous road tiles now connect y=12 down to y=18
  for (let y = 12; y <= 17; y++) {
    assert.equal(
      base[y * w + 12],
      TILE_IDS.RESIDENTIAL_ROAD,
      `Expected clean reconnected road tile at (12, ${y})`
    );
  }

  // 2. Real world_map.json check: Jackson Street reaches Boylston Street continuously (no gap at y=436..443!)
  const mw = worldMap.dimensions.width;
  const mBase = worldMap.layers.base;
  const isRoad = (t) => t === TILE_IDS.RESIDENTIAL_ROAD || t === TILE_IDS.MAIN_ROAD || t === TILE_IDS.HIGHWAY || t === TILE_IDS.CROSSWALK;
  for (let y = 434; y <= 443; y++) {
    let hasRoadInCorridor = false;
    for (let x = 264; x <= 270; x++) {
      if (isRoad(mBase[y * mw + x])) {
        hasRoadInCorridor = true;
        break;
      }
    }
    assert.ok(hasRoadInCorridor, `Expected continuous Jackson St road connection at row y=${y}`);
  }
});

test("Newton Centre proper prioritizes crisp, unbroken roads (Centre St & Cypress St fork, Beacon St, Langley Rd, Pelham St)", () => {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const isRoad = (t) =>
    t === TILE_IDS.RESIDENTIAL_ROAD ||
    t === TILE_IDS.MAIN_ROAD ||
    t === TILE_IDS.HIGHWAY ||
    t === TILE_IDS.CROSSWALK;

  // 1. Cypress St runs continuously south from its Centre St fork (y=246) through y=285 with zero severed gaps
  for (let y = 246; y <= 285; y++) {
    let hasCypressRoad = false;
    for (let x = 244; x <= 259; x++) {
      if (base[y * width + x] === TILE_IDS.MAIN_ROAD || base[y * width + x] === TILE_IDS.CROSSWALK) {
        hasCypressRoad = true;
        break;
      }
    }
    assert.ok(hasCypressRoad, `Expected continuous Cypress St road at row y=${y}`);
  }

  // 2. Centre St & Cypress St separate cleanly south of the fork (distinct roads with sidewalk/block space between them at y=262)
  assert.ok(
    base[262 * width + 236] === TILE_IDS.MAIN_ROAD || base[262 * width + 237] === TILE_IDS.MAIN_ROAD,
    "Centre St SW branch should be a crisp MAIN_ROAD at y=262"
  );
  assert.ok(
    base[262 * width + 247] === TILE_IDS.MAIN_ROAD || base[262 * width + 248] === TILE_IDS.MAIN_ROAD,
    "Cypress St SSE branch should be a crisp MAIN_ROAD at y=262"
  );
  assert.equal(
    isRoad(base[262 * width + 242]),
    false,
    "Centre St and Cypress St should have clean separation between their forked branches at y=262"
  );

  // 3. Pelham St connects cleanly east to Centre St (not swallowed by Pelham St Lot)
  for (let x = 215; x <= 249; x++) {
    let hasPelham = false;
    for (let y = 218; y <= 223; y++) {
      if (isRoad(base[y * width + x])) {
        hasPelham = true;
        break;
      }
    }
    assert.ok(hasPelham, `Expected continuous Pelham St road at column x=${x}`);
  }

  // 4. Crosswalks in Newton Centre proper stay clean and crisp (no giant crosswalk swamps!)
  let ncCrosswalks = 0;
  for (let y = 201; y <= 285; y++) {
    for (let x = 216; x <= 312; x++) {
      if (base[y * width + x] === TILE_IDS.CROSSWALK) ncCrosswalks++;
    }
  }
  assert.ok(ncCrosswalks >= 30 && ncCrosswalks <= 90, `Expected 30..90 crisp crosswalk tiles in Newton Centre proper, got ${ncCrosswalks}`);

  // 5. All major Newton Centre intersections are 4-way road-connected from Centre & Beacon (247, 239)
  const visited = new Set();
  const start = 239 * width + 247;
  assert.ok(isRoad(base[start]), "Centre & Beacon intersection must be a road tile");
  const queue = [start];
  visited.add(start);
  for (let q = 0; q < queue.length; q++) {
    const idx = queue[q];
    const cx = idx % width;
    const cy = (idx - cx) / width;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 208 || nx > 320 || ny < 195 || ny > 292) continue;
      const ni = ny * width + nx;
      if (!visited.has(ni) && isRoad(base[ni])) {
        visited.add(ni);
        queue.push(ni);
      }
    }
  }
  const keyJunctions = [
    ["Centre & Cypress", 246, 246],
    ["Cypress & Braeland", 252, 273],
    ["Cypress & Paul", 255, 280],
    ["Centre & Crescent", 231, 269],
    ["Centre & Langley", 249, 218],
    ["Beacon & Langley/Sumner", 282, 232],
    ["Langley & Union", 293, 239],
    ["Herrick & Union", 265, 249],
    ["Herrick & Braeland", 267, 263],
    ["Sumner & Lyman", 284, 207],
  ];
  for (const [label, jx, jy] of keyJunctions) {
    assert.ok(visited.has(jy * width + jx), `Expected ${label} (${jx},${jy}) to be road-connected to Newton Centre Square`);
  }

  // 6. prioritizeNewtonCentreRoads is strictly idempotent
  const copyA = base.slice();
  prioritizeNewtonCentreRoads(copyA, width, height);
  const copyB = copyA.slice();
  prioritizeNewtonCentreRoads(copyB, width, height);
  assert.deepEqual(copyB, copyA, "prioritizeNewtonCentreRoads must be idempotent");

  // 7. Map-wide consistency: zero bloated crosswalk swamps (>=12 connected crosswalk tiles) anywhere on the 512x512 map!
  const cwVis = new Uint8Array(width * height);
  let bloatedSwamps = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = y * width + x;
      if (base[si] !== TILE_IDS.CROSSWALK || cwVis[si]) continue;
      const q = [si];
      cwVis[si] = 1;
      for (let i = 0; i < q.length; i++) {
        const ci = q[i];
        const cx = ci % width;
        const cy = (ci - cx) / width;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (base[ni] === TILE_IDS.CROSSWALK && !cwVis[ni]) {
            cwVis[ni] = 1;
            q.push(ni);
          }
        }
      }
      if (q.length >= 12) bloatedSwamps++;
    }
  }
  assert.equal(bloatedSwamps, 0, "zero bloated crosswalk swamps (>=12 tiles) should remain map-wide");
});
