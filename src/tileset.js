/**
 * Option 1: High-Craft 16-Bit SNES Overworld Pixel-Art Engine
 * Closely modeled on our locked-in SNES Overworld concept (A Link to the Past / Chrono Trigger):
 *  - Crisp dark pixel outlines (#1c2128) & 3-4 tone shaded pixel sprites
 *  - True pitched shingle gable roofs, dormers, chimneys, covered porches, picket fences,
 *    garden shrubs, mailboxes, and distinct New England house color palettes (1 house per address)
 *  - Classical red-brick columns & pediments for libraries, schools, and civic landmarks
 *  - Auto-tiled cobblestone sidewalks with 3D stone curbs, clean multi-lane roads,
 *    direction-aware zebra crosswalks, glowing green WALK signal posts, and red fire hydrants
 *  - Pixel-outlined 16x24 SNES hero sprites (4 directions x walk frames + kick scooter)
 */

export const PALETTES = {
  snes_classic: {
    outline: "#1d2228",
    grassBase: "#5ca642",
    grassLight: "#7bc24e",
    grassMid: "#4b8f38",
    grassDark: "#38702d",
    tallGrassBase: "#3b8234",
    tallGrassMid: "#56a844",
    tallGrassTip: "#8ee05c",
    sidewalkBase: "#d9d0be",
    sidewalkLight: "#ece5d5",
    sidewalkMid: "#c7bda8",
    sidewalkMortar: "#a39986",
    sidewalkCurbTop: "#f3ede0",
    sidewalkCurbFace: "#8e8576",
    sidewalkCurbShadow: "#2d323b",
    roadMain: "#3e444f",
    roadMainDark: "#343944",
    roadRes: "#4e5563",
    roadResDark: "#434956",
    roadShoulder: "#e6ebf2",
    roadDashWhite: "#dce3ec",
    roadYellow: "#e8be4a",
    crosswalkWhite: "#f4f6fa",
    crosswalkEdge: "#c4ccd8",
    waterDeep: "#255db0",
    waterMid: "#367bd6",
    waterLight: "#5da6f0",
    waterShimmer: "#c4ebff",
    treeOutline: "#162b1c",
    treeDark: "#22542b",
    treeMid: "#377f37",
    treeLight: "#5eb043",
    treeHighlight: "#96e05e",
    treeTrunk: "#6e462d",
    treeTrunkDark: "#472b1c",
    treeTrunkLight: "#8f5d3e",
  },
};

// 12 realistic New England house color presets for real-world address matching
export const HOUSE_COLOR_PRESETS = {
  yellow: {
    label: "Colonial Yellow",
    swatch: "#f0cf6b",
    roofLight: "#7695ad",
    roofMain: "#55728a",
    roofDark: "#394e61",
    wallLight: "#fbe694",
    wallMain: "#f0cf6b",
    wallShade: "#d4ae48",
    trim: "#f7f4ea",
    trimShade: "#cfc9b8",
    door: "#b87442",
    doorDark: "#7a4726",
    shutter: "#4a6173",
    porchWood: "#c99563",
    windowGlow: "#fff0a6",
  },
  white: {
    label: "Colonial White",
    swatch: "#ece8dd",
    roofLight: "#737a87",
    roofMain: "#535964",
    roofDark: "#373c45",
    wallLight: "#f8f6f0",
    wallMain: "#e8e3d8",
    wallShade: "#c6c0b2",
    trim: "#ffffff",
    trimShade: "#d5d0c4",
    door: "#b33c38",
    doorDark: "#782422",
    shutter: "#2f5945",
    porchWood: "#b89f82",
    windowGlow: "#a4d4ed",
  },
  gray: {
    label: "Light Gray",
    swatch: "#b8c3ca",
    roofLight: "#656d78",
    roofMain: "#484f59",
    roofDark: "#2e333b",
    wallLight: "#d8dfe3",
    wallMain: "#b8c3ca",
    wallShade: "#94a2ab",
    trim: "#f7f9fa",
    trimShade: "#c8d0d6",
    door: "#3a567a",
    doorDark: "#23364f",
    shutter: "#2c3d54",
    porchWood: "#b3a99c",
    windowGlow: "#b2dcf0",
  },
  charcoal: {
    label: "Dark Charcoal",
    swatch: "#5a636e",
    roofLight: "#555c66",
    roofMain: "#3a4047",
    roofDark: "#24282e",
    wallLight: "#737d8a",
    wallMain: "#5a636e",
    wallShade: "#414852",
    trim: "#f5f5f0",
    trimShade: "#cfd1cc",
    door: "#c47d3b",
    doorDark: "#824f20",
    shutter: "#2c3138",
    porchWood: "#b89b78",
    windowGlow: "#ffeba1",
  },
  navy: {
    label: "Deep Navy",
    swatch: "#3b5678",
    roofLight: "#737a87",
    roofMain: "#535964",
    roofDark: "#373c45",
    wallLight: "#52739c",
    wallMain: "#3b5678",
    wallShade: "#273b54",
    trim: "#f8f8f5",
    trimShade: "#cfd4db",
    door: "#d9a43b",
    doorDark: "#966d1f",
    shutter: "#1e2e42",
    porchWood: "#bfa88a",
    windowGlow: "#ffefa8",
  },
  slate_blue: {
    label: "Cape Cod Blue",
    swatch: "#8ab0cf",
    roofLight: "#7b818c",
    roofMain: "#5c616b",
    roofDark: "#3f434a",
    wallLight: "#bad3e8",
    wallMain: "#8ab0cf",
    wallShade: "#688eb0",
    trim: "#f7f7f2",
    trimShade: "#cfd3d8",
    door: "#d9a43b",
    doorDark: "#966d1f",
    shutter: "#344a63",
    porchWood: "#b5a696",
    windowGlow: "#b4def2",
  },
  sage: {
    label: "Newton Sage",
    swatch: "#9fc096",
    roofLight: "#9c7054",
    roofMain: "#7a533c",
    roofDark: "#543726",
    wallLight: "#c4dbba",
    wallMain: "#9fc096",
    wallShade: "#7da074",
    trim: "#f4f0e4",
    trimShade: "#ccc6b6",
    door: "#874e31",
    doorDark: "#572f1c",
    shutter: "#3d5444",
    porchWood: "#b58b63",
    windowGlow: "#a8d8ee",
  },
  cream_stucco: {
    label: "Cream Stucco",
    swatch: "#e6d5b8",
    roofLight: "#7b746c",
    roofMain: "#5c5650",
    roofDark: "#3d3935",
    wallLight: "#f5ebd8",
    wallMain: "#e6d5b8",
    wallShade: "#c9b594",
    trim: "#faf7f0",
    trimShade: "#d4cbb8",
    door: "#7a442e",
    doorDark: "#4f2a1b",
    shutter: "#54473d",
    porchWood: "#c2a88c",
    windowGlow: "#b0d9ed",
    isStucco: true,
  },
  brick: {
    label: "Red Brick",
    swatch: "#b04e3c",
    roofLight: "#6f7787",
    roofMain: "#4f5666",
    roofDark: "#343945",
    wallLight: "#cc6852",
    wallMain: "#b04e3c",
    wallShade: "#853629",
    trim: "#f2ece0",
    trimShade: "#c7bfb0",
    door: "#7a492e",
    doorDark: "#4f2d1b",
    shutter: "#343d4d",
    porchWood: "#c9c0b2",
    windowGlow: "#b2dcf0",
    isBrick: true,
  },
  cedar_brown: {
    label: "Cedar Shingle",
    swatch: "#9e7452",
    roofLight: "#628068",
    roofMain: "#46614c",
    roofDark: "#2d4232",
    wallLight: "#bd926c",
    wallMain: "#9e7452",
    wallShade: "#7a563a",
    trim: "#f5f1e6",
    trimShade: "#cfc7b6",
    door: "#3a5c46",
    doorDark: "#233b2c",
    shutter: "#384a3d",
    porchWood: "#b88a5d",
    windowGlow: "#ffe9a8",
  },
  tan: {
    label: "Warm Tan",
    swatch: "#d4b48a",
    roofLight: "#9e6b52",
    roofMain: "#7a4f3b",
    roofDark: "#523325",
    wallLight: "#ebd2ad",
    wallMain: "#d4b48a",
    wallShade: "#b39166",
    trim: "#f7f3ea",
    trimShade: "#d1c8b8",
    door: "#8c3735",
    doorDark: "#5c201f",
    shutter: "#4d3c30",
    porchWood: "#b88a5d",
    windowGlow: "#b0d9ed",
  },
  red_clapboard: {
    label: "Barn Red",
    swatch: "#a83d38",
    roofLight: "#6e7480",
    roofMain: "#4d525c",
    roofDark: "#32363d",
    wallLight: "#c9534d",
    wallMain: "#a83d38",
    wallShade: "#802a26",
    trim: "#f7f5f0",
    trimShade: "#d4cfc6",
    door: "#364d3f",
    doorDark: "#203026",
    shutter: "#2c333b",
    porchWood: "#b89f82",
    windowGlow: "#ffeba6",
  },
};

