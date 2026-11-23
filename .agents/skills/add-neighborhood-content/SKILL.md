---
name: add-neighborhood-content
description: >-
  Use this skill when the user or kids want to add or update neighborhood places,
  shops, friends' houses, real house colors, NPC dialogue, secret items, or quests
  in data/landmarks.json, data/quests.json, or data/house_colors.json.
---

# Add Neighborhood Content

Translate natural-language neighborhood ideas, kid-written story cards, or real-world
addresses into clean, schema-valid JSON entries aligned to the current `data/world_map.json`.

## Steps

1. **Inspect current map projection metadata**:
   Read `origin`, `mapCenter`, `dimensions`, and `scaleMetersPerTile` from `data/world_map.json`
   so every new landmark lands inside `[0..width-1, 0..height-1]`.

2. **Project real-world addresses to tile coordinates**:
   - If the user gives a real Newton/Brookline address or shop name (e.g., *J.P. Licks*, *Rosenfeld's Bagels*, a friend's house), geocode it via OpenStreetMap Nominatim (with a polite `User-Agent`) or locate the matching entry in `world_map.json`'s `buildings[]`.
   - Convert `(lat, lon)` using `projectLatLonToTile(lat, lon, mapCenter.lat, mapCenter.lon, width, height, scaleMetersPerTile)` from `scripts/build_map.mjs`.
   - Store `address`, `lat`, `lon`, `tileX`, and `tileY` on the landmark so future map rebuilds preserve its exact position.

3. **Keep content kid-readable & backwards-compatible**:
   - **`data/landmarks.json`**: Required keys: `id`, `name`, `tileX`, `tileY`, `sprite`, `discoveryXP`, `npcName`, `dialogue` (array of short kid-friendly lines), `rewardItem`.
   - **`data/quests.json`**: Required keys: `id`, `tier`, `title`, `description`, `steps` (`stepIndex`, `instruction`, `targetLandmarkId` or `targetTile`, `completionTrigger`), `rewards` (`xp`, `coins`, `item`).
   - **`data/house_colors.json`**: Map real street addresses (normalized automatically across `St`/`Street`, `Rd`/`Road`, `Ln`/`Lane`) to `preset` (`yellow`, `white`, `gray`, `charcoal`, `navy`, `slate_blue`, `sage`, `cream_stucco`, `brick`, `cedar_brown`, `tan`, `red_clapboard`) and `roof` (`slate`, `charcoal`, `cedar`, `terracotta`, `moss`), or custom `#rrggbb` hex values.

4. **Verify**:
   - Validate all edited JSON files parse cleanly.
   - Verify every landmark's `(tileX, tileY)` is within `world_map.json` bounds and every quest's `targetLandmarkId` matches an existing landmark `id`.
   - Run `npm test` to confirm schema integrity.
