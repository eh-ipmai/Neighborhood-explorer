import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildSnesSpriteAtlas } from "../src/tileset.js";
import {
  resolveVoiceProfile,
  playStepTick,
  playTextBlip,
  playDialogueOpenSfx,
  playDialogueAdvanceSfx,
  playAnimalFeedSfx,
  playAnnoyingJoggerSfx,
  playChestOpenSfx,
  playMapToggleSfx,
  playPaintHouseSfx,
  playOutfitSwapSfx,
  playNavModeSwitchSfx,
  playAcornPickupSfx,
  playSnackRestockSfx,
} from "../src/audio.js";
import {
  JOGGER_CHANTS,
  buildStreetLife,
  updateStreetLife,
  checkStreetLifeContact,
  findNearbySnackTarget,
  tossSnackAtAnimal,
  interactWithStreetLife,
  performSwordAttack,
  performSiddurDispel,
} from "../src/streetlife.js";
import { buildParkingLotCars } from "../src/parking_lots.js";
import { buildGraveyardFeatures } from "../src/graveyards.js";
import { buildParkFeatures, buildWoodlandTreeGrid } from "../src/parks.js";
import { getNavigationSubgrid } from "../src/subgrid.js";
import { createStreetSignSystem } from "../src/streetsigns.js";
import { createQuestSystem, snapToWalkableTile } from "../src/quests.js";
import { checkTrafficCollision, updateRoadTraffic } from "../src/traffic.js";
import { createMapCollider } from "../src/player.js";
import { createSafetySystem } from "../src/safety.js";

function loadWorldData() {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const landmarks = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "landmarks.json"), "utf8")
  );
  return { worldMap, landmarks };
}

function createMockCanvasDocument() {
  return {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        fillStyle: "",
        strokeStyle: "",
        globalAlpha: 1,
        font: "",
        textAlign: "",
        textBaseline: "",
        fillRect() {},
        clearRect() {},
        fillText() {},
        save() {},
        restore() {},
        translate() {},
        scale() {},
        rotate() {},
        beginPath() {},
        arc() {},
        ellipse() {},
        fill() {},
        stroke() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        drawImage() {},
      }),
    }),
  };
}

test("sculpted 4-frame runner sprites & 5 annoying chants build cleanly and runners annoy without hurting Liam", () => {
  const prevDoc = globalThis.document;
  globalThis.document = createMockCanvasDocument();
  try {
    const sprites = buildSnesSpriteAtlas();
    for (let v = 0; v < 3; v++) {
      for (const dir of ["right", "left"]) {
        for (let f = 0; f < 4; f++) {
          const key = `jogger_${v}_${dir}_${f}`;
          assert.ok(sprites[key], `missing sculpted 4-frame runner sprite: ${key}`);
          assert.equal(sprites[key].width, 50, `${key} should be 50px native width`);
          assert.equal(sprites[key].height, 60, `${key} should be 60px native height`);
          assert.equal(sprites[key].__pixelScale, 0.5, `${key} should be 2x HD pixelScale 0.5`);
        }
      }
    }
    assert.equal(JOGGER_CHANTS.length, 5, "should have 5 annoying runner chants");
    for (let i = 0; i < 5; i++) {
      assert.ok(sprites[`bubble_jogger_${i}`], `missing runner speech bubble bubble_jogger_${i}`);
    }
  } finally {
    globalThis.document = prevDoc;
  }

  const { worldMap, landmarks } = loadWorldData();
  const gf = buildGraveyardFeatures(worldMap);
  const sl = buildStreetLife(worldMap, {
    parkOccupiedGrid: gf.occupiedGrid,
    graveyardGrid: gf.graveyardGrid,
    graveyardZones: gf.zones,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });

  const jg = sl.joggers[0];
  assert.ok(jg, "expected at least one sidewalk runner");
  jg.greetCooldown = 0;
  jg.jostleCooldown = 0;

  // Approaching runner triggers annoying chant callback (jostled = false) and sprints faster
  const playerApproach = { x: jg.x + 36, y: jg.y, hearts: 5, maxHearts: 5, hurtTimer: 0 };
  const events = [];
  let bump = null;
  updateStreetLife(sl, 0.1, playerApproach, worldMap, {
    onJoggerAnnoy: (runner, jostled) => events.push({ id: runner.id, jostled }),
    onPlayerBump: (b) => { bump = b; },
  });
  assert.ok(events.some((e) => e.id === jg.id && e.jostled === false), "approaching runner must trigger onJoggerAnnoy");
  assert.ok(jg.bubbleTimer > 1.5, "annoying runner must pop up a speech bubble chant");
  assert.ok(jg.sprintTimer > 0, "annoying runner must kick into annoyed Strava-PR sprint near Liam");
  assert.equal(bump, null, "annoying runner must NEVER trigger heart-damage onPlayerBump");
  assert.equal(playerApproach.hearts, 5, "annoying runner must NEVER reduce hearts");

  // Brushing right past runner triggers jostled = true callback while STILL dealing 0 heart damage!
  const playerBrush = { x: jg.x, y: jg.y, hearts: 5, maxHearts: 5, hurtTimer: 0 };
  updateStreetLife(sl, 0.05, playerBrush, worldMap, {
    onJoggerAnnoy: (runner, jostled) => events.push({ id: runner.id, jostled }),
    onPlayerBump: (b) => { bump = b; },
  });
  assert.ok(events.some((e) => e.id === jg.id && e.jostled === true), "brushing past runner must fire jostled=true");
  assert.equal(bump, null, "jostling runner must STILL NEVER deal heart damage");
  assert.equal(playerBrush.hearts, 5);
});

