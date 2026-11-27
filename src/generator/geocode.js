/**
 * Pure-JS Address Geocoding via OpenStreetMap Nominatim (Browser + Node ESM).
 * Zero Node-only dependencies so the exact same code runs in both the CLI
 * and the in-browser "Build My Neighborhood" Studio.
 */

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

const US_STATE_ABBR = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO",
  montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY",
  "district of columbia": "DC",
};

function abbreviateState(state = "") {
  const cleaned = String(state || "").trim();
  if (!cleaned) return "";
  if (/^[A-Z]{2}$/.test(cleaned)) return cleaned;
  return US_STATE_ABBR[cleaned.toLowerCase()] || cleaned;
}

/**
 * Normalize a raw Nominatim JSON result into clean neighborhood origin fields.
 */
export function parseNominatimResult(item, fallbackQuery = "") {
  if (!item || typeof item !== "object") return null;
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const addr = item.address || {};
  const houseNumber = addr.house_number ? String(addr.house_number).trim() : "";
  const road = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || "";
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.suburb ||
    addr.municipality ||
    addr.county ||
    "";
  const stateAbbr = abbreviateState(addr.state || "");

  let homeAddress = "";
  if (houseNumber && road) {
    homeAddress = `${houseNumber} ${road}`;
  } else if (road) {
    homeAddress = String(road);
  } else if (item.name && String(item.name).trim()) {
    homeAddress = String(item.name).trim();
  } else if (fallbackQuery) {
    homeAddress = String(fallbackQuery).split(",")[0].trim();
  } else if (item.display_name) {
    homeAddress = String(item.display_name).split(",")[0].trim();
  }

  const cityShort = String(city || homeAddress || "Your Town").trim();
  const townName =
    city && stateAbbr
      ? `${city}, ${stateAbbr}`
      : city || stateAbbr || String(item.display_name || "Your Neighborhood").split(",").slice(0, 2).join(",").trim();

  return {
    lat,
    lon,
    displayName: String(item.display_name || fallbackQuery || homeAddress),
    homeAddress: homeAddress || "Home Base",
    townName,
    cityShort,
    state: stateAbbr,
    postcode: addr.postcode ? String(addr.postcode) : "",
    osmType: item.osm_type || null,
    osmId: item.osm_id || null,
  };
}

/**
 * Geocode a street address or place name using OpenStreetMap Nominatim.
 * Works in both Node.js (18+) and browsers (CORS-enabled).
 */
export async function geocodeAddress(
  query,
  {
    fetchImpl = globalThis.fetch,
    countryCodes = "",
    limit = 3,
    timeoutMs = 15000,
    userAgent = "NeighborhoodExplorerRPG/1.0 (https://github.com/eh-ipmai/Neighborhood-explorer)",
  } = {}
) {
  const trimmed = String(query || "").trim();
  if (!trimmed) {
    throw new Error("Please enter an address or place name to geocode.");
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation available for geocoding.");
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: "jsonv2",
    addressdetails: "1",
    limit: String(limit),
  });
  if (countryCodes) {
    params.set("countrycodes", countryCodes);
  }

  const url = `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const isBrowser = typeof window !== "undefined";
    const headers = { Accept: "application/json" };
    // Browsers disallow setting custom User-Agent headers; Node allows & Nominatim appreciates it.
    if (!isBrowser && userAgent) {
      headers["User-Agent"] = userAgent;
    }

    const res = await fetchImpl(url, {
      headers,
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res.ok) {
      throw new Error(`Geocoding service returned HTTP ${res.status}`);
    }
    const results = await res.json();
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(`Could not find address "${trimmed}". Try adding a city and state (e.g., "123 Main St, Austin, TX").`);
    }
    const parsed = parseNominatimResult(results[0], trimmed);
    if (!parsed) {
      throw new Error(`Geocoding returned invalid coordinates for "${trimmed}".`);
    }
    return {
      ...parsed,
      alternatives: results
        .slice(1)
        .map((r) => parseNominatimResult(r, trimmed))
        .filter(Boolean),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
