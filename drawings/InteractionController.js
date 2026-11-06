/**
 * InteractionController - Handles all pointer, touch, and keyboard interactions for drawings.
 * Implements:
 * - Creation state machine (click-click & press-drag-release)
 * - Shift constraint for 1:1 pixel square
 * - Handle dragging with seamless flipping past opposite edges
 * - Body dragging (shifts both anchors equally)
 * - Chart pan suppression during drawing interaction
 * - Inline text editor overlay
 * - Double-click for settings dialog
 */

import { RectangleDrawing } from './RectangleDrawing.js';
import { RotatedRectangleDrawing } from './RotatedRectangleDrawing.js';
import { EllipseDrawing } from './EllipseDrawing.js';
import { HorizontalRayDrawing } from './HorizontalRayDrawing.js';
import { PriceRangeDrawing } from './PriceRangeDrawing.js';
import { PathDrawing } from './PathDrawing.js';
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
import { constrainAngle45 } from './LineGeometry.js';
import {
  INTERACTION_CONSTANTS,
  ELLIPSE_DEFAULTS,
  HORIZONTAL_RAY_CONFIG,
  PRICE_RANGE_CONFIG,
  POSITION_CONFIG,
  LONG_POSITION_DEFAULTS,
  SHORT_POSITION_DEFAULTS,
  getSymbolInfo,
  PATH_DEFAULTS,
  PATH_CONFIG,
  BRUSH_DEFAULTS,
  BRUSH_CONFIG,
  LINES_GROUP_CONFIG,
  TRENDLINE_DEFAULTS,
  RAY_DEFAULTS,
  INFO_LINE_DEFAULTS,
  EXTENDED_LINE_DEFAULTS,
  TREND_ANGLE_DEFAULTS,
  HORIZONTAL_LINE_DEFAULTS,
  VERTICAL_LINE_DEFAULTS,
  CROSSLINE_DEFAULTS,
} from './constants.js';

export class InteractionController {
  constructor(chart, candleSeries, chartWrapper, drawingManager) {
    this.chart = chart;
    this.series = candleSeries;
    this.wrapper = chartWrapper;
    this.manager = drawingManager;

    this.activeTool = null;
    this.creationState = null;
    this.dragOperation = null;
    this.lastMousePos = { x: 200, y: 200 }; // Last known cursor position for Alt+C instant placement
    this.dragOperation = null; // { type: 'handle'|'body', drawing, handleId, origPoints, startX, startY, startP1, startP2 }

    this.inlineEditorEl = null;
    this.onToolChange = null;
    this.onActionPrompt = null;
    this.onOpenSettings = null;
    this.onOpenAlert = null;
    this.onContextMenu = null;

    this._bindEvents();
  }

  setTool(tool) {
    if (this.creationState) {
      this.cancelCreation();
    }
    this.activeTool = tool;

    const isSupportedTool = [
      'rectangle', 'rotatedRectangle', 'ellipse', 'horizontalRay',
      'priceRange', 'path', 'brush', 'trendline', 'ray',
      'infoLine', 'extendedLine', 'trendAngle', 'horizontalLine',
      'verticalLine', 'crossline', 'longPosition', 'shortPosition',
    ].includes(tool);

    if (isSupportedTool) {
      this.manager.deselectDrawing();
      this.wrapper.style.cursor = 'crosshair';

      if (tool === 'longPosition') {
        this._notifyAction('🟢 <b>LONG POSITION:</b> Click chart to place setup (or drag to set target & stop) • Esc to cancel');
      } else if (tool === 'shortPosition') {
        this._notifyAction('🔴 <b>SHORT POSITION:</b> Click chart to place setup (or drag to set target & stop) • Esc to cancel');
      } else if (tool === 'brush') {
        this._notifyAction('🖌️ <b>BRUSH:</b> Press mouse and drag to draw freehand • Esc to cancel');
      } else if (tool === 'trendline') {
        this._notifyAction('📈 <b>TRENDLINE:</b> Click 1st point, move to 2nd point and click (or drag) • Hold Shift for 45° snap • Alt+T');
      } else if (tool === 'ray') {
        this._notifyAction('➡️ <b>RAY:</b> Click Point A (Origin), then Point B (Direction) • Extends infinitely right • Alt+R');
      } else if (tool === 'infoLine') {
        this._notifyAction('ℹ️ <b>INFO LINE:</b> Click 1st point, move to 2nd point to measure price, %, bars, & angle');
      } else if (tool === 'extendedLine') {
        this._notifyAction('↔️ <b>EXTENDED LINE:</b> Click 2 points to define slope • Extends infinitely both directions');
      } else if (tool === 'trendAngle') {
        this._notifyAction('📐 <b>TREND ANGLE:</b> Click 1st point, move to 2nd point to measure angle in degrees');
      } else if (tool === 'horizontalLine') {
        this.creationState = { tool: 'horizontalLine', step: 0, previewDrawing: null };
        this._notifyAction('━ <b>HORIZONTAL LINE:</b> Click price level to place line across chart • Alt+H');
      } else if (tool === 'verticalLine') {
        this.creationState = { tool: 'verticalLine', step: 0, previewDrawing: null };
        this._notifyAction('┃ <b>VERTICAL LINE:</b> Click candle or time to place vertical line • Alt+V');
      } else if (tool === 'crossline') {
        this.creationState = { tool: 'crossline', step: 0, previewDrawing: null };
        this._notifyAction('➕ <b>CROSSLINE:</b> Click to place intersecting crosshair • Alt+C');
      } else if (tool === 'horizontalRay') {
        this.creationState = {
          tool: 'horizontalRay',
          step: 0,
          previewDrawing: null,
          isDragging: false,
        };
        this._notifyAction('➡️ <b>HORIZONTAL RAY:</b> Click any candle or price to place origin (preview follows cursor) • Alt+J');
      } else if (tool === 'priceRange') {
        this._notifyAction('📏 <b>PRICE RANGE:</b> Click 1st price point, move to 2nd price and click (or drag) • Esc to cancel');
      } else if (tool === 'path') {
        this.creationState = {
          tool: 'path',
          step: 0,
          previewDrawing: null,
          placedPoints: [],
          lastClickTime: 0,
          lastClickPos: null,
        };
        this._notifyAction('〰️ <b>PATH:</b> Click to place 1st point • Click to add points • Double-click or Esc to finish');
      }
    } else {
      this.wrapper.style.cursor = '';
    }

    if (this.onToolChange) {
      this.onToolChange(this.activeTool);
    }
  }

  cancelCreation() {
    if (this.creationState?.previewDrawing) {
      this.manager.removeDrawing(this.creationState.previewDrawing.id, false);
    }
    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this._notifyAction(null);
    this.manager.requestRender();
  }

  _notifyAction(msg) {
    if (this.onActionPrompt) {
      this.onActionPrompt(msg);
    }
  }

  /**
   * Temporarily suppress chart panning so dragging drawings doesn't scroll the chart
   */
  _suppressChartPan(suppress) {
    if (!this.chart) return;
    this.chart.applyOptions({
      handleScroll: {
        pressedMouseMove: !suppress,
        horzTouchDrag: !suppress,
        vertTouchDrag: !suppress,
      },
      handleScale: {
        axisPressedMouseMove: !suppress,
      },
    });
  }

