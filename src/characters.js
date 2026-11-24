/**
 * 32-Bit All-Pixel-Driven Character Sprite Engine (48x56 native pixel sprites
 * rendered at 0.5 logical scale on a 640x360 pixel buffer -> 24x28 world units).
 *
 * Inspired by peak 32-bit pixel art (*The Legend of Zelda: The Minish Cap*,
 * *Metal Slug*, *Breath of Fire IV*, *Mother 3*):
 *  - 100% discrete integer pixels (zero vector polygons or anti-aliased blurring)
 *  - Hue-shifted 5-tone pixel shading (warm sunlit highlights -> cool deep shadows)
 *  - Automatic 1px Selective Colored Outlining ("sel-out") matching each material
 *  - Expressive 32-bit faces (lash line, colored iris, white specular catchlight,
 *    sculpted ears, side-profile nose, natural straight light-brown hair strands)
 *  - Liam's two switchable outfits:
 *      1. "polo": Royal-blue knitted kippah, collared blue polo with placket & buttons,
 *         multi-strand knotted white tzitzit, navy pants, red-and-white laced sneakers
 *      2. "baseball": Team Giants Little League uniform (#7 on back, 6-panel black cap
 *         with orange visor & 'G', cream pinstriped jersey with orange raglan sleeves,
 *         orange belt, white tzitzit, baseball pants, orange/black stirrups & cleats)
 *  - Matching 32-bit 44x52 Neighborhood NPCs!
 */

export const HERO_OUTFITS = {
  polo: { id: "polo", label: "Polo & Kippah", shortLabel: "Polo", icon: "👕" },
  baseball: { id: "baseball", label: "Little League", shortLabel: "Baseball", icon: "⚾" },
};

/**
 * Pure discrete integer pixel buffer with material tags for true 32-bit
 * selective colored outlining ("sel-out") and pixel-perfect horizontal mirroring.
 */
class PixelGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.colors = new Array(w * h).fill(null);
    this.mats = new Array(w * h).fill(null);
  }

  set(x, y, color, mat = "dark") {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const idx = iy * this.w + ix;
    this.colors[idx] = color;
    this.mats[idx] = mat;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.colors[y * this.w + x];
  }

  clear(x, y) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const idx = iy * this.w + ix;
    this.colors[idx] = null;
    this.mats[idx] = null;
  }

  rect(x, y, w, h, color, mat = "dark") {
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = x0 + Math.round(w);
    const y1 = y0 + Math.round(h);
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        this.set(px, py, color, mat);
      }
    }
  }

  /** Discrete integer-pixel filled ellipse (zero Canvas vector curves!) */
  ellipse(cx, cy, rx, ry, color, mat = "dark") {
    const minX = Math.floor(cx - rx);
    const maxX = Math.ceil(cx + rx);
    const minY = Math.floor(cy - ry);
    const maxY = Math.ceil(cy + ry);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = (px - cx) / Math.max(0.5, rx);
        const dy = (py - cy) / Math.max(0.5, ry);
        if (dx * dx + dy * dy <= 1.0) {
          this.set(px, py, color, mat);
        }
      }
    }
  }

  /** Discrete Bresenham pixel line */
  line(x0, y0, x1, y1, color, mat = "dark") {
    let ax = Math.round(x0);
    let ay = Math.round(y0);
    const bx = Math.round(x1);
    const by = Math.round(y1);
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1;
    const sy = ay < by ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this.set(ax, ay, color, mat);
      if (ax === bx && ay === by) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        ax += sx;
      }
      if (e2 < dx) {
        err += dx;
        ay += sy;
      }
    }
  }

  /**
   * 32-bit Selective Colored Outlining ("sel-out"):
   * Surrounds the sprite silhouette with a crisp 1px material-tinted dark outline
   * (deep chestnut around hair, warm umber around skin, deep indigo around navy/blue, etc.)
   */
  applySelOut(outlineMap) {
    const origColors = this.colors.slice();
    const origMats = this.mats.slice();
    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const idx = y * this.w + x;
        if (origColors[idx] !== null) continue;
        // Find highest-priority adjacent opaque pixel material
        let foundMat = null;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const nIdx = ny * this.w + nx;
          if (origColors[nIdx] !== null) {
            foundMat = origMats[nIdx] || "dark";
            // Ground/shoe dark outlines always win at bottom contact
            if (foundMat === "shoe" || foundMat === "dark") break;
          }
        }
        if (foundMat) {
          this.colors[idx] = outlineMap[foundMat] || outlineMap.dark || "#1a1824";
          this.mats[idx] = "outline";
        }
      }
    }
  }

  flipHorizontal() {
    const out = new PixelGrid(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const src = y * this.w + x;
        const dst = y * this.w + (this.w - 1 - x);
        out.colors[dst] = this.colors[src];
        out.mats[dst] = this.mats[src];
      }
    }
    return out;
  }

  toCanvas(pixelScale = 0.5, shadowSpec = null) {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.__pixelScale = pixelScale;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    // Optional soft layered pixel-dithered ground shadow underneath character
    if (shadowSpec) {
      const { cx, cy, rx, ry } = shadowSpec;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const d2 = dx * dx + dy * dy;
          if (d2 <= 0.55) {
            ctx.fillStyle = "rgba(14, 24, 18, 0.42)";
            ctx.fillRect(x, y, 1, 1);
          } else if (d2 <= 1.0 && (x + y) % 2 === 0) {
            ctx.fillStyle = "rgba(14, 24, 18, 0.28)";
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }

    for (let y = 0; y < this.h; y++) {
      const row = y * this.w;
      for (let x = 0; x < this.w; x++) {
        const c = this.colors[row + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  }
}

// =============================================================================
// HUE-SHIFTED 32-BIT COLOR PALETTES FOR LIAM
// =============================================================================

const LIAM_PAL = {
  // Warm 7-year-old skin (warm peach highlight -> rosy umber shadow)
  skinHi: "#ffe8cf",
  skinMid: "#fad0a8",
  skinShade: "#e3a67b",
  skinDeep: "#c27d57",
  cheek: "#f08c7d",
  mouth: "#bd4a48",
  mouthDark: "#82272a",
  eyeLash: "#191522",
  eyeIris: "#6b4426",
  eyeIrisHi: "#9c673b",
  white: "#ffffff",

  // Liam's straight light-brown hair (5 rich hue-shifted tones!)
  hairSpec: "#f2d8a2",
  hairHi: "#d9ae71",
  hairMid: "#b58148",
  hairShade: "#8c5b2f",
  hairDeep: "#633c1c",

  // Royal-blue knitted kippah
  kipHi: "#8cc2ff",
  kipMid: "#4480de",
  kipShade: "#2452a8",
  kipDeep: "#153470",
  kipRimHi: "#f2f8ff",
  kipRimShade: "#b6ccf0",

  // Collared royal/sky polo shirt (5 tones)
  poloSpec: "#85c4ff",
  poloHi: "#4f9beb",
  poloMid: "#2c71c7",
  poloShade: "#1c4e91",
  poloDeep: "#133463",
  collarHi: "#f5faff",
  collarShade: "#c2daf5",

  // Deep navy pants (high contrast behind white tzitzit!)
  pantsHi: "#5474ab",
  pantsMid: "#365080",
  pantsShade: "#233659",
  pantsDeep: "#15223b",

  // Sporty red-and-white sneakers
  shoeHi: "#ff7261",
  shoeMid: "#de3b31",
  shoeShade: "#a3201b",
  shoeSole: "#f5f8fc",
  shoeSoleShade: "#bcc9d9",

  // Hanging white tzitzit (multi-strand shaded)
  tzWhite: "#ffffff",
  tzShade: "#d9e3f0",
  tzKnot: "#a9b9cf",

  // Little League Team Giants Uniform (#7)
  capHi: "#596275",
  capMid: "#333845",
  capShade: "#1e212b",
  capDeep: "#12141a",
  orangeHi: "#ffb05c",
  orangeMid: "#eb6a17",
  orangeShade: "#b54409",
  orangeDeep: "#7a2b04",
  jerseyHi: "#ffffff",
  jerseyMid: "#f2ede2",
  jerseyShade: "#d9d0be",
  jerseyStripe: "#ded6c5",
  bbPantsHi: "#f5f8fc",
  bbPantsMid: "#d9e1ed",
  bbPantsShade: "#b4c0d4",
  cleatHi: "#555d70",
  cleatMid: "#2a2e38",
  cleatShade: "#16181f",
};

const LIAM_SELOUT = {
  hair: "#422712",
  skin: "#7d482e",
  kippah: "#10244d",
  polo: "#0e2247",
  pants: "#0f192e",
  shoe: "#1a1520",
  tzitzit: "#5c6c82",
  cap: "#11131a",
  orange: "#592005",
  jersey: "#5c5548",
  scooter: "#141e26",
  dark: "#181620",
};

// =============================================================================
// 32-BIT LIAM — FRONT / BACK / SIDE DRAWING PRIMITIVES (48x56 PIXEL GRID)
// =============================================================================

function draw32BitSneaker(g, x, y, facing, outfit, lifted = false) {
  const isBB = outfit === "baseball";
  const hi = isBB ? LIAM_PAL.cleatHi : LIAM_PAL.shoeHi;
  const mid = isBB ? LIAM_PAL.cleatMid : LIAM_PAL.shoeMid;
  const sh = isBB ? LIAM_PAL.cleatShade : LIAM_PAL.shoeShade;
  const sole = LIAM_PAL.shoeSole;
  const soleSh = LIAM_PAL.shoeSoleShade;
  const yOff = lifted ? -1 : 0;

  if (facing === "right") {
    // Detailed side-view sporty sneaker pointing right (9x6 px!)
    g.rect(x, y + yOff, 6, 4, mid, "shoe");
    g.rect(x + 1, y + yOff, 4, 1, hi, "shoe");
    g.rect(x, y + 3 + yOff, 6, 1, sh, "shoe");
    // Rounded sculpted toe cap pointing right
    g.rect(x + 6, y + 1 + yOff, 2, 3, mid, "shoe");
    g.set(x + 7, y + 2 + yOff, sole, "shoe"); // White rubber toe bumper
    g.set(x + 7, y + 3 + yOff, sole, "shoe");
    // Crisp white criss-cross laces + sporty side stripe!
    g.set(x + 4, y + yOff, sole, "shoe");
    g.set(x + 5, y + 1 + yOff, sole, "shoe");
    g.line(x + 1, y + 2 + yOff, x + 4, y + 2 + yOff, isBB ? LIAM_PAL.orangeMid : sole, "shoe");
    // Shaded white outsole
    g.rect(x, y + 4 + yOff, 8, 1, sole, "shoe");
    g.rect(x + 1, y + 5 + yOff, 7, 1, soleSh, "shoe");
    if (isBB) {
      // Tiny cleat studs underneath!
      g.set(x + 1, y + 5 + yOff, LIAM_PAL.capDeep, "shoe");
      g.set(x + 4, y + 5 + yOff, LIAM_PAL.capDeep, "shoe");
      g.set(x + 6, y + 5 + yOff, LIAM_PAL.capDeep, "shoe");
    }
  } else {
    // Front/back view sculpted sneaker (7x6 px)
    g.rect(x, y + yOff, 7, 4, mid, "shoe");
    g.rect(x + 1, y + yOff, 5, 1, hi, "shoe");
    g.rect(x, y + 3 + yOff, 7, 1, sh, "shoe");
    // White laces + rubber toe-cap highlight
    if (facing === "down") {
      g.rect(x + 2, y + yOff, 3, 1, sole, "shoe");
      g.set(x + 3, y + 1 + yOff, sole, "shoe");
      g.rect(x + 1, y + 3 + yOff, 5, 1, sole, "shoe");
    }
    // White rubber outsole
    g.rect(x, y + 4 + yOff, 7, 1, sole, "shoe");
    g.rect(x + 1, y + 5 + yOff, 5, 1, soleSh, "shoe");
  }
}

function draw32BitTzitzit(g, x, y, sway = 0, sideView = false) {
  // Wrapped upper knot (gedil) + twin delicate white hanging strings!
  g.rect(x, y, 2, 2, LIAM_PAL.tzWhite, "tzitzit");
  g.set(x + 1, y + 1, LIAM_PAL.tzKnot, "tzitzit");
  // Strand 1
  g.set(x, y + 2, LIAM_PAL.tzWhite, "tzitzit");
  g.set(x + sway, y + 3, LIAM_PAL.tzWhite, "tzitzit");
  g.set(x + sway, y + 4, LIAM_PAL.tzShade, "tzitzit");
  // Strand 2 (slightly offset for authentic multi-strand look!)
  const s2 = sideView ? 2 : 1;
  g.set(x + s2, y + 2, LIAM_PAL.tzShade, "tzitzit");
  g.set(x + s2 + sway, y + 3, LIAM_PAL.tzWhite, "tzitzit");
  g.set(x + s2 + sway, y + 4, LIAM_PAL.tzWhite, "tzitzit");
  g.set(x + s2 + sway, y + 5, LIAM_PAL.tzShade, "tzitzit");
}

function draw32BitHeadFront(g, cx, topY, outfit, happyFanfare = false) {
  // 1. Sculpted rounded 32-bit head oval (18x18 px)
  g.ellipse(cx, topY + 13, 8.2, 8.2, LIAM_PAL.skinMid, "skin");
  // Warm forehead & cheek highlights
  g.ellipse(cx - 1, topY + 11, 5.5, 4.5, LIAM_PAL.skinHi, "skin");
  // Sculpted jawline & chin shadow (classic 32-bit warmth!)
  g.rect(cx - 5, topY + 19, 11, 1, LIAM_PAL.skinShade, "skin");
  g.rect(cx - 3, topY + 20, 7, 1, LIAM_PAL.skinDeep, "skin");
  // Cute sculpted ears with inner ear shadow
  g.rect(cx - 9, topY + 12, 2, 4, LIAM_PAL.skinMid, "skin");
  g.set(cx - 9, topY + 13, LIAM_PAL.skinShade, "skin");
  g.set(cx - 8, topY + 14, LIAM_PAL.skinDeep, "skin");
  g.rect(cx + 8, topY + 12, 2, 4, LIAM_PAL.skinMid, "skin");
  g.set(cx + 9, topY + 13, LIAM_PAL.skinShade, "skin");
  g.set(cx + 8, topY + 14, LIAM_PAL.skinDeep, "skin");

  // 2. Straight light-brown hair (5-tone sculpted strands + clean straight bangs!)
  g.ellipse(cx, topY + 8, 8.6, 5.5, LIAM_PAL.hairMid, "hair");
  // Straight side locks framing temples cleanly
  g.rect(cx - 8, topY + 8, 2, 5, LIAM_PAL.hairShade, "hair");
  g.rect(cx + 7, topY + 8, 2, 5, LIAM_PAL.hairShade, "hair");
  g.set(cx - 8, topY + 12, LIAM_PAL.hairDeep, "hair");
  g.set(cx + 8, topY + 12, LIAM_PAL.hairDeep, "hair");
  // Clean straight fringe across forehead with subtle vertical hair strands!
  g.rect(cx - 7, topY + 9, 15, 2, LIAM_PAL.hairMid, "hair");
  for (let hx = cx - 6; hx <= cx + 6; hx += 3) {
    g.line(hx, topY + 5, hx, topY + 10, LIAM_PAL.hairShade, "hair");
    g.line(hx + 1, topY + 5, hx + 1, topY + 9, LIAM_PAL.hairHi, "hair");
  }
  // Natural sunlit straight hair sheen band across crown
  g.rect(cx - 5, topY + 5, 11, 2, LIAM_PAL.hairHi, "hair");
  g.rect(cx - 3, topY + 5, 6, 1, LIAM_PAL.hairSpec, "hair");
  // Subtle forehead shadow directly under straight bangs
  g.rect(cx - 6, topY + 11, 13, 1, LIAM_PAL.skinShade, "skin");
  // Hair under-edge shadow
  g.rect(cx - 7, topY + 10, 15, 1, LIAM_PAL.hairDeep, "hair");
  g.set(cx - 2, topY + 10, LIAM_PAL.hairShade, "hair"); // Subtle natural part!
  g.set(cx + 3, topY + 10, LIAM_PAL.hairShade, "hair");

  // 3. Expressive 32-bit eyes (lash line + warm hazel iris + dark pupil + white catchlight!)
  for (const side of [-1, 1]) {
    const ex = side < 0 ? cx - 5 : cx + 3;
    const ey = topY + 13;
    // Upper dark eyelash arch
    g.rect(ex, ey, 3, 1, LIAM_PAL.eyeLash, "skin");
    // Eye white & rich iris
    g.rect(ex, ey + 1, 3, 3, LIAM_PAL.eyeLash, "skin");
    g.set(ex + 1, ey + 2, LIAM_PAL.eyeIris, "skin");
    g.set(ex + 1, ey + 3, LIAM_PAL.eyeIrisHi, "skin");
    // Bright white catchlight sparkle!
    g.set(ex + (side < 0 ? 0 : 0), ey + 1, LIAM_PAL.white, "skin");
    g.set(ex + 2, ey + 3, "#e8f0fa", "skin");
  }
  // Cute sculpted nose + warm rosy cheeks + cheerful 7-year-old smile!
  g.set(cx, topY + 16, LIAM_PAL.skinShade, "skin");
  g.set(cx, topY + 15, LIAM_PAL.skinHi, "skin");
  g.rect(cx - 6, topY + 16, 2, 1, LIAM_PAL.cheek, "skin");
  g.rect(cx + 5, topY + 16, 2, 1, LIAM_PAL.cheek, "skin");
  if (happyFanfare) {
    // Big beaming SMB3 / Minish Cap triumph grin!
    g.rect(cx - 2, topY + 17, 5, 2, LIAM_PAL.mouthDark, "skin");
    g.rect(cx - 1, topY + 17, 3, 1, LIAM_PAL.white, "skin");
    g.rect(cx - 1, topY + 18, 3, 1, LIAM_PAL.mouth, "skin");
  } else {
    g.rect(cx - 1, topY + 18, 3, 1, LIAM_PAL.mouth, "skin");
    g.set(cx - 2, topY + 17, LIAM_PAL.skinShade, "skin");
    g.set(cx + 2, topY + 17, LIAM_PAL.skinShade, "skin");
  }

  // 4. Headwear: Royal-Blue Knitted Kippah OR Team Giants Little League Cap!
  if (outfit === "baseball") {
    // 6-panel black cap dome
    g.ellipse(cx, topY + 6, 8.8, 5.2, LIAM_PAL.capMid, "cap");
    g.ellipse(cx - 1, topY + 4, 6.2, 3.0, LIAM_PAL.capHi, "cap");
    g.rect(cx - 8, topY + 7, 17, 2, LIAM_PAL.capShade, "cap");
    // Panel seam lines + orange top button
    g.line(cx - 4, topY + 2, cx - 5, topY + 8, LIAM_PAL.capDeep, "cap");
    g.line(cx + 4, topY + 2, cx + 5, topY + 8, LIAM_PAL.capDeep, "cap");
    g.rect(cx - 1, topY + 1, 3, 1, LIAM_PAL.orangeMid, "orange");
    // Crisp orange front 'G' badge!
    g.rect(cx - 1, topY + 4, 3, 3, LIAM_PAL.orangeMid, "orange");
    g.set(cx, topY + 5, LIAM_PAL.capMid, "cap");
    g.set(cx + 1, topY + 5, LIAM_PAL.orangeHi, "orange");
    // Curved Giants orange baseball bill + under-brim shadow!
    g.ellipse(cx, topY + 9, 9.2, 2.2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 7, topY + 8, 15, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx - 7, topY + 10, 15, 1, LIAM_PAL.orangeShade, "orange");
  } else {
    // Royal-blue knitted kippah perched cleanly on Liam's straight light-brown hair!
    g.ellipse(cx, topY + 4, 5.8, 3.4, LIAM_PAL.kipMid, "kippah");
    g.ellipse(cx - 1, topY + 3, 3.6, 1.8, LIAM_PAL.kipHi, "kippah");
    // Subtle knitted stitch texture pixels
    for (let kx = cx - 4; kx <= cx + 4; kx += 2) {
      g.set(kx, topY + 4, LIAM_PAL.kipShade, "kippah");
      g.set(kx + 1, topY + 3, LIAM_PAL.kipHi, "kippah");
    }
    // Braided silver-white kippah rim
    g.rect(cx - 5, topY + 6, 11, 1, LIAM_PAL.kipRimHi, "kippah");
    for (let kx = cx - 4; kx <= cx + 4; kx += 2) {
      g.set(kx, topY + 6, LIAM_PAL.kipRimShade, "kippah");
    }
    g.rect(cx - 5, topY + 7, 11, 1, LIAM_PAL.kipDeep, "kippah");
  }
}

function draw32BitHeadBack(g, cx, topY, outfit) {
  // Neck & ears visible from behind
  g.rect(cx - 3, topY + 19, 7, 3, LIAM_PAL.skinShade, "skin");
  g.rect(cx - 9, topY + 12, 2, 4, LIAM_PAL.skinMid, "skin");
  g.set(cx - 9, topY + 14, LIAM_PAL.skinShade, "skin");
  g.rect(cx + 8, topY + 12, 2, 4, LIAM_PAL.skinMid, "skin");
  g.set(cx + 9, topY + 14, LIAM_PAL.skinShade, "skin");

  // Full sculpted straight light-brown hair cascading neatly to the nape!
  g.ellipse(cx, topY + 12, 8.6, 8.4, LIAM_PAL.hairMid, "hair");
  // Vertical straight hair strands & natural sheen
  for (let hx = cx - 6; hx <= cx + 6; hx += 2) {
    g.line(hx, topY + 6, hx, topY + 18, LIAM_PAL.hairShade, "hair");
    g.line(hx + 1, topY + 7, hx + 1, topY + 16, LIAM_PAL.hairHi, "hair");
  }
  g.rect(cx - 6, topY + 18, 13, 2, LIAM_PAL.hairDeep, "hair"); // Clean straight neck trim!
  g.rect(cx - 5, topY + 17, 11, 1, LIAM_PAL.hairShade, "hair");

  if (outfit === "baseball") {
    // Full back of black Little League cap with orange top button + keyhole strap!
    g.ellipse(cx, topY + 7, 8.8, 6.2, LIAM_PAL.capMid, "cap");
    g.ellipse(cx - 1, topY + 5, 6.4, 3.2, LIAM_PAL.capHi, "cap");
    g.rect(cx - 8, topY + 10, 17, 3, LIAM_PAL.capShade, "cap");
    g.rect(cx - 1, topY + 1, 3, 1, LIAM_PAL.orangeMid, "orange");
    // Cap back keyhole cutout showing straight light-brown hair + orange adjuster strap!
    g.rect(cx - 3, topY + 10, 7, 3, LIAM_PAL.hairMid, "hair");
    g.rect(cx - 3, topY + 11, 7, 1, LIAM_PAL.orangeMid, "orange");
    g.set(cx, topY + 11, LIAM_PAL.orangeHi, "orange");
  } else {
    // Full round Royal-Blue Knitted Kippah centered unmistakably on the back crown!
    g.ellipse(cx, topY + 8, 5.8, 5.2, LIAM_PAL.kipShade, "kippah");
    g.ellipse(cx, topY + 7.5, 4.8, 4.3, LIAM_PAL.kipMid, "kippah");
    g.ellipse(cx - 1, topY + 6, 2.8, 2.2, LIAM_PAL.kipHi, "kippah");
    // Woven knit texture pixels
    for (let ky = topY + 5; ky <= topY + 10; ky += 2) {
      for (let kx = cx - 3; kx <= cx + 3; kx += 2) {
        if ((kx - cx) * (kx - cx) + (ky - (topY + 8)) * (ky - (topY + 8)) <= 12) {
          g.set(kx, ky, LIAM_PAL.kipDeep, "kippah");
        }
      }
    }
    // Crisp circular silver-white braided rim around bottom half of kippah!
    for (let deg = 20; deg <= 160; deg += 15) {
      const r = (deg * Math.PI) / 180;
      const rx = cx + Math.cos(r) * 5.2;
      const ry = topY + 8 + Math.sin(r) * 4.6;
      g.set(rx, ry, LIAM_PAL.kipRimHi, "kippah");
    }
  }
}

function draw32BitHeadRight(g, cx, topY, outfit) {
  // 1. Sculpted 32-bit side profile head facing RIGHT!
  g.ellipse(cx, topY + 13, 7.6, 8.0, LIAM_PAL.skinMid, "skin");
  g.ellipse(cx + 2, topY + 12, 4.8, 5.2, LIAM_PAL.skinHi, "skin");
  // Cute sculpted nose sticking 2px forward to the right!
  g.rect(cx + 7, topY + 14, 2, 2, LIAM_PAL.skinMid, "skin");
  g.set(cx + 8, topY + 14, LIAM_PAL.skinHi, "skin");
  g.set(cx + 7, topY + 16, LIAM_PAL.skinShade, "skin");
  // Chin & jawline shadow
  g.rect(cx - 2, topY + 19, 8, 1, LIAM_PAL.skinShade, "skin");
  g.rect(cx, topY + 20, 5, 1, LIAM_PAL.skinDeep, "skin");
  // Side rosy cheek & gentle smile
  g.rect(cx + 4, topY + 16, 2, 1, LIAM_PAL.cheek, "skin");
  g.rect(cx + 5, topY + 18, 2, 1, LIAM_PAL.mouth, "skin");

  // 2. Expressive side-profile 32-bit eye!
  g.rect(cx + 4, topY + 12, 3, 1, LIAM_PAL.eyeLash, "skin");
  g.rect(cx + 4, topY + 13, 3, 3, LIAM_PAL.eyeLash, "skin");
  g.set(cx + 5, topY + 14, LIAM_PAL.eyeIris, "skin");
  g.set(cx + 5, topY + 15, LIAM_PAL.eyeIrisHi, "skin");
  g.set(cx + 4, topY + 13, LIAM_PAL.white, "skin");

  // 3. Straight light-brown hair sweeping smoothly over crown & down the back!
  g.ellipse(cx - 1, topY + 8, 8.0, 5.0, LIAM_PAL.hairMid, "hair");
  // Back hair sweeping neatly down to the nape
  g.rect(cx - 8, topY + 8, 7, 10, LIAM_PAL.hairMid, "hair");
  g.rect(cx - 8, topY + 10, 3, 8, LIAM_PAL.hairShade, "hair");
  g.rect(cx - 7, topY + 17, 6, 2, LIAM_PAL.hairDeep, "hair"); // Straight trimmed back edge
  // Straight sunlit hair strands & front bangs over forehead
  g.rect(cx - 5, topY + 5, 10, 2, LIAM_PAL.hairHi, "hair");
  g.rect(cx - 3, topY + 5, 6, 1, LIAM_PAL.hairSpec, "hair");
  g.rect(cx + 1, topY + 8, 7, 2, LIAM_PAL.hairMid, "hair");
  g.rect(cx + 2, topY + 10, 6, 1, LIAM_PAL.hairDeep, "hair");
  // Sideburn lock + sculpted ear peeking cleanly out of straight hair!
  g.rect(cx - 2, topY + 12, 3, 4, LIAM_PAL.skinMid, "skin");
  g.set(cx - 1, topY + 13, LIAM_PAL.skinShade, "skin");
  g.set(cx - 1, topY + 14, LIAM_PAL.skinDeep, "skin");

  // 4. Headwear in side profile
  if (outfit === "baseball") {
    // Sculpted black cap crown
    g.ellipse(cx - 1, topY + 6.5, 8.2, 4.8, LIAM_PAL.capMid, "cap");
    g.ellipse(cx - 2, topY + 4.5, 5.5, 2.5, LIAM_PAL.capHi, "cap");
    g.rect(cx - 8, topY + 8, 15, 2, LIAM_PAL.capShade, "cap");
    g.rect(cx - 2, topY + 1, 3, 1, LIAM_PAL.orangeMid, "orange");
    // Bold protruding curved Giants orange baseball visor sticking forward to the right!
    g.rect(cx + 4, topY + 8, 10, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 5, topY + 8, 8, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx + 5, topY + 10, 9, 1, LIAM_PAL.orangeShade, "orange");
    g.rect(cx + 6, topY + 10, 5, 1, LIAM_PAL.orangeDeep, "orange");
  } else {
    // Royal-blue knitted kippah perched naturally on back-top of crown!
    g.ellipse(cx - 4, topY + 5, 4.8, 3.2, LIAM_PAL.kipMid, "kippah");
    g.ellipse(cx - 4.5, topY + 4, 3.0, 1.6, LIAM_PAL.kipHi, "kippah");
    g.set(cx - 6, topY + 5, LIAM_PAL.kipShade, "kippah");
    g.set(cx - 3, topY + 5, LIAM_PAL.kipShade, "kippah");
    // Braided rim angled naturally along crown
    g.line(cx - 8, topY + 6, cx, topY + 8, LIAM_PAL.kipRimHi, "kippah");
    g.line(cx - 7, topY + 7, cx - 1, topY + 8, LIAM_PAL.kipDeep, "kippah");
  }
}

function draw32BitTorsoAndLegsFrontOrBack(g, cx, topY, facing, stepFrame, outfit, onScooter) {
  const isBack = facing === "up";
  const isBB = outfit === "baseball";
  const liftL = !onScooter && stepFrame === 1 ? -2 : 0;
  const liftR = !onScooter && stepFrame === 2 ? -2 : 0;
  const armSwingL = !onScooter && stepFrame === 1 ? -2 : stepFrame === 2 ? 1 : 0;
  const armSwingR = !onScooter && stepFrame === 2 ? -2 : stepFrame === 1 ? 1 : 0;
  const tzSway = stepFrame === 1 ? -1 : stepFrame === 2 ? 1 : 0;

  // 1. Legs & Sneakers (drawn first behind torso hem & tzitzit!)
  const pHi = isBB ? LIAM_PAL.bbPantsHi : LIAM_PAL.pantsHi;
  const pMid = isBB ? LIAM_PAL.bbPantsMid : LIAM_PAL.pantsMid;
  const pSh = isBB ? LIAM_PAL.bbPantsShade : LIAM_PAL.pantsShade;
  const pDeep = isBB ? LIAM_PAL.bbPantsShade : LIAM_PAL.pantsDeep;
  const pMat = isBB ? "jersey" : "pants";

  // Left leg
  g.rect(cx - 6, topY + 33 + liftL, 6, 11, pMid, pMat);
  g.rect(cx - 5, topY + 34 + liftL, 3, 8, pHi, pMat);
  g.rect(cx - 1, topY + 34 + liftL, 1, 9, pDeep, pMat);
  if (isBB) {
    // Giants orange & black high baseball stirrup socks!
    g.rect(cx - 6, topY + 41 + liftL, 6, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 5, topY + 41 + liftL, 4, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx - 6, topY + 43 + liftL, 6, 1, LIAM_PAL.capMid, "cap");
  } else {
    g.rect(cx - 6, topY + 43 + liftL, 6, 1, pSh, pMat);
  }
  draw32BitSneaker(g, cx - 7, topY + 44 + liftL, facing, outfit, liftL < 0);

  // Right leg
  g.rect(cx + 1, topY + 33 + liftR, 6, 11, pMid, pMat);
  g.rect(cx + 2, topY + 34 + liftR, 3, 8, pHi, pMat);
  g.rect(cx + 1, topY + 34 + liftR, 1, 9, pDeep, pMat);
  if (isBB) {
    g.rect(cx + 1, topY + 41 + liftR, 6, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 2, topY + 41 + liftR, 4, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx + 1, topY + 43 + liftR, 6, 1, LIAM_PAL.capMid, "cap");
  } else {
    g.rect(cx + 1, topY + 43 + liftR, 6, 1, pSh, pMat);
  }
  draw32BitSneaker(g, cx + 1, topY + 44 + liftR, facing, outfit, liftR < 0);

  // 2. Arms (short sleeves + shaded warm forearms + cute little hands!)
  const slHi = isBB ? LIAM_PAL.orangeHi : LIAM_PAL.poloHi;
  const slMid = isBB ? LIAM_PAL.orangeMid : LIAM_PAL.poloMid;
  const slSh = isBB ? LIAM_PAL.orangeShade : LIAM_PAL.poloShade;
  const slMat = isBB ? "orange" : "polo";

  for (const [side, swing] of [[-1, armSwingL], [1, armSwingR]]) {
    const ax = side < 0 ? cx - 10 : cx + 7;
    const ay = topY + 22 + swing;
    // Short sleeve
    g.rect(ax, ay, 4, 6, slMid, slMat);
    g.rect(ax + (side < 0 ? 1 : 0), ay + 1, 2, 4, slHi, slMat);
    g.rect(ax, ay + 5, 4, 1, isBB ? LIAM_PAL.capMid : slSh, slMat);
    // Warm forearm + sculpted hand
    g.rect(ax + (side < 0 ? 0 : 1), ay + 6, 3, 5, LIAM_PAL.skinMid, "skin");
    g.rect(ax + (side < 0 ? 1 : 1), ay + 6, 2, 3, LIAM_PAL.skinHi, "skin");
    g.rect(ax + (side < 0 ? 0 : 1), ay + 10, 3, 1, LIAM_PAL.skinShade, "skin");
  }

  // 3. Torso (Detailed 32-bit Collared Polo OR Team Giants Little League Jersey!)
  if (isBB) {
    // Cream-white jersey with vertical pinstripe detail & Giants orange raglan shoulders!
    g.rect(cx - 7, topY + 21, 15, 13, LIAM_PAL.jerseyMid, "jersey");
    g.rect(cx - 5, topY + 22, 11, 10, LIAM_PAL.jerseyHi, "jersey");
    // Subtle vertical pinstripe pixel lines
    for (const sx of [cx - 4, cx + 4]) {
      g.line(sx, topY + 22, sx, topY + 32, LIAM_PAL.jerseyStripe, "jersey");
    }
    // Orange raglan shoulders
    g.rect(cx - 7, topY + 21, 3, 5, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 6, topY + 21, 2, 3, LIAM_PAL.orangeHi, "orange");
    g.rect(cx + 5, topY + 21, 3, 5, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 5, topY + 21, 2, 3, LIAM_PAL.orangeHi, "orange");
    // Neckline trim
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.capMid, "cap");
    g.rect(cx - 3, topY + 21, 7, 1, LIAM_PAL.orangeMid, "orange");

    if (!isBack) {
      // Front button placket + buttons + Giants orange chest mark
      g.line(cx, topY + 22, cx, topY + 32, LIAM_PAL.capMid, "cap");
      g.set(cx, topY + 24, LIAM_PAL.white, "jersey");
      g.set(cx, topY + 27, LIAM_PAL.white, "jersey");
      g.set(cx, topY + 30, LIAM_PAL.white, "jersey");
      g.rect(cx - 4, topY + 24, 3, 2, LIAM_PAL.orangeMid, "orange");
      g.set(cx - 3, topY + 24, LIAM_PAL.orangeHi, "orange");
    } else {
      // Bold crisp pixel "#7" on back of Liam's Little League jersey!
      g.rect(cx - 2, topY + 24, 6, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx + 2, topY + 26, 2, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx + 1, topY + 28, 2, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx, topY + 30, 2, 2, LIAM_PAL.capMid, "cap");
      // Orange outline highlight on the 7!
      g.rect(cx - 2, topY + 24, 5, 1, LIAM_PAL.orangeMid, "orange");
    }
    // Giants orange baseball belt + metallic buckle
    g.rect(cx - 7, topY + 32, 15, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 6, topY + 32, 13, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx - 1, topY + 32, 3, 2, LIAM_PAL.capMid, "cap");
    g.set(cx, topY + 32, LIAM_PAL.white, "jersey");
  } else {
    // Rich 5-tone royal-blue collared polo shirt with fabric fold shading!
    g.rect(cx - 7, topY + 21, 15, 13, LIAM_PAL.poloMid, "polo");
    g.rect(cx - 5, topY + 22, 11, 9, LIAM_PAL.poloHi, "polo");
    g.rect(cx - 3, topY + 23, 7, 4, LIAM_PAL.poloSpec, "polo");
    // Soft vertical side shading & lower hem crease
    g.rect(cx - 7, topY + 22, 2, 11, LIAM_PAL.poloShade, "polo");
    g.rect(cx + 6, topY + 22, 2, 11, LIAM_PAL.poloShade, "polo");
    g.rect(cx - 7, topY + 32, 15, 2, LIAM_PAL.poloDeep, "polo");

    if (!isBack) {
      // Distinct 32-bit folded polo collar flaps + V-placket + 2 pearlescent buttons!
      g.rect(cx - 5, topY + 21, 11, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx - 4, topY + 22, 3, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx + 2, topY + 22, 3, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx - 4, topY + 24, 3, 1, LIAM_PAL.collarShade, "polo");
      g.rect(cx + 2, topY + 24, 3, 1, LIAM_PAL.collarShade, "polo");
      // V-neck placket
      g.rect(cx - 1, topY + 22, 3, 6, LIAM_PAL.poloDeep, "polo");
      g.set(cx, topY + 22, LIAM_PAL.skinShade, "skin"); // Neck V
      g.set(cx, topY + 24, LIAM_PAL.white, "polo");     // Button 1
      g.set(cx, topY + 26, LIAM_PAL.white, "polo");     // Button 2
    } else {
      // Crisp folded polo collar band across back of neck
      g.rect(cx - 5, topY + 21, 11, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx - 5, topY + 23, 11, 1, LIAM_PAL.collarShade, "polo");
    }
  }

  // 4. Crisp multi-strand hanging white Tzitzit peeking cleanly at BOTH hips!
  draw32BitTzitzit(g, cx - 7, topY + 34, tzSway, false);
  draw32BitTzitzit(g, cx + 6, topY + 34, tzSway, false);
}

function draw32BitTorsoAndLegsRight(g, cx, topY, stepFrame, outfit, onScooter) {
  const isBB = outfit === "baseball";
  const pHi = isBB ? LIAM_PAL.bbPantsHi : LIAM_PAL.pantsHi;
  const pMid = isBB ? LIAM_PAL.bbPantsMid : LIAM_PAL.pantsMid;
  const pSh = isBB ? LIAM_PAL.bbPantsShade : LIAM_PAL.pantsShade;
  const pMat = isBB ? "jersey" : "pants";

  const slHi = isBB ? LIAM_PAL.orangeHi : LIAM_PAL.poloHi;
  const slMid = isBB ? LIAM_PAL.orangeMid : LIAM_PAL.poloMid;
  const slSh = isBB ? LIAM_PAL.orangeShade : LIAM_PAL.poloShade;
  const slMat = isBB ? "orange" : "polo";

  // 1. Dynamic 32-bit striding legs in side profile!
  const stride = onScooter ? 0 : stepFrame === 1 ? 1 : stepFrame === 2 ? -1 : 0;
  const backLegX = cx - 3 - stride * 4;
  const frontLegX = cx - 2 + stride * 4;

  // Back leg (darker shaded for depth!)
  g.rect(backLegX, topY + 34, 5, 10, pSh, pMat);
  if (isBB) g.rect(backLegX, topY + 41, 5, 2, LIAM_PAL.orangeShade, "orange");
  draw32BitSneaker(g, backLegX - 1, topY + 44, "right", outfit, stride !== 0 && stride < 0);

  // Front leg (lit highlight!)
  g.rect(frontLegX, topY + 33, 6, 11, pMid, pMat);
  g.rect(frontLegX + 2, topY + 34, 3, 8, pHi, pMat);
  if (isBB) {
    g.rect(frontLegX, topY + 41, 6, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(frontLegX + 1, topY + 41, 4, 1, LIAM_PAL.orangeHi, "orange");
  }
  draw32BitSneaker(g, frontLegX, topY + 44, "right", outfit, stride !== 0 && stride > 0);

  // 2. Side-profile Torso (Polo OR Little League Jersey)
  if (isBB) {
    g.rect(cx - 6, topY + 21, 13, 13, LIAM_PAL.jerseyMid, "jersey");
    g.rect(cx - 3, topY + 22, 9, 10, LIAM_PAL.jerseyHi, "jersey");
    g.rect(cx - 6, topY + 22, 3, 10, LIAM_PAL.jerseyShade, "jersey");
    // Orange shoulder collar & belt
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 6, topY + 32, 13, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 4, topY + 32, 10, 1, LIAM_PAL.orangeHi, "orange");
  } else {
    g.rect(cx - 6, topY + 21, 13, 13, LIAM_PAL.poloMid, "polo");
    g.rect(cx - 3, topY + 22, 9, 9, LIAM_PAL.poloHi, "polo");
    g.rect(cx, topY + 23, 5, 5, LIAM_PAL.poloSpec, "polo");
    g.rect(cx - 6, topY + 22, 3, 11, LIAM_PAL.poloShade, "polo");
    g.rect(cx - 6, topY + 32, 13, 2, LIAM_PAL.poloDeep, "polo");
    // Side polo collar
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.collarHi, "polo");
    g.rect(cx - 3, topY + 23, 8, 1, LIAM_PAL.collarShade, "polo");
  }

  // 3. White Tzitzit hanging neatly at the side hip & swaying on stride!
  draw32BitTzitzit(g, cx - 2, topY + 34, stride === 0 ? 0 : -1, true);

  // 4. Foreground swinging arm (reaches forward on scooter or stride!)
  const armX = onScooter ? cx + 3 : cx - 2 + stride * 3;
  const armY = onScooter ? topY + 24 : topY + 23;
  g.rect(armX - 1, armY, 5, 6, slMid, slMat);
  g.rect(armX, armY + 1, 3, 4, slHi, slMat);
  g.rect(armX - 1, armY + 5, 5, 1, isBB ? LIAM_PAL.capMid : slSh, slMat);
  if (onScooter) {
    // Reaching forward to grip scooter handlebars!
    g.rect(armX + 3, armY + 2, 6, 3, LIAM_PAL.skinMid, "skin");
    g.rect(armX + 4, armY + 2, 4, 2, LIAM_PAL.skinHi, "skin");
  } else {
    g.rect(armX, armY + 6, 4, 5, LIAM_PAL.skinMid, "skin");
    g.rect(armX + 1, armY + 6, 2, 3, LIAM_PAL.skinHi, "skin");
    g.rect(armX, armY + 10, 3, 1, LIAM_PAL.skinShade, "skin");
  }
}

function draw32BitScooter(g, facing, outfit) {
  const deckHi = outfit === "baseball" ? LIAM_PAL.orangeHi : "#7ff7f0";
  const deckMid = outfit === "baseball" ? LIAM_PAL.orangeMid : "#39cfc8";
  const deckSh = outfit === "baseball" ? LIAM_PAL.orangeShade : "#22918c";
  const metalHi = "#f0f5fa";
  const metalMid = "#adb8c7";
  const tire = "#23262e";

  if (facing === "right") {
    // Rear & front wheels (6x6 spoked wheels)
    g.ellipse(12, 50, 3.0, 3.0, tire, "scooter");
    g.rect(11, 49, 2, 2, metalMid, "scooter");
    g.ellipse(36, 50, 3.0, 3.0, tire, "scooter");
    g.rect(35, 49, 2, 2, metalMid, "scooter");
    // Sleek shaded deck
    g.rect(12, 48, 24, 3, deckMid, "scooter");
    g.rect(13, 48, 22, 1, deckHi, "scooter");
    g.rect(13, 50, 22, 1, deckSh, "scooter");
    // Chrome steering column + grip handlebars
    g.rect(34, 28, 3, 21, metalMid, "scooter");
    g.rect(35, 29, 1, 19, metalHi, "scooter");
    g.rect(31, 26, 7, 3, deckMid, "scooter");
    g.rect(32, 26, 5, 1, deckHi, "scooter");
  } else {
    // Front/back scooter deck + handlebars
    g.rect(17, 48, 14, 4, deckMid, "scooter");
    g.rect(18, 48, 12, 2, deckHi, "scooter");
    g.rect(23, 30, 2, 19, metalMid, "scooter");
    g.rect(14, 29, 20, 3, metalMid, "scooter");
    g.rect(15, 29, 18, 1, metalHi, "scooter");
    g.rect(12, 28, 4, 4, deckMid, "scooter");
    g.rect(32, 28, 4, 4, deckMid, "scooter");
  }
}

/**
 * Bake a crisp 48x56 32-bit all-pixel sprite of Liam (drawn at 0.5 logical scale -> 24x28 world units).
 */
export function bakeSmb3HeroSprite(facing, stepFrame, onScooter, outfit = "polo") {
  const g = new PixelGrid(48, 56);
  const cx = 24;
  const bobY = !onScooter && stepFrame !== 0 ? -1 : 0;
  const renderFacing = facing === "left" ? "right" : facing;

  if (onScooter) {
    draw32BitScooter(g, renderFacing, outfit);
  }

  if (renderFacing === "down" || renderFacing === "up") {
    draw32BitTorsoAndLegsFrontOrBack(g, cx, 2 + bobY, renderFacing, stepFrame, outfit, onScooter);
    if (renderFacing === "down") {
      draw32BitHeadFront(g, cx, 2 + bobY, outfit, false);
    } else {
      draw32BitHeadBack(g, cx, 2 + bobY, outfit);
    }
  } else {
    draw32BitTorsoAndLegsRight(g, cx, 2 + bobY, stepFrame, outfit, onScooter);
    draw32BitHeadRight(g, cx, 2 + bobY, outfit);
  }

  g.applySelOut(LIAM_SELOUT);
  const finalGrid = facing === "left" ? g.flipHorizontal() : g;
  return finalGrid.toCanvas(0.5, { cx: 24, cy: 52, rx: 11, ry: 3.2 });
}

/**
 * Bake Liam's 48x56 32-bit celebratory 2-handed overhead Item Fanfare pose!
 */
export function bakeSmb3HeroFanfareSprite(outfit = "polo") {
  const g = new PixelGrid(48, 56);
  const cx = 24;
  const topY = 3;
  const isBB = outfit === "baseball";
  const slHi = isBB ? LIAM_PAL.orangeHi : LIAM_PAL.poloHi;
  const slMid = isBB ? LIAM_PAL.orangeMid : LIAM_PAL.poloMid;
  const slMat = isBB ? "orange" : "polo";

  // Draw legs + sneakers + torso cleanly via idle front pose
  draw32BitTorsoAndLegsFrontOrBack(g, cx, topY, "down", 0, outfit, false);

  // Clear resting side arms and replace with triumphantly raised arms!
  for (let y = topY + 21; y <= topY + 34; y++) {
    for (let x = cx - 11; x <= cx - 8; x++) g.clear(x, y);
    for (let x = cx + 8; x <= cx + 11; x++) g.clear(x, y);
  }
  for (const side of [-1, 1]) {
    const ax = side < 0 ? cx - 12 : cx + 9;
    // Raised sleeve & forearm
    g.rect(ax, topY + 17, 4, 7, slMid, slMat);
    g.rect(ax + 1, topY + 18, 2, 5, slHi, slMat);
    g.rect(ax, topY + 9, 4, 8, LIAM_PAL.skinMid, "skin");
    g.rect(ax + 1, topY + 10, 2, 6, LIAM_PAL.skinHi, "skin");
    // Open celebratory hands!
    g.rect(ax - (side < 0 ? 1 : 0), topY + 6, 5, 4, LIAM_PAL.skinHi, "skin");
    g.rect(ax, topY + 9, 4, 1, LIAM_PAL.skinShade, "skin");
  }

  // Happy beaming head!
  draw32BitHeadFront(g, cx, topY, outfit, true);
  g.applySelOut(LIAM_SELOUT);
  return g.toCanvas(0.5, { cx: 24, cy: 52, rx: 11, ry: 3.2 });
}

// =============================================================================
// 32-BIT NEIGHBORHOOD NPCs (44x52 NATIVE PIXELS -> 22x26 LOGICAL UNITS!)
// =============================================================================

export function bakeSmb3NpcSprite(theme) {
  const g = new PixelGrid(44, 52);
  const cx = 22;
  const topY = 3;

  const shirtHi = theme.shirtLight || theme.shirt;
  const shirtMid = theme.shirt;
  const shirtDark = theme.shirtDark || theme.shirt;
  const hairHi = theme.hairLight || theme.hair;
  const hairMid = theme.hair;
  const hairDark = theme.hairDark || "#2e1d14";
  const pantsHi = theme.pantsLight || "#4f6691";
  const pantsMid = theme.pants || "#35486b";
  const pantsDark = theme.pantsDark || "#212e47";

  // Legs & shaded shoes
  for (const lx of [cx - 6, cx + 1]) {
    g.rect(lx, topY + 32, 6, 10, pantsMid, "pants");
    g.rect(lx + 1, topY + 33, 3, 8, pantsHi, "pants");
    g.rect(lx, topY + 41, 6, 1, pantsDark, "pants");
    // Shaded leather/canvas shoe
    g.rect(lx - 1, topY + 42, 7, 4, theme.shoe || "#4d3423", "shoe");
    g.rect(lx, topY + 42, 5, 1, theme.shoeLight || "#755037", "shoe");
    g.rect(lx - 1, topY + 45, 7, 1, "#d9dfe8", "shoe");
  }

  // Arms
  for (const side of [-1, 1]) {
    const ax = side < 0 ? cx - 10 : cx + 7;
    g.rect(ax, topY + 21, 4, 8, shirtMid, "polo");
    g.rect(ax + 1, topY + 22, 2, 6, shirtHi, "polo");
    g.rect(ax, topY + 29, 3, 4, LIAM_PAL.skinMid, "skin");
    g.rect(ax + 1, topY + 29, 1, 3, LIAM_PAL.skinHi, "skin");
  }

  // Torso jacket / shirt with collar & buttons
  g.rect(cx - 7, topY + 20, 15, 13, shirtMid, "polo");
  g.rect(cx - 5, topY + 21, 11, 10, shirtHi, "polo");
  g.rect(cx - 7, topY + 21, 2, 11, shirtDark, "polo");
  g.rect(cx + 6, topY + 21, 2, 11, shirtDark, "polo");
  g.rect(cx - 7, topY + 31, 15, 2, shirtDark, "polo");
  // Crisp collar & front accent
  g.rect(cx - 4, topY + 20, 9, 2, theme.collar || "#f7f5ee", "jersey");
  g.rect(cx - 1, topY + 21, 3, 9, shirtDark, "polo");
  g.set(cx, topY + 23, "#fff6d6", "jersey");
  g.set(cx, topY + 26, "#fff6d6", "jersey");
  g.set(cx, topY + 29, "#fff6d6", "jersey");

  // Sculpted 32-bit NPC head
  g.ellipse(cx, topY + 12, 7.8, 7.8, LIAM_PAL.skinMid, "skin");
  g.ellipse(cx - 1, topY + 10.5, 5.2, 4.4, LIAM_PAL.skinHi, "skin");
  g.rect(cx - 4, topY + 18, 9, 1, LIAM_PAL.skinShade, "skin");
  g.rect(cx - 9, topY + 11, 2, 4, LIAM_PAL.skinMid, "skin");
  g.rect(cx + 8, topY + 11, 2, 4, LIAM_PAL.skinMid, "skin");

  // Sculpted hair
  g.ellipse(cx, topY + 7.5, 8.2, 5.2, hairMid, "hair");
  g.rect(cx - 8, topY + 7, 2, 6, hairDark, "hair");
  g.rect(cx + 7, topY + 7, 2, 6, hairDark, "hair");
  g.rect(cx - 6, topY + 5, 13, 2, hairHi, "hair");
  g.rect(cx - 7, topY + 9, 15, 2, hairDark, "hair");

  // Expressive 32-bit eyes & friendly smile
  for (const side of [-1, 1]) {
    const ex = side < 0 ? cx - 5 : cx + 3;
    const ey = topY + 12;
    g.rect(ex, ey, 3, 3, LIAM_PAL.eyeLash, "skin");
    g.set(ex, ey, LIAM_PAL.white, "skin");
    g.set(ex + 1, ey + 2, LIAM_PAL.eyeIris, "skin");
  }
  g.rect(cx - 6, topY + 15, 2, 1, LIAM_PAL.cheek, "skin");
  g.rect(cx + 5, topY + 15, 2, 1, LIAM_PAL.cheek, "skin");
  g.rect(cx - 1, topY + 16, 3, 1, LIAM_PAL.mouth, "skin");

  // Optional character hat (Chef toque, Ranger hat, Visor, Spooky Top Hat, BC Mortarboard!)
  if (theme.hat) {
    const hatHi = theme.hatLight || theme.hat;
    const hatMid = theme.hat;
    const hatRim = theme.hatRim || theme.hat;
    g.ellipse(cx, topY + 4, 8.4, 4.4, hatMid, "cap");
    g.ellipse(cx - 1, topY + 2.5, 5.6, 2.2, hatHi, "cap");
    g.rect(cx - 9, topY + 6, 19, 2, hatRim, "cap");
    g.rect(cx - 8, topY + 5, 17, 1, hatMid, "cap");
  }

  g.applySelOut({
    ...LIAM_SELOUT,
    hair: hairDark,
    polo: shirtDark,
  });
  return g.toCanvas(0.5, { cx: 22, cy: 48, rx: 10, ry: 3.0 });
}

// ============================================================================
// 32-BIT ROVING WILD NEWTON TURKEYS, ANNOYING SIDEWALK PROTESTORS & PIXEL BUBBLES
// ============================================================================

const PIXEL_FONT_3X5 = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["110", "101", "101", "101", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "!": ["010", "010", "010", "000", "010"],
  "?": ["110", "001", "010", "000", "010"],
  " ": ["000", "000", "000", "000", "000"],
};

function bakePixelSpeechBubble(text, { bg = "#fff8e8", border = "#291a18", accent = "#d93b36", textColor = "#291a18" } = {}) {
  const clean = String(text || "").toUpperCase();
  const charW = 4;
  const textW = Math.max(8, clean.length * charW - 1);
  const padX = 6;
  const padY = 4;
  const boxW = textW + padX * 2;
  const boxH = 5 + padY * 2;
  const w = boxW + 2;
  const h = boxH + 6;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.__pixelScale = 0.5;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const p = (x, y, rw, rh, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, rw, rh);
  };
  // Rounded retro pixel speech bubble box + subtle accent bar + downward tail
  p(2, 0, w - 4, 1, border);
  p(1, 1, w - 2, boxH, border);
  p(0, 2, w, boxH - 2, border);
  p(2, 1, w - 4, boxH - 1, bg);
  p(1, 2, w - 2, boxH - 3, bg);
  p(2, 1, w - 4, 1, accent);
  // Pointer tail
  const mx = Math.floor(w / 2);
  p(mx - 2, boxH + 1, 5, 2, border);
  p(mx - 1, boxH + 3, 3, 2, border);
  p(mx, boxH + 5, 1, 1, border);
  p(mx - 1, boxH, 3, 2, bg);
  p(mx, boxH + 2, 1, 2, bg);

  // Crisp 3x5 uppercase pixel lettering
  let cx = 1 + padX;
  const cy = 1 + padY;
  ctx.fillStyle = textColor;
  for (const ch of clean) {
    const glyph = PIXEL_FONT_3X5[ch] || PIXEL_FONT_3X5[" "];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === "1") {
          ctx.fillRect(cx + gx, cy + gy, 1, 1);
        }
      }
    }
    cx += charW;
  }
  return c;
}

