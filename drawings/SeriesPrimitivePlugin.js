/**
 * SeriesPrimitivePlugin - Implementation of TradingView Lightweight Charts v4 Series Primitive API.
 * Attaches to CandlestickSeries to render drawings directly in the chart canvas pipeline.
 *
 * Provides:
 * 1. Background Pane View (zOrder: 'bottom') - Renders fills BEHIND candles.
 * 2. Foreground Pane View (zOrder: 'normal') - Renders crisp borders, text, handles.
 * 3. Spatial Bounding Box Culling - 60+ FPS with 500+ drawings.
 */

export class DrawingsSeriesPrimitive {
  constructor(drawingManager) {
    this.drawingManager = drawingManager;
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;

    // Coordinate conversion helper passed to drawings
    const self = this;
    this._coordHelperMediaWidth = 0;
    this._coordHelperMediaHeight = 0;

    this._coordHelper = {
      pointToScreenX: (pt) => this.pointToScreenX(pt),
      priceToScreenY: (price) => this.priceToScreenY(price),
      get mediaWidth() {
        if (self._coordHelperMediaWidth && self._coordHelperMediaWidth > 0) {
          return self._coordHelperMediaWidth;
        }
        if (self._chart) {
          try {
            const w = self._chart.timeScale().width();
            if (w > 0) return w;
          } catch (e) {}
        }
        return self.drawingManager?.wrapper?.clientWidth || window.innerWidth || 1920;
      },
      get mediaHeight() {
        if (self._coordHelperMediaHeight && self._coordHelperMediaHeight > 0) {
          return self._coordHelperMediaHeight;
        }
        return self.drawingManager?.wrapper?.clientHeight || window.innerHeight || 1080;
      },
      get activeTimeframe() {
        return self.drawingManager?.currentTimeframe || 'D';
      },
      get currentSymbol() {
        return self.drawingManager?.currentSymbol || 'EURUSD';
      },
      getSymbolInfo: (sym) => self.drawingManager?.getSymbolInfo(sym),
    };

    // Pre-allocated Pane Views
    this._backgroundView = new BackgroundPaneView(this);
    this._foregroundView = new ForegroundPaneView(this);
    this._views = [this._backgroundView, this._foregroundView];
  }

  attached(param) {
    this._chart = param.chart;
    this._series = param.series;
    this._requestUpdate = param.requestUpdate;
    if (this.drawingManager) {
      this.drawingManager.onPrimitiveAttached(this);
    }
  }

  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }

  requestUpdate() {
    if (this._requestUpdate) {
      this._requestUpdate();
    }
  }

  updateAllViews() {
    // Called by Lightweight Charts before rendering
  }

  paneViews() {
    return this._views;
  }

  priceAxisViews() {
    if (!this.drawingManager) return [];
    const activeTf = this.drawingManager.currentTimeframe || 'D';
    const visibleDrawings = this.getVisibleDrawings(activeTf);
    const views = [];
    for (let i = 0; i < visibleDrawings.length; i++) {
      const d = visibleDrawings[i];
      if (typeof d.priceAxisViews === 'function') {
        const pViews = d.priceAxisViews(this._coordHelper);
        if (pViews && pViews.length) {
          for (let j = 0; j < pViews.length; j++) {
            views.push(pViews[j]);
          }
        }
      }
    }
    return views;
  }

  timeAxisViews() {
    if (!this.drawingManager) return [];
    const activeTf = this.drawingManager.currentTimeframe || 'D';
    const visibleDrawings = this.getVisibleDrawings(activeTf);
    const views = [];
    for (let i = 0; i < visibleDrawings.length; i++) {
      const d = visibleDrawings[i];
      if (typeof d.timeAxisViews === 'function') {
        const tViews = d.timeAxisViews(this._coordHelper);
        if (tViews && tViews.length) {
          for (let j = 0; j < tViews.length; j++) {
            views.push(tViews[j]);
          }
        }
      }
    }
    return views;
  }

  /**
   * Convert anchor point ({ time, logical }) to screen X coordinate.
   */
  pointToScreenX(pt) {
    if (!this._chart || !pt) return null;
    let x = null;

    // Prioritize logical coordinate if available for fluid dragging and future bars
    if (pt.logical !== undefined && pt.logical !== null) {
      x = this._chart.timeScale().logicalToCoordinate(pt.logical);
    }
    // Fallback to timestamp if logical coordinate is not set
    if (x === null && pt.time) {
      x = this._chart.timeScale().timeToCoordinate(pt.time);
    }
    return x;
  }

  /**
   * Convert price value to screen Y coordinate.
   */
  priceToScreenY(price) {
    if (!this._series) return null;
    return this._series.priceToCoordinate(price);
  }

  /**
   * Convert screen X to logical bar index and timestamp.
   */
  screenXToChart(x) {
    if (!this._chart) return { logical: 0, time: null };
    const logical = this._chart.timeScale().coordinateToLogical(x);
    const time = this._chart.timeScale().coordinateToTime(x);
    return { logical: logical !== null ? logical : 0, time };
  }

  /**
   * Convert screen Y to price.
   */
  screenYToPrice(y) {
    if (!this._series) return null;
    return this._series.coordinateToPrice(y);
  }

  /**
   * Filter drawings visible in the current viewport (spatial culling).
   */
  getVisibleDrawings(currentTimeframe) {
    if (!this.drawingManager) return [];
    const allDrawings = this.drawingManager.getDrawings();
    if (!this._chart) return allDrawings;

    const logicalRange = this._chart.timeScale().getVisibleLogicalRange();
    if (!logicalRange) return allDrawings;

    const pad = 10; // Margin buffer
    const minVisLogical = logicalRange.from - pad;
    const maxVisLogical = logicalRange.to + pad;

    return allDrawings.filter(drawing => {
      // 1. Timeframe filter
      if (currentTimeframe && !drawing.isVisibleOnTimeframe(currentTimeframe)) {
        return false;
      }

      // 2. Infinite extension check
      if (drawing.extendLeft || drawing.extendRight || drawing.extendHorizontally) {
        return true;
      }

      // 3. Horizontal Ray Spatial Culling (extends right indefinitely)
      if (drawing.type === 'horizontalRay') {
        const originL = drawing.point?.logical;
        if (originL !== undefined && originL !== null) {
          // If the origin is past the right edge of the visible window, it's completely off-screen
          if (originL > maxVisLogical) {
            return false;
          }
        }
        return true;
      }

      // 4. Spatial horizontal culling (Rectangles & Polygons)
      if (drawing.points && drawing.points.length >= 2) {
        const validLogicals = drawing.points
          .map(p => p.logical)
          .filter(l => l !== undefined && l !== null);
        if (validLogicals.length >= 2) {
          const spanBuffer = (drawing.type === 'rotatedRectangle' || drawing.type === 'path' || drawing.type === 'brush') ? 30 : 0;
          const rectMinL = Math.min(...validLogicals) - spanBuffer;
          const rectMaxL = Math.max(...validLogicals) + spanBuffer;
          if (rectMaxL < minVisLogical || rectMinL > maxVisLogical) {
            return false; // Fully off-screen horizontally
          }
        }
      }

      return true;
    });
  }
}

