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
  wetsuit: { id: "wetsuit", label: "Summer Wetsuit", shortLabel: "Wetsuit", icon: "🤿" },
  link: { id: "link", label: "Hero of Hyrule", shortLabel: "Link", icon: "🗡️" },
};

export const HERO_HAIR_STYLES = {
  short: { id: "short", label: "Short Hair" },
  ponytail: { id: "ponytail", label: "Long Ponytail" },
  bob: { id: "bob", label: "Shoulder Bob" },
  curly: { id: "curly", label: "Curly Hair" },
};

export const HERO_HAIR_COLORS = {
  light_brown: { id: "light_brown", label: "Light Brown", spec: "#f2d8a2", hi: "#d9ae71", mid: "#b58148", shade: "#8c5b2f", deep: "#633c1c", out: "#422712" },
  dark_brown: { id: "dark_brown", label: "Dark Brown", spec: "#8c6548", hi: "#6e4930", mid: "#4f321e", shade: "#382112", deep: "#24130a", out: "#1a0d07" },
  black: { id: "black", label: "Jet Black", spec: "#5c6475", hi: "#3c4252", mid: "#242833", shade: "#171921", deep: "#0d0f14", out: "#0a0b0f" },
  blonde: { id: "blonde", label: "Golden Blonde", spec: "#fff7bf", hi: "#ffe375", mid: "#e0b443", shade: "#b38422", deep: "#7d5810", out: "#4f360a" },
  auburn: { id: "auburn", label: "Auburn Red", spec: "#ffad75", hi: "#d96c38", mid: "#ad4421", shade: "#7d2b14", deep: "#521a0b", out: "#361007" },
};

export const HERO_SKIN_TONES = {
  warm: { id: "warm", label: "Warm Peach", hi: "#ffe8cf", mid: "#fad0a8", shade: "#e3a67b", deep: "#c27d57", cheek: "#f08c7d", out: "#7d482e" },
  light: { id: "light", label: "Fair", hi: "#fff2e6", mid: "#fce0cb", shade: "#e3baa0", deep: "#c4947a", cheek: "#f59ca6", out: "#825540" },
  tan: { id: "tan", label: "Olive / Tan", hi: "#f0c89c", mid: "#d9a573", shade: "#b88050", deep: "#8f5d34", cheek: "#d97a68", out: "#5c361c" },
  deep: { id: "deep", label: "Rich Brown", hi: "#b87c54", mid: "#8f5938", shade: "#6b3e24", deep: "#4a2916", cheek: "#a8534a", out: "#30190c" },
};

export const HERO_HEADWEAR = {
  kippah: { id: "kippah", label: "Knitted Kippah" },
  none: { id: "none", label: "No Hat (Show Hair)" },
  cap: { id: "cap", label: "Explorer Cap" },
  sun_hat: { id: "sun_hat", label: "Sun Hat" },
  beanie: { id: "beanie", label: "Winter Beanie" },
};

export const DEFAULT_HERO_PROFILE = {
  hairStyle: "short",
  hairColor: "light_brown",
  skinTone: "warm",
  headwear: "kippah",
  tzitzit: true,
};

export function resolveHeroProfile(raw = null) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HERO_PROFILE };
  return {
    hairStyle: HERO_HAIR_STYLES[raw.hairStyle] ? raw.hairStyle : DEFAULT_HERO_PROFILE.hairStyle,
    hairColor: HERO_HAIR_COLORS[raw.hairColor] ? raw.hairColor : DEFAULT_HERO_PROFILE.hairColor,
    skinTone: HERO_SKIN_TONES[raw.skinTone] ? raw.skinTone : DEFAULT_HERO_PROFILE.skinTone,
    headwear: HERO_HEADWEAR[raw.headwear] ? raw.headwear : DEFAULT_HERO_PROFILE.headwear,
    tzitzit: raw.tzitzit !== undefined ? Boolean(raw.tzitzit) : raw.headwear === "kippah",
  };
}

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

  // Summer Wetsuit & Swim Goggles!
  wetHi: "#485d7a",
  wetMid: "#29384d",
  wetShade: "#1a2536",
  wetDeep: "#101724",
  tealHi: "#8afcf4",
  tealMid: "#24d4cc",
  tealShade: "#12918c",
  tealDeep: "#0b5c59",
  goggleGlass: "#58c9f5",
  goggleGlassHi: "#d4f7ff",
  goggleStrap: "#1ad9cf",
  zipGold: "#ffd859",

  // Legend of Zelda — Link (Hero of Hyrule) Tunic, Pointy Cap, Hylian Shield & Master Sword!
  linkGreenSpec: "#98f56c",
  linkGreenHi: "#56cf48",
  linkGreenMid: "#2d9e38",
  linkGreenShade: "#1c732b",
  linkGreenDeep: "#124d20",
  linkHairSpec: "#fff5ad",
  linkHairHi: "#ffe26e",
  linkHairMid: "#e3b63b",
  linkHairShade: "#b5851f",
  linkHairDeep: "#7d550e",
  linkCreamHi: "#fff9eb",
  linkCreamMid: "#e8dec3",
  linkCreamShade: "#bfb393",
  linkLeatherHi: "#b8703b",
  linkLeatherMid: "#874a22",
  linkLeatherShade: "#5c2e13",
  linkLeatherDeep: "#381a0a",
  linkGoldHi: "#fff08a",
  linkGold: "#f2c63d",
  linkGoldShade: "#b58414",
  shieldBlueHi: "#5798f2",
  shieldBlue: "#265cb8",
  shieldBlueDark: "#153675",
  shieldSilver: "#e6edf5",
  shieldSilverShade: "#9ba8ba",
  shieldRed: "#d9322c",
  swordHiltHi: "#9478eb",
  swordHilt: "#5b41ab",
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
  wetsuit: "#0c1421",
  goggle: "#0a4a52",
  linkGreen: "#0d3817",
  linkLeather: "#2e1407",
  linkShield: "#11254d",
  scooter: "#141e26",
  dark: "#181620",
};

// =============================================================================
// 32-BIT LIAM — FRONT / BACK / SIDE DRAWING PRIMITIVES (48x56 PIXEL GRID)
// =============================================================================

