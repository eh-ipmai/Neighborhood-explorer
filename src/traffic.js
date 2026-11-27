/**
 * Moving Road Traffic System (Cars, Trucks & Annoying Spandex Bikers on Newton's Roads):
 *   - HEAVY multi-lane traffic on Highways (Route 9 / Boylston St & Hammond Pond Pkwy)
 *     packed with fast cars, SUVs, pickup trucks & freight box delivery trucks!
 *   - Moderate traffic on Town Avenues (Centre St, Beacon St, Langley Rd, Walnut St, etc.).
 *   - Light, realistic occasional traffic on residential side streets.
 *   - When `worldMap.vectorRoads` is present, vehicles drive smoothly along the EXACT real
 *     OpenStreetMap vector road polylines in proper right-hand travel lanes with smooth curve
 *     angles and junction turning — NEVER driving onto sidewalks or lawns!
 *   - Falls back seamlessly to the tile grid on synthetic test maps without `vectorRoads`.
 *   - Cars & trucks politely slow/yield at crosswalks when Liam has actively Looked Both Ways
 *     (safeCrossingActive). Annoying spandex bikers DO NOT yield politely — they ring their bell
 *     obnoxiously ("DING-DING-DING!!"), shout cyclist chants ("ON YOUR LEFT!", "STRAVA PR!"),
 *     and sprint right past!
 *   - Getting hit triggers the dramatic Cool Ambulance + EMT Stretcher -> Mom Grounded Forever -> GAME OVER cutscene!
 *
 * Pure JS (zero DOM dependencies) so it runs in headless Node unit tests too.
 */

import { getNavigationSubgrid } from "./subgrid.js";

const DRIVABLE_TILES = new Set([2, 3, 4, 12]);
const DIRS = [
  { name: "e", dx: 1, dy: 0 },
  { name: "w", dx: -1, dy: 0 },
  { name: "s", dx: 0, dy: 1 },
  { name: "n", dx: 0, dy: -1 },
];

const CARDINAL_BASE_DEG = {
  e: 0,
  s: 90,
  w: 180,
  n: -90,
};

export const BIKER_CHANT_COUNT = 5;
export const CAR_VARIANT_COUNT = 10;

// Road-contact physical footprints (in logical px) matching our 32-bit sprites so every
// car, truck, and bike stays 100% inside paved road asphalt (never clipping sidewalks/medians!)
const VEHICLE_FOOTPRINT = {
  bike: { halfLat: 4.5, halfLen: 6.5, edgeMargin: 5.0, minRoadW: 12.0 },
  car: { halfLat: 6.5, halfLen: 10.0, edgeMargin: 7.0, minRoadW: 15.0 },
  truck: { halfLat: 7.5, halfLen: 13.0, edgeMargin: 8.2, minRoadW: 20.5 },
};

export function isVehicleFootprintOnRoad(subgrid, x, y, ux, uy, kind = "car") {
  if (!subgrid) return true;
  if (!subgrid.isDrivableAtPx(x, y)) return false;
  const fp = VEHICLE_FOOTPRINT[kind] || VEHICLE_FOOTPRINT.car;
  const len = Math.hypot(ux || 0, uy || 0);
  const tx = len > 1e-5 ? ux / len : 1;
  const ty = len > 1e-5 ? uy / len : 0;
  const rnx = -ty;
  const rny = tx;
  const lat = fp.halfLat;
  const fwd = fp.halfLen * 0.55;
  return (
    subgrid.isDrivableAtPx(x + rnx * lat, y + rny * lat) &&
    subgrid.isDrivableAtPx(x - rnx * lat, y - rny * lat) &&
    subgrid.isDrivableAtPx(x + tx * fwd, y + ty * fwd) &&
    subgrid.isDrivableAtPx(x - tx * fwd, y - ty * fwd)
  );
}

function hash2(x, y, seed = 41) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

function isDrivable(base, width, height, tx, ty) {
  if (tx < 1 || ty < 1 || tx >= width - 1 || ty >= height - 1) return false;
  return DRIVABLE_TILES.has(base[ty * width + tx]);
}

function getRoadSpeed(roadClass, kind) {
  if (kind === "bike") {
    return roadClass === 12 ? 48 : roadClass === 3 ? 42 : 34;
  }
  if (kind === "truck") {
    if (roadClass === 12) return 70; // Highway freight & pickup trucks
    if (roadClass === 3) return 48;  // Town avenue deliveries
    return 34;                       // Occasional neighborhood delivery truck
  }
  if (roadClass === 12) return 82; // Route 9 / major highway fast flow!
  if (roadClass === 3) return 56;  // Town avenue (Centre St, Beacon St, etc.)
  return 38;                       // Quiet neighborhood residential street
}

function normalizeAngleDeg(deg) {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  return a;
}

/**
 * Pick dominant cardinal sprite ("e" | "w" | "n" | "s") with hysteresis so cars on
 * ~45° diagonal streets never flicker between horizontal and vertical sprites, and
 * return residual sprite rotation in degrees for silky-smooth curve alignment!
 */
function resolveVehicleSpriteOrientation(dx, dy, prevDir = null) {
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  let dir = prevDir;

  // Apply gentle hysteresis (~10 deg) around the 45-degree diagonal threshold
  const prevHoriz = prevDir === "e" || prevDir === "w";
  const prevVert = prevDir === "n" || prevDir === "s";
  if (prevHoriz && absX >= absY * 0.82) {
    dir = dx >= 0 ? "e" : "w";
  } else if (prevVert && absY >= absX * 0.82) {
    dir = dy >= 0 ? "s" : "n";
  } else if (absX >= absY) {
    dir = dx >= 0 ? "e" : "w";
  } else {
    dir = dy >= 0 ? "s" : "n";
  }

  const baseDeg = CARDINAL_BASE_DEG[dir] || 0;
  let rotDeg = normalizeAngleDeg(angleDeg - baseDeg);
  // Clamp residual visual rotation neatly so 3/4 sprites always stay readable
  if (rotDeg > 52) rotDeg = 52;
  if (rotDeg < -52) rotDeg = -52;
  if (Math.abs(rotDeg) < 2.2) rotDeg = 0;

  return { dir, rotDeg: Math.round(rotDeg * 10) / 10, angleDeg };
}

