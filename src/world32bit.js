/**
 * 32-Bit All-Pixel-Driven Autumn Golden-Hour World Atlas
 * (2x native HD pixel density, __pixelScale = 0.5 on our 640x360 pixel buffer).
 *
 * Crafted closely after New England Golden-Hour Autumn pixel art:
 *  - Golden-amber autumn lawns scattered with crimson/orange fallen leaves
 *  - Warm mauve-taupe cobblestone sidewalks with beveled stones & mortar joints
 *  - Dusk-brownish-slate asphalt roads, golden lane markings & warm cream crosswalks
 *  - 3 distinct 5-tone autumn maple/oak tree colorways (Crimson, Golden-Amber, Scarlet-Orange)
 *    paired with deep-olive evergreen pines & green boxwood garden shrubs
 *  - Crunchy autumn leaf piles along curbs, vintage glowing street lamps, metallic parked cars,
 *    fluted green Massachusetts street signs, cedar benches, hydrants & Little Free Library chests
 */

import { upgradeItemsAndFxTo32Bit } from "./items32bit.js";

function makeHdCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.__pixelScale = 0.5;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function pxEllipse(ctx, cx, cy, rx, ry, color) {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  ctx.fillStyle = color;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / Math.max(0.5, rx);
      const dy = (y - cy) / Math.max(0.5, ry);
      if (dx * dx + dy * dy <= 1.0) ctx.fillRect(x, y, 1, 1);
    }
  }
}

