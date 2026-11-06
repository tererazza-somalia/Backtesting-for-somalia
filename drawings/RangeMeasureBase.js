/**
 * RangeMeasureBase - Abstract base class for range measurement tools.
 * Foundation for:
 * 1. PriceRangeDrawing (vertical price measurement: diff, %, pips)
 * 2. DateRangeDrawing (horizontal time measurement: bars, time span)
 * 3. DateAndPriceRangeDrawing (2D measurement: price diff, %, pips, bars, time)
 *
 * Anchors are ALWAYS stored in CHART coordinates:
 * points: [ { time, logical, price }, { time, logical, price } ]
 *
 * Keeps original point order for SIGN calculation (direction matters: up vs down, left vs right),
 * while normalizing bounding boxes geometrically for crisp canvas rendering.
 */

import { BaseDrawing } from './BaseDrawing.js';
import { PRICE_RANGE_CONFIG, INTERACTION_CONSTANTS, getSymbolInfo } from './constants.js';

export class RangeMeasureBase extends BaseDrawing {
  constructor(options = {}) {
    super(options);

    // Two anchor points in chart coordinates (never raw screen pixels)
    const rawPoints = options.points && Array.isArray(options.points) ? options.points : [];
    this.points = [
      rawPoints[0] ? { ...rawPoints[0] } : { price: 0, time: null, logical: 0 },
      rawPoints[1] ? { ...rawPoints[1] } : { price: 0, time: null, logical: 0 },
    ];

    // Boundary Line style (the two price level horizontal lines)
    this.line = {
      color: options.line?.color || '#2962ff',
      width: options.line?.width !== undefined ? options.line.width : 2,
      opacity: options.line?.opacity !== undefined ? options.line.opacity : 1,
    };

    // Border outline style (box perimeter)
    this.border = {
      visible: options.border?.visible !== undefined ? Boolean(options.border.visible) : true,
      color: options.border?.color || this.line.color,
      width: options.border?.width !== undefined ? options.border.width : 1,
      style: options.border?.style || 'solid', // 'solid' | 'dashed' | 'dotted'
    };

    // Background fill
    this.background = {
      visible: options.background?.visible !== undefined ? Boolean(options.background.visible) : true,
      color: options.background?.color || this.line.color,
      opacity: options.background?.opacity !== undefined ? options.background.opacity : 0.2,
    };

    // "Extend" checkbox (continues horizontally across the entire chart pane)
    this.extendHorizontally = Boolean(options.extendHorizontally);

    // Stats configuration checklist
    this.stats = {
      priceRange: options.stats?.priceRange !== undefined ? Boolean(options.stats.priceRange) : true,
      percentChange: options.stats?.percentChange !== undefined ? Boolean(options.stats.percentChange) : true,
      pips: options.stats?.pips !== undefined ? Boolean(options.stats.pips) : true,
    };

    // Info Label styling
    this.label = {
      color: options.label?.color || '#ffffff',
      opacity: options.label?.opacity !== undefined ? options.label.opacity : 1,
      size: options.label?.size !== undefined ? options.label.size : 12,
      background: {
        visible: options.label?.background?.visible !== undefined ? Boolean(options.label.background.visible) : true,
        color: options.label?.background?.color || '#1e222d',
        opacity: options.label?.background?.opacity !== undefined ? options.label.background.opacity : 0.88,
      },
    };

    // Custom text note (separate from measurement stats)
    this.text = {
      content: options.text?.content || '',
      color: options.text?.color || '#ffffff',
      size: options.text?.size !== undefined ? options.text.size : 12,
      bold: Boolean(options.text?.bold),
      italic: Boolean(options.text?.italic),
    };

    // Internal cache for interactive bounds
    this._labelBounds = null;
    this._textBounds = null;
  }

  get p1() {
    return this.points[0];
  }

  set p1(val) {
    this.points[0] = val;
  }

  get p2() {
    return this.points[1];
  }

  set p2(val) {
    this.points[1] = val;
  }

  /**
   * Check if drawing is degenerate (both prices equal).
   */
  isDegenerate() {
    if (!this.points || this.points.length < 2) return true;
    return Math.abs(this.points[0].price - this.points[1].price) < 1e-9;
  }

