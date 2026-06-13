import * as THREE from 'three';
import { ColorMapper } from './ColorMapper';

export interface NormalizedGrid {
  intensities: Float32Array; // flat, row-major: [timeBin * numBands + freqBand]
  numTimeBins: number;
  numFreqBands: number;
}

const BUILDING_WIDTH = 0.9;
const BUILDING_DEPTH = 0.9;
const TIME_SPACING = 1.2;
const BAND_SPACING = 1.2;
const MAX_HEIGHT = 25;

export class CityMesh {
  private mesh: THREE.InstancedMesh | null = null;
  private geometry: THREE.BoxGeometry;
  private material: THREE.MeshStandardMaterial;
  private grid: NormalizedGrid | null = null;
  private heightScale = 1.5;
  private threshold = 0.1;
  private colorMapper: ColorMapper;

  constructor(colorMapper: ColorMapper) {
    this.colorMapper = colorMapper;
    this.geometry = new THREE.BoxGeometry(BUILDING_WIDTH, 1, BUILDING_DEPTH);
    this.geometry.translate(0, 0.5, 0);
    this.material = new THREE.MeshStandardMaterial({
      roughness: 0.6,
      metalness: 0.15,
    });
  }

  build(grid: NormalizedGrid, scene: THREE.Scene): void {
    this.grid = grid;
    const total = grid.numTimeBins * grid.numFreqBands;
    const maxCount = grid.numTimeBins * grid.numFreqBands;

    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.dispose();
    }

    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, maxCount);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let idx = 0;

    for (let t = 0; t < grid.numTimeBins; t++) {
      const x = t * TIME_SPACING;
      for (let f = 0; f < grid.numFreqBands; f++) {
        const intensity = grid.intensities[t * grid.numFreqBands + f];
        const z = (grid.numFreqBands - 1 - f) * BAND_SPACING;

        if (intensity < this.threshold) {
          dummy.scale.set(1, 1e-6, 1);
        } else {
          const h = intensity * this.heightScale * MAX_HEIGHT;
          dummy.scale.set(1, Math.max(h, 0.05), 1);
        }
        dummy.position.set(x, 0, z);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, dummy.matrix);

        this.colorMapper.getColor(f, grid.numFreqBands, intensity);
        color.copy(this.colorMapper.getColor(f, grid.numFreqBands, intensity));
        this.mesh.setColorAt(idx, color);

        idx++;
      }
    }

    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    scene.add(this.mesh);
  }

  updateHeights(heightScale: number): void {
    this.heightScale = heightScale;
    if (!this.mesh || !this.grid) return;
    const dummy = new THREE.Object3D();
    for (let t = 0; t < this.grid.numTimeBins; t++) {
      const x = t * TIME_SPACING;
      for (let f = 0; f < this.grid.numFreqBands; f++) {
        const intensity = this.grid.intensities[t * this.grid.numFreqBands + f];
        const idx = t * this.grid.numFreqBands + f;
        const z = (this.grid.numFreqBands - 1 - f) * BAND_SPACING;

        if (intensity < this.threshold) {
          dummy.scale.set(1, 1e-6, 1);
        } else {
          const h = intensity * heightScale * MAX_HEIGHT;
          dummy.scale.set(1, Math.max(h, 0.05), 1);
        }
        dummy.position.set(x, 0, z);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, dummy.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  updateThreshold(threshold: number): void {
    this.threshold = threshold;
    if (!this.mesh || !this.grid) return;
    const dummy = new THREE.Object3D();
    for (let t = 0; t < this.grid.numTimeBins; t++) {
      const x = t * TIME_SPACING;
      for (let f = 0; f < this.grid.numFreqBands; f++) {
        const intensity = this.grid.intensities[t * this.grid.numFreqBands + f];
        const idx = t * this.grid.numFreqBands + f;
        const z = (this.grid.numFreqBands - 1 - f) * BAND_SPACING;

        if (intensity < threshold) {
          dummy.scale.set(1, 1e-6, 1);
        } else {
          const h = intensity * this.heightScale * MAX_HEIGHT;
          dummy.scale.set(1, Math.max(h, 0.05), 1);
        }
        dummy.position.set(x, 0, z);
        dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, dummy.matrix);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  updateColors(): void {
    if (!this.mesh || !this.grid) return;
    for (let t = 0; t < this.grid.numTimeBins; t++) {
      for (let f = 0; f < this.grid.numFreqBands; f++) {
        const intensity = this.grid.intensities[t * this.grid.numFreqBands + f];
        const idx = t * this.grid.numFreqBands + f;
        this.mesh.setColorAt(
          idx,
          this.colorMapper.getColor(f, this.grid.numFreqBands, intensity),
        );
      }
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  getMesh(): THREE.InstancedMesh | null {
    return this.mesh;
  }

  getGrid(): NormalizedGrid | null {
    return this.grid;
  }

  getSceneCenter(): { x: number; z: number } {
    if (!this.grid) return { x: 0, z: 0 };
    return {
      x: (this.grid.numTimeBins * TIME_SPACING) / 2,
      z: (this.grid.numFreqBands * BAND_SPACING) / 2,
    };
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh.dispose();
      this.mesh = null;
    }
  }
}
