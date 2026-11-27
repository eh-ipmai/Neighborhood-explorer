# Neighborhood Explorer — Universal Toolkit & Colleague Handoff Guide

This guide explains everything you need to **build a custom Neighborhood Explorer game for your own town anywhere in the world** — whether you're a parent using an iPad with zero installs, a colleague forking this repo to host a permanent site for your kids, or a developer picking up where we left off to extend the engine.

---

## Table of Contents
1. [Quick Decision: Which Workflow Should I Use?](#1-quick-decision-which-workflow-should-i-use)
2. [Path A: Zero-Install In-Browser Studio (Recommended for Families)](#2-path-a-zero-install-in-browser-studio)
3. [Path B: One-Command CLI Packager + Permanent GitHub Pages Hosting](#3-path-b-one-command-cli-packager--permanent-github-pages-hosting)
4. [Adding Custom Family Places & Goals (`places.json`)](#4-adding-custom-family-places--goals)
5. [Sharing & Importing Neighborhood Packs (`.json`)](#5-sharing--importing-neighborhood-packs)
6. [Developer Handoff: Picking Up Where We Left Off](#6-developer-handoff-picking-up-where-we-left-off)
7. [Troubleshooting & OSM Rate-Limit Tips](#7-troubleshooting--osm-rate-limit-tips)

---

## 1. Quick Decision: Which Workflow Should I Use?

| Goal | Best Path | Time Needed | Tools Needed |
| :--- | :--- | :--- | :--- |
| Try your neighborhood right now on iPad/laptop | **Path A: In-Browser Studio** | ~1–2 minutes | Just a web browser |
| Give your kids a permanent custom URL (e.g. `https://you.github.io/our-town/`) | **Path B: Fork + CLI Packager** | ~5 minutes | GitHub account + Node.js 20+ (or GitHub Codespaces) |
| Share a town you built in the browser with relatives | **Export `.json` pack** (Path A → Tab 3) | 10 seconds | Any file share / AirDrop / email |

> **100% Shared Core:** Both the in-browser Studio and the CLI command execute the exact same pure-JS modules in `src/generator/`. A pack exported from the browser works in a forked repo, and a pack built by the CLI can be imported straight into the browser!

---

## 2. Path A: Zero-Install In-Browser Studio

1. Open the app in **iPad Safari**, Chrome, Firefox, or Edge.
2. Tap **`🌍 Build Neighborhood`** in the top-center crest bar (or open **`⚙️ Menu`** top-right → **`🌍 Build Neighborhood`**).
3. **Tab 1 — `🏗️ Build New Town`**:
   - **Starting Home Address**: Enter any full street address worldwide, e.g. `1204 Barton Springs Rd, Austin, TX`, `Emek Refaim 24, Jerusalem, Israel`, or `Rue de Rivoli, Paris, France` — or tap one of the **10 one-tap global city chips** (*Paris, Brooklyn, Jerusalem, Old City, Tel Aviv, London, Rome, Tokyo, Reykjavik, Austin*).
   - **Explorer (Kid's) Name**: Used in NPC greetings, outfits, and Home Base messages.
   - **Neighborhood Map Size**:
     - `Walkable (~1.5 km / 0.95 mi · 256×256)` — **Best default** (~20–40 seconds, great for dense neighborhoods & iPads).
     - `Standard (~2.3 km / 1.4 mi · 384×384)` — (~45–75 seconds).
     - `Full Town (~3.1 km / 1.9 mi · 512×512)` — (~1–2 minutes, matches the full Newton Centre scale).
   - **Regional Biome & Architecture**: Leave on `✨ Auto-Detect from Address` or choose any of the **12 world biomes** (*New England Autumn, Jerusalem Stone, Tel Aviv Coastal, Galilee Hills, Negev Desert, Temperate Green, Southwest Desert, Arctic Tundra, Alpine Village, Tropical Coast, European Quarter, East Asian Town*).
   - **Season Skin**: Leave on `✨ Auto-Detect from Date & Geography` (hemisphere-aware!) or pick **Spring Blossom**, **Summer Green**, **Autumn Foliage**, or **Winter Season**.
   - **Street & Place Language**: Choose **`🌐 Bilingual (English · Local)`** or **`🇬🇧 English Only`**.
   - **Explorer Style**: Customize **Hair Style** (4), **Hair Color** (5), **Skin Tone** (4), and **Everyday Headwear** (5) with gender-neutral outfits.
   - **Optional Custom Places**: Before building, queue places like *Grandma's House*, *My School*, or *Best Friend's House* with their street address and NPC name.
   - Click **`🚀 Build My Neighborhood`** and watch the live progress bar!
4. **What gets built automatically**:
   - Real OpenStreetMap roads (curved 4x HD vector asphalt, regional curbs, lane dividers, crosswalks, divided highways, cul-de-sacs, left/right-hand traffic) and sidewalks.
   - 1-to-1 per-address houses (12 residential architectural styles + regional stonework/roofs/snow) and a 20-kind municipal/commercial/civic building taxonomy (libraries, schools, fire/police stations, post offices, city halls, hospitals/clinics, transit stations, museums, bakeries, cafes, markets, greenhouses, industrial).
   - Real parks with region-appropriate sports courts (baseball, soccer, beach courts, tennis, winter ice rinks) and playgrounds, real OSM trees, and local architectural quirks (such as Old City of Jerusalem stone walls & vaulted domes).
   - Real OSM cemeteries automatically converted into spooky graveyard grounds (tombstones, ghosts, skeletons, lanterns).
   - Playful **Local Flair** 32-bit Friendly Locals with cultural props, regional wildlife, and biome-specific peaceful sidewalk marchers.
   - Auto-discovered local landmarks (libraries, ice cream shops, bakeries, cafes, bookstores, parks, schools, fire stations, multi-faith houses of worship across 8 traditions with keepsakes & the universal Pocket Prayer Book, lakes/ponds) + 3–5 tailored multi-step starter quests.
   - Isolated browser save slot so your kid's progress in each neighborhood never collides with Newton Centre or other saved towns!
5. **Tab 2 — `📍 Places & Goals`**:
   - **Switch Regional Biome & Season** live anytime without re-downloading OSM data.
   - **Customize Explorer Style** (hair, skin tone, headwear) live anytime.
   - Add more important places anytime — either **by Street Address** (geocoded automatically) or **Right Where I'm Standing** (walk/fast-travel to a secret treehouse or favorite corner and drop an NPC right there!).
   - Build custom multi-step goals/quests by typing a title and checking 1–3 destination places.
   - Remove any auto-discovered or custom place you don't want (Home Base is protected).
6. **Tab 3 — `📦 My Towns & Share`**:
   - Switch instantly between **Built-in Newton Centre** and every custom neighborhood stored in IndexedDB.
   - Tap **`💾 Export Current Town (.json)`** to download a single self-contained `*_pack.json` file.
   - Tap **`📥 Import Town Pack (.json)`** on another iPad or computer to load someone else's town in 1 second!

---

## 3. Path B: One-Command CLI Packager + Permanent GitHub Pages Hosting

Ideal for colleagues who want to fork this repo and publish a dedicated permanent web app for their family.

### Step 1: Fork & Clone
1. Click **Fork** on GitHub (or clone this repo).
2. Open in **GitHub Codespaces** (works on iPad!) or locally on Windows/macOS/Linux with Node.js 20+:
   ```bash
   npm install
   ```

### Step 2: Generate Your Neighborhood
Run the cross-platform packager:
```bash
npm run create:neighborhood -- \
  --address "1204 Barton Springs Rd, Austin, TX" \
  --hero "Maya" \
  --size walkable
```

#### All CLI Options
| Flag | Description | Default |
| :--- | :--- | :--- |
| `--address "<str>"` | Starting Home Base street address (geocoded via OpenStreetMap Nominatim) | *(required unless `--lat/--lon`)* |
| `--lat <num> --lon <num>` | Explicit GPS coordinates (skips Nominatim lookup) | — |
| `--hero "<name>"` | Kid / explorer name | `"Explorer"` |
| `--town "<name>"` | Override town display name (e.g. `"Austin, TX"`) | Auto from Nominatim |
| `--biome <id\|auto>` | Regional biome preset (`auto`, `new_england_autumn`, `israel_jerusalem`, `israel_coastal`, `israel_galilee`, `israel_desert`, `temperate_green`, `southwest_desert`, `tundra`, `alpine`, `tropical_coastal`, `european_historic`, `east_asian_urban`) | `auto` |
| `--labels <mode>` | Street & place label mode (`bilingual`, `en`, or `local`) | `bilingual` |
| `--size <preset>` | `walkable` (256×256), `standard` (384×384), or `full` (512×512) | `walkable` |
| `--width <n> --height <n>` | Custom tile dimensions (overrides `--size`) | From `--size` |
| `--scale <meters>` | Real-world meters per 16px tile | `6` |
| `--places <file.json>` | Path to custom places & quests JSON file | — |
| `--out-dir <dir>` | Output directory (`data` replaces default town; e.g. `packs/austin` keeps Newton intact) | `data` |
| `--overpass` | Prefer Overpass API mirrors instead of tiled OSM API v0.6 | `false` |
| `--offline-fixture <file>` | Build from a saved local OSM JSON file (no network required) | — |

This writes 5 clean files to `--out-dir`:
- `world_map.json` — Tile grid, collision, `buildings[]`, `streetZones[]`, `graveyards[]`, `osmTrees[]`, `vectorRoads`, and `meta`.
- `landmarks.json` — Kid-editable list of all stops, NPCs, dialogue, and rewards.
- `quests.json` — Kid-editable multi-step missions.
- `house_colors.json` — Real-world siding/roof color overrides (paint live in-game with `P`!).
- `neighborhood_pack.json` — Single-file portable bundle compatible with Studio Import & `?pack=`.

### Step 3: Playtest & Customize
```bash
npm run dev
```
Open `http://localhost:5173` (or the Codespaces HTTPS preview URL on iPad):
- Walk around in **Easy / GPS Mode (`G`)** to fast-travel by tapping anywhere on the Folded Paper Map (`M`).
- Press **`P`** near real houses on your street to paint their actual colors, then copy the JSON into `data/house_colors.json`.
- Edit `data/landmarks.json` or `data/quests.json` directly (even on GitHub's web editor!) to refine dialogue, add jokes, or tweak rewards.

### Step 4: Deploy to GitHub Pages (Automatic!)
1. In your forked repository on GitHub, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
2. Commit & push your `data/` folder:
   ```bash
   npm test && npm run build
   git add data/
   git commit -m "Build custom neighborhood for Austin, TX"
   git push origin main
   ```
3. The included workflow (`.github/workflows/deploy.yml`) automatically runs tests, builds `dist/`, and publishes your live site!

> **Note on existing Newton-specific tests when replacing `data/` in a fork:** Several legacy unit tests in `tests/` (e.g., `phase4_realism.test.mjs`, `gameplay_mechanics.test.mjs`) assert against Newton Centre's `data/world_map.json` & `data/landmarks.json`. If you replace `data/` in your own fork with another city, you can either:
> - Keep `data/` as Newton and host your town in `data/packs/my_town_pack.json` + link kids to `https://your-site/?pack=./data/packs/my_town_pack.json` (all 104 tests stay green!), **or**
> - Run the universal test suites (`node --test tests/universal_engine.test.mjs tests/neighborhood_generator.test.mjs tests/pack_builder_store.test.mjs tests/international_biomes.test.mjs tests/batch_b_seasons_biomes.test.mjs tests/batch_c_heroes_wildlife.test.mjs tests/local_flair.test.mjs tests/phase1.test.mjs tests/vector_roads.test.mjs`) in your fork's workflow.

---

## 4. Adding Custom Family Places & Goals

Copy [`docs/examples/custom_places.example.json`](examples/custom_places.example.json) and customize it with your own addresses:

```json
{
  "places": [
    {
      "id": "grandmas_house",
      "name": "Grandma's House",
      "address": "42 Oak Street",
      "npcName": "Grandma",
      "healHearts": 5,
      "givesSnacks": true,
      "dialogue": [
        "Hi Maya! I baked warm cookies for your adventure!",
        "All your hearts are restored and your snack pocket is full!"
      ],
      "rewardItem": "grandmas_cookie_tin",
      "rewardItemMeta": {
        "name": "Grandma's Cookie Tin",
        "icon": "🍪",
        "sprite": "item_challah",
        "desc": "Warm chocolate chip cookies from Grandma's kitchen!"
      }
    }
  ],
  "quests": [
    {
      "title": "Cookies at Grandma's",
      "description": "Use the street signs to navigate safely to Grandma's House!",
      "targetPlaceIds": ["grandmas_house"],
      "rewards": {
        "xp": 150,
        "coins": 50,
        "item": "running_shoes",
        "outfit": "baseball"
      }
    }
  ]
}
```

Then pass `--places my_places.json` to `npm run create:neighborhood`. Any place with an `address` (and no `lat`/`lon`) is automatically geocoded with your town name appended!

---

## 5. Sharing & Importing Neighborhood Packs

Every neighborhood pack is a single standard JSON file (`formatVersion: 1`):
```json
{
  "formatVersion": 1,
  "meta": {
    "id": "1204_barton_springs_rd_austin_tx",
    "preset": "generic",
    "townName": "Austin, TX",
    "cityShort": "Austin",
    "homeAddress": "1204 Barton Springs Rd",
    "heroName": "Maya",
    "heroProfile": {
      "hairStyle": "ponytail",
      "hairColor": "dark_brown",
      "skinTone": "warm",
      "headwear": "cap",
      "tzitzit": false
    },
    "countryCode": "us",
    "drivingSide": "right",
    "labelMode": "bilingual",
    "biome": "temperate_green",
    "season": "fall",
    "quirks": [],
    "localFlair": "texas_southwest",
    "generatedAt": "2026-11-27T00:00:00.000Z"
  },
  "worldMap": { "...": "tile layers, buildings[], streetZones[], graveyards[], osmTrees[], vectorRoads" },
  "landmarks": [ "..." ],
  "quests": [ "..." ],
  "houseColors": { }
}
```

**Three ways to share a pack:**
1. **Direct file import**: Export `.json` from Studio → AirDrop/email → Import `.json` in Studio on another device.
2. **Hosted URL parameter**: Place the `.json` file inside `data/packs/` on any static host (GitHub Pages, Netlify, S3) and open `https://your-site/?pack=./data/packs/austin_pack.json` — it automatically loads, caches in IndexedDB, and plays!
3. **Commit as default town**: Extract `worldMap`, `landmarks`, `quests`, `houseColors` into `data/` (or generate with `--out-dir data`).

---

## 6. Developer Handoff: Picking Up Where We Left Off

### Architecture Overview
The universal generator pipeline lives in `src/generator/` and is **strictly pure ESM with zero Node-only imports** so Vite bundles it directly for browsers while Node runs it natively for CLI & tests:

1. **`src/neighborhood_meta.js`**
   - Single source of truth for resolving `{ id, preset, isNewton, townName, cityShort, homeAddress, heroName, heroProfile, countryCode, drivingSide, labelMode, biome, season, quirks, biomeConfig, localFlairId, localFlair, saveStorageKey, houseColorsStorageKey }`.
   - Backward-compatible: maps without `worldMap.meta` near `(42.3192, -71.1927)` resolve as `preset: "newton"` with legacy `localStorage` keys (`neighborhood_explorer_save_v1`) and Liam's classic default Hero Profile. Every custom town gets an isolated save slot and Unicode-safe slug.
2. **`src/biomes.js`**
   - Defines all **12 world biomes**, **4 seasons** (with Northern/Southern hemisphere auto-detection and realistic regional winter behavior), **local quirks** (`jerusalem_old_city`, `jerusalem_stone`, `tel_aviv_white_city`, `east_asian_lanterns`), left-hand vs. right-hand driving countries, and bilingual/international name & address formatters.
3. **`src/local_flair.js`**
   - Defines **17 playful regional cultural profiles** (Paris, Brooklyn, Boston/New England, Jerusalem, Tel Aviv, London, Rome, Tokyo, Seoul, Texas, Mexico, Germany/Alpine, Nordic/Arctic, California/Tropical, New Orleans, European Classic, Neighborhood Classic) driving 32-bit Friendly Locals with held cultural props, regional protestor outfits, and local sidewalk/biker/jogger chants.
4. **`src/generator/geocode.js`**
   - OpenStreetMap Nominatim search wrapper + US state abbreviation normalizer & country code detection. Automatically omits custom `User-Agent` header in browsers (where browsers forbid it) and includes it in Node.
5. **`src/generator/osm_fetch.js`**
   - Downloads raw OpenStreetMap elements via tiled **OSM API v0.6** (`api.openstreetmap.org/api/0.6/map.json`), automatically **subdividing dense tiles 2×2 on HTTP 400** (for dense historic cities like Oslo or Paris), with automatic fallback to chunked **Overpass API** mirrors (`overpass-api.de`, `overpass.kumi.systems`, `maps.mail.ru`) and live `onProgress` callbacks.
6. **`src/generator/rasterizer.js`**
   - Complete 5-layer OSM-to-tile rasterizer (`Water → Parks/Woods/Sand/Dirt → Roads/Sidewalks → Crosswalks → Per-Address Buildings`), 20-kind building taxonomy, road smoothing/connectivity repair (hardened against border-road OOM), continuous sidewalk enforcement, highway median barriers, `barrier=city_wall`, real OSM trees (`osmTrees[]`), `extractGraveyardsFromOsm()`, `extractVectorRoadsFromOsm()`, and `enrichWorldMap()`.
   - All Newton-specific tweaks are cleanly guarded behind `isNewtonPreset`.
7. **`src/generator/poi_landmarks.js`**
   - Scans OSM nodes/ways + `worldMap.graveyards[]` across kid-friendly POI categories (`library`, `ice_cream_bakery`, `park`, `bookstore`, `fire_station`, `school`, `house_of_worship`, `water`, `graveyard`, `food_shop`, `civic`), supports **8 respectful faith traditions** (`FAITH_TRADITIONS`) with keepsake items & the universal Pocket Prayer Book (`pocket_siddur`), merges user `customPlaces[]`, guarantees `graveyard_sword` + Prayer Book are earnable, and builds 3–5 balanced starter quests.
8. **`src/generator/pack_builder.js`**
   - Orchestrates the full end-to-end build (`buildNeighborhoodPackage`), validates imported packs (`validateNeighborhoodPack`), and provides immutable editors (`addCustomPlaceToPack`, `removePlaceFromPack`, `addCustomQuestToPack`).
9. **`src/generator/pack_store.js`**
   - IndexedDB storage (`neighborhood_explorer_packs_v1`) supporting multi-megabyte neighborhoods on iPad Safari & desktop, with an in-memory fallback for headless tests and private browsing.
10. **`src/studio_ui.js`**
    - Wires the `#studio-modal` 3-tab UI in `index.html` (opened from the top-center `🌍 Build Neighborhood` crest or `⚙️ Menu`), handles 10 quick-start city chips, live Biome/Season & Hero Profile switching, live progress rendering, editable-focus keyboard guarding (`isEditableElementFocused`), and `.json` download/upload.

### Great Next Ideas for Contributors
If you're picking up the repo to push the toolkit even further, here are clean, high-impact next steps:
- **Interactive Map-Tap Pin Picker in Studio**: Show a mini preview of the Paper Map inside Tab 2 (`Places & Goals`) so parents can tap directly on a street corner to drop a custom place without typing an address or walking there first.
- **Web Worker Offloading**: Run `rasterizeOsmData()` + `enrichWorldMap()` inside a Web Worker in the browser so 512×512 full-town builds keep UI animations silky-smooth at 60 FPS during rasterization.
- **GitHub Actions "Build My Town" Workflow Dispatch**: Add a `workflow_dispatch` GitHub Action with `address`, `hero`, `biome`, `season`, and `size` inputs so non-technical colleagues who fork the repo can generate and deploy their town purely from GitHub's web UI without even opening a terminal!
- **CLI `--season` & `--hero-style` Flags**: Expose season and hero profile customization flags on `scripts/create_neighborhood.mjs` (already supported in `pack_builder.js` and the browser Studio).

### Running Tests Before Committing
```bash
npm test && npm run build
```
All **104 unit tests** (17 suites) run cross-platform with Node's built-in test runner (`node --test tests/*.test.mjs`) with zero external test dependencies.

---

## 7. Troubleshooting & OSM Rate-Limit Tips

- **"OSM API tile returned HTTP 429 / 509" or Overpass timeout**:
  - Public OpenStreetMap servers rate-limit rapid back-to-back builds of large 512×512 areas.
  - **Fix**: Start with `--size walkable` (`256×256`, only 9 tiles instead of 25!), wait 1–2 minutes between large builds, or pass `--overpass` on the CLI to use Overpass mirrors directly.
- **"Could not find address" during geocoding**:
  - Include full street, city, and state/country (e.g. `1204 Barton Springs Rd, Austin, TX` or `Emek Refaim 24, Jerusalem, Israel`). Avoid apartment/unit numbers (`Apt 2B`).
- **Sparse suburbs or brand-new developments**:
  - OpenStreetMap coverage varies by area. If a neighborhood has few named POIs, `poi_landmarks.js` automatically generates 3 scenic fallback landmarks so quests always work — and you can add your real favorite spots anytime in **Studio → Places & Goals**!
- **WebGL disabled (iPad Lockdown Mode / VS Code Simple Browser)**:
  - Handled automatically! `src/renderer.js` seamlessly runs our 4x HD Canvas 2D renderer with full parity.
