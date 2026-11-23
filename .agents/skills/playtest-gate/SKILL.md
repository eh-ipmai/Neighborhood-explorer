---
name: playtest-gate
description: >-
  Use this skill before committing a milestone, after rebuilding data/world_map.json,
  or before advancing to a new GDD phase to validate tests, production build, map
  integrity, landmark bounds, and cross-platform/WebGL-fallback readiness.
---

# Playtest & Milestone Verification Gate

Run this lightweight quality gate before committing phase checkpoints or shipping
map/content changes.

## Checklist

1. **Automated Tests & Production Build**:
   Run in a single command:
   ```bash
   npm test && npm run build
   ```
   Confirm all Node unit tests pass and Vite outputs `dist/index.html`, `dist/assets/`, and copies `data/` into `dist/data/`.

2. **World Map & Content Alignment Check**:
   Run a quick Node validation script confirming:
   - `data/world_map.json` has matching `layers.base.length === width * height` and `layers.collision.length === width * height`.
   - `origin.spawnTile` is walkable (`collision === 0`).
   - `buildings[]` includes Home Base (`isHomeBase: true`) and street addresses.
   - Every landmark in `data/landmarks.json` has `tileX` and `tileY` inside `[0..width-1, 0..height-1]`.
   - Every quest step in `data/quests.json` referencing `targetLandmarkId` points to an existing landmark ID.
   - `data/house_colors.json` parses cleanly as valid JSON.

3. **Cross-Platform & No-WebGL Safety**:
   - Ensure `package.json` scripts contain no Unix-only shell syntax (Windows PC parity).
   - Ensure no secrets or `.env` files are staged in `git status`.
   - Confirm any new rendering primitives work in both `kaplay-webgl` and `canvas-2d` modes in `src/renderer.js`.
