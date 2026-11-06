/**
 * CrosslineDrawing - Intersecting horizontal and vertical lines centered at an anchor point.
 * Shortcut: Alt + C (places crossline immediately at cursor position)
 */

import { SinglePointLineBase } from './SinglePointLineBase.js';

export class CrosslineDrawing extends SinglePointLineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'crossline',
      priceLabels: options.priceLabels !== undefined ? Boolean(options.priceLabels) : true,
      timeLabels: options.timeLabels !== undefined ? Boolean(options.timeLabels) : true,
    });

    this._priceAxisView = new CrosslinePriceAxisView(this);
    this._timeAxisView = new CrosslineTimeAxisView(this);
  }

  intersectsViewport(coordHelper) {
    if (!coordHelper) return true;
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return false;
    const w = coordHelper.mediaWidth;
    const h = coordHelper.mediaHeight;
    const inY = pt.y >= -20 && pt.y <= h + 20;
    const inX = pt.x >= -20 && pt.x <= w + 20;
    return inX || inY;
  }

  hitTest(pixelX, pixelY, coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return { hit: false };

    // Check intersection center handle
    if (Math.hypot(pixelX - pt.x, pixelY - pt.y) <= 8) {
      return { hit: true, type: 'handle', handleId: 'origin', cursor: 'move', drawing: this };
    }

    const hitTolerance = Math.max(6, (this.line.width || 1.5) + 3);

    // Check horizontal bar
    if (Math.abs(pixelY - pt.y) <= hitTolerance) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'move', drawing: this };
    }

    // Check vertical bar
    if (Math.abs(pixelX - pt.x) <= hitTolerance) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'move', drawing: this };
    }

    return { hit: false };
  }

  renderForeground(ctx, scope, coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return;

    const dpr = scope.mediaSize.width / (coordHelper.mediaWidth || 1);
    const w = coordHelper.mediaWidth;
    const h = coordHelper.mediaHeight;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw horizontal line
    ctx.beginPath();
    this._applyLineStyle(ctx);
    ctx.moveTo(0, pt.y);
    ctx.lineTo(w, pt.y);
    ctx.stroke();

    // 2. Draw vertical line
    ctx.beginPath();
    ctx.moveTo(pt.x, 0);
    ctx.lineTo(pt.x, h);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 3. Render text if present
    this._renderText(ctx, pt.x, pt.y, w, h);

    // 4. Render intersection center handle if selected
    if (this.isSelected) {
      this._renderAnchorHandle(ctx, pt.x, pt.y, this.line.color);
    }

    ctx.restore();
  }

  priceAxisViews(coordHelper) {
    if (!this.priceLabels) return [];
    this._priceAxisView._coordHelper = coordHelper;
    return [this._priceAxisView];
  }

  timeAxisViews(coordHelper) {
    if (!this.timeLabels) return [];
    this._timeAxisView._coordHelper = coordHelper;
    return [this._timeAxisView];
  }

  static fromJSON(data) {
    return new CrosslineDrawing(data);
  }
}

class CrosslinePriceAxisView {
  constructor(drawing) {
    this._drawing = drawing;
    this._coordHelper = null;
  }
  coordinate(coordHelper) {
    const ch = coordHelper || this._coordHelper;
    return ch ? ch.priceToScreenY(this._drawing.point.price) : -100;
  }
  text() {
    const price = this._drawing.point.price;
    if (price === null || price === undefined || isNaN(price)) return '';
    return price < 2 ? price.toFixed(4) : (price < 100 ? price.toFixed(3) : price.toFixed(2));
  }
  textColor() {
    return '#ffffff';
  }
  backColor() {
    return this._drawing.line.color || '#2962ff';
  }
}

class CrosslineTimeAxisView {
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
