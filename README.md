# Neighborhood Explorer — 8-Bit RPG

Real-world neighborhood exploration RPG built for iPad vibe-coding (GitHub Codespaces) and Windows PC collaboration.

- **Game Design Document:** [`docs/GDD.md`](docs/GDD.md)
- **AI Collaboration Rules:** [`AGENTS.md`](AGENTS.md)

## Quick Start

```bash
npm install
npm run dev
```

Open the forwarded Vite preview URL (port `5173`) in iPad Safari or your desktop browser.

### Controls (Phase 1 Greybox)
- **Move (8-way with 4px corner sliding):** `WASD`, Arrow Keys, or the on-screen iPad Virtual D-Pad
- **⚡ FASTER:** Hold `Shift` (or `B`) or hold the **⚡ FASTER** touch button (boosts speed on sidewalks/trails; stays at careful walking pace on unchecked roads)
- **👀 LOOK BOTH WAYS:** Press `Space` (or `E`) or tap **👀 LOOK BOTH WAYS** near any curb/crosswalk to look left & right, activate Safe Crossing, and earn Safety XP
- **Toggle Grid & Collision Overlay:** `C` or **Grid** button
- **Return to Home Base:** `H` or **Home** button

## Rebuilding the Real-World Map (`data/world_map.json`)

A pre-compiled `data/world_map.json` is committed in Git so the game runs immediately with zero map setup. To regenerate it from live OpenStreetMap data around Home Base:

```bash
npm run build:map
```

To regenerate using the deterministic offline Newton Centre layout (no network required):

```bash
npm run build:map:offline
```

## Testing & Production Build

```bash
npm test
npm run build
```
