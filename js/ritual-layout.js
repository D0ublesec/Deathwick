/**
 * Ritual table layout: positions and angles for other players (2–12 players).
 *
 * ADJUSTING LAYOUT BY PLAYER COUNT:
 * - Zone/seat positions: percentages (0–100). zoneLeft/zoneTop = where the whole block (shadow row + hand) sits. seatLeft/seatTop = where the player name/class sits.
 * - 2-player: single opponent (displayCount === 1). Adjust topPct so P2's zone is on the table above The Dark.
 * - 3-player: two opponents left/right (displayCount === 2). Uses radius + radiusSideX for zone; adjust radius or radiusSideX to move zones on/off table.
 * - 4-player: three opponents (displayCount === 3). All values are in getFourPlayerLayout() — zoneLeft, zoneTop, seatLeft, seatTop, zoneRotateDeg per otherIndex 0=P2 right, 1=P3 top, 2=P4 left.
 * - 5+ player: circle layout (displayCount >= 4). Zone and seat use same position (leftPct, topPct). Adjust radius / EDGE_NUDGE to move the circle.
 *
 * Hand vs shadow spacing is in CSS: see "LAYOUT ADJUSTMENTS BY PLAYER COUNT" in game.css (margin-top on .ritual-zone-hand).
 */
(function (global) {
    'use strict';

    /* ADJUST: overall table shape and how far from center zones sit (affects 2p, 3p, 5+). Larger = zones further toward screen edge. */
    var TABLE_ASPECT = 1.4;
    var MIN_RADIUS = 30;
    var EDGE_NUDGE_X = 5;
    var EDGE_NUDGE_Y = 4;

    /* ADJUST: base distance from center (%). displayCount: 1=2p, 2=3p, 3=4p, 4=5p, ... */
    function getBaseRadius(displayCount) {
        if (displayCount === 1) return 30;
        if (displayCount <= 2) return 32;
        if (displayCount <= 3) return 42;
        if (displayCount === 8) return 46;
        if (displayCount === 5) return 50;
        if (displayCount === 6) return 54;
        return 36 + displayCount * 2.5;
    }

    function getRadius(displayCount, isNarrow) {
        var base = getBaseRadius(displayCount);
        var r = isNarrow
            ? (displayCount >= 4 ? base * 1.05 : (displayCount === 3 ? base * 1.1 : (displayCount === 2 ? 42 : base * 0.95)))
            : Math.max(MIN_RADIUS, base);
        if (displayCount >= 3) {
            var n = displayCount + 1;
            var minChord = 44;
            var sinHalf = Math.sin(Math.PI / n);
            var rNoOverlap = sinHalf > 0.001 ? minChord / (2 * sinHalf) : r;
            r = Math.max(r, rNoOverlap);
        }
        var maxR = displayCount >= 6 ? 44 : 48;
        return Math.min(r, maxR);
    }

    /**
     * Returns layout for one "other" player zone/seat.
     * @param {number} displayCount - number of other players (1 in 2p, 2 in 3p, 3 in 4p, ...)
     * @param {number} otherIndex - index in otherPlayers (0..displayCount-1)
     * @param {boolean} isNarrow - narrow viewport
     * @returns {{
     *   zoneLeft: number, zoneTop: number,
     *   seatLeft: number, seatTop: number,
     *   zoneRotateDeg: number,
     *   isLeftOrRight: boolean,
     *   isTopPlayer: boolean,
     *   zonePosition: string|null,
     *   twoPlayerShadow: boolean
     * }}
     */
    function getOtherPlayerLayout(displayCount, otherIndex, isNarrow) {
        var radius = getRadius(displayCount, isNarrow);
        var radiusX = radius;
        var radiusY = radius / TABLE_ASPECT;
        var useCircleLayout = displayCount >= 4;
        var useFullCircle = displayCount >= 3 || displayCount === 8;
        var topNudge = (displayCount >= 5 && useFullCircle) ? 2 : 0;

        /* 4-player: explicit positions so P2/P3/P4 don't overlap table edge or each other */
        if (displayCount === 3) {
            return getFourPlayerLayout(otherIndex);
        }

        var angle = getAngle(displayCount, otherIndex, useCircleLayout, useFullCircle);
        var leftPct = 50 + (radiusX + EDGE_NUDGE_X) * Math.cos(angle);
        var topPct = 50 - (radiusY + EDGE_NUDGE_Y) * Math.sin(angle) + topNudge;
        /* ADJUST 2-PLAYER: P2 zone vertical position (%). Lower = zone higher on screen (shadow row above The Dark). Higher value = zone lower (can go under The Dark). */
        if (displayCount === 1) topPct = 38 - (radiusY + EDGE_NUDGE_Y);
        if (displayCount === 5 && !useCircleLayout) {
            if (otherIndex === 0) topPct += 5;
            else if (otherIndex === 1) topPct -= 5;
            else if (otherIndex === 3) topPct -= 5;
            else if (otherIndex === 4) topPct += 5;
        }

        var isLeftOrRight = !useCircleLayout && displayCount >= 3 && Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle));
        var zoneLeft, zoneTop;
        if (useCircleLayout) {
            zoneLeft = leftPct;
            zoneTop = topPct;
        } else if (isLeftOrRight) {
            /* ADJUST 3-PLAYER: how far left/right the zone is from center (%). Larger = zone closer to screen edge. 18*1.9 ≈ 34. */
            var radiusSideX = 18 * 1.9;
            var radiusSideY = radiusSideX / TABLE_ASPECT;
            zoneLeft = 50 + radiusSideX * Math.cos(angle);
            zoneTop = 50 - radiusSideY * Math.sin(angle) + topNudge;
        } else {
            zoneLeft = leftPct;
            zoneTop = topPct;
        }

        /* zoneRotateDeg: 0=right, 90=bottom, 180=left, 270=top. +180 flips the zone. */
        var zoneRotateDeg = angle * 180 / Math.PI + 90;
        if (displayCount === 2 || isLeftOrRight) zoneRotateDeg += 180;

        var isTopPlayer = (displayCount === 1) || (displayCount >= 3 && !isLeftOrRight && angle > 0.4 && angle < 2.0);
        var seatTop = topPct;
        if (isTopPlayer) seatTop = topPct - 20;
        /* ADJUST 2-PLAYER: P2 name (seat) position. Negative = name higher (above hand, clear of hand count); positive = name lower. */
        if (displayCount === 1) seatTop = topPct - 25;

        return {
            zoneLeft: zoneLeft,
            zoneTop: zoneTop,
            seatLeft: leftPct,
            seatTop: seatTop,
            zoneRotateDeg: zoneRotateDeg,
            isLeftOrRight: isLeftOrRight,
            isTopPlayer: isTopPlayer,
            zonePosition: null,
            twoPlayerShadow: displayCount === 1
        };
    }

    function getAngle(displayCount, o, useCircleLayout, useFullCircle) {
        if (displayCount === 1) return Math.PI / 2;
        if (displayCount === 2) return o * Math.PI;
        if (useCircleLayout) {
            var a = (3 * Math.PI / 2) + o * (2 * Math.PI / displayCount);
            a = a % (2 * Math.PI);
            if (a < 0) a += 2 * Math.PI;
            return a;
        }
        if (useFullCircle) {
            var b = (3 * Math.PI / 2) + (o + 1) * (2 * Math.PI / (displayCount + 1));
            b = b % (2 * Math.PI);
            if (b < 0) b += 2 * Math.PI;
            return b;
        }
        return (o / Math.max(1, displayCount - 1)) * Math.PI;
    }

    /**
     * ADJUST 4-PLAYER LAYOUT (otherIndex: 0 = P2 right, 1 = P3 top, 2 = P4 left).
     * All values are % (0–100). zoneLeft/zoneTop = position of the block (shadow row + hand). seatLeft/seatTop = position of name/class. zoneRotateDeg = rotation (0/90/180/270).
     */
    function getFourPlayerLayout(otherIndex) {
        var zoneLeft, zoneTop, seatLeft, seatTop, zoneRotateDeg, zonePosition;
        if (otherIndex === 0) {
            /* ADJUST P2 (right side): zoneLeft (higher = more right), zoneTop (higher = lower on screen), seat = name position */
            zoneLeft = 82;
            zoneTop = 52;
            seatLeft = 86;
            seatTop = 50;
            zoneRotateDeg = 270;
            zonePosition = 'right';
        } else if (otherIndex === 1) {
            /* ADJUST P3 (top): zoneTop (lower = higher on screen), seatTop = name higher than zone */
            zoneLeft = 50;
            zoneTop = 28;
            seatLeft = 50;
            seatTop = 18;
            zoneRotateDeg = 180;
            zonePosition = 'top';
        } else {
            /* ADJUST P4 (left side): zoneLeft (lower = more left), zoneTop, seat = name position */
            zoneLeft = 18;
            zoneTop = 50;
            seatLeft = 14;
            seatTop = 50;
            zoneRotateDeg = 90;
            zonePosition = 'left';
        }
        return {
            zoneLeft: zoneLeft,
            zoneTop: zoneTop,
            seatLeft: seatLeft,
            seatTop: seatTop,
            zoneRotateDeg: zoneRotateDeg,
            isLeftOrRight: true,
            isTopPlayer: otherIndex === 1,
            zonePosition: zonePosition,
            twoPlayerShadow: false
        };
    }

    global.getRitualLayout = {
        getOtherPlayerLayout: getOtherPlayerLayout,
        getRadius: function (displayCount, isNarrow) { return getRadius(displayCount, isNarrow); },
        TABLE_ASPECT: TABLE_ASPECT
    };
})(typeof window !== 'undefined' ? window : this);
