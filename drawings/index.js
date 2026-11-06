/**
 * Drawings Module Entry Point
 */

import {
  RECTANGLE_DEFAULTS,
  ROTATED_RECTANGLE_DEFAULTS,
  ELLIPSE_DEFAULTS,
  HORIZONTAL_RAY_DEFAULTS,
  HORIZONTAL_RAY_CONFIG,
  PRICE_RANGE_DEFAULTS,
  PRICE_RANGE_CONFIG,
  SYMBOL_METADATA,
  getSymbolInfo,
  PATH_DEFAULTS,
  PATH_CONFIG,
  BRUSH_DEFAULTS,
  BRUSH_CONFIG,
  INTERACTION_CONSTANTS,
  MAGNET_MODES,
  TIMEFRAMES,
  COLOR_PALETTE,
  LINES_GROUP_CONFIG,
  TRENDLINE_DEFAULTS,
  RAY_DEFAULTS,
  INFO_LINE_DEFAULTS,
  EXTENDED_LINE_DEFAULTS,
  TREND_ANGLE_DEFAULTS,
  HORIZONTAL_LINE_DEFAULTS,
  VERTICAL_LINE_DEFAULTS,
  CROSSLINE_DEFAULTS,
  POSITION_CONFIG,
  LONG_POSITION_DEFAULTS,
  SHORT_POSITION_DEFAULTS,
} from './constants.js';
import { BaseDrawing } from './BaseDrawing.js';
import { RangeMeasureBase } from './RangeMeasureBase.js';
import { PositionBase } from './PositionBase.js';
import { LongPositionDrawing } from './LongPositionDrawing.js';
import { ShortPositionDrawing } from './ShortPositionDrawing.js';
import { LineBase } from './LineBase.js';
import { SinglePointLineBase } from './SinglePointLineBase.js';
import { TrendlineDrawing } from './TrendlineDrawing.js';
import { RayDrawing } from './RayDrawing.js';
import { InfoLineDrawing } from './InfoLineDrawing.js';
import { ExtendedLineDrawing } from './ExtendedLineDrawing.js';
import { TrendAngleDrawing } from './TrendAngleDrawing.js';
import { HorizontalLineDrawing } from './HorizontalLineDrawing.js';
import { VerticalLineDrawing } from './VerticalLineDrawing.js';
import { CrosslineDrawing } from './CrosslineDrawing.js';
import { RectangleDrawing } from './RectangleDrawing.js';
import { RotatedRectangleDrawing } from './RotatedRectangleDrawing.js';
import { EllipseDrawing } from './EllipseDrawing.js';
import { HorizontalRayDrawing } from './HorizontalRayDrawing.js';
import { PriceRangeDrawing } from './PriceRangeDrawing.js';
import { PathDrawing } from './PathDrawing.js';
import { BrushDrawing } from './BrushDrawing.js';
import { DrawingsSeriesPrimitive } from './SeriesPrimitivePlugin.js';
import { HistoryManager } from './HistoryManager.js';
import { DrawingManager, LocalStorageAdapter } from './DrawingManager.js';
import { InteractionController } from './InteractionController.js';
import { FloatingToolbar } from './ui/FloatingToolbar.js';
import { SettingsDialog } from './ui/SettingsDialog.js';
import { AlertDialog } from './ui/AlertDialog.js';

export {
  RECTANGLE_DEFAULTS,
  ROTATED_RECTANGLE_DEFAULTS,
  ELLIPSE_DEFAULTS,
  HORIZONTAL_RAY_DEFAULTS,
  HORIZONTAL_RAY_CONFIG,
  PRICE_RANGE_DEFAULTS,
  PRICE_RANGE_CONFIG,
  SYMBOL_METADATA,
  getSymbolInfo,
  PATH_DEFAULTS,
  PATH_CONFIG,
  BRUSH_DEFAULTS,
  BRUSH_CONFIG,
  INTERACTION_CONSTANTS,
  MAGNET_MODES,
  TIMEFRAMES,
  COLOR_PALETTE,
  LINES_GROUP_CONFIG,
  TRENDLINE_DEFAULTS,
  RAY_DEFAULTS,
  INFO_LINE_DEFAULTS,
  EXTENDED_LINE_DEFAULTS,
  TREND_ANGLE_DEFAULTS,
  HORIZONTAL_LINE_DEFAULTS,
  VERTICAL_LINE_DEFAULTS,
  CROSSLINE_DEFAULTS,
  POSITION_CONFIG,
  LONG_POSITION_DEFAULTS,
  SHORT_POSITION_DEFAULTS,
  BaseDrawing,
  RangeMeasureBase,
  PositionBase,
  LongPositionDrawing,
  ShortPositionDrawing,
  LineBase,
  SinglePointLineBase,
  TrendlineDrawing,
  RayDrawing,
  InfoLineDrawing,
  ExtendedLineDrawing,
  TrendAngleDrawing,
  HorizontalLineDrawing,
  VerticalLineDrawing,
  CrosslineDrawing,
  RectangleDrawing,
  RotatedRectangleDrawing,
  EllipseDrawing,
  HorizontalRayDrawing,
  PriceRangeDrawing,
  PathDrawing,
  BrushDrawing,
  DrawingsSeriesPrimitive,
  HistoryManager,
  DrawingManager,
  LocalStorageAdapter,
  InteractionController,
  FloatingToolbar,
  SettingsDialog,
  AlertDialog,
};

/**
 * Convenience helper to initialize the entire drawing system in one call
 */
export function initDrawingEngine(config) {
  const { chart, candleSeries, chartWrapper, showToast } = config;

  const drawingManager = new DrawingManager({
    currentSymbol: config.currentSymbol || 'EURUSD',
    currentTimeframe: config.currentTimeframe || 'D',
    wrapper: chartWrapper,
  });
  drawingManager.wrapper = chartWrapper;

  // Create Series Primitive plugin and attach to candle series
  const primitive = new DrawingsSeriesPrimitive(drawingManager);
  candleSeries.attachPrimitive(primitive);

  // Initialize Interaction Controller
  const controller = new InteractionController(chart, candleSeries, chartWrapper, drawingManager);

  // Initialize Modals
  const settingsDialog = new SettingsDialog(drawingManager);
  const alertDialog = new AlertDialog(drawingManager, showToast);

  // Initialize Floating Toolbar
  const floatingToolbar = new FloatingToolbar(chartWrapper, drawingManager, {
    onOpenSettings: (drawing) => settingsDialog.open(drawing),
    onOpenAlert: (drawing) => alertDialog.open(drawing),
    onEditText: (drawing) => controller.openInlineEditor(drawing),
  });

  // Wire controller dialog triggers
  controller.onOpenSettings = (drawing) => settingsDialog.open(drawing);
  controller.onOpenAlert = (drawing) => alertDialog.open(drawing);

  // Wire action prompt banner
  const actionBanner = document.getElementById('action-banner');
  controller.onActionPrompt = (msg) => {
    if (actionBanner) {
      if (msg) {
        actionBanner.style.display = 'block';
        actionBanner.style.borderColor = '#2962ff';
        actionBanner.innerHTML = msg;
      } else {
        actionBanner.style.display = 'none';
      }
    }
  };

  // Listen to chart pan / zoom to re-position floating toolbar
  if (chart.timeScale()) {
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (drawingManager.selectedDrawing) {
        floatingToolbar.updatePosition(drawingManager.selectedDrawing);
      }
    });
  }

  return {
    manager: drawingManager,
    controller,
    primitive,
    floatingToolbar,
    settingsDialog,
    alertDialog,
  };
}
