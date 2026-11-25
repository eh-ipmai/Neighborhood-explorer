/**
 * High-Resolution 4x Navigation & Surface Sub-Cell Grid (4px x 4px cells = 1/4 of 16px tiles).
 *
 * Bridges the 4x HD OpenStreetMap vector road visuals (`worldMap.vectorRoads`) directly to
 * gameplay physics, pedestrian curb safety, crosswalk detection, and traffic validation:
 *   - Subdivides every 16x16 logical tile into 4x4 = 16 sub-cells (4px each, ~1.5m real-world).
 *   - Clears legacy coarse 16x16 road/crosswalk/median tiles to their clean underlying terrain
 *     (matching `inferVectorRoadUnderlayTile` in main.js) whenever `vectorRoads` is active,
 *     eliminating invisible coarse curbs jutting out across visible sidewalks.
 *   - Stamps exact continuous OSM vector road carriageways, cul-de-sac turning circles,
 *     true-angle zebra crosswalks, and narrow curved highway Jersey medians at 4px resolution.
 *   - Cached per `worldMap` via WeakMap so collider, safety, traffic, streetlife, and debug
 *     overlay share a single 4px grid (~8 MB total on 512x512, built in ~15ms, zero JSON bloat).
 *
 * Pure JS (zero DOM dependencies) so it runs identically in Node tests, Canvas 2D, and WebGL.
 */

export const SUBGRID_DIV = 4; // 4x4 sub-cells per tile -> 4px x 4px cells (1/4 of 16px!)

const TILE_GRASS = 0;
const TILE_SIDEWALK = 1;
const TILE_RES_ROAD = 2;
const TILE_MAIN_ROAD = 3;
const TILE_CROSSWALK = 4;
const TILE_WALL = 5;
const TILE_WATER = 6;
const TILE_TALL_GRASS = 7;
const TILE_PARKING = 8;
const TILE_PARK = 11;
const TILE_HIGHWAY = 12;
const TILE_MEDIAN = 13;

const CLASS_ORDER = { residential: 0, main: 1, highway: 2 };

const subgridCache = new WeakMap();

function isLegacyRoadTile(t) {
  return (
    t === TILE_RES_ROAD ||
    t === TILE_MAIN_ROAD ||
    t === TILE_CROSSWALK ||
    t === TILE_HIGHWAY ||
    t === TILE_MEDIAN
  );
}

/**
 * Infer clean underlying walkable surface beneath legacy coarse road tiles when
 * vectorRoads are active (mirrors `inferVectorRoadUnderlayTile` in src/main.js).
 */
function inferUnderlayTile(base, width, height, tx, ty) {
  let parkVotes = 0;
  let grassVotes = 0;
  let sidewalkVotes = 0;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nt = base[ny * width + nx];
      const w = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1;
      if (nt === TILE_SIDEWALK) sidewalkVotes += w;
      else if (nt === TILE_PARK || nt === TILE_TALL_GRASS) parkVotes += w;
      else if (nt === TILE_GRASS || nt === TILE_WALL) grassVotes += w;
    }
  }
  if (parkVotes >= sidewalkVotes && parkVotes >= grassVotes && parkVotes > 0) return TILE_PARK;
  if (sidewalkVotes >= grassVotes && sidewalkVotes > 0) return TILE_SIDEWALK;
  return TILE_GRASS;
}

/**
 * Rasterize a continuous segment (ax, ay) -> (bx, by) in sub-cell coordinates as a
 * rounded capsule of radius `radSub` onto a sub-cell grid.
 */
function stampCapsule(subW, subH, ax, ay, bx, by, radSub, writeFn) {
  const minX = Math.max(0, Math.floor(Math.min(ax, bx) - radSub - 0.5));
  const maxX = Math.min(subW - 1, Math.ceil(Math.max(ax, bx) + radSub + 0.5));
  const minY = Math.max(0, Math.floor(Math.min(ay, by) - radSub - 0.5));
  const maxY = Math.min(subH - 1, Math.ceil(Math.max(ay, by) + radSub + 0.5));
  if (minX > maxX || minY > maxY) return;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const radSq = radSub * radSub;

  for (let sy = minY; sy <= maxY; sy++) {
    const py = sy + 0.5;
    const rowOff = sy * subW;
    for (let sx = minX; sx <= maxX; sx++) {
      const px = sx + 0.5;
      let dSq;
      if (lenSq < 1e-8) {
        const ex = px - ax;
        const ey = py - ay;
        dSq = ex * ex + ey * ey;
      } else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
        const cx = ax + t * dx;
        const cy = ay + t * dy;
        const ex = px - cx;
        const ey = py - cy;
        dSq = ex * ex + ey * ey;
      }
      if (dSq <= radSq) {
        writeFn(rowOff + sx, sx, sy);
      }
    }
  }
}

