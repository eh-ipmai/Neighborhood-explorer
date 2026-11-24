/**
 * Home Base Interior System (565 Boylston St) — Rich 32-Bit 2x HD Pixel-Art Indoor Rooms!
 * Implements GDD Section 6.2 & Section 8.2 Home Base gameplay ideas:
 *   1. Main Floor (Cozy New England Living Room & Farmhouse Kitchen, River-Stone Hearth,
 *      Sunlit Colonial Windows with Curtains & Sunbeams, Persian Medallion Rug, Plush Tufted
 *      Sofa, Mahogany Outfit Armoire, Secret Sliding Bookshelf, and Championship Pool Table /
 *      D&D Campaign Portal)
 *   2. Secret Upstairs Reading Nook (GDD 6.2 #4) — timber-raftered attic loft, starry dormer
 *      skylight with crescent moon, curved catenary fairy lights, corduroy beanbag, stargazing
 *      spyglass & gilded chest holding the Golden D20!
 *   3. 32-Bit D&D Basement Dungeon (GDD 8.2 #19) — mossy chiseled flagstones, arched gothic
 *      stone masonry, crimson heraldic tapestries, roaring wall torches, sculpted Halfling Bard,
 *      Gnome Wizard & Eldritch Knight statues, glowing arcane floor conduits & 3-switch rune
 *      puzzle guarding the Bag of Holding!
 *
 * Pre-bakes 2x HD offscreen canvases (__pixelScale = 0.5) for BOTH static rooms and smooth
 * 4-frame animated lighting/flame/portal overlays — 60 FPS with 100% parity on both Kaplay
 * WebGL and HTML5 2D Canvas fallback!
 */

import { DEFAULT_HITBOX, TILE_SIZE } from "./player.js";

export const INTERIOR_ROOMS = {
  main_floor: {
    id: "main_floor",
    name: "565 BOYLSTON ST — INSIDE HOME",
    tag: "Living Room & Kitchen",
    width: 20,
    height: 12,
    spawn: { x: 9.5, y: 9.2 },
    solids: [
      { minX: 3, minY: 2, maxX: 5, maxY: 2, id: "bookshelf" },
      { minX: 8, minY: 2, maxX: 11, maxY: 2, id: "fireplace" },
      { minX: 14, minY: 2, maxX: 17, maxY: 2, id: "kitchen_counter" },
      { minX: 2, minY: 5, maxX: 2, maxY: 6, id: "outfit_closet" },
      { minX: 8, minY: 5, maxX: 11, maxY: 5, id: "couch" },
      { minX: 14, minY: 7, maxX: 16, maxY: 8, id: "pool_table" },
    ],
  },
  upstairs_nook: {
    id: "upstairs_nook",
    name: "SECRET UPSTAIRS READING NOOK",
    tag: "Cozy Attic Loft",
    width: 16,
    height: 10,
    spawn: { x: 4.5, y: 7.4 },
    solids: [
      { minX: 2, minY: 2, maxX: 4, maxY: 2, id: "attic_books_l" },
      { minX: 11, minY: 2, maxX: 13, maxY: 2, id: "attic_books_r" },
      { minX: 7, minY: 3, maxX: 8, maxY: 3, id: "d20_chest" },
      { minX: 12, minY: 6, maxX: 13, maxY: 6, id: "beanbag" },
    ],
  },
  dnd_basement: {
    id: "dnd_basement",
    name: "32-BIT D&D BASEMENT DUNGEON",
    tag: "3-Switch Puzzle Sanctum",
    width: 18,
    height: 11,
    spawn: { x: 8.5, y: 8.4 },
    solids: [
      { minX: 4, minY: 3, maxX: 4, maxY: 3, id: "statue_bard" },
      { minX: 9, minY: 3, maxX: 9, maxY: 3, id: "statue_wizard" },
      { minX: 13, minY: 3, maxX: 13, maxY: 3, id: "statue_knight" },
      { minX: 8, minY: 2, maxX: 9, maxY: 2, id: "bag_chest" },
    ],
  },
};

// ============================================================================
// 32-Bit HD Canvas Primitives (gracefully safe in headless Node test mocks!)
// ============================================================================

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function hasPathAPI(ctx) {
  return typeof ctx.beginPath === "function" && typeof ctx.fill === "function";
}

