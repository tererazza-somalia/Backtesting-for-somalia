/**
 * BaseDrawing - Abstract foundation for all chart drawing tools.
 * Supports rectangles, trend lines, rays, fibonacci retracements, etc.
 * Anchors are ALWAYS stored as chart coordinates ({ time, price, logical }).
 */

export class BaseDrawing {
  constructor(options = {}) {
    this.id = options.id || (options.type || 'drawing') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
    this.type = options.type || 'base';
    this.points = options.points ? options.points.map(pt => ({ ...pt })) : [];
    this.locked = Boolean(options.locked);
    this.zIndex = options.zIndex !== undefined ? options.zIndex : 1;
    this.visibility = options.visibility ? { ...options.visibility } : {
      '1m': true, '5m': true, '15m': true, '1h': true, '4h': true, 'D': true
    };
    this.createdAt = options.createdAt || Date.now();
    this.updatedAt = options.updatedAt || Date.now();
    this.isHovered = false;
    this.isSelected = false;
  }

  /**
   * Check if drawing should be rendered on given timeframe.
   */
  isVisibleOnTimeframe(tf) {
    if (!this.visibility) return true;
    if (this.visibility[tf] === undefined) return true;
    return Boolean(this.visibility[tf]);
  }

  /**
   * Abstract hit test method.
   * Returns: { hit: boolean, type: 'handle'|'body'|'border'|'text', handleIndex?: number, cursor?: string }
   */
  hitTest(x, y, coordHelper) {
    throw new Error('hitTest must be implemented by subclass');
  }

  /**
   * Abstract handle retrieval.
   * Returns array of handles: [{ id, x, y, cursor, pointIndex, type }]
   */
  getHandles(coordHelper) {
    return [];
  }

  /**
   * Move drawing by delta chart coordinates.
   */
  move(deltaLogical, deltaPrice) {
    if (this.locked) return;
    this.points.forEach(pt => {
      if (pt.logical !== undefined && pt.logical !== null) {
        pt.logical += deltaLogical;
      }
      pt.price += deltaPrice;
    });
    this.updatedAt = Date.now();
  }

  /**
   * Normalize anchor points after edit / creation.
   */
  normalize() {}

  /**
   * Clone drawing instance with slight offset
   */
  clone() {
    const json = this.toJSON();
    json.id = (this.type || 'drawing') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
    if (json.points && json.points.length > 0) {
      json.points.forEach(p => {
        if (p.logical !== undefined && p.logical !== null) {
          p.logical += 3;
        }
      });
    }
    if (json.point && json.point.logical !== undefined) {
      json.point.logical += 3;
    }
    if (typeof this.constructor.fromJSON === 'function') {
      return this.constructor.fromJSON(json);
    }
    return new this.constructor(json);
  }

  /**
   * Serialize drawing to clean JSON representation.
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      points: this.points.map(pt => ({ time: pt.time, price: pt.price, logical: pt.logical })),
      locked: this.locked,
      zIndex: this.zIndex,
      visibility: { ...this.visibility },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
