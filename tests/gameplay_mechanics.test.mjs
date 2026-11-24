import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createQuestSystem, getItemMeta } from "../src/quests.js";
import {
  buildStreetLife,
  updateStreetLife,
  performSwordAttack,
  performSiddurDispel,
} from "../src/streetlife.js";
import { buildGraveyardFeatures } from "../src/graveyards.js";
import {
  buildRoadTraffic,
  updateRoadTraffic,
  checkTrafficCollision,
} from "../src/traffic.js";
import { HERO_OUTFITS } from "../src/characters.js";
import { computeRoadTileMarkings } from "../src/road_markings.js";
import { createSafetySystem, resolveActionIntent } from "../src/safety.js";
import { createStreetSignSystem } from "../src/streetsigns.js";
import {
  playSwordSlashSfx,
  playSiddurDispelSfx,
  playHealHeartSfx,
  playCarCrashSfx,
  playAmbulanceSirenSfx,
  playGameOverDirge,
  playAnnoyingBikerSfx,
  playEmtRadioBeepSfx,
} from "../src/audio.js";

function loadLiveData() {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const landmarks = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "landmarks.json"), "utf8")
  );
  const quests = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "quests.json"), "utf8")
  );
  return { worldMap, landmarks, quests };
}

test("Salzberg House grants Graveyard Sword, all 4 synagogues grant Pocket Siddur, and treats/doctors/quests heal hearts", () => {
  const { worldMap, landmarks, quests } = loadLiveData();

  // 1. Salzberg House grants Co-Op Badge + Graveyard Sword
  const qs = createQuestSystem({ landmarks, quests, worldMap });
  const salz = qs.interactWithNpc("salzberg_house");
  assert.ok(qs.state.inventory.has("coop_badge"), "Salzberg House should still grant coop_badge");
  assert.ok(qs.state.inventory.has("graveyard_sword"), "Salzberg House must grant graveyard_sword");
  assert.equal(getItemMeta("graveyard_sword").sprite, "item_sword");

  // 2. All 4 synagogues (Beth El, Shaarei Tefillah, Temple Emanuel, Chabad) grant Pocket Siddur!
  for (const synId of [
    "beth_el_atereth_israel",
    "shaarei_tefillah",
    "temple_emanuel",
    "chabad_newton",
  ]) {
    const fresh = createQuestSystem({ landmarks, quests, worldMap });
    const res = fresh.interactWithNpc(synId);
    assert.ok(res, `synagogue landmark "${synId}" must exist`);
    assert.ok(
      fresh.state.inventory.has("pocket_siddur"),
      `synagogue "${synId}" must grant pocket_siddur`
    );
    assert.ok(res.healHearts > 0, `synagogue "${synId}" should heal hearts`);
  }
  assert.equal(getItemMeta("pocket_siddur").sprite, "item_siddur");

  // 3. Doctor's office & J.P. Licks heal hearts (including on revisit!) & quest completion heals hearts
  const docRes1 = qs.interactWithNpc("boylston_medical_plaza");
  assert.equal(docRes1.healHearts, 5, "Dr. Avery band-aid should restore full 5 hearts");
  const docRes2 = qs.interactWithNpc("boylston_medical_plaza");
  assert.equal(docRes2.healHearts, 5, "Revisiting Dr. Avery should still patch up hearts");

  const jpRes = qs.interactWithNpc("jp_licks");
  assert.ok(jpRes.healHearts >= 2, "J.P. Licks ice cream cone should heal hearts");

  // Completing Quest 0 (Bella & Sydney after Salzberg) returns healHearts > 0
  const questCompleteRes = qs.interactWithNpc("bella_sydney_house");
  assert.equal(questCompleteRes.questEvent?.type, "quest_completed");
  assert.ok(questCompleteRes.healHearts >= 2, "Completing a quest must restore hearts");
});