function mirrorCanvasHorizontal(src) {
  const dst = document.createElement("canvas");
  dst.width = src.width;
  dst.height = src.height;
  dst.__pixelScale = src.__pixelScale || 0.5;
  const ctx = dst.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return dst;
}

/**
 * Bake 32-bit Pure Pixel Wild Newton Turkey (facing right; mirrored cleanly for left!).
 */
function bake32BitTurkeyRight(stepFrame = 0, puffed = false) {
  const w = puffed ? 40 : 36;
  const h = 38;
  const g = new PixelGrid(w, h);
  const cx = puffed ? 21 : 19;
  const bobY = stepFrame === 1 ? -1 : 0;

  // 1. Banded autumn turkey tail-feather fan!
  if (puffed) {
    // Full dramatic bossy Newton turkey fanned tail!
    g.ellipse(cx - 8, 17 + bobY, 10.5, 11.2, "#382118", "tail");
    g.ellipse(cx - 8, 17 + bobY, 9.2, 9.8, "#f0d8b2", "tail");
    g.ellipse(cx - 7.5, 17.5 + bobY, 7.6, 8.2, "#59301e", "tail");
    g.ellipse(cx - 7, 18 + bobY, 5.8, 6.2, "#9c5228", "tail");
    g.ellipse(cx - 6.5, 18.5 + bobY, 4.0, 4.2, "#c77434", "tail");
    // Crisp radial feather quill lines
    for (let deg = -75; deg <= 75; deg += 25) {
      const r = (deg * Math.PI) / 180;
      g.line(cx - 6, 19 + bobY, cx - 8 - Math.cos(r) * 10, 17 + bobY + Math.sin(r) * 10, "#2b1610", "tail");
    }
  } else {
    // Upright strutting banded tail fan behind body
    g.ellipse(cx - 9, 17 + bobY, 6.2, 8.5, "#382118", "tail");
    g.ellipse(cx - 8.5, 17 + bobY, 5.2, 7.2, "#ebd2aa", "tail");
    g.ellipse(cx - 8, 18 + bobY, 4.2, 6.0, "#663621", "tail");
    g.ellipse(cx - 7.5, 18.5 + bobY, 3.0, 4.2, "#a85c2d", "tail");
  }

  // 2. Orange stepping turkey legs & 3-toed feet!
  const f1X = stepFrame === 1 ? cx - 4 : cx - 2;
  const f2X = stepFrame === 1 ? cx + 4 : cx + 2;
  g.rect(f1X, 27, 2, 6, "#d97a26", "feet");
  g.rect(f1X - 1, 32, 5, 2, "#f09938", "feet");
  g.rect(f2X, 27, 2, 6, "#b8601c", "feet");
  g.rect(f2X - 1, 32, 5, 2, "#d97a26", "feet");

  // 3. Plump iridescent bronze-brown turkey body & copper/gold layered wing!
  const bodyRx = puffed ? 9.5 : 8.5;
  const bodyRy = puffed ? 7.2 : 6.4;
  g.ellipse(cx, 22 + bobY, bodyRx, bodyRy, "#4f2d20", "body");
  g.ellipse(cx + 1, 20.5 + bobY, bodyRx - 2, bodyRy - 2, "#75432c", "body");
  // Iridescent copper-green chest sheen
  g.ellipse(cx + 4, 21 + bobY, 4.2, 4.2, "#355e4a", "body");
  g.ellipse(cx + 5, 20 + bobY, 2.4, 2.5, "#599973", "body");
  // Layered copper/gold wing feathers
  g.ellipse(cx - 1, 22 + bobY, 5.5, 3.6, "#8c4b27", "wing");
  g.ellipse(cx - 1, 21 + bobY, 4.2, 2.2, "#c47436", "wing");
  g.rect(cx - 4, 23 + bobY, 7, 1, "#381f16", "wing");
  g.rect(cx - 3, 21 + bobY, 5, 1, "#e69e4c", "wing");

  // 4. Sculpted blue-gray turkey neck & head + bright crimson snood & wattle + sharp golden beak!
  const hx = cx + 8;
  const hy = 13 + bobY;
  g.rect(cx + 5, 15 + bobY, 4, 7, "#6e8299", "head");
  g.rect(cx + 6, 15 + bobY, 2, 6, "#94a8bf", "head");
  g.ellipse(hx, hy, 3.6, 3.5, "#788ea6", "head");
  g.ellipse(hx, hy - 1, 2.2, 1.8, "#a6bdd4", "head");
  // Bright red crown bumps, drooping snood & plump crimson wattle!
  g.rect(hx - 1, hy - 4, 3, 2, "#e03832", "wattle");
  g.rect(hx - 1, hy + 2, 3, 5, "#cf2b26", "wattle");
  g.rect(hx, hy + 3, 2, 3, "#ff5c52", "wattle");
  g.rect(hx + 3, hy, 2, 4, "#e03832", "wattle"); // snood over beak!
  // Crisp golden-tan beak & fierce bossy eye
  g.rect(hx + 3, hy - 1, 4, 2, "#ebb84d", "beak");
  g.set(hx + 6, hy, "#c28629", "beak");
  g.rect(hx + 1, hy - 1, 2, 2, "#1c1312", "head");
  g.set(hx + 1, hy - 1, "#ffffff", "head");

  g.applySelOut({
    tail: "#24130f",
    body: "#24130f",
    wing: "#2e1810",
    head: "#2c3440",
    wattle: "#6e1312",
    beak: "#5c3b12",
    feet: "#592b0e",
  });
  return g.toCanvas(0.5, { cx: cx, cy: 33, rx: puffed ? 11 : 9, ry: 3.0 });
}

