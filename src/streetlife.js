/**
 * Newton Street Life & Spooky Graveyard Character System:
 *   1. Roving Wild Newton Turkeys — bold neighborhood turkeys that strut across lawns,
 *      sidewalks, and crosswalks, puff up their autumn tail fans, and gobble at Liam!
 *   2. Annoying Sidewalk Protestors — sign-waving sidewalk pickets who pace busy blocks,
 *      shout funny chants in crisp pixel speech bubbles, and step in Liam's way until he
 *      dodges around or says "Excuse me!" (Space / E).
 *   3. Spooky Graveyard Characters — rattling skeletons, floating phantoms, and glowing
 *      pumpkin ghouls prowling strictly inside Newton's graveyard areas that spook Liam
 *      and take down his health hearts on contact!
 *
 * Pure JS (zero DOM dependencies) so it runs in headless Node unit tests too.
 */

import { buildGraveyardMask, getGraveyardGhostPos } from "./graveyards.js";
import { getNavigationSubgrid } from "./subgrid.js";
import { getNeighborhoodMeta } from "./neighborhood_meta.js";

export const CRITTER_ARCHETYPES = {
  squirrel: {
    kind: "squirrel",
    name: "Wild Squirrel",
    icon: "🐿️",
    bubble: "bubble_chitter",
    sound: "squirrel",
    roamSpeed: 20,
    chaseSpeed: 22,
    fleeSpeed: 68,
    hitRadius: 13.0,
    hitToast: "💥 OUCH! A feisty Newton squirrel darted at your shoes and took 1 heart!",
    shooToast: "🐿️ CHITTER-CHITTER! The wild squirrel scampered up toward the trees!",
    variants: 1,
    hasTrailingLeash: false,
  },
  cat: {
    kind: "cat",
    name: "Prowling Cat",
    icon: "🐱",
    bubble: "bubble_meow",
    sound: "cat",
    roamSpeed: 17,
    chaseSpeed: 20,
    fleeSpeed: 64,
    hitRadius: 13.5,
    hitToast: "💥 OUCH! A sassy neighborhood cat pounced past your ankles and took 1 heart!",
    shooToast: "🐱 MROW! The sassy cat hopped gracefully onto a garden wall!",
    variants: 2,
    hasTrailingLeash: false,
  },
  dog: {
    kind: "dog",
    name: "Runaway Dog",
    icon: "🐕",
    bubble: "bubble_woof",
    sound: "dog",
    roamSpeed: 23,
    chaseSpeed: 27,
    fleeSpeed: 72,
    hitRadius: 14.5,
    hitToast: "💥 OUCH! A runaway dog with a trailing leash zoomed into you and took 1 heart!",
    shooToast: "🐕 WOOF WOOF! You tossed a pretend stick and the leash-trailing pup bounded away!",
    variants: 2,
    hasTrailingLeash: true,
  },
};

export const SPOOKY_ARCHETYPES = [
  {
    kind: "skeleton",
    name: "Rattling Skeleton",
    bubble: "bubble_rattle",
    hitToast: "💀 BONE-RATTLE! A spooky graveyard skeleton spooked you and took 1 heart!",
    shooToast: "🔦 Clatter! You startled the Rattling Skeleton back behind the tombstones!",
    speed: 24,
  },
  {
    kind: "phantom",
    name: "Graveyard Phantom",
    bubble: "bubble_boo",
    hitToast: "👻 BOO! A spooky graveyard phantom chilled you and took 1 heart!",
    shooToast: "🔦 Whoosh! You flashed your courage and sent the Graveyard Phantom drifting back!",
    speed: 27,
  },
  {
    kind: "pumpkin_ghoul",
    name: "Pumpkin Ghoul",
    bubble: "bubble_spooky",
    hitToast: "🎃 EEK! A glowing Pumpkin Ghoul startled you and took 1 heart!",
    shooToast: "🔦 Hee-hee! You spooked the Pumpkin Ghoul back toward the crypt!",
    speed: 23,
  },
];

export const PROTEST_CHANTS = [
  "TOO MANY TURKEYS!",
  "MORE ICE CREAM!",
  "SAVE THE LEAVES!",
  "FIX THIS SIDEWALK!",
  "FREE BAGELS NOW!",
  "READ MY SIGN!!",
  "NO MORE HOMEWORK!",
  "HONK FOR NEWTON!",
];

export const PROTESTOR_QUIPS = [
  "Hi neighbor! Marching for MORE ICE CREAM really works up an appetite — got a snack to share?",
  "We're marching peacefully for MORE PARKS & AUTUMN LEAVES! A snack break sounds amazing!",
  "Hey there, Explorer! Our tummies are rumbling — share a snack and we'll happily step aside!",
  "FREE BAGELS FOR EVERY 7-YEAR-OLD IN NEWTON! Speaking of which, do you have a snack?",
  "Ooh, marching down Boylston Street makes us super hungry! Got a snack from your kitchen?",
  "Thanks for saying hi, neighbor! If you have a snack to share, we'll gladly clear the sidewalk!",
];

export const JOGGER_CHANTS = [
  "ON YOUR LEFT!!",
  "TRACK!! MOVE IT!!",
  "SUB-3 MARATHON PACE!",
  "DON'T BREAK MY STRIDE!",
  "STRAVA SEGMENT PR!!",
];

const WALKABLE_TURKEY_TILES = new Set([0, 1, 2, 4, 7, 9, 10, 11]);
const WALKABLE_GRAVEYARD_TILES = new Set([0, 7, 9, 11]);
const SIDEWALK_TILE = 1;
const ROAD_TILES = new Set([2, 3, 4, 12, 13]);

function hash2(x, y, seed = 17) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

function isTurkeyTile(base, collision, width, height, tx, ty) {
  if (tx < 2 || ty < 2 || tx >= width - 2 || ty >= height - 2) return false;
  const idx = ty * width + tx;
  if (collision && collision[idx] === 1) return false;
  return WALKABLE_TURKEY_TILES.has(base[idx]);
}

function isSpookyGraveyardTile(base, collision, graveGrid, width, height, tx, ty, zoneCode = 0) {
  if (tx < 2 || ty < 2 || tx >= width - 2 || ty >= height - 2) return false;
  const idx = ty * width + tx;
  const zc = graveGrid ? graveGrid[idx] : 0;
  if (zc === 0) return false;
  if (zoneCode > 0 && zc !== zoneCode) return false;
  if (collision && collision[idx] === 1) return false;
  return WALKABLE_GRAVEYARD_TILES.has(base[idx]);
}

function isBusySidewalk(base, collision, width, height, tx, ty, subgrid = null, tileSize = 16) {
  if (tx < 3 || ty < 3 || tx >= width - 3 || ty >= height - 3) return false;
  const idx = ty * width + tx;
  if (base[idx] !== SIDEWALK_TILE) return false;
  if (collision && collision[idx] === 1) return false;
  if (subgrid && subgrid.hasVectorRoads) {
    const px = tx * tileSize + tileSize * 0.5;
    const py = ty * tileSize + tileSize * 0.5;
    if (subgrid.isRoadAtPx(px, py)) return false;
    const sx = Math.floor(px / subgrid.subCellSize);
    const sy = Math.floor(py / subgrid.subCellSize);
    if (subgrid.isSolidAtSub(sx, sy)) return false;
  }
  // Must border a real street/highway so protestors stand on visible sidewalks
  const n = base[(ty - 1) * width + tx];
  const s = base[(ty + 1) * width + tx];
  const w = base[ty * width + (tx - 1)];
  const e = base[ty * width + (tx + 1)];
  return ROAD_TILES.has(n) || ROAD_TILES.has(s) || ROAD_TILES.has(w) || ROAD_TILES.has(e);
}

function measureSidewalkPatrol(base, collision, width, height, tx, ty, subgrid = null, tileSize = 16) {
  // Check horizontal sidewalk run length vs vertical sidewalk run length
  let hMin = tx;
  let hMax = tx;
  while (hMin > tx - 3 && isBusySidewalk(base, collision, width, height, hMin - 1, ty, subgrid, tileSize)) hMin--;
  while (hMax < tx + 3 && isBusySidewalk(base, collision, width, height, hMax + 1, ty, subgrid, tileSize)) hMax++;

  let vMin = ty;
  let vMax = ty;
  while (vMin > ty - 3 && isBusySidewalk(base, collision, width, height, tx, vMin - 1, subgrid, tileSize)) vMin--;
  while (vMax < ty + 3 && isBusySidewalk(base, collision, width, height, tx, vMax + 1, subgrid, tileSize)) vMax++;

  const hSpan = hMax - hMin;
  const vSpan = vMax - vMin;
  if (hSpan >= vSpan) {
    return { axis: "h", minT: hMin, maxT: hMax, span: hSpan };
  }
  return { axis: "v", minT: vMin, maxT: vMax, span: vSpan };
}

/**
 * Deterministically spawn roving wild Newton turkeys, annoying sidewalk protestors,
 * and spooky graveyard characters (strictly inside Newton's graveyard areas!).
 */
