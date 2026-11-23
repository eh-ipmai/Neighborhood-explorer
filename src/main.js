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
} from "./audio.js";
import {
  buildSnesSpriteAtlas,
  bakeSnesBuildingCanvas,
  normalizeAddress,
} from "./tileset.js";

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
  return id === 2 || id === 3 || id === 4;
}

/**
 * Deterministic placement of decorative 16-bit SNES oak trees on open grass tiles,
 * glowing WALK signal posts, red fire hydrants, and parked retro cars in parking lots.
 */
function buildNeighborhoodProps(worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const treeGrid = new Uint8Array(width * height);
  const walkSignals = [];
  const hydrants = [];
  const parkedCars = [];
  const signalPlacedCells = new Set();
  const carSprites = ["car_red", "car_sage", "car_blue"];

  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const idx = ty * width + tx;
      const cur = base[idx];

      if (cur === 8 && base[(ty - 1) * width + tx] !== 8 && base[(ty + 1) * width + tx] === 8) {
        const h = ((tx * 37 + ty * 91) >>> 0) % 5;
        if (h === 0 || h === 2) {
          parkedCars.push({ tx, ty, sprite: carSprites[(tx + ty) % carSprites.length] });
        }
      }

      if (cur === 0 || cur === 7) {
        const hash = ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
        const threshold = cur === 7 ? 15 : 6;
        if (hash % 100 < threshold) {
          let clear = true;
          for (let dy = -1; dy <= 1 && clear; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nId = base[(ty + dy) * width + (tx + dx)];
              if (nId !== 0 && nId !== 7) {
                clear = false;
                break;
              }
            }
          }
          if (clear && treeGrid[(ty - 1) * width + tx] === 0 && treeGrid[ty * width + (tx - 1)] === 0) {
            treeGrid[idx] = 1;
          }
        }
      }

      if (cur === 1) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        const w = base[ty * width + (tx - 1)];
        const e = base[ty * width + (tx + 1)];
        const nearCrosswalk = n === 4 || s === 4 || w === 4 || e === 4;

        if (nearCrosswalk) {
          const clusterKey = `${Math.floor(tx / 5)},${Math.floor(ty / 5)}`;
          if (!signalPlacedCells.has(clusterKey)) {
            signalPlacedCells.add(clusterKey);
            walkSignals.push({ tx, ty });
          } else if (((tx * 31 + ty * 17) & 7) === 0) {
            hydrants.push({ tx, ty });
          }
        } else if (
          (isRoadTile(s) || isRoadTile(n)) &&
          (isRoadTile(e) || isRoadTile(w)) &&
          ((tx * 19 + ty * 37) % 11 === 0)
        ) {
          hydrants.push({ tx, ty });
        }
      }
    }
  }

  return { treeGrid, walkSignals, hydrants, parkedCars };
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
  const { treeGrid, walkSignals, hydrants, parkedCars } = buildNeighborhoodProps(worldMap);
  const buildingIndex = buildBuildingSpatialIndex(buildings);

  const hasPerAddressBuildings = buildings.length > 0;

  const bakedHouseCache = new Map();
  let paintRevision = 1;
  function getBakedHouse(building) {
    let entry = bakedHouseCache.get(building.id);
    if (!entry) {
      const baked = bakeSnesBuildingCanvas(building, tileSize, normalizedColorMap);
      entry = { ...baked, version: paintRevision };
      bakedHouseCache.set(building.id, entry);
    }
    return entry;
  }
  function invalidateHouseSprite(building) {
    paintRevision++;
    bakedHouseCache.delete(building.id);
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
    moving: false,
    walkTimer: 0,
    stepSoundCooldown: 0,
    lookTimer: 0,
    lookSavedFacing: "down",
    safeCrossingTimer: 0,
    lastLookAwardTileKey: "",
    lastLookAwardTime: -99,
    lastGrassTileKey: "",
    lastFogTileKey: "",
    wasFasterActive: false,
    elapsedTime: 0,
  };

  // Overhead Item Fanfare queue & active timer
  const fanfareQueue = [];
  let activeFanfare = null; // { itemMeta, sourceLabel, timer }

  const dustPuffs = [];
  const leafParticles = [];
  const groundDrops = [];
  let dustCooldown = 0;

  let showDebug = false;
  let lastStreetName = "";

  const k = createRenderer({
    width: VIEW_W,
    height: VIEW_H,
    canvas: document.getElementById("game-canvas"),
    background: [30, 56, 36],
  });

  const atlas = buildSnesSpriteAtlas("snes_classic");
  await k.registerSprites(atlas);

  function resetToHome() {
    playerState.x = spawnTile.x * tileSize + tileSize / 2;
    playerState.y = spawnTile.y * tileSize + tileSize / 2;
    playerState.facing = "down";
    playerState.lookTimer = 0;
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

  function triggerLookOrInteract() {
    if (ui?.isMapOpen() || ui?.isPaintOpen()) return;

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

    // 1. Check if standing right next to a Landmark NPC or Wooden Chest
    const nearby = questSystem.findNearbyInteraction(tx, ty);
    if (nearby) {
      const outcome =
        nearby.kind === "chest"
          ? questSystem.interactWithChest(nearby.target.id)
          : questSystem.interactWithNpc(nearby.target.id);
      if (outcome) {
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
    if (playerState.lookTimer > 0) return;
    const result = safety.inspectCrossingContext(tx, ty);

    playerState.lookSavedFacing = playerState.facing;
    playerState.lookTimer = LOOK_DURATION_SEC;

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

    if (result.context !== "clear") {
      playerState.safeCrossingTimer = SAFE_CROSSING_DURATION_SEC;
    }

    playLookBothWaysChime(canAwardXP);
    ui?.showSafetyToast(
      canAwardXP ? result.message : "👀 Looked Left & Right — Stay Safe!"
    );
  }

  function togglePaperMap() {
    if (ui?.isDialogueOpen() || ui?.isPaintOpen()) return;
    const nextOpen = !ui?.isMapOpen();
    ui?.setMapModalOpen(nextOpen, questSystem);
    if (nextOpen) {
      const tx = Math.floor(playerState.x / tileSize);
      const ty = Math.floor(playerState.y / tileSize);
      paperMap.renderToCanvas(ui.getMapCanvas(), {
        questSystem,
        playerTileX: tx,
        playerTileY: ty,
        timeSec: playerState.elapsedTime,
      });
    }
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
    onResetProgress: () => {
      questSystem.resetProgress();
      questSystem.revealFogAtTile(spawnTile.x, spawnTile.y, 2);
      resetToHome();
      ui?.refreshMapSidePanels(questSystem);
      ui?.showSafetyToast("Adventure progress reset!");
    },
    onTextBlip: playTextBlip,
  });

  k.onKeyPress("c", () => {
    showDebug = !showDebug;
  });
  k.onKeyPress("h", resetToHome);
  k.onKeyPress("m", togglePaperMap);
  k.onKeyPress("tab", togglePaperMap);
  k.onKeyPress("p", openPaintForNearbyHouse);
  k.onKeyPress("space", triggerLookOrInteract);
  k.onKeyPress("e", triggerLookOrInteract);
  k.onKeyPress("enter", triggerLookOrInteract);

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

  function spawnTallGrassRustle(wx, wy) {
    playGrassRustle();
    for (let i = 0; i < 5; i++) {
      leafParticles.push({
        x: wx + (Math.random() * 8 - 4),
        y: wy + (Math.random() * 4 - 2),
        vx: (Math.random() - 0.5) * 32,
        vy: -16 - Math.random() * 18,
        life: 0.35 + Math.random() * 0.2,
        shade: i % 2 === 0 ? [103, 184, 82] : [149, 217, 106],
      });
    }
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

    // Animate Folded Paper Map pulsing beacon while map modal is open
    if (ui.isMapOpen()) {
      const tx = Math.floor(playerState.x / tileSize);
      const ty = Math.floor(playerState.y / tileSize);
      paperMap.renderToCanvas(ui.getMapCanvas(), {
        questSystem,
        playerTileX: tx,
        playerTileY: ty,
        timeSec: playerState.elapsedTime,
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

    if (ui.isDialogueOpen() || ui.isPaintOpen()) {
      playerState.moving = false;
      return;
    }

    if (playerState.safeCrossingTimer > 0) {
      playerState.safeCrossingTimer = Math.max(0, playerState.safeCrossingTimer - dt);
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

    if (playerState.lookTimer > 0) {
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
      const baseSafetyMult = safety.getSpeedMultiplier(
        curTileType,
        input.wantsFaster,
        playerState.safeCrossingTimer > 0
      );
      const effectiveMult = baseSafetyMult > 1 ? Math.max(baseSafetyMult, gear.mult) : 1;
      isFasterNow = effectiveMult > 1 && (input.x !== 0 || input.y !== 0);

      if (isFasterNow && !playerState.wasFasterActive) {
        playBoostWhoosh();
      }
      playerState.wasFasterActive = isFasterNow;

      const moved = moveWithCollision(
        playerState,
        input,
        dt,
        collider.isBoxBlocked,
        { speed: PLAYER_SPEED_PX * effectiveMult }
      );
      playerState.x = moved.x;
      playerState.y = moved.y;
      playerState.facing = moved.facing;
      playerState.moving = moved.moving;

      if (moved.moving) {
        playerState.walkTimer += dt * (isFasterNow ? 14 : 9);
        playerState.stepSoundCooldown -= dt;
        if (playerState.stepSoundCooldown <= 0) {
          const onGrass = curTileType === "grass" || curTileType === "tall_grass";
          playStepTick(onGrass, isFasterNow);
          playerState.stepSoundCooldown = isFasterNow ? 0.15 : 0.24;
        }
        if (isFasterNow) {
          dustCooldown -= dt;
          if (dustCooldown <= 0) {
            dustPuffs.push({
              x: playerState.x + (Math.random() * 5 - 2.5),
              y: playerState.y + 4,
              life: 0.28,
            });
            dustCooldown = 0.07;
          }
        }
      } else {
        playerState.walkTimer = 0;
        playerState.stepSoundCooldown = 0;
      }
    }

    cam = clampCamera(playerState.x, playerState.y);
    k.setCamPos(cam.x, cam.y);

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
          if (ev.rewardItem) {
            enqueueFanfare([
              { itemId: ev.rewardItem, sourceLabel: `Quest Reward: ${ev.quest.title}` },
            ]);
          }
        } else if (ev.type === "step_advanced") {
          playLandmarkDiscover();
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

    if (streetZone && streetZone.name !== lastStreetName) {
      lastStreetName = streetZone.name;
      playStreetBannerChime();
    }

    const nearbyHouses = buildingIndex.queryBounds(tx - 5, ty - 5, tx + 5, ty + 5);

    ui.updateHUD({
      tileX: tx,
      tileY: ty,
      tileType,
      streetZone,
      originName: worldMap.origin?.name,
      nearestLandmark: findNearestLandmark(tx, ty),
      nearestBuilding: findNearestBuilding(nearbyHouses, tx, ty),
      nearbyInteraction: questSystem.findNearbyInteraction(tx, ty),
      questHint: questSystem.formatTargetHint(tx, ty),
      gearLabel: gear.label,
      debugEnabled: showDebug,
      muted: isMuted(),
      safetyXP: questSystem.state.safetyXP,
      coins: questSystem.state.coins,
      acorns: questSystem.state.acorns,
      isFasterActive: isFasterNow,
      safeCrossingActive: playerState.safeCrossingTimer > 0,
    });
  });

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= mapW || ty >= mapH) return 0;
    return baseLayer[ty * mapW + tx];
  }

  function drawGroundTile(tx, ty, tileId, animFrame) {
    const pxPos = tx * tileSize;
    const pyPos = ty * tileSize;
    const pattern = (tx * 7 + ty * 13) & 15;

    if (tileId === 0 || (tileId === 5 && hasPerAddressBuildings)) {
      if (tileId === 0 && pattern === 0) {
        k.drawSprite(`grass_flower_${animFrame}`, pxPos, pyPos);
      } else {
        k.drawSprite(pattern % 2 === 0 ? "grass_0" : "grass_1", pxPos, pyPos);
      }
      return;
    }

    if (tileId === 7) {
      k.drawSprite(`tall_grass_${animFrame}`, pxPos, pyPos);
      return;
    }

    if (tileId === 6) {
      k.drawSprite(`water_${animFrame}`, pxPos, pyPos);
      return;
    }

    if (tileId === 8) {
      const above = tileAt(tx, ty - 1);
      k.drawSprite(above !== 8 ? "parking_0" : "parking_1", pxPos, pyPos);
      return;
    }

    const n = tileAt(tx, ty - 1);
    const s = tileAt(tx, ty + 1);
    const w = tileAt(tx - 1, ty);
    const e = tileAt(tx + 1, ty);

    if (tileId === 1) {
      k.drawSprite((tx + ty) % 2 === 0 ? "sidewalk_0" : "sidewalk_1", pxPos, pyPos);
      if (isRoadTile(s)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 13), width: 16, height: 1, color: k.rgb(245, 240, 228) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 14), width: 16, height: 2, color: k.rgb(138, 130, 116) });
      } else if (s === 0 || s === 7) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: k.rgb(66, 98, 52), opacity: 0.55 });
      }
      if (isRoadTile(n)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 2, color: k.rgb(138, 130, 116) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 2), width: 16, height: 1, color: k.rgb(245, 240, 228) });
      } else if (n === 0 || n === 7) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: k.rgb(66, 98, 52), opacity: 0.55 });
      }
      if (isRoadTile(e)) {
        k.drawRect({ pos: k.vec2(pxPos + 13, pyPos), width: 1, height: 16, color: k.rgb(245, 240, 228) });
        k.drawRect({ pos: k.vec2(pxPos + 14, pyPos), width: 2, height: 16, color: k.rgb(138, 130, 116) });
      } else if (e === 0 || e === 7) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: k.rgb(66, 98, 52), opacity: 0.55 });
      }
      if (isRoadTile(w)) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 2, height: 16, color: k.rgb(138, 130, 116) });
        k.drawRect({ pos: k.vec2(pxPos + 2, pyPos), width: 1, height: 16, color: k.rgb(245, 240, 228) });
      } else if (w === 0 || w === 7) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: k.rgb(66, 98, 52), opacity: 0.55 });
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
        if (tw === 2 || tw === 3) ewTraffic++;
        if (te === 2 || te === 3) ewTraffic++;
        if (tn === 2 || tn === 3) nsTraffic++;
        if (ts === 2 || ts === 3) nsTraffic++;
      }
      k.drawSprite(ewTraffic >= nsTraffic ? "crosswalk_h" : "crosswalk_v", pxPos, pyPos);
      return;
    }

    if (tileId === 2 || tileId === 3) {
      k.drawSprite(tileId === 3 ? "road_main_base" : "road_res_base", pxPos, pyPos);

      const nRoad = isRoadTile(n);
      const sRoad = isRoadTile(s);
      const wRoad = isRoadTile(w);
      const eRoad = isRoadTile(e);

      if (!nRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 16, height: 1, color: k.rgb(36, 40, 48) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 2), width: 16, height: 1, color: k.rgb(224, 230, 238), opacity: 0.78 });
      }
      if (!sRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 15), width: 16, height: 1, color: k.rgb(36, 40, 48) });
        k.drawRect({ pos: k.vec2(pxPos, pyPos + 13), width: 16, height: 1, color: k.rgb(224, 230, 238), opacity: 0.78 });
      }
      if (!wRoad) {
        k.drawRect({ pos: k.vec2(pxPos, pyPos), width: 1, height: 16, color: k.rgb(36, 40, 48) });
        k.drawRect({ pos: k.vec2(pxPos + 2, pyPos), width: 1, height: 16, color: k.rgb(224, 230, 238), opacity: 0.78 });
      }
      if (!eRoad) {
        k.drawRect({ pos: k.vec2(pxPos + 15, pyPos), width: 1, height: 16, color: k.rgb(36, 40, 48) });
        k.drawRect({ pos: k.vec2(pxPos + 13, pyPos), width: 1, height: 16, color: k.rgb(224, 230, 238), opacity: 0.78 });
      }

      if (tileId === 2) {
        if (wRoad && eRoad && !nRoad && !sRoad && tx % 2 === 0) {
          k.drawRect({ pos: k.vec2(pxPos + 3, pyPos + 7), width: 10, height: 2, color: k.rgb(222, 228, 236), opacity: 0.75 });
        } else if (nRoad && sRoad && !wRoad && !eRoad && ty % 2 === 0) {
          k.drawRect({ pos: k.vec2(pxPos + 7, pyPos + 3), width: 2, height: 10, color: k.rgb(222, 228, 236), opacity: 0.75 });
        }
      } else {
        const nMain = n === 3;
        const sMain = s === 3;
        const wMain = w === 3;
        const eMain = e === 3;
        const n2Main = tileAt(tx, ty - 2) === 3;
        const w2Main = tileAt(tx - 2, ty) === 3;

        if (wMain && eMain && nMain && sMain && !n2Main) {
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 6), width: 16, height: 1, color: k.rgb(232, 190, 74) });
          k.drawRect({ pos: k.vec2(pxPos, pyPos + 9), width: 16, height: 1, color: k.rgb(232, 190, 74) });
        } else if (nMain && sMain && wMain && eMain && !w2Main && n2Main) {
          k.drawRect({ pos: k.vec2(pxPos + 6, pyPos), width: 1, height: 16, color: k.rgb(232, 190, 74) });
          k.drawRect({ pos: k.vec2(pxPos + 9, pyPos), width: 1, height: 16, color: k.rgb(232, 190, 74) });
        } else if (wMain && eMain && !nMain && sMain && tx % 2 === 0) {
          k.drawRect({ pos: k.vec2(pxPos + 4, pyPos + 14), width: 8, height: 1, color: k.rgb(224, 230, 238), opacity: 0.55 });
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

    let sprName;
    if (activeFanfare) {
      sprName = "hero_fanfare";
    } else if (isFasterNow) {
      sprName = `hero_scooter_${playerState.facing}`;
    } else if (!playerState.moving) {
      sprName = `hero_${playerState.facing}_0`;
    } else {
      const step = Math.floor(playerState.walkTimer) % 2 === 0 ? 1 : 2;
      sprName = `hero_${playerState.facing}_${step}`;
    }

    k.drawSprite(sprName, pxPos - 10, pyPos - 19);

    // Overhead Item Fanfare floating item + orbiting golden sparkles!
    if (activeFanfare) {
      const floatBob = Math.sin(playerState.elapsedTime * 6) * 2;
      const itemY = pyPos - 34 + floatBob;
      k.drawSprite(activeFanfare.itemMeta.sprite || "item_badge", pxPos - 6, itemY);

      const angle = playerState.elapsedTime * 4;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        const sx = pxPos - 4 + Math.cos(a) * 11;
        const sy = itemY + 2 + Math.sin(a) * 7;
        k.drawSprite("fanfare_star", sx, sy);
      }
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

    const startX = Math.max(0, Math.floor((cam.x - VIEW_W / 2) / tileSize) - 2);
    const endX = Math.min(mapW - 1, Math.ceil((cam.x + VIEW_W / 2) / tileSize) + 2);
    const startY = Math.max(0, Math.floor((cam.y - VIEW_H / 2) / tileSize) - 2);
    const endY = Math.min(mapH - 1, Math.ceil((cam.y + VIEW_H / 2) / tileSize) + 2);

    // 1. Auto-tiled ground layer
    for (let ty = startY; ty <= endY; ty++) {
      const rowOffset = ty * mapW;
      for (let tx = startX; tx <= endX; tx++) {
        drawGroundTile(tx, ty, baseLayer[rowOffset + tx], animFrame);
      }
    }

    // 2. Y-sorted 16-bit SNES buildings, trees, props, NPCs, wooden chests & hero
    const drawables = [];

    const visibleBuildings = buildingIndex.queryBounds(startX - 1, startY - 1, endX + 1, endY + 1);
    for (const b of visibleBuildings) {
      const { minX, minY, maxX, maxY } = b.bounds;
      if (maxX < startX - 1 || minX > endX + 1 || maxY < startY - 1 || minY > endY + 1) continue;
      const baked = getBakedHouse(b);
      const drawX = minX * tileSize + baked.offsetX;
      const drawY = minY * tileSize + baked.offsetY;
      drawables.push({
        sortY: (maxY + 1) * tileSize,
        draw: () => k.drawCanvas(`house_${b.id}_v${baked.version}`, baked.canvas, drawX, drawY),
      });
    }

    for (let ty = startY; ty <= endY; ty++) {
      const rowOffset = ty * mapW;
      for (let tx = startX; tx <= endX; tx++) {
        if (treeGrid[rowOffset + tx] === 1) {
          const pxPos = tx * tileSize - 4;
          const pyPos = ty * tileSize - 11;
          drawables.push({
            sortY: (ty + 1) * tileSize,
            draw: () => k.drawSprite("tree_oak", pxPos, pyPos),
          });
        }
      }
    }

    const walkSignalBright = playerState.safeCrossingTimer > 0 ? 1 : animFrame;
    for (const sig of walkSignals) {
      if (sig.tx < startX - 1 || sig.tx > endX + 1 || sig.ty < startY - 1 || sig.ty > endY + 1) continue;
      const sx = sig.tx * tileSize - 2;
      const sy = sig.ty * tileSize - 10;
      drawables.push({
        sortY: (sig.ty + 1) * tileSize,
        draw: () => k.drawSprite(`walk_signal_${walkSignalBright}`, sx, sy),
      });
    }

    for (const hy of hydrants) {
      if (hy.tx < startX - 1 || hy.tx > endX + 1 || hy.ty < startY - 1 || hy.ty > endY + 1) continue;
      const hx = hy.tx * tileSize + 3;
      const hyY = hy.ty * tileSize + 1;
      drawables.push({
        sortY: (hy.ty + 1) * tileSize,
        draw: () => k.drawSprite("prop_hydrant", hx, hyY),
      });
    }

    for (const car of parkedCars) {
      if (car.tx < startX - 1 || car.tx > endX + 1 || car.ty < startY - 1 || car.ty > endY + 1) continue;
      const cx = car.tx * tileSize + 1;
      const cy = car.ty * tileSize - 1;
      drawables.push({
        sortY: (car.ty + 1) * tileSize,
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
        sortY: ny + 4,
        draw: () => {
          k.drawSprite(npc.npcSprite, nx - 9, ny - 17 + idleBob);
          if (isQuestTarget) {
            k.drawSprite("quest_bubble", nx - 5, ny - 31 + bubbleBob);
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
      const isQuestTarget = activeTarget && activeTarget.landmarkId === null && !chest.opened;
      const bubbleBob = Math.sin(playerState.elapsedTime * 6) * 2;

      drawables.push({
        sortY: cy + tileSize,
        draw: () => {
          k.drawSprite(chest.opened ? "chest_open" : "chest_closed", cx, cy);
          if (isQuestTarget) {
            k.drawSprite("quest_bubble", cx + 3, cy - 13 + bubbleBob);
          }
        },
      });
    }

    for (const d of groundDrops) {
      const bounce = Math.abs(Math.sin(d.age * 7)) * 3;
      drawables.push({
        sortY: d.y + 4,
        draw: () => k.drawSprite(d.kind === "coin" ? "drop_coin" : "drop_acorn", d.x - 4, d.y - 4 - bounce),
      });
    }

    drawables.push({
      sortY: playerState.y + 4,
      draw: () => {
        for (const p of dustPuffs) {
          k.drawRect({
            pos: k.vec2(p.x - 1, p.y - 1),
            width: 3,
            height: 3,
            color: k.rgb(244, 240, 224),
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
        width: 2,
        height: 2,
        color: k.rgb(...p.shade),
        opacity: Math.min(1, p.life * 2.5),
      });
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
    playerState,
  };
}

boot().catch((err) => {
  console.error("Neighborhood Explorer failed to start:", err);
  const banner = document.getElementById("street-name");
  if (banner) banner.textContent = `Load error: ${err.message}`;
});
