import * as THREE from 'three';

export function createGroundPlane(scene: THREE.Scene): void {
  const geom = new THREE.PlaneGeometry(500, 500);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x08081a,
    roughness: 0.9,
    metalness: 0.1,
  });
  const plane = new THREE.Mesh(geom, mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = 0;
  plane.receiveShadow = true;
  scene.add(plane);

  const grid = new THREE.GridHelper(500, 500, 0x1a1a3a, 0x111128);
  grid.position.y = 0.01;
  scene.add(grid);
}
