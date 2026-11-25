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
import {
  TILE_SIZE,
  DEFAULT_HITBOX,
  createMapCollider,
  moveWithCollision,
} from "../src/player.js";
import { createStreetSignSystem } from "../src/streetsigns.js";
import {
  playWaterSplash,
  playSwordSlashSfx,
  playSiddurDispelSfx,
  playHealHeartSfx,
  playCarCrashSfx,
  playAmbulanceSirenSfx,
  playGameOverDirge,
  playAnnoyingBikerSfx,
  playEmtRadioBeepSfx,
  playDoorChime,
  playSecretRevealSfx,
  playDiceRollSfx,
  playSquirrelChitter,
  playCatMeow,
  playDogBark,
  playBotwTeleportOutSfx,
  playBotwTeleportInSfx,
  playSnackTossSfx,
} from "../src/audio.js";
import { CAR_MODEL_COUNT } from "../src/vehicles32bit.js";
import { createHomeInteriorSystem, bake32BitInteriorCanvas } from "../src/house_interior.js";
import { validateAndCleanCrosswalks, TILE_IDS } from "../scripts/build_map.mjs";

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

  // 3. Siddur dispel banishes graveyard foes & ghosts (and does NOT treat peaceful protestors as bad guys!)
  const sp2 = sl.spookyChars[1];
  sp2.defeatedTimer = 0;
  const siddurGrave = performSiddurDispel(sl, { x: sp2.x + 12, y: sp2.y }, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 1,
    tileSize: 16,
  });
  assert.ok(siddurGrave.dispelledSpooky >= 1, "Siddur must dispel spooky graveyard foes");

  const mobMember = sl.protestors.find((pr) => pr.isMob);
  assert.ok(mobMember, "world map should include a marching group");
  mobMember.yieldTimer = 0;
  const siddurMob = performSiddurDispel(sl, { x: mobMember.x + 10, y: mobMember.y }, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 1,
    tileSize: 16,
  });
  assert.equal(siddurMob.dispelledProtestors, 0, "Siddur must NOT treat peaceful protestors as enemies");
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
    commercialCount <= 45,
    `expected commercial buildings to stay focused in real plazas/villages (<= 45), got ${commercialCount}`
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
      "traffic_car_4_e",
      "traffic_car_5_w",
      "traffic_car_6_n",
      "traffic_car_7_s",
      "traffic_car_8_e",
      "traffic_car_9_w",
      "jogger_0_right_0",
      "jogger_1_left_1",
      "jogger_2_right_1",
      "bubble_jogger_0",
      "bubble_jogger_1",
      "bubble_jogger_2",
      "bubble_animal_yum",
      "bubble_too_bright",
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
      "bubble_snack_thanks",
      "bubble_want_snack",
      "squirrel_right_0",
      "squirrel_left_1",
      "squirrel_alert_right",
      "cat_0_right_0",
      "cat_1_left_1",
      "cat_0_alert_left",
      "dog_0_right_0",
      "dog_1_left_1",
      "dog_0_alert_right",
      "bubble_chitter",
      "bubble_meow",
      "bubble_woof",
    ]) {
      assert.ok(atlas[key], `sprite atlas must include "${key}"`);
    }
    assert.ok(atlas.dog_0_right_0.width >= 56, "runaway dog sprite must be wide enough for its trailing leash (>= 56px native)");
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

