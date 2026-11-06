/**
 * DrawingManager - Central coordinator for drawing objects, persistence, selection, and alerts.
 */

import { RectangleDrawing } from './RectangleDrawing.js';
import { RotatedRectangleDrawing } from './RotatedRectangleDrawing.js';
import { EllipseDrawing } from './EllipseDrawing.js';
import { HorizontalRayDrawing } from './HorizontalRayDrawing.js';
import { PathDrawing } from './PathDrawing.js';
import { PriceRangeDrawing } from './PriceRangeDrawing.js';
import { BrushDrawing } from './BrushDrawing.js';
import { TrendlineDrawing } from './TrendlineDrawing.js';
import { RayDrawing } from './RayDrawing.js';
import { InfoLineDrawing } from './InfoLineDrawing.js';
import { ExtendedLineDrawing } from './ExtendedLineDrawing.js';
import { TrendAngleDrawing } from './TrendAngleDrawing.js';
import { HorizontalLineDrawing } from './HorizontalLineDrawing.js';
import { VerticalLineDrawing } from './VerticalLineDrawing.js';
import { CrosslineDrawing } from './CrosslineDrawing.js';
import { LongPositionDrawing } from './LongPositionDrawing.js';
import { ShortPositionDrawing } from './ShortPositionDrawing.js';
import { HistoryManager } from './HistoryManager.js';
import { getSymbolInfo } from './constants.js';

export function parseDrawing(data) {
  if (!data) return null;
  switch (data.type) {
    case 'brush':
      return BrushDrawing.fromJSON(data);
    case 'priceRange':
      return PriceRangeDrawing.fromJSON(data);
    case 'path':
      return PathDrawing.fromJSON(data);
    case 'trendline':
      return TrendlineDrawing.fromJSON(data);
    case 'ray':
      return RayDrawing.fromJSON(data);
    case 'infoLine':
      if (data && data.text) data.text.content = '';
      return InfoLineDrawing.fromJSON(data);
    case 'extendedLine':
      return ExtendedLineDrawing.fromJSON(data);
    case 'trendAngle':
      return TrendAngleDrawing.fromJSON(data);
    case 'horizontalLine':
      return HorizontalLineDrawing.fromJSON(data);
    case 'horizontalRay':
      return HorizontalRayDrawing.fromJSON(data);
    case 'verticalLine':
      return VerticalLineDrawing.fromJSON(data);
    case 'crossline':
      return CrosslineDrawing.fromJSON(data);
    case 'longPosition':
      return LongPositionDrawing.fromJSON(data);
    case 'shortPosition':
      return ShortPositionDrawing.fromJSON(data);
    case 'rotatedRectangle':
      return RotatedRectangleDrawing.fromJSON(data);
    case 'ellipse':
      return EllipseDrawing.fromJSON(data);
    case 'rectangle':
    default:
      return RectangleDrawing.fromJSON(data);
  }
}

export class LocalStorageAdapter {
  constructor(storagePrefix = 'tv_drawings_rect_') {
    this.prefix = storagePrefix;
  }

  load(symbol) {
    try {
      const raw = localStorage.getItem(this.prefix + symbol);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('LocalStorageAdapter load failed:', err);
      return [];
    }
  }

  save(symbol, data) {
    try {
      localStorage.setItem(this.prefix + symbol, JSON.stringify(data));
    } catch (err) {
      console.error('LocalStorageAdapter save failed:', err);
    }
  }
}

export class DrawingManager {
  constructor(options = {}) {
    this.drawings = [];
    this.selectedDrawing = null;
    this.hoveredDrawing = null;
    this.currentSymbol = options.currentSymbol || 'EURUSD';
    this.currentTimeframe = options.currentTimeframe || 'D';
    this.wrapper = options.wrapper || null;
    this.storage = options.storage || new LocalStorageAdapter();
    this.history = new HistoryManager();

    this.primitive = null;
    this.onSelectionChange = null;
    this.onDrawingsChange = null;
    this.alerts = []; // Active alert listeners attached to rectangles

    // Load initial drawings for default symbol
    this.load(this.currentSymbol);
  }

