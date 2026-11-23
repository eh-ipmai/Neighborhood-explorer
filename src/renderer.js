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
 * Supports crisp pixel sprites, baked dynamic canvases (per-address houses), and 16:9 letterboxing.
 */
function createCanvas2DRenderer({ canvas, width, height, background }) {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Neither WebGL nor 2D Canvas context is available");
  }
  ctx.imageSmoothingEnabled = false;

  const bgCss = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
  const keysDown = new Set();
  const keyPressHandlers = new Map();
  const updateHandlers = [];
  const drawHandlers = [];
  const spriteCache = new Map();

  let camX = width / 2;
  let camY = height / 2;
  let deltaTime = 1 / 60;
  let lastTime = performance.now();

  function fitLetterbox() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const scale = Math.min(vw / width, vh / height);
    const effectiveScale = scale >= 2 ? Math.floor(scale) : scale;
    const drawW = Math.max(1, Math.round(width * effectiveScale));
    const drawH = Math.max(1, Math.round(height * effectiveScale));
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
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(Math.round(width / 2 - camX), Math.round(height / 2 - camY));
    for (const fn of drawHandlers) fn();
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
      }
    },
    drawSprite: (name, x, y, opacity = 1) => {
      const img = spriteCache.get(name);
      if (!img) return;
      if (opacity < 1) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, Math.round(x), Math.round(y));
        ctx.restore();
      } else {
        ctx.drawImage(img, Math.round(x), Math.round(y));
      }
    },
    drawCanvas: (_key, offscreenCanvas, x, y, opacity = 1) => {
      if (!offscreenCanvas) return;
      if (opacity < 1) {
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(offscreenCanvas, Math.round(x), Math.round(y));
        ctx.restore();
      } else {
        ctx.drawImage(offscreenCanvas, Math.round(x), Math.round(y));
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
  if (isWebGLSupported()) {
    try {
      const k = kaplay({
        width,
        height,
        letterbox: true,
        crisp: true,
        canvas,
        background,
        global: false,
        touchToMouse: false,
      });

      const dynamicReady = new Set();
      const dynamicLoading = new Set();

      return {
        mode: "kaplay-webgl",
        dt: () => k.dt(),
        vec2: (x, y) => k.vec2(x, y),
        rgb: (r, g, b) => k.rgb(r, g, b),
        setCamPos: (x, y) => k.setCamPos(x, y),
        isKeyDown: (key) => k.isKeyDown(key),
        onKeyPress: (key, fn) => k.onKeyPress(key, fn),
        onUpdate: (fn) => k.onUpdate(fn),
        onDraw: (fn) => k.onDraw(fn),
        registerSprites: async (spriteCanvases) => {
          const loads = Object.entries(spriteCanvases).map(([name, sprCanvas]) =>
            k.loadSprite(name, sprCanvas.toDataURL("image/png"))
          );
          await Promise.all(loads);
        },
        drawSprite: (name, x, y, opacity = 1) => {
          k.drawSprite({
            sprite: name,
            pos: k.vec2(Math.round(x), Math.round(y)),
            opacity,
          });
        },
        drawCanvas: (key, offscreenCanvas, x, y, opacity = 1) => {
          if (!offscreenCanvas) return;
          if (dynamicReady.has(key)) {
            k.drawSprite({
              sprite: key,
              pos: k.vec2(Math.round(x), Math.round(y)),
              opacity,
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