test("distinct character voice profiles & all interaction-specific SFX execute cleanly", () => {
  assert.equal(resolveVoiceProfile("Mom • 565 Boylston St").id, "family");
  assert.equal(resolveVoiceProfile("Coach Mike • Newton Little League").id, "coach");
  assert.equal(resolveVoiceProfile("Yoni • Salzberg House").id, "kid");
  assert.equal(resolveVoiceProfile("Rabbi • Congregation Beth El").id, "shul");
  assert.equal(resolveVoiceProfile("Librarian • Newton Free Library").id, "scholar");
  assert.equal(resolveVoiceProfile("Scooper • J.P. Licks").id, "shop");
  assert.equal(resolveVoiceProfile("Graveyard Phantom").id, "spooky");
  assert.equal(resolveVoiceProfile("Newton EMT Paramedic").id, "medic");
  assert.equal(resolveVoiceProfile("Friendly Neighbor").id, "neighbor");

  // All new & upgraded SFX run safely in headless Node (no AudioContext) without throwing
  assert.doesNotThrow(() => {
    for (const surface of ["grass", "dirt", "sand", "indoors", "dungeon", "road", "sidewalk", true, false]) {
      playStepTick(surface, false);
      playStepTick(surface, true);
    }
    for (const spk of ["Mom", "Coach", "Yoni", "Rabbi", "Librarian", "J.P. Licks", "Ghost"]) {
      playTextBlip(spk);
      playDialogueOpenSfx(spk);
    }
    playDialogueAdvanceSfx();
    for (const kind of ["turkey", "squirrel", "cat", "dog"]) {
      playAnimalFeedSfx(kind);
    }
    playAnnoyingJoggerSfx(false);
    playAnnoyingJoggerSfx(true);
    playChestOpenSfx();
    playMapToggleSfx(true);
    playMapToggleSfx(false);
    playPaintHouseSfx();
    for (const outfit of ["polo", "baseball", "wetsuit", "link"]) {
      playOutfitSwapSfx(outfit);
    }
    for (const mode of ["signs", "gps", "hard"]) {
      playNavModeSwitchSfx(mode);
    }
    playAcornPickupSfx();
    playSnackRestockSfx();
  });
});

