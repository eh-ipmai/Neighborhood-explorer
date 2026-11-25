/**
 * Phase 3: Dynamic Landmarks, Multi-Step Quests, Inventory, Equipment Progression,
 * and Fog-of-War Exploration State (loaded dynamically from data/landmarks.json & data/quests.json).
 */

import { getNavigationSubgrid } from "./subgrid.js";

export const SAVE_STORAGE_KEY = "neighborhood_explorer_save_v1";
export const FOG_GRID_SIZE = 32; // 32x32 cells over the map (16x16 tiles per cell on 512x512)

export const ITEM_CATALOG = {
  folded_map: { name: "Folded Paper Map", icon: "🗺️", sprite: "item_map", desc: "Unrolls Newton Centre streets as you explore!" },
  trail_compass: { name: "Trail Compass", icon: "🧭", sprite: "item_compass", desc: "Helps spot hidden trails in Oakdale Woods." },
  field_stamp: { name: "Weeks Field Stamp", icon: "⚾", sprite: "item_stamp", desc: "Official park scout stamp from Weeks Field." },
  fresh_challah_bag: { name: "Warm Challah & Bagels", icon: "🥯", sprite: "item_challah", desc: "Fresh from Rosenfeld's Bagels on Centre St!" },
  double_scoop_cone: { name: "Double Scoop Cone", icon: "🍦", sprite: "item_icecream", desc: "Sweet explorer energy from J.P. Licks!" },
  library_card: { name: "Newton Library Card", icon: "📚", sprite: "item_book", desc: "Unlocks books & secret reading nooks!" },
  spicy_cholent: { name: "Dad's Spicy Cholent", icon: "🍲", sprite: "item_cholent", desc: "Legendary Kiddush dish with fiery speed energy!" },
  golden_mizuno_glove: { name: "Golden Mizuno Glove", icon: "🧤", sprite: "item_glove", desc: "All-star fielder's mitt from Ward Field!" },
  coop_badge: { name: "Co-Op Explorer Badge", icon: "🤝", sprite: "item_badge", desc: "Best friends hangout badge from the Salzberg family at 200 Cotton St!" },
  friendship_bracelet: { name: "Morton Circle Bracelet", icon: "✨", sprite: "item_badge", desc: "Special neighborhood friendship keepsake from Bella & Sydney's family!" },
  running_shoes: { name: "Running Shoes", icon: "👟", sprite: "item_shoes", desc: "Unlocks faster sidewalk jogging (1.75x speed)!" },
  rare_book_stamp: { name: "Rare Book Stamp", icon: "📖", sprite: "item_book", desc: "Found inside the secret Little Free Library!" },
  scooter: { name: "Neighborhood Scooter", icon: "🛴", sprite: "item_scooter", desc: "High-speed sidewalk kick scooter (2.05x speed)!" },
  mountain_bike: { name: "Trek Mountain Bike", icon: "🚲", sprite: "item_scooter", desc: "Top-tier trail & sidewalk cruiser (2.45x speed)!" },
  pogo_stick: { name: "Secret Pogo Stick", icon: "🦘", sprite: "item_badge", desc: "Bouncy surprise hidden behind the gaga pit!" },
  safety_whistle: { name: "Crossing Guard Whistle", icon: "🦺", sprite: "item_badge", desc: "Official Route 9 Crosswalk Star from Crossing Guard Pat!" },
  explorer_bandages: { name: "Explorer First-Aid Kit", icon: "🩹", sprite: "item_badge", desc: "Handy pocket kit from 575 Boylston Plaza!" },
  hilltop_spyglass: { name: "Hilltop Spyglass", icon: "🔭", sprite: "item_compass", desc: "Spot Newton Centre landmarks from Herrick Road Hill!" },
  chime_keychain: { name: "Chapel Chime Keychain", icon: "🔔", sprite: "item_badge", desc: "Musical keepsake from Wilson Chapel!" },
  swim_pass: { name: "Crystal Lake Swim Pass", icon: "🏊", sprite: "item_stamp", desc: "Official summer beach pass from Crystal Lake!" },
  centre_token: { name: "Newton Centre Token", icon: "🏛️", sprite: "item_badge", desc: "Heart-of-the-village compass token!" },
  golden_bookmark: { name: "Golden Bookmark", icon: "🔖", sprite: "item_book", desc: "Shiny ribbon bookmark from Newtonville Books!" },
  mini_basketball: { name: "Park Mini Basketball", icon: "🏀", sprite: "item_glove", desc: "Bouncy court ball from Newton Centre Playground!" },
  fire_badge: { name: "Junior Firefighter Badge", icon: "🚒", sprite: "item_badge", desc: "Awarded by Newton Fire Station #3 & HQ!" },
  highlands_taco: { name: "Warm Highlands Snack", icon: "🌮", sprite: "item_challah", desc: "Delicious fuel from Anna's Taqueria in Newton Highlands!" },
  music_note_pin: { name: "St. Paul's Music Pin", icon: "🎻", sprite: "item_badge", desc: "Musical explorer pin from Walnut Street!" },
  donut_box: { name: "Route 9 Munchkin Box", icon: "🍩", sprite: "item_challah", desc: "Sweet hiking treat from Boylston Street!" },
  duck_feather: { name: "Pond Duck Feather", icon: "🦆", sprite: "item_compass", desc: "Lucky shimmering feather from Bullough's Pond!" },
  songbook_star: { name: "Ward Street Star", icon: "⭐", sprite: "item_badge", desc: "Keepsake from Temple Emanuel on Ward Street!" },
  honey_cake: { name: "Sweet Honey Cake", icon: "🍯", sprite: "item_challah", desc: "Warm treat from Loring Street in Newton Centre!" },
  pretzel_bag: { name: "Chestnut Hill Pretzel", icon: "🥨", sprite: "item_challah", desc: "Crispy snack from The Mall at Chestnut Hill!" },
  bc_eagle_pennant: { name: "BC Eagle Pennant", icon: "🦅", sprite: "item_pennant", desc: "Maroon & gold Boston College banner from Stuart Hall!" },
  bc_gold_notebook: { name: "BC Gold Notebook", icon: "📒", sprite: "item_book", desc: "Collegiate explorer journal from BC Messina Campus!" },
  spooky_lantern: { name: "Spooky Graveyard Lantern", icon: "🎃", sprite: "item_lantern", desc: "Glowing lantern from East Parish Burying Ground — keeps graveyard ghosts away from you!" },
  ghost_charm: { name: "Friendly Ghost Charm", icon: "👻", sprite: "item_ghost", desc: "Shimmering spirit keepsake from Newton Cemetery & Arboretum!" },
  ghost_lantern_cloak: { name: "Haunted Lantern Cloak", icon: "🕯️", sprite: "item_lantern", desc: "Master Explorer lantern cloak — glows warmly & keeps graveyard ghosts away!" },
  graveyard_sword: { name: "Graveyard Explorer Sword", icon: "⚔️", sprite: "item_sword", desc: "Gleaming hero sword from the Salzberg family — press J to fight graveyard enemies!" },
  pocket_siddur: { name: "Pocket Siddur", icon: "📖", sprite: "item_siddur", desc: "Peaceful synagogue prayerbook — press K to dispel spooky foes & neighborhood bad guys!" },
  outfit_baseball: { name: "Little League Uniform", icon: "⚾", sprite: "item_glove", desc: "Quest-earned Team Giants baseball outfit — press O to wear it!" },
  outfit_wetsuit: { name: "Summer Wetsuit & Snorkel", icon: "🤿", sprite: "item_stamp", desc: "Quest-earned swim outfit — lets you wade through lakes & ponds! Press O to wear it anytime!" },
  outfit_link: { name: "Hero of Hyrule (Link) Outfit", icon: "🗡️", sprite: "item_sword", desc: "Quest-earned Legend of Zelda Link tunic, cap & shield — press O to wear it!" },
  golden_d20: { name: "Golden D20", icon: "🎲", sprite: "item_d20", desc: "Found in Home Base's secret upstairs reading nook! Roll for lucky bonus coins!" },
  bag_of_holding: { name: "Bag of Holding", icon: "🎒", sprite: "item_bag", desc: "Earned in the D&D Basement! Expands your snack pocket up to 12 snacks!" },
};

