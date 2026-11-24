/**
 * Spooky 16-Bit SNES Graveyard System for Neighborhood Explorer:
 *   - Real-world Newton graveyards mapped accurately onto the 512x512 world:
 *       1. East Parish Burying Ground (1660) — Centre St & Cotton St (right across from BC Law!)
 *       2. Newton Cemetery & Arboretum (1855) — 791 Walnut St (around the misty pond & stone chapel!)
 *   - Plus a classic haunted burying ground corner on the 128x128 offline demo map!
 *   - Deterministically populates tombstones, tilted 1660 slate headstones, granite obelisks,
 *     Gothic stone mausoleums, gnarled dead trees, wrought-iron gates & fences, flickering
 *     Jack-o'-Lanterns, ghostly teal lantern posts, spooky black cats, floating friendly ghosts,
 *     flapping pixel bats, and drifting mist wisps — strictly off roads & sidewalks!
 */

const TILE_GRASS = 0;
const TILE_SIDEWALK = 1;
const TILE_RES_ROAD = 2;
const TILE_MAIN_ROAD = 3;
const TILE_BUILDING = 5;
const TILE_WATER = 6;
const TILE_TALL_GRASS = 7;
const TILE_DIRT = 9;
const TILE_SAND = 10;
const TILE_PARK = 11;

function hash2d(x, y) {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0);
}

/**
 * Return the list of graveyard zone definitions for the given worldMap.
 * Each zone has { id, name, founded, shapes: [{ minX, minY, maxX, maxY }] }.
 */
export function getGraveyardZones(worldMap) {
  if (!worldMap || !worldMap.dimensions) return [];
  const { width, height } = worldMap.dimensions;

  // Respect explicit graveyards[] saved in world_map.json if provided
  if (Array.isArray(worldMap.graveyards) && worldMap.graveyards.length > 0) {
    return worldMap.graveyards;
  }

  if (width === 512 && height === 512) {
    return [
      {
        id: "east_parish_burying_ground",
        name: "East Parish Burying Ground",
        founded: 1660,
        subtitle: "Newton's Oldest Graveyard (1660)",
        entrance: { x: 295, y: 24 },
        shapes: [
          // Main historic 1660 colonial yard east of Centre St, north of Cotton St, west of Sunset Rd houses
          { minX: 291, minY: 4, maxX: 324, maxY: 32 },
        ],
      },
      {
        id: "newton_cemetery",
        name: "Newton Cemetery & Arboretum",
        founded: 1855,
        subtitle: "Misty Pond & Stone Crypts (1855)",
        entrance: { x: 68, y: 181 },
        shapes: [
          // Main southern & central rolling cemetery grounds west of Walnut St & north of Beacon St houses
          { minX: 2, minY: 162, maxX: 69, maxY: 207 },
          // Northern lakeside arboretum grounds east of Cummings Rd houses
          { minX: 23, minY: 135, maxX: 55, maxY: 162 },
        ],
      },
    ];
  }

  if (width === 128 && height === 128) {
    // Offline demo map spooky graveyard corner (NW of Centre St / north of woods)
    return [
      {
        id: "offline_burying_ground",
        name: "Old Newton Burying Ground",
        founded: 1660,
        subtitle: "Spooky Colonial Graveyard",
        entrance: { x: 24, y: 28 },
        shapes: [{ minX: 8, minY: 10, maxX: 28, maxY: 28 }],
      },
    ];
  }

  return [];
}

/**
 * Build a fast O(1) Uint8Array mask of graveyard zones (0 = none, 1..N = 1-based zone index).
 * Automatically excludes any tile inside or immediately hugging an addressed residential house
 * so tombstones never spill into neighbors' front yards!
 */
