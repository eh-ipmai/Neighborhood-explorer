/**
 * Universal HD Vector Road Geometry & Markings Engine (Option A).
 *
 * Works globally for ANY OpenStreetMap bounding box (zero city-specific hardcoding):
 *   - Extracts continuous floating-point OSM road centerlines, real lane counts,
 *     oneway flags, roundabouts, cul-de-sac turning circles, dual-carriageway
 *     highway medians, and angle-aligned pedestrian crosswalks.
 *   - Renders silky-smooth 4x HD curved asphalt, beveled granite curbs, crisp
 *     double-yellow dividers (two separate parallel stripes with a dark center gap),
 *     dashed white multi-lane separators, highway Jersey barriers, white stop bars,
 *     and true-angle continental zebra crosswalks onto offscreen ground chunks.
 *
 * Pure JS (zero DOM dependencies in geometry/extraction helpers; standard Canvas 2D
 * context in renderChunkRoads) so it runs in Node unit tests, Canvas 2D, and Kaplay WebGL.
 */

const METERS_PER_DEG_LAT = 111320;

const DRIVABLE_OSM_HIGHWAYS = new Set([
  "motorway",
  "trunk",
  "primary",
  "secondary",
  "tertiary",
  "motorway_link",
  "trunk_link",
  "primary_link",
  "secondary_link",
  "tertiary_link",
  "residential",
  "living_street",
  "unclassified",
]);

/**
 * Project geographic (lat, lon) into continuous floating-point tile coordinates.
 * North is -Y, East is +X. Matches scripts/build_map.mjs Equirectangular projection.
 */