test("real 5-heart health decrements without auto-refill, and Sword & Siddur defeat/dispel bad guys", () => {
  const { worldMap, landmarks } = loadLiveData();
  const gf = buildGraveyardFeatures(worldMap);
  const sl = buildStreetLife(worldMap, {
    graveyardGrid: gf.graveyardGrid,
    graveyardZones: gf.zones,
    landmarks,
  });

  // 1. Bumping a spooky enemy decrements from 5 -> 4 with NO silent heartRefillTimer
  const sp = sl.spookyChars[0];
  const p = {
    x: sp.x + 2,
    y: sp.y,
    facing: "left",
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hearts: 5,
    maxHearts: 5,
  };
  updateStreetLife(sl, 0.05, p, worldMap, { graveyardGhosts: gf.ghosts, elapsedTime: 1 });
  assert.equal(p.hearts, 4, "hitting an enemy should reduce 5 hearts to 4");
  assert.equal(p.heartRefillTimer, undefined, "hearts must not auto-refill silently");

  // 2. Sword slash defeats nearby graveyard enemies & ghosts
  sp.spookTimer = 0;
  const pSword = { x: sp.x - 14, y: sp.y, facing: "right" };
  const swordRes = performSwordAttack(sl, pSword, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 1,
    tileSize: 16,
  });
  assert.ok(swordRes.hitCount >= 1, "Sword attack must defeat nearby graveyard enemy");
  assert.ok(sp.defeatedTimer > 10, "Defeated graveyard enemy must stay vanished during defeatedTimer");

  // 3. Siddur dispel banishes graveyard foes AND calms stubborn protestor mobs!
  const sp2 = sl.spookyChars[1];
  sp2.defeatedTimer = 0;
  const siddurGrave = performSiddurDispel(sl, { x: sp2.x + 12, y: sp2.y }, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 1,
    tileSize: 16,
  });
  assert.ok(siddurGrave.dispelledSpooky >= 1, "Siddur must dispel spooky graveyard foes");

  const mobMember = sl.protestors.find((pr) => pr.isMob);
  assert.ok(mobMember, "world map should include a protestor mob");
  mobMember.yieldTimer = 0;
  const siddurMob = performSiddurDispel(sl, { x: mobMember.x + 10, y: mobMember.y }, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 1,
    tileSize: 16,
  });
  assert.ok(siddurMob.dispelledProtestors >= 1, "Siddur must dispel stubborn protestors/mobs");
  assert.ok(mobMember.yieldTimer >= 10, "Dispelled protestor mob member must step aside cleanly");
});

test("road traffic has heavy highway cars & trucks, lighter side-street traffic, annoying bikers & lethal collision", () => {
  const { worldMap } = loadLiveData();
  const { width } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const drivable = new Set([2, 3, 4, 12]);

  const traffic = buildRoadTraffic(worldMap, { spawnTile: worldMap.origin?.spawnTile });
  const cars = traffic.vehicles.filter((v) => v.kind === "car");
  const trucks = traffic.vehicles.filter((v) => v.kind === "truck");
  const bikes = traffic.vehicles.filter((v) => v.kind === "bike");
  const highwayVehicles = traffic.vehicles.filter((v) => v.roadClass === 12);
  const sideStreetVehicles = traffic.vehicles.filter((v) => v.roadClass === 2);

  assert.ok(cars.length >= 20, `expected >= 20 moving cars, got ${cars.length}`);
  assert.ok(trucks.length >= 10, `expected >= 10 moving trucks, got ${trucks.length}`);
  assert.ok(bikes.length >= 5, `expected >= 5 annoying bikes, got ${bikes.length}`);
  assert.ok(
    highwayVehicles.length > sideStreetVehicles.length,
    `highway traffic (${highwayVehicles.length}) must be much heavier than side-street traffic (${sideStreetVehicles.length})`
  );
  assert.ok(sideStreetVehicles.length >= 3, "side streets should still have some occasional traffic");

  // Every vehicle starts on a drivable road tile
  for (const v of traffic.vehicles) {
    const tx = Math.floor(v.x / 16);
    const ty = Math.floor(v.y / 16);
    assert.ok(drivable.has(base[ty * width + tx]), `vehicle ${v.id} must spawn on a road tile`);
  }

  // Annoying bikers shout chants and trigger onBikerAnnoy when near Liam!
  const bike = bikes[0];
  bike.bellCooldown = 0;
  let annoyed = false;
  updateRoadTraffic(traffic, 0.05, { x: bike.x + 36, y: bike.y }, worldMap, {
    tileSize: 16,
    safeCrossingActive: true,
    onBikerAnnoy: () => {
      annoyed = true;
    },
  });
  assert.ok(annoyed, "annoying biker near Liam must trigger onBikerAnnoy bell/shout");
  assert.ok(bike.bubbleTimer > 0, "annoying biker must pop an obnoxious speech bubble");
  assert.equal(bike.yielded, false, "annoying bikers should NOT politely yield at crosswalks");

  // Stepping directly in front of a moving car or truck triggers lethal collision!
  const car = cars[0];
  const pOnRoad = { x: car.x, y: car.y };
  const hit = checkTrafficCollision(traffic, pOnRoad);
  assert.ok(hit && hit.kind === "car", "overlapping a moving car must report a road hit");

  let hitFired = null;
  updateRoadTraffic(traffic, 0.05, pOnRoad, worldMap, {
    tileSize: 16,
    safeCrossingActive: false,
    onHitPlayer: (h) => {
      hitFired = h;
    },
  });
  assert.ok(hitFired, "updateRoadTraffic must fire onHitPlayer when Liam is hit by traffic");
});

