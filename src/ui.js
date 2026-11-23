import { HOUSE_COLOR_PRESETS, ROOF_PRESETS } from "./tileset.js";

/**
 * Phase 2 UI overlay: SNES gold-framed street banner, Safety XP + Coins/Acorns HUD,
 * per-address house / landmark proximity pill, live Real-House Color Painter, SFX mute toggle,
 * and multi-touch iPad controls.
 */

export function createUI({
  onToggleDebug,
  onResetHome,
  onLookBothWays,
  onToggleMute,
  onOpenPaint,
} = {}) {
  const bannerEl = document.getElementById("street-banner");
  const streetNameEl = document.getElementById("street-name");
  const streetZoneEl = document.getElementById("street-zone");
  const xpEl = document.getElementById("hud-xp");
  const bagEl = document.getElementById("hud-bag");
  const coordsEl = document.getElementById("hud-coords");
  const tileEl = document.getElementById("hud-tile");
  const safetyToastEl = document.getElementById("safety-toast");
  const landmarkPillEl = document.getElementById("landmark-pill");

  const dpadEl = document.getElementById("dpad");
  const btnPaint = document.getElementById("btn-paint");
  const btnMute = document.getElementById("btn-mute");
  const btnDebug = document.getElementById("btn-debug");
  const btnHome = document.getElementById("btn-home");
  const btnFaster = document.getElementById("btn-faster");
  const btnLook = document.getElementById("btn-look");

  const dpadButtons = {
    up: dpadEl?.querySelector('[data-dir="up"]'),
    down: dpadEl?.querySelector('[data-dir="down"]'),
    left: dpadEl?.querySelector('[data-dir="left"]'),
    right: dpadEl?.querySelector('[data-dir="right"]'),
  };

  const touchInput = { x: 0, y: 0 };
  let activeDpadPointerId = null;
  let fasterHeld = false;
  let fasterPointerId = null;
  let toastTimer = null;
  let bannerTimer = null;

  function updateDpadVisuals() {
    dpadButtons.up?.classList.toggle("active", touchInput.y < 0);
    dpadButtons.down?.classList.toggle("active", touchInput.y > 0);
    dpadButtons.left?.classList.toggle("active", touchInput.x < 0);
    dpadButtons.right?.classList.toggle("active", touchInput.x > 0);
  }

  function updateFromPointer(clientX, clientY) {
    if (!dpadEl) return;
    const rect = dpadEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const deadzone = 12;

    if (dist < deadzone) {
      touchInput.x = 0;
      touchInput.y = 0;
    } else {
      const angle = Math.atan2(dy, dx);
      const octant = Math.round(angle / (Math.PI / 4));
      const dirs = {
        0: [1, 0],
        1: [1, 1],
        2: [0, 1],
        3: [-1, 1],
        4: [-1, 0],
        "-4": [-1, 0],
        "-3": [-1, -1],
        "-2": [0, -1],
        "-1": [1, -1],
      };
      const [ix, iy] = dirs[octant] || [0, 0];
      touchInput.x = ix;
      touchInput.y = iy;
    }
    updateDpadVisuals();
  }

  function releaseDpad() {
    activeDpadPointerId = null;
    touchInput.x = 0;
    touchInput.y = 0;
    updateDpadVisuals();
  }

  if (dpadEl) {
    dpadEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      activeDpadPointerId = e.pointerId;
      dpadEl.setPointerCapture?.(e.pointerId);
      updateFromPointer(e.clientX, e.clientY);
    });
    dpadEl.addEventListener("pointermove", (e) => {
      if (e.pointerId !== activeDpadPointerId) return;
      e.preventDefault();
      updateFromPointer(e.clientX, e.clientY);
    });
    dpadEl.addEventListener("pointerup", (e) => {
      if (e.pointerId === activeDpadPointerId) releaseDpad();
    });
    dpadEl.addEventListener("pointercancel", (e) => {
      if (e.pointerId === activeDpadPointerId) releaseDpad();
    });
  }

  if (btnFaster) {
    const releaseFaster = () => {
      fasterPointerId = null;
      fasterHeld = false;
      btnFaster.classList.remove("active");
    };
    btnFaster.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      fasterPointerId = e.pointerId;
      fasterHeld = true;
      btnFaster.classList.add("active");
      btnFaster.setPointerCapture?.(e.pointerId);
    });
    btnFaster.addEventListener("pointerup", (e) => {
      if (e.pointerId === fasterPointerId) releaseFaster();
    });
    btnFaster.addEventListener("pointercancel", (e) => {
      if (e.pointerId === fasterPointerId) releaseFaster();
    });
  }

  if (btnLook) {
    btnLook.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btnLook.classList.add("active");
      onLookBothWays?.();
    });
    btnLook.addEventListener("pointerup", () => btnLook.classList.remove("active"));
    btnLook.addEventListener("pointercancel", () => btnLook.classList.remove("active"));
  }

  btnPaint?.addEventListener("click", () => {
    onOpenPaint?.();
  });

  btnMute?.addEventListener("click", () => {
    const isNowMuted = onToggleMute?.();
    if (btnMute) {
      btnMute.textContent = isNowMuted ? "🔇 Muted" : "🔊 SFX";
      btnMute.classList.toggle("active", Boolean(isNowMuted));
    }
  });

  btnDebug?.addEventListener("click", () => {
    const enabled = onToggleDebug?.();
    btnDebug.classList.toggle("active", Boolean(enabled));
  });

  btnHome?.addEventListener("click", () => {
    onResetHome?.();
  });

  function showSafetyToast(message, durationMs = 2000) {
    if (!safetyToastEl) return;
    safetyToastEl.textContent = message;
    safetyToastEl.classList.add("visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      safetyToastEl.classList.remove("visible");
    }, durationMs);
  }

  let lastStreetKey = "";

  function updateHUD({
    tileX,
    tileY,
    tileType,
    streetZone,
    originName,
    nearestLandmark,
    nearestBuilding,
    debugEnabled,
    muted = false,
    safetyXP = 0,
    coins = 0,
    acorns = 0,
    isFasterActive = false,
    safeCrossingActive = false,
  }) {
    if (xpEl) {
      xpEl.textContent = safeCrossingActive
        ? `Safety XP: ${safetyXP} ✓`
        : `Safety XP: ${safetyXP}`;
    }
    if (bagEl) {
      bagEl.textContent = `🪙 ${coins} • 🌰 ${acorns}`;
    }
    if (coordsEl) coordsEl.textContent = `Tile ${tileX}, ${tileY}`;
    if (tileEl) {
      tileEl.textContent = isFasterActive ? `${tileType} • SCOOTER` : tileType;
    }
    if (btnDebug) btnDebug.classList.toggle("active", Boolean(debugEnabled));
    if (btnMute) {
      btnMute.textContent = muted ? "🔇 Muted" : "🔊 SFX";
      btnMute.classList.toggle("active", Boolean(muted));
    }
    if (btnFaster) btnFaster.classList.toggle("active", Boolean(fasterHeld || isFasterActive));

    const displayName = streetZone ? streetZone.name : originName || "Newton Centre";
    const displayTag = streetZone ? streetZone.type : tileType;
    const key = `${displayName}|${displayTag}`;
    if (key !== lastStreetKey) {
      lastStreetKey = key;
      if (streetNameEl) streetNameEl.textContent = displayName;
      if (streetZoneEl) streetZoneEl.textContent = displayTag;
      if (bannerEl) {
        bannerEl.classList.add("slide-pop");
        if (bannerTimer) clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => bannerEl.classList.remove("slide-pop"), 320);
      }
    }

    // Prioritize nearby named landmark, otherwise show individual per-address house!
    if (landmarkPillEl) {
      if (nearestLandmark && nearestLandmark.distTiles <= 4.5) {
        landmarkPillEl.textContent = `★ ${nearestLandmark.landmark.name}`;
        landmarkPillEl.classList.add("visible");
      } else if (nearestBuilding && nearestBuilding.distTiles <= 2.2) {
        const b = nearestBuilding.building;
        const label = b.isHomeBase
          ? `🏠 ${b.address} — Home Base`
          : b.name && b.address
            ? `🏠 ${b.name} (${b.address})`
            : b.address
              ? `🏠 ${b.address}`
              : b.name
                ? `🏠 ${b.name}`
                : "";
        if (label) {
          landmarkPillEl.textContent = label;
          landmarkPillEl.classList.add("visible");
        } else {
          landmarkPillEl.classList.remove("visible");
        }
      } else {
        landmarkPillEl.classList.remove("visible");
      }
    }
  }

  const paintModalEl = document.getElementById("paint-modal");
  const paintTitleEl = document.getElementById("paint-title");
  const wallSwatchesEl = document.getElementById("wall-swatches");
  const roofSwatchesEl = document.getElementById("roof-swatches");
  const btnPaintClose = document.getElementById("btn-paint-close");
  const btnPaintCopy = document.getElementById("btn-paint-copy");
  const btnPaintReset = document.getElementById("btn-paint-reset");

  let activePaintBuilding = null;
  let paintHandlers = null;

  function renderSwatches(currentOverride = {}) {
    if (wallSwatchesEl) {
      wallSwatchesEl.innerHTML = "";
      for (const [key, preset] of Object.entries(HOUSE_COLOR_PRESETS)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `swatch-btn${currentOverride.preset === key ? " active" : ""}`;
        btn.innerHTML = `<span class="swatch-dot" style="background:${preset.swatch}"></span><span>${preset.label.split(" ")[0]}</span>`;
        btn.addEventListener("click", () => {
          if (!activePaintBuilding) return;
          const updated = paintHandlers?.onPickWall?.(activePaintBuilding, key);
          renderSwatches(updated || {});
        });
        wallSwatchesEl.appendChild(btn);
      }
    }
    if (roofSwatchesEl) {
      roofSwatchesEl.innerHTML = "";
      for (const [key, preset] of Object.entries(ROOF_PRESETS)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `swatch-btn${currentOverride.roof === key ? " active" : ""}`;
        btn.innerHTML = `<span class="swatch-dot" style="background:${preset.swatch}"></span><span>${preset.label.split(" ")[0]}</span>`;
        btn.addEventListener("click", () => {
          if (!activePaintBuilding) return;
          const updated = paintHandlers?.onPickRoof?.(activePaintBuilding, key);
          renderSwatches(updated || {});
        });
        roofSwatchesEl.appendChild(btn);
      }
    }
  }

  function openPaintModal(building, currentOverride, handlers) {
    if (!paintModalEl || !building) return;
    activePaintBuilding = building;
    paintHandlers = handlers;
    const addrLabel = building.address || building.name || building.id;
    if (paintTitleEl) paintTitleEl.textContent = `🎨 ${addrLabel}`;
    renderSwatches(currentOverride || {});
    paintModalEl.classList.add("open");
  }

  function closePaintModal() {
    paintModalEl?.classList.remove("open");
    activePaintBuilding = null;
  }

  btnPaintClose?.addEventListener("click", closePaintModal);
  paintModalEl?.addEventListener("click", (e) => {
    if (e.target === paintModalEl) closePaintModal();
  });
  btnPaintReset?.addEventListener("click", () => {
    if (!activePaintBuilding) return;
    paintHandlers?.onResetHouse?.(activePaintBuilding);
    renderSwatches({});
  });
  btnPaintCopy?.addEventListener("click", async () => {
    const jsonText = paintHandlers?.onExportJson?.();
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
      showSafetyToast("📋 Copied house_colors.json to clipboard!");
    } catch {
      console.log("house_colors.json:\n" + jsonText);
      showSafetyToast("📋 Logged house_colors.json in console!");
    }
  });

  return {
    getTouchInput: () => ({ x: touchInput.x, y: touchInput.y }),
    isFasterHeld: () => fasterHeld,
    showSafetyToast,
    openPaintModal,
    closePaintModal,
    isPaintOpen: () => Boolean(paintModalEl?.classList.contains("open")),
    updateHUD,
  };
}
