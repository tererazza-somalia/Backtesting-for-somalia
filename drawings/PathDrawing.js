/**
 * PathDrawing - TradingView-style Path drawing tool.
 *
 * PURPOSE:
 * A continuous chain of connected line segments with an unlimited number of anchor
 * points (N >= 2) to outline chart patterns, Elliott waves, zig-zag formations,
 * and projected future price forecasts.
 *
 * DATA MODEL:
 * All points are stored strictly in CHART coordinates ({ time, price, logical }).
 * Never pixels. Converted dynamically on each frame via Series Primitive coordinate helpers.
 * Fully supports anchors in the future area (beyond the last candle) via logical bar indices.
 */

import { BaseDrawing } from './BaseDrawing.js';
import { PATH_DEFAULTS, PATH_CONFIG, INTERACTION_CONSTANTS } from './constants.js';

export class PathDrawing extends BaseDrawing {
  constructor(options = {}) {
    super({ ...options, type: 'path' });

    // Anchor points in chart coordinates
    this.points = options.points ? options.points.map(pt => ({
      price: pt.price !== undefined ? Number(pt.price) : 0,
      time: pt.time !== undefined ? pt.time : null,
      logical: pt.logical !== undefined && pt.logical !== null ? Number(pt.logical) : undefined,
    })) : [];

    // Styling configuration
    this.line = {
      color: options.line?.color || PATH_DEFAULTS.LINE.color,
      width: options.line?.width !== undefined ? Number(options.line.width) : PATH_DEFAULTS.LINE.width,
      opacity: options.line?.opacity !== undefined ? Number(options.line.opacity) : PATH_DEFAULTS.LINE.opacity,
      style: options.line?.style || PATH_DEFAULTS.LINE.style, // 'solid' | 'dashed' | 'dotted'
    };

    // Arrowhead toggles
    this.arrows = {
      start: options.arrows?.start !== undefined ? Boolean(options.arrows.start) : PATH_DEFAULTS.ARROWS.start,
      end: options.arrows?.end !== undefined ? Boolean(options.arrows.end) : PATH_DEFAULTS.ARROWS.end,
    };

    // Selected handle index for vertex-level editing/deletion (null = whole shape selected)
    this.selectedHandleIndex = options.selectedHandleIndex !== undefined ? options.selectedHandleIndex : null;
    this.hoveredHandleIndex = null;
  }

  /**
   * Remove trailing duplicate points and ensure valid numbers.
   */
  normalize() {
    if (!this.points || this.points.length === 0) {
      this.points = [];
      return;
    }

    // Filter out invalid/NaN entries
    this.points = this.points.filter(pt => pt && !isNaN(pt.price));

    // Deduplicate consecutive identical points
    const deduped = [];
    for (let i = 0; i < this.points.length; i++) {
      const cur = this.points[i];
      if (deduped.length === 0) {
        deduped.push(cur);
      } else {
        const prev = deduped[deduped.length - 1];
        const samePrice = Math.abs(cur.price - prev.price) < 1e-6;
        const sameLogical = (cur.logical !== undefined && prev.logical !== undefined)
          ? Math.abs(cur.logical - prev.logical) < 1e-4
          : true;
        const sameTime = cur.time && prev.time ? cur.time === prev.time : true;

        if (!(samePrice && sameLogical && sameTime)) {
          deduped.push(cur);
        }
      }
    }

    this.points = deduped;
    this.updatedAt = Date.now();
  }

