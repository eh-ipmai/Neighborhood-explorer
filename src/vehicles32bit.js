/**
 * 32-Bit Hero-Grade Pixel-Art Vehicle, Truck, Ambulance & Annoying Cyclist Engine
 * (Rendered at 0.5 logical scale on our 640x360 pixel buffer, matching Liam's
 * 32-bit Minish Cap / Metal Slug pixel-art craftsmanship in src/characters.js!)
 *
 * Techniques matching src/characters.js:
 *  - 100% discrete integer PixelGrid buffer (zero anti-aliased vector blur)
 *  - 5-tone hue-shifted metallic/fabric/skin palettes (specular -> hi -> mid -> shade -> deep)
 *  - True 1px Selective Colored Outlining ("sel-out") per material
 *  - Soft pixel-dithered oval ground shadows
 *  - Expressive 32-bit cyclist anatomy (aerodynamic helmet, mirrored wraparound shades,
 *    open shouting mouth, pumping legs, deep-dish carbon wheels with rotating spokes)
 *  - Sculpted cars, SUVs, yellow cab, pickup truck, delivery box trucks & Type-III EMS Ambulance
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

  ellipse(cx, cy, rx, ry, color, mat = "dark") {
    const minX = Math.floor(cx - rx);
    const maxX = Math.ceil(cx + rx);
    const minY = Math.floor(cy - ry);
    const maxY = Math.ceil(cy + ry);
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = (px - cx) / Math.max(0.5, rx);
        const dy = (py - cy) / Math.max(0.5, ry);
        if (dx * dx + dy * dy <= 1.0) this.set(px, py, color, mat);
      }
    }
  }

  ring(cx, cy, rOuter, rInner, color, mat = "tire") {
    const minX = Math.floor(cx - rOuter);
    const maxX = Math.ceil(cx + rOuter);
    const minY = Math.floor(cy - rOuter);
    const maxY = Math.ceil(cy + rOuter);
    const rOut2 = rOuter * rOuter;
    const rIn2 = rInner * rInner;
    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (d2 <= rOut2 && d2 >= rIn2) this.set(px, py, color, mat);
      }
    }
  }

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
        let foundMat = null;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= this.w || ny >= this.h) continue;
          const nIdx = ny * this.w + nx;
          if (origColors[nIdx] !== null) {
            foundMat = origMats[nIdx] || "dark";
            if (foundMat === "tire" || foundMat === "dark") break;
          }
        }
        if (foundMat) {
          this.colors[idx] = outlineMap[foundMat] || outlineMap.dark || "#161822";
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

  toCanvas(pixelScale = 0.5, shadowSpec = null, postDraw = null) {
    const canvas = document.createElement("canvas");
    canvas.width = this.w;
    canvas.height = this.h;
    canvas.__pixelScale = pixelScale;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    if (shadowSpec) {
      const { cx, cy, rx, ry } = shadowSpec;
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const d2 = dx * dx + dy * dy;
          if (d2 <= 0.62) {
            ctx.fillStyle = "rgba(14, 18, 26, 0.44)";
            ctx.fillRect(x, y, 1, 1);
          } else if (d2 <= 1.0 && (x + y) % 2 === 0) {
            ctx.fillStyle = "rgba(14, 18, 26, 0.28)";
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

    if (postDraw) postDraw(ctx);
    return canvas;
  }
}

const BASE_SELOUT = {
  tire: "#12131a",
  chrome: "#363e4d",
  glass: "#142236",
  skin: "#7d482e",
  hair: "#422712",
  jersey: "#363d06",
  helmet: "#5e110d",
  frame: "#5c1110",
  wood: "#4a2a12",
  light: "#6e5210",
  dark: "#161822",
};

/**
 * Draw a sculpted 32-bit automotive wheel with rubber sidewall, metallic alloy rim, spokes & hub!
 */
function draw32BitWheel(g, cx, cy, r = 5.2, caliperColor = "#d9362e") {
  // Deep rubber tire
  g.ellipse(cx, cy, r, r, "#1d2029", "tire");
  g.ellipse(cx, cy - 0.5, r - 0.8, r - 0.8, "#2c3140", "tire");
  // Sculpted silver alloy rim
  const rimR = Math.max(2.4, r - 2.0);
  g.ellipse(cx, cy, rimR, rimR, "#9aa6b8", "chrome");
  g.ellipse(cx - 0.4, cy - 0.4, rimR - 0.8, rimR - 0.8, "#dce6f2", "chrome");
  // Brake caliper peeking behind spokes + dark lug cutouts
  g.set(cx + 1, cy - 1, caliperColor, "chrome");
  g.set(cx - 1, cy + 1, "#4c5666", "chrome");
  g.set(cx + 1, cy + 1, "#4c5666", "chrome");
  // Gleaming specular center hubcap
  g.rect(cx - 0.5, cy - 0.5, 2, 2, "#ffffff", "chrome");
}

// =============================================================================
// 1. 32-BIT HERO-GRADE CARS & SUVs (East/West Side-3/4 + North/South Top-3/4!)
// =============================================================================

const CAR_PALETTES = [
  // 0: Crimson Metallic Sports Sedan
  {
    spec: "#ffb0a6",
    hi: "#f25549",
    mid: "#cf2923",
    shade: "#941816",
    deep: "#5e0e10",
    outline: "#450b0e",
    caliper: "#ffae2b",
    isSuv: false,
    isTaxi: false,
    hasSunroof: true,
  },
  // 1: Cobalt Metallic Family SUV
  {
    spec: "#a8d4ff",
    hi: "#4d91ed",
    mid: "#2662bf",
    shade: "#18428a",
    deep: "#0f2859",
    outline: "#0b1c40",
    caliper: "#dce4ee",
    isSuv: true,
    isTaxi: false,
    hasSunroof: false,
  },
  // 2: Classic Boston/Newton Yellow Cab
  {
    spec: "#fff5a8",
    hi: "#ffd242",
    mid: "#ebb01c",
    shade: "#b57f0e",
    deep: "#785006",
    outline: "#4a3004",
    caliper: "#d9362e",
    isSuv: false,
    isTaxi: true,
    hasSunroof: false,
  },
  // 3: Emerald Metallic Subaru-Style Station Wagon (roof rack!)
  {
    spec: "#a8f2c8",
    hi: "#4fc484",
    mid: "#278c57",
    shade: "#175e3a",
    deep: "#0d3b25",
    outline: "#082919",
    caliper: "#f2c63d",
    isSuv: true,
    isTaxi: false,
    hasSunroof: true,
  },
  // 4: Midnight-Blue Sleek EV Fastback (panoramic glass roof + cyan LED DRL lightbar!)
  {
    spec: "#b0c8ff",
    hi: "#4b6eb8",
    mid: "#243b70",
    shade: "#16264d",
    deep: "#0c1630",
    outline: "#080f24",
    caliper: "#ff3b30",
    isSuv: false,
    isEv: true,
    hasSunroof: true,
  },
  // 5: Sunset-Orange Jeep Wrangler Off-Roader (boxy roll-cage cabin + rear spare tire!)
  {
    spec: "#ffd4a3",
    hi: "#f78831",
    mid: "#d65d18",
    shade: "#993b0d",
    deep: "#612206",
    outline: "#3d1404",
    caliper: "#ffd242",
    isSuv: true,
    isJeep: true,
    hasSunroof: false,
  },
  // 6: Mint-Teal & Cream Vintage Beetle / Mini Classic (rounded bubble roof & chrome trim!)
  {
    spec: "#d4fff5",
    hi: "#6cd9c4",
    mid: "#3ba895",
    shade: "#247568",
    deep: "#144a42",
    outline: "#0b2e29",
    caliper: "#f2f5f8",
    isSuv: false,
    isRetro: true,
    hasSunroof: false,
  },
  // 7: Pearl-White Family Minivan (extra-long 3-row tinted cabin!)
  {
    spec: "#ffffff",
    hi: "#eef3f8",
    mid: "#cfd8e3",
    shade: "#9aa6b5",
    deep: "#687485",
    outline: "#363e4d",
    caliper: "#2e6fd9",
    isSuv: true,
    isVan: true,
    hasSunroof: false,
  },
  // 8: Racing-Silver Open-Top Convertible Roadster (open cockpit + tan leather seats!)
  {
    spec: "#ffffff",
    hi: "#d5dfeb",
    mid: "#9eabb8",
    shade: "#6d7a8a",
    deep: "#454f5e",
    outline: "#242b36",
    caliper: "#e63946",
    isSuv: false,
    isConvertible: true,
    hasSunroof: false,
  },
  // 9: Plum-Burgundy Sport Hatchback (rear spoiler + dark alloys!)
  {
    spec: "#f0b8de",
    hi: "#b84f96",
    mid: "#822966",
    shade: "#571743",
    deep: "#360c29",
    outline: "#24071b",
    caliper: "#5ce0ff",
    isSuv: false,
    isHatch: true,
    hasSunroof: true,
  },
];

export const CAR_MODEL_COUNT = CAR_PALETTES.length;

