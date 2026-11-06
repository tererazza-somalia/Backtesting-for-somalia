/**
 * VerticalLineDrawing - Infinite vertical time line spanning entire chart height.
 * Shortcut: Alt + V
 */

import { SinglePointLineBase } from './SinglePointLineBase.js';

export class VerticalLineDrawing extends SinglePointLineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'verticalLine',
      timeLabels: options.timeLabels !== undefined ? Boolean(options.timeLabels) : true,
      priceLabels: false,
    });

    this._timeAxisView = new VerticalLineTimeAxisView(this);
  }

  intersectsViewport(coordHelper) {
    if (!coordHelper) return true;
    const x = coordHelper.pointToScreenX(this.point);
    if (x === null || isNaN(x)) return false;
    return x >= -20 && x <= coordHelper.mediaWidth + 20;
  }

  hitTest(pixelX, pixelY, coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return { hit: false };

    // Check anchor handle
    if (Math.hypot(pixelX - pt.x, pixelY - pt.y) <= 8) {
      return { hit: true, type: 'handle', handleId: 'origin', cursor: 'ew-resize', drawing: this };
    }

    // Check vertical line body across full height
    const hitTolerance = Math.max(6, (this.line.width || 1.5) + 3);
    if (Math.abs(pixelX - pt.x) <= hitTolerance) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'ew-resize', drawing: this };
    }

    return { hit: false };
  }

  move(deltaLogical, deltaPrice) {
    if (this.locked) return;
    this.point.logical = (this.point.logical || 0) + deltaLogical;
    this.updatedAt = Date.now();
  }

  moveHandle(handleId, newLogical, newPrice, newTime) {
    if (this.locked) return;
    this.point.logical = newLogical;
    if (newTime) this.point.time = newTime;
    if (newPrice !== undefined && newPrice !== null) {
      this.point.price = newPrice;
    }
    this.updatedAt = Date.now();
  }

  renderForeground(ctx, scope, coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return;

    const dpr = scope.mediaSize.width / (coordHelper.mediaWidth || 1);
    const h = coordHelper.mediaHeight;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw vertical line across full pane height
    ctx.beginPath();
    this._applyLineStyle(ctx);
    ctx.moveTo(pt.x, 0);
    ctx.lineTo(pt.x, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 2. Render text if present
    if (this.text && this.text.content && this.text.content.trim()) {
      ctx.save();
      const isBold = this.text.bold ? 'bold ' : '';
      const isItalic = this.text.italic ? 'italic ' : '';
      const size = this.text.size || 12;

      ctx.font = `${isItalic}${isBold}${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = this.text.color || this.line.color || '#2962ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      let ty = 14;
      if (this.text.vAlign === 'middle') ty = h / 2;
      else if (this.text.vAlign === 'bottom') ty = h - 30;

      ctx.fillText(this.text.content, pt.x + 6, ty);
      ctx.restore();
    }

    // 3. Render anchor handle if selected
    if (this.isSelected) {
      this._renderAnchorHandle(ctx, pt.x, pt.y, this.line.color);
    }

    ctx.restore();
  }

  timeAxisViews(coordHelper) {
    if (!this.timeLabels) return [];
    this._timeAxisView._coordHelper = coordHelper;
    return [this._timeAxisView];
  }

  static fromJSON(data) {
    return new VerticalLineDrawing(data);
  }
}

class VerticalLineTimeAxisView {
  constructor(drawing) {
    this._drawing = drawing;
    this._coordHelper = null;
  }
  coordinate(coordHelper) {
    const ch = coordHelper || this._coordHelper;
    return ch ? ch.pointToScreenX(this._drawing.point) : -100;
  }
  text() {
    const time = this._drawing.point.time;
    if (!time) return `Bar ${Math.round(this._drawing.point.logical || 0)}`;
    const d = new Date(time * 1000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  textColor() {
    return '#ffffff';
  }
  backColor() {
    return this._drawing.line.color || '#2962ff';
  }
}
