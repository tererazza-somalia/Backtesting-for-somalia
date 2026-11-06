/**
 * SinglePointLineBase - Shared base class for all 1-point line drawings.
 *
 * Subclasses:
 * - HorizontalLineDrawing
 * - HorizontalRayDrawing
 * - VerticalLineDrawing
 * - CrosslineDrawing
 *
 * Properties:
 * - point: Chart coordinates { logical, price, time }
 * - line: { color, width, opacity, style: 'solid'|'dashed'|'dotted' }
 * - priceLabels: boolean (renders price badge on price scale)
 * - timeLabels: boolean (renders time badge on time scale)
 * - text: { content, color, size, bold, italic, hAlign, vAlign }
 * - visibility, locked, zIndex
 */

import { BaseDrawing } from './BaseDrawing.js';
import { INTERACTION_CONSTANTS } from './constants.js';

export class SinglePointLineBase extends BaseDrawing {
  constructor(options = {}) {
    super(options);

    const pt = options.point || options.points?.[0] || {};
    this.point = {
      logical: pt.logical !== undefined && pt.logical !== null ? Number(pt.logical) : 0,
      price: pt.price !== undefined && pt.price !== null ? Number(pt.price) : 0,
      time: pt.time !== undefined ? pt.time : null,
    };

    // Keep points array for BaseDrawing compatibility
    this.points = [this.point];

    // Stroke style
    this.line = {
      color: options.line?.color || '#2962ff',
      width: options.line?.width !== undefined ? Number(options.line.width) : 1.5,
      opacity: options.line?.opacity !== undefined ? Number(options.line.opacity) : 1,
      style: options.line?.style || 'solid', // 'solid' | 'dashed' | 'dotted'
    };

    this.priceLabels = options.priceLabels !== undefined ? Boolean(options.priceLabels) : true;
    this.timeLabels = options.timeLabels !== undefined ? Boolean(options.timeLabels) : false;

    // Text label
    this.text = {
      content: options.text?.content || '',
      color: options.text?.color || options.line?.color || '#2962ff',
      size: options.text?.size !== undefined ? Number(options.text.size) : 12,
      bold: options.text?.bold !== undefined ? Boolean(options.text.bold) : false,
      italic: options.text?.italic !== undefined ? Boolean(options.text.italic) : false,
      hAlign: options.text?.hAlign || 'left', // 'left' | 'center' | 'right'
      vAlign: options.text?.vAlign || 'bottom', // 'top' | 'middle' | 'bottom'
    };
  }

  /**
   * Screen coordinates of the anchor point
   */
  getScreenPoint(coordHelper) {
    if (!coordHelper) return null;
    const x = coordHelper.pointToScreenX(this.point);
    const y = coordHelper.priceToScreenY(this.point.price);
    if (x === null || y === null || isNaN(x) || isNaN(y)) return null;
    return { x, y };
  }

  getScreenBounds(coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return null;
    const w = coordHelper.mediaWidth || 1000;
    const h = coordHelper.mediaHeight || 600;

    if (this.type === 'horizontalLine') {
      return { left: 0, right: w, top: pt.y - 10, bottom: pt.y + 10, width: w, height: 20, rawX1: pt.x, rawX2: pt.x };
    }
    if (this.type === 'verticalLine') {
      return { left: pt.x - 10, right: pt.x + 10, top: 0, bottom: h, width: 20, height: h, rawX1: pt.x, rawX2: pt.x };
    }
    // Crossline or default
    return { left: pt.x - 20, right: pt.x + 20, top: pt.y - 20, bottom: pt.y + 20, width: 40, height: 40, rawX1: pt.x, rawX2: pt.x };
  }

  /**
   * Return resize/drag handles
   */
  getHandles(coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return [];
    return [
      { id: 'origin', x: pt.x, y: pt.y, cursor: 'crosshair' },
    ];
  }

  /**
   * Move drawing by delta in chart space
   */
  move(deltaLogical, deltaPrice) {
    if (this.locked) return;
    this.point.logical = (this.point.logical || 0) + deltaLogical;
    this.point.price = (this.point.price || 0) + deltaPrice;
    this.updatedAt = Date.now();
  }

  /**
   * Move handle
   */
  moveHandle(handleId, newLogical, newPrice, newTime) {
    if (this.locked) return;
    this.point.logical = newLogical;
    this.point.price = newPrice;
    if (newTime) this.point.time = newTime;
    this.points = [this.point];
    this.updatedAt = Date.now();
  }

  normalize() {
    this.points = [this.point];
    this.updatedAt = Date.now();
  }

  renderBackground(ctx, scope, coordHelper) {
    // Single-point line tools have no background fill
  }

  /**
   * Apply stroke line styles (solid, dashed, dotted)
   */
  _applyLineStyle(ctx) {
    ctx.strokeStyle = this.line.color || '#2962ff';
    ctx.lineWidth = Math.max(1, this.line.width || 1.5);
    ctx.globalAlpha = this.line.opacity !== undefined ? this.line.opacity : 1;

    if (this.line.style === 'dashed') {
      ctx.setLineDash([6, 5]);
    } else if (this.line.style === 'dotted') {
      ctx.setLineDash([2, 4]);
    } else {
      ctx.setLineDash([]);
    }
  }

  /**
   * Render circular anchor handle with halo
   */
  _renderAnchorHandle(ctx, x, y, color) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = color || '#2962ff';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render text label along line
   */
  _renderText(ctx, anchorX, anchorY, paneW, paneH) {
    if (!this.text || !this.text.content || !this.text.content.trim()) return;

    ctx.save();
    const isBold = this.text.bold ? 'bold ' : '';
    const isItalic = this.text.italic ? 'italic ' : '';
    const size = this.text.size || 12;

    ctx.font = `${isItalic}${isBold}${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = this.text.color || this.line.color || '#2962ff';
    ctx.textBaseline = this.text.vAlign === 'top' ? 'bottom' : (this.text.vAlign === 'middle' ? 'middle' : 'bottom');
    ctx.textAlign = this.text.hAlign === 'right' ? 'right' : (this.text.hAlign === 'center' ? 'center' : 'left');

    let tx = anchorX;
    let ty = anchorY - 6;

    if (this.text.hAlign === 'left') {
      tx = Math.max(12, anchorX + 10);
    } else if (this.text.hAlign === 'right') {
      tx = Math.min(paneW - 12, paneW - 15);
    } else if (this.text.hAlign === 'center') {
      tx = paneW / 2;
    }

    ctx.fillText(this.text.content, tx, ty);
    ctx.restore();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      point: { ...this.point },
      points: [{ ...this.point }],
      line: { ...this.line },
      priceLabels: this.priceLabels,
      timeLabels: this.timeLabels,
      text: { ...this.text },
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: this.zIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