function bake32BitCarSideEast(pal) {
  const cw = pal.isVan ? 68 : pal.isRetro ? 58 : pal.isSuv ? 66 : 64;
  const ch = pal.isJeep ? 42 : pal.isSuv ? 40 : 38;
  const g = new PixelGrid(cw, ch);
  const wheelY = ch - 9;
  const bodyBot = ch - 10;

  // 1. Sculpted Aerodynamic Lower Body (rounded bumper nose + sleek beltline!)
  const bodyTop = pal.isJeep ? 17 : pal.isSuv ? 15 : pal.isConvertible ? 17 : 16;
  g.rect(4, bodyTop, cw - 8, bodyBot - bodyTop, pal.mid, "paint");
  // Sloped aerodynamic hood tapering gently toward right nose
  g.rect(cw - 16, bodyTop + 1, 13, bodyBot - bodyTop - 1, pal.mid, "paint");
  g.rect(cw - 6, bodyTop + 3, 3, bodyBot - bodyTop - 3, pal.mid, "paint");
  // Rounded rear tail & bumper curve
  g.rect(2, bodyTop + 2, 3, bodyBot - bodyTop - 2, pal.shade, "paint");
  // Metallic sunlit top fender sheen + specular shoulder crease!
  g.rect(5, bodyTop, cw - 12, 3, pal.hi, "paint");
  g.rect(8, bodyTop, cw - 20, 1, pal.spec, "paint");
  // Crisp sculpted door beltline highlight + shaded lower rocker panel!
  g.rect(5, bodyTop + 5, cw - 11, 2, pal.hi, "paint");
  g.rect(4, bodyBot - 4, cw - 9, 4, pal.shade, "paint");
  g.rect(5, bodyBot - 2, cw - 11, 2, pal.deep, "paint");

  // 2. Model-Specific Cabin Roof & Greenhouse Silhouettes!
  const cabL = pal.isVan ? 6 : pal.isJeep ? 9 : pal.isRetro ? 13 : pal.isHatch ? 8 : pal.isSuv ? 7 : 12;
  const cabR = pal.isVan ? cw - 14 : pal.isJeep ? cw - 19 : pal.isRetro ? cw - 15 : pal.isSuv ? cw - 17 : cw - 18;
  const cabTop = pal.isJeep ? 4 : pal.isRetro ? 5 : pal.isSuv ? 5 : 6;

  if (pal.isConvertible) {
    // Open-top roadster cockpit: tan leather bucket seats, roll bar, driver head & swept windshield!
    g.rect(cabL + 4, bodyTop - 6, 10, 7, "#b5743c", "wood"); // tan leather headrest/seat
    g.rect(cabL + 6, bodyTop - 7, 6, 3, "#d9985b", "wood");
    g.rect(cabL + 16, bodyTop - 7, 7, 7, "#9c5e2c", "wood");
    // Driver head & sunglasses cruising in the open air!
    g.ellipse(cabR - 9, bodyTop - 6, 3.2, 3.2, "#f2c49b", "skin");
    g.rect(cabR - 12, bodyTop - 9, 6, 2, "#4a2c18", "hair");
    g.rect(cabR - 8, bodyTop - 7, 3, 1, "#181a24", "dark");
    // Swept low windshield frame
    for (let r = 0; r < 8; r++) {
      g.rect(cabR - 3 + Math.round(r * 0.7), bodyTop - 8 + r, 3, 1, "#8bd6fa", "glass");
    }
    g.rect(cabR - 4, bodyTop - 9, 3, 2, "#dce6f2", "chrome");
    // Sporty twin dark racing stripes along side
    g.rect(7, bodyTop + 4, cw - 15, 2, "#242b36", "dark");
  } else {
    // Roof crown & angled A-pillar / C-pillar slopes
    for (let row = 0; row <= bodyTop - cabTop; row++) {
      const t = row / Math.max(1, bodyTop - cabTop);
      const slopeL = pal.isJeep ? 1 : pal.isVan ? 1.5 : pal.isRetro ? 8 : pal.isHatch ? 4 : pal.isSuv ? 2 : 6;
      const slopeR = pal.isJeep ? 2 : pal.isRetro ? 8 : pal.isEv ? 9 : 7;
      const xl = Math.round(cabL - t * slopeL);
      const xr = Math.round(cabR + t * slopeR);
      const col = pal.isRetro && row <= 3
        ? (row === 0 ? "#ffffff" : "#f5eedc")
        : pal.isEv && row <= 2
          ? "#1a2b45" // panoramic dark glass EV roof!
          : row === 0 ? pal.spec : row <= 2 ? pal.hi : pal.mid;
      g.rect(xl, cabTop + row, xr - xl, 1, col, pal.isEv && row <= 2 ? "glass" : "paint");
    }
    // Tinted Cabin Greenhouse Windows with Sky Reflections & Driver Silhouette!
    const winTop = cabTop + 3;
    const winBot = bodyTop + 1;
    const winH = winBot - winTop;
    for (let r = 0; r < winH; r++) {
      const fx0 = cabR - 4 + Math.round((r / winH) * 2);
      const fx1 = cabR + Math.round((r / winH) * (pal.isJeep ? 2 : 6));
      g.rect(fx0, winTop + r, Math.max(3, fx1 - fx0), 1, "#274463", "glass");
      if (r < 3) g.rect(fx0 + 1, winTop + r, Math.max(2, fx1 - fx0 - 2), 1, "#8bd6fa", "glass");
    }
    const sideWinL = cabL + 1;
    const sideWinR = cabR - 4;
    g.rect(sideWinL, winTop, sideWinR - sideWinL, winH, pal.isVan ? "#17293d" : "#203852", "glass");
    g.line(sideWinL + 2, winTop + 1, sideWinL + 6, winTop + winH - 2, "#8fdbfa", "glass");
    g.line(sideWinL + 3, winTop + 1, sideWinL + 7, winTop + winH - 2, "#d8f5ff", "glass");
    g.line(sideWinR - 9, winTop + 1, sideWinR - 5, winTop + winH - 2, "#74c2eb", "glass");
    const drvX = sideWinR - 8;
    g.ellipse(drvX, winTop + 3.5, 2.5, 2.5, "#3a4d63", "glass");
    g.rect(drvX - 3, winTop + 5, 6, winH - 5, "#2f4157", "glass");
    const bPillarX = Math.round((sideWinL + sideWinR) / 2);
    g.rect(bPillarX, winTop, 2, winH, pal.isJeep ? "#1e2028" : pal.deep, "paint");

    if (pal.isJeep) {
      // Boxy Jeep roll bar + mounted rear spare tire on tailgate!
      g.rect(sideWinL + 6, winTop, 2, winH, "#1e2028", "dark");
      g.rect(1, bodyTop - 5, 5, 11, "#1a1d26", "tire"); // rear spare tire!
      g.rect(2, bodyTop - 3, 3, 7, "#363c4d", "tire");
      g.rect(cabL, cabTop - 1, cabR - cabL, 2, "#242834", "dark"); // black hardtop roof!
    } else if (pal.isSuv && !pal.isVan) {
      g.rect(sideWinL + 7, winTop, 2, winH, pal.deep, "paint");
      g.rect(cabL + 2, cabTop - 2, cabR - cabL - 4, 2, "#2a303d", "chrome");
      g.rect(cabL + 3, cabTop - 2, cabR - cabL - 6, 1, "#9aa5b5", "chrome");
      g.rect(cabL + 5, cabTop, 2, 1, "#2a303d", "chrome");
      g.rect(cabR - 7, cabTop, 2, 1, "#2a303d", "chrome");
    } else if (pal.isVan) {
      // Minivan 3-row pillars + sliding door track!
      g.rect(sideWinL + 10, winTop, 2, winH, pal.deep, "paint");
      g.rect(sideWinL + 22, winTop, 2, winH, pal.deep, "paint");
      g.rect(sideWinL + 2, bodyTop + 4, 18, 1, "#687485", "chrome");
    } else if (pal.isHatch) {
      // Sporty rear hatchback wing spoiler!
      g.rect(cabL - 4, cabTop, 6, 2, "#1c202b", "dark");
    }
    // Door seam & handles
    g.rect(cabR - 1, bodyTop - 1, 4, 3, pal.shade, "paint");
    g.rect(cabR, bodyTop - 1, 2, 1, pal.spec, "paint");
    g.line(bPillarX, bodyTop + 1, bPillarX, bodyBot - 3, pal.deep, "paint");
    const hCol = pal.isEv ? "#161a24" : "#e6edf5";
    g.rect(bPillarX - 6, bodyTop + 3, 4, 1, hCol, "chrome");
    g.rect(bPillarX + 3, bodyTop + 3, 4, 1, hCol, "chrome");
  }

  if (pal.isTaxi) {
    // Illuminated TAXI roof topper sign + crisp checkered cab stripe!
    const mx = Math.round((cabL + cabR) / 2);
    g.rect(mx - 6, cabTop - 4, 12, 4, "#23252e", "dark");
    g.rect(mx - 5, cabTop - 3, 10, 2, "#fff599", "light");
    g.rect(mx - 3, cabTop - 3, 6, 1, "#ffffff", "light");
    for (let tx = 8; tx < cw - 12; tx += 4) {
      g.rect(tx, bodyTop + 6, 2, 2, (tx / 4) % 2 === 0 ? "#1b1d24" : "#ffffff", "paint");
      g.rect(tx + 2, bodyTop + 8, 2, 2, (tx / 4) % 2 === 0 ? "#ffffff" : "#1b1d24", "paint");
    }
  }

  // 3. Chrome Front/Rear Bumpers, Grille, Glowing Headlights & Ruby Taillights!
  const bumpCol = pal.isJeep || pal.isEv ? "#2c3140" : "#cbd5e1";
  g.rect(2, bodyBot - 4, 4, 4, bumpCol, "chrome");
  g.rect(cw - 6, bodyBot - 4, 5, 4, bumpCol, "chrome");
  if (!pal.isEv) {
    g.rect(1, bodyBot - 1, 3, 2, "#8f99a8", "chrome"); // exhaust pipe (EVs have zero tailpipe!)
  }
  // Multi-tone glowing headlight lens (cyan-white LED bar on EVs, warm halogen on gas cars!)
  g.rect(cw - 7, bodyTop + 2, 4, 4, pal.isEv ? "#b8f4ff" : "#fff49e", "light");
  g.rect(cw - 5, bodyTop + 3, 2, 2, "#ffffff", "light");
  if (!pal.isEv) g.rect(cw - 7, bodyTop + 5, 2, 1, "#ff9e2c", "light");
  // Ruby brake taillight + bright center reflector
  g.rect(3, bodyTop + 2, 4, 4, "#e62420", "light");
  g.rect(3, bodyTop + 3, 2, 2, "#ff786b", "light");

  // 4. Sculpted Dark Wheel Arches + 32-Bit Alloy Wheels (chunkier tires on Jeep!)
  const w1 = pal.isRetro ? 14 : 15;
  const w2 = cw - (pal.isRetro ? 14 : 15);
  const wheelR = pal.isJeep ? 6.0 : 5.2;
  for (const wx of [w1, w2]) {
    g.ellipse(wx, wheelY, wheelR + 1.5, wheelR + 0.9, "#151720", "tire");
    draw32BitWheel(g, wx, wheelY, wheelR, pal.caliper);
  }

  g.applySelOut({ ...BASE_SELOUT, paint: pal.outline });
  const postDraw = (ctx) => {
    // Subtle warm golden headlight beam glow ahead of nose!
    ctx.fillStyle = "rgba(255, 246, 170, 0.24)";
    ctx.fillRect(cw - 2, bodyTop + 2, 2, 5);
  };
  return {
    east: g.toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.46, ry: 3.5 }, postDraw),
    west: g.flipHorizontal().toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.46, ry: 3.5 }, (ctx) => {
      ctx.fillStyle = "rgba(255, 246, 170, 0.24)";
      ctx.fillRect(0, bodyTop + 2, 2, 5);
    }),
  };
}

