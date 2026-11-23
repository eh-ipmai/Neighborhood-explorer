# Neighborhood Explorer — 16-Bit SNES RPG

Real-world neighborhood exploration RPG built for iPad vibe-coding (GitHub Codespaces) and Windows PC collaboration.

- **Game Design Document:** [`docs/GDD.md`](docs/GDD.md)
- **AI Collaboration Rules:** [`AGENTS.md`](AGENTS.md)
- **Visual Style:** 16-Bit SNES Overworld (*A Link to the Past* / *Chrono Trigger*) with 1-house-per-address OpenStreetMap buildings, WebGL + automatic HTML5 2D Canvas fallback, and Seasonal Palette Swaps queued as a future add-on.

## Quick Start

```bash
npm install
npm run dev
```

Open the forwarded Vite preview URL (port `5173`) in iPad Safari or your desktop browser.

### Controls
- **Move (8-way with 4px corner sliding):** `WASD`, Arrow Keys, or the on-screen iPad Virtual D-Pad
- **⚡ FASTER:** Hold `Shift` (or `B`) or hold the **⚡ FASTER** touch button (boosts speed on sidewalks/trails and upgrades with Running Shoes → Scooter → Mountain Bike; stays at careful walking pace on unchecked roads & parking lots)
- **👀 LOOK BOTH WAYS / 💬 TALK:** Press `Space` (or `E`) or tap **👀 LOOK BOTH WAYS** near curbs/crosswalks/parking lots for Safety XP, or near any landmark NPC / hidden chest to talk & collect rewards
- **🗺️ Folded Paper Map & Quests:** Press `M` (or `Tab`) or tap **🗺️ Map** to unroll the fog-of-war Newton Centre map, track active quests, and inspect your Explorer Backpack
- **🎨 Real House Color Painter:** Press `P` or tap **🎨 Paint** next to any house to repaint its real siding & roof colors live and copy `data/house_colors.json`
- **🔊 Sound / Grid / Home:** `SFX` mute button, `C` (Grid/Collision debug overlay), `H` (return to Home Base at 565 Boylston St)

## Kid-Editable Content (`data/`)
- `data/landmarks.json` — Neighborhood stops, NPCs, dialogue, and reward items (Home Base, J.P. Licks, Rosenfeld's Bagels, Newton Free Library, Weeks Field, Oakdale Woods, Beth El, Ward Field, Salzberg House)
- `data/quests.json` — Multi-step neighborhood quests & traversal gear rewards
- `data/house_colors.json` — Real-world siding & roof color overrides by street address
- `data/world_map.json` — Pre-compiled `512×512` (`3.07 km × 3.07 km`) Newton Centre OpenStreetMap tile grid

## Rebuilding the World Map

```bash
npm run build:map          # Live OpenStreetMap Overpass build (cached 3x3 chunks)
npm run build:map:offline  # Deterministic offline Newton Centre layout
```

## Testing & Production Build

```bash
npm test
npm run build
```
