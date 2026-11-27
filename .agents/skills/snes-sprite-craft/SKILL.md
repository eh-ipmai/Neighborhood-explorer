---
name: snes-sprite-craft
description: >-
  Use this skill when creating, refining, or importing pixel art tiles, buildings,
  props, characters, seasonal palette swaps, or kid-drawn Pixilart/Piskel sprites
  for Neighborhood Explorer's 16-Bit SNES Overworld visual style.
---

# 16-Bit SNES Overworld Sprite Craft

Keep every visual addition faithful to the locked-in **Option 1 — 16-Bit SNES Overworld**
direction (*A Link to the Past* / *Chrono Trigger*), rendered cleanly at `320x180` internal
resolution on both Kaplay (WebGL) and HTML5 2D Canvas fallback (`src/renderer.js`), with
2x HD 32-bit pixel canvases (`__pixelScale = 0.5`) for hero/NPC characters, Local Flair
props, vehicles, items, trees, and interiors.

## Visual Rules

1. **Crisp Pixel Art Discipline**:
   - Always use integer coordinates (`Math.floor` / `Math.round`) and `imageSmoothingEnabled = false`.
   - Outline foreground sprites (houses, trees, hydrants, WALK signals, parked cars, hero, Friendly Locals) with deep charcoal (`#1d2228`, `#162b1c` for foliage, or material-matched selective outlining in 32-bit `PixelGrid` sprites) and shade with 3–5 value steps (highlight → midtone → shadow).
   - Never rely on blurry gradients or sub-pixel anti-aliasing.

2. **1-House-Per-Address & Regional Architecture Fidelity**:
   - Render each entry in `world_map.json`'s `buildings[]` individually via `bakeSnesBuildingCanvas` in `src/tileset.js`, inset `2–4px` from tile bounds so adjacent addresses visually separate into distinct homes/buildings.
   - Always route building colors through `resolveHouseStyle(building, colorOverrideMap, biomeConfig)` so real house colors from `data/house_colors.json`, live iPad `🎨 Paint` edits, OSM `building:colour` tags, and active regional biomes/seasons (e.g., Jerusalem Stone, Tel Aviv Bauhaus, Alpine timber, snowy winter roofs, vaulted Old City domes) apply automatically.
   - Distinguish residential (`house`, `duplex`, `apartments`, `garage`) and municipal/commercial/civic (`bakery_cafe`, `corner_market`, `office_plaza`, `commercial`, `library`, `school`, `civic`, `fire_station`, `police_station`, `post_office`, `city_hall`, `sanitation`, `hospital_clinic`, `transit_station`, `museum`, `industrial`, `greenhouse`) silhouettes.

3. **Auto-Tiled Streets, Vector Roads & Crosswalks**:
   - Render 3D stone/regional curbs strictly on sidewalk edges bordering roads (`2`, `3`, `4`, `12`) and subtle lawn trim strictly on grass edges (`0`, `7`) so wide multi-tile sidewalks stay cohesive alongside `src/vector_roads.js`.
   - Keep zebra crosswalk stripes parallel to traffic flow across entire crosswalk clusters and place glowing `WALK` signal posts at crosswalk corners.

4. **Dual-Renderer, 12 Biomes & 4 Seasons Compatibility**:
   - Register procedural sprite canvases through `renderer.registerSprites()` and dynamic baked canvases through `renderer.drawCanvas(versionedKey, canvas, x, y)` so both Kaplay WebGL and Canvas 2D stay pixel-identical.
   - Pull base ground, foliage, and atmosphere colors from `BIOME_PRESETS` / `applySeasonToBiomeConfig` in `src/biomes.js` and `PALETTES` in `src/tileset.js` so all **12 global biomes and 4 seasons** render seamlessly.
   - When creating 2x HD 32-bit canvases (`src/characters.js`, `src/items32bit.js`, `src/vehicles32bit.js`, `src/world32bit.js`, `src/house_interior.js`), tag canvases with `__pixelScale = 0.5`.
   - When importing kid-drawn 16x16 or 16x24 PNGs from Pixilart/Piskel, place them in `public/sprites/` and verify crisp integer scaling.

5. **Verify**:
   - Run `npm test && npm run build`.
   - Confirm no `WebGL`-only APIs leak outside `src/renderer.js`.
