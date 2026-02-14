/**
 * Ritual table layout: position each player around the table by player count.
 * All players use the same layout (upright, name above shadow, hand below shadow);
 * only their (zoneLeft, zoneTop) position changes.
 *
 * - 2–6 players: fixed positions matching the manual (YOU at bottom centre; others around).
 * - 7+ players: circle of positions.
 */
(function (global) {
    'use strict';

    var TABLE_ASPECT = 1.4;
    var MIN_RADIUS = 30;
    var EDGE_NUDGE_X = 5;
    var EDGE_NUDGE_Y = 4;
    /** Move all zones up/down: only place to change (positive = lower on table). */
    var TABLE_OFFSET_Y = 2;
    /** Shift everyone except P1 up: only place to change (positive = higher on table). */
    var ALL_OTHER_NUDGE_UP = 4;
    /** Move player opposite P1 (top of table) up: only place to change (positive = higher on table). */
    var TOP_PLAYER_NUDGE_UP = 12;

    /** Name above shadow: only place to change how far above the zone the seat (name/title) sits. */
    var SEAT_ABOVE_ZONE = 30;

    /** Fixed positions [zoneLeft, zoneTop] per (displayCount, otherIndex). displayCount = number of *other* players (1=2p, 2=3p, …). */
    var FIXED_POSITIONS = {
        1: [[50, 18]],
        2: [[22, 22], [78, 22]],
        3: [[10, 50], [50, 14], [90, 50]],
        4: [[12, 72], [22, 18], [78, 18], [88, 72]],
        5: [[12, 78], [12, 22], [50, 10], [88, 22], [88, 78]]
    };

    function getRadius(displayCount, isNarrow) {
        var base = 32 + displayCount * 2.5;
        var r = isNarrow ? base * 1.05 : Math.max(MIN_RADIUS, base);
        var n = displayCount + 1;
        var minChord = 44;
        var sinHalf = Math.sin(Math.PI / n);
        var rNoOverlap = sinHalf > 0.001 ? minChord / (2 * sinHalf) : r;
        r = Math.max(r, rNoOverlap);
        return Math.min(r, 48);
    }

    /** Get (zoneLeft, zoneTop) for this seat. For 7+ uses circle. */
    function getZonePosition(displayCount, otherIndex, isNarrow) {
        var zoneLeft, zoneTop;
        var fixed = FIXED_POSITIONS[displayCount];
        if (fixed && otherIndex < fixed.length) {
            zoneLeft = fixed[otherIndex][0];
            zoneTop = fixed[otherIndex][1] + TABLE_OFFSET_Y;
        } else {
            var radius = getRadius(displayCount, isNarrow);
            var radiusX = radius;
            var radiusY = radius / TABLE_ASPECT;
            var n = displayCount + 1;
            var angle = (3 * Math.PI / 2) + (otherIndex + 1) * (2 * Math.PI / n);
            angle = angle % (2 * Math.PI);
            if (angle < 0) angle += 2 * Math.PI;
            zoneLeft = 50 + (radiusX + EDGE_NUDGE_X) * Math.cos(angle);
            zoneTop = 50 - (radiusY + EDGE_NUDGE_Y) * Math.sin(angle) + TABLE_OFFSET_Y;
        }
        zoneTop -= ALL_OTHER_NUDGE_UP;
        if (zoneTop < 30) zoneTop -= TOP_PLAYER_NUDGE_UP;
        return { zoneLeft: zoneLeft, zoneTop: zoneTop };
    }

    function getZonePositionLabel(zoneLeft, zoneTop) {
        if (zoneTop < 30) return 'top';
        if (zoneLeft < 30) return 'left';
        if (zoneLeft > 70) return 'right';
        return null;
    }

    /**
     * Returns layout for one "other" player. Same block layout for everyone; only position differs.
     */
    function getOtherPlayerLayout(displayCount, otherIndex, isNarrow) {
        var pos = getZonePosition(displayCount, otherIndex, isNarrow);
        var zoneLeft = pos.zoneLeft;
        var zoneTop = pos.zoneTop;
        var seatTop = Math.max(2, zoneTop - SEAT_ABOVE_ZONE);
        var zonePosition = getZonePositionLabel(zoneLeft, zoneTop);

        return {
            zoneLeft: zoneLeft,
            zoneTop: zoneTop,
            seatLeft: zoneLeft,
            seatTop: seatTop,
            zoneRotateDeg: 0,
            isLeftOrRight: zoneLeft < 35 || zoneLeft > 65,
            isTopPlayer: zoneTop < 50,
            zonePosition: zonePosition,
            twoPlayerShadow: displayCount === 1
        };
    }

    global.getRitualLayout = {
        getOtherPlayerLayout: getOtherPlayerLayout,
        getRadius: function (displayCount, isNarrow) { return getRadius(displayCount, isNarrow); },
        TABLE_ASPECT: TABLE_ASPECT
    };
})(typeof window !== 'undefined' ? window : this);
