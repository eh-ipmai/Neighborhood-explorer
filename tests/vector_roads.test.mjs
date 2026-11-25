import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  classifyVectorRoad,
  extractVectorRoadsFromOsm,
  offsetPolyline,
  trimPolylineEnds,
  clipPolylineOutsideZones,
  createVectorRoadRenderer,
  buildOfflineVectorRoads,
} from "../src/vector_roads.js";
import { buildOfflineMap, rasterizeOsmData } from "../scripts/build_map.mjs";

test("classifyVectorRoad maps universal OSM road tags to realistic widths and MUTCD divider styles", () => {
  const hwOneWay = classifyVectorRoad({ highway: "trunk", oneway: "yes", lanes: "2", name: "Route 9" });
  assert.equal(hwOneWay.cls, "highway");
  assert.equal(hwOneWay.divider, "highway_oneway");
  assert.equal(hwOneWay.oneway, true);
  assert.equal(hwOneWay.lanes, 2);

  const townAve = classifyVectorRoad({ highway: "secondary", lanes: "2", name: "Centre Street" });
  assert.equal(townAve.cls, "main");
  assert.equal(townAve.divider, "double_yellow");
  assert.equal(townAve.lanesFwd, 1);
  assert.equal(townAve.lanesBwd, 1);

  const wideAve = classifyVectorRoad({ highway: "primary", lanes: "4", name: "Beacon Street" });
  assert.equal(wideAve.cls, "main");
  assert.equal(wideAve.divider, "double_yellow");
  assert.equal(wideAve.lanesFwd, 2);
  assert.equal(wideAve.lanesBwd, 2);
  assert.ok(wideAve.widthTiles > townAve.widthTiles, "4-lane avenue should be wider than 2-lane avenue");

  const oneWayAve = classifyVectorRoad({ highway: "tertiary", oneway: "yes", lanes: "2", name: "Langley Road" });
  assert.equal(oneWayAve.cls, "main");
  assert.equal(oneWayAve.divider, "oneway_multi");

  const quietRes = classifyVectorRoad({ highway: "residential", lanes: "2", name: "Jackson Street" });
  assert.equal(quietRes.cls, "residential");
  assert.equal(quietRes.divider, "none");

  const collectorRes = classifyVectorRoad({ highway: "unclassified", lanes: "2" });
  assert.equal(collectorRes.cls, "residential");
  assert.equal(collectorRes.divider, "dashed_yellow");

  assert.equal(classifyVectorRoad({ highway: "footway" }), null, "footways are not drivable vector roads");
});

test("offsetPolyline, trimPolylineEnds, and clipPolylineOutsideZones compute accurate parallel double-yellow curves", () => {
  // Diagonal 45-degree road from (0,0) to (10,10)
  const diag = [
    { x: 0, y: 0 },
    { x: 10, y: 10 },
  ];
  const left = offsetPolyline(diag, -1);
  const right = offsetPolyline(diag, 1);
  // Parallel lines must stay exactly 2.0 units apart along the entire diagonal!
  const distStart = Math.hypot(right[0].x - left[0].x, right[0].y - left[0].y);
  const distEnd = Math.hypot(right[1].x - left[1].x, right[1].y - left[1].y);
  assert.ok(Math.abs(distStart - 2.0) < 1e-4, `expected parallel offset 2.0, got ${distStart}`);
  assert.ok(Math.abs(distEnd - 2.0) < 1e-4, `expected parallel offset 2.0, got ${distEnd}`);

  // Trim 2 units from both ends of a 10-unit horizontal road
  const trimmed = trimPolylineEnds([{ x: 0, y: 5 }, { x: 10, y: 5 }], 2, 2);
  assert.ok(trimmed && trimmed.length === 2);
  assert.ok(Math.abs(trimmed[0].x - 2) < 1e-4);
  assert.ok(Math.abs(trimmed[1].x - 8) < 1e-4);

  // Clip around a central intersection zone at (5,5) radius 1.5 -> splits into 2 clean non-overlapping runs!
  const runs = clipPolylineOutsideZones(
    [{ x: 0, y: 5 }, { x: 10, y: 5 }],
    [{ x: 5, y: 5, r: 1.5, rSq: 2.25 }]
  );
  assert.equal(runs.length, 2, "intersection zone in the middle must cleanly split centerline into 2 runs");
  assert.ok(runs[0][runs[0].length - 1].x <= 3.6, "first run must stop before intersection");
  assert.ok(runs[1][0].x >= 6.4, "second run must resume after intersection");
});

