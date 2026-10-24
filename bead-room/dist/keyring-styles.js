import { createAccessoryMaterial } from './accessory-materials.js';

/* The ten reference silhouettes are physical, hollow metal rings. */
export const KEYRING_STYLE_IDS = Object.freeze([
  'keyring-cat', 'keyring-rabbit', 'keyring-bear', 'keyring-dog',
  'keyring-fox', 'keyring-sheep', 'keyring-whale', 'keyring-cloud',
  'keyring-star', 'keyring-butterfly'
]);

const silhouettes = {
  'keyring-cat': [
    [0,-.43],[.28,-.40],[.46,-.29],[.53,-.09],[.49,.11],
    [.44,.22],[.49,.39],[.48,.53],[.35,.51],[.17,.40],[0,.43],
    [-.17,.40],[-.35,.51],[-.48,.53],[-.49,.39],[-.44,.22],
    [-.49,.11],[-.53,-.09],[-.46,-.29],[-.28,-.40]
  ],
  'keyring-rabbit': [
    [0,-.44],[.29,-.40],[.47,-.23],[.48,-.05],[.42,.13],
    [.30,.29],[.38,.51],[.42,.77],[.38,.91],[.27,.94],
    [.17,.82],[.11,.58],[.09,.41],[0,.41],[-.09,.41],
    [-.11,.58],[-.17,.82],[-.27,.94],[-.38,.91],[-.42,.77],
    [-.38,.51],[-.30,.29],[-.42,.13],[-.48,-.05],[-.47,-.23],[-.29,-.40]
  ],
  'keyring-bear': [
    [0,-.44],[.26,-.41],[.44,-.26],[.49,-.05],[.44,.14],
    [.50,.22],[.54,.36],[.50,.49],[.38,.53],[.28,.46],
    [.24,.36],[0,.39],[-.24,.36],[-.28,.46],[-.38,.53],
    [-.50,.49],[-.54,.36],[-.50,.22],[-.44,.14],
    [-.49,-.05],[-.44,-.26],[-.26,-.41]
  ],
  'keyring-dog': [
    [0,-.34],[.18,-.30],[.26,-.18],[.29,.03],[.30,.18],
    [.34,.25],[.39,.21],[.44,.10],[.58,.10],[.65,.20],[.61,.31],[.48,.40],
    [.33,.50],[.17,.57],[0,.59],[-.17,.57],[-.33,.50],
    [-.48,.40],[-.61,.31],[-.65,.20],[-.58,.10],[-.44,.10],
    [-.39,.21],[-.34,.25],[-.30,.18],[-.29,.03],[-.26,-.18],[-.18,-.30]
  ],
  'keyring-fox': [
    [0,-.45],[.22,-.39],[.40,-.27],[.50,-.12],
    [.43,-.04],[.52,.02],[.45,.12],[.40,.21],
    [.44,.39],[.43,.57],[.32,.53],[.17,.43],[0,.45],
    [-.17,.43],[-.32,.53],[-.43,.57],[-.44,.39],
    [-.40,.21],[-.45,.12],[-.52,.02],[-.43,-.04],
    [-.50,-.12],[-.40,-.27],[-.22,-.39]
  ],
  'keyring-sheep': [
    [0,-.41],[.24,-.37],[.39,-.21],[.41,.04],
    [.48,-.01],[.60,.04],[.62,.13],[.52,.26],
    [.48,.30],[.47,.43],[.40,.49],[.30,.49],
    [.23,.57],[.13,.59],[.05,.56],[0,.59],
    [-.05,.56],[-.13,.59],[-.23,.57],[-.30,.49],
    [-.40,.49],[-.47,.43],[-.48,.30],[-.52,.26],
    [-.62,.13],[-.60,.04],[-.48,-.01],[-.41,.04],
    [-.39,-.21],[-.24,-.37]
  ],
  'keyring-whale': [
    [-.12,-.39],[.13,-.35],[.33,-.22],[.43,-.06],
    [.47,.03],[.57,.07],[.65,.17],[.62,.24],
    [.50,.20],[.41,.27],[.32,.30],[.28,.22],
    [.33,.09],[.24,.04],[.11,.12],[.05,.29],
    [-.08,.44],[-.30,.48],[-.48,.39],[-.60,.21],
    [-.61,.01],[-.54,-.19],[-.37,-.34]
  ],
  'keyring-cloud': [
    [0,-.27],[.31,-.27],[.52,-.22],[.61,-.10],
    [.59,.03],[.50,.13],[.47,.28],[.39,.38],
    [.27,.39],[.19,.49],[.08,.56],[-.06,.55],
    [-.17,.46],[-.21,.33],[-.34,.35],[-.46,.28],
    [-.50,.13],[-.60,.05],[-.64,-.08],[-.58,-.21],[-.34,-.27]
  ],
  'keyring-star': [
    [0,.57],[.15,.23],[.51,.16],[.28,-.11],
    [.32,-.47],[0,-.30],[-.32,-.47],[-.28,-.11],
    [-.51,.16],[-.15,.23]
  ],
  'keyring-butterfly': [
    [0,-.10],[.14,-.28],[.36,-.39],[.47,-.37],
    [.48,-.26],[.35,-.09],[.27,.01],[.43,.22],
    [.52,.43],[.47,.51],[.34,.49],[.19,.38],[0,.15],
    [-.19,.38],[-.34,.49],[-.47,.51],[-.52,.43],
    [-.43,.22],[-.27,.01],[-.35,-.09],[-.48,-.26],
    [-.47,-.37],[-.36,-.39],[-.14,-.28]
  ]
};

