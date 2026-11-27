# Release Notes — Neighborhood Explorer

## v1.1.0 — Global Biomes, 4 Seasons, Hero Profiles, Multi-Faith Support & Playful Local Flair *(2026-11-27)*

Neighborhood Explorer now works **worldwide** with authentic regional architecture, 4 geographic seasons, customizable hero profiles, multi-language street signage, respectful multi-religion houses of worship, and affectionate city-specific sidewalk characters across iconic neighborhoods around the globe — while preserving the built-in Newton Centre (`565 Boylston St`) adventure 100% intact.

### Highlights

#### 1. 12 Global Regional Biomes, 4 Seasons & Local Quirks ([`src/biomes.js`](src/biomes.js), [`src/tileset.js`](src/tileset.js), [`src/world32bit.js`](src/world32bit.js))
- **12 Regional Biomes** (auto-detected from coordinates/country or selectable in Studio & CLI `--biome`):
  - **Israel (4 regions):** `israel_jerusalem` (Jerusalem Stone & Hills), `israel_coastal` (Tel Aviv Bauhaus & Palms), `israel_galilee` (Galilee Hills & Olives), `israel_desert` (Negev Desert).
  - **Global (8 regions):** `new_england_autumn`, `temperate_green`, `southwest_desert`, `tundra` (Arctic Snow), `alpine` (Alpine Mountain Village), `tropical_coastal` (Tropical & Island Coast), `european_historic` (Historic European Quarter), `east_asian_urban` (East Asian Town & Sakura).
- **4 Season Skins (`spring`, `summer`, `fall`, `winter`)** with hemisphere-aware auto-detection: snowy winters & ice rinks in snow-belt biomes, lush emerald hills & red *kalaniyot* wildflowers in Israeli winter, cherry/almond blossoms in spring, and autumn foliage/leaf piles in deciduous fall.
- **Local Architectural Quirks**: Old City of Jerusalem (`barrier=city_wall` stone fortifications & vaulted stone domes), Jerusalem Stone, Tel Aviv White City, and East Asian lanterns.
- **International Standards**: Generic **`Bilingual (English · Local)`** or **`English Only`** street & place labels (`--labels`), automatic left-hand vs. right-hand traffic by country, and Unicode-safe slugs + Israeli/European `<Street> <Number>` address parsing.

#### 2. Playful Regional Local Flair & 32-Bit Sidewalk Locals ([`src/local_flair.js`](src/local_flair.js), [`src/characters.js`](src/characters.js), [`src/streetlife.js`](src/streetlife.js))
- Added **17 affectionate, kid-friendly Local Flair profiles** (`paris_france`, `brooklyn_nyc`, `boston_new_england`, `jerusalem_israel`, `tel_aviv_israel`, `london_uk`, `italy_rome`, `tokyo_japan`, `seoul_korea`, `texas_southwest`, `mexico_latin`, `germany_alpine`, `nordic_arctic`, `california_tropical`, `new_orleans_jazz`, `european_classic`, `neighborhood_classic`).
- Peaceful **32-bit Friendly Locals** stroll sidewalks carrying cultural props (baguettes & espresso, folded NY pizza, matkot paddles, teacups & umbrellas, gelato, ramen, guitars, pretzels, brass trumpets, etc.) with city-specific quips, biker/jogger chants, and zero heart damage.
- **Biome & Flair-Specific Peaceful Marchers**: Sidewalk protestors wear region-appropriate outfits across all 12 biomes and flair cities and resolve peacefully by sharing a snack.
- **Regional Wildlife & Park Sports**: Adapts park courts (baseball, soccer, coastal beach, tennis, winter ice rinks) and playful wildlife across regions.

#### 3. Universal Pocket Prayer Book & Multi-Religion Houses of Worship ([`src/generator/poi_landmarks.js`](src/generator/poi_landmarks.js), [`src/items32bit.js`](src/items32bit.js))
- Discovers real OSM houses of worship across **8 respectful faith traditions** (Jewish, Christian, Muslim, Buddhist, Hindu, Sikh, Shinto, and Interfaith), each with warm hospitality treats, unique keepsake items, and the universal **`📖 Prayer Book (K)`** to calm spooky graveyard foes.
- Generalized emergency vehicles ([`src/vehicles32bit.js`](src/vehicles32bit.js)) to clean universal **`FIRE`**, **`POLICE`**, and **`EMS`** labels.

