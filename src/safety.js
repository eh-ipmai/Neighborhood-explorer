/**
 * Street zone, tile classification, and pedestrian travel safety mechanics:
 *   - "FASTER" travel speed multiplier (fast on sidewalks/parks, careful pace on busy roads)
 *   - "LOOK BOTH WAYS" curb/crosswalk check with Safety XP rewards
 */

export const FASTER_MULTIPLIER = 1.65;
export const LOOK_DURATION_SEC = 0.65;
export const SAFE_CROSSING_DURATION_SEC = 4.5;

export function createSafetySystem(worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const legend = worldMap.legend || {};
  const streetZones = worldMap.streetZones || [];

  // Build an O(1) lookup grid from streetZones bounds so runtime checks stay instant
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

  /**
   * Scan the player's current tile and 1-tile neighborhood to see if they are
   * at a crosswalk or next to a street curb when pressing "Look Both Ways".
   */
  function inspectCrossingContext(tx, ty) {
    let nearCrosswalk = false;
    let nearMainRoad = false;
    let nearResidential = false;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const type = getTileType(tx + dx, ty + dy);
        if (type === "crosswalk") nearCrosswalk = true;
        else if (type === "main_road") nearMainRoad = true;
        else if (type === "residential_road") nearResidential = true;
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
    return {
      context: "clear",
      xpReward: 0,
      message: "👀 Looked Left & Right — All Clear!",
    };
  }

  /**
   * Compute effective speed multiplier when player holds FASTER.
   * Safe sidewalks/parks (and checked crosswalks) allow full FASTER boost;
   * unchecked streets keep travel at a careful walking pace.
   */
  function getSpeedMultiplier(tileType, wantsFaster, safeCrossingActive = false) {
    if (!wantsFaster) return 1;
    if (tileType === "sidewalk" || tileType === "grass") return FASTER_MULTIPLIER;
    if (tileType === "crosswalk" && safeCrossingActive) return FASTER_MULTIPLIER;
    if (tileType === "residential_road" && safeCrossingActive) return 1.25;
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