test("residential areas do not have fake cafes/offices on residential addresses", () => {
  const { worldMap } = loadLiveData();
  const commercialKinds = new Set(["commercial", "bakery_cafe", "corner_market", "office_plaza"]);
  const b555 = worldMap.buildings.find((b) => b.address === "555 Boylston Street");
  const b559 = worldMap.buildings.find((b) => b.address === "559 Boylston Street");
  assert.ok(b555 && !commercialKinds.has(b555.kind), "555 Boylston Street must be residential, not commercial");
  assert.ok(b559 && !commercialKinds.has(b559.kind), "559 Boylston Street must be residential, not commercial");

  const commercialCount = worldMap.buildings.filter((b) => commercialKinds.has(b.kind)).length;
  assert.ok(
    commercialCount <= 40,
    `expected commercial buildings to stay focused in real plazas/villages (<= 40), got ${commercialCount}`
  );
});

test("Game starts with Polo/Kippah/Tzitzit only, earns other outfits from quests, and bakes all sprites cleanly", async () => {
  const { worldMap, landmarks, quests } = loadLiveData();
  assert.ok(HERO_OUTFITS.wetsuit, "HERO_OUTFITS must include wetsuit uniform");
  assert.ok(HERO_OUTFITS.link, "HERO_OUTFITS must include Legend of Zelda Link outfit");

  const qs = createQuestSystem({ landmarks, quests, worldMap });
  // Fresh start: ONLY polo & kippah & tzitzit is unlocked!
  assert.deepEqual(qs.getUnlockedOutfits(), ["polo"]);
  assert.equal(qs.state.heroOutfit, "polo");
  assert.equal(qs.toggleHeroOutfit(), "polo", "locked outfits cannot be equipped before completing quests");

  // Completing Quest 0 (Salzberg -> Bella & Sydney) unlocks Little League Uniform!
  qs.interactWithNpc("salzberg_house");
  const q0Done = qs.interactWithNpc("bella_sydney_house");
  assert.equal(q0Done.questEvent?.unlockedOutfit, "baseball");
  assert.deepEqual(qs.getUnlockedOutfits(), ["polo", "baseball"]);
  assert.equal(qs.toggleHeroOutfit(), "baseball");
  assert.equal(qs.toggleHeroOutfit(), "polo");

  // Completing Quest 1 (J.P. Licks -> Newton Free Library) unlocks Summer Wetsuit & Snorkel!
  qs.interactWithNpc("jp_licks");
  const q1Done = qs.interactWithNpc("newton_free_library");
  assert.equal(q1Done.questEvent?.unlockedOutfit, "wetsuit");
  assert.deepEqual(qs.getUnlockedOutfits(), ["polo", "baseball", "wetsuit"]);

  // Completing Quest 2 (Hidden Wooden Chest Riddle) unlocks Link (Hero of Hyrule) Outfit!
  const chest = qs.interactables.find((o) => o.questId === "quest_02_riddle_hunt");
  assert.ok(chest, "Quest 2 hidden chest should exist");
  const q2Done = qs.interactWithChest(chest.id);
  assert.equal(q2Done.questEvent?.unlockedOutfit, "link");
  assert.deepEqual(qs.getUnlockedOutfits(), ["polo", "baseball", "wetsuit", "link"]);
  assert.equal(qs.toggleHeroOutfit(), "baseball");
  assert.equal(qs.toggleHeroOutfit(), "wetsuit");
  assert.equal(qs.toggleHeroOutfit(), "link");
  assert.equal(qs.toggleHeroOutfit(), "polo");

  // Headless sprite baking smoke check for wetsuit, Link, bigger cars/trucks/bikes, cool ambulance, EMTs & sword slash
  const prevDoc = global.document;
  global.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        fillStyle: "",
        fillRect() {},
        clearRect() {},
        drawImage() {},
        translate() {},
        scale() {},
        save() {},
        restore() {},
        getImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData() {},
      }),
    }),
  };
  try {
    const { buildSnesSpriteAtlas } = await import("../src/tileset.js");
    const atlas = buildSnesSpriteAtlas("autumn_golden");
    for (const key of [
      "hero_wetsuit_down_0",
      "hero_wetsuit_up_0",
      "hero_wetsuit_left_1",
      "hero_wetsuit_right_2",
      "hero_wetsuit_scooter_right",
      "hero_wetsuit_fanfare",
      "hero_link_down_0",
      "hero_link_up_0",
      "hero_link_left_1",
      "hero_link_right_2",
      "hero_link_scooter_right",
      "hero_link_fanfare",
      "item_sword",
      "item_siddur",
      "sword_slash_right",
      "traffic_car_0_e",
      "traffic_car_1_n",
      "traffic_car_2_s",
      "traffic_truck_0_e",
      "traffic_truck_1_w",
      "traffic_truck_2_n",
      "traffic_bike_0_w",
      "traffic_bike_1_e",
      "traffic_bike_0_s",
      "traffic_bike_1_n",
      "ambulance_e_0",
      "ambulance_w_1",
      "ambulance_e_open_0",
      "ambulance_w_open_1",
      "police_car_e_0",
      "police_car_w_1",
      "fire_truck_e_0",
      "fire_truck_w_1",
      "emt_right_0",
      "emt_left_1",
      "emt_1_right_0",
      "emt_kneel_right",
      "emt_kneel_1_left",
      "police_officer_right_0",
      "police_officer_left_1",
      "traffic_cone",
      "road_flare_0",
      "road_flare_1",
      "emt_stretcher_empty",
      "emt_stretcher_patient",
      "bubble_emt_help",
      "bubble_emt_lift",
      "bubble_police_stop",
      "bubble_police_tape",
      "bubble_fire_clear",
      "bubble_biker_0",
    ]) {
      assert.ok(atlas[key], `sprite atlas must include "${key}"`);
    }
    assert.ok(atlas.traffic_car_0_e.width >= 64, "32-bit hero-grade car sprite should be >= 64px native");
    assert.ok(atlas.traffic_truck_1_e.width >= 80, "32-bit hero-grade box truck sprite should be >= 80px native");
    assert.ok(atlas.traffic_bike_0_e.width >= 52, "32-bit hero-grade biker sprite should be >= 52px native");
    assert.ok(atlas.ambulance_e_0.width >= 96, "32-bit upgraded ambulance sprite should be >= 96px native");
    assert.ok(atlas.fire_truck_e_0.width >= 104, "32-bit fire engine sprite should be >= 104px native");
    assert.ok(atlas.police_car_e_0.width >= 66, "32-bit police cruiser sprite should be >= 66px native");
  } finally {
    global.document = prevDoc;
  }

  // Headless audio safety check
  playSwordSlashSfx();
  playSiddurDispelSfx();
  playHealHeartSfx();
  playCarCrashSfx();
  playAmbulanceSirenSfx();
  playGameOverDirge();
  playAnnoyingBikerSfx();
  playEmtRadioBeepSfx();
});