const ALL_OUTFIT_ORDER = ["polo", "baseball", "wetsuit", "link"];
const OUTFIT_DISPLAY_NAMES = {
  polo: "👕 Polo, Kippah & Tzitzit",
  baseball: "⚾ Little League Uniform",
  wetsuit: "🤿 Summer Wetsuit & Snorkel",
  link: "🗡️ Link (Hero of Hyrule) Outfit",
};

export function getItemMeta(itemId) {
  return (
    ITEM_CATALOG[itemId] || {
      name: String(itemId || "Mystery Item")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: "⭐",
      sprite: "item_badge",
      desc: "A special neighborhood keepsake!",
    }
  );
}

/**
 * Snap a landmark/chest tile onto a reachable walkable tile while keeping NPCs
 * comfortably spaced away from crosswalks and immediate road curbs so talking to
 * someone never fights with Looking Both Ways to cross a street.
 */
export function snapToWalkableTile(worldMap, targetX, targetY, maxRadius = 10, avoidPoints = []) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  const tileSize = worldMap.tileSize || 16;
  const subgrid = getNavigationSubgrid(worldMap);
  const useSub = Boolean(subgrid && subgrid.hasVectorRoads);

  const isRoadId = (id) => id === 2 || id === 3 || id === 4 || id === 12 || id === 13;

  // When 4px vectorRoads subgrid is active, verify the player's 10x10 hitbox centered on (tx, ty)
  // is completely clear of solid sub-cells (walls/medians/water) AND paved vector road lanes!
  const isTileSubgridClear = (tx, ty) => {
    if (!useSub) return true;
    const cx = tx * tileSize + tileSize * 0.5;
    const cy = ty * tileSize + tileSize * 0.5;
    const sc = subgrid.subCellSize;
    const left = Math.floor((cx - 5) / sc);
    const right = Math.floor((cx + 4.999) / sc);
    const top = Math.floor((cy - 5) / sc);
    const bottom = Math.floor((cy + 4.999) / sc);
    for (let sy = top; sy <= bottom; sy++) {
      for (let sx = left; sx <= right; sx++) {
        if (subgrid.isSolidAtSub(sx, sy) || subgrid.isRoadAtSub(sx, sy)) return false;
      }
    }
    return true;
  };

  const clampX = Math.max(0, Math.min(width - 1, Math.round(targetX)));
  const clampY = Math.max(0, Math.min(height - 1, Math.round(targetY)));

  const isTooCloseToAvoid = (tx, ty) => {
    for (const pt of avoidPoints) {
      const minDist = pt.minDist ?? 2.4;
      if (Math.hypot(tx - pt.x, ty - pt.y) < minDist) return true;
    }
    return false;
  };

  const measureRoadClearance = (tx, ty) => {
    let minRoad = 99;
    let minCross = 99;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const t = base[ny * width + nx];
        if (!isRoadId(t)) continue;
        const d = Math.hypot(dx, dy);
        if (d < minRoad) minRoad = d;
        if (t === 4 && d < minCross) minCross = d;
      }
    }
    let openNeighbors = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && collision[ny * width + nx] === 0) {
        openNeighbors++;
      }
    }
    return { minRoad, minCross, openNeighbors };
  };

  // If the exact target tile is already walkable, non-road, and clear of curbs/crosswalks & avoided points, keep it!
  if (
    collision[clampY * width + clampX] === 0 &&
    !isRoadId(base[clampY * width + clampX]) &&
    isTileSubgridClear(clampX, clampY) &&
    !isTooCloseToAvoid(clampX, clampY)
  ) {
    const cl = measureRoadClearance(clampX, clampY);
    if (cl.minCross >= 2.5 && cl.minRoad >= 1.8 && cl.openNeighbors >= 2) {
      return { x: clampX, y: clampY };
    }
  }

  let best = null;
  let bestScore = -Infinity;
  let roadFallback = null;
  const searchRadius = Math.min(maxRadius, 6);

  const considerTile = (tx, ty) => {
    const idx = ty * width + tx;
    if (collision[idx] !== 0) return;
    if (isRoadId(base[idx]) || !isTileSubgridClear(tx, ty)) {
      if (!roadFallback && (!useSub || !subgrid.isSolidAtSub(tx * subgrid.div + 2, ty * subgrid.div + 2))) {
        roadFallback = { x: tx, y: ty };
      }
      return;
    }
    const dist = Math.hypot(tx - clampX, ty - clampY);
    const { minRoad, minCross, openNeighbors } = measureRoadClearance(tx, ty);
    let score = -dist * 4.2;
    // Strongly prefer staying clear of crosswalks & immediate road curbs!
    if (minCross >= 3.0) score += 32;
    else if (minCross >= 2.2) score += 18;
    else score -= 28;

    if (minRoad >= 2.0) score += 18;
    else if (minRoad >= 1.4) score += 8;
    else score -= 12;

    if (openNeighbors < 2) score -= 24;
    if (isTooCloseToAvoid(tx, ty)) score -= 85;
    // Gentle preference for yard/park/sidewalk over tall grass
    if (base[idx] === 1 || base[idx] === 0 || base[idx] === 11) score += 3;

    if (score > bestScore) {
      bestScore = score;
      best = { x: tx, y: ty };
    }
  };

  for (let r = 0; r <= searchRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = clampX + dx;
        const ty = clampY + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        considerTile(tx, ty);
      }
    }
  }
  if (best) return best;

  // Fallback wider scan up to maxRadius if embedded deep inside a huge building footprint
  for (let r = searchRadius + 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = clampX + dx;
        const ty = clampY + dy;
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
        considerTile(tx, ty);
      }
    }
    if (best) return best;
  }
  return roadFallback || { x: clampX, y: clampY };
}