export function projectLatLonToFloatTile(
  lat,
  lon,
  originLat,
  originLon,
  width,
  height,
  scaleMetersPerTile = 6
) {
  const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  const dxMeters = (lon - originLon) * metersPerDegLon;
  const dyMeters = (originLat - lat) * METERS_PER_DEG_LAT;
  return {
    x: width / 2 + dxMeters / scaleMetersPerTile,
    y: height / 2 + dyMeters / scaleMetersPerTile,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parsePositiveInt(val) {
  if (val === undefined || val === null) return 0;
  const n = parseInt(String(val).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isOnewayTag(tags = {}) {
  const ow = String(tags.oneway || "").toLowerCase();
  if (ow === "yes" || ow === "1" || ow === "true" || ow === "-1") return true;
  if (ow === "no" || ow === "0" || ow === "false") return false;
  if (tags.junction === "roundabout" || tags.junction === "circular") return true;
  if (tags.highway === "motorway" || tags.highway === "motorway_link") return true;
  return false;
}

function isHighwayRoadName(name = "") {
  const lower = String(name).toLowerCase();
  return (
    lower.includes("route 9") ||
    lower.includes("turnpike") ||
    lower.includes("expressway") ||
    lower.includes("highway") ||
    lower.includes("freeway") ||
    lower.includes("interstate")
  );
}

/**
 * Universally classify any OpenStreetMap highway way into physical road class,
 * lane layout, realistic carriageway width (in tiles), and MUTCD-accurate divider style.
 */
export function classifyVectorRoad(tags = {}, scaleMetersPerTile = 6) {
  const hw = String(tags.highway || "").toLowerCase();
  if (!DRIVABLE_OSM_HIGHWAYS.has(hw)) return null;

  const oneway = isOnewayTag(tags);
  const reverseOneway = String(tags.oneway || "").trim() === "-1";
  const roundabout = tags.junction === "roundabout" || tags.junction === "circular";
  const isLink = hw.endsWith("_link");

  let cls = "residential";
  if (
    hw === "motorway" ||
    hw === "trunk" ||
    hw === "motorway_link" ||
    hw === "trunk_link" ||
    (hw === "primary" && isHighwayRoadName(tags.name))
  ) {
    cls = "highway";
  } else if (
    hw === "primary" ||
    hw === "secondary" ||
    hw === "tertiary" ||
    hw === "primary_link" ||
    hw === "secondary_link" ||
    hw === "tertiary_link"
  ) {
    cls = "main";
  } else {
    cls = "residential";
  }

  const rawLanes = parsePositiveInt(tags.lanes);
  const rawFwd = parsePositiveInt(tags["lanes:forward"]);
  const rawBwd = parsePositiveInt(tags["lanes:backward"]);

  let lanes = rawLanes;
  if (!lanes && (rawFwd || rawBwd)) {
    lanes = rawFwd + rawBwd;
  }
  if (!lanes) {
    if (cls === "highway") lanes = oneway ? (isLink ? 1 : 2) : 4;
    else if (cls === "main") lanes = oneway ? (isLink ? 1 : 2) : 2;
    else lanes = oneway ? 1 : 2;
  }
  // Clamp extreme OSM turn-flare counts so roads stay clean and legible at neighborhood scale
  lanes = Math.max(1, Math.min(oneway ? 4 : 6, lanes));

  let lanesFwd = rawFwd;
  let lanesBwd = rawBwd;
  const hasExplicitSplit = rawFwd > 0 && rawBwd > 0;
  if (oneway) {
    lanesFwd = lanes;
    lanesBwd = 0;
  } else if (!lanesFwd && !lanesBwd) {
    // Keep untagged odd-lane roads (e.g. 3-lane avenues with a turn lane) symmetric around the
    // centerline so the double-yellow divider stays seamlessly aligned across OSM way seams!
    const perSide = Math.max(1, Math.floor(lanes / 2));
    lanesFwd = perSide;
    lanesBwd = perSide;
  } else if (!lanesFwd) {
    lanesFwd = Math.max(1, lanes - lanesBwd);
  } else if (!lanesBwd) {
    lanesBwd = Math.max(1, lanes - lanesFwd);
  }

  // Realistic paved carriageway width in meters (using real lane widths + realistic shoulders,
  // avoiding OSM's MassGIS right-of-way `width` values which include sidewalks & tree belts!)
  let widthMeters;
  if (cls === "highway") {
    const laneW = 3.5;
    const shoulder = oneway ? 1.8 : 2.0;
    widthMeters = Math.max(5.4, Math.min(18.0, lanes * laneW + shoulder));
  } else if (cls === "main") {
    const laneW = lanes >= 4 ? 3.2 : 3.45;
    const shoulder = oneway ? (lanes === 1 ? 1.4 : 1.5) : 1.9;
    widthMeters = Math.max(5.2, Math.min(16.0, lanes * laneW + shoulder));
  } else {
    // Residential / living street / unclassified
    if (oneway && lanes === 1) {
      widthMeters = 4.6;
    } else if (hw === "unclassified") {
      widthMeters = Math.max(6.8, Math.min(10.5, lanes * 3.2 + 1.2));
    } else {
      widthMeters = Math.max(6.4, Math.min(10.0, lanes * 3.1 + 1.0));
    }
  }

  // Real-world divider / centerline style (US / MUTCD + global OSM tags)
  const dividerTag = String(tags.divider || "").toLowerCase();
  const markingsTag = String(tags.lane_markings || "").toLowerCase();
  let divider = "none";

  if (markingsTag === "no") {
    divider = "none";
  } else if (roundabout) {
    divider = lanes >= 2 ? "oneway_multi" : "oneway_single";
  } else if (cls === "highway") {
    if (oneway) {
      divider = "highway_oneway";
    } else {
      divider = "double_yellow";
    }
  } else if (cls === "main") {
    if (oneway) {
      divider = lanes >= 2 ? "oneway_multi" : "oneway_single";
    } else if (dividerTag === "dashed_line") {
      divider = "dashed_yellow";
    } else {
      divider = "double_yellow";
    }
  } else {
    // Residential / unclassified
    if (oneway) {
      divider = lanes >= 2 ? "oneway_multi" : "oneway_single";
    } else if (dividerTag === "solid_line" || dividerTag === "double_solid_line") {
      divider = "double_yellow";
    } else if (
      hw === "unclassified" ||
      markingsTag === "yes" ||
      dividerTag === "dashed_line" ||
      lanes >= 3
    ) {
      divider = "dashed_yellow";
    } else {
      // Real suburban residential side streets stay clean unmarked asphalt!
      divider = "none";
    }
  }

  return {
    hw,
    cls,
    lanes,
    lanesFwd,
    lanesBwd,
    hasExplicitSplit,
    oneway,
    reverseOneway,
    roundabout,
    isLink,
    divider,
    widthTiles: round2(widthMeters / scaleMetersPerTile),
  };
}

/**
 * Lossless-visual Ramer-Douglas-Peucker simplification (default epsilon = 0.03 tiles ≈ 18 cm)
 * keeps every real road curve smooth while removing redundant collinear micro-vertices.
 */
function pointSegDistSq(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

export function simplifyFloatPolyline(pts, epsilon = 0.03) {
  if (!Array.isArray(pts) || pts.length <= 2) return pts ? pts.slice() : [];
  const epsSq = epsilon * epsilon;

  function rdp(arr, start, end, out) {
    let maxDistSq = -1;
    let maxIdx = -1;
    const a = arr[start];
    const b = arr[end];
    for (let i = start + 1; i < end; i++) {
      const dSq = pointSegDistSq(arr[i].x, arr[i].y, a.x, a.y, b.x, b.y);
      if (dSq > maxDistSq) {
        maxDistSq = dSq;
        maxIdx = i;
      }
    }
    if (maxDistSq > epsSq && maxIdx !== -1) {
      rdp(arr, start, maxIdx, out);
      out.pop();
      rdp(arr, maxIdx, end, out);
    } else {
      out.push(a, b);
    }
  }

  const out = [];
  rdp(pts, 0, pts.length - 1, out);
  return out;
}

/**
 * Offset a polyline perpendicularly by `offset` (in same coordinate units as pts).
 * Positive offset shifts to the RIGHT of travel direction (x -> -dy, y -> +dx in screen Y-down space:
 * wait: in screen Y-down space, travel east (1, 0) -> right is south (0, +1) = (-dy, +dx)!).
 * Miter lengths are clamped cleanly so acute corners never produce spikes.
 */
export function offsetPolyline(pts, offset) {
  const n = pts.length;
  if (n < 2) return pts.slice();
  if (Math.abs(offset) < 1e-6) return pts.map((p) => ({ x: p.x, y: p.y }));

  // Unit right-hand normals for each segment in screen Y-down coords:
  // For tangent (tx, ty), right-hand normal is (-ty, tx).
  // Check: East (1, 0) -> right is South (0, 1). North (0, -1) -> right is East (1, 0). Exact!
  const segNormals = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) {
      segNormals.push(segNormals.length > 0 ? segNormals[segNormals.length - 1] : { nx: 0, ny: 1 });
    } else {
      segNormals.push({ nx: -dy / len, ny: dx / len });
    }
  }

  const out = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      const { nx, ny } = segNormals[0];
      out.push({ x: pts[0].x + nx * offset, y: pts[0].y + ny * offset });
    } else if (i === n - 1) {
      const { nx, ny } = segNormals[n - 2];
      out.push({ x: pts[n - 1].x + nx * offset, y: pts[n - 1].y + ny * offset });
    } else {
      const n1 = segNormals[i - 1];
      const n2 = segNormals[i];
      let bx = n1.nx + n2.nx;
      let by = n1.ny + n2.ny;
      const bLen = Math.hypot(bx, by);
      if (bLen < 1e-5) {
        out.push({ x: pts[i].x + n1.nx * offset, y: pts[i].y + n1.ny * offset });
      } else {
        bx /= bLen;
        by /= bLen;
        const dot = Math.max(0.42, bx * n1.nx + by * n1.ny);
        const miter = Math.min(2.2, 1 / dot) * offset;
        out.push({ x: pts[i].x + bx * miter, y: pts[i].y + by * miter });
      }
    }
  }
  return out;
}

/**
 * Trim `trimStart` distance from the start and `trimEnd` distance from the end of a polyline.
 * Returns null if the polyline is shorter than trimStart + trimEnd.
 */
export function trimPolylineEnds(pts, trimStart = 0, trimEnd = 0) {
  if (!pts || pts.length < 2) return null;
  let totalLen = 0;
  const segLens = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLens.push(l);
    totalLen += l;
  }
  if (totalLen <= trimStart + trimEnd + 0.05) return null;

  const sliceStart = Math.max(0, trimStart);
  const sliceEnd = Math.max(sliceStart, totalLen - Math.max(0, trimEnd));
  const out = [];
  let acc = 0;

  for (let i = 0; i < pts.length - 1; i++) {
    const l = segLens[i];
    const nextAcc = acc + l;
    if (nextAcc >= sliceStart && acc <= sliceEnd && l > 1e-6) {
      const t0 = Math.max(0, (sliceStart - acc) / l);
      const t1 = Math.min(1, (sliceEnd - acc) / l);
      const p0 = {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t0,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t0,
      };
      const p1 = {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t1,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t1,
      };
      if (out.length === 0) out.push(p0);
      else {
        const last = out[out.length - 1];
        if (Math.hypot(p0.x - last.x, p0.y - last.y) > 1e-4) out.push(p0);
      }
      if (Math.hypot(p1.x - out[out.length - 1].x, p1.y - out[out.length - 1].y) > 1e-4) {
        out.push(p1);
      }
    }
    acc = nextAcc;
  }
  return out.length >= 2 ? out : null;
}

/**
 * Compute total Euclidean length of a polyline.
 */
function polylineLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  }
  return len;
}

/**
 * Sample a point and unit tangent at distance `dist` along a polyline.
 */
function samplePolylineAtDist(pts, dist) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const l = Math.hypot(dx, dy);
    if (l < 1e-6) continue;
    if (acc + l >= dist || i === pts.length - 2) {
      const t = Math.max(0, Math.min(1, (dist - acc) / l));
      return {
        x: pts[i].x + dx * t,
        y: pts[i].y + dy * t,
        tx: dx / l,
        ty: dy / l,
      };
    }
    acc += l;
  }
  return null;
}

