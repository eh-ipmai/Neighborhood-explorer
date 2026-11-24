import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PROTEST_CHANTS,
  SPOOKY_ARCHETYPES,
  buildStreetLife,
  updateStreetLife,
  checkStreetLifeContact,
  isBlockedByStreetLife,
  findNearbyStreetLife,
  interactWithStreetLife,
} from "../src/streetlife.js";
import { buildGraveyardFeatures, getGraveyardGhostPos } from "../src/graveyards.js";
import { DEFAULT_HITBOX } from "../src/player.js";

test("buildStreetLife spawns roving wild turkeys & annoying sidewalk protestors across Newton and near Home Base", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const home = worldMap.origin.spawnTile;
  const tileSize = worldMap.tileSize || 16;
  const sl = buildStreetLife(worldMap, { spawnTile: home });

  assert.ok(sl.turkeys.length >= 10, `expected >= 10 wild turkeys (got ${sl.turkeys.length})`);
  assert.ok(sl.protestors.length >= 8, `expected >= 8 sidewalk protestors (got ${sl.protestors.length})`);

  // At least 2 turkeys & 1 protestor spawn right near Home Base so kids spot them right away!
  const nearTurkeys = sl.turkeys.filter(
    (t) => Math.hypot(t.x / tileSize - home.x, t.y / tileSize - home.y) <= 16
  );
  const nearProtestors = sl.protestors.filter(
    (p) => Math.hypot(p.x / tileSize - home.x, p.y / tileSize - home.y) <= 18
  );
  assert.ok(nearTurkeys.length >= 2, `expected >= 2 turkeys near Home Base (got ${nearTurkeys.length})`);
  assert.ok(nearProtestors.length >= 1, `expected >= 1 protestor near Home Base (got ${nearProtestors.length})`);

  // Every protestor stands on a real sidewalk tile (tileId === 1)
  const { width, height } = worldMap.dimensions;
  for (const pr of sl.protestors) {
    const tx = Math.floor(pr.x / tileSize);
    const ty = Math.floor(pr.y / tileSize);
    assert.equal(worldMap.layers.base[ty * width + tx], 1, `protestor ${pr.id} should spawn on a sidewalk`);
    assert.ok(PROTEST_CHANTS.includes(pr.chantText), "protestor should have a valid shout chant");
  }

  // Verify full-map coverage across ALL 4 quadrants (NW, NE, SW, SE) + central Newton!
  const midX = (width * tileSize) / 2;
  const midY = (height * tileSize) / 2;
  const countQuadrants = (list) => {
    const q = { nw: 0, ne: 0, sw: 0, se: 0, center: 0 };
    for (const item of list) {
      if (item.x < midX && item.y < midY) q.nw++;
      else if (item.x >= midX && item.y < midY) q.ne++;
      else if (item.x < midX && item.y >= midY) q.sw++;
      else q.se++;
      if (Math.abs(item.x - midX) < midX * 0.5 && Math.abs(item.y - midY) < midY * 0.5) q.center++;
    }
    return q;
  };
  const tq = countQuadrants(sl.turkeys);
  const pq = countQuadrants(sl.protestors);
  for (const [label, q] of [["turkeys", tq], ["protestors", pq]]) {
    assert.ok(q.nw >= 10, `${label} must populate NW quadrant (got ${q.nw})`);
    assert.ok(q.ne >= 10, `${label} must populate NE quadrant (got ${q.ne})`);
    assert.ok(q.sw >= 10, `${label} must populate SW quadrant (got ${q.sw})`);
    assert.ok(q.se >= 10, `${label} must populate SE quadrant (got ${q.se})`);
    assert.ok(q.center >= 10, `${label} must populate central Newton (got ${q.center})`);
  }
});

