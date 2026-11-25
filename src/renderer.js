import kaplay from "kaplay";

/**
 * Safely probe WebGL support on a throwaway canvas so we never taint the game canvas.
 */
export function isWebGLSupported() {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    const gl =
      probe.getContext("webgl2") ||
      probe.getContext("webgl") ||
      probe.getContext("experimental-webgl");
    if (!gl) return false;
    gl.getExtension?.("WEBGL_lose_context")?.loseContext?.();
    return true;
  } catch {
    return false;
  }
}

/**
 * Detect iPadOS / iOS touch devices (including modern iPads that report "MacIntel"
 * with maxTouchPoints > 1). On iPad Safari, our 640x360 HTML5 2D Canvas renderer
 * blits offscreen chunk & house canvases directly via CoreGraphics/Metal with zero
 * PNG toDataURL encoding stalls or WebGL texture-bind overhead — running at a
 * locked 60 FPS compared to Kaplay's per-sprite WebGL textures!
 */
export function isIPadOrIOSDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) return true;
  return false;
}

function normalizeKey(key) {
  const lower = String(key).toLowerCase();
  if (lower === "arrowleft") return "left";
  if (lower === "arrowright") return "right";
  if (lower === "arrowup") return "up";
  if (lower === "arrowdown") return "down";
  if (lower === " ") return "space";
  return lower;
}

/**
 * Pure HTML5 2D Canvas fallback renderer with identical API to our Kaplay wrapper.
 * Renders at 4x HD pixel density (1280x720 for 320x180 logical world) so HD vector
 * streets, smooth curved curbs, double-yellow centerlines & crosswalks render at
 * razor-sharp 720p while 16-bit & 32-bit pixel sprites stay crisp exact integer scales!
 */