/**
 * Project point (px, py) onto a polyline and return closest distance, tangent angle, and projected point.
 */
function projectPointToPolyline(px, py, pts) {
  let bestDistSq = Infinity;
  let bestAngle = 0;
  let bestX = px;
  let bestY = py;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x;
    const ay = pts[i].y;
    const bx = pts[i + 1].x;
    const by = pts[i + 1].y;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const dSq = (px - cx) * (px - cx) + (py - cy) * (py - cy);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestAngle = Math.atan2(dy, dx);
      bestX = cx;
      bestY = cy;
    }
  }
  return { dist: Math.sqrt(bestDistSq), angle: bestAngle, x: bestX, y: bestY };
}

/**
 * Automatically extract smooth concrete highway median strips between opposing
 * parallel one-way highway carriageways (universal: works on Route 9, interstates,
 * dual-carriageway boulevards anywhere on Earth!).
 */
function extractDualCarriagewayMedians(roads, crosswalks) {
  const hwOneWay = roads.filter((r) => r.cls === "highway" && r.oneway && !r.isLink && r.ptsObj.length >= 2);
  if (hwOneWay.length < 2) return [];

  const medians = [];
  const usedSamples = new Set();

  for (let i = 0; i < hwOneWay.length; i++) {
    const rA = hwOneWay[i];
    const lenA = polylineLength(rA.ptsObj);
    if (lenA < 2.0) continue;

    // Sample every 1.0 tile along carriageway A, looking for an opposing carriageway B to our LEFT
    // (In right-hand traffic like US/Europe, the median sits to the LEFT of a one-way carriageway!)
    const step = 1.0;
    let currentChain = [];

    const flushChain = () => {
      if (currentChain.length >= 3) {
        const simplified = simplifyFloatPolyline(currentChain, 0.05);
        const flat = [];
        for (const p of simplified) flat.push(round2(p.x), round2(p.y));
        medians.push({ pts: flat });
      }
      currentChain = [];
    };

    for (let d = 0.5; d <= lenA - 0.5; d += step) {
      const s = samplePolylineAtDist(rA.ptsObj, d);
      if (!s) continue;

      // Left-hand normal in screen Y-down coords:
      // East (1, 0) -> left is North (0, -1) = (ty, -tx)!
      const lnx = s.ty;
      const lny = -s.tx;

      // Skip right through crosswalks so median opens cleanly at pedestrian crossings
      let nearCross = false;
      for (let ci = 0; ci < crosswalks.length; ci++) {
        const cw = crosswalks[ci];
        if (Math.hypot(cw.x - s.x, cw.y - s.y) < 1.8) {
          nearCross = true;
          break;
        }
      }
      if (nearCross) {
        flushChain();
        continue;
      }

      // Look for an opposing highway carriageway within [1.1, 4.2] tiles to the LEFT
      let bestMatch = null;
      let bestDist = Infinity;
      for (let j = 0; j < hwOneWay.length; j++) {
        if (j === i) continue;
        const rB = hwOneWay[j];
        if (
          s.x < rB.bbox.minX - 4.5 ||
          s.x > rB.bbox.maxX + 4.5 ||
          s.y < rB.bbox.minY - 4.5 ||
          s.y > rB.bbox.maxY + 4.5
        ) {
          continue;
        }
        const proj = projectPointToPolyline(s.x, s.y, rB.ptsObj);
        if (proj.dist < 1.1 || proj.dist > 4.2) continue;
        // Must be roughly opposite travel direction (dot(tA, tB) < -0.75)
        const bx = Math.cos(proj.angle);
        const by = Math.sin(proj.angle);
        const dot = s.tx * bx + s.ty * by;
        if (dot > -0.75) continue;
        // Must actually be on our LEFT side
        const vx = proj.x - s.x;
        const vy = proj.y - s.y;
        const leftDot = (vx * lnx + vy * lny) / Math.max(1e-6, proj.dist);
        if (leftDot < 0.72) continue;
        if (proj.dist < bestDist) {
          bestDist = proj.dist;
          bestMatch = { x: (s.x + proj.x) * 0.5, y: (s.y + proj.y) * 0.5 };
        }
      }

      if (bestMatch) {
        const cellKey = `${Math.round(bestMatch.x * 0.8)},${Math.round(bestMatch.y * 0.8)}`;
        if (usedSamples.has(cellKey)) {
          flushChain();
        } else {
          usedSamples.add(cellKey);
          currentChain.push(bestMatch);
        }
      } else {
        flushChain();
      }
    }
    flushChain();
  }

  return medians;
}

/**
 * Extract the universal `vectorRoads` payload from raw OpenStreetMap elements
 * (supports both Overpass `way.geometry` AND OSM API 0.6 `way.nodes` + node elements).
 */