test("protestors peacefully block sidewalks until Liam shares a snack, and wild turkeys puff, gobble & flee when shooed", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const sl = buildStreetLife(worldMap, { spawnTile: worldMap.origin.spawnTile });
  const pr = sl.protestors[0];
  const tk = sl.turkeys[0];

  // 1. Protestor physically blocks a player trying to walk straight through them
  assert.equal(
    isBlockedByStreetLife(sl, pr.x, pr.y, DEFAULT_HITBOX, pr.x - 24, pr.y),
    true,
    "active protestor should physically block Liam on the sidewalk"
  );
  // Never soft-locks if already overlapping!
  assert.equal(
    isBlockedByStreetLife(sl, pr.x, pr.y, DEFAULT_HITBOX, pr.x, pr.y),
    false,
    "overlapping protestor must not trap Liam"
  );

  // 2. Approaching a protestor triggers shout SFX & speech bubble; without a snack they politely ask for one;
  //    sharing a snack makes them cheer & step aside!
  let shouted = 0;
  pr.shoutTimer = 0.01;
  updateStreetLife(sl, 0.05, { x: pr.x - 24, y: pr.y }, worldMap, {
    onProtestorShout: () => shouted++,
  });
  assert.ok(shouted >= 1 && pr.bubbleTimer > 0, "protestor should chant with a speech bubble when Liam approaches");

  const nearPr = findNearbyStreetLife(sl, pr.x - 14, pr.y, 26);
  assert.equal(nearPr?.kind, "protestor");

  // Without a snack -> polite hint, stays in place
  const noSnackRes = interactWithStreetLife(sl, nearPr, pr.x - 14, pr.y, { hasSnack: false });
  assert.equal(noSnackRes?.sharedSnack, false);
  assert.equal(noSnackRes?.needsSnack, true);
  assert.equal(pr.yieldTimer, 0, "marcher should still wait for a snack when player has none");

  // Sharing a snack -> consumes 1 snack, cheers, and happily steps aside!
  let snacksLeft = 2;
  const prRes = interactWithStreetLife(sl, nearPr, pr.x - 14, pr.y, {
    hasSnack: snacksLeft > 0,
    consumeSnack: () => {
      snacksLeft--;
    },
  });
  assert.equal(prRes?.kind, "protestor");
  assert.equal(prRes?.sharedSnack, true);
  assert.equal(snacksLeft, 1, "sharing a snack should consume 1 snack");
  assert.ok(pr.yieldTimer > 0, "marcher should happily step aside after receiving a snack");
  assert.equal(
    isBlockedByStreetLife(sl, pr.x, pr.y, DEFAULT_HITBOX, pr.x - 24, pr.y),
    false,
    "yielding protestor should let Liam walk past cleanly"
  );

  // 3. Approaching a wild turkey makes it puff up & gobble; shooing makes it flee!
  let gobbled = 0;
  updateStreetLife(sl, 0.05, { x: tk.x - 24, y: tk.y }, worldMap, {
    onTurkeyGobble: () => gobbled++,
  });
  assert.ok(gobbled >= 1 && tk.puffedTimer > 0 && tk.gobbleBubbleTimer > 0, "turkey should puff up and gobble!");

  const nearTk = findNearbyStreetLife(sl, tk.x - 14, tk.y, 26);
  assert.equal(nearTk?.kind, "turkey");
  const tkRes = interactWithStreetLife(sl, nearTk, tk.x - 14, tk.y);
  assert.equal(tkRes?.kind, "turkey");
  assert.ok(tk.fleeTimer > 0, "shooed turkey should bolt away");
});

