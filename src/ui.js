/**
 * UI overlay: Street banner, Safety XP + coordinate HUD, safety toast, landmark pill,
 * and multi-touch iPad controls (Virtual D-pad + FASTER hold button + LOOK BOTH WAYS button).
 */

export function createUI({ onToggleDebug, onResetHome, onLookBothWays } = {}) {
  const streetNameEl = document.getElementById("street-name");
  const streetZoneEl = document.getElementById("street-zone");
  const xpEl = document.getElementById("hud-xp");
  const coordsEl = document.getElementById("hud-coords");
  const tileEl = document.getElementById("hud-tile");
  const safetyToastEl = document.getElementById("safety-toast");
  const landmarkPillEl = document.getElementById("landmark-pill");

  const dpadEl = document.getElementById("dpad");
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

  // Independent multi-touch pointer tracking for FASTER (hold)
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

  // Tap LOOK BOTH WAYS
  if (btnLook) {
    btnLook.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btnLook.classList.add("active");
      onLookBothWays?.();
    });
    btnLook.addEventListener("pointerup", () => btnLook.classList.remove("active"));
    btnLook.addEventListener("pointercancel", () => btnLook.classList.remove("active"));
  }

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
    debugEnabled,
    safetyXP = 0,
    isFasterActive = false,
    safeCrossingActive = false,
  }) {
    if (xpEl) {
      xpEl.textContent = safeCrossingActive
        ? `Safety XP: ${safetyXP} ✓`
        : `Safety XP: ${safetyXP}`;
    }
    if (coordsEl) coordsEl.textContent = `Tile ${tileX}, ${tileY}`;
    if (tileEl) {
      tileEl.textContent = isFasterActive ? `${tileType} • FAST` : tileType;
    }
    if (btnDebug) btnDebug.classList.toggle("active", Boolean(debugEnabled));
    if (btnFaster) btnFaster.classList.toggle("active", Boolean(fasterHeld || isFasterActive));

    const displayName = streetZone ? streetZone.name : originName || "Newton Centre";
    const displayTag = streetZone ? streetZone.type : tileType;
    const key = `${displayName}|${displayTag}`;
    if (key !== lastStreetKey) {
      lastStreetKey = key;
      if (streetNameEl) streetNameEl.textContent = displayName;
      if (streetZoneEl) streetZoneEl.textContent = displayTag;
    }

    if (landmarkPillEl) {
      if (nearestLandmark && nearestLandmark.distTiles <= 5) {
        landmarkPillEl.textContent = `★ ${nearestLandmark.landmark.name}`;
        landmarkPillEl.classList.add("visible");
      } else {
        landmarkPillEl.classList.remove("visible");
      }
    }
  }

  return {
    getTouchInput: () => ({ x: touchInput.x, y: touchInput.y }),
    isFasterHeld: () => fasterHeld,
    showSafetyToast,
    updateHUD,
  };
}