function ditherShadowEllipse(ctx, cx, cy, rx, ry) {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const d2 = dx * dx + dy * dy;
      if (d2 <= 0.55) {
        ctx.fillStyle = "rgba(42, 20, 18, 0.38)";
        ctx.fillRect(x, y, 1, 1);
      } else if (d2 <= 1.0 && (x + y) % 2 === 0) {
        ctx.fillStyle = "rgba(42, 20, 18, 0.25)";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function h2(x, y, seed = 0) {
  let n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return (n ^ (n >>> 16)) >>> 0;
}

function drawGrassTuft(ctx, x, y, light, mid, dark) {
  px(ctx, x, y + 2, 3, 1, dark);
  px(ctx, x - 1, y + 1, 1, 1, mid);
  px(ctx, x, y, 1, 2, light);
  px(ctx, x + 2, y + 1, 1, 1, light);
  px(ctx, x + 3, y, 1, 2, mid);
}

function drawFallenLeaf(ctx, x, y, variant = 0) {
  const pal = [
    ["#b82b22", "#e6532e"], // crimson
    ["#d4601e", "#f5a433"], // tangerine-gold
    ["#8f241e", "#cf3c29"], // deep maple red
  ][variant % 3];
  px(ctx, x, y + 1, 3, 1, "rgba(46, 22, 14, 0.35)");
  px(ctx, x, y, 2, 1, pal[0]);
  px(ctx, x + 1, y - 1, 2, 1, pal[1]);
}

function draw32BitFlower(ctx, x, y, petalHi, petalShade, center, stem) {
  px(ctx, x + 1, y + 3, 1, 3, stem);
  px(ctx, x, y + 4, 1, 1, stem);
  px(ctx, x + 1, y, 1, 1, petalHi);
  px(ctx, x, y + 1, 3, 1, petalHi);
  px(ctx, x + 1, y + 2, 1, 1, petalShade);
  px(ctx, x + 1, y + 1, 1, 1, center);
}

/**
 * Bake a lush 5-tone 32-bit New England Autumn Maple/Oak Tree (48x56 native px).
 */
function bakeAutumnOakTree(colors, seed) {
  const { canvas, ctx } = makeHdCanvas(48, 56);
  const { outline, deep, mid, light, crown, speck } = colors;
  ditherShadowEllipse(ctx, 24, 50, 17, 5);

  // Gnarled warm brown New England maple trunk with flared roots
  px(ctx, 18, 30, 12, 20, "#2b160e");
  px(ctx, 15, 46, 18, 5, "#2b160e");
  px(ctx, 19, 31, 10, 19, "#6e4024");
  px(ctx, 16, 47, 16, 3, "#6e4024");
  px(ctx, 20, 32, 4, 17, "#965b36");
  px(ctx, 21, 33, 2, 14, "#b8784b");
  px(ctx, 26, 32, 3, 18, "#472514");
  px(ctx, 23, 38, 1, 6, "#472514");

  // Scattered fallen leaves ringed around tree roots!
  drawFallenLeaf(ctx, 10, 50, seed);
  drawFallenLeaf(ctx, 33, 49, seed + 1);
  drawFallenLeaf(ctx, 16, 52, seed + 2);
  drawFallenLeaf(ctx, 28, 52, seed);

  // Sculpted scalloped canopy silhouette outline
  pxEllipse(ctx, 24, 21, 20.5, 16.5, outline);
  pxEllipse(ctx, 13, 25, 11.5, 10.5, outline);
  pxEllipse(ctx, 35, 25, 11.5, 10.5, outline);
  pxEllipse(ctx, 24, 11, 14.5, 10, outline);

  // Layer 1: Deep shaded autumn canopy underside
  pxEllipse(ctx, 24, 22, 19, 15, deep);
  pxEllipse(ctx, 13, 25, 10, 9, deep);
  pxEllipse(ctx, 35, 25, 10, 9, deep);

  // Layer 2: Rich mid-canopy leaf clusters
  for (const [cx, cy, rx, ry] of [
    [24, 19, 15.5, 11.5],
    [14, 22, 8.5, 7],
    [34, 22, 8.5, 7],
    [24, 11, 12.5, 8.5],
    [17, 14, 8, 6.5],
    [31, 14, 8, 6.5],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, mid);
  }

  // Layer 3: Golden-hour sunlit foliage clusters
  for (const [cx, cy, rx, ry] of [
    [22, 9.5, 9.5, 5.5],
    [14, 17, 6.5, 5],
    [29, 13, 7, 5],
    [22, 18, 8.5, 5],
    [33, 19, 5.5, 4],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, light);
  }

  // Layer 4: Glowing golden-hour crown tips & crisp individual leaf pixels!
  pxEllipse(ctx, 20, 8, 6.5, 3.2, crown);
  pxEllipse(ctx, 14, 15, 4, 2.5, crown);
  pxEllipse(ctx, 28, 11, 4.5, 2.5, crown);
  for (let i = 0; i < 36; i++) {
    const lx = 9 + (h2(i, 1, seed + 7) % 30);
    const ly = 5 + (h2(i, 2, seed + 7) % 20);
    px(ctx, lx, ly, 2, 1, i % 3 === 0 ? speck : i % 3 === 1 ? crown : deep);
  }
  return canvas;
}

/**
 * Bake a 32-bit Mediterranean Olive Tree (gnarled silver-brown trunk + airy silvery-sage canopy!).
 */
function bakeOliveTree(seed = 11) {
  const { canvas, ctx } = makeHdCanvas(48, 56);
  const O = "#243022";
  ditherShadowEllipse(ctx, 24, 50, 16, 4.5);

  // Twisted silvery-gray Mediterranean olive trunk with split boughs
  px(ctx, 20, 32, 8, 19, "#2b2620");
  px(ctx, 16, 47, 16, 4, "#2b2620");
  px(ctx, 21, 33, 6, 17, "#756a5c");
  px(ctx, 21, 33, 3, 16, "#9c9080");
  px(ctx, 22, 34, 1, 13, "#bfb5a6");
  px(ctx, 17, 48, 14, 2, "#877a6b");
  // Forked upper boughs
  px(ctx, 15, 27, 6, 6, "#2b2620");
  px(ctx, 16, 28, 4, 4, "#8a7e6e");
  px(ctx, 27, 27, 6, 6, "#2b2620");
  px(ctx, 28, 28, 4, 4, "#756a5c");

  // Pale limestone pebbles at tree base
  px(ctx, 12, 50, 4, 2, "#dfd5be");
  px(ctx, 32, 51, 3, 2, "#cfc3aa");

  // Airy scalloped silvery-sage olive foliage canopy
  pxEllipse(ctx, 24, 21, 19.5, 14.5, O);
  pxEllipse(ctx, 13, 24, 10.5, 9, O);
  pxEllipse(ctx, 35, 24, 10.5, 9, O);
  pxEllipse(ctx, 24, 12, 13.5, 9, O);

  pxEllipse(ctx, 24, 22, 18, 13, "#41573b");
  pxEllipse(ctx, 13, 24, 9, 7.5, "#41573b");
  pxEllipse(ctx, 35, 24, 9, 7.5, "#41573b");

  for (const [cx, cy, rx, ry] of [
    [24, 19, 15, 10.5],
    [14, 21, 8, 6.5],
    [34, 21, 8, 6.5],
    [24, 12, 11.5, 7.5],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, "#66805a");
  }
  for (const [cx, cy, rx, ry] of [
    [21, 11, 8.5, 5],
    [14, 18, 5.5, 4],
    [30, 15, 6, 4.5],
    [24, 19, 7.5, 4],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, "#8fa880");
  }
  pxEllipse(ctx, 20, 9.5, 5.5, 2.8, "#bdd1ad");
  pxEllipse(ctx, 28, 13, 4, 2.2, "#bdd1ad");

  // Fine silvery leaf shimmer + tiny dark-purple/green olives tucked in branches!
  for (let i = 0; i < 34; i++) {
    const lx = 9 + (h2(i, 1, seed + 19) % 30);
    const ly = 6 + (h2(i, 2, seed + 19) % 19);
    px(ctx, lx, ly, 2, 1, i % 5 === 0 ? "#312d3d" : i % 2 === 0 ? "#d4e3c5" : "#4b6342");
  }
  return canvas;
}

/**
 * Bake a 32-bit Jerusalem Umbrella / Stone Pine (reddish trunk + layered Mediterranean parasol crown!).
 */
function bakeJerusalemPineTree(seed = 23) {
  const { canvas, ctx } = makeHdCanvas(48, 56);
  const O = "#16291c";
  ditherShadowEllipse(ctx, 24, 51, 16, 4.5);

  // Tall reddish-cinnamon Jerusalem pine trunk
  px(ctx, 20, 26, 8, 25, "#2b1710");
  px(ctx, 17, 47, 14, 4, "#2b1710");
  px(ctx, 21, 27, 6, 23, "#874b2c");
  px(ctx, 22, 27, 2, 22, "#b56c43");
  px(ctx, 25, 27, 2, 23, "#5c301b");
  // Forked upper boughs supporting umbrella canopy
  px(ctx, 16, 22, 16, 5, "#2b1710");
  px(ctx, 17, 23, 14, 3, "#874b2c");

  // Wide Mediterranean parasol canopy silhouette
  pxEllipse(ctx, 24, 15, 21, 11.5, O);
  pxEllipse(ctx, 13, 18, 10.5, 7, O);
  pxEllipse(ctx, 35, 18, 10.5, 7, O);
  pxEllipse(ctx, 24, 9, 15, 7, O);

  pxEllipse(ctx, 24, 16, 19.5, 10, "#1f4a2c");
  pxEllipse(ctx, 13, 18, 9, 5.5, "#1f4a2c");
  pxEllipse(ctx, 35, 18, 9, 5.5, "#1f4a2c");

  for (const [cx, cy, rx, ry] of [
    [24, 13, 17, 8],
    [14, 16, 8, 4.5],
    [34, 16, 8, 4.5],
    [24, 9, 13, 5.5],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, "#356e3f");
  }
  for (const [cx, cy, rx, ry] of [
    [21, 8, 10, 4],
    [13, 14, 6, 3],
    [31, 12, 6.5, 3.2],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, "#569654");
  }
  pxEllipse(ctx, 20, 6.5, 6.5, 2.2, "#87c474");
  for (let i = 0; i < 30; i++) {
    const lx = 7 + (h2(i, 1, seed + 41) % 34);
    const ly = 5 + (h2(i, 2, seed + 41) % 15);
    px(ctx, lx, ly, 2, 1, i % 3 === 0 ? "#a4db8a" : "#255432");
  }
  return canvas;
}

/**
 * Bake a tall 32-bit Mediterranean Pencil Cypress (iconic slender Jerusalem hillside spire!).
 */
function bakePencilCypressTree(seed = 31) {
  const { canvas, ctx } = makeHdCanvas(44, 60);
  const O = "#102117";
  ditherShadowEllipse(ctx, 22, 54, 10, 3.8);

  // Short neat brown trunk at base
  px(ctx, 19, 46, 6, 9, "#291810");
  px(ctx, 20, 47, 4, 7, "#6e442b");
  px(ctx, 21, 47, 1, 7, "#96603e");

  // Tall flame-shaped columnar cypress silhouette (narrow spire tapering cleanly to top!)
  for (let y = 3; y <= 48; y++) {
    const t = (y - 3) / 45;
    let halfW;
    if (t < 0.22) {
      halfW = 1 + (t / 0.22) * 5;
    } else if (t < 0.78) {
      halfW = 6 + Math.sin(((t - 0.22) / 0.56) * Math.PI) * 3.5;
    } else {
      halfW = 8.5 * (1 - ((t - 0.78) / 0.22) * 0.45);
    }
    const w = Math.max(2, Math.round(halfW * 2));
    const x0 = Math.round(22 - w / 2);
    px(ctx, x0 - 1, y, w + 2, 1, O);
    px(ctx, x0, y, w, 1, "#1b422b");
    const midW = Math.max(1, Math.floor(w * 0.68));
    px(ctx, x0 + 1, y, midW, 1, "#2d633d");
    if (w >= 6 && y % 2 === 0) {
      px(ctx, x0 + 2, y, Math.max(1, Math.floor(w * 0.35)), 1, "#4a8a52");
    }
    if (w >= 8 && (y + seed) % 5 === 0) {
      px(ctx, x0 + 2, y, 2, 1, "#72b36b");
    }
  }
  return canvas;
}

/**
 * Bake a 32-bit Coastal/Oasis Date Palm Tree (graceful ringed trunk + arching emerald fronds + golden dates!).
 */
function bakeDatePalmTree(seed = 43) {
  const { canvas, ctx } = makeHdCanvas(48, 60);
  const O = "#1b2914";
  ditherShadowEllipse(ctx, 24, 54, 15, 4.5);

  const curveDir = seed % 2 === 0 ? 1 : -1;
  // Slightly curved textured palm trunk with horizontal frond rings
  for (let y = 20; y <= 53; y++) {
    const frac = (y - 20) / 33;
    const cx = 24 + Math.round(Math.sin(frac * Math.PI) * 2.5 * curveDir);
    const w = frac > 0.85 ? 8 : 6;
    px(ctx, cx - Math.floor(w / 2) - 1, y, w + 2, 1, "#2e1e12");
    px(ctx, cx - Math.floor(w / 2), y, w, 1, y % 3 === 0 ? "#6e4c2e" : "#966c44");
    px(ctx, cx - Math.floor(w / 2) + 1, y, 2, 1, "#bd9160");
  }

  // Golden date clusters hanging beneath crown
  const topX = 24;
  const topY = 20;
  px(ctx, topX - 5, topY + 1, 4, 5, "#4a2c0e");
  px(ctx, topX - 4, topY + 2, 2, 3, "#e8a82e");
  px(ctx, topX + 2, topY + 1, 4, 5, "#4a2c0e");
  px(ctx, topX + 3, topY + 2, 2, 3, "#f5be42");

  // 7 lush arching palm fronds radiating from crown
  const fronds = [
    [-19, -4, -9, -11],
    [-17, 7, -9, -2],
    [-11, -13, -5, -13],
    [0, -15, 0, -10],
    [11, -13, 5, -13],
    [17, 7, 9, -2],
    [19, -4, 9, -11],
  ];
  for (const [ex, ey, cx, cy] of fronds) {
    for (let s = 0; s <= 18; s++) {
      const t = s / 18;
      const omt = 1 - t;
      const fx = topX + 2 * omt * t * cx + t * t * ex;
      const fy = topY + 2 * omt * t * cy + t * t * ey;
      const thick = s < 14 ? 3 : 2;
      px(ctx, fx - 1, fy - 1, thick + 2, thick + 2, O);
    }
  }
  for (const [ex, ey, cx, cy] of fronds) {
    for (let s = 0; s <= 18; s++) {
      const t = s / 18;
      const omt = 1 - t;
      const fx = topX + 2 * omt * t * cx + t * t * ex;
      const fy = topY + 2 * omt * t * cy + t * t * ey;
      const thick = s < 14 ? 3 : 2;
      px(ctx, fx, fy, thick, thick, s > 12 ? "#2d6b2e" : "#448f3c");
      px(ctx, fx, fy, Math.max(1, thick - 1), 1, "#7cc452");
      if (s > 3 && s < 16 && s % 2 === 0) {
        px(ctx, fx, fy + 2, 1, 3, "#255726");
      }
    }
  }
  pxEllipse(ctx, topX, topY - 1, 4.5, 3.5, "#63ab48");
  pxEllipse(ctx, topX - 1, topY - 2, 2.5, 1.8, "#9be06c");
  return canvas;
}

/**
 * Bake a 32-bit Flowering Mediterranean Tree (Bougainvillea Magenta, Almond Blossom Pink, or Jacaranda Violet!).
 */
function bakeFloweringTree(flowerColors, seed = 55) {
  const { canvas, ctx } = makeHdCanvas(48, 56);
  const { outline, deep, mid, light, crown, speck } = flowerColors;
  ditherShadowEllipse(ctx, 24, 50, 16, 4.5);

  px(ctx, 19, 31, 10, 20, "#2b1a12");
  px(ctx, 16, 47, 16, 4, "#2b1a12");
  px(ctx, 20, 32, 8, 18, "#704d34");
  px(ctx, 21, 32, 3, 17, "#9c704f");
  px(ctx, 26, 32, 2, 18, "#4d311f");

  // Tiny fallen blossoms around trunk!
  px(ctx, 12, 50, 2, 1, light);
  px(ctx, 32, 51, 2, 1, crown);
  px(ctx, 16, 52, 2, 1, mid);

  pxEllipse(ctx, 24, 21, 19, 15, outline);
  pxEllipse(ctx, 13, 24, 10.5, 9, outline);
  pxEllipse(ctx, 35, 24, 10.5, 9, outline);
  pxEllipse(ctx, 24, 12, 13.5, 9, outline);

  pxEllipse(ctx, 24, 22, 17.5, 13.5, deep);
  pxEllipse(ctx, 13, 24, 9, 7.5, deep);
  pxEllipse(ctx, 35, 24, 9, 7.5, deep);

  for (const [cx, cy, rx, ry] of [
    [24, 19, 15, 10.5],
    [14, 22, 8, 6.5],
    [34, 22, 8, 6.5],
    [24, 12, 11.5, 8],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, mid);
  }
  for (const [cx, cy, rx, ry] of [
    [21, 10, 9, 5],
    [14, 17, 6, 4.5],
    [30, 14, 6.5, 4.5],
    [23, 19, 8, 4.5],
  ]) {
    pxEllipse(ctx, cx, cy, rx, ry, light);
  }
  pxEllipse(ctx, 20, 8.5, 5.5, 3, crown);
  for (let i = 0; i < 38; i++) {
    const lx = 9 + (h2(i, 1, seed + 13) % 30);
    const ly = 6 + (h2(i, 2, seed + 13) % 19);
    px(ctx, lx, ly, 2, 1, i % 4 === 0 ? speck : i % 4 === 1 ? "#3e6e35" : crown);
  }
  return canvas;
}

/**
 * Bake a 32-bit Negev / Southwest Flat-Topped Desert Acacia Tree.
 */
function bakeDesertAcaciaTree(seed = 67) {
  const { canvas, ctx } = makeHdCanvas(48, 56);
  const O = "#242e18";
  ditherShadowEllipse(ctx, 24, 50, 18, 4.5);

  px(ctx, 21, 30, 6, 21, "#2b1c12");
  px(ctx, 22, 31, 4, 19, "#7a583a");
  px(ctx, 22, 31, 2, 18, "#9e7752");
  // Wide V-shaped branches
  for (let i = 0; i < 10; i++) {
    px(ctx, 22 - i, 31 - i, 3, 2, "#593d26");
    px(ctx, 24 + i, 31 - i, 3, 2, "#593d26");
  }
  // Wide flat umbrella canopy
  pxEllipse(ctx, 24, 19, 22, 7.5, O);
  pxEllipse(ctx, 24, 15, 17, 6, O);
  pxEllipse(ctx, 24, 19, 20.5, 6.2, "#4b6132");
  pxEllipse(ctx, 24, 15.5, 15.5, 4.8, "#6d8544");
  pxEllipse(ctx, 21, 14, 11, 3.2, "#92ab59");
  pxEllipse(ctx, 19, 13, 6, 2, "#b8cc76");
  for (let i = 0; i < 24; i++) {
    const lx = 6 + (h2(i, 1, seed + 5) % 36);
    const ly = 12 + (h2(i, 2, seed + 5) % 10);
    px(ctx, lx, ly, 2, 1, i % 2 === 0 ? "#c9db86" : "#3a4d26");
  }
  return canvas;
}

/**
 * Bake a 32-bit Snow-Dusted Winter Evergreen Pine (deep frosted spruce boughs laden with sparkling snow!).
 */
function bakeWinterSnowPine(seed = 61, compact = false) {
  const { canvas, ctx } = makeHdCanvas(44, 60);
  const O = "#142230";
  ditherShadowEllipse(ctx, 22, 54, compact ? 12 : 15, 4.2);
  px(ctx, 18, 43, 8, 12, "#241914");
  px(ctx, 19, 44, 6, 10, "#593e2e");
  px(ctx, 20, 44, 2, 10, "#7d5b45");

  const tiers = compact
    ? [
        { yTop: 32, h: 15, wBot: 28, wTop: 10 },
        { yTop: 22, h: 14, wBot: 22, wTop: 6 },
        { yTop: 12, h: 13, wBot: 14, wTop: 2 },
      ]
    : [
        { yTop: 28, h: 19, wBot: 36, wTop: 14 },
        { yTop: 19, h: 16, wBot: 30, wTop: 10 },
        { yTop: 11, h: 14, wBot: 22, wTop: 6 },
        { yTop: 3, h: 12, wBot: 14, wTop: 2 },
      ];
  for (const t of tiers) {
    for (let r = 0; r < t.h; r++) {
      const frac = r / Math.max(1, t.h - 1);
      const w = Math.round(t.wTop + (t.wBot - t.wTop) * frac);
      const x0 = Math.round(22 - w / 2);
      const y = t.yTop + r;
      px(ctx, x0 - 1, y, w + 2, 1, O);
      // Sparkling white/ice-blue snow cap resting on upper half of every bough tier!
      if (r < Math.max(3, Math.floor(t.h * 0.48))) {
        px(ctx, x0, y, w, 1, r < 2 ? "#ffffff" : "#dceefc");
        if (w >= 6 && (r + seed) % 2 === 0) px(ctx, x0 + Math.floor(w * 0.65), y, Math.max(1, Math.floor(w * 0.25)), 1, "#b4d4f0");
      } else {
        px(ctx, x0, y, w, 1, r > t.h - 3 ? "#193836" : "#285752");
        if (r < t.h - 3) px(ctx, x0 + 1, y, Math.max(1, Math.floor(w * 0.45)), 1, "#3f7a70");
      }
    }
  }
  return canvas;
}

/**
 * Bake a 32-bit Sculpted Winter Bare Oak Tree with frosted snow-dusted boughs & snowbank at roots!
 */
function bakeWinterBareOak(seed = 73) {
  const { canvas, ctx } = makeHdCanvas(48, 56);
  ditherShadowEllipse(ctx, 24, 51, 15, 4.2);
  // Crisp snowdrift around trunk roots
  pxEllipse(ctx, 24, 49, 12, 3.2, "#dceefc");
  pxEllipse(ctx, 22, 48, 8, 2.0, "#ffffff");
  // Sturdy winter trunk
  px(ctx, 19, 26, 10, 23, "#241914");
  px(ctx, 20, 27, 8, 21, "#5c4234");
  px(ctx, 21, 27, 3, 20, "#856654");
  // Sculpted spreading bare branches + snow caps along upper edges!
  const drawBranch = (x0, y0, x1, y1, w) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const bx = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps));
      const by = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps));
      px(ctx, bx - 1, by - 1, w + 2, w + 2, "#241914");
      px(ctx, bx, by, w, w, "#664a3a");
      px(ctx, bx, by - 1, w, 1, "#eef7ff"); // frost/snow rim on top of branch!
    }
  };
  drawBranch(22, 28, 9, 14, 3);
  drawBranch(14, 19, 6, 10, 2);
  drawBranch(26, 28, 38, 15, 3);
  drawBranch(33, 20, 41, 11, 2);
  drawBranch(24, 26, 21, 9, 2);
  drawBranch(24, 24, 29, 10, 2);
  // Subtle frost crystals clinging to twigs
  for (let i = 0; i < 14; i++) {
    const sx = 8 + (h2(i, 1, seed + 13) % 32);
    const sy = 8 + (h2(i, 2, seed + 13) % 16);
    px(ctx, sx, sy, 2, 1, "#ffffff");
  }
  return canvas;
}

