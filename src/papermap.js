/**
 * Phase 3: Fog-of-War Folded Paper Map Overlay
 * Renders the 512x512 Newton Centre neighborhood as a warm hand-folded parchment map
 * that unrolls as the player explores streets and discovers landmarks.
 */

import { FOG_GRID_SIZE } from "./quests.js";
import { buildGraveyardMask } from "./graveyards.js";
import { getBuildingVisualCategory } from "./tileset.js";

// Vintage illustrated parchment map colors
const MAP_TILE_INK = {
  0: "#b8cfa0", // grass (soft sage watercolor)
  1: "#ebe2cc", // sidewalk (light parchment)
  2: "#8a94a1", // residential street (crisp cool slate so roads pop clearly against sidewalks!)
  3: "#d9a24b", // town avenue / main road (warm ochre)
  4: "#fff5d6", // crosswalk
  5: "#b58b74", // residential homes (soft muted terracotta ink so non-residential buildings pop!)
  6: "#5d9bd4", // Crystal Lake / water
  7: "#7fa868", // Oakdale Woods / wild tall grass
  8: "#b8b0a2", // parking lots
  9: "#bfa177", // dirt trails & baseball infields
  10: "#ecd9a3", // sandy beaches & playgrounds
  11: "#95c982", // manicured public parks & athletic fields
  12: "#cc7a38", // Route 9 / major highway (bold burnt sienna)
  13: "#f0ede6", // concrete highway median barrier
};

// Distinct map-ink colors for non-residential buildings so schools, libraries, civic halls,
// firehouses & village shops stand out instantly on BOTH the Folded Paper Map & Radar Mini-Map!
export const NON_RESIDENTIAL_MAP_INK = {
  school: "#2358b8",       // Cobalt School Blue
  bc_school: "#8a2434",    // BC Collegiate Maroon
  library: "#248f7c",      // Oxidized Copper Library Teal
  synagogue: "#6f42a6",    // Regal Civic Purple
  church: "#6f42a6",       // Regal Civic Purple
  gothic_chapel: "#525870",// Gothic Slate
  civic: "#6f42a6",        // Regal Civic Purple
  fire_station: "#d92b24", // Firehouse Red
  bakery_cafe: "#e07124",  // Warm Shop/Café Orange
  corner_market: "#e07124",// Warm Shop/Market Orange
  commercial: "#e07124",   // Warm Commercial Orange
  office_plaza: "#3b82b6", // Modern Steel-Blue Office
  apartments: "#7c726c",   // Multi-Unit Slate
  greenhouse: "#5cc2c2",   // Conservatory Mint-Glass
};

