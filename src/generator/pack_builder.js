/**
 * Pure-JS Universal Neighborhood Package Builder & Editor (Browser + Node ESM).
 *
 * Orchestrates geocoding, OpenStreetMap downloading, tile rasterization,
 * vector road extraction, automatic POI discovery, custom places & quests,
 * and portable `.json` pack validation/editing — running identically in the
 * browser Studio and the Node CLI!
 */

import {
  DEFAULT_CONFIG,
  computeBoundingBox,
  rasterizeOsmData,
  enrichWorldMap,
} from "./rasterizer.js";
import { geocodeAddress } from "./geocode.js";
import { fetchOsmDataForBbox } from "./osm_fetch.js";
import { generateLandmarksAndQuests } from "./poi_landmarks.js";
import { slugifyNeighborhood } from "../neighborhood_meta.js";
import {
  BIOME_PRESETS,
  SEASONS,
  detectBiomeForLocation,
  detectSeasonForLocation,
  detectLocalQuirks,
  getDrivingSideForCountry,
} from "../biomes.js";
import { detectLocalFlair } from "../local_flair.js";
import { snapToWalkableTile } from "../quests.js";
import { projectLatLonToFloatTile } from "../vector_roads.js";

export const SIZE_PRESETS = {
  walkable: {
    id: "walkable",
    width: 256,
    height: 256,
    scale: 6,
    label: "Walkable (~1.5 km / 0.95 mi)",
    eta: "~20–40 sec",
  },
  standard: {
    id: "standard",
    width: 384,
    height: 384,
    scale: 6,
    label: "Standard (~2.3 km / 1.4 mi)",
    eta: "~45–75 sec",
  },
  full: {
    id: "full",
    width: 512,
    height: 512,
    scale: 6,
    label: "Full Town (~3.1 km / 1.9 mi)",
    eta: "~1–2 min",
  },
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function resolveCustomPlaces(
  rawConfig,
  { geocodeFn = geocodeAddress, townHint = "", onProgress = null, delayMs = 1050 } = {}
) {
  const places = Array.isArray(rawConfig?.places)
    ? rawConfig.places
    : Array.isArray(rawConfig)
      ? rawConfig
      : [];
  const quests = Array.isArray(rawConfig?.quests) ? rawConfig.quests : [];
  const resolvedPlaces = [];

  for (let i = 0; i < places.length; i++) {
    const p = places[i];
    if (!p || !p.name) continue;
    if (
      (typeof p.lat === "number" && Number.isFinite(p.lat) && typeof p.lon === "number" && Number.isFinite(p.lon)) ||
      (typeof p.tileX === "number" && Number.isFinite(p.tileX) && typeof p.tileY === "number" && Number.isFinite(p.tileY))
    ) {
      resolvedPlaces.push(p);
      continue;
    }
    if (p.address) {
      const q = townHint && !p.address.includes(",") ? `${p.address}, ${townHint}` : p.address;
      onProgress?.({
        stage: "custom_places",
        completed: i,
        total: places.length,
        message: `Finding custom place "${p.name}"...`,
      });
      try {
        const geo = await geocodeFn(q);
        resolvedPlaces.push({
          ...p,
          lat: geo.lat,
          lon: geo.lon,
          address: geo.homeAddress || p.address,
        });
        if (delayMs > 0 && i < places.length - 1) {
          await sleep(delayMs);
        }
      } catch (err) {
        onProgress?.({
          stage: "custom_places",
          completed: i + 1,
          total: places.length,
          message: `Skipped "${p.name}" (${err.message})`,
        });
      }
    }
  }

  return { places: resolvedPlaces, quests };
}

/**
 * End-to-end pure-JS neighborhood builder (Browser + Node!).
 */
export async function buildNeighborhoodPackage({
  address = "",
  lat = null,
  lon = null,
  heroName = "Explorer",
  heroProfile = null,
  townOverride = "",
  biome = "auto",
  season = "auto",
  labelMode = "bilingual",
  countryCode = "",
  size = "walkable",
  width = null,
  height = null,
  scale = 6,
  customPlacesConfig = null,
  osmElements = null,
  geocodeFn = geocodeAddress,
  fetchOsmFn = fetchOsmDataForBbox,
  onProgress = null,
  preferOverpass = false,
} = {}) {
  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.walkable;
  const gridW = width || preset.width;
  const gridH = height || preset.height;
  const gridScale = scale || preset.scale;

  let geo = null;
  if (typeof lat === "number" && Number.isFinite(lat) && typeof lon === "number" && Number.isFinite(lon)) {
    const cleanAddr = address || "Home Base";
    const town = townOverride || "Your Neighborhood";
    const resolvedCc = String(countryCode || "").trim().toLowerCase();
    geo = {
      lat,
      lon,
      homeAddress: cleanAddr,
      townName: town,
      cityShort: town.split(",")[0].trim() || "Town",
      countryCode: resolvedCc,
      drivingSide: getDrivingSideForCountry(resolvedCc),
    };
  } else {
    onProgress?.({ stage: "geocode", completed: 0, total: 1, message: `Looking up "${address}"...` });
    geo = await geocodeFn(address);
    if (townOverride) {
      geo.townName = townOverride;
      geo.cityShort = townOverride.split(",")[0].trim() || geo.cityShort;
    }
    onProgress?.({
      stage: "geocode",
      completed: 1,
      total: 1,
      message: `Found ${geo.homeAddress} in ${geo.townName}`,
    });
  }

  const resolvedCountryCode = String(countryCode || geo.countryCode || "").trim().toLowerCase();
  const resolvedDrivingSide = geo.drivingSide || getDrivingSideForCountry(resolvedCountryCode);
  const resolvedBiome =
    biome && biome !== "auto" && BIOME_PRESETS[biome]
      ? biome
      : detectBiomeForLocation({
          lat: geo.lat,
          lon: geo.lon,
          countryCode: resolvedCountryCode,
          townName: geo.townName,
          preset: "generic",
        });
  const resolvedLabelMode = ["bilingual", "en", "local"].includes(labelMode) ? labelMode : "bilingual";
  const resolvedSeason =
    season && season !== "auto" && SEASONS[season]
      ? season
      : detectSeasonForLocation({
          lat: geo.lat,
          biomeId: resolvedBiome,
          isNewton: false,
        });
  const resolvedQuirks = detectLocalQuirks({
    lat: geo.lat,
    lon: geo.lon,
    townName: geo.townName,
    address: geo.homeAddress,
    countryCode: resolvedCountryCode,
  });
  const resolvedLocalFlair = detectLocalFlair({
    lat: geo.lat,
    lon: geo.lon,
    countryCode: resolvedCountryCode,
    townName: geo.townName,
    address: geo.homeAddress,
    biomeId: resolvedBiome,
    preset: "generic",
  });

  const meta = {
    id: slugifyNeighborhood(`${geo.homeAddress}_${geo.townName}`),
    preset: "generic",
    townName: geo.townName,
    cityShort: geo.cityShort,
    homeAddress: geo.homeAddress,
    heroName: String(heroName || "Explorer").trim() || "Explorer",
    ...(heroProfile && typeof heroProfile === "object" ? { heroProfile } : {}),
    countryCode: resolvedCountryCode,
    drivingSide: resolvedDrivingSide,
    biome: resolvedBiome,
    season: resolvedSeason,
    localFlair: resolvedLocalFlair,
    ...(resolvedQuirks.length > 0 ? { quirks: resolvedQuirks } : {}),
    labelMode: resolvedLabelMode,
    generatedAt: new Date().toISOString(),
  };

  const config = {
    tileSize: DEFAULT_CONFIG.tileSize,
    scaleMetersPerTile: gridScale,
    width: gridW,
    height: gridH,
    origin: {
      lat: geo.lat,
      lon: geo.lon,
      address: geo.homeAddress,
      name: `Home Base (${geo.homeAddress})`,
    },
    mapCenter: { lat: geo.lat, lon: geo.lon },
    meta,
  };

  const bbox = computeBoundingBox(geo.lat, geo.lon, gridW, gridH, gridScale);
  const gridMeters = Math.max(gridW, gridH) * gridScale;

  const elements = Array.isArray(osmElements)
    ? osmElements
    : await fetchOsmFn(bbox, { gridMeters, onProgress, preferOverpass });

  onProgress?.({
    stage: "rasterize",
    completed: 0,
    total: 2,
    message: `Building ${gridW}×${gridH} SNES pixel world from ${elements.length.toLocaleString()} map features...`,
  });

  // Yield briefly in browser so the progress UI repaints smoothly before heavy rasterization
  if (typeof window !== "undefined") {
    await sleep(30);
  }

  const rawMap = rasterizeOsmData(elements, config);
  const worldMap = enrichWorldMap(rawMap);

  onProgress?.({
    stage: "rasterize",
    completed: 1,
    total: 2,
    message: "Discovering real neighborhood landmarks & crafting quests...",
  });

  const resolvedCustom = customPlacesConfig
    ? await resolveCustomPlaces(customPlacesConfig, {
        geocodeFn,
        townHint: geo.townName,
        onProgress,
      })
    : { places: [], quests: [] };

  const { landmarks, quests } = generateLandmarksAndQuests({
    elements,
    worldMap,
    customPlaces: resolvedCustom.places,
    customQuests: resolvedCustom.quests,
    meta,
  });

  const houseColors = {
    _comment: `Custom house colors for ${geo.townName}. Paint houses in-game (press P) and export here!`,
  };

  onProgress?.({
    stage: "done",
    completed: 2,
    total: 2,
    message: `Ready! ${worldMap.buildings.length} buildings, ${landmarks.length} landmarks, ${quests.length} quests!`,
  });

  return {
    formatVersion: 1,
    meta,
    worldMap,
    landmarks,
    quests,
    houseColors,
  };
}

/**
 * Validate an imported or loaded neighborhood pack object.
 */
export function validateNeighborhoodPack(pack) {
  if (!pack || typeof pack !== "object") {
    return { valid: false, error: "File is not a valid JSON object." };
  }
  const wm = pack.worldMap;
  if (
    !wm ||
    !wm.dimensions ||
    typeof wm.dimensions.width !== "number" ||
    typeof wm.dimensions.height !== "number" ||
    !wm.layers ||
    !Array.isArray(wm.layers.base) ||
    !Array.isArray(wm.layers.collision)
  ) {
    return { valid: false, error: "Neighborhood pack is missing a valid worldMap grid." };
  }
  const expectedLen = wm.dimensions.width * wm.dimensions.height;
  if (wm.layers.base.length !== expectedLen || wm.layers.collision.length !== expectedLen) {
    return { valid: false, error: "worldMap tile layers do not match map dimensions." };
  }
  if (!Array.isArray(pack.landmarks)) {
    return { valid: false, error: "Neighborhood pack is missing landmarks array." };
  }
  if (!Array.isArray(pack.quests)) {
    return { valid: false, error: "Neighborhood pack is missing quests array." };
  }
  return { valid: true, error: null };
}

/**
 * Immutably add a custom landmark/important place to an existing neighborhood pack.
 * Supports either (tileX, tileY) or (lat, lon) coordinates!
 */
export function addCustomPlaceToPack(pack, place = {}) {
  if (!pack?.worldMap || !place?.name) {
    throw new Error("Custom place requires a name and valid neighborhood pack.");
  }
  const wm = pack.worldMap;
  const { width, height } = wm.dimensions;
  const scale = wm.scaleMetersPerTile || 6;
  const mapCenter = wm.mapCenter || wm.origin || { lat: 0, lon: 0 };

  let rawX = typeof place.tileX === "number" ? place.tileX : null;
  let rawY = typeof place.tileY === "number" ? place.tileY : null;
  if ((rawX === null || rawY === null) && typeof place.lat === "number" && typeof place.lon === "number") {
    const pt = projectLatLonToFloatTile(place.lat, place.lon, mapCenter.lat, mapCenter.lon, width, height, scale);
    rawX = Math.round(pt.x);
    rawY = Math.round(pt.y);
  }
  if (rawX === null || rawY === null) {
    throw new Error("Place needs either map coordinates (tileX/tileY) or GPS coordinates (lat/lon).");
  }

  const clampedX = Math.max(4, Math.min(width - 5, rawX));
  const clampedY = Math.max(4, Math.min(height - 5, rawY));
  const avoid = (pack.landmarks || []).map((l) => ({ x: l.tileX, y: l.tileY, minDist: 2.5 }));
  const snapped = snapToWalkableTile(wm, clampedX, clampedY, 12, avoid);

  const existingIds = new Set((pack.landmarks || []).map((l) => l.id));
  const baseId = slugifyNeighborhood(place.id || place.name).slice(0, 36) || "custom_place";
  let id = baseId;
  let n = 2;
  while (existingIds.has(id)) {
    id = `${baseId}_${n++}`;
  }

  const heroName = pack.meta?.heroName || "Explorer";
  const cleanName = String(place.name).trim();
  const rewardId = place.rewardItem || `${id}_keepsake`;
  const newLandmark = {
    id,
    name: cleanName,
    address: place.address ? String(place.address).trim() : "",
    ...(typeof place.lat === "number" ? { lat: place.lat } : {}),
    ...(typeof place.lon === "number" ? { lon: place.lon } : {}),
    tileX: snapped.x,
    tileY: snapped.y,
    sprite: place.sprite || "friend_house",
    discoveryXP: typeof place.discoveryXP === "number" ? place.discoveryXP : 65,
    npcName: String(place.npcName || "Friendly Neighbor").trim(),
    healHearts: typeof place.healHearts === "number" ? place.healHearts : 2,
    givesSnacks: place.givesSnacks !== undefined ? Boolean(place.givesSnacks) : true,
    dialogue:
      Array.isArray(place.dialogue) && place.dialogue.length > 0
        ? place.dialogue.map(String)
        : typeof place.dialogue === "string" && place.dialogue.trim()
          ? [place.dialogue.trim()]
          : [`Hey ${heroName}! Welcome to ${cleanName}! So glad you came to visit!`],
    rewardItem: rewardId,
    rewardItemMeta: place.rewardItemMeta || {
      name: `${cleanName} Keepsake`,
      icon: place.icon || "⭐",
      sprite: "item_badge",
      desc: `Special keepsake from ${cleanName}!`,
    },
    isCustom: true,
    category: place.category || "custom",
  };

  return {
    pack: {
      ...pack,
      landmarks: [...(pack.landmarks || []), newLandmark],
    },
    landmark: newLandmark,
  };
}

/**
 * Immutably remove a landmark from a pack (never deletes home_base).
 */
export function removePlaceFromPack(pack, landmarkId) {
  if (!pack || !landmarkId || landmarkId === "home_base") return pack;
  const nextLandmarks = (pack.landmarks || []).filter((l) => l.id !== landmarkId);
  const nextQuests = (pack.quests || [])
    .map((q) => ({
      ...q,
      steps: (q.steps || []).filter((s) => s.targetLandmarkId !== landmarkId),
    }))
    .filter((q) => q.steps.length > 0);
  return {
    ...pack,
    landmarks: nextLandmarks,
    quests: nextQuests,
  };
}

/**
 * Immutably add a custom quest/goal to a neighborhood pack.
 */
export function addCustomQuestToPack(pack, { title, description = "", targetLandmarkIds = [], rewardItem = "running_shoes" } = {}) {
  if (!pack || !title || !Array.isArray(targetLandmarkIds) || targetLandmarkIds.length === 0) {
    throw new Error("A custom quest needs a title and at least one destination place.");
  }
  const lmById = new Map((pack.landmarks || []).map((l) => [l.id, l]));
  const steps = targetLandmarkIds
    .map((id) => lmById.get(id))
    .filter(Boolean)
    .map((lm, idx) => ({
      stepIndex: idx + 1,
      instruction: `Visit ${lm.npcName || "your neighbor"} at ${lm.name}${lm.address ? ` (${lm.address})` : ""}.`,
      targetLandmarkId: lm.id,
      completionTrigger: "npc_talk",
    }));

  if (steps.length === 0) {
    throw new Error("None of the selected places exist in this neighborhood.");
  }

  const id = `quest_custom_${slugifyNeighborhood(title).slice(0, 24)}_${Date.now().toString(36).slice(-4)}`;
  const quest = {
    id,
    tier: 1,
    title: String(title).trim(),
    description: String(description || `Explore the neighborhood to complete ${title}!`).trim(),
    steps,
    rewards: {
      xp: 125,
      coins: 45,
      item: rewardItem,
    },
    isCustom: true,
  };

  return {
    pack: {
      ...pack,
      // Put custom quests right at the top of the quest log!
      quests: [quest, ...(pack.quests || [])],
    },
    quest,
  };
}
