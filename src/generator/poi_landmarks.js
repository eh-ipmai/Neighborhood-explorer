/**
 * Pure-JS Automatic Landmark & Quest Generator (Browser + Node ESM).
 *
 * Discovers real neighborhood places from OpenStreetMap elements (libraries,
 * parks, ice cream shops, bakeries, cafes, bookstores, fire stations, schools,
 * houses of worship, lakes/ponds, cemeteries, civic plazas), merges user-defined
 * custom places & goals, and generates balanced kid-friendly RPG quests.
 */

import { snapToWalkableTile } from "../quests.js";
import { getNeighborhoodMeta, slugifyNeighborhood } from "../neighborhood_meta.js";
import { projectLatLonToFloatTile } from "../vector_roads.js";
import {
  formatBilingualName,
  formatInternationalAddress,
  isIsraelLocation,
} from "../biomes.js";
import { getLocalFlairProfile } from "../local_flair.js";

/**
 * Respectful, kid-friendly registry of local faith traditions discovered from real OSM
 * houses of worship (religion=*, building=*, and multilingual names).
 * Every local house of worship offers a warm hospitality treat, its own authentic
 * tradition keepsake item, AND the universal Pocket Prayer Book (`pocket_siddur`)!
 */
export const FAITH_TRADITIONS = {
  jewish: {
    id: "jewish",
    label: "Synagogue",
    greeting: "Shalom",
    npcNames: ["Cantor Rachel", "Neighbor Avi", "Rabbi David"],
    rewardItem: "brass_menorah_pin",
    healHearts: 2,
    sprite: "synagogue_building",
    dialogue: (name, hero) => [
      `Shalom ${hero}! Welcome to ${name}! Enjoy a warm kiddush treat (+2 hearts!) and this Golden Menorah Keepsake!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  christian: {
    id: "christian",
    label: "Church",
    greeting: "Peace",
    npcNames: ["Bellringer Eli", "Choir Leader Clara", "Pastor Ingrid"],
    rewardItem: "stained_glass_charm",
    healHearts: 2,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Enjoy a warm bake-sale treat (+2 hearts!) and this Stained-Glass Sunbeam Charm!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  muslim: {
    id: "muslim",
    label: "Mosque",
    greeting: "Salam",
    npcNames: ["Calligrapher Tariq", "Imam Sami", "Neighbor Layla"],
    rewardItem: "crescent_lantern_charm",
    healHearts: 2,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Salam ${hero}! Welcome to ${name}! Enjoy sweet honey dates & tea (+2 hearts!) and this Crescent Brass Lantern!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  buddhist: {
    id: "buddhist",
    label: "Buddhist Temple",
    greeting: "Peace",
    npcNames: ["Monk Kenji", "Gardener Mei", "Storyteller Tenzin"],
    rewardItem: "lotus_bell_charm",
    healHearts: 2,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Enjoy calming tea & sweet rice cakes (+2 hearts!) and this Golden Lotus Bell!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  hindu: {
    id: "hindu",
    label: "Hindu Temple",
    greeting: "Namaste",
    npcNames: ["Musician Priya", "Artisan Vikram", "Neighbor Ananya"],
    rewardItem: "diya_oil_lamp",
    healHearts: 2,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Namaste ${hero}! Welcome to ${name}! Enjoy sweet cardamom laddu (+2 hearts!) and this Festive Clay Diya Lamp!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  sikh: {
    id: "sikh",
    label: "Gurdwara",
    greeting: "Sat Sri Akal",
    npcNames: ["Chef Harpreet", "Neighbor Simran", "Musician Dev"],
    rewardItem: "langar_sweet_box",
    healHearts: 3,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Sat Sri Akal ${hero}! Welcome to ${name}! Everyone is welcome at our free community Langar kitchen (+3 hearts!) — take this Warm Langar Sweet Box!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  shinto: {
    id: "shinto",
    label: "Shinto Shrine",
    greeting: "Konnichiwa",
    npcNames: ["Shrine Keeper Yuki", "Artisan Ren"],
    rewardItem: "omamori_charm",
    healHearts: 2,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Enjoy sweet matcha mochi (+2 hearts!) and this Woven Omamori Charm!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  interfaith: {
    id: "interfaith",
    label: "House of Worship",
    greeting: "Welcome",
    npcNames: ["Choir Leader Noah", "Community Host Hana"],
    rewardItem: "chime_keychain",
    healHearts: 2,
    sprite: "civic_hall",
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Enjoy a warm neighborhood snack (+2 hearts!) and this Peace Chime Keychain!`,
      "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
};

/**
 * Detect which faith tradition an OpenStreetMap house of worship belongs to using
 * standard OSM `religion=*`, `building=*`, and multilingual place-name clues.
 */
export function detectFaithTradition(tags = {}) {
  const rel = String(tags.religion || "").toLowerCase().trim();
  const b = String(tags.building || "").toLowerCase().trim();
  const denom = String(tags.denomination || "").toLowerCase().trim();
  const lower = `${tags.name || ""} ${tags["name:en"] || ""} ${tags["name:he"] || ""} ${tags["name:ar"] || ""}`.toLowerCase();

  if (
    rel === "jewish" ||
    b === "synagogue" ||
    lower.includes("synagogue") ||
    lower.includes("beit knesset") ||
    lower.includes("shul") ||
    lower.includes("chabad") ||
    lower.includes("beth el") ||
    lower.includes("congregation ") ||
    lower.includes("בית כנסת") ||
    lower.includes("בית הכנסת")
  ) {
    return "jewish";
  }
  if (
    rel === "muslim" ||
    b === "mosque" ||
    lower.includes("mosque") ||
    lower.includes("masjid") ||
    lower.includes("islamic center") ||
    lower.includes("islamic centre") ||
    lower.includes("moské") ||
    lower.includes("moschee") ||
    lower.includes("mosquée") ||
    lower.includes("مسجد") ||
    lower.includes("جامع") ||
    lower.includes("מסגד")
  ) {
    return "muslim";
  }
  if (
    rel === "buddhist" ||
    b === "pagoda" ||
    lower.includes("buddhist") ||
    lower.includes("pagoda") ||
    lower.includes("wat ") ||
    lower.includes("vihara") ||
    lower.includes("zen center") ||
    lower.includes("zen centre") ||
    lower.includes("寺")
  ) {
    return "buddhist";
  }
  if (
    rel === "hindu" ||
    lower.includes("hindu") ||
    lower.includes("mandir") ||
    lower.includes("iskcon") ||
    lower.includes("swaminarayan") ||
    lower.includes("मंदिर")
  ) {
    return "hindu";
  }
  if (
    rel === "sikh" ||
    b === "gurdwara" ||
    lower.includes("gurdwara") ||
    lower.includes("gurudwara") ||
    lower.includes("sikh")
  ) {
    return "sikh";
  }
  if (
    rel === "shinto" ||
    b === "shrine" ||
    lower.includes("shinto") ||
    lower.includes("jinja") ||
    lower.includes("taisha") ||
    lower.includes("jingu") ||
    lower.includes("神社") ||
    lower.includes("神宮")
  ) {
    return "shinto";
  }
  if (
    rel === "christian" ||
    b === "church" ||
    b === "cathedral" ||
    b === "chapel" ||
    b === "basilica" ||
    denom.includes("catholic") ||
    denom.includes("lutheran") ||
    denom.includes("baptist") ||
    denom.includes("methodist") ||
    denom.includes("orthodox") ||
    denom.includes("anglican") ||
    denom.includes("protestant") ||
    lower.includes("church") ||
    lower.includes("cathedral") ||
    lower.includes("chapel") ||
    lower.includes("parish") ||
    lower.includes("basilica") ||
    lower.includes("abbey") ||
    lower.includes("kirke") ||
    lower.includes("kyrka") ||
    lower.includes("kirche") ||
    lower.includes("domkirke") ||
    lower.includes("église") ||
    lower.includes("eglise") ||
    lower.includes("iglesia") ||
    lower.includes("chiesa") ||
    lower.includes("כנסייה") ||
    lower.includes("كنيسة")
  ) {
    return "christian";
  }
  return "interfaith";
}

const CATEGORY_TEMPLATES = {
  library: {
    priority: 10,
    maxCount: 2,
    sprite: "library_building",
    xp: 65,
    npcNames: ["Librarian Clara", "Storyteller Leo"],
    rewardItem: "library_card",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Check out our shelves for neighborhood mysteries and adventure books!`,
      "Here's your official Explorer Library Card — keep an eye out for hidden Little Free Libraries in local parks!",
    ],
  },
  ice_cream_bakery: {
    priority: 9,
    maxCount: 3,
    sprite: "ice_cream_shop",
    xp: 55,
    npcNames: ["Scooper Maya", "Baker Ben", "Barista Marco"],
    rewardItem: "double_scoop_cone",
    healHearts: 3,
    givesSnacks: true,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Fresh treats straight from the counter — have a bite to restore your hearts!`,
      "We packed extra snacks in your pocket too — share them with hungry sidewalk marchers or wild critters!",
    ],
  },
  park: {
    priority: 9,
    maxCount: 3,
    sprite: "park_field",
    xp: 45,
    npcNames: ["Ranger Rick", "Park Scout Sam", "Coach Dani"],
    rewardItem: "field_stamp",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Awesome exploring, ${hero}! Welcome to ${name} — rustle the tall grass to spot lucky acorns and shiny coins!`,
      "Take this official Park Explorer Stamp for your backpack!",
    ],
  },
  bookstore: {
    priority: 8,
    maxCount: 2,
    sprite: "bookstore",
    xp: 50,
    npcNames: ["Bookseller Tessa", "Curator Owen"],
    rewardItem: "golden_bookmark",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Every great neighborhood adventure deserves a great story!`,
      "Here's a shiny Golden Explorer Bookmark for your journey!",
    ],
  },
  fire_station: {
    priority: 8,
    maxCount: 1,
    sprite: "fire_station",
    xp: 60,
    npcNames: ["Firefighter Fiona", "Captain Mateo"],
    rewardItem: "fire_badge",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Our shiny red fire engines love when explorers Look Both Ways at crosswalks!`,
      "You earned a Junior Firefighter Helmet Badge!",
    ],
  },
  school: {
    priority: 7,
    maxCount: 2,
    sprite: "school_building",
    xp: 55,
    npcNames: ["Coach Jordan", "Teacher Avery"],
    rewardItem: "mini_basketball",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Hey ${hero}, welcome to ${name}! Great job navigating the neighborhood street signs to get here!`,
      "Take this Playground Mini Basketball keepsake for your backpack!",
    ],
  },
  house_of_worship: {
    priority: 8,
    maxCount: 4,
    sprite: "civic_hall",
    xp: 60,
    npcNames: ["Choir Leader Noah", "Cantor Rachel", "Neighbor Tariq", "Musician Priya"],
    rewardItem: "chime_keychain",
    bonusItem: "pocket_siddur",
    healHearts: 2,
    givesSnacks: true,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Here's a warm snack (+2 hearts!) and a Pocket Prayer Book!`,
      "Press K (or tap 📖 Prayer Book) anytime to shine a peaceful light that calms spooky graveyard foes!",
    ],
  },
  water: {
    priority: 7,
    maxCount: 2,
    sprite: "lake_beach",
    xp: 55,
    npcNames: ["Lifeguard Leo", "Birdwatcher Gabe"],
    rewardItem: "swim_pass",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Watch the shimmering water along the shoreline!`,
      "Take this Explorer Swim Pass — unlock the Wetsuit outfit from quests to wade through shallow water!",
    ],
  },
  graveyard: {
    priority: 8,
    maxCount: 2,
    sprite: "spooky_graveyard",
    npcStyle: "spooky",
    xp: 75,
    npcNames: ["Ghostly Historian Oliver", "Groundskeeper Willow"],
    rewardItem: "spooky_lantern",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Booo-jour, brave ${hero}! Welcome to ${name} — our floating ghosts and glowing pumpkins love brave explorers!`,
      "Take this Spooky Lantern — its warm glow keeps graveyard ghosts from sneaking up on you!",
    ],
  },
  food_shop: {
    priority: 6,
    maxCount: 2,
    sprite: "shop_storefront",
    xp: 50,
    npcNames: ["Chef Carlos", "Shopkeeper Mia"],
    rewardItem: "pretzel_bag",
    healHearts: 2,
    givesSnacks: true,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! Grab a warm neighborhood snack (+2 hearts!) to keep your energy up!`,
      "We packed extra snacks in your bag too — press N to share with marchers or feed wild animals!",
    ],
  },
  civic: {
    priority: 5,
    maxCount: 2,
    sprite: "civic_hall",
    xp: 45,
    npcNames: ["Historian Hannah", "Town Greeter Sam"],
    rewardItem: "centre_token",
    healHearts: 0,
    givesSnacks: false,
    dialogue: (name, hero) => [
      `Welcome to ${name}, ${hero}! You're right in the heart of the neighborhood!`,
      "Take this shiny Neighborhood Explorer Token for your collection!",
    ],
  },
  custom: {
    priority: 100,
    maxCount: 50,
    sprite: "friend_house",
    xp: 65,
    npcNames: ["Friendly Neighbor"],
    rewardItem: "friendship_bracelet",
    healHearts: 2,
    givesSnacks: true,
    dialogue: (name, hero) => [
      `Hey ${hero}! Welcome to ${name}! So glad you navigated all the way here!`,
      "Here's a special neighborhood keepsake and snacks for your adventure!",
    ],
  },
};

