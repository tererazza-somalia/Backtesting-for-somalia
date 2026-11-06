/**
 * RotatedRectangleDrawing - Full implementation of TradingView's Rotated Rectangle drawing tool.
 *
 * Defines a rectangle at ANY angle on the chart using 3 anchor points in chart coordinates:
 *   points[0] (p1): First corner of the baseline edge (Corner A)
 *   points[1] (p2): Second corner of the baseline edge (Corner B)
 *   points[2] (p3): Anchor defining the perpendicular signed width (Corners C & D)
 *
 * The perpendicular offset is calculated in PIXEL space on every frame so the resulting
 * shape is ALWAYS a true visual rectangle with 90° right angles regardless of chart zoom,
 * pan, aspect ratio, or price scaling (normal, log, percent).
 */

import { BaseDrawing } from './BaseDrawing.js';
import { ROTATED_RECTANGLE_DEFAULTS, INTERACTION_CONSTANTS } from './constants.js';

export class RotatedRectangleDrawing extends BaseDrawing {
  constructor(options = {}) {
    super({ ...options, type: 'rotatedRectangle' });

    // Initialize styling with fallback to defaults
    this.border = {
      color: options.border?.color || ROTATED_RECTANGLE_DEFAULTS.BORDER.color,
      width: options.border?.width || ROTATED_RECTANGLE_DEFAULTS.BORDER.width,
      style: options.border?.style || ROTATED_RECTANGLE_DEFAULTS.BORDER.style,
    };

    this.background = {
      visible: options.background?.visible !== undefined ? options.background.visible : ROTATED_RECTANGLE_DEFAULTS.BACKGROUND.visible,
      color: options.background?.color || ROTATED_RECTANGLE_DEFAULTS.BACKGROUND.color,
      opacity: options.background?.opacity !== undefined ? options.background.opacity : ROTATED_RECTANGLE_DEFAULTS.BACKGROUND.opacity,
    };
  }

  /**
   * Derive the 4 corners (A, B, C, D) in screen pixel space.
   *
   * A = p1
   * B = p2
   * C = B + n * w
   * D = A + n * w
   * where n is unit perpendicular to AB in pixel space and w is signed perpendicular width.
   */
  getCorners(coordHelper) {
    if (!this.points || this.points.length < 2) return null;
    const p1 = this.points[0];
    const p2 = this.points[1];
    const p3 = this.points.length >= 3 ? this.points[2] : null;

    const xA = coordHelper.pointToScreenX(p1);
    const yA = coordHelper.priceToScreenY(p1.price);
    const xB = coordHelper.pointToScreenX(p2);
    const yB = coordHelper.priceToScreenY(p2.price);

    if (xA === null || yA === null || xB === null || yB === null) return null;

    const dx = xB - xA;
    const dy = yB - yA;
    const len = Math.hypot(dx, dy);

    // If points are coincident, baseline is degenerate
    if (len < 1e-4) {
      return {
        A: { x: xA, y: yA },
        B: { x: xB, y: yB },
        C: { x: xB, y: yB },
        D: { x: xA, y: yA },
        midAB: { x: xA, y: yA },
        midCD: { x: xA, y: yA },
        center: { x: xA, y: yA },
        width: 0,
        absWidth: 0,
        length: 0,
        angle: 0,
        bounds: { left: xA, right: xA, top: yA, bottom: yA, width: 0, height: 0 },
        isDegenerate: true,
      };
    }

    // Unit vector along baseline AB
    const ux = dx / len;
    const uy = dy / len;

    // Unit normal vector perpendicular to AB (counter-clockwise 90° in canvas coords)
    const nx = -uy;
    const ny = ux;

    let w = 0;
    if (p3) {
      const x3 = coordHelper.pointToScreenX(p3);
      const y3 = coordHelper.priceToScreenY(p3.price);
      if (x3 !== null && y3 !== null) {
        // Project vector (P3 - A) onto normal vector n
        // w = (x3 - xA) * nx + (y3 - yA) * ny
        w = (x3 - xA) * nx + (y3 - yA) * ny;
      }
    }

    // Offset vector perpendicular to baseline
    const offX = nx * w;
    const offY = ny * w;

    // 4 visual corners
    const A = { x: xA, y: yA };
    const B = { x: xB, y: yB };
    const C = { x: xB + offX, y: yB + offY };
    const D = { x: xA + offX, y: yA + offY };

    const midAB = { x: (xA + xB) / 2, y: (yA + yB) / 2 };
    const midCD = { x: (C.x + D.x) / 2, y: (C.y + D.y) / 2 };
    const center = { x: (A.x + B.x + C.x + D.x) / 4, y: (A.y + B.y + C.y + D.y) / 4 };

    const minX = Math.min(A.x, B.x, C.x, D.x);
    const maxX = Math.max(A.x, B.x, C.x, D.x);
    const minY = Math.min(A.y, B.y, C.y, D.y);
    const maxY = Math.max(A.y, B.y, C.y, D.y);

    return {
      A,
      B,
      C,
      D,
      midAB,
      midCD,
      center,
      width: w,
      absWidth: Math.abs(w),
      length: len,
      angle: Math.atan2(dy, dx),
      bounds: {
        left: minX,
        right: maxX,
        top: minY,
        bottom: maxY,
        width: maxX - minX,
        height: maxY - minY,
      },
      isDegenerate: len < 1e-4 || Math.abs(w) < 1e-4,
    };
  }

