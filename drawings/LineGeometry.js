/**
 * LineGeometry - Pure mathematical geometry utilities for chart line drawings.
 *
 * Provides:
 * 1. Line extension and clipping to canvas pane viewport rectangle.
 * 2. Hit-testing distance to segments, rays, and infinite lines.
 * 3. 45-degree angle constraints for Shift key.
 * 4. Angle calculation in pixel space.
 * 5. Full TradingView statistics (Price Range, %, Pips, Bars, Date/Time, Distance, Angle).
 * 6. High-DPI crisp arrowhead rendering.
 */

/**
 * Clip a finite segment, semi-infinite ray, or infinite line to a bounding rectangle [0, 0, width, height].
 * Liang-Barsky / parametric line clipping algorithm.
 *
 * @param {number} x1 Anchor 1 X
 * @param {number} y1 Anchor 1 Y
 * @param {number} x2 Anchor 2 X
 * @param {number} y2 Anchor 2 Y
 * @param {number} width Pane width
 * @param {number} height Pane height
 * @param {boolean} extendLeft Extend indefinitely in direction from P2 through P1
 * @param {boolean} extendRight Extend indefinitely in direction from P1 through P2
 * @returns {{ start: {x: number, y: number}, end: {x: number, y: number}, visible: boolean, t1: number, t2: number }}
 */
export function clipLineToRect(x1, y1, x2, y2, width, height, extendLeft = false, extendRight = false) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  // Degenerate zero-length line
  if (lenSq < 1e-6) {
    const inside = x1 >= 0 && x1 <= width && y1 >= 0 && y1 <= height;
    return {
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      visible: inside,
      t1: 0,
      t2: 0,
    };
  }

  // Initial parametric bounds:
  // t = 0 is P1, t = 1 is P2.
  // If extendLeft, t can go to -Infinity; otherwise t >= 0.
  // If extendRight, t can go to +Infinity; otherwise t <= 1.
  let t1 = extendLeft ? -1e6 : 0;
  let t2 = extendRight ? 1e6 : 1;

  // Clip against 4 boundaries of the rectangle: x=0, x=width, y=0, y=height
  const p = [-dx, dx, -dy, dy];
  const q = [x1, width - x1, y1, height - y1];

  for (let i = 0; i < 4; i++) {
    const pi = p[i];
    const qi = q[i];

    if (Math.abs(pi) < 1e-9) {
      // Line is parallel to boundary
      if (qi < 0) {
        return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, visible: false, t1: 0, t2: 0 };
      }
    } else {
      const t = qi / pi;
      if (pi < 0) {
        // Entering boundary
        if (t > t2) return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, visible: false, t1: 0, t2: 0 };
        if (t > t1) t1 = t;
      } else {
        // Leaving boundary
        if (t < t1) return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, visible: false, t1: 0, t2: 0 };
        if (t < t2) t2 = t;
      }
    }
  }

  if (t1 > t2) {
    return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, visible: false, t1: 0, t2: 0 };
  }

  return {
    start: {
      x: x1 + t1 * dx,
      y: y1 + t1 * dy,
    },
    end: {
      x: x1 + t2 * dx,
      y: y1 + t2 * dy,
    },
    visible: true,
    t1,
    t2,
  };
}

/**
 * Distance from point (px, py) to line segment (x1, y1)-(x2, y2).
 */
export function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Distance from point (px, py) to semi-infinite ray starting at (x1, y1) through (x2, y2).
 */
export function pointToRayDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(px - x1, py - y1);

  // t >= 0 extends towards and beyond P2
  const t = Math.max(0, ((px - x1) * dx + (py - y1) * dy) / lenSq);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Distance from point (px, py) to infinite line through (x1, y1) and (x2, y2).
 */
export function pointToInfiniteLineDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return Math.hypot(px - x1, py - y1);

  const t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Distance from point to line considering extension flags.
 */
