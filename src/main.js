import { createRenderer } from "./renderer.js";
import {
  TILE_SIZE,
  PLAYER_SPEED_PX,
  DEFAULT_HITBOX,
  createMapCollider,
  moveWithCollision,
} from "./player.js";
import {
  createSafetySystem,
  findNearestBuilding,
  LOOK_DURATION_SEC,
  SAFE_CROSSING_DURATION_SEC,
} from "./safety.js";
import {
  createQuestSystem,
  getItemMeta,
} from "./quests.js";
import { createStreetSignSystem, normalizeStreetKey } from "./streetsigns.js";
import { createPaperMapRenderer } from "./papermap.js";
import { createUI } from "./ui.js";
import {
  isMuted,
  toggleMute,
  playStreetBannerChime,
  playLookBothWaysChime,
  playStepTick,
  playGrassRustle,
  playCoinPickup,
  playBoostWhoosh,
  playItemFanfare,
  playTextBlip,
  playLandmarkDiscover,
  playCurbStopBoop,
  playSpookyChime,
  playSpookyBooSfx,
  playSignpostReadChime,
  playTurkeyGobble,
  playProtestorShout,
  playBumpHurtSfx,
} from "./audio.js";
import {
  buildSnesSpriteAtlas,
  bakeSnesBuildingCanvas,
  bake32BitHouseStack,
  bakeParkFieldCanvas,
  normalizeAddress,
} from "./tileset.js";
import { buildParkFeatures, buildWoodlandTreeGrid } from "./parks.js";
import { buildGraveyardFeatures, getGraveyardGhostPos } from "./graveyards.js";
import {
  buildStreetLife,
  updateStreetLife,
  isBlockedByStreetLife,
  findNearbyStreetLife,
  interactWithStreetLife,
} from "./streetlife.js";

const VIEW_W = 320;
const VIEW_H = 180;
const CHUNK_TILES = 16;
const HOUSE_COLORS_STORAGE_KEY = "neighborhood_explorer_house_colors_v1";

/**
 * Spatial chunk index for O(1) viewport culling & nearest-house lookups
 * even on large 512x512 neighborhood maps with thousands of real houses.
 */