function fillLinearGrad(ctx, x, y, w, h, stops, vertical = true) {
  if (typeof ctx.createLinearGradient === "function") {
    const g = vertical
      ? ctx.createLinearGradient(x, y, x, y + h)
      : ctx.createLinearGradient(x, y, x + w, y);
    for (const [offset, col] of stops) g.addColorStop(offset, col);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = stops[Math.floor(stops.length / 2)][1];
  }
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function radialGlow(ctx, cx, cy, r0, r1, stops) {
  if (typeof ctx.createRadialGradient === "function" && hasPathAPI(ctx)) {
    const g = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    for (const [offset, col] of stops) g.addColorStop(offset, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    px(ctx, cx - r1 * 0.5, cy - r1 * 0.5, r1, r1, stops[0][1]);
  }
}

function ellipseFill(ctx, cx, cy, rx, ry, fill, stroke = null, lineWidth = 1.5) {
  if (hasPathAPI(ctx) && typeof ctx.ellipse === "function") {
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && typeof ctx.stroke === "function") {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  } else if (fill) {
    px(ctx, cx - rx, cy - ry, rx * 2, ry * 2, fill);
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r, fill, stroke = null, lineWidth = 1.5) {
  if (hasPathAPI(ctx) && typeof ctx.quadraticCurveTo === "function") {
    roundRectPath(ctx, x, y, w, h, r);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && typeof ctx.stroke === "function") {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  } else {
    if (stroke) px(ctx, x, y, w, h, stroke);
    if (fill) px(ctx, x + 1, y + 1, w - 2, h - 2, fill);
  }
}

function roundRectGrad(ctx, x, y, w, h, r, stops, stroke = null, lineWidth = 1.5, vertical = true) {
  let fill = stops[0][1];
  if (typeof ctx.createLinearGradient === "function") {
    const g = vertical
      ? ctx.createLinearGradient(x, y, x, y + h)
      : ctx.createLinearGradient(x, y, x + w, y);
    for (const [offset, col] of stops) g.addColorStop(offset, col);
    fill = g;
  }
  roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth);
}

function polyFill(ctx, pts, fill, stroke = null, lineWidth = 1.5) {
  if (hasPathAPI(ctx) && typeof ctx.moveTo === "function" && pts.length >= 3) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && typeof ctx.stroke === "function") {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }
}

function softShadow(ctx, cx, cy, rx, ry, alpha = 0.34) {
  ellipseFill(ctx, cx, cy, rx, ry, `rgba(22, 10, 8, ${alpha})`);
  ellipseFill(ctx, cx, cy, rx * 0.72, ry * 0.68, `rgba(18, 8, 6, ${alpha * 0.7})`);
}

function drawLine(ctx, x0, y0, x1, y1, color, width = 2) {
  if (hasPathAPI(ctx) && typeof ctx.stroke === "function") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function drawQuadCurve(ctx, x0, y0, cx, cy, x1, y1, color, width = 2) {
  if (hasPathAPI(ctx) && typeof ctx.quadraticCurveTo === "function" && typeof ctx.stroke === "function") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(cx, cy, x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

// ============================================================================
// Detailed 32-Bit Furniture & Architectural Setpieces
// ============================================================================

function drawHardwoodFloor(ctx, x, y, w, h, palette, plankH = 8, plankLen = 46) {
  fillLinearGrad(ctx, x, y, w, h, [
    [0, palette.baseDark],
    [0.18, palette.baseMid],
    [0.82, palette.baseMid],
    [1, palette.baseDark],
  ]);

  for (let py = y; py < y + h; py += plankH) {
    const row = Math.floor((py - y) / plankH);
    const offset = (row * 27) % plankLen;
    for (let px0 = x - offset; px0 < x + w; px0 += plankLen) {
      const sx = Math.max(x, px0);
      const ex = Math.min(x + w, px0 + plankLen);
      const sw = ex - sx;
      if (sw <= 0) continue;
      const hash = Math.abs(row * 17 + Math.floor(px0 / plankLen) * 31);
      const tones = palette.planks[hash % palette.planks.length];
      fillLinearGrad(ctx, sx, py, sw, plankH, [
        [0, tones[0]],
        [0.45, tones[1]],
        [1, tones[2]],
      ]);
      // Fine top bevel & dark bottom groove
      px(ctx, sx, py, sw, 1, tones[3]);
      px(ctx, sx, py + plankH - 1, sw, 1, palette.seam);
      // Organic curved wood grain wisp & occasional knot
      if (sw > 16) {
        const gy = py + 2 + (hash % 3);
        px(ctx, sx + 5 + (hash % 6), gy, Math.min(18, sw - 12), 1, palette.grain);
        if (hash % 5 === 0 && sw > 24) {
          ellipseFill(ctx, sx + 14 + (hash % 10), py + plankH * 0.5, 2.2, 1.3, palette.knot);
        }
      }
      // Butt joint + tiny bronze nails
      if (sx > x) {
        px(ctx, sx, py, 1.5, plankH, palette.seam);
        px(ctx, sx + 3, py + 2, 1, 1, palette.nail);
        px(ctx, sx + 3, py + plankH - 3, 1, 1, palette.nail);
      }
    }
  }
}

function drawPottedPlant(ctx, cx, cy, scale = 1) {
  softShadow(ctx, cx, cy + 8 * scale, 11 * scale, 5 * scale, 0.34);
  // Glazed terracotta pot (tapered trapezoid + curved rim!)
  polyFill(
    ctx,
    [
      [cx - 7 * scale, cy - 1 * scale],
      [cx + 7 * scale, cy - 1 * scale],
      [cx + 5 * scale, cy + 9 * scale],
      [cx - 5 * scale, cy + 9 * scale],
    ],
    "#ba5734",
    "#33160f",
    1.5
  );
  polyFill(
    ctx,
    [
      [cx - 5.5 * scale, cy],
      [cx - 1 * scale, cy],
      [cx - 1.5 * scale, cy + 8 * scale],
      [cx - 4.2 * scale, cy + 8 * scale],
    ],
    "#de7b4f"
  );
  roundRectGrad(
    ctx,
    cx - 8.5 * scale,
    cy - 4 * scale,
    17 * scale,
    4.5 * scale,
    2,
    [
      [0, "#e88b5d"],
      [1, "#9c4324"],
    ],
    "#33160f",
    1.4
  );
  ellipseFill(ctx, cx, cy - 3 * scale, 6 * scale, 1.8 * scale, "#3d2418");

  // Lush fiddle-leaf fronds curving outward with warm sunlit tips!
  const leaves = [
    [-9, -11, 5.5, 3.2, "#1f5934", "#3d8f4f"],
    [9, -11, 5.5, 3.2, "#1b4d2d", "#347d44"],
    [-6, -18, 5.2, 3.5, "#266e3d", "#5cb860"],
    [6, -17, 5.2, 3.5, "#216136", "#4ca653"],
    [0, -22, 5.5, 4.2, "#2c7d44", "#74cc68"],
    [-1, -12, 4.5, 3.0, "#1c5430", "#49a151"],
  ];
  for (const [dx, dy, rx, ry, darkC, hiC] of leaves) {
    drawLine(ctx, cx, cy - 3 * scale, cx + dx * scale * 0.7, cy + dy * scale * 0.8, "#1c4727", 1.8 * scale);
    ellipseFill(ctx, cx + dx * scale, cy + dy * scale, rx * scale, ry * scale, darkC, "#122e1a", 1.2);
    ellipseFill(ctx, cx + (dx - 1) * scale, cy + (dy - 0.8) * scale, rx * 0.62 * scale, ry * 0.55 * scale, hiC);
  }
}

function drawColonialWindow(ctx, wx, wy) {
  const w = 44;
  const h = 38;
  // Soft shadow cast on wallpaper
  px(ctx, wx - 2, wy + 2, w + 6, h + 6, "rgba(38, 18, 12, 0.22)");
  // Outer carved wooden casing
  roundRectGrad(
    ctx,
    wx - 3,
    wy - 3,
    w + 6,
    h + 6,
    3,
    [
      [0, "#fffbf2"],
      [0.5, "#ebe1ce"],
      [1, "#c4b49a"],
    ],
    "#2e1b14",
    1.6
  );
  // Outdoor Massachusetts golden-hour autumn view through glass!
  fillLinearGrad(ctx, wx + 2, wy + 2, w - 4, h - 4, [
    [0, "#6fb0e3"],
    [0.45, "#a9d6f2"],
    [0.72, "#ffe5a3"],
    [1, "#f7c272"],
  ]);
  // Fluffy sunlit clouds & golden autumn maple canopies outside!
  ellipseFill(ctx, wx + 13, wy + 9, 7, 3, "rgba(255, 252, 240, 0.85)");
  ellipseFill(ctx, wx + 30, wy + 12, 6, 2.5, "rgba(255, 250, 232, 0.8)");
  ellipseFill(ctx, wx + 11, wy + 30, 9, 8, "#cf5221");
  ellipseFill(ctx, wx + 10, wy + 28, 6, 5, "#f08132");
  ellipseFill(ctx, wx + 26, wy + 31, 10, 7, "#b83a1d");
  ellipseFill(ctx, wx + 28, wy + 28, 7, 5, "#eb942d");
  ellipseFill(ctx, wx + 36, wy + 32, 6, 6, "#4d7d38");
  // Subtle diagonal glass specular reflection streak
  polyFill(
    ctx,
    [
      [wx + 6, wy + 3],
      [wx + 13, wy + 3],
      [wx + 5, wy + 20],
      [wx + 3, wy + 14],
    ],
    "rgba(255, 255, 255, 0.26)"
  );
  // Crisp colonial window mullions (6-pane grid)
  px(ctx, wx + Math.floor(w / 2) - 1, wy + 2, 2, h - 4, "#f7f1e3");
  px(ctx, wx + 2, wy + 14, w - 4, 2, "#f7f1e3");
  px(ctx, wx + 2, wy + 26, w - 4, 2, "#f7f1e3");
  px(ctx, wx + 2, wy + 16, w - 4, 1, "rgba(42, 28, 18, 0.22)");

  // Brass curtain rod with finials
  roundRect(ctx, wx - 7, wy - 6, w + 14, 3, 1.5, "#e0b34c", "#422710", 1);
  ellipseFill(ctx, wx - 7, wy - 4.5, 2.5, 2.5, "#ffe082", "#422710", 1);
  ellipseFill(ctx, wx + w + 7, wy - 4.5, 2.5, 2.5, "#ffe082", "#422710", 1);

  // Curved pleated forest-green curtains tied back with gold tassels!
  polyFill(
    ctx,
    [
      [wx - 2, wy - 3],
      [wx + 11, wy - 3],
      [wx + 7, wy + 20],
      [wx + 10, wy + h + 2],
      [wx - 3, wy + h + 2],
    ],
    "#2c634c",
    "#153326",
    1.3
  );
  polyFill(
    ctx,
    [
      [wx + 1, wy - 2],
      [wx + 6, wy - 2],
      [wx + 4, wy + 20],
      [wx + 5, wy + h + 1],
      [wx + 1, wy + h + 1],
    ],
    "#428a6b"
  );
  px(ctx, wx - 2, wy + 19, 10, 3, "#f0c24f"); // gold tie-back!

  polyFill(
    ctx,
    [
      [wx + w - 11, wy - 3],
      [wx + w + 2, wy - 3],
      [wx + w + 3, wy + h + 2],
      [wx + w - 10, wy + h + 2],
      [wx + w - 7, wy + 20],
    ],
    "#2c634c",
    "#153326",
    1.3
  );
  polyFill(
    ctx,
    [
      [wx + w - 6, wy - 2],
      [wx + w - 1, wy - 2],
      [wx + w - 1, wy + h + 1],
      [wx + w - 5, wy + h + 1],
      [wx + w - 4, wy + 20],
    ],
    "#428a6b"
  );
  px(ctx, wx + w - 8, wy + 19, 10, 3, "#f0c24f");

  // Molded white wooden windowsill with tiny clay succulent!
  roundRectGrad(
    ctx,
    wx - 6,
    wy + h + 1,
    w + 12,
    6,
    2,
    [
      [0, "#ffffff"],
      [0.55, "#ede3d1"],
      [1, "#baa98f"],
    ],
    "#2e1b14",
    1.4
  );
  roundRect(ctx, wx + 18, wy + h - 5, 7, 6, 1.5, "#c9663c", "#3b1b10", 1);
  ellipseFill(ctx, wx + 21.5, wy + h - 6, 4.2, 2.5, "#59ad5e", "#1d4724", 1);
}

function drawPersianRug(ctx, rx, ry, rw, rh) {
  softShadow(ctx, rx + rw / 2 + 2, ry + rh / 2 + 3, rw / 2 + 2, rh / 2 + 2, 0.22);
  // Individual cream fringe tassels along left & right edges
  for (let ty = ry + 4; ty < ry + rh - 4; ty += 4) {
    px(ctx, rx - 7, ty, 7, 2, ty % 8 === 0 ? "#f7eedb" : "#ded0b4");
    px(ctx, rx + rw, ty, 7, 2, ty % 8 === 0 ? "#f7eedb" : "#ded0b4");
  }
  // Outer deep burgundy border with woven trim
  roundRectGrad(
    ctx,
    rx,
    ry,
    rw,
    rh,
    4,
    [
      [0, "#752024"],
      [0.5, "#59161a"],
      [1, "#421013"],
    ],
    "#2e0b0d",
    1.5
  );
  roundRect(ctx, rx + 4, ry + 4, rw - 8, rh - 8, 3, "#b53632");
  // Gold embroidered border stripe with tiny repeating floral diamonds
  roundRect(ctx, rx + 9, ry + 9, rw - 18, rh - 18, 2, "#e8b44c");
  for (let bx = rx + 14; bx < rx + rw - 14; bx += 12) {
    ellipseFill(ctx, bx, ry + 11.5, 2.2, 1.8, "#6e1c1f");
    ellipseFill(ctx, bx, ry + rh - 11.5, 2.2, 1.8, "#6e1c1f");
  }
  for (let by = ry + 18; by < ry + rh - 18; by += 12) {
    ellipseFill(ctx, rx + 11.5, by, 1.8, 2.2, "#6e1c1f");
    ellipseFill(ctx, rx + rw - 11.5, by, 1.8, 2.2, "#6e1c1f");
  }
  // Rich deep teal-emerald woven inner field
  roundRectGrad(
    ctx,
    rx + 14,
    ry + 14,
    rw - 28,
    rh - 28,
    2,
    [
      [0, "#24594c"],
      [0.5, "#1b453b"],
      [1, "#14362e"],
    ],
    "#f2ca66",
    1.2
  );
  // Subtle woven fabric cross-hatch texture
  for (let ty = ry + 18; ty < ry + rh - 18; ty += 5) {
    px(ctx, rx + 17, ty, rw - 34, 1, "rgba(255, 232, 178, 0.06)");
  }
  // Ornate central layered floral medallion!
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  polyFill(
    ctx,
    [
      [cx, cy - 30],
      [cx + 46, cy],
      [cx, cy + 30],
      [cx - 46, cy],
    ],
    "#a8302c",
    "#f2ca66",
    1.5
  );
  polyFill(
    ctx,
    [
      [cx, cy - 20],
      [cx + 30, cy],
      [cx, cy + 20],
      [cx - 30, cy],
    ],
    "#1c4c40",
    "#fae08c",
    1.2
  );
  ellipseFill(ctx, cx, cy, 13, 9, "#e8b44c", "#59161a", 1.2);
  ellipseFill(ctx, cx, cy, 6, 4, "#fae8a8");
  // Corner floral arabesques
  for (const [fx, fy] of [
    [rx + 26, ry + 24],
    [rx + rw - 26, ry + 24],
    [rx + 26, ry + rh - 24],
    [rx + rw - 26, ry + rh - 24],
  ]) {
    ellipseFill(ctx, fx, fy, 6, 4.5, "#b53632", "#f2ca66", 1);
    ellipseFill(ctx, fx, fy, 2.4, 2, "#fae08c");
  }
}

function drawRiverStoneFireplace(ctx, fpX, fpY, fpW, fpH) {
  softShadow(ctx, fpX + fpW / 2, fpY + fpH + 5, fpW * 0.56, 10, 0.36);

  // Raised flagstone hearth apron extending onto the oak floor
  roundRectGrad(
    ctx,
    fpX - 10,
    fpY + fpH - 10,
    fpW + 20,
    18,
    4,
    [
      [0, "#b8aba0"],
      [0.5, "#8f8278"],
      [1, "#5c524b"],
    ],
    "#261813",
    1.6
  );
  for (let hx = fpX - 4; hx < fpX + fpW; hx += 28) {
    drawLine(ctx, hx, fpY + fpH - 9, hx, fpY + fpH + 7, "#4d433e", 1.4);
  }

  // Chimney masonry core
  roundRectGrad(
    ctx,
    fpX,
    fpY,
    fpW,
    fpH - 4,
    3,
    [
      [0, "#695f59"],
      [1, "#453d39"],
    ],
    "#241612",
    1.8
  );

  // Hand-laid individual rounded river cobbles (varied warm ochre, slate & terracotta!)
  const stonePalette = [
    ["#a89d92", "#cfc6bd", "#6e645c"],
    ["#8c827a", "#b3a89f", "#59514b"],
    ["#9c8878", "#c4b09f", "#66564a"],
    ["#7a7573", "#9e9895", "#4d4947"],
  ];
  for (let row = 0; row < 6; row++) {
    const sy = fpY + 4 + row * 11;
    const rowOff = row % 2 === 0 ? 4 : 12;
    for (let sx = fpX + rowOff; sx < fpX + fpW - 14; sx += 18) {
      // Skip firebox opening
      if (row >= 3 && sx > fpX + 24 && sx < fpX + fpW - 36) continue;
      const st = stonePalette[(row * 5 + Math.floor(sx)) % stonePalette.length];
      const sw = 15 + ((row + Math.floor(sx)) % 3);
      roundRectGrad(
        ctx,
        sx,
        sy,
        sw,
        9,
        3.5,
        [
          [0, st[1]],
          [0.55, st[0]],
          [1, st[2]],
        ],
        "#2e2521",
        1
      );
    }
  }

  // Deep curved brick firebox arch + glowing ember bed + charred birch logs!
  const archX = fpX + 26;
  const archY = fpY + 34;
  const archW = fpW - 52;
  const archH = fpH - 40;
  roundRectGrad(
    ctx,
    archX - 3,
    archY - 2,
    archW + 6,
    archH + 4,
    12,
    [
      [0, "#24120e"],
      [1, "#120806"],
    ],
    "#47342b",
    2
  );
  // Warm brick interior lining
  roundRectGrad(
    ctx,
    archX + 2,
    archY + 3,
    archW - 4,
    archH - 4,
    9,
    [
      [0, "#3b1710"],
      [0.65, "#5e2212"],
      [1, "#8c2f14"],
    ]
  );
  // Glowing ember coals & iron grate
  ellipseFill(ctx, fpX + fpW / 2, archY + archH - 5, archW * 0.42, 6, "#d94116");
  ellipseFill(ctx, fpX + fpW / 2, archY + archH - 5, archW * 0.28, 3.5, "#ffae36");
  // Crossed birch logs with bark highlights
  roundRectGrad(
    ctx,
    archX + 12,
    archY + archH - 12,
    archW - 24,
    7,
    3,
    [
      [0, "#8f5934"],
      [0.6, "#542f19"],
      [1, "#29140a"],
    ],
    "#1c0c06",
    1.2
  );
  roundRectGrad(
    ctx,
    archX + 20,
    archY + archH - 16,
    archW - 38,
    6,
    3,
    [
      [0, "#a86c42"],
      [1, "#452311"],
    ],
    "#1c0c06",
    1.2
  );

  // Heavy carved oak mantel beam with molded corbels
  roundRectGrad(
    ctx,
    fpX - 8,
    fpY + 23,
    fpW + 16,
    10,
    2.5,
    [
      [0, "#d9985b"],
      [0.45, "#9c592d"],
      [1, "#542a12"],
    ],
    "#26140c",
    1.5
  );
  px(ctx, fpX - 4, fpY + 33, fpW + 8, 3, "rgba(22, 10, 6, 0.35)");

  // Mantelpiece Treasures: Brass candlesticks, framed family photo & golden trophy!
  for (const cx of [fpX + 12, fpX + fpW - 12]) {
    ellipseFill(ctx, cx, fpY + 22, 5, 2, "#d4a039", "#3b230c", 1);
    px(ctx, cx - 1.5, fpY + 14, 3, 8, "#f0c659");
    roundRect(ctx, cx - 2, fpY + 9, 4, 6, 1, "#fffaf0", "#8a7a62", 0.8);
    ellipseFill(ctx, cx, fpY + 7, 1.8, 3, "#ffcf4a");
    ellipseFill(ctx, cx, fpY + 7.5, 0.9, 1.5, "#ffffff");
  }
  // Framed family portrait in center of mantel
  roundRectGrad(
    ctx,
    fpX + fpW / 2 - 14,
    fpY + 4,
    28,
    19,
    2,
    [
      [0, "#e3b34c"],
      [1, "#8c5d1c"],
    ],
    "#2e1a0c",
    1.4
  );
  fillLinearGrad(ctx, fpX + fpW / 2 - 11, fpY + 7, 22, 13, [
    [0, "#87cef0"],
    [0.65, "#bfe8c0"],
    [1, "#629c54"],
  ]);
  // Tiny silhouettes of Mom, Dad & Liam smiling in the family photo!
  ellipseFill(ctx, fpX + fpW / 2 - 5, fpY + 13, 2.2, 2.2, "#f5cba7");
  px(ctx, fpX + fpW / 2 - 7, fpY + 15, 4, 5, "#3b6eb5");
  ellipseFill(ctx, fpX + fpW / 2 + 5, fpY + 13, 2.2, 2.2, "#f5cba7");
  px(ctx, fpX + fpW / 2 + 3, fpY + 15, 4, 5, "#c94c4c");
  ellipseFill(ctx, fpX + fpW / 2, fpY + 15, 1.8, 1.8, "#f5cba7");
  px(ctx, fpX + fpW / 2 - 2, fpY + 17, 4, 3, "#f09432");

  // Wicker basket of firewood on left hearth + brass poker set on right hearth
  roundRectGrad(
    ctx,
    fpX - 8,
    fpY + fpH - 18,
    18,
    13,
    4,
    [
      [0, "#c78e4e"],
      [1, "#7d4f23"],
    ],
    "#2e190c",
    1.2
  );
  ellipseFill(ctx, fpX - 3, fpY + fpH - 18, 3.5, 2.5, "#e6c69c", "#4d2c14", 1);
  ellipseFill(ctx, fpX + 3, fpY + fpH - 19, 3.5, 2.5, "#d4ae7f", "#4d2c14", 1);
  ellipseFill(ctx, fpX + 6, fpY + fpH - 17, 3, 2, "#e6c69c", "#4d2c14", 1);
}

function drawPlushSofa(ctx, x, y, w, h) {
  softShadow(ctx, x + w / 2, y + h + 2, w * 0.52, 9, 0.36);

  // Turned dark-oak sofa legs
  for (const lx of [x + 8, x + w - 12]) {
    roundRect(ctx, lx, y + h - 4, 5, 7, 1.5, "#4d2a16", "#1f0e08", 1);
  }

  // Curved plump tufted backrest
  roundRectGrad(
    ctx,
    x + 6,
    y - 10,
    w - 12,
    24,
    9,
    [
      [0, "#bf5e3c"],
      [0.4, "#9c3e26"],
      [1, "#662315"],
    ],
    "#2b0f0a",
    1.8
  );
  // Subtle fabric cushion dividers & recessed tuft buttons
  for (let i = 1; i <= 2; i++) {
    const cx = x + 6 + ((w - 12) * i) / 3;
    drawLine(ctx, cx, y - 8, cx, y + 12, "#591d11", 1.5);
  }
  for (let i = 0; i < 3; i++) {
    const bx = x + 6 + ((w - 12) * (i + 0.5)) / 3;
    ellipseFill(ctx, bx, y + 1, 2, 2, "#4f180e");
    ellipseFill(ctx, bx - 0.5, y + 0.5, 0.8, 0.8, "#d97a54");
  }

  // Three plump curved seat cushions with warm top specular sheen!
  const seatY = y + 9;
  const seatW = (w - 24) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = x + 12 + i * seatW;
    roundRectGrad(
      ctx,
      cx,
      seatY,
      seatW - 1,
      h - 14,
      6,
      [
        [0, "#de7c54"],
        [0.45, "#b84f30"],
        [1, "#7a2c1a"],
      ],
      "#36130c",
      1.4
    );
    // Soft highlight ridge along front lip of cushion
    px(ctx, cx + 5, seatY + 2, seatW - 11, 2, "rgba(255, 214, 178, 0.35)");
  }

  // Lower sofa skirt / wooden trim rail
  roundRectGrad(
    ctx,
    x + 10,
    y + h - 8,
    w - 20,
    7,
    2,
    [
      [0, "#752a19"],
      [1, "#47170d"],
    ],
    "#260c07",
    1.3
  );

  // Rounded rolled armrests on left & right ends!
  for (const ax of [x, x + w - 15]) {
    roundRectGrad(
      ctx,
      ax,
      y - 2,
      15,
      h - 2,
      7,
      [
        [0, "#d9744c"],
        [0.5, "#a64328"],
        [1, "#5e2012"],
      ],
      "#2b0f0a",
      1.6
    );
    ellipseFill(ctx, ax + 7.5, y + 6, 4.5, 4, "#e68e67");
  }

  // Cozy embroidered throw pillows (mustard gold & sage green!)
  roundRectGrad(
    ctx,
    x + 15,
    y + 1,
    18,
    15,
    5,
    [
      [0, "#fae078"],
      [0.6, "#d9a234"],
      [1, "#946214"],
    ],
    "#472c08",
    1.3
  );
  polyFill(
    ctx,
    [
      [x + 24, y + 4],
      [x + 29, y + 8.5],
      [x + 24, y + 13],
      [x + 19, y + 8.5],
    ],
    "#fff3c4"
  );

  roundRectGrad(
    ctx,
    x + w - 34,
    y + 1,
    18,
    15,
    5,
    [
      [0, "#94c99e"],
      [0.6, "#548f64"],
      [1, "#2f5c3d"],
    ],
    "#183321",
    1.3
  );
  ellipseFill(ctx, x + w - 25, y + 8.5, 3.5, 3, "#e3f5e6");

  // Draped knitted cream-and-navy plaid throw blanket casually over the right armrest!
  roundRectGrad(
    ctx,
    x + w - 18,
    y + 5,
    15,
    22,
    4,
    [
      [0, "#f5ead6"],
      [0.5, "#dfd0b4"],
      [1, "#b8a382"],
    ],
    "#453424",
    1.2
  );
  px(ctx, x + w - 16, y + 10, 11, 2, "#32527a");
  px(ctx, x + w - 16, y + 16, 11, 2, "#a83832");
  px(ctx, x + w - 12, y + 6, 2, 19, "#32527a");
}

function drawFloorLamp(ctx, cx, cy) {
  softShadow(ctx, cx, cy + 16, 9, 4, 0.3);
  // Brass circular base & tall slender turned column
  ellipseFill(ctx, cx, cy + 15, 7, 3.5, "#d4a442", "#3b230c", 1.2);
  ellipseFill(ctx, cx - 1, cy + 14, 4, 1.8, "#ffe28a");
  px(ctx, cx - 1.5, cy - 16, 3, 30, "#c79332");
  px(ctx, cx - 0.5, cy - 16, 1, 30, "#ffe494");
  // Pleated warm-glow fabric lampshade!
  polyFill(
    ctx,
    [
      [cx - 8, cy - 28],
      [cx + 8, cy - 28],
      [cx + 12, cy - 14],
      [cx - 12, cy - 14],
    ],
    "#fff0bd",
    "#6e471a",
    1.4
  );
  polyFill(
    ctx,
    [
      [cx - 5, cy - 27],
      [cx + 3, cy - 27],
      [cx + 5, cy - 15],
      [cx - 7, cy - 15],
    ],
    "#fffbe3"
  );
  ellipseFill(ctx, cx, cy - 28, 8, 2.2, "#ffd97d", "#6e471a", 1.1);
}

function drawMahoganyBookshelf(ctx, bsX, bsY, bsW, bsH, opened) {
  if (opened) {
    // Arched secret attic staircase bathed in warm golden lantern light!
    const stX = bsX + bsW - 4;
    const stY = bsY + 4;
    roundRectGrad(
      ctx,
      stX,
      stY,
      40,
      58,
      6,
      [
        [0, "#ffe596"],
        [0.35, "#9c6233"],
        [1, "#2b160c"],
      ],
      "#21110b",
      1.8
    );
    for (let step = 0; step < 6; step++) {
      const sy = stY + 12 + step * 7.5;
      const bright = step < 2;
      fillLinearGrad(ctx, stX + 4, sy, 32, 6, [
        [0, bright ? "#ffe39e" : "#dba060"],
        [1, bright ? "#c98b44" : "#874e24"],
      ]);
      // Braided crimson & gold stair runner down the middle!
      px(ctx, stX + 12, sy, 16, 6, bright ? "#c94238" : "#962922");
      px(ctx, stX + 13, sy, 2, 6, "#f2c65e");
      px(ctx, stX + 25, sy, 2, 6, "#f2c65e");
      px(ctx, stX + 4, sy + 6, 32, 1.5, "#3b1e0e");
    }
    // Turned oak handrail
    roundRect(ctx, stX + 34, stY + 6, 4, 50, 2, "#a86634", "#29140a", 1);
  }

  softShadow(ctx, bsX + bsW / 2, bsY + bsH + 2, bsW * 0.52, 7, 0.36);

  // Sculpted mahogany bookcase body with crown cornice
  roundRectGrad(
    ctx,
    bsX,
    bsY,
    bsW,
    bsH,
    3,
    [
      [0, "#8c4e29"],
      [0.5, "#69361a"],
      [1, "#45210e"],
    ],
    "#21100a",
    1.8
  );
  // Ornamental arched cornice molding at top
  roundRectGrad(
    ctx,
    bsX - 3,
    bsY - 5,
    bsW + 6,
    7,
    2.5,
    [
      [0, "#c27c48"],
      [0.6, "#874923"],
      [1, "#4f2610"],
    ],
    "#21100a",
    1.5
  );

  // 3 deep shadowed shelves brimming with varied leather books, tilted volumes & a brass globe!
  const bookPalettes = [
    ["#c93832", "#f56c64", "#ffdf85"],
    ["#2c68b5", "#609ee8", "#f7e09c"],
    ["#2f8a4c", "#63bf7c", "#ffe69e"],
    ["#d19426", "#ffd261", "#fff7d1"],
    ["#7a40a6", "#b67ce0", "#f5da8c"],
    ["#9e482b", "#d97a54", "#ffe29c"],
    ["#2e7f85", "#60b8bf", "#fff0ba"],
  ];

  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = bsY + 7 + shelf * 18;
    // Deep recessed shelf interior shadow
    fillLinearGrad(ctx, bsX + 5, sy, bsW - 10, 14, [
      [0, "#241109"],
      [1, "#3d1f11"],
    ]);

    for (let b = 0; b < 11; b++) {
      // Leave space on top-right for a brass globe!
      if (shelf === 0 && b >= 9) continue;
      const [darkC, hiC, foilC] = bookPalettes[(b * 3 + shelf * 2) % bookPalettes.length];
      const bh = 10 + ((b * 5 + shelf) % 4);
      const bx = bsX + 7 + b * 7.5;
      const by = sy + (14 - bh);
      roundRectGrad(
        ctx,
        bx,
        by,
        6.5,
        bh,
        1.2,
        [
          [0, hiC],
          [0.4, darkC],
          [1, darkC],
        ],
        "#1f0e08",
        0.8,
        false
      );
      px(ctx, bx + 1, by + 2.5, 4.5, 1.2, foilC);
      if (bh >= 12) px(ctx, bx + 1, by + bh - 3, 4.5, 1, foilC);
    }

    // Little antique brass globe on top shelf right!
    if (shelf === 0) {
      const gx = bsX + bsW - 14;
      const gy = sy + 6;
      ellipseFill(ctx, gx, gy, 4.8, 4.8, "#4da6c9", "#d4a442", 1.2);
      ellipseFill(ctx, gx - 1.2, gy - 1, 2.2, 1.8, "#6cb868");
      ellipseFill(ctx, gx + 1.5, gy + 1.2, 1.8, 1.2, "#5da35a");
      px(ctx, gx - 3, sy + 11, 6, 2.5, "#c79332");
    }

    // Thick beveled oak shelf lip
    fillLinearGrad(ctx, bsX + 4, sy + 14, bsW - 8, 3.5, [
      [0, "#b87442"],
      [1, "#6b3819"],
    ]);
  }

  // Trailing potted ivy draping gracefully off top-left corner of bookcase!
  ellipseFill(ctx, bsX + 8, bsY - 6, 6, 3.5, "#3b8a49", "#15361c", 1.1);
  ellipseFill(ctx, bsX + 5, bsY - 7, 3.5, 2, "#6cc46e");
  for (let i = 0; i < 4; i++) {
    ellipseFill(ctx, bsX + 2 + (i % 2) * 3, bsY + 1 + i * 5, 2.5, 2, i % 2 === 0 ? "#4ba156" : "#2b6e37", "#14331a", 0.8);
  }
}

function drawFarmhouseKitchen(ctx, S) {
  const kX = 13 * S;
  const kY = 2 * S;
  const kW = 5 * S;
  const kH = 3 * S;

  // 1. Checkered Terracotta-Sage & Cream Ceramic Kitchen Floor + Brass Threshold Strip!
  roundRectGrad(
    ctx,
    kX - 4,
    kY,
    4,
    kH + 4,
    1,
    [
      [0, "#e8bd5e"],
      [1, "#8a6320"],
    ],
    "#3d280b",
    0.8
  );
  roundRectGrad(
    ctx,
    kX - 4,
    kY + kH,
    kW + 4,
    4,
    1,
    [
      [0, "#e8bd5e"],
      [1, "#8a6320"],
    ],
    "#3d280b",
    0.8
  );
  for (let ty = 0; ty < kH; ty += 16) {
    for (let tx = 0; tx < kW; tx += 16) {
      const light = ((tx / 16 + ty / 16) | 0) % 2 === 0;
      fillLinearGrad(ctx, kX + tx, kY + ty, 16, 16, light
        ? [[0, "#fbf6ec"], [1, "#e3d9c5"]]
        : [[0, "#7ea89a"], [1, "#588073"]]
      );
      px(ctx, kX + tx, kY + ty, 15, 1.5, light ? "#ffffff" : "#9dc7b9");
      px(ctx, kX + tx, kY + ty + 15, 16, 1, "#455c54");
      px(ctx, kX + tx + 15, kY + ty, 1, 16, "#455c54");
    }
  }

  // 2. Subway-Tile Kitchen Backsplash & Upper Glass-Front Display Cabinets!
  const cX = 14 * S;
  const cW = 4 * S;
  px(ctx, cX - 2, 16, cW, 48, "#eef2ed");
  for (let by = 18; by < 62; by += 6) {
    const off = ((by / 6) | 0) % 2 === 0 ? 0 : 6;
    px(ctx, cX - 2, by, cW, 1, "#cfd9d2");
    for (let bx = cX + off; bx < cX + cW; bx += 12) {
      px(ctx, bx, by, 1, 6, "#cfd9d2");
    }
  }
  // Upper sage-green shaker cabinets with glass doors revealing pastel stacked plates & mugs!
  for (const ux of [cX + 2, cX + 38]) {
    roundRectGrad(
      ctx,
      ux,
      14,
      32,
      24,
      2,
      [
        [0, "#7da38c"],
        [1, "#4b6e59"],
      ],
      "#1d2e24",
      1.4
    );
    roundRectGrad(
      ctx,
      ux + 4,
      18,
      24,
      16,
      1.5,
      [
        [0, "#d8f0f2"],
        [1, "#a6cfd4"],
      ],
      "#2d4a3a",
      1
    );
    // Stacked ceramic dishes & coffee mugs inside glass cabinet
    px(ctx, ux + 7, 29, 10, 3, "#fff9ed");
    px(ctx, ux + 8, 26, 8, 3, "#f7d49c");
    px(ctx, ux + 19, 27, 6, 5, "#db6458");
    px(ctx, ux + 20, 21, 5, 4, "#5d9bd4");
    px(ctx, ux + 7, 21, 9, 2.5, "#fff9ed");
    // Diagonal glass reflection
    drawLine(ctx, ux + 6, 20, ux + 12, 32, "rgba(255,255,255,0.45)", 2);
  }

  // 3. Butcher-Block Kitchen Countertop & Sage Shaker Lower Cabinets (x=14..17, y=2)
  const ctY = 1 * S + 14;
  softShadow(ctx, cX + cW / 2, ctY + 46, cW * 0.52, 7, 0.34);
  roundRectGrad(
    ctx,
    cX - 2,
    ctY,
    cW - 26,
    46,
    3,
    [
      [0, "#759c85"],
      [0.6, "#547a64"],
      [1, "#355241"],
    ],
    "#1c2b22",
    1.7
  );
  // Warm oak butcher-block slab on top
  roundRectGrad(
    ctx,
    cX - 4,
    ctY - 2,
    cW - 22,
    16,
    2.5,
    [
      [0, "#f2cfa0"],
      [0.5, "#d6a46b"],
      [1, "#a8743d"],
    ],
    "#331c0e",
    1.5
  );
  // Shaker drawer fronts & brass cup pulls
  for (let i = 0; i < 3; i++) {
    const dx = cX + 3 + i * 32;
    roundRect(ctx, dx, ctY + 18, 28, 10, 1.5, "#608a72", "#2b4235", 1);
    px(ctx, dx + 10, ctY + 22, 8, 2.5, "#f2c65e");
    roundRect(ctx, dx, ctY + 31, 28, 12, 1.5, "#547a64", "#2b4235", 1);
    px(ctx, dx + 11, ctY + 35, 6, 2, "#f2c65e");
  }

  // 4. Cast-Iron Stovetop + Gleaming Copper Whistling Tea Kettle (left counter!)
  roundRect(ctx, cX + 2, ctY, 28, 12, 2, "#292d36", "#14161c", 1.2);
  ellipseFill(ctx, cX + 10, ctY + 6, 5, 3.5, "#171920", "#5b6273", 1);
  ellipseFill(ctx, cX + 22, ctY + 6, 4.5, 3, "#171920", "#5b6273", 1);
  // Copper kettle sitting on front-left burner!
  ellipseFill(ctx, cX + 10, ctY + 4, 6, 4.5, "#d97538", "#451d0a", 1.2);
  ellipseFill(ctx, cX + 8.5, ctY + 2.5, 2.5, 1.8, "#ffc28a");
  drawQuadCurve(ctx, cX + 5, ctY + 2, cX + 10, ctY - 6, cX + 15, ctY + 2, "#241914", 2);
  drawLine(ctx, cX + 15, ctY + 3, cX + 19, ctY - 1, "#d97538", 2.2);

  // 5. Farmhouse Porcelain Apron Sink + Curved Gooseneck Faucet (middle counter!)
  roundRectGrad(
    ctx,
    cX + 35,
    ctY,
    24,
    13,
    3,
    [
      [0, "#ffffff"],
      [1, "#d9e6eb"],
    ],
    "#546670",
    1.2
  );
  roundRect(ctx, cX + 38, ctY + 2, 18, 9, 2, "#b8dce8");
  drawQuadCurve(ctx, cX + 47, ctY + 2, cX + 47, ctY - 7, cX + 51, ctY - 2, "#d8e3eb", 2.2);
  // Folded red-gingham dish towel draped over cabinet handle!
  roundRect(ctx, cX + 42, ctY + 20, 10, 14, 1.5, "#fff5eb", "#6e2924", 1);
  px(ctx, cX + 43, ctY + 24, 8, 2, "#d9453b");
  px(ctx, cX + 43, ctY + 29, 8, 2, "#d9453b");

  // 6. OVERFLOWING GLASS SNACK JAR + FRESH ROSENFELD'S BAGELS ON CUTTING BOARD!
  // Wooden cutting board with golden seeded bagels
  roundRect(ctx, cX + 63, ctY + 1, 20, 11, 2, "#b5743c", "#42230d", 1);
  ellipseFill(ctx, cX + 69, ctY + 6, 4.5, 3.8, "#e6a245", "#6e3d12", 1.1);
  ellipseFill(ctx, cX + 69, ctY + 6, 1.4, 1.1, "#b5743c");
  ellipseFill(ctx, cX + 77, ctY + 7, 4.2, 3.5, "#f0b454", "#6e3d12", 1.1);
  ellipseFill(ctx, cX + 77, ctY + 7, 1.3, 1.0, "#b5743c");
  // Tall gleaming glass Snack Jar packed with pretzels & cookies + red ribbon!
  roundRectGrad(
    ctx,
    cX + 83,
    ctY - 12,
    16,
    22,
    4,
    [
      [0, "rgba(232, 250, 255, 0.85)"],
      [1, "rgba(182, 224, 236, 0.9)"],
    ],
    "#2f4d57",
    1.3
  );
  // Pretzels & chocolate-chip cookies visible through glass!
  ellipseFill(ctx, cX + 88, ctY + 4, 3.2, 2.8, "#d98236", "#5e2d0d", 0.8);
  ellipseFill(ctx, cX + 94, ctY + 3, 3.2, 2.8, "#e39842", "#5e2d0d", 0.8);
  ellipseFill(ctx, cX + 91, ctY - 1, 3.4, 2.8, "#c7742e", "#5e2d0d", 0.8);
  ellipseFill(ctx, cX + 89, ctY - 5, 3, 2.5, "#edb058", "#5e2d0d", 0.8);
  px(ctx, cX + 85, ctY - 10, 2, 16, "rgba(255, 255, 255, 0.7)"); // glass gleam!
  roundRect(ctx, cX + 84, ctY - 16, 14, 5, 2, "#d9413b", "#4f1311", 1.1); // red lid!

  // 7. Vintage Rounded-Corner Mint Refrigerator with Liam's Crayon Art & Magnets (far right!)
  const frX = cX + cW - 26;
  const frY = 12;
  softShadow(ctx, frX + 15, frY + 74, 16, 6, 0.34);
  roundRectGrad(
    ctx,
    frX,
    frY,
    30,
    74,
    7,
    [
      [0, "#e3f7ef"],
      [0.45, "#b7dfd0"],
      [1, "#7cb09e"],
    ],
    "#1f362e",
    1.8
  );
  // Freezer divider seam & chrome curved handles
  drawLine(ctx, frX + 2, frY + 26, frX + 28, frY + 26, "#4d786a", 1.6);
  roundRect(ctx, frX + 4, frY + 12, 3.5, 11, 1.5, "#ffffff", "#4d6660", 1);
  roundRect(ctx, frX + 4, frY + 32, 3.5, 16, 1.5, "#ffffff", "#4d6660", 1);
  // Kid's colorful crayon drawing pinned with bright magnets!
  roundRect(ctx, frX + 11, frY + 33, 14, 16, 1, "#fffcf5", "#8a8578", 0.8);
  ellipseFill(ctx, frX + 15, frY + 37, 2, 2, "#ffd242"); // crayon sun!
  px(ctx, frX + 13, frY + 42, 10, 5, "#63b868"); // crayon grass!
  px(ctx, frX + 16, frY + 39, 5, 4, "#e05a47"); // crayon house!
  ellipseFill(ctx, frX + 18, frY + 33, 2, 2, "#e84a43"); // red magnet!
  ellipseFill(ctx, frX + 14, frY + 15, 2, 2, "#4a8ce8"); // blue magnet!
  ellipseFill(ctx, frX + 22, frY + 18, 2, 2, "#f5c43d"); // gold magnet!
}

function drawOutfitArmoire(ctx, x, y, w, h) {
  softShadow(ctx, x + w / 2 + 2, y + h + 2, w * 0.54, 7, 0.36);
  // Carved cathedral-arched mahogany wardrobe!
  roundRectGrad(
    ctx,
    x,
    y,
    w,
    h,
    4,
    [
      [0, "#9c5930"],
      [0.5, "#753c1d"],
      [1, "#4a220e"],
    ],
    "#210f08",
    1.8
  );
  // Arched crown pediment at top
  ellipseFill(ctx, x + w / 2, y + 1, w * 0.45, 7, "#8c4d27", "#210f08", 1.5);
  ellipseFill(ctx, x + w / 2, y, w * 0.25, 3, "#c9854f");

  // Left closed beveled panel door
  roundRectGrad(
    ctx,
    x + 4,
    y + 7,
    w / 2 - 5,
    h - 14,
    2,
    [
      [0, "#b06a3b"],
      [1, "#663116"],
    ],
    "#2e150b",
    1.2
  );
  roundRect(ctx, x + 7, y + 11, w / 2 - 11, h - 22, 1.5, "#874823", "#c7804c", 0.9);
  ellipseFill(ctx, x + w / 2 - 3, y + h / 2, 1.8, 2.4, "#f7cf63", "#47290a", 0.8);

  // Right door slightly ajar revealing Liam's hanging colorful adventure outfits!
  roundRect(ctx, x + w / 2 + 1, y + 7, w / 2 - 5, h - 14, 1.5, "#241009");
  // Wooden hanger bar & tiny colorful outfits peeking out (Orange Giants jersey, Teal Wetsuit, Emerald Link tunic!)
  px(ctx, x + w / 2 + 2, y + 12, w / 2 - 7, 2, "#bfa588");
  roundRect(ctx, x + w / 2 + 3, y + 14, 6, 13, 1.5, "#f07224", "#471e08", 0.8);
  roundRect(ctx, x + w / 2 + 7, y + 15, 6, 14, 1.5, "#2699b5", "#0d3845", 0.8);
  roundRect(ctx, x + w / 2 + 11, y + 16, 6, 14, 1.5, "#339947", "#113d1a", 0.8);
  // Ajar swinging right door edge catching golden light
  polyFill(
    ctx,
    [
      [x + w - 4, y + 7],
      [x + w + 5, y + 11],
      [x + w + 5, y + h - 4],
      [x + w - 4, y + h - 7],
    ],
    "#a86234",
    "#261108",
    1.3
  );
  // Bottom carved drawer
  roundRectGrad(
    ctx,
    x + 4,
    y + h - 10,
    w - 8,
    7,
    1.5,
    [
      [0, "#8c4d27"],
      [1, "#542710"],
    ],
    "#261108",
    1
  );
  px(ctx, x + w / 2 - 4, y + h - 7, 8, 2, "#f7cf63");
}

function drawBilliardsDndTable(ctx, x, y, w, h) {
  softShadow(ctx, x + w / 2, y + h + 4, w * 0.54, 11, 0.4);

  // Turned mahogany table legs
  for (const [lx, ly] of [
    [x + 6, y + h - 4],
    [x + w - 12, y + h - 4],
  ]) {
    roundRectGrad(
      ctx,
      lx,
      ly,
      7,
      10,
      2,
      [
        [0, "#753d1e"],
        [1, "#33160a"],
      ],
      "#1c0a04",
      1.3
    );
  }

  // Curved walnut billiard rail bumper frame with inlaid ivory diamond sights!
  roundRectGrad(
    ctx,
    x,
    y,
    w,
    h,
    7,
    [
      [0, "#9e5930"],
      [0.45, "#6b3518"],
      [1, "#3d1b0a"],
    ],
    "#1f0d06",
    2
  );

  // Emerald baize felt with soft overhead pendant-lamp highlight gradient!
  roundRectGrad(
    ctx,
    x + 9,
    y + 9,
    w - 18,
    h - 18,
    3,
    [
      [0, "#1d7a4a"],
      [0.5, "#28995d"],
      [1, "#16613a"],
    ],
    "#0f3d24",
    1.5
  );
  radialGlow(ctx, x + w * 0.5, y + h * 0.45, 4, w * 0.42, [
    [0, "rgba(154, 255, 192, 0.25)"],
    [1, "rgba(20, 90, 50, 0)"],
  ]);

  // Six gleaming brass corner & side pockets!
  for (const [pxC, pyC] of [
    [x + 8, y + 8],
    [x + w / 2, y + 7],
    [x + w - 8, y + 8],
    [x + 8, y + h - 8],
    [x + w / 2, y + h - 7],
    [x + w - 8, y + h - 8],
  ]) {
    ellipseFill(ctx, pxC, pyC, 4.5, 4.5, "#e0b34c", "#42270c", 1);
    ellipseFill(ctx, pxC, pyC, 2.8, 2.8, "#121614");
  }

  // Ivory rail sights along top & bottom bumpers
  for (const sx of [x + w * 0.28, x + w * 0.72]) {
    ellipseFill(ctx, sx, y + 4.5, 1.5, 1.2, "#fff5db");
    ellipseFill(ctx, sx, y + h - 4.5, 1.5, 1.2, "#fff5db");
  }

  // Glossy racked pool balls (with specular highlights!) on right half of table
  const ballCols = ["#f5c43d", "#2e6fd9", "#d93b32", "#7c3fc4", "#eb7d28", "#2b8c48", "#24262e"];
  const rackX = x + w - 34;
  const rackY = y + h / 2 - 4;
  let bi = 0;
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row <= col; row++) {
      const bx = rackX + col * 5.2;
      const by = rackY + (row - col / 2) * 5.6;
      ellipseFill(ctx, bx, by, 2.7, 2.7, ballCols[bi % ballCols.length], "#121614", 0.7);
      ellipseFill(ctx, bx - 0.8, by - 0.8, 0.9, 0.9, "#ffffff");
      bi++;
    }
  }
  // White cue ball + angled tapered cue stick resting across rail!
  ellipseFill(ctx, x + w * 0.44, y + h * 0.46, 2.8, 2.8, "#fffdf5", "#4a524d", 0.8);
  drawLine(ctx, x + w * 0.34, y + h + 5, x + w * 0.82, y - 5, "#d9a264", 2.8);
  drawLine(ctx, x + w * 0.34, y + h + 5, x + w * 0.48, y + h * 0.65, "#4f2512", 3.4);
  ellipseFill(ctx, x + w * 0.82, y - 5, 1.6, 1.6, "#4ca6ff"); // blue cue chalk tip!

  // Tabletop D&D Campaign Corner (parchment dungeon map + gilded spellbook + glowing D20!)
  const dX = x + 15;
  const dY = y + h - 32;
  roundRect(ctx, dX, dY, 26, 20, 2, "#f2dfb8", "#6e4e26", 1.1);
  // Tiny hand-drawn dungeon rooms & grid on parchment!
  px(ctx, dX + 4, dY + 4, 8, 6, "#d4bc8c");
  px(ctx, dX + 14, dY + 8, 8, 8, "#d4bc8c");
  drawLine(ctx, dX + 12, dY + 7, dX + 14, dY + 11, "#7a5328", 1.2);
  // Open crimson & gold D&D Spellbook beside map
  roundRectGrad(
    ctx,
    dX + 2,
    dY - 12,
    22,
    13,
    2,
    [
      [0, "#9e2d2d"],
      [1, "#5c1518"],
    ],
    "#f2c65e",
    1.2
  );
  px(ctx, dX + 5, dY - 10, 7, 9, "#fff6de");
  px(ctx, dX + 13, dY - 10, 7, 9, "#f5e8c6");
  // Faceted glowing cyan D20 die!
  polyFill(
    ctx,
    [
      [dX + 28, dY + 2],
      [dX + 33, dY + 5],
      [dX + 31, dY + 10],
      [dX + 25, dY + 10],
      [dX + 23, dY + 5],
    ],
    "#5ce0ff",
    "#184a70",
    1
  );
}