test("water areas are blocked until unlocking the swim outfit (wetsuit), then become wadeable while walls & bounds stay solid", () => {
  const { worldMap, landmarks, quests } = loadLiveData();
  const qs = createQuestSystem({ landmarks, quests, worldMap });
  const collider = createMapCollider(worldMap);
  const safety = createSafetySystem(worldMap);

  // 1. Fresh game: swim outfit is locked -> cannot wade water yet
  assert.equal(qs.canWadeWater(), false);

  // Find a real shore tile adjacent to water on the live map (e.g. Crystal Lake / Bullough's Pond)
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  let shoreTile = null;
  let waterTile = null;
  for (let ty = 1; ty < height - 1 && !shoreTile; ty++) {
    for (let tx = 1; tx < width - 1 && !shoreTile; tx++) {
      const idx = ty * width + tx;
      if (collision[idx] === 0 && !safety.isRoadTile(tx, ty)) {
        if (base[ty * width + (tx + 1)] === 6 && collision[ty * width + (tx + 1)] === 1) {
          shoreTile = { x: tx, y: ty };
          waterTile = { x: tx + 1, y: ty };
        }
      }
    }
  }
  assert.ok(shoreTile && waterTile, "live map must have a walkable shore tile directly adjacent to water");

  // Position player right at the eastern edge of shoreTile, facing into waterTile
  const startState = {
    x: shoreTile.x * TILE_SIZE + 11, // hitbox right edge = shoreTile right edge
    y: shoreTile.y * TILE_SIZE + 8,
    facing: "right",
  };

  // Before unlocking swim outfit: moving into water MUST be blocked and report wasBlockedByWater()
  const lockedBlocker = safety.createRoadAwareBlocker(
    (nx, ny, hb) => collider.isBoxBlocked(nx, ny, hb, { canWadeWater: qs.canWadeWater() }),
    startState.x,
    startState.y,
    false,
    DEFAULT_HITBOX
  );
  const blockedMove = moveWithCollision(startState, { x: 1, y: 0 }, 0.15, lockedBlocker.isBoxBlocked);
  assert.equal(blockedMove.x, startState.x, "must be blocked from wading into water before unlocking wetsuit");
  assert.equal(lockedBlocker.wasBlockedByWater(), true, "must detect water blockade for friendly hint toast");

  // 2. Complete Quest 1 (J.P. Licks -> Newton Free Library) to unlock the Summer Wetsuit & Snorkel!
  qs.setActiveQuest("quest_01_first_steps");
  qs.interactWithNpc("jp_licks");
  const q1Done = qs.interactWithNpc("newton_free_library");
  assert.equal(q1Done.questEvent?.unlockedOutfit, "wetsuit");
  assert.equal(qs.canWadeWater(), true, "unlocking wetsuit must enable water wading");

  // Moving into water now succeeds even before manually toggling outfit (and never traps if toggling outfits)
  const unlockedBlocker = safety.createRoadAwareBlocker(
    (nx, ny, hb) => collider.isBoxBlocked(nx, ny, hb, { canWadeWater: qs.canWadeWater() }),
    startState.x,
    startState.y,
    false,
    DEFAULT_HITBOX
  );
  const wadeMove = moveWithCollision(startState, { x: 1, y: 0 }, 0.2, unlockedBlocker.isBoxBlocked);
  assert.ok(wadeMove.x > startState.x, "player must wade smoothly into water once swim outfit is unlocked");
  assert.equal(unlockedBlocker.wasBlockedByWater(), false);
  assert.equal(collider.isSolidTile(waterTile.x, waterTile.y, { canWadeWater: true }), false);

  // 3. Buildings, highway medians, and out-of-bounds edges MUST remain solid even with swim outfit!
  const buildingIdx = base.findIndex((t, i) => t === 5 && collision[i] === 1);
  assert.ok(buildingIdx >= 0);
  const bx = buildingIdx % width;
  const by = Math.floor(buildingIdx / width);
  assert.equal(
    collider.isSolidTile(bx, by, { canWadeWater: true }),
    true,
    "building walls must stay solid with swim outfit"
  );

  const medianIdx = base.findIndex((t, i) => t === 13 && collision[i] === 1);
  assert.ok(medianIdx >= 0);
  const mx = medianIdx % width;
  const my = Math.floor(medianIdx / width);
  assert.equal(
    collider.isSolidTile(mx, my, { canWadeWater: true }),
    true,
    "highway medians must stay solid with swim outfit"
  );
  assert.equal(
    collider.isSolidTile(-1, waterTile.y, { canWadeWater: true }),
    true,
    "map boundaries must stay solid with swim outfit"
  );

  // 4. Water wading speed & headless splash audio safety
  assert.ok(safety.getSpeedMultiplier("water", false) < 1, "normal wading should be slower than walking on land");
  assert.ok(
    safety.getSpeedMultiplier("water", true) > safety.getSpeedMultiplier("water", false),
    "holding FASTER in water should swim faster than normal wading"
  );
  assert.ok(
    safety.getSpeedMultiplier("water", true) < safety.getSpeedMultiplier("sidewalk", true),
    "swimming fast should stay slower than scooting on dry sidewalks"
  );
  playWaterSplash(false);
  playWaterSplash(true);
});

