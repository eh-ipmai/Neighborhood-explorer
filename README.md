# Neighborhood Explorer — Universal 16-Bit SNES RPG Toolkit

Turn **any real-world neighborhood in the world** into a playable 16-bit SNES exploration RPG for kids — complete with real OpenStreetMap streets, per-address houses, 12 regional biomes & 4 seasons, bilingual street signs, playful regional Local Flair neighbors, parks, playgrounds, libraries, local shops, multi-faith houses of worship, spooky cemeteries, pedestrian safety mechanics, and customizable family landmarks & quests.

Built for **iPad Safari** (touch-first, WebGL + automatic 4x HD Canvas 2D fallback) and **Desktop / Windows / macOS / Linux**.

- **Turnkey Colleague & Family Guide:** [`docs/TOOLKIT_GUIDE.md`](docs/TOOLKIT_GUIDE.md)
- **Release Notes & Changelog:** [`RELEASE_NOTES.md`](RELEASE_NOTES.md)
- **Original Game Design Document:** [`docs/GDD.md`](docs/GDD.md)
- **AI Collaboration Rules:** [`AGENTS.md`](AGENTS.md)
- **Antigravity CLI (`agy`) Codespaces Setup:** [`AGY_SETUP.md`](AGY_SETUP.md)

---

## Build a Game for Your Own Neighborhood (2 Easy Ways)