export function extractVectorRoadsFromOsm(
  elements,
  { width, height, mapCenter, origin, scaleMetersPerTile = 6 } = {}
) {
  const center = mapCenter || origin || { lat: 42.3292, lon: -71.1942 };
  const nodeMap = new Map();
  const crossingPts = [];
  const turningCirclePts = [];
  const rawWays = [];

  for (const el of elements || []) {
    if (!el) continue;
    if (el.type === "node") {
      nodeMap.set(el.id, el);
      const t = el.tags;
      if (t) {
        if (t.highway === "crossing" || t.crossing) {
          const p = projectLatLonToFloatTile(el.lat, el.lon, center.lat, center.lon, width, height, scaleMetersPerTile);
          if (p.x >= -2 && p.y >= -2 && p.x <= width + 2 && p.y <= height + 2) {
            crossingPts.push(p);
          }
        }
        if (t.highway === "turning_circle" || t.highway === "turning_loop") {
          const p = projectLatLonToFloatTile(el.lat, el.lon, center.lat, center.lon, width, height, scaleMetersPerTile);
          if (p.x >= -2 && p.y >= -2 && p.x <= width + 2 && p.y <= height + 2) {
            turningCirclePts.push({
              x: round2(p.x),
              y: round2(p.y),
              radiusTiles: t.highway === "turning_loop" ? 1.3 : 1.05,
            });
          }
        }
      }
    } else if (el.type === "way" && el.tags?.highway) {
      rawWays.push(el);
    }
  }

  const getWayFloatPts = (way) => {
    const out = [];
    if (Array.isArray(way.geometry) && way.geometry.length > 0) {
      for (const g of way.geometry) {
        out.push(projectLatLonToFloatTile(g.lat, g.lon, center.lat, center.lon, width, height, scaleMetersPerTile));
      }
    } else if (Array.isArray(way.nodes) && way.nodes.length > 0) {
      for (const nid of way.nodes) {
        const nd = nodeMap.get(nid);
        if (nd) {
          out.push(projectLatLonToFloatTile(nd.lat, nd.lon, center.lat, center.lon, width, height, scaleMetersPerTile));
        }
      }
    }
    return out;
  };

  // Extract drivable road polylines
  const internalRoads = [];
  for (const way of rawWays) {
    const tags = way.tags || {};
    if (tags.highway === "crossing" || tags.footway === "crossing") {
      const pts = getWayFloatPts(way);
      if (pts.length >= 2) {
        const mid = pts[Math.floor(pts.length / 2)];
        if (mid.x >= -2 && mid.y >= -2 && mid.x <= width + 2 && mid.y <= height + 2) {
          crossingPts.push(mid);
        }
      }
      continue;
    }

    const info = classifyVectorRoad(tags, scaleMetersPerTile);
    if (!info) continue;

    let pts = getWayFloatPts(way);
    if (pts.length < 2) continue;
    if (info.reverseOneway) pts = pts.reverse();

    // Check if any point is near the map bounds
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    if (maxX < -4 || minX > width + 4 || maxY < -4 || minY > height + 4) continue;

    const simplified = simplifyFloatPolyline(pts, 0.03);
    if (simplified.length < 2) continue;

    const flat = [];
    for (const p of simplified) {
      flat.push(round2(p.x), round2(p.y));
    }

    internalRoads.push({
      id: way.id ? `w${way.id}` : `w_${internalRoads.length}`,
      name: tags.name ? String(tags.name) : "",
      hw: info.hw,
      cls: info.cls,
      lanes: info.lanes,
      lanesFwd: info.lanesFwd,
      lanesBwd: info.lanesBwd,
      oneway: info.oneway,
      roundabout: info.roundabout,
      isLink: info.isLink,
      divider: info.divider,
      widthTiles: info.widthTiles,
      pts: flat,
      ptsObj: simplified,
      bbox: { minX, maxX, minY, maxY },
    });
  }

  // Snap crosswalks to nearest road segment so each crosswalk gets exact road angle & width,
  // and deduplicate close/stacked crosswalks within 1.15 tiles on the same road.
  const crosswalks = [];
  for (const cp of crossingPts) {
    let best = null;
    for (const r of internalRoads) {
      if (
        cp.x < r.bbox.minX - 1.5 ||
        cp.x > r.bbox.maxX + 1.5 ||
        cp.y < r.bbox.minY - 1.5 ||
        cp.y > r.bbox.maxY + 1.5
      ) {
        continue;
      }
      const proj = projectPointToPolyline(cp.x, cp.y, r.ptsObj);
      if (proj.dist <= 0.9 && (!best || proj.dist < best.dist)) {
        best = {
          dist: proj.dist,
          x: round2(proj.x),
          y: round2(proj.y),
          angle: round2(proj.angle),
          widthTiles: r.widthTiles,
          cls: r.cls,
        };
      }
    }
    if (!best) continue;
    const tooClose = crosswalks.some((prev) => Math.hypot(prev.x - best.x, prev.y - best.y) < 1.15);
    if (tooClose) continue;
    crosswalks.push({
      x: best.x,
      y: best.y,
      angle: best.angle,
      widthTiles: best.widthTiles,
      cls: best.cls,
    });
  }

  // Automatically extract curved concrete Jersey medians between parallel opposing highway ways
  const medians = extractDualCarriagewayMedians(internalRoads, crosswalks);

  // Clean serialized road objects (drop temporary ptsObj/bbox)
  const roads = internalRoads.map(({ ptsObj: _p, bbox: _b, isLink: _l, ...clean }) => clean);

  return {
    version: 1,
    roads,
    crosswalks,
    turningCircles: turningCirclePts,
    medians,
  };
}

/**
 * Build deterministic vectorRoads for the offline demo Newton Centre map.
 */
export function buildOfflineVectorRoads(worldMap) {
  const { width, height } = worldMap.dimensions;
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const boylstonY = cy + 4;
  const parkerX = cx - 10;
  const centreX = cx + 18;
  const wardY = cy - 22;

  const roads = [
    // Boylston St (Route 9) Westbound & Eastbound dual carriageways
    {
      id: "off_rt9_wb",
      name: "Boylston Street (Route 9)",
      hw: "trunk",
      cls: "highway",
      lanes: 2,
      lanesFwd: 2,
      lanesBwd: 0,
      oneway: true,
      roundabout: false,
      divider: "highway_oneway",
      widthTiles: 1.45,
      pts: [width - 1, boylstonY - 0.55, 0, boylstonY - 0.55],
    },
    {
      id: "off_rt9_eb",
      name: "Boylston Street (Route 9)",
      hw: "trunk",
      cls: "highway",
      lanes: 2,
      lanesFwd: 2,
      lanesBwd: 0,
      oneway: true,
      roundabout: false,
      divider: "highway_oneway",
      widthTiles: 1.45,
      pts: [0, boylstonY + 1.55, width - 1, boylstonY + 1.55],
    },
    // Centre Street (Main Town Avenue — double-yellow!)
    {
      id: "off_centre",
      name: "Centre Street",
      hw: "secondary",
      cls: "main",
      lanes: 2,
      lanesFwd: 1,
      lanesBwd: 1,
      oneway: false,
      roundabout: false,
      divider: "double_yellow",
      widthTiles: 1.55,
      pts: [centreX + 0.5, 0, centreX + 0.5, height - 1],
    },
    // Parker Street (Residential)
    {
      id: "off_parker",
      name: "Parker Street",
      hw: "residential",
      cls: "residential",
      lanes: 2,
      lanesFwd: 1,
      lanesBwd: 1,
      oneway: false,
      roundabout: false,
      divider: "none",
      widthTiles: 1.2,
      pts: [parkerX + 0.5, 32, parkerX + 0.5, height - 1],
    },
    // Ward Street (Collector — double-yellow)
    {
      id: "off_ward",
      name: "Ward Street",
      hw: "tertiary",
      cls: "main",
      lanes: 2,
      lanesFwd: 1,
      lanesBwd: 1,
      oneway: false,
      roundabout: false,
      divider: "double_yellow",
      widthTiles: 1.45,
      pts: [8, wardY + 0.5, width - 8, wardY + 0.5],
    },
  ];

  const crosswalks = [
    { x: parkerX + 0.5, y: boylstonY + 0.5, angle: 0, widthTiles: 3.1, cls: "highway" },
    { x: cx + 0.5, y: boylstonY + 0.5, angle: 0, widthTiles: 3.1, cls: "highway" },
    { x: centreX + 0.5, y: boylstonY + 0.5, angle: 0, widthTiles: 3.1, cls: "highway" },
  ];

  const medians = [
    { pts: [2, boylstonY + 0.5, parkerX - 1.5, boylstonY + 0.5] },
    { pts: [parkerX + 2.5, boylstonY + 0.5, cx - 1.5, boylstonY + 0.5] },
    { pts: [cx + 2.5, boylstonY + 0.5, centreX - 1.5, boylstonY + 0.5] },
    { pts: [centreX + 2.5, boylstonY + 0.5, width - 3, boylstonY + 0.5] },
  ];

  return {
    version: 1,
    roads,
    crosswalks,
    turningCircles: [],
    medians,
  };
}