/**
 * Rasterize a filled circle centered at (cx, cy) with radius `radSub` in sub-cell coords.
 */
function stampCircle(subW, subH, cx, cy, radSub, writeFn) {
  const minX = Math.max(0, Math.floor(cx - radSub - 0.5));
  const maxX = Math.min(subW - 1, Math.ceil(cx + radSub + 0.5));
  const minY = Math.max(0, Math.floor(cy - radSub - 0.5));
  const maxY = Math.min(subH - 1, Math.ceil(cy + radSub + 0.5));
  if (minX > maxX || minY > maxY) return;

  const radSq = radSub * radSub;
  for (let sy = minY; sy <= maxY; sy++) {
    const ey = sy + 0.5 - cy;
    const eySq = ey * ey;
    const rowOff = sy * subW;
    for (let sx = minX; sx <= maxX; sx++) {
      const ex = sx + 0.5 - cx;
      if (ex * ex + eySq <= radSq) {
        writeFn(rowOff + sx, sx, sy);
      }
    }
  }
}

/**
 * Rasterize an oriented rectangle centered at (cx, cy), rotated by `angleRad`,
 * with half-length `halfLen` along angle and `halfWidth` perpendicular to angle (in sub-cells).
 */
function stampOrientedRect(subW, subH, cx, cy, angleRad, halfLen, halfWidth, writeFn) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const extX = Math.abs(cos) * halfLen + Math.abs(sin) * halfWidth;
  const extY = Math.abs(sin) * halfLen + Math.abs(cos) * halfWidth;

  const minX = Math.max(0, Math.floor(cx - extX - 0.5));
  const maxX = Math.min(subW - 1, Math.ceil(cx + extX + 0.5));
  const minY = Math.max(0, Math.floor(cy - extY - 0.5));
  const maxY = Math.min(subH - 1, Math.ceil(cy + extY + 0.5));
  if (minX > maxX || minY > maxY) return;

  for (let sy = minY; sy <= maxY; sy++) {
    const dy = sy + 0.5 - cy;
    const rowOff = sy * subW;
    for (let sx = minX; sx <= maxX; sx++) {
      const dx = sx + 0.5 - cx;
      const along = dx * cos + dy * sin;
      const across = -dx * sin + dy * cos;
      if (Math.abs(along) <= halfLen && Math.abs(across) <= halfWidth) {
        writeFn(rowOff + sx, sx, sy);
      }
    }
  }
}

/**
 * Build (or retrieve cached) 4x4 sub-cell navigation & surface grid for `worldMap`.
 */