  onPrimitiveAttached(primitive) {
    this.primitive = primitive;
  }

  requestRender() {
    if (this.primitive) {
      this.primitive.requestUpdate();
    }
  }

  getDrawings() {
    return this.drawings;
  }

  getDrawingById(id) {
    return this.drawings.find(d => d.id === id);
  }

  addDrawing(drawing, recordHistory = true) {
    this.drawings.push(drawing);
    if (recordHistory) {
      this.history.record({ type: 'add', drawing: drawing.toJSON() });
    }
    this.save();
    this.requestRender();
    if (this.onDrawingsChange) this.onDrawingsChange(this.drawings);
  }

  removeDrawing(id, recordHistory = true) {
    const idx = this.drawings.findIndex(d => d.id === id);
    if (idx === -1) return;

    const removed = this.drawings.splice(idx, 1)[0];
    if (this.selectedDrawing && this.selectedDrawing.id === id) {
      this.deselectDrawing();
    }
    if (recordHistory) {
      this.history.record({ type: 'delete', drawing: removed.toJSON() });
    }
    this.save();
    this.requestRender();
    if (this.onDrawingsChange) this.onDrawingsChange(this.drawings);
  }

  restoreDrawing(json, recordHistory = true) {
    const drawing = parseDrawing(json);
    if (!drawing) return;
    this.addDrawing(drawing, recordHistory);
    this.selectDrawing(drawing);
  }

  applyDrawingState(id, state, recordHistory = true) {
    const drawing = this.getDrawingById(id);
    if (!drawing) return;

    if (recordHistory) {
      this.history.record({
        type: 'modify',
        id: drawing.id,
        before: drawing.toJSON(),
        after: state,
      });
    }

    const updated = parseDrawing(state);
    if (updated) {
      Object.assign(drawing, updated);
    }
    this.save();
    this.requestRender();
    if (this.selectedDrawing && this.selectedDrawing.id === id) {
      if (this.onSelectionChange) this.onSelectionChange(drawing);
    }
  }

  selectDrawing(drawing) {
    if (this.selectedDrawing === drawing) return;
    if (this.selectedDrawing) {
      this.selectedDrawing.isSelected = false;
    }
    this.selectedDrawing = drawing;
    if (this.selectedDrawing) {
      this.selectedDrawing.isSelected = true;
    }
    this.requestRender();
    if (this.onSelectionChange) this.onSelectionChange(this.selectedDrawing);
  }

  deselectDrawing() {
    if (!this.selectedDrawing) return;
    this.selectedDrawing.isSelected = false;
    this.selectedDrawing = null;
    this.requestRender();
    if (this.onSelectionChange) this.onSelectionChange(null);
  }

  cloneDrawing(drawing) {
    if (!drawing) return;
    const cloned = drawing.clone();
    this.addDrawing(cloned, true);
    this.selectDrawing(cloned);
  }

  lockDrawing(drawing, locked = null) {
    if (!drawing) return;
    const before = drawing.toJSON();
    drawing.locked = locked !== null ? locked : !drawing.locked;
    this.history.record({
      type: 'modify',
      id: drawing.id,
      before,
      after: drawing.toJSON(),
    });
    this.save();
    this.requestRender();
    if (this.onSelectionChange) this.onSelectionChange(drawing);
  }

  bringToFront(drawing) {
    const maxZ = this.drawings.reduce((max, d) => Math.max(max, d.zIndex || 1), 1);
    drawing.zIndex = maxZ + 1;
    this.drawings.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    this.save();
    this.requestRender();
  }

  sendToBack(drawing) {
    const minZ = this.drawings.reduce((min, d) => Math.min(min, d.zIndex || 1), 1);
    drawing.zIndex = Math.max(0, minZ - 1);
    this.drawings.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    this.save();
    this.requestRender();
  }

  setSymbol(symbol) {
    if (this.currentSymbol === symbol) return;
    this.deselectDrawing();
    this.currentSymbol = symbol;
    this.load(symbol);
  }

  getSymbolInfo(symbol = this.currentSymbol) {
    return getSymbolInfo(symbol);
  }