export function createPaperMapRenderer(worldMap, colorOverrideMap = {}) {
  const { width, height } = worldMap.dimensions;
  const base = worldMap.layers.base;
  const { graveyardGrid } = buildGraveyardMask(worldMap);

  // Build per-tile non-residential building ink lookup so Radar Mini-Map & Paper Map highlight
  // schools, libraries, synagogues/churches, fire stations & shops clearly against residential homes!
  const buildingInkGrid = new Array(width * height).fill(null);
  for (const b of worldMap.buildings || []) {
    if (!b.bounds) continue;
    const cat = getBuildingVisualCategory(b, colorOverrideMap);
    const ink = NON_RESIDENTIAL_MAP_INK[cat];
    if (!ink) continue;
    const minX = Math.max(0, b.bounds.minX);
    const maxX = Math.min(width - 1, b.bounds.maxX);
    const minY = Math.max(0, b.bounds.minY);
    const maxY = Math.min(height - 1, b.bounds.maxY);
    for (let ty = minY; ty <= maxY; ty++) {
      const rowOff = ty * width;
      for (let tx = minX; tx <= maxX; tx++) {
        buildingInkGrid[rowOff + tx] = ink;
      }
    }
  }

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
      const idx = rowOffset + tx;
      const id = base[idx];
      const isRoadId = id === 2 || id === 3 || id === 4 || id === 12 || id === 13;
      const isGraveTurf = graveyardGrid[idx] !== 0 && (id === 0 || id === 7 || id === 11);
      // When vectorRoads is available, let crisp curved vector roads paint over soft parchment ground!
      const fallbackId = worldMap.vectorRoads?.roads?.length && isRoadId ? 1 : id;
      bCtx.fillStyle =
        buildingInkGrid[idx] || (isGraveTurf ? "#8a8ea3" : MAP_TILE_INK[fallbackId] || MAP_TILE_INK[0]);
      bCtx.fillRect(px, py, 1, 1);
    }
  }

  // Draw crisp, true-curve OpenStreetMap vector roads onto the Folded Paper Map when available!
  if (worldMap.vectorRoads?.roads?.length) {
    const scaleX = MAP_PX / width;
    const scaleY = MAP_PX / height;
    const classOrder = { residential: 0, main: 1, highway: 2 };
    const sortedRoads = worldMap.vectorRoads.roads
      .slice()
      .sort((a, b) => (classOrder[a.cls] || 0) - (classOrder[b.cls] || 0));

    bCtx.save();
    bCtx.imageSmoothingEnabled = true;
    bCtx.lineCap = "round";
    bCtx.lineJoin = "round";
    for (const r of sortedRoads) {
      const pts = r.pts;
      if (!pts || pts.length < 4) continue;
      bCtx.strokeStyle =
        r.cls === "highway"
          ? MAP_TILE_INK[12]
          : r.cls === "main"
            ? MAP_TILE_INK[3]
            : MAP_TILE_INK[2];
      bCtx.lineWidth = r.cls === "highway" ? 2.4 : r.cls === "main" ? 1.8 : 1.05;
      bCtx.beginPath();
      bCtx.moveTo(pts[0] * scaleX, pts[1] * scaleY);
      for (let i = 2; i + 1 < pts.length; i += 2) {
        bCtx.lineTo(pts[i] * scaleX, pts[i + 1] * scaleY);
      }
      bCtx.stroke();
    }
    bCtx.restore();
  }

  // Stamp non-residential building footprints directly onto baseCanvas so even narrow 1-tile schools
  // or fire stations never vanish during 512->256 downsampling!
  for (const b of worldMap.buildings || []) {
    if (!b.bounds) continue;
    const cat = getBuildingVisualCategory(b, colorOverrideMap);
    const ink = NON_RESIDENTIAL_MAP_INK[cat];
    if (!ink || cat === "apartments" || cat === "greenhouse") continue;
    const rx = Math.floor((b.bounds.minX / width) * MAP_PX);
    const ry = Math.floor((b.bounds.minY / height) * MAP_PX);
    const rw = Math.max(2, Math.ceil(((b.bounds.maxX - b.bounds.minX + 1) / width) * MAP_PX));
    const rh = Math.max(2, Math.ceil(((b.bounds.maxY - b.bounds.minY + 1) / height) * MAP_PX));
    bCtx.fillStyle = "#2b2112";
    bCtx.fillRect(rx - 1, ry - 1, rw + 2, rh + 2);
    bCtx.fillStyle = ink;
    bCtx.fillRect(rx, ry, rw, rh);
  }

  /**
   * Render the live Folded Paper Map with fog-of-war, hand-folded paper creases,
   * checked street-sign stamps, discovered landmark pins, and either:
   *  - Signpost Mode (default): "Last Checked Sign" pin (no live moving GPS dot!)
   *  - GPS Assist Mode: live moving player dot + pulsing quest target beacon
   */
  function renderToCanvas(
    targetCanvas,
    { questSystem, streetSignSystem = null, playerTileX, playerTileY, timeSec = 0, gpsAssist = false }
  ) {
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

    // 4. Checked Street-Sign Pins (green corner stamps logged by the explorer!)
    const checkedSigns = questSystem.state.checkedSigns || new Set();
    const lastSignId = questSystem.state.lastCheckedSignId || null;
    let lastSignObj = null;

    if (streetSignSystem && checkedSigns.size > 0) {
      for (const signId of checkedSigns) {
        const s = streetSignSystem.getSignById(signId);
        if (!s) continue;
        if (signId === lastSignId) lastSignObj = s;
        const sx = Math.round((s.tx / width) * MAP_PX);
        const sy = Math.round((s.ty / height) * MAP_PX);
        ctx.fillStyle = "#163a28";
        ctx.fillRect(sx - 2, sy - 2, 5, 5);
        ctx.fillStyle = "#2ecc71";
        ctx.fillRect(sx - 1, sy - 1, 3, 3);
      }
    }

    // 5. Active quest objective beacon — ONLY shown in GPS Assist mode!
    const objective = questSystem.getActiveObjectiveTarget();
    if (gpsAssist && objective) {
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

    // 6. Landmark pins:
    //    In Signpost Mode: only Home Base and discovered landmarks appear so directions stay exciting!
    //    In GPS Assist Mode: undiscovered landmarks also show as subtle amber stars.
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    for (const lm of questSystem.landmarks) {
      const discovered = questSystem.state.discoveredLandmarks.has(lm.id);
      const isObjective = gpsAssist && objective && objective.landmarkId === lm.id;

      const lx = Math.round((lm.walkTileX / width) * MAP_PX);
      const ly = Math.round((lm.walkTileY / height) * MAP_PX);

      if (!discovered && !isObjective) {
        if (!gpsAssist) continue;
        ctx.fillStyle = "#2b2112";
        ctx.fillRect(lx - 2, ly - 2, 5, 5);
        ctx.fillStyle = "#f4a261";
        ctx.fillRect(lx - 1, ly - 1, 3, 3);
        continue;
      }

      ctx.fillStyle = "#1d2228";
      ctx.fillRect(lx - 3, ly - 3, 7, 7);
      ctx.fillStyle = lm.id === "home_base" ? "#f4d35e" : discovered ? "#52b788" : "#f4a261";
      ctx.fillRect(lx - 2, ly - 2, 5, 5);

      const shortName =
        lm.id === "home_base" ? "Home" : lm.name.replace(/\s*\(.*\)/, "").slice(0, 14);
      const labelY = ly > 16 ? ly - 6 : ly + 13;
      ctx.fillStyle = "rgba(28, 22, 14, 0.82)";
      const tw = ctx.measureText(shortName).width + 6;
      const clampedX = Math.max(tw / 2 + 2, Math.min(MAP_PX - tw / 2 - 2, lx));
      ctx.fillRect(Math.round(clampedX - tw / 2), labelY - 7, Math.round(tw), 9);
      ctx.fillStyle = lm.id === "home_base" ? "#f4d35e" : "#f7f3e8";
      ctx.fillText(shortName, clampedX, labelY);
    }

    // 7. Player Location Marker:
    //    - GPS Assist Mode: live red moving player dot
    //    - Signpost Mode: blue & gold "Last Checked Sign" pin (updated ONLY when reading a street sign!)
    if (gpsAssist) {
      const px = Math.round((playerTileX / width) * MAP_PX);
      const py = Math.round((playerTileY / height) * MAP_PX);
      ctx.fillStyle = "#1d2228";
      ctx.fillRect(px - 3, py - 3, 7, 7);
      ctx.fillStyle = "#e63946";
      ctx.fillRect(px - 2, py - 2, 5, 5);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px - 1, py - 1, 2, 2);
    } else if (lastSignObj) {
      const sx = Math.round((lastSignObj.tx / width) * MAP_PX);
      const sy = Math.round((lastSignObj.ty / height) * MAP_PX);
      const pulse = 5 + Math.sin(timeSec * 4) * 1.5;
      ctx.strokeStyle = "#2b7de9";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, pulse, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#142238";
      ctx.fillRect(sx - 3, sy - 3, 7, 7);
      ctx.fillStyle = "#4ea8ff";
      ctx.fillRect(sx - 2, sy - 2, 5, 5);
      ctx.fillStyle = "#fff4b8";
      ctx.fillRect(sx - 1, sy - 1, 2, 2);

      // Crisp green street-sign tag showing the last checked intersection!
      const tag = `🪧 ${lastSignObj.shortLabel.slice(0, 18)}`;
      ctx.font = "bold 7px monospace";
      const tw = ctx.measureText(tag).width + 6;
      const clampedX = Math.max(tw / 2 + 2, Math.min(MAP_PX - tw / 2 - 2, sx));
      const tagY = sy > 20 ? sy - 8 : sy + 15;
      ctx.fillStyle = "#174a2e";
      ctx.fillRect(Math.round(clampedX - tw / 2), tagY - 7, Math.round(tw), 9);
      ctx.strokeStyle = "#e6b84c";
      ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(clampedX - tw / 2) + 0.5, tagY - 6.5, Math.round(tw) - 1, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(tag, clampedX, tagY);
    }

    // 8. Hand-drawn Vintage Compass Rose (top-right corner)
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

    // 9. Easy / GPS Mode Sheikah Fast-Travel Banner right on the map!
    if (gpsAssist) {
      const pulseGlow = 0.78 + Math.sin(timeSec * 5) * 0.22;
      ctx.fillStyle = "rgba(12, 32, 48, 0.86)";
      ctx.fillRect(18, MAP_PX - 17, MAP_PX - 36, 13);
      ctx.strokeStyle = `rgba(92, 232, 255, ${pulseGlow.toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(18.5, MAP_PX - 16.5, MAP_PX - 37, 12);
      ctx.font = "bold 7px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#8ef6ff";
      ctx.fillText("✨ TAP ANYWHERE TO FAST-TRAVEL!", MAP_PX / 2, MAP_PX - 8);
    }
  }

  /**
   * Render a crisp 16-bit Brass Explorer Compass Rose in the corner widget (Signpost & Hard Modes).
   * In Hard Mode (heading-up rotating world), the crimson North needle and N/S/E/W dial spin in
   * real time by -headingDeg so the player uses the compass to find True North!
   */
  function renderCompassWidget(
    targetCanvas,
    { checkedCount = 0, headingDeg = 0, hardMode = false, timeSec = 0 } = {}
  ) {
    if (!targetCanvas) return;
    if (targetCanvas.width !== MINI_PX || targetCanvas.height !== MINI_PX) {
      targetCanvas.width = MINI_PX;
      targetCanvas.height = MINI_PX;
    }
    const ctx = targetCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const cx = MINI_PX / 2;
    const cy = MINI_PX / 2;
    const dialAngle = hardMode
      ? -(headingDeg * Math.PI) / 180
      : Math.sin(timeSec * 2.1) * 0.03;

    // Dark SNES wood/parchment backdrop
    ctx.fillStyle = hardMode ? "#211618" : "#16261d";
    ctx.fillRect(0, 0, MINI_PX, MINI_PX);

    // Outer antique brass bezel (glowing fiery gold trim in Hard Mode!)
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fillStyle = hardMode ? "#9e4a1e" : "#7a5428";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 41, 0, Math.PI * 2);
    ctx.fillStyle = hardMode ? "#ffae42" : "#e6b84c";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fillStyle = "#1a3527";
    ctx.fill();

    // Subtle inner parchment compass dial ring
    ctx.strokeStyle = "rgba(239, 225, 191, 0.32)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 29, 0, Math.PI * 2);
    ctx.stroke();

    // Rotate intercardinal ticks + magnetic compass needle by dialAngle (-headingDeg)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dialAngle);

    // Intercardinal brass ticks (NE, SE, SW, NW)
    ctx.strokeStyle = "#b8903c";
    ctx.lineWidth = 1.5;
    for (const ang of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 18, Math.sin(ang) * 18);
      ctx.lineTo(Math.cos(ang) * 28, Math.sin(ang) * 28);
      ctx.stroke();
    }

    // North needle (classic crimson red — ALWAYS points True North!)
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fillStyle = "#e63946";
    ctx.fill();

    // South needle (warm parchment ivory)
    ctx.beginPath();
    ctx.moveTo(0, 23);
    ctx.lineTo(5, 0);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fillStyle = "#efe1bf";
    ctx.fill();

    // East/West brass crossbar
    ctx.beginPath();
    ctx.moveTo(-15, 0);
    ctx.lineTo(0, -3);
    ctx.lineTo(15, 0);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.fillStyle = "#c99a3b";
    ctx.fill();

    // Center brass jewel
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fff0a6";
    ctx.fill();
    ctx.restore();

    // Orbiting upright cardinal letters N / S / E / W around the dial ring (easy to read at any heading!)
    const letterRadius = 31;
    const cardinals = [
      { label: "N", baseAng: -Math.PI / 2, color: "#ff6b6b" },
      { label: "E", baseAng: 0, color: "#efe1bf" },
      { label: "S", baseAng: Math.PI / 2, color: "#efe1bf" },
      { label: "W", baseAng: Math.PI, color: "#efe1bf" },
    ];
    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const c of cardinals) {
      const a = c.baseAng + dialAngle;
      const lx = Math.round(cx + Math.cos(a) * letterRadius);
      const ly = Math.round(cy + Math.sin(a) * letterRadius);
      ctx.fillStyle = c.color;
      ctx.fillText(c.label, lx, ly);
    }

    // Fixed top lubber triangle showing "Straight Ahead" in Hard Mode!
    if (hardMode) {
      ctx.beginPath();
      ctx.moveTo(cx, 12);
      ctx.lineTo(cx - 4, 5);
      ctx.lineTo(cx + 4, 5);
      ctx.closePath();
      ctx.fillStyle = "#fff0a6";
      ctx.fill();
      ctx.strokeStyle = "#181620";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Current heading direction tag (bottom-left)
      const normDeg = ((headingDeg % 360) + 360) % 360;
      const dirNames = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
      const dirTag = dirNames[Math.round(normDeg / 45) % 8];
      ctx.fillStyle = "rgba(33, 22, 24, 0.92)";
      ctx.fillRect(2, MINI_PX - 14, 24, 12);
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#ffae42";
      ctx.fillText(dirTag, 14, MINI_PX - 8);
    }

    // Subtle checked-sign count badge at bottom-right corner
    if (checkedCount > 0) {
      ctx.fillStyle = "rgba(18, 36, 26, 0.9)";
      ctx.fillRect(MINI_PX - 26, MINI_PX - 14, 24, 12);
      ctx.font = "bold 8px monospace";
      ctx.fillStyle = "#6ee7a8";
      ctx.fillText(`🪧${checkedCount}`, MINI_PX - 14, MINI_PX - 8);
    }
  }

  /**
   * Render a crisp live zoomed-in neighborhood Radar Mini-Map centered on the player
   * so kids can see surrounding streets, crosswalks, parks, Route 9 barrier, nearby
   * landmarks, and the active quest direction in real time while walking!
   */
  const MINI_TILES = 52; // 52x52 tile window (~312m x 312m neighborhood view)
  const MINI_PX = 104;   // 2px per tile for razor-sharp crisp rendering

  function renderMiniMap(targetCanvas, { questSystem, playerTileX, playerTileY, timeSec = 0 }) {
    if (!targetCanvas) return;
    if (targetCanvas.width !== MINI_PX || targetCanvas.height !== MINI_PX) {
      targetCanvas.width = MINI_PX;
      targetCanvas.height = MINI_PX;
    }
    const ctx = targetCanvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    const half = Math.floor(MINI_TILES / 2);
    const startX = playerTileX - half;
    const startY = playerTileY - half;

    // 1. Draw crisp 2x2px terrain tiles around the player
    for (let dy = 0; dy < MINI_TILES; dy++) {
      const ty = startY + dy;
      const outY = ty < 0 || ty >= height;
      const rowOff = ty * width;
      for (let dx = 0; dx < MINI_TILES; dx++) {
        const tx = startX + dx;
        if (outY || tx < 0 || tx >= width) {
          ctx.fillStyle = "#2b3629";
        } else {
          const idx = rowOff + tx;
          const id = base[idx];
          const isGraveTurf = graveyardGrid[idx] !== 0 && (id === 0 || id === 7 || id === 11);
          ctx.fillStyle =
            buildingInkGrid[idx] || (isGraveTurf ? "#8a8ea3" : MAP_TILE_INK[id] || MAP_TILE_INK[0]);
        }
        ctx.fillRect(dx * 2, dy * 2, 2, 2);
      }
    }

    // 2. Draw nearby landmark pins inside radar view (plus edge arrows for active quest!)
    const objective = questSystem.getActiveObjectiveTarget();
    for (const lm of questSystem.landmarks) {
      const rx = (lm.walkTileX - startX) * 2;
      const ry = (lm.walkTileY - startY) * 2;
      if (rx < -4 || ry < -4 || rx > MINI_PX + 4 || ry > MINI_PX + 4) continue;
      const discovered = questSystem.state.discoveredLandmarks.has(lm.id);
      const isObj = objective && objective.landmarkId === lm.id;
      ctx.fillStyle = "#1d2228";
      ctx.fillRect(rx - 3, ry - 3, 7, 7);
      ctx.fillStyle =
        lm.id === "home_base"
          ? "#f4d35e"
          : isObj
            ? "#ffcf40"
            : discovered
              ? "#52b788"
              : "#f4a261";
      ctx.fillRect(rx - 2, ry - 2, 5, 5);
    }

    // 3. Active quest direction beacon (clamped cleanly to radar border if off-radar!)
    if (objective) {
      const ox = (objective.tileX - startX) * 2;
      const oy = (objective.tileY - startY) * 2;
      const cx = MINI_PX / 2;
      const cy = MINI_PX / 2;
      const clampedX = Math.max(6, Math.min(MINI_PX - 6, ox));
      const clampedY = Math.max(6, Math.min(MINI_PX - 6, oy));
      const pulse = 3 + Math.sin(timeSec * 6) * 1.2;
      ctx.strokeStyle = "#f4d35e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Crisp rotated golden compass-arrowhead pointer on radar edge toward distant quest target
      if (ox < 4 || ox > MINI_PX - 4 || oy < 4 || oy > MINI_PX - 4) {
        const angle = Math.atan2(oy - cy, ox - cx);
        const ex = cx + Math.cos(angle) * (MINI_PX / 2 - 7);
        const ey = cy + Math.sin(angle) * (MINI_PX / 2 - 7);
        ctx.save();
        ctx.translate(Math.round(ex), Math.round(ey));
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -5);
        ctx.lineTo(-2, 0);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fillStyle = "#ffe066";
        ctx.fill();
        ctx.strokeStyle = "#1d2228";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Bright emerald compass jewel at tail notch
        ctx.fillStyle = "#52e69c";
        ctx.fillRect(-2, -1, 3, 2);
        ctx.restore();
      }
    }

    // 4. Live Player Explorer Pin (dead center of radar!)
    const pc = MINI_PX / 2;
    ctx.fillStyle = "#1d2228";
    ctx.fillRect(pc - 3, pc - 3, 7, 7);
    ctx.fillStyle = "#e63946";
    ctx.fillRect(pc - 2, pc - 2, 5, 5);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(pc - 1, pc - 1, 2, 2);

    // Tiny N north tag at top center
    ctx.fillStyle = "rgba(20, 34, 26, 0.8)";
    ctx.fillRect(pc - 5, 1, 10, 9);
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4d35e";
    ctx.fillText("N", pc, 8);
  }

  return { renderToCanvas, renderMiniMap, renderCompassWidget };
}
