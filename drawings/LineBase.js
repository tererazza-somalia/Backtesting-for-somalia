/**
 * LineBase - Shared base class for all 2-point line drawings.
 *
 * Subclasses:
 * - TrendlineDrawing
 * - RayDrawing
 * - InfoLineDrawing
 * - ExtendedLineDrawing
 * - TrendAngleDrawing
 *
 * Properties:
 * - points[2]: Chart coordinates { logical, price, time }
 * - line: { color, width, opacity, style: 'solid'|'dashed'|'dotted' }
 * - extendLeft, extendRight: boolean
 * - arrows: { left: boolean, right: boolean }
 * - middlePoint: boolean (draws midpoint marker)
 * - priceLabels: boolean (renders price axis badges for anchors)
 * - stats: { enabled, alwaysShow, showPriceRange, showPercent, showPips, showBarsRange, showDateTime, showDistance, showAngle, position }
 * - text: { content, color, size, bold, italic, orientation, vAlign, hAlign }
 * - visibility, locked, zIndex
 */

import { BaseDrawing } from './BaseDrawing.js';
import {
  clipLineToRect,
  pointToLineWithExtensionDistance,
  pointToSegmentDistance,
  calculateLineStats,
  renderArrowhead,
  calculateAngleDeg,
} from './LineGeometry.js';
import { INTERACTION_CONSTANTS } from './constants.js';

export class LineBase extends BaseDrawing {
  constructor(options = {}) {
    super(options);

    // Anchor points in chart coordinates
    this.points = options.points ? options.points.map(pt => ({
      logical: pt.logical !== undefined && pt.logical !== null ? Number(pt.logical) : 0,
      price: pt.price !== undefined && pt.price !== null ? Number(pt.price) : 0,
      time: pt.time !== undefined ? pt.time : null,
    })) : [
      { logical: 0, price: 0, time: null },
      { logical: 0, price: 0, time: null },
    ];

    // Stroke style
    this.line = {
      color: options.line?.color || '#2962ff',
      width: options.line?.width !== undefined ? Number(options.line.width) : 2,
      opacity: options.line?.opacity !== undefined ? Number(options.line.opacity) : 1,
      style: options.line?.style || 'solid', // 'solid' | 'dashed' | 'dotted'
    };

    // Extensions
    this.extendLeft = options.extendLeft !== undefined ? Boolean(options.extendLeft) : false;
    this.extendRight = options.extendRight !== undefined ? Boolean(options.extendRight) : false;

    // Arrow heads
    this.arrows = {
      left: options.arrows?.left !== undefined ? Boolean(options.arrows.left) : false,
      right: options.arrows?.right !== undefined ? Boolean(options.arrows.right) : false,
    };

    // Midpoint marker
    this.middlePoint = options.middlePoint !== undefined ? Boolean(options.middlePoint) : false;

    // Price labels on price scale
    this.priceLabels = options.priceLabels !== undefined ? Boolean(options.priceLabels) : false;

    // Stats badge configuration
    this.stats = {
      enabled: options.stats?.enabled !== undefined ? Boolean(options.stats.enabled) : false,
      alwaysShow: options.stats?.alwaysShow !== undefined ? Boolean(options.stats.alwaysShow) : false,
      showPriceRange: options.stats?.showPriceRange !== undefined ? Boolean(options.stats.showPriceRange) : true,
      showPercent: options.stats?.showPercent !== undefined ? Boolean(options.stats.showPercent) : true,
      showPips: options.stats?.showPips !== undefined ? Boolean(options.stats.showPips) : true,
      showBarsRange: options.stats?.showBarsRange !== undefined ? Boolean(options.stats.showBarsRange) : true,
      showDateTime: options.stats?.showDateTime !== undefined ? Boolean(options.stats.showDateTime) : true,
      showDistance: options.stats?.showDistance !== undefined ? Boolean(options.stats.showDistance) : false,
      showAngle: options.stats?.showAngle !== undefined ? Boolean(options.stats.showAngle) : false,
      position: options.stats?.position || 'middle', // 'top' | 'middle' | 'bottom'
    };

    // Text label configuration
    this.text = {
      content: options.text?.content || '',
      color: options.text?.color || options.line?.color || '#2962ff',
      size: options.text?.size !== undefined ? Number(options.text.size) : 12,
      bold: options.text?.bold !== undefined ? Boolean(options.text.bold) : false,
      italic: options.text?.italic !== undefined ? Boolean(options.text.italic) : false,
      orientation: options.text?.orientation || 'parallel', // 'parallel' | 'horizontal'
      vAlign: options.text?.vAlign || 'top', // 'top' | 'middle' | 'bottom'
      hAlign: options.text?.hAlign || 'center', // 'left' | 'center' | 'right'
    };

    // Cached screen coordinates and bounding box
    this._cachedP1 = null;
    this._cachedP2 = null;
  }

