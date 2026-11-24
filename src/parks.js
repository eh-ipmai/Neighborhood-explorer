/**
 * Deterministic athletic field & playground placement inside public PARK (11) areas
 * so parks are unmistakably distinct from backyard residential grass:
 *   - Baseball Diamonds (dirt infield, chalk lines, bases, pitcher's mound & backstop)
 *   - Full & Half Basketball Courts (painted key, 3-point arcs & standing hoops)
 *   - Soccer Fields (mowed pitch stripes, chalk lines & standing mesh goals)
 *   - Playgrounds (timber-framed mulch/sand pad with swing set & slide)
 */

import { buildGraveyardMask } from "./graveyards.js";

const TILE_PARK = 11;
const TILE_DIRT = 9;
const TILE_SAND = 10;

function hash2d(x, y) {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0);
}

/**
 * Scan worldMap.layers.base for clean open PARK areas and place non-overlapping
 * baseball diamonds, basketball courts, soccer fields, and playgrounds.
 * Automatically avoids graveyard zones (e.g., East Parish Burying Ground) so
 * athletic courts never overlap historic burial grounds!
 */
export function buildParkFeatures(worldMap, excludedGrid = null) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const occupiedGrid = new Uint8Array(width * height);
  const graveyardMask = excludedGrid || buildGraveyardMask(worldMap).graveyardGrid;
  const fields = [];
  const props = [];

  function canPlace(tx, ty, w, h, allowTiles, margin = 3) {
    if (tx < 1 || ty < 1 || tx + w >= width - 1 || ty + h >= height - 1) return false;
    // Keep a lush green lawn margin around every field/court so parks breathe naturally
    const minY = Math.max(0, ty - margin);
    const maxY = Math.min(height - 1, ty + h - 1 + margin);
    const minX = Math.max(0, tx - margin);
    const maxX = Math.min(width - 1, tx + w - 1 + margin);
    for (let y = minY; y <= maxY; y++) {
      const off = y * width;
      for (let x = minX; x <= maxX; x++) {
        if (occupiedGrid[off + x] !== 0) return false;
        if (graveyardMask && graveyardMask[off + x] !== 0) return false;
      }
    }
    let parkCount = 0;
    for (let y = ty; y < ty + h; y++) {
      const off = y * width;
      for (let x = tx; x < tx + w; x++) {
        const t = base[off + x];
        if (!allowTiles.includes(t)) return false;
        if (t === TILE_PARK) parkCount++;
      }
    }
    return parkCount >= Math.floor((w * h) * 0.45);
  }

  function markField(kind, tx, ty, w, h) {
    const id = `${kind}_${tx}_${ty}`;
    fields.push({ id, kind, tx, ty, w, h });
    for (let y = ty; y < ty + h; y++) {
      const off = y * width;
      for (let x = tx; x < tx + w; x++) {
        occupiedGrid[off + x] = 1;
      }
    }

    if (kind === "baseball_diamond") {
      // Backstop stands behind home plate (bottom-center of diamond)
      props.push({
        sprite: "baseball_backstop",
        tx: tx + Math.floor(w / 2),
        ty: ty + h - 1,
        offsetX: -12,
        offsetY: -8,
        sortYOffset: 15,
      });
    } else if (kind === "basketball_court") {
      const midY = ty + Math.floor(h / 2);
      props.push({
        sprite: "hoop_left",
        tx,
        ty: midY,
        offsetX: -2,
        offsetY: -14,
        sortYOffset: 10,
      });
      props.push({
        sprite: "hoop_right",
        tx: tx + w - 1,
        ty: midY,
        offsetX: 2,
        offsetY: -14,
        sortYOffset: 10,
      });
    } else if (kind === "half_court") {
      props.push({
        sprite: "hoop_top",
        tx: tx + Math.floor(w / 2),
        ty,
        offsetX: -3,
        offsetY: -12,
        sortYOffset: 8,
      });
    } else if (kind === "soccer_field") {
      const midY = ty + Math.floor(h / 2);
      props.push({
        sprite: "soccer_goal_left",
        tx,
        ty: midY,
        offsetX: -4,
        offsetY: -10,
        sortYOffset: 12,
      });
      props.push({
        sprite: "soccer_goal_right",
        tx: tx + w - 1,
        ty: midY,
        offsetX: 4,
        offsetY: -10,
        sortYOffset: 12,
      });
    } else if (kind === "playground") {
      props.push({
        sprite: "swing_set",
        tx,
        ty: ty + 1,
        offsetX: 2,
        offsetY: -10,
        sortYOffset: 12,
      });
      if (w >= 4) {
        props.push({
          sprite: "park_slide",
          tx: tx + w - 2,
          ty: ty + 1,
          offsetX: 2,
          offsetY: -8,
          sortYOffset: 12,
        });
      }
    }
  }

  // 1. Place signature baseball diamonds on real dirt+park athletic bowls (e.g. Ward Field & Offline Park)
  if (width === 512 && height === 512) {
    // Ward Elementary Baseball Field (around 472, 38)
    if (canPlace(468, 35, 7, 7, [TILE_PARK, TILE_DIRT, TILE_SAND])) {
      markField("baseball_diamond", 468, 35, 7, 7);
    }
    // Weeks Field area (around 208..230, 325..360): soccer + basketball + baseball!
    if (canPlace(206, 351, 6, 4, [TILE_PARK, TILE_DIRT, TILE_SAND])) {
      markField("basketball_court", 206, 351, 6, 4);
    }
  } else if (width === 128 && height === 128) {
    // Offline demo park baseball diamond & basketball court
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    if (canPlace(cx + 31, cy - 15, 7, 7, [TILE_PARK, TILE_DIRT, TILE_SAND], 1)) {
      markField("baseball_diamond", cx + 31, cy - 15, 7, 7);
    }
    if (canPlace(cx + 25, cy - 16, 5, 4, [TILE_PARK, TILE_SAND], 1)) {
      markField("basketball_court", cx + 25, cy - 16, 5, 4);
    }
  }

  // 2. Automatically populate large & medium PARK clusters across the whole neighborhood
  //    Pass A: Large athletic fields (baseball diamonds & soccer fields) in spacious parks
  for (let ty = 3; ty < height - 10; ty += 4) {
    for (let tx = 3; tx < width - 10; tx += 4) {
      if (base[ty * width + tx] !== TILE_PARK || occupiedGrid[ty * width + tx]) continue;
      const h = hash2d(tx, ty);
      if (h % 2 === 0) {
        if (canPlace(tx, ty, 7, 7, [TILE_PARK, TILE_DIRT], 5)) {
          markField("baseball_diamond", tx, ty, 7, 7);
          continue;
        }
        if (canPlace(tx, ty, 8, 5, [TILE_PARK], 5)) {
          markField("soccer_field", tx, ty, 8, 5);
          continue;
        }
      } else {
        if (canPlace(tx, ty, 8, 5, [TILE_PARK], 5)) {
          markField("soccer_field", tx, ty, 8, 5);
          continue;
        }
        if (canPlace(tx, ty, 7, 7, [TILE_PARK, TILE_DIRT], 5)) {
          markField("baseball_diamond", tx, ty, 7, 7);
          continue;
        }
      }
    }
  }

  //    Pass B: Full basketball courts (6x4) & playgrounds (4x3) in medium parks
  for (let ty = 2; ty < height - 6; ty += 3) {
    for (let tx = 2; tx < width - 8; tx += 3) {
      if (base[ty * width + tx] !== TILE_PARK || occupiedGrid[ty * width + tx]) continue;
      if (canPlace(tx, ty, 6, 4, [TILE_PARK, TILE_SAND], 5)) {
        const h = hash2d(tx, ty);
        if (h % 3 === 0) {
          markField("playground", tx, ty, 4, 3);
        } else {
          markField("basketball_court", tx, ty, 6, 4);
        }
      }
    }
  }

  //    Pass C: Compact neighborhood half-court basketball hoops (3x3) & playgrounds in smaller pocket parks
  for (let ty = 2; ty < height - 5; ty += 3) {
    for (let tx = 2; tx < width - 5; tx += 3) {
      if (base[ty * width + tx] !== TILE_PARK || occupiedGrid[ty * width + tx]) continue;
      if (canPlace(tx, ty, 3, 3, [TILE_PARK, TILE_SAND], 7)) {
        const h = hash2d(tx, ty);
        markField(h % 2 === 0 ? "half_court" : "playground", tx, ty, 3, 3);
      }
    }
  }

  return { fields, props, occupiedGrid };
}

