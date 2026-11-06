/**
 * LongPositionDrawing - TradingView Long Position prediction & measurement tool.
 * Evaluates trade setup with Buy / Long orientation:
 * - Entry Price (Middle line)
 * - Take Profit Target Price (Green area above Entry)
 * - Stop Loss Price (Red area below Entry)
 * - Risk/Reward ratio and trade metrics
 */

import { PositionBase } from './PositionBase.js';
import { LONG_POSITION_DEFAULTS } from './constants.js';

export class LongPositionDrawing extends PositionBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'longPosition',
      target: {
        color: options.target?.color || LONG_POSITION_DEFAULTS.TARGET.color,
        opacity: options.target?.opacity !== undefined ? options.target.opacity : LONG_POSITION_DEFAULTS.TARGET.opacity,
        borderColor: options.target?.borderColor || LONG_POSITION_DEFAULTS.TARGET.borderColor,
        borderWidth: options.target?.borderWidth !== undefined ? options.target.borderWidth : LONG_POSITION_DEFAULTS.TARGET.borderWidth,
      },
      stop: {
        color: options.stop?.color || LONG_POSITION_DEFAULTS.STOP.color,
        opacity: options.stop?.opacity !== undefined ? options.stop.opacity : LONG_POSITION_DEFAULTS.STOP.opacity,
        borderColor: options.stop?.borderColor || LONG_POSITION_DEFAULTS.STOP.borderColor,
        borderWidth: options.stop?.borderWidth !== undefined ? options.stop.borderWidth : LONG_POSITION_DEFAULTS.STOP.borderWidth,
      },
      entryLine: {
        color: options.entryLine?.color || LONG_POSITION_DEFAULTS.ENTRY_LINE.color,
        width: options.entryLine?.width !== undefined ? options.entryLine.width : LONG_POSITION_DEFAULTS.ENTRY_LINE.width,
        style: options.entryLine?.style || LONG_POSITION_DEFAULTS.ENTRY_LINE.style,
      },
    });
  }

  /**
   * Factory from JSON representation
   */
  static fromJSON(data) {
    return new LongPositionDrawing(data);
  }
}
