# **Neighborhood Explorer 16-Bit SNES RPG — Original Game Design Document (V3)**

> **Status Note:** This is the original V3 Game Design Document that launched the Newton Centre prototype. The live repository has since evolved into the **Universal Global 16-Bit SNES RPG Toolkit** (in-browser Studio, one-command CLI packager, 12 global regional biomes & 4 seasons, 17 playful regional Local Flair profiles, Hero Profiles, 20-kind building taxonomy, 4x HD curved vector roads, 4px sub-cell navigation, and 104 unit tests). For current setup, controls, CLI options, and architecture, see [`README.md`](../README.md), [`docs/TOOLKIT_GUIDE.md`](TOOLKIT_GUIDE.md), and [`RELEASE_NOTES.md`](../RELEASE_NOTES.md).

*Security & Environment Note: Keep this document strictly key-free and safe to share. Store any local dev server settings or optional third-party keys in a local `.env` file ignored by Git.*

---

# **1. Architecture & iPad Vibe-Coding Workflow**

The architecture is built for rapid, zero-friction prototyping on iPad using a 100% cloud-first workflow, while providing full cross-platform compatibility for local Windows PC collaborators.

* **100% Cloud-First, iPad-Only Vibe-Coding Core**: Zero local toolchain required on the iPad—no local Node.js, Python, or Git setup. All code editing, map generation, and dev servers run entirely in the cloud via **GitHub Codespaces** accessed through iPad Safari or SSH/Remote Control via iPad terminal apps (such as Blink Shell or Termius) driving `Antigravity CLI` (`agy`).
* **Instant Cloud Preview & Live Reload**: The dev server (`Vite`) runs inside the cloud container and automatically forwards a secure HTTPS preview URL directly to a split-screen iPad Safari tab. This provides instant touch playtesting with full Web Audio and virtual D-pad support without needing local compilation.
* **Optional Windows PC Friend Collaboration (Zero-Friction Hand-off)**: Standardized cross-platform configuration using `.devcontainer/devcontainer.json`, cross-platform npm scripts, and `cross-env` (avoiding Unix-only bash scripts). Pre-compiled `data/world_map.json` is committed directly to Git. A friend joining on a Windows PC can either join the cloud workspace via browser or `git clone` locally and run `npm install && npm run dev` with zero environment drift.
* **Browser-Based Kid Art & Content Workflow**: Kids can edit narrative content (`landmarks.json`, `quests.json`, `house_colors.json`) directly via GitHub's web editor (pressing `.` in GitHub on iPad), through the in-browser **Neighborhood Studio**, or through natural language Antigravity CLI prompts. Pixel art 16x16 PNG sprites can be drawn in web apps like **Piskel** or **Pixilart** on iPad without installing desktop software.
* **Game Engine & Rendering Core**: **Kaplay (WebGL)** with automatic **HTML5 2D Canvas fallback** (`src/renderer.js`) and `imageSmoothingEnabled = false`. The internal native canvas is locked to `320x180` (16:9 aspect ratio) with 2x HD 32-bit sprite/interior layers (`__pixelScale = 0.5`) and 4x HD curved vector roads, scaled crisply with `image-rendering: pixelated` to fit iPad Safari and desktop viewports seamlessly.

---

# **2. Real-World Map-to-Tile Pipeline (`world_map.json`)**

The conversion pipeline translates real geographic GPS coordinates into top-down 16x16 pixel RPG tile grids.

## **Step 1: Bounding Box & Projection**

Define a center coordinate (Home Base) and a bounding box (e.g., ~0.95 mi × 0.95 mi `256x256` walkable default for custom towns, up to ~1.9 mi × 1.9 mi `512x512` full town for Newton Centre). Convert latitude and longitude to local metric coordinates using an Equirectangular projection relative to the Home Base origin. Scale the metric grid such that 1 tile = `6×6` meters of real-world space (configurable via `--scale`; original prototype used `5×5` meters).

## **Step 2: Layer Rasterization**

Rasterize OSM vector features onto discrete tile grid layers using a strict priority order:

