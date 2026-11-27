/**
 * Regional Biome, Architecture & Bilingual Naming Engine (Pure JS — Browser + Node ESM).
 *
 * Powers authentic grass, trees, stone/brickwork, roofs, sidewalks, curbs, road markings,
 * park sports, and local street life across Israel (Jerusalem Stone, Tel Aviv Coastal,
 * Galilee Hills, Negev Desert) and global regions (New England Autumn, Temperate Green,
 * US Southwest Desert), while preserving 100% backward compatibility with Newton Centre.
 */

export const BIOME_PRESETS = {
  new_england_autumn: {
    id: "new_england_autumn",
    label: "🍂 New England Autumn",
    shortLabel: "New England Autumn",
    paletteKey: "autumn_golden",
    backgroundRgb: [62, 42, 36],
    sunWash: [
      { stop: 0, color: "rgba(255, 196, 98, 0.22)" },
      { stop: 0.45, color: "rgba(255, 148, 68, 0.08)" },
      { stop: 1, color: "rgba(255, 130, 56, 0)" },
    ],
    treeStyle: "autumn_new_england",
    sidewalkStyle: "cobblestone",
    roadStyle: "us",
    curbStyle: "granite",
    streetSignStyle: "us_green",
    houseStyle: "new_england",
    shrubStyle: "boxwood",
    hasFallenLeaves: true,
    hasLeafPiles: true,
    ambientParticleStyle: "autumn_leaves",
    parkSports: "us_baseball",
    wildlifeStyle: "new_england",
  },
  israel_jerusalem: {
    id: "israel_jerusalem",
    label: "🕍 Jerusalem Stone & Hills (Israel)",
    shortLabel: "Jerusalem Stone",
    paletteKey: "israel_jerusalem",
    backgroundRgb: [94, 82, 66],
    sunWash: [
      { stop: 0, color: "rgba(255, 232, 168, 0.24)" },
      { stop: 0.48, color: "rgba(255, 206, 122, 0.09)" },
      { stop: 1, color: "rgba(255, 190, 100, 0)" },
    ],
    treeStyle: "jerusalem_hills",
    sidewalkStyle: "ackerman_limestone",
    roadStyle: "israel",
    curbStyle: "israel",
    streetSignStyle: "jerusalem_stone",
    houseStyle: "jerusalem_stone",
    shrubStyle: "bougainvillea",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "olive_blossoms",
    parkSports: "soccer_primary",
    wildlifeStyle: "israel",
  },
  israel_coastal: {
    id: "israel_coastal",
    label: "🏖️ Tel Aviv & Coastal Plain (Israel)",
    shortLabel: "Tel Aviv Coastal",
    paletteKey: "israel_coastal",
    backgroundRgb: [72, 92, 98],
    sunWash: [
      { stop: 0, color: "rgba(255, 244, 196, 0.22)" },
      { stop: 0.5, color: "rgba(255, 224, 150, 0.07)" },
      { stop: 1, color: "rgba(180, 235, 255, 0)" },
    ],
    treeStyle: "coastal_palms",
    sidewalkStyle: "ackerman_gray",
    roadStyle: "israel",
    curbStyle: "israel",
    streetSignStyle: "israel_blue",
    houseStyle: "bauhaus_white",
    shrubStyle: "bougainvillea",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "jacaranda_petals",
    parkSports: "coastal_beach",
    wildlifeStyle: "israel",
  },
  israel_galilee: {
    id: "israel_galilee",
    label: "🌿 Galilee & Northern Hills (Israel)",
    shortLabel: "Galilee Hills",
    paletteKey: "israel_galilee",
    backgroundRgb: [56, 76, 52],
    sunWash: [
      { stop: 0, color: "rgba(255, 236, 174, 0.19)" },
      { stop: 0.5, color: "rgba(218, 236, 156, 0.06)" },
      { stop: 1, color: "rgba(180, 220, 140, 0)" },
    ],
    treeStyle: "galilee_olive",
    sidewalkStyle: "ackerman_limestone",
    roadStyle: "israel",
    curbStyle: "israel",
    streetSignStyle: "israel_blue",
    houseStyle: "galilee_stone",
    shrubStyle: "bougainvillea",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "olive_blossoms",
    parkSports: "soccer_primary",
    wildlifeStyle: "israel",
  },
  israel_desert: {
    id: "israel_desert",
    label: "🏜️ Negev & Desert South (Israel)",
    shortLabel: "Negev Desert",
    paletteKey: "israel_desert",
    backgroundRgb: [122, 94, 64],
    sunWash: [
      { stop: 0, color: "rgba(255, 222, 148, 0.26)" },
      { stop: 0.5, color: "rgba(255, 186, 102, 0.09)" },
      { stop: 1, color: "rgba(240, 168, 86, 0)" },
    ],
    treeStyle: "desert_oasis",
    sidewalkStyle: "ackerman_limestone",
    roadStyle: "israel",
    curbStyle: "israel",
    streetSignStyle: "israel_blue",
    houseStyle: "desert_stucco",
    shrubStyle: "desert_sage",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "desert_motes",
    parkSports: "soccer_primary",
    wildlifeStyle: "israel",
  },
  temperate_green: {
    id: "temperate_green",
    label: "🌳 Temperate Summer Green",
    shortLabel: "Temperate Green",
    paletteKey: "snes_classic",
    backgroundRgb: [42, 68, 44],
    sunWash: [
      { stop: 0, color: "rgba(255, 245, 198, 0.16)" },
      { stop: 0.5, color: "rgba(220, 245, 180, 0.05)" },
      { stop: 1, color: "rgba(200, 240, 180, 0)" },
    ],
    treeStyle: "temperate_summer",
    sidewalkStyle: "concrete_slab",
    roadStyle: "us",
    curbStyle: "granite",
    streetSignStyle: "us_green",
    houseStyle: "new_england",
    shrubStyle: "boxwood",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "summer_petals",
    parkSports: "us_baseball",
    wildlifeStyle: "temperate",
  },
  southwest_desert: {
    id: "southwest_desert",
    label: "🌵 Southwest Adobe & Desert",
    shortLabel: "Southwest Desert",
    paletteKey: "southwest_desert",
    backgroundRgb: [118, 76, 54],
    sunWash: [
      { stop: 0, color: "rgba(255, 206, 132, 0.24)" },
      { stop: 0.5, color: "rgba(245, 152, 86, 0.09)" },
      { stop: 1, color: "rgba(240, 128, 66, 0)" },
    ],
    treeStyle: "desert_oasis",
    sidewalkStyle: "concrete_slab",
    roadStyle: "us",
    curbStyle: "granite",
    streetSignStyle: "us_green",
    houseStyle: "desert_stucco",
    shrubStyle: "desert_sage",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "desert_motes",
    parkSports: "us_baseball",
    wildlifeStyle: "desert",
  },
};