function drawSculptedHeroStatue(ctx, sx, sy, arch) {
  softShadow(ctx, sx + 16, sy + 28, 16, 7, 0.42);
  // Stepped chiseled obsidian & granite pedestal with engraved golden plaque!
  roundRectGrad(
    ctx,
    sx,
    sy + 14,
    32,
    18,
    3,
    [
      [0, "#7c859e"],
      [0.5, "#4c5369"],
      [1, "#2a2e3d"],
    ],
    "#11131c",
    1.6
  );
  roundRectGrad(
    ctx,
    sx + 3,
    sy + 10,
    26,
    7,
    2,
    [
      [0, "#a8b2cc"],
      [1, "#626b85"],
    ],
    "#11131c",
    1.2
  );
  roundRect(ctx, sx + 8, sy + 21, 16, 6, 1.2, arch.gem, "#ffe082", 1);

  const cx = sx + 16;
  const baseY = sy + 11;

  if (arch.id === "bard") {
    // Flowing emerald bard cloak + sculpted bronze torso + feathered cap + curved acoustic lute!
    polyFill(
      ctx,
      [
        [cx - 9, baseY],
        [cx - 6, baseY - 17],
        [cx + 6, baseY - 17],
        [cx + 10, baseY],
      ],
      "#29824d",
      "#0e2e1b",
      1.4
    );
    roundRectGrad(
      ctx,
      cx - 6,
      baseY - 18,
      12,
      15,
      3,
      [
        [0, "#59c47c"],
        [1, "#236b3e"],
      ],
      "#0e2e1b",
      1.2
    );
    // Head + tilted emerald Robin-Hood feathered cap!
    ellipseFill(ctx, cx, baseY - 23, 5.5, 5.5, "#e0e4f0", "#1b2030", 1.3);
    polyFill(
      ctx,
      [
        [cx - 8, baseY - 25],
        [cx + 1, baseY - 34],
        [cx + 8, baseY - 25],
      ],
      "#36a85c",
      "#0e2e1b",
      1.3
    );
    drawQuadCurve(ctx, cx + 4, baseY - 31, cx + 12, baseY - 37, cx + 11, baseY - 26, "#ffe066", 2.2); // golden feather!
    // Carved wooden lute with golden sound-hole & strings
    ellipseFill(ctx, cx + 6, baseY - 9, 5.5, 6.2, "#c7813c", "#3b1e0a", 1.2);
    ellipseFill(ctx, cx + 6, baseY - 9, 1.8, 1.8, "#3b1e0a");
    drawLine(ctx, cx + 6, baseY - 14, cx + 11, baseY - 24, "#8a4f20", 2.5);
  } else if (arch.id === "wizard") {
    // Starry sapphire wizard robes + lush snowy beard + pointed star hat + glowing crystal oak staff!
    polyFill(
      ctx,
      [
        [cx - 10, baseY],
        [cx - 6, baseY - 19],
        [cx + 6, baseY - 19],
        [cx + 10, baseY],
      ],
      "#2e68bd",
      "#102145",
      1.4
    );
    px(ctx, cx - 2, baseY - 16, 4, 15, "#f2c65e"); // gold robe trim
    ellipseFill(ctx, cx, baseY - 23, 5.2, 5.2, "#e0e4f0", "#1b2030", 1.2);
    // Flowing curved white wizard beard!
    polyFill(
      ctx,
      [
        [cx - 5, baseY - 21],
        [cx + 5, baseY - 21],
        [cx + 3, baseY - 10],
        [cx, baseY - 7],
        [cx - 3, baseY - 10],
      ],
      "#ffffff",
      "#6f7e9c",
      1
    );
    // Tall pointed starry sapphire wizard hat!
    ellipseFill(ctx, cx, baseY - 26, 9, 2.8, "#1e4b94", "#0e1d3d", 1.2);
    polyFill(
      ctx,
      [
        [cx - 6.5, baseY - 26],
        [cx + 2, baseY - 40],
        [cx + 6.5, baseY - 26],
      ],
      "#2e68bd",
      "#0e1d3d",
      1.3
    );
    ellipseFill(ctx, cx - 1, baseY - 31, 1.4, 1.4, "#ffe46b");
    ellipseFill(ctx, cx + 2, baseY - 35, 1.2, 1.2, "#ffe46b");
    // Gnarled oak staff topped with glowing cyan crystal orb!
    drawLine(ctx, cx + 10, baseY, cx + 10, baseY - 30, "#754724", 2.8);
    ellipseFill(ctx, cx + 10, baseY - 32, 4.2, 4.2, "#5ce0ff", "#1c548a", 1.2);
    ellipseFill(ctx, cx + 9, baseY - 33.5, 1.6, 1.6, "#ffffff");
  } else {
    // Eldritch Knight in gleaming plate armor, crimson crest plume, kite shield & arcane broadsword!
    roundRectGrad(
      ctx,
      cx - 8,
      baseY - 19,
      16,
      19,
      3,
      [
        [0, "#c8d4eb"],
        [0.5, "#8996b5"],
        [1, "#4d566e"],
      ],
      "#161a26",
      1.4
    );
    // Crested steel knight helm with crimson plume!
    roundRectGrad(
      ctx,
      cx - 6,
      baseY - 30,
      12,
      12,
      4,
      [
        [0, "#e6eeff"],
        [1, "#7b88a8"],
      ],
      "#161a26",
      1.3
    );
    px(ctx, cx - 4, baseY - 25, 8, 2.2, "#141824"); // visor slit
    polyFill(
      ctx,
      [
        [cx - 2, baseY - 30],
        [cx + 2, baseY - 39],
        [cx + 8, baseY - 32],
        [cx + 3, baseY - 29],
      ],
      "#d93838",
      "#4f1111",
      1.2
    );
    // Ornate kite shield with gold dragon crest
    polyFill(
      ctx,
      [
        [cx - 14, baseY - 18],
        [cx - 3, baseY - 18],
        [cx - 3, baseY - 7],
        [cx - 8.5, baseY - 1],
        [cx - 14, baseY - 7],
      ],
      "#b82e2e",
      "#f2c65e",
      1.5
    );
    ellipseFill(ctx, cx - 8.5, baseY - 11, 2.5, 3, "#ffe078");
    // Raised enchanted broadsword gleaming with ruby/silver edge!
    drawLine(ctx, cx + 11, baseY - 12, cx + 11, baseY - 34, "#e8f4ff", 3);
    drawLine(ctx, cx + 7, baseY - 13, cx + 15, baseY - 13, "#f2c65e", 2.6);
    ellipseFill(ctx, cx + 11, baseY - 9, 2, 2, "#eb4444");
  }
}

