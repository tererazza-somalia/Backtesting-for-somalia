/**
 * HistoryManager - Robust Undo/Redo stack following Command pattern.
 * Treats one complete drag, edit, or style change as exactly one atomic history entry.
 */

export class HistoryManager {
  constructor(maxHistory = 50) {
    this.maxHistory = maxHistory;
    this.undoStack = [];
    this.redoStack = [];
    this.onStateChange = null;
  }

  record(action) {
    this.undoStack.push(action);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this._notify();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo(drawingManager) {
    if (!this.canUndo()) return false;
    const action = this.undoStack.pop();
    this.redoStack.push(action);

    switch (action.type) {
      case 'add':
        drawingManager.removeDrawing(action.drawing.id, false);
        break;
      case 'delete':
        drawingManager.restoreDrawing(action.drawing, false);
        break;
      case 'modify':
        drawingManager.applyDrawingState(action.id, action.before, false);
        break;
    }

    this._notify();
    return true;
  }

  redo(drawingManager) {
    if (!this.canRedo()) return false;
    const action = this.redoStack.pop();
    this.undoStack.push(action);

    switch (action.type) {
      case 'add':
        drawingManager.restoreDrawing(action.drawing, false);
        break;
      case 'delete':
        drawingManager.removeDrawing(action.drawing.id, false);
        break;
      case 'modify':
        drawingManager.applyDrawingState(action.id, action.after, false);
        break;
    }

    this._notify();
    return true;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notify();
  }

  _notify() {
    if (this.onStateChange) {
      this.onStateChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
      });
    }
  }
}
