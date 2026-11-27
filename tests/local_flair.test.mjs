import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCAL_FLAIR_PROFILES,
  detectLocalFlair,
  getLocalFlairProfile,
} from "../src/local_flair.js";
import {
  PROTESTOR_BIOME_STYLES,
  resolveProtestorOutfitStyle,
  bake32BitLocalRight,
  bake32BitStreetLifeSprites,
} from "../src/characters.js";
import {
  buildStreetLife,
  updateStreetLife,
  findNearbyStreetLife,
  interactWithStreetLife,
  checkStreetLifeContact,
} from "../src/streetlife.js";
import { getNeighborhoodMeta } from "../src/neighborhood_meta.js";
import { generateLandmarksAndQuests } from "../src/generator/poi_landmarks.js";
import { BIOME_PRESETS } from "../src/biomes.js";

function installMockCanvasDom() {
  if (typeof globalThis.document !== "undefined") return () => {};
  const prevDoc = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      if (tag !== "canvas") return {};
      const calls = [];
      return {
        width: 0,
        height: 0,
        _calls: calls,
        getContext() {
          return {
            imageSmoothingEnabled: false,
            fillStyle: "",
            fillRect(x, y, w, h) {
              calls.push([x, y, w, h, this.fillStyle]);
            },
            beginPath() {},
            ellipse() {},
            fill() {},
            save() {},
            restore() {},
            translate() {},
            scale() {},
            drawImage() {},
          };
        },
      };
    },
  };
  return () => {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  };
}

function makeCityMap({
  lat,
  lon,
  countryCode,
  townName,
  cityShort,
  homeAddress,
  biome = "european_historic",
} = {}) {
  const width = 48;
  const height = 48;
  const base = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);

  // Horizontal & vertical avenues with clear 1-tile sidewalks
  for (let x = 2; x < width - 2; x++) {
    base[24 * width + x] = 2;
    base[23 * width + x] = 1;
    base[25 * width + x] = 1;
  }
  for (let y = 2; y < height - 2; y++) {
    base[y * width + 24] = 2;
    if (base[y * width + 23] === 0) base[y * width + 23] = 1;
    if (base[y * width + 25] === 0) base[y * width + 25] = 1;
  }

  return {
    tileSize: 16,
    scaleMetersPerTile: 6,
    dimensions: { width, height },
    origin: {
      lat,
      lon,
      name: `Home Base (${homeAddress})`,
      address: homeAddress,
      spawnTile: { x: 20, y: 23 },
    },
    mapCenter: { lat, lon },
    meta: {
      preset: "generic",
      countryCode,
      townName,
      cityShort,
      homeAddress,
      biome,
      heroName: "Maya",
    },
    layers: { base, collision },
    buildings: [],
    streetZones: [],
  };
}

test("detectLocalFlair accurately identifies Paris, Brooklyn, London, Rome, Tokyo, Jerusalem, Texas, Mexico, Nordic & New Orleans", () => {
  assert.equal(
    detectLocalFlair({ lat: 48.8566, lon: 2.3522, countryCode: "fr", townName: "Paris, France", address: "Rue de Rivoli" }),
    "paris_france"
  );
  assert.equal(
    detectLocalFlair({ lat: 40.6694, lon: -73.9422, countryCode: "us", townName: "Brooklyn, NY", address: "Eastern Parkway" }),
    "brooklyn_nyc"
  );
  assert.equal(
    detectLocalFlair({ lat: 40.7081, lon: -73.9571, countryCode: "us", townName: "Williamsburg, Brooklyn", address: "Bedford Ave" }),
    "brooklyn_nyc"
  );
  assert.equal(
    detectLocalFlair({ lat: 51.5237, lon: -0.1585, countryCode: "gb", townName: "London, UK", address: "221B Baker St" }),
    "london_uk"
  );
  assert.equal(
    detectLocalFlair({ lat: 41.9028, lon: 12.4964, countryCode: "it", townName: "Rome, Italy", address: "Via del Corso" }),
    "italy_rome"
  );
  assert.equal(
    detectLocalFlair({ lat: 35.7148, lon: 139.7967, countryCode: "jp", townName: "Tokyo, Japan", address: "Asakusa" }),
    "tokyo_japan"
  );
  assert.equal(
    detectLocalFlair({ lat: 37.5665, lon: 126.978, countryCode: "kr", townName: "Seoul, South Korea", address: "Hongdae" }),
    "seoul_korea"
  );
  assert.equal(
    detectLocalFlair({ lat: 31.7634, lon: 35.2179, countryCode: "il", townName: "Jerusalem, Israel", address: "Emek Refaim 24", biomeId: "israel_jerusalem" }),
    "jerusalem_israel"
  );
  assert.equal(
    detectLocalFlair({ lat: 32.0809, lon: 34.774, countryCode: "il", townName: "Tel Aviv, Israel", address: "24 Dizengoff St", biomeId: "israel_coastal" }),
    "tel_aviv_israel"
  );
  assert.equal(
    detectLocalFlair({ lat: 30.2672, lon: -97.7431, countryCode: "us", townName: "Austin, TX", address: "1204 Barton Springs Rd" }),
    "texas_southwest"
  );
  assert.equal(
    detectLocalFlair({ lat: 19.4326, lon: -99.1332, countryCode: "mx", townName: "Mexico City, Mexico", address: "Zocalo" }),
    "mexico_latin"
  );
  assert.equal(
    detectLocalFlair({ lat: 48.1351, lon: 11.582, countryCode: "de", townName: "Munich, Germany", address: "Marienplatz" }),
    "germany_alpine"
  );
  assert.equal(
    detectLocalFlair({ lat: 64.1466, lon: -21.9426, countryCode: "is", townName: "Reykjavik, Iceland", address: "Laugavegur 22", biomeId: "tundra" }),
    "nordic_arctic"
  );
  assert.equal(
    detectLocalFlair({ lat: 29.9584, lon: -90.0644, countryCode: "us", townName: "New Orleans, LA", address: "Royal St" }),
    "new_orleans_jazz"
  );
  assert.equal(
    detectLocalFlair({ lat: 42.3192, lon: -71.1927, countryCode: "us", townName: "Newton Centre", preset: "newton" }),
    "boston_new_england"
  );
});

