/**
 * Street zone, tile classification, per-address house lookup, and pedestrian safety mechanics:
 *   - "FASTER" travel speed multiplier (fast on sidewalks/parks/tall_grass, careful pace on roads)
 *   - "LOOK BOTH WAYS" curb/crosswalk check with Safety XP rewards
 */

export const FASTER_MULTIPLIER = 1.65;
export const LOOK_DURATION_SEC = 0.65;
export const SAFE_CROSSING_DURATION_SEC = 4.5;

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

  function getTileId(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return 5;
    return base[ty * width + tx];
  }

  function getTileType(tx, ty) {
    const id = getTileId(tx, ty);
    return legend[String(id)] || "grass";
  }

  function getStreetZoneAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return null;
    const idx = zoneIndexGrid[ty * width + tx];
    if (idx === -1) return null;
    return streetZones[idx];
  }

  function inspectCrossingContext(tx, ty) {
    let nearCrosswalk = false;
    let nearMainRoad = false;
    let nearResidential = false;
    let nearParking = false;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const type = getTileType(tx + dx, ty + dy);
        if (type === "crosswalk") nearCrosswalk = true;
        else if (type === "main_road") nearMainRoad = true;
        else if (type === "residential_road") nearResidential = true;
        else if (type === "parking_lot") nearParking = true;
      }
    }

    if (nearCrosswalk) {
      return {
        context: "crosswalk",
        xpReward: 5,
        message: "👀 Looked Both Ways at Crosswalk! +5 Safety XP",
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

  function getSpeedMultiplier(tileType, wantsFaster, safeCrossingActive = false) {
    if (!wantsFaster) return 1;
    if (tileType === "sidewalk" || tileType === "grass" || tileType === "tall_grass") {
      return FASTER_MULTIPLIER;
    }
    if (tileType === "crosswalk" && safeCrossingActive) return FASTER_MULTIPLIER;
    if ((tileType === "residential_road" || tileType === "parking_lot") && safeCrossingActive) return 1.25;
    return 1;
  }

  return {
    getTileId,
    getTileType,
    getStreetZoneAt,
    inspectCrossingContext,
    getSpeedMultiplier,
  };
}