function drawTreasureChest32(ctx, bx, by, w, h, { opened, locked, goldTheme = true }) {
  softShadow(ctx, bx + w / 2, by + h + 3, w * 0.56, 8, 0.44);
  const bodyStops = goldTheme
    ? [[0, "#f5cc58"], [0.5, "#c78c24"], [1, "#784c0e"]]
    : locked
      ? [[0, "#6e7894"], [0.5, "#464d63"], [1, "#272b3b"]]
      : [[0, "#9c5ee0"], [0.5, "#6b32ab"], [1, "#3d1869"]];
  const trimCol = goldTheme ? "#fff2a6" : locked ? "#75baff" : "#f5cf64";

  // Domed chest lid
  roundRectGrad(ctx, bx, by, w, h * 0.48, 6, bodyStops, "#1b1008", 1.8);
  // Chest lower body
  roundRectGrad(ctx, bx + 2, by + h * 0.42, w - 4, h * 0.58, 3, bodyStops, "#1b1008", 1.8);
  // Ornamental vertical iron/gold strapping bands
  px(ctx, bx + 9, by + 2, 5, h - 4, trimCol);
  px(ctx, bx + w - 14, by + 2, 5, h - 4, trimCol);
  px(ctx, bx + 2, by + h * 0.42, w - 4, 3.5, "#1b1008");

  if (opened) {
    // Glowing golden treasure radiance spilling out from popped lid!
    fillLinearGrad(ctx, bx + 5, by + h * 0.32, w - 10, 10, [
      [0, "#fffbe0"],
      [0.5, "#ffe066"],
      [1, "#e89b24"],
    ]);
  }
  // Ornate center clasp lock
  roundRect(ctx, bx + w / 2 - 6, by + h * 0.34, 12, 12, 2.5, trimCol, "#291808", 1.3);
  ellipseFill(ctx, bx + w / 2, by + h * 0.34 + 6, 2.4, 2.4, locked ? "#42a4ff" : "#291808");

  if (locked) {
    // Shimmering cerulean arcane rune chains locking the chest!
    drawQuadCurve(ctx, bx + 2, by + 4, bx + w / 2, by + h * 0.55, bx + w - 2, by + 4, "#66ccff", 2.4);
    drawQuadCurve(ctx, bx + 2, by + h - 4, bx + w / 2, by + h * 0.35, bx + w - 2, by + h - 4, "#66ccff", 2.4);
  }
}