  /**
   * Convert chart anchors into screen pixel coordinates.
   * Returns array of { x, y, logical, price, time } or null for unconvertible points.
   */
  getScreenPoints(coordHelper) {
    if (!this.points || this.points.length === 0 || !coordHelper) return [];

    const screenPoints = [];
    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const x = coordHelper.pointToScreenX(pt);
      const y = coordHelper.priceToScreenY(pt.price);

      if (x !== null && y !== null && !isNaN(x) && !isNaN(y)) {
        screenPoints.push({
          x,
          y,
          index: i,
          price: pt.price,
          logical: pt.logical,
          time: pt.time,
        });
      }
    }
    return screenPoints;
  }

  /**
   * Bounding box of the entire path in screen coordinates.
   * Used for toolbar placement, culling, and halo highlights.
   */
  getScreenBounds(coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length === 0) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);

    return {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
      width,
      height,
      pointsCount: pts.length,
    };
  }

  /**
   * Check if ALL segments of the path are off-screen.
   * Only skip rendering if no segment intersects the visible canvas pane.
   */
  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    const margin = 50; // generous margin for line width and arrowheads
    if (bounds.right < -margin) return true;
    if (bounds.left > mediaWidth + margin) return true;
    if (bounds.bottom < -margin) return true;
    if (bounds.top > mediaHeight + margin) return true;
    return false;
  }

  /**
   * Get interactive anchor handles for every placed point.
   */
  getHandles(coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length === 0) return [];

    return pts.map((p, idx) => ({
      id: `pt_${idx}`,
      handleIndex: idx,
      pointIndex: idx,
      x: p.x,
      y: p.y,
      cursor: 'move',
      type: 'point',
    }));
  }

  /**
   * Hit test a screen coordinate (x, y) in pixel space:
   * 1. Handles check (if selected): radius tolerance (HANDLE_HIT_RADIUS)
   * 2. Arrowheads check
   * 3. Line segments check: distance-to-segment tolerance (HIT_TEST_DISTANCE)
   * Top-most shape wins.
   */
  hitTest(x, y, coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length === 0) return { hit: false };

    // 1. Check handles if drawing is selected
    if (this.isSelected && !this.locked) {
      const hitRadius = PATH_CONFIG.HANDLE_HIT_RADIUS || 9;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dist = Math.hypot(x - p.x, y - p.y);
        if (dist <= hitRadius) {
          return {
            hit: true,
            type: 'handle',
            handleIndex: i,
            handleId: `pt_${i}`,
            cursor: 'move',
            drawing: this,
          };
        }
      }
    }

    // 2. Check line segments (and arrowheads along segments)
    if (pts.length >= 2) {
      const lineTolerance = PATH_CONFIG.HIT_TEST_DISTANCE || 6;
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const dist = this._pointToSegmentDistance(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist <= lineTolerance) {
          return {
            hit: true,
            type: 'line',
            segmentIndex: i,
            cursor: this.locked ? 'pointer' : 'grab',
            drawing: this,
          };
        }
      }
    } else if (pts.length === 1) {
      // Single point preview during initial click
      const dist = Math.hypot(x - pts[0].x, y - pts[0].y);
      if (dist <= 8) {
        return {
          hit: true,
          type: 'handle',
          handleIndex: 0,
          handleId: 'pt_0',
          cursor: 'move',
          drawing: this,
        };
      }
    }

    return { hit: false };
  }

  /**
   * Distance from point (px, py) to line segment (x1, y1)-(x2, y2)
   */
  _pointToSegmentDistance(px, py, x1, y1, x2, y2) {
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
   * Background Pane View (zOrder: 'bottom')
   * Path is a stroke-based tool, so no background fill needed.
   */
  renderBackground(ctx, scope, coordHelper) {
    // No background fill for Path tool
  }

  /**
   * Foreground Pane View (zOrder: 'normal')
   * Renders:
   * 1. Straight segments between consecutive points with round joins and caps.
   * 2. Arrowheads at start/end drawn in pixel space.
   * 3. Selection halos and anchor handles with hover highlights.
   * 4. Strict clipping to chart pane (never over price/time axes).
   */
  renderForeground(ctx, scope, coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length === 0) return;

    const bounds = this.getScreenBounds(coordHelper);
    if (this.isOffScreen(bounds, scope.mediaSize.width, scope.mediaSize.height)) {
      return;
    }

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr, mediaSize } = scope;
    const dpr = Math.max(hpr, vpr);

    ctx.save();

    // Strict clipping to chart pane to prevent drawing over scale axes
    ctx.beginPath();
    ctx.rect(0, 0, Math.round(mediaSize.width * hpr), Math.round(mediaSize.height * vpr));
    ctx.clip();

    const lineWidth = Math.max(1, Math.round((this.line.width || 2) * dpr));
    const opacity = Math.max(0, Math.min(1, this.line.opacity !== undefined ? this.line.opacity : 1));
    const strokeColor = this.line.color || '#2962ff';

    // 1. Render Path Line Segments
    if (pts.length >= 2) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = opacity;

      if (this.line.style === 'dashed') {
        ctx.setLineDash([6 * dpr, 4 * dpr]);
      } else if (this.line.style === 'dotted') {
        ctx.setLineDash([2 * dpr, 3 * dpr]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.moveTo(Math.round(pts[0].x * hpr), Math.round(pts[0].y * vpr));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(Math.round(pts[i].x * hpr), Math.round(pts[i].y * vpr));
      }
      ctx.stroke();
      ctx.restore();

      // 2. Render Arrowheads (Start & End) in Pixel Space
      if (this.arrows.start && pts.length >= 2) {
        // Arrow pointing outward at start (oriented along first segment from p1 -> p0)
        this._renderArrowhead(
          ctx,
          pts[1].x * hpr, pts[1].y * vpr,
          pts[0].x * hpr, pts[0].y * vpr,
          strokeColor,
          opacity,
          lineWidth,
          dpr
        );
      }

      if (this.arrows.end && pts.length >= 2) {
        // Arrow pointing in direction of last segment (p[n-2] -> p[n-1])
        const last = pts.length - 1;
        this._renderArrowhead(
          ctx,
          pts[last - 1].x * hpr, pts[last - 1].y * vpr,
          pts[last].x * hpr, pts[last].y * vpr,
          strokeColor,
          opacity,
          lineWidth,
          dpr
        );
      }
    }

    // 3. Selection & Hover Halos
    if (this.isSelected || this.isHovered) {
      this._renderSelectionHalos(ctx, pts, hpr, vpr, dpr);
    }

    // 4. Anchor Handles (when selected and unlocked)
    if (this.isSelected && !this.locked) {
      this._renderHandles(ctx, pts, hpr, vpr, dpr);
    }

    ctx.restore();
  }

  /**
   * Render Arrowhead in pixel space so it remains undistorted at all aspect ratios.
   * fromX, fromY -> toX, toY (toX, toY is tip of arrow)
   */
  _renderArrowhead(ctx, fromX, fromY, toX, toY, color, opacity, lineWidth, dpr) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return;

    const angle = Math.atan2(dy, dx);
    const arrowLen = Math.max(12 * dpr, lineWidth * (PATH_CONFIG.ARROWHEAD_SIZE_MULTIPLIER || 4.5));
    const arrowAngle = PATH_CONFIG.ARROWHEAD_ANGLE_RAD || 0.488; // ~28 degrees

    const wing1X = toX - arrowLen * Math.cos(angle - arrowAngle);
    const wing1Y = toY - arrowLen * Math.sin(angle - arrowAngle);
    const wing2X = toX - arrowLen * Math.cos(angle + arrowAngle);
    const wing2Y = toY - arrowLen * Math.sin(angle + arrowAngle);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, Math.round(1 * dpr));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (PATH_CONFIG.ARROWHEAD_SHAPE === 'open') {
      ctx.beginPath();
      ctx.moveTo(wing1X, wing1Y);
      ctx.lineTo(toX, toY);
      ctx.lineTo(wing2X, wing2Y);
      ctx.stroke();
    } else {
      // Standard filled arrowhead (TradingView default)
      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(wing1X, wing1Y);
      ctx.lineTo(wing2X, wing2Y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Render Selection Halos along vertices
   */
  _renderSelectionHalos(ctx, pts, hpr, vpr, dpr) {
    ctx.save();
    ctx.strokeStyle = this.isSelected ? 'rgba(41, 98, 255, 0.35)' : 'rgba(41, 98, 255, 0.2)';
    ctx.lineWidth = Math.max(6 * dpr, (this.line.width || 2) * dpr + 6 * dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);

    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x * hpr, pts[0].y * vpr);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * hpr, pts[i].y * vpr);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Render anchor point handles at each vertex with hover highlight.
   */
  _renderHandles(ctx, pts, hpr, vpr, dpr) {
    const handleRadius = Math.round(3.5 * dpr); // 7px diameter
    const handleBorderWidth = Math.max(1.5, Math.round(1.5 * dpr));

    ctx.save();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const hx = Math.round(p.x * hpr);
      const hy = Math.round(p.y * vpr);
      const isVertexSelected = (this.selectedHandleIndex === i);
      const isVertexHovered = (this.hoveredHandleIndex === i);

      // Outer glow for selected or hovered handle
      if (isVertexSelected || isVertexHovered) {
        ctx.beginPath();
        ctx.arc(hx, hy, handleRadius + 3 * dpr, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(41, 98, 255, 0.25)';
        ctx.fill();
      }

      // Handle Body
      ctx.beginPath();
      ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = isVertexSelected ? (this.line.color || '#2962ff') : '#ffffff';
      ctx.fill();

      // Handle Border
      ctx.lineWidth = handleBorderWidth;
      ctx.strokeStyle = this.line.color || '#2962ff';
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Insert a point on a segment between points[segmentIndex] and points[segmentIndex + 1]
   */
  insertPoint(segmentIndex, chartPos) {
    if (!chartPos || isNaN(chartPos.price)) return false;
    const insertIdx = segmentIndex + 1;
    this.points.splice(insertIdx, 0, {
      price: chartPos.price,
      logical: chartPos.logical,
      time: chartPos.time || null,
    });
    this.updatedAt = Date.now();
    return true;
  }

  /**
   * Delete a point at specified index (keeps at least 2 points).
   */
  removePoint(pointIndex) {
    if (!this.points || this.points.length <= 2) return false;
    if (pointIndex < 0 || pointIndex >= this.points.length) return false;

    this.points.splice(pointIndex, 1);
    this.selectedHandleIndex = null;
    this.updatedAt = Date.now();
    return true;
  }

  /**
   * Deep clone of the path drawing.
   */
  clone() {
    return new PathDrawing({
      type: 'path',
      points: this.points.map(p => ({
        price: p.price,
        logical: p.logical !== undefined ? p.logical : undefined,
        time: p.time || null,
      })),
      line: { ...this.line },
      arrows: { ...this.arrows },
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: (this.zIndex || 1) + 1,
    });
  }

  /**
   * Serialize to JSON
   */
  toJSON() {
    return {
      id: this.id,
      type: 'path',
      points: this.points.map(pt => ({
        price: pt.price,
        logical: pt.logical,
        time: pt.time,
      })),
      line: { ...this.line },
      arrows: { ...this.arrows },
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: this.zIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Recreate PathDrawing from JSON
   */
  static fromJSON(data) {
    return new PathDrawing(data);
  }
}