/**
 * mesh and material are the assembly's resource-registering factories.
 * lastY is the center-line top of its final, XY-plane chain link. The small
 * YZ connector below interlocks that chain and the new, XY-plane main ring.
 * Coordinates here remain in assembly space; the caller performs centering.
 */
export function buildKeyringStyle(ctx, id) {
  const points = silhouettes[id];
  if (!points) throw new Error(`未知的钥匙环样式：${id}`);
  const { THREE, mesh, material, metalMaterials, x = 0, lastY = 0 } = ctx;
  const size = Number.isFinite(ctx.size) ? Math.max(.1, ctx.size) : 1;
  const bodyWidth = Number.isFinite(ctx.bodyWidth) ? Math.max(0, ctx.bodyWidth) : size * 7;
  const width = Math.max(1.35, bodyWidth * .35);
  const wire = width * .026;
  const linkWire = Number.isFinite(ctx.linkWire) ? Math.max(.012, ctx.linkWire) : size * .032;
  const connectorRadius = Math.max(size * .22, wire * 2.8);
  const connectorY = lastY + connectorRadius - size * .12;
  const lowestY = connectorY + connectorRadius - wire * 2.2 - linkWire * 2.5;

  // Uniform scaling retains each reference silhouette rather than reducing
  // the ten choices to differently colored circles.
  const source = new THREE.CatmullRomCurve3(
    points.map(([px, py]) => new THREE.Vector3(px, py, 0)), true, 'centripetal'
  );
  const sample = source.getPoints(512);
  const minX = Math.min(...sample.map(point => point.x));
  const maxX = Math.max(...sample.map(point => point.x));
  const minY = Math.min(...sample.map(point => point.y));
  const factor = width / (maxX - minX);
  const shiftX = (maxX + minX) / 2;
  const curve = new THREE.CatmullRomCurve3(
    points.map(([px, py]) => new THREE.Vector3((px - shiftX) * factor, (py - minY) * factor, 0)),
    true, 'centripetal'
  );
  const metal = material(createAccessoryMaterial('metal', {
    finishId: ctx.finishId,
    color: id === 'keyring-dog' ? 0xc9a66c : 0xdadbd8,
    roughness: .19
  }));
  const joiningMetal = material(createAccessoryMaterial('metal', {
    color: id === 'keyring-dog' ? 0xd5b880 : 0xe5e6e2, roughness: .17
  }));
  metalMaterials?.push(metal);
  metalMaterials?.push(joiningMetal);
  const connector = mesh(
    new THREE.TorusGeometry(connectorRadius, linkWire, ctx.detail==='room'?10:18, ctx.detail==='room'?40:80).rotateY(Math.PI / 2),
    metal, 'keyring-interlocking-connector'
  );
  connector.position.set(x, connectorY, 0);

  const ring = mesh(new THREE.TubeGeometry(curve, ctx.detail==='room'?160:360, wire, ctx.detail==='room'?10:20, true), metal, id);
  ring.position.set(x, lowestY, 0);
  ring.geometry.computeBoundingBox();
  const keyringBounds = ring.geometry.boundingBox.clone().translate(ring.position);
  const allSamples = curve.getPoints(768);
  const top = allSamples.reduce((best, point) => point.y > best.y ? point : best, allSamples[0]);

  // A fine joining collar gives the tube the feel of an actual metal key ring.
  // Locate it on an upper arc near the middle, preserving ears and wing tips.
  let collarT = 0, collarScore = -Infinity;
  const topY = top.y;
  for (let index = 0; index < 384; index++) {
    const point = curve.getPoint(index / 384);
    if (point.y < topY * .50) continue;
    const score = -Math.abs(point.x) + point.y * .025;
    if (score > collarScore) { collarScore = score; collarT = index / 384; }
  }
  const collarPoint = curve.getPoint(collarT);
  const collarTangent = curve.getTangent(collarT).normalize();
  const collar = mesh(new THREE.CylinderGeometry(wire * 1.10, wire * 1.10, wire * 3.15, 32), joiningMetal, 'keyring-joining-collar');
  collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), collarTangent);
  collar.position.copy(collarPoint).add(new THREE.Vector3(x, lowestY, 0));

  const seamMaterial = material(createAccessoryMaterial('metal', { color: 0x565955, roughness: .30 }));
  metalMaterials?.push(seamMaterial);
  const seams = [];
  for (const direction of [-1, 1]) {
    const seam = mesh(new THREE.TorusGeometry(wire * 1.10, wire * .039, 10, 40), seamMaterial, 'keyring-collar-seam');
    seam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), collarTangent);
    seam.position.copy(collar.position).addScaledVector(collarTangent, wire * 1.50 * direction);
    seams.push(seam);
  }
  return {
    hangerPoint: new THREE.Vector3(x + top.x, lowestY + top.y - wire * .5, 0),
    metrics: {
      keyring: ring, keyringId: id, keyringWidth: width,
      keyringWireRadius: wire, keyringBounds, keyringConnector: connector,
      keyringCollar: collar, keyringSeams: seams,
      keyringRigidParts: [ring, collar, ...seams], finishId: ctx.finishId || 'original'
    }
  };
}
