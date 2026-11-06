/**
 * TrendlineDrawing - Standard 2-point trendline tool.
 * Shortcut: Alt + T
 */

import { LineBase } from './LineBase.js';

export class TrendlineDrawing extends LineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'trendline',
      extendLeft: options.extendLeft !== undefined ? Boolean(options.extendLeft) : false,
      extendRight: options.extendRight !== undefined ? Boolean(options.extendRight) : false,
    });
  }

  static fromJSON(data) {
    return new TrendlineDrawing(data);
  }
}