export function buildStreetLife(
  worldMap,
  { parkOccupiedGrid = null, graveyardGrid = null, graveyardZones = null, spawnTile = null, landmarks = [] } = {}
) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  const tileSize = worldMap.tileSize || 16;
  const neighborhoodMeta = getNeighborhoodMeta(worldMap);
  const localChants = neighborhoodMeta.isNewton
    ? PROTEST_CHANTS
    : PROTEST_CHANTS.map((c) =>
        c === "HONK FOR NEWTON!" ? `HONK FOR ${neighborhoodMeta.cityShort.toUpperCase().slice(0, 12)}!` : c
      );
  const localQuips = neighborhoodMeta.isNewton
    ? PROTESTOR_QUIPS
    : [
        "Hi neighbor! Marching for MORE ICE CREAM really works up an appetite — got a snack to share?",
        "We're marching peacefully for MORE PARKS & AUTUMN LEAVES! A snack break sounds amazing!",
        "Hey there, Explorer! Our tummies are rumbling — share a snack and we'll happily step aside!",
        `FREE SNACKS FOR EVERY KID IN ${neighborhoodMeta.cityShort.toUpperCase()}! Speaking of which, do you have a snack?`,
        "Ooh, marching down the neighborhood sidewalk makes us super hungry! Got a snack from your kitchen?",
        "Thanks for saying hi, neighbor! If you have a snack to share, we'll gladly clear the sidewalk!",
      ];
  const home = spawnTile || worldMap.origin?.spawnTile || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const subgrid = getNavigationSubgrid(worldMap);
  const useSub = Boolean(subgrid && subgrid.hasVectorRoads);
  const isClearOffVectorRoad = (tx, ty) => {
    if (!useSub) return true;
    const px = tx * tileSize + tileSize * 0.5;
    const py = ty * tileSize + tileSize * 0.5;
    if (subgrid.isRoadAtPx(px, py)) return false;
    const sx = Math.floor(px / subgrid.subCellSize);
    const sy = Math.floor(py / subgrid.subCellSize);
    return !subgrid.isSolidAtSub(sx, sy);
  };

  let effectiveGraveGrid = graveyardGrid;
  let effectiveGraveZones = graveyardZones;
  if (!effectiveGraveGrid || !Array.isArray(effectiveGraveZones)) {
    const mask = buildGraveyardMask(worldMap);
    effectiveGraveGrid = effectiveGraveGrid || mask.graveyardGrid;
    effectiveGraveZones = Array.isArray(effectiveGraveZones) ? effectiveGraveZones : mask.zones;
  }

  const turkeys = [];
  const squirrels = [];
  const cats = [];
  const dogs = [];
  const critters = [];
  const protestors = [];
  const mobs = [];
  const spookyChars = [];
  const usedSpots = new Set();
  const landmarkSpots = [];

  for (const lm of landmarks || []) {
    const lx = lm.walkTileX ?? lm.tileX;
    const ly = lm.walkTileY ?? lm.tileY;
    if (typeof lx === "number" && typeof ly === "number") {
      landmarkSpots.push({ x: lx, y: ly });
    }
  }

  const nearAnyLandmark = (tx, ty, minDist = 4) =>
    landmarkSpots.some((lm) => Math.hypot(tx - lm.x, ty - lm.y) < minDist);

  const markSpot = (tx, ty, radius = 3) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        usedSpots.add(`${tx + dx},${ty + dy}`);
      }
    }
  };

  // Never spawn right on top of Liam's exact start tile
  markSpot(home.x, home.y, 2);

  const addTurkey = (tx, ty, idx) => {
    const h = hash2(tx, ty, 301 + idx);
    const angle = ((h % 8) * Math.PI) / 4;
    turkeys.push({
      id: `turkey_${idx}`,
      x: tx * tileSize + tileSize / 2,
      y: ty * tileSize + tileSize / 2,
      homeX: tx * tileSize + tileSize / 2,
      homeY: ty * tileSize + tileSize / 2,
      vx: Math.cos(angle) * 16,
      vy: Math.sin(angle) * 16,
      facing: Math.cos(angle) >= 0 ? "right" : "left",
      animTimer: (h % 10) * 0.1,
      dirTimer: 1.5 + (h % 25) * 0.1,
      puffedTimer: 0,
      fleeTimer: 0,
      munchTimer: 0,
      fedTimer: 0,
      fedBy: null,
      lungeTimer: 0,
      hopTimer: 0,
      gobbleBubbleTimer: 0,
      gobbleSoundCooldown: 0,
      shooedCount: 0,
    });
    markSpot(tx, ty, 2);
  };

  const addCritter = (kind, tx, ty) => {
    const arch = CRITTER_ARCHETYPES[kind];
    if (!arch) return;
    const idx = critters.length;
    const h = hash2(tx, ty, 419 + idx * 13);
    const angle = ((h % 8) * Math.PI) / 4;
    const px = tx * tileSize + tileSize / 2;
    const py = ty * tileSize + tileSize / 2;
    const entry = {
      id: `${kind}_${idx}`,
      kind,
      name: arch.name,
      icon: arch.icon,
      variant: h % (arch.variants || 1),
      hasTrailingLeash: Boolean(arch.hasTrailingLeash),
      x: px,
      y: py,
      homeX: px,
      homeY: py,
      vx: Math.cos(angle) * arch.roamSpeed,
      vy: Math.sin(angle) * arch.roamSpeed,
      facing: Math.cos(angle) >= 0 ? "right" : "left",
      animTimer: (h % 10) * 0.1,
      dirTimer: 1.3 + (h % 22) * 0.1,
      alertTimer: 0,
      fleeTimer: 0,
      munchTimer: 0,
      fedTimer: 0,
      fedBy: null,
      lungeTimer: 0,
      hopTimer: 0,
      bubbleTimer: 0,
      bubbleSprite: arch.bubble,
      soundCooldown: 0,
      shooedCount: 0,
    };
    critters.push(entry);
    if (kind === "squirrel") squirrels.push(entry);
    else if (kind === "cat") cats.push(entry);
    else if (kind === "dog") dogs.push(entry);
    markSpot(tx, ty, 2);
  };

  const addProtestor = (tx, ty, idx, opts = {}) => {
    const { isMob = false, mobId = null, offsetX = 0, offsetY = 0, markRadius = 4, axisOverride = null } = opts;
    const patrol = measureSidewalkPatrol(base, collision, width, height, tx, ty, subgrid, tileSize);
    const h = hash2(tx, ty, 709 + idx);
    const chantIdx = idx % localChants.length;
    let ax = tx * tileSize + tileSize / 2 + offsetX;
    let ay = ty * tileSize + tileSize / 2 + offsetY;
    if (useSub && subgrid.isRoadAtPx(ax, ay)) {
      ax = tx * tileSize + tileSize / 2;
      ay = ty * tileSize + tileSize / 2;
    }
    const axis = axisOverride || patrol.axis;
    const pr = {
      id: isMob ? `mob_${mobId}_${idx}` : `protestor_${idx}`,
      isMob,
      mobId,
      variant: idx % 3,
      chantIndex: chantIdx,
      chantText: localChants[chantIdx],
      quip: isMob
        ? "Marching together makes us hungry! Share a snack with our group and we'll happily clear the sidewalk!"
        : localQuips[idx % localQuips.length],
      x: ax,
      y: ay,
      anchorX: ax,
      anchorY: ay,
      axis,
      minPx: isMob ? (axis === "h" ? ax - 4 : ay - 4) : patrol.minT * tileSize + 8,
      maxPx: isMob ? (axis === "h" ? ax + 4 : ay + 4) : patrol.maxT * tileSize + 8,
      dir: h % 2 === 0 ? 1 : -1,
      facing: h % 2 === 0 ? "right" : "left",
      animTimer: (h % 12) * 0.15,
      shoutTimer: isMob ? 0.3 + (h % 14) * 0.12 : 0.6 + (h % 20) * 0.12,
      bubbleTimer: 0,
      bubbleSprite: isMob ? "bubble_mob_block" : `bubble_protest_${chantIdx}`,
      shoutSoundCooldown: 0,
      yieldTimer: 0,
      cheerTimer: 0,
      pushTimer: 0,
      yieldOffsetX: 0,
      yieldOffsetY: 0,
    };
    protestors.push(pr);
    if (markRadius > 0) markSpot(tx, ty, markRadius);
    return pr;
  };

  /**
   * Spawn a stubborn 3-to-5 person Protestor Mob tightly blocking a sidewalk stretch
   * so Liam has to figure out how to go around them (cross at a crosswalk, loop a side street, etc.)!
   */
  const trySpawnProtestorMob = (tx, ty) => {
    if (usedSpots.has(`${tx},${ty}`)) return false;
    if (!isBusySidewalk(base, collision, width, height, tx, ty, subgrid, tileSize)) return false;
    if (Math.hypot(tx - home.x, ty - home.y) < 12) return false;
    if (nearAnyLandmark(tx, ty, 4)) return false;

    const patrol = measureSidewalkPatrol(base, collision, width, height, tx, ty, subgrid, tileSize);
    if (patrol.span < 2) return false;

    // Collect 2-4 contiguous sidewalk tiles along the patrol axis to pack 3-5 picket signs tightly!
    const tiles = [];
    for (let t = patrol.minT; t <= patrol.maxT && tiles.length < 4; t++) {
      const mx = patrol.axis === "h" ? t : tx;
      const my = patrol.axis === "h" ? ty : t;
      if (isBusySidewalk(base, collision, width, height, mx, my, subgrid, tileSize) && !nearAnyLandmark(mx, my, 3)) {
        tiles.push({ x: mx, y: my });
      }
    }
    if (tiles.length < 3) return false;

    const mobIdx = mobs.length;
    const mobId = `picket_mob_${mobIdx}`;
    const members = [];
    const wantCount = Math.min(5, tiles.length + (hash2(tx, ty, 919) % 2));
    for (let k = 0; k < wantCount; k++) {
      const tile = tiles[k % tiles.length];
      // Pack closely across the sidewalk width so you can't just squeeze through the middle!
      const extraOffset = k >= tiles.length ? (k % 2 === 0 ? -3 : 3) : 0;
      const offsetX = patrol.axis === "h" ? extraOffset : (k % 2 === 0 ? -3 : 3);
      const offsetY = patrol.axis === "h" ? (k % 2 === 0 ? -3 : 3) : extraOffset;
      const member = addProtestor(tile.x, tile.y, protestors.length, {
        isMob: true,
        mobId,
        offsetX,
        offsetY,
        markRadius: 0,
        axisOverride: patrol.axis,
      });
      members.push(member);
    }
    for (const tile of tiles) markSpot(tile.x, tile.y, 6);
    mobs.push({
      id: mobId,
      axis: patrol.axis,
      cx: tiles[Math.floor(tiles.length / 2)].x,
      cy: tiles[Math.floor(tiles.length / 2)].y,
      count: members.length,
      memberIds: members.map((m) => m.id),
    });
    return true;
  };

  // --- 1. Guarantee 2 Solo Annoying Protestors on busy sidewalks near Home Base (within 5..14 tiles!) ---
  const nearSidewalkCandidates = [];
  for (let r = 5; r <= 16; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = home.x + dx;
        const ty = home.y + dy;
        if (!isBusySidewalk(base, collision, width, height, tx, ty, subgrid, tileSize)) continue;
        if (usedSpots.has(`${tx},${ty}`)) continue;
        const patrol = measureSidewalkPatrol(base, collision, width, height, tx, ty, subgrid, tileSize);
        if (patrol.span >= 2) {
          nearSidewalkCandidates.push({ tx, ty, dist: Math.hypot(dx, dy) });
        }
      }
    }
    if (nearSidewalkCandidates.length >= 16) break;
  }
  for (const cand of nearSidewalkCandidates) {
    if (protestors.length >= 2) break;
    if (usedSpots.has(`${cand.tx},${cand.ty}`)) continue;
    addProtestor(cand.tx, cand.ty, protestors.length);
  }

  // --- 1b. Guarantee at least 1 Protestor Mob near Home Base corridor and 1 near town center! ---
  const townCenterAnchor = neighborhoodMeta.isNewton
    ? { cx: 256, cy: 238, minR: 4, maxR: 26 }
    : { cx: Math.floor(width / 2), cy: Math.floor(height / 2), minR: 8, maxR: 28 };
  const mobAnchors = width >= 200
    ? [
        { cx: home.x, cy: home.y, minR: 14, maxR: 32 },
        townCenterAnchor,
      ]
    : [{ cx: home.x, cy: home.y, minR: 13, maxR: 28 }];

  for (const anchor of mobAnchors) {
    let placedMob = false;
    for (let r = anchor.minR; r <= anchor.maxR && !placedMob; r++) {
      for (let dy = -r; dy <= r && !placedMob; dy++) {
        for (let dx = -r; dx <= r && !placedMob; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (trySpawnProtestorMob(anchor.cx + dx, anchor.cy + dy)) {
            placedMob = true;
          }
        }
      }
    }
  }

  // --- 2. Guarantee 3 Roving Wild Turkeys near Home Base (within 4..13 tiles!) ---
  for (let r = 4; r <= 14 && turkeys.length < 3; r++) {
    for (let dy = -r; dy <= r && turkeys.length < 3; dy++) {
      for (let dx = -r; dx <= r && turkeys.length < 3; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = home.x + dx;
        const ty = home.y + dy;
        if (usedSpots.has(`${tx},${ty}`)) continue;
        if (!isTurkeyTile(base, collision, width, height, tx, ty)) continue;
        if (base[ty * width + tx] === 2) continue; // start off the road
        if (!isClearOffVectorRoad(tx, ty)) continue;
        if (parkOccupiedGrid && parkOccupiedGrid[ty * width + tx] === 1) continue;
        if (effectiveGraveGrid && effectiveGraveGrid[ty * width + tx] !== 0) continue;
        addTurkey(tx, ty, turkeys.length);
      }
    }
  }

  // --- 2b. Guarantee at least 1 Wild Squirrel, 1 Prowling Cat, and 1 Runaway Dog (with trailing leash!) near Home Base! ---
  for (const kind of ["squirrel", "cat", "dog"]) {
    let placedNear = false;
    for (let r = 5; r <= 18 && !placedNear; r++) {
      for (let dy = -r; dy <= r && !placedNear; dy++) {
        for (let dx = -r; dx <= r && !placedNear; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = home.x + dx;
          const ty = home.y + dy;
          if (usedSpots.has(`${tx},${ty}`)) continue;
          if (!isTurkeyTile(base, collision, width, height, tx, ty)) continue;
          if (base[ty * width + tx] === 2) continue;
          if (!isClearOffVectorRoad(tx, ty)) continue;
          if (parkOccupiedGrid && parkOccupiedGrid[ty * width + tx] === 1) continue;
          if (effectiveGraveGrid && effectiveGraveGrid[ty * width + tx] !== 0) continue;
          addCritter(kind, tx, ty);
          placedNear = true;
        }
      }
    }
  }

  // --- 3. Distribute Sidewalk Protestors & Occasional Protestor Mobs evenly across EVERY neighborhood sector! ---
  // Use stratified grid cells (no early cap cutoff!) so NW, NE, Center, SW, SE all have lively pickets & mobs.
  const protestorCell = width >= 200 ? 38 : 16;
  for (let cy0 = 10; cy0 < height - 10; cy0 += protestorCell) {
    for (let cx0 = 10; cx0 < width - 10; cx0 += protestorCell) {
      const cellW = Math.min(protestorCell, width - 10 - cx0);
      const cellH = Math.min(protestorCell, height - 10 - cy0);
      const seedX = cx0 + (hash2(cx0, cy0, 51) % Math.max(1, cellW));
      const seedY = cy0 + (hash2(cx0, cy0, 73) % Math.max(1, cellH));
      const wantsMob = hash2(cx0, cy0, 811) % 4 === 0;
      let placed = false;
      const maxSearchR = Math.min(18, Math.floor(protestorCell / 2));
      for (let r = 0; r <= maxSearchR && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const cx = seedX + dx;
            const cy = seedY + dy;
            if (cx < cx0 || cx >= cx0 + cellW || cy < cy0 || cy >= cy0 + cellH) continue;
            if (usedSpots.has(`${cx},${cy}`)) continue;
            if (!isBusySidewalk(base, collision, width, height, cx, cy, subgrid, tileSize)) continue;
            if (wantsMob && trySpawnProtestorMob(cx, cy)) {
              placed = true;
              continue;
            }
            const patrol = measureSidewalkPatrol(base, collision, width, height, cx, cy, subgrid, tileSize);
            if (patrol.span >= 2) {
              addProtestor(cx, cy, protestors.length);
              placed = true;
            }
          }
        }
      }
    }
  }

  // --- 4. Distribute Roving Wild Turkeys evenly across EVERY neighborhood sector of the entire map! ---
  const turkeyCell = width >= 200 ? 30 : 14;
  for (let cy0 = 8; cy0 < height - 8; cy0 += turkeyCell) {
    for (let cx0 = 8; cx0 < width - 8; cx0 += turkeyCell) {
      const cellW = Math.min(turkeyCell, width - 8 - cx0);
      const cellH = Math.min(turkeyCell, height - 8 - cy0);
      // Spawn 1-2 roving turkeys (small flocks!) in each neighborhood sector
      const wantInCell = hash2(cx0, cy0, 97) % 3 === 0 ? 2 : 1;
      let placedCount = 0;
      for (let attempt = 0; attempt < wantInCell; attempt++) {
        const seedX = cx0 + (hash2(cx0 + attempt * 7, cy0, 19) % Math.max(1, cellW));
        const seedY = cy0 + (hash2(cx0, cy0 + attempt * 11, 29) % Math.max(1, cellH));
        let placed = false;
        const maxSearchR = Math.min(12, Math.floor(turkeyCell / 2));
        for (let r = 0; r <= maxSearchR && !placed; r++) {
          for (let dy = -r; dy <= r && !placed; dy++) {
            for (let dx = -r; dx <= r && !placed; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const ox = seedX + dx;
              const oy = seedY + dy;
              if (ox < cx0 || ox >= cx0 + cellW || oy < cy0 || oy >= cy0 + cellH) continue;
              if (usedSpots.has(`${ox},${oy}`)) continue;
              if (!isTurkeyTile(base, collision, width, height, ox, oy)) continue;
              if (base[oy * width + ox] === 2) continue;
              if (!isClearOffVectorRoad(ox, oy)) continue;
              if (parkOccupiedGrid && parkOccupiedGrid[oy * width + ox] === 1) continue;
              if (effectiveGraveGrid && effectiveGraveGrid[oy * width + ox] !== 0) continue;
              addTurkey(ox, oy, turkeys.length);
              placed = true;
              placedCount++;
            }
          }
        }
        if (placedCount >= wantInCell) break;
      }
    }
  }

  // --- 4b. Distribute Wild Squirrels, Prowling Cats & Runaway Leash-Trailing Dogs across EVERY neighborhood sector! ---
  const critterOrder = ["squirrel", "cat", "dog"];
  const critterCell = width >= 200 ? 34 : 16;
  let cellCounter = 0;
  for (let cy0 = 8; cy0 < height - 8; cy0 += critterCell) {
    for (let cx0 = 8; cx0 < width - 8; cx0 += critterCell) {
      const cellW = Math.min(critterCell, width - 8 - cx0);
      const cellH = Math.min(critterCell, height - 8 - cy0);
      // Spawn 2 different critters per sector so every neighborhood has lively squirrels, cats & leash dogs!
      for (let slot = 0; slot < 2; slot++) {
        const kind = critterOrder[(cellCounter + slot) % critterOrder.length];
        const seedX = cx0 + (hash2(cx0 + slot * 17, cy0, 313) % Math.max(1, cellW));
        const seedY = cy0 + (hash2(cx0, cy0 + slot * 23, 353) % Math.max(1, cellH));
        let placed = false;
        const maxSearchR = Math.min(12, Math.floor(critterCell / 2));
        for (let r = 0; r <= maxSearchR && !placed; r++) {
          for (let dy = -r; dy <= r && !placed; dy++) {
            for (let dx = -r; dx <= r && !placed; dx++) {
              if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
              const ox = seedX + dx;
              const oy = seedY + dy;
              if (ox < cx0 || ox >= cx0 + cellW || oy < cy0 || oy >= cy0 + cellH) continue;
              if (usedSpots.has(`${ox},${oy}`)) continue;
              if (!isTurkeyTile(base, collision, width, height, ox, oy)) continue;
              if (base[oy * width + ox] === 2) continue;
              if (!isClearOffVectorRoad(ox, oy)) continue;
              if (parkOccupiedGrid && parkOccupiedGrid[oy * width + ox] === 1) continue;
              if (effectiveGraveGrid && effectiveGraveGrid[oy * width + ox] !== 0) continue;
              addCritter(kind, ox, oy);
              placed = true;
            }
          }
        }
      }
      cellCounter++;
    }
  }

  // --- 5. Populate Spooky Graveyard Characters strictly inside every graveyard area! ---
  const spookyUsed = new Set();
  const markSpookySpot = (tx, ty, radius = 3) => {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        spookyUsed.add(`${tx + dx},${ty + dy}`);
      }
    }
  };
  const addSpookyChar = (tx, ty, zone, zoneCode) => {
    const idx = spookyChars.length;
    const h = hash2(tx, ty, 521 + idx);
    const arch = SPOOKY_ARCHETYPES[idx % SPOOKY_ARCHETYPES.length];
    const angle = ((h % 8) * Math.PI) / 4;
    const px = tx * tileSize + tileSize / 2;
    const py = ty * tileSize + tileSize / 2;
    spookyChars.push({
      id: `spooky_${idx}`,
      kind: arch.kind,
      name: arch.name,
      zoneId: zone.id,
      zoneCode,
      x: px,
      y: py,
      homeX: px,
      homeY: py,
      vx: Math.cos(angle) * 14,
      vy: Math.sin(angle) * 14,
      speed: arch.speed,
      facing: Math.cos(angle) >= 0 ? "right" : "left",
      animTimer: (h % 10) * 0.14,
      dirTimer: 1.4 + (h % 20) * 0.1,
      spookTimer: 0,
      attackTimer: 0,
      respawnAnimTimer: 0,
      bubbleTimer: 0,
      bubbleSprite: arch.bubble,
      hitToast: arch.hitToast,
      shooToast: arch.shooToast,
      soundCooldown: 0,
      chasing: false,
      defeatedTimer: 0,
    });
    markSpookySpot(tx, ty, 3);
  };

  effectiveGraveZones.forEach((zone, zIdx) => {
    const zoneCode = zIdx + 1;
    let zoneCount = 0;
    const maxPerZone = width >= 200 ? 12 : 5;

    const canPlaceSpooky = (tx, ty) => {
      if (spookyUsed.has(`${tx},${ty}`)) return false;
      if (!isSpookyGraveyardTile(base, collision, effectiveGraveGrid, width, height, tx, ty, zoneCode)) return false;
      if (parkOccupiedGrid && parkOccupiedGrid[ty * width + tx] === 1) return false;
      if (nearAnyLandmark(tx, ty, 3)) return false;
      return true;
    };

    // 5a. Place 2 spooky characters near the graveyard entrance so players spot them right away!
    if (zone.entrance) {
      let nearEntrance = 0;
      for (let r = 2; r <= 12 && nearEntrance < 2 && zoneCount < maxPerZone; r++) {
        for (let dy = -r; dy <= r && nearEntrance < 2; dy++) {
          for (let dx = -r; dx <= r && nearEntrance < 2; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = zone.entrance.x + dx;
            const ty = zone.entrance.y + dy;
            if (!canPlaceSpooky(tx, ty)) continue;
            addSpookyChar(tx, ty, zone, zoneCode);
            nearEntrance++;
            zoneCount++;
          }
        }
      }
    }

    // 5b. Spread spooky skeletons, phantoms & pumpkin ghouls across every graveyard shape!
    const cellStep = width >= 200 ? 10 : 7;
    for (const rect of zone.shapes || []) {
      const minX = Math.max(2, Math.floor(rect.minX));
      const maxX = Math.min(width - 3, Math.floor(rect.maxX));
      const minY = Math.max(2, Math.floor(rect.minY));
      const maxY = Math.min(height - 3, Math.floor(rect.maxY));
      for (let cy0 = minY; cy0 <= maxY && zoneCount < maxPerZone; cy0 += cellStep) {
        for (let cx0 = minX; cx0 <= maxX && zoneCount < maxPerZone; cx0 += cellStep) {
          const cellW = Math.min(cellStep, maxX - cx0 + 1);
          const cellH = Math.min(cellStep, maxY - cy0 + 1);
          const seedX = cx0 + (hash2(cx0, cy0, 613) % Math.max(1, cellW));
          const seedY = cy0 + (hash2(cx0, cy0, 641) % Math.max(1, cellH));
          let placed = false;
          for (let r = 0; r <= 5 && !placed; r++) {
            for (let dy = -r; dy <= r && !placed; dy++) {
              for (let dx = -r; dx <= r && !placed; dx++) {
                if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                const tx = seedX + dx;
                const ty = seedY + dy;
                if (tx < minX || tx > maxX || ty < minY || ty > maxY) continue;
                if (!canPlaceSpooky(tx, ty)) continue;
                addSpookyChar(tx, ty, zone, zoneCode);
                placed = true;
                zoneCount++;
              }
            }
          }
        }
      }
    }

    // 5c. Guarantee at least 3 spooky characters in every graveyard zone!
    if (zoneCount < 3) {
      for (const rect of zone.shapes || []) {
        for (let ty = Math.max(2, Math.floor(rect.minY)); ty <= Math.min(height - 3, Math.floor(rect.maxY)) && zoneCount < 3; ty += 2) {
          for (let tx = Math.max(2, Math.floor(rect.minX)); tx <= Math.min(width - 3, Math.floor(rect.maxX)) && zoneCount < 3; tx += 2) {
            if (!canPlaceSpooky(tx, ty)) continue;
            addSpookyChar(tx, ty, zone, zoneCode);
            zoneCount++;
          }
        }
      }
    }
  });

  return {
    turkeys,
    squirrels,
    cats,
    dogs,
    critters,
    protestors,
    mobs,
    spookyChars,
    joggers: buildSidewalkJoggers(worldMap, spawnTile),
    graveyardGrid: effectiveGraveGrid,
    isNewton: neighborhoodMeta.isNewton,
    cityShort: neighborhoodMeta.cityShort,
  };
}