/**
 * Compute human-friendly compass bearing & distance (e.g. "210m NW") from player to target.
 */
export function formatCompassHint(fromX, fromY, toX, toY, scaleMetersPerTile = 6) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distTiles = Math.hypot(dx, dy);
  const meters = Math.round(distTiles * scaleMetersPerTile);
  if (distTiles < 3) return "Right here!";

  const angle = Math.atan2(dy, dx); // 0 = East, -PI/2 = North, PI/2 = South
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return `${meters}m ${dirs[idx]}`;
}

/**
 * Compute traversal gear tier & FASTER speed multiplier from Safety XP & unlocked items (GDD Section 6).
 */
export function getTraversalGear(safetyXP, inventorySet) {
  if (safetyXP >= 750 || inventorySet.has("mountain_bike")) {
    return { id: "mountain_bike", label: "BIKE", mult: 2.35 };
  }
  if (safetyXP >= 350 || inventorySet.has("scooter")) {
    return { id: "scooter", label: "SCOOTER", mult: 2.05 };
  }
  if (safetyXP >= 100 || inventorySet.has("running_shoes")) {
    return { id: "running_shoes", label: "SHOES", mult: 1.75 };
  }
  return { id: "sneakers", label: "FAST", mult: 1.65 };
}

export function createQuestSystem({ landmarks = [], quests = [], worldMap, storage = null } = {}) {
  const mapW = worldMap.dimensions.width;
  const mapH = worldMap.dimensions.height;
  const scaleMeters = worldMap.scaleMetersPerTile || 6;

  // Build reachable world positions for every landmark NPC
  const landmarkMap = new Map();
  const npcs = landmarks.map((lm, index) => {
    const pos = snapToWalkableTile(worldMap, lm.tileX, lm.tileY);
    const enriched = {
      ...lm,
      walkTileX: pos.x,
      walkTileY: pos.y,
      npcSprite:
        lm.npcStyle === "spooky"
          ? "npc_4"
          : lm.npcStyle === "bc"
            ? "npc_5"
            : `npc_${index % 4}`,
    };
    landmarkMap.set(lm.id, enriched);
    return enriched;
  });

  // Extract interactable world objects (e.g. Quest 2 hidden Little Free Library chest),
  // spacing them cleanly away from landmark NPCs so they never share a tile!
  const npcAvoidPoints = npcs.map((lm) => ({ x: lm.walkTileX, y: lm.walkTileY, minDist: 2.6 }));
  const interactables = [];
  for (const q of quests) {
    for (const step of q.steps || []) {
      if (step.completionTrigger === "interact_object" && step.targetTile) {
        const pos = snapToWalkableTile(
          worldMap,
          step.targetTile.x,
          step.targetTile.y,
          10,
          npcAvoidPoints
        );
        interactables.push({
          id: `${q.id}_step_${step.stepIndex}`,
          questId: q.id,
          stepIndex: step.stepIndex,
          name: "Hidden Little Free Library",
          tileX: pos.x,
          tileY: pos.y,
          instruction: step.instruction,
          opened: false,
        });
      }
    }
  }

  // Core progression state
  const state = {
    safetyXP: 0,
    coins: 0,
    acorns: 0,
    snacks: 3,
    discoveredLandmarks: new Set(["home_base"]),
    claimedLandmarkRewards: new Set(),
    inventory: new Set(["folded_map"]),
    openedHomeSecrets: new Set(),
    completedQuests: new Set(),
    activeQuestId: quests[0]?.id || null,
    activeStepIndex: 0,
    openedInteractables: new Set(),
    checkedSigns: new Set(),
    checkedStreets: new Set(),
    lastCheckedSignId: null,
    navMode: "signs", // "signs" (normal North-up) | "hard" (rotating screen + compass) | "gps" (radar assist)
    gpsAssist: false,
    hardMode: false,
    heroOutfit: "polo",
    unlockedOutfits: new Set(["polo"]),
    fogCells: new Uint8Array(FOG_GRID_SIZE * FOG_GRID_SIZE),
  };

  function loadSaved() {
    if (!storage) return;
    try {
      const raw = storage.getItem(SAVE_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (typeof saved.safetyXP === "number") state.safetyXP = saved.safetyXP;
      if (typeof saved.coins === "number") state.coins = saved.coins;
      if (typeof saved.acorns === "number") state.acorns = saved.acorns;
      if (typeof saved.snacks === "number") state.snacks = Math.max(0, Math.floor(saved.snacks));
      if (Array.isArray(saved.openedHomeSecrets)) {
        state.openedHomeSecrets = new Set(saved.openedHomeSecrets);
      }
      if (Array.isArray(saved.discoveredLandmarks)) {
        state.discoveredLandmarks = new Set(saved.discoveredLandmarks);
      }
      if (Array.isArray(saved.claimedLandmarkRewards)) {
        state.claimedLandmarkRewards = new Set(saved.claimedLandmarkRewards);
      }
      if (Array.isArray(saved.inventory)) {
        state.inventory = new Set(saved.inventory);
      }
      if (Array.isArray(saved.completedQuests)) {
        state.completedQuests = new Set(saved.completedQuests);
      }
      if (saved.activeQuestId !== undefined) {
        state.activeQuestId = saved.activeQuestId;
      }
      if (typeof saved.activeStepIndex === "number") {
        state.activeStepIndex = saved.activeStepIndex;
      }
      if (Array.isArray(saved.openedInteractables)) {
        state.openedInteractables = new Set(saved.openedInteractables);
        for (const obj of interactables) {
          obj.opened = state.openedInteractables.has(obj.id);
        }
      }
      if (Array.isArray(saved.checkedSigns)) {
        state.checkedSigns = new Set(saved.checkedSigns);
      }
      if (Array.isArray(saved.checkedStreets)) {
        state.checkedStreets = new Set(saved.checkedStreets);
      }
      if (typeof saved.lastCheckedSignId === "string" || saved.lastCheckedSignId === null) {
        state.lastCheckedSignId = saved.lastCheckedSignId;
      }
      if (saved.navMode === "signs" || saved.navMode === "hard" || saved.navMode === "gps") {
        state.navMode = saved.navMode;
      } else if (typeof saved.gpsAssist === "boolean") {
        state.navMode = saved.gpsAssist ? "gps" : "signs";
      }
      state.gpsAssist = state.navMode === "gps";
      state.hardMode = state.navMode === "hard";
      state.unlockedOutfits = new Set(["polo"]);
      if (Array.isArray(saved.unlockedOutfits)) {
        for (const oid of saved.unlockedOutfits) {
          if (ALL_OUTFIT_ORDER.includes(oid)) state.unlockedOutfits.add(oid);
        }
      }
      // Retroactively unlock any quest-earned outfits for already-completed quests
      for (const q of quests) {
        if (state.completedQuests.has(q.id) && q.rewards?.outfit && ALL_OUTFIT_ORDER.includes(q.rewards.outfit)) {
          state.unlockedOutfits.add(q.rewards.outfit);
        }
      }
      if (
        ALL_OUTFIT_ORDER.includes(saved.heroOutfit) &&
        (state.gpsAssist || state.unlockedOutfits.has(saved.heroOutfit))
      ) {
        state.heroOutfit = saved.heroOutfit;
      } else {
        state.heroOutfit = "polo";
      }
      if (Array.isArray(saved.fogRevealedIndices)) {
        for (const idx of saved.fogRevealedIndices) {
          if (idx >= 0 && idx < state.fogCells.length) state.fogCells[idx] = 1;
        }
      }
    } catch {
      // Ignore corrupt saved state
    }
  }

  function save() {
    if (!storage) return;
    try {
      const fogRevealedIndices = [];
      for (let i = 0; i < state.fogCells.length; i++) {
        if (state.fogCells[i] === 1) fogRevealedIndices.push(i);
      }
      storage.setItem(
        SAVE_STORAGE_KEY,
        JSON.stringify({
          safetyXP: state.safetyXP,
          coins: state.coins,
          acorns: state.acorns,
          snacks: state.snacks,
          openedHomeSecrets: [...state.openedHomeSecrets],
          discoveredLandmarks: [...state.discoveredLandmarks],
          claimedLandmarkRewards: [...state.claimedLandmarkRewards],
          inventory: [...state.inventory],
          completedQuests: [...state.completedQuests],
          activeQuestId: state.activeQuestId,
          activeStepIndex: state.activeStepIndex,
          openedInteractables: [...state.openedInteractables],
          checkedSigns: [...state.checkedSigns],
          checkedStreets: [...state.checkedStreets],
          lastCheckedSignId: state.lastCheckedSignId,
          navMode: state.navMode,
          gpsAssist: state.gpsAssist,
          heroOutfit: state.heroOutfit,
          unlockedOutfits: [...state.unlockedOutfits],
          fogRevealedIndices,
        })
      );
    } catch {
      // Ignore storage quota / private mode errors
    }
  }

  function resetProgress() {
    state.safetyXP = 0;
    state.coins = 0;
    state.acorns = 0;
    state.snacks = 3;
    state.openedHomeSecrets = new Set();
    state.discoveredLandmarks = new Set(["home_base"]);
    state.claimedLandmarkRewards = new Set();
    state.inventory = new Set(["folded_map"]);
    state.completedQuests = new Set();
    state.activeQuestId = quests[0]?.id || null;
    state.activeStepIndex = 0;
    state.openedInteractables = new Set();
    state.checkedSigns = new Set();
    state.checkedStreets = new Set();
    state.lastCheckedSignId = null;
    state.heroOutfit = "polo";
    state.unlockedOutfits = new Set(["polo"]);
    state.fogCells.fill(0);
    for (const obj of interactables) obj.opened = false;
    if (storage) {
      try {
        storage.removeItem(SAVE_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }

  loadSaved();

  function revealFogAtTile(tx, ty, radiusCells = 2) {
    const cx = Math.floor((tx / mapW) * FOG_GRID_SIZE);
    const cy = Math.floor((ty / mapH) * FOG_GRID_SIZE);
    let newlyRevealed = 0;
    for (let dy = -radiusCells; dy <= radiusCells; dy++) {
      for (let dx = -radiusCells; dx <= radiusCells; dx++) {
        if (dx * dx + dy * dy > radiusCells * radiusCells + 1) continue;
        const gx = cx + dx;
        const gy = cy + dy;
        if (gx < 0 || gy < 0 || gx >= FOG_GRID_SIZE || gy >= FOG_GRID_SIZE) continue;
        const idx = gy * FOG_GRID_SIZE + gx;
        if (state.fogCells[idx] === 0) {
          state.fogCells[idx] = 1;
          newlyRevealed++;
        }
      }
    }
    if (newlyRevealed > 0) save();
    return newlyRevealed;
  }

  function getExploredPercent() {
    let count = 0;
    for (let i = 0; i < state.fogCells.length; i++) {
      if (state.fogCells[i] === 1) count++;
    }
    return Math.round((count / state.fogCells.length) * 100);
  }

  function getActiveQuest() {
    if (!state.activeQuestId) return null;
    return quests.find((q) => q.id === state.activeQuestId) || null;
  }

  function getActiveStep() {
    const q = getActiveQuest();
    if (!q || !Array.isArray(q.steps)) return null;
    return q.steps[state.activeStepIndex] || null;
  }

  function getActiveObjectiveTarget() {
    const step = getActiveStep();
    if (!step) return null;
    if (step.targetLandmarkId) {
      const lm = landmarkMap.get(step.targetLandmarkId);
      if (lm) {
        return {
          label: lm.name,
          tileX: lm.walkTileX,
          tileY: lm.walkTileY,
          landmarkId: lm.id,
          instruction: step.instruction,
        };
      }
    }
    if (step.completionTrigger === "interact_object") {
      const q = getActiveQuest();
      const obj = interactables.find((o) => o.questId === q?.id && o.stepIndex === step.stepIndex);
      if (obj) {
        return {
          label: obj.name || q?.title || "Secret Spot",
          tileX: obj.tileX,
          tileY: obj.tileY,
          landmarkId: null,
          instruction: step.instruction,
        };
      }
    }
    if (step.targetTile) {
      return {
        label: getActiveQuest()?.title || "Secret Spot",
        tileX: step.targetTile.x,
        tileY: step.targetTile.y,
        landmarkId: null,
        instruction: step.instruction,
      };
    }
    return null;
  }

  function advanceQuestStep() {
    const q = getActiveQuest();
    if (!q) return null;

    if (state.activeStepIndex + 1 < q.steps.length) {
      state.activeStepIndex += 1;
      save();
      return { type: "step_advanced", quest: q, nextStep: q.steps[state.activeStepIndex] };
    }

    // Quest complete!
    state.completedQuests.add(q.id);
    const reward = q.rewards || {};
    if (reward.xp) state.safetyXP += reward.xp;
    if (reward.coins) state.coins += reward.coins;
    if (reward.item) state.inventory.add(reward.item);

    // Unlock quest's reward outfit (or next locked outfit if player completed a later quest first!)
    let unlockedOutfit = null;
    if (reward.outfit && ALL_OUTFIT_ORDER.includes(reward.outfit) && !state.unlockedOutfits.has(reward.outfit)) {
      unlockedOutfit = reward.outfit;
    } else {
      const nextLocked = ALL_OUTFIT_ORDER.find((oid) => !state.unlockedOutfits.has(oid));
      if (nextLocked) unlockedOutfit = nextLocked;
    }
    if (unlockedOutfit) {
      state.unlockedOutfits.add(unlockedOutfit);
    }

    // Activate next uncompleted quest automatically
    const nextQuest = quests.find((cand) => !state.completedQuests.has(cand.id)) || null;
    state.activeQuestId = nextQuest ? nextQuest.id : null;
    state.activeStepIndex = 0;
    save();

    return {
      type: "quest_completed",
      quest: q,
      rewardItem: reward.item || null,
      unlockedOutfit,
      rewardXP: reward.xp || 0,
      rewardCoins: reward.coins || 0,
      nextQuest,
    };
  }

  /**
   * Check passive proximity triggers as player walks (landmark discovery + tile_reach steps).
   */
  function updatePlayerPosition(tx, ty) {
    const events = [];
    revealFogAtTile(tx, ty);

    // 1. Auto-discover landmarks when within 6 tiles
    for (const lm of npcs) {
      if (state.discoveredLandmarks.has(lm.id)) continue;
      if (Math.hypot(lm.walkTileX - tx, lm.walkTileY - ty) <= 6) {
        state.discoveredLandmarks.add(lm.id);
        if (lm.discoveryXP) state.safetyXP += lm.discoveryXP;
        save();
        events.push({ type: "landmark_discovered", landmark: lm });
      }
    }

    // 2. Check tile_reach active quest step
    const step = getActiveStep();
    if (step && step.completionTrigger === "tile_reach" && step.targetTile) {
      if (Math.hypot(step.targetTile.x - tx, step.targetTile.y - ty) <= 4) {
        const res = advanceQuestStep();
        if (res) events.push(res);
      }
    }

    return events;
  }

  /**
   * Find closest interactable NPC or hidden chest within tight reach (<= 1.45 tiles)
   * so talking to someone only triggers when you actually walk up to them.
   */
  function findNearbyInteraction(tx, ty, maxDist = 1.45) {
    let best = null;
    const activeQuestId = getActiveQuest()?.id || null;
    const activeStep = getActiveStep();

    for (const lm of npcs) {
      const dist = Math.hypot(lm.walkTileX - tx, lm.walkTileY - ty);
      if (dist <= maxDist && (!best || dist < best.dist)) {
        best = { kind: "npc", target: lm, dist };
      }
    }

    for (const obj of interactables) {
      const dist = Math.hypot(obj.tileX - tx, obj.tileY - ty);
      const isActiveUnopenedChest =
        !obj.opened &&
        activeStep?.completionTrigger === "interact_object" &&
        obj.questId === activeQuestId;
      const effectiveDist = isActiveUnopenedChest ? dist - 0.15 : dist;
      const bestEffective = best ? best.dist : Infinity;
      if (dist <= maxDist && (!best || effectiveDist < bestEffective)) {
        best = { kind: "chest", target: obj, dist };
      }
    }

    return best;
  }

  /**
   * Interact with a landmark NPC: discovers landmark, builds dialogue lines,
   * grants landmark reward item (first visit), and advances matching npc_talk quest step.
   */
  function interactWithNpc(landmarkId) {
    const lm = landmarkMap.get(landmarkId);
    if (!lm) return null;

    const fanfareQueue = [];
    const lines = Array.isArray(lm.dialogue) && lm.dialogue.length > 0
      ? [...lm.dialogue]
      : [`Hello from ${lm.name}!`];

    if (!state.discoveredLandmarks.has(lm.id)) {
      state.discoveredLandmarks.add(lm.id);
      if (lm.discoveryXP) state.safetyXP += lm.discoveryXP;
    }

    if (lm.rewardItem && !state.claimedLandmarkRewards.has(lm.id)) {
      state.claimedLandmarkRewards.add(lm.id);
      state.inventory.add(lm.rewardItem);
      fanfareQueue.push({
        itemId: lm.rewardItem,
        sourceLabel: lm.name,
      });
    }

    if (lm.bonusItem && !state.inventory.has(lm.bonusItem)) {
      state.inventory.add(lm.bonusItem);
      fanfareQueue.push({
        itemId: lm.bonusItem,
        sourceLabel: lm.name,
      });
    }

    // Check if active quest step targets this NPC
    const step = getActiveStep();
    let questEvent = null;
    if (step && step.completionTrigger === "npc_talk" && step.targetLandmarkId === lm.id) {
      questEvent = advanceQuestStep();
      if (questEvent?.type === "quest_completed") {
        lines.push(`★ Quest Complete: ${questEvent.quest.title}! (+${questEvent.rewardXP} XP, +${questEvent.rewardCoins} Coins, +Hearts!)`);
        if (questEvent.unlockedOutfit) {
          const outfitExtra =
            questEvent.unlockedOutfit === "wetsuit"
              ? " Now you can wade through Crystal Lake, Bullough's Pond & water areas!"
              : "";
          lines.push(`🎉 New Outfit Unlocked: ${OUTFIT_DISPLAY_NAMES[questEvent.unlockedOutfit]}!${outfitExtra} Press O to switch outfits!`);
          fanfareQueue.push({
            itemId: `outfit_${questEvent.unlockedOutfit}`,
            sourceLabel: `Outfit Unlocked: ${questEvent.quest.title}`,
          });
        }
        if (questEvent.rewardItem) {
          fanfareQueue.push({
            itemId: questEvent.rewardItem,
            sourceLabel: `Quest Reward: ${questEvent.quest.title}`,
          });
        }
      } else if (questEvent?.type === "step_advanced") {
        lines.push(`Next Goal: ${questEvent.nextStep.instruction}`);
      }
    }

    const SNACK_LANDMARKS = new Set([
      "home_base",
      "rosenfelds_bakery",
      "jp_licks",
      "newton_highlands_annas",
      "route9_dunkin",
      "beth_el_atereth_israel",
      "chabad_newton",
      "chestnut_hill_mall",
    ]);
    let gainedSnacks = 0;
    if (SNACK_LANDMARKS.has(lm.id)) {
      gainedSnacks = addSnacks(lm.id === "home_base" ? getMaxSnacks() : 2);
    }

    save();

    const healHearts = Math.max(
      Number(lm.healHearts) || 0,
      questEvent?.type === "quest_completed" ? 2 : 0
    );

    return {
      speaker: `${lm.npcName || "Neighbor"} • ${lm.name}`,
      lines,
      fanfareQueue,
      questEvent,
      healHearts,
      gainedSnacks,
    };
  }

  /**
   * Interact with a hidden world object (e.g. Little Free Library Wooden Chest).
   */
  function interactWithChest(chestId) {
    const obj = interactables.find((o) => o.id === chestId);
    if (!obj) return null;

    const fanfareQueue = [];
    const lines = [];

    const step = getActiveStep();
    const matchesActiveStep =
      step &&
      step.completionTrigger === "interact_object" &&
      getActiveQuest()?.id === obj.questId;

    if (obj.opened && !matchesActiveStep) {
      lines.push("The little wooden book chest is already open — full of neighborhood stories!");
      return { speaker: obj.name, lines, fanfareQueue, questEvent: null };
    }

    const wasAlreadyOpened = obj.opened;
    obj.opened = true;
    state.openedInteractables.add(obj.id);
    lines.push(
      wasAlreadyOpened
        ? "You checked the hidden Little Free Library chest again — your Rare Book Stamp completes the riddle!"
        : "You opened the hidden Little Free Library chest beneath the tall green oaks!"
    );

    let questEvent = null;
    if (matchesActiveStep) {
      questEvent = advanceQuestStep();
      if (questEvent?.type === "quest_completed") {
        lines.push(`★ Quest Complete: ${questEvent.quest.title}! (+${questEvent.rewardXP} XP, +${questEvent.rewardCoins} Coins)`);
        if (questEvent.unlockedOutfit) {
          const outfitExtra =
            questEvent.unlockedOutfit === "wetsuit"
              ? " Now you can wade through Crystal Lake, Bullough's Pond & water areas!"
              : "";
          lines.push(`🎉 New Outfit Unlocked: ${OUTFIT_DISPLAY_NAMES[questEvent.unlockedOutfit]}!${outfitExtra} Press O to switch outfits!`);
          fanfareQueue.push({
            itemId: `outfit_${questEvent.unlockedOutfit}`,
            sourceLabel: `Outfit Unlocked: ${questEvent.quest.title}`,
          });
        }
        if (questEvent.rewardItem) {
          fanfareQueue.push({
            itemId: questEvent.rewardItem,
            sourceLabel: `Quest Reward: ${questEvent.quest.title}`,
          });
        }
      }
    } else {
      // Opened early before Quest 2 became active — still award a fun discovery bonus!
      state.inventory.add("rare_book_stamp");
      state.coins += 15;
      fanfareQueue.push({
        itemId: "rare_book_stamp",
        sourceLabel: obj.name,
      });
    }

    save();
    return {
      speaker: obj.name,
      lines,
      fanfareQueue,
      questEvent,
      healHearts: questEvent?.type === "quest_completed" ? 2 : 0,
    };
  }

  /**
   * Record reading an active street sign: anchors the player's Last Checked Sign
   * on the Folded Paper Map, unlocks street-name awareness for its crossing streets,
   * reveals nearby map fog, and awards +2 Navigator XP on first visit.
   */
  function recordSignCheck(sign) {
    if (!sign || !sign.id) return { isNew: false, xpEarned: 0, totalChecked: state.checkedSigns.size };
    const isNew = !state.checkedSigns.has(sign.id);
    state.checkedSigns.add(sign.id);
    state.lastCheckedSignId = sign.id;
    for (const norm of sign.streetNorms || []) {
      if (norm) state.checkedStreets.add(norm);
    }
    let xpEarned = 0;
    if (isNew) {
      xpEarned = 2;
      state.safetyXP += xpEarned;
    }
    revealFogAtTile(sign.tx, sign.ty, 3);
    save();
    return { isNew, xpEarned, totalChecked: state.checkedSigns.size };
  }

  function setNavMode(mode) {
    if (mode !== "signs" && mode !== "hard" && mode !== "gps") return state.navMode;
    state.navMode = mode;
    state.gpsAssist = mode === "gps";
    state.hardMode = mode === "hard";
    if (!state.gpsAssist && !state.unlockedOutfits.has(state.heroOutfit)) {
      state.heroOutfit = "polo";
    }
    save();
    return state.navMode;
  }

  function cycleNavMode() {
    const order = ["signs", "hard", "gps"];
    const next = order[(order.indexOf(state.navMode) + 1) % order.length];
    return setNavMode(next);
  }

  function toggleGpsAssist() {
    return setNavMode(state.gpsAssist ? "signs" : "gps") === "gps";
  }

  function setActiveQuest(questId) {
    const target = quests.find((q) => q.id === questId && !state.completedQuests.has(q.id));
    if (!target) return null;
    state.activeQuestId = target.id;
    state.activeStepIndex = 0;
    save();
    return target;
  }

  function getUnlockedOutfits() {
    if (state.gpsAssist) return [...ALL_OUTFIT_ORDER];
    return ALL_OUTFIT_ORDER.filter((oid) => state.unlockedOutfits.has(oid));
  }

  function canWadeWater() {
    return state.gpsAssist || state.unlockedOutfits.has("wetsuit");
  }

  function getMaxSnacks() {
    return state.gpsAssist || state.inventory.has("bag_of_holding") ? 12 : 5;
  }

  function hasSnack() {
    return state.gpsAssist || state.snacks > 0;
  }

  function addSnacks(amount = 1) {
    if (!amount || amount <= 0) return 0;
    const max = getMaxSnacks();
    const prev = state.snacks;
    state.snacks = Math.min(max, prev + amount);
    const gained = state.snacks - prev;
    if (gained > 0) save();
    return gained;
  }

  function useSnack() {
    if (state.gpsAssist) return true;
    if (state.snacks <= 0) return false;
    state.snacks -= 1;
    save();
    return true;
  }

  function hasSword() {
    return state.gpsAssist || state.inventory.has("graveyard_sword");
  }

  function hasSiddur() {
    return state.gpsAssist || state.inventory.has("pocket_siddur");
  }

  function hasLantern() {
    return (
      state.gpsAssist ||
      state.inventory.has("spooky_lantern") ||
      state.inventory.has("ghost_lantern_cloak")
    );
  }

  function unlockOutfit(outfitId) {
    if (!ALL_OUTFIT_ORDER.includes(outfitId)) return false;
    state.unlockedOutfits.add(outfitId);
    save();
    return true;
  }

  function toggleHeroOutfit() {
    const unlocked = getUnlockedOutfits();
    if (unlocked.length <= 1) {
      state.heroOutfit = "polo";
      return state.heroOutfit;
    }
    const curIdx = unlocked.indexOf(state.heroOutfit);
    const nextIdx = (curIdx + 1) % unlocked.length;
    state.heroOutfit = unlocked[nextIdx];
    save();
    return state.heroOutfit;
  }

  return {
    state,
    npcs,
    interactables,
    landmarks: npcs,
    quests,
    save,
    resetProgress,
    revealFogAtTile,
    getExploredPercent,
    getActiveQuest,
    getActiveStep,
    getActiveObjectiveTarget,
    setActiveQuest,
    getGear: () =>
      state.gpsAssist
        ? getTraversalGear(999, state.inventory)
        : getTraversalGear(state.safetyXP, state.inventory),
    formatTargetHint: (tx, ty) => {
      const target = getActiveObjectiveTarget();
      if (!target) return null;
      return {
        ...target,
        compass: formatCompassHint(tx, ty, target.tileX, target.tileY, scaleMeters),
      };
    },
    updatePlayerPosition,
    findNearbyInteraction,
    interactWithNpc,
    interactWithChest,
    recordSignCheck,
    setNavMode,
    cycleNavMode,
    toggleGpsAssist,
    getUnlockedOutfits,
    canWadeWater,
    hasSword,
    hasSiddur,
    hasLantern,
    getMaxSnacks,
    hasSnack,
    addSnacks,
    useSnack,
    unlockOutfit,
    toggleHeroOutfit,
  };
}