function classifyOsmPoi(tags = {}) {
  const name = String(tags.name || tags["name:en"] || tags["name:he"] || "").trim();
  if (!name) return null;
  const amenity = String(tags.amenity || "").toLowerCase();
  const shop = String(tags.shop || "").toLowerCase();
  const leisure = String(tags.leisure || "").toLowerCase();
  const natural = String(tags.natural || "").toLowerCase();
  const building = String(tags.building || "").toLowerCase();
  const lower = `${tags.name || ""} ${tags["name:en"] || ""} ${tags["name:he"] || ""}`.toLowerCase();

  if (
    amenity === "library" ||
    building === "library" ||
    lower.includes("library") ||
    lower.includes("ספרייה") ||
    lower.includes("ספריה")
  ) {
    return "library";
  }
  if (
    amenity === "fire_station" ||
    building === "fire_station" ||
    lower.includes("fire station") ||
    lower.includes("כיבוי אש")
  ) {
    return "fire_station";
  }
  if (
    amenity === "ice_cream" ||
    shop === "bakery" ||
    shop === "pastry" ||
    shop === "confectionery" ||
    shop === "chocolate" ||
    shop === "coffee" ||
    amenity === "cafe" ||
    lower.includes("ice cream") ||
    lower.includes("gelato") ||
    lower.includes("glida") ||
    lower.includes("bakery") ||
    lower.includes("burekas") ||
    lower.includes("bagel") ||
    lower.includes("donut") ||
    lower.includes("doughnut") ||
    lower.includes("גלידה") ||
    lower.includes("מאפייה") ||
    lower.includes("מאפיה") ||
    lower.includes("בורקס") ||
    lower.includes("קפה")
  ) {
    return "ice_cream_bakery";
  }
  if (
    shop === "books" ||
    lower.includes("bookstore") ||
    lower.includes("bookshop") ||
    lower.includes("ספרים")
  ) {
    return "bookstore";
  }
  if (
    leisure === "park" ||
    leisure === "playground" ||
    leisure === "nature_reserve" ||
    leisure === "garden" ||
    (leisure === "pitch" && (lower.includes("field") || lower.includes("park") || lower.includes("גן")))
  ) {
    return "park";
  }
  if (
    amenity === "school" ||
    amenity === "college" ||
    amenity === "university" ||
    building === "school" ||
    lower.includes("yeshiva") ||
    lower.includes("בית ספר") ||
    lower.includes("ישיבה")
  ) {
    return "school";
  }
  if (
    amenity === "place_of_worship" ||
    building === "church" ||
    building === "cathedral" ||
    building === "chapel" ||
    building === "synagogue" ||
    building === "mosque" ||
    building === "temple" ||
    building === "shrine" ||
    building === "gurdwara" ||
    building === "pagoda" ||
    lower.includes("synagogue") ||
    lower.includes("beit knesset") ||
    lower.includes("בית כנסת") ||
    lower.includes("בית הכנסת") ||
    lower.includes("mosque") ||
    lower.includes("masjid") ||
    lower.includes("מסגד") ||
    lower.includes("مسجد") ||
    lower.includes("cathedral") ||
    lower.includes("kirke") ||
    lower.includes("église") ||
    lower.includes("kirche") ||
    lower.includes("mandir") ||
    lower.includes("gurdwara") ||
    lower.includes("神社") ||
    lower.includes("寺")
  ) {
    return "house_of_worship";
  }
  if (natural === "water" || natural === "beach" || lower.includes("חוף")) {
    return "water";
  }
  if (
    amenity === "restaurant" ||
    amenity === "fast_food" ||
    shop === "supermarket" ||
    shop === "convenience" ||
    shop === "greengrocer" ||
    shop === "deli" ||
    lower.includes("falafel") ||
    lower.includes("shawarma") ||
    lower.includes("hummus") ||
    lower.includes("makolet") ||
    lower.includes("shuk") ||
    lower.includes("פלאפל") ||
    lower.includes("שווארמה") ||
    lower.includes("חומוס") ||
    lower.includes("מכולת") ||
    lower.includes("שוק")
  ) {
    return "food_shop";
  }
  if (
    amenity === "townhall" ||
    amenity === "community_centre" ||
    amenity === "museum" ||
    amenity === "arts_centre" ||
    amenity === "post_office" ||
    lower.includes("museum") ||
    lower.includes("מוזיאון") ||
    lower.includes("מתנ״ס")
  ) {
    return "civic";
  }
  return null;
}