function bake32BitCarVertical(pal, isSouth) {
  const cw = pal.isSuv ? 38 : 36;
  const ch = pal.isSuv ? 62 : 58;
  const g = new PixelGrid(cw, ch);
  const cx = Math.floor(cw / 2);

  // Subtle rubber tire edges peeking inside wheel arches
  for (const wy of [12, ch - 18]) {
    g.rect(2, wy, 3, 8, "#1c2029", "tire");
    g.rect(cw - 5, wy, 3, 8, "#1c2029", "tire");
  }

  // Aerodynamic side-view mirrors sticking out cleanly
  const mirrorY = isSouth ? ch - 23 : 20;
  g.rect(1, mirrorY, 4, 3, pal.shade, "paint");
  g.rect(2, mirrorY, 2, 1, pal.spec, "paint");
  g.rect(cw - 5, mirrorY, 4, 3, pal.shade, "paint");
  g.rect(cw - 4, mirrorY, 2, 1, pal.spec, "paint");

  // Rounded sculpted body silhouette (tapered front & rear bumpers!)
  g.rect(5, 5, cw - 10, ch - 10, pal.mid, "paint");
  g.rect(7, 3, cw - 14, ch - 6, pal.mid, "paint");
  g.rect(9, 2, cw - 18, ch - 4, pal.mid, "paint");
  // Sunlit left fender sheen & shaded right contour (true 32-bit lighting!)
  g.rect(6, 6, 6, ch - 12, pal.hi, "paint");
  g.rect(7, 8, 2, ch - 16, pal.spec, "paint");
  g.rect(cw - 11, 6, 5, ch - 12, pal.shade, "paint");
  g.rect(cw - 8, 8, 2, ch - 16, pal.deep, "paint");

  // Hood sculpted contour ribs (facing direction of travel!)
  const hoodY = isSouth ? ch - 15 : 6;
  g.rect(10, hoodY, 2, 9, pal.hi, "paint");
  g.rect(cw - 12, hoodY, 2, 9, pal.hi, "paint");

  // Front angled windshield + glossy roof panel + rear glass!
  const frontGlassY = isSouth ? ch - 25 : 15;
  const rearGlassY = isSouth ? 11 : ch - 19;
  const roofTopY = isSouth ? 19 : 24;
  const roofH = ch - 44;

  // Front windshield with diagonal sky reflection!
  g.rect(8, frontGlassY, cw - 16, 10, "#213a54", "glass");
  g.rect(9, frontGlassY + 1, cw - 18, 8, "#2c4e70", "glass");
  g.line(10, frontGlassY + 1, 16, frontGlassY + 7, "#8fdbfa", "glass");
  g.line(11, frontGlassY + 1, 17, frontGlassY + 7, "#dcf6ff", "glass");
  g.line(cw - 14, frontGlassY + 2, cw - 10, frontGlassY + 6, "#7ac8ed", "glass");

  // Rear window
  g.rect(9, rearGlassY, cw - 18, 7, "#1e344d", "glass");
  g.rect(11, rearGlassY + 1, cw - 22, 2, "#6ab3d9", "glass");

  // Sculpted metallic roof panel (or open convertible cockpit / panoramic EV glass / Jeep hardtop!)
  if (pal.isConvertible) {
    g.rect(8, roofTopY, cw - 16, roofH, "#8c5429", "wood"); // tan leather interior!
    g.rect(10, roofTopY + 3, 6, 7, "#b5743c", "wood");
    g.rect(cw - 16, roofTopY + 3, 6, 7, "#b5743c", "wood");
    g.ellipse(13, roofTopY + 6, 2.5, 2.5, "#f2c49b", "skin"); // driver head!
  } else if (pal.isEv) {
    g.rect(8, roofTopY, cw - 16, roofH, "#1a2b45", "glass"); // full panoramic EV glass roof!
    g.line(10, roofTopY + 2, 17, roofTopY + roofH - 3, "#8bd6fa", "glass");
  } else if (pal.isRetro) {
    g.rect(8, roofTopY, cw - 16, roofH, "#f5eedc", "paint"); // vintage cream two-tone roof!
    g.rect(10, roofTopY + 1, 6, roofH - 2, "#ffffff", "paint");
  } else {
    g.rect(8, roofTopY, cw - 16, roofH, pal.isJeep ? "#262a36" : pal.hi, "paint");
    g.rect(10, roofTopY + 1, 6, roofH - 2, pal.isJeep ? "#3c4354" : pal.spec, "paint");
    g.rect(cw - 13, roofTopY + 1, 4, roofH - 2, pal.isJeep ? "#1a1d26" : pal.mid, "paint");
    if (pal.hasSunroof) {
      g.rect(12, roofTopY + 3, cw - 24, Math.max(6, roofH - 8), "#223b57", "glass");
      g.rect(13, roofTopY + 4, cw - 28, 2, "#94dcf7", "glass");
    }
    if (pal.isSuv && !pal.isVan && !pal.isJeep) {
      g.rect(9, roofTopY + 1, 2, roofH - 2, "#252a36", "chrome");
      g.rect(cw - 11, roofTopY + 1, 2, roofH - 2, "#252a36", "chrome");
    }
  }
  if (pal.isJeep) {
    // Mounted spare tire on rear tailgate in vertical view!
    const spY = isSouth ? 1 : ch - 5;
    g.rect(cx - 5, spY, 10, 4, "#1a1d26", "tire");
  }
  if (pal.isTaxi) {
    const ty = roofTopY + Math.floor(roofH / 2) - 2;
    g.rect(cx - 6, ty, 12, 4, "#1e2028", "dark");
    g.rect(cx - 5, ty + 1, 10, 2, "#fff599", "light");
  }

  // Headlights, chrome grille & ruby taillights!
  const fY = isSouth ? ch - 6 : 3;
  const rY = isSouth ? 3 : ch - 6;
  g.rect(8, fY, 6, 3, "#fff49e", "light");
  g.rect(9, fY + 1, 4, 1, "#ffffff", "light");
  g.rect(cw - 14, fY, 6, 3, "#fff49e", "light");
  g.rect(cw - 13, fY + 1, 4, 1, "#ffffff", "light");
  g.rect(cx - 4, isSouth ? ch - 4 : 2, 8, 2, "#cfd8e3", "chrome"); // Grille

  g.rect(8, rY, 6, 3, "#e62420", "light");
  g.rect(9, rY + 1, 4, 1, "#ff786b", "light");
  g.rect(cw - 14, rY, 6, 3, "#e62420", "light");
  g.rect(cw - 13, rY + 1, 4, 1, "#ff786b", "light");

  g.applySelOut({ ...BASE_SELOUT, paint: pal.outline });
  return g.toCanvas(0.5, { cx: cw / 2, cy: ch / 2 + 2, rx: cw * 0.44, ry: ch * 0.45 });
}

// =============================================================================
// 2. 32-BIT HERO-GRADE TRUCKS (Crew-Cab Pickup + 2 Ribbed Delivery Box Trucks!)
// =============================================================================

const TRUCK_SPECS = [
  {
    kind: "pickup",
    spec: "#a8d2ff",
    hi: "#4b8ce8",
    mid: "#245bb0",
    shade: "#163b78",
    deep: "#0d244d",
    outline: "#0a1a38",
    boxSpec: "#fff4e0",
    boxMid: "#e3c598",
    boxShade: "#b58b52",
    stripe: "#f4d35e",
  },
  {
    kind: "box",
    spec: "#ffffff",
    hi: "#eef4fa",
    mid: "#d2dde8",
    shade: "#9ba9ba",
    deep: "#6a778a",
    outline: "#2b3442",
    boxSpec: "#ffffff",
    boxMid: "#f2f6fa",
    boxShade: "#c4d0de",
    stripe: "#2464bd",
  },
  {
    kind: "box",
    spec: "#ffc28a",
    hi: "#f57c33",
    mid: "#d9561c",
    shade: "#9c370e",
    deep: "#632007",
    outline: "#421504",
    boxSpec: "#fffaf0",
    boxMid: "#f5ebd8",
    boxShade: "#cfc0a8",
    stripe: "#e05c1e",
  },
];