test("Every Local Flair profile bakes crisp 32-bit Friendly Local sprites, props, speech bubbles & flair protestor outfits", () => {
  const cleanup = installMockCanvasDom();
  try {
    const signatures = new Set();
    for (const [flairId, profile] of Object.entries(LOCAL_FLAIR_PROFILES)) {
      assert.equal(profile.locals.length, 3, `${flairId} must define 3 distinct local archetypes`);
      assert.ok(profile.localBubbles.length >= 5, `${flairId} must define >= 5 local bubbles`);
      assert.ok(profile.protestChants.length >= 8, `${flairId} must define >= 8 protest chants`);
      assert.ok(profile.bikerChants.length >= 5, `${flairId} must define >= 5 biker chants`);
      assert.ok(profile.joggerChants.length >= 5, `${flairId} must define >= 5 jogger chants`);
      assert.ok(PROTESTOR_BIOME_STYLES[profile.protestStyleId], `${flairId} protestStyleId must exist`);

      const sprites = bake32BitStreetLifeSprites(profile.protestChants, {
        biomeConfig: BIOME_PRESETS.european_historic,
        season: "fall",
        localFlair: profile,
        bikerChants: profile.bikerChants,
        joggerChants: profile.joggerChants,
        heroName: "Maya",
        cityShort: "City",
      });

      for (let v = 0; v < 3; v++) {
        for (const dir of ["right", "left"]) {
          for (const frame of ["0", "1", "eat"]) {
            const spr = sprites[`local_${v}_${dir}_${frame}`];
            assert.ok(spr, `missing ${flairId} local_${v}_${dir}_${frame}`);
            assert.equal(spr.width, 48);
            assert.equal(spr.height, 64);
          }
        }
      }
      for (let b = 0; b < 5; b++) {
        assert.ok(sprites[`bubble_local_${b}`], `missing ${flairId} bubble_local_${b}`);
        assert.ok(sprites[`bubble_jogger_${b}`], `missing ${flairId} bubble_jogger_${b}`);
      }
      const colors = [...new Set(sprites.local_0_right_eat._calls.map((c) => c[4]))].sort().join(",");
      signatures.add(`${flairId}:${colors}`);
    }
    assert.equal(signatures.size, Object.keys(LOCAL_FLAIR_PROFILES).length);

    // Explicitly verify Brooklyn Hasidic neighbor & Parisian baguette stroller render distinctly!
    const parisSpr = bake32BitLocalRight(LOCAL_FLAIR_PROFILES.paris_france.locals[0], 2);
    const brooklynHasidicSpr = bake32BitLocalRight(LOCAL_FLAIR_PROFILES.brooklyn_nyc.locals[0], 2);
    assert.ok(parisSpr._calls.some((c) => c[4] === "#c92a35"), "Parisian should wear iconic red beret");
    assert.ok(parisSpr._calls.some((c) => c[4] === "#f2c266"), "Parisian should carry golden crusty baguette");
    assert.ok(brooklynHasidicSpr._calls.some((c) => c[4] === "#1e212b"), "Brooklyn Hasidic neighbor should wear black bekishe coat");
    assert.ok(brooklynHasidicSpr._calls.some((c) => c[4] === "#f4d35e"), "Brooklyn Hasidic neighbor should hold gold-trimmed sefer");

    assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.european_historic, "fall", "paris_france"), "paris_france");
    assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.new_england_autumn, "fall", "brooklyn_nyc"), "brooklyn_nyc");
    assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.european_historic, "fall", "london_uk"), "london_uk");
  } finally {
    cleanup();
  }
});