function getElementLatLon(el, nodeMap) {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  if (Array.isArray(el.geometry) && el.geometry.length > 0) {
    let latSum = 0;
    let lonSum = 0;
    let count = 0;
    for (const pt of el.geometry) {
      if (typeof pt.lat === "number" && typeof pt.lon === "number") {
        latSum += pt.lat;
        lonSum += pt.lon;
        count++;
      }
    }
    if (count > 0) return { lat: latSum / count, lon: lonSum / count };
  }
  if (Array.isArray(el.nodes) && el.nodes.length > 0 && nodeMap) {
    let latSum = 0;
    let lonSum = 0;
    let count = 0;
    for (const nid of el.nodes) {
      const n = nodeMap.get(nid);
      if (n && typeof n.lat === "number" && typeof n.lon === "number") {
        latSum += n.lat;
        lonSum += n.lon;
        count++;
      }
    }
    if (count > 0) return { lat: latSum / count, lon: lonSum / count };
  }
  return null;
}

function formatOsmAddress(tags = {}) {
  const num = tags["addr:housenumber"] ? String(tags["addr:housenumber"]).trim() : "";
  const st = tags["addr:street"] ? String(tags["addr:street"]).trim() : "";
  if (num && st) return `${num} ${st}`;
  return st || num || "";
}