function bake32BitTruckSideEast(tr) {
  const isBox = tr.kind === "box";
  const cw = isBox ? 82 : 70;
  const ch = isBox ? 46 : 40;
  const g = new PixelGrid(cw, ch);
  const wheelY = ch - 9;
  const bodyBot = ch - 10;

  if (isBox) {
    // 1. Tall Ribbed Freight Cargo Box (left 54px) with aerodynamic roof fairing!
    const boxR = cw - 24;
    g.rect(3, 5, boxR - 3, bodyBot - 5, tr.boxMid, "paint");
    g.rect(4, 5, boxR - 5, 3, tr.boxSpec, "paint");
    g.rect(3, bodyBot - 5, boxR - 3, 5, tr.boxShade, "paint");
    // Bold delivery company livery racing stripe + accent gold trim
    g.rect(3, 17, boxR - 3, 6, tr.stripe, "paint");
    g.rect(3, 16, boxR - 3, 1, "#ffd859", "paint");
    // Vertical aluminum box-truck panel ribs
    for (let rx = 11; rx < boxR - 3; rx += 9) {
      g.line(rx, 6, rx, bodyBot - 6, tr.boxShade, "paint");
      g.line(rx + 1, 6, rx + 1, bodyBot - 6, tr.boxSpec, "paint");
    }
    // Amber roof clearance markers
    g.rect(5, 4, 3, 2, "#ffae2b", "light");
    g.rect(boxR - 6, 4, 3, 2, "#ffae2b", "light");
    // Rear safety reflector & mudflap
    g.rect(2, bodyBot - 6, 3, 5, "#e62420", "light");
    g.rect(6, bodyBot - 1, 3, 4, "#1d2029", "tire");

    // 2. Sculpted Forward Truck Cab + Aerodynamic Roof Wind Fairing!
    const cabL = boxR + 1;
    // Aerodynamic deflector sloping down from box top to cab roof
    for (let row = 0; row < 7; row++) {
      g.rect(cabL, 7 + row, 4 + row, 1, row < 2 ? tr.spec : tr.hi, "paint");
    }
    // Cab body
    g.rect(cabL, 14, cw - cabL - 3, bodyBot - 14, tr.mid, "paint");
    g.rect(cabL + 1, 14, cw - cabL - 5, 3, tr.hi, "paint");
    g.rect(cw - 6, 17, 3, bodyBot - 17, tr.mid, "paint");
    g.rect(cabL, bodyBot - 4, cw - cabL - 3, 4, tr.shade, "paint");
    // Tall panoramic cab windshield + driver silhouette + side mirror!
    g.rect(cabL + 6, 16, cw - cabL - 10, 9, "#223c57", "glass");
    g.line(cabL + 8, 17, cabL + 12, 23, "#96e0fc", "glass");
    g.line(cabL + 9, 17, cabL + 13, 23, "#e0f7ff", "glass");
    g.ellipse(cabL + 10, 20, 2.4, 2.4, "#3b4e66", "glass");
    g.rect(cabL + 14, 18, 3, 5, "#cfd8e3", "chrome"); // Big truck mirror
    // Chrome grille, bull bumper & bright headlights!
    g.rect(cw - 5, bodyBot - 5, 4, 5, "#dce4ee", "chrome");
    g.rect(cw - 4, bodyBot - 5, 2, 2, "#ffffff", "chrome");
    g.rect(cw - 7, 26, 4, 4, "#fff49e", "light");
    g.rect(cw - 5, 27, 2, 2, "#ffffff", "light");
    // Heavy steel chassis rail & fuel tank under box
    g.rect(24, bodyBot - 2, 20, 4, "#4b5463", "chrome");
    g.rect(26, bodyBot - 1, 14, 2, "#9aa5b5", "chrome");
    // Dual rear heavy truck wheels + front wheel
    for (const wx of [14, 26, cw - 14]) {
      g.ellipse(wx, wheelY, 6.8, 6.4, "#151720", "tire");
      draw32BitWheel(g, wx, wheelY, 5.4, "#9aa5b5");
    }
  } else {
    // Crew-Cab Pickup Truck with Loaded Wooden Bed, Crate, Toolbox & Chrome Rollbar!
    const bodyTop = 16;
    g.rect(3, bodyTop, cw - 6, bodyBot - bodyTop, tr.mid, "paint");
    g.rect(4, bodyTop, cw - 9, 3, tr.hi, "paint");
    g.rect(6, bodyTop, cw - 15, 1, tr.spec, "paint");
    g.rect(3, bodyBot - 4, cw - 6, 4, tr.shade, "paint");
    g.rect(4, bodyBot - 2, cw - 8, 2, tr.deep, "paint");
    // Cargo in open pickup bed (lumber planks + nailed wooden crate + red toolbox!)
    g.rect(5, 11, 13, 6, "#c98b49", "wood");
    g.rect(6, 12, 11, 2, "#e8b976", "wood");
    g.line(6, 14, 17, 14, "#7d4f22", "wood");
    g.rect(19, 12, 10, 5, "#d9362e", "paint"); // Red metal toolbox!
    g.rect(20, 12, 8, 1, "#ff786b", "paint");
    // Chrome rollbar with twin yellow off-road lamps!
    g.rect(30, 6, 3, 11, "#dce4ee", "chrome");
    g.rect(31, 6, 1, 10, "#ffffff", "chrome");
    g.rect(29, 4, 4, 3, "#ffe466", "light");
    // Tall Crew Cab + Tinted Windows + Driver!
    const cabL = 33;
    const cabR = cw - 16;
    for (let row = 0; row <= 10; row++) {
      const t = row / 10;
      g.rect(cabL, 6 + row, Math.round(cabR - cabL + t * 6), 1, row === 0 ? tr.spec : row <= 2 ? tr.hi : tr.mid, "paint");
    }
    g.rect(cabL + 2, 9, cabR - cabL - 1, 7, "#223c57", "glass");
    g.line(cabL + 4, 10, cabL + 8, 15, "#94dcf7", "glass");
    g.ellipse(cabR - 5, 12, 2.3, 2.3, "#3b4e66", "glass");
    g.rect(cabR, 15, 3, 3, tr.deep, "paint"); // Side mirror
    g.rect(cabL + 8, bodyTop + 3, 4, 1, "#e6edf5", "chrome");
    // Chrome bumpers, headlights & ruby taillights
    g.rect(2, bodyBot - 4, 4, 4, "#dce4ee", "chrome");
    g.rect(cw - 6, bodyBot - 4, 5, 4, "#dce4ee", "chrome");
    g.rect(cw - 7, bodyTop + 2, 4, 4, "#fff49e", "light");
    g.rect(cw - 5, bodyTop + 3, 2, 2, "#ffffff", "light");
    g.rect(3, bodyTop + 2, 4, 4, "#e62420", "light");
    // Big off-road pickup wheels!
    for (const wx of [15, cw - 15]) {
      g.ellipse(wx, wheelY, 7.0, 6.6, "#151720", "tire");
      draw32BitWheel(g, wx, wheelY, 5.5, "#f4d35e");
    }
  }

  g.applySelOut({ ...BASE_SELOUT, paint: tr.outline });
  return {
    east: g.toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.47, ry: 3.8 }),
    west: g.flipHorizontal().toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.47, ry: 3.8 }),
  };
}

function bake32BitTruckVertical(tr, isSouth) {
  const isBox = tr.kind === "box";
  const cw = isBox ? 44 : 40;
  const ch = isBox ? 74 : 66;
  const g = new PixelGrid(cw, ch);
  const cx = Math.floor(cw / 2);

  if (isBox) {
    const boxY = isSouth ? 4 : 24;
    const boxH = ch - 28;
    const cabY = isSouth ? ch - 23 : 4;
    // Tall freight box roof with metallic corner seams & top livery stripe!
    g.rect(4, boxY, cw - 8, boxH, tr.boxMid, "paint");
    g.rect(6, boxY + 2, cw - 12, boxH - 4, tr.boxSpec, "paint");
    g.rect(cx - 5, boxY + 2, 10, boxH - 4, tr.stripe, "paint");
    g.rect(cw - 8, boxY + 1, 4, boxH - 2, tr.boxShade, "paint");
    for (let ry = boxY + 10; ry < boxY + boxH - 6; ry += 10) {
      g.line(5, ry, cw - 6, ry, tr.boxShade, "paint");
    }
    // Forward cab + big mirrors + panoramic windshield + bright headlights!
    g.rect(6, cabY, cw - 12, 19, tr.mid, "paint");
    g.rect(7, cabY + 1, 7, 17, tr.hi, "paint");
    g.rect(2, isSouth ? cabY + 8 : cabY + 7, 4, 4, "#cfd8e3", "chrome");
    g.rect(cw - 6, isSouth ? cabY + 8 : cabY + 7, 4, 4, "#cfd8e3", "chrome");
    g.rect(9, isSouth ? cabY + 9 : cabY + 3, cw - 18, 7, "#223c57", "glass");
    g.line(11, isSouth ? cabY + 10 : cabY + 4, 17, isSouth ? cabY + 14 : cabY + 8, "#94dcf7", "glass");
    const fY = isSouth ? ch - 6 : 3;
    g.rect(8, fY, 6, 3, "#fff49e", "light");
    g.rect(cw - 14, fY, 6, 3, "#fff49e", "light");
  } else {
    g.rect(5, 4, cw - 10, ch - 8, tr.mid, "paint");
    g.rect(6, 5, 6, ch - 10, tr.hi, "paint");
    g.rect(cw - 11, 5, 5, ch - 10, tr.shade, "paint");
    // Open pickup bed with crate & red toolbox
    const bedY = isSouth ? 6 : ch - 30;
    g.rect(8, bedY, cw - 16, 24, "#2d323b", "dark");
    g.rect(10, bedY + 3, 11, 11, "#c98b49", "wood");
    g.rect(11, bedY + 4, 9, 3, "#e8b976", "wood");
    g.rect(22, bedY + 5, 8, 12, "#d9362e", "paint");
    // Crew cab + windshield
    const cabY = isSouth ? 32 : 14;
    g.rect(7, cabY, cw - 14, 18, tr.hi, "paint");
    g.rect(9, isSouth ? cabY + 10 : cabY + 2, cw - 18, 7, "#223c57", "glass");
    g.line(11, isSouth ? cabY + 11 : cabY + 3, 16, isSouth ? cabY + 15 : cabY + 7, "#94dcf7", "glass");
    const fY = isSouth ? ch - 6 : 3;
    const rY = isSouth ? 3 : ch - 6;
    g.rect(8, fY, 6, 3, "#fff49e", "light");
    g.rect(cw - 14, fY, 6, 3, "#fff49e", "light");
    g.rect(8, rY, 6, 3, "#e62420", "light");
    g.rect(cw - 14, rY, 6, 3, "#e62420", "light");
  }

  g.applySelOut({ ...BASE_SELOUT, paint: tr.outline });
  return g.toCanvas(0.5, { cx: cw / 2, cy: ch / 2 + 2, rx: cw * 0.44, ry: ch * 0.46 });
}

// =============================================================================
// 3. 32-BIT HERO-GRADE ANNOYING SPANDEX ROAD BIKERS (2 Pedaling Frames x 4 Dirs!)
// =============================================================================

