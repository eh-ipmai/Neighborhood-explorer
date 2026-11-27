# Release Notes — Neighborhood Explorer

## v1.0.0 — Universal Neighborhood Explorer Toolkit *(2026-11-27)*

Neighborhood Explorer is now a **universal, any-address neighborhood RPG toolkit** — allowing families and colleagues anywhere in the country to turn their own street and town into a playable 16-bit SNES exploration RPG in minutes, while preserving the original Newton Centre (`565 Boylston St`) game 100% intact as the built-in default.

### Highlights

#### 1. In-Browser "Build My Neighborhood" Studio *(Zero-Install, iPad & Desktop)*
- Added **🌍 Build Neighborhood** inside the top-right `⚙️ Menu` ([`src/studio_ui.js`](src/studio_ui.js), [`index.html`](index.html)).
- **Build New Town (Tab 1)**: Enter any street address, kid's name, and map size (*Walkable ~1 mi*, *Standard ~1.4 mi*, or *Full Town ~1.9 mi*), optionally queue custom family stops, and build live from OpenStreetMap with a real-time progress bar.
- **Places & Goals Customizer (Tab 2)**: Add important custom places either **by street address** (geocoded automatically) or **right where your explorer is standing**, set custom NPC names/greetings/heart-healing snacks, and assemble custom multi-step quests.
- **My Towns & Share (Tab 3)**: Switch seamlessly between Built-in Newton Centre and any saved custom neighborhoods stored locally in IndexedDB ([`src/generator/pack_store.js`](src/generator/pack_store.js)), **Export** a portable `*_pack.json` bundle, or **Import** packs shared by family & colleagues.
- Added `?pack=<url>` and `?neighborhood=<id>` URL boot support in [`src/main.js`](src/main.js) for hosting or linking directly to custom neighborhood packs.
- Added editable-input keyboard guards in [`src/renderer.js`](src/renderer.js) and [`src/main.js`](src/main.js) so typing addresses/dialogue never triggers game movement or hotkeys on desktop or iPad Safari.

#### 2. One-Command CLI Neighborhood Packager
- Added `npm run create:neighborhood` ([`scripts/create_neighborhood.mjs`](scripts/create_neighborhood.mjs)) powered by the exact same shared pure-JS generator core as the browser Studio.
- Supports `--address`, `--lat`/`--lon`, `--hero`, `--town`, `--size walkable|standard|full`, `--places <file.json>`, `--out-dir`, `--overpass`, and `--offline-fixture`.
- Added starter template [`docs/examples/custom_places.example.json`](docs/examples/custom_places.example.json) showing how to configure custom family places, keepsake items, and quests.

#### 3. Shared Pure-JS Generator Engine (`src/generator/`)
- Extracted the entire 5-layer OpenStreetMap tile rasterizer, road smoother, sidewalk enforcer, building classifier, and map enricher into zero-dependency pure ESM ([`src/generator/rasterizer.js`](src/generator/rasterizer.js)) usable in both Node.js and browsers.
- Added pure-JS OpenStreetMap Nominatim geocoder ([`src/generator/geocode.js`](src/generator/geocode.js)) and tiled OSM API v0.6 + Overpass mirror fetcher with progress callbacks ([`src/generator/osm_fetch.js`](src/generator/osm_fetch.js)).
- Added automatic POI landmark & starter quest generator ([`src/generator/poi_landmarks.js`](src/generator/poi_landmarks.js)): automatically discovers real libraries, ice cream shops, bakeries, cafes, bookstores, parks, schools, fire stations, houses of worship, lakes/ponds, and cemeteries, guarantees all core RPG gear (Sword, Pocket Blessing Book, Running Shoes, Scooter, Outfits) is earnable in every town, and handles sparse areas gracefully.
- Added `extractGraveyardsFromOsm()` so any town's real OpenStreetMap cemeteries automatically render as spooky graveyards.

#### 4. Universal Engine & Isolated Per-Neighborhood Saves
- Added [`src/neighborhood_meta.js`](src/neighborhood_meta.js) to resolve town name, home address, hero name, preset (`newton` vs `generic`), and isolated `localStorage` keys per neighborhood (preserving existing Newton Centre saves and house paints).
- Guarded all Newton-specific map/park/graveyard overrides behind the `newton` preset across [`src/generator/rasterizer.js`](src/generator/rasterizer.js), [`src/graveyards.js`](src/graveyards.js), and [`src/parks.js`](src/parks.js).
- Generalized runtime copy, paper map header, Home Base interior rooms/dialogue, street life chants/toasts, dynamic item metadata, and snack-restocking landmarks across [`src/main.js`](src/main.js), [`src/ui.js`](src/ui.js), [`src/house_interior.js`](src/house_interior.js), [`src/quests.js`](src/quests.js), and [`src/streetlife.js`](src/streetlife.js).

#### 5. Documentation & Verification
- Added turnkey [`docs/TOOLKIT_GUIDE.md`](docs/TOOLKIT_GUIDE.md), updated [`README.md`](README.md), and added this `RELEASE_NOTES.md`.
- Expanded cross-platform Node test coverage to **85 passing unit tests** (new suites: [`tests/universal_engine.test.mjs`](tests/universal_engine.test.mjs), [`tests/neighborhood_generator.test.mjs`](tests/neighborhood_generator.test.mjs), [`tests/pack_builder_store.test.mjs`](tests/pack_builder_store.test.mjs)) + verified clean Vite production bundle (`npm test && npm run build`).

---

## v0.1.0 — Newton Centre 16-Bit SNES RPG Foundation *(Prior Releases)*
- 4x HD curved vector roads (`src/vector_roads.js`) & 4px sub-cell sidewalk navigation (`src/subgrid.js`).
- 1-house-per-address OpenStreetMap buildings with 12 residential architectures & in-game Real House Color Painter (`P`).
- Interactive Home Base interior (Living Room & Kitchen, Secret Upstairs Reading Nook with Golden D20, 32-bit D&D Basement Dungeon with 3-switch puzzle & Bag of Holding).
- Active Street-Sign Wayfinding (`Signpost`, `Hard 45° Compass`, and `Easy / GPS Fast-Travel` modes) with A* turn-by-turn street directions.
- Kid-friendly civic street life (peaceful snack-sharing marchers, roving turkeys/squirrels/cats/runaway dogs, joggers, traffic safety cutscene) and spooky graveyards (East Parish 1660 & Newton Cemetery).
- Full WebGL + 4x HD HTML5 Canvas 2D fallback parity and zero-dependency Web Audio / ZzFX synthesized SFX.