/**
 * Bake 32-bit Pure Pixel Annoying Sidewalk Protestor waving a big cardboard picket sign + megaphone!
 */
function bake32BitProtestorRight(variant = 0, shoutFrame = 0) {
  const w = 48;
  const h = 64;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const topY = 14;
  const signLift = shoutFrame === 1 ? -3 : 0;
  const stride = shoutFrame === 1 ? 2 : 0;

  const themes = [
    { jacket: "#9c2f3a", jacketHi: "#c94b56", jacketDark: "#631b24", hair: "#4a2e1e", beanie: "#d9922b", beanieDark: "#9c6216", signBg: "#f7ebd2", signStripe: "#d93b36" },
    { jacket: "#d4912a", jacketHi: "#f2b84b", jacketDark: "#8f5c16", hair: "#2b211e", beanie: "#2f6e57", beanieDark: "#1c4536", signBg: "#fff6d6", signStripe: "#24573d" },
    { jacket: "#2c737d", jacketHi: "#489ea8", jacketDark: "#1a4850", hair: "#734224", beanie: "#b83b36", beanieDark: "#7a221f", signBg: "#f5efe6", signStripe: "#2b528c" },
  ];
  const th = themes[variant % themes.length];

  // 1. Tall wooden picket-sign pole & BIG hand-painted cardboard protest sign held high!
  const poleX = cx - 8;
  g.rect(poleX, 16 + signLift, 3, 28, "#8c542c", "pole");
  g.rect(poleX, 16 + signLift, 1, 28, "#bd7c46", "pole");
  // Big rectangular protest sign board overhead!
  const signX = poleX - 10;
  const signY = 4 + signLift;
  g.rect(signX, signY, 24, 15, "#b8966e", "sign");
  g.rect(signX + 1, signY + 1, 22, 13, th.signBg, "sign");
  // Bold colorful hand-painted lettering bars & exclamation point on sign!
  g.rect(signX + 3, signY + 3, 14, 2, th.signStripe, "sign");
  g.rect(signX + 3, signY + 7, 11, 2, "#291a18", "sign");
  g.rect(signX + 3, signY + 11, 15, 2, th.signStripe, "sign");
  g.rect(signX + 19, signY + 3, 2, 6, th.signStripe, "sign");
  g.rect(signX + 19, signY + 11, 2, 2, th.signStripe, "sign");

  // 2. Marching legs & autumn boots
  g.rect(cx - 5 - stride, topY + 33, 5, 11, "#2f3d54", "pants");
  g.rect(cx - 4 - stride, topY + 34, 2, 9, "#485d7d", "pants");
  g.rect(cx - 6 - stride, topY + 43, 7, 4, "#4f2e1c", "shoe");
  g.rect(cx + 1 + stride, topY + 33, 5, 11, "#243042", "pants");
  g.rect(cx + 2 + stride, topY + 34, 2, 9, "#3a4d69", "pants");
  g.rect(cx + 1 + stride, topY + 43, 7, 4, "#4f2e1c", "shoe");

  // 3. Back arm gripping picket pole + torso autumn jacket + scarf
  g.rect(poleX - 1, topY + 19 + signLift, 5, 4, LIAM_PAL.skinMid, "skin");
  g.rect(cx - 7, topY + 21, 14, 13, th.jacket, "polo");
  g.rect(cx - 5, topY + 22, 9, 10, th.jacketHi, "polo");
  g.rect(cx - 7, topY + 32, 14, 2, th.jacketDark, "polo");
  // Cozy autumn knit scarf
  g.rect(cx - 6, topY + 20, 12, 3, "#f0cf6b", "scarf");
  g.rect(cx + 1, topY + 23, 3, 6, "#d9a742", "scarf");

  // 4. Sculpted side-ish head with knit beanie & open shouting mouth!
  g.ellipse(cx, topY + 12, 7.2, 7.4, LIAM_PAL.skinMid, "skin");
  g.ellipse(cx + 2, topY + 11, 4.4, 4.6, LIAM_PAL.skinHi, "skin");
  g.rect(cx + 6, topY + 13, 2, 2, LIAM_PAL.skinMid, "skin"); // nose
  // Hair & ribbed autumn knit beanie
  g.rect(cx - 7, topY + 8, 6, 8, th.hair, "hair");
  g.ellipse(cx - 1, topY + 6.5, 7.6, 4.6, th.beanie, "cap");
  g.rect(cx - 8, topY + 8, 16, 2, th.beanieDark || "#291a18", "cap");
  // Intense shouting eyebrow, eye & wide-open shouting mouth on frame 1!
  g.rect(cx + 3, topY + 10, 4, 1, "#291a18", "skin");
  g.rect(cx + 4, topY + 11, 2, 3, "#1c1312", "skin");
  g.set(cx + 4, topY + 11, "#ffffff", "skin");
  if (shoutFrame === 1) {
    g.rect(cx + 4, topY + 15, 3, 3, "#7a1c1c", "skin");
    g.rect(cx + 5, topY + 15, 2, 1, "#ffffff", "skin");
  } else {
    g.rect(cx + 4, topY + 16, 3, 2, "#8c2b2b", "skin");
  }

  // 5. Front arm holding a loud red-and-white MEGAPHONE!
  g.rect(cx + 4, topY + 22, 6, 4, th.jacketHi, "polo");
  g.rect(cx + 9, topY + 21, 3, 4, LIAM_PAL.skinMid, "skin");
  const megaY = shoutFrame === 1 ? topY + 14 : topY + 17;
  g.rect(cx + 10, megaY + 2, 4, 4, "#d93b36", "mega");
  g.rect(cx + 13, megaY + 1, 3, 6, "#f7f5f0", "mega");
  g.rect(cx + 16, megaY, 3, 8, "#d93b36", "mega");
  if (shoutFrame === 1) {
    // Little cartoon shout sound waves flying out of the megaphone!
    g.rect(cx + 20, megaY + 1, 2, 1, "#ffe066", "wave");
    g.rect(cx + 21, megaY + 4, 2, 1, "#ffe066", "wave");
    g.rect(cx + 20, megaY + 7, 2, 1, "#ffe066", "wave");
  }

  g.applySelOut({
    ...LIAM_SELOUT,
    pole: "#361d10",
    sign: "#291a18",
    scarf: "#754d14",
    mega: "#421515",
    wave: "#a65912",
    polo: th.jacketDark,
  });
  return g.toCanvas(0.5, { cx: cx, cy: 60, rx: 10, ry: 3.0 });
}

