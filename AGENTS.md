# AGENTS.md — Neighborhood Explorer 16-Bit SNES RPG

Guidance for AI coding assistants collaborating on this repository.

## Project Reference
- Full toolkit & developer handoff guide: `docs/TOOLKIT_GUIDE.md`
- Original design document: `docs/GDD.md`
- Engine: **Kaplay (WebGL)** with automatic **HTML5 2D Canvas fallback** (`src/renderer.js`) locked to `320x180` internal resolution with crisp integer/pixelated scaling (`imageSmoothingEnabled = false`, `image-rendering: pixelated`). Always keep rendering working on both WebGL and Canvas 2D so browsers without WebGL (e.g., iPad Lockdown Mode / VS Code Simple Browser) run cleanly.
- Visual Style (Locked In): **Option 1 — 16-Bit SNES Overworld** (*A Link to the Past* / *Chrono Trigger*), extended with **12 Global Regional Biomes & 4 Seasons** (`src/biomes.js` + `PALETTES` in `src/tileset.js`) and **2x HD 32-Bit Pixel Canvases** (`__pixelScale = 0.5`) for characters, vehicles, items, props, and interiors.
- Per-Address Buildings: Preserve individual OpenStreetMap building records (`buildings[]` with address, footprint bounds, architectural style & 20-kind taxonomy) in `data/world_map.json` so every real address renders as its own distinct house/building (1 house per address).
- Target platforms: **iPad Safari** (touch-first, split-screen Codespaces preview) and **Desktop / Windows PC** (keyboard + local `npm install && npm run dev`).

## Core Rules
1. **Cross-Platform Parity & Browser-Safe Generator**: Never introduce Unix-only shell commands in `package.json` scripts or build steps. Use cross-platform Node.js ESM scripts (`.mjs`) and `cross-env`. Keep everything in `src/generator/` strictly pure ESM with **zero Node-only imports** so Vite bundles it for the in-browser Studio while Node executes it in the CLI and tests.
2. **Keep Secrets Out of Git**: Never commit API keys, tokens, or personal credentials. Use `.env` (gitignored) for optional local settings.
3. **Pre-Compiled Default World Map & Universal Engine**: `data/world_map.json` (Newton Centre, MA) is committed directly to Git so the game runs immediately with zero map-build step on clone. Guard any Newton-specific map/park/graveyard overrides behind `isNewtonCentreMap` / `preset === "newton"` (`src/neighborhood_meta.js`) so custom worldwide neighborhoods built via the in-browser Studio or `npm run create:neighborhood` stay 100% clean.
4. **Kid-Editable Content First**: Keep `data/landmarks.json`, `data/quests.json`, and `data/house_colors.json` human-readable, cleanly formatted, and backwards-compatible so kids can edit them directly in GitHub's web editor or via natural-language prompts.
5. **16-Bit Game Feel & Performance**:
   - Do not spawn thousands of individual Kaplay game objects for static map tiles; render only the visible viewport slice (or chunk cache) and perform O(1) tile collision lookups against `world_map.json`.
   - Maintain 8-way normalized movement, 4-way cardinal facing, and 4px sub-tile corner sliding in `src/player.js` / `src/subgrid.js`.
6. **Zero Audio Asset Dependencies**: Prefer Web Audio API / ZzFX synthesized retro SFX in `src/audio.js` unless kids explicitly add custom voice/SFX recordings.
7. **Auto-Commit, Push & Deploy After Verified Edits**: After each round of edits, run `npm test && npm run build` to verify everything passes, then immediately commit with a clear message and `git push origin main` so GitHub Pages deploys automatically without waiting to be asked.
8. **Kid-Friendly Civic & Cultural Framing**: Portray real-world neighbors, regional Local Flair characters (`src/local_flair.js`), faith communities, and civic groups (such as sidewalk marchers/protestors) warmly and peacefully — never as hostile enemies that deal damage. Resolve sidewalk crowds with friendly interactions (e.g., sharing snacks). Reserve heart-damage enemy behavior strictly for playful wildlife (turkeys, squirrels, cats, runaway dogs, regional wildlife) or whimsical/spooky fiction (graveyard ghosts/skeletons).
9. **Dedicated Touch + Keyboard Buttons & 2x HD Visuals**: Every major context-sensitive action (e.g., entering a house `I`, sharing a snack `N`, sword `J`, Prayer Book / Siddur `K`) must provide both a dedicated physical touch button in `.utility-row` and a keyboard hotkey so road-crossing prompts never hide it on iPad or desktop. Render new interiors and hero scenes with detailed 2x HD 32-bit pixel canvases (`__pixelScale = 0.5`) rather than plain primitive rectangles, maintaining full WebGL + Canvas 2D parity.

## Common Commands
- `npm run dev` — Start Vite dev server (accessible on LAN / Codespaces HTTPS preview)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally
- `npm run create:neighborhood` — Generate a custom neighborhood pack from any worldwide address (add `-- --help` for flags)
- `npm run build:map` — Rebuild default Newton Centre `data/world_map.json` from live OpenStreetMap
- `npm run build:map:offline` — Rebuild `data/world_map.json` using deterministic offline neighborhood layout
- `npm run build:map:enrich` — Re-run map enrichment passes on `data/world_map.json`
- `npm run build:map:roads` — Re-enrich vector roads on `data/world_map.json`
- `npm test` — Run cross-platform Node unit tests (`tests/*.test.mjs`)
