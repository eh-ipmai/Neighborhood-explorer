/**
 * Active Street-Sign Wayfinding & Turn-by-Turn Street Directions Engine.
 *
 * Builds real intersection & mid-block street signs from worldMap.streetZones,
 * resolves crossing street names + cardinal branches (N/S/E/W), and computes
 * road/sidewalk-following turn-by-turn directions from any street sign to any
 * destination while respecting solid buildings, water, and highway median barriers.
 */

import { getNavigationSubgrid } from "./subgrid.js";

const CHUNK_SIZE = 16;

const DIR_VECTORS = [
  { key: "N", dx: 0, dy: -1, label: "North", arrow: "↑" },
  { key: "S", dx: 0, dy: 1, label: "South", arrow: "↓" },
  { key: "E", dx: 1, dy: 0, label: "East", arrow: "→" },
  { key: "W", dx: -1, dy: 0, label: "West", arrow: "←" },
];

const DIR_LABELS = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
  NE: "Northeast",
  NW: "Northwest",
  SE: "Southeast",
  SW: "Southwest",
};

const DIR_ARROWS = {
  N: "↑",
  S: "↓",
  E: "→",
  W: "←",
  NE: "↗",
  NW: "↖",
  SE: "↘",
  SW: "↙",
};

function isRoadTileId(id) {
  return id === 2 || id === 3 || id === 4 || id === 12;
}

function isWalkablePathId(id) {
  return id === 1 || id === 2 || id === 3 || id === 4 || id === 9 || id === 12;
}

/**
 * Abbreviate common street suffixes cleanly for crisp green Massachusetts street blades.
 */
export function abbreviateStreetName(name) {
  if (!name) return "";
  return String(name)
    .trim()
    .replace(/\bStreet\b/gi, "St")
    .replace(/\bAvenue\b/gi, "Ave")
    .replace(/\bRoad\b/gi, "Rd")
    .replace(/\bDrive\b/gi, "Dr")
    .replace(/\bLane\b/gi, "Ln")
    .replace(/\bCourt\b/gi, "Ct")
    .replace(/\bPlace\b/gi, "Pl")
    .replace(/\bTerrace\b/gi, "Ter")
    .replace(/\bCircle\b/gi, "Cir")
    .replace(/\bParkway\b/gi, "Pkwy")
    .replace(/\bBoulevard\b/gi, "Blvd")
    .replace(/\bSquare\b/gi, "Sq")
    .replace(/\bPath\b/gi, "Path")
    .replace(/\bTrail\b/gi, "Trl");
}

export function normalizeStreetKey(name) {
  return abbreviateStreetName(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Extract street portion from a house address like "565 Boylston St" -> "boylston st".
 */
export function extractStreetFromAddress(address) {
  if (!address) return "";
  const cleaned = String(address).trim().replace(/^\d+[a-zA-Z-]*\s+/, "");
  return normalizeStreetKey(cleaned);
}

/**
 * Extract just the house/porch number from an address like "565 Boylston St" -> "#565".
 */
export function extractHouseNumber(address) {
  if (!address) return "";
  const m = String(address).trim().match(/^(\d+[a-zA-Z-]*)\b/);
  return m ? `#${m[1]}` : "";
}

/**
 * Compute cardinal direction key ("N", "S", "E", "W") from (dx, dy).
 */
export function vectorToCardinal(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "E" : "W";
  }
  return dy >= 0 ? "S" : "N";
}

/**
 * Compute 8-way compass direction ("N", "NE", "E", ...) from (dx, dy).
 */
export function vectorToCompass8(dx, dy) {
  const angle = Math.atan2(dy, dx);
  const dirs = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
  const idx = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return dirs[idx];
}

/**
 * Relative turn word ("LEFT", "RIGHT", "STRAIGHT", "BACK") from prevDir to nextDir.
 */
function computeRelativeTurn(prevDir, nextDir) {
  if (!prevDir || prevDir === nextDir) return "STRAIGHT";
  const order = ["N", "E", "S", "W"];
  const a = order.indexOf(prevDir);
  const b = order.indexOf(nextDir);
  if (a === -1 || b === -1) return "TURN";
  const diff = (b - a + 4) % 4;
  if (diff === 1) return "RIGHT";
  if (diff === 3) return "LEFT";
  if (diff === 2) return "BACK";
  return "STRAIGHT";
}

/**
 * Tiny binary min-heap for fast, zero-GC A* routing across 512x512 grids.
 */
class MinHeap {
  constructor() {
    this.nodes = [];
    this.priorities = [];
  }
  get size() {
    return this.nodes.length;
  }
  push(node, prio) {
    let i = this.nodes.length;
    this.nodes.push(node);
    this.priorities.push(prio);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= prio) break;
      this.nodes[i] = this.nodes[parent];
      this.priorities[i] = this.priorities[parent];
      i = parent;
    }
    this.nodes[i] = node;
    this.priorities[i] = prio;
  }
  pop() {
    const n = this.nodes.length;
    if (n === 0) return -1;
    const top = this.nodes[0];
    const lastNode = this.nodes.pop();
    const lastPrio = this.priorities.pop();
    if (n > 1) {
      let i = 0;
      const half = (n - 1) >> 1;
      while (i < half) {
        let child = (i << 1) + 1;
        const right = child + 1;
        if (right < n - 1 && this.priorities[right] < this.priorities[child]) {
          child = right;
        }
        if (lastPrio <= this.priorities[child]) break;
        this.nodes[i] = this.nodes[child];
        this.priorities[i] = this.priorities[child];
        i = child;
      }
      this.nodes[i] = lastNode;
      this.priorities[i] = lastPrio;
    }
    return top;
  }
}

