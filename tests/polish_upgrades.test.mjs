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
} from "../src/streetlife.js";
import { buildParkingLotCars } from "../src/parking_lots.js";
import { buildGraveyardFeatures } from "../src/graveyards.js";
import { buildParkFeatures } from "../src/parks.js";

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
