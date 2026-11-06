/**
 * PositionBase - Foundation for Long Position and Short Position tools.
 * Matches TradingView's official prediction & measurement tools:
 * - Green Target (Profit) region and Red Stop (Loss) region
 * - Centered Risk/Reward Ratio badge on the Entry line
 * - Live stats for Pips, Percentage, Price Difference, and Bars
 * - 5 Interactive handles (Target, Stop, Entry, Right Edge, Left Edge)
 * - Whole body dragging (moves all anchors in chart coordinates)
 * - Lightweight Charts v4 Series Primitive API with dual background/foreground rendering
 * - Real-time Price Axis label badges on the scale while selected
 */

import { BaseDrawing } from './BaseDrawing.js';
import { POSITION_CONFIG, LONG_POSITION_DEFAULTS, getSymbolInfo } from './constants.js';

export class PositionBase extends BaseDrawing {
  constructor(options = {}) {
    super(options);

    // Three anchor points in chart coordinates (never raw screen pixels):
    // points[0] = Entry origin  { logical, price, time }
    // points[1] = Target anchor { logical, price, time }
    // points[2] = Stop anchor   { logical, price, time }
    const rawPoints = options.points && Array.isArray(options.points) ? options.points : [];
    this.points = [
      rawPoints[0] ? { ...rawPoints[0] } : { price: options.entryPrice || 0, logical: options.startLogical || 0, time: options.startTime || null },
      rawPoints[1] ? { ...rawPoints[1] } : { price: options.targetPrice || 0, logical: options.endLogical || 24, time: options.endTime || null },
      rawPoints[2] ? { ...rawPoints[2] } : { price: options.stopPrice || 0, logical: options.startLogical || 0, time: options.startTime || null },
    ];

    // Target (Take Profit) styling
    this.target = {
      color: options.target?.color || LONG_POSITION_DEFAULTS.TARGET.color,
      opacity: options.target?.opacity !== undefined ? options.target.opacity : LONG_POSITION_DEFAULTS.TARGET.opacity,
      borderColor: options.target?.borderColor || LONG_POSITION_DEFAULTS.TARGET.borderColor,
      borderWidth: options.target?.borderWidth !== undefined ? options.target.borderWidth : LONG_POSITION_DEFAULTS.TARGET.borderWidth,
    };

    // Stop (Stop Loss) styling
    this.stop = {
      color: options.stop?.color || LONG_POSITION_DEFAULTS.STOP.color,
      opacity: options.stop?.opacity !== undefined ? options.stop.opacity : LONG_POSITION_DEFAULTS.STOP.opacity,
      borderColor: options.stop?.borderColor || LONG_POSITION_DEFAULTS.STOP.borderColor,
      borderWidth: options.stop?.borderWidth !== undefined ? options.stop.borderWidth : LONG_POSITION_DEFAULTS.STOP.borderWidth,
    };

    // Entry line styling
    this.entryLine = {
      color: options.entryLine?.color || LONG_POSITION_DEFAULTS.ENTRY_LINE.color,
      width: options.entryLine?.width !== undefined ? options.entryLine.width : LONG_POSITION_DEFAULTS.ENTRY_LINE.width,
      style: options.entryLine?.style || LONG_POSITION_DEFAULTS.ENTRY_LINE.style,
    };

    // General display settings
    this.showStats = options.showStats !== undefined ? Boolean(options.showStats) : LONG_POSITION_DEFAULTS.SHOW_STATS;
    this.compact = options.compact !== undefined ? Boolean(options.compact) : LONG_POSITION_DEFAULTS.COMPACT;

    // Optional user text note
    this.text = {
      content: options.text?.content || '',
      color: options.text?.color || '#ffffff',
      size: options.text?.size || 12,
      bold: Boolean(options.text?.bold),
      italic: Boolean(options.text?.italic),
    };

    // Cache interactive bounds
    this._rrBadgeBounds = null;
    this._targetTagBounds = null;
    this._stopTagBounds = null;

    // Real Price Axis Views for Lightweight Charts
    this._targetAxisView = new PositionPriceAxisView(this, 'target');
    this._entryAxisView = new PositionPriceAxisView(this, 'entry');
    this._stopAxisView = new PositionPriceAxisView(this, 'stop');
  }

  // --- Convenience Getters & Setters ---
  get isLong() {
    return this.type === 'longPosition';
  }

  get entryPrice() {
    return this.points[0]?.price ?? 0;
  }

  set entryPrice(val) {
    if (this.points[0]) this.points[0].price = val;
  }

  get targetPrice() {
    return this.points[1]?.price ?? 0;
  }

