import { HOUSE_COLOR_PRESETS, ROOF_PRESETS, BUILDING_STYLE_PRESETS } from "./tileset.js";
import { getItemMeta } from "./quests.js";
import { extractHouseNumber, extractStreetFromAddress } from "./streetsigns.js";

const TILE_DISPLAY_LABELS = {
  grass: "lawn grass",
  sidewalk: "sidewalk",
  residential_road: "street",
  main_road: "town avenue",
  highway: "highway",
  highway_median: "highway barrier",
  crosswalk: "crosswalk",
  water: "water",
  tall_grass: "woods",
  parking_lot: "parking lot",
  dirt: "dirt trail",
  sand: "sand",
  park: "park turf",
};

const BUILDING_KIND_LABELS = {
  commercial: "Shop",
  bakery_cafe: "Café",
  corner_market: "Market",
  office_plaza: "Office Plaza",
  fire_station: "Fire Station",
  greenhouse: "Greenhouse",
  library: "Library",
  school: "School",
  civic: "Civic Hall",
  apartments: "Apartments",
  duplex: "Duplex",
  garage: "Garage",
  house: "House",
};

const BUILDING_KIND_ICONS = {
  commercial: "🏪",
  bakery_cafe: "🥐",
  corner_market: "🛍️",
  office_plaza: "🏢",
  fire_station: "🚒",
  greenhouse: "🌿",
  library: "📚",
  school: "🏫",
  civic: "🏛️",
  apartments: "🏬",
  duplex: "🏘️",
  garage: "🚗",
  house: "🏠",
};

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
  onMapTeleport,
  onToggleGpsAssist,
  onToggleOutfit,
  onToggleInside,
  onGiveSnack,
  onUseSword,
  onUseSiddur,
  onGameOverRetry,
  onSelectQuest,
  onOpenMapFromSign,
  onCloseSign,
  onResetProgress,
  onTextBlip,
  onDialogueOpen,
  onDialogueAdvance,
} = {}) {
  const bannerEl = document.getElementById("street-banner");
  const streetNameEl = document.getElementById("street-name");
  const streetZoneEl = document.getElementById("street-zone");
  const questTrackerEl = document.getElementById("quest-tracker");
  const xpEl = document.getElementById("hud-xp");
  const heartsEl = document.getElementById("hud-hearts");
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
  const miniMapBtnEl = document.getElementById("mini-map-btn");
  const miniMapCanvasEl = document.getElementById("mini-map-canvas");
  const miniMapLabelEl = document.getElementById("mini-map-label");
  const mapStatsEl = document.getElementById("map-stats");
  const mapLegendEl = document.getElementById("map-legend");
  const mapDirectionsCardEl = document.getElementById("map-directions-card");
  const mapQuestListEl = document.getElementById("map-quest-list");
  const mapBackpackEl = document.getElementById("map-backpack");
  const btnMapGps = document.getElementById("btn-map-gps");
  const btnMapClose = document.getElementById("btn-map-close");
  const btnResetProgress = document.getElementById("btn-reset-progress");

  const signModalEl = document.getElementById("sign-modal");
  const signStampBadgeEl = document.getElementById("sign-stamp-badge");
  const signBladesEl = document.getElementById("sign-blades");
  const signDirectionsTitleEl = document.getElementById("sign-directions-title");
  const signDirectionsListEl = document.getElementById("sign-directions-list");
  const signNearbyListEl = document.getElementById("sign-nearby-list");
  const btnSignMap = document.getElementById("btn-sign-map");
  const btnSignClose = document.getElementById("btn-sign-close");

  const dpadEl = document.getElementById("dpad");
  const btnToolsMenu = document.getElementById("btn-tools-menu");
  const toolsDrawerEl = document.getElementById("tools-drawer");
  const btnInside = document.getElementById("btn-inside");
  const btnSnack = document.getElementById("btn-snack");
  const btnMap = document.getElementById("btn-map");
  const btnSword = document.getElementById("btn-sword");
  const btnSiddur = document.getElementById("btn-siddur");
  const btnGps = document.getElementById("btn-gps");
  const btnOutfit = document.getElementById("btn-outfit");
  const gameoverOverlayEl = document.getElementById("gameover-overlay");
  const gameoverSubEl = document.getElementById("gameover-sub");
  const btnGameoverRetry = document.getElementById("btn-gameover-retry");
  const btnPaint = document.getElementById("btn-paint");
  const btnMute = document.getElementById("btn-mute");
  const btnDebug = document.getElementById("btn-debug");
  const btnHome = document.getElementById("btn-home");
  const btnFaster = document.getElementById("btn-faster");
  const btnLook = document.getElementById("btn-look");
  const btnLookIcon = document.getElementById("btn-look-icon");
  const btnLookLabel = document.getElementById("btn-look-label");

  function setToolsDrawerOpen(open) {
    if (!toolsDrawerEl || !btnToolsMenu) return;
    const next = Boolean(open);
    toolsDrawerEl.classList.toggle("open", next);
    btnToolsMenu.classList.toggle("open", next);
    btnToolsMenu.setAttribute("aria-expanded", String(next));
  }

  btnToolsMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
    setToolsDrawerOpen(!toolsDrawerEl?.classList.contains("open"));
  });

  document.addEventListener("pointerdown", (e) => {
    if (!toolsDrawerEl?.classList.contains("open")) return;
    if (toolsDrawerEl.contains(e.target) || btnToolsMenu?.contains(e.target)) return;
    setToolsDrawerOpen(false);
  });

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
    onDialogueOpen?.(speaker);
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
      onDialogueAdvance?.();
      return true;
    }
    // Close dialogue & fire completion callback (e.g. Overhead Item Fanfare!)
    const done = dialogueState.onComplete;
    dialogueState = null;
    dialogueBoxEl?.classList.remove("open");
    onDialogueAdvance?.();
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
      if (dialogueState.charIndex % 3 === 0) onTextBlip?.(dialogueState.speaker);
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
  function setMapModalOpen(open, questSystem, pocketDirections = null) {
    if (!mapModalEl) return;
    mapModalEl.classList.toggle("open", Boolean(open));
    btnMap?.classList.toggle("active", Boolean(open));
    if (open && questSystem) {
      refreshMapSidePanels(questSystem, pocketDirections);
    }
  }

  function refreshMapSidePanels(questSystem, pocketDirections = null) {
    const navMode = questSystem.state.navMode || (questSystem.state.gpsAssist ? "gps" : "signs");
    const gpsOn = navMode === "gps";
    const hardOn = navMode === "hard";
    if (mapStatsEl) {
      const pct = questSystem.getExploredPercent();
      const disc = questSystem.state.discoveredLandmarks.size;
      const total = questSystem.landmarks.length;
      const signsCount = questSystem.state.checkedSigns?.size || 0;
      mapStatsEl.textContent = `Explored: ${pct}% • Signs: ${signsCount} • Landmarks: ${disc}/${total} • Gear: ${questSystem.getGear().label}`;
    }

    if (btnMapGps) {
      btnMapGps.textContent =
        navMode === "hard"
          ? "🔥 Mode: Hard"
          : navMode === "gps"
            ? "📡 Mode: Easy / GPS"
            : "🧭 Mode: Signs";
      btnMapGps.classList.toggle("secondary", navMode === "signs");
    }

    if (mapCanvasEl) {
      mapCanvasEl.style.cursor = gpsOn ? "crosshair" : "default";
      mapCanvasEl.title = gpsOn ? "Tap anywhere on the map to Fast-Travel!" : "Folded Paper Map";
    }

    if (mapLegendEl) {
      const buildingKey =
        `<span style="display:inline-flex;align-items:center;gap:3px;"><i style="display:inline-block;width:8px;height:8px;background:#2358b8;border:1px solid #2b2112;"></i>School</span>` +
        `<span style="display:inline-flex;align-items:center;gap:3px;"><i style="display:inline-block;width:8px;height:8px;background:#8a2434;border:1px solid #2b2112;"></i>BC</span>` +
        `<span style="display:inline-flex;align-items:center;gap:3px;"><i style="display:inline-block;width:8px;height:8px;background:#248f7c;border:1px solid #2b2112;"></i>Library</span>` +
        `<span style="display:inline-flex;align-items:center;gap:3px;"><i style="display:inline-block;width:8px;height:8px;background:#6f42a6;border:1px solid #2b2112;"></i>Civic</span>` +
        `<span style="display:inline-flex;align-items:center;gap:3px;"><i style="display:inline-block;width:8px;height:8px;background:#d92b24;border:1px solid #2b2112;"></i>Fire</span>` +
        `<span style="display:inline-flex;align-items:center;gap:3px;"><i style="display:inline-block;width:8px;height:8px;background:#e07124;border:1px solid #2b2112;"></i>Shops</span>`;
      mapLegendEl.innerHTML = gpsOn
        ? `<span style="color:#0c7b93;font-weight:800;">✨ Tap map to Fast-Travel!</span><span>🔴 You</span><span>🟨 Home / Quest</span><span>🟩 Discovered</span>${buildingKey}`
        : hardOn
          ? `<span>📍 Last Sign</span><span>🟩 Checked Sign</span>${buildingKey}`
          : `<span>📍 Last Sign</span><span>🟩 Checked Sign</span><span>🟨 Home</span>${buildingKey}`;
    }

    if (mapDirectionsCardEl) {
      mapDirectionsCardEl.innerHTML = "";
      if (pocketDirections && Array.isArray(pocketDirections.steps) && pocketDirections.steps.length > 0) {
        const hdr = document.createElement("div");
        hdr.style.cssText = "font-size:10.5px; opacity:0.8; margin-bottom:5px;";
        hdr.textContent = `From ${pocketDirections.fromLabel} → ${pocketDirections.toLabel}:`;
        mapDirectionsCardEl.appendChild(hdr);
        pocketDirections.steps.forEach((step, idx) => {
          const row = document.createElement("div");
          row.className = `map-dir-step${idx === 0 ? " first" : ""}`;
          row.textContent = `${step.arrow || "•"} ${step.text}`;
          mapDirectionsCardEl.appendChild(row);
        });
      } else {
        mapDirectionsCardEl.textContent =
          "Walk to any green street sign and tap READ SIGN for live turn-by-turn street directions!";
      }
    }

    if (mapQuestListEl) {
      mapQuestListEl.innerHTML = "";
      const outfitRewardLabels = {
        baseball: "⚾ Little League Outfit",
        wetsuit: "🤿 Wetsuit & Snorkel",
        link: "🗡️ Link (Zelda) Outfit",
      };
      for (const q of questSystem.quests) {
        const done = questSystem.state.completedQuests.has(q.id);
        const active = questSystem.state.activeQuestId === q.id;
        const div = document.createElement("div");
        div.className = `quest-item${done ? " quest-done" : ""}`;
        const activeStep = active ? q.steps[questSystem.state.activeStepIndex] : null;
        const outfitTag =
          !done && q.rewards?.outfit && outfitRewardLabels[q.rewards.outfit]
            ? ` <span style="font-size:10px; color:#8a4f08; font-weight:700;">• 🎁 ${outfitRewardLabels[q.rewards.outfit]}</span>`
            : "";
        div.innerHTML = done
          ? `✅ <strong>${q.title}</strong>`
          : active
            ? `🎯 <strong>${q.title}</strong>${outfitTag}<br/><span style="opacity:0.85">${activeStep ? activeStep.instruction : q.description}</span>`
            : `⬜ <strong>${q.title}</strong>${outfitTag} <span style="font-size:10px; color:#174a2e; text-decoration:underline;">(Tap to start)</span><br/><span style="opacity:0.75">${q.description}</span>`;
        if (!done && !active) {
          div.style.cursor = "pointer";
          div.addEventListener("click", () => onSelectQuest?.(q.id));
        }
        mapQuestListEl.appendChild(div);
      }
    }

    if (mapBackpackEl) {
      mapBackpackEl.innerHTML = "";
      const displayItems = new Set(questSystem.state.inventory);
      if (gpsOn) {
        displayItems.add("graveyard_sword");
        displayItems.add("pocket_siddur");
        displayItems.add("mountain_bike");
        displayItems.add("outfit_wetsuit");
      }
      for (const itemId of displayItems) {
        const meta = getItemMeta(itemId);
        const chip = document.createElement("span");
        chip.className = "item-chip";
        chip.title = meta.desc;
        chip.textContent = `${meta.icon} ${meta.name}`;
        mapBackpackEl.appendChild(chip);
      }
    }
  }

  // --- Active Street-Sign Wayfinding Overlay ---
  function formatBranchDirs(dirs = []) {
    if (!dirs || dirs.length === 0) return "Corner";
    const arrowMap = { N: "↑ N", S: "↓ S", E: "E →", W: "← W" };
    const order = ["W", "E", "N", "S"];
    const sorted = [...dirs].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    return sorted.map((d) => arrowMap[d] || d).join("  •  ");
  }

  function openSignModal({ sign, checkResult, directions, targetLabel, nearbyLandmarks = [] }) {
    if (!signModalEl || !sign) return;

    if (signStampBadgeEl) {
      if (checkResult?.isNew) {
        signStampBadgeEl.textContent = `★ NEW SIGN LOGGED! +${checkResult.xpEarned} XP`;
        signStampBadgeEl.classList.add("new-stamp");
      } else {
        signStampBadgeEl.textContent = `✓ Checked Sign #${checkResult?.totalChecked || 1}`;
        signStampBadgeEl.classList.remove("new-stamp");
      }
    }

    if (signBladesEl) {
      signBladesEl.innerHTML = "";
      for (const br of sign.branches || []) {
        const blade = document.createElement("div");
        blade.className = "sign-blade";
        const nameEl = document.createElement("span");
        nameEl.className = "sign-blade-name";
        nameEl.textContent = br.shortStreet || br.street;
        const dirsEl = document.createElement("span");
        dirsEl.className = "sign-blade-dirs";
        dirsEl.textContent = formatBranchDirs(br.dirs);
        blade.appendChild(nameEl);
        blade.appendChild(dirsEl);
        signBladesEl.appendChild(blade);
      }
    }

    if (signDirectionsTitleEl) {
      signDirectionsTitleEl.textContent = targetLabel
        ? `🧭 Directions to ${targetLabel}`
        : "🧭 Free Explore — You're Oriented!";
    }

    if (signDirectionsListEl) {
      signDirectionsListEl.innerHTML = "";
      if (directions && Array.isArray(directions.steps) && directions.steps.length > 0) {
        directions.steps.forEach((step, idx) => {
          const row = document.createElement("div");
          row.className = `sign-step${idx === 0 ? " first" : ""}`;
          const arrowEl = document.createElement("span");
          arrowEl.className = "sign-step-arrow";
          arrowEl.textContent = step.arrow || "•";
          const textEl = document.createElement("span");
          textEl.textContent = step.text;
          row.appendChild(arrowEl);
          row.appendChild(textEl);
          signDirectionsListEl.appendChild(row);
        });
      } else {
        const row = document.createElement("div");
        row.className = "sign-step";
        row.textContent = "All quests complete! Check the Paper Map to see your logged street signs.";
        signDirectionsListEl.appendChild(row);
      }
    }

    if (signNearbyListEl) {
      signNearbyListEl.innerHTML = "";
      if (nearbyLandmarks.length === 0) {
        const chip = document.createElement("span");
        chip.className = "sign-nearby-chip";
        chip.textContent = "Quiet residential stretch — keep exploring!";
        signNearbyListEl.appendChild(chip);
      } else {
        for (const lm of nearbyLandmarks) {
          const chip = document.createElement("span");
          chip.className = "sign-nearby-chip";
          chip.textContent = lm.isRightHere
            ? `★ ${lm.name} (Right here!)`
            : `${lm.arrow} ${lm.name} (~${lm.blocks} ${lm.blocks === 1 ? "blk" : "blks"} ${lm.dir})`;
          signNearbyListEl.appendChild(chip);
        }
      }
    }

    signModalEl.classList.add("open");
  }

  function closeSignModal() {
    if (!signModalEl?.classList.contains("open")) return;
    signModalEl.classList.remove("open");
    onCloseSign?.();
  }

  btnSignClose?.addEventListener("click", closeSignModal);
  btnSignMap?.addEventListener("click", () => {
    closeSignModal();
    onOpenMapFromSign?.();
  });
  signModalEl?.addEventListener("click", (e) => {
    if (e.target === signModalEl) closeSignModal();
  });

  btnInside?.addEventListener("click", () => onToggleInside?.());
  btnSnack?.addEventListener("click", () => onGiveSnack?.());
  btnMap?.addEventListener("click", () => onToggleMap?.());
  btnSword?.addEventListener("click", () => onUseSword?.());
  btnSiddur?.addEventListener("click", () => onUseSiddur?.());
  btnGps?.addEventListener("click", () => onToggleGpsAssist?.());
  btnOutfit?.addEventListener("click", () => onToggleOutfit?.());
  btnGameoverRetry?.addEventListener("click", () => onGameOverRetry?.());
  btnMapGps?.addEventListener("click", () => onToggleGpsAssist?.());
  miniMapBtnEl?.addEventListener("click", () => onToggleMap?.());
  questTrackerEl?.addEventListener("click", () => onToggleMap?.());
  btnMapClose?.addEventListener("click", () => setMapModalOpen(false));
  mapModalEl?.addEventListener("click", (e) => {
    if (e.target === mapModalEl) setMapModalOpen(false);
  });
  mapCanvasEl?.addEventListener("click", (e) => {
    const rect = mapCanvasEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onMapTeleport?.(nx, ny);
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

  btnPaint?.addEventListener("click", () => {
    setToolsDrawerOpen(false);
    onOpenPaint?.();
  });
  btnMute?.addEventListener("click", () => {
    const isNowMuted = onToggleMute?.();
    if (btnMute) {
      btnMute.textContent = isNowMuted ? "🔇 Sound: Off" : "🔊 Sound: On";
      btnMute.classList.toggle("active", Boolean(isNowMuted));
    }
  });
  btnDebug?.addEventListener("click", () => {
    const enabled = onToggleDebug?.();
    btnDebug.classList.toggle("active", Boolean(enabled));
  });
  btnHome?.addEventListener("click", () => {
    setToolsDrawerOpen(false);
    onResetHome?.();
  });

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
  const styleSwatchesEl = document.getElementById("style-swatches");
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
    if (styleSwatchesEl) {
      styleSwatchesEl.innerHTML = "";
      const activeKind = currentOverride.kind || activePaintBuilding?.kind || "house";
      const activeArch = currentOverride.arch || activePaintBuilding?.arch || "colonial";
      for (const [key, preset] of Object.entries(BUILDING_STYLE_PRESETS)) {
        const isSelected =
          preset.mode === "arch"
            ? activeKind === "house" && activeArch === key
            : activeKind === key;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `swatch-btn${isSelected ? " active" : ""}`;
        btn.textContent = preset.label;
        btn.addEventListener("click", () => {
          if (!activePaintBuilding) return;
          const updated = paintHandlers?.onPickStyle?.(activePaintBuilding, key, preset.mode);
          renderSwatches(updated || {});
        });
        styleSwatchesEl.appendChild(btn);
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
      setToolsDrawerOpen(false);
      setMapModalOpen(false);
      closePaintModal();
      closeSignModal();
    }
  });

  let lastStreetKey = "";
  const domCache = new Map();
  function setText(el, key, value) {
    if (!el) return;
    if (domCache.get(key) !== value) {
      domCache.set(key, value);
      el.textContent = value;
    }
  }
  function setHtml(el, key, value) {
    if (!el) return;
    if (domCache.get(key) !== value) {
      domCache.set(key, value);
      el.innerHTML = value;
    }
  }
  function setClass(el, key, className, flag) {
    if (!el) return;
    const b = Boolean(flag);
    if (domCache.get(key) !== b) {
      domCache.set(key, b);
      el.classList.toggle(className, b);
    }
  }
  function setDisplay(el, key, value) {
    if (!el) return;
    if (domCache.get(key) !== value) {
      domCache.set(key, value);
      el.style.display = value;
    }
  }
  function setTitle(el, key, value) {
    if (!el) return;
    if (domCache.get(key) !== value) {
      domCache.set(key, value);
      el.title = value;
    }
  }

  function updateHUD({
    tileX,
    tileY,
    tileType,
    streetZone,
    originName,
    nearestLandmark,
    nearestBuilding,
    nearbyInteraction,
    alternateInteraction = null,
    facingUncheckedRoad = false,
    questHint,
    pocketDirections = null,
    signBanner = null,
    navMode = "signs",
    gpsAssist = false,
    heroOutfit = "polo",
    unlockedOutfitsCount = 1,
    checkedSignsCount = 0,
    checkedStreets = null,
    gearLabel = "FAST",
    debugEnabled,
    muted = false,
    safetyXP = 0,
    coins = 0,
    acorns = 0,
    snacks = 0,
    hasSnack = false,
    hearts = 5,
    maxHearts = 5,
    hasSword = false,
    hasSiddur = false,
    canEnterHouse = false,
    isInsideHouse = false,
    canGiveSnack = false,
    snackTargetKind = null,
    isFasterActive = false,
    isWading = false,
    isFastWading = false,
    safeCrossingActive = false,
    needsLookAtCurb = false,
  }) {
    if (heartsEl) {
      const clamped = Math.max(0, Math.min(maxHearts, hearts));
      setText(heartsEl, "hearts", "❤️".repeat(clamped) + "🖤".repeat(Math.max(0, maxHearts - clamped)));
      setClass(heartsEl, "heartsLow", "low", clamped <= 2);
    }
    setDisplay(btnInside, "insideDisp", isInsideHouse || canEnterHouse ? "inline-flex" : "none");
    setText(btnInside, "insideTxt", isInsideHouse ? "🚪 Outside (I)" : "🏠 Inside (I)");
    setClass(btnInside, "insideAct", "active", isInsideHouse || canEnterHouse);
    setDisplay(btnSnack, "snackDisp", canGiveSnack ? "inline-flex" : "none");
    const isWildAnimalTarget =
      snackTargetKind === "turkey" ||
      snackTargetKind === "squirrel" ||
      snackTargetKind === "cat" ||
      snackTargetKind === "dog";
    const canFeedAnimal = Boolean(gpsAssist || hasSnack || acorns > 0);
    const animalLabelMap = {
      turkey: "Turkey",
      squirrel: "Squirrel",
      cat: "Cat",
      dog: "Pup",
    };
    if (isWildAnimalTarget) {
      const targetName = animalLabelMap[snackTargetKind] || "Animal";
      if (gpsAssist || hasSnack) {
        setText(btnSnack, "snackTxt", `🥨 Feed ${targetName} (N)`);
      } else if (acorns > 0) {
        setText(btnSnack, "snackTxt", `🌰 Feed ${targetName} (N)`);
      } else {
        setText(btnSnack, "snackTxt", `🥨 Need Food (N)`);
      }
      setClass(btnSnack, "snackAct", "active", canGiveSnack && canFeedAnimal);
    } else {
      setText(
        btnSnack,
        "snackTxt",
        hasSnack ? `🥨 Give Snack (N)` : "🥨 Need Snacks (N)"
      );
      setClass(btnSnack, "snackAct", "active", canGiveSnack && hasSnack);
    }
    setDisplay(btnSword, "swordDisp", hasSword ? "inline-flex" : "none");
    setDisplay(btnSiddur, "siddurDisp", hasSiddur ? "inline-flex" : "none");
    setText(
      xpEl,
      "xp",
      safeCrossingActive ? `${safetyXP} XP · Safe ✓` : `${safetyXP} XP`
    );
    setText(bagEl, "bag", `🪙 ${coins} · 🌰 ${acorns} · 🥨 ${gpsAssist ? "∞" : snacks}`);
    setText(coordsEl, "coords", debugEnabled ? `Tile ${tileX}, ${tileY}` : `🪧 Signs: ${checkedSignsCount}`);
    const prettyTile = TILE_DISPLAY_LABELS[tileType] || tileType;
    const statusSub = debugEnabled
      ? `Tile ${tileX},${tileY} · ${prettyTile}`
      : isWading
        ? isFastWading
          ? "🤿 Swimming"
          : "🤿 Wading"
        : isFasterActive
          ? `⚡ ${gearLabel}`
          : "";
    setDisplay(tileEl, "tileDisp", statusSub ? "block" : "none");
    if (statusSub) setText(tileEl, "tile", statusSub);
    setClass(btnDebug, "debugAct", "active", debugEnabled);
    setText(
      btnGps,
      "gpsTxt",
      navMode === "hard" ? "🔥 Mode: Hard" : navMode === "gps" ? "📡 Mode: Easy" : "🧭 Mode: Signs"
    );
    setClass(btnGps, "gpsAct", "active", navMode !== "signs");
    if (btnOutfit) {
      if (unlockedOutfitsCount <= 1) {
        setText(btnOutfit, "outfitTxt", "👕 Outfit: Polo 🔒");
        setTitle(btnOutfit, "outfitTitle", "Complete quests to unlock Baseball, Wetsuit & Link outfits!");
      } else {
        setText(
          btnOutfit,
          "outfitTxt",
          heroOutfit === "link"
            ? "🗡️ Outfit: Link"
            : heroOutfit === "wetsuit"
              ? "🤿 Outfit: Wetsuit"
              : heroOutfit === "baseball"
                ? "⚾ Outfit: Baseball"
                : "👕 Outfit: Polo"
        );
        setTitle(btnOutfit, "outfitTitle", `Switch between ${unlockedOutfitsCount} unlocked outfits (O)`);
      }
      setClass(btnOutfit, "outfitAct", "active", heroOutfit !== "polo");
    }
    setText(
      miniMapLabelEl,
      "miniLbl",
      navMode === "hard"
        ? "COMPASS · MAP"
        : navMode === "gps"
          ? "RADAR · MAP"
          : `🪧 ${checkedSignsCount} · MAP`
    );
    setText(btnMute, "muteTxt", muted ? "🔇 Sound: Off" : "🔊 Sound: On");
    setClass(btnMute, "muteAct", "active", muted);
    setClass(btnFaster, "fasterAct", "active", fasterHeld || isFasterActive);

    // Context-aware Look Both Ways / Read Sign / Talk / Open Chest button label
    if (btnLook && btnLookIcon && btnLookLabel) {
      if (nearbyInteraction) {
        setClass(btnLook, "lookTalk", "talk-ready", true);
        setClass(btnLook, "lookNeed", "need-look", false);
        if (nearbyInteraction.kind === "home_door") {
          setText(btnLookIcon, "lookIcon", "🏠");
          setHtml(btnLookLabel, "lookLbl", "GO<br/>INSIDE");
        } else if (nearbyInteraction.kind === "house_prop") {
          setText(btnLookIcon, "lookIcon", nearbyInteraction.target?.icon || "✨");
          setHtml(btnLookLabel, "lookLbl", nearbyInteraction.target?.shortLabel || "CHECK");
        } else if (nearbyInteraction.kind === "sign") {
          setText(btnLookIcon, "lookIcon", "🪧");
          setHtml(btnLookLabel, "lookLbl", "READ<br/>SIGN");
        } else if (nearbyInteraction.kind === "chest") {
          setText(btnLookIcon, "lookIcon", "📦");
          setHtml(btnLookLabel, "lookLbl", "OPEN<br/>CHEST");
        } else if (nearbyInteraction.kind === "protestor") {
          setText(btnLookIcon, "lookIcon", hasSnack ? "🥨" : "💬");
          setHtml(btnLookLabel, "lookLbl", hasSnack ? "SHARE<br/>SNACK" : "SAY<br/>HI!");
        } else if (nearbyInteraction.kind === "turkey") {
          setText(btnLookIcon, "lookIcon", canFeedAnimal ? (hasSnack || gpsAssist ? "🥨" : "🌰") : "🦃");
          setHtml(btnLookLabel, "lookLbl", canFeedAnimal ? "FEED<br/>TURKEY" : "SHOO<br/>TURKEY");
        } else if (nearbyInteraction.kind === "squirrel") {
          setText(btnLookIcon, "lookIcon", canFeedAnimal ? (hasSnack || gpsAssist ? "🥨" : "🌰") : "🐿️");
          setHtml(btnLookLabel, "lookLbl", canFeedAnimal ? "FEED<br/>SQUIRREL" : "SHOO<br/>SQUIRREL");
        } else if (nearbyInteraction.kind === "cat") {
          setText(btnLookIcon, "lookIcon", canFeedAnimal ? (hasSnack || gpsAssist ? "🥨" : "🌰") : "🐱");
          setHtml(btnLookLabel, "lookLbl", canFeedAnimal ? "FEED<br/>CAT" : "SHOO<br/>CAT");
        } else if (nearbyInteraction.kind === "dog") {
          setText(btnLookIcon, "lookIcon", canFeedAnimal ? (hasSnack || gpsAssist ? "🥨" : "🌰") : "🐕");
          setHtml(btnLookLabel, "lookLbl", canFeedAnimal ? "FEED<br/>PUP" : "SHOO<br/>PUP");
        } else if (nearbyInteraction.kind === "spooky") {
          setText(btnLookIcon, "lookIcon", "🔦");
          setHtml(btnLookLabel, "lookLbl", "SPOOK<br/>BACK!");
        } else {
          setText(btnLookIcon, "lookIcon", "💬");
          setHtml(btnLookLabel, "lookLbl", "TALK /<br/>LOOK");
        }
      } else {
        setClass(btnLook, "lookTalk", "talk-ready", false);
        setClass(btnLook, "lookNeed", "need-look", needsLookAtCurb);
        setText(btnLookIcon, "lookIcon", needsLookAtCurb ? "🛑" : "👀");
        setHtml(btnLookLabel, "lookLbl", "LOOK<br/>BOTH WAYS");
      }
    }

    // Active Quest Directions Strip (Signpost Mode = Street Directions; GPS Assist = Compass & Meters)
    if (questTrackerEl) {
      let trackerText;
      if (!questHint) {
        trackerText = "🏆 All Quests Complete! Free Explore";
      } else if (gpsAssist) {
        const shortLabel = questHint.label.replace(/\s*\(.*\)/, "");
        trackerText = `🎯 ${shortLabel} • ${questHint.compass}`;
      } else if (pocketDirections && pocketDirections.summary) {
        const shortDest = questHint.label.replace(/\s*\(.*\)/, "");
        trackerText = `🧭 ${shortDest}: ${pocketDirections.summary}`;
      } else {
        const shortLabel = questHint.label.replace(/\s*\(.*\)/, "");
        trackerText = `🎯 ${shortLabel} • Check a Street Sign!`;
      }
      setText(questTrackerEl, "questTrk", trackerText);
    }

    // Top-left Street Banner:
    //  - Signpost Mode: only shows street identity from Home Base or an active street sign you checked!
    //  - GPS Assist Mode: classic live auto-updating street banner.
    const displayName = gpsAssist
      ? streetZone
        ? streetZone.name
        : originName || "Newton Centre"
      : signBanner?.title || "UNKNOWN STREET";
    const displayTag = gpsAssist
      ? streetZone
        ? streetZone.type
        : tileType
      : signBanner?.tag || "Check a Street Sign!";
    const isUnknownBanner = !gpsAssist && Boolean(signBanner?.unknown);
    const key = `${displayName}|${displayTag}|${isUnknownBanner}`;
    if (key !== lastStreetKey) {
      lastStreetKey = key;
      setText(streetNameEl, "stName", displayName);
      setText(streetZoneEl, "stZone", displayTag);
      if (bannerEl) {
        bannerEl.classList.toggle("unknown", isUnknownBanner);
        bannerEl.classList.add("slide-pop");
        if (bannerTimer) clearTimeout(bannerTimer);
        bannerTimer = setTimeout(() => bannerEl.classList.remove("slide-pop"), 320);
      }
    }

    // Bottom proximity pill (hides cleanly when dialogue or sign modal is open)
    if (landmarkPillEl) {
      if (dialogueState || signModalEl?.classList.contains("open")) {
        setClass(landmarkPillEl, "pillVis", "visible", false);
      } else if (facingUncheckedRoad && !nearbyInteraction) {
        const altNote =
          alternateInteraction?.kind === "npc"
            ? ` • Turn toward ${alternateInteraction.target.npcName} to talk`
            : alternateInteraction?.kind === "sign"
              ? " • Turn toward sign to read"
              : "";
        setText(landmarkPillEl, "pillTxt", `👀 Facing Road — Tap LOOK BOTH WAYS / Space to cross${altNote}`);
        setClass(landmarkPillEl, "pillVis", "visible", true);
      } else if (nearbyInteraction) {
        let label = "";
        if (nearbyInteraction.kind === "home_door") {
          label = "🏠 565 Boylston St — Go Inside";
        } else if (nearbyInteraction.kind === "house_prop") {
          label = `${nearbyInteraction.target?.icon || "✨"} ${nearbyInteraction.target?.label || "Inspect"}`;
        } else if (nearbyInteraction.kind === "sign") {
          const s = nearbyInteraction.target;
          label =
            gpsAssist || nearbyInteraction.alreadyChecked
              ? `🪧 ${s.label}`
              : "🪧 Read Street Sign";
        } else if (nearbyInteraction.kind === "chest") {
          label = `📦 Open ${nearbyInteraction.target.name}`;
        } else if (nearbyInteraction.kind === "protestor") {
          label = hasSnack
            ? `🥨 Share a snack ("${nearbyInteraction.target.chantText}")`
            : `🥨 Hungry marchers — grab snacks at Home Base or shops!`;
        } else if (nearbyInteraction.kind === "turkey") {
          label = canFeedAnimal ? "🥨 Wild Turkey — Feed a treat!" : "🦃 Wild Turkey — Shoo or bring snacks!";
        } else if (nearbyInteraction.kind === "squirrel") {
          label = canFeedAnimal ? "🌰 Wild Squirrel — Feed a treat!" : "🐿️ Wild Squirrel — Shoo or bring acorns!";
        } else if (nearbyInteraction.kind === "cat") {
          label = canFeedAnimal ? "🥨 Prowling Cat — Feed a treat!" : "🐱 Prowling Cat — Shoo or bring snacks!";
        } else if (nearbyInteraction.kind === "dog") {
          label = canFeedAnimal ? "🥨 Runaway Dog — Feed a treat!" : "🐕 Runaway Dog — Shoo or bring snacks!";
        } else if (nearbyInteraction.kind === "spooky") {
          label = `👻 ${nearbyInteraction.target?.name || "Spooky Foe"} — Spook Back or Swing Sword!`;
        } else {
          label = `💬 Talk to ${nearbyInteraction.target.npcName} (${nearbyInteraction.target.name})`;
        }
        if (needsLookAtCurb) {
          label += " · L to Look";
        }
        setText(landmarkPillEl, "pillTxt", label);
        setClass(landmarkPillEl, "pillVis", "visible", true);
      } else if (nearestLandmark && nearestLandmark.distTiles <= (gpsAssist ? 10 : 5.5)) {
        const meters = Math.round(nearestLandmark.distTiles * 6);
        const distNote = nearestLandmark.distTiles <= 4 || !gpsAssist ? "" : ` (${meters}m away)`;
        setText(landmarkPillEl, "pillTxt", `★ ${nearestLandmark.landmark.name}${distNote}`);
        setClass(landmarkPillEl, "pillVis", "visible", true);
      } else if (nearestBuilding && nearestBuilding.distTiles <= 2.2) {
        const b = nearestBuilding.building;
        const icon = BUILDING_KIND_ICONS[b.kind] || "🏠";
        const archTag = b.kind === "house" && b.arch ? ` • ${b.arch}` : b.kind && b.kind !== "house" ? ` • ${b.kind}` : "";
        const houseStreetNorm = extractStreetFromAddress(b.address);
        const streetKnown =
          gpsAssist ||
          b.isHomeBase ||
          (checkedStreets && houseStreetNorm && checkedStreets.has(houseStreetNorm));
        const houseNum = extractHouseNumber(b.address);

        let label = "";
        if (b.isHomeBase) {
          label = canEnterHouse
            ? `🏠 ${b.address} — Home Base • Press I or tap Inside (I) to go inside!`
            : `🏠 ${b.address} — Home Base`;
        } else if (streetKnown) {
          label =
            b.name && b.address
              ? `${icon} ${b.name} (${b.address})`
              : b.address
                ? `${icon} ${b.address}${archTag}`
                : b.name
                  ? `${icon} ${b.name}`
                  : "";
        } else {
          const kindLabel = BUILDING_KIND_LABELS[b.kind] || "House";
          label =
            b.name && houseNum
              ? `${icon} ${b.name} (${houseNum})`
              : houseNum
                ? b.kind && b.kind !== "house"
                  ? `${icon} ${kindLabel} ${houseNum}`
                  : `${icon} House ${houseNum}${archTag}`
                : b.name
                  ? `${icon} ${b.name}`
                  : b.kind && b.kind !== "house"
                    ? `${icon} ${kindLabel}`
                    : "";
        }

        if (label) {
          setText(landmarkPillEl, "pillTxt", label);
          setClass(landmarkPillEl, "pillVis", "visible", true);
        } else {
          setClass(landmarkPillEl, "pillVis", "visible", false);
        }
      } else {
        setClass(landmarkPillEl, "pillVis", "visible", false);
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
    getMiniMapCanvas: () => miniMapCanvasEl,
    isMapOpen: () => Boolean(mapModalEl?.classList.contains("open")),
    setMapModalOpen,
    refreshMapSidePanels,
    openSignModal,
    closeSignModal,
    isSignOpen: () => Boolean(signModalEl?.classList.contains("open")),
    openPaintModal,
    closePaintModal,
    isPaintOpen: () => Boolean(paintModalEl?.classList.contains("open")),
    openGameOver: (vehicleKind = "car") => {
      if (gameoverSubEl) {
        const hitThing =
          vehicleKind === "bike"
            ? "an annoying spandex biker"
            : vehicleKind === "truck"
              ? "a giant truck"
              : "a car";
        gameoverSubEl.textContent = `Mom is SO happy you're alive after getting hit by ${hitThing}... but you're GROUNDED FOREVER! Watch carefully for cars, trucks & annoying bikers on the road!`;
      }
      gameoverOverlayEl?.classList.add("open");
    },
    closeGameOver: () => {
      gameoverOverlayEl?.classList.remove("open");
    },
    isGameOverOpen: () => Boolean(gameoverOverlayEl?.classList.contains("open")),
    updateHUD,
  };
}
