/**
 * Crisp, Clean Road & Lane Marking Geometry Engine (Pure JS, zero DOM).
 *
 * Designed around real Newton, MA road hierarchy — because clean roads & street signs
 * are the heart of Neighborhood Explorer:
 *   1. Highway (tileId 12 + concrete barrier 13 — Route 9 / Boylston St & Hammond Pond Pkwy):
 *        - 2 distinct travel lanes on EACH side of the concrete barrier, separated by crisp
 *          dashed white lane separators, with solid white outer shoulders and yellow inner lines
 *          hugging the concrete Jersey barrier.
 *   2. Town Avenues (tileId 3 — Centre St, Beacon St, Langley Rd, Cypress St, Walnut St, etc.):
 *        - Most avenues (2–3 tiles wide): 1 lane going each direction, separated by a crisp
 *          double-yellow centerline + clean white outer edge lines.
 *        - Select wide roads right in Newton Centre (4–5 tiles wide): 2 lanes going each
 *          direction, with a crisp double-yellow centerline AND dashed white lane separators.
 *   3. Residential Side Streets (tileId 2):
 *        - Clean asphalt, thin dark curb borders (no heavy white shoulder clutter), and a
 *          SINGLE crisp yellow centerline (dotted along straight stretches, solid approaching
 *          corners, intersections & crosswalks) between the single lane going each direction.
 *   4. Intersections:
 *        - Clean unobstructed asphalt inside intersection boxes so lines never scramble.
 */

function isAnyRoadTile(id) {
  return id === 2 || id === 3 || id === 4 || id === 12 || id === 13;
}

function isDrivableRoad(id) {
  return id === 2 || id === 3 || id === 4 || id === 12;
}

function addDashedLine(marks, axis, fixedPos, kind = "white_dash", thickness = 1) {
  // Crisp centered 8px dash on every 16px tile -> clean rhythmic 8px on / 8px off lane line!
  if (axis === "ew") {
    marks.push({ x: 4, y: fixedPos, w: 8, h: thickness, kind });
  } else {
    marks.push({ x: fixedPos, y: 4, w: thickness, h: 8, kind });
  }
}

function addSolidLine(marks, axis, fixedPos, kind = "yellow_solid", thickness = 1) {
  if (axis === "ew") {
    marks.push({ x: 0, y: fixedPos, w: 16, h: thickness, kind });
  } else {
    marks.push({ x: fixedPos, y: 0, w: thickness, h: 16, kind });
  }
}

function addDottedYellowLine(marks, axis, fixedPos, thickness = 1) {
  // Clean 10px yellow dash / 6px clean gap on every 16px side-street tile!
  if (axis === "ew") {
    marks.push({ x: 3, y: fixedPos, w: 10, h: thickness, kind: "yellow_dash" });
  } else {
    marks.push({ x: fixedPos, y: 3, w: thickness, h: 10, kind: "yellow_dash" });
  }
}

/**
 * Compute all crisp marking rectangles (in 16x16 tile-local px) for road tiles 2, 3, or 12.
 *
 * @param {(x: number, y: number) => number} tileAt
 * @param {number} tx
 * @param {number} ty
 * @returns {Array<{x: number, y: number, w: number, h: number, kind: string}>}
 */