/**
 * Bake 32-bit Pure Pixel Spooky Graveyard Skeleton (rattling bones, glowing emerald eyes & tattered scarf!)
 */
function bake32BitSkeletonRight(frame = 0) {
  const w = 44;
  const h = 56;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const topY = 8 + (frame === 1 ? -1 : 0);
  const stride = frame === 1 ? 3 : -1;

  // 1. Clattering skeleton legs & bony feet
  g.rect(cx - 5 - stride, topY + 31, 3, 12, "#d8e0d5", "bone");
  g.rect(cx - 5 - stride, topY + 36, 3, 2, "#a8b3a8", "bone"); // knee joint
  g.rect(cx - 6 - stride, topY + 42, 6, 3, "#e6ede4", "bone");
  g.rect(cx + 2 + stride, topY + 31, 3, 12, "#c2ccc0", "bone");
  g.rect(cx + 2 + stride, topY + 36, 3, 2, "#929e92", "bone");
  g.rect(cx + 2 + stride, topY + 42, 6, 3, "#d8e0d5", "bone");

  // 2. Pelvis & spine + crisp SNES ribcage!
  g.rect(cx - 5, topY + 28, 10, 4, "#c8d4c6", "bone");
  g.rect(cx - 2, topY + 18, 4, 11, "#9aa69a", "bone");
  g.rect(cx - 6, topY + 19, 12, 2, "#edf2eb", "bone");
  g.rect(cx - 5, topY + 22, 10, 2, "#dbe3d8", "bone");
  g.rect(cx - 4, topY + 25, 8, 2, "#c8d4c6", "bone");
  // Dark hollow gaps between ribs
  g.rect(cx - 4, topY + 21, 3, 1, "#262c38", "hollow");
  g.rect(cx + 1, topY + 21, 3, 1, "#262c38", "hollow");
  g.rect(cx - 3, topY + 24, 2, 1, "#262c38", "hollow");
  g.rect(cx + 1, topY + 24, 2, 1, "#262c38", "hollow");

  // 3. Tattered midnight-violet graveyard scarf fluttering behind
  g.rect(cx - 6, topY + 17, 12, 3, "#4e336e", "cloak");
  g.rect(cx - 10, topY + 18 + (frame === 1 ? 1 : 0), 5, 3, "#6a4794", "cloak");
  g.rect(cx - 12, topY + 20, 3, 2, "#3a2354", "cloak");

  // 4. Outstretched spooky rattling bone arms!
  const armLift = frame === 1 ? -3 : 0;
  g.rect(cx - 9, topY + 19, 4, 3, "#c8d4c6", "bone");
  g.rect(cx - 11, topY + 22, 3, 7, "#b6c2b4", "bone");
  g.rect(cx + 5, topY + 19 + armLift, 7, 3, "#edf2eb", "bone");
  g.rect(cx + 10, topY + 18 + armLift, 5, 4, "#ffffff", "bone"); // reaching bony hand

  // 5. Expressive sculpted ivory skull with glowing eerie emerald eyes & toothy grin!
  g.ellipse(cx + 1, topY + 9, 7.2, 6.6, "#edf2eb", "bone");
  g.ellipse(cx, topY + 7.5, 4.8, 3.8, "#ffffff", "bone");
  g.rect(cx - 4, topY + 13, 9, 4, "#dbe3d8", "bone"); // jaw
  // Deep eye sockets + bright glowing ghostly emerald eyes!
  g.rect(cx - 2, topY + 8, 3, 3, "#1b202e", "hollow");
  g.rect(cx + 3, topY + 8, 3, 3, "#1b202e", "hollow");
  g.rect(cx - 1, topY + 9, 2, 2, "#59f2a8", "glow");
  g.rect(cx + 4, topY + 9, 2, 2, "#59f2a8", "glow");
  g.set(cx - 1, topY + 9, "#d9ffed", "glow");
  g.set(cx + 4, topY + 9, "#d9ffed", "glow");
  // Cute nose notch & chattering pixel teeth
  g.rect(cx + 1, topY + 11, 2, 2, "#262c38", "hollow");
  g.rect(cx - 2, topY + 15, 7, 2, "#262c38", "hollow");
  g.set(cx - 1, topY + 15, "#ffffff", "bone");
  g.set(cx + 1, topY + 15, "#ffffff", "bone");
  g.set(cx + 3, topY + 15, "#ffffff", "bone");

  g.applySelOut({
    bone: "#272e3a",
    hollow: "#151822",
    cloak: "#241438",
    glow: "#1b5e42",
  });
  return g.toCanvas(0.5, { cx: cx, cy: 52, rx: 9, ry: 2.8 });
}