/**
 * Spawn friendly 32-bit Newton Sidewalk Joggers cruising along sidewalks and Commonwealth Avenue's
 * grassy Carriage Lane Mall (non-hostile neighbors who wave as they jog past!).
 */
function buildSidewalkJoggers(worldMap, spawnTile = null) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  const tileSize = worldMap.tileSize || 16;
  const home = spawnTile || worldMap.origin?.spawnTile || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const subgrid = getNavigationSubgrid(worldMap);
  const useSub = Boolean(subgrid && subgrid.hasVectorRoads);
  const isClearOffVectorRoad = (tx, ty) => {
    if (!useSub) return true;
    const px = tx * tileSize + tileSize * 0.5;
    const py = ty * tileSize + tileSize * 0.5;
    if (subgrid.isRoadAtPx(px, py)) return false;
    const sx = Math.floor(px / subgrid.subCellSize);
    const sy = Math.floor(py / subgrid.subCellSize);
    return !subgrid.isSolidAtSub(sx, sy);
  };

  const joggers = [];
  const used = new Set();
  const isJogPxAt = (jx, jy) => {
    if (useSub) {
      const sx = Math.floor(jx / subgrid.subCellSize);
      const sy = Math.floor(jy / subgrid.subCellSize);
      if (sx < 8 || sy < 8 || sx >= subgrid.subW - 8 || sy >= subgrid.subH - 8) return false;
      if (subgrid.isSolidAtSub(sx, sy)) return false;
      const t = subgrid.getSurfaceIdAtSub(sx, sy);
      return t === 1 || t === 11 || t === 9;
    }
    const tx = Math.floor(jx / tileSize);
    const ty = Math.floor(jy / tileSize);
    if (tx < 3 || ty < 3 || tx >= width - 3 || ty >= height - 3) return false;
    const idx = ty * width + tx;
    if (collision && collision[idx] === 1) return false;
    const t = base[idx];
    return t === 1 || t === 11 || t === 9;
  };
  const isJogTile = (tx, ty) => {
    if (tx < 3 || ty < 3 || tx >= width - 3 || ty >= height - 3) return false;
    const idx = ty * width + tx;
    if (collision && collision[idx] === 1) return false;
    const t = base[idx];
    if (!(t === 1 || t === 11 || t === 9)) return false;
    return isJogPxAt(tx * tileSize + tileSize * 0.5, ty * tileSize + tileSize * 0.5);
  };

  const addJogger = (tx, ty) => {
    if (used.has(`${tx},${ty}`) || !isJogTile(tx, ty)) return false;
    const cx = tx * tileSize + tileSize / 2;
    const cy = ty * tileSize + tileSize / 2;
    const h = hash2(tx, ty, 617 + joggers.length);
    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ].filter(
      (d) =>
        isJogPxAt(cx + d.dx * 4, cy + d.dy * 4) &&
        isJogPxAt(cx + d.dx * 8, cy + d.dy * 8) &&
        isJogPxAt(cx + d.dx * 12, cy + d.dy * 12) &&
        isJogPxAt(cx + d.dx * 16, cy + d.dy * 16)
    );
    if (dirs.length === 0) return false;
    const d0 = dirs[h % dirs.length];
    const chantIdx = joggers.length % JOGGER_CHANTS.length;
    joggers.push({
      id: `jogger_${joggers.length}`,
      variant: joggers.length % 3,
      x: tx * tileSize + tileSize / 2,
      y: ty * tileSize + tileSize / 2,
      dx: d0.dx,
      dy: d0.dy,
      speed: 44 + (h % 11),
      facing: d0.dx < 0 ? "left" : "right",
      animTimer: (h % 10) * 0.25,
      bubbleTimer: 0,
      chantIndex: chantIdx,
      bubbleSprite: `bubble_jogger_${chantIdx}`,
      greetCooldown: 0,
      jostleCooldown: 0,
      sprintTimer: 0,
      reactTimer: 0,
      jostledBurstTimer: 0,
      annoying: true,
    });
    for (let oy = -4; oy <= 4; oy++) {
      for (let ox = -4; ox <= 4; ox++) used.add(`${tx + ox},${ty + oy}`);
    }
    return true;
  };

  // 1. Guarantee 2 joggers near Home Base so kids spot runners right away!
  let nearHome = 0;
  for (let r = 6; r <= 20 && nearHome < 2; r++) {
    for (let dy = -r; dy <= r && nearHome < 2; dy++) {
      for (let dx = -r; dx <= r && nearHome < 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (base[(home.y + dy) * width + (home.x + dx)] === 1 && addJogger(home.x + dx, home.y + dy)) {
          nearHome++;
        }
      }
    }
  }

  // 2. Extra runners along Commonwealth Avenue's Boston Marathon Carriage Lane corridor!
  if (width >= 200) {
    for (let tx = 18; tx < width - 18; tx += 36) {
      for (let ty = 78; ty <= 136; ty++) {
        if ((base[ty * width + tx] === 11 || base[ty * width + tx] === 1) && addJogger(tx, ty)) {
          break;
        }
      }
    }
  }

  // 3. Distribute joggers across all sectors of Newton
  const cell = width >= 200 ? 44 : 24;
  for (let cy0 = 8; cy0 < height - 8; cy0 += cell) {
    for (let cx0 = 8; cx0 < width - 8; cx0 += cell) {
      const sx = cx0 + (hash2(cx0, cy0, 919) % Math.min(cell, width - 8 - cx0));
      const sy = cy0 + (hash2(cx0, cy0, 937) % Math.min(cell, height - 8 - cy0));
      let placed = false;
      for (let r = 0; r <= 12 && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = sx + dx;
            const ty = sy + dy;
            if (tx >= 4 && ty >= 4 && tx < width - 4 && ty < height - 4 && base[ty * width + tx] === 1) {
              if (addJogger(tx, ty)) placed = true;
            }
          }
        }
      }
    }
  }
  return joggers;
}