// ============================================================================
// Main Static 2x HD Room Baker
// ============================================================================

/**
 * Bake a lush 2x HD (32px per tile) 32-bit pixel-art offscreen canvas for any Home Base room!
 */
export function bake32BitInteriorCanvas(roomId, state = {}) {
  const room = INTERIOR_ROOMS[roomId] || INTERIOR_ROOMS.main_floor;
  const S = TILE_SIZE * 2; // 32 native pixels per logical 16px tile!
  const W = room.width * S;
  const H = room.height * S;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.__pixelScale = 0.5;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const O = "#241512";

  if (room.id === "main_floor") {
    // 1. Atmospheric dark-walnut architectural cut-away surround
    fillLinearGrad(ctx, 0, 0, W, H, [
      [0, "#1c1210"],
      [0.5, "#261814"],
      [1, "#140c0a"],
    ]);
    roundRectGrad(
      ctx,
      8,
      8,
      W - 16,
      H - 16,
      6,
      [
        [0, "#4a2c1e"],
        [1, "#2b1710"],
      ],
      "#140b08",
      2
    );

    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    const wallTop = 10;
    const wallBot = 2 * S;
    const floorTop = 2 * S;
    const floorBot = (room.height - 1) * S;

    // 2. Warm New England Striped Cream Wallpaper + Carved Crown Molding & Recessed Wainscoting!
    fillLinearGrad(ctx, wallX, wallTop, wallW, wallBot - wallTop, [
      [0, "#f5e8ce"],
      [0.7, "#ebdab8"],
      [1, "#d9c29c"],
    ]);
    for (let sx = wallX; sx < wallX + wallW; sx += 14) {
      px(ctx, sx, wallTop + 8, 5, wallBot - wallTop - 26, "rgba(204, 174, 128, 0.34)");
    }
    // Layered crown molding along top ceiling edge
    fillLinearGrad(ctx, wallX, wallTop, wallW, 9, [
      [0, "#4d2a18"],
      [0.5, "#945a33"],
      [0.85, "#c98b55"],
      [1, "#4d2a18"],
    ]);
    px(ctx, wallX, wallTop + 9, wallW, 3, "rgba(38, 18, 10, 0.22)");

    // Carved chair-rail & beveled colonial wood wainscoting panels!
    fillLinearGrad(ctx, wallX, wallBot - 22, wallW, 5, [
      [0, "#d4985f"],
      [0.6, "#8c512a"],
      [1, "#4d2a15"],
    ]);
    fillLinearGrad(ctx, wallX, wallBot - 17, wallW, 17, [
      [0, "#e6d2b0"],
      [1, "#c7ad83"],
    ]);
    for (let wx = wallX + 6; wx < wallX + wallW - 18; wx += 24) {
      roundRectGrad(
        ctx,
        wx,
        wallBot - 14,
        18,
        10,
        1.5,
        [
          [0, "#bfa175"],
          [1, "#f2e2c4"],
        ],
        "#997b50",
        1
      );
    }
    fillLinearGrad(ctx, wallX, wallBot - 4, wallW, 4, [
      [0, "#754325"],
      [1, "#3b1f10"],
    ]);

    // Cut-away side & south interior cross-section walls with warm bevel highlights
    fillLinearGrad(ctx, wallX - 10, wallTop, 10, floorBot - wallTop + 10, [[0, "#3b2014"], [0.6, "#6e3e24"], [1, "#9c5c36"]], false);
    fillLinearGrad(ctx, wallX + wallW, wallTop, 10, floorBot - wallTop + 10, [[0, "#9c5c36"], [0.4, "#6e3e24"], [1, "#3b2014"]], false);
    fillLinearGrad(ctx, wallX - 10, floorBot, wallW + 20, 12, [[0, "#9c5c36"], [0.45, "#61351e"], [1, "#2b150c"]]);

    // 3. Staggered Honey-Oak Hardwood Floorboards (rich multi-tone grain, knots & nails!)
    drawHardwoodFloor(ctx, wallX, floorTop, wallW, floorBot - floorTop, {
      baseDark: "#9e612e",
      baseMid: "#c78648",
      seam: "#693a1a",
      grain: "rgba(130, 70, 26, 0.34)",
      knot: "rgba(92, 46, 18, 0.45)",
      nail: "#4d2712",
      planks: [
        ["#d99c5b", "#c98849", "#b37236", "#f0be7d"],
        ["#cf904e", "#bf7d3f", "#a6672d", "#e8b372"],
        ["#e0a463", "#cf8f50", "#b8783c", "#f5c889"],
        ["#c78544", "#b57438", "#9c5e28", "#e0a969"],
      ],
    });

    // Deep soft Ambient Occlusion shadow cast along north & side walls onto floor!
    fillLinearGrad(ctx, wallX, floorTop, wallW, 14, [
      [0, "rgba(32, 14, 8, 0.34)"],
      [0.5, "rgba(32, 14, 8, 0.14)"],
      [1, "rgba(32, 14, 8, 0)"],
    ]);
    fillLinearGrad(ctx, wallX, floorTop, 10, floorBot - floorTop, [
      [0, "rgba(32, 14, 8, 0.24)"],
      [1, "rgba(32, 14, 8, 0)"],
    ], false);
    fillLinearGrad(ctx, wallX + wallW - 10, floorTop, 10, floorBot - floorTop, [
      [0, "rgba(32, 14, 8, 0)"],
      [1, "rgba(32, 14, 8, 0.24)"],
    ], false);

    // 4. Farmhouse Kitchen Zone (checkered tiles, subway backsplash, shaker cabinets, fridge & Snack Jar!)
    drawFarmhouseKitchen(ctx, S);

    // 5. Ornate Woven Persian Medallion Rug with Cream Tassels!
    drawPersianRug(ctx, 5 * S + 14, 4 * S + 6, 8 * S - 28, 5 * S - 12);

    // 6. Sunlit 6-Pane Colonial Windows with Autumn Foliage & Forest-Green Curtains!
    drawColonialWindow(ctx, 6 * S + 4, 17);
    drawColonialWindow(ctx, 12 * S + 2, 17);

    // Framed Team Giants #7 Baseball Jersey Shadowbox on north-left wall!
    px(ctx, 2 * S + 7, 21, 24, 26, "rgba(32, 14, 8, 0.25)");
    roundRectGrad(
      ctx,
      2 * S + 5,
      19,
      24,
      26,
      2,
      [
        [0, "#f0c259"],
        [1, "#9c6a1f"],
      ],
      O,
      1.5
    );
    px(ctx, 2 * S + 9, 23, 16, 18, "#213245");
    roundRect(ctx, 2 * S + 13, 26, 8, 12, 1.5, "#faf4e6");
    px(ctx, 2 * S + 10, 26, 4, 5, "#f06a1a");
    px(ctx, 2 * S + 20, 26, 4, 5, "#f06a1a");
    px(ctx, 2 * S + 15, 29, 4, 1.5, "#f06a1a"); // tiny #7!
    px(ctx, 2 * S + 17, 30, 1.8, 5, "#f06a1a");

    // 7. Suspicious Mahogany Bookshelf (slides aside smoothly to reveal lantern-lit secret attic stairs!)
    const bsShift = state.bookshelfOpened ? -32 : 0;
    drawMahoganyBookshelf(ctx, 3 * S + bsShift, 1 * S - 2, 3 * S, 64, state.bookshelfOpened);

    // 8. Artisanal River-Stone Fireplace & Carved Oak Mantel!
    drawRiverStoneFireplace(ctx, 8 * S, 12, 4 * S, 2 * S + 16);

    // 9. Carved Mahogany Wardrobe / Outfit Armoire (left wall, x=2, y=5..6)
    drawOutfitArmoire(ctx, 2 * S + 3, 4 * S + 16, 36, 74);

    // 10. Plush Tufted Living-Room Sofa + Brass Reading Floor Lamp (center, x=8..11, y=5)
    drawFloorLamp(ctx, 7 * S + 22, 5 * S + 8);
    drawPlushSofa(ctx, 8 * S + 2, 5 * S + 2, 4 * S - 4, 34);

    // 11. Championship Billiards Pool Table & Tabletop D&D Corner (bottom-right, x=14..16, y=7..8)
    drawBilliardsDndTable(ctx, 14 * S - 2, 7 * S - 4, 3 * S + 6, 2 * S + 6);

    // 12. Lush Potted Fiddle-Leaf Fig Houseplants framing the living room corners!
    drawPottedPlant(ctx, 2 * S + 20, 3 * S + 24, 1.05);
    drawPottedPlant(ctx, 17 * S + 16, 6 * S + 4, 1.0);
    drawPottedPlant(ctx, 2 * S + 22, 9 * S + 18, 0.95);

    // 13. Cozy Entryway Welcome Mat, Neatly Lined-Up Sneakers & Brass Umbrella Stand (bottom center!)
    const dmX = 9 * S - 8;
    const dmY = 10 * S + 2;
    softShadow(ctx, dmX + 32, dmY + 14, 32, 10, 0.25);
    ellipseFill(ctx, dmX + 32, dmY + 13, 30, 11, "#9c5626", "#42200c", 1.5);
    ellipseFill(ctx, dmX + 32, dmY + 13, 25, 8, "#d69449", "#783f18", 1.2);
    ellipseFill(ctx, dmX + 32, dmY + 13, 18, 5, "#edd08c");
    // Tiny pair of kid sneakers neatly parked beside the front door!
    roundRect(ctx, dmX - 18, dmY + 10, 8, 5, 2, "#326eb8", "#172d4d", 1);
    px(ctx, dmX - 18, dmY + 14, 8, 1.5, "#ffffff");
    roundRect(ctx, dmX - 18, dmY + 17, 8, 5, 2, "#326eb8", "#172d4d", 1);
    px(ctx, dmX - 18, dmY + 21, 8, 1.5, "#ffffff");
    // Brass umbrella stand with colorful umbrella on right of door
    ellipseFill(ctx, dmX + 74, dmY + 18, 6, 3, "#a87928", "#3b2509", 1);
    roundRectGrad(ctx, dmX + 69, dmY + 5, 10, 13, 2, [[0, "#f0c659"], [1, "#8f611b"]], "#3b2509", 1.1);
    drawLine(ctx, dmX + 74, dmY + 6, dmX + 77, dmY - 4, "#d9453b", 2.5);
    drawQuadCurve(ctx, dmX + 77, dmY - 4, dmX + 81, dmY - 6, dmX + 80, dmY - 1, "#6e3b19", 1.6);

    // 14. Warm baked radial glow pools from fireplace & floor lamp (ambient richness!)
    radialGlow(ctx, 10 * S, 3 * S + 10, 8, 95, [
      [0, "rgba(255, 178, 86, 0.22)"],
      [0.55, "rgba(255, 146, 62, 0.08)"],
      [1, "rgba(255, 120, 40, 0)"],
    ]);
    radialGlow(ctx, 7 * S + 22, 5 * S - 6, 6, 64, [
      [0, "rgba(255, 232, 148, 0.22)"],
      [0.6, "rgba(255, 204, 102, 0.08)"],
      [1, "rgba(255, 190, 80, 0)"],
    ]);
    // Subtle dark cozy interior edge vignette
    fillLinearGrad(ctx, wallX, floorBot - 18, wallW, 18, [
      [0, "rgba(20, 8, 6, 0)"],
      [1, "rgba(20, 8, 6, 0.22)"],
    ]);
    return canvas;
  }

  if (room.id === "upstairs_nook") {
    // Cozy Timber-Raftered Attic Reading Loft bathed in Twilight Moonlight & Fairy Lights!
    fillLinearGrad(ctx, 0, 0, W, H, [
      [0, "#17111a"],
      [0.5, "#24171e"],
      [1, "#120c12"],
    ]);
    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    const floorTop = 2 * S;
    const floorBot = (room.height - 1) * S;

    // Sloped knotty-pine cathedral ceiling & timber A-frame beams!
    fillLinearGrad(ctx, wallX, 10, wallW, floorTop - 10, [
      [0, "#3b2318"],
      [0.5, "#6b4128"],
      [1, "#8f5a38"],
    ]);
    for (let rx = wallX; rx < wallX + wallW; rx += 40) {
      fillLinearGrad(ctx, rx, 10, 9, floorTop - 10, [
        [0, "#3d2013"],
        [0.5, "#784426"],
        [1, "#3d2013"],
      ], false);
    }
    fillLinearGrad(ctx, wallX, floorTop - 6, wallW, 6, [[0, "#a86c40"], [1, "#452412"]]);
    // Cut-away timber border frame
    fillLinearGrad(ctx, wallX - 10, 10, 10, floorBot, [[0, "#331b11"], [1, "#7d4a2b"]], false);
    fillLinearGrad(ctx, wallX + wallW, 10, 10, floorBot, [[0, "#7d4a2b"], [1, "#331b11"]], false);
    fillLinearGrad(ctx, wallX - 10, floorBot, wallW + 20, 12, [[0, "#7d4a2b"], [1, "#29140c"]]);

    // Warm Golden-Pine Attic Floorboards
    drawHardwoodFloor(ctx, wallX, floorTop, wallW, floorBot - floorTop, {
      baseDark: "#8a562a",
      baseMid: "#b57a44",
      seam: "#593317",
      grain: "rgba(115, 62, 24, 0.34)",
      knot: "rgba(84, 42, 16, 0.5)",
      nail: "#3d200e",
      planks: [
        ["#cfa069", "#ba8850", "#9c6d3b", "#e6bc85"],
        ["#c4945e", "#ad7b45", "#916233", "#dbb079"],
        ["#d9ab73", "#c4945c", "#a67642", "#f0c892"],
      ],
    }, 9, 44);
    fillLinearGrad(ctx, wallX, floorTop, wallW, 14, [
      [0, "rgba(22, 12, 18, 0.34)"],
      [1, "rgba(22, 12, 18, 0)"],
    ]);

    // Panoramic Twilight Dormer Skylight showing Starry Newton Night Sky & Glowing Crescent Moon!
    const skX = 6 * S + 14;
    const skY = 12;
    const skW = 3 * S + 4;
    const skH = 44;
    roundRectGrad(ctx, skX - 4, skY - 3, skW + 8, skH + 6, 4, [[0, "#b87948"], [1, "#542e18"]], O, 1.8);
    fillLinearGrad(ctx, skX, skY, skW, skH, [
      [0, "#0e1530"],
      [0.55, "#1f2e5c"],
      [1, "#454a80"],
    ]);
    // Glowing crescent moon + soft silver halo!
    radialGlow(ctx, skX + 24, skY + 17, 2, 18, [
      [0, "rgba(255, 248, 200, 0.55)"],
      [1, "rgba(160, 190, 255, 0)"],
    ]);
    ellipseFill(ctx, skX + 24, skY + 17, 7, 7, "#fff7c4");
    ellipseFill(ctx, skX + 27, skY + 15, 6.2, 6.2, "#19264d");
    // Distant silhouetted pine treetops at bottom of skylight
    for (let tx = skX + 6; tx < skX + skW - 4; tx += 12) {
      polyFill(ctx, [[tx, skY + skH], [tx + 6, skY + skH - 12 - (tx % 5)], [tx + 12, skY + skH]], "#10182e");
    }
    // Skylight timber mullions
    px(ctx, skX + skW / 2 - 1.5, skY, 3, skH, "#754424");
    px(ctx, skX, skY + skH * 0.55, skW, 2.5, "#754424");

    // Soft moonlight wash pooled across the attic rug!
    radialGlow(ctx, 8 * S, 4 * S + 16, 12, 95, [
      [0, "rgba(182, 212, 255, 0.24)"],
      [0.65, "rgba(148, 178, 240, 0.08)"],
      [1, "rgba(120, 150, 220, 0)"],
    ]);

    // Cozy Braided Oval Patchwork Reading Rug!
    const rugCx = 8 * S;
    const rugCy = 5 * S + 14;
    softShadow(ctx, rugCx + 2, rugCy + 3, 122, 64, 0.24);
    ellipseFill(ctx, rugCx, rugCy, 120, 62, "#59223a", "#2b0e1c", 1.6);
    ellipseFill(ctx, rugCx, rugCy, 110, 54, "#8c354c", "#e6b450", 1.5);
    ellipseFill(ctx, rugCx, rugCy, 94, 44, "#2d5e54", "#f5d478", 1.4);
    ellipseFill(ctx, rugCx, rugCy, 74, 33, "#3b7568", "#e8b44c", 1.2);
    ellipseFill(ctx, rugCx, rugCy, 48, 20, "#a83c3c", "#fae08c", 1.2);
    ellipseFill(ctx, rugCx, rugCy, 24, 10, "#e6b450");

    // Left & Right Low Attic Bookcases overflowing with storybooks + brass stargazing spyglass!
    drawMahoganyBookshelf(ctx, 2 * S + 4, 1 * S + 6, 3 * S - 8, 52, false);
    drawMahoganyBookshelf(ctx, 11 * S + 4, 1 * S + 6, 3 * S - 8, 52, false);
    // Brass stargazing tripod spyglass by the skylight!
    const spX = 10 * S + 12;
    const spY = 3 * S + 2;
    drawLine(ctx, spX, spY, spX - 6, spY + 14, "#5c341b", 2);
    drawLine(ctx, spX, spY, spX + 6, spY + 14, "#5c341b", 2);
    drawLine(ctx, spX, spY, spX, spY + 15, "#5c341b", 2);
    drawLine(ctx, spX - 7, spY + 2, spX + 9, spY - 9, "#e6b84c", 4.5);
    drawLine(ctx, spX - 5, spY + 1, spX + 8, spY - 8, "#fff0a6", 1.5);

    // Plush Rounded Crimson Corduroy Beanbag Chair + Book Stack + Cocoa Mug (bottom-right!)
    const bbX = 12 * S + 28;
    const bbY = 6 * S + 16;
    softShadow(ctx, bbX, bbY + 14, 28, 12, 0.36);
    ellipseFill(ctx, bbX, bbY, 27, 20, "#9c2832", "#3b0c12", 1.8);
    ellipseFill(ctx, bbX - 2, bbY - 4, 21, 14, "#cc3d49");
    ellipseFill(ctx, bbX - 4, bbY - 7, 13, 8, "#e8646e");
    // Stitched corduroy seam lines
    drawQuadCurve(ctx, bbX - 18, bbY - 12, bbX, bbY - 2, bbX + 18, bbY - 12, "#6e1922", 1.2);
    // Cozy yellow star throw pillow nestled on beanbag
    roundRectGrad(ctx, bbX - 12, bbY - 10, 14, 11, 4, [[0, "#ffe478"], [1, "#c78b24"]], "#4f2e08", 1.1);
    // Leaning stack of colorful reading books & steaming cocoa mug beside beanbag!
    roundRect(ctx, 11 * S + 6, 7 * S + 4, 18, 6, 1.5, "#3b75bd", "#152d4d", 1);
    roundRect(ctx, 11 * S + 8, 7 * S - 1, 15, 6, 1.5, "#d99c2b", "#4f3208", 1);
    roundRect(ctx, 11 * S + 10, 7 * S - 6, 12, 5, 1.5, "#3a9454", "#123b1e", 1);

    // Glowing Gilded Golden D20 Treasure Chest on a Crimson Velvet Runner (center-north x=7..8, y=3)!
    roundRect(ctx, 7 * S - 6, 3 * S - 6, 2 * S + 12, S + 22, 3, "#781d26", "#f2c65e", 1.4);
    drawTreasureChest32(ctx, 7 * S + 2, 3 * S - 10, 2 * S - 4, 38, {
      opened: state.d20ChestOpened,
      locked: false,
      goldTheme: true,
    });

    // Recessed Timber-Railed Stairs Going Back Downstairs (bottom-left x=3, y=8)
    const sdX = 2 * S + 16;
    const sdY = 7 * S + 18;
    roundRectGrad(ctx, sdX, sdY, 54, 36, 4, [[0, "#1c0e08"], [1, "#3b2114"]], "#9e6336", 2);
    for (let st = 0; st < 5; st++) {
      fillLinearGrad(ctx, sdX + 4, sdY + 4 + st * 6, 46, 5, [
        [0, "#c78b4e"],
        [1, "#7d4b24"],
      ]);
      px(ctx, sdX + 16, sdY + 4 + st * 6, 22, 5, "#a62e29");
    }
    // Curved string wire for attic fairy lights (bulbs animated in overlay!)
    drawQuadCurve(ctx, wallX + 6, 46, wallX + wallW * 0.25, 62, wallX + wallW * 0.5, 48, "#291a14", 1.5);
    drawQuadCurve(ctx, wallX + wallW * 0.5, 48, wallX + wallW * 0.75, 62, wallX + wallW - 6, 46, "#291a14", 1.5);
    return canvas;
  }

  if (room.id === "dnd_basement") {
    // 32-Bit D&D Basement Dungeon Sanctum (Mossy Flagstones, Gothic Ashlar Masonry, Tapestries & Statues!)
    fillLinearGrad(ctx, 0, 0, W, H, [
      [0, "#0b0d17"],
      [0.5, "#141829"],
      [1, "#080912"],
    ]);
    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    const floorTop = 2 * S;
    const floorBot = (room.height - 1) * S;

    // 1. Towering Carved Gothic Ashlar Dungeon North Wall + Arched Alcoves!
    fillLinearGrad(ctx, wallX, 10, wallW, floorTop - 10, [
      [0, "#242a40"],
      [0.6, "#363e5c"],
      [1, "#22273b"],
    ]);
    for (let by = 12; by < floorTop - 4; by += 12) {
      const off = ((by / 12) | 0) % 2 === 0 ? 0 : 14;
      for (let bx = wallX + off; bx < wallX + wallW - 10; bx += 28) {
        const bw = Math.min(26, wallX + wallW - bx - 2);
        roundRectGrad(
          ctx,
          bx,
          by,
          bw,
          10,
          2,
          [
            [0, "#505a7d"],
            [0.55, "#3a425e"],
            [1, "#262b40"],
          ],
          "#171b29",
          1
        );
      }
    }
    // Cut-away stone masonry side & bottom walls
    fillLinearGrad(ctx, wallX - 10, 10, 10, floorBot, [[0, "#171a29"], [1, "#485170"]], false);
    fillLinearGrad(ctx, wallX + wallW, 10, 10, floorBot, [[0, "#485170"], [1, "#171a29"]], false);
    fillLinearGrad(ctx, wallX - 10, floorBot, wallW + 20, 12, [[0, "#485170"], [1, "#171a29"]]);

    // Ornate Crimson & Gold Heraldic Tapestries draped along north dungeon wall!
    for (const tx of [5, 11]) {
      const rx = tx * S + 8;
      px(ctx, rx - 3, 14, 24, 3, "#e0b34c");
      polyFill(
        ctx,
        [
          [rx, 17],
          [rx + 18, 17],
          [rx + 18, 48],
          [rx + 9, 56],
          [rx, 48],
        ],
        "#94232c",
        "#e0b34c",
        1.5
      );
      polyFill(
        ctx,
        [
          [rx + 9, 24],
          [rx + 14, 32],
          [rx + 9, 40],
          [rx + 4, 32],
        ],
        "#f2c65e"
      );
    }

    // Iron Wall Torch Sconces (roaring flames & warm light pools rendered in animated overlay!)
    for (const tx of [3, 7, 11, 14]) {
      const fx = tx * S + 14;
      roundRect(ctx, fx - 4, 26, 8, 18, 2, "#32374a", "#11131c", 1.2);
      roundRect(ctx, fx - 7, 22, 14, 6, 2, "#4e5570", "#11131c", 1.2);
    }

    // 2. Hand-Cut Beveled Mossy Dungeon Flagstones!
    for (let ty = 2; ty < room.height - 1; ty++) {
      for (let tx = 2; tx < room.width - 2; tx++) {
        const fx = tx * S;
        const fy = ty * S;
        const hsh = (tx * 31 + ty * 17) & 7;
        const topC = hsh % 3 === 0 ? "#464e6b" : hsh % 2 === 0 ? "#3c435e" : "#343b54";
        const botC = hsh % 3 === 0 ? "#2d3347" : "#24293b";
        roundRectGrad(
          ctx,
          fx + 1,
          fy + 1,
          S - 2,
          S - 2,
          3,
          [
            [0, topC],
            [1, botC],
          ],
          "#141724",
          1.2
        );
        // Subtle stone crack or damp moss tuft tucked in mortar corner!
        if (hsh === 1 || hsh === 6) {
          drawLine(ctx, fx + 7, fy + 8, fx + 15, fy + 16, "#1f2333", 1);
          drawLine(ctx, fx + 15, fy + 16, fx + 12, fy + 22, "#1f2333", 1);
        }
        if ((tx + ty * 3) % 5 === 0) {
          ellipseFill(ctx, fx + 5, fy + S - 5, 4, 2.5, "#366e4a");
          ellipseFill(ctx, fx + 4, fy + S - 6, 2.2, 1.4, "#579e65");
        }
      }
    }
    fillLinearGrad(ctx, wallX, floorTop, wallW, 16, [
      [0, "rgba(8, 10, 18, 0.5)"],
      [1, "rgba(8, 10, 18, 0)"],
    ]);

    // 3. Carved Floor Arcane Energy Conduits connecting the 3 Switches straight up to the Vault Chest!
    const conduitSpecs = [
      { sx: 4 * S + 16, sy: 6 * S + 16, lit: state.switchLit?.[0], glow: "#42e88a", dim: "#1b332a" },
      { sx: 9 * S + 16, sy: 6 * S + 16, lit: state.switchLit?.[1], glow: "#4cb8ff", dim: "#1b2842" },
      { sx: 13 * S + 16, sy: 6 * S + 16, lit: state.switchLit?.[2], glow: "#ff5c5c", dim: "#3b1c24" },
    ];
    for (const cd of conduitSpecs) {
      const col = cd.lit ? cd.glow : cd.dim;
      const wLine = cd.lit ? 4 : 3;
      drawLine(ctx, cd.sx, cd.sy, cd.sx, 5 * S + 6, col, wLine);
      drawLine(ctx, cd.sx, 5 * S + 6, 9 * S, 5 * S + 6, col, wLine);
      drawLine(ctx, 9 * S, 5 * S + 6, 9 * S, 3 * S + 10, col, wLine);
    }

    // 4. Stepped Obsidian Dais + Jeweled Arcane Treasure Chest (Bag of Holding!) at north center!
    const bx = 8 * S;
    const by = 2 * S - 6;
    roundRectGrad(ctx, bx - 12, by + 22, 2 * S + 24, 26, 4, [[0, "#4d386e"], [1, "#241938"]], "#110c1c", 1.6);
    roundRect(ctx, bx - 6, by + 26, 2 * S + 12, 18, 2, "#612c47", "#e0b34c", 1.2);
    drawTreasureChest32(ctx, bx, by, 2 * S, 38, {
      opened: state.bagChestOpened,
      locked: !state.dndSolved,
      goldTheme: state.bagChestOpened,
    });

    // 5. Three Sculpted 32-Bit Hero Statues (Halfling Bard, Gnome Wizard, Eldritch Knight!)
    drawSculptedHeroStatue(ctx, 4 * S, 3 * S - 6, { id: "bard", gem: "#42e88a" });
    drawSculptedHeroStatue(ctx, 9 * S, 3 * S - 6, { id: "wizard", gem: "#4cb8ff" });
    drawSculptedHeroStatue(ctx, 13 * S, 3 * S - 6, { id: "knight", gem: "#ff5c5c" });

    // 6. Ornate Carved Octagonal Arcane Rune Floor Switches (Emerald -> Sapphire -> Ruby!)
    const swSpecs = [
      { tx: 4, lit: state.switchLit?.[0], fill: "#2ec96e", hi: "#a3ffca", dim: "#1e4230" },
      { tx: 9, lit: state.switchLit?.[1], fill: "#2e82eb", hi: "#9cdbff", dim: "#1e3257" },
      { tx: 13, lit: state.switchLit?.[2], fill: "#e03b3b", hi: "#ffa3a3", dim: "#4f1e26" },
    ];
    for (const sw of swSpecs) {
      const cx = sw.tx * S + 16;
      const cy = 6 * S + 16;
      ellipseFill(ctx, cx, cy, 15, 13, "#4a526b", "#111420", 1.6);
      ellipseFill(ctx, cx, cy, 11, 9.5, sw.lit ? sw.fill : sw.dim, "#1b2033", 1.2);
      if (sw.lit) {
        ellipseFill(ctx, cx, cy, 6.5, 5.5, sw.hi);
        ellipseFill(ctx, cx, cy, 3, 2.5, "#ffffff");
      } else {
        polyFill(ctx, [[cx, cy - 5], [cx + 5, cy], [cx, cy + 5], [cx - 5, cy]], "#7a85a3");
      }
    }

    // 7. Ancient Carved Runic Teleport Portal Stone Circle (bottom center x=8..9, y=9)
    const pCx = 9 * S;
    const pCy = 9 * S + 12;
    ellipseFill(ctx, pCx, pCy, 34, 15, "#36405c", "#111420", 1.8);
    ellipseFill(ctx, pCx, pCy, 27, 11, "#1c3b6e", "#5ce0ff", 1.5);
    ellipseFill(ctx, pCx, pCy, 19, 7.5, "#2d8cd6");
    return canvas;
  }

  return canvas;
}

