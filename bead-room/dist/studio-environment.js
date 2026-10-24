import * as THREE from './vendor/three.module.js';

const environments=new WeakMap();
export function disposeStudioEnvironment(renderer){const cached=environments.get(renderer);if(cached){cached.target.dispose();environments.delete(renderer);}}

/** A local photographic light tent: bright softboxes and quiet dark reflection cards. */
export function createStudioEnvironment(renderer) {
  const cached=environments.get(renderer);
  if(cached)return{texture:cached.target.texture,dispose(){}};
  const studio = new THREE.Scene();
  const resources = [];
  const panel = (width, height, color, intensity, position, target = [0, 0, 0]) => {
    const geometry = new THREE.PlaneGeometry(width, height);
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    material.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position); mesh.lookAt(...target); studio.add(mesh);
    resources.push(geometry, material);
  };
  // The inward enclosure provides a calm mid-tone between strip reflections.
  const enclosureGeometry = new THREE.BoxGeometry(32, 24, 30);
  const enclosureMaterial = new THREE.MeshBasicMaterial({ color: 0xd3cec4, side: THREE.BackSide });
  enclosureMaterial.color.multiplyScalar(.34);
  studio.add(new THREE.Mesh(enclosureGeometry, enclosureMaterial));
  resources.push(enclosureGeometry, enclosureMaterial);
  panel(8, 12, 0xfff8ec, 3.4, [-9, 4, 4]);
  panel(4, 10, 0xffffff, 2.4, [8, 3, 5]);
  panel(9, 5, 0xfffcf5, 2.7, [0, 10, 0]);
  panel(7, 7, 0xffffff, 1.7, [1, 1, -11]);
  panel(3, 12, 0x242a31, .42, [-5, 1, 10]);
  panel(2, 9, 0x272b31, .42, [6, -1, 10]);
  panel(16, 12, 0xf0e6d2, .75, [0, -9, 0]);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(studio, .055, .1, 80, { size: 256 });
  generator.dispose();
  for (const resource of resources) resource.dispose();
  environments.set(renderer,{target});
  return {texture:target.texture,dispose(){}};
}
