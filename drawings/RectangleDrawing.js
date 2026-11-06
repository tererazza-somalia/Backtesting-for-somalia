/**
 * RectangleDrawing - Full implementation of TradingView's axis-aligned Rectangle drawing tool.
 * Defined by two anchor points in chart coordinates: { time, price, logical }.
 */

import { BaseDrawing } from './BaseDrawing.js';
import { RECTANGLE_DEFAULTS, INTERACTION_CONSTANTS } from './constants.js';

export class RectangleDrawing extends BaseDrawing {
  constructor(options = {}) {
    super({ ...options, type: 'rectangle' });

    // Initialize styling with fallback to TradingView defaults
    this.border = {
      visible: options.border?.visible !== undefined ? options.border.visible : RECTANGLE_DEFAULTS.BORDER.visible,
      color: options.border?.color || RECTANGLE_DEFAULTS.BORDER.color,
      width: options.border?.width || RECTANGLE_DEFAULTS.BORDER.width,
      style: options.border?.style || RECTANGLE_DEFAULTS.BORDER.style,
    };

    this.middleLine = {
      enabled: options.middleLine?.enabled !== undefined ? options.middleLine.enabled : RECTANGLE_DEFAULTS.MIDDLE_LINE.enabled,
      color: options.middleLine?.color || RECTANGLE_DEFAULTS.MIDDLE_LINE.color,
      opacity: options.middleLine?.opacity !== undefined ? options.middleLine.opacity : RECTANGLE_DEFAULTS.MIDDLE_LINE.opacity,
      width: options.middleLine?.width || RECTANGLE_DEFAULTS.MIDDLE_LINE.width,
      style: options.middleLine?.style || RECTANGLE_DEFAULTS.MIDDLE_LINE.style,
    };

    this.background = {
      visible: options.background?.visible !== undefined ? options.background.visible : RECTANGLE_DEFAULTS.BACKGROUND.visible,
      color: options.background?.color || RECTANGLE_DEFAULTS.BACKGROUND.color,
      opacity: options.background?.opacity !== undefined ? options.background.opacity : RECTANGLE_DEFAULTS.BACKGROUND.opacity,
    };

    this.extendLeft = Boolean(options.extendLeft !== undefined ? options.extendLeft : RECTANGLE_DEFAULTS.EXTEND_LEFT);
    this.extendRight = Boolean(options.extendRight !== undefined ? options.extendRight : RECTANGLE_DEFAULTS.EXTEND_RIGHT);

    this.text = {
      content: options.text?.content || RECTANGLE_DEFAULTS.TEXT.content,
      color: options.text?.color || RECTANGLE_DEFAULTS.TEXT.color,
      size: options.text?.size || RECTANGLE_DEFAULTS.TEXT.size,
      bold: Boolean(options.text?.bold),
      italic: Boolean(options.text?.italic),
      hAlign: options.text?.hAlign || RECTANGLE_DEFAULTS.TEXT.hAlign,
      vAlign: options.text?.vAlign || RECTANGLE_DEFAULTS.TEXT.vAlign,
      placement: options.text?.placement || RECTANGLE_DEFAULTS.TEXT.placement,
    };

    // Cached text layout metrics
    this._textBounds = null;
  }

  /**
   * Normalize points so points[0] represents (minLogical, maxPrice) and
   * points[1] represents (maxLogical, minPrice).
   * This guarantees consistent indexing regardless of the drag direction.
   */
  normalize() {
    if (!this.points || this.points.length < 2) return;
    const p1 = this.points[0];
    const p2 = this.points[1];

    const hasLogical = p1.logical !== undefined && p2.logical !== undefined;
    const minLogical = hasLogical ? Math.min(p1.logical, p2.logical) : undefined;
    const maxLogical = hasLogical ? Math.max(p1.logical, p2.logical) : undefined;

    const minTime = (p1.time && p2.time) ? Math.min(p1.time, p2.time) : (p1.time || p2.time);
    const maxTime = (p1.time && p2.time) ? Math.max(p1.time, p2.time) : (p2.time || p1.time);

    const maxPrice = Math.max(p1.price, p2.price);
    const minPrice = Math.min(p1.price, p2.price);

    this.points[0] = {
      logical: minLogical,
      time: (p1.logical <= p2.logical || p1.time <= p2.time) ? p1.time : p2.time,
      price: maxPrice, // top price in chart space
    };

    this.points[1] = {
      logical: maxLogical,
      time: (p1.logical <= p2.logical || p1.time <= p2.time) ? p2.time : p1.time,
      price: minPrice, // bottom price in chart space
    };
    this.updatedAt = Date.now();
  }