// ============================================================================
// VECTOR ROAD GRAPH & RIGHT-HAND LANE FOLLOWER (ZERO SIDEWALK DRIVING!)
// ============================================================================

const vectorNetCache = new WeakMap();

function buildVectorTrafficNetwork(worldMap) {
  const vr = worldMap?.vectorRoads;
  if (!vr || !Array.isArray(vr.roads) || vr.roads.length === 0) return null;
  const cached = vectorNetCache.get(worldMap);
  if (cached) return cached;

  const tileSize = worldMap.tileSize || 16;
  const { width, height } = worldMap.dimensions;
  const worldW = width * tileSize;
  const worldH = height * tileSize;

  const roads = [];
  for (let i = 0; i < vr.roads.length; i++) {
    const raw = vr.roads[i];
    const flat = raw.pts || [];
    if (flat.length < 4) continue;
    const pts = [];
    for (let k = 0; k + 1 < flat.length; k += 2) {
      pts.push({ x: flat[k] * tileSize, y: flat[k + 1] * tileSize });
    }
    if (pts.length < 2) continue;

    const cumLen = [0];
    const segDirs = [];
    let totalLen = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const dx = pts[k + 1].x - pts[k].x;
      const dy = pts[k + 1].y - pts[k].y;
      const len = Math.hypot(dx, dy);
      totalLen += len;
      cumLen.push(totalLen);
      segDirs.push(len > 1e-5 ? { tx: dx / len, ty: dy / len, len } : { tx: 1, ty: 0, len: 0 });
    }
    if (totalLen < 12) continue;

    // Skip roads completely outside playable map interior
    const mid = pts[Math.floor(pts.length / 2)];
    if (mid.x < tileSize || mid.y < tileSize || mid.x > worldW - tileSize || mid.y > worldH - tileSize) {
      continue;
    }

    const roadClass = raw.cls === "highway" ? 12 : raw.cls === "main" ? 3 : 2;
    const widthPx = Math.max(10, (raw.widthTiles || 1.2) * tileSize);
    roads.push({
      idx: roads.length,
      id: raw.id || `vr_${i}`,
      name: raw.name || "",
      cls: raw.cls || "residential",
      roadClass,
      drivingSide: worldMap?.meta?.drivingSide || "right",
      oneway: Boolean(raw.oneway),
      roundabout: Boolean(raw.roundabout),
      lanes: Math.max(1, raw.lanes || 2),
      lanesFwd: Math.max(1, raw.lanesFwd || 1),
      lanesBwd: raw.oneway ? 0 : Math.max(1, raw.lanesBwd || 1),
      widthPx,
      halfWidthPx: widthPx * 0.5,
      pts,
      cumLen,
      segDirs,
      totalLen,
      start: pts[0],
      end: pts[pts.length - 1],
      startDir: segDirs[0],
      endDir: segDirs[segDirs.length - 1],
    });
  }

  // Spatial bucket index on road endpoints so vehicles turn seamlessly between connected polylines!
  const BUCKET = 18;
  const endpointBuckets = new Map();
  const addEndpoint = (roadIdx, isEnd, pt) => {
    const bx = Math.floor(pt.x / BUCKET);
    const by = Math.floor(pt.y / BUCKET);
    const key = `${bx},${by}`;
    let list = endpointBuckets.get(key);
    if (!list) {
      list = [];
      endpointBuckets.set(key, list);
    }
    list.push({ roadIdx, isEnd, x: pt.x, y: pt.y });
  };

  for (const r of roads) {
    addEndpoint(r.idx, false, r.start);
    addEndpoint(r.idx, true, r.end);
  }

  function findConnectedTransitions(
    curRoadIdx,
    arrivedAtEnd,
    curUx,
    curUy,
    preferredRoadClass,
    seed,
    kind = "car",
    subgrid = null
  ) {
    const curRoad = roads[curRoadIdx];
    if (!curRoad) return null;
    const fp = VEHICLE_FOOTPRINT[kind] || VEHICLE_FOOTPRINT.car;
    const pt = arrivedAtEnd ? curRoad.end : curRoad.start;
    const bx = Math.floor(pt.x / BUCKET);
    const by = Math.floor(pt.y / BUCKET);

    const candidates = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const list = endpointBuckets.get(`${bx + dx},${by + dy}`);
        if (!list) continue;
        for (const ep of list) {
          if (ep.roadIdx === curRoadIdx) continue;
          const dist = Math.hypot(ep.x - pt.x, ep.y - pt.y);
          // Only connect genuine shared intersection endpoints (never jump across non-road gaps!)
          if (dist > 6.5) continue;
          const nextRoad = roads[ep.roadIdx];
          if (!nextRoad) continue;
          if (nextRoad.widthPx < fp.minRoadW) continue;

          // Entering at start -> travel +1; entering at end -> travel -1 (only if two-way!)
          if (ep.isEnd && nextRoad.oneway) continue;
          const nextDirSign = ep.isEnd ? -1 : 1;
          const rawDir = ep.isEnd ? nextRoad.endDir : nextRoad.startDir;
          const nextUx = rawDir.tx * nextDirSign;
          const nextUy = rawDir.ty * nextDirSign;
          const dot = curUx * nextUx + curUy * nextUy;
          // Reject sharp U-turns onto adjacent opposing highway carriageway!
          if (dot < -0.45) continue;

          // Keep heavy highway traffic on highways/main connectors!
          if (preferredRoadClass === 12 && nextRoad.roadClass === 2) continue;
          // Keep big trucks on highways & full-width avenues (never squeezing onto narrow side streets!)
          if (kind === "truck" && nextRoad.roadClass === 2) continue;

          // Verify transition midpoint & landing pose stay strictly on paved road asphalt!
          if (subgrid) {
            const midX = (pt.x + ep.x) * 0.5;
            const midY = (pt.y + ep.y) * 0.5;
            if (!subgrid.isDrivableAtPx(midX, midY)) continue;
            const entryDist = nextDirSign > 0 ? Math.min(nextRoad.totalLen * 0.5, 6) : Math.max(nextRoad.totalLen * 0.5, nextRoad.totalLen - 6);
            const probePose = sampleVectorRoadPose(nextRoad, entryDist, nextDirSign, 0, kind, null, subgrid);
            if (!subgrid.isDrivableAtPx(probePose.x, probePose.y)) continue;
          }

          let score = dot * 1.4;
          if (curRoad.name && nextRoad.name && curRoad.name === nextRoad.name) score += 1.6;
          if (nextRoad.roadClass === preferredRoadClass) score += 0.9;
          if (nextRoad.roadClass === curRoad.roadClass) score += 0.5;
          // Slight deterministic jitter so cars naturally explore turns at intersections
          score += ((hash2(ep.roadIdx, curRoadIdx, seed) % 100) / 100) * 0.45;
          candidates.push({ roadIdx: ep.roadIdx, dirSign: nextDirSign, score });
        }
      }
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0];
  }

  const net = {
    roads,
    tileSize,
    worldW,
    worldH,
    findConnectedTransitions,
  };
  vectorNetCache.set(worldMap, net);
  return net;
}