  /**
   * Normalize point data without corrupting point order (direction matters for stats sign!).
   */
  normalize() {
    if (!this.points || this.points.length < 2) {
      this.points = [
        { price: 0, time: null, logical: 0 },
        { price: 0, time: null, logical: 0 },
      ];
    }
    this.updatedAt = Date.now();
  }

  /**
   * SINGLE MODULAR FUNCTION: Decide how the box's time width is calculated.
   * By default: spans horizontally from Point 1's bar/coordinate to Point 2's bar/coordinate.
   * If both points are at the exact same bar, widens by DEFAULT_BOX_WIDTH_BARS so the box is visible.
   * If extendHorizontally is active, spans across the entire visible chart pane.
   */
  computeTimeSpan(p1, p2, coordHelper) {
    let x1 = coordHelper.pointToScreenX(p1);
    let x2 = coordHelper.pointToScreenX(p2);

    const mediaW = (coordHelper.mediaWidth && coordHelper.mediaWidth > 0)
      ? coordHelper.mediaWidth
      : (window.innerWidth || 2000);

    if (this.extendHorizontally) {
      return {
        startX: 0,
        endX: mediaW,
        left: 0,
        right: mediaW,
        rawX1: x1,
        rawX2: x2,
        isExtended: true,
      };
    }

    // If both points have the same screen coordinate (e.g. single click or placed on same bar),
    // default the box width to a visible width in bars or pixels.
    if (x1 !== null && x2 !== null && Math.abs(x1 - x2) < 2) {
      const defaultSpan = (PRICE_RANGE_CONFIG.DEFAULT_BOX_WIDTH_BARS || 6) * 12;
      x2 = x1 + defaultSpan;
    }

    if (x1 === null && x2 !== null) x1 = x2 - 60;
    if (x2 === null && x1 !== null) x2 = x1 + 60;
    if (x1 === null && x2 === null) {
      x1 = 0;
      x2 = mediaW;
    }

    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);

