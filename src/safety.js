/**
 * Street zone, tile classification, per-address house lookup, and pedestrian safety mechanics:
 *   - "FASTER" travel speed multiplier (fast on sidewalks/parks/tall_grass, careful pace on roads)
 *   - "LOOK BOTH WAYS" curb/crosswalk check with Safety XP rewards
 */

import { DEFAULT_HITBOX, TILE_SIZE } from "./player.js";
import { getNavigationSubgrid } from "./subgrid.js";

export const FASTER_MULTIPLIER = 1.65;
export const LOOK_DURATION_SEC = 0.65;
export const SAFE_CROSSING_DURATION_SEC = 6.0;

export const ROAD_TILE_TYPES = new Set([
  "residential_road",
  "main_road",
  "crosswalk",
  "highway",
]);

export function isRoadTileType(tileType) {
  return ROAD_TILE_TYPES.has(tileType);
}

/**
 * Find the closest individual house/building edge distance to tile (tx, ty).
 * Enables per-address house identification when walking along neighborhood sidewalks.
 */
export function findNearestBuilding(buildings, tx, ty) {
  if (!Array.isArray(buildings) || buildings.length === 0) return null;
  let best = null;
  for (const b of buildings) {
    if (!b.bounds) continue;
    const clampedX = Math.max(b.bounds.minX, Math.min(b.bounds.maxX, tx));
    const clampedY = Math.max(b.bounds.minY, Math.min(b.bounds.maxY, ty));
    const distTiles = Math.hypot(tx - clampedX, ty - clampedY);
    if (!best || distTiles < best.distTiles) {
      best = { building: b, distTiles };
    }
  }
  return best;
}