/**
 * Check if a candidate player hitbox is physically blocked by an active (non-yielding)
 * sidewalk protestor. Never blocks if the player is ALREADY overlapping that protestor,
 * preventing any possibility of getting stuck.
 */
export function isBlockedByStreetLife(streetLife, px, py, hitbox, curPlayerX = null, curPlayerY = null) {
  if (!streetLife || !streetLife.protestors) return false;
  const halfW = (hitbox?.width || 10) / 2;
  const halfH = (hitbox?.height || 8) / 2;
  const pHalfW = 6;
  const pHalfH = 5;

  for (const pr of streetLife.protestors) {
    if (pr.yieldTimer > 0) continue;
    const hitNew =
      Math.abs(px - pr.x) < halfW + pHalfW &&
      Math.abs(py - pr.y) < halfH + pHalfH;
    if (!hitNew) continue;
    // Allow escaping if already overlapping
    if (curPlayerX !== null && curPlayerY !== null) {
      const wasAlreadyOverlapping =
        Math.abs(curPlayerX - pr.x) < halfW + pHalfW &&
        Math.abs(curPlayerY - pr.y) < halfH + pHalfH;
      if (wasAlreadyOverlapping) continue;
    }
    return true;
  }
  return false;
}

/**
 * Find the closest interactive protestor, turkey, critter, or spooky character for Space / E interaction.
 * Skips protestors who already received a snack (yieldTimer > 0) and uses a generous reach for hungry marchers.
 */
export function findNearbyStreetLife(streetLife, px, py, maxDistPx = 28) {
  if (!streetLife) return null;
  let best = null;
  const protestorMaxDist = Math.max(maxDistPx, 34);
  for (const pr of streetLife.protestors || []) {
    if (pr.yieldTimer > 0) continue;
    const d = Math.hypot(px - pr.x, py - pr.y);
    if (d <= protestorMaxDist && (!best || d < best.dist)) {
      best = { kind: "protestor", target: pr, dist: d };
    }
  }
  for (const tk of streetLife.turkeys || []) {
    const d = Math.hypot(px - tk.x, py - tk.y);
    if (d <= maxDistPx && (!best || d < best.dist)) {
      best = { kind: "turkey", target: tk, dist: d };
    }
  }
  for (const cr of streetLife.critters || []) {
    const d = Math.hypot(px - cr.x, py - cr.y);
    if (d <= maxDistPx && (!best || d < best.dist)) {
      best = { kind: cr.kind, target: cr, dist: d };
    }
  }
  for (const sp of streetLife.spookyChars || []) {
    if ((sp.defeatedTimer || 0) > 0) continue;
    const d = Math.hypot(px - sp.x, py - sp.y);
    if (d <= maxDistPx && (!best || d < best.dist)) {
      best = { kind: "spooky", target: sp, dist: d };
    }
  }
  return best;
}

/**
 * Find the closest hungry (non-yielding) protestor/marcher within generous snack-sharing reach
 * for the dedicated physical Give Snack (N) button & hotkey.
 */
export function findNearbyHungryProtestor(streetLife, px, py, maxDistPx = 44) {
  if (!streetLife) return null;
  let best = null;
  for (const pr of streetLife.protestors || []) {
    if (pr.yieldTimer > 0) continue;
    const d = Math.hypot(px - pr.x, py - pr.y);
    if (d <= maxDistPx && (!best || d < best.dist)) {
      best = { kind: "protestor", target: pr, dist: d };
    }
  }
  return best;
}

/**
 * Find the closest snackable neighbor OR wild animal (protestor, turkey, squirrel, cat, or leash-dog)
 * within generous snack-tossing / feeding reach for the physical Feed/Snack (N) button & hotkey!
 */
export function findNearbySnackTarget(streetLife, px, py, maxDistPx = 72) {
  if (!streetLife) return null;
  const nearPr = findNearbyHungryProtestor(streetLife, px, py, Math.min(48, maxDistPx));
  let best = nearPr;
  for (const tk of streetLife.turkeys || []) {
    if (tk.fleeTimer > 0 || (tk.munchTimer || 0) > 0 || (tk.fedTimer || 0) > 0) continue;
    const d = Math.hypot(px - tk.x, py - tk.y);
    if (d <= maxDistPx && (!best || d < best.dist)) {
      best = { kind: "turkey", target: tk, dist: d };
    }
  }
  for (const cr of streetLife.critters || []) {
    if (cr.fleeTimer > 0 || (cr.munchTimer || 0) > 0 || (cr.fedTimer || 0) > 0) continue;
    const d = Math.hypot(px - cr.x, py - cr.y);
    if (d <= maxDistPx && (!best || d < best.dist)) {
      best = { kind: cr.kind, target: cr, dist: d };
    }
  }
  return best;
}

/**
 * Feed a wild neighborhood animal (turkey, squirrel, cat, or runaway dog) with a Snack OR a Lucky Acorn!
 * The animal pauses happily to munch the treat with hearts/crumbs, then trots away peacefully for a long
 * calm period instead of chasing Liam!
 */
export function tossSnackAtAnimal(entry, playerX, playerY, options = {}) {
  if (!entry || !entry.target) return null;
  const kind = entry.kind;
  if (kind !== "turkey" && kind !== "squirrel" && kind !== "cat" && kind !== "dog") return null;
  const {
    hasSnack = false,
    consumeSnack = null,
    hasAcorn = false,
    consumeAcorn = null,
    isEasyMode = false,
  } = options || {};
  const canUseSnack = Boolean(isEasyMode || hasSnack);
  const canUseAcorn = Boolean(!canUseSnack && hasAcorn);
  if (!canUseSnack && !canUseAcorn) {
    return {
      kind,
      tossed: false,
      fed: false,
      needsSnack: true,
      toast: "🥨 Out of snacks & acorns! Grab snacks at Home Base Kitchen, Mom, J.P. Licks, or Rosenfeld's — or find Lucky Acorns in tall grass!",
    };
  }
  const usedFood = canUseSnack ? "snack" : "acorn";
  if (!isEasyMode) {
    if (usedFood === "snack" && typeof consumeSnack === "function") {
      consumeSnack();
    } else if (usedFood === "acorn" && typeof consumeAcorn === "function") {
      consumeAcorn();
    }
  }
  const target = entry.target;
  const dx = target.x - playerX;
  const dy = target.y - playerY;
  const len = Math.hypot(dx, dy) || 1;
  const trotSpeed = kind === "dog" ? 56 : kind === "squirrel" ? 54 : 46;
  target.vx = (dx / len) * trotSpeed;
  target.vy = (dy / len) * trotSpeed;
  target.facing = target.vx >= 0 ? "right" : "left";
  target.munchTimer = 0.95;
  target.fedTimer = 20.0;
  target.fleeTimer = 16.0;
  target.fedBy = usedFood;
  if (kind === "turkey") {
    target.puffedTimer = 0;
    target.gobbleBubbleTimer = 3.2;
    target.bubbleSprite = "bubble_animal_yum";
  } else {
    target.alertTimer = 0;
    target.bubbleTimer = 3.2;
    target.bubbleSprite = "bubble_animal_yum";
  }
  const foodIcon = usedFood === "acorn" ? "🌰" : "🥨";
  const foodWord = usedFood === "acorn" ? "crunchy Lucky Acorn" : "tasty snack";
  const toasts = {
    turkey: `${foodIcon} Fed the wild turkey a ${foodWord}! It happily gobbled it up and waddled off peacefully! (+5 XP)`,
    squirrel: `${foodIcon} Fed the wild squirrel a ${foodWord}! It stuffed its cheeks and scampered up a tree! (+5 XP)`,
    cat: `${foodIcon} Fed the prowling cat a ${foodWord}! It purred loudly and trotted happily away! (+5 XP)`,
    dog: `${foodIcon} Fed the runaway dog a ${foodWord}! It wagged its tail and bounded happily home! (+5 XP)`,
  };
  return {
    kind,
    tossed: true,
    fed: true,
    foodKind: usedFood,
    xpReward: 5,
    targetX: target.x,
    targetY: target.y,
    toast: toasts[kind] || `${foodIcon} Fed the wild animal! It happily munched it and wandered off peacefully! (+5 XP)`,
  };
}

