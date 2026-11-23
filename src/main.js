import { createRenderer } from "./renderer.js";
import {
  TILE_SIZE,
  PLAYER_SPEED_PX,
  DEFAULT_HITBOX,
  createMapCollider,
  moveWithCollision,
} from "./player.js";
import {
  createSafetySystem,
  LOOK_DURATION_SEC,
  SAFE_CROSSING_DURATION_SEC,
} from "./safety.js";
import { createUI } from "./ui.js";
import {
  playStreetBannerChime,
  playLookBothWaysChime,
  playStepTick,
} from "./audio.js";

const VIEW_W = 320;
const VIEW_H = 180;

// Greybox tile palette (Phase 1)
const TILE_COLORS = {
  0: [92, 158, 78],   // grass
  1: [216, 211, 196], // sidewalk
  2: [109, 116, 128], // residential_road
  3: [70, 76, 86],    // main_road
  4: [70, 76, 86],    // crosswalk base
  5: [140, 109, 98],  // building_wall
  6: [59, 125, 216],  // water
};

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${res.status}`);
  }
  return res.json();
}

async function boot() {
  const [worldMap, landmarks, quests] = await Promise.all([
    loadJson("./data/world_map.json"),
    loadJson("./data/landmarks.json").catch(() => []),
    loadJson("./data/quests.json").catch(() => []),
  ]);

  const tileSize = worldMap.tileSize || TILE_SIZE;
  const mapW = worldMap.dimensions.width;
  const mapH = worldMap.dimensions.height;
  const baseLayer = worldMap.layers.base;
  const collisionLayer = worldMap.layers.collision;

  const collider = createMapCollider(worldMap);
  const safety = createSafetySystem(worldMap);

  const spawnTile = worldMap.origin?.spawnTile || {
    x: Math.floor(mapW / 2),
    y: Math.floor(mapH / 2),
  };

  const playerState = {
    x: spawnTile.x * tileSize + tileSize / 2,
    y: spawnTile.y * tileSize + tileSize / 2,
    facing: "down",
    moving: false,
    walkTimer: 0,
    stepSoundCooldown: 0,
    safetyXP: 0,
    lookTimer: 0,
    lookSavedFacing: "down",
    safeCrossingTimer: 0,
    lastLookAwardTileKey: "",
    lastLookAwardTime: -99,
    elapsedTime: 0,
  };

  // Lightweight dust puff particles when holding FASTER
  const dustPuffs = [];
  let dustCooldown = 0;

  let showDebug = false;
  let lastStreetName = "";

  const k = createRenderer({
    width: VIEW_W,
    height: VIEW_H,
    canvas: document.getElementById("game-canvas"),
    background: [20, 28, 24],
  });

  function resetToHome() {
    playerState.x = spawnTile.x * tileSize + tileSize / 2;
    playerState.y = spawnTile.y * tileSize + tileSize / 2;
    playerState.facing = "down";
    playerState.lookTimer = 0;
  }

  let ui;

  function triggerLookBothWays() {
    if (playerState.lookTimer > 0) return;

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    const result = safety.inspectCrossingContext(tx, ty);

    playerState.lookSavedFacing = playerState.facing;
    playerState.lookTimer = LOOK_DURATION_SEC;

    const tileKey = `${Math.floor(tx / 2)},${Math.floor(ty / 2)}`;
    const canAwardXP =
      result.xpReward > 0 &&
      (tileKey !== playerState.lastLookAwardTileKey ||
        playerState.elapsedTime - playerState.lastLookAwardTime > 8);

    if (canAwardXP) {
      playerState.safetyXP += result.xpReward;
      playerState.lastLookAwardTileKey = tileKey;
      playerState.lastLookAwardTime = playerState.elapsedTime;
    }

    if (result.context !== "clear") {
      playerState.safeCrossingTimer = SAFE_CROSSING_DURATION_SEC;
    }

    playLookBothWaysChime(canAwardXP);
    ui?.showSafetyToast(
      canAwardXP ? result.message : "👀 Looked Left & Right — Stay Safe!"
    );
  }

  ui = createUI({
    onToggleDebug: () => {
      showDebug = !showDebug;
      return showDebug;
    },
    onResetHome: resetToHome,
    onLookBothWays: triggerLookBothWays,
  });

  k.onKeyPress("c", () => {
    showDebug = !showDebug;
  });

  k.onKeyPress("h", () => {
    resetToHome();
  });

  k.onKeyPress("space", triggerLookBothWays);
  k.onKeyPress("e", triggerLookBothWays);

  function readInput() {
    let dx = 0;
    let dy = 0;

    if (k.isKeyDown("left") || k.isKeyDown("a")) dx -= 1;
    if (k.isKeyDown("right") || k.isKeyDown("d")) dx += 1;
    if (k.isKeyDown("up") || k.isKeyDown("w")) dy -= 1;
    if (k.isKeyDown("down") || k.isKeyDown("s")) dy += 1;

    const touch = ui.getTouchInput();
    if (dx === 0 && dy === 0) {
      dx = touch.x;
      dy = touch.y;
    }

    const wantsFaster =
      k.isKeyDown("shift") || k.isKeyDown("b") || ui.isFasterHeld();

    return { x: dx, y: dy, wantsFaster };
  }

  function findNearestLandmark(tx, ty) {
    let best = null;
    for (const lm of landmarks) {
      const distTiles = Math.hypot(lm.tileX - tx, lm.tileY - ty);
      if (!best || distTiles < best.distTiles) {
        best = { landmark: lm, distTiles };
      }
    }
    return best;
  }

  function clampCamera(px, py) {
    const worldPxW = mapW * tileSize;
    const worldPxH = mapH * tileSize;
    const halfW = VIEW_W / 2;
    const halfH = VIEW_H / 2;
    const cx = worldPxW <= VIEW_W ? worldPxW / 2 : Math.max(halfW, Math.min(worldPxW - halfW, px));
    const cy = worldPxH <= VIEW_H ? worldPxH / 2 : Math.max(halfH, Math.min(worldPxH - halfH, py));
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  let cam = clampCamera(playerState.x, playerState.y);
  k.setCamPos(cam.x, cam.y);

  k.onUpdate(() => {
    const dt = Math.min(k.dt(), 0.05);
    playerState.elapsedTime += dt;

    if (playerState.safeCrossingTimer > 0) {
      playerState.safeCrossingTimer = Math.max(0, playerState.safeCrossingTimer - dt);
    }

    // Update dust puff particles
    for (let i = dustPuffs.length - 1; i >= 0; i--) {
      dustPuffs[i].life -= dt;
      dustPuffs[i].y -= dt * 8;
      if (dustPuffs[i].life <= 0) dustPuffs.splice(i, 1);
    }

    const curTx = Math.floor(playerState.x / tileSize);
    const curTy = Math.floor(playerState.y / tileSize);
    const curTileType = safety.getTileType(curTx, curTy);

    let isFasterActive = false;

    if (playerState.lookTimer > 0) {
      // Pause briefly while actively looking left -> right -> center
      playerState.lookTimer = Math.max(0, playerState.lookTimer - dt);
      const progress = 1 - playerState.lookTimer / LOOK_DURATION_SEC;
      if (progress < 0.4) {
        playerState.facing = "left";
      } else if (progress < 0.8) {
        playerState.facing = "right";
      } else {
        playerState.facing = playerState.lookSavedFacing;
      }
      playerState.moving = false;
      playerState.walkTimer = 0;
    } else {
      const input = readInput();
      const speedMult = safety.getSpeedMultiplier(
        curTileType,
        input.wantsFaster,
        playerState.safeCrossingTimer > 0
      );
      isFasterActive = speedMult > 1 && (input.x !== 0 || input.y !== 0);

      const moved = moveWithCollision(
        playerState,
        input,
        dt,
        collider.isBoxBlocked,
        { speed: PLAYER_SPEED_PX * speedMult }
      );
      playerState.x = moved.x;
      playerState.y = moved.y;
      playerState.facing = moved.facing;
      playerState.moving = moved.moving;

      if (moved.moving) {
        playerState.walkTimer += dt * (isFasterActive ? 14 : 9);
        playerState.stepSoundCooldown -= dt;
        if (playerState.stepSoundCooldown <= 0) {
          playStepTick(curTileType === "grass", isFasterActive);
          playerState.stepSoundCooldown = isFasterActive ? 0.16 : 0.24;
        }
        if (isFasterActive) {
          dustCooldown -= dt;
          if (dustCooldown <= 0) {
            dustPuffs.push({
              x: playerState.x + (Math.random() * 4 - 2),
              y: playerState.y + 4,
              life: 0.25,
            });
            dustCooldown = 0.08;
          }
        }
      } else {
        playerState.walkTimer = 0;
        playerState.stepSoundCooldown = 0;
      }
    }

    cam = clampCamera(playerState.x, playerState.y);
    k.setCamPos(cam.x, cam.y);

    const tx = Math.floor(playerState.x / tileSize);
    const ty = Math.floor(playerState.y / tileSize);
    const tileType = safety.getTileType(tx, ty);
    const streetZone = safety.getStreetZoneAt(tx, ty);

    if (streetZone && streetZone.name !== lastStreetName) {
      lastStreetName = streetZone.name;
      playStreetBannerChime();
    }

    ui.updateHUD({
      tileX: tx,
      tileY: ty,
      tileType,
      streetZone,
      originName: worldMap.origin?.name,
      nearestLandmark: findNearestLandmark(tx, ty),
      debugEnabled: showDebug,
      safetyXP: playerState.safetyXP,
      isFasterActive,
      safeCrossingActive: playerState.safeCrossingTimer > 0,
    });
  });

  function drawTile(tx, ty, tileId) {
    const px = tx * tileSize;
    const py = ty * tileSize;
    const c = TILE_COLORS[tileId] || TILE_COLORS[0];

    k.drawRect({
      pos: k.vec2(px, py),
      width: tileSize,
      height: tileSize,
      color: k.rgb(c[0], c[1], c[2]),
    });

    if (tileId === 0) {
      if ((tx * 7 + ty * 13) % 5 === 0) {
        k.drawRect({
          pos: k.vec2(px + 4, py + 6),
          width: 2,
          height: 2,
          color: k.rgb(115, 181, 97),
        });
      }
    } else if (tileId === 1) {
      k.drawRect({
        pos: k.vec2(px, py + tileSize - 1),
        width: tileSize,
        height: 1,
        color: k.rgb(192, 186, 170),
      });
    } else if (tileId === 2) {
      if ((tx + ty) % 2 === 0) {
        k.drawRect({
          pos: k.vec2(px + 6, py + 7),
          width: 4,
          height: 2,
          color: k.rgb(142, 149, 160),
        });
      }
    } else if (tileId === 3) {
      k.drawRect({
        pos: k.vec2(px + 2, py + 7),
        width: 12,
        height: 2,
        color: k.rgb(214, 180, 76),
      });
    } else if (tileId === 4) {
      for (let s = 2; s < tileSize - 2; s += 4) {
        k.drawRect({
          pos: k.vec2(px + 2, py + s),
          width: tileSize - 4,
          height: 2,
          color: k.rgb(242, 244, 248),
        });
      }
    } else if (tileId === 5) {
      k.drawRect({
        pos: k.vec2(px, py),
        width: tileSize,
        height: 2,
        color: k.rgb(166, 134, 122),
      });
      k.drawRect({
        pos: k.vec2(px, py + tileSize - 4),
        width: tileSize,
        height: 4,
        color: k.rgb(92, 68, 60),
      });
    } else if (tileId === 6) {
      if ((tx + ty) % 2 === 0) {
        k.drawRect({
          pos: k.vec2(px + 3, py + 5),
          width: 6,
          height: 2,
          color: k.rgb(99, 164, 245),
        });
      }
    }
  }

  function drawPlayer() {
    const px = Math.round(playerState.x);
    const py = Math.round(playerState.y);
    const bob = playerState.moving ? Math.round(Math.sin(playerState.walkTimer) * 1.2) : 0;

    // Subtle green safe-crossing aura when the player recently looked both ways
    if (playerState.safeCrossingTimer > 0) {
      k.drawRect({
        pos: k.vec2(px - 7, py + 1),
        width: 14,
        height: 6,
        color: k.rgb(110, 231, 168),
        opacity: 0.35,
      });
    }

    // Ground shadow
    k.drawRect({
      pos: k.vec2(px - 5, py + 3),
      width: 10,
      height: 3,
      color: k.rgb(20, 24, 20),
      opacity: 0.4,
    });

    // Legs / shoes
    const leftLegY = py + 1 + (bob > 0 ? -1 : 0);
    const rightLegY = py + 1 + (bob < 0 ? -1 : 0);
    k.drawRect({ pos: k.vec2(px - 4, leftLegY), width: 3, height: 4, color: k.rgb(42, 58, 92) });
    k.drawRect({ pos: k.vec2(px + 1, rightLegY), width: 3, height: 4, color: k.rgb(42, 58, 92) });

    // Backpack
    if (playerState.facing === "left") {
      k.drawRect({ pos: k.vec2(px + 3, py - 5), width: 3, height: 6, color: k.rgb(218, 92, 64) });
    } else if (playerState.facing === "right") {
      k.drawRect({ pos: k.vec2(px - 6, py - 5), width: 3, height: 6, color: k.rgb(218, 92, 64) });
    }

    // Torso (bright explorer hoodie)
    k.drawRect({
      pos: k.vec2(px - 4, py - 5),
      width: 8,
      height: 7,
      color: k.rgb(48, 168, 146),
    });

    if (playerState.facing === "up") {
      k.drawRect({
        pos: k.vec2(px - 3, py - 4),
        width: 6,
        height: 5,
        color: k.rgb(218, 92, 64),
      });
    }

    // Head
    k.drawRect({
      pos: k.vec2(px - 4, py - 11),
      width: 8,
      height: 6,
      color: k.rgb(245, 210, 178),
    });

    // Cap / Hair
    k.drawRect({
      pos: k.vec2(px - 4, py - 12),
      width: 8,
      height: 3,
      color: k.rgb(235, 184, 52),
    });

    // Eyes based on 4-way cardinal facing
    if (playerState.facing === "down") {
      k.drawRect({ pos: k.vec2(px - 2, py - 8), width: 1, height: 2, color: k.rgb(24, 24, 30) });
      k.drawRect({ pos: k.vec2(px + 1, py - 8), width: 1, height: 2, color: k.rgb(24, 24, 30) });
    } else if (playerState.facing === "left") {
      k.drawRect({ pos: k.vec2(px - 3, py - 8), width: 1, height: 2, color: k.rgb(24, 24, 30) });
    } else if (playerState.facing === "right") {
      k.drawRect({ pos: k.vec2(px + 2, py - 8), width: 1, height: 2, color: k.rgb(24, 24, 30) });
    }

    // Visual glance indicator when actively Looking Both Ways
    if (playerState.lookTimer > 0) {
      if (playerState.facing === "left") {
        k.drawRect({ pos: k.vec2(px - 10, py - 9), width: 4, height: 2, color: k.rgb(110, 231, 168) });
        k.drawRect({ pos: k.vec2(px - 12, py - 10), width: 2, height: 4, color: k.rgb(244, 211, 94) });
      } else if (playerState.facing === "right") {
        k.drawRect({ pos: k.vec2(px + 6, py - 9), width: 4, height: 2, color: k.rgb(110, 231, 168) });
        k.drawRect({ pos: k.vec2(px + 10, py - 10), width: 2, height: 4, color: k.rgb(244, 211, 94) });
      }
    }

    // Debug sub-tile hitbox overlay
    if (showDebug) {
      k.drawRect({
        pos: k.vec2(playerState.x - DEFAULT_HITBOX.width / 2, playerState.y - DEFAULT_HITBOX.height / 2),
        width: DEFAULT_HITBOX.width,
        height: DEFAULT_HITBOX.height,
        color: k.rgb(60, 240, 110),
        opacity: 0.35,
        outline: { width: 1, color: k.rgb(60, 240, 110) },
      });
    }
  }

  k.onDraw(() => {
    const startX = Math.max(0, Math.floor((cam.x - VIEW_W / 2) / tileSize) - 1);
    const endX = Math.min(mapW - 1, Math.ceil((cam.x + VIEW_W / 2) / tileSize) + 1);
    const startY = Math.max(0, Math.floor((cam.y - VIEW_H / 2) / tileSize) - 1);
    const endY = Math.min(mapH - 1, Math.ceil((cam.y + VIEW_H / 2) / tileSize) + 1);

    for (let ty = startY; ty <= endY; ty++) {
      const rowOffset = ty * mapW;
      for (let tx = startX; tx <= endX; tx++) {
        const idx = rowOffset + tx;
        drawTile(tx, ty, baseLayer[idx]);

        if (showDebug) {
          if (collisionLayer[idx] === 1) {
            k.drawRect({
              pos: k.vec2(tx * tileSize, ty * tileSize),
              width: tileSize,
              height: tileSize,
              color: k.rgb(235, 64, 52),
              opacity: 0.32,
            });
          }
          k.drawRect({
            pos: k.vec2(tx * tileSize, ty * tileSize),
            width: tileSize,
            height: tileSize,
            fill: false,
            outline: { width: 0.5, color: k.rgb(0, 0, 0), opacity: 0.2 },
          });
        }
      }
    }

    // Draw dust puffs from FASTER travel
    for (const p of dustPuffs) {
      k.drawRect({
        pos: k.vec2(p.x - 1, p.y - 1),
        width: 3,
        height: 3,
        color: k.rgb(240, 238, 224),
        opacity: Math.max(0.1, p.life * 3),
      });
    }

    // Draw visible landmark markers
    for (const lm of landmarks) {
      if (lm.tileX < startX - 2 || lm.tileX > endX + 2 || lm.tileY < startY - 2 || lm.tileY > endY + 2) {
        continue;
      }
      const lx = lm.tileX * tileSize + tileSize / 2;
      const ly = lm.tileY * tileSize + tileSize / 2;
      k.drawRect({
        pos: k.vec2(lx - 5, ly - 5),
        width: 10,
        height: 10,
        color: k.rgb(244, 211, 94),
        outline: { width: 1, color: k.rgb(42, 30, 12) },
      });
      k.drawRect({
        pos: k.vec2(lx - 2, ly - 2),
        width: 4,
        height: 4,
        color: k.rgb(235, 94, 52),
      });
    }

    drawPlayer();
  });

  window.__NEIGHBORHOOD_EXPLORER__ = {
    rendererMode: k.mode,
    worldMap,
    landmarks,
    quests,
    playerState,
  };
}

boot().catch((err) => {
  console.error("Neighborhood Explorer failed to start:", err);
  const banner = document.getElementById("street-name");
  if (banner) banner.textContent = `Load error: ${err.message}`;
});