function bake32BitBikerSideEast(frame = 0) {
  const cw = 54;
  const ch = 48;
  const g = new PixelGrid(cw, ch);

  const wY = 35;
  const rWx = 13; // rear carbon wheel center
  const fWx = 41; // front carbon wheel center

  // 1. Deep-Section Carbon Racing Wheels (15px diameter!) with rotating pixel spokes!
  for (const wx of [rWx, fWx]) {
    g.ring(wx, wY, 7.4, 5.8, "#1b1e28", "tire");     // Thin high-pressure road tire
    g.ring(wx, wY, 5.8, 4.4, "#3b4254", "chrome");   // Deep-dish carbon rim
    g.ring(wx, wY, 5.2, 4.6, "#8793a8", "chrome");   // Rim specular highlight
    // Animated rotating spokes!
    if (frame === 0) {
      g.line(wx, wY - 4, wx, wY + 4, "#aeb8c7", "chrome");
      g.line(wx - 4, wY, wx + 4, wY, "#aeb8c7", "chrome");
    } else {
      g.line(wx - 3, wY - 3, wx + 3, wY + 3, "#aeb8c7", "chrome");
      g.line(wx + 3, wY - 3, wx - 3, wY + 3, "#aeb8c7", "chrome");
    }
    // Disc brake rotor & golden hub
    g.ellipse(wx, wY, 1.8, 1.8, "#d9e2ec", "chrome");
    g.set(wx, wY, "#f4d35e", "chrome");
  }

  // 2. True Diamond Carbon Aero Frame (glossy crimson tubes + water bottle + drop handlebars!)
  const bbX = 25; // bottom bracket crankset
  const bbY = 35;
  const seatX = 21;
  const seatY = 23;
  const headX = 36;
  const headY = 22;

  // Back leg (drawn behind frame for true 3D depth!)
  const backFootY = frame === 0 ? bbY + 3 : bbY - 3;
  const backFootX = frame === 0 ? bbX - 2 : bbX + 3;
  g.line(seatX + 1, seatY + 2, bbX + 2, bbY - 4, "#1e222d", "dark"); // Back Lycra thigh
  g.line(bbX + 2, bbY - 4, backFootX, backFootY, "#d99e75", "skin"); // Shaded back calf
  g.rect(backFootX - 1, backFootY, 4, 2, "#b5201b", "helmet");       // Back clip-in shoe

  // Chain stays, seat stays, seat tube, down tube, top tube & front fork!
  g.line(rWx, wY, bbX, bbY, "#b51f1a", "frame");
  g.line(rWx, wY, seatX, seatY, "#d92b24", "frame");
  g.line(bbX, bbY, seatX, seatY, "#e6352c", "frame");
  g.line(bbX, bbY, headX, headY, "#e6352c", "frame");
  g.line(bbX + 1, bbY - 1, headX, headY + 1, "#ff6b5e", "frame"); // Specular frame sheen
  g.line(seatX, seatY, headX, headY, "#ff554a", "frame");
  g.line(headX, headY, fWx, wY, "#d92b24", "frame");
  g.line(headX + 1, headY, fWx + 1, wY, "#ff786b", "frame");
  // Water bottle in carbon cage + racing saddle
  g.rect(28, 26, 3, 5, "#6be0ff", "glass");
  g.set(29, 25, "#ffffff", "glass");
  g.rect(17, 20, 7, 2, "#1c1f29", "dark");
  // Curved racing drop handlebars + stem + black grip tape!
  g.line(headX, headY, headX + 2, headY - 5, "#cfd8e3", "chrome");
  g.rect(headX + 2, headY - 6, 5, 2, "#1d2029", "dark");
  g.rect(headX + 6, headY - 5, 2, 4, "#1d2029", "dark");
  g.rect(headX + 4, headY - 2, 3, 2, "#1d2029", "dark");
  // Golden chainring crankset
  g.ellipse(bbX, bbY, 2.4, 2.4, "#f4d35e", "chrome");
  g.set(bbX, bbY, "#8c6514", "chrome");

  // 3. Expressive 32-Bit Annoying Spandex Cyclist (Hero-level 5-tone character detail!)
  // Hunched pro torso in blinding neon-chartreuse & crimson Lycra racing jersey!
  g.ellipse(26, 17, 7.5, 4.8, "#d4eb1e", "jersey");
  g.ellipse(27, 15.5, 6.2, 2.8, "#f3ff59", "jersey");
  g.rect(22, 16, 10, 3, "#e62c24", "helmet"); // Pro team chest sponsor stripe!
  g.rect(24, 16, 6, 1, "#ff786b", "helmet");
  // Black Lycra bib shorts + front pumping thigh, muscular calf, high white aero sock & clip-in cleat!
  g.ellipse(20, 20, 4.5, 3.6, "#1f232e", "dark");
  const kneeX = frame === 0 ? 29 : 25;
  const kneeY = frame === 0 ? 24 : 28;
  const footX = frame === 0 ? bbX + 3 : bbX - 2;
  const footY = frame === 0 ? bbY - 3 : bbY + 3;
  // Thigh
  g.line(21, 21, kneeX, kneeY, "#282d3b", "dark");
  g.line(21, 22, kneeX, kneeY + 1, "#181b24", "dark");
  g.line(22, 20, kneeX, kneeY - 1, "#3b4254", "dark");
  // Sculpted sunlit calf + white aero sock + bright red cycling shoe
  g.line(kneeX, kneeY, footX, footY, "#fad0a8", "skin");
  g.line(kneeX + 1, kneeY, footX + 1, footY, "#ffe8cf", "skin");
  g.line(kneeX - 1, kneeY + 1, footX - 1, footY, "#d99e75", "skin");
  g.rect(footX - 1, footY - 3, 3, 3, "#ffffff", "chrome"); // High white pro cycling sock!
  g.rect(footX - 1, footY, 5, 2, "#ff362e", "helmet");     // Red clip-in cycling shoe!
  g.set(footX + 3, footY, "#ffffff", "helmet");

  // Reaching arm gripping the drop handlebars (neon sleeve + tanned forearm + fingerless glove!)
  g.line(30, 15, 37, 17, "#fad0a8", "skin");
  g.line(30, 14, 37, 16, "#ffe8cf", "skin");
  g.rect(29, 13, 4, 4, "#e62c24", "helmet"); // Jersey sleeve cuff
  g.rect(37, 15, 3, 3, "#1f232e", "dark");   // Black cycling glove gripping bars!

  // Sculpted 32-bit Head with open shouting mouth, wraparound neon shades & teardrop aero helmet!
  const hx = 34;
  const hy = 9;
  g.ellipse(hx, hy + 2, 4.8, 4.8, "#fad0a8", "skin");
  g.ellipse(hx + 1, hy + 1, 3.0, 3.0, "#ffe8cf", "skin");
  g.rect(hx + 4, hy + 2, 2, 2, "#fad0a8", "skin"); // Side profile nose!
  g.rect(hx + 2, hy + 5, 3, 2, "#9c2828", "skin"); // Open shouting mouth ("ON YOUR LEFT!!")
  g.set(hx + 3, hy + 5, "#ffffff", "skin");        // Teeth flashing while yelling!
  // Mirrored neon wraparound cycling sunglasses!
  g.rect(hx + 1, hy + 1, 5, 2, "#111624", "glass");
  g.rect(hx + 2, hy + 1, 3, 1, "#5ef2ff", "glass");
  g.set(hx + 4, hy + 1, "#ffffff", "glass");
  // Sleek aerodynamic vented teardrop racing helmet!
  g.ellipse(hx - 1, hy - 2, 6.2, 3.2, "#e02b24", "helmet");
  g.ellipse(hx - 1, hy - 3, 4.5, 1.8, "#ff695e", "helmet");
  g.rect(hx - 8, hy - 3, 4, 3, "#b51d18", "helmet"); // Aero teardrop tail!
  g.rect(hx - 3, hy - 3, 2, 1, "#1e222d", "helmet"); // Helmet air vents
  g.rect(hx + 1, hy - 3, 2, 1, "#1e222d", "helmet");
  g.rect(hx - 4, hy - 1, 9, 1, "#f3ff59", "helmet"); // Neon racing trim stripe!

  g.applySelOut(BASE_SELOUT);
  return {
    east: g.toCanvas(0.5, { cx: 27, cy: 43, rx: 20, ry: 3.2 }),
    west: g.flipHorizontal().toCanvas(0.5, { cx: 27, cy: 43, rx: 20, ry: 3.2 }),
  };
}

