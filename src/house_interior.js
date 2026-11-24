/**
 * Home Base Interior System (565 Boylston St) — 16-Bit SNES Overworld Indoor Rooms!
 * Implements GDD Section 6.2 & Section 8.2 Home Base gameplay ideas:
 *   1. Main Floor (Cozy Living Room, Kitchen Snack Counter, Home Base Outfit Closet,
 *      Suspicious Bookshelf, and Basement Pool Table / D&D Books)
 *   2. Secret Upstairs Reading Nook (GDD 6.2 #4) — revealed behind the suspicious bookshelf,
 *      with a glowing chest containing the Golden D20 (rolls lucky bonus coins!)
 *   3. 8-Bit D&D Basement Dungeon (GDD 8.2 #19) — Halfling Bard, Gnome Wizard & Eldritch Knight
 *      statues with a 3-switch rune puzzle guarding the Bag of Holding (expands snack pocket to 12!)
 *
 * Pure JS (zero DOM dependencies) so all collision, room transitions, puzzles, and rewards
 * are 100% unit-testable in headless Node and render identically on Kaplay WebGL & Canvas 2D.
 */

import { DEFAULT_HITBOX, TILE_SIZE } from "./player.js";

export const INTERIOR_ROOMS = {
  main_floor: {
    id: "main_floor",
    name: "565 BOYLSTON ST — INSIDE HOME",
    tag: "Living Room & Kitchen",
    width: 20,
    height: 12,
    spawn: { x: 9.5, y: 9.2 },
    // Solid furniture / wall boxes in tile coordinates (inclusive min..max)
    solids: [
      { minX: 3, minY: 2, maxX: 5, maxY: 2, id: "bookshelf" }, // opens when secret revealed!
      { minX: 8, minY: 2, maxX: 11, maxY: 2, id: "fireplace" },
      { minX: 14, minY: 2, maxX: 17, maxY: 2, id: "kitchen_counter" },
      { minX: 2, minY: 5, maxX: 2, maxY: 6, id: "outfit_closet" },
      { minX: 8, minY: 5, maxX: 11, maxY: 5, id: "couch" },
      { minX: 14, minY: 7, maxX: 16, maxY: 8, id: "pool_table" },
    ],
  },
  upstairs_nook: {
    id: "upstairs_nook",
    name: "SECRET UPSTAIRS READING NOOK",
    tag: "Cozy Attic Loft",
    width: 16,
    height: 10,
    spawn: { x: 4.5, y: 7.4 },
    solids: [
      { minX: 2, minY: 2, maxX: 4, maxY: 2, id: "attic_books_l" },
      { minX: 11, minY: 2, maxX: 13, maxY: 2, id: "attic_books_r" },
      { minX: 7, minY: 3, maxX: 8, maxY: 3, id: "d20_chest" },
      { minX: 12, minY: 6, maxX: 13, maxY: 6, id: "beanbag" },
    ],
  },
  dnd_basement: {
    id: "dnd_basement",
    name: "8-BIT D&D BASEMENT DUNGEON",
    tag: "3-Switch Puzzle Room",
    width: 18,
    height: 11,
    spawn: { x: 8.5, y: 8.4 },
    solids: [
      { minX: 4, minY: 3, maxX: 4, maxY: 3, id: "statue_bard" },
      { minX: 9, minY: 3, maxX: 9, maxY: 3, id: "statue_wizard" },
      { minX: 13, minY: 3, maxX: 13, maxY: 3, id: "statue_knight" },
      { minX: 8, minY: 2, maxX: 9, maxY: 2, id: "bag_chest" },
    ],
  },
};