1. Water (`natural=water`, `waterway=riverbank`)
2. Parks & Greenery (`leisure=park`, `landuse=grass`, woods, dirt, sand)
3. Roads & Sidewalks (`highway=residential`, `highway=footway`, `highway=tertiary`, arterial & divided highways)
4. Pedestrian Crossings (`highway=crossing`)
5. Building Footprints (`building=*`) — **1-to-1 Per-Address Houses**: Preserve each OSM building polygon as an individual building record (`buildings[]` with `addr:housenumber`, `addr:street`, footprint `bounds`, architectural `arch`, and 20-kind `kind`) so every real street address renders as its own distinct house/building (1 house per address, never merged into generic uniform wall blocks).

## **Step 3: Street Metadata & Zone Tagging**

Assign real street names and road classifications (`sidewalk`, `residential`, `arterial`, `highway`, `crosswalk`) to walkable tiles, alongside `vectorRoads` polylines, `graveyards[]`, and `osmTrees[]`. This drives dynamic street name banners, safety audio triggers, intersection street signs, and pedestrian traffic rules without needing expensive spatial queries during runtime.

## **`world_map.json` Schema Example**

> *Note:* The live engine in `src/generator/rasterizer.js` extends the original 0–6 legend below with tile IDs `7` (`tall_grass`), `8` (`parking_lot`), `9` (`dirt`), `10` (`sand`), `11` (`park`), `12` (`highway`), and `13` (`highway_median`), plus `buildings[]`, `graveyards[]`, `osmTrees[]`, `vectorRoads`, and `meta`.

```json
{
  "tileSize": 16,
  "scaleMetersPerTile": 6,
  "origin": {
    "lat": 42.3192253,
    "lon": -71.1926696,
    "name": "Home Base (565 Boylston St)"
  },
  "dimensions": {
    "width": 64,
    "height": 64
  },
  "legend": {
    "0": "grass",
    "1": "sidewalk",
    "2": "residential_road",
    "3": "main_road",
    "4": "crosswalk",
    "5": "building_wall",
    "6": "water"
  },
  "layers": {
    "base": [
      0, 0, 0, 1, 1, 1, 0, 0,
      0, 0, 0, 1, 1, 1, 0, 0,
      2, 2, 2, 4, 4, 2, 2, 2,
      1, 1, 1, 1, 1, 1, 1, 1
    ],
    "collision": [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0
    ]
  },
  "streetZones": [
    {
      "name": "Elm Street",
      "type": "residential",
      "bounds": { "minX": 0, "maxX": 63, "minY": 10, "maxY": 14 }
    },
    {
      "name": "Maple Avenue",
      "type": "arterial",
      "bounds": { "minX": 25, "maxX": 30, "minY": 0, "maxY": 63 }
    }
  ]
}
```

---

# **3. Core Gameplay Loop, UI & Pedestrian Safety**

## **Home Base & Fog-of-War Paper Map**

