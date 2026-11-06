/**
 * BrushDrawing - TradingView-style Freehand Drawing Tool.
 *
 * PURPOSE:
 * A freehand drawing tool for annotating the chart. It is not bound to any
 * specific shape. Used for quick marks, circling areas, and drawing curved
 * lines by hand. Designed so a future "Highlighter" tool can be added as a
 * thicker, semi-transparent variant.
 *
 * DATA MODEL:
 * All points are stored strictly in CHART coordinates ({ logical, price, time }).
 * Never screen pixels. Converted dynamically on every render frame via
 * Series Primitive coordinate helpers. Supports future bars via logical index.
 *
 * RENDERING & CACHING:
 * 1. BackgroundPaneView (zOrder: 'bottom') renders optional fill BEHIND candles.
 * 2. ForegroundPaneView (zOrder: 'normal') renders smoothed crisp stroke and handles.
 * 3. Path2D paths are cached and rebuilt only when points or viewport coordinates change.
 * 4. Quadratic midpoint smoothing is applied in pixel space at render time.
 */

import { BaseDrawing } from './BaseDrawing.js';
import { BRUSH_DEFAULTS, BRUSH_CONFIG, INTERACTION_CONSTANTS } from './constants.js';

export class BrushDrawing extends BaseDrawing {
  constructor(options = {}) {
    super({ ...options, type: 'brush' });

    // Anchor points in chart coordinates ({ logical, price, time })
    this.points = options.points ? options.points.map(pt => ({
      logical: pt.logical !== undefined && pt.logical !== null ? Number(pt.logical) : 0,
      price: pt.price !== undefined && pt.price !== null ? Number(pt.price) : 0,
      time: pt.time !== undefined ? pt.time : null,
    })) : [];

    // Line stroke styling
    this.line = {
      color: options.line?.color || BRUSH_DEFAULTS.LINE.color,
      width: options.line?.width !== undefined ? Number(options.line.width) : BRUSH_DEFAULTS.LINE.width,
      opacity: options.line?.opacity !== undefined ? Number(options.line.opacity) : BRUSH_DEFAULTS.LINE.opacity,
      style: options.line?.style || BRUSH_DEFAULTS.LINE.style, // 'solid'
    };

    // Background fill configuration (closes last point back to first)
    this.background = {
      visible: options.background?.visible !== undefined ? Boolean(options.background.visible) : BRUSH_DEFAULTS.BACKGROUND.visible,
      color: options.background?.color || options.line?.color || BRUSH_DEFAULTS.BACKGROUND.color,
      opacity: options.background?.opacity !== undefined ? Number(options.background.opacity) : BRUSH_DEFAULTS.BACKGROUND.opacity,
    };

    // Tool variant (for future Highlighter extension: 'brush' | 'highlighter')
    this.toolVariant = options.toolVariant || 'brush';

    // Path2D caches
    this._cachedStrokePath = null;
    this._cachedFillPath = null;
    this._cachedKey = null;
    this._cachedChartBounds = null;
  }

  /**
   * Invalidate cached Path2D objects and chart bounds.
   */
  invalidateCache() {
    this._cachedStrokePath = null;
    this._cachedFillPath = null;
    this._cachedKey = null;
    this._cachedChartBounds = null;
  }

  /**
   * Filter invalid coordinates and deduplicate adjacent identical points.
   */
  normalize() {
    if (!this.points || this.points.length === 0) {
      this.points = [];
      this.invalidateCache();
      return;
    }

    const valid = [];
    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      if (p && !isNaN(p.price) && p.logical !== undefined && !isNaN(p.logical)) {
        if (valid.length === 0) {
          valid.push({ logical: p.logical, price: p.price, time: p.time || null });
        } else {
          const prev = valid[valid.length - 1];
          const dLogical = Math.abs(p.logical - prev.logical);
          const dPrice = Math.abs(p.price - prev.price);
          // Keep if moved sufficiently in chart space
          if (dLogical > 1e-4 || dPrice > 1e-6) {
            valid.push({ logical: p.logical, price: p.price, time: p.time || null });
          }
        }
      }
    }

