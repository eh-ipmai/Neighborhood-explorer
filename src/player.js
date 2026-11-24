export const TILE_SIZE = 16;
export const PLAYER_SPEED_PX = 68; // pixels per second (~4.25 tiles/sec)
export const CORNER_SLIDE_MAX_PX = 4;

// Sub-tile feet hitbox centered inside a 16x16 sprite
export const DEFAULT_HITBOX = {
  width: 10,
  height: 10,
};

/**
 * Normalize directional movement input into a unit vector.
 * Zeroes out tiny floating-point trig epsilons (e.g. cos(90°) = 6.12e-17) so cardinal
 * headings in Hard Mode NEVER drift diagonally, while preserving exact arbitrary-angle
 * vectors during smooth turns and exact 1/sqrt(2) scaling for 8-way input!
 */
export function normalizeMoveInput(dx, dy) {
  const x = Math.abs(dx) < 1e-6 ? 0 : dx;
  const y = Math.abs(dy) < 1e-6 ? 0 : dy;
  const len = Math.hypot(x, y);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * Lock 4-way cardinal facing direction from 8-way movement input.
 * Keeps current facing if input is zero or still moving along the current axis.
 */
export function resolveCardinalFacing(dx, dy, currentFacing = "down") {
  if (dx === 0 && dy === 0) return currentFacing;

  if (dx !== 0 && dy === 0) return dx > 0 ? "right" : "left";
  if (dy !== 0 && dx === 0) return dy > 0 ? "down" : "up";

  // Diagonal: preserve current axis if it matches input, otherwise prefer horizontal
  if ((currentFacing === "left" && dx < 0) || (currentFacing === "right" && dx > 0)) {
    return currentFacing;
  }
  if ((currentFacing === "up" && dy < 0) || (currentFacing === "down" && dy > 0)) {
    return currentFacing;
  }
  return dx > 0 ? "right" : "left";
}

/**
 * Create an O(1) tile collision checker bound to world_map.json.
 */
export function createMapCollider(worldMap) {
  const { width, height } = worldMap.dimensions;
  const tileSize = worldMap.tileSize || TILE_SIZE;
  const collision = worldMap.layers.collision;
  const base = worldMap.layers.base;
  const legend = worldMap.legend || {};
  const waterEntry = Object.entries(legend).find(([, name]) => name === "water");
  const waterTileId = waterEntry ? Number(waterEntry[0]) : 6;

  function isSolidTile(tx, ty, options = {}) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return true;
    const idx = ty * width + tx;
    if (collision[idx] !== 1) return false;
    if (options?.canWadeWater && base && base[idx] === waterTileId) {
      return false;
    }
    return true;
  }

  /**
   * Check whether an axis-aligned box centered at (cx, cy) overlaps any solid tile.
   */
  function isBoxBlocked(cx, cy, hitbox = DEFAULT_HITBOX, options = {}) {
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;
    const left = Math.floor((cx - halfW) / tileSize);
    const right = Math.floor((cx + halfW - 0.001) / tileSize);
    const top = Math.floor((cy - halfH) / tileSize);
    const bottom = Math.floor((cy + halfH - 0.001) / tileSize);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (isSolidTile(tx, ty, options)) return true;
      }
    }
    return false;
  }

  return { isSolidTile, isBoxBlocked, tileSize };
}

/**
 * Find a corner-slide nudge perpendicular to the blocked movement axis,
 * up to maxSlidePx (4px per GDD Section 5).
 */
function findCornerSlideOffset(cx, cy, stepX, stepY, isBoxBlocked, hitbox, maxSlidePx) {
  for (let offset = 1; offset <= maxSlidePx; offset++) {
    if (stepX !== 0) {
      const canSlideUp = !isBoxBlocked(cx + stepX, cy - offset, hitbox) && !isBoxBlocked(cx, cy - offset, hitbox);
      const canSlideDown = !isBoxBlocked(cx + stepX, cy + offset, hitbox) && !isBoxBlocked(cx, cy + offset, hitbox);
      if (canSlideUp && !canSlideDown) return { dx: 0, dy: -1 };
      if (canSlideDown && !canSlideUp) return { dx: 0, dy: 1 };
    } else if (stepY !== 0) {
      const canSlideLeft = !isBoxBlocked(cx - offset, cy + stepY, hitbox) && !isBoxBlocked(cx - offset, cy, hitbox);
      const canSlideRight = !isBoxBlocked(cx + offset, cy + stepY, hitbox) && !isBoxBlocked(cx + offset, cy, hitbox);
      if (canSlideLeft && !canSlideRight) return { dx: -1, dy: 0 };
      if (canSlideRight && !canSlideLeft) return { dx: 1, dy: 0 };
    }
  }
  return null;
}

/**
 * When walking cardinally along a sidewalk/path and hitting a 1-tile diagonal bend
 * (where the road shifts 1 tile sideways and the sidewalk continues diagonally ahead),
 * detect the unambiguous continuation direction so the player glides smoothly around
 * gentle street bends instead of dead-stopping at every step!
 */