/**
 * Share a snack with peaceful sidewalk marchers/protestors (making them cheer happily and step aside!),
 * shoo a bold turkey (making it gobble & dash away with feathers!), or startle a spooky graveyard character.
 */
export function interactWithStreetLife(streetLife, entry, playerX, playerY, options = {}) {
  if (!entry || !entry.target) return null;
  if (entry.kind === "protestor") {
    const pr = entry.target;
    const { hasSnack = false, consumeSnack = null, isEasyMode = false } = options || {};
    const canShareSnack = Boolean(isEasyMode || hasSnack);

    if (canShareSnack) {
      if (!isEasyMode && typeof consumeSnack === "function") {
        consumeSnack();
      }
      const stepAside = (member) => {
        member.yieldTimer = 26.0;
        member.cheerTimer = 1.5;
        member.pushTimer = 0;
        member.bubbleSprite = "bubble_snack_thanks";
        member.bubbleTimer = 3.2;
        const dx = member.x - playerX;
        const dy = member.y - playerY;
        if (member.axis === "h") {
          member.yieldOffsetY = dy >= 0 ? 12 : -12;
          member.yieldOffsetX = 0;
        } else {
          member.yieldOffsetX = dx >= 0 ? 12 : -12;
          member.yieldOffsetY = 0;
        }
      };

      if (pr.isMob && pr.mobId) {
        for (const peer of streetLife.protestors || []) {
          if (peer.mobId === pr.mobId) {
            stepAside(peer);
          }
        }
        return {
          kind: "protestor",
          isMob: true,
          sharedSnack: true,
          blocked: false,
          xpReward: 10,
          toast: '🥨 "YUM! THANK YOU, NEIGHBOR!" The marching group cheered for snacks and happily cleared the sidewalk! (+10 XP)',
          sound: "snack_thanks",
        };
      }

      stepAside(pr);
      return {
        kind: "protestor",
        isMob: false,
        sharedSnack: true,
        blocked: false,
        xpReward: 5,
        toast: '🥨 "Ooh, a snack! Thank you, neighbor!" The marcher smiled and stepped aside! (+5 XP)',
        sound: "snack_thanks",
      };
    }

    // No snacks on hand — peaceful, friendly hint (never hostile, never hurts Liam!)
    pr.bubbleSprite = "bubble_want_snack";
    pr.bubbleTimer = 2.8;
    if (pr.isMob && pr.mobId) {
      for (const peer of streetLife.protestors || []) {
        if (peer.mobId === pr.mobId) {
          peer.bubbleSprite = peer.id === pr.id ? "bubble_want_snack" : `bubble_protest_${peer.chantIndex}`;
          peer.bubbleTimer = 2.6;
        }
      }
    }
    const snackHint =
      streetLife?.isNewton === false
        ? '🥨 "Marching makes us hungry! Grab snacks from your kitchen at Home Base or local shops & cafes!"'
        : '🥨 "Marching makes us hungry! Grab snacks from your kitchen at Home Base, J.P. Licks, or Rosenfeld\'s Bagels!"';
    return {
      kind: "protestor",
      isMob: Boolean(pr.isMob),
      sharedSnack: false,
      needsSnack: true,
      blocked: true,
      toast: snackHint,
      sound: "protestor",
    };
  }
  if (entry.kind === "turkey") {
    const tk = entry.target;
    const dx = tk.x - playerX;
    const dy = tk.y - playerY;
    const len = Math.hypot(dx, dy) || 1;
    tk.vx = (dx / len) * 58;
    tk.vy = (dy / len) * 58;
    tk.facing = tk.vx >= 0 ? "right" : "left";
    tk.fleeTimer = 2.6;
    tk.puffedTimer = 0.8;
    tk.hopTimer = 0.45;
    tk.gobbleBubbleTimer = 2.0;
    tk.shooedCount += 1;
    return {
      kind: "turkey",
      toast:
        streetLife?.isNewton === false
          ? "🦃 GOBBLE GOBBLE! The wild neighborhood turkey fluffed its feathers and bolted!"
          : "🦃 GOBBLE GOBBLE! The wild Newton turkey fluffed its feathers and bolted!",
      sound: "turkey",
    };
  }
  if (entry.kind === "squirrel" || entry.kind === "cat" || entry.kind === "dog") {
    const cr = entry.target;
    const arch = CRITTER_ARCHETYPES[entry.kind];
    const dx = cr.x - playerX;
    const dy = cr.y - playerY;
    const len = Math.hypot(dx, dy) || 1;
    const fleeSpd = arch?.fleeSpeed || 64;
    cr.vx = (dx / len) * fleeSpd;
    cr.vy = (dy / len) * fleeSpd;
    cr.facing = cr.vx >= 0 ? "right" : "left";
    cr.fleeTimer = 2.6;
    cr.alertTimer = 0.8;
    cr.hopTimer = 0.45;
    cr.bubbleTimer = 2.0;
    cr.shooedCount += 1;
    return {
      kind: entry.kind,
      toast: arch?.shooToast || "You shooed the critter away!",
      sound: arch?.sound || entry.kind,
    };
  }
  if (entry.kind === "spooky") {
    const sp = entry.target;
    const dx = sp.x - playerX;
    const dy = sp.y - playerY;
    const len = Math.hypot(dx, dy) || 1;
    sp.vx = (dx / len) * 44;
    sp.vy = (dy / len) * 44;
    sp.facing = sp.vx >= 0 ? "right" : "left";
    sp.spookTimer = 2.8;
    sp.attackTimer = 0;
    sp.bubbleTimer = 2.2;
    return {
      kind: "spooky",
      spookyKind: sp.kind,
      toast: sp.shooToast || "🔦 You startled the spooky graveyard character back!",
      sound: "spooky",
    };
  }
  return null;
}

/**
 * Detect direct physical contact with a wild turkey, active protestor, or spooky graveyard character/ghost,
 * returning a backward knockback & SNES damage-flash event (respecting brief hurtTimer invulnerability).
 */
export function checkStreetLifeContact(
  streetLife,
  playerState,
  { graveyardGhosts = null, elapsedTime = 0, tileSize = 16, hasLantern = false } = {}
) {
  if (!streetLife || !playerState) return null;
  if ((playerState.hurtTimer || 0) > 0) return null;

  const px = playerState.x;
  const py = playerState.y;
  const fallbackDir = () => {
    if (playerState.facing === "right") return { x: -1, y: 0 };
    if (playerState.facing === "left") return { x: 1, y: 0 };
    if (playerState.facing === "down") return { x: 0, y: -1 };
    return { x: 0, y: 1 };
  };

  for (const tk of streetLife.turkeys || []) {
    if (tk.fleeTimer > 0 || (tk.munchTimer || 0) > 0 || (tk.fedTimer || 0) > 0) continue;
    const dx = px - tk.x;
    const dy = py - tk.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14.5) {
      const fb = fallbackDir();
      const dirX = dist > 0.5 ? dx / dist : fb.x;
      const dirY = dist > 0.5 ? dy / dist : fb.y;
      return {
        kind: "turkey",
        isMob: false,
        source: tk,
        dirX,
        dirY,
        speed: 132,
        duration: 0.24,
        bubbleSprite: "bubble_ouch",
        toast:
          streetLife?.isNewton === false
            ? "💥 OUCH! A bold wild neighborhood turkey pecked & knocked you back!"
            : "💥 OUCH! A bold wild Newton turkey pecked & knocked you back!",
      };
    }
  }

  // Wild squirrels, prowling cats & runaway leash-trailing dogs act as nimble neighborhood enemies like turkeys!
  for (const cr of streetLife.critters || []) {
    if (cr.fleeTimer > 0 || (cr.munchTimer || 0) > 0 || (cr.fedTimer || 0) > 0) continue;
    const arch = CRITTER_ARCHETYPES[cr.kind];
    const dx = px - cr.x;
    const dy = py - cr.y;
    const dist = Math.hypot(dx, dy);
    if (dist < (arch?.hitRadius || 13.5)) {
      const fb = fallbackDir();
      const dirX = dist > 0.5 ? dx / dist : fb.x;
      const dirY = dist > 0.5 ? dy / dist : fb.y;
      return {
        kind: cr.kind,
        isMob: false,
        source: cr,
        dirX,
        dirY,
        speed: cr.kind === "dog" ? 142 : 128,
        duration: 0.24,
        bubbleSprite: "bubble_ouch",
        toast: arch?.hitToast || "💥 OUCH! A wild neighborhood critter bumped you and took 1 heart!",
      };
    }
  }

  // Peaceful neighborhood marchers/protestors NEVER hurt Liam or knock him back!
  // They simply block the sidewalk until you share a snack with them (or walk around).

  for (const sp of streetLife.spookyChars || []) {
    if ((sp.defeatedTimer || 0) > 0 || sp.spookTimer > 0) continue;
    // Carrying a glowing Lantern keeps ghosts & phantoms safely away from Liam!
    if (hasLantern && sp.kind === "phantom") continue;
    const dx = px - sp.x;
    const dy = py - sp.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14.5) {
      const fb = fallbackDir();
      const dirX = dist > 0.5 ? dx / dist : fb.x;
      const dirY = dist > 0.5 ? dy / dist : fb.y;
      return {
        kind: "spooky",
        spookyKind: sp.kind,
        isMob: false,
        source: sp,
        dirX,
        dirY,
        speed: 138,
        duration: 0.24,
        bubbleSprite: "bubble_eek",
        toast: sp.hitToast,
      };
    }
  }

  if (Array.isArray(graveyardGhosts) && !hasLantern) {
    for (const g of graveyardGhosts) {
      if ((g.defeatedTimer || 0) > 0) continue;
      const gp = getGraveyardGhostPos(g, elapsedTime, tileSize);
      const dx = px - (gp.cx + (g.repelX || 0));
      const dy = py - (gp.cy + (g.repelY || 0));
      const dist = Math.hypot(dx, dy);
      if (dist < 13.5) {
        const fb = fallbackDir();
        const dirX = dist > 0.5 ? dx / dist : fb.x;
        const dirY = dist > 0.5 ? dy / dist : fb.y;
        return {
          kind: "spooky",
          spookyKind: "ghost",
          isMob: false,
          source: g,
          dirX,
          dirY,
          speed: 134,
          duration: 0.24,
          bubbleSprite: "bubble_eek",
          toast: "👻 BOO! A floating graveyard ghost chilled you and took 1 heart!",
        };
      }
    }
  }

  return null;
}

/**
 * Advance roving wild turkeys, sidewalk protestors & spooky graveyard characters each frame.
 */
