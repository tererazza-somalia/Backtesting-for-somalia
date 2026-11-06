/**
 * PriceRangeDrawing - Complete implementation of TradingView's official Price Range drawing tool.
 * Measures vertical price movement between two anchors:
 * - Price Range (absolute signed difference, symbol precision)
 * - Percentage Change (signed, 2 decimals)
 * - Change in Pips / Ticks (divided by symbol pip or minimum tick size)
 *
 * Extends RangeMeasureBase for sibling extensibility (Date Range, Date-and-Price Range).
 * Implements Series Primitive API with dual Price Axis label views.
 */

import { RangeMeasureBase } from './RangeMeasureBase.js';
import { PRICE_RANGE_DEFAULTS, PRICE_RANGE_CONFIG, INTERACTION_CONSTANTS, getSymbolInfo } from './constants.js';

export class PriceRangeDrawing extends RangeMeasureBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'priceRange',
      line: {
        color: options.line?.color || PRICE_RANGE_DEFAULTS.LINE.color,
        width: options.line?.width !== undefined ? options.line.width : PRICE_RANGE_DEFAULTS.LINE.width,
        opacity: options.line?.opacity !== undefined ? options.line.opacity : PRICE_RANGE_DEFAULTS.LINE.opacity,
      },
      border: {
        visible: options.border?.visible !== undefined ? Boolean(options.border.visible) : PRICE_RANGE_DEFAULTS.BORDER.visible,
        color: options.border?.color || (options.line?.color || PRICE_RANGE_DEFAULTS.LINE.color),
        width: options.border?.width !== undefined ? options.border.width : PRICE_RANGE_DEFAULTS.BORDER.width,
        style: options.border?.style || PRICE_RANGE_DEFAULTS.BORDER.style,
      },
      background: {
        visible: options.background?.visible !== undefined ? Boolean(options.background.visible) : PRICE_RANGE_DEFAULTS.BACKGROUND.visible,
        color: options.background?.color || (options.line?.color || PRICE_RANGE_DEFAULTS.LINE.color),
        opacity: options.background?.opacity !== undefined ? options.background.opacity : PRICE_RANGE_DEFAULTS.BACKGROUND.opacity,
      },
      extendHorizontally: options.extendHorizontally !== undefined ? Boolean(options.extendHorizontally) : PRICE_RANGE_DEFAULTS.EXTEND_HORIZONTALLY,
      stats: {
        priceRange: options.stats?.priceRange !== undefined ? Boolean(options.stats.priceRange) : PRICE_RANGE_DEFAULTS.STATS.priceRange,
        percentChange: options.stats?.percentChange !== undefined ? Boolean(options.stats.percentChange) : PRICE_RANGE_DEFAULTS.STATS.percentChange,
        pips: options.stats?.pips !== undefined ? Boolean(options.stats.pips) : PRICE_RANGE_DEFAULTS.STATS.pips,
      },
      label: {
        color: options.label?.color || PRICE_RANGE_DEFAULTS.LABEL.color,
        opacity: options.label?.opacity !== undefined ? options.label.opacity : PRICE_RANGE_DEFAULTS.LABEL.opacity,
        size: options.label?.size !== undefined ? options.label.size : PRICE_RANGE_DEFAULTS.LABEL.size,
        background: {
          visible: options.label?.background?.visible !== undefined ? Boolean(options.label.background.visible) : PRICE_RANGE_DEFAULTS.LABEL.background.visible,
          color: options.label?.background?.color || PRICE_RANGE_DEFAULTS.LABEL.background.color,
          opacity: options.label?.background?.opacity !== undefined ? options.label.background.opacity : PRICE_RANGE_DEFAULTS.LABEL.background.opacity,
        },
      },
      text: {
        content: options.text?.content || PRICE_RANGE_DEFAULTS.TEXT.content,
        color: options.text?.color || PRICE_RANGE_DEFAULTS.TEXT.color,
        size: options.text?.size !== undefined ? options.text.size : PRICE_RANGE_DEFAULTS.TEXT.size,
        bold: Boolean(options.text?.bold),
        italic: Boolean(options.text?.italic),
      },
    });

    // Real Price Axis Views (TradingView displays badges for both prices on right scale while selected)
    this._price1AxisView = new PriceRangeAxisView(this, 0);
    this._price2AxisView = new PriceRangeAxisView(this, 1);
  }

  /**
   * Price Axis Label Views for Lightweight Charts Series Primitive API
   * Renders real price scale badges for Price 1 and Price 2 while selected!
   */
  priceAxisViews(coordHelper) {
    if (!PRICE_RANGE_CONFIG.PRICE_AXIS_LABEL_ENABLED) return [];
    if (!this.isSelected) return [];

    const activeTf = coordHelper.activeTimeframe;
    if (activeTf && !this.isVisibleOnTimeframe(activeTf)) return [];

    this._price1AxisView._coordHelper = coordHelper;
    this._price2AxisView._coordHelper = coordHelper;

    return [this._price1AxisView, this._price2AxisView];
  }

  /**
   * Render Background (zOrder: 'bottom')
   * Rendered behind candles so candlesticks remain 100% visible through the fill!
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
   * Renders:
   * 1. Top and Bottom boundary lines (Line style)
   * 2. Outer box border (if enabled)
   * 3. Selection / hover highlight
   * 4. Info badge with live stats (price range, %, pips)
   * 5. Optional custom text note
   * 6. Interactive resize handles
   */
  renderForeground(ctx, scope, coordHelper) {
    const bounds = this.getScreenBounds(coordHelper);
    if (!bounds || this.isOffScreen(bounds, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const dpr = Math.max(hpr, vpr);

    ctx.save();

    // 1. Boundary lines at the two prices
    if (this.line.width > 0 && this.line.opacity > 0) {
      this._renderBoundaryLines(ctx, bounds, hpr, vpr);
    }

    // 2. Box Border (perimeter outline)
    if (this.border.visible && this.border.width > 0) {
      this._renderBorder(ctx, bounds, hpr, vpr);
    }

    // 3. Selection / Hover Highlight Halo
    if (this.isSelected || this.isHovered) {
      this._renderSelectionHighlight(ctx, bounds, hpr, vpr);
    }

    // 4. Retrieve Symbol Info for Precision & Pip Size
    const symbol = coordHelper.currentSymbol || 'EURUSD';
    const symInfo = (typeof coordHelper.getSymbolInfo === 'function')
      ? coordHelper.getSymbolInfo(symbol)
      : getSymbolInfo(symbol);

    const stats = this.computeStats(symInfo);

    // 5. Render Info Badge (Price range, %, pips)
    this._renderInfoLabel(ctx, bounds, stats, scope, coordHelper);

    // 6. Render Custom Text Note (if any)
    if (this.text.content && this.text.content.trim().length > 0) {
      this._renderCustomText(ctx, bounds, hpr, vpr);
    } else {
      this._textBounds = null;
    }

    // 7. Render 8 Resize Handles (if selected and unlocked)
    if (this.isSelected && !this.locked) {
      this._renderHandles(ctx, bounds, hpr, vpr, dpr);
    }

    ctx.restore();
  }

  /**
   * Render Crisp Horizontal Boundary Lines at Price 1 and Price 2
   */
  _renderBoundaryLines(ctx, bounds, hpr, vpr) {
    const lineWidth = Math.max(1, Math.round(this.line.width * vpr));
    const half = (lineWidth % 2) / 2;

    const x1 = Math.round(bounds.left * hpr);
    const x2 = Math.round(bounds.right * hpr);
    const yTop = Math.round(bounds.top * vpr) + half;
    const yBottom = Math.round(bounds.bottom * vpr) + half;

    ctx.save();
    ctx.strokeStyle = this.line.color || '#2962ff';
    ctx.globalAlpha = Math.max(0, Math.min(1, this.line.opacity !== undefined ? this.line.opacity : 1));
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.setLineDash([]);

    // Top boundary line
    ctx.beginPath();
    ctx.moveTo(x1, yTop);
    ctx.lineTo(x2, yTop);
    ctx.stroke();

    // Bottom boundary line
    ctx.beginPath();
    ctx.moveTo(x1, yBottom);
    ctx.lineTo(x2, yBottom);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render Outer Perimeter Border (solid, dashed, or dotted)
   */
  _renderBorder(ctx, bounds, hpr, vpr) {
    const lineWidth = Math.max(1, Math.round(this.border.width * hpr));
    const half = (lineWidth % 2) / 2;

    const bx = Math.round(bounds.left * hpr) + half;
    const by = Math.round(bounds.top * vpr) + half;
    const bw = Math.round(bounds.width * hpr);
    const bh = Math.round(bounds.height * vpr);

    ctx.save();
    ctx.strokeStyle = this.border.color || this.line.color || '#2962ff';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    if (this.border.style === 'dashed') {
      ctx.setLineDash([5 * hpr, 4 * hpr]);
    } else if (this.border.style === 'dotted') {
      ctx.setLineDash([2 * hpr, 3 * hpr]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
  }

  /**
   * Render Selection / Hover Halo
   */
  _renderSelectionHighlight(ctx, bounds, hpr, vpr) {
    const bx = Math.round(bounds.left * hpr);
    const by = Math.round(bounds.top * vpr);
    const bw = Math.round(bounds.width * hpr);
    const bh = Math.round(bounds.height * vpr);

    ctx.save();
    ctx.strokeStyle = this.isSelected ? '#2962ff' : 'rgba(41, 98, 255, 0.4)';
    ctx.lineWidth = Math.max(1, Math.round(1 * hpr));
    ctx.setLineDash([]);
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
  }

  /**
   * Render TradingView-style Info Badge with Live Stats:
   * - Absolute price range with symbol precision (e.g. +0.0042)
   * - Percentage change with sign (e.g. +0.39%)
   * - Pips / Ticks with sign (e.g. +42.0 pips)
   * Handles flip rules, screen edge containment, and custom background box.
   */
  _renderInfoLabel(ctx, bounds, stats, scope, coordHelper) {
    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const mediaW = scope.mediaSize.width;
    const mediaH = scope.mediaSize.height;

    // Build the formatted stats lines based on user settings
    const lines = this._formatStatsLines(stats);
    if (lines.length === 0) {
      this._labelBounds = null;
      return;
    }

    const fontSize = Math.max(10, Math.round(this.label.size * vpr));
    const fontStr = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;

    ctx.save();
    ctx.font = fontStr;

    // Measure text dimensions
    let maxTextWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line.text).width;
      if (w > maxTextWidth) maxTextWidth = w;
    }

    const padX = Math.round((PRICE_RANGE_CONFIG.LABEL_PADDING_X || 10) * hpr);
    const padY = Math.round((PRICE_RANGE_CONFIG.LABEL_PADDING_Y || 6) * vpr);
    const lineHeight = Math.round(fontSize * 1.3);

    const badgeWidth = maxTextWidth + padX * 2;
    const badgeHeight = (lines.length * lineHeight) + padY * 2;

    // Center badge horizontally on the box
    const midX = Math.round(((bounds.left + bounds.right) / 2) * hpr);
    let badgeX = Math.round(midX - (badgeWidth / 2));

    // Clamp horizontally inside visible chart pane
    const marginX = 8 * hpr;
    if (badgeX < marginX) badgeX = marginX;
    if (badgeX + badgeWidth > (mediaW * hpr) - marginX) {
      badgeX = (mediaW * hpr) - marginX - badgeWidth;
    }

    // Determine vertical position:
    // TradingView places label attached to Anchor 2 (end point) or outside the box in movement direction
    const offsetY = Math.round((PRICE_RANGE_CONFIG.LABEL_OFFSET_Y || 8) * vpr);
    const yTop = Math.round(bounds.top * vpr);
    const yBottom = Math.round(bounds.bottom * vpr);

    let badgeY;
    if (stats.isUpward) {
      // Upward move: placed ABOVE the top boundary line
      badgeY = yTop - badgeHeight - offsetY;
      // If placed too close to the top of chart window, flip inside or below
      if (badgeY < 10 * vpr) {
        badgeY = yTop + offsetY;
      }
    } else {
      // Downward move: placed BELOW the bottom boundary line
      badgeY = yBottom + offsetY;
      // If placed too close to bottom of chart window, flip inside or above
      if (badgeY + badgeHeight > (mediaH * vpr) - (10 * vpr)) {
        badgeY = yBottom - badgeHeight - offsetY;
      }
    }

    // Cache unscaled screen bounds for hitTest and clicking
    this._labelBounds = {
      left: badgeX / hpr,
      top: badgeY / vpr,
      right: (badgeX + badgeWidth) / hpr,
      bottom: (badgeY + badgeHeight) / vpr,
      width: badgeWidth / hpr,
      height: badgeHeight / vpr,
    };

    // 1. Draw Info Badge Background Pill / Box
    if (this.label.background.visible) {
      const radius = Math.round((PRICE_RANGE_CONFIG.LABEL_CORNER_RADIUS || 4) * hpr);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, this.label.background.opacity));
      ctx.fillStyle = this.label.background.color || '#1e222d';

      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, radius);
        ctx.fill();
      } else {
        ctx.fillRect(badgeX, badgeY, badgeWidth, badgeHeight);
      }

      // Thin subtle border around info badge
      ctx.strokeStyle = stats.isUpward ? '#089981' : '#f23645';
      ctx.lineWidth = Math.max(1, Math.round(1 * hpr));
      ctx.globalAlpha = 0.6;
      if (ctx.roundRect) {
        ctx.stroke();
      } else {
        ctx.strokeRect(badgeX, badgeY, badgeWidth, badgeHeight);
      }
      ctx.restore();
    }

    // 2. Draw Formatted Text Lines
    ctx.save();
    ctx.font = fontStr;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';

    const textCenterX = badgeX + (badgeWidth / 2);
    let curY = badgeY + padY;

    lines.forEach(l => {
      ctx.fillStyle = l.color || this.label.color || '#ffffff';
      ctx.globalAlpha = Math.max(0, Math.min(1, this.label.opacity));
      ctx.fillText(l.text, textCenterX, curY);
      curY += lineHeight;
    });

    ctx.restore();
    ctx.restore();
  }

  /**
   * Helper: Format stats text items according to enabled toggles
   */
  _formatStatsLines(stats) {
    const lines = [];
    const { deltaPrice, percentChange, pips, isUpward, symbolInfo } = stats;

    // Price precision from symbol info or auto
    const prec = symbolInfo?.precision !== undefined ? symbolInfo.precision : (Math.abs(deltaPrice) < 2 ? 4 : 2);
    const sign = deltaPrice > 0 ? '+' : (deltaPrice < 0 ? '-' : '');
    const absDiff = Math.abs(deltaPrice).toFixed(prec);
    const signedDiff = `${sign}${absDiff}`;

    const pctSign = percentChange > 0 ? '+' : (percentChange < 0 ? '-' : '');
    const signedPct = `${pctSign}${Math.abs(percentChange).toFixed(2)}%`;

    const statColor = isUpward ? '#089981' : '#f23645';

    // Line 1: Price Range & Percent Change
    let line1 = '';
    if (this.stats.priceRange && this.stats.percentChange) {
      line1 = `${signedDiff} (${signedPct})`;
    } else if (this.stats.priceRange) {
      line1 = `${signedDiff}`;
    } else if (this.stats.percentChange) {
      line1 = `${signedPct}`;
    }

    if (line1) {
      lines.push({ text: line1, color: '#ffffff' });
    }

    // Line 2: Pips / Minimum Ticks
    if (this.stats.pips && pips !== null && !isNaN(pips)) {
      const pipSign = pips > 0 ? '+' : (pips < 0 ? '-' : '');
      const decimals = PRICE_RANGE_CONFIG.PIP_ROUNDING_DECIMALS || 1;
      const absPips = Math.abs(pips).toFixed(decimals);
      const unit = symbolInfo?.type === 'forex' ? 'pips' : 'ticks';
      lines.push({
        text: `${pipSign}${absPips} ${unit}`,
        color: statColor,
      });
    }

    return lines;
  }

  /**
   * Render Custom Text Note
   */
  _renderCustomText(ctx, bounds, hpr, vpr) {
    const { content, color, size, bold, italic } = this.text;
    const fontSize = Math.max(9, Math.round(size * vpr));
    const fontStr = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;

    ctx.save();
    ctx.font = fontStr;
    ctx.fillStyle = color || '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const midX = Math.round(((bounds.left + bounds.right) / 2) * hpr);
    const midY = Math.round(((bounds.top + bounds.bottom) / 2) * vpr);

    ctx.fillText(content, midX, midY);

    const tw = ctx.measureText(content).width;
    const th = fontSize * 1.2;

    this._textBounds = {
      left: (midX - tw / 2) / hpr,
      top: (midY - th / 2) / vpr,
      right: (midX + tw / 2) / hpr,
      bottom: (midY + th / 2) / vpr,
    };

    ctx.restore();
  }

  /**
   * Render 8 Interactive Handles
   */
  _renderHandles(ctx, bounds, hpr, vpr, dpr) {
    const handles = this.getHandles({
      pointToScreenX: (p) => (p.logical !== undefined && bounds.rawX1 !== null) ? (p === this.points[0] ? bounds.rawX1 : bounds.rawX2) : null,
      priceToScreenY: (price) => price === this.points[0].price ? bounds.y1 : bounds.y2,
      mediaWidth: bounds.right,
    });

    const handleRadius = Math.max(3, Math.round(PRICE_RANGE_CONFIG.HANDLE_SIZE * dpr) / 2);

    ctx.save();
    for (const h of handles) {
      const sx = Math.round(h.x * hpr);
      const sy = Math.round(h.y * vpr);

      ctx.beginPath();
      ctx.arc(sx, sy, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = INTERACTION_CONSTANTS.HANDLE_COLOR || '#ffffff';
      ctx.fill();

      ctx.lineWidth = Math.max(1.5, 1.8 * dpr);
      ctx.strokeStyle = this.line.color || INTERACTION_CONSTANTS.HANDLE_BORDER_COLOR;
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Clone this Price Range drawing with new ID and fresh timestamps
   */
  clone() {
    const json = this.toJSON();
    return new PriceRangeDrawing({
      ...json,
      id: 'priceRange_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      points: [
        { ...json.points[0], price: json.points[0].price * 1.002 },
        { ...json.points[1], price: json.points[1].price * 1.002 },
      ],
      locked: false,
    });
  }

  /**
   * Factory from JSON
   */
  static fromJSON(data) {
    return new PriceRangeDrawing(data);
  }
}

/**
 * PriceRangeAxisView - Implements Lightweight Charts ISeriesPrimitiveAxisView
 * Displays price-axis badges on the right price scale for Price 1 and Price 2 while selected!
 */
class PriceRangeAxisView {
  constructor(drawing, pointIndex) {
    this._drawing = drawing;
    this._pointIndex = pointIndex;
    this._coordHelper = null;
  }

  coordinate() {
    if (!this._coordHelper || !this._drawing.points[this._pointIndex]) return -1000;
    const y = this._coordHelper.priceToScreenY(this._drawing.points[this._pointIndex].price);
    return y !== null ? y : -1000;
  }

  text() {
    const pt = this._drawing.points[this._pointIndex];
    if (!pt || pt.price === null || pt.price === undefined || isNaN(pt.price)) return '0.00';
    const price = pt.price;
    const symbol = this._coordHelper?.currentSymbol || 'EURUSD';
    const symInfo = (typeof this._coordHelper?.getSymbolInfo === 'function')
      ? this._coordHelper.getSymbolInfo(symbol)
      : getSymbolInfo(symbol);

    const prec = symInfo?.precision !== undefined ? symInfo.precision : (price < 2 ? 4 : 2);
    return price.toFixed(prec);
  }

  textColor() {
    return '#ffffff';
  }

  backColor() {
    return this._drawing.line.color || '#2962ff';
  }

  visible() {
    if (!this._drawing.isSelected) return false;
    if (!this._coordHelper) return false;

    const activeTf = this._coordHelper.activeTimeframe;
    if (activeTf && !this._drawing.isVisibleOnTimeframe(activeTf)) return false;

    return true;
  }

  tickVisible() {
    return true;
  }
}