export const BIOME_LIST = Object.values(BIOME_PRESETS);

export const LEFT_HAND_TRAFFIC_COUNTRIES = new Set([
  "ag", "au", "bb", "bd", "bn", "bs", "bt", "bw", "cy", "dm", "fj", "gb",
  "gd", "gy", "hk", "id", "ie", "in", "jm", "jp", "ke", "ki", "kn", "lc",
  "lk", "ls", "mo", "mt", "mu", "mv", "mw", "my", "mz", "na", "np", "nr",
  "nz", "pg", "pk", "sb", "sc", "sg", "sr", "sz", "th", "tl", "to", "tt",
  "tv", "tz", "ug", "vc", "ws", "za", "zm", "zw",
]);

export function getDrivingSideForCountry(countryCode = "") {
  const cc = String(countryCode || "").trim().toLowerCase();
  if (!cc) return "right";
  return LEFT_HAND_TRAFFIC_COUNTRIES.has(cc) ? "left" : "right";
}

export function isIsraelLocation({ lat = null, lon = null, countryCode = "", townName = "" } = {}) {
  const cc = String(countryCode || "").trim().toLowerCase();
  if (cc === "il" || cc === "ps") return true;
  const lower = String(townName || "").toLowerCase();
  if (
    lower.includes("israel") ||
    lower.includes("ישראל") ||
    lower.includes("jerusalem") ||
    lower.includes("ירושלים") ||
    lower.includes("tel aviv") ||
    lower.includes("תל אביב") ||
    lower.includes("haifa") ||
    lower.includes("חיפה") ||
    lower.includes("ra'anana") ||
    lower.includes("raanana") ||
    lower.includes("רעננה") ||
    lower.includes("modi'in") ||
    lower.includes("modiin") ||
    lower.includes("מודיעין") ||
    lower.includes("beit shemesh") ||
    lower.includes("בית שמש") ||
    lower.includes("beer sheva") ||
    lower.includes("be'er sheva") ||
    lower.includes("באר שבע")
  ) {
    return true;
  }
  if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
    return lat >= 29.45 && lat <= 33.4 && lon >= 34.2 && lon <= 35.9;
  }
  return false;
}

