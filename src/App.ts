import { CityScene } from './renderer/CityScene';
import { CityMesh, NormalizedGrid } from './renderer/CityMesh';
import { ColorMapper, ColorMode } from './renderer/ColorMapper';
import { loadAudioFile, AudioData } from './audio/AudioLoader';
import { SpectrogramData } from './data/SpectrogramData';
import { decimateToLogBins, decimateTime } from './data/Decimator';
import { processNorm } from './data/Normalizer';
import { applyCityLayout } from './renderer/CityLayout';
import { exportGLB } from './renderer/ModelExporter';
import { FileDropZone } from './ui/FileDropZone';
import { LoadingOverlay } from './ui/LoadingOverlay';
import { ControlPanel } from './ui/ControlPanel';
import { InfoOverlay } from './ui/InfoOverlay';
import { bus } from './utils/EventBus';
import {
  WINDOW_SIZE,
  PROGRESS_INTERVAL,
  DEBOUNCE_MS,
  DEFAULT_TIME_RESOLUTION,
  DEFAULT_FREQ_BANDS,
  DEFAULT_DB_FLOOR,
  DEFAULT_HEIGHT_SCALE,
  DEFAULT_BUILDING_THRESHOLD,
} from './utils/constants';

export class App {
  private cityScene: CityScene;
  private cityMesh: CityMesh;
  private colorMapper: ColorMapper;
  private fileDropZone: FileDropZone;
  private loadingOverlay: LoadingOverlay;
  private controlPanel: ControlPanel;
  private infoOverlay: InfoOverlay;
  private worker: Worker | null = null;

  // Processing params (heavy)
  private timeResolution = DEFAULT_TIME_RESOLUTION;
  private freqBands = DEFAULT_FREQ_BANDS;
  private dbFloor = DEFAULT_DB_FLOOR;

  // Render params (lightweight)
  private heightScale = DEFAULT_HEIGHT_SCALE;
  private threshold = DEFAULT_BUILDING_THRESHOLD;
  private colorMode: ColorMode = 'warm-cool';

  // State
  private normalizedGrid: NormalizedGrid | null = null;
  private audioData: AudioData | null = null;
  private spectrogram: SpectrogramData | null = null;
  private heavyDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.cityScene = new CityScene(container);
    this.colorMapper = new ColorMapper(this.colorMode);
    this.cityMesh = new CityMesh(this.colorMapper);

    this.fileDropZone = new FileDropZone(container);
    this.loadingOverlay = new LoadingOverlay(container);
    this.infoOverlay = new InfoOverlay(container);
    this.controlPanel = new ControlPanel(container);

    this.setupEventListeners();
    this.initWorker();
  }

  private initWorker(): void {
    this.worker = new Worker(
      new URL('./audio/stft.worker.ts', import.meta.url),
      { type: 'module' },
    );
    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        this.loadingOverlay.setProgress(msg.frame / msg.numFrames);
      } else if (msg.type === 'complete') {
        this.handleSpectrogram({
          data: msg.spectrogram,
          numFrames: msg.numFrames,
          numBins: msg.numBins,
          sampleRate: msg.sampleRate,
          durationSec: msg.durationSec,
          windowSize: msg.windowSize,
          hopSize: msg.hopSize,
        });
      }
    };
    this.worker.onerror = () => {
      this.loadingOverlay.hide();
      this.fileDropZone.show();
    };
  }

  private setupEventListeners(): void {
    bus.on('file:selected', (file: File) => this.handleFile(file));

    bus.on('panel:height-scale', (v: number) => {
      this.heightScale = v;
      this.cityMesh.updateHeights(v);
    });

    bus.on('panel:threshold', (v: number) => {
      this.threshold = v;
      this.cityMesh.updateThreshold(v);
    });

    bus.on('panel:color-mode', (mode: ColorMode) => {
      this.colorMode = mode;
      this.colorMapper.setMode(mode);
      this.cityMesh.updateColors();
    });

    bus.on('panel:time-resolution', (v: number) => this.onHeavyParam('timeResolution', v));
    bus.on('panel:freq-bands', (v: number) => this.onHeavyParam('freqBands', v));
    bus.on('panel:db-floor', (v: number) => this.onHeavyParam('dbFloor', v));

    bus.on('panel:reset-camera', () => this.cityScene.resetCamera());
    bus.on('panel:toggle-auto-rotate', (enabled: boolean) => this.cityScene.setAutoRotate(enabled));
    bus.on('panel:export-glb', () => this.handleExport());
  }

  private onHeavyParam(param: string, value: number): void {
    switch (param) {
      case 'timeResolution': this.timeResolution = value; break;
      case 'freqBands': this.freqBands = value; break;
      case 'dbFloor': this.dbFloor = value; break;
    }
    if (this.heavyDebounceTimer) clearTimeout(this.heavyDebounceTimer);
    this.heavyDebounceTimer = setTimeout(() => {
      if (this.spectrogram) {
        this.reprocess(this.spectrogram);
      }
    }, DEBOUNCE_MS);
  }

  private async handleFile(file: File): Promise<void> {
    this.fileDropZone.hide();
    this.loadingOverlay.show();
    this.loadingOverlay.setProgress(0);
    this.loadingOverlay.setText('Decoding audio...');

    try {
      this.audioData = await loadAudioFile(file);
      this.infoOverlay.show(this.audioData);

      this.loadingOverlay.setText('Computing spectrogram...');

      this.worker!.postMessage({
        type: 'compute',
        samples: this.audioData.samples,
        sampleRate: this.audioData.sampleRate,
        windowSize: WINDOW_SIZE,
        targetFrames: this.timeResolution,
        progressInterval: PROGRESS_INTERVAL,
      }, { transfer: [this.audioData.samples.buffer] });
    } catch (err) {
      this.loadingOverlay.showError(`Failed to load: ${file.name}`);
      this.fileDropZone.show();
    }
  }

  private handleSpectrogram(spec: SpectrogramData): void {
    this.spectrogram = spec;
    this.reprocess(spec);
  }

  private reprocess(spec: SpectrogramData): void {
    this.loadingOverlay.setText('Processing...');
    this.loadingOverlay.setProgress(0.9);

    // Decimate in linear power (log-freq bins + time reduction)
    let decimated = decimateToLogBins(spec, this.freqBands);
    decimated = decimateTime(decimated, this.timeResolution);

    // Convert to dB and normalize
    const norm = processNorm(decimated, this.dbFloor, 0);

    // Build NormalizedGrid
    let grid: NormalizedGrid = {
      intensities: norm.data,
      numTimeBins: norm.numTimeBins,
      numFreqBands: norm.numFreqBands,
    };

    // Apply city layout (streets, blocks, landmarks)
    grid = applyCityLayout(grid);

    this.normalizedGrid = grid;

    // Render
    this.cityMesh.build(grid, this.cityScene.scene);

    const center = this.cityMesh.getSceneCenter();
    this.cityScene.controls.target.set(center.x, 0, center.z);

    this.loadingOverlay.hide();
    this.controlPanel.show();
  }

  private handleExport(): void {
    if (!this.normalizedGrid) return;
    exportGLB(this.normalizedGrid, this.colorMapper, this.heightScale, this.threshold);
  }

  onResize(width: number, height: number): void {
    this.cityScene.resize(width, height);
  }

  dispose(): void {
    this.cityScene.dispose();
    this.cityMesh.dispose();
    this.worker?.terminate();
    this.fileDropZone.dispose();
    this.loadingOverlay.dispose();
    this.controlPanel.dispose();
  }
}