// ============================================================================
// Pre-Baked 4-Frame 2x HD Animated Lighting, Flames & Magic Overlay Canvases
// ============================================================================

function bakeInteriorAnimOverlay(roomId, frameIdx, state = {}) {
  const room = INTERIOR_ROOMS[roomId] || INTERIOR_ROOMS.main_floor;
  const S = TILE_SIZE * 2;
  const W = room.width * S;
  const H = room.height * S;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.__pixelScale = 0.5;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const phase = (frameIdx / 4) * Math.PI * 2;
  const pulse = 0.5 + 0.5 * Math.sin(phase);

  if (room.id === "main_floor") {
    // 1. Soft Diagonal Golden-Hour Sunbeam Trapezoids pouring through both colonial windows + dust motes!
    for (const wx of [6 * S + 6, 12 * S + 4]) {
      polyFill(
        ctx,
        [
          [wx, 2 * S],
          [wx + 38, 2 * S],
          [wx + 58, 4 * S + 18],
          [wx + 12, 4 * S + 18],
        ],
        `rgba(255, 236, 166, ${(0.12 + pulse * 0.04).toFixed(3)})`
      );
      polyFill(
        ctx,
        [
          [wx + 6, 2 * S],
          [wx + 32, 2 * S],
          [wx + 46, 3 * S + 24],
          [wx + 14, 3 * S + 24],
        ],
        `rgba(255, 248, 204, ${(0.09 + pulse * 0.03).toFixed(3)})`
      );
      // Floating sunlit dust motes!
      for (let m = 0; m < 4; m++) {
        const mx = wx + 12 + m * 9 + Math.sin(phase + m * 1.7) * 3;
        const my = 2 * S + 14 + m * 14 + Math.cos(phase + m) * 3;
        ellipseFill(ctx, mx, my, 1.5, 1.5, "rgba(255, 250, 214, 0.7)");
      }
    }

    // 2. Organic Multi-Tongue Dancing Fireplace Flames + Rising Glowing Embers + Warm Radial Hearth Glow!
    const fCx = 10 * S;
    const fBaseY = 2 * S + 14;
    radialGlow(ctx, fCx, fBaseY + 12, 8, 72 + pulse * 10, [
      [0, `rgba(255, 166, 66, ${(0.24 + pulse * 0.1).toFixed(3)})`],
      [0.5, `rgba(255, 118, 42, ${(0.1 + pulse * 0.04).toFixed(3)})`],
      [1, "rgba(255, 90, 20, 0)"],
    ]);
    // 3 sculpted flickering flame tongues (outer crimson-orange -> gold -> white-hot core!)
    const tongues = [
      [-11, 14 + Math.sin(phase) * 3, 8],
      [0, 19 + Math.cos(phase) * 3.5, 10],
      [11, 13 + Math.sin(phase + 2) * 3, 7.5],
    ];
    for (const [dx, fh, fw] of tongues) {
      const sway = Math.sin(phase + dx * 0.2) * 2.5;
      polyFill(
        ctx,
        [
          [fCx + dx - fw, fBaseY],
          [fCx + dx - fw * 0.6, fBaseY - fh * 0.6],
          [fCx + dx + sway, fBaseY - fh],
          [fCx + dx + fw * 0.6, fBaseY - fh * 0.55],
          [fCx + dx + fw, fBaseY],
        ],
        "rgba(245, 98, 28, 0.92)"
      );
      polyFill(
        ctx,
        [
          [fCx + dx - fw * 0.6, fBaseY],
          [fCx + dx + sway * 0.7, fBaseY - fh * 0.72],
          [fCx + dx + fw * 0.6, fBaseY],
        ],
        "rgba(255, 208, 68, 0.96)"
      );
      ellipseFill(ctx, fCx + dx, fBaseY - 3, fw * 0.35, 3, "rgba(255, 252, 224, 0.95)");
    }
    // Floating fireplace embers
    ellipseFill(ctx, fCx - 5 + Math.sin(phase) * 4, fBaseY - 20 - frameIdx * 2, 1.4, 1.4, "#ffe066");
    ellipseFill(ctx, fCx + 6 + Math.cos(phase) * 3, fBaseY - 17 - ((frameIdx + 2) % 4) * 2, 1.2, 1.2, "#ff9a36");

    // 3. Soft Curling Kitchen Kettle Steam Wisps!
    const stX = 14 * S + 18;
    const stY = 1 * S + 10 - frameIdx * 3;
    ellipseFill(ctx, stX + Math.sin(phase) * 2, stY, 3.2, 2.5, "rgba(255, 255, 255, 0.52)");
    ellipseFill(ctx, stX + 2 + Math.cos(phase) * 2.5, stY - 7, 4.2, 3, "rgba(255, 255, 255, 0.32)");

    // 4. Twinkling Golden Clue Sparkle on the Suspicious Bookshelf (until opened!)
    if (!state.bookshelfOpened) {
      const spX = 4 * S + 16;
      const spY = 1 * S + 22;
      const r = 3 + pulse * 4;
      radialGlow(ctx, spX, spY, 1, r * 2.4, [
        [0, "rgba(255, 248, 168, 0.85)"],
        [1, "rgba(255, 220, 92, 0)"],
      ]);
      px(ctx, spX - r, spY - 0.8, r * 2, 1.6, "#fffbe0");
      px(ctx, spX - 0.8, spY - r, 1.6, r * 2, "#fffbe0");
    }

    // 5. Soft Arcane Shimmer over the D&D Spellbook & Die on the Pool Table!
    const dCx = 14 * S + 28;
    const dCy = 8 * S + 4;
    radialGlow(ctx, dCx, dCy, 2, 24 + pulse * 6, [
      [0, frameIdx % 2 === 0 ? "rgba(116, 228, 255, 0.45)" : "rgba(196, 148, 255, 0.45)"],
      [1, "rgba(116, 228, 255, 0)"],
    ]);
    ellipseFill(ctx, dCx + Math.cos(phase) * 8, dCy - 6 + Math.sin(phase) * 3, 1.8, 1.8, "#e6faff");
    return canvas;
  }

  if (room.id === "upstairs_nook") {
    // 1. Curved Catenary Fairy-Light Garlands with Soft Bokeh Halos!
    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    const bulbCols = [
      ["#ffe878", "rgba(255, 224, 96, 0.42)"],
      ["#ff9ec4", "rgba(255, 148, 192, 0.42)"],
      ["#94e6ff", "rgba(128, 224, 255, 0.42)"],
    ];
    for (let i = 0; i < 12; i++) {
      const t = (i + 0.5) / 12;
      const bx = wallX + 10 + t * (wallW - 20);
      const halfT = (t * 2) % 1;
      const sag = Math.sin(halfT * Math.PI) * 10;
      const by = 48 + sag;
      const [core, halo] = bulbCols[(i + frameIdx) % bulbCols.length];
      const bright = (i + frameIdx) % 2 === 0 ? 1 : 0.6;
      radialGlow(ctx, bx, by, 1, 10 * bright + 4, [
        [0, halo],
        [1, "rgba(255, 255, 255, 0)"],
      ]);
      ellipseFill(ctx, bx, by, 2.4, 2.8, core);
      ellipseFill(ctx, bx, by - 0.6, 1, 1, "#ffffff");
    }

    // 2. Twinkling Stars in the Attic Skylight!
    const stars = [
      [7 * S + 18, 22],
      [8 * S + 8, 18],
      [8 * S + 24, 28],
      [7 * S + 28, 34],
      [9 * S + 4, 22],
    ];
    stars.forEach(([sx, sy], idx) => {
      const on = (idx + frameIdx) % 2 === 0;
      ellipseFill(ctx, sx, sy, on ? 1.8 : 1.1, on ? 1.8 : 1.1, on ? "#fffce0" : "rgba(220, 234, 255, 0.55)");
    });

    // 3. Soft Radiant Golden Aura & Rising Sparkles around the Golden D20 Chest!
    const gCx = 8 * S;
    const gCy = 3 * S + 8;
    radialGlow(ctx, gCx, gCy, 6, 46 + pulse * 10, [
      [0, `rgba(255, 228, 102, ${(0.34 + pulse * 0.14).toFixed(3)})`],
      [0.6, "rgba(255, 196, 64, 0.12)"],
      [1, "rgba(255, 196, 64, 0)"],
    ]);
    for (let s = 0; s < 4; s++) {
      const ang = phase + (s * Math.PI) / 2;
      ellipseFill(ctx, gCx + Math.cos(ang) * 24, gCy - 4 + Math.sin(ang) * 10, 1.8, 1.8, "#fffbe0");
    }
    return canvas;
  }

  if (room.id === "dnd_basement") {
    // 1. Roaring Sculpted Dungeon Wall Torches + Warm Circular Torchlight Pools!
    for (const tx of [3, 7, 11, 14]) {
      const fx = tx * S + 14;
      const fy = 22;
      radialGlow(ctx, fx, fy + 6, 4, 52 + pulse * 8, [
        [0, `rgba(255, 168, 56, ${(0.34 + pulse * 0.1).toFixed(3)})`],
        [0.5, "rgba(255, 108, 32, 0.12)"],
        [1, "rgba(255, 80, 20, 0)"],
      ]);
      const fh = 11 + Math.sin(phase + tx) * 2.5;
      polyFill(
        ctx,
        [
          [fx - 5, fy],
          [fx + Math.sin(phase + tx) * 2, fy - fh],
          [fx + 5, fy],
        ],
        "#ff7722"
      );
      polyFill(
        ctx,
        [
          [fx - 3, fy],
          [fx, fy - fh * 0.68],
          [fx + 3, fy],
        ],
        "#ffe26e"
      );
      ellipseFill(ctx, fx, fy - 2, 1.8, 2, "#ffffff");
    }

    // 2. Soft Circular Arcane Glows over Lit Floor Switches!
    const swSpecs = [
      { tx: 4, rgba: "rgba(76, 240, 140, 0.45)" },
      { tx: 9, rgba: "rgba(86, 188, 255, 0.45)" },
      { tx: 13, rgba: "rgba(255, 92, 92, 0.45)" },
    ];
    swSpecs.forEach((sw, idx) => {
      if (!state.switchLit?.[idx]) return;
      radialGlow(ctx, sw.tx * S + 16, 6 * S + 16, 4, 28 + pulse * 6, [
        [0, sw.rgba],
        [1, "rgba(0, 0, 0, 0)"],
      ]);
    });

    if (state.dndSolved) {
      radialGlow(ctx, 9 * S, 2 * S + 12, 6, 46 + pulse * 10, [
        [0, "rgba(134, 255, 224, 0.42)"],
        [1, "rgba(134, 255, 224, 0)"],
      ]);
    }

    // 3. Swirling Multi-Ring Cyan-Violet Arcane Teleport Portal!
    const pCx = 9 * S;
    const pCy = 9 * S + 12;
    radialGlow(ctx, pCx, pCy, 4, 42 + pulse * 8, [
      [0, "rgba(132, 244, 255, 0.55)"],
      [0.55, "rgba(176, 118, 255, 0.25)"],
      [1, "rgba(132, 118, 255, 0)"],
    ]);
    ellipseFill(ctx, pCx, pCy, 22 - pulse * 3, 9 - pulse * 1.5, null, "rgba(182, 250, 255, 0.85)", 2);
    ellipseFill(ctx, pCx, pCy, 12 + pulse * 3, 5 + pulse * 1.2, "rgba(224, 252, 255, 0.55)", "rgba(218, 174, 255, 0.9)", 1.5);
    for (let o = 0; o < 5; o++) {
      const ang = phase + (o * Math.PI * 2) / 5;
      ellipseFill(ctx, pCx + Math.cos(ang) * 20, pCy + Math.sin(ang) * 8, 2, 2, "#ffffff");
    }
  }

  return canvas;
}