export const ROOF_PRESETS = {
  slate: { label: "Slate Blue", swatch: "#55728a", roofLight: "#7695ad", roofMain: "#55728a", roofDark: "#394e61" },
  charcoal: { label: "Charcoal", swatch: "#4a5059", roofLight: "#6c7380", roofMain: "#4a5059", roofDark: "#2e3238" },
  cedar: { label: "Cedar Brown", swatch: "#7a533c", roofLight: "#9c7054", roofMain: "#7a533c", roofDark: "#543726" },
  terracotta: { label: "Terracotta", swatch: "#8f4c3e", roofLight: "#b56958", roofMain: "#8f4c3e", roofDark: "#633228" },
  moss: { label: "Moss Green", swatch: "#46614c", roofLight: "#628068", roofMain: "#46614c", roofDark: "#2d4232" },
};

export const HOUSE_STYLES = [
  HOUSE_COLOR_PRESETS.yellow,
  HOUSE_COLOR_PRESETS.white,
  HOUSE_COLOR_PRESETS.sage,
  HOUSE_COLOR_PRESETS.slate_blue,
  HOUSE_COLOR_PRESETS.cream_stucco,
  HOUSE_COLOR_PRESETS.brick,
  HOUSE_COLOR_PRESETS.gray,
  HOUSE_COLOR_PRESETS.tan,
];

/**
 * Normalize street addresses so "565 Boylston St" matches "565 boylston street", etc.
 */
export function normalizeAddress(addr) {
  if (!addr) return "";
  return String(addr)
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bterrace\b/g, "ter")
    .replace(/\bplace\b/g, "pl")
    .replace(/\s+/g, " ")
    .trim();
}

function shadeHex(hex, delta) {
  if (typeof hex !== "string" || !hex.startsWith("#") || hex.length !== 7) return hex;
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + delta);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + delta);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + delta);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Resolve final architectural style for an individual building using:
 *   1. Real-world address override (data/house_colors.json + iPad Paint House edits)
 *   2. OpenStreetMap building:colour / roof:colour tags (when present)
 *   3. Civic / brick landmark rules or deterministic varied New England palette
 */
export function resolveHouseStyle(building, colorOverrideMap = {}) {
  const isCivic =
    building.kind === "library" ||
    building.kind === "school" ||
    building.kind === "civic";

  let baseStyle;
  if (building.isHomeBase) {
    baseStyle = { ...HOUSE_COLOR_PRESETS.yellow };
  } else if (isCivic) {
    baseStyle = { ...HOUSE_COLOR_PRESETS.brick };
  } else {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const idx = (hash % (HOUSE_STYLES.length - 1)) + 1;
    baseStyle = { ...HOUSE_STYLES[idx] };
  }

  // Apply OSM color tags if available
  if (building.osmColor) {
    const key = building.osmColor.toLowerCase();
    if (HOUSE_COLOR_PRESETS[key]) {
      baseStyle = { ...HOUSE_COLOR_PRESETS[key] };
    } else if (key.startsWith("#") && key.length === 7) {
      baseStyle.wallMain = key;
      baseStyle.wallLight = shadeHex(key, 24);
      baseStyle.wallShade = shadeHex(key, -26);
    }
  }
  if (building.osmRoofColor && ROOF_PRESETS[building.osmRoofColor.toLowerCase()]) {
    const r = ROOF_PRESETS[building.osmRoofColor.toLowerCase()];
    baseStyle.roofLight = r.roofLight;
    baseStyle.roofMain = r.roofMain;
    baseStyle.roofDark = r.roofDark;
  }

  // Apply explicit real-world override from data/house_colors.json or in-game Paint House
  const normAddr = normalizeAddress(building.address);
  const override =
    (normAddr && colorOverrideMap[normAddr]) ||
    (building.id && colorOverrideMap[building.id]) ||
    null;

  if (override) {
    if (override.preset && HOUSE_COLOR_PRESETS[override.preset]) {
      baseStyle = { ...HOUSE_COLOR_PRESETS[override.preset] };
    }
    if (override.roof && ROOF_PRESETS[override.roof]) {
      const r = ROOF_PRESETS[override.roof];
      baseStyle.roofLight = r.roofLight;
      baseStyle.roofMain = r.roofMain;
      baseStyle.roofDark = r.roofDark;
    } else if (override.roof && override.roof.startsWith("#")) {
      baseStyle.roofMain = override.roof;
      baseStyle.roofLight = shadeHex(override.roof, 24);
      baseStyle.roofDark = shadeHex(override.roof, -26);
    }
    if (override.wall && override.wall.startsWith("#")) {
      baseStyle.wallMain = override.wall;
      baseStyle.wallLight = shadeHex(override.wall, 24);
      baseStyle.wallShade = shadeHex(override.wall, -26);
    }
    if (override.shutter) baseStyle.shutter = override.shutter;
    if (override.door) {
      baseStyle.door = override.door;
      baseStyle.doorDark = shadeHex(override.door, -36);
    }
    if (override.trim) baseStyle.trim = override.trim;
    if (override.kind) baseStyle.overrideKind = override.kind;
  }

  return baseStyle;
}

