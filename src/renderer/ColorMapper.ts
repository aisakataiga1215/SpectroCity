import * as THREE from 'three';

export type ColorMode = 'warm-cool' | 'neon' | 'monochrome' | 'terrain';

export class ColorMapper {
  private mode: ColorMode;

  constructor(mode: ColorMode = 'warm-cool') {
    this.mode = mode;
  }

  setMode(mode: ColorMode): void {
    this.mode = mode;
  }

  getColor(binIndex: number, totalBins: number, intensity: number): THREE.Color {
    switch (this.mode) {
      case 'warm-cool': return this.warmCool(binIndex, totalBins, intensity);
      case 'neon': return this.neon(binIndex, totalBins, intensity);
      case 'monochrome': return this.monochrome(intensity);
      case 'terrain': return this.terrain(binIndex, totalBins, intensity);
    }
  }

  private warmCool(binIndex: number, totalBins: number, intensity: number): THREE.Color {
    const hue = (1 - binIndex / totalBins) * 0.75;
    const lightness = 0.15 + intensity * 0.65;
    const color = new THREE.Color();
    color.setHSL(hue, 0.8, lightness);
    return color;
  }

  private neon(binIndex: number, totalBins: number, intensity: number): THREE.Color {
    const hue = (1 - binIndex / totalBins) * 0.85;
    const color = new THREE.Color();
    color.setHSL(hue, 1.0, 0.1 + intensity * 0.7);
    return color;
  }

  private monochrome(intensity: number): THREE.Color {
    const l = 0.05 + intensity * 0.8;
    const color = new THREE.Color();
    color.setHSL(0.6, 0.15, l);
    return color;
  }

  private terrain(binIndex: number, totalBins: number, intensity: number): THREE.Color {
    // Low freq = dark green → high freq = white (snow)
    const t = binIndex / totalBins;
    const color = new THREE.Color();
    if (t < 0.33) {
      color.lerpColors(
        new THREE.Color(0x0d2e0d),
        new THREE.Color(0x3a7a3a),
        t / 0.33
      );
    } else if (t < 0.66) {
      color.lerpColors(
        new THREE.Color(0x3a7a3a),
        new THREE.Color(0x8a7a5a),
        (t - 0.33) / 0.33
      );
    } else {
      color.lerpColors(
        new THREE.Color(0x8a7a5a),
        new THREE.Color(0xe0e0e0),
        (t - 0.66) / 0.34
      );
    }
    const l = 0.12 + intensity * 0.55;
    color.multiplyScalar(l / Math.max(color.r, color.g, color.b, 0.01) * 1.2);
    return color;
  }
}