function createCanvas2DRenderer({ canvas, width, height, background }) {
  const HD = 4;
  canvas.width = width * HD;
  canvas.height = height * HD;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Neither WebGL nor 2D Canvas context is available");
  }
  ctx.imageSmoothingEnabled = false;

  const bgCss = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
  const sunGrad = ctx.createRadialGradient(
    canvas.width * 0.5,
    -canvas.height * 0.1,
    canvas.width * 0.05,
    canvas.width * 0.5,
    canvas.height * 0.12,
    canvas.width * 0.65
  );
  sunGrad.addColorStop(0, "rgba(255, 196, 98, 0.22)");
  sunGrad.addColorStop(0.45, "rgba(255, 148, 68, 0.08)");
  sunGrad.addColorStop(1, "rgba(255, 130, 56, 0)");
  const keysDown = new Set();
  const keyPressHandlers = new Map();
  const updateHandlers = [];
  const drawHandlers = [];
  const spriteCache = new Map();
  const spriteScales = new Map();

  let camX = width / 2;
  let camY = height / 2;
  let camRotDeg = 0;
  let deltaTime = 1 / 60;
  let lastTime = performance.now();

  function fitLetterbox() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / width, vh / height);
    const drawW = Math.max(1, Math.round(width * scale));
    const drawH = Math.max(1, Math.round(height * scale));
    canvas.style.width = `${drawW}px`;
    canvas.style.height = `${drawH}px`;
  }

  fitLetterbox();
  window.addEventListener("resize", fitLetterbox);

  window.addEventListener("keydown", (e) => {
    const key = normalizeKey(e.key);
    if (["left", "right", "up", "down", "space"].includes(key)) {
      e.preventDefault();
    }
    const wasDown = keysDown.has(key);
    keysDown.add(key);
    if (!wasDown) {
      const list = keyPressHandlers.get(key);
      if (list) list.forEach((fn) => fn());
    }
  });

  window.addEventListener("keyup", (e) => {
    keysDown.delete(normalizeKey(e.key));
  });

  window.addEventListener("blur", () => {
    keysDown.clear();
  });

  function frame(now) {
    deltaTime = Math.max(0.001, Math.min((now - lastTime) / 1000, 0.1));
    lastTime = now;

    for (const fn of updateHandlers) fn();

    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bgCss;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(HD, HD);
    if (camRotDeg !== 0) {
      ctx.translate(Math.round(width / 2), Math.round(height / 2));
      ctx.rotate((camRotDeg * Math.PI) / 180);
      ctx.translate(-Math.round(camX), -Math.round(camY));
    } else {
      ctx.translate(Math.round(width / 2 - camX), Math.round(height / 2 - camY));
    }
    for (const fn of drawHandlers) fn();
    ctx.restore();

    // Subtle Golden-Hour Autumn Sunlight Wash radiating gently from top-center (pre-built gradient, zero per-frame alloc!)
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, canvas.width, Math.round(canvas.height * 0.65));
    ctx.restore();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    mode: "canvas-2d",
    dt: () => deltaTime,
    vec2: (x, y) => ({ x, y }),
    rgb: (r, g, b) => ({ r, g, b }),
    setCamPos: (x, y) => {
      camX = x;
      camY = y;
    },
    setCamRot: (deg) => {
      camRotDeg = Number(deg) || 0;
    },
    isKeyDown: (key) => keysDown.has(normalizeKey(key)),
    onKeyPress: (key, fn) => {
      const k = normalizeKey(key);
      if (!keyPressHandlers.has(k)) keyPressHandlers.set(k, []);
      keyPressHandlers.get(k).push(fn);
    },
    onUpdate: (fn) => updateHandlers.push(fn),
    onDraw: (fn) => drawHandlers.push(fn),
    registerSprites: async (spriteCanvases) => {
      for (const [name, sprCanvas] of Object.entries(spriteCanvases)) {
        spriteCache.set(name, sprCanvas);
        spriteScales.set(name, sprCanvas?.__pixelScale || 1);
      }
    },
    drawSprite: (name, x, y, opacity = 1, angleDeg = 0, pivotX = null, pivotY = null) => {
      const img = spriteCache.get(name);
      if (!img) return;
      const ps = spriteScales.get(name) || 1;
      const dw = img.width * ps;
      const dh = img.height * ps;
      if (angleDeg) {
        const px = pivotX !== null ? pivotX : Math.round(x) + dw / 2;
        const py = pivotY !== null ? pivotY : Math.round(y) + dh / 2;
        ctx.save();
        if (opacity < 1) ctx.globalAlpha = opacity;
        ctx.translate(px, py);
        ctx.rotate((angleDeg * Math.PI) / 180);
        ctx.drawImage(img, Math.round(x - px), Math.round(y - py), dw, dh);
        ctx.restore();
      } else if (opacity < 1) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(img, Math.round(x), Math.round(y), dw, dh);
      }
    },
    drawCanvas: (_key, offscreenCanvas, x, y, opacity = 1) => {
      if (!offscreenCanvas) return;
      const ps = offscreenCanvas.__pixelScale || 1;
      const dw = offscreenCanvas.width * ps;
      const dh = offscreenCanvas.height * ps;
      const step = ps < 1 ? Math.round(1 / ps) : 1;
      const dx = step > 1 ? Math.round(x * step) / step : Math.round(x);
      const dy = step > 1 ? Math.round(y * step) / step : Math.round(y);
      if (opacity < 1) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(offscreenCanvas, dx, dy, dw, dh);
        ctx.restore();
      } else {
        ctx.drawImage(offscreenCanvas, dx, dy, dw, dh);
      }
    },
    drawRect: ({ pos, width: w, height: h, color, opacity = 1, fill = true, outline = null }) => {
      ctx.save();
      if (fill !== false && color) {
        ctx.globalAlpha = opacity;
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(Math.round(pos.x), Math.round(pos.y), Math.round(w), Math.round(h));
      }
      if (outline && outline.color) {
        ctx.globalAlpha = outline.opacity ?? opacity;
        ctx.strokeStyle = `rgb(${outline.color.r}, ${outline.color.g}, ${outline.color.b})`;
        ctx.lineWidth = outline.width ?? 1;
        ctx.strokeRect(
          Math.round(pos.x) + 0.5,
          Math.round(pos.y) + 0.5,
          Math.max(0, Math.round(w) - 1),
          Math.max(0, Math.round(h) - 1)
        );
      }
      ctx.restore();
    },
  };
}

/**
 * Create the game renderer: uses Kaplay (WebGL) when supported, and falls back
 * seamlessly to crisp HTML5 2D Canvas when WebGL is unavailable.
 */