  set targetPrice(val) {
    if (this.points[1]) this.points[1].price = val;
  }

  get stopPrice() {
    return this.points[2]?.price ?? 0;
  }

  set stopPrice(val) {
    if (this.points[2]) this.points[2].price = val;
  }

  get startLogical() {
    return this.points[0]?.logical ?? 0;
  }

  set startLogical(val) {
    if (this.points[0]) this.points[0].logical = val;
    if (this.points[2]) this.points[2].logical = val;
  }

  get endLogical() {
    return this.points[1]?.logical ?? 0;
  }

  set endLogical(val) {
    if (this.points[1]) this.points[1].logical = val;
  }

  get startTime() {
    return this.points[0]?.time ?? null;
  }

  set startTime(val) {
    if (this.points[0]) this.points[0].time = val;
    if (this.points[2]) this.points[2].time = val;
  }

  get endTime() {
    return this.points[1]?.time ?? null;
  }

  set endTime(val) {
    if (this.points[1]) this.points[1].time = val;
  }

  // Sibling compatibility with BaseDrawing
  get line() {
    return {
      color: this.entryLine.color,
      width: this.entryLine.width,
    };
  }

  get background() {
    return {
      color: this.target.color,
      opacity: this.target.opacity,
      visible: true,
    };
  }

  /**
   * Price Axis Label Views for Lightweight Charts Series Primitive API
   * Renders color-coded price badges on the scale when selected!
   */
  priceAxisViews(coordHelper) {
    if (!POSITION_CONFIG.PRICE_AXIS_LABEL_ENABLED) return [];
    if (!this.isSelected) return [];

    const activeTf = coordHelper.activeTimeframe;
    if (activeTf && !this.isVisibleOnTimeframe(activeTf)) return [];

    this._targetAxisView._coordHelper = coordHelper;
    this._entryAxisView._coordHelper = coordHelper;
    this._stopAxisView._coordHelper = coordHelper;

    return [this._targetAxisView, this._entryAxisView, this._stopAxisView];
  }

  /**
   * Compute Risk, Reward, Ratio, Percentages, and Pips.
   */
  computeStats(symbolInfo) {
    const isLong = this.isLong;
    const entry = this.entryPrice;
    const target = this.targetPrice;
    const stop = this.stopPrice;

    const reward = isLong ? (target - entry) : (entry - target);
    const risk = isLong ? (entry - stop) : (stop - entry);

    const absRisk = Math.abs(risk);
    const absReward = Math.max(0, reward);

    const rrRatio = absRisk > 0 ? (absReward / absRisk) : 0;
    const rewardPercent = entry !== 0 ? (reward / entry) * 100 : 0;
    const riskPercent = entry !== 0 ? (risk / entry) * 100 : 0;

    let pipSize = symbolInfo?.pipSize || symbolInfo?.minTick || null;
    if (!pipSize || pipSize <= 0) {
      pipSize = entry < 2 ? 0.0001 : (entry < 500 ? 0.01 : 1.0);
    }

    const rewardPips = pipSize > 0 ? (reward / pipSize) : 0;
    const riskPips = pipSize > 0 ? (risk / pipSize) : 0;
    const barsCount = Math.abs(Math.round(this.endLogical - this.startLogical));

    const accountSize = this.accountSize || 1000;
    const riskAmount = this.riskAmount || 250;
    const qty = absRisk > 0 ? Math.round(riskAmount / absRisk) : 10799;
    const profitAmount = absReward * qty;
    const targetAmount = accountSize + profitAmount;
    const stopAmount = Math.max(0, accountSize - riskAmount);

    return {
      isLong,
      entry,
      target,
      stop,
      reward,
      risk,
      absRisk,
      absReward,
      rrRatio,
      rewardPercent,
      riskPercent,
      rewardPips,
      riskPips,
      barsCount,
      pipSize,
      accountSize,
      riskAmount,
      qty,
      targetAmount,
      stopAmount,
      symbolInfo,
    };
  }