#### 4. Customizable Explorer Style (Hero Profiles) ([`src/characters.js`](src/characters.js), [`src/studio_ui.js`](src/studio_ui.js))
- Added gender-neutral Hero Profile customization in Studio Tab 1 & Tab 2: **4 Hair Styles**, **5 Hair Colors**, **4 Skin Tones**, and **5 Everyday Headwear options** (plus live Biome & Season switching in Tab 2), while keeping Liam's classic default intact for Newton Centre.

#### 5. Expanded Building Taxonomy, Precision Placement & Dense-City Resilience ([`src/generator/rasterizer.js`](src/generator/rasterizer.js), [`src/generator/osm_fetch.js`](src/generator/osm_fetch.js), [`src/streetsigns.js`](src/streetsigns.js))
- Expanded building taxonomy with **8 new municipal/civic/industrial kinds** (`police_station`, `post_office`, `city_hall`, `sanitation`, `hospital_clinic`, `transit_station`, `museum`, `industrial`) plus mosques & greenhouses, real OSM trees/tree rows, and building-facing metadata.
- Street signs now place strictly at road intersections; hardened precision placement invariants (zero road/door/building collisions).
- **Dense-City Resilience (Oslo fix)**: Prevented OOM on border-touching roads in `repairStreetConnectivity` and added automatic 2×2 tile subdivision when OSM API returns HTTP 400 on ultra-dense city blocks.

#### 6. Upgraded SNES HUD & Top-Center Build Crest ([`index.html`](index.html))
- Placed a prominent **`🌍 Build Neighborhood`** button in the top-center crest bar, upgraded SNES gold-bordered HUD plaques, and added **10 one-tap global city quick-start chips** in Studio Tab 1.
- Expanded cross-platform Node test coverage to **104 passing unit tests across 17 suites** (new suites: `international_biomes`, `batch_b_seasons_biomes`, `batch_c_heroes_wildlife`, `environment_placement`, `local_flair`).

---

## v1.0.0 — Universal Neighborhood Explorer Toolkit *(2026-11-27)*

Neighborhood Explorer became a **universal, any-address neighborhood RPG toolkit** — allowing families and colleagues to turn their own street and town into a playable 16-bit SNES exploration RPG in minutes, while preserving the original Newton Centre (`565 Boylston St`) game 100% intact as the built-in default.

### Highlights

#### 1. In-Browser "Build My Neighborhood" Studio *(Zero-Install, iPad & Desktop)*
- Added **🌍 Build Neighborhood** Studio ([`src/studio_ui.js`](src/studio_ui.js), [`index.html`](index.html)).
- **Build New Town (Tab 1)**: Enter any street address, kid's name, and map size (*Walkable ~1 mi*, *Standard ~1.4 mi*, or *Full Town ~1.9 mi*), optionally queue custom family stops, and build live from OpenStreetMap with a real-time progress bar.
- **Places & Goals Customizer (Tab 2)**: Add important custom places either **by street address** (geocoded automatically) or **right where your explorer is standing**, set custom NPC names/greetings/heart-healing snacks, and assemble custom multi-step quests.
- **My Towns & Share (Tab 3)**: Switch seamlessly between Built-in Newton Centre and any saved custom neighborhoods stored locally in IndexedDB ([`src/generator/pack_store.js`](src/generator/pack_store.js)), **Export** a portable `*_pack.json` bundle, or **Import** packs shared by family & colleagues.
- Added `?pack=<url>` and `?neighborhood=<id>` URL boot support in [`src/main.js`](src/main.js) for hosting or linking directly to custom neighborhood packs.
- Added editable-input keyboard guards in [`src/renderer.js`](src/renderer.js) and [`src/main.js`](src/main.js) so typing addresses/dialogue never triggers game movement or hotkeys on desktop or iPad Safari.