export function createHomeInteriorSystem(questSystem) {
  const state = {
    active: false,
    roomId: "main_floor",
    x: 9.5 * TILE_SIZE,
    y: 9.2 * TILE_SIZE,
    facing: "up",
    bookshelfOpened: questSystem.state.openedHomeSecrets?.has("bookshelf_secret") || false,
    d20ChestOpened:
      questSystem.state.openedHomeSecrets?.has("golden_d20_chest") ||
      questSystem.state.inventory.has("golden_d20"),
    dndSolved:
      questSystem.state.openedHomeSecrets?.has("dnd_basement_solved") ||
      questSystem.state.inventory.has("bag_of_holding"),
    bagChestOpened: questSystem.state.inventory.has("bag_of_holding"),
    switchLit: [false, false, false],
    lastD20Roll: null,
    returnPos: null,
  };

  const roomCanvasCache = new Map();
  const animOverlayCache = new Map();

  function getRoomCacheKey() {
    if (state.roomId === "main_floor") {
      return `int32_main_bs${state.bookshelfOpened ? 1 : 0}`;
    }
    if (state.roomId === "upstairs_nook") {
      return `int32_nook_d${state.d20ChestOpened ? 1 : 0}`;
    }
    const sw = state.switchLit.map((v) => (v ? "1" : "0")).join("");
    return `int32_dnd_sw${sw}_s${state.dndSolved ? 1 : 0}_b${state.bagChestOpened ? 1 : 0}`;
  }

  function getBakedRoomCanvas() {
    if (typeof document === "undefined") return null;
    const key = getRoomCacheKey();
    let c = roomCanvasCache.get(key);
    if (!c) {
      c = bake32BitInteriorCanvas(state.roomId, state);
      roomCanvasCache.set(key, c);
    }
    return { key, canvas: c };
  }

  function getAnimOverlayCanvas(frameIdx) {
    if (typeof document === "undefined") return null;
    const key = `${getRoomCacheKey()}_fx${frameIdx}`;
    let c = animOverlayCache.get(key);
    if (!c) {
      c = bakeInteriorAnimOverlay(state.roomId, frameIdx, state);
      animOverlayCache.set(key, c);
    }
    return { key, canvas: c };
  }

  function syncSecretsFromSave() {
    const secrets = questSystem.state.openedHomeSecrets;
    state.bookshelfOpened = Boolean(secrets?.has("bookshelf_secret"));
    state.d20ChestOpened = Boolean(
      secrets?.has("golden_d20_chest") || questSystem.state.inventory.has("golden_d20")
    );
    state.dndSolved = Boolean(
      secrets?.has("dnd_basement_solved") || questSystem.state.inventory.has("bag_of_holding")
    );
    state.bagChestOpened = Boolean(questSystem.state.inventory.has("bag_of_holding"));
    if (state.dndSolved) {
      state.switchLit = [true, true, true];
    }
  }

  function getRoom() {
    return INTERIOR_ROOMS[state.roomId] || INTERIOR_ROOMS.main_floor;
  }

  function enterHouse(returnX, returnY) {
    syncSecretsFromSave();
    state.active = true;
    state.roomId = "main_floor";
    const room = getRoom();
    state.x = room.spawn.x * TILE_SIZE;
    state.y = room.spawn.y * TILE_SIZE;
    state.facing = "up";
    state.returnPos = { x: returnX, y: returnY };
    return { x: state.x, y: state.y, facing: state.facing, room };
  }

  function exitHouse() {
    state.active = false;
    state.roomId = "main_floor";
    return state.returnPos;
  }

  function transitionRoom(nextRoomId, spawnTileX, spawnTileY, facing = "up") {
    if (!INTERIOR_ROOMS[nextRoomId]) return null;
    state.roomId = nextRoomId;
    state.x = spawnTileX * TILE_SIZE;
    state.y = spawnTileY * TILE_SIZE;
    state.facing = facing;
    return { x: state.x, y: state.y, facing, room: INTERIOR_ROOMS[nextRoomId] };
  }

  function isInteriorBoxBlocked(cx, cy, hitbox = DEFAULT_HITBOX) {
    const room = getRoom();
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;
    const minPxX = 2 * TILE_SIZE;
    const maxPxX = (room.width - 2) * TILE_SIZE;
    const minPxY = 2 * TILE_SIZE;
    const maxPxY = (room.height - 1) * TILE_SIZE;

    if (
      cx - halfW < minPxX ||
      cx + halfW > maxPxX ||
      cy - halfH < minPxY ||
      cy + halfH > maxPxY
    ) {
      return true;
    }

    const left = Math.floor((cx - halfW) / TILE_SIZE);
    const right = Math.floor((cx + halfW - 0.001) / TILE_SIZE);
    const top = Math.floor((cy - halfH) / TILE_SIZE);
    const bottom = Math.floor((cy + halfH - 0.001) / TILE_SIZE);

    for (const s of room.solids) {
      if (room.id === "main_floor" && s.id === "bookshelf" && state.bookshelfOpened) {
        if (left <= 4 && right >= 3 && top <= 2 && bottom >= 2) return true;
        continue;
      }
      if (left <= s.maxX && right >= s.minX && top <= s.maxY && bottom >= s.minY) {
        return true;
      }
    }
    return false;
  }

  function getRoomInteractables() {
    const room = getRoom();
    if (room.id === "main_floor") {
      return [
        {
          id: "exit_door",
          kind: "house_prop",
          label: "Step Outside (565 Boylston St)",
          shortLabel: "GO<br/>OUTSIDE",
          icon: "🚪",
          x: 9.5 * TILE_SIZE,
          y: 10.4 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "kitchen_snacks",
          kind: "house_prop",
          label: "Kitchen Snack Jar (Restock Snacks & Heal!)",
          shortLabel: "GRAB<br/>SNACKS",
          icon: "🥨",
          x: 15.5 * TILE_SIZE,
          y: 2.9 * TILE_SIZE,
          radius: 28,
        },
        {
          id: "outfit_closet",
          kind: "house_prop",
          label: "Home Base Outfit Closet",
          shortLabel: "OUTFIT<br/>CLOSET",
          icon: "👕",
          x: 2.6 * TILE_SIZE,
          y: 5.5 * TILE_SIZE,
          radius: 24,
        },
        {
          id: "bookshelf",
          kind: "house_prop",
          label: state.bookshelfOpened
            ? "Secret Stairs → Upstairs Reading Nook"
            : "Suspicious Bookshelf",
          shortLabel: state.bookshelfOpened ? "GO<br/>UPSTAIRS" : "CHECK<br/>BOOKS",
          icon: state.bookshelfOpened ? "🪜" : "📚",
          x: (state.bookshelfOpened ? 5.2 : 4.5) * TILE_SIZE,
          y: 2.9 * TILE_SIZE,
          radius: 26,
        },
        {
          id: "pool_table_dnd",
          kind: "house_prop",
          label: "Basement Pool Table & D&D Portal",
          shortLabel: "D&D<br/>BASEMENT",
          icon: "🐉",
          x: 15.2 * TILE_SIZE,
          y: 7.5 * TILE_SIZE,
          radius: 30,
        },
      ];
    }

    if (room.id === "upstairs_nook") {
      return [
        {
          id: "nook_stairs_down",
          kind: "house_prop",
          label: "Stairs Down → Living Room",
          shortLabel: "GO<br/>DOWN",
          icon: "🪜",
          x: 3.5 * TILE_SIZE,
          y: 8.2 * TILE_SIZE,
          radius: 24,
        },
        {
          id: "golden_d20_chest",
          kind: "house_prop",
          label: state.d20ChestOpened
            ? "Roll the Golden D20 for Bonus Coins!"
            : "Glowing Attic Chest",
          shortLabel: state.d20ChestOpened ? "ROLL<br/>D20!" : "OPEN<br/>CHEST",
          icon: "🎲",
          x: 7.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 26,
        },
      ];
    }

    if (room.id === "dnd_basement") {
      return [
        {
          id: "dnd_portal_exit",
          kind: "house_prop",
          label: "Glowing Portal → Living Room",
          shortLabel: "LEAVE<br/>DUNGEON",
          icon: "🌀",
          x: 8.5 * TILE_SIZE,
          y: 9.2 * TILE_SIZE,
          radius: 24,
        },
        {
          id: "statue_bard",
          kind: "house_prop",
          label: "Halfling Bard Statue",
          shortLabel: "READ<br/>STATUE",
          icon: "🎵",
          x: 4.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "statue_wizard",
          kind: "house_prop",
          label: "Gnome Wizard Statue",
          shortLabel: "READ<br/>STATUE",
          icon: "🧙",
          x: 9.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "statue_knight",
          kind: "house_prop",
          label: "Eldritch Knight Statue",
          shortLabel: "READ<br/>STATUE",
          icon: "🛡️",
          x: 13.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "switch_0",
          kind: "house_prop",
          label: "Emerald Floor Switch (1st)",
          shortLabel: "PRESS<br/>SWITCH",
          icon: "🟢",
          x: 4.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 20,
        },
        {
          id: "switch_1",
          kind: "house_prop",
          label: "Sapphire Floor Switch (2nd)",
          shortLabel: "PRESS<br/>SWITCH",
          icon: "🔵",
          x: 9.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 20,
        },
        {
          id: "switch_2",
          kind: "house_prop",
          label: "Ruby Floor Switch (3rd)",
          shortLabel: "PRESS<br/>SWITCH",
          icon: "🔴",
          x: 13.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 20,
        },
        {
          id: "bag_of_holding_chest",
          kind: "house_prop",
          label: state.bagChestOpened
            ? "Bag of Holding Chest (Opened!)"
            : state.dndSolved
              ? "Unlocked Dungeon Chest!"
              : "Sealed Dungeon Chest (Solve 3 Switches)",
          shortLabel: "OPEN<br/>CHEST",
          icon: "🎒",
          x: 8.5 * TILE_SIZE,
          y: 2.8 * TILE_SIZE,
          radius: 24,
        },
      ];
    }
    return [];
  }

  function findNearbyInteriorProp(pxPos, pyPos) {
    const props = getRoomInteractables();
    let best = null;
    for (const p of props) {
      const dist = Math.hypot(pxPos - p.x, pyPos - p.y);
      if (dist <= p.radius && (!best || dist < best.dist)) {
        best = { kind: "house_prop", target: p, dist };
      }
    }
    return best;
  }

  function interactWithInteriorProp(propId, { rng = Math.random } = {}) {
    if (propId === "exit_door") {
      return { action: "exit_house" };
    }

    if (propId === "kitchen_snacks") {
      const maxS = questSystem.getMaxSnacks();
      const gained = questSystem.addSnacks(maxS);
      return {
        action: "kitchen_snacks",
        healHearts: 5,
        gainedSnacks: gained,
        toast:
          gained > 0
            ? `🥨 Grabbed fresh snacks from the kitchen (${questSystem.state.snacks}/${maxS} snacks) & restored all hearts!`
            : `❤️ Snack pocket is full (${questSystem.state.snacks}/${maxS}) & all hearts are topped up!`,
      };
    }

    if (propId === "outfit_closet") {
      const unlocked = questSystem.getUnlockedOutfits();
      if (unlocked.length <= 1) {
        return {
          action: "dialogue",
          speaker: "Home Base Outfit Closet",
          lines: [
            "Your cozy wooden closet holds your Polo, Kippah & Tzitzit — with empty hangers waiting for Baseball, Wetsuit & Link outfits!",
            "Complete neighborhood quests (or switch to Easy / GPS Mode!) to fill up your wardrobe!",
          ],
        };
      }
      return { action: "toggle_outfit" };
    }

    if (propId === "bookshelf") {
      if (!state.bookshelfOpened) {
        state.bookshelfOpened = true;
        questSystem.state.openedHomeSecrets.add("bookshelf_secret");
        questSystem.save();
        return {
          action: "secret_reveal",
          speaker: "Suspicious Bookshelf",
          lines: [
            "*CLICK... RUMBLE!* You tugged a glowing red adventure book — the whole bookshelf slid aside!",
            "A secret wooden staircase leads up to a cozy hidden attic reading nook! Press Space again to head upstairs!",
          ],
        };
      }
      const next = transitionRoom("upstairs_nook", 4.5, 7.4, "up");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🪜 Climbed the secret stairs into the Cozy Upstairs Reading Nook!",
      };
    }

    if (propId === "pool_table_dnd") {
      const next = transitionRoom("dnd_basement", 8.5, 8.4, "up");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🐉 Whoosh! Warped into the 32-Bit D&D Basement Dungeon!",
      };
    }

    if (propId === "nook_stairs_down") {
      const next = transitionRoom("main_floor", 5.2, 3.6, "down");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🏠 Back downstairs in the 565 Boylston St Living Room!",
      };
    }

    if (propId === "golden_d20_chest") {
      if (!state.d20ChestOpened) {
        state.d20ChestOpened = true;
        questSystem.state.openedHomeSecrets.add("golden_d20_chest");
        questSystem.state.inventory.add("golden_d20");
        questSystem.state.coins += 20;
        questSystem.state.safetyXP += 25;
        questSystem.save();
        return {
          action: "fanfare",
          itemId: "golden_d20",
          sourceLabel: "Secret Upstairs Reading Nook",
          speaker: "Glowing Attic Chest",
          lines: [
            "You opened the glowing chest in the secret reading nook and discovered the legendary GOLDEN D20!! (+20 Coins, +25 XP!)",
            "Check the chest again anytime to roll the Golden D20 for lucky bonus coins!",
          ],
        };
      }
      const roll = Math.max(1, Math.min(20, Math.floor(rng() * 20) + 1));
      state.lastD20Roll = roll;
      const bonus = roll === 20 ? 20 : roll >= 15 ? 8 : roll >= 10 ? 4 : 2;
      questSystem.state.coins += bonus;
      questSystem.save();
      return {
        action: "d20_roll",
        roll,
        bonus,
        toast:
          roll === 20
            ? `🎲 NATURAL 20!! CRITICAL JACKPOT! +${bonus} Neighborhood Coins!!`
            : `🎲 Golden D20 rolled a ${roll}! Earned +${bonus} lucky Neighborhood Coins!`,
      };
    }

    if (propId === "dnd_portal_exit") {
      const next = transitionRoom("main_floor", 13.4, 7.6, "left");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🏠 Returned upstairs to 565 Boylston St!",
      };
    }

    if (propId === "statue_bard") {
      return {
        action: "dialogue",
        speaker: "🎵 Halfling Bard Statue",
        lines: [
          '"Hail, young adventurer! Every epic quest begins with a song!"',
          '"Step FIRST on the EMERALD switch beneath my lute, then ask the Gnome Wizard for verse two!"',
        ],
      };
    }
    if (propId === "statue_wizard") {
      return {
        action: "dialogue",
        speaker: "🧙 Gnome Wizard Statue",
        lines: [
          '"Greetings, Explorer of Newton! Arcane geometry unlocks the vault!"',
          '"Press the SAPPHIRE switch SECOND — right after the Bard\'s Emerald rune — then consult the Eldritch Knight!"',
        ],
      };
    }
    if (propId === "statue_knight") {
      return {
        action: "dialogue",
        speaker: "🛡️ Eldritch Knight Statue",
        lines: [
          '"Stand brave, Hero! Only the true sequence opens the Bag of Holding!"',
          '"Strike the RUBY switch THIRD & LAST (Emerald → Sapphire → Ruby) to break the chest\'s seal!"',
        ],
      };
    }

    if (propId === "switch_0" || propId === "switch_1" || propId === "switch_2") {
      if (state.dndSolved) {
        return {
          action: "toast",
          toast: "✨ All 3 ancient dungeon runes are already glowing! Open the chest up north!",
        };
      }
      const idx = Number(propId.split("_")[1]);
      const expectedIdx = !state.switchLit[0] ? 0 : !state.switchLit[1] ? 1 : 2;
      if (idx === expectedIdx) {
        state.switchLit[idx] = true;
        if (idx === 2) {
          state.dndSolved = true;
          questSystem.state.openedHomeSecrets.add("dnd_basement_solved");
          questSystem.save();
          return {
            action: "puzzle_solved",
            toast: "✨ ALL 3 RUNES LIT! The D&D Basement chest unlocked with a heroic chime!",
          };
        }
        return {
          action: "switch_ok",
          toast:
            idx === 0
              ? "🟢 Emerald Rune lit! (1/3) — Next: Sapphire switch!"
              : "🔵 Sapphire Rune lit! (2/3) — Final: Ruby switch!",
        };
      }
      state.switchLit = [false, false, false];
      return {
        action: "switch_reset",
        toast: "🔮 Switches reset! Ask the 3 statues for the order: Emerald (1) → Sapphire (2) → Ruby (3)!",
      };
    }

    if (propId === "bag_of_holding_chest") {
      if (!state.dndSolved) {
        return {
          action: "dialogue",
          speaker: "Sealed Dungeon Chest",
          lines: [
            "A magical blue rune lock seals the chest!",
            "Talk to the Halfling Bard, Gnome Wizard, and Eldritch Knight statues to solve the 3-switch floor puzzle!",
          ],
        };
      }
      if (state.bagChestOpened) {
        return {
          action: "dialogue",
          speaker: "Dungeon Treasure Chest",
          lines: [
            "You already claimed the magical Bag of Holding! You can now carry up to 12 snacks to share with neighbors!",
          ],
        };
      }
      state.bagChestOpened = true;
      questSystem.state.inventory.add("bag_of_holding");
      questSystem.state.safetyXP += 35;
      questSystem.addSnacks(12);
      questSystem.save();
      return {
        action: "fanfare",
        itemId: "bag_of_holding",
        sourceLabel: "32-Bit D&D Basement Dungeon",
        speaker: "Unlocked Dungeon Chest",
        lines: [
          "You found the legendary BAG OF HOLDING!! (+35 XP!)",
          "Your pocket now holds up to 12 Neighborhood Snacks (already filled to the brim!) to share with sidewalk marchers!",
        ],
      };
    }

    return null;
  }

  const prewarmedRooms = new Set();

  /**
   * Blit the pre-baked 2x HD 32-bit room canvas + smooth 4-frame pre-baked HD animated
   * lighting, flames, sunbeams, fairy lights, dungeon torches & swirling arcane portal!
   */
  function drawInteriorRoom(k, elapsedTime = 0) {
    const baked = getBakedRoomCanvas();
    if (baked) {
      k.drawCanvas(baked.key, baked.canvas, 0, 0);
      if (!prewarmedRooms.has(baked.key)) {
        prewarmedRooms.add(baked.key);
        for (let f = 0; f < 4; f++) {
          const pre = getAnimOverlayCanvas(f);
          if (pre) k.drawCanvas(pre.key, pre.canvas, 0, 0, 0);
        }
      }
    }
    const animFrame = Math.floor(elapsedTime * 6) % 4;
    const fx = getAnimOverlayCanvas(animFrame);
    if (fx) {
      k.drawCanvas(fx.key, fx.canvas, 0, 0);
    }
  }

  return {
    state,
    getRoom,
    enterHouse,
    exitHouse,
    transitionRoom,
    isInteriorBoxBlocked,
    getRoomInteractables,
    findNearbyInteriorProp,
    interactWithInteriorProp,
    drawInteriorRoom,
    syncSecretsFromSave,
  };
}