export function buildGraveyardMask(worldMap) {
  const { width, height } = worldMap.dimensions;
  const zones = getGraveyardZones(worldMap);
  const graveyardGrid = new Uint8Array(width * height);
  if (zones.length === 0) return { graveyardGrid, zones };

  // Exclude residential houses (keep cemetery chapels/crypts inside!)
  const housePadGrid = new Uint8Array(width * height);
  for (const b of worldMap.buildings || []) {
    if (!b.bounds) continue;
    const isCemeteryBldg =
      b.gothicCrypt ||
      /cemetery|mausoleum|crypt/i.test(b.name || "") ||
      (!b.address && b.kind === "garage");
    if (isCemeteryBldg) continue;
    // Pad around residential homes & shops by 1 tile so graves never touch neighbor yards
    const minX = Math.max(0, b.bounds.minX - 1);
    const maxX = Math.min(width - 1, b.bounds.maxX + 1);
    const minY = Math.max(0, b.bounds.minY - 1);
    const maxY = Math.min(height - 1, b.bounds.maxY + 1);
    for (let y = minY; y <= maxY; y++) {
      const off = y * width;
      for (let x = minX; x <= maxX; x++) {
        housePadGrid[off + x] = 1;
      }
    }
  }

  zones.forEach((zone, zIdx) => {
    const code = zIdx + 1;
    for (const rect of zone.shapes || []) {
      const minX = Math.max(0, Math.floor(rect.minX));
      const maxX = Math.min(width - 1, Math.floor(rect.maxX));
      const minY = Math.max(0, Math.floor(rect.minY));
      const maxY = Math.min(height - 1, Math.floor(rect.maxY));
      for (let y = minY; y <= maxY; y++) {
        const off = y * width;
        for (let x = minX; x <= maxX; x++) {
          if (housePadGrid[off + x] === 1) continue;
          graveyardGrid[off + x] = code;
        }
      }
    }
  });

  return { graveyardGrid, zones };
}

/**
 * Scan graveyard zones and deterministically populate spooky 16-bit SNES graveyard features:
 *   - Tombstones (arched granite, Celtic cross, tilted 1660 colonial slate)
 *   - Tall granite obelisk monuments & Gothic stone crypts / mausoleums
 *   - Gnarled haunted dead trees (replacing cheerful green oaks inside graveyards)
 *   - Wrought-iron entrance gates & spear fences bordering roads/sidewalks
 *   - Flickering Jack-o'-Lanterns, ghostly teal iron lantern posts, and black cats
 *   - Animated floating friendly ghosts, flapping pixel bats, and glowing will-o'-the-wisps!
 */