test("clean road markings render 2 highway lanes per side with white dashes, single yellow side-street lines, and realistic Newton Centre avenues", () => {
  const makeGrid = (rows) => (x, y) => {
    if (y < 0 || y >= rows.length || x < 0 || x >= rows[0].length) return 0;
    return rows[y][x];
  };

  // 1. Divided Highway (2 tiles North + concrete barrier 13 + 2 tiles South):
  //    Each side must have crisp dashed white lane separator + white outer shoulder + yellow inner line!
  const hw2x2 = makeGrid([
    [1, 1, 1, 1, 1, 1, 1],
    [12, 12, 12, 12, 12, 12, 12],
    [12, 12, 12, 12, 12, 12, 12],
    [13, 13, 13, 13, 13, 13, 13],
    [12, 12, 12, 12, 12, 12, 12],
    [12, 12, 12, 12, 12, 12, 12],
    [1, 1, 1, 1, 1, 1, 1],
  ]);
  for (const row of [1, 2, 4, 5]) {
    const marks = computeRoadTileMarkings(hw2x2, 3, row);
    assert.ok(
      marks.some((m) => m.kind === "white_dash"),
      `highway row ${row} must include white dashed lane separator`
    );
  }
  assert.ok(
    computeRoadTileMarkings(hw2x2, 3, 1).some((m) => m.kind === "shoulder"),
    "highway outer lane must have solid white shoulder"
  );
  assert.ok(
    computeRoadTileMarkings(hw2x2, 3, 2).some((m) => m.kind === "yellow_solid"),
    "highway inner lane touching barrier must have yellow inner edge line"
  );

  // Pinched 1-tile highway side still renders dashed white lane separator for 2 lanes!
  const hwPinched = makeGrid([
    [1, 1, 1, 1, 1],
    [12, 12, 12, 12, 12],
    [13, 13, 13, 13, 13],
    [12, 12, 12, 12, 12],
    [1, 1, 1, 1, 1],
  ]);
  assert.ok(
    computeRoadTileMarkings(hwPinched, 2, 1).some((m) => m.kind === "white_dash"),
    "even 1-tile highway side of barrier must divide into 2 lanes with white dash"
  );

  // 2. Side Street (2-tile wide straightaway -> single dotted yellow line; approaching crosswalk -> solid yellow line; zero white dashes!)
  const sideStreet = makeGrid([
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [2, 2, 2, 2, 2, 2, 2, 4, 2],
    [2, 2, 2, 2, 2, 2, 2, 4, 2],
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
  ]);
  const midSideMarks = computeRoadTileMarkings(sideStreet, 3, 1);
  assert.ok(
    midSideMarks.some((m) => m.kind === "yellow_dash"),
    "straight residential side street should have dotted single yellow centerline"
  );
  assert.ok(
    !midSideMarks.some((m) => m.kind === "white_dash" || m.kind === "shoulder"),
    "residential side street should stay clean with no white lane dashes or heavy shoulders"
  );
  const cornerSideMarks = computeRoadTileMarkings(sideStreet, 6, 1);
  assert.ok(
    cornerSideMarks.some((m) => m.kind === "yellow_solid"),
    "side street approaching crosswalk should switch cleanly to solid single yellow line"
  );

  // 3. Town Avenues: 2-tile & 3-tile = 1 lane each direction (double-yellow only, NO white dashes);
  //    4-tile Newton Centre road = 2 lanes each direction (double-yellow + white dashes!)
  const aveSingleLane = makeGrid([
    [1, 1, 1, 1, 1, 1, 1],
    [3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3],
    [1, 1, 1, 1, 1, 1, 1],
  ]);
  const ave3Mid = computeRoadTileMarkings(aveSingleLane, 3, 2);
  assert.equal(
    ave3Mid.filter((m) => m.kind === "yellow_solid").length,
    2,
    "3-tile 1-lane-each-way town avenue must have double-yellow centerline"
  );
  assert.ok(
    !ave3Mid.some((m) => m.kind === "white_dash") &&
      !computeRoadTileMarkings(aveSingleLane, 3, 1).some((m) => m.kind === "white_dash"),
    "most town avenues (3-tile) must be 1 lane each way with zero white lane dashes"
  );

  const aveTwoLane = makeGrid([
    [1, 1, 1, 1, 1, 1, 1],
    [3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3, 3],
    [1, 1, 1, 1, 1, 1, 1],
  ]);
  for (const row of [1, 2, 3, 4]) {
    const marks = computeRoadTileMarkings(aveTwoLane, 3, row);
    assert.ok(
      marks.some((m) => m.kind === "white_dash"),
      `4-tile Newton Centre 2-lane road row ${row} must have dashed white lane separator`
    );
  }
  assert.ok(
    computeRoadTileMarkings(aveTwoLane, 3, 2).some((m) => m.kind === "yellow_solid") &&
      computeRoadTileMarkings(aveTwoLane, 3, 3).some((m) => m.kind === "yellow_solid"),
    "4-tile Newton Centre 2-lane road must have double-yellow centerline down the middle"
  );
});

