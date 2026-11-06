/**
 * SettingsDialog - 4-Tab Settings Modal with Live Preview and Preset Templates
 * Matches TradingView's official Rectangle settings dialog.
 */

import { TIMEFRAMES, PATH_CONFIG } from '../constants.js';

export class SettingsDialog {
  constructor(drawingManager) {
    this.manager = drawingManager;
    this.currentDrawing = null;
    this.snapshot = null; // Stored state before opening for Cancel / revert
    this.activeTab = 'style';
    this.templates = this._loadTemplates();

    this.overlayEl = null;
    this.modalEl = null;
    this._createDOM();
  }

  _loadTemplates() {
    try {
      const raw = localStorage.getItem('tv_rect_templates');
      return raw ? JSON.parse(raw) : {
        'Supply Zone': {
          border: { visible: true, color: '#f23645', width: 2, style: 'solid' },
          background: { visible: true, color: '#f23645', opacity: 0.15 },
          middleLine: { enabled: true, color: '#f23645', opacity: 0.5, width: 1, style: 'dashed' },
          extendRight: true,
          text: { content: 'Supply Zone', color: '#f23645', size: 12, bold: true, italic: false, hAlign: 'left', vAlign: 'top', placement: 'inside' },
        },
        'Demand Zone': {
          border: { visible: true, color: '#089981', width: 2, style: 'solid' },
          background: { visible: true, color: '#089981', opacity: 0.15 },
          middleLine: { enabled: true, color: '#089981', opacity: 0.5, width: 1, style: 'dashed' },
          extendRight: true,
          text: { content: 'Demand Zone', color: '#089981', size: 12, bold: true, italic: false, hAlign: 'left', vAlign: 'top', placement: 'inside' },
        },
        'Elliott Wave Impulse': {
          line: { color: '#2962ff', width: 2, opacity: 1, style: 'solid' },
          arrows: { start: false, end: true },
        },
        'Price Forecast Path': {
          line: { color: '#f7931a', width: 2, opacity: 0.9, style: 'dashed' },
          arrows: { start: false, end: true },
        },
        'Brush Blue (2px)': {
          line: { color: '#2962ff', width: 2, opacity: 1, style: 'solid' },
          background: { visible: false, color: '#2962ff', opacity: 0.2 },
        },
        'Brush Red Pen': {
          line: { color: '#f23645', width: 2, opacity: 1, style: 'solid' },
          background: { visible: false, color: '#f23645', opacity: 0.2 },
        },
        'Brush Highlight Fill': {
          line: { color: '#f7931a', width: 3, opacity: 0.9, style: 'solid' },
          background: { visible: true, color: '#f7931a', opacity: 0.25 },
        },
        'Consolidation Range': {
          border: { visible: true, color: '#f7931a', width: 1, style: 'dashed' },
          background: { visible: true, color: '#f7931a', opacity: 0.12 },
          middleLine: { enabled: true, color: '#f7931a', opacity: 0.6, width: 1, style: 'dotted' },
          extendRight: false,
          text: { content: 'Range', color: '#f7931a', size: 12, bold: false, italic: true, hAlign: 'center', vAlign: 'middle', placement: 'inside' },
        },
      };
    } catch (e) {
      return {};
    }
  }

  _saveTemplates() {
    try {
      localStorage.setItem('tv_rect_templates', JSON.stringify(this.templates));
    } catch (e) {}
  }

  _createDOM() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'tv-dialog-overlay';
    this.overlayEl.style.display = 'none';

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'tv-dialog-box';
    this.overlayEl.appendChild(this.modalEl);

    document.body.appendChild(this.overlayEl);