test("Paris & Brooklyn maps spawn peaceful Friendly Locals with iconic chants, quips, zero heart damage, and flair POIs", () => {
  const parisMap = makeCityMap({
    lat: 48.8566,
    lon: 2.3522,
    countryCode: "fr",
    townName: "Paris, France",
    cityShort: "Paris",
    homeAddress: "10 Rue de Rivoli",
    biome: "european_historic",
  });
  const parisMeta = getNeighborhoodMeta(parisMap);
  assert.equal(parisMeta.localFlairId, "paris_france");

  const parisStreet = buildStreetLife(parisMap);
  assert.equal(parisStreet.localFlairId, "paris_france");
  assert.ok(parisStreet.locals.length >= 3, "Paris should spawn friendly sidewalk locals");
  assert.ok(parisStreet.localChants.includes("FRESH BAGUETTES!"));
  assert.ok(parisStreet.bikerChants.includes("TOUR DE FRANCE!!"));
  assert.ok(parisStreet.locals.some((l) => l.archetype === "parisian_baguette"));
  assert.ok(parisStreet.locals.some((l) => l.heldProp === "baguette_coffee"));

  // Friendly locals NEVER hurt the player and greet warmly when interacted with!
  const loc = parisStreet.locals[0];
  const player = { x: loc.x + 4, y: loc.y, facing: "left", hearts: 5, maxHearts: 5, hurtTimer: 0 };
  const contact = checkStreetLifeContact(parisStreet, player);
  assert.equal(contact, null, "Friendly sidewalk locals must NEVER deal heart damage");

  updateStreetLife(parisStreet, 0.5, player, parisMap, {});
  assert.equal(player.hearts, 5);
  assert.ok(loc.bubbleTimer > 0, "Approaching a Parisian local should pop a local speech bubble");

  const nearby = findNearbyStreetLife({ ...parisStreet, protestors: [], critters: [], turkeys: [], spookyChars: [] }, loc.x + 8, loc.y, 26);
  assert.equal(nearby?.kind, "local");
  const res = interactWithStreetLife(parisStreet, nearby, loc.x + 8, loc.y, {});
  assert.equal(res.kind, "local");
  assert.equal(res.xpReward, 5, "First greeting with a local awards +5 XP");
  assert.ok(res.toast.includes(loc.roleName));

  // Brooklyn map spawns Hasidic, Williamsburg hipster & classic Brooklyn pizza/bagel locals!
  const bkMap = makeCityMap({
    lat: 40.6694,
    lon: -73.9422,
    countryCode: "us",
    townName: "Brooklyn, NY",
    cityShort: "Brooklyn",
    homeAddress: "770 Eastern Parkway",
    biome: "new_england_autumn",
  });
  const bkStreet = buildStreetLife(bkMap);
  assert.equal(bkStreet.localFlairId, "brooklyn_nyc");
  assert.ok(bkStreet.locals.some((l) => l.archetype === "brooklyn_hasidic"), "Brooklyn must feature Hasidic neighbors");
  assert.ok(bkStreet.locals.some((l) => l.archetype === "brooklyn_hipster"), "Brooklyn must feature Williamsburg hipsters");
  assert.ok(bkStreet.locals.some((l) => l.archetype === "brooklyn_classic"), "Brooklyn must feature classic pizza/bagel neighbors");
  assert.ok(bkStreet.localChants.includes("BEST PIZZA IN NYC!"));
  assert.ok(bkStreet.localChants.includes("SHABBAT SHALOM BK!"));

  // POI generator infuses local signature foods & greetings into bakeries/cafes!
  const parisPoi = generateLandmarksAndQuests({
    worldMap: parisMap,
    elements: [
      {
        type: "node",
        id: 501,
        lat: 48.8566 + 0.0007,
        lon: 2.3522 + 0.0005,
        tags: { shop: "bakery", name: "Boulangerie du Coin" },
      },
    ],
  });
  const bakeryLm = parisPoi.landmarks.find((l) => l.name.includes("Boulangerie"));
  assert.ok(bakeryLm, "Paris bakery landmark should be generated");
  assert.ok(
    bakeryLm.dialogue.some((line) => line.includes("Bonjour") && line.includes("baguette")),
    `Expected Parisian flair dialogue, got: ${JSON.stringify(bakeryLm.dialogue)}`
  );
});