test("Easy / GPS mode grants all outfits and abilities from the start without polluting earned Signpost/Hard unlocks", () => {
  const { worldMap, landmarks, quests } = loadLiveData();
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };

  const qs = createQuestSystem({ landmarks, quests, worldMap, storage });

  // 1. In default Signpost mode on a fresh save, only Polo is unlocked and abilities are locked
  assert.equal(qs.state.navMode, "signs");
  assert.deepEqual(qs.getUnlockedOutfits(), ["polo"]);
  assert.equal(qs.canWadeWater(), false);
  assert.equal(qs.hasSword(), false);
  assert.equal(qs.hasSiddur(), false);
  assert.equal(qs.getGear().id, "sneakers");

  // 2. Switching to Easy / GPS mode immediately grants ALL 4 outfits & ALL abilities!
  qs.setNavMode("gps");
  assert.equal(qs.state.gpsAssist, true);
  assert.deepEqual(qs.getUnlockedOutfits(), ["polo", "baseball", "wetsuit", "link"]);
  assert.equal(qs.canWadeWater(), true, "Easy/GPS mode must allow water wading immediately");
  assert.equal(qs.hasSword(), true, "Easy/GPS mode must grant Graveyard Sword immediately");
  assert.equal(qs.hasSiddur(), true, "Easy/GPS mode must grant Pocket Siddur immediately");
  assert.equal(qs.getGear().id, "mountain_bike", "Easy/GPS mode must grant top traversal speed gear");

  // Player can freely cycle and persist any outfit while in Easy/GPS mode
  assert.equal(qs.toggleHeroOutfit(), "baseball");
  assert.equal(qs.toggleHeroOutfit(), "wetsuit");
  assert.equal(qs.toggleHeroOutfit(), "link");
  const reloadedGps = createQuestSystem({ landmarks, quests, worldMap, storage });
  assert.equal(reloadedGps.state.navMode, "gps");
  assert.equal(reloadedGps.state.heroOutfit, "link", "selected outfit must persist while in Easy/GPS mode");
  assert.deepEqual(reloadedGps.getUnlockedOutfits(), ["polo", "baseball", "wetsuit", "link"]);
  assert.equal(reloadedGps.canWadeWater(), true);
  assert.equal(reloadedGps.hasSword(), true);
  assert.equal(reloadedGps.hasSiddur(), true);

  // 3. Switching back to Signpost or Hard mode cleanly restores earned-only unlocks & resets unearned outfit to polo
  reloadedGps.setNavMode("signs");
  assert.deepEqual(reloadedGps.getUnlockedOutfits(), ["polo"]);
  assert.equal(reloadedGps.state.heroOutfit, "polo");
  assert.equal(reloadedGps.canWadeWater(), false);
  assert.equal(reloadedGps.hasSword(), false);
  assert.equal(reloadedGps.hasSiddur(), false);
  assert.equal(reloadedGps.getGear().id, "sneakers");
});