// ============================================================================
// HD VECTOR ROAD RENDERER (4x HD / 1280x720 Chunk Baking + Spatial Indexing)
// ============================================================================

const ROAD_COLORS = {
  sidewalkApron: "#a89693",
  sidewalkBorder: "#7a6969",
  curbTop: "#dfd0c8",
  curbShadow: "#3d3135",
  asphaltResidential: "#565b66",
  asphaltMain: "#464b56",
  asphaltHighway: "#383d48",
  asphaltCrownHighlight: "rgba(255, 250, 240, 0.045)",
  yellowPaint: "#f4c438",
  yellowEdge: "rgba(244, 196, 56, 0.94)",
  whitePaint: "#f4f7fb",
  whiteShoulder: "rgba(242, 246, 250, 0.84)",
  stopBar: "rgba(246, 249, 252, 0.92)",
  crosswalkWhite: "#f4f7fb",
  crosswalkShadow: "rgba(24, 28, 36, 0.42)",
  medianShadow: "#2b303a",
  medianBody: "#b8bec8",
  medianTop: "#e6ebf2",
  medianReflector: "#f4c83a",
};

const CLASS_ORDER = { residential: 0, main: 1, highway: 2 };

function unpackPts(flat) {
  const pts = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    pts.push({ x: flat[i], y: flat[i + 1] });
  }
  return pts;
}

function strokePolyline(ctx, pts, originX, originY, pxPerTile) {
  if (!pts || pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo((pts[0].x - originX) * pxPerTile, (pts[0].y - originY) * pxPerTile);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo((pts[i].x - originX) * pxPerTile, (pts[i].y - originY) * pxPerTile);
  }
  ctx.stroke();
}

/**
 * Compute intersection setbacks for each road's start and end (and interior junctions)
 * so yellow centerlines & white lane dividers stop crisply outside intersection boxes!
 */
function buildJunctionGraph(parsedRoads) {
  // Quantize vertices to 0.35-tile buckets to detect shared road junction nodes
  const BUCKET = 0.35;
  const nodeMap = new Map();

  const registerNode = (x, y, roadIdx, widthTiles) => {
    const gx = Math.round(x / BUCKET);
    const gy = Math.round(y / BUCKET);
    const key = `${gx},${gy}`;
    let entry = nodeMap.get(key);
    if (!entry) {
      entry = { x, y, roads: new Set(), maxWidth: 0 };
      nodeMap.set(key, entry);
    }
    entry.roads.add(roadIdx);
    if (widthTiles > entry.maxWidth) entry.maxWidth = widthTiles;
  };

  for (let i = 0; i < parsedRoads.length; i++) {
    const r = parsedRoads[i];
    for (const p of r.pts) {
      registerNode(p.x, p.y, i, r.widthTiles);
    }
  }

  // Junctions = nodes where >= 2 distinct roads meet (or 3+ ways share a vertex)
  // Exclude simple two-way continuation where same-name, same-class road splits into 2 OSM ways at ~180°!
  const junctions = [];
  for (const entry of nodeMap.values()) {
    if (entry.roads.size < 2) continue;
    if (entry.roads.size === 2) {
      const [ia, ib] = Array.from(entry.roads);
      const ra = parsedRoads[ia];
      const rb = parsedRoads[ib];
      // If two segments of the exact same named road continue smoothly (even if lanes/class change mid-block),
      // don't punch a false junction gap into the yellow centerline!
      if (ra.name && ra.name === rb.name && ra.oneway === rb.oneway) {
        continue;
      }
    }
    junctions.push({
      x: entry.x,
      y: entry.y,
      radius: Math.max(0.55, entry.maxWidth * 0.56),
    });
  }

  return junctions;
}

/**
 * Split a polyline into clean sub-segments that lie OUTSIDE circular junction/crosswalk exclusion zones.
 * This guarantees yellow lines & white dashes NEVER scramble inside intersections or over zebra stripes!
 */
export function clipPolylineOutsideZones(pts, zones) {
  if (!pts || pts.length < 2) return [];
  if (!zones || zones.length === 0) return [pts];

  // Sample densely (~0.25 tiles) only when zones are nearby, then re-extract continuous outside runs
  const runs = [];
  let curRun = [];

  const isInsideAny = (x, y) => {
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      const dx = x - z.x;
      const dy = y - z.y;
      if (dx * dx + dy * dy <= z.rSq) return true;
    }
    return false;
  };

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-5) continue;

    // Fast skip if no zone is near this segment's bounding box
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    let anyNear = false;
    for (let zi = 0; zi < zones.length; zi++) {
      const z = zones[zi];
      if (z.x + z.r >= minX && z.x - z.r <= maxX && z.y + z.r >= minY && z.y - z.r <= maxY) {
        anyNear = true;
        break;
      }
    }

    if (!anyNear) {
      if (curRun.length === 0) curRun.push(a);
      curRun.push(b);
      continue;
    }

    const steps = Math.max(2, Math.ceil(segLen / 0.22));
    for (let s = 0; s <= steps; s++) {
      if (i > 0 && s === 0) continue;
      const t = s / steps;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      if (isInsideAny(px, py)) {
        if (curRun.length >= 2) runs.push(curRun);
        curRun = [];
      } else {
        curRun.push({ x: px, y: py });
      }
    }
  }
  if (curRun.length >= 2) runs.push(curRun);
  return runs;
}

/**
 * Create a fast spatially-indexed 4x HD Vector Road Renderer bound to `worldMap.vectorRoads`.
 * Supports regional road styles (US double-yellow vs Israel/Europe white centerlines)
 * and regional curb styles (granite vs Israeli blue-white / red-white painted limestone curbs!).
 */