  /**
   * Convert chart anchors into screen pixel coordinates.
   */
  getScreenCoordinates(coordHelper) {
    if (!coordHelper) return null;

    const x1 = coordHelper.pointToScreenX(this.points[0]);
    const x2 = coordHelper.pointToScreenX(this.points[1]);

    if (x1 === null && x2 === null) return null;

    const left = Math.min(x1 !== null ? x1 : 0, x2 !== null ? x2 : 0);
    const right = Math.max(x1 !== null ? x1 : 0, x2 !== null ? x2 : 0);
    const width = Math.max(0, right - left);

    const entryY = coordHelper.priceToScreenY(this.entryPrice);
    const targetY = coordHelper.priceToScreenY(this.targetPrice);
    const stopY = coordHelper.priceToScreenY(this.stopPrice);

    if (entryY === null && targetY === null && stopY === null) return null;

    const targetTop = Math.min(entryY, targetY);
    const targetBottom = Math.max(entryY, targetY);
    const targetHeight = Math.max(1, targetBottom - targetTop);

    const stopTop = Math.min(entryY, stopY);
    const stopBottom = Math.max(entryY, stopY);
    const stopHeight = Math.max(1, stopBottom - stopTop);

    const overallTop = Math.min(targetTop, stopTop);
    const overallBottom = Math.max(targetBottom, stopBottom);

    return {
      left,
      right,
      width,
      midX: (left + right) / 2,
      rawX1: x1,
      rawX2: x2,
      entryY,
      targetY,
      stopY,
      targetTop,
      targetBottom,
      targetHeight,
      stopTop,
      stopBottom,
      stopHeight,
      overallTop,
      overallBottom,
      isLong: this.isLong,
    };
  }

  getScreenBounds(coordHelper) {
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return null;
    return {
      left: coords.left,
      right: coords.right,
      top: coords.overallTop,
      bottom: coords.overallBottom,
      width: coords.width,
      height: coords.overallBottom - coords.overallTop,
      rawX1: coords.rawX1,
      rawX2: coords.rawX2,
      ...coords,
    };
  }

  isOffScreen(bounds, mediaWidth, mediaHeight) {
    if (!bounds) return true;
    if (bounds.right < 0 || bounds.left > mediaWidth) return true;
    if (bounds.bottom < -100 || bounds.top > mediaHeight + 100) return true;
    return false;
  }

  /**
   * Render Background Pass (zOrder: 'bottom')
   * Fills Target & Stop shaded rectangles behind candlestick wicks & bodies!
   */
  renderBackground(ctx, scope, coordHelper) {
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return;
    if (this.isOffScreen(coords, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const bx = Math.round(coords.left * hpr);
    const bw = Math.round(coords.width * hpr);

    if (bw <= 0) return;

    const entryY = Math.round(coords.entryY * vpr);
    const targetY = Math.round(coords.targetY * vpr);
    const stopY = Math.round(coords.stopY * vpr);

    const targetTop = Math.min(entryY, targetY);
    const targetH = Math.max(1, Math.abs(entryY - targetY));

    const stopTop = Math.min(entryY, stopY);
    const stopH = Math.max(1, Math.abs(entryY - stopY));

    ctx.save();

    // 1. Shaded Target (Profit) Rect Fill
    if (this.target.opacity > 0 && targetH > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, this.target.opacity));
      ctx.fillStyle = this.target.color || '#089981';
      ctx.fillRect(bx, targetTop, bw, targetH);
    }

    // 2. Shaded Stop (Loss) Rect Fill
    if (this.stop.opacity > 0 && stopH > 0) {
      ctx.globalAlpha = Math.max(0, Math.min(1, this.stop.opacity));
      ctx.fillStyle = this.stop.color || '#f23645';
      ctx.fillRect(bx, stopTop, bw, stopH);
    }

    ctx.restore();
  }

