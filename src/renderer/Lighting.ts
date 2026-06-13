import * as THREE from 'three';

export function configureLighting(scene: THREE.Scene): void {
  const ambient = new THREE.AmbientLight(0x222244, 0.5);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0x4466aa, 0x221100, 0.4);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(50, 100, 50);
  dir.castShadow = false;
  scene.add(dir);

  scene.fog = new THREE.FogExp2(0x0a0a1a, 0.00015);
  scene.background = new THREE.Color(0x0a0a1a);
}
