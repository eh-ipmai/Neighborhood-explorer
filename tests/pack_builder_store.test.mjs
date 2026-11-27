import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNeighborhoodPackage,
  validateNeighborhoodPack,
  addCustomPlaceToPack,
  removePlaceFromPack,
  addCustomQuestToPack,
} from "../src/generator/pack_builder.js";
import {
  BUILTIN_NEWTON_ID,
  saveNeighborhoodPack,
  loadNeighborhoodPack,
  listNeighborhoodPacks,
  deleteNeighborhoodPack,
  getActiveNeighborhoodId,
  setActiveNeighborhoodId,
} from "../src/generator/pack_store.js";

test("pack_builder validates packs and supports adding/removing custom places & quests immutably", async () => {
  const lat = 47.6062;
  const lon = -122.3321;
  const elements = [
    {
      type: "way",
      id: 1,
      tags: { highway: "residential", name: "Pine Street" },
      geometry: [
        { lat: lat - 0.0004, lon: lon - 0.003 },
        { lat: lat - 0.0004, lon: lon + 0.003 },
      ],
    },
    {
      type: "way",
      id: 2,
      tags: { building: "house", "addr:housenumber": "410", "addr:street": "Pine St" },
      geometry: [
        { lat: lat + 0.00005, lon: lon - 0.0001 },
        { lat: lat + 0.00005, lon: lon + 0.00015 },
        { lat: lat + 0.00025, lon: lon + 0.00015 },
        { lat: lat + 0.00025, lon: lon - 0.0001 },
        { lat: lat + 0.00005, lon: lon - 0.0001 },
      ],
    },
  ];

  const pack = await buildNeighborhoodPackage({
    address: "410 Pine St, Seattle, WA",
    lat,
    lon,
    heroName: "Zoe",
    townOverride: "Seattle, WA",
    width: 128,
    height: 128,
    osmElements: elements,
  });

  assert.equal(validateNeighborhoodPack(pack).valid, true);
  assert.equal(validateNeighborhoodPack({ foo: "bar" }).valid, false);

  // Add a custom place via map tile coords
  const addedPlace = addCustomPlaceToPack(pack, {
    name: "Uncle Dan's Coffee",
    address: "512 Pine St",
    tileX: 74,
    tileY: 60,
    npcName: "Uncle Dan",
    dialogue: ["Hot cocoa on the house, Zoe!"],
  });
  assert.equal(addedPlace.pack.landmarks.length, pack.landmarks.length + 1);
  assert.equal(addedPlace.landmark.isCustom, true);

  // Add a custom quest targeting that place
  const addedQuest = addCustomQuestToPack(addedPlace.pack, {
    title: "Hot Cocoa Run",
    targetLandmarkIds: [addedPlace.landmark.id],
  });
  assert.equal(addedQuest.pack.quests[0].title, "Hot Cocoa Run");
  assert.equal(addedQuest.pack.quests[0].steps[0].targetLandmarkId, addedPlace.landmark.id);

  // Removing the custom place also cleans up dangling quest steps cleanly, while never deleting home_base
  const afterRemove = removePlaceFromPack(addedQuest.pack, addedPlace.landmark.id);
  assert.equal(afterRemove.landmarks.some((l) => l.id === addedPlace.landmark.id), false);
  assert.equal(afterRemove.quests.some((q) => q.title === "Hot Cocoa Run"), false);
  const keepHome = removePlaceFromPack(afterRemove, "home_base");
  assert.equal(keepHome.landmarks.some((l) => l.id === "home_base"), true);

  // Pack store save / list / load / active switch / delete works cleanly in headless Node fallback
  const summary = await saveNeighborhoodPack(addedQuest.pack);
  assert.equal(summary.townName, "Seattle, WA");
  const list = await listNeighborhoodPacks();
  assert.ok(list.some((p) => p.id === summary.id));

  const loaded = await loadNeighborhoodPack(summary.id);
  assert.equal(loaded.meta.heroName, "Zoe");

  setActiveNeighborhoodId(summary.id);
  assert.equal(getActiveNeighborhoodId(), summary.id);

  await deleteNeighborhoodPack(summary.id);
  assert.equal(getActiveNeighborhoodId(), BUILTIN_NEWTON_ID);
  assert.equal(await loadNeighborhoodPack(summary.id), null);
});