/**
 * Compute lateral right-hand lane offset (in logical pixels, positive = right of travel direction)
 * using each vehicle's true road-contact width so cars, trucks, and bikes NEVER clip sidewalks or medians!
 */
function computeLaneOffsetPx(road, dirSign, laneSlot, kind, drivingSide = "right") {
  const sideSign = drivingSide === "left" ? -1 : 1;
  const halfW = road.halfWidthPx;
  const fp = VEHICLE_FOOTPRINT[kind] || VEHICLE_FOOTPRINT.car;
  // Keep outer wheels & body strictly inside the paved asphalt curb/median edge
  const edgeMargin = fp.edgeMargin;
  const maxSafeOffset = Math.max(0, halfW - edgeMargin);

  if (maxSafeOffset <= 0.25) {
    return 0;
  }

  if (road.oneway) {
    const laneCount = Math.max(1, road.lanes || 1);
    if (laneCount === 1) {
      if (kind === "bike") return sideSign * Math.min(maxSafeOffset, Math.max(0, halfW * 0.28));
      return 0;
    }
    const usable = maxSafeOffset * 2;
    const laneIdx = Math.abs(laneSlot) % laneCount;
    const rawOff = -usable * 0.5 + (usable * (laneIdx + 0.5)) / laneCount;
    return Math.max(-maxSafeOffset, Math.min(maxSafeOffset, rawOff));
  }

  // Two-way street: stay strictly on the country's travel side of the centerline
  // (positive = right-hand traffic like US/Israel; negative = left-hand traffic like UK/Japan/Australia!)
  const dirLanes = Math.max(1, dirSign > 0 ? road.lanesFwd : road.lanesBwd);
  if (dirLanes >= 2 && maxSafeOffset >= 6.0) {
    const innerEdge = 2.0;
    const span = Math.max(0, maxSafeOffset - innerEdge);
    const laneIdx = Math.abs(laneSlot) % dirLanes;
    const rawOff = innerEdge + (span * (laneIdx + 0.5)) / dirLanes;
    return sideSign * Math.max(0, Math.min(maxSafeOffset, rawOff));
  }

  // Single lane per direction (two-way avenue or residential street)
  if (kind === "bike") {
    return sideSign * Math.min(maxSafeOffset, Math.max(0, halfW * 0.48));
  }
  return sideSign * Math.min(maxSafeOffset, Math.max(0, halfW * 0.36));
}

/**
 * Sample a vehicle's exact pixel position, unit travel tangent, and sprite orientation
 * at distance `distAlong` along a vector road polyline with right-hand lane offset.
 * When `subgrid` is provided, automatically pulls inward if a curve, median, or curb pinch
 * would put the vehicle's wheels off paved asphalt!
 */