/**
 * Bake 32-bit Pure Pixel Spooky Graveyard Phantom (floating cloaked specter with glowing cyan eyes!)
 */
function bake32BitPhantomRight(frame = 0) {
  const w = 44;
  const h = 56;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const bob = frame === 1 ? -3 : 0;

  // 1. Billowing spectral body & animated wavy ectoplasm tail
  g.ellipse(cx, 24 + bob, 9.5, 13.5, "#6b7ec4", "ectoplasm");
  g.ellipse(cx - 1, 21 + bob, 7.2, 10.2, "#9bb3f0", "ectoplasm");
  g.ellipse(cx - 2, 18 + bob, 4.4, 6.2, "#d4e6ff", "ectoplasm");
  // Wavy trailing phantom hem
  if (frame === 0) {
    g.rect(cx - 10, 34 + bob, 5, 7, "#6b7ec4", "ectoplasm");
    g.rect(cx - 4, 35 + bob, 6, 9, "#8aa4e8", "ectoplasm");
    g.rect(cx + 3, 34 + bob, 5, 6, "#5364a8", "ectoplasm");
    g.rect(cx - 12, 37 + bob, 3, 4, "#9bb3f0", "ectoplasm");
  } else {
    g.rect(cx - 9, 35 + bob, 5, 9, "#8aa4e8", "ectoplasm");
    g.rect(cx - 3, 34 + bob, 6, 7, "#b6cdfc", "ectoplasm");
    g.rect(cx + 4, 35 + bob, 5, 8, "#6b7ec4", "ectoplasm");
    g.rect(cx - 13, 35 + bob, 4, 5, "#6b7ec4", "ectoplasm");
  }

  // 2. Spooky hooded cowl & dark shadowed face
  g.ellipse(cx + 1, 14 + bob, 8.2, 7.6, "#45528a", "hood");
  g.ellipse(cx, 12 + bob, 6.0, 4.8, "#6b7ec4", "hood");
  g.ellipse(cx + 2, 16 + bob, 5.2, 4.6, "#1a1f36", "shadow");
  // Glowing spectral cyan eyes + eerie "OOO" mouth!
  g.rect(cx, 14 + bob, 3, 3, "#5ceef5", "glow");
  g.rect(cx + 4, 14 + bob, 3, 3, "#5ceef5", "glow");
  g.set(cx + 1, 14 + bob, "#ffffff", "glow");
  g.set(cx + 5, 14 + bob, "#ffffff", "glow");
  g.rect(cx + 2, 18 + bob, 3, 2, "#8cf7fc", "glow");

  // 3. Reaching spectral phantom arms!
  g.rect(cx + 7, 21 + bob, 7, 4, "#9bb3f0", "ectoplasm");
  g.rect(cx + 12, 20 + bob, 4, 4, "#d4e6ff", "ectoplasm");
  g.rect(cx - 11, 22 + bob, 5, 4, "#6b7ec4", "ectoplasm");

  g.applySelOut({
    ectoplasm: "#27315e",
    hood: "#1e2445",
    shadow: "#121526",
    glow: "#1b788a",
  });
  return g.toCanvas(0.5, { cx: cx, cy: 52, rx: 8.5, ry: 2.5 });
}