test("every crosswalk spans curb-to-curb between walkable pedestrian sides (zero floating mid-road crosswalks)", () => {
  const { worldMap } = loadLiveData();
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const isRoad = (t) => t === 2 || t === 3 || t === 12;
  const isPed = (t) => t === 1 || t === 0 || t === 9 || t === 10 || t === 11 || t === 7;
  const visited = new Uint8Array(width * height);
  let clusters = 0;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (base[idx] !== 4 || visited[idx]) continue;
      const q = [[x, y]];
      visited[idx] = 1;
      const cells = [];
      while (q.length) {
        const [cx, cy] = q.shift();
        cells.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (base[ni] === 4 && !visited[ni]) {
            visited[ni] = 1;
            q.push([nx, ny]);
          }
        }
      }
      clusters++;
      let touchN = false;
      let touchS = false;
      let touchE = false;
      let touchW = false;
      let touchesRoad = false;
      for (const [cx, cy] of cells) {
        const tn = base[(cy - 1) * width + cx];
        const ts = base[(cy + 1) * width + cx];
        const tw = base[cy * width + (cx - 1)];
        const te = base[cy * width + (cx + 1)];
        if (isPed(tn)) touchN = true;
        if (isPed(ts)) touchS = true;
        if (isPed(tw)) touchW = true;
        if (isPed(te)) touchE = true;
        if (isRoad(tn) || isRoad(ts) || isRoad(tw) || isRoad(te)) touchesRoad = true;
      }
      assert.ok(touchesRoad, `crosswalk at (${x},${y}) must sit on a real road`);
      assert.ok(
        (touchN && touchS) || (touchE && touchW),
        `crosswalk at (${x},${y}) must connect walkable pedestrian landings on BOTH opposite sides of the road`
      );
    }
  }
  assert.ok(clusters >= 50, `expected real pedestrian crosswalks across Newton (got ${clusters})`);

  // Synthetic check: floating crosswalk in the dead middle of a wide intersection is removed cleanly!
  const w = 13;
  const h = 13;
  const grid = new Array(w * h).fill(TILE_IDS.SIDEWALK);
  for (let y = 4; y <= 8; y++) {
    for (let x = 0; x < w; x++) grid[y * w + x] = TILE_IDS.MAIN_ROAD;
  }
  for (let x = 4; x <= 8; x++) {
    for (let y = 0; y < h; y++) grid[y * w + x] = TILE_IDS.MAIN_ROAD;
  }
  // Rogue crosswalk floating in dead center of intersection (6,6)
  grid[6 * w + 6] = TILE_IDS.CROSSWALK;
  // Valid crosswalk spanning curb-to-curb on the west leg at x=2 (y=4..8)
  for (let y = 4; y <= 8; y++) grid[y * w + 2] = TILE_IDS.CROSSWALK;

  validateAndCleanCrosswalks(grid, w, h);
  assert.equal(grid[6 * w + 6], TILE_IDS.MAIN_ROAD, "floating mid-intersection crosswalk must be removed");
  for (let y = 4; y <= 8; y++) {
    assert.equal(grid[y * w + 2], TILE_IDS.CROSSWALK, `valid curb-to-curb crosswalk tile (2,${y}) must be kept`);
  }
});

