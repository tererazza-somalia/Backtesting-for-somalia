/**
 * InfoLineDrawing - 2-point line tool that continuously displays measurement statistics.
 * Shows Price Difference, % Change, Pips, Bar Count, and Duration.
 */

import { LineBase } from './LineBase.js';
import { INFO_LINE_DEFAULTS } from './constants.js';

export class InfoLineDrawing extends LineBase {
  constructor(options = {}) {
    const statsConfig = {
      ...INFO_LINE_DEFAULTS.STATS,
      ...(options.stats || {}),
      enabled: true,
      alwaysShow: true,
    };

    super({
      ...options,
      type: 'infoLine',
      stats: statsConfig,
      text: {
        ...(options.text || {}),
        content: '', // Info Line displays stats card instead of redundant rotated text label
      },
    });
  }

  static fromJSON(data) {
    if (data && data.text) {
      data.text.content = '';
    }
    return new InfoLineDrawing(data);
  }
}
