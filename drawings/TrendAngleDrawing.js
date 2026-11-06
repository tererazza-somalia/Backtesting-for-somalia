/**
 * TrendAngleDrawing - 2-point line tool that measures and displays the angle in degrees.
 * Renders a horizontal baseline and an arc indicator showing the exact pixel slope angle.
 */

import { LineBase } from './LineBase.js';
import { calculateAngleDeg } from './LineGeometry.js';

export class TrendAngleDrawing extends LineBase {
  constructor(options = {}) {
    const statsConfig = {
      enabled: true,
      alwaysShow: false,
      showAngle: true,
      showPriceRange: false,
      showPercent: false,
      showPips: false,
      showBarsRange: false,
      showDateTime: false,
      showDistance: false,
      ...(options.stats || {}),
    };

    super({
      ...options,
      type: 'trendAngle',
      stats: statsConfig,
    });
  }

  renderForeground(ctx, scope, coordHelper) {
    // Render base line, arrows, and midpoint first
    super.renderForeground(ctx, scope, coordHelper);

    const pts = this.getScreenPoints(coordHelper);
    if (!pts) return;

    const dpr = scope.mediaSize.width / (coordHelper.mediaWidth || 1);
    ctx.save();
    ctx.scale(dpr, dpr);

    const p1 = pts.p1;
    const p2 = pts.p2;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      const angleDeg = calculateAngleDeg(p1.x, p1.y, p2.x, p2.y);
      const angleRad = Math.atan2(dy, dx);
      const isRightward = dx >= 0;

      // 1. Horizontal Reference Baseline (subtle dashed line)
      const baseLen = Math.min(dist, 100);
      const baseEndX = p1.x + (isRightward ? baseLen : -baseLen);

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(155, 158, 181, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(baseEndX, p1.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Angle Arc
      const arcRadius = Math.min(Math.max(24, dist * 0.35), 45);
      const startAngle = isRightward ? 0 : Math.PI;
      const endAngle = angleRad;

      ctx.beginPath();
      ctx.strokeStyle = this.line.color || '#2962ff';
      ctx.lineWidth = 1.5;
      // Draw arc in shortest direction
      const counterClockwise = dy < 0 ? (isRightward ? true : false) : (isRightward ? false : true);
      ctx.arc(p1.x, p1.y, arcRadius, startAngle, endAngle, counterClockwise);
      ctx.stroke();

      // 3. Angle Degree Badge
      const midAngle = (startAngle + endAngle) / 2;
      const badgeDist = arcRadius + 14;
      const badgeX = p1.x + badgeDist * Math.cos(midAngle);
      const badgeY = p1.y + badgeDist * Math.sin(midAngle);

      const angleText = `${Math.abs(angleDeg).toFixed(1)}°`;

      ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textW = ctx.measureText(angleText).width;
      const pillW = textW + 10;
      const pillH = 18;

      ctx.fillStyle = 'rgba(30, 34, 45, 0.9)';
      ctx.strokeStyle = this.line.color || '#2962ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(badgeX - pillW / 2, badgeY - pillH / 2, pillW, pillH, 4);
      } else {
        ctx.rect(badgeX - pillW / 2, badgeY - pillH / 2, pillW, pillH);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(angleText, badgeX, badgeY);
    }

    ctx.restore();
  }

  static fromJSON(data) {
    return new TrendAngleDrawing(data);
  }
}
