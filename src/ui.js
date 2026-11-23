import { HOUSE_COLOR_PRESETS, ROOF_PRESETS } from "./tileset.js";
import { getItemMeta } from "./quests.js";

/**
 * Phase 3 UI overlay:
 *  - SNES gold-framed street banner & live Quest Compass strip
 *  - Safety XP + Coins/Acorns HUD
 *  - SNES RPG Dialogue Textbox with typewriter animation
 *  - Overhead Item Fanfare celebratory banner
 *  - Fog-of-War Folded Paper Map + Quest Log + Backpack overlay
 *  - Real-House Color Painter & multi-touch iPad controls
 */

export function createUI({
  onToggleDebug,
  onResetHome,
  onLookOrInteract,
  onToggleMute,
  onOpenPaint,
  onToggleMap,
  onResetProgress,
  onTextBlip,
} = {}) {
  const bannerEl = document.getElementById("street-banner");
  const streetNameEl = document.getElementById("street-name");
  const streetZoneEl = document.getElementById("street-zone");
  const questTrackerEl = document.getElementById("quest-tracker");
  const xpEl = document.getElementById("hud-xp");
  const bagEl = document.getElementById("hud-bag");
  const coordsEl = document.getElementById("hud-coords");
  const tileEl = document.getElementById("hud-tile");
  const safetyToastEl = document.getElementById("safety-toast");
  const landmarkPillEl = document.getElementById("landmark-pill");

  const fanfareBannerEl = document.getElementById("fanfare-banner");
  const fanfareTitleEl = document.getElementById("fanfare-title");
  const fanfareSubEl = document.getElementById("fanfare-sub");

  const dialogueBoxEl = document.getElementById("dialogue-box");
  const dialogueSpeakerEl = document.getElementById("dialogue-speaker");
  const dialogueTextEl = document.getElementById("dialogue-text");

  const mapModalEl = document.getElementById("map-modal");
  const mapCanvasEl = document.getElementById("paper-map-canvas");
  const mapStatsEl = document.getElementById("map-stats");
  const mapQuestListEl = document.getElementById("map-quest-list");
  const mapBackpackEl = document.getElementById("map-backpack");
  const btnMapClose = document.getElementById("btn-map-close");
  const btnResetProgress = document.getElementById("btn-reset-progress");

  const dpadEl = document.getElementById("dpad");
  const btnMap = document.getElementById("btn-map");
  const btnPaint = document.getElementById("btn-paint");
  const btnMute = document.getElementById("btn-mute");
  const btnDebug = document.getElementById("btn-debug");
  const btnHome = document.getElementById("btn-home");
  const btnFaster = document.getElementById("btn-faster");
  const btnLook = document.getElementById("btn-look");
  const btnLookIcon = document.getElementById("btn-look-icon");
  const btnLookLabel = document.getElementById("btn-look-label");

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

  // --- SNES Typewriter Dialogue State ---
  let dialogueState = null;

  function openDialogue({ speaker, lines, onComplete }) {
    if (!dialogueBoxEl || !lines || lines.length === 0) {
      onComplete?.();
      return;
    }
    dialogueState = {
      speaker,
      lines,
      lineIndex: 0,
      charIndex: 0,
      charTimer: 0,
      onComplete,
    };
    if (dialogueSpeakerEl) dialogueSpeakerEl.textContent = speaker;
    if (dialogueTextEl) dialogueTextEl.textContent = "";
    dialogueBoxEl.classList.add("open");
  }

  function advanceDialogue() {
    if (!dialogueState) return false;
    const fullLine = dialogueState.lines[dialogueState.lineIndex] || "";
    if (dialogueState.charIndex < fullLine.length) {
      // Snap-finish current line
      dialogueState.charIndex = fullLine.length;
      if (dialogueTextEl) dialogueTextEl.textContent = fullLine;
      return true;
    }
    if (dialogueState.lineIndex + 1 < dialogueState.lines.length) {
      dialogueState.lineIndex += 1;
      dialogueState.charIndex = 0;
      dialogueState.charTimer = 0;
      if (dialogueTextEl) dialogueTextEl.textContent = "";
      return true;
    }
    // Close dialogue & fire completion callback (e.g. Overhead Item Fanfare!)
    const done = dialogueState.onComplete;
    dialogueState = null;
    dialogueBoxEl?.classList.remove("open");
    done?.();
    return true;
  }

  function updateDialogueTypewriter(dt) {
    if (!dialogueState) return;
    const fullLine = dialogueState.lines[dialogueState.lineIndex] || "";
    if (dialogueState.charIndex >= fullLine.length) return;
    dialogueState.charTimer += dt;
    const charsPerSec = 42;
    const targetChars = Math.min(fullLine.length, Math.floor(dialogueState.charTimer * charsPerSec) + 1);
    if (targetChars > dialogueState.charIndex) {
      dialogueState.charIndex = targetChars;
      if (dialogueTextEl) dialogueTextEl.textContent = fullLine.slice(0, dialogueState.charIndex);
      if (dialogueState.charIndex % 3 === 0) onTextBlip?.();
    }
  }

  dialogueBoxEl?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    advanceDialogue();
  });

  // --- Overhead Item Fanfare Banner ---
  function setFanfareBanner(itemMeta, sourceLabel) {
    if (!fanfareBannerEl) return;
    if (!itemMeta) {
      fanfareBannerEl.classList.remove("visible");
      return;
    }
    if (fanfareTitleEl) fanfareTitleEl.textContent = `★ GOT ${itemMeta.icon} ${itemMeta.name.toUpperCase()}!`;
    if (fanfareSubEl) fanfareSubEl.textContent = sourceLabel ? `${sourceLabel} — ${itemMeta.desc}` : itemMeta.desc;
    fanfareBannerEl.classList.add("visible");
  }

  // --- Folded Paper Map Modal ---
  function setMapModalOpen(open, questSystem) {
    if (!mapModalEl) return;
    mapModalEl.classList.toggle("open", Boolean(open));
    btnMap?.classList.toggle("active", Boolean(open));
    if (open && questSystem) {
      refreshMapSidePanels(questSystem);
    }
  }

  function refreshMapSidePanels(questSystem) {
    if (mapStatsEl) {
      const pct = questSystem.getExploredPercent();
      const disc = questSystem.state.discoveredLandmarks.size;
      const total = questSystem.landmarks.length;
      mapStatsEl.textContent = `Explored: ${pct}% • Landmarks: ${disc}/${total} • Gear: ${questSystem.getGear().label}`;
    }

    if (mapQuestListEl) {
      mapQuestListEl.innerHTML = "";
      for (const q of questSystem.quests) {
        const done = questSystem.state.completedQuests.has(q.id);
        const active = questSystem.state.activeQuestId === q.id;
        const div = document.createElement("div");
        div.className = `quest-item${done ? " quest-done" : ""}`;
        const activeStep = active ? q.steps[questSystem.state.activeStepIndex] : null;
        div.innerHTML = done
          ? `✅ <strong>${q.title}</strong>`
          : active
            ? `🎯 <strong>${q.title}</strong><br/><span style="opacity:0.85">${activeStep ? activeStep.instruction : q.description}</span>`
            : `⬜ <strong>${q.title}</strong> — <span style="opacity:0.75">${q.description}</span>`;
        mapQuestListEl.appendChild(div);
      }
    }

    if (mapBackpackEl) {
      mapBackpackEl.innerHTML = "";
      for (const itemId of questSystem.state.inventory) {
        const meta = getItemMeta(itemId);
        const chip = document.createElement("span");
        chip.className = "item-chip";
        chip.title = meta.desc;
        chip.textContent = `${meta.icon} ${meta.name}`;
        mapBackpackEl.appendChild(chip);
      }
    }
  }

  btnMap?.addEventListener("click", () => onToggleMap?.());
  questTrackerEl?.addEventListener("click", () => onToggleMap?.());
  btnMapClose?.addEventListener("click", () => setMapModalOpen(false));
  mapModalEl?.addEventListener("click", (e) => {
    if (e.target === mapModalEl) setMapModalOpen(false);
  });
  btnResetProgress?.addEventListener("click", () => {
    onResetProgress?.();
  });

  // --- Virtual D-pad & Action Buttons ---
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
      onLookOrInteract?.();
    });
    btnLook.addEventListener("pointerup", () => btnLook.classList.remove("active"));
    btnLook.addEventListener("pointercancel", () => btnLook.classList.remove("active"));
  }

  btnPaint?.addEventListener("click", () => onOpenPaint?.());
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
  btnHome?.addEventListener("click", () => onResetHome?.());

  function showSafetyToast(message, durationMs = 2200) {
    if (!safetyToastEl) return;
    safetyToastEl.textContent = message;
    safetyToastEl.classList.add("visible");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      safetyToastEl.classList.remove("visible");
    }, durationMs);
  }

  // --- Real House Color Painter Modal ---
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

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setMapModalOpen(false);
      closePaintModal();
    }
  });

  let lastStreetKey = "";

  function updateHUD({
    tileX,
    tileY,
    tileType,
    streetZone,
    originName,
    nearestLandmark,
    nearestBuilding,
    nearbyInteraction,
    questHint,
    gearLabel = "FAST",
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
      tileEl.textContent = isFasterActive ? `${tileType} • ${gearLabel}` : tileType;
    }
    if (btnDebug) btnDebug.classList.toggle("active", Boolean(debugEnabled));
    if (btnMute) {
      btnMute.textContent = muted ? "🔇 Muted" : "🔊 SFX";
      btnMute.classList.toggle("active", Boolean(muted));
    }
    if (btnFaster) btnFaster.classList.toggle("active", Boolean(fasterHeld || isFasterActive));

    // Context-aware Look Both Ways / Talk / Open Chest button label
    if (btnLook && btnLookIcon && btnLookLabel) {
      if (nearbyInteraction) {
        btnLook.classList.add("talk-ready");
        btnLookIcon.textContent = nearbyInteraction.kind === "chest" ? "📦" : "💬";
        btnLookLabel.innerHTML = nearbyInteraction.kind === "chest" ? "OPEN<br/>CHEST" : "TALK /<br/>LOOK";
      } else {
        btnLook.classList.remove("talk-ready");
        btnLookIcon.textContent = "👀";
        btnLookLabel.innerHTML = "LOOK<br/>BOTH WAYS";
      }
    }

    // Active Quest Compass Strip
    if (questTrackerEl) {
      if (questHint) {
        const shortLabel = questHint.label.replace(/\s*\(.*\)/, "");
        questTrackerEl.textContent = `🎯 ${shortLabel} • ${questHint.compass}`;
      } else {
        questTrackerEl.textContent = "🏆 All Quests Complete! Free Explore";
      }
    }

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

    // Bottom proximity pill (hides cleanly when dialogue box is open)
    if (landmarkPillEl) {
      if (dialogueState) {
        landmarkPillEl.classList.remove("visible");
      } else if (nearbyInteraction) {
        const label = nearbyInteraction.kind === "chest"
          ? `📦 Tap OPEN / Space — ${nearbyInteraction.target.name}`
          : `💬 Tap TALK / Space — ${nearbyInteraction.target.npcName} (${nearbyInteraction.target.name})`;
        landmarkPillEl.textContent = label;
        landmarkPillEl.classList.add("visible");
      } else if (nearestLandmark && nearestLandmark.distTiles <= 5) {
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

  return {
    getTouchInput: () => ({ x: touchInput.x, y: touchInput.y }),
    isFasterHeld: () => fasterHeld,
    showSafetyToast,
    openDialogue,
    advanceDialogue,
    updateDialogueTypewriter,
    isDialogueOpen: () => Boolean(dialogueState),
    setFanfareBanner,
    getMapCanvas: () => mapCanvasEl,
    isMapOpen: () => Boolean(mapModalEl?.classList.contains("open")),
    setMapModalOpen,
    refreshMapSidePanels,
    openPaintModal,
    closePaintModal,
    isPaintOpen: () => Boolean(paintModalEl?.classList.contains("open")),
    updateHUD,
  };
}