export function createRenderer({
  canvas,
  width = 320,
  height = 180,
  background = [20, 28, 24],
}) {
  if (!isIPadOrIOSDevice() && isWebGLSupported()) {
    try {
      const HD = 4;
      const k = kaplay({
        width: width * HD,
        height: height * HD,
        letterbox: true,
        crisp: true,
        canvas,
        background,
        global: false,
        touchToMouse: false,
      });

      const dynamicReady = new Set();
      const dynamicLoading = new Set();
      const spriteScales = new Map();
      let camX = width / 2;
      let camY = height / 2;
      let camRotDeg = 0;

      // Pin Kaplay's built-in camera to screen center so we apply an identical
      // 2x HD pixel scale + translate -> rotate -> translate matrix to Canvas 2D!
      k.setCamPos((width * HD) / 2, (height * HD) / 2);

      return {
        mode: "kaplay-webgl",
        dt: () => k.dt(),
        vec2: (x, y) => k.vec2(x, y),
        rgb: (r, g, b) => k.rgb(r, g, b),
        setCamPos: (x, y) => {
          camX = x;
          camY = y;
        },
        setCamRot: (deg) => {
          camRotDeg = Number(deg) || 0;
        },
        isKeyDown: (key) => k.isKeyDown(key),
        onKeyPress: (key, fn) => k.onKeyPress(key, fn),
        onUpdate: (fn) => k.onUpdate(fn),
        onDraw: (fn) =>
          k.onDraw(() => {
            k.pushTransform();
            k.pushScale(HD, HD);
            k.pushTranslate(Math.round(width / 2), Math.round(height / 2));
            if (camRotDeg !== 0) k.pushRotate(camRotDeg);
            k.pushTranslate(-Math.round(camX), -Math.round(camY));
            fn();
            k.popTransform();
            // Subtle Golden-Hour Autumn Sunlight Wash across top-center of viewport!
            k.pushTransform();
            k.pushScale(HD, HD);
            k.drawRect({
              pos: k.vec2(0, 0),
              width,
              height: Math.round(height * 0.42),
              color: k.rgb(255, 178, 84),
              opacity: 0.09,
            });
            k.drawRect({
              pos: k.vec2(Math.round(width * 0.2), 0),
              width: Math.round(width * 0.6),
              height: Math.round(height * 0.28),
              color: k.rgb(255, 208, 112),
              opacity: 0.11,
            });
            k.drawRect({
              pos: k.vec2(Math.round(width * 0.34), 0),
              width: Math.round(width * 0.32),
              height: Math.round(height * 0.15),
              color: k.rgb(255, 228, 148),
              opacity: 0.11,
            });
            k.popTransform();
          }),
        registerSprites: async (spriteCanvases) => {
          const loads = Object.entries(spriteCanvases).map(([name, sprCanvas]) => {
            spriteScales.set(name, sprCanvas?.__pixelScale || 1);
            return k.loadSprite(name, sprCanvas.toDataURL("image/png"));
          });
          await Promise.all(loads);
        },
        drawSprite: (name, x, y, opacity = 1, angleDeg = 0, pivotX = null, pivotY = null) => {
          const ps = spriteScales.get(name) || 1;
          const scaleOpt = ps !== 1 ? { scale: k.vec2(ps, ps) } : {};
          if (angleDeg) {
            const px = pivotX !== null ? pivotX : Math.round(x);
            const py = pivotY !== null ? pivotY : Math.round(y);
            k.pushTransform();
            k.pushTranslate(px, py);
            k.pushRotate(angleDeg);
            k.drawSprite({
              sprite: name,
              pos: k.vec2(Math.round(x - px), Math.round(y - py)),
              opacity,
              ...scaleOpt,
            });
            k.popTransform();
          } else {
            k.drawSprite({
              sprite: name,
              pos: k.vec2(Math.round(x), Math.round(y)),
              opacity,
              ...scaleOpt,
            });
          }
        },
        drawCanvas: (key, offscreenCanvas, x, y, opacity = 1) => {
          if (!offscreenCanvas) return;
          const ps = offscreenCanvas.__pixelScale || 1;
          const scaleOpt = ps !== 1 ? { scale: k.vec2(ps, ps) } : {};
          const step = ps < 1 ? Math.round(1 / ps) : 1;
          const dx = step > 1 ? Math.round(x * step) / step : Math.round(x);
          const dy = step > 1 ? Math.round(y * step) / step : Math.round(y);
          if (dynamicReady.has(key)) {
            k.drawSprite({
              sprite: key,
              pos: k.vec2(dx, dy),
              opacity,
              ...scaleOpt,
            });
          } else if (!dynamicLoading.has(key)) {
            dynamicLoading.add(key);
            k.loadSprite(key, offscreenCanvas.toDataURL("image/png"))
              .then(() => dynamicReady.add(key))
              .catch(() => {});
          }
        },
        drawRect: (opts) => k.drawRect(opts),
      };
    } catch (err) {
      console.warn("Kaplay WebGL init failed; falling back to 2D Canvas:", err);
      if (canvas?.parentNode) {
        const fresh = canvas.cloneNode(false);
        canvas.parentNode.replaceChild(fresh, canvas);
        canvas = fresh;
      }
    }
  } else {
    console.info("WebGL not supported in this browser; using crisp HTML5 2D Canvas renderer.");
  }

  return createCanvas2DRenderer({ canvas, width, height, background });
}