function sampleVectorRoadPose(road, distAlong, dirSign, laneSlot, kind, prevDir = null, subgrid = null) {
  const clampedDist = Math.max(0, Math.min(road.totalLen, distAlong));
  const cumLen = road.cumLen;
  const pts = road.pts;

  // Binary search for active segment
  let seg = 0;
  let lo = 0;
  let hi = cumLen.length - 2;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cumLen[mid] <= clampedDist && clampedDist <= cumLen[mid + 1]) {
      seg = mid;
      break;
    }
    if (cumLen[mid] < clampedDist) lo = mid + 1;
    else hi = mid - 1;
  }
  seg = Math.max(0, Math.min(pts.length - 2, seg));

  const segStart = cumLen[seg];
  const segInfo = road.segDirs[seg];
  const t = segInfo.len > 1e-5 ? Math.max(0, Math.min(1, (clampedDist - segStart) / segInfo.len)) : 0;

  const cx = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * t;
  const cy = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * t;

  const ux = segInfo.tx * dirSign;
  const uy = segInfo.ty * dirSign;
  // Right-hand normal in screen Y-down coords: East (1,0) -> South (0,1) = (-uy, ux)
  const rnx = -uy;
  const rny = ux;
  const desiredOffset = computeLaneOffsetPx(road, dirSign, laneSlot, kind, road.drivingSide || "right");

  let chosenOffset = desiredOffset;
  if (subgrid) {
    const fp = VEHICLE_FOOTPRINT[kind] || VEHICLE_FOOTPRINT.car;
    const tryOffsets =
      Math.abs(desiredOffset) > 0.25
        ? [
            desiredOffset,
            desiredOffset * 0.72,
            desiredOffset * 0.45,
            desiredOffset * 0.2,
            0,
            -Math.sign(desiredOffset) * 1.5,
            -Math.sign(desiredOffset) * 3.0,
          ]
        : [0, 1.5, -1.5, 3.0, -3.0];

    let found = false;
    for (const off of tryOffsets) {
      const tx = cx + rnx * off;
      const ty = cy + rny * off;
      if (isVehicleFootprintOnRoad(subgrid, tx, ty, ux, uy, kind)) {
        chosenOffset = off;
        found = true;
        break;
      }
    }
    if (!found) {
      // Fallback: pick offset closest to desired where both lateral wheel points stay drivable
      const lat = fp.halfLat;
      for (const off of tryOffsets) {
        const tx = cx + rnx * off;
        const ty = cy + rny * off;
        if (
          subgrid.isDrivableAtPx(tx, ty) &&
          subgrid.isDrivableAtPx(tx + rnx * lat, ty + rny * lat) &&
          subgrid.isDrivableAtPx(tx - rnx * lat, ty - rny * lat)
        ) {
          chosenOffset = off;
          found = true;
          break;
        }
      }
    }
    if (!found) {
      // Last resort: keep center on drivable asphalt
      for (const off of tryOffsets) {
        if (subgrid.isDrivableAtPx(cx + rnx * off, cy + rny * off)) {
          chosenOffset = off;
          break;
        }
      }
    }
  }

  const x = cx + rnx * chosenOffset;
  const y = cy + rny * chosenOffset;
  const orient = resolveVehicleSpriteOrientation(ux, uy, prevDir);

  return {
    x,
    y,
    dx: ux,
    dy: uy,
    dir: orient.dir,
    rotDeg: orient.rotDeg,
  };
}

// ============================================================================
// LEGACY TILE-GRID DIRECTION HELPER (fallback for synthetic maps without vectorRoads)
// ============================================================================

function pickAlignedDirection(base, width, height, tx, ty, tileId, h) {
  const validDirs = DIRS.filter((d) => isDrivable(base, width, height, tx + d.dx, ty + d.dy));
  if (validDirs.length === 0) return null;

  const sameClassLong = validDirs.filter(
    (d) =>
      base[(ty + d.dy) * width + (tx + d.dx)] === tileId &&
      isDrivable(base, width, height, tx + d.dx * 2, ty + d.dy * 2)
  );
  const pool = sameClassLong.length > 0 ? sameClassLong : validDirs;

  if (tileId === 12) {
    const hasE = pool.find((d) => d.name === "e");
    const hasW = pool.find((d) => d.name === "w");
    if (hasE && hasW) {
      const southIsMedian = base[(ty + 1) * width + tx] === 13 || base[(ty + 2) * width + tx] === 13;
      const northIsMedian = base[(ty - 1) * width + tx] === 13 || base[(ty - 2) * width + tx] === 13;
      if (southIsMedian && !northIsMedian) return hasW;
      if (northIsMedian && !southIsMedian) return hasE;
    }
  }
  return pool[h % pool.length];
}

// ============================================================================
// TRAFFIC SPAWNER
// ============================================================================

/**
 * Deterministically populate realistic traffic across Newton:
 *   - LOTS of bustling traffic (cars + big trucks) on highways (roadClass 12)
 *   - Moderate traffic (cars, trucks & annoying spandex bikers) on town avenues (roadClass 3)
 *   - Light occasional traffic (few cars & annoying bikers) on residential side streets (roadClass 2)
 */