export function getNavigationSubgrid(worldMap) {
  if (!worldMap || !worldMap.dimensions || !worldMap.layers) return null;
  const cached = subgridCache.get(worldMap);
  if (cached) return cached;

  const { width, height } = worldMap.dimensions;
  const tileSize = worldMap.tileSize || 16;
  const div = SUBGRID_DIV;
  const subCellSize = tileSize / div; // 4px for 16px tiles!
  const subW = width * div;
  const subH = height * div;

  const base = worldMap.layers.base;
  const baseCollision = worldMap.layers.collision;
  const legend = worldMap.legend || {};
  const vr = worldMap.vectorRoads;
  const hasVectorRoads = Boolean(vr && Array.isArray(vr.roads) && vr.roads.length > 0);

  const surface = new Uint8Array(subW * subH);
  const collision = new Uint8Array(subW * subH);

  // 1. Expand coarse tile grid to 4x4 sub-cells.
  //    When vectorRoads are active, strip legacy coarse road/crosswalk/median footprints back
  //    to their clean underlying sidewalk/grass/park terrain so exact 4px vector geometry replaces them!
  for (let ty = 0; ty < height; ty++) {
    const srcRow = ty * width;
    for (let tx = 0; tx < width; tx++) {
      const rawTile = base[srcRow + tx];
      let fillTile = rawTile;
      let fillCol = baseCollision ? baseCollision[srcRow + tx] : 0;

      if (hasVectorRoads && isLegacyRoadTile(rawTile)) {
        fillTile = inferUnderlayTile(base, width, height, tx, ty);
        fillCol = 0;
      }

      const sy0 = ty * div;
      const sx0 = tx * div;
      for (let dy = 0; dy < div; dy++) {
        const dstOff = (sy0 + dy) * subW + sx0;
        for (let dx = 0; dx < div; dx++) {
          surface[dstOff + dx] = fillTile;
          collision[dstOff + dx] = fillCol;
        }
      }
    }
  }

  // 2. Stamp exact 4px-resolution vector roads, turning circles, crosswalks & highway medians!
  if (hasVectorRoads) {
    const sortedRoads = vr.roads
      .slice()
      .sort((a, b) => (CLASS_ORDER[a.cls] || 0) - (CLASS_ORDER[b.cls] || 0));

    // Pass A: Crisp 4px walkable sidewalk curb apron flanking vector roads (only over non-solid grass/sidewalk)
    for (const r of sortedRoads) {
      const flat = r.pts || [];
      if (flat.length < 4) continue;
      const roadHalfSub = (Math.max(0.6, r.widthTiles || 1.2) * div) * 0.5;
      const apronHalfSub = roadHalfSub + 2.0; // ~8px walkable sidewalk margin outside curb
      for (let i = 0; i + 3 < flat.length; i += 2) {
        stampCapsule(
          subW,
          subH,
          flat[i] * div,
          flat[i + 1] * div,
          flat[i + 2] * div,
          flat[i + 3] * div,
          apronHalfSub,
          (idx) => {
            if (collision[idx] === 1) return;
            const cur = surface[idx];
            if (cur === TILE_GRASS) {
              surface[idx] = TILE_SIDEWALK;
            }
          }
        );
      }
    }

    // Pass B: Exact drivable asphalt carriageways (residential -> main -> highway)
    for (const r of sortedRoads) {
      const flat = r.pts || [];
      if (flat.length < 4) continue;
      const tileId =
        r.cls === "highway"
          ? TILE_HIGHWAY
          : r.cls === "main"
            ? TILE_MAIN_ROAD
            : TILE_RES_ROAD;
      // Match visual asphalt width closely (slightly inset ~0.35 sub-cells inside outer curb highlight
      // so Liam can walk right up to the visual granite curb edge cleanly!)
      const radSub = Math.max(1.2, (Math.max(0.6, r.widthTiles || 1.2) * div) * 0.5 - 0.25);
      for (let i = 0; i + 3 < flat.length; i += 2) {
        stampCapsule(
          subW,
          subH,
          flat[i] * div,
          flat[i + 1] * div,
          flat[i + 2] * div,
          flat[i + 3] * div,
          radSub,
          (idx) => {
            if (collision[idx] === 1) return; // Never overwrite solid buildings or water
            const cur = surface[idx];
            // Respect higher-class roads already stamped? Sorted low->high so overwrite cleanly!
            if (cur !== TILE_WALL && cur !== TILE_WATER) {
              surface[idx] = tileId;
            }
          }
        );
      }
    }

    // Pass B2: Cul-de-sac turning circles
    for (const tc of vr.turningCircles || []) {
      const radSub = Math.max(1.5, (tc.radiusTiles || 1.05) * div - 0.2);
      stampCircle(subW, subH, tc.x * div, tc.y * div, radSub, (idx) => {
        if (collision[idx] === 1) return;
        if (surface[idx] !== TILE_WALL && surface[idx] !== TILE_WATER) {
          surface[idx] = TILE_RES_ROAD;
        }
      });
    }

    // Pass C: Exact angle-aligned continental zebra crosswalks (always walkable, clears medians!)
    for (const cw of vr.crosswalks || []) {
      const halfLen = 0.42 * div; // ~6.7px along traffic flow (slightly generous for easy crossing)
      const halfWidth = Math.max(0.65, (cw.widthTiles || 1.5) * 0.54) * div;
      stampOrientedRect(
        subW,
        subH,
        cw.x * div,
        cw.y * div,
        cw.angle || 0,
        halfLen,
        halfWidth,
        (idx) => {
          if (surface[idx] === TILE_WALL || surface[idx] === TILE_WATER) return;
          if (collision[idx] === 1 && surface[idx] !== TILE_MEDIAN) return;
          surface[idx] = TILE_CROSSWALK;
          collision[idx] = 0;
        }
      );
    }

    // Pass D: Exact narrow curved concrete highway Jersey barriers (solid, never blocking crosswalks!)
    for (const m of vr.medians || []) {
      const flat = m.pts || [];
      if (flat.length < 4) continue;
      // 0.72 sub-cells radius (~2.9px half-width -> crisp ~6px concrete barrier matching visual Jersey wall!)
      const radSub = 0.72;
      for (let i = 0; i + 3 < flat.length; i += 2) {
        stampCapsule(
          subW,
          subH,
          flat[i] * div,
          flat[i + 1] * div,
          flat[i + 2] * div,
          flat[i + 3] * div,
          radSub,
          (idx) => {
            if (surface[idx] === TILE_CROSSWALK) return; // Keep crosswalks open!
            if (surface[idx] === TILE_WALL || surface[idx] === TILE_WATER) return;
            surface[idx] = TILE_MEDIAN;
            collision[idx] = 1;
          }
        );
      }
    }
  }

  const waterEntry = Object.entries(legend).find(([, name]) => name === "water");
  const waterTileId = waterEntry ? Number(waterEntry[0]) : TILE_WATER;

  function getSurfaceIdAtSub(sx, sy) {
    if (sx < 0 || sy < 0 || sx >= subW || sy >= subH) return TILE_WALL;
    return surface[sy * subW + sx];
  }

  function getSurfaceIdAtPx(px, py) {
    const sx = Math.floor(px / subCellSize);
    const sy = Math.floor(py / subCellSize);
    return getSurfaceIdAtSub(sx, sy);
  }

  function getSurfaceTypeAtSub(sx, sy) {
    const id = getSurfaceIdAtSub(sx, sy);
    return legend[String(id)] || "grass";
  }

  function getSurfaceTypeAtPx(px, py) {
    const id = getSurfaceIdAtPx(px, py);
    return legend[String(id)] || "grass";
  }

  function isSolidAtSub(sx, sy, options = {}) {
    if (sx < 0 || sy < 0 || sx >= subW || sy >= subH) return true;
    const idx = sy * subW + sx;
    if (collision[idx] !== 1) return false;
    if (options?.canWadeWater && surface[idx] === waterTileId) return false;
    return true;
  }

  function isRoadSurfaceId(id) {
    return (
      id === TILE_RES_ROAD ||
      id === TILE_MAIN_ROAD ||
      id === TILE_CROSSWALK ||
      id === TILE_HIGHWAY
    );
  }

  function isRoadAtSub(sx, sy) {
    return isRoadSurfaceId(getSurfaceIdAtSub(sx, sy));
  }

  function isRoadAtPx(px, py) {
    return isRoadSurfaceId(getSurfaceIdAtPx(px, py));
  }

  function isDrivableAtPx(px, py) {
    const id = getSurfaceIdAtPx(px, py);
    return (
      id === TILE_RES_ROAD ||
      id === TILE_MAIN_ROAD ||
      id === TILE_CROSSWALK ||
      id === TILE_HIGHWAY
    );
  }

  const subgrid = {
    div,
    tileSize,
    subCellSize,
    width,
    height,
    subW,
    subH,
    hasVectorRoads,
    surface,
    collision,
    getSurfaceIdAtSub,
    getSurfaceIdAtPx,
    getSurfaceTypeAtSub,
    getSurfaceTypeAtPx,
    isSolidAtSub,
    isRoadSurfaceId,
    isRoadAtSub,
    isRoadAtPx,
    isDrivableAtPx,
  };

  subgridCache.set(worldMap, subgrid);
  return subgrid;
}