  /**
   * Get Anchor 1
   */
  get p1() {
    return this.points[0];
  }

  set p1(val) {
    this.points[0] = val;
  }

  /**
   * Get Anchor 2
   */
  get p2() {
    return this.points[1];
  }

  set p2(val) {
    this.points[1] = val;
  }

  /**
   * Calculate screen pixel coordinates for P1 and P2
   */
  getScreenPoints(coordHelper) {
    if (!coordHelper || this.points.length < 2) return null;
    const x1 = coordHelper.pointToScreenX(this.points[0]);
    const y1 = coordHelper.priceToScreenY(this.points[0].price);
    const x2 = coordHelper.pointToScreenX(this.points[1]);
    const y2 = coordHelper.priceToScreenY(this.points[1].price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return null;

    return {
      p1: { x: x1, y: y1 },
      p2: { x: x2, y: y2 },
    };
  }

  /**
   * Screen pixel bounds for floating toolbar positioning
   */
  getScreenBounds(coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts) return null;
    const minX = Math.min(pts.p1.x, pts.p2.x);
    const maxX = Math.max(pts.p1.x, pts.p2.x);
    const minY = Math.min(pts.p1.y, pts.p2.y);
    const maxY = Math.max(pts.p1.y, pts.p2.y);
    return {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      rawX1: pts.p1.x,
      rawX2: pts.p2.x,
    };
  }

  /**
   * Check if line intersects the visible viewport
   */
  intersectsViewport(coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts) return false;
    const w = coordHelper.mediaWidth;
    const h = coordHelper.mediaHeight;