export function buildRoadTraffic(worldMap, { spawnTile = null } = {}) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const tileSize = worldMap.tileSize || 16;
  const home = spawnTile || worldMap.origin?.spawnTile || { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  const homePxX = home.x * tileSize + tileSize / 2;
  const homePxY = home.y * tileSize + tileSize / 2;

  const vectorNet = buildVectorTrafficNetwork(worldMap);
  const subgrid = getNavigationSubgrid(worldMap);

  if (vectorNet && vectorNet.roads.length > 0) {
    const vehicles = [];
    const occupiedCells = new Set();

    const markNearPx = (x, y, radiusPx) => {
      const step = 16;
      const rCells = Math.ceil(radiusPx / step);
      const cx = Math.floor(x / step);
      const cy = Math.floor(y / step);
      for (let dy = -rCells; dy <= rCells; dy++) {
        for (let dx = -rCells; dx <= rCells; dx++) {
          occupiedCells.add(`${cx + dx},${cy + dy}`);
        }
      }
    };

    const isOccupiedPx = (x, y) => {
      const cx = Math.floor(x / 16);
      const cy = Math.floor(y / 16);
      return occupiedCells.has(`${cx},${cy}`);
    };

    const trySpawnOnVectorRoad = (road, distAlong, forcedKind = null, minSpacingPx = 64, seedOffset = 0) => {
      const h = hash2(road.idx * 31 + Math.round(distAlong), vehicles.length + seedOffset, 809);
      const dirSign = road.oneway ? 1 : h % 2 === 0 ? 1 : -1;
      const laneSlot = h >>> 3;

      let kind = forcedKind;
      if (!kind) {
        if (road.roadClass === 12) {
          kind = h % 8 < 3 ? "truck" : "car";
        } else if (road.roadClass === 3) {
          const mod = h % 10;
          kind = mod < 3 ? "bike" : mod < 5 ? "truck" : "car";
        } else {
          kind = h % 3 === 0 ? "bike" : "car";
        }
      }

      const fp = VEHICLE_FOOTPRINT[kind] || VEHICLE_FOOTPRINT.car;
      if (road.widthPx < fp.minRoadW) return false;

      const pose = sampleVectorRoadPose(road, distAlong, dirSign, laneSlot, kind, null, subgrid);
      // Keep well inside map edges and avoid crowding right on top of Liam's exact start tile!
      if (
        pose.x < tileSize * 2 ||
        pose.y < tileSize * 2 ||
        pose.x > vectorNet.worldW - tileSize * 2 ||
        pose.y > vectorNet.worldH - tileSize * 2
      ) {
        return false;
      }
      if (Math.hypot(pose.x - homePxX, pose.y - homePxY) < 28) return false;
      if (isOccupiedPx(pose.x, pose.y)) return false;

      // Double-check against the 4px subgrid so every spawned vehicle's FULL footprint sits strictly on paved road asphalt!
      if (subgrid && !isVehicleFootprintOnRoad(subgrid, pose.x, pose.y, pose.dx, pose.dy, kind)) return false;

      const variant = kind === "truck" ? h % 3 : kind === "bike" ? h % 2 : h % CAR_VARIANT_COUNT;
      vehicles.push({
        id: `${kind}_${vehicles.length}`,
        kind, // "car" | "truck" | "bike"
        variant,
        roadClass: road.roadClass,
        x: pose.x,
        y: pose.y,
        dir: pose.dir,
        rotDeg: pose.rotDeg,
        dx: pose.dx,
        dy: pose.dy,
        speed: getRoadSpeed(road.roadClass, kind),
        yielded: false,
        annoying: kind === "bike",
        animTimer: (h % 10) * 0.2,
        chantIndex: h % BIKER_CHANT_COUNT,
        bubbleTimer: kind === "bike" && h % 2 === 0 ? 1.8 : 0,
        bellCooldown: 0,
        // Vector-road spline tracking state
        vectorRoadIdx: road.idx,
        distAlong,
        dirSign,
        laneSlot,
      });
      markNearPx(pose.x, pose.y, minSpacingPx);
      return true;
    };

    const highwayRoads = vectorNet.roads.filter((r) => r.roadClass === 12);
    const mainRoads = vectorNet.roads.filter((r) => r.roadClass === 3);
    const resRoads = vectorNet.roads.filter((r) => r.roadClass === 2);

    // 1. HEAVY HIGHWAY TRAFFIC PASS: Bustling Route 9 & Hammond Pond Pkwy multi-lane flow!
    const hwSpacing = width >= 200 ? 74 : 68;
    for (const r of highwayRoads) {
      if (r.totalLen < 20) continue;
      for (let d = 14; d < r.totalLen - 10; d += hwSpacing) {
        const jitter = (hash2(r.idx, Math.round(d), 311) % 28) - 14;
        const pos = Math.max(8, Math.min(r.totalLen - 8, d + jitter));
        trySpawnOnVectorRoad(r, pos, null, 36, 1);
      }
    }

    // 2. Guarantee lively visibility right near Home Base (trucks on Route 9 + bikers on nearby streets!)
    let nearTrucks = 0;
    let nearBikes = 0;
    for (const r of highwayRoads) {
      if (nearTrucks >= 2) break;
      const mid = r.pts[Math.floor(r.pts.length / 2)];
      if (Math.hypot(mid.x - homePxX, mid.y - homePxY) < 380) {
        if (trySpawnOnVectorRoad(r, r.totalLen * 0.5, "truck", 42, 77)) nearTrucks++;
      }
    }
    for (const r of [...mainRoads, ...resRoads]) {
      if (nearBikes >= 2) break;
      const mid = r.pts[Math.floor(r.pts.length / 2)];
      if (Math.hypot(mid.x - homePxX, mid.y - homePxY) < 380) {
        if (trySpawnOnVectorRoad(r, r.totalLen * 0.5, "bike", 56, 91)) nearBikes++;
      }
    }

    // 3. MODERATE TOWN AVENUE TRAFFIC PASS (Centre St, Beacon St, Langley Rd, Ward St, Walnut St...)
    const mainSpacing = width >= 200 ? 230 : 140;
    for (const r of mainRoads) {
      if (r.totalLen < 32) continue;
      if (r.totalLen < mainSpacing) {
        if (hash2(r.idx, Math.round(r.totalLen), 211) % 3 === 0) {
          trySpawnOnVectorRoad(r, r.totalLen * 0.5, null, 92, 2);
        }
        continue;
      }
      for (let d = 28; d < r.totalLen - 20; d += mainSpacing) {
        const jitter = (hash2(r.idx, Math.round(d), 241) % 44) - 22;
        const pos = Math.max(14, Math.min(r.totalLen - 14, d + jitter));
        trySpawnOnVectorRoad(r, pos, null, 92, 3);
      }
    }

    // 4. LIGHT RESIDENTIAL SIDE-STREET TRAFFIC PASS (calm, realistic occasional cars & bikers)
    const resSpacing = width >= 200 ? 520 : 240;
    for (const r of resRoads) {
      if (r.totalLen < 78) continue;
      if (hash2(r.idx, Math.round(r.totalLen), 977) % 11 !== 0) continue;
      for (let d = 36; d < r.totalLen - 24; d += resSpacing) {
        trySpawnOnVectorRoad(r, d, null, 190, 4);
      }
    }

    return { vehicles, mode: "vector", vectorNet };
  }

  // --- LEGACY TILE-GRID FALLBACK (synthetic test maps without vectorRoads) ---
  const vehicles = [];
  const usedTiles = new Set();

  const markNear = (tx, ty, r = 4) => {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        usedTiles.add(`${tx + dx},${ty + dy}`);
      }
    }
  };

  const tryAddVehicle = (tx, ty, forcedKind = null, minSpacing = 5) => {
    if (tx < 2 || ty < 2 || tx >= width - 2 || ty >= height - 2) return false;
    if (usedTiles.has(`${tx},${ty}`)) return false;
    const tileId = base[ty * width + tx];
    if (tileId !== 2 && tileId !== 3 && tileId !== 12) return false;

    const h = hash2(tx, ty, 809 + vehicles.length);
    const chosenDir = pickAlignedDirection(base, width, height, tx, ty, tileId, h);
    if (!chosenDir) return false;

    let kind = forcedKind;
    if (!kind) {
      if (tileId === 12) kind = h % 8 < 3 ? "truck" : "car";
      else if (tileId === 3) {
        const mod = h % 10;
        kind = mod < 3 ? "bike" : mod < 5 ? "truck" : "car";
      } else {
        kind = h % 3 === 0 ? "bike" : "car";
      }
    }

    const variant = kind === "truck" ? h % 3 : kind === "bike" ? h % 2 : h % CAR_VARIANT_COUNT;
    vehicles.push({
      id: `${kind}_${vehicles.length}`,
      kind,
      variant,
      roadClass: tileId,
      x: tx * tileSize + tileSize / 2,
      y: ty * tileSize + tileSize / 2,
      dir: chosenDir.name,
      rotDeg: 0,
      dx: chosenDir.dx,
      dy: chosenDir.dy,
      speed: getRoadSpeed(tileId, kind),
      yielded: false,
      annoying: kind === "bike",
      animTimer: (h % 10) * 0.2,
      chantIndex: h % BIKER_CHANT_COUNT,
      bubbleTimer: kind === "bike" && h % 2 === 0 ? 1.8 : 0,
      bellCooldown: 0,
    });
    markNear(tx, ty, minSpacing);
    return true;
  };

  const hwStep = width >= 200 ? 7 : 6;
  for (let ty = 4; ty < height - 4; ty += 2) {
    for (let tx = 4; tx < width - 4; tx += hwStep) {
      const jitterX = hash2(tx, ty, 311) % 3;
      const sx = Math.min(width - 3, tx + jitterX);
      if (base[ty * width + sx] === 12) tryAddVehicle(sx, ty, null, 3);
      else if (base[(ty + 1) * width + sx] === 12) tryAddVehicle(sx, ty + 1, null, 3);
    }
  }

  let nearTrucks = 0;
  let nearBikes = 0;
  for (let r = 3; r <= 24 && (nearTrucks < 2 || nearBikes < 2); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = home.x + dx;
        const ty = home.y + dy;
        if (tx < 2 || ty < 2 || tx >= width - 2 || ty >= height - 2) continue;
        const tid = base[ty * width + tx];
        if (nearTrucks < 2 && tid === 12) {
          if (tryAddVehicle(tx, ty, "truck", 3)) nearTrucks++;
        } else if (nearBikes < 2 && (tid === 3 || tid === 2)) {
          if (tryAddVehicle(tx, ty, "bike", 5)) nearBikes++;
        }
      }
    }
  }

  const aveCell = width >= 200 ? 22 : 14;
  for (let cy0 = 6; cy0 < height - 6; cy0 += aveCell) {
    for (let cx0 = 6; cx0 < width - 6; cx0 += aveCell) {
      const cellW = Math.min(aveCell, width - 6 - cx0);
      const cellH = Math.min(aveCell, height - 6 - cy0);
      const sx = cx0 + (hash2(cx0, cy0, 211) % Math.max(1, cellW));
      const sy = cy0 + (hash2(cx0, cy0, 241) % Math.max(1, cellH));
      let placed = false;
      for (let r = 0; r <= 9 && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = sx + dx;
            const ty = sy + dy;
            if (tx < cx0 || tx >= cx0 + cellW || ty < cy0 || ty >= cy0 + cellH) continue;
            if (base[ty * width + tx] === 3 && tryAddVehicle(tx, ty, null, 6)) placed = true;
          }
        }
      }
    }
  }

  const sideCell = width >= 200 ? 48 : 22;
  for (let cy0 = 8; cy0 < height - 8; cy0 += sideCell) {
    for (let cx0 = 8; cx0 < width - 8; cx0 += sideCell) {
      if (hash2(cx0, cy0, 977) % 10 < 3) continue;
      const cellW = Math.min(sideCell, width - 8 - cx0);
      const cellH = Math.min(sideCell, height - 8 - cy0);
      const sx = cx0 + (hash2(cx0, cy0, 503) % Math.max(1, cellW));
      const sy = cy0 + (hash2(cx0, cy0, 541) % Math.max(1, cellH));
      let placed = false;
      for (let r = 0; r <= 12 && !placed; r++) {
        for (let dy = -r; dy <= r && !placed; dy++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = sx + dx;
            const ty = sy + dy;
            if (tx < cx0 || tx >= cx0 + cellW || ty < cy0 || ty >= cy0 + cellH) continue;
            if (base[ty * width + tx] === 2 && tryAddVehicle(tx, ty, null, 12)) placed = true;
          }
        }
      }
    }
  }

  return { vehicles, mode: "tile" };
}