// Tiny crisp 3x5 pixel font for house address numbers (e.g. 565)
const MINI_DIGITS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function drawMiniNumber(ctx, str, centerX, y, color) {
  const digits = String(str).replace(/[^0-9]/g, "").slice(0, 4);
  if (!digits) return;
  const totalW = digits.length * 4 - 1;
  let sx = Math.floor(centerX - totalW / 2);
  ctx.fillStyle = color;
  for (const ch of digits) {
    const glyph = MINI_DIGITS[ch];
    if (!glyph) continue;
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === "1") {
          ctx.fillRect(sx + gx, y + gy, 1, 1);
        }
      }
    }
    sx += 4;
  }
}

/**
 * Draw a crisp pixel-art garden shrub with 3-tone foliage & dark outline.
 */
function drawShrub(ctx, x, y, w = 8, h = 6) {
  px(ctx, x + 1, y, w - 2, h, "#19331f");
  px(ctx, x, y + 1, w, h - 2, "#19331f");
  px(ctx, x + 1, y + 1, w - 2, h - 2, "#2e6b31");
  px(ctx, x + 2, y + 1, w - 4, h - 3, "#4da33e");
  px(ctx, x + 2, y + 1, Math.max(2, w - 5), 2, "#80d152");
}

/**
 * Draw a crisp pixel-art picket fence strip.
 */
function drawPicketFence(ctx, x, y, width) {
  if (width < 6) return;
  // Rails
  px(ctx, x, y + 2, width, 1, "#2a3038");
  px(ctx, x, y + 3, width, 1, "#ded8c8");
  px(ctx, x, y + 6, width, 1, "#c7c0ae");
  // Pickets every 3px
  for (let fx = x; fx < x + width - 1; fx += 3) {
    px(ctx, fx, y, 2, 7, "#2a3038");
    px(ctx, fx, y + 1, 2, 5, "#f7f4ec");
    px(ctx, fx, y, 1, 1, "#ffffff");
  }
}

/**
 * Draw a tiny silver mailbox with red flag on wooden post (straight from concept art!).
 */
function drawMailbox(ctx, x, y) {
  // Post
  px(ctx, x + 2, y + 4, 2, 5, "#4a2e1e");
  px(ctx, x + 2, y + 4, 1, 5, "#784c32");
  // Rounded silver box with dark outline
  px(ctx, x, y + 1, 6, 4, "#1d2228");
  px(ctx, x + 1, y, 4, 5, "#1d2228");
  px(ctx, x + 1, y + 1, 4, 3, "#9aa6b5");
  px(ctx, x + 1, y + 1, 3, 1, "#dce3eb");
  // Tiny red flag
  px(ctx, x + 4, y + 1, 1, 2, "#d93b36");
}

/**
 * Bake an individual, pixel-art 16-bit SNES house/building onto an offscreen canvas
 * matching the real OSM footprint (1 house per address!).
 * Includes generous yard margins (+6px top for chimney/gable peak, +8px bottom for porch/steps/bushes/mailbox).
 */
