export const TILE_SIZE = 16;
export const PLAYER_SPEED_PX = 68; // pixels per second (~4.25 tiles/sec)
export const CORNER_SLIDE_MAX_PX = 4;

// Sub-tile feet hitbox centered inside a 16x16 sprite
export const DEFAULT_HITBOX = {
  width: 10,
  height: 10,
};

/**
 * Normalize 8-way directional input so diagonal velocity is multiplied by 1/sqrt(2).
 */
export function normalizeMoveInput(dx, dy) {
  const x = Math.sign(dx);
  const y = Math.sign(dy);
  if (x !== 0 && y !== 0) {
    const inv = Math.SQRT1_2;
    return { x: x * inv, y: y * inv };
  }
  return { x, y };
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

  function isSolidTile(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return true;
    return collision[ty * width + tx] === 1;
  }

  /**
   * Check whether an axis-aligned box centered at (cx, cy) overlaps any solid tile.
   */
  function isBoxBlocked(cx, cy, hitbox = DEFAULT_HITBOX) {
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;
    const left = Math.floor((cx - halfW) / tileSize);
    const right = Math.floor((cx + halfW - 0.001) / tileSize);
    const top = Math.floor((cy - halfH) / tileSize);
    const bottom = Math.floor((cy + halfH - 0.001) / tileSize);

    for (let ty = top; ty <= bottom; ty++) {
      for (let tx = left; tx <= right; tx++) {
        if (isSolidTile(tx, ty)) return true;
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
 * Move player with 8-way normalized speed, axis-separated tile collision,
 * and sub-tile 4px corner sliding (both cardinal and diagonal).
 */
export function moveWithCollision(state, rawInput, dt, isBoxBlocked, options = {}) {
  const speed = options.speed ?? PLAYER_SPEED_PX;
  const hitbox = options.hitbox ?? DEFAULT_HITBOX;
  const maxSlidePx = options.maxSlidePx ?? CORNER_SLIDE_MAX_PX;

  const norm = normalizeMoveInput(rawInput.x, rawInput.y);
  const facing = resolveCardinalFacing(rawInput.x, rawInput.y, state.facing);

  if (norm.x === 0 && norm.y === 0) {
    return {
      x: state.x,
      y: state.y,
      facing,
      moving: false,
      slidCorner: false,
    };
  }

  let x = state.x;
  let y = state.y;
  let slidCorner = false;

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
      }
    }
  }

  return {
    x,
    y,
    facing,
    moving: x !== state.x || y !== state.y || norm.x !== 0 || norm.y !== 0,
    slidCorner,
  };
}