/**
 * Check if any moving road car, truck, or annoying biker collides directly with Liam's hitbox!
 * Uses an oriented bounding box (OBB) aligned with each vehicle's true driving direction so
 * angled/curved road vehicles never clip Liam while he is safely walking on the sidewalk!
 */
export function checkTrafficCollision(traffic, playerState) {
  if (!traffic || !Array.isArray(traffic.vehicles) || !playerState) return null;
  const px = playerState.x;
  const py = playerState.y;

  for (const v of traffic.vehicles) {
    const relX = px - v.x;
    if (Math.abs(relX) > 20) continue;
    const relY = py - v.y;
    if (Math.abs(relY) > 20) continue;

    const rawDx = v.dx || 0;
    const rawDy = v.dy || 0;
    const len = Math.hypot(rawDx, rawDy);
    const ux = len > 1e-5 ? rawDx / len : 1;
    const uy = len > 1e-5 ? rawDy / len : 0;
    const along = Math.abs(relX * ux + relY * uy);
    const across = Math.abs(relX * -uy + relY * ux);

    let halfLen;
    let halfLat;
    if (v.kind === "bike") {
      halfLen = 9.5;
      halfLat = 5.5;
    } else if (v.kind === "truck") {
      halfLen = 15.5;
      halfLat = 7.5;
    } else {
      halfLen = 12.5;
      halfLat = 6.5;
    }
    if (along < halfLen + 2.5 && across < halfLat + 2.0) {
      return { vehicle: v, kind: v.kind };
    }
  }
  return null;
}