export function buildGraveyardFeatures(worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const { graveyardGrid, zones } = buildGraveyardMask(worldMap);
  const occupiedGrid = new Uint8Array(width * height);

  const props = [];
  const ghosts = [];
  const bats = [];
  const wisps = [];

  if (zones.length === 0) {
    return { graveyardGrid, occupiedGrid, zones, props, ghosts, bats, wisps };
  }

  const isOpenTurf = (t) => t === TILE_GRASS || t === TILE_PARK || t === TILE_TALL_GRASS;
  const isPathOrRoad = (t) =>
    t === TILE_SIDEWALK || t === TILE_RES_ROAD || t === TILE_MAIN_ROAD || t === TILE_DIRT;

  function inBounds(x, y) {
    return x >= 1 && y >= 1 && x < width - 1 && y < height - 1;
  }

  function isTurfClear(tx, ty, radius = 0) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(nx, ny)) return false;
        const idx = ny * width + nx;
        if (graveyardGrid[idx] === 0 || occupiedGrid[idx] !== 0) return false;
        if (!isOpenTurf(base[idx])) return false;
      }
    }
    return true;
  }

  function markOccupied(tx, ty, w = 1, h = 1) {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (inBounds(x, y)) occupiedGrid[y * width + x] = 1;
      }
    }
  }

  // 1. Place grand wrought-iron entrance gates near each graveyard's main entrance
  for (const zone of zones) {
    if (!zone.entrance) continue;
    const ex = zone.entrance.x;
    const ey = zone.entrance.y;
    let placedGate = false;
    for (let r = 0; r <= 5 && !placedGate; r++) {
      for (let dy = -r; dy <= r && !placedGate; dy++) {
        for (let dx = -r; dx <= r && !placedGate; dx++) {
          const tx = ex + dx;
          const ty = ey + dy;
          if (!inBounds(tx, ty)) continue;
          const idx = ty * width + tx;
          if (graveyardGrid[idx] === 0 || !isOpenTurf(base[idx]) || occupiedGrid[idx]) continue;
          // Prefer a tile right beside a sidewalk or road so it frames the entrance!
          const nearPath =
            isPathOrRoad(base[(ty - 1) * width + tx]) ||
            isPathOrRoad(base[(ty + 1) * width + tx]) ||
            isPathOrRoad(base[ty * width + (tx - 1)]) ||
            isPathOrRoad(base[ty * width + (tx + 1)]);
          if (nearPath || r >= 3) {
            props.push({
              kind: "gate",
              sprite: "grave_gate",
              tx,
              ty,
              offsetX: -8,
              offsetY: -12,
              sortYOffset: 15,
            });
            markOccupied(tx - 1, ty, 3, 1);
            // Flank the entrance gate with a glowing Jack-o'-Lantern!
            if (inBounds(tx + 1, ty + 1) && isOpenTurf(base[(ty + 1) * width + (tx + 1)])) {
              props.push({
                kind: "pumpkin",
                sprite: "grave_pumpkin",
                animated: true,
                tx: tx + 1,
                ty: ty + 1,
                offsetX: 3,
                offsetY: 2,
                sortYOffset: 14,
              });
              markOccupied(tx + 1, ty + 1, 1, 1);
            }
            placedGate = true;
          }
        }
      }
    }
  }

  // 2. Place focal Gothic Stone Mausoleums & Tall Granite Obelisk Monuments in spacious clearings
  for (let ty = 3; ty < height - 3; ty += 5) {
    for (let tx = 3; tx < width - 3; tx += 5) {
      const idx = ty * width + tx;
      if (graveyardGrid[idx] === 0) continue;
      if (!isTurfClear(tx, ty, 1)) continue;
      const h = hash2d(tx, ty);
      if (h % 11 === 0) {
        props.push({
          kind: "mausoleum",
          sprite: "grave_mausoleum",
          tx,
          ty,
          offsetX: -6,
          offsetY: -14,
          sortYOffset: 16,
        });
        markOccupied(tx - 1, ty - 1, 3, 2);
        // Put a ghostly lantern or jack-o'-lantern right outside the crypt door!
        if (inBounds(tx + 1, ty + 1) && isOpenTurf(base[(ty + 1) * width + (tx + 1)])) {
          props.push({
            kind: "pumpkin",
            sprite: "grave_pumpkin",
            animated: true,
            tx: tx + 1,
            ty: ty + 1,
            offsetX: 2,
            offsetY: 3,
            sortYOffset: 15,
          });
          markOccupied(tx + 1, ty + 1, 1, 1);
        }
        // Spawn a friendly ghost gently haunting the mausoleum!
        ghosts.push({
          tx,
          ty,
          phase: (h % 628) / 100,
          radiusX: 18 + (h % 10),
          radiusY: 11 + (h % 7),
          speed: 0.75 + ((h % 5) * 0.1),
          variant: h % 2,
        });
      } else if (h % 7 === 0) {
        props.push({
          kind: "obelisk",
          sprite: "grave_obelisk",
          tx,
          ty,
          offsetX: 1,
          offsetY: -14,
          sortYOffset: 15,
        });
        markOccupied(tx, ty, 1, 1);
      }
    }
  }

  // Guarantee every graveyard zone has at least one obelisk, mausoleum, friendly ghost, bat & wisp!
  zones.forEach((zone, zIdx) => {
    const code = zIdx + 1;
    let zoneGhosts = 0;
    let zoneMausoleums = 0;
    let zoneObelisks = 0;
    for (const g of ghosts) {
      if (graveyardGrid[g.ty * width + g.tx] === code) zoneGhosts++;
    }
    for (const p of props) {
      if (graveyardGrid[p.ty * width + p.tx] === code) {
        if (p.kind === "mausoleum") zoneMausoleums++;
        if (p.kind === "obelisk") zoneObelisks++;
      }
    }
    for (const rect of zone.shapes || []) {
      const cx = Math.floor((rect.minX + rect.maxX) / 2);
      const cy = Math.floor((rect.minY + rect.maxY) / 2);
      for (let r = 0; r <= 12 && (zoneMausoleums === 0 || zoneObelisks === 0 || zoneGhosts < 2); r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tx = cx + dx;
            const ty = cy + dy;
            if (!isTurfClear(tx, ty, 0)) continue;
            if (graveyardGrid[ty * width + tx] !== code) continue;
            if (zoneObelisks === 0) {
              props.push({ kind: "obelisk", sprite: "grave_obelisk", tx, ty, offsetX: 1, offsetY: -14, sortYOffset: 15 });
              markOccupied(tx, ty, 1, 1);
              zoneObelisks++;
            } else if (zoneMausoleums === 0 && isTurfClear(tx, ty, 1)) {
              props.push({ kind: "mausoleum", sprite: "grave_mausoleum", tx, ty, offsetX: -6, offsetY: -14, sortYOffset: 16 });
              markOccupied(tx - 1, ty - 1, 3, 2);
              zoneMausoleums++;
            } else if (zoneGhosts < 2) {
              ghosts.push({
                tx,
                ty,
                phase: zoneGhosts * 2.4,
                radiusX: 20,
                radiusY: 12,
                speed: 0.85,
                variant: zoneGhosts % 2,
              });
              zoneGhosts++;
            }
          }
        }
      }
    }
  });

  // 3. Populate neat atmospheric rows of tombstones, gnarled dead trees, spooky lanterns,
  //    wrought-iron edge fences, pumpkins, black cats, bats, and ghostly wisps!
  const stoneSprites = ["tombstone_arch", "tombstone_cross", "tombstone_tilted"];

  for (let ty = 2; ty < height - 2; ty++) {
    for (let tx = 2; tx < width - 2; tx++) {
      const idx = ty * width + tx;
      if (graveyardGrid[idx] === 0 || occupiedGrid[idx] !== 0) continue;
      const cur = base[idx];
      if (!isOpenTurf(cur)) continue;

      const h = hash2d(tx, ty);
      const n = base[(ty - 1) * width + tx];
      const s = base[(ty + 1) * width + tx];
      const w = base[ty * width + (tx - 1)];
      const e = base[ty * width + (tx + 1)];
      const touchesRoadOrWalk = isPathOrRoad(n) || isPathOrRoad(s) || isPathOrRoad(w) || isPathOrRoad(e);

      // Wrought-iron fence & spooky lantern posts framing graveyard borders along paths/roads
      // (leave generous gaps so the player can always stroll right into the cemetery!)
      if (touchesRoadOrWalk) {
        if ((tx + ty) % 7 === 0) {
          props.push({
            kind: "lantern",
            sprite: "grave_lantern",
            animated: true,
            tx,
            ty,
            offsetX: 3,
            offsetY: -9,
            sortYOffset: 15,
          });
          markOccupied(tx, ty, 1, 1);
          continue;
        }
        if ((tx % 4 === 1 || tx % 4 === 2) && (isPathOrRoad(s) || isPathOrRoad(n)) && h % 3 !== 0) {
          props.push({
            kind: "fence",
            sprite: "grave_iron_fence",
            tx,
            ty,
            offsetX: 0,
            offsetY: 1,
            sortYOffset: 14,
          });
          markOccupied(tx, ty, 1, 1);
          continue;
        }
        if (h % 13 === 0) {
          props.push({
            kind: "pumpkin",
            sprite: "grave_pumpkin",
            animated: true,
            tx,
            ty,
            offsetX: 3,
            offsetY: 3,
            sortYOffset: 14,
          });
          markOccupied(tx, ty, 1, 1);
          continue;
        }
      }

      // Gnarled spooky dead trees (with perched crow & cobwebs!) — extra dense on wooded graveyard hills!
      const spookyTreeMod = cur === TILE_TALL_GRASS ? 7 : 31;
      if (h % spookyTreeMod === 0 && (cur === TILE_TALL_GRASS || isTurfClear(tx, ty, 1))) {
        props.push({
          kind: "spooky_tree",
          sprite: "grave_tree_spooky",
          tx,
          ty,
          offsetX: -5 + ((h >> 2) % 3) - 1,
          offsetY: -15,
          sortYOffset: 16,
        });
        markOccupied(tx, ty, 1, 1);
        // Add a flapping pixel bat fluttering near gnarled spooky trees!
        if (h % (spookyTreeMod * 2) === 0) {
          bats.push({
            tx,
            ty,
            phase: (h % 628) / 100,
            radiusX: 16 + (h % 12),
            radiusY: 9 + (h % 6),
            speed: 2.2 + ((h % 4) * 0.3),
          });
        }
        continue;
      }

      // Neat historic tombstone rows (every 2 tiles horizontally, every 2 tiles vertically, with organic gaps)
      if (tx % 2 === 0 && ty % 2 === 0 && h % 10 < 6) {
        const spr = stoneSprites[h % stoneSprites.length];
        props.push({
          kind: "tombstone",
          sprite: spr,
          tx,
          ty,
          offsetX: 2 + ((h >> 3) % 3) - 1,
          offsetY: -2 + ((h >> 5) % 2),
          sortYOffset: 14,
        });
        markOccupied(tx, ty, 1, 1);

        // Occasional spooky black cat perched right next to an old tombstone, or a glowing pumpkin!
        if (h % 29 === 0 && inBounds(tx + 1, ty) && isTurfClear(tx + 1, ty, 0)) {
          props.push({
            kind: "black_cat",
            sprite: "grave_cat",
            tx: tx + 1,
            ty,
            offsetX: 2,
            offsetY: 3,
            sortYOffset: 14,
          });
          markOccupied(tx + 1, ty, 1, 1);
        } else if (h % 23 === 0 && inBounds(tx + 1, ty) && isTurfClear(tx + 1, ty, 0)) {
          props.push({
            kind: "pumpkin",
            sprite: "grave_pumpkin",
            animated: true,
            tx: tx + 1,
            ty,
            offsetX: 3,
            offsetY: 4,
            sortYOffset: 14,
          });
          markOccupied(tx + 1, ty, 1, 1);
        }
        continue;
      }

      // Friendly roaming ghosts & eerie floating will-o'-the-wisps across quiet lawns!
      if (h % 89 === 0) {
        ghosts.push({
          tx,
          ty,
          phase: (h % 628) / 100,
          radiusX: 15 + (h % 14),
          radiusY: 9 + (h % 8),
          speed: 0.7 + ((h % 5) * 0.12),
          variant: h % 2,
        });
      } else if (h % 41 === 0) {
        wisps.push({
          tx,
          ty,
          phase: (h % 628) / 100,
          speed: 1.1 + ((h % 4) * 0.25),
        });
      }
    }
  }

  // Ensure at least a couple flapping bats in every graveyard zone (even smaller ones!)
  zones.forEach((zone, zIdx) => {
    const code = zIdx + 1;
    const hasBat = bats.some((b) => graveyardGrid[b.ty * width + b.tx] === code);
    if (!hasBat && zone.shapes && zone.shapes[0]) {
      const r = zone.shapes[0];
      bats.push({
        tx: Math.floor((r.minX + r.maxX) / 2),
        ty: Math.floor((r.minY + r.maxY) / 2),
        phase: zIdx * 1.7,
        radiusX: 22,
        radiusY: 11,
        speed: 2.5,
      });
    }
  });

  return { graveyardGrid, occupiedGrid, zones, props, ghosts, bats, wisps };
}

/**
 * Compute a floating graveyard ghost's live top-left & center pixel coordinates
 * at time tSec so rendering and health-damage contact checks match pixel-for-pixel.
 */
export function getGraveyardGhostPos(g, tSec = 0, tileSize = 16) {
  const basePx = g.tx * tileSize;
  const basePy = g.ty * tileSize;
  const x = Math.round(basePx + Math.cos(tSec * g.speed + g.phase) * g.radiusX);
  const y = Math.round(
    basePy + Math.sin(tSec * g.speed * 0.8 + g.phase) * g.radiusY + Math.sin(tSec * 4 + g.phase) * 2.5
  );
  return {
    x,
    y,
    cx: x + 7,
    cy: y + 10,
  };
}
