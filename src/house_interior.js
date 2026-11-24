/**
 * Home Base Interior System (565 Boylston St) — 32-Bit 2x HD Pixel-Art Indoor Rooms!
 * Implements GDD Section 6.2 & Section 8.2 Home Base gameplay ideas:
 *   1. Main Floor (Cozy New England Living Room & Kitchen, Framed Art, Sunbeams, Hearth,
 *      Kitchen Snack Counter, Home Base Outfit Closet, Suspicious Sliding Bookshelf,
 *      and Billiards Pool Table / D&D Bookshelf Portal)
 *   2. Secret Upstairs Reading Nook (GDD 6.2 #4) — timber-beamed attic loft with skylight,
 *      twinkling fairy lights, book stacks, beanbag & glowing chest holding the Golden D20!
 *   3. 8-Bit / 32-Bit D&D Basement Dungeon (GDD 8.2 #19) — mossy stone flagstones, flickering
 *      wall torches, sculpted Halfling Bard, Gnome Wizard & Eldritch Knight statues,
 *      and a 3-switch arcane rune puzzle guarding the Bag of Holding!
 *
 * Pre-bakes 2x HD offscreen pixel canvases (__pixelScale = 0.5) for peak 32-bit pixel art
 * at 60 FPS on both Kaplay WebGL and HTML5 2D Canvas fallback, layered with live animated
 * fireplace flames, sunbeams, kettle steam, fairy lights, dungeon torches & magic runes!
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
    name: "8-BIT D&D BASEMENT DUNGEON",
    tag: "3-Switch Puzzle Room",
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

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawBeveledBox(ctx, x, y, w, h, { outline = "#241612", fill, hi, shade }) {
  px(ctx, x, y, w, h, outline);
  px(ctx, x + 2, y + 2, w - 4, h - 4, fill);
  if (hi) {
    px(ctx, x + 2, y + 2, w - 4, 2, hi);
    px(ctx, x + 2, y + 2, 2, h - 4, hi);
  }
  if (shade) {
    px(ctx, x + 2, y + h - 4, w - 4, 2, shade);
    px(ctx, x + w - 4, y + 2, 2, h - 4, shade);
  }
}

function drawShadow(ctx, x, y, w, h, alpha = 0.28) {
  px(ctx, x, y, w, h, `rgba(24, 12, 8, ${alpha})`);
}

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
    // 1. Exterior timber cut-away frame (cozy classic SNES indoor border)
    px(ctx, 0, 0, W, H, "#1e120e");
    px(ctx, 8, 8, W - 16, H - 16, "#362018");
    px(ctx, 14, 14, W - 28, H - 28, O);

    // 2. Warm New England cream wainscoted north wall + crown molding & wood paneling!
    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    const wallTop = 10;
    const wallBot = 2 * S;
    px(ctx, wallX, wallTop, wallW, wallBot - wallTop, "#efe1c4");
    // Subtle vertical colonial wallpaper stripes
    for (let sx = wallX; sx < wallX + wallW; sx += 12) {
      px(ctx, sx, wallTop + 6, 4, wallBot - wallTop - 20, "#e5d3b0");
    }
    // Crown molding along top ceiling line
    px(ctx, wallX, wallTop, wallW, 6, "#5e3620");
    px(ctx, wallX, wallTop + 6, wallW, 3, "#a86b3e");
    px(ctx, wallX, wallTop + 9, wallW, 2, "rgba(42, 20, 12, 0.25)");
    // Raised wood wainscoting & chair rail along lower half of wall
    px(ctx, wallX, wallBot - 22, wallW, 4, "#8c5430");
    px(ctx, wallX, wallBot - 20, wallW, 2, "#c98b52");
    px(ctx, wallX, wallBot - 18, wallW, 18, "#d9c29c");
    for (let wx = wallX + 6; wx < wallX + wallW - 14; wx += 22) {
      px(ctx, wx, wallBot - 14, 16, 10, "#c2a57a");
      px(ctx, wx + 2, wallBot - 12, 12, 6, "#e8d6b5");
    }
    px(ctx, wallX, wallBot - 4, wallW, 4, "#5c341d");

    // Side & bottom cut-away interior wainscoting trim walls
    px(ctx, wallX - 8, wallTop, 8, H - S - wallTop, "#4d2b1a");
    px(ctx, wallX - 4, wallTop, 4, H - S - wallTop, "#7a472a");
    px(ctx, wallX + wallW, wallTop, 8, H - S - wallTop, "#4d2b1a");
    px(ctx, wallX + wallW, wallTop, 4, H - S - wallTop, "#381e12");
    px(ctx, wallX - 8, H - S, wallW + 16, 10, "#4d2b1a");
    px(ctx, wallX - 4, H - S, wallW + 8, 4, "#7a472a");

    // 3. Detailed Honey-Oak Hardwood Floorboards (staggered planks, grain highlights & nail dots!)
    const floorTop = 2 * S;
    const floorBot = (room.height - 1) * S;
    const plankH = 8;
    const plankPalette = ["#c98849", "#bf7d3f", "#d49454", "#b57438", "#cc8c4c"];
    for (let py = floorTop; py < floorBot; py += plankH) {
      const rowIdx = Math.floor((py - floorTop) / plankH);
      const offset = (rowIdx * 23) % 44;
      for (let px0 = wallX - offset; px0 < wallX + wallW; px0 += 44) {
        const segX = Math.max(wallX, px0);
        const segEnd = Math.min(wallX + wallW, px0 + 44);
        const segW = segEnd - segX;
        if (segW <= 0) continue;
        const col = plankPalette[Math.abs(rowIdx * 7 + Math.floor(px0 / 44) * 13) % plankPalette.length];
        px(ctx, segX, py, segW, plankH, col);
        // Sunlit top wood sheen & dark horizontal seam
        px(ctx, segX, py, segW, 1, "#e3ab6b");
        px(ctx, segX, py + plankH - 1, segW, 1, "#7d4924");
        // Subtle wood-grain streak
        if (segW > 14) {
          px(ctx, segX + 6, py + 3, Math.min(14, segW - 10), 1, "#a6642e");
        }
        // Vertical plank butt joint + tiny iron floorboard nails!
        if (segX > wallX) {
          px(ctx, segX, py, 2, plankH, "#70401e");
          px(ctx, segX + 3, py + 2, 1, 1, "#5c3218");
          px(ctx, segX + 3, py + 5, 1, 1, "#5c3218");
        }
      }
    }
    // Soft ambient occlusion shadow cast by north wall onto floor
    px(ctx, wallX, floorTop, wallW, 8, "rgba(42, 20, 12, 0.24)");
    px(ctx, wallX, floorTop + 8, wallW, 4, "rgba(42, 20, 12, 0.12)");

    // 4. Kitchen Checkerboard Ceramic Tile Zone (top-right, tiles x=13..17, y=2..4) with grout & brass threshold!
    const kitX = 13 * S;
    const kitY = 2 * S;
    const kitW = 5 * S;
    const kitH = 3 * S;
    px(ctx, kitX - 4, kitY, 4, kitH + 4, "#8a6632"); // brass kitchen transition strip
    px(ctx, kitX - 4, kitY + kitH, kitW + 4, 4, "#8a6632");
    for (let ky = 0; ky < kitH; ky += 16) {
      for (let kx = 0; kx < kitW; kx += 16) {
        const light = ((kx / 16 + ky / 16) | 0) % 2 === 0;
        px(ctx, kitX + kx, kitY + ky, 16, 16, light ? "#f2ece1" : "#6b9687");
        px(ctx, kitX + kx, kitY + ky, 15, 2, light ? "#ffffff" : "#89b5a6");
        px(ctx, kitX + kx, kitY + ky + 15, 16, 1, "#4c635b");
        px(ctx, kitX + kx + 15, kitY + ky, 1, 16, "#4c635b");
      }
    }

    // 5. Intricate Woven Persian / New England Living-Room Rug (with braided border & cream tassels!)
    const rugX = 5 * S + 14;
    const rugY = 4 * S + 6;
    const rugW = 8 * S - 28;
    const rugH = 5 * S - 12;
    drawShadow(ctx, rugX + 4, rugY + 4, rugW, rugH, 0.22);
    // Cream woven fringe tassels on left & right ends of rug
    for (let ty = rugY + 4; ty < rugY + rugH - 4; ty += 6) {
      px(ctx, rugX - 6, ty, 6, 3, "#f2e6cf");
      px(ctx, rugX + rugW, ty, 6, 3, "#f2e6cf");
    }
    px(ctx, rugX, rugY, rugW, rugH, "#4f181a");
    px(ctx, rugX + 3, rugY + 3, rugW - 6, rugH - 6, "#a83232");
    px(ctx, rugX + 8, rugY + 8, rugW - 16, rugH - 16, "#e8b44c");
    px(ctx, rugX + 12, rugY + 12, rugW - 24, rugH - 24, "#295c4e");
    px(ctx, rugX + 18, rugY + 18, rugW - 36, rugH - 36, "#1f473c");
    // Decorative gold diamond medallion in center of rug
    const rmx = rugX + Math.floor(rugW / 2);
    const rmy = rugY + Math.floor(rugH / 2);
    for (let d = 0; d < 18; d += 2) {
      px(ctx, rmx - (18 - d), rmy - d / 2, (18 - d) * 2, d, d < 6 ? "#f7d472" : "#c74838");
    }
    px(ctx, rmx - 6, rmy - 4, 12, 8, "#f7d472");
    // Gold geometric corner dots
    for (const [gx, gy] of [
      [rugX + 14, rugY + 14],
      [rugX + rugW - 18, rugY + 14],
      [rugX + 14, rugY + rugH - 18],
      [rugX + rugW - 18, rugY + rugH - 18],
    ]) {
      px(ctx, gx, gy, 4, 4, "#f7d472");
    }

    // 6. Sunlit Colonial Multi-Pane Windows on North Wall + Framed Family Paintings!
    const drawInteriorWindow = (wx) => {
      px(ctx, wx - 3, 18, 44, 34, O);
      px(ctx, wx - 1, 20, 40, 30, "#f5efe4");
      // Autumn outdoor sky & treetops visible outside!
      px(ctx, wx + 3, 24, 32, 22, "#78b8e6");
      px(ctx, wx + 3, 24, 32, 10, "#ffe49e");
      px(ctx, wx + 5, 36, 12, 10, "#d95b26");
      px(ctx, wx + 20, 34, 13, 12, "#eb8b2b");
      // Crisp 6-pane colonial mullions + curtain drapes
      px(ctx, wx + 18, 24, 2, 22, "#f5efe4");
      px(ctx, wx + 3, 34, 32, 2, "#f5efe4");
      px(ctx, wx + 2, 23, 6, 24, "#366954");
      px(ctx, wx + 30, 23, 6, 24, "#366954");
      // Molded wooden windowsill
      px(ctx, wx - 5, 50, 48, 5, O);
      px(ctx, wx - 3, 51, 44, 3, "#ffffff");
    };
    drawInteriorWindow(6 * S + 4);
    drawInteriorWindow(12 * S + 4);

    // Framed tiny family pixel art on wall (Giants #7 Baseball Jersey frame!)
    px(ctx, 2 * S + 6, 22, 22, 24, O);
    px(ctx, 2 * S + 8, 24, 18, 20, "#d9a441");
    px(ctx, 2 * S + 10, 26, 14, 16, "#24364a");
    px(ctx, 2 * S + 13, 29, 8, 10, "#f5efe2");
    px(ctx, 2 * S + 11, 29, 3, 5, "#eb6a17");
    px(ctx, 2 * S + 20, 29, 3, 5, "#eb6a17");

    // 7. Suspicious Mahogany Bookshelf (slides aside smoothly to reveal recessed attic stairs!)
    if (state.bookshelfOpened) {
      // Recessed secret wooden staircase climbing up into warm attic light!
      const stX = 5 * S - 4;
      const stY = 1 * S + 8;
      px(ctx, stX, stY, 38, 56, O);
      px(ctx, stX + 2, stY + 2, 34, 52, "#382115");
      // Warm upstairs golden light spilling down the top steps
      px(ctx, stX + 4, stY + 2, 30, 12, "#ffdf82");
      for (let step = 0; step < 6; step++) {
        const sy = stY + 8 + step * 7;
        px(ctx, stX + 4, sy, 30, 5, step < 2 ? "#e8b366" : "#bf8042");
        px(ctx, stX + 4, sy, 30, 2, step < 2 ? "#ffdf9e" : "#dba05e");
        px(ctx, stX + 4, sy + 5, 30, 2, "#59321a");
      }
      // Wooden handrail
      px(ctx, stX + 32, stY + 4, 4, 48, "#8c5228");
    }
    const bsShift = state.bookshelfOpened ? -32 : 0;
    const bsX = 3 * S + bsShift;
    const bsY = 1 * S - 2;
    drawShadow(ctx, bsX + 4, bsY + 62, 3 * S, 8, 0.34);
    drawBeveledBox(ctx, bsX, bsY, 3 * S, 64, {
      outline: O,
      fill: "#6e3e22",
      hi: "#9e6038",
      shade: "#472512",
    });
    // Crown trim + 3 rich book shelves with individually shaded books & brass globe!
    px(ctx, bsX - 2, bsY - 4, 3 * S + 4, 6, O);
    px(ctx, bsX, bsY - 2, 3 * S, 3, "#a8683b");
    const bookColors = [
      ["#c93832", "#f2635c"],
      ["#2e6cb8", "#5ea0ed"],
      ["#328c4e", "#63bf7c"],
      ["#d99c2b", "#ffd261"],
      ["#7b42a8", "#b47be0"],
      ["#a84b2e", "#db7a58"],
    ];
    for (let shelf = 0; shelf < 3; shelf++) {
      const sy = bsY + 8 + shelf * 17;
      px(ctx, bsX + 5, sy, 3 * S - 10, 13, "#361c10");
      for (let b = 0; b < 11; b++) {
        const [darkC, hiC] = bookColors[(b * 3 + shelf * 2) % bookColors.length];
        const bh = 9 + ((b + shelf) % 3);
        const bx = bsX + 7 + b * 7;
        px(ctx, bx, sy + (13 - bh), 6, bh, darkC);
        px(ctx, bx + 1, sy + (13 - bh), 2, bh - 1, hiC);
        px(ctx, bx, sy + (13 - bh) + 2, 6, 1, "#f7e0a3"); // gold spine band!
      }
      // Thick shelf wood plank
      px(ctx, bsX + 4, sy + 13, 3 * S - 8, 3, "#8f542e");
    }

    // 8. Carved River-Stone Fireplace & Warm Wooden Mantel (center-north, x=8..11)
    const fpX = 8 * S;
    const fpY = 14;
    const fpW = 4 * S;
    const fpH = 2 * S + 14;
    drawShadow(ctx, fpX - 4, fpY + fpH, fpW + 8, 10, 0.34);
    // Stone hearth apron extending onto floor
    drawBeveledBox(ctx, fpX - 6, fpY + fpH - 8, fpW + 12, 16, {
      outline: O,
      fill: "#91857e",
      hi: "#bfb4ab",
      shade: "#635a56",
    });
    // Stacked granite & river-stone chimney breast
    drawBeveledBox(ctx, fpX, fpY, fpW, fpH - 4, {
      outline: O,
      fill: "#7d726c",
      hi: "#a89d96",
      shade: "#544c49",
    });
    for (let sy = fpY + 6; sy < fpY + fpH - 12; sy += 10) {
      for (let sx = fpX + 4; sx < fpX + fpW - 8; sx += 18) {
        const off = ((sy / 10) | 0) % 2 === 0 ? 0 : 8;
        const bx = Math.min(fpX + fpW - 14, sx + off);
        px(ctx, bx, sy, 14, 8, (sx + sy) % 3 === 0 ? "#998e86" : "#6b615d");
        px(ctx, bx + 1, sy + 1, 10, 2, "#b8ada4");
      }
    }
    // Carved oak mantel shelf with brass candlesticks & little framed picture!
    px(ctx, fpX - 6, fpY + 24, fpW + 12, 9, O);
    px(ctx, fpX - 4, fpY + 26, fpW + 8, 5, "#9c5c30");
    px(ctx, fpX - 4, fpY + 26, fpW + 8, 2, "#c9854f");
    // Tiny brass candlesticks + picture frame on mantel
    px(ctx, fpX + 10, fpY + 14, 6, 10, "#e6b84c");
    px(ctx, fpX + 11, fpY + 10, 4, 5, "#fff8e8");
    px(ctx, fpX + fpW - 16, fpY + 14, 6, 10, "#e6b84c");
    px(ctx, fpX + fpW - 15, fpY + 10, 4, 5, "#fff8e8");
    px(ctx, fpX + Math.floor(fpW / 2) - 10, fpY + 10, 20, 14, "#5c341d");
    px(ctx, fpX + Math.floor(fpW / 2) - 8, fpY + 12, 16, 10, "#99d4ed");
    // Deep arched dark firebox + stacked firewood logs
    px(ctx, fpX + 32, fpY + 38, fpW - 64, 34, O);
    px(ctx, fpX + 36, fpY + 42, fpW - 72, 28, "#21110e");
    px(ctx, fpX + 42, fpY + 60, fpW - 84, 7, "#63351c");
    px(ctx, fpX + 46, fpY + 56, fpW - 92, 6, "#8c4d28");

    // 9. Full 32-Bit Cozy New England Kitchen (Sage Cabinets, Marble Counter, Stove, Kettle & SNACK JAR!)
    const kcX = 14 * S;
    const kcY = 1 * S + 6;
    const kcW = 4 * S;
    const kcH = 54;
    drawShadow(ctx, kcX, kcY + kcH, kcW, 8, 0.28);
    // Upper hanging kitchen cabinets on north wall
    drawBeveledBox(ctx, kcX + 4, 14, 54, 24, {
      outline: O,
      fill: "#6a917d",
      hi: "#8fb8a3",
      shade: "#496959",
    });
    px(ctx, kcX + 30, 16, 2, 20, O);
    px(ctx, kcX + 25, 28, 3, 3, "#f4d35e");
    px(ctx, kcX + 34, 28, 3, 3, "#f4d35e");
    // Vintage cream refrigerator on far right with colorful kid magnets!
    drawBeveledBox(ctx, kcX + kcW - 34, 12, 34, 62, {
      outline: O,
      fill: "#f0e8d8",
      hi: "#ffffff",
      shade: "#c9bea8",
    });
    px(ctx, kcX + kcW - 32, 36, 30, 2, "#9c917e");
    px(ctx, kcX + kcW - 28, 22, 3, 10, "#94a3b8");
    px(ctx, kcX + kcW - 28, 42, 3, 14, "#94a3b8");
    // Kid drawing magnet on fridge!
    px(ctx, kcX + kcW - 20, 42, 12, 12, "#ffffff");
    px(ctx, kcX + kcW - 18, 44, 8, 4, "#52a8e6");
    px(ctx, kcX + kcW - 18, 48, 8, 4, "#5cb85c");
    px(ctx, kcX + kcW - 15, 42, 3, 3, "#e63946");

    // Main Kitchen Countertop + Stovetop + Overflowing Glass Snack Jar + Golden Bagels!
    drawBeveledBox(ctx, kcX, kcY + 14, kcW - 36, 40, {
      outline: O,
      fill: "#5b806d",
      hi: "#7fa692",
      shade: "#3c594a",
    });
    // Marble counter slab
    drawBeveledBox(ctx, kcX - 2, kcY + 6, kcW - 32, 18, {
      outline: O,
      fill: "#f5f1e8",
      hi: "#ffffff",
      shade: "#d4cbb8",
    });
    // Stovetop burner + shiny copper tea kettle (left side of counter)
    px(ctx, kcX + 6, kcY + 10, 20, 10, "#2b2e38");
    px(ctx, kcX + 10, kcY + 2, 12, 12, "#d4763b");
    px(ctx, kcX + 12, kcY + 4, 6, 4, "#ffb070");
    px(ctx, kcX + 12, kcY - 1, 8, 3, "#4a2a18");
    // BIG SHINING GLASS SNACK JAR filled with pretzels & cookies!
    px(ctx, kcX + 34, kcY - 8, 22, 24, O);
    px(ctx, kcX + 36, kcY - 6, 18, 20, "#bfe8f5");
    px(ctx, kcX + 38, kcY - 2, 14, 14, "#d98c3b"); // cookies & pretzels!
    px(ctx, kcX + 40, kcY, 5, 5, "#f5be6b");
    px(ctx, kcX + 46, kcY + 4, 5, 5, "#9c541f");
    px(ctx, kcX + 37, kcY - 4, 3, 14, "#ffffff"); // crisp glass reflection!
    px(ctx, kcX + 36, kcY - 11, 18, 5, "#cf3a32"); // red jar lid!
    // Plate of warm sesame bagels beside the snack jar!
    px(ctx, kcX + 60, kcY + 4, 24, 14, O);
    px(ctx, kcX + 62, kcY + 6, 20, 10, "#ffffff");
    px(ctx, kcX + 65, kcY + 7, 7, 7, "#d98a36");
    px(ctx, kcX + 68, kcY + 9, 2, 2, "#ffffff");
    px(ctx, kcX + 73, kcY + 8, 7, 7, "#c97a2b");
    px(ctx, kcX + 76, kcY + 10, 2, 2, "#ffffff");

    // 10. Home Base Outfit Closet (Carved Mahogany Wardrobe + Standing Mirror, left wall x=2, y=5..6)
    const clX = 2 * S - 2;
    const clY = 5 * S - 10;
    drawShadow(ctx, clX + 6, clY + 70, 36, 10, 0.34);
    drawBeveledBox(ctx, clX, clY, 38, 72, {
      outline: O,
      fill: "#7d4926",
      hi: "#ad6c3e",
      shade: "#4f2b14",
    });
    // Crown pediment on top of wardrobe
    px(ctx, clX - 2, clY - 6, 42, 8, O);
    px(ctx, clX, clY - 4, 38, 4, "#b57442");
    // Double paneled armoire doors with brass handles & peek of colorful outfits!
    drawBeveledBox(ctx, clX + 4, clY + 6, 14, 56, {
      outline: "#3d1f10",
      fill: "#965b32",
      hi: "#bf7d4d",
      shade: "#663a1c",
    });
    drawBeveledBox(ctx, clX + 20, clY + 6, 14, 56, {
      outline: "#3d1f10",
      fill: "#965b32",
      hi: "#bf7d4d",
      shade: "#663a1c",
    });
    px(ctx, clX + 14, clY + 32, 3, 6, "#f4d35e");
    px(ctx, clX + 21, clY + 32, 3, 6, "#f4d35e");
    // Tiny hanging outfit hanger icon carved at top!
    px(ctx, clX + 12, clY + 12, 14, 4, "#4f9beb");
    px(ctx, clX + 12, clY + 18, 14, 4, "#24d4cc");
    px(ctx, clX + 12, clY + 24, 14, 4, "#2d9e38");

    // 11. Plush Tufted Living Room Sofa + Wooden Coffee Table with Board Game!
    const sfX = 8 * S - 2;
    const sfY = 5 * S - 4;
    const sfW = 4 * S + 4;
    const sfH = 38;
    drawShadow(ctx, sfX + 4, sfY + sfH - 2, sfW, 10, 0.32);
    // Sofa backrest & rolled armrests
    drawBeveledBox(ctx, sfX, sfY, sfW, 16, {
      outline: O,
      fill: "#2e548a",
      hi: "#4d7dbf",
      shade: "#1d375e",
    });
    drawBeveledBox(ctx, sfX, sfY + 10, 14, 26, {
      outline: O,
      fill: "#365f99",
      hi: "#598ad1",
      shade: "#1f3c66",
    });
    drawBeveledBox(ctx, sfX + sfW - 14, sfY + 10, 14, 26, {
      outline: O,
      fill: "#365f99",
      hi: "#598ad1",
      shade: "#1f3c66",
    });
    // 3 plump tufted seat cushions + cozy throw pillows!
    for (let c = 0; c < 3; c++) {
      drawBeveledBox(ctx, sfX + 14 + c * 34, sfY + 14, 34, 22, {
        outline: "#192d4d",
        fill: "#4473b5",
        hi: "#6b9ce0",
        shade: "#28497a",
      });
    }
    // Throw pillows (gold & crimson)
    drawBeveledBox(ctx, sfX + 16, sfY + 12, 14, 12, { outline: O, fill: "#f4c44e", hi: "#ffe494", shade: "#c49022" });
    drawBeveledBox(ctx, sfX + sfW - 30, sfY + 12, 14, 12, { outline: O, fill: "#d94b43", hi: "#ff7e75", shade: "#992822" });

    // 12. Full 32-Bit Billiards / Pool Table & Glowing D&D Spellbook Portal Corner (x=14..16, y=7..8)
    const ptX = 14 * S - 2;
    const ptY = 7 * S - 2;
    const ptW = 3 * S + 4;
    const ptH = 2 * S + 4;
    drawShadow(ctx, ptX + 6, ptY + ptH - 2, ptW, 12, 0.36);
    // Mahogany rails + brass corner pockets
    drawBeveledBox(ctx, ptX, ptY, ptW, ptH, {
      outline: O,
      fill: "#6e3b1e",
      hi: "#9e5c34",
      shade: "#422110",
    });
    // Rich emerald billiard baize felt
    px(ctx, ptX + 8, ptY + 8, ptW - 16, ptH - 16, "#1f854b");
    px(ctx, ptX + 10, ptY + 10, ptW - 20, ptH - 20, "#2ba65e");
    px(ctx, ptX + 8, ptY + 8, ptW - 16, 4, "#166338"); // cushion rail shadow
    // 6 dark leather pockets with brass rims
    for (const [pkx, pky] of [
      [ptX + 4, ptY + 4],
      [ptX + ptW / 2 - 4, ptY + 3],
      [ptX + ptW - 12, ptY + 4],
      [ptX + 4, ptY + ptH - 12],
      [ptX + ptW / 2 - 4, ptY + ptH - 11],
      [ptX + ptW - 12, ptY + ptH - 12],
    ]) {
      px(ctx, pkx, pky, 8, 8, "#d9a841");
      px(ctx, pkx + 2, pky + 2, 4, 4, "#1a1412");
    }
    // Cue ball, colored billiard balls & wooden cue stick!
    px(ctx, ptX + 24, ptY + 28, 6, 6, "#ffffff");
    px(ctx, ptX + 62, ptY + 24, 6, 6, "#e63946");
    px(ctx, ptX + 68, ptY + 20, 6, 6, "#f4d35e");
    px(ctx, ptX + 68, ptY + 28, 6, 6, "#2c71c7");
    px(ctx, ptX + 74, ptY + 24, 6, 6, "#1f242d");
    px(ctx, ptX + 18, ptY + ptH - 8, 58, 3, "#e3b676"); // pool cue resting on rail!
    // Open Glowing D&D Rulebook & DM Screen on left edge of table!
    drawBeveledBox(ctx, ptX + 16, ptY + 36, 28, 18, {
      outline: "#1d1a4a",
      fill: "#3b5bd9",
      hi: "#7ec8ff",
      shade: "#22348c",
    });
    px(ctx, ptX + 20, ptY + 40, 8, 10, "#fff8dc");
    px(ctx, ptX + 32, ptY + 40, 8, 10, "#fff8dc");

    // 13. Front Entryway Threshold + Woven Welcome Mat (bottom center, x=9..10, y=10)
    const dmX = 9 * S - 2;
    const dmY = 10 * S + 4;
    px(ctx, dmX - 4, dmY + 24, 2 * S + 8, 8, "#ffe89e"); // warm outdoor sunlight under door!
    drawBeveledBox(ctx, dmX, dmY, 2 * S + 4, 24, {
      outline: O,
      fill: "#a86432",
      hi: "#cf874c",
      shade: "#73401c",
    });
    px(ctx, dmX + 6, dmY + 6, 2 * S - 8, 12, "#e0a85c");
    // Tiny potted plant beside entryway
    px(ctx, 7 * S + 10, 9 * S + 16, 16, 14, "#a84c32");
    px(ctx, 7 * S + 6, 9 * S + 4, 24, 14, "#367d38");
    px(ctx, 7 * S + 10, 9 * S + 2, 14, 10, "#63bf54");

    return canvas;
  }

  if (room.id === "upstairs_nook") {
    // 1. Sloped timber attic cut-away frame
    px(ctx, 0, 0, W, H, "#1b111a");
    px(ctx, 8, 8, W - 16, H - 16, "#36212c");
    px(ctx, 14, 14, W - 28, H - 28, O);

    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    // Sloped knotty pine attic rafters wall
    px(ctx, wallX, 10, wallW, 2 * S - 10, "#8f5936");
    for (let rx = wallX; rx < wallX + wallW; rx += 32) {
      px(ctx, rx, 10, 6, 2 * S - 10, "#5c341d");
      px(ctx, rx + 6, 10, 2, 2 * S - 10, "#b87a4b");
    }
    px(ctx, wallX, 2 * S - 6, wallW, 6, "#4f2b18");

    // Arched Twilight Dormer Skylight showing deep indigo sky & crescent moon!
    const skyX = 6 * S;
    px(ctx, skyX - 4, 12, 4 * S + 8, 44, O);
    px(ctx, skyX, 16, 4 * S, 36, "#243b73");
    px(ctx, skyX + 4, 20, 4 * S - 8, 28, "#33549e");
    // Crescent moon
    px(ctx, skyX + 20, 24, 10, 10, "#fff2a6");
    px(ctx, skyX + 24, 24, 8, 8, "#33549e");
    // Skylight sash bars
    px(ctx, skyX + 2 * S - 2, 16, 4, 36, "#d9c29c");
    px(ctx, skyX, 34, 4 * S, 4, "#d9c29c");

    // Honey-pine attic floor planks
    for (let py = 2 * S; py < (room.height - 1) * S; py += 8) {
      for (let px0 = wallX; px0 < wallX + wallW; px0 += 36) {
        const wSeg = Math.min(36, wallX + wallW - px0);
        px(ctx, px0, py, wSeg, 8, ((py / 8 + px0 / 36) | 0) % 2 === 0 ? "#ba7e49" : "#ad723f");
        px(ctx, px0, py, wSeg, 1, "#d69b63");
        px(ctx, px0, py + 7, wSeg, 1, "#784925");
      }
    }
    px(ctx, wallX, 2 * S, wallW, 8, "rgba(28, 12, 24, 0.25)");

    // Plush Cozy Patchwork Reading Rug in center!
    const rx = 5 * S;
    const ry = 3 * S - 4;
    const rw = 6 * S;
    const rh = 4 * S + 8;
    drawShadow(ctx, rx + 4, ry + 4, rw, rh, 0.25);
    drawBeveledBox(ctx, rx, ry, rw, rh, {
      outline: "#381e4f",
      fill: "#7d4ca3",
      hi: "#a874cf",
      shade: "#532f70",
    });
    px(ctx, rx + 10, ry + 10, rw - 20, rh - 20, "#f2d68d");
    px(ctx, rx + 14, ry + 14, rw - 28, rh - 28, "#9b64c7");

    // Tall Leaning Book Stacks (top-left & top-right!)
    for (const sx of [2 * S + 4, 11 * S + 4]) {
      drawShadow(ctx, sx + 4, 2 * S + 28, 3 * S - 8, 8, 0.3);
      drawBeveledBox(ctx, sx, 2 * S - 10, 3 * S - 8, 40, {
        outline: O,
        fill: "#663a1e",
        hi: "#8f5530",
        shade: "#422310",
      });
      const cols = ["#d9483b", "#3b82d9", "#46a858", "#e8b438", "#9e52bd"];
      for (let i = 0; i < 6; i++) {
        px(ctx, sx + 8 + i * 13, 2 * S - 4, 10, 26, cols[i % cols.length]);
        px(ctx, sx + 10 + i * 13, 2 * S - 2, 3, 22, "#fff5d6");
      }
    }

    // Plump Crimson Beanbag Chair + Open Storybook (x=12..13, y=6)
    const bbX = 12 * S;
    const bbY = 6 * S - 4;
    drawShadow(ctx, bbX + 4, bbY + 34, 52, 10, 0.3);
    drawBeveledBox(ctx, bbX, bbY, 54, 38, {
      outline: "#4a1418",
      fill: "#cc3f3b",
      hi: "#f5716c",
      shade: "#8f2220",
    });
    px(ctx, bbX + 12, bbY + 10, 30, 16, "#e6554e");

    // Glowing Gilded Treasure Chest holding the Golden D20 (center x=7..8, y=3)!
    const chX = 7 * S;
    const chY = 3 * S - 6;
    drawShadow(ctx, chX + 4, chY + 36, 2 * S, 8, 0.35);
    drawBeveledBox(ctx, chX, chY, 2 * S, 38, {
      outline: O,
      fill: state.d20ChestOpened ? "#e0a63a" : "#9c5624",
      hi: "#ffd866",
      shade: "#5c2e12",
    });
    px(ctx, chX + 4, chY + 16, 2 * S - 8, 4, O);
    px(ctx, chX + 26, chY + 12, 12, 12, "#f4d35e");
    px(ctx, chX + 29, chY + 15, 6, 6, "#241512");
    if (state.d20ChestOpened) {
      // Gleaming Golden D20 resting visibly on red velvet inside open chest!
      px(ctx, chX + 8, chY + 4, 2 * S - 16, 12, "#991f28");
      px(ctx, chX + 26, chY + 5, 12, 10, "#ffe46b");
      px(ctx, chX + 29, chY + 7, 6, 6, "#ffffff");
    }

    // Wooden Attic Stairs Down (bottom-left x=3, y=8)
    const dsX = 3 * S;
    const dsY = 8 * S - 4;
    px(ctx, dsX, dsY, 40, 36, O);
    for (let st = 0; st < 5; st++) {
      px(ctx, dsX + 4, dsY + 4 + st * 6, 32, 4, st % 2 === 0 ? "#d99d59" : "#b87c3e");
    }
    return canvas;
  }

  if (room.id === "dnd_basement") {
    // 1. Heavy 32-Bit Dungeon Cut-Away Stone Masonry Border
    px(ctx, 0, 0, W, H, "#10121c");
    px(ctx, 8, 8, W - 16, H - 16, "#24283b");
    px(ctx, 14, 14, W - 28, H - 28, "#0e1017");

    const wallX = 2 * S;
    const wallW = (room.width - 4) * S;
    // Carved stone-brick north dungeon wall with moss accents
    px(ctx, wallX, 10, wallW, 2 * S - 10, "#3b4259");
    for (let by = 12; by < 2 * S - 4; by += 12) {
      const off = ((by / 12) | 0) % 2 === 0 ? 0 : 14;
      for (let bx = wallX - off; bx < wallX + wallW; bx += 28) {
        const sx = Math.max(wallX, bx);
        const sw = Math.min(wallX + wallW, bx + 26) - sx;
        if (sw <= 2) continue;
        px(ctx, sx, by, sw, 10, (bx + by) % 5 === 0 ? "#4c5470" : "#3f4761");
        px(ctx, sx, by, sw, 2, "#636d8f");
        px(ctx, sx, by + 9, sw, 1, "#212536");
      }
    }
    // Dungeon banner tapestries hanging on north wall!
    for (const bx of [5 * S + 16, 11 * S + 16]) {
      px(ctx, bx, 14, 24, 42, "#1f121a");
      px(ctx, bx + 3, 16, 18, 36, "#8c2434");
      px(ctx, bx + 8, 22, 8, 16, "#f4d35e");
    }

    // Hand-Chiseled Mossy Dungeon Flagstones
    for (let ty = 2; ty < room.height - 1; ty++) {
      for (let tx = 2; tx < room.width - 2; tx++) {
        const fx = tx * S;
        const fy = ty * S;
        const hash = (tx * 19 + ty * 31) % 7;
        const baseC = hash === 0 ? "#353c52" : hash === 3 ? "#2b3042" : "#30364a";
        px(ctx, fx, fy, S, S, baseC);
        px(ctx, fx + 1, fy + 1, S - 2, 2, "#464e69");
        px(ctx, fx, fy + S - 2, S, 2, "#1c202e");
        px(ctx, fx + S - 2, fy, 2, S, "#1c202e");
        if (hash === 1) {
          // Subtle emerald dungeon moss tuft in stone crack!
          px(ctx, fx + 4, fy + S - 6, 8, 4, "#3b754c");
          px(ctx, fx + 6, fy + S - 5, 4, 2, "#5ca86e");
        }
      }
    }
    px(ctx, wallX, 2 * S, wallW, 10, "rgba(8, 10, 18, 0.38)");

    // Iron wall torch sconces
    for (const tx of [3, 7, 11, 14]) {
      const sx = tx * S + 12;
      px(ctx, sx, 26, 8, 22, "#181a24");
      px(ctx, sx + 2, 28, 4, 18, "#7d522c");
      px(ctx, sx - 2, 34, 12, 4, "#68728a");
    }

    // 3 Sculpted 32-Bit Hero Statues on Carved Stone Pedestals!
    const drawHeroStatue = (tx, kind) => {
      const sx = tx * S;
      const sy = 3 * S;
      drawShadow(ctx, sx - 2, sy + 24, 36, 10, 0.42);
      // Pedestal
      drawBeveledBox(ctx, sx, sy + 6, 32, 24, {
        outline: "#141621",
        fill: "#7c859e",
        hi: "#b0b8cf",
        shade: "#4e556b",
      });
      if (kind === "bard") {
        // Halfling Bard with emerald feathered cap & wooden lute!
        px(ctx, sx + 6, sy - 16, 20, 24, "#1e6e3e");
        px(ctx, sx + 9, sy - 14, 14, 18, "#3cb367");
        px(ctx, sx + 8, sy - 28, 16, 14, "#d9d0c1"); // carved stone face
        px(ctx, sx + 6, sy - 34, 20, 8, "#29964e"); // bard cap
        px(ctx, sx + 22, sy - 40, 4, 10, "#ffd859"); // feather plume!
        px(ctx, sx + 18, sy - 12, 10, 14, "#b8743b"); // lute!
      } else if (kind === "wizard") {
        // Gnome Wizard with tall starry sapphire hat, beard & glowing crystal staff!
        px(ctx, sx + 6, sy - 16, 20, 24, "#244c9c");
        px(ctx, sx + 9, sy - 14, 14, 18, "#4785e8");
        px(ctx, sx + 8, sy - 28, 16, 12, "#d9d0c1");
        px(ctx, sx + 9, sy - 18, 14, 8, "#f0f4fa"); // wizard beard!
        // Pointy wizard hat
        px(ctx, sx + 4, sy - 30, 24, 4, "#1f428a");
        px(ctx, sx + 8, sy - 38, 16, 8, "#3469cc");
        px(ctx, sx + 12, sy - 44, 8, 6, "#5492f5");
        px(ctx, sx + 14, sy - 36, 3, 3, "#ffe46b"); // star!
        // Crystal staff
        px(ctx, sx + 26, sy - 32, 4, 38, "#7a4c28");
        px(ctx, sx + 24, sy - 38, 8, 8, "#7ce8ff");
      } else {
        // Eldritch Knight with crimson-plumed helm, steel breastplate & kite shield!
        px(ctx, sx + 6, sy - 16, 20, 24, "#68738a");
        px(ctx, sx + 9, sy - 14, 14, 18, "#a6b2c9");
        px(ctx, sx + 8, sy - 30, 16, 16, "#8e99b0"); // knight helm
        px(ctx, sx + 10, sy - 24, 12, 3, "#1b1f2b"); // visor slit
        px(ctx, sx + 12, sy - 40, 8, 10, "#d9322c"); // crimson plume!
        // Arcane kite shield on right
        px(ctx, sx + 20, sy - 12, 12, 16, "#b82824");
        px(ctx, sx + 23, sy - 9, 6, 10, "#ffd859");
      }
    };
    drawHeroStatue(4, "bard");
    drawHeroStatue(9, "wizard");
    drawHeroStatue(13, "knight");

    // 3 Ornate Floor Rune Switch Plates (Emerald, Sapphire, Ruby)
    const swSpecs = [
      { tx: 4, lit: state.switchLit?.[0], fill: "#28b862", hi: "#82ffb4", dim: "#1e4733" },
      { tx: 9, lit: state.switchLit?.[1], fill: "#2e82eb", hi: "#8fd4ff", dim: "#1e3459" },
      { tx: 13, lit: state.switchLit?.[2], fill: "#e03b3b", hi: "#ff9999", dim: "#522126" },
    ];
    for (const sw of swSpecs) {
      const sx = sw.tx * S;
      const sy = 6 * S;
      drawBeveledBox(ctx, sx + 2, sy + 2, 28, 28, {
        outline: "#121520",
        fill: "#4a526b",
        hi: "#727c9c",
        shade: "#292e40",
      });
      px(ctx, sx + 6, sy + 6, 20, 20, sw.lit ? sw.fill : sw.dim);
      if (sw.lit) {
        px(ctx, sx + 10, sy + 10, 12, 12, sw.hi);
        px(ctx, sx + 13, sy + 13, 6, 6, "#ffffff");
      }
    }

    // Jeweled Arcane Treasure Chest holding the Bag of Holding (center-north x=8..9, y=2)!
    const bx = 8 * S;
    const by = 2 * S - 6;
    drawShadow(ctx, bx + 4, by + 36, 2 * S, 8, 0.4);
    drawBeveledBox(ctx, bx, by, 2 * S, 38, {
      outline: "#140e24",
      fill: state.bagChestOpened ? "#d9a43b" : state.dndSolved ? "#7c42bd" : "#4a5269",
      hi: state.dndSolved ? "#d4a8ff" : "#7c859e",
      shade: "#2b1c45",
    });
    px(ctx, bx + 4, by + 16, 2 * S - 8, 4, "#140e24");
    px(ctx, bx + 26, by + 12, 12, 12, state.dndSolved ? "#ffe46b" : "#5ca8ff");
    if (!state.dndSolved) {
      // Magical blue rune seal chains across locked chest!
      px(ctx, bx + 10, by + 6, 6, 26, "#5ca8ff");
      px(ctx, bx + 2 * S - 16, by + 6, 6, 26, "#5ca8ff");
    }

    // Glowing Arcane Portal Base Ring (bottom center x=8..9, y=9)
    px(ctx, 8 * S - 4, 9 * S - 2, 2 * S + 8, 28, "#18243d");
    px(ctx, 8 * S, 9 * S + 2, 2 * S, 20, "#2974bd");
    px(ctx, 8 * S + 8, 9 * S + 6, 2 * S - 16, 12, "#7ce8ff");

    return canvas;
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

  function getRoomCacheKey() {
    if (state.roomId === "main_floor") {
      return `int_main_bs${state.bookshelfOpened ? 1 : 0}`;
    }
    if (state.roomId === "upstairs_nook") {
      return `int_nook_d${state.d20ChestOpened ? 1 : 0}`;
    }
    const sw = state.switchLit.map((v) => (v ? "1" : "0")).join("");
    return `int_dnd_sw${sw}_s${state.dndSolved ? 1 : 0}_b${state.bagChestOpened ? 1 : 0}`;
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
        toast: "🐉 Whoosh! Warped into the 8-Bit D&D Basement Dungeon!",
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
        sourceLabel: "8-Bit D&D Basement Dungeon",
        speaker: "Unlocked Dungeon Chest",
        lines: [
          "You found the legendary BAG OF HOLDING!! (+35 XP!)",
          "Your pocket now holds up to 12 Neighborhood Snacks (already filled to the brim!) to share with sidewalk marchers!",
        ],
      };
    }

    return null;
  }

  /**
   * Blit the pre-baked 2x HD 32-bit room canvas + render live animated lighting,
   * hearth flames, sunlit window beams, kettle steam, fairy lights, dungeon torches & runes!
   */
  function drawInteriorRoom(k, elapsedTime = 0) {
    const room = getRoom();
    const T = TILE_SIZE;
    const baked = getBakedRoomCanvas();
    if (baked) {
      k.drawCanvas(baked.key, baked.canvas, 0, 0);
    }

    const flicker = Math.floor(elapsedTime * 8) % 2;
    const pulse = 0.5 + Math.sin(elapsedTime * 4.5) * 0.5;

    if (room.id === "main_floor") {
      // 1. Live Dancing Fireplace Flames + Warm Flickering Hearth Light Wash over the Rug!
      const flameH = 9 + Math.round(Math.sin(elapsedTime * 15) * 2);
      k.drawRect({
        pos: k.vec2(9 * T + 5, 2 * T - 2 - flameH),
        width: 22,
        height: flameH,
        color: k.rgb(245, 108, 32),
        opacity: 0.95,
      });
      k.drawRect({
        pos: k.vec2(9 * T + 9, 2 * T - flameH + 2),
        width: 14,
        height: Math.max(4, flameH - 3),
        color: k.rgb(255, 204, 68),
      });
      k.drawRect({
        pos: k.vec2(9 * T + 13, 2 * T - 4),
        width: 6,
        height: 4,
        color: k.rgb(255, 250, 210),
      });
      // Soft pulsing warm orange glow pool cast from hearth onto floor!
      k.drawRect({
        pos: k.vec2(7 * T + 8, 2 * T + 4),
        width: 5 * T,
        height: 36,
        color: k.rgb(255, 168, 72),
        opacity: 0.1 + pulse * 0.08,
      });

      // 2. Diagonal Golden-Hour Sunbeams pouring through both colonial windows!
      for (const wx of [6 * T + 4, 12 * T + 4]) {
        k.drawRect({
          pos: k.vec2(wx, 2 * T),
          width: 18,
          height: 36,
          color: k.rgb(255, 238, 168),
          opacity: 0.14 + pulse * 0.04,
        });
        k.drawRect({
          pos: k.vec2(wx + 4, 2 * T + 18),
          width: 20,
          height: 26,
          color: k.rgb(255, 224, 132),
          opacity: 0.09,
        });
      }

      // 3. Rising Cozy Steam Wisps from the Kitchen Kettle!
      const steamRise = Math.round((elapsedTime * 12) % 10);
      k.drawRect({
        pos: k.vec2(14 * T + 7 + (flicker ? 1 : 0), 1 * T + 2 - steamRise),
        width: 3,
        height: 3,
        color: k.rgb(255, 255, 255),
        opacity: Math.max(0.1, 0.7 - steamRise * 0.06),
      });

      // 4. Twinkling Golden Hint Sparkle on the Suspicious Bookshelf (until opened!)
      if (!state.bookshelfOpened && flicker === 0) {
        k.drawRect({ pos: k.vec2(4 * T + 8, 1 * T + 10), width: 3, height: 3, color: k.rgb(255, 248, 156) });
      }

      // 5. Arcane Cyan-Violet Shimmer drifting over the D&D Rulebooks on the Pool Table!
      const dndBob = Math.round(Math.sin(elapsedTime * 5) * 2);
      k.drawRect({
        pos: k.vec2(14 * T + 7, 8 * T - 1 + dndBob),
        width: 14,
        height: 9,
        color: flicker === 0 ? k.rgb(108, 214, 255) : k.rgb(188, 138, 255),
        opacity: 0.28 + pulse * 0.22,
      });
      return;
    }

    if (room.id === "upstairs_nook") {
      // Twinkling warm/pastel fairy string lights along the attic rafters!
      for (let lx = 2 * T + 6; lx < (room.width - 2) * T - 6; lx += 14) {
        const idx = Math.floor(lx / 14);
        const warm = (idx + flicker) % 2 === 0;
        const col = warm ? k.rgb(255, 232, 118) : k.rgb(255, 168, 208);
        k.drawRect({ pos: k.vec2(lx - 2, 1 * T + 10), width: 6, height: 6, color: col, opacity: 0.24 });
        k.drawRect({ pos: k.vec2(lx, 1 * T + 12), width: 2, height: 2, color: col });
      }
      // Twinkling stars in skylight
      k.drawRect({
        pos: k.vec2(8 * T + 4, 12),
        width: 2,
        height: 2,
        color: k.rgb(255, 248, 178),
        opacity: 0.45 + pulse * 0.55,
      });
      // Radiant golden aura around the Golden D20 Chest!
      k.drawRect({
        pos: k.vec2(7 * T - 4, 3 * T - 5),
        width: 2 * T + 8,
        height: T + 10,
        color: k.rgb(255, 224, 92),
        opacity: 0.16 + pulse * 0.2,
      });
      return;
    }

    if (room.id === "dnd_basement") {
      // Flickering Dungeon Wall Torches + Warm Torchlight Glow Pools!
      for (const tx of [3, 7, 11, 14]) {
        const fx = tx * T + 6;
        k.drawRect({
          pos: k.vec2(fx - 10, 6),
          width: 24,
          height: 24,
          color: k.rgb(255, 152, 48),
          opacity: 0.12 + pulse * 0.08,
        });
        k.drawRect({
          pos: k.vec2(fx, 10 - flicker),
          width: 4,
          height: 4 + flicker,
          color: flicker === 0 ? k.rgb(255, 158, 42) : k.rgb(255, 232, 112),
        });
      }
      // Glowing Arcane Energy Pulse on Lit Floor Switches!
      const swCols = [
        { tx: 4, col: k.rgb(76, 232, 134) },
        { tx: 9, col: k.rgb(88, 182, 255) },
        { tx: 13, col: k.rgb(248, 92, 92) },
      ];
      swCols.forEach((sw, i) => {
        if (!state.switchLit[i]) return;
        k.drawRect({
          pos: k.vec2(sw.tx * T - 2, 6 * T - 2),
          width: T + 4,
          height: T + 4,
          color: sw.col,
          opacity: 0.2 + pulse * 0.25,
        });
      });
      if (state.dndSolved) {
        k.drawRect({
          pos: k.vec2(8 * T - 4, 2 * T - 5),
          width: 2 * T + 8,
          height: T + 10,
          color: k.rgb(122, 236, 206),
          opacity: 0.18 + pulse * 0.24,
        });
      }
      // Swirling Cyan-Violet Dungeon Portal Ring!
      const pShift = Math.round(Math.sin(elapsedTime * 7) * 3);
      k.drawRect({
        pos: k.vec2(8 * T + 3 + pShift, 9 * T + 2),
        width: 20,
        height: 8,
        color: flicker === 0 ? k.rgb(142, 244, 255) : k.rgb(212, 168, 255),
        opacity: 0.55 + pulse * 0.35,
      });
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