/**
 * Bake 32-bit Pure Pixel Spooky Pumpkin Ghoul (carved glowing Jack-o'-Lantern head & violet cloak!)
 */
function bake32BitPumpkinGhoulRight(frame = 0) {
  const w = 44;
  const h = 56;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const bob = frame === 1 ? -2 : 0;
  const stride = frame === 1 ? 2 : -1;

  // 1. Tattered deep-violet cloak & creeping boots
  g.rect(cx - 5 - stride, 42, 5, 5, "#2b2038", "boot");
  g.rect(cx + 1 + stride, 42, 5, 5, "#22192e", "boot");
  g.ellipse(cx, 33 + bob, 9.2, 10.5, "#4a2763", "cloak");
  g.ellipse(cx - 1, 31 + bob, 6.4, 8.2, "#6b3b8c", "cloak");
  g.rect(cx - 9, 39 + bob, 4, 4, "#3a1e4f", "cloak");
  g.rect(cx - 3, 40 + bob, 5, 4, "#4a2763", "cloak");
  g.rect(cx + 4, 39 + bob, 5, 4, "#3a1e4f", "cloak");
  // Ragged autumn leaf collar
  g.rect(cx - 7, 23 + bob, 14, 3, "#2f6639", "leaf");
  g.rect(cx - 5, 25 + bob, 10, 2, "#468f52", "leaf");

  // 2. Crooked wooden twig arms reaching forward!
  g.rect(cx + 6, 26 + bob, 8, 3, "#6b4125", "twig");
  g.rect(cx + 12, 24 + bob, 3, 3, "#8f5936", "twig");
  g.rect(cx + 13, 28 + bob, 3, 2, "#6b4125", "twig");
  g.rect(cx - 11, 27 + bob, 5, 3, "#54321c", "twig");

  // 3. Big glowing carved Jack-o'-Lantern Pumpkin Head!
  g.ellipse(cx + 1, 15 + bob, 9.0, 7.6, "#e6701e", "pumpkin");
  g.ellipse(cx, 14 + bob, 6.2, 6.4, "#f78d2a", "pumpkin");
  g.ellipse(cx - 2, 13 + bob, 2.8, 5.2, "#ffb347", "pumpkin");
  // Pumpkin ribs
  g.rect(cx - 4, 9 + bob, 1, 11, "#bd5011", "pumpkin");
  g.rect(cx + 5, 9 + bob, 1, 11, "#bd5011", "pumpkin");
  // Curled green pumpkin stem on top
  g.rect(cx, 5 + bob, 3, 4, "#387a42", "leaf");
  g.rect(cx + 2, 4 + bob, 3, 2, "#54a85e", "leaf");
  // Glowing golden carved triangular eyes & toothy Jack-o'-Lantern grin!
  g.rect(cx - 2, 13 + bob, 3, 3, "#fff066", "glow");
  g.rect(cx + 3, 13 + bob, 3, 3, "#fff066", "glow");
  g.set(cx - 1, 14 + bob, "#ffffff", "glow");
  g.set(cx + 4, 14 + bob, "#ffffff", "glow");
  g.rect(cx - 3, 18 + bob, 9, 2, "#ffe14d", "glow");
  g.set(cx - 1, 18 + bob, "#bd5011", "pumpkin"); // jagged tooth!
  g.set(cx + 3, 19 + bob, "#bd5011", "pumpkin");

  g.applySelOut({
    pumpkin: "#521c07",
    cloak: "#1e102e",
    leaf: "#17361d",
    twig: "#2e1a0c",
    boot: "#140e1c",
    glow: "#9e4b08",
  });
  return g.toCanvas(0.5, { cx: cx, cy: 52, rx: 9.5, ry: 3.0 });
}