function draw32BitSneaker(g, x, y, facing, outfit, lifted = false) {
  const isBB = outfit === "baseball";
  const isWet = outfit === "wetsuit";
  const isLink = outfit === "link";
  const hi = isLink ? LIAM_PAL.linkLeatherHi : isWet ? LIAM_PAL.tealMid : isBB ? LIAM_PAL.cleatHi : LIAM_PAL.shoeHi;
  const mid = isLink ? LIAM_PAL.linkLeatherMid : isWet ? LIAM_PAL.wetMid : isBB ? LIAM_PAL.cleatMid : LIAM_PAL.shoeMid;
  const sh = isLink ? LIAM_PAL.linkLeatherDeep : isWet ? LIAM_PAL.wetDeep : isBB ? LIAM_PAL.cleatShade : LIAM_PAL.shoeShade;
  const sole = isLink ? LIAM_PAL.linkLeatherShade : isWet ? LIAM_PAL.tealHi : LIAM_PAL.shoeSole;
  const soleSh = isLink ? LIAM_PAL.linkLeatherDeep : isWet ? LIAM_PAL.tealShade : LIAM_PAL.shoeSoleShade;
  const yOff = lifted ? -1 : 0;

  if (facing === "right") {
    // Detailed side-view boot/sneaker pointing right (9x6 px!)
    g.rect(x, y + yOff, 6, 4, mid, "shoe");
    g.rect(x + 1, y + yOff, 4, 1, hi, "shoe");
    g.rect(x, y + 3 + yOff, 6, 1, sh, "shoe");
    // Rounded sculpted toe cap pointing right
    g.rect(x + 6, y + 1 + yOff, 2, 3, mid, "shoe");
    g.set(x + 7, y + 2 + yOff, isLink ? hi : sole, "shoe");
    g.set(x + 7, y + 3 + yOff, sole, "shoe");
    if (isLink) {
      // Folded Hylian leather boot cuff!
      g.rect(x, y - 2 + yOff, 6, 2, LIAM_PAL.linkLeatherHi, "linkLeather");
      g.rect(x + 1, y - 1 + yOff, 4, 1, LIAM_PAL.linkGold, "linkLeather");
    } else {
      // Crisp white criss-cross laces + sporty side stripe!
      g.set(x + 4, y + yOff, sole, "shoe");
      g.set(x + 5, y + 1 + yOff, sole, "shoe");
      g.line(x + 1, y + 2 + yOff, x + 4, y + 2 + yOff, isBB ? LIAM_PAL.orangeMid : sole, "shoe");
    }
    // Outsole
    g.rect(x, y + 4 + yOff, 8, 1, sole, "shoe");
    g.rect(x + 1, y + 5 + yOff, 7, 1, soleSh, "shoe");
    if (isBB) {
      // Tiny cleat studs underneath!
      g.set(x + 1, y + 5 + yOff, LIAM_PAL.capDeep, "shoe");
      g.set(x + 4, y + 5 + yOff, LIAM_PAL.capDeep, "shoe");
      g.set(x + 6, y + 5 + yOff, LIAM_PAL.capDeep, "shoe");
    }
  } else {
    // Front/back view sculpted boot/sneaker (7x6 px)
    g.rect(x, y + yOff, 7, 4, mid, "shoe");
    g.rect(x + 1, y + yOff, 5, 1, hi, "shoe");
    g.rect(x, y + 3 + yOff, 7, 1, sh, "shoe");
    if (isLink) {
      // Tall folded leather boot cuff with subtle gold stitch!
      g.rect(x, y - 2 + yOff, 7, 2, LIAM_PAL.linkLeatherHi, "linkLeather");
      g.rect(x + 1, y - 1 + yOff, 5, 1, LIAM_PAL.linkLeatherMid, "linkLeather");
    } else if (facing === "down") {
      // White laces + rubber toe-cap highlight
      g.rect(x + 2, y + yOff, 3, 1, sole, "shoe");
      g.set(x + 3, y + 1 + yOff, sole, "shoe");
      g.rect(x + 1, y + 3 + yOff, 5, 1, sole, "shoe");
    }
    // Outsole
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

function drawHeroHairExtraFront(g, cx, topY, profile, hSpec, hHi, hMid, hShade, hDeep) {
  if (profile.hairStyle === "ponytail") {
    // Sweeping ponytail peeking cheerfully off the side!
    g.ellipse(cx + 9.5, topY + 13, 3.2, 5.2, hMid, "hair");
    g.ellipse(cx + 10.5, topY + 15, 2.4, 3.8, hShade, "hair");
    g.rect(cx + 8, topY + 10, 2, 2, "#e84a7f", "orange"); // hair tie
    g.set(cx + 9, topY + 12, hHi, "hair");
  } else if (profile.hairStyle === "bob") {
    // Full shoulder-length bob framing both cheeks!
    g.rect(cx - 10, topY + 9, 3, 12, hMid, "hair");
    g.rect(cx - 9, topY + 10, 1, 9, hHi, "hair");
    g.rect(cx - 10, topY + 19, 3, 2, hDeep, "hair");
    g.rect(cx + 8, topY + 9, 3, 12, hMid, "hair");
    g.rect(cx + 9, topY + 10, 1, 9, hHi, "hair");
    g.rect(cx + 8, topY + 19, 3, 2, hDeep, "hair");
  } else if (profile.hairStyle === "curly") {
    // Voluminous bouncy curls framing crown & temples!
    for (const [ox, oy, r] of [
      [-8, 7, 3.4], [8, 7, 3.4], [-9, 12, 3.0], [9, 12, 3.0], [-4, 4, 3.2], [4, 4, 3.2], [0, 3, 3.2],
    ]) {
      g.ellipse(cx + ox, topY + oy, r, r, hMid, "hair");
      g.ellipse(cx + ox - 0.5, topY + oy - 0.8, r * 0.55, r * 0.55, hHi, "hair");
    }
    g.set(cx - 3, topY + 3, hSpec, "hair");
  }
}

function drawHeroHairExtraBack(g, cx, topY, profile, hHi, hMid, hShade, hDeep) {
  if (profile.hairStyle === "ponytail") {
    g.rect(cx - 2, topY + 14, 5, 2, "#e84a7f", "orange");
    g.ellipse(cx, topY + 20, 4.2, 5.5, hMid, "hair");
    g.ellipse(cx - 1, topY + 19, 2.2, 3.5, hHi, "hair");
    g.rect(cx - 2, topY + 24, 5, 2, hDeep, "hair");
  } else if (profile.hairStyle === "bob") {
    g.rect(cx - 9, topY + 13, 19, 9, hMid, "hair");
    g.rect(cx - 8, topY + 20, 17, 2, hDeep, "hair");
    g.rect(cx - 6, topY + 14, 13, 4, hHi, "hair");
  } else if (profile.hairStyle === "curly") {
    for (const [ox, oy, r] of [
      [-7, 6, 3.6], [7, 6, 3.6], [-8, 12, 3.4], [8, 12, 3.4], [-5, 17, 3.2], [5, 17, 3.2], [0, 18, 3.5],
    ]) {
      g.ellipse(cx + ox, topY + oy, r, r, hMid, "hair");
      g.ellipse(cx + ox - 0.5, topY + oy - 0.8, r * 0.5, r * 0.5, hHi, "hair");
    }
  }
}

function drawHeroHairExtraSide(g, cx, topY, profile, hHi, hMid, hShade, hDeep) {
  if (profile.hairStyle === "ponytail") {
    g.rect(cx - 10, topY + 12, 2, 3, "#e84a7f", "orange");
    g.ellipse(cx - 13, topY + 16, 3.8, 5.2, hMid, "hair");
    g.ellipse(cx - 13, topY + 14, 2.2, 3.2, hHi, "hair");
    g.rect(cx - 15, topY + 20, 3, 2, hDeep, "hair");
  } else if (profile.hairStyle === "bob") {
    g.rect(cx - 9, topY + 12, 9, 10, hMid, "hair");
    g.rect(cx - 8, topY + 13, 5, 7, hHi, "hair");
    g.rect(cx - 9, topY + 20, 8, 2, hDeep, "hair");
  } else if (profile.hairStyle === "curly") {
    for (const [ox, oy, r] of [
      [-6, 6, 3.6], [0, 4, 3.4], [-8, 11, 3.4], [-7, 16, 3.2],
    ]) {
      g.ellipse(cx + ox, topY + oy, r, r, hMid, "hair");
      g.ellipse(cx + ox - 0.5, topY + oy - 0.8, r * 0.5, r * 0.5, hHi, "hair");
    }
  }
}

function drawEverydayHeadwearFront(g, cx, topY, headwear) {
  if (headwear === "none") return;
  if (headwear === "sun_hat") {
    // Wide woven straw/linen Mediterranean sun hat with royal-blue ribbon!
    g.ellipse(cx, topY + 7, 11.5, 2.8, "#d9b473", "jersey");
    g.ellipse(cx, topY + 6.5, 10.5, 2.0, "#f2d89c", "jersey");
    g.ellipse(cx, topY + 4.5, 6.8, 3.4, "#e8c682", "jersey");
    g.rect(cx - 6, topY + 5, 13, 2, "#2457a3", "kippah");
    return;
  }
  if (headwear === "beanie") {
    // Cozy winter knit beanie with pom-pom!
    g.ellipse(cx, topY + 1, 2.6, 2.2, "#fff5e0", "jersey");
    g.ellipse(cx, topY + 5.5, 8.8, 4.6, "#c93838", "orange");
    g.ellipse(cx - 1, topY + 4, 6.2, 2.6, "#eb5e55", "orange");
    g.rect(cx - 8, topY + 7, 17, 3, "#f0e6d2", "jersey");
    for (let bx = cx - 7; bx <= cx + 7; bx += 2) g.set(bx, topY + 8, "#c93838", "orange");
    return;
  }
  if (headwear === "cap") {
    g.ellipse(cx, topY + 6, 8.8, 4.8, "#245ca8", "kippah");
    g.ellipse(cx - 1, topY + 4.2, 6.0, 2.5, "#4d8ce0", "kippah");
    g.ellipse(cx, topY + 9, 9.0, 2.0, "#1c4382", "kippah");
    g.rect(cx - 7, topY + 8, 15, 1, "#6ba8f2", "kippah");
    return;
  }
  // Default: Royal-blue knitted kippah
  g.ellipse(cx, topY + 4, 5.8, 3.4, LIAM_PAL.kipMid, "kippah");
  g.ellipse(cx - 1, topY + 3, 3.6, 1.8, LIAM_PAL.kipHi, "kippah");
  for (let kx = cx - 4; kx <= cx + 4; kx += 2) {
    g.set(kx, topY + 4, LIAM_PAL.kipShade, "kippah");
    g.set(kx + 1, topY + 3, LIAM_PAL.kipHi, "kippah");
  }
  g.rect(cx - 5, topY + 6, 11, 1, LIAM_PAL.kipRimHi, "kippah");
  for (let kx = cx - 4; kx <= cx + 4; kx += 2) {
    g.set(kx, topY + 6, LIAM_PAL.kipRimShade, "kippah");
  }
  g.rect(cx - 5, topY + 7, 11, 1, LIAM_PAL.kipDeep, "kippah");
}

function drawEverydayHeadwearBack(g, cx, topY, headwear) {
  if (headwear === "none") return;
  if (headwear === "sun_hat") {
    g.ellipse(cx, topY + 8, 11.5, 3.2, "#d9b473", "jersey");
    g.ellipse(cx, topY + 7, 10.5, 2.2, "#f2d89c", "jersey");
    g.ellipse(cx, topY + 5, 6.8, 3.6, "#e8c682", "jersey");
    g.rect(cx - 6, topY + 6, 13, 2, "#2457a3", "kippah");
    return;
  }
  if (headwear === "beanie") {
    g.ellipse(cx, topY + 1, 2.6, 2.2, "#fff5e0", "jersey");
    g.ellipse(cx, topY + 6.5, 8.8, 5.2, "#c93838", "orange");
    g.rect(cx - 8, topY + 9, 17, 3, "#f0e6d2", "jersey");
    return;
  }
  if (headwear === "cap") {
    g.ellipse(cx, topY + 7, 8.8, 6.0, "#245ca8", "kippah");
    g.rect(cx - 8, topY + 10, 17, 2, "#1c4382", "kippah");
    return;
  }
  g.ellipse(cx, topY + 8, 5.8, 5.2, LIAM_PAL.kipShade, "kippah");
  g.ellipse(cx, topY + 7.5, 4.8, 4.3, LIAM_PAL.kipMid, "kippah");
  g.ellipse(cx - 1, topY + 6, 2.8, 2.2, LIAM_PAL.kipHi, "kippah");
  for (let ky = topY + 5; ky <= topY + 10; ky += 2) {
    for (let kx = cx - 3; kx <= cx + 3; kx += 2) {
      if ((kx - cx) * (kx - cx) + (ky - (topY + 8)) * (ky - (topY + 8)) <= 12) {
        g.set(kx, ky, LIAM_PAL.kipDeep, "kippah");
      }
    }
  }
  for (let deg = 20; deg <= 160; deg += 15) {
    const r = (deg * Math.PI) / 180;
    const rx = cx + Math.cos(r) * 5.2;
    const ry = topY + 8 + Math.sin(r) * 4.6;
    g.set(rx, ry, LIAM_PAL.kipRimHi, "kippah");
  }
}

function drawEverydayHeadwearSide(g, cx, topY, headwear) {
  if (headwear === "none") return;
  if (headwear === "sun_hat") {
    g.ellipse(cx, topY + 7.5, 11.2, 2.5, "#d9b473", "jersey");
    g.ellipse(cx, topY + 7, 10.2, 1.8, "#f2d89c", "jersey");
    g.ellipse(cx - 1, topY + 5, 6.5, 3.2, "#e8c682", "jersey");
    g.rect(cx - 7, topY + 6, 13, 2, "#2457a3", "kippah");
    return;
  }
  if (headwear === "beanie") {
    g.ellipse(cx - 2, topY + 1, 2.6, 2.2, "#fff5e0", "jersey");
    g.ellipse(cx - 1, topY + 6, 8.2, 4.6, "#c93838", "orange");
    g.rect(cx - 8, topY + 8, 15, 3, "#f0e6d2", "jersey");
    return;
  }
  if (headwear === "cap") {
    g.ellipse(cx - 1, topY + 6.5, 8.2, 4.8, "#245ca8", "kippah");
    g.rect(cx + 4, topY + 8, 9, 2, "#1c4382", "kippah");
    g.rect(cx + 5, topY + 8, 7, 1, "#6ba8f2", "kippah");
    return;
  }
  g.ellipse(cx - 4, topY + 5, 4.8, 3.2, LIAM_PAL.kipMid, "kippah");
  g.ellipse(cx - 4.5, topY + 4, 3.0, 1.6, LIAM_PAL.kipHi, "kippah");
  g.set(cx - 6, topY + 5, LIAM_PAL.kipShade, "kippah");
  g.set(cx - 3, topY + 5, LIAM_PAL.kipShade, "kippah");
  g.line(cx - 8, topY + 6, cx, topY + 8, LIAM_PAL.kipRimHi, "kippah");
  g.line(cx - 7, topY + 7, cx - 1, topY + 8, LIAM_PAL.kipDeep, "kippah");
}

function draw32BitHeadFront(g, cx, topY, outfit, happyFanfare = false, opts = {}) {
  const profile = resolveHeroProfile(opts.heroProfile);
  const hairPal = HERO_HAIR_COLORS[profile.hairColor] || HERO_HAIR_COLORS.light_brown;
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;
  const isSoccerKit = outfit === "baseball" && opts.soccerKit;
  const isLink = outfit === "link";
  const hSpec = isLink ? LIAM_PAL.linkHairSpec : hairPal.spec;
  const hHi = isLink ? LIAM_PAL.linkHairHi : hairPal.hi;
  const hMid = isLink ? LIAM_PAL.linkHairMid : hairPal.mid;
  const hShade = isLink ? LIAM_PAL.linkHairShade : hairPal.shade;
  const hDeep = isLink ? LIAM_PAL.linkHairDeep : hairPal.deep;

  // 1. Sculpted rounded 32-bit head oval (18x18 px)
  g.ellipse(cx, topY + 13, 8.2, 8.2, skinPal.mid, "skin");
  // Warm forehead & cheek highlights
  g.ellipse(cx - 1, topY + 11, 5.5, 4.5, skinPal.hi, "skin");
  // Sculpted jawline & chin shadow
  g.rect(cx - 5, topY + 19, 11, 1, skinPal.shade, "skin");
  g.rect(cx - 3, topY + 20, 7, 1, skinPal.deep, "skin");
  // Sculpted ears — classic POINTED Hylian elf ears when dressed as Link!
  if (isLink) {
    g.rect(cx - 11, topY + 12, 4, 3, skinPal.mid, "skin");
    g.rect(cx - 12, topY + 12, 2, 2, skinPal.hi, "skin");
    g.rect(cx - 10, topY + 14, 3, 1, skinPal.shade, "skin");
    g.rect(cx + 8, topY + 12, 4, 3, skinPal.mid, "skin");
    g.rect(cx + 11, topY + 12, 2, 2, skinPal.hi, "skin");
    g.rect(cx + 8, topY + 14, 3, 1, skinPal.shade, "skin");
  } else {
    g.rect(cx - 9, topY + 12, 2, 4, skinPal.mid, "skin");
    g.set(cx - 9, topY + 13, skinPal.shade, "skin");
    g.set(cx - 8, topY + 14, skinPal.deep, "skin");
    g.rect(cx + 8, topY + 12, 2, 4, skinPal.mid, "skin");
    g.set(cx + 9, topY + 13, skinPal.shade, "skin");
    g.set(cx + 8, topY + 14, skinPal.deep, "skin");
  }

  // 2. Hair (customizable style & color, or golden-blonde Link bangs!)
  if (!isLink) drawHeroHairExtraFront(g, cx, topY, profile, hSpec, hHi, hMid, hShade, hDeep);
  g.ellipse(cx, topY + 8, 8.6, 5.5, hMid, "hair");
  g.rect(cx - 8, topY + 8, 2, isLink ? 8 : 5, hShade, "hair");
  g.rect(cx + 7, topY + 8, 2, isLink ? 8 : 5, hShade, "hair");
  g.set(cx - 8, topY + (isLink ? 15 : 12), hDeep, "hair");
  g.set(cx + 8, topY + (isLink ? 15 : 12), hDeep, "hair");
  g.rect(cx - 7, topY + 9, 15, 2, hMid, "hair");
  for (let hx = cx - 6; hx <= cx + 6; hx += 3) {
    g.line(hx, topY + 5, hx, topY + 10, hShade, "hair");
    g.line(hx + 1, topY + 5, hx + 1, topY + 9, hHi, "hair");
  }
  g.rect(cx - 5, topY + 5, 11, 2, hHi, "hair");
  g.rect(cx - 3, topY + 5, 6, 1, hSpec, "hair");
  g.rect(cx - 6, topY + 11, 13, 1, skinPal.shade, "skin");
  g.rect(cx - 7, topY + 10, 15, 1, hDeep, "hair");
  g.set(cx - 2, topY + 10, hShade, "hair");
  g.set(cx + 3, topY + 10, hShade, "hair");
  if (isLink) {
    g.rect(cx - 6, topY + 10, 4, 2, hHi, "hair");
    g.rect(cx + 3, topY + 10, 4, 2, hHi, "hair");
    g.set(cx, topY + 10, skinPal.hi, "skin");
  }

  // 3. Expressive 32-bit eyes
  for (const side of [-1, 1]) {
    const ex = side < 0 ? cx - 5 : cx + 3;
    const ey = topY + 13;
    g.rect(ex, ey, 3, 1, LIAM_PAL.eyeLash, "skin");
    g.rect(ex, ey + 1, 3, 3, LIAM_PAL.eyeLash, "skin");
    g.set(ex + 1, ey + 2, isLink ? "#2e78c7" : LIAM_PAL.eyeIris, "skin");
    g.set(ex + 1, ey + 3, isLink ? "#64b5f6" : LIAM_PAL.eyeIrisHi, "skin");
    g.set(ex, ey + 1, LIAM_PAL.white, "skin");
    g.set(ex + 2, ey + 3, "#e8f0fa", "skin");
  }
  g.set(cx, topY + 16, skinPal.shade, "skin");
  g.set(cx, topY + 15, skinPal.hi, "skin");
  g.rect(cx - 6, topY + 16, 2, 1, skinPal.cheek, "skin");
  g.rect(cx + 5, topY + 16, 2, 1, skinPal.cheek, "skin");
  if (happyFanfare) {
    g.rect(cx - 2, topY + 17, 5, 2, LIAM_PAL.mouthDark, "skin");
    g.rect(cx - 1, topY + 17, 3, 1, LIAM_PAL.white, "skin");
    g.rect(cx - 1, topY + 18, 3, 1, LIAM_PAL.mouth, "skin");
  } else {
    g.rect(cx - 1, topY + 18, 3, 1, LIAM_PAL.mouth, "skin");
    g.set(cx - 2, topY + 17, skinPal.shade, "skin");
    g.set(cx + 2, topY + 17, skinPal.shade, "skin");
  }

  // 4. Headwear
  if (isLink) {
    g.ellipse(cx, topY + 5, 9.2, 4.6, LIAM_PAL.linkGreenMid, "linkGreen");
    g.ellipse(cx - 1, topY + 3.5, 6.5, 2.5, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 4, topY + 2, 6, 1, LIAM_PAL.linkGreenSpec, "linkGreen");
    g.rect(cx + 6, topY + 2, 6, 4, LIAM_PAL.linkGreenMid, "linkGreen");
    g.rect(cx + 7, topY + 2, 4, 2, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx + 10, topY + 4, 4, 4, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx + 12, topY + 6, 3, 3, LIAM_PAL.linkGreenDeep, "linkGreen");
    g.set(cx + 14, topY + 8, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 8, topY + 8, 17, 2, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 7, topY + 8, 15, 1, LIAM_PAL.linkGold, "linkGreen");
  } else if (outfit === "wetsuit") {
    g.rect(cx - 8, topY + 13, 2, 2, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx + 7, topY + 13, 2, 2, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx - 7, topY + 11, 15, 6, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx - 6, topY + 11, 13, 1, LIAM_PAL.tealHi, "goggle");
    g.rect(cx - 6, topY + 12, 13, 4, LIAM_PAL.goggleGlass, "goggle");
    g.rect(cx - 5, topY + 12, 5, 1, LIAM_PAL.goggleGlassHi, "goggle");
    g.set(cx - 4, topY + 12, LIAM_PAL.white, "goggle");
    g.rect(cx + 2, topY + 12, 3, 1, LIAM_PAL.goggleGlassHi, "goggle");
    g.set(cx - 4, topY + 14, LIAM_PAL.eyeLash, "goggle");
    g.set(cx + 4, topY + 14, LIAM_PAL.eyeLash, "goggle");
    g.rect(cx - 1, topY + 15, 3, 2, LIAM_PAL.tealShade, "goggle");
    g.rect(cx + 1, topY + 17, 4, 2, LIAM_PAL.wetMid, "goggle");
    g.rect(cx + 5, topY + 17, 5, 2, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx + 6, topY + 17, 3, 1, LIAM_PAL.tealHi, "goggle");
    g.rect(cx + 9, topY + 2, 3, 17, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx + 9, topY + 2, 1, 16, LIAM_PAL.tealHi, "goggle");
    g.rect(cx + 11, topY + 3, 1, 15, LIAM_PAL.tealShade, "goggle");
    g.rect(cx + 8, topY + 13, 4, 2, LIAM_PAL.wetMid, "goggle");
    g.rect(cx + 9, topY - 1, 3, 4, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 9, topY - 1, 2, 2, LIAM_PAL.orangeHi, "orange");
    g.set(cx + 10, topY - 1, LIAM_PAL.zipGold, "orange");
  } else if (outfit === "baseball" && !isSoccerKit) {
    g.ellipse(cx, topY + 6, 8.8, 5.2, LIAM_PAL.capMid, "cap");
    g.ellipse(cx - 1, topY + 4, 6.2, 3.0, LIAM_PAL.capHi, "cap");
    g.rect(cx - 8, topY + 7, 17, 2, LIAM_PAL.capShade, "cap");
    g.line(cx - 4, topY + 2, cx - 5, topY + 8, LIAM_PAL.capDeep, "cap");
    g.line(cx + 4, topY + 2, cx + 5, topY + 8, LIAM_PAL.capDeep, "cap");
    g.rect(cx - 1, topY + 1, 3, 1, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 1, topY + 4, 3, 3, LIAM_PAL.orangeMid, "orange");
    g.set(cx, topY + 5, LIAM_PAL.capMid, "cap");
    g.set(cx + 1, topY + 5, LIAM_PAL.orangeHi, "orange");
    g.ellipse(cx, topY + 9, 9.2, 2.2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 7, topY + 8, 15, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx - 7, topY + 10, 15, 1, LIAM_PAL.orangeShade, "orange");
  } else if (isSoccerKit) {
    // Soccer Kit: sporty blue-and-white athletic headband + optional kippah!
    g.rect(cx - 8, topY + 8, 17, 2, "#245ca8", "kippah");
    g.rect(cx - 7, topY + 8, 15, 1, "#ffffff", "jersey");
    if (profile.headwear === "kippah") drawEverydayHeadwearFront(g, cx, topY, "kippah");
  } else {
    drawEverydayHeadwearFront(g, cx, topY, profile.headwear);
  }
}

function draw32BitHeadBack(g, cx, topY, outfit, opts = {}) {
  const profile = resolveHeroProfile(opts.heroProfile);
  const hairPal = HERO_HAIR_COLORS[profile.hairColor] || HERO_HAIR_COLORS.light_brown;
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;
  const isSoccerKit = outfit === "baseball" && opts.soccerKit;
  const isLink = outfit === "link";
  const hHi = isLink ? LIAM_PAL.linkHairHi : hairPal.hi;
  const hMid = isLink ? LIAM_PAL.linkHairMid : hairPal.mid;
  const hShade = isLink ? LIAM_PAL.linkHairShade : hairPal.shade;
  const hDeep = isLink ? LIAM_PAL.linkHairDeep : hairPal.deep;

  g.rect(cx - 3, topY + 19, 7, 3, skinPal.shade, "skin");
  if (isLink) {
    g.rect(cx - 11, topY + 12, 4, 3, skinPal.mid, "skin");
    g.rect(cx - 12, topY + 12, 2, 2, skinPal.hi, "skin");
    g.rect(cx + 8, topY + 12, 4, 3, skinPal.mid, "skin");
    g.rect(cx + 11, topY + 12, 2, 2, skinPal.hi, "skin");
  } else {
    g.rect(cx - 9, topY + 12, 2, 4, skinPal.mid, "skin");
    g.set(cx - 9, topY + 14, skinPal.shade, "skin");
    g.rect(cx + 8, topY + 12, 2, 4, skinPal.mid, "skin");
    g.set(cx + 9, topY + 14, skinPal.shade, "skin");
  }

  g.ellipse(cx, topY + 12, 8.6, 8.4, hMid, "hair");
  for (let hx = cx - 6; hx <= cx + 6; hx += 2) {
    g.line(hx, topY + 6, hx, topY + 18, hShade, "hair");
    g.line(hx + 1, topY + 7, hx + 1, topY + 16, hHi, "hair");
  }
  g.rect(cx - 6, topY + 18, 13, 2, hDeep, "hair");
  g.rect(cx - 5, topY + 17, 11, 1, hShade, "hair");
  if (!isLink) drawHeroHairExtraBack(g, cx, topY, profile, hHi, hMid, hShade, hDeep);

  if (isLink) {
    g.ellipse(cx, topY + 7, 9.0, 6.2, LIAM_PAL.linkGreenMid, "linkGreen");
    g.ellipse(cx - 1, topY + 4.5, 6.4, 3.0, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 8, topY + 10, 17, 2, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 7, topY + 11, 15, 1, LIAM_PAL.linkGold, "linkGreen");
    g.rect(cx - 4, topY + 11, 9, 4, LIAM_PAL.linkGreenMid, "linkGreen");
    g.rect(cx - 3, topY + 12, 6, 3, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 2, topY + 15, 6, 3, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx, topY + 18, 3, 2, LIAM_PAL.linkGreenDeep, "linkGreen");
  } else if (outfit === "wetsuit") {
    g.rect(cx - 8, topY + 12, 17, 3, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx - 7, topY + 12, 15, 1, LIAM_PAL.tealHi, "goggle");
    g.rect(cx - 2, topY + 12, 5, 3, LIAM_PAL.white, "goggle");
    g.rect(cx - 1, topY + 13, 3, 1, LIAM_PAL.tealShade, "goggle");
    g.rect(cx - 11, topY + 2, 3, 16, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx - 11, topY + 2, 1, 15, LIAM_PAL.tealHi, "goggle");
    g.rect(cx - 9, topY + 3, 1, 14, LIAM_PAL.tealShade, "goggle");
    g.rect(cx - 11, topY + 12, 4, 2, LIAM_PAL.wetMid, "goggle");
    g.rect(cx - 11, topY - 1, 3, 4, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 11, topY - 1, 2, 2, LIAM_PAL.orangeHi, "orange");
  } else if (outfit === "baseball" && !isSoccerKit) {
    g.ellipse(cx, topY + 7, 8.8, 6.2, LIAM_PAL.capMid, "cap");
    g.ellipse(cx - 1, topY + 5, 6.4, 3.2, LIAM_PAL.capHi, "cap");
    g.rect(cx - 8, topY + 10, 17, 3, LIAM_PAL.capShade, "cap");
    g.rect(cx - 1, topY + 1, 3, 1, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 3, topY + 10, 7, 3, hMid, "hair");
    g.rect(cx - 3, topY + 11, 7, 1, LIAM_PAL.orangeMid, "orange");
    g.set(cx, topY + 11, LIAM_PAL.orangeHi, "orange");
  } else if (isSoccerKit) {
    g.rect(cx - 8, topY + 9, 17, 2, "#245ca8", "kippah");
    if (profile.headwear === "kippah") drawEverydayHeadwearBack(g, cx, topY, "kippah");
  } else {
    drawEverydayHeadwearBack(g, cx, topY, profile.headwear);
  }
}

function draw32BitHeadRight(g, cx, topY, outfit, opts = {}) {
  const profile = resolveHeroProfile(opts.heroProfile);
  const hairPal = HERO_HAIR_COLORS[profile.hairColor] || HERO_HAIR_COLORS.light_brown;
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;
  const isSoccerKit = outfit === "baseball" && opts.soccerKit;
  const isLink = outfit === "link";
  const hSpec = isLink ? LIAM_PAL.linkHairSpec : hairPal.spec;
  const hHi = isLink ? LIAM_PAL.linkHairHi : hairPal.hi;
  const hMid = isLink ? LIAM_PAL.linkHairMid : hairPal.mid;
  const hShade = isLink ? LIAM_PAL.linkHairShade : hairPal.shade;
  const hDeep = isLink ? LIAM_PAL.linkHairDeep : hairPal.deep;

  g.ellipse(cx, topY + 13, 7.6, 8.0, skinPal.mid, "skin");
  g.ellipse(cx + 2, topY + 12, 4.8, 5.2, skinPal.hi, "skin");
  g.rect(cx + 7, topY + 14, 2, 2, skinPal.mid, "skin");
  g.set(cx + 8, topY + 14, skinPal.hi, "skin");
  g.set(cx + 7, topY + 16, skinPal.shade, "skin");
  g.rect(cx - 2, topY + 19, 8, 1, skinPal.shade, "skin");
  g.rect(cx, topY + 20, 5, 1, skinPal.deep, "skin");
  g.rect(cx + 4, topY + 16, 2, 1, skinPal.cheek, "skin");
  g.rect(cx + 5, topY + 18, 2, 1, LIAM_PAL.mouth, "skin");

  g.rect(cx + 4, topY + 12, 3, 1, LIAM_PAL.eyeLash, "skin");
  g.rect(cx + 4, topY + 13, 3, 3, LIAM_PAL.eyeLash, "skin");
  g.set(cx + 5, topY + 14, isLink ? "#2e78c7" : LIAM_PAL.eyeIris, "skin");
  g.set(cx + 5, topY + 15, isLink ? "#64b5f6" : LIAM_PAL.eyeIrisHi, "skin");
  g.set(cx + 4, topY + 13, LIAM_PAL.white, "skin");

  if (!isLink) drawHeroHairExtraSide(g, cx, topY, profile, hHi, hMid, hShade, hDeep);
  g.ellipse(cx - 1, topY + 8, 8.0, 5.0, hMid, "hair");
  g.rect(cx - 8, topY + 8, 7, 10, hMid, "hair");
  g.rect(cx - 8, topY + 10, 3, 8, hShade, "hair");
  g.rect(cx - 7, topY + 17, 6, 2, hDeep, "hair");
  g.rect(cx - 5, topY + 5, 10, 2, hHi, "hair");
  g.rect(cx - 3, topY + 5, 6, 1, hSpec, "hair");
  g.rect(cx + 1, topY + 8, 7, 2, hMid, "hair");
  g.rect(cx + 2, topY + 10, 6, 1, hDeep, "hair");
  if (isLink) {
    g.rect(cx - 5, topY + 12, 6, 3, skinPal.mid, "skin");
    g.rect(cx - 6, topY + 12, 3, 2, skinPal.hi, "skin");
    g.rect(cx - 4, topY + 14, 4, 1, skinPal.shade, "skin");
  } else {
    g.rect(cx - 2, topY + 12, 3, 4, skinPal.mid, "skin");
    g.set(cx - 1, topY + 13, skinPal.shade, "skin");
    g.set(cx - 1, topY + 14, skinPal.deep, "skin");
  }

  if (isLink) {
    g.ellipse(cx - 1, topY + 5.5, 8.6, 4.4, LIAM_PAL.linkGreenMid, "linkGreen");
    g.ellipse(cx - 1, topY + 4, 6.0, 2.2, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 3, topY + 2, 5, 1, LIAM_PAL.linkGreenSpec, "linkGreen");
    g.rect(cx - 14, topY + 4, 8, 5, LIAM_PAL.linkGreenMid, "linkGreen");
    g.rect(cx - 13, topY + 4, 6, 2, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 16, topY + 7, 5, 4, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 18, topY + 9, 3, 3, LIAM_PAL.linkGreenDeep, "linkGreen");
    g.rect(cx - 7, topY + 8, 15, 2, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 6, topY + 8, 14, 1, LIAM_PAL.linkGold, "linkGreen");
  } else if (outfit === "wetsuit") {
    g.rect(cx - 8, topY + 13, 12, 2, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx - 7, topY + 13, 10, 1, LIAM_PAL.tealHi, "goggle");
    g.rect(cx + 3, topY + 11, 6, 6, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx + 4, topY + 11, 4, 1, LIAM_PAL.tealHi, "goggle");
    g.rect(cx + 4, topY + 12, 5, 4, LIAM_PAL.goggleGlass, "goggle");
    g.rect(cx + 5, topY + 12, 3, 1, LIAM_PAL.goggleGlassHi, "goggle");
    g.set(cx + 8, topY + 12, LIAM_PAL.white, "goggle");
    g.rect(cx + 5, topY + 17, 4, 2, LIAM_PAL.wetMid, "goggle");
    g.rect(cx + 1, topY + 17, 5, 2, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx + 2, topY + 17, 3, 1, LIAM_PAL.tealHi, "goggle");
    g.rect(cx, topY + 2, 3, 17, LIAM_PAL.goggleStrap, "goggle");
    g.rect(cx + 1, topY + 2, 1, 16, LIAM_PAL.tealHi, "goggle");
    g.rect(cx, topY + 3, 1, 15, LIAM_PAL.tealShade, "goggle");
    g.rect(cx - 1, topY + 13, 4, 2, LIAM_PAL.wetMid, "goggle");
    g.rect(cx, topY - 1, 3, 4, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 1, topY - 1, 2, 2, LIAM_PAL.orangeHi, "orange");
    g.set(cx + 1, topY - 1, LIAM_PAL.zipGold, "orange");
  } else if (outfit === "baseball" && !isSoccerKit) {
    g.ellipse(cx - 1, topY + 6.5, 8.2, 4.8, LIAM_PAL.capMid, "cap");
    g.ellipse(cx - 2, topY + 4.5, 5.5, 2.5, LIAM_PAL.capHi, "cap");
    g.rect(cx - 8, topY + 8, 15, 2, LIAM_PAL.capShade, "cap");
    g.rect(cx - 2, topY + 1, 3, 1, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 4, topY + 8, 10, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 5, topY + 8, 8, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx + 5, topY + 10, 9, 1, LIAM_PAL.orangeShade, "orange");
    g.rect(cx + 6, topY + 10, 5, 1, LIAM_PAL.orangeDeep, "orange");
  } else if (isSoccerKit) {
    g.rect(cx - 8, topY + 8, 15, 2, "#245ca8", "kippah");
    if (profile.headwear === "kippah") drawEverydayHeadwearSide(g, cx, topY, "kippah");
  } else {
    drawEverydayHeadwearSide(g, cx, topY, profile.headwear);
  }
}

function draw32BitTorsoAndLegsFrontOrBack(g, cx, topY, facing, stepFrame, outfit, onScooter, opts = {}) {
  const profile = resolveHeroProfile(opts.heroProfile);
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;
  const isBack = facing === "up";
  const isSoccerKit = outfit === "baseball" && Boolean(opts.soccerKit);
  const isBB = outfit === "baseball" && !isSoccerKit;
  const isWet = outfit === "wetsuit";
  const isLink = outfit === "link";
  const liftL = !onScooter && stepFrame === 1 ? -2 : 0;
  const liftR = !onScooter && stepFrame === 2 ? -2 : 0;
  const armSwingL = !onScooter && stepFrame === 1 ? -2 : stepFrame === 2 ? 1 : 0;
  const armSwingR = !onScooter && stepFrame === 2 ? -2 : stepFrame === 1 ? 1 : 0;
  const tzSway = stepFrame === 1 ? -1 : stepFrame === 2 ? 1 : 0;

  // 1. Legs & Boots/Sneakers (drawn first behind torso hem!)
  const pHi = isLink ? LIAM_PAL.linkCreamHi : isWet ? LIAM_PAL.wetHi : isSoccerKit ? "#2d5ca6" : isBB ? LIAM_PAL.bbPantsHi : LIAM_PAL.pantsHi;
  const pMid = isLink ? LIAM_PAL.linkCreamMid : isWet ? LIAM_PAL.wetMid : isSoccerKit ? "#1c3f7a" : isBB ? LIAM_PAL.bbPantsMid : LIAM_PAL.pantsMid;
  const pSh = isLink ? LIAM_PAL.linkCreamShade : isWet ? LIAM_PAL.wetShade : isSoccerKit ? "#132c57" : isBB ? LIAM_PAL.bbPantsShade : LIAM_PAL.pantsShade;
  const pDeep = isLink ? LIAM_PAL.linkCreamShade : isWet ? LIAM_PAL.wetDeep : isSoccerKit ? "#0e2040" : isBB ? LIAM_PAL.bbPantsShade : LIAM_PAL.pantsDeep;
  const pMat = isLink ? "jersey" : isWet ? "wetsuit" : isBB ? "jersey" : "pants";

  // Left leg
  if (isSoccerKit) {
    // Athletic soccer shorts + sunlit knee + blue/white striped socks!
    g.rect(cx - 6, topY + 33 + liftL, 6, 5, pMid, "pants");
    g.rect(cx - 5, topY + 34 + liftL, 3, 3, pHi, "pants");
    g.rect(cx - 6, topY + 38 + liftL, 6, 3, skinPal.mid, "skin");
    g.rect(cx - 5, topY + 38 + liftL, 3, 2, skinPal.hi, "skin");
    g.rect(cx - 6, topY + 41 + liftL, 6, 3, "#ffffff", "jersey");
    g.rect(cx - 6, topY + 41 + liftL, 6, 1, "#245ca8", "kippah");
  } else {
    g.rect(cx - 6, topY + 33 + liftL, 6, 11, pMid, pMat);
    g.rect(cx - 5, topY + 34 + liftL, 3, 8, pHi, pMat);
    g.rect(cx - 1, topY + 34 + liftL, 1, 9, pDeep, pMat);
    if (isWet) {
      g.rect(cx - 6, topY + 34 + liftL, 2, 9, LIAM_PAL.tealMid, "wetsuit");
      g.rect(cx - 6, topY + 34 + liftL, 1, 8, LIAM_PAL.tealHi, "wetsuit");
      g.rect(cx - 4, topY + 38 + liftL, 3, 2, LIAM_PAL.wetShade, "wetsuit");
    } else if (isBB) {
      g.rect(cx - 6, topY + 41 + liftL, 6, 2, LIAM_PAL.orangeMid, "orange");
      g.rect(cx - 5, topY + 41 + liftL, 4, 1, LIAM_PAL.orangeHi, "orange");
      g.rect(cx - 6, topY + 43 + liftL, 6, 1, LIAM_PAL.capMid, "cap");
    } else {
      g.rect(cx - 6, topY + 43 + liftL, 6, 1, pSh, pMat);
    }
  }
  draw32BitSneaker(g, cx - 7, topY + 44 + liftL, facing, outfit, liftL < 0);

  // Right leg
  if (isSoccerKit) {
    g.rect(cx + 1, topY + 33 + liftR, 6, 5, pMid, "pants");
    g.rect(cx + 2, topY + 34 + liftR, 3, 3, pHi, "pants");
    g.rect(cx + 1, topY + 38 + liftR, 6, 3, skinPal.mid, "skin");
    g.rect(cx + 2, topY + 38 + liftR, 3, 2, skinPal.hi, "skin");
    g.rect(cx + 1, topY + 41 + liftR, 6, 3, "#ffffff", "jersey");
    g.rect(cx + 1, topY + 41 + liftR, 6, 1, "#245ca8", "kippah");
  } else {
    g.rect(cx + 1, topY + 33 + liftR, 6, 11, pMid, pMat);
    g.rect(cx + 2, topY + 34 + liftR, 3, 8, pHi, pMat);
    g.rect(cx + 1, topY + 34 + liftR, 1, 9, pDeep, pMat);
    if (isWet) {
      g.rect(cx + 5, topY + 34 + liftR, 2, 9, LIAM_PAL.tealMid, "wetsuit");
      g.rect(cx + 6, topY + 34 + liftR, 1, 8, LIAM_PAL.tealHi, "wetsuit");
      g.rect(cx + 2, topY + 38 + liftR, 3, 2, LIAM_PAL.wetShade, "wetsuit");
    } else if (isBB) {
      g.rect(cx + 1, topY + 41 + liftR, 6, 2, LIAM_PAL.orangeMid, "orange");
      g.rect(cx + 2, topY + 41 + liftR, 4, 1, LIAM_PAL.orangeHi, "orange");
      g.rect(cx + 1, topY + 43 + liftR, 6, 1, LIAM_PAL.capMid, "cap");
    } else {
      g.rect(cx + 1, topY + 43 + liftR, 6, 1, pSh, pMat);
    }
  }
  draw32BitSneaker(g, cx + 1, topY + 44 + liftR, facing, outfit, liftR < 0);

  // 2. Arms (Hero's emerald sleeves & cream gauntlets, wetsuit sleeves, soccer sleeves, or short sleeves!)
  const slHi = isLink ? LIAM_PAL.linkGreenHi : isWet ? LIAM_PAL.tealHi : isSoccerKit ? "#ffffff" : isBB ? LIAM_PAL.orangeHi : LIAM_PAL.poloHi;
  const slMid = isLink ? LIAM_PAL.linkGreenMid : isWet ? LIAM_PAL.tealMid : isSoccerKit ? "#dce8f8" : isBB ? LIAM_PAL.orangeMid : LIAM_PAL.poloMid;
  const slSh = isLink ? LIAM_PAL.linkGreenShade : isWet ? LIAM_PAL.tealShade : isSoccerKit ? "#245ca8" : isBB ? LIAM_PAL.orangeShade : LIAM_PAL.poloShade;
  const slMat = isLink ? "linkGreen" : isWet ? "wetsuit" : isSoccerKit ? "jersey" : isBB ? "orange" : "polo";

  for (const [side, swing] of [[-1, armSwingL], [1, armSwingR]]) {
    const ax = side < 0 ? cx - 10 : cx + 7;
    const ay = topY + 22 + swing;
    if (isLink) {
      // Emerald tunic shoulder sleeve + cream undershirt forearm + leather adventurer bracer!
      g.rect(ax, ay, 4, 5, LIAM_PAL.linkGreenMid, "linkGreen");
      g.rect(ax + (side < 0 ? 1 : 0), ay + 1, 2, 3, LIAM_PAL.linkGreenHi, "linkGreen");
      g.rect(ax, ay + 5, 4, 3, LIAM_PAL.linkCreamMid, "jersey");
      g.rect(ax, ay + 7, 4, 2, LIAM_PAL.linkLeatherMid, "linkLeather");
      g.rect(ax + (side < 0 ? 0 : 1), ay + 9, 3, 2, skinPal.mid, "skin");
    } else if (isWet) {
      g.rect(ax, ay, 4, 8, LIAM_PAL.wetMid, "wetsuit");
      g.rect(ax + (side < 0 ? 0 : 2), ay, 2, 7, LIAM_PAL.tealMid, "wetsuit");
      g.rect(ax + (side < 0 ? 0 : 3), ay + 1, 1, 5, LIAM_PAL.tealHi, "wetsuit");
      g.rect(ax, ay + 7, 4, 1, LIAM_PAL.tealShade, "wetsuit");
      g.rect(ax + (side < 0 ? 0 : 1), ay + 8, 3, 3, skinPal.mid, "skin");
      g.rect(ax + (side < 0 ? 1 : 1), ay + 8, 2, 2, skinPal.hi, "skin");
    } else {
      g.rect(ax, ay, 4, 6, slMid, slMat);
      g.rect(ax + (side < 0 ? 1 : 0), ay + 1, 2, 4, slHi, slMat);
      g.rect(ax, ay + 5, 4, 1, isBB ? LIAM_PAL.capMid : slSh, slMat);
      g.rect(ax + (side < 0 ? 0 : 1), ay + 6, 3, 5, skinPal.mid, "skin");
      g.rect(ax + (side < 0 ? 1 : 1), ay + 6, 2, 3, skinPal.hi, "skin");
      g.rect(ax + (side < 0 ? 0 : 1), ay + 10, 3, 1, skinPal.shade, "skin");
    }
  }

  // 3. Torso (Link Hero's Tunic OR Summer Wetsuit OR Team Giants Jersey OR Collared Polo!)
  if (isLink) {
    // Master Sword purple-winged hilt peeking heroically over Link's shoulder from the front too!
    if (!isBack) {
      g.rect(cx + 6, topY + 15, 3, 6, LIAM_PAL.swordHilt, "linkShield");
      g.rect(cx + 7, topY + 14, 2, 2, LIAM_PAL.linkGoldHi, "linkShield");
      g.rect(cx + 5, topY + 18, 5, 2, LIAM_PAL.swordHiltHi, "linkShield");
    }
    // Iconic Emerald Kokiri/Hylian Tunic with flared tunic skirt!
    g.rect(cx - 7, topY + 21, 15, 16, LIAM_PAL.linkGreenMid, "linkGreen");
    g.rect(cx - 8, topY + 33, 17, 4, LIAM_PAL.linkGreenMid, "linkGreen"); // Flared tunic skirt!
    g.rect(cx - 5, topY + 22, 11, 10, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 3, topY + 23, 7, 4, LIAM_PAL.linkGreenSpec, "linkGreen");
    g.rect(cx - 7, topY + 22, 2, 14, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx + 6, topY + 22, 2, 14, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 8, topY + 36, 17, 1, LIAM_PAL.linkGreenDeep, "linkGreen");
    // Cream undershirt V-collar
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.linkCreamHi, "jersey");
    g.rect(cx - 2, topY + 23, 5, 2, LIAM_PAL.linkCreamMid, "jersey");
    // Diagonal brown leather sword baldric strap + wide leather belt with gleaming golden buckle!
    g.line(cx + 5, topY + 22, cx - 5, topY + 32, LIAM_PAL.linkLeatherMid, "linkLeather");
    g.line(cx + 4, topY + 22, cx - 6, topY + 32, LIAM_PAL.linkLeatherHi, "linkLeather");
    g.rect(cx - 7, topY + 31, 15, 3, LIAM_PAL.linkLeatherMid, "linkLeather");
    g.rect(cx - 6, topY + 31, 13, 1, LIAM_PAL.linkLeatherHi, "linkLeather");
    g.rect(cx - 7, topY + 33, 15, 1, LIAM_PAL.linkLeatherDeep, "linkLeather");
    g.rect(cx - 2, topY + 31, 5, 3, LIAM_PAL.linkGold, "linkLeather"); // Golden belt buckle!
    g.rect(cx - 1, topY + 31, 3, 1, LIAM_PAL.linkGoldHi, "linkLeather");
    g.set(cx, topY + 32, LIAM_PAL.linkLeatherDeep, "linkLeather");

    if (isBack) {
      // Iconic Blue & Silver HYLIAN SHIELD with Golden Triforce + MASTER SWORD Hilt strapped on Link's back!
      // Master Sword hilt rising over right shoulder
      g.rect(cx + 4, topY + 14, 3, 7, LIAM_PAL.swordHilt, "linkShield");
      g.rect(cx + 5, topY + 13, 2, 2, LIAM_PAL.linkGoldHi, "linkShield");
      g.rect(cx + 2, topY + 18, 7, 2, LIAM_PAL.swordHiltHi, "linkShield");
      // Sculpted Hylian Shield body centered on back
      g.rect(cx - 6, topY + 22, 13, 11, LIAM_PAL.shieldSilver, "linkShield");
      g.rect(cx - 5, topY + 33, 11, 2, LIAM_PAL.shieldSilverShade, "linkShield");
      g.rect(cx - 3, topY + 35, 7, 2, LIAM_PAL.shieldSilverShade, "linkShield");
      g.rect(cx - 1, topY + 37, 3, 1, LIAM_PAL.shieldSilverShade, "linkShield");
      g.rect(cx - 5, topY + 23, 11, 10, LIAM_PAL.shieldBlue, "linkShield");
      g.rect(cx - 4, topY + 24, 9, 4, LIAM_PAL.shieldBlueHi, "linkShield");
      g.rect(cx - 3, topY + 33, 7, 2, LIAM_PAL.shieldBlueDark, "linkShield");
      // Golden Triforce crest (3 golden triangles!) + Crimson Hylian bird emblem!
      g.rect(cx - 1, topY + 24, 3, 2, LIAM_PAL.linkGoldHi, "linkShield");
      g.rect(cx - 3, topY + 26, 3, 2, LIAM_PAL.linkGold, "linkShield");
      g.rect(cx + 1, topY + 26, 3, 2, LIAM_PAL.linkGold, "linkShield");
      g.rect(cx - 3, topY + 29, 7, 2, LIAM_PAL.shieldRed, "linkShield");
      g.rect(cx - 1, topY + 31, 3, 2, LIAM_PAL.shieldRed, "linkShield");
    }
  } else if (isWet) {
    g.rect(cx - 7, topY + 21, 15, 13, LIAM_PAL.wetMid, "wetsuit");
    g.rect(cx - 5, topY + 22, 11, 10, LIAM_PAL.wetHi, "wetsuit");
    g.rect(cx - 7, topY + 22, 3, 11, LIAM_PAL.tealMid, "wetsuit");
    g.rect(cx - 6, topY + 23, 1, 9, LIAM_PAL.tealHi, "wetsuit");
    g.rect(cx + 5, topY + 22, 3, 11, LIAM_PAL.tealMid, "wetsuit");
    g.rect(cx + 6, topY + 23, 1, 9, LIAM_PAL.tealHi, "wetsuit");
    g.rect(cx - 5, topY + 21, 11, 2, LIAM_PAL.wetDeep, "wetsuit");
    g.rect(cx - 4, topY + 21, 9, 1, LIAM_PAL.tealMid, "wetsuit");
    if (!isBack) {
      g.rect(cx - 4, topY + 24, 9, 2, LIAM_PAL.tealMid, "wetsuit");
      g.rect(cx - 3, topY + 24, 7, 1, LIAM_PAL.tealHi, "wetsuit");
      g.line(cx, topY + 22, cx, topY + 31, LIAM_PAL.wetDeep, "wetsuit");
      g.set(cx, topY + 23, LIAM_PAL.zipGold, "wetsuit");
      g.set(cx, topY + 24, LIAM_PAL.zipGold, "wetsuit");
    } else {
      g.line(cx, topY + 22, cx, topY + 32, LIAM_PAL.wetDeep, "wetsuit");
      g.rect(cx, topY + 22, 1, 4, LIAM_PAL.zipGold, "wetsuit");
    }
    g.rect(cx - 7, topY + 32, 15, 2, LIAM_PAL.wetShade, "wetsuit");
  } else if (isSoccerKit) {
    // Royal-blue & white vertical-striped Team Soccer Jersey (Israel / World Soccer Kit!)
    g.rect(cx - 7, topY + 21, 15, 13, "#ffffff", "jersey");
    g.rect(cx - 6, topY + 22, 3, 11, "#245ca8", "kippah");
    g.rect(cx - 1, topY + 22, 3, 11, "#245ca8", "kippah");
    g.rect(cx + 4, topY + 22, 3, 11, "#245ca8", "kippah");
    g.rect(cx - 5, topY + 21, 11, 2, "#1c4382", "kippah");
    g.rect(cx - 4, topY + 21, 9, 1, "#5ca0f0", "kippah");
    if (!isBack) {
      // Tiny golden team crest on chest!
      g.rect(cx - 5, topY + 24, 2, 2, "#f4d35e", "orange");
    } else {
      // Crisp jersey #10 on back!
      g.rect(cx - 3, topY + 24, 2, 6, "#f4d35e", "orange");
      g.rect(cx + 1, topY + 24, 3, 6, "#f4d35e", "orange");
      g.rect(cx + 2, topY + 25, 1, 4, "#245ca8", "kippah");
    }
    g.rect(cx - 7, topY + 32, 15, 2, "#1c3f7a", "pants");
  } else if (isBB) {
    g.rect(cx - 7, topY + 21, 15, 13, LIAM_PAL.jerseyMid, "jersey");
    g.rect(cx - 5, topY + 22, 11, 10, LIAM_PAL.jerseyHi, "jersey");
    for (const sx of [cx - 4, cx + 4]) {
      g.line(sx, topY + 22, sx, topY + 32, LIAM_PAL.jerseyStripe, "jersey");
    }
    g.rect(cx - 7, topY + 21, 3, 5, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 6, topY + 21, 2, 3, LIAM_PAL.orangeHi, "orange");
    g.rect(cx + 5, topY + 21, 3, 5, LIAM_PAL.orangeMid, "orange");
    g.rect(cx + 5, topY + 21, 2, 3, LIAM_PAL.orangeHi, "orange");
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.capMid, "cap");
    g.rect(cx - 3, topY + 21, 7, 1, LIAM_PAL.orangeMid, "orange");

    if (!isBack) {
      g.line(cx, topY + 22, cx, topY + 32, LIAM_PAL.capMid, "cap");
      g.set(cx, topY + 24, LIAM_PAL.white, "jersey");
      g.set(cx, topY + 27, LIAM_PAL.white, "jersey");
      g.set(cx, topY + 30, LIAM_PAL.white, "jersey");
      g.rect(cx - 4, topY + 24, 3, 2, LIAM_PAL.orangeMid, "orange");
      g.set(cx - 3, topY + 24, LIAM_PAL.orangeHi, "orange");
    } else {
      g.rect(cx - 2, topY + 24, 6, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx + 2, topY + 26, 2, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx + 1, topY + 28, 2, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx, topY + 30, 2, 2, LIAM_PAL.capMid, "cap");
      g.rect(cx - 2, topY + 24, 5, 1, LIAM_PAL.orangeMid, "orange");
    }
    g.rect(cx - 7, topY + 32, 15, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 6, topY + 32, 13, 1, LIAM_PAL.orangeHi, "orange");
    g.rect(cx - 1, topY + 32, 3, 2, LIAM_PAL.capMid, "cap");
    g.set(cx, topY + 32, LIAM_PAL.white, "jersey");
  } else {
    g.rect(cx - 7, topY + 21, 15, 13, LIAM_PAL.poloMid, "polo");
    g.rect(cx - 5, topY + 22, 11, 9, LIAM_PAL.poloHi, "polo");
    g.rect(cx - 3, topY + 23, 7, 4, LIAM_PAL.poloSpec, "polo");
    g.rect(cx - 7, topY + 22, 2, 11, LIAM_PAL.poloShade, "polo");
    g.rect(cx + 6, topY + 22, 2, 11, LIAM_PAL.poloShade, "polo");
    g.rect(cx - 7, topY + 32, 15, 2, LIAM_PAL.poloDeep, "polo");

    if (!isBack) {
      g.rect(cx - 5, topY + 21, 11, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx - 4, topY + 22, 3, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx + 2, topY + 22, 3, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx - 4, topY + 24, 3, 1, LIAM_PAL.collarShade, "polo");
      g.rect(cx + 2, topY + 24, 3, 1, LIAM_PAL.collarShade, "polo");
      g.rect(cx - 1, topY + 22, 3, 6, LIAM_PAL.poloDeep, "polo");
      g.set(cx, topY + 22, skinPal.shade, "skin");
      g.set(cx, topY + 24, LIAM_PAL.white, "polo");
      g.set(cx, topY + 26, LIAM_PAL.white, "polo");
    } else {
      g.rect(cx - 5, topY + 21, 11, 2, LIAM_PAL.collarHi, "polo");
      g.rect(cx - 5, topY + 23, 11, 1, LIAM_PAL.collarShade, "polo");
    }
  }

  // 4. Crisp multi-strand hanging white Tzitzit peeking cleanly at BOTH hips (when enabled in Hero Profile)!
  if (!isWet && !isLink && profile.tzitzit) {
    draw32BitTzitzit(g, cx - 7, topY + 34, tzSway, false);
    draw32BitTzitzit(g, cx + 6, topY + 34, tzSway, false);
  }
}