function bake32BitBikerVertical(frame = 0, isSouth = true) {
  const cw = 36;
  const ch = 52;
  const g = new PixelGrid(cw, ch);
  const cx = 18;
  const sway = frame === 0 ? -1 : 1;

  // Slim road tires & crimson carbon frame along vertical center
  g.rect(cx - 2, 6, 4, 40, "#1b1e28", "tire");
  g.rect(cx - 1, 8, 2, 36, "#d92b24", "frame");
  if (!isSouth) {
    // Glowing red rear LED bike taillight!
    g.rect(cx - 1, 34, 2, 3, "#ff362e", "light");
    g.set(cx, 35, "#fff29e", "light");
  } else {
    // Bright blinking white front bike headlight!
    g.rect(cx - 1, 27, 2, 3, "#ffffff", "light");
  }

  // Wide racing drop handlebars & brake hoods
  const barY = isSouth ? 25 : 17;
  g.rect(cx - 10, barY, 20, 2, "#cfd8e3", "chrome");
  g.rect(cx - 11, barY, 3, 5, "#1d2029", "dark");
  g.rect(cx + 8, barY, 3, 5, "#1d2029", "dark");

  // Pumping legs & clip-in cycling shoes!
  const lLegY = frame === 0 ? 31 : 35;
  const rLegY = frame === 0 ? 35 : 31;
  g.rect(cx - 7, 28, 5, 7, "#1f232e", "dark");
  g.rect(cx + 2, 28, 5, 7, "#1f232e", "dark");
  g.rect(cx - 7, lLegY, 4, 7, "#fad0a8", "skin");
  g.rect(cx - 6, lLegY, 2, 5, "#ffe8cf", "skin");
  g.rect(cx - 7, lLegY + 5, 4, 2, "#ffffff", "chrome");
  g.rect(cx - 7, lLegY + 7, 4, 2, "#ff362e", "helmet");
  g.rect(cx + 3, rLegY, 4, 7, "#fad0a8", "skin");
  g.rect(cx + 4, rLegY, 2, 5, "#ffe8cf", "skin");
  g.rect(cx + 3, rLegY + 5, 4, 2, "#ffffff", "chrome");
  g.rect(cx + 3, rLegY + 7, 4, 2, "#ff362e", "helmet");

  // Torso in neon-yellow & crimson pro Lycra jersey + sculpted arms gripping drop bars!
  g.ellipse(cx + sway, 22, 8.2, 6.8, "#d4eb1e", "jersey");
  g.ellipse(cx + sway, 20, 6.4, 4.2, "#f3ff59", "jersey");
  g.rect(cx - 7 + sway, 21, 14, 4, "#e62c24", "helmet");
  if (!isSouth) {
    // 3 classic stuffed rear cycling jersey pockets!
    g.rect(cx - 5 + sway, 25, 3, 3, "#b5cc14", "jersey");
    g.rect(cx - 1 + sway, 25, 3, 3, "#b5cc14", "jersey");
    g.rect(cx + 3 + sway, 25, 3, 3, "#b5cc14", "jersey");
    g.set(cx + 4 + sway, 24, "#ffe259", "jersey"); // Banana peeking out of back pocket!
  }
  // Arms reaching out to drop bars
  g.line(cx - 7 + sway, 20, cx - 10, barY + 1, "#fad0a8", "skin");
  g.line(cx + 7 + sway, 20, cx + 10, barY + 1, "#fad0a8", "skin");
  g.rect(cx - 11, barY, 3, 3, "#1f232e", "dark");
  g.rect(cx + 8, barY, 3, 3, "#1f232e", "dark");

  // Sculpted 32-bit Head + Aero Helmet + Mirrored Neon Wraparound Shades!
  g.ellipse(cx + sway, 12, 5.4, 5.4, "#fad0a8", "skin");
  g.ellipse(cx + sway, 10.5, 3.6, 3.0, "#ffe8cf", "skin");
  if (isSouth) {
    // Obnoxious mirrored neon cycling shades + open shouting mouth!
    g.rect(cx - 5 + sway, 11, 10, 3, "#111624", "glass");
    g.rect(cx - 4 + sway, 11, 3, 2, "#5ef2ff", "glass");
    g.rect(cx + 1 + sway, 11, 3, 2, "#5ef2ff", "glass");
    g.set(cx - 3 + sway, 11, "#ffffff", "glass");
    g.set(cx + 2 + sway, 11, "#ffffff", "glass");
    g.rect(cx - 2 + sway, 15, 4, 2, "#9c2828", "skin");
    g.rect(cx - 1 + sway, 15, 2, 1, "#ffffff", "skin");
  }
  // Vented crimson & neon aero helmet!
  g.ellipse(cx + sway, 7.5, 6.4, 3.8, "#e02b24", "helmet");
  g.ellipse(cx + sway, 6.5, 4.6, 2.0, "#ff695e", "helmet");
  g.rect(cx - 4 + sway, 6, 2, 2, "#1d2029", "helmet");
  g.rect(cx + 2 + sway, 6, 2, 2, "#1d2029", "helmet");
  g.rect(cx - 5 + sway, 9, 10, 1, "#f3ff59", "helmet");

  g.applySelOut(BASE_SELOUT);
  return g.toCanvas(0.5, { cx: cw / 2, cy: ch - 6, rx: 9.5, ry: 3.4 });
}

// =============================================================================
// 4. 32-BIT HERO-GRADE EMERGENCY FLEET:
//    - NEWTON EMS TYPE-III RESCUE AMBULANCE (98x52, Closed & Swung-Open Rear Doors!)
//    - NEWTON POLICE INTERCEPTOR CRUISER (68x40, Flashing R/W/B Lightbar & Spotlight!)
//    - NEWTON FIRE DEPT. RESCUE PUMPER ENGINE (106x52, Ladder, Pump Panel & Beacons!)
// =============================================================================

function bake32BitAmbulance(openDoors, flash, drawMiniText) {
  const cw = 98;
  const ch = 52;
  const g = new PixelGrid(cw, ch);
  const wheelY = ch - 9;
  const bodyBot = ch - 10;

  // 1. Tall Gleaming Pearl-White Type-III Modular Rescue Box (left 60px)
  const boxL = 8;
  const boxR = 68;
  // Roof A/C shroud + antenna
  g.rect(boxL + 18, 5, 16, 4, "#cfd8e3", "chrome");
  g.rect(boxL + 20, 5, 12, 2, "#ffffff", "chrome");
  g.line(boxL + 10, 2, boxL + 10, 8, "#8f99a8", "chrome");
  // Main box shell with 5-tone pearl shading
  g.rect(boxL, 8, boxR - boxL, bodyBot - 8, "#edf4fc", "paint");
  g.rect(boxL + 1, 8, boxR - boxL - 2, 4, "#ffffff", "paint");
  g.rect(boxL, bodyBot - 6, boxR - boxL, 6, "#c2cfde", "paint");
  g.rect(boxL, bodyBot - 2, boxR - boxL, 2, "#95a5b8", "paint");
  // Recessed aluminum side equipment compartments & chrome handles
  for (const lx of [boxL + 8, boxL + 44]) {
    g.rect(lx, 29, 11, 10, "#d7e2ee", "chrome");
    g.rect(lx + 1, 30, 9, 8, "#e6eef7", "chrome");
    g.rect(lx + 4, 32, 3, 1, "#4c5666", "chrome");
  }
  // Bold Crimson & Reflective Gold Double EMS Racing Stripes + Red ECG Heartbeat Pulse!
  g.rect(boxL, 23, boxR - boxL, 5, "#d9221c", "helmet");
  g.rect(boxL, 23, boxR - boxL, 1, "#ff685e", "helmet");
  g.rect(boxL, 21, boxR - boxL, 2, "#f4d35e", "light");
  // Crisp white ECG heartbeat pulse line across crimson stripe!
  g.line(boxL + 10, 25, boxL + 18, 25, "#fff7c2", "light");
  g.line(boxL + 18, 25, boxL + 20, 22, "#ffffff", "light");
  g.line(boxL + 20, 22, boxL + 22, 27, "#ffffff", "light");
  g.line(boxL + 22, 27, boxL + 24, 25, "#fff7c2", "light");
  g.line(boxL + 24, 25, boxL + 36, 25, "#fff7c2", "light");

  // Tinted Side Patient-Bay Window with soft interior medical glow + Star of Life!
  g.rect(boxL + 36, 12, 13, 8, "#1e3752", "glass");
  g.rect(boxL + 37, 13, 11, 6, "#4d89bd", "glass");
  g.line(boxL + 38, 13, boxL + 42, 18, "#d4f5ff", "glass");
  // Detailed 6-bar Blue Star of Life + white Rod of Asclepius
  const bx = boxL + 16;
  g.rect(bx + 4, 10, 4, 12, "#2464bd", "glass");
  g.rect(bx + 1, 14, 10, 4, "#2464bd", "glass");
  g.line(bx + 2, 11, bx + 9, 20, "#2464bd", "glass");
  g.line(bx + 9, 11, bx + 2, 20, "#2464bd", "glass");
  g.rect(bx + 5, 11, 2, 10, "#ffffff", "paint");
  g.rect(bx + 2, 15, 8, 2, "#ffffff", "paint");
  // Side scene emergency flasher lights mounted on upper box!
  g.rect(boxL + 6, 11, 4, 3, "#242834", "dark");
  g.rect(boxL + 7, 12, 2, 1, flash === 0 ? "#ff2b2b" : "#ffffff", "light");
  g.rect(boxR - 10, 11, 4, 3, "#242834", "dark");
  g.rect(boxR - 9, 12, 2, 1, flash === 0 ? "#ffffff" : "#ff2b2b", "light");

  // High-Vis Red/Yellow Rear Chevron Safety Panel
  for (let cy = 22; cy < bodyBot - 2; cy += 3) {
    g.rect(boxL, cy, 5, 2, ((cy / 3) | 0) % 2 === 0 ? "#ff362e" : "#ffe042", "light");
  }

  // Swung-Open Rear Rescue Doors showing glowing interior bay, blinking ECG monitor, O2 tank & metal ramp!
  if (openDoors) {
    // Open interior bay opening
    g.rect(boxL - 2, 11, 10, 25, "#191e29", "dark");
    g.rect(boxL - 1, 12, 8, 23, "#fff1b8", "light");
    g.rect(boxL, 14, 5, 5, "#23364a", "glass"); // Heart monitor screen
    g.rect(boxL + 1, 15, 3, 3, flash === 0 ? "#42f58d" : "#1ea859", "light"); // Blinking green ECG!
    g.rect(boxL + 5, 16, 2, 10, "#3db87a", "glass"); // Medical oxygen cylinder!
    // Physically swung-open rear door panel hanging outward to the left with red/white reflective stripes!
    g.rect(boxL - 7, 11, 5, 23, "#e8f0f8", "paint");
    g.rect(boxL - 6, 13, 3, 7, "#243b54", "glass");
    g.rect(boxL - 6, 22, 3, 3, "#d9221c", "helmet");
    g.rect(boxL - 6, 26, 3, 3, "#f4d35e", "light");
    // Sloped chrome gurney loading ramp extending down toward the road!
    g.line(boxL - 4, 37, boxL + 6, 33, "#cfd8e3", "chrome");
    g.line(boxL - 4, 38, boxL + 6, 34, "#ffffff", "chrome");
    g.rect(boxL - 5, 37, 8, 2, "#aeb8c7", "chrome");
  }

  // 2. Sculpted Sloped Forward Ambulance Cab (Ford E-Series heavy rescue chassis!)
  const cabL = boxR + 1;
  for (let row = 0; row <= bodyBot - 16; row++) {
    const t = Math.min(1, row / 12);
    const xr = Math.min(cw - 4, Math.round(cabL + 15 + t * 11));
    const col = row <= 2 ? "#ffffff" : row >= bodyBot - 20 ? "#b8c6d6" : "#edf4fc";
    g.rect(cabL, 16 + row, xr - cabL, 1, col, "paint");
  }
  g.rect(cabL, 25, cw - cabL - 5, 4, "#d9221c", "helmet");
  g.rect(cabL, 23, cw - cabL - 6, 2, "#f4d35e", "light");
  // Curved windshield + EMT driver silhouette + chrome side mirror + door handle
  g.rect(cabL + 5, 18, 14, 7, "#203852", "glass");
  g.line(cabL + 7, 19, cabL + 11, 24, "#96e0fc", "glass");
  g.line(cabL + 8, 19, cabL + 12, 24, "#e0f7ff", "glass");
  g.ellipse(cabL + 10, 21.5, 2.3, 2.3, "#3a4f66", "glass");
  g.rect(cabL + 16, 20, 3, 5, "#dce4ee", "chrome");
  g.rect(cabL + 8, 28, 4, 1, "#4c5666", "chrome");
  // Heavy chrome push-bar bull bumper, radiator grille, grille strobe & projector headlights!
  g.rect(cw - 5, bodyBot - 7, 4, 7, "#dce4ee", "chrome");
  g.rect(cw - 4, bodyBot - 7, 2, 3, "#ffffff", "chrome");
  g.rect(cw - 7, 28, 4, 5, "#fff49e", "light");
  g.rect(cw - 5, 29, 2, 3, "#ffffff", "light");
  // Flashing grille strobe!
  g.rect(cw - 5, 31, 2, 2, flash === 0 ? "#ff2626" : "#2b90ff", "light");

  // 3. Multi-LED Flashing Red / White / Blue Cab Lightbar & Box Roof Strobes!
  const barL = cabL + 2;
  g.rect(barL, 12, 14, 4, "#242834", "dark");
  g.rect(barL + 1, 13, 4, 2, flash === 0 ? "#ff2626" : "#2b90ff", "light");
  g.rect(barL + 5, 13, 4, 2, flash === 0 ? "#ffffff" : "#ff2626", "light");
  g.rect(barL + 9, 13, 4, 2, flash === 0 ? "#2b90ff" : "#ffffff", "light");
  // Box roof front & rear corner emergency beacons!
  g.rect(boxL + 3, 4, 7, 4, "#242834", "dark");
  g.rect(boxL + 4, 5, 5, 2, flash === 0 ? "#ff2626" : "#ffae2b", "light");
  g.rect(boxR - 10, 4, 7, 4, "#242834", "dark");
  g.rect(boxR - 9, 5, 5, 2, flash === 0 ? "#2b90ff" : "#ff2626", "light");

  // 4. Heavy Chrome Alloy EMS Dual Wheels!
  for (const wx of [24, cw - 16]) {
    g.ellipse(wx, wheelY, 7.4, 6.8, "#151720", "tire");
    draw32BitWheel(g, wx, wheelY, 5.8, "#d9221c");
  }

  g.applySelOut({ ...BASE_SELOUT, paint: "#263245" });

  const makePost = (isEast) => (ctx) => {
    if (drawMiniText) {
      drawMiniText(ctx, "EMS", isEast ? 50 : 46, 14, "#d9221c", 1);
    }
    // Radiant multi-color emergency LED strobe halos + dual headlight cone!
    const bX = isEast ? barL - 4 : cw - (barL + 18);
    ctx.fillStyle = flash === 0 ? "rgba(255, 48, 48, 0.44)" : "rgba(48, 148, 255, 0.44)";
    ctx.fillRect(bX, 6, 22, 7);
    const s1X = isEast ? boxL : cw - (boxL + 14);
    const s2X = isEast ? boxR - 13 : cw - (boxR - 1);
    ctx.fillStyle = flash === 0 ? "rgba(255, 48, 48, 0.38)" : "rgba(255, 184, 48, 0.38)";
    ctx.fillRect(s1X, 1, 14, 6);
    ctx.fillStyle = flash === 0 ? "rgba(48, 148, 255, 0.38)" : "rgba(255, 48, 48, 0.38)";
    ctx.fillRect(s2X, 1, 14, 6);
    // Warm glowing road headlight cone ahead of bumper
    ctx.fillStyle = "rgba(255, 246, 170, 0.30)";
    ctx.fillRect(isEast ? cw - 3 : 0, 27, 3, 8);
  };

  return {
    east: g.toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.46, ry: 4.2 }, makePost(true)),
    west: g.flipHorizontal().toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.46, ry: 4.2 }, makePost(false)),
  };
}

