import * as THREE from './vendor/three.module.js';

export const ACCESSORY_FINISHES = Object.freeze({
  original: '#c8c4b9', ivory: '#eadfc9', rose: '#c48d99', sage: '#8d9d80', ink: '#414955'
});

const normalizeFinish = value => Object.hasOwn(ACCESSORY_FINISHES, value) ? value : 'original';

/** Accessory finishes retain their substrate: enamel, tinted acrylic, glaze or stained oak. */
export function applyAccessoryFinish(mat, finishId = 'original', kind = 'metal') {
  const selected = normalizeFinish(finishId);
  mat.userData.accessoryFinishId = selected;
  mat.userData.accessoryMaterialKind = kind;
  if (selected === 'original') return mat;
  const tint = new THREE.Color(ACCESSORY_FINISHES[selected]);
  if (kind === 'acrylic') {
    mat.color.set(0xffffff).lerp(tint, .23);
    mat.attenuationColor = tint.clone();
    mat.attenuationDistance = 4.5;
    mat.roughness = .105;
    mat.transmission = .79;
    mat.clearcoat = .88;
  } else if (kind === 'wood') {
    // The grain map supplies the light oak hue; a thin stain keeps it visible.
    mat.color.copy(tint).lerp(new THREE.Color(0xffffff), .22);
    mat.roughness = .47;
    mat.clearcoat = .24;
    mat.clearcoatRoughness = .34;
  } else if (kind === 'ceramic') {
    mat.color.copy(tint);
    mat.roughness = .29;
    mat.clearcoat = .57;
    mat.clearcoatRoughness = .23;
  } else {
    // A thin baked enamel surface rather than unrealistically colored chrome.
    mat.color.copy(tint);
    mat.metalness = .22;
    mat.roughness = .225;
    mat.clearcoat = .93;
    mat.clearcoatRoughness = .14;
    mat.anisotropy = .12;
  }
  mat.needsUpdate = true;
  return mat;
}

export function createAccessoryMaterial(kind, { finishId = 'original', color, ...options } = {}) {
  let defaults;
  switch (kind) {
    case 'acrylic':
      defaults = { color: 0xf5faf7, metalness: 0, roughness: .075, transmission: .86,
        transparent: true, opacity: .86, thickness: .23, ior: 1.49, attenuationDistance: 8,
        attenuationColor: 0xf7faf5, clearcoat: .8, clearcoatRoughness: .09, depthWrite: false };
      break;
    case 'wood':
      defaults = { color: 0xffffff, metalness: 0, roughness: .54, clearcoat: .17, clearcoatRoughness: .40 };
      break;
    case 'ceramic':
      defaults = { color: 0xfffcf3, metalness: 0, roughness: .33, clearcoat: .42, clearcoatRoughness: .25 };
      break;
    default:
      defaults = { color: 0xd6d4ce, metalness: .96, roughness: .205,
        clearcoat: .32, clearcoatRoughness: .18, anisotropy: .36 };
      break;
  }
  const mat = new THREE.MeshPhysicalMaterial({ ...defaults, ...options, ...(color === undefined ? {} : { color }) });
  return applyAccessoryFinish(mat, finishId, kind);
}

/** Fine machining marks are deliberately shallow so reflections stay clean. */
export function createMachiningNormal({ direction = 'linear', resolution = 128 } = {}) {
  const data = new Uint8Array(resolution * resolution * 4);
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const phase = direction === 'radial'
      ? Math.hypot(x - resolution / 2, y - resolution / 2) * 1.4
      : y * 2.8 + Math.sin(x * .043) * .32;
    const fine = Math.sin(phase) * 1.3;
    const n = (y * resolution + x) * 4;
    data[n] = 128; data[n + 1] = 128 + fine; data[n + 2] = 255; data[n + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, resolution, resolution, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}
