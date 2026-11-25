/**
 * Realistic 32-Bit Parked Car Generator for Newton Parking Lots (tileId === 8)
 *
 * Uses the exact same 32-bit hero-grade vehicles (`traffic_car_0..9` + `traffic_truck_0`
 * crew-cab pickup from `src/vehicles32bit.js`) that drive on the streets, neatly arranged
 * inside parking bays with clean driving aisles, realistic ~70% lot occupancy, and zero
 * overlap between parked vehicles or surrounding curbs/buildings.
 *
 * Pure JS (zero DOM dependencies) so it can be thoroughly unit tested in Node.
 */

import { getNavigationSubgrid } from "./subgrid.js";

const PARKING_LOT_TILE = 8;

// Weighted civilian vehicle mix (10 realistic cars/SUVs/minivans/EVs + pickup truck; rare taxi)
const PARKED_VEHICLE_POOL = [
  { kind: "car", variant: 0 }, // Crimson sports sedan
  { kind: "car", variant: 1 }, // Cobalt family SUV
  { kind: "car", variant: 1 }, // Cobalt family SUV (popular in Newton!)
  { kind: "car", variant: 3 }, // Emerald Subaru station wagon
  { kind: "car", variant: 3 }, // Emerald Subaru station wagon (very Newton!)
  { kind: "car", variant: 4 }, // Midnight-blue EV fastback
  { kind: "car", variant: 4 }, // Midnight-blue EV fastback
  { kind: "car", variant: 5 }, // Sunset-orange Jeep Wrangler
  { kind: "car", variant: 6 }, // Mint-teal & cream classic Beetle
  { kind: "car", variant: 7 }, // Pearl-white family minivan
  { kind: "car", variant: 7 }, // Pearl-white family minivan
  { kind: "car", variant: 8 }, // Racing-silver convertible roadster
  { kind: "car", variant: 9 }, // Plum-burgundy sport hatchback
  { kind: "truck", variant: 0 }, // Crew-cab pickup truck
  { kind: "car", variant: 2 }, // Occasional yellow cab
];

// Logical footprint sizes (native 2x pixel dims * 0.5 scale) with slight breathing buffer
function getFootprint(kind, dir) {
  const isVertical = dir === "n" || dir === "s";
  if (kind === "truck") {
    return isVertical ? { w: 20, h: 34 } : { w: 35, h: 20 };
  }
  return isVertical ? { w: 19, h: 31 } : { w: 33, h: 20 };
}

function hash2(x, y, seed = 41) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

/**
 * Deterministically populate parking lots (`tileId === 8`) with realistic 32-bit parked cars
 * matching the moving street vehicles.
 */
