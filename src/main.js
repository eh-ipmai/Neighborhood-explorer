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
  resolveActionIntent,
  LOOK_DURATION_SEC,
  SAFE_CROSSING_DURATION_SEC,
} from "./safety.js";
import {
  createQuestSystem,
  getItemMeta,
  snapToWalkableTile,
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
  playWaterSplash,
  playCoinPickup,
  playBoostWhoosh,
  playItemFanfare,
  playTextBlip,
  playDialogueOpenSfx,
  playDialogueAdvanceSfx,
  playLandmarkDiscover,
  playCurbStopBoop,
  playSpookyChime,
  playSpookyBooSfx,
  playSignpostReadChime,
  playTurkeyGobble,
  playSquirrelChitter,
  playCatMeow,
  playDogBark,
  playAnimalFeedSfx,
  playProtestorShout,
  playAnnoyingJoggerSfx,
  playBumpHurtSfx,
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
  playBotwTeleportOutSfx,
  playBotwTeleportInSfx,
  playSnackTossSfx,
  playChestOpenSfx,
  playMapToggleSfx,
  playPaintHouseSfx,
  playOutfitSwapSfx,
  playNavModeSwitchSfx,
  playAcornPickupSfx,
  playSnackRestockSfx,
} from "./audio.js";
import { createHomeInteriorSystem } from "./house_interior.js";
import {
  buildSnesSpriteAtlas,
  bakeSnesBuildingCanvas,
  bake32BitHouseStack,
  bakeParkFieldCanvas,
  normalizeAddress,
} from "./tileset.js";
import { buildParkFeatures, buildWoodlandTreeGrid, buildCurbAlignedFurniture } from "./parks.js";
import { buildGraveyardFeatures, getGraveyardGhostPos } from "./graveyards.js";
import {
  JOGGER_CHANTS,
  buildStreetLife,
  updateStreetLife,
  isBlockedByStreetLife,
  findNearbyStreetLife,
  findNearbyHungryProtestor,
  findNearbySnackTarget,
  tossSnackAtAnimal,
  interactWithStreetLife,
  performSwordAttack,
  performSiddurDispel,
} from "./streetlife.js";
import { buildRoadTraffic, updateRoadTraffic } from "./traffic.js";
import { buildParkingLotCars } from "./parking_lots.js";
import { computeRoadTileMarkings } from "./road_markings.js";
import { createVectorRoadRenderer } from "./vector_roads.js";
import { getNavigationSubgrid } from "./subgrid.js";
import { getNeighborhoodMeta } from "./neighborhood_meta.js";
import {
  BUILTIN_NEWTON_ID,
  getActiveNeighborhoodId,
  setActiveNeighborhoodId,
  loadNeighborhoodPack,
  saveNeighborhoodPack,
} from "./generator/pack_store.js";
import { validateNeighborhoodPack } from "./generator/pack_builder.js";
import { createNeighborhoodStudio, isEditableElementFocused } from "./studio_ui.js";

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
function buildNeighborhoodProps(
  worldMap,
  parkOccupiedGrid = null,
  graveyardGrid = null,
  spawnTile = null,
  landmarks = [],
  biomeConfig = null
) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const tileSize = worldMap.tileSize || 16;
  const allowLeafPiles = biomeConfig ? Boolean(biomeConfig.hasLeafPiles) : true;
  const subgrid = getNavigationSubgrid(worldMap);
  const useSub = Boolean(subgrid && subgrid.hasVectorRoads);
  const isPropOnVectorRoad = (tx, ty) => {
    if (!useSub) return false;
    const cx = tx * tileSize + tileSize * 0.5;
    const cy = ty * tileSize + tileSize * 0.5;
    if (subgrid.isRoadAtPx(cx, cy)) return true;
    const sx = Math.floor(cx / subgrid.subCellSize);
    const sy = Math.floor(cy / subgrid.subCellSize);
    return subgrid.isSolidAtSub(sx, sy);
  };
  // 0 = none, 1 = regional deciduous tree, 2 = evergreen pine/cypress (real OSM trees prioritized!)
  const treeGrid = buildWoodlandTreeGrid(worldMap, parkOccupiedGrid, graveyardGrid, { landmarks });
  const { streetLamps, hydrants, parkBenches } = buildCurbAlignedFurniture(worldMap, {
    treeGrid,
    parkOccupiedGrid,
    graveyardGrid,
    landmarks,
  });
  const parkedCars = buildParkingLotCars(worldMap, {
    parkOccupiedGrid,
    graveyardGrid,
    spawnTile,
    landmarks,
  });
  const shoreReeds = [];
  const leafPiles = [];
  const leafPileMap = new Map();
  const gardenShrubs = [];

  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const idx = ty * width + tx;
      const cur = base[idx];
      if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) continue;

      // Lakeside cattail reeds on sandy/grassy pond edges
      if ((cur === 10 || cur === 0) && !isPropOnVectorRoad(tx, ty)) {
        const nearWater =
          base[(ty - 1) * width + tx] === 6 ||
          base[(ty + 1) * width + tx] === 6 ||
          base[ty * width + (tx - 1)] === 6 ||
          base[ty * width + (tx + 1)] === 6;
        if (nearWater && ((tx * 53 + ty * 17) % 13 === 0)) {
          shoreReeds.push({ tx, ty });
        }
      }

      // Green boxwood / Bougainvillea garden shrubs tucked beside houses & lawns
      if (cur === 0 && treeGrid[idx] === 0 && (!graveyardGrid || graveyardGrid[idx] === 0) && !isPropOnVectorRoad(tx, ty)) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        const w = base[ty * width + (tx - 1)];
        const e = base[ty * width + (tx + 1)];
        const nearHouse = n === 5 || s === 5 || w === 5 || e === 5;
        if (nearHouse && (((tx * 23 + ty * 47) >>> 0) % 5 === 0)) {
          gardenShrubs.push({ tx, ty });
        }
      }

      // Crunchy autumn leaf piles along road curbs & sidewalks (only in autumn biomes!)
      if (allowLeafPiles && (cur === 2 || cur === 3) && (!graveyardGrid || graveyardGrid[idx] === 0) && !isPropOnVectorRoad(tx, ty)) {
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

      if (allowLeafPiles && cur === 1 && !isPropOnVectorRoad(tx, ty)) {
        const n = base[(ty - 1) * width + tx];
        const s = base[(ty + 1) * width + tx];
        const w = base[ty * width + (tx - 1)];
        const e = base[ty * width + (tx + 1)];
        const nearRoad = isRoadTile(n) || isRoadTile(s) || isRoadTile(w) || isRoadTile(e);
        if (nearRoad && (((tx * 41 + ty * 29) >>> 0) % 13 === 0) && (!graveyardGrid || graveyardGrid[idx] === 0)) {
          const pile = { tx, ty, variant: (tx + ty) & 1, lastScatter: -99 };
          leafPiles.push(pile);
          leafPileMap.set(`${tx},${ty}`, pile);
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

async function loadActiveNeighborhoodData() {
  // 1. Optional URL ?pack=<path-or-url> lets families host or share a portable neighborhood_pack.json!
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const packUrl = params?.get("pack");
  if (packUrl) {
    try {
      const remotePack = await loadJson(packUrl);
      const check = validateNeighborhoodPack(remotePack);
      if (check.valid) {
        await saveNeighborhoodPack(remotePack).catch(() => {});
        if (remotePack.meta?.id) setActiveNeighborhoodId(remotePack.meta.id);
        return {
          worldMap: remotePack.worldMap,
          landmarks: remotePack.landmarks || [],
          quests: remotePack.quests || [],
          baseHouseColors: remotePack.houseColors || {},
          activePack: remotePack,
        };
      }
    } catch (err) {
      console.warn("Could not load ?pack= URL, falling back to local/default neighborhood:", err);
    }
  }

  // 2. Check if user selected a saved custom neighborhood from the in-browser Studio (IndexedDB)
  const requestedId = params?.get("neighborhood") || getActiveNeighborhoodId();
  if (requestedId && requestedId !== BUILTIN_NEWTON_ID) {
    try {
      const savedPack = await loadNeighborhoodPack(requestedId);
      const check = validateNeighborhoodPack(savedPack);
      if (check.valid) {
        setActiveNeighborhoodId(requestedId);
        return {
          worldMap: savedPack.worldMap,
          landmarks: savedPack.landmarks || [],
          quests: savedPack.quests || [],
          baseHouseColors: savedPack.houseColors || {},
          activePack: savedPack,
        };
      }
    } catch (err) {
      console.warn("Could not load saved custom neighborhood, falling back to default:", err);
    }
    setActiveNeighborhoodId(BUILTIN_NEWTON_ID);
  }

  // 3. Default built-in neighborhood from ./data/* (Newton Centre or CLI-generated data/)
  const [worldMap, landmarks, quests, baseHouseColors] = await Promise.all([
    loadJson("./data/world_map.json"),
    loadJson("./data/landmarks.json").catch(() => []),
    loadJson("./data/quests.json").catch(() => []),
    loadJson("./data/house_colors.json").catch(() => ({})),
  ]);
  return {
    worldMap,
    landmarks,
    quests,
    baseHouseColors,
    activePack: null,
  };
}

async function boot() {
  const { worldMap, landmarks, quests, baseHouseColors, activePack } = await loadActiveNeighborhoodData();

  const neighborhoodMeta = getNeighborhoodMeta(worldMap);
  const biomeConfig = neighborhoodMeta.biomeConfig;
  const houseColorsStorageKey = neighborhoodMeta.houseColorsStorageKey || HOUSE_COLORS_STORAGE_KEY;
  const homeAddrLabel = neighborhoodMeta.homeAddress;
  if (typeof document !== "undefined" && document.body) {
    document.body.dataset.biome = biomeConfig?.id || "new_england_autumn";
    document.body.dataset.signStyle = biomeConfig?.streetSignStyle || "us_green";
  }
  const heroName = neighborhoodMeta.heroName;
  const cityShort = neighborhoodMeta.cityShort;

  // Merge data/house_colors.json with any live localStorage paints from iPad scouting
  const rawColorEntries = {};
  if (neighborhoodMeta.isNewton) {
    for (const [key, val] of Object.entries(baseHouseColors || {})) {
      if (key.startsWith("_") || !val || typeof val !== "object") continue;
      rawColorEntries[key] = { ...val };
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(houseColorsStorageKey) || "{}");
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
      localStorage.setItem(houseColorsStorageKey, JSON.stringify(rawColorEntries));
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
  const homeInterior = createHomeInteriorSystem(questSystem, { worldMap, meta: neighborhoodMeta });
  const homeBaseBuilding = buildings.find((b) => b.isHomeBase) || null;
  const homeDoorTile = homeBaseBuilding?.bounds
    ? {
        x: Math.min(homeBaseBuilding.bounds.maxX, homeBaseBuilding.bounds.minX + 2),
        y: homeBaseBuilding.bounds.maxY + 1,
      }
    : {
        x: (worldMap.origin?.spawnTile?.x ?? Math.floor(mapW / 2)) + 2,
        y: (worldMap.origin?.spawnTile?.y ?? Math.floor(mapH / 2)) - 1,
      };
  const paperMap = createPaperMapRenderer(worldMap, normalizedColorMap);
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
    graveyardFeatures.graveyardGrid,
    worldMap.origin?.spawnTile,
    questSystem.landmarks,
    biomeConfig
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
  const roadTraffic = buildRoadTraffic(worldMap, {
    spawnTile: worldMap.origin?.spawnTile,
  });
  const buildingIndex = buildBuildingSpatialIndex(buildings);
  let lastGraveyardId = "";

  // Fast 16x16-tile spatial grid for all static neighborhood props so onDraw()
  // only touches the ~4 visible chunks instead of scanning 15,000+ items every frame!
  const PROP_CHUNK = 16;
  function createTileSpatialIndex(items) {
    const buckets = new Map();
    for (const item of items || []) {
      const cx = Math.floor(item.tx / PROP_CHUNK);
      const cy = Math.floor(item.ty / PROP_CHUNK);
      const key = `${cx},${cy}`;
      let list = buckets.get(key);
      if (!list) {
        list = [];
        buckets.set(key, list);
      }
      list.push(item);
    }
    return {
      query(minX, minY, maxX, maxY) {
        const cx0 = Math.floor(minX / PROP_CHUNK);
        const cy0 = Math.floor(minY / PROP_CHUNK);
        const cx1 = Math.floor(maxX / PROP_CHUNK);
        const cy1 = Math.floor(maxY / PROP_CHUNK);
        const out = [];
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const list = buckets.get(`${cx},${cy}`);
            if (!list) continue;
            for (let i = 0; i < list.length; i++) {
              const it = list[i];
              if (it.tx >= minX && it.tx <= maxX && it.ty >= minY && it.ty <= maxY) {
                out.push(it);
              }
            }
          }
        }
        return out;
      },
    };
  }

  const propIndices = {
    benches: createTileSpatialIndex(parkBenches),
    parkProps: createTileSpatialIndex(parkFeatures.props),
    graveProps: createTileSpatialIndex(graveyardFeatures.props),
    graveGhosts: createTileSpatialIndex(graveyardFeatures.ghosts),
    graveWisps: createTileSpatialIndex(graveyardFeatures.wisps),
    graveBats: createTileSpatialIndex(graveyardFeatures.bats),
    reeds: createTileSpatialIndex(shoreReeds),
    hydrants: createTileSpatialIndex(hydrants),
    leafPiles: createTileSpatialIndex(leafPiles),
    shrubs: createTileSpatialIndex(gardenShrubs),
    lamps: createTileSpatialIndex(streetLamps),
    parkedCars: createTileSpatialIndex(parkedCars),
  };

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

  const MAX_BAKED_HOUSES = 160;
  const MAX_BAKED_STACKS = 80;
  const bakedHouseCache = new Map();
  const bakedStackCache = new Map();
  let paintRevision = 1;
  function getBakedHouse(building) {
    let entry = bakedHouseCache.get(building.id);
    if (entry) {
      // Refresh LRU order
      bakedHouseCache.delete(building.id);
      bakedHouseCache.set(building.id, entry);
      return entry;
    }
    const baked = bakeSnesBuildingCanvas(building, tileSize * 2, normalizedColorMap, biomeConfig);
    baked.canvas.__pixelScale = 0.5;
    entry = {
      canvas: baked.canvas,
      offsetX: baked.offsetX / 2,
      offsetY: baked.offsetY / 2,
      version: paintRevision,
    };
    bakedHouseCache.set(building.id, entry);
    if (bakedHouseCache.size > MAX_BAKED_HOUSES) {
      const oldestKey = bakedHouseCache.keys().next().value;
      bakedHouseCache.delete(oldestKey);
    }
    return entry;
  }
  function getBakedHouseStack(building) {
    let entry = bakedStackCache.get(building.id);
    if (entry) {
      bakedStackCache.delete(building.id);
      bakedStackCache.set(building.id, entry);
      return entry;
    }
    const stack = bake32BitHouseStack(building, tileSize, normalizedColorMap, biomeConfig);
    entry = { ...stack, version: paintRevision };
    bakedStackCache.set(building.id, entry);
    if (bakedStackCache.size > MAX_BAKED_STACKS) {
      const oldestKey = bakedStackCache.keys().next().value;
      bakedStackCache.delete(oldestKey);
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
    isWading: false,
    waterToastCooldown: 0,
    elapsedTime: 0,
    hurtTimer: 0,
    knockbackTimer: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    hurtShakeTimer: 0,
    ouchBubbleTimer: 0,
    ouchBubbleSprite: "bubble_ouch",
    hearts: 5,
    maxHearts: 5,
    lastBumpKind: "",
    koRespawnTimer: 0,
    swordSwingTimer: 0,
    swordCooldown: 0,
    siddurAuraTimer: 0,
    siddurCooldown: 0,
    jostleTimer: 0,
    jostleDirX: 0,
    jostleDirY: 0,
    throwAnimTimer: 0,
  };

  let roadHitCutscene = null; // { phase, timer, hitX, hitY, ambX, ambY, ambDir, sirenTimer, vehicleKind }
  let botwTeleport = null; // { phase: "out"|"glide"|"in", timer, duration, fromX, fromY, toX, toY, toTx, toTy, ribbons, runes }
  let isInGraveyardNow = false;
  let activeTalkNpcId = null;
  const npcAnimState = new Map(); // npcId -> { celebrateTimer, greetWaveTimer, greetedNear }

  // Overhead Item Fanfare queue & active timer
  const fanfareQueue = [];
  let activeFanfare = null; // { itemMeta, sourceLabel, timer }

  const dustPuffs = [];
  const leafParticles = [];
  const worldFx = []; // Tailored defeat/interaction animations (bone collapse, ectoplasm vortex, beams, flashlight cones, wind swirls)
  const ambientLeaves = Array.from({ length: 8 }, (_, i) => ({
    ox: ((i * 53) % VIEW_W) - VIEW_W / 2,
    oy: ((i * 37) % VIEW_H) - VIEW_H / 2,
    vx: 10 + (i % 3) * 4,
    vy: 6 + (i % 4) * 2.5,
    phase: i * 1.1,
    sprite: `fx_leaf_${i % 3}`,
  }));
  const tossedSnacks = [];
  const groundDrops = [];
  let dustCooldown = 0;
  let leafTrailCooldown = 0;

  function spawnSpriteParticle(opts) {
    leafParticles.push(opts);
  }

  function spawnSpookyDefeatEffect(x, y, spookyKind = "skeleton", viaSiddur = false) {
    if (viaSiddur) {
      worldFx.push({ kind: "siddur_beam", x, y, t: 0, duration: 0.72 });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        spawnSpriteParticle({
          x: x + Math.cos(ang) * 4,
          y: y - 10,
          vx: Math.cos(ang) * 20,
          vy: -34 - Math.random() * 18,
          life: 0.62,
          sprite: i % 2 === 0 ? "fx_sparkle_gold" : "fx_sparkle_cyan",
          noGravity: true,
        });
      }
    }
    if (spookyKind === "skeleton") {
      // Dramatic clattering bone-pile collapse: spinning skull + 4 bouncing bones!
      const pieces = [
        { sprite: "fx_skull_poof", x, y: y - 16, vx: (Math.random() - 0.5) * 24, vy: -52, rot: 0, rotSpd: 320 },
      ];
      for (let i = 0; i < 4; i++) {
        const ang = -Math.PI * 0.85 + (i / 3) * Math.PI * 0.7;
        pieces.push({
          sprite: i % 2 === 0 ? "fx_bone_0" : "fx_bone_1",
          x: x + (i - 1.5) * 3,
          y: y - 10,
          vx: Math.cos(ang) * (26 + Math.random() * 20),
          vy: -36 - Math.random() * 22,
          rot: i * 45,
          rotSpd: (i % 2 === 0 ? 1 : -1) * (280 + i * 40),
        });
      }
      worldFx.push({ kind: "skeleton_defeat", x, y, groundY: y + 2, t: 0, duration: 0.95, pieces });
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        spawnSpriteParticle({
          x,
          y: y - 10,
          vx: Math.cos(ang) * 26,
          vy: Math.sin(ang) * 16 - 14,
          life: 0.45,
          shade: i % 2 === 0 ? [102, 242, 168] : [224, 240, 224],
          w: 3,
          h: 3,
        });
      }
    } else if (spookyKind === "pumpkin_ghoul") {
      // Jack-o'-Lantern ember burst + curling violet cloak wisps!
      worldFx.push({ kind: "pumpkin_defeat", x, y, t: 0, duration: 0.78 });
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        spawnSpriteParticle({
          x,
          y: y - 12,
          vx: Math.cos(ang) * (26 + Math.random() * 18),
          vy: Math.sin(ang) * 18 - 28,
          life: 0.56 + Math.random() * 0.16,
          sprite: i % 2 === 0 ? "fx_ember" : "fx_sparkle_gold",
        });
      }
    } else {
      // Phantom / Floating Ghost spiraling ectoplasm vortex!
      worldFx.push({ kind: "phantom_defeat", x, y, t: 0, duration: 0.82 });
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        spawnSpriteParticle({
          x: x + Math.cos(ang) * 5,
          y: y - 12,
          vx: Math.cos(ang) * 24,
          vy: -26 - Math.random() * 18,
          life: 0.56,
          sprite: i % 2 === 0 ? "fx_sparkle_cyan" : "fx_sparkle_gold",
          noGravity: true,
        });
      }
    }
  }

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
    // Check Home Base front door welcome mat (565 Boylston St) so Liam can step right inside his house!
    const doorDist = Math.hypot(tx - homeDoorTile.x, ty - homeDoorTile.y);
    const doorNear =
      doorDist <= 1.15
        ? {
            kind: "home_door",
            target: {
              id: "home_door",
              name: `${homeAddrLabel} (Your House)`,
              tx: homeDoorTile.x,
              ty: homeDoorTile.y,
            },
            dist: doorDist,
          }
        : null;

    // Tight, precise interaction radii so NPCs & street signs never hijack crossing a nearby road!
    const questNear = questSystem.findNearbyInteraction(tx, ty, 1.45);
    const signNear = streetSignSystem.findNearbySign(tx, ty, 1.45);
    if (doorNear && (!questNear || doorNear.dist < questNear.dist)) {
      return doorNear;
    }
    if (questNear && signNear) {
      // Favor whichever one Liam is standing closer to (slight edge to NPC/chest if tied)
      if (questNear.dist <= signNear.dist + 0.25) return questNear;
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

  function getCurrentActionIntent(tx, ty) {
    const rawNear = findCombinedInteraction(tx, ty);
    return resolveActionIntent({
      playerTileX: tx,
      playerTileY: ty,
      playerX: playerState.x,
      playerY: playerState.y,
      facing: playerState.facing,
      headingDeg: playerState.headingDeg,
      hardMode: questSystem.state.navMode === "hard",
      isOnRoad: safety.isBoxOnRoad(playerState.x, playerState.y, DEFAULT_HITBOX),
      safeCrossingActive: playerState.safeCrossingTimer > 0,
      curbStopCueTimer: playerState.curbStopCueTimer,
      nearbyInteraction: rawNear,
      isRoadTileFn: safety.isRoadTile,
      isRoadAtPxFn: safety.isRoadAtPx,
      tileSize,
    });
  }

  function resolveSignBanner(tx, ty, streetZone, activeGraveyard) {
    if (activeGraveyard) {
      return { title: `🪦 ${activeGraveyard.name}`, tag: "graveyard", unknown: false };
    }
    const salzNpc = questSystem.npcs.find((n) => n.id === "salzberg_house");
    if (salzNpc && Math.hypot(tx - salzNpc.walkTileX, ty - salzNpc.walkTileY) <= 6) {
      return { title: "SALZBERG HOUSE", tag: "200 Cotton St", unknown: false };
    }
    if (Math.hypot(tx - spawnTile.x, ty - spawnTile.y) <= 7) {
      return { title: "HOME BASE", tag: homeAddrLabel, unknown: false };
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
    background: biomeConfig?.backgroundRgb || [62, 42, 36],
    sunWash: biomeConfig?.sunWash || null,
  });

  const atlas = buildSnesSpriteAtlas(biomeConfig?.paletteKey || "autumn_golden", biomeConfig, {
    heroProfile: neighborhoodMeta.heroProfile,
    season: neighborhoodMeta.season,
    localFlair: neighborhoodMeta.localFlair,
    localChants: streetLife.localChants,
    bikerChants: streetLife.bikerChants,
    joggerChants: streetLife.joggerChants,
    heroName,
    cityShort,
  });
  await k.registerSprites(atlas);

  function resetToHome() {
    if (homeInterior.state.active) {
      homeInterior.exitHouse();
    }
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
    playerState.isWading = false;
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
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0 || ui?.isGameOverOpen()) return;
    if (ui?.isMapOpen() || ui?.isPaintOpen() || ui?.isDialogueOpen() || ui?.isSignOpen() || activeFanfare) return;
    if (homeInterior.state.active) return;
    if (playerState.lookTimer > 0) return;

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    const result = safety.inspectCrossingContextAtPx(playerState.x, playerState.y);

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

  function healPlayerHearts(amount, reason = "") {
    if (!amount || amount <= 0) return 0;
    const prev = playerState.hearts;
    playerState.hearts = Math.min(playerState.maxHearts, prev + amount);
    const gained = playerState.hearts - prev;
    if (gained > 0) {
      playHealHeartSfx();
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        leafParticles.push({
          x: playerState.x + Math.cos(ang) * 7,
          y: playerState.y - 12 + Math.sin(ang) * 4,
          vx: Math.cos(ang) * 18,
          vy: -26 - Math.random() * 14,
          life: 0.56,
          sprite: i % 2 === 0 ? "fx_heart_pink" : "fx_sparkle_gold",
          noGravity: true,
        });
      }
      const suffix = reason ? ` (${reason})` : "";
      ui?.showSafetyToast(
        `❤️ Restored +${gained} ${gained === 1 ? "Heart" : "Hearts"}! (${playerState.hearts}/${playerState.maxHearts})${suffix}`,
        2400
      );
    }
    return gained;
  }

  function triggerSwordSlash() {
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0 || ui?.isGameOverOpen()) return;
    if (ui?.isMapOpen() || ui?.isPaintOpen() || ui?.isDialogueOpen() || ui?.isSignOpen() || activeFanfare) return;
    if (homeInterior.state.active) return;
    if (!questSystem.hasSword()) {
      const swordGiver = questSystem.landmarks.find(
        (lm) => lm.rewardItem === "graveyard_sword" || lm.bonusItem === "graveyard_sword"
      );
      const swordHint = swordGiver
        ? `⚔️ Visit ${swordGiver.name} to get the Graveyard Sword!`
        : "⚔️ Explore local landmarks or switch to Easy Mode (G) to unlock the Graveyard Sword!";
      ui?.showSafetyToast(swordHint, 2400);
      return;
    }
    if (playerState.swordCooldown > 0) return;

    playerState.swordSwingTimer = 0.28;
    playerState.swordCooldown = 0.34;
    playSwordSlashSfx();

    // Gleaming cyan-gold blade trail sparkles fanning out in Liam's swing arc!
    const swBaseAng =
      playerState.facing === "right"
        ? 0
        : playerState.facing === "left"
          ? Math.PI
          : playerState.facing === "down"
            ? Math.PI / 2
            : -Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const a = swBaseAng - 0.9 + (i / 3) * 1.8;
      leafParticles.push({
        x: playerState.x + Math.cos(a) * 14,
        y: playerState.y - 8 + Math.sin(a) * 12,
        vx: Math.cos(a) * 32,
        vy: Math.sin(a) * 24 - 8,
        life: 0.28,
        sprite: i % 2 === 0 ? "fx_sparkle_cyan" : "fx_sparkle_gold",
        noGravity: true,
      });
    }

    const res = performSwordAttack(streetLife, playerState, {
      graveyardGhosts: graveyardFeatures.ghosts,
      elapsedTime: playerState.elapsedTime,
      tileSize,
    });
    const defeatedCount = res.defeatedCount ?? res.defeated?.length ?? 0;
    const scaredList = res.scaredAnimals || [];
    if (defeatedCount > 0 || scaredList.length > 0) {
      questSystem.state.safetyXP += defeatedCount * 10 + scaredList.length * 5;
      if (defeatedCount > 0) {
        questSystem.state.coins += defeatedCount;
        playCoinPickup();
        playerState.hurtShakeTimer = Math.max(playerState.hurtShakeTimer, 0.1);
      }
      questSystem.save();
      for (const foe of res.defeated) {
        worldFx.push({ kind: "hit_slash", x: foe.x, y: foe.y - 10, t: 0, duration: 0.24 });
        spawnSpookyDefeatEffect(foe.x, foe.y, foe.spookyKind || (foe.kind === "ghost" ? "ghost" : "skeleton"), false);
      }
      for (const animal of scaredList) {
        worldFx.push({ kind: "hit_slash", x: animal.x, y: animal.y - 8, t: 0, duration: 0.2 });
        if (animal.kind === "turkey") {
          playTurkeyGobble();
          spawnFeatherBurst(animal.x, animal.y);
        } else if (animal.kind === "squirrel") {
          playSquirrelChitter();
          spawnAutumnLeafBurst(animal.x, animal.y, 7, 42);
        } else if (animal.kind === "cat") {
          playCatMeow();
          spawnAutumnLeafBurst(animal.x, animal.y, 7, 42);
        } else if (animal.kind === "dog") {
          playDogBark();
          spawnAutumnLeafBurst(animal.x, animal.y, 8, 46);
        }
      }
      ui?.showSafetyToast(res.toast, 2400);
    }
  }

  function shareSnackWithProtestor(entry) {
    if (!entry || entry.kind !== "protestor") return null;
    const res = interactWithStreetLife(streetLife, entry, playerState.x, playerState.y, {
      hasSnack: questSystem.hasSnack(),
      consumeSnack: () => questSystem.useSnack(),
      isEasyMode: Boolean(questSystem.state.gpsAssist),
    });
    if (!res) return null;
    if (res.sound === "snack_thanks") {
      playSnackTossSfx();
      playHealHeartSfx();
      playerState.throwAnimTimer = 0.24;
      tossedSnacks.push({
        startX: playerState.x,
        startY: playerState.y - 10,
        targetX: entry.target.x,
        targetY: entry.target.y - 12,
        x: playerState.x,
        y: playerState.y - 10,
        t: 0,
        duration: 0.28,
        foodKind: "snack",
      });
      if (res.xpReward) {
        questSystem.state.safetyXP += res.xpReward;
        questSystem.save();
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        leafParticles.push({
          x: entry.target.x,
          y: entry.target.y - 14,
          vx: Math.cos(ang) * 24,
          vy: Math.sin(ang) * 14 - 24,
          life: 0.58,
          sprite: i % 3 === 0 ? "fx_heart_pink" : i % 3 === 1 ? "fx_sparkle_gold" : "fx_music_note",
          noGravity: true,
        });
      }
    } else if (res.sound === "protestor") {
      playProtestorShout();
    }
    ui?.showSafetyToast(res.toast, 2800);
    return res;
  }

  function feedWildAnimal(entry) {
    if (!entry) return null;
    const res = tossSnackAtAnimal(entry, playerState.x, playerState.y, {
      hasSnack: questSystem.hasSnack(),
      consumeSnack: () => questSystem.useSnack(),
      hasAcorn: questSystem.state.acorns > 0,
      consumeAcorn: () => {
        questSystem.state.acorns = Math.max(0, questSystem.state.acorns - 1);
        questSystem.save();
      },
      isEasyMode: Boolean(questSystem.state.gpsAssist),
    });
    if (res?.tossed) {
      playSnackTossSfx();
      playAnimalFeedSfx(entry.kind);
      playerState.throwAnimTimer = 0.24;
      tossedSnacks.push({
        startX: playerState.x,
        startY: playerState.y - 10,
        targetX: res.targetX,
        targetY: res.targetY - 6,
        x: playerState.x,
        y: playerState.y - 10,
        t: 0,
        duration: 0.34,
        foodKind: res.foodKind || "snack",
      });
      if (res.xpReward) {
        questSystem.state.safetyXP += res.xpReward;
        questSystem.save();
      }
      // Crisp 2x HD happy pink hearts + golden sparkles around the fed animal!
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * Math.PI * 2;
        leafParticles.push({
          x: res.targetX,
          y: res.targetY - 10,
          vx: Math.cos(ang) * 22,
          vy: Math.sin(ang) * 12 - 24,
          life: 0.62,
          sprite: i % 2 === 0 ? "fx_heart_pink" : "fx_sparkle_gold",
          noGravity: true,
        });
      }
      ui?.showSafetyToast(res.toast, 2800);
    } else if (res?.toast) {
      playCurbStopBoop();
      ui?.showSafetyToast(res.toast, 2600);
    }
    return res;
  }

  function triggerGiveSnack() {
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0 || ui?.isGameOverOpen()) return;
    if (ui?.isMapOpen() || ui?.isPaintOpen() || ui?.isDialogueOpen() || ui?.isSignOpen() || activeFanfare) return;
    if (homeInterior.state.active) {
      ui?.showSafetyToast("🥨 Grab snacks from the Kitchen Snack Jar inside, then share with marchers or feed wild animals outside!", 2600);
      return;
    }
    const nearTarget = findNearbySnackTarget(streetLife, playerState.x, playerState.y, 72);
    if (nearTarget?.kind === "protestor") {
      shareSnackWithProtestor(nearTarget);
    } else if (nearTarget) {
      feedWildAnimal(nearTarget);
    } else if (questSystem.hasSnack() || questSystem.state.acorns > 0) {
      const countLabel = questSystem.state.gpsAssist ? "∞" : questSystem.state.snacks;
      ui?.showSafetyToast(`🥨 You have ${countLabel} snacks & ${questSystem.state.acorns} acorns ready! Walk near marchers or wild animals and press N to feed!`, 2600);
    } else {
      const snackHint = neighborhoodMeta.isNewton
        ? "🥨 Out of snacks & acorns! Visit Home Base Kitchen, Mom, J.P. Licks, or Rosenfeld's Bagels to restock!"
        : "🥨 Out of snacks & acorns! Visit Home Base Kitchen, Mom, or local bakeries & cafes to restock!";
      ui?.showSafetyToast(snackHint, 2600);
    }
  }

  function triggerSiddurDispel() {
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0 || ui?.isGameOverOpen()) return;
    if (ui?.isMapOpen() || ui?.isPaintOpen() || ui?.isDialogueOpen() || ui?.isSignOpen() || activeFanfare) return;
    if (homeInterior.state.active) return;
    if (!questSystem.hasSiddur()) {
      const siddurHint = neighborhoodMeta.isNewton
        ? "📖 Visit any local house of worship (Beth El, First Baptist, Wilson Chapel, St. Paul's, or Temple Emanuel) for a Pocket Prayer Book!"
        : "📖 Visit any local house of worship or community hall for a Pocket Prayer Book!";
      ui?.showSafetyToast(siddurHint, 2600);
      return;
    }
    if (playerState.siddurCooldown > 0) return;

    playerState.siddurAuraTimer = 0.78;
    playerState.siddurCooldown = 1.0;
    playSiddurDispelSfx();

    const res = performSiddurDispel(streetLife, playerState, {
      graveyardGhosts: graveyardFeatures.ghosts,
      elapsedTime: playerState.elapsedTime,
      tileSize,
    });
    if (res.dispelledCount > 0) {
      questSystem.state.safetyXP += res.dispelledCount * 5;
      questSystem.save();
      for (const pos of res.positions) {
        if (pos.kind === "spooky" || pos.kind === "ghost") {
          spawnSpookyDefeatEffect(pos.x, pos.y, pos.spookyKind || "ghost", true);
        } else {
          for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            leafParticles.push({
              x: pos.x,
              y: pos.y - 8,
              vx: Math.cos(ang) * 26,
              vy: Math.sin(ang) * 18 - 22,
              life: 0.52,
              sprite: i % 2 === 0 ? "fx_sparkle_cyan" : "fx_sparkle_gold",
              noGravity: true,
            });
          }
        }
      }
    }
    ui?.showSafetyToast(res.toast, 2500);
  }

  function startRoadHitCutscene(hit) {
    if (roadHitCutscene) return;
    const vehicleKind = hit?.kind || "car";
    playerState.hearts = 0;
    playerState.moving = false;
    playerState.hurtTimer = 1.2;
    playerState.hurtShakeTimer = 0.55;
    playerState.ouchBubbleTimer = 0.9;
    playerState.ouchBubbleSprite = "bubble_bonk";
    playerState.safeCrossingTimer = 0;
    playCarCrashSfx();

    // Dramatic crash spark burst
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const spd = 34 + Math.random() * 44;
      leafParticles.push({
        x: playerState.x,
        y: playerState.y - 6,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 18,
        life: 0.55,
        shade: i % 2 === 0 ? [255, 58, 52] : [255, 224, 92],
        w: 3,
        h: 3,
      });
    }

    const ambDir = hit?.vehicle?.dx < 0 ? "w" : "e";
    const dirSign = ambDir === "e" ? 1 : -1;
    const startAmbX = playerState.x - dirSign * 195;
    const stopAmbX = playerState.x + dirSign * 44;
    const doorX = stopAmbX - dirSign * 26;
    const polDir = ambDir === "e" ? "w" : "e";
    const polStartX = playerState.x + dirSign * 215;
    const polStopX = playerState.x - dirSign * 64;
    // Newton Fire Rescue Pumper ALSO arrives as full-scene backup on an offset perimeter lane!
    const fireDir = ambDir;
    const fireStartX = playerState.x - dirSign * 245;
    const fireStopX = playerState.x - dirSign * 18;
    const tapeLeftX = playerState.x - 54;
    const tapeRightX = playerState.x + 56;
    roadHitCutscene = {
      phase: "hit",
      timer: 0.68,
      hitX: playerState.x,
      hitY: playerState.y,
      ambX: startAmbX,
      ambY: playerState.y,
      stopAmbX,
      doorX,
      ambDir,
      polDir,
      polX: polStartX,
      polY: playerState.y + 4,
      polStopX,
      polArrived: false,
      fireDir,
      fireX: fireStartX,
      fireY: playerState.y - 30,
      fireStopX,
      fireArrived: false,
      tapeLeftX,
      tapeRightX,
      tapeProgress: 0, // 0 -> 1 as officers roll out top & bottom CAUTION tape + drop cones & flares!
      sirenTimer: 0,
      dustTimer: 0,
      emtProgress: 0,
      vehicleKind,
    };
    const hitToast =
      vehicleKind === "bike"
        ? "💥 CRASH! An annoying spandex biker nailed you! Full EMS, Police & Fire response!"
        : vehicleKind === "truck"
          ? "💥 CRASH! A giant truck hit you! Full EMS, Police & Fire response!"
          : "💥 CRASH! A car hit you! Full EMS, Police & Fire response!";
    ui?.showSafetyToast(hitToast, 2600);
  }

  function retryAfterGameOver() {
    ui?.closeGameOver();
    roadHitCutscene = null;
    playerState.koRespawnTimer = 0;
    playerState.hearts = playerState.maxHearts;
    playerState.hurtTimer = 0;
    playerState.knockbackTimer = 0;
    resetToHome();
    ui?.showSafetyToast("🏠 Back at Home Base with all 5 hearts! Watch closely for cars & bikes!", 2600);
  }

  function canEnterNearbyHouse(tx, ty) {
    if (homeInterior.state.active) return false;
    return Math.hypot(tx - homeDoorTile.x, ty - homeDoorTile.y) <= 3.5;
  }

  function enterHomeBaseHouse() {
    const entered = homeInterior.enterHouse(playerState.x, playerState.y);
    playerState.x = entered.x;
    playerState.y = entered.y;
    playerState.facing = entered.facing;
    playerState.moving = false;
    playerState.isWading = false;
    k.setCamRot(0);
    playDoorChime();
    ui?.showSafetyToast(
      `🏠 Welcome inside ${homeAddrLabel}! Try the Kitchen Snacks, Closet, Bookshelf & D&D Pool Table!`,
      3000
    );
  }

  function toggleHouseInside() {
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0 || ui?.isGameOverOpen()) return;
    if (ui?.isMapOpen() || ui?.isPaintOpen() || ui?.isDialogueOpen() || ui?.isSignOpen() || activeFanfare) return;
    if (homeInterior.state.active) {
      leaveHouseToOutdoor();
      return;
    }
    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    if (canEnterNearbyHouse(tx, ty)) {
      enterHomeBaseHouse();
    } else {
      ui?.showSafetyToast(`🏠 Walk up to ${homeAddrLabel} (Home Base) and press I to go inside!`, 2400);
    }
  }

  function leaveHouseToOutdoor() {
    const ret = homeInterior.exitHouse();
    playerState.x = ret?.x ?? homeDoorTile.x * tileSize + tileSize / 2;
    playerState.y = (ret?.y ?? homeDoorTile.y * tileSize + tileSize / 2) + 4;
    playerState.facing = "down";
    playerState.moving = false;
    playerState.isWading = false;
    playDoorChime();
    ui?.showSafetyToast(`🏡 Stepped back outside onto ${homeAddrLabel}!`, 2000);
  }

  function handleInteriorInteraction(propId) {
    const outcome = homeInterior.interactWithInteriorProp(propId);
    if (!outcome) return;
    if (outcome.action === "exit_house") {
      leaveHouseToOutdoor();
      return;
    }
    if (outcome.action === "kitchen_snacks") {
      healPlayerHearts(outcome.healHearts || 5, "Home Kitchen");
      playSnackRestockSfx();
      ui?.showSafetyToast(outcome.toast, 2600);
      return;
    }
    if (outcome.action === "toggle_outfit") {
      toggleHeroOutfitMode();
      return;
    }
    if (outcome.action === "secret_reveal") {
      playSecretRevealSfx();
      ui?.openDialogue({
        speaker: outcome.speaker,
        lines: outcome.lines,
      });
      return;
    }
    if (outcome.action === "room_change") {
      playerState.x = outcome.x;
      playerState.y = outcome.y;
      playerState.facing = outcome.facing;
      playerState.moving = false;
      playDoorChime();
      if (outcome.toast) ui?.showSafetyToast(outcome.toast, 2400);
      return;
    }
    if (outcome.action === "fanfare") {
      playSecretRevealSfx();
      ui?.openDialogue({
        speaker: outcome.speaker,
        lines: outcome.lines,
        onComplete: () => {
          enqueueFanfare([{ itemId: outcome.itemId, sourceLabel: outcome.sourceLabel }]);
        },
      });
      return;
    }
    if (outcome.action === "d20_roll") {
      playDiceRollSfx(outcome.roll === 20);
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2;
        leafParticles.push({
          x: playerState.x,
          y: playerState.y - 10,
          vx: Math.cos(ang) * 32,
          vy: Math.sin(ang) * 24 - 18,
          life: 0.45,
          shade: i % 2 === 0 ? [255, 226, 92] : [255, 250, 220],
          w: 3,
          h: 3,
        });
      }
      ui?.showSafetyToast(outcome.toast, 2600);
      return;
    }
    if (outcome.action === "puzzle_solved") {
      playSecretRevealSfx();
      ui?.showSafetyToast(outcome.toast, 2800);
      return;
    }
    if (outcome.action === "switch_ok") {
      playCoinPickup();
      ui?.showSafetyToast(outcome.toast, 2200);
      return;
    }
    if (outcome.action === "switch_reset") {
      playCurbStopBoop();
      ui?.showSafetyToast(outcome.toast, 2600);
      return;
    }
    if (outcome.action === "dialogue") {
      ui?.openDialogue({
        speaker: outcome.speaker,
        lines: outcome.lines,
      });
      return;
    }
    if (outcome.toast) {
      ui?.showSafetyToast(outcome.toast, 2400);
    }
  }

  function triggerLookOrInteract() {
    if (ui?.isGameOverOpen()) {
      retryAfterGameOver();
      return;
    }
    if (roadHitCutscene) {
      if (roadHitCutscene.phase === "mom_yelling" && ui?.isDialogueOpen()) {
        ui.advanceDialogue();
      }
      return;
    }
    if (playerState.koRespawnTimer > 0) return;
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

    // Inside Home Base (565 Boylston St): interact with kitchen snacks, closet, bookshelf, D&D basement & doors!
    if (homeInterior.state.active) {
      const nearProp = homeInterior.findNearbyInteriorProp(playerState.x, playerState.y);
      if (nearProp?.target) {
        handleInteriorInteraction(nearProp.target.id);
      } else {
        ui?.showSafetyToast("🏠 Walk up to the Kitchen, Closet, Bookshelf, Pool Table, or Door Mat!", 2000);
      }
      return;
    }

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);

    // Smart facing-aware disambiguation: Look Both Ways when facing an unchecked road,
    // or interact cleanly with the highlighted NPC / Street Sign / Chest / Home Door within tight reach!
    const intent = getCurrentActionIntent(tx, ty);
    if (intent.mode === "look_both_ways") {
      performLookBothWays();
      return;
    }

    const nearby = intent.interaction;
    if (nearby) {
      if (nearby.kind === "home_door") {
        enterHomeBaseHouse();
        return;
      }
      if (nearby.kind === "sign") {
        openStreetSign(nearby.target);
        return;
      }
      if (nearby.kind === "spooky" && questSystem.hasSword()) {
        triggerSwordSlash();
        return;
      }
      if (nearby.kind === "protestor") {
        shareSnackWithProtestor(nearby);
        return;
      }
      if (nearby.kind === "local") {
        const res = interactWithStreetLife(streetLife, nearby, playerState.x, playerState.y, {});
        if (res) {
          playDialogueOpenSfx();
          if (res.xpReward) {
            questSystem.state.safetyXP += res.xpReward;
            questSystem.save();
          }
          for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            leafParticles.push({
              x: nearby.target.x,
              y: nearby.target.y - 16,
              vx: Math.cos(ang) * 18,
              vy: Math.sin(ang) * 10 - 20,
              life: 0.52,
              sprite: i % 2 === 0 ? "fx_sparkle_gold" : "fx_music_note",
              noGravity: true,
            });
          }
          ui?.showSafetyToast(res.toast, 3400);
        }
        return;
      }
      if (
        nearby.kind === "turkey" ||
        nearby.kind === "squirrel" ||
        nearby.kind === "cat" ||
        nearby.kind === "dog"
      ) {
        const hasFood = Boolean(
          questSystem.state.gpsAssist || questSystem.hasSnack() || questSystem.state.acorns > 0
        );
        if (hasFood) {
          feedWildAnimal(nearby);
          return;
        }
      }
      if (
        nearby.kind === "turkey" ||
        nearby.kind === "squirrel" ||
        nearby.kind === "cat" ||
        nearby.kind === "dog" ||
        nearby.kind === "spooky"
      ) {
        const res = interactWithStreetLife(streetLife, nearby, playerState.x, playerState.y, {
          hasSnack: questSystem.hasSnack(),
          consumeSnack: () => questSystem.useSnack(),
          isEasyMode: Boolean(questSystem.state.gpsAssist),
        });
        if (res) {
          if (res.sound === "turkey") {
            playTurkeyGobble();
            spawnFeatherBurst(nearby.target.x, nearby.target.y);
          } else if (res.sound === "squirrel") {
            playSquirrelChitter();
            spawnAutumnLeafBurst(nearby.target.x, nearby.target.y, 6, 36);
          } else if (res.sound === "cat") {
            playCatMeow();
            spawnAutumnLeafBurst(nearby.target.x, nearby.target.y, 6, 36);
          } else if (res.sound === "dog") {
            playDogBark();
            spawnAutumnLeafBurst(nearby.target.x, nearby.target.y, 7, 42);
          } else if (res.sound === "spooky") {
            playSpookyChime();
            // Expanding golden flashlight spook-back cone + startling sparks!
            worldFx.push({
              kind: "flashlight_cone",
              x: playerState.x,
              y: playerState.y - 8,
              tx: nearby.target.x,
              ty: nearby.target.y - 10,
              t: 0,
              duration: 0.42,
            });
            for (let i = 0; i < 6; i++) {
              const ang = (i / 6) * Math.PI * 2;
              leafParticles.push({
                x: nearby.target.x,
                y: nearby.target.y - 12,
                vx: Math.cos(ang) * 28,
                vy: Math.sin(ang) * 18 - 18,
                life: 0.44,
                sprite: i % 2 === 0 ? "fx_sparkle_gold" : "fx_sparkle_cyan",
                noGravity: true,
              });
            }
          }
          ui?.showSafetyToast(res.toast, 2800);
        }
        return;
      }
      if (nearby.kind === "chest") {
        playChestOpenSfx();
      }
      const outcome =
        nearby.kind === "chest"
          ? questSystem.interactWithChest(nearby.target.id)
          : questSystem.interactWithNpc(nearby.target.id);
      if (outcome) {
        if (outcome.questEvent) {
          refreshPocketDirections(tx, ty, nearby.target.name?.replace(/\s*\(.*\)/, "") || "Here");
        }
        if (nearby.kind === "npc" && nearby.target?.id) {
          activeTalkNpcId = nearby.target.id;
          const npcPxX = nearby.target.walkTileX * tileSize + tileSize / 2;
          const npcPxY = nearby.target.walkTileY * tileSize + tileSize / 2;
          leafParticles.push({
            x: npcPxX + 8,
            y: npcPxY - 22,
            vx: 6,
            vy: -18,
            life: 0.65,
            sprite: "fx_music_note",
            noGravity: true,
          });
        }
        ui?.openDialogue({
          speaker: outcome.speaker,
          lines: outcome.lines,
          onComplete: () => {
            const finishedNpcId = activeTalkNpcId;
            activeTalkNpcId = null;
            if (finishedNpcId && nearby.kind === "npc") {
              const st = npcAnimState.get(finishedNpcId) || { celebrateTimer: 0, greetWaveTimer: 0, greetedNear: true };
              st.celebrateTimer = outcome.questEvent || outcome.healHearts > 0 ? 1.65 : 0.95;
              npcAnimState.set(finishedNpcId, st);
              const npcPxX = nearby.target.walkTileX * tileSize + tileSize / 2;
              const npcPxY = nearby.target.walkTileY * tileSize + tileSize / 2;
              const burstN = outcome.questEvent ? 8 : 4;
              for (let i = 0; i < burstN; i++) {
                const ang = (i / burstN) * Math.PI * 2;
                leafParticles.push({
                  x: npcPxX,
                  y: npcPxY - 16,
                  vx: Math.cos(ang) * 20,
                  vy: -22 - Math.random() * 14,
                  life: 0.62,
                  sprite: outcome.healHearts > 0 && i % 2 === 0 ? "fx_heart_pink" : i % 2 === 0 ? "fx_sparkle_gold" : "fx_music_note",
                  noGravity: true,
                });
              }
            }
            if (outcome.healHearts > 0) {
              healPlayerHearts(outcome.healHearts, outcome.questEvent?.type === "quest_completed" ? "Quest Complete" : nearby.target.name?.replace(/\s*\(.*\)/, ""));
            }
            if (outcome.gainedSnacks > 0) {
              playSnackRestockSfx();
              ui?.showSafetyToast(
                `🥨 Packed +${outcome.gainedSnacks} snacks! (${questSystem.state.snacks}/${questSystem.getMaxSnacks()}) — share with marchers or feed wild animals (N)!`,
                2500
              );
            }
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

  function startMapTeleport(normX, normY) {
    if (!questSystem.state.gpsAssist) {
      playCurbStopBoop();
      ui?.showSafetyToast(
        "📡 Switch to Easy / GPS Mode (G) to Fast-Travel by tapping anywhere on the map!",
        2600
      );
      return false;
    }
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0) return false;

    const rawTx = Math.max(4, Math.min(mapW - 5, Math.floor(normX * mapW)));
    const rawTy = Math.max(4, Math.min(mapH - 5, Math.floor(normY * mapH)));
    const snapped = snapToWalkableTile(worldMap, rawTx, rawTy, 18);
    const destTx = Math.max(2, Math.min(mapW - 3, snapped.x));
    const destTy = Math.max(2, Math.min(mapH - 3, snapped.y));

    ui?.setMapModalOpen(false);
    if (homeInterior.state.active) {
      homeInterior.exitHouse();
    }

    const ribbons = [];
    for (let i = 0; i < 16; i++) {
      ribbons.push({
        angle: (i / 16) * Math.PI * 2,
        radius: 7 + (i % 4) * 3.5,
        speed: 4.5 + (i % 3) * 1.4,
        heightOff: (i % 5) * 6,
        hue: i % 3, // 0 = bright Sheikah cyan, 1 = electric sky, 2 = pure ice-white
      });
    }
    const runes = [];
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      runes.push({
        ox: Math.cos(ang) * (15 + (i % 2) * 5),
        oy: Math.sin(ang) * (8 + (i % 2) * 3),
        phase: i * 0.7,
      });
    }

    botwTeleport = {
      phase: "out",
      timer: 0,
      duration: 0.95,
      fromX: playerState.x,
      fromY: playerState.y,
      toX: destTx * tileSize + tileSize / 2,
      toY: destTy * tileSize + tileSize / 2,
      toTx: destTx,
      toTy: destTy,
      ribbons,
      runes,
    };

    playerState.moving = false;
    playerState.lookTimer = 0;
    playerState.safeCrossingTimer = 0;
    playerState.headingDeg = 0;
    playerState.targetHeadingDeg = 0;
    k.setCamRot(0);
    playBotwTeleportOutSfx();
    ui?.showSafetyToast("✨ Sheikah Fast-Travel engaged!", 1900);
    return true;
  }

  function togglePaperMap() {
    if (botwTeleport || roadHitCutscene || playerState.koRespawnTimer > 0 || ui?.isGameOverOpen()) return;
    if (ui?.isDialogueOpen() || ui?.isPaintOpen() || ui?.isSignOpen()) return;
    const nextOpen = !ui?.isMapOpen();
    playMapToggleSfx(nextOpen);
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
    playNavModeSwitchSfx(mode);
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
      ui?.showSafetyToast(
        "📡 Easy / GPS Mode ON — Tap anywhere on the Map (M) to Fast-Travel! All Outfits, Sword, Siddur & Top Speed unlocked!",
        3200
      );
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
    const unlocked = questSystem.getUnlockedOutfits();
    if (unlocked.length <= 1) {
      playCurbStopBoop();
      ui?.showSafetyToast(
        "👕 Only Polo, Kippah & Tzitzit unlocked! Complete quests to earn ⚾ Little League, 🤿 Wetsuit & 🗡️ Link!",
        2800
      );
      return;
    }
    const next = questSystem.toggleHeroOutfit();
    playOutfitSwapSfx(next);
    ui?.showSafetyToast(
      next === "link"
        ? `🗡️ Hyah! ${heroName} put on the Legend of Zelda Link Tunic, Hylian Cap & Shield!`
        : next === "wetsuit"
          ? `🤿 Splash! ${heroName} put on the Summer Wetsuit & Snorkel — ready to wade through water!`
          : next === "baseball"
            ? `⚾ Play Ball! ${heroName} put on the Little League Uniform!`
            : `👕 ${heroName} switched to Polo, Kippah & Tzitzit!`,
      2400
    );
  }

  function openPaintForNearbyHouse() {
    if (botwTeleport || roadHitCutscene || homeInterior.state.active || ui?.isGameOverOpen()) return;
    if (ui?.isDialogueOpen() || ui?.isMapOpen() || ui?.isSignOpen()) return;
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
        playPaintHouseSfx();
        return rawColorEntries[key];
      },
      onPickRoof: (building, roofKey) => {
        const key = building.address || building.id;
        rawColorEntries[key] = { ...(rawColorEntries[key] || {}), roof: roofKey };
        rebuildNormalizedColorMap();
        persistLocalColors();
        invalidateHouseSprite(building);
        playPaintHouseSfx();
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
        playPaintHouseSfx();
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
    onResetHome: () => {
      if (botwTeleport || roadHitCutscene) return;
      resetToHome();
    },
    onLookOrInteract: triggerLookOrInteract,
    onToggleMute: () => toggleMute(),
    onOpenPaint: openPaintForNearbyHouse,
    onToggleMap: togglePaperMap,
    onMapTeleport: startMapTeleport,
    onToggleGpsAssist: cycleNavModeAction,
    onToggleOutfit: toggleHeroOutfitMode,
    onToggleInside: toggleHouseInside,
    onGiveSnack: triggerGiveSnack,
    onUseSword: triggerSwordSlash,
    onUseSiddur: triggerSiddurDispel,
    onGameOverRetry: retryAfterGameOver,
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
    onTextBlip: (speaker) => playTextBlip(speaker),
    onDialogueOpen: (speaker) => playDialogueOpenSfx(speaker),
    onDialogueAdvance: () => playDialogueAdvanceSfx(),
  });
  ui.setNeighborhoodMeta(neighborhoodMeta);

  const studio = createNeighborhoodStudio({
    worldMap,
    landmarks,
    quests,
    houseColors: rawColorEntries,
    neighborhoodMeta,
    activePack,
    getPlayerTile: () => ({
      x: Math.floor(playerState.x / tileSize),
      y: Math.floor(playerState.y / tileSize),
    }),
    onShowToast: (msg) => ui?.showSafetyToast(msg, 2800),
  });

  function isTextOrStudioBlocked() {
    return studio.isOpen() || isEditableElementFocused();
  }

  k.onKeyPress("c", () => {
    if (isTextOrStudioBlocked()) return;
    showDebug = !showDebug;
  });
  k.onKeyPress("g", () => {
    if (isTextOrStudioBlocked()) return;
    cycleNavModeAction();
  });
  k.onKeyPress("o", () => {
    if (isTextOrStudioBlocked()) return;
    toggleHeroOutfitMode();
  });
  k.onKeyPress("i", () => {
    if (isTextOrStudioBlocked()) return;
    toggleHouseInside();
  });
  k.onKeyPress("n", () => {
    if (isTextOrStudioBlocked()) return;
    triggerGiveSnack();
  });
  k.onKeyPress("h", () => {
    if (isTextOrStudioBlocked() || botwTeleport || roadHitCutscene) return;
    resetToHome();
  });
  k.onKeyPress("m", () => {
    if (isTextOrStudioBlocked()) return;
    togglePaperMap();
  });
  k.onKeyPress("tab", () => {
    if (isTextOrStudioBlocked()) return;
    togglePaperMap();
  });
  k.onKeyPress("p", () => {
    if (isTextOrStudioBlocked()) return;
    openPaintForNearbyHouse();
  });
  k.onKeyPress("space", () => {
    if (isTextOrStudioBlocked()) return;
    triggerLookOrInteract();
  });
  k.onKeyPress("e", () => {
    if (isTextOrStudioBlocked()) return;
    triggerLookOrInteract();
  });
  k.onKeyPress("enter", () => {
    if (isTextOrStudioBlocked()) return;
    triggerLookOrInteract();
  });
  k.onKeyPress("l", () => {
    if (isTextOrStudioBlocked()) return;
    performLookBothWays();
  });
  k.onKeyPress("j", () => {
    if (isTextOrStudioBlocked()) return;
    triggerSwordSlash();
  });
  k.onKeyPress("f", () => {
    if (isTextOrStudioBlocked()) return;
    triggerSwordSlash();
  });
  k.onKeyPress("x", () => {
    if (isTextOrStudioBlocked()) return;
    triggerSwordSlash();
  });
  k.onKeyPress("k", () => {
    if (isTextOrStudioBlocked()) return;
    triggerSiddurDispel();
  });
  k.onKeyPress("r", () => {
    if (isTextOrStudioBlocked()) return;
    triggerSiddurDispel();
  });
  k.onKeyPress("z", () => {
    if (isTextOrStudioBlocked()) return;
    triggerSiddurDispel();
  });

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
        life: 0.48 + Math.random() * 0.3,
        sprite: `fx_leaf_${i % 3}`,
        rot: Math.random() * 360,
        rotSpd: (Math.random() < 0.5 ? 1 : -1) * 220,
      });
    }
  }

  function spawnFeatherBurst(wx, wy) {
    for (let i = 0; i < 7; i++) {
      leafParticles.push({
        x: wx + (Math.random() * 8 - 4),
        y: wy - 6 + (Math.random() * 6 - 3),
        vx: (Math.random() - 0.5) * 44,
        vy: -20 - Math.random() * 20,
        life: 0.55 + Math.random() * 0.28,
        sprite: `fx_feather_${i % 2}`,
        rot: Math.random() * 360,
        rotSpd: (Math.random() < 0.5 ? 1 : -1) * 180,
      });
    }
  }

  function spawnWaterSplashBurst(wx, wy, count = 6, spread = 36) {
    const splashShades = [
      [230, 250, 255],
      [154, 224, 248],
      [96, 184, 224],
      [255, 250, 232],
    ];
    for (let i = 0; i < count; i++) {
      leafParticles.push({
        x: wx + (Math.random() * 10 - 5),
        y: wy + (Math.random() * 4 - 2),
        vx: (Math.random() - 0.5) * spread,
        vy: -14 - Math.random() * 18,
        life: 0.28 + Math.random() * 0.2,
        shade: splashShades[i % splashShades.length],
        w: i % 2 === 0 ? 3 : 2,
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
  let isFastWadingNow = false;
  let lastHudTileKey = "";
  let cachedNearbyHouses = [];
  let cachedNearestBuilding = null;
  let cachedNearestLandmark = null;
  let cachedCurbContext = { context: "clear" };
  let lastActionIntent = {
    mode: "look_both_ways",
    interaction: null,
    alternateInteraction: null,
    facingUncheckedRoad: false,
  };
  let lastNearestPromptSign = null;
  let lastPromptSignTileKey = "";

  k.onUpdate(() => {
    const dt = Math.min(k.dt(), 0.05);
    playerState.elapsedTime += dt;

    // Typewriter update when dialogue is open
    ui.updateDialogueTypewriter(dt);

    // Road-Hit Ambulance -> Home Base Mom Yelling -> Giant GAME OVER Cutscene!
    if (roadHitCutscene) {
      if (playerState.hurtShakeTimer > 0) {
        playerState.hurtShakeTimer = Math.max(0, playerState.hurtShakeTimer - dt);
      }
      if (playerState.ouchBubbleTimer > 0) {
        playerState.ouchBubbleTimer = Math.max(0, playerState.ouchBubbleTimer - dt);
      }
      for (let i = leafParticles.length - 1; i >= 0; i--) {
        const p = leafParticles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 65 * dt;
        if (p.life <= 0) leafParticles.splice(i, 1);
      }

      const cs = roadHitCutscene;
      const dirSign = cs.ambDir === "e" ? 1 : -1;
      // Full Emergency Convoy: Police Cruiser + Newton Fire Engine roll in to lock down the entire block!
      if (cs.phase === "ambulance_in" || cs.phase === "emt_exit" || cs.phase === "emt_treat" || cs.phase === "emt_load") {
        if (!cs.polArrived) {
          cs.polX -= dirSign * 145 * dt;
          if ((dirSign > 0 && cs.polX <= cs.polStopX) || (dirSign < 0 && cs.polX >= cs.polStopX)) {
            cs.polX = cs.polStopX;
            cs.polArrived = true;
            playEmtRadioBeepSfx();
            for (let i = 0; i < 6; i++) {
              leafParticles.push({
                x: cs.polX + (Math.random() * 14 - 7),
                y: cs.polY + 6,
                vx: -dirSign * (12 + Math.random() * 18),
                vy: -8 - Math.random() * 12,
                life: 0.36,
                shade: [224, 230, 238],
                w: 3,
                h: 3,
              });
            }
          }
        }
        if (!cs.fireArrived) {
          cs.fireX += dirSign * 125 * dt;
          if ((dirSign > 0 && cs.fireX >= cs.fireStopX) || (dirSign < 0 && cs.fireX <= cs.fireStopX)) {
            cs.fireX = cs.fireStopX;
            cs.fireArrived = true;
            for (let i = 0; i < 8; i++) {
              leafParticles.push({
                x: cs.fireX + (Math.random() * 20 - 10),
                y: cs.fireY + 7,
                vx: dirSign * (10 + Math.random() * 16),
                vy: -8 - Math.random() * 12,
                life: 0.38,
                shade: [232, 236, 242],
                w: 3,
                h: 3,
              });
            }
          }
        }
        // Once Police arrive, officers sprint out and unroll CAUTION tape + drop cones & road flares!
        if (cs.polArrived && cs.tapeProgress < 1) {
          cs.tapeProgress = Math.min(1, cs.tapeProgress + dt * 0.72);
        }
      }

      if (cs.phase === "hit") {
        cs.timer -= dt;
        if (cs.timer <= 0) {
          cs.phase = "ambulance_in";
          cs.sirenTimer = 0;
          playAmbulanceSirenSfx();
        }
      } else if (cs.phase === "ambulance_in") {
        cs.sirenTimer -= dt;
        if (cs.sirenTimer <= 0) {
          playAmbulanceSirenSfx();
          cs.sirenTimer = 0.58;
        }
        cs.dustTimer = (cs.dustTimer || 0) - dt;
        if (cs.dustTimer <= 0) {
          cs.dustTimer = 0.06;
          leafParticles.push({
            x: cs.ambX - dirSign * 22,
            y: cs.ambY + 6,
            vx: -dirSign * (14 + Math.random() * 16),
            vy: -10 - Math.random() * 8,
            life: 0.32,
            shade: [228, 232, 240],
            w: 3,
            h: 3,
          });
        }
        cs.ambX += dirSign * 145 * dt;
        if ((dirSign > 0 && cs.ambX >= cs.stopAmbX) || (dirSign < 0 && cs.ambX <= cs.stopAmbX)) {
          cs.ambX = cs.stopAmbX;
          cs.phase = "emt_exit";
          cs.timer = 1.25;
          cs.emtProgress = 0;
          playEmtRadioBeepSfx();
          for (let i = 0; i < 8; i++) {
            leafParticles.push({
              x: cs.ambX + (Math.random() * 24 - 12),
              y: cs.ambY + 7,
              vx: dirSign * (10 + Math.random() * 20),
              vy: -10 - Math.random() * 12,
              life: 0.38,
              shade: [232, 236, 242],
              w: 3,
              h: 3,
            });
          }
          ui.showSafetyToast("🚧 Police rolling out CAUTION tape & cones while EMTs rush out!", 2000);
        }
      } else if (cs.phase === "emt_exit") {
        cs.timer -= dt;
        cs.emtProgress = Math.min(1, 1 - cs.timer / 1.25);
        if (cs.timer <= 0) {
          cs.phase = "emt_treat";
          cs.timer = 1.1;
          cs.emtProgress = 0;
          cs.dustTimer = 0;
          playEmtRadioBeepSfx();
          ui.showSafetyToast(`🩺 Paramedics tending ${heroName} inside the CAUTION tape perimeter!`, 1800);
        }
      } else if (cs.phase === "emt_treat") {
        cs.timer -= dt;
        cs.emtProgress = Math.min(1, 1 - cs.timer / 1.1);
        cs.dustTimer = (cs.dustTimer || 0) - dt;
        if (cs.dustTimer <= 0) {
          cs.dustTimer = 0.14;
          leafParticles.push({
            x: cs.hitX + (Math.random() * 16 - 8),
            y: cs.hitY - 8,
            vx: (Math.random() - 0.5) * 14,
            vy: -22 - Math.random() * 12,
            life: 0.42,
            shade: Math.random() < 0.5 ? [92, 245, 148] : [255, 255, 255],
            w: 3,
            h: 3,
          });
        }
        if (cs.timer <= 0) {
          cs.phase = "emt_load";
          cs.timer = 1.4;
          cs.emtProgress = 0;
          playEmtRadioBeepSfx();
          ui.showSafetyToast(`🚑 Wheeling ${heroName} onto the ambulance ramp!`, 1800);
        }
      } else if (cs.phase === "emt_load") {
        cs.timer -= dt;
        cs.emtProgress = Math.min(1, 1 - cs.timer / 1.4);
        if (cs.timer <= 0) {
          cs.phase = "ambulance_out";
          cs.timer = 1.5;
          cs.sirenTimer = 0;
          playAmbulanceSirenSfx();
        }
      } else if (cs.phase === "ambulance_out") {
        cs.sirenTimer -= dt;
        if (cs.sirenTimer <= 0) {
          playAmbulanceSirenSfx();
          cs.sirenTimer = 0.54;
        }
        cs.dustTimer = (cs.dustTimer || 0) - dt;
        if (cs.dustTimer <= 0) {
          cs.dustTimer = 0.05;
          leafParticles.push({
            x: cs.ambX - dirSign * 22,
            y: cs.ambY + 7,
            vx: -dirSign * (18 + Math.random() * 16),
            vy: -10 - Math.random() * 10,
            life: 0.34,
            shade: [228, 232, 240],
            w: 3,
            h: 3,
          });
        }
        cs.ambX += dirSign * 172 * dt;
        cs.polX += dirSign * 125 * dt;
        cs.fireX += dirSign * 135 * dt;
        cs.timer -= dt;
        if (cs.timer <= 0) {
          // Cut to Home Base with Mom yelling that she's SO happy you're alive — AND YOU'RE GROUNDED FOREVER!
          cs.phase = "mom_yelling";
          resetToHome();
          const momNpc = questSystem.npcs.find((n) => n.id === "home_base");
          if (momNpc) {
            playerState.x = momNpc.walkTileX * tileSize + tileSize / 2;
            playerState.y = (momNpc.walkTileY + 1) * tileSize + tileSize / 2;
            playerState.facing = "up";
          }
          cam = clampCamera(playerState.x, playerState.y);
          k.setCamPos(cam.x, cam.y);
          k.setCamRot(0);
          playCurbStopBoop();
          const culprit =
            cs.vehicleKind === "bike"
              ? "an annoying spandex biker"
              : cs.vehicleKind === "truck"
                ? "a giant truck"
                : "a car";
          ui.openDialogue({
            speaker: `Mom • ${homeAddrLabel}`,
            lines: [
              `${heroName.toUpperCase()}!! OH MY GOODNESS, I AM SO HAPPY YOU'RE ALIVE!!`,
              `The EMS paramedics brought you all the way home after you got hit by ${culprit} — you ALWAYS have to watch out for traffic on the road!!`,
              "Thank goodness you're okay... AND YOU ARE GROUNDED FOREVER!!",
            ],
            onComplete: () => {
              if (!roadHitCutscene) return;
              roadHitCutscene.phase = "game_over";
              playGameOverDirge();
              ui.openGameOver(roadHitCutscene.vehicleKind);
            },
          });
        }
      }

      // Keep camera locked on accident site until cut to Home Base
      if (cs.phase !== "mom_yelling" && cs.phase !== "game_over") {
        let cPos = clampCamera(cs.hitX, cs.hitY);
        if (playerState.hurtShakeTimer > 0) {
          const mag = Math.ceil((playerState.hurtShakeTimer / 0.55) * 4);
          cPos = {
            x: cPos.x + Math.round(Math.sin(playerState.elapsedTime * 80) * mag),
            y: cPos.y + Math.round(Math.cos(playerState.elapsedTime * 68) * mag),
          };
        }
        cam = cPos;
        k.setCamPos(cam.x, cam.y);
        k.setCamRot(0);
      }
      return;
    }

    // Brief 0-Heart KO freeze (from losing all 5 hearts to bad guys) -> send Liam back to Home Base!
    if (playerState.koRespawnTimer > 0) {
      playerState.koRespawnTimer = Math.max(0, playerState.koRespawnTimer - dt);
      if (playerState.hurtShakeTimer > 0) {
        playerState.hurtShakeTimer = Math.max(0, playerState.hurtShakeTimer - dt);
      }
      if (playerState.koRespawnTimer <= 0) {
        playerState.hearts = playerState.maxHearts;
        playerState.hurtTimer = 0;
        playerState.knockbackTimer = 0;
        resetToHome();
        playHealHeartSfx();
        ui.showSafetyToast("🏠 Out of hearts! Mom patched you up back at Home Base! ❤️❤️❤️❤️❤️", 3000);
      }
      return;
    }

    // Legend of Zelda: BotW Sheikah Fast-Travel Sequence (Dematerialize -> High-Speed Glide -> Rematerialize!)
    if (botwTeleport) {
      const bt = botwTeleport;
      bt.timer += dt;

      for (let i = leafParticles.length - 1; i >= 0; i--) {
        const p = leafParticles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (!p.noGravity) p.vy += 65 * dt;
        if (p.life <= 0) leafParticles.splice(i, 1);
      }

      if (bt.phase === "out") {
        const p = Math.min(1, bt.timer / bt.duration);
        if (Math.random() < 0.85) {
          const ang = Math.random() * Math.PI * 2;
          const r = 4 + Math.random() * 14;
          leafParticles.push({
            x: bt.fromX + Math.cos(ang) * r,
            y: bt.fromY - Math.random() * 18,
            vx: Math.cos(ang) * 8,
            vy: -58 - p * 95,
            life: 0.34 + Math.random() * 0.22,
            shade: Math.random() < 0.35 ? [232, 252, 255] : [48, 224, 255],
            w: 2,
            h: 4,
            noGravity: true,
          });
        }
        const shake = p > 0.65 ? Math.round(Math.sin(playerState.elapsedTime * 75) * 1.5) : 0;
        const cPos = clampCamera(bt.fromX, bt.fromY);
        cam = { x: cPos.x + shake, y: cPos.y };
        k.setCamPos(cam.x, cam.y);
        k.setCamRot(0);

        if (bt.timer >= bt.duration) {
          bt.phase = "glide";
          bt.timer = 0;
          bt.duration = 0.48;
          // Burst of departing blue-cyan Sheikah pixels
          for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            leafParticles.push({
              x: bt.fromX,
              y: bt.fromY - 12,
              vx: Math.cos(ang) * 44,
              vy: Math.sin(ang) * 24 - 60,
              life: 0.42,
              shade: i % 2 === 0 ? [62, 232, 255] : [220, 252, 255],
              w: 2,
              h: 3,
              noGravity: true,
            });
          }
        }
      } else if (bt.phase === "glide") {
        const t = Math.min(1, bt.timer / bt.duration);
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const gx = bt.fromX + (bt.toX - bt.fromX) * ease;
        const gy = bt.fromY + (bt.toY - bt.fromY) * ease;
        cam = clampCamera(gx, gy);
        k.setCamPos(cam.x, cam.y);
        k.setCamRot(0);

        if (Math.random() < 0.9) {
          leafParticles.push({
            x: gx + (Math.random() * 14 - 7),
            y: gy + (Math.random() * 14 - 7),
            vx: (bt.fromX - bt.toX) * 0.08,
            vy: (bt.fromY - bt.toY) * 0.08,
            life: 0.25,
            shade: Math.random() < 0.4 ? [225, 252, 255] : [40, 214, 255],
            w: 3,
            h: 2,
            noGravity: true,
          });
        }

        if (bt.timer >= bt.duration) {
          playerState.x = bt.toX;
          playerState.y = bt.toY;
          playerState.facing = "down";
          playerState.moving = false;
          playerState.isWading = false;
          playerState.safeCrossingTimer = 0;
          playerState.hasEnteredRoadSinceLook = false;
          questSystem.revealFogAtTile(bt.toTx, bt.toTy, 3);
          playBotwTeleportInSfx();
          for (let i = 0; i < 18; i++) {
            const ang = (i / 18) * Math.PI * 2;
            leafParticles.push({
              x: bt.toX + Math.cos(ang) * 26,
              y: bt.toY - 26 + Math.sin(ang) * 14,
              vx: -Math.cos(ang) * 32,
              vy: 28 - Math.sin(ang) * 12,
              life: 0.45,
              shade: i % 2 === 0 ? [58, 230, 255] : [225, 252, 255],
              w: 2,
              h: 4,
              noGravity: true,
            });
          }
          bt.phase = "in";
          bt.timer = 0;
          bt.duration = 0.85;
        }
      } else if (bt.phase === "in") {
        const p = Math.min(1, bt.timer / bt.duration);
        cam = clampCamera(bt.toX, bt.toY);
        k.setCamPos(cam.x, cam.y);
        k.setCamRot(0);

        if (p < 0.72 && Math.random() < 0.75) {
          const ang = Math.random() * Math.PI * 2;
          const r = (1 - p) * 20 + 3;
          leafParticles.push({
            x: bt.toX + Math.cos(ang) * r,
            y: bt.toY - 46 + p * 34,
            vx: -Math.cos(ang) * 14,
            vy: 34,
            life: 0.3,
            shade: Math.random() < 0.35 ? [242, 252, 255] : [48, 224, 255],
            w: 2,
            h: 3,
            noGravity: true,
          });
        }

        if (bt.timer >= bt.duration) {
          const destZone = safety.getStreetZoneAt(bt.toTx, bt.toTy);
          refreshPocketDirections(bt.toTx, bt.toTy, destZone?.name || "Fast-Travel");
          botwTeleport = null;
          ui.showSafetyToast(
            destZone?.name
              ? `✨ Arrived near ${destZone.name} via Sheikah Fast-Travel!`
              : "✨ Arrived via Sheikah Fast-Travel!",
            2200
          );
        }
      }
      return;
    }

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

    if (ui.isDialogueOpen() || ui.isPaintOpen() || ui.isSignOpen() || studio.isOpen()) {
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
    if (playerState.waterToastCooldown > 0) {
      playerState.waterToastCooldown = Math.max(0, playerState.waterToastCooldown - dt);
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
    if (playerState.swordSwingTimer > 0) {
      playerState.swordSwingTimer = Math.max(0, playerState.swordSwingTimer - dt);
    }
    if (playerState.swordCooldown > 0) {
      playerState.swordCooldown = Math.max(0, playerState.swordCooldown - dt);
    }
    if (playerState.siddurAuraTimer > 0) {
      playerState.siddurAuraTimer = Math.max(0, playerState.siddurAuraTimer - dt);
    }
    if (playerState.siddurCooldown > 0) {
      playerState.siddurCooldown = Math.max(0, playerState.siddurCooldown - dt);
    }
    if (playerState.jostleTimer > 0) {
      playerState.jostleTimer = Math.max(0, playerState.jostleTimer - dt);
    }
    if (playerState.throwAnimTimer > 0) {
      playerState.throwAnimTimer = Math.max(0, playerState.throwAnimTimer - dt);
    }
    for (const st of npcAnimState.values()) {
      if (st.celebrateTimer > 0) st.celebrateTimer = Math.max(0, st.celebrateTimer - dt);
      if (st.greetWaveTimer > 0) st.greetWaveTimer = Math.max(0, st.greetWaveTimer - dt);
    }

    // Advance tailored world FX (skeleton bone collapse, phantom vortex, Siddur beams, flashlight cones, jostle wind)
    for (let i = worldFx.length - 1; i >= 0; i--) {
      const fx = worldFx[i];
      fx.t += dt;
      if (fx.kind === "skeleton_defeat" && fx.pieces) {
        for (const pc of fx.pieces) {
          pc.x += pc.vx * dt;
          pc.y += pc.vy * dt;
          pc.vy += 170 * dt;
          pc.rot = (pc.rot || 0) + (pc.rotSpd || 0) * dt;
          if (pc.y > fx.groundY) {
            pc.y = fx.groundY;
            pc.vy = -Math.abs(pc.vy) * 0.42;
            pc.vx *= 0.72;
            pc.rotSpd *= 0.72;
          }
        }
      }
      if (fx.t >= fx.duration) {
        worldFx.splice(i, 1);
      }
    }

    // Gentle drifting golden-hour autumn leaves across the outdoor viewport!
    for (const al of ambientLeaves) {
      al.ox += (al.vx + Math.sin(playerState.elapsedTime * 2.2 + al.phase) * 5) * dt;
      al.oy += al.vy * dt;
      if (al.ox > VIEW_W / 2 + 12) al.ox = -VIEW_W / 2 - 12;
      if (al.oy > VIEW_H / 2 + 12) al.oy = -VIEW_H / 2 - 12;
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
      if (p.rotSpd) p.rot = (p.rot || 0) + p.rotSpd * dt;
      if (!p.noGravity) p.vy += 65 * dt;
      if (p.life <= 0) leafParticles.splice(i, 1);
    }

    for (let i = tossedSnacks.length - 1; i >= 0; i--) {
      const s = tossedSnacks[i];
      s.t += dt;
      const frac = Math.min(1, s.t / s.duration);
      s.x = s.startX + (s.targetX - s.startX) * frac;
      s.y = s.startY + (s.targetY - s.startY) * frac - Math.sin(frac * Math.PI) * 18;
      if (s.t >= s.duration) {
        tossedSnacks.splice(i, 1);
      }
    }

    for (let i = groundDrops.length - 1; i >= 0; i--) {
      const d = groundDrops[i];
      d.age += dt;
      const dist = Math.hypot(d.x - playerState.x, d.y - playerState.y);
      if (d.age > 0.25 && dist < 14) {
        if (d.kind === "coin") {
          questSystem.state.coins += 1;
          playCoinPickup();
          ui.showSafetyToast("🪙 Found a Neighborhood Coin!", 1500);
        } else {
          questSystem.state.acorns += 1;
          playAcornPickupSfx();
          ui.showSafetyToast("🌰 Found a Lucky Acorn! (Great for feeding wild animals with N!)", 1800);
        }
        questSystem.save();
        groundDrops.splice(i, 1);
      } else if (d.age > 15) {
        groundDrops.splice(i, 1);
      }
    }

    // --- Inside Home Base (565 Boylston St) Indoor Exploration Loop ---
    if (homeInterior.state.active) {
      const input = readInput();
      const speedMult = input.wantsFaster ? 1.35 : 1.0;
      const moved = moveWithCollision(
        playerState,
        input,
        dt,
        homeInterior.isInteriorBoxBlocked,
        { speed: PLAYER_SPEED_PX * speedMult, tileSize }
      );
      playerState.x = moved.x;
      playerState.y = moved.y;
      playerState.facing = moved.facing;
      playerState.moving = moved.moving;
      playerState.isWading = false;
      isFasterNow = false;
      isFastWadingNow = false;
      homeInterior.state.x = playerState.x;
      homeInterior.state.y = playerState.y;

      if (moved.moving) {
        playerState.walkTimer += dt * 9;
        playerState.stepSoundCooldown -= dt;
        if (playerState.stepSoundCooldown <= 0) {
          const curRoom = homeInterior.getRoom();
          playStepTick(curRoom.id === "dnd_basement" ? "dungeon" : "indoors", input.wantsFaster);
          playerState.stepSoundCooldown = input.wantsFaster ? 0.19 : 0.24;
        }
      } else {
        playerState.walkTimer = 0;
        playerState.stepSoundCooldown = 0;
      }

      const room = homeInterior.getRoom();
      // Walking straight south off the front-door welcome mat smoothly exits back outside!
      if (
        room.id === "main_floor" &&
        input.y > 0 &&
        playerState.x >= 8.8 * tileSize &&
        playerState.x <= 10.6 * tileSize &&
        playerState.y >= 10.45 * tileSize
      ) {
        leaveHouseToOutdoor();
        return;
      }

      const roomPxW = room.width * tileSize;
      const roomPxH = room.height * tileSize;
      const cx = roomPxW <= VIEW_W ? roomPxW / 2 : Math.max(VIEW_W / 2, Math.min(roomPxW - VIEW_W / 2, playerState.x));
      const cy = roomPxH <= VIEW_H ? roomPxH / 2 : Math.max(VIEW_H / 2, Math.min(roomPxH - VIEW_H / 2, playerState.y));
      cam = { x: Math.round(cx), y: Math.round(cy) };
      k.setCamPos(cam.x, cam.y);
      k.setCamRot(0);

      const nearProp = homeInterior.findNearbyInteriorProp(playerState.x, playerState.y);
      const gear = questSystem.getGear();
      ui.updateHUD({
        tileX: Math.floor(playerState.x / tileSize),
        tileY: Math.floor(playerState.y / tileSize),
        tileType: room.id === "dnd_basement" ? "dungeon" : "indoors",
        streetZone: { name: room.name, type: room.tag },
        originName: room.name,
        nearestLandmark: null,
        nearestBuilding: null,
        nearbyInteraction: nearProp,
        alternateInteraction: null,
        facingUncheckedRoad: false,
        questHint: questSystem.formatTargetHint(spawnTile.x, spawnTile.y),
        pocketDirections,
        signBanner: { title: `🏠 ${room.name}`, tag: room.tag, unknown: false },
        navMode: questSystem.state.navMode,
        gpsAssist: Boolean(questSystem.state.gpsAssist),
        heroOutfit: questSystem.state.heroOutfit,
        unlockedOutfitsCount: questSystem.getUnlockedOutfits().length,
        checkedSignsCount: questSystem.state.checkedSigns.size,
        checkedStreets: questSystem.state.checkedStreets,
        gearLabel: gear.label,
        debugEnabled: showDebug,
        muted: isMuted(),
        safetyXP: questSystem.state.safetyXP,
        coins: questSystem.state.coins,
        acorns: questSystem.state.acorns,
        snacks: questSystem.state.snacks,
        hasSnack: questSystem.hasSnack(),
        hearts: playerState.hearts,
        maxHearts: playerState.maxHearts,
        hasSword: questSystem.hasSword(),
        hasSiddur: questSystem.hasSiddur(),
        canEnterHouse: false,
        isInsideHouse: true,
        canGiveSnack: false,
        isFasterActive: false,
        isWading: false,
        isFastWading: false,
        safeCrossingActive: false,
        needsLookAtCurb: false,
      });
      return;
    }

    const curTileType = safety.getTileTypeAtPx(playerState.x, playerState.y);
    const alreadyInWater = safety.isBoxTouchingTileType(
      playerState.x,
      playerState.y,
      "water",
      DEFAULT_HITBOX
    );
    const canWadeWater = questSystem.canWadeWater() || alreadyInWater;
    const baseMapBlocker = (nx, ny, hb) =>
      collider.isBoxBlocked(nx, ny, hb, { canWadeWater });
    const gear = questSystem.getGear();

    isFasterNow = false;
    isFastWadingNow = false;

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
        baseMapBlocker,
        playerState.x,
        playerState.y,
        playerState.safeCrossingTimer > 0,
        DEFAULT_HITBOX
      );
      const kbMoved = moveWithCollision(playerState, kbInput, dt, kbRoadBlocker.isBoxBlocked, {
        speed: kbSpeed,
        tileSize,
      });
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
      const inWater = curTileType === "water";
      const baseSafetyMult = safety.getSpeedMultiplier(
        curTileType,
        input.wantsFaster,
        playerState.safeCrossingTimer > 0
      );
      const effectiveMult = inWater
        ? baseSafetyMult
        : baseSafetyMult > 1
          ? Math.max(baseSafetyMult, gear.mult)
          : 1;

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

      const hasMoveInput = moveInput.x !== 0 || moveInput.y !== 0;
      isFasterNow = !inWater && effectiveMult > 1 && hasMoveInput;
      isFastWadingNow = inWater && input.wantsFaster && hasMoveInput;

      if (isFasterNow && !playerState.wasFasterActive) {
        playBoostWhoosh();
      }
      playerState.wasFasterActive = isFasterNow;

      const roadBlocker = safety.createRoadAwareBlocker(
        baseMapBlocker,
        playerState.x,
        playerState.y,
        playerState.safeCrossingTimer > 0,
        DEFAULT_HITBOX
      );

      const isPreferredPathTile = (ptx, pty) => {
        const t = safety.getTileType(ptx, pty);
        return t === "sidewalk" || t === "dirt" || t === "park" || t === "sand";
      };

      const isPreferredPathPx = (ppx, ppy) => {
        const t = safety.getTileTypeAtPx(ppx, ppy);
        return t === "sidewalk" || t === "dirt" || t === "park" || t === "sand" || t === "grass";
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
          maxSlidePx: 6,
          isPreferredPathTile,
          isPreferredPathPx,
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
      } else if (!canWadeWater && roadBlocker.wasBlockedByWater() && !moved.slidCorner) {
        if (playerState.curbStopToastCooldown <= 0) {
          playCurbStopBoop();
          ui.showSafetyToast(
            "🏊 Water's too deep! Unlock the Summer Wetsuit & Snorkel outfit to wade through water!",
            2600
          );
          playerState.curbStopToastCooldown = 1.6;
        }
      }

      const nowTx = Math.floor(playerState.x / tileSize);
      const nowTy = Math.floor(playerState.y / tileSize);
      const nowWading = safety.getTileType(nowTx, nowTy) === "water";
      if (nowWading && !playerState.isWading) {
        playWaterSplash(true);
        spawnWaterSplashBurst(playerState.x, playerState.y + 1, 9, 44);
        if (playerState.waterToastCooldown <= 0) {
          ui.showSafetyToast("🤿 Splash! Wading through the water in your swim outfit!", 2200);
          playerState.waterToastCooldown = 8;
        }
      }
      playerState.isWading = nowWading;

      if (moved.moving) {
        playerState.walkTimer += dt * (isFasterNow ? 14 : nowWading ? (isFastWadingNow ? 10 : 6.5) : 9);
        playerState.stepSoundCooldown -= dt;
        if (playerState.stepSoundCooldown <= 0) {
          if (nowWading) {
            playWaterSplash(isFastWadingNow);
            spawnWaterSplashBurst(
              playerState.x,
              playerState.y + 2,
              isFastWadingNow ? 4 : 2,
              isFastWadingNow ? 36 : 22
            );
            playerState.stepSoundCooldown = isFastWadingNow ? 0.22 : 0.34;
          } else {
            playStepTick(curTileType, isFasterNow);
            playerState.stepSoundCooldown = isFasterNow ? 0.15 : 0.24;
          }
        }
        if (isFasterNow && !nowWading) {
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

    // Update roving wild Newton turkeys, squirrels, cats, leash-trailing dogs, peaceful marchers & spooky graveyard characters!
    updateStreetLife(streetLife, dt, playerState, worldMap, {
      isFasterNow,
      tileSize,
      graveyardGhosts: graveyardFeatures.ghosts,
      elapsedTime: playerState.elapsedTime,
      hasLantern: questSystem.hasLantern(),
      onTurkeyGobble: () => playTurkeyGobble(),
      onCritterSound: (cr) => {
        if (cr.kind === "squirrel") playSquirrelChitter();
        else if (cr.kind === "cat") playCatMeow();
        else if (cr.kind === "dog") playDogBark();
      },
      onProtestorShout: () => playProtestorShout(),
      onSpookyChime: () => playSpookyChime(),
      onFeatherBurst: (fx, fy) => spawnFeatherBurst(fx, fy),
      onJoggerAnnoy: (jg, jostled) => {
        playAnnoyingJoggerSfx(jostled);
        // Flying 2x HD cyan sweat droplets & bright Strava watch sparkles!
        const count = jostled ? 6 : 3;
        for (let i = 0; i < count; i++) {
          leafParticles.push({
            x: jg.x + (Math.random() * 8 - 4),
            y: jg.y - 18 + (Math.random() * 6 - 3),
            vx: -jg.dx * (16 + Math.random() * 20) + (Math.random() - 0.5) * 18,
            vy: -18 - Math.random() * 18,
            life: 0.42 + Math.random() * 0.16,
            sprite: i % 2 === 0 ? "fx_sweat_drop" : "fx_sparkle_gold",
          });
        }
        if (jostled) {
          // Gentle comedic sidewalk shoulder-nudge + startled hop & comic wind-swirl (strictly 0 heart damage!)
          const perpX = -jg.dy || (playerState.x >= jg.x ? 1 : -1);
          const perpY = jg.dx || (playerState.y >= jg.y ? 1 : -1);
          playerState.jostleTimer = 0.55;
          playerState.jostleDirX = perpX;
          playerState.jostleDirY = perpY;
          worldFx.push({
            kind: "jostle_wind",
            x: (playerState.x + jg.x) * 0.5,
            y: (playerState.y + jg.y) * 0.5 - 8,
            dx: jg.dx,
            dy: jg.dy,
            t: 0,
            duration: 0.48,
          });
          const nudgeX = playerState.x + perpX * 4.5;
          const nudgeY = playerState.y + perpY * 4.5;
          const nudgeRoadCheck = safety.isBoxOnRoad(nudgeX, nudgeY, DEFAULT_HITBOX);
          if (!nudgeRoadCheck && !baseMapBlocker(nudgeX, nudgeY, DEFAULT_HITBOX)) {
            playerState.x = nudgeX;
            playerState.y = nudgeY;
          }
          const chant = JOGGER_CHANTS[(jg.chantIndex ?? 0) % JOGGER_CHANTS.length] || "ON YOUR LEFT!!";
          ui.showSafetyToast(`🏃 "${chant}" An annoying marathoner zoomed right past you!`, 2200);
        }
      },
      onPlayerBump: (bump) => {
        if (bump.kind === "spooky") {
          playSpookyBooSfx();
        } else if (bump.kind === "squirrel") {
          playSquirrelChitter();
        } else if (bump.kind === "cat") {
          playCatMeow();
        } else if (bump.kind === "dog") {
          playDogBark();
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
            ? "💔 You lost all 5 hearts! Heading back to Home Base..."
            : `${bump.toast} (${playerState.hearts}/${playerState.maxHearts} ❤️)`;
        ui.showSafetyToast(msg, 2400);
        if (playerState.hearts === 0 && playerState.koRespawnTimer <= 0) {
          playerState.koRespawnTimer = 1.15;
          playerState.moving = false;
        }
      },
    });

    // Update moving cars, trucks & annoying bikers on Newton's roads! Getting hit triggers the Ambulance -> EMT -> Mom -> GAME OVER cutscene!
    updateRoadTraffic(roadTraffic, dt, playerState, worldMap, {
      tileSize,
      safeCrossingActive: playerState.safeCrossingTimer > 0,
      onHitPlayer: (hit) => startRoadHitCutscene(hit),
      onBikerAnnoy: () => playAnnoyingBikerSfx(),
    });
    if (roadHitCutscene) return;

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
    const tileType = safety.getTileTypeAtPx(playerState.x, playerState.y);
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
          healPlayerHearts(2, "Quest Complete");
          ui.showSafetyToast(`🏆 Quest Complete: ${ev.quest.title}! (+Hearts!)`, 2800);
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
    isInGraveyardNow = Boolean(activeGraveyard);
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

    const hudTileKey = `${tx},${ty}`;
    if (hudTileKey !== lastHudTileKey) {
      lastHudTileKey = hudTileKey;
      cachedNearbyHouses = buildingIndex.queryBounds(tx - 5, ty - 5, tx + 5, ty + 5);
      cachedNearestBuilding = findNearestBuilding(cachedNearbyHouses, tx, ty);
      cachedNearestLandmark = findNearestLandmark(tx, ty);
    }
    const subCellSz = safety.subCellSize || 4;
    const hudSubKey = `${Math.floor(playerState.x / subCellSz)},${Math.floor(playerState.y / subCellSz)}`;
    if (hudSubKey !== playerState.lastCurbSubKey) {
      playerState.lastCurbSubKey = hudSubKey;
      cachedCurbContext = safety.inspectCrossingContextAtPx(playerState.x, playerState.y);
    }
    const nearUncheckedRoad =
      playerState.safeCrossingTimer <= 0 &&
      !safety.isBoxOnRoad(playerState.x, playerState.y, DEFAULT_HITBOX) &&
      (cachedCurbContext.context === "crosswalk" ||
        cachedCurbContext.context === "highway" ||
        cachedCurbContext.context === "main_road" ||
        cachedCurbContext.context === "residential");

    const actionIntent = getCurrentActionIntent(tx, ty);
    lastActionIntent = actionIntent;
    if (hudTileKey !== lastPromptSignTileKey) {
      lastPromptSignTileKey = hudTileKey;
      lastNearestPromptSign = streetSignSystem.findNearbySign(tx, ty, 1.85);
    }
    const nearbyInteract = actionIntent.mode === "interact" ? actionIntent.interaction : null;
    const signBanner = resolveSignBanner(tx, ty, streetZone, activeGraveyard);

    const nearSnackTarget = findNearbySnackTarget(streetLife, playerState.x, playerState.y, 72);
    ui.updateHUD({
      tileX: tx,
      tileY: ty,
      tileType,
      streetZone: effectiveStreetZone,
      originName: worldMap.origin?.name,
      nearestLandmark: cachedNearestLandmark,
      nearestBuilding: cachedNearestBuilding,
      nearbyInteraction: nearbyInteract,
      alternateInteraction: actionIntent.alternateInteraction,
      facingUncheckedRoad: actionIntent.facingUncheckedRoad,
      questHint: questSystem.formatTargetHint(tx, ty),
      pocketDirections,
      signBanner,
      navMode: questSystem.state.navMode,
      gpsAssist,
      heroOutfit: questSystem.state.heroOutfit,
      unlockedOutfitsCount: questSystem.getUnlockedOutfits().length,
      checkedSignsCount: questSystem.state.checkedSigns.size,
      checkedStreets: questSystem.state.checkedStreets,
      gearLabel: gear.label,
      debugEnabled: showDebug,
      muted: isMuted(),
      safetyXP: questSystem.state.safetyXP,
      coins: questSystem.state.coins,
      acorns: questSystem.state.acorns,
      snacks: questSystem.state.snacks,
      hasSnack: questSystem.hasSnack(),
      hearts: playerState.hearts,
      maxHearts: playerState.maxHearts,
      hasSword: questSystem.hasSword(),
      hasSiddur: questSystem.hasSiddur(),
      canEnterHouse: canEnterNearbyHouse(tx, ty),
      isInsideHouse: false,
      canGiveSnack: Boolean(nearSnackTarget),
      snackTargetKind: nearSnackTarget?.kind || null,
      isFasterActive: isFasterNow,
      isWading: playerState.isWading,
      isFastWading: isFastWadingNow,
      safeCrossingActive: playerState.safeCrossingTimer > 0,
      needsLookAtCurb: playerState.curbStopCueTimer > 0 || actionIntent.facingUncheckedRoad || nearUncheckedRoad,
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

    if (tileId === 12 || tileId === 2 || tileId === 3) {
      // Crisp, clean Newton roads: Highway (2 lanes each side of barrier w/ white separators),
      // Town Avenues (mostly 1 lane each way, 2 lanes each way on select wide Newton Centre roads),
      // and Side Streets (single crisp yellow centerline, dotted or solid)!
      if (tileId === 12) {
        k.drawSprite((tx + ty) % 2 === 0 ? "highway_base_0" : "highway_base_1", pxPos, pyPos);
      } else if (tileId === 3) {
        k.drawSprite("road_main_base", pxPos, pyPos);
      } else {
        k.drawSprite((tx + ty) % 2 === 0 ? "road_res_base_0" : "road_res_base_1", pxPos, pyPos);
      }

      const marks = computeRoadTileMarkings(tileAt, tx, ty);
      for (const m of marks) {
        let color;
        let opacity = 1;
        if (m.kind === "curb") {
          color = k.rgb(42, 46, 54);
          opacity = tileId === 2 ? 0.72 : 0.92;
        } else if (m.kind === "shoulder") {
          color = k.rgb(242, 246, 250);
          opacity = tileId === 12 ? 0.92 : 0.82;
        } else if (m.kind === "white_dash") {
          color = k.rgb(246, 249, 252);
          opacity = 0.94;
        } else if (m.kind === "yellow_dash") {
          color = k.rgb(245, 197, 59);
          opacity = 0.92;
        } else {
          // yellow_solid
          color = k.rgb(245, 197, 59);
          opacity = 0.96;
        }
        k.drawRect({
          pos: k.vec2(pxPos + m.x, pyPos + m.y),
          width: m.w,
          height: m.h,
          color,
          opacity,
        });
      }
      return;
    }

    if (tileId === 5) {
      k.drawRect({ pos: k.vec2(pxPos, pyPos), width: tileSize, height: tileSize, color: k.rgb(140, 109, 98) });
    }
  }

  function drawHero() {
    if (
      roadHitCutscene &&
      (roadHitCutscene.phase === "emt_load" ||
        roadHitCutscene.phase === "ambulance_out" ||
        roadHitCutscene.phase === "game_over")
    ) {
      return;
    }
    const pxPos = Math.round(playerState.x);
    const pyPos = Math.round(playerState.y);

    const ringFrame = Math.floor(playerState.elapsedTime * 5) % 2;

    if (playerState.safeCrossingTimer > 0) {
      k.drawSprite(`fx_ring_safe_${ringFrame}`, pxPos - 10, pyPos - 1, 0.88);
    }

    // Protective warm golden-amber circular 2x HD Lantern Halo whenever Liam holds a lantern in spooky areas!
    if (questSystem.hasLantern() && isInGraveyardNow && !botwTeleport) {
      const lanFrame = Math.floor(playerState.elapsedTime * 6) % 2;
      k.drawSprite(`fx_lantern_glow_${lanFrame}`, pxPos - 29, pyPos - 24, 0.92);
    }

    // Expanding radiant circular golden-blue Pocket Siddur blessing wave!
    if (playerState.siddurAuraTimer > 0) {
      const p = 1 - playerState.siddurAuraTimer / 0.78;
      const stage = Math.min(2, Math.floor(p * 3));
      const sprKey = `fx_siddur_ring_${stage}`;
      const rSpr = atlas[sprKey];
      const rw = rSpr ? rSpr.width * (rSpr.__pixelScale || 0.5) : 36;
      const rh = rSpr ? rSpr.height * (rSpr.__pixelScale || 0.5) : 26;
      const alpha = Math.max(0.14, (1 - p) * 0.92);
      k.drawSprite(sprKey, Math.round(pxPos - rw / 2), Math.round(pyPos - rh / 2), alpha);
      // Orbiting golden & cyan blessing sparkles around the wave!
      for (let i = 0; i < 4; i++) {
        const ang = playerState.elapsedTime * 6 + (i * Math.PI) / 2;
        const rx = Math.round(pxPos + Math.cos(ang) * (12 + p * 34) - 3);
        const ry = Math.round(pyPos + Math.sin(ang) * (8 + p * 22) - 4);
        k.drawSprite(i % 2 === 0 ? "fx_sparkle_gold" : "fx_sparkle_cyan", rx, ry, alpha);
      }
    }

    const heroTx = Math.floor(playerState.x / tileSize);
    const heroTy = Math.floor(playerState.y / tileSize);
    const isWading = playerState.isWading || safety.getTileType(heroTx, heroTy) === "water";
    const rawOutfit = isWading ? "wetsuit" : questSystem.state.heroOutfit;
    const outfit = atlas[`hero_${rawOutfit}_down_0`] ? rawOutfit : "polo";
    let sprName;
    if (activeFanfare) {
      sprName = `hero_${outfit}_fanfare`;
    } else if (playerState.swordSwingTimer > 0 && !isWading) {
      // Dynamic forward lunge stride while swinging the Graveyard Sword!
      sprName = `hero_${outfit}_${playerState.facing}_1`;
    } else if (isFasterNow && !isWading) {
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
    const jostleHop =
      playerState.jostleTimer > 0
        ? Math.round(Math.sin((1 - playerState.jostleTimer / 0.55) * Math.PI) * 4)
        : 0;
    const throwHop =
      playerState.throwAnimTimer > 0
        ? Math.round(Math.sin((1 - playerState.throwAnimTimer / 0.24) * Math.PI) * 2)
        : 0;
    const hopOffset = (isKnockback ? Math.round(Math.sin(kbProgress * Math.PI) * 5) : 0) + jostleHop + throwHop;
    const jostleWobbleX =
      playerState.jostleTimer > 0
        ? Math.round(Math.sin(playerState.elapsedTime * 38) * 1.5)
        : 0;
    // Quick forward lunge step while swinging the Graveyard Sword!
    let lungeX = 0;
    let lungeY = 0;
    if (playerState.swordSwingTimer > 0) {
      const lp = Math.sin(Math.max(0, 1 - playerState.swordSwingTimer / 0.28) * Math.PI);
      const distL = Math.round(lp * 3);
      if (playerState.facing === "right") lungeX = distL;
      else if (playerState.facing === "left") lungeX = -distL;
      else if (playerState.facing === "down") lungeY = distL;
      else lungeY = -distL;
    }
    // Classic 16-bit SNES invulnerability blink during hurt window!
    const hurtBlinkHide = isHurt && !isKnockback && Math.floor(playerState.elapsedTime * 18) % 2 === 0;

    const heroAngle = questSystem.state.navMode === "hard" ? playerState.headingDeg : 0;
    const wadeBob = isWading ? Math.round(Math.sin(playerState.elapsedTime * (playerState.moving ? 8 : 3.5)) * 0.8) : 0;
    const wadeSink = isWading ? 3 + wadeBob : 0;

    if (isWading) {
      // Crisp 2x HD elliptical water-ripple rings around Liam as he wades through lakes & ponds!
      const ripFrame = Math.floor(playerState.elapsedTime * (playerState.moving ? 7 : 3.5)) % 3;
      k.drawSprite(`fx_water_ripple_${ripFrame}`, pxPos - 14, pyPos - 4, 0.88);
    }

    // BotW Sheikah Fast-Travel vertical levitation & pixel-dissolve phase
    let teleportLift = 0;
    let teleportHide = false;
    if (botwTeleport) {
      const bt = botwTeleport;
      const p = Math.min(1, bt.timer / Math.max(0.01, bt.duration));
      if (bt.phase === "glide") {
        teleportHide = true;
      } else if (bt.phase === "out") {
        teleportLift = Math.round(p * 10);
        if (p > 0.72 || (p > 0.42 && Math.floor(playerState.elapsedTime * 28) % 2 === 0)) {
          teleportHide = true;
        }
      } else if (bt.phase === "in") {
        teleportLift = Math.round((1 - p) * 9);
        if (p < 0.24 || (p < 0.54 && Math.floor(playerState.elapsedTime * 28) % 2 === 0)) {
          teleportHide = true;
        }
      }
    }

    if (!hurtBlinkHide && !teleportHide) {
      k.drawSprite(
        sprName,
        pxPos - 12 + jostleWobbleX + lungeX,
        pyPos - 23 - hopOffset - teleportLift + wadeSink + lungeY,
        1,
        heroAngle,
        pxPos,
        pyPos
      );
    }

    if (playerState.jostleTimer > 0 && !isHurt) {
      const bSpr = atlas.bubble_whoa;
      const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 22;
      const rise = Math.round((1 - playerState.jostleTimer / 0.55) * 4);
      k.drawSprite("bubble_whoa", Math.round(pxPos - bwLog / 2), pyPos - 36 - rise, 1, heroAngle, pxPos, pyPos);
      k.drawSprite("fx_sweat_drop", pxPos + 8, pyPos - 24 - rise, 0.95);
    }

    if (isWading && heroAngle === 0 && !hurtBlinkHide) {
      // Crisp 16-bit water-surface submersion band + sparkling waterline foam across Liam's lower legs!
      const isShoreTile =
        tileAt(heroTx, heroTy - 1) !== 6 ||
        tileAt(heroTx, heroTy + 1) !== 6 ||
        tileAt(heroTx - 1, heroTy) !== 6 ||
        tileAt(heroTx + 1, heroTy) !== 6;
      const waterCover = isShoreTile ? k.rgb(86, 149, 191) : k.rgb(44, 96, 140);
      const foamShift = Math.floor(playerState.elapsedTime * 5) % 2;
      k.drawRect({
        pos: k.vec2(pxPos - 9, pyPos + 1),
        width: 18,
        height: 8,
        color: waterCover,
        opacity: 0.86,
      });
      k.drawRect({
        pos: k.vec2(pxPos - 8 + foamShift, pyPos),
        width: 6,
        height: 1,
        color: k.rgb(236, 250, 255),
        opacity: 0.85,
      });
      k.drawRect({
        pos: k.vec2(pxPos + 1 - foamShift, pyPos + 1),
        width: 7,
        height: 1,
        color: k.rgb(214, 242, 255),
        opacity: 0.8,
      });
    }

    // Gleaming 5-Frame 32-Bit 56x64 Hero Sword Swing Arc (*Minish Cap* / *ALttP* Grade!)
    if (playerState.swordSwingTimer > 0) {
      const f = playerState.facing;
      const swP = Math.min(0.999, Math.max(0, 1 - playerState.swordSwingTimer / 0.28));
      const swFrame = Math.min(4, Math.floor(swP * 5));
      const swKey = atlas[`sword_slash_${f}_${swFrame}`] ? `sword_slash_${f}_${swFrame}` : `sword_slash_${f}`;
      const swSpr = atlas[swKey];
      const swW = swSpr ? swSpr.width * (swSpr.__pixelScale || 0.5) : 28;
      const swH = swSpr ? swSpr.height * (swSpr.__pixelScale || 0.5) : 32;
      const sx =
        (f === "right" ? pxPos - 2 : f === "left" ? pxPos - swW + 2 : Math.round(pxPos - swW / 2)) + lungeX;
      const sy =
        (f === "down" ? pyPos - 10 : f === "up" ? pyPos - swH - 4 : Math.round(pyPos - swH / 2 - 9)) + lungeY;
      k.drawSprite(swKey, sx, sy, 1, heroAngle, pxPos, pyPos);
    }

    // Overhead Glowing Open Pocket Siddur + Golden Sunburst Halo held aloft during dispel wave!
    if (playerState.siddurAuraTimer > 0) {
      const sProg = 1 - playerState.siddurAuraTimer / 0.78;
      const lift = Math.round(Math.sin(sProg * Math.PI) * 5);
      const auraF = Math.floor(playerState.elapsedTime * 10) % 2;
      k.drawSprite(`fx_fanfare_aura_${auraF}`, pxPos - 11, pyPos - 43 - lift, Math.max(0.25, 1 - sProg * 0.6));
      const sidKey = atlas.item_siddur_open ? "item_siddur_open" : "item_siddur";
      k.drawSprite(sidKey, pxPos - 9, pyPos - 39 - lift, 1, heroAngle, pxPos, pyPos);
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

    // Floating 2x HD pixel-heart meter right above Liam whenever damaged!
    if (playerState.ouchBubbleTimer > 0 || playerState.hearts < playerState.maxHearts) {
      const heartY = pyPos - 34 - hopOffset;
      const maxH = playerState.maxHearts || 5;
      const curH = playerState.hearts ?? maxH;
      const startHx = pxPos - Math.floor((maxH * 8 - 1) / 2);
      for (let h = 0; h < maxH; h++) {
        const hx = startHx + h * 8;
        const filled = h < curH;
        const justLost = h === curH && playerState.hurtTimer > 0.4;
        const dropY = justLost ? Math.round((1 - (playerState.hurtTimer - 0.4) / 0.55) * 4) : 0;
        k.drawSprite(
          filled ? "fx_heart_red" : "fx_heart_empty",
          hx,
          heartY + dropY,
          justLost ? 0.6 : 1,
          heroAngle,
          pxPos,
          pyPos
        );
      }
      if (playerState.ouchBubbleTimer > 0) {
        const bKey = playerState.ouchBubbleSprite || "bubble_ouch";
        const bSpr = atlas[bKey];
        const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 22;
        const rise = Math.round((1 - playerState.ouchBubbleTimer / 0.95) * 6);
        k.drawSprite(bKey, Math.round(pxPos - bwLog / 2), heartY - 12 - rise, 1, heroAngle, pxPos, pyPos);
      }
    }

    // Overhead 2x HD Item Fanfare floating item + golden sunburst halo + orbiting sparkles!
    if (activeFanfare) {
      const floatBob = Math.sin(playerState.elapsedTime * 6) * 2;
      const itemY = pyPos - 39 + floatBob;
      const auraF = Math.floor(playerState.elapsedTime * 8) % 2;
      k.drawSprite(`fx_fanfare_aura_${auraF}`, pxPos - 11, itemY - 4, 0.92, heroAngle, pxPos, pyPos);
      const itKey = activeFanfare.itemMeta.sprite || "item_badge";
      const itSpr = atlas[itKey];
      const itW = itSpr ? itSpr.width * (itSpr.__pixelScale || 0.5) : 16;
      k.drawSprite(itKey, Math.round(pxPos - itW / 2), Math.round(itemY), 1, heroAngle, pxPos, pyPos);

      const angle = playerState.elapsedTime * 4;
      for (let i = 0; i < 4; i++) {
        const a = angle + (i * Math.PI) / 2;
        const sx = pxPos - 4 + Math.cos(a) * 13;
        const sy = itemY + 4 + Math.sin(a) * 8;
        k.drawSprite("fanfare_star", sx, sy, 1, heroAngle, pxPos, pyPos);
      }
    }

    if (playerState.curbStopCueTimer > 0 && playerState.lookTimer <= 0 && !activeFanfare) {
      const cueBob = Math.sin(playerState.elapsedTime * 10) * 1.5;
      k.drawSprite("curb_stop_cue", pxPos - 5, pyPos - 32 + cueBob, 1, heroAngle, pxPos, pyPos);
    }

    if (playerState.lookTimer > 0) {
      const scanWave = Math.round(Math.sin(playerState.elapsedTime * 22) * 2);
      if (playerState.facing === "left") {
        k.drawSprite("fx_chalk_arrow", pxPos - 18 + scanWave, pyPos - 17, 0.95, 180);
      } else if (playerState.facing === "right") {
        k.drawSprite("fx_chalk_arrow", pxPos + 10 - scanWave, pyPos - 17, 0.95, 0);
      }
    }
  }

  // --- 8x8-tile Offscreen 4x HD Ground Chunk Cache (512x512 native HD px = 10.67 px/m for crisp vector streets!) ---
  const GROUND_CHUNK_TILES = 8;
  const CHUNK_SCALE = 4;
  const MAX_GROUND_CHUNKS = 48;
  const groundChunkCache = new Map();
  const vectorRoadRenderer = createVectorRoadRenderer(worldMap, GROUND_CHUNK_TILES, biomeConfig);
  const useVectorRoads = vectorRoadRenderer.hasVectorRoads();

  function blitAtlasToCtx(ctx, name, xLog, yLog) {
    const spr = atlas[name];
    if (!spr) return;
    const ps = spr.__pixelScale || 1;
    ctx.drawImage(
      spr,
      xLog * CHUNK_SCALE,
      yLog * CHUNK_SCALE,
      spr.width * ps * CHUNK_SCALE,
      spr.height * ps * CHUNK_SCALE
    );
  }

  function fillRectHD(ctx, xLog, yLog, wLog, hLog, css, alpha = 1) {
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.fillStyle = css;
    ctx.fillRect(xLog * CHUNK_SCALE, yLog * CHUNK_SCALE, wLog * CHUNK_SCALE, hLog * CHUNK_SCALE);
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  /**
   * When 4x HD vector roads are active, infer clean underlying natural ground/sidewalk beneath
   * legacy tile-grid road cells so zero jagged square asphalt corners peek out around smooth curves!
   */
  function inferVectorRoadUnderlayTile(tx, ty) {
    let parkVotes = 0;
    let grassVotes = 0;
    let sidewalkVotes = 0;
    let graveVotes = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= mapW || ny >= mapH) continue;
        const nt = baseLayer[ny * mapW + nx];
        const w = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1;
        if (nt === 1) sidewalkVotes += w;
        else if (nt === 11 || nt === 7) parkVotes += w;
        else if (nt === 0 || nt === 5) grassVotes += w;
        if (graveyardFeatures.graveyardGrid[ny * mapW + nx] !== 0) graveVotes += w;
      }
    }
    if (graveVotes >= 4) return "grave";
    if (parkVotes >= sidewalkVotes && parkVotes >= grassVotes && parkVotes > 0) return 11;
    if (sidewalkVotes >= grassVotes && sidewalkVotes > 0) return 1;
    return 0;
  }

  function roadAsphaltCss(roadId) {
    if (roadId === 12) return "#3d424b";
    if (roadId === 3) return "#4a4f59";
    return "#555a63";
  }

  function outerGroundCss(groundId) {
    if (groundId === 11) return "#6b9c3d";
    if (groundId === 0 || groundId === 7) return "#b87f35";
    if (groundId === 10) return "#dcc282";
    if (groundId === 9) return "#a87e52";
    return "#cfc4ba"; // crisp concrete sidewalk
  }

  // Smooth curved outer corner on a road tile (legacy tile-road fallback when vectorRoads is absent)
  function drawRoadOuterCornerHD(ctx, lx, ly, corner, outerTileId, showShoulder) {
    const x0 = lx * CHUNK_SCALE;
    const y0 = ly * CHUNK_SCALE;
    const S = tileSize * CHUNK_SCALE;
    const r = 5 * CHUNK_SCALE; // 5 logical px corner rounding radius
    let vx, vy, cx, cy, a0, a1;
    if (corner === "nw") {
      vx = x0; vy = y0; cx = x0 + r; cy = y0 + r; a0 = Math.PI; a1 = Math.PI * 1.5;
    } else if (corner === "ne") {
      vx = x0 + S; vy = y0; cx = x0 + S - r; cy = y0 + r; a0 = Math.PI * 1.5; a1 = Math.PI * 2;
    } else if (corner === "sw") {
      vx = x0; vy = y0 + S; cx = x0 + r; cy = y0 + S - r; a0 = Math.PI * 0.5; a1 = Math.PI;
    } else {
      vx = x0 + S; vy = y0 + S; cx = x0 + S - r; cy = y0 + S - r; a0 = 0; a1 = Math.PI * 0.5;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = outerGroundCss(outerTileId);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = "rgb(66,52,54)";
    ctx.lineWidth = 1.25 * CHUNK_SCALE;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r + 0.75 * CHUNK_SCALE, a0, a1);
    ctx.strokeStyle = "rgb(223,208,200)";
    ctx.lineWidth = 0.7 * CHUNK_SCALE;
    ctx.stroke();
    if (showShoulder) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(2, r - 1.3 * CHUNK_SCALE), a0, a1);
      ctx.strokeStyle = "rgba(242,246,250,0.85)";
      ctx.lineWidth = 0.9 * CHUNK_SCALE;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Smooth curved inner asphalt fillet on a sidewalk/grass corner (legacy tile-road fallback)
  function drawRoadInnerFilletHD(ctx, lx, ly, corner, roadTileId) {
    const x0 = lx * CHUNK_SCALE;
    const y0 = ly * CHUNK_SCALE;
    const S = tileSize * CHUNK_SCALE;
    const r = 5 * CHUNK_SCALE;
    let vx, vy, cx, cy, a0, a1;
    if (corner === "se") {
      vx = x0 + S; vy = y0 + S; cx = x0 + S - r; cy = y0 + S - r; a0 = 0; a1 = Math.PI * 0.5;
    } else if (corner === "sw") {
      vx = x0; vy = y0 + S; cx = x0 + r; cy = y0 + S - r; a0 = Math.PI * 0.5; a1 = Math.PI;
    } else if (corner === "ne") {
      vx = x0 + S; vy = y0; cx = x0 + S - r; cy = y0 + r; a0 = Math.PI * 1.5; a1 = Math.PI * 2;
    } else {
      vx = x0; vy = y0; cx = x0 + r; cy = y0 + r; a0 = Math.PI; a1 = Math.PI * 1.5;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = roadAsphaltCss(roadTileId);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = "rgb(66,52,54)";
    ctx.lineWidth = 1.2 * CHUNK_SCALE;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, r - CHUNK_SCALE), a0, a1);
    ctx.strokeStyle = "rgb(223,208,200)";
    ctx.lineWidth = 0.7 * CHUNK_SCALE;
    ctx.stroke();
    ctx.restore();
  }

  // Crisp granite parkway curbing where a grassy boulevard median (PARK/GRASS) meets asphalt directly (e.g. Comm Ave!)
  function drawParkwayMedianCurbsHD(ctx, lx, ly, tx, ty) {
    const n = tileAt(tx, ty - 1);
    const s = tileAt(tx, ty + 1);
    const w = tileAt(tx - 1, ty);
    const e = tileAt(tx + 1, ty);
    if (isRoadTile(s)) {
      fillRectHD(ctx, lx, ly + 14, 16, 1, "rgb(214,200,190)", 0.92);
      fillRectHD(ctx, lx, ly + 15, 16, 1, "rgb(68,54,56)", 0.95);
    }
    if (isRoadTile(n)) {
      fillRectHD(ctx, lx, ly, 16, 1, "rgb(68,54,56)", 0.95);
      fillRectHD(ctx, lx, ly + 1, 16, 1, "rgb(214,200,190)", 0.92);
    }
    if (isRoadTile(e)) {
      fillRectHD(ctx, lx + 14, ly, 1, 16, "rgb(214,200,190)", 0.92);
      fillRectHD(ctx, lx + 15, ly, 1, 16, "rgb(68,54,56)", 0.95);
    }
    if (isRoadTile(w)) {
      fillRectHD(ctx, lx, ly, 1, 16, "rgb(68,54,56)", 0.95);
      fillRectHD(ctx, lx + 1, ly, 1, 16, "rgb(214,200,190)", 0.92);
    }
    if (isRoadTile(s) && isRoadTile(e) && isRoadTile(tileAt(tx + 1, ty + 1))) drawRoadInnerFilletHD(ctx, lx, ly, "se", s);
    if (isRoadTile(s) && isRoadTile(w) && isRoadTile(tileAt(tx - 1, ty + 1))) drawRoadInnerFilletHD(ctx, lx, ly, "sw", s);
    if (isRoadTile(n) && isRoadTile(e) && isRoadTile(tileAt(tx + 1, ty - 1))) drawRoadInnerFilletHD(ctx, lx, ly, "ne", n);
    if (isRoadTile(n) && isRoadTile(w) && isRoadTile(tileAt(tx - 1, ty - 1))) drawRoadInnerFilletHD(ctx, lx, ly, "nw", n);
  }

  function bakeGroundChunk(cx, cy) {
    const tx0 = cx * GROUND_CHUNK_TILES;
    const ty0 = cy * GROUND_CHUNK_TILES;
    const tx1 = Math.min(mapW - 1, tx0 + GROUND_CHUNK_TILES - 1);
    const ty1 = Math.min(mapH - 1, ty0 + GROUND_CHUNK_TILES - 1);
    const tilesW = Math.max(1, tx1 - tx0 + 1);
    const tilesH = Math.max(1, ty1 - ty0 + 1);

    const canvas = document.createElement("canvas");
    canvas.width = tilesW * tileSize * CHUNK_SCALE;
    canvas.height = tilesH * tileSize * CHUNK_SCALE;
    canvas.__pixelScale = 1 / CHUNK_SCALE;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#3e2a24";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const animatedTiles = [];
    const graveGrid = graveyardFeatures.graveyardGrid;
    const chunkSubgrid = useVectorRoads ? safety.subgrid : null;
    const tileHasVectorRoad = (tx, ty) => {
      if (!chunkSubgrid) return false;
      const sx0 = tx * chunkSubgrid.div;
      const sy0 = ty * chunkSubgrid.div;
      for (let dy = 0; dy < chunkSubgrid.div; dy++) {
        for (let dx = 0; dx < chunkSubgrid.div; dx++) {
          const s = chunkSubgrid.getSurfaceIdAtSub(sx0 + dx, sy0 + dy);
          if (s === 2 || s === 3 || s === 4 || s === 12 || s === 13) return true;
        }
      }
      return false;
    };

    for (let ty = ty0; ty <= ty1; ty++) {
      const rowOff = ty * mapW;
      const ly = (ty - ty0) * tileSize;
      for (let tx = tx0; tx <= tx1; tx++) {
        const lx = (tx - tx0) * tileSize;
        const rawTileId = baseLayer[rowOff + tx];
        const pattern = (tx * 7 + ty * 13) & 15;
        const inGraveyard = graveGrid[rowOff + tx] !== 0;

        // When 4x HD vector roads are active, paint clean underlying sidewalk/turf beneath road cells
        // so the vector road pass can stroke silky-smooth curved asphalt, curbs & yellow lines cleanly on top!
        let tileId = rawTileId;
        if (useVectorRoads && isRoadTile(rawTileId)) {
          const underlay = inferVectorRoadUnderlayTile(tx, ty);
          if (underlay === "grave") {
            blitAtlasToCtx(ctx, ((tx + ty) & 1) === 0 ? "grave_grass_0" : "grave_grass_1", lx, ly);
            continue;
          }
          tileId = underlay;
        }

        if (inGraveyard && (tileId === 0 || tileId === 11 || tileId === 7 || (tileId === 5 && hasPerAddressBuildings))) {
          if (tileId !== 5 && pattern === 0 && !tileHasVectorRoad(tx, ty)) {
            blitAtlasToCtx(ctx, "grave_flower_0", lx, ly);
            animatedTiles.push({ tx, ty, tileId });
          } else {
            blitAtlasToCtx(ctx, ((tx + ty) & 1) === 0 ? "grave_grass_0" : "grave_grass_1", lx, ly);
          }
          continue;
        }

        if (tileId === 0 || (tileId === 5 && hasPerAddressBuildings)) {
          if (tileId === 0 && rawTileId === 0 && pattern === 0 && !tileHasVectorRoad(tx, ty)) {
            blitAtlasToCtx(ctx, "grass_flower_0", lx, ly);
            animatedTiles.push({ tx, ty, tileId });
          } else {
            blitAtlasToCtx(ctx, `grass_${pattern % 3}`, lx, ly);
          }
          if (tileId === 0 && !useVectorRoads) drawParkwayMedianCurbsHD(ctx, lx, ly, tx, ty);
          continue;
        }

        if (tileId === 11) {
          if (rawTileId === 11 && pattern === 1 && ((tx + ty) & 3) === 0 && !tileHasVectorRoad(tx, ty)) {
            blitAtlasToCtx(ctx, "park_flower_0", lx, ly);
            animatedTiles.push({ tx, ty, tileId });
          } else {
            blitAtlasToCtx(ctx, ((tx >> 1) & 1) === 0 ? "park_0" : "park_1", lx, ly);
          }
          if (!useVectorRoads) drawParkwayMedianCurbsHD(ctx, lx, ly, tx, ty);
          continue;
        }

        if (tileId === 7) {
          blitAtlasToCtx(ctx, "tall_grass_0", lx, ly);
          if (!tileHasVectorRoad(tx, ty)) {
            animatedTiles.push({ tx, ty, tileId });
          }
          continue;
        }

        const n = tileAt(tx, ty - 1);
        const s = tileAt(tx, ty + 1);
        const w = tileAt(tx - 1, ty);
        const e = tileAt(tx + 1, ty);

        if (tileId === 9) {
          const spr = pattern === 2 ? "dirt_pebble" : pattern % 2 === 0 ? "dirt_0" : "dirt_1";
          blitAtlasToCtx(ctx, spr, lx, ly);
          if (isGreenGround(n)) {
            fillRectHD(ctx, lx, ly, 16, 1, "rgb(186,118,38)");
            fillRectHD(ctx, lx + (tx % 2) * 3, ly + 1, 6, 1, "rgb(186,118,38)", 0.75);
          }
          if (isGreenGround(s)) {
            fillRectHD(ctx, lx, ly + 15, 16, 1, "rgb(186,118,38)");
            fillRectHD(ctx, lx + ((tx + 1) % 2) * 4, ly + 14, 5, 1, "rgb(122,68,28)", 0.55);
          }
          if (isGreenGround(w)) {
            fillRectHD(ctx, lx, ly, 1, 16, "rgb(186,118,38)");
            fillRectHD(ctx, lx + 1, ly + (ty % 2) * 4, 1, 6, "rgb(186,118,38)", 0.75);
          }
          if (isGreenGround(e)) {
            fillRectHD(ctx, lx + 15, ly, 1, 16, "rgb(186,118,38)");
            fillRectHD(ctx, lx + 14, ly + ((ty + 1) % 2) * 4, 1, 6, "rgb(122,68,28)", 0.55);
          }
          continue;
        }

        if (tileId === 10) {
          const spr = pattern === 3 ? "sand_shell" : pattern % 2 === 0 ? "sand_0" : "sand_1";
          blitAtlasToCtx(ctx, spr, lx, ly);
          if (n === 6) fillRectHD(ctx, lx, ly, 16, 2, "rgb(181,145,83)", 0.8);
          if (s === 6) fillRectHD(ctx, lx, ly + 14, 16, 2, "rgb(181,145,83)", 0.8);
          if (w === 6) fillRectHD(ctx, lx, ly, 2, 16, "rgb(181,145,83)", 0.8);
          if (e === 6) fillRectHD(ctx, lx + 14, ly, 2, 16, "rgb(181,145,83)", 0.8);
          if (isGreenGround(n)) fillRectHD(ctx, lx, ly, 16, 1, "rgb(194,126,42)", 0.7);
          if (isGreenGround(s)) fillRectHD(ctx, lx, ly + 15, 16, 1, "rgb(194,126,42)", 0.7);
          if (isGreenGround(w)) fillRectHD(ctx, lx, ly, 1, 16, "rgb(194,126,42)", 0.7);
          if (isGreenGround(e)) fillRectHD(ctx, lx + 15, ly, 1, 16, "rgb(194,126,42)", 0.7);
          continue;
        }

        if (tileId === 6) {
          const isShore = n !== 6 || s !== 6 || w !== 6 || e !== 6;
          blitAtlasToCtx(ctx, isShore ? "water_shallow_0" : "water_deep_0", lx, ly);
          animatedTiles.push({ tx, ty, tileId });
          continue;
        }

        if (tileId === 8) {
          blitAtlasToCtx(ctx, n !== 8 ? "parking_0" : "parking_1", lx, ly);
          continue;
        }

        if (tileId === 1) {
          blitAtlasToCtx(ctx, (tx + ty) % 2 === 0 ? "sidewalk_0" : "sidewalk_1", lx, ly);
          const isEarth = (id) => id === 9 || id === 10;
          if (!useVectorRoads && isRoadTile(s)) {
            fillRectHD(ctx, lx, ly + 13, 16, 1, "rgb(223,208,200)");
            fillRectHD(ctx, lx, ly + 14, 16, 1, "rgb(107,89,91)");
            fillRectHD(ctx, lx, ly + 15, 16, 1, "rgb(66,52,54)");
          } else if (isGreenGround(s)) {
            fillRectHD(ctx, lx, ly + 15, 16, 1, "rgb(148,82,26)", 0.45);
          } else if (isEarth(s)) {
            fillRectHD(ctx, lx, ly + 15, 16, 1, "rgb(142,108,72)", 0.4);
          }
          if (!useVectorRoads && isRoadTile(n)) {
            fillRectHD(ctx, lx, ly, 16, 1, "rgb(66,52,54)");
            fillRectHD(ctx, lx, ly + 1, 16, 1, "rgb(107,89,91)");
            fillRectHD(ctx, lx, ly + 2, 16, 1, "rgb(223,208,200)");
          } else if (isGreenGround(n)) {
            fillRectHD(ctx, lx, ly, 16, 1, "rgb(148,82,26)", 0.45);
          } else if (isEarth(n)) {
            fillRectHD(ctx, lx, ly, 16, 1, "rgb(142,108,72)", 0.4);
          }
          if (!useVectorRoads && isRoadTile(e)) {
            fillRectHD(ctx, lx + 13, ly, 1, 16, "rgb(223,208,200)");
            fillRectHD(ctx, lx + 14, ly, 1, 16, "rgb(107,89,91)");
            fillRectHD(ctx, lx + 15, ly, 1, 16, "rgb(66,52,54)");
          } else if (isGreenGround(e)) {
            fillRectHD(ctx, lx + 15, ly, 1, 16, "rgb(148,82,26)", 0.45);
          } else if (isEarth(e)) {
            fillRectHD(ctx, lx + 15, ly, 1, 16, "rgb(142,108,72)", 0.4);
          }
          if (!useVectorRoads && isRoadTile(w)) {
            fillRectHD(ctx, lx, ly, 1, 16, "rgb(66,52,54)");
            fillRectHD(ctx, lx + 1, ly, 1, 16, "rgb(107,89,91)");
            fillRectHD(ctx, lx + 2, ly, 1, 16, "rgb(223,208,200)");
          } else if (isGreenGround(w)) {
            fillRectHD(ctx, lx, ly, 1, 16, "rgb(148,82,26)", 0.45);
          } else if (isEarth(w)) {
            fillRectHD(ctx, lx, ly, 1, 16, "rgb(142,108,72)", 0.4);
          }
          if (!useVectorRoads) {
            // Smooth curved inner sidewalk fillets wherever roads bend cleanly around this sidewalk corner!
            if (isRoadTile(s) && isRoadTile(e) && isRoadTile(tileAt(tx + 1, ty + 1))) drawRoadInnerFilletHD(ctx, lx, ly, "se", s);
            if (isRoadTile(s) && isRoadTile(w) && isRoadTile(tileAt(tx - 1, ty + 1))) drawRoadInnerFilletHD(ctx, lx, ly, "sw", s);
            if (isRoadTile(n) && isRoadTile(e) && isRoadTile(tileAt(tx + 1, ty - 1))) drawRoadInnerFilletHD(ctx, lx, ly, "ne", n);
            if (isRoadTile(n) && isRoadTile(w) && isRoadTile(tileAt(tx - 1, ty - 1))) drawRoadInnerFilletHD(ctx, lx, ly, "nw", n);
          }
          continue;
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
          blitAtlasToCtx(ctx, ewTraffic >= nsTraffic ? "crosswalk_h" : "crosswalk_v", lx, ly);
          continue;
        }

        if (tileId === 13) {
          const isVertical = (n === 13 || s === 13) && !(w === 13 || e === 13);
          blitAtlasToCtx(ctx, isVertical ? "highway_median_v" : "highway_median_h", lx, ly);
          if (!isVertical) {
            if (w !== 13) {
              fillRectHD(ctx, lx, ly + 3, 3, 9, "rgb(29,34,40)");
              fillRectHD(ctx, lx + 1, ly + 4, 2, 2, "rgb(244,211,68)");
              fillRectHD(ctx, lx + 1, ly + 8, 2, 2, "rgb(244,211,68)");
            }
            if (e !== 13) {
              fillRectHD(ctx, lx + 13, ly + 3, 3, 9, "rgb(29,34,40)");
              fillRectHD(ctx, lx + 13, ly + 4, 2, 2, "rgb(244,211,68)");
              fillRectHD(ctx, lx + 13, ly + 8, 2, 2, "rgb(244,211,68)");
            }
          } else {
            if (n !== 13) {
              fillRectHD(ctx, lx + 3, ly, 9, 3, "rgb(29,34,40)");
              fillRectHD(ctx, lx + 4, ly + 1, 2, 2, "rgb(244,211,68)");
              fillRectHD(ctx, lx + 8, ly + 1, 2, 2, "rgb(244,211,68)");
            }
            if (s !== 13) {
              fillRectHD(ctx, lx + 3, ly + 13, 9, 3, "rgb(29,34,40)");
              fillRectHD(ctx, lx + 4, ly + 13, 2, 2, "rgb(244,211,68)");
              fillRectHD(ctx, lx + 8, ly + 13, 2, 2, "rgb(244,211,68)");
            }
          }
          continue;
        }

        if (tileId === 12 || tileId === 2 || tileId === 3) {
          if (tileId === 12) {
            blitAtlasToCtx(ctx, (tx + ty) % 2 === 0 ? "highway_base_0" : "highway_base_1", lx, ly);
          } else if (tileId === 3) {
            blitAtlasToCtx(ctx, "road_main_base", lx, ly);
          } else {
            blitAtlasToCtx(ctx, (tx + ty) % 2 === 0 ? "road_res_base_0" : "road_res_base_1", lx, ly);
          }
          const marks = computeRoadTileMarkings(tileAt, tx, ty);
          for (const m of marks) {
            let css;
            let alpha = 1;
            if (m.kind === "curb") {
              css = "rgb(42,46,54)";
              alpha = tileId === 2 ? 0.72 : 0.92;
            } else if (m.kind === "shoulder") {
              css = "rgb(242,246,250)";
              alpha = tileId === 12 ? 0.92 : 0.82;
            } else if (m.kind === "white_dash") {
              css = "rgb(246,249,252)";
              alpha = 0.94;
            } else if (m.kind === "yellow_dash") {
              css = "rgb(245,197,59)";
              alpha = 0.92;
            } else {
              css = "rgb(245,197,59)";
              alpha = 0.96;
            }
            fillRectHD(ctx, lx + m.x, ly + m.y, m.w, m.h, css, alpha);
          }
          // Smooth curved 2x HD rounded outer corners on road bends & diagonals!
          const showSh = tileId === 3 || tileId === 12;
          if (!isRoadTile(n) && !isRoadTile(w) && isRoadTile(s) && isRoadTile(e)) {
            drawRoadOuterCornerHD(ctx, lx, ly, "nw", n === 11 || w === 11 ? 11 : n, showSh);
          }
          if (!isRoadTile(n) && !isRoadTile(e) && isRoadTile(s) && isRoadTile(w)) {
            drawRoadOuterCornerHD(ctx, lx, ly, "ne", n === 11 || e === 11 ? 11 : n, showSh);
          }
          if (!isRoadTile(s) && !isRoadTile(w) && isRoadTile(n) && isRoadTile(e)) {
            drawRoadOuterCornerHD(ctx, lx, ly, "sw", s === 11 || w === 11 ? 11 : s, showSh);
          }
          if (!isRoadTile(s) && !isRoadTile(e) && isRoadTile(n) && isRoadTile(w)) {
            drawRoadOuterCornerHD(ctx, lx, ly, "se", s === 11 || e === 11 ? 11 : s, showSh);
          }
          continue;
        }

        if (tileId === 5) {
          fillRectHD(ctx, lx, ly, tileSize, tileSize, "rgb(140,109,98)");
        }
      }
    }

    // Paint silky-smooth 4x HD real-geometry OpenStreetMap vector roads, curbs, double-yellow
    // centerlines, multi-lane white dashes, highway Jersey medians & angled zebra crosswalks!
    if (useVectorRoads) {
      vectorRoadRenderer.renderChunkRoads(ctx, {
        tx0,
        ty0,
        tilesW,
        tilesH,
        tileSize,
        scale: CHUNK_SCALE,
      });
    }

    return {
      key: `gchunk_${cx}_${cy}`,
      canvas,
      pxX: tx0 * tileSize,
      pxY: ty0 * tileSize,
      animatedTiles,
    };
  }

  function getGroundChunk(cx, cy) {
    const key = `${cx},${cy}`;
    let chunk = groundChunkCache.get(key);
    if (chunk) {
      groundChunkCache.delete(key);
      groundChunkCache.set(key, chunk);
      return chunk;
    }
    chunk = bakeGroundChunk(cx, cy);
    groundChunkCache.set(key, chunk);
    if (groundChunkCache.size > MAX_GROUND_CHUNKS) {
      const oldest = groundChunkCache.keys().next().value;
      groundChunkCache.delete(oldest);
    }
    return chunk;
  }

  k.onDraw(() => {
    if (homeInterior.state.active) {
      homeInterior.drawInteriorRoom(k, playerState.elapsedTime);
      const nearProp = homeInterior.findNearbyInteriorProp(playerState.x, playerState.y);
      if (nearProp?.target) {
        const rf = Math.floor(playerState.elapsedTime * 5) % 2;
        k.drawSprite(`fx_ring_gold_${rf}`, Math.round(nearProp.target.x - 11), Math.round(nearProp.target.y - 6), 0.9);
      }
      drawHero();
      for (const p of leafParticles) {
        const alpha = Math.min(1, p.life * 2.5);
        if (p.sprite && atlas[p.sprite]) {
          const sp = atlas[p.sprite];
          const sw = sp.width * (sp.__pixelScale || 0.5);
          const sh = sp.height * (sp.__pixelScale || 0.5);
          k.drawSprite(p.sprite, Math.round(p.x - sw / 2), Math.round(p.y - sh / 2), alpha, p.rot || 0);
        } else if (p.shade) {
          k.drawRect({
            pos: k.vec2(p.x, p.y),
            width: p.w || 2,
            height: p.h || 2,
            color: k.rgb(...p.shade),
            opacity: alpha,
          });
        }
      }
      return;
    }

    const animFrame = Math.floor(playerState.elapsedTime * 2) % 2;

    const isHardDraw = questSystem.state.navMode === "hard";
    const cullHalfW = isHardDraw ? Math.ceil(Math.hypot(VIEW_W / 2, VIEW_H / 2)) + tileSize * 2 : VIEW_W / 2 + tileSize * 2;
    const cullHalfH = isHardDraw ? cullHalfW : VIEW_H / 2 + tileSize * 2;
    const startX = Math.max(0, Math.floor((cam.x - cullHalfW) / tileSize));
    const endX = Math.min(mapW - 1, Math.ceil((cam.x + cullHalfW) / tileSize));
    const startY = Math.max(0, Math.floor((cam.y - cullHalfH) / tileSize));
    const endY = Math.min(mapH - 1, Math.ceil((cam.y + cullHalfH) / tileSize));

    // 1. Pre-baked 16x16-tile Ground Chunks (2-4 blits per frame!) + only animate water/flowers/tall-grass!
    const gcx0 = Math.floor(startX / GROUND_CHUNK_TILES);
    const gcy0 = Math.floor(startY / GROUND_CHUNK_TILES);
    const gcx1 = Math.floor(endX / GROUND_CHUNK_TILES);
    const gcy1 = Math.floor(endY / GROUND_CHUNK_TILES);
    for (let cy = gcy0; cy <= gcy1; cy++) {
      for (let cx = gcx0; cx <= gcx1; cx++) {
        const chunk = getGroundChunk(cx, cy);
        k.drawCanvas(chunk.key, chunk.canvas, chunk.pxX, chunk.pxY);
        const animList = chunk.animatedTiles;
        for (let i = 0; i < animList.length; i++) {
          const at = animList[i];
          if (at.tx < startX || at.tx > endX || at.ty < startY || at.ty > endY) continue;
          if (at.tileId === 6 || animFrame === 1) {
            drawGroundTile(at.tx, at.ty, at.tileId, animFrame);
          }
        }
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

    for (const bench of propIndices.benches.query(startX - 1, startY - 1, endX + 1, endY + 1)) {
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
    for (const prop of propIndices.parkProps.query(startX - 2, startY - 2, endX + 2, endY + 2)) {
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
    for (const prop of propIndices.graveProps.query(startX - 2, startY - 2, endX + 2, endY + 2)) {
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
    for (const g of propIndices.graveGhosts.query(startX - 3, startY - 3, endX + 3, endY + 3)) {
      if ((g.defeatedTimer || 0) > 0) continue;
      const gp = getGraveyardGhostPos(g, tSec, tileSize);
      const gx = gp.x + Math.round(g.repelX || 0);
      const gy = gp.y + Math.round(g.repelY || 0);
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
          if ((g.lanternScaredTimer || 0) > 0) {
            const bSpr = atlas.bubble_too_bright;
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 34;
            const bob = Math.round(Math.sin(tSec * 12 + gx) * 1.2);
            k.drawSprite("bubble_too_bright", Math.round(gx + 7 - bwLog / 2), gy - 11 + bob, 1, bbAngle, gx + 7, gy + 18);
          }
        },
      });
    }

    for (const reed of propIndices.reeds.query(startX - 1, startY - 1, endX + 1, endY + 1)) {
      const rx = reed.tx * tileSize + 2;
      const ry = reed.ty * tileSize - 1;
      const footX = rx + 6;
      const footY = (reed.ty + 1) * tileSize;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("shore_reed", rx, ry, 1, bbAngle, footX, footY),
      });
    }

    for (const hy of propIndices.hydrants.query(startX - 1, startY - 1, endX + 1, endY + 1)) {
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
    for (const pile of propIndices.leafPiles.query(startX - 1, startY - 1, endX + 1, endY + 1)) {
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
    for (const sh of propIndices.shrubs.query(startX - 1, startY - 1, endX + 1, endY + 1)) {
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
    for (const lamp of propIndices.lamps.query(startX - 2, startY - 2, endX + 2, endY + 2)) {
      const lx = lamp.tx * tileSize + 3;
      const ly = lamp.ty * tileSize - 10;
      const footX = lamp.tx * tileSize + 8;
      const footY = lamp.ty * tileSize + 14;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => k.drawSprite("street_lamp", lx, ly, 1, bbAngle, footX, footY),
      });
    }

    // Active Street Signs (reuse action intent & prompt sign computed in onUpdate — zero duplicate queries!)
    const activeDrawIntent = lastActionIntent;
    const activeTargetInteract = activeDrawIntent.mode === "interact" ? activeDrawIntent.interaction : null;
    const nearestPromptSign = lastNearestPromptSign;
    const visibleSigns = streetSignSystem.queryVisibleSigns(startX - 1, startY - 1, endX + 1, endY + 1);
    const signPromptBob = Math.round(Math.sin(tSec * 6) * 1.5);

    for (const ss of visibleSigns) {
      const sx = ss.tx * tileSize + 2;
      const sy = ss.ty * tileSize - 5;
      const footX = sx + 6;
      const footY = (ss.ty + 1) * tileSize;
      const isChecked = questSystem.state.checkedSigns.has(ss.id);
      const isActiveSign = activeTargetInteract?.kind === "sign" && activeTargetInteract.target?.id === ss.id;
      const isNearestPrompt = isActiveSign || (nearestPromptSign && nearestPromptSign.sign.id === ss.id && !activeDrawIntent.facingUncheckedRoad);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          if (isActiveSign) {
            // Crisp pulsing elliptical 2x HD golden ground ring showing Space will READ THIS SIGN!
            const rf = Math.floor(tSec * 6) % 2;
            k.drawSprite(`fx_ring_gold_${rf}`, ss.tx * tileSize - 3, ss.ty * tileSize + 5, 0.92);
          }
          k.drawSprite(isChecked ? "street_sign_checked" : "street_sign", sx, sy, 1, bbAngle, footX, footY);
          if (isNearestPrompt) {
            k.drawSprite("street_sign_prompt", sx + 1, sy - 11 + signPromptBob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Fading 2x HD sidewalk chalk directional chevrons right after checking a street sign!
    if (activeChalkArrow) {
      const len = Math.hypot(activeChalkArrow.dx, activeChalkArrow.dy) || 1;
      const ux = activeChalkArrow.dx / len;
      const uy = activeChalkArrow.dy / len;
      const arrowDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
      const basePxX = activeChalkArrow.tx * tileSize + tileSize / 2;
      const basePxY = activeChalkArrow.ty * tileSize + tileSize / 2;
      const alpha = Math.min(0.95, activeChalkArrow.timer * 0.5);
      const slide = (tSec * 14) % 10;
      for (let i = 0; i < 3; i++) {
        const dist = 10 + i * 10 + slide;
        const ax = Math.round(basePxX + ux * dist);
        const ay = Math.round(basePxY + uy * dist);
        k.drawSprite("fx_chalk_arrow", ax - 5.5, ay - 5.5, alpha * (1 - i * 0.14), arrowDeg);
      }
    }

    for (const car of propIndices.parkedCars.query(startX - 2, startY - 2, endX + 2, endY + 2)) {
      const sprCanvas = atlas[car.sprite];
      const sprScale = sprCanvas?.__pixelScale || 0.5;
      const halfW = sprCanvas ? (sprCanvas.width * sprScale) / 2 : 10;
      const halfH = sprCanvas ? (sprCanvas.height * sprScale) / 2 : 14;
      const cx = typeof car.x === "number" ? car.x : car.tx * tileSize + tileSize / 2;
      const cy = typeof car.y === "number" ? car.y : car.ty * tileSize + tileSize / 2;
      const drawX = Math.round(cx - halfW);
      const drawY = Math.round(cy - halfH);
      drawables.push({
        sortY: depthOf(cx, cy + halfH * 0.65),
        draw: () => k.drawSprite(car.sprite, drawX, drawY),
      });
    }

    // Moving Road Traffic: Bigger Cars, SUVs, Pickup & Box Trucks & Annoying Spandex Bikers!
    for (const v of roadTraffic.vehicles || []) {
      const vtx = v.x / tileSize;
      const vty = v.y / tileSize;
      if (vtx < startX - 4 || vtx > endX + 4 || vty < startY - 4 || vty > endY + 4) continue;
      const bikeFrame = Math.floor(v.animTimer || tSec * 8) % 2;
      const spr =
        v.kind === "bike"
          ? `traffic_bike_${bikeFrame}_${v.dir}`
          : v.kind === "truck"
            ? `traffic_truck_${v.variant}_${v.dir}`
            : `traffic_car_${v.variant}_${v.dir}`;
      const sprCanvas = atlas[spr];
      const sprScale = sprCanvas?.__pixelScale || 0.5;
      const sprW = sprCanvas ? sprCanvas.width * sprScale : 28;
      const sprH = sprCanvas ? sprCanvas.height * sprScale : 20;
      const halfW = sprW / 2;
      const isHoriz = v.dir === "e" || v.dir === "w";
      // Anchor 3/4 side-view vehicles & upright bikes at their ground tire-contact line so
      // wheels stay visibly planted on the paved road lane instead of hanging onto sidewalks!
      const anchorFracY =
        v.kind === "bike"
          ? 0.80
          : isHoriz
            ? 0.74
            : 0.54;
      const drawX = Math.round(v.x - halfW);
      const drawY = Math.round(v.y - sprH * anchorFracY);
      const vRot = v.rotDeg || 0;
      drawables.push({
        sortY: depthOf(v.x, v.y + 4),
        draw: () => {
          k.drawSprite(spr, drawX, drawY, 1, vRot, v.x, v.y);
          if (v.kind === "bike" && v.bubbleTimer > 0) {
            const bKey = `bubble_biker_${v.chantIndex % 5}`;
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 34;
            const bob = Math.round(Math.sin(tSec * 12 + v.x) * 1.4);
            k.drawSprite(bKey, Math.round(v.x - bwLog / 2), drawY - 12 + bob, 1, bbAngle, v.x, v.y);
          }
        },
      });
    }

    // FULL-SCALE 32-BIT NEWTON EMERGENCY SCENE:
    // Ambulance + Police Cruiser + Fire Pumper + Rolling Yellow/Black CAUTION Tape + Cones + Sizzling Flares + EMTs + Officers!
    if (
      roadHitCutscene &&
      (roadHitCutscene.phase === "ambulance_in" ||
        roadHitCutscene.phase === "emt_exit" ||
        roadHitCutscene.phase === "emt_treat" ||
        roadHitCutscene.phase === "emt_load" ||
        roadHitCutscene.phase === "ambulance_out")
    ) {
      const cs = roadHitCutscene;
      const flash = Math.floor(tSec * 12) % 2;
      const flareFrame = Math.floor(tSec * 14) % 2;
      const doorsOpen = cs.phase === "emt_exit" || cs.phase === "emt_treat" || cs.phase === "emt_load";
      const strobeA = flash === 0 ? k.rgb(255, 52, 52) : k.rgb(52, 148, 255);
      const strobeB = flash === 0 ? k.rgb(52, 148, 255) : k.rgb(255, 52, 52);

      // Helper to render crisp yellow-and-black striped CAUTION tape between two cones!
      const drawCautionTapeBand = (x0, x1, yTape) => {
        const minX = Math.round(Math.min(x0, x1));
        const maxX = Math.round(Math.max(x0, x1));
        const span = maxX - minX;
        if (span < 3) return;
        // Subtle shadow on asphalt below tape
        k.drawRect({ pos: k.vec2(minX, yTape + 4), width: span, height: 1, color: k.rgb(18, 20, 28), opacity: 0.35 });
        // Crisp dark border + bright yellow tape strip
        k.drawRect({ pos: k.vec2(minX, yTape - 1), width: span, height: 4, color: k.rgb(24, 22, 16) });
        k.drawRect({ pos: k.vec2(minX, yTape), width: span, height: 2, color: k.rgb(255, 218, 42) });
        // Diagonal-look black CAUTION warning hash marks along the tape!
        for (let tx = minX + 2; tx < maxX - 2; tx += 6) {
          k.drawRect({ pos: k.vec2(tx, yTape), width: 2, height: 1, color: k.rgb(22, 22, 26) });
          k.drawRect({ pos: k.vec2(tx + 1, yTape + 1), width: 2, height: 1, color: k.rgb(22, 22, 26) });
        }
      };

      // 1. Newton EMS Type-III Rescue Ambulance + Pulsing Red/Blue Asphalt Strobe Reflections!
      const ambSpr = doorsOpen
        ? `ambulance_${cs.ambDir}_open_${flash}`
        : `ambulance_${cs.ambDir}_${flash}`;
      const ambCanvas = atlas[ambSpr];
      const ambW = ambCanvas ? ambCanvas.width * (ambCanvas.__pixelScale || 0.5) : 49;
      const ambH = ambCanvas ? ambCanvas.height * (ambCanvas.__pixelScale || 0.5) : 26;
      const ax = Math.round(cs.ambX - ambW / 2);
      const ay = Math.round(cs.ambY - ambH * 0.62);
      drawables.push({
        sortY: depthOf(cs.ambX, cs.ambY + 8),
        draw: () => {
          k.drawRect({
            pos: k.vec2(ax - 8, ay + ambH - 12),
            width: Math.round(ambW * 0.55),
            height: 16,
            color: strobeA,
            opacity: 0.24,
          });
          k.drawRect({
            pos: k.vec2(ax + Math.round(ambW * 0.45), ay + ambH - 12),
            width: Math.round(ambW * 0.62),
            height: 16,
            color: strobeB,
            opacity: 0.24,
          });
          k.drawSprite(ambSpr, ax, ay);
        },
      });

      // 2. Newton Police Interceptor Cruiser blocking traffic!
      const polSpr = `police_car_${cs.polDir}_${flash}`;
      const polCanvas = atlas[polSpr];
      const polW = polCanvas ? polCanvas.width * (polCanvas.__pixelScale || 0.5) : 34;
      const polH = polCanvas ? polCanvas.height * (polCanvas.__pixelScale || 0.5) : 20;
      const pxC = Math.round(cs.polX - polW / 2);
      const pyC = Math.round(cs.polY - polH * 0.62);
      drawables.push({
        sortY: depthOf(cs.polX, cs.polY + 8),
        draw: () => {
          k.drawRect({
            pos: k.vec2(pxC - 8, pyC + polH - 10),
            width: Math.round(polW + 16),
            height: 15,
            color: strobeB,
            opacity: 0.24,
          });
          k.drawSprite(polSpr, pxC, pyC);
          if (cs.polArrived && cs.phase !== "ambulance_out") {
            const bSpr = atlas.bubble_police_stop;
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 36;
            const bob = Math.round(Math.sin(tSec * 9 + 1) * 1.2);
            k.drawSprite("bubble_police_stop", Math.round(cs.polX - bwLog / 2), pyC - 12 + bob);
          }
        },
      });

      // 3. Newton Fire Dept. Rescue Pumper Engine backing up the perimeter on upper lane!
      const fireSpr = `fire_truck_${cs.fireDir}_${flash}`;
      const fireCanvas = atlas[fireSpr];
      const fireW = fireCanvas ? fireCanvas.width * (fireCanvas.__pixelScale || 0.5) : 53;
      const fireH = fireCanvas ? fireCanvas.height * (fireCanvas.__pixelScale || 0.5) : 26;
      const fxC = Math.round(cs.fireX - fireW / 2);
      const fyC = Math.round(cs.fireY - fireH * 0.62);
      drawables.push({
        sortY: depthOf(cs.fireX, cs.fireY + 8),
        draw: () => {
          k.drawRect({
            pos: k.vec2(fxC - 8, fyC + fireH - 11),
            width: Math.round(fireW + 16),
            height: 16,
            color: flash === 0 ? k.rgb(255, 58, 42) : k.rgb(255, 224, 120),
            opacity: 0.22,
          });
          k.drawSprite(fireSpr, fxC, fyC);
          if (cs.fireArrived && cs.phase !== "ambulance_out") {
            const bSpr = atlas.bubble_fire_clear;
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 40;
            const bob = Math.round(Math.sin(tSec * 8 + 2) * 1.2);
            k.drawSprite("bubble_fire_clear", Math.round(cs.fireX - bwLog / 2), fyC - 12 + bob);
          }
        },
      });

      // 4. Police Officers Rolling Out Yellow/Black CAUTION Tape + Bright Orange Cones + Sizzling Road Flares!
      if (cs.tapeProgress > 0.02) {
        const tp = cs.tapeProgress;
        const topTapeY = Math.round(cs.hitY - 19);
        const botTapeY = Math.round(cs.hitY + 19);
        const curTapeX = cs.tapeLeftX + (cs.tapeRightX - cs.tapeLeftX) * tp;
        const offStep = tp < 0.99 ? Math.floor(tSec * 10) % 2 : 0;

        // Top CAUTION tape perimeter + cones + Police Officer #1 rolling it out!
        drawables.push({
          sortY: depthOf(cs.hitX, topTapeY + 2),
          draw: () => {
            k.drawSprite("traffic_cone", Math.round(cs.tapeLeftX - 4), topTapeY - 7);
            if (tp > 0.5) {
              k.drawSprite("traffic_cone", Math.round((cs.tapeLeftX + cs.tapeRightX) / 2 - 4), topTapeY - 7);
            }
            if (tp >= 0.98) {
              k.drawSprite("traffic_cone", Math.round(cs.tapeRightX - 4), topTapeY - 7);
            }
            drawCautionTapeBand(cs.tapeLeftX, curTapeX, topTapeY - 2);
            if (cs.phase !== "ambulance_out") {
              k.drawSprite(
                `police_officer_${tp < 0.99 ? "right" : "left"}_${offStep}`,
                Math.round(curTapeX - 10),
                topTapeY - 22
              );
            }
          },
        });

        // Bottom CAUTION tape perimeter + cones + sizzling red flares + Police Officer #2!
        drawables.push({
          sortY: depthOf(cs.hitX, botTapeY + 4),
          draw: () => {
            // Sizzling red highway road flares with warm crimson glow on asphalt!
            const flareXs = [cs.tapeLeftX - 10, cs.tapeLeftX + 18, cs.tapeRightX + 10];
            for (const flx of flareXs) {
              if (flx <= curTapeX + 14) {
                k.drawRect({
                  pos: k.vec2(Math.round(flx - 6), botTapeY - 2),
                  width: 14,
                  height: 8,
                  color: k.rgb(255, 68, 42),
                  opacity: flareFrame === 0 ? 0.28 : 0.18,
                });
                k.drawSprite(`road_flare_${flareFrame}`, Math.round(flx - 4), botTapeY - 3);
              }
            }
            k.drawSprite("traffic_cone", Math.round(cs.tapeLeftX - 4), botTapeY - 7);
            if (tp > 0.5) {
              k.drawSprite("traffic_cone", Math.round((cs.tapeLeftX + cs.tapeRightX) / 2 - 4), botTapeY - 7);
            }
            if (tp >= 0.98) {
              k.drawSprite("traffic_cone", Math.round(cs.tapeRightX - 4), botTapeY - 7);
            }
            drawCautionTapeBand(cs.tapeLeftX, curTapeX, botTapeY - 2);
            if (cs.phase !== "ambulance_out") {
              const offX = Math.round(curTapeX - 10);
              const offY = botTapeY - 22;
              k.drawSprite(`police_officer_${tp < 0.99 ? "right" : "left"}_${(offStep + 1) % 2}`, offX, offY);
              const bSpr = atlas.bubble_police_tape;
              const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 44;
              const bob = Math.round(Math.sin(tSec * 10 + 3) * 1.2);
              k.drawSprite("bubble_police_tape", Math.round(curTapeX - bwLog / 2), offY - 12 + bob);
            }
          },
        });
      }

      // 5. EMT Paramedics Exiting, Kneeling Triage & Wheeling Stretcher Into Open Ambulance Bay!
      if (doorsOpen) {
        const dirSign = cs.ambDir === "e" ? 1 : -1;
        const step = Math.floor(tSec * 10) % 2;

        if (cs.phase === "emt_treat") {
          const sy = Math.round(cs.hitY - 9);
          const emtY = Math.round(cs.hitY - 21);
          drawables.push({
            sortY: depthOf(cs.hitX, cs.hitY + 12),
            draw: () => {
              k.drawSprite("emt_stretcher_empty", Math.round(cs.hitX - 15), sy - 9);
              k.drawSprite("emt_kneel_right", Math.round(cs.hitX - 20), emtY + 1);
              k.drawSprite("emt_kneel_1_left", Math.round(cs.hitX + 2), emtY + 2);
              const bSpr = atlas.bubble_emt_lift;
              const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 38;
              const bob = Math.round(Math.sin(tSec * 10) * 1.2);
              k.drawSprite("bubble_emt_lift", Math.round(cs.hitX - bwLog / 2), emtY - 12 + bob);
            },
          });
        } else {
          let stretcherX;
          let hasPatient = false;
          let emtFacing;

          if (cs.phase === "emt_exit") {
            stretcherX = cs.doorX + (cs.hitX - cs.doorX) * cs.emtProgress;
            hasPatient = false;
            emtFacing = dirSign > 0 ? "left" : "right";
          } else {
            hasPatient = true;
            const carryT = Math.max(0, (cs.emtProgress - 0.16) / 0.84);
            stretcherX = cs.hitX + (cs.doorX - cs.hitX) * carryT;
            emtFacing = dirSign > 0 ? "right" : "left";
          }

          const emtWalkStep = cs.phase === "emt_load" && cs.emtProgress < 0.16 ? 0 : step;
          const emt1Spr = `emt_${emtFacing}_${emtWalkStep}`;
          const emt2Spr = `emt_1_${emtFacing}_${(emtWalkStep + 1) % 2}`;
          const stretcherSpr = hasPatient ? "emt_stretcher_patient" : "emt_stretcher_empty";
          const rollBounce = emtWalkStep === 1 ? -1 : 0;
          const sy = Math.round(cs.hitY - 11 + rollBounce);
          const emt1X = Math.round(stretcherX - 20);
          const emt2X = Math.round(stretcherX + 3);
          const emtY = Math.round(cs.hitY - 21);

          drawables.push({
            sortY: depthOf(stretcherX, cs.hitY + 12),
            draw: () => {
              k.drawSprite(emt1Spr, emt1X, emtY - 2);
              k.drawSprite(stretcherSpr, Math.round(stretcherX - 15), sy);
              k.drawSprite(emt2Spr, emt2X, emtY + 1);
              if (cs.phase === "emt_exit") {
                const bSpr = atlas.bubble_emt_help;
                const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 34;
                const bob = Math.round(Math.sin(tSec * 10) * 1.2);
                k.drawSprite("bubble_emt_help", Math.round(stretcherX - bwLog / 2), emtY - 12 + bob);
              }
            },
          });
        }
      }
    }

    // Detailed 2x HD woven coir welcome mat right at the front porch of Home Base (565 Boylston St)!
    if (
      homeDoorTile.x >= startX - 2 &&
      homeDoorTile.x <= endX + 2 &&
      homeDoorTile.y >= startY - 2 &&
      homeDoorTile.y <= endY + 2
    ) {
      const dx = homeDoorTile.x * tileSize;
      const dy = homeDoorTile.y * tileSize;
      const isDoorActive = activeTargetInteract?.kind === "home_door" || canEnterNearbyHouse(Math.floor(playerState.x / tileSize), Math.floor(playerState.y / tileSize));
      k.drawSprite(isDoorActive ? "prop_welcome_mat_glow" : "prop_welcome_mat", dx, dy + 1);
    }

    // Phase 3+: Animated Landmark NPCs (friendly proximity greeting wave, active dialogue gesture & celebration hop!)
    const activeTarget = questSystem.getActiveObjectiveTarget();
    const ringFrameDraw = Math.floor(tSec * 5) % 2;
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
      const distNpc = Math.hypot(playerState.x - nx, playerState.y - ny);
      let animSt = npcAnimState.get(npc.id);
      if (!animSt) {
        animSt = { celebrateTimer: 0, greetWaveTimer: 0, greetedNear: false };
        npcAnimState.set(npc.id, animSt);
      }
      if (distNpc < 44 && !animSt.greetedNear) {
        animSt.greetedNear = true;
        animSt.greetWaveTimer = 1.25;
      } else if (distNpc > 62) {
        animSt.greetedNear = false;
      }

      const isMomYelling = npc.id === "home_base" && roadHitCutscene?.phase === "mom_yelling";
      const isTalkingNow = activeTalkNpcId === npc.id && ui.isDialogueOpen();
      const isCelebrating = animSt.celebrateTimer > 0;
      const isGreeting = animSt.greetWaveTimer > 0;
      const waveToggle =
        isTalkingNow
          ? Math.floor(tSec * 6) % 2 === 0
          : isCelebrating
            ? Math.floor(tSec * 9) % 2 === 0
            : isGreeting
              ? Math.floor(tSec * 5) % 2 === 0
              : false;
      const npcSprKey = waveToggle && atlas[`${npc.npcSprite}_wave`] ? `${npc.npcSprite}_wave` : npc.npcSprite;
      const idleBob = isMomYelling
        ? Math.round(Math.abs(Math.sin(tSec * 16)) * -4)
        : isCelebrating
          ? Math.round(Math.abs(Math.sin(tSec * 12)) * -3)
          : isTalkingNow
            ? Math.round(Math.abs(Math.sin(tSec * 8)) * -1.5)
            : isGreeting
              ? Math.round(Math.abs(Math.sin(tSec * 7)) * -2)
              : Math.sin(tSec * 3 + npc.walkTileX) > 0.6
                ? -1
                : 0;
      const isQuestTarget = activeTarget && activeTarget.landmarkId === npc.id;
      const isActiveTalkNpc = activeTargetInteract?.kind === "npc" && activeTargetInteract.target?.id === npc.id;
      const bubbleBob = Math.sin(tSec * 6) * 2;

      drawables.push({
        sortY: depthOf(nx, ny + 4),
        draw: () => {
          if (isActiveTalkNpc || isTalkingNow) {
            k.drawSprite(`fx_ring_gold_${ringFrameDraw}`, nx - 11, ny - 2, 0.92);
          }
          k.drawSprite("landmark_sign", nx + 7, ny - 12, 1, bbAngle, nx + 14, ny + 4);
          k.drawSprite(npcSprKey, nx - 11, ny - 21 + idleBob, 1, bbAngle, nx, ny + 4);
          if (isMomYelling) {
            k.drawSprite("fx_alert_bang", nx - 3, ny - 35 + idleBob, 1, bbAngle, nx, ny + 4);
          } else if (isCelebrating) {
            const bSpr = atlas.bubble_npc_yay;
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 26;
            k.drawSprite("bubble_npc_yay", Math.round(nx - bwLog / 2), ny - 34 + idleBob, 1, bbAngle, nx, ny + 4);
          } else if (isQuestTarget) {
            k.drawSprite("quest_bubble", nx - 5, ny - 34 + bubbleBob, 1, bbAngle, nx, ny + 4);
          } else if (isGreeting && !isTalkingNow) {
            const noteY = ny - 31 + Math.round(Math.sin(tSec * 10) * 1.5);
            k.drawSprite("fx_music_note", nx + 5, noteY, 0.92, bbAngle, nx, ny + 4);
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
      const coinSpr = d.kind === "coin" ? (Math.floor(d.age * 7) % 2 === 0 ? "drop_coin" : "drop_coin_1") : "drop_acorn";
      drawables.push({
        sortY: depthOf(d.x, d.y + 4),
        draw: () => k.drawSprite(coinSpr, d.x - 4.5, d.y - 5 - bounce, 1, bbAngle, d.x, d.y + 4),
      });
    }

    // Highlight the nearest feedable wild animal so kids immediately see they can feed it (N or Space)!
    const canFeedAnyAnimal = Boolean(
      questSystem.state.gpsAssist || questSystem.hasSnack() || questSystem.state.acorns > 0
    );
    const nearestFeedAnimal = canFeedAnyAnimal
      ? findNearbySnackTarget(streetLife, playerState.x, playerState.y, 72)
      : null;
    const drawMunchHeart = (hx, hy) => {
      const rise = Math.round(Math.sin(tSec * 12) * 1.5);
      k.drawSprite("fx_heart_pink", hx - 4, hy - 3 + rise);
    };

    // Roving Wild Newton Turkeys (strutting, puffing autumn tail fans, lunging, startled hops & gobbling!)
    for (const tk of streetLife.turkeys) {
      const tkTx = tk.x / tileSize;
      const tkTy = tk.y / tileSize;
      if (tkTx < startX - 2 || tkTx > endX + 2 || tkTy < startY - 2 || tkTy > endY + 2) continue;
      const isPuffed = tk.puffedTimer > 0;
      const isMunching = (tk.munchTimer || 0) > 0;
      const step = Math.floor(tk.animTimer) % 2;
      const spr = isPuffed
        ? `turkey_puff_${tk.facing}`
        : `turkey_${tk.facing}_${step}`;
      const drawW = isPuffed ? 20 : 18;
      const munchHop = isMunching ? Math.round(Math.abs(Math.sin(tSec * 18)) * -2) : 0;
      const startleHop = (tk.hopTimer || 0) > 0 ? Math.round(Math.sin((tk.hopTimer / 0.48) * Math.PI) * -6) : 0;
      const lungeHop = (tk.lungeTimer || 0) > 0 ? Math.round(Math.sin((tk.lungeTimer / 0.42) * Math.PI) * -5) : 0;
      const txPx = Math.round(tk.x - drawW / 2);
      const tyPx = Math.round(tk.y - 16 + munchHop + startleHop + lungeHop);
      const footX = Math.round(tk.x);
      const footY = Math.round(tk.y + 2);
      const isFeedHighlight = nearestFeedAnimal?.kind === "turkey" && nearestFeedAnimal.target?.id === tk.id;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          if (isFeedHighlight) {
            k.drawSprite(`fx_ring_green_${ringFrameDraw}`, footX - 11, footY - 6, 0.9);
          }
          k.drawSprite(spr, txPx, tyPx, 1, bbAngle, footX, footY);
          if ((tk.hopTimer || 0) > 0.12) {
            k.drawSprite("fx_alert_bang", footX - 3, tyPx - 11, 1, bbAngle, footX, footY);
          }
          if (isMunching) {
            drawMunchHeart(footX + 7, tyPx - 2);
          }
          if (tk.gobbleBubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 10 + tk.x) * 1.2);
            const bKey = tk.bubbleSprite || "bubble_gobble";
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? (bSpr.width * (bSpr.__pixelScale || 0.5)) : 20;
            k.drawSprite(bKey, Math.round(footX - bwLog / 2), tyPx - 11 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Roving Wild Squirrels, Prowling Cats & Runaway Dogs with Trailing Leashes!
    for (const cr of streetLife.critters || []) {
      const crTx = cr.x / tileSize;
      const crTy = cr.y / tileSize;
      if (crTx < startX - 2 || crTx > endX + 2 || crTy < startY - 2 || crTy > endY + 2) continue;
      const step = Math.floor(cr.animTimer) % 2;
      const isAlert = cr.alertTimer > 0;
      const isMunching = (cr.munchTimer || 0) > 0;
      const munchHop = isMunching ? Math.round(Math.abs(Math.sin(tSec * 18)) * -2) : 0;
      const startleHop = (cr.hopTimer || 0) > 0 ? Math.round(Math.sin((cr.hopTimer / 0.48) * Math.PI) * -6) : 0;
      const lungeHop = (cr.lungeTimer || 0) > 0 ? Math.round(Math.sin((cr.lungeTimer / 0.42) * Math.PI) * -5) : 0;
      const totalHop = munchHop + startleHop + lungeHop;
      let spr;
      let drawX;
      let drawY;
      if (cr.kind === "squirrel") {
        spr = isAlert ? `squirrel_alert_${cr.facing}` : `squirrel_${cr.facing}_${step}`;
        drawX = Math.round(cr.x - 9);
        drawY = Math.round(cr.y - 14 + totalHop);
      } else if (cr.kind === "cat") {
        spr = isAlert
          ? `cat_${cr.variant}_alert_${cr.facing}`
          : `cat_${cr.variant}_${cr.facing}_${step}`;
        drawX = Math.round(cr.x - 10);
        drawY = Math.round(cr.y - 15 + totalHop);
      } else if (cr.kind === "parakeet") {
        spr = isAlert ? `parakeet_alert_${cr.facing}` : `parakeet_${cr.facing}_${step}`;
        drawX = Math.round(cr.x - 9);
        drawY = Math.round(cr.y - 16 + totalHop);
      } else if (cr.kind === "hyrax") {
        spr = isAlert ? `hyrax_alert_${cr.facing}` : `hyrax_${cr.facing}_${step}`;
        drawX = Math.round(cr.x - 10);
        drawY = Math.round(cr.y - 13 + totalHop);
      } else if (cr.kind === "arctic_fox" || cr.kind === "red_fox") {
        spr = isAlert ? `${cr.kind}_alert_${cr.facing}` : `${cr.kind}_${cr.facing}_${step}`;
        drawX = Math.round(cr.x - 12);
        drawY = Math.round(cr.y - 16 + totalHop);
      } else if (cr.kind === "roadrunner") {
        spr = isAlert ? `roadrunner_alert_${cr.facing}` : `roadrunner_${cr.facing}_${step}`;
        drawX = Math.round(cr.x - 12);
        drawY = Math.round(cr.y - 17 + totalHop);
      } else {
        // Runaway dog with animated trailing leash behind collar (58x38 native -> 29x19 logical)
        spr = isAlert
          ? `dog_${cr.variant}_alert_${cr.facing}`
          : `dog_${cr.variant}_${cr.facing}_${step}`;
        drawX = Math.round(cr.x + (cr.facing === "right" ? -18 : -11));
        drawY = Math.round(cr.y - 17 + totalHop);
      }
      const footX = Math.round(cr.x);
      const footY = Math.round(cr.y + 2);
      const isFeedHighlight = nearestFeedAnimal?.kind === cr.kind && nearestFeedAnimal.target?.id === cr.id;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          if (isFeedHighlight) {
            k.drawSprite(`fx_ring_green_${ringFrameDraw}`, footX - 11, footY - 6, 0.9);
          }
          k.drawSprite(spr, drawX, drawY, 1, bbAngle, footX, footY);
          if ((cr.hopTimer || 0) > 0.12) {
            k.drawSprite("fx_alert_bang", footX - 3, drawY - 10, 1, bbAngle, footX, footY);
          }
          if (isMunching) {
            drawMunchHeart(footX + 7, drawY - 2);
          }
          if (cr.bubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 10 + cr.x) * 1.2);
            const bKey = cr.bubbleSprite || "bubble_woof";
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? (bSpr.width * (bSpr.__pixelScale || 0.5)) : 24;
            k.drawSprite(bKey, Math.round(footX - bwLog / 2), drawY - 10 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Over-Competitive 32-Bit Annoying Marathon Runners (4-frame stride + speedlines + startled react hop + PR burst!)
    for (const jg of streetLife.joggers || []) {
      const jgTx = jg.x / tileSize;
      const jgTy = jg.y / tileSize;
      if (jgTx < startX - 2 || jgTx > endX + 2 || jgTy < startY - 2 || jgTy > endY + 2) continue;
      const runFrame = Math.floor(jg.animTimer) % 4;
      const spr = `jogger_${jg.variant}_${jg.facing}_${runFrame}`;
      const isSprinting = (jg.sprintTimer || 0) > 0;
      const isReacting = (jg.reactTimer || 0) > 0;
      const reactHop = isReacting ? Math.round(Math.sin((jg.reactTimer / 0.65) * Math.PI) * -5) : 0;
      const jxDraw = Math.round(jg.x - 12);
      const jyDraw = Math.round(jg.y - 27 + reactHop);
      const footX = Math.round(jg.x);
      const footY = Math.round(jg.y + 3);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          // Crisp 2x HD tapered speedlines & fluffy pixel dust puffs when sprinting past Liam!
          if (isSprinting || (jg.jostledBurstTimer || 0) > 0) {
            const dirSign = jg.facing === "right" ? -1 : 1;
            const streakKey = (jg.jostledBurstTimer || 0) > 0 ? "fx_speed_streak_1" : "fx_speed_streak_0";
            const sxPos = jg.facing === "right" ? footX - 20 : footX + 6;
            k.drawSprite(streakKey, sxPos, jyDraw + 7, 0.82, jg.facing === "right" ? 0 : 180);
            if (runFrame === 0 || runFrame === 2) {
              k.drawSprite("fx_dust_1", footX + dirSign * 6 - 4, footY - 6, 0.72);
            }
          }
          k.drawSprite(spr, jxDraw, jyDraw, 1, bbAngle, footX, footY);
          if (isReacting) {
            k.drawSprite("fx_alert_bang", footX + (jg.facing === "right" ? 7 : -11), jyDraw - 6, 1, bbAngle, footX, footY);
          }
          if ((jg.jostledBurstTimer || 0) > 0) {
            k.drawSprite("fx_sparkle_gold", footX + (jg.facing === "right" ? -10 : 5), jyDraw + 3, 0.9);
          }
          if (jg.bubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 12 + jg.x) * 1.4);
            const bKey = jg.bubbleSprite || "bubble_jogger_0";
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 34;
            k.drawSprite(bKey, Math.round(footX - bwLog / 2), jyDraw - 10 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Friendly Sidewalk Locals celebrating unmistakable local flair (baguettes & coffee in Paris, Hasidic & hipsters & pizza in Brooklyn, tea & brollies in London, etc.!)
    for (const loc of streetLife.locals || []) {
      const locTx = loc.x / tileSize;
      const locTy = loc.y / tileSize;
      if (locTx < startX - 2 || locTx > endX + 2 || locTy < startY - 2 || locTy > endY + 2) continue;
      const isEating = (loc.eatTimer || 0) > 0;
      const frame = isEating ? "eat" : String(Math.floor(loc.animTimer) % 2);
      const spr = `local_${loc.variant}_${loc.facing}_${frame}`;
      const lxDraw = Math.round(loc.x - 12);
      const lyDraw = Math.round(loc.y - 28);
      const footX = Math.round(loc.x);
      const footY = Math.round(loc.y + 3);
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          k.drawSprite(spr, lxDraw, lyDraw, 1, bbAngle, footX, footY);
          if (loc.bubbleTimer > 0) {
            const bob = Math.round(Math.sin(tSec * 8 + loc.x) * 1.1);
            const bKey = loc.bubbleSprite || "bubble_local_0";
            const bSpr = atlas[bKey];
            const bwLog = bSpr ? bSpr.width * (bSpr.__pixelScale || 0.5) : 32;
            k.drawSprite(bKey, Math.round(footX - bwLog / 2), lyDraw - 10 + bob, 1, bbAngle, footX, footY);
          }
        },
      });
    }

    // Peaceful Sidewalk Marchers waving picket signs — joyful cheer-hop & hearts when shared a snack!
    const nearestHungryPr = findNearbyHungryProtestor(streetLife, playerState.x, playerState.y, 44)?.target || null;
    for (const pr of streetLife.protestors) {
      const prTx = pr.x / tileSize;
      const prTy = pr.y / tileSize;
      if (prTx < startX - 2 || prTx > endX + 2 || prTy < startY - 2 || prTy > endY + 2) continue;
      const isCheering = (pr.cheerTimer || 0) > 0;
      const cheerHop = isCheering ? Math.round(Math.abs(Math.sin(tSec * 14 + pr.anchorX)) * -4) : 0;
      const shoutFrame = isCheering || pr.bubbleTimer > 0 ? Math.floor(pr.animTimer) % 2 : (Math.floor(pr.animTimer * 0.6) % 2);
      const spr = `protestor_${pr.variant}_${pr.facing}_${shoutFrame}`;
      const pxDraw = Math.round(pr.x - 12);
      const pyDraw = Math.round(pr.y - 28 + cheerHop);
      const footX = Math.round(pr.x);
      const footY = Math.round(pr.y + 3);
      const isSnackTarget = nearestHungryPr && pr.id === nearestHungryPr.id;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          if (isSnackTarget) {
            k.drawSprite(`fx_ring_green_${ringFrameDraw}`, footX - 11, footY - 6, 0.92);
          }
          k.drawSprite(spr, pxDraw, pyDraw, 1, bbAngle, footX, footY);
          if (isCheering) {
            drawMunchHeart(footX + 9, pyDraw + 2);
          }
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

    // Spooky Graveyard Characters (Rattling Skeletons, Graveyard Phantoms & Pumpkin Ghouls — attack poses, recoil & mist respawn!)
    const heroHasLantern = questSystem.hasLantern();
    for (const sp of streetLife.spookyChars || []) {
      if ((sp.defeatedTimer || 0) > 0) continue;
      const spTx = sp.x / tileSize;
      const spTy = sp.y / tileSize;
      if (spTx < startX - 2 || spTx > endX + 2 || spTy < startY - 2 || spTy > endY + 2) continue;
      const step = Math.floor(sp.animTimer) % 2;
      const isAttacking = (sp.attackTimer || 0) > 0;
      const isRespawning = (sp.respawnAnimTimer || 0) > 0;
      const isStartled = sp.spookTimer > 0;
      const isLanternRepelled = heroHasLantern && sp.kind === "phantom" && Math.hypot(sp.x - playerState.x, sp.y - playerState.y) < 76;
      const atkKey = `spooky_${sp.kind}_attack_${sp.facing}`;
      const spr = isAttacking && atlas[atkKey] ? atkKey : `spooky_${sp.kind}_${sp.facing}_${step}`;
      const floatBob = sp.kind === "phantom" ? Math.round(Math.sin(tSec * 5 + sp.homeX) * 2) : 0;
      const attackHop = isAttacking ? Math.round(Math.sin(tSec * 18) * -2) : 0;
      const rattleJitter = isStartled || isLanternRepelled ? Math.round(Math.sin(tSec * 42) * 1.5) : 0;
      const respawnLift = isRespawning ? Math.round((sp.respawnAnimTimer / 0.7) * 8) : 0;
      const drawAlpha = isRespawning ? Math.max(0.25, 1 - sp.respawnAnimTimer / 0.7) : 1;
      const sxDraw = Math.round(sp.x - 11 + rattleJitter);
      const syDraw = Math.round(sp.y - 24 + floatBob + attackHop + respawnLift);
      const footX = Math.round(sp.x);
      const footY = Math.round(sp.y + 3);
      const startledBlink = isStartled && Math.floor(tSec * 14) % 2 === 0;
      drawables.push({
        sortY: depthOf(footX, footY),
        draw: () => {
          if (isRespawning) {
            k.drawSprite("fx_grave_mist", footX - 14, footY - 5, 0.85);
          }
          if (!startledBlink) {
            k.drawSprite(spr, sxDraw, syDraw, drawAlpha, bbAngle, footX, footY);
          }
          if (isStartled) {
            k.drawSprite("fx_alert_bang", footX - 3, syDraw - 10, 0.95, bbAngle, footX, footY);
          } else if (isLanternRepelled) {
            k.drawSprite("fx_sparkle_gold", footX + (sp.facing === "right" ? -10 : 4), syDraw + 4, 0.9);
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
          const dFrame = p.life > 0.18 ? 0 : p.life > 0.09 ? 1 : 2;
          k.drawSprite(`fx_dust_${dFrame}`, Math.round(p.x - 4), Math.round(p.y - 4), Math.min(0.88, p.life * 3.2));
        }
        drawHero();
      },
    });

    drawables.sort((a, b) => a.sortY - b.sortY);
    for (const item of drawables) item.draw();

    // Render tailored world interaction & enemy defeat animations (clattering skeleton bones, ectoplasm vortex, Siddur beams, flashlight cones, wind swirls!)
    for (const fx of worldFx) {
      const p = Math.min(1, fx.t / Math.max(0.01, fx.duration));
      const fade = Math.max(0.08, 1 - p);
      if (fx.kind === "skeleton_defeat" && fx.pieces) {
        for (const pc of fx.pieces) {
          k.drawSprite(pc.sprite, Math.round(pc.x - 4), Math.round(pc.y - 4), fade, pc.rot || 0);
        }
      } else if (fx.kind === "phantom_defeat") {
        // Spiraling cyan ectoplasm rings rising upward!
        for (let r = 0; r < 3; r++) {
          const ang = tSec * 12 + r * 2.1;
          const rad = (1 - p) * 10 + 2;
          const rx = Math.round(fx.x + Math.cos(ang) * rad - 4);
          const ry = Math.round(fx.y - 10 - p * 24 - r * 5);
          k.drawSprite("fx_sparkle_cyan", rx, ry, fade);
        }
        k.drawSprite("fx_grave_mist", Math.round(fx.x - 14), Math.round(fx.y - 12 - p * 18), fade * 0.9);
      } else if (fx.kind === "pumpkin_defeat") {
        // Fiery jack-o'-lantern ember pop & violet mist!
        k.drawSprite("fx_ember", Math.round(fx.x - 3), Math.round(fx.y - 14 - p * 18), fade);
        k.drawSprite("fx_grave_mist", Math.round(fx.x - 14), Math.round(fx.y - 8), fade * 0.75);
      } else if (fx.kind === "hit_slash") {
        // Crisp 2x HD comic/SNES sword hit impact cross-flash!
        const hf = p < 0.5 ? 0 : 1;
        k.drawSprite(`fx_hit_slash_${hf}`, Math.round(fx.x - 9), Math.round(fx.y - 9), fade);
      } else if (fx.kind === "siddur_beam") {
        // Tapered 2x HD golden-sapphire peaceful blessing pillar!
        k.drawSprite("fx_siddur_beam", Math.round(fx.x - 9), Math.round(fx.y - 46), fade * 0.92);
      } else if (fx.kind === "flashlight_cone") {
        // Smooth tapered 2x HD golden flashlight beam rotated toward the startled foe!
        const angDeg = (Math.atan2(fx.ty - fx.y, fx.tx - fx.x) * 180) / Math.PI;
        k.drawSprite("fx_flashlight_beam", Math.round(fx.x), Math.round(fx.y - 9), fade * 0.95, angDeg, fx.x, fx.y);
      } else if (fx.kind === "jostle_wind") {
        // Curved 2x HD comic wind-gust swirl when a marathon runner zooms past Liam!
        const wf = Math.floor(p * 4) % 2;
        const wDeg = (Math.atan2(fx.dy, fx.dx) * 180) / Math.PI;
        k.drawSprite(`fx_wind_swirl_${wf}`, Math.round(fx.x - 8), Math.round(fx.y - 6), fade * 0.92, wDeg);
      }
    }

    for (const p of leafParticles) {
      const alpha = Math.min(1, p.life * 2.5);
      if (p.sprite && atlas[p.sprite]) {
        const sp = atlas[p.sprite];
        const sw = sp.width * (sp.__pixelScale || 0.5);
        const sh = sp.height * (sp.__pixelScale || 0.5);
        k.drawSprite(p.sprite, Math.round(p.x - sw / 2), Math.round(p.y - sh / 2), alpha, p.rot || 0);
      } else {
        k.drawRect({
          pos: k.vec2(p.x, p.y),
          width: p.w || 2,
          height: p.h || 2,
          color: k.rgb(...p.shade),
          opacity: alpha,
        });
      }
    }

    // Flying 2x HD tossed pretzel snacks & Lucky Acorns arcing cleanly toward wild animals & marchers!
    for (const sn of tossedSnacks) {
      const sx = Math.round(sn.x);
      const sy = Math.round(sn.y);
      const spinDeg = Math.round(sn.t * 540);
      k.drawSprite(sn.foodKind === "acorn" ? "fx_acorn" : "fx_pretzel", sx - 4, sy - 4, 1, spinDeg);
    }

    // Legend of Zelda: Breath of the Wild Sheikah Fast-Travel Blue/Cyan Energy Teleport VFX!
    if (botwTeleport) {
      const bt = botwTeleport;
      const p = Math.min(1, bt.timer / Math.max(0.01, bt.duration));
      if (bt.phase === "glide") {
        // Luminous Sheikah cyan energy comet streaking across Newton's overworld!
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const cx = Math.round(bt.fromX + (bt.toX - bt.fromX) * ease);
        const cy = Math.round(bt.fromY + (bt.toY - bt.fromY) * ease);
        const vx = bt.toX - bt.fromX;
        const vy = bt.toY - bt.fromY;
        const dist = Math.hypot(vx, vy) || 1;
        const ux = vx / dist;
        const uy = vy / dist;
        for (let i = 7; i >= 0; i--) {
          const txP = Math.round(cx - ux * i * 6);
          const tyP = Math.round(cy - uy * i * 6);
          const sz = Math.max(2, 10 - i);
          k.drawRect({
            pos: k.vec2(txP - Math.floor(sz / 2), tyP - Math.floor(sz / 2)),
            width: sz,
            height: sz,
            color: i < 2 ? k.rgb(236, 254, 255) : k.rgb(42, 220, 255),
            opacity: Math.max(0.14, 1 - i * 0.11),
          });
        }
      } else {
        const isOut = bt.phase === "out";
        const anchorX = Math.round(isOut ? bt.fromX : bt.toX);
        const anchorY = Math.round(isOut ? bt.fromY : bt.toY);
        const intensity = isOut ? Math.sin(p * Math.PI * 0.85) : Math.sin((1 - p) * Math.PI * 0.9);
        const ringExpand = isOut ? p : 1 - p;

        // 1. Ancient glowing circular 2x HD Sheikah ground sigil ring
        k.drawSprite("fx_sheikah_ring", anchorX - 24, anchorY - 11, Math.max(0.14, intensity * 0.94));

        // Orbiting ancient Sheikah diamond rune sigils around the circle
        for (const r of bt.runes) {
          const rot = tSec * 3.4 + r.phase;
          const rx = Math.round(anchorX + Math.cos(rot) * (15 + ringExpand * 9));
          const ry = Math.round(anchorY + 2 + Math.sin(rot) * (7 + ringExpand * 4));
          k.drawRect({ pos: k.vec2(rx - 2, ry - 2), width: 4, height: 4, color: k.rgb(42, 220, 255), opacity: intensity * 0.9 });
          k.drawRect({ pos: k.vec2(rx - 1, ry - 1), width: 2, height: 2, color: k.rgb(240, 254, 255), opacity: intensity });
        }

        // 2. Skyward glowing Sheikah cyan energy beam column
        const beamH = Math.round(28 + (isOut ? p * 125 : (1 - p) * 125));
        const beamW = Math.max(4, Math.round(20 * intensity));
        k.drawRect({
          pos: k.vec2(anchorX - Math.floor(beamW / 2), anchorY - beamH),
          width: beamW,
          height: beamH + 4,
          color: k.rgb(36, 206, 255),
          opacity: Math.max(0.06, intensity * 0.38),
        });
        const coreW = Math.max(2, Math.round(beamW * 0.42));
        k.drawRect({
          pos: k.vec2(anchorX - Math.floor(coreW / 2), anchorY - beamH),
          width: coreW,
          height: beamH + 2,
          color: k.rgb(232, 254, 255),
          opacity: Math.max(0.08, intensity * 0.65),
        });

        // 3. 16 swirling helical BotW Sheikah blue/cyan energy ribbon strands!
        for (const rib of bt.ribbons) {
          const swirlPhase = isOut ? p : 1 - p;
          const ang = rib.angle + tSec * rib.speed * (isOut ? 1 : -1) + swirlPhase * 6.5;
          const rad = Math.max(2, rib.radius * (1 - swirlPhase * 0.55));
          const riseY = anchorY - rib.heightOff - swirlPhase * 96;
          const sx = Math.round(anchorX + Math.cos(ang) * rad);
          const sy = Math.round(riseY + Math.sin(ang) * 3);
          const col =
            rib.hue === 2
              ? k.rgb(236, 254, 255)
              : rib.hue === 1
                ? k.rgb(88, 240, 255)
                : k.rgb(28, 188, 252);
          // Elongated glowing streak ribbon (3 stacked pixel segments)
          k.drawRect({ pos: k.vec2(sx - 1, sy), width: 3, height: 9, color: col, opacity: Math.max(0.15, intensity * 0.95) });
          k.drawRect({ pos: k.vec2(sx, sy - 6), width: 2, height: 6, color: k.rgb(230, 254, 255), opacity: Math.max(0.1, intensity * 0.72) });
        }

        // 4. Arrival / Departure bright cyan shockwave flash burst!
        const flashPeak = isOut ? Math.max(0, (p - 0.68) / 0.32) : Math.max(0, (0.34 - p) / 0.34);
        if (flashPeak > 0.02) {
          const fw = Math.round(14 + (1 - flashPeak) * 36);
          const fh = Math.round(18 + (1 - flashPeak) * 28);
          k.drawRect({
            pos: k.vec2(anchorX - Math.floor(fw / 2), anchorY - Math.floor(fh / 2) - 8),
            width: fw,
            height: fh,
            color: k.rgb(218, 252, 255),
            opacity: flashPeak * 0.62,
          });
        }
      }
    }

    // Overhead Spooky Graveyard Atmosphere: flapping pixel bats, glowing will-o'-the-wisps & drifting silver mist!
    for (const w of propIndices.graveWisps.query(startX - 2, startY - 2, endX + 2, endY + 2)) {
      const wx = Math.round(w.tx * tileSize + 4 + Math.sin(tSec * w.speed + w.phase) * 7);
      const wy = Math.round(w.ty * tileSize + Math.cos(tSec * w.speed * 1.3 + w.phase) * 5 - 3);
      k.drawSprite(`grave_wisp_${animFrame}`, wx, wy);
    }
    for (const b of propIndices.graveBats.query(startX - 3, startY - 3, endX + 3, endY + 3)) {
      const bx = Math.round(b.tx * tileSize + Math.cos(tSec * b.speed + b.phase) * b.radiusX);
      const by = Math.round(b.ty * tileSize - 12 + Math.sin(tSec * b.speed * 1.4 + b.phase) * b.radiusY);
      k.drawSprite(`grave_bat_${fastFlapFrame}`, bx, by);
    }
    // Gentle drifting eerie silver-lavender 2x HD mist wisps strictly over visible graveyard tiles
    for (let ty = startY; ty <= endY; ty += 3) {
      const rowOff = ty * mapW;
      for (let tx = startX; tx <= endX; tx += 4) {
        if (graveyardFeatures.graveyardGrid[rowOff + tx] === 0) continue;
        const drift = ((tSec * 7 + tx * 11 + ty * 17) % 32) - 16;
        const fx = Math.round(tx * tileSize + drift - 6);
        const fy = ty * tileSize + 4;
        k.drawSprite("fx_grave_mist", fx, fy, 0.85);
      }
    }

    // Gentle golden-hour drifting autumn maple leaves floating lazily across the outdoor breeze!
    for (const al of ambientLeaves) {
      const lx = Math.round(cam.x + al.ox);
      const ly = Math.round(cam.y + al.oy);
      const rot = Math.round(Math.sin(tSec * 2.5 + al.phase) * 35);
      k.drawSprite(al.sprite, lx, ly, 0.78, rot);
    }

    // Gleaming 2x HD gilded compass destination pointer — ONLY active in GPS Assist mode!
    if (questSystem.state.gpsAssist && activeTarget) {
      const targetPxX = activeTarget.tileX * tileSize + tileSize / 2;
      const targetPxY = activeTarget.tileY * tileSize + tileSize / 2;
      const dx = targetPxX - cam.x;
      const dy = targetPxY - cam.y;
      const halfViewW = VIEW_W / 2 - 18;
      const halfViewH = VIEW_H / 2 - 16;
      if (Math.abs(dx) > halfViewW || Math.abs(dy) > halfViewH) {
        const angle = Math.atan2(dy, dx);
        const angleDeg = (angle * 180) / Math.PI;
        // Exact ray-box screen edge clamping so pointer always sits on true bearing to destination!
        const edgeScale = Math.min(
          halfViewW / Math.max(1e-3, Math.abs(dx)),
          halfViewH / Math.max(1e-3, Math.abs(dy))
        );
        const edgeX = cam.x + dx * edgeScale;
        const edgeY = cam.y + dy * edgeScale;
        const bob = Math.sin(playerState.elapsedTime * 6.5) * 2.2;
        const wx = Math.round(edgeX + Math.cos(angle) * bob);
        const wy = Math.round(edgeY + Math.sin(angle) * bob);
        const ptrFrame = Math.floor(playerState.elapsedTime * 5) % 2;
        k.drawSprite(`fx_dest_ring_${ptrFrame}`, wx - 7, wy - 7, 0.78);
        k.drawSprite(`fx_dest_pointer_${ptrFrame}`, wx - 9.5, wy - 7.5, 0.98, angleDeg, wx, wy);
      }
    }

    if (showDebug) {
      const sg = safety.subgrid;
      if (sg && sg.hasVectorRoads) {
        const sc = sg.subCellSize;
        const sx0 = Math.max(0, startX * sg.div);
        const sx1 = Math.min(sg.subW - 1, (endX + 1) * sg.div - 1);
        const sy0 = Math.max(0, startY * sg.div);
        const sy1 = Math.min(sg.subH - 1, (endY + 1) * sg.div - 1);
        const canWade = questSystem.canWadeWater();
        for (let sy = sy0; sy <= sy1; sy++) {
          const sRow = sy * sg.subW;
          for (let sx = sx0; sx <= sx1; sx++) {
            const idx = sRow + sx;
            const surf = sg.surface[idx];
            if (sg.collision[idx] === 1) {
              const wadeable = canWade && surf === 6;
              k.drawRect({
                pos: k.vec2(sx * sc, sy * sc),
                width: sc,
                height: sc,
                color: wadeable ? k.rgb(76, 198, 240) : k.rgb(235, 64, 52),
                opacity: wadeable ? 0.24 : 0.34,
              });
            } else if (surf === 4) {
              k.drawRect({
                pos: k.vec2(sx * sc, sy * sc),
                width: sc,
                height: sc,
                color: k.rgb(88, 232, 136),
                opacity: 0.24,
              });
            } else if (surf === 2 || surf === 3 || surf === 12) {
              k.drawRect({
                pos: k.vec2(sx * sc, sy * sc),
                width: sc,
                height: sc,
                color: k.rgb(245, 196, 62),
                opacity: 0.16,
              });
            }
          }
        }
        // Subtle 4px sub-cell grid lines across visible viewport
        for (let sy = sy0; sy <= sy1; sy++) {
          k.drawRect({
            pos: k.vec2(sx0 * sc, sy * sc),
            width: (sx1 - sx0 + 1) * sc,
            height: 0.5,
            color: k.rgb(0, 0, 0),
            opacity: sy % sg.div === 0 ? 0.22 : 0.09,
          });
        }
        for (let sx = sx0; sx <= sx1; sx++) {
          k.drawRect({
            pos: k.vec2(sx * sc, sy0 * sc),
            width: 0.5,
            height: (sy1 - sy0 + 1) * sc,
            color: k.rgb(0, 0, 0),
            opacity: sx % sg.div === 0 ? 0.22 : 0.09,
          });
        }
      } else {
        for (let ty = startY; ty <= endY; ty++) {
          const rowOffset = ty * mapW;
          for (let tx = startX; tx <= endX; tx++) {
            const idx = rowOffset + tx;
            if (collisionLayer[idx] === 1) {
              const wadeable = questSystem.canWadeWater() && baseLayer[idx] === 6;
              k.drawRect({
                pos: k.vec2(tx * tileSize, ty * tileSize),
                width: tileSize,
                height: tileSize,
                color: wadeable ? k.rgb(76, 198, 240) : k.rgb(235, 64, 52),
                opacity: wadeable ? 0.22 : 0.3,
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
    subgrid: safety.subgrid,
    landmarks,
    quests,
    questSystem,
    homeInterior,
    streetSignSystem,
    streetLife,
    roadTraffic,
    playerState,
    triggerSwordSlash,
    triggerSiddurDispel,
    triggerGiveSnack,
    toggleHouseInside,
    startMapTeleport,
    startRoadHitCutscene,
  };
}

boot().catch((err) => {
  console.error("Neighborhood Explorer failed to start:", err);
  const banner = document.getElementById("street-name");
  if (banner) banner.textContent = `Load error: ${err.message}`;
});
