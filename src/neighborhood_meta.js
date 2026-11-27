/**
 * Universal Neighborhood Metadata & Preset Resolution.
 *
 * Allows Neighborhood Explorer to run seamlessly for ANY real-world address
 * while preserving 100% backward compatibility with the original Newton Centre
 * (565 Boylston St) map, saves, and custom landmarks.
 */

import {
  getBiomeConfig,
  getDrivingSideForCountry,
  detectSeasonForLocation,
  detectLocalQuirks,
} from "./biomes.js";
import { DEFAULT_HERO_PROFILE, resolveHeroProfile } from "./characters.js";

export const LEGACY_SAVE_STORAGE_KEY = "neighborhood_explorer_save_v1";
export const LEGACY_HOUSE_COLORS_STORAGE_KEY = "neighborhood_explorer_house_colors_v1";

/**
 * Detect whether a worldMap represents the built-in Newton Centre neighborhood.
 * Explicit `worldMap.meta.preset` always takes precedence.
 */
export function isNewtonCentreMap(worldMap) {
  if (!worldMap || typeof worldMap !== "object") return false;
  if (worldMap.meta && typeof worldMap.meta.preset === "string") {
    return worldMap.meta.preset === "newton";
  }
  const origin = worldMap.origin;
  if (!origin) return false;
  if (typeof origin.lat === "number" && typeof origin.lon === "number") {
    if (Math.abs(origin.lat - 42.3192) < 0.05 && Math.abs(origin.lon - -71.1927) < 0.05) {
      return true;
    }
  }
  const name = String(origin.name || "").toLowerCase();
  return name.includes("565 boylston") || name.includes("newton centre");
}

function shortHashStr(str = "") {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

/**
 * Create a clean, URL/storage-safe slug from a string (Unicode-safe with hash fallback
 * so Hebrew, Arabic, Japanese, or other non-Latin names never collide!).
 */
export function slugifyNeighborhood(str) {
  const raw = String(str || "").trim();
  const ascii = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (ascii && ascii.length >= 2) {
    return ascii;
  }
  if (!raw) return "custom_neighborhood";
  const prefix = ascii ? `${ascii}_` : "place_";
  return `${prefix}${shortHashStr(raw)}`;
}

/**
 * Extract a street address string from origin config (e.g. "Home Base (123 Main St)" -> "123 Main St").
 */
export function extractOriginAddress(origin = {}, meta = {}) {
  if (meta?.homeAddress && String(meta.homeAddress).trim()) {
    return String(meta.homeAddress).trim();
  }
  if (origin?.address && String(origin.address).trim()) {
    return String(origin.address).trim();
  }
  const rawName = String(origin?.name || "").trim();
  const parenMatch = rawName.match(/\(([^)]+)\)/);
  if (parenMatch && parenMatch[1].trim()) {
    return parenMatch[1].trim();
  }
  if (rawName && !/^home\s*base$/i.test(rawName)) {
    return rawName;
  }
  return "";
}

/**
 * Parse a house number + street token from either US ("565 Boylston St")
 * or Israeli/European ("Emek Refaim 24", "עמק רפאים 24", "Friedrichstraße 43") addresses.
 */
export function parseAddressParts(address = "") {
  const cleaned = String(address || "").trim().split(",")[0].trim();
  if (!cleaned) return { houseNumber: "", streetToken: "" };

  let houseNumber = "";
  let rawStreet = cleaned;

  const leading = cleaned.match(/^(\d+[a-zA-Z\u0590-\u05FF-]*)\s+(.+)$/);
  const trailing = !leading ? cleaned.match(/^(.+?)\s+(\d+[a-zA-Z\u0590-\u05FF-]*)$/) : null;

  if (leading) {
    houseNumber = leading[1].trim();
    rawStreet = leading[2].trim();
  } else if (trailing) {
    rawStreet = trailing[1].trim();
    houseNumber = trailing[2].trim();
  }

  const streetMain = rawStreet
    .split("·")[0]
    .trim()
    .toLowerCase()
    .replace(/^(?:רחוב|רח׳|רח'|שדרות|שד׳|דרך)\s+/u, "")
    .replace(
      /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|place|pl|terrace|ter|circle|cir|boulevard|blvd|parkway|pkwy|way)\b\.?/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  return { houseNumber, streetToken: streetMain };
}

/**
 * Resolve normalized neighborhood metadata for any worldMap.
 */
export function getNeighborhoodMeta(worldMap) {
  const isNewton = isNewtonCentreMap(worldMap);
  const rawMeta = (worldMap && typeof worldMap.meta === "object" && worldMap.meta) || {};
  const origin = worldMap?.origin || {};

  const homeAddress =
    extractOriginAddress(origin, rawMeta) || (isNewton ? "565 Boylston St" : "Home Base");
  const townName =
    (rawMeta.townName && String(rawMeta.townName).trim()) ||
    (isNewton ? "Newton Centre" : "Your Neighborhood");
  const cityShort =
    (rawMeta.cityShort && String(rawMeta.cityShort).trim()) ||
    (isNewton ? "Newton" : townName.split(",")[0].trim() || "Town");
  const heroName =
    (rawMeta.heroName && String(rawMeta.heroName).trim()) ||
    (isNewton ? "Liam" : "Explorer");
  const preset = rawMeta.preset || (isNewton ? "newton" : "generic");
  const countryCode = String(rawMeta.countryCode || (isNewton ? "us" : "")).toLowerCase();
  const drivingSide = rawMeta.drivingSide || getDrivingSideForCountry(countryCode);
  const labelMode = rawMeta.labelMode || "bilingual";
  const biomeConfig = getBiomeConfig(worldMap);
  const biome = rawMeta.biome || biomeConfig.id;
  const season =
    biomeConfig.season ||
    rawMeta.season ||
    detectSeasonForLocation({
      lat: origin?.lat,
      biomeId: biome,
      isNewton,
    });
  const quirks =
    Array.isArray(rawMeta.quirks) && rawMeta.quirks.length > 0
      ? rawMeta.quirks
      : Array.isArray(biomeConfig.quirks) && biomeConfig.quirks.length > 0
        ? biomeConfig.quirks
        : detectLocalQuirks({
            lat: origin?.lat,
            lon: origin?.lon,
            townName,
            address: homeAddress,
            countryCode,
          });
  const heroProfile = rawMeta.heroProfile
    ? resolveHeroProfile(rawMeta.heroProfile)
    : isNewton
      ? { ...DEFAULT_HERO_PROFILE }
      : resolveHeroProfile({ ...DEFAULT_HERO_PROFILE, headwear: "none", tzitzit: false });
  const id =
    (rawMeta.id && String(rawMeta.id).trim()) ||
    (isNewton ? "newton_centre" : slugifyNeighborhood(`${homeAddress}_${townName}`));

  return {
    id,
    preset,
    isNewton,
    townName,
    cityShort,
    homeAddress,
    heroName,
    heroProfile,
    countryCode,
    drivingSide,
    labelMode,
    biome,
    season,
    quirks,
    biomeConfig,
    saveStorageKey: isNewton
      ? LEGACY_SAVE_STORAGE_KEY
      : `neighborhood_explorer_save_${id}_v1`,
    houseColorsStorageKey: isNewton
      ? LEGACY_HOUSE_COLORS_STORAGE_KEY
      : `neighborhood_explorer_house_colors_${id}_v1`,
  };
}