/**
 * Advance nearby cars, trucks & annoying spandex bikers along Newton's road network and detect road hits!
 */
export function updateRoadTraffic(
  traffic,
  dt,
  playerState,
  worldMap,
  { tileSize = 16, safeCrossingActive = false, onHitPlayer = null, onBikerAnnoy = null } = {}
) {
  if (!traffic || !Array.isArray(traffic.vehicles)) return null;
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const subgrid = getNavigationSubgrid(worldMap);
  const vectorNet = traffic.vectorNet || (traffic.mode === "vector" ? buildVectorTrafficNetwork(worldMap) : null);
  const px = playerState.x;
  const py = playerState.y;

  const isPlayerOnCrosswalk = () => {
    if (subgrid && subgrid.hasVectorRoads) {
      return subgrid.getSurfaceIdAtPx(px, py) === 4;
    }
    const ptx = Math.floor(px / tileSize);
    const pty = Math.floor(py / tileSize);
    return ptx >= 0 && pty >= 0 && ptx < width && pty < height && base[pty * width + ptx] === 4;
  };
  const playerOnCrosswalk = safeCrossingActive ? isPlayerOnCrosswalk() : false;

  for (const v of traffic.vehicles) {
    const adx = Math.abs(px - v.x);
    if (adx > 460) continue;
    const ady = Math.abs(py - v.y);
    if (ady > 460) continue;
    const distToPlayer = Math.hypot(adx, ady);
    if (distToPlayer > 460) continue;

    if (v.kind === "bike") {
      v.animTimer = (v.animTimer || 0) + dt * 9;
      if (v.bubbleTimer > 0) v.bubbleTimer = Math.max(0, v.bubbleTimer - dt);
      if (v.bellCooldown > 0) v.bellCooldown = Math.max(0, v.bellCooldown - dt);

      // Annoying bikers aggressively ring their bell & shout cyclist slogans whenever near Liam!
      if (distToPlayer < 82 && v.bellCooldown <= 0) {
        v.chantIndex = (v.chantIndex + 1) % BIKER_CHANT_COUNT;
        v.bubbleTimer = 2.4;
        v.bellCooldown = 3.2;
        onBikerAnnoy?.(v);
      } else if (distToPlayer < 170 && v.bubbleTimer <= 0 && Math.floor(v.animTimer) % 19 === 0) {
        v.chantIndex = (v.chantIndex + 1) % BIKER_CHANT_COUNT;
        v.bubbleTimer = 1.8;
      }
    }

    // Cars & trucks politely yield at crosswalks ONLY if Liam Looked Both Ways!
    // Annoying spandex bikers NEVER yield politely — they yell "ON YOUR LEFT!" and sprint right through!
    v.yielded = false;
    if (v.kind !== "bike" && playerOnCrosswalk && distToPlayer < 58) {
      const lenV = Math.hypot(v.dx || 0, v.dy || 0);
      const vux = lenV > 1e-5 ? (v.dx || 0) / lenV : 1;
      const vuy = lenV > 1e-5 ? (v.dy || 0) / lenV : 0;
      const aheadDot = (px - v.x) * vux + (py - v.y) * vuy;
      const lateral = Math.abs((px - v.x) * -vuy + (py - v.y) * vux);
      if (aheadDot > -4 && lateral < 24) {
        v.yielded = true;
        continue;
      }
    }
    // Queue politely behind another yielded car/truck directly ahead in the same lane!
    if (v.kind !== "bike" && playerOnCrosswalk && distToPlayer < 120) {
      const lenV = Math.hypot(v.dx || 0, v.dy || 0);
      const vux = lenV > 1e-5 ? (v.dx || 0) / lenV : 1;
      const vuy = lenV > 1e-5 ? (v.dy || 0) / lenV : 0;
      let blockedByYielded = false;
      for (const other of traffic.vehicles) {
        if (other === v || !other.yielded) continue;
        const odx = other.x - v.x;
        const ody = other.y - v.y;
        if (Math.abs(odx) > 46 || Math.abs(ody) > 46) continue;
        const oAhead = odx * vux + ody * vuy;
        const oLat = Math.abs(odx * -vuy + ody * vux);
        if (oAhead > 4 && oAhead < 42 && oLat < 12) {
          blockedByYielded = true;
          break;
        }
      }
      if (blockedByYielded) {
        v.yielded = true;
        continue;
      }
    }

    const bikerSprintBoost = v.kind === "bike" && distToPlayer < 95 ? 1.2 : 1.0;

    // --- VECTOR ROAD SPLINE MOVEMENT (100% ON PAVED LANES, ZERO SIDEWALK DRIVING!) ---
    if (vectorNet && typeof v.vectorRoadIdx === "number") {
      let road = vectorNet.roads[v.vectorRoadIdx];
      if (!road) continue;

      const prevRoadIdx = v.vectorRoadIdx;
      const prevDistAlong = v.distAlong;
      const prevDirSign = v.dirSign;

      const targetSpeed = getRoadSpeed(road.roadClass, v.kind) * bikerSprintBoost;
      v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 6);
      let remaining = v.speed * dt;
      let hops = 0;

      while (remaining > 0.01 && hops < 4) {
        hops++;
        const nextDist = v.distAlong + v.dirSign * remaining;
        if (nextDist >= 0 && nextDist <= road.totalLen) {
          v.distAlong = nextDist;
          remaining = 0;
        } else {
          const arrivedAtEnd = nextDist > road.totalLen;
          const overshoot = arrivedAtEnd ? nextDist - road.totalLen : -nextDist;
          const curDir = arrivedAtEnd ? road.endDir : road.startDir;
          const curUx = curDir.tx * v.dirSign;
          const curUy = curDir.ty * v.dirSign;

          const trans = vectorNet.findConnectedTransitions(
            road.idx,
            arrivedAtEnd,
            curUx,
            curUy,
            v.roadClass,
            Math.floor(v.x + v.y) + hops * 17,
            v.kind,
            subgrid
          );
          if (trans) {
            road = vectorNet.roads[trans.roadIdx];
            v.vectorRoadIdx = road.idx;
            v.dirSign = trans.dirSign;
            v.distAlong = v.dirSign > 0 ? Math.min(road.totalLen, overshoot) : Math.max(0, road.totalLen - overshoot);
            remaining = 0;
          } else if (!road.oneway) {
            // Smooth turnaround at cul-de-sac / dead-end onto opposite right-hand lane
            v.dirSign = -v.dirSign;
            v.distAlong = arrivedAtEnd ? Math.max(0, road.totalLen - overshoot) : Math.min(road.totalLen, overshoot);
            remaining = 0;
          } else {
            // Continuous flow wrap-around at one-way highway boundary
            v.distAlong = arrivedAtEnd ? Math.min(road.totalLen, overshoot) : Math.max(0, road.totalLen - overshoot);
            remaining = 0;
          }
        }
      }

      let pose = sampleVectorRoadPose(road, v.distAlong, v.dirSign, v.laneSlot, v.kind, v.dir, subgrid);
      // Guard against building-clipped dead-end road tips or non-drivable spots: cleanly turn back on paved asphalt!
      if (subgrid && !subgrid.isDrivableAtPx(pose.x, pose.y)) {
        road = vectorNet.roads[prevRoadIdx] || road;
        v.vectorRoadIdx = road.idx;
        if (!road.oneway) {
          v.dirSign = -prevDirSign;
          v.distAlong = Math.max(0, Math.min(road.totalLen, prevDistAlong));
        } else {
          v.dirSign = prevDirSign;
          v.distAlong = Math.max(0, Math.min(road.totalLen, road.totalLen * 0.5));
        }
        pose = sampleVectorRoadPose(road, v.distAlong, v.dirSign, v.laneSlot, v.kind, v.dir, subgrid);
      }
      if (!subgrid || subgrid.isDrivableAtPx(pose.x, pose.y)) {
        v.x = pose.x;
        v.y = pose.y;
        v.dx = pose.dx;
        v.dy = pose.dy;
        v.dir = pose.dir;
        v.rotDeg = pose.rotDeg;
      }
      continue;
    }

    // --- LEGACY TILE-GRID MOVEMENT FALLBACK ---
    const curTx = Math.floor(v.x / tileSize);
    const curTy = Math.floor(v.y / tileSize);
    const curTile = curTx >= 0 && curTy >= 0 && curTx < width && curTy < height ? base[curTy * width + curTx] : 0;

    const targetSpeed = getRoadSpeed(curTile || 2, v.kind) * bikerSprintBoost;
    v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 6);
    const step = v.speed * dt;
    const nx = v.x + v.dx * step;
    const ny = v.y + v.dy * step;

    const noseLook = v.kind === "truck" ? 8 : 6;
    const lookX = nx + v.dx * noseLook;
    const lookY = ny + v.dy * noseLook;
    const ltx = Math.floor(lookX / tileSize);
    const lty = Math.floor(lookY / tileSize);

    const nextTile = ltx >= 0 && lty >= 0 && ltx < width && lty < height ? base[lty * width + ltx] : 0;
    const canContinue =
      isDrivable(base, width, height, ltx, lty) &&
      (v.roadClass !== 12 || nextTile === 12 || nextTile === 4 || nextTile === 3);

    if (canContinue) {
      v.x = nx;
      v.y = ny;
      const centerX = Math.floor(v.x / tileSize) * tileSize + tileSize / 2;
      const centerY = Math.floor(v.y / tileSize) * tileSize + tileSize / 2;
      if (v.dx !== 0) {
        v.y += (centerY - v.y) * Math.min(1, dt * 6);
      } else {
        v.x += (centerX - v.x) * Math.min(1, dt * 6);
      }
    } else {
      const perp = DIRS.filter((d) => {
        if ((d.dx === v.dx && d.dy === v.dy) || (d.dx === -v.dx && d.dy === -v.dy)) return false;
        const ntx = curTx + d.dx;
        const nty = curTy + d.dy;
        if (!isDrivable(base, width, height, ntx, nty)) return false;
        if (v.roadClass === 12) {
          const nt = base[nty * width + ntx];
          return nt === 12 || nt === 4;
        }
        return true;
      });
      if (perp.length > 0) {
        const pick = perp[hash2(curTx, curTy, Math.floor(v.x + v.y)) % perp.length];
        v.dir = pick.name;
        v.dx = pick.dx;
        v.dy = pick.dy;
        v.x = curTx * tileSize + tileSize / 2;
        v.y = curTy * tileSize + tileSize / 2;
      } else {
        const rev = DIRS.find((d) => d.dx === -v.dx && d.dy === -v.dy);
        if (rev) {
          v.dir = rev.name;
          v.dx = rev.dx;
          v.dy = rev.dy;
        }
      }
    }
  }

  const hit = checkTrafficCollision(traffic, playerState);
  if (hit) {
    onHitPlayer?.(hit);
    return hit;
  }
  return null;
}
