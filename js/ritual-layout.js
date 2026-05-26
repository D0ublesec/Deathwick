/**
 * Ritual table layout: position each player around the table by player count.
 * All players use the same layout (upright, name above shadow, hand below shadow);
 * only their (zoneLeft, zoneTop) position changes.
 *
 * YOU are always at bottom centre. Other seats are spaced evenly on an ellipse
 * (one empty slot at the bottom for you).
 */
(function (global) {
    'use strict';

    var TABLE_ASPECT = 1.4;
    var MIN_RADIUS = 30;
    var EDGE_NUDGE_X = 3;
    var EDGE_NUDGE_Y = 2;
    var ALL_OTHER_NUDGE_UP = 2;
    /** Extra lift for the player directly opposite P1 so their hand clears The Dark. */
    var APEX_NUDGE_UP = 14;
    /** Extra lift for upper-arc seats (not the apex). */
    var TOP_ARC_NUDGE_UP = 3;
    /** Radians from top (π/2) to still count as "opposite P1". */
    var APEX_ANGLE_TOLERANCE = 0.22;

    var SEAT_ABOVE_ZONE = 28;

    var ZONE_LEFT_MIN = 12;
    var ZONE_LEFT_MAX = 88;
    var ZONE_TOP_MIN = 5;
    var ZONE_TOP_MAX = 74;

    function clampZone(left, top) {
        return {
            zoneLeft: Math.max(ZONE_LEFT_MIN, Math.min(ZONE_LEFT_MAX, left)),
            zoneTop: Math.max(ZONE_TOP_MIN, Math.min(ZONE_TOP_MAX, top))
        };
    }

    function normalizeAngle(angle) {
        angle = angle % (2 * Math.PI);
        if (angle < 0) angle += 2 * Math.PI;
        return angle;
    }

    function angleForOtherIndex(displayCount, otherIndex) {
        var n = displayCount + 1;
        return normalizeAngle((3 * Math.PI / 2) + (otherIndex + 1) * (2 * Math.PI / n));
    }

    function getRadius(displayCount, isNarrow) {
        var n = displayCount + 1;
        var base = 28 + displayCount * 2.8;
        if (displayCount >= 5) base = 32 + displayCount * 2.6;
        var r = isNarrow ? base * 0.94 : Math.max(MIN_RADIUS, base);
        var minChord = displayCount >= 5 ? 34 : 38;
        var sinHalf = Math.sin(Math.PI / n);
        var rNoOverlap = sinHalf > 0.001 ? minChord / (2 * sinHalf) : r;
        r = Math.max(r, rNoOverlap);
        var cap = isNarrow
            ? (displayCount >= 5 ? 42 : 38)
            : (displayCount >= 5 ? 48 : 44);
        return Math.min(r, cap);
    }

    /** Index of the top-centre seat (opposite P1), or -1 if no seat is close enough to top. */
    function getApexOtherIndex(displayCount) {
        if (displayCount === 1) return 0;
        var best = -1;
        var bestDist = Infinity;
        for (var i = 0; i < displayCount; i++) {
            var angle = angleForOtherIndex(displayCount, i);
            var dist = Math.abs(angle - Math.PI / 2);
            if (dist > Math.PI) dist = 2 * Math.PI - dist;
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        }
        return bestDist <= APEX_ANGLE_TOLERANCE ? best : -1;
    }

    function getZonePosition(displayCount, otherIndex, isNarrow, skipApexNudge) {
        var radius = getRadius(displayCount, isNarrow);
        var radiusX = radius;
        var radiusY = radius / TABLE_ASPECT;
        var angle = angleForOtherIndex(displayCount, otherIndex);
        var zoneLeft = 50 + (radiusX + EDGE_NUDGE_X) * Math.cos(angle);
        var zoneTop = 50 - (radiusY + EDGE_NUDGE_Y) * Math.sin(angle);

        zoneTop -= ALL_OTHER_NUDGE_UP;
        if (zoneTop < 28) zoneTop -= TOP_ARC_NUDGE_UP;

        var apexIndex = skipApexNudge ? -1 : getApexOtherIndex(displayCount);
        if (!skipApexNudge && apexIndex >= 0 && otherIndex === apexIndex) {
            zoneTop -= APEX_NUDGE_UP;
        }

        return clampZone(zoneLeft, zoneTop);
    }

    function getZonePositionLabel(zoneLeft, zoneTop, isApex) {
        if (isApex) return 'top';
        if (zoneTop < 26 && zoneLeft >= 38 && zoneLeft <= 62) return 'top';
        if (zoneLeft < 32) return 'left';
        if (zoneLeft > 68) return 'right';
        return null;
    }

    function getOtherPlayerLayout(displayCount, otherIndex, isNarrow) {
        var apexIndex = getApexOtherIndex(displayCount);
        var isApexPlayer = apexIndex >= 0 && otherIndex === apexIndex;
        var pos = getZonePosition(displayCount, otherIndex, isNarrow, false);
        var zoneLeft = pos.zoneLeft;
        var zoneTop = pos.zoneTop;

        return {
            zoneLeft: zoneLeft,
            zoneTop: zoneTop,
            seatLeft: zoneLeft,
            seatTop: Math.max(2, zoneTop - SEAT_ABOVE_ZONE),
            zoneRotateDeg: 0,
            isLeftOrRight: zoneLeft < 35 || zoneLeft > 65,
            isTopPlayer: zoneTop < 50,
            isApexPlayer: isApexPlayer,
            zonePosition: getZonePositionLabel(zoneLeft, zoneTop, isApexPlayer),
            twoPlayerShadow: displayCount === 1
        };
    }

    global.getRitualLayout = {
        getOtherPlayerLayout: getOtherPlayerLayout,
        getRadius: function (displayCount, isNarrow) { return getRadius(displayCount, isNarrow); },
        TABLE_ASPECT: TABLE_ASPECT
    };
})(typeof window !== 'undefined' ? window : this);