export function bakeSnesBuildingCanvas(building, tileSize = 16, colorOverrideMap = {}) {
  const { minX, minY, maxX, maxY } = building.bounds;
  const footW = (maxX - minX + 1) * tileSize;
  const footH = (maxY - minY + 1) * tileSize;

  const padTop = 8;
  const padBottom = 6;
  const padSide = 2;
  const canvasW = footW + padSide * 2;
  const canvasH = footH + padTop + padBottom;
  const { canvas, ctx } = makeCanvas(canvasW, canvasH);

  // Inset walls slightly inside footprint so adjacent addresses visually separate as distinct houses!
  const insetX = footW >= 48 ? 4 : footW >= 32 ? 3 : 2;
  const bx = padSide + insetX;
  const bw = Math.max(14, footW - insetX * 2);
  const by = padTop + 1;
  const bh = Math.max(16, footH - 2);

  const style = resolveHouseStyle(building, colorOverrideMap);
  const effectiveKind = style.overrideKind || building.kind;
  const isCivic =
    effectiveKind === "library" ||
    effectiveKind === "school" ||
    effectiveKind === "civic";
  const isCommercial = effectiveKind === "commercial";

  const O = "#1d2228";

  // Soft cast drop shadow onto grass (SE side)
  px(ctx, bx + 3, by + 5, bw + 1, bh - 1, "rgba(18, 34, 20, 0.34)");

  // --- Compact Garage / Outbuilding ---
  if (effectiveKind === "garage" && footW <= 32 && footH <= 32) {
    const roofH = Math.max(8, Math.floor(bh * 0.52));
    const wallH = bh - roofH;
    px(ctx, bx - 1, by - 1, bw + 2, bh + 2, O);
    px(ctx, bx, by, bw, roofH, style.roofMain);
    px(ctx, bx + 1, by + 1, bw - 2, Math.floor(roofH / 2), style.roofLight);
    px(ctx, bx, by + roofH - 2, bw, 2, style.roofDark);
    px(ctx, bx, by + roofH, bw, wallH, style.wallMain);
    if (bw >= 12 && wallH >= 7) {
      px(ctx, bx + 2, by + roofH + 2, bw - 4, wallH - 2, O);
      px(ctx, bx + 3, by + roofH + 3, bw - 6, wallH - 4, style.trim);
      for (let gy = by + roofH + 5; gy < by + bh - 2; gy += 2) {
        px(ctx, bx + 3, gy, bw - 6, 1, style.trimShade);
      }
    }
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- Full 16-Bit SNES House / Civic / Commercial Building ---
  const wallH = Math.min(24, Math.max(11, Math.floor(bh * 0.44)));
  const roofH = Math.max(10, bh - wallH);
  const wallY = by + roofH;

  const useGableFront = !isCommercial && (building.isHomeBase || isCivic || (bw <= 64 && (minX + minY) % 2 === 0));

  // 1. Main Wall Body + Dark Pixel Outline
  px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
  px(ctx, bx, wallY, bw, wallH, style.wallMain);
  px(ctx, bx, wallY, bw, 2, style.wallShade);
  px(ctx, bx + bw - 3, wallY + 2, 3, wallH - 3, style.wallShade);

  // Brick, smooth stucco, or horizontal clapboard siding
  if (style.isBrick) {
    for (let ry = wallY + 2; ry < wallY + wallH - 2; ry += 3) {
      px(ctx, bx + 1, ry, bw - 2, 1, style.wallShade);
      const offset = ((ry - wallY) / 3) % 2 === 0 ? 0 : 2;
      for (let rx = bx + 2 + offset; rx < bx + bw - 2; rx += 5) {
        px(ctx, rx, ry + 1, 1, 2, style.wallShade);
      }
    }
  } else if (style.isStucco) {
    // Subtle stippled stucco + brick base wainscot
    px(ctx, bx + 1, wallY + wallH - 5, bw - 2, 3, "#a85442");
    px(ctx, bx + 1, wallY + wallH - 6, bw - 2, 1, style.trim);
    for (let sy = wallY + 3; sy < wallY + wallH - 6; sy += 4) {
      for (let sx = bx + 3; sx < bx + bw - 3; sx += 7) {
        px(ctx, sx, sy, 1, 1, style.wallShade);
      }
    }
  } else {
    for (let ry = wallY + 4; ry < wallY + wallH - 2; ry += 3) {
      px(ctx, bx + 1, ry, bw - 2, 1, style.wallShade);
      px(ctx, bx + 1, ry - 1, bw - 4, 1, style.wallLight);
    }
  }

  // Crisp white colonial corner boards & stone foundation
  px(ctx, bx, wallY, 2, wallH - 1, style.trim);
  px(ctx, bx + bw - 2, wallY, 2, wallH - 1, style.trimShade);
  px(ctx, bx, wallY + wallH - 2, bw, 2, "#87847c");
  px(ctx, bx, wallY + wallH - 1, bw, 1, "#5c5a54");

  // 2. Pitched Shingled Roof (True Stepped-Slope Pixel Art!)
  const slopeInsetMax = Math.min(8, Math.floor(bw * 0.18));
  for (let row = 0; row < roofH; row++) {
    const t = row / Math.max(1, roofH - 1);
    const inset = Math.round((1 - t) * slopeInsetMax);
    const rx = bx - 2 + inset;
    const rw = bw + 4 - inset * 2;
    const ry = by + row;

    // Dark pixel outline on left/right roof slopes
    px(ctx, rx - 1, ry, 1, 1, O);
    px(ctx, rx + rw, ry, 1, 1, O);
    if (row === 0) px(ctx, rx, ry - 1, rw, 1, O);

    // Shaded roof slope
    const isTopHalf = row < roofH * 0.45;
    px(ctx, rx, ry, rw, 1, isTopHalf ? style.roofLight : style.roofMain);

    // Individual pixel roof shingles (every 3 rows with alternating notches!)
    if (row > 1 && row < roofH - 2 && row % 3 === 0) {
      px(ctx, rx + 1, ry, rw - 2, 1, style.roofDark);
      const stagger = (row / 3) % 2 === 0 ? 0 : 2;
      for (let sx = rx + 2 + stagger; sx < rx + rw - 2; sx += 4) {
        px(ctx, sx, ry - 1, 1, 1, style.roofDark);
      }
    }
  }
  // Roof ridge cap highlight + dark eave trim
  const topW = bw + 4 - slopeInsetMax * 2;
  px(ctx, bx - 2 + slopeInsetMax, by, topW, 2, style.roofLight);
  px(ctx, bx - 1 + slopeInsetMax, by, Math.max(2, topW - 2), 1, "#dce4ec");
  px(ctx, bx - 2, wallY - 1, bw + 4, 2, O);
  px(ctx, bx - 1, wallY - 1, bw + 2, 1, style.trim);

  // Brick Chimney poking above roof
  if (bw >= 24) {
    const chX = (minX + minY) % 2 === 0 ? bx + bw - slopeInsetMax - 7 : bx + slopeInsetMax + 3;
    const chY = by - 5;
    px(ctx, chX - 1, chY - 1, 7, 8, O);
    px(ctx, chX, chY, 5, 7, "#b54f3d");
    px(ctx, chX + 3, chY, 2, 7, "#87372a");
    px(ctx, chX - 1, chY, 7, 2, "#732c22");
    px(ctx, chX, chY, 5, 1, "#d97762");
  }

  // 3. Front Gable Peak (Home Base Yellow House & Gable Colonials) OR Classical Library Pediment
  const midX = bx + Math.floor(bw / 2);
  if (useGableFront && bw >= 30) {
    const gableHalfW = Math.min(14, Math.floor(bw * 0.28));
    const gableH = Math.min(12, Math.max(7, Math.floor(roofH * 0.65)));
    const gableBaseY = wallY - 1;
    for (let gy = 0; gy < gableH; gy++) {
      const halfSpan = Math.max(1, Math.round((gy / Math.max(1, gableH - 1)) * gableHalfW));
      const rowY = gableBaseY - gableH + gy;
      // Roof gable overhang trim + outline
      px(ctx, midX - halfSpan - 2, rowY, 2, 1, O);
      px(ctx, midX + halfSpan, rowY, 2, 1, O);
      px(ctx, midX - halfSpan - 1, rowY, 1, 1, style.trim);
      px(ctx, midX + halfSpan, rowY, 1, 1, style.trim);
      // Gable triangle siding (or white stone pediment for library/school!)
      px(ctx, midX - halfSpan, rowY, halfSpan * 2, 1, isCivic ? style.trim : style.wallMain);
    }
    px(ctx, midX - 1, gableBaseY - gableH - 1, 2, 2, O);
    // Tiny attic window inside the gable (iconic detail from style_1_snes_16bit!)
    if (gableH >= 8 && !isCivic) {
      px(ctx, midX - 2, gableBaseY - 6, 5, 5, O);
      px(ctx, midX - 1, gableBaseY - 5, 3, 3, style.windowGlow);
      px(ctx, midX, gableBaseY - 5, 1, 3, style.trim);
      px(ctx, midX - 1, gableBaseY - 4, 3, 1, style.trim);
    }
  }

  // 4. Front Door, Covered Porch & Classical Columns
  const doorW = isCivic ? 10 : 6;
  const doorH = Math.min(wallH - 3, 11);
  const doorX = midX - Math.floor(doorW / 2);
  const doorY = wallY + wallH - doorH - 2;

  if (bw >= 18 && doorH >= 6) {
    // Covered porch roof / portico for Home Base & larger homes
    if (bw >= 42 && (building.isHomeBase || isCivic || bw >= 56)) {
      const porchW = Math.min(bw - 8, isCivic ? 24 : 20);
      const porchX = midX - Math.floor(porchW / 2);
      const porchTopY = doorY - 3;
      // Porch overhang awning
      px(ctx, porchX - 1, porchTopY - 1, porchW + 2, 4, O);
      px(ctx, porchX, porchTopY, porchW, 2, isCivic ? style.trim : style.roofMain);
      px(ctx, porchX, porchTopY + 2, porchW, 1, isCivic ? style.trimShade : style.roofDark);
      // White columns on left & right of porch
      px(ctx, porchX + 1, porchTopY + 3, 2, wallY + wallH - porchTopY - 3, style.trim);
      px(ctx, porchX + porchW - 3, porchTopY + 3, 2, wallY + wallH - porchTopY - 3, style.trim);
      // Wooden porch deck & steps protruding cleanly onto the front lawn
      px(ctx, porchX, wallY + wallH - 2, porchW, 4, O);
      px(ctx, porchX + 1, wallY + wallH - 1, porchW - 2, 2, style.porchWood);
    }

    // Door surround + paneled wood door + brass knob
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2, O);
    px(ctx, doorX, doorY, doorW, doorH, style.trim);
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 1, style.door);
    px(ctx, doorX + 1, doorY + 1, doorW - 2, 2, style.doorDark);
    if (isCivic) {
      // Double doors center seam
      px(ctx, midX, doorY + 1, 1, doorH - 1, style.doorDark);
    } else {
      // Brass doorknob
      px(ctx, doorX + doorW - 2, doorY + Math.floor(doorH / 2), 1, 1, "#f7dc6f");
    }

    // Front stone steps + stepping-stone garden walk
    px(ctx, doorX - 2, wallY + wallH, doorW + 4, 3, O);
    px(ctx, doorX - 1, wallY + wallH, doorW + 2, 2, "#e8e2d5");
    px(ctx, doorX - 1, wallY + wallH + 2, doorW + 2, 1, "#b8b09e");
    // Tiny stepping stone on lawn
    px(ctx, midX - 2, wallY + wallH + 4, 4, 2, "#cfc6b4");
  }

  // 5. Crisp Paned Colonial Windows with Shutters & Glass Glints
  if (bw >= 30 && wallH >= 10) {
    const winW = 6;
    const winH = 7;
    const winY = wallY + Math.max(3, Math.floor((wallH - winH) / 2) - 1);
    const candidates = [bx + 5, bx + bw - 5 - winW];
    if (bw >= 64) {
      candidates.push(bx + 16, bx + bw - 16 - winW);
    }
    for (const wx of candidates) {
      if (wx + winW + 2 >= doorX - 3 && wx - 2 <= doorX + doorW + 3) continue;
      // Shutters (left & right)
      px(ctx, wx - 2, winY, 2, winH, O);
      px(ctx, wx - 1, winY + 1, 1, winH - 2, style.shutter);
      px(ctx, wx + winW, winY, 2, winH, O);
      px(ctx, wx + winW, winY + 1, 1, winH - 2, style.shutter);
      // Window frame & glass
      px(ctx, wx, winY, winW, winH, O);
      px(ctx, wx + 1, winY + 1, winW - 2, winH - 2, style.windowGlow);
      // Diagonal glass highlight glint
      px(ctx, wx + 1, winY + 1, 2, 1, "#ffffff");
      // White muntin crossbars
      px(ctx, wx + Math.floor(winW / 2), winY + 1, 1, winH - 2, style.trim);
      px(ctx, wx + 1, winY + Math.floor(winH / 2), winW - 2, 1, style.trim);
      // Window sill
      px(ctx, wx - 1, winY + winH, winW + 2, 1, style.trim);
    }
  }

  // 6. Front Garden Bushes, Picket Fence & Mailbox (straight from style_1_snes_16bit!)
  if (bw >= 34) {
    drawShrub(ctx, bx + 2, wallY + wallH - 3, 8, 6);
    drawShrub(ctx, bx + bw - 10, wallY + wallH - 3, 8, 6);
  }
  if (building.isHomeBase && bw >= 48) {
    // Crisp white picket fence flanking Home Base + silver mailbox!
    drawPicketFence(ctx, bx - 2, wallY + wallH - 1, 15);
    drawPicketFence(ctx, bx + bw - 13, wallY + wallH - 1, 15);
    drawMailbox(ctx, midX + 8, wallY + wallH - 2);
  } else if (building.houseNumber && bw >= 38 && (minX + minY) % 3 === 0) {
    drawMailbox(ctx, bx + bw - 7, wallY + wallH - 2);
  }

  // 7. Tiny Crisp House Number Plaque on Addressed Houses (1-House-Per-Address Identity!)
  if (building.houseNumber && bw >= 36) {
    const numStr = String(building.houseNumber).replace(/[^0-9]/g, "").slice(0, 4);
    if (numStr) {
      const plaqueW = numStr.length * 4 + 3;
      const plaqueX = Math.floor(midX - plaqueW / 2);
      const plaqueY = by + 2;
      px(ctx, plaqueX - 1, plaqueY - 1, plaqueW + 2, 9, O);
      px(
        ctx,
        plaqueX,
        plaqueY,
        plaqueW,
        7,
        building.isHomeBase ? "#24573d" : "#28323d"
      );
      drawMiniNumber(
        ctx,
        numStr,
        midX,
        plaqueY + 1,
        building.isHomeBase ? "#f7dc6f" : "#f2f5f7"
      );
    }
  }

  return { canvas, offsetX: -padSide, offsetY: -padTop };
}

