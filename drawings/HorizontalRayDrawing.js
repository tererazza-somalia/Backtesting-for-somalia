/**
 * HorizontalRayDrawing - TradingView-style Horizontal Ray drawing tool.
 * Shortcut: Alt + J
 * Defined by ONE anchor point in chart coordinates: { time, price, logical }.
 * Extends from the anchor point to the RIGHT edge of the chart pane indefinitely.
 */

import { SinglePointLineBase } from './SinglePointLineBase.js';
import { HORIZONTAL_RAY_DEFAULTS, HORIZONTAL_RAY_CONFIG, INTERACTION_CONSTANTS } from './constants.js';

export class HorizontalRayDrawing extends SinglePointLineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'horizontalRay',
      priceLabels: options.priceLabel?.visible !== undefined
        ? Boolean(options.priceLabel.visible)
        : (options.priceLabels !== undefined ? Boolean(options.priceLabels) : true),
      timeLabels: options.timeLabel?.visible !== undefined
        ? Boolean(options.timeLabel.visible)
        : (options.timeLabels !== undefined ? Boolean(options.timeLabels) : false),
    });

    this.priceLabel = {
      visible: this.priceLabels,
    };
    this.timeLabel = {
      visible: this.timeLabels,
    };

    this._priceAxisView = new HorizontalRayPriceAxisView(this);
    this._timeAxisView = new HorizontalRayTimeAxisView(this);
  }

  getScreenCoordinates(coordHelper) {
    if (!this.point || !coordHelper) return null;
    const startX = coordHelper.pointToScreenX(this.point);
    const y = coordHelper.priceToScreenY(this.point.price);
    if (startX === null || y === null || isNaN(startX) || isNaN(y)) return null;

    const mediaW = (coordHelper.mediaWidth && coordHelper.mediaWidth > 0)
      ? coordHelper.mediaWidth
      : (window.innerWidth || 2000);
    const mediaH = (coordHelper.mediaHeight && coordHelper.mediaHeight > 0)
      ? coordHelper.mediaHeight
      : (window.innerHeight || 1000);

    return {
      startX,
      y,
      endX: mediaW,
      mediaW,
      mediaH,
    };
  }

  intersectsViewport(coordHelper) {
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return false;
    if (coords.y < -20 || coords.y > coords.mediaH + 20) return false;
    if (coords.startX > coords.mediaW + 20) return false;
    return true;
  }

  hitTest(pixelX, pixelY, coordHelper) {
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return { hit: false };

    const handleRadius = (INTERACTION_CONSTANTS.HANDLE_RADIUS || 5) + 3;

    // Check origin anchor handle
    if (Math.hypot(pixelX - coords.startX, pixelY - coords.y) <= handleRadius) {
      return { hit: true, type: 'handle', handleId: 'origin', cursor: 'crosshair', drawing: this };
    }

    // Check ray line body (extends to the right)
    const hitTolerance = Math.max(6, (this.line.width || 2) + 3);
    const rightPadding = 50;
    if (
      pixelX >= coords.startX - 6 &&
      pixelX <= coords.endX + rightPadding &&
      Math.abs(pixelY - coords.y) <= hitTolerance
    ) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'pointer', drawing: this };
    }

    return { hit: false };
  }

  renderForeground(ctx, scope, coordHelper) {
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return;

    const dpr = scope.mediaSize.width / (coordHelper.mediaWidth || 1);

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Draw horizontal ray line from startX to right edge
    ctx.beginPath();
    this._applyLineStyle(ctx);
    ctx.moveTo(coords.startX, coords.y);
    ctx.lineTo(coords.endX, coords.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 2. Render text if present
    this._renderText(ctx, coords.startX, coords.y, coords.mediaW, coords.mediaH);

    // 3. Render anchor handle if selected
    if (this.isSelected) {
      this._renderAnchorHandle(ctx, coords.startX, coords.y, this.line.color);
    }

    ctx.restore();
  }

  priceAxisViews(coordHelper) {
    if (!this.priceLabels && !this.priceLabel?.visible) return [];
    this._priceAxisView._coordHelper = coordHelper;
    return [this._priceAxisView];
  }

  timeAxisViews(coordHelper) {
    if (!this.timeLabels && !this.timeLabel?.visible) return [];
    this._timeAxisView._coordHelper = coordHelper;
    return [this._timeAxisView];
  }

  static fromJSON(data) {
    return new HorizontalRayDrawing(data);
  }
}

class HorizontalRayPriceAxisView {
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

class HorizontalRayTimeAxisView {
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
    if (!time) return '';
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
