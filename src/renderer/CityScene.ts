import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { configureLighting } from './Lighting';
import { createGroundPlane } from './GroundPlane';

export class CityScene {
  readonly scene: THREE.Scene;
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private animId = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      1,
      500,
    );
    this.camera.position.set(40, 30, 50);
    this.camera.lookAt(20, 0, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 200;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.target.set(20, 0, 15);

    configureLighting(this.scene);
    createGroundPlane(this.scene);

    this.startLoop();
  }

  private startLoop(): void {
    const animate = (): void => {
      this.animId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setAutoRotate(enabled: boolean): void {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 0.3;
  }

  resetCamera(): void {
    this.camera.position.set(40, 30, 50);
    this.camera.lookAt(20, 0, 10);
    this.controls.target.set(20, 0, 15);
    this.controls.update();
  }

  dispose(): void {
    cancelAnimationFrame(this.animId);
    this.renderer.dispose();
  }
}
