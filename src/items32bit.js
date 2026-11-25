/**
 * 32-Bit 2x HD Pixel-Art Items, Collectibles, Combat Slash & Interaction VFX Atlas
 * (All canvases use __pixelScale = 0.5 and strictly discrete integer fillRect pixels
 * so WebGL, Canvas 2D, and headless Node tests stay 100% crisp and identical!)
 */

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

function pxLine(ctx, x0, y0, x1, y1, size, color) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  const half = Math.floor(size / 2);
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t) - half, Math.round(y0 + (y1 - y0) * t) - half, size, size);
  }
}

/**
 * Bake 19 rich 32x32 2x HD SNES/32-bit pickup item sprites (16x16 logical)
 * plus 2x HD animated collectibles, 5-frame hero sword arcs, interaction FX & graveyard props!
 */
export function upgradeItemsAndFxTo32Bit(sprites) {
  // =========================================================================
  // 1. 32x32 2x HD PICKUP ITEM SPRITES (Zero boxy 8-bit backgrounds!)
  // =========================================================================

  // 1) Pocket Siddur (Closed — rich 3D angled royal-blue leather prayerbook w/ gold Star of David & crimson ribbon!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Soft golden aura behind book
    pxEllipse(ctx, 16, 16, 13, 13, "rgba(120, 206, 255, 0.16)");
    // Outer silhouette outline
    px(ctx, 5, 3, 21, 25, "#101b36");
    px(ctx, 4, 5, 23, 21, "#101b36");
    // Ribbed deep-navy leather spine on left
    px(ctx, 5, 4, 5, 23, "#142c5c");
    px(ctx, 6, 5, 3, 21, "#1e4285");
    for (const ry of [8, 13, 18, 23]) {
      px(ctx, 5, ry, 5, 1, "#f4d35e");
      px(ctx, 6, ry, 2, 1, "#fff6b8");
    }
    // Royal-blue leather front cover with sunlit beveled highlight
    px(ctx, 10, 4, 15, 21, "#2255a8");
    px(ctx, 11, 5, 13, 19, "#2e6fd1");
    px(ctx, 11, 5, 12, 3, "#4e92f0");
    px(ctx, 23, 5, 1, 19, "#173b78");
    // Embossed gold corner filigree frame
    px(ctx, 12, 6, 11, 1, "#e6b84c");
    px(ctx, 12, 22, 11, 1, "#e6b84c");
    px(ctx, 12, 6, 1, 17, "#e6b84c");
    px(ctx, 22, 6, 1, 17, "#e6b84c");
    px(ctx, 12, 6, 2, 2, "#fff5b8");
    px(ctx, 21, 6, 2, 2, "#fff5b8");
    px(ctx, 12, 21, 2, 2, "#fff5b8");
    px(ctx, 21, 21, 2, 2, "#fff5b8");
    // Crisp embossed Gold Star of David emblem on cover!
    px(ctx, 17, 9, 2, 1, "#fff6b8");
    px(ctx, 16, 10, 4, 1, "#f4d35e");
    px(ctx, 14, 11, 8, 1, "#fff6b8");
    px(ctx, 15, 12, 6, 1, "#f4d35e");
    px(ctx, 16, 13, 4, 2, "#2e6fd1");
    px(ctx, 15, 13, 1, 2, "#f4d35e");
    px(ctx, 20, 13, 1, 2, "#f4d35e");
    px(ctx, 15, 15, 6, 1, "#f4d35e");
    px(ctx, 14, 16, 8, 1, "#fff6b8");
    px(ctx, 16, 17, 4, 1, "#f4d35e");
    px(ctx, 17, 18, 2, 1, "#fff6b8");
    // Gilded cream page block along right & bottom edges
    px(ctx, 24, 6, 2, 19, "#f7ebd0");
    px(ctx, 25, 7, 1, 17, "#d9c291");
    px(ctx, 10, 24, 15, 3, "#f7ebd0");
    px(ctx, 11, 25, 14, 1, "#d9c291");
    px(ctx, 10, 26, 15, 1, "#b59659");
    // Crimson satin ribbon bookmark peeking out bottom!
    px(ctx, 15, 25, 3, 5, "#9e1c24");
    px(ctx, 16, 25, 2, 4, "#e63946");
    px(ctx, 16, 29, 1, 1, "#ff8787");
    sprites.item_siddur = canvas;
  }

  // 1b) Open Glowing Pocket Siddur (held aloft when casting blessing wave!)
  {
    const { canvas, ctx } = makeHdCanvas(36, 28);
    pxEllipse(ctx, 18, 13, 16, 11, "rgba(138, 218, 255, 0.28)");
    pxEllipse(ctx, 18, 13, 11, 7, "rgba(255, 240, 160, 0.34)");
    // Blue leather outer cover wings
    px(ctx, 2, 8, 32, 16, "#101b36");
    px(ctx, 3, 9, 30, 14, "#1e4b96");
    px(ctx, 4, 10, 28, 12, "#2f6fd1");
    // Left & right open arched parchment pages
    px(ctx, 4, 6, 13, 15, "#5c4328");
    px(ctx, 19, 6, 13, 15, "#5c4328");
    px(ctx, 5, 7, 12, 13, "#fff9e8");
    px(ctx, 19, 7, 12, 13, "#fff5db");
    px(ctx, 16, 8, 4, 12, "#e0cfa8"); // center gutter fold
    px(ctx, 17, 9, 2, 11, "#b89f72");
    // Delicate golden-ink calligraphy lines on both open pages!
    for (const ly of [9, 12, 15, 17]) {
      px(ctx, 7, ly, 8, 1, ly === 9 ? "#d99b1e" : "#755a38");
      px(ctx, 21, ly, 8, 1, ly === 9 ? "#d99b1e" : "#755a38");
    }
    // Crimson ribbon + twinkling gold & cyan light motes rising above pages!
    px(ctx, 17, 20, 2, 6, "#e63946");
    px(ctx, 17, 2, 2, 4, "#fff8cf");
    px(ctx, 16, 3, 4, 2, "#ffe066");
    px(ctx, 9, 3, 2, 2, "#8cf7ff");
    px(ctx, 25, 3, 2, 2, "#8cf7ff");
    sprites.item_siddur_open = canvas;
  }

  // 2) Graveyard Explorer Hero Sword (gleaming angled broadsword w/ winged gold crossguard & sapphire jewel!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 16, 13, 13, "rgba(130, 224, 255, 0.16)");
    // Blade silhouette outline (diagonal top-right to bottom-left)
    pxLine(ctx, 26, 5, 11, 20, 7, "#162033");
    // Polished steel & bright specular edge
    pxLine(ctx, 26, 5, 12, 19, 5, "#78b9eb");
    pxLine(ctx, 26, 5, 13, 18, 3, "#d6f2ff");
    pxLine(ctx, 25, 5, 14, 16, 1, "#ffffff");
    // Fuller shadow line down center of blade
    pxLine(ctx, 23, 8, 14, 17, 1, "#4c82bd");
    // Ornate winged golden crossguard
    pxLine(ctx, 8, 15, 17, 24, 5, "#4a2c08");
    pxLine(ctx, 9, 16, 16, 23, 3, "#e6b84c");
    pxLine(ctx, 9, 15, 15, 21, 1, "#fff6b8");
    // Gleaming sapphire jewel set in guard center!
    px(ctx, 11, 18, 3, 3, "#1c4a9e");
    px(ctx, 12, 18, 2, 2, "#5ce1ff");
    px(ctx, 12, 18, 1, 1, "#ffffff");
    // Wrapped leather grip & golden pommel
    pxLine(ctx, 10, 21, 5, 26, 4, "#2e1608");
    pxLine(ctx, 10, 21, 6, 25, 2, "#8c4a24");
    px(ctx, 4, 24, 4, 4, "#4a2c08");
    px(ctx, 5, 25, 2, 2, "#ffe066");
    // Specular blade star glint near tip
    px(ctx, 25, 3, 2, 6, "#ffffff");
    px(ctx, 23, 5, 6, 2, "#ffffff");
    sprites.item_sword = canvas;
  }

  // 3) Folded Paper Map (unrolled parchment with green park, blue pond & red quest X!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 3, 5, 26, 22, "#3b2410");
    px(ctx, 4, 6, 24, 20, "#e6d2a4");
    // Folded accordion panels (light / shade alternating)
    px(ctx, 4, 6, 8, 20, "#f5e6c4");
    px(ctx, 12, 6, 8, 20, "#dfcaa0");
    px(ctx, 20, 6, 8, 20, "#f2e2be");
    px(ctx, 11, 6, 1, 20, "#a88b5b");
    px(ctx, 19, 6, 1, 20, "#a88b5b");
    // Painted Newton roads, green park, blue Crystal Lake & crimson X!
    px(ctx, 5, 11, 22, 2, "#c2995b");
    px(ctx, 14, 7, 2, 18, "#c2995b");
    pxEllipse(ctx, 8, 18, 3.2, 3.2, "#4ea868");
    pxEllipse(ctx, 23, 10, 3.2, 2.5, "#4c9ed9");
    px(ctx, 22, 9, 2, 1, "#b8ecff");
    pxLine(ctx, 20, 18, 25, 23, 2, "#d9362e");
    pxLine(ctx, 25, 18, 20, 23, 2, "#d9362e");
    sprites.item_map = canvas;
  }

  // 4) J.P. Licks Double Scoop Ice Cream Cone (waffle cone + strawberry & vanilla swirl + cherry!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Waffle cone
    for (let row = 0; row < 13; row++) {
      const half = Math.max(1, Math.round(6 - row * 0.44));
      px(ctx, 16 - half - 1, 16 + row, half * 2 + 2, 1, "#4a2810");
      px(ctx, 16 - half, 16 + row, half * 2, 1, row % 2 === 0 ? "#d99848" : "#c27d32");
      if (half > 2) px(ctx, 16 - half + 1, 16 + row, 2, 1, "#f0b96e");
    }
    // Lower strawberry scoop
    pxEllipse(ctx, 16, 14, 8.2, 5.8, "#5c1a2e");
    pxEllipse(ctx, 16, 14, 7.0, 4.8, "#ff87ab");
    pxEllipse(ctx, 14, 12.5, 4.0, 2.5, "#ffc2d4");
    // Upper creamy vanilla scoop
    pxEllipse(ctx, 16, 9, 6.5, 5.2, "#5c4328");
    pxEllipse(ctx, 16, 9, 5.4, 4.2, "#fff5db");
    pxEllipse(ctx, 14.5, 7.5, 3.0, 2.2, "#ffffff");
    // Rainbow sprinkles & glossy red cherry on top!
    px(ctx, 13, 13, 2, 1, "#5ce1ff");
    px(ctx, 18, 14, 2, 1, "#ffe066");
    px(ctx, 16, 10, 2, 1, "#72e89c");
    pxEllipse(ctx, 16, 4.5, 2.8, 2.6, "#660e16");
    pxEllipse(ctx, 16, 4.5, 2.0, 1.8, "#e62e3d");
    px(ctx, 15, 3, 1, 1, "#ffffff");
    px(ctx, 17, 1, 2, 2, "#3a7d3c");
    sprites.item_icecream = canvas;
  }

  // 5) Braided Golden Challah Loaf (glossy egg-wash golden braids + sesame seeds!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 17, 13.5, 8.2, "#45200a");
    pxEllipse(ctx, 16, 17, 12.2, 7.0, "#b8641c");
    // 3 plump braided dough lobes!
    for (const [bx, by, rx, ry] of [[9, 17, 4.5, 4.5], [16, 16, 5.5, 5.8], [23, 17, 4.5, 4.5]]) {
      pxEllipse(ctx, bx, by, rx, ry, "#d9842b");
      pxEllipse(ctx, bx - 0.5, by - 1.2, rx * 0.72, ry * 0.62, "#f5b84c");
      pxEllipse(ctx, bx - 1, by - 2.2, rx * 0.42, ry * 0.34, "#ffe38c");
    }
    // Diagonal braid creases & sesame seeds
    pxLine(ctx, 11, 12, 14, 22, 1, "#7a3b0e");
    pxLine(ctx, 19, 12, 22, 21, 1, "#7a3b0e");
    for (const [sx, sy] of [[8, 15], [14, 13], [17, 15], [15, 18], [22, 15], [24, 17]]) {
      px(ctx, sx, sy, 2, 1, "#fff8e0");
    }
    sprites.item_challah = canvas;
  }

  // 6) Hardcover Explorer Book / Library Card Tome
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 5, 4, 22, 24, "#12223d");
    px(ctx, 6, 5, 5, 22, "#1c4073");
    px(ctx, 11, 5, 15, 20, "#3a78bd");
    px(ctx, 12, 6, 13, 18, "#549ae0");
    px(ctx, 12, 6, 12, 3, "#8ac4f7");
    // Gold emblem & spine bands
    px(ctx, 6, 9, 5, 2, "#f4d35e");
    px(ctx, 6, 20, 5, 2, "#f4d35e");
    px(ctx, 14, 10, 9, 6, "#f4d35e");
    px(ctx, 15, 11, 7, 4, "#fff6b8");
    px(ctx, 16, 12, 5, 2, "#3a78bd");
    // Creamy pages bottom edge
    px(ctx, 11, 24, 15, 3, "#f7ebd0");
    px(ctx, 11, 25, 15, 1, "#c9b282");
    sprites.item_book = canvas;
  }

  // 7) Sporty Running Shoes (red & white cushioned sneaker with lightning bolt!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 21, 12, 6, "#2b1012");
    px(ctx, 5, 11, 12, 12, "#2b1012");
    px(ctx, 6, 12, 10, 10, "#d9362e");
    px(ctx, 7, 13, 8, 5, "#ff685c");
    px(ctx, 14, 16, 12, 6, "#d9362e");
    px(ctx, 15, 17, 10, 3, "#ff685c");
    // White cushioned athletic sole + red tread
    px(ctx, 5, 22, 22, 4, "#f5f8fc");
    px(ctx, 6, 25, 20, 2, "#bcc8d6");
    // Laces & golden lightning bolt!
    px(ctx, 14, 14, 3, 1, "#ffffff");
    px(ctx, 16, 16, 3, 1, "#ffffff");
    px(ctx, 9, 17, 5, 2, "#ffe066");
    px(ctx, 12, 19, 4, 2, "#f4d35e");
    sprites.item_shoes = canvas;
  }

  // 8) Neighborhood Kick Scooter (teal deck, chrome stem & spoked wheels!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Spoked wheels
    pxEllipse(ctx, 8, 24, 4.2, 4.2, "#181a24");
    pxEllipse(ctx, 8, 24, 2.0, 2.0, "#cfd8e3");
    pxEllipse(ctx, 24, 24, 4.2, 4.2, "#181a24");
    pxEllipse(ctx, 24, 24, 2.0, 2.0, "#cfd8e3");
    // Sleek teal deck
    px(ctx, 7, 20, 18, 5, "#103b3e");
    px(ctx, 8, 21, 16, 3, "#2cd4cc");
    px(ctx, 9, 21, 14, 1, "#8afcf4");
    // Angled chrome steering stem & T-bar handlebars
    pxLine(ctx, 23, 21, 19, 7, 4, "#242c3a");
    pxLine(ctx, 23, 21, 19, 7, 2, "#e6edf5");
    px(ctx, 14, 5, 11, 4, "#103b3e");
    px(ctx, 15, 6, 9, 2, "#38e8df");
    px(ctx, 14, 6, 3, 2, "#ffe066");
    px(ctx, 22, 6, 3, 2, "#ffe066");
    sprites.item_scooter = canvas;
  }

  // 9) Brass Trail Compass (polished gold case, ivory rose dial & crimson north needle!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Top lanyard ring
    px(ctx, 13, 2, 6, 4, "#593b0a");
    px(ctx, 14, 3, 4, 2, "#ffe066");
    // Round brass bezel
    pxEllipse(ctx, 16, 17, 11.5, 11.5, "#472c08");
    pxEllipse(ctx, 16, 17, 10.2, 10.2, "#d99e26");
    pxEllipse(ctx, 15, 16, 8.8, 8.8, "#ffe066");
    // Ivory compass face + cardinal ticks
    pxEllipse(ctx, 16, 17, 7.6, 7.6, "#f7f0dc");
    px(ctx, 15, 10, 2, 2, "#3b2410");
    px(ctx, 15, 22, 2, 2, "#755a38");
    px(ctx, 9, 16, 2, 2, "#755a38");
    px(ctx, 21, 16, 2, 2, "#755a38");
    // Angled crimson/silver compass needle
    pxLine(ctx, 16, 17, 20, 12, 2, "#e63946");
    pxLine(ctx, 16, 17, 12, 22, 2, "#4a668a");
    px(ctx, 15, 16, 2, 2, "#f4d35e");
    sprites.item_compass = canvas;
  }

  // 10) Park Scout Stamp / Swim Pass Emblem
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 6, 4, 20, 24, "#123824");
    px(ctx, 7, 5, 18, 22, "#248c57");
    px(ctx, 8, 6, 16, 20, "#4ec985");
    px(ctx, 9, 7, 14, 18, "#e8fff0");
    // Crisp emerald star emblem & wave lines
    pxEllipse(ctx, 16, 14, 5, 5, "#248c57");
    px(ctx, 15, 10, 2, 8, "#ffe066");
    px(ctx, 12, 13, 8, 2, "#ffe066");
    px(ctx, 11, 21, 10, 2, "#2e7dd1");
    sprites.item_stamp = canvas;
  }

  // 11) Dad's Spicy Cholent Pot (cast-iron pot with copper handles, hearty stew & rising steam!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Steam curls rising overhead
    px(ctx, 11, 3, 2, 5, "rgba(255, 250, 236, 0.85)");
    px(ctx, 16, 2, 2, 6, "rgba(255, 250, 236, 0.9)");
    px(ctx, 21, 4, 2, 4, "rgba(255, 250, 236, 0.8)");
    // Side brass handles
    px(ctx, 3, 14, 4, 5, "#422410");
    px(ctx, 25, 14, 4, 5, "#422410");
    px(ctx, 4, 15, 2, 3, "#e6b84c");
    px(ctx, 26, 15, 2, 3, "#e6b84c");
    // Cast-iron Dutch oven pot body
    pxEllipse(ctx, 16, 20, 10.5, 8.5, "#1f181c");
    pxEllipse(ctx, 16, 20, 9.2, 7.2, "#4a3228");
    pxEllipse(ctx, 13.5, 19, 4.5, 4.5, "#754e3c");
    // Bubbling rich orange-gold stew at rim!
    pxEllipse(ctx, 16, 13, 9.5, 3.8, "#1f181c");
    pxEllipse(ctx, 16, 13, 8.2, 2.8, "#cf4e1e");
    pxEllipse(ctx, 15, 12.5, 5.2, 1.6, "#f59e33");
    px(ctx, 12, 12, 2, 2, "#fff0a6");
    px(ctx, 19, 13, 2, 1, "#ffe066");
    sprites.item_cholent = canvas;
  }

  // 12) Golden Mizuno Baseball Glove (stitched leather mitt + red-seamed baseball!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 17, 11.5, 11.5, "#3d1e08");
    pxEllipse(ctx, 16, 17, 10.2, 10.2, "#bd6f24");
    pxEllipse(ctx, 14, 14, 7.5, 7.5, "#e69a3c");
    // Leather finger channels
    pxLine(ctx, 11, 8, 12, 16, 1, "#6e380e");
    pxLine(ctx, 16, 7, 16, 15, 1, "#6e380e");
    pxLine(ctx, 21, 9, 19, 16, 1, "#6e380e");
    // Tucked crisp white baseball with red stitches in pocket!
    pxEllipse(ctx, 18, 18, 5.0, 5.0, "#3b2e26");
    pxEllipse(ctx, 18, 18, 4.0, 4.0, "#ffffff");
    px(ctx, 16, 16, 1, 4, "#d9362e");
    px(ctx, 20, 16, 1, 4, "#d9362e");
    sprites.item_glove = canvas;
  }

  // 13) Explorer Gold Shield Badge
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Shield silhouette
    px(ctx, 6, 4, 20, 16, "#3b2408");
    px(ctx, 8, 20, 16, 5, "#3b2408");
    px(ctx, 11, 25, 10, 3, "#3b2408");
    px(ctx, 14, 28, 4, 2, "#3b2408");
    // Gleaming gold bezel
    px(ctx, 7, 5, 18, 14, "#e6b84c");
    px(ctx, 9, 19, 14, 5, "#d49b26");
    px(ctx, 12, 24, 8, 3, "#b87e16");
    px(ctx, 8, 6, 16, 3, "#fff6b8");
    // Emerald enamel center + shining star!
    px(ctx, 10, 8, 12, 11, "#1e6e44");
    px(ctx, 11, 9, 10, 9, "#2ca868");
    px(ctx, 15, 10, 2, 8, "#fff6b8");
    px(ctx, 12, 13, 8, 2, "#fff6b8");
    px(ctx, 14, 12, 4, 4, "#ffe066");
    sprites.item_badge = canvas;
  }

  // 14) BC Maroon & Gold Eagle Pennant
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 5, 4, 4, 24, "#3b2410");
    px(ctx, 6, 5, 2, 22, "#e8d2a4");
    for (let x = 0; x < 19; x++) {
      const half = Math.max(1, Math.round(7 - x * 0.36));
      px(ctx, 9 + x, 13 - half - 1, 1, half * 2 + 2, "#2e0810");
      px(ctx, 9 + x, 13 - half, 1, half * 2, x < 3 ? "#f4d35e" : "#8a1c30");
    }
    px(ctx, 12, 12, 11, 2, "#f4d35e");
    px(ctx, 14, 10, 5, 2, "#ffe885");
    sprites.item_pennant = canvas;
  }

  // 15) Spooky Glowing Graveyard Lantern (iron frame, curved handle & bright teal flame!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 17, 13, 13, "rgba(107, 240, 216, 0.24)");
    // Curved iron handle
    px(ctx, 11, 2, 10, 2, "#1c2230");
    px(ctx, 10, 4, 2, 4, "#1c2230");
    px(ctx, 20, 4, 2, 4, "#1c2230");
    // Iron cap & base
    px(ctx, 8, 7, 16, 4, "#1c2230");
    px(ctx, 9, 8, 14, 2, "#576278");
    px(ctx, 8, 24, 16, 4, "#1c2230");
    px(ctx, 9, 25, 14, 2, "#576278");
    // Glowing turquoise glass chamber + bright inner flame!
    px(ctx, 9, 11, 14, 13, "#1c2230");
    px(ctx, 10, 11, 12, 13, "#34c9b8");
    px(ctx, 11, 12, 10, 11, "#7ffae8");
    pxEllipse(ctx, 16, 17, 3.2, 4.2, "#ffffff");
    // Corner iron mullions
    px(ctx, 10, 11, 2, 13, "#2c3445");
    px(ctx, 20, 11, 2, 13, "#2c3445");
    sprites.item_lantern = canvas;
  }

  // 16) Friendly Ghost Charm
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 16, 13, 13, "rgba(168, 224, 255, 0.24)");
    pxEllipse(ctx, 16, 13, 9.5, 9.5, "#273352");
    px(ctx, 7, 13, 18, 12, "#273352");
    pxEllipse(ctx, 16, 13, 8.2, 8.2, "#eef8ff");
    px(ctx, 8, 13, 16, 10, "#eef8ff");
    px(ctx, 9, 8, 5, 12, "#ffffff");
    px(ctx, 20, 10, 3, 12, "#c2e0f5");
    // Wavy ghost bottom scallops
    px(ctx, 8, 23, 4, 3, "#d8f0ff");
    px(ctx, 14, 23, 4, 4, "#eef8ff");
    px(ctx, 20, 23, 4, 3, "#c2e0f5");
    // Cute sparkling eyes & rosy cheeks
    px(ctx, 11, 12, 3, 4, "#1b2238");
    px(ctx, 18, 12, 3, 4, "#1b2238");
    px(ctx, 11, 12, 1, 2, "#ffffff");
    px(ctx, 18, 12, 1, 2, "#ffffff");
    px(ctx, 9, 16, 2, 2, "#ffa8c8");
    px(ctx, 21, 16, 2, 2, "#ffa8c8");
    sprites.item_ghost = canvas;
  }

  // 17) Golden D20 Icosahedron Die (Home Base Secret Reading Nook treasure!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 16, 13, 13, "rgba(255, 224, 92, 0.26)");
    // Hexagonal outer die body
    for (let y = 4; y <= 28; y++) {
      const distY = Math.abs(y - 16);
      const half = Math.max(2, Math.round(12 - Math.max(0, distY - 4) * 1.15));
      px(ctx, 16 - half - 1, y, half * 2 + 2, 1, "#4a2c08");
      px(ctx, 16 - half, y, half * 2, 1, y < 12 ? "#ffe875" : y < 20 ? "#f4c438" : "#c78816");
    }
    // Crisp triangular center facet + dark gold facet ridges
    pxLine(ctx, 16, 6, 8, 20, 1, "#7d4f0c");
    pxLine(ctx, 16, 6, 24, 20, 1, "#7d4f0c");
    pxLine(ctx, 8, 20, 24, 20, 1, "#7d4f0c");
    // Highlighted "20" face center
    px(ctx, 12, 13, 3, 5, "#4a2c08");
    px(ctx, 13, 14, 1, 1, "#fff6b8");
    px(ctx, 17, 13, 3, 5, "#4a2c08");
    px(ctx, 18, 14, 1, 3, "#fff6b8");
    px(ctx, 14, 7, 4, 2, "#ffffff");
    sprites.item_d20 = canvas;
  }

  // 18) Enchanted Bag of Holding (D&D Basement treasure — violet pouch w/ golden drawstring & magic shimmer!)
  {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    pxEllipse(ctx, 16, 17, 13, 12, "rgba(182, 128, 255, 0.26)");
    // Gathered ruffle neck
    px(ctx, 10, 4, 12, 6, "#241238");
    px(ctx, 11, 5, 10, 4, "#8a52c4");
    px(ctx, 12, 5, 4, 3, "#b985f0");
    // Plump enchanted leather satchel body
    pxEllipse(ctx, 16, 19, 10.5, 9.5, "#241238");
    pxEllipse(ctx, 16, 19, 9.2, 8.2, "#6a389e");
    pxEllipse(ctx, 14, 17, 6.2, 5.5, "#945cd1");
    pxEllipse(ctx, 13, 15, 3.2, 2.5, "#c596fa");
    // Golden drawstring & gleaming star clasp!
    px(ctx, 9, 9, 14, 3, "#4a2c08");
    px(ctx, 10, 10, 12, 1, "#ffe066");
    px(ctx, 14, 15, 4, 4, "#ffe066");
    px(ctx, 15, 16, 2, 2, "#ffffff");
    sprites.item_bag = canvas;
  }

  // =========================================================================
  // 2. 2x HD COLLECTIBLES (2-Frame Spinning Gold Coin & Glossy Acorn!)
  // =========================================================================
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(18, 18);
    const rx = f === 0 ? 7.2 : 4.2;
    pxEllipse(ctx, 9, 9, rx + 1, 8.2, "#4a2c08");
    pxEllipse(ctx, 9, 9, rx, 7.0, "#e6ad24");
    pxEllipse(ctx, 8.5, 8.5, Math.max(1.5, rx - 1.6), 5.4, "#ffe066");
    px(ctx, 8, 5, 2, 8, "#fff8cf");
    if (f === 0) px(ctx, 6, 6, 2, 2, "#ffffff");
    sprites[f === 0 ? "drop_coin" : "drop_coin_1"] = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(16, 18);
    px(ctx, 7, 1, 2, 3, "#361e0d");
    pxEllipse(ctx, 8, 6, 6.5, 3.8, "#361e0d");
    pxEllipse(ctx, 8, 6, 5.4, 2.8, "#754420");
    pxEllipse(ctx, 7, 5, 3.2, 1.5, "#a66838");
    pxEllipse(ctx, 8, 11.5, 5.2, 5.2, "#361e0d");
    pxEllipse(ctx, 8, 11.5, 4.2, 4.2, "#c9853c");
    pxEllipse(ctx, 6.5, 10.5, 2.0, 2.4, "#f5be6e");
    px(ctx, 6, 9, 1, 2, "#fff0cc");
    sprites.drop_acorn = canvas;
  }

  // =========================================================================
  // 3. 5-FRAME 56x64 2x HD HERO SWORD SWING ARCS (*Minish Cap* / *ALttP* Grade!)
  // =========================================================================
  const makeHeroSwordSwing = (dir, frame) => {
    const isH = dir === "left" || dir === "right";
    const w = isH ? 56 : 64;
    const h = isH ? 64 : 56;
    const { canvas, ctx } = makeHdCanvas(w, h);
    const cx = dir === "right" ? 8 : dir === "left" ? w - 9 : Math.floor(w / 2);
    const cy = dir === "down" ? 8 : dir === "up" ? h - 9 : Math.floor(h / 2);
    const baseAngle =
      dir === "right" ? 0 : dir === "left" ? Math.PI : dir === "down" ? Math.PI / 2 : -Math.PI / 2;

    // 5 fluid sweep keyframes spanning -1.45 rad -> +1.45 rad!
    const sweepDefs = [
      { start: -1.42, end: -0.35, blade: -0.45, outerR: 34, innerR: 18, alpha: 0.85 },
      { start: -1.35, end: 0.45, blade: 0.35, outerR: 39, innerR: 16, alpha: 1.0 },
      { start: -1.15, end: 1.15, blade: 0.92, outerR: 41, innerR: 15, alpha: 1.0 },
      { start: -0.45, end: 1.38, blade: 1.28, outerR: 39, innerR: 20, alpha: 0.88 },
      { start: 0.35, end: 1.45, blade: 1.42, outerR: 36, innerR: 25, alpha: 0.56 },
    ];
    const sw = sweepDefs[frame % 5];

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r < sw.innerR || r > sw.outerR) continue;
        let diff = Math.atan2(dy, dx) - baseAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (diff < sw.start || diff > sw.end) continue;
        const t = (diff - sw.start) / Math.max(0.01, sw.end - sw.start);
        const rf = (r - sw.innerR) / Math.max(1, sw.outerR - sw.innerR);
        // Sculpted comet-tail crescent taper!
        const minRf = Math.pow(1 - t, 1.35) * 0.72;
        if (rf < minRf) continue;
        if (rf > 0.88 && t > 0.25) {
          px(ctx, x, y, 1, 1, "#ffffff");
        } else if (rf > 0.66) {
          px(ctx, x, y, 1, 1, t > 0.45 ? "#d8fbff" : "#fff4b8");
        } else if (rf > 0.4) {
          px(ctx, x, y, 1, 1, t > 0.35 ? "#6be0ff" : "#f4d35e");
        } else if ((x + y) % 2 === 0) {
          px(ctx, x, y, 1, 1, frame >= 3 ? "rgba(107, 224, 255, 0.45)" : "rgba(244, 211, 94, 0.55)");
        }
      }
    }

    // Gleaming 32-bit physical broadsword leading the crescent! (Hidden on fade-out frame 4)
    if (frame <= 3) {
      const bAng = baseAngle + sw.blade;
      const cosB = Math.cos(bAng);
      const sinB = Math.sin(bAng);
      const perpX = -sinB;
      const perpY = cosB;
      // Dark steel silhouette outline
      pxLine(ctx, cx + cosB * 5, cy + sinB * 5, cx + cosB * 37, cy + sinB * 37, 5, "#152540");
      // Cool steel bevel + bright white razor edge
      pxLine(ctx, cx + cosB * 7, cy + sinB * 7, cx + cosB * 36, cy + sinB * 36, 3, "#8ad8ff");
      pxLine(ctx, cx + cosB * 8 + perpX * 0.8, cy + sinB * 8 + perpY * 0.8, cx + cosB * 36 + perpX * 0.6, cy + sinB * 36 + perpY * 0.6, 1, "#ffffff");
      // Ornate winged golden crossguard + sapphire jewel
      pxLine(ctx, cx + cosB * 9 - perpX * 6, cy + sinB * 9 - perpY * 6, cx + cosB * 9 + perpX * 6, cy + sinB * 9 + perpY * 6, 4, "#4a2c08");
      pxLine(ctx, cx + cosB * 9 - perpX * 5, cy + sinB * 9 - perpY * 5, cx + cosB * 9 + perpX * 5, cy + sinB * 9 + perpY * 5, 2, "#ffe066");
      px(ctx, Math.round(cx + cosB * 9) - 1, Math.round(cy + sinB * 9) - 1, 2, 2, "#38d9ff");
      // Grip & gold pommel
      pxLine(ctx, cx + cosB * 3, cy + sinB * 3, cx + cosB * 8, cy + sinB * 8, 3, "#6b3818");
      px(ctx, Math.round(cx + cosB * 2) - 1, Math.round(cy + sinB * 2) - 1, 3, 3, "#f4d35e");
    }

    // Twinkling starlight glints along outer crescent rim!
    for (let s = 0; s < 3; s++) {
      const sAng = baseAngle + sw.start + (sw.end - sw.start) * (0.28 + s * 0.3);
      const sr = sw.outerR - 2 - (s % 2) * 4;
      const sx = Math.round(cx + Math.cos(sAng) * sr);
      const sy = Math.round(cy + Math.sin(sAng) * sr);
      px(ctx, sx, sy - 2, 1, 5, "#ffffff");
      px(ctx, sx - 2, sy, 5, 1, "#ffffff");
      px(ctx, sx, sy, 1, 1, "#fff6b8");
    }
    return canvas;
  };
  for (const dir of ["down", "up", "left", "right"]) {
    for (let f = 0; f < 5; f++) {
      sprites[`sword_slash_${dir}_${f}`] = makeHeroSwordSwing(dir, f);
    }
    sprites[`sword_slash_${dir}`] = sprites[`sword_slash_${dir}_2`];
  }

  // =========================================================================
  // 4. 2x HD INTERACTION FX SPRITES (Impact Flash, Sunburst, Beam, Cone, Wind, Dust!)
  // =========================================================================

  // Comic/SNES Sword Hit Impact Cross-Flash (2 frames)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(34, 34);
    const len = f === 0 ? 14 : 11;
    pxEllipse(ctx, 17, 17, f === 0 ? 8 : 6, f === 0 ? 8 : 6, "rgba(255, 240, 140, 0.55)");
    pxLine(ctx, 17 - len, 17 - len, 17 + len, 17 + len, f === 0 ? 3 : 2, "#ffe066");
    pxLine(ctx, 17 + len, 17 - len, 17 - len, 17 + len, f === 0 ? 3 : 2, "#ffe066");
    pxLine(ctx, 17 - len, 17 - len, 17 + len, 17 + len, 1, "#ffffff");
    pxLine(ctx, 17 + len, 17 - len, 17 - len, 17 + len, 1, "#ffffff");
    px(ctx, 15, 15, 4, 4, "#ffffff");
    sprites[`fx_hit_slash_${f}`] = canvas;
  }

  // Rotating Golden Overhead Item Fanfare / Siddur Sunburst Aura (2 frames)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(46, 46);
    pxEllipse(ctx, 23, 23, 18, 18, "rgba(255, 230, 118, 0.16)");
    pxEllipse(ctx, 23, 23, 12, 12, "rgba(255, 246, 178, 0.24)");
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4 + f * (Math.PI / 8);
      const r1 = 9;
      const r2 = i % 2 === 0 ? 21 : 16;
      pxLine(ctx, 23 + Math.cos(ang) * r1, 23 + Math.sin(ang) * r1, 23 + Math.cos(ang) * r2, 23 + Math.sin(ang) * r2, 2, "rgba(255, 244, 170, 0.72)");
    }
    sprites[`fx_fanfare_aura_${f}`] = canvas;
  }

  // Tapered Golden-Sapphire Siddur Dispel Light Pillar (replaces raw rectangles!)
  {
    const { canvas, ctx } = makeHdCanvas(34, 96);
    pxEllipse(ctx, 17, 88, 14, 5, "rgba(128, 218, 255, 0.42)");
    pxEllipse(ctx, 17, 88, 9, 3, "rgba(255, 242, 168, 0.65)");
    for (let y = 4; y < 88; y++) {
      const t = y / 88;
      const half = Math.round(5 + t * 7);
      px(ctx, 17 - half, y, half * 2, 1, "rgba(120, 214, 255, 0.28)");
      px(ctx, 17 - Math.max(2, Math.floor(half * 0.55)), y, Math.max(4, Math.floor(half * 1.1)), 1, "rgba(255, 242, 168, 0.48)");
      px(ctx, 16, y, 2, 1, "rgba(255, 255, 240, 0.72)");
    }
    sprites.fx_siddur_beam = canvas;
  }

  // Smooth Tapered Golden Flashlight Beam Cone (points right; rotated from Liam to spooked foe!)
  {
    const { canvas, ctx } = makeHdCanvas(64, 36);
    for (let x = 2; x < 62; x++) {
      const t = x / 62;
      const halfH = Math.max(2, Math.round(2 + t * 14));
      const a = Math.max(0.06, (1 - t * 0.65) * 0.42);
      px(ctx, x, 18 - halfH, 1, halfH * 2, `rgba(255, 238, 138, ${a.toFixed(2)})`);
      const coreH = Math.max(1, Math.round(halfH * 0.48));
      px(ctx, x, 18 - coreH, 1, coreH * 2, `rgba(255, 252, 214, ${(a * 1.2).toFixed(2)})`);
    }
    pxEllipse(ctx, 4, 18, 3, 3, "#ffffff");
    sprites.fx_flashlight_beam = canvas;
  }

  // Fluffy 3-Frame 2x HD Pixel Dust Cloud Puffs (replaces 3x3 drawRect dust squares!)
  for (let f = 0; f < 3; f++) {
    const { canvas, ctx } = makeHdCanvas(16, 16);
    const r = f === 0 ? 4.5 : f === 1 ? 5.5 : 3.5;
    const col = f === 2 ? "rgba(244, 238, 224, 0.55)" : "#f2ead8";
    const sh = f === 2 ? "rgba(204, 192, 172, 0.45)" : "#cfc2aa";
    pxEllipse(ctx, 8, 9, r, r * 0.85, sh);
    pxEllipse(ctx, 7, 7.5, r * 0.85, r * 0.75, col);
    if (f < 2) pxEllipse(ctx, 10.5, 8.5, r * 0.55, r * 0.5, "#ffffff");
    sprites[`fx_dust_${f}`] = canvas;
  }

  // Comic Wind-Gust Swirl (for Marathon Jogger zoom-by jostle!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(34, 24);
    const shift = f * 3;
    pxLine(ctx, 3 + shift, 6, 25 + shift, 5, 2, "#d8f8ff");
    pxLine(ctx, 25 + shift, 5, 29 + shift, 9, 2, "#ffffff");
    pxLine(ctx, 1 + shift, 13, 28 + shift, 12, 2, "#9cecff");
    pxLine(ctx, 6 + shift, 19, 24 + shift, 18, 2, "#e8fbff");
    pxLine(ctx, 24 + shift, 18, 27 + shift, 15, 2, "#ffffff");
    sprites[`fx_wind_swirl_${f}`] = canvas;
  }

  // Tapered Speedlines for Sprinting Joggers
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(28, 24);
    const col = f === 0 ? "#d8f8ff" : "#ffe875";
    px(ctx, 6, 4, 18, 2, col);
    px(ctx, 12, 4, 12, 1, "#ffffff");
    px(ctx, 2, 11, 24, 2, col);
    px(ctx, 10, 11, 16, 1, "#ffffff");
    px(ctx, 8, 18, 16, 2, col);
    sprites[`fx_speed_streak_${f}`] = canvas;
  }

  // 2x HD Gilded SNES Quest Destination Pointer (points right at 0°; rotates cleanly to any 360° bearing!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(38, 30);
    const cy = 15;
    // Soft luminous golden aura halo behind arrowhead
    pxEllipse(ctx, 20, cy, 16, 12, f === 0 ? "rgba(255, 224, 102, 0.24)" : "rgba(255, 238, 148, 0.34)");
    pxEllipse(ctx, 21, cy, 11, 8, "rgba(255, 246, 184, 0.22)");

    // Sculpted dark-bronze selective outline for tapered compass-wing arrowhead
    for (let x = 7; x <= 34; x++) {
      let half;
      if (x <= 15) {
        // Swept notched tail wings
        half = Math.round(6 + (x - 7) * 0.65);
      } else {
        // Tapered gleaming spearhead tip
        half = Math.max(0, Math.round(11.2 - (x - 15) * 0.59));
      }
      const notch = x < 14 ? Math.max(0, Math.round((14 - x) * 0.85)) : 0;
      if (notch > 0) {
        const span = Math.max(1, half - notch + 2);
        px(ctx, x, cy - half - 1, 1, span, "#26160a");
        px(ctx, x, cy + notch - 1, 1, span, "#26160a");
      } else {
        px(ctx, x, cy - half - 1, 1, half * 2 + 2, "#26160a");
      }
    }

    // Two-tone gilded brass-gold beveled facets (sunlit upper bevel, rich burnished-gold lower bevel!)
    for (let x = 9; x <= 32; x++) {
      let half;
      if (x <= 15) {
        half = Math.round(5 + (x - 9) * 0.68);
      } else {
        half = Math.max(0, Math.round(9.5 - (x - 15) * 0.56));
      }
      const notch = x < 14 ? Math.max(0, Math.round((14 - x) * 0.9)) : 0;
      if (notch > 0) {
        const span = Math.max(1, half - notch);
        px(ctx, x, cy - half, 1, span, "#ffe066");
        px(ctx, x, cy - half, 1, Math.min(2, span), "#fff8cf");
        px(ctx, x, cy + notch, 1, span, "#c98518");
      } else if (half > 0) {
        // Upper sunlit gold wing
        px(ctx, x, cy - half, 1, half, f === 0 ? "#ffe066" : "#ffea85");
        px(ctx, x, cy - half, 1, Math.min(2, half), "#fff9d6");
        // Lower shaded burnished-gold wing
        px(ctx, x, cy, 1, half, "#d99824");
        px(ctx, x, cy + Math.max(0, half - 2), 1, Math.min(2, half), "#a86612");
      }
    }

    // Bright center spine ridge + gleaming spear tip specular highlight
    px(ctx, 18, cy - 1, 14, 2, "#fff8cf");
    px(ctx, 29, cy - 1, 4, 2, "#ffffff");

    // Inset emerald-jade Explorer Compass Gem nestled in the arrowhead heart!
    pxEllipse(ctx, 18, cy, 4.2, 4.2, "#133d28");
    pxEllipse(ctx, 18, cy, 3.2, 3.2, f === 0 ? "#2ecc71" : "#4ef29a");
    pxEllipse(ctx, 17, cy - 1, 1.8, 1.6, "#a6ffd0");
    px(ctx, 16, cy - 2, 2, 1, "#ffffff");

    // Trailing twin gold starlight shimmer motes on alternate frame
    if (f === 1) {
      px(ctx, 3, cy - 1, 3, 2, "#ffe875");
      px(ctx, 4, cy - 2, 1, 4, "#ffffff");
      px(ctx, 34, cy - 1, 3, 2, "#ffffff");
      px(ctx, 35, cy - 2, 1, 4, "#fff6b8");
    }
    sprites[`fx_dest_pointer_${f}`] = canvas;
  }

  // Pulsing 2x HD Golden Star-Diamond Halo behind Destination Pointer
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(28, 28);
    const r = f === 0 ? 11 : 12.5;
    pxEllipse(ctx, 14, 14, r, r, "rgba(255, 224, 102, 0.16)");
    for (let i = 0; i < 4; i++) {
      const ang = (i * Math.PI) / 2 + (f === 1 ? Math.PI / 4 : 0);
      pxLine(
        ctx,
        14 + Math.cos(ang) * 7,
        14 + Math.sin(ang) * 7,
        14 + Math.cos(ang) * (f === 0 ? 12 : 13),
        14 + Math.sin(ang) * (f === 0 ? 12 : 13),
        2,
        "rgba(255, 244, 168, 0.72)"
      );
    }
    sprites[`fx_dest_ring_${f}`] = canvas;
  }

  // =========================================================================
  // 5. 2x HD GRAVEYARD PROPS UPGRADE (Ghosts, Bats, Wisps, Pumpkins, Lanterns & Tombstones!)
  // =========================================================================

  // Floating Graveyard Ghost (28x36 -> 14x18 logical)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(28, 36);
    pxEllipse(ctx, 14, 17, 12, 14, "rgba(170, 224, 255, 0.22)");
    pxEllipse(ctx, 14, 12, 9.5, 9.5, "#26324d");
    px(ctx, 5, 12, 18, 16, "#26324d");
    pxEllipse(ctx, 14, 12, 8.2, 8.2, "#eef8ff");
    px(ctx, 6, 12, 16, 15, "#eef8ff");
    px(ctx, 7, 8, 5, 16, "#ffffff");
    px(ctx, 18, 9, 4, 16, "#c2e0f5");
    // Animated billowing bottom scallops
    const off = f === 0 ? 0 : 2;
    px(ctx, 5 + off, 27, 5, 4, "#d8f0ff");
    px(ctx, 12, 27, 5, 5 - off, "#eef8ff");
    px(ctx, 19 - off, 27, 5, 4, "#c2e0f5");
    // Expressive eyes, catchlights, tiny 'o' mouth & rosy cheeks
    px(ctx, 9, 12, 3, 4, "#1a2033");
    px(ctx, 16, 12, 3, 4, "#1a2033");
    px(ctx, 9, 12, 1, 2, "#ffffff");
    px(ctx, 16, 12, 1, 2, "#ffffff");
    pxEllipse(ctx, 14, 19, 2.0, 2.2, "#2f3d59");
    px(ctx, 7, 16, 2, 2, "#ffb5d2");
    px(ctx, 19, 16, 2, 2, "#ffb5d2");
    sprites[`grave_ghost_${f}`] = canvas;
  }

  // Animated Flapping Graveyard Bat (24x16 -> 12x8 logical)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(24, 16);
    pxEllipse(ctx, 12, 8, 3.8, 4.2, "#191526");
    pxEllipse(ctx, 12, 8, 2.6, 3.0, "#332b4a");
    px(ctx, 9, 2, 2, 4, "#191526");
    px(ctx, 13, 2, 2, 4, "#191526");
    px(ctx, 10, 6, 1, 2, "#ff6b6b");
    px(ctx, 13, 6, 1, 2, "#ff6b6b");
    if (f === 0) {
      pxLine(ctx, 9, 7, 2, 3, 4, "#191526");
      pxLine(ctx, 9, 7, 3, 4, 2, "#4f4273");
      pxLine(ctx, 15, 7, 22, 3, 4, "#191526");
      pxLine(ctx, 15, 7, 21, 4, 2, "#4f4273");
    } else {
      pxLine(ctx, 9, 8, 2, 12, 4, "#191526");
      pxLine(ctx, 9, 8, 3, 11, 2, "#4f4273");
      pxLine(ctx, 15, 8, 22, 12, 4, "#191526");
      pxLine(ctx, 15, 8, 21, 11, 2, "#4f4273");
    }
    sprites[`grave_bat_${f}`] = canvas;
  }

  // Glowing Will-o'-the-Wisp Orb (18x18 -> 9x9 logical)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(18, 18);
    pxEllipse(ctx, 9, 9, 8, 8, f === 0 ? "rgba(110, 240, 224, 0.22)" : "rgba(176, 140, 255, 0.24)");
    pxEllipse(ctx, 9, 9, 5, 5, f === 0 ? "#5ceee0" : "#b896ff");
    pxEllipse(ctx, 8.5, 8.5, 2.5, 2.5, "#ffffff");
    sprites[`grave_wisp_${f}`] = canvas;
  }

  // Flickering Carved Jack-o'-Lantern (24x24 -> 12x12 logical)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(24, 24);
    pxEllipse(ctx, 12, 14, 11, 8, f === 0 ? "rgba(255, 166, 48, 0.22)" : "rgba(255, 204, 78, 0.34)");
    px(ctx, 10, 2, 4, 5, "#1f3b1c");
    px(ctx, 11, 3, 2, 3, "#499142");
    pxEllipse(ctx, 12, 13, 9.2, 7.6, "#451906");
    pxEllipse(ctx, 12, 13, 8.0, 6.4, "#de6618");
    pxEllipse(ctx, 11, 12, 5.4, 5.2, "#f78d2a");
    px(ctx, 8, 7, 1, 11, "#ad440c");
    px(ctx, 15, 7, 1, 11, "#ad440c");
    const flame = f === 0 ? "#ffe066" : "#ffffff";
    px(ctx, 7, 10, 3, 3, flame);
    px(ctx, 14, 10, 3, 3, flame);
    px(ctx, 7, 15, 10, 2, flame);
    px(ctx, 9, 15, 2, 1, "#ad440c");
    px(ctx, 13, 16, 2, 1, "#ad440c");
    sprites[`grave_pumpkin_${f}`] = canvas;
  }

  // Spooky Iron Graveyard Lantern Post (20x44 -> 10x22 logical)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(20, 44);
    pxEllipse(ctx, 10, 11, 9, 9, f === 0 ? "rgba(92, 232, 214, 0.24)" : "rgba(130, 255, 238, 0.36)");
    px(ctx, 8, 16, 4, 24, "#161a24");
    px(ctx, 9, 17, 2, 22, "#4f586b");
    px(ctx, 6, 38, 8, 4, "#161a24");
    px(ctx, 5, 5, 10, 12, "#161a24");
    px(ctx, 6, 6, 8, 10, f === 0 ? "#42d4bd" : "#8cffec");
    px(ctx, 8, 8, 4, 6, "#ffffff");
    px(ctx, 4, 3, 12, 3, "#2a3040");
    sprites[`grave_lantern_${f}`] = canvas;
  }

  // Weathered 2x HD Granite Tombstones (arch, cross, tilted — crisp moss, cracks & engravings!)
  {
    const { canvas, ctx } = makeHdCanvas(24, 32);
    pxEllipse(ctx, 12, 28, 9, 3, "rgba(14, 18, 26, 0.45)");
    px(ctx, 3, 22, 18, 7, "#1e222c");
    px(ctx, 4, 23, 16, 5, "#6c7482");
    px(ctx, 4, 23, 16, 2, "#9aa3b2");
    px(ctx, 5, 6, 14, 17, "#1e222c");
    pxEllipse(ctx, 12, 7, 7, 4.5, "#1e222c");
    px(ctx, 6, 7, 12, 16, "#8d96a6");
    pxEllipse(ctx, 12, 7.5, 6, 3.5, "#9aa3b2");
    px(ctx, 6, 7, 3, 15, "#bcc4d1");
    px(ctx, 15, 8, 3, 14, "#636a78");
    px(ctx, 8, 10, 8, 2, "#4a515e");
    px(ctx, 9, 14, 6, 2, "#4a515e");
    px(ctx, 6, 19, 4, 3, "#467554");
    px(ctx, 14, 6, 3, 2, "#467554");
    sprites.tombstone_arch = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(24, 36);
    pxEllipse(ctx, 12, 32, 9, 3, "rgba(14, 18, 26, 0.45)");
    px(ctx, 4, 26, 16, 7, "#1e222c");
    px(ctx, 5, 27, 14, 5, "#6c7482");
    px(ctx, 9, 3, 6, 24, "#1e222c");
    px(ctx, 3, 8, 18, 6, "#1e222c");
    px(ctx, 10, 4, 4, 23, "#969fae");
    px(ctx, 4, 9, 16, 4, "#969fae");
    px(ctx, 10, 4, 2, 22, "#c4ccd9");
    px(ctx, 4, 9, 15, 2, "#c4ccd9");
    pxEllipse(ctx, 12, 11, 3.5, 3.5, "#59606e");
    pxEllipse(ctx, 12, 11, 1.8, 1.8, "#969fae");
    px(ctx, 9, 22, 4, 4, "#3f6e4f");
    sprites.tombstone_cross = canvas;
  }
  {
    const { canvas, ctx } = makeHdCanvas(24, 32);
    pxEllipse(ctx, 12, 28, 9, 3, "rgba(14, 18, 26, 0.45)");
    for (let r = 0; r < 20; r++) {
      const sh = Math.floor(r / 5);
      px(ctx, 4 + sh, 5 + r, 13, 1, "#1e222c");
      px(ctx, 5 + sh, 5 + r, 11, 1, r < 5 ? "#7a8294" : "#5c6475");
      px(ctx, 5 + sh, 5 + r, 3, 1, "#9aa3b5");
    }
    px(ctx, 5, 24, 16, 5, "#1e222c");
    px(ctx, 6, 25, 14, 3, "#4f5666");
    px(ctx, 10, 10, 4, 3, "#c2cad9");
    px(ctx, 11, 16, 4, 2, "#2a2e38");
    sprites.tombstone_tilted = canvas;
  }
}