/**
 * Bake a crisp pixel-outlined 16x24 SNES Kid Explorer sprite for a given direction,
 * walk frame (0=idle, 1=stepA, 2=stepB), and optional kick scooter!
 */
function bakeHeroSprite(facing, stepFrame, onScooter) {
  const { canvas, ctx } = makeCanvas(20, 26);
  const cx = 10; // Horizontal center
  const feetY = 22;
  const O = "#1c1b24";

  // Soft ground shadow
  px(ctx, cx - 5, feetY, 10, 3, "rgba(16, 26, 18, 0.42)");

  // Kick Scooter (sleek teal deck, black wheels, silver stem)
  if (onScooter) {
    if (facing === "left" || facing === "right") {
      const dir = facing === "right" ? 1 : -1;
      // Wheels
      px(ctx, cx - 7, feetY, 3, 3, O);
      px(ctx, cx - 6, feetY + 1, 1, 1, "#7c8594");
      px(ctx, cx + 4, feetY, 3, 3, O);
      px(ctx, cx + 5, feetY + 1, 1, 1, "#7c8594");
      // Deck
      px(ctx, cx - 6, feetY - 1, 12, 2, O);
      px(ctx, cx - 5, feetY - 1, 10, 1, "#4de0d8");
      // Handlebar stem
      const stemX = dir > 0 ? cx + 5 : cx - 6;
      px(ctx, stemX, feetY - 10, 2, 10, O);
      px(ctx, stemX, feetY - 10, 1, 9, "#dbe4ee");
      px(ctx, stemX - 1, feetY - 11, 4, 2, O);
      px(ctx, stemX, feetY - 11, 2, 1, "#4de0d8");
    } else {
      px(ctx, cx - 3, feetY, 6, 3, O);
      px(ctx, cx - 2, feetY, 4, 2, "#4de0d8");
      px(ctx, cx - 5, feetY - 10, 10, 2, O);
      px(ctx, cx - 4, feetY - 10, 8, 1, "#dbe4ee");
    }
  }

  const legLiftL = !onScooter && stepFrame === 1 ? -1 : 0;
  const legLiftR = !onScooter && stepFrame === 2 ? -1 : 0;
  const bobY = !onScooter && stepFrame !== 0 ? -1 : 0;

  // Legs (jeans) + Red-and-White Sneakers
  px(ctx, cx - 4, feetY - 5 + legLiftL, 4, 6, O);
  px(ctx, cx - 3, feetY - 4 + legLiftL, 2, 3, "#3b598f");
  px(ctx, cx - 3, feetY - 1 + legLiftL, 2, 2, "#d64538");
  px(ctx, cx - 3, feetY + legLiftL, 2, 1, "#f2f4f7");

  px(ctx, cx, feetY - 5 + legLiftR, 4, 6, O);
  px(ctx, cx + 1, feetY - 4 + legLiftR, 2, 3, "#3b598f");
  px(ctx, cx + 1, feetY - 1 + legLiftR, 2, 2, "#d64538");
  px(ctx, cx + 1, feetY + legLiftR, 2, 1, "#f2f4f7");

  // Side Backpack (behind torso)
  if (facing === "left") {
    px(ctx, cx + 3, feetY - 12 + bobY, 5, 8, O);
    px(ctx, cx + 4, feetY - 11 + bobY, 3, 6, "#d94a38");
    px(ctx, cx + 4, feetY - 11 + bobY, 2, 2, "#f0725c");
    px(ctx, cx + 5, feetY - 8 + bobY, 1, 2, "#f4d35e");
  } else if (facing === "right") {
    px(ctx, cx - 8, feetY - 12 + bobY, 5, 8, O);
    px(ctx, cx - 7, feetY - 11 + bobY, 3, 6, "#d94a38");
    px(ctx, cx - 6, feetY - 11 + bobY, 2, 2, "#f0725c");
    px(ctx, cx - 6, feetY - 8 + bobY, 1, 2, "#f4d35e");
  }

  // Torso (Shaded Teal Explorer Hoodie with dark pixel outline)
  px(ctx, cx - 5, feetY - 12 + bobY, 10, 8, O);
  px(ctx, cx - 4, feetY - 11 + bobY, 8, 6, "#2c9e91");
  px(ctx, cx - 3, feetY - 11 + bobY, 6, 4, "#47c4b4");
  px(ctx, cx - 3, feetY - 11 + bobY, 6, 1, "#7ee0d2"); // Collar highlight
  // Arms
  if (facing === "down" || facing === "up") {
    px(ctx, cx - 5, feetY - 10 + bobY, 2, 4, "#248075");
    px(ctx, cx + 3, feetY - 10 + bobY, 2, 4, "#248075");
  }
  // Backpack on back when facing UP
  if (facing === "up") {
    px(ctx, cx - 4, feetY - 12 + bobY, 8, 7, O);
    px(ctx, cx - 3, feetY - 11 + bobY, 6, 5, "#d94a38");
    px(ctx, cx - 3, feetY - 11 + bobY, 6, 2, "#f0725c");
    px(ctx, cx - 1, feetY - 9 + bobY, 2, 2, "#f4d35e");
  }

  // Head (Crisp 16-bit SNES Proportions with Shaggy Chestnut Hair)
  const headY = feetY - 21 + bobY;
  // Head outline
  px(ctx, cx - 5, headY, 10, 10, O);
  px(ctx, cx - 4, headY - 1, 8, 1, O);
  // Warm skin
  px(ctx, cx - 4, headY + 3, 8, 6, "#f7d1ab");
  px(ctx, cx - 4, headY + 8, 8, 1, "#dfa97d"); // Chin shade
  // Chestnut hair top + bangs
  px(ctx, cx - 4, headY, 8, 4, "#8c502b");
  px(ctx, cx - 3, headY, 6, 2, "#ba713f"); // Sunlit hair highlight
  px(ctx, cx - 4, headY + 3, 2, 1, "#754122");
  px(ctx, cx + 2, headY + 3, 2, 1, "#754122");

  if (facing === "up") {
    px(ctx, cx - 4, headY + 1, 8, 8, "#7d4626");
    px(ctx, cx - 3, headY + 1, 6, 3, "#a66235");
  } else if (facing === "down") {
    // Expressive SNES eyes with white sparkle
    px(ctx, cx - 3, headY + 5, 2, 2, "#1c1c26");
    px(ctx, cx + 1, headY + 5, 2, 2, "#1c1c26");
    px(ctx, cx - 3, headY + 5, 1, 1, "#ffffff");
    px(ctx, cx + 1, headY + 5, 1, 1, "#ffffff");
    // Cute tiny rosy cheek pixels
    px(ctx, cx - 4, headY + 7, 1, 1, "#e89882");
    px(ctx, cx + 3, headY + 7, 1, 1, "#e89882");
  } else if (facing === "left") {
    px(ctx, cx - 3, headY + 5, 2, 2, "#1c1c26");
    px(ctx, cx - 3, headY + 5, 1, 1, "#ffffff");
    px(ctx, cx + 1, headY + 2, 3, 6, "#7d4626");
  } else if (facing === "right") {
    px(ctx, cx + 1, headY + 5, 2, 2, "#1c1c26");
    px(ctx, cx + 2, headY + 5, 1, 1, "#ffffff");
    px(ctx, cx - 4, headY + 2, 3, 6, "#7d4626");
  }

  return canvas;
}

