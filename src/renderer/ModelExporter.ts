import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import * as THREE from 'three';
import { NormalizedGrid } from './CityMesh';
import { ColorMapper } from './ColorMapper';
import { buildMergedGeometry, createExportMaterial } from './ExportMeshBuilder';

export async function exportGLB(
  grid: NormalizedGrid,
  colorMapper: ColorMapper,
  heightScale: number,
  threshold: number,
): Promise<void> {
  const geometry = buildMergedGeometry(grid, colorMapper, heightScale, threshold);
  if (!geometry) {
    alert('No buildings to export (all below threshold).');
    return;
  }

  const material = createExportMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  const scene = new THREE.Scene();
  scene.add(mesh);

  const exporter = new GLTFExporter();
  const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          // result is JSON, convert to blob
          const json = JSON.stringify(result);
          const blob = new Blob([json], { type: 'application/json' });
          blob.arrayBuffer().then(resolve).catch(reject);
        }
      },
      (err) => reject(err),
      { binary: true, embedImages: false },
    );
  });

  // Trigger download
  const blob = new Blob([glb], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spectrocity.glb';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Clean up
  geometry.dispose();
  material.dispose();
}