/**
 * Deterministic 16-bit SNES tree placement with lush, dense New England forest canopies
 * wherever an area is truly wooded:
 *   - Wild Woods / Forest tiles (TILE_TALL_GRASS = 7): ~62% dense oak & evergreen pine canopy
 *   - Deep unbuilt conservation woods (grass 3+ tiles from any building/road/sidewalk/lot): ~48% dense grove
 *   - Woodland fringe (grass/park within 2 tiles of forest): ~34% natural forest taper
 *   - Suburban residential yards (grass): 15% airy shade trees
 *   - Manicured public parks (park, outside fields): 3% specimen shade trees
 * Trees NEVER spawn on trails, sidewalks, roads, water, buildings, park athletic fields, or graveyards.
 * Returns Uint8Array where 0 = none, 1 = oak tree, 2 = evergreen pine.
 */
export function buildWoodlandTreeGrid(worldMap, parkOccupiedGrid = null, graveyardGrid = null) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const treeGrid = new Uint8Array(width * height);

  const isUrban = (t) =>
    t === 1 || t === 2 || t === 3 || t === 4 || t === 5 || t === 8 || t === 12 || t === 13;
  const isWoodOrGrass = (t) => t === 0 || t === 7 || t === 11;

  // Precompute urban-proximity mask (distance <= 3 from any building, road, sidewalk, or parking lot)
  // in O(W*H) using two 1D separable box passes so deep conservation woods are detected instantaneously!
  const urbanH = new Uint8Array(width * height);
  const urbanNear3 = new Uint8Array(width * height);
  const woodNear2 = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    const off = y * width;
    for (let x = 0; x < width; x++) {
      const t = base[off + x];
      if (isUrban(t)) {
        const x0 = Math.max(0, x - 3);
        const x1 = Math.min(width - 1, x + 3);
        for (let nx = x0; nx <= x1; nx++) urbanH[off + nx] = 1;
      } else if (t === 7) {
        const y0 = Math.max(0, y - 2);
        const y1 = Math.min(height - 1, y + 2);
        const x0 = Math.max(0, x - 2);
        const x1 = Math.min(width - 1, x + 2);
        for (let ny = y0; ny <= y1; ny++) {
          const nOff = ny * width;
          for (let nx = x0; nx <= x1; nx++) woodNear2[nOff + nx] = 1;
        }
      }
    }
  }
  for (let y = 0; y < height; y++) {
    const off = y * width;
    for (let x = 0; x < width; x++) {
      if (urbanH[off + x] === 1) {
        const y0 = Math.max(0, y - 3);
        const y1 = Math.min(height - 1, y + 3);
        for (let ny = y0; ny <= y1; ny++) urbanNear3[ny * width + x] = 1;
      }
    }
  }

  for (let ty = 1; ty < height - 1; ty++) {
    const rowOff = ty * width;
    for (let tx = 1; tx < width - 1; tx++) {
      const idx = rowOff + tx;
      const cur = base[idx];
      if (!isWoodOrGrass(cur)) continue;
      if (parkOccupiedGrid && parkOccupiedGrid[idx] === 1) continue;
      if (graveyardGrid && graveyardGrid[idx] !== 0) continue;

      const isExplicitWoods = cur === 7;
      const isDeepWoods = cur === 0 && urbanNear3[idx] === 0;
      const isWoodlandFringe = !isExplicitWoods && !isDeepWoods && woodNear2[idx] === 1 && cur !== 11;
      const isTrulyWooded = isExplicitWoods || isDeepWoods;

      // Boulevard Grassy Tree-Lined Median (e.g., Commonwealth Avenue Olmsted Carriage Lane Mall!):
      // A lush grassy strip separating Main Comm Ave (MAIN_ROAD = 3) from the Carriage Lane (RESIDENTIAL_ROAD = 2)
      // gets stately, evenly-spaced autumn shade oaks & maples right down the green separator!
      if (cur === 11 || cur === 0) {
        let hasMainSouth = false;
        let hasCarriageNorth = false;
        let medianBlocked = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = tx + dx;
            const ny = ty + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            const nt = base[ny * width + nx];
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
              if (nt === 5 || nt === 6 || nt === 4) medianBlocked = true;
            }
            if (dy >= 1 && nt === 3) hasMainSouth = true;
            if (dy <= -1 && nt === 2) hasCarriageNorth = true;
          }
        }
        if (hasMainSouth && hasCarriageNorth && !medianBlocked) {
          // Keep trees cleanly spaced along the median (at least 3 tiles apart, clear of cross-street openings!)
          const wTile = base[rowOff + (tx - 1)];
          const eTile = base[rowOff + (tx + 1)];
          const openSpan = (wTile === 11 || wTile === 0) && (eTile === 11 || eTile === 0);
          if (openSpan) {
            let treeNear = false;
            for (let oy = -2; oy <= 2 && !treeNear; oy++) {
              const rOff = (ty + oy) * width;
              for (let ox = -3; ox <= 3; ox++) {
                const gx = tx + ox;
                const gy = ty + oy;
                if (gx >= 0 && gy >= 0 && gx < width && gy < height && treeGrid[rOff + gx] !== 0) {
                  treeNear = true;
                  break;
                }
              }
            }
            if (!treeNear && ((tx + ty) % 3 === 0 || (hash2d(tx, ty) % 3 === 0))) {
              treeGrid[idx] = 1; // Classic golden-hour New England autumn oak/maple!
            }
          }
          continue;
        }
      }

      // Ensure trees never clip roads, sidewalks, buildings, or water; inside true woods allow trees
      // right up beside dirt walking trails (9) so forest trails wind authentically under the canopy!
      let clear = true;
      for (let dy = -1; dy <= 1 && clear; dy++) {
        const nRow = (ty + dy) * width;
        for (let dx = -1; dx <= 1; dx++) {
          const nId = base[nRow + (tx + dx)];
          if (isTrulyWooded) {
            if (nId !== 0 && nId !== 7 && nId !== 11 && nId !== 9) {
              clear = false;
              break;
            }
          } else if (nId !== 0 && nId !== 7 && nId !== 11) {
            clear = false;
            break;
          }
        }
      }
      if (!clear) continue;

      const hash = hash2d(tx, ty);
      const threshold = isExplicitWoods
        ? 64
        : isDeepWoods
          ? 50
          : isWoodlandFringe
            ? 34
            : cur === 11
              ? 3
              : 15;

      if (hash % 100 >= threshold) continue;

      if (isTrulyWooded) {
        // Dense overlapping SNES forest canopy: only skip if BOTH north & west neighbors already have trees
        // so forest groves form thick, natural New England woodlands without flat solid walls!
        const hasN = treeGrid[(ty - 1) * width + tx] !== 0;
        const hasW = treeGrid[rowOff + (tx - 1)] !== 0;
        if (hasN && hasW) continue;
        // Rich New England woodland mix: ~60% tall evergreen pines + ~40% leafy oaks
        treeGrid[idx] = hash % 5 < 3 ? 2 : 1;
      } else {
        if (treeGrid[(ty - 1) * width + tx] !== 0 || treeGrid[rowOff + (tx - 1)] !== 0) continue;
        const isPine = isWoodlandFringe ? hash % 2 === 0 : hash % 4 === 0;
        treeGrid[idx] = isPine ? 2 : 1;
      }
    }
  }

  return treeGrid;
}
