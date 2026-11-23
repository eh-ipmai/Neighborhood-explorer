/**
 * Phase 3: Fog-of-War Folded Paper Map Overlay
 * Renders the 512x512 Newton Centre neighborhood as a warm hand-folded parchment map
 * that unrolls as the player explores streets and discovers landmarks.
 */

import { FOG_GRID_SIZE } from "./quests.js";

// Vintage illustrated parchment map colors
const MAP_TILE_INK = {
  0: "#b8cfa0", // grass (soft sage watercolor)
  1: "#e6dbc3", // sidewalk (light parchment)
  2: "#d2c3a4", // residential road
  3: "#d99b4e", // Boylston St / arterial road (warm golden ochre)
  4: "#fff5d6", // crosswalk
  5: "#a87b64", // houses / buildings (terracotta ink)
  6: "#5d9bd4", // Crystal Lake / water
  7: "#8fb878", // Oakdale Woods / tall grass parks
  8: "#b8b0a2", // parking lots
};

export function createPaperMapRenderer(worldMap) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;

  // Bake full miniature parchment base map ONCE (256x256 px) so opening the map is instant
  const MAP_PX = 256;
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = MAP_PX;
  baseCanvas.height = MAP_PX;
  const bCtx = baseCanvas.getContext("2d");
  bCtx.imageSmoothingEnabled = false;

  bCtx.fillStyle = "#e8d8b5";
  bCtx.fillRect(0, 0, MAP_PX, MAP_PX);

  const stepX = width / MAP_PX;
  const stepY = height / MAP_PX;

  for (let py = 0; py < MAP_PX; py++) {
    const ty = Math.min(height - 1, Math.floor(py * stepY));
    const rowOffset = ty * width;
    for (let px = 0; px < MAP_PX; px++) {
      const tx = Math.min(width - 1, Math.floor(px * stepX));
      const id = base[rowOffset + tx];
      bCtx.fillStyle = MAP_TILE_INK[id] || MAP_TILE_INK[0];
      bCtx.fillRect(px, py, 1, 1);
    }
  }

  /**
   * Render the live Folded Paper Map with fog-of-war, hand-folded paper creases,
   * discovered landmark pins, pulsing active quest beacon, and player pin.
   */
  function renderToCanvas(targetCanvas, { questSystem, playerTileX, playerTileY, timeSec = 0 }) {
    if (!targetCanvas) return;
    targetCanvas.width = MAP_PX;
    targetCanvas.height = MAP_PX;
    const ctx = targetCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // 1. Draw revealed world miniature
    ctx.drawImage(baseCanvas, 0, 0);

    // 2. Overlay hand-drawn parchment fog-of-war on unexplored cells
    const cellW = MAP_PX / FOG_GRID_SIZE;
    const cellH = MAP_PX / FOG_GRID_SIZE;
    const fog = questSystem.state.fogCells;

    for (let gy = 0; gy < FOG_GRID_SIZE; gy++) {
      for (let gx = 0; gx < FOG_GRID_SIZE; gx++) {
        if (fog[gy * FOG_GRID_SIZE + gx] === 1) continue;
        const x = Math.floor(gx * cellW);
        const y = Math.floor(gy * cellH);
        const w = Math.ceil(cellW);
        const h = Math.ceil(cellH);
        // Subtle parchment grain tone variation
        ctx.fillStyle = (gx + gy) % 2 === 0 ? "#e6d4ad" : "#dfcca3";
        ctx.fillRect(x, y, w, h);
        // Soft ink-dotted fog motif
        if ((gx * 7 + gy * 11) % 5 === 0) {
          ctx.fillStyle = "rgba(138, 114, 78, 0.25)";
          ctx.fillRect(x + 2, y + 3, 3, 1);
          ctx.fillRect(x + 3, y + 2, 2, 1);
        }
      }
    }

    // 3. Hand-folded paper creases (3 vertical panels x 2 horizontal folds)
    for (const fx of [Math.floor(MAP_PX / 3), Math.floor((MAP_PX * 2) / 3)]) {
      ctx.fillStyle = "rgba(74, 54, 28, 0.2)";
      ctx.fillRect(fx, 0, 1, MAP_PX);
      ctx.fillStyle = "rgba(255, 250, 236, 0.3)";
      ctx.fillRect(fx + 1, 0, 1, MAP_PX);
    }
    const fy = Math.floor(MAP_PX / 2);
    ctx.fillStyle = "rgba(74, 54, 28, 0.2)";
    ctx.fillRect(0, fy, MAP_PX, 1);
    ctx.fillStyle = "rgba(255, 250, 236, 0.3)";
    ctx.fillRect(0, fy + 1, MAP_PX, 1);

    // 4. Active quest objective beacon (shows softly even through parchment fog!)
    const objective = questSystem.getActiveObjectiveTarget();
    if (objective) {
      const ox = Math.round((objective.tileX / width) * MAP_PX);
      const oy = Math.round((objective.tileY / height) * MAP_PX);
      const pulse = 5 + Math.sin(timeSec * 5) * 2;
      ctx.strokeStyle = "#e09f24";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ox, oy, pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#f4d35e";
      ctx.fillRect(ox - 2, oy - 2, 5, 5);
      ctx.strokeStyle = "#2e2010";
      ctx.lineWidth = 1;
      ctx.strokeRect(ox - 2.5, oy - 2.5, 6, 6);
    }

    // 5. Discovered landmark pins & crisp miniature ink labels
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    for (const lm of questSystem.landmarks) {
      const discovered = questSystem.state.discoveredLandmarks.has(lm.id);
      const isObjective = objective && objective.landmarkId === lm.id;
      if (!discovered && !isObjective) continue;

      const lx = Math.round((lm.walkTileX / width) * MAP_PX);
      const ly = Math.round((lm.walkTileY / height) * MAP_PX);

      ctx.fillStyle = "#1d2228";
      ctx.fillRect(lx - 3, ly - 3, 7, 7);
      ctx.fillStyle = lm.id === "home_base" ? "#f4d35e" : discovered ? "#52b788" : "#f4a261";
      ctx.fillRect(lx - 2, ly - 2, 5, 5);

      // Short crisp label pill
      const shortName = lm.id === "home_base"
        ? "Home"
        : lm.name.replace(/\s*\(.*\)/, "").slice(0, 14);
      const labelY = ly > 16 ? ly - 6 : ly + 13;
      ctx.fillStyle = "rgba(28, 22, 14, 0.82)";
      const tw = ctx.measureText(shortName).width + 6;
      const clampedX = Math.max(tw / 2 + 2, Math.min(MAP_PX - tw / 2 - 2, lx));
      ctx.fillRect(Math.round(clampedX - tw / 2), labelY - 7, Math.round(tw), 9);
      ctx.fillStyle = lm.id === "home_base" ? "#f4d35e" : "#f7f3e8";
      ctx.fillText(shortName, clampedX, labelY);
    }

    // 6. Live Player Explorer Pin (bouncing red/white marker)
    const px = Math.round((playerTileX / width) * MAP_PX);
    const py = Math.round((playerTileY / height) * MAP_PX);
    ctx.fillStyle = "#1d2228";
    ctx.fillRect(px - 3, py - 3, 7, 7);
    ctx.fillStyle = "#e63946";
    ctx.fillRect(px - 2, py - 2, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(px - 1, py - 1, 2, 2);

    // 7. Hand-drawn Vintage Compass Rose (top-right corner)
    const rx = MAP_PX - 18;
    const ry = 18;
    ctx.fillStyle = "rgba(232, 216, 181, 0.88)";
    ctx.beginPath();
    ctx.arc(rx, ry, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5c4328";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#b53c30";
    ctx.fillRect(rx - 1, ry - 9, 2, 8); // North needle
    ctx.fillStyle = "#5c4328";
    ctx.fillRect(rx - 1, ry, 2, 8);
    ctx.fillRect(rx - 8, ry - 1, 16, 2);
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#2c1e10";
    ctx.fillText("N", rx, ry - 9);
  }

  return { renderToCanvas };
}
