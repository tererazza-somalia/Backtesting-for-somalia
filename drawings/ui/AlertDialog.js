/**
 * AlertDialog - Create price alerts attached to a specific Rectangle drawing
 */

export class AlertDialog {
  constructor(drawingManager, showToastFn) {
    this.manager = drawingManager;
    this.showToast = showToastFn || console.log;
    this.currentDrawing = null;
    this.overlayEl = null;
    this.modalEl = null;

    this._createDOM();
  }

  _createDOM() {
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'tv-dialog-overlay';
    this.overlayEl.style.display = 'none';

    this.modalEl = document.createElement('div');
    this.modalEl.className = 'tv-dialog-box tv-alert-dialog';
    this.overlayEl.appendChild(this.modalEl);

    document.body.appendChild(this.overlayEl);

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.close();
    });
  }

  open(drawing) {
    if (!drawing) return;
    this.currentDrawing = drawing;
    this._render();
    this.overlayEl.style.display = 'flex';
  }

  close() {
    this.overlayEl.style.display = 'none';
    this.currentDrawing = null;
  }

  _render() {
    const d = this.currentDrawing;
    if (!d) return;

    const sym = this.manager.currentSymbol || 'EURUSD';
    const isRay = d.type === 'horizontalRay';

    let title = '⏰ Create Rectangle Alert';
    let conditionHTML = '';
    let defaultMsg = '';

    if (isRay) {
      const rayPrice = (d.point ? d.point.price : (d.points[0]?.price || 0)).toFixed(4);
      title = '⏰ Create Horizontal Ray Alert';
      defaultMsg = `${sym}: Price crossed Horizontal Ray at ${rayPrice}`;
      conditionHTML = `
        <option value="crossing" selected>Crossing (Price touches ${rayPrice})</option>
        <option value="crossing_up">Crossing Up (Price crosses above ${rayPrice})</option>
        <option value="crossing_down">Crossing Down (Price crosses below ${rayPrice})</option>
      `;
    } else {
      const p1 = Math.max(d.points[0]?.price || 0, d.points[1]?.price || 0).toFixed(4);
      const p2 = Math.min(d.points[0]?.price || 0, d.points[1]?.price || 0).toFixed(4);
      title = '⏰ Create Rectangle Alert';
      defaultMsg = `${sym}: Price action trigger on Rectangle area (${p2} - ${p1})`;
      conditionHTML = `
        <option value="crossing" selected>Crossing (Crosses either top or bottom edge)</option>
        <option value="entering">Entering (Enters into rectangle area)</option>
        <option value="exiting">Exiting (Leaves rectangle area)</option>
      `;
    }

    this.modalEl.innerHTML = `
      <div class="tv-dialog-header">
        <span class="tv-dialog-title">${title}</span>
        <button class="tv-dialog-close" id="alert-close-btn">✕</button>
      </div>

      <div class="tv-dialog-body">
        <div class="tv-form-group">
          <!-- Condition -->
          <div class="tv-form-row-col">
            <label class="tv-form-label">Condition:</label>
            <select id="alert-condition" class="tv-select-full">
              ${conditionHTML}
            </select>
          </div>

          <div class="tv-form-divider"></div>

          <!-- Frequency -->
          <div class="tv-form-row-col">
            <label class="tv-form-label">Frequency:</label>
            <div class="tv-radio-group">
              <label class="tv-radio-wrap">
                <input type="radio" name="alert-freq" value="once" checked />
                <span>Only Once</span>
              </label>
              <label class="tv-radio-wrap" style="margin-left: 20px;">
                <input type="radio" name="alert-freq" value="every" />
                <span>Every Time</span>
              </label>
            </div>
          </div>

          <div class="tv-form-divider"></div>

          <!-- Notifications -->
          <div class="tv-form-row-col">
            <label class="tv-form-label">Notification Method:</label>
            <div class="tv-checkbox-col">
              <label class="tv-checkbox-wrap">
                <input type="checkbox" id="alert-notify-toast" checked />
                <span>Show In-App Toast & Popup</span>
              </label>
              <label class="tv-checkbox-wrap" style="margin-top: 6px;">
                <input type="checkbox" id="alert-notify-sound" checked />
                <span>Play Sound Beep</span>
              </label>
            </div>
          </div>

          <div class="tv-form-divider"></div>

          <!-- Message -->
          <div class="tv-form-row-col">
            <label class="tv-form-label">Message:</label>
            <textarea id="alert-message" class="tv-textarea" rows="2">${defaultMsg}</textarea>
          </div>
        </div>
      </div>

      <div class="tv-dialog-footer">
        <div></div>
        <div class="tv-dialog-footer-actions">
          <button class="tv-btn tv-dialog-cancel" id="alert-cancel-btn">Cancel</button>
          <button class="tv-btn tv-dialog-ok" id="alert-create-btn">Create</button>
        </div>
      </div>
    `;

    this.modalEl.querySelector('#alert-close-btn').addEventListener('click', () => this.close());
    this.modalEl.querySelector('#alert-cancel-btn').addEventListener('click', () => this.close());

    this.modalEl.querySelector('#alert-create-btn').addEventListener('click', () => {
      const cond = this.modalEl.querySelector('#alert-condition').value;
      const freq = this.modalEl.querySelector('input[name="alert-freq"]:checked').value;
      const notifyToast = this.modalEl.querySelector('#alert-notify-toast').checked;
      const notifySound = this.modalEl.querySelector('#alert-notify-sound').checked;
      const msg = this.modalEl.querySelector('#alert-message').value;

      this.manager.createAlert({
        id: 'alt_' + Date.now(),
        drawingId: d.id,
        symbol: sym,
        condition: cond,
        frequency: freq,
        notifyToast,
        notifySound,
        message: msg,
        createdAt: Date.now(),
      });

      const label = isRay ? 'Horizontal Ray' : 'Rectangle';
      this.showToast(`⏰ Alert created: ${cond.toUpperCase()} on ${label}`);
      this.close();
    });
  }
}
