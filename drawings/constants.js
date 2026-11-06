/**
 * Configurable Constants for TradingView-style Drawing Engine
 * All styling, hit-test distances, handles, colors, and behaviors are centralized here.
 */

export const RECTANGLE_DEFAULTS = {
  BORDER: {
    visible: true,
    color: '#2962ff',     // TradingView standard blue
    width: 2,             // 2px stroke
    style: 'solid',       // 'solid' | 'dashed' | 'dotted'
  },
  BACKGROUND: {
    visible: true,
    color: '#2962ff',
    opacity: 0.2,         // Translucent fill allowing candles to remain visible
  },
  MIDDLE_LINE: {
    enabled: false,
    color: '#2962ff',
    opacity: 0.5,
    width: 1,
    style: 'dashed',      // 'solid' | 'dashed' | 'dotted'
  },
  EXTEND_LEFT: false,
  EXTEND_RIGHT: false,
  TEXT: {
    content: '',
    color: '#ffffff',
    size: 14,
    bold: false,
    italic: false,
    hAlign: 'center',     // 'left' | 'center' | 'right'
    vAlign: 'middle',     // 'top' | 'middle' | 'bottom'
    placement: 'inside',  // 'inside' | 'outside'
    padding: 8,
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const ROTATED_RECTANGLE_DEFAULTS = {
  BORDER: {
    color: '#2962ff',     // TradingView standard blue
    width: 2,             // 2px stroke
    style: 'solid',       // 'solid' | 'dashed' | 'dotted'
  },
  BACKGROUND: {
    visible: true,
    color: '#2962ff',
    opacity: 0.2,         // Translucent fill allowing candles to remain visible
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const LINES_GROUP_CONFIG = {
  // Configurable constants for unverified TradingView items
  PLACE_SHORTCUT_AT_CURSOR: false, // Flag: Alt+T, Alt+H, Alt+V, Alt+J activate tool vs place immediately
  CROSSLINE_INSTANT_PLACE: true,   // Alt+C places immediately at cursor position (confirmed)
  DEFAULT_COLOR: '#2962ff',        // TradingView default line color
  DEFAULT_WIDTH: 2,                // TradingView default line thickness
  SNAP_45_INCREMENT: 45,           // Degrees increment when holding Shift
  HIT_TEST_TOLERANCE: 7,           // Distance in px to hit line body
  HANDLE_SIZE: 7,                  // Handle diameter in px
};

export const TRENDLINE_DEFAULTS = {
  LINE: { color: '#2962ff', width: 2, opacity: 1, style: 'solid' },
  EXTEND_LEFT: false,
  EXTEND_RIGHT: false,
  ARROWS: { left: false, right: false },
  MIDDLE_POINT: false,
  PRICE_LABELS: false,
  STATS: { enabled: false, alwaysShow: false, showPriceRange: true, showPercent: true, showPips: true, showBarsRange: true, showDateTime: true, showDistance: false, showAngle: false, position: 'middle' },
  TEXT: { content: '', color: '#2962ff', size: 12, bold: false, italic: false, orientation: 'parallel', vAlign: 'top', hAlign: 'center' },
  VISIBILITY: { '1m': true, '5m': true, '15m': true, '1h': true, '4h': true, 'D': true },
  LOCKED: false,
};

export const RAY_DEFAULTS = {
  ...TRENDLINE_DEFAULTS,
  EXTEND_RIGHT: true,
};

export const INFO_LINE_DEFAULTS = {
  ...TRENDLINE_DEFAULTS,
  STATS: {
    enabled: true,
    alwaysShow: true,
    showPriceRange: true,
    showPercent: true,
    showPips: true,
    showBarsRange: true,
    showDateTime: true,
    showDistance: true,
    showAngle: true,
    position: 'auto',
  },
  TEXT: {
    content: '',
    color: '#2962ff',
    size: 12,
    bold: false,
    italic: false,
    orientation: 'parallel',
    vAlign: 'top',
    hAlign: 'center',
  },
};

export const EXTENDED_LINE_DEFAULTS = {
  ...TRENDLINE_DEFAULTS,
  EXTEND_LEFT: true,
  EXTEND_RIGHT: true,
};

export const TREND_ANGLE_DEFAULTS = {
  ...TRENDLINE_DEFAULTS,
  STATS: { enabled: true, alwaysShow: false, showAngle: true, showPriceRange: false, showPercent: false, showPips: false, showBarsRange: false, showDateTime: false, showDistance: false },
};

export const HORIZONTAL_LINE_DEFAULTS = {
  LINE: { color: '#2962ff', width: 1.5, opacity: 1, style: 'solid' },
  PRICE_LABELS: true,
  TIME_LABELS: false,
  TEXT: { content: '', color: '#2962ff', size: 12, bold: false, italic: false, hAlign: 'left', vAlign: 'bottom' },
  VISIBILITY: { '1m': true, '5m': true, '15m': true, '1h': true, '4h': true, 'D': true },
  LOCKED: false,
};

export const VERTICAL_LINE_DEFAULTS = {
  LINE: { color: '#2962ff', width: 1.5, opacity: 1, style: 'solid' },
  PRICE_LABELS: false,
  TIME_LABELS: true,
  TEXT: { content: '', color: '#2962ff', size: 12, bold: false, italic: false, hAlign: 'left', vAlign: 'bottom' },
  VISIBILITY: { '1m': true, '5m': true, '15m': true, '1h': true, '4h': true, 'D': true },
  LOCKED: false,
};

export const CROSSLINE_DEFAULTS = {
  LINE: { color: '#2962ff', width: 1.5, opacity: 1, style: 'solid' },
  PRICE_LABELS: true,
  TIME_LABELS: true,
  TEXT: { content: '', color: '#2962ff', size: 12, bold: false, italic: false, hAlign: 'left', vAlign: 'bottom' },
  VISIBILITY: { '1m': true, '5m': true, '15m': true, '1h': true, '4h': true, 'D': true },
  LOCKED: false,
};

export const HORIZONTAL_RAY_DEFAULTS = {
  LINE: {
    color: '#2962ff',     // TradingView default blue
    opacity: 1,           // Full opacity line
    width: 2,             // 2px thickness
    style: 'solid',       // 'solid' | 'dashed' | 'dotted'
  },
  PRICE_LABEL: {
    visible: true,        // TradingView shows price-axis badge by default
  },
  TIME_LABEL: {
    visible: false,       // Configurable: TradingView defaults to false for horizontal rays
  },
  TEXT: {
    enabled: false,       // Off by default
    content: '',
    color: '#2962ff',
    opacity: 1,
    size: 14,
    bold: false,
    italic: false,
    hAlign: 'left',       // 'left' | 'center' | 'right' along ray
    vAlign: 'bottom',     // 'top' | 'middle' | 'bottom' relative to line
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const HORIZONTAL_RAY_CONFIG = {
  HANDLE_SIZE: 7,               // Origin handle diameter in px
  HANDLE_HIT_RADIUS: 9,         // Hit radius for the origin handle
  HIT_TEST_DISTANCE: 6,         // Line hover/selection sensitivity in px
  DRAG_CONSTRAINT: 'free',      // 'free' (time + price movement) or 'price-only'
  TIME_AXIS_LABEL_ENABLED: false, // Whether time axis also displays an anchor label
  MAGNET_MODE: 'none',          // 'none' | 'weak' | 'strong'
  CREATION_MODE: 'single-click', // Single click places origin with live preview
};

export const BRUSH_DEFAULTS = {
  LINE: {
    color: '#2962ff',           // TradingView default blue
    width: 2,                   // 2px stroke thickness
    opacity: 1,                 // Full opacity line
    style: 'solid',             // 'solid' (TradingView confirmed solid; keep field for future extension)
  },
  BACKGROUND: {
    visible: false,             // Background fill disabled by default
    color: '#2962ff',           // Default fill color matches line color
    opacity: 0.2,               // 20% translucency allows candles and wicks to stay visible
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const BRUSH_CONFIG = {
  // Configurable constants for items to verify against TradingView
  MIN_SAMPLE_DISTANCE_PX: 2,    // Skip sampling pointermove if closer than 2px to previous point
  RDP_TOLERANCE_PX: 0.8,        // Ramer-Douglas-Peucker tolerance in screen pixels (~0.5 - 1.0 px)
  SMOOTHING_METHOD: 'quadratic-midpoint', // Smoothing method: quadratic Bezier midpoint interpolation
  LINE_CAP: 'round',            // Crisp round line cap
  LINE_JOIN: 'round',           // Crisp round line join
  FILL_CLOSE_STRATEGY: 'straight-line', // Closes stroke from last point back to first point
  HIT_TEST_DISTANCE: 6,         // Screen px tolerance for clicking stroke
  HANDLE_SIZE: 7,               // Diameter of corner handles in px
  HANDLE_HIT_RADIUS: 9,         // Hit radius for corner handles
  ENABLE_CORNER_SCALE: true,    // Corner handles scale stroke relative to opposite corner
  MAGNET_MODE: 'none',          // Magnet snapping mode (off for freehand drawings)
  SHOW_COORDINATES_TAB: false,  // Do not show Coordinates tab unless explicitly requested
  STAY_IN_DRAWING_MODE: false,  // Return to cursor mode after drawing unless true
  ENABLE_HIGH_FREQ_EVENTS: true,// Use e.getCoalescedEvents() when supported by browser/hardware
};

export const PATH_DEFAULTS = {
  LINE: {
    color: '#2962ff',           // TradingView default blue
    width: 2,                   // 2px stroke thickness
    opacity: 1,                 // Full opacity line
    style: 'solid',             // 'solid' | 'dashed' | 'dotted'
  },
  ARROWS: {
    start: false,               // Arrow at beginning of path
    end: true,                  // Arrow at end of path (TradingView default)
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const PATH_CONFIG = {
  DEFAULT_COLOR: '#2962ff',     // TradingView standard blue
  DEFAULT_WIDTH: 2,             // 2px stroke
  DEFAULT_OPACITY: 1,           // Full opacity
  DEFAULT_STYLE: 'solid',       // 'solid' | 'dashed' | 'dotted'
  ARROWHEAD_SIZE_MULTIPLIER: 4.5, // Arrow length = Math.max(12, width * 5)
  ARROWHEAD_ANGLE_RAD: 0.488,   // ~28 degrees half-angle for TradingView arrowhead
  ARROWHEAD_SHAPE: 'standard',  // 'standard' (filled) | 'open' (chevron) | 'stealth'
  BACKSPACE_REMOVES_LAST_POINT: true, // Whether Backspace removes last placed point during creation
  ESC_KEEPS_POINTS: true,       // ESC keeps points placed so far (if >= 2), discard if < 2 (TradingView doc behavior)
  HANDLE_SIZE: 7,               // Diameter of anchor point handles in px
  HANDLE_HIT_RADIUS: 9,         // Hit radius for anchor handles
  HIT_TEST_DISTANCE: 6,         // Pixel tolerance for clicking line segments
  MAGNET_MODE: 'none',          // 'none' | 'weak' | 'strong'
  SHOW_COORDINATES_TAB: true,   // Configurable: dynamic point coordinates list in Settings
  ALLOW_ADD_REMOVE_POINTS: true, // Configurable: dblclick on segment adds point, Delete with handle removes point
  TEXT_ENABLED: false,          // UNVERIFIED TradingView feature
  ALERTS_ENABLED: false,        // UNVERIFIED TradingView feature
  STAY_IN_DRAWING_MODE: false,  // Return to cursor mode after finishing unless true
};

export const ELLIPSE_DEFAULTS = {
  CREATION_CLICKS: 2,           // 2 for bounding box (simplest); data-driven engine supports 3-point flow
  CAN_ROTATE: false,            // Axis-aligned by default; can be enabled if rotated ellipse is desired
  BORDER: {
    visible: true,
    color: '#2962ff',           // TradingView blue
    width: 2,                   // 2px stroke
    style: 'solid',             // 'solid' | 'dashed' | 'dotted'
  },
  BACKGROUND: {
    visible: true,
    color: '#2962ff',
    opacity: 0.2,               // Translucent fill allowing candles to remain visible
  },
  TEXT: {
    content: '',
    color: '#ffffff',
    size: 14,
    bold: false,
    italic: false,
    hAlign: 'center',           // 'left' | 'center' | 'right'
    vAlign: 'middle',           // 'top' | 'middle' | 'bottom'
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  SHOW_COORDINATES_TAB: false,   // Configurable whether Coordinates tab is displayed
  LOCKED: false,
};

export const INTERACTION_CONSTANTS = {
  HANDLE_SIZE: 7,               // Diameter / size of resize handles in pixels
  ROTATED_RECT_SNAP_ANGLE_DEG: 45, // Shift key snaps angle to 45 degree increments
  HANDLE_HIT_RADIUS: 9,         // Hit test radius for corner/edge handles
  BORDER_HIT_DISTANCE: 6,       // Maximum distance to select by clicking border
  MIN_DRAG_DISTANCE: 5,         // Distance to distinguish drag vs click
  MIN_RECT_SIZE: 4,             // Minimum width or height in pixels to reject zero-size shapes
  HOVER_BORDER_COLOR: '#2962ff',
  SELECTED_BORDER_COLOR: '#2962ff',
  HANDLE_COLOR: '#ffffff',
  HANDLE_BORDER_COLOR: '#2962ff',
  AXIS_HIGHLIGHT_COLOR: 'rgba(41, 98, 255, 0.25)',
};

export const MAGNET_MODES = {
  NONE: 'none',
  WEAK: 'weak',     // Snaps within 8px of OHLC
  STRONG: 'strong', // Snaps within 20px of OHLC
};

export const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', 'D'];

export const PRICE_RANGE_DEFAULTS = {
  LINE: {
    color: '#2962ff',     // TradingView standard blue
    width: 2,             // Boundary price level lines thickness
    opacity: 1,           // Full opacity line
  },
  BORDER: {
    visible: true,        // Outer box border
    color: '#2962ff',
    width: 1,
    style: 'solid',       // 'solid' | 'dashed' | 'dotted'
  },
  BACKGROUND: {
    visible: true,
    color: '#2962ff',
    opacity: 0.2,         // Shaded fill allowing candles to remain visible
  },
  EXTEND_HORIZONTALLY: false, // Continue horizontally across entire chart
  STATS: {
    priceRange: true,     // Absolute price change (e.g. +0.0042)
    percentChange: true,  // Percentage change (e.g. +0.39%)
    pips: true,           // Change in pips or ticks (e.g. +42.0)
  },
  LABEL: {
    color: '#ffffff',
    opacity: 1,
    size: 12,
    background: {
      visible: true,
      color: '#1e222d',
      opacity: 0.88,
    },
  },
  TEXT: {
    content: '',
    color: '#ffffff',
    size: 12,
    bold: false,
    italic: false,
  },
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const PRICE_RANGE_CONFIG = {
  // Items to verify in real TradingView (centralized configurable constants)
  DEFAULT_BOX_WIDTH_BARS: 6,       // Width in bars when placed without horizontal drag
  MIN_TIME_WIDTH_BARS: 1,          // Minimum horizontal bar span
  LABEL_PADDING_X: 10,             // Info badge horizontal inner padding (px)
  LABEL_PADDING_Y: 6,              // Info badge vertical inner padding (px)
  LABEL_OFFSET_Y: 8,               // Gap between box boundary and info badge (px)
  LABEL_FLIP_MARGIN: 20,           // Margin from chart edge before label flips inside
  LABEL_CORNER_RADIUS: 4,          // Info badge rounded corners (px)
  HANDLE_SIZE: 7,                  // Resize handles diameter (px)
  HANDLE_HIT_RADIUS: 9,            // Hit-test radius for handles
  BORDER_HIT_DISTANCE: 6,          // Sensitivity to select by clicking boundary/border
  MIN_DRAG_DISTANCE: 4,            // Screen px to distinguish click vs drag
  PIP_ROUNDING_DECIMALS: 1,        // Decimals for pip display (e.g. 42.0)
  FALLBACK_PIP_SIZE: 0.0001,       // Fallback pip size if symbol info is not available
  PRICE_AXIS_LABEL_ENABLED: true,  // Real price-axis badge views while selected
  TIME_AXIS_LABEL_ENABLED: false,  // Optional time-axis label view
};

export const SYMBOL_METADATA = {
  'EURUSD': { precision: 4, minTick: 0.0001, pipSize: 0.0001, type: 'forex' },
  'BTCUSDT': { precision: 2, minTick: 0.01, pipSize: 1.0, type: 'crypto' },
  'ETHUSDT': { precision: 2, minTick: 0.01, pipSize: 0.1, type: 'crypto' },
};

export function getSymbolInfo(symbol) {
  if (!symbol) return null;
  return SYMBOL_METADATA[symbol] || null;
}

export const COLOR_PALETTE = [
  '#2962ff', // TradingView Blue
  '#089981', // Green
  '#f23645', // Red
  '#f7931a', // Orange
  '#ab47bc', // Purple
  '#e91e63', // Pink
  '#00bcd4', // Cyan
  '#787b86', // Slate Grey
  '#ffffff', // White
  '#131722', // Dark Charcoal
];

export const POSITION_CONFIG = {
  DEFAULT_BAR_WIDTH: 24,          // Default width in bars when dropped on chart
  DEFAULT_RISK_PIPS: 25,          // Default stop loss distance in pips
  DEFAULT_RR_RATIO: 2.0,          // Default Risk/Reward ratio (2:1)
  HANDLE_SIZE: 7,                 // Diameter in px
  HANDLE_HIT_RADIUS: 9,           // Hit test radius
  BORDER_HIT_DISTANCE: 6,         // Border hit distance
  PRICE_AXIS_LABEL_ENABLED: true, // Display Target, Entry, Stop badges on price axis while selected
  EXTEND_ALIGNMENT_LINES: false,  // UNVERIFIED: false matches TradingView (clean bounded box with crisp 1px lines). Set true for full-screen guidelines.
};

export const LONG_POSITION_DEFAULTS = {
  TARGET: {
    color: '#089981',             // TradingView Green
    opacity: 0.2,                 // Translucent fill allowing candles to remain visible
    borderColor: '#089981',
    borderWidth: 1,
  },
  STOP: {
    color: '#f23645',             // TradingView Red
    opacity: 0.2,                 // Translucent fill allowing candles to remain visible
    borderColor: '#f23645',
    borderWidth: 1,
  },
  ENTRY_LINE: {
    color: '#787b86',             // Subtle dividing line
    width: 1,
    style: 'solid',
  },
  SHOW_STATS: true,
  COMPACT: false,
  VISIBILITY: {
    '1m': true,
    '5m': true,
    '15m': true,
    '1h': true,
    '4h': true,
    'D': true,
  },
  LOCKED: false,
};

export const SHORT_POSITION_DEFAULTS = {
  ...LONG_POSITION_DEFAULTS,
};