    this.points = valid;
    this.invalidateCache();
    this.updatedAt = Date.now();
  }

  /**
   * Convert chart anchors into screen pixel coordinates.
   * Returns array of { x, y, logical, price, time, index }.
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
          logical: pt.logical,
          price: pt.price,
          time: pt.time,
        });
      }
    }
    return screenPoints;
  }

  /**
   * Get bounding box in chart coordinate space for fast spatial culling.
   */
  getChartBounds() {
    if (this._cachedChartBounds) return this._cachedChartBounds;
    if (!this.points || this.points.length === 0) return null;

    let minLogical = Infinity;
    let maxLogical = -Infinity;
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    for (let i = 0; i < this.points.length; i++) {
      const p = this.points[i];
      if (p.logical < minLogical) minLogical = p.logical;
      if (p.logical > maxLogical) maxLogical = p.logical;
      if (p.price < minPrice) minPrice = p.price;
      if (p.price > maxPrice) maxPrice = p.price;
    }

    this._cachedChartBounds = { minLogical, maxLogical, minPrice, maxPrice };
    return this._cachedChartBounds;
  }

  /**
   * Bounding box of the entire stroke in screen coordinates.
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
   * Check if drawing is entirely outside the visible canvas pane.
   */
  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    const margin = Math.max(30, (this.line.width || 2) * 2);
    if (bounds.right < -margin) return true;
    if (bounds.left > mediaWidth + margin) return true;
    if (bounds.bottom < -margin) return true;
    if (bounds.top > mediaHeight + margin) return true;
    return false;
  }

  /**
   * Build or retrieve cached Path2D objects for stroke and fill.
   * Applies quadratic midpoint smoothing in pixel space.
   */
  _ensurePaths(pts) {
    if (!pts || pts.length === 0) {
      this._cachedStrokePath = null;
      this._cachedFillPath = null;
      return null;
    }

    // Build a lightweight cache key from count, endpoints, and bounds
    const p0 = pts[0];
    const pN = pts[pts.length - 1];
    const key = `${pts.length}_${p0.x.toFixed(1)}_${p0.y.toFixed(1)}_${pN.x.toFixed(1)}_${pN.y.toFixed(1)}`;

    if (this._cachedKey === key && this._cachedStrokePath && this._cachedFillPath) {
      return { strokePath: this._cachedStrokePath, fillPath: this._cachedFillPath };
    }

    const strokePath = new Path2D();
    const fillPath = new Path2D();

    if (pts.length === 1) {
      // Single point: small circular dot
      const radius = Math.max(1, (this.line.width || 2) / 2);
      strokePath.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2);
      fillPath.arc(pts[0].x, pts[0].y, radius, 0, Math.PI * 2);
    } else if (pts.length === 2) {
      // 2 points: straight line segment
      strokePath.moveTo(pts[0].x, pts[0].y);
      strokePath.lineTo(pts[1].x, pts[1].y);

      fillPath.moveTo(pts[0].x, pts[0].y);
      fillPath.lineTo(pts[1].x, pts[1].y);
      this._closeFillContour(fillPath, pts);
    } else {
      // 3+ points: Quadratic midpoint smoothing
      strokePath.moveTo(pts[0].x, pts[0].y);
      fillPath.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i < pts.length - 1; i++) {
        const midX = (pts[i].x + pts[i + 1].x) / 2;
        const midY = (pts[i].y + pts[i + 1].y) / 2;
        strokePath.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
        fillPath.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
      }

      // Connect to final point
      const last = pts[pts.length - 1];
      strokePath.lineTo(last.x, last.y);
      fillPath.lineTo(last.x, last.y);

      // Close the fill contour
      this._closeFillContour(fillPath, pts);
    }

    this._cachedStrokePath = strokePath;
    this._cachedFillPath = fillPath;
    this._cachedKey = key;

    return { strokePath, fillPath };
  }

  /**
   * Isolated function defining how background fill closes the freehand shape.
   * Strategy: connects the last point directly back to the first point with a straight line.
   */
  _closeFillContour(fillPath, pts) {
    const strategy = BRUSH_CONFIG.FILL_CLOSE_STRATEGY || 'straight-line';
    if (strategy === 'straight-line') {
      fillPath.closePath();
    } else {
      fillPath.closePath();
    }
  }

  /**
   * Background Pane View Renderer (zOrder: 'bottom')
   * Renders translucent background fill BEHIND candlestick bars.
   */
  renderBackground(ctx, scope, coordHelper) {
    if (!this.background?.visible) return;

    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds || this.isOffScreen(bounds, scope.mediaSize.width, scope.mediaSize.height)) {
      return;
    }

    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length < 3) return; // Need at least 3 points to enclose an area

    const paths = this._ensurePaths(pts);
    if (!paths || !paths.fillPath) return;

    ctx.save();
    const fillOpacity = this.background.opacity !== undefined ? Number(this.background.opacity) : 0.2;
    ctx.globalAlpha = Math.max(0, Math.min(1, fillOpacity));
    ctx.fillStyle = this.background.color || this.line.color || '#2962ff';
    ctx.fill(paths.fillPath);
    ctx.restore();
  }

  /**
   * Foreground Pane View Renderer (zOrder: 'normal')
   * Renders the smoothed stroke, selection bounding box, and 4 corner resize handles.
   */
  renderForeground(ctx, scope, coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds || this.isOffScreen(bounds, scope.mediaSize.width, scope.mediaSize.height)) {
      return;
    }

    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length === 0) return;

    const paths = this._ensurePaths(pts);
    if (!paths || !paths.strokePath) return;

    ctx.save();

    // Line cap and join for smooth organic curves
    ctx.lineCap = BRUSH_CONFIG.LINE_CAP || 'round';
    ctx.lineJoin = BRUSH_CONFIG.LINE_JOIN || 'round';
    ctx.lineWidth = Math.max(1, this.line.width || 2);
    ctx.strokeStyle = this.line.color || '#2962ff';

    const lineOpacity = this.line.opacity !== undefined ? Number(this.line.opacity) : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, lineOpacity));

    if (this.line.style === 'dashed') {
      ctx.setLineDash([6, 6]);
    } else if (this.line.style === 'dotted') {
      ctx.setLineDash([2, 4]);
    } else {
      ctx.setLineDash([]);
    }

    // Stroke the smooth curve
    ctx.stroke(paths.strokePath);

    ctx.restore();

    // Selection UI: Bounding box with 4 corner handles
    if (this.isSelected) {
      this._renderSelectionBox(ctx, bounds);
    } else if (this.isHovered) {
      this._renderHoverHalo(ctx, paths.strokePath);
    }
  }

  /**
   * Render dashed bounding box and corner handles when selected.
   */
  _renderSelectionBox(ctx, bounds) {
    ctx.save();
    const pad = 6;
    const boxX = bounds.left - pad;
    const boxY = bounds.top - pad;
    const boxW = bounds.width + pad * 2;
    const boxH = bounds.height + pad * 2;

    // Dashed bounding rectangle
    ctx.strokeStyle = INTERACTION_CONSTANTS.SELECTED_BORDER_COLOR || '#2962ff';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    // Corner handles
    if (!this.locked) {
      const handleSize = BRUSH_CONFIG.HANDLE_SIZE || 7;
      const half = handleSize / 2;
      const corners = [
        { x: boxX, y: boxY },               // tl
        { x: boxX + boxW, y: boxY },        // tr
        { x: boxX + boxW, y: boxY + boxH }, // br
        { x: boxX, y: boxY + boxH },        // bl
      ];

      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = 1.5;

      for (let i = 0; i < corners.length; i++) {
        const c = corners[i];
        ctx.fillRect(c.x - half, c.y - half, handleSize, handleSize);
        ctx.strokeRect(c.x - half, c.y - half, handleSize, handleSize);
      }
    }

    ctx.restore();
  }

  /**
   * Render subtle hover halo along the stroke when hovered.
   */
  _renderHoverHalo(ctx, strokePath) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = (this.line.width || 2) + 6;
    ctx.strokeStyle = 'rgba(41, 98, 255, 0.2)';
    ctx.setLineDash([]);
    ctx.stroke(strokePath);
    ctx.restore();
  }

  /**
   * Get interactive handles for selection: 4 corner handles on bounding box.
   */
  getHandles(coordHelper) {
    if (!this.isSelected || this.locked) return [];

    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds) return [];

    const pad = 6;
    const boxX = bounds.left - pad;
    const boxY = bounds.top - pad;
    const boxW = bounds.width + pad * 2;
    const boxH = bounds.height + pad * 2;

    return [
      { id: 'tl', x: boxX, y: boxY, cursor: 'nwse-resize', type: 'corner' },
      { id: 'tr', x: boxX + boxW, y: boxY, cursor: 'nesw-resize', type: 'corner' },
      { id: 'br', x: boxX + boxW, y: boxY + boxH, cursor: 'nwse-resize', type: 'corner' },
      { id: 'bl', x: boxX, y: boxY + boxH, cursor: 'nesw-resize', type: 'corner' },
    ];
  }

  /**
   * Hit test a screen coordinate (x, y) in pixel space:
   * 1. 4 Corner Handles check (if selected): radius HANDLE_HIT_RADIUS
   * 2. Stroke check: distance to smoothed polyline <= HIT_TEST_DISTANCE
   * 3. Background fill check (if visible): point-in-polygon ray casting
   */
  hitTest(x, y, coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts || pts.length === 0) return { hit: false };

    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds) return { hit: false };

    const hitTolerance = Math.max(BRUSH_CONFIG.HIT_TEST_DISTANCE || 6, (this.line.width || 2) / 2 + 3);

    // Fast reject using bounding box
    if (
      x < bounds.left - hitTolerance - 10 ||
      x > bounds.right + hitTolerance + 10 ||
      y < bounds.top - hitTolerance - 10 ||
      y > bounds.bottom + hitTolerance + 10
    ) {
      return { hit: false };
    }

    // 1. Check Corner Handles if selected
    if (this.isSelected && !this.locked) {
      const handles = this.getHandles(coordHelper);
      const hitRadius = BRUSH_CONFIG.HANDLE_HIT_RADIUS || 9;

      for (let i = 0; i < handles.length; i++) {
        const h = handles[i];
        const dist = Math.hypot(x - h.x, y - h.y);
        if (dist <= hitRadius) {
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

    // 2. Check Distance to Stroke Polyline
    if (pts.length >= 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        const dist = this._pointToSegmentDistance(x, y, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        if (dist <= hitTolerance) {
          return {
            hit: true,
            type: 'line',
            cursor: this.locked ? 'pointer' : 'grab',
            drawing: this,
          };
        }
      }
    } else if (pts.length === 1) {
      const dist = Math.hypot(x - pts[0].x, y - pts[0].y);
      if (dist <= hitTolerance + 4) {
        return {
          hit: true,
          type: 'line',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }

    // 3. Check Fill Area (Point-in-Polygon) if background is visible
    if (this.background?.visible && pts.length >= 3) {
      if (this._isPointInPolygon(x, y, pts)) {
        return {
          hit: true,
          type: 'body',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }

    return { hit: false };
  }

  /**
   * Distance from point (px, py) to line segment (x1, y1)-(x2, y2).
   */
  _pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
  }

  /**
   * Point-in-polygon ray casting algorithm.
   */
  _isPointInPolygon(px, py, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y;
      const xj = pts[j].x, yj = pts[j].y;

      const intersect = ((yi > py) !== (yj > py)) &&
        (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /**
   * Move drawing by delta chart coordinates.
   */
  move(deltaLogical, deltaPrice) {
    if (this.locked) return;
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i].logical !== undefined) {
        this.points[i].logical += deltaLogical;
      }
      this.points[i].price += deltaPrice;
    }
    this.invalidateCache();
    this.updatedAt = Date.now();
  }

  /**
   * Scale entire freehand stroke relative to opposing corner anchor.
   * Controlled by BRUSH_CONFIG.ENABLE_CORNER_SCALE constant.
   */
  scaleFromCorner(handleId, newLogical, newPrice, origPoints, origBounds) {
    if (!BRUSH_CONFIG.ENABLE_CORNER_SCALE || this.locked) return;
    if (!origBounds || !origPoints || origPoints.length === 0) return;

    const { minLogical, maxLogical, minPrice, maxPrice } = origBounds;
    const origLogicalSpan = maxLogical - minLogical;
    const origPriceSpan = maxPrice - minPrice;

    if (Math.abs(origLogicalSpan) < 1e-4 || Math.abs(origPriceSpan) < 1e-6) return;

    // Determine opposite fixed anchor
    let anchorLogical, anchorPrice;
    if (handleId === 'br') {
      anchorLogical = minLogical;
      anchorPrice = maxPrice; // Top-Left is anchor
    } else if (handleId === 'tl') {
      anchorLogical = maxLogical;
      anchorPrice = minPrice; // Bottom-Right is anchor
    } else if (handleId === 'tr') {
      anchorLogical = minLogical;
      anchorPrice = minPrice; // Bottom-Left is anchor
    } else if (handleId === 'bl') {
      anchorLogical = maxLogical;
      anchorPrice = maxPrice; // Top-Right is anchor
    } else {
      return;
    }

    const scaleX = (newLogical - anchorLogical) / (handleId === 'br' || handleId === 'tr' ? origLogicalSpan : -origLogicalSpan);
    const scaleY = (newPrice - anchorPrice) / (handleId === 'br' || handleId === 'bl' ? -origPriceSpan : origPriceSpan);

    if (Math.abs(scaleX) < 1e-3 || Math.abs(scaleY) < 1e-3) return;

    for (let i = 0; i < this.points.length; i++) {
      const orig = origPoints[i];
      const relX = orig.logical - anchorLogical;
      const relY = orig.price - anchorPrice;

      this.points[i].logical = anchorLogical + relX * scaleX;
      this.points[i].price = anchorPrice + relY * scaleY;
    }

    this.invalidateCache();
    this.updatedAt = Date.now();
  }

  /**
   * Ramer-Douglas-Peucker (RDP) decimation in pixel space.
   * Reduces sample count while retaining curve fidelity and shape bounds.
   */
  static simplifyPoints(pts, tolerance = 0.8) {
    if (!pts || pts.length <= 2) return pts || [];

    const sqTolerance = tolerance * tolerance;

    function getSqSegmentDist(p, p1, p2) {
      let x = p1.x, y = p1.y;
      let dx = p2.x - x, dy = p2.y - y;

      if (dx !== 0 || dy !== 0) {
        const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = p2.x;
          y = p2.y;
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }

      dx = p.x - x;
      dy = p.y - y;
      return dx * dx + dy * dy;
    }

    function simplifyDPStep(points, first, last, sqTol, simplified) {
      let maxSqDist = sqTol;
      let index = -1;

      for (let i = first + 1; i < last; i++) {
        const sqDist = getSqSegmentDist(points[i], points[first], points[last]);
        if (sqDist > maxSqDist) {
          index = i;
          maxSqDist = sqDist;
        }
      }

      if (maxSqDist > sqTol && index !== -1) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTol, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTol, simplified);
      }
    }

    const simplified = [pts[0]];
    simplifyDPStep(pts, 0, pts.length - 1, sqTolerance, simplified);
    simplified.push(pts[pts.length - 1]);

    return simplified;
  }

  /**
   * Clone drawing (creates shifted duplicate).
   */
  clone() {
    const json = this.toJSON();
    delete json.id;
    json.createdAt = Date.now();
    json.updatedAt = Date.now();

    const cloned = BrushDrawing.fromJSON(json);
    cloned.move(2, 0); // Shift slightly
    return cloned;
  }

  /**
   * Serialize to JSON.
   */
  toJSON() {
    return {
      id: this.id,
      type: 'brush',
      points: this.points.map(pt => ({
        logical: pt.logical,
        price: pt.price,
        time: pt.time || null,
      })),
      line: { ...this.line },
      background: { ...this.background },
      toolVariant: this.toolVariant,
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: this.zIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * Deserialize from JSON.
   */
  static fromJSON(data) {
    return new BrushDrawing(data);
  }
}