test("wild animal feeding works with Snacks OR Lucky Acorns, pauses to munch happily, and keeps animals harmless", () => {
  const { worldMap, landmarks } = loadWorldData();
  const gf = buildGraveyardFeatures(worldMap);
  const sl = buildStreetLife(worldMap, {
    parkOccupiedGrid: gf.occupiedGrid,
    graveyardGrid: gf.graveyardGrid,
    graveyardZones: gf.zones,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });

  // Feed a wild squirrel using a Lucky Acorn when out of snacks!
  const sq = sl.squirrels[0];
  assert.ok(sq, "expected at least one wild squirrel");
  sq.fleeTimer = 0;
  sq.munchTimer = 0;
  sq.fedTimer = 0;
  const isolatedSl = { turkeys: [], critters: [sq], protestors: [], spookyChars: [], joggers: [] };

  const target = findNearbySnackTarget(isolatedSl, sq.x - 50, sq.y, 72);
  assert.equal(target?.kind, "squirrel", "findNearbySnackTarget should detect wild squirrel up to 72px away");

  let acorns = 2;
  const res = tossSnackAtAnimal(target, sq.x - 50, sq.y, {
    hasSnack: false,
    hasAcorn: acorns > 0,
    consumeAcorn: () => { acorns--; },
  });
  assert.equal(res?.tossed, true);
  assert.equal(res?.fed, true);
  assert.equal(res?.foodKind, "acorn");
  assert.equal(acorns, 1, "feeding with a Lucky Acorn should consume 1 acorn");
  assert.ok(sq.munchTimer > 0.5, "fed squirrel must enter happy munchTimer animation");
  assert.ok(sq.fedTimer >= 15, "fed squirrel must stay peaceful for a long fedTimer");
  assert.ok(sq.fleeTimer >= 10, "fed squirrel must depart peacefully");
  assert.equal(sq.bubbleSprite, "bubble_animal_yum");

  // Already-fed squirrel is skipped by findNearbySnackTarget and CANNOT hurt Liam on contact!
  const again = findNearbySnackTarget(isolatedSl, sq.x - 10, sq.y, 72);
  assert.equal(again, null, "already-fed squirrel should not be targeted again");
  const contact = checkStreetLifeContact(isolatedSl, { x: sq.x, y: sq.y, hearts: 5, maxHearts: 5, hurtTimer: 0 });
  assert.equal(contact, null, "happily fed/munching animal must NEVER hurt Liam on contact");

  // During munchTimer, animal pauses in place munching; after munchTimer finishes, it trots away peacefully!
  const sxBefore = sq.x;
  const syBefore = sq.y;
  updateStreetLife(isolatedSl, 0.2, { x: sq.x - 30, y: sq.y, hearts: 5, maxHearts: 5, hurtTimer: 0 }, worldMap);
  assert.equal(sq.x, sxBefore, "animal should pause in place while munching");
  assert.equal(sq.y, syBefore);
  assert.ok(sq.munchTimer < 0.95);
});