  /**
   * Screen bounds helper for floating toolbar and viewport placement.
   */
  getScreenBounds(coordHelper) {
    const geom = this.getCorners(coordHelper);
    if (!geom) return null;
    return {
      left: geom.bounds.left,
      top: geom.bounds.top,
      right: geom.bounds.right,
      bottom: geom.bounds.bottom,
      width: geom.bounds.width,
      height: geom.bounds.height,
      rawX1: geom.A.x,
      rawX2: geom.B.x,
      rawY1: geom.A.y,
      rawY2: geom.B.y,
      center: geom.center,
    };
  }

  /**
   * Spatial viewport culling.
   */
  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    if (bounds.right < 0 || bounds.left > mediaWidth) return true;
    if (bounds.bottom < 0 || bounds.top > mediaHeight) return true;
    return false;
  }

  /**
   * Interactive resize handles in screen space:
   *   - p1: Corner A
   *   - p2: Corner B
   *   - p3_c: Corner C
   *   - p3_d: Corner D
   *   - width: Midpoint of CD (width adjustment handle)
   */
  getHandles(coordHelper) {
    const geom = this.getCorners(coordHelper);
    if (!geom) return [];

    const handles = [
      { id: 'p1', x: geom.A.x, y: geom.A.y, cursor: 'crosshair', role: 'corner-a' },
      { id: 'p2', x: geom.B.x, y: geom.B.y, cursor: 'crosshair', role: 'corner-b' },
    ];

    if (!geom.isDegenerate) {
      handles.push(
        { id: 'p3_c', x: geom.C.x, y: geom.C.y, cursor: 'crosshair', role: 'corner-c' },
        { id: 'p3_d', x: geom.D.x, y: geom.D.y, cursor: 'crosshair', role: 'corner-d' },
        { id: 'width', x: geom.midCD.x, y: geom.midCD.y, cursor: 'pointer', role: 'width' }
      );
    }

    return handles;
  }

  /**
   * Hit test a screen coordinate (x, y) against handles, borders, and body fill.
   */
  hitTest(x, y, coordHelper) {
    const geom = this.getCorners(coordHelper);
    if (!geom) return { hit: false };

    // 1. Check interactive handles (if selected and unlocked)
    if (this.isSelected && !this.locked) {
      const handles = this.getHandles(coordHelper);
      for (const h of handles) {
        const dist = Math.hypot(x - h.x, y - h.y);
        if (dist <= INTERACTION_CONSTANTS.HANDLE_HIT_RADIUS) {
          return {
            hit: true,
            type: 'handle',
            handleId: h.id,
            cursor: h.cursor,
            drawing: this,
          };
        }
      }
    }

    // 2. If degenerate (single baseline preview), check line distance
    if (geom.isDegenerate) {
      const dist = this._pointToSegmentDist(x, y, geom.A.x, geom.A.y, geom.B.x, geom.B.y);
      if (dist <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE) {
        return {
          hit: true,
          type: 'border',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
      return { hit: false };
    }

    // 3. Check 4 perimeter borders (AB, BC, CD, DA)
    const distAB = this._pointToSegmentDist(x, y, geom.A.x, geom.A.y, geom.B.x, geom.B.y);
    const distBC = this._pointToSegmentDist(x, y, geom.B.x, geom.B.y, geom.C.x, geom.C.y);
    const distCD = this._pointToSegmentDist(x, y, geom.C.x, geom.C.y, geom.D.x, geom.D.y);
    const distDA = this._pointToSegmentDist(x, y, geom.D.x, geom.D.y, geom.A.x, geom.A.y);

    const minBorderDist = Math.min(distAB, distBC, distCD, distDA);
    if (minBorderDist <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE) {
      return {
        hit: true,
        type: 'border',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    // 4. Check interior body fill (Point-in-Polygon)
    if (this._pointInPolygon(x, y, [geom.A, geom.B, geom.C, geom.D])) {
      return {
        hit: true,
        type: 'body',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    return { hit: false };
  }

  /**
   * Distance from point P(x, y) to line segment (x1, y1)-(x2, y2)
   */
  _pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  /**
   * Ray-casting point-in-polygon algorithm
   */
  _pointInPolygon(px, py, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Render Background (zOrder: 'bottom')
   * Rendered behind candles so candlesticks remain 100% visible!
   */
  renderBackground(ctx, scope, coordHelper) {
    if (!this.background.visible || this.background.opacity <= 0) return;
    const geom = this.getCorners(coordHelper);
    if (!geom || geom.isDegenerate) return;
    if (this.isOffScreen(geom.bounds, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;

    const Ax = Math.round(geom.A.x * hpr);
    const Ay = Math.round(geom.A.y * vpr);
    const Bx = Math.round(geom.B.x * hpr);
    const By = Math.round(geom.B.y * vpr);
    const Cx = Math.round(geom.C.x * hpr);
    const Cy = Math.round(geom.C.y * vpr);
    const Dx = Math.round(geom.D.x * hpr);
    const Dy = Math.round(geom.D.y * vpr);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(Ax, Ay);
    ctx.lineTo(Bx, By);
    ctx.lineTo(Cx, Cy);
    ctx.lineTo(Dx, Dy);
    ctx.closePath();

    ctx.globalAlpha = Math.max(0, Math.min(1, this.background.opacity));
    ctx.fillStyle = this.background.color || '#2962ff';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Render Foreground (zOrder: 'normal')
   * Crisp pixel-aligned borders, handles, and selection outlines.
   */
  renderForeground(ctx, scope, coordHelper) {
    const geom = this.getCorners(coordHelper);
    if (!geom) return;
    if (this.isOffScreen(geom.bounds, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const dpr = Math.max(hpr, vpr);

    ctx.save();

    // 1. If in Step 2 of creation (width = 0), render baseline preview segment
    if (geom.isDegenerate) {
      const Ax = Math.round(geom.A.x * hpr);
      const Ay = Math.round(geom.A.y * vpr);
      const Bx = Math.round(geom.B.x * hpr);
      const By = Math.round(geom.B.y * vpr);

      ctx.beginPath();
      ctx.moveTo(Ax, Ay);
      ctx.lineTo(Bx, By);
      ctx.strokeStyle = this.border.color || '#2962ff';
      ctx.lineWidth = Math.max(1, Math.round((this.border.width || 2) * hpr));
      if (this.border.style === 'dashed') ctx.setLineDash([6 * hpr, 4 * hpr]);
      else if (this.border.style === 'dotted') ctx.setLineDash([2 * hpr, 3 * hpr]);
      else ctx.setLineDash([]);
      ctx.stroke();

      // Render endpoints during baseline creation
      this._drawHandleDot(ctx, Ax, Ay, dpr);
      this._drawHandleDot(ctx, Bx, By, dpr);
      ctx.restore();
      return;
    }

    const Ax = Math.round(geom.A.x * hpr);
    const Ay = Math.round(geom.A.y * vpr);
    const Bx = Math.round(geom.B.x * hpr);
    const By = Math.round(geom.B.y * vpr);
    const Cx = Math.round(geom.C.x * hpr);
    const Cy = Math.round(geom.C.y * vpr);
    const Dx = Math.round(geom.D.x * hpr);
    const Dy = Math.round(geom.D.y * vpr);

    // 2. Render Outer Border
    ctx.beginPath();
    ctx.moveTo(Ax, Ay);
    ctx.lineTo(Bx, By);
    ctx.lineTo(Cx, Cy);
    ctx.lineTo(Dx, Dy);
    ctx.closePath();

    ctx.strokeStyle = this.border.color || '#2962ff';
    ctx.lineWidth = Math.max(1, Math.round((this.border.width || 2) * hpr));
    ctx.lineJoin = 'miter';

    if (this.border.style === 'dashed') {
      ctx.setLineDash([6 * hpr, 4 * hpr]);
    } else if (this.border.style === 'dotted') {
      ctx.setLineDash([2 * hpr, 3 * hpr]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();

    // 3. Render Selection / Hover Outline
    if (this.isSelected || this.isHovered) {
      ctx.beginPath();
      ctx.moveTo(Ax, Ay);
      ctx.lineTo(Bx, By);
      ctx.lineTo(Cx, Cy);
      ctx.lineTo(Dx, Dy);
      ctx.closePath();
      ctx.strokeStyle = this.isSelected ? '#2962ff' : 'rgba(41, 98, 255, 0.45)';
      ctx.lineWidth = Math.max(1, Math.round(1 * hpr));
      ctx.setLineDash([]);
      ctx.stroke();
    }

    // 4. Render Handles (if selected and unlocked)
    if (this.isSelected && !this.locked) {
      this._renderHandles(ctx, geom, hpr, vpr, dpr);
    }

    ctx.restore();
  }

  /**
   * Render Interactive Handles at Corners and Width Midpoint
   */
  _renderHandles(ctx, geom, hpr, vpr, dpr) {
    const handleCoords = [
      { x: geom.A.x, y: geom.A.y },
      { x: geom.B.x, y: geom.B.y },
      { x: geom.C.x, y: geom.C.y },
      { x: geom.D.x, y: geom.D.y },
      { x: geom.midCD.x, y: geom.midCD.y }, // Width handle
    ];

    for (const h of handleCoords) {
      const sx = Math.round(h.x * hpr);
      const sy = Math.round(h.y * vpr);
      this._drawHandleDot(ctx, sx, sy, dpr);
    }
  }

  _drawHandleDot(ctx, sx, sy, dpr) {
    const handleRadius = Math.max(3, Math.round(INTERACTION_CONSTANTS.HANDLE_SIZE * dpr) / 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, handleRadius, 0, Math.PI * 2);
    ctx.fillStyle = INTERACTION_CONSTANTS.HANDLE_COLOR;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 1.8 * dpr);
    ctx.strokeStyle = INTERACTION_CONSTANTS.HANDLE_BORDER_COLOR;
    ctx.stroke();
    ctx.restore();
  }

  normalize() {
    this.updatedAt = Date.now();
  }

  /**
   * Clone this rotated rectangle drawing with new ID and slight offset
   */
  clone() {
    const json = this.toJSON();
    return new RotatedRectangleDrawing({
      ...json,
      id: 'rotatedRect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      points: json.points.map(p => ({
        ...p,
        price: p.price * 1.002,
        logical: (p.logical !== undefined && p.logical !== null ? p.logical : 0) + 3,
      })),
      locked: false,
    });
  }

  toJSON() {
    return {
      id: this.id,
      type: 'rotatedRectangle',
      points: this.points.map(pt => ({
        time: pt.time,
        price: pt.price,
        logical: pt.logical,
      })),
      border: { ...this.border },
      background: { ...this.background },
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: this.zIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data) {
    return new RotatedRectangleDrawing(data);
  }
}