test("touching turkeys knocks Liam backwards, while peaceful protestor groups NEVER hurt Liam and clear the sidewalk for a snack", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const landmarks = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "landmarks.json"), "utf8")
  );
  const sl = buildStreetLife(worldMap, { spawnTile: worldMap.origin.spawnTile, landmarks });

  // 1. Groups of 3-5 marchers spawn across Newton
  assert.ok(Array.isArray(sl.mobs) && sl.mobs.length >= 2, `expected >= 2 marching groups (got ${sl.mobs?.length})`);
  const mobMembers = sl.protestors.filter((p) => p.isMob);
  assert.ok(mobMembers.length >= 6, `expected >= 6 group marcher members (got ${mobMembers.length})`);
  for (const mob of sl.mobs) {
    assert.ok(mob.count >= 3 && mob.count <= 5, `group ${mob.id} should have 3..5 marchers (got ${mob.count})`);
  }

  // 2. Touching a wild turkey triggers backward knockback + hurt/damage state + invulnerability window
  const tk = sl.turkeys[0];
  const pTurkey = {
    x: tk.x - 10,
    y: tk.y,
    facing: "right",
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hearts: 3,
    maxHearts: 3,
  };
  let turkeyBump = null;
  updateStreetLife(sl, 0.05, pTurkey, worldMap, {
    onPlayerBump: (b) => { turkeyBump = b; },
  });
  assert.equal(turkeyBump?.kind, "turkey", "touching a turkey should fire a turkey bump event");
  assert.ok(pTurkey.knockbackTimer > 0, "turkey hit must set knockbackTimer");
  assert.ok(pTurkey.knockbackVx < -50, "turkey hit from east must knock Liam backwards (west)");
  assert.ok(pTurkey.hurtTimer > 0.5, "turkey hit must trigger hurt/damage blink timer");
  assert.equal(pTurkey.hearts, 2, "turkey hit must visibly reduce damage hearts");
  assert.equal(checkStreetLifeContact(sl, pTurkey), null, "hurtTimer invulnerability must prevent instant double-hit");

  // 3. Touching a peaceful protestor group NEVER hurts Liam or knocks him back!
  const mobPr = mobMembers[0];
  const pMob = {
    x: mobPr.x,
    y: mobPr.y + 10,
    facing: "up",
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hearts: 5,
    maxHearts: 5,
  };
  let mobBump = null;
  updateStreetLife(sl, 0.05, pMob, worldMap, {
    onPlayerBump: (b) => { mobBump = b; },
  });
  assert.equal(mobBump, null, "peaceful protestors must NEVER hurt Liam or trigger damage knockback");
  assert.equal(pMob.hearts, 5, "peaceful protestors must NEVER take away health hearts");
  assert.equal(pMob.hurtTimer, 0, "peaceful protestors must NEVER trigger hurt state");

  // Without a snack, the group politely asks for a snack and stays in place
  const noSnackGroup = interactWithStreetLife(sl, { kind: "protestor", target: mobPr }, pMob.x, pMob.y, {
    hasSnack: false,
  });
  assert.equal(noSnackGroup?.blocked, true);
  assert.equal(noSnackGroup?.needsSnack, true);
  assert.equal(mobPr.yieldTimer, 0);

  // Sharing a snack clears the ENTIRE marching group happily!
  const snackGroup = interactWithStreetLife(sl, { kind: "protestor", target: mobPr }, pMob.x, pMob.y, {
    hasSnack: true,
  });
  assert.equal(snackGroup?.sharedSnack, true);
  assert.equal(snackGroup?.blocked, false);
  const peers = sl.protestors.filter((p) => p.mobId === mobPr.mobId);
  assert.ok(peers.every((p) => p.yieldTimer > 15), "sharing a snack must clear every member of the marching group");
});

