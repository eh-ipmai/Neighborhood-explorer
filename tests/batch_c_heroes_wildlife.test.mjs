import test from "node:test";
import assert from "node:assert/strict";

import {
  HERO_HAIR_STYLES,
  HERO_HAIR_COLORS,
  HERO_SKIN_TONES,
  HERO_HEADWEAR,
  DEFAULT_HERO_PROFILE,
  resolveHeroProfile,
  bakeSmb3HeroSprite,
  bakeSmb3HeroFanfareSprite,
  bake32BitStreetLifeSprites,
  PROTESTOR_BIOME_STYLES,
  resolveProtestorOutfitStyle,
} from "../src/characters.js";
import { buildStreetLife, getRegionalStreetChants } from "../src/streetlife.js";
import { buildParkFeatures } from "../src/parks.js";
import { getNeighborhoodMeta } from "../src/neighborhood_meta.js";
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

function makeSyntheticParkMap({ biome = "israel_jerusalem", preset = "generic", season = "fall" } = {}) {
  const width = 48;
  const height = 48;
  const base = new Array(width * height).fill(0);
  const collision = new Array(width * height).fill(0);

  // Big park zone (rows 6..26, cols 6..36)
  for (let y = 6; y <= 26; y++) {
    for (let x = 6; x <= 36; x++) {
      base[y * width + x] = 11; // PARK
    }
  }
  // Road + sidewalk near spawn
  for (let x = 2; x < width - 2; x++) {
    base[34 * width + x] = 2;
    base[33 * width + x] = 1;
    base[35 * width + x] = 1;
  }

  return {
    tileSize: 16,
    scaleMetersPerTile: 6,
    dimensions: { width, height },
    origin: {
      lat: biome.startsWith("israel_") ? 31.7634 : 42.3192,
      lon: biome.startsWith("israel_") ? 35.2202 : -71.1927,
      name: "Home Base",
      spawnTile: { x: 24, y: 33 },
    },
    meta: {
      preset,
      biome,
      season,
      townName: biome.startsWith("israel_") ? "Jerusalem, Israel" : "Test Town",
      cityShort: biome.startsWith("israel_") ? "Jerusalem" : "TestTown",
      heroName: "Maya",
    },
    layers: { base, collision },
    buildings: [],
    streetZones: [],
  };
}

test("Hero Profile resolves cleanly, preserves Newton Liam default, and bakes custom styles + Soccer Kit", () => {
  assert.equal(Object.keys(HERO_HAIR_STYLES).length, 4);
  assert.equal(Object.keys(HERO_HAIR_COLORS).length, 5);
  assert.equal(Object.keys(HERO_SKIN_TONES).length, 4);
  assert.equal(Object.keys(HERO_HEADWEAR).length, 5);

  // Newton default keeps kippah + tzitzit
  const def = resolveHeroProfile(null);
  assert.deepEqual(def, DEFAULT_HERO_PROFILE);
  assert.equal(def.headwear, "kippah");
  assert.equal(def.tzitzit, true);

  // Custom ponytail + sun hat hero disables tzitzit by default
  const maya = resolveHeroProfile({
    hairStyle: "ponytail",
    hairColor: "dark_brown",
    skinTone: "tan",
    headwear: "sun_hat",
  });
  assert.equal(maya.hairStyle, "ponytail");
  assert.equal(maya.headwear, "sun_hat");
  assert.equal(maya.tzitzit, false);

  const cleanup = installMockCanvasDom();
  try {
    const sprNormal = bakeSmb3HeroSprite("down", 0, false, "polo", { heroProfile: maya });
    const sprSoccer = bakeSmb3HeroSprite("down", 0, false, "baseball", { heroProfile: maya, soccerKit: true });
    const sprFanfare = bakeSmb3HeroFanfareSprite("baseball", { heroProfile: maya, soccerKit: true });
    assert.equal(sprNormal.width, 48);
    assert.equal(sprSoccer.width, 48);
    assert.equal(sprFanfare.height, 56);
    // Verify Soccer Kit renders royal-blue jersey pixels (#245ca8) instead of Giants orange
    assert.ok(sprSoccer._calls.some((c) => c[4] === "#245ca8"), "Soccer kit should paint blue soccer stripes");

    const streetSprites = bake32BitStreetLifeSprites(["MORE FALAFEL!"], {
      biomeConfig: BIOME_PRESETS.israel_jerusalem,
      bikerChants: ["WATCH THE E-BIKE!"],
      heroName: "Maya",
      cityShort: "Jerusalem",
    });
    for (const species of ["parakeet", "hyrax", "arctic_fox", "red_fox", "roadrunner"]) {
      assert.ok(streetSprites[`${species}_right_0`], `missing ${species}_right_0`);
      assert.ok(streetSprites[`${species}_left_0`], `missing ${species}_left_0`);
      assert.ok(streetSprites[`${species}_alert_right`], `missing ${species}_alert_right`);
    }
    assert.ok(streetSprites.bubble_squawk);
    assert.ok(streetSprites.bubble_squeak);
    assert.ok(streetSprites.bubble_yip);
    assert.ok(streetSprites.bubble_meep);
  } finally {
    cleanup();
  }
});