export function pointToLineWithExtensionDistance(px, py, x1, y1, x2, y2, extendLeft, extendRight) {
  if (extendLeft && extendRight) {
    return pointToInfiniteLineDistance(px, py, x1, y1, x2, y2);
  }
  if (extendRight) {
    return pointToRayDistance(px, py, x1, y1, x2, y2);
  }
  if (extendLeft) {
    // Ray starting at P2 extending through P1
    return pointToRayDistance(px, py, x2, y2, x1, y1);
  }
  return pointToSegmentDistance(px, py, x1, y1, x2, y2);
}

/**
 * Constrain second anchor point to nearest 45-degree angle increment relative to origin.
 * Used when user holds Shift while creating or moving a line.
 */
export function constrainAngle45(originX, originY, currentX, currentY) {
  const dx = currentX - originX;
  const dy = currentY - originY;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-4) return { x: currentX, y: currentY };

  let angleRad = Math.atan2(dy, dx);
  const stepRad = Math.PI / 4; // 45 degrees in radians
  angleRad = Math.round(angleRad / stepRad) * stepRad;

  return {
    x: originX + dist * Math.cos(angleRad),
    y: originY + dist * Math.sin(angleRad),
  };
}

/**
 * Calculate angle in degrees in pixel space relative to the horizontal axis.
 * Positive = upward slope, Negative = downward slope.
 */
export function calculateAngleDeg(x1, y1, x2, y2) {
  // Screen Y is inverted (0 is top), so -dy gives true Cartesian angle
  const dx = x2 - x1;
  const dy = -(y2 - y1);
  let deg = Math.atan2(dy, dx) * (180 / Math.PI);
  return deg;
}

/**
 * Format duration between two timestamps into human-readable string (e.g., "12d 4h").
 */
export function formatTimeDuration(time1, time2) {
  if (!time1 || !time2) return '';
  const t1 = typeof time1 === 'number' ? time1 : (new Date(time1).getTime() / 1000);
  const t2 = typeof time2 === 'number' ? time2 : (new Date(time2).getTime() / 1000);
  const diffSec = Math.abs(t2 - t1);

  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);

  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

/**
 * Calculate all TradingView statistics between Anchor 1 and Anchor 2.
 */
export function calculateLineStats(p1, p2, screenP1, screenP2, symbolInfo) {
  const priceDiff = p2.price - p1.price;
  const percentChange = p1.price !== 0 ? (priceDiff / p1.price) * 100 : 0;

  const pipSize = symbolInfo?.pipSize || 0.0001;
  const pips = Math.abs(priceDiff) / pipSize;

  const l1 = p1.logical !== undefined && p1.logical !== null ? p1.logical : 0;
  const l2 = p2.logical !== undefined && p2.logical !== null ? p2.logical : 0;
  const barsRange = Math.abs(Math.round(l2 - l1));

  const distancePx = (screenP1 && screenP2) ? Math.hypot(screenP2.x - screenP1.x, screenP2.y - screenP1.y) : 0;
  const angleDeg = (screenP1 && screenP2) ? calculateAngleDeg(screenP1.x, screenP1.y, screenP2.x, screenP2.y) : 0;
  const timeStr = formatTimeDuration(p1.time, p2.time);

  return {
    priceDiff,
    percentChange,
    pips,
    barsRange,
    distancePx,
    angleDeg,
    timeStr,
  };
}

/**
 * Render crisp arrowhead at target point pointing towards (toX, toY).
 */
export function renderArrowhead(ctx, fromX, fromY, toX, toY, color, lineWidth, dpr = 1) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy);
  if (len < 1e-4) return;

  const angle = Math.atan2(dy, dx);
  const arrowLength = Math.max(12 * dpr, (lineWidth * 4.5));
  const arrowAngle = 0.48; // ~27.5 degrees half-angle

  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - arrowLength * Math.cos(angle - arrowAngle),
    toY - arrowLength * Math.sin(angle - arrowAngle)
  );
  ctx.lineTo(
    toX - (arrowLength * 0.75) * Math.cos(angle),
    toY - (arrowLength * 0.75) * Math.sin(angle)
  );
  ctx.lineTo(
    toX - arrowLength * Math.cos(angle + arrowAngle),
    toY - arrowLength * Math.sin(angle + arrowAngle)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