    return {
      startX: x1,
      endX: x2,
      left,
      right,
      rawX1: x1,
      rawX2: x2,
      isExtended: false,
    };
  }

  /**
   * Convert chart coordinates to screen rectangle bounds:
   * { left, top, right, bottom, width, height, y1, y2, rawX1, rawX2, isUpward, isFlippedX }
   */
  getScreenBounds(coordHelper) {
    if (!this.points || this.points.length < 2 || !coordHelper) return null;

    const y1 = coordHelper.priceToScreenY(this.points[0].price);
    const y2 = coordHelper.priceToScreenY(this.points[1].price);

    if (y1 === null || y2 === null) return null;

    const timeSpan = this.computeTimeSpan(this.points[0], this.points[1], coordHelper);
    if (!timeSpan) return null;

    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);

    return {
      left: timeSpan.left,
      right: timeSpan.right,
      top,
      bottom,
      width: Math.max(0, timeSpan.right - timeSpan.left),
      height: Math.max(0, bottom - top),
      y1, // Screen Y of Anchor 1 (p1)
      y2, // Screen Y of Anchor 2 (p2)
      rawX1: timeSpan.rawX1,
      rawX2: timeSpan.rawX2,
      isExtended: timeSpan.isExtended,
      isUpward: this.points[1].price >= this.points[0].price,
      isFlippedX: (timeSpan.rawX2 !== null && timeSpan.rawX1 !== null) ? (timeSpan.rawX2 < timeSpan.rawX1) : false,
    };
  }

  /**
   * Spatial off-screen check.
   */
  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    if (!this.extendHorizontally) {
      if (bounds.right < 0 || bounds.left > mediaWidth) return true;
    }
    if (bounds.bottom < -100 || bounds.top > mediaHeight + 100) return true;
    return false;
  }

  /**
   * Compute directional measurement statistics.
   * Direction matters: p2 - p1!
   */
  computeStats(symbolInfo) {
    if (!this.points || this.points.length < 2) {
      return {
        deltaPrice: 0,
        percentChange: 0,
        barsCount: 0,
        pips: null,
        isUpward: true,
      };
    }

    const p1 = this.points[0];
    const p2 = this.points[1];

    const deltaPrice = p2.price - p1.price;
    const percentChange = (p1.price !== 0 && !isNaN(p1.price))
      ? (deltaPrice / p1.price) * 100
      : 0;

    const barsCount = (p2.logical !== undefined && p1.logical !== undefined && p2.logical !== null && p1.logical !== null)
      ? Math.round(p2.logical - p1.logical)
      : 0;

    // Symbol pip / minimum tick size lookup
    let pips = null;
    let pipSize = null;

    if (symbolInfo) {
      pipSize = symbolInfo.pipSize || symbolInfo.minTick || null;
    }

    if (pipSize && pipSize > 0) {
      pips = deltaPrice / pipSize;
    }

    return {
      deltaPrice,
      percentChange,
      barsCount,
      pips,
      pipSize,
      isUpward: deltaPrice >= 0,
      symbolInfo,
    };
  }

  /**
   * Returns 8 interactive handles in screen space:
   * - 2 primary anchors (p1, p2)
   * - 2 complementary corners (c3, c4)
   * - 4 edge midpoints (tm, bm, lm, rm)
   */
  getHandles(coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds) return [];

    const x1 = bounds.rawX1 !== null ? bounds.rawX1 : bounds.left;
    const x2 = bounds.rawX2 !== null ? bounds.rawX2 : bounds.right;
    const y1 = bounds.y1;
    const y2 = bounds.y2;

    const left = bounds.left;
    const right = bounds.right;
    const top = bounds.top;
    const bottom = bounds.bottom;

    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;

    return [
      { id: 'p1', x: x1, y: y1, cursor: 'nwse-resize', type: 'anchor', pointIndex: 0 },
      { id: 'p2', x: x2, y: y2, cursor: 'nwse-resize', type: 'anchor', pointIndex: 1 },
      { id: 'c3', x: x1, y: y2, cursor: 'nesw-resize', type: 'corner' },
      { id: 'c4', x: x2, y: y1, cursor: 'nesw-resize', type: 'corner' },
      { id: 'tm', x: midX, y: top, cursor: 'ns-resize', type: 'edge' },
      { id: 'bm', x: midX, y: bottom, cursor: 'ns-resize', type: 'edge' },
      { id: 'lm', x: left, y: midY, cursor: 'ew-resize', type: 'edge' },
      { id: 'rm', x: right, y: midY, cursor: 'ew-resize', type: 'edge' },
    ];
  }

  /**
   * Update anchor points when dragging a handle.
   */
  updateHandle(handleId, newLogical, newPrice, newTime) {
    if (this.locked) return;

    if (handleId === 'p1') {
      if (newPrice !== null && !isNaN(newPrice)) this.points[0].price = newPrice;
      if (newLogical !== null && !isNaN(newLogical)) this.points[0].logical = newLogical;
      if (newTime) this.points[0].time = newTime;
    } else if (handleId === 'p2') {
      if (newPrice !== null && !isNaN(newPrice)) this.points[1].price = newPrice;
      if (newLogical !== null && !isNaN(newLogical)) this.points[1].logical = newLogical;
      if (newTime) this.points[1].time = newTime;
    } else if (handleId === 'c3') {
      // Corner 3: x of p1, y of p2
      if (newLogical !== null && !isNaN(newLogical)) this.points[0].logical = newLogical;
      if (newTime) this.points[0].time = newTime;
      if (newPrice !== null && !isNaN(newPrice)) this.points[1].price = newPrice;
    } else if (handleId === 'c4') {
      // Corner 4: x of p2, y of p1
      if (newLogical !== null && !isNaN(newLogical)) this.points[1].logical = newLogical;
      if (newTime) this.points[1].time = newTime;
      if (newPrice !== null && !isNaN(newPrice)) this.points[0].price = newPrice;
    } else if (handleId === 'tm') {
      // Top midpoint moves the top price anchor
      if (newPrice !== null && !isNaN(newPrice)) {
        if (this.points[0].price >= this.points[1].price) {
          this.points[0].price = newPrice;
        } else {
          this.points[1].price = newPrice;
        }
      }
    } else if (handleId === 'bm') {
      // Bottom midpoint moves the bottom price anchor
      if (newPrice !== null && !isNaN(newPrice)) {
        if (this.points[0].price <= this.points[1].price) {
          this.points[0].price = newPrice;
        } else {
          this.points[1].price = newPrice;
        }
      }
    } else if (handleId === 'lm') {
      // Left midpoint moves the leftmost logical anchor
      if (newLogical !== null && !isNaN(newLogical)) {
        const p1L = this.points[0].logical !== undefined ? this.points[0].logical : 0;
        const p2L = this.points[1].logical !== undefined ? this.points[1].logical : 0;
        if (p1L <= p2L) {
          this.points[0].logical = newLogical;
          if (newTime) this.points[0].time = newTime;
        } else {
          this.points[1].logical = newLogical;
          if (newTime) this.points[1].time = newTime;
        }
      }
    } else if (handleId === 'rm') {
      // Right midpoint moves the rightmost logical anchor
      if (newLogical !== null && !isNaN(newLogical)) {
        const p1L = this.points[0].logical !== undefined ? this.points[0].logical : 0;
        const p2L = this.points[1].logical !== undefined ? this.points[1].logical : 0;
        if (p1L >= p2L) {
          this.points[0].logical = newLogical;
          if (newTime) this.points[0].time = newTime;
        } else {
          this.points[1].logical = newLogical;
          if (newTime) this.points[1].time = newTime;
        }
      }
    }

    this.updatedAt = Date.now();
  }

  /**
   * Hit test a screen coordinate (x, y) against handles, label, border lines, and body fill.
   */
  hitTest(x, y, coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds) return { hit: false };

    // 1. Check handles if selected and unlocked
    if (this.isSelected && !this.locked) {
      const handles = this.getHandles(coordHelper);
      const hitRadius = PRICE_RANGE_CONFIG.HANDLE_HIT_RADIUS || 9;
      for (const h of handles) {
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

    // 2. Check info label badge bounds
    if (this._labelBounds) {
      const lb = this._labelBounds;
      if (x >= lb.left && x <= lb.right && y >= lb.top && y <= lb.bottom) {
        return {
          hit: true,
          type: 'label',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }

    // 3. Check custom text note bounds
    if (this.text.content && this._textBounds) {
      const tb = this._textBounds;
      if (x >= tb.left && x <= tb.right && y >= tb.top && y <= tb.bottom) {
        return {
          hit: true,
          type: 'text',
          cursor: this.locked ? 'pointer' : 'text',
          drawing: this,
        };
      }
    }

    // 4. Check horizontal boundary lines and box borders
    const hitDist = PRICE_RANGE_CONFIG.BORDER_HIT_DISTANCE || 6;
    const nearTop = Math.abs(y - bounds.top) <= hitDist && x >= bounds.left - 4 && x <= bounds.right + 4;
    const nearBottom = Math.abs(y - bounds.bottom) <= hitDist && x >= bounds.left - 4 && x <= bounds.right + 4;
    const nearLeft = (!this.extendHorizontally) && Math.abs(x - bounds.left) <= hitDist && y >= bounds.top - 4 && y <= bounds.bottom + 4;
    const nearRight = (!this.extendHorizontally) && Math.abs(x - bounds.right) <= hitDist && y >= bounds.top - 4 && y <= bounds.bottom + 4;

    if (nearTop || nearBottom || nearLeft || nearRight) {
      return {
        hit: true,
        type: 'border',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    // 5. Check interior fill body
    if (x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom) {
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
   * Serialize Range measurement drawing to clean JSON
   */
  toJSON() {
    return {
      ...super.toJSON(),
      type: this.type,
      points: this.points.map(pt => ({
        time: pt.time,
        price: pt.price,
        logical: pt.logical,
      })),
      line: { ...this.line },
      border: { ...this.border },
      background: { ...this.background },
      extendHorizontally: this.extendHorizontally,
      stats: { ...this.stats },
      label: {
        color: this.label.color,
        opacity: this.label.opacity,
        size: this.label.size,
        background: { ...this.label.background },
      },
      text: { ...this.text },
    };
  }
}
