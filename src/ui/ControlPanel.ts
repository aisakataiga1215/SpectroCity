import { bus } from '../utils/EventBus';
import { ColorMode } from '../renderer/ColorMapper';
import {
  DEFAULT_TIME_RESOLUTION,
  DEFAULT_FREQ_BANDS,
  DEFAULT_DB_FLOOR,
  DEFAULT_HEIGHT_SCALE,
  DEFAULT_BUILDING_THRESHOLD,
  MIN_TIME_RESOLUTION,
  MAX_TIME_RESOLUTION,
  MIN_FREQ_BANDS,
  MAX_FREQ_BANDS,
} from '../utils/constants';

export class ControlPanel {
  private el: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'control-panel hidden';
    this.el.innerHTML = this.buildHTML();
    parent.appendChild(this.el);

    this.bindEvents();
    // Hide weight param section initially (only shown after first load)
    const weightSection = this.el.querySelector('[data-section="heavy"]');
    if (weightSection) weightSection.classList.add('hidden');
  }

  private buildHTML(): string {
    return `
      <div class="control-panel__section" data-section="light">
        <div class="control-panel__section-title">Display</div>
        <div class="control-panel__row">
          <label>Height Scale</label>
          <input type="range" id="cp-height-scale" min="0.5" max="3" step="0.1" value="${DEFAULT_HEIGHT_SCALE}">
          <span class="value-label" id="cp-height-scale-val">${DEFAULT_HEIGHT_SCALE}x</span>
        </div>
        <div class="control-panel__row">
          <label>Threshold</label>
          <input type="range" id="cp-threshold" min="0" max="0.5" step="0.01" value="${DEFAULT_BUILDING_THRESHOLD}">
          <span class="value-label" id="cp-threshold-val">${DEFAULT_BUILDING_THRESHOLD}</span>
        </div>
        <div class="control-panel__row">
          <label>Color Mode</label>
          <select id="cp-color-mode">
            <option value="warm-cool">Warm-Cool</option>
            <option value="neon">Neon</option>
            <option value="monochrome">Monochrome</option>
            <option value="terrain">Terrain</option>
          </select>
        </div>
      </div>
      <div class="control-panel__section" data-section="heavy">
        <div class="control-panel__section-title">Processing (triggers reprocess)</div>
        <div class="control-panel__row">
          <label>Time Res</label>
          <input type="range" id="cp-time-res" min="${MIN_TIME_RESOLUTION}" max="${MAX_TIME_RESOLUTION}" step="10" value="${DEFAULT_TIME_RESOLUTION}">
          <span class="value-label" id="cp-time-res-val">${DEFAULT_TIME_RESOLUTION}</span>
        </div>
        <div class="control-panel__row">
          <label>Freq Bands</label>
          <input type="range" id="cp-freq-bands" min="${MIN_FREQ_BANDS}" max="${MAX_FREQ_BANDS}" step="4" value="${DEFAULT_FREQ_BANDS}">
          <span class="value-label" id="cp-freq-bands-val">${DEFAULT_FREQ_BANDS}</span>
        </div>
        <div class="control-panel__row">
          <label>dB Floor</label>
          <input type="range" id="cp-db-floor" min="-120" max="-40" step="2" value="${DEFAULT_DB_FLOOR}">
          <span class="value-label" id="cp-db-floor-val">${DEFAULT_DB_FLOOR}</span>
        </div>
      </div>
      <div class="control-panel__section">
        <div class="control-panel__row">
          <label>Auto-Rotate</label>
          <input type="checkbox" id="cp-auto-rotate">
        </div>
      </div>
      <button class="control-panel__btn" id="cp-reset-camera">Reset Camera</button>
      <button class="control-panel__btn" id="cp-export-glb" style="margin-top:6px">Export GLB</button>
    `;
  }

  private bindEvents(): void {
    // Lightweight params — real-time updates
    this.bindSlider('cp-height-scale', 'cp-height-scale-val', (v) => {
      bus.emit('panel:height-scale', v);
    }, 'x');

    this.bindSlider('cp-threshold', 'cp-threshold-val', (v) => {
      bus.emit('panel:threshold', v);
    });

    const colorSelect = this.el.querySelector('#cp-color-mode') as HTMLSelectElement;
    colorSelect.addEventListener('change', () => {
      bus.emit('panel:color-mode', colorSelect.value as ColorMode);
    });

    // Heavy params — debounced in App.ts
    this.bindSlider('cp-time-res', 'cp-time-res-val', (v) => {
      bus.emit('panel:time-resolution', v);
    });

    this.bindSlider('cp-freq-bands', 'cp-freq-bands-val', (v) => {
      bus.emit('panel:freq-bands', v);
    });

    this.bindSlider('cp-db-floor', 'cp-db-floor-val', (v) => {
      bus.emit('panel:db-floor', v);
    });

    const autoRotate = this.el.querySelector('#cp-auto-rotate') as HTMLInputElement;
    autoRotate.addEventListener('change', () => {
      bus.emit('panel:toggle-auto-rotate', autoRotate.checked);
    });

    this.el.querySelector('#cp-reset-camera')!.addEventListener('click', () => {
      bus.emit('panel:reset-camera');
    });

    this.el.querySelector('#cp-export-glb')!.addEventListener('click', () => {
      bus.emit('panel:export-glb');
    });
  }

  private bindSlider(
    sliderId: string,
    labelId: string,
    onChange: (v: number) => void,
    suffix = '',
  ): void {
    const slider = this.el.querySelector(`#${sliderId}`) as HTMLInputElement;
    const label = this.el.querySelector(`#${labelId}`)!;
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      label.textContent = v + suffix;
      onChange(v);
    });
  }

  show(): void {
    this.el.classList.remove('hidden');
    const heavySection = this.el.querySelector('[data-section="heavy"]');
    if (heavySection) heavySection.classList.remove('hidden');
  }

  dispose(): void {
    this.el.remove();
  }
}