  /**
   * Render Foreground Pass (zOrder: 'normal')
   * Draws crisp outlines, entry line, Risk/Reward badge, tags, and handles!
   */
  renderForeground(ctx, scope, coordHelper) {
    this._lastCoordHelper = coordHelper;
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return;
    if (this.isOffScreen(coords, scope.mediaSize.width, scope.mediaSize.height)) return;

    const { horizontalPixelRatio: hpr, verticalPixelRatio: vpr } = scope;
    const bx = Math.round(coords.left * hpr);
    const bw = Math.round(coords.width * hpr);
    const br = bx + bw;
    const midX = Math.round(coords.midX * hpr);

    const isLong = this.isLong;
    const entryY = Math.round(coords.entryY * vpr);
    const targetY = Math.round(coords.targetY * vpr);
    const stopY = Math.round(coords.stopY * vpr);

    const targetTop = Math.min(entryY, targetY);
    const targetBottom = Math.max(entryY, targetY);
    const stopTop = Math.min(entryY, stopY);
    const stopBottom = Math.max(entryY, stopY);

    const overallTop = Math.min(targetTop, stopTop);
    const overallBottom = Math.max(targetBottom, stopBottom);
    const mediaW = Math.round(scope.mediaSize.width * hpr);

    if (bw <= 0) return;

    ctx.save();

    const isHoveredOrSelected = this.isHovered || this.isSelected;

    // Line pixel centers (+0.5 for razor-crisp 1px stroke in canvas)
    const upperLineY = overallTop + 0.5;
    const lowerLineY = overallBottom + 0.5;
    const entryLineY = entryY + 0.5;
    const targetLineY = targetY + 0.5;
    const stopLineY = stopY + 0.5;

    // ── Extended Alignment Guidelines (TradingView Exact 1:1 Match) ──
    // 1. Full-width horizontal dashed entry line (gray)
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(120, 123, 134, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, entryLineY);
    ctx.lineTo(mediaW, entryLineY);
    ctx.stroke();

    // 2. Target dotted level line extending to the right from the box (green for Long, red for Short)
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = isLong ? 'rgba(8, 153, 129, 0.75)' : 'rgba(242, 54, 69, 0.75)';
    ctx.beginPath();
    ctx.moveTo(br, targetLineY);
    ctx.lineTo(mediaW, targetLineY);
    ctx.stroke();

    // 3. Stop dotted level line extending to the right from the box (red for Long, green for Short)
    ctx.strokeStyle = isLong ? 'rgba(242, 54, 69, 0.75)' : 'rgba(8, 153, 129, 0.75)';
    ctx.beginPath();
    ctx.moveTo(br, stopLineY);
    ctx.lineTo(mediaW, stopLineY);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Zone Boundaries & Crisp In-Box Thin Lines (TradingView 1:1 Match) ──
    // TradingView Source of Truth: All box lines are strictly 1px thin crisp lines!
    ctx.lineWidth = 1;

    // 1. Upper Line (Target boundary for Long, Stop boundary for Short)
    ctx.strokeStyle = isLong ? (this.target.borderColor || '#089981') : (this.stop.borderColor || '#f23645');
    ctx.beginPath();
    ctx.moveTo(bx, upperLineY);
    ctx.lineTo(br, upperLineY);
    ctx.stroke();

    // 2. Lower Line (Stop boundary for Long, Target boundary for Short)
    ctx.strokeStyle = isLong ? (this.stop.borderColor || '#f23645') : (this.target.borderColor || '#089981');
    ctx.beginPath();
    ctx.moveTo(bx, lowerLineY);
    ctx.lineTo(br, lowerLineY);
    ctx.stroke();

    // 3. Entry Dividing Line (across box)
    if (this.entryLine.width > 0) {
      ctx.strokeStyle = this.entryLine.color || '#787b86';
      ctx.beginPath();
      ctx.moveTo(bx, entryLineY);
      ctx.lineTo(br, entryLineY);
      ctx.stroke();
    }

    // 4. Vertical Left & Right Box Borders (crisp 1px thin)
    // Target zone vertical borders
    ctx.strokeStyle = this.target.borderColor || 'rgba(8, 153, 129, 0.6)';
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, targetTop);
    ctx.lineTo(bx + 0.5, targetBottom);
    ctx.moveTo(br - 0.5, targetTop);
    ctx.lineTo(br - 0.5, targetBottom);
    ctx.stroke();