export function buildParkingLotCars(
  worldMap,
  { parkOccupiedGrid = null, graveyardGrid = null, spawnTile = null, landmarks = [] } = {}
) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const tileSize = worldMap.tileSize || 16;
  const subgrid = getNavigationSubgrid(worldMap);
  const useSub = Boolean(subgrid && subgrid.hasVectorRoads);

  const isParkingTile = (tx, ty) => {
    if (tx < 1 || ty < 1 || tx >= width - 1 || ty >= height - 1) return false;
    const idx = ty * width + tx;
    if (base[idx] !== PARKING_LOT_TILE) return false;
    if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) return false;
    if (graveyardGrid && graveyardGrid[idx] !== 0) return false;
    if (useSub && subgrid.isRoadAtPx(tx * tileSize + tileSize * 0.5, ty * tileSize + tileSize * 0.5)) {
      return false;
    }
    return true;
  };

  // Protected walk/spawn tiles so parked cars never visually sit on an NPC/landmark interaction spot
  const protectedSpots = [];
  if (spawnTile) protectedSpots.push({ x: spawnTile.x, y: spawnTile.y });
  for (const lm of landmarks || []) {
    const lx = lm.walkTileX ?? lm.tileX;
    const ly = lm.walkTileY ?? lm.tileY;
    if (typeof lx === "number" && typeof ly === "number") {
      protectedSpots.push({ x: lx, y: ly });
    }
  }
  const nearProtected = (px, py) => {
    const tx = px / tileSize;
    const ty = py / tileSize;
    for (const s of protectedSpots) {
      if (Math.hypot(tx - (s.x + 0.5), ty - (s.y + 0.5)) < 1.8) return true;
    }
    return false;
  };

  // Flood-fill connected parking-lot components so every lot gets coherent stall geometry & aisles
  const visited = new Uint8Array(width * height);
  const lots = [];
  for (let ty = 1; ty < height - 1; ty++) {
    for (let tx = 1; tx < width - 1; tx++) {
      const idx = ty * width + tx;
      if (visited[idx] || !isParkingTile(tx, ty)) continue;
      const queue = [[tx, ty]];
      visited[idx] = 1;
      let minX = tx;
      let maxX = tx;
      let minY = ty;
      let maxY = ty;
      let cellCount = 0;
      while (queue.length > 0) {
        const [cx, cy] = queue.pop();
        cellCount++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        const neigh = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neigh) {
          if (nx < 1 || ny < 1 || nx >= width - 1 || ny >= height - 1) continue;
          const nIdx = ny * width + nx;
          if (!visited[nIdx] && isParkingTile(nx, ny)) {
            visited[nIdx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
      lots.push({ id: lots.length, minX, maxX, minY, maxY, cellCount });
    }
  }

  const parkedCars = [];
  const placedBoxes = [];

  const fitsCleanlyInLot = (cx, cy, w, h) => {
    // Every corner & center sample of the car footprint must remain strictly on parking-lot asphalt
    const hw = w * 0.44;
    const hh = h * 0.44;
    const samples = [
      [cx, cy],
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx - hw, cy + hh],
      [cx + hw, cy + hh],
      [cx - hw, cy],
      [cx + hw, cy],
      [cx, cy - hh],
      [cx, cy + hh],
    ];
    for (const [sx, sy] of samples) {
      if (!isParkingTile(Math.floor(sx / tileSize), Math.floor(sy / tileSize))) {
        return false;
      }
      if (useSub && (subgrid.isRoadAtPx(sx, sy) || subgrid.isSolidAtSub(Math.floor(sx / subgrid.subCellSize), Math.floor(sy / subgrid.subCellSize)))) {
        return false;
      }
    }
    if (nearProtected(cx, cy)) return false;

    // Never overlap another parked car (with crisp 3px door-opening clearance!)
    const padX = 2.5;
    const padY = 2.5;
    for (const b of placedBoxes) {
      if (
        Math.abs(cx - b.cx) < (w + b.w) * 0.5 + padX &&
        Math.abs(cy - b.cy) < (h + b.h) * 0.5 + padY
      ) {
        return false;
      }
    }
    return true;
  };

  const tryPlaceCar = (cx, cy, dir, lotId, seedSalt) => {
    const h = hash2(Math.round(cx), Math.round(cy), 701 + seedSalt + lotId * 17);
    // ~72% occupancy: bustling, realistic Newton parking lots with natural open spaces!
    if (h % 100 >= 72) return false;
    const pick = PARKED_VEHICLE_POOL[(h >>> 7) % PARKED_VEHICLE_POOL.length];
    // Slight natural human parking offset (±1px)
    const jitterX = ((h >>> 11) % 3) - 1;
    const jitterY = ((h >>> 13) % 3) - 1;
    const fx = Math.round(cx + jitterX);
    const fy = Math.round(cy + jitterY);
    const fp = getFootprint(pick.kind, dir);
    if (!fitsCleanlyInLot(fx, fy, fp.w, fp.h)) return false;

    const sprite =
      pick.kind === "truck"
        ? `traffic_truck_${pick.variant}_${dir}`
        : `traffic_car_${pick.variant}_${dir}`;
    parkedCars.push({
      tx: Math.floor(fx / tileSize),
      ty: Math.floor(fy / tileSize),
      x: fx,
      y: fy,
      dir,
      kind: pick.kind,
      variant: pick.variant,
      sprite,
      lotId,
    });
    placedBoxes.push({ cx: fx, cy: fy, w: fp.w, h: fp.h });
    return true;
  };

  for (const lot of lots) {
    const lotW = lot.maxX - lot.minX + 1;
    const lotH = lot.maxY - lot.minY + 1;
    if (lot.cellCount < 2) continue;

    // Decide stall orientation: narrow vertical lots park E/W; standard & wide lots park N/S in neat bays
    const preferEW = (lotW <= 3 && lotH >= 4) || (lotH === 1 && lotW >= 2);
    const lotStartCount = parkedCars.length;

    if (!preferEW && lotH >= 2) {
      // Neat N/S parking rows: each bay is 2 tiles deep with a 1-tile driving aisle between rows (cadence = 3 tiles)
      // Horizontal stall pitch = 24px (1.5 tiles -> 19px car + 5px clean gap between side-by-side parked cars!)
      const stallPitchX = 24;
      const startX = lot.minX * tileSize + 13;
      const maxCenterX = (lot.maxX + 1) * tileSize - 11;
      for (let rowIdx = 0, ty = lot.minY; ty + 1 <= lot.maxY; ty += 3, rowIdx++) {
        const cy = (ty + 1) * tileSize; // centered cleanly across tiles ty and ty+1
        let colIdx = 0;
        for (let cx = startX; cx <= maxCenterX; cx += stallPitchX, colIdx++) {
          // Alternate nose-in vs backed-in naturally per stall (mostly facing the driving aisle)
          const hDir = hash2(colIdx, rowIdx, 913 + lot.id);
          const defaultDir = rowIdx % 2 === 0 ? "s" : "n";
          const dir = hDir % 4 === 0 ? (defaultDir === "s" ? "n" : "s") : defaultDir;
          tryPlaceCar(cx, cy, dir, lot.id, colIdx * 13 + rowIdx * 29);
        }
      }
    }

    if (preferEW || (parkedCars.length === lotStartCount && lotW >= 2)) {
      // Horizontal E/W bays: each bay is 2 tiles wide with a 1-tile driving aisle (cadence = 3 tiles),
      // vertical stall pitch = 24px (20px tall car + 4px crisp spacing)
      const stallPitchY = 24;
      const startY = lot.minY * tileSize + 11;
      const maxCenterY = (lot.maxY + 1) * tileSize - 11;
      for (let colIdx = 0, tx = lot.minX; tx + 1 <= lot.maxX; tx += 3, colIdx++) {
        const cx = (tx + 1) * tileSize; // centered cleanly across tiles tx and tx+1
        let rowIdx = 0;
        for (let cy = startY; cy <= maxCenterY; cy += stallPitchY, rowIdx++) {
          const hDir = hash2(colIdx, rowIdx, 977 + lot.id);
          const defaultDir = colIdx % 2 === 0 ? "e" : "w";
          const dir = hDir % 4 === 0 ? (defaultDir === "e" ? "w" : "e") : defaultDir;
          tryPlaceCar(cx, cy, dir, lot.id, colIdx * 19 + rowIdx * 31);
        }
      }
    }
  }

  return parkedCars;
}
