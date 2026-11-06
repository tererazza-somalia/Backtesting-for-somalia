/**
 * EllipseDrawing - Full implementation of TradingView's Ellipse drawing tool.
 *
 * Defined by two anchor points in chart coordinates: { time, price, logical }
 * that represent the bounding box of the ellipse.
 *
 * All geometry (center, radii, aspect ratio, circle constraints for SHIFT)
 * is calculated dynamically in PIXEL space at render time so the shape remains
 * clean, crisp, and invariant across pan, zoom, scale changes, and window resizing.
 */

import { BaseDrawing } from './BaseDrawing.js';
import { ELLIPSE_DEFAULTS, INTERACTION_CONSTANTS } from './constants.js';

export class EllipseDrawing extends BaseDrawing {
  constructor(options = {}) {
    super({ ...options, type: 'ellipse' });

    // Initialize styling with fallback to defaults
    this.border = {
      visible: options.border?.visible !== undefined ? options.border.visible : ELLIPSE_DEFAULTS.BORDER.visible,
      color: options.border?.color || ELLIPSE_DEFAULTS.BORDER.color,
      width: options.border?.width || ELLIPSE_DEFAULTS.BORDER.width,
      style: options.border?.style || ELLIPSE_DEFAULTS.BORDER.style,
    };

    this.background = {
      visible: options.background?.visible !== undefined ? options.background.visible : ELLIPSE_DEFAULTS.BACKGROUND.visible,
      color: options.background?.color || ELLIPSE_DEFAULTS.BACKGROUND.color,
      opacity: options.background?.opacity !== undefined ? options.background.opacity : ELLIPSE_DEFAULTS.BACKGROUND.opacity,
    };

    this.text = {
      content: options.text?.content || ELLIPSE_DEFAULTS.TEXT.content,
      color: options.text?.color || ELLIPSE_DEFAULTS.TEXT.color,
      size: options.text?.size || ELLIPSE_DEFAULTS.TEXT.size,
      bold: Boolean(options.text?.bold),
      italic: Boolean(options.text?.italic),
      hAlign: options.text?.hAlign || ELLIPSE_DEFAULTS.TEXT.hAlign,
      vAlign: options.text?.vAlign || ELLIPSE_DEFAULTS.TEXT.vAlign,
    };

    // Cached text layout metrics
    this._textBounds = null;
  }

  /**
   * Derive screen geometry: center (cx, cy), radii (rx, ry), and bounding box.
   */
  getScreenGeometry(coordHelper) {
    if (!this.points || this.points.length < 2) return null;
    const p1 = this.points[0];
    const p2 = this.points[1];

    const x1 = coordHelper.pointToScreenX(p1);
    const y1 = coordHelper.priceToScreenY(p1.price);
    const x2 = coordHelper.pointToScreenX(p2);
    const y2 = coordHelper.priceToScreenY(p2.price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;

    const left = Math.min(x1, x2);
    const right = Math.max(x1, x2);
    const top = Math.min(y1, y2);
    const bottom = Math.max(y1, y2);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);

    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    const rx = width / 2;
    const ry = height / 2;

    return {
      left,
      top,
      right,
      bottom,
      width,
      height,
      cx,
      cy,
      rx,
      ry,
      rawX1: x1,
      rawX2: x2,
      rawY1: y1,
      rawY2: y2,
      isDegenerate: rx < 1e-4 || ry < 1e-4,
    };
  }

  /**
   * Screen bounds helper for floating toolbar and positioning.
   */
  getScreenBounds(coordHelper) {
    const geom = this.getScreenGeometry(coordHelper);
    if (!geom) return null;
    return {
      left: geom.left,
      top: geom.top,
      right: geom.right,
      bottom: geom.bottom,
      width: geom.width,
      height: geom.height,
      rawX1: geom.rawX1,
      rawX2: geom.rawX2,
      rawY1: geom.rawY1,
      rawY2: geom.rawY2,
      cx: geom.cx,
      cy: geom.cy,
      rx: geom.rx,
      ry: geom.ry,
    };
  }

