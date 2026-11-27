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
  tundra: {
    id: "tundra",
    label: "❄️ Arctic & Tundra Snow",
    shortLabel: "Arctic Tundra",
    paletteKey: "winter_snow",
    backgroundRgb: [164, 186, 206],
    sunWash: [
      { stop: 0, color: "rgba(214, 238, 255, 0.24)" },
      { stop: 0.5, color: "rgba(176, 212, 245, 0.08)" },
      { stop: 1, color: "rgba(156, 196, 240, 0)" },
    ],
    treeStyle: "tundra_spruce",
    sidewalkStyle: "concrete_slab",
    roadStyle: "europe",
    curbStyle: "granite",
    streetSignStyle: "israel_blue",
    houseStyle: "alpine_timber",
    shrubStyle: "boxwood",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    hasSnowGround: true,
    hasSnowRoofs: true,
    ambientParticleStyle: "snowflakes",
    parkSports: "winter_ice",
    wildlifeStyle: "tundra",
  },
  alpine: {
    id: "alpine",
    label: "🏔️ Alpine Mountain Village",
    shortLabel: "Alpine Village",
    paletteKey: "alpine_green",
    backgroundRgb: [52, 76, 68],
    sunWash: [
      { stop: 0, color: "rgba(235, 248, 255, 0.18)" },
      { stop: 0.5, color: "rgba(205, 235, 225, 0.06)" },
      { stop: 1, color: "rgba(180, 220, 215, 0)" },
    ],
    treeStyle: "alpine_conifer",
    sidewalkStyle: "cobblestone",
    roadStyle: "europe",
    curbStyle: "granite",
    streetSignStyle: "israel_blue",
    houseStyle: "alpine_timber",
    shrubStyle: "boxwood",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "summer_petals",
    parkSports: "europe_tennis_soccer",
    wildlifeStyle: "europe",
  },
  tropical_coastal: {
    id: "tropical_coastal",
    label: "🌴 Tropical & Island Coast",
    shortLabel: "Tropical Coast",
    paletteKey: "tropical_coastal",
    backgroundRgb: [48, 108, 114],
    sunWash: [
      { stop: 0, color: "rgba(255, 248, 198, 0.24)" },
      { stop: 0.5, color: "rgba(176, 245, 235, 0.08)" },
      { stop: 1, color: "rgba(130, 235, 235, 0)" },
    ],
    treeStyle: "coastal_palms",
    sidewalkStyle: "ackerman_limestone",
    roadStyle: "us",
    curbStyle: "granite",
    streetSignStyle: "us_green",
    houseStyle: "tropical_pastel",
    shrubStyle: "bougainvillea",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "jacaranda_petals",
    parkSports: "coastal_beach",
    wildlifeStyle: "israel",
  },
  european_historic: {
    id: "european_historic",
    label: "🏰 Historic European Quarter",
    shortLabel: "European Quarter",
    paletteKey: "european_historic",
    backgroundRgb: [72, 68, 66],
    sunWash: [
      { stop: 0, color: "rgba(255, 236, 186, 0.18)" },
      { stop: 0.5, color: "rgba(225, 215, 195, 0.06)" },
      { stop: 1, color: "rgba(200, 200, 200, 0)" },
    ],
    treeStyle: "temperate_summer",
    sidewalkStyle: "cobblestone",
    roadStyle: "europe",
    curbStyle: "granite",
    streetSignStyle: "israel_blue",
    houseStyle: "european_rowhouse",
    shrubStyle: "boxwood",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "summer_petals",
    parkSports: "europe_tennis_soccer",
    wildlifeStyle: "europe",
  },
  east_asian_urban: {
    id: "east_asian_urban",
    label: "⛩️ East Asian Town & Sakura",
    shortLabel: "East Asian Town",
    paletteKey: "spring_blossom",
    backgroundRgb: [78, 72, 86],
    sunWash: [
      { stop: 0, color: "rgba(255, 224, 236, 0.22)" },
      { stop: 0.5, color: "rgba(255, 205, 224, 0.07)" },
      { stop: 1, color: "rgba(255, 195, 220, 0)" },
    ],
    treeStyle: "spring_blossom",
    sidewalkStyle: "concrete_slab",
    roadStyle: "israel",
    curbStyle: "granite",
    streetSignStyle: "israel_blue",
    houseStyle: "east_asian_tiled",
    shrubStyle: "boxwood",
    hasFallenLeaves: false,
    hasLeafPiles: false,
    ambientParticleStyle: "spring_petals",
    parkSports: "soccer_primary",
    wildlifeStyle: "temperate",
  },
};