test("parking lots are populated densely with realistic non-overlapping 32-bit cars matching street vehicles", () => {
  const { worldMap, landmarks } = loadWorldData();
  const gf = buildGraveyardFeatures(worldMap);
  const pf = buildParkFeatures(worldMap, gf.graveyardGrid);
  const combinedOccupied = new Uint8Array(worldMap.dimensions.width * worldMap.dimensions.height);
  for (let i = 0; i < combinedOccupied.length; i++) {
    if (pf.occupiedGrid[i] === 1 || gf.occupiedGrid[i] === 1) combinedOccupied[i] = 1;
  }

  const parkedCars = buildParkingLotCars(worldMap, {
    parkOccupiedGrid: combinedOccupied,
    graveyardGrid: gf.graveyardGrid,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });

  // Real Newton map has many parking lots -> should have a realistic bustling fleet (>= 120 parked 32-bit cars!)
  assert.ok(
    parkedCars.length >= 120,
    `expected >= 120 realistic 32-bit parked cars across Newton's parking lots (got ${parkedCars.length})`
  );

  const validSpriteRe = /^(traffic_car_[0-9]|traffic_truck_0)_(n|s|e|w)$/;
  const distinctModels = new Set();
  const base = worldMap.layers.base;
  const { width, height } = worldMap.dimensions;
  const tileSize = worldMap.tileSize || 16;

  for (const car of parkedCars) {
    assert.match(car.sprite, validSpriteRe, `parked car sprite must use 32-bit street vehicle art (got ${car.sprite})`);
    distinctModels.add(`${car.kind}_${car.variant}`);
    const tx = Math.floor(car.x / tileSize);
    const ty = Math.floor(car.y / tileSize);
    assert.ok(tx >= 1 && ty >= 1 && tx < width - 1 && ty < height - 1);
    assert.equal(
      base[ty * width + tx],
      8,
      `parked car ${car.sprite} center (${tx},${ty}) must sit strictly on a parking lot tile (8)`
    );
  }

  // Diverse civilian fleet variety (sedans, SUVs, wagons, EVs, minivans, pickups, etc.)
  assert.ok(distinctModels.size >= 8, `expected >= 8 distinct 32-bit car models in parking lots (got ${distinctModels.size})`);

  // Verify zero center-to-center overlap between any two parked cars in the same lot
  for (let i = 0; i < parkedCars.length; i++) {
    for (let j = i + 1; j < parkedCars.length; j++) {
      if (parkedCars[i].lotId !== parkedCars[j].lotId) continue;
      const d = Math.hypot(parkedCars[i].x - parkedCars[j].x, parkedCars[i].y - parkedCars[j].y);
      assert.ok(
        d >= 18,
        `two parked cars in lot ${parkedCars[i].lotId} overlap too closely (${d.toFixed(1)}px apart)`
      );
    }
  }
});