### Option 1 — Zero-Install In-Browser Studio *(iPad, Phone, or Desktop)*
No Node.js, coding, or GitHub account required:
1. Open the deployed Neighborhood Explorer web app.
2. Tap **`🌍 Build Neighborhood`** in the top-center crest bar (or open **`⚙️ Menu`** → **`🌍 Build Neighborhood`**).
3. Enter **any starting street address worldwide** (e.g. `1204 Barton Springs Rd, Austin, TX`, `Emek Refaim 24, Jerusalem, Israel`, or `Rue de Rivoli, Paris, France`) — or tap one of the **10 one-tap global city chips** (Paris, Brooklyn, Jerusalem, Old City, Tel Aviv, London, Rome, Tokyo, Reykjavik, Austin).
4. Pick your kid's name, **Map Size** (*Walkable ~1 mi* takes ~20–40 seconds; *Standard ~1.4 mi* takes ~45–75 seconds; *Full Town ~1.9 mi* takes ~1–2 minutes), **Regional Biome & Architecture** (Auto-Detect or 12 world biomes), **Season Skin** (Auto-Detect or Spring / Summer / Fall / Winter), **Street & Place Language** (`Bilingual (English · Local)` or `English Only`), and **Explorer Style** (hair style & color, skin tone, headwear).
5. *(Optional)* Queue important family stops like **Grandma's House**, **School**, or **Best Friend's House** right inside the form.
6. Tap **`🚀 Build My Neighborhood`** — the browser downloads real OpenStreetMap data, builds the SNES tile world with authentic regional stone/trees/roofs/wildlife/Local Flair neighbors, auto-discovers local libraries, parks, ice cream shops, bakeries, fire stations, houses of worship, and cemeteries, creates starter quests, and launches your town!
7. Open **`🌍 Build Neighborhood` → `📍 Places & Goals`** anytime to switch Biome/Season or Explorer Style live, add new places (by street address or *right where you're standing*), and build custom multi-step quests — or use **`📦 My Towns & Share`** to export a portable `.json` pack to share with family or import on another device.

### Option 2 — Fork & Host Your Own Permanent Neighborhood Site *(CLI Packager)*
Want a permanent GitHub Pages URL pre-loaded with your town (instant zero-wait load for your kids)?
```bash
# 1. Clone (or fork) this repository and install dependencies
npm install

# 2. Generate your neighborhood into data/ (geocodes address, fetches OSM, discovers POIs & builds quests)
npm run create:neighborhood -- --address "1204 Barton Springs Rd, Austin, TX" --hero "Maya" --size walkable

# Optional: choose biome, language labels, or custom family places & goals (see docs/examples/custom_places.example.json)
npm run create:neighborhood -- --address "Emek Refaim 24, Jerusalem, Israel" --hero "Noam" --biome israel_jerusalem --labels bilingual
npm run create:neighborhood -- --address "1204 Barton Springs Rd, Austin, TX" --hero "Maya" --places my_places.json

# 3. Playtest locally
npm run dev

# 4. Verify & deploy (GitHub Actions deploys automatically to GitHub Pages on push to main!)
npm test && npm run build
```

> **Tip:** Pass `--out-dir packs/austin` to build a test neighborhood without overwriting the default `data/` Newton Centre world. You can also load any hosted `neighborhood_pack.json` directly via `?pack=./packs/austin/neighborhood_pack.json` (or switch to a saved browser town via `?neighborhood=<id>`).

---

## Controls

| Action | Keyboard | iPad / Touch |
| :--- | :--- | :--- |
| **Move (8-way + 4px corner slide)** | `WASD` or Arrow Keys | Virtual D-Pad (bottom-left) |
| **⚡ Go Faster** *(upgrades with Shoes → Scooter → Bike)* | Hold `Shift` or `B` | Hold **⚡ FASTER** |
| **👀 Look Both Ways / 💬 Talk / 🪧 Read Sign / 📦 Open Chest** | `Space`, `E`, or `Enter` (`L` forces Look) | Tap **👀 LOOK BOTH WAYS** (context-aware!) |
| **🏠 Go Inside Home Base** *(Kitchen, Closet, Secret Nook & D&D Basement)* | `I` | Tap **🏠 Inside (I)** |
| **🥨 Share Snack / Feed Wildlife** | `N` | Tap **🥨 Snack (N)** |
| **⚔️ Graveyard Sword** | `J`, `F`, or `X` | Tap **⚔️ Sword (J)** |
| **📖 Pocket Prayer Book** *(calms graveyard foes)* | `K`, `R`, or `Z` | Tap **📖 Prayer Book (K)** |
| **🗺️ Folded Paper Map, Quests & Backpack** | `M` or `Tab` | Tap top-right **Compass / Map** |
| **🧭 Cycle Mode** *(Signpost → Hard 45° Compass → Easy/GPS Fast-Travel)* | `G` | `⚙️ Menu` → Mode |
| **👕 Cycle Unlocked Outfits** | `O` | `⚙️ Menu` → Outfit |
| **🎨 Paint Real House Colors** | `P` | `⚙️ Menu` → Paint House |
| **🌍 Build / Customize Neighborhood Studio** | — | Top-center **🌍 Build Neighborhood** (or `⚙️ Menu`) |
| **🏠 Warp Home / 📐 Debug Grid** | `H` / `C` | `⚙️ Menu` |

---

## Repository Structure

```text
src/
  generator/
    geocode.js            # Pure-JS OpenStreetMap Nominatim address geocoder (Browser + Node)
    osm_fetch.js          # Pure-JS tiled OSM API v0.6 + Overpass mirror fetcher (auto-subdivides dense tiles)
    rasterizer.js         # Pure-JS 5-layer OSM -> SNES tile grid, 20-kind building taxonomy, trees, city walls & cemeteries
    poi_landmarks.js      # Automatic local landmark discovery, 8-faith house-of-worship & starter quest generator
    pack_builder.js       # Shared browser/Node pack orchestrator, validator & immutable place/quest editors
    pack_store.js         # IndexedDB multi-neighborhood store + active-pack switcher
  neighborhood_meta.js    # Universal town/hero/biome/season/flair metadata & per-neighborhood save key isolation
  biomes.js               # 12 global regional biomes, 4 hemisphere-aware seasons, local quirks & bilingual formatters
  local_flair.js          # 17 playful regional cultural profiles (32-bit Friendly Locals, held props & city chants)
  studio_ui.js            # In-browser "Build My Neighborhood" Studio modal controller
  main.js                 # Core game loop, multi-neighborhood boot loader & interaction orchestration
  player.js / safety.js   # 8-way normalized movement, 4px corner sliding & pedestrian road-crossing safety
  vector_roads.js         # Globally portable 4x HD curved OSM road, lane divider & crosswalk renderer
  road_markings.js        # Regional road markings, stop bars & intersection markings
  subgrid.js              # 4px sub-cell collision & sidewalk navigation grid
  quests.js               # Dynamic landmarks, quests, inventory, outfits & fog-of-war progression
  streetsigns.js          # Intersection-only street-sign wayfinding & A* turn-by-turn street directions
  papermap.js             # High-res 512x512 fog-of-war Folded Paper Map renderer
  house_interior.js       # 2x HD 32-bit Home Base interior (Living Room, Secret Attic Nook, D&D Basement)
  characters.js           # 32-bit hero profiles, outfits, NPCs, Friendly Locals & biome-specific marchers
  items32bit.js           # 2x HD 32-bit pickup items, faith keepsakes, sword swing & interaction FX
  vehicles32bit.js        # 2x HD 32-bit street traffic & generic FIRE/POLICE/EMS emergency vehicles
  world32bit.js           # 2x HD 32-bit regional trees, streetlights, snow/stone roofs & environmental props
  tileset.js              # SNES tilesets, 13 biome/season palettes & 1-house-per-address building baker
  parks.js / parking_lots.js / graveyards.js / streetlife.js / traffic.js / renderer.js / ui.js / audio.js
scripts/
  create_neighborhood.mjs # One-command CLI neighborhood generator (`npm run create:neighborhood`)
  build_map.mjs           # Classic Newton Centre map rebuild/enrichment CLI (`npm run build:map`)
data/                     # Pre-compiled default neighborhood (Newton Centre, MA)
docs/
  TOOLKIT_GUIDE.md        # Complete colleague & family handbook + developer handoff guide
  GDD.md                  # Original Game Design Document (V3)
  examples/custom_places.example.json
tests/                    # Cross-platform Node unit test suite (`npm test` — 104 tests across 17 suites)
```

---

## Common Commands

```bash
npm run dev                  # Start Vite dev server (accessible on LAN & GitHub Codespaces)
npm run preview              # Preview production build locally
npm run create:neighborhood  # Build a custom neighborhood from any address (add -- --help for options)
npm run build:map            # Rebuild default Newton Centre world_map.json from live OSM
npm run build:map:offline    # Rebuild deterministic offline demo world_map.json
npm run build:map:enrich     # Re-run map enrichment passes on existing data/world_map.json
npm run build:map:roads      # Re-enrich vector roads on existing data/world_map.json
npm test                     # Run all cross-platform Node unit tests
npm run build                # Build static production bundle to dist/
```