function findPathBendGlideDir(x, y, axis, stepDir, isBoxBlocked, hitbox, isPreferredPathTile, tileSize) {
  if (typeof isPreferredPathTile !== "function") return null;
  const tx = Math.floor(x / tileSize);
  const ty = Math.floor(y / tileSize);
  if (!isPreferredPathTile(tx, ty)) return null;

  const probePx = Math.min(4, tileSize / 4);
  if (axis === "x") {
    const aheadX = tx + stepDir;
    const upTarget = isPreferredPathTile(aheadX, ty - 1);
    const downTarget = isPreferredPathTile(aheadX, ty + 1);
    // Only glide when EXACTLY ONE diagonal continues the path (never at perpendicular straight curbs!)
    if (upTarget && !downTarget && !isBoxBlocked(x, y - probePx, hitbox)) {
      return { dx: 0, dy: -1 };
    }
    if (downTarget && !upTarget && !isBoxBlocked(x, y + probePx, hitbox)) {
      return { dx: 0, dy: 1 };
    }
  } else {
    const aheadY = ty + stepDir;
    const leftTarget = isPreferredPathTile(tx - 1, aheadY);
    const rightTarget = isPreferredPathTile(tx + 1, aheadY);
    if (leftTarget && !rightTarget && !isBoxBlocked(x - probePx, y, hitbox)) {
      return { dx: -1, dy: 0 };
    }
    if (rightTarget && !leftTarget && !isBoxBlocked(x + probePx, y, hitbox)) {
      return { dx: 1, dy: 0 };
    }
  }
  return null;
}

/**
 * Move player with 8-way normalized speed, axis-separated tile collision,
 * sub-tile 4px corner sliding, and optional smooth sidewalk bend-gliding.
 */
export function moveWithCollision(state, rawInput, dt, isBoxBlocked, options = {}) {
  const speed = options.speed ?? PLAYER_SPEED_PX;
  const hitbox = options.hitbox ?? DEFAULT_HITBOX;
  const maxSlidePx = options.maxSlidePx ?? CORNER_SLIDE_MAX_PX;
  const isPreferredPathTile = options.isPreferredPathTile ?? null;
  const tileSize = options.tileSize ?? TILE_SIZE;

  const norm = normalizeMoveInput(rawInput.x, rawInput.y);
  const facing = resolveCardinalFacing(rawInput.x, rawInput.y, state.facing);

  if (norm.x === 0 && norm.y === 0) {
    return {
      x: state.x,
      y: state.y,
      facing,
      moving: false,
      slidCorner: false,
      glidedBend: false,
    };
  }

  let x = state.x;
  let y = state.y;
  let slidCorner = false;
  let glidedBend = false;

  const moveX = norm.x * speed * dt;
  const moveY = norm.y * speed * dt;
  const slideSpeed = Math.abs(moveX || moveY);

  // Resolve X axis
  if (moveX !== 0) {
    const nextX = x + moveX;
    if (!isBoxBlocked(nextX, y, hitbox)) {
      x = nextX;
    } else {
      // Try 4px corner slide along Y
      const nudge = findCornerSlideOffset(x, y, Math.sign(moveX) * Math.max(1, Math.abs(moveX)), 0, isBoxBlocked, hitbox, maxSlidePx);
      if (nudge) {
        const slideY = y + nudge.dy * Math.min(slideSpeed, maxSlidePx);
        if (!isBoxBlocked(x, slideY, hitbox)) {
          y = slideY;
          slidCorner = true;
          if (!isBoxBlocked(nextX, y, hitbox)) {
            x = nextX;
          }
        }
      } else if (moveY === 0) {
        // Smooth sidewalk bend-glide: follow a 1-tile diagonal sidewalk bend without dead-stopping!
        const bend = findPathBendGlideDir(x, y, "x", Math.sign(moveX), isBoxBlocked, hitbox, isPreferredPathTile, tileSize);
        if (bend) {
          const glideY = y + bend.dy * slideSpeed;
          if (!isBoxBlocked(x, glideY, hitbox)) {
            y = glideY;
            glidedBend = true;
            if (!isBoxBlocked(nextX, y, hitbox)) {
              x = nextX;
            }
          }
        }
      }
    }
  }

  // Resolve Y axis
  if (moveY !== 0) {
    const nextY = y + moveY;
    if (!isBoxBlocked(x, nextY, hitbox)) {
      y = nextY;
    } else {
      // Try 4px corner slide along X
      const nudge = findCornerSlideOffset(x, y, 0, Math.sign(moveY) * Math.max(1, Math.abs(moveY)), isBoxBlocked, hitbox, maxSlidePx);
      if (nudge) {
        const slideX = x + nudge.dx * Math.min(slideSpeed, maxSlidePx);
        if (!isBoxBlocked(slideX, y, hitbox)) {
          x = slideX;
          slidCorner = true;
          if (!isBoxBlocked(x, nextY, hitbox)) {
            y = nextY;
          }
        }
      } else if (moveX === 0) {
        const bend = findPathBendGlideDir(x, y, "y", Math.sign(moveY), isBoxBlocked, hitbox, isPreferredPathTile, tileSize);
        if (bend) {
          const glideX = x + bend.dx * slideSpeed;
          if (!isBoxBlocked(glideX, y, hitbox)) {
            x = glideX;
            glidedBend = true;
            if (!isBoxBlocked(x, nextY, hitbox)) {
              y = nextY;
            }
          }
        }
      }
    }
  }

  return {
    x,
    y,
    facing,
    moving: x !== state.x || y !== state.y || norm.x !== 0 || norm.y !== 0,
    slidCorner,
    glidedBend,
  };
}