test("playtest invariants: zero props/signs/streetlife on vector roads, accurate N/S traffic OBB, safe fast-travel, and no Quest 2 chest soft-lock", () => {
  const { worldMap, landmarks } = loadWorldData();
  const quests = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "data", "quests.json"), "utf8"));
  const subgrid = getNavigationSubgrid(worldMap);
  const collider = createMapCollider(worldMap);
  const safety = createSafetySystem(worldMap);
  const gf = buildGraveyardFeatures(worldMap);
  const pf = buildParkFeatures(worldMap, gf.graveyardGrid);
  const combinedOccupied = new Uint8Array(worldMap.dimensions.width * worldMap.dimensions.height);
  for (let i = 0; i < combinedOccupied.length; i++) {
    if (pf.occupiedGrid[i] === 1 || gf.occupiedGrid[i] === 1) combinedOccupied[i] = 1;
  }

  // 1. Zero trees, street signs, parked cars, protestors, joggers, turkeys, or critters on paved vector roads!
  const treeGrid = buildWoodlandTreeGrid(worldMap, combinedOccupied, gf.graveyardGrid);
  const { width, height } = worldMap.dimensions;
  let treesOnRoad = 0;
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      if (treeGrid[ty * width + tx] > 0 && subgrid.isRoadAtPx(tx * 16 + 8, ty * 16 + 8)) treesOnRoad++;
    }
  }
  assert.equal(treesOnRoad, 0, "no woodland/median trees should grow on paved vector road asphalt");

  const signSys = createStreetSignSystem(worldMap, { parkOccupiedGrid: combinedOccupied, landmarks });
  const signsOnRoad = signSys.signs.filter((s) => subgrid.isRoadAtPx(s.tx * 16 + 8, s.ty * 16 + 8)).length;
  assert.equal(signsOnRoad, 0, "no street signs should stand in the middle of paved vector roads");

  const parkedCars = buildParkingLotCars(worldMap, {
    parkOccupiedGrid: combinedOccupied,
    graveyardGrid: gf.graveyardGrid,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });
  const parkedOnRoad = parkedCars.filter((c) => subgrid.isRoadAtPx(c.x, c.y)).length;
  assert.equal(parkedOnRoad, 0, "no parked lot cars should overlap paved vector roads");

  const sl = buildStreetLife(worldMap, {
    parkOccupiedGrid: combinedOccupied,
    graveyardGrid: gf.graveyardGrid,
    graveyardZones: gf.zones,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });
  assert.equal(sl.protestors.filter((p) => subgrid.isRoadAtPx(p.x, p.y)).length, 0, "zero protestors on vector roads");
  assert.equal(sl.joggers.filter((j) => subgrid.isRoadAtPx(j.x, j.y)).length, 0, "zero joggers on vector roads");
  assert.equal(sl.turkeys.filter((t) => subgrid.isRoadAtPx(t.x, t.y)).length, 0, "zero turkeys spawning on vector roads");
  assert.equal(sl.critters.filter((c) => subgrid.isRoadAtPx(c.x, c.y)).length, 0, "zero critters spawning on vector roads");

  // Every jogger should be able to move freely without getting stuck in place
  let stuckJoggers = 0;
  for (const j of sl.joggers) {
    const sx = j.x;
    const sy = j.y;
    let maxDist = 0;
    const fakePlayer = { x: j.x + 120, y: j.y + 120, hearts: 5, maxHearts: 5, hurtTimer: 0 };
    for (let step = 0; step < 40; step++) {
      updateStreetLife(sl, 0.05, fakePlayer, worldMap, { tileSize: 16 });
      const d = Math.hypot(j.x - sx, j.y - sy);
      if (d > maxDist) maxDist = d;
    }
    if (maxDist < 6) stuckJoggers++;
  }
  assert.equal(stuckJoggers, 0, `all joggers should run smoothly along sidewalks (stuck=${stuckJoggers})`);

  // 2. Pure North/South vehicle OBB collision accuracy (dx === 0 must not warp hitbox by 45 deg!)
  const nsCar = { kind: "car", x: 100, y: 100, dx: 0, dy: 1 };
  assert.ok(checkTrafficCollision({ vehicles: [nsCar] }, { x: 100, y: 110 }), "N/S car must collide head-on at dy=10");
  assert.equal(checkTrafficCollision({ vehicles: [nsCar] }, { x: 110, y: 100 }), null, "N/S car must not clip sidewalk at dx=10");

  // 3. Crosswalk yielding holds even at close range (dist <= 16) and trailing cars queue politely
  const cw = worldMap.vectorRoads.crosswalks[0];
  const cwPx = cw.x * 16;
  const cwPy = cw.y * 16;
  const leadCar = {
    id: "lead", kind: "car", variant: 0, roadClass: 3,
    x: cwPx - 14, y: cwPy, dx: 1, dy: 0, dir: "e", rotDeg: 0, speed: 50, yielded: false,
  };
  const tailCar = {
    id: "tail", kind: "car", variant: 1, roadClass: 3,
    x: cwPx - 38, y: cwPy, dx: 1, dy: 0, dir: "e", rotDeg: 0, speed: 50, yielded: false,
  };
  const cwTraffic = { mode: "tile", vehicles: [leadCar, tailCar] };
  updateRoadTraffic(cwTraffic, 0.05, { x: cwPx, y: cwPy }, worldMap, { safeCrossingActive: true });
  assert.equal(leadCar.yielded, true, "lead car should remain yielded even at 14px from crosswalk pedestrian");
  assert.equal(tailCar.yielded, true, "trailing car should queue politely behind yielded lead car");

  // 4. Fast-travel snapToWalkableTile never drops Liam onto a vector road or solid median
  for (let i = 0; i < 60; i++) {
    const rx = 20 + ((i * 73) % (width - 40));
    const ry = 20 + ((i * 137) % (height - 40));
    const s = snapToWalkableTile(worldMap, rx, ry, 18);
    const px = s.x * 16 + 8;
    const py = s.y * 16 + 8;
    assert.equal(collider.isBoxBlocked(px, py), false, `snap (${s.x},${s.y}) must not be blocked`);
    assert.equal(safety.isBoxOnRoad(px, py), false, `snap (${s.x},${s.y}) must not land on a vector road`);
  }

  // 5. Opening the Little Free Library chest early before Quest 2 must NEVER soft-lock Quest 2!
  const qs = createQuestSystem({ landmarks, quests, worldMap });
  const chest = qs.interactables[0];
  qs.interactWithChest(chest.id);
  assert.equal(chest.opened, true);
  qs.setActiveQuest("quest_02_riddle_hunt");
  const revisit = qs.interactWithChest(chest.id);
  assert.equal(revisit.questEvent?.type, "quest_completed", "revisiting already-opened chest should complete Quest 2");
  assert.ok(qs.state.completedQuests.has("quest_02_riddle_hunt"));
});

