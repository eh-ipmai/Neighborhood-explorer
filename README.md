# Neighborhood Explorer — Universal 16-Bit SNES RPG Toolkit

Turn **any real-world neighborhood in the world** into a playable 16-bit SNES exploration RPG for kids — complete with real OpenStreetMap streets, per-address houses, parks, playgrounds, libraries, local shops, spooky cemeteries, street-sign wayfinding, pedestrian safety mechanics, and customizable family landmarks & quests.

Built for **iPad Safari** (touch-first, WebGL + automatic 4x HD Canvas 2D fallback) and **Desktop / Windows / macOS / Linux**.

- **Turnkey Colleague & Family Guide:** [`docs/TOOLKIT_GUIDE.md`](docs/TOOLKIT_GUIDE.md)
- **Release Notes & Changelog:** [`RELEASE_NOTES.md`](RELEASE_NOTES.md)
- **Original Game Design Document:** [`docs/GDD.md`](docs/GDD.md)
- **AI Collaboration Rules:** [`AGENTS.md`](AGENTS.md)

---

## Build a Game for Your Own Neighborhood (2 Easy Ways)

### Option 1 — Zero-Install In-Browser Studio *(iPad, Phone, or Desktop)*
No Node.js, coding, or GitHub account required:
1. Open the deployed Neighborhood Explorer web app.
2. Tap **`⚙️ Menu`** (top-right) → **`🌍 Build Neighborhood`**.
3. Enter any starting street address (e.g. `1204 Barton Springs Rd, Austin, TX`), your kid's name, and map size (*Walkable ~1 mi* takes ~20–40 seconds; *Full Town ~1.9 mi* takes ~1–2 minutes).
4. *(Optional)* Queue important family stops like **Grandma's House**, **School**, or **Best Friend's House** right inside the form.
5. Tap **`🚀 Build My Neighborhood`** — the browser downloads real OpenStreetMap data, builds the SNES tile world, auto-discovers local libraries, parks, ice cream shops, bakeries, fire stations, and cemeteries, creates starter quests, and launches your town!
6. Open **`🌍 Build Neighborhood` → `📍 Places & Goals`** anytime to add new places (by street address or *right where you're standing*) and custom multi-step quests, or use **`📦 My Towns & Share`** to export a portable `.json` pack to share with family or import on another device.

### Option 2 — Fork & Host Your Own Permanent Neighborhood Site *(CLI Packager)*
Want a permanent GitHub Pages URL pre-loaded with your town (instant zero-wait load for your kids)?
```bash
# 1. Clone (or fork) this repository and install dependencies
npm install

# 2. Generate your neighborhood into data/ (geocodes address, fetches OSM, discovers POIs & builds quests)
npm run create:neighborhood -- --address "1204 Barton Springs Rd, Austin, TX" --hero "Maya" --size walkable

# Optional: include custom family places & goals (see docs/examples/custom_places.example.json)
npm run create:neighborhood -- --address "1204 Barton Springs Rd, Austin, TX" --hero "Maya" --places my_places.json

# 3. Playtest locally
npm run dev

# 4. Verify & deploy (GitHub Actions deploys automatically to GitHub Pages on push to main!)
npm test && npm run build
```

> **Tip:** Pass `--out-dir packs/austin` to build a test neighborhood without overwriting the default `data/` Newton Centre world. You can also load any hosted `neighborhood_pack.json` directly via `?pack=./packs/austin/neighborhood_pack.json`!

---

## Controls

| Action | Keyboard | iPad / Touch |
| :--- | :--- | :--- |
| **Move (8-way + 4px corner slide)** | `WASD` or Arrow Keys | Virtual D-Pad (bottom-left) |
| **⚡ Go Faster** *(upgrades with Shoes → Scooter → Bike)* | Hold `Shift` or `B` | Hold **⚡ FASTER** |
| **👀 Look Both Ways / 💬 Talk / 🪧 Read Sign / 📦 Open Chest** | `Space`, `E`, or `Enter` (`L` forces Look) | Tap **👀 LOOK BOTH WAYS** (context-aware!) |
| **🏠 Go Inside Home Base** *(Kitchen, Closet, Secret Nook & D&D Basement)* | `I` | Tap **🏠 Inside (I)** |
| **🥨 Share Snack / Feed Wildlife** | `N` | Tap **🥨 Snack (N)** |
| **⚔️ Graveyard Sword / 📖 Pocket Blessing Book** | `J` / `K` | Tap **⚔️ Sword (J)** / **📖 Siddur (K)** |
| **🗺️ Folded Paper Map, Quests & Backpack** | `M` or `Tab` | Tap top-right **Compass / Map** |
| **🧭 Cycle Mode** *(Signpost → Hard 45° Compass → Easy/GPS Fast-Travel)* | `G` | `⚙️ Menu` → Mode |
| **👕 Cycle Unlocked Outfits** | `O` | `⚙️ Menu` → Outfit |
| **🎨 Paint Real House Colors** | `P` | `⚙️ Menu` → Paint House |
| **🌍 Build / Customize Neighborhood Studio** | — | `⚙️ Menu` → **🌍 Build Neighborhood** |
| **🏠 Warp Home / 📐 Debug Grid** | `H` / `C` | `⚙️ Menu` |

---

## Repository Structure

```text
src/
  generator/
    geocode.js            # Pure-JS OpenStreetMap Nominatim address geocoder (Browser + Node)
    osm_fetch.js          # Pure-JS tiled OSM API v0.6 + Overpass mirror fetcher with progress callbacks
    rasterizer.js         # Pure-JS 5-layer OSM -> SNES tile grid + building/road/cemetery engine
    poi_landmarks.js      # Automatic local landmark discovery + custom places & starter quest generator
    pack_builder.js       # Shared browser/Node pack orchestrator, validator & immutable place/quest editors
    pack_store.js         # IndexedDB multi-neighborhood store + active-pack switcher
  neighborhood_meta.js    # Universal town/hero/address metadata & per-neighborhood save key isolation
  studio_ui.js            # In-browser "Build My Neighborhood" Studio modal controller
  main.js                 # Core game loop, multi-neighborhood boot loader & interaction orchestration
  vector_roads.js         # Globally portable 4x HD curved OSM road, lane divider & crosswalk renderer
  subgrid.js              # 4px sub-cell collision & sidewalk navigation grid
  quests.js               # Dynamic landmarks, quests, inventory, outfits & fog-of-war progression
  streetsigns.js          # Intersection street-sign wayfinding & A* turn-by-turn street directions
  house_interior.js       # 32-bit Home Base interior (Living Room, Secret Attic Nook, D&D Basement)
  parks.js / graveyards.js / streetlife.js / traffic.js / tileset.js / renderer.js / ui.js / audio.js
scripts/
  create_neighborhood.mjs # One-command CLI neighborhood generator (`npm run create:neighborhood`)
  build_map.mjs           # Classic map rebuild/enrichment CLI (`npm run build:map`)
data/                     # Pre-compiled default neighborhood (Newton Centre, MA)
docs/
  TOOLKIT_GUIDE.md        # Complete colleague & family handbook + developer handoff guide
  examples/custom_places.example.json
tests/                    # Cross-platform Node unit test suite (`npm test`)
```

---

## Common Commands

```bash
npm run dev                  # Start Vite dev server (accessible on LAN & GitHub Codespaces)
npm run create:neighborhood  # Build a custom neighborhood from any address (add -- --help for options)
npm run build:map            # Rebuild default Newton Centre world_map.json from live OSM
npm run build:map:offline    # Rebuild deterministic offline demo world_map.json
npm test                     # Run all cross-platform Node unit tests
npm run build                # Build static production bundle to dist/
```