test("spooky graveyard characters spawn strictly inside graveyard areas, stay inside them, and take down health hearts on contact", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const landmarks = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "landmarks.json"), "utf8")
  );
  const tileSize = worldMap.tileSize || 16;
  const { width } = worldMap.dimensions;
  const gf = buildGraveyardFeatures(worldMap);
  const sl = buildStreetLife(worldMap, {
    parkOccupiedGrid: gf.occupiedGrid,
    graveyardGrid: gf.graveyardGrid,
    graveyardZones: gf.zones,
    spawnTile: worldMap.origin.spawnTile,
    landmarks,
  });

  // 1. Spooky graveyard characters spawn in EVERY graveyard zone & include all spooky archetypes!
  assert.ok(Array.isArray(sl.spookyChars) && sl.spookyChars.length >= 6, `expected >= 6 spooky characters (got ${sl.spookyChars?.length})`);
  const validKinds = new Set(SPOOKY_ARCHETYPES.map((a) => a.kind));
  const byZone = new Map();
  for (const sp of sl.spookyChars) {
    assert.ok(validKinds.has(sp.kind), `spooky character kind "${sp.kind}" must be valid`);
    const tx = Math.floor(sp.x / tileSize);
    const ty = Math.floor(sp.y / tileSize);
    assert.equal(
      gf.graveyardGrid[ty * width + tx],
      sp.zoneCode,
      `spooky character ${sp.id} (${sp.kind}) at (${tx},${ty}) must spawn strictly inside its graveyard zone`
    );
    byZone.set(sp.zoneId, (byZone.get(sp.zoneId) || 0) + 1);
  }
  for (const zone of gf.zones) {
    assert.ok(
      (byZone.get(zone.id) || 0) >= 3,
      `graveyard "${zone.name}" must have >= 3 spooky characters (got ${byZone.get(zone.id) || 0})`
    );
  }

  // 2. Touching a spooky graveyard character takes down health hearts, triggers backward knockback & hurt invulnerability!
  const sp = sl.spookyChars[0];
  const player = {
    x: sp.x - 10,
    y: sp.y,
    facing: "right",
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hearts: 3,
    maxHearts: 3,
  };
  let spookyBump = null;
  updateStreetLife(sl, 0.05, player, worldMap, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 1.0,
    onPlayerBump: (b) => { spookyBump = b; },
  });
  assert.equal(spookyBump?.kind, "spooky", "touching a spooky graveyard character should fire a spooky bump event");
  assert.equal(player.hearts, 2, "spooky graveyard character hit must reduce health hearts from 3 to 2");
  assert.ok(player.hurtTimer > 0.5, "spooky hit must trigger hurt invulnerability timer");
  assert.ok(player.knockbackTimer > 0 && player.knockbackVx < -50, "spooky hit from east must knock Liam backwards");
  assert.equal(checkStreetLifeContact(sl, player, { graveyardGhosts: gf.ghosts, elapsedTime: 1.0 }), null, "hurtTimer must prevent instant double-hit");

  // 3. Spooky graveyard characters NEVER wander outside their graveyard area even when chasing Liam toward the edge!
  sp.spookTimer = 0;
  const edgeTarget = { x: sp.x + 64, y: sp.y + 64, hurtTimer: 99, hearts: 3, maxHearts: 3 };
  for (let step = 0; step < 60; step++) {
    updateStreetLife(sl, 0.1, edgeTarget, worldMap, { graveyardGhosts: gf.ghosts, elapsedTime: step * 0.1 });
    const stx = Math.floor(sp.x / tileSize);
    const sty = Math.floor(sp.y / tileSize);
    assert.equal(
      gf.graveyardGrid[sty * width + stx],
      sp.zoneCode,
      `spooky character ${sp.id} must remain strictly inside its graveyard zone after moving`
    );
  }

  // 4. Touching a floating graveyard ghost ALSO takes down health hearts!
  const g = gf.ghosts[0];
  const gp = getGraveyardGhostPos(g, 2.0, tileSize);
  const pGhost = {
    x: gp.cx - 8,
    y: gp.cy,
    facing: "right",
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hearts: 2,
    maxHearts: 3,
  };
  let ghostBump = null;
  updateStreetLife(sl, 0.05, pGhost, worldMap, {
    graveyardGhosts: gf.ghosts,
    elapsedTime: 2.0,
    onPlayerBump: (b) => { ghostBump = b; },
  });
  assert.equal(ghostBump?.kind, "spooky", "touching a floating graveyard ghost should trigger spooky damage");
  assert.equal(pGhost.hearts, 1, "floating graveyard ghost must reduce health hearts from 2 to 1");

  // 5. Pressing interact near a spooky character startles it back cleanly!
  const sp2 = sl.spookyChars[1];
  for (const s of sl.spookyChars) s.spookTimer = 0;
  const nearSp = findNearbyStreetLife(sl, sp2.x - 6, sp2.y, 26);
  assert.equal(nearSp?.kind, "spooky");
  const spRes = interactWithStreetLife(sl, nearSp, sp2.x - 6, sp2.y);
  assert.equal(spRes?.kind, "spooky");
  assert.ok(nearSp.target.spookTimer > 1.5, "interacting with a spooky character should startle it back");
});