  /**
   * Viewport culling helper.
   */
  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    if (bounds.right < 0 || bounds.left > mediaWidth) return true;
    if (bounds.bottom < 0 || bounds.top > mediaHeight) return true;
    return false;
  }

  /**
   * 8 Interactive resize handles around the ellipse bounding box.
   */
  getHandles(coordHelper) {
    const geom = this.getScreenGeometry(coordHelper);
    if (!geom) return [];

    const { left, right, top, bottom, cx, cy } = geom;

    return [
      { id: 'tl', x: left, y: top, cursor: 'nwse-resize', edge: 'top-left' },
      { id: 'tm', x: cx, y: top, cursor: 'ns-resize', edge: 'top' },
      { id: 'tr', x: right, y: top, cursor: 'nesw-resize', edge: 'top-right' },
      { id: 'mr', x: right, y: cy, cursor: 'ew-resize', edge: 'right' },
      { id: 'br', x: right, y: bottom, cursor: 'nwse-resize', edge: 'bottom-right' },
      { id: 'bm', x: cx, y: bottom, cursor: 'ns-resize', edge: 'bottom' },
      { id: 'bl', x: left, y: bottom, cursor: 'nesw-resize', edge: 'bottom-left' },
      { id: 'ml', x: left, y: cy, cursor: 'ew-resize', edge: 'left' },
    ];
  }

  /**
   * Hit test a screen coordinate (x, y) against handles, text, border, and body fill.
   */
  hitTest(x, y, coordHelper) {
    const geom = this.getScreenGeometry(coordHelper);
    if (!geom) return { hit: false };

    // 1. Check interactive resize handles if selected and unlocked
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

    // 2. Check text bounds if text is populated
    if (this._textBounds && this.text.content && this.text.content.trim().length > 0) {
      const tb = this._textBounds;
      if (x >= tb.left - 4 && x <= tb.right + 4 && y >= tb.top - 4 && y <= tb.bottom + 4) {
        return {
          hit: true,
          type: 'text',
          cursor: 'text',
          drawing: this,
        };
      }
    }

    if (geom.isDegenerate) {
      return { hit: false };
    }

    const dx = x - geom.cx;
    const dy = y - geom.cy;
    const rx = geom.rx;
    const ry = geom.ry;

    // 3. Border hit testing using exact radial ellipse distance
    const distFromCenter = Math.hypot(dx, dy);
    const theta = Math.atan2(dy, dx);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const denom = Math.sqrt((ry * cosT) * (ry * cosT) + (rx * sinT) * (rx * sinT));
    const ellipseRadiusAtTheta = denom > 1e-6 ? (rx * ry) / denom : 0;

    const radialDistToBorder = Math.abs(distFromCenter - ellipseRadiusAtTheta);
    if (radialDistToBorder <= INTERACTION_CONSTANTS.BORDER_HIT_DISTANCE) {
      return {
        hit: true,
        type: 'border',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    // 4. Interior body fill (Normalized ellipse equation)
    // (dx / rx)^2 + (dy / ry)^2 <= 1.0
    const normEq = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    if (normEq <= 1.0) {
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
   * Rendered behind candlesticks so candles remain 100% visible!
   */
  renderBackground(ctx, scope, coordHelper) {
    if (!this.background.visible || this.background.opacity <= 0) return;
    const geom = this.getScreenGeometry(coordHelper);
    if (!geom || geom.isDegenerate) return;
    if (this.isOffScreen(geom, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const cx = geom.cx * hpr;
    const cy = geom.cy * vpr;
    const rx = geom.rx * hpr;
    const ry = geom.ry * vpr;

    if (rx <= 0 || ry <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.globalAlpha = Math.max(0, Math.min(1, this.background.opacity));
    ctx.fillStyle = this.background.color || '#2962ff';
    ctx.fill();
    ctx.restore();
  }

  /**
   * Render Foreground (zOrder: 'normal')
   * Crisp pixel-aligned border stroke, text caption, and selection resize handles.
   */
  renderForeground(ctx, scope, coordHelper) {
    const geom = this.getScreenGeometry(coordHelper);
    if (!geom || geom.isDegenerate) return;
    if (this.isOffScreen(geom, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const dpr = Math.max(hpr, vpr);
    const cx = geom.cx * hpr;
    const cy = geom.cy * vpr;
    const rx = geom.rx * hpr;
    const ry = geom.ry * vpr;

    if (rx <= 0 || ry <= 0) return;

    ctx.save();

    // 1. Render Ellipse Perimeter Border
    if (this.border.visible && this.border.width > 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = this.border.color || '#2962ff';
      ctx.lineWidth = Math.max(1, Math.round(this.border.width * hpr));

      if (this.border.style === 'dashed') {
        ctx.setLineDash([6 * hpr, 4 * hpr]);
      } else if (this.border.style === 'dotted') {
        ctx.setLineDash([2 * hpr, 3 * hpr]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
    }

    // 2. Render Selection / Hover Halo
    if (this.isSelected || this.isHovered) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = this.isSelected ? '#2962ff' : 'rgba(41, 98, 255, 0.45)';
      ctx.lineWidth = Math.max(1, Math.round(1 * hpr));
      ctx.setLineDash([]);
      ctx.stroke();
    }

    // 3. Render Center Text Caption (clipped to ellipse interior)
    if (this.text.content && this.text.content.trim().length > 0) {
      this._renderText(ctx, geom, hpr, vpr);
    } else {
      this._textBounds = null;
    }

    // 4. Render 8 Resize Handles (if selected and unlocked)
    if (this.isSelected && !this.locked) {
      this._renderHandles(ctx, geom, hpr, vpr, dpr);
    }

    ctx.restore();
  }

  /**
   * Render Multi-Line Text inside the Ellipse with Clipping
   */
  _renderText(ctx, geom, hpr, vpr) {
    const { content, color, size, bold, italic, hAlign, vAlign } = this.text;
    const lines = String(content).split('\n');
    const fontSize = Math.max(9, Math.round(size * vpr));
    const fontStyle = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;
    const lineHeight = fontSize * 1.25;

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

    const cx = geom.cx * hpr;
    const cy = geom.cy * vpr;
    const rx = geom.rx * hpr;
    const ry = geom.ry * vpr;

    // Clip to ellipse interior so text never overflows the boundary
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx - 4 * hpr), Math.max(1, ry - 4 * vpr), 0, 0, Math.PI * 2);
    ctx.clip();

    let targetX = cx;
    let align = 'center';

    if (hAlign === 'left') {
      targetX = cx - (rx * 0.7);
      align = 'left';
    } else if (hAlign === 'right') {
      targetX = cx + (rx * 0.7);
      align = 'right';
    } else {
      targetX = cx;
      align = 'center';
    }

    let targetY = cy;
    if (vAlign === 'top') {
      targetY = cy - (ry * 0.5) + fontSize;
    } else if (vAlign === 'bottom') {
      targetY = cy + (ry * 0.5) - totalTextHeight + fontSize;
    } else {
      targetY = cy - (totalTextHeight / 2) + fontSize * 0.85;
    }

    ctx.fillStyle = color || '#ffffff';
    ctx.textAlign = align;

    // Cache text bounding box for inline text editor
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
   * Render 8 interactive handles at bounding box corners and edge midpoints
   */
  _renderHandles(ctx, geom, hpr, vpr, dpr) {
    const { left, right, top, bottom, cx, cy } = geom;
    const handleCoords = [
      { x: left, y: top },
      { x: cx, y: top },
      { x: right, y: top },
      { x: right, y: cy },
      { x: right, y: bottom },
      { x: cx, y: bottom },
      { x: left, y: bottom },
      { x: left, y: cy },
    ];

    const handleRadius = Math.max(3, Math.round(INTERACTION_CONSTANTS.HANDLE_SIZE * dpr) / 2);

    ctx.save();
    for (const h of handleCoords) {
      const sx = Math.round(h.x * hpr);
      const sy = Math.round(h.y * vpr);

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
   * Normalize anchor points so points[0] is top-left and points[1] is bottom-right
   */
  normalize() {
    if (!this.points || this.points.length < 2) return;
    const p1 = this.points[0];
    const p2 = this.points[1];

    const hasLogical = p1.logical !== undefined && p2.logical !== undefined;
    const minLogical = hasLogical ? Math.min(p1.logical, p2.logical) : undefined;
    const maxLogical = hasLogical ? Math.max(p1.logical, p2.logical) : undefined;

    const maxPrice = Math.max(p1.price, p2.price);
    const minPrice = Math.min(p1.price, p2.price);

    this.points[0] = {
      logical: minLogical,
      time: (p1.logical <= p2.logical || p1.time <= p2.time) ? p1.time : p2.time,
      price: maxPrice,
    };

    this.points[1] = {
      logical: maxLogical,
      time: (p1.logical <= p2.logical || p1.time <= p2.time) ? p2.time : p1.time,
      price: minPrice,
    };
    this.updatedAt = Date.now();
  }

  /**
   * Clone this ellipse drawing
   */
  clone() {
    const json = this.toJSON();
    return new EllipseDrawing({
      ...json,
      id: 'ellipse_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      points: [
        { ...json.points[0], price: json.points[0].price * 1.002, logical: (json.points[0].logical || 0) + 3 },
        { ...json.points[1], price: json.points[1].price * 1.002, logical: (json.points[1].logical || 0) + 3 },
      ],
      locked: false,
    });
  }

  toJSON() {
    return {
      id: this.id,
      type: 'ellipse',
      points: this.points.map(pt => ({
        time: pt.time,
        price: pt.price,
        logical: pt.logical,
      })),
      border: { ...this.border },
      background: { ...this.background },
      text: { ...this.text },
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: this.zIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data) {
    return new EllipseDrawing(data);
  }
}
