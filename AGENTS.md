# AGENTS.md — Neighborhood Explorer 8-Bit RPG

Guidance for AI coding assistants collaborating on this repository.

## Project Reference
- Full design document: `docs/GDD.md`
- Engine: **Kaplay (WebGL)** with automatic **HTML5 2D Canvas fallback** (`src/renderer.js`) locked to `320x180` internal resolution with crisp integer/pixelated scaling (`imageSmoothingEnabled = false`, `image-rendering: pixelated`). Always keep rendering working on both WebGL and Canvas 2D so browsers without WebGL (e.g., iPad Lockdown Mode / VS Code Simple Browser) run cleanly.
- Visual Style (Locked In): **Option 1 — 16-Bit SNES Overworld** (*A Link to the Past* / *Chrono Trigger*), with **Seasonal Palette Swaps** (Autumn Leaf-Pile, Snow Day, Spring Blossom, Golden Hour Friday Afternoon) planned as a future palette add-on.
- Per-Address Buildings: Preserve individual OpenStreetMap building records (`buildings[]` with address & footprint bounds) in `data/world_map.json` so every real address renders as its own distinct house/building (1 house per address).
- Target platforms: **iPad Safari** (touch-first, split-screen Codespaces preview) and **Desktop / Windows PC** (keyboard + local `npm install && npm run dev`).

## Core Rules
1. **Cross-Platform Parity**: Never introduce Unix-only shell commands in `package.json` scripts or build steps. Use cross-platform Node.js ESM scripts (`.mjs`) and `cross-env`.
2. **Keep Secrets Out of Git**: Never commit API keys, tokens, or personal credentials. Use `.env` (gitignored) for optional local settings.
3. **Pre-Compiled World Map**: `data/world_map.json` is committed directly to Git so the game runs immediately with zero map-build step on clone. Re-generate via `npm run build:map` (or `npm run build:map:offline` without network).
4. **Kid-Editable Content First**: Keep `data/landmarks.json` and `data/quests.json` human-readable, cleanly formatted, and backwards-compatible so kids can edit them directly in GitHub's web editor or via natural-language prompts.
5. **16-Bit Game Feel & Performance**:
   - Do not spawn thousands of individual Kaplay game objects for static map tiles; render only the visible viewport slice (or chunk cache) and perform O(1) tile collision lookups against `world_map.json`.
   - Maintain 8-way normalized movement, 4-way cardinal facing, and 4px sub-tile corner sliding in `src/player.js`.
6. **Zero Audio Asset Dependencies**: Prefer Web Audio API / ZzFX synthesized retro SFX in `src/audio.js` unless kids explicitly add custom voice/SFX recordings.
7. **Auto-Commit, Push & Deploy After Verified Edits**: After each round of edits, run `npm test && npm run build` to verify everything passes, then immediately commit with a clear message and `git push origin main` so GitHub Pages deploys automatically without waiting to be asked.
8. **Kid-Friendly Civic Framing**: Portray real-world neighbors and civic groups (such as marchers/protestors) peacefully — never as hostile enemies that deal damage. Resolve sidewalk crowds with friendly interactions (e.g., sharing snacks). Reserve heart-damage enemy behavior strictly for playful wildlife (turkeys, squirrels, cats, runaway dogs) or whimsical/spooky fiction (graveyard ghosts/skeletons).
9. **Dedicated Touch + Keyboard Buttons & 2x HD Visuals**: Every major context-sensitive action (e.g., entering a house `I`, sharing a snack `N`, sword `J`, siddur `K`) must provide both a dedicated physical touch button in `.utility-row` and a keyboard hotkey so road-crossing prompts never hide it on iPad or desktop. Render new interiors and hero scenes with detailed 2x HD 32-bit pixel canvases (`__pixelScale = 0.5`) rather than plain primitive rectangles, maintaining full WebGL + Canvas 2D parity.

## Common Commands
- `npm run dev` — Start Vite dev server (accessible on LAN / Codespaces HTTPS preview)
- `npm run build` — Production build to `dist/`
- `npm run build:map` — Rebuild `data/world_map.json` from OpenStreetMap (Overpass API)
- `npm run build:map:offline` — Rebuild `data/world_map.json` using deterministic offline neighborhood layout
- `npm test` — Run Node unit tests (`tests/*.test.mjs`)