export const BIOME_LIST = Object.values(BIOME_PRESETS);

export const SEASONS = {
  spring: { id: "spring", label: "🌸 Spring Blossom" },
  summer: { id: "summer", label: "☀️ Summer Green" },
  fall: { id: "fall", label: "🍂 Autumn Foliage" },
  winter: { id: "winter", label: "❄️ Winter Season" },
};

export const SEASON_LIST = [
  { id: "auto", label: "✨ Auto-Detect from Date & Geography" },
  ...Object.values(SEASONS),
];

/**
 * Determine the geographic season for a latitude & calendar date (flips automatically in Southern Hemisphere!).
 * Legacy Newton Centre defaults to "fall" unless explicitly overridden.
 */
export function detectSeasonForLocation({
  lat = 42,
  date = new Date(),
  biomeId = "new_england_autumn",
  isNewton = false,
} = {}) {
  if (isNewton) return "fall";
  if (biomeId === "tundra") return "winter";
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const month = d.getMonth(); // 0=Jan .. 11=Dec
  const isSouth = typeof lat === "number" && Number.isFinite(lat) && lat < 0;
  const adjMonth = isSouth ? (month + 6) % 12 : month;
  if (adjMonth >= 2 && adjMonth <= 4) return "spring";
  if (adjMonth >= 5 && adjMonth <= 7) return "summer";
  if (adjMonth >= 8 && adjMonth <= 10) return "fall";
  return "winter";
}

/**
 * Detect local architectural & geographic quirks (e.g., Old City of Jerusalem walls & stone vaults,
 * Jerusalem Stone, Tel Aviv Bauhaus White City).
 */
export function detectLocalQuirks({
  lat = null,
  lon = null,
  townName = "",
  address = "",
  countryCode = "",
} = {}) {
  const quirks = [];
  const blob = `${townName || ""} ${address || ""}`.toLowerCase();
  const hasCoord = typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon);

  const inOldCityBox =
    hasCoord && lat >= 31.7725 && lat <= 31.7825 && lon >= 35.2245 && lon <= 35.2375;
  const mentionsOldCity =
    blob.includes("old city") ||
    blob.includes("העיר העתיקה") ||
    blob.includes("jaffa gate") ||
    blob.includes("שער יפו") ||
    blob.includes("western wall") ||
    blob.includes("kotel") ||
    blob.includes("כותל") ||
    blob.includes("jewish quarter") ||
    blob.includes("הרובע היהודי");

  if (inOldCityBox || mentionsOldCity) {
    quirks.push("jerusalem_old_city");
  }
  if (
    inOldCityBox ||
    mentionsOldCity ||
    blob.includes("jerusalem") ||
    blob.includes("ירושלים") ||
    (hasCoord && lat >= 31.68 && lat <= 31.86 && lon >= 35.12 && lon <= 35.28)
  ) {
    quirks.push("jerusalem_stone");
  }
  if (
    (hasCoord && lat >= 32.06 && lat <= 32.095 && lon >= 34.765 && lon <= 34.795) ||
    blob.includes("dizengoff") ||
    blob.includes("rothschild") ||
    blob.includes("white city")
  ) {
    quirks.push("tel_aviv_white_city");
  }
  if (countryCode === "jp" || blob.includes("kyoto") || blob.includes("tokyo")) {
    quirks.push("east_asian_lanterns");
  }
  return Array.from(new Set(quirks));
}

/**
 * Overlay a seasonal skin cleanly onto any regional biome config, honoring real geography:
 *  - Snowy Winter (New England / Temperate / Alpine / Europe / East Asia / Tundra) -> snow ground, snow roofs, snowflakes & ice rinks!
 *  - Mediterranean / Israel Winter -> lush emerald winter hills + blooming red kalaniyot anemones!
 *  - Spring -> fresh spring grass, cherry/almond blossoms & drifting pink petals!
 *  - Summer -> deep sunlit green canopies!
 *  - Fall -> warm golden-amber foliage & crunchy leaf piles in deciduous biomes!
 */
