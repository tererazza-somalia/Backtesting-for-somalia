/**
 * RayDrawing - 2-point semi-infinite ray tool extending infinitely to the right.
 * Origin at Anchor 1, direction defined by Anchor 2.
 */

import { LineBase } from './LineBase.js';

export class RayDrawing extends LineBase {
  constructor(options = {}) {
    super({
      ...options,
      type: 'ray',
      extendLeft: false,
      extendRight: true,
    });
  }

  static fromJSON(data) {
    return new RayDrawing(data);
  }
}
