/**
 * Pure-JS OpenStreetMap Data Fetcher (Browser + Node ESM).
 *
 * Fetches real-world roads, buildings, parks, water, trails, crosswalks,
 * cemeteries, and local POIs for ANY bounding box on Earth with live
 * progress callbacks, polite throttling, and automatic OSM API <-> Overpass fallback.
 */

export const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build an Overpass QL query covering all map terrain + building + POI features
 * needed to generate a rich playable neighborhood RPG.
 */
export function buildOverpassQuery(bbox, timeoutSec = 45) {
  const bboxStr = `${bbox.south.toFixed(6)},${bbox.west.toFixed(6)},${bbox.north.toFixed(6)},${bbox.east.toFixed(6)}`;
  return `
[out:json][timeout:${timeoutSec}];
(
  way["natural"="water"](${bboxStr});
  way["natural"~"sand|beach"](${bboxStr});
  way["waterway"~"riverbank|river|stream|canal"](${bboxStr});
  way["leisure"~"park|pitch|playground|garden|nature_reserve|sandbox"](${bboxStr});
  way["landuse"~"grass|forest|meadow|recreation_ground|village_green|cemetery|grave_yard"](${bboxStr});
  way["amenity"="grave_yard"](${bboxStr});
  way["natural"~"wood|grassland"](${bboxStr});
  way["landuse"="orchard"](${bboxStr});
  node["natural"="tree"](${bboxStr});
  way["natural"="tree_row"](${bboxStr});
  way["barrier"="city_wall"](${bboxStr});
  way["historic"="citywalls"](${bboxStr});
  way["surface"~"sand|dirt|earth|gravel|unpaved"](${bboxStr});
  way["highway"](${bboxStr});
  way["amenity"="parking"](${bboxStr});
  node["highway"="crossing"](${bboxStr});
  way["building"](${bboxStr});
  relation["type"="multipolygon"]["natural"="water"](${bboxStr});
  relation["type"="multipolygon"]["leisure"~"park|garden|nature_reserve"](${bboxStr});
  relation["type"="multipolygon"]["landuse"~"cemetery|grave_yard|forest|grass"](${bboxStr});
  relation["type"="multipolygon"]["building"](${bboxStr});
  node["addr:housenumber"](${bboxStr});
  node["amenity"~"library|ice_cream|cafe|fire_station|police|hospital|clinic|school|college|university|place_of_worship|restaurant|fast_food|townhall|community_centre|museum|arts_centre|post_office|recycling"](${bboxStr});
  node["shop"~"bakery|pastry|coffee|books|confectionery|supermarket|convenience|greengrocer|deli"](${bboxStr});
  node["leisure"~"park|playground|pitch"](${bboxStr});
  way["amenity"~"library|ice_cream|cafe|fire_station|police|hospital|clinic|school|college|university|place_of_worship|restaurant|fast_food|townhall|community_centre|museum|post_office|recycling"](${bboxStr});
  way["railway"="station"](${bboxStr});
  way["tourism"~"museum|gallery"](${bboxStr});
);
out tags geom;
`;
}

/**
 * Fetch via official OpenStreetMap API v0.6 tiled bounding-box grid.
 * Returns complete raw nodes + ways (including all POI tags & house addresses).
 * Automatically subdivides dense city tiles 2x2 on HTTP 400 (50k-node limit)
 * and retries politely on HTTP 429/509/5xx so ultra-dense capitals (Oslo, Tokyo,
 * London, Paris) always download cleanly in-browser and in Node!
 */