test("extractVectorRoadsFromOsm preserves curved polylines, dual-carriageway medians, turning circles, and angled crosswalks", () => {
  const originLat = 42.32;
  const originLon = -71.19;
  // Synthetic curved avenue + opposing one-way divided highway pair + crosswalk + cul-de-sac
  const elements = [
    {
      type: "way",
      id: 1,
      tags: { highway: "secondary", name: "Curvy Ave", lanes: "2" },
      geometry: [
        { lat: originLat, lon: originLon - 0.001 },
        { lat: originLat + 0.0003, lon: originLon },
        { lat: originLat + 0.0001, lon: originLon + 0.001 },
      ],
    },
    {
      type: "way",
      id: 2,
      tags: { highway: "trunk", name: "Route 9", oneway: "yes", lanes: "2" },
      geometry: [
        { lat: originLat - 0.0005, lon: originLon - 0.0012 },
        { lat: originLat - 0.0005, lon: originLon + 0.0012 },
      ],
    },
    {
      type: "way",
      id: 3,
      tags: { highway: "trunk", name: "Route 9", oneway: "yes", lanes: "2" },
      geometry: [
        { lat: originLat - 0.00038, lon: originLon + 0.0012 },
        { lat: originLat - 0.00038, lon: originLon - 0.0012 },
      ],
    },
    {
      type: "node",
      id: 100,
      lat: originLat + 0.0003,
      lon: originLon,
      tags: { highway: "crossing" },
    },
    {
      type: "node",
      id: 101,
      lat: originLat + 0.0008,
      lon: originLon - 0.0005,
      tags: { highway: "turning_circle" },
    },
  ];

  const vr = extractVectorRoadsFromOsm(elements, {
    width: 128,
    height: 128,
    mapCenter: { lat: originLat, lon: originLon },
    scaleMetersPerTile: 6,
  });

  assert.equal(vr.roads.length, 3);
  const curvy = vr.roads.find((r) => r.name === "Curvy Ave");
  assert.ok(curvy && curvy.pts.length === 6, "curved road must keep all 3 continuous floating-point vertices");
  assert.equal(curvy.divider, "double_yellow");
  assert.equal(vr.crosswalks.length, 1, "crossing node should snap onto Curvy Ave with tangent angle");
  assert.equal(vr.turningCircles.length, 1, "turning_circle node should be preserved");
  assert.ok(vr.medians.length >= 1, "opposing parallel trunk ways must auto-extract a divided-highway median");

  // Also verify rasterizeOsmData & buildOfflineMap automatically attach vectorRoads
  const mapFromOsm = rasterizeOsmData(elements, {
    width: 64,
    height: 64,
    scaleMetersPerTile: 6,
    origin: { lat: originLat, lon: originLon, name: "Test" },
  });
  assert.ok(mapFromOsm.vectorRoads?.roads?.length === 3);

  const offline = buildOfflineMap();
  assert.ok(offline.vectorRoads?.roads?.length >= 4);
  assert.ok(offline.vectorRoads?.medians?.length >= 2);
});

test("live data/world_map.json contains real-geometry OSM vectorRoads and renders cleanly onto 4x HD chunk context", () => {
  const worldMap = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), "data", "world_map.json"), "utf8")
  );
  const vr = worldMap.vectorRoads;
  assert.ok(vr && Array.isArray(vr.roads), "world_map.json must include vectorRoads");
  assert.ok(vr.roads.length >= 500, `expected >= 500 real OSM vector roads in Newton (got ${vr.roads.length})`);
  assert.ok(vr.crosswalks.length >= 200, `expected >= 200 angle-aligned crosswalks (got ${vr.crosswalks.length})`);
  assert.ok(vr.turningCircles.length >= 15, `expected >= 15 cul-de-sac turning circles (got ${vr.turningCircles.length})`);
  assert.ok(vr.medians.length >= 20, `expected >= 20 divided-highway median segments (got ${vr.medians.length})`);

  const dividers = new Set(vr.roads.map((r) => r.divider));
  assert.ok(dividers.has("double_yellow"), "must include double_yellow avenues");
  assert.ok(dividers.has("highway_oneway"), "must include highway_oneway divided carriageways");
  assert.ok(dividers.has("oneway_multi"), "must include multi-lane one-way avenues");
  assert.ok(dividers.has("none"), "must include clean unmarked residential side streets");

  // Dry-run the 4x HD chunk renderer on Newton Centre Square (tx=244..252, ty=232..240) using a mock Canvas 2D ctx
  const renderer = createVectorRoadRenderer(worldMap, 8);
  assert.equal(renderer.hasVectorRoads(), true);
  let strokes = 0;
  let yellowStrokes = 0;
  let whiteStrokes = 0;
  let rects = 0;
  const mockCtx = {
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    imageSmoothingEnabled: false,
    save() {},
    restore() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    translate() {},
    rotate() {},
    setLineDash() {},
    fillRect() { rects++; },
    stroke() {
      strokes++;
      if (String(this.strokeStyle).includes("f4c438") || String(this.strokeStyle).includes("244, 196, 56")) {
        yellowStrokes++;
      }
      if (String(this.strokeStyle).includes("f4f7fb") || String(this.strokeStyle).includes("242, 246, 250")) {
        whiteStrokes++;
      }
    },
  };

  renderer.renderChunkRoads(mockCtx, { tx0: 244, ty0: 232, tilesW: 8, tilesH: 8, tileSize: 16, scale: 4 });
  assert.ok(strokes > 20, `Newton Centre Square chunk should render rich vector road strokes (got ${strokes})`);
  assert.ok(yellowStrokes >= 4, `Newton Centre Square chunk should render curved double-yellow dividers (got ${yellowStrokes})`);
  assert.ok(whiteStrokes >= 2, `Newton Centre Square chunk should render white edge/lane lines (got ${whiteStrokes})`);
  assert.ok(rects >= 4, `Newton Centre Square chunk should render angle-aligned zebra crosswalk bars (got ${rects})`);

  // Also check buildOfflineVectorRoads helper directly
  const offVr = buildOfflineVectorRoads(buildOfflineMap());
  assert.ok(offVr.roads.length >= 4);
});