/**
 * Build spatial bucket index of worldMap.streetZones for fast multi-street queries.
 */
function buildStreetZoneSpatialIndex(streetZones) {
  const buckets = new Map();
  for (let i = 0; i < streetZones.length; i++) {
    const z = streetZones[i];
    if (!z || !z.bounds || !z.name) continue;
    const minCx = Math.floor(z.bounds.minX / CHUNK_SIZE);
    const maxCx = Math.floor(z.bounds.maxX / CHUNK_SIZE);
    const minCy = Math.floor(z.bounds.minY / CHUNK_SIZE);
    const maxCy = Math.floor(z.bounds.maxY / CHUNK_SIZE);
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx},${cy}`;
        let list = buckets.get(key);
        if (!list) {
          list = [];
          buckets.set(key, list);
        }
        list.push(z);
      }
    }
  }

  const TYPE_PRIORITY = { arterial: 3, residential: 2, sidewalk: 1, trail: 1 };

  function queryStreetsNear(tx, ty, radius = 2) {
    const minCx = Math.floor((tx - radius) / CHUNK_SIZE);
    const maxCx = Math.floor((tx + radius) / CHUNK_SIZE);
    const minCy = Math.floor((ty - radius) / CHUNK_SIZE);
    const maxCy = Math.floor((ty + radius) / CHUNK_SIZE);
    const found = new Map(); // normKey -> { name, type, prio, dist }

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = buckets.get(`${cx},${cy}`);
        if (!list) continue;
        for (const z of list) {
          const b = z.bounds;
          if (tx + radius < b.minX || tx - radius > b.maxX || ty + radius < b.minY || ty - radius > b.maxY) {
            continue;
          }
          const clampedX = Math.max(b.minX, Math.min(b.maxX, tx));
          const clampedY = Math.max(b.minY, Math.min(b.maxY, ty));
          const dist = Math.hypot(tx - clampedX, ty - clampedY);
          if (dist > radius + 0.5) continue;

          const norm = normalizeStreetKey(z.name);
          if (!norm) continue;
          const prio = TYPE_PRIORITY[z.type] || 1;
          const prev = found.get(norm);
          if (!prev || dist < prev.dist - 0.1 || (Math.abs(dist - prev.dist) <= 0.1 && prio > prev.prio)) {
            found.set(norm, { name: z.name, norm, type: z.type, prio, dist });
          }
        }
      }
    }

    return [...found.values()].sort((a, b) => {
      if (b.prio !== a.prio) return b.prio - a.prio;
      if (a.dist !== b.dist) return a.dist - b.dist;
      return a.name.localeCompare(b.name);
    });
  }

  return { queryStreetsNear };
}

/**
 * Determine which cardinal directions ("N","S","E","W") a named street continues from (tx, ty).
 */
function detectStreetBranches(tx, ty, streetNorm, zoneIndex, worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const dirs = [];

  for (const v of DIR_VECTORS) {
    let matched = false;
    for (const step of [5, 9]) {
      const sx = tx + v.dx * step;
      const sy = ty + v.dy * step;
      if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
      const tileId = base[sy * width + sx];
      let hasRoadOrWalk = isWalkablePathId(tileId);
      if (!hasRoadOrWalk) {
        for (let off = -1; off <= 1 && !hasRoadOrWalk; off++) {
          const ox = sx + (v.dy !== 0 ? off : 0);
          const oy = sy + (v.dx !== 0 ? off : 0);
          if (ox >= 0 && oy >= 0 && ox < width && oy < height && isWalkablePathId(base[oy * width + ox])) {
            hasRoadOrWalk = true;
          }
        }
      }
      if (!hasRoadOrWalk) continue;
      const streetsHere = zoneIndex.queryStreetsNear(sx, sy, 1);
      if (streetsHere.some((s) => s.norm === streetNorm)) {
        matched = true;
        break;
      }
    }
    if (matched) dirs.push(v.key);
  }
  return dirs;
}

/**
 * Build the active street-sign system:
 *  - Places real green street signs at every named cross-street intersection (including crosswalk corners!)
 *    and along long road stretches so players can always check a sign nearby.
 *  - Computes street-following turn-by-turn directions from any tile/sign to any target.
 */
export function createStreetSignSystem(worldMap, { parkOccupiedGrid = null, landmarks = [] } = {}) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const collision = worldMap.layers.collision;
  const tileSize = worldMap.tileSize || 16;
  const scaleMeters = worldMap.scaleMetersPerTile || 6;
  const streetZones = worldMap.streetZones || [];
  const zoneIndex = buildStreetZoneSpatialIndex(streetZones);
  const subgrid = getNavigationSubgrid(worldMap);
  const useSub = Boolean(subgrid && subgrid.hasVectorRoads);

  const isSignTileClear = (tx, ty) => {
    if (tx < 2 || ty < 2 || tx >= width - 2 || ty >= height - 2) return false;
    const idx = ty * width + tx;
    if (collision[idx] !== 0) return false;
    if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) return false;
    if (useSub) {
      const px = tx * tileSize + tileSize * 0.5;
      const py = ty * tileSize + tileSize * 0.5;
      if (subgrid.isRoadAtPx(px, py)) return false;
      const sx = Math.floor(px / subgrid.subCellSize);
      const sy = Math.floor(py / subgrid.subCellSize);
      if (subgrid.isSolidAtSub(sx, sy)) return false;
    }
    return true;
  };

  // If a candidate intersection corner tile got paved over by a curved vector road,
  // nudge the sign 1-2 tiles onto the nearest clean non-road sidewalk/lawn edge!
  const resolveCleanSignTile = (tx, ty) => {
    if (isSignTileClear(tx, ty)) return { tx, ty };
    if (!useSub) return null;
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const nx = tx + dx;
          const ny = ty + dy;
          if (!isSignTileClear(nx, ny)) continue;
          const nt = base[ny * width + nx];
          if (nt === 1 || nt === 0 || nt === 11) return { tx: nx, ty: ny };
        }
      }
    }
    return null;
  };

  const signs = [];
  const signById = new Map();
  const signBuckets = new Map();

  function addSign(tx, ty, streetEntries, isIntersection) {
    const id = `sign_${tx}_${ty}`;
    if (signById.has(id)) return null;

    const topStreets = streetEntries.slice(0, isIntersection ? 2 : 1);
    const streetNames = topStreets.map((s) => s.name);
    const shortNames = streetNames.map(abbreviateStreetName);
    const branches = topStreets.map((s) => ({
      street: s.name,
      shortStreet: abbreviateStreetName(s.name),
      norm: s.norm,
      type: s.type,
      dirs: detectStreetBranches(tx, ty, s.norm, zoneIndex, worldMap),
    }));

    const sign = {
      id,
      tx,
      ty,
      streets: streetNames,
      streetNorms: topStreets.map((s) => s.norm),
      primaryStreet: streetNames[0] || "Neighborhood Way",
      crossStreet: streetNames[1] || null,
      label: shortNames.length >= 2 ? `${shortNames[0]} & ${shortNames[1]}` : shortNames[0] || "Street Sign",
      shortLabel:
        shortNames.length >= 2
          ? `${shortNames[0].replace(/\s+(St|Ave|Rd|Dr|Ln|Way)$/i, "")} & ${shortNames[1].replace(/\s+(St|Ave|Rd|Dr|Ln|Way)$/i, "")}`
          : shortNames[0] || "Sign",
      isIntersection: Boolean(isIntersection && streetNames.length >= 2),
      branches,
    };

    signs.push(sign);
    signById.set(id, sign);

    const bKey = `${Math.floor(tx / CHUNK_SIZE)},${Math.floor(ty / CHUNK_SIZE)}`;
    let list = signBuckets.get(bKey);
    if (!list) {
      list = [];
      signBuckets.set(bKey, list);
    }
    list.push(sign);
    return sign;
  }

  function hasSignWithin(tx, ty, radius) {
    const minCx = Math.floor((tx - radius) / CHUNK_SIZE);
    const maxCx = Math.floor((tx + radius) / CHUNK_SIZE);
    const minCy = Math.floor((ty - radius) / CHUNK_SIZE);
    const maxCy = Math.floor((ty + radius) / CHUNK_SIZE);
    const r2 = radius * radius;
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = signBuckets.get(`${cx},${cy}`);
        if (!list) continue;
        for (const s of list) {
          const dx = s.tx - tx;
          const dy = s.ty - ty;
          if (dx * dx + dy * dy <= r2) return true;
        }
      }
    }
    return false;
  }

  // Pass 1: Place signs at REAL cross-street intersections (including crosswalk corners!)
  const placedIntersectionPairs = new Map(); // pairKey -> [{ tx, ty }]
  for (let ty = 2; ty < height - 2; ty++) {
    for (let tx = 2; tx < width - 2; tx++) {
      const idx = ty * width + tx;
      if (base[idx] !== 1 || collision[idx] !== 0) continue;
      if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) continue;

      const n = base[(ty - 1) * width + tx];
      const s = base[(ty + 1) * width + tx];
      const w = base[ty * width + (tx - 1)];
      const e = base[ty * width + (tx + 1)];
      const touchesRoad = isRoadTileId(n) || isRoadTileId(s) || isRoadTileId(w) || isRoadTileId(e);
      if (!touchesRoad) continue;

      // Prefer true street corners (touching both an N/S road and E/W road, or a crosswalk)
      const isCornerOrCross =
        ((isRoadTileId(n) || isRoadTileId(s)) && (isRoadTileId(w) || isRoadTileId(e))) ||
        n === 4 ||
        s === 4 ||
        w === 4 ||
        e === 4;
      if (!isCornerOrCross) continue;

      const nearbyStreets = zoneIndex.queryStreetsNear(tx, ty, 2);
      // Filter to road-level streets if at least 2 road-level streets exist; otherwise include trails/sidewalks
      const roadStreets = nearbyStreets.filter((st) => st.type === "arterial" || st.type === "residential");
      const chosen = roadStreets.length >= 2 ? roadStreets : nearbyStreets;
      if (chosen.length < 2) continue;

      const pairKey = [chosen[0].norm, chosen[1].norm].sort().join("|");
      const prevLocs = placedIntersectionPairs.get(pairKey) || [];
      // Keep street corners clean & uncluttered: one sign per intersection (or across wide divided highways >11 tiles)
      if (prevLocs.some((p) => Math.hypot(p.tx - tx, p.ty - ty) < 11)) continue;
      const cleanPos = resolveCleanSignTile(tx, ty);
      if (!cleanPos) continue;
      if (hasSignWithin(cleanPos.tx, cleanPos.ty, 9)) continue;

      addSign(cleanPos.tx, cleanPos.ty, chosen, true);
      prevLocs.push({ tx: cleanPos.tx, ty: cleanPos.ty });
      placedIntersectionPairs.set(pairKey, prevLocs);
    }
  }

  // Pass 2: Place mid-block street confirmation signs on long named stretches (every ~16 tiles)
  // so players walking out of Home Base or down long avenues always encounter a sign promptly!
  for (let ty = 2; ty < height - 2; ty += 2) {
    for (let tx = 2; tx < width - 2; tx += 2) {
      const idx = ty * width + tx;
      if (base[idx] !== 1 || collision[idx] !== 0) continue;
      if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) continue;

      const n = base[(ty - 1) * width + tx];
      const s = base[(ty + 1) * width + tx];
      const w = base[ty * width + (tx - 1)];
      const e = base[ty * width + (tx + 1)];
      if (!(isRoadTileId(n) || isRoadTileId(s) || isRoadTileId(w) || isRoadTileId(e))) continue;
      const cleanPos = resolveCleanSignTile(tx, ty);
      if (!cleanPos) continue;
      if (hasSignWithin(cleanPos.tx, cleanPos.ty, 14)) continue;

      const nearbyStreets = zoneIndex.queryStreetsNear(cleanPos.tx, cleanPos.ty, 2);
      if (nearbyStreets.length === 0) continue;
      addSign(cleanPos.tx, cleanPos.ty, nearbyStreets, nearbyStreets.length >= 2);
    }
  }

  // Ensure there's always a welcoming street sign very close to Home Base spawn!
  const spawn = worldMap.origin?.spawnTile;
  if (spawn && !hasSignWithin(spawn.x, spawn.y, 8)) {
    let bestSpawnCorner = null;
    for (let r = 1; r <= 12 && !bestSpawnCorner; r++) {
      for (let dy = -r; dy <= r && !bestSpawnCorner; dy++) {
        for (let dx = -r; dx <= r && !bestSpawnCorner; dx++) {
          const tx = spawn.x + dx;
          const ty = spawn.y + dy;
          if (tx < 1 || ty < 1 || tx >= width - 1 || ty >= height - 1) continue;
          const idx = ty * width + tx;
          if (base[idx] !== 1 || collision[idx] !== 0) continue;
          if (!isSignTileClear(tx, ty)) continue;
          const touchesRoad =
            isRoadTileId(base[(ty - 1) * width + tx]) ||
            isRoadTileId(base[(ty + 1) * width + tx]) ||
            isRoadTileId(base[ty * width + (tx - 1)]) ||
            isRoadTileId(base[ty * width + (tx + 1)]);
          if (!touchesRoad) continue;
          const st = zoneIndex.queryStreetsNear(tx, ty, 3);
          if (st.length > 0) bestSpawnCorner = { tx, ty, st };
        }
      }
    }
    if (bestSpawnCorner) {
      addSign(bestSpawnCorner.tx, bestSpawnCorner.ty, bestSpawnCorner.st, bestSpawnCorner.st.length >= 2);
    }
  }

  // Reusable typed arrays for blazing-fast A* routing (<5ms across 512x512!)
  const totalTiles = width * height;
  const gScore = new Float32Array(totalTiles);
  const cameFrom = new Int32Array(totalTiles);
  const visitStamp = new Uint32Array(totalTiles);
  let currentStamp = 0;

  // Tile traversal weights: strongly follow sidewalks, crosswalks & named streets,
  // avoid jaywalking highways, and never pass through solid tiles / median barriers.
  function tileMoveCost(id) {
    switch (id) {
      case 1: // sidewalk
      case 4: // crosswalk
        return 1.0;
      case 2: // residential road
      case 9: // dirt trail
        return 1.15;
      case 3: // main road
        return 1.25;
      case 11: // park turf
      case 8: // parking lot
        return 2.1;
      case 0: // grass
      case 10: // sand
        return 2.4;
      case 7: // tall grass / woods
        return 2.8;
      case 12: // Route 9 highway — heavily discourage mid-block crossing so routes use crosswalks!
        return 4.5;
      default:
        return 2.5;
    }
  }

  /**
   * Find an optimal street-following tile path from (startX, startY) to (goalX, goalY).
   */
  function findStreetPath(startX, startY, goalX, goalY, maxExpansions = 48000) {
    const sx = Math.max(0, Math.min(width - 1, Math.round(startX)));
    const sy = Math.max(0, Math.min(height - 1, Math.round(startY)));
    const gx = Math.max(0, Math.min(width - 1, Math.round(goalX)));
    const gy = Math.max(0, Math.min(height - 1, Math.round(goalY)));

    const startIdx = sy * width + sx;
    const goalIdx = gy * width + gx;
    if (startIdx === goalIdx) return [{ x: sx, y: sy }];

    currentStamp += 1;
    if (currentStamp >= 0xfffffff0) {
      visitStamp.fill(0);
      currentStamp = 1;
    }

    const heap = new MinHeap();
    visitStamp[startIdx] = currentStamp;
    gScore[startIdx] = 0;
    cameFrom[startIdx] = -1;
    heap.push(startIdx, Math.abs(gx - sx) + Math.abs(gy - sy));

    let expansions = 0;
    let bestClosestIdx = startIdx;
    let bestClosestDist = Math.abs(gx - sx) + Math.abs(gy - sy);
    let reachedIdx = -1;

    while (heap.size > 0 && expansions < maxExpansions) {
      const cur = heap.pop();
      if (cur === goalIdx) {
        reachedIdx = cur;
        break;
      }
      expansions++;

      const cx = cur % width;
      const cy = (cur - cx) / width;
      const distGoal = Math.abs(gx - cx) + Math.abs(gy - cy);
      if (distGoal < bestClosestDist) {
        bestClosestDist = distGoal;
        bestClosestIdx = cur;
      }
      if (distGoal <= 2) {
        reachedIdx = cur;
        break;
      }

      const curG = gScore[cur];

      for (let d = 0; d < 4; d++) {
        const nx = cx + DIR_VECTORS[d].dx;
        const ny = cy + DIR_VECTORS[d].dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (collision[nIdx] !== 0) continue;

        const stepCost = tileMoveCost(base[nIdx]);
        const tentativeG = curG + stepCost;

        if (visitStamp[nIdx] !== currentStamp || tentativeG < gScore[nIdx]) {
          visitStamp[nIdx] = currentStamp;
          gScore[nIdx] = tentativeG;
          cameFrom[nIdx] = cur;
          // Slightly weighted heuristic (1.15) keeps A* snappy on 512x512 while staying accurate
          const h = (Math.abs(gx - nx) + Math.abs(gy - ny)) * 1.12;
          heap.push(nIdx, tentativeG + h);
        }
      }
    }

    const endNode = reachedIdx !== -1 ? reachedIdx : bestClosestIdx;
    const path = [];
    let cur = endNode;
    while (cur !== -1) {
      const x = cur % width;
      const y = (cur - x) / width;
      path.push({ x, y });
      cur = cameFrom[cur];
    }
    path.reverse();
    return path;
  }

  /**
   * Collapse a raw tile path into crisp human-readable street-by-street turn instructions!
   */
  function buildDirectionsFromPath(path, targetLabel = "Destination") {
    if (!path || path.length <= 1) {
      return {
        steps: [{ kind: "arrive", dir: "N", street: "", blocks: 0, text: `You're right at ${targetLabel}!` }],
        firstDir: null,
        summary: `Right near ${targetLabel}!`,
        totalTiles: 0,
      };
    }

    // Sample every 3 tiles to smooth micro-jogs around curbs & crosswalks
    const samples = [];
    for (let i = 0; i < path.length; i += 3) {
      samples.push(path[i]);
    }
    if (samples[samples.length - 1] !== path[path.length - 1]) {
      samples.push(path[path.length - 1]);
    }

    // Label each sample with its primary street name (carrying forward brief gaps like crosswalks)
    const labeled = samples.map((pt) => {
      const sts = zoneIndex.queryStreetsNear(pt.x, pt.y, 2);
      const roadSt = sts.find((s) => s.type === "arterial" || s.type === "residential") || sts[0] || null;
      return {
        x: pt.x,
        y: pt.y,
        street: roadSt ? roadSt.name : null,
        norm: roadSt ? roadSt.norm : "",
      };
    });

    // Fill short null gaps (e.g. crossing a wide intersection or park edge)
    for (let i = 1; i < labeled.length - 1; i++) {
      if (!labeled[i].street && labeled[i - 1].street && labeled[i - 1].norm === labeled[i + 1].norm) {
        labeled[i].street = labeled[i - 1].street;
        labeled[i].norm = labeled[i - 1].norm;
      }
    }

    // Group consecutive samples on the same street into route segments
    const rawSegments = [];
    for (const pt of labeled) {
      const segStreet = pt.street || "Park / Sidewalk Path";
      const segNorm = pt.norm || "__path__";
      const last = rawSegments[rawSegments.length - 1];
      if (last && last.norm === segNorm) {
        last.points.push(pt);
      } else {
        rawSegments.push({ street: segStreet, norm: segNorm, points: [pt] });
      }
    }

    // Filter out tiny 1-sample corner blips (< 4 tiles long) when sandwiched between two real streets
    const mergedSegments = [];
    for (const seg of rawSegments) {
      const firstPt = seg.points[0];
      const lastPt = seg.points[seg.points.length - 1];
      const lenTiles = Math.hypot(lastPt.x - firstPt.x, lastPt.y - firstPt.y);
      if (lenTiles < 4 && mergedSegments.length > 0) {
        continue;
      }
      const prev = mergedSegments[mergedSegments.length - 1];
      if (prev && prev.norm === seg.norm) {
        prev.points.push(...seg.points);
      } else {
        mergedSegments.push(seg);
      }
    }

    // Build crisp turn-by-turn text steps (cap at 6 clear legs + arrival)
    const steps = [];
    let prevDir = null;

    for (let i = 0; i < mergedSegments.length && steps.length < 6; i++) {
      const seg = mergedSegments[i];
      const p0 = seg.points[0];
      const p1 = seg.points[seg.points.length - 1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const distTiles = Math.max(1, Math.round(Math.hypot(dx, dy)));
      if (distTiles < 3 && mergedSegments.length > 1) continue;

      const dir = vectorToCardinal(dx, dy);
      const compass8 = vectorToCompass8(dx, dy);
      const isStrongDiag = Math.min(Math.abs(dx), Math.abs(dy)) > 0.55 * Math.max(Math.abs(dx), Math.abs(dy));
      const displayDir = isStrongDiag ? compass8 : dir;
      const dirWord = DIR_LABELS[displayDir] || DIR_LABELS[dir];
      const arrow = DIR_ARROWS[displayDir] || DIR_ARROWS[dir];
      const blocks = Math.max(1, Math.round(distTiles / 18));
      const shortSt = abbreviateStreetName(seg.street);
      const isNamed = seg.norm !== "__path__";

      let text;
      if (steps.length === 0) {
        text = isNamed
          ? `Head ${dirWord.toUpperCase()} on ${shortSt} (~${blocks} ${blocks === 1 ? "block" : "blocks"})`
          : `Head ${dirWord.toUpperCase()} along the path (~${Math.round(distTiles * scaleMeters)}m)`;
      } else {
        const turn = computeRelativeTurn(prevDir, dir);
        const turnPhrase =
          turn === "LEFT"
            ? `Turn LEFT (${dirWord})`
            : turn === "RIGHT"
              ? `Turn RIGHT (${dirWord})`
              : `Continue ${dirWord}`;
        text = isNamed
          ? `${turnPhrase} onto ${shortSt} (~${blocks} ${blocks === 1 ? "block" : "blocks"})`
          : `${turnPhrase} onto the path toward ${targetLabel}`;
      }

      steps.push({
        kind: steps.length === 0 ? "start" : "turn",
        dir: displayDir,
        cardinal: dir,
        arrow,
        street: seg.street,
        shortStreet: shortSt,
        blocks,
        distTiles,
        text,
      });
      prevDir = dir;
    }

    if (steps.length === 0) {
      const p0 = path[0];
      const p1 = path[path.length - 1];
      const dir = vectorToCardinal(p1.x - p0.x, p1.y - p0.y);
      steps.push({
        kind: "start",
        dir,
        arrow: DIR_ARROWS[dir],
        street: "",
        shortStreet: "",
        blocks: 1,
        distTiles: path.length,
        text: `Head ${DIR_LABELS[dir].toUpperCase()} toward ${targetLabel}`,
      });
    }

    steps.push({
      kind: "arrive",
      dir: steps[steps.length - 1].dir,
      arrow: "★",
      street: "",
      shortStreet: "",
      blocks: 0,
      text: `Look for ${targetLabel}!`,
    });

    // Compute immediate departure vector over the first ~10 tiles for the chalk arrow on the sidewalk!
    const lookAheadIdx = Math.min(path.length - 1, 10);
    const firstDx = path[lookAheadIdx].x - path[0].x;
    const firstDy = path[lookAheadIdx].y - path[0].y;
    const firstDir = vectorToCompass8(firstDx, firstDy);

    const compactSummary =
      steps.length >= 3 && steps[1].shortStreet
        ? `${steps[0].arrow} ${steps[0].shortStreet || DIR_LABELS[steps[0].dir]} → ${steps[1].arrow} ${steps[1].shortStreet}`
        : `${steps[0].arrow} ${steps[0].text}`;

    return {
      steps,
      firstDir,
      firstDx,
      firstDy,
      summary: compactSummary,
      totalTiles: path.length,
    };
  }

  /**
   * Compute full route directions from tile (fromX, fromY) to (toX, toY).
   */
  function computeDirections(fromX, fromY, toX, toY, targetLabel = "Destination") {
    const distDirect = Math.hypot(toX - fromX, toY - fromY);
    if (distDirect <= 5) {
      return {
        steps: [{ kind: "arrive", dir: "N", arrow: "★", street: "", shortStreet: "", blocks: 0, text: `${targetLabel} is right around this corner!` }],
        firstDir: vectorToCompass8(toX - fromX, toY - fromY),
        firstDx: toX - fromX,
        firstDy: toY - fromY,
        summary: `★ Right near ${targetLabel}!`,
        totalTiles: Math.round(distDirect),
      };
    }
    const path = findStreetPath(fromX, fromY, toX, toY);
    return buildDirectionsFromPath(path, targetLabel);
  }

  /**
   * List nearby landmarks relative to a street sign (with cardinal direction & approx blocks).
   */
  function getNearbyLandmarksForSign(sign, maxCount = 3) {
    const items = [];
    for (const lm of landmarks) {
      const lx = lm.walkTileX ?? lm.tileX;
      const ly = lm.walkTileY ?? lm.tileY;
      const dx = lx - sign.tx;
      const dy = ly - sign.ty;
      const dist = Math.hypot(dx, dy);
      if (dist > 140) continue;
      const dir = vectorToCompass8(dx, dy);
      const blocks = Math.max(1, Math.round(dist / 18));
      items.push({
        id: lm.id,
        name: lm.name.replace(/\s*\(.*\)/, ""),
        dir,
        arrow: DIR_ARROWS[dir] || "•",
        blocks,
        distTiles: dist,
        isRightHere: dist <= 7,
      });
    }
    items.sort((a, b) => a.distTiles - b.distTiles);
    return items.slice(0, maxCount);
  }

  /**
   * Find the nearest interactive street sign within maxDist tiles of (tx, ty).
   */
  function findNearbySign(tx, ty, maxDist = 2.6) {
    const minCx = Math.floor((tx - maxDist) / CHUNK_SIZE);
    const maxCx = Math.floor((tx + maxDist) / CHUNK_SIZE);
    const minCy = Math.floor((ty - maxDist) / CHUNK_SIZE);
    const maxCy = Math.floor((ty + maxDist) / CHUNK_SIZE);
    let best = null;
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = signBuckets.get(`${cx},${cy}`);
        if (!list) continue;
        for (const s of list) {
          const dist = Math.hypot(s.tx - tx, s.ty - ty);
          if (dist <= maxDist && (!best || dist < best.dist)) {
            best = { sign: s, dist };
          }
        }
      }
    }
    return best;
  }

  /**
   * Query signs in a visible tile viewport rectangle (for fast O(1) rendering).
   */
  function queryVisibleSigns(minX, minY, maxX, maxY) {
    const minCx = Math.floor(minX / CHUNK_SIZE);
    const maxCx = Math.floor(maxX / CHUNK_SIZE);
    const minCy = Math.floor(minY / CHUNK_SIZE);
    const maxCy = Math.floor(maxY / CHUNK_SIZE);
    const out = [];
    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const list = signBuckets.get(`${cx},${cy}`);
        if (!list) continue;
        for (const s of list) {
          if (s.tx >= minX && s.tx <= maxX && s.ty >= minY && s.ty <= maxY) {
            out.push(s);
          }
        }
      }
    }
    return out;
  }

  return {
    signs,
    getSignById: (id) => signById.get(id) || null,
    findNearbySign,
    queryVisibleSigns,
    queryStreetsNear: zoneIndex.queryStreetsNear,
    computeDirections,
    getNearbyLandmarksForSign,
  };
}
