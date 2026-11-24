import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  createQuestSystem,
  snapToWalkableTile,
  formatCompassHint,
  getTraversalGear,
  getItemMeta,
  FOG_GRID_SIZE,
} from "../src/quests.js";
import { buildOfflineMap } from "../scripts/build_map.mjs";

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

test("snapToWalkableTile moves blocked landmark onto nearest walkable sidewalk/grass tile", () => {
  const worldMap = buildOfflineMap();
  const home = worldMap.buildings.find((b) => b.isHomeBase);
  // Center of Home Base building is solid (collision === 1)
  const solidX = home.bounds.minX + 1;
  const solidY = home.bounds.minY + 1;
  assert.equal(worldMap.layers.collision[solidY * worldMap.dimensions.width + solidX], 1);

  const snapped = snapToWalkableTile(worldMap, solidX, solidY);
  assert.equal(
    worldMap.layers.collision[snapped.y * worldMap.dimensions.width + snapped.x],
    0,
    "snapped tile must be walkable"
  );
});

test("formatCompassHint computes accurate cardinal/diagonal bearing and meters", () => {
  assert.equal(formatCompassHint(100, 100, 100, 50, 6), "300m N");
  assert.equal(formatCompassHint(100, 100, 150, 100, 6), "300m E");
  assert.equal(formatCompassHint(100, 100, 101, 101, 6), "Right here!");
});

test("getTraversalGear scales FASTER speed tiers with Safety XP & unlocked items", () => {
  assert.equal(getTraversalGear(0, new Set()).id, "sneakers");
  assert.equal(getTraversalGear(100, new Set()).id, "running_shoes");
  assert.equal(getTraversalGear(0, new Set(["scooter"])).id, "scooter");
  assert.equal(getTraversalGear(750, new Set()).id, "mountain_bike");
});

test("multi-step quest system discovers landmarks, awards items, advances steps, and persists fog-of-war", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const landmarks = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "landmarks.json"), "utf8")
  );
  const quests = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "quests.json"), "utf8")
  );
  const storage = makeMemoryStorage();

  const qs = createQuestSystem({ landmarks, quests, worldMap, storage });

  // Every NPC & hidden chest must snap to a walkable tile on the live 512x512 map
  for (const npc of qs.npcs) {
    const idx = npc.walkTileY * worldMap.dimensions.width + npc.walkTileX;
    assert.equal(
      worldMap.layers.collision[idx],
      0,
      `Landmark NPC ${npc.id} must stand on a walkable tile`
    );
  }
  for (const obj of qs.interactables) {
    const idx = obj.tileY * worldMap.dimensions.width + obj.tileX;
    assert.equal(
      worldMap.layers.collision[idx],
      0,
      `Interactable ${obj.id} must stand on a walkable tile`
    );
  }

  // Fog-of-war starts at 0% and increases when walking
  assert.equal(qs.state.fogCells.length, FOG_GRID_SIZE * FOG_GRID_SIZE);
  const newly = qs.revealFogAtTile(worldMap.origin.spawnTile.x, worldMap.origin.spawnTile.y, 2);
  assert.ok(newly > 0);
  assert.ok(qs.getExploredPercent() > 0);

  // First Mission (Quest 0): Neighborhood Family Meetups -> Salzberg family (200 Cotton St) & Bella & Sydney (Morton Circle)
  assert.equal(qs.getActiveQuest().id, "quest_00_family_meetups");
  const salzRes = qs.interactWithNpc("salzberg_house");
  assert.ok(salzRes.lines.length > 0);
  assert.ok(qs.state.inventory.has("coop_badge"));
  assert.equal(salzRes.questEvent.type, "step_advanced");
  assert.equal(qs.state.activeStepIndex, 1);

  const mortonRes = qs.interactWithNpc("bella_sydney_house");
  assert.equal(mortonRes.questEvent.type, "quest_completed");
  assert.ok(qs.state.completedQuests.has("quest_00_family_meetups"));
  assert.ok(qs.state.inventory.has("friendship_bracelet"));
  assert.ok(qs.state.inventory.has("running_shoes"));

  // Next Quest (Quest 1): Talk to Scooper Maya at J.P. Licks
  assert.equal(qs.getActiveQuest().id, "quest_01_first_steps");
  const jpRes = qs.interactWithNpc("jp_licks");
  assert.ok(jpRes.lines.length > 0);
  assert.ok(qs.state.inventory.has("double_scoop_cone"));
  assert.equal(jpRes.questEvent.type, "step_advanced");
  assert.equal(qs.state.activeStepIndex, 1);

  // Quest 1 Step 2: Talk to Librarian Clara at Newton Free Library -> completes Quest 1!
  const libRes = qs.interactWithNpc("newton_free_library");
  assert.equal(libRes.questEvent.type, "quest_completed");
  assert.ok(qs.state.completedQuests.has("quest_01_first_steps"));
  assert.ok(qs.state.inventory.has("library_card"));
  assert.equal(qs.getActiveQuest().id, "quest_02_riddle_hunt");

  // Quest 2: Open hidden Little Free Library chest -> completes Quest 2 & advances to Quest 3 (Rosenfeld's!)
  const chest = qs.interactables[0];
  const chestRes = qs.interactWithChest(chest.id);
  assert.equal(chestRes.questEvent.type, "quest_completed");
  assert.ok(qs.state.inventory.has("rare_book_stamp"));
  assert.equal(qs.getActiveQuest().id, "quest_03_grand_errand");

  // Persistence check: reload from storage and verify progress + fog-of-war survived
  const reloaded = createQuestSystem({ landmarks, quests, worldMap, storage });
  assert.ok(reloaded.state.completedQuests.has("quest_01_first_steps"));
  assert.ok(reloaded.state.completedQuests.has("quest_02_riddle_hunt"));
  assert.ok(reloaded.state.inventory.has("double_scoop_cone"));
  assert.ok(reloaded.getExploredPercent() > 0);
  assert.equal(getItemMeta("double_scoop_cone").icon, "🍦");
});
