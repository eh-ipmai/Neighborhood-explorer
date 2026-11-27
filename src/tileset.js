/**
 * Option 1: High-Craft 16-Bit SNES Overworld Pixel-Art Engine
 * Closely modeled on our locked-in SNES Overworld concept (A Link to the Past / Chrono Trigger):
 *  - Crisp dark pixel outlines (#1c2128) & 3-4 tone shaded pixel sprites
 *  - True pitched shingle gable roofs, dormers, chimneys, covered porches, picket fences,
 *    garden shrubs, mailboxes, and distinct New England house color palettes (1 house per address)
 *  - Classical red-brick columns & pediments for libraries, schools, and civic landmarks
 *  - Auto-tiled cobblestone sidewalks with 3D stone curbs, clean multi-lane roads,
 *    direction-aware zebra crosswalks, glowing green WALK signal posts, and red fire hydrants
 *  - Super Mario Bros. 3 / All-Stars–detail character sprites for Liam & neighbors!
 */

import {
  HERO_OUTFITS,
  bakeSmb3HeroSprite,
  bakeSmb3HeroFanfareSprite,
  bakeSmb3NpcSprite,
  bake32BitStreetLifeSprites,
} from "./characters.js";
import { PROTEST_CHANTS } from "./streetlife.js";
import { upgradeAtlasTo32Bit } from "./world32bit.js";
import { bake32BitVehicleSprites } from "./vehicles32bit.js";

export { HERO_OUTFITS };

export const PALETTES = {
  autumn_golden: {
    outline: "#241715",
    // Warm golden-amber autumn lawns (from reference artwork!)
    grassBase: "#d9892e",
    grassLight: "#eca63e",
    grassMid: "#c27121",
    grassDark: "#8f4a16",
    // Warm olive-gold autumn park turf (keeps athletic parks distinct!)
    parkBase: "#888a34",
    parkStripeLight: "#999c3c",
    parkStripeDark: "#77792b",
    parkHighlight: "#b4b852",
    parkShadow: "#57591f",
    tallGrassBase: "#7a5e22",
    tallGrassMid: "#a67529",
    tallGrassTip: "#e39c36",
    dirtBase: "#b5743f",
    dirtLight: "#cf8f55",
    dirtMid: "#945a2c",
    dirtDark: "#693b1a",
    dirtPebble: "#e3c9a6",
    sandBase: "#e8c480",
    sandLight: "#f7dca0",
    sandMid: "#cfa45f",
    sandWet: "#ab8044",
    sandSparkle: "#fff5d1",
    // Warm mauve-taupe New England cobblestone sidewalks!
    sidewalkBase: "#a89693",
    sidewalkLight: "#c7b5b0",
    sidewalkMid: "#948280",
    sidewalkDark: "#786666",
    sidewalkJoint: "#5e4e50",
    sidewalkMortar: "#5e4e50",
    sidewalkCurbTop: "#dfd0c8",
    sidewalkCurbFace: "#6b595b",
    sidewalkCurbShadow: "#332528",
    // Clean, high-clarity Newton asphalt roads (clearly distinct from warm cobblestone sidewalks!)
    roadRes: "#5a5e68",
    roadResDark: "#4e525c",
    roadResLight: "#666b75",
    roadMain: "#4b505a",
    roadMainDark: "#3f444e",
    roadMainLight: "#575d68",
    highway: "#3b404b",
    highwayBase: "#3b404b",
    highwayDark: "#303540",
    highwayLight: "#464c58",
    highwayTrack: "#424854",
    highwayYellow: "#f5c53b",
    highwayMedian: "#b4bac4",
    parkingBase: "#545862",
    parkingLight: "#616670",
    parkingDark: "#434750",
    roadShoulder: "#f2f5f8",
    roadDashWhite: "#f5f8fc",
    roadYellow: "#f5c53b",
    crosswalkWhite: "#f5f8fc",
    crosswalkEdge: "#b8c0cc",
    waterBase: "#32648f",
    waterDeep: "#254c73",
    waterMid: "#3b76a3",
    waterShallow: "#5695bf",
    waterShallowLight: "#8cc4de",
    waterLight: "#7cb4d6",
    waterShimmer: "#ffe9c2",
    treeOutline: "#2b1214",
    treeDark: "#7d1b20",
    treeMid: "#bf3424",
    treeLight: "#eb6c2b",
    treeHighlight: "#ffb047",
    pineDark: "#243b24",
    pineMid: "#385930",
    pineLight: "#557d3e",
    pineHighlight: "#7da350",
    treeTrunk: "#6e4226",
    treeTrunkDark: "#452614",
    treeTrunkLight: "#965e38",
  },
  snes_classic: {
    outline: "#1d2228",
    grassBase: "#5ca642",
    grassLight: "#7bc24e",
    grassMid: "#4b8f38",
    grassDark: "#38702d",
    parkBase: "#4ca64a",
    parkStripeLight: "#5eb854",
    parkStripeDark: "#3f9442",
    parkHighlight: "#86d96a",
    parkShadow: "#2f7535",
    tallGrassBase: "#357830",
    tallGrassMid: "#4e9e3e",
    tallGrassTip: "#88db58",
    dirtBase: "#a8794d",
    dirtLight: "#c49464",
    dirtMid: "#8f633c",
    dirtDark: "#6b472a",
    dirtPebble: "#d6c4a8",
    sandBase: "#e8cf8e",
    sandLight: "#f6e3ae",
    sandMid: "#d4b672",
    sandWet: "#b59153",
    sandSparkle: "#fff7db",
    sidewalkBase: "#d9d0be",
    sidewalkLight: "#ece5d5",
    sidewalkMid: "#c7bda8",
    sidewalkMortar: "#a39986",
    sidewalkCurbTop: "#f3ede0",
    sidewalkCurbFace: "#8e8576",
    sidewalkCurbShadow: "#2d323b",
    roadRes: "#4a5260",
    roadResDark: "#3e4552",
    roadResLight: "#5c6575",
    roadMain: "#3f4652",
    roadMainDark: "#343a45",
    highwayBase: "#2b303a",
    highwayDark: "#22262e",
    highwayTrack: "#363c48",
    highwayYellow: "#f2c138",
    highwayMedian: "#9aa3b0",
    roadShoulder: "#e6ebf2",
    roadDashWhite: "#dce3ec",
    roadYellow: "#e8be4a",
    crosswalkWhite: "#f4f6fa",
    crosswalkEdge: "#c4ccd8",
    waterDeep: "#1e4e9c",
    waterMid: "#2c6bc4",
    waterShallow: "#4aa6db",
    waterShallowLight: "#79c8f0",
    waterLight: "#5da6f0",
    waterShimmer: "#d6f4ff",
    treeOutline: "#162b1c",
    treeDark: "#22542b",
    treeMid: "#377f37",
    treeLight: "#5eb043",
    treeHighlight: "#96e05e",
    pineDark: "#1c4532",
    pineMid: "#2a6345",
    pineLight: "#3f875c",
    pineHighlight: "#67b37b",
    treeTrunk: "#6e462d",
    treeTrunkDark: "#472b1c",
    treeTrunkLight: "#8f5d3e",
  },
  israel_jerusalem: {
    outline: "#2b2118",
    // Warm sunlit Mediterranean olive-gold hillside lawns & dry grassy terraces
    grassBase: "#9ea862",
    grassLight: "#bcc47a",
    grassMid: "#85914f",
    grassDark: "#636e38",
    // Lush irrigated Jerusalem public parks (Gan Sacher / Liberty Bell Park!)
    parkBase: "#5ea14a",
    parkStripeLight: "#70b557",
    parkStripeDark: "#508f3f",
    parkHighlight: "#94d474",
    parkShadow: "#3b6e2e",
    tallGrassBase: "#7a8546",
    tallGrassMid: "#99a35b",
    tallGrassTip: "#cbd184",
    // Pale rocky Judean limestone dirt trails
    dirtBase: "#cbb998",
    dirtLight: "#e0d2b4",
    dirtMid: "#b39f7d",
    dirtDark: "#8c7a5c",
    dirtPebble: "#f2ebdc",
    sandBase: "#ebd4a2",
    sandLight: "#f7e6bd",
    sandMid: "#d4ba85",
    sandWet: "#b59b69",
    sandSparkle: "#fff9e6",
    // Pale creamy Jerusalem limestone / Ackerman interlocking sidewalk pavers!
    sidewalkBase: "#ded5c1",
    sidewalkLight: "#f0e9d8",
    sidewalkMid: "#cfc4ad",
    sidewalkDark: "#a89d86",
    sidewalkJoint: "#8c816c",
    sidewalkMortar: "#8c816c",
    sidewalkCurbTop: "#f5efe0",
    sidewalkCurbFace: "#9e937d",
    sidewalkCurbShadow: "#3b342a",
    roadRes: "#5c6066",
    roadResDark: "#4f5359",
    roadResLight: "#6c7078",
    roadMain: "#4c5057",
    roadMainDark: "#3f434a",
    roadMainLight: "#5c6069",
    highway: "#3d414a",
    highwayBase: "#3d414a",
    highwayDark: "#31353d",
    highwayLight: "#4c515c",
    highwayTrack: "#454a54",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#d4cec2",
    parkingBase: "#595c63",
    parkingLight: "#696d75",
    parkingDark: "#474a50",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#f7faff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    waterBase: "#2d82a8",
    waterDeep: "#1e6185",
    waterMid: "#3996bd",
    waterShallow: "#5cb8d9",
    waterShallowLight: "#94dcf2",
    waterLight: "#78c8e6",
    waterShimmer: "#fff9e0",
    treeOutline: "#1e2e1d",
    treeDark: "#41573b",
    treeMid: "#66805a",
    treeLight: "#8fa880",
    treeHighlight: "#bdd1ad",
    pineDark: "#1b422b",
    pineMid: "#2d633d",
    pineLight: "#4a8a52",
    pineHighlight: "#72b36b",
    treeTrunk: "#756a5c",
    treeTrunkDark: "#4a4238",
    treeTrunkLight: "#9c9080",
  },
  israel_coastal: {
    outline: "#22292e",
    grassBase: "#7bb557",
    grassLight: "#98cf6d",
    grassMid: "#649c45",
    grassDark: "#487830",
    parkBase: "#54ad4e",
    parkStripeLight: "#66bf5c",
    parkStripeDark: "#469942",
    parkHighlight: "#8ee07b",
    parkShadow: "#327530",
    tallGrassBase: "#5b9142",
    tallGrassMid: "#78b354",
    tallGrassTip: "#a8de78",
    dirtBase: "#c9ab80",
    dirtLight: "#e0c59c",
    dirtMid: "#b09066",
    dirtDark: "#876c4a",
    dirtPebble: "#f2e6cf",
    // Bright sunlit Mediterranean beach sand!
    sandBase: "#f2da9c",
    sandLight: "#fcf0c5",
    sandMid: "#dec17e",
    sandWet: "#bf9f5c",
    sandSparkle: "#fffdf0",
    // Classic Tel Aviv light gray-cream Ackerman pavers
    sidewalkBase: "#d4d0c8",
    sidewalkLight: "#e8e5de",
    sidewalkMid: "#bfbbb2",
    sidewalkDark: "#96928a",
    sidewalkJoint: "#7d7972",
    sidewalkMortar: "#7d7972",
    sidewalkCurbTop: "#f2efe9",
    sidewalkCurbFace: "#8f8b84",
    sidewalkCurbShadow: "#32363b",
    roadRes: "#585d66",
    roadResDark: "#4b5059",
    roadResLight: "#676d78",
    roadMain: "#484d57",
    roadMainDark: "#3c404a",
    roadMainLight: "#575c66",
    highway: "#3a3f4a",
    highwayBase: "#3a3f4a",
    highwayDark: "#2e333d",
    highwayLight: "#494f5c",
    highwayTrack: "#424854",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#ccd1d9",
    parkingBase: "#555a63",
    parkingLight: "#656b75",
    parkingDark: "#434852",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#ffffff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    // Vivid turquoise Mediterranean Sea!
    waterBase: "#2494b8",
    waterDeep: "#186d94",
    waterMid: "#30aad1",
    waterShallow: "#56cce8",
    waterShallowLight: "#96ebfc",
    waterLight: "#73daf2",
    waterShimmer: "#ffffff",
    treeOutline: "#162b1c",
    treeDark: "#22522d",
    treeMid: "#397a3e",
    treeLight: "#5da652",
    treeHighlight: "#8fd46a",
    pineDark: "#255726",
    pineMid: "#448f3c",
    pineLight: "#63ab48",
    pineHighlight: "#9be06c",
    treeTrunk: "#8c653f",
    treeTrunkDark: "#5c4026",
    treeTrunkLight: "#b5895b",
  },
  israel_galilee: {
    outline: "#1f291d",
    grassBase: "#72a64c",
    grassLight: "#8ec261",
    grassMid: "#5b8c3b",
    grassDark: "#406929",
    parkBase: "#54a146",
    parkStripeLight: "#67b556",
    parkStripeDark: "#468c3a",
    parkHighlight: "#8cd672",
    parkShadow: "#316929",
    tallGrassBase: "#527d36",
    tallGrassMid: "#709e48",
    tallGrassTip: "#a3cc6e",
    dirtBase: "#b59b78",
    dirtLight: "#cfb693",
    dirtMid: "#99805f",
    dirtDark: "#705b42",
    dirtPebble: "#e6dbc8",
    sandBase: "#e8d29e",
    sandLight: "#f5e4b8",
    sandMid: "#cfb67e",
    sandWet: "#ad935c",
    sandSparkle: "#fff9e0",
    sidewalkBase: "#d6cfc0",
    sidewalkLight: "#ebe5d8",
    sidewalkMid: "#c2baa9",
    sidewalkDark: "#999180",
    sidewalkJoint: "#7d7667",
    sidewalkMortar: "#7d7667",
    sidewalkCurbTop: "#f2ece0",
    sidewalkCurbFace: "#8f8878",
    sidewalkCurbShadow: "#333029",
    roadRes: "#565a61",
    roadResDark: "#494d54",
    roadResLight: "#656a73",
    roadMain: "#464a52",
    roadMainDark: "#3a3e45",
    roadMainLight: "#555a63",
    highway: "#383c45",
    highwayBase: "#383c45",
    highwayDark: "#2c3038",
    highwayLight: "#464b57",
    highwayTrack: "#40454f",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#c7c4bc",
    parkingBase: "#52565e",
    parkingLight: "#626670",
    parkingDark: "#41444c",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#ffffff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    waterBase: "#2b7ca6",
    waterDeep: "#1d5b82",
    waterMid: "#3991bd",
    waterShallow: "#5cb3db",
    waterShallowLight: "#94daf2",
    waterLight: "#73c5e6",
    waterShimmer: "#fffbe6",
    treeOutline: "#1c2b1b",
    treeDark: "#3a5434",
    treeMid: "#5b7d4e",
    treeLight: "#84a672",
    treeHighlight: "#b5cf9f",
    pineDark: "#1b422b",
    pineMid: "#2d633d",
    pineLight: "#4a8a52",
    pineHighlight: "#72b36b",
    treeTrunk: "#706253",
    treeTrunkDark: "#473d33",
    treeTrunkLight: "#968674",
  },
  israel_desert: {
    outline: "#332216",
    // Warm Negev sandstone & ochre desert ground!
    grassBase: "#d6b078",
    grassLight: "#e8c892",
    grassMid: "#bf965e",
    grassDark: "#967142",
    // Irrigated green desert oasis parks!
    parkBase: "#5da649",
    parkStripeLight: "#70ba57",
    parkStripeDark: "#4d913c",
    parkHighlight: "#94d975",
    parkShadow: "#376e2a",
    tallGrassBase: "#b08c54",
    tallGrassMid: "#cca668",
    tallGrassTip: "#e8c884",
    dirtBase: "#c79460",
    dirtLight: "#deb07c",
    dirtMid: "#ad7b4a",
    dirtDark: "#825832",
    dirtPebble: "#f2dfc0",
    sandBase: "#ebd09b",
    sandLight: "#fae5b8",
    sandMid: "#d4b47b",
    sandWet: "#b39259",
    sandSparkle: "#fff9e3",
    sidewalkBase: "#e0d0b4",
    sidewalkLight: "#f2e5cc",
    sidewalkMid: "#ccb999",
    sidewalkDark: "#a39172",
    sidewalkJoint: "#87775c",
    sidewalkMortar: "#87775c",
    sidewalkCurbTop: "#f7ecd6",
    sidewalkCurbFace: "#9e8d70",
    sidewalkCurbShadow: "#403526",
    roadRes: "#5c5a5c",
    roadResDark: "#4f4d4f",
    roadResLight: "#6b696b",
    roadMain: "#4d4b4f",
    roadMainDark: "#403e42",
    roadMainLight: "#5c595e",
    highway: "#3e3d42",
    highwayBase: "#3e3d42",
    highwayDark: "#313036",
    highwayLight: "#4c4b52",
    highwayTrack: "#45444a",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#d9ccb4",
    parkingBase: "#595759",
    parkingLight: "#696769",
    parkingDark: "#474547",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#ffffff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    waterBase: "#2490b3",
    waterDeep: "#186b8c",
    waterMid: "#32a6cc",
    waterShallow: "#5cc9e6",
    waterShallowLight: "#96e8fa",
    waterLight: "#78d9f0",
    waterShimmer: "#fffce6",
    treeOutline: "#242e18",
    treeDark: "#4b6132",
    treeMid: "#6d8544",
    treeLight: "#92ab59",
    treeHighlight: "#b8cc76",
    pineDark: "#255726",
    pineMid: "#448f3c",
    pineLight: "#63ab48",
    pineHighlight: "#9be06c",
    treeTrunk: "#7a583a",
    treeTrunkDark: "#4f3723",
    treeTrunkLight: "#9e7752",
  },
  southwest_desert: {
    outline: "#331e16",
    grassBase: "#cf9365",
    grassLight: "#e3ab7d",
    grassMid: "#b57a4e",
    grassDark: "#8c5936",
    parkBase: "#5ca148",
    parkStripeLight: "#6eb557",
    parkStripeDark: "#4d8c3c",
    parkHighlight: "#91d474",
    parkShadow: "#376b2a",
    tallGrassBase: "#a87849",
    tallGrassMid: "#c7945c",
    tallGrassTip: "#e6b878",
    dirtBase: "#bf744b",
    dirtLight: "#d98d62",
    dirtMid: "#a15c38",
    dirtDark: "#784126",
    dirtPebble: "#f0d5be",
    sandBase: "#e8be8c",
    sandLight: "#f7d5a8",
    sandMid: "#cfa16d",
    sandWet: "#ad804e",
    sandSparkle: "#fff5db",
    sidewalkBase: "#dbccb8",
    sidewalkLight: "#ede0ce",
    sidewalkMid: "#c4b39d",
    sidewalkDark: "#9c8b76",
    sidewalkJoint: "#80705e",
    sidewalkMortar: "#80705e",
    sidewalkCurbTop: "#f2e8da",
    sidewalkCurbFace: "#968672",
    sidewalkCurbShadow: "#3d3126",
    roadRes: "#58585e",
    roadResDark: "#4b4b52",
    roadResLight: "#686870",
    roadMain: "#484950",
    roadMainDark: "#3c3d42",
    roadMainLight: "#575861",
    highway: "#3b3c42",
    highwayBase: "#3b3c42",
    highwayDark: "#2e2f36",
    highwayLight: "#494a52",
    highwayTrack: "#42434a",
    highwayYellow: "#f5c53b",
    highwayMedian: "#d4c4b4",
    parkingBase: "#54555c",
    parkingLight: "#64656e",
    parkingDark: "#43444a",
    roadShoulder: "#f2f5f8",
    roadDashWhite: "#f5f8fc",
    roadYellow: "#f5c53b",
    crosswalkWhite: "#f5f8fc",
    crosswalkEdge: "#b8c0cc",
    waterBase: "#2b7fa6",
    waterDeep: "#1d5d80",
    waterMid: "#3995bf",
    waterShallow: "#5cb8de",
    waterShallowLight: "#96ddf5",
    waterLight: "#78c8e8",
    waterShimmer: "#fff7db",
    treeOutline: "#242e18",
    treeDark: "#4b6132",
    treeMid: "#6d8544",
    treeLight: "#92ab59",
    treeHighlight: "#b8cc76",
    pineDark: "#255726",
    pineMid: "#448f3c",
    pineLight: "#63ab48",
    pineHighlight: "#9be06c",
    treeTrunk: "#7a583a",
    treeTrunkDark: "#4f3723",
    treeTrunkLight: "#9e7752",
  },
  winter_snow: {
    outline: "#1f2a38",
    // Sparkling crisp snow-covered lawns & frost-dusted paths!
    grassBase: "#dcebf7",
    grassLight: "#f4faff",
    grassMid: "#c2daf0",
    grassDark: "#96b7d6",
    parkBase: "#d0e4f5",
    parkStripeLight: "#e3f2fc",
    parkStripeDark: "#bed6eb",
    parkHighlight: "#ffffff",
    parkShadow: "#8fb0cf",
    tallGrassBase: "#b5cde3",
    tallGrassMid: "#d0e4f5",
    tallGrassTip: "#ffffff",
    dirtBase: "#9ca7b5",
    dirtLight: "#c4cedb",
    dirtMid: "#7d8896",
    dirtDark: "#5a6370",
    dirtPebble: "#f0f7ff",
    sandBase: "#d4dce6",
    sandLight: "#eef4fa",
    sandMid: "#b5c0cf",
    sandWet: "#8e9bad",
    sandSparkle: "#ffffff",
    sidewalkBase: "#c7d2de",
    sidewalkLight: "#e8f0f7",
    sidewalkMid: "#adb9c7",
    sidewalkDark: "#8593a3",
    sidewalkJoint: "#6b7887",
    sidewalkMortar: "#6b7887",
    sidewalkCurbTop: "#f5faff",
    sidewalkCurbFace: "#8e9bad",
    sidewalkCurbShadow: "#2b3545",
    roadRes: "#4c5461",
    roadResDark: "#3e4552",
    roadResLight: "#5c6675",
    roadMain: "#414854",
    roadMainDark: "#333945",
    roadMainLight: "#505969",
    highway: "#353c47",
    highwayBase: "#353c47",
    highwayDark: "#282e38",
    highwayLight: "#444d5c",
    highwayTrack: "#3d4552",
    highwayYellow: "#f5c53b",
    highwayMedian: "#d4e0ed",
    parkingBase: "#4c5461",
    parkingLight: "#5d6675",
    parkingDark: "#3b424d",
    roadShoulder: "#eef6ff",
    roadDashWhite: "#f7fbff",
    roadYellow: "#f5c53b",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#bdd2e6",
    waterBase: "#2d638f",
    waterDeep: "#1e4970",
    waterMid: "#3c7aa8",
    waterShallow: "#6aa8d1",
    waterShallowLight: "#a6dcf5",
    waterLight: "#8ac7e8",
    waterShimmer: "#ffffff",
    treeOutline: "#162433",
    treeDark: "#1c3d3c",
    treeMid: "#2c5c56",
    treeLight: "#dceefc",
    treeHighlight: "#ffffff",
    pineDark: "#193836",
    pineMid: "#285752",
    pineLight: "#dceefc",
    pineHighlight: "#ffffff",
    treeTrunk: "#593e2e",
    treeTrunkDark: "#382419",
    treeTrunkLight: "#7d5b45",
  },
  spring_blossom: {
    outline: "#1f2920",
    grassBase: "#68bd52",
    grassLight: "#8ce06e",
    grassMid: "#52a142",
    grassDark: "#3b7d31",
    parkBase: "#57b54c",
    parkStripeLight: "#6ecc5e",
    parkStripeDark: "#499e42",
    parkHighlight: "#98ed7e",
    parkShadow: "#327a2e",
    tallGrassBase: "#47943b",
    tallGrassMid: "#66ba52",
    tallGrassTip: "#a3ed7b",
    dirtBase: "#b5865a",
    dirtLight: "#cfa070",
    dirtMid: "#996e46",
    dirtDark: "#704d2f",
    dirtPebble: "#e8dac5",
    sandBase: "#ebd59b",
    sandLight: "#faebc0",
    sandMid: "#d6bc7c",
    sandWet: "#b59a5d",
    sandSparkle: "#fffdf0",
    sidewalkBase: "#d6d1c9",
    sidewalkLight: "#ece8e1",
    sidewalkMid: "#c2bdb4",
    sidewalkDark: "#9c968c",
    sidewalkJoint: "#827c73",
    sidewalkMortar: "#827c73",
    sidewalkCurbTop: "#f5f2ec",
    sidewalkCurbFace: "#8e887f",
    sidewalkCurbShadow: "#2e2c2a",
    roadRes: "#505663",
    roadResDark: "#424854",
    roadResLight: "#606775",
    roadMain: "#444a57",
    roadMainDark: "#373c47",
    roadMainLight: "#545b6b",
    highway: "#373d47",
    highwayBase: "#373d47",
    highwayDark: "#2b3038",
    highwayLight: "#454d59",
    highwayTrack: "#3f4652",
    highwayYellow: "#f5c53b",
    highwayMedian: "#c7ced9",
    parkingBase: "#4f5561",
    parkingLight: "#5f6675",
    parkingDark: "#3e434d",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#f7faff",
    roadYellow: "#f5c53b",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd8",
    waterBase: "#2e7eb5",
    waterDeep: "#1e5c8c",
    waterMid: "#3c94cc",
    waterShallow: "#63b8e3",
    waterShallowLight: "#9be0fa",
    waterLight: "#7ecbf0",
    waterShimmer: "#fff7e6",
    treeOutline: "#3d1e2e",
    treeDark: "#b55780",
    treeMid: "#f08eb8",
    treeLight: "#ffb8d8",
    treeHighlight: "#ffe6f2",
    pineDark: "#1d4a32",
    pineMid: "#2e6e48",
    pineLight: "#4b9663",
    pineHighlight: "#7bc48a",
    treeTrunk: "#6e4630",
    treeTrunkDark: "#45291a",
    treeTrunkLight: "#946244",
  },
  israel_winter_green: {
    outline: "#22291c",
    // Lush emerald-green Israeli winter hills after the rain + blooming red kalaniyot!
    grassBase: "#689c46",
    grassLight: "#87bd5c",
    grassMid: "#528236",
    grassDark: "#3b6125",
    parkBase: "#4f9942",
    parkStripeLight: "#62b051",
    parkStripeDark: "#418236",
    parkHighlight: "#8bd46c",
    parkShadow: "#2e6126",
    tallGrassBase: "#477832",
    tallGrassMid: "#649c46",
    tallGrassTip: "#95cf6b",
    dirtBase: "#b89f7c",
    dirtLight: "#d1ba97",
    dirtMid: "#9c8362",
    dirtDark: "#756046",
    dirtPebble: "#ede4d1",
    sandBase: "#e8d29e",
    sandLight: "#f5e3b8",
    sandMid: "#cfb780",
    sandWet: "#ad9561",
    sandSparkle: "#fff9e6",
    sidewalkBase: "#dbd2be",
    sidewalkLight: "#ede6d5",
    sidewalkMid: "#c7bda8",
    sidewalkDark: "#a19681",
    sidewalkJoint: "#857a67",
    sidewalkMortar: "#857a67",
    sidewalkCurbTop: "#f5efe0",
    sidewalkCurbFace: "#968c78",
    sidewalkCurbShadow: "#363026",
    roadRes: "#565a61",
    roadResDark: "#494d54",
    roadResLight: "#666b73",
    roadMain: "#484c54",
    roadMainDark: "#3c4047",
    roadMainLight: "#585d66",
    highway: "#3a3e47",
    highwayBase: "#3a3e47",
    highwayDark: "#2e323b",
    highwayLight: "#494e59",
    highwayTrack: "#424752",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#d4cec2",
    parkingBase: "#545861",
    parkingLight: "#646973",
    parkingDark: "#43474f",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#f7faff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    waterBase: "#2b7ca3",
    waterDeep: "#1d5d80",
    waterMid: "#3891ba",
    waterShallow: "#5cb3d6",
    waterShallowLight: "#94daf2",
    waterLight: "#78c4e3",
    waterShimmer: "#fff9e0",
    treeOutline: "#1c2e1c",
    treeDark: "#3b5736",
    treeMid: "#5c7d52",
    treeLight: "#85a676",
    treeHighlight: "#b5d1a3",
    pineDark: "#194028",
    pineMid: "#2b613b",
    pineLight: "#488750",
    pineHighlight: "#70b36b",
    treeTrunk: "#706557",
    treeTrunkDark: "#473f36",
    treeTrunkLight: "#968a7a",
  },
  alpine_green: {
    outline: "#192420",
    grassBase: "#4c8f4b",
    grassLight: "#6bb064",
    grassMid: "#3b753d",
    grassDark: "#29572e",
    parkBase: "#458a48",
    parkStripeLight: "#57a158",
    parkStripeDark: "#39753d",
    parkHighlight: "#7cc476",
    parkShadow: "#28572d",
    tallGrassBase: "#346b38",
    tallGrassMid: "#4d8f4e",
    tallGrassTip: "#84c47a",
    dirtBase: "#99826b",
    dirtLight: "#b59d84",
    dirtMid: "#7d6853",
    dirtDark: "#594838",
    dirtPebble: "#d9d0c5",
    sandBase: "#d6cbb4",
    sandLight: "#ebe2cf",
    sandMid: "#bfb39b",
    sandWet: "#9c907a",
    sandSparkle: "#f7f3eb",
    sidewalkBase: "#b8b4ad",
    sidewalkLight: "#d4d0c9",
    sidewalkMid: "#a19d96",
    sidewalkDark: "#7d7973",
    sidewalkJoint: "#615e59",
    sidewalkMortar: "#615e59",
    sidewalkCurbTop: "#e3e0da",
    sidewalkCurbFace: "#7a7670",
    sidewalkCurbShadow: "#2b2a28",
    roadRes: "#4e535c",
    roadResDark: "#40454d",
    roadResLight: "#5e6470",
    roadMain: "#41464f",
    roadMainDark: "#343940",
    roadMainLight: "#525863",
    highway: "#353942",
    highwayBase: "#353942",
    highwayDark: "#292c33",
    highwayLight: "#434854",
    highwayTrack: "#3d424d",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#c4cbd4",
    parkingBase: "#4c5159",
    parkingLight: "#5c626b",
    parkingDark: "#3b3f47",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#f7faff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    waterBase: "#24709c",
    waterDeep: "#185378",
    waterMid: "#3488b5",
    waterShallow: "#5eb3d9",
    waterShallowLight: "#98def5",
    waterLight: "#78c8e8",
    waterShimmer: "#ffffff",
    treeOutline: "#13241b",
    treeDark: "#1d4a31",
    treeMid: "#2e6e48",
    treeLight: "#4b9663",
    treeHighlight: "#7bc48a",
    pineDark: "#163b2a",
    pineMid: "#24593d",
    pineLight: "#3b8058",
    pineHighlight: "#67b07f",
    treeTrunk: "#634028",
    treeTrunkDark: "#3d2516",
    treeTrunkLight: "#8a5c3c",
  },
  tropical_coastal: {
    outline: "#1a2926",
    grassBase: "#5ec251",
    grassLight: "#82de6d",
    grassMid: "#47a340",
    grassDark: "#2f7d2e",
    parkBase: "#4eb84b",
    parkStripeLight: "#65cf5d",
    parkStripeDark: "#3fa13f",
    parkHighlight: "#91eb82",
    parkShadow: "#2b782c",
    tallGrassBase: "#3f9c42",
    tallGrassMid: "#5ec258",
    tallGrassTip: "#9bf084",
    dirtBase: "#c99f6b",
    dirtLight: "#e0b884",
    dirtMid: "#b08552",
    dirtDark: "#876238",
    dirtPebble: "#f7ebd2",
    sandBase: "#f7e2a8",
    sandLight: "#fff4cc",
    sandMid: "#e3c988",
    sandWet: "#c4a766",
    sandSparkle: "#ffffff",
    sidewalkBase: "#e3d9c5",
    sidewalkLight: "#f5efe0",
    sidewalkMid: "#cfc3ad",
    sidewalkDark: "#a89c86",
    sidewalkJoint: "#8c806c",
    sidewalkMortar: "#8c806c",
    sidewalkCurbTop: "#faf6eb",
    sidewalkCurbFace: "#9e927c",
    sidewalkCurbShadow: "#3b3428",
    roadRes: "#585f66",
    roadResDark: "#4a5057",
    roadResLight: "#69717a",
    roadMain: "#4a5159",
    roadMainDark: "#3d434a",
    roadMainLight: "#5b636e",
    highway: "#3e454d",
    highwayBase: "#3e454d",
    highwayDark: "#31373d",
    highwayLight: "#4e5661",
    highwayTrack: "#464e57",
    highwayYellow: "#f5c53b",
    highwayMedian: "#d6cfc2",
    parkingBase: "#545b63",
    parkingLight: "#656d75",
    parkingDark: "#434950",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#ffffff",
    roadYellow: "#f5c53b",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4d1de",
    waterBase: "#1ea6bd",
    waterDeep: "#147e96",
    waterMid: "#2cc2d9",
    waterShallow: "#5ee0ed",
    waterShallowLight: "#a6f7fc",
    waterLight: "#7ee8f2",
    waterShimmer: "#ffffff",
    treeOutline: "#162e18",
    treeDark: "#246631",
    treeMid: "#3c9442",
    treeLight: "#64bd58",
    treeHighlight: "#9be87b",
    pineDark: "#1f592c",
    pineMid: "#34823d",
    pineLight: "#57b052",
    pineHighlight: "#8ce072",
    treeTrunk: "#8c6542",
    treeTrunkDark: "#5e4128",
    treeTrunkLight: "#b5895e",
  },
  european_historic: {
    outline: "#221e21",
    grassBase: "#5c9948",
    grassLight: "#7bb85e",
    grassMid: "#498039",
    grassDark: "#335e29",
    parkBase: "#4f9446",
    parkStripeLight: "#62ab56",
    parkStripeDark: "#427d3b",
    parkHighlight: "#88cf74",
    parkShadow: "#2e5e2b",
    tallGrassBase: "#3d7335",
    tallGrassMid: "#579447",
    tallGrassTip: "#8cc76e",
    dirtBase: "#a88d6e",
    dirtLight: "#c4a886",
    dirtMid: "#8c7256",
    dirtDark: "#66513b",
    dirtPebble: "#ded2c3",
    sandBase: "#e0cca0",
    sandLight: "#f0dfb6",
    sandMid: "#c9b385",
    sandWet: "#a89266",
    sandSparkle: "#faf3dc",
    sidewalkBase: "#b5b0a8",
    sidewalkLight: "#cfcac2",
    sidewalkMid: "#9e9991",
    sidewalkDark: "#7d7871",
    sidewalkJoint: "#5e5a54",
    sidewalkMortar: "#5e5a54",
    sidewalkCurbTop: "#dedad2",
    sidewalkCurbFace: "#7a756e",
    sidewalkCurbShadow: "#2b2826",
    roadRes: "#565861",
    roadResDark: "#484a52",
    roadResLight: "#666973",
    roadMain: "#484b54",
    roadMainDark: "#3b3e47",
    roadMainLight: "#585c66",
    highway: "#3b3e47",
    highwayBase: "#3b3e47",
    highwayDark: "#2e3138",
    highwayLight: "#494d59",
    highwayTrack: "#424652",
    highwayYellow: "#f5f8fc",
    highwayMedian: "#c7c4be",
    parkingBase: "#54565e",
    parkingLight: "#646770",
    parkingDark: "#42444c",
    roadShoulder: "#f5f8fc",
    roadDashWhite: "#f7faff",
    roadYellow: "#f5f8fc",
    crosswalkWhite: "#ffffff",
    crosswalkEdge: "#c4ccd6",
    waterBase: "#2d6d96",
    waterDeep: "#1e5175",
    waterMid: "#3c84b0",
    waterShallow: "#63add4",
    waterShallowLight: "#98d8f0",
    waterLight: "#7bc2e3",
    waterShimmer: "#fff7e0",
    treeOutline: "#172919",
    treeDark: "#245429",
    treeMid: "#3c7d3b",
    treeLight: "#64ab52",
    treeHighlight: "#94d474",
    pineDark: "#1c4530",
    pineMid: "#2c6644",
    pineLight: "#448c5d",
    pineHighlight: "#70ba82",
    treeTrunk: "#6b472e",
    treeTrunkDark: "#452b1b",
    treeTrunkLight: "#8f6242",
  },
};

// Selectable house architectural styles & non-residential building kinds (for Paint modal & house_colors.json)
export const BUILDING_STYLE_PRESETS = {
  colonial: { label: "Colonial", mode: "arch" },
  cape: { label: "Cape Cod", mode: "arch" },
  craftsman: { label: "Craftsman", mode: "arch" },
  gambrel: { label: "Gambrel", mode: "arch" },
  tudor: { label: "Tudor", mode: "arch" },
  victorian: { label: "Victorian", mode: "arch" },
  brownstone: { label: "Brownstone", mode: "arch" },
  stone_manor: { label: "Stone Manor", mode: "arch" },
  saltbox: { label: "Saltbox", mode: "arch" },
  farmhouse: { label: "Farmhouse", mode: "arch" },
  ranch: { label: "Ranch", mode: "arch" },
  modern: { label: "Modern", mode: "arch" },
  duplex: { label: "Duplex", mode: "kind" },
  commercial: { label: "Shop", mode: "kind" },
  bakery_cafe: { label: "Bakery/Café", mode: "kind" },
  corner_market: { label: "Market", mode: "kind" },
  office_plaza: { label: "Office", mode: "kind" },
  fire_station: { label: "Firehouse", mode: "kind" },
  police_station: { label: "Police", mode: "kind" },
  post_office: { label: "Post Office", mode: "kind" },
  city_hall: { label: "City Hall", mode: "kind" },
  hospital_clinic: { label: "Hospital", mode: "kind" },
  sanitation: { label: "DPW", mode: "kind" },
  industrial: { label: "Industrial", mode: "kind" },
  transit_station: { label: "Station", mode: "kind" },
  museum: { label: "Museum", mode: "kind" },
  greenhouse: { label: "Greenhouse", mode: "kind" },
  apartments: { label: "Apts", mode: "kind" },
  garage: { label: "Garage", mode: "kind" },
  civic: { label: "Civic", mode: "kind" },
  school: { label: "School", mode: "kind" },
};

// 12 realistic New England house color presets for real-world address matching
export const HOUSE_COLOR_PRESETS = {
  yellow: {
    label: "Colonial Yellow",
    swatch: "#edc258",
    roofLight: "#c49166",
    roofMain: "#996947",
    roofDark: "#69422b",
    wallLight: "#fce38d",
    wallMain: "#edc258",
    wallShade: "#c79434",
    trim: "#f7ebd2",
    trimShade: "#cca97c",
    door: "#8c512c",
    doorDark: "#542d17",
    shutter: "#5e3d2a",
    porchWood: "#b87442",
    windowGlow: "#ffe066",
  },
  white: {
    label: "Colonial White",
    swatch: "#ece8dd",
    roofLight: "#737a87",
    roofMain: "#535964",
    roofDark: "#373c45",
    wallLight: "#f8f6f0",
    wallMain: "#e8e3d8",
    wallShade: "#c6c0b2",
    trim: "#ffffff",
    trimShade: "#d5d0c4",
    door: "#b33c38",
    doorDark: "#782422",
    shutter: "#2f5945",
    porchWood: "#b89f82",
    windowGlow: "#a4d4ed",
  },
  gray: {
    label: "Light Gray",
    swatch: "#b8c3ca",
    roofLight: "#656d78",
    roofMain: "#484f59",
    roofDark: "#2e333b",
    wallLight: "#d8dfe3",
    wallMain: "#b8c3ca",
    wallShade: "#94a2ab",
    trim: "#f7f9fa",
    trimShade: "#c8d0d6",
    door: "#3a567a",
    doorDark: "#23364f",
    shutter: "#2c3d54",
    porchWood: "#b3a99c",
    windowGlow: "#b2dcf0",
  },
  charcoal: {
    label: "Dark Charcoal",
    swatch: "#5a636e",
    roofLight: "#555c66",
    roofMain: "#3a4047",
    roofDark: "#24282e",
    wallLight: "#737d8a",
    wallMain: "#5a636e",
    wallShade: "#414852",
    trim: "#f5f5f0",
    trimShade: "#cfd1cc",
    door: "#c47d3b",
    doorDark: "#824f20",
    shutter: "#2c3138",
    porchWood: "#b89b78",
    windowGlow: "#ffeba1",
  },
  navy: {
    label: "Deep Navy",
    swatch: "#3b5678",
    roofLight: "#737a87",
    roofMain: "#535964",
    roofDark: "#373c45",
    wallLight: "#52739c",
    wallMain: "#3b5678",
    wallShade: "#273b54",
    trim: "#f8f8f5",
    trimShade: "#cfd4db",
    door: "#d9a43b",
    doorDark: "#966d1f",
    shutter: "#1e2e42",
    porchWood: "#bfa88a",
    windowGlow: "#ffefa8",
  },
  slate_blue: {
    label: "Cape Cod Blue",
    swatch: "#8ab0cf",
    roofLight: "#7b818c",
    roofMain: "#5c616b",
    roofDark: "#3f434a",
    wallLight: "#bad3e8",
    wallMain: "#8ab0cf",
    wallShade: "#688eb0",
    trim: "#f7f7f2",
    trimShade: "#cfd3d8",
    door: "#d9a43b",
    doorDark: "#966d1f",
    shutter: "#344a63",
    porchWood: "#b5a696",
    windowGlow: "#b4def2",
  },
  sage: {
    label: "Newton Sage",
    swatch: "#9fc096",
    roofLight: "#9c7054",
    roofMain: "#7a533c",
    roofDark: "#543726",
    wallLight: "#c4dbba",
    wallMain: "#9fc096",
    wallShade: "#7da074",
    trim: "#f4f0e4",
    trimShade: "#ccc6b6",
    door: "#874e31",
    doorDark: "#572f1c",
    shutter: "#3d5444",
    porchWood: "#b58b63",
    windowGlow: "#a8d8ee",
  },
  cream_stucco: {
    label: "Cream Stucco",
    swatch: "#e6d5b8",
    roofLight: "#7b746c",
    roofMain: "#5c5650",
    roofDark: "#3d3935",
    wallLight: "#f5ebd8",
    wallMain: "#e6d5b8",
    wallShade: "#c9b594",
    trim: "#faf7f0",
    trimShade: "#d4cbb8",
    door: "#7a442e",
    doorDark: "#4f2a1b",
    shutter: "#54473d",
    porchWood: "#c2a88c",
    windowGlow: "#b0d9ed",
    isStucco: true,
  },
  brick: {
    label: "Red Brick",
    swatch: "#9e3a2e",
    roofLight: "#8c6956",
    roofMain: "#664a3e",
    roofDark: "#402d26",
    wallLight: "#c75540",
    wallMain: "#9e3a2e",
    wallShade: "#70241e",
    trim: "#e6d8ca",
    trimShade: "#b8a496",
    door: "#733e24",
    doorDark: "#452213",
    shutter: "#3d2c29",
    porchWood: "#c9b8aa",
    windowGlow: "#ffe066",
    isBrick: true,
  },
  cedar_brown: {
    label: "Cedar Shingle",
    swatch: "#9e7452",
    roofLight: "#628068",
    roofMain: "#46614c",
    roofDark: "#2d4232",
    wallLight: "#bd926c",
    wallMain: "#9e7452",
    wallShade: "#7a563a",
    trim: "#f5f1e6",
    trimShade: "#cfc7b6",
    door: "#3a5c46",
    doorDark: "#233b2c",
    shutter: "#384a3d",
    porchWood: "#b88a5d",
    windowGlow: "#ffe9a8",
  },
  tan: {
    label: "Warm Tan",
    swatch: "#d4b48a",
    roofLight: "#9e6b52",
    roofMain: "#7a4f3b",
    roofDark: "#523325",
    wallLight: "#ebd2ad",
    wallMain: "#d4b48a",
    wallShade: "#b39166",
    trim: "#f7f3ea",
    trimShade: "#d1c8b8",
    door: "#8c3735",
    doorDark: "#5c201f",
    shutter: "#4d3c30",
    porchWood: "#b88a5d",
    windowGlow: "#b0d9ed",
  },
  red_clapboard: {
    label: "Barn Red",
    swatch: "#a83d38",
    roofLight: "#6e7480",
    roofMain: "#4d525c",
    roofDark: "#32363d",
    wallLight: "#c9534d",
    wallMain: "#a83d38",
    wallShade: "#802a26",
    trim: "#f7f5f0",
    trimShade: "#d4cfc6",
    door: "#364d3f",
    doorDark: "#203026",
    shutter: "#2c333b",
    porchWood: "#b89f82",
    windowGlow: "#ffeba6",
  },
  forest_green: {
    label: "Historic Forest",
    swatch: "#3c634d",
    roofLight: "#8a684e",
    roofMain: "#664935",
    roofDark: "#453022",
    wallLight: "#518065",
    wallMain: "#3c634d",
    wallShade: "#294736",
    trim: "#f6f2e6",
    trimShade: "#cfc8b6",
    door: "#b5483a",
    doorDark: "#782b22",
    shutter: "#21362a",
    porchWood: "#c29668",
    windowGlow: "#ffefa8",
  },
  buttercream: {
    label: "Buttercream",
    swatch: "#f2e1b6",
    roofLight: "#6e7c8a",
    roofMain: "#4d5a66",
    roofDark: "#323b45",
    wallLight: "#fcf2d7",
    wallMain: "#f2e1b6",
    wallShade: "#d4be8e",
    trim: "#ffffff",
    trimShade: "#d6ceb8",
    door: "#3b5f85",
    doorDark: "#243c57",
    shutter: "#365446",
    porchWood: "#c49a6c",
    windowGlow: "#b4e0f5",
  },
  bc_gothic: {
    label: "BC Collegiate Gothic",
    swatch: "#8a2434",
    roofLight: "#5d6473",
    roofMain: "#414754",
    roofDark: "#292d36",
    wallLight: "#d9d0bd",
    wallMain: "#c2b7a1",
    wallShade: "#9c917d",
    trim: "#ece6d8",
    trimShade: "#bfb6a3",
    door: "#6e1b2a",
    doorDark: "#45101a",
    shutter: "#6e1b2a",
    porchWood: "#b5ab98",
    windowGlow: "#ffe699",
    isStone: true,
  },
  jerusalem_stone: {
    label: "Jerusalem Stone",
    swatch: "#e8d9bc",
    roofLight: "#cc6c47",
    roofMain: "#a84e32",
    roofDark: "#78321e",
    wallLight: "#f7eedb",
    wallMain: "#e8d9bc",
    wallShade: "#cbb896",
    trim: "#faf5e8",
    trimShade: "#cfc1a3",
    door: "#6e462b",
    doorDark: "#452917",
    shutter: "#2c5e4a",
    porchWood: "#d9ccb0",
    windowGlow: "#ffe680",
    isJerusalemStone: true,
  },
  jerusalem_gold: {
    label: "Golden Jerusalem Stone",
    swatch: "#e8cf99",
    roofLight: "#d4734a",
    roofMain: "#b05334",
    roofDark: "#7d361e",
    wallLight: "#faebc4",
    wallMain: "#e8cf99",
    wallShade: "#c7a96e",
    trim: "#fcf7e8",
    trimShade: "#d4be92",
    door: "#214c8a",
    doorDark: "#14315c",
    shutter: "#214c8a",
    porchWood: "#dec899",
    windowGlow: "#ffe680",
    isJerusalemStone: true,
  },
  jerusalem_rose: {
    label: "Rose Jerusalem Stone",
    swatch: "#e6cfc0",
    roofLight: "#c76846",
    roofMain: "#9e492e",
    roofDark: "#6e2e1b",
    wallLight: "#f7e8de",
    wallMain: "#e6cfc0",
    wallShade: "#c4a997",
    trim: "#faf3ed",
    trimShade: "#cfc0b4",
    door: "#5c3b28",
    doorDark: "#382216",
    shutter: "#35595e",
    porchWood: "#d6c2b4",
    windowGlow: "#ffe680",
    isJerusalemStone: true,
  },
  bauhaus_white: {
    label: "Tel Aviv Bauhaus White",
    swatch: "#f2efe8",
    roofLight: "#d9d4c7",
    roofMain: "#bfbab0",
    roofDark: "#8f8b82",
    wallLight: "#ffffff",
    wallMain: "#f2efe8",
    wallShade: "#d4cfc4",
    trim: "#ffffff",
    trimShade: "#c7c2b8",
    door: "#2d6099",
    doorDark: "#1b3d66",
    shutter: "#2d6099",
    porchWood: "#d9d4ca",
    windowGlow: "#ffe88a",
    isStucco: true,
  },
  terracotta_stucco: {
    label: "Mediterranean Stucco",
    swatch: "#e8c8a2",
    roofLight: "#d46c44",
    roofMain: "#b34d2c",
    roofDark: "#7d311a",
    wallLight: "#f7e0c4",
    wallMain: "#e8c8a2",
    wallShade: "#c7a379",
    trim: "#fcf6ed",
    trimShade: "#d4c3ad",
    door: "#2c6352",
    doorDark: "#1a4034",
    shutter: "#2c6352",
    porchWood: "#d4b590",
    windowGlow: "#ffe680",
    isStucco: true,
  },
  alpine_chalet: {
    label: "Alpine Timber Chalet",
    swatch: "#8c5936",
    roofLight: "#5c6473",
    roofMain: "#414854",
    roofDark: "#292e38",
    wallLight: "#b57a4c",
    wallMain: "#8c5936",
    wallShade: "#633c22",
    trim: "#f5efe2",
    trimShade: "#cfc5b2",
    door: "#4a2a16",
    doorDark: "#2e180b",
    shutter: "#265c3b",
    porchWood: "#a86e42",
    windowGlow: "#ffe478",
  },
  tropical_coral: {
    label: "Tropical Coral Stucco",
    swatch: "#f29f85",
    roofLight: "#d96c4a",
    roofMain: "#b84e30",
    roofDark: "#82311b",
    wallLight: "#ffc4b0",
    wallMain: "#f29f85",
    wallShade: "#d4795d",
    trim: "#ffffff",
    trimShade: "#dfd5cc",
    door: "#248f9c",
    doorDark: "#155e69",
    shutter: "#248f9c",
    porchWood: "#e8d2b0",
    windowGlow: "#fff0a6",
    isStucco: true,
  },
  tropical_mint: {
    label: "Tropical Seafoam Stucco",
    swatch: "#96d9c6",
    roofLight: "#d96c4a",
    roofMain: "#b84e30",
    roofDark: "#82311b",
    wallLight: "#c4f2e4",
    wallMain: "#96d9c6",
    wallShade: "#6eb8a3",
    trim: "#ffffff",
    trimShade: "#d4e3de",
    door: "#e06d4a",
    doorDark: "#9c4328",
    shutter: "#246e66",
    porchWood: "#e8d8ba",
    windowGlow: "#fff0a6",
    isStucco: true,
  },
  europe_ochre: {
    label: "European Ochre Plaster",
    swatch: "#e3b868",
    roofLight: "#bd583a",
    roofMain: "#963f26",
    roofDark: "#692817",
    wallLight: "#f5d490",
    wallMain: "#e3b868",
    wallShade: "#bf9245",
    trim: "#faf5eb",
    trimShade: "#cfc7b8",
    door: "#4a3324",
    doorDark: "#2b1c12",
    shutter: "#2c5743",
    porchWood: "#c7b296",
    windowGlow: "#ffe685",
    isStucco: true,
  },
  machiya_slate: {
    label: "East Asian Timber & Plaster",
    swatch: "#e8e3d8",
    roofLight: "#5a6373",
    roofMain: "#3d4452",
    roofDark: "#242933",
    wallLight: "#f7f4ed",
    wallMain: "#e8e3d8",
    wallShade: "#c7c0b2",
    trim: "#4a3222",
    trimShade: "#2e1e14",
    door: "#5c3b24",
    doorDark: "#362113",
    shutter: "#3d2a1d",
    porchWood: "#754f34",
    windowGlow: "#ffe699",
    isStucco: true,
  },
  adobe_sand: {
    label: "Desert Sandstone",
    swatch: "#dbb086",
    roofLight: "#c99668",
    roofMain: "#a8774d",
    roofDark: "#7a5332",
    wallLight: "#f0cba6",
    wallMain: "#dbb086",
    wallShade: "#b88a5e",
    trim: "#f5e3cc",
    trimShade: "#c9b093",
    door: "#2c6e73",
    doorDark: "#1a474a",
    shutter: "#2c6e73",
    porchWood: "#cca278",
    windowGlow: "#ffe680",
    isStucco: true,
  },
};

export const ROOF_PRESETS = {
  slate: { label: "Slate Blue", swatch: "#55728a", roofLight: "#7695ad", roofMain: "#55728a", roofDark: "#394e61" },
  charcoal: { label: "Charcoal", swatch: "#4a5059", roofLight: "#6c7380", roofMain: "#4a5059", roofDark: "#2e3238" },
  cedar: { label: "Cedar Brown", swatch: "#7a533c", roofLight: "#9c7054", roofMain: "#7a533c", roofDark: "#543726" },
  terracotta: { label: "Terracotta", swatch: "#8f4c3e", roofLight: "#b56958", roofMain: "#8f4c3e", roofDark: "#633228" },
  moss: { label: "Moss Green", swatch: "#46614c", roofLight: "#628068", roofMain: "#46614c", roofDark: "#2d4232" },
};

export const HOUSE_STYLES = [
  HOUSE_COLOR_PRESETS.yellow,
  HOUSE_COLOR_PRESETS.white,
  HOUSE_COLOR_PRESETS.sage,
  HOUSE_COLOR_PRESETS.slate_blue,
  HOUSE_COLOR_PRESETS.cream_stucco,
  HOUSE_COLOR_PRESETS.brick,
  HOUSE_COLOR_PRESETS.gray,
  HOUSE_COLOR_PRESETS.tan,
  HOUSE_COLOR_PRESETS.navy,
  HOUSE_COLOR_PRESETS.cedar_brown,
  HOUSE_COLOR_PRESETS.red_clapboard,
  HOUSE_COLOR_PRESETS.forest_green,
  HOUSE_COLOR_PRESETS.buttercream,
  HOUSE_COLOR_PRESETS.charcoal,
];

/**
 * Normalize street addresses so "565 Boylston St" matches "565 boylston street", etc.
 */
export function normalizeAddress(addr) {
  if (!addr) return "";
  return String(addr)
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\blane\b/g, "ln")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr")
    .replace(/\bcourt\b/g, "ct")
    .replace(/\bterrace\b/g, "ter")
    .replace(/\bplace\b/g, "pl")
    .replace(/\s+/g, " ")
    .trim();
}

function shadeHex(hex, delta) {
  if (typeof hex !== "string" || !hex.startsWith("#") || hex.length !== 7) return hex;
  const clamp = (n) => Math.max(0, Math.min(255, n));
  const r = clamp(parseInt(hex.slice(1, 3), 16) + delta);
  const g = clamp(parseInt(hex.slice(3, 5), 16) + delta);
  const b = clamp(parseInt(hex.slice(5, 7), 16) + delta);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

const DEFAULT_ARCH_LIST = [
  "colonial",
  "cape",
  "craftsman",
  "gambrel",
  "tudor",
  "victorian",
  "brownstone",
  "stone_manor",
  "saltbox",
  "farmhouse",
  "ranch",
  "modern",
];

/**
 * Resolve final architectural style for an individual building using:
 *   1. Real-world address override (data/house_colors.json + iPad Paint House edits)
 *   2. OpenStreetMap building:colour / roof:colour tags (when present)
 *   3. Civic / brick landmark rules or deterministic varied New England palette
 */
export function resolveHouseStyle(building, colorOverrideMap = {}, biomeConfig = null) {
  const isCivic =
    building.kind === "library" ||
    building.kind === "school" ||
    building.kind === "civic";
  const isApartments = building.kind === "apartments";
  const houseStyleMode = biomeConfig?.houseStyle || "new_england";

  let baseStyle;
  if (houseStyleMode === "jerusalem_stone") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    if (building.isHomeBase) {
      baseStyle = { ...HOUSE_COLOR_PRESETS.jerusalem_gold };
    } else if (isCivic) {
      baseStyle = { ...HOUSE_COLOR_PRESETS.jerusalem_gold };
    } else {
      const jPalettes = [
        HOUSE_COLOR_PRESETS.jerusalem_stone,
        HOUSE_COLOR_PRESETS.jerusalem_gold,
        HOUSE_COLOR_PRESETS.jerusalem_rose,
        HOUSE_COLOR_PRESETS.jerusalem_stone,
      ];
      baseStyle = { ...jPalettes[hash % jPalettes.length] };
    }
  } else if (houseStyleMode === "bauhaus_white") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    if (building.isHomeBase) {
      baseStyle = { ...HOUSE_COLOR_PRESETS.bauhaus_white, door: "#2155a3", shutter: "#2155a3" };
    } else {
      const cPalettes = [
        HOUSE_COLOR_PRESETS.bauhaus_white,
        HOUSE_COLOR_PRESETS.bauhaus_white,
        HOUSE_COLOR_PRESETS.cream_stucco,
        HOUSE_COLOR_PRESETS.terracotta_stucco,
      ];
      baseStyle = { ...cPalettes[hash % cPalettes.length] };
    }
  } else if (houseStyleMode === "galilee_stone") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const gPalettes = [
      HOUSE_COLOR_PRESETS.jerusalem_stone,
      HOUSE_COLOR_PRESETS.terracotta_stucco,
      HOUSE_COLOR_PRESETS.bauhaus_white,
      HOUSE_COLOR_PRESETS.jerusalem_rose,
    ];
    baseStyle = building.isHomeBase
      ? { ...HOUSE_COLOR_PRESETS.jerusalem_gold }
      : { ...gPalettes[hash % gPalettes.length] };
  } else if (houseStyleMode === "desert_stucco") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const dPalettes = [
      HOUSE_COLOR_PRESETS.adobe_sand,
      HOUSE_COLOR_PRESETS.terracotta_stucco,
      HOUSE_COLOR_PRESETS.jerusalem_stone,
      HOUSE_COLOR_PRESETS.cream_stucco,
    ];
    baseStyle = building.isHomeBase
      ? { ...HOUSE_COLOR_PRESETS.jerusalem_gold }
      : { ...dPalettes[hash % dPalettes.length] };
  } else if (houseStyleMode === "alpine_timber") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const aPalettes = [
      HOUSE_COLOR_PRESETS.alpine_chalet,
      HOUSE_COLOR_PRESETS.cream_stucco,
      HOUSE_COLOR_PRESETS.cedar_brown,
      HOUSE_COLOR_PRESETS.alpine_chalet,
    ];
    baseStyle = building.isHomeBase
      ? { ...HOUSE_COLOR_PRESETS.alpine_chalet, door: "#c93838" }
      : { ...aPalettes[hash % aPalettes.length] };
  } else if (houseStyleMode === "tropical_pastel") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const tPalettes = [
      HOUSE_COLOR_PRESETS.tropical_coral,
      HOUSE_COLOR_PRESETS.tropical_mint,
      HOUSE_COLOR_PRESETS.yellow,
      HOUSE_COLOR_PRESETS.bauhaus_white,
    ];
    baseStyle = building.isHomeBase
      ? { ...HOUSE_COLOR_PRESETS.tropical_coral }
      : { ...tPalettes[hash % tPalettes.length] };
  } else if (houseStyleMode === "european_rowhouse") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const ePalettes = [
      HOUSE_COLOR_PRESETS.europe_ochre,
      HOUSE_COLOR_PRESETS.brick,
      HOUSE_COLOR_PRESETS.cream_stucco,
      HOUSE_COLOR_PRESETS.terracotta_stucco,
      HOUSE_COLOR_PRESETS.slate_blue,
    ];
    baseStyle = building.isHomeBase
      ? { ...HOUSE_COLOR_PRESETS.europe_ochre }
      : { ...ePalettes[hash % ePalettes.length] };
  } else if (houseStyleMode === "east_asian_tiled") {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const eaPalettes = [
      HOUSE_COLOR_PRESETS.machiya_slate,
      HOUSE_COLOR_PRESETS.machiya_slate,
      HOUSE_COLOR_PRESETS.cream_stucco,
      HOUSE_COLOR_PRESETS.gray,
    ];
    baseStyle = building.isHomeBase
      ? { ...HOUSE_COLOR_PRESETS.machiya_slate, door: "#c93838" }
      : { ...eaPalettes[hash % eaPalettes.length] };
  } else if (building.isHomeBase) {
    baseStyle = { ...HOUSE_COLOR_PRESETS.yellow };
  } else if (building.bcCampus) {
    baseStyle = { ...HOUSE_COLOR_PRESETS.bc_gothic };
  } else if (building.gothicCrypt) {
    baseStyle = { ...HOUSE_COLOR_PRESETS.charcoal };
  } else if (isCivic) {
    baseStyle = { ...HOUSE_COLOR_PRESETS.brick };
  } else if (isApartments) {
    const hash = Math.abs((building.bounds?.minX || 0) * 11 + (building.bounds?.minY || 0) * 17);
    const aptPalettes = [HOUSE_COLOR_PRESETS.brick, HOUSE_COLOR_PRESETS.tan, HOUSE_COLOR_PRESETS.cream_stucco, HOUSE_COLOR_PRESETS.gray];
    baseStyle = { ...aptPalettes[hash % aptPalettes.length] };
  } else {
    const hash = Math.abs(
      (building.styleIndex || 1) * 7 + (building.bounds?.minX || 0) * 13 + (building.bounds?.minY || 0) * 29
    );
    const idx = (hash % (HOUSE_STYLES.length - 1)) + 1;
    baseStyle = { ...HOUSE_STYLES[idx] };
  }

  // Deterministic house architecture fallback if building.arch wasn't pre-tagged
  if (building.isHomeBase) {
    baseStyle.arch = "colonial";
  } else if (building.arch) {
    baseStyle.arch = building.arch;
  } else {
    const h = Math.abs(
      (building.styleIndex || 1) * 19 + (building.bounds?.minX || 0) * 31 + (building.bounds?.minY || 0) * 17
    );
    baseStyle.arch = DEFAULT_ARCH_LIST[h % DEFAULT_ARCH_LIST.length];
  }

  // Apply OSM color tags if available
  if (building.osmColor) {
    const key = building.osmColor.toLowerCase();
    if (HOUSE_COLOR_PRESETS[key]) {
      baseStyle = { ...baseStyle, ...HOUSE_COLOR_PRESETS[key] };
    } else if (key.startsWith("#") && key.length === 7) {
      baseStyle.wallMain = key;
      baseStyle.wallLight = shadeHex(key, 24);
      baseStyle.wallShade = shadeHex(key, -26);
    }
  }
  if (building.osmRoofColor && ROOF_PRESETS[building.osmRoofColor.toLowerCase()]) {
    const r = ROOF_PRESETS[building.osmRoofColor.toLowerCase()];
    baseStyle.roofLight = r.roofLight;
    baseStyle.roofMain = r.roofMain;
    baseStyle.roofDark = r.roofDark;
  }

  // Apply explicit real-world override from data/house_colors.json or in-game Paint House
  const normAddr = normalizeAddress(building.address);
  const override =
    (normAddr && colorOverrideMap[normAddr]) ||
    (building.id && colorOverrideMap[building.id]) ||
    null;

  if (override) {
    if (override.preset && HOUSE_COLOR_PRESETS[override.preset]) {
      baseStyle = { ...baseStyle, ...HOUSE_COLOR_PRESETS[override.preset] };
    }
    if (override.roof && ROOF_PRESETS[override.roof]) {
      const r = ROOF_PRESETS[override.roof];
      baseStyle.roofLight = r.roofLight;
      baseStyle.roofMain = r.roofMain;
      baseStyle.roofDark = r.roofDark;
    } else if (override.roof && override.roof.startsWith("#")) {
      baseStyle.roofMain = override.roof;
      baseStyle.roofLight = shadeHex(override.roof, 24);
      baseStyle.roofDark = shadeHex(override.roof, -26);
    }
    if (override.wall && override.wall.startsWith("#")) {
      baseStyle.wallMain = override.wall;
      baseStyle.wallLight = shadeHex(override.wall, 24);
      baseStyle.wallShade = shadeHex(override.wall, -26);
    }
    if (override.shutter) baseStyle.shutter = override.shutter;
    if (override.door) {
      baseStyle.door = override.door;
      baseStyle.doorDark = shadeHex(override.door, -36);
    }
    if (override.trim) baseStyle.trim = override.trim;
    if (override.kind) baseStyle.overrideKind = override.kind;
    if (override.arch) baseStyle.arch = override.arch;
    if (override.label) baseStyle.overrideLabel = override.label;
  }

  // Warm golden-hour glowing interior windows on every neighborhood home & civic building
  baseStyle.windowGlow = "#ffe070";

  if (biomeConfig) {
    baseStyle.snowRoof = Boolean(biomeConfig.hasSnowRoofs);
    baseStyle.hasRoofLeaves = Boolean(biomeConfig.hasFallenLeaves);
  }
  return baseStyle;
}

/**
 * Classify a building into its specific visual architectural category so schools,
 * BC Gothic halls, libraries, synagogues, churches, firehouses, shops, cafés,
 * offices, apartments, and greenhouses render completely distinct from homes.
 */
export function getBuildingVisualCategory(building, colorOverrideMap = {}) {
  const normAddr = normalizeAddress(building?.address);
  const override =
    (normAddr && colorOverrideMap[normAddr]) ||
    (building?.id && colorOverrideMap[building.id]) ||
    null;
  const kind = override?.kind || building?.kind || "house";
  const label = `${override?.label || ""} ${building?.name || ""} ${building?.address || ""}`.toLowerCase();

  if (kind === "school") {
    return building?.bcCampus ? "bc_school" : "school";
  }
  if (kind === "library") {
    return "library";
  }
  if (kind === "civic") {
    if (building?.gothicCrypt) return "gothic_chapel";
    if (/temple|beth\s*el|synagogue|chabad|congregation|israel|tefillah|shul|beit\s*knesset|בית\s*כנסת|בית\s*הכנסת/.test(label)) {
      return "synagogue";
    }
    if (/mosque|masjid|מסגד|جامع/.test(label)) {
      return "mosque";
    }
    if (/church|chapel|parish|baptist|episcopal|st\.?\s*paul|trinity|כנסייה/.test(label)) {
      return "church";
    }
    return "civic";
  }
  return kind;
}

/**
 * Resolve crisp uppercase pixel-signage text for non-residential buildings.
 */
export function getBuildingSignText(building, category, style = {}) {
  const label = `${style.overrideLabel || ""} ${building?.name || ""}`.toLowerCase();
  switch (category) {
    case "bc_school":
      return /law/.test(label) ? "BC LAW" : "BC";
    case "school":
      return "SCHOOL";
    case "library":
      return "LIBRARY";
    case "synagogue":
      return /temple/.test(label) ? "TEMPLE" : "SHUL";
    case "mosque":
      return "MOSQUE";
    case "church":
      return /chapel/.test(label) ? "CHAPEL" : "CHURCH";
    case "gothic_chapel":
      return "CHAPEL";
    case "civic":
      return "CIVIC";
    case "city_hall":
      return "CITY HALL";
    case "post_office":
      return "POST";
    case "police_station":
      return "POLICE";
    case "sanitation":
      return "DPW";
    case "industrial":
      return /warehouse/.test(label) ? "DEPOT" : "WORKS";
    case "hospital_clinic":
      return /clinic|kupat|קופת/.test(label) ? "CLINIC" : "HOSPITAL";
    case "transit_station":
      return "STATION";
    case "museum":
      return "MUSEUM";
    case "fire_station":
      return "FIRE";
    case "bakery_cafe":
      if (/bagel|rosenfeld/.test(label)) return "BAGELS";
      if (/glida|גלידה|gelato/.test(label)) return "GLIDA";
      if (/licks|cream/.test(label)) return "CREAM";
      if (/dunkin|donut/.test(label)) return "DONUTS";
      if (/bakery|burekas|מאפי|בורקס/.test(label)) return "BAKERY";
      return "CAFE";
    case "corner_market":
      if (/book|ספר/.test(label)) return "BOOKS";
      if (/falafel|פלאפל/.test(label)) return "FALAFEL";
      if (/shawarma|שווארמה/.test(label)) return "SHAWARMA";
      if (/taqueria|taco/.test(label)) return "TACOS";
      if (/makolet|מכולת/.test(label)) return "MAKOLET";
      return "MARKET";
    case "commercial":
      if (/medical|clinic|dental/.test(label)) return "CLINIC";
      return "SHOP";
    case "office_plaza":
      if (/bank/.test(label)) return "BANK";
      if (/medical|clinic/.test(label)) return "CLINIC";
      return "OFFICE";
    default:
      return "";
  }
}

// Tiny crisp 3x5 pixel font for house numbers & architectural signboards (SCHOOL, LIBRARY, CAFE, etc.)
const MINI_GLYPHS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  " ": ["000", "000", "000", "000", "000"],
};

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
}

function drawMiniText(ctx, str, centerX, y, color, scale = 1) {
  const chars = String(str || "")
    .toUpperCase()
    .split("")
    .filter((ch) => MINI_GLYPHS[ch]);
  if (chars.length === 0) return;
  const step = 4 * scale;
  const totalW = chars.length * step - scale;
  let sx = Math.floor(centerX - totalW / 2);
  ctx.fillStyle = color;
  for (const ch of chars) {
    const glyph = MINI_GLYPHS[ch];
    for (let gy = 0; gy < 5; gy++) {
      for (let gx = 0; gx < 3; gx++) {
        if (glyph[gy][gx] === "1") {
          ctx.fillRect(sx + gx * scale, Math.floor(y) + gy * scale, scale, scale);
        }
      }
    }
    sx += step;
  }
}

function drawMiniNumber(ctx, str, centerX, y, color) {
  const digits = String(str).replace(/[^0-9]/g, "").slice(0, 4);
  if (!digits) return;
  drawMiniText(ctx, digits, centerX, y, color, 1);
}

/**
 * Draw a crisp 16-bit architectural signboard marquee (e.g. SCHOOL, LIBRARY, CAFE, FIRE, SHOP)
 * centered at midX, auto-scaling letters to stay razor sharp within maxW.
 */
function drawSignMarquee(
  ctx,
  text,
  midX,
  y,
  maxW,
  { bg = "#1c365c", trim = "#f4d35e", fg = "#fff8dc", hd = 2, O = "#291a18" } = {}
) {
  const clean = String(text || "").toUpperCase().trim();
  if (!clean) return 0;
  const wantScale = hd >= 2 && clean.length * 8 + 10 <= maxW ? 2 : 1;
  const textW = clean.length * 4 * wantScale - wantScale;
  const padX = wantScale >= 2 ? 6 : 4;
  const padY = wantScale >= 2 ? 3 : 2;
  const signW = Math.min(maxW, textW + padX * 2);
  const signH = 5 * wantScale + padY * 2;
  const sx = Math.floor(midX - signW / 2);
  const sy = Math.floor(y);

  px(ctx, sx - 2, sy - 2, signW + 4, signH + 4, O);
  px(ctx, sx - 1, sy - 1, signW + 2, signH + 2, trim);
  px(ctx, sx, sy, signW, signH, bg);
  px(ctx, sx, sy, signW, 1, shadeHex(bg, 22));
  // Subtle corner brass rivets
  px(ctx, sx + 1, sy + 1, 1, 1, trim);
  px(ctx, sx + signW - 2, sy + 1, 1, 1, trim);
  px(ctx, sx + 1, sy + signH - 2, 1, 1, trim);
  px(ctx, sx + signW - 2, sy + signH - 2, 1, 1, trim);
  drawMiniText(ctx, clean, midX, sy + padY, fg, wantScale);
  return signH + 2;
}

/**
 * Draw a tall metallic institutional flagpole with golden ball finial & waving flag (Schools & Civic Halls!).
 */
function drawFlagpole(
  ctx,
  x,
  baseY,
  poleH,
  {
    flagA = "#d9362e",
    flagB = "#f7f3e8",
    canton = "#244c8a",
    hd = 2,
    O = "#291a18",
  } = {}
) {
  const pxX = Math.floor(x);
  const topY = Math.floor(baseY - poleH);
  // Stone pedestal base
  px(ctx, pxX - 2 * hd, baseY - 2 * hd, 5 * hd, 3 * hd, O);
  px(ctx, pxX - hd, baseY - hd, 3 * hd, 2 * hd, "#cfc4b8");
  // Crisp silver flagpole shaft
  px(ctx, pxX - 1, topY, hd + 2, poleH - hd, O);
  px(ctx, pxX, topY, hd, poleH - hd, "#e6ecf2");
  // Golden finial orb on top
  px(ctx, pxX - 1, topY - 2 * hd, hd + 2, 2 * hd, O);
  px(ctx, pxX, topY - 2 * hd + 1, hd, 2 * hd - 1, "#f4d35e");
  // Waving striped banner flying to the right
  const fw = 9 * hd;
  const fh = 6 * hd;
  const fx = pxX + hd;
  const fy = topY + hd;
  px(ctx, fx, fy - 1, fw + 1, fh + 2, O);
  for (let row = 0; row < fh; row++) {
    const wave = row >= Math.floor(fh / 2) ? 1 : 0;
    const col = Math.floor(row / Math.max(1, hd)) % 2 === 0 ? flagA : flagB;
    px(ctx, fx, fy + row, fw - wave, 1, col);
  }
  px(ctx, fx, fy, Math.floor(fw * 0.45), Math.floor(fh * 0.52), canton);
  px(ctx, fx + hd, fy + hd, hd, hd, "#fff8dc");
}

/**
 * Draw a charming projecting wrought-iron sidewalk blade sign off a shop/cafe/market wall.
 */
function drawBladeSign(ctx, wallRightX, y, { bg = "#244c8a", trim = "#f4d35e", accent = "#ffe680", hd = 2, O = "#291a18" } = {}) {
  const bx = Math.floor(wallRightX);
  const by = Math.floor(y);
  // Iron bracket bar
  px(ctx, bx, by, 7 * hd, hd + 1, O);
  px(ctx, bx, by + 1, 6 * hd, 1, "#6c7380");
  // Hanging rectangular blade plaque
  const sw = 6 * hd;
  const sh = 7 * hd;
  px(ctx, bx + hd, by + hd, sw, sh, O);
  px(ctx, bx + hd + 1, by + hd + 1, sw - 2, sh - 2, trim);
  px(ctx, bx + hd + 2, by + hd + 2, sw - 4, sh - 4, bg);
  px(ctx, bx + 2 * hd + 1, by + 2 * hd + 1, Math.max(2, sw - 4 * hd), Math.max(2, sh - 4 * hd), accent);
}

/**
 * Draw a luminous stained-glass rose window (synagogues, churches & gothic chapels).
 */
function drawStainedGlassRose(ctx, cx, cy, r, { palette = "church", O = "#291a18" } = {}) {
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const rad = Math.max(4, Math.floor(r));
  // Outer carved stone ring
  px(ctx, x0 - rad - 1, y0 - rad + 2, (rad + 1) * 2, (rad - 2) * 2, O);
  px(ctx, x0 - rad + 2, y0 - rad - 1, (rad - 2) * 2, (rad + 1) * 2, O);
  px(ctx, x0 - rad, y0 - rad, rad * 2, rad * 2, O);
  px(ctx, x0 - rad + 1, y0 - rad + 1, (rad - 1) * 2, (rad - 1) * 2, "#e0d4c3");

  const inner = Math.max(2, rad - 2);
  if (palette === "synagogue") {
    px(ctx, x0 - inner, y0 - inner, inner * 2, inner * 2, "#1c4a91");
    px(ctx, x0 - inner + 1, y0 - inner + 1, (inner - 1) * 2, (inner - 1) * 2, "#3578d4");
    // Radiant golden geometric star emblem inside blue stained glass
    px(ctx, x0 - inner + 2, y0 - 1, (inner - 2) * 2, 2, "#ffd95c");
    px(ctx, x0 - 1, y0 - inner + 2, 2, (inner - 2) * 2, "#ffd95c");
    px(ctx, x0 - Math.floor(inner * 0.55), y0 - Math.floor(inner * 0.55), Math.max(2, Math.floor(inner * 1.1)), Math.max(2, Math.floor(inner * 1.1)), "#fff2a6");
    px(ctx, x0 - 1, y0 - 1, 2, 2, "#245ca8");
  } else if (palette === "gothic") {
    px(ctx, x0 - inner, y0 - inner, inner * 2, inner * 2, "#3d2a66");
    px(ctx, x0 - inner + 1, y0 - inner + 1, (inner - 1) * 2, (inner - 1) * 2, "#4fd4c4");
    px(ctx, x0 - 1, y0 - inner + 1, 2, (inner - 1) * 2, "#2a1d3d");
    px(ctx, x0 - inner + 1, y0 - 1, (inner - 1) * 2, 2, "#2a1d3d");
    px(ctx, x0 - 2, y0 - 2, 4, 4, "#c99cff");
  } else {
    // Classic multicolor cathedral stained glass (ruby, sapphire, amber, emerald)
    px(ctx, x0 - inner, y0 - inner, inner, inner, "#d93b48");
    px(ctx, x0, y0 - inner, inner, inner, "#3478c9");
    px(ctx, x0 - inner, y0, inner, inner, "#3ca364");
    px(ctx, x0, y0, inner, inner, "#f0a832");
    px(ctx, x0 - 1, y0 - inner, 2, inner * 2, O);
    px(ctx, x0 - inner, y0 - 1, inner * 2, 2, O);
    px(ctx, x0 - 2, y0 - 2, 4, 4, "#fff2a6");
  }
}

/**
 * Draw a wide institutional multi-pane school classroom window (bright daylight sky-blue + cream mullions).
 */
function drawClassroomWindow(ctx, wx, wy, winW, winH, O = "#291a18") {
  px(ctx, wx - 1, wy - 2, winW + 2, 2, O);
  px(ctx, wx, wy - 1, winW, 1, "#ebe2d4");
  px(ctx, wx, wy, winW, winH, O);
  px(ctx, wx + 1, wy + 1, winW - 2, winH - 2, "#f4efe6");
  const gx = wx + 2;
  const gy = wy + 2;
  const gw = Math.max(3, winW - 4);
  const gh = Math.max(3, winH - 4);
  // Bright cool daylight institutional glass + warm lit lower classroom interior
  px(ctx, gx, gy, gw, gh, "#6cb2d6");
  px(ctx, gx, gy, gw, Math.max(2, Math.floor(gh * 0.45)), "#a6dcf5");
  px(ctx, gx + 1, gy + Math.floor(gh * 0.55), Math.max(1, gw - 2), Math.max(2, Math.floor(gh * 0.4)), "#ffe88a");
  px(ctx, gx + 1, gy + 1, Math.max(2, Math.floor(gw * 0.35)), 1, "#ffffff");
  // Crisp white institutional 3-column mullions & transom bar
  px(ctx, gx + Math.floor(gw / 3), gy, 1, gh, "#f4efe6");
  px(ctx, gx + Math.floor((gw * 2) / 3), gy, 1, gh, "#f4efe6");
  px(ctx, gx, gy + Math.floor(gh * 0.42), gw, 1, "#d9cfc2");
  // Molded limestone sill
  px(ctx, wx - 1, wy + winH, winW + 2, 2, O);
  px(ctx, wx, wy + winH, winW, 1, "#dfd6c7");
}

/**
 * Draw a pointed Collegiate Gothic arched stone lancet window (for Boston College campus halls!).
 */
function drawGothicLancetWindow(ctx, wx, wy, winW, winH, O = "#291a18") {
  const half = Math.floor(winW / 2);
  // Pointed gothic stone arch apex
  px(ctx, wx + half - 1, wy - 2, 2, 2, O);
  px(ctx, wx + 1, wy, winW - 2, 2, O);
  px(ctx, wx, wy + 2, winW, winH - 2, O);
  px(ctx, wx + 2, wy + 1, Math.max(2, winW - 4), 2, "#ece5d5");
  px(ctx, wx + 1, wy + 2, winW - 2, winH - 3, "#d8cfbe");
  // Warm amber-leaded cathedral glass inside pointed lancet
  const gx = wx + 2;
  const gy = wy + 3;
  const gw = Math.max(3, winW - 4);
  const gh = Math.max(4, winH - 5);
  px(ctx, gx + Math.floor(gw / 2) - 1, wy + 1, 2, 2, "#ffe680");
  px(ctx, gx, gy, gw, gh, "#cf7c25");
  px(ctx, gx + 1, gy + 1, Math.max(1, gw - 2), Math.max(2, gh - 2), "#ffd95c");
  px(ctx, gx + 1, gy + 1, Math.max(1, gw - 2), Math.max(1, Math.floor(gh * 0.45)), "#fff4b8");
  // Dark iron gothic tracery crossbars
  px(ctx, gx + Math.floor(gw / 2), gy - 1, 1, gh + 1, "#3b2c26");
  px(ctx, gx, gy + Math.floor(gh * 0.45), gw, 1, "#3b2c26");
  px(ctx, wx - 1, wy + winH, winW + 2, 2, O);
  px(ctx, wx, wy + winH, winW, 1, "#ece5d5");
}

/**
 * Draw a lush 32-bit Golden-Hour olive-green boxwood garden shrub (matching sample house/library hedges).
 */
function drawShrub(ctx, x, y, w = 14, h = 11) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  // Soft dusk ground shadow
  px(ctx, x + 1, y + h - 2, w - 2, 3, "rgba(42, 20, 18, 0.34)");
  // Rounded bushy silhouette with 5-tone sunlit olive-green foliage clusters
  px(ctx, x + 2, y, Math.max(2, w - 4), h, "#192914");
  px(ctx, x, y + 2, w, Math.max(2, h - 4), "#192914");
  px(ctx, x + 1, y + 1, Math.max(2, w - 2), Math.max(2, h - 2), "#192914");
  px(ctx, x + 2, y + 1, Math.max(2, w - 4), Math.max(2, h - 2), "#2d4d20");
  px(ctx, x + 1, y + 2, Math.max(2, w - 2), Math.max(2, h - 4), "#2d4d20");
  px(ctx, x + 2, y + 2, Math.max(2, w - 4), Math.max(2, h - 4), "#4b782f");
  // Individual sunlit leaf tufts
  px(ctx, x + 2, y + 2, Math.max(2, Math.floor(w * 0.55)), Math.max(2, Math.floor(h * 0.48)), "#73a63e");
  px(ctx, cx - 2, y + 1, Math.max(2, Math.floor(w * 0.38)), Math.max(2, Math.floor(h * 0.35)), "#73a63e");
  px(ctx, x + 3, y + 2, Math.max(2, Math.floor(w * 0.28)), 2, "#a6cf5c");
  px(ctx, x + w - 4, cy + 1, 2, 2, "#243d19");
}

/**
 * Draw a crisp 32-bit warm cedar-wood picket fence strip (straight from the sample house yard!).
 */
function drawPicketFence(ctx, x, y, width, h = 13) {
  if (width < 8) return;
  // Horizontal rails
  px(ctx, x, y + 3, width, 2, "#361e14");
  px(ctx, x, y + 4, width, 1, "#9c6238");
  px(ctx, x, y + h - 4, width, 2, "#361e14");
  px(ctx, x, y + h - 3, width, 1, "#7d4a28");
  // Individual pointed warm-cedar pickets every 4px
  for (let fx = x; fx < x + width - 2; fx += 4) {
    px(ctx, fx, y + 1, 4, h - 1, "#361e14");
    px(ctx, fx + 1, y, 2, 1, "#361e14");
    px(ctx, fx + 1, y + 1, 2, h - 2, "#a86b3e");
    px(ctx, fx + 1, y + 1, 1, h - 3, "#cf8f59");
    px(ctx, fx + 2, y + 2, 1, h - 3, "#7a4726");
  }
}

/**
 * Draw a 32-bit neighborhood mailbox with red flag on wooden post.
 */
function drawMailbox(ctx, x, y) {
  px(ctx, x + 3, y + 6, 3, 8, "#291a18");
  px(ctx, x + 4, y + 7, 1, 6, "#8c5838");
  px(ctx, x, y + 1, 9, 6, "#291a18");
  px(ctx, x + 1, y, 7, 7, "#291a18");
  px(ctx, x + 1, y + 1, 7, 5, "#8f98a6");
  px(ctx, x + 1, y + 1, 6, 2, "#dce3eb");
  px(ctx, x + 6, y + 2, 2, 3, "#d93b36");
}

/**
 * Draw a lush crimson/tangerine/gold autumn leaf cluster resting on a shingled roof (like the sample house!).
 */
function drawRoofLeafCluster(ctx, cx, cy, seed = 1) {
  const O = "#3d1410";
  // Grounded cluster shadow on shingles
  px(ctx, cx - 7, cy + 3, 15, 3, "rgba(42, 16, 12, 0.32)");
  // Layered organic autumn leaf mound
  px(ctx, cx - 6, cy - 1, 12, 6, O);
  px(ctx, cx - 8, cy + 1, 16, 4, O);
  px(ctx, cx - 4, cy - 3, 8, 4, O);
  px(ctx, cx - 5, cy - 1, 10, 5, "#9c221b");
  px(ctx, cx - 7, cy + 1, 14, 3, "#b82c1d");
  px(ctx, cx - 3, cy - 2, 7, 4, "#e05b22");
  px(ctx, cx - 5, cy, 8, 3, "#f08529");
  px(ctx, cx - 2, cy - 2, 4, 2, "#ffba42");
  px(ctx, cx + 2, cy, 3, 2, "#ffd966");
  // Crisp fluttering stray leaves nearby
  const s = Math.abs(seed);
  px(ctx, cx - 10 + (s % 3), cy - 3, 2, 2, "#c93822");
  px(ctx, cx + 9 - (s % 2), cy + 2, 2, 2, "#f08529");
  px(ctx, cx + 4, cy - 5, 2, 1, "#ffd25a");
}

/**
 * Helper: render rich 32-bit siding texture (staggered brick masonry, stucco, or deep clapboards)
 * plus realistic eave drop-shadow and stone/granite foundation course!
 */
function drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd = 2) {
  const stepY = hd >= 2 ? 4 : 3;
  if (style.isJerusalemStone) {
    // Iconic hand-chiseled Jerusalem Stone (Even Yerushalmit) ashlar limestone block courses!
    const mortar = shadeHex(style.wallShade, -24);
    const blockH = hd >= 2 ? 6 : 4;
    const blockW = hd >= 2 ? 12 : 8;
    for (let ry = wallY + 2; ry < wallY + wallH - 3; ry += blockH) {
      px(ctx, bx + 1, ry, bw - 2, 1, mortar);
      const rowIdx = Math.floor((ry - wallY) / blockH);
      const offset = rowIdx % 2 === 0 ? 0 : Math.floor(blockW / 2);
      for (let rx = bx + 1 + offset; rx < bx + bw - 2; rx += blockW) {
        const bwSeg = Math.min(blockW - 1, bx + bw - 1 - rx);
        if (bwSeg <= 0) continue;
        const h = (rx * 19 + ry * 11) & 7;
        const col =
          h === 0 || h === 3
            ? style.wallLight
            : h === 2 || h === 6
              ? style.wallShade
              : style.wallMain;
        const segH = Math.min(blockH - 1, wallY + wallH - 2 - (ry + 1));
        if (segH <= 0) continue;
        px(ctx, rx, ry + 1, bwSeg, segH, col);
        // Sunlit top-left chiseled bevel & subtle lower-right shadow on each limestone ashlar block
        if (hd >= 2 && bwSeg >= 4 && segH >= 3) {
          px(ctx, rx, ry + 1, bwSeg - 1, 1, shadeHex(style.wallLight, 8));
          px(ctx, rx, ry + 1, 1, segH - 1, style.wallLight);
          px(ctx, rx + 1, ry + segH, bwSeg - 1, 1, style.wallShade);
        }
        if (rx + bwSeg < bx + bw - 1) {
          px(ctx, rx + bwSeg, ry + 1, 1, segH, mortar);
        }
      }
    }
  } else if (style.isBrick) {
    const mortar = "#4a1d19";
    const brickW = hd >= 2 ? 7 : 5;
    for (let ry = wallY + 2; ry < wallY + wallH - 3; ry += stepY) {
      px(ctx, bx + 1, ry, bw - 2, 1, mortar);
      const rowIdx = Math.floor((ry - wallY) / stepY);
      const offset = rowIdx % 2 === 0 ? 0 : Math.floor(brickW / 2);
      for (let rx = bx + 1 + offset; rx < bx + bw - 2; rx += brickW) {
        const bwSeg = Math.min(brickW - 1, bx + bw - 1 - rx);
        if (bwSeg <= 0) continue;
        const h = (rx * 13 + ry * 7) & 7;
        const col =
          h === 0 || h === 5
            ? style.wallLight
            : h === 2 || h === 6
              ? style.wallShade
              : style.wallMain;
        px(ctx, rx, ry + 1, bwSeg, stepY - 1, col);
        if (hd >= 2 && bwSeg >= 3 && h % 3 === 0) {
          px(ctx, rx, ry + 1, bwSeg - 1, 1, style.wallLight);
        }
        if (rx + bwSeg < bx + bw - 1) {
          px(ctx, rx + bwSeg, ry + 1, 1, stepY - 1, mortar);
        }
      }
    }
  } else if (style.isStucco) {
    px(ctx, bx + 1, wallY + wallH - 6 * hd, bw - 2, 3 * hd, "#a85442");
    px(ctx, bx + 1, wallY + wallH - 6 * hd - 1, bw - 2, hd, style.trim);
    for (let sy = wallY + 4; sy < wallY + wallH - 6 * hd; sy += 5) {
      for (let sx = bx + 4; sx < bx + bw - 4; sx += 8) {
        px(ctx, sx, sy, 3, 1, style.wallShade);
        px(ctx, sx, sy - 1, 2, 1, style.wallLight);
      }
    }
  } else {
    // Rich 32-bit horizontal New England clapboards (distinct shadow grooves & sunlit lap edges!)
    const clapStep = hd >= 2 ? 4 : 3;
    const grooveCol = shadeHex(style.wallShade, -26);
    for (let ry = wallY + clapStep; ry < wallY + wallH - 2; ry += clapStep) {
      px(ctx, bx + 1, ry, bw - 2, 1, grooveCol);
      px(ctx, bx + 1, ry - 1, bw - 2, 1, style.wallShade);
      if (hd >= 2 && ry - clapStep + 1 >= wallY + 1) {
        px(ctx, bx + 1, ry - clapStep + 1, bw - 3, 1, style.wallLight);
      }
    }
  }

  // Subtle warm roof-eave overhang shadow cast onto upper clapboards/bricks
  px(ctx, bx + 1, wallY, bw - 2, 2 * hd, "rgba(42, 18, 14, 0.24)");

  // Warm New England stepped stone/granite foundation course along bottom of wall!
  const foundH = Math.max(3, 3 * hd);
  if (wallH >= 10 * hd) {
    px(ctx, bx, wallY + wallH - foundH, bw, foundH, "#75655e");
    px(ctx, bx + 1, wallY + wallH - foundH, bw - 2, hd, "#b8a69a");
    px(ctx, bx, wallY + wallH - foundH - 1, bw, 1, "#291a18");
    const stoneStep = 6 * hd;
    for (let fx = bx + stoneStep; fx < bx + bw - 2; fx += stoneStep) {
      px(ctx, fx, wallY + wallH - foundH + 1, 1, foundH - 1, "#4a3d39");
    }
  }
}

/**
 * Helper: render rich 32-bit pitched shingled roof trapezoid with individual alternating wooden/slate
 * shingles, crisp staggered seams, bold ridge cap, fascia trim & cozy autumn roof leaves!
 */
function drawShingledRoof(
  ctx,
  bx,
  by,
  bw,
  roofH,
  wallY,
  style,
  slopeRatio = 0.16,
  O = "#291a18",
  { hd = 2, leafCluster = true, snowRoof = false, seed = 0 } = {}
) {
  const slopeInsetMax = Math.min(Math.floor(bw * 0.24), Math.max(2 * hd, Math.floor(bw * slopeRatio)));
  const courseH = hd >= 2 ? 4 : 3;
  const shW = hd >= 2 ? 6 : 4;
  const seamCol = shadeHex(style.roofDark, -18);
  const brightEdge = shadeHex(style.roofLight, 18);

  for (let row = 0; row < roofH; row++) {
    const t = row / Math.max(1, roofH - 1);
    const inset = Math.round((1 - t) * slopeInsetMax);
    const rx = bx - 2 * hd + inset;
    const rw = bw + 4 * hd - inset * 2;
    const ry = by + row;

    px(ctx, rx - 1, ry, 1, 1, O);
    px(ctx, rx + rw, ry, 1, 1, O);
    if (row === 0) px(ctx, rx, ry - 1, rw, 1, O);

    const courseIdx = Math.floor(row / courseH);
    const inCourse = row % courseH;
    const stagger = (courseIdx % 2) * Math.floor(shW / 2);

    if (inCourse === courseH - 1 && row > 1 && row < roofH - 2) {
      // Crisp dark horizontal shingle overlap shadow line
      px(ctx, rx, ry, rw, 1, seamCol);
    } else {
      // Paint individual alternating shingle tiles with golden-hour top-left sun -> bottom-right shade!
      const isTopBand = row < roofH * 0.36;
      const isBottomBand = row > roofH * 0.80;
      for (let sx = rx; sx < rx + rw; ) {
        const tileIdx = Math.floor((sx - bx + 100 + stagger) / shW);
        const nextBoundary = rx + ((tileIdx + 1) * shW - ((rx - bx + 100 + stagger) % shW));
        const segW = Math.max(1, Math.min(shW, rx + rw - sx, Math.ceil(nextBoundary - sx)));
        const h = Math.abs(tileIdx * 17 + courseIdx * 31 + seed) & 7;
        const sunFrac = (sx - rx) / Math.max(1, rw);
        let col = style.roofMain;
        if (isBottomBand || sunFrac > 0.78) {
          col = h % 3 === 0 ? style.roofMain : style.roofDark;
        } else if (isTopBand || sunFrac < 0.28) {
          col = h === 0 || h === 3 ? brightEdge : h === 5 ? style.roofMain : style.roofLight;
        } else {
          col = h === 0 || h === 4 ? style.roofLight : h === 2 || h === 6 ? style.roofDark : style.roofMain;
        }
        px(ctx, sx, ry, segW, 1, col);
        // Subtle 1px sunlit top lip on first row of each shingle course
        if (inCourse === 0 && row > 2 && h % 2 === 0 && segW >= 3) {
          px(ctx, sx + 1, ry, segW - 2, 1, sunFrac < 0.5 ? brightEdge : style.roofLight);
        }
        // Crisp 1px vertical joint between shingles
        if (sx + segW < rx + rw - 1) {
          px(ctx, sx + segW - 1, ry, 1, 1, seamCol);
        }
        sx += segW;
      }
    }
  }

  // Bold wooden/slate ridge cap beam along top peak
  const topW = bw + 4 * hd - slopeInsetMax * 2;
  const ridgeX = bx - 2 * hd + slopeInsetMax;
  px(ctx, ridgeX, by, topW, 2 * hd, style.roofDark);
  px(ctx, ridgeX + 1, by, Math.max(2, topW - 2), hd, brightEdge);

  // Thick overhanging eaves & cornice trim beam
  px(ctx, bx - 2 * hd, wallY - hd - 1, bw + 4 * hd, hd + 2, O);
  px(ctx, bx - 2 * hd + 1, wallY - hd, bw + 4 * hd - 2, hd, style.trim);
  px(ctx, bx - 2 * hd + 1, wallY, bw + 4 * hd - 2, 1, style.trimShade);

  // Sparkling Winter Snow Blanket & Icicles on roofs when Snow Day / Tundra Winter is active!
  const activeSnowRoof = Boolean(snowRoof || style.snowRoof);
  const allowLeaves = leafCluster && style.hasRoofLeaves !== false;
  if (activeSnowRoof) {
    const snowBands = Math.max(3 * hd, Math.floor(roofH * 0.42));
    for (let row = 0; row < snowBands; row++) {
      const t = row / Math.max(1, roofH - 1);
      const inset = Math.round((1 - t) * slopeInsetMax);
      const rx = bx - 2 * hd + inset + 1;
      const rw = Math.max(2, bw + 4 * hd - inset * 2 - 2);
      px(ctx, rx, by + row, rw, 1, row < snowBands - hd ? "#ffffff" : "#d0e8fa");
    }
    // Fluffy snow drift along lower eaves + tiny sparkling icicles!
    px(ctx, bx - 2 * hd + 1, wallY - 2 * hd, bw + 4 * hd - 2, 2 * hd, "#ffffff");
    px(ctx, bx - 2 * hd + 1, wallY - hd, bw + 4 * hd - 2, hd, "#cde6fa");
    for (let ix = bx; ix < bx + bw; ix += 7 * hd) {
      px(ctx, ix, wallY, hd, 2 * hd, "#b8e2fc");
      px(ctx, ix, wallY, hd, hd, "#ffffff");
    }
  } else if (allowLeaves && hd >= 2 && bw >= 42 && roofH >= 20) {
    // Cozy autumn leaf cluster & stray fallen leaves resting on the roof shingles!
    const lcx = bx + Math.floor(bw * (((seed & 1) === 0 ? 0.68 : 0.32)));
    const lcy = by + Math.floor(roofH * 0.56);
    drawRoofLeafCluster(ctx, lcx, lcy, seed + bx);
  }
  return slopeInsetMax;
}

/**
 * Helper: render rich 32-bit brick masonry chimney poking above the roof ridge.
 */
function drawChimney(ctx, chX, chY, w = 10, h = 14, O = "#291a18") {
  px(ctx, chX - 1, chY - 1, w + 2, h + 2, O);
  px(ctx, chX, chY, w, h, "#9c4333");
  px(ctx, chX + w - 3, chY, 3, h, "#6e2920");
  // Individual brick mortar courses on chimney
  for (let ry = chY + 3; ry < chY + h - 1; ry += 3) {
    px(ctx, chX, ry, w, 1, "#4a1d19");
    const off = ((ry - chY) / 3) % 2 === 0 ? 2 : 5;
    if (off < w - 1) px(ctx, chX + off, ry + 1, 1, 2, "#4a1d19");
  }
  // Protruding limestone/brick chimney cap + dark flue top
  px(ctx, chX - 2, chY - 1, w + 4, 4, O);
  px(ctx, chX - 1, chY, w + 2, 2, "#d6c5b4");
  px(ctx, chX - 1, chY + 2, w + 2, 1, "#9c8a7c");
  px(ctx, chX + 1, chY - 2, Math.max(2, w - 2), 2, "#36221e");
}

/**
 * Helper: render crisp house number plaque on porch/roof for 1-house-per-address identity.
 */
function drawAddressPlaque(ctx, building, midX, plaqueY, bw, O = "#291a18") {
  if (!building.houseNumber || bw < 40) return;
  const numStr = String(building.houseNumber).replace(/[^0-9]/g, "").slice(0, 4);
  if (!numStr) return;
  const plaqueW = numStr.length * 4 + 4;
  const plaqueX = Math.floor(midX - plaqueW / 2);
  px(ctx, plaqueX - 1, plaqueY - 1, plaqueW + 2, 9, O);
  px(
    ctx,
    plaqueX,
    plaqueY,
    plaqueW,
    7,
    building.isHomeBase ? "#4a2c18" : "#3a251c"
  );
  px(ctx, plaqueX, plaqueY, plaqueW, 1, "#d9a760");
  drawMiniNumber(
    ctx,
    numStr,
    midX,
    plaqueY + 1,
    building.isHomeBase ? "#ffe680" : "#f7ebd2"
  );
}

/**
 * Helper: render rich 32-bit Golden-Hour glowing multi-pane window (matching the sample Yellow House!).
 */
function drawColonialWindow(
  ctx,
  wx,
  winY,
  style,
  { flowerbox = false, shutters = true, winW = 11, winH = 13, panesX = 2, panesY = 2 } = {},
  O = "#291a18"
) {
  // Warm ambient golden-hour lantern glow halo softly illuminating the frame & clapboards!
  px(ctx, wx - 2, winY - 2, winW + 4, winH + 5, "rgba(255, 198, 72, 0.22)");

  // Molded header lintel above window
  px(ctx, wx - 1, winY - 2, winW + 2, 2, O);
  px(ctx, wx, winY - 1, winW, 1, style.trim);

  if (shutters) {
    const shW = winW >= 11 ? 4 : 3;
    px(ctx, wx - shW, winY, shW, winH, O);
    px(ctx, wx - shW + 1, winY + 1, shW - 1, winH - 2, style.shutter);
    px(ctx, wx + winW, winY, shW, winH, O);
    px(ctx, wx + winW, winY + 1, shW - 1, winH - 2, style.shutter);
    for (let ly = winY + 2; ly < winY + winH - 1; ly += 2) {
      px(ctx, wx - shW + 1, ly, shW - 1, 1, O);
      px(ctx, wx + winW, ly, shW - 1, 1, O);
    }
  }

  // Outer espresso outline + warm wood/cream outer casing
  px(ctx, wx, winY, winW, winH, O);
  px(ctx, wx + 1, winY + 1, winW - 2, winH - 2, style.trim);
  px(ctx, wx + 2, winY + 2, Math.max(2, winW - 4), Math.max(2, winH - 4), O);

  // Radiant 4-layer Golden-Hour lantern interior glass!
  const gx = wx + 2;
  const gy = winY + 2;
  const gw = Math.max(2, winW - 4);
  const gh = Math.max(2, winH - 4);
  px(ctx, gx, gy, gw, gh, "#e38222");
  px(ctx, gx + 1, gy + 1, Math.max(1, gw - 2), Math.max(1, gh - 2), "#ffbc3b");
  px(ctx, gx + 1, gy + 1, Math.max(1, gw - 2), Math.max(1, gh - 3), "#ffe36e");
  if (gw >= 5 && gh >= 5) {
    px(ctx, gx + 2, gy + 2, Math.max(1, gw - 4), Math.max(1, gh - 4), "#fff8c7");
    px(ctx, gx + 2, gy + 2, 2, 1, "#ffffff");
  } else {
    px(ctx, gx + 1, gy + 1, 1, 1, "#fff9cc");
  }

  // Crisp dark wood window muntin bars (4-pane or 6-pane grid!)
  const muntin = "#593520";
  for (let i = 1; i < panesX; i++) {
    const mx = gx + Math.floor((gw * i) / panesX);
    px(ctx, mx, gy, 1, gh, muntin);
  }
  for (let j = 1; j < panesY; j++) {
    const my = gy + Math.floor((gh * j) / panesY);
    px(ctx, gx, my, gw, 1, muntin);
  }

  // Protruding molded window sill with warm golden light bounce!
  px(ctx, wx - 1, winY + winH, winW + 2, 3, O);
  px(ctx, wx, winY + winH, winW, 1, "#ffe699");
  px(ctx, wx, winY + winH + 1, winW, 1, style.trimShade);

  if (flowerbox) {
    px(ctx, wx - 1, winY + winH + 1, winW + 2, 5, O);
    px(ctx, wx, winY + winH + 2, winW, 3, "#8c5432");
    px(ctx, wx, winY + winH + 2, winW, 1, "#b5744a");
    px(ctx, wx, winY + winH + 1, winW, 2, "#3f782c");
    px(ctx, wx + 1, winY + winH, 3, 2, "#6aa33b");
    px(ctx, wx + 2, winY + winH + 1, 2, 1, "#eb5e48");
    px(ctx, wx + Math.floor(winW / 2), winY + winH, 2, 1, "#ffe575");
    px(ctx, wx + winW - 3, winY + winH + 1, 2, 1, "#fff2b2");
  }
}

/**
 * Helper: render tall arched glowing golden civic window (straight from the sample Library!).
 */
function drawArchedCivicWindow(ctx, wx, winY, style, winW = 11, winH = 19, O = "#291a18") {
  // Soft warm ambient glow radiating gently around the arched library window!
  px(ctx, wx - 2, winY - 1, winW + 4, winH + 4, "rgba(255, 198, 72, 0.22)");
  // Rounded stone arch surround + carved stone keystone at top center!
  px(ctx, wx + 2, winY, winW - 4, 2, O);
  px(ctx, wx + 1, winY + 1, winW - 2, 2, O);
  px(ctx, wx, winY + 3, winW, winH - 3, O);
  // Warm limestone arch molding
  px(ctx, wx + 2, winY + 1, winW - 4, 1, style.trim);
  px(ctx, wx + 1, winY + 2, winW - 2, winH - 3, style.trim);
  px(ctx, wx + Math.floor(winW / 2) - 1, winY - 1, 3, 2, "#f2e8dc");
  // Radiant golden interior glass inside arch!
  const gx = wx + 2;
  const gy = winY + 3;
  const gw = Math.max(3, winW - 4);
  const gh = Math.max(6, winH - 5);
  px(ctx, gx + 1, winY + 2, Math.max(2, gw - 2), 2, "#ffe066");
  px(ctx, gx, gy, gw, gh, "#eb8e24");
  px(ctx, gx + 1, gy, Math.max(2, gw - 2), gh - 1, "#ffd452");
  px(ctx, gx + 1, gy + 1, Math.max(2, gw - 2), Math.max(3, gh - 3), "#fff4b3");
  if (gw >= 5) {
    px(ctx, gx + 2, gy + 2, Math.max(1, gw - 4), Math.max(2, gh - 5), "#fffce0");
  }
  // Crisp dark-wood arched mullion grid
  const muntin = "#5c3720";
  px(ctx, gx + Math.floor(gw / 2), gy - 1, 1, gh + 1, muntin);
  px(ctx, gx, gy + Math.floor(gh * 0.36), gw, 1, muntin);
  px(ctx, gx, gy + Math.floor(gh * 0.68), gw, 1, muntin);
  // Projecting stone sill
  px(ctx, wx - 1, winY + winH, winW + 2, 3, O);
  px(ctx, wx, winY + winH, winW, 1, "#f2e8dc");
  px(ctx, wx, winY + winH + 1, winW, 1, style.trimShade);
}

/**
 * Helper: render an iconic Israeli rooftop solar water heater (Dud Shemesh — upright white cylinder + tilted blue solar collector!).
 */
function drawSolarWaterHeater(ctx, x, y, hd = 2, O = "#291a18") {
  // Upright white insulated boiler cylinder
  const tankW = 4 * hd;
  const tankH = 7 * hd;
  px(ctx, x - 1, y - 1, tankW + 2, tankH + 2, O);
  px(ctx, x, y, tankW, tankH, "#e6ecf2");
  px(ctx, x, y, Math.max(1, Math.floor(tankW * 0.5)), tankH, "#ffffff");
  px(ctx, x + tankW - hd, y, hd, tankH, "#b0bcc9");
  px(ctx, x, y, tankW, hd, "#cfd9e3");
  // Tilted dark sapphire photovoltaic / thermal glass panel right beside boiler
  const panX = x + tankW + hd;
  const panW = 6 * hd;
  const panH = 5 * hd;
  const panY = y + 2 * hd;
  px(ctx, panX - 1, panY - 1, panW + 2, panH + 2, O);
  px(ctx, panX, panY, panW, panH, "#1e3a63");
  px(ctx, panX + 1, panY + 1, panW - 2, panH - 2, "#2f5f9e");
  px(ctx, panX + 1, panY + 1, panW - 2, hd, "#6cb4e8");
  px(ctx, panX + Math.floor(panW / 2), panY, 1, panH, "#162a47");
  // Metal support stand legs
  px(ctx, x + hd, y + tankH + 1, hd, 2 * hd, "#4f5661");
  px(ctx, panX + panW - 2 * hd, panY + panH + 1, hd, hd, "#4f5661");
}

/**
 * Helper: render a bright magenta Bougainvillea bush/vine accent beside Mediterranean stone steps!
 */
function drawBougainvilleaShrub(ctx, x, y, w = 14, h = 11) {
  drawShrub(ctx, x, y, w, h);
  px(ctx, x + 2, y + 2, Math.max(3, Math.floor(w * 0.36)), Math.max(2, Math.floor(h * 0.36)), "#d92b7c");
  px(ctx, x + 3, y + 2, Math.max(2, Math.floor(w * 0.22)), 2, "#ff8cc4");
  px(ctx, x + Math.floor(w * 0.54), y + 3, Math.max(3, Math.floor(w * 0.34)), Math.max(2, Math.floor(h * 0.34)), "#c4216c");
  px(ctx, x + Math.floor(w * 0.58), y + 3, 2, 2, "#ff99cc");
}

/**
 * Bake an individual, pixel-art 16-bit SNES house/building onto an offscreen canvas
 * matching the real OSM footprint (1 house per address!) with distinct architectural
 * silhouettes for New England, Jerusalem Stone, Tel Aviv Bauhaus, Mediterranean,
 * Desert Stucco, shops, apartments, libraries, schools, and civic landmarks.
 */
export function bakeSnesBuildingCanvas(building, tileSize = 16, colorOverrideMap = {}, biomeConfig = null) {
  const hd = tileSize >= 24 ? 2 : 1;
  const { minX, minY, maxX, maxY } = building.bounds;
  const footW = (maxX - minX + 1) * tileSize;
  const footH = (maxY - minY + 1) * tileSize;

  const style = resolveHouseStyle(building, colorOverrideMap, biomeConfig);
  const houseStyleMode = biomeConfig?.houseStyle || "new_england";
  const allowRoofLeaves = biomeConfig ? Boolean(biomeConfig.hasFallenLeaves) : true;
  const effectiveKind = style.overrideKind || building.kind || "house";
  const category = getBuildingVisualCategory(building, colorOverrideMap);
  const signText = getBuildingSignText(building, category, style);
  const arch = style.arch || "colonial";
  const O = "#291a18";
  const bSeed = Math.abs((minX * 19 + minY * 37 + (building.styleIndex || 1) * 11) | 0);

  // Regularize visual building proportions so residential houses share a cohesive, handsome
  // 32-bit New England neighborhood scale while schools, libraries, civic halls, firehouses,
  // and commercial storefronts stand out at unmistakable institutional & village-center scale!
  let bw;
  let bh;
  if (effectiveKind === "house") {
    const rawW = footW - 2 * hd;
    const tightCapW =
      typeof building.maxVisualTilesW === "number" && building.maxVisualTilesW > 0
        ? Math.max(24 * hd, building.maxVisualTilesW * tileSize - 2 * hd)
        : 64 * hd;
    bw = Math.min(tightCapW, Math.max(48 * hd, Math.min(64 * hd, rawW)));
    bh = Math.max(52 * hd, Math.min(60 * hd, footH + 10 * hd));
  } else if (effectiveKind === "duplex") {
    const tightCapW =
      typeof building.maxVisualTilesW === "number" && building.maxVisualTilesW > 0
        ? Math.max(28 * hd, building.maxVisualTilesW * tileSize - 2 * hd)
        : 72 * hd;
    bw = Math.min(tightCapW, Math.max(54 * hd, Math.min(72 * hd, footW - 2 * hd)));
    bh = Math.max(54 * hd, Math.min(64 * hd, footH + 10 * hd));
  } else if (effectiveKind === "garage") {
    bw = Math.max(24 * hd, Math.min(44 * hd, footW - 2 * hd));
    bh = Math.max(28 * hd, Math.min(36 * hd, footH + 4 * hd));
  } else if (effectiveKind === "greenhouse") {
    bw = Math.max(36 * hd, Math.min(64 * hd, footW - 2 * hd));
    bh = Math.max(36 * hd, Math.min(48 * hd, footH + 8 * hd));
  } else if (
    effectiveKind === "library" ||
    effectiveKind === "school" ||
    effectiveKind === "civic" ||
    effectiveKind === "city_hall" ||
    effectiveKind === "museum" ||
    effectiveKind === "hospital_clinic"
  ) {
    bw = Math.max(66 * hd, Math.min(124 * hd, footW - 2 * hd));
    bh = Math.max(62 * hd, Math.min(78 * hd, footH + 14 * hd));
  } else if (
    effectiveKind === "fire_station" ||
    effectiveKind === "police_station" ||
    effectiveKind === "post_office" ||
    effectiveKind === "sanitation" ||
    effectiveKind === "industrial" ||
    effectiveKind === "transit_station"
  ) {
    bw = Math.max(58 * hd, Math.min(104 * hd, footW - 2 * hd));
    bh = Math.max(56 * hd, Math.min(70 * hd, footH + 12 * hd));
  } else if (
    effectiveKind === "commercial" ||
    effectiveKind === "bakery_cafe" ||
    effectiveKind === "corner_market" ||
    effectiveKind === "office_plaza"
  ) {
    bw = Math.max(52 * hd, Math.min(92 * hd, footW - 2 * hd));
    bh = Math.max(52 * hd, Math.min(66 * hd, footH + 12 * hd));
  } else if (effectiveKind === "apartments") {
    bw = Math.max(54 * hd, Math.min(96 * hd, footW - 2 * hd));
    bh = Math.max(60 * hd, Math.min(78 * hd, footH + 16 * hd));
  } else {
    bw = Math.max(20 * hd, footW - 2 * hd);
    bh = Math.max(24 * hd, footH + 6 * hd);
  }

  const isTallLandmark =
    effectiveKind === "school" ||
    effectiveKind === "library" ||
    effectiveKind === "civic" ||
    effectiveKind === "fire_station";
  const hasBladeOrFlag =
    isTallLandmark ||
    effectiveKind === "commercial" ||
    effectiveKind === "bakery_cafe" ||
    effectiveKind === "corner_market" ||
    effectiveKind === "office_plaza";
  const insetBottom = 1 * hd;
  const extraTop = isTallLandmark ? 28 * hd : effectiveKind === "office_plaza" || effectiveKind === "apartments" ? 18 * hd : 14 * hd;
  const padSide = Math.max(hasBladeOrFlag ? 12 * hd : 4 * hd, Math.ceil(Math.max(0, bw - footW) / 2) + (hasBladeOrFlag ? 10 * hd : 4 * hd));
  const padTop = Math.max(extraTop, bh - footH + extraTop);
  const padBottom = 6 * hd;
  const canvasW = footW + padSide * 2;
  const canvasH = footH + padTop + padBottom;
  const { canvas, ctx } = makeCanvas(canvasW, canvasH);

  const bx = Math.floor((canvasW - bw) / 2);
  const bottomY = padTop + footH - insetBottom;
  const by = bottomY - bh;
  const midX = bx + Math.floor(bw / 2);

  // Soft warm golden-hour dusk drop shadow grounded under the building (SE side)
  px(ctx, bx + 3 * hd, by + Math.floor(bh * 0.25), bw + 2 * hd, Math.floor(bh * 0.78), "rgba(42, 20, 18, 0.34)");

  // =========================================================================
  // 0. FORTIFIED OLD CITY STONE WALL (Crenelated Ottoman Ramparts — Jerusalem Old City!)
  // =========================================================================
  if (effectiveKind === "city_wall") {
    const wallStyle = HOUSE_COLOR_PRESETS.jerusalem_gold;
    const rampartH = Math.max(22 * hd, bh);
    px(ctx, bx - 1, by - 1, bw + 2, rampartH + 2, O);
    px(ctx, bx, by, bw, rampartH, wallStyle.wallMain);
    drawWallTexture(ctx, bx, by, bw, rampartH, wallStyle, hd);
    // Crenelated limestone battlements (merlons & embrasures) crowning the city wall!
    const merlonW = 6 * hd;
    const merlonH = 5 * hd;
    for (let mx = bx; mx < bx + bw - 2 * hd; mx += merlonW + 3 * hd) {
      const mw = Math.min(merlonW, bx + bw - mx);
      px(ctx, mx - 1, by - merlonH, mw + 2, merlonH + 1, O);
      px(ctx, mx, by - merlonH + 1, mw, merlonH, wallStyle.wallLight);
      px(ctx, mx, by - merlonH + 1, mw, hd, "#fff8e8");
    }
    // Narrow medieval arrow-slit loopholes along rampart face
    for (let sx = bx + 8 * hd; sx < bx + bw - 6 * hd; sx += 14 * hd) {
      px(ctx, sx, by + 6 * hd, 2 * hd, 7 * hd, "#36281c");
    }
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 0B. EXPANDED MUNICIPAL & INDUSTRIAL TAXONOMY:
  //     Post Office, Police Precinct, City Hall, Hospital/Clinic,
  //     Sanitation/DPW, Industrial Warehouse, Transit Station & Museum!
  // =========================================================================
  if (
    effectiveKind === "post_office" ||
    effectiveKind === "police_station" ||
    effectiveKind === "city_hall" ||
    effectiveKind === "hospital_clinic" ||
    effectiveKind === "sanitation" ||
    effectiveKind === "industrial" ||
    effectiveKind === "transit_station" ||
    effectiveKind === "museum"
  ) {
    const roofH = Math.min(14 * hd, Math.max(9 * hd, Math.floor(bh * 0.22)));
    const wallH = Math.max(26 * hd, bh - roofH);
    const wallY = by + roofH;
    const isIsraelBiome = String(biomeConfig?.id || "").startsWith("israel_");

    const themeMap = {
      post_office: { roof: "#4c5c75", wall: isIsraelBiome ? "#e8d9bc" : "#a84438", trim: "#f5efe6", badgeBg: "#1d4c8f", badgeTrim: "#f4d35e", badgeFg: "#ffffff" },
      police_station: { roof: "#36455c", wall: "#d4dce6", trim: "#1c4a8f", badgeBg: "#143870", badgeTrim: "#68b5ff", badgeFg: "#ffffff" },
      city_hall: { roof: "#475469", wall: "#ebe2d2", trim: "#f7f3eb", badgeBg: "#3d2c63", badgeTrim: "#f4d35e", badgeFg: "#fff8d6" },
      hospital_clinic: { roof: "#587082", wall: "#f2f5f7", trim: "#d4e0e8", badgeBg: "#c92a35", badgeTrim: "#ffffff", badgeFg: "#ffffff" },
      sanitation: { roof: "#526358", wall: "#c9cfc7", trim: "#387849", badgeBg: "#2a633b", badgeTrim: "#f4d35e", badgeFg: "#ffffff" },
      industrial: { roof: "#5e646e", wall: "#9ca3ad", trim: "#69707a", badgeBg: "#3d424d", badgeTrim: "#e8a832", badgeFg: "#ffe885" },
      transit_station: { roof: "#3d6b8c", wall: "#d9e2eb", trim: "#2c5475", badgeBg: "#1b4970", badgeTrim: "#80d6ff", badgeFg: "#ffffff" },
      museum: { roof: "#5c554d", wall: "#e8dec8", trim: "#f7f2e6", badgeBg: "#6e4624", badgeTrim: "#f4d35e", badgeFg: "#fff8dc" },
    };
    const tm = themeMap[effectiveKind];

    // Base Roof + Facade Shell
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, tm.roof);
    if (effectiveKind === "industrial") {
      // Sawtooth corrugated steel industrial roof ridges + rooftop exhaust vents!
      for (let sx = bx + 2 * hd; sx < bx + bw - 6 * hd; sx += 10 * hd) {
        px(ctx, sx, by + hd, 8 * hd, roofH - 2 * hd, "#7c838f");
        px(ctx, sx, by + hd, 3 * hd, roofH - 2 * hd, "#98d4f0"); // sawtooth skylight strip
        px(ctx, sx + 7 * hd, by + hd, hd, roofH - 2 * hd, "#3b404a");
      }
    } else if (effectiveKind === "transit_station") {
      // Arched glass-and-steel station canopy roof!
      px(ctx, bx + 2 * hd, by + 2 * hd, bw - 4 * hd, roofH - 4 * hd, "#7cc4e8");
      for (let gx = bx + 6 * hd; gx < bx + bw - 4 * hd; gx += 8 * hd) {
        px(ctx, gx, by + hd, hd, roofH - 2 * hd, "#2a455e");
      }
    } else {
      px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), shadeHex(tm.roof, -20));
    }

    // Parapet cornice trim + Snow cap in winter
    px(ctx, bx - 2 * hd, wallY - 3 * hd, bw + 4 * hd, 4 * hd, O);
    px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 2 * hd, biomeConfig?.hasSnowRoofs ? "#ffffff" : tm.trim);
    px(ctx, bx, wallY + hd, bw, wallH - hd, tm.wall);

    // Distinct Architectural Crowns & Features per Building Type!
    if (effectiveKind === "city_hall") {
      // Grand domed clock tower + twin flagpoles!
      const tw = 18 * hd;
      const tx = midX - Math.floor(tw / 2);
      const ty = by - 13 * hd;
      px(ctx, midX - 6 * hd, ty - 6 * hd, 12 * hd, 6 * hd, O);
      px(ctx, midX - 5 * hd, ty - 5 * hd, 10 * hd, 5 * hd, "#d9ad4c");
      px(ctx, tx - 1, ty, tw + 2, 15 * hd, O);
      px(ctx, tx, ty + 1, tw, 13 * hd, "#f7f2e6");
      px(ctx, midX - 4 * hd, ty + 3 * hd, 8 * hd, 8 * hd, O);
      px(ctx, midX - 3 * hd, ty + 4 * hd, 6 * hd, 6 * hd, "#ffffff");
      px(ctx, midX, ty + 5 * hd, hd, 3 * hd, O);
      px(ctx, midX, ty + 7 * hd, 2 * hd, hd, O);
      drawFlagpole(ctx, bx + 2 * hd, wallY + wallH + 2 * hd, wallH + roofH + 8 * hd, { hd, O });
      drawFlagpole(ctx, bx + bw - 2 * hd, wallY + wallH + 2 * hd, wallH + roofH + 8 * hd, { hd, O });
    } else if (effectiveKind === "police_station") {
      // Bold royal-blue precinct stripe + glowing blue globe precinct lamps!
      px(ctx, bx, wallY + 3 * hd, bw, 3 * hd, "#1c4a8f");
      px(ctx, bx, wallY + 4 * hd, bw, hd, "#68b5ff");
      for (const lx of [midX - 11 * hd, midX + 8 * hd]) {
        px(ctx, lx, wallY + wallH - 11 * hd, 3 * hd, 3 * hd, O);
        px(ctx, lx + 1, wallY + wallH - 10 * hd, 3 * hd - 2, 3 * hd - 2, "#59bfff");
        px(ctx, lx + hd, wallY + wallH - 10 * hd, hd, hd, "#ffffff");
      }
    } else if (effectiveKind === "hospital_clinic") {
      // Iconic Red Medical Cross (or Red Star of David in Israel!) + ambulance bay canopy!
      const cxM = midX;
      const cyM = wallY + 12 * hd;
      if (isIsraelBiome) {
        // Red Magen David Adom emblem
        px(ctx, cxM - 4 * hd, cyM - 2 * hd, 8 * hd, 2 * hd, "#d9242e");
        px(ctx, cxM - 4 * hd, cyM + 2 * hd, 8 * hd, 2 * hd, "#d9242e");
        px(ctx, cxM - 2 * hd, cyM - 4 * hd, 4 * hd, 8 * hd, "#d9242e");
        px(ctx, cxM - hd, cyM - hd, 2 * hd, 2 * hd, "#ffffff");
      } else {
        px(ctx, cxM - 4 * hd, cyM - hd, 8 * hd, 3 * hd, "#d9242e");
        px(ctx, cxM - hd, cyM - 4 * hd, 3 * hd, 9 * hd, "#d9242e");
      }
    } else if (effectiveKind === "post_office") {
      // Classic regional street postbox right out front (Red in Israel/UK, Blue USPS in US!)
      const pbx = bx + 5 * hd;
      const pby = wallY + wallH - 7 * hd;
      const boxCol = isIsraelBiome || biomeConfig?.id === "european_historic" ? "#cf2828" : "#1f539e";
      px(ctx, pbx - 1, pby - 1, 6 * hd + 2, 8 * hd + 2, O);
      px(ctx, pbx, pby, 6 * hd, 8 * hd, boxCol);
      px(ctx, pbx + hd, pby + 2 * hd, 4 * hd, hd, "#ffffff");
      drawFlagpole(ctx, bx + bw - 3 * hd, wallY + wallH + 2 * hd, wallH + roofH + 6 * hd, { hd, O });
    } else if (effectiveKind === "sanitation" || effectiveKind === "industrial") {
      // Overhead roll-up steel bays + yellow safety bollards (+ green/blue recycling bins for DPW!)
      const bayCount = bw >= 52 * hd ? 2 : 1;
      const bayW = Math.min(18 * hd, Math.floor((bw - 12 * hd) / bayCount));
      const bayH = Math.min(14 * hd, wallH - 12 * hd);
      for (let i = 0; i < bayCount; i++) {
        const bxx =
          bayCount === 2
            ? bx + 5 * hd + i * (bw - 10 * hd - bayW)
            : midX - Math.floor(bayW / 2);
        const byy = wallY + wallH - bayH - hd;
        px(ctx, bxx - 1, byy - 1, bayW + 2, bayH + 2, O);
        px(ctx, bxx, byy, bayW, bayH, "#7a828f");
        for (let sl = byy + 3 * hd; sl < byy + bayH; sl += 3 * hd) {
          px(ctx, bxx, sl, bayW, 1, "#4a505c");
        }
        // Yellow loading dock bollards
        px(ctx, bxx - 2 * hd, wallY + wallH - 4 * hd, hd, 4 * hd, "#f4c430");
        px(ctx, bxx + bayW + hd, wallY + wallH - 4 * hd, hd, 4 * hd, "#f4c430");
      }
      if (effectiveKind === "sanitation") {
        // Green & Blue Municipal Recycling Bins
        px(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 5 * hd, 5 * hd, "#2c8c4c");
        px(ctx, bx + bw - 7 * hd, wallY + wallH - 5 * hd, 5 * hd, 5 * hd, "#2969b8");
      }
    } else if (effectiveKind === "museum") {
      // Colorful vertical hanging museum exhibition banners flanking classical doorway!
      for (const [bnX, bnCol] of [
        [bx + 6 * hd, "#c9384a"],
        [bx + 13 * hd, "#2c6cb8"],
        [bx + bw - 18 * hd, "#2c8c64"],
        [bx + bw - 11 * hd, "#d98c24"],
      ]) {
        if (bnX > bx + 2 * hd && bnX + 4 * hd < bx + bw - 2 * hd) {
          px(ctx, bnX - 1, wallY + 7 * hd, 4 * hd + 2, 13 * hd, O);
          px(ctx, bnX, wallY + 8 * hd, 4 * hd, 11 * hd, bnCol);
          px(ctx, bnX + hd, wallY + 10 * hd, 2 * hd, 2 * hd, "#fff4b8");
        }
      }
    } else if (effectiveKind === "transit_station") {
      // Hanging round station clock + wide glass commuter doors!
      px(ctx, midX - 4 * hd, wallY + 10 * hd, 8 * hd, 8 * hd, O);
      px(ctx, midX - 3 * hd, wallY + 11 * hd, 6 * hd, 6 * hd, "#ffffff");
      px(ctx, midX, wallY + 12 * hd, hd, 2 * hd, O);
      px(ctx, midX, wallY + 14 * hd, 2 * hd, hd, O);
    }

    // Crisp Signboard Marquee + Central Entryway (for non-bay buildings)
    drawSignMarquee(ctx, signText || effectiveKind.toUpperCase(), midX, wallY + 2 * hd, bw - 8 * hd, {
      bg: tm.badgeBg,
      trim: tm.badgeTrim,
      fg: tm.badgeFg,
      hd,
      O,
    });
    if (effectiveKind !== "sanitation" && effectiveKind !== "industrial") {
      const doorW = Math.min(14 * hd, Math.floor(bw * 0.24));
      const doorH = Math.min(12 * hd, wallH - 14 * hd);
      const doorX = midX - Math.floor(doorW / 2);
      const doorY = wallY + wallH - doorH - hd;
      px(ctx, doorX - 2, doorY - 2, doorW + 4, doorH + 3, O);
      px(ctx, doorX, doorY, doorW, doorH, effectiveKind === "hospital_clinic" || effectiveKind === "transit_station" ? "#7cc4e8" : "#5e3622");
      px(ctx, midX, doorY, 1, doorH, O);
      // Flanking daylight windows
      const winW = 8 * hd;
      const winH = 9 * hd;
      const winY = wallY + Math.max(10 * hd, Math.floor((wallH - winH) / 2));
      if (bx + 5 * hd + winW < doorX - 3 * hd) {
        drawClassroomWindow(ctx, bx + 5 * hd, winY, winW, winH, O);
      }
      if (bx + bw - 5 * hd - winW > doorX + doorW + 3 * hd) {
        drawClassroomWindow(ctx, bx + bw - 5 * hd - winW, winY, winW, winH, O);
      }
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 1. GARAGE / SHED / OUTBUILDING (1-car or 2-car wide)
  // =========================================================================
  if (effectiveKind === "garage") {
    const roofH = Math.max(10 * hd, Math.floor(bh * 0.48));
    const wallH = Math.max(10 * hd, bh - roofH);
    const wallY = by + roofH;
    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    drawShingledRoof(ctx, bx, by, bw, roofH, wallY, style, 0.2, O, { hd, leafCluster: false, seed: bSeed });
    if (bw >= 20 * hd && roofH >= 10 * hd) {
      px(ctx, midX - 2 * hd, by + 3 * hd, 4 * hd, 3 * hd, O);
      px(ctx, midX - hd, by + 4 * hd, 2 * hd, hd, style.trim);
    }
    const bays = bw >= 40 * hd ? 2 : 1;
    const bayGap = 4 * hd;
    const doorW = bays === 2 ? Math.floor((bw - 10 * hd) / 2) : Math.max(10 * hd, bw - 8 * hd);
    const doorH = Math.max(8 * hd, wallH - 4 * hd);
    for (let i = 0; i < bays; i++) {
      const dx = bays === 2 ? bx + 3 * hd + i * (doorW + bayGap) : bx + Math.floor((bw - doorW) / 2);
      const dy = wallY + wallH - doorH;
      px(ctx, dx - 1, dy - 1, doorW + 2, doorH + 1, O);
      px(ctx, dx, dy, doorW, doorH, style.trim);
      if (doorH >= 9 * hd && doorW >= 12 * hd) {
        for (let wx = dx + 2 * hd; wx < dx + doorW - 3 * hd; wx += 4 * hd) {
          px(ctx, wx, dy + hd, 2 * hd, 2 * hd, "#ffe066");
        }
      }
      for (let gy = dy + 4 * hd; gy < dy + doorH - 1; gy += 3 * hd) {
        px(ctx, dx + 1, gy, doorW - 2, 1, style.trimShade);
      }
      px(ctx, dx - 1, wallY + wallH + 1, doorW + 2, 3 * hd, "#b5a39c");
    }
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 1B. GLASS GREENHOUSE / GARDEN CONSERVATORY (Crisp 2x HD Crystalline Arched Glass!)
  // =========================================================================
  if (effectiveKind === "greenhouse") {
    const roofH = Math.max(14 * hd, Math.floor(bh * 0.48));
    const wallH = Math.max(14 * hd, bh - roofH);
    const wallY = by + roofH;
    const kneeH = 5 * hd;

    // Translucent icy-cyan glass walls over low stone knee wall
    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, "#9de3f5");
    px(ctx, bx, wallY, bw, Math.floor(wallH * 0.45), "#c9f2fc");
    px(ctx, bx, wallY + wallH - kneeH, bw, kneeH, "#9c9488");
    px(ctx, bx, wallY + wallH - kneeH - hd, bw, hd, "#f7fafc");
    // Lush potted greenery & colorful garden blossoms visible inside the glass!
    for (let gx = bx + 3 * hd; gx < bx + bw - 6 * hd; gx += 7 * hd) {
      px(ctx, gx, wallY + wallH - kneeH - 5 * hd, 5 * hd, 4 * hd, "#2d6e32");
      px(ctx, gx + hd, wallY + wallH - kneeH - 6 * hd, 3 * hd, 3 * hd, "#60bf4b");
      px(ctx, gx + hd, wallY + wallH - kneeH - 5 * hd, 2 * hd, hd, (gx / hd) % 14 < 7 ? "#ff6b8a" : "#ffe066");
    }
    // Arched glass conservatory dome roof with sunlit specular stripes
    const insetMax = Math.min(Math.floor(bw * 0.26), 10 * hd);
    for (let row = 0; row < roofH; row++) {
      const t = row / Math.max(1, roofH - 1);
      const curve = Math.round((1 - Math.sqrt(t)) * insetMax);
      const rx = bx - hd + curve;
      const rw = bw + 2 * hd - curve * 2;
      const ry = by + row;
      px(ctx, rx - 1, ry, 1, 1, O);
      px(ctx, rx + rw, ry, 1, 1, O);
      if (row === 0) px(ctx, rx, ry - 1, rw, 1, O);
      px(ctx, rx, ry, rw, 1, row < roofH * 0.42 ? "#d9f7ff" : "#8dd9f0");
      if (row % (4 * hd) === 0) px(ctx, rx + 1, ry, rw - 2, 1, "#ffffff");
    }
    // Raised glass ridge vent finial along conservatory peak
    const ventW = Math.max(10 * hd, bw - insetMax * 2 - 4 * hd);
    px(ctx, midX - Math.floor(ventW / 2) - 1, by - 3 * hd, ventW + 2, 3 * hd, O);
    px(ctx, midX - Math.floor(ventW / 2), by - 2 * hd, ventW, 2 * hd, "#e8faff");
    // Crisp white iron structural ribs across roof & walls
    for (let mx = bx + 6 * hd; mx < bx + bw - 4 * hd; mx += 7 * hd) {
      px(ctx, mx, by + 2 * hd, hd, roofH + wallH - kneeH - 2 * hd, "#f7fafc");
    }
    px(ctx, bx - hd, wallY - hd, bw + 2 * hd, 2 * hd, "#ffffff");
    px(ctx, bx - hd, wallY + hd, bw + 2 * hd, 1, "#5c9eb5");
    // Conservatory white double glass door
    const doorW = 8 * hd;
    const doorH = Math.min(wallH - 2 * hd, 12 * hd);
    px(ctx, midX - Math.floor(doorW / 2) - 1, wallY + wallH - doorH - 1, doorW + 2, doorH + 2, O);
    px(ctx, midX - Math.floor(doorW / 2), wallY + wallH - doorH, doorW, doorH, "#f7fafc");
    px(ctx, midX - Math.floor(doorW / 2) + hd, wallY + wallH - doorH + hd, doorW - 2 * hd, Math.max(3, doorH - 3 * hd), "#79c7e6");
    px(ctx, midX, wallY + wallH - doorH, 1, doorH, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 1C. FIRE STATION / NEW ENGLAND FIREHOUSE (Flat Parapet, Hose Tower, Siren & Fire Trucks!)
  // =========================================================================
  if (effectiveKind === "fire_station") {
    const roofH = Math.min(14 * hd, Math.max(8 * hd, Math.floor(bh * 0.24)));
    const wallH = Math.max(24 * hd, bh - roofH);
    const wallY = by + roofH;

    // Flat red-brick firehouse parapet & gravel roof
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#594846");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(4, roofH - 4 * hd), "#403332");
    // Bold crimson & limestone cornice trim
    px(ctx, bx - 2 * hd, wallY - 4 * hd, bw + 4 * hd, 5 * hd, O);
    px(ctx, bx - hd, wallY - 3 * hd, bw + 2 * hd, 2 * hd, "#f0e4d6");
    px(ctx, bx - hd, wallY - hd, bw + 2 * hd, 2 * hd, "#c92b24");

    const brickStyle = { ...HOUSE_COLOR_PRESETS.brick };
    px(ctx, bx, wallY + hd, bw, wallH - hd, brickStyle.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, brickStyle, hd);
    // Alternating limestone corner quoins
    for (let qy = wallY + 2 * hd; qy < wallY + wallH - 3 * hd; qy += 5 * hd) {
      const qw = ((qy / hd) % 10 < 5) ? 3 * hd : 2 * hd;
      px(ctx, bx, qy, qw, 3 * hd, "#f0e4d6");
      px(ctx, bx + bw - qw, qy, qw, 3 * hd, "#cfc0b2");
    }

    // Tall brick hose & bell tower on the left rising high above parapet with flashing crimson beacon!
    if (bw >= 34 * hd) {
      const tw = 14 * hd;
      const th = 22 * hd;
      const tx = bx + 2 * hd;
      const ty = by - 14 * hd;
      px(ctx, tx - 1, ty - 1, tw + 2, th + 2, O);
      px(ctx, tx, ty, tw, th, "#a83329");
      px(ctx, tx + tw - 3 * hd, ty, 3 * hd, th, "#751f19");
      px(ctx, tx - hd, ty, tw + 2 * hd, 2 * hd, "#f0e4d6");
      // Flashing crimson rooftop siren beacon
      px(ctx, tx + 4 * hd, ty - 5 * hd, 6 * hd, 5 * hd, O);
      px(ctx, tx + 5 * hd, ty - 4 * hd, 4 * hd, 4 * hd, "#ff3b30");
      px(ctx, tx + 6 * hd, ty - 3 * hd, 2 * hd, 2 * hd, "#ffe896");
      // White Maltese/Fire shield emblem + glowing belfry window
      px(ctx, tx + 3 * hd, ty + 4 * hd, 8 * hd, 7 * hd, O);
      px(ctx, tx + 4 * hd, ty + 5 * hd, 6 * hd, 5 * hd, "#2a1f22");
      px(ctx, tx + 5 * hd, ty + 6 * hd, 4 * hd, 3 * hd, "#ffe066");
      px(ctx, tx + 6 * hd, ty + 13 * hd, 2 * hd, 5 * hd, "#ffffff");
      px(ctx, tx + 4 * hd, ty + 14 * hd, 6 * hd, 2 * hd, "#ffffff");
    }

    // Bold crimson & gold "FIRE" marquee signboard right above engine bays!
    const signCenterX = bw >= 34 * hd ? bx + 16 * hd + Math.floor((bw - 18 * hd) / 2) : midX;
    const signMaxW = bw >= 34 * hd ? bw - 22 * hd : bw - 8 * hd;
    drawSignMarquee(ctx, signText || "FIRE", signCenterX, wallY + 2 * hd, signMaxW, {
      bg: "#b81d18",
      trim: "#f4d35e",
      fg: "#ffffff",
      hd,
      O,
    });

    // Wide arched Fire Engine Bays with visible shiny red fire trucks & glowing side beacons!
    const bays = bw >= 48 * hd ? 2 : 1;
    const bayW = bays === 2 ? Math.min(22 * hd, Math.floor((bw - 14 * hd) / 2)) : Math.min(26 * hd, bw - 12 * hd);
    const bayH = Math.min(wallH - 12 * hd, 17 * hd);
    const bayY = wallY + wallH - bayH;
    for (let i = 0; i < bays; i++) {
      const dx = bays === 2
        ? bx + Math.floor((bw - bayW * 2 - 6 * hd) / 2) + i * (bayW + 6 * hd)
        : midX - Math.floor(bayW / 2);
      // Stone arch surround
      px(ctx, dx - 2, bayY - 2 * hd, bayW + 4, bayH + 3 * hd, O);
      px(ctx, dx - 1, bayY - hd, bayW + 2, bayH + hd, "#f0e4d6");
      // Dark open garage interior
      px(ctx, dx + hd, bayY + hd, bayW - 2 * hd, bayH - hd, "#24191c");
      // Red Fire Engine cab parked inside (windshield, red nose, chrome grille & glowing headlights!)
      const tx0 = dx + 2 * hd;
      const tw0 = bayW - 4 * hd;
      const th0 = Math.max(8 * hd, bayH - 3 * hd);
      const ty0 = bayY + bayH - th0;
      px(ctx, tx0, ty0, tw0, th0, "#e02820");
      px(ctx, tx0 + hd, ty0 + hd, tw0 - 2 * hd, Math.max(3 * hd, Math.floor(th0 * 0.36)), "#9ad9f5");
      // Top fire truck siren bar
      px(ctx, tx0 + Math.floor(tw0 * 0.25), ty0 - hd, Math.max(4, Math.floor(tw0 * 0.5)), hd, "#ff4d42");
      // Chrome radiator grille + glowing headlights + silver bumper
      px(ctx, tx0 + Math.floor(tw0 * 0.28), ty0 + Math.floor(th0 * 0.55), Math.max(4, Math.floor(tw0 * 0.44)), 3 * hd, "#e6ecf2");
      px(ctx, tx0 + hd, ty0 + Math.floor(th0 * 0.58), 2 * hd, 2 * hd, "#fff39c");
      px(ctx, tx0 + tw0 - 3 * hd, ty0 + Math.floor(th0 * 0.58), 2 * hd, 2 * hd, "#fff39c");
      px(ctx, tx0, wallY + wallH - 2 * hd, tw0, 2 * hd, "#cfd6de");
      // Concrete firehouse apron slab
      px(ctx, dx - hd, wallY + wallH + 1, bayW + 2 * hd, 3 * hd, "#d4c8be");
      // Glowing red wall emergency dome lamps beside bay
      px(ctx, dx - 3 * hd, bayY + 2 * hd, 2 * hd, 3 * hd, O);
      px(ctx, dx - 3 * hd + 1, bayY + 2 * hd + 1, Math.max(1, 2 * hd - 2), 2 * hd, "#ff453a");
      px(ctx, dx + bayW + hd, bayY + 2 * hd, 2 * hd, 3 * hd, O);
      px(ctx, dx + bayW + hd + 1, bayY + 2 * hd + 1, Math.max(1, 2 * hd - 2), 2 * hd, "#ff453a");
    }
    drawAddressPlaque(ctx, building, signCenterX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 1D. VILLAGE BAKERY / CAFÉ / ICE CREAM SHOPPE (Flat Main-Street Parapet + Scalloped Awning + Blade Sign!)
  //     (No residential pitched roof — 100% unmistakable downtown storefront!)
  // =========================================================================
  if (effectiveKind === "bakery_cafe") {
    const roofH = Math.min(13 * hd, Math.max(7 * hd, Math.floor(bh * 0.22)));
    const wallH = Math.max(22 * hd, bh - roofH);
    const wallY = by + roofH;

    // Flat commercial village parapet with decorative terracotta/cream cornice & rooftop cafe sign
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#69554d");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), "#4f3f3a");
    // Decorative scalloped cornice bar
    px(ctx, bx - 2 * hd, wallY - 3 * hd, bw + 4 * hd, 4 * hd, O);
    px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 2 * hd, "#fff3db");
    px(ctx, bx - hd, wallY, bw + 2 * hd, hd, "#c98b5b");

    // Warm cream/brick cafe facade
    px(ctx, bx, wallY + hd, bw, wallH - hd, style.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, style, hd);
    px(ctx, bx, wallY + hd, 2 * hd, wallH - hd, "#fff3db");
    px(ctx, bx + bw - 2 * hd, wallY + hd, 2 * hd, wallH - hd, "#d4c3ab");

    const cafeAwnings = [
      { a: "#d93d4a", b: "#fff7e6", signBg: "#9e2431" },
      { a: "#2a7d56", b: "#fff7e6", signBg: "#1b593c" },
      { a: "#de7324", b: "#fff7e6", signBg: "#9e4914" },
    ];
    const pal = cafeAwnings[bSeed % cafeAwnings.length];

    // Bold Café/Bakery/Ice Cream Signboard right above the striped awning!
    const signH = drawSignMarquee(ctx, signText || "CAFE", midX, wallY + 2 * hd, bw - 6 * hd, {
      bg: pal.signBg,
      trim: "#ffe382",
      fg: "#fffdf5",
      hd,
      O,
    });

    // Vibrant Scalloped Striped Canvas Awning
    const awY = wallY + 2 * hd + signH + hd;
    const awH = Math.min(7 * hd, Math.max(5 * hd, Math.floor(wallH * 0.22)));
    px(ctx, bx, awY - 1, bw, awH + 2, O);
    const sW = 3 * hd;
    for (let sx = bx + hd; sx < bx + bw - hd; sx += sW) {
      const col = Math.floor((sx - bx) / sW) % 2 === 0 ? pal.a : pal.b;
      const segW = Math.min(sW, bx + bw - hd - sx);
      px(ctx, sx, awY, segW, awH, col);
      px(ctx, sx, awY + awH, Math.max(1, segW - 1), hd, col);
      px(ctx, sx, awY + awH + hd, Math.max(1, segW - 1), 1, O);
    }

    // Full-width glowing glass pastry/ice-cream display bays + recessed shop door
    const lowerY = awY + awH + 2 * hd;
    const lowerH = Math.max(9 * hd, wallY + wallH - lowerY - hd);
    const doorW = Math.min(10 * hd, Math.max(7 * hd, Math.floor(bw * 0.2)));
    const doorX = midX - Math.floor(doorW / 2);
    px(ctx, doorX, lowerY, doorW, lowerH + hd, O);
    px(ctx, doorX + 1, lowerY + 1, doorW - 2, lowerH - 1, "#5c301a");
    px(ctx, doorX + 2 * hd, lowerY + 2 * hd, Math.max(2, doorW - 4 * hd), Math.max(3, lowerH - 4 * hd), "#ffe680");

    const drawCafeBay = (x0, w0) => {
      if (w0 < 6 * hd) return;
      px(ctx, x0, lowerY, w0, lowerH, O);
      px(ctx, x0 + 1, lowerY + 1, w0 - 2, lowerH - 2, "#eb8e24");
      px(ctx, x0 + 2, lowerY + 2, Math.max(2, w0 - 4), Math.max(2, lowerH - 4), "#ffe678");
      px(ctx, x0 + 3, lowerY + 2, Math.max(2, w0 - 6), Math.max(2, Math.floor(lowerH * 0.35)), "#fffad4");
      // Pastry/scoop display counter shelf with colorful treats inside window!
      px(ctx, x0 + 2, lowerY + lowerH - 4 * hd, Math.max(2, w0 - 4), 3 * hd, "#9e5c2b");
      for (let tx = x0 + 3 * hd; tx < x0 + w0 - 3 * hd; tx += 4 * hd) {
        px(ctx, tx, lowerY + lowerH - 5 * hd, 2 * hd, 2 * hd, (tx / hd) % 8 < 4 ? "#ff7a90" : "#fff2cc");
      }
    };
    drawCafeBay(bx + 3 * hd, doorX - (bx + 4 * hd));
    drawCafeBay(doorX + doorW + hd, bx + bw - 3 * hd - (doorX + doorW + hd));

    // Sidewalk chalkboard A-frame menu board & hanging projecting blade sign!
    px(ctx, bx + bw - 8 * hd, wallY + wallH - 3 * hd, 5 * hd, 6 * hd, O);
    px(ctx, bx + bw - 8 * hd + 1, wallY + wallH - 3 * hd + 1, 5 * hd - 2, 6 * hd - 2, "#2b3036");
    px(ctx, bx + bw - 7 * hd, wallY + wallH - 2 * hd, 3 * hd, hd, "#ffe680");
    px(ctx, bx + bw - 7 * hd, wallY + wallH, 2 * hd, hd, "#ffffff");
    drawBladeSign(ctx, bx + bw, wallY + 4 * hd, { bg: pal.signBg, trim: "#ffe382", accent: "#fff7e6", hd, O });

    // Checkered cafe entry tile threshold
    px(ctx, bx + hd, wallY + wallH, bw - 2 * hd, 2 * hd, "#dfd2c4");
    for (let cx = doorX - hd; cx < doorX + doorW + hd; cx += 2 * hd) {
      px(ctx, cx, wallY + wallH, hd, hd, "#362520");
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 1E. VILLAGE CORNER MARKET / BOOKSHOP / TAQUERIA (Stepped Parapet + Blade Sign + Sidewalk Bins!)
  // =========================================================================
  if (effectiveKind === "corner_market") {
    const roofH = Math.min(13 * hd, Math.max(7 * hd, Math.floor(bh * 0.22)));
    const wallH = Math.max(22 * hd, bh - roofH);
    const wallY = by + roofH;

    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#594c48");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), "#453a38");
    // Stepped downtown village crest parapet
    const crestW = Math.min(bw - 6 * hd, 38 * hd);
    const crestX = midX - Math.floor(crestW / 2);
    px(ctx, crestX - 1, wallY - 8 * hd, crestW + 2, 8 * hd, O);
    px(ctx, crestX, wallY - 7 * hd, crestW, 6 * hd, style.wallMain);
    px(ctx, crestX, wallY - 7 * hd, crestW, 2 * hd, "#f0e6d5");

    px(ctx, bx - 2 * hd, wallY - 2 * hd, bw + 4 * hd, 3 * hd, O);
    px(ctx, bx - hd, wallY - hd, bw + 2 * hd, 2 * hd, "#f0e6d5");
    px(ctx, bx, wallY + hd, bw, wallH - hd, style.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, style, hd);

    // Bold Emerald & Gold Market/Books/Tacos Signboard
    const signH = drawSignMarquee(ctx, signText || "MARKET", midX, wallY + 2 * hd, bw - 6 * hd, {
      bg: "#1f5e3f",
      trim: "#f4d35e",
      fg: "#fff9e0",
      hd,
      O,
    });

    // Crisp green-and-cream striped market awning
    const awY = wallY + 2 * hd + signH + hd;
    const awH = 5 * hd;
    px(ctx, bx + hd, awY - 1, bw - 2 * hd, awH + 2, O);
    const sW = 4 * hd;
    for (let sx = bx + 2 * hd; sx < bx + bw - 2 * hd; sx += sW) {
      const col = Math.floor((sx - bx) / sW) % 2 === 0 ? "#24704a" : "#fff3d6";
      const segW = Math.min(sW, bx + bw - 2 * hd - sx);
      px(ctx, sx, awY, segW, awH, col);
      px(ctx, sx, awY + awH - hd, segW, hd, shadeHex(col, -24));
    }

    const groundY = awY + awH + hd;
    const groundH = Math.max(9 * hd, wallY + wallH - groundY - hd);
    const doorW = 8 * hd;
    const doorX = midX - Math.floor(doorW / 2);
    px(ctx, doorX, groundY, doorW, groundH + hd, O);
    px(ctx, doorX + 1, groundY + 1, doorW - 2, groundH - 1, style.door);
    px(ctx, doorX + 2 * hd, groundY + 2 * hd, Math.max(2, doorW - 4 * hd), Math.max(3, groundH - 4 * hd), "#ffe066");

    const paintBay = (x0, w0) => {
      if (w0 < 6 * hd) return;
      px(ctx, x0, groundY, w0, groundH, O);
      px(ctx, x0 + 1, groundY + 1, w0 - 2, groundH - 2, "#eb8e24");
      px(ctx, x0 + 2, groundY + 2, Math.max(2, w0 - 4), Math.max(2, groundH - 4), "#ffe470");
      px(ctx, x0 + 3, groundY + 2, Math.max(2, w0 - 6), Math.max(2, Math.floor(groundH * 0.4)), "#fff8c7");
    };
    paintBay(bx + 3 * hd, doorX - (bx + 4 * hd));
    paintBay(doorX + doorW + hd, bx + bw - 3 * hd - (doorX + doorW + hd));

    // Colorful outdoor sidewalk display crates (books / produce!) flanking the front door
    if (bw >= 38 * hd) {
      for (const cx of [bx + 3 * hd, bx + bw - 13 * hd]) {
        px(ctx, cx, wallY + wallH - 3 * hd, 10 * hd, 5 * hd, O);
        px(ctx, cx + 1, wallY + wallH - 3 * hd + 1, 10 * hd - 2, 5 * hd - 2, "#9c6238");
        px(ctx, cx + hd, wallY + wallH - 4 * hd, 2 * hd, 2 * hd, "#e6493e");
        px(ctx, cx + 4 * hd, wallY + wallH - 4 * hd, 2 * hd, 2 * hd, "#f4c430");
        px(ctx, cx + 7 * hd, wallY + wallH - 4 * hd, 2 * hd, 2 * hd, "#4fb85a");
      }
    }
    drawBladeSign(ctx, bx + bw, wallY + 4 * hd, { bg: "#1f5e3f", trim: "#f4d35e", accent: "#fff3d6", hd, O });
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 1F. MODERN STEEL & BLUE-GLASS OFFICE / MEDICAL PLAZA / BANK
  //     (Cool reflective sky-blue curtain-wall glass + mechanical penthouse — ZERO home look!)
  // =========================================================================
  if (effectiveKind === "office_plaza") {
    const roofH = Math.min(14 * hd, Math.max(8 * hd, Math.floor(bh * 0.22)));
    const wallH = Math.max(24 * hd, bh - roofH);
    const wallY = by + roofH;

    // Concrete architectural flat roof + rooftop mechanical penthouse & antenna mast!
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#7b8591");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), "#5d6673");
    // Mechanical penthouse box + steel antenna
    const phW = Math.min(20 * hd, Math.floor(bw * 0.34));
    const phX = bx + 5 * hd;
    px(ctx, phX - 1, by - 6 * hd, phW + 2, 8 * hd, O);
    px(ctx, phX, by - 5 * hd, phW, 6 * hd, "#b8c2cc");
    px(ctx, phX + 2 * hd, by - 3 * hd, Math.max(3, phW - 4 * hd), 2 * hd, "#525b66");
    px(ctx, phX + phW - 3 * hd, by - 13 * hd, hd, 8 * hd, "#323840");
    px(ctx, phX + phW - 3 * hd, by - 14 * hd, hd, hd, "#ff4d42");

    // Sleek steel-gray & limestone architectural facade
    px(ctx, bx - 2 * hd, wallY - 2 * hd, bw + 4 * hd, 3 * hd, O);
    px(ctx, bx - hd, wallY - hd, bw + 2 * hd, 2 * hd, "#dce4eb");
    px(ctx, bx, wallY + hd, bw, wallH - hd, "#adb7c2");
    px(ctx, bx, wallY + hd, 2 * hd, wallH - hd, "#d8e0e8");
    px(ctx, bx + bw - 2 * hd, wallY + hd, 2 * hd, wallH - hd, "#808b96");

    // Multi-story Cool Reflective Sky-Blue Ribbon Curtain-Wall Glass (totally distinct from warm home windows!)
    const floors = wallH >= 30 * hd ? 3 : 2;
    const flH = Math.floor((wallH - 3 * hd) / floors);
    for (let f = 0; f < floors; f++) {
      const fy = wallY + 2 * hd + f * flH;
      px(ctx, bx, fy, bw, 2 * hd, "#d8e0e8");
      if (f < floors - 1) {
        const winH = Math.max(5 * hd, flH - 3 * hd);
        px(ctx, bx + 2 * hd, fy + 2 * hd, bw - 4 * hd, winH, O);
        px(ctx, bx + 3 * hd, fy + 2 * hd + 1, bw - 6 * hd, Math.max(2, winH - 2), "#3a7ca5");
        px(ctx, bx + 3 * hd, fy + 2 * hd + 1, bw - 6 * hd, Math.max(2, Math.floor(winH * 0.5)), "#6bb8de");
        // Crisp diagonal sky-reflection glints across the modern office glass
        for (let gx = bx + 5 * hd; gx < bx + bw - 6 * hd; gx += 12 * hd) {
          px(ctx, gx, fy + 2 * hd + 1, 3 * hd, 2 * hd, "#c7efff");
          px(ctx, gx + hd, fy + 4 * hd, 2 * hd, Math.max(1, winH - 3 * hd), "#9ad9f5");
        }
        // Dark steel aluminum vertical mullions
        for (let mx = bx + 9 * hd; mx < bx + bw - 4 * hd; mx += 8 * hd) {
          px(ctx, mx, fy + 2 * hd, hd, winH, "#23303d");
        }
      }
    }

    // Modern cantilevered steel canopy + OFFICE/BANK/CLINIC chrome signboard + revolving/double glass lobby!
    const lobH = Math.max(9 * hd, Math.min(14 * hd, flH + 2 * hd));
    const lobY = wallY + wallH - lobH;
    const lobW = Math.min(bw - 10 * hd, 24 * hd);
    const lobX = midX - Math.floor(lobW / 2);
    drawSignMarquee(ctx, signText || "OFFICE", midX, Math.max(wallY + 2 * hd, lobY - 9 * hd), bw - 8 * hd, {
      bg: "#1f3c5c",
      trim: "#d8e4f0",
      fg: "#e8f6ff",
      hd,
      O,
    });
    px(ctx, lobX - 2 * hd, lobY - hd, lobW + 4 * hd, 3 * hd, O);
    px(ctx, lobX - hd, lobY, lobW + 2 * hd, hd, "#cfd9e3");
    px(ctx, lobX, lobY + 2 * hd, lobW, lobH - 2 * hd, O);
    px(ctx, lobX + 1, lobY + 2 * hd + 1, lobW - 2, lobH - 2 * hd - 2, "#7cc6e8");
    px(ctx, lobX + 2, lobY + 2 * hd + 1, Math.max(2, lobW - 4), Math.max(2, Math.floor(lobH * 0.35)), "#d4f3ff");
    px(ctx, midX, lobY + 2 * hd, hd, lobH - 2 * hd, "#23303d");
    // Concrete plaza entry apron
    px(ctx, bx + hd, wallY + wallH, bw - 2 * hd, 3 * hd, "#c7ced6");
    if (bw >= 38 * hd) {
      drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
      drawShrub(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 2. COMMERCIAL STOREFRONT (Downtown Shops, Retail & Plazas)
  // =========================================================================
  if (effectiveKind === "commercial") {
    const roofH = Math.min(14 * hd, Math.max(8 * hd, Math.floor(bh * 0.24)));
    const wallH = Math.max(20 * hd, bh - roofH);
    const wallY = by + roofH;

    // Flat commercial gravel/tar roof with parapet wall, rooftop HVAC & skylight
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#6b5d5a");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(4, roofH - 4 * hd), "#524645");
    if (bw >= 34 * hd && roofH >= 8 * hd) {
      px(ctx, bx + 5 * hd, by + 2 * hd, 9 * hd, 5 * hd, O);
      px(ctx, bx + 5 * hd + 1, by + 2 * hd + 1, 9 * hd - 2, 5 * hd - 2, "#b5a69c");
      px(ctx, bx + bw - 16 * hd, by + 2 * hd, 10 * hd, 5 * hd, O);
      px(ctx, bx + bw - 16 * hd + 1, by + 2 * hd + 1, 10 * hd - 2, 5 * hd - 2, "#7dc4e0");
    }
    px(ctx, bx - 2 * hd, wallY - 3 * hd, bw + 4 * hd, 4 * hd, O);
    px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 2 * hd, style.trim);
    px(ctx, bx - hd, wallY, bw + 2 * hd, hd, style.trimShade);

    px(ctx, bx, wallY + hd, bw, wallH - hd, style.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, style, hd);
    px(ctx, bx, wallY + hd, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY + hd, 2 * hd, wallH - hd, style.trimShade);

    // Bold Storefront Signboard (SHOP / CLINIC) right above striped awning!
    const signH = drawSignMarquee(ctx, signText || "SHOP", midX, wallY + 2 * hd, bw - 6 * hd, {
      bg: "#213c63",
      trim: "#f4d35e",
      fg: "#fff9e0",
      hd,
      O,
    });

    // Striped Canvas Storefront Awning
    const awningPalettes = [
      ["#c93e34", "#f7ebd2"],
      ["#2e734c", "#f7ebd2"],
      ["#2d588f", "#f7ebd2"],
      ["#cf6c28", "#fff0cc"],
    ];
    const [stripeA, stripeB] = awningPalettes[bSeed % awningPalettes.length];
    const awningY = wallY + 2 * hd + signH + hd;
    const awningH = Math.min(6 * hd, Math.max(4 * hd, Math.floor(wallH * 0.2)));
    px(ctx, bx + hd, awningY - 1, bw - 2 * hd, awningH + 2, O);
    const stripeW = 4 * hd;
    for (let sx = bx + 2 * hd; sx < bx + bw - 2 * hd; sx += stripeW) {
      const col = Math.floor((sx - bx) / stripeW) % 2 === 0 ? stripeA : stripeB;
      const segW = Math.min(stripeW, bx + bw - 2 * hd - sx);
      px(ctx, sx, awningY, segW, awningH, col);
      px(ctx, sx, awningY + awningH - hd, segW, hd, shadeHex(col, -25));
    }

    // Wide warm glowing showcase windows & recessed double glass door beneath awning
    const lowerY = awningY + awningH + hd;
    const lowerH = Math.max(8 * hd, wallY + wallH - lowerY - hd);
    const doorW = Math.min(12 * hd, Math.max(7 * hd, Math.floor(bw * 0.22)));
    const doorX = midX - Math.floor(doorW / 2);

    const drawShopWindow = (x0, w0) => {
      if (w0 < 6 * hd) return;
      px(ctx, x0, lowerY, w0, lowerH, O);
      px(ctx, x0 + 1, lowerY + 1, w0 - 2, lowerH - 2, "#eb9028");
      px(ctx, x0 + 2, lowerY + 2, Math.max(2, w0 - 4), Math.max(2, lowerH - 4), "#ffe066");
      px(ctx, x0 + 3, lowerY + 2, Math.max(2, w0 - 6), Math.max(2, Math.floor(lowerH * 0.42)), "#fff7c4");
      px(ctx, x0 + 2, lowerY + lowerH - 3 * hd, Math.max(2, w0 - 4), 2 * hd, "#9c5c2b");
    };
    drawShopWindow(bx + 3 * hd, doorX - (bx + 5 * hd));
    drawShopWindow(doorX + doorW + 2 * hd, bx + bw - 3 * hd - (doorX + doorW + 2 * hd));

    px(ctx, doorX, lowerY, doorW, lowerH + hd, O);
    px(ctx, doorX + 1, lowerY + 1, doorW - 2, lowerH - 1, "#593520");
    px(ctx, doorX + 2 * hd, lowerY + 2 * hd, Math.max(2, doorW - 4 * hd), Math.max(2, lowerH - 4 * hd), "#ffe680");
    if (doorW >= 8 * hd) px(ctx, midX, lowerY + 1, 1, lowerH - 1, O);

    drawBladeSign(ctx, bx + bw, wallY + 4 * hd, { bg: stripeA, trim: "#f4d35e", accent: stripeB, hd, O });
    px(ctx, bx + hd, wallY + wallH, bw - 2 * hd, 2 * hd, "#cfc0b2");
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 3. APARTMENTS / MULTI-FAMILY CONDO BLOCK (Flat Parapet, Roof Bulkhead, 3-Story Grid & Balconies!)
  // =========================================================================
  if (effectiveKind === "apartments") {
    const roofH = Math.min(14 * hd, Math.max(8 * hd, Math.floor(bh * 0.2)));
    const wallH = Math.max(26 * hd, bh - roofH);
    const wallY = by + roofH;

    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#635552");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(4, roofH - 4 * hd), "#4d4140");
    // Rooftop stairwell bulkhead & twin metal vents
    const bulkW = Math.min(14 * hd, Math.floor(bw * 0.26));
    px(ctx, bx + bw - bulkW - 4 * hd, by - 5 * hd, bulkW, 7 * hd, O);
    px(ctx, bx + bw - bulkW - 4 * hd + 1, by - 5 * hd + 1, bulkW - 2, 7 * hd - 2, "#8f837c");
    px(ctx, bx + 5 * hd, by - 2 * hd, 4 * hd, 4 * hd, O);
    px(ctx, bx + 5 * hd + 1, by - 2 * hd + 1, 4 * hd - 2, 4 * hd - 2, "#b8afa8");

    px(ctx, bx - 2 * hd, wallY - 2 * hd, bw + 4 * hd, 3 * hd, O);
    px(ctx, bx - hd, wallY - hd, bw + 2 * hd, 2 * hd, style.trim);

    px(ctx, bx, wallY + hd, bw, wallH - hd, style.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, style, hd);

    const stories = wallH >= 30 * hd ? 3 : 2;
    const storyH = Math.floor((wallH - 5 * hd) / stories);
    const doorW = Math.min(12 * hd, Math.max(7 * hd, Math.floor(bw * 0.16)));
    const doorX = midX - Math.floor(doorW / 2);

    for (let s = 0; s < stories; s++) {
      const rowY = wallY + 3 * hd + s * storyH;
      if (s > 0) px(ctx, bx + hd, rowY - 2 * hd, bw - 2 * hd, hd, style.trimShade);
      const winW = 6 * hd;
      const winH = Math.min(storyH - 3 * hd, 7 * hd);
      for (let wx = bx + 4 * hd; wx + winW <= bx + bw - 4 * hd; wx += 10 * hd) {
        if (s === stories - 1 && wx + winW >= doorX - 2 * hd && wx <= doorX + doorW + 2 * hd) continue;
        drawColonialWindow(ctx, wx, rowY, style, { shutters: false, winW, winH }, O);
        // Wrought-iron Juliet balcony rail on upper stories
        if (s < stories - 1) {
          const railY = rowY + winH - 2 * hd;
          px(ctx, wx - hd, railY, winW + 2 * hd, hd, "#242830");
          for (let rx = wx; rx <= wx + winW; rx += 2 * hd) {
            px(ctx, rx, railY, 1, 3 * hd, "#242830");
          }
          px(ctx, wx - hd, railY + 2 * hd, winW + 2 * hd, 1, "#242830");
        }
      }
    }

    // Canopied recessed apartment lobby entrance + brass buzzer panel
    const lobbyH = Math.min(14 * hd, Math.max(8 * hd, storyH + 2 * hd));
    const lobbyY = wallY + wallH - lobbyH;
    px(ctx, doorX - 2 * hd, lobbyY - 2 * hd, doorW + 4 * hd, 3 * hd, O);
    px(ctx, doorX - hd, lobbyY - hd, doorW + 2 * hd, 2 * hd, "#364559");
    px(ctx, doorX, lobbyY + hd, doorW, lobbyH - hd, O);
    px(ctx, doorX + 1, lobbyY + hd + 1, doorW - 2, lobbyH - hd - 2, "#593520");
    px(ctx, doorX + 2 * hd, lobbyY + 2 * hd, Math.max(2, doorW - 4 * hd), Math.max(2, lobbyH - 4 * hd), "#ffe066");
    px(ctx, doorX + doorW + hd, lobbyY + 4 * hd, 2 * hd, 3 * hd, "#f4d35e");
    px(ctx, doorX - hd, wallY + wallH, doorW + 2 * hd, 3 * hd, "#d6c5b4");

    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 4A. BOSTON COLLEGE COLLEGIATE GOTHIC CAMPUS HALLS (Crenelated Battlements, Soaring Spire & Maroon Banners!)
  // =========================================================================
  if (category === "bc_school") {
    const roofH = Math.min(12 * hd, Math.max(7 * hd, Math.floor(bh * 0.18)));
    const wallH = Math.max(28 * hd, bh - roofH);
    const wallY = by + roofH;
    const stoneStyle = { ...HOUSE_COLOR_PRESETS.bc_gothic, ...style };

    // Collegiate Gothic flat-parapet ashlar stone body with crenelated battlements!
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#464d5c");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), "#343945");
    // Crenelated gothic stone battlements across the entire roofline!
    for (let cx = bx - hd; cx < bx + bw; cx += 6 * hd) {
      px(ctx, cx, wallY - 5 * hd, 4 * hd, 4 * hd, O);
      px(ctx, cx + 1, wallY - 5 * hd + 1, 4 * hd - 2, 3 * hd, "#e3dbc9");
    }
    px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 3 * hd, O);
    px(ctx, bx, wallY - hd, bw, 2 * hd, "#dfd6c4");

    // Coursed Collegiate Gothic ashlar limestone facade
    px(ctx, bx, wallY + hd, bw, wallH - hd, stoneStyle.wallMain || "#c2b7a1");
    const stoneTones = ["#d6ccb7", "#b5aa94", "#c9bfa8", "#9e937f"];
    for (let sy = wallY + 2 * hd; sy < wallY + wallH - 3 * hd; sy += 4 * hd) {
      px(ctx, bx + 1, sy, bw - 2, 1, "#6e6558");
      const off = ((sy / (4 * hd)) % 2) * 4 * hd;
      for (let sx = bx + 2 * hd + off; sx < bx + bw - 3 * hd; sx += 8 * hd) {
        const sw = Math.min(7 * hd, bx + bw - 2 * hd - sx);
        px(ctx, sx, sy + 1, sw, 4 * hd - 1, stoneTones[(sx + sy) % stoneTones.length]);
      }
    }
    // Corner gothic buttress piers
    px(ctx, bx - hd, wallY, 4 * hd, wallH, O);
    px(ctx, bx, wallY + hd, 3 * hd, wallH - hd, "#dfd6c4");
    px(ctx, bx + bw - 3 * hd, wallY, 4 * hd, wallH, O);
    px(ctx, bx + bw - 3 * hd, wallY + hd, 3 * hd, wallH - hd, "#b5aa94");

    // Soaring Gasson-inspired Central Gothic Bell Tower with 4 golden pinnacles, clock & Maroon/Gold spire!
    const towerW = Math.min(24 * hd, Math.max(16 * hd, Math.floor(bw * 0.26)));
    const towerH = 22 * hd;
    const towerX = midX - Math.floor(towerW / 2);
    const towerY = by - 14 * hd;
    // Tall corner pinnacles & soaring central spire
    px(ctx, towerX - hd, towerY - 5 * hd, 3 * hd, 6 * hd, O);
    px(ctx, towerX, towerY - 4 * hd, hd, 5 * hd, "#f0c850");
    px(ctx, towerX + towerW - 2 * hd, towerY - 5 * hd, 3 * hd, 6 * hd, O);
    px(ctx, towerX + towerW - hd, towerY - 4 * hd, hd, 5 * hd, "#f0c850");
    px(ctx, midX - 3 * hd, towerY - 8 * hd, 6 * hd, 8 * hd, O);
    px(ctx, midX - 2 * hd, towerY - 7 * hd, 4 * hd, 7 * hd, "#8a2434");
    px(ctx, midX - hd, towerY - 11 * hd, 2 * hd, 4 * hd, "#f4d35e");
    // Stone tower shaft
    px(ctx, towerX - 1, towerY, towerW + 2, towerH, O);
    px(ctx, towerX, towerY + 1, towerW, towerH - 2, "#ded6c5");
    px(ctx, towerX + towerW - 3 * hd, towerY + 1, 3 * hd, towerH - 2, "#aba18d");
    // Illuminated Gothic clockface
    px(ctx, midX - 4 * hd, towerY + 3 * hd, 8 * hd, 8 * hd, O);
    px(ctx, midX - 3 * hd, towerY + 4 * hd, 6 * hd, 6 * hd, "#fff5c7");
    px(ctx, midX, towerY + 5 * hd, hd, 3 * hd, O);
    px(ctx, midX, towerY + 7 * hd, 2 * hd, hd, O);
    // Pointed belfry arch louver below clock
    px(ctx, midX - 3 * hd, towerY + 13 * hd, 6 * hd, 6 * hd, O);
    px(ctx, midX - 2 * hd, towerY + 14 * hd, 4 * hd, 5 * hd, "#3b2e33");

    // Central projecting Gothic stone portal + Maroon & Gold "BC" signboard + hanging campus banners!
    const portW = Math.min(Math.floor(bw * 0.36), 30 * hd);
    const portX = midX - Math.floor(portW / 2);
    px(ctx, portX - 1, wallY, portW + 2, wallH, O);
    px(ctx, portX, wallY + hd, portW, wallH - hd, "#e6dfd0");
    drawSignMarquee(ctx, signText || "BC", midX, wallY + 2 * hd, portW - 2 * hd, {
      bg: "#7d1d2e",
      trim: "#f0c850",
      fg: "#fff8dc",
      hd,
      O,
    });
    // Hanging BC Maroon & Gold campus banners flanking portal
    if (bw >= 44 * hd) {
      for (const bnx of [portX - 6 * hd, portX + portW + hd]) {
        px(ctx, bnx - 1, wallY + 3 * hd, 5 * hd + 2, 13 * hd, O);
        px(ctx, bnx, wallY + 4 * hd, 5 * hd, 11 * hd, "#7d1d2e");
        px(ctx, bnx + hd, wallY + 5 * hd, 3 * hd, 7 * hd, "#f0c850");
        px(ctx, bnx + 2 * hd, wallY + 6 * hd, hd, 5 * hd, "#7d1d2e");
      }
    }
    // Pointed gothic arched oak entrance doors + stone steps
    const doorW = Math.min(portW - 6 * hd, 12 * hd);
    const doorH = Math.min(wallH - 13 * hd, 16 * hd);
    const doorX = midX - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2, doorY - 2 * hd, doorW + 4, doorH + 3 * hd, O);
    px(ctx, doorX - 1, doorY - hd, doorW + 2, doorH + hd, "#b5aa94");
    px(ctx, doorX, doorY, doorW, doorH, "#5c1420");
    px(ctx, midX, doorY, 1, doorH, O);
    px(ctx, portX - hd, wallY + wallH, portW + 2 * hd, 4 * hd, "#ded6c5");

    // Tall Pointed Gothic Lancet Windows along left & right campus wings
    const winW = hd >= 2 ? 10 : 5;
    const winH = Math.min(wallH - 9 * hd, hd >= 2 ? 20 : 10);
    if (winH >= 8) {
      const winY = wallY + Math.max(4 * hd, Math.floor((wallH - winH) / 2));
      const stepW = winW + 5 * hd;
      const leftStop = bw >= 44 * hd ? portX - 8 * hd : portX - 3 * hd;
      const rightStart = bw >= 44 * hd ? portX + portW + 8 * hd : portX + portW + 3 * hd;
      for (let wx = bx + 5 * hd; wx + winW <= leftStop; wx += stepW) {
        drawGothicLancetWindow(ctx, wx, winY, winW, winH, O);
      }
      for (let wx = rightStart; wx + winW <= bx + bw - 5 * hd; wx += stepW) {
        drawGothicLancetWindow(ctx, wx, winY, winW, winH, O);
      }
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 4B. PUBLIC SCHOOL / ELEMENTARY SCHOOL (Flat Limestone-Coped Institutional Brick,
  //     Central Clock & Brass Bell Tower, "SCHOOL" Marquee, Classroom Window Banks & Flagpole!)
  // =========================================================================
  if (category === "school") {
    const roofH = Math.min(12 * hd, Math.max(7 * hd, Math.floor(bh * 0.18)));
    const wallH = Math.max(28 * hd, bh - roofH);
    const wallY = by + roofH;
    const brickStyle = { ...HOUSE_COLOR_PRESETS.brick };

    // Flat institutional school parapet roof (NEVER a house-like pitched shingle roof!)
    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#596370");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), "#414954");
    // Bold Limestone & School-Zone Cobalt Blue institutional parapet cornice
    px(ctx, bx - 2 * hd, wallY - 4 * hd, bw + 4 * hd, 5 * hd, O);
    px(ctx, bx - hd, wallY - 3 * hd, bw + 2 * hd, 2 * hd, "#f2eadc");
    px(ctx, bx - hd, wallY - hd, bw + 2 * hd, 2 * hd, "#244c8a");

    // Red-brick institutional facade with limestone pilasters & horizontal belt-course
    px(ctx, bx, wallY + hd, bw, wallH - hd, brickStyle.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, brickStyle, hd);
    px(ctx, bx, wallY + hd, 3 * hd, wallH - hd, "#f2eadc");
    px(ctx, bx + bw - 3 * hd, wallY + hd, 3 * hd, wallH - hd, "#cfc4b4");
    // Mid-wall limestone floor divider separating 1st & 2nd floor classrooms!
    const midFloorY = wallY + Math.floor(wallH * 0.48);
    px(ctx, bx + hd, midFloorY, bw - 2 * hd, 2 * hd, "#e8decb");
    px(ctx, bx + hd, midFloorY + 2 * hd, bw - 2 * hd, 1, O);

    // Tall Central School Clock & Brass Bell Cupola Tower rising high above roof!
    const cupW = 18 * hd;
    const cupH = 16 * hd;
    const cupX = midX - Math.floor(cupW / 2);
    const cupY = by - 11 * hd;
    // Copper/slate stepped bell dome + brass weathervane finial
    px(ctx, midX - 6 * hd, cupY - 5 * hd, 12 * hd, 5 * hd, O);
    px(ctx, midX - 5 * hd, cupY - 4 * hd, 10 * hd, 4 * hd, "#3f7d72");
    px(ctx, midX - 3 * hd, cupY - 7 * hd, 6 * hd, 3 * hd, O);
    px(ctx, midX - 2 * hd, cupY - 6 * hd, 4 * hd, 2 * hd, "#5ea89a");
    px(ctx, midX - hd, cupY - 10 * hd, 2 * hd, 4 * hd, "#f4d35e");
    // White wooden cupola body + big school clockface + brass bell niche
    px(ctx, cupX - 1, cupY, cupW + 2, cupH, O);
    px(ctx, cupX, cupY + 1, cupW, cupH - 2, "#f7f0e0");
    px(ctx, cupX + cupW - 3 * hd, cupY + 1, 3 * hd, cupH - 2, "#d4c8b4");
    px(ctx, midX - 4 * hd, cupY + 2 * hd, 8 * hd, 8 * hd, O);
    px(ctx, midX - 3 * hd, cupY + 3 * hd, 6 * hd, 6 * hd, "#ffffff");
    px(ctx, midX, cupY + 4 * hd, hd, 3 * hd, "#1c365c");
    px(ctx, midX, cupY + 6 * hd, 2 * hd, hd, "#d9362e");
    // Glowing golden school bell tucked beneath clock
    px(ctx, midX - 3 * hd, cupY + 11 * hd, 6 * hd, 4 * hd, "#243447");
    px(ctx, midX - 2 * hd, cupY + 12 * hd, 4 * hd, 2 * hd, "#f4d35e");

    // Central Limestone School Entry Pavilion + Bold "SCHOOL" Marquee Signboard!
    const portW = Math.min(Math.floor(bw * 0.40), 34 * hd);
    const portX = midX - Math.floor(portW / 2);
    px(ctx, portX - 1, wallY, portW + 2, wallH, O);
    px(ctx, portX, wallY + hd, portW, wallH - hd, "#f2eadc");
    drawSignMarquee(ctx, signText || "SCHOOL", midX, wallY + 2 * hd, portW + 8 * hd, {
      bg: "#1c4382",
      trim: "#f4d35e",
      fg: "#fffdf0",
      hd,
      O,
    });

    // Double School Doors (Royal Blue with brass push-bars & transom glass!)
    const doorW = Math.min(portW - 6 * hd, 14 * hd);
    const doorH = Math.min(wallH - 13 * hd, 15 * hd);
    const doorX = midX - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2, doorY - 2, doorW + 4, doorH + 3, O);
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 1, "#d4c8b4");
    px(ctx, doorX, doorY, doorW, doorH, "#244c8a");
    px(ctx, doorX + 2, doorY + 2, Math.max(2, doorW - 4), 4 * hd, "#a6dcf5");
    px(ctx, midX, doorY, 1, doorH, O);
    // Brass push-bars across both school doors
    px(ctx, doorX + 2, doorY + Math.floor(doorH * 0.62), Math.floor(doorW / 2) - 3, hd, "#f4d35e");
    px(ctx, midX + 2, doorY + Math.floor(doorH * 0.62), Math.floor(doorW / 2) - 3, hd, "#f4d35e");

    // Wide School Entry Plaza Steps with bright School-Zone Yellow safety curb stripe!
    const plazaW = Math.min(bw - 4 * hd, portW + 10 * hd);
    const plazaX = midX - Math.floor(plazaW / 2);
    px(ctx, plazaX - 1, wallY + wallH, plazaW + 2, 5 * hd, O);
    px(ctx, plazaX, wallY + wallH, plazaW, 3 * hd, "#e0d6c8");
    px(ctx, plazaX, wallY + wallH + 3 * hd, plazaW, 2 * hd, "#f4c430");

    // Two-Story Institutional Classroom Window Banks across BOTH wings!
    const cwW = hd >= 2 ? 14 : 7;
    const cwH = Math.min(Math.floor(wallH * 0.34), hd >= 2 ? 12 : 6);
    const row1Y = wallY + 4 * hd;
    const row2Y = midFloorY + 4 * hd;
    const stepW = cwW + 4 * hd;
    for (const wy of [row1Y, row2Y]) {
      if (wy + cwH > wallY + wallH - 3 * hd) continue;
      for (let wx = bx + 5 * hd; wx + cwW <= portX - 3 * hd; wx += stepW) {
        drawClassroomWindow(ctx, wx, wy, cwW, cwH, O);
      }
      for (let wx = portX + portW + 3 * hd; wx + cwW <= bx + bw - 5 * hd; wx += stepW) {
        drawClassroomWindow(ctx, wx, wy, cwW, cwH, O);
      }
    }

    // Tall Institutional Flagpole proudly flying beside the school entrance!
    drawFlagpole(ctx, bx + bw + 2 * hd, wallY + wallH + 2 * hd, wallH + roofH + 10 * hd, { hd, O });
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 4C. PUBLIC LIBRARY (Signature Oxidized Teal-Copper Roof & Skylight Dome,
  //     Classical Marble Portico with Open-Book Pediment, "LIBRARY" Frieze & Blue Book-Drop!)
  // =========================================================================
  if (category === "library") {
    const wallH = Math.min(38 * hd, Math.max(22 * hd, Math.floor(bh * 0.56)));
    const roofH = Math.max(14 * hd, bh - wallH);
    const wallY = by + roofH;

    // Rich brick / stone library facade with classical white limestone pilasters & base plinth
    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    px(ctx, bx, wallY, 3 * hd, wallH, "#f2ebe0");
    px(ctx, bx + 3 * hd, wallY, 1, wallH, O);
    px(ctx, bx + bw - 3 * hd, wallY, 3 * hd, wallH, "#d6cabd");
    px(ctx, bx + bw - 3 * hd - 1, wallY, 1, wallH, O);
    const baseH = 5 * hd;
    px(ctx, bx, wallY + wallH - baseH, bw, baseH, "#b5a89d");
    px(ctx, bx, wallY + wallH - baseH, bw, hd, "#f2ebe0");
    px(ctx, bx, wallY + wallH - baseH - 1, bw, 1, O);

    // Signature Oxidized Verdigris Teal-Copper Roof (unmistakable — zero residential homes use copper teal!)
    const copperRoofStyle = {
      ...style,
      roofLight: "#78c4b5",
      roofMain: "#4d998b",
      roofDark: "#2d665c",
      trim: "#f2ebe0",
      trimShade: "#cfc4b6",
    };
    drawShingledRoof(ctx, bx, by, bw, roofH, wallY, copperRoofStyle, 0.16, O, {
      hd,
      leafCluster: false,
      seed: bSeed,
    });
    // Standing copper roof seams
    for (let sx = bx + 8 * hd; sx < bx + bw - 8 * hd; sx += 8 * hd) {
      px(ctx, sx, by + 3 * hd, 1, roofH - 4 * hd, "#2d665c");
    }

    // Grand Central Verdigris Copper Skylight Dome / Lantern Cupola rising above roof!
    const domeW = Math.min(24 * hd, Math.floor(bw * 0.34));
    const domeH = 14 * hd;
    const domeX = midX - Math.floor(domeW / 2);
    const domeY = by - 10 * hd;
    for (let r = 0; r < domeH; r++) {
      const t = r / Math.max(1, domeH - 1);
      const half = Math.max(2, Math.round(Math.sin(t * Math.PI * 0.5) * (domeW / 2)));
      const ry = domeY + r;
      px(ctx, midX - half - 1, ry, half * 2 + 2, 1, O);
      px(ctx, midX - half, ry, half * 2, 1, r < domeH * 0.4 ? "#85d1c2" : r % 3 === 0 ? "#357065" : "#52a192");
    }
    px(ctx, midX - hd, domeY - 4 * hd, 2 * hd, 4 * hd, "#f4d35e");
    // Glowing skylight clerestory drum beneath copper dome
    px(ctx, domeX + 2 * hd, domeY + domeH - 4 * hd, domeW - 4 * hd, 5 * hd, O);
    px(ctx, domeX + 3 * hd, domeY + domeH - 3 * hd, domeW - 6 * hd, 3 * hd, "#ffe88a");

    // Monumental Classical Marble Portico with 4 fluted columns, Open-Book Pediment & "LIBRARY" Frieze!
    const portW = Math.min(Math.floor(bw * 0.48), 38 * hd);
    const portX = midX - Math.floor(portW / 2);
    const pedHalfW = Math.min(Math.floor(portW / 2) + 2 * hd, Math.floor(bw * 0.34));
    const pedH = Math.min(Math.floor(roofH * 0.85), 16 * hd);
    for (let gy = 0; gy < pedH; gy++) {
      const span = Math.max(2, Math.round((gy / Math.max(1, pedH - 1)) * pedHalfW));
      const ry = wallY - pedH + gy;
      px(ctx, midX - span - 2, ry, span * 2 + 4, 1, O);
      px(ctx, midX - span - 1, ry, span * 2 + 2, 1, "#f5efe6");
      if (gy > 2 && span > 4) {
        px(ctx, midX - span + 2, ry, Math.max(2, (span - 2) * 2), 1, "#ded4c5");
      }
    }
    // Crisp Open-Book Emblem carved inside the Library Pediment!
    if (pedH >= 10 * hd) {
      const bky = wallY - Math.floor(pedH * 0.55);
      px(ctx, midX - 5 * hd, bky, 10 * hd, 5 * hd, O);
      px(ctx, midX - 4 * hd, bky + hd, 4 * hd, 3 * hd, "#fffdf5");
      px(ctx, midX + hd, bky + hd, 4 * hd - hd, 3 * hd, "#fff8dc");
      px(ctx, midX, bky, 1, 5 * hd, "#2d665c");
    }

    // Readable carved "LIBRARY" Frieze Signboard across the portico entablature!
    const friezeH = drawSignMarquee(ctx, signText || "LIBRARY", midX, wallY - hd, portW + 4 * hd, {
      bg: "#26594f",
      trim: "#f5efe6",
      fg: "#fff8d6",
      hd,
      O,
    });

    // 4 Fluted White Marble Portico Columns
    const colTop = wallY + friezeH;
    const colH = Math.max(8, wallY + wallH - colTop);
    const colW = 3 * hd;
    const colXs = [portX + hd, portX + 6 * hd, portX + portW - 9 * hd, portX + portW - colW - hd];
    for (const cx of colXs) {
      px(ctx, cx - 1, colTop, colW + 2, colH, O);
      px(ctx, cx, colTop, colW, colH, "#ede5da");
      px(ctx, cx, colTop, hd, colH, "#ffffff");
      px(ctx, cx + colW - hd, colTop, hd, colH, "#bfb3a4");
    }

    // Recessed double oak doors inside portico
    const doorW = Math.min(portW - 18 * hd, 14 * hd);
    const doorH = Math.min(colH - hd, 17 * hd);
    const doorX = midX - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2, doorY - 2, doorW + 4, doorH + 3, O);
    px(ctx, doorX, doorY, doorW, doorH, "#703c22");
    px(ctx, midX, doorY, 1, doorH, O);
    px(ctx, doorX + 2, doorY + 2, Math.max(2, Math.floor(doorW / 2) - 3), Math.max(3, Math.floor(doorH * 0.4)), "#ffe066");
    px(ctx, midX + 2, doorY + 2, Math.max(2, Math.floor(doorW / 2) - 3), Math.max(3, Math.floor(doorH * 0.4)), "#ffe066");

    // Wide stepped marble library staircase
    const stepW = Math.min(bw - 8 * hd, portW + 4 * hd);
    const stepX = midX - Math.floor(stepW / 2);
    const stepY = wallY + wallH - hd;
    px(ctx, stepX - 2, stepY, stepW + 4, 5 * hd, O);
    for (let st = 0; st < 4; st++) {
      px(ctx, stepX, stepY + st * hd, stepW, hd, st % 2 === 0 ? "#ede5da" : "#cfc2b4");
    }

    // Tall Arched Glowing Reading-Room Windows along BOTH wings
    const winW = hd >= 2 ? 11 : 6;
    const winH = Math.min(wallH - baseH - 4 * hd, hd >= 2 ? 19 : 10);
    if (winH >= 8) {
      const winY = wallY + Math.max(3 * hd, Math.floor((wallH - baseH - winH) / 2));
      const stepW2 = winW + 5 * hd;
      for (let wx = bx + 5 * hd; wx + winW <= portX - 3 * hd; wx += stepW2) {
        drawArchedCivicWindow(ctx, wx, winY, style, winW, winH, O);
      }
      for (let wx = portX + portW + 3 * hd; wx + winW <= bx + bw - 5 * hd; wx += stepW2) {
        drawArchedCivicWindow(ctx, wx, winY, style, winW, winH, O);
      }
    }

    // Royal-blue Library Book-Drop Return Box (left) & Wooden Notice Board (right)!
    if (bw >= 44 * hd) {
      const bdx = bx + 4 * hd;
      const bdy = wallY + wallH - 6 * hd;
      px(ctx, bdx - 1, bdy - 1, 7 * hd + 2, 9 * hd + 2, O);
      px(ctx, bdx, bdy, 7 * hd, 9 * hd, "#245ca8");
      px(ctx, bdx, bdy, 7 * hd, 2 * hd, "#4a8ad4");
      px(ctx, bdx + hd, bdy + 3 * hd, 5 * hd, 2 * hd, "#ffffff");
      const nbx = bx + bw - 13 * hd;
      const nby = wallY + wallH - 5 * hd;
      px(ctx, nbx + 2 * hd, nby + 5 * hd, 2 * hd, 5 * hd, O);
      px(ctx, nbx + 7 * hd, nby + 5 * hd, 2 * hd, 5 * hd, O);
      px(ctx, nbx, nby, 11 * hd, 7 * hd, O);
      px(ctx, nbx + hd, nby + hd, 9 * hd, 5 * hd, "#d9b88c");
      px(ctx, nbx + 2 * hd, nby + 2 * hd, 7 * hd, hd, "#593b24");
      px(ctx, nbx + 2 * hd, nby + 4 * hd, 5 * hd, hd, "#593b24");
    }

    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 4D. HOUSES OF WORSHIP & CIVIC HALLS (Synagogues with Crowned Blue/Gold Dome,
  //     Churches/Chapels with Tall Steeple & Rose Window, Gothic Crypt Chapel, Civic Hall!)
  // =========================================================================
  if (effectiveKind === "civic") {
    const roofH = Math.min(13 * hd, Math.max(8 * hd, Math.floor(bh * 0.2)));
    const wallH = Math.max(26 * hd, bh - roofH);
    const wallY = by + roofH;
    const isSynagogue = category === "synagogue";
    const isMosque = category === "mosque";
    const isChurch = category === "church";
    const isGothic = category === "gothic_chapel";

    // Distinct ashlar limestone / sandstone / charcoal stone facade (NOT clapboard siding!)
    const facadeMain = isGothic
      ? "#525866"
      : isSynagogue
        ? "#e6d8be"
        : isChurch
          ? style.wallMain
          : "#d8cfc0";
    const facadeLight = isGothic ? "#6b7385" : isSynagogue ? "#f5ebd8" : "#efe6d8";
    const facadeShade = isGothic ? "#383d47" : isSynagogue ? "#c4b393" : "#b8ad9c";

    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, isGothic ? "#353a45" : isSynagogue ? "#4f627d" : "#565e6b");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), isGothic ? "#252930" : "#3b4759");
    px(ctx, bx - 2 * hd, wallY - 3 * hd, bw + 4 * hd, 4 * hd, O);
    px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 2 * hd, facadeLight);

    px(ctx, bx, wallY + hd, bw, wallH - hd, facadeMain);
    // Coursed monumental stone ashlar masonry blocks
    for (let sy = wallY + 4 * hd; sy < wallY + wallH - 3 * hd; sy += 4 * hd) {
      px(ctx, bx + 1, sy, bw - 2, 1, shadeHex(facadeShade, -20));
      const off = ((sy / (4 * hd)) % 2) * 5 * hd;
      for (let sx = bx + 2 * hd + off; sx < bx + bw - 3 * hd; sx += 10 * hd) {
        px(ctx, sx, sy + 1, 1, 4 * hd - 1, shadeHex(facadeShade, -16));
      }
    }
    px(ctx, bx, wallY + hd, 3 * hd, wallH - hd, facadeLight);
    px(ctx, bx + bw - 3 * hd, wallY + hd, 3 * hd, wallH - hd, facadeShade);

    const portW = Math.min(Math.floor(bw * 0.42), 34 * hd);
    const portX = midX - Math.floor(portW / 2);

    if (isSynagogue) {
      // Grand Crowned Royal-Blue & Gold Sanctuary Dome rising high above parapet!
      const domeW = Math.min(30 * hd, Math.floor(bw * 0.44));
      const domeH = 16 * hd;
      const domeY = by - 12 * hd;
      for (let r = 0; r < domeH; r++) {
        const t = r / Math.max(1, domeH - 1);
        const half = Math.max(2, Math.round(Math.sin(t * Math.PI * 0.5) * (domeW / 2)));
        const ry = domeY + r;
        px(ctx, midX - half - 1, ry, half * 2 + 2, 1, O);
        px(ctx, midX - half, ry, half * 2, 1, r < domeH * 0.35 ? "#5c92d6" : r % 3 === 0 ? "#20447d" : "#2f64ad");
      }
      // Golden dome crown band & golden finial
      px(ctx, midX - Math.floor(domeW / 2) - 1, domeY + domeH - 2 * hd, domeW + 2, 2 * hd, "#f4d35e");
      px(ctx, midX - hd, domeY - 5 * hd, 2 * hd, 5 * hd, "#f4d35e");
      px(ctx, midX - 2 * hd, domeY - 4 * hd, 4 * hd, hd, "#ffe896");

      // Central sanctuary pavilion with glowing Blue & Gold Rose Window + TEMPLE/SHUL frieze!
      px(ctx, portX - 1, wallY, portW + 2, wallH, O);
      px(ctx, portX, wallY + hd, portW, wallH - hd, "#f5ebd8");
      drawSignMarquee(ctx, signText || "TEMPLE", midX, wallY + hd, portW + 4 * hd, {
        bg: "#1c4382",
        trim: "#f4d35e",
        fg: "#fff8d6",
        hd,
        O,
      });
      drawStainedGlassRose(ctx, midX, wallY + 13 * hd, 5 * hd, { palette: "synagogue", O });
    } else if (isMosque) {
      // Classical Limestone Mosque Dome + Slender Minaret Tower!
      const domeW = Math.min(28 * hd, Math.floor(bw * 0.42));
      const domeH = 15 * hd;
      const domeY = by - 11 * hd;
      for (let r = 0; r < domeH; r++) {
        const t = r / Math.max(1, domeH - 1);
        const half = Math.max(2, Math.round(Math.sin(t * Math.PI * 0.5) * (domeW / 2)));
        const ry = domeY + r;
        px(ctx, midX - half - 1, ry, half * 2 + 2, 1, O);
        px(ctx, midX - half, ry, half * 2, 1, r < domeH * 0.35 ? "#54b8a6" : "#2d8a7b");
      }
      px(ctx, midX - hd, domeY - 4 * hd, 2 * hd, 4 * hd, "#f4d35e");
      // Slender limestone minaret on right corner
      const minX = bx + bw - 9 * hd;
      px(ctx, minX - 1, by - 20 * hd, 6 * hd + 2, 22 * hd, O);
      px(ctx, minX, by - 19 * hd, 6 * hd, 20 * hd, "#f0e6d2");
      px(ctx, minX - hd, by - 14 * hd, 8 * hd, 2 * hd, "#d4c3a3");
      px(ctx, minX + hd, by - 23 * hd, 4 * hd, 4 * hd, "#2d8a7b");
      px(ctx, portX - 1, wallY, portW + 2, wallH, O);
      px(ctx, portX, wallY + hd, portW, wallH - hd, "#f5ebd8");
      drawSignMarquee(ctx, signText || "MOSQUE", midX, wallY + hd, portW + 4 * hd, {
        bg: "#1e6357",
        trim: "#f4d35e",
        fg: "#fff8d6",
        hd,
        O,
      });
    } else if (isGothic) {
      // Spooky Gothic Cemetery Chapel needle spire & glowing eerie teal/violet rose window!
      px(ctx, midX - 2 * hd, by - 19 * hd, 4 * hd, 14 * hd, O);
      px(ctx, midX - hd, by - 18 * hd, 2 * hd, 13 * hd, "#525b6e");
      px(ctx, midX - 6 * hd, by - 7 * hd, 12 * hd, 10 * hd, O);
      px(ctx, midX - 5 * hd, by - 6 * hd, 10 * hd, 8 * hd, "#687285");
      drawStainedGlassRose(ctx, midX, wallY + 9 * hd, 4 * hd, { palette: "gothic", O });
    } else if (isChurch) {
      // Soaring Tall White & Slate Steeple Bell Tower rising 22*hd above parapet!
      const stW = 14 * hd;
      const stX = midX - Math.floor(stW / 2);
      const stY = by - 10 * hd;
      // Needle steeple spire above belfry
      for (let sr = 0; sr < 13 * hd; sr++) {
        const half = Math.max(1, Math.round((sr / (13 * hd)) * (stW / 2)));
        const ry = stY - 13 * hd + sr;
        px(ctx, midX - half - 1, ry, half * 2 + 2, 1, O);
        px(ctx, midX - half, ry, half * 2, 1, sr % 3 === 0 ? "#4c5463" : "#6c768a");
      }
      px(ctx, midX - hd, stY - 16 * hd, 2 * hd, 4 * hd, "#f4d35e");
      // White wooden belfry box with dark arched bell opening
      px(ctx, stX - 1, stY, stW + 2, 12 * hd, O);
      px(ctx, stX, stY + 1, stW, 10 * hd, "#f7f3eb");
      px(ctx, midX - 3 * hd, stY + 3 * hd, 6 * hd, 6 * hd, O);
      px(ctx, midX - 2 * hd, stY + 4 * hd, 4 * hd, 5 * hd, "#2a2e38");
      px(ctx, midX - hd, stY + 6 * hd, 2 * hd, 2 * hd, "#f4d35e");

      // Central portal with glowing Multicolor Stained-Glass Rose Window & CHAPEL/CHURCH header!
      px(ctx, portX - 1, wallY, portW + 2, wallH, O);
      px(ctx, portX, wallY + hd, portW, wallH - hd, facadeLight);
      drawSignMarquee(ctx, signText || "CHAPEL", midX, wallY + hd, portW + 4 * hd, {
        bg: "#4a2c59",
        trim: "#f4d35e",
        fg: "#fff8e0",
        hd,
        O,
      });
      drawStainedGlassRose(ctx, midX, wallY + 13 * hd, 5 * hd, { palette: "church", O });
    } else {
      // Civic / Community Hall with Domed Clock Cupola, Flagpole & "CIVIC" Marquee!
      const cupW = 16 * hd;
      const cupX = midX - Math.floor(cupW / 2);
      const cupY = by - 11 * hd;
      px(ctx, midX - 5 * hd, cupY - 5 * hd, 10 * hd, 5 * hd, O);
      px(ctx, midX - 4 * hd, cupY - 4 * hd, 8 * hd, 4 * hd, "#d4a64a");
      px(ctx, cupX - 1, cupY, cupW + 2, 13 * hd, O);
      px(ctx, cupX, cupY + 1, cupW, 11 * hd, "#f2eadc");
      px(ctx, midX - 3 * hd, cupY + 3 * hd, 6 * hd, 6 * hd, O);
      px(ctx, midX - 2 * hd, cupY + 4 * hd, 4 * hd, 4 * hd, "#ffffff");
      px(ctx, midX, cupY + 5 * hd, hd, 2 * hd, O);
      px(ctx, portX - 1, wallY, portW + 2, wallH, O);
      px(ctx, portX, wallY + hd, portW, wallH - hd, "#f2eadc");
      drawSignMarquee(ctx, signText || "CIVIC", midX, wallY + 2 * hd, portW + 4 * hd, {
        bg: "#3b2c59",
        trim: "#f4d35e",
        fg: "#fff8e0",
        hd,
        O,
      });
      drawFlagpole(ctx, bx + bw + 2 * hd, wallY + wallH + 2 * hd, wallH + roofH + 8 * hd, { hd, O });
    }

    // Arched Sanctuary / Civic Double Entrance Doors + Wide Ceremonial Stone Steps
    const doorW = Math.min(portW - 8 * hd, 12 * hd);
    const doorH = Math.min(wallH - 18 * hd, 12 * hd);
    const doorX = midX - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2, doorY - 2, doorW + 4, doorH + 3, O);
    px(ctx, doorX, doorY, doorW, doorH, isGothic ? "#302833" : "#6b3822");
    px(ctx, midX, doorY, 1, doorH, O);
    px(ctx, portX - hd, wallY + wallH, portW + 2 * hd, 4 * hd, isGothic ? "#7c8494" : "#e3d8c8");

    // Tall Arched Glowing Sanctuary Windows along BOTH wings
    const winW = hd >= 2 ? 11 : 6;
    const winH = Math.min(wallH - 8 * hd, hd >= 2 ? 18 : 9);
    if (winH >= 8) {
      const winY = wallY + Math.max(4 * hd, Math.floor((wallH - winH) / 2));
      const stepW = winW + 5 * hd;
      for (let wx = bx + 5 * hd; wx + winW <= portX - 3 * hd; wx += stepW) {
        drawArchedCivicWindow(ctx, wx, winY, style, winW, winH, O);
      }
      for (let wx = portX + portW + 3 * hd; wx + winW <= bx + bw - 5 * hd; wx += stepW) {
        drawArchedCivicWindow(ctx, wx, winY, style, winW, winH, O);
      }
    }

    if (bw >= 38 * hd && !isGothic) {
      drawShrub(ctx, portX - 10 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
      drawShrub(ctx, portX + portW + hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 5. DUPLEX / TWO-FAMILY TOWNHOUSE (32-bit HD Twin Doors, Twin Steps & Glowing Windows!)
  // =========================================================================
  if (effectiveKind === "duplex") {
    const wallH = Math.min(34 * hd, Math.max(16 * hd, Math.floor(bh * 0.50)));
    const roofH = Math.max(14 * hd, bh - wallH);
    const wallY = by + roofH;

    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    px(ctx, midX - hd, wallY, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx, wallY, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH - hd, style.trimShade);

    const slopeInset = drawShingledRoof(ctx, bx, by, bw, roofH, wallY, style, 0.15, O, { hd, seed: bSeed });
    if (bw >= 34 * hd) {
      drawChimney(ctx, bx + slopeInset + 2 * hd, by - 6 * hd, 5 * hd, 7 * hd, O);
      drawChimney(ctx, bx + bw - slopeInset - 7 * hd, by - 6 * hd, 5 * hd, 7 * hd, O);
    }

    const doorW = 6 * hd;
    const doorH = Math.min(wallH - 4 * hd, 10 * hd);
    const doorY = wallY + wallH - doorH - 2 * hd;
    const leftDoorX = bx + Math.max(5 * hd, Math.floor(bw * 0.28) - Math.floor(doorW / 2));
    const rightDoorX = bx + Math.min(bw - doorW - 5 * hd, Math.floor(bw * 0.72) - Math.floor(doorW / 2));
    for (const dx of [leftDoorX, rightDoorX]) {
      px(ctx, dx - 1, doorY - 1, doorW + 2, doorH + 2, O);
      px(ctx, dx, doorY, doorW, doorH, style.trim);
      px(ctx, dx + 1, doorY + 1, doorW - 2, doorH - 1, style.door);
      px(ctx, dx + 2, doorY + 2, Math.max(2, doorW - 4), Math.max(3, Math.floor(doorH * 0.35)), "#ffe066");
      px(ctx, dx - hd, wallY + wallH - hd, doorW + 2 * hd, 4 * hd, O);
      px(ctx, dx, wallY + wallH, doorW, 2 * hd, "#b87442");
    }

    if (bw >= 36 * hd && wallH >= 12 * hd) {
      const winW = hd >= 2 ? 10 : 5;
      const winH = hd >= 2 ? 12 : 6;
      const winY = wallY + Math.max(3 * hd, Math.floor((wallH - winH) / 2) - hd);
      if (bx + 4 * hd + winW < leftDoorX - 2) {
        drawColonialWindow(ctx, bx + 4 * hd, winY, style, { shutters: false, winW, winH }, O);
      }
      if (bx + bw - 4 * hd - winW > rightDoorX + doorW + 2) {
        drawColonialWindow(ctx, bx + bw - 4 * hd - winW, winY, style, { shutters: false, winW, winH }, O);
      }
    }
    if (bw >= 34 * hd) {
      drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
      drawShrub(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // =========================================================================
  // 6. REGIONAL RESIDENTIAL ARCHITECTURE:
  //    - Jerusalem Stone (Even Yerushalmit), Tel Aviv Bauhaus, Galilee & Desert Stucco
  //    - Classic New England Homes (Colonial, Cape, Victorian, Tudor, Craftsman, etc.)
  // =========================================================================
  if (
    houseStyleMode === "jerusalem_stone" ||
    houseStyleMode === "bauhaus_white" ||
    houseStyleMode === "galilee_stone" ||
    houseStyleMode === "desert_stucco"
  ) {
    const isBauhaus = houseStyleMode === "bauhaus_white";
    const isDesert = houseStyleMode === "desert_stucco";
    const isOldCity =
      Boolean(building.isOldCity) ||
      (Array.isArray(biomeConfig?.quirks) && biomeConfig.quirks.includes("jerusalem_old_city"));
    const hasTerracottaRoof =
      !isOldCity && !isBauhaus && !isDesert && (houseStyleMode === "galilee_stone" ? bSeed % 3 !== 0 : bSeed % 3 === 0);
    const roofH = hasTerracottaRoof
      ? Math.max(13 * hd, Math.floor(bh * 0.34))
      : Math.max(8 * hd, Math.min(13 * hd, Math.floor(bh * 0.22)));
    const wallH = Math.max(22 * hd, bh - roofH);
    const wallY = by + roofH;

    // 1. Roof: either Mediterranean red barrel-tile pitched roof OR flat limestone/stucco parapet + Dud Shemesh (or Old City Stone Vaulted Dome!)
    if (hasTerracottaRoof) {
      const terraStyle = {
        ...style,
        roofLight: "#db7348",
        roofMain: "#b5502e",
        roofDark: "#7d311a",
      };
      drawShingledRoof(ctx, bx, by, bw, roofH, wallY, terraStyle, 0.16, O, {
        hd,
        leafCluster: false,
        snowRoof: Boolean(biomeConfig?.hasSnowRoofs),
        seed: bSeed,
      });
    } else {
      // Sunlit flat Mediterranean parapet roof deck
      const deckFill = isBauhaus ? "#d9d4c9" : isDesert ? "#cca982" : "#dfd2b8";
      const deckInner = isBauhaus ? "#bfb9ad" : isDesert ? "#b5906a" : "#c7b89b";
      px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
      px(ctx, bx, by, bw, roofH, deckFill);
      px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(3, roofH - 4 * hd), deckInner);
      // Carved limestone / Bauhaus parapet coping cap
      px(ctx, bx - 2 * hd, wallY - 3 * hd, bw + 4 * hd, 4 * hd, O);
      px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 2 * hd, style.trim);
      px(ctx, bx - hd, wallY, bw + 2 * hd, hd, style.trimShade);
      if (isOldCity && bw >= 22 * hd) {
        // Historic Old City of Jerusalem vaulted white-limestone rooftop dome!
        const domeR = Math.min(10 * hd, Math.floor(bw * 0.24));
        const domeBaseY = by + Math.floor(roofH * 0.65);
        for (let dr = 0; dr < domeR; dr++) {
          const half = Math.max(2, Math.round(Math.sqrt(Math.max(0, domeR * domeR - (domeR - dr) * (domeR - dr)))));
          const ry = domeBaseY - domeR + dr;
          px(ctx, midX - half - 1, ry, half * 2 + 2, 1, O);
          px(ctx, midX - half, ry, half * 2, 1, dr < domeR * 0.45 ? "#faf5e8" : "#e3d6be");
        }
      } else if (bw >= 30 * hd) {
        // Iconic Israeli rooftop solar water heater (Dud Shemesh)!
        const solarX = bSeed % 2 === 0 ? bx + 5 * hd : bx + bw - 17 * hd;
        drawSolarWaterHeater(ctx, solarX, by - 5 * hd, hd, O);
      }
      // Home Base golden Jerusalem star roof medallion so your house pops unmistakably!
      if (building.isHomeBase) {
        px(ctx, midX - 4 * hd, by + Math.max(1, Math.floor(roofH / 2) - 3 * hd), 8 * hd, 6 * hd, O);
        px(ctx, midX - 3 * hd, by + Math.max(2, Math.floor(roofH / 2) - 2 * hd), 6 * hd, 4 * hd, "#1d529e");
        px(ctx, midX - hd, by + Math.max(2, Math.floor(roofH / 2) - hd), 2 * hd, 2 * hd, "#ffe066");
      }
    }

    // 2. Main Jerusalem Stone / Bauhaus Stucco / Desert Facade
    px(ctx, bx - 1, wallY, bw + 2, wallH + 1, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);

    // Carved corner quoins on Jerusalem Stone buildings
    if (style.isJerusalemStone) {
      for (let qy = wallY + 2 * hd; qy < wallY + wallH - 5 * hd; qy += 6 * hd) {
        px(ctx, bx, qy, 3 * hd, 4 * hd, style.wallLight);
        px(ctx, bx + bw - 3 * hd, qy, 3 * hd, 4 * hd, style.wallShade);
      }
    }

    // 3. Windows & Balconies
    if (isBauhaus) {
      // Tel Aviv White City Bauhaus horizontal ribbon windows + rounded cantilevered stone balcony!
      const ribY = wallY + 4 * hd;
      const ribH = Math.max(5 * hd, Math.floor(wallH * 0.22));
      px(ctx, bx + 4 * hd, ribY, bw - 8 * hd, ribH, O);
      px(ctx, bx + 5 * hd, ribY + 1, bw - 10 * hd, ribH - 2, "#4a8cb8");
      px(ctx, bx + 5 * hd, ribY + 1, bw - 10 * hd, Math.max(2, Math.floor(ribH * 0.45)), "#9be0fa");
      for (let mx = bx + 12 * hd; mx < bx + bw - 8 * hd; mx += 10 * hd) {
        px(ctx, mx, ribY, hd, ribH, "#f2efe8");
      }
      // Classic Bauhaus cantilevered white curved balcony right below upper floor
      const balW = Math.floor(bw * 0.56);
      const balX = midX - Math.floor(balW / 2);
      const balY = ribY + ribH + 2 * hd;
      px(ctx, balX - 1, balY - 1, balW + 2, 6 * hd + 2, O);
      px(ctx, balX, balY, balW, 5 * hd, "#ffffff");
      px(ctx, balX, balY + 4 * hd, balW, 2 * hd, "#c7c2b8");
      px(ctx, balX + 2 * hd, balY + hd, balW - 4 * hd, hd, "#2d6099");
    } else {
      // Jerusalem / Mediterranean arched stone windows with shutters & stone balcony!
      const winW = hd >= 2 ? 10 : 5;
      const winH = hd >= 2 ? 13 : 7;
      const upperWinY = wallY + 4 * hd;
      if (wallH >= 24 * hd && bw >= 34 * hd) {
        drawArchedCivicWindow(ctx, bx + 6 * hd, upperWinY, style, winW, winH, O);
        drawArchedCivicWindow(ctx, bx + bw - 6 * hd - winW, upperWinY, style, winW, winH, O);
        if (bw >= 56 * hd) {
          drawArchedCivicWindow(ctx, midX - Math.floor(winW / 2), upperWinY, style, winW, winH, O);
        }
      } else if (bw >= 26 * hd) {
        drawArchedCivicWindow(ctx, bx + 5 * hd, upperWinY, style, winW, Math.min(winH, wallH - 12 * hd), O);
        drawArchedCivicWindow(ctx, bx + bw - 5 * hd - winW, upperWinY, style, winW, Math.min(winH, wallH - 12 * hd), O);
      }
    }

    // 4. Arched Stone Entryway & Limestone Steps
    const doorW = 8 * hd;
    const doorH = Math.min(Math.max(10 * hd, Math.floor(wallH * 0.36)), wallH - 4 * hd);
    const doorX = midX - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2 * hd, doorY - 2 * hd, doorW + 4 * hd, doorH + 3 * hd, O);
    px(ctx, doorX - hd, doorY - hd, doorW + 2 * hd, doorH + 2 * hd, style.trim);
    px(ctx, doorX, doorY, doorW, doorH, O);
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 1, building.isHomeBase ? "#1d529e" : style.door);
    px(ctx, doorX + 2 * hd, doorY + 2 * hd, Math.max(2, doorW - 4 * hd), Math.max(3, Math.floor(doorH * 0.34)), "#ffe066");
    // Pale limestone entryway steps
    px(ctx, doorX - 2 * hd, wallY + wallH, doorW + 4 * hd, 3 * hd, O);
    px(ctx, doorX - hd, wallY + wallH, doorW + 2 * hd, 2 * hd, "#ede4d1");

    // 5. Low Jerusalem stone courtyard wall + cascading magenta Bougainvillea shrubs!
    if (bw >= 34 * hd) {
      if (isDesert) {
        drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
        drawShrub(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
      } else {
        drawBougainvilleaShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
        drawBougainvilleaShrub(ctx, bx + bw - 11 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
      }
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  /**
   * Reusable helper: render a warm cedar/wood covered front porch with sloped shingled porch roof,
   * turned columns, wooden spindle railings, paneled front door, glowing parlor window & stepped stairs!
   */
  const drawCoveredPorchWing = (px0, pw, wallY, wallH, { stonePiers = false, wideWindow = true } = {}) => {
    if (pw < 16 * hd) return;
    const porchRoofH = Math.max(5 * hd, Math.min(8 * hd, Math.floor(wallH * 0.25)));
    const porchTopY = wallY + Math.max(2 * hd, wallH - Math.min(20 * hd, Math.max(13 * hd, Math.floor(wallH * 0.62))));
    const deckH = 3 * hd;
    const deckY = wallY + wallH - deckH;
    const railH = Math.max(4 * hd, Math.floor((deckY - (porchTopY + porchRoofH)) * 0.36));
    const railTopY = deckY - railH;

    // 1. Recessed shaded porch back-wall behind the porch roof & railings
    const innerTop = porchTopY + porchRoofH;
    const innerH = Math.max(6, deckY - innerTop);
    px(ctx, px0 + 1, innerTop, pw - 2, innerH, "rgba(42, 18, 12, 0.16)");

    // 2. Paneled wooden front door tucked cleanly under the porch!
    const doorW = Math.min(Math.floor(pw * 0.32), 7 * hd);
    const doorH = Math.min(innerH - 1, 11 * hd);
    const doorX = wideWindow && pw >= 26 * hd ? px0 + 4 * hd : px0 + Math.floor((pw - doorW) / 2);
    const doorY = deckY - doorH;
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 1, O);
    px(ctx, doorX, doorY, doorW, doorH, style.trim);
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 1, style.door);
    // Door top glass lite (warm golden glow!) + lower wood panel + brass knob
    px(ctx, doorX + 2, doorY + 2, Math.max(2, doorW - 4), Math.max(3, Math.floor(doorH * 0.32)), "#ffe066");
    px(ctx, doorX + 2, doorY + 2, Math.max(1, doorW - 5), 1, "#fff8c7");
    px(ctx, doorX + 2, doorY + Math.floor(doorH * 0.56), Math.max(2, doorW - 4), Math.max(2, Math.floor(doorH * 0.3)), style.doorDark);
    px(ctx, doorX + doorW - 3, doorY + Math.floor(doorH * 0.52), 1, 2, "#ffe066");

    // 3. Wide glowing 6-pane golden parlor window beside the front door (like the sample Yellow House!)
    if (wideWindow && pw >= 26 * hd) {
      const availX = doorX + doorW + 3 * hd;
      const availW = px0 + pw - 3 * hd - availX;
      if (availW >= 10) {
        const wW = Math.min(availW, 9 * hd);
        const wH = Math.min(innerH - 3 * hd, 8 * hd);
        const wY = innerTop + Math.max(2, Math.floor((innerH - wH) / 2) - 1);
        drawColonialWindow(ctx, availX, wY, style, { shutters: false, winW: wW, winH: wH, panesX: 3, panesY: 2 }, O);
      }
    }

    // 4. Sloped shingled porch awning roof with warm trim fascia & drop shadow!
    px(ctx, px0 - hd, porchTopY - 1, pw + 2 * hd, porchRoofH + 2, O);
    for (let r = 0; r < porchRoofH; r++) {
      const col = r < 2 ? style.roofLight : r % 3 === 0 ? style.roofDark : style.roofMain;
      px(ctx, px0 - hd + 1, porchTopY + r, pw + 2 * hd - 2, 1, col);
    }
    px(ctx, px0 - hd + 1, porchTopY + porchRoofH - hd, pw + 2 * hd - 2, hd, style.trim);
    px(ctx, px0, porchTopY + porchRoofH + 1, pw, hd, "rgba(42, 18, 12, 0.28)");

    // 5. Warm cedar porch floor deck planks + foundation skirt below deck
    px(ctx, px0 - 1, deckY - 1, pw + 2, deckH + 2, O);
    px(ctx, px0, deckY, pw, deckH, style.porchWood);
    px(ctx, px0, deckY, pw, 1, shadeHex(style.porchWood, 24));
    for (let dx = px0 + 4; dx < px0 + pw - 2; dx += 4) {
      px(ctx, dx, deckY + 1, 1, deckH - 1, shadeHex(style.porchWood, -32));
    }

    // 6. Wooden porch railings with crisp vertical balusters (leaving clean opening in front of front door!)
    const stairOpenL = doorX - hd;
    const stairOpenR = doorX + doorW + hd;
    const drawRailSpan = (rx0, rx1) => {
      const rw = rx1 - rx0;
      if (rw < 4) return;
      px(ctx, rx0, railTopY, rw, 2, O);
      px(ctx, rx0, railTopY, rw, 1, "#c78652");
      px(ctx, rx0, deckY - 2, rw, 2, "#59301a");
      for (let bx2 = rx0 + 1; bx2 < rx1 - 1; bx2 += 3) {
        px(ctx, bx2, railTopY + 2, 1, Math.max(1, deckY - railTopY - 3), "#8c512c");
        px(ctx, bx2 + 1, railTopY + 2, 1, Math.max(1, deckY - railTopY - 3), "#4a2614");
      }
    };
    drawRailSpan(px0 + 2, stairOpenL);
    drawRailSpan(stairOpenR, px0 + pw - 2);

    // 7. Turned wooden porch columns (or tapered river-stone piers for Craftsman!)
    const colPositions = [px0 + 1, px0 + pw - 4];
    if (stairOpenR < px0 + pw - 8) colPositions.push(stairOpenR);
    for (const cx of colPositions) {
      if (stonePiers) {
        const pierH = Math.max(5 * hd, railH + deckH);
        px(ctx, cx - 1, wallY + wallH - pierH, 5, pierH + 1, O);
        px(ctx, cx, wallY + wallH - pierH + 1, 3, pierH - 1, "#a69c92");
        px(ctx, cx, innerTop, 3, Math.max(2, wallY + wallH - pierH - innerTop), O);
        px(ctx, cx + 1, innerTop, 1, Math.max(2, wallY + wallH - pierH - innerTop), style.trim);
      } else {
        px(ctx, cx, innerTop, 3, deckY - innerTop + 1, O);
        px(ctx, cx + 1, innerTop, 1, deckY - innerTop, "#d49b66");
      }
    }

    // 8. Three wide stepped cedar wooden front stairs + cobblestone walk stub!
    const stW = Math.max(doorW + 2 * hd, 9 * hd);
    const stX = Math.max(px0 + 1, Math.min(px0 + pw - stW - 1, doorX - hd));
    const stY = deckY + 1;
    px(ctx, stX - 1, stY, stW + 2, 5 * hd, O);
    for (let st = 0; st < 3; st++) {
      const sy = stY + st * Math.max(2, Math.floor(1.5 * hd));
      px(ctx, stX, sy, stW, 1, "#d99e68");
      px(ctx, stX, sy + 1, stW, Math.max(1, hd - 1), "#8c512c");
    }
    // Little cobblestone walkway stub beneath steps
    px(ctx, stX + 2, stY + 5 * hd, stW - 4, 2 * hd, "#a89693");
    px(ctx, stX + 3, stY + 5 * hd, stW - 6, 1, "#c7b5b0");
  };

  /**
   * Crown-Jewel Sample-Style Asymmetric Front-Gable + Covered Wooden Porch House!
   * Directly inspired by the warm golden yellow house in the user's reference artwork.
   */
  const drawSampleGablePorchHouse = ({
    gableOnLeft = true,
    stonePiers = false,
    metalRoof = false,
    boardAndBatten = false,
    hasPicketFence = false,
  } = {}) => {
    const wallH = Math.min(34 * hd, Math.max(18 * hd, Math.floor(bh * 0.50)));
    const roofH = Math.max(16 * hd, bh - wallH);
    const wallY = by + roofH;
    const roofStyle = metalRoof
      ? { ...style, roofLight: "#595452", roofMain: "#3d3938", roofDark: "#292524" }
      : style;

    // 1. Full main house wall body with rich 32-bit clapboards (or board-and-batten) & stone foundation
    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    if (boardAndBatten) {
      for (let sx = bx + 4 * hd; sx < bx + bw - 2; sx += 4 * hd) {
        px(ctx, sx, wallY, 1, wallH - 3 * hd, style.wallShade);
      }
      px(ctx, bx, wallY + wallH - 3 * hd, bw, 3 * hd, "#75655e");
    } else {
      drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    }
    // Crisp corner trim boards
    px(ctx, bx, wallY, 2 * hd, wallH - 2 * hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH - 2 * hd, style.trimShade);

    // 2. Main shingled horizontal roof across the entire building width (with autumn roof leaf cluster!)
    const slopeInset = drawShingledRoof(ctx, bx, by, bw, roofH, wallY, roofStyle, 0.14, O, {
      hd,
      leafCluster: true,
      seed: bSeed,
    });
    if (metalRoof) {
      for (let mx = bx + 5 * hd; mx < bx + bw - 5 * hd; mx += 6 * hd) {
        px(ctx, mx, by + 3 * hd, 1, roofH - 4 * hd, "#24201f");
      }
    }

    // 3. Tall Asymmetric Front-Facing Triangular Gable Wing (~46% width) + Covered Front Porch Wing (~54%)!
    if (bw >= 30 * hd) {
      const gableW = Math.max(16 * hd, Math.floor(bw * 0.46));
      const gLeft = gableOnLeft ? bx : bx + bw - gableW;
      const gMid = gLeft + Math.floor(gableW / 2);
      const gHalf = Math.floor(gableW / 2);
      const gH = Math.min(roofH + 3 * hd, Math.max(14 * hd, Math.floor(roofH * 0.96)));
      const gBaseY = wallY;
      const clapStep = hd >= 2 ? 4 : 3;
      const grooveCol = shadeHex(style.wallShade, -26);

      // Brick chimney on the opposite (main shingled roof) wing right above the ridge!
      const chX = gableOnLeft
        ? Math.min(bx + bw - slopeInset - 7 * hd, gLeft + gableW + Math.floor((bw - gableW) * 0.45))
        : Math.max(bx + slopeInset + 2 * hd, gLeft - Math.floor((bw - gableW) * 0.55));
      drawChimney(ctx, chX, by - 7 * hd, 5 * hd, 8 * hd, O);

      // Tall clapboard front gable triangle with sculpted 3D sunlit-left vs shaded-right bargeboards!
      const litVerge = shadeHex(roofStyle.roofLight, 16);
      const shadeVerge = shadeHex(roofStyle.roofDark, -8);
      for (let gy = 0; gy < gH; gy++) {
        const halfSpan = Math.max(1, Math.round((gy / Math.max(1, gH - 1)) * gHalf));
        const rowY = gBaseY - gH + gy;
        const lx = gMid - halfSpan;
        const rx = gMid + halfSpan;
        // Overhanging shingled bargeboards (warm sunlit tan left slope vs deep chestnut shaded right slope!)
        px(ctx, lx - 4 * hd, rowY, 4 * hd, 1, O);
        px(ctx, rx, rowY, 4 * hd, 1, O);
        px(ctx, lx - 3 * hd, rowY, 3 * hd, 1, gy % 4 === 0 ? roofStyle.roofMain : litVerge);
        px(ctx, rx, rowY, 3 * hd, 1, gy % 4 === 0 ? shadeVerge : roofStyle.roofDark);
        // Cream rake trim inside verge
        px(ctx, lx - hd, rowY, hd, 1, style.trim);
        px(ctx, rx - hd, rowY, hd, 1, style.trimShade);
        // Clapboard fill inside gable triangle
        const fillW = Math.max(0, halfSpan * 2 - 2 * hd);
        if (fillW > 0) {
          const isGroove = gy % clapStep === clapStep - 1;
          const isLit = gy % clapStep === 0;
          px(
            ctx,
            lx + hd,
            rowY,
            fillW,
            1,
            isGroove ? grooveCol : isLit ? style.wallLight : style.wallMain
          );
          // Crisp 3D overhang cast shadow tucked diagonally along the sloped gable roof!
          if (fillW >= 6) {
            px(ctx, lx + hd, rowY, 3, 1, "rgba(42, 18, 12, 0.28)");
            px(ctx, rx - hd - 4, rowY, 4, 1, "rgba(42, 18, 12, 0.34)");
          }
        }
      }
      // Crisp gable apex cap & horizontal eave fascia separating gable from 1st floor
      px(ctx, gMid - hd, gBaseY - gH - hd, 2 * hd, 2 * hd, O);
      px(ctx, gLeft - hd, gBaseY - hd, gableW + 2 * hd, hd + 1, O);
      px(ctx, gLeft, gBaseY - hd, gableW, hd, style.trim);
      // Vertical trim dividing the gable wing cleanly from the porch wing
      const splitX = gableOnLeft ? gLeft + gableW : gLeft - hd;
      px(ctx, splitX, wallY, hd, wallH - 2 * hd, style.trim);
      px(ctx, splitX + (gableOnLeft ? hd : -1), wallY, 1, wallH - 2 * hd, O);

      // 2nd-story glowing 4-pane window centered inside the tall gable triangle!
      const upWinW = Math.min(Math.floor(gableW * 0.42), hd >= 2 ? 11 : 6);
      const upWinH = Math.min(Math.floor(gH * 0.48), hd >= 2 ? 13 : 7);
      if (upWinW >= 5 && upWinH >= 6 && gH >= 12 * hd) {
        drawColonialWindow(
          ctx,
          gMid - Math.floor(upWinW / 2),
          gBaseY - upWinH - 4 * hd,
          style,
          { shutters: false, winW: upWinW, winH: upWinH, panesX: 2, panesY: 2 },
          O
        );
      }

      // 1st-story large glowing 6-pane window centered on the gable wing wall!
      const lowWinW = Math.min(gableW - 8 * hd, hd >= 2 ? 14 : 7);
      const lowWinH = Math.min(wallH - 8 * hd, hd >= 2 ? 16 : 8);
      if (lowWinW >= 6 && lowWinH >= 6) {
        drawColonialWindow(
          ctx,
          gMid - Math.floor(lowWinW / 2),
          wallY + Math.max(3 * hd, Math.floor((wallH - lowWinH) / 2) - hd),
          style,
          { shutters: false, winW: lowWinW, winH: lowWinH, panesX: 2, panesY: 2 },
          O
        );
      }

      // Covered Front Wooden Porch on the opposite wing!
      const porchX = gableOnLeft ? gLeft + gableW + hd : bx + hd;
      const porchW = bw - gableW - 2 * hd;
      drawCoveredPorchWing(porchX, porchW, wallY, wallH, { stonePiers, wideWindow: true });

      // Clustered multi-size lush green boxwood hedges tucked along foundation corners (straight from the sample!)
      drawShrub(ctx, gLeft + hd, wallY + wallH - 6 * hd, 10 * hd, 8 * hd);
      drawShrub(ctx, gLeft + 8 * hd, wallY + wallH - 4 * hd, 7 * hd, 6 * hd);
      const rightCornerX = gableOnLeft ? bx + bw - 10 * hd : gLeft + gableW - 10 * hd;
      drawShrub(ctx, rightCornerX, wallY + wallH - 6 * hd, 10 * hd, 8 * hd);
      drawShrub(ctx, rightCornerX - 5 * hd, wallY + wallH - 4 * hd, 6 * hd, 5 * hd);
    } else {
      // Compact narrow cottage lot: centered chimney, covered front porch door & cozy glowing windows!
      drawChimney(ctx, bx + bw - slopeInset - 6 * hd, by - 5 * hd, 4 * hd, 6 * hd, O);
      drawCoveredPorchWing(bx + 2 * hd, bw - 4 * hd, wallY, wallH, { stonePiers, wideWindow: false });
      drawShrub(ctx, bx + hd, wallY + wallH - 5 * hd, 7 * hd, 6 * hd);
    }

    // Warm cedar wooden picket fence flanking Home Base & select neighborhood yards!
    if (hasPicketFence && bw >= 38 * hd) {
      drawPicketFence(ctx, bx - 2 * hd, wallY + wallH - 5 * hd, 12 * hd, 7 * hd);
      drawPicketFence(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 12 * hd, 7 * hd);
      drawMailbox(ctx, midX + 8 * hd, wallY + wallH - 5 * hd);
    } else if (building.houseNumber && bw >= 36 * hd && (minX + minY) % 3 === 0) {
      drawMailbox(ctx, bx + bw - 6 * hd, wallY + wallH - 5 * hd);
    }

    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  };

  // --- 6A-1. ARTS & CRAFTS BUNGALOW (Front-gable + tapered river-stone porch piers!) ---
  if (arch === "craftsman") {
    return drawSampleGablePorchHouse({
      gableOnLeft: (bSeed & 1) === 0,
      stonePiers: true,
    });
  }

  // --- 6A-2. NEW ENGLAND FARMHOUSE (Board-and-batten + standing-seam roof + full covered porch!) ---
  if (arch === "farmhouse") {
    return drawSampleGablePorchHouse({
      gableOnLeft: (bSeed & 1) === 1,
      metalRoof: true,
      boardAndBatten: true,
    });
  }

  // --- 6A-3. HISTORIC NEW ENGLAND SALTBOX (Warm gable + sweeping roof + cedar porch!) ---
  if (arch === "saltbox") {
    return drawSampleGablePorchHouse({
      gableOnLeft: (bSeed & 1) === 0,
      hasPicketFence: (bSeed % 3) === 0,
    });
  }

  // --- 6A-4. DUTCH COLONIAL GAMBREL (32-bit HD Two-slope barn roof + full front shed dormer!) ---
  if (arch === "gambrel") {
    const wallH = Math.min(30 * hd, Math.max(16 * hd, Math.floor(bh * 0.45)));
    const roofH = Math.max(18 * hd, bh - wallH);
    const wallY = by + roofH;

    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    px(ctx, bx, wallY, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH - hd, style.trimShade);

    const breakRow = Math.floor(roofH * 0.4);
    const maxInset = Math.min(Math.floor(bw * 0.25), 11 * hd);
    for (let row = 0; row < roofH; row++) {
      let inset;
      if (row <= breakRow) {
        const t = row / Math.max(1, breakRow);
        inset = Math.round(maxInset - t * (maxInset * 0.65));
      } else {
        const t = (row - breakRow) / Math.max(1, roofH - 1 - breakRow);
        inset = Math.round(maxInset * 0.35 * (1 - t));
      }
      const rx = bx - 2 * hd + inset;
      const rw = bw + 4 * hd - inset * 2;
      const ry = by + row;
      px(ctx, rx - 1, ry, 1, 1, O);
      px(ctx, rx + rw, ry, 1, 1, O);
      if (row === 0) px(ctx, rx, ry - 1, rw, 1, O);
      px(ctx, rx, ry, rw, 1, row < breakRow ? style.roofLight : row % 4 === 0 ? style.roofDark : style.roofMain);
      if (row === breakRow) px(ctx, rx + 1, ry, rw - 2, hd, style.roofDark);
    }
    px(ctx, bx - 2 * hd, wallY - hd, bw + 4 * hd, hd + 1, O);
    px(ctx, bx - 2 * hd + 1, wallY - hd, bw + 4 * hd - 2, hd, style.trim);

    // Wide HD Dutch Colonial shed dormer with glowing 2nd-floor windows!
    if (bw >= 28 * hd && roofH >= 14 * hd) {
      const dW = Math.max(18 * hd, bw - 14 * hd);
      const dX = midX - Math.floor(dW / 2);
      const dH = Math.min(11 * hd, roofH - 5 * hd);
      const dY = wallY - dH - hd;
      px(ctx, dX - 1, dY - 1, dW + 2, dH + 2, O);
      px(ctx, dX, dY, dW, dH, style.wallLight);
      px(ctx, dX - hd, dY - hd, dW + 2 * hd, 2 * hd, O);
      px(ctx, dX, dY - hd + 1, dW, hd, style.roofDark);
      const dwW = hd >= 2 ? 9 : 5;
      const dwH = Math.min(dH - 3 * hd, hd >= 2 ? 10 : 5);
      if (dwH >= 4) {
        for (let wx = dX + 4 * hd; wx + dwW <= dX + dW - 4 * hd; wx += dwW + 5 * hd) {
          drawColonialWindow(ctx, wx, dY + 2 * hd, style, { shutters: false, winW: dwW, winH: dwH }, O);
        }
      }
    }
    if (bw >= 24 * hd) drawChimney(ctx, bx + bw - 10 * hd, by - 6 * hd, 5 * hd, 7 * hd, O);

    // Covered center portico + glowing flanking windows + boxwood shrubs
    const doorW = 6 * hd;
    const doorH = Math.min(wallH - 4 * hd, 12 * hd);
    px(ctx, midX - Math.floor(doorW / 2) - 2 * hd, wallY + wallH - doorH - 3 * hd, doorW + 4 * hd, 2 * hd, O);
    px(ctx, midX - Math.floor(doorW / 2) - hd, wallY + wallH - doorH - 2 * hd, doorW + 2 * hd, hd, style.trim);
    px(ctx, midX - Math.floor(doorW / 2) - 1, wallY + wallH - doorH - hd, doorW + 2, doorH + hd, O);
    px(ctx, midX - Math.floor(doorW / 2), wallY + wallH - doorH, doorW, doorH, style.door);
    px(ctx, midX - Math.floor(doorW / 2) + 2, wallY + wallH - doorH + 2, Math.max(2, doorW - 4), 4 * hd, "#ffe066");
    px(ctx, midX - Math.floor(doorW / 2) - hd, wallY + wallH, doorW + 2 * hd, 3 * hd, "#d6c5b4");
    if (bw >= 30 * hd && wallH >= 12 * hd) {
      const wW = hd >= 2 ? 11 : 6;
      const wH = hd >= 2 ? 13 : 7;
      const wy = wallY + Math.max(3 * hd, Math.floor((wallH - wH) / 2) - hd);
      drawColonialWindow(ctx, bx + 5 * hd, wy, style, { shutters: true, winW: wW, winH: wH }, O);
      drawColonialWindow(ctx, bx + bw - 5 * hd - wW, wy, style, { shutters: true, winW: wW, winH: wH }, O);
    }
    if (bw >= 30 * hd) {
      drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
      drawShrub(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6A-5. BOSTON/NEWTON BRICK BROWNSTONE (32-bit HD Cornice + Bowfront Bay + Iron Stoop!) ---
  if (arch === "brownstone") {
    const roofH = Math.min(14 * hd, Math.max(8 * hd, Math.floor(bh * 0.24)));
    const wallH = Math.max(20 * hd, bh - roofH);
    const wallY = by + roofH;
    const stoneWall = style.isBrick ? style : HOUSE_COLOR_PRESETS.brick;

    px(ctx, bx - 1, by - 1, bw + 2, roofH + wallH + 2, O);
    px(ctx, bx, by, bw, roofH, "#524442");
    px(ctx, bx + 2 * hd, by + 2 * hd, Math.max(4, bw - 4 * hd), Math.max(4, roofH - 4 * hd), "#3d3130");
    px(ctx, bx - 2 * hd, wallY - 3 * hd, bw + 4 * hd, 4 * hd, O);
    px(ctx, bx - hd, wallY - 2 * hd, bw + 2 * hd, 2 * hd, "#785a4a");

    px(ctx, bx, wallY + hd, bw, wallH - hd, stoneWall.wallMain);
    drawWallTexture(ctx, bx, wallY + hd, bw, wallH - hd, stoneWall, hd);

    const bayW = Math.min(Math.floor(bw * 0.48), 22 * hd);
    const bayX = bx + 3 * hd;
    if (bayW >= 12 * hd) {
      px(ctx, bayX - 1, wallY + hd, bayW + 2, wallH - hd, O);
      px(ctx, bayX, wallY + hd, bayW, wallH - 2 * hd, stoneWall.wallLight);
      const stories = wallH >= 26 * hd ? 2 : 1;
      const sh = Math.floor((wallH - 6 * hd) / stories);
      for (let s = 0; s < stories; s++) {
        const wy = wallY + 3 * hd + s * sh;
        const ww = Math.max(4 * hd, Math.floor((bayW - 6 * hd) / 2));
        const wh = Math.min(sh - 3 * hd, 9 * hd);
        if (wh >= 5) {
          drawColonialWindow(ctx, bayX + 2 * hd, wy, stoneWall, { shutters: false, winW: ww, winH: wh }, O);
          if (bayW >= 18 * hd) {
            drawColonialWindow(ctx, bayX + bayW - 2 * hd - ww, wy, stoneWall, { shutters: false, winW: ww, winH: wh }, O);
          }
        }
      }
    }
    const doorW = 6 * hd;
    const doorX = bx + bw - Math.max(10 * hd, Math.floor(bw * 0.30));
    const doorH = Math.min(12 * hd, wallH - 6 * hd);
    const doorY = wallY + wallH - doorH - 4 * hd;
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2, O);
    px(ctx, doorX, doorY, doorW, doorH, "#593d30");
    px(ctx, doorX + 2, doorY + 2, Math.max(2, doorW - 4), Math.max(3, Math.floor(doorH * 0.35)), "#ffe066");
    for (let st = 0; st < 4; st++) {
      px(ctx, doorX - hd, wallY + wallH - 4 * hd + st * hd, doorW + 2 * hd, hd, st % 2 === 0 ? "#9c8273" : "#70594d");
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6A-6. NEW ENGLAND FIELDSTONE MANOR (32-bit HD Fieldstone + Twin Gables + Glowing Windows!) ---
  if (arch === "stone_manor") {
    const wallH = Math.min(34 * hd, Math.max(16 * hd, Math.floor(bh * 0.50)));
    const roofH = Math.max(16 * hd, bh - wallH);
    const wallY = by + roofH;

    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, "#8c7f75");
    const stoneTones = ["#aba096", "#736860", "#9c9086", "#635954"];
    for (let sy = wallY + 2; sy < wallY + wallH - 2; sy += 4) {
      const off = ((sy - wallY) / 4) % 2 === 0 ? 0 : 3;
      for (let sx = bx + 2 + off; sx < bx + bw - 4; sx += 7) {
        px(ctx, sx, sy, 6, 3, stoneTones[(sx + sy) % stoneTones.length]);
      }
    }
    const slateRoof = { ...style, roofLight: "#786962", roofMain: "#574a46", roofDark: "#382e2c" };
    drawShingledRoof(ctx, bx, by, bw, roofH, wallY, slateRoof, 0.15, O, { hd, seed: bSeed });

    if (bw >= 32 * hd) {
      for (const gCx of [bx + Math.floor(bw * 0.28), bx + Math.floor(bw * 0.72)]) {
        const gHalf = Math.min(10 * hd, Math.floor(bw * 0.18));
        const gH = Math.min(14 * hd, roofH - 2 * hd);
        for (let gy = 0; gy < gH; gy++) {
          const span = Math.max(1, Math.round((gy / Math.max(1, gH - 1)) * gHalf));
          const ry = wallY - gH + gy;
          px(ctx, gCx - span - 2, ry, span * 2 + 4, 1, O);
          px(ctx, gCx - span, ry, span * 2, 1, "#9c9086");
        }
        drawColonialWindow(ctx, gCx - 3 * hd, wallY - 8 * hd, style, { shutters: false, winW: 6 * hd, winH: 6 * hd }, O);
      }
    }
    if (bw >= 24 * hd) drawChimney(ctx, midX - 3 * hd, by - 7 * hd, 6 * hd, 8 * hd, O);

    const doorW = 6 * hd;
    const doorH = Math.min(wallH - 4 * hd, 12 * hd);
    px(ctx, midX - Math.floor(doorW / 2) - 2, wallY + wallH - doorH - 2, doorW + 4, doorH + 3, O);
    px(ctx, midX - Math.floor(doorW / 2), wallY + wallH - doorH, doorW, doorH, "#593420");
    if (bw >= 30 * hd && wallH >= 12 * hd) {
      const wW = hd >= 2 ? 11 : 6;
      const wH = hd >= 2 ? 13 : 7;
      const wy = wallY + Math.max(3 * hd, Math.floor((wallH - wH) / 2) - hd);
      drawColonialWindow(ctx, bx + 5 * hd, wy, { ...style, trim: "#d6c5b4" }, { shutters: false, winW: wW, winH: wH }, O);
      drawColonialWindow(ctx, bx + bw - 5 * hd - wW, wy, { ...style, trim: "#d6c5b4" }, { shutters: false, winW: wW, winH: wH }, O);
    }
    drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    drawShrub(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6A. RANCH / SPLIT-LEVEL (32-bit HD Low Hipped Roof + Big Glowing Picture Window + Garage!) ---
  if (arch === "ranch") {
    const wallH = Math.min(30 * hd, Math.max(16 * hd, Math.floor(bh * 0.50)));
    const roofH = Math.max(14 * hd, bh - wallH);
    const wallY = by + roofH;

    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    px(ctx, bx, wallY, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH - hd, style.trimShade);

    drawShingledRoof(ctx, bx, by, bw, roofH, wallY, style, 0.22, O, { hd, seed: bSeed });
    if (bw >= 24 * hd) drawChimney(ctx, bx + Math.floor(bw * 0.35), by - 5 * hd, 5 * hd, 7 * hd, O);

    const hasGarageBay = bw >= 36 * hd;
    const garW = hasGarageBay ? Math.min(20 * hd, Math.floor(bw * 0.34)) : 0;
    const garX = bx + bw - garW - 3 * hd;
    if (hasGarageBay) {
      const garH = Math.min(wallH - 4 * hd, 14 * hd);
      const garY = wallY + wallH - garH;
      px(ctx, garX - 1, garY - 1, garW + 2, garH + 1, O);
      px(ctx, garX, garY, garW, garH, style.trim);
      for (let gy = garY + 4 * hd; gy < garY + garH - 1; gy += 3 * hd) {
        px(ctx, garX + 1, gy, garW - 2, 1, style.trimShade);
      }
      px(ctx, garX, wallY + wallH + 1, garW, 3 * hd, "#b5a39c");
    }

    const doorW = 6 * hd;
    const doorX = hasGarageBay ? garX - 10 * hd : midX - Math.floor(doorW / 2);
    const doorH = Math.min(wallH - 4 * hd, 12 * hd);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2, O);
    px(ctx, doorX, doorY, doorW, doorH, style.trim);
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 1, style.door);
    px(ctx, doorX - hd, wallY + wallH, doorW + 2 * hd, 3 * hd, "#b87442");

    const picSpace = doorX - (bx + 5 * hd);
    if (picSpace >= 10 * hd && wallH >= 12 * hd) {
      const pw = Math.min(18 * hd, picSpace - 2 * hd);
      const ph = Math.min(wallH - 8 * hd, 10 * hd);
      const py = wallY + Math.max(3 * hd, Math.floor((wallH - ph) / 2) - hd);
      drawColonialWindow(ctx, bx + 5 * hd, py, style, { shutters: false, winW: pw, winH: ph, panesX: 3, panesY: 2 }, O);
    }
    if (bw >= 30 * hd) drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6B. MODERN / CONTEMPORARY CRAFTSMAN (32-bit HD Asymmetric Shed Roof + Warm Cedar & Glowing Glass!) ---
  if (arch === "modern") {
    const wallH = Math.min(34 * hd, Math.max(18 * hd, Math.floor(bh * 0.56)));
    const roofH = Math.max(12 * hd, bh - wallH);
    const wallY = by + roofH;

    const flip = (minX + minY) % 2 === 1;
    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    const cedarW = Math.max(10 * hd, Math.floor(bw * 0.36));
    const cedarX = flip ? bx + bw - cedarW : bx;
    px(ctx, cedarX, wallY, cedarW, wallH - 2 * hd, "#b57442");
    for (let cx = cedarX + 3; cx < cedarX + cedarW - 1; cx += 4) {
      px(ctx, cx, wallY, 1, wallH - 2 * hd, "#7d4924");
    }
    px(ctx, bx, wallY + wallH - 3 * hd, bw, 3 * hd, "#6b5d56");

    for (let x = 0; x < bw + 6 * hd; x++) {
      const t = flip ? 1 - x / Math.max(1, bw + 6 * hd - 1) : x / Math.max(1, bw + 6 * hd - 1);
      const topY = Math.round(by + t * Math.min(10 * hd, roofH - 4 * hd));
      const colX = bx - 3 * hd + x;
      const colH = Math.max(4 * hd, wallY - topY);
      px(ctx, colX, topY - 1, 1, 1, O);
      px(ctx, colX, topY, 1, colH, x % 8 === 0 ? "#382c2a" : "#524340");
      px(ctx, colX, wallY - 2 * hd, 1, 2 * hd, "#b87a46");
    }
    px(ctx, bx - 3 * hd, wallY, bw + 6 * hd, hd, O);

    const doorW = 7 * hd;
    const doorH = Math.min(wallH - 4 * hd, 13 * hd);
    const doorX = flip ? bx + bw - Math.floor(cedarW / 2) - Math.floor(doorW / 2) : bx + Math.floor(cedarW / 2) - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2, O);
    px(ctx, doorX, doorY, doorW, doorH, "#3d2820");
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 2, "#8c512c");
    px(ctx, doorX + 3, doorY + 3, Math.max(2, doorW - 6), Math.max(4, doorH - 7), "#ffe066");

    const glassStart = flip ? bx + 4 * hd : bx + cedarW + 4 * hd;
    const glassEnd = flip ? bx + bw - cedarW - 4 * hd : bx + bw - 4 * hd;
    const glassW = glassEnd - glassStart;
    if (glassW >= 10 * hd && wallH >= 12 * hd) {
      const gh = Math.min(wallH - 8 * hd, 14 * hd);
      const gy = wallY + Math.max(3 * hd, Math.floor((wallH - gh) / 2));
      drawColonialWindow(ctx, glassStart, gy, { ...style, trim: "#3d2820", trimShade: "#291a18" }, { shutters: false, winW: glassW, winH: gh, panesX: 3, panesY: 2 }, O);
    }
    drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6C. TUDOR REVIVAL (32-bit HD Steep Timber Cross-Gable + Warm Stucco + Brick Base!) ---
  if (arch === "tudor") {
    const wallH = Math.min(34 * hd, Math.max(16 * hd, Math.floor(bh * 0.48)));
    const roofH = Math.max(16 * hd, bh - wallH);
    const wallY = by + roofH;

    const stuccoCol = style.isBrick ? "#ebd8bc" : style.wallMain;
    const timber = "#422719";
    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, stuccoCol);
    const skirtH = Math.max(6 * hd, Math.floor(wallH * 0.36));
    px(ctx, bx, wallY + wallH - skirtH, bw, skirtH, "#9e3e2f");
    px(ctx, bx, wallY + wallH - skirtH, bw, hd, timber);
    px(ctx, bx, wallY, bw, 2 * hd, timber);
    for (let tx = bx; tx < bx + bw; tx += 8 * hd) {
      px(ctx, tx, wallY, 2 * hd, wallH - skirtH, timber);
    }
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH, timber);

    const slopeInset = drawShingledRoof(ctx, bx, by, bw, roofH, wallY, style, 0.16, O, { hd, seed: bSeed });
    if (bw >= 26 * hd) {
      const gCx = bx + Math.max(12 * hd, Math.floor(bw * 0.34));
      const gHalfW = Math.min(15 * hd, Math.floor(bw * 0.28));
      const gH = Math.min(18 * hd, Math.max(11 * hd, Math.floor(roofH * 0.9)));
      for (let gy = 0; gy < gH; gy++) {
        const span = Math.max(1, Math.round((gy / Math.max(1, gH - 1)) * gHalfW));
        const ry = wallY - gH + gy;
        px(ctx, gCx - span - 2 * hd, ry, 2 * hd, 1, O);
        px(ctx, gCx + span, ry, 2 * hd, 1, O);
        px(ctx, gCx - span - hd, ry, hd, 1, timber);
        px(ctx, gCx + span, ry, hd, 1, timber);
        px(ctx, gCx - span, ry, span * 2, 1, "#f2e2c6");
      }
      px(ctx, gCx, wallY - gH + 3, hd, gH - 3, timber);
      px(ctx, gCx - Math.floor(gHalfW * 0.65), wallY - 4 * hd, Math.floor(gHalfW * 1.3), hd, timber);
      if (gH >= 11 * hd) {
        drawColonialWindow(ctx, gCx - 4 * hd, wallY - 9 * hd, { ...style, trim: timber }, { shutters: false, winW: 8 * hd, winH: 7 * hd }, O);
      }
    }
    if (bw >= 24 * hd) drawChimney(ctx, bx + bw - slopeInset - 7 * hd, by - 7 * hd, 5 * hd, 8 * hd, O);

    const doorW = 7 * hd;
    const doorX = bw >= 30 * hd ? bx + Math.floor(bw * 0.62) - Math.floor(doorW / 2) : midX - Math.floor(doorW / 2);
    const doorH = Math.min(wallH - 4 * hd, 13 * hd);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2, doorY, doorW + 4, doorH + 2, O);
    px(ctx, doorX, doorY - hd, doorW, 2 * hd, O);
    px(ctx, doorX - 1, doorY, doorW + 2, doorH + 1, "#d6c5b4");
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 1, "#5c341d");
    px(ctx, doorX - hd, wallY + wallH, doorW + 2 * hd, 3 * hd, "#cfc0b2");

    if (bw >= 28 * hd && wallH >= 12 * hd) {
      const wW = hd >= 2 ? 12 : 6;
      const wH = hd >= 2 ? 13 : 7;
      const winY = wallY + Math.max(3 * hd, Math.floor((wallH - wH) / 2) - hd);
      drawColonialWindow(ctx, bx + 5 * hd, winY, { ...style, trim: timber }, { shutters: false, winW: wW, winH: wH }, O);
      if (bx + bw - 5 * hd - wW > doorX + doorW + 3 * hd) {
        drawColonialWindow(ctx, bx + bw - 5 * hd - wW, winY, { ...style, trim: timber }, { shutters: false, winW: wW, winH: wH }, O);
      }
    }
    if (bw >= 30 * hd) {
      drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
      drawShrub(ctx, bx + bw - 11 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6D. CAPE COD COTTAGE (32-bit HD Steep Shingled Roof + 2 Glowing Dormers + Flowerboxes!) ---
  if (arch === "cape") {
    const wallH = Math.min(28 * hd, Math.max(15 * hd, Math.floor(bh * 0.44)));
    const roofH = Math.max(18 * hd, bh - wallH);
    const wallY = by + roofH;

    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    px(ctx, bx, wallY, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH - hd, style.trimShade);

    drawShingledRoof(ctx, bx, by, bw, roofH, wallY, style, 0.13, O, { hd, seed: bSeed });

    if (bw >= 22 * hd) drawChimney(ctx, midX - 3 * hd, by - 7 * hd, 6 * hd, 8 * hd, O);

    // Two crisp 32-bit gabled roof dormers with glowing attic windows!
    if (bw >= 28 * hd && roofH >= 14 * hd) {
      const dormerXs = [bx + Math.floor(bw * 0.27), bx + Math.floor(bw * 0.73)];
      const dW = 9 * hd;
      const dH = 9 * hd;
      const dormerY = wallY - dH - 2 * hd;
      for (const dx of dormerXs) {
        for (let r = 0; r < 4 * hd; r++) {
          const sp = Math.max(2, Math.round((r / (4 * hd)) * (dW / 2 + 2)));
          px(ctx, dx - sp - 1, dormerY - 4 * hd + r, sp * 2 + 2, 1, O);
          px(ctx, dx - sp, dormerY - 4 * hd + r, sp * 2, 1, style.roofDark);
        }
        px(ctx, dx - Math.floor(dW / 2) - 1, dormerY, dW + 2, dH + 1, O);
        px(ctx, dx - Math.floor(dW / 2), dormerY + 1, dW, dH - 1, style.wallLight);
        drawColonialWindow(
          ctx,
          dx - 3 * hd,
          dormerY + 2 * hd,
          style,
          { shutters: false, winW: 6 * hd, winH: 6 * hd },
          O
        );
      }
    }

    // Center cottage front door with warm porch awning & wooden steps
    const doorW = 6 * hd;
    const doorH = Math.min(wallH - 3 * hd, 12 * hd);
    const doorX = midX - Math.floor(doorW / 2);
    const doorY = wallY + wallH - doorH - hd;
    px(ctx, doorX - 2 * hd, doorY - 2 * hd, doorW + 4 * hd, 2 * hd, O);
    px(ctx, doorX - hd, doorY - hd, doorW + 2 * hd, hd, style.roofDark);
    px(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2, O);
    px(ctx, doorX, doorY, doorW, doorH, style.trim);
    px(ctx, doorX + 1, doorY + 1, doorW - 2, doorH - 1, style.door);
    px(ctx, doorX + 2, doorY + 2, Math.max(2, doorW - 4), 4 * hd, "#ffe066");
    px(ctx, doorX - hd, wallY + wallH, doorW + 2 * hd, 3 * hd, "#b87442");

    if (bw >= 28 * hd && wallH >= 12 * hd) {
      const wW = hd >= 2 ? 11 : 6;
      const wH = hd >= 2 ? 12 : 6;
      const winY = wallY + Math.max(3 * hd, Math.floor((wallH - wH) / 2) - hd);
      drawColonialWindow(ctx, bx + 5 * hd, winY, style, { flowerbox: true, shutters: true, winW: wW, winH: wH }, O);
      drawColonialWindow(ctx, bx + bw - 5 * hd - wW, winY, style, { flowerbox: true, shutters: true, winW: wW, winH: wH }, O);
    }
    if (bw >= 30 * hd) {
      drawShrub(ctx, bx + 2 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
      drawShrub(ctx, bx + bw - 10 * hd, wallY + wallH - 5 * hd, 8 * hd, 6 * hd);
    }
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6E. QUEEN ANNE VICTORIAN (32-bit HD Corner Turret + Covered Wooden Veranda Porch!) ---
  if (arch === "victorian") {
    const wallH = Math.min(34 * hd, Math.max(18 * hd, Math.floor(bh * 0.50)));
    const roofH = Math.max(16 * hd, bh - wallH);
    const wallY = by + roofH;

    px(ctx, bx - 1, wallY - 1, bw + 2, wallH + 2, O);
    px(ctx, bx, wallY, bw, wallH, style.wallMain);
    drawWallTexture(ctx, bx, wallY, bw, wallH, style, hd);
    px(ctx, bx, wallY, 2 * hd, wallH - hd, style.trim);
    px(ctx, bx + bw - 2 * hd, wallY, 2 * hd, wallH - hd, style.trimShade);

    drawShingledRoof(ctx, bx, by, bw, roofH, wallY, style, 0.15, O, { hd, seed: bSeed });

    const turretRight = (minX + minY) % 2 === 0;
    const hasTurret = bw >= 30 * hd;
    const turW = 14 * hd;
    const turX = turretRight ? bx + bw - turW + hd : bx - hd;
    if (hasTurret) {
      px(ctx, turX - 1, wallY - 3 * hd, turW + 2, wallH + 4 * hd, O);
      px(ctx, turX, wallY - 2 * hd, turW, wallH + 2 * hd, style.wallLight);
      px(ctx, turX + turW - 3 * hd, wallY - 2 * hd, 3 * hd, wallH + 2 * hd, style.wallShade);
      const spireH = Math.min(18 * hd, roofH + 5 * hd);
      const tMid = turX + Math.floor(turW / 2);
      for (let sy = 0; sy < spireH; sy++) {
        const half = Math.max(1, Math.round((sy / Math.max(1, spireH - 1)) * (turW / 2 + 2)));
        const ry = wallY - 2 * hd - spireH + sy;
        px(ctx, tMid - half - 1, ry, half * 2 + 2, 1, O);
        px(ctx, tMid - half, ry, half * 2, 1, sy % 4 === 0 ? style.roofDark : style.roofMain);
      }
      px(ctx, tMid, wallY - 5 * hd - spireH, hd, 4 * hd, "#ffe066");
      drawColonialWindow(ctx, turX + 2 * hd, wallY + 3 * hd, style, { shutters: false, winW: 4 * hd, winH: 8 * hd }, O);
      drawColonialWindow(ctx, turX + turW - 6 * hd, wallY + 3 * hd, style, { shutters: false, winW: 4 * hd, winH: 8 * hd }, O);
    }

    const porchStart = hasTurret && !turretRight ? turX + turW + hd : bx + 2 * hd;
    const porchEnd = hasTurret && turretRight ? turX - hd : bx + bw - 2 * hd;
    drawCoveredPorchWing(porchStart, porchEnd - porchStart, wallY, wallH, { wideWindow: true });

    drawShrub(ctx, hasTurret ? turX + 2 * hd : bx + 2 * hd, wallY + wallH - 5 * hd, 9 * hd, 7 * hd);
    drawAddressPlaque(ctx, building, midX, by + 2 * hd, bw, O);
    return { canvas, offsetX: -padSide, offsetY: -padTop };
  }

  // --- 6F. CLASSIC NEW ENGLAND COLONIAL & HOME BASE (565 BOYLSTON ST!) ---
  // Exact Sample-Style Warm Yellow Clapboard Front-Gable + Covered Cedar Porch + Roof Leaves + Picket Fence!
  return drawSampleGablePorchHouse({
    gableOnLeft: building.isHomeBase ? true : (bSeed & 1) === 0,
    hasPicketFence: Boolean(building.isHomeBase) || (bSeed % 4) === 0,
  });
}

/**
 * Bake a 32-bit 2.5D Pixel-Stacked Building (4 crisp horizontal height slices:
 * foundation/wall, eaves, mid-roof, roof-ridge + chimney) so buildings smoothly
 * extrude upward toward the player's POV from ANY rotation angle in Hard Mode!
 * 100% pure discrete pixels (zero 3D polygons), preserving every real house color!
 */
export function bake32BitHouseStack(building, tileSize = 16, colorOverrideMap = {}, biomeConfig = null) {
  const hdTile = tileSize * 2; // 32 native pixels per tile (__pixelScale = 0.5)
  const { minX, minY, maxX, maxY } = building.bounds;
  const footW = (maxX - minX + 1) * hdTile;
  const footH = (maxY - minY + 1) * hdTile;
  const style = resolveHouseStyle(building, colorOverrideMap, biomeConfig);
  const houseStyleMode = biomeConfig?.houseStyle || "new_england";
  const allowRoofLeaves = biomeConfig ? Boolean(biomeConfig.hasFallenLeaves) : true;
  const isFlatRegionalRes =
    houseStyleMode === "jerusalem_stone" ||
    houseStyleMode === "bauhaus_white" ||
    houseStyleMode === "desert_stucco";
  const kind = style.overrideKind || building.kind || "house";
  const category = getBuildingVisualCategory(building, colorOverrideMap);
  const O = "#291a18";
  const inset = 3;
  const bw = Math.max(18, footW - inset * 2);
  const bh = Math.max(18, footH - inset * 2);
  const mx = Math.floor(footW / 2);
  const my = Math.floor(footH / 2);

  const isFlatNonRes =
    isFlatRegionalRes ||
    kind === "commercial" ||
    kind === "bakery_cafe" ||
    kind === "corner_market" ||
    kind === "office_plaza" ||
    kind === "apartments" ||
    kind === "fire_station" ||
    kind === "school" ||
    kind === "civic";
  const isGlassOffice = kind === "office_plaza";
  const isGreenhouse = kind === "greenhouse";
  const isLibrary = category === "library";
  const isSchool = category === "school";
  const isBcSchool = category === "bc_school";
  const isSynagogue = category === "synagogue";
  const isChurch = category === "church" || category === "gothic_chapel";
  const isFire = kind === "fire_station";
  const isShop = kind === "commercial" || kind === "bakery_cafe" || kind === "corner_market";

  const wallColor = isGlassOffice
    ? "#9cb0c2"
    : isGreenhouse
      ? "#9de3f5"
      : isBcSchool
        ? "#c2b7a1"
        : isSynagogue
          ? "#e6d8be"
          : style.wallMain;
  const winColor = isGlassOffice || isSchool || isGreenhouse ? "#8ad2f2" : "#ffe066";
  const winHighlight = isGlassOffice || isSchool || isGreenhouse ? "#e0f7ff" : "#fff8c7";

  const makeSlice = () => {
    const res = makeCanvas(footW, footH);
    res.canvas.__pixelScale = 0.5;
    return res;
  };

  // --- Slice 1: Perimeter Wall Layer (all 4 facades with distinct non-residential window/curtain-wall bands!) ---
  const wall = makeSlice();
  {
    const c = wall.ctx;
    px(c, inset - 1, inset - 1, bw + 2, bh + 2, O);
    px(c, inset, inset, bw, bh, wallColor);
    px(c, inset, inset, bw, 3, shadeHex(wallColor, 20));
    px(c, inset, inset, 3, bh, shadeHex(wallColor, 20));
    px(c, inset, inset + bh - 3, bw, 3, shadeHex(wallColor, -24));
    px(c, inset + bw - 3, inset, 3, bh, shadeHex(wallColor, -24));
    const winStep = isGlassOffice || isSchool ? 10 : 14;
    for (let wx = inset + 5; wx <= inset + bw - 9; wx += winStep) {
      px(c, wx, inset, 7, 3, O);
      px(c, wx + 1, inset, 5, 2, winColor);
      px(c, wx + 2, inset, 3, 1, winHighlight);
      px(c, wx, inset + bh - 3, 7, 3, O);
      px(c, wx + 1, inset + bh - 2, 5, 2, winColor);
      px(c, wx + 2, inset + bh - 2, 3, 1, winHighlight);
    }
    for (let wy = inset + 5; wy <= inset + bh - 9; wy += winStep) {
      px(c, inset, wy, 3, 7, O);
      px(c, inset, wy + 1, 2, 5, winColor);
      px(c, inset + bw - 3, wy, 3, 7, O);
      px(c, inset + bw - 2, wy + 1, 2, 5, winColor);
    }
    const cornerCol = isSchool ? "#244c8a" : isBcSchool ? "#7d1d2e" : isFire ? "#d9362e" : style.trim;
    px(c, inset, inset, 3, 3, cornerCol);
    px(c, inset + bw - 3, inset, 3, 3, cornerCol);
    px(c, inset, inset + bh - 3, 3, 3, cornerCol);
    px(c, inset + bw - 3, inset + bh - 3, 3, 3, cornerCol);
  }

  // --- Slice 2: Overhanging Eaves / Commercial Awning Skirt / Institutional Stone Parapet ---
  const eaves = makeSlice();
  {
    const c = eaves.ctx;
    const ex = Math.max(1, inset - 2);
    const ey = Math.max(1, inset - 2);
    const ew = footW - ex * 2;
    const eh = footH - ey * 2;
    px(c, ex - 1, ey - 1, ew + 2, eh + 2, O);
    if (isShop) {
      // Bold striped awning border around all sides of village shops & cafés!
      const stripeA = kind === "bakery_cafe" ? "#d93d4a" : kind === "corner_market" ? "#24704a" : "#2d588f";
      px(c, ex, ey, ew, eh, "#fff5df");
      for (let sx = ex; sx < ex + ew; sx += 8) {
        px(c, sx, ey, Math.min(4, ex + ew - sx), 4, stripeA);
        px(c, sx, ey + eh - 4, Math.min(4, ex + ew - sx), 4, stripeA);
      }
      for (let sy = ey; sy < ey + eh; sy += 8) {
        px(c, ex, sy, 4, Math.min(4, ey + eh - sy), stripeA);
        px(c, ex + ew - 4, sy, 4, Math.min(4, ey + eh - sy), stripeA);
      }
      px(c, ex + 4, ey + 4, Math.max(4, ew - 8), Math.max(4, eh - 8), "#594c48");
    } else if (isGreenhouse) {
      px(c, ex, ey, ew, eh, "#ffffff");
      px(c, ex + 2, ey + 2, Math.max(4, ew - 4), Math.max(4, eh - 4), "#a8e6f7");
      for (let gx = ex + 6; gx < ex + ew - 4; gx += 8) px(c, gx, ey + 2, 2, eh - 4, "#ffffff");
    } else if (isLibrary) {
      // Oxidized verdigris teal-copper roof skirt for Libraries!
      px(c, ex, ey, ew, eh, "#f2ebe0");
      px(c, ex + 2, ey + 2, Math.max(4, ew - 4), Math.max(4, eh - 4), "#2d665c");
      px(c, ex + 3, ey + 3, Math.max(4, ew - 6), Math.max(4, eh - 6), "#4d998b");
    } else if (isFlatNonRes) {
      const trimBorder = isSchool ? "#244c8a" : isBcSchool ? "#7d1d2e" : isFire ? "#c92b24" : "#e6dfd0";
      const roofDeck = isGlassOffice ? "#657180" : isSchool ? "#545e6b" : isBcSchool ? "#414754" : "#544846";
      px(c, ex, ey, ew, eh, trimBorder);
      px(c, ex + 3, ey + 3, Math.max(4, ew - 6), Math.max(4, eh - 6), roofDeck);
    } else {
      px(c, ex, ey, ew, eh, style.trim);
      px(c, ex + 2, ey + 2, Math.max(4, ew - 4), Math.max(4, eh - 4), style.roofDark);
      px(c, ex + 3, ey + 3, Math.max(4, ew - 6), Math.max(4, eh - 6), style.roofMain);
      for (let sy = ey + 5; sy < ey + eh - 4; sy += 4) {
        px(c, ex + 3, sy, Math.max(2, ew - 6), 1, style.roofDark);
        for (let sx = ex + 4 + ((sy / 4) % 2) * 3; sx < ex + ew - 5; sx += 6) {
          px(c, sx, sy - 2, 4, 2, (sx + sy) % 3 === 0 ? style.roofLight : style.roofMain);
          px(c, sx + 4, sy - 2, 1, 2, style.roofDark);
        }
      }
    }
  }

  // --- Slice 3: Upper Roof / Flat Institutional Parapet Deck / Copper Library Roof ---
  const roof = makeSlice();
  {
    const c = roof.ctx;
    const rx = inset + (isFlatNonRes ? 1 : Math.min(8, Math.floor(bw * 0.16)));
    const ry = inset + (isFlatNonRes ? 1 : Math.min(8, Math.floor(bh * 0.16)));
    const rw = Math.max(8, footW - rx * 2);
    const rh = Math.max(8, footH - ry * 2);
    px(c, rx - 1, ry - 1, rw + 2, rh + 2, O);
    if (isGreenhouse) {
      px(c, rx, ry, rw, rh, "#c9f2fc");
      for (let gx = rx + 4; gx < rx + rw - 2; gx += 7) px(c, gx, ry, 2, rh, "#ffffff");
    } else if (isLibrary) {
      px(c, rx, ry, rw, rh, "#58a898");
      px(c, rx + 2, ry + 2, Math.max(4, rw - 4), Math.max(4, Math.floor(rh * 0.5)), "#80cfc0");
    } else if (isFlatNonRes) {
      const deckCol = isGlassOffice ? "#788594" : isSchool ? "#5d6875" : isBcSchool ? "#4a5261" : "#5e504e";
      px(c, rx, ry, rw, rh, "#e6dfd0");
      px(c, rx + 2, ry + 2, Math.max(4, rw - 4), Math.max(4, rh - 4), deckCol);
      // Rooftop mechanical units / skylights on flat commercial & office buildings
      if (rw >= 22 && rh >= 22) {
        px(c, rx + 5, ry + 5, 8, 6, O);
        px(c, rx + 6, ry + 6, 6, 4, isGlassOffice ? "#9ad9f5" : "#b8b0a6");
      }
    } else {
      px(c, rx, ry, rw, rh, style.roofMain);
      px(c, rx + 1, ry + 1, Math.max(4, rw - 2), Math.max(4, Math.floor(rh * 0.5)), style.roofLight);
      for (let sy = ry + 4; sy < ry + rh - 2; sy += 4) {
        px(c, rx + 1, sy, Math.max(2, rw - 2), 1, style.roofDark);
        for (let sx = rx + 2 + ((sy / 4) % 2) * 3; sx < rx + rw - 3; sx += 6) {
          px(c, sx, sy - 2, 4, 2, (sx + sy) % 3 === 0 ? style.roofLight : style.roofMain);
          px(c, sx + 4, sy - 2, 1, 2, style.roofDark);
        }
      }
      if (allowRoofLeaves && rw >= 26 && rh >= 20) {
        drawRoofLeafCluster(c, rx + Math.floor(rw * 0.35), ry + Math.floor(rh * 0.65), minX + minY);
      }
    }
  }

  // --- Slice 4: Rooftop Landmark Crown (School Cupola, BC Gothic Tower, Library Copper Dome,
  //              Synagogue Blue Dome, Church Steeple, Firehouse Beacon, or Residential Ridge & Chimney!) ---
  const ridge = makeSlice();
  {
    const c = ridge.ctx;
    if (isSchool || isBcSchool) {
      // Prominent raised school clock/bell cupola tower right on top of the flat school roof!
      const tw = Math.min(20, Math.max(12, Math.floor(bw * 0.34)));
      const th = Math.min(20, Math.max(12, Math.floor(bh * 0.34)));
      px(c, mx - Math.floor(tw / 2) - 1, my - Math.floor(th / 2) - 1, tw + 2, th + 2, O);
      px(c, mx - Math.floor(tw / 2), my - Math.floor(th / 2), tw, th, isBcSchool ? "#7d1d2e" : "#1c4382");
      px(c, mx - Math.floor(tw / 2) + 2, my - Math.floor(th / 2) + 2, tw - 4, th - 4, "#f4d35e");
      px(c, mx - 2, my - 2, 4, 4, "#ffffff");
    } else if (isLibrary) {
      // Oxidized copper skylight dome crown
      const dw = Math.min(20, Math.max(12, Math.floor(Math.min(bw, bh) * 0.4)));
      px(c, mx - Math.floor(dw / 2) - 1, my - Math.floor(dw / 2) - 1, dw + 2, dw + 2, O);
      px(c, mx - Math.floor(dw / 2), my - Math.floor(dw / 2), dw, dw, "#4d998b");
      px(c, mx - Math.floor(dw / 2) + 3, my - Math.floor(dw / 2) + 3, dw - 6, dw - 6, "#8ce0cf");
      px(c, mx - 2, my - 2, 4, 4, "#f4d35e");
    } else if (isSynagogue) {
      // Royal-blue & gold sanctuary dome crown
      const dw = Math.min(22, Math.max(12, Math.floor(Math.min(bw, bh) * 0.42)));
      px(c, mx - Math.floor(dw / 2) - 1, my - Math.floor(dw / 2) - 1, dw + 2, dw + 2, O);
      px(c, mx - Math.floor(dw / 2), my - Math.floor(dw / 2), dw, dw, "#2457a3");
      px(c, mx - Math.floor(dw / 2) + 3, my - Math.floor(dw / 2) + 3, dw - 6, dw - 6, "#4d8be0");
      px(c, mx - 2, my - 2, 4, 4, "#f4d35e");
    } else if (isChurch || category === "civic") {
      // Steeple / Civic cupola crown
      px(c, mx - 6, my - 6, 12, 12, O);
      px(c, mx - 5, my - 5, 10, 10, "#f5efe6");
      px(c, mx - 3, my - 3, 6, 6, "#5c6473");
      px(c, mx - 1, my - 1, 2, 2, "#f4d35e");
    } else if (isFire) {
      // Crimson firehouse hose tower & glowing siren beacon
      px(c, mx - 7, my - 7, 14, 14, O);
      px(c, mx - 6, my - 6, 12, 12, "#c92b24");
      px(c, mx - 3, my - 3, 6, 6, "#ff4d42");
      px(c, mx - 1, my - 1, 2, 2, "#fff0a6");
    } else if (isGlassOffice || isShop || kind === "apartments") {
      // Modern rooftop mechanical penthouse / skylight box
      const pw = Math.min(18, Math.max(10, Math.floor(bw * 0.32)));
      const ph = Math.min(14, Math.max(8, Math.floor(bh * 0.28)));
      px(c, mx - Math.floor(pw / 2) - 1, my - Math.floor(ph / 2) - 1, pw + 2, ph + 2, O);
      px(c, mx - Math.floor(pw / 2), my - Math.floor(ph / 2), pw, ph, isGlassOffice ? "#6bb8de" : "#c7bdb3");
      px(c, mx - Math.floor(pw / 2) + 2, my - Math.floor(ph / 2) + 2, pw - 4, ph - 4, isGlassOffice ? "#c7efff" : "#8f857e");
    } else if (isGreenhouse) {
      px(c, inset + 4, my - 2, Math.max(6, bw - 8), 4, "#ffffff");
    } else {
      const isWide = bw >= bh;
      const rx = inset + Math.min(14, Math.floor(bw * (isWide ? 0.22 : 0.36)));
      const ry = inset + Math.min(14, Math.floor(bh * (isWide ? 0.36 : 0.22)));
      const rw = Math.max(6, footW - rx * 2);
      const rh = Math.max(6, footH - ry * 2);
      px(c, rx - 1, ry - 1, rw + 2, rh + 2, O);
      px(c, rx, ry, rw, rh, style.roofLight);
      if (isWide) {
        px(c, rx + 1, my - 1, Math.max(2, rw - 2), 2, "#f2e2c4");
      } else {
        px(c, mx - 1, ry + 1, 2, Math.max(2, rh - 2), "#f2e2c4");
      }
      const chX = Math.max(rx + 2, Math.min(rx + rw - 9, Math.floor(footW * 0.68)));
      const chY = Math.max(ry + 2, Math.min(ry + rh - 9, Math.floor(footH * 0.32)));
      px(c, chX - 1, chY - 1, 9, 9, O);
      px(c, chX, chY, 7, 7, "#9c4333");
      px(c, chX + 1, chY + 1, 5, 5, "#36221e");
      px(c, chX, chY, 7, 1, "#d6c5b4");
      // Home Base golden star marker on roof so Liam can spot 565 Boylston St from any angle!
      if (building.isHomeBase) {
        px(c, mx - 5, my - 5, 10, 10, O);
        px(c, mx - 4, my - 4, 8, 8, "#24573d");
        px(c, mx - 2, my - 2, 4, 4, "#f7dc6f");
        px(c, mx - 1, my - 1, 2, 2, "#ffffff");
      }
    }
  }

  return {
    layers: [wall.canvas, eaves.canvas, roof.canvas, ridge.canvas],
    isTall:
      kind === "apartments" ||
      kind === "school" ||
      kind === "library" ||
      kind === "civic" ||
      kind === "office_plaza" ||
      kind === "fire_station",
  };
}

/**
 * Generate the full high-craft 16-bit SNES pixel-art tile, prop & hero sprite atlas.
 */
export function buildSnesSpriteAtlas(paletteName = "autumn_golden", biomeConfig = null, atlasOpts = {}) {
  const resolvedPaletteKey = biomeConfig?.paletteKey || paletteName;
  const P = PALETTES[resolvedPaletteKey] || PALETTES[paletteName] || PALETTES.autumn_golden;
  const sprites = {};

  // --- 1. Residential Lawn Grass & Wildflower Tiles (3 organic variants) ---
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.grassBase);
    if (v === 0) {
      px(ctx, 2, 3, 2, 1, P.grassLight);
      px(ctx, 3, 2, 1, 2, P.grassLight);
      px(ctx, 11, 10, 2, 1, P.grassLight);
      px(ctx, 12, 9, 1, 2, P.grassLight);
      px(ctx, 6, 13, 2, 1, P.grassMid);
      px(ctx, 13, 3, 2, 1, P.grassMid);
    } else if (v === 1) {
      px(ctx, 4, 8, 2, 1, P.grassLight);
      px(ctx, 5, 7, 1, 2, P.grassLight);
      px(ctx, 10, 3, 2, 1, P.grassMid);
      px(ctx, 1, 13, 2, 1, P.grassMid);
      px(ctx, 12, 13, 2, 1, P.grassLight);
    } else {
      // Subtle clover patch & darker shade blades
      px(ctx, 3, 11, 2, 2, P.grassMid);
      px(ctx, 4, 10, 1, 1, P.grassLight);
      px(ctx, 11, 4, 2, 1, P.grassDark);
      px(ctx, 9, 13, 2, 1, P.grassLight);
      px(ctx, 14, 9, 1, 2, P.grassMid);
    }
    sprites[`grass_${v}`] = canvas;
  }

  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.grassBase);
    px(ctx, 3 + f, 5, 1, 2, P.grassDark);
    px(ctx, 2 + f, 4, 3, 2, "#fff9ec");
    px(ctx, 3 + f, 4, 1, 1, "#f4c430");
    px(ctx, 11 - f, 11, 1, 2, P.grassDark);
    px(ctx, 10 - f, 10, 3, 2, "#ffe066");
    px(ctx, 11 - f, 10, 1, 1, "#e76f51");
    sprites[`grass_flower_${f}`] = canvas;
  }

  // --- 1b. Manicured Public Park & Athletic Field Turf (2 mowed-stripe shades + dandelions) ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const turf = v === 0 ? P.parkStripeLight : P.parkStripeDark;
    const accent = v === 0 ? P.parkHighlight : P.parkBase;
    const shade = v === 0 ? P.parkBase : P.parkShadow;
    px(ctx, 0, 0, 16, 16, turf);
    // Crisp finely manicured short turf speckles (distinct from residential yard grass)
    px(ctx, 2, 2, 2, 1, accent);
    px(ctx, 9, 5, 2, 1, accent);
    px(ctx, 5, 11, 2, 1, accent);
    px(ctx, 12, 13, 2, 1, shade);
    px(ctx, 3, 14, 2, 1, shade);
    px(ctx, 13, 3, 1, 1, shade);
    sprites[`park_${v}`] = canvas;
  }
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.parkStripeLight);
    px(ctx, 4 + f, 6, 1, 2, P.parkShadow);
    px(ctx, 3 + f, 5, 3, 1, "#ffe666");
    px(ctx, 11 - f, 11, 1, 2, P.parkShadow);
    px(ctx, 10 - f, 10, 2, 2, "#fff5cc");
    sprites[`park_flower_${f}`] = canvas;
  }

  // --- 1b-spooky. Haunted Mossy Graveyard Turf (eerie indigo-moss grass, fallen leaves & nightshade!) ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    const turf = v === 0 ? "#3f5b4f" : "#375148";
    const light = v === 0 ? "#537364" : "#49685b";
    const dark = "#2a3e38";
    px(ctx, 0, 0, 16, 16, turf);
    px(ctx, 2, 3, 2, 1, light);
    px(ctx, 10, 8, 2, 1, light);
    px(ctx, 5, 13, 2, 1, dark);
    px(ctx, 12, 3, 2, 1, dark);
    if (v === 1) {
      // Subtle fallen autumn leaf & tiny mossy stone speck
      px(ctx, 7, 5, 2, 1, "#7c5c46");
      px(ctx, 3, 11, 1, 1, "#6b7382");
    }
    sprites[`grave_grass_${v}`] = canvas;
  }
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, "#3f5b4f");
    // Glowing lavender nightshade blossom & tiny pale toadstool mushroom!
    px(ctx, 3 + f, 6, 1, 2, "#243630");
    px(ctx, 2 + f, 4, 3, 2, "#9a7be0");
    px(ctx, 3 + f, 4, 1, 1, "#d9c7ff");
    px(ctx, 11, 11, 2, 2, "#d8d4e0");
    px(ctx, 10, 10, 4, 2, "#875fa8");
    px(ctx, 11, 10, 1, 1, "#e8dcff");
    sprites[`grave_flower_${f}`] = canvas;
  }

  // --- 1c. Dirt Trails, Baseball Infields & Packed Earth (3 organic variants) ---
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.dirtBase);
    // Warm sunlit dry-dust patches & earthy ruts
    px(ctx, 1, 2, 5, 2, P.dirtLight);
    px(ctx, 9, 9, 5, 2, P.dirtLight);
    px(ctx, 2, 11, 4, 2, P.dirtMid);
    px(ctx, 10, 3, 4, 2, P.dirtMid);
    px(ctx, 6, 6, 3, 1, P.dirtDark);
    if (v === 1) {
      px(ctx, 4, 4, 2, 1, P.dirtDark);
      px(ctx, 12, 13, 3, 1, P.dirtDark);
      px(ctx, 7, 12, 2, 1, P.dirtLight);
    } else if (v === 2) {
      // Crisp tiny trail pebbles with 1px shadow!
      px(ctx, 4, 5, 2, 2, P.dirtDark);
      px(ctx, 4, 5, 2, 1, P.dirtPebble);
      px(ctx, 11, 11, 2, 2, P.dirtDark);
      px(ctx, 11, 11, 1, 1, P.dirtPebble);
      px(ctx, 12, 4, 1, 1, P.dirtPebble);
    }
    sprites[v === 2 ? "dirt_pebble" : `dirt_${v}`] = canvas;
  }

  // --- 1d. Sunlit Beach Sand & Playground Sand (3 organic variants) ---
  for (let v = 0; v < 3; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.sandBase);
    // Soft wind-blown sand ripples
    px(ctx, 1, 3, 6, 1, P.sandLight);
    px(ctx, 2, 4, 5, 1, P.sandMid);
    px(ctx, 8, 10, 6, 1, P.sandLight);
    px(ctx, 9, 11, 5, 1, P.sandMid);
    if (v === 0) {
      px(ctx, 12, 3, 2, 1, P.sandSparkle);
      px(ctx, 4, 13, 2, 1, P.sandLight);
    } else if (v === 1) {
      px(ctx, 3, 8, 4, 1, P.sandLight);
      px(ctx, 4, 9, 3, 1, P.sandMid);
      px(ctx, 13, 14, 1, 1, P.sandSparkle);
    } else {
      // Tiny sunlit seashell & pebble glints!
      px(ctx, 5, 6, 2, 2, P.sandWet);
      px(ctx, 5, 6, 2, 1, "#fff3e6");
      px(ctx, 11, 5, 1, 1, P.sandSparkle);
      px(ctx, 10, 13, 2, 1, "#e6b89c");
    }
    sprites[v === 2 ? "sand_shell" : `sand_${v}`] = canvas;
  }

  // --- 2. Tall Grass (2 swaying frames) ---
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.tallGrassBase);
    const shift = f === 0 ? 0 : 1;
    const clusters = [
      [2, 5],
      [8, 4],
      [13, 6],
      [4, 12],
      [10, 11],
    ];
    for (const [bx, by] of clusters) {
      px(ctx, bx, by + 1, 3, 2, P.grassDark);
      px(ctx, bx + shift, by - 2, 1, 4, P.tallGrassMid);
      px(ctx, bx + 1 + shift, by - 3, 1, 5, P.tallGrassTip);
      px(ctx, bx + 2, by - 1, 1, 3, P.tallGrassMid);
    }
    sprites[`tall_grass_${f}`] = canvas;
  }

  // --- 3. Cobblestone / Concrete Sidewalk Base (2 subtle variants) ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.sidewalkBase);
    px(ctx, 1, 1, 6, 1, P.sidewalkLight);
    px(ctx, 9, 1, 6, 1, P.sidewalkLight);
    px(ctx, 1, 9, 6, 1, P.sidewalkLight);
    px(ctx, 9, 9, 6, 1, P.sidewalkLight);
    px(ctx, 1, 6, 6, 1, P.sidewalkMid);
    px(ctx, 9, 14, 6, 1, P.sidewalkMid);
    px(ctx, 0, 7, 16, 1, P.sidewalkMortar);
    px(ctx, 0, 15, 16, 1, P.sidewalkMortar);
    px(ctx, 7, 0, 1, 8, P.sidewalkMortar);
    px(ctx, 15, 0, 1, 8, P.sidewalkMortar);
    px(ctx, v === 0 ? 3 : 11, 8, 1, 7, P.sidewalkMortar);
    px(ctx, v === 0 ? 11 : 3, 8, 1, 7, P.sidewalkMortar);
    if (v === 1) {
      px(ctx, 4, 4, 2, 1, P.sidewalkMortar);
      px(ctx, 12, 12, 1, 1, P.sidewalkCurbFace);
    }
    sprites[`sidewalk_${v}`] = canvas;
  }

  // --- 4. Distinct Road Surfaces: Neighborhood Street vs Town Avenue vs Major Highway ---
  // Neighborhood Street (lighter weathered gray asphalt with fine aggregate)
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.roadRes);
    px(ctx, 2, 3, 2, 1, P.roadResDark);
    px(ctx, 10, 11, 2, 1, P.roadResDark);
    px(ctx, 12, 4, 1, 1, P.roadResLight);
    px(ctx, 4, 13, 1, 1, P.roadResLight);
    if (v === 1) {
      // Subtle neighborhood street hairline seam
      px(ctx, 6, 7, 3, 1, P.roadResDark);
      px(ctx, 8, 8, 2, 1, P.roadResDark);
    }
    sprites[`road_res_base_${v}`] = canvas;
  }
  sprites.road_res_base = sprites.road_res_base_0;

  // Town Avenue / Main Road (darker slate asphalt)
  {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.roadMain);
    px(ctx, 2, 3, 2, 1, P.roadMainDark);
    px(ctx, 11, 12, 2, 1, P.roadMainDark);
    px(ctx, 13, 4, 1, 1, "#555d6e");
    px(ctx, 5, 13, 1, 1, "#555d6e");
    sprites.road_main_base = canvas;
  }

  // Major State Highway (deep charcoal heavy asphalt with subtle tire-track sheen!)
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.highwayBase);
    // Subtle dual tire-wear sheen bands
    px(ctx, 0, 4, 16, 2, P.highwayTrack);
    px(ctx, 0, 10, 16, 2, P.highwayTrack);
    px(ctx, v === 0 ? 3 : 9, 2, 2, 1, P.highwayDark);
    px(ctx, v === 0 ? 11 : 4, 13, 2, 1, P.highwayDark);
    px(ctx, 7, 7, 1, 1, "#454d5c");
    sprites[`highway_base_${v}`] = canvas;
  }

  // Divided Highway Concrete Jersey Median Barrier (E-W horizontal & N-S vertical!)
  {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.highwayBase);
    // Crisp double yellow lines flanking both sides of the median barrier
    px(ctx, 0, 1, 16, 1, P.highwayYellow);
    px(ctx, 0, 14, 16, 1, P.highwayYellow);
    // Cast barrier shadow onto lower asphalt
    px(ctx, 0, 12, 16, 2, P.highwayDark);
    // 3D Concrete Jersey Barrier with dark pixel outline, sunlit top cap & sloped concrete face!
    px(ctx, 0, 3, 16, 9, P.outline);
    px(ctx, 0, 4, 16, 2, "#e4e8ee"); // sunlit top cap
    px(ctx, 0, 6, 16, 3, "#b7c0cc"); // upper sloped face
    px(ctx, 0, 9, 16, 2, "#7f8896"); // lower shaded base
    // Concrete block expansion seam + bright amber highway reflector!
    px(ctx, 0, 4, 1, 7, "#646d7a");
    px(ctx, 7, 4, 3, 2, P.outline);
    px(ctx, 8, 4, 1, 2, "#ffd54f");
    sprites.highway_median_h = canvas;
  }
  {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.highwayBase);
    // Crisp vertical double yellow lines flanking both sides
    px(ctx, 1, 0, 1, 16, P.highwayYellow);
    px(ctx, 14, 0, 1, 16, P.highwayYellow);
    px(ctx, 12, 0, 2, 16, P.highwayDark);
    // 3D Vertical Concrete Jersey Barrier
    px(ctx, 3, 0, 9, 16, P.outline);
    px(ctx, 4, 0, 2, 16, "#e4e8ee");
    px(ctx, 6, 0, 3, 16, "#b7c0cc");
    px(ctx, 9, 0, 2, 16, "#7f8896");
    px(ctx, 4, 0, 7, 1, "#646d7a");
    px(ctx, 4, 7, 2, 3, P.outline);
    px(ctx, 4, 8, 2, 1, "#ffd54f");
    sprites.highway_median_v = canvas;
  }

  // --- 5. Direction-Aware Zebra Crosswalks (Horizontal & Vertical!) ---
  {
    // Horizontal zebra stripes (for crossing E-W across a N-S street)
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.roadMain);
    for (let y = 1; y <= 13; y += 4) {
      px(ctx, 1, y, 14, 2, P.crosswalkWhite);
      px(ctx, 1, y + 2, 14, 1, P.crosswalkEdge);
    }
    sprites.crosswalk_h = canvas;
  }
  {
    // Vertical zebra stripes (for crossing N-S across an E-W street like Boylston St!)
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.roadMain);
    for (let x = 1; x <= 13; x += 4) {
      px(ctx, x, 1, 2, 14, P.crosswalkWhite);
      px(ctx, x + 2, 1, 1, 14, P.crosswalkEdge);
    }
    sprites.crosswalk_v = canvas;
  }

  // --- 5b. Parking Lot Asphalt + Painted Stall Lines & Parked 16-Bit Retro Cars ---
  for (let v = 0; v < 2; v++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, "#555c68");
    px(ctx, 3, 4, 2, 1, "#494f5a");
    px(ctx, 11, 11, 2, 1, "#626a78");
    if (v === 0) {
      // Crisp painted stall stripe + concrete wheel stop
      px(ctx, 0, 1, 1, 13, "#dce3ec");
      px(ctx, 3, 2, 10, 2, "#cfc9ba");
      px(ctx, 3, 3, 10, 1, "#8f897c");
    } else {
      // Clean drive aisle pavement
      px(ctx, 6, 7, 4, 1, "#687080");
    }
    sprites[`parking_${v}`] = canvas;
  }

  // Cute top-down 16-bit SNES parked cars (matching style_1_snes_16bit retro sedans!)
  const carColors = [
    { name: "car_red", body: "#c94c3e", light: "#e67060", dark: "#8c2c23" },
    { name: "car_sage", body: "#6f8c73", light: "#92b096", dark: "#4b634e" },
    { name: "car_blue", body: "#4c72a8", light: "#7399cc", dark: "#314d75" },
  ];
  for (const car of carColors) {
    const { canvas, ctx } = makeCanvas(14, 18);
    // Shadow
    px(ctx, 2, 2, 11, 16, "rgba(18, 22, 26, 0.4)");
    // Outline
    px(ctx, 1, 1, 12, 16, P.outline);
    // Body
    px(ctx, 2, 2, 10, 14, car.body);
    px(ctx, 2, 2, 10, 3, car.light); // Hood highlight
    px(ctx, 2, 13, 10, 3, car.dark); // Rear shade
    // Windshield & rear glass
    px(ctx, 3, 5, 8, 3, "#2a3b4f");
    px(ctx, 4, 5, 5, 1, "#8cc4e8");
    px(ctx, 3, 11, 8, 2, "#2a3b4f");
    // Roof panel
    px(ctx, 3, 8, 8, 3, car.light);
    // Headlights & taillights
    px(ctx, 3, 2, 2, 1, "#fff2a6");
    px(ctx, 9, 2, 2, 1, "#fff2a6");
    px(ctx, 3, 15, 2, 1, "#eb4d42");
    px(ctx, 9, 15, 2, 1, "#eb4d42");
    sprites[car.name] = canvas;
  }

  // --- 6. Multi-Depth Shimmering Water (Deep Sapphire & Shallow Turquoise Shore!) ---
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.waterMid);
    px(ctx, 0, 11, 16, 5, P.waterDeep);
    px(ctx, 0, 0, 16, 2, P.waterDeep);
    const sx = f === 0 ? 2 : 6;
    px(ctx, sx, 4, 5, 1, P.waterLight);
    px(ctx, sx + 1, 4, 3, 1, P.waterShimmer);
    px(ctx, (sx + 7) % 12, 10, 4, 1, P.waterLight);
    px(ctx, (sx + 8) % 12, 10, 2, 1, P.waterShimmer);
    sprites[`water_deep_${f}`] = canvas;
    sprites[`water_${f}`] = canvas;
  }
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 0, 0, 16, 16, P.waterShallow);
    px(ctx, 0, 12, 16, 4, P.waterMid);
    const sx = f === 0 ? 1 : 5;
    px(ctx, sx, 3, 6, 1, P.waterShallowLight);
    px(ctx, sx + 2, 3, 2, 1, P.waterShimmer);
    px(ctx, (sx + 6) % 11, 9, 5, 1, P.waterShallowLight);
    px(ctx, (sx + 8) % 11, 9, 2, 1, P.waterShimmer);
    sprites[`water_shallow_${f}`] = canvas;
  }

  // --- 7. Lush 24x28 16-Bit SNES Oak Tree + New England Evergreen Pine + Park Bench + Shore Reeds ---
  {
    const { canvas, ctx } = makeCanvas(24, 28);
    // Oval ground shadow
    px(ctx, 4, 23, 16, 4, "rgba(16, 30, 18, 0.38)");
    px(ctx, 6, 22, 12, 5, "rgba(16, 30, 18, 0.25)");
    // Gnarled shaded trunk + root flare with dark outline
    px(ctx, 8, 17, 8, 8, P.treeOutline);
    px(ctx, 7, 22, 10, 3, P.treeOutline);
    px(ctx, 9, 17, 6, 7, P.treeTrunk);
    px(ctx, 10, 18, 2, 6, P.treeTrunkLight);
    px(ctx, 13, 17, 2, 7, P.treeTrunkDark);
    px(ctx, 8, 23, 8, 1, P.treeTrunkDark);

    // Outer canopy dark pixel outline
    px(ctx, 4, 3, 16, 15, P.treeOutline);
    px(ctx, 2, 6, 20, 11, P.treeOutline);
    px(ctx, 1, 9, 22, 7, P.treeOutline);
    px(ctx, 6, 1, 12, 18, P.treeOutline);

    // Deep canopy shadow layer
    px(ctx, 3, 7, 18, 10, P.treeDark);
    px(ctx, 2, 10, 20, 6, P.treeDark);
    px(ctx, 5, 4, 14, 14, P.treeDark);

    // Mid green foliage puffs
    px(ctx, 3, 7, 17, 8, P.treeMid);
    px(ctx, 5, 3, 14, 11, P.treeMid);
    px(ctx, 7, 2, 10, 11, P.treeMid);

    // Sunlit leaf crown clusters
    px(ctx, 4, 6, 6, 5, P.treeLight);
    px(ctx, 10, 4, 8, 6, P.treeLight);
    px(ctx, 7, 2, 8, 5, P.treeLight);
    px(ctx, 14, 8, 5, 4, P.treeLight);
    px(ctx, 8, 9, 6, 4, P.treeLight);

    // Crisp sunlit top highlights
    px(ctx, 8, 3, 4, 2, P.treeHighlight);
    px(ctx, 13, 5, 3, 2, P.treeHighlight);
    px(ctx, 5, 7, 3, 2, P.treeHighlight);
    px(ctx, 10, 9, 2, 2, P.treeHighlight);
    sprites.tree_oak = canvas;
  }

  // New England Evergreen Pine Tree (22x30) for woods & parks
  {
    const { canvas, ctx } = makeCanvas(22, 30);
    px(ctx, 5, 25, 12, 4, "rgba(16, 30, 18, 0.36)");
    px(ctx, 8, 20, 6, 7, P.treeOutline);
    px(ctx, 9, 21, 4, 5, P.treeTrunk);
    px(ctx, 10, 21, 1, 5, P.treeTrunkLight);

    // 3 layered jagged evergreen bough tiers
    const tiers = [
      { y: 14, halfW: 9, h: 8 },
      { y: 8, halfW: 7, h: 8 },
      { y: 2, halfW: 5, h: 8 },
    ];
    for (const tier of tiers) {
      for (let r = 0; r < tier.h; r++) {
        const span = Math.max(1, Math.round(((r + 1) / tier.h) * tier.halfW));
        const ry = tier.y + r;
        px(ctx, 11 - span - 1, ry, span * 2 + 2, 1, P.treeOutline);
        px(ctx, 11 - span, ry, span * 2, 1, r >= tier.h - 2 ? P.pineDark : P.pineMid);
        if (r < tier.h - 2) {
          px(ctx, 11 - span, ry, Math.max(1, Math.floor(span * 1.1)), 1, P.pineLight);
        }
        if (r === 1 || r === 2) {
          px(ctx, 11 - Math.max(1, span - 1), ry, Math.max(1, Math.floor(span * 0.6)), 1, P.pineHighlight);
        }
      }
    }
    px(ctx, 10, 1, 2, 1, P.treeOutline);
    sprites.tree_pine = canvas;
  }

  // Park Bench (16x12 wooden slats & dark-iron legs)
  {
    const { canvas, ctx } = makeCanvas(16, 12);
    px(ctx, 2, 9, 12, 2, "rgba(16, 26, 18, 0.35)");
    px(ctx, 1, 2, 14, 7, P.outline);
    px(ctx, 2, 3, 12, 2, "#b57c46");
    px(ctx, 2, 3, 12, 1, "#d99e62");
    px(ctx, 2, 6, 12, 2, "#9c6638");
    px(ctx, 2, 6, 12, 1, "#c4884d");
    // Iron armrests & legs
    px(ctx, 2, 3, 1, 7, "#2a3038");
    px(ctx, 13, 3, 1, 7, "#2a3038");
    sprites.park_bench = canvas;
  }

  // Lakeside Cattail Reeds (12x16) for natural water/sand shores
  {
    const { canvas, ctx } = makeCanvas(12, 16);
    px(ctx, 2, 12, 8, 2, "rgba(16, 30, 18, 0.25)");
    px(ctx, 3, 6, 1, 8, "#2a6934");
    px(ctx, 5, 4, 1, 10, "#3f8c3e");
    px(ctx, 8, 5, 1, 9, "#2a6934");
    px(ctx, 6, 7, 1, 7, "#6bb84d");
    // Brown cattail heads!
    px(ctx, 4, 3, 3, 4, P.outline);
    px(ctx, 5, 4, 1, 2, "#7a4626");
    px(ctx, 7, 4, 3, 4, P.outline);
    px(ctx, 8, 5, 1, 2, "#7a4626");
    sprites.shore_reed = canvas;
  }

  // --- 7b. 16-Bit SNES Park Athletic Props (Basketball Hoops, Soccer Goals, Baseball Backstop, Swings & Slide!) ---
  // Left-facing & right-facing Basketball Hoops (for full courts) + top hoop (for half-courts)
  for (const side of ["left", "right"]) {
    const { canvas, ctx } = makeCanvas(16, 26);
    const isLeft = side === "left";
    const poleX = isLeft ? 2 : 12;
    const armX = isLeft ? 4 : 5;
    const boardX = isLeft ? 7 : 6;
    const rimX = isLeft ? 10 : 2;
    // Ground shadow
    px(ctx, poleX - 1, 23, 5, 2, "rgba(16, 24, 28, 0.42)");
    // Steel post
    px(ctx, poleX - 1, 4, 4, 20, P.outline);
    px(ctx, poleX, 5, 2, 18, "#8e99a8");
    px(ctx, poleX, 5, 1, 18, "#ced6e0");
    // Overhang support arm
    px(ctx, armX, 5, 5, 2, P.outline);
    px(ctx, armX, 6, 5, 1, "#aeb8c7");
    // Crisp white backboard with red target square
    px(ctx, boardX - 1, 1, 4, 11, P.outline);
    px(ctx, boardX, 2, 2, 9, "#f5f7fa");
    px(ctx, boardX, 5, 2, 3, "#d93b36");
    // Bright orange rim + crisp white pixel net!
    px(ctx, rimX, 8, 4, 2, P.outline);
    px(ctx, rimX, 8, 4, 1, "#f26b26");
    px(ctx, rimX, 10, 1, 3, "#f2f5f7");
    px(ctx, rimX + 2, 10, 1, 3, "#f2f5f7");
    px(ctx, rimX + 1, 11, 1, 3, "#d4dde6");
    sprites[`hoop_${side}`] = canvas;
  }
  {
    // Front-facing half-court Basketball Hoop (north baseline)
    const { canvas, ctx } = makeCanvas(22, 26);
    px(ctx, 8, 22, 6, 2, "rgba(16, 24, 28, 0.42)");
    // Center steel post
    px(ctx, 9, 10, 4, 13, P.outline);
    px(ctx, 10, 11, 2, 11, "#9aa5b5");
    // Wide glass/white backboard
    px(ctx, 2, 1, 18, 12, P.outline);
    px(ctx, 3, 2, 16, 10, "#f5f7fa");
    px(ctx, 4, 3, 14, 8, "#e3eef5");
    // Red shooter's square
    px(ctx, 8, 6, 6, 5, "#d93b36");
    px(ctx, 9, 7, 4, 3, "#f5f7fa");
    // Orange rim + white net hanging cleanly in front!
    px(ctx, 8, 11, 6, 2, P.outline);
    px(ctx, 8, 11, 6, 1, "#f26b26");
    px(ctx, 9, 13, 4, 3, "#f5f7fa");
    px(ctx, 10, 13, 1, 3, "#c4cfd9");
    px(ctx, 12, 13, 1, 2, "#c4cfd9");
    sprites.hoop_top = canvas;
  }

  // Left & Right White Mesh Soccer Goals (16x28)
  for (const side of ["left", "right"]) {
    const { canvas, ctx } = makeCanvas(16, 28);
    const isLeft = side === "left";
    const frontX = isLeft ? 12 : 2;
    const backX = isLeft ? 2 : 12;
    const netStartX = Math.min(frontX, backX) + 1;
    const netW = Math.abs(frontX - backX) - 1;
    // Soft ground shadow
    px(ctx, netStartX, 24, netW + 2, 3, "rgba(16, 30, 18, 0.3)");
    // Semi-transparent checkered pixel net
    for (let ny = 4; ny < 24; ny += 2) {
      for (let nx = netStartX; nx < netStartX + netW; nx += 2) {
        const shift = ((ny / 2) % 2) === 0 ? 0 : 1;
        px(ctx, nx + shift, ny, 1, 1, "rgba(244, 248, 252, 0.72)");
      }
    }
    // Back frame support bars
    px(ctx, backX, 4, 2, 21, "#9aa4b0");
    px(ctx, netStartX, 3, netW, 2, "#dce3eb");
    px(ctx, netStartX, 23, netW, 2, "#aeb7c2");
    // Bold outlined front white goalposts & crossbar
    px(ctx, frontX - 1, 1, 4, 25, P.outline);
    px(ctx, frontX, 2, 2, 23, "#ffffff");
    sprites[`soccer_goal_${side}`] = canvas;
  }

  // Regional Park Props: Tennis Net, Beach Volleyball Net, and Winter Ice Hockey Goals!
  {
    const { canvas, ctx } = makeCanvas(14, 34);
    px(ctx, 5, 2, 4, 30, "rgba(18, 28, 36, 0.25)");
    px(ctx, 5, 1, 4, 3, P.outline);
    px(ctx, 6, 2, 2, 1, "#2f7d4c");
    px(ctx, 5, 30, 4, 3, P.outline);
    px(ctx, 6, 31, 2, 1, "#2f7d4c");
    for (let ny = 4; ny < 30; ny += 2) {
      px(ctx, 6, ny, 2, 1, "rgba(245, 248, 252, 0.8)");
    }
    px(ctx, 6, 3, 2, 28, "#ffffff");
    sprites.tennis_net = canvas;
  }
  {
    const { canvas, ctx } = makeCanvas(16, 36);
    px(ctx, 6, 2, 4, 32, "rgba(42, 30, 14, 0.22)");
    px(ctx, 5, 1, 4, 34, P.outline);
    px(ctx, 6, 2, 2, 32, "#e8edf5");
    px(ctx, 6, 2, 2, 4, "#245ca8");
    px(ctx, 6, 30, 2, 4, "#245ca8");
    for (let ny = 6; ny < 30; ny += 2) {
      px(ctx, 8, ny, 3, 1, "rgba(255, 255, 255, 0.78)");
    }
    sprites.volleyball_net = canvas;
  }
  for (const side of ["left", "right"]) {
    const { canvas, ctx } = makeCanvas(14, 22);
    const isLeft = side === "left";
    const frontX = isLeft ? 10 : 2;
    const backX = isLeft ? 2 : 10;
    const netX = Math.min(frontX, backX) + 1;
    const netW = Math.abs(frontX - backX) - 1;
    for (let ny = 4; ny < 18; ny += 2) {
      for (let nx = netX; nx < netX + netW; nx += 2) {
        px(ctx, nx, ny, 1, 1, "rgba(242, 248, 255, 0.8)");
      }
    }
    px(ctx, backX, 4, 2, 14, "#b8c7d9");
    px(ctx, frontX - 1, 2, 4, 18, P.outline);
    px(ctx, frontX, 3, 2, 16, "#d9362e");
    sprites[`hockey_goal_${side}`] = canvas;
  }

  // Baseball Chain-Link Backstop behind Home Plate (40x18)
  {
    const { canvas, ctx } = makeCanvas(40, 18);
    // Steel posts & arched top rail
    px(ctx, 2, 4, 2, 13, P.outline);
    px(ctx, 36, 4, 2, 13, P.outline);
    px(ctx, 11, 2, 2, 14, P.outline);
    px(ctx, 27, 2, 2, 14, P.outline);
    px(ctx, 3, 2, 34, 2, P.outline);
    px(ctx, 4, 3, 32, 1, "#c8d0db");
    px(ctx, 3, 5, 1, 11, "#adb6c4");
    px(ctx, 37, 5, 1, 11, "#adb6c4");
    px(ctx, 12, 3, 1, 12, "#adb6c4");
    px(ctx, 28, 3, 1, 12, "#adb6c4");
    // Fine diamond chain-link fence texture
    for (let fy = 5; fy < 15; fy += 2) {
      for (let fx = 5; fx < 35; fx += 2) {
        const off = ((fy / 2) % 2) === 0 ? 0 : 1;
        px(ctx, fx + off, fy, 1, 1, "rgba(222, 230, 240, 0.65)");
      }
    }
    // Ground base rail
    px(ctx, 2, 15, 36, 2, "rgba(24, 32, 26, 0.45)");
    sprites.baseball_backstop = canvas;
  }

  // Playground A-Frame Swing Set (28x22)
  {
    const { canvas, ctx } = makeCanvas(28, 22);
    px(ctx, 2, 18, 24, 3, "rgba(18, 28, 20, 0.32)");
    // Top steel crossbar (vibrant park red!)
    px(ctx, 4, 2, 20, 3, P.outline);
    px(ctx, 5, 3, 18, 1, "#e0483e");
    // Left & right A-frame legs
    for (let i = 0; i < 15; i++) {
      const lx = Math.round(5 - i * 0.22);
      const rx = Math.round(22 + i * 0.22);
      px(ctx, lx, 4 + i, 2, 1, P.outline);
      px(ctx, lx, 4 + i, 1, 1, "#3b78b8");
      px(ctx, rx, 4 + i, 2, 1, P.outline);
      px(ctx, rx + 1, 4 + i, 1, 1, "#3b78b8");
    }
    // Two hanging swings with chains & yellow seats!
    for (const sx of [9, 16]) {
      px(ctx, sx, 5, 1, 10, "#cfd6e0");
      px(ctx, sx + 3, 5, 1, 10, "#cfd6e0");
      px(ctx, sx - 1, 14, 6, 3, P.outline);
      px(ctx, sx, 15, 4, 1, "#f4d35e");
    }
    sprites.swing_set = canvas;
  }

  // Cheerful Park Slide (20x20)
  {
    const { canvas, ctx } = makeCanvas(20, 20);
    px(ctx, 2, 17, 16, 2, "rgba(18, 28, 20, 0.32)");
    // Ladder posts on left
    px(ctx, 3, 4, 2, 14, P.outline);
    px(ctx, 6, 4, 2, 14, P.outline);
    px(ctx, 4, 5, 1, 12, "#4c80bf");
    px(ctx, 7, 5, 1, 12, "#4c80bf");
    for (let ry = 7; ry <= 15; ry += 3) px(ctx, 4, ry, 3, 1, "#dce4ee");
    // Top platform
    px(ctx, 3, 3, 6, 3, P.outline);
    px(ctx, 4, 4, 4, 1, "#e0483e");
    // Yellow curving slide chute descending to the right
    for (let i = 0; i < 11; i++) {
      const sx = 8 + i;
      const sy = 5 + Math.round(i * 1.1);
      px(ctx, sx, sy - 1, 3, 4, P.outline);
      px(ctx, sx, sy, 3, 2, "#f4cf4e");
      px(ctx, sx, sy, 2, 1, "#fff0a6");
    }
    sprites.park_slide = canvas;
  }

  // --- 7c. Landmark Wooden Signpost & Classic Green Street-Corner Road Sign (Wayfinding!) ---
  {
    // 14x18 SNES Wooden Landmark Signpost with Gold Star Emblem
    const { canvas, ctx } = makeCanvas(14, 18);
    px(ctx, 3, 15, 8, 2, "rgba(16, 26, 18, 0.38)");
    // Post
    px(ctx, 5, 9, 4, 8, P.outline);
    px(ctx, 6, 10, 2, 6, "#8c5730");
    px(ctx, 6, 10, 1, 6, "#b87a46");
    // Framed wooden plaque with gold border
    px(ctx, 0, 1, 14, 10, P.outline);
    px(ctx, 1, 2, 12, 8, "#e6b84c");
    px(ctx, 2, 3, 10, 6, "#24573d");
    // Crisp golden star icon inside sign
    px(ctx, 6, 4, 2, 4, "#fff0a6");
    px(ctx, 5, 5, 4, 2, "#f4d35e");
    sprites.landmark_sign = canvas;
  }
  {
    // 12x18 Classic Massachusetts Green Street-Corner Signpost (Unchecked)
    const { canvas, ctx } = makeCanvas(12, 18);
    px(ctx, 4, 15, 4, 2, "rgba(16, 26, 18, 0.36)");
    px(ctx, 5, 4, 2, 13, P.outline);
    px(ctx, 5, 5, 1, 11, "#cfd6e0");
    // Two crossed green street blades with white lettering pixels
    px(ctx, 0, 1, 12, 4, P.outline);
    px(ctx, 1, 2, 10, 2, "#1f7a4c");
    px(ctx, 2, 2, 7, 1, "#f2f7f4");
    px(ctx, 2, 5, 9, 4, P.outline);
    px(ctx, 3, 6, 7, 2, "#19633d");
    px(ctx, 4, 6, 5, 1, "#f2f7f4");
    sprites.street_sign = canvas;
  }
  {
    // 12x18 Checked Street-Corner Signpost with crisp gold explorer cap & bright trim!
    const { canvas, ctx } = makeCanvas(12, 18);
    px(ctx, 4, 15, 4, 2, "rgba(16, 26, 18, 0.36)");
    px(ctx, 5, 4, 2, 13, P.outline);
    px(ctx, 5, 5, 1, 11, "#dfe7ef");
    // Golden top finial cap indicating this intersection is logged in your map!
    px(ctx, 4, 0, 4, 2, P.outline);
    px(ctx, 5, 0, 2, 1, "#ffe875");
    // Two crossed green street blades with subtle gold border accent
    px(ctx, 0, 2, 12, 4, P.outline);
    px(ctx, 1, 3, 10, 2, "#248f59");
    px(ctx, 2, 3, 7, 1, "#ffffff");
    px(ctx, 2, 6, 9, 4, P.outline);
    px(ctx, 3, 7, 7, 2, "#1d7548");
    px(ctx, 4, 7, 5, 1, "#fff3b0");
    sprites.street_sign_checked = canvas;
  }
  {
    // 11x11 Bobbing green-and-gold interactive signpost indicator bubble ("?" / blade icon)
    const { canvas, ctx } = makeCanvas(11, 11);
    px(ctx, 1, 0, 9, 8, P.outline);
    px(ctx, 0, 1, 11, 6, P.outline);
    px(ctx, 4, 8, 3, 2, P.outline);
    px(ctx, 5, 9, 1, 2, P.outline);
    px(ctx, 1, 1, 9, 6, "#e6b84c");
    px(ctx, 2, 2, 7, 4, "#1e6e44");
    // Crisp white '?' / signpost glyph
    px(ctx, 4, 2, 3, 1, "#ffffff");
    px(ctx, 6, 3, 1, 1, "#ffffff");
    px(ctx, 5, 4, 1, 1, "#ffffff");
    px(ctx, 5, 6, 1, 1, "#fff6c4");
    sprites.street_sign_prompt = canvas;
  }

  // --- 7d. 16-Bit SNES Spooky Graveyard Props (Tombstones, Crypts, Gnarled Trees, Pumpkins, Ghosts & Bats!) ---
  // 1) Classic Rounded Weathered Granite Tombstone (12x16)
  {
    const { canvas, ctx } = makeCanvas(12, 16);
    px(ctx, 1, 13, 10, 3, "rgba(14, 18, 26, 0.45)");
    // Base pedestal
    px(ctx, 1, 11, 10, 4, P.outline);
    px(ctx, 2, 12, 8, 2, "#757c8a");
    // Rounded arch stone body
    px(ctx, 2, 3, 8, 9, P.outline);
    px(ctx, 3, 2, 6, 2, P.outline);
    px(ctx, 3, 3, 6, 9, "#9aa3b2");
    px(ctx, 3, 3, 2, 8, "#bcc4d1"); // sunlit edge
    px(ctx, 8, 4, 1, 8, "#6c7382"); // shadow edge
    // Carved "RIP" engraving lines + creeping green moss
    px(ctx, 4, 5, 4, 1, "#4a515e");
    px(ctx, 4, 7, 3, 1, "#4a515e");
    px(ctx, 3, 10, 2, 2, "#467554");
    px(ctx, 7, 3, 2, 1, "#467554");
    sprites.tombstone_arch = canvas;
  }
  // 2) Tall Mossy Celtic Cross Tombstone (12x18)
  {
    const { canvas, ctx } = makeCanvas(12, 18);
    px(ctx, 1, 15, 10, 3, "rgba(14, 18, 26, 0.45)");
    px(ctx, 2, 13, 8, 4, P.outline);
    px(ctx, 3, 14, 6, 2, "#6f7785");
    // Cross vertical shaft + horizontal arms
    px(ctx, 4, 1, 4, 13, P.outline);
    px(ctx, 1, 4, 10, 4, P.outline);
    px(ctx, 5, 2, 2, 12, "#9aa3b2");
    px(ctx, 2, 5, 8, 2, "#9aa3b2");
    px(ctx, 5, 2, 1, 11, "#c4ccd9");
    px(ctx, 2, 5, 7, 1, "#c4ccd9");
    // Celtic center ring + moss
    px(ctx, 5, 5, 2, 2, "#59606e");
    px(ctx, 4, 11, 2, 2, "#3f6e4f");
    sprites.tombstone_cross = canvas;
  }
  // 3) Tilted 1660 Colonial Dark-Slate Headstone (12x16)
  {
    const { canvas, ctx } = makeCanvas(12, 16);
    px(ctx, 1, 13, 10, 3, "rgba(14, 18, 26, 0.45)");
    // Slight lean to the right!
    for (let r = 0; r < 10; r++) {
      const shift = Math.floor(r / 4);
      px(ctx, 2 + shift, 3 + r, 7, 1, P.outline);
      px(ctx, 3 + shift, 3 + r, 5, 1, r < 2 ? "#7a8294" : "#5c6475");
    }
    px(ctx, 3, 2, 5, 2, P.outline);
    px(ctx, 4, 3, 3, 1, "#8d96a8");
    // Tiny colonial winged skull carving + crack
    px(ctx, 5, 5, 2, 2, "#c2cad9");
    px(ctx, 4, 6, 1, 1, "#9aa3b5");
    px(ctx, 7, 6, 1, 1, "#9aa3b5");
    px(ctx, 6, 9, 2, 1, "#2a2e38");
    px(ctx, 2, 12, 9, 3, P.outline);
    px(ctx, 3, 13, 7, 1, "#4f5666");
    sprites.tombstone_tilted = canvas;
  }
  // 4) Tall Ancient Granite Obelisk Monument (14x30)
  {
    const { canvas, ctx } = makeCanvas(14, 30);
    px(ctx, 1, 26, 12, 4, "rgba(14, 18, 26, 0.48)");
    // Stepped stone plinth
    px(ctx, 1, 22, 12, 6, P.outline);
    px(ctx, 2, 23, 10, 4, "#808896");
    px(ctx, 2, 23, 10, 1, "#aeb6c4");
    px(ctx, 3, 19, 8, 4, P.outline);
    px(ctx, 4, 20, 6, 3, "#969fae");
    // Tapered obelisk spire
    for (let y = 3; y < 20; y++) {
      const half = y < 6 ? Math.max(1, Math.floor((y - 2) * 0.8)) : 2;
      px(ctx, 7 - half - 1, y, half * 2 + 2, 1, P.outline);
      px(ctx, 7 - half, y, half * 2, 1, "#a4adb8");
      px(ctx, 7 - half, y, Math.max(1, half), 1, "#cbd3de");
    }
    px(ctx, 6, 2, 2, 1, P.outline);
    // Faint mossy carvings
    px(ctx, 6, 11, 2, 1, "#57606e");
    px(ctx, 6, 14, 2, 1, "#57606e");
    px(ctx, 4, 21, 2, 2, "#467554");
    sprites.grave_obelisk = canvas;
  }
  // 5) Gothic Stone Mausoleum / Family Crypt (28x28)
  {
    const { canvas, ctx } = makeCanvas(28, 28);
    px(ctx, 2, 23, 24, 4, "rgba(12, 16, 24, 0.5)");
    // Stepped granite base
    px(ctx, 2, 21, 24, 5, P.outline);
    px(ctx, 3, 22, 22, 3, "#78808f");
    px(ctx, 3, 22, 22, 1, "#a2aab8");
    // Stone crypt walls + corner pillars
    px(ctx, 4, 10, 20, 12, P.outline);
    px(ctx, 5, 11, 18, 10, "#8d96a6");
    px(ctx, 5, 11, 3, 10, "#b2bac9");
    px(ctx, 20, 11, 3, 10, "#687080");
    // Triangular Gothic stone pediment roof + iron cross finial!
    for (let r = 0; r < 8; r++) {
      const span = 3 + r;
      px(ctx, 14 - span - 1, 3 + r, span * 2 + 2, 1, P.outline);
      px(ctx, 14 - span, 3 + r, span * 2, 1, r < 2 ? "#b4bcc9" : "#6b7382");
    }
    px(ctx, 13, 0, 2, 4, P.outline);
    px(ctx, 12, 1, 4, 1, P.outline);
    // Dark arched iron-barred crypt doorway with eerie purple/teal glow!
    px(ctx, 10, 13, 8, 9, P.outline);
    px(ctx, 11, 14, 6, 8, "#221d33");
    px(ctx, 12, 15, 4, 4, "#4b3878"); // mysterious inner violet glow
    px(ctx, 13, 16, 2, 2, "#8de8db"); // ghostly lantern glint inside!
    // Iron vertical gate bars
    px(ctx, 12, 14, 1, 8, "#161922");
    px(ctx, 15, 14, 1, 8, "#161922");
    sprites.grave_mausoleum = canvas;
  }
  // 6) Gnarled Haunted Dead Oak Tree with Perched Black Crow & Cobweb (26x32)
  {
    const { canvas, ctx } = makeCanvas(26, 32);
    px(ctx, 5, 27, 16, 4, "rgba(12, 16, 24, 0.48)");
    // Twisted roots & dark indigo-brown trunk
    px(ctx, 9, 15, 8, 14, P.outline);
    px(ctx, 7, 25, 12, 4, P.outline);
    px(ctx, 10, 16, 6, 12, "#453b4d");
    px(ctx, 10, 16, 2, 12, "#61546b");
    px(ctx, 8, 26, 10, 2, "#3a3142");
    // Twisted bare claw-like branches reaching up & out!
    const drawBranch = (x0, y0, x1, y1, thick = 2) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= steps; i++) {
        const bx = Math.round(x0 + ((x1 - x0) * i) / Math.max(1, steps));
        const by = Math.round(y0 + ((y1 - y0) * i) / Math.max(1, steps));
        px(ctx, bx - 1, by - 1, thick + 2, thick + 2, P.outline);
        px(ctx, bx, by, thick, thick, "#4c4157");
      }
    };
    drawBranch(11, 16, 3, 7, 2);
    drawBranch(6, 10, 2, 4, 1);
    drawBranch(14, 16, 22, 8, 2);
    drawBranch(19, 11, 23, 4, 1);
    drawBranch(12, 15, 10, 4, 2);
    drawBranch(13, 14, 16, 5, 1);
    // Delicate silver pixel cobweb strung between left & center branch!
    px(ctx, 6, 9, 5, 1, "rgba(220, 230, 242, 0.55)");
    px(ctx, 7, 11, 4, 1, "rgba(220, 230, 242, 0.45)");
    px(ctx, 8, 8, 1, 5, "rgba(220, 230, 242, 0.5)");
    // Tiny spooky black crow perched on the right branch with glowing eye!
    px(ctx, 19, 5, 4, 3, "#14161f");
    px(ctx, 22, 6, 2, 1, "#d9a441"); // beak
    px(ctx, 21, 5, 1, 1, "#ffeb6b"); // yellow eye
    sprites.grave_tree_spooky = canvas;
  }
  // 7) Wrought-Iron Spear-Tipped Graveyard Fence (16x14)
  {
    const { canvas, ctx } = makeCanvas(16, 14);
    px(ctx, 0, 11, 16, 2, "rgba(12, 16, 24, 0.36)");
    // Top & bottom iron rails
    px(ctx, 0, 4, 16, 2, "#1c2029");
    px(ctx, 0, 10, 16, 2, "#1c2029");
    px(ctx, 0, 4, 16, 1, "#414959");
    // 4 iron vertical pickets with spear tips!
    for (const fx of [2, 6, 10, 14]) {
      px(ctx, fx - 1, 2, 2, 11, "#181c24");
      px(ctx, fx - 1, 2, 1, 10, "#4f586b");
      px(ctx, fx - 1, 1, 2, 1, "#8590a6"); // spear tip glint
    }
    sprites.grave_iron_fence = canvas;
  }
  // 8) Grand Wrought-Iron Arched Cemetery Entrance Gate (32x28)
  {
    const { canvas, ctx } = makeCanvas(32, 28);
    px(ctx, 1, 24, 30, 3, "rgba(12, 16, 24, 0.45)");
    // Left & right weathered stone gateposts
    for (const gx of [1, 25]) {
      px(ctx, gx, 8, 6, 18, P.outline);
      px(ctx, gx + 1, 9, 4, 16, "#858e9e");
      px(ctx, gx + 1, 9, 2, 16, "#abb3c2");
      // Flickering eerie teal cap lantern atop each pillar!
      px(ctx, gx + 1, 4, 4, 5, P.outline);
      px(ctx, gx + 2, 5, 2, 3, "#6bf0d8");
      px(ctx, gx + 2, 5, 1, 1, "#ffffff");
    }
    // Arched wrought-iron overhead sign arch!
    for (let x = 6; x <= 25; x++) {
      const norm = (x - 15.5) / 10;
      const ay = Math.round(3 + norm * norm * 6);
      px(ctx, x, ay, 1, 3, "#181c24");
      px(ctx, x, ay, 1, 1, "#576175");
    }
    // Open iron half-gates inviting the explorer inside!
    px(ctx, 7, 13, 4, 11, "#181c24");
    px(ctx, 8, 14, 1, 9, "#485263");
    px(ctx, 21, 13, 4, 11, "#181c24");
    px(ctx, 23, 14, 1, 9, "#485263");
    sprites.grave_gate = canvas;
  }
  // 9) Animated Flickering Carved Jack-o'-Lantern (12x12, 2 frames!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(12, 12);
    // Warm orange candle glow halo on ground
    px(ctx, 0, 2, 12, 10, f === 0 ? "rgba(255, 166, 48, 0.24)" : "rgba(255, 196, 68, 0.36)");
    // Stem
    px(ctx, 5, 0, 2, 3, P.outline);
    px(ctx, 5, 1, 2, 1, "#3f7d38");
    // Plump ribbed orange pumpkin
    px(ctx, 2, 2, 8, 9, P.outline);
    px(ctx, 1, 4, 10, 6, P.outline);
    px(ctx, 2, 3, 8, 7, "#e06d1b");
    px(ctx, 3, 3, 6, 6, "#f28524");
    px(ctx, 5, 3, 2, 6, "#d15c15");
    // Glowing carved eyes & cheeky jack-o'-lantern grin!
    const flame = f === 0 ? "#ffe066" : "#fff7b8";
    px(ctx, 3, 5, 2, 2, flame);
    px(ctx, 7, 5, 2, 2, flame);
    px(ctx, 3, 8, 6, 1, flame);
    px(ctx, 4, 9, 1, 1, flame);
    px(ctx, 7, 9, 1, 1, flame);
    sprites[`grave_pumpkin_${f}`] = canvas;
  }
  // 10) Animated Spooky Iron Lantern Post with Ghostly Teal Flame (10x22, 2 frames!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(10, 22);
    px(ctx, 3, 19, 4, 2, "rgba(12, 16, 24, 0.42)");
    // Ghostly teal lantern aura
    px(ctx, 0, 1, 10, 10, f === 0 ? "rgba(92, 232, 214, 0.22)" : "rgba(130, 255, 238, 0.35)");
    // Wrought-iron post
    px(ctx, 4, 8, 2, 13, "#181c24");
    px(ctx, 4, 9, 1, 11, "#4f586b");
    px(ctx, 3, 19, 4, 2, "#181c24");
    // Lantern cage & flickering flame
    px(ctx, 2, 2, 6, 7, P.outline);
    px(ctx, 3, 3, 4, 5, f === 0 ? "#4ed9c2" : "#8cffec");
    px(ctx, 4, 4, 2, 3, "#ffffff");
    px(ctx, 3, 1, 4, 2, "#181c24");
    sprites[`grave_lantern_${f}`] = canvas;
  }
  // 11) Spooky Black Cat with Glowing Yellow Eyes (12x12)
  {
    const { canvas, ctx } = makeCanvas(12, 12);
    px(ctx, 2, 9, 8, 2, "rgba(12, 16, 24, 0.38)");
    // Curled tail
    px(ctx, 9, 4, 2, 5, "#151722");
    px(ctx, 8, 3, 2, 2, "#242838");
    // Sitting body
    px(ctx, 3, 5, 6, 6, "#151722");
    px(ctx, 4, 6, 3, 4, "#242838");
    // Head + pointy ears
    px(ctx, 2, 2, 6, 5, "#151722");
    px(ctx, 2, 1, 2, 2, "#151722");
    px(ctx, 6, 1, 2, 2, "#151722");
    // Bright glowing yellow cat eyes!
    px(ctx, 3, 4, 1, 1, "#ffe64d");
    px(ctx, 6, 4, 1, 1, "#ffe64d");
    sprites.grave_cat = canvas;
  }
  // 12) Cute 16-Bit SNES Friendly Floating Ghost (14x18, 2 frames!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(14, 18);
    // Soft eerie cyan-lavender glow halo
    px(ctx, 1, 1, 12, 15, "rgba(182, 232, 255, 0.22)");
    // Rounded ghostly head & billowing sheet body
    px(ctx, 4, 1, 6, 2, "#2a354d");
    px(ctx, 2, 3, 10, 11, "#2a354d");
    px(ctx, 4, 2, 6, 12, "#eef8ff");
    px(ctx, 3, 4, 8, 10, "#eef8ff");
    px(ctx, 3, 4, 2, 9, "#ffffff"); // highlight
    px(ctx, 9, 5, 2, 8, "#c2e0f5"); // cool ghost shadow
    // Wavy animated floating bottom hem!
    if (f === 0) {
      px(ctx, 2, 14, 3, 2, "#d8f0ff");
      px(ctx, 6, 14, 3, 3, "#eef8ff");
      px(ctx, 10, 14, 2, 2, "#c2e0f5");
    } else {
      px(ctx, 3, 14, 3, 3, "#eef8ff");
      px(ctx, 7, 14, 3, 2, "#d8f0ff");
      px(ctx, 10, 13, 2, 3, "#c2e0f5");
    }
    // Cute expressive dark eyes + tiny "Ooo!" mouth + rosy cheeks
    px(ctx, 4, 6, 2, 2, "#1d2233");
    px(ctx, 8, 6, 2, 2, "#1d2233");
    px(ctx, 4, 6, 1, 1, "#ffffff"); // cute eye glint
    px(ctx, 8, 6, 1, 1, "#ffffff");
    px(ctx, 6, 9, 2, 2, "#2f3d59"); // tiny 'o' mouth
    px(ctx, 3, 8, 1, 1, "#ffb5d2");
    px(ctx, 10, 8, 1, 1, "#ffb5d2");
    sprites[`grave_ghost_${f}`] = canvas;
  }
  // 13) Animated Flapping Pixel Bat (12x8, 2 frames!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(12, 8);
    // Body & ears
    px(ctx, 5, 2, 2, 4, "#1b1829");
    px(ctx, 4, 3, 4, 3, "#2a243d");
    px(ctx, 4, 1, 1, 2, "#1b1829");
    px(ctx, 7, 1, 1, 2, "#1b1829");
    // Tiny glowing amber/red eyes
    px(ctx, 5, 3, 1, 1, "#ff6b6b");
    px(ctx, 6, 3, 1, 1, "#ff6b6b");
    // Flapping wings (up vs down!)
    if (f === 0) {
      px(ctx, 0, 1, 4, 3, "#1b1829");
      px(ctx, 1, 2, 3, 1, "#473c66");
      px(ctx, 8, 1, 4, 3, "#1b1829");
      px(ctx, 8, 2, 3, 1, "#473c66");
    } else {
      px(ctx, 0, 4, 4, 3, "#1b1829");
      px(ctx, 1, 4, 3, 1, "#473c66");
      px(ctx, 8, 4, 4, 3, "#1b1829");
      px(ctx, 8, 4, 3, 1, "#473c66");
    }
    sprites[`grave_bat_${f}`] = canvas;
  }
  // 14) Floating Ghostly Will-o'-the-Wisp Orb (8x8, 2 frames!)
  for (let f = 0; f < 2; f++) {
    const { canvas, ctx } = makeCanvas(8, 8);
    px(ctx, 1, 1, 6, 6, f === 0 ? "rgba(110, 240, 224, 0.35)" : "rgba(176, 140, 255, 0.38)");
    px(ctx, 2, 2, 4, 4, f === 0 ? "#7cf5e4" : "#c7a8ff");
    px(ctx, 3, 3, 2, 2, "#ffffff");
    sprites[`grave_wisp_${f}`] = canvas;
  }

  // --- 8. Glowing Green WALK Crosswalk Signal Post (2 states: steady & bright checked!) ---
  for (let bright = 0; bright < 2; bright++) {
    const { canvas, ctx } = makeCanvas(18, 24);
    // Pole shadow
    px(ctx, 11, 21, 5, 2, "rgba(18, 24, 22, 0.4)");
    // Metal pole + base flange
    px(ctx, 12, 6, 3, 16, P.outline);
    px(ctx, 13, 7, 1, 14, "#adb6c4");
    px(ctx, 11, 20, 5, 2, P.outline);
    px(ctx, 12, 20, 3, 1, "#8d96a6");
    // Curved overhanging arm
    px(ctx, 5, 5, 9, 2, P.outline);
    px(ctx, 6, 5, 7, 1, "#bfc8d6");
    // Black signal housing box
    px(ctx, 1, 7, 11, 8, P.outline);
    px(ctx, 2, 8, 9, 6, "#141d18");
    // Glowing green WALK pixel indicator (tiny walking person + green bars)
    const glow = bright ? "#7dff9b" : "#3be06c";
    const aura = bright ? "rgba(110, 255, 155, 0.35)" : "rgba(59, 224, 108, 0.16)";
    px(ctx, 0, 6, 13, 10, aura);
    px(ctx, 2, 8, 9, 6, "#16241b");
    // Mini pixel 'W A L K' / walking silhouette glow
    px(ctx, 3, 9, 1, 4, glow);
    px(ctx, 4, 12, 1, 1, glow);
    px(ctx, 5, 10, 1, 2, glow);
    px(ctx, 6, 12, 1, 1, glow);
    px(ctx, 7, 9, 1, 4, glow);
    px(ctx, 9, 9, 1, 4, glow);
    sprites[`walk_signal_${bright}`] = canvas;
  }

  // --- 9. Classic Red Fire Hydrant (from style_1_snes_16bit!) ---
  {
    const { canvas, ctx } = makeCanvas(10, 14);
    px(ctx, 2, 11, 6, 2, "rgba(18, 24, 22, 0.38)");
    px(ctx, 2, 3, 6, 9, P.outline);
    px(ctx, 1, 5, 8, 3, P.outline);
    px(ctx, 3, 2, 4, 2, P.outline);
    px(ctx, 3, 4, 4, 7, "#c9302c");
    px(ctx, 3, 4, 2, 6, "#eb5249");
    px(ctx, 2, 6, 6, 1, "#d93b36");
    px(ctx, 4, 3, 2, 1, "#f27972");
    px(ctx, 3, 10, 4, 1, "#8f1f1c");
    sprites.prop_hydrant = canvas;
  }

  // --- 10. Collectibles (Coin & Acorn) ---
  {
    const { canvas, ctx } = makeCanvas(8, 8);
    px(ctx, 2, 0, 4, 8, P.outline);
    px(ctx, 0, 2, 8, 4, P.outline);
    px(ctx, 2, 1, 4, 6, "#d99b1e");
    px(ctx, 1, 2, 6, 4, "#f4d35e");
    px(ctx, 2, 2, 4, 4, "#ffe885");
    px(ctx, 3, 3, 1, 2, "#fff9d6");
    sprites.drop_coin = canvas;
  }
  {
    const { canvas, ctx } = makeCanvas(8, 8);
    px(ctx, 3, 0, 2, 2, "#4a2e1d");
    px(ctx, 1, 2, 6, 2, "#6e4228");
    px(ctx, 2, 4, 4, 3, "#b97a45");
    px(ctx, 3, 7, 2, 1, "#8c572c");
    px(ctx, 3, 4, 1, 2, "#e8b37c");
    sprites.drop_acorn = canvas;
  }

  // --- 11. Pre-Baked Super Mario 3–Detail 24x28 Hero Sprites (with custom Hero Profile & regional Soccer/Baseball kit!) ---
  const heroSpriteOpts = {
    heroProfile: atlasOpts.heroProfile || null,
    soccerKit:
      biomeConfig?.parkSports === "soccer_primary" ||
      biomeConfig?.parkSports === "coastal_beach" ||
      biomeConfig?.parkSports === "europe_tennis_soccer",
  };
  for (const outfit of Object.keys(HERO_OUTFITS)) {
    for (const dir of ["down", "up", "left", "right"]) {
      for (let step = 0; step < 3; step++) {
        sprites[`hero_${outfit}_${dir}_${step}`] = bakeSmb3HeroSprite(dir, step, false, outfit, heroSpriteOpts);
      }
      sprites[`hero_${outfit}_scooter_${dir}`] = bakeSmb3HeroSprite(dir, 0, true, outfit, heroSpriteOpts);
    }
    sprites[`hero_${outfit}_fanfare`] = bakeSmb3HeroFanfareSprite(outfit, heroSpriteOpts);
  }
  // Default unprefixed aliases point to Liam's default Everyday Polo & Kippah outfit
  for (const dir of ["down", "up", "left", "right"]) {
    for (let step = 0; step < 3; step++) {
      sprites[`hero_${dir}_${step}`] = sprites[`hero_polo_${dir}_${step}`];
    }
    sprites[`hero_scooter_${dir}`] = sprites[`hero_polo_scooter_${dir}`];
  }
  sprites.hero_fanfare = sprites.hero_polo_fanfare;

  // --- 13. Phase 3 Neighborhood NPCs (SMB3-detail 22x26 character palettes!) ---
  const npcThemes = [
    { shirt: "#d95f76", shirtLight: "#f2859a", shirtDark: "#a83d52", hair: "#6b422a", hairLight: "#946042", hairDark: "#472919", hat: null }, // 0: Mom / Librarian
    { shirt: "#4c8c5c", shirtLight: "#6eb57e", shirtDark: "#32633e", hair: "#784c30", hairLight: "#a36c48", hairDark: "#4f301d", hat: "#c9964c", hatLight: "#e6b873", hatRim: "#8a6026" }, // 1: Ranger / Scout
    { shirt: "#f2f0ea", shirtLight: "#ffffff", shirtDark: "#cbc6ba", hair: "#473529", hairLight: "#6e5442", hairDark: "#2b1f17", hat: "#f5f4f0", hatLight: "#ffffff", hatRim: "#d6d2c9" }, // 2: Baker Ben (chef hat!)
    { shirt: "#5b82c9", shirtLight: "#82a8eb", shirtDark: "#3b5b99", hair: "#a6693c", hairLight: "#cf8f5d", hairDark: "#704221", hat: "#e85d75", hatLight: "#ff8599", hatRim: "#b53c52" }, // 3: Scooper Maya / Friend
    { shirt: "#4a386e", shirtLight: "#6c549c", shirtDark: "#2d2147", hair: "#c2c9d6", hairLight: "#e8edf5", hairDark: "#8c94a6", hat: "#2f2547", hatLight: "#4c3e6e", hatRim: "#7cf5e4" }, // 4: Spooky Graveyard Historian
    { shirt: "#7d1d2e", shirtLight: "#a82d43", shirtDark: "#54111d", hair: "#543a2b", hairLight: "#7a5843", hairDark: "#332117", hat: "#e6b84c", hatLight: "#ffe082", hatRim: "#7d1d2e" }, // 5: Boston College Dean (Maroon & Gold!)
  ];
  npcThemes.forEach((t, idx) => {
    sprites[`npc_${idx}`] = bakeSmb3NpcSprite(t, 0);
    sprites[`npc_${idx}_wave`] = bakeSmb3NpcSprite(t, 1);
  });

  // --- 14. Phase 3 Wooden Chest / Little Free Library Box + Quest Exclamation Bubble + Fanfare Star ---
  for (const open of [false, true]) {
    const { canvas, ctx } = makeCanvas(16, 16);
    px(ctx, 2, 12, 12, 3, "rgba(16, 26, 18, 0.38)");
    px(ctx, 2, open ? 3 : 5, 12, open ? 11 : 9, P.outline);
    px(ctx, 3, open ? 4 : 6, 10, open ? 9 : 7, "#8c542c");
    px(ctx, 3, open ? 4 : 6, 10, 3, open ? "#3d2616" : "#b87442");
    if (open) {
      // Glowing little books / treasure peeking out!
      px(ctx, 4, 5, 3, 3, "#f4d35e");
      px(ctx, 8, 5, 4, 3, "#52b788");
    }
    // Gold brass bands & clasp
    px(ctx, 3, 9, 10, 1, "#f4d35e");
    px(ctx, 7, 8, 2, 3, "#f4d35e");
    sprites[open ? "chest_open" : "chest_closed"] = canvas;
  }

  {
    const { canvas, ctx } = makeCanvas(10, 12);
    px(ctx, 1, 0, 8, 9, P.outline);
    px(ctx, 3, 9, 4, 2, P.outline);
    px(ctx, 2, 1, 6, 7, "#f4d35e");
    px(ctx, 4, 2, 2, 3, "#2b2112");
    px(ctx, 4, 6, 2, 1, "#2b2112");
    sprites.quest_bubble = canvas;
  }

  // Crisp 11x11 pixel-art Stop & Look Both Ways curb cue above hero!
  {
    const { canvas, ctx } = makeCanvas(11, 11);
    // Octagon outline
    px(ctx, 3, 0, 5, 11, P.outline);
    px(ctx, 0, 3, 11, 5, P.outline);
    px(ctx, 2, 1, 7, 9, P.outline);
    px(ctx, 1, 2, 9, 7, P.outline);
    // Crisp white inner rim
    px(ctx, 3, 1, 5, 9, "#ffffff");
    px(ctx, 1, 3, 9, 5, "#ffffff");
    px(ctx, 2, 2, 7, 7, "#ffffff");
    // Vibrant stop-sign red center
    px(ctx, 3, 2, 5, 7, "#d9362e");
    px(ctx, 2, 3, 7, 5, "#d9362e");
    // Tiny crisp white eyes icon (Look Both Ways!)
    px(ctx, 3, 4, 2, 3, "#ffffff");
    px(ctx, 6, 4, 2, 3, "#ffffff");
    px(ctx, 4, 5, 1, 1, P.outline);
    px(ctx, 6, 5, 1, 1, P.outline);
    sprites.curb_stop_cue = canvas;
  }

  {
    const { canvas, ctx } = makeCanvas(9, 9);
    px(ctx, 4, 0, 1, 9, "#fff6b8");
    px(ctx, 0, 4, 9, 1, "#fff6b8");
    px(ctx, 3, 2, 3, 5, "#f4d35e");
    px(ctx, 2, 3, 5, 3, "#f4d35e");
    px(ctx, 4, 4, 1, 1, "#ffffff");
    sprites.fanfare_star = canvas;
  }

  // Crisp 12x12 overhead item icons for fanfare lift
  const makeIcon = (drawFn) => {
    const { canvas, ctx } = makeCanvas(12, 12);
    px(ctx, 1, 1, 10, 10, "rgba(28, 34, 40, 0.85)");
    drawFn(ctx);
    return canvas;
  };
  sprites.item_map = makeIcon((ctx) => {
    px(ctx, 2, 2, 8, 8, "#e8d8b5");
    px(ctx, 5, 2, 1, 8, "#b89f72");
    px(ctx, 3, 4, 6, 2, "#52b788");
    px(ctx, 7, 7, 2, 2, "#d94a38");
  });
  sprites.item_icecream = makeIcon((ctx) => {
    px(ctx, 4, 6, 4, 5, "#d49b54");
    px(ctx, 5, 9, 2, 2, "#b57c3a");
    px(ctx, 3, 3, 6, 4, "#ff99b8");
    px(ctx, 4, 2, 4, 3, "#fff6e6");
  });
  sprites.item_challah = makeIcon((ctx) => {
    px(ctx, 2, 4, 8, 5, "#d9923b");
    px(ctx, 3, 3, 6, 4, "#f4c26b");
    px(ctx, 4, 4, 1, 1, "#fff9e0");
    px(ctx, 7, 5, 1, 1, "#fff9e0");
  });
  sprites.item_book = makeIcon((ctx) => {
    px(ctx, 2, 2, 8, 8, "#3a6ea5");
    px(ctx, 3, 3, 6, 6, "#5c94cc");
    px(ctx, 2, 2, 2, 8, "#22466e");
    px(ctx, 5, 4, 3, 2, "#f4d35e");
  });
  sprites.item_shoes = makeIcon((ctx) => {
    px(ctx, 2, 5, 8, 5, "#d94a38");
    px(ctx, 2, 9, 8, 1, "#ffffff");
    px(ctx, 4, 3, 3, 3, "#f0725c");
    px(ctx, 5, 6, 3, 1, "#f4d35e");
  });
  sprites.item_scooter = makeIcon((ctx) => {
    px(ctx, 2, 8, 8, 2, "#4de0d8");
    px(ctx, 8, 2, 2, 7, "#dbe4ee");
    px(ctx, 2, 9, 2, 2, "#1c1b24");
    px(ctx, 8, 9, 2, 2, "#1c1b24");
  });
  sprites.item_compass = makeIcon((ctx) => {
    px(ctx, 3, 3, 6, 6, "#f4d35e");
    px(ctx, 4, 4, 4, 4, "#ffffff");
    px(ctx, 5, 4, 2, 2, "#d93b36");
  });
  sprites.item_stamp = makeIcon((ctx) => {
    px(ctx, 3, 2, 6, 8, "#6ee7a8");
    px(ctx, 4, 4, 4, 4, "#24573d");
  });
  sprites.item_cholent = makeIcon((ctx) => {
    px(ctx, 2, 5, 8, 5, "#6b4226");
    px(ctx, 3, 4, 6, 2, "#e85d38");
    px(ctx, 4, 2, 1, 2, "#ffffff");
    px(ctx, 7, 2, 1, 2, "#ffffff");
  });
  sprites.item_glove = makeIcon((ctx) => {
    px(ctx, 3, 3, 6, 7, "#d99b26");
    px(ctx, 4, 4, 4, 4, "#f4d35e");
  });
  sprites.item_badge = makeIcon((ctx) => {
    px(ctx, 3, 2, 6, 8, "#f4d35e");
    px(ctx, 4, 4, 4, 4, "#24573d");
    px(ctx, 5, 5, 2, 2, "#fff6b8");
  });
  sprites.item_pennant = makeIcon((ctx) => {
    // BC Maroon & Gold campus pennant!
    px(ctx, 2, 2, 1, 8, "#e6d8b8");
    px(ctx, 3, 3, 7, 5, "#7d1d2e");
    px(ctx, 6, 4, 4, 3, "#7d1d2e");
    px(ctx, 4, 5, 4, 1, "#f4d35e");
    px(ctx, 3, 3, 2, 5, "#f4d35e");
  });
  sprites.item_lantern = makeIcon((ctx) => {
    // Spooky glowing teal iron lantern!
    px(ctx, 4, 2, 4, 1, "#4f586b");
    px(ctx, 3, 3, 6, 6, "#2c3240");
    px(ctx, 4, 4, 4, 4, "#6bf0d8");
    px(ctx, 5, 5, 2, 2, "#ffffff");
    px(ctx, 3, 9, 6, 1, "#4f586b");
  });
  sprites.item_ghost = makeIcon((ctx) => {
    // Friendly glowing ghost charm!
    px(ctx, 3, 2, 6, 7, "#eef8ff");
    px(ctx, 3, 9, 2, 1, "#c2e0f5");
    px(ctx, 7, 9, 2, 1, "#c2e0f5");
    px(ctx, 4, 4, 1, 2, "#1d2233");
    px(ctx, 7, 4, 1, 2, "#1d2233");
  });
  sprites.item_sword = makeIcon((ctx) => {
    // Gleaming 16-bit Graveyard Explorer Hero Sword!
    px(ctx, 8, 2, 2, 2, "#ffffff");
    px(ctx, 7, 3, 2, 2, "#b8e4ff");
    px(ctx, 6, 4, 2, 2, "#7cc4f5");
    px(ctx, 5, 5, 2, 2, "#b8e4ff");
    px(ctx, 4, 6, 2, 2, "#5a9bd6");
    px(ctx, 3, 5, 4, 2, "#f4d35e"); // Golden crossguard
    px(ctx, 5, 7, 2, 3, "#f4d35e");
    px(ctx, 2, 8, 2, 2, "#8c4a24"); // Leather hilt
    px(ctx, 2, 9, 1, 1, "#f4d35e"); // Gold pommel
  });
  sprites.item_siddur = makeIcon((ctx) => {
    // Royal-blue & gold Pocket Siddur prayerbook!
    px(ctx, 2, 2, 8, 8, "#1b4385");
    px(ctx, 3, 3, 6, 6, "#2c66bf");
    px(ctx, 2, 2, 2, 8, "#112a57");
    px(ctx, 4, 4, 4, 4, "#f4d35e");
    px(ctx, 5, 5, 2, 2, "#2c66bf");
    px(ctx, 9, 3, 1, 6, "#fff8e0"); // Gold-edged pages
  });

  // --- 14b. 32-bit HD 3-Frame Sweeping Sword Slash Arcs (4 directions!) ---
  // Smooth crescent pixel-arc sweep: frame 0 (wind-up arc), frame 1 (full gleaming apex), frame 2 (follow-through shimmer)
  const makeSwordSlashFrame = (dir, frame = 1) => {
    const isH = dir === "left" || dir === "right";
    const w = isH ? 38 : 44;
    const h = isH ? 44 : 38;
    const { canvas, ctx } = makeCanvas(w, h);
    canvas.__pixelScale = 0.5;
    const cx = dir === "right" ? 4 : dir === "left" ? w - 5 : Math.floor(w / 2);
    const cy = dir === "down" ? 4 : dir === "up" ? h - 5 : Math.floor(h / 2);
    const baseAngle =
      dir === "right" ? 0 : dir === "left" ? Math.PI : dir === "down" ? Math.PI / 2 : -Math.PI / 2;
    const startOff = frame === 0 ? -1.35 : frame === 1 ? -1.25 : -0.35;
    const endOff = frame === 0 ? 0.15 : frame === 1 ? 1.25 : 1.38;
    const outerR = frame === 1 ? 26 : 24;
    const innerR = frame === 2 ? 17 : 12;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        if (r < innerR || r > outerR) continue;
        let diff = Math.atan2(dy, dx) - baseAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (diff < startOff || diff > endOff) continue;
        const progress = (diff - startOff) / Math.max(0.01, endOff - startOff);
        const radFrac = (r - innerR) / Math.max(1, outerR - innerR);
        // Taper the trailing tail smoothly into a razor-sharp crescent!
        const minRadForTail = (1 - progress) * 0.55;
        if (radFrac < minRadForTail) continue;
        if (radFrac > 0.84) {
          px(ctx, x, y, 1, 1, progress > 0.45 ? "#ffffff" : "#fff6b8");
        } else if (radFrac > 0.56) {
          px(ctx, x, y, 1, 1, progress > 0.5 ? "#d8f8ff" : "#f4d35e");
        } else if (radFrac > 0.3) {
          px(ctx, x, y, 1, 1, frame === 2 ? "rgba(132, 224, 255, 0.58)" : "#78d2ff");
        } else if ((x + y) % 2 === 0) {
          px(ctx, x, y, 1, 1, "rgba(244, 211, 94, 0.55)");
        }
      }
    }

    // Gleaming pixel blade + golden crossguard leading the swing!
    const bladeAng = baseAngle + (frame === 0 ? -0.25 : frame === 1 ? 0.22 : 0.85);
    const cosB = Math.cos(bladeAng);
    const sinB = Math.sin(bladeAng);
    for (let step = 4; step <= 23; step++) {
      const bx = Math.round(cx + cosB * step);
      const by = Math.round(cy + sinB * step);
      px(ctx, bx - 1, by - 1, 3, 3, step < 8 ? "#b8861e" : "#80ccff");
      px(ctx, bx, by, 2, 2, step < 8 ? "#ffe375" : "#ffffff");
    }
    // Golden crossguard near hilt
    const gx = Math.round(cx + cosB * 6);
    const gy = Math.round(cy + sinB * 6);
    const perpX = -sinB;
    const perpY = cosB;
    for (let k = -4; k <= 4; k++) {
      px(ctx, Math.round(gx + perpX * k), Math.round(gy + perpY * k), 2, 2, Math.abs(k) < 2 ? "#fff6b8" : "#e6b84c");
    }
    return canvas;
  };
  for (const dir of ["down", "up", "left", "right"]) {
    sprites[`sword_slash_${dir}_0`] = makeSwordSlashFrame(dir, 0);
    sprites[`sword_slash_${dir}_1`] = makeSwordSlashFrame(dir, 1);
    sprites[`sword_slash_${dir}_2`] = makeSwordSlashFrame(dir, 2);
    sprites[`sword_slash_${dir}`] = sprites[`sword_slash_${dir}_1`];
  }

  // --- 14c. HERO-GRADE 32-BIT PIXELGRID CARS, SUVs, PICKUP & BOX TRUCKS, ANNOYING BIKERS & EMS AMBULANCE! ---
  Object.assign(sprites, bake32BitVehicleSprites({ drawMiniText }));

  // Upgrade terrain tiles, lush trees, street signs, vehicles & props to 32-bit 2x native pixel detail!
  upgradeAtlasTo32Bit(sprites, P, biomeConfig);

  // Register 32-bit roving regional wildlife, sidewalk marchers & pixel speech bubbles!
  const activeChants =
    Array.isArray(atlasOpts.localChants) && atlasOpts.localChants.length > 0
      ? atlasOpts.localChants
      : PROTEST_CHANTS;
  Object.assign(
    sprites,
    bake32BitStreetLifeSprites(activeChants, {
      biomeConfig,
      season: atlasOpts.season,
      localFlair: atlasOpts.localFlair,
      bikerChants: atlasOpts.bikerChants,
      joggerChants: atlasOpts.joggerChants,
      heroName: atlasOpts.heroName,
      cityShort: atlasOpts.cityShort,
    })
  );

  return sprites;
}

/**
 * Bake crisp 16-bit SNES athletic field & court ground surfaces (baseball diamonds,
 * painted basketball courts, mowed soccer pitches, and timber-framed playgrounds)
 * so parks are unmistakably recognizable from backyard grass!
 */
export function bakeParkFieldCanvas(field, tileSize = 16) {
  const w = field.w * tileSize;
  const h = field.h * tileSize;
  const { canvas, ctx } = makeCanvas(w, h);
  const cx = Math.floor(w / 2);
  const cy = Math.floor(h / 2);

  if (field.kind === "baseball_diamond") {
    // 1. Lush mowed outfield grass base with alternating diagonal/vertical sheen
    for (let x = 0; x < w; x += 8) {
      px(ctx, x, 0, Math.min(8, w - x), h, (x / 8) % 2 === 0 ? "#4fa84c" : "#449642");
    }
    // 2. Curved terracotta dirt infield arc
    const homeX = cx;
    const homeY = h - 18;
    const infieldR = Math.floor(Math.min(w, h) * 0.44);
    for (let y = 8; y < h - 6; y++) {
      for (let x = 8; x < w - 8; x++) {
        const dx = x - homeX;
        const dy = homeY - y;
        if (dy < -8) continue;
        const dist = Math.hypot(dx, dy);
        // Fan shape between 1st & 3rd foul lines (45 deg diagonals) + rounded home plate dirt circle
        const inFan = dy >= Math.abs(dx) - 6 && dist <= infieldR;
        const inHomeCircle = Math.hypot(dx, y - homeY) <= 10;
        if (inFan || inHomeCircle) {
          const speck = ((x * 7 + y * 13) & 15) === 0;
          px(ctx, x, y, 1, 1, speck ? "#c99662" : "#b57f4c");
        }
      }
    }
    // 3. Inner grass diamond cutout inside the basepaths!
    const baseDist = Math.floor(infieldR * 0.56);
    const secondY = homeY - baseDist * 2 + 12;
    const midInfieldY = Math.floor((homeY + secondY) / 2);
    const innerR = Math.floor(baseDist * 0.62);
    for (let dy = -innerR; dy <= innerR; dy++) {
      const span = innerR - Math.abs(dy);
      px(ctx, homeX - span, midInfieldY + dy, span * 2, 1, "#58b552");
    }
    // 4. Dirt pitcher's mound & crisp white pitcher's rubber
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (dx * dx + dy * dy <= 25) {
          px(ctx, homeX + dx, midInfieldY + dy, 1, 1, "#bd8754");
        }
      }
    }
    px(ctx, homeX - 2, midInfieldY, 5, 2, "#f7f9fc");

    // 5. Crisp white chalk foul lines extending to outfield corners!
    const lineLen = Math.floor(Math.min(cx - 6, homeY - 6));
    for (let i = 0; i < lineLen; i++) {
      px(ctx, homeX - i, homeY - i, 1, 1, "#f5f8fc");
      px(ctx, homeX + i, homeY - i, 1, 1, "#f5f8fc");
    }
    // 6. Crisp white bases (Home Plate, 1st, 2nd, 3rd!)
    const bSpan = Math.floor(innerR + 5);
    // 1st base (right), 3rd base (left), 2nd base (top), Home plate (bottom)
    const bases = [
      [homeX + bSpan, midInfieldY],
      [homeX - bSpan, midInfieldY],
      [homeX, midInfieldY - bSpan],
      [homeX, homeY],
    ];
    for (const [bx, by] of bases) {
      px(ctx, bx - 2, by - 2, 5, 5, "#1d2228");
      px(ctx, bx - 1, by - 1, 3, 3, "#ffffff");
    }
    // Batter's boxes flanking home plate
    px(ctx, homeX - 7, homeY - 2, 3, 5, "rgba(255,255,255,0.65)");
    px(ctx, homeX + 5, homeY - 2, 3, 5, "rgba(255,255,255,0.65)");
    return canvas;
  }

  if (field.kind === "basketball_court") {
    // Crisp outdoor park basketball court (green/blue painted asphalt, terracotta keys, white lines!)
    px(ctx, 2, 2, w - 4, h - 4, "#1d2228");
    px(ctx, 3, 3, w - 6, h - 6, "#3a6b7c"); // outer court apron
    const mx = 7;
    const my = 6;
    const cw = w - mx * 2;
    const ch = h - my * 2;
    px(ctx, mx, my, cw, ch, "#4a7c66"); // painted park court green
    // Subtle asphalt speckle
    for (let y = my + 2; y < my + ch - 2; y += 6) {
      for (let x = mx + 2; x < mx + cw - 2; x += 9) {
        px(ctx, x, y, 2, 1, "#3f6e59");
      }
    }
    // White boundary rectangle
    px(ctx, mx, my, cw, 1, "#f4f7fa");
    px(ctx, mx, my + ch - 1, cw, 1, "#f4f7fa");
    px(ctx, mx, my, 1, ch, "#f4f7fa");
    px(ctx, mx + cw - 1, my, 1, ch, "#f4f7fa");
    // Half-court line & center jump circle
    px(ctx, cx, my, 1, ch, "#f4f7fa");
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      px(ctx, Math.round(cx + Math.cos(rad) * 7), Math.round(cy + Math.sin(rad) * 7), 1, 1, "#f4f7fa");
    }
    px(ctx, cx - 2, cy - 2, 5, 5, "#c95c3e");
    // Painted keys / free-throw lanes on left & right + 3-point arcs!
    const keyW = Math.min(18, Math.floor(cw * 0.24));
    const keyH = Math.min(18, Math.floor(ch * 0.36));
    const keyY = cy - Math.floor(keyH / 2);
    // Left key
    px(ctx, mx + 1, keyY, keyW, keyH, "#c95c3e");
    px(ctx, mx + 1, keyY, keyW, 1, "#f4f7fa");
    px(ctx, mx + 1, keyY + keyH - 1, keyW, 1, "#f4f7fa");
    px(ctx, mx + keyW, keyY, 1, keyH, "#f4f7fa");
    // Right key
    px(ctx, mx + cw - 1 - keyW, keyY, keyW, keyH, "#c95c3e");
    px(ctx, mx + cw - 1 - keyW, keyY, keyW, 1, "#f4f7fa");
    px(ctx, mx + cw - 1 - keyW, keyY + keyH - 1, keyW, 1, "#f4f7fa");
    px(ctx, mx + cw - 1 - keyW, keyY, 1, keyH, "#f4f7fa");
    // Crisp 3-point arcs
    const arcR = Math.min(22, Math.floor(ch * 0.42));
    for (let a = -72; a <= 72; a += 6) {
      const rad = (a * Math.PI) / 180;
      px(ctx, Math.round(mx + 4 + Math.cos(rad) * arcR), Math.round(cy + Math.sin(rad) * arcR), 1, 1, "#f4f7fa");
      px(ctx, Math.round(mx + cw - 5 - Math.cos(rad) * arcR), Math.round(cy + Math.sin(rad) * arcR), 1, 1, "#f4f7fa");
    }
    return canvas;
  }

  if (field.kind === "half_court") {
    px(ctx, 2, 2, w - 4, h - 4, "#1d2228");
    px(ctx, 3, 3, w - 6, h - 6, "#4d698c"); // cool asphalt blue half-court
    const mx = 6;
    const my = 5;
    const cw = w - mx * 2;
    const ch = h - my * 2;
    px(ctx, mx, my, cw, 1, "#f4f7fa");
    px(ctx, mx, my + ch - 1, cw, 1, "#f4f7fa");
    px(ctx, mx, my, 1, ch, "#f4f7fa");
    px(ctx, mx + cw - 1, my, 1, ch, "#f4f7fa");
    // Painted key at top beneath the hoop
    const keyW = Math.floor(cw * 0.42);
    const keyH = Math.floor(ch * 0.46);
    const keyX = cx - Math.floor(keyW / 2);
    px(ctx, keyX, my + 1, keyW, keyH, "#c95c3e");
    px(ctx, keyX, my + 1, 1, keyH, "#f4f7fa");
    px(ctx, keyX + keyW - 1, my + 1, 1, keyH, "#f4f7fa");
    px(ctx, keyX, my + keyH, keyW, 1, "#f4f7fa");
    // 3-point arc curving downward
    const arcR = Math.floor(cw * 0.44);
    for (let a = 15; a <= 165; a += 6) {
      const rad = (a * Math.PI) / 180;
      const ax = Math.round(cx + Math.cos(rad) * arcR);
      const ay = Math.round(my + 4 + Math.sin(rad) * (ch * 0.72));
      if (ax > mx && ax < mx + cw - 1 && ay < my + ch - 1) {
        px(ctx, ax, ay, 1, 1, "#f4f7fa");
      }
    }
    return canvas;
  }

  if (field.kind === "soccer_field") {
    // Mowed alternating emerald soccer pitch bands!
    for (let x = 0; x < w; x += 12) {
      px(ctx, x, 0, Math.min(12, w - x), h, (x / 12) % 2 === 0 ? "#49a648" : "#5cb854");
    }
    const mx = 7;
    const my = 6;
    const cw = w - mx * 2;
    const ch = h - my * 2;
    // Crisp white chalk touchlines & goal lines
    px(ctx, mx, my, cw, 2, "#f4f8fc");
    px(ctx, mx, my + ch - 2, cw, 2, "#f4f8fc");
    px(ctx, mx, my, 2, ch, "#f4f8fc");
    px(ctx, mx + cw - 2, my, 2, ch, "#f4f8fc");
    // Halfway line & center circle
    px(ctx, cx, my, 2, ch, "#f4f8fc");
    for (let a = 0; a < 360; a += 8) {
      const rad = (a * Math.PI) / 180;
      px(ctx, Math.round(cx + Math.cos(rad) * 11), Math.round(cy + Math.sin(rad) * 11), 1, 1, "#f4f8fc");
    }
    px(ctx, cx - 1, cy - 1, 3, 3, "#ffffff");
    // Left & right penalty boxes
    const boxW = Math.min(18, Math.floor(cw * 0.17));
    const boxH = Math.min(34, Math.floor(ch * 0.54));
    const boxY = cy - Math.floor(boxH / 2);
    px(ctx, mx + 2, boxY, boxW, 1, "#f4f8fc");
    px(ctx, mx + 2, boxY + boxH - 1, boxW, 1, "#f4f8fc");
    px(ctx, mx + 2 + boxW, boxY, 1, boxH, "#f4f8fc");
    px(ctx, mx + cw - 2 - boxW, boxY, boxW, 1, "#f4f8fc");
    px(ctx, mx + cw - 2 - boxW, boxY + boxH - 1, boxW, 1, "#f4f8fc");
    px(ctx, mx + cw - 2 - boxW, boxY, 1, boxH, "#f4f8fc");
    return canvas;
  }

  if (field.kind === "tennis_court") {
    // Mediterranean clay-terracotta / hardcourt tennis court with crisp white service boxes!
    px(ctx, 2, 2, w - 4, h - 4, "#1d2228");
    px(ctx, 3, 3, w - 6, h - 6, "#2c7a56"); // green outer apron
    const mx = 8;
    const my = 7;
    const cw = w - mx * 2;
    const ch = h - my * 2;
    px(ctx, mx, my, cw, ch, "#c96a42"); // sunlit clay court surface!
    for (let y = my + 2; y < my + ch - 2; y += 5) {
      for (let x = mx + 2; x < mx + cw - 2; x += 8) {
        px(ctx, x, y, 2, 1, "#b55a36");
      }
    }
    // Outer doubles sidelines & baselines
    px(ctx, mx, my, cw, 1, "#f7f9fc");
    px(ctx, mx, my + ch - 1, cw, 1, "#f7f9fc");
    px(ctx, mx, my, 1, ch, "#f7f9fc");
    px(ctx, mx + cw - 1, my, 1, ch, "#f7f9fc");
    // Singles sidelines (inset)
    const alley = Math.max(4, Math.floor(ch * 0.14));
    px(ctx, mx, my + alley, cw, 1, "#f7f9fc");
    px(ctx, mx, my + ch - 1 - alley, cw, 1, "#f7f9fc");
    // Service lines & center service line
    const srvInset = Math.floor(cw * 0.24);
    px(ctx, mx + srvInset, my + alley, 1, ch - alley * 2, "#f7f9fc");
    px(ctx, mx + cw - 1 - srvInset, my + alley, 1, ch - alley * 2, "#f7f9fc");
    px(ctx, mx + srvInset, cy, cw - srvInset * 2, 1, "#f7f9fc");
    // Center net shadow & net line
    px(ctx, cx - 1, my - 2, 3, ch + 4, "rgba(24, 28, 36, 0.35)");
    px(ctx, cx, my - 2, 1, ch + 4, "#ffffff");
    return canvas;
  }

  if (field.kind === "beach_volleyball") {
    // Sunlit golden beach-volleyball sand court with royal-blue boundary tape!
    px(ctx, 2, 2, w - 4, h - 4, "#8a6d43");
    px(ctx, 3, 3, w - 6, h - 6, "#f0d395");
    for (let y = 5; y < h - 5; y += 4) {
      for (let x = 5; x < w - 5; x += 6) {
        px(ctx, x, y, 2, 1, "#dec07e");
        px(ctx, x + 2, y + 2, 1, 1, "#fff1c7");
      }
    }
    const mx = 7;
    const my = 6;
    const cw = w - mx * 2;
    const ch = h - my * 2;
    px(ctx, mx, my, cw, 2, "#245ca8");
    px(ctx, mx, my + ch - 2, cw, 2, "#245ca8");
    px(ctx, mx, my, 2, ch, "#245ca8");
    px(ctx, mx + cw - 2, my, 2, ch, "#245ca8");
    // Center shadow line under net
    px(ctx, cx - 1, my, 2, ch, "rgba(46, 36, 18, 0.25)");
    return canvas;
  }

  if (field.kind === "ice_rink") {
    // Outdoor frozen winter skating & hockey rink with white dasher boards, red goal creases & blue lines!
    px(ctx, 2, 2, w - 4, h - 4, "#243042");
    px(ctx, 3, 3, w - 6, h - 6, "#eef4fa"); // white dasher boards
    const mx = 6;
    const my = 6;
    const cw = w - mx * 2;
    const ch = h - my * 2;
    px(ctx, mx, my, cw, ch, "#d6eefc"); // gleaming ice sheet
    // Diagonal ice sheen stripes
    for (let i = 0; i < cw; i += 14) {
      px(ctx, mx + i, my + 1, 5, ch - 2, "#e8f6ff");
    }
    // Red center line & blue zone lines
    px(ctx, cx, my, 2, ch, "#d9362e");
    const blueOff = Math.floor(cw * 0.24);
    px(ctx, cx - blueOff, my, 2, ch, "#2a6bd9");
    px(ctx, cx + blueOff, my, 2, ch, "#2a6bd9");
    // Center faceoff circle
    for (let a = 0; a < 360; a += 10) {
      const rad = (a * Math.PI) / 180;
      px(ctx, Math.round(cx + Math.cos(rad) * 9), Math.round(cy + Math.sin(rad) * 9), 1, 1, "#2a6bd9");
    }
    px(ctx, cx - 1, cy - 1, 3, 3, "#d9362e");
    // Goal lines & pale-blue goal creases!
    px(ctx, mx + 7, my, 1, ch, "#d9362e");
    px(ctx, mx + cw - 8, my, 1, ch, "#d9362e");
    px(ctx, mx + 8, cy - 5, 5, 10, "#8cc8f5");
    px(ctx, mx + cw - 13, cy - 5, 5, 10, "#8cc8f5");
    return canvas;
  }

  // Playground pad: wooden timber border enclosing warm tan woodchips/sand!
  px(ctx, 2, 2, w - 4, h - 4, "#1d2228");
  px(ctx, 3, 3, w - 6, h - 6, "#8a5a36"); // timber curb
  px(ctx, 5, 5, w - 10, h - 10, "#d9b982"); // warm mulch/sand play surface
  for (let y = 7; y < h - 7; y += 5) {
    for (let x = 7; x < w - 7; x += 7) {
      px(ctx, x, y, 2, 1, "#c49e66");
      px(ctx, x + 3, y + 2, 1, 1, "#ebd3a4");
    }
  }
  return canvas;
}
