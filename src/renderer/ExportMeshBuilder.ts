// Builds a real merged BufferGeometry from normalized grid data
// Independent of InstancedMesh — used for GLTF/GLB export
// This avoids Blender/Windows 3D Viewer incompatibility with instancing

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NormalizedGrid } from './CityMesh';
import { ColorMapper } from './ColorMapper';

const BUILDING_WIDTH = 0.9;
const BUILDING_DEPTH = 0.9;
const MAX_HEIGHT = 25;

export function buildMergedGeometry(
  grid: NormalizedGrid,
  colorMapper: ColorMapper,
  heightScale: number,
  threshold: number,
): THREE.BufferGeometry | null {
  const boxGeom = new THREE.BoxGeometry(BUILDING_WIDTH, 1, BUILDING_DEPTH);
  const geometries: THREE.BufferGeometry[] = [];

  const dummy = new THREE.Object3D();

  for (let t = 0; t < grid.numTimeBins; t++) {
    const x = t * 1.2;
    for (let f = 0; f < grid.numFreqBands; f++) {
      const intensity = grid.intensities[t * grid.numFreqBands + f];
      if (intensity < threshold) continue;

      const h = intensity * heightScale * MAX_HEIGHT;
      const z = (grid.numFreqBands - 1 - f) * 1.2;

      dummy.position.set(x, 0, z);
      dummy.scale.set(1, Math.max(h, 0.05), 1);
      dummy.updateMatrix();

      const instGeom = boxGeom.clone();
      instGeom.applyMatrix4(dummy.matrix);

      // Assign color per vertex
      const color = colorMapper.getColor(f, grid.numFreqBands, intensity);
      const colors = new Float32Array(instGeom.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
      instGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      geometries.push(instGeom);
    }
  }

  if (geometries.length === 0) return null;

  const merged = mergeGeometries(geometries, false);

  // Clean up temporary geometries
  geometries.forEach(g => g.dispose());
  boxGeom.dispose();

  return merged;
}

export function createExportMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    roughness: 0.6,
    metalness: 0.15,
    vertexColors: true,
  });
}