export function applySeasonToBiomeConfig(baseBiome, season = "fall", quirks = []) {
  const cfg = { ...(baseBiome || BIOME_PRESETS.new_england_autumn) };
  const s = SEASONS[season] ? season : "fall";
  cfg.season = s;
  if (Array.isArray(quirks) && quirks.length > 0) {
    cfg.quirks = [...quirks];
  } else if (!Array.isArray(cfg.quirks)) {
    cfg.quirks = [];
  }

  const id = cfg.id;
  const isSnowyWinterRegion =
    id === "new_england_autumn" ||
    id === "temperate_green" ||
    id === "alpine" ||
    id === "european_historic" ||
    id === "east_asian_urban" ||
    id === "tundra";
  const isIsraelHillRegion =
    id === "israel_jerusalem" || id === "israel_coastal" || id === "israel_galilee";

  if (s === "winter") {
    if (isSnowyWinterRegion) {
      cfg.paletteKey = "winter_snow";
      cfg.treeStyle = id === "tundra" ? "tundra_spruce" : "winter_snow";
      cfg.hasFallenLeaves = false;
      cfg.hasLeafPiles = false;
      cfg.hasSnowGround = true;
      cfg.hasSnowRoofs = true;
      cfg.ambientParticleStyle = "snowflakes";
      cfg.parkSports = "winter_ice";
      cfg.backgroundRgb = [164, 186, 206];
      cfg.sunWash = [
        { stop: 0, color: "rgba(218, 240, 255, 0.24)" },
        { stop: 0.5, color: "rgba(182, 214, 248, 0.08)" },
        { stop: 1, color: "rgba(160, 198, 242, 0)" },
      ];
    } else if (isIsraelHillRegion) {
      // Israel winter = lush green rainy-season hills & red kalaniyot wildflowers!
      cfg.paletteKey = "israel_winter_green";
      cfg.hasFallenLeaves = false;
      cfg.hasLeafPiles = false;
      cfg.hasSnowGround = false;
      cfg.hasSnowRoofs = false;
      cfg.ambientParticleStyle = "olive_blossoms";
      cfg.backgroundRgb = [56, 84, 54];
    }
  } else if (s === "spring") {
    cfg.hasFallenLeaves = false;
    cfg.hasLeafPiles = false;
    cfg.hasSnowGround = false;
    cfg.hasSnowRoofs = false;
    if (id === "new_england_autumn" || id === "temperate_green" || id === "european_historic" || id === "east_asian_urban") {
      cfg.paletteKey = "spring_blossom";
      cfg.treeStyle = "spring_blossom";
      cfg.ambientParticleStyle = "spring_petals";
      cfg.backgroundRgb = [68, 92, 66];
      cfg.sunWash = [
        { stop: 0, color: "rgba(255, 228, 236, 0.20)" },
        { stop: 0.5, color: "rgba(220, 248, 210, 0.07)" },
        { stop: 1, color: "rgba(200, 240, 200, 0)" },
      ];
    } else if (id === "israel_jerusalem" || id === "israel_galilee") {
      cfg.paletteKey = "israel_winter_green";
      cfg.ambientParticleStyle = "spring_petals";
    }
  } else if (s === "summer") {
    cfg.hasFallenLeaves = false;
    cfg.hasLeafPiles = false;
    cfg.hasSnowGround = false;
    cfg.hasSnowRoofs = false;
    if (id === "new_england_autumn") {
      cfg.paletteKey = "snes_classic";
      cfg.treeStyle = "temperate_summer";
      cfg.ambientParticleStyle = "summer_petals";
      cfg.backgroundRgb = [42, 68, 44];
    } else if (id === "tundra") {
      cfg.paletteKey = "alpine_green";
      cfg.treeStyle = "alpine_conifer";
      cfg.ambientParticleStyle = "summer_petals";
    }
  } else if (s === "fall") {
    if (id === "temperate_green" || id === "european_historic" || id === "alpine") {
      cfg.paletteKey = "autumn_golden";
      cfg.treeStyle = "autumn_new_england";
      cfg.hasFallenLeaves = true;
      cfg.hasLeafPiles = true;
      cfg.ambientParticleStyle = "autumn_leaves";
    }
  }

  return cfg;
}

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

  // 2. Arctic & Sub-Arctic Tundra (|lat| >= 62 or Iceland / Greenland / Svalbard)
  if (
    ["is", "gl", "sj"].includes(cc) ||
    (typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) >= 62.0)
  ) {
    return "tundra";
  }

  // 3. Alpine Mountain Villages (Switzerland, Austria, or iconic alpine towns)
  if (
    ["ch", "at", "li", "ad"].includes(cc) ||
    /zermatt|chamonix|aspen|innsbruck|banff|whistler|davos|st\.?\s*moritz/.test(lowerTown)
  ) {
    return "alpine";
  }

  // 4. East Asian Urban & Sakura (Japan, South Korea, Taiwan)
  if (["jp", "kr", "tw"].includes(cc)) {
    return "east_asian_urban";
  }

  // 5. US Southwest Desert (Arizona, New Mexico, Southern Nevada, West Texas)
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

  // 6. Middle East / North Africa arid desert regions
  if (["ae", "jo", "eg", "sa", "om", "qa", "bh", "kw", "ma"].includes(cc)) {
    return "israel_desert";
  }

  // 7. Tropical & Island Coasts (within tropics or island nations / Hawaii / Puerto Rico)
  if (
    ["pr", "cr", "th", "sg", "bs", "jm", "bb", "cu", "do", "ph", "id", "my", "fj", "mv"].includes(cc) ||
    /honolulu|maui|miami|key west|cancun|san juan|bali/.test(lowerTown) ||
    (typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 23.5)
  ) {
    return "tropical_coastal";
  }

  // 8. Mediterranean & Historic European Quarters
  if (["gr", "cy", "mt"].includes(cc)) {
    return "israel_galilee";
  }
  if (["gb", "ie", "fr", "de", "nl", "be", "lu", "it", "es", "pt", "cz", "pl", "hu", "dk", "se", "no", "fi", "hr", "si"].includes(cc)) {
    return "european_historic";
  }

  // 9. US Northeast keeps classic New England Autumn; other temperate regions default to lush Temperate Green
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
 * Resolve a complete biome configuration object (with active season & local quirks applied!)
 * from a biome ID string or worldMap object.
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
  const isLegacyNewtonCoord =
    typeof wm.origin?.lat === "number" &&
    typeof wm.origin?.lon === "number" &&
    Math.abs(wm.origin.lat - 42.3192) < 0.05 &&
    Math.abs(wm.origin.lon - -71.1927) < 0.05;
  const isNewton = wm.meta?.preset === "newton" || (isLegacyNewtonCoord && !explicit);

  let baseCfg;
  if (explicit && BIOME_PRESETS[explicit]) {
    baseCfg = BIOME_PRESETS[explicit];
  } else if (isNewton) {
    baseCfg = BIOME_PRESETS.new_england_autumn;
  } else if (wm.meta?.countryCode || wm.origin?.lat !== undefined) {
    const detected = detectBiomeForLocation({
      lat: wm.origin?.lat,
      lon: wm.origin?.lon,
      countryCode: wm.meta?.countryCode || "",
      townName: wm.meta?.townName || "",
      preset: wm.meta?.preset || "",
    });
    baseCfg = BIOME_PRESETS[detected] || BIOME_PRESETS.new_england_autumn;
  } else {
    baseCfg = BIOME_PRESETS.new_england_autumn;
  }

  const quirks =
    Array.isArray(wm.meta?.quirks) && wm.meta.quirks.length > 0
      ? wm.meta.quirks
      : detectLocalQuirks({
          lat: wm.origin?.lat,
          lon: wm.origin?.lon,
          townName: wm.meta?.townName || "",
          address: wm.meta?.homeAddress || wm.origin?.address || wm.origin?.name || "",
          countryCode: wm.meta?.countryCode || "",
        });

  const explicitSeason = wm.meta?.season;
  if (explicitSeason && SEASONS[explicitSeason]) {
    return applySeasonToBiomeConfig(baseCfg, explicitSeason, quirks);
  }
  if (quirks.length > 0) {
    return { ...baseCfg, quirks };
  }
  return baseCfg;
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
 *  - "bilingual": "English · Local" whenever both English & local tags exist and differ
 *  - "en": prefers name:en / int_name, falling back to local name
 *  - "local": prefers local name, falling back to name:en
 */
export function formatBilingualName(tags = {}, { labelMode = "bilingual" } = {}) {
  if (!tags || typeof tags !== "object") return "";
  const local = String(tags.name || "").trim();
  const en = String(tags["name:en"] || tags.int_name || "").trim();

  if (labelMode === "en") {
    return en || local;
  }
  if (labelMode === "local") {
    return local || en;
  }

  // Bilingual mode (default): pair English + Local whenever both exist and differ (works globally for any language!)
  if (en && local && en.toLowerCase() !== local.toLowerCase()) {
    return `${en} · ${local}`;
  }
  return en || local || "";
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
    street = `${stEn} · ${stLocal}`;
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