/**
 * Find a walkable scenic spot inside a park/woods for the Hidden Little Free Library chest.
 */
function findRiddleChestSpot(worldMap, landmarks = []) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  const spawn = worldMap.origin?.spawnTile || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const avoid = landmarks.map((l) => ({ x: l.tileX, y: l.tileY, minDist: 4 }));

  // Prefer a discovered park landmark if one exists
  const parkLm = landmarks.find((l) => l.category === "park" || l.sprite === "park_field");
  if (parkLm) {
    const pos = snapToWalkableTile(worldMap, parkLm.tileX + 3, parkLm.tileY + 2, 12, avoid);
    return { tile: pos, nearLabel: parkLm.name };
  }

  // Otherwise scan for a PARK (11) or TALL_GRASS (7) tile at a fun walking distance from Home Base
  let best = null;
  let bestScore = -Infinity;
  for (let ty = 10; ty < height - 10; ty += 4) {
    for (let tx = 10; tx < width - 10; tx += 4) {
      const idx = ty * width + tx;
      if (collision[idx] !== 0) continue;
      const t = base[idx];
      if (t !== 11 && t !== 7) continue;
      const dist = Math.hypot(tx - spawn.x, ty - spawn.y);
      if (dist < 14 || dist > Math.min(width, height) * 0.42) continue;
      const score = (t === 11 ? 20 : 12) - Math.abs(dist - 36) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = { x: tx, y: ty };
      }
    }
  }
  if (best) {
    const snapped = snapToWalkableTile(worldMap, best.x, best.y, 8, avoid);
    return { tile: snapped, nearLabel: "the neighborhood park trees" };
  }

  // Fallback: walkable spot ~18 tiles northeast of Home Base
  const fallback = snapToWalkableTile(
    worldMap,
    Math.min(width - 10, spawn.x + 18),
    Math.max(10, spawn.y - 16),
    14,
    avoid
  );
  return { tile: fallback, nearLabel: "the quiet oak trees near Home Base" };
}

/**
 * Generate a complete, playable `landmarks[]` and `quests[]` package for ANY neighborhood!
 */