/**
 * Bake all 32-bit street-life sprites (roving turkeys, annoying protestors, spooky graveyard characters, and crisp pixel speech bubbles).
 */
export function bake32BitStreetLifeSprites(chants = []) {
  const out = {};

  // Roving Wild Turkeys (strut left/right + dramatic puffed tail fan!)
  const tR0 = bake32BitTurkeyRight(0, false);
  const tR1 = bake32BitTurkeyRight(1, false);
  const tPuffR = bake32BitTurkeyRight(1, true);
  out.turkey_right_0 = tR0;
  out.turkey_right_1 = tR1;
  out.turkey_left_0 = mirrorCanvasHorizontal(tR0);
  out.turkey_left_1 = mirrorCanvasHorizontal(tR1);
  out.turkey_puff_right = tPuffR;
  out.turkey_puff_left = mirrorCanvasHorizontal(tPuffR);

  // 3 Annoying Sidewalk Protestor variants (waving signs & shouting into megaphones!)
  for (let v = 0; v < 3; v++) {
    const pR0 = bake32BitProtestorRight(v, 0);
    const pR1 = bake32BitProtestorRight(v, 1);
    out[`protestor_${v}_right_0`] = pR0;
    out[`protestor_${v}_right_1`] = pR1;
    out[`protestor_${v}_left_0`] = mirrorCanvasHorizontal(pR0);
    out[`protestor_${v}_left_1`] = mirrorCanvasHorizontal(pR1);
  }

  // 3 Spooky Graveyard Character archetypes (Skeleton, Phantom, Pumpkin Ghoul!)
  const spookyBakers = [
    ["skeleton", bake32BitSkeletonRight],
    ["phantom", bake32BitPhantomRight],
    ["pumpkin_ghoul", bake32BitPumpkinGhoulRight],
  ];
  for (const [kind, baker] of spookyBakers) {
    const r0 = baker(0);
    const r1 = baker(1);
    out[`spooky_${kind}_right_0`] = r0;
    out[`spooky_${kind}_right_1`] = r1;
    out[`spooky_${kind}_left_0`] = mirrorCanvasHorizontal(r0);
    out[`spooky_${kind}_left_1`] = mirrorCanvasHorizontal(r1);
  }

  // Crisp 32-bit pixel speech bubbles!
  out.bubble_gobble = bakePixelSpeechBubble("GOBBLE!", {
    bg: "#fff6db",
    accent: "#cf2b26",
    textColor: "#4a1912",
  });
  out.bubble_watch_sign = bakePixelSpeechBubble("HEY! WATCH THE SIGN!", {
    bg: "#fff3cc",
    accent: "#d97a26",
    textColor: "#291a18",
  });
  out.bubble_mob_block = bakePixelSpeechBubble("NO PASSING! GO AROUND!", {
    bg: "#ffe5e0",
    accent: "#cf2b26",
    textColor: "#3d1010",
  });
  out.bubble_ouch = bakePixelSpeechBubble("OUCH!", {
    bg: "#ffe3e0",
    accent: "#e63946",
    textColor: "#5e0e14",
  });
  out.bubble_bonk = bakePixelSpeechBubble("BONK!", {
    bg: "#fff0d1",
    accent: "#d95b26",
    textColor: "#4a1b0c",
  });
  out.bubble_eek = bakePixelSpeechBubble("EEK!", {
    bg: "#f0e6ff",
    accent: "#8e44ad",
    textColor: "#2e1240",
  });
  out.bubble_boo = bakePixelSpeechBubble("BOO!", {
    bg: "#e6f6ff",
    accent: "#4574c4",
    textColor: "#17254a",
  });
  out.bubble_rattle = bakePixelSpeechBubble("RATTLE!", {
    bg: "#eaf7ee",
    accent: "#2d8c5a",
    textColor: "#153827",
  });
  out.bubble_spooky = bakePixelSpeechBubble("HEE HEE!", {
    bg: "#fff0d9",
    accent: "#d9641e",
    textColor: "#4a1b09",
  });
  chants.forEach((line, idx) => {
    out[`bubble_protest_${idx}`] = bakePixelSpeechBubble(line, {
      bg: "#fff8eb",
      accent: idx % 2 === 0 ? "#d93b36" : "#24573d",
      textColor: "#291a18",
    });
  });

  return out;
}