#### 2. One-Command CLI Neighborhood Packager
- Added `npm run create:neighborhood` ([`scripts/create_neighborhood.mjs`](scripts/create_neighborhood.mjs)) powered by the exact same shared pure-JS generator core as the browser Studio.
- Supports `--address`, `--lat`/`--lon`, `--hero`, `--town`, `--biome`, `--labels`, `--size walkable|standard|full`, `--width`/`--height`, `--scale`, `--places <file.json>`, `--out-dir`, `--overpass`, and `--offline-fixture`.
- Added starter template [`docs/examples/custom_places.example.json`](docs/examples/custom_places.example.json) showing how to configure custom family places, keepsake items, and quests.

#### 3. Shared Pure-JS Generator Engine (`src/generator/`)
- Extracted the entire 5-layer OpenStreetMap tile rasterizer, road smoother, sidewalk enforcer, building classifier, and map enricher into zero-dependency pure ESM ([`src/generator/rasterizer.js`](src/generator/rasterizer.js)) usable in both Node.js and browsers.
- Added pure-JS OpenStreetMap Nominatim geocoder ([`src/generator/geocode.js`](src/generator/geocode.js)) and tiled OSM API v0.6 + Overpass mirror fetcher with progress callbacks ([`src/generator/osm_fetch.js`](src/generator/osm_fetch.js)).
- Added automatic POI landmark & starter quest generator ([`src/generator/poi_landmarks.js`](src/generator/poi_landmarks.js)): automatically discovers real libraries, ice cream shops, bakeries, cafes, bookstores, parks, schools, fire stations, houses of worship, lakes/ponds, and cemeteries, guarantees all core RPG gear (Sword, Pocket Prayer Book, Running Shoes, Scooter, Outfits) is earnable in every town, and handles sparse areas gracefully.
- Added `extractGraveyardsFromOsm()` so any town's real OpenStreetMap cemeteries automatically render as spooky graveyards.

#### 4. Universal Engine & Isolated Per-Neighborhood Saves
- Added [`src/neighborhood_meta.js`](src/neighborhood_meta.js) to resolve town name, home address, hero name, preset (`newton` vs `generic`), and isolated `localStorage` keys per neighborhood (preserving existing Newton Centre saves and house paints).
- Guarded all Newton-specific map/park/graveyard overrides behind the `newton` preset across [`src/generator/rasterizer.js`](src/generator/rasterizer.js), [`src/graveyards.js`](src/graveyards.js), and [`src/parks.js`](src/parks.js).
- Generalized runtime copy, paper map header, Home Base interior rooms/dialogue, street life chants/toasts, dynamic item metadata, and snack-restocking landmarks across [`src/main.js`](src/main.js), [`src/ui.js`](src/ui.js), [`src/house_interior.js`](src/house_interior.js), [`src/quests.js`](src/quests.js), and [`src/streetlife.js`](src/streetlife.js).

---

## v0.1.0 — Newton Centre 16-Bit SNES RPG Foundation *(Prior Releases)*
- 4x HD curved vector roads (`src/vector_roads.js`) & 4px sub-cell sidewalk navigation (`src/subgrid.js`).
- 1-house-per-address OpenStreetMap buildings with 12 residential architectures & in-game Real House Color Painter (`P`).
- Interactive Home Base interior (Living Room & Kitchen, Secret Upstairs Reading Nook with Golden D20, 32-bit D&D Basement Dungeon with 3-switch puzzle & Bag of Holding).
- Active Street-Sign Wayfinding (`Signpost`, `Hard 45° Compass`, and `Easy / GPS Fast-Travel` modes) with A* turn-by-turn street directions.
- Kid-friendly civic street life (peaceful snack-sharing marchers, roving turkeys/squirrels/cats/runaway dogs, joggers, traffic safety cutscene) and spooky graveyards (East Parish 1660 & Newton Cemetery).
- Full WebGL + 4x HD HTML5 Canvas 2D fallback parity and zero-dependency Web Audio / ZzFX synthesized SFX.