export function generateLandmarksAndQuests({
  elements = [],
  worldMap,
  customPlaces = [],
  customQuests = [],
  meta = null,
  maxAutoLandmarks = 16,
} = {}) {
  const { width, height } = worldMap.dimensions;
  const scaleMetersPerTile = worldMap.scaleMetersPerTile || 6;
  const mapCenter = worldMap.mapCenter || worldMap.origin || { lat: 0, lon: 0 };
  const spawn = worldMap.origin?.spawnTile || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const resolvedMeta = meta || getNeighborhoodMeta(worldMap);
  const heroName = resolvedMeta.heroName || "Explorer";
  const cityShort = resolvedMeta.cityShort || "Neighborhood";
  const homeAddress = resolvedMeta.homeAddress || "Home Base";
  const labelMode = resolvedMeta.labelMode || "bilingual";
  const countryCode = resolvedMeta.countryCode || "";
  const isIsrael = isIsraelLocation({
    lat: worldMap.origin?.lat,
    lon: worldMap.origin?.lon,
    countryCode,
    townName: resolvedMeta.townName || cityShort,
  });
  const localFlair = resolvedMeta.localFlair || getLocalFlairProfile({
    origin: worldMap.origin,
    meta: resolvedMeta,
  });

  const margin = Math.max(6, Math.min(12, Math.floor(Math.min(width, height) * 0.04)));
  const minSpacing = Math.max(8, Math.min(14, Math.floor(Math.min(width, height) * 0.045)));
  const landmarks = [];
  const usedIds = new Set();
  const usedNames = new Set();

  const makeUniqueId = (baseStr) => {
    const clean = slugifyNeighborhood(baseStr).slice(0, 36) || "landmark";
    if (!usedIds.has(clean)) {
      usedIds.add(clean);
      return clean;
    }
    let n = 2;
    while (usedIds.has(`${clean}_${n}`)) n++;
    const next = `${clean}_${n}`;
    usedIds.add(next);
    return next;
  };

  // 1. Home Base landmark (always first!)
  usedIds.add("home_base");
  const homeLandmark = {
    id: "home_base",
    name: `${heroName === "Explorer" ? "Player" : heroName}'s House (${homeAddress})`,
    address: homeAddress,
    lat: worldMap.origin?.lat,
    lon: worldMap.origin?.lon,
    tileX: spawn.x,
    tileY: spawn.y,
    sprite: "house_yellow",
    discoveryXP: 0,
    npcName: "Mom",
    healHearts: 5,
    givesSnacks: true,
    dialogue: [
      `Welcome back, ${heroName}! Here's a hug and fresh snacks for your pocket — all your hearts are restored!`,
      `Step through the front door into ${homeAddress} to check the kitchen snack jar, outfit closet, bookshelf secrets, and D&D basement!`,
    ],
    rewardItem: "folded_map",
  };
  landmarks.push(homeLandmark);

  const avoidPoints = [{ x: spawn.x, y: spawn.y, minDist: 4 }];

  // 2. Merge user-defined custom places (highest priority — never dropped!)
  const customLandmarkIds = [];
  for (let i = 0; i < (customPlaces || []).length; i++) {
    const cp = customPlaces[i];
    if (!cp || !cp.name) continue;

    let rawTx = typeof cp.tileX === "number" ? cp.tileX : null;
    let rawTy = typeof cp.tileY === "number" ? cp.tileY : null;
    if ((rawTx === null || rawTy === null) && typeof cp.lat === "number" && typeof cp.lon === "number") {
      const pt = projectLatLonToFloatTile(
        cp.lat,
        cp.lon,
        mapCenter.lat,
        mapCenter.lon,
        width,
        height,
        scaleMetersPerTile
      );
      rawTx = Math.round(pt.x);
      rawTy = Math.round(pt.y);
    }
    if (rawTx === null || rawTy === null) continue;

    // Clamp cleanly into playable bounds
    const clampedX = Math.max(margin, Math.min(width - margin - 1, rawTx));
    const clampedY = Math.max(margin, Math.min(height - margin - 1, rawTy));
    const snapped = snapToWalkableTile(worldMap, clampedX, clampedY, 12, avoidPoints);
    const catKey = cp.category && CATEGORY_TEMPLATES[cp.category] ? cp.category : "custom";
    const tpl = CATEGORY_TEMPLATES[catKey];
    const id = cp.id ? makeUniqueId(cp.id) : makeUniqueId(cp.name);
    const rewardId = cp.rewardItem || `${id}_keepsake`;

    const lm = {
      id,
      name: String(cp.name).trim(),
      address: cp.address ? String(cp.address).trim() : "",
      ...(typeof cp.lat === "number" ? { lat: cp.lat } : {}),
      ...(typeof cp.lon === "number" ? { lon: cp.lon } : {}),
      tileX: snapped.x,
      tileY: snapped.y,
      sprite: cp.sprite || tpl.sprite,
      ...(cp.npcStyle ? { npcStyle: cp.npcStyle } : {}),
      discoveryXP: typeof cp.discoveryXP === "number" ? cp.discoveryXP : tpl.xp,
      npcName: cp.npcName ? String(cp.npcName).trim() : tpl.npcNames[0],
      ...(cp.healHearts ?? tpl.healHearts ? { healHearts: cp.healHearts ?? tpl.healHearts } : {}),
      givesSnacks: cp.givesSnacks !== undefined ? Boolean(cp.givesSnacks) : tpl.givesSnacks,
      dialogue:
        Array.isArray(cp.dialogue) && cp.dialogue.length > 0
          ? cp.dialogue.map(String)
          : typeof cp.dialogue === "string" && cp.dialogue.trim()
            ? [cp.dialogue.trim()]
            : tpl.dialogue(String(cp.name).trim(), heroName),
      rewardItem: rewardId,
      ...(!cp.rewardItem
        ? {
            rewardItemMeta: cp.rewardItemMeta || {
              name: `${String(cp.name).trim()} Keepsake`,
              icon: "⭐",
              sprite: "item_badge",
              desc: `Special memory from ${String(cp.name).trim()}!`,
            },
          }
        : cp.rewardItemMeta
          ? { rewardItemMeta: cp.rewardItemMeta }
          : {}),
      ...(cp.bonusItem ? { bonusItem: cp.bonusItem } : {}),
      isCustom: true,
      category: catKey,
    };

    landmarks.push(lm);
    customLandmarkIds.push(lm.id);
    usedNames.add(lm.name.toLowerCase());
    avoidPoints.push({ x: snapped.x, y: snapped.y, minDist: 4 });
  }

  // 3. Collect real OpenStreetMap POIs + extracted graveyards
  const nodeMap = new Map();
  for (const el of elements || []) {
    if (el && el.type === "node") nodeMap.set(el.id, el);
  }

  const candidates = [];

  // 3a. Graveyards from worldMap.graveyards[]
  for (const g of worldMap.graveyards || []) {
    if (!g) continue;
    const gx = g.entrance?.x ?? g.seeds?.[0]?.x;
    const gy = g.entrance?.y ?? g.seeds?.[0]?.y;
    if (typeof gx !== "number" || typeof gy !== "number") continue;
    candidates.push({
      category: "graveyard",
      name: g.name || "Historic Burying Ground",
      address: "",
      tx: gx,
      ty: gy,
      priority: CATEGORY_TEMPLATES.graveyard.priority,
      distFromHome: Math.hypot(gx - spawn.x, gy - spawn.y),
    });
  }

  // 3b. Named OSM POI nodes & ways
  for (const el of elements || []) {
    if (!el || !el.tags) continue;
    const cat = classifyOsmPoi(el.tags);
    if (!cat) continue;
    const pos = getElementLatLon(el, nodeMap);
    if (!pos) continue;
    const pt = projectLatLonToFloatTile(
      pos.lat,
      pos.lon,
      mapCenter.lat,
      mapCenter.lon,
      width,
      height,
      scaleMetersPerTile
    );
    const tx = Math.round(pt.x);
    const ty = Math.round(pt.y);
    if (tx < margin || ty < margin || tx >= width - margin || ty >= height - margin) continue;
    const distFromHome = Math.hypot(tx - spawn.x, ty - spawn.y);
    if (distFromHome < 8) continue;

    const name = formatBilingualName(el.tags, { labelMode });
    if (!name) continue;
    const tpl = CATEGORY_TEMPLATES[cat];
    const religion = cat === "house_of_worship" ? detectFaithTradition(el.tags) : null;
    candidates.push({
      category: cat,
      ...(religion ? { religion } : {}),
      name,
      address: formatInternationalAddress(el.tags, { labelMode, countryCode }) || formatOsmAddress(el.tags),
      lat: pos.lat,
      lon: pos.lon,
      tx,
      ty,
      priority: tpl.priority,
      distFromHome,
    });
  }

  // Sort by priority desc, preferring well-paced walkable distances (15..140 tiles),
  // AND ensure houses of worship from DISTINCT local religions get first pick before duplicates!
  const seenCandidateReligions = new Set();
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const scoreDist = (d) => Math.abs(d - 55);
    return scoreDist(a.distFromHome) - scoreDist(b.distFromHome);
  });
  for (const cand of candidates) {
    if (cand.category === "house_of_worship" && cand.religion) {
      if (!seenCandidateReligions.has(cand.religion)) {
        seenCandidateReligions.add(cand.religion);
        cand.priority += 1.5; // First representative of each local faith tradition gets top interfaith priority!
      }
    }
  }
  candidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const scoreDist = (d) => Math.abs(d - 55);
    return scoreDist(a.distFromHome) - scoreDist(b.distFromHome);
  });

  const catCounts = {};
  const religionCounts = {};
  let autoAdded = 0;
  for (const cand of candidates) {
    if (autoAdded >= maxAutoLandmarks) break;
    const normName = cand.name.toLowerCase();
    if (usedNames.has(normName)) continue;

    const tpl = CATEGORY_TEMPLATES[cand.category];
    if (!tpl) continue;
    const countSoFar = catCounts[cand.category] || 0;
    if (countSoFar >= tpl.maxCount) continue;

    // Keep landmarks nicely spaced across the map
    const tooClose = landmarks.some(
      (existing) => Math.hypot(existing.tileX - cand.tx, existing.tileY - cand.ty) < minSpacing
    );
    if (tooClose) continue;

    const snapped = snapToWalkableTile(worldMap, cand.tx, cand.ty, 10, avoidPoints);
    const id = makeUniqueId(cand.name);
    let npcName = tpl.npcNames[countSoFar % tpl.npcNames.length];
    let dialogue = tpl.dialogue(cand.name, heroName);
    let rewardItem = tpl.rewardItem;
    let healHearts = tpl.healHearts;
    let sprite = tpl.sprite;

    if (cand.category === "house_of_worship") {
      const trad = FAITH_TRADITIONS[cand.religion] || FAITH_TRADITIONS.interfaith;
      const rCount = religionCounts[trad.id] || 0;
      religionCounts[trad.id] = rCount + 1;
      npcName = trad.npcNames[rCount % trad.npcNames.length];
      dialogue = trad.dialogue(cand.name, heroName);
      rewardItem = trad.rewardItem;
      healHearts = trad.healHearts;
      sprite = trad.sprite;
    } else if (isIsrael && (cand.category === "food_shop" || cand.category === "ice_cream_bakery")) {
      if (localFlair?.localNpcNames?.length) {
        npcName = localFlair.localNpcNames[countSoFar % localFlair.localNpcNames.length];
      }
      dialogue = [
        `Shalom ${heroName}! Welcome to ${cand.name}! Fresh warm burekas, pita & treats right off the counter (+${tpl.healHearts || 2} hearts)!`,
        "We packed extra snacks in your bag too — press N to share with neighbors or feed friendly street cats!",
      ];
    } else if (
      localFlair &&
      localFlair.id !== "neighborhood_classic" &&
      (cand.category === "food_shop" || cand.category === "ice_cream_bakery")
    ) {
      if (localFlair.localNpcNames?.length) {
        npcName = localFlair.localNpcNames[countSoFar % localFlair.localNpcNames.length];
      }
      dialogue = [
        `${localFlair.greeting}, ${heroName}! Welcome to ${cand.name}! Enjoy our famous ${localFlair.signatureFood} with ${localFlair.signatureDrink} (+${tpl.healHearts || 2} hearts)!`,
        "We tucked extra local snacks in your pocket too — press N to share with hungry sidewalk marchers or critters!",
      ];
    } else if (localFlair && localFlair.id !== "neighborhood_classic" && cand.category === "civic") {
      if (localFlair.localNpcNames?.length) {
        npcName = localFlair.localNpcNames[(countSoFar + 2) % localFlair.localNpcNames.length];
      }
      dialogue = [
        `${localFlair.greeting}, ${heroName}! Welcome to ${cand.name} right in the heart of ${cityShort}!`,
        `Take this shiny Explorer Token — and don't forget to grab some ${localFlair.signatureFood} while exploring!`,
      ];
    }
    const lm = {
      id,
      name: cand.name,
      ...(cand.address ? { address: cand.address } : {}),
      ...(typeof cand.lat === "number" ? { lat: cand.lat } : {}),
      ...(typeof cand.lon === "number" ? { lon: cand.lon } : {}),
      tileX: snapped.x,
      tileY: snapped.y,
      sprite,
      ...(tpl.npcStyle ? { npcStyle: tpl.npcStyle } : {}),
      discoveryXP: tpl.xp,
      npcName,
      ...(healHearts ? { healHearts } : {}),
      ...(tpl.givesSnacks ? { givesSnacks: true } : {}),
      dialogue,
      rewardItem,
      ...(tpl.bonusItem ? { bonusItem: tpl.bonusItem } : {}),
      ...(cand.religion ? { religion: cand.religion } : {}),
      category: cand.category,
    };

    landmarks.push(lm);
    usedNames.add(normName);
    catCounts[cand.category] = countSoFar + 1;
    avoidPoints.push({ x: snapped.x, y: snapped.y, minDist: 4 });
    autoAdded++;
  }

  // 3c. Ensure sparse rural/residential areas still have at least 3 fun exploration points
  if (landmarks.length < 4) {
    const offsets = [
      { dx: 26, dy: -22, name: `${cityShort} Corner Crossing`, cat: "civic", npc: "Crossing Guard Pat", item: "safety_whistle" },
      { dx: -28, dy: -18, name: `${cityShort} Oak Grove`, cat: "park", npc: "Ranger Rick", item: "trail_compass" },
      { dx: 22, dy: 24, name: `${cityShort} Snack Stand`, cat: "ice_cream_bakery", npc: "Scooper Maya", item: "double_scoop_cone", heal: 3, snacks: true },
    ];
    for (const off of offsets) {
      if (landmarks.length >= 4) break;
      const tx = Math.max(margin, Math.min(width - margin - 1, spawn.x + off.dx));
      const ty = Math.max(margin, Math.min(height - margin - 1, spawn.y + off.dy));
      const snapped = snapToWalkableTile(worldMap, tx, ty, 14, avoidPoints);
      const id = makeUniqueId(off.name);
      landmarks.push({
        id,
        name: off.name,
        tileX: snapped.x,
        tileY: snapped.y,
        sprite: CATEGORY_TEMPLATES[off.cat].sprite,
        discoveryXP: 45,
        npcName: off.npc,
        ...(off.heal ? { healHearts: off.heal } : {}),
        ...(off.snacks ? { givesSnacks: true } : {}),
        dialogue: CATEGORY_TEMPLATES[off.cat].dialogue(off.name, heroName),
        rewardItem: off.item,
        category: off.cat,
      });
      avoidPoints.push({ x: snapped.x, y: snapped.y, minDist: 4 });
    }
  }

  // 4. Guarantee Explorer's Graveyard Sword & Pocket Siddur are earnable in EVERY generated town!
  const nonHomeLandmarks = landmarks.filter((l) => l.id !== "home_base");
  const hasSwordGiver = landmarks.some(
    (l) => l.rewardItem === "graveyard_sword" || l.bonusItem === "graveyard_sword"
  );
  if (!hasSwordGiver && nonHomeLandmarks.length > 0) {
    const swordHost =
      nonHomeLandmarks.find((l) => l.isCustom && !l.bonusItem) ||
      nonHomeLandmarks.find((l) => (l.category === "park" || l.category === "fire_station") && !l.bonusItem) ||
      nonHomeLandmarks.find((l) => l.category !== "house_of_worship" && !l.bonusItem) ||
      nonHomeLandmarks.find((l) => !l.bonusItem) ||
      nonHomeLandmarks[0];
    if (!swordHost.bonusItem) {
      swordHost.bonusItem = "graveyard_sword";
      swordHost.dialogue = [
        ...swordHost.dialogue,
        "Take this Explorer's Sword too — press J (or tap ⚔️ Sword) to fend off spooky graveyard foes and shoo wild critters!",
      ];
    }
  }

  const hasPrayerBookGiver = landmarks.some(
    (l) => l.rewardItem === "pocket_siddur" || l.bonusItem === "pocket_siddur"
  );
  if (!hasPrayerBookGiver && nonHomeLandmarks.length > 0) {
    const prayerHost =
      nonHomeLandmarks.find((l) => l.category === "house_of_worship" || l.category === "civic" || l.category === "library") ||
      nonHomeLandmarks[nonHomeLandmarks.length - 1];
    if (!prayerHost.bonusItem) {
      prayerHost.bonusItem = "pocket_siddur";
      prayerHost.dialogue = [
        ...prayerHost.dialogue,
        "Take this Pocket Prayer Book too — press K (or tap 📖 Prayer Book) to shine a peaceful light that calms spooky foes!",
      ];
    }
  }

  // 5. Build tailored multi-step starter quests (Custom Quests first, then auto-generated!)
  const quests = [];
  const usedQuestIds = new Set();

  // 5a. User-supplied custom quests
  for (let i = 0; i < (customQuests || []).length; i++) {
    const cq = customQuests[i];
    if (!cq || !cq.title) continue;
    let steps = [];
    if (Array.isArray(cq.steps) && cq.steps.length > 0) {
      steps = cq.steps.map((s, idx) => ({
        stepIndex: s.stepIndex ?? idx + 1,
        instruction: s.instruction || "Explore the target location!",
        ...(s.targetLandmarkId ? { targetLandmarkId: s.targetLandmarkId } : {}),
        ...(s.targetTile ? { targetTile: s.targetTile } : {}),
        completionTrigger: s.completionTrigger || (s.targetLandmarkId ? "npc_talk" : "tile_reach"),
      }));
    } else if (Array.isArray(cq.targetPlaceIds) && cq.targetPlaceIds.length > 0) {
      steps = cq.targetPlaceIds
        .map((pid) => landmarks.find((l) => l.id === pid || slugifyNeighborhood(l.name) === slugifyNeighborhood(pid)))
        .filter(Boolean)
        .map((lm, idx) => ({
          stepIndex: idx + 1,
          instruction: `Visit ${lm.npcName} at ${lm.name}!`,
          targetLandmarkId: lm.id,
          completionTrigger: "npc_talk",
        }));
    }
    if (steps.length === 0) continue;
    const qid = cq.id ? slugifyNeighborhood(cq.id) : `quest_custom_${i + 1}`;
    usedQuestIds.add(qid);
    quests.push({
      id: qid,
      tier: cq.tier ?? 1,
      title: String(cq.title).trim(),
      description: String(cq.description || `Complete ${cq.title} around ${cityShort}!`).trim(),
      steps,
      rewards: {
        xp: cq.rewards?.xp ?? 120,
        coins: cq.rewards?.coins ?? 40,
        item: cq.rewards?.item ?? "running_shoes",
        ...(cq.rewards?.outfit ? { outfit: cq.rewards.outfit } : i === 0 ? { outfit: "baseball" } : {}),
      },
    });
  }

  // 5b. Quest 0 (if user added >= 2 custom places and no custom quest yet): "Special Family Places"
  if (customLandmarkIds.length >= 2 && quests.length === 0) {
    const picks = customLandmarkIds.slice(0, 3).map((id) => landmarks.find((l) => l.id === id)).filter(Boolean);
    quests.push({
      id: "quest_00_family_places",
      tier: 1,
      title: `${heroName}'s Favorite Places`,
      description: `Use street signs and your compass to visit ${picks.map((p) => p.name).join(" and ")}!`,
      steps: picks.map((p, idx) => ({
        stepIndex: idx + 1,
        instruction: `Visit ${p.npcName} at ${p.name}${p.address ? ` (${p.address})` : ""}.`,
        targetLandmarkId: p.id,
        completionTrigger: "npc_talk",
      })),
      rewards: {
        xp: 120,
        coins: 40,
        item: "running_shoes",
        outfit: "baseball",
      },
    });
  }

  // 5c. Quest 1 — Neighborhood Scout (treat/shop + library/school/civic)
  const treatSpot =
    nonHomeLandmarks.find((l) => l.category === "ice_cream_bakery") ||
    nonHomeLandmarks.find((l) => l.category === "food_shop") ||
    nonHomeLandmarks[0];
  const scoutDest =
    nonHomeLandmarks.find((l) => l.category === "library" && l.id !== treatSpot?.id) ||
    nonHomeLandmarks.find((l) => l.category === "bookstore" && l.id !== treatSpot?.id) ||
    nonHomeLandmarks.find((l) => l.category === "school" && l.id !== treatSpot?.id) ||
    nonHomeLandmarks.find((l) => l.id !== treatSpot?.id);

  if (treatSpot && scoutDest) {
    const hasBaseball = quests.some((q) => q.rewards?.outfit === "baseball");
    quests.push({
      id: "quest_01_neighborhood_scout",
      tier: 1,
      title: `${cityShort} Explorer Scout`,
      description: `Travel safely from Home Base to ${treatSpot.name} and ${scoutDest.name}!`,
      steps: [
        {
          stepIndex: 1,
          instruction: `Visit ${treatSpot.npcName} at ${treatSpot.name}${treatSpot.address ? ` (${treatSpot.address})` : ""}.`,
          targetLandmarkId: treatSpot.id,
          completionTrigger: "npc_talk",
        },
        {
          stepIndex: 2,
          instruction: `Continue on to meet ${scoutDest.npcName} at ${scoutDest.name}${scoutDest.address ? ` (${scoutDest.address})` : ""}.`,
          targetLandmarkId: scoutDest.id,
          completionTrigger: "npc_talk",
        },
      ],
      rewards: {
        xp: 100,
        coins: 30,
        item: "running_shoes",
        outfit: hasBaseball ? "wetsuit" : "baseball",
      },
    });
  }

  // 5d. Quest 2 — The Mystery of the Wooden Chest (Hidden Little Free Library!)
  const chestSpot = findRiddleChestSpot(worldMap, landmarks);
  const hasWetsuit = quests.some((q) => q.rewards?.outfit === "wetsuit");
  quests.push({
    id: "quest_02_riddle_hunt",
    tier: 2,
    title: "The Mystery of the Wooden Chest",
    description: `Solve the riddle to find the hidden Little Free Library near ${chestSpot.nearLabel}.`,
    steps: [
      {
        stepIndex: 1,
        instruction: `Riddle: 'I have pages but no web, I stand near ${chestSpot.nearLabel}.'`,
        targetTile: { x: chestSpot.tile.x, y: chestSpot.tile.y },
        completionTrigger: "interact_object",
      },
    ],
    rewards: {
      xp: 150,
      coins: 35,
      item: "rare_book_stamp",
      outfit: hasWetsuit ? "link" : "wetsuit",
    },
  });

  // 5e. Quest 3 — Grand Neighborhood Delivery (bakery/cafe -> park/civic/fire station)
  const deliveryPickup =
    nonHomeLandmarks.find((l) => l.givesSnacks && l.id !== treatSpot?.id) || treatSpot;
  const deliveryDrop =
    nonHomeLandmarks.find((l) => l.category === "park" && l.id !== deliveryPickup?.id) ||
    nonHomeLandmarks.find((l) => l.category === "fire_station" && l.id !== deliveryPickup?.id) ||
    nonHomeLandmarks.find((l) => l.id !== deliveryPickup?.id && l.id !== scoutDest?.id);

  if (deliveryPickup && deliveryDrop) {
    const hasLink = quests.some((q) => q.rewards?.outfit === "link");
    quests.push({
      id: "quest_03_grand_errand",
      tier: 3,
      title: `The ${cityShort} Grand Delivery`,
      description: `Pick up warm treats from ${deliveryPickup.name} and deliver them safely to ${deliveryDrop.npcName} at ${deliveryDrop.name}!`,
      steps: [
        {
          stepIndex: 1,
          instruction: `Pick up a fresh snack bag from ${deliveryPickup.name}.`,
          targetLandmarkId: deliveryPickup.id,
          completionTrigger: "npc_talk",
        },
        {
          stepIndex: 2,
          instruction: `Deliver the treats safely across town to ${deliveryDrop.npcName} at ${deliveryDrop.name}!`,
          targetLandmarkId: deliveryDrop.id,
          completionTrigger: "npc_talk",
        },
      ],
      rewards: {
        xp: 260,
        coins: 80,
        item: "scooter",
        ...(!hasLink ? { outfit: "link" } : {}),
      },
    });
  }

  // 5f. Quest 4 — Spooky Grounds Tour (only if real OSM cemeteries exist in this neighborhood!)
  const graveyardLandmarks = nonHomeLandmarks.filter((l) => l.category === "graveyard");
  if (graveyardLandmarks.length > 0) {
    quests.push({
      id: "quest_04_spooky_tour",
      tier: 4,
      title: `${cityShort} Spooky Lantern Tour`,
      description: `Brave ${cityShort}'s real historic burying grounds and earn the glowing Haunted Lantern Cloak!`,
      steps: graveyardLandmarks.map((g, idx) => ({
        stepIndex: idx + 1,
        instruction: `Explore ${g.name} and greet ${g.npcName}!`,
        targetLandmarkId: g.id,
        completionTrigger: "npc_talk",
      })),
      rewards: {
        xp: 250,
        coins: 75,
        item: "ghost_lantern_cloak",
      },
    });
  }

  // 5g. Quest 5 — Houses of Faith & Friendship (celebrates ALL local religions discovered in the neighborhood!)
  const worshipLandmarks = nonHomeLandmarks.filter((l) => l.category === "house_of_worship");
  if (worshipLandmarks.length > 0) {
    // Prefer up to 4 stops covering distinct local faith traditions first!
    const picked = [];
    const pickedReligions = new Set();
    for (const w of worshipLandmarks) {
      const r = w.religion || "interfaith";
      if (!pickedReligions.has(r) && picked.length < 4) {
        picked.push(w);
        pickedReligions.add(r);
      }
    }
    for (const w of worshipLandmarks) {
      if (picked.length >= 3) break;
      if (!picked.includes(w)) picked.push(w);
    }
    const distinctTraditionLabels = [...pickedReligions]
      .map((r) => (FAITH_TRADITIONS[r] || FAITH_TRADITIONS.interfaith).label)
      .join(", ");
    quests.push({
      id: "quest_05_houses_of_faith",
      tier: 3,
      title: `${cityShort} Houses of Faith & Peace`,
      description:
        pickedReligions.size > 1
          ? `Visit neighbors across ${cityShort}'s local houses of worship (${distinctTraditionLabels}) to collect keepsakes and earn the Unity Peace Medallion!`
          : `Visit ${picked.map((p) => p.name).join(" and ")} to collect a Pocket Prayer Book and earn the Unity Peace Medallion!`,
      steps: picked.map((w, idx) => ({
        stepIndex: idx + 1,
        instruction: `Visit ${w.npcName} at ${w.name}${w.address ? ` (${w.address})` : ""} to collect a local keepsake & Pocket Prayer Book.`,
        targetLandmarkId: w.id,
        completionTrigger: "npc_talk",
      })),
      rewards: {
        xp: 220,
        coins: 65,
        item: "unity_peace_medallion",
      },
    });
  }

  return { landmarks, quests };
}
