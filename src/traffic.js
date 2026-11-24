/**
 * Moving Road Traffic System (Cars, Trucks & Annoying Spandex Bikers on Newton's Roads):
 *   - HEAVY multi-lane traffic on the Highway (tileId 12: Route 9 / Boylston St & Hammond Pond Pkwy)
 *     packed with fast cars, SUVs, pickup trucks & freight box delivery trucks!
 *   - Moderate traffic on Town Avenues (tileId 3: Centre St, Beacon St, Langley Rd, etc.).
 *   - Light, realistic occasional traffic on residential side streets (tileId 2).
 *   - Strictly stays on drivable road tiles (2, 3, 4, 12) — never drives onto sidewalks,
 *     grass, or highway median barriers (13).
 *   - Cars & trucks politely slow/yield at crosswalks when Liam has actively Looked Both Ways
 *     (safeCrossingActive). Annoying spandex bikers DO NOT yield politely — they ring their bell
 *     obnoxiously ("DING-DING-DING!!"), shout cyclist chants ("ON YOUR LEFT!", "STRAVA PR!"),
 *     and sprint right past!
 *   - Getting hit triggers the dramatic Cool Ambulance + EMT Stretcher -> Mom Grounded Forever -> GAME OVER cutscene!
 *
 * Pure JS (zero DOM dependencies) so it runs in headless Node unit tests too.
 */

const DRIVABLE_TILES = new Set([2, 3, 4, 12]);
const DIRS = [
  { name: "e", dx: 1, dy: 0 },
  { name: "w", dx: -1, dy: 0 },
  { name: "s", dx: 0, dy: 1 },
  { name: "n", dx: 0, dy: -1 },
];

export const BIKER_CHANT_COUNT = 5;
export const CAR_VARIANT_COUNT = 10;

function hash2(x, y, seed = 41) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

function isDrivable(base, width, height, tx, ty) {
  if (tx < 1 || ty < 1 || tx >= width - 1 || ty >= height - 1) return false;
  return DRIVABLE_TILES.has(base[ty * width + tx]);
}

function getRoadSpeed(tileId, kind) {
  if (kind === "bike") {
    return tileId === 12 ? 48 : tileId === 3 ? 42 : 34;
  }
  if (kind === "truck") {
    if (tileId === 12) return 70; // Highway freight & pickup trucks
    if (tileId === 3) return 48;  // Town avenue deliveries
    return 34;                    // Occasional neighborhood delivery truck
  }
  if (tileId === 12) return 82; // Route 9 / major highway fast flow!
  if (tileId === 3) return 56;  // Town avenue (Centre St, Beacon St, etc.)
  return 38;                    // Quiet neighborhood residential street
}

/**
 * Pick a clean lane-aligned initial direction so highway & avenue vehicles flow naturally along the roadway.
 */
function pickAlignedDirection(base, width, height, tx, ty, tileId, h) {
  const validDirs = DIRS.filter((d) => isDrivable(base, width, height, tx + d.dx, ty + d.dy));
  if (validDirs.length === 0) return null;

  // Prefer directions that continue along the same road class for at least 2 tiles
  const sameClassLong = validDirs.filter(
    (d) =>
      base[(ty + d.dy) * width + (tx + d.dx)] === tileId &&
      isDrivable(base, width, height, tx + d.dx * 2, ty + d.dy * 2)
  );
  const pool = sameClassLong.length > 0 ? sameClassLong : validDirs;

  // On Route 9 / E-W highways, keep upper lane westbound and lower lane eastbound where median 13 separates them!
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

/**
 * Deterministically populate realistic traffic across Newton:
 *   - LOTS of bustling traffic (cars + big trucks) on highways (tileId 12)
 *   - Moderate traffic (cars, trucks & annoying spandex bikers) on town avenues (tileId 3)
 *   - Light occasional traffic (few cars & annoying bikers) on residential side streets (tileId 2)
 */
export function buildRoadTraffic(worldMap, { spawnTile = null } = {}) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const tileSize = worldMap.tileSize || 16;
  const home = spawnTile || worldMap.origin?.spawnTile || { x: Math.floor(width / 2), y: Math.floor(height / 2) };

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
      if (tileId === 12) {
        // Highway: heavy mix of fast cars/SUVs (~62%) and big pickup/delivery box trucks (~38%)
        kind = h % 8 < 3 ? "truck" : "car";
      } else if (tileId === 3) {
        // Town Avenues: cars, occasional trucks, and plenty of annoying spandex bikers!
        const mod = h % 10;
        kind = mod < 3 ? "bike" : mod < 5 ? "truck" : "car";
      } else {
        // Side streets: light mix of neighborhood cars and annoying bikers
        kind = h % 3 === 0 ? "bike" : "car";
      }
    }

    const variant = kind === "truck" ? h % 3 : kind === "bike" ? h % 2 : h % CAR_VARIANT_COUNT;
    vehicles.push({
      id: `${kind}_${vehicles.length}`,
      kind, // "car" | "truck" | "bike"
      variant,
      roadClass: tileId,
      x: tx * tileSize + tileSize / 2,
      y: ty * tileSize + tileSize / 2,
      dir: chosenDir.name,
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

  // 1. HEAVY HIGHWAY TRAFFIC PASS: Pack Route 9 / Boylston St & Hammond Pond Pkwy (tileId === 12)
  //    with a steady, bustling stream of cars, SUVs, pickup trucks & box delivery trucks!
  const hwStep = width >= 200 ? 7 : 6;
  for (let ty = 4; ty < height - 4; ty += 2) {
    for (let tx = 4; tx < width - 4; tx += hwStep) {
      const jitterX = hash2(tx, ty, 311) % 3;
      const sx = Math.min(width - 3, tx + jitterX);
      if (base[ty * width + sx] === 12) {
        tryAddVehicle(sx, ty, null, 3);
      } else if (base[(ty + 1) * width + sx] === 12) {
        tryAddVehicle(sx, ty + 1, null, 3);
      }
    }
  }

  // 2. Guarantee lively visibility right near Home Base (highway cars + trucks + an annoying biker on nearby streets!)
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

  // 3. MODERATE TOWN AVENUE TRAFFIC PASS (tileId === 3: Centre St, Beacon St, Langley Rd, Cypress St, etc.)
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
            if (base[ty * width + tx] === 3 && tryAddVehicle(tx, ty, null, 6)) {
              placed = true;
            }
          }
        }
      }
    }
  }

  // 4. LIGHT SIDE-STREET TRAFFIC PASS (tileId === 2: quiet residential streets — much less traffic, but still some!)
  const sideCell = width >= 200 ? 48 : 22;
  for (let cy0 = 8; cy0 < height - 8; cy0 += sideCell) {
    for (let cx0 = 8; cx0 < width - 8; cx0 += sideCell) {
      // Skip ~35% of residential cells so side streets feel calm & realistic
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
            if (base[ty * width + tx] === 2 && tryAddVehicle(tx, ty, null, 12)) {
              placed = true;
            }
          }
        }
      }
    }
  }

  return { vehicles };
}