/**
 * Automatically detect the most authentic regional biome for any real-world coordinate & country.
 */
export function detectBiomeForLocation({
  lat = null,
  lon = null,
  countryCode = "",
  townName = "",
  preset = "",
} = {}) {
  if (preset === "newton") return "new_england_autumn";

  const cc = String(countryCode || "").trim().toLowerCase();
  const lowerTown = String(townName || "").toLowerCase();

  // 1. Israel — 4 iconic regional biomes!
  if (isIsraelLocation({ lat, lon, countryCode: cc, townName })) {
    if (
      lowerTown.includes("jerusalem") ||
      lowerTown.includes("ירושלים") ||
      lowerTown.includes("efrat") ||
      lowerTown.includes("אפרת") ||
      lowerTown.includes("beit shemesh") ||
      lowerTown.includes("בית שמש") ||
      lowerTown.includes("ma'ale adumim") ||
      lowerTown.includes("מעלה אדומים") ||
      lowerTown.includes("mevasseret") ||
      lowerTown.includes("מבשרת") ||
      lowerTown.includes("modi'in") ||
      lowerTown.includes("modiin") ||
      lowerTown.includes("מודיעין")
    ) {
      return "israel_jerusalem";
    }
    if (
      lowerTown.includes("eilat") ||
      lowerTown.includes("אילת") ||
      lowerTown.includes("beer sheva") ||
      lowerTown.includes("be'er sheva") ||
      lowerTown.includes("באר שבע") ||
      lowerTown.includes("mitzpe ramon") ||
      lowerTown.includes("arad") ||
      lowerTown.includes("dimona")
    ) {
      return "israel_desert";
    }
    if (
      lowerTown.includes("tzfat") ||
      lowerTown.includes("safed") ||
      lowerTown.includes("צפת") ||
      lowerTown.includes("tiberias") ||
      lowerTown.includes("טבריה") ||
      lowerTown.includes("nazareth") ||
      lowerTown.includes("נצרת") ||
      lowerTown.includes("karmiel") ||
      lowerTown.includes("rosh pina") ||
      lowerTown.includes("golan")
    ) {
      return "israel_galilee";
    }
    if (typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon)) {
      if (lat < 31.42) return "israel_desert";
      // Judean Hills & Jerusalem corridor
      if (lat >= 31.5 && lat <= 32.02 && lon >= 34.96) return "israel_jerusalem";
      // Galilee / Golan northern highlands
      if (lat >= 32.65 && lon >= 35.12) return "israel_galilee";
    }
    return "israel_coastal";
  }

  // 2. US Southwest Desert (Arizona, New Mexico, Southern Nevada, West Texas)
  if (
    cc === "us" &&
    typeof lat === "number" &&
    typeof lon === "number" &&
    lat >= 31.0 &&
    lat <= 37.2 &&
    lon >= -116.5 &&
    lon <= -103.0
  ) {
    return "southwest_desert";
  }

  // 3. Mediterranean Europe & Middle East arid/coastal regions
  if (["gr", "cy", "mt", "es", "it", "pt"].includes(cc)) {
    return "israel_galilee";
  }
  if (["ae", "jo", "eg", "sa", "om", "qa", "bh", "kw", "ma"].includes(cc)) {
    return "israel_desert";
  }

  // 4. US Northeast keeps classic New England Autumn; other temperate regions default to lush Temperate Green
  if (
    cc === "us" &&
    typeof lat === "number" &&
    typeof lon === "number" &&
    lat >= 40.2 &&
    lon >= -76.5
  ) {
    return "new_england_autumn";
  }
  if (cc && cc !== "us") {
    return "temperate_green";
  }

  return "new_england_autumn";
}

/**
 * Resolve a complete biome configuration object from a biome ID string or worldMap object.
 */
