/**
 * In-Browser "Build My Neighborhood" Studio UI Controller.
 *
 * Gives any parent or kid (on iPad Safari or Desktop, zero installs) a friendly
 * SNES-styled Studio right inside Neighborhood Explorer:
 *   - Tab 1 (Build New Town): Enter any street address + kid's name + map size
 *     (+ optional pre-added custom places) -> live progress bar -> builds real
 *     OpenStreetMap neighborhood in ~20s–2m -> saves to IndexedDB -> Play!
 *   - Tab 2 (Places & Goals): Add important custom places (by street address OR
 *     right where you're standing!), customize NPC name & dialogue, create custom
 *     multi-step goals/quests, or remove custom places.
 *   - Tab 3 (My Towns & Share): Switch between Built-in Newton Centre and all
 *     saved custom towns, Export portable `.json` neighborhood packs, or Import
 *     a `.json` pack shared by a friend or built via CLI!
 */

import {
  SIZE_PRESETS,
  buildNeighborhoodPackage,
  validateNeighborhoodPack,
  addCustomPlaceToPack,
  removePlaceFromPack,
  addCustomQuestToPack,
} from "./generator/pack_builder.js";
import { geocodeAddress } from "./generator/geocode.js";
import { BIOME_LIST, SEASON_LIST, SEASONS } from "./biomes.js";
import {
  HERO_HAIR_STYLES,
  HERO_HAIR_COLORS,
  HERO_SKIN_TONES,
  HERO_HEADWEAR,
  resolveHeroProfile,
} from "./characters.js";
import {
  BUILTIN_NEWTON_ID,
  saveNeighborhoodPack,
  listNeighborhoodPacks,
  deleteNeighborhoodPack,
  setActiveNeighborhoodId,
  getActiveNeighborhoodId,
} from "./generator/pack_store.js";