function buildBuildingSpatialIndex(buildings) {
  const chunks = new Map();
  for (const b of buildings) {
    if (!b.bounds) continue;
    const minCx = Math.floor(b.bounds.minX / CHUNK_TILES);
    const maxCx = Math.floor(b.bounds.maxX / CHUNK_TILES);
    const minCy = Math.floor(b.bounds.minY / CHUNK_TILES);
    const maxCy = Math.floor(b.bounds.maxY / CHUNK_TILES);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx},${cy}`;
        let list = chunks.get(key);
        if (!list) {
          list = [];
          chunks.set(key, list);
        }
        list.push(b);
      }
    }
  }

  function queryBounds(minX, minY, maxX, maxY) {
    const minCx = Math.floor(minX / CHUNK_TILES);
    const maxCx = Math.floor(maxX / CHUNK_TILES);
    const minCy = Math.floor(minY / CHUNK_TILES);
    const maxCy = Math.floor(maxY / CHUNK_TILES);
    const seen = new Set();
    const out = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = chunks.get(`${cx},${cy}`);
        if (!list) continue;
        for (const b of list) {
          if (seen.has(b.id)) continue;
          seen.add(b.id);
          out.push(b);
        }
      }
    }
    return out;
  }

  return { queryBounds };
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  }
  return res.json();
}

function isRoadTile(id) {
  return id === 2 || id === 3 || id === 4 || id === 12 || id === 13;
}

function isGreenGround(id) {
  return id === 0 || id === 7 || id === 11;
}

/**
 * Deterministic placement of 32-bit Golden-Hour Autumn trees, crunchy leaf piles,
 * vintage glowing street lamps, boxwood garden shrubs, benches, reeds, hydrants, and parked cars.
 */
function buildNeighborhoodProps(worldMap, parkOccupiedGrid = null, graveyardGrid = null) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  // 0 = none, 1 = autumn oak/maple tree, 2 = evergreen pine (dense canopies in truly wooded areas!)
  const treeGrid = buildWoodlandTreeGrid(worldMap, parkOccupiedGrid, graveyardGrid);
  const hydrants = [];
  const parkedCars = [];
  const parkBenches = [];
  const shoreReeds = [];
  const leafPiles = [];
  const leafPileMap = new Map();
  const streetLamps = [];
  const gardenShrubs = [];
  const lampBlockUsed = new Set();
  const carSprites = ["car_red", "car_sage", "car_blue"];

  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const idx = ty * width + tx;
      const cur = base[idx];
      if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) continue;

      if (cur === 8 && base[(ty - 1) * width + tx] !== 8 && base[(ty + 1) * width + tx] === 8) {
        const h = ((tx * 37 + ty * 91) >>> 0) % 5;
        if (h === 0 || h === 2) {
          parkedCars.push({ tx, ty, sprite: carSprites[(tx + ty) % carSprites.length] });
        }
      }

      // Park benches neatly placed on park turf bordering a sidewalk or dirt path
      if (cur === 11 && treeGrid[idx] === 0) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        if ((s === 1 || s === 9 || n === 1 || n === 9) && ((tx * 29 + ty * 43) % 19 === 0)) {
          parkBenches.push({ tx, ty });
        }
      }

      // Lakeside cattail reeds on sandy/grassy pond edges
      if (cur === 10 || cur === 0) {
        const nearWater =
          base[(ty - 1) * width + tx] === 6 ||
          base[(ty + 1) * width + tx] === 6 ||
          base[ty * width + (tx - 1)] === 6 ||
          base[ty * width + (tx + 1)] === 6;
        if (nearWater && ((tx * 53 + ty * 17) % 13 === 0)) {
          shoreReeds.push({ tx, ty });
        }
      }

      // Green boxwood garden shrubs tucked beside houses & lawns for lush autumn contrast
      if (cur === 0 && treeGrid[idx] === 0 && (!graveyardGrid || graveyardGrid[idx] === 0)) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        const w = base[ty * width + (tx - 1)];
        const e = base[ty * width + (tx + 1)];
        const nearHouse = n === 5 || s === 5 || w === 5 || e === 5;
        if (nearHouse && (((tx * 23 + ty * 47) >>> 0) % 5 === 0)) {
          gardenShrubs.push({ tx, ty });
        }
      }

      // Crunchy autumn leaf piles along road curbs & sidewalks!
      if ((cur === 2 || cur === 3) && (!graveyardGrid || graveyardGrid[idx] === 0)) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        const w = base[ty * width + (tx - 1)];
        const e = base[ty * width + (tx + 1)];
        const touchesSidewalk = n === 1 || s === 1 || w === 1 || e === 1;
        if (touchesSidewalk && (((tx * 59 + ty * 37) >>> 0) % 17 === 0)) {
          const pile = { tx, ty, variant: (tx + ty) & 1, lastScatter: -99 };
          leafPiles.push(pile);
          leafPileMap.set(`${tx},${ty}`, pile);
        }
      }

      if (cur === 1) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        const w = base[ty * width + (tx - 1)];
        const e = base[ty * width + (tx + 1)];
        const nearCrosswalk = n === 4 || s === 4 || w === 4 || e === 4;
        const nearRoad = isRoadTile(n) || isRoadTile(s) || isRoadTile(w) || isRoadTile(e);
        let placedHydrant = false;

        if (nearCrosswalk) {
          if (((tx * 31 + ty * 17) & 15) === 0) {
            hydrants.push({ tx, ty });
            placedHydrant = true;
          }
        } else if (
          (isRoadTile(s) || isRoadTile(n)) &&
          (isRoadTile(e) || isRoadTile(w))
        ) {
          if ((tx * 19 + ty * 37) % 11 === 0) {
            hydrants.push({ tx, ty });
            placedHydrant = true;
          }
        }

        // Vintage curved-arm street lamps spaced cleanly along corners & road-bordering sidewalks
        if (!placedHydrant && nearRoad) {
          const blockKey = `${Math.floor(tx / 7)},${Math.floor(ty / 7)}`;
          if (
            !lampBlockUsed.has(blockKey) &&
            (nearCrosswalk || ((tx * 17 + ty * 29) >>> 0) % 11 === 0)
          ) {
            lampBlockUsed.add(blockKey);
            streetLamps.push({ tx, ty });
          } else if ((((tx * 41 + ty * 29) >>> 0) % 13 === 0) && (!graveyardGrid || graveyardGrid[idx] === 0)) {
            const pile = { tx, ty, variant: (tx + ty) & 1, lastScatter: -99 };
            leafPiles.push(pile);
            leafPileMap.set(`${tx},${ty}`, pile);
          }
        }
      }
    }
  }

  return {
    treeGrid,
    hydrants,
    parkedCars,
    parkBenches,
    shoreReeds,
    leafPiles,
    leafPileMap,
    streetLamps,
    gardenShrubs,
  };
}

async function boot() {
  const [worldMap, landmarks, quests, baseHouseColors] = await Promise.all([
    loadJson("./data/world_map.json"),
    loadJson("./data/landmarks.json").catch(() => []),
    loadJson("./data/quests.json").catch(() => []),
    loadJson("./data/house_colors.json").catch(() => ({})),
  ]);

  // Merge data/house_colors.json with any live localStorage paints from iPad scouting
  const rawColorEntries = {};
  for (const [key, val] of Object.entries(baseHouseColors || {})) {
    if (key.startsWith("_") || !val || typeof val !== "object") continue;
    rawColorEntries[key] = { ...val };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(HOUSE_COLORS_STORAGE_KEY) || "{}");
    for (const [key, val] of Object.entries(saved)) {
      if (val && typeof val === "object") rawColorEntries[key] = { ...val };
    }
  } catch {
    // Ignore storage errors in private tabs
  }

  const normalizedColorMap = {};
  function rebuildNormalizedColorMap() {
    for (const key of Object.keys(normalizedColorMap)) delete normalizedColorMap[key];
    for (const [key, val] of Object.entries(rawColorEntries)) {
      const norm = normalizeAddress(key);
      if (norm) normalizedColorMap[norm] = val;
      normalizedColorMap[key] = val;
    }
  }
  rebuildNormalizedColorMap();

  function persistLocalColors() {
    try {
      localStorage.setItem(HOUSE_COLORS_STORAGE_KEY, JSON.stringify(rawColorEntries));
    } catch {
      // ignore
    }
  }

  const tileSize = worldMap.tileSize || TILE_SIZE;
  const mapW = worldMap.dimensions.width;
  const mapH = worldMap.dimensions.height;
  const baseLayer = worldMap.layers.base;
  const collisionLayer = worldMap.layers.collision;
  const buildings = worldMap.buildings || [];

  const collider = createMapCollider(worldMap);
  const safety = createSafetySystem(worldMap);
  const questSystem = createQuestSystem({
    landmarks,
    quests,
    worldMap,
    storage: typeof localStorage !== "undefined" ? localStorage : null,
  });
  const paperMap = createPaperMapRenderer(worldMap);
  const graveyardFeatures = buildGraveyardFeatures(worldMap);
  const parkFeatures = buildParkFeatures(worldMap, graveyardFeatures.graveyardGrid);
  const combinedOccupied = new Uint8Array(mapW * mapH);
  for (let i = 0; i < combinedOccupied.length; i++) {
    if (parkFeatures.occupiedGrid[i] === 1 || graveyardFeatures.occupiedGrid[i] === 1) {
      combinedOccupied[i] = 1;
    }
  }
  const {
    treeGrid,
    hydrants,
    parkedCars,
    parkBenches,
    shoreReeds,
    leafPiles,
    leafPileMap,
    streetLamps,
    gardenShrubs,
  } = buildNeighborhoodProps(
    worldMap,
    combinedOccupied,
    graveyardFeatures.graveyardGrid
  );
  const streetSignSystem = createStreetSignSystem(worldMap, {
    parkOccupiedGrid: combinedOccupied,
    landmarks: questSystem.landmarks,
  });
  const streetLife = buildStreetLife(worldMap, {
    parkOccupiedGrid: combinedOccupied,
    graveyardGrid: graveyardFeatures.graveyardGrid,
    graveyardZones: graveyardFeatures.zones,
    spawnTile: worldMap.origin?.spawnTile,
    landmarks: questSystem.landmarks,
  });
  const buildingIndex = buildBuildingSpatialIndex(buildings);
  let lastGraveyardId = "";

  const bakedFieldCache = new Map();
  function getBakedField(field) {
    let canvas = bakedFieldCache.get(field.id);
    if (!canvas) {
      canvas = bakeParkFieldCanvas(field, tileSize * 2);
      canvas.__pixelScale = 0.5;
      bakedFieldCache.set(field.id, canvas);
    }
    return canvas;
  }

  const hasPerAddressBuildings = buildings.length > 0;

  const bakedHouseCache = new Map();
  const bakedStackCache = new Map();
  let paintRevision = 1;
  function getBakedHouse(building) {
    let entry = bakedHouseCache.get(building.id);
    if (!entry) {
      const baked = bakeSnesBuildingCanvas(building, tileSize * 2, normalizedColorMap);
      baked.canvas.__pixelScale = 0.5;
      entry = {
        canvas: baked.canvas,
        offsetX: baked.offsetX / 2,
        offsetY: baked.offsetY / 2,
        version: paintRevision,
      };
      bakedHouseCache.set(building.id, entry);
    }
    return entry;
  }
  function getBakedHouseStack(building) {
    let entry = bakedStackCache.get(building.id);
    if (!entry) {
      const stack = bake32BitHouseStack(building, tileSize, normalizedColorMap);
      entry = { ...stack, version: paintRevision };
      bakedStackCache.set(building.id, entry);
    }
    return entry;
  }
  function invalidateHouseSprite(building) {
    paintRevision++;
    bakedHouseCache.delete(building.id);
    bakedStackCache.delete(building.id);
  }

  const spawnTile = worldMap.origin?.spawnTile || {
    x: Math.floor(mapW / 2),
    y: Math.floor(mapH / 2),
  };

  // Reveal initial Home Base area on the Folded Paper Map
  questSystem.revealFogAtTile(spawnTile.x, spawnTile.y, 2);

  const playerState = {
    x: spawnTile.x * tileSize + tileSize / 2,
    y: spawnTile.y * tileSize + tileSize / 2,
    facing: "down",
    headingDeg: 0,
    targetHeadingDeg: 0,
    turnHoldDir: 0,
    turnRepeatTimer: 0,
    moving: false,
    walkTimer: 0,
    stepSoundCooldown: 0,
    lookTimer: 0,
    lookSavedFacing: "down",
    safeCrossingTimer: 0,
    hasEnteredRoadSinceLook: false,
    curbStopCueTimer: 0,
    curbStopToastCooldown: 0,
    lastLookAwardTileKey: "",
    lastLookAwardTime: -99,
    lastGrassTileKey: "",
    lastFogTileKey: "",
    wasFasterActive: false,
    elapsedTime: 0,
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hurtShakeTimer: 0,
    ouchBubbleTimer: 0,
    ouchBubbleSprite: "bubble_ouch",
    hearts: 3,
    maxHearts: 3,
    heartRefillTimer: 0,
    lastBumpKind: "",
  };

  // Overhead Item Fanfare queue & active timer
  const fanfareQueue = [];
  let activeFanfare = null; // { itemMeta, sourceLabel, timer }

  const dustPuffs = [];
  const leafParticles = [];
  const groundDrops = [];
  let dustCooldown = 0;
  let leafTrailCooldown = 0;

  let showDebug = false;
  let lastStreetName = "";
  let pocketDirections = null;
  let activeChalkArrow = null; // { tx, ty, dx, dy, timer }

  function refreshPocketDirections(fromX, fromY, fromLabel = "Home Base") {
    const target = questSystem.getActiveObjectiveTarget();
    if (!target) {
      pocketDirections = null;
      return null;
    }
    const shortDest = target.label.replace(/\s*\(.*\)/, "");
    const route = streetSignSystem.computeDirections(fromX, fromY, target.tileX, target.tileY, shortDest);
    pocketDirections = {
      ...route,
      fromLabel,
      toLabel: shortDest,
      targetKey: `${target.tileX},${target.tileY}`,
    };
    return pocketDirections;
  }

  // Initialize Pocket Directions from last checked sign (if saved) or Home Base!
  const initialSavedSign = questSystem.state.lastCheckedSignId
    ? streetSignSystem.getSignById(questSystem.state.lastCheckedSignId)
    : null;
  if (initialSavedSign) {
    refreshPocketDirections(initialSavedSign.tx, initialSavedSign.ty, initialSavedSign.label);
  } else {
    refreshPocketDirections(spawnTile.x, spawnTile.y, "Home Base");
  }

  function findCombinedInteraction(tx, ty) {
    const questNear = questSystem.findNearbyInteraction(tx, ty);
    const signNear = streetSignSystem.findNearbySign(tx, ty, 2.6);
    if (questNear && signNear) {
      // Favor NPCs/chests slightly if standing right next to both
      if (questNear.dist <= signNear.dist + 0.5) return questNear;
      return {
        kind: "sign",
        target: signNear.sign,
        dist: signNear.dist,
        alreadyChecked: questSystem.state.checkedSigns.has(signNear.sign.id),
      };
    }
    if (questNear) return questNear;
    if (signNear) {
      return {
        kind: "sign",
        target: signNear.sign,
        dist: signNear.dist,
        alreadyChecked: questSystem.state.checkedSigns.has(signNear.sign.id),
      };
    }
    const streetNear = findNearbyStreetLife(streetLife, playerState.x, playerState.y, 26);
    if (streetNear) return streetNear;
    return null;
  }

  function resolveSignBanner(tx, ty, streetZone, activeGraveyard) {
    if (activeGraveyard) {
      return { title: `🪦 ${activeGraveyard.name}`, tag: "graveyard", unknown: false };
    }
    if (Math.hypot(tx - spawnTile.x, ty - spawnTile.y) <= 7) {
      return { title: "HOME BASE", tag: "565 Boylston St", unknown: false };
    }
    const lastSign = questSystem.state.lastCheckedSignId
      ? streetSignSystem.getSignById(questSystem.state.lastCheckedSignId)
      : null;
    if (lastSign) {
      const distToSign = Math.hypot(tx - lastSign.tx, ty - lastSign.ty);
      if (distToSign <= 6.5) {
        return { title: `🪧 ${lastSign.label}`, tag: "Checked Corner ✓", unknown: false };
      }
      const curStreetNorm = streetZone?.name ? normalizeStreetKey(streetZone.name) : "";
      if (curStreetNorm && lastSign.streetNorms.includes(curStreetNorm) && distToSign <= 26) {
        return {
          title: `🪧 ${streetZone.name}`,
          tag: `from ${lastSign.shortLabel}`,
          unknown: false,
        };
      }
    }
    return { title: "❓ UNKNOWN STREET", tag: "Check a Street Sign!", unknown: true };
  }

  const k = createRenderer({
    width: VIEW_W,
    height: VIEW_H,
    canvas: document.getElementById("game-canvas"),
    background: [62, 42, 36],
  });

  const atlas = buildSnesSpriteAtlas("autumn_golden");
  await k.registerSprites(atlas);

  function resetToHome() {
    playerState.x = spawnTile.x * tileSize + tileSize / 2;
    playerState.y = spawnTile.y * tileSize + tileSize / 2;
    playerState.facing = questSystem.state.navMode === "hard" ? "up" : "down";
    playerState.headingDeg = 0;
    playerState.targetHeadingDeg = 0;
    playerState.turnHoldDir = 0;
    playerState.turnRepeatTimer = 0;
    k.setCamRot(0);
    playerState.lookTimer = 0;
    playerState.safeCrossingTimer = 0;
    playerState.hasEnteredRoadSinceLook = false;
    playerState.curbStopCueTimer = 0;
  }

  let ui;

  function enqueueFanfare(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return;
    for (const item of entries) fanfareQueue.push(item);
    if (!activeFanfare) startNextFanfare();
  }

  function startNextFanfare() {
    if (fanfareQueue.length === 0) {
      activeFanfare = null;
      ui?.setFanfareBanner(null);
      return;
    }
    const next = fanfareQueue.shift();
    const itemMeta = getItemMeta(next.itemId);
    activeFanfare = {
      itemMeta,
      sourceLabel: next.sourceLabel || "",
      timer: 2.1,
    };
    playerState.facing = "down";
    playerState.moving = false;
    playItemFanfare();
    ui?.setFanfareBanner(itemMeta, next.sourceLabel);
  }

  function performLookBothWays() {
    if (ui?.isMapOpen() || ui?.isPaintOpen() || ui?.isDialogueOpen() || ui?.isSignOpen() || activeFanfare) return;
    if (playerState.lookTimer > 0) return;

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    const result = safety.inspectCrossingContext(tx, ty);

    playerState.lookSavedFacing = playerState.facing;
    playerState.lookTimer = LOOK_DURATION_SEC;
    playerState.curbStopCueTimer = 0;
    playerState.safeCrossingTimer = SAFE_CROSSING_DURATION_SEC;
    playerState.hasEnteredRoadSinceLook = safety.isBoxOnRoad(playerState.x, playerState.y, DEFAULT_HITBOX);

    const tileKey = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
    const canAwardXP =
      result.xpReward > 0 &&
      (tileKey !== playerState.lastLookAwardTileKey ||
        playerState.elapsedTime - playerState.lastLookAwardTime > 8);

    if (canAwardXP) {
      questSystem.state.safetyXP += result.xpReward;
      questSystem.save();
      playerState.lastLookAwardTileKey = tileKey;
      playerState.lastLookAwardTime = playerState.elapsedTime;
    }

    playLookBothWaysChime(canAwardXP);
    ui?.showSafetyToast(
      canAwardXP
        ? result.message
        : result.context !== "clear"
          ? "👀 Looked Both Ways — Safe to Cross!"
          : "👀 Looked Left & Right — All Clear!"
    );
  }

  function openStreetSign(sign) {
    if (!sign) return;
    const checkResult = questSystem.recordSignCheck(sign);
    playSignpostReadChime(checkResult.isNew);
    const route = refreshPocketDirections(sign.tx, sign.ty, sign.label);
    const activeTarget = questSystem.getActiveObjectiveTarget();
    const targetLabel = activeTarget ? activeTarget.label.replace(/\s*\(.*\)/, "") : null;
    const nearbyLandmarks = streetSignSystem.getNearbyLandmarksForSign(sign, 3);

    if (route && (route.firstDx || route.firstDy)) {
      activeChalkArrow = {
        tx: sign.tx,
        ty: sign.ty,
        dx: route.firstDx,
        dy: route.firstDy,
        timer: 4.5,
      };
    }

    ui?.openSignModal({
      sign,
      checkResult,
      directions: route,
      targetLabel,
      nearbyLandmarks,
    });
  }

  function triggerLookOrInteract() {
    if (ui?.isMapOpen() || ui?.isPaintOpen()) return;

    // Close active street-sign overlay cleanly on Space/Enter/E
    if (ui?.isSignOpen()) {
      ui.closeSignModal();
      return;
    }

    // Advance active dialogue if open
    if (ui?.isDialogueOpen()) {
      ui.advanceDialogue();
      return;
    }

    // Dismiss active fanfare early after 0.6s
    if (activeFanfare) {
      if (activeFanfare.timer < 1.5) startNextFanfare();
      return;
    }

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);

    // If the player just bumped an unchecked road curb, prioritize Look Both Ways immediately!
    if (playerState.curbStopCueTimer > 0) {
      performLookBothWays();
      return;
    }

    // 1. Check if standing right next to a Landmark NPC, Wooden Chest, Street Sign, Protestor, or Wild Turkey!
    const nearby = findCombinedInteraction(tx, ty);
    if (nearby) {
      if (nearby.kind === "sign") {
        openStreetSign(nearby.target);
        return;
      }
      if (nearby.kind === "protestor" || nearby.kind === "turkey" || nearby.kind === "spooky") {
        const res = interactWithStreetLife(streetLife, nearby, playerState.x, playerState.y);
        if (res) {
          if (res.sound === "turkey") {
            playTurkeyGobble();
            spawnFeatherBurst(nearby.target.x, nearby.target.y);
          } else if (res.sound === "protestor") {
            playProtestorShout();
          } else if (res.sound === "spooky") {
            playSpookyChime();
          }
          ui?.showSafetyToast(res.toast, 2600);
        }
        return;
      }
      const outcome =
        nearby.kind === "chest"
          ? questSystem.interactWithChest(nearby.target.id)
          : questSystem.interactWithNpc(nearby.target.id);
      if (outcome) {
        if (outcome.questEvent) {
          refreshPocketDirections(tx, ty, nearby.target.name?.replace(/\s*\(.*\)/, "") || "Here");
        }
        ui?.openDialogue({
          speaker: outcome.speaker,
          lines: outcome.lines,
          onComplete: () => {
            if (outcome.fanfareQueue.length > 0) {
              enqueueFanfare(outcome.fanfareQueue);
            }
          },
        });
        return;
      }
    }

    // 2. Otherwise perform Look Both Ways safety check!
    performLookBothWays();
  }

  function togglePaperMap() {
    if (ui?.isDialogueOpen() || ui?.isPaintOpen() || ui?.isSignOpen()) return;
    const nextOpen = !ui?.isMapOpen();
    ui?.setMapModalOpen(nextOpen, questSystem, pocketDirections);
    if (nextOpen) {
      const tx = Math.floor(playerState.x / tileSize);
      const ty = Math.floor(playerState.y / tileSize);
      paperMap.renderToCanvas(ui.getMapCanvas(), {
        questSystem,
        streetSignSystem,
        playerTileX: tx,
        playerTileY: ty,
        timeSec: playerState.elapsedTime,
        gpsAssist: questSystem.state.gpsAssist,
      });
    }
  }

  function cycleNavModeAction() {
    const mode = questSystem.cycleNavMode();
    if (mode === "hard") {
      playerState.facing = "up";
      playerState.targetHeadingDeg = Math.round(playerState.headingDeg / 45) * 45 % 360;
      playerState.headingDeg = playerState.targetHeadingDeg;
      playerState.turnHoldDir = 0;
      playerState.turnRepeatTimer = 0;
      ui?.showSafetyToast(
        "🔥 Hard Mode ON — Tap Left/Right to turn 45°! Use your Brass Compass to find North!",
        3000
      );
    } else if (mode === "gps") {
      playerState.headingDeg = 0;
      playerState.targetHeadingDeg = 0;
      k.setCamRot(0);
      ui?.showSafetyToast("📡 GPS Assist ON — Live radar, street banner & arrow enabled", 2400);
    } else {
      playerState.headingDeg = 0;
      playerState.targetHeadingDeg = 0;
      k.setCamRot(0);
      ui?.showSafetyToast("🧭 Signpost Mode ON — Read green street signs to navigate!", 2400);
    }
    if (ui?.isMapOpen()) {
      ui.refreshMapSidePanels(questSystem, pocketDirections);
    }
  }

  function toggleHeroOutfitMode() {
    const next = questSystem.toggleHeroOutfit();
    playCoinPickup();
    ui?.showSafetyToast(
      next === "baseball"
        ? "⚾ Play Ball! Liam put on his Little League Uniform!"
        : "👕 Liam switched to his Polo, Kippah & Tzitzit!",
      2200
    );
  }

  function openPaintForNearbyHouse() {
    if (ui?.isDialogueOpen() || ui?.isMapOpen()) return;
    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    const nearbyCandidates = buildingIndex.queryBounds(tx - 6, ty - 6, tx + 6, ty + 6);
    const nearest = findNearestBuilding(nearbyCandidates, tx, ty);
    if (!nearest || nearest.distTiles > 4.5) {
      ui?.showSafetyToast("Walk up to any house to paint its real colors!");
      return;
    }
    const b = nearest.building;
    const addrKey = b.address || b.id;
    const norm = normalizeAddress(addrKey);
    const existing = normalizedColorMap[norm] || normalizedColorMap[b.id] || {};

    ui?.openPaintModal(b, existing, {
      onPickWall: (building, presetKey) => {
        const key = building.address || building.id;
        rawColorEntries[key] = { ...(rawColorEntries[key] || {}), preset: presetKey };
        rebuildNormalizedColorMap();
        persistLocalColors();
        invalidateHouseSprite(building);
        playCoinPickup();
        return rawColorEntries[key];
      },
      onPickRoof: (building, roofKey) => {
        const key = building.address || building.id;
        rawColorEntries[key] = { ...(rawColorEntries[key] || {}), roof: roofKey };
        rebuildNormalizedColorMap();
        persistLocalColors();
        invalidateHouseSprite(building);
        playCoinPickup();
        return rawColorEntries[key];
      },
      onPickStyle: (building, styleKey, mode) => {
        const key = building.address || building.id;
        const next = { ...(rawColorEntries[key] || {}) };
        if (mode === "arch") {
          next.kind = "house";
          next.arch = styleKey;
        } else {
          next.kind = styleKey;
          delete next.arch;
        }
        rawColorEntries[key] = next;
        rebuildNormalizedColorMap();
        persistLocalColors();
        invalidateHouseSprite(building);
        playCoinPickup();
        return rawColorEntries[key];
      },
      onResetHouse: (building) => {
        const key = building.address || building.id;
        delete rawColorEntries[key];
        rebuildNormalizedColorMap();
        persistLocalColors();
        invalidateHouseSprite(building);
      },
      onExportJson: () => JSON.stringify(rawColorEntries, null, 2),
    });
  }

  ui = createUI({
    onToggleDebug: () => {
      showDebug = !showDebug;
      return showDebug;
    },
    onResetHome: resetToHome,
    onLookOrInteract: triggerLookOrInteract,
    onToggleMute: () => toggleMute(),
    onOpenPaint: openPaintForNearbyHouse,
    onToggleMap: togglePaperMap,
    onToggleGpsAssist: cycleNavModeAction,
    onToggleOutfit: toggleHeroOutfitMode,
    onSelectQuest: (questId) => {
      const chosen = questSystem.setActiveQuest(questId);
      if (!chosen) return;
      const lastSign = questSystem.state.lastCheckedSignId
        ? streetSignSystem.getSignById(questSystem.state.lastCheckedSignId)
        : null;
      if (lastSign) {
        refreshPocketDirections(lastSign.tx, lastSign.ty, lastSign.label);
      } else {
        refreshPocketDirections(spawnTile.x, spawnTile.y, "Home Base");
      }
      playCoinPickup();
      ui?.refreshMapSidePanels(questSystem, pocketDirections);
      ui?.showSafetyToast(`🎯 Active Mission: ${chosen.title}`, 2200);
    },
    onOpenMapFromSign: () => {
      const tx = Math.floor(playerState.x / tileSize);
      const ty = Math.floor(playerState.y / tileSize);
      ui?.setMapModalOpen(true, questSystem, pocketDirections);
      paperMap.renderToCanvas(ui.getMapCanvas(), {
        questSystem,
        streetSignSystem,
        playerTileX: tx,
        playerTileY: ty,
        timeSec: playerState.elapsedTime,
        gpsAssist: questSystem.state.gpsAssist,
      });
    },
    onCloseSign: () => {
      if (pocketDirections?.steps?.[0]) {
        ui?.showSafetyToast(`🧭 ${pocketDirections.steps[0].arrow} ${pocketDirections.steps[0].text}`, 2600);
      }
    },
    onResetProgress: () => {
      questSystem.resetProgress();
      questSystem.revealFogAtTile(spawnTile.x, spawnTile.y, 2);
      resetToHome();
      activeChalkArrow = null;
      refreshPocketDirections(spawnTile.x, spawnTile.y, "Home Base");
      ui?.refreshMapSidePanels(questSystem, pocketDirections);
      ui?.showSafetyToast("Adventure progress reset!");
    },
    onTextBlip: playTextBlip,
  });

  k.onKeyPress("c", () => {
    showDebug = !showDebug;
  });
  k.onKeyPress("g", cycleNavModeAction);
  k.onKeyPress("o", toggleHeroOutfitMode);
  k.onKeyPress("h", resetToHome);
  k.onKeyPress("m", togglePaperMap);
  k.onKeyPress("tab", togglePaperMap);
  k.onKeyPress("p", openPaintForNearbyHouse);
  k.onKeyPress("space", triggerLookOrInteract);
  k.onKeyPress("e", triggerLookOrInteract);
  k.onKeyPress("enter", triggerLookOrInteract);
  k.onKeyPress("l", performLookBothWays);

  function readInput() {
    let dx = 0;
    let dy = 0;

    if (k.isKeyDown("left") || k.isKeyDown("a")) dx -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dx += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dy -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dy += 1;

    const touch = ui.getTouchInput();
    if (dx === 0 && dy === 0) {
      dx = touch.x;
      dy = touch.y;
    }

    const wantsFaster =
      k.isKeyDown("shift") || k.isKeyDown("b") || ui.isFasterHeld();

    return { x: dx, y: dy, wantsFaster };
  }

  function findNearestLandmark(tx, ty) {
    let best = null;
    for (const lm of questSystem.landmarks) {
      const distTiles = Math.hypot(lm.walkTileX - tx, lm.walkTileY - ty);
      if (!best || distTiles < best.distTiles) {
        best = { landmark: lm, distTiles };
      }
    }
    return best;
  }

  const AUTUMN_LEAF_SHADES = [
    [194, 46, 36],
    [224, 88, 34],
    [245, 148, 42],
    [252, 204, 72],
  ];

  function spawnAutumnLeafBurst(wx, wy, count = 8, spread = 38) {
    for (let i = 0; i < count; i++) {
      leafParticles.push({
        x: wx + (Math.random() * 10 - 5),
        y: wy + (Math.random() * 6 - 3),
        vx: (Math.random() - 0.5) * spread,
        vy: -16 - Math.random() * 22,
        life: 0.45 + Math.random() * 0.3,
        shade: AUTUMN_LEAF_SHADES[(i + Math.floor(Math.random() * 4)) % AUTUMN_LEAF_SHADES.length],
        w: i % 2 === 0 ? 3 : 2,
        h: 2,
      });
    }
  }

  function spawnFeatherBurst(wx, wy) {
    const featherShades = [
      [148, 82, 42],
      [235, 206, 158],
      [96, 48, 28],
      [214, 122, 48],
    ];
    for (let i = 0; i < 8; i++) {
      leafParticles.push({
        x: wx + (Math.random() * 8 - 4),
        y: wy - 4 + (Math.random() * 6 - 3),
        vx: (Math.random() - 0.5) * 44,
        vy: -20 - Math.random() * 20,
        life: 0.45 + Math.random() * 0.28,
        shade: featherShades[i % featherShades.length],
        w: 3,
        h: 2,
      });
    }
  }

  function spawnTallGrassRustle(wx, wy) {
    playGrassRustle();
    spawnAutumnLeafBurst(wx, wy, 5, 32);
    if (Math.random() < 0.05) {
      const kind = Math.random() < 0.5 ? "coin" : "acorn";
      groundDrops.push({
        x: wx + (Math.random() * 12 - 6),
        y: wy - 2,
        kind,
        age: 0,
      });
    }
  }

  function clampCamera(px, py) {
    const worldPxW = mapW * tileSize;
    const worldPxH = mapH * tileSize;
    const halfW = VIEW_W / 2;
    const halfH = VIEW_H / 2;
    const cx = worldPxW <= VIEW_W ? worldPxW / 2 : Math.max(halfW, Math.min(worldPxW - halfW, px));
    const cy = worldPxH <= VIEW_H ? worldPxH / 2 : Math.max(halfH, Math.min(worldPxH - halfH, py));
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  let cam = clampCamera(playerState.x, playerState.y);
  k.setCamPos(cam.x, cam.y);

  let isFasterNow = false;

  k.onUpdate(() => {
    const dt = Math.min(k.dt(), 0.05);
    playerState.elapsedTime += dt;

    // Typewriter update when dialogue is open
    ui.updateDialogueTypewriter(dt);

    // Animate Folded Paper Map pulsing marker while map modal is open
    if (ui.isMapOpen()) {
      const tx = Math.floor(playerState.x / tileSize);
      const ty = Math.floor(playerState.y / tileSize);
      paperMap.renderToCanvas(ui.getMapCanvas(), {
        questSystem,
        streetSignSystem,
        playerTileX: tx,
        playerTileY: ty,
        timeSec: playerState.elapsedTime,
        gpsAssist: questSystem.state.gpsAssist,
      });
      return;
    }

    // Active Overhead Item Fanfare freeze
    if (activeFanfare) {
      activeFanfare.timer -= dt;
      if (activeFanfare.timer <= 0) {
        startNextFanfare();
      }
      return;
    }

    if (ui.isDialogueOpen() || ui.isPaintOpen() || ui.isSignOpen()) {
      playerState.moving = false;
      return;
    }

    if (activeChalkArrow) {
      activeChalkArrow.timer -= dt;
      if (activeChalkArrow.timer <= 0) activeChalkArrow = null;
    }

    if (playerState.safeCrossingTimer > 0) {
      playerState.safeCrossingTimer = Math.max(0, playerState.safeCrossingTimer - dt);
    }
    if (playerState.curbStopCueTimer > 0) {
      playerState.curbStopCueTimer = Math.max(0, playerState.curbStopCueTimer - dt);
    }
    if (playerState.curbStopToastCooldown > 0) {
      playerState.curbStopToastCooldown = Math.max(0, playerState.curbStopToastCooldown - dt);
    }
    if (playerState.hurtTimer > 0) {
      playerState.hurtTimer = Math.max(0, playerState.hurtTimer - dt);
    }
    if (playerState.hurtShakeTimer > 0) {
      playerState.hurtShakeTimer = Math.max(0, playerState.hurtShakeTimer - dt);
    }
    if (playerState.ouchBubbleTimer > 0) {
      playerState.ouchBubbleTimer = Math.max(0, playerState.ouchBubbleTimer - dt);
    }
    if (playerState.heartRefillTimer > 0) {
      playerState.heartRefillTimer = Math.max(0, playerState.heartRefillTimer - dt);
      if (playerState.heartRefillTimer <= 0 && playerState.hearts < playerState.maxHearts) {
        playerState.hearts = playerState.maxHearts;
      }
    }

    for (let i = dustPuffs.length - 1; i >= 0; i--) {
      dustPuffs[i].life -= dt;
      dustPuffs[i].y -= dt * 8;
      if (dustPuffs[i].life <= 0) dustPuffs.splice(i, 1);
    }

    for (let i = leafParticles.length - 1; i >= 0; i--) {
      const p = leafParticles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 65 * dt;
      if (p.life <= 0) leafParticles.splice(i, 1);
    }

    for (let i = groundDrops.length - 1; i >= 0; i--) {
      const d = groundDrops[i];
      d.age += dt;
      const dist = Math.hypot(d.x - playerState.x, d.y - playerState.y);
      if (d.age > 0.25 && dist < 14) {
        if (d.kind === "coin") {
          questSystem.state.coins += 1;
          ui.showSafetyToast("🪙 Found a Neighborhood Coin!", 1500);
        } else {
          questSystem.state.acorns += 1;
          ui.showSafetyToast("🌰 Found a Lucky Acorn!", 1500);
        }
        questSystem.save();
        playCoinPickup();
        groundDrops.splice(i, 1);
      } else if (d.age > 15) {
        groundDrops.splice(i, 1);
      }
    }

    const curTx = Math.floor(playerState.x / tileSize);
    const curTy = Math.floor(playerState.y / tileSize);
    const curTileType = safety.getTileType(curTx, curTy);
    const gear = questSystem.getGear();

    isFasterNow = false;

    if (playerState.knockbackTimer > 0) {
      // Classic 16-bit SNES RPG backward knockback slide (collision-safe & road-curb-safe!)
      const kbFactor = Math.max(0.25, playerState.knockbackTimer / 0.24);
      playerState.knockbackTimer = Math.max(0, playerState.knockbackTimer - dt);
      const kbSpeed = Math.hypot(playerState.knockbackVx, playerState.knockbackVy) * kbFactor;
      const kbInput = {
        x: playerState.knockbackVx,
        y: playerState.knockbackVy,
      };
      const kbRoadBlocker = safety.createRoadAwareBlocker(
        collider.isBoxBlocked,
        playerState.x,
        playerState.y,
        playerState.safeCrossingTimer > 0,
        DEFAULT_HITBOX
      );
      let kbMoved = moveWithCollision(playerState, kbInput, dt, kbRoadBlocker.isBoxBlocked, {
        speed: kbSpeed,
        tileSize,
      });
      // If pinned against a curb, slide cleanly using solid-wall-only check so knockback never stalls completely
      if (Math.hypot(kbMoved.x - playerState.x, kbMoved.y - playerState.y) < 0.05) {
        kbMoved = moveWithCollision(playerState, kbInput, dt, collider.isBoxBlocked, {
          speed: kbSpeed * 0.7,
          tileSize,
        });
      }
      playerState.x = kbMoved.x;
      playerState.y = kbMoved.y;
      playerState.moving = false;
      playerState.walkTimer = 0;
    } else if (playerState.lookTimer > 0) {
      playerState.lookTimer = Math.max(0, playerState.lookTimer - dt);
      const progress = 1 - playerState.lookTimer / LOOK_DURATION_SEC;
      if (progress < 0.4) {
        playerState.facing = "left";
      } else if (progress < 0.8) {
        playerState.facing = "right";
      } else {
        playerState.facing = playerState.lookSavedFacing;
      }
      playerState.moving = false;
      playerState.walkTimer = 0;
    } else {
      const input = readInput();
      const hardMode = questSystem.state.navMode === "hard";
      const baseSafetyMult = safety.getSpeedMultiplier(
        curTileType,
        input.wantsFaster,
        playerState.safeCrossingTimer > 0
      );
      const effectiveMult = baseSafetyMult > 1 ? Math.max(baseSafetyMult, gear.mult) : 1;

      // Hard Mode (Heading-Up): Left/Right snaps in crisp 45° compass increments (N, NE, E, SE, S, SW, W, NW)
      // with a quick smooth ease-out turn animation; Up walks straight ahead along the locked compass heading!
      let moveInput = input;
      let speedMult = effectiveMult;
      if (hardMode) {
        const turnDir = input.x > 0 ? 1 : input.x < 0 ? -1 : 0;
        if (turnDir === 0) {
          playerState.turnHoldDir = 0;
          playerState.turnRepeatTimer = 0;
        } else if (turnDir !== playerState.turnHoldDir) {
          // Fresh tap -> turn exactly one 45° compass step!
          playerState.turnHoldDir = turnDir;
          playerState.targetHeadingDeg = (playerState.targetHeadingDeg + turnDir * 45 + 360) % 360;
          playerState.turnRepeatTimer = 0.34;
        } else {
          playerState.turnRepeatTimer -= dt;
          if (playerState.turnRepeatTimer <= 0) {
            playerState.targetHeadingDeg = (playerState.targetHeadingDeg + turnDir * 45 + 360) % 360;
            playerState.turnRepeatTimer = 0.28;
          }
        }

        // Smooth shortest-arc ease into the exact 45° target heading
        const angleDiff = ((playerState.targetHeadingDeg - playerState.headingDeg + 540) % 360) - 180;
        if (Math.abs(angleDiff) <= 0.4) {
          playerState.headingDeg = playerState.targetHeadingDeg;
        } else {
          const rotStep = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), Math.max(240, Math.abs(angleDiff) * 14) * dt);
          playerState.headingDeg = (playerState.headingDeg + rotStep + 360) % 360;
        }

        const forwardAmt = -input.y; // +1 = Up (forward), -1 = Down (back up)
        if (forwardAmt !== 0) {
          // Walk strictly along the live screen heading so UP always goes dead-straight where you are facing!
          const rad = (playerState.headingDeg * Math.PI) / 180;
          moveInput = {
            x: Math.sin(rad) * forwardAmt,
            y: -Math.cos(rad) * forwardAmt,
          };
          if (forwardAmt < 0) speedMult *= 0.72;
        } else {
          moveInput = { x: 0, y: 0 };
        }
      }

      isFasterNow = effectiveMult > 1 && (moveInput.x !== 0 || moveInput.y !== 0);

      if (isFasterNow && !playerState.wasFasterActive) {
        playBoostWhoosh();
      }
      playerState.wasFasterActive = isFasterNow;

      const roadBlocker = safety.createRoadAwareBlocker(
        collider.isBoxBlocked,
        playerState.x,
        playerState.y,
        playerState.safeCrossingTimer > 0,
        DEFAULT_HITBOX
      );

      const isPreferredPathTile = (ptx, pty) => {
        const t = safety.getTileType(ptx, pty);
        return t === "sidewalk" || t === "dirt" || t === "park" || t === "sand";
      };

      const combinedBlocker = (nx, ny, hb) =>
        roadBlocker.isBoxBlocked(nx, ny, hb) ||
        isBlockedByStreetLife(streetLife, nx, ny, hb, playerState.x, playerState.y);

      const moved = moveWithCollision(
        playerState,
        moveInput,
        dt,
        combinedBlocker,
        {
          speed: PLAYER_SPEED_PX * speedMult,
          isPreferredPathTile,
          tileSize,
        }
      );
      playerState.x = moved.x;
      playerState.y = moved.y;
      if (hardMode) {
        // Keep Liam upright facing forward (away from camera) while the world rotates around him!
        playerState.facing = input.y > 0 ? "down" : "up";
      } else {
        playerState.facing = moved.facing;
      }
      playerState.moving = moved.moving;

      const currentlyOnRoad = safety.isBoxOnRoad(playerState.x, playerState.y, DEFAULT_HITBOX);
      const crossingProgress = safety.updateCrossingProgress(playerState, currentlyOnRoad);
      if (crossingProgress.finishedCrossing) {
        ui.showSafetyToast("✅ Crossed Safely! Remember to Look Again at the Next Street", 1800);
      }

      if (roadBlocker.wasBlockedByRoad() && !moved.glidedBend && !moved.slidCorner) {
        playerState.curbStopCueTimer = 1.6;
        if (playerState.curbStopToastCooldown <= 0) {
          playCurbStopBoop();
          ui.showSafetyToast("🛑 Stop at the curb! Tap LOOK BOTH WAYS (or Space) before crossing!", 2400);
          playerState.curbStopToastCooldown = 1.6;
        }
      } else if (roadBlocker.wasBlockedByMedian()) {
        if (playerState.curbStopToastCooldown <= 0) {
          playCurbStopBoop();
          ui.showSafetyToast("🚧 Highway median barrier! Walk to a crosswalk to cross!", 2400);
          playerState.curbStopToastCooldown = 1.6;
        }
      }

      if (moved.moving) {
        playerState.walkTimer += dt * (isFasterNow ? 14 : 9);
        playerState.stepSoundCooldown -= dt;
        if (playerState.stepSoundCooldown <= 0) {
          const onSoftGround =
            curTileType === "grass" ||
            curTileType === "tall_grass" ||
            curTileType === "park" ||
            curTileType === "dirt" ||
            curTileType === "sand";
          playStepTick(onSoftGround, isFasterNow);
          playerState.stepSoundCooldown = isFasterNow ? 0.15 : 0.24;
        }
        if (isFasterNow) {
          dustCooldown -= dt;
          if (dustCooldown <= 0) {
            const dustTint =
              curTileType === "dirt"
                ? [186, 140, 96]
                : curTileType === "sand"
                  ? [238, 214, 152]
                  : [242, 224, 198];
            dustPuffs.push({
              x: playerState.x + (Math.random() * 5 - 2.5),
              y: playerState.y + 4,
              life: 0.28,
              tint: dustTint,
            });
            dustCooldown = 0.07;
          }
          // Fluttering autumn leaves swirling behind Liam's scooter!
          leafTrailCooldown -= dt;
          if (leafTrailCooldown <= 0) {
            const backX =
              playerState.facing === "right"
                ? -6
                : playerState.facing === "left"
                  ? 6
                  : 0;
            const backY =
              playerState.facing === "down"
                ? -5
                : playerState.facing === "up"
                  ? 5
                  : 2;
            leafParticles.push({
              x: playerState.x + backX + (Math.random() * 6 - 3),
              y: playerState.y + backY + (Math.random() * 4 - 2),
              vx: backX * 4 + (Math.random() - 0.5) * 26,
              vy: -14 - Math.random() * 14,
              life: 0.45 + Math.random() * 0.25,
              shade: AUTUMN_LEAF_SHADES[Math.floor(Math.random() * AUTUMN_LEAF_SHADES.length)],
              w: Math.random() < 0.5 ? 3 : 2,
              h: 2,
            });
            leafTrailCooldown = 0.06;
          }
        }
      } else {
        playerState.walkTimer = 0;
        playerState.stepSoundCooldown = 0;
      }
    }

    // Update roving wild Newton turkeys, annoying sidewalk protestors, protestor mobs & spooky graveyard characters!
    updateStreetLife(streetLife, dt, playerState, worldMap, {
      isFasterNow,
      tileSize,
      graveyardGhosts: graveyardFeatures.ghosts,
      elapsedTime: playerState.elapsedTime,
      onTurkeyGobble: () => playTurkeyGobble(),
      onProtestorShout: () => playProtestorShout(),
      onSpookyChime: () => playSpookyChime(),
      onFeatherBurst: (fx, fy) => spawnFeatherBurst(fx, fy),
      onPlayerBump: (bump) => {
        if (bump.kind === "spooky") {
          playSpookyBooSfx();
        }
        playBumpHurtSfx();
        // Comic impact sparks (eerie violet/cyan ectoplasm for spooky hits, crimson/gold for turkeys/protestors!)
        const sparkColors =
          bump.kind === "spooky"
            ? [
                [158, 92, 245],
                [92, 238, 245],
                [240, 232, 255],
                [102, 242, 168],
              ]
            : [
                [235, 64, 52],
                [255, 220, 92],
                [255, 255, 255],
                [242, 132, 48],
              ];
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
          const spd = 28 + Math.random() * 44;
          leafParticles.push({
            x: playerState.x + (Math.random() * 4 - 2),
            y: playerState.y - 6 + (Math.random() * 4 - 2),
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 16,
            life: 0.34 + Math.random() * 0.16,
            shade: sparkColors[i % sparkColors.length],
            w: i % 2 === 0 ? 3 : 2,
            h: 2,
          });
        }
        const msg =
          playerState.hearts === 0
            ? `${bump.toast} (0/${playerState.maxHearts} ❤️ — catch your breath!)`
            : bump.toast;
        ui.showSafetyToast(msg, 2400);
      },
    });

    const isHardNow = questSystem.state.navMode === "hard";
    cam = isHardNow
      ? { x: Math.round(playerState.x), y: Math.round(playerState.y) }
      : clampCamera(playerState.x, playerState.y);
    if (playerState.hurtShakeTimer > 0) {
      const shakeMag = Math.ceil((playerState.hurtShakeTimer / 0.24) * 3);
      const sx = Math.round(Math.sin(playerState.elapsedTime * 75) * shakeMag);
      const sy = Math.round(Math.cos(playerState.elapsedTime * 63) * shakeMag);
      cam = { x: cam.x + sx, y: cam.y + sy };
    }
    k.setCamPos(cam.x, cam.y);
    k.setCamRot(isHardNow ? -playerState.headingDeg : 0);

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    const tileType = safety.getTileType(tx, ty);
    const streetZone = safety.getStreetZoneAt(tx, ty);

    // Update Fog-of-War & passive landmark/quest triggers whenever tile changes
    const posKey = `${tx},${ty}`;
    if (posKey !== playerState.lastFogTileKey) {
      playerState.lastFogTileKey = posKey;
      const events = questSystem.updatePlayerPosition(tx, ty);
      for (const ev of events) {
        if (ev.type === "landmark_discovered") {
          playLandmarkDiscover();
          ui.showSafetyToast(
            `🗺️ Discovered ${ev.landmark.name}! (+${ev.landmark.discoveryXP} XP)`,
            2800
          );
        } else if (ev.type === "quest_completed") {
          ui.showSafetyToast(`🏆 Quest Complete: ${ev.quest.title}!`, 2800);
          refreshPocketDirections(tx, ty, "Here");
          if (ev.rewardItem) {
            enqueueFanfare([
              { itemId: ev.rewardItem, sourceLabel: `Quest Reward: ${ev.quest.title}` },
            ]);
          }
        } else if (ev.type === "step_advanced") {
          playLandmarkDiscover();
          refreshPocketDirections(tx, ty, "Here");
          ui.showSafetyToast(`🎯 Next: ${ev.nextStep.instruction}`, 2600);
        }
      }
    }

    if (playerState.moving && tileType === "tall_grass" && posKey !== playerState.lastGrassTileKey) {
      playerState.lastGrassTileKey = posKey;
      spawnTallGrassRustle(playerState.x, playerState.y);
    } else if (tileType !== "tall_grass") {
      playerState.lastGrassTileKey = "";
    }

    // Crunchy autumn leaf-pile scatter when Liam walks or scoots through a curb leaf pile!
    if (playerState.moving) {
      const hitPile = leafPileMap.get(posKey);
      if (hitPile && playerState.elapsedTime - hitPile.lastScatter > 1.2) {
        hitPile.lastScatter = playerState.elapsedTime;
        playGrassRustle();
        spawnAutumnLeafBurst(playerState.x, playerState.y + 2, 10, 48);
      }
    }

    const graveZoneCode =
      tx >= 0 && ty >= 0 && tx < mapW && ty < mapH ? graveyardFeatures.graveyardGrid[ty * mapW + tx] : 0;
    const activeGraveyard = graveZoneCode > 0 ? graveyardFeatures.zones[graveZoneCode - 1] : null;
    const effectiveStreetZone = activeGraveyard
      ? { name: `🪦 ${activeGraveyard.name}`, type: "graveyard" }
      : streetZone;

    if (activeGraveyard && activeGraveyard.id !== lastGraveyardId) {
      lastGraveyardId = activeGraveyard.id;
      playSpookyChime();
      ui.showSafetyToast(`👻 Entering ${activeGraveyard.name} — watch out for spooky skeletons, phantoms & ghosts!`, 2800);
    } else if (!activeGraveyard) {
      lastGraveyardId = "";
    }

    const gpsAssist = Boolean(questSystem.state.gpsAssist);

    if (gpsAssist && streetZone && streetZone.name !== lastStreetName) {
      lastStreetName = streetZone.name;
      if (!activeGraveyard) playStreetBannerChime();
    }

    const nearbyHouses = buildingIndex.queryBounds(tx - 5, ty - 5, tx + 5, ty + 5);
    const curbContext = safety.inspectCrossingContext(tx, ty);
    const nearUncheckedRoad =
      playerState.safeCrossingTimer <= 0 &&
      !safety.isBoxOnRoad(playerState.x, playerState.y, DEFAULT_HITBOX) &&
      (curbContext.context === "crosswalk" ||
        curbContext.context === "highway" ||
        curbContext.context === "main_road" ||
        curbContext.context === "residential");

    const nearbyInteract = playerState.curbStopCueTimer > 0 ? null : findCombinedInteraction(tx, ty);
    const signBanner = resolveSignBanner(tx, ty, streetZone, activeGraveyard);

    ui.updateHUD({
      tileX: tx,
      tileY: ty,
      tileType,
      streetZone: effectiveStreetZone,
      originName: worldMap.origin?.name,
      nearestLandmark: findNearestLandmark(tx, ty),
      nearestBuilding: findNearestBuilding(nearbyHouses, tx, ty),
      nearbyInteraction: nearbyInteract,
      questHint: questSystem.formatTargetHint(tx, ty),
      pocketDirections,
      signBanner,
      navMode: questSystem.state.navMode,
      gpsAssist,
      heroOutfit: questSystem.state.heroOutfit,
      checkedSignsCount: questSystem.state.checkedSigns.size,
      checkedStreets: questSystem.state.checkedStreets,
      gearLabel: gear.label,
      debugEnabled: showDebug,
      muted: isMuted(),
      safetyXP: questSystem.state.safetyXP,
      coins: questSystem.state.coins,
      acorns: questSystem.state.acorns,
      hearts: playerState.hearts,
      maxHearts: playerState.maxHearts,
      isFasterActive: isFasterNow,
      safeCrossingActive: playerState.safeCrossingTimer > 0,
      needsLookAtCurb: playerState.curbStopCueTimer > 0 || nearUncheckedRoad,
    });

    // Update corner widget: live-spinning Brass Compass in Hard Mode, Compass in Signpost Mode, Radar in GPS Assist!
    const miniCanvas = ui.getMiniMapCanvas();
    if (miniCanvas) {
      if (isHardNow) {
        paperMap.renderCompassWidget(miniCanvas, {
          checkedCount: questSystem.state.checkedSigns.size,
          headingDeg: playerState.headingDeg,
          hardMode: true,
          timeSec: playerState.elapsedTime,
        });
      } else if (Math.floor(playerState.elapsedTime * 10) !== playerState.lastMiniMapTick) {
        playerState.lastMiniMapTick = Math.floor(playerState.elapsedTime * 10);
        if (gpsAssist) {
          paperMap.renderMiniMap(miniCanvas, {
            questSystem,
            playerTileX: tx,
            playerTileY: ty,
            timeSec: playerState.elapsedTime,
          });
        } else {
          paperMap.renderCompassWidget(miniCanvas, {
            checkedCount: questSystem.state.checkedSigns.size,
            headingDeg: 0,
            hardMode: false,
            timeSec: playerState.elapsedTime,
          });
        }
      }
    }
  });

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return 0;
    return baseLayer[ty * mapW + tx];
  }

  function drawGroundTile(tx, ty, tileId, animFrame) {
    const pxPos = tx * tileSize;
    const pyPos = ty * tileSize;
    const pattern = (tx * 7 + ty * 13) & 15;

    const inGraveyard =
      tx >= 0 && ty >= 0 && tx < mapW && ty < mapH && graveyardFeatures.graveyardGrid[ty * mapW + tx] !== 0;

    if (inGraveyard && (tileId === 0 || tileId === 11 || tileId === 7 || (tileId === 5 && hasPerAddressBuildings))) {
      // Spooky mossy graveyard turf with glowing lavender nightshade & toadstools!
      if (tileId !== 5 && pattern === 0) {
        k.drawSprite(`grave_flower_${animFrame}`, pxPos, pyPos);
      } else {
        k.drawSprite(((tx + ty) & 1) === 0 ? "grave_grass_0" : "grave_grass_1", pxPos, pyPos);
      }
      return;
    }

    if (tileId === 0 || (tileId === 5 && hasPerAddressBuildings)) {
      if (tileId === 0 && pattern === 0) {
        k.drawSprite(`grass_flower_${animFrame}`, pxPos, pyPos);
      } else {
        k.drawSprite(`grass_${pattern % 3}`, pxPos, pyPos);
      }
      return;
    }

    if (tileId === 11) {
      // Manicured public park & athletic field with crisp 2-tile alternating mower stripes!
      if (pattern === 1 && ((tx + ty) & 3) === 0) {
        k.drawSprite(`park_flower_${animFrame}`, pxPos, pyPos);
      } else {
        k.drawSprite(((tx >> 1) & 1) === 0 ? "park_0" : "park_1", pxPos, pyPos);
      }
      return;
    }

    if (tileId === 7) {
      k.drawSprite(`tall_grass_${animFrame}`, pxPos, pyPos);
      return;
    }

    const n = tileAt(tx, ty - 1);
    const s = tileAt(tx, ty + 1);
    const w = tileAt(tx - 1, ty);
    const e = tileAt(tx + 1, ty);

    if (tileId === 9) {
      // Packed dirt trail / baseball infield with warm autumn-lawn grass-fringe edges
      const spr = pattern === 2 ? "dirt_pebble" : pattern % 2 === 0 ? "dirt_0" : "dirt_1";
      k.drawSprite(spr, pxPos, pyPos);
      const fringeCol = k.rgb(186, 118, 38);
      const fringeDark = k.rgb(122, 68, 28);
      if (isGreenGround(n)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: fringeCol });
        k.drawRect({ pos: k.vec2(pxPos + (tx % 2) * 3, pyPos + 1), width: 6, height: 1, color: fringeCol, opacity: 0.75 });
      }
      if (isGreenGround(s)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: fringeCol });
        k.drawRect({ pos: k.vec2(pxPos + ((tx + 1) % 2) * 4, pyPos + 14), width: 5, height: 1, color: fringeDark, opacity: 0.55 });
      }
      if (isGreenGround(w)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: fringeCol });
        k.drawRect({ pos: k.vec2(pxPos + 1, pyPos + (ty % 2) * 4), width: 1, height: 6, color: fringeCol, opacity: 0.75 });
      }
      if (isGreenGround(e)) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: fringeCol });
        k.drawRect({ pos: k.vec2(pxPos + 14, pyPos + ((ty + 1) % 2) * 4), width: 1, height: 6, color: fringeDark, opacity: 0.55 });
      }
      return;
    }

    if (tileId === 10) {
      // Sunlit golden beach / playground sand with damp shoreline & warm autumn lawn edges
      const spr = pattern === 3 ? "sand_shell" : pattern % 2 === 0 ? "sand_0" : "sand_1";
      k.drawSprite(spr, pxPos, pyPos);
      const wetSand = k.rgb(181, 145, 83);
      const grassEdge = k.rgb(194, 126, 42);
      if (n === 6) k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 2, color: wetSand, opacity: 0.8 });
      if (s === 6) k.drawRect({ pos: k.vec2(pxPos, pyPos + 14), width: 16, height: 2, color: wetSand, opacity: 0.8 });
      if (w === 6) k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 2, height: 16, color: wetSand, opacity: 0.8 });
      if (e === 6) k.drawRect({ pos: k.vec2(pxPos + 14, pyPos), width: 2, height: 16, color: wetSand, opacity: 0.8 });
      if (isGreenGround(n)) k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: grassEdge, opacity: 0.7 });
      if (isGreenGround(s)) k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: grassEdge, opacity: 0.7 });
      if (isGreenGround(w)) k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: grassEdge, opacity: 0.7 });
      if (isGreenGround(e)) k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: grassEdge, opacity: 0.7 });
      return;
    }

    if (tileId === 6) {
      // Multi-depth auto-tiled water with warm golden-hour foam & autumn banks!
      const isShore = n !== 6 || s !== 6 || w !== 6 || e !== 6;
      k.drawSprite(isShore ? `water_shallow_${animFrame}` : `water_deep_${animFrame}`, pxPos, pyPos);
      if (isShore) {
        const foam = k.rgb(255, 240, 206);
        const foamShift = animFrame === 0 ? 0 : 1;
        const bankColor = (neighbor) =>
          neighbor === 10
            ? k.rgb(198, 166, 102)
            : neighbor === 1 || isRoadTile(neighbor)
              ? k.rgb(152, 134, 130)
              : k.rgb(156, 102, 42);

        if (n !== 6) {
          k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 2, color: bankColor(n) });
          k.drawRect({ pos: k.vec2(pxPos + 1 + foamShift, pyPos + 2), width: 6, height: 1, color: foam, opacity: 0.8 });
          k.drawRect({ pos: k.vec2(pxPos + 9 + foamShift, pyPos + 2), width: 5, height: 1, color: foam, opacity: 0.7 });
        }
        if (s !== 6) {
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 14), width: 16, height: 2, color: bankColor(s) });
          k.drawRect({ pos: k.vec2(pxPos + 2 - foamShift, pyPos + 13), width: 6, height: 1, color: foam, opacity: 0.75 });
        }
        if (w !== 6) {
          k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 2, height: 16, color: bankColor(w) });
          k.drawRect({ pos: k.vec2(pxPos + 2, pyPos + 2 + foamShift), width: 1, height: 6, color: foam, opacity: 0.75 });
        }
        if (e !== 6) {
          k.drawRect({ pos: k.vec2(pxPos + 14, pyPos), width: 2, height: 16, color: bankColor(e) });
          k.drawRect({ pos: k.vec2(pxPos + 13, pyPos + 5 - foamShift), width: 1, height: 6, color: foam, opacity: 0.75 });
        }
      }
      return;
    }

    if (tileId === 8) {
      const above = tileAt(tx, ty - 1);
      k.drawSprite(above !== 8 ? "parking_0" : "parking_1", pxPos, pyPos);
      return;
    }

    if (tileId === 1) {
      k.drawSprite((tx + ty) % 2 === 0 ? "sidewalk_0" : "sidewalk_1", pxPos, pyPos);
      const isEarth = (id) => id === 9 || id === 10;
      const curbTop = k.rgb(223, 208, 200);
      const curbFace = k.rgb(107, 89, 91);
      const curbOut = k.rgb(66, 52, 54);
      const lawnBorder = k.rgb(148, 82, 26);
      if (isRoadTile(s)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 13), width: 16, height: 1, color: curbTop });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 14), width: 16, height: 1, color: curbFace });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: curbOut });
      } else if (isGreenGround(s)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: lawnBorder, opacity: 0.45 });
      } else if (isEarth(s)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: k.rgb(142, 108, 72), opacity: 0.4 });
      }
      if (isRoadTile(n)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: curbOut });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 1), width: 16, height: 1, color: curbFace });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 2), width: 16, height: 1, color: curbTop });
      } else if (isGreenGround(n)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: lawnBorder, opacity: 0.45 });
      } else if (isEarth(n)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: k.rgb(142, 108, 72), opacity: 0.4 });
      }
      if (isRoadTile(e)) {
        k.drawRect({ pos: k.vec2(pxPos + 13, pyPos), width: 1, height: 16, color: curbTop });
        k.drawRect({ pos: k.vec2(pxPos + 14, pyPos), width: 1, height: 16, color: curbFace });
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: curbOut });
      } else if (isGreenGround(e)) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: lawnBorder, opacity: 0.45 });
      } else if (isEarth(e)) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: k.rgb(142, 108, 72), opacity: 0.4 });
      }
      if (isRoadTile(w)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: curbOut });
        k.drawRect({ pos: k.vec2(pxPos + 1, pyPos), width: 1, height: 16, color: curbFace });
        k.drawRect({ pos: k.vec2(pxPos + 2, pyPos), width: 1, height: 16, color: curbTop });
      } else if (isGreenGround(w)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: lawnBorder, opacity: 0.45 });
      } else if (isEarth(w)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: k.rgb(142, 108, 72), opacity: 0.4 });
      }
      return;
    }

    if (tileId === 4) {
      let ewTraffic = 0;
      let nsTraffic = 0;
      for (let d = 1; d <= 3; d++) {
        const tw = tileAt(tx - d, ty);
        const te = tileAt(tx + d, ty);
        const tn = tileAt(tx, ty - d);
        const ts = tileAt(tx, ty + d);
        if (tw === 2 || tw === 3 || tw === 12) ewTraffic++;
        if (te === 2 || te === 3 || te === 12) ewTraffic++;
        if (tn === 2 || tn === 3 || tn === 12) nsTraffic++;
        if (ts === 2 || ts === 3 || ts === 12) nsTraffic++;
      }
      k.drawSprite(ewTraffic >= nsTraffic ? "crosswalk_h" : "crosswalk_v", pxPos, pyPos);
      return;
    }

    if (tileId === 13) {
      // Impassable Divided Highway Concrete Jersey Barrier (between opposing traffic directions!)
      const isVertical = (n === 13 || s === 13) && !(w === 13 || e === 13);
      k.drawSprite(isVertical ? "highway_median_v" : "highway_median_h", pxPos, pyPos);
      // Yellow-and-black striped crash-attenuator end cap where the barrier opens for a crosswalk/intersection!
      if (!isVertical) {
        if (w !== 13) {
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 3), width: 3, height: 9, color: k.rgb(29, 34, 40) });
          k.drawRect({ pos: k.vec2(pxPos + 1, pyPos + 4), width: 2, height: 2, color: k.rgb(244, 211, 68) });
          k.drawRect({ pos: k.vec2(pxPos + 1, pyPos + 8), width: 2, height: 2, color: k.rgb(244, 211, 68) });
        }
        if (e !== 13) {
          k.drawRect({ pos: k.vec2(pxPos + 13, pyPos + 3), width: 3, height: 9, color: k.rgb(29, 34, 40) });
          k.drawRect({ pos: k.vec2(pxPos + 13, pyPos + 4), width: 2, height: 2, color: k.rgb(244, 211, 68) });
          k.drawRect({ pos: k.vec2(pxPos + 13, pyPos + 8), width: 2, height: 2, color: k.rgb(244, 211, 68) });
        }
      } else {
        if (n !== 13) {
          k.drawRect({ pos: k.vec2(pxPos + 3, pyPos), width: 9, height: 3, color: k.rgb(29, 34, 40) });
          k.drawRect({ pos: k.vec2(pxPos + 4, pyPos + 1), width: 2, height: 2, color: k.rgb(244, 211, 68) });
          k.drawRect({ pos: k.vec2(pxPos + 8, pyPos + 1), width: 2, height: 2, color: k.rgb(244, 211, 68) });
        }
        if (s !== 13) {
          k.drawRect({ pos: k.vec2(pxPos + 3, pyPos + 13), width: 9, height: 3, color: k.rgb(29, 34, 40) });
          k.drawRect({ pos: k.vec2(pxPos + 4, pyPos + 13), width: 2, height: 2, color: k.rgb(244, 211, 68) });
          k.drawRect({ pos: k.vec2(pxPos + 8, pyPos + 13), width: 2, height: 2, color: k.rgb(244, 211, 68) });
        }
      }
      return;
    }

    if (tileId === 12) {
      // Major Highway (Route 9 / Boylston St, Hammond Pond Pkwy): deep heavy asphalt, bright shoulder lines, multi-lane dashes & double-yellow median!
      k.drawSprite((tx + ty) % 2 === 0 ? "highway_base_0" : "highway_base_1", pxPos, pyPos);

      const nRoad = isRoadTile(n);
      const sRoad = isRoadTile(s);
      const wRoad = isRoadTile(w);
      const eRoad = isRoadTile(e);

      // Bold warm-cream highway shoulders
      if (!nRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: k.rgb(54, 42, 45) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 2), width: 16, height: 2, color: k.rgb(242, 229, 216), opacity: 0.92 });
      }
      if (!sRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: k.rgb(54, 42, 45) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 12), width: 16, height: 2, color: k.rgb(242, 229, 216), opacity: 0.92 });
      }
      if (!wRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: k.rgb(54, 42, 45) });
        k.drawRect({ pos: k.vec2(pxPos + 2, pyPos), width: 2, height: 16, color: k.rgb(242, 229, 216), opacity: 0.92 });
      }
      if (!eRoad) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: k.rgb(54, 42, 45) });
        k.drawRect({ pos: k.vec2(pxPos + 12, pyPos), width: 2, height: 16, color: k.rgb(242, 229, 216), opacity: 0.92 });
      }

      const nHw = n === 12;
      const sHw = s === 12;
      const wHw = w === 12;
      const eHw = e === 12;
      const n2Hw = tileAt(tx, ty - 2) === 12;
      const w2Hw = tileAt(tx - 2, ty) === 12;

      if (wHw && eHw && nHw && sHw && !n2Hw) {
        // Bold E-W Highway Golden-Amber Double-Yellow Median!
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 5), width: 16, height: 2, color: k.rgb(235, 184, 77) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 7), width: 16, height: 2, color: k.rgb(166, 148, 144), opacity: 0.55 });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 9), width: 16, height: 2, color: k.rgb(235, 184, 77) });
      } else if (nHw && sHw && wHw && eHw && !w2Hw && n2Hw) {
        // Bold N-S Highway Golden-Amber Double-Yellow Median
        k.drawRect({ pos: k.vec2(pxPos + 5, pyPos), width: 2, height: 16, color: k.rgb(235, 184, 77) });
        k.drawRect({ pos: k.vec2(pxPos + 7, pyPos), width: 2, height: 16, color: k.rgb(166, 148, 144), opacity: 0.55 });
        k.drawRect({ pos: k.vec2(pxPos + 9, pyPos), width: 2, height: 16, color: k.rgb(235, 184, 77) });
      } else if (wHw && eHw && !nHw && sHw && tx % 2 === 0) {
        k.drawRect({ pos: k.vec2(pxPos + 3, pyPos + 13), width: 10, height: 1, color: k.rgb(242, 229, 216), opacity: 0.82 });
      } else if (wHw && eHw && nHw && !sHw && tx % 2 === 0) {
        k.drawRect({ pos: k.vec2(pxPos + 3, pyPos + 2), width: 10, height: 1, color: k.rgb(242, 229, 216), opacity: 0.82 });
      } else if (nHw && sHw && !wHw && eHw && ty % 2 === 0) {
        k.drawRect({ pos: k.vec2(pxPos + 13, pyPos + 3), width: 1, height: 10, color: k.rgb(242, 229, 216), opacity: 0.82 });
      } else if (nHw && sHw && wHw && !eHw && ty % 2 === 0) {
        k.drawRect({ pos: k.vec2(pxPos + 2, pyPos + 3), width: 1, height: 10, color: k.rgb(242, 229, 216), opacity: 0.82 });
      }
      return;
    }

    if (tileId === 2 || tileId === 3) {
      k.drawSprite(
        tileId === 3 ? "road_main_base" : ((tx + ty) % 3 === 0 ? "road_res_base_1" : "road_res_base_0"),
        pxPos,
        pyPos
      );

      const nRoad = isRoadTile(n);
      const sRoad = isRoadTile(s);
      const wRoad = isRoadTile(w);
      const eRoad = isRoadTile(e);

      // Warm dusk-charcoal gutters & warm cream shoulders on Town Avenues
      const isMainAv = tileId === 3;
      if (!nRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: k.rgb(62, 48, 50), opacity: isMainAv ? 1 : 0.6 });
        if (isMainAv) k.drawRect({ pos: k.vec2(pxPos, pyPos + 2), width: 16, height: 1, color: k.rgb(242, 229, 216), opacity: 0.8 });
      }
      if (!sRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: k.rgb(62, 48, 50), opacity: isMainAv ? 1 : 0.6 });
        if (isMainAv) k.drawRect({ pos: k.vec2(pxPos, pyPos + 13), width: 16, height: 1, color: k.rgb(242, 229, 216), opacity: 0.8 });
      }
      if (!wRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: k.rgb(62, 48, 50), opacity: isMainAv ? 1 : 0.6 });
        if (isMainAv) k.drawRect({ pos: k.vec2(pxPos + 2, pyPos), width: 1, height: 16, color: k.rgb(242, 229, 216), opacity: 0.8 });
      }
      if (!eRoad) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: k.rgb(62, 48, 50), opacity: isMainAv ? 1 : 0.6 });
        if (isMainAv) k.drawRect({ pos: k.vec2(pxPos + 13, pyPos), width: 1, height: 16, color: k.rgb(242, 229, 216), opacity: 0.8 });
      }

      if (tileId === 2) {
        // Crisp warm golden-amber lane dividers on both 2-tile-wide AND 1-tile residential streets!
        const nRes = n === 2;
        const sRes = s === 2;
        const wRes = w === 2;
        const eRes = e === 2;
        if (wRes && eRes && !nRes && sRes && tx % 2 === 0) {
          // Top lane of a 2-tile horizontal residential street -> golden dash along center seam
          k.drawRect({ pos: k.vec2(pxPos + 3, pyPos + 15), width: 10, height: 1, color: k.rgb(235, 184, 77), opacity: 0.8 });
        } else if (wRes && eRes && nRes && !sRes && tx % 2 === 0) {
          // Bottom lane of a 2-tile horizontal residential street -> golden dash along center seam
          k.drawRect({ pos: k.vec2(pxPos + 3, pyPos), width: 10, height: 1, color: k.rgb(235, 184, 77), opacity: 0.8 });
        } else if (nRes && sRes && !wRes && eRes && ty % 2 === 0) {
          // Left lane of a 2-tile vertical residential street -> golden dash along center seam
          k.drawRect({ pos: k.vec2(pxPos + 15, pyPos + 3), width: 1, height: 10, color: k.rgb(235, 184, 77), opacity: 0.8 });
        } else if (nRes && sRes && wRes && !eRes && ty % 2 === 0) {
          // Right lane of a 2-tile vertical residential street -> golden dash along center seam
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 3), width: 1, height: 10, color: k.rgb(235, 184, 77), opacity: 0.8 });
        } else if (wRoad && eRoad && !nRoad && !sRoad && tx % 2 === 0) {
          k.drawRect({ pos: k.vec2(pxPos + 3, pyPos + 7), width: 10, height: 2, color: k.rgb(235, 184, 77), opacity: 0.68 });
        } else if (nRoad && sRoad && !wRoad && !eRoad && ty % 2 === 0) {
          k.drawRect({ pos: k.vec2(pxPos + 7, pyPos + 3), width: 2, height: 10, color: k.rgb(235, 184, 77), opacity: 0.68 });
        }
      } else {
        // Town Avenue (Centre St, Beacon St, Langley Rd, Cypress St, Parker St): crisp golden-amber centerlines
        const nMain = n === 3;
        const sMain = s === 3;
        const wMain = w === 3;
        const eMain = e === 3;
        const n2Main = tileAt(tx, ty - 2) === 3;
        const w2Main = tileAt(tx - 2, ty) === 3;

        if (wMain && eMain && nMain && sMain && !n2Main) {
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 6), width: 16, height: 1, color: k.rgb(235, 184, 77) });
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 9), width: 16, height: 1, color: k.rgb(235, 184, 77) });
        } else if (nMain && sMain && wMain && eMain && !w2Main && n2Main) {
          k.drawRect({ pos: k.vec2(pxPos + 6, pyPos), width: 1, height: 16, color: k.rgb(235, 184, 77) });
          k.drawRect({ pos: k.vec2(pxPos + 9, pyPos), width: 1, height: 16, color: k.rgb(235, 184, 77) });
        } else if (wMain && eMain && !nMain && sMain) {
          // Top lane of a 2-tile-wide E-W town avenue -> crisp golden centerline along bottom seam
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 14), width: 16, height: 1, color: k.rgb(235, 184, 77), opacity: 0.9 });
        } else if (wMain && eMain && nMain && !sMain) {
          // Bottom lane of a 2-tile-wide E-W town avenue -> crisp golden centerline along top seam
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 1), width: 16, height: 1, color: k.rgb(235, 184, 77), opacity: 0.9 });
        } else if (nMain && sMain && !wMain && eMain) {
          // West lane of a 2-tile-wide N-S town avenue -> crisp golden centerline along right seam
          k.drawRect({ pos: k.vec2(pxPos + 14, pyPos), width: 1, height: 16, color: k.rgb(235, 184, 77), opacity: 0.9 });
        } else if (nMain && sMain && wMain && !eMain) {
          // East lane of a 2-tile-wide N-S town avenue -> crisp golden centerline along left seam
          k.drawRect({ pos: k.vec2(pxPos + 1, pyPos), width: 1, height: 16, color: k.rgb(235, 184, 77), opacity: 0.9 });
        }
      }
      return;
    }

    if (tileId === 5) {
      k.drawRect({ pos: k.vec2(pxPos, pyPos), width: tileSize, height: tileSize, color: k.rgb(140, 109, 98) });
    }
  }

  function drawHero() {
    const pxPos = Math.round(playerState.x);
    const pyPos = Math.round(playerState.y);

    if (playerState.safeCrossingTimer > 0) {
      k.drawRect({
        pos: k.vec2(pxPos - 8, pyPos + 1),
        width: 16,
        height: 6,
        color: k.rgb(110, 231, 168),
        opacity: 0.42,
      });
    }

    const outfit = questSystem.state.heroOutfit === "baseball" ? "baseball" : "polo";
    let sprName;
    if (activeFanfare) {
      sprName = `hero_${outfit}_fanfare`;
    } else if (isFasterNow) {
      sprName = `hero_${outfit}_scooter_${playerState.facing}`;
    } else if (!playerState.moving) {
      sprName = `hero_${outfit}_${playerState.facing}_0`;
    } else {
      // Smooth 4-beat 32-bit walk cycle (Left-Stride -> Pass -> Right-Stride -> Pass!)
      const walkCycle = [1, 0, 2, 0];
      const step = walkCycle[Math.floor(playerState.walkTimer) % 4];
      sprName = `hero_${outfit}_${playerState.facing}_${step}`;
    }

    const isHurt = playerState.hurtTimer > 0;
    const isKnockback = playerState.knockbackTimer > 0;
    const kbProgress = isKnockback ? 1 - playerState.knockbackTimer / 0.24 : 0;
    const hopOffset = isKnockback ? Math.round(Math.sin(kbProgress * Math.PI) * 5) : 0;
    // Classic 16-bit SNES invulnerability blink during hurt window!
    const hurtBlinkHide = isHurt && !isKnockback && Math.floor(playerState.elapsedTime * 18) % 2 === 0;

    const heroAngle = questSystem.state.navMode === "hard" ? playerState.headingDeg : 0;
    if (!hurtBlinkHide) {
      k.drawSprite(sprName, pxPos - 12, pyPos - 23 - hopOffset, 1, heroAngle, pxPos, pyPos);
    }

    // Classic SNES red/white hit-flash silhouette + spinning dizzy stars + floating OUCH/BONK & hearts!
    if (isHurt) {
      if (playerState.hurtTimer > 0.68) {
        const flashWhite = Math.floor(playerState.elapsedTime * 30) % 2 === 0;
        const isSpookyHit = playerState.lastBumpKind === "spooky";
        k.drawRect({
          pos: k.vec2(pxPos - 6, pyPos - 18 - hopOffset),
          width: 12,
          height: 17,
          color: flashWhite
            ? k.rgb(255, 240, 248)
            : isSpookyHit
              ? k.rgb(156, 84, 242)
              : k.rgb(235, 52, 52),
          opacity: 0.58,
        });
      }
      // Orbiting golden dizzy stars above Liam's head
      const starAngle = playerState.elapsedTime * 9;
      for (let i = 0; i < 3; i++) {
        const a = starAngle + (i * Math.PI * 2) / 3;
        const sx = Math.round(pxPos - 2 + Math.cos(a) * 9);
        const sy = Math.round(pyPos - 27 - hopOffset + Math.sin(a) * 3);
        k.drawRect({ pos: k.vec2(sx, sy), width: 3, height: 3, color: k.rgb(255, 224, 72) });
        k.drawRect({ pos: k.vec2(sx + 1, sy + 1), width: 1, height: 1, color: k.rgb(255, 255, 255) });
      }
    }

    // Floating 3-heart SNES damage meter right above Liam whenever damaged!
    if (playerState.ouchBubbleTimer > 0 || playerState.hearts < playerState.maxHearts) {
      const heartY = pyPos - 33 - hopOffset;
      const maxH = playerState.maxHearts || 3;
      const curH = playerState.hearts ?? maxH;
      const startHx = pxPos - Math.floor((maxH * 7 - 1) / 2);
      for (let h = 0; h < maxH; h++) {
        const hx = startHx + h * 7;
        const filled = h < curH;
        const justLost = h === curH && playerState.hurtTimer > 0.4;
        // Dark pixel outline
        k.drawRect({ pos: k.vec2(hx, heartY), width: 6, height: 5, color: k.rgb(34, 16, 20), opacity: 0.9 });
        if (filled) {
          k.drawRect({ pos: k.vec2(hx + 1, heartY + 1), width: 4, height: 3, color: k.rgb(235, 48, 62) });
          k.drawRect({ pos: k.vec2(hx + 1, heartY + 1), width: 1, height: 1, color: k.rgb(255, 196, 196) });
        } else {
          k.drawRect({
            pos: k.vec2(hx + 1, heartY + 1),
            width: 4,
            height: 3,
            color: justLost ? k.rgb(255, 210, 120) : k.rgb(88, 70, 76),
          });
        }
      }
      if (playerState.ouchBubbleTimer > 0) {
        const bKey = playerState.ouchBubbleSprite || "bubble_ouch";
        const bSpr = atlas[bKey];
        const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 22;
        const rise = Math.round((1 - playerState.ouchBubbleTimer / 0.95) * 6);
        k.drawSprite(bKey, Math.round(pxPos - bwLog / 2), heartY - 12 - rise, 1, heroAngle, pxPos, pyPos);
      }
    }

    // Overhead Item Fanfare floating item + orbiting golden sparkles!
    if (activeFanfare) {
      const floatBob = Math.sin(playerState.elapsedTime * 6) * 2;
      const itemY = pyPos - 36 + floatBob;
      k.drawSprite(activeFanfare.itemMeta.sprite || "item_badge", pxPos - 6, itemY);

      const angle = playerState.elapsedTime * 4;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        const sx = pxPos - 4 + Math.cos(a) * 11;
        const sy = itemY + 2 + Math.sin(a) * 7;
        k.drawSprite("fanfare_star", sx, sy);
      }
    }

    if (playerState.curbStopCueTimer > 0 && playerState.lookTimer <= 0 && !activeFanfare) {
      const cueBob = Math.sin(playerState.elapsedTime * 10) * 1.5;
      k.drawSprite("curb_stop_cue", pxPos - 5, pyPos - 31 + cueBob);
    }

    if (playerState.lookTimer > 0) {
      if (playerState.facing === "left") {
        k.drawRect({ pos: k.vec2(pxPos - 13, pyPos - 13), width: 5, height: 2, color: k.rgb(110, 231, 168) });
        k.drawRect({ pos: k.vec2(pxPos - 15, pyPos - 14), width: 2, height: 4, color: k.rgb(244, 211, 94) });
      } else if (playerState.facing === "right") {
        k.drawRect({ pos: k.vec2(pxPos + 8, pyPos - 13), width: 5, height: 2, color: k.rgb(110, 231, 168) });
        k.drawRect({ pos: k.vec2(pxPos + 13, pyPos - 14), width: 2, height: 4, color: k.rgb(244, 211, 94) });
      }
    }
  }

  k.onDraw(() => {
    const animFrame = Math.floor(playerState.elapsedTime * 2) % 2;

    const isHardDraw = questSystem.state.navMode === "hard";
    const cullHalfW = isHardDraw ? Math.ceil(Math.hypot(VIEW_W / 2, VIEW_H / 2)) + tileSize * 2 : VIEW_W / 2 + tileSize * 2;
    const cullHalfH = isHardDraw ? cullHalfW : VIEW_H / 2 + tileSize * 2;
    const startX = Math.max(0, Math.floor((cam.x - cullHalfW) / tileSize));
    const endX = Math.min(mapW - 1, Math.ceil((cam.x + cullHalfW) / tileSize));
    const startY = Math.max(0, Math.floor((cam.y - cullHalfH) / tileSize));
    const endY = Math.min(mapH - 1, Math.ceil((cam.y + cullHalfH) / tileSize));

    // 1. Auto-tiled ground layer
    for (let ty = startY; ty <= endY; ty++) {
      const rowOffset = ty * mapW;
      for (let tx = startX; tx <= endX; tx++) {
        drawGroundTile(tx, ty, baseLayer[rowOffset + tx], animFrame);
      }
    }

    // 1b. Baked 16-bit SNES Park Athletic Fields (baseball diamonds, basketball courts, soccer pitches, playgrounds)
    for (const field of parkFeatures.fields) {
      if (
        field.tx + field.w < startX ||
        field.tx > endX ||
        field.ty + field.h < startY ||
        field.ty > endY
      ) {
        continue;
      }
      const fieldCanvas = getBakedField(field);
      k.drawCanvas(`parkfield_${field.id}`, fieldCanvas, field.tx * tileSize, field.ty * tileSize);
    }

    // 2. Depth-sorted 32-bit buildings, trees, props, NPCs, wooden chests & hero
    //    In Hard Mode (rotating POV):
    //      - Houses render as 2.5D pixel-stacked buildings whose walls & pitched roofs smoothly
    //        extrude upward toward the top of the player's POV (never sideways or upside-down!)
    //      - Trees, street signs, NPCs, hydrants & Liam stay upright via billboarding
    //      - Everything sorts by screen-space depth so Liam cleanly walks in front/behind at any angle!
    const drawables = [];
    const headingRad = isHardDraw ? (playerState.headingDeg * Math.PI) / 180 : 0;
    const sinH = Math.sin(headingRad);
    const cosH = Math.cos(headingRad);
    const bbAngle = isHardDraw ? playerState.headingDeg : 0;
    const upX = sinH;
    const upY = -cosH;
    const depthOf = (wx, wy) => (isHardDraw ? -(wx - cam.x) * sinH + (wy - cam.y) * cosH : wy);

    const visibleBuildings = buildingIndex.queryBounds(startX - 1, startY - 1, endX + 1, endY + 1);
    for (const b of visibleBuildings) {
      const { minX, minY, maxX, maxY } = b.bounds;
      if (maxX < startX - 1 || minX > endX + 1 || maxY < startY - 1 || minY > endY + 1) continue;
      if (isHardDraw) {
        const stack = getBakedHouseStack(b);
        const baseX = minX * tileSize;
        const baseY = minY * tileSize;
        const bwPx = (maxX - minX + 1) * tileSize;
        const bhPx = (maxY - minY + 1) * tileSize;
        const cxPx = baseX + bwPx / 2;
        const cyPx = baseY + bhPx / 2;
        const frontDepth = depthOf(
          cxPx - (bwPx * 0.45) * sinH,
          cyPx + (bhPx * 0.45) * cosH
        );
        const vTag = stack.version;
        const [wallC, eavesC, roofC, ridgeC] = stack.layers;
        const wallSteps = stack.isTall ? [0, 2.5, 5.0, 7.5] : [0, 2.5, 5.0];
        const roofBase = stack.isTall ? 10.0 : 7.5;
        drawables.push({
          sortY: frontDepth,
          draw: () => {
            // Subtle warm dusk shadow anchored under ground footprint
            k.drawRect({
              pos: k.vec2(baseX + 2, baseY + 2),
              width: bwPx - 2,
              height: bhPx - 2,
              color: k.rgb(42, 20, 18),
              opacity: 0.32,
            });
            // Extrude wall + eaves + pitched shingled roof + chimney smoothly toward screen-UP!
            for (const h of wallSteps) {
              k.drawCanvas(`hs_w_${b.id}_v${vTag}`, wallC, baseX + upX * h, baseY + upY * h);
            }
            k.drawCanvas(`hs_e_${b.id}_v${vTag}`, eavesC, baseX + upX * roofBase, baseY + upY * roofBase);
            k.drawCanvas(`hs_r_${b.id}_v${vTag}`, roofC, baseX + upX * (roofBase + 2.5), baseY + upY * (roofBase + 2.5));
            k.drawCanvas(`hs_c_${b.id}_v${vTag}`, ridgeC, baseX + upX * (roofBase + 5.0), baseY + upY * (roofBase + 5.0));
          },
        });
      } else {
        const baked = getBakedHouse(b);
        const drawX = minX * tileSize + baked.offsetX;
        const drawY = minY * tileSize + baked.offsetY;
        drawables.push({
          sortY: (maxY + 1) * tileSize,
          draw: () => k.drawCanvas(`house_${b.id}_v${baked.version}`, baked.canvas, drawX, drawY),
        });
      }
    }

    for (let ty = startY; ty <= endY; ty++) {
      const rowOffset = ty * mapW;
      for (let tx = startX; tx <= endX; tx++) {
        const tKind = treeGrid[rowOffset + tx];
        if (tKind === 1) {
          const jx = ((tx * 13 + ty * 7) % 5) - 2;
          const jy = ((tx * 5 + ty * 11) % 3) - 1;
          const pxPos = tx * tileSize - 4 + jx;
          const pyPos = ty * tileSize - 11 + jy;
          const footX = tx * tileSize + 8 + jx;
          const footY = (ty + 1) * tileSize + jy;
          const treeVariant = ((tx * 7 + ty * 13) >>> 0) % 3;
          drawables.push({
            sortY: depthOf(footX, footY),
            draw: () => k.drawSprite(`tree_oak_${treeVariant}`, pxPos, pyPos, 1, bbAngle, footX, footY),
          });
        } else if (tKind === 2) {
          const jx = ((tx * 11 + ty * 17) % 5) - 2;
          const jy = ((tx * 7 + ty * 3) % 3) - 1;
          const pxPos = tx * tileSize - 3 + jx;
          const pyPos = ty * tileSize - 13 + jy;
          const footX = tx * tileSize + 8 + jx;
          const footY = (ty + 1) * tileSize + jy;
          drawables.push({
            sortY: depthOf(footX, footY),
            draw: () => k.drawSprite("tree_pine", pxPos, pyPos, 1, bbAngle, footX, footY),
          });
        }
      }
    }

    for (const bench of parkBenches) {
      if (bench.tx < startX - 1 || bench.tx > endX + 1 || bench.ty < startY - 1 || bench.ty > endY + 1) continue;
      const bx = bench.tx * tileSize;
      const by = bench.ty * tileSize + 3;
      const footX = bx + 8;
      const footY = (bench.ty + 1) * tileSize;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("park_bench", bx, by, 1, bbAngle, footX, footY),
      });
    }

    // Standing park athletic props (basketball hoops, soccer goals, baseball backstops, swing sets & slides)
    for (const prop of parkFeatures.props) {
      if (prop.tx < startX - 2 || prop.tx > endX + 2 || prop.ty < startY - 2 || prop.ty > endY + 2) continue;
      const pxPos = prop.tx * tileSize + (prop.offsetX || 0);
      const pyPos = prop.ty * tileSize + (prop.offsetY || 0);
      const footX = prop.tx * tileSize + 8;
      const footY = prop.ty * tileSize + (prop.sortYOffset ?? tileSize);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite(prop.sprite, pxPos, pyPos, 1, bbAngle, footX, footY),
      });
    }

    // Spooky Graveyard Props (tombstones, obelisks, crypts, gnarled trees, iron gates, pumpkins & black cats!)
    for (const prop of graveyardFeatures.props) {
      if (prop.tx < startX - 2 || prop.tx > endX + 2 || prop.ty < startY - 2 || prop.ty > endY + 2) continue;
      const pxPos = prop.tx * tileSize + (prop.offsetX || 0);
      const pyPos = prop.ty * tileSize + (prop.offsetY || 0);
      const spr = prop.animated ? `${prop.sprite}_${animFrame}` : prop.sprite;
      const footX = prop.tx * tileSize + 8;
      const footY = prop.ty * tileSize + (prop.sortYOffset ?? tileSize);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite(spr, pxPos, pyPos, 1, bbAngle, footX, footY),
      });
    }

    // Spooky Floating Ghosts drifting & bobbing around graveyard tombstones & crypts!
    const tSec = playerState.elapsedTime;
    const fastFlapFrame = Math.floor(tSec * 6) % 2;
    for (const g of graveyardFeatures.ghosts) {
      if (g.tx < startX - 3 || g.tx > endX + 3 || g.ty < startY - 3 || g.ty > endY + 3) continue;
      const gp = getGraveyardGhostPos(g, tSec, tileSize);
      const gx = gp.x;
      const gy = gp.y;
      const gFrame = (animFrame + g.variant) % 2;
      drawables.push({
        sortY: depthOf(gx + 7, gy + 18),
        draw: () => {
          k.drawRect({
            pos: k.vec2(gx + 3, gy + 17),
            width: 8,
            height: 2,
            color: k.rgb(22, 28, 42),
            opacity: 0.32,
          });
          k.drawSprite(`grave_ghost_${gFrame}`, gx, gy, 1, bbAngle, gx + 7, gy + 18);
        },
      });
    }

    for (const reed of shoreReeds) {
      if (reed.tx < startX - 1 || reed.tx > endX + 1 || reed.ty < startY - 1 || reed.ty > endY + 1) continue;
      const rx = reed.tx * tileSize + 2;
      const ry = reed.ty * tileSize - 1;
      const footX = rx + 6;
      const footY = (reed.ty + 1) * tileSize;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("shore_reed", rx, ry, 1, bbAngle, footX, footY),
      });
    }

    for (const hy of hydrants) {
      if (hy.tx < startX - 1 || hy.tx > endX + 1 || hy.ty < startY - 1 || hy.ty > endY + 1) continue;
      const hx = hy.tx * tileSize + 3;
      const hyY = hy.ty * tileSize + 1;
      const footX = hx + 5;
      const footY = (hy.ty + 1) * tileSize;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("prop_hydrant", hx, hyY, 1, bbAngle, footX, footY),
      });
    }

    // Crunchy Golden-Hour Autumn Leaf Piles along curbs & sidewalks!
    for (const pile of leafPiles) {
      if (pile.tx < startX - 1 || pile.tx > endX + 1 || pile.ty < startY - 1 || pile.ty > endY + 1) continue;
      const lx = pile.tx * tileSize - 1;
      const ly = pile.ty * tileSize + 2;
      const footX = pile.tx * tileSize + 8;
      const footY = pile.ty * tileSize + 12;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite(`leaf_pile_${pile.variant}`, lx, ly, 1, bbAngle, footX, footY),
      });
    }

    // Lush Green Boxwood Garden Shrubs tucked beside neighborhood homes
    for (const sh of gardenShrubs) {
      if (sh.tx < startX - 1 || sh.tx > endX + 1 || sh.ty < startY - 1 || sh.ty > endY + 1) continue;
      const sx = sh.tx * tileSize + 2;
      const sy = sh.ty * tileSize + 4;
      const footX = sh.tx * tileSize + 8;
      const footY = sh.ty * tileSize + 14;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("garden_shrub", sx, sy, 1, bbAngle, footX, footY),
      });
    }

    // Vintage Curved-Arm Glowing Street Lamps casting warm golden lantern pools
    for (const lamp of streetLamps) {
      if (lamp.tx < startX - 2 || lamp.tx > endX + 2 || lamp.ty < startY - 2 || lamp.ty > endY + 2) continue;
      const lx = lamp.tx * tileSize + 3;
      const ly = lamp.ty * tileSize - 10;
      const footX = lamp.tx * tileSize + 8;
      const footY = lamp.ty * tileSize + 14;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("street_lamp", lx, ly, 1, bbAngle, footX, footY),
      });
    }

    // Active Street Signs (upright billboarded in Hard Mode + bobbing prompt bubble when player approaches!)
    const playerTileXNow = Math.floor(playerState.x / tileSize);
    const playerTileYNow = Math.floor(playerState.y / tileSize);
    const nearestPromptSign = streetSignSystem.findNearbySign(playerTileXNow, playerTileYNow, 3.6);
    const visibleSigns = streetSignSystem.queryVisibleSigns(startX - 1, startY - 1, endX + 1, endY + 1);
    const signPromptBob = Math.round(Math.sin(tSec * 6) * 1.5);

    for (const ss of visibleSigns) {
      const sx = ss.tx * tileSize + 2;
      const sy = ss.ty * tileSize - 5;
      const footX = sx + 6;
      const footY = (ss.ty + 1) * tileSize;
      const isChecked = questSystem.state.checkedSigns.has(ss.id);
      const isNearestPrompt = nearestPromptSign && nearestPromptSign.sign.id === ss.id;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          k.drawSprite(isChecked ? "street_sign_checked" : "street_sign", sx, sy, 1, bbAngle, footX, footY);
          if (isNearestPrompt) {
            k.drawSprite("street_sign_prompt", sx + 1, sy - 11 + signPromptBob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Fading sidewalk chalk directional arrow right after checking a street sign!
    if (activeChalkArrow) {
      const len = Math.hypot(activeChalkArrow.dx, activeChalkArrow.dy) || 1;
      const ux = activeChalkArrow.dx / len;
      const uy = activeChalkArrow.dy / len;
      const basePxX = activeChalkArrow.tx * tileSize + tileSize / 2;
      const basePxY = activeChalkArrow.ty * tileSize + tileSize / 2;
      const alpha = Math.min(0.92, activeChalkArrow.timer * 0.5);
      const slide = (tSec * 14) % 10;
      for (let i = 0; i < 3; i++) {
        const dist = 10 + i * 9 + slide;
        const ax = Math.round(basePxX + ux * dist);
        const ay = Math.round(basePxY + uy * dist);
        k.drawRect({
          pos: k.vec2(ax - 3, ay - 3),
          width: 6,
          height: 6,
          color: k.rgb(25, 58, 40),
          opacity: alpha * 0.75,
        });
        k.drawRect({
          pos: k.vec2(ax - 2, ay - 2),
          width: 4,
          height: 4,
          color: k.rgb(244, 211, 94),
          opacity: alpha,
        });
      }
    }

    for (const car of parkedCars) {
      if (car.tx < startX - 1 || car.tx > endX + 1 || car.ty < startY - 1 || car.ty > endY + 1) continue;
      const cx = car.tx * tileSize + 1;
      const cy = car.ty * tileSize - 1;
      drawables.push({
        sortY: depthOf(cx + 7, (car.ty + 1) * tileSize),
        draw: () => k.drawSprite(car.sprite, cx, cy),
      });
    }

    // Phase 3: Landmark NPCs with idle bounce + floating '!' quest objective bubble
    const activeTarget = questSystem.getActiveObjectiveTarget();
    for (const npc of questSystem.npcs) {
      if (
        npc.walkTileX < startX - 2 ||
        npc.walkTileX > endX + 2 ||
        npc.walkTileY < startY - 2 ||
        npc.walkTileY > endY + 2
      ) {
        continue;
      }
      const nx = npc.walkTileX * tileSize + tileSize / 2;
      const ny = npc.walkTileY * tileSize + tileSize / 2;
      const idleBob = Math.sin(playerState.elapsedTime * 3 + npc.walkTileX) > 0.6 ? -1 : 0;
      const isQuestTarget = activeTarget && activeTarget.landmarkId === npc.id;
      const bubbleBob = Math.sin(playerState.elapsedTime * 6) * 2;

      drawables.push({
        sortY: depthOf(nx, ny + 4),
        draw: () => {
          k.drawSprite("landmark_sign", nx + 7, ny - 12, 1, bbAngle, nx + 14, ny + 4);
          k.drawSprite(npc.npcSprite, nx - 11, ny - 21 + idleBob, 1, bbAngle, nx, ny + 4);
          if (isQuestTarget) {
            k.drawSprite("quest_bubble", nx - 5, ny - 34 + bubbleBob, 1, bbAngle, nx, ny + 4);
          }
        },
      });
    }

    // Phase 3: Hidden Wooden Chests (e.g. Quest 2 Little Free Library)
    for (const chest of questSystem.interactables) {
      if (
        chest.tileX < startX - 2 ||
        chest.tileX > endX + 2 ||
        chest.tileY < startY - 2 ||
        chest.tileY > endY + 2
      ) {
        continue;
      }
      const cx = chest.tileX * tileSize;
      const cy = chest.tileY * tileSize;
      const footX = cx + 8;
      const footY = cy + tileSize;
      const isQuestTarget = activeTarget && activeTarget.landmarkId === null && !chest.opened;
      const bubbleBob = Math.sin(playerState.elapsedTime * 6) * 2;

      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          k.drawSprite(chest.opened ? "chest_open" : "chest_closed", cx, cy, 1, bbAngle, footX, footY);
          if (isQuestTarget) {
            k.drawSprite("quest_bubble", cx + 3, cy - 13 + bubbleBob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    for (const d of groundDrops) {
      const bounce = Math.abs(Math.sin(d.age * 7)) * 3;
      drawables.push({
        sortY: depthOf(d.x, d.y + 4),
        draw: () => k.drawSprite(d.kind === "coin" ? "drop_coin" : "drop_acorn", d.x - 4, d.y - 4 - bounce, 1, bbAngle, d.x, d.y + 4),
      });
    }

    // Roving Wild Newton Turkeys (strutting, puffing autumn tail fans & gobbling!)
    for (const tk of streetLife.turkeys) {
      const tkTx = tk.x / tileSize;
      const tkTy = tk.y / tileSize;
      if (tkTx < startX - 2 || tkTx > endX + 2 || tkTy < startY - 2 || tkTy > endY + 2) continue;
      const isPuffed = tk.puffedTimer > 0;
      const step = Math.floor(tk.animTimer) % 2;
      const spr = isPuffed
        ? `turkey_puff_${tk.facing}`
        : `turkey_${tk.facing}_${step}`;
      const drawW = isPuffed ? 20 : 18;
      const txPx = Math.round(tk.x - drawW / 2);
      const tyPx = Math.round(tk.y - 16);
      const footX = Math.round(tk.x);
      const footY = Math.round(tk.y + 2);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          k.drawSprite(spr, txPx, tyPx, 1, bbAngle, footX, footY);
          if (tk.gobbleBubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 10 + tk.x) * 1.2);
            const bSpr = atlas.bubble_gobble;
            const bwLog = bSpr ? (bSpr.width * (bSpr.__pixelScale || 0.5)) : 20;
            k.drawSprite("bubble_gobble", Math.round(footX - bwLog / 2), tyPx - 11 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Annoying Sidewalk Protestors waving big picket signs, shouting chants & getting in Liam's way!
    for (const pr of streetLife.protestors) {
      const prTx = pr.x / tileSize;
      const prTy = pr.y / tileSize;
      if (prTx < startX - 2 || prTx > endX + 2 || prTy < startY - 2 || prTy > endY + 2) continue;
      const shoutFrame = pr.bubbleTimer > 0 ? Math.floor(pr.animTimer) % 2 : (Math.floor(pr.animTimer * 0.6) % 2);
      const spr = `protestor_${pr.variant}_${pr.facing}_${shoutFrame}`;
      const pxDraw = Math.round(pr.x - 12);
      const pyDraw = Math.round(pr.y - 28);
      const footX = Math.round(pr.x);
      const footY = Math.round(pr.y + 3);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          k.drawSprite(spr, pxDraw, pyDraw, 1, bbAngle, footX, footY);
          if (pr.bubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 9 + pr.anchorX) * 1.2);
            const bKey = pr.bubbleSprite || `bubble_protest_${pr.chantIndex}`;
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? (bSpr.width * (bSpr.__pixelScale || 0.5)) : 32;
            k.drawSprite(bKey, Math.round(footX - bwLog / 2), pyDraw - 10 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Spooky Graveyard Characters (Rattling Skeletons, Graveyard Phantoms & Pumpkin Ghouls!)
    for (const sp of streetLife.spookyChars || []) {
      const spTx = sp.x / tileSize;
      const spTy = sp.y / tileSize;
      if (spTx < startX - 2 || spTx > endX + 2 || spTy < startY - 2 || spTy > endY + 2) continue;
      const step = Math.floor(sp.animTimer) % 2;
      const spr = `spooky_${sp.kind}_${sp.facing}_${step}`;
      const floatBob = sp.kind === "phantom" ? Math.round(Math.sin(tSec * 5 + sp.homeX) * 2) : 0;
      const sxDraw = Math.round(sp.x - 11);
      const syDraw = Math.round(sp.y - 24 + floatBob);
      const footX = Math.round(sp.x);
      const footY = Math.round(sp.y + 3);
      const startledBlink = sp.spookTimer > 0 && Math.floor(tSec * 14) % 2 === 0;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          if (!startledBlink) {
            k.drawSprite(spr, sxDraw, syDraw, 1, bbAngle, footX, footY);
          }
          if (sp.bubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 9 + sp.homeX) * 1.2);
            const bKey = sp.bubbleSprite || "bubble_boo";
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? (bSpr.width * (bSpr.__pixelScale || 0.5)) : 24;
            k.drawSprite(bKey, Math.round(footX - bwLog / 2), syDraw - 10 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    drawables.push({
      sortY: depthOf(playerState.x, playerState.y + 4),
      draw: () => {
        for (const p of dustPuffs) {
          const tint = p.tint || [244, 240, 224];
          k.drawRect({
            pos: k.vec2(p.x - 1, p.y - 1),
            width: 3,
            height: 3,
            color: k.rgb(tint[0], tint[1], tint[2]),
            opacity: Math.max(0.1, p.life * 3),
          });
        }
        drawHero();
      },
    });

    drawables.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawables) item.draw();

    for (const p of leafParticles) {
      k.drawRect({
        pos: k.vec2(p.x, p.y),
        width: p.w || 2,
        height: p.h || 2,
        color: k.rgb(...p.shade),
        opacity: Math.min(1, p.life * 2.5),
      });
    }

    // Overhead Spooky Graveyard Atmosphere: flapping pixel bats, glowing will-o'-the-wisps & drifting silver mist!
    for (const w of graveyardFeatures.wisps) {
      if (w.tx < startX - 2 || w.tx > endX + 2 || w.ty < startY - 2 || w.ty > endY + 2) continue;
      const wx = Math.round(w.tx * tileSize + 4 + Math.sin(tSec * w.speed + w.phase) * 7);
      const wy = Math.round(w.ty * tileSize + Math.cos(tSec * w.speed * 1.3 + w.phase) * 5 - 3);
      k.drawSprite(`grave_wisp_${animFrame}`, wx, wy);
    }
    for (const b of graveyardFeatures.bats) {
      if (b.tx < startX - 3 || b.tx > endX + 3 || b.ty < startY - 3 || b.ty > endY + 3) continue;
      const bx = Math.round(b.tx * tileSize + Math.cos(tSec * b.speed + b.phase) * b.radiusX);
      const by = Math.round(b.ty * tileSize - 12 + Math.sin(tSec * b.speed * 1.4 + b.phase) * b.radiusY);
      k.drawSprite(`grave_bat_${fastFlapFrame}`, bx, by);
    }
    // Gentle drifting eerie silver-lavender ground fog wisps strictly over visible graveyard tiles
    for (let ty = startY; ty <= endY; ty += 3) {
      const rowOff = ty * mapW;
      for (let tx = startX; tx <= endX; tx += 4) {
        if (graveyardFeatures.graveyardGrid[rowOff + tx] === 0) continue;
        const drift = ((tSec * 7 + tx * 11 + ty * 17) % 32) - 16;
        const fx = Math.round(tx * tileSize + drift);
        const fy = ty * tileSize + 8;
        k.drawRect({
          pos: k.vec2(fx, fy),
          width: 24,
          height: 3,
          color: k.rgb(198, 214, 240),
          opacity: 0.14,
        });
      }
    }

    // Subtle on-screen golden waypoint indicator — ONLY active in GPS Assist mode!
    if (questSystem.state.gpsAssist && activeTarget) {
      const targetPxX = activeTarget.tileX * tileSize + tileSize / 2;
      const targetPxY = activeTarget.tileY * tileSize + tileSize / 2;
      const dx = targetPxX - cam.x;
      const dy = targetPxY - cam.y;
      if (Math.abs(dx) > VIEW_W / 2 - 14 || Math.abs(dy) > VIEW_H / 2 - 14) {
        const angle = Math.atan2(dy, dx);
        const edgeX = cam.x + Math.max(-(VIEW_W / 2 - 14), Math.min(VIEW_W / 2 - 14, Math.cos(angle) * 145));
        const edgeY = cam.y + Math.max(-(VIEW_H / 2 - 16), Math.min(VIEW_H / 2 - 16, Math.sin(angle) * 76));
        const bob = Math.sin(playerState.elapsedTime * 6) * 1.5;
        const wx = Math.round(edgeX + Math.cos(angle) * bob);
        const wy = Math.round(edgeY + Math.sin(angle) * bob);
        k.drawRect({ pos: k.vec2(wx - 4, wy - 4), width: 9, height: 9, color: k.rgb(29, 34, 40) });
        k.drawRect({ pos: k.vec2(wx - 3, wy - 3), width: 7, height: 7, color: k.rgb(244, 211, 94) });
        k.drawRect({
          pos: k.vec2(wx - 1 + Math.round(Math.cos(angle) * 2), wy - 1 + Math.round(Math.sin(angle) * 2)),
          width: 3,
          height: 3,
          color: k.rgb(36, 87, 61),
        });
      }
    }

    if (showDebug) {
      for (let ty = startY; ty <= endY; ty++) {
        const rowOffset = ty * mapW;
        for (let tx = startX; tx <= endX; tx++) {
          const idx = rowOffset + tx;
          if (collisionLayer[idx] === 1) {
            k.drawRect({
              pos: k.vec2(tx * tileSize, ty * tileSize),
              width: tileSize,
              height: tileSize,
              color: k.rgb(235, 64, 52),
              opacity: 0.3,
            });
          }
          k.drawRect({
            pos: k.vec2(tx * tileSize, ty * tileSize),
            width: tileSize,
            height: tileSize,
            fill: false,
            outline: { width: 0.5, color: k.rgb(0, 0, 0), opacity: 0.2 },
          });
        }
      }
      k.drawRect({
        pos: k.vec2(playerState.x - DEFAULT_HITBOX.width / 2, playerState.y - DEFAULT_HITBOX.height / 2),
        width: DEFAULT_HITBOX.width,
        height: DEFAULT_HITBOX.height,
        color: k.rgb(60, 240, 110),
        opacity: 0.35,
        outline: { width: 1, color: k.rgb(60, 240, 110) },
      });
    }
  });

  window.__NEIGHBORHOOD_EXPLORER__ = {
    rendererMode: k.mode,
    worldMap,
    landmarks,
    quests,
    questSystem,
    streetSignSystem,
    streetLife,
    playerState,
  };
}

boot().catch((err) => {
  console.error("Neighborhood Explorer failed to start:", err);
  const banner = document.getElementById("street-name");
  if (banner) banner.textContent = `Load error: ${err.message}`;
});
