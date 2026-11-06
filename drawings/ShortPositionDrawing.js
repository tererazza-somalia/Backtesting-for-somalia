/**
 * ShortPositionDrawing - TradingView Short Position prediction & measurement tool.
 * Evaluates trade setup with Sell / Short orientation:
 * - Entry Price (Middle line)
 * - Take Profit Target Price (Green area below Entry)
 * - Stop Loss Price (Red area above Entry)
 * - Risk/Reward ratio and trade metrics
 */

import { PositionBase } from './PositionBase.js';
import { SHORT_POSITION_DEFAULTS } from './constants.js';

export class ShortPositionDrawing extends PositionBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'shortPosition',
      target: {
        color: options.target?.color || SHORT_POSITION_DEFAULTS.TARGET.color,
        opacity: options.target?.opacity !== undefined ? options.target.opacity : SHORT_POSITION_DEFAULTS.TARGET.opacity,
        borderColor: options.target?.borderColor || SHORT_POSITION_DEFAULTS.TARGET.borderColor,
        borderWidth: options.target?.borderWidth !== undefined ? options.target.borderWidth : SHORT_POSITION_DEFAULTS.TARGET.borderWidth,
      },
      stop: {
        color: options.stop?.color || SHORT_POSITION_DEFAULTS.STOP.color,
        opacity: options.stop?.opacity !== undefined ? options.stop.opacity : SHORT_POSITION_DEFAULTS.STOP.opacity,
        borderColor: options.stop?.borderColor || SHORT_POSITION_DEFAULTS.STOP.borderColor,
        borderWidth: options.stop?.borderWidth !== undefined ? options.stop.borderWidth : SHORT_POSITION_DEFAULTS.STOP.borderWidth,
      },
      entryLine: {
        color: options.entryLine?.color || SHORT_POSITION_DEFAULTS.ENTRY_LINE.color,
        width: options.entryLine?.width !== undefined ? options.entryLine.width : SHORT_POSITION_DEFAULTS.ENTRY_LINE.width,
        style: options.entryLine?.style || SHORT_POSITION_DEFAULTS.ENTRY_LINE.style,
      },
    });
  }

  /**
   * Factory from JSON representation
   */
  static fromJSON(data) {
    return new ShortPositionDrawing(data);
  }
}