function draw32BitTorsoAndLegsRight(g, cx, topY, stepFrame, outfit, onScooter, opts = {}) {
  const profile = resolveHeroProfile(opts.heroProfile);
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;
  const isSoccerKit = outfit === "baseball" && Boolean(opts.soccerKit);
  const isBB = outfit === "baseball" && !isSoccerKit;
  const isWet = outfit === "wetsuit";
  const isLink = outfit === "link";
  const pHi = isLink ? LIAM_PAL.linkCreamHi : isWet ? LIAM_PAL.wetHi : isSoccerKit ? "#2d5ca6" : isBB ? LIAM_PAL.bbPantsHi : LIAM_PAL.pantsHi;
  const pMid = isLink ? LIAM_PAL.linkCreamMid : isWet ? LIAM_PAL.wetMid : isSoccerKit ? "#1c3f7a" : isBB ? LIAM_PAL.bbPantsMid : LIAM_PAL.pantsMid;
  const pSh = isLink ? LIAM_PAL.linkCreamShade : isWet ? LIAM_PAL.wetShade : isSoccerKit ? "#132c57" : isBB ? LIAM_PAL.bbPantsShade : LIAM_PAL.pantsShade;
  const pMat = isLink ? "jersey" : isWet ? "wetsuit" : isBB ? "jersey" : "pants";

  const slHi = isLink ? LIAM_PAL.linkGreenHi : isWet ? LIAM_PAL.tealHi : isSoccerKit ? "#ffffff" : isBB ? LIAM_PAL.orangeHi : LIAM_PAL.poloHi;
  const slMid = isLink ? LIAM_PAL.linkGreenMid : isWet ? LIAM_PAL.wetMid : isSoccerKit ? "#dce8f8" : isBB ? LIAM_PAL.orangeMid : LIAM_PAL.poloMid;
  const slSh = isLink ? LIAM_PAL.linkGreenShade : isWet ? LIAM_PAL.tealShade : isSoccerKit ? "#245ca8" : isBB ? LIAM_PAL.orangeShade : LIAM_PAL.poloShade;
  const slMat = isLink ? "linkGreen" : isWet ? "wetsuit" : isSoccerKit ? "jersey" : isBB ? "orange" : "polo";

  // 1. Dynamic 32-bit striding legs in side profile!
  const stride = onScooter ? 0 : stepFrame === 1 ? 1 : stepFrame === 2 ? -1 : 0;
  const backLegX = cx - 3 - stride * 4;
  const frontLegX = cx - 2 + stride * 4;

  // Back leg
  if (isSoccerKit) {
    g.rect(backLegX, topY + 34, 5, 4, pSh, "pants");
    g.rect(backLegX, topY + 38, 5, 3, skinPal.shade, "skin");
    g.rect(backLegX, topY + 41, 5, 3, "#e0e8f5", "jersey");
  } else {
    g.rect(backLegX, topY + 34, 5, 10, pSh, pMat);
    if (isBB) g.rect(backLegX, topY + 41, 5, 2, LIAM_PAL.orangeShade, "orange");
  }
  draw32BitSneaker(g, backLegX - 1, topY + 44, "right", outfit, stride !== 0 && stride < 0);

  // Front leg
  if (isSoccerKit) {
    g.rect(frontLegX, topY + 33, 6, 5, pMid, "pants");
    g.rect(frontLegX + 2, topY + 34, 3, 3, pHi, "pants");
    g.rect(frontLegX, topY + 38, 6, 3, skinPal.mid, "skin");
    g.rect(frontLegX, topY + 41, 6, 3, "#ffffff", "jersey");
    g.rect(frontLegX, topY + 41, 6, 1, "#245ca8", "kippah");
  } else {
    g.rect(frontLegX, topY + 33, 6, 11, pMid, pMat);
    g.rect(frontLegX + 2, topY + 34, 3, 8, pHi, pMat);
    if (isWet) {
      g.rect(frontLegX + 1, topY + 34, 2, 9, LIAM_PAL.tealMid, "wetsuit");
      g.rect(frontLegX + 1, topY + 35, 1, 7, LIAM_PAL.tealHi, "wetsuit");
    } else if (isBB) {
      g.rect(frontLegX, topY + 41, 6, 2, LIAM_PAL.orangeMid, "orange");
      g.rect(frontLegX + 1, topY + 41, 4, 1, LIAM_PAL.orangeHi, "orange");
    }
  }
  draw32BitSneaker(g, frontLegX, topY + 44, "right", outfit, stride !== 0 && stride > 0);

  // 2. Side-profile Torso (Link Tunic + Back Shield/Sword OR Wetsuit OR Soccer Kit OR Jersey OR Polo)
  if (isLink) {
    g.rect(cx - 10, topY + 21, 4, 13, LIAM_PAL.shieldSilver, "linkShield");
    g.rect(cx - 9, topY + 22, 3, 11, LIAM_PAL.shieldBlue, "linkShield");
    g.rect(cx - 9, topY + 25, 2, 3, LIAM_PAL.linkGold, "linkShield");
    g.rect(cx - 9, topY + 15, 3, 6, LIAM_PAL.swordHilt, "linkShield");
    g.rect(cx - 10, topY + 14, 2, 2, LIAM_PAL.linkGoldHi, "linkShield");
    g.rect(cx - 6, topY + 21, 13, 16, LIAM_PAL.linkGreenMid, "linkGreen");
    g.rect(cx - 7, topY + 33, 15, 4, LIAM_PAL.linkGreenMid, "linkGreen");
    g.rect(cx - 3, topY + 22, 9, 9, LIAM_PAL.linkGreenHi, "linkGreen");
    g.rect(cx - 6, topY + 22, 3, 13, LIAM_PAL.linkGreenShade, "linkGreen");
    g.rect(cx - 4, topY + 21, 8, 2, LIAM_PAL.linkCreamHi, "jersey");
    g.rect(cx - 6, topY + 31, 13, 3, LIAM_PAL.linkLeatherMid, "linkLeather");
    g.rect(cx - 4, topY + 31, 10, 1, LIAM_PAL.linkLeatherHi, "linkLeather");
    g.rect(cx + 3, topY + 31, 3, 3, LIAM_PAL.linkGold, "linkLeather");
  } else if (isWet) {
    g.rect(cx - 6, topY + 21, 13, 13, LIAM_PAL.wetMid, "wetsuit");
    g.rect(cx - 3, topY + 22, 9, 9, LIAM_PAL.wetHi, "wetsuit");
    g.rect(cx - 2, topY + 22, 4, 11, LIAM_PAL.tealMid, "wetsuit");
    g.rect(cx - 1, topY + 23, 2, 9, LIAM_PAL.tealHi, "wetsuit");
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.wetDeep, "wetsuit");
    g.rect(cx - 6, topY + 32, 13, 2, LIAM_PAL.wetDeep, "wetsuit");
  } else if (isSoccerKit) {
    g.rect(cx - 6, topY + 21, 13, 13, "#ffffff", "jersey");
    g.rect(cx - 5, topY + 22, 3, 11, "#245ca8", "kippah");
    g.rect(cx + 1, topY + 22, 3, 11, "#245ca8", "kippah");
    g.rect(cx - 4, topY + 21, 9, 2, "#1c4382", "kippah");
    g.rect(cx - 6, topY + 32, 13, 2, "#1c3f7a", "pants");
  } else if (isBB) {
    g.rect(cx - 6, topY + 21, 13, 13, LIAM_PAL.jerseyMid, "jersey");
    g.rect(cx - 3, topY + 22, 9, 10, LIAM_PAL.jerseyHi, "jersey");
    g.rect(cx - 6, topY + 22, 3, 10, LIAM_PAL.jerseyShade, "jersey");
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 6, topY + 32, 13, 2, LIAM_PAL.orangeMid, "orange");
    g.rect(cx - 4, topY + 32, 10, 1, LIAM_PAL.orangeHi, "orange");
  } else {
    g.rect(cx - 6, topY + 21, 13, 13, LIAM_PAL.poloMid, "polo");
    g.rect(cx - 3, topY + 22, 9, 9, LIAM_PAL.poloHi, "polo");
    g.rect(cx, topY + 23, 5, 5, LIAM_PAL.poloSpec, "polo");
    g.rect(cx - 6, topY + 22, 3, 11, LIAM_PAL.poloShade, "polo");
    g.rect(cx - 6, topY + 32, 13, 2, LIAM_PAL.poloDeep, "polo");
    g.rect(cx - 4, topY + 21, 9, 2, LIAM_PAL.collarHi, "polo");
    g.rect(cx - 3, topY + 23, 8, 1, LIAM_PAL.collarShade, "polo");
  }

  // 3. White Tzitzit hanging neatly at the side hip & swaying on stride!
  if (!isWet && !isLink && profile.tzitzit) {
    draw32BitTzitzit(g, cx - 2, topY + 34, stride === 0 ? 0 : -1, true);
  }

  // 4. Foreground swinging arm (reaches forward on scooter or stride!)
  const armX = onScooter ? cx + 3 : cx - 2 + stride * 3;
  const armY = onScooter ? topY + 24 : topY + 23;
  g.rect(armX - 1, armY, 5, 6, slMid, slMat);
  g.rect(armX, armY + 1, 3, 4, slHi, slMat);
  g.rect(armX - 1, armY + 5, 5, 1, isBB ? LIAM_PAL.capMid : slSh, slMat);
  if (onScooter) {
    g.rect(armX + 3, armY + 2, 6, 3, skinPal.mid, "skin");
    g.rect(armX + 4, armY + 2, 4, 2, skinPal.hi, "skin");
  } else if (isLink) {
    g.rect(armX, armY + 6, 4, 2, LIAM_PAL.linkCreamMid, "jersey");
    g.rect(armX, armY + 8, 4, 2, LIAM_PAL.linkLeatherMid, "linkLeather");
    g.rect(armX, armY + 10, 3, 2, skinPal.mid, "skin");
  } else {
    g.rect(armX, armY + 6, 4, 5, skinPal.mid, "skin");
    g.rect(armX + 1, armY + 6, 2, 3, skinPal.hi, "skin");
    g.rect(armX, armY + 10, 3, 1, skinPal.shade, "skin");
  }
}