  setTimeframe(tf) {
    if (this.currentTimeframe === tf) return;
    this.currentTimeframe = tf;
    if (this.selectedDrawing && !this.selectedDrawing.isVisibleOnTimeframe(tf)) {
      this.deselectDrawing();
    }
    this.syncLogicalCoordinates();
    this.requestRender();
  }

  syncLogicalCoordinates() {
    if (!this.primitive?._chart) return;
    const timeScale = this.primitive._chart.timeScale();
    for (const d of this.drawings) {
      if (d.points && d.points.length >= 1) {
        for (const pt of d.points) {
          if (pt.time) {
            const coord = timeScale.timeToCoordinate(pt.time);
            if (coord !== null) {
              const logical = timeScale.coordinateToLogical(coord);
              if (logical !== null) {
                pt.logical = logical;
              }
            }
          }
        }
      }
    }
  }

  save() {
    if (!this.currentSymbol) return;
    const serialized = this.drawings.map(d => d.toJSON());
    this.storage.save(this.currentSymbol, serialized);
  }

  load(symbol) {
    this.drawings = [];
    this.history.clear();
    const rawList = this.storage.load(symbol || this.currentSymbol);
    if (Array.isArray(rawList)) {
      this.drawings = rawList
        .map(data => parseDrawing(data))
        .filter(d => Boolean(d));
      this.drawings.sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    }
    this.requestRender();
    if (this.onDrawingsChange) this.onDrawingsChange(this.drawings);
  }

  undo() {
    const ok = this.history.undo(this);
    if (ok) {
      this.save();
      this.requestRender();
    }
    return ok;
  }

  redo() {
    const ok = this.history.redo(this);
    if (ok) {
      this.save();
      this.requestRender();
    }
    return ok;
  }

  // --- Alert Management ---
  createAlert(alertConfig) {
    this.alerts.push(alertConfig);
    return alertConfig;
  }

  removeAlert(alertId) {
    const idx = this.alerts.findIndex(a => a.id === alertId);
    if (idx !== -1) this.alerts.splice(idx, 1);
  }

  checkAlerts(candle) {
    if (!candle || this.alerts.length === 0) return [];
    const triggered = [];

    for (let i = this.alerts.length - 1; i >= 0; i--) {
      const alert = this.alerts[i];
      const drawing = this.getDrawingById(alert.drawingId);
      if (!drawing) continue;

      let isTriggered = false;

      if (drawing.type === 'horizontalRay') {
        const rayPrice = drawing.point ? drawing.point.price : (drawing.points[0]?.price || 0);
        if (alert.condition === 'crossing') {
          if (candle.high >= rayPrice && candle.low <= rayPrice) {
            isTriggered = true;
          }
        } else if (alert.condition === 'crossing_up') {
          if (candle.close >= rayPrice && (candle.open <= rayPrice || candle.low <= rayPrice)) {
            isTriggered = true;
          }
        } else if (alert.condition === 'crossing_down') {
          if (candle.close <= rayPrice && (candle.open >= rayPrice || candle.high >= rayPrice)) {
            isTriggered = true;
          }
        }
      } else if (drawing.points && drawing.points.length >= 2) {
        const p1 = Math.max(drawing.points[0].price, drawing.points[1].price);
        const p2 = Math.min(drawing.points[0].price, drawing.points[1].price);

        if (alert.condition === 'crossing') {
          if ((candle.high >= p1 && candle.low <= p1) || (candle.high >= p2 && candle.low <= p2)) {
            isTriggered = true;
          }
        } else if (alert.condition === 'entering') {
          if (candle.close >= p2 && candle.close <= p1) {
            isTriggered = true;
          }
        } else if (alert.condition === 'exiting') {
          if (candle.open >= p2 && candle.open <= p1 && (candle.close > p1 || candle.close < p2)) {
            isTriggered = true;
          }
        }
      }

      if (isTriggered) {
        triggered.push(alert);
        if (alert.frequency === 'once') {
          this.alerts.splice(i, 1);
        }
      }
    }
    return triggered;
  }
}