export function createSafetySystem(worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const legend = worldMap.legend || {};
  const streetZones = worldMap.streetZones || [];

  const zoneIndexGrid = new Int32Array(width * height).fill(-1);
  for (let i = 0; i < streetZones.length; i++) {
    const z = streetZones[i];
    if (!z || !z.bounds) continue;
    const minX = Math.max(0, Math.floor(z.bounds.minX));
    const maxX = Math.min(width - 1, Math.floor(z.bounds.maxX));
    const minY = Math.max(0, Math.floor(z.bounds.minY));
    const maxY = Math.min(height - 1, Math.floor(z.bounds.maxY));
    for (let ty = minY; ty <= maxY; ty++) {
      const rowOffset = ty * width;
      for (let tx = minX; tx <= maxX; tx++) {
        if (zoneIndexGrid[rowOffset + tx] === -1 || z.type === "arterial") {
          zoneIndexGrid[rowOffset + tx] = i;
        }
      }
    }
  }

  const tileSize = worldMap.tileSize || TILE_SIZE;
  const subgrid = getNavigationSubgrid(worldMap);
  const useSubgrid = Boolean(subgrid && subgrid.hasVectorRoads);
  const subCellSize = subgrid ? subgrid.subCellSize : tileSize / 4;

  function getTileId(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return 5;
    return base[ty * width + tx];
  }

  function getTileType(tx, ty) {
    const id = getTileId(tx, ty);
    return legend[String(id)] || "grass";
  }

  function getTileIdAtPx(px, py) {
    if (useSubgrid) {
      return subgrid.getSurfaceIdAtPx(px, py);
    }
    return getTileId(Math.floor(px / tileSize), Math.floor(py / tileSize));
  }

  function getTileTypeAtPx(px, py) {
    if (useSubgrid) {
      return subgrid.getSurfaceTypeAtPx(px, py);
    }
    return getTileType(Math.floor(px / tileSize), Math.floor(py / tileSize));
  }

  function isRoadAtPx(px, py) {
    return isRoadTileType(getTileTypeAtPx(px, py));
  }

  function getStreetZoneAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
    const idx = zoneIndexGrid[ty * width + tx];
    if (idx === -1) return null;
    return streetZones[idx];
  }

  function formatCrossingContext(nearCrosswalk, nearHighway, nearMainRoad, nearResidential, nearParking) {
    if (nearCrosswalk) {
      return {
        context: "crosswalk",
        xpReward: 5,
        message: "👀 Looked Both Ways at Crosswalk! +5 Safety XP",
      };
    }
    if (nearHighway) {
      return {
        context: "highway",
        xpReward: 3,
        message: "👀 Busy Highway! Always Look Both Ways & Use a Crosswalk (+3 XP)",
      };
    }
    if (nearMainRoad) {
      return {
        context: "main_road",
        xpReward: 2,
        message: "👀 Busy Road! Look Both Ways & Use a Crosswalk (+2 XP)",
      };
    }
    if (nearResidential) {
      return {
        context: "residential",
        xpReward: 1,
        message: "👀 Looked Both Ways! Safe to Cross (+1 Safety XP)",
      };
    }
    if (nearParking) {
      return {
        context: "parking_lot",
        xpReward: 1,
        message: "👀 Parking Lot Check! Watch for Backing Cars (+1 Safety XP)",
      };
    }
    return {
      context: "clear",
      xpReward: 0,
      message: "👀 Looked Left & Right — All Clear!",
    };
  }

  function inspectCrossingContextAtPx(px, py) {
    if (!useSubgrid) {
      return inspectCrossingContext(Math.floor(px / tileSize), Math.floor(py / tileSize));
    }
    const csx = Math.floor(px / subCellSize);
    const csy = Math.floor(py / subCellSize);
    let nearCrosswalk = false;
    let nearHighway = false;
    let nearMainRoad = false;
    let nearResidential = false;
    let nearParking = false;

    // 4 sub-cells = 16px curb-inspection radius around Liam's feet!
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const type = subgrid.getSurfaceTypeAtSub(csx + dx, csy + dy);
        if (type === "crosswalk") nearCrosswalk = true;
        else if (type === "highway") nearHighway = true;
        else if (type === "main_road") nearMainRoad = true;
        else if (type === "residential_road") nearResidential = true;
        else if (type === "parking_lot") nearParking = true;
      }
    }
    return formatCrossingContext(nearCrosswalk, nearHighway, nearMainRoad, nearResidential, nearParking);
  }

  function inspectCrossingContext(tx, ty) {
    if (useSubgrid) {
      return inspectCrossingContextAtPx((tx + 0.5) * tileSize, (ty + 0.5) * tileSize);
    }
    let nearCrosswalk = false;
    let nearHighway = false;
    let nearMainRoad = false;
    let nearResidential = false;
    let nearParking = false;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const type = getTileType(tx + dx, ty + dy);
        if (type === "crosswalk") nearCrosswalk = true;
        else if (type === "highway") nearHighway = true;
        else if (type === "main_road") nearMainRoad = true;
        else if (type === "residential_road") nearResidential = true;
        else if (type === "parking_lot") nearParking = true;
      }
    }
    return formatCrossingContext(nearCrosswalk, nearHighway, nearMainRoad, nearResidential, nearParking);
  }

  function getSpeedMultiplier(tileType, wantsFaster, safeCrossingActive = false) {
    if (tileType === "water") {
      return wantsFaster ? 1.08 : 0.72;
    }
    if (!wantsFaster) return 1;
    if (
      tileType === "sidewalk" ||
      tileType === "grass" ||
      tileType === "tall_grass" ||
      tileType === "park" ||
      tileType === "dirt"
    ) {
      return FASTER_MULTIPLIER;
    }
    if (tileType === "sand") return 1.35;
    if (tileType === "crosswalk" && safeCrossingActive) return FASTER_MULTIPLIER;
    if ((tileType === "residential_road" || tileType === "parking_lot") && safeCrossingActive) return 1.25;
    return 1;
  }

  function isRoadTile(tx, ty) {
    return isRoadTileType(getTileType(tx, ty));
  }

  function isBoxOnRoad(cx, cy, hitbox = DEFAULT_HITBOX) {
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;
    if (useSubgrid) {
      const left = Math.floor((cx - halfW) / subCellSize);
      const right = Math.floor((cx + halfW - 0.001) / subCellSize);
      const top = Math.floor((cy - halfH) / subCellSize);
      const bottom = Math.floor((cy + halfH - 0.001) / subCellSize);

      for (let sy = top; sy <= bottom; sy++) {
        for (let sx = left; sx <= right; sx++) {
          if (subgrid.isRoadAtSub(sx, sy)) return true;
        }
      }
      return false;
    }

    const left = Math.floor((cx - halfW) / tileSize);
    const right = Math.floor((cx + halfW - 0.001) / tileSize);
    const top = Math.floor((cy - halfH) / tileSize);
    const bottom = Math.floor((cy + halfH - 0.001) / tileSize);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (isRoadTile(tx, ty)) return true;
      }
    }
    return false;
  }

  function isBoxTouchingTileType(cx, cy, tileType, hitbox = DEFAULT_HITBOX) {
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;
    if (useSubgrid) {
      const left = Math.floor((cx - halfW) / subCellSize);
      const right = Math.floor((cx + halfW - 0.001) / subCellSize);
      const top = Math.floor((cy - halfH) / subCellSize);
      const bottom = Math.floor((cy + halfH - 0.001) / subCellSize);

      for (let sy = top; sy <= bottom; sy++) {
        for (let sx = left; sx <= right; sx++) {
          if (subgrid.getSurfaceTypeAtSub(sx, sy) === tileType) return true;
        }
      }
      return false;
    }

    const left = Math.floor((cx - halfW) / tileSize);
    const right = Math.floor((cx + halfW - 0.001) / tileSize);
    const top = Math.floor((cy - halfH) / tileSize);
    const bottom = Math.floor((cy + halfH - 0.001) / tileSize);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (getTileType(tx, ty) === tileType) return true;
      }
    }
    return false;
  }

  /**
   * Wrap the solid-tile collider so the player CANNOT step off a curb/sidewalk onto
   * any road (street, avenue, highway, crosswalk) without Looking Both Ways first.
   * If the player is already mid-road, they are never trapped and can finish crossing.
   * Also reports when the player bumps a solid divided-highway median barrier.
   */
  function createRoadAwareBlocker(
    baseIsBoxBlocked,
    curX,
    curY,
    safeCrossingActive,
    hitbox = DEFAULT_HITBOX
  ) {
    const alreadyOnRoad = isBoxOnRoad(curX, curY, hitbox);
    let blockedByRoad = false;
    let blockedByMedian = false;
    let blockedByWater = false;

    function isBoxBlocked(nextX, nextY, box = hitbox) {
      if (baseIsBoxBlocked(nextX, nextY, box)) {
        if (isBoxTouchingTileType(nextX, nextY, "highway_median", box)) {
          blockedByMedian = true;
        } else if (
          isBoxTouchingTileType(nextX, nextY, "water", box) &&
          !isBoxTouchingTileType(nextX, nextY, "building_wall", box)
        ) {
          blockedByWater = true;
        }
        return true;
      }
      if (!safeCrossingActive && !alreadyOnRoad && isBoxOnRoad(nextX, nextY, box)) {
        blockedByRoad = true;
        return true;
      }
      return false;
    }

    return {
      isBoxBlocked,
      wasBlockedByRoad: () => blockedByRoad,
      wasBlockedByMedian: () => blockedByMedian,
      wasBlockedByWater: () => blockedByWater,
      wasAlreadyOnRoad: () => alreadyOnRoad,
    };
  }

  /**
   * Track crossing lifecycle: once the player steps onto a road after looking both ways
   * and finishes reaching non-road ground on the far side, reset safeCrossingTimer so
   * the NEXT road crossing requires looking both ways again.
   */
  function updateCrossingProgress(state, currentlyOnRoad) {
    if (currentlyOnRoad) {
      state.hasEnteredRoadSinceLook = true;
      return { finishedCrossing: false };
    }
    if (state.hasEnteredRoadSinceLook) {
      state.hasEnteredRoadSinceLook = false;
      state.safeCrossingTimer = 0;
      return { finishedCrossing: true };
    }
    return { finishedCrossing: false };
  }

  return {
    subgrid,
    subCellSize,
    getTileId,
    getTileType,
    getTileIdAtPx,
    getTileTypeAtPx,
    isRoadTile,
    isRoadAtPx,
    isBoxOnRoad,
    isBoxTouchingTileType,
    createRoadAwareBlocker,
    updateCrossingProgress,
    getStreetZoneAt,
    inspectCrossingContext,
    inspectCrossingContextAtPx,
    getSpeedMultiplier,
  };
}