function bake32BitPoliceCruiser(flash = 0, drawMiniText = null) {
  const cw = 68;
  const ch = 40;
  const g = new PixelGrid(cw, ch);
  const wheelY = ch - 9;
  const bodyBot = ch - 10;
  const bodyTop = 16;

  // 1. Sleek Black-and-White Police Interceptor Sedan Body!
  g.rect(4, bodyTop, cw - 8, bodyBot - bodyTop, "#1e2430", "paint");
  g.rect(5, bodyTop, cw - 12, 3, "#3b4559", "paint");
  g.rect(cw - 16, bodyTop + 1, 13, bodyBot - bodyTop - 1, "#1e2430", "paint");
  g.rect(cw - 6, bodyTop + 3, 3, bodyBot - bodyTop - 3, "#1e2430", "paint");
  // Crisp White Police Doors + Metallic Gold Police Shield Badge!
  g.rect(19, bodyTop, 28, bodyBot - bodyTop - 2, "#edf2f7", "chrome");
  g.rect(20, bodyTop, 26, 2, "#ffffff", "chrome");
  g.rect(19, bodyBot - 5, 28, 3, "#c4cfde", "chrome");
  // Royal-blue interceptor side stripe + golden star badge on rear quarter
  g.rect(5, bodyTop + 7, cw - 11, 2, "#2464bd", "glass");
  g.rect(41, bodyTop + 5, 4, 4, "#f4d35e", "light");
  g.set(42, bodyTop + 6, "#2464bd", "glass");

  // 2. Sculpted White Roof + Angled Tinted Cabin + Officer Silhouette + A-Pillar Spotlight!
  const cabL = 13;
  const cabR = cw - 19;
  for (let row = 0; row <= bodyTop - 7; row++) {
    const t = row / Math.max(1, bodyTop - 7);
    const xl = Math.round(cabL - t * 5);
    const xr = Math.round(cabR + t * 7);
    g.rect(xl, 7 + row, xr - xl, 1, row <= 2 ? "#ffffff" : "#dce4ee", "chrome");
  }
  // Tinted windows + diagonal sky reflection + police officer silhouette
  g.rect(cabL + 1, 10, cabR - cabL - 2, 7, "#1e344d", "glass");
  g.line(cabL + 3, 11, cabL + 7, 16, "#8fdbfa", "glass");
  g.ellipse(cabR - 6, 13, 2.3, 2.3, "#36475e", "glass");
  g.rect(cabR - 7, 10, 4, 2, "#1c365c", "dark"); // Police cap inside!
  g.rect(Math.round((cabL + cabR) / 2), 10, 2, 7, "#1e2430", "dark");
  // Chrome A-pillar searchlight!
  g.rect(cabR + 1, 13, 4, 3, "#dce4ee", "chrome");
  g.set(cabR + 4, 14, "#fff8a6", "light");

  // 3. Heavy Black Steel Police Push Bumper + Flashing Grille Strobes + Headlights/Taillights!
  g.rect(cw - 4, bodyTop + 3, 3, bodyBot - bodyTop - 2, "#181c24", "dark");
  g.rect(cw - 5, bodyTop + 4, 2, 2, flash === 0 ? "#2b90ff" : "#ff2626", "light");
  g.rect(cw - 7, bodyTop + 2, 3, 4, "#fff49e", "light");
  g.rect(3, bodyTop + 2, 4, 4, "#e62420", "light");
  g.rect(2, bodyBot - 4, 4, 4, "#2d3442", "dark");

  // 4. Flashing Red / White / Blue Police Roof Lightbar!
  const barX = Math.round((cabL + cabR) / 2) - 6;
  g.rect(barX, 3, 12, 4, "#1e222c", "dark");
  g.rect(barX + 1, 4, 4, 2, flash === 0 ? "#ff2626" : "#2b90ff", "light");
  g.rect(barX + 5, 4, 2, 2, "#ffffff", "light");
  g.rect(barX + 7, 4, 4, 2, flash === 0 ? "#2b90ff" : "#ff2626", "light");

  // 5. Heavy-Duty Interceptor Alloy Wheels
  for (const wx of [16, cw - 15]) {
    g.ellipse(wx, wheelY, 6.8, 6.2, "#151720", "tire");
    draw32BitWheel(g, wx, wheelY, 5.2, "#2464bd");
  }

  g.applySelOut({ ...BASE_SELOUT, paint: "#10141c" });
  const makePost = (isEast) => (ctx) => {
    if (drawMiniText) {
      drawMiniText(ctx, "POLICE", isEast ? 32 : 36, bodyTop + 1, "#183b7a", 1);
    }
    const hx = isEast ? barX - 4 : cw - (barX + 16);
    ctx.fillStyle = flash === 0 ? "rgba(255, 40, 40, 0.44)" : "rgba(40, 140, 255, 0.44)";
    ctx.fillRect(hx, 0, 20, 6);
    ctx.fillStyle = "rgba(255, 246, 170, 0.25)";
    ctx.fillRect(isEast ? cw - 2 : 0, bodyTop + 2, 2, 5);
  };

  return {
    east: g.toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.46, ry: 3.6 }, makePost(true)),
    west: g.flipHorizontal().toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.46, ry: 3.6 }, makePost(false)),
  };
}