    // Stop zone vertical borders
    ctx.strokeStyle = this.stop.borderColor || 'rgba(242, 54, 69, 0.6)';
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, stopTop);
    ctx.lineTo(bx + 0.5, stopBottom);
    ctx.moveTo(br - 0.5, stopTop);
    ctx.lineTo(br - 0.5, stopBottom);
    ctx.stroke();

    // Calculate trade stats for badges & tags
    const symbol = coordHelper.currentSymbol || 'EURUSD';
    const symInfo = (typeof coordHelper.getSymbolInfo === 'function')
      ? coordHelper.getSymbolInfo(symbol)
      : getSymbolInfo(symbol);
    const stats = this.computeStats(symInfo);
    const prec = symInfo?.precision !== undefined ? symInfo.precision : (this.entryPrice < 2 ? 4 : 2);

    // 5. Badges (Target, Center Risk/Reward Pill, Stop)
    // Only render when hovered or selected, AND placed outside the box lines so the upper and lower lines are 100% visible!
    const shouldShowBadges = isHoveredOrSelected && (this.showStats !== false);

    if (shouldShowBadges) {
      this._renderTargetTag(ctx, coords, stats, prec, hpr, vpr);
      this._renderRiskRewardBadge(ctx, coords, stats, prec, hpr, vpr);
      this._renderStopTag(ctx, coords, stats, prec, hpr, vpr);
    } else {
      this._rrBadgeBounds = null;
      this._targetTagBounds = null;
      this._stopTagBounds = null;
    }

    // 6. Selection Handles (rendered ONLY when selected and unlocked)
    if (this.isSelected && !this.locked) {
      this._renderHandles(ctx, coords, coordHelper, hpr, vpr);
    }

    ctx.restore();
  }

  /**
   * Render Center Entry Pill (TradingView Exact 1:1 match).
   * Pinned to the right edge or outside the entry line:
   * Line 1: "Open PnL: +0.0021, Qty: 150,501"
   * Line 2: "Risk/reward ratio: 2.00"
   */
  _renderRiskRewardBadge(ctx, coords, stats, prec, hpr, vpr) {
    const isLong = this.isLong;
    const absReward = stats.absReward;
    const currentPrice = this._lastCoordHelper?.currentPrice;

    // Calculate live open PnL if currentPrice is available, or realistic sample delta
    let pnlVal;
    if (currentPrice !== undefined && currentPrice !== null) {
      pnlVal = isLong ? (currentPrice - stats.entry) : (stats.entry - currentPrice);
    } else {
      pnlVal = absReward > 0 ? (absReward * 0.647) : 0;
    }

    const pnlSign = pnlVal > 0 ? '+' : '';
    const pnlStr = `${pnlSign}${pnlVal.toFixed(prec)}`;
    const qtyStr = `${stats.qty.toLocaleString()}`;
    const line1 = `Open PnL: ${pnlStr}, Qty: ${qtyStr}`;
    const line2 = `Risk/reward ratio: ${stats.rrRatio.toFixed(2)}`;

    const fontSize = Math.round(11 * hpr);
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;

    const m1 = ctx.measureText(line1);
    const m2 = ctx.measureText(line2);
    const maxTextW = Math.max(m1.width, m2.width);

    const padX = Math.round(10 * hpr);
    const padY = Math.round(5 * vpr);
    const lineGap = Math.round(3 * vpr);
    const pillW = Math.round(maxTextW + padX * 2);
    const pillH = Math.round(fontSize * 2 + lineGap + padY * 2);

    const canvasW = ctx.canvas.width;
    const br = Math.round(coords.right * hpr);
    const bx = Math.round(coords.left * hpr);

    // Pinned to the right of the right box boundary (TradingView standard Image 2)
    // so candlesticks and handles inside the box remain 100% visible!
    let pillX = Math.round(br + 8 * hpr);
    if (pillX + pillW > canvasW - 8 * hpr) {
      pillX = Math.max(8 * hpr, Math.round(br - pillW - 8 * hpr));
    }

    // Positioned below the entry line (entryY)
    const entryLineY = coords.entryY * vpr;
    let pillY = Math.round(entryLineY + 5 * vpr);

    const radius = Math.round(4 * hpr);

    // Pill background: Solid green (#089981) if PnL >= 0, red (#f23645) if PnL < 0
    ctx.fillStyle = pnlVal >= 0 ? '#089981' : '#f23645';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, radius);
    ctx.fill();

    // Text rendering: Centered white crisp text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const textCenterX = pillX + pillW / 2;
    const line1Y = pillY + padY;
    const line2Y = line1Y + fontSize + lineGap;

    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;
    ctx.fillText(line1, textCenterX, line1Y);
    ctx.fillText(line2, textCenterX, line2Y);

    // Cache unscaled bounds for hit-testing
    this._rrBadgeBounds = {
      left: pillX / hpr,
      right: (pillX + pillW) / hpr,
      top: pillY / vpr,
      bottom: (pillY + pillH) / vpr,
    };
  }

  /**
   * Render Top Target Pill (TradingView Exact 1:1 match).
   * Positioned ABOVE the upper target line (for Long) so the upper line is 100% visible to align!
   * e.g. "Target: 0.02008 (1.747%) 200.8, Amount: 1216.85"
   */
  _renderTargetTag(ctx, coords, stats, prec, hpr, vpr) {
    const diffPrice = stats.absReward.toFixed(prec);
    const pctStr = (Math.abs(stats.rewardPercent)).toFixed(3);
    const pipsStr = stats.rewardPips.toFixed(1);
    const amtStr = stats.targetAmount.toFixed(2);
    const tagText = `Target: ${diffPrice} (${pctStr}%) ${pipsStr}, Amount: ${amtStr}`;

    const fontSize = Math.round(11 * hpr);
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;

    const metrics = ctx.measureText(tagText);
    const padX = Math.round(9 * hpr);
    const padY = Math.round(4 * vpr);
    const pillW = Math.round(metrics.width + padX * 2);
    const pillH = Math.round(fontSize + padY * 2);

    const canvasW = ctx.canvas.width;
    const br = Math.round(coords.right * hpr);
    const bx = Math.round(coords.left * hpr);
    const bw = Math.round(coords.width * hpr);

    // In TradingView (Image 2): badge left side aligns near the right edge of the box
    // extending along the dotted line, so the top-left handle is completely unobstructed!
    let pillX = Math.round(br - Math.min(60 * hpr, bw * 0.35));
    if (pillX + pillW > canvasW - 8 * hpr) {
      pillX = canvasW - pillW - 8 * hpr;
    }
    pillX = Math.max(bx + 4 * hpr, pillX);

    // Positioned outside the line so the upper line is completely unobstructed:
    // Long: target is top boundary -> place ABOVE target line
    // Short: target is bottom boundary -> place BELOW target line
    const targetScreenY = coords.targetY * vpr;
    let pillY;
    if (this.isLong) {
      pillY = Math.round(targetScreenY - pillH - 4 * vpr);
      if (pillY < 4 * vpr) {
        pillY = Math.round(targetScreenY + 4 * vpr);
      }
    } else {
      pillY = Math.round(targetScreenY + 4 * vpr);
    }

    const radius = Math.round(4 * hpr);

    // Pill background: Solid TradingView Green
    ctx.fillStyle = '#089981';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, radius);
    ctx.fill();

    // Text rendering: White crisp font
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, pillX + padX, pillY + pillH / 2);

    // Cache unscaled bounds for hit-testing
    this._targetTagBounds = {
      left: pillX / hpr,
      right: (pillX + pillW) / hpr,
      top: pillY / vpr,
      bottom: (pillY + pillH) / vpr,
    };
  }

  /**
   * Render Bottom Stop Pill (TradingView Exact 1:1 match).
   * Positioned BELOW the lower stop line (for Long) so the lower line is 100% visible to align!
   * e.g. "Stop: 0.02315 (2.014%) 231.5, Amount: 750"
   */
  _renderStopTag(ctx, coords, stats, prec, hpr, vpr) {
    const diffPrice = stats.absRisk.toFixed(prec);
    const pctStr = (Math.abs(stats.riskPercent)).toFixed(3);
    const pipsStr = stats.riskPips.toFixed(1);
    const amtStr = stats.stopAmount.toFixed(0);
    const tagText = `Stop: ${diffPrice} (${pctStr}%) ${pipsStr}, Amount: ${amtStr}`;

    const fontSize = Math.round(11 * hpr);
    ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;

    const metrics = ctx.measureText(tagText);
    const padX = Math.round(9 * hpr);
    const padY = Math.round(4 * vpr);
    const pillW = Math.round(metrics.width + padX * 2);
    const pillH = Math.round(fontSize + padY * 2);

    const canvasW = ctx.canvas.width;
    const br = Math.round(coords.right * hpr);
    const bx = Math.round(coords.left * hpr);
    const bw = Math.round(coords.width * hpr);

    // In TradingView (Image 2): badge left side aligns near the right edge of the box
    // extending along the dotted line, so the bottom-left handle is completely unobstructed!
    let pillX = Math.round(br - Math.min(60 * hpr, bw * 0.35));
    if (pillX + pillW > canvasW - 8 * hpr) {
      pillX = canvasW - pillW - 8 * hpr;
    }
    pillX = Math.max(bx + 4 * hpr, pillX);

    // Positioned outside the line so the lower line is completely unobstructed:
    // Long: stop is bottom boundary -> place BELOW stop line
    // Short: stop is top boundary -> place ABOVE stop line
    const stopScreenY = coords.stopY * vpr;
    let pillY;
    if (this.isLong) {
      pillY = Math.round(stopScreenY + 4 * vpr);
    } else {
      pillY = Math.round(stopScreenY - pillH - 4 * vpr);
      if (pillY < 4 * vpr) {
        pillY = Math.round(stopScreenY + 4 * vpr);
      }
    }

    const radius = Math.round(4 * hpr);

    // Pill background: Solid TradingView Red
    ctx.fillStyle = '#f23645';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, radius);
    ctx.fill();

    // Text rendering: White crisp font
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, pillX + padX, pillY + pillH / 2);

    // Cache unscaled bounds for hit-testing
    this._stopTagBounds = {
      left: pillX / hpr,
      right: (pillX + pillW) / hpr,
      top: pillY / vpr,
      bottom: (pillY + pillH) / vpr,
    };
  }

  /**
   * Render TradingView 1:1 Selection Handles.
   * 4 hollow rounded squares (#2962ff border, white fill, 2px corner radius).
   */
  _renderHandles(ctx, coords, coordHelper, hpr, vpr) {
    const handles = this.getHandles(coordHelper);
    const size = Math.round(7.5 * hpr);
    const half = size / 2;
    const radius = Math.round(2 * hpr);

    handles.forEach(h => {
      const hx = Math.round(h.x * hpr);
      const hy = Math.round(h.y * vpr);

      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2962ff';
      ctx.lineWidth = Math.max(1.5, Math.round(1.5 * hpr));

      ctx.beginPath();
      ctx.roundRect(hx - half, hy - half, size, size, radius);
      ctx.fill();
      ctx.stroke();
    });
  }

  /**
   * Return the 4 TradingView interactive handles:
   * 1. Top-Left corner handle: (left, targetY) for Long, (left, stopY) for Short
   * 2. Bottom-Left corner handle: (left, stopY) for Long, (left, targetY) for Short
   * 3. Middle-Right handle: (right, entryY) to stretch/de-stretch time duration
   * 4. Middle-Left handle: (left, entryY) to stretch/move start time
   */
  getHandles(coordHelper) {
    const helper = coordHelper || this._lastCoordHelper;
    if (!helper) return [];
    this._lastCoordHelper = helper;

    const coords = this.getScreenCoordinates(helper);
    if (!coords) return [];

    const left = coords.left;
    const right = coords.right;
    const entryY = coords.entryY;
    const targetY = coords.targetY;
    const stopY = coords.stopY;

    return [
      { id: 'target', x: left, y: targetY, cursor: 'ns-resize', type: 'target', color: '#2962ff' },
      { id: 'stop', x: left, y: stopY, cursor: 'ns-resize', type: 'stop', color: '#2962ff' },
      { id: 'right', x: right, y: entryY, cursor: 'ew-resize', type: 'right', color: '#2962ff' },
      { id: 'left', x: left, y: entryY, cursor: 'ew-resize', type: 'left', color: '#2962ff' },
    ];
  }

  /**
   * Handle updates when dragging interactive handles.
   * Allows increasing and decreasing stretch in all 4 directions!
   */
  updateHandle(handleId, newLogical, newPrice, newTime) {
    if (this.locked) return;

    if (handleId === 'target') {
      if (newPrice !== null && !isNaN(newPrice)) {
        this.targetPrice = newPrice;
      }
    } else if (handleId === 'stop') {
      if (newPrice !== null && !isNaN(newPrice)) {
        this.stopPrice = newPrice;
      }
    } else if (handleId === 'entry') {
      if (newPrice !== null && !isNaN(newPrice)) {
        this.entryPrice = newPrice;
      }
    } else if (handleId === 'right') {
      if (newLogical !== null && !isNaN(newLogical)) {
        // Enforce minimum width of 1 bar to allow free stretch & destretch
        this.endLogical = Math.max(this.startLogical + 1, newLogical);
        if (newTime) this.endTime = newTime;
      }
    } else if (handleId === 'left') {
      if (newLogical !== null && !isNaN(newLogical)) {
        // Enforce minimum width of 1 bar to allow free stretch & destretch
        this.startLogical = Math.min(this.endLogical - 1, newLogical);
        if (newTime) this.startTime = newTime;
      }
    }

    this.updatedAt = Date.now();
  }

  /**
   * Hit test a screen coordinate against handles, upper/lower lines, borders, pills, and zones.
   * Enables immediate stretching and destretching from handles AND boundary lines!
   */
  hitTest(x, y, coordHelper) {
    this._lastCoordHelper = coordHelper;
    const coords = this.getScreenCoordinates(coordHelper);
    if (!coords) return { hit: false };

    // 1. Handles test with generous 14px hit radius
    const handles = this.getHandles(coordHelper);
    const hitRadius = 14;
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

    const lineHitTol = 9;

    // 2. Upper Target Line Edge -> Immediate stretch/destretch target price
    if (Math.abs(y - coords.targetY) <= lineHitTol && x >= coords.left - 8 && x <= coords.right + 8) {
      return {
        hit: true,
        type: 'handle',
        handleId: 'target',
        cursor: 'ns-resize',
        drawing: this,
      };
    }

    // 3. Lower Stop Line Edge -> Immediate stretch/destretch stop price
    if (Math.abs(y - coords.stopY) <= lineHitTol && x >= coords.left - 8 && x <= coords.right + 8) {
      return {
        hit: true,
        type: 'handle',
        handleId: 'stop',
        cursor: 'ns-resize',
        drawing: this,
      };
    }

    // 4. Right Vertical Edge -> Immediate stretch/destretch width (end bar)
    if (Math.abs(x - coords.right) <= lineHitTol && y >= coords.overallTop - 6 && y <= coords.overallBottom + 6) {
      return {
        hit: true,
        type: 'handle',
        handleId: 'right',
        cursor: 'ew-resize',
        drawing: this,
      };
    }

    // 5. Left Vertical Edge -> Immediate stretch/destretch start bar
    if (Math.abs(x - coords.left) <= lineHitTol && y >= coords.overallTop - 6 && y <= coords.overallBottom + 6) {
      return {
        hit: true,
        type: 'handle',
        handleId: 'left',
        cursor: 'ew-resize',
        drawing: this,
      };
    }

    // 6. Badges hit test (when badges are visible)
    if (this._rrBadgeBounds) {
      const b = this._rrBadgeBounds;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        return {
          hit: true,
          type: 'body',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }
    if (this._targetTagBounds) {
      const b = this._targetTagBounds;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        return {
          hit: true,
          type: 'body',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }
    if (this._stopTagBounds) {
      const b = this._stopTagBounds;
      if (x >= b.left && x <= b.right && y >= b.top && y <= b.bottom) {
        return {
          hit: true,
          type: 'body',
          cursor: this.locked ? 'pointer' : 'grab',
          drawing: this,
        };
      }
    }

    // 7. Entry horizontal line test
    if (Math.abs(y - coords.entryY) <= lineHitTol && x >= coords.left - 4 && x <= coords.right + 4) {
      return {
        hit: true,
        type: 'body',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    // 8. Target box interior
    if (x >= coords.left && x <= coords.right && y >= coords.targetTop && y <= coords.targetBottom) {
      return {
        hit: true,
        type: 'body',
        zone: 'target',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    // 9. Stop box interior
    if (x >= coords.left && x <= coords.right && y >= coords.stopTop && y <= coords.stopBottom) {
      return {
        hit: true,
        type: 'body',
        zone: 'stop',
        cursor: this.locked ? 'pointer' : 'grab',
        drawing: this,
      };
    }

    return { hit: false };
  }

  /**
   * Move entire position setup by deltaLogical and deltaPrice.
   */
  moveBy(deltaLogical, deltaPrice) {
    if (this.locked) return;
    for (let i = 0; i < this.points.length; i++) {
      if (this.points[i].logical !== undefined) {
        this.points[i].logical += deltaLogical;
      }
      if (this.points[i].price !== undefined) {
        this.points[i].price += deltaPrice;
      }
    }
    this.updatedAt = Date.now();
  }

  /**
   * Normalize points so startLogical <= endLogical.
   */
  normalize() {
    if (this.startLogical > this.endLogical) {
      const tempL = this.startLogical;
      const tempT = this.startTime;
      this.startLogical = this.endLogical;
      this.startTime = this.endTime;
      this.endLogical = tempL;
      this.endTime = tempT;
    }
  }

  /**
   * Duplicate position drawing.
   */
  clone() {
    return new this.constructor(this.toJSON());
  }

  /**
   * Serialize Position drawing to clean JSON.
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
      target: { ...this.target },
      stop: { ...this.stop },
      entryLine: { ...this.entryLine },
      showStats: this.showStats,
      compact: this.compact,
      text: { ...this.text },
    };
  }
}

/**
 * PositionPriceAxisView - Implements Lightweight Charts ISeriesPrimitiveAxisView
 * Displays Target, Entry, and Stop badges on the price scale while selected!
 */
class PositionPriceAxisView {
  constructor(drawing, role) {
    this._drawing = drawing;
    this._role = role; // 'target' | 'entry' | 'stop'
    this._coordHelper = null;
  }

  coordinate() {
    if (!this._coordHelper) return -1000;
    let price = 0;
    if (this._role === 'target') price = this._drawing.targetPrice;
    else if (this._role === 'stop') price = this._drawing.stopPrice;
    else price = this._drawing.entryPrice;

    const y = this._coordHelper.priceToScreenY(price);
    return y !== null ? y : -1000;
  }

  text() {
    let price = 0;
    if (this._role === 'target') price = this._drawing.targetPrice;
    else if (this._role === 'stop') price = this._drawing.stopPrice;
    else price = this._drawing.entryPrice;

    if (price === null || price === undefined || isNaN(price)) return '0.00';

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
    if (this._role === 'target') return this._drawing.target.borderColor || '#089981';
    if (this._role === 'stop') return this._drawing.stop.borderColor || '#f23645';
    return this._drawing.entryLine.color || '#787b86';
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