    const clipped = clipLineToRect(pts.p1.x, pts.p1.y, pts.p2.x, pts.p2.y, w, h, this.extendLeft, this.extendRight);
    return clipped.visible;
  }

  /**
   * Hit test against line body and handles
   */
  hitTest(pixelX, pixelY, coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts) return { hit: false };

    const handleRadius = (INTERACTION_CONSTANTS.HANDLE_RADIUS || 5) + 3;

    // Check Anchor 1 handle
    if (Math.hypot(pixelX - pts.p1.x, pixelY - pts.p1.y) <= handleRadius) {
      return { hit: true, type: 'handle', handleId: 'p1', cursor: 'crosshair', drawing: this };
    }

    // Check Anchor 2 handle
    if (Math.hypot(pixelX - pts.p2.x, pixelY - pts.p2.y) <= handleRadius) {
      return { hit: true, type: 'handle', handleId: 'p2', cursor: 'crosshair', drawing: this };
    }

    // Check midpoint handle if enabled
    if (this.middlePoint) {
      const midX = (pts.p1.x + pts.p2.x) / 2;
      const midY = (pts.p1.y + pts.p2.y) / 2;
      if (Math.hypot(pixelX - midX, pixelY - midY) <= handleRadius) {
        return { hit: true, type: 'handle', handleId: 'mid', cursor: 'move', drawing: this };
      }
    }

    // Check stats box bounds
    if (this._statsBoxBounds &&
        pixelX >= this._statsBoxBounds.left && pixelX <= this._statsBoxBounds.right &&
        pixelY >= this._statsBoxBounds.top && pixelY <= this._statsBoxBounds.bottom) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'pointer', drawing: this };
    }

    // Check line body distance
    const dist = pointToLineWithExtensionDistance(
      pixelX,
      pixelY,
      pts.p1.x,
      pts.p1.y,
      pts.p2.x,
      pts.p2.y,
      this.extendLeft,
      this.extendRight
    );

    const hitTolerance = Math.max(7, (this.line.width || 2) + 4);
    if (dist <= hitTolerance) {
      return { hit: true, type: 'line', cursor: this.locked ? 'not-allowed' : 'pointer', drawing: this };
    }

    return { hit: false };
  }

  /**
   * Return resize/drag handles in screen coordinates
   */
  getHandles(coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts) return [];

    const handles = [
      { id: 'p1', x: pts.p1.x, y: pts.p1.y, cursor: 'crosshair' },
      { id: 'p2', x: pts.p2.x, y: pts.p2.y, cursor: 'crosshair' },
    ];

    if (this.middlePoint) {
      handles.push({
        id: 'mid',
        x: (pts.p1.x + pts.p2.x) / 2,
        y: (pts.p1.y + pts.p2.y) / 2,
        cursor: 'move',
      });
    }

    return handles;
  }

  /**
   * Move entire drawing by delta in chart coordinates
   */
  move(deltaLogical, deltaPrice) {
    if (this.locked) return;
    this.points.forEach(pt => {
      pt.logical = (pt.logical || 0) + deltaLogical;
      pt.price = (pt.price || 0) + deltaPrice;
    });
    this.updatedAt = Date.now();
  }

  /**
   * Move a specific handle (p1, p2, or mid)
   */
  moveHandle(handleId, newLogical, newPrice, newTime) {
    if (this.locked) return;
    if (handleId === 'p1') {
      this.points[0].logical = newLogical;
      this.points[0].price = newPrice;
      if (newTime) this.points[0].time = newTime;
    } else if (handleId === 'p2') {
      this.points[1].logical = newLogical;
      this.points[1].price = newPrice;
      if (newTime) this.points[1].time = newTime;
    } else if (handleId === 'mid') {
      const curMidLogical = (this.points[0].logical + this.points[1].logical) / 2;
      const curMidPrice = (this.points[0].price + this.points[1].price) / 2;
      const dLog = newLogical - curMidLogical;
      const dPrice = newPrice - curMidPrice;
      this.move(dLog, dPrice);
    }
    this.updatedAt = Date.now();
  }

  /**
   * Renders background layer (no background fill for simple line tools)
   */
  renderBackground(ctx, scope, coordHelper) {
    // Subclasses with background fill (e.g. channels) can override this.
  }

  /**
   * Renders foreground stroke, arrowheads, labels, and handles
   */
  renderForeground(ctx, scope, coordHelper) {
    const pts = this.getScreenPoints(coordHelper);
    if (!pts) return;

    const dpr = scope.mediaSize.width / (coordHelper.mediaWidth || 1);
    const w = coordHelper.mediaWidth;
    const h = coordHelper.mediaHeight;

    const clipped = clipLineToRect(pts.p1.x, pts.p1.y, pts.p2.x, pts.p2.y, w, h, this.extendLeft, this.extendRight);
    if (!clipped.visible) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Render Main Line
    ctx.beginPath();
    ctx.strokeStyle = this.line.color || '#2962ff';
    ctx.lineWidth = Math.max(1, this.line.width || 2);
    ctx.globalAlpha = this.line.opacity !== undefined ? this.line.opacity : 1;

    if (this.line.style === 'dashed') {
      ctx.setLineDash([6, 5]);
    } else if (this.line.style === 'dotted') {
      ctx.setLineDash([2, 4]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.moveTo(clipped.start.x, clipped.start.y);
    ctx.lineTo(clipped.end.x, clipped.end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 2. Render Arrowheads (at anchor points or clipped tips)
    if (this.arrows.left && !this.extendLeft) {
      renderArrowhead(ctx, pts.p2.x, pts.p2.y, pts.p1.x, pts.p1.y, this.line.color, this.line.width, 1);
    }
    if (this.arrows.right && !this.extendRight) {
      renderArrowhead(ctx, pts.p1.x, pts.p1.y, pts.p2.x, pts.p2.y, this.line.color, this.line.width, 1);
    }

    // 3. Render Midpoint Marker
    if (this.middlePoint) {
      const midX = (pts.p1.x + pts.p2.x) / 2;
      const midY = (pts.p1.y + pts.p2.y) / 2;
      ctx.beginPath();
      ctx.arc(midX, midY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = this.line.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }

    // 4. Render Text Label (Skip for infoLine and when stats badge is active to prevent overlapping ghost text)
    const isStatsVisible = this.stats && (this.stats.alwaysShow || (this.stats.enabled && this.isSelected));
    if (this.type !== 'infoLine' && !isStatsVisible && this.text && this.text.content && this.text.content.trim()) {
      this._renderTextLabel(ctx, pts.p1, pts.p2);
    }

    // 5. Render Stats Data Box
    if (this.stats && (this.stats.alwaysShow || (this.stats.enabled && this.isSelected))) {
      this._renderStatsBox(ctx, pts.p1, pts.p2, coordHelper);
    }

    // 6. Render Selection / Hover Handles
    if (this.isSelected || this.isHovered) {
      this._renderAnchorHandle(ctx, pts.p1.x, pts.p1.y, this.line.color, 5.5);
      this._renderAnchorHandle(ctx, pts.p2.x, pts.p2.y, this.line.color, 5.5);
      if (this.middlePoint) {
        const midX = (pts.p1.x + pts.p2.x) / 2;
        const midY = (pts.p1.y + pts.p2.y) / 2;
        this._renderAnchorHandle(ctx, midX, midY, this.line.color, 4);
      }
    }

    ctx.restore();
  }

  /**
   * Render text label along or parallel to line
   */
  _renderTextLabel(ctx, p1, p2) {
    const text = this.text.content;
    const color = this.text.color || this.line.color || '#2962ff';
    const size = this.text.size || 12;
    const isBold = this.text.bold ? 'bold ' : '';
    const isItalic = this.text.italic ? 'italic ' : '';

    ctx.save();
    ctx.font = `${isItalic}${isBold}${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillStyle = color;

    // Midpoint of line segment
    let posX = (p1.x + p2.x) / 2;
    let posY = (p1.y + p2.y) / 2;

    if (this.text.hAlign === 'left') {
      posX = p1.x + (p2.x - p1.x) * 0.15;
      posY = p1.y + (p2.y - p1.y) * 0.15;
    } else if (this.text.hAlign === 'right') {
      posX = p1.x + (p2.x - p1.x) * 0.85;
      posY = p1.y + (p2.y - p1.y) * 0.85;
    }

    let angle = 0;
    if (this.text.orientation === 'parallel') {
      angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      // Keep text right-side up
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) {
        angle += Math.PI;
      }
    }

    ctx.translate(posX, posY);
    if (angle !== 0) ctx.rotate(angle);

    ctx.textAlign = 'center';
    ctx.textBaseline = this.text.vAlign === 'bottom' ? 'top' : (this.text.vAlign === 'middle' ? 'middle' : 'bottom');

    const offsetY = this.text.vAlign === 'bottom' ? 6 : (this.text.vAlign === 'middle' ? 0 : -6);
    ctx.fillText(text, 0, offsetY);

    ctx.restore();
  }

  /**
   * Vector icon: Vertical Price Range
   */
  _drawVerticalRangeIcon(ctx, x, y, size = 14, color = '#131722') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cx = x + size / 2;
    const topY = y + 1.5;
    const botY = y + size - 1.5;
    const barW = 3.5;

    // Top cap
    ctx.beginPath();
    ctx.moveTo(cx - barW, topY);
    ctx.lineTo(cx + barW, topY);
    ctx.stroke();

    // Bottom cap
    ctx.beginPath();
    ctx.moveTo(cx - barW, botY);
    ctx.lineTo(cx + barW, botY);
    ctx.stroke();

    // Vertical shaft
    ctx.beginPath();
    ctx.moveTo(cx, topY + 1.5);
    ctx.lineTo(cx, botY - 1.5);
    ctx.stroke();

    // Top arrowhead
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, topY + 4);
    ctx.lineTo(cx, topY + 1.5);
    ctx.lineTo(cx + 2.5, topY + 4);
    ctx.stroke();

    // Bottom arrowhead
    ctx.beginPath();
    ctx.moveTo(cx - 2.5, botY - 4);
    ctx.lineTo(cx, botY - 1.5);
    ctx.lineTo(cx + 2.5, botY - 4);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Vector icon: Horizontal Bars / Time Range
   */
  _drawHorizontalRangeIcon(ctx, x, y, size = 14, color = '#131722') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const cy = y + size / 2;
    const leftX = x + 1.5;
    const rightX = x + size - 1.5;
    const barH = 3.5;

    // Left cap
    ctx.beginPath();
    ctx.moveTo(leftX, cy - barH);
    ctx.lineTo(leftX, cy + barH);
    ctx.stroke();

    // Right cap
    ctx.beginPath();
    ctx.moveTo(rightX, cy - barH);
    ctx.lineTo(rightX, cy + barH);
    ctx.stroke();

    // Horizontal shaft
    ctx.beginPath();
    ctx.moveTo(leftX + 1.5, cy);
    ctx.lineTo(rightX - 1.5, cy);
    ctx.stroke();

    // Left arrowhead
    ctx.beginPath();
    ctx.moveTo(leftX + 4, cy - 2.5);
    ctx.lineTo(leftX + 1.5, cy);
    ctx.lineTo(leftX + 4, cy + 2.5);
    ctx.stroke();

    // Right arrowhead
    ctx.beginPath();
    ctx.moveTo(rightX - 4, cy - 2.5);
    ctx.lineTo(rightX - 1.5, cy);
    ctx.lineTo(rightX - 4, cy + 2.5);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Vector icon: Angle
   */
  _drawAngleIcon(ctx, x, y, size = 14, color = '#131722') {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const vertexX = x + 2;
    const vertexY = y + size - 2;
    const baseEndX = x + size - 1;
    const rayEndX = x + size - 3;
    const rayEndY = y + 2;

    // Horizontal base ray
    ctx.beginPath();
    ctx.moveTo(vertexX, vertexY);
    ctx.lineTo(baseEndX, vertexY);
    ctx.stroke();

    // Inclined ray
    ctx.beginPath();
    ctx.moveTo(vertexX, vertexY);
    ctx.lineTo(rayEndX, rayEndY);
    ctx.stroke();

    // Arc between the rays
    const arcRadius = 5.5;
    const rayAngle = Math.atan2(rayEndY - vertexY, rayEndX - vertexX);
    ctx.beginPath();
    ctx.arc(vertexX, vertexY, arcRadius, rayAngle, 0, false);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Render TradingView-style frosted stats data box with crisp vector icons
   */
  _renderStatsBox(ctx, p1, p2, coordHelper) {
    const symbolInfo = coordHelper?.getSymbolInfo?.(coordHelper.currentSymbol);
    const stats = calculateLineStats(this.points[0], this.points[1], p1, p2, symbolInfo);

    const isDark = document.body.classList.contains('theme-dark') ||
                   (!document.body.classList.contains('theme-light') && localStorage.getItem('tv_dark_mode') !== 'false');

    const items = [];

    // Row 1: Vertical Range (Price, Percent, Pips)
    if (this.stats.showPriceRange || this.stats.showPercent || this.stats.showPips) {
      const priceSign = stats.priceDiff < 0 ? '-' : '';
      const absPrice = Math.abs(stats.priceDiff).toFixed(symbolInfo?.precision !== undefined ? symbolInfo.precision : 5);
      const absPct = Math.abs(stats.percentChange).toFixed(2);
      const absPips = stats.pips.toFixed(1);

      let row1 = '';
      if (this.stats.showPriceRange) {
        row1 += `${priceSign}${absPrice}`;
      }
      if (this.stats.showPercent) {
        const pctStr = `(${priceSign}${absPct}%)`;
        row1 = row1 ? `${row1} ${pctStr}` : pctStr;
      }
      if (this.stats.showPips) {
        const pipsStr = `${priceSign}${absPips}`;
        row1 = row1 ? `${row1}, ${pipsStr}` : pipsStr;
      }
      if (row1) {
        items.push({ icon: 'vertical', text: row1 });
      }
    }

    // Row 2: Horizontal Range (Bars, Time, Distance)
    if (this.stats.showBarsRange || this.stats.showDateTime || this.stats.showDistance) {
      const row2Parts = [];
      if (this.stats.showBarsRange) {
        const barWord = stats.barsRange === 1 ? 'bar' : 'bars';
        if (this.stats.showDateTime && stats.timeStr) {
          row2Parts.push(`${stats.barsRange} ${barWord} (${stats.timeStr})`);
        } else {
          row2Parts.push(`${stats.barsRange} ${barWord}`);
        }
      } else if (this.stats.showDateTime && stats.timeStr) {
        row2Parts.push(stats.timeStr);
      }

      if (this.stats.showDistance && stats.distancePx > 0) {
        row2Parts.push(`distance: ${Math.round(stats.distancePx)} px`);
      }

      const row2 = row2Parts.join(', ');
      if (row2) {
        items.push({ icon: 'horizontal', text: row2 });
      }
    }

    // Row 3: Angle
    if (this.stats.showAngle) {
      items.push({ icon: 'angle', text: `${stats.angleDeg.toFixed(2)}°` });
    }

    if (items.length === 0) {
      this._statsBoxBounds = null;
      return;
    }

    ctx.save();
    const fontSize = 12;
    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, sans-serif`;

    let maxTextW = 0;
    items.forEach(item => {
      const w = ctx.measureText(item.text).width;
      if (w > maxTextW) maxTextW = w;
    });

    const iconW = 14;
    const iconGap = 8;
    const padX = 12;
    const padY = 8;
    const rowH = 19;

    const boxW = Math.ceil(padX * 2 + iconW + iconGap + maxTextW);
    const boxH = Math.ceil(padY * 2 + items.length * rowH);

    // Calculate box placement
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    let boxX;
    let boxY;

    if (this.stats.position === 'top') {
      boxX = midX - boxW / 2;
      boxY = Math.min(p1.y, p2.y) - boxH - 12;
    } else if (this.stats.position === 'bottom') {
      boxX = midX - boxW / 2;
      boxY = Math.max(p1.y, p2.y) + 12;
    } else {
      // TradingView default placement: offset adjacent to the line
      if (dx >= 0) {
        boxX = midX + 16;
        boxY = dy < 0 ? (midY + 8) : (midY - boxH - 8);
      } else {
        boxX = midX - boxW - 16;
        boxY = dy < 0 ? (midY + 8) : (midY - boxH - 8);
      }
    }

    // Viewport containment: keep card completely on canvas
    const canvasW = ctx.canvas?.width || 1400;
    const canvasH = ctx.canvas?.height || 900;
    const margin = 10;

    if (boxX + boxW > canvasW - margin) {
      boxX = midX - boxW - 16;
      if (boxX < margin) boxX = canvasW - boxW - margin;
    }
    if (boxX < margin) {
      boxX = margin;
    }

    if (boxY + boxH > canvasH - margin) {
      boxY = midY - boxH - 12;
      if (boxY < margin) boxY = canvasH - boxH - margin;
    }
    if (boxY < margin) {
      boxY = margin;
    }

    // Save hit test bounds
    this._statsBoxBounds = {
      left: boxX,
      top: boxY,
      right: boxX + boxW,
      bottom: boxY + boxH,
      width: boxW,
      height: boxH,
    };

    // Draw frosted card background with soft drop-shadow
    ctx.save();
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = isDark ? 10 : 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = isDark ? 'rgba(30, 34, 45, 0.94)' : 'rgba(255, 255, 255, 0.95)';
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.10)';
    ctx.lineWidth = 1;

    const cornerRadius = 6;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxW, boxH, cornerRadius);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.shadowColor = 'transparent'; // Remove shadow before stroke so border is razor-sharp
    ctx.stroke();
    ctx.restore();

    // Render rows (icon + text)
    const textColor = isDark ? '#d1d4dc' : '#131722';
    const iconColor = isDark ? '#d1d4dc' : '#131722';

    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    items.forEach((item, idx) => {
      const rowCenterY = boxY + padY + idx * rowH + rowH / 2;
      const iconX = boxX + padX;
      const iconY = rowCenterY - iconW / 2;
      const textX = iconX + iconW + iconGap;

      if (item.icon === 'vertical') {
        this._drawVerticalRangeIcon(ctx, iconX, iconY, iconW, iconColor);
      } else if (item.icon === 'horizontal') {
        this._drawHorizontalRangeIcon(ctx, iconX, iconY, iconW, iconColor);
      } else if (item.icon === 'angle') {
        this._drawAngleIcon(ctx, iconX, iconY, iconW, iconColor);
      }

      ctx.fillText(item.text, textX, rowCenterY);
    });

    ctx.restore();
  }

  /**
   * Render circular anchor handle with white center and colored stroke
   */
  _renderAnchorHandle(ctx, x, y, color, radius = 5.5) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color || '#2962ff';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Provide price-axis badge views for anchor points
   */
  priceAxisViews(coordHelper) {
    if (!this.priceLabels && !this.isSelected) return [];

    const p1 = this.points[0];
    const p2 = this.points[1];
    const color = this.line.color || '#2962ff';

    return [
      {
        coordinate: () => coordHelper.priceToScreenY(p1.price),
        text: () => (p1.price !== null && p1.price !== undefined ? p1.price.toFixed(4) : ''),
        textColor: () => '#ffffff',
        backColor: () => color,
      },
      {
        coordinate: () => coordHelper.priceToScreenY(p2.price),
        text: () => (p2.price !== null && p2.price !== undefined ? p2.price.toFixed(4) : ''),
        textColor: () => '#ffffff',
        backColor: () => color,
      },
    ];
  }

  normalize() {
    this.updatedAt = Date.now();
  }

  /**
   * Serialization
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      points: this.points.map(pt => ({
        logical: pt.logical,
        price: pt.price,
        time: pt.time,
      })),
      line: { ...this.line },
      extendLeft: this.extendLeft,
      extendRight: this.extendRight,
      arrows: { ...this.arrows },
      middlePoint: this.middlePoint,
      priceLabels: this.priceLabels,
      stats: { ...this.stats },
      text: { ...this.text },
      visibility: { ...this.visibility },
      locked: this.locked,
      zIndex: this.zIndex,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