function bake32BitFireTruck(flash = 0, drawMiniText = null) {
  const cw = 106;
  const ch = 52;
  const g = new PixelGrid(cw, ch);
  const wheelY = ch - 9;
  const bodyBot = ch - 10;

  // 1. Gleaming Metallic Crimson Newton Fire Dept. Pumper Body!
  const bodyL = 6;
  const cabL = 72;
  // Long gleaming aluminum extension ladder mounted on overhead chrome racks!
  g.rect(bodyL + 2, 7, 66, 5, "#cfd8e3", "chrome");
  g.rect(bodyL + 2, 7, 66, 1, "#ffffff", "chrome");
  g.rect(bodyL + 2, 11, 66, 1, "#8c97a8", "chrome");
  for (let rx = bodyL + 6; rx < bodyL + 66; rx += 5) {
    g.rect(rx, 8, 2, 3, "#5a6475", "chrome"); // Ladder rungs!
  }
  g.rect(bodyL + 10, 12, 3, 4, "#aeb8c7", "chrome");
  g.rect(bodyL + 56, 12, 3, 4, "#aeb8c7", "chrome");

  // Rear apparatus body (5-tone fire-engine red!)
  g.rect(bodyL, 15, cabL - bodyL - 1, bodyBot - 15, "#cf241d", "paint");
  g.rect(bodyL + 1, 15, cabL - bodyL - 3, 3, "#f25549", "paint");
  g.rect(bodyL + 2, 15, cabL - bodyL - 5, 1, "#ff998f", "paint");
  g.rect(bodyL, bodyBot - 5, cabL - bodyL - 1, 5, "#8f1411", "paint");
  // Reflective white & gold firefighter safety stripe along entire pumper!
  g.rect(bodyL, 27, cw - bodyL - 6, 4, "#f2f6fa", "chrome");
  g.rect(bodyL, 26, cw - bodyL - 6, 1, "#f4d35e", "light");
  // Silver diamond-plate equipment roll-up compartments & midship pump control panel!
  g.rect(bodyL + 6, 19, 18, 18, "#c2ccd9", "chrome");
  g.rect(bodyL + 7, 20, 16, 16, "#dce4ee", "chrome");
  for (let sy = 22; sy < 35; sy += 3) {
    g.line(bodyL + 7, sy, bodyL + 22, sy, "#9aa5b5", "chrome");
  }
  // Midship Pump Panel with colorful pressure gauges & golden hose valve!
  g.rect(bodyL + 46, 18, 16, 19, "#aeb8c7", "chrome");
  g.rect(bodyL + 47, 19, 14, 17, "#cfd8e3", "chrome");
  g.rect(bodyL + 49, 21, 3, 3, "#ffffff", "chrome");
  g.set(bodyL + 50, 22, "#d9221c", "helmet");
  g.rect(bodyL + 54, 21, 3, 3, "#ffffff", "chrome");
  g.set(bodyL + 55, 22, "#2464bd", "glass");
  g.ellipse(bodyL + 54, 30, 3.2, 3.2, "#f4d35e", "light"); // Brass intake valve!
  g.set(bodyL + 54, 30, "#8c6514", "chrome");
  // Rolled bright yellow fire hose stacked on rear deck
  g.rect(bodyL + 1, 13, 12, 3, "#f4d35e", "light");
  g.rect(bodyL + 2, 13, 10, 1, "#fff4a8", "light");
  // Rear chrome step plate & tail lights
  g.rect(bodyL - 3, bodyBot - 4, 4, 4, "#dce4ee", "chrome");
  g.rect(bodyL, 20, 3, 5, "#ff362e", "light");

  // 2. Sculpted Forward Fire Engine Crew Cab (flat-nose American pumper!)
  g.rect(cabL, 12, cw - cabL - 5, bodyBot - 12, "#cf241d", "paint");
  g.rect(cabL + 1, 12, cw - cabL - 7, 4, "#f25549", "paint");
  g.rect(cabL + 2, 12, cw - cabL - 9, 1, "#ff998f", "paint");
  g.rect(cabL, bodyBot - 5, cw - cabL - 5, 5, "#8f1411", "paint");
  // Big split crew-cab windows + firefighter in yellow helmet inside!
  g.rect(cabL + 3, 16, 9, 8, "#203852", "glass");
  g.line(cabL + 5, 17, cabL + 8, 23, "#96e0fc", "glass");
  g.rect(cabL + 14, 16, 13, 8, "#203852", "glass");
  g.line(cabL + 16, 17, cabL + 20, 23, "#96e0fc", "glass");
  g.ellipse(cabL + 19, 20, 2.3, 2.3, "#3a4f66", "glass");
  g.rect(cabL + 17, 17, 5, 2, "#f4d35e", "light"); // Yellow firefighter helmet!
  // Chrome air horn on roof + big side mirror + gleaming chrome radiator grille & extended front bumper!
  g.rect(cabL + 14, 10, 6, 2, "#e6edf5", "chrome");
  g.rect(cabL + 24, 18, 3, 6, "#dce4ee", "chrome");
  g.rect(cw - 6, 24, 3, 12, "#dce4ee", "chrome"); // Chrome front grille
  g.rect(cw - 5, bodyBot - 6, 5, 6, "#e6edf5", "chrome"); // Extended front chrome bumper!
  g.rect(cw - 4, bodyBot - 6, 3, 2, "#ffffff", "chrome");
  g.rect(cw - 8, 28, 4, 5, "#fff49e", "light");

  // 3. Flashing Red / White Fire Engine Lightbar & Rear Beacons!
  const barX = cabL + 6;
  g.rect(barX, 7, 14, 5, "#242834", "dark");
  g.rect(barX + 1, 8, 4, 3, flash === 0 ? "#ff2626" : "#ffffff", "light");
  g.rect(barX + 5, 8, 4, 3, flash === 0 ? "#ffffff" : "#ff2626", "light");
  g.rect(barX + 9, 8, 4, 3, flash === 0 ? "#ff2626" : "#ffae2b", "light");
  g.rect(bodyL + 2, 11, 5, 4, "#242834", "dark");
  g.rect(bodyL + 3, 12, 3, 2, flash === 0 ? "#ff2626" : "#ffffff", "light");

  // 4. Heavy Chrome Fire Engine Wheels (dual rear + front!)
  for (const wx of [18, 32, cw - 17]) {
    g.ellipse(wx, wheelY, 7.6, 7.0, "#151720", "tire");
    draw32BitWheel(g, wx, wheelY, 6.0, "#f4d35e");
  }

  g.applySelOut({ ...BASE_SELOUT, paint: "#4a0a0a" });
  const makePost = (isEast) => (ctx) => {
    if (drawMiniText) {
      drawMiniText(ctx, "FIRE", isEast ? 41 : 65, 19, "#fff6c2", 1);
    }
    const bX = isEast ? barX - 4 : cw - (barX + 18);
    ctx.fillStyle = flash === 0 ? "rgba(255, 44, 44, 0.46)" : "rgba(255, 240, 180, 0.42)";
    ctx.fillRect(bX, 2, 22, 7);
    const rX = isEast ? bodyL - 1 : cw - (bodyL + 11);
    ctx.fillStyle = flash === 0 ? "rgba(255, 44, 44, 0.36)" : "rgba(255, 255, 255, 0.34)";
    ctx.fillRect(rX, 7, 12, 6);
    ctx.fillStyle = "rgba(255, 246, 170, 0.32)";
    ctx.fillRect(isEast ? cw - 3 : 0, 27, 3, 8);
  };

  return {
    east: g.toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.47, ry: 4.4 }, makePost(true)),
    west: g.flipHorizontal().toCanvas(0.5, { cx: cw / 2, cy: ch - 4, rx: cw * 0.47, ry: 4.4 }, makePost(false)),
  };
}

/**
 * Bake all hero-grade 32-bit traffic cars, SUVs, pickup/box trucks, annoying spandex bikers,
 * and the full Newton Emergency Fleet (EMS Ambulance, Police Cruiser & Fire Pumper Engine)!
 */
export function bake32BitVehicleSprites({ drawMiniText = null } = {}) {
  const out = {};

  // 4 Hero-Grade Cars & SUVs (East, West, North, South)
  CAR_PALETTES.forEach((pal, idx) => {
    const sides = bake32BitCarSideEast(pal);
    out[`traffic_car_${idx}_e`] = sides.east;
    out[`traffic_car_${idx}_w`] = sides.west;
    out[`traffic_car_${idx}_n`] = bake32BitCarVertical(pal, false);
    out[`traffic_car_${idx}_s`] = bake32BitCarVertical(pal, true);
  });

  // 3 Hero-Grade Trucks (Pickup + 2 Box Delivery Trucks)
  TRUCK_SPECS.forEach((tr, idx) => {
    const sides = bake32BitTruckSideEast(tr);
    out[`traffic_truck_${idx}_e`] = sides.east;
    out[`traffic_truck_${idx}_w`] = sides.west;
    out[`traffic_truck_${idx}_n`] = bake32BitTruckVertical(tr, false);
    out[`traffic_truck_${idx}_s`] = bake32BitTruckVertical(tr, true);
  });

  // Hero-Grade Animated Annoying Spandex Road Bikers (2 pedaling frames x 4 directions!)
  for (let frame = 0; frame < 2; frame++) {
    const sides = bake32BitBikerSideEast(frame);
    out[`traffic_bike_${frame}_e`] = sides.east;
    out[`traffic_bike_${frame}_w`] = sides.west;
    out[`traffic_bike_${frame}_n`] = bake32BitBikerVertical(frame, false);
    out[`traffic_bike_${frame}_s`] = bake32BitBikerVertical(frame, true);
  }

  // Hero-Grade Newton EMS Type-III Box Ambulance (Closed & Swung-Open Doors x 2 Strobe Frames!)
  for (const openDoors of [false, true]) {
    for (let flash = 0; flash < 2; flash++) {
      const amb = bake32BitAmbulance(openDoors, flash, drawMiniText);
      const suffix = openDoors ? `_open_${flash}` : `_${flash}`;
      out[`ambulance_e${suffix}`] = amb.east;
      out[`ambulance_w${suffix}`] = amb.west;
    }
  }

  // Police Interceptor Cruiser & Fire Rescue Pumper (2 Strobe Frames each!)
  for (let flash = 0; flash < 2; flash++) {
    const pol = bake32BitPoliceCruiser(flash, drawMiniText);
    out[`police_car_e_${flash}`] = pol.east;
    out[`police_car_w_${flash}`] = pol.west;

    const fire = bake32BitFireTruck(flash, drawMiniText);
    out[`fire_truck_e_${flash}`] = fire.east;
    out[`fire_truck_w_${flash}`] = fire.west;
  }

  return out;
}
