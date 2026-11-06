/**
 * FloatingToolbar - TradingView-style contextual floating action bar
 * Positioned right above the selected rectangle with quick controls.
 */

import { COLOR_PALETTE } from '../constants.js';

export class FloatingToolbar {
  constructor(chartWrapper, drawingManager, callbacks = {}) {
    this.wrapper = chartWrapper;
    this.manager = drawingManager;
    this.callbacks = callbacks; // { onOpenSettings, onOpenAlert, onEditText }
    this.el = null;

    this._createDOM();
    this.manager.onSelectionChange = (selected) => this.update(selected);
  }

  _createDOM() {
    this.el = document.createElement('div');
    this.el.id = 'tv-rect-toolbar';
    this.el.className = 'tv-floating-drawing-toolbar';
    this.el.style.display = 'none';

    this.el.innerHTML = `
      <div class="tv-fbar-drag-handle" title="Drag toolbar">⋮⋮</div>
      
      <!-- Border Color Picker -->
      <div class="tv-fbar-item" title="Border Color">
        <div class="tv-fbar-color-preview" id="fbar-border-preview"></div>
        <div class="tv-fbar-color-dropdown" id="fbar-border-dropdown"></div>
      </div>

      <!-- Fill Color & Opacity Picker -->
      <div class="tv-fbar-item" title="Background Fill & Opacity">
        <div class="tv-fbar-fill-preview" id="fbar-fill-preview"></div>
        <div class="tv-fbar-fill-dropdown" id="fbar-fill-dropdown">
          <div class="tv-fbar-swatch-grid" id="fbar-fill-swatches"></div>
          <div class="tv-fbar-slider-row">
            <span>Opacity:</span>
            <input type="range" id="fbar-opacity-slider" min="0" max="100" step="5" value="20" />
            <span id="fbar-opacity-val">20%</span>
          </div>
        </div>
      </div>

      <div class="tv-fbar-sep"></div>

      <!-- Border Width Toggle -->
      <button class="tv-fbar-btn" id="fbar-width-btn" title="Border Thickness (1px - 4px)">2px</button>

      <!-- Border Style Toggle -->
      <button class="tv-fbar-btn" id="fbar-style-btn" title="Border Style (Solid / Dashed / Dotted)">━</button>

      <!-- Arrow at Start Toggle (Path) -->
      <button class="tv-fbar-btn" id="fbar-arrow-start-btn" title="Toggle Arrow at Start" style="display: none;">← Start</button>

      <!-- Arrow at End Toggle (Path) -->
      <button class="tv-fbar-btn" id="fbar-arrow-end-btn" title="Toggle Arrow at End" style="display: none;">End →</button>

      <!-- Middle Line Toggle -->
      <button class="tv-fbar-btn" id="fbar-midline-btn" title="Toggle Middle Line">╍ Mid</button>

      <!-- Extend Left & Right Toggles -->
      <button class="tv-fbar-btn" id="fbar-ext-left-btn" title="Extend Left (to chart edge)">↤ Ext L</button>
      <button class="tv-fbar-btn" id="fbar-ext-right-btn" title="Extend Right (to chart edge)">Ext R ↦</button>

      <!-- Text Edit -->
      <button class="tv-fbar-btn" id="fbar-text-btn" title="Edit Text">Aa</button>

      <div class="tv-fbar-sep"></div>

      <!-- Lock / Unlock -->
      <button class="tv-fbar-btn" id="fbar-lock-btn" title="Lock / Unlock Drawing">🔓</button>

      <!-- Clone -->
      <button class="tv-fbar-btn" id="fbar-clone-btn" title="Duplicate Drawing (Clone)">📋</button>

      <!-- Alert -->
      <button class="tv-fbar-btn" id="fbar-alert-btn" title="Create Alert (Clock)">⏰</button>

      <!-- Settings (Gear) -->
      <button class="tv-fbar-btn" id="fbar-settings-btn" title="Settings (Gear)">⚙️</button>

      <div class="tv-fbar-sep"></div>

      <!-- Delete -->
      <button class="tv-fbar-btn tv-fbar-danger" id="fbar-delete-btn" title="Delete Drawing (Delete / Backspace)">🗑️</button>
    `;

    this.wrapper.appendChild(this.el);
    this._initColorDropdowns();
    this._bindButtonEvents();
  }