export function getBiomeConfig(biomeOrWorldMap = null) {
  if (typeof biomeOrWorldMap === "string") {
    return BIOME_PRESETS[biomeOrWorldMap] || BIOME_PRESETS.new_england_autumn;
  }
  const wm = biomeOrWorldMap;
  if (!wm || typeof wm !== "object") {
    return BIOME_PRESETS.new_england_autumn;
  }
  const explicit = wm.meta?.biome;
  if (explicit && BIOME_PRESETS[explicit]) {
    return BIOME_PRESETS[explicit];
  }
  // Legacy Newton Centre map without meta.biome stays 100% New England Autumn
  if (wm.meta?.preset === "newton") {
    return BIOME_PRESETS.new_england_autumn;
  }
  if (wm.meta?.countryCode || wm.origin?.lat !== undefined) {
    const isLegacyNewtonCoord =
      typeof wm.origin?.lat === "number" &&
      typeof wm.origin?.lon === "number" &&
      Math.abs(wm.origin.lat - 42.3192) < 0.05 &&
      Math.abs(wm.origin.lon - -71.1927) < 0.05;
    if (isLegacyNewtonCoord && !explicit) {
      return BIOME_PRESETS.new_england_autumn;
    }
    const detected = detectBiomeForLocation({
      lat: wm.origin?.lat,
      lon: wm.origin?.lon,
      countryCode: wm.meta?.countryCode || "",
      townName: wm.meta?.townName || "",
      preset: wm.meta?.preset || "",
    });
    return BIOME_PRESETS[detected] || BIOME_PRESETS.new_england_autumn;
  }
  return BIOME_PRESETS.new_england_autumn;
}

/**
 * Check if a string contains non-Latin script characters (Hebrew, Arabic, CJK, Cyrillic, Greek, etc.).
 */
export function hasNonLatinScript(str = "") {
  return /[\u0590-\u05FF\u0600-\u06FF\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(
    String(str || "")
  );
}

/**
 * Check if a string contains Hebrew characters.
 */
export function hasHebrewScript(str = "") {
  return /[\u0590-\u05FF]/.test(String(str || ""));
}

/**
 * Format an OpenStreetMap element's name cleanly according to labelMode:
 *  - "bilingual": "Emek Refaim St · עמק רפאים" when both English & local non-Latin tags exist
 *  - "en": prefers name:en / int_name, falling back to local name
 *  - "local": prefers local name, falling back to name:en
 */
export function formatBilingualName(tags = {}, { labelMode = "bilingual" } = {}) {
  if (!tags || typeof tags !== "object") return "";
  const local = String(tags.name || "").trim();
  const en = String(tags["name:en"] || tags.int_name || "").trim();
  const he = String(tags["name:he"] || "").trim();

  if (labelMode === "en") {
    return en || local || he;
  }
  if (labelMode === "local") {
    return local || he || en;
  }

  // Bilingual mode (default): pair English + Local when they differ (especially Latin + Hebrew/non-Latin!)
  const primaryLocal = he || local;
  if (en && primaryLocal && en.toLowerCase() !== primaryLocal.toLowerCase()) {
    // Only combine when one is non-Latin (like Hebrew/Arabic/Japanese) or distinctly different
    if (hasNonLatinScript(primaryLocal) || hasNonLatinScript(en)) {
      return `${en} · ${primaryLocal}`;
    }
    return en;
  }
  return en || primaryLocal || "";
}

/**
 * Format a street address cleanly for bilingual / international OSM tags.
 */
export function formatInternationalAddress(tags = {}, { labelMode = "bilingual", countryCode = "" } = {}) {
  const num = tags["addr:housenumber"] ? String(tags["addr:housenumber"]).trim() : "";
  const stLocal = tags["addr:street"] ? String(tags["addr:street"]).trim() : "";
  const stEn = tags["addr:street:en"] ? String(tags["addr:street:en"]).trim() : "";

  let street = stLocal;
  if (labelMode === "en") {
    street = stEn || stLocal;
  } else if (labelMode === "bilingual" && stEn && stLocal && stEn.toLowerCase() !== stLocal.toLowerCase()) {
    street = hasNonLatinScript(stLocal) ? `${stEn} · ${stLocal}` : stEn;
  }

  if (!num) return street;
  if (!street) return num;

  // Israel & Continental Europe conventionally place house number after street name (e.g., "Emek Refaim 24")
  const cc = String(countryCode || "").toLowerCase();
  const streetFirst =
    cc === "il" ||
    hasHebrewScript(street) ||
    ["de", "at", "ch", "nl", "pl", "es", "it", "cz", "se", "no", "dk", "fi"].includes(cc);

  return streetFirst ? `${street} ${num}` : `${num} ${street}`;
}