export function updateStreetLife(
  streetLife,
  dt,
  playerState,
  worldMap,
  {
    isFasterNow = false,
    hasLantern = false,
    tileSize = 16,
    graveyardGhosts = null,
    elapsedTime = 0,
    onTurkeyGobble = null,
    onCritterSound = null,
    onProtestorShout = null,
    onSpookyChime = null,
    onFeatherBurst = null,
    onPlayerBump = null,
    onJoggerAnnoy = null,
  } = {}
) {
  if (!streetLife) return;
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  const px = playerState.x;
  const py = playerState.y;
  const subgridUpdate = getNavigationSubgrid(worldMap);

  // --- 0. Check direct contact knockback & damage flash! ---
  const bump = checkStreetLifeContact(streetLife, playerState, {
    graveyardGhosts,
    elapsedTime,
    tileSize,
    hasLantern,
  });
  if (bump) {
    playerState.hurtTimer = 0.95;
    playerState.knockbackTimer = bump.duration;
    playerState.knockbackVx = bump.dirX * bump.speed;
    playerState.knockbackVy = bump.dirY * bump.speed;
    playerState.hurtShakeTimer = 0.24;
    playerState.ouchBubbleTimer = 0.95;
    playerState.ouchBubbleSprite = bump.bubbleSprite;
    playerState.maxHearts = playerState.maxHearts || 5;
    const curHearts = playerState.hearts ?? playerState.maxHearts;
    playerState.hearts = Math.max(0, curHearts - 1);
    playerState.lastBumpKind = bump.kind;

    if (bump.kind === "turkey") {
      const tk = bump.source;
      tk.puffedTimer = 1.2;
      tk.lungeTimer = 0.42;
      tk.gobbleBubbleTimer = 2.0;
      tk.vx = -bump.dirX * 36;
      tk.vy = -bump.dirY * 36;
      tk.fleeTimer = 1.2;
      onFeatherBurst?.(tk.x, tk.y);
      onTurkeyGobble?.(tk);
    } else if (bump.kind === "squirrel" || bump.kind === "cat" || bump.kind === "dog") {
      const cr = bump.source;
      cr.alertTimer = 1.2;
      cr.lungeTimer = 0.42;
      cr.bubbleTimer = 2.0;
      cr.vx = -bump.dirX * 42;
      cr.vy = -bump.dirY * 42;
      cr.fleeTimer = 1.3;
      onCritterSound?.(cr);
    } else if (bump.kind === "spooky") {
      const sp = bump.source;
      if (sp && typeof sp.spookTimer === "number") {
        sp.spookTimer = 1.4;
        sp.attackTimer = 0.58;
        sp.bubbleTimer = 2.2;
        sp.soundCooldown = 2.4;
        sp.vx = -bump.dirX * 32;
        sp.vy = -bump.dirY * 32;
      }
      onSpookyChime?.(sp);
    }
    onPlayerBump?.(bump);
  }

  // --- 1. Update Roving Wild Turkeys ---
  for (const tk of streetLife.turkeys) {
    const dist = Math.hypot(px - tk.x, py - tk.y);
    // Skip expensive updates for turkeys far across Newton (> 26 tiles away)
    if (dist > 420) continue;

    if ((tk.munchTimer || 0) > 0) tk.munchTimer = Math.max(0, tk.munchTimer - dt);
    if ((tk.fedTimer || 0) > 0) tk.fedTimer = Math.max(0, tk.fedTimer - dt);
    if ((tk.lungeTimer || 0) > 0) tk.lungeTimer = Math.max(0, tk.lungeTimer - dt);
    if ((tk.hopTimer || 0) > 0) tk.hopTimer = Math.max(0, tk.hopTimer - dt);
    const isMunching = (tk.munchTimer || 0) > 0;
    const isFed = (tk.fedTimer || 0) > 0;

    tk.animTimer += dt * (isMunching ? 12 : tk.fleeTimer > 0 ? 14 : 6.5);
    if (tk.puffedTimer > 0) tk.puffedTimer = Math.max(0, tk.puffedTimer - dt);
    if (tk.fleeTimer > 0 && !isMunching) tk.fleeTimer = Math.max(0, tk.fleeTimer - dt);
    if (tk.gobbleBubbleTimer > 0) tk.gobbleBubbleTimer = Math.max(0, tk.gobbleBubbleTimer - dt);
    if (tk.gobbleSoundCooldown > 0) tk.gobbleSoundCooldown = Math.max(0, tk.gobbleSoundCooldown - dt);

    if (isMunching) {
      // Happily pausing & munching the treat Liam tossed!
      tk.puffedTimer = 0;
      tk.gobbleBubbleTimer = Math.max(tk.gobbleBubbleTimer, 0.5);
      continue;
    }

    if (tk.fleeTimer <= 0 && !isFed) {
      if (dist < 48) {
        // Bold Newton Turkey spots Liam! Puff up tail fan and gobble!
        tk.puffedTimer = Math.max(tk.puffedTimer, 0.9);
        if (tk.gobbleSoundCooldown <= 0) {
          tk.bubbleSprite = "bubble_gobble";
          tk.gobbleBubbleTimer = 1.9;
          tk.gobbleSoundCooldown = 3.8;
          onTurkeyGobble?.(tk);
        }
        if (isFasterNow && dist < 38) {
          // Scooter startles the turkey into fleeing with feathers!
          const len = dist || 1;
          tk.vx = ((tk.x - px) / len) * 60;
          tk.vy = ((tk.y - py) / len) * 60;
          tk.fleeTimer = 2.0;
          tk.hopTimer = 0.42;
          onFeatherBurst?.(tk.x, tk.y);
        } else if (dist < 15) {
          // Direct bump! Gobble loudly and flutter out of the way so Liam never gets stuck
          const len = dist || 1;
          tk.vx = ((tk.x - px) / len) * 52;
          tk.vy = ((tk.y - py) / len) * 52;
          tk.fleeTimer = 1.6;
          tk.gobbleBubbleTimer = 1.8;
          onFeatherBurst?.(tk.x, tk.y);
          if (tk.gobbleSoundCooldown <= 2.4) {
            tk.gobbleSoundCooldown = 3.2;
            onTurkeyGobble?.(tk);
          }
        } else {
          // Cheeky strut slightly toward Liam's path!
          const len = dist || 1;
          tk.vx = ((px - tk.x) / len) * 14;
          tk.vy = ((py - tk.y) / len) * 14;
        }
      } else {
        // Casual neighborhood roving strut (stays loosely within ~10 tiles of home neighborhood)
        tk.dirTimer -= dt;
        if (tk.dirTimer <= 0) {
          const homeDist = Math.hypot(tk.homeX - tk.x, tk.homeY - tk.y);
          let angle;
          if (homeDist > 160) {
            angle = Math.atan2(tk.homeY - tk.y, tk.homeX - tk.x) + (Math.random() - 0.5) * 0.7;
          } else {
            angle = Math.random() * Math.PI * 2;
          }
          const spd = 13 + Math.random() * 10;
          tk.vx = Math.cos(angle) * spd;
          tk.vy = Math.sin(angle) * spd;
          tk.dirTimer = 1.8 + Math.random() * 2.4;
        }
      }
    } else if (isFed && tk.fleeTimer <= 0) {
      // Happily full & peaceful — casually wanders away without bothering Liam
      tk.dirTimer -= dt;
      if (tk.dirTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        tk.vx = Math.cos(angle) * 14;
        tk.vy = Math.sin(angle) * 14;
        tk.dirTimer = 1.8 + Math.random() * 2.0;
      }
    }

    const nx = tk.x + tk.vx * dt;
    const ny = tk.y + tk.vy * dt;
    const ntx = Math.floor(nx / tileSize);
    const nty = Math.floor(ny / tileSize);
    const turkeySubOk = (() => {
      if (!subgridUpdate || !subgridUpdate.hasVectorRoads) return true;
      const s = subgridUpdate.getSurfaceIdAtPx(nx, ny);
      if (s === 12 || s === 13 || s === 3) return false;
      return !subgridUpdate.isSolidAtSub(Math.floor(nx / subgridUpdate.subCellSize), Math.floor(ny / subgridUpdate.subCellSize));
    })();
    if (isTurkeyTile(base, collision, width, height, ntx, nty) && turkeySubOk) {
      tk.x = nx;
      tk.y = ny;
    } else {
      // Bounce cleanly off walls/water/highways
      tk.vx = -tk.vx;
      tk.vy = -tk.vy;
      tk.dirTimer = 0.4;
    }
    if (Math.abs(tk.vx) > 1.5) {
      tk.facing = tk.vx >= 0 ? "right" : "left";
    }
  }

  // --- 1b. Update Wild Squirrels, Prowling Cats & Runaway Dogs (with trailing leashes!) ---
  for (const cr of streetLife.critters || []) {
    const dist = Math.hypot(px - cr.x, py - cr.y);
    if (dist > 420) continue;

    if ((cr.munchTimer || 0) > 0) cr.munchTimer = Math.max(0, cr.munchTimer - dt);
    if ((cr.fedTimer || 0) > 0) cr.fedTimer = Math.max(0, cr.fedTimer - dt);
    if ((cr.lungeTimer || 0) > 0) cr.lungeTimer = Math.max(0, cr.lungeTimer - dt);
    if ((cr.hopTimer || 0) > 0) cr.hopTimer = Math.max(0, cr.hopTimer - dt);
    const isMunching = (cr.munchTimer || 0) > 0;
    const isFed = (cr.fedTimer || 0) > 0;

    const arch = CRITTER_ARCHETYPES[cr.kind];
    cr.animTimer += dt * (isMunching ? 12 : cr.fleeTimer > 0 ? 15 : cr.kind === "dog" ? 10 : 8.5);
    if (cr.alertTimer > 0) cr.alertTimer = Math.max(0, cr.alertTimer - dt);
    if (cr.fleeTimer > 0 && !isMunching) cr.fleeTimer = Math.max(0, cr.fleeTimer - dt);
    if (cr.bubbleTimer > 0) cr.bubbleTimer = Math.max(0, cr.bubbleTimer - dt);
    if (cr.soundCooldown > 0) cr.soundCooldown = Math.max(0, cr.soundCooldown - dt);

    if (isMunching) {
      cr.alertTimer = 0;
      cr.bubbleTimer = Math.max(cr.bubbleTimer, 0.5);
      continue;
    }

    if (cr.fleeTimer <= 0 && !isFed) {
      const detectRadius = cr.kind === "dog" ? 64 : 50;
      if (dist < detectRadius) {
        cr.alertTimer = Math.max(cr.alertTimer, 0.85);
        if (cr.soundCooldown <= 0) {
          cr.bubbleSprite = arch?.bubble || cr.bubbleSprite;
          cr.bubbleTimer = 1.9;
          cr.soundCooldown = 3.8;
          onCritterSound?.(cr);
        }
        if (isFasterNow && dist < 38) {
          const len = dist || 1;
          const fSpd = arch?.fleeSpeed || 64;
          cr.vx = ((cr.x - px) / len) * fSpd;
          cr.vy = ((cr.y - py) / len) * fSpd;
          cr.fleeTimer = 2.0;
          cr.hopTimer = 0.42;
        } else {
          // Dart/prowl/bound toward Liam's path just like bold Newton turkeys!
          const len = dist || 1;
          const cSpd = arch?.chaseSpeed || 20;
          cr.vx = ((px - cr.x) / len) * cSpd;
          cr.vy = ((py - cr.y) / len) * cSpd;
        }
      } else {
        cr.dirTimer -= dt;
        if (cr.dirTimer <= 0) {
          const homeDist = Math.hypot(cr.homeX - cr.x, cr.homeY - cr.y);
          let angle;
          if (homeDist > 165) {
            angle = Math.atan2(cr.homeY - cr.y, cr.homeX - cr.x) + (Math.random() - 0.5) * 0.7;
          } else {
            angle = Math.random() * Math.PI * 2;
          }
          const baseSpd = arch?.roamSpeed || 18;
          const spd = baseSpd * (0.8 + Math.random() * 0.4);
          cr.vx = Math.cos(angle) * spd;
          cr.vy = Math.sin(angle) * spd;
          cr.dirTimer = 1.4 + Math.random() * 2.2;
        }
      }
    } else if (isFed && cr.fleeTimer <= 0) {
      cr.dirTimer -= dt;
      if (cr.dirTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const baseSpd = (arch?.roamSpeed || 18) * 0.85;
        cr.vx = Math.cos(angle) * baseSpd;
        cr.vy = Math.sin(angle) * baseSpd;
        cr.dirTimer = 1.6 + Math.random() * 2.0;
      }
    }

    const nx = cr.x + cr.vx * dt;
    const ny = cr.y + cr.vy * dt;
    const ntx = Math.floor(nx / tileSize);
    const nty = Math.floor(ny / tileSize);
    const critterSubOk = (() => {
      if (!subgridUpdate || !subgridUpdate.hasVectorRoads) return true;
      const s = subgridUpdate.getSurfaceIdAtPx(nx, ny);
      if (s === 12 || s === 13 || s === 3) return false;
      return !subgridUpdate.isSolidAtSub(Math.floor(nx / subgridUpdate.subCellSize), Math.floor(ny / subgridUpdate.subCellSize));
    })();
    if (isTurkeyTile(base, collision, width, height, ntx, nty) && critterSubOk) {
      cr.x = nx;
      cr.y = ny;
    } else {
      cr.vx = -cr.vx;
      cr.vy = -cr.vy;
      cr.dirTimer = 0.4;
    }
    if (Math.abs(cr.vx) > 1.5) {
      cr.facing = cr.vx >= 0 ? "right" : "left";
    }
  }

  // --- 2. Update Annoying Sidewalk Protestors ---
  for (const pr of streetLife.protestors) {
    const dist = Math.hypot(px - pr.x, py - pr.y);
    if (dist > 420) continue;

    pr.animTimer += dt * ((pr.cheerTimer || 0) > 0 ? 11 : pr.bubbleTimer > 0 ? 7.5 : 4.2);
    if (pr.bubbleTimer > 0) pr.bubbleTimer = Math.max(0, pr.bubbleTimer - dt);
    if (pr.shoutSoundCooldown > 0) pr.shoutSoundCooldown = Math.max(0, pr.shoutSoundCooldown - dt);
    if ((pr.cheerTimer || 0) > 0) pr.cheerTimer = Math.max(0, pr.cheerTimer - dt);

    if (pr.yieldTimer > 0) {
      pr.yieldTimer = Math.max(0, pr.yieldTimer - dt);
      // Smoothly step slightly off the sidewalk centerline while yielding
      const targetX = pr.anchorX + pr.yieldOffsetX;
      const targetY = pr.anchorY + pr.yieldOffsetY;
      pr.x += (targetX - pr.x) * Math.min(1, dt * 6);
      pr.y += (targetY - pr.y) * Math.min(1, dt * 6);
      continue;
    }

    // Peaceful marchers simply hold their signs and gently hint for a snack when Liam walks right up!
    if (dist < 19) {
      pr.pushTimer += dt;
      if (pr.bubbleTimer <= 0.1) {
        pr.bubbleSprite = "bubble_want_snack";
        pr.bubbleTimer = 2.4;
      }
      if (pr.shoutSoundCooldown <= 0) {
        pr.shoutSoundCooldown = 3.0;
        onProtestorShout?.(pr);
      }
    } else {
      pr.pushTimer = Math.max(0, pr.pushTimer - dt * 2);
    }

    // Periodic friendly chanting when Liam is within earshot (~5 tiles = 80px)
    if (dist < 84) {
      pr.shoutTimer -= dt;
      if (pr.shoutTimer <= 0) {
        pr.chantIndex = (pr.chantIndex + 1) % PROTEST_CHANTS.length;
        pr.chantText = PROTEST_CHANTS[pr.chantIndex];
        pr.bubbleSprite = `bubble_protest_${pr.chantIndex}`;
        pr.bubbleTimer = 2.6;
        pr.shoutTimer = 3.8 + Math.random() * 2.2;
        if (pr.shoutSoundCooldown <= 0) {
          pr.shoutSoundCooldown = 3.5;
          onProtestorShout?.(pr);
        }
      }
    }

    // Peaceful back-and-forth sidewalk marching patrol (no aggressive intercepting!)
    const paceSpeed = pr.isMob ? 8 : 14;
    if (pr.axis === "h") {
      pr.x += pr.dir * paceSpeed * dt;
      pr.y += (pr.anchorY - pr.y) * Math.min(1, dt * 4);
      if (pr.x >= pr.maxPx) {
        pr.x = pr.maxPx;
        pr.dir = -1;
      } else if (pr.x <= pr.minPx) {
        pr.x = pr.minPx;
        pr.dir = 1;
      }
      pr.facing = pr.dir >= 0 ? "right" : "left";
    } else {
      pr.y += pr.dir * paceSpeed * dt;
      pr.x += (pr.anchorX - pr.x) * Math.min(1, dt * 4);
      if (pr.y >= pr.maxPx) {
        pr.y = pr.maxPx;
        pr.dir = -1;
      } else if (pr.y <= pr.minPx) {
        pr.y = pr.minPx;
        pr.dir = 1;
      }
      pr.facing = pr.dir >= 0 ? "right" : "left";
    }
  }

  // --- 3. Update Spooky Graveyard Characters & Floating Ghosts (Lantern repels ghosts cleanly!) ---
  const graveGrid = streetLife.graveyardGrid;
  if (Array.isArray(graveyardGhosts)) {
    for (const g of graveyardGhosts) {
      if ((g.defeatedTimer || 0) > 0) {
        g.defeatedTimer = Math.max(0, g.defeatedTimer - dt);
      }
      const gp = getGraveyardGhostPos(g, elapsedTime, tileSize);
      const gx = gp.cx + (g.repelX || 0);
      const gy = gp.cy + (g.repelY || 0);
      const distG = Math.hypot(gx - px, gy - py);
      if (hasLantern && distG < 64) {
        // Lantern light actively pushes floating ghosts back to a safe halo distance!
        const len = distG || 1;
        const push = (64 - distG) * Math.min(1, dt * 7);
        g.repelX = Math.max(-48, Math.min(48, (g.repelX || 0) + ((gx - px) / len) * push));
        g.repelY = Math.max(-48, Math.min(48, (g.repelY || 0) + ((gy - py) / len) * push));
        g.lanternScaredTimer = 1.4;
      } else {
        // Gently drift back toward original orbit once Liam walks away
        g.repelX = (g.repelX || 0) * Math.max(0, 1 - dt * 1.8);
        g.repelY = (g.repelY || 0) * Math.max(0, 1 - dt * 1.8);
        if ((g.lanternScaredTimer || 0) > 0) g.lanternScaredTimer = Math.max(0, g.lanternScaredTimer - dt);
      }
    }
  }
  for (const sp of streetLife.spookyChars || []) {
    if ((sp.defeatedTimer || 0) > 0) {
      sp.defeatedTimer = Math.max(0, sp.defeatedTimer - dt);
      if (sp.defeatedTimer <= 0) {
        sp.x = sp.homeX;
        sp.y = sp.homeY;
        sp.spookTimer = 0;
        sp.attackTimer = 0;
        sp.respawnAnimTimer = 0.7;
        sp.chasing = false;
      }
      continue;
    }
    const dist = Math.hypot(px - sp.x, py - sp.y);
    if (dist > 420) continue;

    sp.animTimer += dt * (sp.spookTimer > 0 ? 10 : sp.chasing ? 7.5 : 4.8);
    if (sp.spookTimer > 0) sp.spookTimer = Math.max(0, sp.spookTimer - dt);
    if ((sp.attackTimer || 0) > 0) sp.attackTimer = Math.max(0, sp.attackTimer - dt);
    if ((sp.respawnAnimTimer || 0) > 0) sp.respawnAnimTimer = Math.max(0, sp.respawnAnimTimer - dt);
    if (sp.bubbleTimer > 0) sp.bubbleTimer = Math.max(0, sp.bubbleTimer - dt);
    if (sp.soundCooldown > 0) sp.soundCooldown = Math.max(0, sp.soundCooldown - dt);

    if (hasLantern && sp.kind === "phantom" && dist < 74) {
      // Glowing Lantern light scares Graveyard Phantoms away — they stay back and shout "TOO BRIGHT!!"
      const len = dist || 1;
      sp.chasing = false;
      sp.attackTimer = 0;
      sp.vx = ((sp.x - px) / len) * 44;
      sp.vy = ((sp.y - py) / len) * 44;
      sp.bubbleSprite = "bubble_too_bright";
      sp.bubbleTimer = 1.6;
      if (sp.soundCooldown <= 0) {
        sp.soundCooldown = 4.0;
        onSpookyChime?.(sp);
      }
    } else if (sp.spookTimer <= 0) {
      if (dist < 88) {
        // Spooky graveyard character spots Liam and drifts/stalks toward him inside the graveyard!
        sp.chasing = true;
        if (dist < 34) {
          sp.attackTimer = Math.max(sp.attackTimer || 0, 0.25);
        }
        if (sp.soundCooldown <= 0) {
          sp.bubbleTimer = 2.1;
          sp.soundCooldown = 4.2;
          onSpookyChime?.(sp);
        }
        const len = dist || 1;
        const spd = sp.speed || 24;
        sp.vx = ((px - sp.x) / len) * spd;
        sp.vy = ((py - sp.y) / len) * spd;
      } else {
        sp.chasing = false;
        sp.dirTimer -= dt;
        if (sp.dirTimer <= 0) {
          const homeDist = Math.hypot(sp.homeX - sp.x, sp.homeY - sp.y);
          let angle;
          if (homeDist > 72) {
            angle = Math.atan2(sp.homeY - sp.y, sp.homeX - sp.x) + (Math.random() - 0.5) * 0.6;
          } else {
            angle = Math.random() * Math.PI * 2;
          }
          const spd = 13 + Math.random() * 7;
          sp.vx = Math.cos(angle) * spd;
          sp.vy = Math.sin(angle) * spd;
          sp.dirTimer = 1.6 + Math.random() * 2.0;
        }
      }
    }

    const nx = sp.x + sp.vx * dt;
    const ny = sp.y + sp.vy * dt;
    const ntx = Math.floor(nx / tileSize);
    const nty = Math.floor(ny / tileSize);
    const curTx = Math.floor(sp.x / tileSize);
    const curTy = Math.floor(sp.y / tileSize);

    if (isSpookyGraveyardTile(base, collision, graveGrid, width, height, ntx, nty, sp.zoneCode)) {
      sp.x = nx;
      sp.y = ny;
    } else if (isSpookyGraveyardTile(base, collision, graveGrid, width, height, ntx, curTy, sp.zoneCode)) {
      sp.x = nx;
      sp.vy = -sp.vy * 0.5;
    } else if (isSpookyGraveyardTile(base, collision, graveGrid, width, height, curTx, nty, sp.zoneCode)) {
      sp.y = ny;
      sp.vx = -sp.vx * 0.5;
    } else {
      // Bounce gently back inward toward home inside the graveyard!
      const toHomeAng = Math.atan2(sp.homeY - sp.y, sp.homeX - sp.x);
      sp.vx = Math.cos(toHomeAng) * 16;
      sp.vy = Math.sin(toHomeAng) * 16;
      sp.dirTimer = 0.6;
    }
    if (Math.abs(sp.vx) > 1.5) {
      sp.facing = sp.vx >= 0 ? "right" : "left";
    }
  }

  // --- 4. Update Over-Competitive Annoying Newton Marathon Runners (stay on sidewalks & Comm Ave mall — NEVER deal heart damage!) ---
  const subgrid = getNavigationSubgrid(worldMap);
  const useSubJog = Boolean(subgrid && subgrid.hasVectorRoads);
  const isJogPx = (jx, jy) => {
    if (useSubJog) {
      const sx = Math.floor(jx / subgrid.subCellSize);
      const sy = Math.floor(jy / subgrid.subCellSize);
      if (sx < 8 || sy < 8 || sx >= subgrid.subW - 8 || sy >= subgrid.subH - 8) return false;
      if (subgrid.isSolidAtSub(sx, sy)) return false;
      const t = subgrid.getSurfaceIdAtSub(sx, sy);
      return t === 1 || t === 4 || t === 11 || t === 9;
    }
    const tx = Math.floor(jx / tileSize);
    const ty = Math.floor(jy / tileSize);
    if (tx < 2 || ty < 2 || tx >= width - 2 || ty >= height - 2) return false;
    const idx = ty * width + tx;
    if (collision && collision[idx] === 1) return false;
    const t = base[idx];
    return t === 1 || t === 4 || t === 11 || t === 9;
  };
  for (const jg of streetLife.joggers || []) {
    const dist = Math.hypot(px - jg.x, py - jg.y);
    if (dist > 440) continue;
    if (jg.bubbleTimer > 0) jg.bubbleTimer = Math.max(0, jg.bubbleTimer - dt);
    if (jg.greetCooldown > 0) jg.greetCooldown = Math.max(0, jg.greetCooldown - dt);
    if ((jg.jostleCooldown || 0) > 0) jg.jostleCooldown = Math.max(0, jg.jostleCooldown - dt);
    if ((jg.sprintTimer || 0) > 0) jg.sprintTimer = Math.max(0, jg.sprintTimer - dt);
    if ((jg.reactTimer || 0) > 0) jg.reactTimer = Math.max(0, jg.reactTimer - dt);
    if ((jg.jostledBurstTimer || 0) > 0) jg.jostledBurstTimer = Math.max(0, jg.jostledBurstTimer - dt);

    // Annoying runners surge into a dramatic Strava-PR sprint & yell when closing in on Liam!
    if (dist < 76) {
      jg.sprintTimer = Math.max(jg.sprintTimer || 0, 0.55);
    }
    // If Liam scoots past fast right beside a runner, the runner does a startled hop ("WHOA! NICE PACE!")
    if (isFasterNow && dist < 34 && (jg.reactTimer || 0) <= 0 && jg.greetCooldown <= 1.2) {
      jg.reactTimer = 0.65;
      jg.sprintTimer = Math.max(jg.sprintTimer || 0, 1.1);
      jg.bubbleSprite = "bubble_jogger_whoa";
      jg.bubbleTimer = 2.1;
      jg.greetCooldown = 3.2;
      onJoggerAnnoy?.(jg, false);
    }
    const sprinting = (jg.sprintTimer || 0) > 0;
    jg.animTimer += dt * (sprinting ? 17 : 13.5);

    if (dist < 62 && jg.greetCooldown <= 0) {
      jg.chantIndex = ((jg.chantIndex ?? 0) + 1) % JOGGER_CHANTS.length;
      jg.bubbleSprite = `bubble_jogger_${jg.chantIndex}`;
      jg.bubbleTimer = 2.6;
      jg.greetCooldown = 4.2;
      onJoggerAnnoy?.(jg, false);
    }

    // Comedic shoulder-zoom jostle if an obnoxious marathoner blasts right past Liam (strictly 0 heart damage!)
    if (dist < 15 && (jg.jostleCooldown || 0) <= 0) {
      jg.jostleCooldown = 4.0;
      jg.jostledBurstTimer = 0.7;
      jg.chantIndex = ((jg.chantIndex ?? 0) + 1) % JOGGER_CHANTS.length;
      jg.bubbleSprite = `bubble_jogger_${jg.chantIndex}`;
      jg.bubbleTimer = 2.8;
      jg.greetCooldown = Math.max(jg.greetCooldown, 3.0);
      onJoggerAnnoy?.(jg, true);
    }

    const curSpeed = jg.speed * (sprinting ? 1.25 : 1.0);
    const nx = jg.x + jg.dx * curSpeed * dt;
    const ny = jg.y + jg.dy * curSpeed * dt;
    if (isJogPx(nx + jg.dx * 5, ny + jg.dy * 5)) {
      jg.x = nx;
      jg.y = ny;
    } else {
      // Pick a clean continuing sidewalk turn (prefer turning 90°, else reverse)
      const stepProbe = useSubJog ? 8 : tileSize;
      const turns = [
        { dx: -jg.dy, dy: jg.dx },
        { dx: jg.dy, dy: -jg.dx },
        { dx: -jg.dx, dy: -jg.dy },
      ].filter((d) => isJogPx(jg.x + d.dx * stepProbe, jg.y + d.dy * stepProbe));
      if (turns.length > 0) {
        const chosen = turns[Math.floor(jg.animTimer) % turns.length];
        jg.dx = chosen.dx;
        jg.dy = chosen.dy;
      } else {
        jg.dx = -jg.dx;
        jg.dy = -jg.dy;
      }
    }
    if (jg.dx !== 0) jg.facing = jg.dx > 0 ? "right" : "left";
  }
}