  _initColorDropdowns() {
    // Border / Line Color Swatches
    const borderDropdown = this.el.querySelector('#fbar-border-dropdown');
    COLOR_PALETTE.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'tv-fbar-color-dot';
      dot.style.background = c;
      dot.title = c;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this._updateDrawing((d) => {
          if (d.line) {
            d.line.color = c;
            if (d.border) d.border.color = c;
          } else if (d.border) {
            d.border.color = c;
          }
        });
        borderDropdown.classList.remove('active');
      });
      borderDropdown.appendChild(dot);
    });

    // Fill Color Swatches
    const fillSwatches = this.el.querySelector('#fbar-fill-swatches');
    COLOR_PALETTE.forEach(c => {
      const dot = document.createElement('div');
      dot.className = 'tv-fbar-color-dot';
      dot.style.background = c;
      dot.title = c;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this._updateDrawing((d) => { d.background.color = c; });
      });
      fillSwatches.appendChild(dot);
    });

    // Fill Opacity Slider
    const opacitySlider = this.el.querySelector('#fbar-opacity-slider');
    const opacityVal = this.el.querySelector('#fbar-opacity-val');
    opacitySlider.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value);
      opacityVal.textContent = `${pct}%`;
      this._updateDrawing((d) => {
        d.background.opacity = pct / 100;
        d.background.visible = pct > 0;
      });
    });
  }

  _bindButtonEvents() {
    // Border Dropdown Toggle
    const borderBtn = this.el.querySelector('#fbar-border-preview');
    const borderDropdown = this.el.querySelector('#fbar-border-dropdown');
    borderBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      borderDropdown.classList.toggle('active');
      this.el.querySelector('#fbar-fill-dropdown').classList.remove('active');
    });

    // Fill Dropdown Toggle
    const fillBtn = this.el.querySelector('#fbar-fill-preview');
    const fillDropdown = this.el.querySelector('#fbar-fill-dropdown');
    fillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fillDropdown.classList.toggle('active');
      borderDropdown.classList.remove('active');
    });

    // Close dropdowns on outside click
    document.addEventListener('click', () => {
      if (borderDropdown) borderDropdown.classList.remove('active');
      if (fillDropdown) fillDropdown.classList.remove('active');
    });

    // Border / Line Width
    const widthBtn = this.el.querySelector('#fbar-width-btn');
    widthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._updateDrawing((d) => {
        if (d.line) {
          const cur = d.line.width || 2;
          d.line.width = cur >= 4 ? 1 : cur + 1;
          if (d.border) d.border.width = d.line.width;
        } else if (d.border) {
          const cur = d.border.width || 2;
          d.border.width = cur >= 4 ? 1 : cur + 1;
        }
      });
    });

    // Border / Line Style
    const styleBtn = this.el.querySelector('#fbar-style-btn');
    styleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._updateDrawing((d) => {
        if (d.line) {
          const cur = d.line.style || 'solid';
          d.line.style = cur === 'solid' ? 'dashed' : (cur === 'dashed' ? 'dotted' : 'solid');
          if (d.border) d.border.style = d.line.style;
        } else if (d.border) {
          const cur = d.border.style || 'solid';
          d.border.style = cur === 'solid' ? 'dashed' : (cur === 'dashed' ? 'dotted' : 'solid');
        }
      });
    });

    // Arrow at Start Toggle (Path or LineBase)
    const arrowStartBtn = this.el.querySelector('#fbar-arrow-start-btn');
    if (arrowStartBtn) {
      arrowStartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._updateDrawing((d) => {
          if (d.type === 'path') {
            if (!d.arrows) d.arrows = { start: false, end: true };
            d.arrows.start = !d.arrows.start;
          } else {
            if (!d.arrows) d.arrows = { left: false, right: false };
            d.arrows.left = !d.arrows.left;
          }
        });
      });
    }

    // Arrow at End Toggle (Path or LineBase)
    const arrowEndBtn = this.el.querySelector('#fbar-arrow-end-btn');
    if (arrowEndBtn) {
      arrowEndBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._updateDrawing((d) => {
          if (d.type === 'path') {
            if (!d.arrows) d.arrows = { start: false, end: true };
            d.arrows.end = !d.arrows.end;
          } else {
            if (!d.arrows) d.arrows = { left: false, right: false };
            d.arrows.right = !d.arrows.right;
          }
        });
      });
    }

    // Middle Line / Middle Point Toggle
    const midBtn = this.el.querySelector('#fbar-midline-btn');
    midBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._updateDrawing((d) => {
        if (d.middlePoint !== undefined) {
          d.middlePoint = !d.middlePoint;
        } else if (d.middleLine) {
          d.middleLine.enabled = !d.middleLine.enabled;
        }
      });
    });

    // Extend Left Toggle
    const extLeftBtn = this.el.querySelector('#fbar-ext-left-btn');
    extLeftBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._updateDrawing((d) => {
        d.extendLeft = !d.extendLeft;
      });
    });

    // Extend Right / Extend Horizontally Toggle
    const extRightBtn = this.el.querySelector('#fbar-ext-right-btn');
    extRightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._updateDrawing((d) => {
        if (d.type === 'priceRange') {
          d.extendHorizontally = !d.extendHorizontally;
        } else {
          d.extendRight = !d.extendRight;
        }
      });
    });

    // Text Edit Button
    const textBtn = this.el.querySelector('#fbar-text-btn');
    textBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.callbacks.onEditText && this.manager.selectedDrawing) {
        this.callbacks.onEditText(this.manager.selectedDrawing);
      }
    });

    // Lock Button
    const lockBtn = this.el.querySelector('#fbar-lock-btn');
    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.manager.selectedDrawing) {
        this.manager.lockDrawing(this.manager.selectedDrawing);
      }
    });

    // Clone Button
    const cloneBtn = this.el.querySelector('#fbar-clone-btn');
    cloneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.manager.selectedDrawing) {
        this.manager.cloneDrawing(this.manager.selectedDrawing);
      }
    });

    // Alert Button
    const alertBtn = this.el.querySelector('#fbar-alert-btn');
    alertBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.callbacks.onOpenAlert && this.manager.selectedDrawing) {
        this.callbacks.onOpenAlert(this.manager.selectedDrawing);
      }
    });

    // Settings Button
    const settingsBtn = this.el.querySelector('#fbar-settings-btn');
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.callbacks.onOpenSettings && this.manager.selectedDrawing) {
        this.callbacks.onOpenSettings(this.manager.selectedDrawing);
      }
    });

    // Delete Button
    const deleteBtn = this.el.querySelector('#fbar-delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.manager.selectedDrawing) {
        this.manager.removeDrawing(this.manager.selectedDrawing.id, true);
      }
    });
  }

  _updateDrawing(mutationFn) {
    const drawing = this.manager.selectedDrawing;
    if (!drawing) return;

    const before = drawing.toJSON();
    mutationFn(drawing);
    this.manager.history.record({
      type: 'modify',
      id: drawing.id,
      before,
      after: drawing.toJSON(),
    });
    this.manager.save();
    this.manager.requestRender();
    this.updateUI(drawing);
  }

  update(selectedDrawing) {
    if (!selectedDrawing) {
      this.el.style.display = 'none';
      return;
    }

    this.updatePosition(selectedDrawing);
    this.updateUI(selectedDrawing);
    this.el.style.display = 'flex';
  }

  updatePosition(drawing) {
    const helper = this.manager.primitive?._coordHelper;
    if (!helper) return;

    if (drawing.type === 'horizontalRay') {
      const coords = drawing.getScreenCoordinates(helper);
      if (!coords || coords.isFullyOffScreen) {
        this.el.style.display = 'none';
        return;
      }
      const tbW = this.el.offsetWidth || 340;
      const tbH = this.el.offsetHeight || 38;
      const midX = Math.min(coords.endX - tbW / 2 - 10, Math.max(tbW / 2 + 10, coords.visibleStartX + 120));
      let top = coords.y - tbH - 12;
      if (top < 10) {
        top = coords.y + 14;
      }
      const left = Math.max(10, Math.min(this.wrapper.clientWidth - tbW - 10, midX - tbW / 2));
      this.el.style.left = `${left}px`;
      this.el.style.top = `${top}px`;
      return;
    }

    const bounds = drawing.getScreenBounds(helper);
    if (!bounds) {
      this.el.style.display = 'none';
      return;
    }

    const tbW = this.el.offsetWidth || 400;
    const tbH = this.el.offsetHeight || 38;

    // Anchor toolbar above the drawing
    let midX;
    if (drawing.type === 'rotatedRectangle' || drawing.type === 'ellipse' || drawing.type === 'path' || drawing.type === 'brush') {
      midX = (bounds.left + bounds.right) / 2;
    } else {
      const anchorLeft = bounds.rawX1 !== undefined ? Math.min(bounds.rawX1, bounds.rawX2) : bounds.left;
      const anchorRight = bounds.rawX2 !== undefined ? Math.max(bounds.rawX1, bounds.rawX2) : bounds.right;
      midX = (anchorLeft + anchorRight) / 2;
    }

    let top = bounds.top - tbH - 12;
    if (drawing.type === 'longPosition' || drawing.type === 'shortPosition') {
      top = bounds.top - tbH - 36;
    }

    // Boundary check: If drawing is near top of chart, place toolbar below it
    if (top < 10) {
      top = bounds.bottom + (drawing.type === 'longPosition' || drawing.type === 'shortPosition' ? 36 : 12);
    }

    const left = Math.max(10, Math.min(this.wrapper.clientWidth - tbW - 10, midX - tbW / 2));

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  updateUI(drawing) {
    const isRotated = drawing.type === 'rotatedRectangle';
    const isEllipse = drawing.type === 'ellipse';
    const isPriceRange = drawing.type === 'priceRange';
    const isPath = drawing.type === 'path';
    const isBrush = drawing.type === 'brush';
    const isPosition = drawing.type === 'longPosition' || drawing.type === 'shortPosition';
    const isTwoPointLine = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'].includes(drawing.type);
    const isSinglePointLine = ['horizontalLine', 'verticalLine', 'crossline', 'horizontalRay'].includes(drawing.type);
    const isLine = isTwoPointLine || isSinglePointLine;

    // Border / Line preview
    const borderPrev = this.el.querySelector('#fbar-border-preview');
    borderPrev.style.borderColor = isPosition
      ? (drawing.target?.color || '#089981')
      : ((isLine || isPriceRange || isPath || isBrush) ? (drawing.line?.color || '#2962ff') : (drawing.border?.color || '#2962ff'));

    // Fill preview
    const fillItem = this.el.querySelector('#fbar-fill-preview')?.closest('.tv-fbar-item');
    if (fillItem) {
      fillItem.style.display = (isLine || isPath) ? 'none' : '';
    }
    const fillPrev = this.el.querySelector('#fbar-fill-preview');
    if (fillPrev && !isLine && !isPath) {
      fillPrev.style.background = isPosition ? (drawing.target?.color || '#089981') : (drawing.background?.color || '#2962ff');
      fillPrev.style.opacity = isPosition ? (drawing.target?.opacity || 0.2) : (drawing.background?.visible ? (drawing.background?.opacity || 0.2) : 0);
    }

    // Opacity slider
    const opSlider = this.el.querySelector('#fbar-opacity-slider');
    const opVal = this.el.querySelector('#fbar-opacity-val');
    if (opSlider && opVal && !isLine && !isPath) {
      const pct = Math.round((isPosition ? (drawing.target?.opacity || 0.2) : (drawing.background?.opacity || 0)) * 100);
      opSlider.value = pct;
      opVal.textContent = `${pct}%`;
    }

    // Border / Line width & style
    const widthBtn = this.el.querySelector('#fbar-width-btn');
    const curWidth = isPosition
      ? (drawing.entryLine?.width || 1)
      : ((isLine || isPriceRange || isPath || isBrush) ? (drawing.line?.width || 2) : (drawing.border?.width || 2));
    widthBtn.textContent = `${curWidth}px`;

    const styleBtn = this.el.querySelector('#fbar-style-btn');
    if (styleBtn) {
      styleBtn.style.display = (isBrush || isPosition) ? 'none' : '';
      const st = (isLine || isPath) ? (drawing.line?.style || 'solid') : (drawing.border?.style || 'solid');
      styleBtn.textContent = st === 'dotted' ? '┈' : (st === 'dashed' ? '┅' : '━');
    }

    // Arrow buttons (Path or Two-Point Lines)
    const arrowStartBtn = this.el.querySelector('#fbar-arrow-start-btn');
    const arrowEndBtn = this.el.querySelector('#fbar-arrow-end-btn');
    if (arrowStartBtn) {
      arrowStartBtn.style.display = (isPath || isTwoPointLine) ? '' : 'none';
      const hasStartArrow = isPath ? Boolean(drawing.arrows?.start) : Boolean(drawing.arrows?.left);
      arrowStartBtn.classList.toggle('active', hasStartArrow);
    }
    if (arrowEndBtn) {
      arrowEndBtn.style.display = (isPath || isTwoPointLine) ? '' : 'none';
      const hasEndArrow = isPath ? Boolean(drawing.arrows?.end) : Boolean(drawing.arrows?.right);
      arrowEndBtn.classList.toggle('active', hasEndArrow);
    }

    // Controls specific to standard rectangle and 2-point lines
    const midBtn = this.el.querySelector('#fbar-midline-btn');
    if (midBtn) {
      midBtn.style.display = (isTwoPointLine || drawing.type === 'rectangle') ? '' : 'none';
      const isMidActive = isTwoPointLine ? Boolean(drawing.middlePoint) : Boolean(drawing.middleLine?.enabled);
      midBtn.classList.toggle('active', isMidActive);
    }

    const extLeftBtn = this.el.querySelector('#fbar-ext-left-btn');
    if (extLeftBtn) {
      extLeftBtn.style.display = (isTwoPointLine || drawing.type === 'rectangle') ? '' : 'none';
      extLeftBtn.classList.toggle('active', Boolean(drawing.extendLeft));
    }

    const extRightBtn = this.el.querySelector('#fbar-ext-right-btn');
    if (extRightBtn) {
      extRightBtn.style.display = (isTwoPointLine || isPriceRange || drawing.type === 'rectangle') ? '' : 'none';
      if (isPriceRange) {
        extRightBtn.textContent = 'Extend ⇥';
        extRightBtn.title = 'Extend Horizontally across chart';
        extRightBtn.classList.toggle('active', Boolean(drawing.extendHorizontally));
      } else {
        extRightBtn.textContent = 'Ext R ↦';
        extRightBtn.title = 'Extend Right (to chart edge)';
        extRightBtn.classList.toggle('active', Boolean(drawing.extendRight));
      }
    }

    const textBtn = this.el.querySelector('#fbar-text-btn');
    if (textBtn) {
      textBtn.style.display = (isRotated || isPath || isBrush || isPosition || drawing.type === 'infoLine') ? 'none' : '';
    }

    const alertBtn = this.el.querySelector('#fbar-alert-btn');
    if (alertBtn) {
      alertBtn.style.display = (isRotated || isEllipse || isPriceRange || isPath || isBrush || isPosition) ? 'none' : '';
    }

    // Lock button
    const lockBtn = this.el.querySelector('#fbar-lock-btn');
    lockBtn.textContent = drawing.locked ? '🔒' : '🔓';
    lockBtn.title = drawing.locked ? 'Drawing is Locked (Click to unlock)' : 'Drawing is Unlocked (Click to lock)';
  }
}