test("NPC wave frames, spooky attack poses, 3-frame sword arcs, 2x HD FX sprites, interaction timers, and streamlined HUD", () => {
  // 1. Verify all new animated character & 2x HD pixel-art FX sprites bake cleanly
  const prevDoc = globalThis.document;
  globalThis.document = createMockCanvasDocument();
  try {
    const sprites = buildSnesSpriteAtlas("autumn_golden");
    for (let i = 0; i < 6; i++) {
      assert.ok(sprites[`npc_${i}_wave`], `missing animated wave frame npc_${i}_wave`);
      assert.equal(sprites[`npc_${i}_wave`].__pixelScale, 0.5);
    }
    for (const kind of ["skeleton", "phantom", "pumpkin_ghoul"]) {
      for (const dir of ["right", "left"]) {
        const key = `spooky_${kind}_attack_${dir}`;
        assert.ok(sprites[key], `missing spooky attack pose ${key}`);
        assert.equal(sprites[key].__pixelScale, 0.5);
      }
    }
    for (const dir of ["down", "up", "left", "right"]) {
      for (let f = 0; f < 3; f++) {
        assert.ok(sprites[`sword_slash_${dir}_${f}`], `missing 3-frame sword slash sword_slash_${dir}_${f}`);
      }
      assert.ok(sprites[`sword_slash_${dir}`], `backwards-compat sword_slash_${dir} must exist`);
    }
    for (const key of [
      "fx_ring_gold_0", "fx_ring_gold_1", "fx_ring_green_0", "fx_ring_safe_0",
      "prop_welcome_mat", "prop_welcome_mat_glow",
      "fx_lantern_glow_0", "fx_siddur_ring_0", "fx_siddur_ring_2",
      "fx_sheikah_ring", "fx_water_ripple_0", "fx_grave_mist", "fx_chalk_arrow",
      "fx_heart_pink", "fx_heart_red", "fx_heart_empty",
      "fx_sparkle_gold", "fx_sparkle_cyan", "fx_alert_bang", "fx_sweat_drop",
      "fx_music_note", "fx_bone_0", "fx_bone_1", "fx_skull_poof", "fx_ember",
      "fx_pretzel", "fx_acorn", "fx_feather_0", "fx_leaf_0",
      "bubble_jogger_whoa", "bubble_whoa", "bubble_npc_hi", "bubble_npc_yay",
    ]) {
      assert.ok(sprites[key], `missing upgraded 2x HD FX sprite: ${key}`);
      assert.equal(sprites[key].__pixelScale, 0.5, `${key} should use 2x HD pixelScale 0.5`);
    }
  } finally {
    globalThis.document = prevDoc;
  }

  // 2. Verify interaction animation timers across skeletons, joggers, protestors & wild animals
  const { worldMap, landmarks } = loadWorldData();
  const gf = buildGraveyardFeatures(worldMap);
  const sl = buildStreetLife(worldMap, {
    parkOccupiedGrid: gf.occupiedGrid,
    graveyardGrid: gf.graveyardGrid,
    graveyardZones: gf.zones,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });

  // Skeleton attack pose on bump, tailored spookyKind defeat metadata, and mist respawn timer
  const skel = sl.spookyChars.find((s) => s.kind === "skeleton");
  assert.ok(skel, "expected at least one graveyard skeleton");
  const bumpPlayer = { x: skel.x + 2, y: skel.y, facing: "left", hearts: 5, maxHearts: 5, hurtTimer: 0 };
  updateStreetLife(sl, 0.05, bumpPlayer, worldMap);
  assert.ok(skel.attackTimer > 0, "bumping skeleton must trigger attackTimer lunge pose");

  const swRes = performSwordAttack(sl, { x: skel.x - 10, y: skel.y, facing: "right" });
  const defSkel = swRes.defeated.find((d) => d.spookyKind === "skeleton");
  assert.ok(defSkel, "performSwordAttack must include spookyKind metadata for tailored defeat FX");

  // Fast-forward skeleton respawn -> triggers respawnAnimTimer mist rise-in!
  skel.defeatedTimer = 0.02;
  updateStreetLife(sl, 0.05, { x: skel.x + 120, y: skel.y, hearts: 5, maxHearts: 5, hurtTimer: 0 }, worldMap);
  assert.ok(skel.respawnAnimTimer > 0.5, "respawning skeleton must trigger respawnAnimTimer mist rise-in");

  // Siddur dispel also includes spookyKind metadata
  const ph = sl.spookyChars.find((s) => s.kind === "phantom");
  if (ph) {
    ph.defeatedTimer = 0;
    const sidRes = performSiddurDispel(sl, { x: ph.x + 8, y: ph.y });
    assert.ok(sidRes.positions.some((p) => p.spookyKind === "phantom"), "performSiddurDispel must report spookyKind");
  }

  // Protestor mob cheers together when given a snack!
  const mobMember = sl.protestors.find((p) => p.isMob);
  assert.ok(mobMember, "expected a marching group");
  interactWithStreetLife(sl, { kind: "protestor", target: mobMember }, mobMember.x - 8, mobMember.y, { hasSnack: true });
  assert.ok(mobMember.cheerTimer > 1.0, "marcher given a snack must trigger cheerTimer celebration hop");

  // Wild turkey hops when shooed
  const tk = sl.turkeys[0];
  assert.ok(tk);
  interactWithStreetLife(sl, { kind: "turkey", target: tk }, tk.x - 8, tk.y);
  assert.ok(tk.hopTimer > 0.3, "shooed turkey must trigger startled hopTimer");

  // Jogger reacts with startled hop when Liam scoots past fast (0 heart damage!)
  const jg = sl.joggers[0];
  assert.ok(jg);
  jg.reactTimer = 0;
  jg.greetCooldown = 0;
  const scootPlayer = { x: jg.x + 20, y: jg.y, hearts: 5, maxHearts: 5, hurtTimer: 0 };
  updateStreetLife(sl, 0.05, scootPlayer, worldMap, { isFasterNow: true });
  assert.ok(jg.reactTimer > 0, "scooting past a jogger must trigger startled reactTimer hop");
  assert.equal(scootPlayer.hearts, 5, "jogger reaction must never hurt Liam");

  // 3. Verify streamlined HUD structure in index.html
  const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
  const utilMatch = html.match(/<div class="utility-row">([\s\S]*?)<\/div>/);
  assert.ok(utilMatch, "index.html must contain .utility-row");
  const utilButtons = [...utilMatch[1].matchAll(/id="(btn-[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(
    utilButtons,
    ["btn-inside", "btn-snack", "btn-sword", "btn-siddur"],
    ".utility-row must only contain the 4 contextual gameplay action buttons (no shortcut clutter)"
  );
  const drawerMatch = html.match(/id="tools-drawer"[\s\S]*?<\/div>\s*<\/div>/);
  assert.ok(drawerMatch, "index.html must contain collapsible #tools-drawer for secondary options");
  for (const id of ["btn-gps", "btn-outfit", "btn-paint", "btn-mute", "btn-home", "btn-salzberg", "btn-debug"]) {
    assert.ok(drawerMatch[0].includes(`id="${id}"`), `#tools-drawer should house secondary shortcut ${id}`);
  }
});