    // Close on overlay click
    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) {
        this.cancel();
      }
    });
  }

  open(drawing) {
    if (!drawing) return;
    this.currentDrawing = drawing;
    this.snapshot = JSON.parse(JSON.stringify(drawing.toJSON()));
    this._renderModal();
    this.overlayEl.style.display = 'flex';
  }

  cancel() {
    if (this.currentDrawing && this.snapshot) {
      // Revert drawing to snapshot
      this.manager.applyDrawingState(this.currentDrawing.id, this.snapshot, false);
    }
    this.close();
  }

  close() {
    this.overlayEl.style.display = 'none';
    this.currentDrawing = null;
    this.snapshot = null;
  }

  save() {
    if (this.currentDrawing && this.snapshot) {
      this.manager.history.record({
        type: 'modify',
        id: this.currentDrawing.id,
        before: this.snapshot,
        after: this.currentDrawing.toJSON(),
      });
      this.manager.save();
    }
    this.close();
  }

  _renderModal() {
    const d = this.currentDrawing;
    if (!d) return;

    const isRotated = d.type === 'rotatedRectangle';
    const isEllipse = d.type === 'ellipse';
    const isRay = d.type === 'horizontalRay';
    const isPriceRange = d.type === 'priceRange';
    const isPath = d.type === 'path';
    const isBrush = d.type === 'brush';
    const isTwoPointLine = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'].includes(d.type);
    const isSinglePointLine = ['horizontalLine', 'verticalLine', 'crossline'].includes(d.type);

    if ((isRotated || isPath || isBrush) && this.activeTab === 'text') {
      this.activeTab = 'style';
    }
    if ((isRotated || isBrush) && this.activeTab !== 'style' && this.activeTab !== 'visibility') {
      this.activeTab = 'style';
    }
    if (isEllipse && this.activeTab === 'coordinates') {
      this.activeTab = 'style';
    }
    if (isPath && !PATH_CONFIG.SHOW_COORDINATES_TAB && this.activeTab === 'coordinates') {
      this.activeTab = 'style';
    }

    let titleText = 'Drawing';
    const isPosition = d.type === 'longPosition' || d.type === 'shortPosition';
    if (d.type === 'longPosition') titleText = 'Long Position';
    else if (d.type === 'shortPosition') titleText = 'Short Position';
    else if (d.type === 'trendline') titleText = 'Trendline';
    else if (d.type === 'ray') titleText = 'Ray';
    else if (d.type === 'infoLine') titleText = 'Info line';
    else if (d.type === 'extendedLine') titleText = 'Extended line';
    else if (d.type === 'trendAngle') titleText = 'Trend angle';
    else if (d.type === 'horizontalLine') titleText = 'Horizontal line';
    else if (d.type === 'verticalLine') titleText = 'Vertical line';
    else if (d.type === 'crossline') titleText = 'Crossline';
    else if (isBrush) titleText = 'Brush';
    else if (isPath) titleText = 'Path';
    else if (isPriceRange) titleText = 'Price Range';
    else if (isRay) titleText = 'Horizontal Ray';
    else if (isRotated) titleText = 'Rotated Rectangle';
    else if (isEllipse) titleText = 'Ellipse';
    else if (d.type === 'rectangle') titleText = 'Rectangle';

    if (d.type === 'infoLine' && this.activeTab === 'text') {
      this.activeTab = 'style';
    }

    const hasTextTab = !isRotated && !isPath && !isBrush && !isPosition && d.type !== 'crossline' && d.type !== 'infoLine';
    const hasCoordinatesTab = isTwoPointLine || isSinglePointLine || isRay || isPriceRange || isPosition || d.type === 'rectangle' || (isPath && PATH_CONFIG.SHOW_COORDINATES_TAB);

    this.modalEl.innerHTML = `
      <!-- Modal Header -->
      <div class="tv-dialog-header">
        <span class="tv-dialog-title">${titleText} Settings</span>
        <button class="tv-dialog-close" id="dlg-close-btn">✕</button>
      </div>

      <!-- Tab Navigation -->
      <div class="tv-dialog-tabs">
        <button class="tv-tab-btn ${this.activeTab === 'style' ? 'active' : ''}" data-tab="style">Style</button>
        ${hasTextTab ? `<button class="tv-tab-btn ${this.activeTab === 'text' ? 'active' : ''}" data-tab="text">Text</button>` : ''}
        ${hasCoordinatesTab ? `<button class="tv-tab-btn ${this.activeTab === 'coordinates' ? 'active' : ''}" data-tab="coordinates">Coordinates</button>` : ''}
        <button class="tv-tab-btn ${this.activeTab === 'visibility' ? 'active' : ''}" data-tab="visibility">Visibility</button>
      </div>

      <!-- Tab Content Area -->
      <div class="tv-dialog-body" id="dlg-tab-content">
        ${this._getTabHTML(this.activeTab, d)}
      </div>

      <!-- Modal Footer -->
      <div class="tv-dialog-footer">
        <div class="tv-dialog-template-wrap">
          <button class="tv-btn tv-template-btn" id="dlg-template-btn">Template ▾</button>
          <div class="tv-template-menu" id="dlg-template-menu" style="display: none;">
            <div class="tv-template-item" id="tpl-save-as">💾 Save As...</div>
            <div class="tv-template-item" id="tpl-apply-default">🔄 Apply Default</div>
            <div class="tv-template-divider"></div>
            ${Object.keys(this.templates).map(name => `
              <div class="tv-template-item tpl-preset" data-name="${name}">📄 ${name}</div>
            `).join('')}
          </div>
        </div>
        <div class="tv-dialog-footer-actions">
          <button class="tv-btn tv-dialog-cancel" id="dlg-cancel-btn">Cancel</button>
          <button class="tv-btn tv-dialog-ok" id="dlg-ok-btn">Ok</button>
        </div>
      </div>
    `;

    this._bindTabEvents();
    this._bindFormEvents();
  }

  _bindTabEvents() {
    this.modalEl.querySelectorAll('.tv-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.activeTab = btn.getAttribute('data-tab');
        this._renderModal();
      });
    });

    this.modalEl.querySelector('#dlg-close-btn').addEventListener('click', () => this.cancel());
    this.modalEl.querySelector('#dlg-cancel-btn').addEventListener('click', () => this.cancel());
    this.modalEl.querySelector('#dlg-ok-btn').addEventListener('click', () => this.save());

    // Template Dropdown
    const tplBtn = this.modalEl.querySelector('#dlg-template-btn');
    const tplMenu = this.modalEl.querySelector('#dlg-template-menu');
    tplBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tplMenu.style.display = tplMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', () => {
      if (tplMenu) tplMenu.style.display = 'none';
    });

    // Save As Template
    const saveAsBtn = this.modalEl.querySelector('#tpl-save-as');
    saveAsBtn.addEventListener('click', () => {
      const name = prompt('Enter a name for this template preset:');
      if (name && name.trim()) {
        const d = this.currentDrawing;
        if (d.type === 'brush') {
          this.templates[name.trim()] = {
            line: { ...d.line },
            background: { ...d.background },
          };
        } else if (d.type === 'path') {
          this.templates[name.trim()] = {
            line: { ...d.line },
            arrows: { ...d.arrows },
          };
        } else if (d.type === 'priceRange') {
          this.templates[name.trim()] = {
            line: { ...d.line },
            border: { ...d.border },
            background: { ...d.background },
            extendHorizontally: d.extendHorizontally,
            stats: { ...d.stats },
            label: { ...d.label, background: { ...d.label.background } },
            text: { ...d.text },
          };
        } else if (d.type === 'horizontalRay') {
          this.templates[name.trim()] = {
            line: { ...d.line },
            priceLabel: { ...d.priceLabel },
            timeLabel: { ...d.timeLabel },
            text: { ...d.text },
          };
        } else if (d.type === 'rotatedRectangle') {
          this.templates[name.trim()] = {
            border: { ...d.border },
            background: { ...d.background },
          };
        } else if (d.type === 'ellipse') {
          this.templates[name.trim()] = {
            border: { ...d.border },
            background: { ...d.background },
            text: { ...d.text },
          };
        } else {
          this.templates[name.trim()] = {
            border: { ...d.border },
            background: { ...d.background },
            middleLine: { ...d.middleLine },
            extendLeft: d.extendLeft,
            extendRight: d.extendRight,
            text: { ...d.text },
          };
        }
        this._saveTemplates();
        this._renderModal();
      }
    });

    // Apply Default
    const applyDefBtn = this.modalEl.querySelector('#tpl-apply-default');
    applyDefBtn.addEventListener('click', () => {
      const d = this.currentDrawing;
      if (d.type === 'brush') {
        d.line = { color: '#2962ff', opacity: 1, width: 2, style: 'solid' };
        d.background = { visible: false, color: '#2962ff', opacity: 0.2 };
        d.invalidateCache();
      } else if (d.type === 'path') {
        d.line = { color: '#2962ff', opacity: 1, width: 2, style: 'solid' };
        d.arrows = { start: false, end: true };
      } else if (d.type === 'priceRange') {
        d.line = { color: '#2962ff', width: 2, opacity: 1 };
        d.border = { visible: true, color: '#2962ff', width: 1, style: 'solid' };
        d.background = { visible: true, color: '#2962ff', opacity: 0.2 };
        d.extendHorizontally = false;
        d.stats = { priceRange: true, percentChange: true, pips: true };
        d.label = { color: '#ffffff', opacity: 1, size: 12, background: { visible: true, color: '#1e222d', opacity: 0.88 } };
        d.text = { content: '', color: '#ffffff', size: 12, bold: false, italic: false };
      } else if (d.type === 'horizontalRay') {
        d.line = { color: '#2962ff', opacity: 1, width: 2, style: 'solid' };
        d.priceLabel = { visible: true };
        d.timeLabel = { visible: false };
        d.text = { enabled: false, content: '', color: '#2962ff', opacity: 1, size: 14, bold: false, italic: false, hAlign: 'left', vAlign: 'bottom' };
      } else if (d.type === 'rotatedRectangle') {
        d.border = { color: '#2962ff', width: 2, style: 'solid' };
        d.background = { visible: true, color: '#2962ff', opacity: 0.2 };
      } else if (d.type === 'ellipse') {
        d.border = { visible: true, color: '#2962ff', width: 2, style: 'solid' };
        d.background = { visible: true, color: '#2962ff', opacity: 0.2 };
        d.text = { content: '', color: '#ffffff', size: 14, bold: false, italic: false, hAlign: 'center', vAlign: 'middle' };
      } else {
        d.border = { visible: true, color: '#2962ff', width: 2, style: 'solid' };
        d.background = { visible: true, color: '#2962ff', opacity: 0.2 };
        d.middleLine = { enabled: false, color: '#2962ff', opacity: 0.5, width: 1, style: 'dashed' };
        d.extendLeft = false;
        d.extendRight = false;
      }
      this.manager.requestRender();
      this._renderModal();
    });

    // Apply Presets
    this.modalEl.querySelectorAll('.tpl-preset').forEach(el => {
      el.addEventListener('click', () => {
        const name = el.getAttribute('data-name');
        const preset = this.templates[name];
        if (preset && this.currentDrawing) {
          const d = this.currentDrawing;
          if (d.type === 'brush') {
            if (preset.line) d.line = { ...preset.line };
            if (preset.background) d.background = { ...preset.background };
            d.invalidateCache();
          } else if (d.type === 'path') {
            if (preset.line) d.line = { ...preset.line };
            if (preset.arrows) d.arrows = { ...preset.arrows };
          } else if (d.type === 'priceRange') {
            if (preset.line) d.line = { ...preset.line };
            if (preset.border) d.border = { ...preset.border };
            if (preset.background) d.background = { ...preset.background };
            if (preset.extendHorizontally !== undefined) d.extendHorizontally = preset.extendHorizontally;
            if (preset.stats) d.stats = { ...preset.stats };
            if (preset.label) d.label = { ...preset.label, background: { ...preset.label.background } };
            if (preset.text) d.text = { ...preset.text };
          } else if (d.type === 'horizontalRay') {
            if (preset.line) d.line = { ...preset.line };
            if (preset.priceLabel) d.priceLabel = { ...preset.priceLabel };
            if (preset.timeLabel) d.timeLabel = { ...preset.timeLabel };
            if (preset.text) d.text = { ...preset.text };
          } else {
            if (preset.border) d.border = { ...preset.border };
            if (preset.background) d.background = { ...preset.background };
            if (preset.middleLine) d.middleLine = { ...preset.middleLine };
            if (preset.extendLeft !== undefined) d.extendLeft = preset.extendLeft;
            if (preset.extendRight !== undefined) d.extendRight = preset.extendRight;
            if (preset.text) d.text = { ...preset.text };
          }
          this.manager.requestRender();
          this._renderModal();
        }
      });
    });
  }

  _getTabHTML(tab, d) {
    const isRotated = d.type === 'rotatedRectangle';
    const isEllipse = d.type === 'ellipse';
    const isRay = d.type === 'horizontalRay';
    const isPriceRange = d.type === 'priceRange';
    const isPath = d.type === 'path';
    const isBrush = d.type === 'brush';
    const isPosition = d.type === 'longPosition' || d.type === 'shortPosition';
    const isTwoPointLine = ['trendline', 'ray', 'infoLine', 'extendedLine', 'trendAngle'].includes(d.type);
    const isSinglePointLine = ['horizontalLine', 'verticalLine', 'crossline'].includes(d.type);

    if (tab === 'style') {
      if (isPosition) {
        return `
          <!-- Style Tab for Position Tools -->
          <div class="tv-form-group">
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 90px;">Profit Target:</span>
              <input type="color" id="dlg-pos-target-color" value="${d.target?.color || '#089981'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-pos-target-opacity" min="0" max="100" step="5" value="${Math.round((d.target?.opacity !== undefined ? d.target.opacity : 0.2) * 100)}" />
                <span id="dlg-pos-target-opacity-val">${Math.round((d.target?.opacity !== undefined ? d.target.opacity : 0.2) * 100)}%</span>
              </div>
            </div>
            <div class="tv-form-row" style="margin-top: 8px;">
              <span class="tv-form-label" style="min-width: 90px;">Stop Loss:</span>
              <input type="color" id="dlg-pos-stop-color" value="${d.stop?.color || '#f23645'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-pos-stop-opacity" min="0" max="100" step="5" value="${Math.round((d.stop?.opacity !== undefined ? d.stop.opacity : 0.2) * 100)}" />
                <span id="dlg-pos-stop-opacity-val">${Math.round((d.stop?.opacity !== undefined ? d.stop.opacity : 0.2) * 100)}%</span>
              </div>
            </div>
            <div class="tv-form-divider"></div>
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 90px;">Entry Line:</span>
              <input type="color" id="dlg-pos-entry-color" value="${d.entryLine?.color || '#787b86'}" class="tv-color-input" />
              <select id="dlg-pos-entry-width" class="tv-select-sm" style="margin-left: 10px;">
                <option value="1" ${d.entryLine?.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.entryLine?.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.entryLine?.width === 3 ? 'selected' : ''}>3px</option>
              </select>
            </div>
            <div class="tv-form-divider"></div>
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-pos-show-stats" ${d.showStats ? 'checked' : ''} /><span>Show Statistics Tags</span></label>
              <label class="tv-checkbox-wrap" style="margin-left: 16px;"><input type="checkbox" id="dlg-pos-compact" ${d.compact ? 'checked' : ''} /><span>Compact View</span></label>
            </div>
          </div>
        `;
      }
      if (isTwoPointLine) {
        return `
          <!-- Style Tab for Two-Point Lines -->
          <div class="tv-form-group">
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 60px;">Line:</span>
              <input type="color" id="dlg-line-color" value="${d.line.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-line-opacity" min="0" max="100" step="5" value="${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}" />
                <span id="dlg-line-opacity-val">${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}%</span>
              </div>
              <select id="dlg-line-width" class="tv-select-sm">
                <option value="1" ${d.line.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.line.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.line.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.line.width === 4 ? 'selected' : ''}>4px</option>
              </select>
              <select id="dlg-line-style" class="tv-select-sm">
                <option value="solid" ${d.line.style === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${d.line.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${d.line.style === 'dotted' ? 'selected' : ''}>Dotted</option>
              </select>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-ext-left" ${d.extendLeft ? 'checked' : ''} /><span>Extend Left</span></label>
              <label class="tv-checkbox-wrap" style="margin-left: 16px;"><input type="checkbox" id="dlg-line-ext-right" ${d.extendRight ? 'checked' : ''} /><span>Extend Right</span></label>
            </div>
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-arrow-left" ${d.arrows?.left ? 'checked' : ''} /><span>Left End Arrow</span></label>
              <label class="tv-checkbox-wrap" style="margin-left: 16px;"><input type="checkbox" id="dlg-line-arrow-right" ${d.arrows?.right ? 'checked' : ''} /><span>Right End Arrow</span></label>
            </div>
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-middle-pt" ${d.middlePoint ? 'checked' : ''} /><span>Middle Point</span></label>
              <label class="tv-checkbox-wrap" style="margin-left: 16px;"><input type="checkbox" id="dlg-line-price-labels" ${d.priceLabels ? 'checked' : ''} /><span>Price Labels</span></label>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stats-enabled" ${d.stats?.enabled ? 'checked' : ''} /><b>Show Stats Badge</b></label>
              <label class="tv-checkbox-wrap" style="margin-left: 16px;"><input type="checkbox" id="dlg-line-stats-always" ${d.stats?.alwaysShow ? 'checked' : ''} /><span>Always Show</span></label>
            </div>
            <div class="tv-form-row" style="flex-wrap: wrap; gap: 8px 16px; margin-top: 6px;">
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-pricerange" ${d.stats?.showPriceRange ? 'checked' : ''} /><span>Price Range</span></label>
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-percent" ${d.stats?.showPercent ? 'checked' : ''} /><span>% Change</span></label>
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-pips" ${d.stats?.showPips ? 'checked' : ''} /><span>Pips</span></label>
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-bars" ${d.stats?.showBarsRange ? 'checked' : ''} /><span>Bars Range</span></label>
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-datetime" ${d.stats?.showDateTime ? 'checked' : ''} /><span>Date/Time</span></label>
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-distance" ${d.stats?.showDistance ? 'checked' : ''} /><span>Distance</span></label>
              <label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-line-stat-angle" ${d.stats?.showAngle ? 'checked' : ''} /><span>Angle</span></label>
            </div>
            <div class="tv-form-row" style="margin-top: 8px;">
              <span class="tv-form-label">Badge Position:</span>
              <select id="dlg-line-stats-pos" class="tv-select-sm">
                <option value="top" ${d.stats?.position === 'top' ? 'selected' : ''}>Top</option>
                <option value="middle" ${d.stats?.position === 'middle' ? 'selected' : ''}>Middle</option>
                <option value="bottom" ${d.stats?.position === 'bottom' ? 'selected' : ''}>Bottom</option>
              </select>
            </div>
          </div>
        `;
      }

      if (isSinglePointLine) {
        return `
          <!-- Style Tab for Single-Point Lines -->
          <div class="tv-form-group">
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 60px;">Line:</span>
              <input type="color" id="dlg-line-color" value="${d.line.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-line-opacity" min="0" max="100" step="5" value="${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}" />
                <span id="dlg-line-opacity-val">${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}%</span>
              </div>
              <select id="dlg-line-width" class="tv-select-sm">
                <option value="1" ${d.line.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.line.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.line.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.line.width === 4 ? 'selected' : ''}>4px</option>
              </select>
              <select id="dlg-line-style" class="tv-select-sm">
                <option value="solid" ${d.line.style === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${d.line.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${d.line.style === 'dotted' ? 'selected' : ''}>Dotted</option>
              </select>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              ${d.type !== 'verticalLine' ? `<label class="tv-checkbox-wrap"><input type="checkbox" id="dlg-single-price-label" ${d.priceLabels ? 'checked' : ''} /><span>Price Label</span></label>` : ''}
              ${d.type !== 'horizontalLine' ? `<label class="tv-checkbox-wrap" style="margin-left: 16px;"><input type="checkbox" id="dlg-single-time-label" ${d.timeLabels ? 'checked' : ''} /><span>Time Label</span></label>` : ''}
            </div>
          </div>
        `;
      }
      if (isBrush) {
        return `
          <!-- 1. Style Tab for Brush -->
          <div class="tv-form-group">
            <!-- Line (color, thickness, opacity) -->
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 60px;">Line:</span>
              <input type="color" id="dlg-brush-line-color" value="${d.line.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-brush-line-opacity" min="0" max="100" step="5" value="${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}" />
                <span id="dlg-brush-line-opacity-val">${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}%</span>
              </div>
              <select id="dlg-brush-line-width" class="tv-select-sm">
                <option value="1" ${d.line.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.line.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.line.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.line.width === 4 ? 'selected' : ''}>4px</option>
              </select>
            </div>

            <div class="tv-form-divider"></div>

            <!-- Background Fill (checkbox, color, opacity) -->
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap" style="min-width: 80px;">
                <input type="checkbox" id="dlg-brush-bg-vis" ${d.background?.visible ? 'checked' : ''} />
                <span>Fill</span>
              </label>
              <input type="color" id="dlg-brush-bg-color" value="${d.background?.color || d.line.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-brush-bg-opacity" min="0" max="100" step="5" value="${Math.round((d.background?.opacity !== undefined ? d.background.opacity : 0.2) * 100)}" />
                <span id="dlg-brush-bg-opacity-val">${Math.round((d.background?.opacity !== undefined ? d.background.opacity : 0.2) * 100)}%</span>
              </div>
            </div>
          </div>
        `;
      }
      if (isPath) {
        return `
          <!-- 1. Style Tab for Path -->
          <div class="tv-form-group">
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 60px;">Line:</span>
              <input type="color" id="dlg-path-line-color" value="${d.line.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-path-line-opacity" min="0" max="100" step="5" value="${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}" />
                <span id="dlg-path-line-opacity-val">${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}%</span>
              </div>
              <select id="dlg-path-line-width" class="tv-select-sm">
                <option value="1" ${d.line.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.line.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.line.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.line.width === 4 ? 'selected' : ''}>4px</option>
              </select>
              <select id="dlg-path-line-style" class="tv-select-sm">
                <option value="solid" ${d.line.style === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${d.line.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${d.line.style === 'dotted' ? 'selected' : ''}>Dotted</option>
              </select>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              <label class="tv-checkbox-wrap">
                <input type="checkbox" id="dlg-path-arrow-start" ${d.arrows?.start ? 'checked' : ''} />
                <span>Arrow at Start</span>
              </label>
              <span style="font-size: 11px; color: #787b86; margin-left: 8px;">(Points outward from 1st anchor)</span>
            </div>

            <div class="tv-form-row" style="margin-top: 8px;">
              <label class="tv-checkbox-wrap">
                <input type="checkbox" id="dlg-path-arrow-end" ${d.arrows?.end ? 'checked' : ''} />
                <span>Arrow at End</span>
              </label>
              <span style="font-size: 11px; color: #787b86; margin-left: 8px;">(Points along final segment)</span>
            </div>
          </div>
        `;
      }
      if (isPriceRange) {
        return `
          <!-- 1. Style Tab for Price Range -->
          <div class="tv-form-group">
            <!-- Line (color, thickness, opacity) -->
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 80px;">Line:</span>
              <input type="color" id="dlg-pr-line-color" value="${d.line.color || '#2962ff'}" class="tv-color-input" />
              <select id="dlg-pr-line-width" class="tv-select-sm">
                <option value="1" ${d.line.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.line.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.line.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.line.width === 4 ? 'selected' : ''}>4px</option>
              </select>
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-pr-line-opacity" min="0" max="100" step="5" value="${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}" />
                <span id="dlg-pr-line-opacity-val">${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}%</span>
              </div>
            </div>

            <div class="tv-form-divider"></div>

            <!-- Border (checkbox, color, thickness, line style) -->
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap" style="min-width: 80px;">
                <input type="checkbox" id="dlg-pr-border-vis" ${d.border.visible ? 'checked' : ''} />
                <span>Border</span>
              </label>
              <input type="color" id="dlg-pr-border-color" value="${d.border.color || '#2962ff'}" class="tv-color-input" />
              <select id="dlg-pr-border-width" class="tv-select-sm">
                <option value="1" ${d.border.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.border.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.border.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.border.width === 4 ? 'selected' : ''}>4px</option>
              </select>
              <select id="dlg-pr-border-style" class="tv-select-sm">
                <option value="solid" ${d.border.style === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${d.border.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${d.border.style === 'dotted' ? 'selected' : ''}>Dotted</option>
              </select>
            </div>

            <div class="tv-form-divider"></div>

            <!-- Background (checkbox, color, opacity) -->
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap" style="min-width: 80px;">
                <input type="checkbox" id="dlg-pr-bg-vis" ${d.background.visible ? 'checked' : ''} />
                <span>Background</span>
              </label>
              <input type="color" id="dlg-pr-bg-color" value="${d.background.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-pr-bg-opacity" min="0" max="100" step="5" value="${Math.round((d.background.opacity || 0.2) * 100)}" />
                <span id="dlg-pr-bg-opacity-val">${Math.round((d.background.opacity || 0.2) * 100)}%</span>
              </div>
            </div>

            <div class="tv-form-divider"></div>

            <!-- Extend Horizontally -->
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap">
                <input type="checkbox" id="dlg-pr-extend" ${d.extendHorizontally ? 'checked' : ''} />
                <span>Extend Horizontally</span>
              </label>
              <span style="font-size: 11px; color: #787b86;">(Extends box across whole chart)</span>
            </div>

            <div class="tv-form-divider"></div>

            <!-- Info Section: Stats Checklist -->
            <div class="tv-form-row-col">
              <span class="tv-form-label" style="font-weight: 700; color: #d1d4dc;">Info Label Measurements:</span>
              <div class="tv-form-row" style="gap: 16px; margin-top: 4px;">
                <label class="tv-checkbox-wrap">
                  <input type="checkbox" id="dlg-pr-stat-price" ${d.stats.priceRange ? 'checked' : ''} />
                  <span>Price Range</span>
                </label>
                <label class="tv-checkbox-wrap">
                  <input type="checkbox" id="dlg-pr-stat-pct" ${d.stats.percentChange ? 'checked' : ''} />
                  <span>Percent Change</span>
                </label>
                <label class="tv-checkbox-wrap">
                  <input type="checkbox" id="dlg-pr-stat-pips" ${d.stats.pips ? 'checked' : ''} />
                  <span>Pips / Ticks</span>
                </label>
              </div>
            </div>

            <div class="tv-form-divider"></div>

            <!-- Label Typography & Color -->
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 80px;">Label Text:</span>
              <input type="color" id="dlg-pr-lbl-color" value="${d.label.color || '#ffffff'}" class="tv-color-input" />
              <select id="dlg-pr-lbl-size" class="tv-select-sm">
                ${[10, 11, 12, 14, 16, 18, 20].map(s => `
                  <option value="${s}" ${d.label.size === s ? 'selected' : ''}>${s}px</option>
                `).join('')}
              </select>
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-pr-lbl-opacity" min="0" max="100" step="5" value="${Math.round((d.label.opacity !== undefined ? d.label.opacity : 1) * 100)}" />
                <span id="dlg-pr-lbl-opacity-val">${Math.round((d.label.opacity !== undefined ? d.label.opacity : 1) * 100)}%</span>
              </div>
            </div>

            <!-- Label Background -->
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap" style="min-width: 80px;">
                <input type="checkbox" id="dlg-pr-lbl-bg-vis" ${d.label.background?.visible ? 'checked' : ''} />
                <span>Label Box</span>
              </label>
              <input type="color" id="dlg-pr-lbl-bg-color" value="${d.label.background?.color || '#1e222d'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-pr-lbl-bg-opacity" min="0" max="100" step="5" value="${Math.round((d.label.background?.opacity !== undefined ? d.label.background.opacity : 0.88) * 100)}" />
                <span id="dlg-pr-lbl-bg-opacity-val">${Math.round((d.label.background?.opacity !== undefined ? d.label.background.opacity : 0.88) * 100)}%</span>
              </div>
            </div>
          </div>
        `;
      }

      if (isRay) {
        return `
          <!-- 1. Style Tab for Horizontal Ray -->
          <div class="tv-form-group">
            <div class="tv-form-row">
              <span class="tv-form-label" style="min-width: 60px;">Line:</span>
              <input type="color" id="dlg-ray-line-color" value="${d.line.color || '#2962ff'}" class="tv-color-input" />
              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-ray-line-opacity" min="0" max="100" step="5" value="${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}" />
                <span id="dlg-ray-line-opacity-val">${Math.round((d.line.opacity !== undefined ? d.line.opacity : 1) * 100)}%</span>
              </div>
              <select id="dlg-ray-line-width" class="tv-select-sm">
                <option value="1" ${d.line.width === 1 ? 'selected' : ''}>1px</option>
                <option value="2" ${d.line.width === 2 ? 'selected' : ''}>2px</option>
                <option value="3" ${d.line.width === 3 ? 'selected' : ''}>3px</option>
                <option value="4" ${d.line.width === 4 ? 'selected' : ''}>4px</option>
              </select>
              <select id="dlg-ray-line-style" class="tv-select-sm">
                <option value="solid" ${d.line.style === 'solid' ? 'selected' : ''}>Solid</option>
                <option value="dashed" ${d.line.style === 'dashed' ? 'selected' : ''}>Dashed</option>
                <option value="dotted" ${d.line.style === 'dotted' ? 'selected' : ''}>Dotted</option>
              </select>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              <label class="tv-checkbox-wrap">
                <input type="checkbox" id="dlg-ray-price-label" ${d.priceLabel?.visible !== false ? 'checked' : ''} />
                <span>Price Label</span>
              </label>
              <span style="font-size: 11px; color: #787b86;">(Shows price badge on right price scale using line color)</span>
            </div>
          </div>
        `;
      }

      return `
        <!-- 1. Style Tab -->
        <div class="tv-form-group">
          <div class="tv-form-row">
            <label class="tv-checkbox-wrap">
              <input type="checkbox" id="dlg-border-vis" ${d.border.visible !== false ? 'checked' : ''} />
              <span>Border</span>
            </label>
            <input type="color" id="dlg-border-color" value="${d.border.color || '#2962ff'}" class="tv-color-input" />
            <select id="dlg-border-width" class="tv-select-sm">
              <option value="1" ${d.border.width === 1 ? 'selected' : ''}>1px</option>
              <option value="2" ${d.border.width === 2 ? 'selected' : ''}>2px</option>
              <option value="3" ${d.border.width === 3 ? 'selected' : ''}>3px</option>
              <option value="4" ${d.border.width === 4 ? 'selected' : ''}>4px</option>
            </select>
            <select id="dlg-border-style" class="tv-select-sm">
              <option value="solid" ${d.border.style === 'solid' ? 'selected' : ''}>Solid</option>
              <option value="dashed" ${d.border.style === 'dashed' ? 'selected' : ''}>Dashed</option>
              <option value="dotted" ${d.border.style === 'dotted' ? 'selected' : ''}>Dotted</option>
            </select>
          </div>

          ${(!isRotated && !isEllipse) ? `
          <div class="tv-form-divider"></div>

          <!-- Middle Line -->
          <div class="tv-form-row">
            <label class="tv-checkbox-wrap">
              <input type="checkbox" id="dlg-mid-enabled" ${d.middleLine?.enabled ? 'checked' : ''} />
              <span>Middle Line</span>
            </label>
            <input type="color" id="dlg-mid-color" value="${d.middleLine?.color || d.border.color || '#2962ff'}" class="tv-color-input" />
            <div class="tv-slider-group">
              <span>Opacity:</span>
              <input type="range" id="dlg-mid-opacity" min="0" max="100" step="5" value="${Math.round((d.middleLine?.opacity !== undefined ? d.middleLine.opacity : 0.5) * 100)}" />
              <span id="dlg-mid-opacity-val">${Math.round((d.middleLine?.opacity !== undefined ? d.middleLine.opacity : 0.5) * 100)}%</span>
            </div>
            <select id="dlg-mid-width" class="tv-select-sm">
              <option value="1" ${d.middleLine?.width === 1 ? 'selected' : ''}>1px</option>
              <option value="2" ${d.middleLine?.width === 2 ? 'selected' : ''}>2px</option>
              <option value="3" ${d.middleLine?.width === 3 ? 'selected' : ''}>3px</option>
            </select>
            <select id="dlg-mid-style" class="tv-select-sm">
              <option value="solid" ${d.middleLine?.style === 'solid' ? 'selected' : ''}>Solid</option>
              <option value="dashed" ${d.middleLine?.style === 'dashed' ? 'selected' : ''}>Dashed</option>
              <option value="dotted" ${d.middleLine?.style === 'dotted' ? 'selected' : ''}>Dotted</option>
            </select>
          </div>
          ` : ''}

          <div class="tv-form-divider"></div>

          <!-- Background Fill -->
          <div class="tv-form-row">
            <label class="tv-checkbox-wrap">
              <input type="checkbox" id="dlg-bg-vis" ${d.background.visible ? 'checked' : ''} />
              <span>Background</span>
            </label>
            <input type="color" id="dlg-bg-color" value="${d.background.color || '#2962ff'}" class="tv-color-input" />
            <div class="tv-slider-group">
              <span>Opacity:</span>
              <input type="range" id="dlg-bg-opacity" min="0" max="100" step="5" value="${Math.round((d.background.opacity || 0.2) * 100)}" />
              <span id="dlg-bg-opacity-val">${Math.round((d.background.opacity || 0.2) * 100)}%</span>
            </div>
          </div>

          ${(!isRotated && !isEllipse) ? `
          <div class="tv-form-divider"></div>

          <!-- Extend Left / Extend Right -->
          <div class="tv-form-row">
            <label class="tv-checkbox-wrap">
              <input type="checkbox" id="dlg-extend-left" ${d.extendLeft ? 'checked' : ''} />
              <span>Extend Left</span>
            </label>
            <label class="tv-checkbox-wrap" style="margin-left: 20px;">
              <input type="checkbox" id="dlg-extend-right" ${d.extendRight ? 'checked' : ''} />
              <span>Extend Right</span>
            </label>
          </div>
          ` : ''}
        </div>
      `;
    }

    if (tab === 'text') {
      if (isRay) {
        return `
          <!-- 2. Text Tab for Horizontal Ray -->
          <div class="tv-form-group">
            <div class="tv-form-row">
              <label class="tv-checkbox-wrap">
                <input type="checkbox" id="dlg-ray-text-enabled" ${d.text.enabled ? 'checked' : ''} />
                <span>Show Text</span>
              </label>
            </div>

            <div class="tv-form-row-col">
              <label class="tv-form-label">Text Content:</label>
              <textarea id="dlg-text-content" class="tv-textarea" rows="2" placeholder="Enter text to display along the ray...">${d.text.content || ''}</textarea>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              <div class="tv-form-subgroup">
                <label class="tv-form-label">Color:</label>
                <input type="color" id="dlg-text-color" value="${d.text.color || d.line.color || '#2962ff'}" class="tv-color-input" />
              </div>

              <div class="tv-slider-group">
                <span>Opacity:</span>
                <input type="range" id="dlg-ray-text-opacity" min="0" max="100" step="5" value="${Math.round((d.text.opacity !== undefined ? d.text.opacity : 1) * 100)}" />
                <span id="dlg-ray-text-opacity-val">${Math.round((d.text.opacity !== undefined ? d.text.opacity : 1) * 100)}%</span>
              </div>

              <div class="tv-form-subgroup">
                <label class="tv-form-label">Size:</label>
                <select id="dlg-text-size" class="tv-select-sm">
                  ${[10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map(s => `
                    <option value="${s}" ${d.text.size === s ? 'selected' : ''}>${s}px</option>
                  `).join('')}
                </select>
              </div>

              <div class="tv-form-subgroup">
                <label class="tv-form-label">Style:</label>
                <div class="tv-btn-toggle-group">
                  <button type="button" class="tv-btn-toggle ${d.text.bold ? 'active' : ''}" id="dlg-text-bold"><b>B</b></button>
                  <button type="button" class="tv-btn-toggle ${d.text.italic ? 'active' : ''}" id="dlg-text-italic"><i>I</i></button>
                </div>
              </div>
            </div>

            <div class="tv-form-divider"></div>

            <div class="tv-form-row">
              <div class="tv-form-subgroup">
                <label class="tv-form-label">Position along ray (H-Align):</label>
                <select id="dlg-text-halign" class="tv-select-md">
                  <option value="left" ${d.text.hAlign === 'left' ? 'selected' : ''}>Left (Near Origin)</option>
                  <option value="center" ${d.text.hAlign === 'center' ? 'selected' : ''}>Center (Middle)</option>
                  <option value="right" ${d.text.hAlign === 'right' ? 'selected' : ''}>Right (Pane Edge)</option>
                </select>
              </div>

              <div class="tv-form-subgroup">
                <label class="tv-form-label">Vertical Placement (V-Align):</label>
                <select id="dlg-text-valign" class="tv-select-md">
                  <option value="top" ${d.text.vAlign === 'top' ? 'selected' : ''}>Top (Above)</option>
                  <option value="middle" ${d.text.vAlign === 'middle' ? 'selected' : ''}>Middle (On Line)</option>
                  <option value="bottom" ${d.text.vAlign === 'bottom' ? 'selected' : ''}>Bottom (Below)</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <!-- 2. Text Tab -->
        <div class="tv-form-group">
          <div class="tv-form-row-col">
            <label class="tv-form-label">Text Content:</label>
            <textarea id="dlg-text-content" class="tv-textarea" rows="3" placeholder="Enter text to display inside the shape...">${d.text.content || ''}</textarea>
          </div>

          <div class="tv-form-divider"></div>

          <div class="tv-form-row">
            <div class="tv-form-subgroup">
              <label class="tv-form-label">Color:</label>
              <input type="color" id="dlg-text-color" value="${d.text.color || '#ffffff'}" class="tv-color-input" />
            </div>

            <div class="tv-form-subgroup">
              <label class="tv-form-label">Size:</label>
              <select id="dlg-text-size" class="tv-select-sm">
                ${[10, 11, 12, 14, 16, 18, 20, 24, 28, 36].map(s => `
                  <option value="${s}" ${d.text.size === s ? 'selected' : ''}>${s}px</option>
                `).join('')}
              </select>
            </div>

            <div class="tv-form-subgroup">
              <label class="tv-form-label">Style:</label>
              <div class="tv-btn-toggle-group">
                <button type="button" class="tv-btn-toggle ${d.text.bold ? 'active' : ''}" id="dlg-text-bold"><b>B</b></button>
                <button type="button" class="tv-btn-toggle ${d.text.italic ? 'active' : ''}" id="dlg-text-italic"><i>I</i></button>
              </div>
            </div>
          </div>

          <div class="tv-form-divider"></div>

          <div class="tv-form-row">
            <div class="tv-form-subgroup">
              <label class="tv-form-label">Horizontal Alignment:</label>
              <select id="dlg-text-halign" class="tv-select-md">
                <option value="left" ${d.text.hAlign === 'left' ? 'selected' : ''}>Left</option>
                <option value="center" ${d.text.hAlign === 'center' ? 'selected' : ''}>Center</option>
                <option value="right" ${d.text.hAlign === 'right' ? 'selected' : ''}>Right</option>
              </select>
            </div>

            <div class="tv-form-subgroup">
              <label class="tv-form-label">Vertical Alignment:</label>
              <select id="dlg-text-valign" class="tv-select-md">
                <option value="top" ${d.text.vAlign === 'top' ? 'selected' : ''}>Top</option>
                <option value="middle" ${d.text.vAlign === 'middle' ? 'selected' : ''}>Middle</option>
                <option value="bottom" ${d.text.vAlign === 'bottom' ? 'selected' : ''}>Bottom</option>
              </select>
            </div>

            ${!isEllipse ? `
            <div class="tv-form-subgroup">
              <label class="tv-form-label">Placement:</label>
              <select id="dlg-text-placement" class="tv-select-md">
                <option value="inside" ${d.text.placement === 'inside' ? 'selected' : ''}>Inside</option>
                <option value="outside" ${d.text.placement === 'outside' ? 'selected' : ''}>Outside</option>
              </select>
            </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    if (tab === 'coordinates') {
      if (isPosition) {
        return `
          <!-- 3. Coordinates Tab for Position Tools -->
          <div class="tv-form-group">
            <div class="tv-coord-box">
              <div class="tv-coord-title">Price Levels</div>
              <div class="tv-form-row">
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Entry Price:</label>
                  <input type="number" step="0.0001" id="dlg-pos-coord-entry" class="tv-input-num" value="${parseFloat(d.entryPrice.toFixed(4))}" />
                </div>
              </div>
              <div class="tv-form-row" style="margin-top: 8px;">
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Profit Target:</label>
                  <input type="number" step="0.0001" id="dlg-pos-coord-target" class="tv-input-num" value="${parseFloat(d.targetPrice.toFixed(4))}" />
                </div>
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Stop Loss:</label>
                  <input type="number" step="0.0001" id="dlg-pos-coord-stop" class="tv-input-num" value="${parseFloat(d.stopPrice.toFixed(4))}" />
                </div>
              </div>
            </div>
            <div class="tv-coord-box" style="margin-top: 14px;">
              <div class="tv-coord-title">Bar Range</div>
              <div class="tv-form-row">
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Start Bar Index:</label>
                  <input type="number" step="1" id="dlg-pos-coord-l1" class="tv-input-num" value="${Math.round(d.startLogical || 0)}" />
                </div>
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">End Bar Index:</label>
                  <input type="number" step="1" id="dlg-pos-coord-l2" class="tv-input-num" value="${Math.round(d.endLogical || 0)}" />
                </div>
              </div>
            </div>
          </div>
        `;
      }

      if (isPath) {
        return `
          <!-- 3. Coordinates Tab for Path -->
          <div class="tv-form-group">
            <div class="tv-coord-box" style="max-height: 280px; overflow-y: auto;">
              <div class="tv-coord-title" style="margin-bottom: 10px;">Path Anchor Points (${d.points.length} anchors)</div>
              ${d.points.map((pt, idx) => `
                <div class="tv-form-row tv-path-coord-row" style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px;">
                  <span style="min-width: 60px; font-weight: 600; font-size: 11px; color: #787b86;">Point #${idx + 1}</span>
                  <div class="tv-form-subgroup" style="flex: 1;">
                    <label class="tv-form-label" style="font-size: 10px;">Price:</label>
                    <input type="number" step="0.0001" class="tv-input-num dlg-path-coord-price" data-idx="${idx}" value="${parseFloat(Number(pt.price).toFixed(4))}" style="width: 100%;" />
                  </div>
                  <div class="tv-form-subgroup" style="flex: 1;">
                    <label class="tv-form-label" style="font-size: 10px;">Bar #:</label>
                    <input type="number" step="1" class="tv-input-num dlg-path-coord-logical" data-idx="${idx}" value="${Math.round(pt.logical || 0)}" style="width: 100%;" />
                  </div>
                </div>
              `).join('')}
              <div style="font-size: 11px; color: #787b86; margin-top: 6px;">
                Changes update the path anchors on the chart in real time.
              </div>
            </div>
          </div>
        `;
      }

      if (isSinglePointLine) {
        const pt = d.point || d.points?.[0] || { price: 0, logical: 0 };
        return `
          <!-- 3. Coordinates Tab for Single-Point Lines -->
          <div class="tv-form-group">
            <div class="tv-coord-box">
              <div class="tv-coord-title">Anchor Coordinates</div>
              <div class="tv-form-row">
                ${d.type !== 'verticalLine' ? `
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Price Level:</label>
                  <input type="number" step="0.0001" id="dlg-coord-single-price" class="tv-input-num" value="${parseFloat(Number(pt.price || 0).toFixed(4))}" />
                </div>
                ` : ''}
                ${d.type !== 'horizontalLine' ? `
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Bar Index:</label>
                  <input type="number" step="1" id="dlg-coord-single-bar" class="tv-input-num" value="${Math.round(pt.logical || 0)}" />
                </div>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }

      if (isRay) {
        const pt = d.point || d.points[0] || { price: 0, logical: 0 };
        return `
          <!-- 3. Coordinates Tab for Horizontal Ray -->
          <div class="tv-form-group">
            <div class="tv-coord-box">
              <div class="tv-coord-title">Anchor Point (Origin)</div>
              <div class="tv-form-row">
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Price:</label>
                  <input type="number" step="0.0001" id="dlg-coord-p1" class="tv-input-num" value="${parseFloat(pt.price.toFixed(4))}" />
                </div>
                <div class="tv-form-subgroup">
                  <label class="tv-form-label">Bar Index:</label>
                  <input type="number" step="1" id="dlg-coord-l1" class="tv-input-num" value="${Math.round(pt.logical || 0)}" />
                </div>
              </div>
              <div style="font-size: 11px; color: #787b86; margin-top: 8px;">
                Ray starts at this bar & price and extends to the right edge of the chart pane.
              </div>
            </div>
          </div>
        `;
      }

      const p1 = d.points[0] || { price: 0, logical: 0 };
      const p2 = d.points[1] || { price: 0, logical: 0 };
      const title1 = isTwoPointLine ? 'Point 1' : 'Anchor Point 1 (Top-Left)';
      const title2 = isTwoPointLine ? 'Point 2' : 'Anchor Point 2 (Bottom-Right)';
      return `
        <!-- 3. Coordinates Tab -->
        <div class="tv-form-group">
          <div class="tv-coord-box">
            <div class="tv-coord-title">${title1}</div>
            <div class="tv-form-row">
              <div class="tv-form-subgroup">
                <label class="tv-form-label">Price:</label>
                <input type="number" step="0.0001" id="dlg-coord-p1" class="tv-input-num" value="${parseFloat(p1.price.toFixed(4))}" />
              </div>
              <div class="tv-form-subgroup">
                <label class="tv-form-label">Bar Index:</label>
                <input type="number" step="1" id="dlg-coord-l1" class="tv-input-num" value="${Math.round(p1.logical || 0)}" />
              </div>
            </div>
          </div>

          <div class="tv-coord-box" style="margin-top: 14px;">
            <div class="tv-coord-title">${title2}</div>
            <div class="tv-form-row">
              <div class="tv-form-subgroup">
                <label class="tv-form-label">Price:</label>
                <input type="number" step="0.0001" id="dlg-coord-p2" class="tv-input-num" value="${parseFloat(p2.price.toFixed(4))}" />
              </div>
              <div class="tv-form-subgroup">
                <label class="tv-form-label">Bar Index:</label>
                <input type="number" step="1" id="dlg-coord-l2" class="tv-input-num" value="${Math.round(p2.logical || 0)}" />
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (tab === 'visibility') {
      return `
        <!-- 4. Visibility Tab -->
        <div class="tv-form-group">
          <div class="tv-form-subgroup" style="margin-bottom: 10px;">
            <span class="tv-form-label">Show this drawing on the following timeframes:</span>
          </div>
          <div class="tv-tf-grid">
            ${TIMEFRAMES.map(tf => `
              <label class="tv-checkbox-wrap tv-tf-item">
                <input type="checkbox" class="dlg-tf-check" data-tf="${tf}" ${d.isVisibleOnTimeframe(tf) ? 'checked' : ''} />
                <span>${tf}</span>
              </label>
            `).join('')}
          </div>
          <div class="tv-form-row" style="margin-top: 14px;">
            <button type="button" class="tv-btn tv-btn-sm" id="dlg-tf-all">Check All</button>
            <button type="button" class="tv-btn tv-btn-sm" id="dlg-tf-none" style="margin-left: 8px;">Uncheck All</button>
          </div>
        </div>
      `;
    }
  }

  _bindFormEvents() {
    const d = this.currentDrawing;
    if (!d) return;

    const liveUpdate = () => {
      this.manager.requestRender();
    };

    if (this.activeTab === 'style') {
      // Position Tools Style bindings
      const posTargetCol = this.modalEl.querySelector('#dlg-pos-target-color');
      const posTargetOp = this.modalEl.querySelector('#dlg-pos-target-opacity');
      const posTargetOpVal = this.modalEl.querySelector('#dlg-pos-target-opacity-val');
      const posStopCol = this.modalEl.querySelector('#dlg-pos-stop-color');
      const posStopOp = this.modalEl.querySelector('#dlg-pos-stop-opacity');
      const posStopOpVal = this.modalEl.querySelector('#dlg-pos-stop-opacity-val');
      const posEntryCol = this.modalEl.querySelector('#dlg-pos-entry-color');
      const posEntryWid = this.modalEl.querySelector('#dlg-pos-entry-width');
      const posShowStats = this.modalEl.querySelector('#dlg-pos-show-stats');
      const posCompact = this.modalEl.querySelector('#dlg-pos-compact');

      if (posTargetCol) posTargetCol.addEventListener('input', () => { d.target.color = posTargetCol.value; d.target.borderColor = posTargetCol.value; liveUpdate(); });
      if (posTargetOp) posTargetOp.addEventListener('input', () => {
        d.target.opacity = parseInt(posTargetOp.value) / 100;
        if (posTargetOpVal) posTargetOpVal.textContent = `${posTargetOp.value}%`;
        liveUpdate();
      });
      if (posStopCol) posStopCol.addEventListener('input', () => { d.stop.color = posStopCol.value; d.stop.borderColor = posStopCol.value; liveUpdate(); });
      if (posStopOp) posStopOp.addEventListener('input', () => {
        d.stop.opacity = parseInt(posStopOp.value) / 100;
        if (posStopOpVal) posStopOpVal.textContent = `${posStopOp.value}%`;
        liveUpdate();
      });
      if (posEntryCol) posEntryCol.addEventListener('input', () => { d.entryLine.color = posEntryCol.value; liveUpdate(); });
      if (posEntryWid) posEntryWid.addEventListener('change', () => { d.entryLine.width = parseInt(posEntryWid.value); liveUpdate(); });
      if (posShowStats) posShowStats.addEventListener('change', () => { d.showStats = posShowStats.checked; liveUpdate(); });
      if (posCompact) posCompact.addEventListener('change', () => { d.compact = posCompact.checked; liveUpdate(); });

      const lineCol = this.modalEl.querySelector('#dlg-line-color');
      const lineOp = this.modalEl.querySelector('#dlg-line-opacity');
      const lineOpVal = this.modalEl.querySelector('#dlg-line-opacity-val');
      const lineWid = this.modalEl.querySelector('#dlg-line-width');
      const lineSty = this.modalEl.querySelector('#dlg-line-style');

      if (lineCol) lineCol.addEventListener('input', () => { d.line.color = lineCol.value; liveUpdate(); });
      if (lineOp) lineOp.addEventListener('input', () => {
        d.line.opacity = parseInt(lineOp.value) / 100;
        if (lineOpVal) lineOpVal.textContent = `${lineOp.value}%`;
        liveUpdate();
      });
      if (lineWid) lineWid.addEventListener('change', () => { d.line.width = parseInt(lineWid.value); liveUpdate(); });
      if (lineSty) lineSty.addEventListener('change', () => { d.line.style = lineSty.value; liveUpdate(); });

      // 2-point line flags
      const lineExtL = this.modalEl.querySelector('#dlg-line-ext-left');
      const lineExtR = this.modalEl.querySelector('#dlg-line-ext-right');
      const arrL = this.modalEl.querySelector('#dlg-line-arrow-left');
      const arrR = this.modalEl.querySelector('#dlg-line-arrow-right');
      const midPt = this.modalEl.querySelector('#dlg-line-middle-pt');
      const prcLabels = this.modalEl.querySelector('#dlg-line-price-labels');

      if (lineExtL) lineExtL.addEventListener('change', () => { d.extendLeft = lineExtL.checked; liveUpdate(); });
      if (lineExtR) lineExtR.addEventListener('change', () => { d.extendRight = lineExtR.checked; liveUpdate(); });
      if (arrL) arrL.addEventListener('change', () => { if (!d.arrows) d.arrows = {}; d.arrows.left = arrL.checked; liveUpdate(); });
      if (arrR) arrR.addEventListener('change', () => { if (!d.arrows) d.arrows = {}; d.arrows.right = arrR.checked; liveUpdate(); });
      if (midPt) midPt.addEventListener('change', () => { d.middlePoint = midPt.checked; liveUpdate(); });
      if (prcLabels) prcLabels.addEventListener('change', () => { d.priceLabels = prcLabels.checked; liveUpdate(); });

      // Stats flags
      const statsEn = this.modalEl.querySelector('#dlg-line-stats-enabled');
      const statsAl = this.modalEl.querySelector('#dlg-line-stats-always');
      if (statsEn) statsEn.addEventListener('change', () => { if (!d.stats) d.stats = {}; d.stats.enabled = statsEn.checked; liveUpdate(); });
      if (statsAl) statsAl.addEventListener('change', () => { if (!d.stats) d.stats = {}; d.stats.alwaysShow = statsAl.checked; liveUpdate(); });

      ['pricerange', 'percent', 'pips', 'bars', 'datetime', 'distance', 'angle'].forEach(k => {
        const chk = this.modalEl.querySelector(`#dlg-line-stat-${k}`);
        if (chk) {
          const map = {
            pricerange: 'showPriceRange',
            percent: 'showPercent',
            pips: 'showPips',
            bars: 'showBarsRange',
            datetime: 'showDateTime',
            distance: 'showDistance',
            angle: 'showAngle',
          };
          chk.addEventListener('change', () => {
            if (!d.stats) d.stats = {};
            d.stats[map[k]] = chk.checked;
            liveUpdate();
          });
        }
      });

      const statsPos = this.modalEl.querySelector('#dlg-line-stats-pos');
      if (statsPos) statsPos.addEventListener('change', () => { if (!d.stats) d.stats = {}; d.stats.position = statsPos.value; liveUpdate(); });

      // Single-point flags
      const sPrice = this.modalEl.querySelector('#dlg-single-price-label');
      const sTime = this.modalEl.querySelector('#dlg-single-time-label');
      if (sPrice) sPrice.addEventListener('change', () => { d.priceLabels = sPrice.checked; liveUpdate(); });
      if (sTime) sTime.addEventListener('change', () => { d.timeLabels = sTime.checked; liveUpdate(); });

      if (d.type === 'brush') {
        const bCol = this.modalEl.querySelector('#dlg-brush-line-color');
        const bOp = this.modalEl.querySelector('#dlg-brush-line-opacity');
        const bOpVal = this.modalEl.querySelector('#dlg-brush-line-opacity-val');
        const bWid = this.modalEl.querySelector('#dlg-brush-line-width');

        const bgVis = this.modalEl.querySelector('#dlg-brush-bg-vis');
        const bgCol = this.modalEl.querySelector('#dlg-brush-bg-color');
        const bgOp = this.modalEl.querySelector('#dlg-brush-bg-opacity');
        const bgOpVal = this.modalEl.querySelector('#dlg-brush-bg-opacity-val');

        if (bCol) bCol.addEventListener('input', () => { d.line.color = bCol.value; d.invalidateCache(); liveUpdate(); });
        if (bOp) bOp.addEventListener('input', () => {
          d.line.opacity = parseInt(bOp.value) / 100;
          if (bOpVal) bOpVal.textContent = `${bOp.value}%`;
          d.invalidateCache();
          liveUpdate();
        });
        if (bWid) bWid.addEventListener('change', () => { d.line.width = parseInt(bWid.value); d.invalidateCache(); liveUpdate(); });

        if (bgVis) bgVis.addEventListener('change', () => {
          if (!d.background) d.background = { visible: false, color: d.line.color, opacity: 0.2 };
          d.background.visible = bgVis.checked;
          d.invalidateCache();
          liveUpdate();
        });
        if (bgCol) bgCol.addEventListener('input', () => {
          if (!d.background) d.background = { visible: true, color: bgCol.value, opacity: 0.2 };
          d.background.color = bgCol.value;
          d.invalidateCache();
          liveUpdate();
        });
        if (bgOp) bgOp.addEventListener('input', () => {
          if (!d.background) d.background = { visible: true, color: d.line.color, opacity: 0.2 };
          d.background.opacity = parseInt(bgOp.value) / 100;
          if (bgOpVal) bgOpVal.textContent = `${bgOp.value}%`;
          d.invalidateCache();
          liveUpdate();
        });
        return;
      }

      if (d.type === 'path') {
        const pCol = this.modalEl.querySelector('#dlg-path-line-color');
        const pOp = this.modalEl.querySelector('#dlg-path-line-opacity');
        const pOpVal = this.modalEl.querySelector('#dlg-path-line-opacity-val');
        const pWid = this.modalEl.querySelector('#dlg-path-line-width');
        const pSty = this.modalEl.querySelector('#dlg-path-line-style');
        const pStart = this.modalEl.querySelector('#dlg-path-arrow-start');
        const pEnd = this.modalEl.querySelector('#dlg-path-arrow-end');

        if (pCol) pCol.addEventListener('input', () => { d.line.color = pCol.value; liveUpdate(); });
        if (pOp) pOp.addEventListener('input', () => {
          d.line.opacity = parseInt(pOp.value) / 100;
          if (pOpVal) pOpVal.textContent = `${pOp.value}%`;
          liveUpdate();
        });
        if (pWid) pWid.addEventListener('change', () => { d.line.width = parseInt(pWid.value); liveUpdate(); });
        if (pSty) pSty.addEventListener('change', () => { d.line.style = pSty.value; liveUpdate(); });
        if (pStart) pStart.addEventListener('change', () => {
          if (!d.arrows) d.arrows = { start: false, end: true };
          d.arrows.start = pStart.checked;
          liveUpdate();
        });
        if (pEnd) pEnd.addEventListener('change', () => {
          if (!d.arrows) d.arrows = { start: false, end: true };
          d.arrows.end = pEnd.checked;
          liveUpdate();
        });
        return;
      }

      if (d.type === 'horizontalRay') {
        const rCol = this.modalEl.querySelector('#dlg-ray-line-color');
        const rOp = this.modalEl.querySelector('#dlg-ray-line-opacity');
        const rOpVal = this.modalEl.querySelector('#dlg-ray-line-opacity-val');
        const rWid = this.modalEl.querySelector('#dlg-ray-line-width');
        const rSty = this.modalEl.querySelector('#dlg-ray-line-style');
        const rPrice = this.modalEl.querySelector('#dlg-ray-price-label');

        if (rCol) rCol.addEventListener('input', () => { d.line.color = rCol.value; liveUpdate(); });
        if (rOp) rOp.addEventListener('input', () => {
          d.line.opacity = parseInt(rOp.value) / 100;
          if (rOpVal) rOpVal.textContent = `${rOp.value}%`;
          liveUpdate();
        });
        if (rWid) rWid.addEventListener('change', () => { d.line.width = parseInt(rWid.value); liveUpdate(); });
        if (rSty) rSty.addEventListener('change', () => { d.line.style = rSty.value; liveUpdate(); });
        if (rPrice) rPrice.addEventListener('change', () => {
          if (!d.priceLabel) d.priceLabel = { visible: true };
          d.priceLabel.visible = rPrice.checked;
          liveUpdate();
        });
        return;
      }

      if (d.type === 'priceRange') {
        const lCol = this.modalEl.querySelector('#dlg-pr-line-color');
        const lWid = this.modalEl.querySelector('#dlg-pr-line-width');
        const lOp = this.modalEl.querySelector('#dlg-pr-line-opacity');
        const lOpVal = this.modalEl.querySelector('#dlg-pr-line-opacity-val');

        if (lCol) lCol.addEventListener('input', () => { d.line.color = lCol.value; liveUpdate(); });
        if (lWid) lWid.addEventListener('change', () => { d.line.width = parseInt(lWid.value); liveUpdate(); });
        if (lOp) lOp.addEventListener('input', () => {
          d.line.opacity = parseInt(lOp.value) / 100;
          if (lOpVal) lOpVal.textContent = `${lOp.value}%`;
          liveUpdate();
        });

        const bVis = this.modalEl.querySelector('#dlg-pr-border-vis');
        const bCol = this.modalEl.querySelector('#dlg-pr-border-color');
        const bWid = this.modalEl.querySelector('#dlg-pr-border-width');
        const bSty = this.modalEl.querySelector('#dlg-pr-border-style');

        if (bVis) bVis.addEventListener('change', () => { d.border.visible = bVis.checked; liveUpdate(); });
        if (bCol) bCol.addEventListener('input', () => { d.border.color = bCol.value; liveUpdate(); });
        if (bWid) bWid.addEventListener('change', () => { d.border.width = parseInt(bWid.value); liveUpdate(); });
        if (bSty) bSty.addEventListener('change', () => { d.border.style = bSty.value; liveUpdate(); });

        const bgVis = this.modalEl.querySelector('#dlg-pr-bg-vis');
        const bgCol = this.modalEl.querySelector('#dlg-pr-bg-color');
        const bgOp = this.modalEl.querySelector('#dlg-pr-bg-opacity');
        const bgOpVal = this.modalEl.querySelector('#dlg-pr-bg-opacity-val');

        if (bgVis) bgVis.addEventListener('change', () => { d.background.visible = bgVis.checked; liveUpdate(); });
        if (bgCol) bgCol.addEventListener('input', () => { d.background.color = bgCol.value; liveUpdate(); });
        if (bgOp) bgOp.addEventListener('input', () => {
          d.background.opacity = parseInt(bgOp.value) / 100;
          if (bgOpVal) bgOpVal.textContent = `${bgOp.value}%`;
          liveUpdate();
        });

        const extH = this.modalEl.querySelector('#dlg-pr-extend');
        if (extH) extH.addEventListener('change', () => { d.extendHorizontally = extH.checked; liveUpdate(); });

        const sPrice = this.modalEl.querySelector('#dlg-pr-stat-price');
        const sPct = this.modalEl.querySelector('#dlg-pr-stat-pct');
        const sPips = this.modalEl.querySelector('#dlg-pr-stat-pips');

        if (sPrice) sPrice.addEventListener('change', () => { d.stats.priceRange = sPrice.checked; liveUpdate(); });
        if (sPct) sPct.addEventListener('change', () => { d.stats.percentChange = sPct.checked; liveUpdate(); });
        if (sPips) sPips.addEventListener('change', () => { d.stats.pips = sPips.checked; liveUpdate(); });

        const lblCol = this.modalEl.querySelector('#dlg-pr-lbl-color');
        const lblSize = this.modalEl.querySelector('#dlg-pr-lbl-size');
        const lblOp = this.modalEl.querySelector('#dlg-pr-lbl-opacity');
        const lblOpVal = this.modalEl.querySelector('#dlg-pr-lbl-opacity-val');

        if (lblCol) lblCol.addEventListener('input', () => { d.label.color = lblCol.value; liveUpdate(); });
        if (lblSize) lblSize.addEventListener('change', () => { d.label.size = parseInt(lblSize.value); liveUpdate(); });
        if (lblOp) lblOp.addEventListener('input', () => {
          d.label.opacity = parseInt(lblOp.value) / 100;
          if (lblOpVal) lblOpVal.textContent = `${lblOp.value}%`;
          liveUpdate();
        });

        const lblBgVis = this.modalEl.querySelector('#dlg-pr-lbl-bg-vis');
        const lblBgCol = this.modalEl.querySelector('#dlg-pr-lbl-bg-color');
        const lblBgOp = this.modalEl.querySelector('#dlg-pr-lbl-bg-opacity');
        const lblBgOpVal = this.modalEl.querySelector('#dlg-pr-lbl-bg-opacity-val');

        if (lblBgVis) lblBgVis.addEventListener('change', () => { d.label.background.visible = lblBgVis.checked; liveUpdate(); });
        if (lblBgCol) lblBgCol.addEventListener('input', () => { d.label.background.color = lblBgCol.value; liveUpdate(); });
        if (lblBgOp) lblBgOp.addEventListener('input', () => {
          d.label.background.opacity = parseInt(lblBgOp.value) / 100;
          if (lblBgOpVal) lblBgOpVal.textContent = `${lblBgOp.value}%`;
          liveUpdate();
        });
        return;
      }

      const bVis = this.modalEl.querySelector('#dlg-border-vis');
      const bCol = this.modalEl.querySelector('#dlg-border-color');
      const bWid = this.modalEl.querySelector('#dlg-border-width');
      const bSty = this.modalEl.querySelector('#dlg-border-style');

      if (bVis) bVis.addEventListener('change', () => { d.border.visible = bVis.checked; liveUpdate(); });
      if (bCol) bCol.addEventListener('input', () => { d.border.color = bCol.value; liveUpdate(); });
      if (bWid) bWid.addEventListener('change', () => { d.border.width = parseInt(bWid.value); liveUpdate(); });
      if (bSty) bSty.addEventListener('change', () => { d.border.style = bSty.value; liveUpdate(); });

      const mEn = this.modalEl.querySelector('#dlg-mid-enabled');
      const mCol = this.modalEl.querySelector('#dlg-mid-color');
      const mOp = this.modalEl.querySelector('#dlg-mid-opacity');
      const mOpVal = this.modalEl.querySelector('#dlg-mid-opacity-val');
      const mWid = this.modalEl.querySelector('#dlg-mid-width');
      const mSty = this.modalEl.querySelector('#dlg-mid-style');

      if (mEn) {
        mEn.addEventListener('change', () => { d.middleLine.enabled = mEn.checked; liveUpdate(); });
        mCol.addEventListener('input', () => { d.middleLine.color = mCol.value; liveUpdate(); });
        mOp.addEventListener('input', () => {
          d.middleLine.opacity = parseInt(mOp.value) / 100;
          mOpVal.textContent = `${mOp.value}%`;
          liveUpdate();
        });
        mWid.addEventListener('change', () => { d.middleLine.width = parseInt(mWid.value); liveUpdate(); });
        mSty.addEventListener('change', () => { d.middleLine.style = mSty.value; liveUpdate(); });
      }

      const bgVis = this.modalEl.querySelector('#dlg-bg-vis');
      const bgCol = this.modalEl.querySelector('#dlg-bg-color');
      const bgOp = this.modalEl.querySelector('#dlg-bg-opacity');
      const bgOpVal = this.modalEl.querySelector('#dlg-bg-opacity-val');

      if (bgVis) bgVis.addEventListener('change', () => { d.background.visible = bgVis.checked; liveUpdate(); });
      if (bgCol) bgCol.addEventListener('input', () => { d.background.color = bgCol.value; liveUpdate(); });
      if (bgOp) bgOp.addEventListener('input', () => {
        d.background.opacity = parseInt(bgOp.value) / 100;
        bgOpVal.textContent = `${bgOp.value}%`;
        liveUpdate();
      });

      const rectExtL = this.modalEl.querySelector('#dlg-extend-left');
      const rectExtR = this.modalEl.querySelector('#dlg-extend-right');

      if (rectExtL) {
        rectExtL.addEventListener('change', () => { d.extendLeft = rectExtL.checked; liveUpdate(); });
      }
      if (rectExtR) {
        rectExtR.addEventListener('change', () => { d.extendRight = rectExtR.checked; liveUpdate(); });
      }
    }

    if (this.activeTab === 'text') {
      const enCheck = this.modalEl.querySelector('#dlg-ray-text-enabled');
      if (enCheck) {
        enCheck.addEventListener('change', () => {
          d.text.enabled = enCheck.checked;
          liveUpdate();
        });
      }

      const textOp = this.modalEl.querySelector('#dlg-ray-text-opacity');
      const textOpVal = this.modalEl.querySelector('#dlg-ray-text-opacity-val');
      if (textOp) {
        textOp.addEventListener('input', () => {
          d.text.opacity = parseInt(textOp.value) / 100;
          if (textOpVal) textOpVal.textContent = `${textOp.value}%`;
          liveUpdate();
        });
      }

      const content = this.modalEl.querySelector('#dlg-text-content');
      const color = this.modalEl.querySelector('#dlg-text-color');
      const size = this.modalEl.querySelector('#dlg-text-size');
      const boldBtn = this.modalEl.querySelector('#dlg-text-bold');
      const italicBtn = this.modalEl.querySelector('#dlg-text-italic');
      const hAlign = this.modalEl.querySelector('#dlg-text-halign');
      const vAlign = this.modalEl.querySelector('#dlg-text-valign');
      const placement = this.modalEl.querySelector('#dlg-text-placement');

      if (content) content.addEventListener('input', () => { d.text.content = content.value; liveUpdate(); });
      if (color) color.addEventListener('input', () => { d.text.color = color.value; liveUpdate(); });
      if (size) size.addEventListener('change', () => { d.text.size = parseInt(size.value); liveUpdate(); });

      if (boldBtn) {
        boldBtn.addEventListener('click', () => {
          d.text.bold = !d.text.bold;
          boldBtn.classList.toggle('active', d.text.bold);
          liveUpdate();
        });
      }
      if (italicBtn) {
        italicBtn.addEventListener('click', () => {
          d.text.italic = !d.text.italic;
          italicBtn.classList.toggle('active', d.text.italic);
          liveUpdate();
        });
      }

      if (hAlign) hAlign.addEventListener('change', () => { d.text.hAlign = hAlign.value; liveUpdate(); });
      if (vAlign) vAlign.addEventListener('change', () => { d.text.vAlign = vAlign.value; liveUpdate(); });
      if (placement) {
        placement.addEventListener('change', () => { d.text.placement = placement.value; liveUpdate(); });
      }
    }

    if (this.activeTab === 'coordinates') {
      // Position Tools Coordinates bindings
      const posEntryInput = this.modalEl.querySelector('#dlg-pos-coord-entry');
      const posTargetInput = this.modalEl.querySelector('#dlg-pos-coord-target');
      const posStopInput = this.modalEl.querySelector('#dlg-pos-coord-stop');
      const posL1Input = this.modalEl.querySelector('#dlg-pos-coord-l1');
      const posL2Input = this.modalEl.querySelector('#dlg-pos-coord-l2');

      if (posEntryInput) posEntryInput.addEventListener('input', () => {
        const val = parseFloat(posEntryInput.value);
        if (!isNaN(val)) { d.entryPrice = val; liveUpdate(); }
      });
      if (posTargetInput) posTargetInput.addEventListener('input', () => {
        const val = parseFloat(posTargetInput.value);
        if (!isNaN(val)) { d.targetPrice = val; liveUpdate(); }
      });
      if (posStopInput) posStopInput.addEventListener('input', () => {
        const val = parseFloat(posStopInput.value);
        if (!isNaN(val)) { d.stopPrice = val; liveUpdate(); }
      });
      if (posL1Input) posL1Input.addEventListener('input', () => {
        const val = parseInt(posL1Input.value);
        if (!isNaN(val)) { d.startLogical = val; liveUpdate(); }
      });
      if (posL2Input) posL2Input.addEventListener('input', () => {
        const val = parseInt(posL2Input.value);
        if (!isNaN(val)) { d.endLogical = val; liveUpdate(); }
      });
      if (posEntryInput || posTargetInput) return;

      const p1Input = this.modalEl.querySelector('#dlg-coord-p1');
      const l1Input = this.modalEl.querySelector('#dlg-coord-l1');
      const p2Input = this.modalEl.querySelector('#dlg-coord-p2');
      const l2Input = this.modalEl.querySelector('#dlg-coord-l2');

      if (d.type === 'path') {
        this.modalEl.querySelectorAll('.dlg-path-coord-price').forEach(input => {
          input.addEventListener('input', () => {
            const idx = parseInt(input.getAttribute('data-idx'));
            const val = parseFloat(input.value);
            if (!isNaN(val) && d.points[idx]) {
              d.points[idx].price = val;
              liveUpdate();
            }
          });
        });
        this.modalEl.querySelectorAll('.dlg-path-coord-logical').forEach(input => {
          input.addEventListener('input', () => {
            const idx = parseInt(input.getAttribute('data-idx'));
            const val = parseInt(input.value);
            if (!isNaN(val) && d.points[idx]) {
              d.points[idx].logical = val;
              liveUpdate();
            }
          });
        });
        return;
      }

      const singlePriceInput = this.modalEl.querySelector('#dlg-coord-single-price');
      const singleBarInput = this.modalEl.querySelector('#dlg-coord-single-bar');
      if (singlePriceInput) {
        singlePriceInput.addEventListener('input', () => {
          const val = parseFloat(singlePriceInput.value);
          if (!isNaN(val)) {
            if (d.point) d.point.price = val;
            if (d.points?.[0]) d.points[0].price = val;
            liveUpdate();
          }
        });
      }
      if (singleBarInput) {
        singleBarInput.addEventListener('input', () => {
          const val = parseInt(singleBarInput.value);
          if (!isNaN(val)) {
            if (d.point) d.point.logical = val;
            if (d.points?.[0]) d.points[0].logical = val;
            liveUpdate();
          }
        });
      }

      if (d.type === 'horizontalRay') {
        const updateRayCoords = () => {
          const pt = d.point || d.points[0];
          if (p1Input && !isNaN(parseFloat(p1Input.value))) pt.price = parseFloat(p1Input.value);
          if (l1Input && !isNaN(parseInt(l1Input.value))) pt.logical = parseInt(l1Input.value);
          liveUpdate();
        };
        if (p1Input) p1Input.addEventListener('input', updateRayCoords);
        if (l1Input) l1Input.addEventListener('input', updateRayCoords);
      } else {
        const updateCoords = () => {
          if (p1Input && !isNaN(parseFloat(p1Input.value))) d.points[0].price = parseFloat(p1Input.value);
          if (l1Input && !isNaN(parseInt(l1Input.value))) d.points[0].logical = parseInt(l1Input.value);
          if (p2Input && !isNaN(parseFloat(p2Input.value))) d.points[1].price = parseFloat(p2Input.value);
          if (l2Input && !isNaN(parseInt(l2Input.value))) d.points[1].logical = parseInt(l2Input.value);
          if (typeof d.normalize === 'function') d.normalize();
          liveUpdate();
        };

        if (p1Input) p1Input.addEventListener('input', updateCoords);
        if (l1Input) l1Input.addEventListener('input', updateCoords);
        if (p2Input) p2Input.addEventListener('input', updateCoords);
        if (l2Input) l2Input.addEventListener('input', updateCoords);
      }
    }

    if (this.activeTab === 'visibility') {
      this.modalEl.querySelectorAll('.dlg-tf-check').forEach(chk => {
        chk.addEventListener('change', () => {
          const tf = chk.getAttribute('data-tf');
          if (!d.visibility) d.visibility = {};
          d.visibility[tf] = chk.checked;
          liveUpdate();
        });
      });

      const allBtn = this.modalEl.querySelector('#dlg-tf-all');
      const noneBtn = this.modalEl.querySelector('#dlg-tf-none');

      allBtn.addEventListener('click', () => {
        TIMEFRAMES.forEach(tf => { d.visibility[tf] = true; });
        this.modalEl.querySelectorAll('.dlg-tf-check').forEach(c => { c.checked = true; });
        liveUpdate();
      });

      noneBtn.addEventListener('click', () => {
        TIMEFRAMES.forEach(tf => { d.visibility[tf] = false; });
        this.modalEl.querySelectorAll('.dlg-tf-check').forEach(c => { c.checked = false; });
        liveUpdate();
      });
    }
  }
}