/**
 * Swing the Explorer's Graveyard Sword (earned at the Salzberg House!) in Liam's facing arc
 * to defeat nearby graveyard enemies AND startle wild animals (turkeys, squirrels, cats, dogs)
 * so they bolt away harmlessly!
 */
export function performSwordAttack(
  streetLife,
  playerState,
  { graveyardGhosts = null, elapsedTime = 0, tileSize = 16, reachPx = 38 } = {}
) {
  if (!streetLife || !playerState) return { hitCount: 0, defeated: [], scaredAnimals: [], toast: "" };
  const px = playerState.x;
  const py = playerState.y;
  const fx =
    playerState.facing === "right" ? 1 : playerState.facing === "left" ? -1 : 0;
  const fy =
    playerState.facing === "down" ? 1 : playerState.facing === "up" ? -1 : 0;
  // Sword arc center sits slightly in front of Liam while still catching very close foes
  const arcX = px + fx * 14;
  const arcY = py + fy * 14;

  const defeated = [];
  const scaredAnimals = [];
  for (const sp of streetLife.spookyChars || []) {
    if ((sp.defeatedTimer || 0) > 0) continue;
    const dArc = Math.hypot(sp.x - arcX, sp.y - arcY);
    const dSelf = Math.hypot(sp.x - px, sp.y - py);
    if (dArc <= reachPx || dSelf <= 24) {
      sp.defeatedTimer = 18;
      sp.spookTimer = 0;
      sp.attackTimer = 0;
      sp.chasing = false;
      defeated.push({ kind: "spooky", spookyKind: sp.kind, name: sp.name, x: sp.x, y: sp.y });
    }
  }
  if (Array.isArray(graveyardGhosts)) {
    for (const g of graveyardGhosts) {
      if ((g.defeatedTimer || 0) > 0) continue;
      const gp = getGraveyardGhostPos(g, elapsedTime, tileSize);
      const dArc = Math.hypot(gp.cx - arcX, gp.cy - arcY);
      const dSelf = Math.hypot(gp.cx - px, gp.cy - py);
      if (dArc <= reachPx || dSelf <= 24) {
        g.defeatedTimer = 18;
        defeated.push({ kind: "ghost", spookyKind: "ghost", name: "Graveyard Ghost", x: gp.cx, y: gp.cy });
      }
    }
  }

  // Swinging the sword also harmlessly startles wild turkeys, squirrels, cats & dogs into bolting away!
  const animalReach = Math.max(reachPx + 8, 46);
  for (const tk of streetLife.turkeys || []) {
    const dArc = Math.hypot(tk.x - arcX, tk.y - arcY);
    const dSelf = Math.hypot(tk.x - px, tk.y - py);
    if (dArc <= animalReach || dSelf <= 30) {
      const dx = tk.x - px;
      const dy = tk.y - py;
      const len = Math.hypot(dx, dy) || 1;
      tk.vx = (dx / len) * 74;
      tk.vy = (dy / len) * 74;
      tk.facing = tk.vx >= 0 ? "right" : "left";
      tk.fleeTimer = 5.5;
      tk.puffedTimer = 0.8;
      tk.hopTimer = 0.48;
      tk.gobbleBubbleTimer = 2.0;
      tk.bubbleSprite = "bubble_gobble";
      scaredAnimals.push({ kind: "turkey", x: tk.x, y: tk.y });
    }
  }
  for (const cr of streetLife.critters || []) {
    const dArc = Math.hypot(cr.x - arcX, cr.y - arcY);
    const dSelf = Math.hypot(cr.x - px, cr.y - py);
    if (dArc <= animalReach || dSelf <= 30) {
      const dx = cr.x - px;
      const dy = cr.y - py;
      const len = Math.hypot(dx, dy) || 1;
      cr.vx = (dx / len) * 78;
      cr.vy = (dy / len) * 78;
      cr.facing = cr.vx >= 0 ? "right" : "left";
      cr.fleeTimer = 5.5;
      cr.alertTimer = 0.9;
      cr.hopTimer = 0.48;
      cr.bubbleTimer = 2.0;
      scaredAnimals.push({ kind: cr.kind, x: cr.x, y: cr.y });
    }
  }

  // Harmlessly startle nearby marathon joggers into a funny hop & sprint reaction!
  for (const jg of streetLife.joggers || []) {
    if (Math.hypot(jg.x - arcX, jg.y - arcY) <= animalReach + 6) {
      jg.reactTimer = 0.65;
      jg.sprintTimer = Math.max(jg.sprintTimer || 0, 1.2);
      jg.bubbleSprite = "bubble_jogger_whoa";
      jg.bubbleTimer = 2.0;
    }
  }

  const totalHits = defeated.length + scaredAnimals.length;
  let toast = "";
  if (defeated.length > 0 && scaredAnimals.length > 0) {
    toast = `⚔️ SWISH! Defeated ${defeated.length} graveyard foes & shooed ${scaredAnimals.length} wild critters!`;
  } else if (defeated.length > 0) {
    toast = `⚔️ SWISH! Defeated ${defeated.length} graveyard ${defeated.length === 1 ? "enemy" : "enemies"}! (+${defeated.length * 10} XP)`;
  } else if (scaredAnimals.length > 0) {
    toast = `⚔️ SWISH! Your sword flourish startled ${scaredAnimals.length} wild ${scaredAnimals.length === 1 ? "animal" : "animals"} into running away! (+${scaredAnimals.length * 5} XP)`;
  }

  return {
    hitCount: totalHits,
    defeatedCount: defeated.length,
    defeated,
    scaredAnimals,
    toast,
  };
}