function downloadJsonFile(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Pure helper to determine whether keyboard focus is currently inside a form input.
 */
export function isEditableElementFocused(doc = typeof document !== "undefined" ? document : null) {
  const el = doc?.activeElement;
  if (!el) return false;
  const tag = String(el.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(el.isContentEditable);
}

export function createNeighborhoodStudio({
  worldMap,
  landmarks = [],
  quests = [],
  houseColors = {},
  neighborhoodMeta,
  activePack = null,
  getPlayerTile = () => ({ x: 0, y: 0 }),
  onShowToast = () => {},
} = {}) {
  const modalEl = document.getElementById("studio-modal");
  const btnOpenStudio = document.getElementById("btn-studio");
  const btnCloseStudio = document.getElementById("btn-studio-close");

  const tabButtons = Array.from(document.querySelectorAll("[data-studio-tab]"));
  const tabPanels = Array.from(document.querySelectorAll("[data-studio-panel]"));

  // Tab 1: Build New Town
  const inputAddress = document.getElementById("studio-address");
  const inputHero = document.getElementById("studio-hero");
  const selectSize = document.getElementById("studio-size");
  const selectBiome = document.getElementById("studio-biome");
  const selectSeason = document.getElementById("studio-season");
  const selectLabels = document.getElementById("studio-labels");
  const selectHairStyle = document.getElementById("studio-hair-style");
  const selectHairColor = document.getElementById("studio-hair-color");
  const selectSkinTone = document.getElementById("studio-skin-tone");
  const selectHeadwear = document.getElementById("studio-headwear");
  const quickAddrButtons = Array.from(document.querySelectorAll("[data-quick-addr]"));
  const prePlacesListEl = document.getElementById("studio-pre-places-list");
  const inputPreName = document.getElementById("studio-pre-name");
  const inputPreAddr = document.getElementById("studio-pre-addr");
  const inputPreNpc = document.getElementById("studio-pre-npc");
  const btnAddPrePlace = document.getElementById("btn-studio-add-pre-place");
  const btnBuildTown = document.getElementById("btn-studio-build");
  const progressWrapEl = document.getElementById("studio-progress-wrap");
  const progressBarEl = document.getElementById("studio-progress-bar");
  const progressTextEl = document.getElementById("studio-progress-text");
  const buildErrorEl = document.getElementById("studio-build-error");

  // Tab 2: Places & Goals
  const activeTownBadgeEl = document.getElementById("studio-active-town-badge");
  const selectActiveBiome = document.getElementById("studio-active-biome");
  const selectActiveSeason = document.getElementById("studio-active-season");
  const btnApplyBiome = document.getElementById("btn-studio-apply-biome");
  const biomeStatusEl = document.getElementById("studio-biome-status");
  const selectActiveHairStyle = document.getElementById("studio-active-hair-style");
  const selectActiveHairColor = document.getElementById("studio-active-hair-color");
  const selectActiveSkinTone = document.getElementById("studio-active-skin-tone");
  const selectActiveHeadwear = document.getElementById("studio-active-headwear");
  const btnApplyHero = document.getElementById("btn-studio-apply-hero");
  const heroStatusEl = document.getElementById("studio-hero-status");
  const placesListEl = document.getElementById("studio-places-list");
  const inputPlaceName = document.getElementById("studio-place-name");
  const selectPlaceLocMode = document.getElementById("studio-place-loc-mode");
  const inputPlaceAddr = document.getElementById("studio-place-addr");
  const inputPlaceNpc = document.getElementById("studio-place-npc");
  const inputPlaceDialogue = document.getElementById("studio-place-dialogue");
  const chkPlaceHeal = document.getElementById("studio-place-heal");
  const btnAddPlace = document.getElementById("btn-studio-add-place");
  const placeStatusEl = document.getElementById("studio-place-status");

  const inputQuestTitle = document.getElementById("studio-quest-title");
  const questPlacesPickEl = document.getElementById("studio-quest-places-pick");
  const btnAddQuest = document.getElementById("btn-studio-add-quest");
  const questStatusEl = document.getElementById("studio-quest-status");

  // Tab 3: My Towns & Share
  const savedTownsListEl = document.getElementById("studio-saved-towns");
  const btnExportPack = document.getElementById("btn-studio-export-pack");
  const btnImportPack = document.getElementById("btn-studio-import-pack");
  const inputImportFile = document.getElementById("studio-import-file");
  const shareStatusEl = document.getElementById("studio-share-status");

  // Working copy of the current neighborhood pack (allows customizing even the built-in Newton map as a saved copy!)
  let workingPack = activePack
    ? activePack
    : {
        formatVersion: 1,
        meta: {
          ...neighborhoodMeta,
          id: neighborhoodMeta?.isNewton ? "newton_custom" : neighborhoodMeta?.id || "custom_neighborhood",
        },
        worldMap,
        landmarks: [...landmarks],
        quests: [...quests],
        houseColors: { ...houseColors },
      };

  const preBuildPlaces = [];
  let isBuilding = false;
  let dirtyReloadNeeded = false;

  function isOpen() {
    return Boolean(modalEl?.classList.contains("open"));
  }

  function switchTab(tabId) {
    for (const btn of tabButtons) {
      btn.classList.toggle("active", btn.dataset.studioTab === tabId);
    }
    for (const panel of tabPanels) {
      panel.classList.toggle("active", panel.dataset.studioPanel === tabId);
    }
    if (tabId === "places") {
      renderPlacesAndQuestsTab();
    } else if (tabId === "towns") {
      renderSavedTownsTab();
    }
  }

  function open(initialTab = "build") {
    if (!modalEl) return;
    modalEl.classList.add("open");
    switchTab(initialTab);
    renderPreBuildPlaces();
  }

  function close() {
    if (!modalEl || isBuilding) return;
    modalEl.classList.remove("open");
    if (dirtyReloadNeeded) {
      dirtyReloadNeeded = false;
      window.location.reload();
    }
  }

  function setStatus(el, msg, isError = false) {
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
    el.classList.toggle("error", Boolean(isError));
  }

  function renderPreBuildPlaces() {
    if (!prePlacesListEl) return;
    prePlacesListEl.innerHTML = "";
    if (preBuildPlaces.length === 0) {
      const empty = document.createElement("div");
      empty.className = "studio-muted";
      empty.textContent = "Optional: add Grandma's House, your school, or a friend's house before building — or add them anytime after!";
      prePlacesListEl.appendChild(empty);
      return;
    }
    preBuildPlaces.forEach((p, idx) => {
      const chip = document.createElement("div");
      chip.className = "studio-row-chip";
      const info = document.createElement("span");
      info.textContent = `📍 ${p.name} (${p.address}) • ${p.npcName}`;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "studio-mini-del";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        preBuildPlaces.splice(idx, 1);
        renderPreBuildPlaces();
      });
      chip.appendChild(info);
      chip.appendChild(del);
      prePlacesListEl.appendChild(chip);
    });
  }

  btnAddPrePlace?.addEventListener("click", () => {
    const name = String(inputPreName?.value || "").trim();
    const addr = String(inputPreAddr?.value || "").trim();
    const npcName = String(inputPreNpc?.value || "").trim() || "Friendly Neighbor";
    if (!name || !addr) {
      setStatus(buildErrorEl, "Enter both a place name and street address to queue a custom place.", true);
      return;
    }
    setStatus(buildErrorEl, "");
    preBuildPlaces.push({ name, address: addr, npcName, category: "custom", healHearts: 2, givesSnacks: true });
    if (inputPreName) inputPreName.value = "";
    if (inputPreAddr) inputPreAddr.value = "";
    if (inputPreNpc) inputPreNpc.value = "";
    renderPreBuildPlaces();
  });

  // Quick-fill neighborhood starter chips (Jerusalem, Tel Aviv, Austin, etc.)
  for (const chip of quickAddrButtons) {
    chip.addEventListener("click", () => {
      if (inputAddress && chip.dataset.quickAddr) {
        inputAddress.value = chip.dataset.quickAddr;
      }
      if (selectBiome && chip.dataset.quickBiome) {
        selectBiome.value = chip.dataset.quickBiome;
      }
      if (selectLabels && chip.dataset.quickBiome?.startsWith("israel_")) {
        selectLabels.value = "bilingual";
      }
      setStatus(buildErrorEl, "");
      inputAddress?.focus();
    });
  }

  // --- Tab 1: Build New Neighborhood Live in the Browser! ---
  btnBuildTown?.addEventListener("click", async () => {
    if (isBuilding) return;
    const address = String(inputAddress?.value || "").trim();
    const heroName = String(inputHero?.value || "").trim() || "Explorer";
    const size = String(selectSize?.value || "walkable");
    const biome = String(selectBiome?.value || "auto");
    const season = String(selectSeason?.value || "auto");
    const labelMode = String(selectLabels?.value || "bilingual");

    if (!address) {
      setStatus(
        buildErrorEl,
        'Please enter a street address (e.g., "Emek Refaim 24, Jerusalem, Israel" or "1204 Barton Springs Rd, Austin, TX").',
        true
      );
      inputAddress?.focus();
      return;
    }

    isBuilding = true;
    setStatus(buildErrorEl, "");
    if (btnBuildTown) {
      btnBuildTown.disabled = true;
      btnBuildTown.textContent = "⏳ Building Your Neighborhood...";
    }
    if (progressWrapEl) progressWrapEl.style.display = "block";
    if (progressBarEl) progressBarEl.style.width = "8%";
    if (progressTextEl) progressTextEl.textContent = `Looking up "${address}"...`;

    try {
      const heroProfile = resolveHeroProfile({
        hairStyle: selectHairStyle?.value,
        hairColor: selectHairColor?.value,
        skinTone: selectSkinTone?.value,
        headwear: selectHeadwear?.value,
        tzitzit: selectHeadwear?.value === "kippah",
      });
      const pack = await buildNeighborhoodPackage({
        address,
        heroName,
        heroProfile,
        size,
        biome,
        season,
        labelMode,
        customPlacesConfig: preBuildPlaces.length > 0 ? { places: preBuildPlaces } : null,
        onProgress: (ev) => {
          let pct = 10;
          if (ev.stage === "geocode") pct = 12;
          else if (ev.stage === "fetch") {
            const frac = ev.total > 0 ? ev.completed / ev.total : 0;
            pct = Math.round(15 + frac * 55);
          } else if (ev.stage === "rasterize") {
            pct = ev.completed >= 1 ? 84 : 74;
          } else if (ev.stage === "custom_places") {
            pct = 90;
          } else if (ev.stage === "done") {
            pct = 100;
          }
          if (progressBarEl) progressBarEl.style.width = `${pct}%`;
          if (progressTextEl) progressTextEl.textContent = ev.message;
        },
      });

      if (progressTextEl) progressTextEl.textContent = "Saving neighborhood to your browser...";
      await saveNeighborhoodPack(pack);
      setActiveNeighborhoodId(pack.meta.id);
      if (progressBarEl) progressBarEl.style.width = "100%";
      if (progressTextEl) {
        progressTextEl.textContent = `🎉 Built ${pack.meta.townName} (${pack.worldMap.buildings.length} buildings, ${pack.landmarks.length} landmarks)! Launching...`;
      }

      setTimeout(() => {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete("pack");
        nextUrl.searchParams.set("neighborhood", pack.meta.id);
        window.location.href = nextUrl.toString();
      }, 650);
    } catch (err) {
      setStatus(buildErrorEl, `Could not build neighborhood: ${err.message}`, true);
      isBuilding = false;
      if (btnBuildTown) {
        btnBuildTown.disabled = false;
        btnBuildTown.textContent = "🚀 Build My Neighborhood";
      }
    }
  });

  // --- Tab 2: Customize Places & Goals ---
  function renderPlacesAndQuestsTab() {
    if (activeTownBadgeEl) {
      activeTownBadgeEl.textContent = `${workingPack.meta?.townName || "Neighborhood"} • ${workingPack.meta?.homeAddress || "Home Base"}`;
    }
    if (selectActiveBiome) {
      if (selectActiveBiome.options.length === 0) {
        for (const b of BIOME_LIST) {
          const opt = document.createElement("option");
          opt.value = b.id;
          opt.textContent = b.label;
          selectActiveBiome.appendChild(opt);
        }
      }
      selectActiveBiome.value =
        workingPack.worldMap?.meta?.biome ||
        workingPack.meta?.biome ||
        neighborhoodMeta?.biome ||
        "new_england_autumn";
    }
    if (selectActiveSeason) {
      if (selectActiveSeason.options.length === 0) {
        for (const s of Object.values(SEASONS)) {
          const opt = document.createElement("option");
          opt.value = s.id;
          opt.textContent = s.label;
          selectActiveSeason.appendChild(opt);
        }
      }
      selectActiveSeason.value =
        workingPack.worldMap?.meta?.season ||
        workingPack.meta?.season ||
        neighborhoodMeta?.season ||
        "fall";
    }
    const curHero = resolveHeroProfile(
      workingPack.worldMap?.meta?.heroProfile ||
        workingPack.meta?.heroProfile ||
        neighborhoodMeta?.heroProfile
    );
    if (selectActiveHairStyle) selectActiveHairStyle.value = curHero.hairStyle;
    if (selectActiveHairColor) selectActiveHairColor.value = curHero.hairColor;
    if (selectActiveSkinTone) selectActiveSkinTone.value = curHero.skinTone;
    if (selectActiveHeadwear) selectActiveHeadwear.value = curHero.headwear;
    if (placesListEl) {
      placesListEl.innerHTML = "";
      for (const lm of workingPack.landmarks || []) {
        const row = document.createElement("div");
        row.className = "studio-row-chip";
        const badge = lm.id === "home_base" ? "🏠 Home" : lm.isCustom ? "⭐ Custom" : "📍 Auto";
        const text = document.createElement("span");
        text.textContent = `${badge} · ${lm.name}${lm.npcName ? ` (${lm.npcName})` : ""}`;
        row.appendChild(text);

        if (lm.id !== "home_base") {
          const del = document.createElement("button");
          del.type = "button";
          del.className = "studio-mini-del";
          del.title = "Remove place";
          del.textContent = "✕";
          del.addEventListener("click", async () => {
            workingPack = removePlaceFromPack(workingPack, lm.id);
            await persistWorkingPack();
            renderPlacesAndQuestsTab();
            setStatus(placeStatusEl, `Removed "${lm.name}". Close Studio to refresh the world!`);
          });
          row.appendChild(del);
        }
        placesListEl.appendChild(row);
      }
    }

    if (questPlacesPickEl) {
      questPlacesPickEl.innerHTML = "";
      const candidates = (workingPack.landmarks || []).filter((l) => l.id !== "home_base");
      for (const lm of candidates) {
        const label = document.createElement("label");
        label.className = "studio-check-pill";
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.value = lm.id;
        const txt = document.createElement("span");
        txt.textContent = lm.name;
        label.appendChild(cb);
        label.appendChild(txt);
        questPlacesPickEl.appendChild(label);
      }
    }
  }

  async function persistWorkingPack() {
    if (!workingPack.meta?.id || workingPack.meta.id === BUILTIN_NEWTON_ID) {
      workingPack = {
        ...workingPack,
        meta: {
          ...workingPack.meta,
          id: "newton_custom",
          townName: `${workingPack.meta?.townName || "Newton Centre"} (Custom)`,
        },
      };
    }
    await saveNeighborhoodPack(workingPack);
    setActiveNeighborhoodId(workingPack.meta.id);
    dirtyReloadNeeded = true;
  }

  selectPlaceLocMode?.addEventListener("change", () => {
    if (!inputPlaceAddr) return;
    const isHere = selectPlaceLocMode.value === "here";
    inputPlaceAddr.disabled = isHere;
    inputPlaceAddr.placeholder = isHere
      ? "Will place right where your explorer is standing!"
      : "Street address (e.g., 42 Oak St)";
  });

  btnApplyBiome?.addEventListener("click", async () => {
    const nextBiome = String(selectActiveBiome?.value || "").trim();
    const nextSeason = String(selectActiveSeason?.value || "").trim();
    if (!nextBiome) return;
    try {
      workingPack = {
        ...workingPack,
        meta: {
          ...(workingPack.meta || {}),
          biome: nextBiome,
          ...(nextSeason ? { season: nextSeason } : {}),
        },
        worldMap: {
          ...(workingPack.worldMap || {}),
          meta: {
            ...(workingPack.worldMap?.meta || {}),
            biome: nextBiome,
            ...(nextSeason ? { season: nextSeason } : {}),
          },
        },
      };
      await persistWorkingPack();
      setStatus(biomeStatusEl, "✅ Switched biome & season! Reloading neighborhood...");
      setTimeout(() => {
        const u = new URL(window.location.href);
        u.searchParams.delete("pack");
        u.searchParams.set("neighborhood", workingPack.meta.id);
        window.location.href = u.toString();
      }, 350);
    } catch (err) {
      setStatus(biomeStatusEl, `Could not switch biome: ${err.message}`, true);
    }
  });

  btnApplyHero?.addEventListener("click", async () => {
    const nextHeroProfile = resolveHeroProfile({
      hairStyle: selectActiveHairStyle?.value,
      hairColor: selectActiveHairColor?.value,
      skinTone: selectActiveSkinTone?.value,
      headwear: selectActiveHeadwear?.value,
      tzitzit: selectActiveHeadwear?.value === "kippah",
    });
    try {
      workingPack = {
        ...workingPack,
        meta: {
          ...(workingPack.meta || {}),
          heroProfile: nextHeroProfile,
        },
        worldMap: {
          ...(workingPack.worldMap || {}),
          meta: {
            ...(workingPack.worldMap?.meta || {}),
            heroProfile: nextHeroProfile,
          },
        },
      };
      await persistWorkingPack();
      setStatus(heroStatusEl, "✅ Updated Explorer Style! Reloading your hero sprites...");
      setTimeout(() => {
        const u = new URL(window.location.href);
        u.searchParams.delete("pack");
        u.searchParams.set("neighborhood", workingPack.meta.id);
        window.location.href = u.toString();
      }, 350);
    } catch (err) {
      setStatus(heroStatusEl, `Could not update hero style: ${err.message}`, true);
    }
  });

  btnAddPlace?.addEventListener("click", async () => {
    const name = String(inputPlaceName?.value || "").trim();
    const locMode = selectPlaceLocMode?.value || "address";
    const addr = String(inputPlaceAddr?.value || "").trim();
    const npcName = String(inputPlaceNpc?.value || "").trim() || "Friendly Neighbor";
    const dialogue = String(inputPlaceDialogue?.value || "").trim();
    const heals = Boolean(chkPlaceHeal?.checked);

    if (!name) {
      setStatus(placeStatusEl, "Please give your place a name (e.g., Grandma's House).", true);
      return;
    }

    setStatus(placeStatusEl, "Adding place...");
    try {
      let placeCoords = {};
      if (locMode === "here") {
        const pt = getPlayerTile();
        placeCoords = { tileX: pt.x, tileY: pt.y, address: addr || "Neighborhood Spot" };
      } else {
        if (!addr) {
          setStatus(placeStatusEl, 'Enter a street address, or switch to "Right where I am standing".', true);
          return;
        }
        const townHint = workingPack.meta?.townName || "";
        const q = townHint && !addr.includes(",") ? `${addr}, ${townHint}` : addr;
        const geo = await geocodeAddress(q);
        placeCoords = { lat: geo.lat, lon: geo.lon, address: geo.homeAddress || addr };
      }

      const { pack: updated, landmark } = addCustomPlaceToPack(workingPack, {
        name,
        ...placeCoords,
        npcName,
        dialogue: dialogue ? [dialogue] : undefined,
        healHearts: heals ? 3 : 0,
        givesSnacks: heals,
      });
      workingPack = updated;
      await persistWorkingPack();

      if (inputPlaceName) inputPlaceName.value = "";
      if (inputPlaceAddr) inputPlaceAddr.value = "";
      if (inputPlaceNpc) inputPlaceNpc.value = "";
      if (inputPlaceDialogue) inputPlaceDialogue.value = "";

      renderPlacesAndQuestsTab();
      setStatus(
        placeStatusEl,
        `✅ Added "${landmark.name}" at tile (${landmark.tileX}, ${landmark.tileY})! Close Studio to play with your new place!`
      );
      onShowToast(`📍 Added ${landmark.name}! Close Studio to explore it!`);
    } catch (err) {
      setStatus(placeStatusEl, `Could not add place: ${err.message}`, true);
    }
  });

  btnAddQuest?.addEventListener("click", async () => {
    const title = String(inputQuestTitle?.value || "").trim();
    const selectedIds = Array.from(questPlacesPickEl?.querySelectorAll("input:checked") || []).map(
      (el) => el.value
    );
    if (!title) {
      setStatus(questStatusEl, 'Give your goal a fun title (e.g., "Cookies at Grandma\'s").', true);
      return;
    }
    if (selectedIds.length === 0) {
      setStatus(questStatusEl, "Pick at least 1 destination place above.", true);
      return;
    }
    try {
      const { pack: updated, quest } = addCustomQuestToPack(workingPack, {
        title,
        targetLandmarkIds: selectedIds,
      });
      workingPack = updated;
      await persistWorkingPack();
      if (inputQuestTitle) inputQuestTitle.value = "";
      renderPlacesAndQuestsTab();
      setStatus(questStatusEl, `🎯 Added goal "${quest.title}" (${quest.steps.length} stops)! Close Studio to start it!`);
    } catch (err) {
      setStatus(questStatusEl, err.message, true);
    }
  });

  // --- Tab 3: Saved Towns, Export & Import ---
  async function renderSavedTownsTab() {
    if (!savedTownsListEl) return;
    savedTownsListEl.innerHTML = "";
    const activeId = getActiveNeighborhoodId();
    const saved = await listNeighborhoodPacks().catch(() => []);

    // Built-in Newton Centre entry (always available!)
    const builtInRow = document.createElement("div");
    builtInRow.className = `studio-town-card${activeId === BUILTIN_NEWTON_ID ? " current" : ""}`;
    builtInRow.innerHTML = `
      <div>
        <strong>🏡 Newton Centre, MA (Built-in Default)</strong>
        <div class="studio-muted">565 Boylston St • Full handcrafted neighborhood</div>
      </div>
    `;
    const newtonActions = document.createElement("div");
    newtonActions.className = "studio-town-actions";
    if (activeId !== BUILTIN_NEWTON_ID) {
      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = "studio-btn primary";
      playBtn.textContent = "▶ Play";
      playBtn.addEventListener("click", () => {
        setActiveNeighborhoodId(BUILTIN_NEWTON_ID);
        const u = new URL(window.location.href);
        u.searchParams.delete("neighborhood");
        u.searchParams.delete("pack");
        window.location.href = u.toString();
      });
      newtonActions.appendChild(playBtn);
    } else {
      const tag = document.createElement("span");
      tag.className = "studio-active-pill";
      tag.textContent = "✓ Playing";
      newtonActions.appendChild(tag);
    }
    builtInRow.appendChild(newtonActions);
    savedTownsListEl.appendChild(builtInRow);

    for (const item of saved) {
      const row = document.createElement("div");
      row.className = `studio-town-card${activeId === item.id ? " current" : ""}`;
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `🗺️ ${item.townName} (${item.heroName})`;
      const sub = document.createElement("div");
      sub.className = "studio-muted";
      sub.textContent = `${item.homeAddress} • ${item.buildingsCount} buildings · ${item.landmarksCount} places · ${item.questsCount} quests`;
      info.appendChild(title);
      info.appendChild(sub);

      const acts = document.createElement("div");
      acts.className = "studio-town-actions";
      if (activeId !== item.id) {
        const playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "studio-btn primary";
        playBtn.textContent = "▶ Play";
        playBtn.addEventListener("click", () => {
          setActiveNeighborhoodId(item.id);
          const u = new URL(window.location.href);
          u.searchParams.delete("pack");
          u.searchParams.set("neighborhood", item.id);
          window.location.href = u.toString();
        });
        acts.appendChild(playBtn);
      } else {
        const tag = document.createElement("span");
        tag.className = "studio-active-pill";
        tag.textContent = "✓ Playing";
        acts.appendChild(tag);
      }

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "studio-btn danger";
      delBtn.textContent = "🗑️";
      delBtn.title = "Delete saved neighborhood";
      delBtn.addEventListener("click", async () => {
        const wasActive = getActiveNeighborhoodId() === item.id;
        await deleteNeighborhoodPack(item.id);
        if (wasActive) {
          window.location.reload();
        } else {
          renderSavedTownsTab();
        }
      });
      acts.appendChild(delBtn);

      row.appendChild(info);
      row.appendChild(acts);
      savedTownsListEl.appendChild(row);
    }
  }

  btnExportPack?.addEventListener("click", () => {
    const slug = workingPack.meta?.id || "neighborhood";
    downloadJsonFile(`${slug}_pack.json`, workingPack);
    setStatus(
      shareStatusEl,
      `✅ Downloaded ${slug}_pack.json! Share it with family/friends or import it on any device!`
    );
  });

  btnImportPack?.addEventListener("click", () => {
    inputImportFile?.click();
  });

  inputImportFile?.addEventListener("change", async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const check = validateNeighborhoodPack(parsed);
      if (!check.valid) {
        setStatus(shareStatusEl, `Invalid neighborhood pack: ${check.error}`, true);
        return;
      }
      if (!parsed.meta) parsed.meta = {};
      if (!parsed.meta.id) parsed.meta.id = `imported_${Date.now().toString(36)}`;
      await saveNeighborhoodPack(parsed);
      setActiveNeighborhoodId(parsed.meta.id);
      setStatus(shareStatusEl, `🎉 Imported ${parsed.meta.townName || "Custom Neighborhood"}! Launching...`);
      setTimeout(() => {
        const u = new URL(window.location.href);
        u.searchParams.delete("pack");
        u.searchParams.set("neighborhood", parsed.meta.id);
        window.location.href = u.toString();
      }, 450);
    } catch (err) {
      setStatus(shareStatusEl, `Could not import file: ${err.message}`, true);
    } finally {
      if (inputImportFile) inputImportFile.value = "";
    }
  });

  // Tab switching & open/close wiring
  for (const btn of tabButtons) {
    btn.addEventListener("click", () => switchTab(btn.dataset.studioTab));
  }
  btnOpenStudio?.addEventListener("click", () => {
    document.getElementById("tools-drawer")?.classList.remove("open");
    document.getElementById("btn-tools-menu")?.classList.remove("open");
    open("build");
  });
  btnCloseStudio?.addEventListener("click", close);
  modalEl?.addEventListener("pointerdown", (e) => {
    if (e.target === modalEl) close();
  });

  // Populate size dropdown labels cleanly from SIZE_PRESETS
  if (selectSize && selectSize.options.length === 0) {
    for (const preset of Object.values(SIZE_PRESETS)) {
      const opt = document.createElement("option");
      opt.value = preset.id;
      opt.textContent = `${preset.label} · ${preset.eta}`;
      selectSize.appendChild(opt);
    }
  }

  // Populate Regional Biome & Architecture dropdown (Auto-Detect + Israel & World biomes!)
  if (selectBiome && selectBiome.options.length === 0) {
    const autoOpt = document.createElement("option");
    autoOpt.value = "auto";
    autoOpt.textContent = "✨ Auto-Detect from Address";
    selectBiome.appendChild(autoOpt);
    for (const b of BIOME_LIST) {
      const opt = document.createElement("option");
      opt.value = b.id;
      opt.textContent = b.label;
      selectBiome.appendChild(opt);
    }
  }
  if (selectSeason && selectSeason.options.length === 0) {
    for (const s of SEASON_LIST) {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      selectSeason.appendChild(opt);
    }
  }

  const fillSelectFromMap = (el, mapObj, defaultVal) => {
    if (!el || el.options.length > 0) return;
    for (const item of Object.values(mapObj)) {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item.label;
      el.appendChild(opt);
    }
    if (defaultVal) el.value = defaultVal;
  };
  fillSelectFromMap(selectHairStyle, HERO_HAIR_STYLES, "short");
  fillSelectFromMap(selectHairColor, HERO_HAIR_COLORS, "light_brown");
  fillSelectFromMap(selectSkinTone, HERO_SKIN_TONES, "warm");
  fillSelectFromMap(selectHeadwear, HERO_HEADWEAR, "none");
  fillSelectFromMap(selectActiveHairStyle, HERO_HAIR_STYLES, "short");
  fillSelectFromMap(selectActiveHairColor, HERO_HAIR_COLORS, "light_brown");
  fillSelectFromMap(selectActiveSkinTone, HERO_SKIN_TONES, "warm");
  fillSelectFromMap(selectActiveHeadwear, HERO_HEADWEAR, "kippah");

  return {
    open,
    close,
    isOpen,
  };
}