test("tight interaction radii, facing-aware road-crossing disambiguation, and full 5-mission route playthrough simulation", () => {
  const { worldMap, landmarks, quests } = loadLiveData();
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;

  const qs = createQuestSystem({ landmarks, quests, worldMap });
  const safety = createSafetySystem(worldMap);
  const signs = createStreetSignSystem(worldMap, { landmarks: qs.landmarks });

  // 1. Tight interaction range: standing 2.0 tiles away from an NPC no longer triggers TALK!
  const firstNpc = qs.npcs.find((n) => n.id === "salzberg_house");
  assert.ok(firstNpc);
  assert.equal(
    qs.findNearbyInteraction(firstNpc.walkTileX + 2, firstNpc.walkTileY),
    null,
    "NPC interaction radius should be tight (<= 1.45 tiles)"
  );
  assert.ok(
    qs.findNearbyInteraction(firstNpc.walkTileX + 1, firstNpc.walkTileY),
    "Standing 1 tile beside an NPC should trigger TALK cleanly"
  );

  // 2. Facing-aware disambiguation: standing at a curb facing an unchecked road with a sign/NPC behind you
  //    MUST prioritize Look Both Ways; turning toward the NPC/sign switches to Interact!
  const mockSign = { kind: "sign", target: { id: "s1", tx: 10, ty: 9 }, dist: 1 };
  const roadBelow = (x, y) => y >= 11;
  const intentFacingRoad = resolveActionIntent({
    playerTileX: 10,
    playerTileY: 10,
    facing: "down",
    isOnRoad: false,
    safeCrossingActive: false,
    nearbyInteraction: mockSign,
    isRoadTileFn: roadBelow,
  });
  assert.equal(
    intentFacingRoad.mode,
    "look_both_ways",
    "facing an unchecked road with a sign behind Liam must prioritize Look Both Ways"
  );
  const intentFacingSign = resolveActionIntent({
    playerTileX: 10,
    playerTileY: 10,
    facing: "up",
    isOnRoad: false,
    safeCrossingActive: false,
    nearbyInteraction: mockSign,
    isRoadTileFn: roadBelow,
  });
  assert.equal(
    intentFacingSign.mode,
    "interact",
    "turning toward the nearby sign must cleanly switch to Read Sign"
  );

  // 3. Full automated BFS playthrough simulation across ALL 5 missions from Home Base!
  const bfsPath = (sx, sy, gx, gy) => {
    const startIdx = sy * width + sx;
    const goalIdx = gy * width + gx;
    const prev = new Int32Array(width * height).fill(-1);
    const q = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    prev[startIdx] = startIdx;
    q[tail++] = startIdx;
    while (head < tail) {
      const cur = q[head++];
      if (cur === goalIdx) break;
      const cx = cur % width;
      const cy = (cur - cx) / width;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (prev[nIdx] !== -1 || collision[nIdx] !== 0) continue;
        prev[nIdx] = cur;
        q[tail++] = nIdx;
      }
    }
    if (prev[goalIdx] === -1) return null;
    const path = [];
    let cur = goalIdx;
    while (cur !== startIdx) {
      path.push({ x: cur % width, y: Math.floor(cur / width) });
      cur = prev[cur];
    }
    path.push({ x: sx, y: sy });
    path.reverse();
    return path;
  };

  let curX = worldMap.origin.spawnTile.x;
  let curY = worldMap.origin.spawnTile.y;
  let totalCrossingsSimulated = 0;
  let crossingConflicts = 0;

  for (const quest of quests) {
    qs.setActiveQuest(quest.id);
    for (const step of quest.steps) {
      const target = qs.getActiveObjectiveTarget();
      assert.ok(target, `quest "${quest.id}" step ${step.stepIndex} must resolve an active target`);
      const route = bfsPath(curX, curY, target.tileX, target.tileY);
      assert.ok(
        route && route.length > 0,
        `quest "${quest.id}" step ${step.stepIndex} (${target.label}) must be reachable on foot from (${curX},${curY})`
      );

      // Walk the simulated path & check every curb-to-road step!
      for (let i = 0; i < route.length - 1; i++) {
        const a = route[i];
        const b = route[i + 1];
        if (!safety.isRoadTile(a.x, a.y) && safety.isRoadTile(b.x, b.y)) {
          totalCrossingsSimulated++;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const facing = dx > 0 ? "right" : dx < 0 ? "left" : dy > 0 ? "down" : "up";
          const nearNpc = qs.findNearbyInteraction(a.x, a.y, 1.45);
          const nearSign = signs.findNearbySign(a.x, a.y, 1.45);
          const near = nearNpc || (nearSign ? { kind: "sign", target: nearSign.sign, dist: nearSign.dist } : null);
          const intent = resolveActionIntent({
            playerTileX: a.x,
            playerTileY: a.y,
            facing,
            isOnRoad: false,
            safeCrossingActive: false,
            nearbyInteraction: near,
            isRoadTileFn: safety.isRoadTile,
          });
          if (intent.mode !== "look_both_ways") crossingConflicts++;
        }
      }

      // Complete the step right at the target — verify facing away from roads cleanly gives "interact"!
      curX = target.tileX;
      curY = target.tileY;
      const nearbyAtTarget = qs.findNearbyInteraction(curX, curY, 1.45);
      assert.ok(nearbyAtTarget, `must be able to interact cleanly at target "${target.label}"`);
      const nonRoadFacing = ["up", "down", "left", "right"].find((dir) => {
        const ox = dir === "right" ? 1 : dir === "left" ? -1 : 0;
        const oy = dir === "down" ? 1 : dir === "up" ? -1 : 0;
        return !safety.isRoadTile(curX + ox, curY + oy);
      });
      assert.ok(nonRoadFacing, `target "${target.label}" must not be stranded on a 4-way road island`);
      const targetIntent = resolveActionIntent({
        playerTileX: curX,
        playerTileY: curY,
        facing: nonRoadFacing,
        isOnRoad: false,
        safeCrossingActive: false,
        nearbyInteraction: nearbyAtTarget,
        isRoadTileFn: safety.isRoadTile,
      });
      assert.equal(
        targetIntent.mode,
        "interact",
        `must cleanly trigger interact at target "${target.label}"`
      );
      if (nearbyAtTarget.kind === "chest") {
        qs.interactWithChest(nearbyAtTarget.target.id);
      } else {
        qs.interactWithNpc(nearbyAtTarget.target.id);
      }
    }
    assert.ok(
      qs.state.completedQuests.has(quest.id),
      `simulated playthrough must cleanly complete quest "${quest.id}"`
    );
  }

  assert.ok(totalCrossingsSimulated >= 10, `expected >= 10 simulated road crossings, got ${totalCrossingsSimulated}`);
  assert.equal(
    crossingConflicts,
    0,
    `expected 0 road-crossing conflicts across all 5 mission playthroughs, got ${crossingConflicts}`
  );
  assert.deepEqual(
    qs.getUnlockedOutfits(),
    ["polo", "baseball", "wetsuit", "link"],
    "completing all 5 quests in simulation must unlock all 4 hero outfits!"
  );
});
