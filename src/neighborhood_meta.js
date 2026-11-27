/**
 * Universal Neighborhood Metadata & Preset Resolution.
 *
 * Allows Neighborhood Explorer to run seamlessly for ANY real-world address
 * while preserving 100% backward compatibility with the original Newton Centre
 * (565 Boylston St) map, saves, and custom landmarks.
 */

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

/**
 * Create a clean, URL/storage-safe slug from a string.
 */
export function slugifyNeighborhood(str) {
  return (
    String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "custom_neighborhood"
  );
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
 * Parse a leading house number + street prefix from an address string like "565 Boylston St".
 */
export function parseAddressParts(address = "") {
  const cleaned = String(address || "").trim();
  if (!cleaned) return { houseNumber: "", streetToken: "" };
  const match = cleaned.match(/^(\d+[a-zA-Z-]*)\s+(.+)$/);
  if (!match) return { houseNumber: "", streetToken: cleaned.toLowerCase() };
  const houseNumber = match[1].trim();
  const streetMain = match[2]
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|place|pl|terrace|ter|circle|cir|boulevard|blvd|parkway|pkwy|way)\b\.?/g, "")
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
    saveStorageKey: isNewton
      ? LEGACY_SAVE_STORAGE_KEY
      : `neighborhood_explorer_save_${id}_v1`,
    houseColorsStorageKey: isNewton
      ? LEGACY_HOUSE_COLORS_STORAGE_KEY
      : `neighborhood_explorer_house_colors_${id}_v1`,
  };
}