test("Regional wildlife, chants & park sports adapt cleanly across Israel, Coastal Beach, and Winter/Desert", () => {
  const jerusalemMap = makeSyntheticParkMap({ biome: "israel_jerusalem" });
  const jStreet = buildStreetLife(jerusalemMap);
  assert.equal(jStreet.turkeys.length, 0, "Jerusalem must have zero New England turkeys");
  const jKinds = new Set(jStreet.critters.map((c) => c.kind));
  assert.ok(
    jKinds.has("cat") || jKinds.has("parakeet") || jKinds.has("hyrax"),
    "Jerusalem should spawn regional cats/parakeets/hyraxes"
  );
  assert.ok(jStreet.localChants.includes("MORE FALAFEL!"));
  assert.ok(jStreet.bikerChants.includes("WATCH THE E-BIKE!"));

  const jParks = buildParkFeatures(jerusalemMap);
  assert.ok(
    jParks.fields.every((f) => f.kind !== "baseball_diamond"),
    "Jerusalem parks should not spawn US baseball diamonds"
  );
  assert.ok(
    jParks.fields.some((f) => f.kind === "soccer_field" || f.kind === "tennis_court"),
    "Jerusalem parks should feature soccer fields or tennis courts"
  );

  // Tel Aviv Coastal gets beach volleyball / soccer / tennis
  const telAvivMap = makeSyntheticParkMap({ biome: "israel_coastal" });
  const taParks = buildParkFeatures(telAvivMap);
  assert.ok(
    taParks.fields.some((f) => f.kind === "soccer_field" || f.kind === "beach_volleyball" || f.kind === "tennis_court"),
    "Tel Aviv coastal parks should include soccer, beach volleyball, or tennis"
  );

  // Winter New England parks turn into outdoor ice rinks!
  const winterMap = makeSyntheticParkMap({ biome: "new_england_autumn", season: "winter" });
  const winterParks = buildParkFeatures(winterMap);
  assert.ok(
    winterParks.fields.some((f) => f.kind === "ice_rink"),
    "Winter New England parks should feature outdoor ice rinks"
  );

  // Regional chants helper
  const desertChants = getRegionalStreetChants(BIOME_PRESETS.southwest_desert, "Austin", false);
  assert.ok(desertChants.protestChants.includes("MORE SHADE TREES!"));

  // Neighborhood meta resolves custom heroProfile cleanly
  jerusalemMap.meta.heroProfile = { hairStyle: "curly", hairColor: "black", skinTone: "tan", headwear: "cap" };
  const meta = getNeighborhoodMeta(jerusalemMap);
  assert.equal(meta.heroProfile.hairStyle, "curly");
  assert.equal(meta.heroProfile.headwear, "cap");
  assert.equal(meta.heroProfile.tzitzit, false);
});

test("Peaceful sidewalk protestors wear distinct biome-specific outfits, headwear & footwear across all 12 biomes", () => {
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.new_england_autumn, "fall"), "new_england_autumn");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.new_england_autumn, "winter"), "winter_parka");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.tundra, "summer"), "winter_parka");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.european_historic, "fall"), "european_historic");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.european_historic, "winter"), "winter_parka");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.israel_jerusalem, "winter"), "israel_jerusalem");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.israel_coastal, "summer"), "israel_coastal");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.southwest_desert, "fall"), "desert");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.tropical_coastal, "summer"), "tropical_coastal");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.alpine, "fall"), "alpine");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.east_asian_urban, "spring"), "east_asian_urban");
  assert.equal(resolveProtestorOutfitStyle(BIOME_PRESETS.temperate_green, "summer"), "temperate_green");

  // Every biome preset maps to a valid PROTESTOR_BIOME_STYLES entry & bakes distinct 32-bit sprites!
  const cleanup = installMockCanvasDom();
  try {
    const signatures = new Set();
    for (const [biomeId, cfg] of Object.entries(BIOME_PRESETS)) {
      const styleKey = resolveProtestorOutfitStyle(cfg, "fall");
      assert.ok(PROTESTOR_BIOME_STYLES[styleKey], `Missing protestor outfit style for ${biomeId} -> ${styleKey}`);
      const sprites = bake32BitStreetLifeSprites(["READ MY SIGN!!"], { biomeConfig: cfg, season: "fall" });
      for (let v = 0; v < 3; v++) {
        for (const f of [0, 1]) {
          const rSpr = sprites[`protestor_${v}_right_${f}`];
          const lSpr = sprites[`protestor_${v}_left_${f}`];
          assert.equal(rSpr.width, 48, `${biomeId} protestor_${v}_right_${f} width`);
          assert.equal(rSpr.height, 64, `${biomeId} protestor_${v}_right_${f} height`);
          assert.ok(rSpr._calls.length > 100, `${biomeId} protestor should render rich 32-bit pixel art`);
          assert.ok(lSpr && lSpr.width === 48);
        }
      }
      // Fingerprint variant 0's rendered color palette + pixel count to verify biomes are visually distinct!
      const colors = [...new Set(sprites.protestor_0_right_0._calls.map((c) => c[4]))].sort().join(",");
      signatures.add(`${styleKey}:${colors}`);
    }
    assert.ok(signatures.size >= 10, `Expected 10 distinct biome protestor outfit styles, got ${signatures.size}`);
  } finally {
    cleanup();
  }
});