/**
 * Check if any moving road car, truck, or annoying biker collides directly with Liam's hitbox!
 */
export function checkTrafficCollision(traffic, playerState) {
  if (!traffic || !Array.isArray(traffic.vehicles) || !playerState) return null;
  const px = playerState.x;
  const py = playerState.y;

  for (const v of traffic.vehicles) {
    const adx = Math.abs(px - v.x);
    if (adx > 20) continue;
    const ady = Math.abs(py - v.y);
    if (ady > 20) continue;
    const horiz = v.dir === "e" || v.dir === "w";
    let halfW;
    let halfH;
    if (v.kind === "bike") {
      halfW = horiz ? 10 : 6;
      halfH = horiz ? 7 : 10;
    } else if (v.kind === "truck") {
      halfW = horiz ? 16 : 9;
      halfH = horiz ? 8 : 15;
    } else {
      halfW = horiz ? 13 : 8;
      halfH = horiz ? 7 : 12;
    }
    if (adx < halfW + 3 && ady < halfH + 3) {
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
  const px = playerState.x;
  const py = playerState.y;

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

    const curTx = Math.floor(v.x / tileSize);
    const curTy = Math.floor(v.y / tileSize);
    const curTile = curTx >= 0 && curTy >= 0 && curTx < width && curTy < height ? base[curTy * width + curTx] : 0;

    // Cars & trucks politely yield at crosswalks ONLY if Liam Looked Both Ways!
    // Annoying spandex bikers NEVER yield politely — they yell "ON YOUR LEFT!" and sprint right through!
    v.yielded = false;
    if (v.kind !== "bike" && safeCrossingActive && distToPlayer < 52 && distToPlayer > 16) {
      const aheadDot = (px - v.x) * v.dx + (py - v.y) * v.dy;
      const lateral = Math.abs((px - v.x) * -v.dy + (py - v.y) * v.dx);
      const playerTx = Math.floor(px / tileSize);
      const playerTy = Math.floor(py / tileSize);
      const pTile =
        playerTx >= 0 && playerTy >= 0 && playerTx < width && playerTy < height
          ? base[playerTy * width + playerTx]
          : 0;
      if (aheadDot > 0 && lateral < 20 && pTile === 4) {
        v.yielded = true;
        continue;
      }
    }

    // Annoying bikers even kick up a cheeky Strava sprint when passing near Liam!
    const bikerSprintBoost = v.kind === "bike" && distToPlayer < 95 ? 1.2 : 1.0;
    const targetSpeed = getRoadSpeed(curTile || 2, v.kind) * bikerSprintBoost;
    v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 6);
    const step = v.speed * dt;
    const nx = v.x + v.dx * step;
    const ny = v.y + v.dy * step;

    // Look slightly ahead of vehicle nose to stay cleanly centered on drivable road tiles
    const noseLook = v.kind === "truck" ? 8 : 6;
    const lookX = nx + v.dx * noseLook;
    const lookY = ny + v.dy * noseLook;
    const ltx = Math.floor(lookX / tileSize);
    const lty = Math.floor(lookY / tileSize);

    // Keep highway traffic strictly on highway/crosswalk tiles so heavy Route 9 flow doesn't flood quiet side streets!
    const nextTile = ltx >= 0 && lty >= 0 && ltx < width && lty < height ? base[lty * width + ltx] : 0;
    const canContinue =
      isDrivable(base, width, height, ltx, lty) &&
      (v.roadClass !== 12 || nextTile === 12 || nextTile === 4 || nextTile === 3);

    if (canContinue) {
      v.x = nx;
      v.y = ny;
      // Gently pull toward lane center along the perpendicular axis
      const centerX = Math.floor(v.x / tileSize) * tileSize + tileSize / 2;
      const centerY = Math.floor(v.y / tileSize) * tileSize + tileSize / 2;
      if (v.dx !== 0) {
        v.y += (centerY - v.y) * Math.min(1, dt * 6);
      } else {
        v.x += (centerX - v.x) * Math.min(1, dt * 6);
      }
    } else {
      // Pick a valid turn (perpendicular preferred before reversing cleanly at dead ends!)
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
        // Reverse direction cleanly
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