export async function fetchOsmApiTiled(
  bbox,
  {
    gridMeters = 1600,
    fetchImpl = globalThis.fetch,
    onProgress = null,
    timeoutMs = 30000,
    delayBetweenTilesMs = 120,
    maxSubdivideDepth = 2,
    userAgent = "NeighborhoodExplorerRPG/1.0 (https://github.com/eh-ipmai/Neighborhood-explorer)",
  } = {}
) {
  const tilesPerSide = gridMeters > 2400 ? 5 : gridMeters > 1600 ? 4 : gridMeters > 950 ? 3 : 2;
  const latStep = (bbox.north - bbox.south) / tilesPerSide;
  const lonStep = (bbox.east - bbox.west) / tilesPerSide;
  const dedup = new Map();
  const isBrowser = typeof window !== "undefined";
  const headers = { Accept: "application/json" };
  if (!isBrowser && userAgent) headers["User-Agent"] = userAgent;

  const queue = [];
  for (let r = 0; r < tilesPerSide; r++) {
    for (let c = 0; c < tilesPerSide; c++) {
      queue.push({
        south: bbox.south + r * latStep,
        north: bbox.south + (r + 1) * latStep,
        west: bbox.west + c * lonStep,
        east: bbox.west + (c + 1) * lonStep,
        depth: 0,
      });
    }
  }

  let total = queue.length;
  let done = 0;

  while (queue.length > 0) {
    const tile = queue.shift();
    const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${tile.west.toFixed(6)},${tile.south.toFixed(6)},${tile.east.toFixed(6)},${tile.north.toFixed(6)}`;

    onProgress?.({
      stage: "fetch",
      completed: done,
      total,
      message: `Downloading neighborhood map tile ${done + 1} of ${total}...`,
    });

    let fetched = false;
    let subdivided = false;
    let lastStatus = 0;

    for (let attempt = 0; attempt < 3 && !fetched && !subdivided; attempt++) {
      if (attempt > 0) {
        await sleep(800 * attempt);
      }
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
      try {
        const res = await fetchImpl(url, {
          headers,
          ...(controller ? { signal: controller.signal } : {}),
        });
        lastStatus = res.status;

        // Dense urban tile exceeded OSM API's 50,000-node cap -> automatically quadtree-split 2x2!
        if (res.status === 400 && tile.depth < maxSubdivideDepth) {
          const midLat = (tile.south + tile.north) / 2;
          const midLon = (tile.west + tile.east) / 2;
          const nextDepth = tile.depth + 1;
          queue.unshift(
            { south: tile.south, north: midLat, west: tile.west, east: midLon, depth: nextDepth },
            { south: tile.south, north: midLat, west: midLon, east: tile.east, depth: nextDepth },
            { south: midLat, north: tile.north, west: tile.west, east: midLon, depth: nextDepth },
            { south: midLat, north: tile.north, west: midLon, east: tile.east, depth: nextDepth }
          );
          total += 3; // replaced 1 dense tile with 4 smaller sub-tiles
          subdivided = true;
          onProgress?.({
            stage: "fetch",
            completed: done,
            total,
            message: `Dense city block detected — splitting into smaller tiles (${done}/${total})...`,
          });
          break;
        }

        if (res.status === 429 || res.status === 509 || res.status >= 500) {
          if (attempt < 2) continue;
          throw new Error(`OSM API tile ${done + 1}/${total} returned HTTP ${res.status}`);
        }
        if (!res.ok) {
          throw new Error(`OSM API tile ${done + 1}/${total} returned HTTP ${res.status}`);
        }
        const data = await res.json();
        for (const el of data.elements || []) {
          dedup.set(`${el.type}:${el.id}`, el);
        }
        fetched = true;
      } catch (err) {
        if (attempt >= 2 || (lastStatus > 0 && lastStatus < 500 && lastStatus !== 429)) {
          throw err;
        }
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    if (subdivided) continue;

    done++;
    onProgress?.({
      stage: "fetch",
      completed: done,
      total,
      message: `Downloaded ${done}/${total} map tiles (${dedup.size.toLocaleString()} real-world features)`,
    });

    if (delayBetweenTilesMs > 0 && queue.length > 0) {
      await sleep(delayBetweenTilesMs);
    }
  }

  return Array.from(dedup.values());
}

/**
 * Fetch a single bounding box chunk from Overpass API mirrors with retry.
 */
async function fetchOverpassSingleChunk(
  bbox,
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = 50000,
    userAgent = "NeighborhoodExplorerRPG/1.0 (https://github.com/eh-ipmai/Neighborhood-explorer)",
    label = "",
  } = {}
) {
  const query = buildOverpassQuery(bbox, 45);
  const isBrowser = typeof window !== "undefined";
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (!isBrowser && userAgent) headers["User-Agent"] = userAgent;

  const attempts = [
    { endpoint: OVERPASS_ENDPOINTS[0], delayMs: 0 },
    { endpoint: OVERPASS_ENDPOINTS[1], delayMs: 1500 },
    { endpoint: OVERPASS_ENDPOINTS[0], delayMs: 3500 },
    { endpoint: OVERPASS_ENDPOINTS[2], delayMs: 1500 },
  ];

  let lastError = null;
  for (const { endpoint, delayMs } of attempts) {
    if (delayMs > 0) await sleep(delayMs);
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    try {
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body: `data=${encodeURIComponent(query)}`,
        ...(controller ? { signal: controller.signal } : {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (Array.isArray(data.elements)) {
        return data.elements;
      }
      throw new Error(`Invalid Overpass response ${label}`);
    } catch (err) {
      lastError = err;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastError || new Error("All Overpass API mirrors failed");
}

/**
 * Fetch complete OpenStreetMap elements for any neighborhood bounding box.
 * Automatically tries OSM API tiled grid first (fast & reliable), falling back
 * to chunked Overpass API queries if needed.
 */
export async function fetchOsmDataForBbox(
  bbox,
  {
    gridMeters = 1600,
    fetchImpl = globalThis.fetch,
    onProgress = null,
    preferOverpass = false,
  } = {}
) {
  if (!preferOverpass) {
    try {
      return await fetchOsmApiTiled(bbox, { gridMeters, fetchImpl, onProgress });
    } catch (apiErr) {
      onProgress?.({
        stage: "fetch",
        completed: 0,
        total: 1,
        message: `Switching to Overpass mirror (${apiErr.message})...`,
      });
    }
  }

  const chunksPerSide = gridMeters > 2100 ? 3 : gridMeters > 1100 ? 2 : 1;
  const total = chunksPerSide * chunksPerSide;
  if (total === 1) {
    onProgress?.({
      stage: "fetch",
      completed: 0,
      total: 1,
      message: "Querying OpenStreetMap Overpass API...",
    });
    const els = await fetchOverpassSingleChunk(bbox, { fetchImpl });
    onProgress?.({
      stage: "fetch",
      completed: 1,
      total: 1,
      message: `Downloaded ${els.length.toLocaleString()} real-world features`,
    });
    return els;
  }

  const latStep = (bbox.north - bbox.south) / chunksPerSide;
  const lonStep = (bbox.east - bbox.west) / chunksPerSide;
  const dedup = new Map();
  let done = 0;

  for (let r = 0; r < chunksPerSide; r++) {
    for (let c = 0; c < chunksPerSide; c++) {
      const sub = {
        south: bbox.south + r * latStep,
        north: bbox.south + (r + 1) * latStep,
        west: bbox.west + c * lonStep,
        east: bbox.west + (c + 1) * lonStep,
      };
      onProgress?.({
        stage: "fetch",
        completed: done,
        total,
        message: `Querying Overpass chunk ${done + 1} of ${total}...`,
      });
      const els = await fetchOverpassSingleChunk(sub, {
        fetchImpl,
        label: `[${done + 1}/${total}]`,
      });
      for (const el of els) {
        dedup.set(`${el.type}:${el.id}`, el);
      }
      done++;
      onProgress?.({
        stage: "fetch",
        completed: done,
        total,
        message: `Downloaded ${done}/${total} chunks (${dedup.size.toLocaleString()} features)`,
      });
      if (done < total) await sleep(1200);
    }
  }

  return Array.from(dedup.values());
}