test("Home Base interior lets Liam go inside 565 Boylston St, restock snacks, discover Secret Reading Nook & Golden D20, and solve D&D Basement for Bag of Holding", () => {
  const { worldMap, landmarks, quests } = loadLiveData();
  const qs = createQuestSystem({ landmarks, quests, worldMap });
  const home = createHomeInteriorSystem(qs);

  // 1. Enter Home Base (Main Floor)
  assert.equal(home.state.active, false);
  const entered = home.enterHouse(4440, 7064);
  assert.equal(home.state.active, true);
  assert.equal(home.getRoom().id, "main_floor");
  assert.ok(!home.isInteriorBoxBlocked(entered.x, entered.y), "living room spawn must be walkable");
  assert.equal(home.isInteriorBoxBlocked(4, 4), true, "outer interior walls must be solid");

  // 2. Kitchen Snack Jar restocks snacks up to max (5 initially) & heals all 5 hearts!
  qs.useSnack();
  qs.useSnack();
  assert.equal(qs.state.snacks, 1);
  const kitchenRes = home.interactWithInteriorProp("kitchen_snacks");
  assert.equal(kitchenRes.healHearts, 5);
  assert.equal(qs.state.snacks, 5, "kitchen snack jar should refill snacks up to max 5");

  // 3. Suspicious Bookshelf reveals Secret Upstairs Reading Nook -> Glowing Chest -> Golden D20!
  const reveal = home.interactWithInteriorProp("bookshelf");
  assert.equal(reveal.action, "secret_reveal");
  assert.equal(home.state.bookshelfOpened, true);
  const goUp = home.interactWithInteriorProp("bookshelf");
  assert.equal(goUp.action, "room_change");
  assert.equal(home.getRoom().id, "upstairs_nook");

  const d20Chest = home.interactWithInteriorProp("golden_d20_chest");
  assert.equal(d20Chest.action, "fanfare");
  assert.equal(d20Chest.itemId, "golden_d20");
  assert.ok(qs.state.inventory.has("golden_d20"), "Golden D20 must be added to inventory");

  const coinsBeforeRoll = qs.state.coins;
  const critRoll = home.interactWithInteriorProp("golden_d20_chest", { rng: () => 0.99 });
  assert.equal(critRoll.action, "d20_roll");
  assert.equal(critRoll.roll, 20);
  assert.equal(qs.state.coins, coinsBeforeRoll + 20, "natural 20 roll must award 20 bonus coins");

  // Go back downstairs
  home.interactWithInteriorProp("nook_stairs_down");
  assert.equal(home.getRoom().id, "main_floor");

  // 4. D&D Basement Pool Table -> 3 Hero Statues + 3-Switch Puzzle -> Bag of Holding (max 12 snacks!)
  const enterDnd = home.interactWithInteriorProp("pool_table_dnd");
  assert.equal(enterDnd.action, "room_change");
  assert.equal(home.getRoom().id, "dnd_basement");

  assert.equal(home.interactWithInteriorProp("statue_bard").action, "dialogue");
  assert.equal(home.interactWithInteriorProp("statue_wizard").action, "dialogue");
  assert.equal(home.interactWithInteriorProp("statue_knight").action, "dialogue");

  // Sealed before puzzle is solved
  assert.equal(home.interactWithInteriorProp("bag_of_holding_chest").action, "dialogue");
  // Wrong switch order resets cleanly
  assert.equal(home.interactWithInteriorProp("switch_2").action, "switch_reset");
  // Correct order: Emerald (0) -> Sapphire (1) -> Ruby (2)
  assert.equal(home.interactWithInteriorProp("switch_0").action, "switch_ok");
  assert.equal(home.interactWithInteriorProp("switch_1").action, "switch_ok");
  assert.equal(home.interactWithInteriorProp("switch_2").action, "puzzle_solved");

  const bagRes = home.interactWithInteriorProp("bag_of_holding_chest");
  assert.equal(bagRes.action, "fanfare");
  assert.equal(bagRes.itemId, "bag_of_holding");
  assert.ok(qs.state.inventory.has("bag_of_holding"), "Bag of Holding must be added to inventory");
  assert.equal(qs.getMaxSnacks(), 12, "Bag of Holding must expand max snack pocket to 12");
  assert.equal(qs.state.snacks, 12);

  // 5. Exit back to Living Room -> Front Door -> Outdoor return coordinates
  home.interactWithInteriorProp("dnd_portal_exit");
  assert.equal(home.getRoom().id, "main_floor");
  const ret = home.exitHouse();
  assert.equal(home.state.active, false);
  assert.deepEqual(ret, { x: 4440, y: 7064 });

  // Headless audio smoke checks
  playDoorChime();
  playSecretRevealSfx();
  playDiceRollSfx(false);
  playDiceRollSfx(true);
  playSquirrelChitter();
  playCatMeow();
  playDogBark();
  playBotwTeleportOutSfx();
  playBotwTeleportInSfx();
  playSnackTossSfx();

  // Verify 10 distinct 32-bit car makes & models and questSystem.hasLantern() gating!
  assert.equal(CAR_MODEL_COUNT, 10, "expected 10 distinct 32-bit car makes & models");
  const { worldMap: wm2, landmarks: lm2, quests: q2 } = loadLiveData();
  const qsLantern = createQuestSystem({ landmarks: lm2, quests: q2, worldMap: wm2 });
  assert.equal(qsLantern.hasLantern(), false, "fresh save in Signpost mode should not have lantern yet");
  qsLantern.state.inventory.add("spooky_lantern");
  assert.equal(qsLantern.hasLantern(), true, "holding spooky_lantern must enable ghost-repelling lantern");
  qsLantern.state.inventory.delete("spooky_lantern");
  qsLantern.state.inventory.add("ghost_lantern_cloak");
  assert.equal(qsLantern.hasLantern(), true, "holding ghost_lantern_cloak must enable ghost-repelling lantern");
  qsLantern.state.inventory.delete("ghost_lantern_cloak");
  qsLantern.setNavMode("gps");
  assert.equal(qsLantern.hasLantern(), true, "Easy / GPS mode unlocks ghost-repelling lantern");

  // Headless 2x HD 32-bit interior room & 4-frame animated overlay baking check for all 3 Home Base rooms!
  const prevDoc = global.document;
  const mockGrad = () => ({ addColorStop() {} });
  let pathCalls = 0;
  let gradCalls = 0;
  global.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        fillStyle: "",
        strokeStyle: "",
        lineWidth: 1,
        globalAlpha: 1,
        fillRect() {},
        clearRect() {},
        beginPath() { pathCalls++; },
        closePath() {},
        moveTo() {},
        lineTo() {},
        quadraticCurveTo() {},
        arc() {},
        ellipse() {},
        fill() {},
        stroke() {},
        createLinearGradient() { gradCalls++; return mockGrad(); },
        createRadialGradient() { gradCalls++; return mockGrad(); },
      }),
    }),
  };
  try {
    for (const [roomId, expectedW, expectedH] of [
      ["main_floor", 20 * 32, 12 * 32],
      ["upstairs_nook", 16 * 32, 10 * 32],
      ["dnd_basement", 18 * 32, 11 * 32],
    ]) {
      const baked = bake32BitInteriorCanvas(roomId, home.state);
      assert.ok(baked, `bake32BitInteriorCanvas must produce canvas for ${roomId}`);
      assert.equal(baked.__pixelScale, 0.5, `${roomId} must be baked at 2x HD (__pixelScale = 0.5)`);
      assert.equal(baked.width, expectedW, `${roomId} HD canvas width`);
      assert.equal(baked.height, expectedH, `${roomId} HD canvas height`);

      // Verify drawInteriorRoom blits both static room & animated 2x HD lighting/flame overlays cleanly
      home.state.active = true;
      home.state.roomId = roomId;
      const blits = [];
      home.drawInteriorRoom(
        { drawCanvas: (key, c, x, y, op = 1) => blits.push({ key, c, x, y, op }) },
        0.5
      );
      assert.ok(blits.some((b) => b.key.includes("int32_") && b.op === 1), `${roomId} should blit static HD room canvas`);
      assert.ok(blits.some((b) => b.key.includes("_fx") && b.op === 1), `${roomId} should blit animated HD effect overlay`);
    }
    assert.ok(pathCalls > 150, `expected rich curved 32-bit vector/pixel paths across rooms (got ${pathCalls})`);
    assert.ok(gradCalls > 80, `expected rich multi-stop gradients & radial lighting pools across rooms (got ${gradCalls})`);
  } finally {
    global.document = prevDoc;
  }
});
