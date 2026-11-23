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
resolution on both Kaplay (WebGL) and HTML5 2D Canvas fallback (`src/renderer.js`).

## Visual Rules

1. **Crisp Pixel Art Discipline**:
   - Always use integer coordinates (`Math.floor` / `Math.round`) and `imageSmoothingEnabled = false`.
   - Outline foreground sprites (houses, trees, hydrants, WALK signals, parked cars, hero) with deep charcoal (`#1d2228` or `#162b1c` for foliage) and shade with 3–4 value steps (highlight → midtone → shadow).
   - Never rely on blurry gradients or sub-pixel anti-aliasing.

2. **1-House-Per-Address Fidelity**:
   - Render each entry in `world_map.json`'s `buildings[]` individually via `bakeSnesBuildingCanvas` in `src/tileset.js`, inset `2–4px` from tile bounds so adjacent addresses visually separate into distinct New England homes.
   - Always route building colors through `resolveHouseStyle(building, colorOverrideMap)` so real house colors from `data/house_colors.json`, live iPad `🎨 Paint` edits, and OSM `building:colour` tags apply automatically.
   - Distinguish `house`, `garage`, `commercial`, and `library`/`school`/`civic` silhouettes.

3. **Auto-Tiled Streets & Crosswalks**:
   - Render 3D stone curbs strictly on sidewalk edges bordering roads (`2`, `3`, `4`) and subtle lawn trim strictly on grass edges (`0`, `7`) so wide multi-tile sidewalks stay cohesive.
   - Keep zebra crosswalk stripes parallel to traffic flow across entire crosswalk clusters and place glowing `WALK` signal posts at crosswalk corners.

4. **Dual-Renderer & Seasonal Swap Readiness**:
   - Register procedural sprite canvases through `renderer.registerSprites()` and dynamic baked canvases through `renderer.drawCanvas(versionedKey, canvas, x, y)` so both Kaplay WebGL and Canvas 2D stay pixel-identical.
   - Pull base ground/foliage colors from `PALETTES` in `src/tileset.js` so future Seasonal Palette Swaps (Autumn, Snow Day, Spring Blossom, Golden Hour) require only a palette key switch.
   - When importing kid-drawn 16x16 or 16x24 PNGs from Pixilart/Piskel, place them in `public/sprites/` and verify crisp integer scaling.

5. **Verify**:
   - Run `npm test && npm run build`.
   - Confirm no `WebGL`-only APIs leak outside `src/renderer.js`.