export function createVectorRoadRenderer(worldMap, chunkTiles = 8, biomeConfig = null) {
  const vr = worldMap?.vectorRoads;
  if (!vr || !Array.isArray(vr.roads) || vr.roads.length === 0) {
    return {
      hasVectorRoads: () => false,
      renderChunkRoads: () => {},
      queryChunkRoads: () => [],
    };
  }
  const isIsraelRoad = biomeConfig?.roadStyle === "israel";
  const isIsraelCurb = biomeConfig?.curbStyle === "israel";
  const centerPaint = isIsraelRoad ? ROAD_COLORS.whitePaint : ROAD_COLORS.yellowPaint;
  const curbTopCol = isIsraelCurb ? "#f0e8d5" : ROAD_COLORS.curbTop;
  const curbShadowCol = isIsraelCurb ? "#6e6556" : ROAD_COLORS.curbShadow;

  const parsedRoads = vr.roads
    .map((r) => {
      const pts = unpackPts(r.pts || []);
      if (pts.length < 2) return null;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const pad = (r.widthTiles || 1.4) + 1.2;
      return {
        ...r,
        pts,
        bbox: { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad },
      };
    })
    .filter(Boolean);

  // Sort strictly by visual hierarchy: residential -> main -> highway
  parsedRoads.sort((a, b) => (CLASS_ORDER[a.cls] || 0) - (CLASS_ORDER[b.cls] || 0));

  const parsedMedians = (vr.medians || [])
    .map((m) => {
      const pts = unpackPts(m.pts || []);
      if (pts.length < 2) return null;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      return { pts, bbox: { minX: minX - 1, maxX: maxX + 1, minY: minY - 1, maxY: maxY + 1 } };
    })
    .filter(Boolean);

  const crosswalks = vr.crosswalks || [];
  const turningCircles = vr.turningCircles || [];
  const junctions = buildJunctionGraph(parsedRoads);

  // Build spatial chunk buckets so each chunk only touches local roads/crosswalks/junctions
  const roadBuckets = new Map();
  const medianBuckets = new Map();
  const crossBuckets = new Map();
  const circleBuckets = new Map();
  const junctionBuckets = new Map();

  const insertBox = (map, bbox, item) => {
    const cx0 = Math.floor(bbox.minX / chunkTiles);
    const cx1 = Math.floor(bbox.maxX / chunkTiles);
    const cy0 = Math.floor(bbox.minY / chunkTiles);
    const cy1 = Math.floor(bbox.maxY / chunkTiles);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const key = `${cx},${cy}`;
        let list = map.get(key);
        if (!list) {
          list = [];
          map.set(key, list);
        }
        list.push(item);
      }
    }
  };

  for (const r of parsedRoads) insertBox(roadBuckets, r.bbox, r);
  for (const m of parsedMedians) insertBox(medianBuckets, m.bbox, m);
  for (const cw of crosswalks) {
    const pad = (cw.widthTiles || 1.6) + 1.5;
    insertBox(crossBuckets, { minX: cw.x - pad, maxX: cw.x + pad, minY: cw.y - pad, maxY: cw.y + pad }, cw);
  }
  for (const tc of turningCircles) {
    const pad = (tc.radiusTiles || 1.1) + 1.5;
    insertBox(circleBuckets, { minX: tc.x - pad, maxX: tc.x + pad, minY: tc.y - pad, maxY: tc.y + pad }, tc);
  }
  for (const j of junctions) {
    const pad = j.radius + 1.2;
    insertBox(junctionBuckets, { minX: j.x - pad, maxX: j.x + pad, minY: j.y - pad, maxY: j.y + pad }, j);
  }

  function queryUnique(map, tx0, ty0, tx1, ty1) {
    const cx0 = Math.floor((tx0 - 2) / chunkTiles);
    const cx1 = Math.floor((tx1 + 2) / chunkTiles);
    const cy0 = Math.floor((ty0 - 2) / chunkTiles);
    const cy1 = Math.floor((ty1 + 2) / chunkTiles);
    const seen = new Set();
    const out = [];
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const list = map.get(`${cx},${cy}`);
        if (!list) continue;
        for (let i = 0; i < list.length; i++) {
          const it = list[i];
          if (seen.has(it)) continue;
          seen.add(it);
          out.push(it);
        }
      }
    }
    return out;
  }

  /**
   * Draw realistic lane markings along a single road's clean (non-intersection) runs!
   */
  function drawRoadMarkingsHD(ctx, road, runs, tx0, ty0, pxPerTile) {
    const wPx = road.widthTiles * pxPerTile;
    const halfW = road.widthTiles * 0.5;
    const scaleUnit = pxPerTile / 16; // = 4 at 4x HD!

    ctx.lineCap = "butt";
    ctx.lineJoin = "round";

    for (const run of runs) {
      if (run.length < 2) continue;

      if (road.divider === "highway_oneway") {
        // 1. Solid yellow LEFT edge line hugging the highway median barrier!
        //    (In screen Y-down coords, offsetPolyline negative = LEFT of travel direction!)
        const leftEdge = offsetPolyline(run, -(halfW - 0.14));
        ctx.strokeStyle = ROAD_COLORS.yellowEdge;
        ctx.lineWidth = Math.max(2, 0.95 * scaleUnit);
        ctx.setLineDash([]);
        strokePolyline(ctx, leftEdge, tx0, ty0, pxPerTile);

        // 2. Solid white RIGHT shoulder line!
        const rightEdge = offsetPolyline(run, halfW - 0.14);
        ctx.strokeStyle = ROAD_COLORS.whiteShoulder;
        ctx.lineWidth = Math.max(2, 0.85 * scaleUnit);
        ctx.setLineDash([]);
        strokePolyline(ctx, rightEdge, tx0, ty0, pxPerTile);

        // 3. Crisp dashed white lane separators between travel lanes (lanes - 1 dividers)!
        const laneCount = Math.max(2, road.lanes || 2);
        const usableW = road.widthTiles - 0.28;
        ctx.strokeStyle = ROAD_COLORS.whitePaint;
        ctx.lineWidth = Math.max(1.8, 0.8 * scaleUnit);
        ctx.setLineDash([8.5 * scaleUnit, 11.5 * scaleUnit]);
        for (let l = 1; l < laneCount; l++) {
          const offset = -usableW * 0.5 + (usableW * l) / laneCount;
          const lanePts = offsetPolyline(run, offset);
          strokePolyline(ctx, lanePts, tx0, ty0, pxPerTile);
        }
        ctx.setLineDash([]);
        continue;
      }

      if (road.divider === "double_yellow") {
        // 1. Subtle solid white outer edge lines on town avenues & undivided highways
        if (road.widthTiles >= 1.35) {
          const edgeOff = halfW - 0.13;
          ctx.strokeStyle = ROAD_COLORS.whiteShoulder;
          ctx.lineWidth = Math.max(1.6, 0.72 * scaleUnit);
          ctx.setLineDash([]);
          strokePolyline(ctx, offsetPolyline(run, -edgeOff), tx0, ty0, pxPerTile);
          strokePolyline(ctx, offsetPolyline(run, edgeOff), tx0, ty0, pxPerTile);
        }

        // 2. Crisp DOUBLE-YELLOW centerline: TWO genuinely distinct parallel golden-yellow
        //    stripes with a clean dark asphalt channel between them!
        //    For asymmetric 3-lane avenues (e.g. 2 forward + 1 backward), shift centerline slightly!
        const totalLanes = Math.max(2, (road.lanesFwd || 1) + (road.lanesBwd || 1));
        const usableW = road.widthTiles - 0.26;
        const centerShift =
          road.lanesFwd && road.lanesBwd && road.lanesFwd !== road.lanesBwd
            ? usableW * (0.5 - road.lanesFwd / totalLanes)
            : 0;

        // Gap between the two stripes (US double-yellow vs Israel crisp double/solid white!)
        const stripeHalfGap = Math.max(0.065, Math.min(0.095, road.widthTiles * 0.055));
        ctx.strokeStyle = centerPaint;
        ctx.lineWidth = Math.max(1.8, 0.78 * scaleUnit);
        ctx.setLineDash([]);
        strokePolyline(ctx, offsetPolyline(run, centerShift - stripeHalfGap), tx0, ty0, pxPerTile);
        strokePolyline(ctx, offsetPolyline(run, centerShift + stripeHalfGap), tx0, ty0, pxPerTile);

        // 3. Dashed white lane dividers ONLY when a direction has >= 2 lanes (e.g. 4-lane Newton Centre avenues!)
        ctx.strokeStyle = ROAD_COLORS.whitePaint;
        ctx.lineWidth = Math.max(1.6, 0.72 * scaleUnit);
        ctx.setLineDash([7.5 * scaleUnit, 10.5 * scaleUnit]);

        const fwdLanes = road.lanesFwd || Math.floor(totalLanes / 2);
        const bwdLanes = road.lanesBwd || Math.floor(totalLanes / 2);
        // Right side of travel = forward lanes (positive offset from centerShift to +usableW/2)
        if (fwdLanes >= 2) {
          const span = usableW * 0.5 - centerShift;
          for (let l = 1; l < fwdLanes; l++) {
            const off = centerShift + (span * l) / fwdLanes;
            strokePolyline(ctx, offsetPolyline(run, off), tx0, ty0, pxPerTile);
          }
        }
        // Left side of travel = backward lanes (negative offset from centerShift to -usableW/2)
        if (bwdLanes >= 2) {
          const span = usableW * 0.5 + centerShift;
          for (let l = 1; l < bwdLanes; l++) {
            const off = centerShift - (span * l) / bwdLanes;
            strokePolyline(ctx, offsetPolyline(run, off), tx0, ty0, pxPerTile);
          }
        }
        ctx.setLineDash([]);
        continue;
      }

      if (road.divider === "dashed_yellow") {
        // Single crisp dashed centerline (yellow in US, white in Israel/Europe)
        ctx.strokeStyle = centerPaint;
        ctx.lineWidth = Math.max(1.8, 0.82 * scaleUnit);
        ctx.setLineDash([8.0 * scaleUnit, 9.0 * scaleUnit]);
        strokePolyline(ctx, run, tx0, ty0, pxPerTile);
        ctx.setLineDash([]);
        continue;
      }

      if (road.divider === "oneway_multi") {
        // Multi-lane one-way town avenue (e.g. Newton Centre Langley Rd!): white edges + dashed white lane separators, NO yellow center!
        const edgeOff = halfW - 0.13;
        ctx.strokeStyle = ROAD_COLORS.whiteShoulder;
        ctx.lineWidth = Math.max(1.5, 0.68 * scaleUnit);
        ctx.setLineDash([]);
        strokePolyline(ctx, offsetPolyline(run, -edgeOff), tx0, ty0, pxPerTile);
        strokePolyline(ctx, offsetPolyline(run, edgeOff), tx0, ty0, pxPerTile);

        const laneCount = Math.max(2, road.lanes || 2);
        const usableW = road.widthTiles - 0.26;
        ctx.strokeStyle = ROAD_COLORS.whitePaint;
        ctx.lineWidth = Math.max(1.6, 0.72 * scaleUnit);
        ctx.setLineDash([7.5 * scaleUnit, 10.0 * scaleUnit]);
        for (let l = 1; l < laneCount; l++) {
          const off = -usableW * 0.5 + (usableW * l) / laneCount;
          strokePolyline(ctx, offsetPolyline(run, off), tx0, ty0, pxPerTile);
        }
        ctx.setLineDash([]);
        continue;
      }

      if (road.divider === "oneway_single" && wPx >= 36) {
        // Subtle crisp white edge accent on single-lane ramps/connectors
        const edgeOff = halfW - 0.13;
        ctx.strokeStyle = "rgba(242, 246, 250, 0.5)";
        ctx.lineWidth = Math.max(1.4, 0.55 * scaleUnit);
        ctx.setLineDash([]);
        strokePolyline(ctx, offsetPolyline(run, -edgeOff), tx0, ty0, pxPerTile);
        strokePolyline(ctx, offsetPolyline(run, edgeOff), tx0, ty0, pxPerTile);
      }
    }
  }

  /**
   * Render all vector roads, granite curbs, curved double-yellow & dashed-white dividers,
   * highway Jersey medians, turning circles, and true-angle zebra crosswalks onto a chunk canvas.
   */
  function renderChunkRoads(ctx, { tx0, ty0, tilesW, tilesH, tileSize = 16, scale = 4 }) {
    const tx1 = tx0 + tilesW - 1;
    const ty1 = ty0 + tilesH - 1;
    const pxPerTile = tileSize * scale;
    const scaleUnit = scale;

    const roads = queryUnique(roadBuckets, tx0, ty0, tx1, ty1);
    const localCrosswalks = queryUnique(crossBuckets, tx0, ty0, tx1, ty1);
    const localCircles = queryUnique(circleBuckets, tx0, ty0, tx1, ty1);
    const localMedians = queryUnique(medianBuckets, tx0, ty0, tx1, ty1);
    const localJunctions = queryUnique(junctionBuckets, tx0, ty0, tx1, ty1);

    if (roads.length === 0 && localCircles.length === 0 && localCrosswalks.length === 0) {
      return;
    }

    roads.sort((a, b) => (CLASS_ORDER[a.cls] || 0) - (CLASS_ORDER[b.cls] || 0));

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // --- LAYER 1: Beveled 3D Curb Outer Highlight (Granite or Jerusalem Limestone + Israeli Blue/White & Red/White Curbs!) ---
    ctx.strokeStyle = curbTopCol;
    for (const r of roads) {
      ctx.lineWidth = r.widthTiles * pxPerTile + 3.2 * scaleUnit;
      strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);
    }
    if (isIsraelCurb) {
      // Iconic Israeli alternating blue-and-white (residential parking) & red-and-white (no-parking main roads) curbs!
      ctx.save();
      ctx.lineCap = "butt";
      for (const r of roads) {
        if (r.cls === "highway") continue;
        const stripeCol = r.cls === "main" ? "#cc332b" : "#225eb5";
        ctx.lineWidth = r.widthTiles * pxPerTile + 3.0 * scaleUnit;
        ctx.strokeStyle = "#f7f5ef";
        ctx.setLineDash([]);
        strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);
        ctx.strokeStyle = stripeCol;
        ctx.setLineDash([5.5 * scaleUnit, 5.5 * scaleUnit]);
        strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.fillStyle = curbTopCol;
    for (const tc of localCircles) {
      ctx.beginPath();
      ctx.arc((tc.x - tx0) * pxPerTile, (tc.y - ty0) * pxPerTile, tc.radiusTiles * pxPerTile + 1.6 * scaleUnit, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- LAYER 2: Dark Curb Face & Gutter Shadow ---
    ctx.strokeStyle = curbShadowCol;
    for (const r of roads) {
      ctx.lineWidth = r.widthTiles * pxPerTile + 1.5 * scaleUnit;
      strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);
    }
    ctx.fillStyle = curbShadowCol;
    for (const tc of localCircles) {
      ctx.beginPath();
      ctx.arc((tc.x - tx0) * pxPerTile, (tc.y - ty0) * pxPerTile, tc.radiusTiles * pxPerTile + 0.75 * scaleUnit, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- LAYER 3: Smooth Asphalt Carriageways (residential -> main -> highway) ---
    for (const r of roads) {
      // Subtle dark curb gutter recess right inside road edge for rich 3D depth
      ctx.strokeStyle = "rgba(22, 24, 30, 0.34)";
      ctx.lineWidth = r.widthTiles * pxPerTile + 0.5 * scaleUnit;
      strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);

      ctx.strokeStyle =
        r.cls === "highway"
          ? ROAD_COLORS.asphaltHighway
          : r.cls === "main"
            ? ROAD_COLORS.asphaltMain
            : ROAD_COLORS.asphaltResidential;
      ctx.lineWidth = Math.max(2, r.widthTiles * pxPerTile - 0.5 * scaleUnit);
      strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);
    }
    ctx.fillStyle = ROAD_COLORS.asphaltResidential;
    for (const tc of localCircles) {
      ctx.beginPath();
      ctx.arc((tc.x - tx0) * pxPerTile, (tc.y - ty0) * pxPerTile, tc.radiusTiles * pxPerTile, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle sunlit asphalt road crown sheen along road centerlines for tactile depth
    ctx.strokeStyle = ROAD_COLORS.asphaltCrownHighlight;
    for (const r of roads) {
      ctx.lineWidth = Math.max(4, r.widthTiles * pxPerTile * 0.42);
      strokePolyline(ctx, r.pts, tx0, ty0, pxPerTile);
    }

    // --- LAYER 4: True-Angle Curved Yellow & White Lane Markings (strictly outside junctions & crosswalks!) ---
    const exclusionZones = [];
    for (const j of localJunctions) {
      const rad = j.radius * 0.92;
      exclusionZones.push({ x: j.x, y: j.y, r: rad, rSq: rad * rad });
    }
    for (const cw of localCrosswalks) {
      const rad = 0.72;
      exclusionZones.push({ x: cw.x, y: cw.y, r: rad, rSq: rad * rad });
    }
    for (const tc of localCircles) {
      const rad = tc.radiusTiles * 1.15;
      exclusionZones.push({ x: tc.x, y: tc.y, r: rad, rSq: rad * rad });
    }

    for (const r of roads) {
      if (r.divider === "none") continue;
      const cleanRuns = clipPolylineOutsideZones(r.pts, exclusionZones);
      if (cleanRuns.length === 0) continue;
      drawRoadMarkingsHD(ctx, r, cleanRuns, tx0, ty0, pxPerTile);
    }

    // --- LAYER 5: Smooth Curved Concrete Jersey Barriers along Divided Highways ---
    for (const m of localMedians) {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      // Dark asphalt/barrier drop shadow
      ctx.strokeStyle = ROAD_COLORS.medianShadow;
      ctx.lineWidth = 5.4 * scaleUnit;
      strokePolyline(ctx, m.pts, tx0, ty0, pxPerTile);
      // Sloped concrete Jersey barrier body
      ctx.strokeStyle = ROAD_COLORS.medianBody;
      ctx.lineWidth = 3.8 * scaleUnit;
      strokePolyline(ctx, m.pts, tx0, ty0, pxPerTile);
      // Sunlit concrete top crown
      ctx.strokeStyle = ROAD_COLORS.medianTop;
      ctx.lineWidth = 1.6 * scaleUnit;
      strokePolyline(ctx, m.pts, tx0, ty0, pxPerTile);
      // Crisp yellow reflective barrier markers spaced evenly along the top ridge
      ctx.strokeStyle = ROAD_COLORS.medianReflector;
      ctx.lineWidth = 1.1 * scaleUnit;
      ctx.setLineDash([2.0 * scaleUnit, 14.0 * scaleUnit]);
      strokePolyline(ctx, m.pts, tx0, ty0, pxPerTile);
      ctx.setLineDash([]);
    }

    // --- LAYER 6: True-Angle Continental Zebra Crosswalks & White Stop Bars ---
    for (const cw of localCrosswalks) {
      const cx = (cw.x - tx0) * pxPerTile;
      const cy = (cw.y - ty0) * pxPerTile;
      const roadW = Math.max(1.1, cw.widthTiles || 1.5) * pxPerTile;
      const bandDepth = 5.2 * scaleUnit; // crosswalk depth along road travel direction

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(cw.angle);

      // Subtle dark asphalt backing under zebra stripes so white bars always pop crisply
      ctx.fillStyle = ROAD_COLORS.crosswalkShadow;
      ctx.fillRect(-bandDepth * 0.56, -roadW * 0.48, bandDepth * 1.12, roadW * 0.96);

      // Parallel continental zebra bars spanning perpendicular to the road direction
      const barThick = 2.1 * scaleUnit;
      const barGap = 2.0 * scaleUnit;
      const pitch = barThick + barGap;
      const usableSpan = Math.max(barThick, roadW - 3.0 * scaleUnit);
      const barCount = Math.max(3, Math.floor((usableSpan + barGap) / pitch));
      const totalSpan = barCount * barThick + (barCount - 1) * barGap;
      const startY = -totalSpan * 0.5;

      ctx.fillStyle = ROAD_COLORS.crosswalkWhite;
      for (let b = 0; b < barCount; b++) {
        const by = startY + b * pitch;
        ctx.fillRect(-bandDepth * 0.5, by, bandDepth, barThick);
      }

      // Crisp white stop bars flanking main-avenue & highway crosswalks (right-hand approach side!)
      if (cw.cls === "main" || cw.cls === "highway") {
        const stopOffset = bandDepth * 0.5 + 3.2 * scaleUnit;
        const stopThick = 1.25 * scaleUnit;
        ctx.fillStyle = ROAD_COLORS.stopBar;
        // Approach stop bar on lower half (eastbound / forward) & upper half (westbound / backward)
        ctx.fillRect(-stopOffset - stopThick, 0.8 * scaleUnit, stopThick, roadW * 0.44 - 0.8 * scaleUnit);
        ctx.fillRect(stopOffset, -roadW * 0.44, stopThick, roadW * 0.44 - 0.8 * scaleUnit);
      }

      ctx.restore();
    }

    ctx.restore();
  }

  return {
    hasVectorRoads: () => true,
    renderChunkRoads,
    queryChunkRoads: (tx0, ty0, tilesW, tilesH) =>
      queryUnique(roadBuckets, tx0, ty0, tx0 + tilesW - 1, ty0 + tilesH - 1),
    roads: parsedRoads,
    crosswalks,
    turningCircles,
    medians: parsedMedians,
  };
}