/**
 * Raise the Pocket Siddur (earned at Beth El, Shaarei Tefillah, Temple Emanuel, or Chabad!)
 * to shine a peaceful golden-blue blessing aura that dispels graveyard enemies, ghosts,
 * stubborn protestors (even mobs!), and bold wild turkeys!
 */
export function performSiddurDispel(
  streetLife,
  playerState,
  { graveyardGhosts = null, elapsedTime = 0, tileSize = 16, radiusPx = 68 } = {}
) {
  if (!streetLife || !playerState) {
    return { dispelledCount: 0, dispelledSpooky: 0, dispelledProtestors: 0, dispelledTurkeys: 0, positions: [], toast: "" };
  }
  const px = playerState.x;
  const py = playerState.y;
  let dispelledSpooky = 0;
  let dispelledProtestors = 0;
  let dispelledTurkeys = 0;
  const positions = [];

  for (const sp of streetLife.spookyChars || []) {
    if ((sp.defeatedTimer || 0) > 0) continue;
    if (Math.hypot(sp.x - px, sp.y - py) <= radiusPx) {
      sp.defeatedTimer = 22;
      sp.attackTimer = 0;
      sp.chasing = false;
      dispelledSpooky++;
      positions.push({ x: sp.x, y: sp.y, kind: "spooky", spookyKind: sp.kind });
    }
  }

  if (Array.isArray(graveyardGhosts)) {
    for (const g of graveyardGhosts) {
      if ((g.defeatedTimer || 0) > 0) continue;
      const gp = getGraveyardGhostPos(g, elapsedTime, tileSize);
      if (Math.hypot(gp.cx - px, gp.cy - py) <= radiusPx) {
        g.defeatedTimer = 22;
        dispelledSpooky++;
        positions.push({ x: gp.cx, y: gp.cy, kind: "ghost", spookyKind: "ghost" });
      }
    }
  }

  // Peaceful neighborhood marchers/protestors are friendly neighbors (not foes to dispel — share a snack with them instead!)

  for (const tk of streetLife.turkeys || []) {
    if (tk.fleeTimer > 0) continue;
    const dx = tk.x - px;
    const dy = tk.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist <= radiusPx) {
      const len = dist || 1;
      tk.vx = (dx / len) * 62;
      tk.vy = (dy / len) * 62;
      tk.facing = tk.vx >= 0 ? "right" : "left";
      tk.fleeTimer = 3.5;
      tk.puffedTimer = 0.6;
      tk.hopTimer = 0.45;
      dispelledTurkeys++;
      positions.push({ x: tk.x, y: tk.y, kind: "turkey" });
    }
  }

  for (const cr of streetLife.critters || []) {
    if (cr.fleeTimer > 0) continue;
    const dx = cr.x - px;
    const dy = cr.y - py;
    const dist = Math.hypot(dx, dy);
    if (dist <= radiusPx) {
      const len = dist || 1;
      cr.vx = (dx / len) * 66;
      cr.vy = (dy / len) * 66;
      cr.facing = cr.vx >= 0 ? "right" : "left";
      cr.fleeTimer = 3.5;
      cr.alertTimer = 0.6;
      cr.hopTimer = 0.45;
      dispelledTurkeys++;
      positions.push({ x: cr.x, y: cr.y, kind: cr.kind });
    }
  }

  const dispelledCount = dispelledSpooky + dispelledTurkeys;
  return {
    dispelledCount,
    dispelledSpooky,
    dispelledProtestors: 0,
    dispelledTurkeys,
    positions,
    toast:
      dispelledCount > 0
        ? `📖 Shalom! Your Pocket Siddur peacefully calmed ${dispelledCount} spooky ${dispelledCount === 1 ? "foe" : "foes"} in a wave of light!`
        : "📖 Shalom! A warm golden blessing shimmered around you!",
  };
}