Players begin each adventure at Home Base (`565 Boylston St` in the built-in Newton Centre map, or any real-world home address in custom towns). The world mini-map starts as a hand-folded paper map covered by fog-of-war. As the player walks through real-world streets and approaches local landmarks (such as Newton Free Library, Congregation Beth El-Atereth Israel, local baseball fields like Ward Field & Weeks Field, Oakdale Woods, friends' houses like the Salzberg House, and local bakery/ice cream spots), the map unrolls, revealing pixel icons, street names, and discovered secrets.

## **Street Name Banners & Intersection UI**

* **Street Banners**: Crossing into a new street zone triggers a 16-bit notification banner at the top-left of the screen displaying the street name and zone tag.
* **Interactive Signposts**: Interacting near street corners (`Space` / `E` / `Enter` or tapping **LOOK BOTH WAYS**) opens an intersection signpost overlay displaying cross-street blades, a cardinal compass, A* turn-by-turn street directions, and nearby landmarks.

```text
+-------------------------------------------------------+
|  [MAP ICON]  ELM STREET (Residential Zone)            | <-- Slide-in Street Banner
+-------------------------------------------------------+
```

## **Pedestrian Safety Mechanics**

* **Dedicated Travel & Safety Action Buttons (iPad Touch & Keyboard)**:
  * **⚡ FASTER (Hold / `Shift` or `B`)**: Speeds up travel on safe sidewalks, park paths, and cleared crosswalks (scales with Running Shoes → Scooter → Mountain Bike); stays at careful walking pace on unchecked streets.
  * **👀 LOOK BOTH WAYS (Tap / `Space` / `E` / `Enter`, or `L` to force Look)**: Triggers an explicit left → right head-turn animation with visual glance cues and safety chime. Using it at curbs or crosswalks activates a Safe Crossing state and awards Safety XP, turning real-world pedestrian safety into an active, rewarding button press.

| Road / Path Type | Tile Tag | Gameplay & Safety Mechanic | Reward / Feedback |
| :--- | :--- | :--- | :--- |
| **Sidewalks & Paths** | `sidewalk`, `park` | Free, high-speed movement. Standard traversal zone. | Baseline movement speed; safe zone. |
| **Quiet Streets** | `residential` | Stepping onto the street encourages checking with **Look Both Ways** before crossing. | "+Safety XP" floating toast + soft chime. |
| **Busy Main Roads / Highways** | `arterial`, `highway` | Direct mid-block crossing across divided highways is blocked by median barriers; traffic moves rapidly along vector lanes. | Guides player toward safe crosswalk routing. |
| **Crosswalks** | `crosswalk` | Look Both Ways at curb / WALK signal to cross safely between sidewalks. | **Safety XP**, safe crossing window, and clear visual feedback. |

---

# **4. Kid-Friendly Content Creation & No-Code Modding**

## **4.1 Zero-Syntax Ways Kids Can Add Content**

* **In-Browser "Build My Neighborhood" Studio *(Implemented)*:** Open **`🌍 Build Neighborhood`** in the top-center HUD crest (or `⚙️ Menu`) to build any town worldwide, switch biomes/seasons/hero styles, add custom places by street address or *right where your explorer is standing*, create custom multi-step quests, and export/import `.json` packs.
* **Live House Color Painter *(Implemented)*:** Press `P` (or `⚙️ Menu` → `🎨 Paint House`) near any real house to paint its siding, roof, and architecture style live and copy ready-to-paste `house_colors.json`.
* **JSON & Natural-Language Editing *(Implemented)*:** Kids can edit `data/landmarks.json`, `data/quests.json`, and `data/house_colors.json` directly in GitHub's web editor, use [`docs/examples/custom_places.example.json`](examples/custom_places.example.json) with `npm run create:neighborhood -- --places`, or describe ideas via Antigravity CLI prompts.
* **Future Co-Creation Ideas (Backlog)**:
  * Google Sheets / CSV "Quest & Neighbor Spreadsheet" importer.
  * Browser Pixel Art Stamp Pads (**Pixilart** / **Piskel**) and custom voice/mouth-sound recordings.
  * Real-world neighborhood scouting & photo-to-pixel missions.

## **`landmarks.json` Example**

```json
[
  {
    "id": "home_base",
    "name": "Player's House (565 Boylston St)",
    "tileX": 276,
    "tileY": 441,
    "sprite": "house_yellow",
    "discoveryXP": 0,
    "npcName": "Mom",
    "dialogue": [
      "Welcome back, Explorer!",
      "Step through the front door into our house to check the kitchen snack jar, outfit closet, bookshelf secrets, and D&D basement!"
    ],
    "rewardItem": "folded_map"
  },
  {
    "id": "newton_free_library",
    "name": "Newton Free Library",
    "tileX": 173,
    "tileY": 203,
    "sprite": "library_building",
    "discoveryXP": 50,
    "npcName": "Librarian Clara",
    "dialogue": [
      "Hello young reader! Check the outdoor pickup lockers and Little Free Library chest for rare book stamps!"
    ],
    "rewardItem": "library_card"
  }
]
```

## **`quests.json` Example**

```json
[
  {
    "id": "quest_01_first_steps",
    "tier": 1,
    "title": "Neighborhood Scout",
    "description": "Travel safely from Home Base through Newton Centre all the way to the Newton Free Library.",
    "steps": [
      {
        "stepIndex": 1,
        "instruction": "Head up to Newton Centre and grab a scoop at J.P. Licks (46 Langley Rd).",
        "targetLandmarkId": "jp_licks",
        "completionTrigger": "npc_talk"
      },
      {
        "stepIndex": 2,
        "instruction": "Continue northwest to find Librarian Clara at the Newton Free Library (330 Homer St).",
        "targetLandmarkId": "newton_free_library",
        "completionTrigger": "npc_talk"
      }
    ],
    "rewards": {
      "xp": 100,
      "coins": 25,
      "item": "running_shoes",
      "outfit": "wetsuit"
    }
  }
]
```

---

# **5. Classic 16-Bit Physics & Game Feel**

To replicate the polished feel of classic 16-bit titles like *The Legend of Zelda: A Link to the Past*, the core movement engine implements these micro-mechanics:

| System / Feature | Technical Implementation | Visual & Auditory Feedback |
| :--- | :--- | :--- |
| **Corner Sliding** | Sub-tile bounding box nudging (`src/player.js`, `src/subgrid.js`). If player moves into a wall within 4 pixels of an edge, velocity vector auto-slides around the obstacle. | Smooth cornering without getting stuck on 16x16 tile grid boundaries. |
| **8-Way Move / 4-Way Face** | Normalizes 8-directional vector inputs (`(vx, vy) / sqrt(2)`). Sprite rendering locks to 4 cardinal direction walk-cycles. | Character moves smoothly diagonally while maintaining clean 4-directional 16/32-bit animations and shadow offset. |
| **Tall Grass Rustle** | Overlapping particle sprite layer spawned when player moves inside `tall_grass` tiles. | Green leaf particle burst, rustle animation, chance of finding Lucky Acorns or Coins. |
| **Dash / Faster Travel** | Holding `Shift` / `B` / **⚡ FASTER** boosts travel speed on safe sidewalks, scaling with unlocked gear (Running Shoes → Scooter → Mountain Bike). | Dust puff particles and smooth speed scaling. |
| **Overhead Item Fanfare** | Interacting with major chests/quests triggers item fanfare banner and sound. | Chiptune arpeggio fanfare + overhead celebration. |
| **Ambient World Motion** | Global animator driving water ripples, swaying foliage, seasonal particles (autumn leaves, snowflakes, cherry blossoms, olive blossoms, desert motes), and roving street life. | Lively overworld atmosphere across all 12 biomes and 4 seasons. |

## **5.1 Audio & Retro Chiptune Sound Design**

All game audio is synthesized dynamically in real time using the **Web Audio API** and **ZzFX** (`src/audio.js`). This guarantees instantaneous loading, zero audio file dependencies, and true retro sound architecture.

* **Footsteps**: Soft noise burst with quick decay, pitch-shifted slightly between sidewalk and grass.
* **Street Banner Chime**: Dual-tone sine wave arpeggio (`E5 -> B5`).
* **Crosswalk / Look Both Ways**: Crisp retro safety confirmation tone.
* **Quest Item Fanfare**: 4-note arpeggio (`C5 -> E5 -> G5 -> C6`) using a classic pulse wave.
* **Character Voice Profiles**: Distinct retro voice blips per character archetype and interaction type.

---

# **6. Progression, Collectibles & Family Co-Op**

## **Traversal Equipment & Safety XP Progression**

Players earn **Safety XP** through safe road crossings, checking street signs, and neighborhood discovery.

```text
+------------------+     +-------------------+     +--------------------+
| RUNNING SHOES    |     | SCOOTER           |     | MOUNTAIN BIKE      |
| Unlocked: 100 XP | --> | Unlocked: 350 XP  | --> | Unlocked: 750 XP   |
| Speed: 1.3x      |     | Speed: 2.0x       |     | Speed: 2.5x        |
| Area: Sidewalks  |     | Area: Smooth Pave |     | Area: Park Trails  |
+------------------+     +-------------------+     +--------------------+
```

## **Secret Items & Neighborhood Easter Eggs**

1. **Secret Upstairs Attic / Hidden Reading Nook (Home Base) *(Implemented)*:** Inspecting the bookshelf inside Home Base reveals a cozy secret reading nook containing a **Golden D20**.
2. **D&D Basement Dungeon & Bag of Holding (Home Base) *(Implemented)*:** Descending into Home Base's 32-bit basement dungeon and solving the 3-switch puzzle rewards the **Bag of Holding**.
3. **Graveyard Sword & Pocket Prayer Book *(Implemented)*:** Earn the Graveyard Sword (`J`) and the universal Pocket Prayer Book (`K`) from local houses of worship (across 8 faith traditions) to bravely explore spooky cemeteries.
4. **Pogo Stick (Backlog):** Hidden traversal item behind the school gaga pit with rhythmic bouncing over low hedges.
5. **Backyard Trebuchet / Catapult Launch (Backlog):** Engineering blueprints mini-event at Ward Field.
6. **Mystery Puffin & Coastal Telescope (Backlog):** Hilltop viewfinder secret flyby stamp.
7. **The Spicy Cholent Power-Up (Backlog):** Temporary fiery dash speed boost at Kiddush.
8. **Golden Mizuno Glove & Home Run Derby (Backlog):** Timing-based batting mini-game at the baseball dugout.
9. **Konami / Retro Cheat Code on Virtual D-Pad (Backlog):** Entering `Up, Up, Down, Down, Left, Right, Left, Right, B, A` for a bonus cosmetic hero sprite.

## **Family Co-Design Roles**

Designed for collaborative building between kids and adults:

* 🗺️ **Map Architect (Adult / Older Kid)**: Picks the neighborhood in the in-browser Studio or runs `npm run create:neighborhood` / `scripts/build_map.mjs`.
* 🎨 **Pixel Artist (Kid)**: Paints real neighborhood house colors live with `P`, customizes Hero Profiles, or draws custom 16x16 PNG sprites in Piskel or Pixilart.
* 📜 **Quest Writer & Storyteller (Kid)**: Writes dialogue, creates riddles, and adds family places/quests in Studio Tab 2, `data/landmarks.json`, `data/quests.json`, or via natural language Antigravity CLI prompts.
* 📷 **Field Scout & Photographer (Kid)**: Goes on neighborhood walks with an iPad to scout real house colors, Little Free Libraries, unique trees, and street signs.
* 🔊 **Sound & Voice Designer (Kid)**: Designs retro chimes or records custom sound effects.
* 🧪 **Playtest Detective (Kid / Family)**: Tests control responsiveness on iPad Safari, checks safety triggers, and reports bugs or new feature ideas.

---

# **7. Phased Build Plan & Original Directory Structure**

> *Note:* All four original phases below are **complete** and expanded into the Universal Global Toolkit (see the full current module map in [`README.md`](../README.md)).

## **Original Core File Structure**

```text
neighborhood-explorer/
├── .devcontainer/
│   └── devcontainer.json   # Cloud Codespaces & Windows parity config
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages auto-deploy for instant sharing
├── AGENTS.md               # Rules for AI Vibe-Coding assistants
├── index.html              # Canvas container, HUD, modals & responsive iPad viewport setup
├── package.json            # Dev scripts (cross-platform) & server config
├── scripts/
│   ├── build_map.mjs       # Cross-platform Node.js ESM OSM map CLI (Newton default)
│   └── create_neighborhood.mjs # Universal any-address CLI packager
├── data/
│   ├── world_map.json      # Pre-compiled tile map, buildings & vector roads (checked into Git)
│   ├── landmarks.json      # Editable landmark locations & NPC text
│   ├── quests.json         # Editable multi-step quests & rewards
│   └── house_colors.json   # Real-world siding/roof/architecture overrides
└── src/                    # Core engine, renderer, biomes, Local Flair, Studio & pure-JS generator/
```

## **Original Execution Phases (All Completed)**

```text
+-------------------------------------------------------------------+
| PHASE 1: Greybox World & Map Pipeline                      [DONE] |
| • Run node scripts/build_map.mjs in cloud workspace / Actions     |
| • Commit pre-compiled data/world_map.json into Git                |
| • Render base tile grid & collision layer                         |
| • Implement 8-way player movement & diagonal corner sliding       |
+-------------------------------------------------------------------+
                                 │
                                 ▼
+-------------------------------------------------------------------+
| PHASE 2: 16-Bit Engine Polish, Touch UI & ZzFX Audio       [DONE] |
| • Integrate 16x16 pixel tilesets, grass rustle & dust particles   |
| • Add Web Audio / ZzFX dynamic sound effects                      |
| • Build responsive iPad virtual D-Pad and touch buttons           |
+-------------------------------------------------------------------+
                                 │
                                 ▼
+-------------------------------------------------------------------+
| PHASE 3: Content Systems & Folded Paper Map                [DONE] |
| • Load landmarks.json & quests.json content dynamically           |
| • Add item fanfare animations & dialogue textboxes                |
| • Implement fog-of-war Folded Paper Map overlay                   |
+-------------------------------------------------------------------+
                                 │
                                 ▼
+-------------------------------------------------------------------+
| PHASE 4: Safety Systems, Global Toolkit & Local Flair      [DONE] |
| • Enable dynamic street banners, signposts & traffic safety       |
| • Add 4x HD curved vector roads & 4px sub-cell navigation         |
| • Add In-Browser Studio, 12 global biomes, 4 seasons & Local Flair|
+-------------------------------------------------------------------+
```

---

# **8. Creative Backlog & Future Idea Bucket**

## **8.1 Visual & Artwork Style Options**

1. **16-Bit SNES Overworld (*A Link to the Past* / *Chrono Trigger*) *(Locked In & Implemented)*:** Crisp 16x16 base tiles with 2x HD 32-bit characters, buildings, props, and interiors.
2. **Seasonal & Regional Palette Swaps *(Implemented in `src/biomes.js` & `src/tileset.js`)*:** 12 global regional biomes and 4 hemisphere-aware seasons (Autumn Leaf-Pile, Snow Day Winter, Spring Blossom, Summer Green, plus Israel/Mediterranean, Desert, Arctic Tundra, Alpine, Tropical, European Historic, and East Asian styles).
3. **Paper Diorama / Hand-Drawn Sticker World (*Paper Mario* / *Yoshi's Crafted World*) *(Concept — see `styles.html`)*:** Flat top-down OpenStreetMap roads and parks rendered with subtle paper grain and white sticker borders.
4. **Cozy Game Boy Color / *Pokémon Gold & Silver* Nostalgia *(Concept — see `styles.html`)*:** Limited 4-color per-tile palettes.
5. **Chalk-on-Sidewalk & Notebook Doodle Style *(Concept — see `styles.html`)*:** Dark asphalt streets with pastel sidewalk-chalk lines and spiral-notebook UI borders.

## **8.2 Gameplay, Quest & Easter Egg Ideas**

1. **D&D Basement Portal *(Implemented in `src/house_interior.js`)*:** Inspecting Home Base's basement stairs leads into a 32-bit dungeon room where solving a 3-switch puzzle rewards the **Bag of Holding**.
2. **Home Base Outfit Closet & Hero Profiles *(Implemented in `src/house_interior.js`, `src/characters.js`, `src/studio_ui.js`)*:** Unlockable outfits (Polo, Little League Baseball, Summer Wetsuit, Hero of Hyrule) plus customizable hair style/color, skin tone, and headwear.
3. **Street-Sign Wayfinding & Stamp Logging *(Implemented in `src/streetsigns.js`)*:** Interactive green/blue/Jerusalem-stone street signs at every intersection with A* turn-by-turn street directions and first-visit XP stamps.
4. **The "No Raw Tomatoes" Food Critic Quest *(Backlog)*:** Rapid-fire ingredient-sorting mini-game at local food stops to earn a **Golden Falafel** stamina boost.
5. **Baby Sidekick / Front-Carrier Mode *(Backlog)*:** Unlock a **Trek Mountain Bike** upgrade where a tiny 1-year-old co-pilot rides in a front-mounted seat pointing at hidden acorns and shiny coins.
6. **The "Secret Shortcut" Aqueduct & Trail Network *(Backlog)*:** Discovering hidden trail markers in Oakdale Woods or along the Cochituate Aqueduct unlocks fast-travel tunnel pipes.
7. **Little League "Coach's Bucket" Mini-Game *(Backlog)*:** 15-second fielding drill at Ward Field or Weeks Field to catch pop-flies for bonus coins and a **Team Giants Cap** cosmetic.