/**
 * Generate the full high-craft 16-bit SNES pixel-art tile, prop & hero sprite atlas.
 */
export function buildSnesSpriteAtlas(paletteName = "snes_classic") {
  const P = PALETTES[paletteName] || PALETTES.snes_classic;
  const sprites = {};

  // --- 1. Grass & Wildflower Tiles ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.grassBase);
    if (v === 0) {
      px(ctx, 2, 3, 2, 1, P.grassLight);
      px(ctx, 3, 2, 1, 2, P.grassLight);
      px(ctx, 11, 10, 2, 1, P.grassLight);
      px(ctx, 12, 9, 1, 2, P.grassLight);
      px(ctx, 6, 13, 2, 1, P.grassMid);
      px(ctx, 13, 3, 2, 1, P.grassMid);
    } else {
      px(ctx, 4, 8, 2, 1, P.grassLight);
      px(ctx, 5, 7, 1, 2, P.grassLight);
      px(ctx, 10, 3, 2, 1, P.grassMid);
      px(ctx, 1, 13, 2, 1, P.grassMid);
      px(ctx, 12, 13, 2, 1, P.grassLight);
    }
    sprites[`grass_${v}`] = canvas;
  }

  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.grassBase);
    // Tiny white & golden daisies
    px(ctx, 3 + f, 5, 1, 2, P.grassDark);
    px(ctx, 2 + f, 4, 3, 2, "#fff9ec");
    px(ctx, 3 + f, 4, 1, 1, "#f4c430");
    px(ctx, 11 - f, 11, 1, 2, P.grassDark);
    px(ctx, 10 - f, 10, 3, 2, "#ffe066");
    px(ctx, 11 - f, 10, 1, 1, "#e76f51");
    sprites[`grass_flower_${f}`] = canvas;
  }

  // --- 2. Tall Grass (2 swaying frames) ---
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.tallGrassBase);
    const shift = f === 0 ? 0 : 1;
    const clusters = [
      [2, 5],
      [8, 4],
      [13, 6],
      [4, 12],
      [10, 11],
    ];
    for (const [bx, by] of clusters) {
      px(ctx, bx, by + 1, 3, 2, P.grassDark);
      px(ctx, bx + shift, by - 2, 1, 4, P.tallGrassMid);
      px(ctx, bx + 1 + shift, by - 3, 1, 5, P.tallGrassTip);
      px(ctx, bx + 2, by - 1, 1, 3, P.tallGrassMid);
    }
    sprites[`tall_grass_${f}`] = canvas;
  }

  // --- 3. Cobblestone Sidewalk Base (2 subtle variants) ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.sidewalkBase);
    // Warm top-left slab bevel highlights
    px(ctx, 1, 1, 6, 1, P.sidewalkLight);
    px(ctx, 9, 1, 6, 1, P.sidewalkLight);
    px(ctx, 1, 9, 6, 1, P.sidewalkLight);
    px(ctx, 9, 9, 6, 1, P.sidewalkLight);
    // Subtle slab shade
    px(ctx, 1, 6, 6, 1, P.sidewalkMid);
    px(ctx, 9, 14, 6, 1, P.sidewalkMid);
    // Crisp stone mortar lines
    px(ctx, 0, 7, 16, 1, P.sidewalkMortar);
    px(ctx, 0, 15, 16, 1, P.sidewalkMortar);
    px(ctx, 7, 0, 1, 8, P.sidewalkMortar);
    px(ctx, 15, 0, 1, 8, P.sidewalkMortar);
    px(ctx, v === 0 ? 3 : 11, 8, 1, 7, P.sidewalkMortar);
    px(ctx, v === 0 ? 11 : 3, 8, 1, 7, P.sidewalkMortar);
    if (v === 1) {
      px(ctx, 4, 4, 2, 1, P.sidewalkMortar);
      px(ctx, 12, 12, 1, 1, P.sidewalkCurbFace);
    }
    sprites[`sidewalk_${v}`] = canvas;
  }

  // --- 4. Clean Asphalt Bases (Auto-tiled markings layered cleanly in main.js) ---
  for (const [key, baseCol, darkCol] of [
    ["road_main_base", P.roadMain, P.roadMainDark],
    ["road_res_base", P.roadRes, P.roadResDark],
  ]) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, baseCol);
    // Subtle asphalt texture pixels
    px(ctx, 2, 3, 2, 1, darkCol);
    px(ctx, 11, 12, 2, 1, darkCol);
    px(ctx, 13, 4, 1, 1, "#5d6575");
    px(ctx, 5, 13, 1, 1, "#5d6575");
    sprites[key] = canvas;
  }

  // --- 5. Direction-Aware Zebra Crosswalks (Horizontal & Vertical!) ---
  {
    // Horizontal zebra stripes (for crossing E-W across a N-S street)
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.roadMain);
    for (let y = 1; y <= 13; y += 4) {
      px(ctx, 1, y, 14, 2, P.crosswalkWhite);
      px(ctx, 1, y + 2, 14, 1, P.crosswalkEdge);
    }
    sprites.crosswalk_h = canvas;
  }
  {
    // Vertical zebra stripes (for crossing N-S across an E-W street like Boylston St!)
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.roadMain);
    for (let x = 1; x <= 13; x += 4) {
      px(ctx, x, 1, 2, 14, P.crosswalkWhite);
      px(ctx, x + 2, 1, 1, 14, P.crosswalkEdge);
    }
    sprites.crosswalk_v = canvas;
  }

  // --- 5b. Parking Lot Asphalt + Painted Stall Lines & Parked 16-Bit Retro Cars ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, "#555c68");
    px(ctx, 3, 4, 2, 1, "#494f5a");
    px(ctx, 11, 11, 2, 1, "#626a78");
    if (v === 0) {
      // Crisp painted stall stripe + concrete wheel stop
      px(ctx, 0, 1, 1, 13, "#dce3ec");
      px(ctx, 3, 2, 10, 2, "#cfc9ba");
      px(ctx, 3, 3, 10, 1, "#8f897c");
    } else {
      // Clean drive aisle pavement
      px(ctx, 6, 7, 4, 1, "#687080");
    }
    sprites[`parking_${v}`] = canvas;
  }

  // Cute top-down 16-bit SNES parked cars (matching style_1_snes_16bit retro sedans!)
  const carColors = [
    { name: "car_red", body: "#c94c3e", light: "#e67060", dark: "#8c2c23" },
    { name: "car_sage", body: "#6f8c73", light: "#92b096", dark: "#4b634e" },
    { name: "car_blue", body: "#4c72a8", light: "#7399cc", dark: "#314d75" },
  ];
  for (const car of carColors) {
    const { canvas, ctx } = makeCanvas(14, 18);
    // Shadow
    px(ctx, 2, 2, 11, 16, "rgba(18, 22, 26, 0.4)");
    // Outline
    px(ctx, 1, 1, 12, 16, P.outline);
    // Body
    px(ctx, 2, 2, 10, 14, car.body);
    px(ctx, 2, 2, 10, 3, car.light); // Hood highlight
    px(ctx, 2, 13, 10, 3, car.dark); // Rear shade
    // Windshield & rear glass
    px(ctx, 3, 5, 8, 3, "#2a3b4f");
    px(ctx, 4, 5, 5, 1, "#8cc4e8");
    px(ctx, 3, 11, 8, 2, "#2a3b4f");
    // Roof panel
    px(ctx, 3, 8, 8, 3, car.light);
    // Headlights & taillights
    px(ctx, 3, 2, 2, 1, "#fff2a6");
    px(ctx, 9, 2, 2, 1, "#fff2a6");
    px(ctx, 3, 15, 2, 1, "#eb4d42");
    px(ctx, 9, 15, 2, 1, "#eb4d42");
    sprites[car.name] = canvas;
  }

  // --- 6. Shimmering Water (2 frames) ---
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.waterMid);
    px(ctx, 0, 12, 16, 4, P.waterDeep);
    const sx = f === 0 ? 2 : 6;
    px(ctx, sx, 4, 5, 1, P.waterLight);
    px(ctx, sx + 1, 4, 3, 1, P.waterShimmer);
    px(ctx, (sx + 7) % 12, 10, 4, 1, P.waterLight);
    px(ctx, (sx + 8) % 12, 10, 2, 1, P.waterShimmer);
    sprites[`water_${f}`] = canvas;
  }

  // --- 7. Lush 24x28 16-Bit SNES Oak Tree (matching style_1_snes_16bit!) ---
  {
    const { canvas, ctx } = makeCanvas(24, 28);
    // Oval ground shadow
    px(ctx, 4, 23, 16, 4, "rgba(16, 30, 18, 0.38)");
    px(ctx, 6, 22, 12, 5, "rgba(16, 30, 18, 0.25)");
    // Gnarled shaded trunk + root flare with dark outline
    px(ctx, 8, 17, 8, 8, P.treeOutline);
    px(ctx, 7, 22, 10, 3, P.treeOutline);
    px(ctx, 9, 17, 6, 7, P.treeTrunk);
    px(ctx, 10, 18, 2, 6, P.treeTrunkLight);
    px(ctx, 13, 17, 2, 7, P.treeTrunkDark);
    px(ctx, 8, 23, 8, 1, P.treeTrunkDark);

    // Outer canopy dark pixel outline
    px(ctx, 4, 3, 16, 15, P.treeOutline);
    px(ctx, 2, 6, 20, 11, P.treeOutline);
    px(ctx, 1, 9, 22, 7, P.treeOutline);
    px(ctx, 6, 1, 12, 18, P.treeOutline);

    // Deep canopy shadow layer
    px(ctx, 3, 7, 18, 10, P.treeDark);
    px(ctx, 2, 10, 20, 6, P.treeDark);
    px(ctx, 5, 4, 14, 14, P.treeDark);

    // Mid green foliage puffs
    px(ctx, 3, 7, 17, 8, P.treeMid);
    px(ctx, 5, 3, 14, 11, P.treeMid);
    px(ctx, 7, 2, 10, 11, P.treeMid);

    // Sunlit leaf crown clusters
    px(ctx, 4, 6, 6, 5, P.treeLight);
    px(ctx, 10, 4, 8, 6, P.treeLight);
    px(ctx, 7, 2, 8, 5, P.treeLight);
    px(ctx, 14, 8, 5, 4, P.treeLight);
    px(ctx, 8, 9, 6, 4, P.treeLight);

    // Crisp sunlit top highlights
    px(ctx, 8, 3, 4, 2, P.treeHighlight);
    px(ctx, 13, 5, 3, 2, P.treeHighlight);
    px(ctx, 5, 7, 3, 2, P.treeHighlight);
    px(ctx, 10, 9, 2, 2, P.treeHighlight);
    sprites.tree_oak = canvas;
  }

  // --- 8. Glowing Green WALK Crosswalk Signal Post (2 states: steady & bright checked!) ---
  for (let bright = 0; bright < 2; bright++) {
    const { canvas, ctx } = makeCanvas(18, 24);
    // Pole shadow
    px(ctx, 11, 21, 5, 2, "rgba(18, 24, 22, 0.4)");
    // Metal pole + base flange
    px(ctx, 12, 6, 3, 16, P.outline);
    px(ctx, 13, 7, 1, 14, "#adb6c4");
    px(ctx, 11, 20, 5, 2, P.outline);
    px(ctx, 12, 20, 3, 1, "#8d96a6");
    // Curved overhanging arm
    px(ctx, 5, 5, 9, 2, P.outline);
    px(ctx, 6, 5, 7, 1, "#bfc8d6");
    // Black signal housing box
    px(ctx, 1, 7, 11, 8, P.outline);
    px(ctx, 2, 8, 9, 6, "#141d18");
    // Glowing green WALK pixel indicator (tiny walking person + green bars)
    const glow = bright ? "#7dff9b" : "#3be06c";
    const aura = bright ? "rgba(110, 255, 155, 0.35)" : "rgba(59, 224, 108, 0.16)";
    px(ctx, 0, 6, 13, 10, aura);
    px(ctx, 2, 8, 9, 6, "#16241b");
    // Mini pixel 'W A L K' / walking silhouette glow
    px(ctx, 3, 9, 1, 4, glow);
    px(ctx, 4, 12, 1, 1, glow);
    px(ctx, 5, 10, 1, 2, glow);
    px(ctx, 6, 12, 1, 1, glow);
    px(ctx, 7, 9, 1, 4, glow);
    px(ctx, 9, 9, 1, 4, glow);
    sprites[`walk_signal_${bright}`] = canvas;
  }

  // --- 9. Classic Red Fire Hydrant (from style_1_snes_16bit!) ---
  {
    const { canvas, ctx } = makeCanvas(10, 14);
    px(ctx, 2, 11, 6, 2, "rgba(18, 24, 22, 0.38)");
    px(ctx, 2, 3, 6, 9, P.outline);
    px(ctx, 1, 5, 8, 3, P.outline);
    px(ctx, 3, 2, 4, 2, P.outline);
    px(ctx, 3, 4, 4, 7, "#c9302c");
    px(ctx, 3, 4, 2, 6, "#eb5249");
    px(ctx, 2, 6, 6, 1, "#d93b36");
    px(ctx, 4, 3, 2, 1, "#f27972");
    px(ctx, 3, 10, 4, 1, "#8f1f1c");
    sprites.prop_hydrant = canvas;
  }

  // --- 10. Collectibles (Coin & Acorn) ---
  {
    const { canvas, ctx } = makeCanvas(8, 8);
    px(ctx, 2, 0, 4, 8, P.outline);
    px(ctx, 0, 2, 8, 4, P.outline);
    px(ctx, 2, 1, 4, 6, "#d99b1e");
    px(ctx, 1, 2, 6, 4, "#f4d35e");
    px(ctx, 2, 2, 4, 4, "#ffe885");
    px(ctx, 3, 3, 1, 2, "#fff9d6");
    sprites.drop_coin = canvas;
  }
  {
    const { canvas, ctx } = makeCanvas(8, 8);
    px(ctx, 3, 0, 2, 2, "#4a2e1d");
    px(ctx, 1, 2, 6, 2, "#6e4228");
    px(ctx, 2, 4, 4, 3, "#b97a45");
    px(ctx, 3, 7, 2, 1, "#8c572c");
    px(ctx, 3, 4, 1, 2, "#e8b37c");
    sprites.drop_acorn = canvas;
  }

  // --- 11. Pre-Baked Pixel-Outlined 16x24 Hero Sprites ---
  for (const dir of ["down", "up", "left", "right"]) {
    for (let step = 0; step < 3; step++) {
      sprites[`hero_${dir}_${step}`] = bakeHeroSprite(dir, step, false);
    }
    sprites[`hero_scooter_${dir}`] = bakeHeroSprite(dir, 0, true);
  }

  return sprites;
}
