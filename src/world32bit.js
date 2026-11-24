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
 * Upgrade ground tiles, lush autumn New England trees, cobblestone sidewalks, leaf piles,
 * vintage glowing street lamps, street signs, vehicles & props to 32-bit 2x native pixels!
 */
export function upgradeAtlasTo32Bit(sprites, P) {
  // =========================================================================
  // 1. 32x32 AUTUMN GOLDEN-HOUR LAWNS, PARKS, DIRT, SAND & WOODS
  // =========================================================================
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
      drawGrassTuft(ctx, 5, 6, "#f7c259", P.grassLight, P.grassDark);
      drawGrassTuft(ctx, 21, 19, "#f7c259", P.grassLight, P.grassDark);
      drawFallenLeaf(ctx, 11, 25, 0);
      drawFallenLeaf(ctx, 25, 8, 1);
    } else if (v === 1) {
      drawGrassTuft(ctx, 8, 15, "#f7c259", P.grassLight, P.grassDark);
      drawGrassTuft(ctx, 20, 6, P.grassLight, P.grassMid, P.grassDark);
      drawFallenLeaf(ctx, 4, 26, 2);
      drawFallenLeaf(ctx, 24, 24, 0);
    } else {
      drawGrassTuft(ctx, 22, 8, P.grassLight, P.grassMid, P.grassDark);
      drawGrassTuft(ctx, 6, 21, "#f7c259", P.grassLight, P.grassDark);
      drawFallenLeaf(ctx, 14, 14, 1);
      drawFallenLeaf(ctx, 23, 25, 2);
      drawFallenLeaf(ctx, 7, 9, 0);
    }
    sprites[`grass_${v}`] = canvas;
  }

  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.grassBase);
    drawGrassTuft(ctx, 14, 16, P.grassLight, P.grassMid, P.grassDark);
    drawFallenLeaf(ctx, 6 + f, 8, 0);
    drawFallenLeaf(ctx, 21 - f, 20, 1);
    draw32BitFlower(ctx, 23 + f, 7, "#ffe975", "#d9892e", "#b82b22", "#576e28");
    draw32BitFlower(ctx, 7 - f, 22, "#fff5d6", "#d9b37c", "#e66717", "#576e28");
    sprites[`grass_flower_${f}`] = canvas;
  }

  // Warm Autumn-Olive Manicured Park Turf (mowed stripes + tiny golden leaves)
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
    if (v === 1) drawFallenLeaf(ctx, 15, 16, 1);
    sprites[`park_${v}`] = canvas;
  }

  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, P.parkStripeLight);
    drawGrassTuft(ctx, 16, 14, P.parkHighlight, P.parkBase, P.parkShadow);
    draw32BitFlower(ctx, 7 + f, 9, "#ffee7a", "#d9a926", "#c96e1e", P.parkShadow);
    drawFallenLeaf(ctx, 21 - f, 21, 0);
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
  // 2. WARM COBBLESTONE SIDEWALKS, DUSK ASPHALT, CREAM CROSSWALKS & WATER
  // =========================================================================
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    // Warm mortar base
    px(ctx, 0, 0, 32, 32, P.sidewalkMortar || "#5e4e50");
    // Staggered New England cobblestone pavers (4 rows of varied beveled stones!)
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
        // Stone body inset 1px for crisp dark mortar line
        px(ctx, sx + 1, y0 + 1, sw - 1, 7, fill);
        // Sunlit warm top-left bevel highlight + lower-right shadow
        px(ctx, sx + 1, y0 + 1, sw - 2, 1, P.sidewalkLight);
        px(ctx, sx + 1, y0 + 2, 1, 5, P.sidewalkLight);
        px(ctx, sx + 2, y0 + 7, sw - 2, 1, P.sidewalkDark || "#786666");
        x0 += sw;
      }
    }
    // Scattered crisp tiny autumn leaves on the cobblestones!
    if (v === 0) {
      drawFallenLeaf(ctx, 21, 11, 0);
    } else {
      drawFallenLeaf(ctx, 7, 23, 1);
    }
    sprites[`sidewalk_${v}`] = canvas;
  }

  // Warm Dusk-Brownish-Slate Asphalt Roads
  const buildAsphaltTile = (baseCol, lightCol, darkCol, seed) => {
    const { canvas, ctx } = makeHdCanvas(32, 32);
    px(ctx, 0, 0, 32, 32, baseCol);
    for (let y = 0; y < 32; y += 2) {
      for (let x = 0; x < 32; x += 2) {
        const r = h2(x, y, seed) % 15;
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
      px(ctx, 30, 3, 2, 26, "#e8d6c3");
      px(ctx, 30, 3, 1, 26, "#fff5e8");
    }
    sprites[`parking_${v}`] = canvas;
  }

  // Cozy Warm-Cream Zebra Crosswalks (matching reference image!)
  {
    const canvas = buildAsphaltTile(P.roadMain, P.roadMainLight, P.roadMainDark, 220);
    const ctx = canvas.getContext("2d");
    for (let y = 2; y < 30; y += 7) {
      px(ctx, 2, y, 28, 4, "#f2e5d8");
      px(ctx, 2, y, 28, 1, "#fffaf2");
      px(ctx, 2, y + 3, 28, 1, "#c4b0a2");
    }
    sprites.crosswalk_h = canvas;
  }
  {
    const canvas = buildAsphaltTile(P.roadMain, P.roadMainLight, P.roadMainDark, 221);
    const ctx = canvas.getContext("2d");
    for (let x = 2; x < 30; x += 7) {
      px(ctx, x, 2, 4, 28, "#f2e5d8");
      px(ctx, x, 2, 1, 28, "#fffaf2");
      px(ctx, x + 3, 2, 1, 28, "#c4b0a2");
    }
    sprites.crosswalk_v = canvas;
  }

  // Warm Concrete Highway Median Barriers
  {
    const canvas = buildAsphaltTile(P.highway || P.highwayBase, P.highwayLight || P.highwayTrack, P.highwayDark, 225);
    const ctx = canvas.getContext("2d");
    px(ctx, 0, 8, 32, 16, "#2b2022");
    px(ctx, 0, 9, 32, 3, "#e8dad0");
    px(ctx, 0, 12, 32, 6, "#bfb0a8");
    px(ctx, 0, 18, 32, 4, "#8a7a75");
    px(ctx, 0, 22, 32, 2, "#574948");
    for (const jx of [10, 22]) {
      px(ctx, jx, 9, 1, 13, "#6e5e5b");
      px(ctx, jx + 1, 9, 1, 13, "#f2e6dc");
    }
    px(ctx, 14, 11, 4, 2, "#f4c842");
    px(ctx, 15, 11, 2, 1, "#fff6b8");
    sprites.highway_median_h = canvas;
  }
  {
    const canvas = buildAsphaltTile(P.highway || P.highwayBase, P.highwayLight || P.highwayTrack, P.highwayDark, 226);
    const ctx = canvas.getContext("2d");
    px(ctx, 8, 0, 16, 32, "#2b2022");
    px(ctx, 9, 0, 3, 32, "#e8dad0");
    px(ctx, 12, 0, 6, 32, "#bfb0a8");
    px(ctx, 18, 0, 4, 32, "#8a7a75");
    px(ctx, 22, 0, 2, 32, "#574948");
    for (const jy of [10, 22]) {
      px(ctx, 9, jy, 13, 1, "#6e5e5b");
      px(ctx, 9, jy + 1, 13, 1, "#f2e6dc");
    }
    px(ctx, 11, 14, 2, 4, "#f4c842");
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
  // 3. 32-BIT AUTUMN NEW ENGLAND TREES (Crimson, Gold, Scarlet + Evergreen!)
  // =========================================================================
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

  // Deep Olive Evergreen Pine (rich green contrast against autumn crimson & gold!)
  {
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

  // Lush Green Boxwood Garden Shrub (complementary green accent like beside the Library!)
  {
    const { canvas, ctx } = makeHdCanvas(24, 22);
    ditherShadowEllipse(ctx, 12, 18, 9, 3);
    pxEllipse(ctx, 12, 12, 9.5, 7.5, "#192914");
    pxEllipse(ctx, 12, 12.5, 8.2, 6.2, "#2f4f22");
    pxEllipse(ctx, 11.5, 11, 6.8, 5, "#4c7830");
    pxEllipse(ctx, 10, 9.5, 4.8, 3.2, "#73a340");
    pxEllipse(ctx, 9, 8.5, 2.5, 1.8, "#a2cc58");
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
}