  /**
   * Convert points to screen pixel rectangle { left, top, right, bottom, width, height }
   */
  getScreenBounds(coordHelper) {
    if (!this.points || this.points.length < 2) return null;
    let x1 = coordHelper.pointToScreenX(this.points[0]);
    const y1 = coordHelper.priceToScreenY(this.points[0].price);
    let x2 = coordHelper.pointToScreenX(this.points[1]);
    const y2 = coordHelper.priceToScreenY(this.points[1].price);

    if (y1 === null || y2 === null) return null;

    const mediaW = (coordHelper.mediaWidth && coordHelper.mediaWidth > 0)
      ? coordHelper.mediaWidth
      : (window.innerWidth || 2000);

    // If one anchor is off-scale, handle extendLeft / extendRight gracefully
    if (x1 === null && this.extendLeft) x1 = 0;
    if (x2 === null && this.extendRight) x2 = mediaW;
    if (x1 === null && this.extendRight) x1 = 0;
    if (x2 === null && this.extendLeft) x2 = mediaW;

    if (x1 === null || x2 === null) return null;

    let left = Math.min(x1, x2);
    let right = Math.max(x1, x2);
    let top = Math.min(y1, y2);
    let bottom = Math.max(y1, y2);

    if (this.extendLeft) {
      left = 0;
    }
    if (this.extendRight) {
      right = mediaW;
    }

    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
      rawX1: x1,
      rawX2: x2,
      rawY1: y1,
      rawY2: y2,
    };
  }

  /**
   * Check if the rectangle is visible within the visible chart window.
   */
  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    if (!this.extendRight && bounds.right < 0) return true;
    if (!this.extendLeft && bounds.left > mediaWidth) return true;
    if (bounds.bottom < 0 || bounds.top > mediaHeight) return true;
    return false;
  }

  /**
   * Get 8 interactive resize handles in screen space:
   * 4 corners: tl, tr, br, bl
   * 4 edge midpoints: tm, mr, bm, ml
   * Keeps handles positioned at anchors even if extendLeft / extendRight is active.
   */
  getHandles(coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds) return [];

    const anchorLeft = Math.min(bounds.rawX1, bounds.rawX2);
    const anchorRight = Math.max(bounds.rawX1, bounds.rawX2);
    const { top, bottom } = bounds;
    const midX = (anchorLeft + anchorRight) / 2;
    const midY = (top + bottom) / 2;

    return [
      { id: 'tl', x: anchorLeft, y: top, cursor: 'nwse-resize', edge: 'top-left' },
      { id: 'tm', x: midX, y: top, cursor: 'ns-resize', edge: 'top' },
      { id: 'tr', x: anchorRight, y: top, cursor: 'nesw-resize', edge: 'top-right' },
      { id: 'mr', x: anchorRight, y: midY, cursor: 'ew-resize', edge: 'right' },
      { id: 'br', x: anchorRight, y: bottom, cursor: 'nwse-resize', edge: 'bottom-right' },
      { id: 'bm', x: midX, y: bottom, cursor: 'ns-resize', edge: 'bottom' },
      { id: 'bl', x: anchorLeft, y: bottom, cursor: 'nesw-resize', edge: 'bottom-left' },
      { id: 'ml', x: anchorLeft, y: midY, cursor: 'ew-resize', edge: 'left' },
    ];
  }

  /**
   * Hit test a screen coordinate (x, y) against handles, borders, text, and fill body.
   */
  hitTest(x, y, coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds) return { hit: false };

    // 1. Check handles if selected
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

    // 2. Check text bounds (for direct click/editing)
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

    // 3. Check middle line if enabled
    if (this.middleLine.enabled) {
      const midY = (bounds.top + bounds.bottom) / 2;
      if (x >= bounds.left && x <= bounds.right && Math.abs(y - midY) <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE) {
        return {
          hit: true,
          type: 'border',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }

    // 4. Check borders
    const nearLeft = Math.abs(x - bounds.left) <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE && y >= bounds.top - 4 && y <= bounds.bottom + 4;
    const nearRight = Math.abs(x - bounds.right) <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE && y >= bounds.top - 4 && y <= bounds.bottom + 4;
    const nearTop = Math.abs(y - bounds.top) <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE && x >= bounds.left - 4 && x <= bounds.right + 4;
    const nearBottom = Math.abs(y - bounds.bottom) <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE && x >= bounds.left - 4 && x <= bounds.right + 4;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      return {
        hit: true,
        type: 'border',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    // 5. Check interior fill
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
   * Render Background (zOrder: 'bottom')
   * Rendered behind candles so candlesticks remain 100% visible!
   */
  renderBackground(ctx, scope, coordHelper) {
    if (!this.background.visible || this.background.opacity <= 0) return;
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds || this.isOffScreen(bounds, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const bx = Math.round(bounds.left * hpr);
    const by = Math.round(bounds.top * vpr);
    const bw = Math.round(bounds.width * hpr);
    const bh = Math.round(bounds.height * vpr);

    if (bw <= 0 || bh <= 0) return;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.background.opacity));
    ctx.fillStyle = this.background.color || '#2962ff';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }

  /**
   * Render Foreground (zOrder: 'normal')
   * Crisp pixel-aligned borders, middle line, text, handles, and selection halos.
   */
  renderForeground(ctx, scope, coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds || this.isOffScreen(bounds, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const dpr = Math.max(hpr, vpr);

    ctx.save();

    // 1. Render Middle Line (Optional)
    if (this.middleLine.enabled) {
      this._renderMiddleLine(ctx, bounds, hpr, vpr);
    }

    // 2. Render Outer Border
    if (this.border.visible && this.border.width > 0) {
      this._renderBorder(ctx, bounds, hpr, vpr);
    }

    // 3. Render Hover / Selection Highlight
    if (this.isSelected || this.isHovered) {
      this._renderHighlightBorder(ctx, bounds, hpr, vpr);
    }

    // 4. Render Text Inside or Outside
    if (this.text.content && this.text.content.trim().length > 0) {
      this._renderText(ctx, bounds, hpr, vpr);
    } else {
      this._textBounds = null;
    }

    // 5. Render 8 Resize Handles (if selected and unlocked)
    if (this.isSelected && !this.locked) {
      this._renderHandles(ctx, bounds, hpr, vpr, dpr);
    }

    ctx.restore();
  }

  /**
   * Render Crisp Pixel-Aligned Border
   */
  _renderBorder(ctx, bounds, hpr, vpr) {
    const lineWidth = Math.max(1, Math.round(this.border.width * hpr));
    const half = (lineWidth % 2) / 2;

    const bx = Math.round(bounds.left * hpr) + half;
    const by = Math.round(bounds.top * vpr) + half;
    const bw = Math.round(bounds.width * hpr);
    const bh = Math.round(bounds.height * vpr);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = this.border.color || '#2962ff';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    if (this.border.style === 'dashed') {
      ctx.setLineDash([6 * hpr, 4 * hpr]);
    } else if (this.border.style === 'dotted') {
      ctx.setLineDash([2 * hpr, 3 * hpr]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
  }

  /**
   * Render Middle Line
   */
  _renderMiddleLine(ctx, bounds, hpr, vpr) {
    const midY = (bounds.top + bounds.bottom) / 2;
    const lineWidth = Math.max(1, Math.round((this.middleLine.width || 1) * vpr));
    const half = (lineWidth % 2) / 2;

    const x1 = Math.round(bounds.left * hpr);
    const x2 = Math.round(bounds.right * hpr);
    const y = Math.round(midY * vpr) + half;

    ctx.save();
    ctx.beginPath();
    ctx.globalAlpha = Math.max(0, Math.min(1, this.middleLine.opacity !== undefined ? this.middleLine.opacity : 0.5));
    ctx.strokeStyle = this.middleLine.color || this.border.color;
    ctx.lineWidth = lineWidth;

    if (this.middleLine.style === 'dashed') {
      ctx.setLineDash([5 * hpr, 4 * hpr]);
    } else if (this.middleLine.style === 'dotted') {
      ctx.setLineDash([2 * hpr, 3 * hpr]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render Selection & Hover Halo
   */
  _renderHighlightBorder(ctx, bounds, hpr, vpr) {
    const bx = Math.round(bounds.left * hpr);
    const by = Math.round(bounds.top * vpr);
    const bw = Math.round(bounds.width * hpr);
    const bh = Math.round(bounds.height * vpr);

    ctx.save();
    ctx.strokeStyle = this.isSelected ? '#2962ff' : 'rgba(41, 98, 255, 0.5)';
    ctx.lineWidth = Math.max(1, Math.round(1 * hpr));
    ctx.setLineDash([]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
  }

  /**
   * Render 8 Resize Handles
   */
  _renderHandles(ctx, bounds, hpr, vpr, dpr) {
    const anchorLeft = Math.min(bounds.rawX1, bounds.rawX2);
    const anchorRight = Math.max(bounds.rawX1, bounds.rawX2);
    const { top, bottom } = bounds;
    const midX = (anchorLeft + anchorRight) / 2;
    const midY = (top + bottom) / 2;
    const handleRadius = Math.max(3, Math.round(INTERACTION_CONSTANTS.HANDLE_SIZE * dpr) / 2);

    const handleCoords = [
      { x: anchorLeft, y: top },
      { x: midX, y: top },
      { x: anchorRight, y: top },
      { x: anchorRight, y: midY },
      { x: anchorRight, y: bottom },
      { x: midX, y: bottom },
      { x: anchorLeft, y: bottom },
      { x: anchorLeft, y: midY },
    ];

    ctx.save();
    for (const h of handleCoords) {
      const sx = Math.round(h.x * hpr);
      const sy = Math.round(h.y * vpr);

      // TradingView handles are crisp white filled squares/circles with solid colored border
      ctx.beginPath();
      ctx.arc(sx, sy, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = INTERACTION_CONSTANTS.HANDLE_COLOR;
      ctx.fill();

      ctx.lineWidth = Math.max(1.5, 1.8 * dpr);
      ctx.strokeStyle = this.border.color || INTERACTION_CONSTANTS.HANDLE_BORDER_COLOR;
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Render Multi-Line Text with Alignment and Optional Clipping
   */
  _renderText(ctx, bounds, hpr, vpr) {
    const { content, color, size, bold, italic, hAlign, vAlign, placement } = this.text;
    const lines = String(content).split('\n');
    const fontSize = Math.max(9, Math.round(size * vpr));
    const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;
    const lineHeight = fontSize * 1.25;
    const padding = 8 * hpr;

    ctx.save();
    ctx.font = fontStyle;
    ctx.textBaseline = 'alphabetic';

    // Measure maximum line width
    let maxLineWidth = 0;
    lines.forEach(line => {
      const w = ctx.measureText(line).width;
      if (w > maxLineWidth) maxLineWidth = w;
    });
    const totalTextHeight = lines.length * lineHeight;

    const bLeft = bounds.left * hpr;
    const bRight = bounds.right * hpr;
    const bTop = bounds.top * vpr;
    const bBottom = bounds.bottom * vpr;

    let targetX = 0;
    let targetY = 0;
    let align = 'center';

    // Horizontal Alignment
    if (hAlign === 'left') {
      targetX = bLeft + padding;
      align = 'left';
    } else if (hAlign === 'right') {
      targetX = bRight - padding;
      align = 'right';
    } else {
      targetX = (bLeft + bRight) / 2;
      align = 'center';
    }

    // Vertical Alignment & Placement
    if (placement === 'outside') {
      if (vAlign === 'top') {
        targetY = bTop - padding - totalTextHeight + fontSize;
      } else if (vAlign === 'bottom') {
        targetY = bBottom + padding + fontSize;
      } else {
        targetY = (bTop + bBottom) / 2 - (totalTextHeight / 2) + fontSize * 0.85;
      }
    } else {
      // Inside placement (clipped to rectangle interior)
      ctx.beginPath();
      ctx.rect(bLeft, bTop, bRight - bLeft, bBottom - bTop);
      ctx.clip();

      if (vAlign === 'top') {
        targetY = bTop + padding + fontSize;
      } else if (vAlign === 'bottom') {
        targetY = bBottom - padding - totalTextHeight + fontSize;
      } else {
        targetY = (bTop + bBottom) / 2 - (totalTextHeight / 2) + fontSize * 0.85;
      }
    }

    ctx.fillStyle = color || '#ffffff';
    ctx.textAlign = align;

    // Cache text bounding box for click/hit-testing
    const boundsX = align === 'left' ? targetX : (align === 'right' ? targetX - maxLineWidth : targetX - maxLineWidth / 2);
    this._textBounds = {
      left: boundsX / hpr,
      right: (boundsX + maxLineWidth) / hpr,
      top: (targetY - fontSize) / vpr,
      bottom: (targetY - fontSize + totalTextHeight) / vpr,
    };

    lines.forEach((line, idx) => {
      ctx.fillText(line, targetX, targetY + (idx * lineHeight));
    });

    ctx.restore();
  }

  /**
   * Clone this rectangle drawing with new ID and fresh timestamps
   */
  clone() {
    const json = this.toJSON();
    return new RectangleDrawing({
      ...json,
      id: 'rect_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      points: [
        { ...json.points[0], price: json.points[0].price * 1.002, logical: (json.points[0].logical || 0) + 3 },
        { ...json.points[1], price: json.points[1].price * 1.002, logical: (json.points[1].logical || 0) + 3 },
      ],
      locked: false,
    });
  }

  /**
   * Serialize Rectangle to clean JSON
   */
  toJSON() {
    return {
      ...super.toJSON(),
      border: { ...this.border },
      middleLine: { ...this.middleLine },
      background: { ...this.background },
      extendLeft: this.extendLeft,
      extendRight: this.extendRight,
      text: { ...this.text },
    };
  }

  /**
   * Create a RectangleDrawing instance from JSON
   */
  static fromJSON(data) {
    return new RectangleDrawing(data);
  }
}
