---
name: playtest-gate
description: >-
  Use this skill before committing a milestone, after rebuilding data/world_map.json,
  or before advancing to a new GDD phase to validate tests, production build, map
  integrity, landmark bounds, and cross-platform/WebGL-fallback readiness.
---

# Playtest & Milestone Verification Gate

Run this lightweight quality gate before committing checkpoints or shipping
map, engine, or content changes.

## Checklist

1. **Automated Tests & Production Build**:
   Run in a single command:
   ```bash
   npm test && npm run build
   ```
   Confirm all cross-platform Node unit tests pass (104+ tests across `tests/*.test.mjs`) and Vite outputs `dist/index.html`, `dist/assets/`, and copies `data/` into `dist/data/`.

2. **World Map & Content Alignment Check**:
   Confirm:
   - `data/world_map.json` has matching `layers.base.length === width * height` and `layers.collision.length === width * height`.
   - `origin.spawnTile` is walkable (`collision === 0`).
   - `buildings[]` includes Home Base (`isHomeBase: true`) and street addresses.
   - Every landmark in `data/landmarks.json` has `tileX` and `tileY` inside `[0..width-1, 0..height-1]`.
   - Every quest step in `data/quests.json` referencing `targetLandmarkId` points to an existing landmark ID.
   - `data/house_colors.json` parses cleanly as valid JSON.

3. **Cross-Platform, Browser-Safe Generator & No-WebGL Safety**:
   - Ensure `package.json` scripts and `scripts/*.mjs` contain no Unix-only shell syntax (Windows PC parity).
   - Ensure every module in `src/generator/` remains pure ESM with **zero Node-only imports** so Vite bundles cleanly for the in-browser Neighborhood Studio.
   - Ensure Newton-specific map/park/graveyard overrides stay guarded behind `isNewtonCentreMap` / `preset === "newton"`.
   - Ensure no secrets or `.env` files are staged in `git status`.
   - Confirm any new rendering primitives work in both `kaplay-webgl` and `canvas-2d` modes in `src/renderer.js`.