  _bindEvents() {
    // Pointer Events on Chart Wrapper
    this.wrapper.addEventListener('mousedown', (e) => this._handleMouseDown(e), true);
    window.addEventListener('mousemove', (e) => this._handleMouseMove(e), true);
    window.addEventListener('mouseup', (e) => this._handleMouseUp(e), true);

    // Clear hover when mouse cursor leaves chart wrapper
    this.wrapper.addEventListener('mouseleave', () => {
      let changed = false;
      this.manager.getDrawings().forEach(d => {
        if (d.isHovered) {
          d.isHovered = false;
          changed = true;
        }
      });
      if (changed) {
        this.manager.requestRender();
      }
    });

    // Touch Support
    this.wrapper.addEventListener('touchstart', (e) => this._handleTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this._handleTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this._handleTouchEnd(e));

    // Double-click for settings / text edit
    this.wrapper.addEventListener('dblclick', (e) => this._handleDblClick(e));

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => this._handleKeyDown(e));
  }

  _getScreenPoint(e) {
    const rect = this.wrapper.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  _handleMouseDown(e) {
    if (e.button !== 0) return; // Only primary mouse button
    const pt = this._getScreenPoint(e);

    // 1. Tool Creation Mode
    const twoPointLineTools = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'];
    if (twoPointLineTools.includes(this.activeTool)) {
      e.stopPropagation();
      this._handleLineMouseDown(this.activeTool, pt, e);
      return;
    }

    const singlePointTools = ['horizontalLine', 'verticalLine', 'crossline'];
    if (singlePointTools.includes(this.activeTool)) {
      e.stopPropagation();
      this._handleSinglePointMouseDown(this.activeTool, pt, e);
      return;
    }

    if (this.activeTool === 'longPosition' || this.activeTool === 'shortPosition') {
      e.stopPropagation();
      this._handlePositionMouseDown(this.activeTool, pt, e);
      return;
    }

    if (this.activeTool === 'priceRange') {
      e.stopPropagation();
      this._handlePriceRangeMouseDown(pt, e);
      return;
    }

    if (this.activeTool === 'rectangle') {
      e.stopPropagation();
      this._handleCreationMouseDown(pt, e);
      return;
    }

    if (this.activeTool === 'rotatedRectangle') {
      e.stopPropagation();
      this._handleRotatedRectMouseDown(pt, e);
      return;
    }

    if (this.activeTool === 'ellipse') {
      e.stopPropagation();
      this._handleEllipseMouseDown(pt, e);
      return;
    }

    if (this.activeTool === 'horizontalRay') {
      e.stopPropagation();
      this._handleHorizontalRayMouseDown(pt, e);
      return;
    }

    if (this.activeTool === 'path') {
      e.stopPropagation();
      this._handlePathMouseDown(pt, e);
      return;
    }

    if (this.activeTool === 'brush') {
      e.stopPropagation();
      this._handleBrushMouseDown(pt, e);
      return;
    }

    // 2. Select / Edit Mode
    const helper = this.manager.primitive?._coordHelper;
    if (!helper) return;

    // Check hit test against existing drawings (top-most z-index first)
    const drawings = [...this.manager.getDrawings()].sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1));
    let hitResult = null;

    for (const d of drawings) {
      if (!d.isVisibleOnTimeframe(this.manager.currentTimeframe)) continue;
      const res = d.hitTest(pt.x, pt.y, helper);
      if (res.hit) {
        hitResult = res;
        break;
      }
    }

    if (hitResult) {
      e.stopPropagation();
      const target = hitResult.drawing;

      // Select drawing
      this.manager.selectDrawing(target);

      if (target.locked) {
        return; // Locked drawings cannot move or resize
      }

      this._suppressChartPan(true);

      if (hitResult.type === 'handle') {
        if (target.type === 'brush') {
          this.dragOperation = {
            type: 'brushCornerHandle',
            drawing: target,
            handleId: hitResult.handleId,
            origJSON: target.toJSON(),
            startX: pt.x,
            startY: pt.y,
            origPoints: target.points.map(p => ({ ...p })),
            origBounds: target.getChartBounds(),
          };
        } else if (target.type === 'path') {
          target.selectedHandleIndex = hitResult.handleIndex;
          this.dragOperation = {
            type: 'pathHandle',
            drawing: target,
            handleIndex: hitResult.handleIndex,
            origJSON: target.toJSON(),
            startX: pt.x,
            startY: pt.y,
            initialPoints: target.points.map(p => ({ ...p })),
          };
        } else {
          // Start handle resize
          const geom = target.type === 'rotatedRectangle' ? target.getCorners(helper) : null;
          this.dragOperation = {
            type: 'handle',
            drawing: target,
            handleId: hitResult.handleId,
            origJSON: target.toJSON(),
            startX: pt.x,
            startY: pt.y,
            initialPoints: target.points.map(p => ({ ...p })),
            initialWidth: geom ? geom.width : 0,
          };
        }
      } else if (hitResult.type === 'body' || hitResult.type === 'border' || hitResult.type === 'line') {
        if (target.type === 'path') {
          target.selectedHandleIndex = null;
        }
        // Start move drag
        const chartPos = this.manager.primitive.screenXToChart(pt.x);
        const pricePos = this.manager.primitive.screenYToPrice(pt.y);

        this.dragOperation = {
          type: 'body',
          drawing: target,
          origJSON: target.toJSON(),
          startX: pt.x,
          startY: pt.y,
          startLogical: chartPos.logical,
          startPrice: pricePos,
          initialPoints: target.points.map(p => ({ ...p })),
        };
      } else if (hitResult.type === 'text') {
        // Direct click on text opens inline text editor
        this.openInlineEditor(target);
      }
    } else {
      // Clicked empty chart space -> deselect
      if (this.manager.selectedDrawing && !e.target.closest('#tv-rect-toolbar') && !e.target.closest('.tv-dialog-overlay')) {
        this.manager.deselectDrawing();
      }
    }
  }

  _handleCreationMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    if (!this.creationState) {
      // Step 1: First Corner Placed
      const newRect = new RectangleDrawing({
        points: [
          { time: chartX.time, logical: chartX.logical, price: priceY },
          { time: chartX.time, logical: chartX.logical, price: priceY },
        ],
      });
      newRect.isSelected = true;
      this.manager.addDrawing(newRect, false);

      this.creationState = {
        startX: pt.x,
        startY: pt.y,
        startLogical: chartX.logical,
        startPrice: priceY,
        startTime: chartX.time,
        previewDrawing: newRect,
        isDragging: true,
      };
      this._suppressChartPan(true);
    } else {
      // Step 2: Second Click in Click-Move-Click Mode -> Finish
      this._finishCreation(pt, e.shiftKey);
    }
  }

  _handleMouseMove(e) {
    const pt = this._getScreenPoint(e);
    this.lastMousePos = pt;

    // 1. Tool Creation Preview
    if (this.creationState) {
      const twoPointLineTools = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'];
      if (twoPointLineTools.includes(this.creationState.tool)) {
        this._updateLinePreview(pt, e.shiftKey);
      } else if (['horizontalLine', 'verticalLine', 'crossline'].includes(this.creationState.tool)) {
        this._updateSinglePointPreview(pt);
      } else if (this.creationState.tool === 'brush') {
        this._updateBrushPreview(pt, e);
      } else if (this.creationState.tool === 'longPosition' || this.creationState.tool === 'shortPosition') {
        this._updatePositionPreview(pt);
      } else if (this.creationState.tool === 'path') {
        this._updatePathPreview(pt);
      } else if (this.creationState.tool === 'priceRange') {
        this._updatePriceRangePreview(pt);
      } else if (this.creationState.tool === 'rotatedRectangle') {
        this._updateRotatedRectPreview(pt, e.shiftKey);
      } else if (this.creationState.tool === 'ellipse') {
        this._updateEllipseCreationPreview(pt, e.shiftKey);
      } else if (this.creationState.tool === 'horizontalRay') {
        this._updateHorizontalRayPreview(pt);
      } else {
        this._updateCreationPreview(pt, e.shiftKey);
      }
      return;
    }

    // Live preview tracking for single-point tools before click
    if (['horizontalLine', 'verticalLine', 'crossline'].includes(this.activeTool)) {
      this._updateSinglePointPreview(pt);
      return;
    }

    // 2. Active Drag Operation (Handle Resize or Body Move)
    if (this.dragOperation) {
      this._updateDragOperation(pt, e.shiftKey);
      return;
    }

    // 3. Hover Cursor State
    if (!this.activeTool) {
      this._updateHoverCursor(pt);
    }
  }

  // --- Two-Point Line Tools (Trendline, Ray, Info Line, Extended Line, Trend Angle) ---
  _createLineInstance(tool, p1, p2) {
    const opts = { points: [p1, p2] };
    switch (tool) {
      case 'ray':
        return new RayDrawing(opts);
      case 'infoLine':
        return new InfoLineDrawing(opts);
      case 'extendedLine':
        return new ExtendedLineDrawing(opts);
      case 'trendAngle':
        return new TrendAngleDrawing(opts);
      case 'trendline':
      default:
        return new TrendlineDrawing(opts);
    }
  }

  _handleLineMouseDown(tool, pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    if (!this.creationState) {
      // Step 1: Click 1 -> First point placed
      const p1 = { logical: chartX.logical, price: priceY, time: chartX.time || null };
      const preview = this._createLineInstance(tool, p1, { ...p1 });
      preview.isSelected = true;
      this.manager.addDrawing(preview, false);

      this.creationState = {
        tool,
        step: 1,
        startX: pt.x,
        startY: pt.y,
        startLogical: chartX.logical,
        startPrice: priceY,
        startTime: chartX.time,
        previewDrawing: preview,
        isDragging: true,
      };
      this._suppressChartPan(true);
      this._notifyAction(`✏️ <b>${tool.toUpperCase()}:</b> Move to 2nd point and click (or drag) • Hold Shift for 45° snap • Esc to cancel`);
    } else {
      // Step 2: Second click in click-move-click mode -> Finish
      this._finishLineCreation(pt, e.shiftKey);
    }
  }

  _updateLinePreview(pt, isShiftConstrained) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const line = this.creationState.previewDrawing;

    let targetX = pt.x;
    let targetY = pt.y;

    if (isShiftConstrained) {
      const snapped = constrainAngle45(this.creationState.startX, this.creationState.startY, targetX, targetY);
      targetX = snapped.x;
      targetY = snapped.y;
    }

    const chartX = this.manager.primitive.screenXToChart(targetX);
    const priceY = this.manager.primitive.screenYToPrice(targetY);
    if (priceY === null) return;

    line.points[1] = {
      logical: chartX.logical,
      time: chartX.time || null,
      price: priceY,
    };

    this.manager.requestRender();
  }

  _finishLineCreation(pt, isShiftConstrained) {
    if (!this.creationState) return;
    const line = this.creationState.previewDrawing;

    let targetX = pt.x;
    let targetY = pt.y;

    if (isShiftConstrained) {
      const snapped = constrainAngle45(this.creationState.startX, this.creationState.startY, targetX, targetY);
      targetX = snapped.x;
      targetY = snapped.y;
    }

    const dist = Math.hypot(targetX - this.creationState.startX, targetY - this.creationState.startY);
    if (dist < 4) {
      this.cancelCreation();
      return;
    }

    const chartX = this.manager.primitive.screenXToChart(targetX);
    const priceY = this.manager.primitive.screenYToPrice(targetY);
    if (priceY === null) {
      this.cancelCreation();
      return;
    }

    line.points[1] = {
      logical: chartX.logical,
      time: chartX.time || null,
      price: priceY,
    };

    this.manager.history.record({ type: 'add', drawing: line.toJSON() });
    this.manager.save();

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this.manager.selectDrawing(line);
    this._notifyAction(null);
    this.manager.requestRender();
  }

  // --- Single-Point Tools (Horizontal Line, Vertical Line, Crossline) ---
  _createSinglePointInstance(tool, pt) {
    const opts = { point: pt };
    switch (tool) {
      case 'verticalLine':
        return new VerticalLineDrawing(opts);
      case 'crossline':
        return new CrosslineDrawing(opts);
      case 'horizontalLine':
      default:
        return new HorizontalLineDrawing(opts);
    }
  }

  _handleSinglePointMouseDown(tool, pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    const anchor = {
      logical: chartX.logical,
      price: priceY,
      time: chartX.time || null,
    };

    if (this.creationState?.previewDrawing) {
      this.manager.removeDrawing(this.creationState.previewDrawing.id, false);
    }

    const drawing = this._createSinglePointInstance(tool, anchor);
    this.manager.history.record({ type: 'add', drawing: drawing.toJSON() });
    this.manager.save();

    this.manager.addDrawing(drawing, false);
    this.manager.selectDrawing(drawing);

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this._notifyAction(null);
    this.manager.requestRender();
  }

  _updateSinglePointPreview(pt) {
    const tool = this.activeTool;
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    const anchor = {
      logical: chartX.logical,
      price: priceY,
      time: chartX.time || null,
    };

    if (!this.creationState?.previewDrawing) {
      const preview = this._createSinglePointInstance(tool, anchor);
      preview.isSelected = true;
      this.manager.addDrawing(preview, false);
      this.creationState = {
        tool,
        previewDrawing: preview,
      };
    } else {
      const preview = this.creationState.previewDrawing;
      preview.point.logical = anchor.logical;
      preview.point.price = anchor.price;
      if (anchor.time) preview.point.time = anchor.time;
      this.manager.requestRender();
    }
  }

  placeCrosslineAtCursor(screenX, screenY) {
    const pt = (screenX !== undefined && screenY !== undefined)
      ? { x: screenX, y: screenY }
      : (this.lastMousePos || { x: this.wrapper.clientWidth / 2, y: this.wrapper.clientHeight / 2 });

    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    const drawing = new CrosslineDrawing({
      point: {
        logical: chartX.logical,
        price: priceY,
        time: chartX.time || null,
      },
    });

    this.manager.history.record({ type: 'add', drawing: drawing.toJSON() });
    this.manager.save();
    this.manager.addDrawing(drawing, false);
    this.manager.selectDrawing(drawing);
    this.manager.requestRender();
    this._notifyAction('➕ <b>CROSSLINE:</b> Placed at cursor (Alt+C)');
  }

  // --- Horizontal Ray Single-Click Creation with Live Preview ---
  _handleHorizontalRayMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    // Clean up temporary live preview drawing
    if (this.creationState?.previewDrawing) {
      this.manager.removeDrawing(this.creationState.previewDrawing.id, false);
    }

    // Create permanent Horizontal Ray
    const ray = new HorizontalRayDrawing({
      point: {
        time: chartX.time,
        logical: chartX.logical,
        price: priceY,
      },
    });

    this.manager.addDrawing(ray, true);
    this.manager.selectDrawing(ray);

    // Track for click-drag support: if mouse drags after click, anchor updates until mouseup
    this.creationState = {
      tool: 'horizontalRay',
      placedDrawing: ray,
      startX: pt.x,
      startY: pt.y,
      isDragging: true,
    };
    this._suppressChartPan(true);
  }

  _updateHorizontalRayPreview(pt) {
    if (!this.creationState) return;
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    if (this.creationState.placedDrawing) {
      // User is click-dragging right after initial click
      const ray = this.creationState.placedDrawing;
      ray.point.logical = chartX.logical;
      if (chartX.time) ray.point.time = chartX.time;
      ray.point.price = priceY;
      this.manager.requestRender();
      return;
    }

    // Live preview following cursor before click
    if (!this.creationState.previewDrawing) {
      const preview = new HorizontalRayDrawing({
        point: {
          time: chartX.time,
          logical: chartX.logical,
          price: priceY,
        },
      });
      preview.isSelected = true;
      this.manager.addDrawing(preview, false);
      this.creationState.previewDrawing = preview;
    } else {
      const preview = this.creationState.previewDrawing;
      preview.point.logical = chartX.logical;
      if (chartX.time) preview.point.time = chartX.time;
      preview.point.price = priceY;
      this.manager.requestRender();
    }
  }

  // --- Path Multi-Point Creation State Machine ---
  _handlePathMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    const now = Date.now();
    const state = this.creationState;

    // Double-click detection:
    // If clicked within 350ms and within 15px of previous click -> finish immediately without duplicate point.
    // The first click of double-click already placed the final point.
    if (state && state.lastClickPos && (now - state.lastClickTime < 350)) {
      const dist = Math.hypot(pt.x - state.lastClickPos.x, pt.y - state.lastClickPos.y);
      if (dist <= 15) {
        this._finishPathCreation(true);
        return;
      }
    }

    if (!state || state.step === 0 || !state.placedPoints || state.placedPoints.length === 0) {
      // Step 1: First point placed
      const firstPt = {
        price: priceY,
        logical: chartX.logical,
        time: chartX.time || null,
      };

      const previewPath = new PathDrawing({
        points: [firstPt, { ...firstPt }],
        line: { ...PATH_DEFAULTS.LINE },
        arrows: { ...PATH_DEFAULTS.ARROWS },
        visibility: { ...PATH_DEFAULTS.VISIBILITY },
      });
      previewPath.isSelected = true;
      this.manager.addDrawing(previewPath, false);

      this.creationState = {
        tool: 'path',
        step: 1,
        placedPoints: [firstPt],
        previewDrawing: previewPath,
        lastClickTime: now,
        lastClickPos: { x: pt.x, y: pt.y },
      };
      this._suppressChartPan(true);
      this._notifyAction('〰️ <b>PATH:</b> Click to place next point (1 placed) • Double-click or Esc to finish');
    } else {
      // Step 2+: Next anchor placed
      const newPt = {
        price: priceY,
        logical: chartX.logical,
        time: chartX.time || null,
      };
      state.placedPoints.push(newPt);
      state.lastClickTime = now;
      state.lastClickPos = { x: pt.x, y: pt.y };

      // Update preview drawing
      state.previewDrawing.points = [...state.placedPoints, { ...newPt }];
      this.manager.requestRender();
      this._notifyAction(`〰️ <b>PATH:</b> Click to place next point (${state.placedPoints.length} placed) • Double-click or Esc to finish`);
    }
  }

  _updatePathPreview(pt) {
    const state = this.creationState;
    if (!state || !state.previewDrawing || !state.placedPoints || state.placedPoints.length === 0) return;

    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    const livePt = {
      price: priceY,
      logical: chartX.logical,
      time: chartX.time || null,
    };
    state.previewDrawing.points = [...state.placedPoints, livePt];
    this.manager.requestRender();
  }

  _finishPathCreation(isDblClick = false) {
    const state = this.creationState;
    if (!state) return;

    // Clean up temporary preview drawing
    if (state.previewDrawing) {
      this.manager.removeDrawing(state.previewDrawing.id, false);
    }

    let pointsToKeep = state.placedPoints ? [...state.placedPoints] : [];

    // Deduplicate trailing points automatically (especially on double-click completion)
    if (pointsToKeep.length >= 2) {
      const last = pointsToKeep[pointsToKeep.length - 1];
      const secondLast = pointsToKeep[pointsToKeep.length - 2];
      const samePrice = Math.abs(last.price - secondLast.price) < 1e-6;
      const sameLogical = (last.logical !== undefined && secondLast.logical !== undefined)
        ? Math.abs(last.logical - secondLast.logical) < 1e-4
        : true;
      if (samePrice && sameLogical) {
        pointsToKeep.pop();
      }
    }

    if (pointsToKeep.length >= 2) {
      const finalPath = new PathDrawing({
        points: pointsToKeep,
        line: { ...PATH_DEFAULTS.LINE },
        arrows: { ...PATH_DEFAULTS.ARROWS },
        visibility: { ...PATH_DEFAULTS.VISIBILITY },
        locked: false,
      });
      finalPath.normalize();
      this.manager.addDrawing(finalPath, true);
      this.manager.selectDrawing(finalPath);
      this._suppressChartPan(false);
      this.creationState = null;
      this._notifyAction(null);

      if (PATH_CONFIG.STAY_IN_DRAWING_MODE) {
        this.setTool('path');
      } else {
        this.setTool(null);
      }
      this.manager.requestRender();
    } else {
      // Discard shape if fewer than 2 points
      this.cancelCreation();
    }
  }

  // --- Brush Freehand Drawing Tool (Press-Drag-Release with RDP Simplification) ---
  _handleBrushMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null || chartX.logical === null) return;

    // Suppress chart panning while user is drawing freehand
    this._suppressChartPan(true);

    const firstPt = {
      logical: chartX.logical,
      price: priceY,
      time: chartX.time || null,
    };

    // Live preview drawing with final style
    const previewBrush = new BrushDrawing({
      points: [firstPt],
      line: { ...BRUSH_DEFAULTS.LINE },
      background: { ...BRUSH_DEFAULTS.BACKGROUND },
      visibility: { ...BRUSH_DEFAULTS.VISIBILITY },
      locked: false,
    });
    previewBrush.isSelected = false;
    this.manager.addDrawing(previewBrush, false);

    this.creationState = {
      tool: 'brush',
      previewDrawing: previewBrush,
      rawScreenPoints: [{ x: pt.x, y: pt.y }],
      lastSampledPoint: { x: pt.x, y: pt.y },
    };

    this.manager.requestRender();
  }

  _updateBrushPreview(pt, e) {
    const state = this.creationState;
    if (!state || !state.previewDrawing) return;

    // High frequency events support: e.getCoalescedEvents() for tablets and high-DPI mice
    let eventPoints = [pt];
    if (BRUSH_CONFIG.ENABLE_HIGH_FREQ_EVENTS && e && typeof e.getCoalescedEvents === 'function') {
      try {
        const coalesced = e.getCoalescedEvents();
        if (coalesced && coalesced.length > 0) {
          const rect = this.wrapper.getBoundingClientRect();
          eventPoints = coalesced.map(ev => ({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
          }));
        }
      } catch (err) {}
    }

    const minDistance = BRUSH_CONFIG.MIN_SAMPLE_DISTANCE_PX || 2;
    let didAdd = false;

    for (let i = 0; i < eventPoints.length; i++) {
      const p = eventPoints[i];
      const dist = Math.hypot(p.x - state.lastSampledPoint.x, p.y - state.lastSampledPoint.y);

      if (dist >= minDistance) {
        state.rawScreenPoints.push(p);
        state.lastSampledPoint = p;

        const chartX = this.manager.primitive.screenXToChart(p.x);
        const priceY = this.manager.primitive.screenYToPrice(p.y);
        if (priceY !== null && chartX.logical !== null) {
          state.previewDrawing.points.push({
            logical: chartX.logical,
            price: priceY,
            time: chartX.time || null,
          });
          didAdd = true;
        }
      }
    }

    if (didAdd) {
      state.previewDrawing.invalidateCache();
      this.manager.requestRender();
    }
  }

  _finishBrushCreation(pt, e) {
    const state = this.creationState;
    if (!state) return;

    // Clean up temporary live preview drawing
    if (state.previewDrawing) {
      this.manager.removeDrawing(state.previewDrawing.id, false);
    }

    // A stroke with fewer than 2 points (a simple click) is discarded
    if (!state.rawScreenPoints || state.rawScreenPoints.length < 2) {
      this.cancelCreation();
      return;
    }

    // Finish-time cleanup: simplify point list (Ramer-Douglas-Peucker in pixel space)
    const simplifiedScreenPts = BrushDrawing.simplifyPoints(
      state.rawScreenPoints,
      BRUSH_CONFIG.RDP_TOLERANCE_PX || 0.8
    );

    if (!simplifiedScreenPts || simplifiedScreenPts.length < 2) {
      this.cancelCreation();
      return;
    }

    // Convert simplified pixel points back into chart coordinates
    const finalPoints = [];
    for (let i = 0; i < simplifiedScreenPts.length; i++) {
      const sp = simplifiedScreenPts[i];
      const chartX = this.manager.primitive.screenXToChart(sp.x);
      const priceY = this.manager.primitive.screenYToPrice(sp.y);

      if (priceY !== null && chartX.logical !== null) {
        finalPoints.push({
          logical: chartX.logical,
          price: priceY,
          time: chartX.time || null,
        });
      }
    }

    if (finalPoints.length < 2) {
      this.cancelCreation();
      return;
    }

    const finalBrush = new BrushDrawing({
      points: finalPoints,
      line: { ...BRUSH_DEFAULTS.LINE },
      background: { ...BRUSH_DEFAULTS.BACKGROUND },
      visibility: { ...BRUSH_DEFAULTS.VISIBILITY },
      locked: false,
    });

    finalBrush.normalize();

    // Record creation in history stack (1 stroke = 1 history entry)
    this.manager.history.record({ type: 'add', drawing: finalBrush.toJSON() });
    this.manager.save();

    this.manager.addDrawing(finalBrush, false);
    this.manager.selectDrawing(finalBrush);

    this.creationState = null;
    this._suppressChartPan(false);
    this._notifyAction(null);

    // After finishing, return to select cursor unless "stay in drawing mode" is enabled
    if (BRUSH_CONFIG.STAY_IN_DRAWING_MODE) {
      this.setTool('brush');
    } else {
      this.setTool(null);
    }

    this.manager.requestRender();
  }

  // --- Price Range Creation State Machine (Click-Click & Press-Drag-Release) ---
  _handlePriceRangeMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    if (!this.creationState) {
      // Step 1: Click 1 -> First Price Point Placed
      const newPR = new PriceRangeDrawing({
        points: [
          { time: chartX.time, logical: chartX.logical, price: priceY },
          { time: chartX.time, logical: chartX.logical, price: priceY },
        ],
      });
      newPR.isSelected = true;
      this.manager.addDrawing(newPR, false);

      this.creationState = {
        tool: 'priceRange',
        startX: pt.x,
        startY: pt.y,
        startLogical: chartX.logical,
        startPrice: priceY,
        startTime: chartX.time,
        previewDrawing: newPR,
        isDragging: true,
      };
      this._suppressChartPan(true);
      this._notifyAction('📏 <b>PRICE RANGE:</b> Move mouse to 2nd price and click (or drag) • Esc to cancel');
    } else {
      // Step 2: Second Click in Click-Move-Click Mode -> Finish
      this._finishPriceRangeCreation(pt);
    }
  }

  _updatePriceRangePreview(pt) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const pr = this.creationState.previewDrawing;

    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    pr.points[1] = {
      logical: chartX.logical,
      time: chartX.time,
      price: priceY,
    };

    this.manager.requestRender();
  }

  _finishPriceRangeCreation(pt) {
    if (!this.creationState) return;
    const pr = this.creationState.previewDrawing;

    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);

    if (priceY !== null) {
      pr.points[1] = {
        logical: chartX.logical,
        time: chartX.time,
        price: priceY,
      };
    }

    // Reject degenerate shapes (both prices equal)
    if (pr.isDegenerate() || Math.abs(pt.y - this.creationState.startY) < 3) {
      this.cancelCreation();
      return;
    }

    pr.normalize();

    // Record creation in history stack
    this.manager.history.record({ type: 'add', drawing: pr.toJSON() });
    this.manager.save();

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this.manager.selectDrawing(pr);
    this._notifyAction(null);
  }

  // --- Position Tools (Long Position & Short Position) State Machine ---
  _handlePositionMouseDown(tool, pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    const symbol = this.manager.currentSymbol || 'EURUSD';
    const symInfo = (typeof this.manager.primitive._coordHelper?.getSymbolInfo === 'function')
      ? this.manager.primitive._coordHelper.getSymbolInfo(symbol)
      : getSymbolInfo(symbol);

    let pipSize = symInfo?.pipSize || symInfo?.minTick || null;
    if (!pipSize || pipSize <= 0) {
      pipSize = priceY < 2 ? 0.0001 : (priceY < 500 ? 0.01 : 1.0);
    }

    const riskPips = POSITION_CONFIG.DEFAULT_RISK_PIPS || 25;
    const rrRatio = POSITION_CONFIG.DEFAULT_RR_RATIO || 2.0;
    const barWidth = POSITION_CONFIG.DEFAULT_BAR_WIDTH || 24;

    const entryPrice = priceY;
    let stopPrice, targetPrice;

    if (tool === 'longPosition') {
      stopPrice = entryPrice - riskPips * pipSize;
      targetPrice = entryPrice + (riskPips * rrRatio) * pipSize;
    } else {
      stopPrice = entryPrice + riskPips * pipSize;
      targetPrice = entryPrice - (riskPips * rrRatio) * pipSize;
    }

    const startLogical = chartX.logical;
    const endLogical = startLogical + barWidth;

    const opts = {
      points: [
        { time: chartX.time, logical: startLogical, price: entryPrice },
        { time: null, logical: endLogical, price: targetPrice },
        { time: chartX.time, logical: startLogical, price: stopPrice },
      ],
    };

    const drawing = tool === 'longPosition'
      ? new LongPositionDrawing(opts)
      : new ShortPositionDrawing(opts);

    drawing.isSelected = true;
    this.manager.addDrawing(drawing, false);

    this.creationState = {
      tool,
      startX: pt.x,
      startY: pt.y,
      startLogical,
      startPrice: entryPrice,
      startTime: chartX.time,
      pipSize,
      previewDrawing: drawing,
      isDragging: true,
    };

    this._suppressChartPan(true);
  }

  _updatePositionPreview(pt) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const drawing = this.creationState.previewDrawing;

    const dist = Math.hypot(pt.x - this.creationState.startX, pt.y - this.creationState.startY);
    if (dist < 5) return; // Keeping default 2:1 drop until user drags significantly

    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    // Update time span
    const barSpan = Math.max(4, Math.abs(chartX.logical - this.creationState.startLogical));
    drawing.endLogical = this.creationState.startLogical + barSpan;
    drawing.endTime = chartX.time || null;

    const startPrice = this.creationState.startPrice;
    const tool = this.creationState.tool;

    if (tool === 'longPosition') {
      if (priceY > startPrice) {
        drawing.targetPrice = priceY;
        const reward = priceY - startPrice;
        drawing.stopPrice = startPrice - (reward / 2);
      } else {
        drawing.stopPrice = priceY;
        const risk = startPrice - priceY;
        drawing.targetPrice = startPrice + (risk * 2);
      }
    } else {
      if (priceY < startPrice) {
        drawing.targetPrice = priceY;
        const reward = startPrice - priceY;
        drawing.stopPrice = startPrice + (reward / 2);
      } else {
        drawing.stopPrice = priceY;
        const risk = priceY - startPrice;
        drawing.targetPrice = startPrice - (risk * 2);
      }
    }

    this.manager.requestRender();
  }

  _finishPositionCreation(pt) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const drawing = this.creationState.previewDrawing;

    drawing.normalize();

    this.manager.history.record({ type: 'add', drawing: drawing.toJSON() });
    this.manager.save();

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this.manager.selectDrawing(drawing);
    this._notifyAction(null);
    this.manager.requestRender();
  }

  // --- Rotated Rectangle 3-Click State Machine ---
  _handleRotatedRectMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    if (!this.creationState) {
      // Step 1: Click 1 -> First Corner Set (p1 / Corner A)
      const newRect = new RotatedRectangleDrawing({
        points: [
          { time: chartX.time, logical: chartX.logical, price: priceY },
          { time: chartX.time, logical: chartX.logical, price: priceY },
          { time: chartX.time, logical: chartX.logical, price: priceY },
        ],
      });
      newRect.isSelected = true;
      this.manager.addDrawing(newRect, false);

      this.creationState = {
        tool: 'rotatedRectangle',
        step: 1,
        p1Screen: { x: pt.x, y: pt.y },
        previewDrawing: newRect,
        isDragging: true,
      };
      this._suppressChartPan(true);
      this._notifyAction('📐 <b>ROTATED RECTANGLE:</b> Click 2nd point to set length & angle • Hold Shift for 45° • Esc to cancel');
    } else if (this.creationState.step === 1) {
      // Step 2: Click 2 -> Second Corner Set (p2 / Corner B)
      let targetX = pt.x;
      let targetY = pt.y;

      if (e.shiftKey) {
        const dx = targetX - this.creationState.p1Screen.x;
        const dy = targetY - this.creationState.p1Screen.y;
        const dist = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx);
        const stepRad = (Math.PI / 180) * (INTERACTION_CONSTANTS.ROTATED_RECT_SNAP_ANGLE_DEG || 45);
        angle = Math.round(angle / stepRad) * stepRad;
        targetX = this.creationState.p1Screen.x + dist * Math.cos(angle);
        targetY = this.creationState.p1Screen.y + dist * Math.sin(angle);
      }

      const dist = Math.hypot(targetX - this.creationState.p1Screen.x, targetY - this.creationState.p1Screen.y);
      if (dist < INTERACTION_CONSTANTS.MIN_DRAG_DISTANCE) {
        // Reject degenerate zero-length edge
        return;
      }

      const p2Chart = this.manager.primitive.screenXToChart(targetX);
      const p2Price = this.manager.primitive.screenYToPrice(targetY);
      if (p2Price === null) return;

      this.creationState.previewDrawing.points[1] = {
        logical: p2Chart.logical,
        time: p2Chart.time,
        price: p2Price,
      };
      this.creationState.previewDrawing.points[2] = {
        logical: p2Chart.logical,
        time: p2Chart.time,
        price: p2Price,
      };

      this.creationState.step = 2;
      this.creationState.p2Screen = { x: targetX, y: targetY };
      this.creationState.isDragging = false;
      this.manager.requestRender();
      this._notifyAction('📐 <b>ROTATED RECTANGLE:</b> Move mouse to set width, click 3rd point to finish • Esc to cancel');
    } else if (this.creationState.step === 2) {
      // Step 3: Click 3 -> Finish Rotated Rectangle
      this._finishRotatedRectCreation(pt);
    }
  }

  _updateRotatedRectPreview(pt, isShiftConstrained) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const rect = this.creationState.previewDrawing;

    if (this.creationState.step === 1) {
      let targetX = pt.x;
      let targetY = pt.y;

      if (isShiftConstrained) {
        const dx = targetX - this.creationState.p1Screen.x;
        const dy = targetY - this.creationState.p1Screen.y;
        const dist = Math.hypot(dx, dy);
        let angle = Math.atan2(dy, dx);
        const stepRad = (Math.PI / 180) * (INTERACTION_CONSTANTS.ROTATED_RECT_SNAP_ANGLE_DEG || 45);
        angle = Math.round(angle / stepRad) * stepRad;
        targetX = this.creationState.p1Screen.x + dist * Math.cos(angle);
        targetY = this.creationState.p1Screen.y + dist * Math.sin(angle);
      }

      const chartX = this.manager.primitive.screenXToChart(targetX);
      const priceY = this.manager.primitive.screenYToPrice(targetY);
      if (priceY === null) return;

      rect.points[1] = {
        logical: chartX.logical,
        time: chartX.time,
        price: priceY,
      };
      rect.points[2] = {
        logical: chartX.logical,
        time: chartX.time,
        price: priceY,
      };
      this.manager.requestRender();
    } else if (this.creationState.step === 2) {
      const chartX = this.manager.primitive.screenXToChart(pt.x);
      const priceY = this.manager.primitive.screenYToPrice(pt.y);
      if (priceY === null) return;

      rect.points[2] = {
        logical: chartX.logical,
        time: chartX.time,
        price: priceY,
      };
      this.manager.requestRender();
    }
  }

  _finishRotatedRectCreation(pt) {
    if (!this.creationState) return;
    const rect = this.creationState.previewDrawing;

    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    rect.points[2] = {
      logical: chartX.logical,
      time: chartX.time,
      price: priceY,
    };

    const geom = rect.getCorners(this.manager.primitive._coordHelper);
    if (!geom || geom.isDegenerate || geom.absWidth < INTERACTION_CONSTANTS.MIN_RECT_SIZE) {
      // Reject zero width degenerate shape
      this.cancelCreation();
      return;
    }

    rect.normalize();
    this.manager.history.record({ type: 'add', drawing: rect.toJSON() });
    this.manager.save();

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this.manager.selectDrawing(rect);
    this._notifyAction(null);
  }

  _preserveRotatedRectWidth(drawing, targetWidth, helper) {
    if (!targetWidth || Math.abs(targetWidth) < 1e-4) return;
    const xA = helper.pointToScreenX(drawing.points[0]);
    const yA = helper.priceToScreenY(drawing.points[0].price);
    const xB = helper.pointToScreenX(drawing.points[1]);
    const yB = helper.priceToScreenY(drawing.points[1].price);
    if (xA === null || yA === null || xB === null || yB === null) return;

    const dx = xB - xA;
    const dy = yB - yA;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return;

    const nx = -dy / len;
    const ny = dx / len;

    const p3ScreenX = xA + nx * targetWidth;
    const p3ScreenY = yA + ny * targetWidth;

    const c3 = this.manager.primitive.screenXToChart(p3ScreenX);
    const pr3 = this.manager.primitive.screenYToPrice(p3ScreenY);
    if (pr3 !== null) {
      drawing.points[2].logical = c3.logical;
      if (c3.time) drawing.points[2].time = c3.time;
      drawing.points[2].price = pr3;
    }
  }

  // --- Ellipse Creation State Machine (Data-Driven Steps) ---
  _handleEllipseMouseDown(pt, e) {
    const chartX = this.manager.primitive.screenXToChart(pt.x);
    const priceY = this.manager.primitive.screenYToPrice(pt.y);
    if (priceY === null) return;

    if (!this.creationState) {
      // Step 1: Set Corner 1 of the bounding box
      const newEllipse = new EllipseDrawing({
        points: [
          { time: chartX.time, logical: chartX.logical, price: priceY },
          { time: chartX.time, logical: chartX.logical, price: priceY },
        ],
      });
      newEllipse.isSelected = true;
      this.manager.addDrawing(newEllipse, false);

      this.creationState = {
        tool: 'ellipse',
        step: 1,
        startX: pt.x,
        startY: pt.y,
        startLogical: chartX.logical,
        startPrice: priceY,
        startTime: chartX.time,
        previewDrawing: newEllipse,
        isDragging: true,
      };
      this._suppressChartPan(true);
      this._notifyAction('⬭ <b>ELLIPSE:</b> Click opposite corner (or drag) • Hold Shift for circle • Esc to cancel');
    } else {
      // Step 2: Second click in click-move-click mode -> Finish
      this._finishEllipseCreation(pt, e.shiftKey);
    }
  }

  _updateEllipseCreationPreview(pt, isCircleConstrained) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const ellipse = this.creationState.previewDrawing;

    let targetX = pt.x;
    let targetY = pt.y;

    // Shift Key: Constrain to perfect circle (1:1 pixel square bounding box)
    if (isCircleConstrained) {
      const dx = targetX - this.creationState.startX;
      const dy = targetY - this.creationState.startY;
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      targetX = this.creationState.startX + (dx >= 0 ? 1 : -1) * side;
      targetY = this.creationState.startY + (dy >= 0 ? 1 : -1) * side;
    }

    const chartX = this.manager.primitive.screenXToChart(targetX);
    const priceY = this.manager.primitive.screenYToPrice(targetY);
    if (priceY === null) return;

    ellipse.points[1] = {
      logical: chartX.logical,
      time: chartX.time,
      price: priceY,
    };

    this.manager.requestRender();
  }

  _finishEllipseCreation(pt, isCircleConstrained) {
    if (!this.creationState) return;
    const ellipse = this.creationState.previewDrawing;

    let targetX = pt.x;
    let targetY = pt.y;

    if (isCircleConstrained) {
      const dx = targetX - this.creationState.startX;
      const dy = targetY - this.creationState.startY;
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      targetX = this.creationState.startX + (dx >= 0 ? 1 : -1) * side;
      targetY = this.creationState.startY + (dy >= 0 ? 1 : -1) * side;
    }

    const dist = Math.hypot(targetX - this.creationState.startX, targetY - this.creationState.startY);

    // Reject degenerate zero-size shapes
    if (dist < INTERACTION_CONSTANTS.MIN_RECT_SIZE) {
      this.cancelCreation();
      return;
    }

    const chartX = this.manager.primitive.screenXToChart(targetX);
    const priceY = this.manager.primitive.screenYToPrice(targetY);
    if (priceY === null) {
      this.cancelCreation();
      return;
    }

    ellipse.points[1] = {
      logical: chartX.logical,
      time: chartX.time,
      price: priceY,
    };

    ellipse.normalize();

    // Record creation in history stack
    this.manager.history.record({ type: 'add', drawing: ellipse.toJSON() });
    this.manager.save();

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this.manager.selectDrawing(ellipse);
    this._notifyAction(null);
  }

  _updateCreationPreview(pt, isSquareConstrained) {
    if (!this.creationState || !this.creationState.previewDrawing) return;
    const rect = this.creationState.previewDrawing;

    let targetX = pt.x;
    let targetY = pt.y;

    // Shift Key: Constrain to perfect square in pixel space
    if (isSquareConstrained) {
      const dx = targetX - this.creationState.startX;
      const dy = targetY - this.creationState.startY;
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      targetX = this.creationState.startX + Math.sign(dx || 1) * side;
      targetY = this.creationState.startY + Math.sign(dy || 1) * side;
    }

    const chartX = this.manager.primitive.screenXToChart(targetX);
    const priceY = this.manager.primitive.screenYToPrice(targetY);
    if (priceY === null) return;

    rect.points[1] = {
      logical: chartX.logical,
      time: chartX.time,
      price: priceY,
    };

    this.manager.requestRender();
  }

  _finishCreation(pt, isSquareConstrained) {
    if (!this.creationState) return;
    const rect = this.creationState.previewDrawing;

    let targetX = pt.x;
    let targetY = pt.y;

    if (isSquareConstrained) {
      const dx = targetX - this.creationState.startX;
      const dy = targetY - this.creationState.startY;
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      targetX = this.creationState.startX + Math.sign(dx || 1) * side;
      targetY = this.creationState.startY + Math.sign(dy || 1) * side;
    }

    const dist = Math.hypot(targetX - this.creationState.startX, targetY - this.creationState.startY);

    // Reject zero-size rectangles
    if (dist < INTERACTION_CONSTANTS.MIN_RECT_SIZE) {
      this.cancelCreation();
      return;
    }

    const chartX = this.manager.primitive.screenXToChart(targetX);
    const priceY = this.manager.primitive.screenYToPrice(targetY);

    rect.points[1] = {
      logical: chartX.logical,
      time: chartX.time,
      price: priceY,
    };

    rect.normalize();

    // Record creation in history stack
    this.manager.history.record({ type: 'add', drawing: rect.toJSON() });
    this.manager.save();

    this.creationState = null;
    this._suppressChartPan(false);
    this.setTool(null);
    this.manager.selectDrawing(rect);
  }

  _updateDragOperation(pt, isSquareConstrained) {
    const op = this.dragOperation;
    const drawing = op.drawing;
    if (!drawing) return;

    if (op.type === 'body') {
      // Shift all anchors equally
      const curLogical = this.manager.primitive.screenXToChart(pt.x).logical;
      const curPrice = this.manager.primitive.screenYToPrice(pt.y);
      if (curPrice === null) return;

      const deltaLogical = curLogical - op.startLogical;
      const deltaPrice = curPrice - op.startPrice;
      const timeScale = this.manager.primitive?._chart?.timeScale();

      for (let i = 0; i < drawing.points.length; i++) {
        const newL = op.initialPoints[i].logical + deltaLogical;
        drawing.points[i].logical = newL;
        drawing.points[i].price = op.initialPoints[i].price + deltaPrice;

        if (timeScale) {
          const x = timeScale.logicalToCoordinate(newL);
          if (x !== null) {
            const t = timeScale.coordinateToTime(x);
            if (t) drawing.points[i].time = t;
          }
        }
      }

      this.manager.requestRender();
      if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
        this.manager.onSelectionChange(drawing);
      }
      return;
    } else if (op.type === 'brushCornerHandle') {
      const drawing = op.drawing;
      const chartX = this.manager.primitive.screenXToChart(pt.x);
      const priceY = this.manager.primitive.screenYToPrice(pt.y);
      if (priceY === null) return;

      drawing.scaleFromCorner(op.handleId, chartX.logical, priceY, op.origPoints, op.origBounds);
      this.manager.requestRender();
      if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
        this.manager.onSelectionChange(drawing);
      }
      return;
    } else if (op.type === 'pathHandle') {
      const drawing = op.drawing;
      const chartX = this.manager.primitive.screenXToChart(pt.x);
      const priceY = this.manager.primitive.screenYToPrice(pt.y);
      if (priceY === null) return;

      const timeScale = this.manager.primitive?._chart?.timeScale();
      const ptObj = drawing.points[op.handleIndex];
      if (ptObj) {
        ptObj.logical = chartX.logical;
        if (chartX.time) {
          ptObj.time = chartX.time;
        } else if (timeScale) {
          const x = timeScale.logicalToCoordinate(chartX.logical);
          if (x !== null) {
            const t = timeScale.coordinateToTime(x);
            if (t) ptObj.time = t;
          }
        }
        ptObj.price = priceY;
      }

      this.manager.requestRender();
      if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
        this.manager.onSelectionChange(drawing);
      }
      return;
    } else if (op.type === 'handle') {
      // Resize handle drag
      let targetX = pt.x;
      let targetY = pt.y;
      const hid = op.handleId;

      let chartX = this.manager.primitive.screenXToChart(targetX);
      let priceY = this.manager.primitive.screenYToPrice(targetY);
      if (priceY === null) return;

      // Handle drag for Rotated Rectangle
      if (drawing.type === 'rotatedRectangle') {
        const helper = this.manager.primitive._coordHelper;
        if (hid === 'p1') {
          drawing.points[0].logical = chartX.logical;
          if (chartX.time) drawing.points[0].time = chartX.time;
          drawing.points[0].price = priceY;
          this._preserveRotatedRectWidth(drawing, op.initialWidth, helper);
        } else if (hid === 'p2') {
          drawing.points[1].logical = chartX.logical;
          if (chartX.time) drawing.points[1].time = chartX.time;
          drawing.points[1].price = priceY;
          this._preserveRotatedRectWidth(drawing, op.initialWidth, helper);
        } else if (hid === 'width' || hid === 'p3_c' || hid === 'p3_d') {
          drawing.points[2].logical = chartX.logical;
          if (chartX.time) drawing.points[2].time = chartX.time;
          drawing.points[2].price = priceY;
        }

        this.manager.requestRender();
        if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
          this.manager.onSelectionChange(drawing);
        }
        return;
      }

      // Handle drag for 2-Point Line tools (Trendline, Ray, Info line, Extended line, Trend angle)
      const twoPointLineTools = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'];
      if (twoPointLineTools.includes(drawing.type)) {
        drawing.moveHandle(hid, chartX.logical, priceY, chartX.time);
        this.manager.requestRender();
        if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
          this.manager.onSelectionChange(drawing);
        }
        return;
      }

      // Handle drag for Single-Point Line tools (Horizontal line, Vertical line, Crossline)
      const singlePointTools = ['horizontalLine', 'verticalLine', 'crossline'];
      if (singlePointTools.includes(drawing.type)) {
        drawing.moveHandle(hid, chartX.logical, priceY, chartX.time);
        this.manager.requestRender();
        if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
          this.manager.onSelectionChange(drawing);
        }
        return;
      }

      // Handle drag for Horizontal Ray (origin handle)
      if (drawing.type === 'horizontalRay') {
        if (HORIZONTAL_RAY_CONFIG.DRAG_CONSTRAINT !== 'price-only') {
          drawing.point.logical = chartX.logical;
          if (chartX.time) drawing.point.time = chartX.time;
        }
        drawing.point.price = priceY;

        this.manager.requestRender();
        if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
          this.manager.onSelectionChange(drawing);
        }
        return;
      }

      // Handle drag for Range Measurement tools (PriceRange, DateRange, etc.)
      if (typeof drawing.updateHandle === 'function') {
        drawing.updateHandle(hid, chartX.logical, priceY, chartX.time);
        this.manager.requestRender();
        if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
          this.manager.onSelectionChange(drawing);
        }
        return;
      }

      // Constrain to square/circle if Shift is held during corner resize
      if (drawing.type !== 'rotatedRectangle' && isSquareConstrained) {
        const helper = this.manager.primitive._coordHelper;
        const p0x = helper.pointToScreenX(drawing.points[0]);
        const p0y = helper.priceToScreenY(drawing.points[0].price);
        const p1x = helper.pointToScreenX(drawing.points[1]);
        const p1y = helper.priceToScreenY(drawing.points[1].price);
        if (p0x !== null && p0y !== null && p1x !== null && p1y !== null) {
          if (hid === 'br') {
            const dx = targetX - p0x;
            const dy = targetY - p0y;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            targetX = p0x + Math.sign(dx || 1) * side;
            targetY = p0y + Math.sign(dy || 1) * side;
          } else if (hid === 'tl') {
            const dx = targetX - p1x;
            const dy = targetY - p1y;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            targetX = p1x + Math.sign(dx || 1) * side;
            targetY = p1y + Math.sign(dy || 1) * side;
          } else if (hid === 'tr') {
            const dx = targetX - p0x;
            const dy = targetY - p1y;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            targetX = p0x + Math.sign(dx || 1) * side;
            targetY = p1y + Math.sign(dy || 1) * side;
          } else if (hid === 'bl') {
            const dx = targetX - p1x;
            const dy = targetY - p0y;
            const side = Math.max(Math.abs(dx), Math.abs(dy));
            targetX = p1x + Math.sign(dx || 1) * side;
            targetY = p0y + Math.sign(dy || 1) * side;
          }
        }
      }

      chartX = this.manager.primitive.screenXToChart(targetX);
      priceY = this.manager.primitive.screenYToPrice(targetY);
      if (priceY === null) return;

      // Adjust anchors based on which of 8 handles is being dragged (Standard Rectangle & Ellipse)
      switch (hid) {
        case 'tl':
          drawing.points[0].logical = chartX.logical;
          if (chartX.time) drawing.points[0].time = chartX.time;
          drawing.points[0].price = priceY;
          break;
        case 'tm':
          drawing.points[0].price = priceY;
          break;
        case 'tr':
          drawing.points[1].logical = chartX.logical;
          if (chartX.time) drawing.points[1].time = chartX.time;
          drawing.points[0].price = priceY;
          break;
        case 'mr':
          drawing.points[1].logical = chartX.logical;
          if (chartX.time) drawing.points[1].time = chartX.time;
          break;
        case 'br':
          drawing.points[1].logical = chartX.logical;
          if (chartX.time) drawing.points[1].time = chartX.time;
          drawing.points[1].price = priceY;
          break;
        case 'bm':
          drawing.points[1].price = priceY;
          break;
        case 'bl':
          drawing.points[0].logical = chartX.logical;
          if (chartX.time) drawing.points[0].time = chartX.time;
          drawing.points[1].price = priceY;
          break;
        case 'ml':
          drawing.points[0].logical = chartX.logical;
          if (chartX.time) drawing.points[0].time = chartX.time;
          break;
      }

      this.manager.requestRender();
      if (this.manager.onSelectionChange && this.manager.selectedDrawing === drawing) {
        this.manager.onSelectionChange(drawing);
      }
    }
  }

  _handleMouseUp(e) {
    const pt = this._getScreenPoint(e);

    // 1. Tool Creation Mode (Press-Drag-Release support)
    const twoPointLineTools = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'];
    if (this.creationState && twoPointLineTools.includes(this.creationState.tool)) {
      if (this.creationState.isDragging) {
        const dist = Math.hypot(pt.x - this.creationState.startX, pt.y - this.creationState.startY);
        if (dist >= 8) {
          // Dragged and released -> finish line
          this._finishLineCreation(pt, e.shiftKey);
        } else {
          // Clicked without moving -> stay in click-move-click mode
          this.creationState.isDragging = false;
        }
      }
      return;
    }

    if (this.creationState && this.creationState.tool === 'brush') {
      this._finishBrushCreation(pt, e);
      return;
    }

    if (this.creationState && this.creationState.tool === 'path') {
      return;
    }

    if (this.creationState && this.creationState.tool === 'rotatedRectangle') {
      if (this.creationState.step === 1 && this.creationState.isDragging) {
        const dist = Math.hypot(pt.x - this.creationState.p1Screen.x, pt.y - this.creationState.p1Screen.y);
        if (dist >= INTERACTION_CONSTANTS.MIN_DRAG_DISTANCE) {
          // Dragged baseline and released -> Advance to step 2 (setting width)
          this.creationState.step = 2;
          this.creationState.p2Screen = { x: pt.x, y: pt.y };
          this.creationState.isDragging = false;
          this._notifyAction('📐 <b>ROTATED RECTANGLE:</b> Move mouse to set width, click 3rd point to finish • Esc to cancel');
        } else {
          this.creationState.isDragging = false;
        }
      }
      return;
    }

    if (this.creationState && this.creationState.tool === 'horizontalRay') {
      if (this.creationState.placedDrawing) {
        const ray = this.creationState.placedDrawing;
        ray.normalize();
        this.manager.save();
      }
      if (this.creationState.previewDrawing) {
        this.manager.removeDrawing(this.creationState.previewDrawing.id, false);
      }
      this.creationState = null;
      this._suppressChartPan(false);
      this.setTool(null);
      this._notifyAction(null);
      return;
    }

    if (this.creationState && this.creationState.tool === 'ellipse') {
      if (this.creationState.isDragging) {
        const dist = Math.hypot(pt.x - this.creationState.startX, pt.y - this.creationState.startY);
        if (dist >= INTERACTION_CONSTANTS.MIN_DRAG_DISTANCE) {
          // User dragged and released -> Finish shape
          this._finishEllipseCreation(pt, e.shiftKey);
        } else {
          // User clicked without dragging -> Stay in click-move-click mode
          this.creationState.isDragging = false;
        }
      }
      return;
    }

    if (this.creationState && (this.creationState.tool === 'longPosition' || this.creationState.tool === 'shortPosition')) {
      this._finishPositionCreation(pt);
      return;
    }

    if (this.creationState && this.creationState.tool === 'priceRange') {
      if (this.creationState.isDragging) {
        const dist = Math.hypot(pt.x - this.creationState.startX, pt.y - this.creationState.startY);
        if (dist >= (PRICE_RANGE_CONFIG.MIN_DRAG_DISTANCE || 4)) {
          // User dragged and released -> Finish shape
          this._finishPriceRangeCreation(pt);
        } else {
          // User clicked without dragging -> Stay in click-move-click mode
          this.creationState.isDragging = false;
        }
      }
      return;
    }

    if (this.creationState && this.creationState.isDragging) {
      const dist = Math.hypot(pt.x - this.creationState.startX, pt.y - this.creationState.startY);
      if (dist >= INTERACTION_CONSTANTS.MIN_DRAG_DISTANCE) {
        // User dragged and released -> Finish shape
        this._finishCreation(pt, e.shiftKey);
      } else {
        // User clicked without dragging -> Stay in click-move-click mode
        this.creationState.isDragging = false;
      }
      return;
    }

    // 2. Drag Operation Completion
    if (this.dragOperation) {
      const op = this.dragOperation;
      op.drawing.normalize();

      // Ensure timestamps match current normalized logical positions
      const timeScale = this.manager.primitive?._chart?.timeScale();
      if (timeScale) {
        for (const p of op.drawing.points) {
          if (p.logical !== undefined && p.logical !== null) {
            const x = timeScale.logicalToCoordinate(p.logical);
            if (x !== null) {
              const t = timeScale.coordinateToTime(x);
              if (t) p.time = t;
            }
          }
        }
      }

      // Only record history if position or handles actually moved
      if (JSON.stringify(op.origJSON) !== JSON.stringify(op.drawing.toJSON())) {
        this.manager.history.record({
          type: 'modify',
          id: op.drawing.id,
          before: op.origJSON,
          after: op.drawing.toJSON(),
        });
        this.manager.save();
      }

      this.dragOperation = null;
      this._suppressChartPan(false);
      this.manager.requestRender();
      if (this.manager.onSelectionChange && this.manager.selectedDrawing) {
        this.manager.onSelectionChange(this.manager.selectedDrawing);
      }
    }
  }

  _updateHoverCursor(pt) {
    const helper = this.manager.primitive?._coordHelper;
    if (!helper) return;

    const drawings = [...this.manager.getDrawings()].sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1));
    let hitResult = null;

    for (const d of drawings) {
      if (!d.isVisibleOnTimeframe(this.manager.currentTimeframe)) continue;
      const res = d.hitTest(pt.x, pt.y, helper);
      if (res.hit) {
        hitResult = res;
        break;
      }
    }

    let changed = false;
    drawings.forEach(d => {
      const willBeHovered = (hitResult && hitResult.drawing === d);
      if (d.isHovered !== willBeHovered) {
        d.isHovered = willBeHovered;
        changed = true;
      }
      if (d.hoveredHandleIndex !== undefined) {
        const nextHandleIndex = (willBeHovered && d.type === 'path' && hitResult.type === 'handle') ? hitResult.handleIndex : null;
        if (d.hoveredHandleIndex !== nextHandleIndex) {
          d.hoveredHandleIndex = nextHandleIndex;
          changed = true;
        }
      }
    });

    if (hitResult) {
      this.wrapper.style.cursor = hitResult.cursor || 'pointer';
    } else {
      this.wrapper.style.cursor = '';
    }

    if (changed) {
      this.manager.requestRender();
    }
  }

  _handleDblClick(e) {
    const pt = this._getScreenPoint(e);

    // Double-click completes Path creation
    if (this.creationState && this.creationState.tool === 'path') {
      e.preventDefault();
      e.stopPropagation();
      this._finishPathCreation(true);
      return;
    }

    const helper = this.manager.primitive?._coordHelper;
    if (!helper) return;

    for (const d of this.manager.getDrawings()) {
      const res = d.hitTest(pt.x, pt.y, helper);
      if (res.hit) {
        e.preventDefault();
        e.stopPropagation();

        // Adding a point on double-click on a segment of finished path (behind flag)
        if (d.type === 'path' && res.type === 'line' && PATH_CONFIG.ALLOW_ADD_REMOVE_POINTS) {
          const chartPos = this.manager.primitive.screenXToChart(pt.x);
          const pricePos = this.manager.primitive.screenYToPrice(pt.y);
          if (pricePos !== null) {
            const beforeJSON = d.toJSON();
            d.insertPoint(res.segmentIndex, { price: pricePos, logical: chartPos.logical, time: chartPos.time });
            d.selectedHandleIndex = res.segmentIndex + 1;
            this.manager.history.record({ type: 'modify', id: d.id, before: beforeJSON, after: d.toJSON() });
            this.manager.save();
            this.manager.selectDrawing(d);
            this.manager.requestRender();
            return;
          }
        }

        this.manager.selectDrawing(d);
        if (this.onOpenSettings) {
          this.onOpenSettings(d);
        }
        return;
      }
    }
  }

  _handleKeyDown(e) {
    // 1. Esc: Cancel current tool, creation, or deselect
    if (e.key === 'Escape') {
      if (this.inlineEditorEl) {
        this.closeInlineEditor(false);
        return;
      }
      if (this.creationState) {
        if (this.creationState.tool === 'path') {
          // ESC finishes and keeps points placed so far (if >= 2), discard if < 2 (per TradingView docs)
          if (PATH_CONFIG.ESC_KEEPS_POINTS && this.creationState.placedPoints && this.creationState.placedPoints.length >= 2) {
            this._finishPathCreation(false);
            return;
          }
        }
        this.cancelCreation();
        return;
      }
      if (this.activeTool) {
        this.setTool(null);
        return;
      }
      if (this.manager.selectedDrawing) {
        this.manager.deselectDrawing();
        return;
      }
    }

    // 2. Delete / Backspace: Remove selected drawing or last point during Path creation
    if (e.key === 'Backspace' && this.creationState && this.creationState.tool === 'path') {
      if (PATH_CONFIG.BACKSPACE_REMOVES_LAST_POINT) {
        if (this.creationState.placedPoints && this.creationState.placedPoints.length > 1) {
          e.preventDefault();
          this.creationState.placedPoints.pop();
          if (this.creationState.previewDrawing) {
            this.creationState.previewDrawing.points = [...this.creationState.placedPoints];
            this.manager.requestRender();
          }
          this._notifyAction(`〰️ <b>PATH:</b> Last point removed (${this.creationState.placedPoints.length} remaining) • Click to add • Double-click or Esc to finish`);
          return;
        } else if (this.creationState.placedPoints && this.creationState.placedPoints.length === 1) {
          e.preventDefault();
          this.cancelCreation();
          return;
        }
      }
    }

    if ((e.key === 'Delete' || e.key === 'Backspace') && this.manager.selectedDrawing) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      const sel = this.manager.selectedDrawing;
      if (sel.type === 'path' && PATH_CONFIG.ALLOW_ADD_REMOVE_POINTS && sel.selectedHandleIndex !== null && sel.points.length > 2) {
        e.preventDefault();
        const beforeJSON = sel.toJSON();
        sel.removePoint(sel.selectedHandleIndex);
        this.manager.history.record({ type: 'modify', id: sel.id, before: beforeJSON, after: sel.toJSON() });
        this.manager.save();
        this.manager.requestRender();
        if (this.manager.onSelectionChange) this.manager.onSelectionChange(sel);
        return;
      }
      e.preventDefault();
      this.manager.removeDrawing(this.manager.selectedDrawing.id, true);
      return;
    }

    // 3. Undo / Redo
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) {
        this.manager.redo();
      } else {
        this.manager.undo();
      }
      return;
    }
    if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      this.manager.redo();
      return;
    }

    // 4. Shortcut for Rectangle tool: Shift + R
    if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      this.setTool(this.activeTool === 'rectangle' ? null : 'rectangle');
      return;
    }

    // 5. Shortcut for Ellipse tool: Shift + E
    if (e.shiftKey && (e.key === 'E' || e.key === 'e')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      this.setTool(this.activeTool === 'ellipse' ? null : 'ellipse');
      return;
    }

    // 6. Shortcut for Horizontal Ray tool: Alt + J
    if (e.altKey && (e.key === 'J' || e.key === 'j')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
      this.setTool(this.activeTool === 'horizontalRay' ? null : 'horizontalRay');
      return;
    }

    // 8. Shortcuts for Lines Group
    if (e.altKey && (e.key === 'T' || e.key === 't')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      this.setTool(this.activeTool === 'trendline' ? null : 'trendline');
      return;
    }

    if (e.altKey && (e.key === 'R' || e.key === 'r')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      this.setTool(this.activeTool === 'ray' ? null : 'ray');
      return;
    }

    if (e.altKey && (e.key === 'H' || e.key === 'h')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      this.setTool(this.activeTool === 'horizontalLine' ? null : 'horizontalLine');
      return;
    }

    if (e.altKey && (e.key === 'V' || e.key === 'v')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      this.setTool(this.activeTool === 'verticalLine' ? null : 'verticalLine');
      return;
    }

    if (e.altKey && (e.key === 'C' || e.key === 'c')) {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      if (LINES_GROUP_CONFIG.CROSSLINE_INSTANT_PLACE) {
        this.placeCrosslineAtCursor();
      } else {
        this.setTool(this.activeTool === 'crossline' ? null : 'crossline');
      }
      return;
    }
  }

  // --- Inline Text Editor ---
  openInlineEditor(drawing) {
    if (this.inlineEditorEl) this.closeInlineEditor(true);
    const helper = this.manager.primitive?._coordHelper;
    if (!helper) return;

    let bounds = null;
    if (drawing.type === 'horizontalRay') {
      const coords = drawing.getScreenCoordinates(helper);
      if (!coords) return;
      bounds = drawing._textBounds ? {
        left: drawing._textBounds.left,
        right: drawing._textBounds.right,
        top: drawing._textBounds.top,
        bottom: drawing._textBounds.bottom,
        width: Math.max(120, drawing._textBounds.right - drawing._textBounds.left),
        height: Math.max(30, drawing._textBounds.bottom - drawing._textBounds.top),
      } : {
        left: coords.visibleStartX + 20,
        right: coords.visibleStartX + 180,
        top: coords.y - 25,
        bottom: coords.y + 15,
        width: 160,
        height: 40,
      };
    } else {
      bounds = drawing.getScreenBounds(helper);
    }
    if (!bounds) return;

    const editor = document.createElement('textarea');
    editor.className = 'tv-inline-drawing-editor';
    editor.value = drawing.text.content || '';
    editor.placeholder = 'Type text...';

    const midX = (bounds.left + bounds.right) / 2;
    const midY = (bounds.top + bounds.bottom) / 2;

    editor.style.left = `${Math.max(10, midX - 90)}px`;
    editor.style.top = `${Math.max(10, midY - 30)}px`;
    editor.style.width = `${Math.max(120, bounds.width * 0.8)}px`;
    editor.style.height = `${Math.max(48, bounds.height * 0.6)}px`;
    editor.style.fontSize = `${drawing.text.size || 14}px`;
    editor.style.color = drawing.text.color || '#ffffff';

    const commit = (save) => {
      if (save) {
        const before = drawing.toJSON();
        drawing.text.content = editor.value;
        if (drawing.type === 'horizontalRay' && editor.value.trim().length > 0) {
          drawing.text.enabled = true;
        }
        this.manager.history.record({
          type: 'modify',
          id: drawing.id,
          before,
          after: drawing.toJSON(),
        });
        this.manager.save();
        this.manager.requestRender();
      }
      this.closeInlineEditor(false);
    };

    editor.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        commit(true);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        commit(false);
      }
    });

    editor.addEventListener('blur', () => {
      commit(true);
    });

    this.wrapper.appendChild(editor);
    editor.focus();
    editor.select();
    this.inlineEditorEl = editor;
  }

  closeInlineEditor(save) {
    if (this.inlineEditorEl && this.inlineEditorEl.parentNode) {
      this.inlineEditorEl.parentNode.removeChild(this.inlineEditorEl);
    }
    this.inlineEditorEl = null;
  }

  // Touch Handlers
  _handleTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this._handleMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        stopPropagation: () => e.stopPropagation(),
        preventDefault: () => e.preventDefault(),
        shiftKey: false,
      });
    }
  }

  _handleTouchMove(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this._handleMouseMove({
        clientX: touch.clientX,
        clientY: touch.clientY,
        shiftKey: false,
      });
    }
  }

  _handleTouchEnd(e) {
    this._handleMouseUp({
      shiftKey: false,
    });
  }
}
