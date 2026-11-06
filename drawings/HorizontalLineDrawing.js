/**
 * HorizontalLineDrawing - Infinite horizontal price level line spanning entire chart width.
 * Shortcut: Alt + H
 */

import { SinglePointLineBase } from './SinglePointLineBase.js';

export class HorizontalLineDrawing extends SinglePointLineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'horizontalLine',
      priceLabels: options.priceLabels !== undefined ? Boolean(options.priceLabels) : true,
    });
  }

  intersectsViewport(coordHelper) {
    if (!coordHelper) return true;
    const y = coordHelper.priceToScreenY(this.point.price);
    if (y === null || isNaN(y)) return false;
    return y >= -20 && y <= coordHelper.mediaHeight + 20;
  }

  hitTest(pixelX, pixelY, coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return { hit: false };

    // Check anchor handle
    if (Math.hypot(pixelX - pt.x, pixelY - pt.y) <= 8) {
      return { hit: true, type: 'handle', handleId: 'origin', cursor: 'ns-resize', drawing: this };
    }

    // Check horizontal line body across the whole width
    const hitTolerance = Math.max(6, (this.line.width || 1.5) + 3);
    if (Math.abs(pixelY - pt.y) <= hitTolerance) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'ns-resize', drawing: this };
    }

    return { hit: false };
  }

  move(deltaLogical, deltaPrice) {
    if (this.locked) return;
    this.point.price = (this.point.price || 0) + deltaPrice;
    this.updatedAt = Date.now();
  }

  moveHandle(handleId, newLogical, newPrice, newTime) {
    if (this.locked) return;
    this.point.price = newPrice;
    if (newLogical !== undefined && newLogical !== null) {
      this.point.logical = newLogical;
    }
    if (newTime) this.point.time = newTime;
    this.updatedAt = Date.now();
  }

  renderForeground(ctx, scope, coordHelper) {
    const pt = this.getScreenPoint(coordHelper);
    if (!pt) return;

    const dpr = scope.mediaSize.width / (coordHelper.mediaWidth || 1);
    const w = coordHelper.mediaWidth;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw horizontal line across full pane width
    ctx.beginPath();
    this._applyLineStyle(ctx);
    ctx.moveTo(0, pt.y);
    ctx.lineTo(w, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 2. Render text if present
    this._renderText(ctx, pt.x, pt.y, w, coordHelper.mediaHeight);

    // 3. Render anchor handle if selected
    if (this.isSelected) {
      this._renderAnchorHandle(ctx, pt.x, pt.y, this.line.color);
    }

    ctx.restore();
  }

  priceAxisViews(coordHelper) {
    if (!this.priceLabels) return [];
    const price = this.point.price;
    const color = this.line.color || '#2962ff';

    return [
      {
        coordinate: () => coordHelper.priceToScreenY(price),
        text: () => (price !== null && price !== undefined ? price.toFixed(4) : ''),
        textColor: () => '#ffffff',
        backColor: () => color,
      },
    ];
  }

  static fromJSON(data) {
    return new HorizontalLineDrawing(data);
  }
}