/**
 * Cleanly disambiguate whether pressing Space / tapping the action button means:
 *   - "look_both_ways": crossing an unchecked road directly ahead of Liam
 *   - "interact": speaking with an NPC, reading a street sign, opening a chest, or shooing street-life
 *
 * Facing-aware rule:
 *   - If Liam just bumped a road curb (curbStopCueTimer > 0), Look Both Ways ALWAYS wins.
 *   - If Liam is standing off-road FACING directly into an unchecked road/crosswalk
 *     (the exact sub-cell/tile ahead of him is an unchecked road), Look Both Ways ALWAYS wins so
 *     corner street signs or nearby NPCs never hijack crossing the street!
 *   - Turn away from the road / toward the NPC or sign -> Interact wins cleanly!
 */
export function resolveActionIntent({
  playerTileX,
  playerTileY,
  playerX = null,
  playerY = null,
  facing = "down",
  headingDeg = 0,
  hardMode = false,
  isOnRoad = false,
  safeCrossingActive = false,
  curbStopCueTimer = 0,
  nearbyInteraction = null,
  isRoadTileFn,
  isRoadAtPxFn = null,
}) {
  let fx = 0;
  let fy = 1;
  if (hardMode) {
    const rad = (headingDeg * Math.PI) / 180;
    const rawX = Math.sin(rad);
    const rawY = -Math.cos(rad);
    const len = Math.hypot(rawX, rawY) || 1;
    fx = rawX / len;
    fy = rawY / len;
  } else if (facing === "up") {
    fx = 0;
    fy = -1;
  } else if (facing === "down") {
    fx = 0;
    fy = 1;
  } else if (facing === "left") {
    fx = -1;
    fy = 0;
  } else if (facing === "right") {
    fx = 1;
    fy = 0;
  }

  let roadDirectlyAhead = false;
  if (typeof playerX === "number" && typeof playerY === "number" && typeof isRoadAtPxFn === "function") {
    roadDirectlyAhead =
      Boolean(isRoadAtPxFn(playerX + fx * 7, playerY + fy * 7)) ||
      Boolean(isRoadAtPxFn(playerX + fx * 12, playerY + fy * 12));
  } else {
    const aheadTx = Math.round(playerTileX + fx);
    const aheadTy = Math.round(playerTileY + fy);
    roadDirectlyAhead = Boolean(isRoadTileFn?.(aheadTx, aheadTy));
  }

  const facingUncheckedRoad = !isOnRoad && !safeCrossingActive && roadDirectlyAhead;

  if (curbStopCueTimer > 0 || facingUncheckedRoad) {
    return {
      mode: "look_both_ways",
      interaction: null,
      alternateInteraction: nearbyInteraction,
      facingUncheckedRoad: true,
    };
  }

  if (nearbyInteraction) {
    return {
      mode: "interact",
      interaction: nearbyInteraction,
      alternateInteraction: null,
      facingUncheckedRoad: false,
    };
  }

  return {
    mode: "look_both_ways",
    interaction: null,
    alternateInteraction: null,
    facingUncheckedRoad: false,
  };
}