function draw32BitScooter(g, facing, outfit) {
  const deckHi = outfit === "link" ? LIAM_PAL.linkGoldHi : outfit === "baseball" ? LIAM_PAL.orangeHi : "#7ff7f0";
  const deckMid = outfit === "link" ? LIAM_PAL.linkGreenMid : outfit === "baseball" ? LIAM_PAL.orangeMid : "#39cfc8";
  const deckSh = outfit === "link" ? LIAM_PAL.linkGreenDeep : outfit === "baseball" ? LIAM_PAL.orangeShade : "#22918c";
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
export function bakeSmb3HeroSprite(facing, stepFrame, onScooter, outfit = "polo", opts = {}) {
  const g = new PixelGrid(48, 56);
  const cx = 24;
  const bobY = !onScooter && stepFrame !== 0 ? -1 : 0;
  const renderFacing = facing === "left" ? "right" : facing;
  const profile = resolveHeroProfile(opts.heroProfile);
  const hairPal = HERO_HAIR_COLORS[profile.hairColor] || HERO_HAIR_COLORS.light_brown;
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;

  if (onScooter) {
    draw32BitScooter(g, renderFacing, outfit);
  }

  if (renderFacing === "down" || renderFacing === "up") {
    draw32BitTorsoAndLegsFrontOrBack(g, cx, 2 + bobY, renderFacing, stepFrame, outfit, onScooter, opts);
    if (renderFacing === "down") {
      draw32BitHeadFront(g, cx, 2 + bobY, outfit, false, opts);
    } else {
      draw32BitHeadBack(g, cx, 2 + bobY, outfit, opts);
    }
  } else {
    draw32BitTorsoAndLegsRight(g, cx, 2 + bobY, stepFrame, outfit, onScooter, opts);
    draw32BitHeadRight(g, cx, 2 + bobY, outfit, opts);
  }

  g.applySelOut({ ...LIAM_SELOUT, hair: hairPal.out, skin: skinPal.out });
  const finalGrid = facing === "left" ? g.flipHorizontal() : g;
  return finalGrid.toCanvas(0.5, { cx: 24, cy: 52, rx: 11, ry: 3.2 });
}

/**
 * Bake hero's 48x56 32-bit celebratory 2-handed overhead Item Fanfare pose!
 */
export function bakeSmb3HeroFanfareSprite(outfit = "polo", opts = {}) {
  const g = new PixelGrid(48, 56);
  const cx = 24;
  const topY = 3;
  const profile = resolveHeroProfile(opts.heroProfile);
  const hairPal = HERO_HAIR_COLORS[profile.hairColor] || HERO_HAIR_COLORS.light_brown;
  const skinPal = HERO_SKIN_TONES[profile.skinTone] || HERO_SKIN_TONES.warm;
  const isSoccerKit = outfit === "baseball" && Boolean(opts.soccerKit);
  const isBB = outfit === "baseball" && !isSoccerKit;
  const isWet = outfit === "wetsuit";
  const isLink = outfit === "link";
  const slHi = isLink ? LIAM_PAL.linkGreenHi : isWet ? LIAM_PAL.tealHi : isSoccerKit ? "#ffffff" : isBB ? LIAM_PAL.orangeHi : LIAM_PAL.poloHi;
  const slMid = isLink ? LIAM_PAL.linkGreenMid : isWet ? LIAM_PAL.wetMid : isSoccerKit ? "#dce8f8" : isBB ? LIAM_PAL.orangeMid : LIAM_PAL.poloMid;
  const slMat = isLink ? "linkGreen" : isWet ? "wetsuit" : isSoccerKit ? "jersey" : isBB ? "orange" : "polo";

  draw32BitTorsoAndLegsFrontOrBack(g, cx, topY, "down", 0, outfit, false, opts);

  for (let y = topY + 21; y <= topY + 34; y++) {
    for (let x = cx - 11; x <= cx - 8; x++) g.clear(x, y);
    for (let x = cx + 8; x <= cx + 11; x++) g.clear(x, y);
  }
  for (const side of [-1, 1]) {
    const ax = side < 0 ? cx - 12 : cx + 9;
    g.rect(ax, topY + 17, 4, 7, slMid, slMat);
    g.rect(ax + 1, topY + 18, 2, 5, slHi, slMat);
    g.rect(ax, topY + 9, 4, 8, skinPal.mid, "skin");
    g.rect(ax + 1, topY + 10, 2, 6, skinPal.hi, "skin");
    g.rect(ax - (side < 0 ? 1 : 0), topY + 6, 5, 4, skinPal.hi, "skin");
    g.rect(ax, topY + 9, 4, 1, skinPal.shade, "skin");
  }

  draw32BitHeadFront(g, cx, topY, outfit, true, opts);
  g.applySelOut({ ...LIAM_SELOUT, hair: hairPal.out, skin: skinPal.out });
  return g.toCanvas(0.5, { cx: 24, cy: 52, rx: 11, ry: 3.2 });
}

// =============================================================================
// 32-BIT NEIGHBORHOOD NPCs (44x52 NATIVE PIXELS -> 22x26 LOGICAL UNITS!)
// =============================================================================

export function bakeSmb3NpcSprite(theme, frame = 0) {
  const g = new PixelGrid(44, 52);
  const cx = 22;
  const isWave = frame === 1;
  const topY = isWave ? 2 : 3;

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

  // Arms (right arm raises cheerfully to wave/gesture on frame 1!)
  {
    const axL = cx - 10;
    g.rect(axL, topY + 21, 4, 8, shirtMid, "polo");
    g.rect(axL + 1, topY + 22, 2, 6, shirtHi, "polo");
    g.rect(axL, topY + 29, 3, 4, LIAM_PAL.skinMid, "skin");
    g.rect(axL + 1, topY + 29, 1, 3, LIAM_PAL.skinHi, "skin");

    const axR = cx + 7;
    if (isWave) {
      g.rect(axR, topY + 17, 5, 6, shirtMid, "polo");
      g.rect(axR + 1, topY + 18, 3, 4, shirtHi, "polo");
      g.rect(axR + 3, topY + 10, 4, 8, LIAM_PAL.skinMid, "skin");
      g.rect(axR + 4, topY + 11, 2, 6, LIAM_PAL.skinHi, "skin");
      g.rect(axR + 3, topY + 8, 5, 4, LIAM_PAL.skinHi, "skin");
      g.set(axR + 7, topY + 9, LIAM_PAL.skinShade, "skin");
    } else {
      g.rect(axR, topY + 21, 4, 8, shirtMid, "polo");
      g.rect(axR + 1, topY + 22, 2, 6, shirtHi, "polo");
      g.rect(axR, topY + 29, 3, 4, LIAM_PAL.skinMid, "skin");
      g.rect(axR + 1, topY + 29, 1, 3, LIAM_PAL.skinHi, "skin");
    }
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

  // Expressive 32-bit eyes & friendly smile (open talking/greeting grin on wave frame!)
  for (const side of [-1, 1]) {
    const ex = side < 0 ? cx - 5 : cx + 3;
    const ey = topY + 12;
    g.rect(ex, ey, 3, 3, LIAM_PAL.eyeLash, "skin");
    g.set(ex, ey, LIAM_PAL.white, "skin");
    g.set(ex + 1, ey + 2, LIAM_PAL.eyeIris, "skin");
  }
  g.rect(cx - 6, topY + 15, 2, 1, LIAM_PAL.cheek, "skin");
  g.rect(cx + 5, topY + 15, 2, 1, LIAM_PAL.cheek, "skin");
  if (isWave) {
    g.rect(cx - 2, topY + 15, 5, 2, LIAM_PAL.mouthDark, "skin");
    g.rect(cx - 1, topY + 15, 3, 1, LIAM_PAL.white, "skin");
    g.rect(cx - 1, topY + 16, 3, 1, LIAM_PAL.mouth, "skin");
  } else {
    g.rect(cx - 1, topY + 16, 3, 1, LIAM_PAL.mouth, "skin");
  }

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
 * Bake 32-bit Pure Pixel Wild Newton Squirrel (fluffy S-curved bushy tail, scampering paws!).
 */
function bake32BitSquirrelRight(stepFrame = 0, alert = false) {
  const w = 34;
  const h = 32;
  const g = new PixelGrid(w, h);
  const cx = 18;
  const hop = stepFrame === 1 ? -2 : alert ? -1 : 0;

  // 1. Huge fluffy curled-up bushy squirrel tail behind body!
  const tailLift = alert ? -2 : stepFrame === 1 ? -1 : 0;
  g.ellipse(cx - 8, 17 + tailLift, 5.5, 8.2, "#6e4e38", "tail");
  g.ellipse(cx - 9, 14 + tailLift, 4.8, 6.2, "#9c7454", "tail");
  g.ellipse(cx - 10, 11 + tailLift, 4.2, 4.0, "#bfa07e", "tail");
  g.ellipse(cx - 9, 10 + tailLift, 2.4, 2.2, "#e0c8a8", "tail");
  g.rect(cx - 8, 20 + tailLift, 4, 4, "#593d2b", "tail");

  // 2. Quick scampering feet & legs
  const backX = stepFrame === 1 ? cx - 6 : cx - 4;
  const frontX = stepFrame === 1 ? cx + 6 : cx + 3;
  g.rect(backX, 24, 4, 3, "#6e4e38", "feet");
  g.rect(backX + 1, 26, 4, 2, "#8f694d", "feet");
  g.rect(frontX, 24 + (alert ? -2 : 0), 3, 3, "#8f694d", "feet");
  g.rect(frontX + 1, 26 + (alert ? -2 : 0), 3, 2, "#b58b68", "feet");

  // 3. Plump russet-gray squirrel body & cream belly
  g.ellipse(cx, 20 + hop, 6.8, 4.8, "#7d5b42", "body");
  g.ellipse(cx + 1, 18.5 + hop, 5.2, 3.2, "#a8805e", "body");
  g.ellipse(cx + 2, 22 + hop, 4.2, 2.2, "#f0dfc4", "belly");

  // 4. Cute head, perked round ears, bright shiny dark eye, pink nose & tiny teeth!
  const hx = cx + 6;
  const hy = (alert ? 12 : 14) + hop;
  g.ellipse(hx, hy, 4.2, 3.8, "#8c6648", "head");
  g.ellipse(hx + 1, hy - 1, 2.8, 2.2, "#b58b68", "head");
  // Perked round ears
  g.rect(hx - 2, hy - 5, 3, 3, "#7d5b42", "head");
  g.set(hx - 1, hy - 4, "#e3a698", "head");
  g.rect(hx + 1, hy - 5, 2, 3, "#9c7454", "head");
  // Cheek & bright glossy eye + cute nose
  g.rect(hx + 1, hy + 1, 3, 2, "#f0dfc4", "belly");
  g.rect(hx + 1, hy - 1, 2, 2, "#1a1312", "head");
  g.set(hx + 1, hy - 1, "#ffffff", "head");
  g.set(hx + 4, hy, "#38221e", "head");
  if (alert) {
    // Holding a tiny lucky acorn or chattering paws up!
    g.rect(hx + 2, hy + 3, 3, 3, "#c47d32", "feet");
    g.rect(hx + 2, hy + 2, 3, 1, "#5c3416", "feet");
  }

  g.applySelOut({
    tail: "#2e1e14",
    body: "#2e1e14",
    belly: "#5c4530",
    head: "#2e1e14",
    feet: "#2e1e14",
  });
  return g.toCanvas(0.5, { cx: cx - 1, cy: 27, rx: 8.5, ry: 2.5 });
}

/**
 * Bake 32-bit Pure Pixel Prowling Neighborhood Cat (variant 0 = orange tabby, 1 = tuxedo!).
 */
function bake32BitCatRight(variant = 0, stepFrame = 0, alert = false) {
  const w = 42;
  const h = 36;
  const g = new PixelGrid(w, h);
  const cx = 21;
  const isTux = variant % 2 === 1;
  const furDark = isTux ? "#1c1f29" : "#b8551c";
  const furMid = isTux ? "#2d3242" : "#e37a2b";
  const furHi = isTux ? "#4b5268" : "#ffaa4f";
  const stripe = isTux ? "#14161f" : "#8f3810";
  const accent = isTux ? "#f5f7fa" : "#fff0d1";
  const eyeCol = isTux ? "#78e058" : "#52c468";
  const bob = stepFrame === 1 ? -1 : 0;

  // 1. Long expressive swishing cat tail (puffed straight up when alert!)
  if (alert) {
    g.rect(cx - 12, 8, 4, 14, furDark, "tail");
    g.rect(cx - 11, 9, 2, 12, furMid, "tail");
    g.rect(cx - 11, 7, 3, 3, accent, "tail");
  } else {
    const swish = stepFrame === 1 ? -2 : 1;
    g.line(cx - 9, 20 + bob, cx - 14, 14 + swish, furDark, "tail");
    g.line(cx - 9, 19 + bob, cx - 14, 13 + swish, furMid, "tail");
    g.line(cx - 14, 13 + swish, cx - 16, 10 + swish, furHi, "tail");
    g.rect(cx - 16, 9 + swish, 2, 2, accent, "tail");
  }

  // 2. Nimble stepping cat legs + white mittens!
  const l1 = stepFrame === 1 ? cx - 7 : cx - 5;
  const l2 = stepFrame === 1 ? cx - 3 : cx - 7;
  const f1 = stepFrame === 1 ? cx + 7 : cx + 5;
  const f2 = stepFrame === 1 ? cx + 4 : cx + 8;
  g.rect(l2, 24, 3, 7, furDark, "feet");
  g.rect(l1, 24, 3, 7, furMid, "feet");
  g.rect(f2, 24, 3, 7, furDark, "feet");
  g.rect(f1, 24, 3, 7, furMid, "feet");
  g.rect(l1, 30, 3, 2, accent, "feet");
  g.rect(f1, 30, 3, 2, accent, "feet");

  // 3. Sleek prowling cat body (arched high when alert/hissing!)
  const archY = alert ? -3 : 0;
  g.ellipse(cx, 20 + bob + archY, 9.2, alert ? 6.4 : 5.2, furDark, "body");
  g.ellipse(cx + 1, 19 + bob + archY, 7.6, alert ? 4.8 : 3.8, furMid, "body");
  g.ellipse(cx + 1, 17.5 + bob + archY, 5.5, 2.0, furHi, "body");
  // Tabby stripes or tuxedo chest bib
  if (isTux) {
    g.ellipse(cx + 6, 21 + bob, 3.6, 3.2, accent, "belly");
  } else {
    g.rect(cx - 3, 16 + bob + archY, 2, 5, stripe, "body");
    g.rect(cx + 1, 16 + bob + archY, 2, 5, stripe, "body");
    g.rect(cx + 5, 17 + bob + archY, 2, 4, stripe, "body");
  }

  // 4. Sculpted cat head, pointed triangular ears, bright emerald eyes, pink nose & whiskers!
  const hx = cx + 9;
  const hy = (alert ? 15 : 14) + bob;
  // Pointy ears
  g.rect(hx - 4, hy - 7, 3, 4, furDark, "head");
  g.set(hx - 3, hy - 5, "#f59ca6", "head");
  g.rect(hx + 1, hy - 7, 3, 4, furMid, "head");
  g.set(hx + 2, hy - 5, "#f59ca6", "head");
  // Head
  g.ellipse(hx, hy, 5.2, 4.4, furMid, "head");
  g.ellipse(hx, hy - 1.5, 3.6, 2.2, furHi, "head");
  // Muzzle & pink nose
  g.rect(hx + 1, hy + 1, 4, 2, accent, "head");
  g.set(hx + 4, hy + 1, "#f27e8d", "head");
  // Bright expressive green cat eye + vertical pupil
  g.rect(hx + 1, hy - 2, 3, 2, eyeCol, "head");
  g.set(hx + 2, hy - 2, "#14161a", "head");
  g.set(hx + 1, hy - 2, "#ffffff", "head");
  // Crisp cute pixel whiskers
  g.set(hx + 5, hy, "#ffffff", "head");
  g.set(hx + 6, hy + 1, "#ffffff", "head");

  g.applySelOut({
    tail: "#1a1418",
    body: "#1a1418",
    belly: "#545866",
    head: "#1a1418",
    feet: "#1a1418",
  });
  return g.toCanvas(0.5, { cx: cx + 1, cy: 31, rx: 10.5, ry: 2.8 });
}

/**
 * Bake 32-bit Pure Pixel Runaway Neighborhood Dog with a colorful LEASH TRAILING BEHIND IT!
 * Wide 58x38 canvas gives plenty of room for the waving collar leash & handle loop dragging behind!
 */
function bake32BitDogRight(variant = 0, stepFrame = 0, alert = false) {
  const w = 58;
  const h = 38;
  const g = new PixelGrid(w, h);
  const cx = 34; // Dog sits on right side so leash trails cleanly behind to the left!
  const isSpotted = variant % 2 === 1;
  const furDark = isSpotted ? "#7a583c" : "#a86828";
  const furMid = isSpotted ? "#e6d8c2" : "#dba04b";
  const furHi = isSpotted ? "#fff8ed" : "#f7ca72";
  const earCol = isSpotted ? "#4f3422" : "#8f511c";
  const collarCol = isSpotted ? "#1ea8b8" : "#d9322c";
  const collarHi = isSpotted ? "#76e8f2" : "#ff6b61";
  const bob = stepFrame === 1 ? -2 : alert ? -1 : 0;

  // 1. UNMISTAKABLE TRAILING LEASH + HANDLE LOOP DRAGGING BEHIND THE DOG'S COLLAR!
  // Connects from collar neck (cx + 7, 20) arcing back behind the dog and dragging along the ground (x = 4..26)!
  const wave = stepFrame === 1 ? -2 : 2;
  // Back strap arcing from collar over shoulder down to the ground behind the dog
  g.line(cx + 6, 19 + bob, cx - 2, 16 + bob, collarCol, "leash");
  g.line(cx - 2, 16 + bob, cx - 11, 24 + Math.round(wave * 0.5), collarCol, "leash");
  g.line(cx - 11, 24 + Math.round(wave * 0.5), cx - 19, 30 + wave, collarCol, "leash");
  g.line(cx - 19, 30 + wave, cx - 26, 31, collarCol, "leash");
  // Bright highlight pixel ribbon along top edge of leash so it pops crisply over autumn lawns & sidewalks!
  g.line(cx - 2, 15 + bob, cx - 11, 23 + Math.round(wave * 0.5), collarHi, "leash");
  g.line(cx - 11, 23 + Math.round(wave * 0.5), cx - 19, 29 + wave, collarHi, "leash");
  // Trailing stitched handle loop at the far tail end of the leash!
  g.rect(cx - 31, 28, 6, 5, collarCol, "leash");
  g.rect(cx - 30, 29, 4, 3, collarHi, "leash");
  g.clear(cx - 29, 30);
  g.clear(cx - 28, 30);

  // 2. Wagging dog tail
  const tailWag = stepFrame === 1 ? -3 : 0;
  g.line(cx - 9, 18 + bob, cx - 14, 12 + bob + tailWag, furDark, "tail");
  g.line(cx - 9, 17 + bob, cx - 13, 11 + bob + tailWag, furMid, "tail");
  g.rect(cx - 14, 10 + bob + tailWag, 3, 3, furHi, "tail");

  // 3. Bounding dog legs (wide stride on frame 1!)
  const b1 = stepFrame === 1 ? cx - 10 : cx - 6;
  const b2 = stepFrame === 1 ? cx - 6 : cx - 9;
  const f1 = stepFrame === 1 ? cx + 9 : cx + 5;
  const f2 = stepFrame === 1 ? cx + 5 : cx + 9;
  g.rect(b2, 24, 3, 8, furDark, "feet");
  g.rect(b1, 24, 3, 8, furMid, "feet");
  g.rect(f2, 24, 3, 8, furDark, "feet");
  g.rect(f1, 24, 3, 8, furMid, "feet");
  g.rect(b1, 31, 4, 2, furHi, "feet");
  g.rect(f1, 31, 4, 2, furHi, "feet");

  // 4. Sturdy playful dog torso (with cute spots on variant 1!)
  g.ellipse(cx, 20 + bob, 10.2, 6.2, furDark, "body");
  g.ellipse(cx + 1, 19 + bob, 8.8, 4.8, furMid, "body");
  g.ellipse(cx + 1, 17.5 + bob, 6.5, 2.5, furHi, "body");
  if (isSpotted) {
    g.ellipse(cx - 3, 19 + bob, 3.0, 2.4, "#5c3b24", "body");
    g.ellipse(cx + 3, 21 + bob, 2.2, 1.8, "#5c3b24", "body");
  }

  // 5. Bright collar + shiny brass ID tag!
  g.rect(cx + 6, 17 + bob, 4, 6, collarCol, "leash");
  g.rect(cx + 7, 18 + bob, 2, 4, collarHi, "leash");
  g.rect(cx + 9, 22 + bob, 2, 2, "#ffd952", "leash");

  // 6. Expressive dog head, floppy ear, snout, wet black nose & happy pink tongue!
  const hx = cx + 11;
  const hy = (alert ? 12 : 13) + bob;
  g.ellipse(hx, hy, 5.6, 5.0, furMid, "head");
  g.ellipse(hx, hy - 1.5, 4.0, 2.6, furHi, "head");
  // Prominent dog snout
  g.rect(hx + 3, hy - 1, 6, 4, furMid, "head");
  g.rect(hx + 4, hy - 1, 4, 2, furHi, "head");
  g.rect(hx + 8, hy - 1, 2, 2, "#1c181a", "head"); // wet nose!
  // Panting pink tongue
  g.rect(hx + 5, hy + 3, 2, alert ? 4 : 3, "#f26b7a", "head");
  // Floppy ear hanging on cheek
  g.ellipse(hx - 3, hy + 1, 2.8, 4.4, earCol, "head");
  // Glossy brown eye
  g.rect(hx + 2, hy - 2, 2, 2, "#1a1312", "head");
  g.set(hx + 2, hy - 2, "#ffffff", "head");

  g.applySelOut({
    leash: "#291214",
    tail: "#261810",
    body: "#261810",
    head: "#261810",
    feet: "#261810",
  });
  return g.toCanvas(0.5, { cx: cx + 1, cy: 32, rx: 12.5, ry: 3.0 });
}

/**
 * Bake 32-bit Pure Pixel Israeli Ring-Necked Green Parakeet (Drara — bright emerald plumage, coral beak & turquoise tail!).
 */
function bake32BitParakeetRight(stepFrame = 0, alert = false) {
  const g = new PixelGrid(38, 32);
  const cx = 20;
  const hop = stepFrame === 1 || alert ? -3 : 0;
  // Long sleek turquoise-emerald tail feathers sweeping down-left
  g.line(cx - 5, 20 + hop, cx - 15, 26 + hop, "#1c8a7a", "tail");
  g.line(cx - 5, 19 + hop, cx - 14, 24 + hop, "#38c99a", "tail");
  // Little hopping talons
  g.rect(cx - 1, 25, 2, 4, "#968572", "feet");
  g.rect(cx + 2, 25, 2, 4, "#7a6b5b", "feet");
  // Vibrant lime-emerald parrot body & flapping wing!
  g.ellipse(cx, 18 + hop, 7.2, 5.2, "#2ea83b", "body");
  g.ellipse(cx + 1, 16.5 + hop, 5.5, 3.5, "#6be052", "body");
  if (alert || stepFrame === 1) {
    // Wing lifted cheerfully!
    g.ellipse(cx - 2, 12 + hop, 6.2, 3.6, "#238a32", "wing");
    g.ellipse(cx - 2, 11 + hop, 4.4, 2.2, "#8df266", "wing");
  } else {
    g.ellipse(cx - 1, 18 + hop, 5.4, 3.0, "#1f7a2d", "wing");
    g.rect(cx - 4, 17 + hop, 6, 1, "#8df266", "wing");
  }
  // Head, black/rose ring-neck collar, bright eye & curved coral-red beak!
  const hx = cx + 6;
  const hy = 12 + hop;
  g.ellipse(hx, hy, 4.5, 4.2, "#4fd448", "head");
  g.ellipse(hx, hy - 1.5, 3.0, 2.0, "#9df576", "head");
  g.rect(hx - 3, hy + 3, 5, 1, "#e84a7f", "beak"); // rose collar ring
  g.rect(hx + 3, hy - 1, 4, 3, "#e63b2e", "beak"); // curved coral beak!
  g.rect(hx + 4, hy - 1, 2, 1, "#ff7d6b", "beak");
  g.set(hx + 6, hy + 2, "#a82019", "beak");
  g.rect(hx + 1, hy - 1, 2, 2, "#1a1414", "head");
  g.set(hx + 1, hy - 1, "#ffffff", "head");

  g.applySelOut({ tail: "#0f3d36", body: "#124219", wing: "#0f3815", head: "#124219", beak: "#661410", feet: "#3d332a" });
  return g.toCanvas(0.5, { cx, cy: 28, rx: 8.5, ry: 2.5 });
}

/**
 * Bake 32-bit Pure Pixel Jerusalem Rock Hyrax (Shafan Sela — plump warm honey-brown fur, cute round ears!).
 */
function bake32BitHyraxRight(stepFrame = 0, alert = false) {
  const g = new PixelGrid(38, 30);
  const cx = 19;
  const hop = stepFrame === 1 ? -1 : alert ? -2 : 0;
  // Stubby quick paws
  g.rect(cx - 7 + (stepFrame ? -1 : 0), 22, 4, 4, "#5c422c", "feet");
  g.rect(cx + 5 + (stepFrame ? 1 : 0), 22, 4, 4, "#6e5036", "feet");
  // Plump rounded honey-brown hyrax body with cream dorsal patch
  g.ellipse(cx - 1, 18 + hop, 9.5, 6.2, "#7d5b3e", "body");
  g.ellipse(cx, 16.5 + hop, 7.6, 4.4, "#a67d56", "body");
  g.ellipse(cx - 1, 15 + hop, 4.5, 2.0, "#d4b48a", "body");
  // Cute blunt snout, round little ears & bright dark eyes
  const hx = cx + 8;
  const hy = (alert ? 13 : 15) + hop;
  g.ellipse(hx, hy, 4.8, 4.4, "#8f6948", "head");
  g.ellipse(hx + 1, hy - 1, 3.0, 2.2, "#ba9168", "head");
  g.rect(hx - 3, hy - 5, 3, 3, "#6e4e34", "head");
  g.set(hx - 2, hy - 4, "#e3b29c", "head");
  g.rect(hx + 1, hy - 1, 2, 2, "#1c1512", "head");
  g.set(hx + 1, hy - 1, "#ffffff", "head");
  g.rect(hx + 4, hy + 1, 2, 2, "#382419", "head");
  g.applySelOut({ body: "#2e1e12", head: "#2e1e12", feet: "#2e1e12" });
  return g.toCanvas(0.5, { cx, cy: 26, rx: 10.5, ry: 2.6 });
}

/**
 * Bake 32-bit Pure Pixel Fox (variant "arctic" = snow-white Arctic Fox; "red" = russet European Red Fox!).
 */
function bake32BitFoxRight(style = "arctic", stepFrame = 0, alert = false) {
  const g = new PixelGrid(46, 36);
  const cx = 24;
  const isArctic = style === "arctic";
  const furDark = isArctic ? "#b8c7d9" : "#a83e18";
  const furMid = isArctic ? "#e8f0f7" : "#db5c24";
  const furHi = isArctic ? "#ffffff" : "#ff8b47";
  const tipCol = isArctic ? "#ffffff" : "#fff8eb";
  const pawCol = isArctic ? "#8fa2ba" : "#241e21";
  const bob = stepFrame === 1 ? -1 : 0;

  // Giant fluffy brushy fox tail!
  g.ellipse(cx - 12, 19 + bob, 7.5, 4.5, furDark, "tail");
  g.ellipse(cx - 11, 18 + bob, 6.2, 3.2, furMid, "tail");
  g.ellipse(cx - 17, 17 + bob, 3.6, 2.8, tipCol, "tail");
  // Agile fox legs
  g.rect(cx - 6 + (stepFrame ? -2 : 0), 23, 3, 8, pawCol, "feet");
  g.rect(cx + 6 + (stepFrame ? 2 : 0), 23, 3, 8, pawCol, "feet");
  // Sleek fox torso & fluffy chest ruff
  g.ellipse(cx, 19 + bob, 9.2, 5.4, furDark, "body");
  g.ellipse(cx + 1, 18 + bob, 7.8, 4.0, furMid, "body");
  g.ellipse(cx + 2, 16.5 + bob, 5.5, 2.2, furHi, "body");
  g.ellipse(cx + 7, 20 + bob, 3.8, 3.2, tipCol, "belly");
  // Pointed fox head, tall triangular ears & narrow snout
  const hx = cx + 10;
  const hy = (alert ? 12 : 14) + bob;
  g.rect(hx - 4, hy - 7, 3, 5, pawCol, "head");
  g.set(hx - 3, hy - 5, furHi, "head");
  g.rect(hx + 1, hy - 7, 3, 5, furMid, "head");
  g.ellipse(hx, hy, 5.2, 4.2, furMid, "head");
  g.ellipse(hx, hy - 1.5, 3.6, 2.0, furHi, "head");
  g.rect(hx + 3, hy, 5, 3, tipCol, "head");
  g.rect(hx + 7, hy, 2, 2, "#1c181a", "head");
  g.rect(hx + 2, hy - 2, 2, 2, isArctic ? "#3a8ee6" : "#d98b1e", "head");
  g.set(hx + 2, hy - 2, "#ffffff", "head");

  g.applySelOut({ tail: "#384252", body: "#38241e", belly: "#667080", head: "#38241e", feet: "#1a1820" });
  return g.toCanvas(0.5, { cx, cy: 31, rx: 11.5, ry: 2.8 });
}

/**
 * Bake 32-bit Pure Pixel Desert Roadrunner (crested head, long cocked tail, rapid-striding legs!).
 */
function bake32BitRoadrunnerRight(stepFrame = 0, alert = false) {
  const g = new PixelGrid(44, 34);
  const cx = 22;
  const bob = stepFrame === 1 ? -1 : 0;
  // Long cocked speckled tail sticking up-left!
  g.line(cx - 5, 19 + bob, cx - 17, 11 + bob, "#5c422c", "tail");
  g.line(cx - 5, 18 + bob, cx - 16, 10 + bob, "#9e7752", "tail");
  g.rect(cx - 18, 9 + bob, 3, 2, "#f5ebda", "tail");
  // Fast-striding long legs!
  const l1 = stepFrame === 1 ? cx - 4 : cx + 2;
  const l2 = stepFrame === 1 ? cx + 5 : cx - 2;
  g.line(cx, 22, l1, 30, "#c49b5e", "feet");
  g.line(cx + 1, 22, l2, 30, "#9e7742", "feet");
  // Streamlined speckled brown-and-cream body
  g.ellipse(cx, 19 + bob, 8.2, 4.4, "#75553b", "body");
  g.ellipse(cx + 1, 18 + bob, 6.4, 2.8, "#b8936a", "body");
  g.ellipse(cx + 2, 21 + bob, 5.2, 1.8, "#f2e5cf", "belly");
  // Sleek neck, tufted head crest & sharp desert beak!
  const hx = cx + 9;
  const hy = (alert ? 10 : 12) + bob;
  g.line(cx + 5, 17 + bob, hx - 1, hy + 2, "#9e7752", "head");
  g.ellipse(hx, hy, 4.2, 3.4, "#8c6644", "head");
  // Perky swept-back head crest!
  g.rect(hx - 5, hy - 5, 5, 3, "#4f3622", "head");
  g.rect(hx - 4, hy - 4, 3, 1, "#cf9d6b", "head");
  g.rect(hx + 3, hy - 1, 6, 2, "#6e5540", "beak");
  g.rect(hx + 1, hy - 1, 2, 2, "#1c1412", "head");
  g.set(hx + 1, hy - 1, "#ffffff", "head");

  g.applySelOut({ tail: "#2e1e12", body: "#2e1e12", belly: "#665542", head: "#2e1e12", beak: "#2e1e12", feet: "#4a3822" });
  return g.toCanvas(0.5, { cx, cy: 30, rx: 9.5, ry: 2.4 });
}

/**
 * Biome-specific peaceful marcher / protestor outfit silhouettes & palettes.
 * Each biome gives neighbors authentic local clothing cuts, headwear, footwear,
 * and accessories (fur-trimmed winter parkas, Mediterranean linen & sun hats,
 * tropical Aloha shirts & shorts, European trench coats & berets, Nordic/Alpine
 * Fair Isle sweaters, desert wide-brim sun hats & bandanas, East Asian streetwear).
 */
export const PROTESTOR_BIOME_STYLES = {
  new_england_autumn: {
    id: "new_england_autumn",
    topStyle: "jacket",
    bottomStyle: "pants",
    shoeStyle: "boots",
    neckStyle: "scarf",
    variants: [
      { skin: ["#f5caa0", "#ffe0bd"], top: "#9c2f3a", topHi: "#c94b56", topDark: "#631b24", bottom: "#2f3d54", bottomHi: "#485d7d", shoe: "#4f2e1c", hair: "#4a2e1e", headType: "beanie", head: "#d9922b", headDark: "#9c6216", accent: "#f0cf6b", accentDark: "#d9a742", signBg: "#f7ebd2", signStripe: "#d93b36" },
      { skin: ["#e3b084", "#f5cba4"], top: "#d4912a", topHi: "#f2b84b", topDark: "#8f5c16", bottom: "#2b394f", bottomHi: "#435675", shoe: "#422618", hair: "#2b211e", headType: "beanie", head: "#2f6e57", headDark: "#1c4536", accent: "#e85d4a", accentDark: "#b33a2b", signBg: "#fff6d6", signStripe: "#24573d" },
      { skin: ["#f5caa0", "#ffe0bd"], top: "#2c737d", topHi: "#489ea8", topDark: "#1a4850", bottom: "#363842", bottomHi: "#505463", shoe: "#593520", hair: "#734224", headType: "beanie", head: "#b83b36", headDark: "#7a221f", accent: "#f0cf6b", accentDark: "#d9a742", signBg: "#f5efe6", signStripe: "#2b528c" },
    ],
  },
  winter_parka: {
    id: "winter_parka",
    topStyle: "parka",
    bottomStyle: "snowpants",
    shoeStyle: "snowboots",
    neckStyle: "scarf",
    mittens: true,
    variants: [
      { skin: ["#f7d4b2", "#ffe6cc"], top: "#2b528c", topHi: "#4d78b8", topDark: "#18325c", bottom: "#1f2a3d", bottomHi: "#324361", shoe: "#382820", hair: "#4a2e1e", headType: "pom_beanie", head: "#d93b36", headDark: "#8c1e1a", accent: "#f0f4fa", accentDark: "#c7d6e8", signBg: "#f2f8ff", signStripe: "#245ca8" },
      { skin: ["#e8ba92", "#fad2b0"], top: "#b53636", topHi: "#e05858", topDark: "#751c1c", bottom: "#263040", bottomHi: "#3c4c63", shoe: "#4a3324", hair: "#2b211e", headType: "pom_beanie", head: "#f0e6d2", headDark: "#b8aa92", accent: "#3a78c2", accentDark: "#24518a", signBg: "#fff8eb", signStripe: "#b53636" },
      { skin: ["#f5caa0", "#ffe0bd"], top: "#2e6b5e", topHi: "#4c9686", topDark: "#1a4239", bottom: "#1d2633", bottomHi: "#314054", shoe: "#3d2c1e", hair: "#9e6b36", headType: "pom_beanie", head: "#f2b84b", headDark: "#b57e1b", accent: "#e85d4a", accentDark: "#ad3628", signBg: "#f5f8ff", signStripe: "#2e6b5e" },
    ],
  },
  israel_jerusalem: {
    id: "israel_jerusalem",
    topStyle: "short_shirt",
    bottomStyle: "pants",
    shoeStyle: "sandals",
    neckStyle: "collar",
    variants: [
      { skin: ["#e5b388", "#f7cea6"], top: "#3a84c9", topHi: "#66aef0", topDark: "#22558a", bottom: "#8c7a5b", bottomHi: "#b39f7d", shoe: "#6b472b", hair: "#241b17", headType: "bucket_hat", head: "#f2e7cc", headDark: "#bfa97c", accent: "#245ca8", accentDark: "#183d73", sunglasses: false, signBg: "#fff9eb", signStripe: "#245ca8" },
      { skin: ["#d49a6a", "#ebb486"], top: "#f5efe0", topHi: "#ffffff", topDark: "#c7bda8", bottom: "#3d5940", bottomHi: "#5a7d5e", shoe: "#593b24", hair: "#1f1816", headType: "kippah", head: "#245ca8", headDark: "#143769", accent: "#e87e38", accentDark: "#b05419", sunglasses: true, signBg: "#fff6d6", signStripe: "#245ca8" },
      { skin: ["#e8ba92", "#fad2b0"], top: "#d97736", topHi: "#f59c5b", topDark: "#994b1a", bottom: "#3b4c63", bottomHi: "#566c8a", shoe: "#4f3622", hair: "#3d2518", headType: "cap", head: "#2f6e57", headDark: "#1b4536", accent: "#f4d35e", accentDark: "#c29c2b", sunglasses: false, signBg: "#f5f2e8", signStripe: "#24573d" },
    ],
  },
  israel_coastal: {
    id: "israel_coastal",
    topStyle: "tee",
    bottomStyle: "shorts",
    shoeStyle: "sandals",
    neckStyle: "none",
    variants: [
      { skin: ["#e0a87b", "#f5c49c"], top: "#29a8b8", topHi: "#5cd8e6", topDark: "#176d78", bottom: "#c4ad82", bottomHi: "#e0cca4", shoe: "#3a78c2", hair: "#261c18", headType: "sun_hat", head: "#f2d89c", headDark: "#c7a461", accent: "#245ca8", accentDark: "#183c70", sunglasses: true, signBg: "#f0fbff", signStripe: "#1e88a8" },
      { skin: ["#f0c097", "#ffdbb8"], top: "#f26b4e", topHi: "#ff957a", topDark: "#b53f28", bottom: "#27436e", bottomHi: "#3f6399", shoe: "#d95b26", hair: "#4a2c18", headType: "cap", head: "#ffffff", headDark: "#c7cfd9", accent: "#29a8b8", accentDark: "#186e7a", sunglasses: true, signBg: "#fff6e0", signStripe: "#e05b38" },
      { skin: ["#d49a6a", "#ebb486"], top: "#ffffff", topHi: "#ffffff", topDark: "#cbd6e3", bottom: "#2f7868", bottomHi: "#4ba390", shoe: "#245ca8", hair: "#1f1816", headType: "none", head: "#245ca8", headDark: "#163b70", accent: "#245ca8", accentDark: "#183d73", sunglasses: true, signBg: "#fff9e8", signStripe: "#245ca8" },
    ],
  },
  desert: {
    id: "desert",
    topStyle: "vest_shirt",
    bottomStyle: "pants",
    shoeStyle: "boots",
    neckStyle: "bandana",
    variants: [
      { skin: ["#d99e70", "#f0ba8d"], top: "#d96b38", topHi: "#f59462", topDark: "#96401b", bottom: "#7d684c", bottomHi: "#a38b6a", shoe: "#5c3920", hair: "#291c15", headType: "wide_hat", head: "#d9b984", headDark: "#9c7c4c", accent: "#26a8b8", accentDark: "#166f7a", sunglasses: true, signBg: "#fff5e0", signStripe: "#c94d24" },
      { skin: ["#e8b88e", "#fad2ae"], top: "#c7a46b", topHi: "#e6c791", topDark: "#8c6d3e", bottom: "#4d4238", bottomHi: "#6e5f52", shoe: "#4a2d18", hair: "#3d2618", headType: "wide_hat", head: "#a65938", headDark: "#6e351d", accent: "#f2c64b", accentDark: "#ba8f22", sunglasses: false, signBg: "#fff8e8", signStripe: "#9c4724" },
      { skin: ["#c98d60", "#e3a87b"], top: "#5e8f68", topHi: "#84ba8f", topDark: "#3a5e42", bottom: "#8c7456", bottomHi: "#b39876", shoe: "#54341e", hair: "#1e1715", headType: "wide_hat", head: "#e6cfa3", headDark: "#b09668", accent: "#d93b36", accentDark: "#94211d", sunglasses: false, signBg: "#f7f0e0", signStripe: "#3a6e47" },
    ],
  },
  tropical_coastal: {
    id: "tropical_coastal",
    topStyle: "aloha",
    bottomStyle: "shorts",
    shoeStyle: "sandals",
    neckStyle: "none",
    variants: [
      { skin: ["#d49668", "#edb082"], top: "#e84855", topHi: "#ff7a85", topDark: "#a62430", bottom: "#d9c496", bottomHi: "#f2e0b8", shoe: "#289c8e", hair: "#1f1715", headType: "sun_hat", head: "#f2d58d", headDark: "#bf9d52", accent: "#ffe066", accentDark: "#38d9a9", sunglasses: true, signBg: "#fff7e0", signStripe: "#e84855" },
      { skin: ["#b87a52", "#d6976e"], top: "#1e9ca8", topHi: "#4fd1de", topDark: "#12646e", bottom: "#f2e6cf", bottomHi: "#ffffff", shoe: "#e86842", hair: "#1a1412", headType: "sun_hat", head: "#ebd08f", headDark: "#b59651", accent: "#ff7854", accentDark: "#ffe066", sunglasses: true, signBg: "#ebfffc", signStripe: "#168794" },
      { skin: ["#e5b388", "#f7cea6"], top: "#f2b82e", topHi: "#ffd966", topDark: "#b88212", bottom: "#27537d", bottomHi: "#3f74a8", shoe: "#e84855", hair: "#3d2416", headType: "cap", head: "#28b8a8", headDark: "#177a70", accent: "#ff5c8a", accentDark: "#4fd1de", sunglasses: false, signBg: "#fffbe6", signStripe: "#1e9ca8" },
    ],
  },
  european_historic: {
    id: "european_historic",
    topStyle: "trench",
    bottomStyle: "pants",
    shoeStyle: "boots",
    neckStyle: "scarf",
    variants: [
      { skin: ["#f5caa0", "#ffe0bd"], top: "#c49a62", topHi: "#e0ba82", topDark: "#876539", bottom: "#242c3d", bottomHi: "#3a465e", shoe: "#2e1f18", hair: "#4a2c18", headType: "beret", head: "#b82e3b", headDark: "#7a1922", accent: "#244778", accentDark: "#162d4f", signBg: "#fff9ed", signStripe: "#244778" },
      { skin: ["#f0c299", "#ffdbb8"], top: "#3b4252", topHi: "#576178", topDark: "#232833", bottom: "#1d222e", bottomHi: "#323a4d", shoe: "#241a16", hair: "#7a4a24", headType: "flat_cap", head: "#2f614d", headDark: "#1b3b2e", accent: "#e0a838", accentDark: "#a8771b", signBg: "#f5f4f0", signStripe: "#8c2b32" },
      { skin: ["#e6b68c", "#fad0aa"], top: "#243d63", topHi: "#3c5f94", topDark: "#142540", bottom: "#363842", bottomHi: "#505463", shoe: "#3d261a", hair: "#261e1b", headType: "beret", head: "#6e2942", headDark: "#451627", accent: "#f0e6d2", accentDark: "#bfb399", signBg: "#fff7e8", signStripe: "#243d63" },
    ],
  },
  alpine: {
    id: "alpine",
    topStyle: "nordic_sweater",
    bottomStyle: "pants",
    shoeStyle: "boots",
    neckStyle: "collar",
    variants: [
      { skin: ["#f7d2b0", "#ffe6cc"], top: "#2a6349", topHi: "#448c6b", topDark: "#183d2c", bottom: "#4a3c31", bottomHi: "#6b5848", shoe: "#3d2518", hair: "#8f5c2c", headType: "alpine_hat", head: "#2d523c", headDark: "#1a3324", accent: "#e8463a", accentDark: "#fff7e6", signBg: "#fff8eb", signStripe: "#c9382e" },
      { skin: ["#f2c69e", "#ffdeb8"], top: "#2b4d78", topHi: "#4772ab", topDark: "#182e4d", bottom: "#363b47", bottomHi: "#4f5666", shoe: "#422819", hair: "#4a2e1e", headType: "pom_beanie", head: "#e8e3d5", headDark: "#b5ae9c", accent: "#f2c64b", accentDark: "#245ca8", signBg: "#f2f8ff", signStripe: "#2b4d78" },
      { skin: ["#e8ba92", "#fad2b0"], top: "#a63d33", topHi: "#d45d50", topDark: "#6e221b", bottom: "#2e3d36", bottomHi: "#475e53", shoe: "#382216", hair: "#2b201c", headType: "alpine_hat", head: "#5e4a38", headDark: "#3b2e22", accent: "#f5efe0", accentDark: "#3a8f7a", signBg: "#fff6e6", signStripe: "#2a6349" },
    ],
  },
  east_asian_urban: {
    id: "east_asian_urban",
    topStyle: "streetwear",
    bottomStyle: "wide_pants",
    shoeStyle: "sneakers",
    neckStyle: "hoodie",
    variants: [
      { skin: ["#f7d6b5", "#ffead1"], top: "#2c4c7d", topHi: "#4871b0", topDark: "#1a2f52", bottom: "#292e3b", bottomHi: "#424a5e", shoe: "#f2f5fa", hair: "#1a1820", headType: "bucket_hat", head: "#242833", headDark: "#12151c", accent: "#ffffff", accentDark: "#d4dde8", glasses: false, signBg: "#fff2f6", signStripe: "#d94c7a" },
      { skin: ["#f2cca8", "#ffe2c4"], top: "#4f8a68", topHi: "#74b58f", topDark: "#2e5940", bottom: "#d9cdb8", bottomHi: "#f2e7d5", shoe: "#ffffff", hair: "#1c1a24", headType: "none", head: "#1c1a24", headDark: "#100f14", accent: "#fff8eb", accentDark: "#e3d6be", glasses: true, signBg: "#f2fff7", signStripe: "#2e7854" },
      { skin: ["#f7d6b5", "#ffead1"], top: "#e884a2", topHi: "#ffa8c2", topDark: "#b05471", bottom: "#363e52", bottomHi: "#505c78", shoe: "#f7f5f0", hair: "#241d26", headType: "cap", head: "#f5efe6", headDark: "#c7bfb4", accent: "#ffffff", accentDark: "#ffd4e0", glasses: false, signBg: "#fff5f8", signStripe: "#2c4c7d" },
    ],
  },
  temperate_green: {
    id: "temperate_green",
    topStyle: "tee",
    bottomStyle: "shorts",
    shoeStyle: "sneakers",
    neckStyle: "none",
    variants: [
      { skin: ["#f5caa0", "#ffe0bd"], top: "#2b6ec9", topHi: "#5499f0", topDark: "#1a4687", bottom: "#b8a078", bottomHi: "#d9c29c", shoe: "#e8f0f7", hair: "#4a2e1e", headType: "cap", head: "#d93b36", headDark: "#94211d", accent: "#ffffff", accentDark: "#cbd6e3", signBg: "#fff9e6", signStripe: "#245ca8" },
      { skin: ["#d99e70", "#f0ba8d"], top: "#389c5e", topHi: "#61c988", topDark: "#21663b", bottom: "#2e405c", bottomHi: "#466087", shoe: "#f2f5fa", hair: "#241c1a", headType: "cap", head: "#f2c64b", headDark: "#bd9122", accent: "#ffffff", accentDark: "#d4dde8", signBg: "#f2fff5", signStripe: "#247844" },
      { skin: ["#f0c299", "#ffdbb8"], top: "#e8a82e", topHi: "#ffd066", topDark: "#ad7615", bottom: "#3a4559", bottomHi: "#556480", shoe: "#e84855", hair: "#734224", headType: "none", head: "#734224", headDark: "#4a2914", accent: "#2b6ec9", accentDark: "#1a4687", signBg: "#fff8eb", signStripe: "#d95b26" },
    ],
  },
};

/**
 * Resolve which biome/seasonal outfit style sidewalk protestors wear.
 */
export function resolveProtestorOutfitStyle(biomeConfig = null, season = "fall") {
  // Backwards-compatible support for legacy climate strings ("cold" | "warm" | "mild")
  if (typeof biomeConfig === "string") {
    if (PROTESTOR_BIOME_STYLES[biomeConfig]) return biomeConfig;
    if (biomeConfig === "cold") return "winter_parka";
    if (biomeConfig === "warm") return "israel_jerusalem";
    return "new_england_autumn";
  }

  const id = biomeConfig?.id || "";
  if (
    id === "tundra" ||
    biomeConfig?.hasSnowGround ||
    (season === "winter" &&
      (!biomeConfig ||
        id === "new_england_autumn" ||
        id === "temperate_green" ||
        id === "european_historic" ||
        id === "alpine" ||
        id === "east_asian_urban"))
  ) {
    return "winter_parka";
  }
  if (id === "israel_jerusalem" || id === "israel_galilee") return "israel_jerusalem";
  if (id === "israel_coastal") return "israel_coastal";
  if (id === "israel_desert" || id === "southwest_desert") return "desert";
  if (id === "tropical_coastal") return "tropical_coastal";
  if (id === "european_historic") return "european_historic";
  if (id === "alpine") return "alpine";
  if (id === "east_asian_urban") return "east_asian_urban";
  if (id === "temperate_green") return "temperate_green";
  return "new_england_autumn";
}

/**
 * Bake 32-bit Pure Pixel Sidewalk Protestor waving a big cardboard picket sign + megaphone,
 * dressed in authentic biome-specific outfits, headwear, footwear & accessories!
 */
function bake32BitProtestorRight(variant = 0, shoutFrame = 0, styleOrClimate = "new_england_autumn") {
  const w = 48;
  const h = 64;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const topY = 14;
  const signLift = shoutFrame === 1 ? -3 : 0;
  const stride = shoutFrame === 1 ? 2 : 0;

  const styleKey = resolveProtestorOutfitStyle(styleOrClimate);
  const styleCfg = PROTESTOR_BIOME_STYLES[styleKey] || PROTESTOR_BIOME_STYLES.new_england_autumn;
  const th = styleCfg.variants[variant % styleCfg.variants.length];
  const skinMid = th.skin?.[0] || LIAM_PAL.skinMid;
  const skinHi = th.skin?.[1] || LIAM_PAL.skinHi;

  // 1. Tall wooden picket-sign pole & BIG hand-painted cardboard protest sign held high!
  const poleX = cx - 8;
  g.rect(poleX, 16 + signLift, 3, 28, "#8c542c", "pole");
  g.rect(poleX, 16 + signLift, 1, 28, "#bd7c46", "pole");
  const signX = poleX - 10;
  const signY = 4 + signLift;
  g.rect(signX, signY, 24, 15, "#b8966e", "sign");
  g.rect(signX + 1, signY + 1, 22, 13, th.signBg, "sign");
  g.rect(signX + 3, signY + 3, 14, 2, th.signStripe, "sign");
  g.rect(signX + 3, signY + 7, 11, 2, "#291a18", "sign");
  g.rect(signX + 3, signY + 11, 15, 2, th.signStripe, "sign");
  g.rect(signX + 19, signY + 3, 2, 6, th.signStripe, "sign");
  g.rect(signX + 19, signY + 11, 2, 2, th.signStripe, "sign");

  // 2. Legs & Footwear tailored to biome (shorts + sandals, wide streetwear pants + white sneakers, snowpants + fur boots, trousers + boots)
  const legPositions = [
    { lx: cx - 5 - stride, isFront: false },
    { lx: cx + 1 + stride, isFront: true },
  ];
  for (const { lx, isFront } of legPositions) {
    const legCol = isFront ? th.bottom : th.bottom;
    const legHi = isFront ? th.bottomHi : th.bottom;
    const legW = styleCfg.bottomStyle === "wide_pants" ? 6 : 5;

    if (styleCfg.bottomStyle === "shorts") {
      // Breezy summer/coastal shorts + sunlit lower leg!
      g.rect(lx, topY + 33, legW, 6, legCol, "pants");
      g.rect(lx + 1, topY + 34, 2, 4, legHi, "pants");
      g.rect(lx + 1, topY + 39, 3, 5, skinMid, "skin");
      g.rect(lx + 2, topY + 39, 1, 4, skinHi, "skin");
    } else if (styleCfg.bottomStyle === "snowpants") {
      // Insulated puffy winter snow trousers with quilted knee seam
      g.rect(lx, topY + 33, 6, 11, legCol, "pants");
      g.rect(lx + 1, topY + 34, 3, 9, legHi, "pants");
      g.rect(lx, topY + 38, 6, 1, "#121926", "pants");
    } else {
      g.rect(lx, topY + 33, legW, 11, legCol, "pants");
      g.rect(lx + 1, topY + 34, 2, 9, legHi, "pants");
    }

    // Biome footwear
    if (styleCfg.shoeStyle === "sandals") {
      // Strapped sandals / coastal flip-flops showing sunlit toes!
      g.rect(lx, topY + 44, 6, 2, th.shoe, "shoe");
      g.rect(lx + 1, topY + 43, 4, 1, skinMid, "skin");
      g.rect(lx + 2, topY + 43, 2, 1, th.shoe, "shoe");
    } else if (styleCfg.shoeStyle === "snowboots") {
      // Fur-trimmed insulated winter snow boots!
      g.rect(lx - 1, topY + 42, 7, 2, "#f0f4fa", "scarf");
      g.rect(lx - 1, topY + 44, 7, 3, th.shoe, "shoe");
    } else if (styleCfg.shoeStyle === "sneakers") {
      // Crisp chunky modern sneakers with white sole & colored accent
      g.rect(lx - 1, topY + 43, 7, 3, th.shoe, "shoe");
      g.rect(lx - 1, topY + 45, 7, 2, "#d8e0eb", "shoe");
      g.rect(lx + 1, topY + 43, 3, 1, th.topHi, "shoe");
    } else {
      g.rect(lx - 1, topY + 43, 7, 4, th.shoe, "shoe");
    }
  }

  // 3. Back hand gripping picket pole (with cozy mittens in winter!) + Biome Torso Silhouette!
  const handCol = styleCfg.mittens ? th.head : skinMid;
  const handMat = styleCfg.mittens ? "cap" : "skin";
  g.rect(poleX - 1, topY + 19 + signLift, 5, 4, handCol, handMat);

  if (styleCfg.topStyle === "trench") {
    // Chic European long tailored trench/peacoat extending slightly over hips + lapels & double buttons!
    g.rect(cx - 7, topY + 21, 14, 16, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 13, th.topHi, "polo");
    g.rect(cx - 7, topY + 35, 14, 2, th.topDark, "polo");
    g.rect(cx + 1, topY + 26, 2, 2, th.topDark, "polo"); // coat buttons
    g.rect(cx + 1, topY + 30, 2, 2, th.topDark, "polo");
    g.rect(cx - 7, topY + 29, 14, 2, th.topDark, "polo"); // tailored belt
  } else if (styleCfg.topStyle === "parka") {
    // Puffy quilted Arctic/Winter down parka with fluffy white faux-fur hood collar!
    g.rect(cx - 8, topY + 21, 16, 14, th.top, "polo");
    g.rect(cx - 6, topY + 22, 11, 11, th.topHi, "polo");
    g.rect(cx - 8, topY + 25, 16, 1, th.topDark, "polo"); // puffer baffle seams
    g.rect(cx - 8, topY + 29, 16, 1, th.topDark, "polo");
    g.rect(cx - 8, topY + 33, 16, 2, th.topDark, "polo");
    // Fluffy fur-trimmed hood collar resting on shoulders
    g.rect(cx - 7, topY + 19, 14, 3, "#f5f8fc", "scarf");
    g.rect(cx - 6, topY + 20, 12, 1, "#dce6f2", "scarf");
  } else if (styleCfg.topStyle === "aloha") {
    // Vibrant Tropical Aloha / Floral short-sleeve shirt with pixel hibiscus blossoms!
    g.rect(cx - 7, topY + 21, 14, 13, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 10, th.topHi, "polo");
    g.rect(cx - 7, topY + 32, 14, 2, th.topDark, "polo");
    // Crisp colorful floral pattern dots
    g.rect(cx - 4, topY + 24, 2, 2, th.accent, "scarf");
    g.rect(cx + 1, topY + 27, 2, 2, th.accentDark, "scarf");
    g.rect(cx - 3, topY + 29, 2, 2, th.accentDark, "scarf");
    g.rect(cx + 3, topY + 23, 2, 2, th.accent, "scarf");
  } else if (styleCfg.topStyle === "nordic_sweater") {
    // Cozy Alpine / Nordic Fair Isle sweater with pixel snowflake chest band + mountain vest!
    g.rect(cx - 7, topY + 21, 14, 13, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 10, th.topHi, "polo");
    // Iconic Fair Isle zigzag chest band!
    g.rect(cx - 7, topY + 24, 14, 4, th.accentDark, "scarf");
    for (let nx = cx - 6; nx <= cx + 5; nx += 3) {
      g.rect(nx, topY + 25, 2, 2, th.accent, "scarf");
    }
    g.rect(cx - 7, topY + 32, 14, 2, th.topDark, "polo");
  } else if (styleCfg.topStyle === "vest_shirt") {
    // Desert breathable cotton shirt with light canvas utility vest & chest pocket
    g.rect(cx - 7, topY + 21, 14, 13, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 10, th.topHi, "polo");
    g.rect(cx - 6, topY + 22, 12, 10, "#d9c496", "scarf");
    g.rect(cx - 4, topY + 23, 3, 9, th.topHi, "polo"); // open vest front
    g.rect(cx + 1, topY + 26, 4, 3, "#bfa370", "scarf"); // utility pocket
    g.rect(cx - 7, topY + 32, 14, 2, th.topDark, "polo");
  } else if (styleCfg.topStyle === "streetwear") {
    // East Asian Urban layered overshirt/cardigan with crisp white tee peek at hem & collar!
    g.rect(cx - 7, topY + 21, 14, 12, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 9, th.topHi, "polo");
    g.rect(cx - 2, topY + 22, 4, 11, th.accent, "scarf"); // crisp inner white tee
    g.rect(cx - 7, topY + 32, 14, 2, th.accent, "scarf"); // layered white tee hem
    g.rect(cx - 7, topY + 31, 14, 1, th.topDark, "polo");
  } else if (styleCfg.topStyle === "short_shirt" || styleCfg.topStyle === "tee") {
    // Breezy Mediterranean / Summer short-sleeve shirt or casual tee
    g.rect(cx - 7, topY + 21, 14, 13, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 10, th.topHi, "polo");
    g.rect(cx - 7, topY + 32, 14, 2, th.topDark, "polo");
    if (styleCfg.topStyle === "short_shirt") {
      // Crisp button placket & chest pocket
      g.line(cx + 1, topY + 22, cx + 1, topY + 32, th.topDark, "polo");
      g.rect(cx - 4, topY + 25, 3, 3, th.topDark, "polo");
    } else if (th.accent) {
      // Casual tee chest stripe!
      g.rect(cx - 6, topY + 25, 12, 2, th.accent, "scarf");
    }
  } else {
    // Classic New England Autumn jacket
    g.rect(cx - 7, topY + 21, 14, 13, th.top, "polo");
    g.rect(cx - 5, topY + 22, 9, 10, th.topHi, "polo");
    g.rect(cx - 7, topY + 32, 14, 2, th.topDark, "polo");
  }

  // Neck accessory (knit scarf, desert bandana, collar, or hoodie cords)
  if (styleCfg.neckStyle === "scarf") {
    g.rect(cx - 6, topY + 20, 12, 3, th.accent, "scarf");
    g.rect(cx + 1, topY + 23, 3, 6, th.accentDark, "scarf");
  } else if (styleCfg.neckStyle === "bandana") {
    // Triangular desert neckerchief bandana!
    g.rect(cx - 5, topY + 20, 11, 2, th.accent, "scarf");
    g.rect(cx - 2, topY + 22, 7, 2, th.accent, "scarf");
    g.rect(cx, topY + 24, 4, 2, th.accentDark, "scarf");
  } else if (styleCfg.neckStyle === "collar") {
    g.rect(cx - 4, topY + 20, 9, 2, th.topHi, "polo");
  } else if (styleCfg.neckStyle === "hoodie") {
    g.rect(cx - 6, topY + 20, 12, 2, th.topDark, "polo");
    g.rect(cx, topY + 22, 1, 4, th.accent, "scarf");
    g.rect(cx + 3, topY + 22, 1, 4, th.accent, "scarf");
  }

  // 4. Sculpted side-ish head + biome-specific headwear, sunglasses/glasses & shouting expression!
  g.ellipse(cx, topY + 12, 7.2, 7.4, skinMid, "skin");
  g.ellipse(cx + 2, topY + 11, 4.4, 4.6, skinHi, "skin");
  g.rect(cx + 6, topY + 13, 2, 2, skinMid, "skin"); // nose
  g.rect(cx - 7, topY + 8, 6, 8, th.hair, "hair");

  // Biome Headwear!
  const ht = th.headType || "beanie";
  if (ht === "pom_beanie") {
    g.ellipse(cx - 2, topY + 1, 2.5, 2.2, th.accent, "scarf"); // fluffy pom-pom!
    g.ellipse(cx - 1, topY + 6.5, 7.6, 4.6, th.head, "cap");
    g.rect(cx - 8, topY + 8, 16, 2, th.headDark, "cap");
  } else if (ht === "sun_hat" || ht === "wide_hat") {
    // Wide woven straw sun hat or desert safari brim!
    g.ellipse(cx, topY + 8, 11.2, 2.3, th.headDark, "cap");
    g.ellipse(cx, topY + 7.5, 10.4, 1.8, th.head, "cap");
    g.ellipse(cx - 1, topY + 5, 6.2, 3.2, th.head, "cap");
    g.rect(cx - 6, topY + 6, 12, 2, th.accent, "scarf"); // colorful hatband!
  } else if (ht === "bucket_hat") {
    // Classic Mediterranean / East Asian urban bucket hat with sloped brim!
    g.ellipse(cx - 1, topY + 5.5, 6.4, 3.4, th.head, "cap");
    g.rect(cx - 9, topY + 7, 18, 2, th.head, "cap");
    g.rect(cx - 8, topY + 8, 17, 2, th.headDark, "cap");
  } else if (ht === "cap") {
    // Baseball / sun cap with visor jutting forward!
    g.ellipse(cx - 1, topY + 6.5, 7.4, 4.4, th.head, "cap");
    g.rect(cx - 7, topY + 8, 15, 2, th.headDark, "cap");
    g.rect(cx + 4, topY + 8, 8, 2, th.headDark, "cap");
  } else if (ht === "kippah") {
    // Full dark hair crown + neat knitted kippah at back-crown!
    g.ellipse(cx, topY + 7.5, 7.4, 4.2, th.hair, "hair");
    g.ellipse(cx - 3, topY + 4.5, 4.5, 2.6, th.head, "cap");
    g.rect(cx - 7, topY + 6, 8, 1, th.headDark, "cap");
  } else if (ht === "beret") {
    // Chic tilted European artist/cafe beret!
    g.ellipse(cx - 2, topY + 5.5, 8.6, 3.6, th.head, "cap");
    g.ellipse(cx - 3, topY + 4.5, 5.5, 2.0, th.head, "cap");
    g.rect(cx - 2, topY + 2, 2, 2, th.headDark, "cap"); // beret stem!
    g.rect(cx - 7, topY + 8, 14, 1, th.headDark, "cap");
  } else if (ht === "flat_cap") {
    // Classic European wool flat cap / newsboy cap!
    g.ellipse(cx - 1, topY + 6.5, 8.2, 3.4, th.head, "cap");
    g.rect(cx - 7, topY + 8, 17, 2, th.headDark, "cap");
  } else if (ht === "alpine_hat") {
    // Alpine mountain felt cap with jaunty red feather!
    g.ellipse(cx - 1, topY + 5.5, 6.8, 3.6, th.head, "cap");
    g.rect(cx - 9, topY + 8, 18, 2, th.headDark, "cap");
    g.rect(cx - 5, topY + 6, 10, 2, th.accentDark, "scarf");
    g.line(cx - 5, topY + 6, cx - 9, topY + 1, th.accent, "scarf"); // jaunty feather!
  } else if (ht === "none") {
    // Neat uncovered hair silhouette (sunny coastal / East Asian urban look)
    g.ellipse(cx - 1, topY + 7.2, 7.6, 4.4, th.hair, "hair");
    g.rect(cx + 1, topY + 7, 6, 2, th.hair, "hair");
  } else {
    // Default ribbed knit beanie
    g.ellipse(cx - 1, topY + 6.5, 7.6, 4.6, th.head, "cap");
    g.rect(cx - 8, topY + 8, 16, 2, th.headDark || "#291a18", "cap");
  }

  // Face: expressive eye, optional sunglasses / urban round glasses & shouting mouth!
  if (th.sunglasses) {
    g.rect(cx + 2, topY + 11, 6, 3, "#141824", "cap");
    g.rect(cx + 3, topY + 11, 4, 2, "#38b6ff", "scarf");
    g.set(cx + 3, topY + 11, "#ffffff", "scarf");
  } else {
    g.rect(cx + 3, topY + 10, 4, 1, "#291a18", "skin");
    g.rect(cx + 4, topY + 11, 2, 3, "#1c1312", "skin");
    g.set(cx + 4, topY + 11, "#ffffff", "skin");
    if (th.glasses) {
      g.rect(cx + 3, topY + 10, 4, 1, "#242836", "cap");
      g.rect(cx + 3, topY + 14, 4, 1, "#242836", "cap");
      g.set(cx + 2, topY + 11, "#242836", "cap");
    }
  }
  if (shoutFrame === 1) {
    g.rect(cx + 4, topY + 15, 3, 3, "#7a1c1c", "skin");
    g.rect(cx + 5, topY + 15, 2, 1, "#ffffff", "skin");
  } else {
    g.rect(cx + 4, topY + 16, 3, 2, "#8c2b2b", "skin");
  }

  // 5. Front arm (short sleeve shows sunlit forearm on warm/summer biomes!) holding a loud MEGAPHONE!
  const isShortSleeve =
    styleCfg.topStyle === "tee" ||
    styleCfg.topStyle === "aloha" ||
    styleCfg.topStyle === "short_shirt";
  if (isShortSleeve) {
    g.rect(cx + 4, topY + 22, 3, 4, th.topHi, "polo");
    g.rect(cx + 7, topY + 22, 5, 3, skinMid, "skin");
  } else {
    g.rect(cx + 4, topY + 22, 6, 4, th.topHi, "polo");
    g.rect(cx + 9, topY + 21, 3, 4, handCol, handMat);
  }
  const megaY = shoutFrame === 1 ? topY + 14 : topY + 17;
  g.rect(cx + 10, megaY + 2, 4, 4, "#d93b36", "mega");
  g.rect(cx + 13, megaY + 1, 3, 6, "#f7f5f0", "mega");
  g.rect(cx + 16, megaY, 3, 8, "#d93b36", "mega");
  if (shoutFrame === 1) {
    g.rect(cx + 20, megaY + 1, 2, 1, "#ffe066", "wave");
    g.rect(cx + 21, megaY + 4, 2, 1, "#ffe066", "wave");
    g.rect(cx + 20, megaY + 7, 2, 1, "#ffe066", "wave");
  }

  g.applySelOut({
    ...LIAM_SELOUT,
    pole: "#361d10",
    sign: "#291a18",
    scarf: "#4a3820",
    mega: "#421515",
    wave: "#a65912",
    polo: th.topDark,
  });
  return g.toCanvas(0.5, { cx: cx, cy: 60, rx: 10, ry: 3.0 });
}

/**
 * Bake 32-bit Pure Pixel Spooky Graveyard Skeleton (rattling bones, glowing emerald eyes & tattered scarf!)
 * frame 0/1 = clattering stride, frame 2 = dramatic raised-arms spook/lunge pose!
 */
function bake32BitSkeletonRight(frame = 0) {
  const w = 44;
  const h = 56;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const isAttack = frame === 2;
  const topY = isAttack ? 5 : 8 + (frame === 1 ? -1 : 0);
  const stride = isAttack ? 4 : frame === 1 ? 3 : -1;

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
  g.rect(cx - 10, topY + 18 + (frame === 1 ? 1 : isAttack ? -2 : 0), 5, 3, "#6a4794", "cloak");
  g.rect(cx - 13, topY + (isAttack ? 17 : 20), 4, 2, "#3a2354", "cloak");

  // 4. Outstretched spooky rattling bone arms (raised wide & lunging on attack frame!)
  if (isAttack) {
    g.rect(cx - 11, topY + 14, 6, 3, "#dbe3d8", "bone");
    g.rect(cx - 14, topY + 9, 4, 7, "#edf2eb", "bone");
    g.rect(cx - 15, topY + 7, 5, 3, "#ffffff", "bone"); // raised left claw!
    g.rect(cx + 6, topY + 14, 7, 3, "#edf2eb", "bone");
    g.rect(cx + 11, topY + 9, 5, 7, "#ffffff", "bone");
    g.rect(cx + 13, topY + 7, 5, 4, "#ffffff", "bone"); // lunging right claw!
    // Eerie green spook-aura sparks around hands!
    g.set(cx + 17, topY + 5, "#78ffbd", "glow");
    g.set(cx - 15, topY + 5, "#78ffbd", "glow");
  } else {
    const armLift = frame === 1 ? -3 : 0;
    g.rect(cx - 9, topY + 19, 4, 3, "#c8d4c6", "bone");
    g.rect(cx - 11, topY + 22, 3, 7, "#b6c2b4", "bone");
    g.rect(cx + 5, topY + 19 + armLift, 7, 3, "#edf2eb", "bone");
    g.rect(cx + 10, topY + 18 + armLift, 5, 4, "#ffffff", "bone"); // reaching bony hand
  }

  // 5. Expressive sculpted ivory skull with glowing eerie emerald eyes & toothy grin!
  g.ellipse(cx + 1, topY + 9, 7.2, 6.6, "#edf2eb", "bone");
  g.ellipse(cx, topY + 7.5, 4.8, 3.8, "#ffffff", "bone");
  g.rect(cx - 4, topY + 13, 9, isAttack ? 5 : 4, "#dbe3d8", "bone"); // jaw drops wider on rattle!
  // Deep eye sockets + bright glowing ghostly emerald eyes!
  g.rect(cx - 2, topY + 8, 3, 3, "#1b202e", "hollow");
  g.rect(cx + 3, topY + 8, 3, 3, "#1b202e", "hollow");
  g.rect(cx - 1, topY + 9, 2, 2, isAttack ? "#94ffd0" : "#59f2a8", "glow");
  g.rect(cx + 4, topY + 9, 2, 2, isAttack ? "#94ffd0" : "#59f2a8", "glow");
  g.set(cx - 1, topY + 9, "#ffffff", "glow");
  g.set(cx + 4, topY + 9, "#ffffff", "glow");
  // Cute nose notch & chattering pixel teeth
  g.rect(cx + 1, topY + 11, 2, 2, "#262c38", "hollow");
  g.rect(cx - 2, topY + 15, 7, isAttack ? 3 : 2, "#262c38", "hollow");
  g.set(cx - 1, topY + 15, "#ffffff", "bone");
  g.set(cx + 1, topY + 15, "#ffffff", "bone");
  g.set(cx + 3, topY + 15, "#ffffff", "bone");
  if (isAttack) {
    g.set(cx, topY + 17, "#ffffff", "bone");
    g.set(cx + 2, topY + 17, "#ffffff", "bone");
  }

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
 * frame 0/1 = drifting hover, frame 2 = flared spectral BOO! lunge!
 */
function bake32BitPhantomRight(frame = 0) {
  const w = 44;
  const h = 56;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const isAttack = frame === 2;
  const bob = isAttack ? -5 : frame === 1 ? -3 : 0;

  // 1. Billowing spectral body & animated wavy ectoplasm tail
  g.ellipse(cx, 24 + bob, isAttack ? 11.2 : 9.5, 13.5, "#6b7ec4", "ectoplasm");
  g.ellipse(cx - 1, 21 + bob, isAttack ? 8.8 : 7.2, 10.2, "#9bb3f0", "ectoplasm");
  g.ellipse(cx - 2, 18 + bob, isAttack ? 5.6 : 4.4, 6.2, "#d4e6ff", "ectoplasm");
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
  g.rect(cx, 14 + bob, 3, isAttack ? 4 : 3, isAttack ? "#a8fcff" : "#5ceef5", "glow");
  g.rect(cx + 4, 14 + bob, 3, isAttack ? 4 : 3, isAttack ? "#a8fcff" : "#5ceef5", "glow");
  g.set(cx + 1, 14 + bob, "#ffffff", "glow");
  g.set(cx + 5, 14 + bob, "#ffffff", "glow");
  g.rect(cx + 2, 18 + bob, isAttack ? 4 : 3, isAttack ? 3 : 2, "#8cf7fc", "glow");

  // 3. Reaching spectral phantom arms (flared wide on BOO! lunge!)
  if (isAttack) {
    g.rect(cx + 8, 16 + bob, 8, 5, "#b6cdfc", "ectoplasm");
    g.rect(cx + 14, 13 + bob, 5, 5, "#e6f4ff", "ectoplasm");
    g.rect(cx - 14, 17 + bob, 7, 5, "#8aa4e8", "ectoplasm");
    g.rect(cx - 17, 14 + bob, 4, 5, "#d4e6ff", "ectoplasm");
    g.set(cx + 18, 11 + bob, "#8cf7fc", "glow");
    g.set(cx - 18, 12 + bob, "#8cf7fc", "glow");
  } else {
    g.rect(cx + 7, 21 + bob, 7, 4, "#9bb3f0", "ectoplasm");
    g.rect(cx + 12, 20 + bob, 4, 4, "#d4e6ff", "ectoplasm");
    g.rect(cx - 11, 22 + bob, 5, 4, "#6b7ec4", "ectoplasm");
  }

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
 * frame 0/1 = creeping stride, frame 2 = fiery jack-o'-lantern spook pounce!
 */
function bake32BitPumpkinGhoulRight(frame = 0) {
  const w = 44;
  const h = 56;
  const g = new PixelGrid(w, h);
  const cx = 22;
  const isAttack = frame === 2;
  const bob = isAttack ? -4 : frame === 1 ? -2 : 0;
  const stride = isAttack ? 3 : frame === 1 ? 2 : -1;

  // 1. Tattered deep-violet cloak & creeping boots
  g.rect(cx - 5 - stride, 42, 5, 5, "#2b2038", "boot");
  g.rect(cx + 1 + stride, 42, 5, 5, "#22192e", "boot");
  g.ellipse(cx, 33 + bob, isAttack ? 10.2 : 9.2, 10.5, "#4a2763", "cloak");
  g.ellipse(cx - 1, 31 + bob, 6.4, 8.2, "#6b3b8c", "cloak");
  g.rect(cx - 9, 39 + bob, 4, 4, "#3a1e4f", "cloak");
  g.rect(cx - 3, 40 + bob, 5, 4, "#4a2763", "cloak");
  g.rect(cx + 4, 39 + bob, 5, 4, "#3a1e4f", "cloak");
  // Ragged autumn leaf collar
  g.rect(cx - 7, 23 + bob, 14, 3, "#2f6639", "leaf");
  g.rect(cx - 5, 25 + bob, 10, 2, "#468f52", "leaf");

  // 2. Crooked wooden twig arms reaching forward (flaring wide with fiery sparks on attack!)
  if (isAttack) {
    g.rect(cx + 6, 21 + bob, 9, 3, "#8f5936", "twig");
    g.rect(cx + 13, 17 + bob, 4, 5, "#a66c44", "twig");
    g.rect(cx + 15, 22 + bob, 3, 3, "#6b4125", "twig");
    g.rect(cx - 13, 21 + bob, 7, 3, "#6b4125", "twig");
    g.rect(cx - 15, 18 + bob, 3, 4, "#8f5936", "twig");
    g.set(cx + 17, 15 + bob, "#fff066", "glow");
    g.set(cx - 15, 16 + bob, "#ffb347", "glow");
  } else {
    g.rect(cx + 6, 26 + bob, 8, 3, "#6b4125", "twig");
    g.rect(cx + 12, 24 + bob, 3, 3, "#8f5936", "twig");
    g.rect(cx + 13, 28 + bob, 3, 2, "#6b4125", "twig");
    g.rect(cx - 11, 27 + bob, 5, 3, "#54321c", "twig");
  }

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
  // Glowing golden carved triangular eyes & toothy Jack-o'-Lantern grin (blazing wide on attack!)
  g.rect(cx - 2, 13 + bob, 3, 3, isAttack ? "#ffffff" : "#fff066", "glow");
  g.rect(cx + 3, 13 + bob, 3, 3, isAttack ? "#ffffff" : "#fff066", "glow");
  g.set(cx - 1, 14 + bob, "#ffffff", "glow");
  g.set(cx + 4, 14 + bob, "#ffffff", "glow");
  g.rect(cx - 3, 18 + bob, 9, isAttack ? 3 : 2, isAttack ? "#fff6a8" : "#ffe14d", "glow");
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

export const BIKER_CHANTS = [
  "ON YOUR LEFT!",
  "SHARE THE ROAD!",
  "STRAVA PR!",
  "BIKE LANE!",
  "WATCH CARBON!",
];

function bake32BitEmtRight(step = 0, variant = 0) {
  const g = new PixelGrid(46, 54);
  const cx = 23;
  const topY = 3 + (step === 1 ? -1 : 0);
  const stride = step === 1 ? 3 : -2;

  // Dark navy EMS utility trousers with silver reflective ankle bands + sturdy rescue boots!
  g.rect(cx - 4 - stride, topY + 33, 5, 11, "#1e2e4a", "pants");
  g.rect(cx - 4 - stride, topY + 40, 5, 2, "#e8f2fc", "jersey");
  g.rect(cx - 5 - stride, topY + 43, 7, 4, "#181a22", "shoe");
  g.rect(cx + 1 + stride, topY + 33, 5, 11, "#2a4066", "pants");
  g.rect(cx + 1 + stride, topY + 40, 5, 2, "#e8f2fc", "jersey");
  g.rect(cx + stride, topY + 43, 7, 4, "#181a22", "shoe");

  // Crisp navy EMS uniform jacket + high-vis NEON YELLOW reflective safety vest!
  g.rect(cx - 6, topY + 21, 13, 13, "#203659", "polo");
  g.rect(cx - 5, topY + 22, 11, 11, "#d9f029", "orange");
  g.rect(cx - 4, topY + 22, 8, 2, "#f3ff6b", "orange");
  g.rect(cx - 5, topY + 24, 11, 2, "#f0f8ff", "jersey"); // Silver reflective chest stripe
  g.rect(cx - 5, topY + 29, 11, 2, "#f0f8ff", "jersey"); // Silver reflective waist stripe
  // Crimson medical cross emblem on vest
  g.rect(cx + 1, topY + 26, 3, 1, "#e02820", "orange");
  g.rect(cx + 2, topY + 25, 1, 3, "#e02820", "orange");
  // Stethoscope draped around Lead EMT's neck OR red trauma med-pack on Partner EMT!
  if (variant === 0) {
    g.line(cx - 2, topY + 20, cx + 3, topY + 25, "#242834", "cap");
    g.ellipse(cx + 3, topY + 25, 1.5, 1.5, "#cfd8e3", "jersey");
  } else {
    g.rect(cx - 10, topY + 26, 6, 7, "#d92820", "orange"); // Red EMS trauma kit bag!
    g.rect(cx - 9, topY + 27, 4, 2, "#ff685e", "orange");
    g.rect(cx - 8, topY + 29, 2, 2, "#ffffff", "jersey");
  }

  // Reaching arms (navy sleeve + light-blue nitrile medical gloves!)
  g.rect(cx + 4, topY + 24, 7, 4, "#203659", "polo");
  g.rect(cx + 5, topY + 24, 5, 1, "#3b598a", "polo");
  g.rect(cx + 10, topY + 24, 4, 4, "#7cd6ff", "kippah"); // Blue medical rescue gloves!
  g.rect(cx + 11, topY + 24, 2, 2, "#ccf0ff", "kippah");

  // Sculpted 32-bit Head + focused face + EMS cap with gold badge!
  const skinMid = variant === 1 ? "#d49a6a" : LIAM_PAL.skinMid;
  const skinHi = variant === 1 ? "#ebb486" : LIAM_PAL.skinHi;
  g.ellipse(cx, topY + 13, 7.2, 7.2, skinMid, "skin");
  g.ellipse(cx + 2, topY + 12, 4.2, 4.4, skinHi, "skin");
  g.rect(cx + 3, topY + 12, 3, 3, LIAM_PAL.eyeLash, "skin");
  g.set(cx + 3, topY + 12, LIAM_PAL.white, "skin");
  g.rect(cx + 4, topY + 16, 2, 1, LIAM_PAL.mouth, "skin");
  // EMS cap (Pearl white w/ navy visor for Lead; Navy w/ gold Star of Life for Partner!)
  g.ellipse(cx - 1, topY + 7, 7.6, 4.4, variant === 0 ? "#f5f8fc" : "#1c365c", "cap");
  g.rect(cx - 7, topY + 9, 15, 2, "#1c365c", "cap");
  g.rect(cx + 4, topY + 9, 8, 2, "#1c365c", "cap");
  g.rect(cx + 1, topY + 6, 3, 3, "#2b6ec9", "kippah");
  g.set(cx + 2, topY + 7, "#f4d35e", "kippah");

  g.applySelOut({ ...LIAM_SELOUT, orange: "#3d4a08" });
  return g.toCanvas(0.5, { cx: 23, cy: 50, rx: 10.5, ry: 3.2 });
}

function bake32BitEmtKneelRight(variant = 0) {
  const g = new PixelGrid(46, 54);
  const cx = 22;
  const topY = 9; // Lower crouched triage posture!

  // Kneeling navy EMS trousers & braced boots on asphalt
  g.rect(cx - 7, topY + 34, 12, 5, "#1e2e4a", "pants");
  g.rect(cx - 9, topY + 35, 5, 5, "#181a22", "shoe");
  g.rect(cx + 2, topY + 31, 6, 8, "#2a4066", "pants");
  g.rect(cx + 4, topY + 37, 7, 4, "#181a22", "shoe");
  // Leaning hi-vis neon vest torso
  g.rect(cx - 5, topY + 21, 13, 12, "#203659", "polo");
  g.rect(cx - 4, topY + 22, 11, 10, "#d9f029", "orange");
  g.rect(cx - 4, topY + 24, 11, 2, "#f0f8ff", "jersey");
  g.rect(cx - 4, topY + 28, 11, 2, "#f0f8ff", "jersey");
  // Outstretched gloved hands gently tending / placing band-aid on Liam!
  g.line(cx + 5, topY + 25, cx + 13, topY + 30, "#203659", "polo");
  g.line(cx + 5, topY + 26, cx + 13, topY + 31, "#203659", "polo");
  g.rect(cx + 12, topY + 29, 5, 4, "#7cd6ff", "kippah");
  g.rect(cx + 14, topY + 30, 3, 2, "#fff5db", "jersey"); // Band-aid in hand!
  // Open red trauma bag sitting right beside the kneeling EMT!
  if (variant === 1) {
    g.rect(cx - 14, topY + 32, 8, 7, "#d92820", "orange");
    g.rect(cx - 13, topY + 33, 6, 2, "#ff685e", "orange");
    g.rect(cx - 11, topY + 35, 3, 2, "#ffffff", "jersey");
  }
  // Focused Head & EMS Cap
  const skinMid = variant === 1 ? "#d49a6a" : LIAM_PAL.skinMid;
  const skinHi = variant === 1 ? "#ebb486" : LIAM_PAL.skinHi;
  g.ellipse(cx + 1, topY + 13, 7.0, 7.0, skinMid, "skin");
  g.ellipse(cx + 3, topY + 12, 4.0, 4.2, skinHi, "skin");
  g.rect(cx + 4, topY + 12, 3, 3, LIAM_PAL.eyeLash, "skin");
  g.set(cx + 4, topY + 12, LIAM_PAL.white, "skin");
  g.ellipse(cx, topY + 7, 7.4, 4.2, variant === 0 ? "#f5f8fc" : "#1c365c", "cap");
  g.rect(cx - 6, topY + 9, 15, 2, "#1c365c", "cap");
  g.rect(cx + 5, topY + 9, 7, 2, "#1c365c", "cap");
  g.rect(cx + 2, topY + 6, 3, 3, "#2b6ec9", "kippah");
  g.set(cx + 3, topY + 7, "#f4d35e", "kippah");

  g.applySelOut({ ...LIAM_SELOUT, orange: "#3d4a08" });
  return g.toCanvas(0.5, { cx: 22, cy: 50, rx: 12, ry: 3.2 });
}

function bake32BitEmtStretcher(withPatient = true) {
  const g = new PixelGrid(62, 40);
  // Hydraulic Chrome X-Frame Gurney Legs & Heavy Swivel Castors!
  g.rect(10, 24, 3, 11, "#cfd8e3", "scooter");
  g.rect(49, 24, 3, 11, "#cfd8e3", "scooter");
  g.line(11, 25, 50, 34, "#9aa5b5", "scooter");
  g.line(50, 25, 11, 34, "#9aa5b5", "scooter");
  g.line(12, 25, 51, 34, "#e6edf5", "scooter");
  g.ellipse(11, 35, 3.2, 3.2, "#1d2029", "shoe");
  g.set(11, 35, "#cfd8e3", "scooter");
  g.ellipse(50, 35, 3.2, 3.2, "#1d2029", "shoe");
  g.set(50, 35, "#cfd8e3", "scooter");
  // Bright orange/crimson EMS rescue gurney mattress & gleaming raised chrome safety rails!
  g.rect(5, 20, 52, 5, "#e04628", "orange");
  g.rect(6, 20, 50, 2, "#ff7854", "orange");
  g.rect(7, 16, 48, 2, "#eef5fc", "scooter");
  g.rect(12, 17, 2, 4, "#cfd8e3", "scooter");
  g.rect(48, 17, 2, 4, "#cfd8e3", "scooter");
  // Portable EMS mini-monitor mounted at foot of stretcher
  g.rect(49, 12, 7, 6, "#242c3a", "cap");
  g.rect(50, 13, 5, 4, "#42f58d", "kippah");
  // Cozy white pillow & sky-blue EMS thermal blanket with crimson medical cross
  g.rect(8, 15, 11, 5, "#ffffff", "jersey");
  g.rect(19, 16, 30, 5, "#3a85d4", "polo");
  g.rect(20, 16, 28, 2, "#6ab3f5", "polo");
  g.rect(31, 17, 6, 3, "#e02820", "orange");
  g.rect(33, 16, 2, 5, "#e02820", "orange");
  if (withPatient) {
    // Liam tucked safely on the pillow with light-brown hair & crisp forehead band-aid!
    g.ellipse(14, 13, 5.4, 4.8, LIAM_PAL.skinMid, "skin");
    g.ellipse(15, 12.5, 3.2, 3.0, LIAM_PAL.skinHi, "skin");
    g.ellipse(13, 10.5, 5.4, 2.8, LIAM_PAL.hairMid, "hair");
    g.rect(15, 12, 2, 1, LIAM_PAL.eyeLash, "skin");
    g.rect(12, 11, 4, 2, "#fff5db", "jersey");
    g.set(13, 11, "#e63946", "orange");
  }
  g.applySelOut(LIAM_SELOUT);
  return g.toCanvas(0.5, { cx: 31, cy: 36, rx: 24, ry: 3.2 });
}

function bake32BitPoliceOfficerRight(step = 0) {
  const g = new PixelGrid(46, 54);
  const cx = 23;
  const topY = 3 + (step === 1 ? -1 : 0);
  const stride = step === 1 ? 3 : -2;

  // Dark navy Newton Police dress trousers + polished black patrol boots
  g.rect(cx - 4 - stride, topY + 33, 5, 11, "#18243b", "pants");
  g.rect(cx - 5 - stride, topY + 43, 7, 4, "#12141c", "shoe");
  g.rect(cx + 1 + stride, topY + 33, 5, 11, "#223354", "pants");
  g.rect(cx + stride, topY + 43, 7, 4, "#12141c", "shoe");

  // Crisp navy Police uniform shirt, shoulder patch, utility belt & gleaming gold shield badge!
  g.rect(cx - 6, topY + 21, 13, 13, "#1d3154", "polo");
  g.rect(cx - 4, topY + 22, 9, 9, "#2a4575", "polo");
  g.rect(cx - 6, topY + 31, 13, 3, "#151720", "cap"); // Black leather utility belt
  g.rect(cx, topY + 31, 3, 3, "#f4d35e", "orange");   // Brass buckle
  g.rect(cx + 2, topY + 24, 3, 3, "#f4d35e", "orange"); // Gold police chest shield!
  g.set(cx + 3, topY + 25, "#fff6b8", "orange");
  // Crisp white shirt collar & navy tie
  g.rect(cx - 1, topY + 21, 4, 2, "#f0f5fa", "jersey");
  // Outstretched arm holding a bright yellow CAUTION tape roll & traffic wand!
  g.rect(cx + 4, topY + 24, 7, 4, "#1d3154", "polo");
  g.rect(cx + 10, topY + 24, 3, 4, LIAM_PAL.skinMid, "skin");
  // Glowing yellow/black CAUTION tape spool held in hand!
  g.ellipse(cx + 14, topY + 25, 3.2, 3.2, "#ffd92e", "orange");
  g.ellipse(cx + 14, topY + 25, 1.5, 1.5, "#1a1c24", "cap");

  // Sculpted 32-bit Head + aviator shades + Peaked Navy Police Cap with gold shield!
  g.ellipse(cx, topY + 13, 7.2, 7.2, LIAM_PAL.skinMid, "skin");
  g.ellipse(cx + 2, topY + 12, 4.2, 4.4, LIAM_PAL.skinHi, "skin");
  g.rect(cx + 2, topY + 12, 5, 2, "#141824", "cap"); // Officer aviator shades!
  g.rect(cx + 3, topY + 12, 2, 1, "#7cc4f5", "kippah");
  g.rect(cx + 4, topY + 16, 2, 1, LIAM_PAL.mouth, "skin");
  // Classic peaked navy Police cap with shiny black bill & gold shield!
  g.ellipse(cx - 1, topY + 6.5, 8.0, 4.4, "#1a2d4f", "cap");
  g.rect(cx - 8, topY + 8, 16, 2, "#121724", "cap");
  g.rect(cx + 4, topY + 9, 8, 2, "#121724", "cap");
  g.rect(cx + 2, topY + 5, 3, 3, "#f4d35e", "orange");
  g.set(cx + 3, topY + 6, "#fff6b8", "orange");

  g.applySelOut({ ...LIAM_SELOUT, orange: "#4a3206" });
  return g.toCanvas(0.5, { cx: 23, cy: 50, rx: 10.5, ry: 3.2 });
}

function bake32BitTrafficCone() {
  const g = new PixelGrid(18, 22);
  // Weighted dark rubber octagonal base
  g.rect(2, 16, 14, 4, "#242834", "shoe");
  g.rect(3, 15, 12, 2, "#393f52", "shoe");
  // Bright fluorescent orange cone body with crisp reflective white collar bands!
  for (let row = 0; row < 12; row++) {
    const half = Math.max(1, Math.round(1 + (row / 11) * 4.5));
    const isStripe = row === 4 || row === 5 || row === 8;
    const col = isStripe ? "#f5f9ff" : row % 2 === 0 ? "#ff681f" : "#eb4d14";
    g.rect(9 - half, 4 + row, half * 2, 1, col, isStripe ? "jersey" : "orange");
    if (!isStripe && half >= 2) g.set(9 - half + 1, 4 + row, "#ff9c47", "orange");
  }
  g.applySelOut({ ...LIAM_SELOUT, orange: "#591b06" });
  return g.toCanvas(0.5, { cx: 9, cy: 19, rx: 7.5, ry: 2.2 });
}

function bake32BitRoadFlare(frame = 0) {
  const g = new PixelGrid(18, 18);
  // Red cylindrical highway safety flare lying on asphalt
  g.rect(2, 11, 9, 4, "#c9241e", "orange");
  g.rect(3, 11, 7, 2, "#ff5c4d", "orange");
  g.rect(4, 11, 2, 4, "#f4d35e", "orange");
  // Sizzling crimson-orange & white burning sparks shooting out of tip!
  const f = frame === 0 ? 0 : 1;
  g.ellipse(12, 12, 3.2 + f * 0.6, 3.2 + f * 0.6, "#ff3b2e", "orange");
  g.ellipse(12, 12, 2.0, 2.0, "#ffcf4d", "orange");
  g.rect(11, 11, 2, 2, "#ffffff", "jersey");
  g.set(14 + f, 8 - f, "#fff6b8", "orange");
  g.set(10, 7 + f, "#ff7854", "orange");
  g.set(15, 13 - f, "#ffcf4d", "orange");
  g.applySelOut({ ...LIAM_SELOUT, orange: "#5c120d" });
  return g.toCanvas(0.5, { cx: 9, cy: 15, rx: 7, ry: 2.2 });
}

/**
 * Bake all 32-bit street-life sprites (roving turkeys, annoying protestors, spooky graveyard characters, EMTs, police & crisp pixel speech bubbles).
 */
export function bake32BitStreetLifeSprites(chants = [], opts = {}) {
  const out = {};
  const biomeConfig = opts.biomeConfig || null;
  const season = opts.season || "fall";
  const protestorStyle = resolveProtestorOutfitStyle(biomeConfig, season);

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

  // Wild Newton Squirrels
  const sqR0 = bake32BitSquirrelRight(0, false);
  const sqR1 = bake32BitSquirrelRight(1, false);
  const sqAlertR = bake32BitSquirrelRight(0, true);
  out.squirrel_right_0 = sqR0;
  out.squirrel_right_1 = sqR1;
  out.squirrel_left_0 = mirrorCanvasHorizontal(sqR0);
  out.squirrel_left_1 = mirrorCanvasHorizontal(sqR1);
  out.squirrel_alert_right = sqAlertR;
  out.squirrel_alert_left = mirrorCanvasHorizontal(sqAlertR);

  // Prowling Neighborhood Cats (2 coat variants)
  for (let cv = 0; cv < 2; cv++) {
    const cR0 = bake32BitCatRight(cv, 0, false);
    const cR1 = bake32BitCatRight(cv, 1, false);
    const cAlertR = bake32BitCatRight(cv, 0, true);
    out[`cat_${cv}_right_0`] = cR0;
    out[`cat_${cv}_right_1`] = cR1;
    out[`cat_${cv}_left_0`] = mirrorCanvasHorizontal(cR0);
    out[`cat_${cv}_left_1`] = mirrorCanvasHorizontal(cR1);
    out[`cat_${cv}_alert_right`] = cAlertR;
    out[`cat_${cv}_alert_left`] = mirrorCanvasHorizontal(cAlertR);
  }

  // Runaway Dogs with Trailing Leashes (2 breed variants)
  for (let dv = 0; dv < 2; dv++) {
    const dR0 = bake32BitDogRight(dv, 0, false);
    const dR1 = bake32BitDogRight(dv, 1, false);
    const dAlertR = bake32BitDogRight(dv, 0, true);
    out[`dog_${dv}_right_0`] = dR0;
    out[`dog_${dv}_right_1`] = dR1;
    out[`dog_${dv}_left_0`] = mirrorCanvasHorizontal(dR0);
    out[`dog_${dv}_left_1`] = mirrorCanvasHorizontal(dR1);
    out[`dog_${dv}_alert_right`] = dAlertR;
    out[`dog_${dv}_alert_left`] = mirrorCanvasHorizontal(dAlertR);
  }

  // Regional 32-Bit Wildlife Species (Israel Parakeet & Rock Hyrax, Tundra Arctic Fox, Desert Roadrunner, Europe Red Fox!)
  for (const [kind, baker] of [
    ["parakeet", (f, a) => bake32BitParakeetRight(f, a)],
    ["hyrax", (f, a) => bake32BitHyraxRight(f, a)],
    ["arctic_fox", (f, a) => bake32BitFoxRight("arctic", f, a)],
    ["red_fox", (f, a) => bake32BitFoxRight("red", f, a)],
    ["roadrunner", (f, a) => bake32BitRoadrunnerRight(f, a)],
  ]) {
    const r0 = baker(0, false);
    const r1 = baker(1, false);
    const al = baker(0, true);
    out[`${kind}_right_0`] = r0;
    out[`${kind}_right_1`] = r1;
    out[`${kind}_left_0`] = mirrorCanvasHorizontal(r0);
    out[`${kind}_left_1`] = mirrorCanvasHorizontal(r1);
    out[`${kind}_alert_right`] = al;
    out[`${kind}_alert_left`] = mirrorCanvasHorizontal(al);
  }

  // 3 Sidewalk Protestor variants (waving signs & shouting into megaphones, dressed in biome-specific outfits!)
  for (let v = 0; v < 3; v++) {
    const pR0 = bake32BitProtestorRight(v, 0, protestorStyle);
    const pR1 = bake32BitProtestorRight(v, 1, protestorStyle);
    out[`protestor_${v}_right_0`] = pR0;
    out[`protestor_${v}_right_1`] = pR1;
    out[`protestor_${v}_left_0`] = mirrorCanvasHorizontal(pR0);
    out[`protestor_${v}_left_1`] = mirrorCanvasHorizontal(pR1);
  }

  // 3 Spooky Graveyard Character archetypes (Skeleton, Phantom, Pumpkin Ghoul — walk + attack/lunge!)
  const spookyBakers = [
    ["skeleton", bake32BitSkeletonRight],
    ["phantom", bake32BitPhantomRight],
    ["pumpkin_ghoul", bake32BitPumpkinGhoulRight],
  ];
  for (const [kind, baker] of spookyBakers) {
    const r0 = baker(0);
    const r1 = baker(1);
    const rAtk = baker(2);
    out[`spooky_${kind}_right_0`] = r0;
    out[`spooky_${kind}_right_1`] = r1;
    out[`spooky_${kind}_attack_right`] = rAtk;
    out[`spooky_${kind}_left_0`] = mirrorCanvasHorizontal(r0);
    out[`spooky_${kind}_left_1`] = mirrorCanvasHorizontal(r1);
    out[`spooky_${kind}_attack_left`] = mirrorCanvasHorizontal(rAtk);
  }

  // 32-bit Newton EMS EMT Paramedics (2 distinct variants + kneeling triage pose!) & Hydraulic Stretcher!
  const emtR0 = bake32BitEmtRight(0, 0);
  const emtR1 = bake32BitEmtRight(1, 0);
  const emt1R0 = bake32BitEmtRight(0, 1);
  const emt1R1 = bake32BitEmtRight(1, 1);
  const emtKR0 = bake32BitEmtKneelRight(0);
  const emtKR1 = bake32BitEmtKneelRight(1);
  out.emt_right_0 = emtR0;
  out.emt_right_1 = emtR1;
  out.emt_left_0 = mirrorCanvasHorizontal(emtR0);
  out.emt_left_1 = mirrorCanvasHorizontal(emtR1);
  out.emt_1_right_0 = emt1R0;
  out.emt_1_right_1 = emt1R1;
  out.emt_1_left_0 = mirrorCanvasHorizontal(emt1R0);
  out.emt_1_left_1 = mirrorCanvasHorizontal(emt1R1);
  out.emt_kneel_right = emtKR0;
  out.emt_kneel_left = mirrorCanvasHorizontal(emtKR0);
  out.emt_kneel_1_right = emtKR1;
  out.emt_kneel_1_left = mirrorCanvasHorizontal(emtKR1);
  out.emt_stretcher_empty = bake32BitEmtStretcher(false);
  out.emt_stretcher_patient = bake32BitEmtStretcher(true);

  // 32-bit Newton Police Officers, Reflective Traffic Cones & Sizzling Road Flares!
  const polR0 = bake32BitPoliceOfficerRight(0);
  const polR1 = bake32BitPoliceOfficerRight(1);
  out.police_officer_right_0 = polR0;
  out.police_officer_right_1 = polR1;
  out.police_officer_left_0 = mirrorCanvasHorizontal(polR0);
  out.police_officer_left_1 = mirrorCanvasHorizontal(polR1);
  out.traffic_cone = bake32BitTrafficCone();
  out.road_flare_0 = bake32BitRoadFlare(0);
  out.road_flare_1 = bake32BitRoadFlare(1);

  // 32-Bit Hero-Grade Animated Annoying Newton Runners / Joggers
  // (3 ultra-detailed sculpted athletic outfits x 4 fluid stride frames x left/right — zero boxy rectangles!)
  const JOGGER_STYLES = [
    {
      // 0: Hi-Vis Neon Coral/Lime Marathoner w/ Ponytail, Oakley Shades & Hydration Belt!
      skin: ["#ffe0bd", "#f2bc91", "#c98b63"],
      hair: ["#5c361c", "#8c542d", "#2e180c"],
      top: ["#ff7861", "#e63b2e", "#991b16"],
      stripe: "#eaff54",
      shorts: ["#1e355e", "#122140"],
      shoe: ["#38e8b0", "#ffffff", "#ff477e"],
      band: "#eaff54",
      shades: "#14e8ff",
      ponytail: true,
      visor: false,
    },
    {
      // 1: Boston Marathon Royal-Blue & Gold Singlet (#26 bib, red sweatband, wraparound shades!)
      skin: ["#e3b084", "#c48a5e", "#8f5b38"],
      hair: ["#241c1a", "#3d302c", "#140f0e"],
      top: ["#54a8ff", "#2167c4", "#123e80"],
      stripe: "#ffd43b",
      shorts: ["#1c2230", "#0f131c"],
      shoe: ["#ffd242", "#ffffff", "#246bc2"],
      band: "#ff4d3d",
      shades: "#ff9d2e",
      ponytail: false,
      visor: true,
    },
    {
      // 2: Electric Mint-Teal Compression Half-Zip & Aero Visor (Comm Ave Strava Segment Hunter!)
      skin: ["#f7cfb0", "#deb08a", "#b07f5b"],
      hair: ["#c78936", "#ebad54", "#7d4f16"],
      top: ["#63f0cf", "#23a88e", "#126656"],
      stripe: "#ffffff",
      shorts: ["#2e3547", "#181d29"],
      shoe: ["#ff6ca8", "#ffffff", "#ffe042"],
      band: "#ff5c8a",
      shades: "#c6ff42",
      ponytail: true,
      visor: true,
    },
  ];

  // Helper to paint a smooth rounded limb segment (thick line with circular joints -> natural anatomy!)
  const drawLimb = (g, x0, y0, x1, y1, radius, color, mat) => {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(2, Math.ceil(dist * 1.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      g.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, radius, radius, color, mat);
    }
  };

  // Sculpted carbon-plated super-shoe with rocker sole, heel cup & bright swoosh accent!
  const drawRunningShoe = (g, x, y, tiltDeg, style) => {
    const rad = (tiltDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rot = (lx, ly) => [x + lx * cos - ly * sin, y + lx * sin + ly * cos];
    // Upper mesh body
    for (const [lx, ly, rx, ry, col] of [
      [-1.5, -1.2, 2.6, 1.9, style.shoe[0]],
      [1.8, -0.6, 2.7, 1.7, style.shoe[0]],
      [3.8, -0.1, 1.8, 1.3, style.shoe[0]],
      [0.6, -1.0, 1.6, 0.8, style.shoe[2]], // bright racing stripe!
      [-1.5, 0.9, 2.4, 1.1, style.shoe[1]], // thick cushioned white rocker foam!
      [1.8, 1.1, 2.8, 1.1, style.shoe[1]],
      [4.2, 0.6, 1.6, 0.9, style.shoe[1]],
    ]) {
      const [px, py] = rot(lx, ly);
      g.ellipse(px, py, rx, ry, col, "shoe");
    }
  };

  const bake32BitJoggerRight = (style, frame) => {
    const w = 50;
    const h = 60;
    const g = new PixelGrid(w, h);
    // 4-beat smooth athletic sprint cycle:
    //   0: Right knee high drive, left leg extended back (flight peak!)
    //   1: Mid-stance transition (legs crossing, body slightly lower)
    //   2: Left knee high drive, right leg pushing off back (flight peak!)
    //   3: Opposite mid-stance transition
    const phases = [
      {
        bob: -3, lean: 2.2,
        fKnee: [5, 39], fFoot: [9, 47], fTilt: -14,
        bKnee: [-4, 41], bFoot: [-11, 46], bTilt: 32,
        fElbow: [-4, 28], fHand: [4, 25],
        bElbow: [7, 26], bHand: [12, 20],
        ponyWag: -2, mouthOpen: true,
      },
      {
        bob: 0, lean: 1.5,
        fKnee: [2, 41], fFoot: [1, 50], fTilt: 0,
        bKnee: [-1, 41], bFoot: [-3, 49], bTilt: 12,
        fElbow: [1, 29], fHand: [7, 25],
        bElbow: [0, 28], bHand: [5, 24],
        ponyWag: 0, mouthOpen: false,
      },
      {
        bob: -3, lean: 2.2,
        fKnee: [-4, 41], fFoot: [-10, 46], fTilt: 30,
        bKnee: [6, 39], bFoot: [10, 47], bTilt: -15,
        fElbow: [7, 26], fHand: [12, 20],
        bElbow: [-4, 28], bHand: [3, 25],
        ponyWag: 2, mouthOpen: true,
      },
      {
        bob: 0, lean: 1.5,
        fKnee: [-1, 41], fFoot: [-3, 49], fTilt: 10,
        bKnee: [2, 41], bFoot: [2, 50], bTilt: 0,
        fElbow: [0, 28], fHand: [6, 24],
        bElbow: [2, 29], bHand: [8, 25],
        ponyWag: 1, mouthOpen: false,
      },
    ];
    const p = phases[frame % 4];
    const cx = 24;
    const hipX = cx - 1;
    const hipY = 34 + p.bob;
    const shX = cx + p.lean;
    const shY = 21 + p.bob;

    // 1. Back pumping arm (behind torso)
    drawLimb(g, shX - 1, shY + 1, cx + p.bElbow[0], p.bElbow[1] + p.bob, 1.8, style.skin[2], "skin");
    drawLimb(g, cx + p.bElbow[0], p.bElbow[1] + p.bob, cx + p.bHand[0], p.bHand[1] + p.bob, 1.6, style.skin[1], "skin");

    // 2. Back running leg (curved thigh -> bent knee -> sculpted calf -> carbon shoe!)
    drawLimb(g, hipX - 1, hipY, cx + p.bKnee[0], p.bKnee[1] + p.bob, 2.5, style.shorts[1], "shorts");
    drawLimb(g, cx + p.bKnee[0], p.bKnee[1] + p.bob, cx + p.bFoot[0], p.bFoot[1] + p.bob, 2.0, style.skin[2], "skin");
    drawRunningShoe(g, cx + p.bFoot[0], p.bFoot[1] + p.bob + 1, p.bTilt, style);

    // 3. Athletic shorts pelvis (sculpted rounded hips, zero boxy block!)
    g.ellipse(hipX, hipY, 5.2, 3.6, style.shorts[0], "shorts");
    g.ellipse(hipX - 1, hipY + 1.4, 4.4, 2.4, style.shorts[1], "shorts");
    // Tiny side athletic stripe on shorts
    g.rect(hipX, hipY - 1, 2, 3, style.stripe, "shorts");

    // 4. Sculpted Forward-Leaning Athletic Torso (tapered shoulder -> athletic chest -> narrow waist!)
    drawLimb(g, hipX, hipY - 1, shX, shY, 4.4, style.top[1], "top");
    g.ellipse(shX + 1.2, shY + 2.5, 4.8, 5.2, style.top[1], "top");
    g.ellipse(shX + 2.0, shY + 1.2, 3.4, 4.0, style.top[0], "top"); // sunlit chest highlight
    g.ellipse(shX - 2.4, shY + 4.5, 2.6, 3.8, style.top[2], "top"); // back torso shading
    // Diagonal racing singlet stripe + pinned marathon race bib!
    g.line(shX - 2, shY + 1, shX + 3, shY + 7, style.stripe, "top");
    g.rect(shX - 0.5, shY + 3.5, 5, 4, "#ffffff", "bib");
    g.rect(shX + 0.5, shY + 5, 3, 1, "#223354", "bib");
    // Hydration fuel belt + mini water flask clipped at waist!
    g.ellipse(hipX - 0.5, hipY - 2.2, 5.0, 1.4, "#242834", "shorts");
    g.rect(hipX - 5, hipY - 4, 2, 3, "#54d9ff", "band");

    // 5. Front driving leg (powerful forward thigh -> bent knee -> sunlit calf -> neon super-shoe!)
    drawLimb(g, hipX + 1, hipY, cx + p.fKnee[0], p.fKnee[1] + p.bob, 2.7, style.shorts[0], "shorts");
    drawLimb(g, cx + p.fKnee[0], p.fKnee[1] + p.bob, cx + p.fFoot[0], p.fFoot[1] + p.bob, 2.1, style.skin[0], "skin");
    g.set(cx + p.fKnee[0] + 1, p.fKnee[1] + p.bob, style.skin[0], "skin");
    // White athletic ankle sock cuff
    g.ellipse(cx + p.fFoot[0] - 0.5, p.fFoot[1] + p.bob - 1.5, 1.9, 1.4, "#ffffff", "bib");
    drawRunningShoe(g, cx + p.fFoot[0], p.fFoot[1] + p.bob + 1, p.fTilt, style);

    // 6. Front pumping bent arm + glowing GPS Strava smartwatch on wrist!
    g.ellipse(shX + 0.5, shY + 1, 2.8, 2.5, style.top[0], "top"); // sculpted shoulder cap
    drawLimb(g, shX, shY + 2, cx + p.fElbow[0], p.fElbow[1] + p.bob, 2.0, style.skin[1], "skin");
    drawLimb(g, cx + p.fElbow[0], p.fElbow[1] + p.bob, cx + p.fHand[0], p.fHand[1] + p.bob, 1.8, style.skin[0], "skin");
    // Glowing cyan GPS sports watch!
    g.rect(cx + p.fHand[0] - 2, p.fHand[1] + p.bob - 1, 2, 2, "#1c2230", "eye");
    g.set(cx + p.fHand[0] - 1, p.fHand[1] + p.bob - 1, "#4ef5ff", "band");

    // 7. Neck & Expressive Sculpted 32-Bit Head (contoured jaw, hair/ponytail, wraparound shades, shouting mouth!)
    const headX = shX + 1.8;
    const headY = 12 + p.bob;
    g.rect(shX + 0.5, headY + 4, 3, 4, style.skin[1], "skin"); // neck
    g.ellipse(headX, headY, 5.8, 6.2, style.skin[0], "skin");
    g.ellipse(headX - 1.5, headY + 2.2, 4.0, 3.4, style.skin[1], "skin"); // jaw contour shadow
    g.ellipse(headX + 2.2, headY - 0.5, 3.2, 3.6, style.skin[0], "skin"); // sunlit cheek/brow
    g.set(headX + 5.8, headY + 0.5, style.skin[0], "skin"); // cute side nose profile!

    // Flowing wind-blown hair + bouncing ponytail + fluttering headband tails!
    g.ellipse(headX - 1.0, headY - 4.2, 6.0, 3.6, style.hair[0], "hair");
    g.ellipse(headX - 0.2, headY - 5.2, 4.0, 2.0, style.hair[1], "hair");
    g.ellipse(headX - 4.8, headY - 1.5, 2.4, 3.2, style.hair[0], "hair");
    if (style.ponytail) {
      drawLimb(g, headX - 6, headY - 2, headX - 12, headY + p.ponyWag, 2.3, style.hair[0], "hair");
      g.ellipse(headX - 10, headY - 1 + p.ponyWag, 2.2, 1.4, style.hair[1], "hair");
    }
    // Crisp athletic sweatband + fluttering tails behind head!
    g.rect(headX - 5.5, headY - 3.2, 11.5, 2.2, style.band, "band");
    drawLimb(g, headX - 6, headY - 2.5, headX - 10, headY - 4 + p.ponyWag * 0.6, 1.0, style.band, "band");
    if (style.visor) {
      // Sleek marathon sun-visor bill jutting forward!
      g.rect(headX + 2, headY - 3.8, 7, 2, style.band, "band");
      g.rect(headX + 3, headY - 2.2, 5, 1, "#242836", "eye");
    }

    // Wraparound mirrored neon sports sunglasses (classic annoying Strava runner look!)
    g.rect(headX + 0.5, headY - 1.2, 5.8, 2.4, "#151924", "eye");
    g.rect(headX + 1.5, headY - 0.8, 4.2, 1.5, style.shades, "band");
    g.set(headX + 4.5, headY - 0.8, "#ffffff", "bib"); // lens glint!

    // Expressive shouting/huffing mouth!
    if (p.mouthOpen) {
      g.ellipse(headX + 3.8, headY + 3.2, 1.6, 1.5, "#6b1c24", "eye");
      g.set(headX + 4.2, headY + 2.4, "#ffffff", "bib");
    } else {
      g.rect(headX + 3.0, headY + 3.2, 2.5, 1, "#9c4b3b", "skin");
    }

    // Tiny flying sweat droplet on sprint peak frames!
    if (frame === 0 || frame === 2) {
      g.ellipse(headX - 7.5, headY - 6, 1.2, 1.4, "#80e8ff", "band");
    }

    g.applySelOut({
      skin: "#6e3d24",
      hair: style.hair[2],
      top: style.top[2],
      shorts: "#101420",
      shoe: "#181d2b",
      band: "#2b3847",
      bib: "#4d5970",
      eye: "#14161f",
    });
    return {
      right: g.toCanvas(0.5, { cx, cy: 54, rx: 10.5, ry: 2.8 }),
      left: g.flipHorizontal().toCanvas(0.5, { cx, cy: 54, rx: 10.5, ry: 2.8 }),
    };
  };
  JOGGER_STYLES.forEach((st, idx) => {
    for (let frame = 0; frame < 4; frame++) {
      const pair = bake32BitJoggerRight(st, frame);
      out[`jogger_${idx}_right_${frame}`] = pair.right;
      out[`jogger_${idx}_left_${frame}`] = pair.left;
    }
  });

  // Crisp 32-bit pixel speech bubbles!
  out.bubble_jogger_0 = bakePixelSpeechBubble("ON YOUR LEFT!!", {
    bg: "#f4ffcf",
    accent: "#d93820",
    textColor: "#2e1a06",
  });
  out.bubble_jogger_1 = bakePixelSpeechBubble("TRACK!! MOVE IT!!", {
    bg: "#fff0d1",
    accent: "#e05b19",
    textColor: "#3b1705",
  });
  out.bubble_jogger_2 = bakePixelSpeechBubble("SUB-3 MARATHON PACE!", {
    bg: "#e6f8ff",
    accent: "#1c72d9",
    textColor: "#0e2647",
  });
  out.bubble_jogger_3 = bakePixelSpeechBubble("DON'T BREAK MY STRIDE!", {
    bg: "#ffe8f2",
    accent: "#d92b70",
    textColor: "#420d22",
  });
  out.bubble_jogger_4 = bakePixelSpeechBubble("STRAVA SEGMENT PR!!", {
    bg: "#fff4cc",
    accent: "#fc4c02",
    textColor: "#381604",
  });
  out.bubble_jogger_whoa = bakePixelSpeechBubble("WHOA! NICE PACE!", {
    bg: "#e6fbff",
    accent: "#1ea8d9",
    textColor: "#0e2f47",
  });
  out.bubble_whoa = bakePixelSpeechBubble("WHOA!!", {
    bg: "#fff4d1",
    accent: "#e67e22",
    textColor: "#421d08",
  });
  const heroLabel = String(opts.heroName || "LIAM").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, 8) || "EXPLORER";
  const cityLabel = String(opts.cityShort || "NEWTON").toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, 8) || "TOWN";
  out.bubble_npc_hi = bakePixelSpeechBubble(`HI ${heroLabel}!`, {
    bg: "#fff9e0",
    accent: "#2e9c5e",
    textColor: "#143822",
  });
  out.bubble_npc_yay = bakePixelSpeechBubble("AWESOME!", {
    bg: "#fff6cc",
    accent: "#e09f24",
    textColor: "#3d2406",
  });
  out.bubble_animal_yum = bakePixelSpeechBubble("YUM! *MUNCH*", {
    bg: "#ebfff0",
    accent: "#289c52",
    textColor: "#123b20",
  });
  out.bubble_too_bright = bakePixelSpeechBubble("TOO BRIGHT!!", {
    bg: "#e6fbff",
    accent: "#26a8d9",
    textColor: "#10394f",
  });
  out.bubble_gobble = bakePixelSpeechBubble("GOBBLE!", {
    bg: "#fff6db",
    accent: "#cf2b26",
    textColor: "#4a1912",
  });
  out.bubble_chitter = bakePixelSpeechBubble("CHITTER!", {
    bg: "#fff6de",
    accent: "#b56724",
    textColor: "#42240c",
  });
  out.bubble_meow = bakePixelSpeechBubble("MEOW!", {
    bg: "#f7ecff",
    accent: "#9948bd",
    textColor: "#331447",
  });
  out.bubble_woof = bakePixelSpeechBubble("WOOF!", {
    bg: "#e8f6ff",
    accent: "#d9382e",
    textColor: "#1a2845",
  });
  out.bubble_squawk = bakePixelSpeechBubble("SQUAWK!", {
    bg: "#eaffea",
    accent: "#2ea83b",
    textColor: "#123b18",
  });
  out.bubble_squeak = bakePixelSpeechBubble("SQUEAK!", {
    bg: "#fff6e3",
    accent: "#a67d56",
    textColor: "#3b2614",
  });
  out.bubble_yip = bakePixelSpeechBubble("YIP YIP!", {
    bg: "#eef7ff",
    accent: "#3a8ee6",
    textColor: "#142c4a",
  });
  out.bubble_meep = bakePixelSpeechBubble("MEEP MEEP!", {
    bg: "#fff0d6",
    accent: "#cf7a2b",
    textColor: "#42200a",
  });
  out.bubble_watch_sign = bakePixelSpeechBubble("GOT ANY SNACKS?", {
    bg: "#fff6db",
    accent: "#d97a26",
    textColor: "#291a18",
  });
  out.bubble_mob_block = bakePixelSpeechBubble("HUNGRY MARCHERS!", {
    bg: "#fff3d6",
    accent: "#d97a26",
    textColor: "#3b220c",
  });
  out.bubble_want_snack = bakePixelSpeechBubble("SNACK PLEASE?", {
    bg: "#fff7db",
    accent: "#e08b26",
    textColor: "#3b220c",
  });
  out.bubble_snack_thanks = bakePixelSpeechBubble("YUM! THANKS!", {
    bg: "#e8fff0",
    accent: "#248c52",
    textColor: "#143d25",
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
  out.bubble_emt_help = bakePixelSpeechBubble("HOLD ON, KID!", {
    bg: "#e8f4ff",
    accent: "#d9221c",
    textColor: "#14274a",
  });
  out.bubble_emt_lift = bakePixelSpeechBubble("ALL SET! LIFTING!", {
    bg: "#e8fff0",
    accent: "#228c4e",
    textColor: "#123822",
  });
  out.bubble_police_stop = bakePixelSpeechBubble("SCENE SECURE!", {
    bg: "#e6eeff",
    accent: "#2464bd",
    textColor: "#12244a",
  });
  out.bubble_police_tape = bakePixelSpeechBubble("KEEP BACK! CAUTION!", {
    bg: "#fff7c2",
    accent: "#1a1c24",
    textColor: "#1a1404",
  });
  out.bubble_fire_clear = bakePixelSpeechBubble("FIRE RESCUE HERE!", {
    bg: "#ffebe8",
    accent: "#d9221c",
    textColor: "#4a1210",
  });
  chants.forEach((line, idx) => {
    out[`bubble_protest_${idx}`] = bakePixelSpeechBubble(line, {
      bg: "#fff8eb",
      accent: idx % 2 === 0 ? "#d93b36" : "#24573d",
      textColor: "#291a18",
    });
  });
  const activeBikerChants = Array.isArray(opts.bikerChants) && opts.bikerChants.length > 0 ? opts.bikerChants : BIKER_CHANTS;
  activeBikerChants.forEach((line, idx) => {
    out[`bubble_biker_${idx}`] = bakePixelSpeechBubble(line, {
      bg: "#fbffd1",
      accent: "#d92820",
      textColor: "#241e08",
    });
  });

  return out;
}