/**
 * Background Pane View (zOrder: 'bottom')
 * Draws filled shapes BEHIND candlesticks so prices and wicks stay clearly visible.
 */
class BackgroundPaneView {
  constructor(plugin) {
    this._plugin = plugin;
    this._renderer = new BackgroundPaneRenderer(plugin);
  }

  zOrder() {
    return 'bottom';
  }

  renderer() {
    return this._renderer;
  }
}

class BackgroundPaneRenderer {
  constructor(plugin) {
    this._plugin = plugin;
  }

  draw(target) {
    target.useBitmapCoordinateSpace((scope) => {
      const { context, mediaSize } = scope;
      this._plugin._coordHelperMediaWidth = mediaSize.width;
      this._plugin._coordHelperMediaHeight = mediaSize.height;
      const helper = this._plugin._coordHelper;

      const activeTf = this._plugin.drawingManager?.currentTimeframe || 'D';
      const visibleDrawings = this._plugin.getVisibleDrawings(activeTf);

      for (let i = 0; i < visibleDrawings.length; i++) {
        visibleDrawings[i].renderBackground(context, scope, helper);
      }
    });
  }
}

/**
 * Foreground Pane View (zOrder: 'normal')
 * Draws crisp borders, middle lines, text, and selection resize handles.
 */
class ForegroundPaneView {
  constructor(plugin) {
    this._plugin = plugin;
    this._renderer = new ForegroundPaneRenderer(plugin);
  }

  zOrder() {
    return 'normal';
  }

  renderer() {
    return this._renderer;
  }
}

class ForegroundPaneRenderer {
  constructor(plugin) {
    this._plugin = plugin;
  }

  draw(target) {
    target.useBitmapCoordinateSpace((scope) => {
      const { context, mediaSize } = scope;
      this._plugin._coordHelperMediaWidth = mediaSize.width;
      this._plugin._coordHelperMediaHeight = mediaSize.height;
      const helper = this._plugin._coordHelper;

      const activeTf = this._plugin.drawingManager?.currentTimeframe || 'D';
      const visibleDrawings = this._plugin.getVisibleDrawings(activeTf);

      // Render unselected drawings first, then selected drawings on top
      const unselected = [];
      const selected = [];

      for (let i = 0; i < visibleDrawings.length; i++) {
        if (visibleDrawings[i].isSelected) {
          selected.push(visibleDrawings[i]);
        } else {
          unselected.push(visibleDrawings[i]);
        }
      }

      for (let i = 0; i < unselected.length; i++) {
        unselected[i].renderForeground(context, scope, helper);
      }
      for (let i = 0; i < selected.length; i++) {
        selected[i].renderForeground(context, scope, helper);
      }
    });
  }
}
