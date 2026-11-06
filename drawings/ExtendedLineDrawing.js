/**
 * ExtendedLineDrawing - Infinite 2-point line extending across the entire screen in both directions.
 */

import { LineBase } from './LineBase.js';

export class ExtendedLineDrawing extends LineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'extendedLine',
      extendLeft: true,
      extendRight: true,
    });
  }

  static fromJSON(data) {
    return new ExtendedLineDrawing(data);
  }
}