export function computeRoadTileMarkings(tileAt, tx, ty) {
  const tileId = tileAt(tx, ty);
  if (tileId !== 2 && tileId !== 3 && tileId !== 12) return [];

  const n = tileAt(tx, ty - 1);
  const s = tileAt(tx, ty + 1);
  const w = tileAt(tx - 1, ty);
  const e = tileAt(tx + 1, ty);

  const nRoad = isAnyRoadTile(n);
  const sRoad = isAnyRoadTile(s);
  const wRoad = isAnyRoadTile(w);
  const eRoad = isAnyRoadTile(e);

  const marks = [];

  const nwOuter = !nRoad && !wRoad && sRoad && eRoad;
  const neOuter = !nRoad && !eRoad && sRoad && wRoad;
  const swOuter = !sRoad && !wRoad && nRoad && eRoad;
  const seOuter = !sRoad && !eRoad && nRoad && wRoad;
  const pushEdge = (side, inset, kind) => {
    if (side === "n") {
      const x0 = nwOuter ? 4 : 0;
      const x1 = neOuter ? 12 : 16;
      marks.push({ x: x0, y: inset, w: x1 - x0, h: 1, kind });
    } else if (side === "s") {
      const x0 = swOuter ? 4 : 0;
      const x1 = seOuter ? 12 : 16;
      marks.push({ x: x0, y: 15 - inset, w: x1 - x0, h: 1, kind });
    } else if (side === "w") {
      const y0 = nwOuter ? 4 : 0;
      const y1 = swOuter ? 12 : 16;
      marks.push({ x: inset, y: y0, w: 1, h: y1 - y0, kind });
    } else if (side === "e") {
      const y0 = neOuter ? 4 : 0;
      const y1 = seOuter ? 12 : 16;
      marks.push({ x: 15 - inset, y: y0, w: 1, h: y1 - y0, kind });
    }
  };

  // =========================================================================
  // 1. MAJOR HIGHWAY (tileId === 12): 2 lanes on EACH side of barrier (13)
  //    with crisp dashed white lane separators + clean white outer shoulders!
  // =========================================================================
  if (tileId === 12) {
    // Clean 1px dark outer curb + crisp 1px white outer shoulder line (trimmed smoothly at rounded corners!)
    if (!nRoad) {
      pushEdge("n", 0, "curb");
      pushEdge("n", 1, "shoulder");
    }
    if (!sRoad) {
      pushEdge("s", 0, "curb");
      pushEdge("s", 1, "shoulder");
    }
    if (!wRoad) {
      pushEdge("w", 0, "curb");
      pushEdge("w", 1, "shoulder");
    }
    if (!eRoad) {
      pushEdge("e", 0, "curb");
      pushEdge("e", 1, "shoulder");
    }

    // Locate nearest concrete median barrier (13) vertically or horizontally (within 4 tiles)
    let barrierNorth = 0;
    let barrierSouth = 0;
    for (let d = 1; d <= 4; d++) {
      if (!barrierNorth && tileAt(tx, ty - d) === 13) barrierNorth = d;
      if (!barrierSouth && tileAt(tx, ty + d) === 13) barrierSouth = d;
    }
    let barrierWest = 0;
    let barrierEast = 0;
    for (let d = 1; d <= 4; d++) {
      if (!barrierWest && tileAt(tx - d, ty) === 13) barrierWest = d;
      if (!barrierEast && tileAt(tx + d, ty) === 13) barrierEast = d;
    }

    // Determine highway axis ("ew" vs "ns")
    const hasEwBarrier = barrierNorth > 0 || barrierSouth > 0;
    const hasNsBarrier = barrierWest > 0 || barrierEast > 0;
    let axis = "ew";
    if (hasEwBarrier && !hasNsBarrier) {
      axis = "ew";
    } else if (hasNsBarrier && !hasEwBarrier) {
      axis = "ns";
    } else {
      let spanH = 1;
      for (let d = 1; d <= 5 && (tileAt(tx - d, ty) === 12 || tileAt(tx - d, ty) === 4); d++) spanH++;
      for (let d = 1; d <= 5 && (tileAt(tx + d, ty) === 12 || tileAt(tx + d, ty) === 4); d++) spanH++;
      let spanV = 1;
      for (let d = 1; d <= 5 && (tileAt(tx, ty - d) === 12 || tileAt(tx, ty - d) === 4); d++) spanV++;
      for (let d = 1; d <= 5 && (tileAt(tx, ty + d) === 12 || tileAt(tx, ty + d) === 4); d++) spanV++;
      axis = spanH >= spanV ? "ew" : "ns";
    }

    if (axis === "ew" && hasEwBarrier) {
      // Divided E-W Highway: measure consecutive highway tiles on THIS side of the barrier!
      const sideDir =
        barrierSouth > 0 && (barrierNorth === 0 || barrierSouth <= barrierNorth) ? -1 : 1;
      const distToBarrier = sideDir < 0 ? barrierSouth : barrierNorth;
      const barrierY = ty - sideDir * distToBarrier;
      const idxFromBarrier = distToBarrier - 1; // 0 = inner passing lane, 1 = outer travel lane

      let sideTiles = 0;
      for (let step = 1; step <= 4; step++) {
        const t = tileAt(tx, barrierY + sideDir * step);
        if (t === 12) sideTiles++;
        else break;
      }

      // Crisp yellow inner line hugging the concrete Jersey barrier
      if (idxFromBarrier === 0) {
        addSolidLine(marks, "ew", sideDir < 0 ? 15 : 0, "yellow_solid", 1);
      }

      // 2 lanes on THIS side of the barrier, separated by a crisp dashed white line!
      if (sideTiles === 1) {
        // Single-tile carriageway: split cleanly down the middle into 2 distinct lanes!
        addDashedLine(marks, "ew", 7, "white_dash", 1);
      } else {
        // 2+ tile carriageway: crisp dashed white separator right on the seam between inner & outer lane!
        const innerSplit = Math.floor(sideTiles / 2) - 1; // 0 for 2 or 3 tiles; 1 for 4 tiles
        if (idxFromBarrier === innerSplit) {
          addDashedLine(marks, "ew", sideDir < 0 ? 0 : 15, "white_dash", 1);
        } else if (idxFromBarrier === innerSplit + 1) {
          addDashedLine(marks, "ew", sideDir < 0 ? 15 : 0, "white_dash", 1);
        }
      }
      return marks;
    }

    if (axis === "ns" && hasNsBarrier) {
      // Divided N-S Highway: exact vertical mirror!
      const sideDir =
        barrierEast > 0 && (barrierWest === 0 || barrierEast <= barrierWest) ? -1 : 1;
      const distToBarrier = sideDir < 0 ? barrierEast : barrierWest;
      const barrierX = tx - sideDir * distToBarrier;
      const idxFromBarrier = distToBarrier - 1;

      let sideTiles = 0;
      for (let step = 1; step <= 4; step++) {
        const t = tileAt(barrierX + sideDir * step, ty);
        if (t === 12) sideTiles++;
        else break;
      }

      if (idxFromBarrier === 0) {
        addSolidLine(marks, "ns", sideDir < 0 ? 15 : 0, "yellow_solid", 1);
      }
      if (sideTiles === 1) {
        addDashedLine(marks, "ns", 7, "white_dash", 1);
      } else {
        const innerSplit = Math.floor(sideTiles / 2) - 1;
        if (idxFromBarrier === innerSplit) {
          addDashedLine(marks, "ns", sideDir < 0 ? 0 : 15, "white_dash", 1);
        } else if (idxFromBarrier === innerSplit + 1) {
          addDashedLine(marks, "ns", sideDir < 0 ? 15 : 0, "white_dash", 1);
        }
      }
      return marks;
    }

    // Undivided Highway section (e.g., opening near crosswalk or curved highway without barrier):
    // Check if inside a full cross-street junction box -> keep interior clean!
    let perpUp = 0;
    let perpDown = 0;
    if (axis === "ew") {
      for (let d = 1; d <= 5 && tileAt(tx, ty - d) === 12; d++) perpUp++;
      for (let d = 1; d <= 5 && tileAt(tx, ty + d) === 12; d++) perpDown++;
      const topY = ty - perpUp;
      const botY = ty + perpDown;
      const topCross = tileAt(tx, topY - 1);
      const botCross = tileAt(tx, botY + 1);
      const isCrossJunction =
        (topCross === 2 || topCross === 3 || topCross === 4) &&
        (botCross === 2 || botCross === 3 || botCross === 4);
      if (isCrossJunction) return marks;

      const total = perpUp + 1 + perpDown;
      const idx = perpUp;
      if (total === 2) {
        if (idx === 0) {
          addSolidLine(marks, "ew", 14, "yellow_solid", 1);
          addDashedLine(marks, "ew", 7, "white_dash", 1);
        } else {
          addSolidLine(marks, "ew", 1, "yellow_solid", 1);
          addDashedLine(marks, "ew", 8, "white_dash", 1);
        }
      } else if (total === 3) {
        if (idx === 1) {
          addSolidLine(marks, "ew", 6, "yellow_solid", 1);
          addSolidLine(marks, "ew", 9, "yellow_solid", 1);
        } else if (idx === 0) {
          addDashedLine(marks, "ew", 7, "white_dash", 1);
        } else if (idx === 2) {
          addDashedLine(marks, "ew", 8, "white_dash", 1);
        }
      } else if (total >= 4 && total <= 6) {
        const mid = Math.floor(total / 2);
        if (total % 2 === 0) {
          if (idx === mid - 1) addSolidLine(marks, "ew", 14, "yellow_solid", 1);
          if (idx === mid) addSolidLine(marks, "ew", 1, "yellow_solid", 1);
          // 2 lanes on each side of centerline
          if (idx === 0) addDashedLine(marks, "ew", 15, "white_dash", 1);
          if (idx === 1) addDashedLine(marks, "ew", 0, "white_dash", 1);
          if (idx === total - 2) addDashedLine(marks, "ew", 15, "white_dash", 1);
          if (idx === total - 1) addDashedLine(marks, "ew", 0, "white_dash", 1);
        } else {
          if (idx === mid) {
            addSolidLine(marks, "ew", 6, "yellow_solid", 1);
            addSolidLine(marks, "ew", 9, "yellow_solid", 1);
          }
          if (idx === 0) addDashedLine(marks, "ew", 15, "white_dash", 1);
          if (idx === 1) addDashedLine(marks, "ew", 0, "white_dash", 1);
          if (idx === total - 2) addDashedLine(marks, "ew", 15, "white_dash", 1);
          if (idx === total - 1) addDashedLine(marks, "ew", 0, "white_dash", 1);
        }
      }
    } else {
      for (let d = 1; d <= 5 && tileAt(tx - d, ty) === 12; d++) perpUp++;
      for (let d = 1; d <= 5 && tileAt(tx + d, ty) === 12; d++) perpDown++;
      const leftX = tx - perpUp;
      const rightX = tx + perpDown;
      const leftCross = tileAt(leftX - 1, ty);
      const rightCross = tileAt(rightX + 1, ty);
      const isCrossJunction =
        (leftCross === 2 || leftCross === 3 || leftCross === 4) &&
        (rightCross === 2 || rightCross === 3 || rightCross === 4);
      if (isCrossJunction) return marks;

      const total = perpUp + 1 + perpDown;
      const idx = perpUp;
      if (total === 2) {
        if (idx === 0) {
          addSolidLine(marks, "ns", 14, "yellow_solid", 1);
          addDashedLine(marks, "ns", 7, "white_dash", 1);
        } else {
          addSolidLine(marks, "ns", 1, "yellow_solid", 1);
          addDashedLine(marks, "ns", 8, "white_dash", 1);
        }
      } else if (total === 3) {
        if (idx === 1) {
          addSolidLine(marks, "ns", 6, "yellow_solid", 1);
          addSolidLine(marks, "ns", 9, "yellow_solid", 1);
        } else if (idx === 0) {
          addDashedLine(marks, "ns", 7, "white_dash", 1);
        } else if (idx === 2) {
          addDashedLine(marks, "ns", 8, "white_dash", 1);
        }
      } else if (total >= 4 && total <= 6) {
        const mid = Math.floor(total / 2);
        if (total % 2 === 0) {
          if (idx === mid - 1) addSolidLine(marks, "ns", 14, "yellow_solid", 1);
          if (idx === mid) addSolidLine(marks, "ns", 1, "yellow_solid", 1);
          if (idx === 0) addDashedLine(marks, "ns", 15, "white_dash", 1);
          if (idx === 1) addDashedLine(marks, "ns", 0, "white_dash", 1);
          if (idx === total - 2) addDashedLine(marks, "ns", 15, "white_dash", 1);
          if (idx === total - 1) addDashedLine(marks, "ns", 0, "white_dash", 1);
        } else {
          if (idx === mid) {
            addSolidLine(marks, "ns", 6, "yellow_solid", 1);
            addSolidLine(marks, "ns", 9, "yellow_solid", 1);
          }
          if (idx === 0) addDashedLine(marks, "ns", 15, "white_dash", 1);
          if (idx === 1) addDashedLine(marks, "ns", 0, "white_dash", 1);
          if (idx === total - 2) addDashedLine(marks, "ns", 15, "white_dash", 1);
          if (idx === total - 1) addDashedLine(marks, "ns", 0, "white_dash", 1);
        }
      }
    }
    return marks;
  }

  // =========================================================================
  // 2. RESIDENTIAL SIDE STREETS (tileId === 2):
  //    Clean asphalt, thin dark curb borders, and a SINGLE crisp yellow
  //    centerline (dotted on straightaways, solid near corners/crosswalks)
  //    between the single lane going in each direction!
  // =========================================================================
  if (tileId === 2) {
    if (!nRoad) pushEdge("n", 0, "curb");
    if (!sRoad) pushEdge("s", 0, "curb");
    if (!wRoad) pushEdge("w", 0, "curb");
    if (!eRoad) pushEdge("e", 0, "curb");

    let left = 0;
    let right = 0;
    let up = 0;
    let down = 0;
    for (let d = 1; d <= 4 && isDrivableRoad(tileAt(tx - d, ty)); d++) left++;
    for (let d = 1; d <= 4 && isDrivableRoad(tileAt(tx + d, ty)); d++) right++;
    for (let d = 1; d <= 4 && isDrivableRoad(tileAt(tx, ty - d)); d++) up++;
    for (let d = 1; d <= 4 && isDrivableRoad(tileAt(tx, ty + d)); d++) down++;

    const n2 = n === 2;
    const s2 = s === 2;
    const w2 = w === 2;
    const e2 = e === 2;

    // Clean intersection box check: if road extends >= 2 in both horizontal and vertical directions,
    // OR on tight diagonal/corner bends (where ewSpan & nsSpan are both short), keep asphalt clean without broken stub lines!
    const ewSpan = left + 1 + right;
    const nsSpan = up + 1 + down;
    if ((ewSpan >= 4 && nsSpan >= 4) || (ewSpan <= 2 && nsSpan <= 2)) {
      return marks;
    }

    const isOuterCorner = nwOuter || neOuter || swOuter || seOuter;
    if (isOuterCorner) {
      return marks;
    }

    if (ewSpan >= nsSpan && (wRoad || eRoad) && !(n2 && s2)) {
      // E-W Side Street (1 or 2 tiles wide)
      // Solid yellow when approaching a crosswalk, main road, turn, or intersection; dotted on open straightaways!
      const isStraightEnd = (dx) => tileAt(tx + dx, ty) === 2;
      const nearCornerOrCross =
        !isStraightEnd(-1) ||
        !isStraightEnd(1) ||
        !isStraightEnd(-2) ||
        !isStraightEnd(2) ||
        (nRoad && !n2) ||
        (sRoad && !s2);

      if (!n2 && s2) {
        // Top lane of a 2-tile E-W side street -> single yellow line on bottom seam (y=15)
        if (nearCornerOrCross) addSolidLine(marks, "ew", 15, "yellow_solid", 1);
        else addDottedYellowLine(marks, "ew", 15, 1);
      } else if (n2 && !s2) {
        // Bottom lane of a 2-tile E-W side street -> single yellow line on top seam (y=0)
        if (nearCornerOrCross) addSolidLine(marks, "ew", 0, "yellow_solid", 1);
        else addDottedYellowLine(marks, "ew", 0, 1);
      } else if (!nRoad && !sRoad) {
        // 1-tile E-W side street -> single crisp yellow line right down the middle!
        if (nearCornerOrCross) addSolidLine(marks, "ew", 7, "yellow_solid", 1);
        else addDottedYellowLine(marks, "ew", 7, 1);
      }
    } else if (nsSpan > ewSpan && (nRoad || sRoad) && !(w2 && e2)) {
      // N-S Side Street (1 or 2 tiles wide)
      const isStraightEnd = (dy) => tileAt(tx, ty + dy) === 2;
      const nearCornerOrCross =
        !isStraightEnd(-1) ||
        !isStraightEnd(1) ||
        !isStraightEnd(-2) ||
        !isStraightEnd(2) ||
        (wRoad && !w2) ||
        (eRoad && !e2);

      if (!w2 && e2) {
        // West lane of a 2-tile N-S side street -> single yellow line on right seam (x=15)
        if (nearCornerOrCross) addSolidLine(marks, "ns", 15, "yellow_solid", 1);
        else addDottedYellowLine(marks, "ns", 15, 1);
      } else if (w2 && !e2) {
        // East lane of a 2-tile N-S side street -> single yellow line on left seam (x=0)
        if (nearCornerOrCross) addSolidLine(marks, "ns", 0, "yellow_solid", 1);
        else addDottedYellowLine(marks, "ns", 0, 1);
      } else if (!wRoad && !eRoad) {
        // 1-tile N-S side street -> single crisp yellow line right down the middle!
        if (nearCornerOrCross) addSolidLine(marks, "ns", 7, "yellow_solid", 1);
        else addDottedYellowLine(marks, "ns", 7, 1);
      }
    }
    return marks;
  }

  // =========================================================================
  // 3. TOWN AVENUES & NEWTON CENTRE ROADS (tileId === 3):
  //    - Clean curbs + crisp white outer edge lines.
  //    - MOST avenues (2–3 tiles wide): 1 lane going each direction -> crisp
  //      double-yellow centerline ONLY (no multi-lane white dashes!).
  //    - SOME wide Newton Centre roads (4–5 tiles wide): 2 lanes going each
  //      direction -> double-yellow centerline + crisp dashed white lane separators!
  // =========================================================================
  if (!nRoad) {
    pushEdge("n", 0, "curb");
    pushEdge("n", 1, "shoulder");
  }
  if (!sRoad) {
    pushEdge("s", 0, "curb");
    pushEdge("s", 1, "shoulder");
  }
  if (!wRoad) {
    pushEdge("w", 0, "curb");
    pushEdge("w", 1, "shoulder");
  }
  if (!eRoad) {
    pushEdge("e", 0, "curb");
    pushEdge("e", 1, "shoulder");
  }

  const isAve = (t) => t === 3 || t === 4;
  let left3 = 0;
  let right3 = 0;
  let up3 = 0;
  let down3 = 0;
  for (let d = 1; d <= 6 && isAve(tileAt(tx - d, ty)); d++) left3++;
  for (let d = 1; d <= 6 && isAve(tileAt(tx + d, ty)); d++) right3++;
  for (let d = 1; d <= 6 && isAve(tileAt(tx, ty - d)); d++) up3++;
  for (let d = 1; d <= 6 && isAve(tileAt(tx, ty + d)); d++) down3++;

  const spanH = left3 + 1 + right3;
  const spanV = up3 + 1 + down3;

  // Wide junction box where two major town avenues meet, OR rounded outer corner tiles -> keep asphalt clean!
  if ((spanH >= 5 && spanV >= 5) || nwOuter || neOuter || swOuter || seOuter) {
    return marks;
  }

  const axis = spanH >= spanV ? "ew" : "ns";
  const wTiles = axis === "ew" ? spanV : spanH;
  const idx = axis === "ew" ? up3 : left3;

  if (wTiles === 1) {
    // Narrow 1-tile avenue connector: clean single solid yellow centerline
    addSolidLine(marks, axis, 7, "yellow_solid", 1);
  } else if (wTiles === 2) {
    // 2-tile town avenue (1 lane each direction): crisp double-yellow centerline along center seam!
    if (idx === 0) addSolidLine(marks, axis, 14, "yellow_solid", 1);
    else if (idx === 1) addSolidLine(marks, axis, 1, "yellow_solid", 1);
  } else if (wTiles === 3) {
    // 3-tile town avenue (1 wide lane each direction): crisp double-yellow centerline in center tile!
    if (idx === 1) {
      addSolidLine(marks, axis, 6, "yellow_solid", 1);
      addSolidLine(marks, axis, 9, "yellow_solid", 1);
    }
  } else if (wTiles === 4) {
    // 4-tile major Newton Centre thoroughfare (2 lanes going EACH direction!):
    // Double-yellow centerline down center seam (1|2) + dashed white lane separators (0|1 & 2|3)!
    if (idx === 0) {
      addDashedLine(marks, axis, 15, "white_dash", 1);
    } else if (idx === 1) {
      addDashedLine(marks, axis, 0, "white_dash", 1);
      addSolidLine(marks, axis, 14, "yellow_solid", 1);
    } else if (idx === 2) {
      addSolidLine(marks, axis, 1, "yellow_solid", 1);
      addDashedLine(marks, axis, 15, "white_dash", 1);
    } else if (idx === 3) {
      addDashedLine(marks, axis, 0, "white_dash", 1);
    }
  } else if (wTiles === 5) {
    // 5-tile major avenue flare (2 lanes each direction + center median line)
    if (idx === 0) addDashedLine(marks, axis, 15, "white_dash", 1);
    else if (idx === 1) addDashedLine(marks, axis, 0, "white_dash", 1);
    else if (idx === 2) {
      addSolidLine(marks, axis, 6, "yellow_solid", 1);
      addSolidLine(marks, axis, 9, "yellow_solid", 1);
    } else if (idx === 3) addDashedLine(marks, axis, 15, "white_dash", 1);
    else if (idx === 4) addDashedLine(marks, axis, 0, "white_dash", 1);
  }

  return marks;
}