/**
 * Upgrade ground tiles, lush regional trees, sidewalks, leaf piles/petals,
 * street lamps, street signs, vehicles & props to 32-bit 2x native pixels!
 */
export function upgradeAtlasTo32Bit(sprites, P, biomeConfig = null) {
  const hasFallenLeaves = biomeConfig ? Boolean(biomeConfig.hasFallenLeaves) : true;
  const hasSnowGround = Boolean(biomeConfig?.hasSnowGround);
  const sidewalkStyle = biomeConfig?.sidewalkStyle || "cobblestone";
  const treeStyle = biomeConfig?.treeStyle || "autumn_new_england";
  const shrubStyle = biomeConfig?.shrubStyle || "boxwood";
  const streetSignStyle = biomeConfig?.streetSignStyle || "us_green";
  const ambientParticleStyle = biomeConfig?.ambientParticleStyle || "autumn_leaves";
  const isIsraelBiome = String(biomeConfig?.id || "").startsWith("israel_");
  const isIsraelWinter = biomeConfig?.paletteKey === "israel_winter_green";
  const isDesertBiome = biomeConfig?.id === "israel_desert" || biomeConfig?.id === "southwest_desert";

  const drawGroundScatter = (ctx, x, y, variant = 0) => {
    if (hasSnowGround) {
      // Sparkling snow crystal glint + tiny ice pebble
      px(ctx, x, y, 2, 1, variant % 2 === 0 ? "#ffffff" : "#b8d6f0");
      if (variant % 3 === 0) px(ctx, x + 1, y + 1, 1, 1, "#d8ecfc");
    } else if (hasFallenLeaves) {
      drawFallenLeaf(ctx, x, y, variant);
    } else if (isIsraelWinter) {
      // Iconic Israeli winter red kalaniyot (anemone) blooms dotting emerald green hills!
      draw32BitFlower(ctx, x, y, "#f03232", "#a81818", "#241914", "#3b6e2e");
    } else if (isDesertBiome) {
      // Sun-warmed sandstone pebbles
      px(ctx, x, y + 1, 3, 1, "rgba(64, 42, 22, 0.25)");
      px(ctx, x, y, 2, 1, variant % 2 === 0 ? "#e6c79c" : "#c79b6b");
    } else if (isIsraelBiome) {
      // Pale Jerusalem limestone pebbles & tiny sun-warmed meadow flecks
      px(ctx, x, y + 1, 3, 1, "rgba(62, 52, 34, 0.22)");
      px(ctx, x, y, 2, 1, variant % 2 === 0 ? "#ece2cc" : "#d9cca8");
    } else if (ambientParticleStyle === "spring_petals") {
      // Fallen soft pink sakura / almond petals on spring grass!
      px(ctx, x, y, 2, 1, variant % 2 === 0 ? "#ffb8d4" : "#ffe0ec");
    } else {
      // Crisp fresh clover sprig
      px(ctx, x, y, 2, 1, P.grassLight);
      px(ctx, x + 1, y - 1, 1, 1, "#b8ed8a");
    }
  };

  // =========================================================================
  // 1. 32x32 REGIONAL LAWNS, PARKS, DIRT, SAND & WOODS
  // =========================================================================
  const tuftTip = hasFallenLeaves ? "#f7c259" : P.grassLight;
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.grassBase);
    for (let y = 0; y < 32; y += 2) {
      for (let x = 0; x < 32; x += 2) {
        const r = h2(x, y, v + 11) % 16;
        if (r === 0) px(ctx, x, y, 2, 1, P.grassMid);
        else if (r === 1) px(ctx, x, y, 2, 1, P.grassLight);
      }
    }
    if (v === 0) {
      drawGrassTuft(ctx, 5, 6, tuftTip, P.grassLight, P.grassDark);
      drawGrassTuft(ctx, 21, 19, tuftTip, P.grassLight, P.grassDark);
      drawGroundScatter(ctx, 11, 25, 0);
      drawGroundScatter(ctx, 25, 8, 1);
    } else if (v === 1) {
      drawGrassTuft(ctx, 8, 15, tuftTip, P.grassLight, P.grassDark);
      drawGrassTuft(ctx, 20, 6, P.grassLight, P.grassMid, P.grassDark);
      drawGroundScatter(ctx, 4, 26, 2);
      drawGroundScatter(ctx, 24, 24, 0);
    } else {
      drawGrassTuft(ctx, 22, 8, P.grassLight, P.grassMid, P.grassDark);
      drawGrassTuft(ctx, 6, 21, tuftTip, P.grassLight, P.grassDark);
      drawGroundScatter(ctx, 14, 14, 1);
      drawGroundScatter(ctx, 23, 25, 2);
      drawGroundScatter(ctx, 7, 9, 0);
    }
    sprites[`grass_${v}`] = canvas;
  }

  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.grassBase);
    drawGrassTuft(ctx, 14, 16, P.grassLight, P.grassMid, P.grassDark);
    drawGroundScatter(ctx, 6 + f, 8, 0);
    drawGroundScatter(ctx, 21 - f, 20, 1);
    if (isIsraelBiome) {
      // Iconic Israeli red anemone (Kalanit) & golden crown daisy wildflowers!
      draw32BitFlower(ctx, 23 + f, 7, "#ff4747", "#b81d24", "#24191c", "#4c6e32");
      draw32BitFlower(ctx, 7 - f, 22, "#ffe866", "#d4a626", "#a85a1c", "#4c6e32");
    } else {
      draw32BitFlower(ctx, 23 + f, 7, "#ffe975", "#d9892e", "#b82b22", "#576e28");
      draw32BitFlower(ctx, 7 - f, 22, "#fff5d6", "#d9b37c", "#e66717", "#576e28");
    }
    sprites[`grass_flower_${f}`] = canvas;
  }

  // Manicured Park Turf (mowed stripes + biome scatter)
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    const turf = v === 0 ? P.parkStripeLight : P.parkStripeDark;
    const accent = v === 0 ? P.parkHighlight : P.parkBase;
    const shade = v === 0 ? P.parkBase : P.parkShadow;
    px(ctx, 0, 0, 32, 32, turf);
    for (let y = 1; y < 31; y += 3) {
      for (let x = 1; x < 31; x += 4) {
        const r = h2(x, y, v + 31) % 7;
        if (r === 0) px(ctx, x, y, 2, 1, accent);
        else if (r === 1) px(ctx, x, y + 1, 2, 1, shade);
      }
    }
    drawGrassTuft(ctx, 7, 9, accent, turf, shade);
    drawGrassTuft(ctx, 22, 22, accent, turf, shade);
    if (v === 1 && hasFallenLeaves) drawFallenLeaf(ctx, 15, 16, 1);
    sprites[`park_${v}`] = canvas;
  }

  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.parkStripeLight);
    drawGrassTuft(ctx, 16, 14, P.parkHighlight, P.parkBase, P.parkShadow);
    draw32BitFlower(ctx, 7 + f, 9, "#ffee7a", "#d9a926", "#c96e1e", P.parkShadow);
    if (hasFallenLeaves) drawFallenLeaf(ctx, 21 - f, 21, 0);
    else draw32BitFlower(ctx, 21 - f, 21, isIsraelBiome ? "#ff5252" : "#ffffff", "#d9b37c", "#2b1c12", P.parkShadow);
    sprites[`park_flower_${f}`] = canvas;
  }

  // Haunted Mossy Graveyard Turf
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    const turf = v === 0 ? "#3f574d" : "#364d46";
    const hi = v === 0 ? "#567566" : "#4a665a";
    const dark = "#263833";
    px(ctx, 0, 0, 32, 32, turf);
    for (let y = 1; y < 31; y += 3) {
      for (let x = 1; x < 31; x += 3) {
        const r = h2(x, y, v + 77) % 11;
        if (r === 0) px(ctx, x, y, 2, 1, hi);
        else if (r === 1) px(ctx, x, y, 2, 1, dark);
      }
    }
    drawGrassTuft(ctx, 6, 8, hi, turf, dark);
    drawGrassTuft(ctx, 21, 22, hi, turf, dark);
    if (v === 1) drawFallenLeaf(ctx, 14, 12, 2);
    sprites[`grave_grass_${v}`] = canvas;
  }

  // Warm Packed Dirt Trails
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.dirtBase);
    for (let y = 0; y < 32; y += 2) {
      for (let x = 0; x < 32; x += 2) {
        const r = h2(x, y, v + 53) % 13;
        if (r === 0) px(ctx, x, y, 2, 1, P.dirtLight);
        else if (r === 1) px(ctx, x, y, 2, 1, P.dirtMid);
        else if (r === 2) px(ctx, x, y, 1, 1, P.dirtDark);
      }
    }
    px(ctx, 3, 5, 9, 3, P.dirtLight);
    px(ctx, 18, 19, 10, 3, P.dirtLight);
    px(ctx, 5, 22, 8, 3, P.dirtMid);
    if (v === 2) {
      px(ctx, 8, 10, 4, 3, P.dirtDark);
      px(ctx, 8, 9, 4, 2, P.dirtPebble);
      drawFallenLeaf(ctx, 22, 22, 0);
    }
    sprites[v === 2 ? "dirt_pebble" : `dirt_${v}`] = canvas;
  }

  // Sunlit Beach Sand
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.sandBase);
    for (let y = 0; y < 32; y += 2) {
      for (let x = 0; x < 32; x += 2) {
        const r = h2(x, y, v + 89) % 17;
        if (r === 0) px(ctx, x, y, 1, 1, P.sandSparkle);
        else if (r === 1) px(ctx, x, y, 2, 1, P.sandMid);
      }
    }
    px(ctx, 2, 6, 12, 2, P.sandLight);
    px(ctx, 4, 8, 10, 1, P.sandMid);
    px(ctx, 16, 20, 12, 2, P.sandLight);
    if (v === 2) {
      px(ctx, 10, 13, 5, 4, P.sandWet);
      px(ctx, 10, 12, 5, 3, "#f5d7c6");
      px(ctx, 11, 12, 3, 2, "#fff7f0");
    }
    sprites[v === 2 ? "sand_shell" : `sand_${v}`] = canvas;
  }

  // Autumn Tall Meadow Grass / Oakdale Woods (warm golden-russet swaying blades!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.tallGrassBase);
    const shift = f === 0 ? 0 : 1;
    for (const [cx, cy] of [
      [4, 9],
      [16, 7],
      [25, 13],
      [8, 22],
      [20, 24],
    ]) {
      px(ctx, cx - 1, cy + 4, 6, 2, "#4f3715");
      px(ctx, cx + shift, cy - 2, 2, 6, P.tallGrassMid);
      px(ctx, cx + shift, cy - 3, 1, 2, P.tallGrassTip);
      px(ctx, cx + 2, cy, 2, 5, "#8f6224");
      px(ctx, cx + 3 + shift, cy - 1, 2, 5, P.tallGrassMid);
      px(ctx, cx + 4 + shift, cy - 2, 1, 2, "#ffd066");
    }
    sprites[`tall_grass_${f}`] = canvas;
  }

  // =========================================================================
  // 2. REGIONAL SIDEWALKS (Cobblestone, Israeli Ackerman Pavers, Concrete), ASPHALT & WATER
  // =========================================================================
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    if (sidewalkStyle === "ackerman_limestone" || sidewalkStyle === "ackerman_gray") {
      // Iconic Israeli interlocking Ackerman concrete/limestone sidewalk pavers!
      const mortar = P.sidewalkMortar || "#948a78";
      px(ctx, 0, 0, 32, 32, mortar);
      const paverW = 8;
      const paverH = 4;
      for (let r = 0; r < 8; r++) {
        const y0 = r * paverH;
        const shift = (r % 2 === 1 ? 4 : 0) + v * 2;
        for (let c = -1; c <= 4; c++) {
          const sx = c * paverW + shift;
          const pick = h2(c + 12, r + 7, v + 501) % 3;
          const fill =
            pick === 0 ? P.sidewalkBase : pick === 1 ? P.sidewalkMid : P.sidewalkLight;
          px(ctx, sx + 1, y0 + 1, paverW - 1, paverH - 1, fill);
          px(ctx, sx + 1, y0 + 1, paverW - 2, 1, P.sidewalkLight);
          px(ctx, sx + 1, y0 + paverH - 1, paverW - 1, 1, P.sidewalkDark || mortar);
        }
      }
    } else if (sidewalkStyle === "concrete_slab") {
      // Clean scored municipal concrete sidewalk slabs
      px(ctx, 0, 0, 32, 32, P.sidewalkBase);
      for (let y = 0; y < 32; y += 2) {
        for (let x = 0; x < 32; x += 2) {
          const r = h2(x, y, v + 333) % 19;
          if (r === 0) px(ctx, x, y, 2, 1, P.sidewalkLight);
          else if (r === 1) px(ctx, x, y, 2, 1, P.sidewalkMid);
        }
      }
      px(ctx, 0, 15, 32, 1, P.sidewalkMortar);
      px(ctx, 0, 16, 32, 1, P.sidewalkLight);
      px(ctx, 15, 0, 1, 32, P.sidewalkMortar);
      px(ctx, 16, 0, 1, 32, P.sidewalkLight);
      px(ctx, 0, 31, 32, 1, P.sidewalkDark || P.sidewalkMortar);
    } else {
      // Warm mortar base + Staggered New England cobblestone pavers
      px(ctx, 0, 0, 32, 32, P.sidewalkMortar || "#5e4e50");
      const rowWidths = [
        [9, 7, 8, 8],
        [6, 10, 7, 9],
        [8, 8, 9, 7],
        [10, 6, 8, 8],
      ];
      for (let r = 0; r < 4; r++) {
        const y0 = r * 8;
        let x0 = (r % 2 === 1 ? 3 : 0) + v * 2;
        const widths = rowWidths[(r + v) % 4];
        for (let i = 0; i < widths.length + 1; i++) {
          const sw = widths[i % widths.length];
          const sx = (x0 % 32) - (i === 0 && x0 > 0 ? sw : 0);
          const shadePick = h2(sx + 10, y0, v + 400) % 3;
          const fill =
            shadePick === 0
              ? P.sidewalkBase
              : shadePick === 1
                ? P.sidewalkMid || "#948280"
                : "#b3a19d";
          px(ctx, sx + 1, y0 + 1, sw - 1, 7, fill);
          px(ctx, sx + 1, y0 + 1, sw - 2, 1, P.sidewalkLight);
          px(ctx, sx + 1, y0 + 2, 1, 5, P.sidewalkLight);
          px(ctx, sx + 2, y0 + 7, sw - 2, 1, P.sidewalkDark || "#786666");
          x0 += sw;
        }
      }
      if (hasFallenLeaves) {
        if (v === 0) drawFallenLeaf(ctx, 21, 11, 0);
        else drawFallenLeaf(ctx, 7, 23, 1);
      }
    }
    sprites[`sidewalk_${v}`] = canvas;
  }

  // Ultra-clean 32-bit Slate/Charcoal Asphalt Roads (minimal subtle grain so lane markings pop crisply!)
  const buildAsphaltTile = (baseCol, lightCol, darkCol, seed) => {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, baseCol);
    for (let y = 0; y < 32; y += 2) {
      for (let x = 0; x < 32; x += 2) {
        const r = h2(x, y, seed) % 29;
        if (r === 0) px(ctx, x, y, 1, 1, lightCol);
        else if (r === 1) px(ctx, x, y, 1, 1, darkCol);
      }
    }
    return canvas;
  };
  sprites.road_res_base_0 = buildAsphaltTile(P.roadRes, P.roadResLight, P.roadResDark, 201);
  sprites.road_res_base_1 = buildAsphaltTile(P.roadRes, P.roadResLight, P.roadResDark, 202);
  sprites.road_res_base = sprites.road_res_base_0;
  sprites.road_main_base = buildAsphaltTile(P.roadMain, P.roadMainLight, P.roadMainDark, 203);
  sprites.highway_base_0 = buildAsphaltTile(P.highway || P.highwayBase, P.highwayLight || P.highwayTrack, P.highwayDark, 204);
  sprites.highway_base_1 = buildAsphaltTile(P.highway || P.highwayBase, P.highwayLight || P.highwayTrack, P.highwayDark, 205);

  for (let v = 0; v < 2; v++) {
    const canvas = buildAsphaltTile(P.parkingBase || P.roadMain, P.parkingLight || P.roadMainLight, P.parkingDark || P.roadMainDark, 210 + v);
    const ctx = canvas.getContext("2d");
    px(ctx, 0, 0, 32, 1, P.parkingDark || P.roadMainDark);
    if (v === 0) {
      px(ctx, 30, 3, 2, 26, "#e8ecf2");
      px(ctx, 30, 3, 1, 26, "#ffffff");
    }
    sprites[`parking_${v}`] = canvas;
  }

  // Crisp High-Visibility White Zebra Crosswalks
  {
    const canvas = buildAsphaltTile(P.roadMain, P.roadMainLight, P.roadMainDark, 220);
    const ctx = canvas.getContext("2d");
    for (let y = 2; y < 30; y += 7) {
      px(ctx, 2, y, 28, 4, "#f4f7fa");
      px(ctx, 2, y, 28, 1, "#ffffff");
      px(ctx, 2, y + 3, 28, 1, "#c2cad6");
    }
    sprites.crosswalk_h = canvas;
  }
  {
    const canvas = buildAsphaltTile(P.roadMain, P.roadMainLight, P.roadMainDark, 221);
    const ctx = canvas.getContext("2d");
    for (let x = 2; x < 30; x += 7) {
      px(ctx, x, 2, 4, 28, "#f4f7fa");
      px(ctx, x, 2, 1, 28, "#ffffff");
      px(ctx, x + 3, 2, 1, 28, "#c2cad6");
    }
    sprites.crosswalk_v = canvas;
  }

  // Clean Concrete Highway Jersey Median Barriers with Crisp Yellow Edge Lines Flanking Both Sides!
  {
    const canvas = buildAsphaltTile(P.highway || P.highwayBase, P.highwayLight || P.highwayTrack, P.highwayDark, 225);
    const ctx = canvas.getContext("2d");
    // Crisp yellow highway median edge lines flanking both carriageways
    px(ctx, 0, 2, 32, 2, "#f5c53b");
    px(ctx, 0, 28, 32, 2, "#f5c53b");
    // 3D Concrete Jersey Barrier
    px(ctx, 0, 7, 32, 18, "#222630");
    px(ctx, 0, 8, 32, 3, "#edf1f5");
    px(ctx, 0, 11, 32, 7, "#c3cbd6");
    px(ctx, 0, 18, 32, 4, "#8e97a6");
    px(ctx, 0, 22, 32, 2, "#5b6370");
    for (const jx of [10, 22]) {
      px(ctx, jx, 8, 1, 14, "#6f7785");
      px(ctx, jx + 1, 8, 1, 14, "#f5f8fc");
    }
    px(ctx, 14, 10, 4, 2, "#f5c53b");
    px(ctx, 15, 10, 2, 1, "#fff6b8");
    sprites.highway_median_h = canvas;
  }
  {
    const canvas = buildAsphaltTile(P.highway || P.highwayBase, P.highwayLight || P.highwayTrack, P.highwayDark, 226);
    const ctx = canvas.getContext("2d");
    // Crisp yellow highway median edge lines flanking both carriageways
    px(ctx, 2, 0, 2, 32, "#f5c53b");
    px(ctx, 28, 0, 2, 32, "#f5c53b");
    // 3D Concrete Jersey Barrier
    px(ctx, 7, 0, 18, 32, "#222630");
    px(ctx, 8, 0, 3, 32, "#edf1f5");
    px(ctx, 11, 0, 7, 32, "#c3cbd6");
    px(ctx, 18, 0, 4, 32, "#8e97a6");
    px(ctx, 22, 0, 2, 32, "#5b6370");
    for (const jy of [10, 22]) {
      px(ctx, 8, jy, 14, 1, "#6f7785");
      px(ctx, 8, jy + 1, 14, 1, "#f5f8fc");
    }
    px(ctx, 10, 14, 2, 4, "#f5c53b");
    px(ctx, 10, 15, 1, 2, "#fff6b8");
    sprites.highway_median_v = canvas;
  }

  // Golden-Hour Shimmering Water (warm amber sun sparkles on deep blue water!)
  for (let f = 0; f < 2; f++) {
    const off = f * 4;
    for (const [key, baseC, midC, hiC, sparkC] of [
      [`water_deep_${f}`, P.waterDeep, P.waterMid, "#5a91bd", "#ffdf9e"],
      [`water_${f}`, P.waterBase || P.waterMid, P.waterMid, P.waterLight, "#ffecc2"],
      [`water_shallow_${f}`, P.waterShallow, P.waterShallowLight, "#b8dfeb", "#fff7db"],
    ]) {
      const { canvas, ctx } = makeHdCanvas(32, 32);
      px(ctx, 0, 0, 32, 32, baseC);
      for (let wy = 4; wy < 30; wy += 8) {
        const sx = (wy * 3 + off) % 24;
        px(ctx, sx, wy, 9, 2, midC);
        px(ctx, sx + 1, wy, 6, 1, hiC);
        px(ctx, sx + 2, wy, 2, 1, sparkC);
        const sx2 = (sx + 16) % 26;
        px(ctx, sx2, wy + 4, 7, 2, midC);
        px(ctx, sx2 + 1, wy + 4, 4, 1, hiC);
      }
      sprites[key] = canvas;
    }
  }

  // =========================================================================
  // 3. 32-BIT REGIONAL TREES (New England Autumn, Jerusalem Olive/Pine/Cypress,
  //    Tel Aviv Palms/Jacaranda, Galilee, Desert Oasis & Temperate Summer!)
  // =========================================================================
  if (treeStyle === "jerusalem_hills") {
    sprites.tree_oak_0 = bakeOliveTree(11);
    sprites.tree_oak_1 = bakeJerusalemPineTree(23);
    sprites.tree_oak_2 = bakeFloweringTree(
      {
        outline: "#3b1729",
        deep: "#7a244f",
        mid: "#c43b7d",
        light: "#eb6aa8",
        crown: "#ffa6d0",
        speck: "#ffe3f0",
      },
      37
    );
    sprites.tree_oak = sprites.tree_oak_0;
    sprites.tree_pine = bakePencilCypressTree(41);
  } else if (treeStyle === "coastal_palms") {
    sprites.tree_oak_0 = bakeDatePalmTree(11);
    sprites.tree_oak_1 = bakeAutumnOakTree(
      {
        outline: "#132919",
        deep: "#22522d",
        mid: "#397a3e",
        light: "#5da652",
        crown: "#8fd46a",
        speck: "#c7f099",
      },
      23
    );
    sprites.tree_oak_2 = bakeFloweringTree(
      {
        outline: "#271b45",
        deep: "#553b94",
        mid: "#7d5ec9",
        light: "#a689ed",
        crown: "#cdb8ff",
        speck: "#eee6ff",
      },
      37
    );
    sprites.tree_oak = sprites.tree_oak_0;
    sprites.tree_pine = bakeDatePalmTree(44);
  } else if (treeStyle === "galilee_olive") {
    sprites.tree_oak_0 = bakeOliveTree(17);
    sprites.tree_oak_1 = bakeAutumnOakTree(
      {
        outline: "#152b18",
        deep: "#245429",
        mid: "#3d7d39",
        light: "#62a64c",
        crown: "#92cf6b",
        speck: "#c8f09c",
      },
      29
    );
    sprites.tree_oak_2 = bakeFloweringTree(
      {
        outline: "#3b232b",
        deep: "#8c4a62",
        mid: "#cf7a96",
        light: "#f2aec4",
        crown: "#ffd9e6",
        speck: "#fff5f8",
      },
      43
    );
    sprites.tree_oak = sprites.tree_oak_0;
    sprites.tree_pine = bakePencilCypressTree(51);
  } else if (treeStyle === "desert_oasis") {
    sprites.tree_oak_0 = bakeDatePalmTree(13);
    sprites.tree_oak_1 = bakeDesertAcaciaTree(27);
    sprites.tree_oak_2 = bakeOliveTree(39);
    sprites.tree_oak = sprites.tree_oak_0;
    sprites.tree_pine = bakeDatePalmTree(52);
  } else if (treeStyle === "winter_snow") {
    sprites.tree_oak_0 = bakeWinterBareOak(13);
    sprites.tree_oak_1 = bakeWinterSnowPine(23, false);
    sprites.tree_oak_2 = bakeWinterBareOak(37);
    sprites.tree_oak = sprites.tree_oak_0;
    sprites.tree_pine = bakeWinterSnowPine(41, false);
  } else if (treeStyle === "tundra_spruce") {
    sprites.tree_oak_0 = bakeWinterSnowPine(17, true);
    sprites.tree_oak_1 = bakeWinterSnowPine(29, false);
    sprites.tree_oak_2 = bakeWinterBareOak(43);
    sprites.tree_oak = sprites.tree_oak_0;
    sprites.tree_pine = bakeWinterSnowPine(53, true);
  } else if (treeStyle === "alpine_conifer") {
    sprites.tree_oak_0 = bakeAutumnOakTree(
      {
        outline: "#13291b",
        deep: "#1f4f32",
        mid: "#33754a",
        light: "#559e66",
        crown: "#86cc8e",
        speck: "#b8ebb8",
      },
      19
    );
    sprites.tree_oak_1 = bakeJerusalemPineTree(31);
    sprites.tree_oak_2 = bakeAutumnOakTree(
      {
        outline: "#1a2e1c",
        deep: "#2e5e32",
        mid: "#4a8748",
        light: "#78b865",
        crown: "#a8de8a",
        speck: "#d9f7bd",
      },
      47
    );
    sprites.tree_oak = sprites.tree_oak_0;
  } else if (treeStyle === "spring_blossom") {
    // Lush Spring Cherry Blossom (Sakura), White Almond Blossom & Fresh Spring Maple!
    sprites.tree_oak_0 = bakeFloweringTree(
      {
        outline: "#421e31",
        deep: "#b55780",
        mid: "#f08eb8",
        light: "#ffb8d8",
        crown: "#ffe0ee",
        speck: "#ffffff",
      },
      11
    );
    sprites.tree_oak_1 = bakeAutumnOakTree(
      {
        outline: "#162e19",
        deep: "#2a6331",
        mid: "#489948",
        light: "#76c963",
        crown: "#acf08b",
        speck: "#e0ffbd",
      },
      23
    );
    sprites.tree_oak_2 = bakeFloweringTree(
      {
        outline: "#3b2c36",
        deep: "#baa8b5",
        mid: "#e8dce4",
        light: "#f7f0f5",
        crown: "#ffffff",
        speck: "#ffd6e8",
      },
      37
    );
    sprites.tree_oak = sprites.tree_oak_0;
  } else if (treeStyle === "temperate_summer") {
    sprites.tree_oak_0 = bakeAutumnOakTree(
      {
        outline: "#142917",
        deep: "#225228",
        mid: "#3b7f38",
        light: "#62ad48",
        crown: "#92d466",
        speck: "#c8f294",
      },
      11
    );
    sprites.tree_oak_1 = bakeAutumnOakTree(
      {
        outline: "#172e19",
        deep: "#2a5e2d",
        mid: "#468f3d",
        light: "#71bd50",
        crown: "#a3e06e",
        speck: "#d5f7a1",
      },
      23
    );
    sprites.tree_oak_2 = bakeAutumnOakTree(
      {
        outline: "#1a2914",
        deep: "#345922",
        mid: "#528232",
        light: "#7db046",
        crown: "#aed463",
        speck: "#dbf099",
      },
      37
    );
    sprites.tree_oak = sprites.tree_oak_1;
  } else {
    sprites.tree_oak_0 = bakeAutumnOakTree(
      {
        outline: "#3b0c12",
        deep: "#781720",
        mid: "#b52824",
        light: "#e3502b",
        crown: "#ff8c42",
        speck: "#ffd275",
      },
      11
    );
    sprites.tree_oak_1 = bakeAutumnOakTree(
      {
        outline: "#451e0c",
        deep: "#963b14",
        mid: "#d4701e",
        light: "#f5a731",
        crown: "#ffe066",
        speck: "#fff5b8",
      },
      23
    );
    sprites.tree_oak_2 = bakeAutumnOakTree(
      {
        outline: "#3d1210",
        deep: "#872318",
        mid: "#c9451e",
        light: "#f07629",
        crown: "#ffba47",
        speck: "#ffe68c",
      },
      37
    );
    sprites.tree_oak = sprites.tree_oak_1;
  }

  // Deep Olive Evergreen Pine (for New England, Temperate, Spring & Alpine; Winter/Tundra/Israel/Desert already set custom trees!)
  if (
    !sprites.tree_pine ||
    treeStyle === "autumn_new_england" ||
    treeStyle === "temperate_summer" ||
    treeStyle === "spring_blossom" ||
    treeStyle === "alpine_conifer"
  ) {
    const { canvas, ctx } = makeHdCanvas(44, 60);
    const O = "#162417";
    ditherShadowEllipse(ctx, 22, 54, 15, 4.5);
    px(ctx, 18, 43, 8, 12, "#29160e");
    px(ctx, 19, 44, 6, 10, "#693e24");
    px(ctx, 20, 44, 2, 10, "#8f5936");

    const tiers = [
      { yTop: 28, h: 19, wBot: 36, wTop: 14 },
      { yTop: 19, h: 16, wBot: 30, wTop: 10 },
      { yTop: 11, h: 14, wBot: 22, wTop: 6 },
      { yTop: 3, h: 12, wBot: 14, wTop: 2 },
    ];
    for (const t of tiers) {
      for (let r = 0; r < t.h; r++) {
        const frac = r / Math.max(1, t.h - 1);
        const w = Math.round(t.wTop + (t.wBot - t.wTop) * frac);
        const x0 = Math.round(22 - w / 2);
        const y = t.yTop + r;
        px(ctx, x0 - 1, y, w + 2, 1, O);
        px(ctx, x0, y, w, 1, r > t.h - 4 ? P.pineDark : P.pineMid);
        const hiW = Math.max(1, Math.floor(w * 0.48));
        if (r < t.h - 3) {
          px(ctx, x0 + 1, y, hiW, 1, P.pineLight);
          if (r < t.h * 0.55) px(ctx, x0 + 2, y, Math.max(1, Math.floor(hiW * 0.55)), 1, P.pineHighlight);
        }
        if (r === t.h - 1) {
          for (let sx = x0 + 1; sx < x0 + w - 1; sx += 4) {
            px(ctx, sx, y + 1, 2, 2, O);
            px(ctx, sx, y + 1, 1, 1, P.pineDark);
          }
        }
      }
    }
    sprites.tree_pine = canvas;
  }

  // =========================================================================
  // 4. CRUNCHY AUTUMN LEAF PILES, GARDEN BOXWOOD SHRUBS & VINTAGE STREET LAMPS
  // =========================================================================
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeHdCanvas(36, 26);
    const O = "#361210";
    ditherShadowEllipse(ctx, 18, 20, 14, 4.5);
    // Mound silhouette
    pxEllipse(ctx, 18, 16, 12.5, 7.5, O);
    pxEllipse(ctx, 11, 18, 7.5, 5.2, O);
    pxEllipse(ctx, 25, 18, 7.5, 5.2, O);
    pxEllipse(ctx, 18, 11, 7.5, 5.5, O);
    // Deep crimson base -> tangerine mid -> bright golden crown leaves!
    pxEllipse(ctx, 18, 16.5, 11, 6.2, "#8c1e1a");
    pxEllipse(ctx, 11, 18, 6.2, 4, "#a8281c");
    pxEllipse(ctx, 25, 18, 6.2, 4, "#9e231a");
    pxEllipse(ctx, 18, 13.5, 9, 5.2, "#d9501e");
    pxEllipse(ctx, 15, 14, 5.5, 3.8, "#f08526");
    pxEllipse(ctx, 21, 12, 5, 3.5, "#f5a731");
    pxEllipse(ctx, 17, 10, 4, 2.5, "#ffcf4d");
    // Individual crisp ruffled leaf pixels + stray leaves around pile!
    for (let i = 0; i < 24; i++) {
      const lx = 7 + (h2(i, 1, v + 91) % 22);
      const ly = 8 + (h2(i, 2, v + 91) % 12);
      px(ctx, lx, ly, 2, 1, i % 3 === 0 ? "#ffe375" : i % 3 === 1 ? "#b8241d" : "#f58429");
    }
    drawFallenLeaf(ctx, 3, 21, v);
    drawFallenLeaf(ctx, 30, 20, v + 1);
    sprites[`leaf_pile_${v}`] = canvas;
  }

  // Regional Garden Shrub (Boxwood, Israeli Magenta Bougainvillea, or Desert Rosemary/Sage!)
  {
    const { canvas, ctx } = makeHdCanvas(24, 22);
    ditherShadowEllipse(ctx, 12, 18, 9, 3);
    if (shrubStyle === "bougainvillea") {
      pxEllipse(ctx, 12, 12, 9.5, 7.5, "#1f2e18");
      pxEllipse(ctx, 12, 12.5, 8.2, 6.2, "#395929");
      pxEllipse(ctx, 11.5, 11, 6.8, 5, "#59823c");
      // Lush cascading magenta bougainvillea blossoms!
      pxEllipse(ctx, 8, 9, 3.8, 3, "#a81d66");
      pxEllipse(ctx, 8, 8.5, 2.8, 2.2, "#e83b8f");
      px(ctx, 7, 7, 2, 2, "#ff8cc4");
      pxEllipse(ctx, 15, 10, 3.6, 2.8, "#a81d66");
      pxEllipse(ctx, 15, 9.5, 2.5, 2, "#e83b8f");
      px(ctx, 14, 8, 2, 1, "#ff99cc");
      pxEllipse(ctx, 11.5, 13, 3, 2.2, "#d92b7c");
      px(ctx, 11, 12, 2, 1, "#ff80bd");
    } else if (shrubStyle === "desert_sage") {
      pxEllipse(ctx, 12, 12, 9.5, 7, "#293324");
      pxEllipse(ctx, 12, 12.5, 8.2, 5.8, "#5c6e4d");
      pxEllipse(ctx, 11.5, 11, 6.5, 4.5, "#82966e");
      pxEllipse(ctx, 10, 9.5, 4, 2.8, "#a8bd91");
      px(ctx, 14, 9, 2, 2, "#b68ce8");
      px(ctx, 8, 11, 2, 2, "#b68ce8");
    } else {
      pxEllipse(ctx, 12, 12, 9.5, 7.5, "#192914");
      pxEllipse(ctx, 12, 12.5, 8.2, 6.2, "#2f4f22");
      pxEllipse(ctx, 11.5, 11, 6.8, 5, "#4c7830");
      pxEllipse(ctx, 10, 9.5, 4.8, 3.2, "#73a340");
      pxEllipse(ctx, 9, 8.5, 2.5, 1.8, "#a2cc58");
    }
    sprites.garden_shrub = canvas;
  }

  // Vintage Curved-Arm Street Lamp with Warm Golden Lantern Glow!
  {
    const { canvas, ctx } = makeHdCanvas(34, 54);
    const O = "#1d1a21";
    // Soft warm golden light pool on ground beneath lantern
    pxEllipse(ctx, 24, 46, 9, 4.5, "rgba(255, 198, 86, 0.22)");
    pxEllipse(ctx, 24, 46, 5, 2.5, "rgba(255, 228, 138, 0.22)");
    ditherShadowEllipse(ctx, 10, 48, 5, 2);
    // Cast-iron fluted pole + pedestal base
    px(ctx, 7, 44, 6, 6, O);
    px(ctx, 8, 45, 4, 4, "#575563");
    px(ctx, 8, 9, 4, 36, O);
    px(ctx, 9, 10, 2, 34, "#757382");
    px(ctx, 9, 10, 1, 34, "#a6a4b5");
    // Curved overhanging iron arm
    px(ctx, 9, 6, 15, 3, O);
    px(ctx, 10, 7, 13, 1, "#9a98a8");
    px(ctx, 22, 7, 3, 5, O);
    // Glowing golden lantern halo + lamp housing!
    pxEllipse(ctx, 23, 16, 9, 8, "rgba(255, 190, 74, 0.26)");
    pxEllipse(ctx, 23, 16, 5.5, 5, "rgba(255, 226, 128, 0.36)");
    px(ctx, 20, 11, 7, 8, O);
    px(ctx, 21, 12, 5, 6, "#ffcf54");
    px(ctx, 22, 13, 3, 4, "#fff6c2");
    px(ctx, 23, 14, 1, 2, "#ffffff");
    px(ctx, 19, 11, 9, 2, O);
    px(ctx, 20, 11, 7, 1, "#575563");
    sprites.street_lamp = canvas;
  }

  // =========================================================================
  // 5. 32-BIT STREET SIGNS, LANDMARK SIGNPOSTS, HYDRANTS, BENCHES, CARS & CHESTS
  // =========================================================================
  for (const checked of [false, true]) {
    const { canvas, ctx } = makeHdCanvas(24, 36);
    const O = "#1d1716";
    ditherShadowEllipse(ctx, 12, 32, 5.5, 2);
    px(ctx, 10, 7, 4, 26, O);
    px(ctx, 11, 8, 2, 24, "#9c9494");
    px(ctx, 11, 8, 1, 24, "#e6dcd8");
    px(ctx, 9, 30, 6, 3, O);
    px(ctx, 10, 31, 4, 1, "#c4b7b2");

    if (checked) {
      px(ctx, 9, 0, 6, 6, "#2b1c12");
      px(ctx, 10, 1, 4, 4, "#e6b84c");
      px(ctx, 11, 1, 2, 3, "#fff4ad");
      px(ctx, 11, 2, 1, 1, "#ffffff");
    } else {
      px(ctx, 10, 4, 4, 3, O);
      px(ctx, 11, 5, 2, 1, "#dfd3ce");
    }

    const b1Y = checked ? 5 : 4;
    if (streetSignStyle === "jerusalem_stone") {
      // Iconic Jerusalem white enamel street plaque with royal-blue border & carved Jerusalem stone frame!
      px(ctx, 1, b1Y, 22, 14, O);
      px(ctx, 2, b1Y + 1, 20, 12, "#e8d8b5"); // Jerusalem limestone frame
      px(ctx, 3, b1Y + 2, 18, 10, checked ? "#1c57a8" : "#164385"); // royal blue border
      px(ctx, 4, b1Y + 3, 16, 8, "#fcfaf5"); // crisp white enamel center
      // Top Hebrew script bar + bottom English script bar in Jerusalem royal blue!
      px(ctx, 6, b1Y + 4, 12, 2, checked ? "#1d5ec4" : "#164385");
      px(ctx, 7, b1Y + 8, 10, 2, "#3a78c9");
    } else if (streetSignStyle === "israel_blue") {
      // Classic Israeli blue-and-white municipal street sign blades
      px(ctx, 0, b1Y, 24, 8, O);
      px(ctx, 1, b1Y + 1, 22, 6, "#ffffff");
      px(ctx, 2, b1Y + 2, 20, 4, checked ? "#1f6ad4" : "#184f9e");
      px(ctx, 2, b1Y + 2, 20, 1, checked ? "#3d88f0" : "#2969c2");
      px(ctx, 4, b1Y + 3, 5, 2, "#ffffff");
      px(ctx, 10, b1Y + 3, 4, 2, "#ffffff");
      px(ctx, 15, b1Y + 3, 5, 2, "#eef5ff");

      const b2Y = b1Y + 8;
      px(ctx, 3, b2Y, 20, 8, O);
      px(ctx, 4, b2Y + 1, 18, 6, checked ? "#fff0ad" : "#ffffff");
      px(ctx, 5, b2Y + 2, 16, 4, checked ? "#1859b8" : "#144285");
      px(ctx, 7, b2Y + 3, 6, 2, "#ffffff");
      px(ctx, 14, b2Y + 3, 5, 2, "#eef5ff");
    } else {
      px(ctx, 0, b1Y, 24, 8, O);
      px(ctx, 1, b1Y + 1, 22, 6, "#f7f0e6");
      px(ctx, 2, b1Y + 2, 20, 4, checked ? "#248f59" : "#1d7347");
      px(ctx, 2, b1Y + 2, 20, 1, checked ? "#34ad6f" : "#288c59");
      px(ctx, 4, b1Y + 3, 5, 2, "#ffffff");
      px(ctx, 10, b1Y + 3, 4, 2, "#ffffff");
      px(ctx, 15, b1Y + 3, 5, 2, "#f0f7ee");

      const b2Y = b1Y + 8;
      px(ctx, 3, b2Y, 20, 8, O);
      px(ctx, 4, b2Y + 1, 18, 6, checked ? "#fff0ad" : "#efe6da");
      px(ctx, 5, b2Y + 2, 16, 4, checked ? "#1c7548" : "#165c38");
      px(ctx, 7, b2Y + 3, 6, 2, "#ffffff");
      px(ctx, 14, b2Y + 3, 5, 2, "#f0f7ee");
    }

    sprites[checked ? "street_sign_checked" : "street_sign"] = canvas;
  }

  {
    const { canvas, ctx } = makeHdCanvas(22, 22);
    const O = "#241712";
    px(ctx, 3, 1, 16, 15, O);
    px(ctx, 1, 3, 20, 11, O);
    px(ctx, 8, 16, 6, 3, O);
    px(ctx, 10, 19, 2, 2, O);
    px(ctx, 3, 2, 16, 13, "#e6a84c");
    px(ctx, 2, 3, 18, 11, "#f7dc8e");
    px(ctx, 4, 4, 14, 9, "#1c6b42");
    px(ctx, 4, 4, 14, 2, "#298a57");
    px(ctx, 8, 5, 6, 2, "#ffffff");
    px(ctx, 12, 7, 2, 2, "#ffffff");
    px(ctx, 10, 8, 2, 2, "#ffffff");
    px(ctx, 10, 11, 2, 2, "#fff5ba");
    sprites.street_sign_prompt = canvas;
  }

  {
    const { canvas, ctx } = makeHdCanvas(28, 36);
    const O = "#241712";
    ditherShadowEllipse(ctx, 14, 32, 8, 2.5);
    px(ctx, 11, 18, 6, 15, O);
    px(ctx, 12, 19, 4, 13, "#8c522b");
    px(ctx, 12, 19, 2, 13, "#bf7c47");
    px(ctx, 15, 19, 1, 13, "#593118");
    px(ctx, 1, 2, 26, 18, O);
    px(ctx, 2, 3, 24, 16, "#b87832");
    px(ctx, 3, 4, 22, 14, "#f2c672");
    px(ctx, 5, 6, 18, 10, "#9c5e2c");
    px(ctx, 5, 6, 18, 2, "#c48041");
    px(ctx, 13, 7, 2, 8, "#ffe875");
    px(ctx, 10, 10, 8, 2, "#ffe875");
    px(ctx, 11, 9, 6, 4, "#f4d35e");
    px(ctx, 13, 9, 2, 2, "#ffffff");
    sprites.landmark_sign = canvas;
  }

  {
    const { canvas, ctx } = makeHdCanvas(20, 28);
    const O = "#241414";
    ditherShadowEllipse(ctx, 10, 24, 6.5, 2.2);
    px(ctx, 5, 6, 10, 19, O);
    px(ctx, 2, 10, 16, 6, O);
    px(ctx, 6, 3, 8, 4, O);
    px(ctx, 6, 7, 8, 17, "#c92e2a");
    px(ctx, 7, 7, 3, 16, "#f2584e");
    px(ctx, 8, 8, 1, 14, "#ff998f");
    px(ctx, 12, 7, 2, 17, "#8a1b19");
    px(ctx, 7, 4, 6, 3, "#e3423b");
    px(ctx, 8, 4, 3, 2, "#ff877d");
    px(ctx, 9, 2, 2, 2, "#e0b54c");
    px(ctx, 3, 11, 3, 4, "#c99a38");
    px(ctx, 3, 11, 2, 2, "#ffe085");
    px(ctx, 14, 11, 3, 4, "#c99a38");
    px(ctx, 14, 11, 2, 2, "#ffe085");
    px(ctx, 5, 22, 10, 3, "#8a1b19");
    px(ctx, 6, 22, 8, 1, "#eb5249");
    sprites.prop_hydrant = canvas;
  }

  {
    const { canvas, ctx } = makeHdCanvas(32, 24);
    const O = "#241712";
    ditherShadowEllipse(ctx, 16, 20, 14, 3);
    px(ctx, 4, 7, 3, 15, O);
    px(ctx, 25, 7, 3, 15, O);
    px(ctx, 5, 8, 1, 13, "#544c54");
    px(ctx, 26, 8, 1, 13, "#544c54");
    for (const [sy, h, hi, mid, sh] of [
      [4, 4, "#e0a263", "#b06e35", "#75431c"],
      [9, 4, "#e0a263", "#b06e35", "#75431c"],
      [14, 4, "#ebae70", "#bd793e", "#7d481f"],
    ]) {
      px(ctx, 2, sy - 1, 28, h + 2, O);
      px(ctx, 3, sy, 26, h, mid);
      px(ctx, 3, sy, 26, 1, hi);
      px(ctx, 3, sy + h - 1, 26, 1, sh);
    }
    sprites.park_bench = canvas;
  }

  for (const car of [
    { name: "car_red", hi: "#ff7a6b", mid: "#d93b32", sh: "#961e1a", dark: "#5c1111" },
    { name: "car_sage", hi: "#9ad4a8", mid: "#5c9e70", sh: "#396e4b", dark: "#22452f" },
    { name: "car_blue", hi: "#7db9f5", mid: "#3d7cc7", sh: "#24508a", dark: "#163259" },
  ]) {
    const { canvas, ctx } = makeHdCanvas(28, 36);
    const O = "#1c1618";
    ditherShadowEllipse(ctx, 14, 31, 12, 4);
    px(ctx, 2, 7, 3, 7, O);
    px(ctx, 23, 7, 3, 7, O);
    px(ctx, 2, 22, 3, 7, O);
    px(ctx, 23, 22, 3, 7, O);
    px(ctx, 1, 12, 3, 3, O);
    px(ctx, 24, 12, 3, 3, O);
    px(ctx, 2, 13, 2, 1, car.hi);
    px(ctx, 24, 13, 2, 1, car.hi);
    px(ctx, 4, 2, 20, 32, O);
    px(ctx, 5, 3, 18, 30, car.mid);
    px(ctx, 6, 4, 16, 27, car.mid);
    px(ctx, 6, 4, 6, 26, car.hi);
    px(ctx, 19, 4, 3, 27, car.sh);
    px(ctx, 7, 13, 14, 11, car.dark);
    px(ctx, 8, 14, 12, 9, car.hi);
    px(ctx, 9, 15, 7, 6, "#fff7e8");
    px(ctx, 9, 16, 10, 6, car.mid);
    px(ctx, 7, 9, 14, 5, "#26202e");
    px(ctx, 8, 10, 12, 3, "#547ca6");
    px(ctx, 9, 10, 4, 2, "#ffe6b8");
    px(ctx, 8, 24, 12, 4, "#26202e");
    px(ctx, 9, 25, 10, 2, "#426387");
    px(ctx, 6, 3, 4, 2, "#fff29e");
    px(ctx, 18, 3, 4, 2, "#fff29e");
    px(ctx, 6, 31, 4, 2, "#ff4d4d");
    px(ctx, 18, 31, 4, 2, "#ff4d4d");
    px(ctx, 10, 2, 8, 1, "#e6dad0");
    px(ctx, 10, 32, 8, 1, "#c4b6ad");
    sprites[car.name] = canvas;
  }

  for (const open of [false, true]) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    const O = "#24160e";
    ditherShadowEllipse(ctx, 16, 26, 13, 3.5);
    const topY = open ? 5 : 9;
    const h = open ? 23 : 19;
    px(ctx, 3, topY, 26, h, O);
    px(ctx, 4, topY + 1, 24, h - 2, "#8c542c");
    px(ctx, 5, topY + 1, 22, 3, "#c48047");
    for (let py = topY + 5; py < topY + h - 2; py += 4) {
      px(ctx, 5, py, 22, 1, "#63381b");
    }
    if (open) {
      px(ctx, 5, topY + 2, 22, 8, "#2b1c12");
      px(ctx, 6, topY + 4, 4, 6, "#eb5e55");
      px(ctx, 7, topY + 5, 2, 4, "#ff998f");
      px(ctx, 11, topY + 3, 4, 7, "#52b788");
      px(ctx, 12, topY + 4, 2, 5, "#95e6ba");
      px(ctx, 16, topY + 4, 5, 6, "#f4d35e");
      px(ctx, 17, topY + 5, 3, 4, "#fff4b3");
      px(ctx, 22, topY + 3, 4, 7, "#5c94eb");
    }
    px(ctx, 4, 17, 24, 2, "#d9a432");
    px(ctx, 4, 17, 24, 1, "#ffe885");
    px(ctx, 13, 15, 6, 6, O);
    px(ctx, 14, 16, 4, 4, "#f4d35e");
    px(ctx, 15, 17, 2, 2, "#382610");
    sprites[open ? "chest_open" : "chest_closed"] = canvas;
  }

  {
    const { canvas, ctx } = makeHdCanvas(24, 32);
    px(ctx, 6, 12, 2, 18, "#4c6b2c");
    px(ctx, 11, 8, 2, 22, "#6a8a38");
    px(ctx, 16, 14, 2, 16, "#4c6b2c");
    px(ctx, 3, 16, 3, 2, "#8eb048");
    px(ctx, 17, 18, 4, 2, "#8eb048");
    px(ctx, 10, 6, 4, 7, "#3b2012");
    px(ctx, 11, 7, 2, 5, "#78462a");
    px(ctx, 11, 7, 1, 3, "#a86a42");
    px(ctx, 5, 11, 4, 6, "#3b2012");
    px(ctx, 6, 12, 2, 4, "#78462a");
    sprites.shore_reed = canvas;
  }

  // =========================================================================
  // 6. 2x HD 32-BIT INTERACTION RINGS, HALOS, EMOTES & PARTICLE VFX SPRITES
  // =========================================================================
  const drawRingEllipse = (ctx, cx, cy, rx, ry, fillCss, ringCss, innerCss = null) => {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = Math.hypot(dx, dy);
        if (d <= 1.0 && d >= 0.78) {
          ctx.fillStyle = ringCss;
          ctx.fillRect(x, y, 1, 1);
        } else if (innerCss && d < 0.78 && d >= 0.64 && (x + y) % 2 === 0) {
          ctx.fillStyle = innerCss;
          ctx.fillRect(x, y, 1, 1);
        } else if (fillCss && d < 0.78) {
          ctx.fillStyle = fillCss;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  };

  // Elliptical glowing ground interaction rings (gold for NPC/sign, emerald for snack/feed, mint for Safe Crossing!)
  for (let f = 0; f < 2; f++) {
    const rx = f === 0 ? 18 : 20;
    const ry = f === 0 ? 8 : 9;
    {
      const { canvas, ctx } = makeHdCanvas(44, 22);
      drawRingEllipse(ctx, 22, 11, rx, ry, "rgba(244, 211, 94, 0.24)", "rgba(255, 240, 148, 0.92)", "rgba(255, 255, 220, 0.65)");
      sprites[`fx_ring_gold_${f}`] = canvas;
    }
    {
      const { canvas, ctx } = makeHdCanvas(44, 22);
      drawRingEllipse(ctx, 22, 11, rx, ry, "rgba(114, 232, 156, 0.24)", "rgba(166, 255, 192, 0.92)", "rgba(255, 242, 156, 0.68)");
      sprites[`fx_ring_green_${f}`] = canvas;
    }
    {
      const { canvas, ctx } = makeHdCanvas(40, 20);
      drawRingEllipse(ctx, 20, 10, f === 0 ? 15 : 17, f === 0 ? 6.5 : 7.5, "rgba(110, 231, 168, 0.26)", "rgba(156, 255, 204, 0.88)");
      sprites[`fx_ring_safe_${f}`] = canvas;
    }
  }

  // Detailed 2x HD Woven Coir Home Base Welcome Mat (+ golden porch-glow variant!)
  for (const glowing of [false, true]) {
    const { canvas, ctx } = makeHdCanvas(34, 22);
    if (glowing) {
      drawRingEllipse(ctx, 17, 11, 16, 10, "rgba(255, 228, 122, 0.26)", "rgba(255, 246, 184, 0.9)");
    }
    px(ctx, 4, 4, 26, 14, "#3b2010");
    px(ctx, 5, 5, 24, 12, glowing ? "#d99242" : "#b87333");
    px(ctx, 6, 6, 22, 10, glowing ? "#f2b85c" : "#d4924c");
    // Woven border stripe
    px(ctx, 7, 7, 20, 1, "#7a421c");
    px(ctx, 7, 14, 20, 1, "#7a421c");
    px(ctx, 7, 7, 1, 8, "#7a421c");
    px(ctx, 26, 7, 1, 8, "#7a421c");
    // Tiny woven coir fiber texture + cozy "HOME" center emblem
    for (let x = 9; x <= 24; x += 3) {
      px(ctx, x, 9, 2, 1, glowing ? "#fff2c2" : "#e8b474");
      px(ctx, x + 1, 12, 2, 1, "#9c5b28");
    }
    px(ctx, 13, 10, 8, 2, "#592d14");
    px(ctx, 14, 10, 6, 1, glowing ? "#fff7d6" : "#f0c888");
    sprites[glowing ? "prop_welcome_mat_glow" : "prop_welcome_mat"] = canvas;
  }

  // Circular 2x HD Radial Golden Lantern Glow Halo (replaces blocky yellow rectangles in graveyards!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(116, 84);
    const cx = 58;
    const cy = 42;
    const scale = f === 0 ? 1 : 1.04;
    pxEllipse(ctx, cx, cy, 52 * scale, 36 * scale, "rgba(255, 208, 92, 0.10)");
    pxEllipse(ctx, cx, cy, 38 * scale, 26 * scale, "rgba(255, 224, 122, 0.14)");
    pxEllipse(ctx, cx, cy, 22 * scale, 15 * scale, "rgba(255, 242, 178, 0.18)");
    drawRingEllipse(ctx, cx, cy, 48 * scale, 33 * scale, null, "rgba(255, 238, 162, 0.28)");
    sprites[`fx_lantern_glow_${f}`] = canvas;
  }

  // Circular 2x HD Radiant Pocket Siddur Blessing Waves (3 expanding stages!)
  for (let f = 0; f < 3; f++) {
    const size = 56 + f * 38;
    const h = Math.round(size * 0.72);
    const { canvas, ctx } = makeHdCanvas(size, h);
    const cx = Math.floor(size / 2);
    const cy = Math.floor(h / 2);
    const rx = Math.floor(size / 2) - 3;
    const ry = Math.floor(h / 2) - 3;
    drawRingEllipse(
      ctx,
      cx,
      cy,
      rx,
      ry,
      f === 0 ? "rgba(120, 206, 255, 0.22)" : "rgba(120, 206, 255, 0.08)",
      "rgba(136, 218, 255, 0.9)",
      "rgba(255, 236, 130, 0.85)"
    );
    drawRingEllipse(ctx, cx, cy, Math.max(6, rx - 5), Math.max(4, ry - 4), null, "rgba(255, 236, 138, 0.88)");
    sprites[`fx_siddur_ring_${f}`] = canvas;
  }

  // Circular 2x HD BotW Sheikah Ground Sigil Ring
  {
    const { canvas, ctx } = makeHdCanvas(96, 52);
    drawRingEllipse(ctx, 48, 26, 44, 22, "rgba(26, 184, 238, 0.22)", "rgba(88, 242, 255, 0.94)", "rgba(232, 254, 255, 0.85)");
    drawRingEllipse(ctx, 48, 26, 32, 16, null, "rgba(220, 252, 255, 0.88)");
    drawRingEllipse(ctx, 48, 26, 18, 9, "rgba(88, 242, 255, 0.16)", "rgba(148, 248, 255, 0.85)");
    sprites.fx_sheikah_ring = canvas;
  }

  // Elliptical 2x HD Wading Water Ripples (3 expanding frames)
  for (let f = 0; f < 3; f++) {
    const { canvas, ctx } = makeHdCanvas(56, 26);
    const rx = 14 + f * 5;
    const ry = 5 + f * 2;
    drawRingEllipse(ctx, 28, 13, rx, ry, null, f === 2 ? "rgba(224, 248, 255, 0.45)" : "rgba(232, 252, 255, 0.82)");
    if (f > 0) {
      drawRingEllipse(ctx, 28, 13, rx - 5, Math.max(2, ry - 2), null, "rgba(156, 224, 248, 0.58)");
    }
    sprites[`fx_water_ripple_${f}`] = canvas;
  }

  // Soft Tapered 2x HD Graveyard Ground Mist Wisp
  {
    const { canvas, ctx } = makeHdCanvas(56, 16);
    pxEllipse(ctx, 28, 8, 24, 5, "rgba(186, 206, 238, 0.14)");
    pxEllipse(ctx, 24, 8, 16, 3.5, "rgba(210, 226, 250, 0.16)");
    pxEllipse(ctx, 35, 9, 12, 3, "rgba(176, 198, 234, 0.15)");
    sprites.fx_grave_mist = canvas;
  }

  // Crisp 2x HD Sidewalk Chalk Directional Chevron (points right; rotated cleanly to any heading!)
  {
    const { canvas, ctx } = makeHdCanvas(22, 22);
    // Warm golden-glow backing behind chevron
    pxEllipse(ctx, 11, 11, 9.5, 8.5, "rgba(255, 228, 122, 0.24)");
    // Dark emerald-bronze outline chevron + layered bright chalk-gold fill
    for (let i = 0; i < 7; i++) {
      px(ctx, 5 + i, 2 + i, 6, 3, "#1a3324");
      px(ctx, 5 + i, 17 - i, 6, 3, "#1a3324");
    }
    for (let i = 0; i < 7; i++) {
      px(ctx, 6 + i, 3 + i, 4, 2, i >= 4 ? "#ffe47a" : "#f2c244");
      px(ctx, 6 + i, 17 - i, 4, 2, i >= 4 ? "#ffe47a" : "#d99e26");
    }
    // Bright sunlit chalk highlight along upper leading edge & tip
    for (let i = 0; i < 6; i++) {
      px(ctx, 7 + i, 3 + i, 2, 1, "#fff9d6");
    }
    px(ctx, 14, 10, 4, 2, "#fff9d6");
    px(ctx, 16, 10, 2, 2, "#ffffff");
    sprites.fx_chalk_arrow = canvas;
  }

  // 2x HD Upgrade for Quest '!' Bubble, Curb Stop Cue & Fanfare Star!
  {
    const { canvas, ctx } = makeHdCanvas(22, 26);
    const O = "#241712";
    px(ctx, 3, 1, 16, 17, O);
    px(ctx, 1, 3, 20, 13, O);
    px(ctx, 8, 18, 6, 3, O);
    px(ctx, 10, 21, 2, 3, O);
    px(ctx, 3, 2, 16, 15, "#e0a22e");
    px(ctx, 2, 3, 18, 13, "#ffe066");
    px(ctx, 4, 3, 14, 3, "#fff6ba");
    px(ctx, 9, 18, 4, 2, "#e0a22e");
    px(ctx, 9, 4, 4, 7, "#2b1c10");
    px(ctx, 9, 13, 4, 3, "#2b1c10");
    px(ctx, 10, 5, 1, 5, "#5c3b1e");
    sprites.quest_bubble = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(22, 22);
    const O = "#1d1414";
    px(ctx, 6, 0, 10, 22, O);
    px(ctx, 0, 6, 22, 10, O);
    px(ctx, 4, 2, 14, 18, O);
    px(ctx, 2, 4, 18, 14, O);
    px(ctx, 6, 2, 10, 18, "#ffffff");
    px(ctx, 2, 6, 18, 10, "#ffffff");
    px(ctx, 4, 4, 14, 14, "#ffffff");
    px(ctx, 6, 4, 10, 14, "#d9362e");
    px(ctx, 4, 6, 14, 10, "#d9362e");
    px(ctx, 6, 5, 10, 2, "#ff685e");
    // Expressive Look-Both-Ways eyes inside red octagon
    px(ctx, 6, 8, 4, 6, "#ffffff");
    px(ctx, 12, 8, 4, 6, "#ffffff");
    px(ctx, 8, 10, 2, 3, O);
    px(ctx, 12, 10, 2, 3, O);
    px(ctx, 8, 10, 1, 1, "#ffffff");
    px(ctx, 12, 10, 1, 1, "#ffffff");
    sprites.curb_stop_cue = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(18, 18);
    px(ctx, 8, 1, 2, 16, "#fff6b8");
    px(ctx, 1, 8, 16, 2, "#fff6b8");
    px(ctx, 6, 4, 6, 10, "#f4d35e");
    px(ctx, 4, 6, 10, 6, "#f4d35e");
    px(ctx, 7, 7, 4, 4, "#ffffff");
    sprites.fanfare_star = canvas;
  }

  // Crisp 2x HD Pixel Emote & Particle Sprites (hearts, bones, skull, embers, sparkles, notes, pretzel, acorn, feathers, leaves!)
  const makeHeartSprite = (fill, hi, shade, out) => {
    const { canvas, ctx } = makeHdCanvas(16, 14);
    px(ctx, 2, 1, 4, 2, out); px(ctx, 10, 1, 4, 2, out);
    px(ctx, 1, 2, 14, 5, out);
    px(ctx, 2, 7, 12, 2, out);
    px(ctx, 4, 9, 8, 2, out);
    px(ctx, 6, 11, 4, 2, out);
    px(ctx, 7, 13, 2, 1, out);
    px(ctx, 2, 2, 4, 4, fill); px(ctx, 10, 2, 4, 4, fill);
    px(ctx, 3, 3, 10, 4, fill);
    px(ctx, 4, 7, 8, 2, shade);
    px(ctx, 6, 9, 4, 2, shade);
    px(ctx, 7, 11, 2, 1, shade);
    px(ctx, 3, 3, 2, 2, hi);
    return canvas;
  };
  sprites.fx_heart_pink = makeHeartSprite("#ff5c93", "#ffd4e5", "#d92b6b", "#451024");
  sprites.fx_heart_red = makeHeartSprite("#eb3442", "#ffc4c4", "#b51928", "#2e0d12");
  sprites.fx_heart_empty = makeHeartSprite("#594952", "#826f78", "#3d3038", "#1f161b");

  // 4-point twinkling pixel sparkles (gold & cyan)
  for (const [key, outer, mid] of [
    ["fx_sparkle_gold", "#f4c438", "#fff6b8"],
    ["fx_sparkle_cyan", "#38d9f5", "#d8fbff"],
  ]) {
    const { canvas, ctx } = makeHdCanvas(14, 14);
    px(ctx, 6, 1, 2, 12, outer);
    px(ctx, 1, 6, 12, 2, outer);
    px(ctx, 5, 4, 4, 6, mid);
    px(ctx, 4, 5, 6, 4, mid);
    px(ctx, 6, 6, 2, 2, "#ffffff");
    sprites[key] = canvas;
  }

  // Comic startled '!' alert icon
  {
    const { canvas, ctx } = makeHdCanvas(14, 20);
    px(ctx, 4, 1, 6, 12, "#2e0c0e");
    px(ctx, 4, 14, 6, 5, "#2e0c0e");
    px(ctx, 5, 2, 4, 10, "#ff4b3e");
    px(ctx, 6, 2, 2, 8, "#ffe066");
    px(ctx, 5, 15, 4, 3, "#ff4b3e");
    px(ctx, 6, 15, 2, 2, "#ffe066");
    sprites.fx_alert_bang = canvas;
  }

  // Flying cyan sweat droplet (joggers & startled reactions)
  {
    const { canvas, ctx } = makeHdCanvas(10, 14);
    px(ctx, 4, 1, 2, 3, "#1a4d6e");
    px(ctx, 3, 4, 4, 3, "#1a4d6e");
    px(ctx, 2, 7, 6, 4, "#1a4d6e");
    px(ctx, 3, 11, 4, 2, "#1a4d6e");
    px(ctx, 4, 3, 2, 4, "#6be6ff");
    px(ctx, 3, 7, 4, 4, "#6be6ff");
    px(ctx, 4, 6, 1, 3, "#ffffff");
    sprites.fx_sweat_drop = canvas;
  }

  // Cheerful floating pixel musical note (NPC greeting wave & cheer!)
  {
    const { canvas, ctx } = makeHdCanvas(14, 16);
    px(ctx, 5, 1, 8, 4, "#24180c");
    px(ctx, 5, 4, 3, 8, "#24180c");
    px(ctx, 10, 4, 3, 7, "#24180c");
    px(ctx, 2, 10, 6, 5, "#24180c");
    px(ctx, 8, 9, 6, 5, "#24180c");
    px(ctx, 6, 2, 6, 2, "#ffe066");
    px(ctx, 6, 4, 1, 7, "#ffe066");
    px(ctx, 11, 4, 1, 6, "#ffe066");
    px(ctx, 3, 11, 4, 3, "#ff87ab");
    px(ctx, 9, 10, 4, 3, "#6ee7a8");
    px(ctx, 4, 11, 1, 1, "#ffffff");
    px(ctx, 10, 10, 1, 1, "#ffffff");
    sprites.fx_music_note = canvas;
  }

  // Spinning skeleton bones (2 orientations) & bouncing skull poof for skeleton defeat!
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(16, 16);
    if (f === 0) {
      px(ctx, 2, 5, 12, 6, "#272e3a");
      px(ctx, 1, 4, 4, 8, "#272e3a");
      px(ctx, 11, 4, 4, 8, "#272e3a");
      px(ctx, 3, 6, 10, 4, "#edf2eb");
      px(ctx, 2, 5, 2, 2, "#ffffff");
      px(ctx, 2, 9, 2, 2, "#d8e0d5");
      px(ctx, 12, 5, 2, 2, "#ffffff");
      px(ctx, 12, 9, 2, 2, "#d8e0d5");
    } else {
      px(ctx, 5, 2, 6, 12, "#272e3a");
      px(ctx, 4, 1, 8, 4, "#272e3a");
      px(ctx, 4, 11, 8, 4, "#272e3a");
      px(ctx, 6, 3, 4, 10, "#edf2eb");
      px(ctx, 5, 2, 2, 2, "#ffffff");
      px(ctx, 9, 2, 2, 2, "#d8e0d5");
      px(ctx, 5, 12, 2, 2, "#ffffff");
      px(ctx, 9, 12, 2, 2, "#d8e0d5");
    }
    sprites[`fx_bone_${f}`] = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(18, 18);
    pxEllipse(ctx, 9, 8, 7, 6, "#272e3a");
    pxEllipse(ctx, 9, 8, 6, 5, "#edf2eb");
    pxEllipse(ctx, 8, 6, 3.5, 2.5, "#ffffff");
    px(ctx, 5, 12, 8, 4, "#272e3a");
    px(ctx, 6, 12, 6, 3, "#dbe3d8");
    px(ctx, 5, 7, 3, 3, "#1b202e");
    px(ctx, 10, 7, 3, 3, "#1b202e");
    px(ctx, 6, 8, 1, 1, "#59f2a8");
    px(ctx, 11, 8, 1, 1, "#59f2a8");
    px(ctx, 7, 13, 1, 2, "#272e3a");
    px(ctx, 10, 13, 1, 2, "#272e3a");
    sprites.fx_skull_poof = canvas;
  }

  // Fiery Jack-o'-Lantern ember (Pumpkin Ghoul defeat & attack sparks)
  {
    const { canvas, ctx } = makeHdCanvas(12, 14);
    pxEllipse(ctx, 6, 9, 4.5, 4.5, "#9e260c");
    pxEllipse(ctx, 6, 8, 3.5, 4.2, "#ff7824");
    pxEllipse(ctx, 6, 9, 2.2, 2.6, "#ffe466");
    px(ctx, 5, 8, 2, 2, "#ffffff");
    px(ctx, 5, 2, 2, 3, "#ff9933");
    sprites.fx_ember = canvas;
  }

  // 2x HD Tossed Pretzel & Lucky Acorn sprites!
  {
    const { canvas, ctx } = makeHdCanvas(18, 16);
    pxEllipse(ctx, 9, 8, 7.5, 6, "#42210b");
    pxEllipse(ctx, 9, 8, 6.2, 4.8, "#d48432");
    pxEllipse(ctx, 9, 7, 4.8, 3.4, "#f0a94c");
    // Pretzel knot holes
    px(ctx, 5, 6, 3, 3, "#42210b");
    px(ctx, 10, 6, 3, 3, "#42210b");
    px(ctx, 7, 9, 4, 2, "#42210b");
    // Crisp white salt crystals!
    px(ctx, 4, 5, 2, 1, "#fff8e8");
    px(ctx, 11, 4, 2, 1, "#fff8e8");
    px(ctx, 8, 7, 2, 1, "#fff8e8");
    px(ctx, 12, 10, 2, 1, "#fff8e8");
    sprites.fx_pretzel = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(14, 16);
    px(ctx, 6, 1, 2, 3, "#361e0d");
    px(ctx, 2, 3, 10, 5, "#361e0d");
    px(ctx, 3, 4, 8, 3, "#7a4922");
    px(ctx, 4, 4, 6, 1, "#a66838");
    px(ctx, 3, 8, 8, 5, "#361e0d");
    px(ctx, 5, 13, 4, 2, "#361e0d");
    px(ctx, 4, 8, 6, 4, "#c9853c");
    px(ctx, 5, 9, 2, 2, "#f5be6e");
    px(ctx, 6, 12, 2, 2, "#a86728");
    sprites.fx_acorn = canvas;
  }

  // Crisp 2x HD Turkey Feathers & Drifting Autumn Maple Leaves!
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(14, 10);
    const col = f === 0 ? "#a85224" : "#d98234";
    px(ctx, 1, 3, 12, 5, "#2b160e");
    px(ctx, 2, 4, 10, 3, col);
    px(ctx, 9, 4, 3, 3, "#f0d8b2");
    px(ctx, 3, 5, 7, 1, "#592d18");
    sprites[`fx_feather_${f}`] = canvas;
  }
  const leafColors =
    ambientParticleStyle === "snowflakes"
      ? [
          ["#9ec7eb", "#dceefc", "#ffffff"], // sparkling snowflake
          ["#b4d8f5", "#e8f5ff", "#ffffff"],
          ["#8cb8e0", "#d0e8fa", "#ffffff"],
        ]
      : ambientParticleStyle === "spring_petals"
        ? [
            ["#c96992", "#ff9ec8", "#ffe6f2"], // cherry sakura petal
            ["#d483a8", "#ffb8d8", "#ffffff"],
            ["#c4b2bd", "#f5e8f0", "#ffffff"],
          ]
        : ambientParticleStyle === "olive_blossoms"
      ? [
          ["#9c2260", "#e84a96", "#ff9cd0"], // bougainvillea petal
          ["#c4b898", "#f7f0d8", "#ffffff"], // almond blossom
          ["#4f6e44", "#84a373", "#c2d6b2"], // silvery olive leaf
        ]
      : ambientParticleStyle === "jacaranda_petals"
        ? [
            ["#573b94", "#8a6be0", "#d0beff"],
            ["#9c2260", "#e84a96", "#ffa6d4"],
            ["#b8a06a", "#ffe69e", "#ffffff"],
          ]
        : ambientParticleStyle === "desert_motes"
          ? [
              ["#a67846", "#d9a86c", "#fae1b0"],
              ["#b58652", "#e8be84", "#fff0cc"],
              ["#8f673e", "#c99a62", "#f5d6a4"],
            ]
          : ambientParticleStyle === "summer_petals"
            ? [
                ["#8c9c78", "#d8e6c5", "#ffffff"],
                ["#c4a638", "#ffe466", "#fff8bd"],
                ["#548c3e", "#87c95c", "#c8f294"],
              ]
            : [
                ["#7a1816", "#cf3626", "#ff7842"],
                ["#8c4212", "#e08424", "#ffd252"],
                ["#6e1e18", "#b83024", "#f06834"],
              ];
  leafColors.forEach(([dark, mid, hi], i) => {
    const { canvas, ctx } = makeHdCanvas(10, 10);
    px(ctx, 4, 1, 2, 8, dark);
    px(ctx, 2, 3, 6, 4, dark);
    px(ctx, 3, 3, 4, 4, mid);
    px(ctx, 4, 2, 2, 4, hi);
    px(ctx, 7, 7, 2, 2, dark);
    sprites[`fx_leaf_${i}`] = canvas;
  });

  // Upgrade all 19 pickup items, collectibles, 5-frame sword swings, interaction FX & graveyard props to 2x HD!
  upgradeItemsAndFxTo32Bit(sprites);
}