export function createHomeInteriorSystem(questSystem) {
  const state = {
    active: false,
    roomId: "main_floor",
    x: 9.5 * TILE_SIZE,
    y: 9.2 * TILE_SIZE,
    facing: "up",
    // Persisted secrets synced with questSystem.state.openedHomeSecrets
    bookshelfOpened: questSystem.state.openedHomeSecrets?.has("bookshelf_secret") || false,
    d20ChestOpened:
      questSystem.state.openedHomeSecrets?.has("golden_d20_chest") ||
      questSystem.state.inventory.has("golden_d20"),
    dndSolved:
      questSystem.state.openedHomeSecrets?.has("dnd_basement_solved") ||
      questSystem.state.inventory.has("bag_of_holding"),
    bagChestOpened: questSystem.state.inventory.has("bag_of_holding"),
    // 3-switch sequence in D&D basement (0 -> 1 -> 2)
    switchLit: [false, false, false],
    lastD20Roll: null,
    // Remember outdoor return spot right outside the front door
    returnPos: null,
  };

  function syncSecretsFromSave() {
    const secrets = questSystem.state.openedHomeSecrets;
    state.bookshelfOpened = Boolean(secrets?.has("bookshelf_secret"));
    state.d20ChestOpened = Boolean(
      secrets?.has("golden_d20_chest") || questSystem.state.inventory.has("golden_d20")
    );
    state.dndSolved = Boolean(
      secrets?.has("dnd_basement_solved") || questSystem.state.inventory.has("bag_of_holding")
    );
    state.bagChestOpened = Boolean(questSystem.state.inventory.has("bag_of_holding"));
    if (state.dndSolved) {
      state.switchLit = [true, true, true];
    }
  }

  function getRoom() {
    return INTERIOR_ROOMS[state.roomId] || INTERIOR_ROOMS.main_floor;
  }

  function enterHouse(returnX, returnY) {
    syncSecretsFromSave();
    state.active = true;
    state.roomId = "main_floor";
    const room = getRoom();
    state.x = room.spawn.x * TILE_SIZE;
    state.y = room.spawn.y * TILE_SIZE;
    state.facing = "up";
    state.returnPos = { x: returnX, y: returnY };
    return { x: state.x, y: state.y, facing: state.facing, room };
  }

  function exitHouse() {
    state.active = false;
    state.roomId = "main_floor";
    return state.returnPos;
  }

  function transitionRoom(nextRoomId, spawnTileX, spawnTileY, facing = "up") {
    if (!INTERIOR_ROOMS[nextRoomId]) return null;
    state.roomId = nextRoomId;
    state.x = spawnTileX * TILE_SIZE;
    state.y = spawnTileY * TILE_SIZE;
    state.facing = facing;
    return { x: state.x, y: state.y, facing, room: INTERIOR_ROOMS[nextRoomId] };
  }

  /**
   * Check whether a bounding box centered at (cx, cy) collides with interior walls or furniture.
   */
  function isInteriorBoxBlocked(cx, cy, hitbox = DEFAULT_HITBOX) {
    const room = getRoom();
    const halfW = hitbox.width / 2;
    const halfH = hitbox.height / 2;
    const minPxX = 2 * TILE_SIZE;
    const maxPxX = (room.width - 2) * TILE_SIZE;
    const minPxY = 2 * TILE_SIZE;
    const maxPxY = (room.height - 1) * TILE_SIZE;

    if (
      cx - halfW < minPxX ||
      cx + halfW > maxPxX ||
      cy - halfH < minPxY ||
      cy + halfH > maxPxY
    ) {
      return true;
    }

    const left = Math.floor((cx - halfW) / TILE_SIZE);
    const right = Math.floor((cx + halfW - 0.001) / TILE_SIZE);
    const top = Math.floor((cy - halfH) / TILE_SIZE);
    const bottom = Math.floor((cy + halfH - 0.001) / TILE_SIZE);

    for (const s of room.solids) {
      // Once the suspicious bookshelf slides aside, its right half (tile x=5) opens into stairs!
      if (room.id === "main_floor" && s.id === "bookshelf" && state.bookshelfOpened) {
        if (left <= 4 && right >= 3 && top <= 2 && bottom >= 2) return true;
        continue;
      }
      if (left <= s.maxX && right >= s.minX && top <= s.maxY && bottom >= s.minY) {
        return true;
      }
    }
    return false;
  }

  function getRoomInteractables() {
    const room = getRoom();
    if (room.id === "main_floor") {
      const list = [
        {
          id: "exit_door",
          kind: "house_prop",
          label: "Step Outside (565 Boylston St)",
          shortLabel: "GO<br/>OUTSIDE",
          icon: "🚪",
          x: 9.5 * TILE_SIZE,
          y: 10.4 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "kitchen_snacks",
          kind: "house_prop",
          label: "Kitchen Snack Jar (Restock Snacks & Heal!)",
          shortLabel: "GRAB<br/>SNACKS",
          icon: "🥨",
          x: 15.5 * TILE_SIZE,
          y: 2.9 * TILE_SIZE,
          radius: 28,
        },
        {
          id: "outfit_closet",
          kind: "house_prop",
          label: "Home Base Outfit Closet",
          shortLabel: "OUTFIT<br/>CLOSET",
          icon: "👕",
          x: 2.6 * TILE_SIZE,
          y: 5.5 * TILE_SIZE,
          radius: 24,
        },
        {
          id: "bookshelf",
          kind: "house_prop",
          label: state.bookshelfOpened
            ? "Secret Stairs → Upstairs Reading Nook"
            : "Suspicious Bookshelf",
          shortLabel: state.bookshelfOpened ? "GO<br/>UPSTAIRS" : "CHECK<br/>BOOKS",
          icon: state.bookshelfOpened ? "🪜" : "📚",
          x: (state.bookshelfOpened ? 5.2 : 4.5) * TILE_SIZE,
          y: 2.9 * TILE_SIZE,
          radius: 26,
        },
        {
          id: "pool_table_dnd",
          kind: "house_prop",
          label: "Basement Pool Table & D&D Portal",
          shortLabel: "D&D<br/>BASEMENT",
          icon: "🐉",
          x: 15.2 * TILE_SIZE,
          y: 7.5 * TILE_SIZE,
          radius: 30,
        },
      ];
      return list;
    }

    if (room.id === "upstairs_nook") {
      return [
        {
          id: "nook_stairs_down",
          kind: "house_prop",
          label: "Stairs Down → Living Room",
          shortLabel: "GO<br/>DOWN",
          icon: "🪜",
          x: 3.5 * TILE_SIZE,
          y: 8.2 * TILE_SIZE,
          radius: 24,
        },
        {
          id: "golden_d20_chest",
          kind: "house_prop",
          label: state.d20ChestOpened
            ? "Roll the Golden D20 for Bonus Coins!"
            : "Glowing Attic Chest",
          shortLabel: state.d20ChestOpened ? "ROLL<br/>D20!" : "OPEN<br/>CHEST",
          icon: "🎲",
          x: 7.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 26,
        },
      ];
    }

    if (room.id === "dnd_basement") {
      return [
        {
          id: "dnd_portal_exit",
          kind: "house_prop",
          label: "Glowing Portal → Living Room",
          shortLabel: "LEAVE<br/>DUNGEON",
          icon: "🌀",
          x: 8.5 * TILE_SIZE,
          y: 9.2 * TILE_SIZE,
          radius: 24,
        },
        {
          id: "statue_bard",
          kind: "house_prop",
          label: "Halfling Bard Statue",
          shortLabel: "READ<br/>STATUE",
          icon: "🎵",
          x: 4.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "statue_wizard",
          kind: "house_prop",
          label: "Gnome Wizard Statue",
          shortLabel: "READ<br/>STATUE",
          icon: "🧙",
          x: 9.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "statue_knight",
          kind: "house_prop",
          label: "Eldritch Knight Statue",
          shortLabel: "READ<br/>STATUE",
          icon: "🛡️",
          x: 13.5 * TILE_SIZE,
          y: 3.8 * TILE_SIZE,
          radius: 22,
        },
        {
          id: "switch_0",
          kind: "house_prop",
          label: "Emerald Floor Switch (1st)",
          shortLabel: "PRESS<br/>SWITCH",
          icon: "🟢",
          x: 4.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 20,
        },
        {
          id: "switch_1",
          kind: "house_prop",
          label: "Sapphire Floor Switch (2nd)",
          shortLabel: "PRESS<br/>SWITCH",
          icon: "🔵",
          x: 9.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 20,
        },
        {
          id: "switch_2",
          kind: "house_prop",
          label: "Ruby Floor Switch (3rd)",
          shortLabel: "PRESS<br/>SWITCH",
          icon: "🔴",
          x: 13.5 * TILE_SIZE,
          y: 6.5 * TILE_SIZE,
          radius: 20,
        },
        {
          id: "bag_of_holding_chest",
          kind: "house_prop",
          label: state.bagChestOpened
            ? "Bag of Holding Chest (Opened!)"
            : state.dndSolved
              ? "Unlocked Dungeon Chest!"
              : "Sealed Dungeon Chest (Solve 3 Switches)",
          shortLabel: "OPEN<br/>CHEST",
          icon: "🎒",
          x: 8.5 * TILE_SIZE,
          y: 2.8 * TILE_SIZE,
          radius: 24,
        },
      ];
    }
    return [];
  }

  function findNearbyInteriorProp(px, py) {
    const props = getRoomInteractables();
    let best = null;
    for (const p of props) {
      const dist = Math.hypot(px - p.x, py - p.y);
      if (dist <= p.radius && (!best || dist < best.dist)) {
        best = { kind: "house_prop", target: p, dist };
      }
    }
    return best;
  }

  /**
   * Handle interacting with any prop inside Home Base (Main Floor, Upstairs Reading Nook, or D&D Basement).
   */
  function interactWithInteriorProp(propId, { rng = Math.random } = {}) {
    if (propId === "exit_door") {
      return { action: "exit_house" };
    }

    if (propId === "kitchen_snacks") {
      const maxS = questSystem.getMaxSnacks();
      const gained = questSystem.addSnacks(maxS);
      return {
        action: "kitchen_snacks",
        healHearts: 5,
        gainedSnacks: gained,
        toast:
          gained > 0
            ? `🥨 Grabbed fresh snacks from the kitchen (${questSystem.state.snacks}/${maxS} snacks) & restored all hearts!`
            : `❤️ Snack pocket is full (${questSystem.state.snacks}/${maxS}) & all hearts are topped up!`,
      };
    }

    if (propId === "outfit_closet") {
      const unlocked = questSystem.getUnlockedOutfits();
      if (unlocked.length <= 1) {
        return {
          action: "dialogue",
          speaker: "Home Base Outfit Closet",
          lines: [
            "Your cozy wooden closet holds your Polo, Kippah & Tzitzit — with empty hangers waiting for Baseball, Wetsuit & Link outfits!",
            "Complete neighborhood quests (or switch to Easy / GPS Mode!) to fill up your wardrobe!",
          ],
        };
      }
      return { action: "toggle_outfit" };
    }

    if (propId === "bookshelf") {
      if (!state.bookshelfOpened) {
        state.bookshelfOpened = true;
        questSystem.state.openedHomeSecrets.add("bookshelf_secret");
        questSystem.save();
        return {
          action: "secret_reveal",
          speaker: "Suspicious Bookshelf",
          lines: [
            "*CLICK... RUMBLE!* You tugged a glowing red adventure book — the whole bookshelf slid aside!",
            "A secret wooden staircase leads up to a cozy hidden attic reading nook! Press Space again to head upstairs!",
          ],
        };
      }
      const next = transitionRoom("upstairs_nook", 4.5, 7.4, "up");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🪜 Climbed the secret stairs into the Cozy Upstairs Reading Nook!",
      };
    }

    if (propId === "pool_table_dnd") {
      const next = transitionRoom("dnd_basement", 8.5, 8.4, "up");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🐉 Whoosh! Warped into the 8-Bit D&D Basement Dungeon!",
      };
    }

    if (propId === "nook_stairs_down") {
      const next = transitionRoom("main_floor", 5.2, 3.6, "down");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🏠 Back downstairs in the 565 Boylston St Living Room!",
      };
    }

    if (propId === "golden_d20_chest") {
      if (!state.d20ChestOpened) {
        state.d20ChestOpened = true;
        questSystem.state.openedHomeSecrets.add("golden_d20_chest");
        questSystem.state.inventory.add("golden_d20");
        questSystem.state.coins += 20;
        questSystem.state.safetyXP += 25;
        questSystem.save();
        return {
          action: "fanfare",
          itemId: "golden_d20",
          sourceLabel: "Secret Upstairs Reading Nook",
          speaker: "Glowing Attic Chest",
          lines: [
            "You opened the glowing chest in the secret reading nook and discovered the legendary GOLDEN D20!! (+20 Coins, +25 XP!)",
            "Check the chest again anytime to roll the Golden D20 for lucky bonus coins!",
          ],
        };
      }
      const roll = Math.max(1, Math.min(20, Math.floor(rng() * 20) + 1));
      state.lastD20Roll = roll;
      const bonus = roll === 20 ? 20 : roll >= 15 ? 8 : roll >= 10 ? 4 : 2;
      questSystem.state.coins += bonus;
      questSystem.save();
      return {
        action: "d20_roll",
        roll,
        bonus,
        toast:
          roll === 20
            ? `🎲 NATURAL 20!! CRITICAL JACKPOT! +${bonus} Neighborhood Coins!!`
            : `🎲 Golden D20 rolled a ${roll}! Earned +${bonus} lucky Neighborhood Coins!`,
      };
    }

    if (propId === "dnd_portal_exit") {
      const next = transitionRoom("main_floor", 13.4, 7.6, "left");
      return {
        action: "room_change",
        room: next.room,
        x: next.x,
        y: next.y,
        facing: next.facing,
        toast: "🏠 Returned upstairs to 565 Boylston St!",
      };
    }

    if (propId === "statue_bard") {
      return {
        action: "dialogue",
        speaker: "🎵 Halfling Bard Statue",
        lines: [
          '"Hail, young adventurer! Every epic quest begins with a song!"',
          '"Step FIRST on the EMERALD switch beneath my lute, then ask the Gnome Wizard for verse two!"',
        ],
      };
    }
    if (propId === "statue_wizard") {
      return {
        action: "dialogue",
        speaker: "🧙 Gnome Wizard Statue",
        lines: [
          '"Greetings, Explorer of Newton! Arcane geometry unlocks the vault!"',
          '"Press the SAPPHIRE switch SECOND — right after the Bard\'s Emerald rune — then consult the Eldritch Knight!"',
        ],
      };
    }
    if (propId === "statue_knight") {
      return {
        action: "dialogue",
        speaker: "🛡️ Eldritch Knight Statue",
        lines: [
          '"Stand brave, Hero! Only the true sequence opens the Bag of Holding!"',
          '"Strike the RUBY switch THIRD & LAST (Emerald → Sapphire → Ruby) to break the chest\'s seal!"',
        ],
      };
    }

    if (propId === "switch_0" || propId === "switch_1" || propId === "switch_2") {
      if (state.dndSolved) {
        return {
          action: "toast",
          toast: "✨ All 3 ancient dungeon runes are already glowing! Open the chest up north!",
        };
      }
      const idx = Number(propId.split("_")[1]);
      const expectedIdx = !state.switchLit[0] ? 0 : !state.switchLit[1] ? 1 : 2;
      if (idx === expectedIdx) {
        state.switchLit[idx] = true;
        if (idx === 2) {
          state.dndSolved = true;
          questSystem.state.openedHomeSecrets.add("dnd_basement_solved");
          questSystem.save();
          return {
            action: "puzzle_solved",
            toast: "✨ ALL 3 RUNES LIT! The D&D Basement chest unlocked with a heroic chime!",
          };
        }
        return {
          action: "switch_ok",
          toast:
            idx === 0
              ? "🟢 Emerald Rune lit! (1/3) — Next: Sapphire switch!"
              : "🔵 Sapphire Rune lit! (2/3) — Final: Ruby switch!",
        };
      }
      // Wrong order -> gently reset switches with clue!
      state.switchLit = [false, false, false];
      return {
        action: "switch_reset",
        toast: "🔮 Switches reset! Ask the 3 statues for the order: Emerald (1) → Sapphire (2) → Ruby (3)!",
      };
    }

    if (propId === "bag_of_holding_chest") {
      if (!state.dndSolved) {
        return {
          action: "dialogue",
          speaker: "Sealed Dungeon Chest",
          lines: [
            "A magical blue rune lock seals the chest!",
            "Talk to the Halfling Bard, Gnome Wizard, and Eldritch Knight statues to solve the 3-switch floor puzzle!",
          ],
        };
      }
      if (state.bagChestOpened) {
        return {
          action: "dialogue",
          speaker: "Dungeon Treasure Chest",
          lines: [
            "You already claimed the magical Bag of Holding! You can now carry up to 12 snacks to share with neighbors!",
          ],
        };
      }
      state.bagChestOpened = true;
      questSystem.state.inventory.add("bag_of_holding");
      questSystem.state.safetyXP += 35;
      questSystem.addSnacks(12);
      questSystem.save();
      return {
        action: "fanfare",
        itemId: "bag_of_holding",
        sourceLabel: "8-Bit D&D Basement Dungeon",
        speaker: "Unlocked Dungeon Chest",
        lines: [
          "You found the legendary BAG OF HOLDING!! (+35 XP!)",
          "Your pocket now holds up to 12 Neighborhood Snacks (already filled to the brim!) to share with sidewalk marchers!",
        ],
      };
    }

    return null;
  }

  /**
   * Render the active Home Base interior room using k.drawRect & k.drawSprite (100% WebGL + Canvas 2D compatible!).
   */
  function drawInteriorRoom(k, elapsedTime = 0) {
    const room = getRoom();
    const T = TILE_SIZE;
    const rw = room.width * T;
    const rh = room.height * T;
    const flicker = Math.floor(elapsedTime * 7) % 2;

    if (room.id === "main_floor") {
      // Dark timber exterior frame
      k.drawRect({ pos: k.vec2(0, 0), width: rw, height: rh, color: k.rgb(36, 22, 16) });
      // Cream plaster top wall + baseboard trim
      k.drawRect({ pos: k.vec2(T, T * 0.5), width: rw - 2 * T, height: T * 1.5, color: k.rgb(236, 222, 194) });
      k.drawRect({ pos: k.vec2(T, T * 1.85), width: rw - 2 * T, height: 3, color: k.rgb(122, 74, 42) });

      // Warm honey-oak floor planks
      for (let ty = 2; ty < room.height - 1; ty++) {
        for (let tx = 2; tx < room.width - 2; tx++) {
          const alt = (tx + ty) % 2 === 0;
          k.drawRect({
            pos: k.vec2(tx * T, ty * T),
            width: T,
            height: T,
            color: alt ? k.rgb(196, 140, 82) : k.rgb(184, 128, 72),
          });
          k.drawRect({
            pos: k.vec2(tx * T, ty * T + T - 1),
            width: T,
            height: 1,
            color: k.rgb(138, 88, 46),
            opacity: 0.45,
          });
        }
      }

      // Cozy braided living-room rug in center
      k.drawRect({ pos: k.vec2(6 * T, 4 * T + 4), width: 7 * T, height: 5 * T, color: k.rgb(156, 52, 48) });
      k.drawRect({ pos: k.vec2(6 * T + 4, 4 * T + 8), width: 7 * T - 8, height: 5 * T - 8, color: k.rgb(228, 178, 86) });
      k.drawRect({ pos: k.vec2(6 * T + 8, 4 * T + 12), width: 7 * T - 16, height: 5 * T - 16, color: k.rgb(52, 108, 92) });

      // Kitchen checkered tile floor (top-right corner)
      for (let ty = 2; ty <= 4; ty++) {
        for (let tx = 13; tx <= 17; tx++) {
          k.drawRect({
            pos: k.vec2(tx * T, ty * T),
            width: T,
            height: T,
            color: (tx + ty) % 2 === 0 ? k.rgb(240, 234, 222) : k.rgb(196, 212, 204),
          });
        }
      }

      // Sunlit front windows on top wall
      for (const wx of [6.3, 12.2]) {
        k.drawRect({ pos: k.vec2(wx * T, 10), width: 20, height: 16, color: k.rgb(66, 40, 24) });
        k.drawRect({ pos: k.vec2(wx * T + 2, 12), width: 16, height: 12, color: k.rgb(255, 226, 128) });
        k.drawRect({ pos: k.vec2(wx * T + 9, 12), width: 2, height: 12, color: k.rgb(245, 236, 216) });
        k.drawRect({ pos: k.vec2(wx * T + 2, 17), width: 16, height: 2, color: k.rgb(245, 236, 216) });
      }

      // 1. Suspicious Bookshelf (slides left to reveal secret stairs when opened!)
      const bsShift = state.bookshelfOpened ? -16 : 0;
      if (state.bookshelfOpened) {
        // Secret wooden staircase up to attic reading nook!
        k.drawRect({ pos: k.vec2(5 * T - 2, 2 * T - 6), width: 20, height: 24, color: k.rgb(42, 24, 16) });
        for (let s = 0; s < 5; s++) {
          k.drawRect({
            pos: k.vec2(5 * T, 2 * T - 4 + s * 4),
            width: 16,
            height: 3,
            color: s % 2 === 0 ? k.rgb(212, 158, 92) : k.rgb(176, 122, 64),
          });
        }
      }
      const bsX = 3 * T + bsShift;
      k.drawRect({ pos: k.vec2(bsX, 1 * T + 6), width: 3 * T, height: 28, color: k.rgb(74, 42, 24) });
      k.drawRect({ pos: k.vec2(bsX + 2, 1 * T + 8), width: 3 * T - 4, height: 24, color: k.rgb(112, 66, 36) });
      const bookCols = [
        [204, 52, 48],
        [52, 120, 196],
        [62, 156, 78],
        [236, 184, 58],
        [152, 82, 184],
      ];
      for (let row = 0; row < 2; row++) {
        for (let b = 0; b < 9; b++) {
          const c = bookCols[(b + row * 2) % bookCols.length];
          k.drawRect({
            pos: k.vec2(bsX + 4 + b * 4, 1 * T + 10 + row * 10),
            width: 3,
            height: 8,
            color: k.rgb(...c),
          });
        }
      }
      // Subtle golden sparkle on the suspicious secret book before opened!
      if (!state.bookshelfOpened && flicker === 0) {
        k.drawRect({ pos: k.vec2(bsX + 24, 1 * T + 12), width: 3, height: 3, color: k.rgb(255, 244, 148) });
      }

      // 2. Cozy Stone Fireplace with crackling animated fire!
      k.drawRect({ pos: k.vec2(8 * T, 1 * T + 4), width: 4 * T, height: 28, color: k.rgb(112, 104, 102) });
      k.drawRect({ pos: k.vec2(8 * T + 2, 1 * T + 6), width: 4 * T - 4, height: 6, color: k.rgb(138, 86, 46) });
      k.drawRect({ pos: k.vec2(9 * T, 1 * T + 16), width: 2 * T, height: 16, color: k.rgb(32, 20, 18) });
      k.drawRect({
        pos: k.vec2(9 * T + 6, 1 * T + 20 - flicker),
        width: 20,
        height: 10 + flicker,
        color: k.rgb(245, 118, 36),
      });
      k.drawRect({
        pos: k.vec2(9 * T + 10, 1 * T + 23),
        width: 12,
        height: 6,
        color: k.rgb(255, 224, 92),
      });

      // 3. Kitchen Snack Counter + Warm Cookie/Pretzel Jar!
      k.drawRect({ pos: k.vec2(14 * T, 2 * T - 4), width: 4 * T, height: 22, color: k.rgb(92, 62, 42) });
      k.drawRect({ pos: k.vec2(14 * T + 2, 2 * T - 2), width: 4 * T - 4, height: 10, color: k.rgb(244, 238, 226) });
      // Glass Snack Jar & plate of fresh bagels/cookies
      k.drawRect({ pos: k.vec2(15 * T + 4, 2 * T - 8), width: 10, height: 12, color: k.rgb(174, 226, 242) });
      k.drawRect({ pos: k.vec2(15 * T + 6, 2 * T - 4), width: 6, height: 6, color: k.rgb(214, 134, 52) });
      k.drawRect({ pos: k.vec2(16 * T + 6, 2 * T - 1), width: 12, height: 7, color: k.rgb(255, 255, 255) });
      k.drawRect({ pos: k.vec2(16 * T + 8, 2 * T), width: 8, height: 4, color: k.rgb(216, 142, 58) });

      // 4. Home Base Outfit Closet (left wall!)
      k.drawRect({ pos: k.vec2(2 * T - 2, 5 * T - 4), width: 20, height: 36, color: k.rgb(74, 44, 24) });
      k.drawRect({ pos: k.vec2(2 * T, 5 * T - 2), width: 16, height: 32, color: k.rgb(138, 86, 48) });
      k.drawRect({ pos: k.vec2(2 * T + 7, 5 * T), width: 2, height: 28, color: k.rgb(74, 44, 24) });
      k.drawRect({ pos: k.vec2(2 * T + 4, 5 * T + 12), width: 2, height: 4, color: k.rgb(244, 211, 94) });
      k.drawRect({ pos: k.vec2(2 * T + 10, 5 * T + 12), width: 2, height: 4, color: k.rgb(244, 211, 94) });

      // 5. Cozy Living Room Couch
      k.drawRect({ pos: k.vec2(8 * T, 5 * T), width: 4 * T, height: 18, color: k.rgb(46, 78, 128) });
      k.drawRect({ pos: k.vec2(8 * T + 4, 5 * T + 4), width: 4 * T - 8, height: 10, color: k.rgb(68, 112, 172) });

      // 6. Basement Pool Table & D&D Rulebooks (with glowing arcane portal hint!)
      k.drawRect({ pos: k.vec2(14 * T, 7 * T), width: 3 * T, height: 2 * T, color: k.rgb(86, 48, 26) });
      k.drawRect({ pos: k.vec2(14 * T + 4, 7 * T + 4), width: 3 * T - 8, height: 2 * T - 8, color: k.rgb(34, 128, 72) });
      // Pool balls + shimmering D&D D20 book glow
      k.drawRect({ pos: k.vec2(15 * T + 2, 7 * T + 10), width: 4, height: 4, color: k.rgb(255, 255, 255) });
      k.drawRect({ pos: k.vec2(15 * T + 12, 7 * T + 14), width: 4, height: 4, color: k.rgb(235, 62, 54) });
      k.drawRect({
        pos: k.vec2(14 * T + 8, 7 * T + 16),
        width: 10,
        height: 8,
        color: flicker === 0 ? k.rgb(122, 198, 255) : k.rgb(176, 138, 255),
      });

      // 7. Front Door Welcome Mat (bottom center!)
      k.drawRect({ pos: k.vec2(9 * T, 10 * T + 4), width: 2 * T, height: 12, color: k.rgb(186, 112, 48) });
      k.drawRect({ pos: k.vec2(9 * T + 3, 10 * T + 6), width: 2 * T - 6, height: 8, color: k.rgb(232, 184, 96) });
      return;
    }

    if (room.id === "upstairs_nook") {
      // Cozy attic timber beams & golden reading nook!
      k.drawRect({ pos: k.vec2(0, 0), width: rw, height: rh, color: k.rgb(38, 24, 30) });
      k.drawRect({ pos: k.vec2(T, T * 0.5), width: rw - 2 * T, height: T * 1.5, color: k.rgb(154, 102, 62) });
      // Skylight window showing warm sunset stars!
      k.drawRect({ pos: k.vec2(6 * T, 6), width: 4 * T, height: 20, color: k.rgb(42, 68, 124) });
      k.drawRect({ pos: k.vec2(6 * T + 8, 10), width: 3, height: 3, color: k.rgb(255, 240, 140) });
      k.drawRect({ pos: k.vec2(8 * T + 12, 16), width: 2, height: 2, color: k.rgb(255, 240, 140) });
      // Twinkling string fairy lights across attic rafters!
      for (let lx = 2 * T + 4; lx < rw - 2 * T - 4; lx += 14) {
        const warm = ((lx / 14 + flicker) | 0) % 2 === 0;
        k.drawRect({
          pos: k.vec2(lx, T * 1.8),
          width: 4,
          height: 4,
          color: warm ? k.rgb(255, 226, 108) : k.rgb(255, 164, 198),
        });
      }
      // Honey pine attic floor
      for (let ty = 2; ty < room.height - 1; ty++) {
        for (let tx = 2; tx < room.width - 2; tx++) {
          k.drawRect({
            pos: k.vec2(tx * T, ty * T),
            width: T,
            height: T,
            color: (tx + ty) % 2 === 0 ? k.rgb(186, 132, 82) : k.rgb(174, 120, 72),
          });
        }
      }
      // Plush lavender reading rug
      k.drawRect({ pos: k.vec2(5 * T, 3 * T), width: 6 * T, height: 4 * T, color: k.rgb(112, 74, 148) });
      k.drawRect({ pos: k.vec2(5 * T + 5, 3 * T + 5), width: 6 * T - 10, height: 4 * T - 10, color: k.rgb(156, 114, 196) });
      // Cozy beanbag pillow
      k.drawRect({ pos: k.vec2(12 * T, 6 * T), width: 24, height: 18, color: k.rgb(224, 96, 82) });
      // Book stacks on top-left & top-right
      for (const sx of [2 * T, 11 * T]) {
        k.drawRect({ pos: k.vec2(sx, 2 * T - 6), width: 3 * T, height: 22, color: k.rgb(92, 54, 32) });
        k.drawRect({ pos: k.vec2(sx + 4, 2 * T - 2), width: 10, height: 14, color: k.rgb(218, 72, 62) });
        k.drawRect({ pos: k.vec2(sx + 18, 2 * T - 2), width: 10, height: 14, color: k.rgb(66, 142, 212) });
        k.drawRect({ pos: k.vec2(sx + 32, 2 * T - 2), width: 10, height: 14, color: k.rgb(74, 172, 92) });
      }
      // Glowing Golden D20 Chest in center!
      k.drawRect({
        pos: k.vec2(7 * T - 3, 3 * T - 3),
        width: 2 * T + 6,
        height: T + 6,
        color: k.rgb(255, 224, 92),
        opacity: flicker === 0 ? 0.42 : 0.25,
      });
      k.drawRect({ pos: k.vec2(7 * T, 3 * T), width: 2 * T, height: T, color: k.rgb(122, 66, 24) });
      k.drawRect({
        pos: k.vec2(7 * T + 2, 3 * T + 2),
        width: 2 * T - 4,
        height: T - 4,
        color: state.d20ChestOpened ? k.rgb(244, 211, 94) : k.rgb(186, 118, 42),
      });
      k.drawRect({ pos: k.vec2(7 * T + 13, 3 * T + 6), width: 6, height: 5, color: k.rgb(255, 242, 132) });
      // Wooden stairs back down (bottom-left)
      k.drawRect({ pos: k.vec2(3 * T, 8 * T), width: 20, height: 18, color: k.rgb(52, 30, 18) });
      for (let s = 0; s < 4; s++) {
        k.drawRect({
          pos: k.vec2(3 * T + 2, 8 * T + 2 + s * 4),
          width: 16,
          height: 3,
          color: k.rgb(206, 152, 88),
        });
      }
      return;
    }

    if (room.id === "dnd_basement") {
      // Classic 8-bit Stone-Brick Dungeon!
      k.drawRect({ pos: k.vec2(0, 0), width: rw, height: rh, color: k.rgb(24, 26, 38) });
      k.drawRect({ pos: k.vec2(T, T * 0.5), width: rw - 2 * T, height: T * 1.5, color: k.rgb(58, 64, 84) });
      // Stone floor flagstones
      for (let ty = 2; ty < room.height - 1; ty++) {
        for (let tx = 2; tx < room.width - 2; tx++) {
          k.drawRect({
            pos: k.vec2(tx * T, ty * T),
            width: T,
            height: T,
            color: (tx + ty) % 2 === 0 ? k.rgb(44, 48, 64) : k.rgb(38, 42, 58),
          });
          k.drawRect({
            pos: k.vec2(tx * T, ty * T),
            width: T,
            height: 1,
            color: k.rgb(72, 78, 102),
            opacity: 0.35,
          });
        }
      }
      // Flickering dungeon wall torches
      for (const tx of [3, 7, 11, 14]) {
        k.drawRect({ pos: k.vec2(tx * T + 6, 14), width: 4, height: 10, color: k.rgb(92, 62, 34) });
        k.drawRect({
          pos: k.vec2(tx * T + 5, 9 - flicker),
          width: 6,
          height: 6 + flicker,
          color: flicker === 0 ? k.rgb(255, 166, 48) : k.rgb(255, 224, 96),
        });
      }
      // 3 Hero Statues: Halfling Bard (emerald), Gnome Wizard (sapphire), Eldritch Knight (ruby)
      const statues = [
        { tx: 4, col: [84, 214, 134], robe: [48, 148, 86] },
        { tx: 9, col: [92, 178, 255], robe: [48, 96, 186] },
        { tx: 13, col: [248, 102, 92], robe: [176, 48, 52] },
      ];
      for (const st of statues) {
        const sx = st.tx * T;
        const sy = 3 * T;
        k.drawRect({ pos: k.vec2(sx, sy + 6), width: 16, height: 10, color: k.rgb(122, 130, 146) });
        k.drawRect({ pos: k.vec2(sx + 3, sy - 6), width: 10, height: 14, color: k.rgb(...st.robe) });
        k.drawRect({ pos: k.vec2(sx + 4, sy - 11), width: 8, height: 6, color: k.rgb(186, 194, 210) });
        k.drawRect({ pos: k.vec2(sx + 6, sy - 3), width: 4, height: 4, color: k.rgb(...st.col) });
      }
      // 3 Glowing Floor Rune Switches (Emerald, Sapphire, Ruby)
      const switches = [
        { tx: 4, lit: state.switchLit[0], col: [76, 232, 134] },
        { tx: 9, lit: state.switchLit[1], col: [88, 182, 255] },
        { tx: 13, lit: state.switchLit[2], col: [248, 88, 88] },
      ];
      for (const sw of switches) {
        const sx = sw.tx * T;
        const sy = 6 * T;
        k.drawRect({ pos: k.vec2(sx + 1, sy + 1), width: 14, height: 14, color: k.rgb(24, 28, 38) });
        k.drawRect({
          pos: k.vec2(sx + 3, sy + 3),
          width: 10,
          height: 10,
          color: k.rgb(...sw.col),
          opacity: sw.lit ? 1 : 0.32,
        });
        if (sw.lit) {
          k.drawRect({ pos: k.vec2(sx + 6, sy + 6), width: 4, height: 4, color: k.rgb(255, 255, 255) });
        }
      }
      // Bag of Holding Dungeon Chest (center-north)
      const cx = 8 * T;
      const cy = 2 * T;
      if (state.dndSolved) {
        k.drawRect({
          pos: k.vec2(cx - 3, cy - 3),
          width: 2 * T + 6,
          height: T + 6,
          color: k.rgb(122, 236, 198),
          opacity: flicker === 0 ? 0.45 : 0.24,
        });
      }
      k.drawRect({ pos: k.vec2(cx, cy), width: 2 * T, height: T, color: k.rgb(54, 34, 68) });
      k.drawRect({
        pos: k.vec2(cx + 2, cy + 2),
        width: 2 * T - 4,
        height: T - 4,
        color: state.bagChestOpened
          ? k.rgb(232, 200, 96)
          : state.dndSolved
            ? k.rgb(138, 82, 212)
            : k.rgb(84, 92, 114),
      });
      k.drawRect({
        pos: k.vec2(cx + 13, cy + 6),
        width: 6,
        height: 5,
        color: state.dndSolved ? k.rgb(255, 232, 108) : k.rgb(92, 168, 255),
      });
      // Glowing Cyan Warp Portal back to Living Room (bottom center)
      k.drawRect({
        pos: k.vec2(8 * T, 9 * T),
        width: 2 * T,
        height: 14,
        color: flicker === 0 ? k.rgb(72, 224, 245) : k.rgb(128, 178, 255),
        opacity: 0.8,
      });
      k.drawRect({ pos: k.vec2(8 * T + 6, 9 * T + 3), width: 20, height: 8, color: k.rgb(236, 252, 255) });
    }
  }

  return {
    state,
    getRoom,
    enterHouse,
    exitHouse,
    transitionRoom,
    isInteriorBoxBlocked,
    getRoomInteractables,
    findNearbyInteriorProp,
    interactWithInteriorProp,
    drawInteriorRoom,
    syncSecretsFromSave,
  };
}
