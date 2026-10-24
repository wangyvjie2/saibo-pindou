import * as THREE from './vendor/three.module.js';
import * as CANNON from './vendor/cannon-es.js';

const FIXED_STEP = 1 / 120;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const vector = value => new CANNON.Vec3(value.x, value.y, value.z);
const inertPhysics = () => ({
  step() {}, impulse() {}, setReducedMotion() {}, reset() {}, dispose() {},
  active: false,
  metrics: { engine: 'cannon-es', version: '0.20.0', bodyCount: 0, maxJointError: 0, bodyMotion: 0, energy: 0 }
});

// Take a few center-line samples from the actual tube, including transforms
// already baked into its vertices. A sphere compound leaves ring holes open;
// a solid box collider here would make adjacent links incorrectly repel.
function addWireColliders(body, mesh, unit, sampleCount = 10) {
  const geometry = mesh.geometry, params = geometry.parameters || {};
  const positions = geometry.attributes.position;
  const radial = params.radialSegments || 8;
  const tubular = params.tubularSegments || 32;
  const isTube = geometry.type === 'TubeGeometry';
  const wire = isTube ? params.radius : params.tube;
  if (!positions || !Number.isFinite(wire)) return;
  const point = new THREE.Vector3(), center = new THREE.Vector3();
  const radius = Math.max(.0012, wire / unit * .94);
  for (let sample = 0; sample < sampleCount; sample++) {
    const along = Math.round(sample / sampleCount * tubular);
    center.set(0, 0, 0);
    for (let around = 0; around < radial; around++) {
      const index = isTube ? along * (radial + 1) + around : around * (tubular + 1) + along;
      point.fromBufferAttribute(positions, index);
      center.add(point);
    }
    center.multiplyScalar(1 / radial).applyQuaternion(mesh.quaternion);
    body.addShape(new CANNON.Sphere(radius), vector(center.multiplyScalar(1 / unit)));
  }
}

/**
 * A local, constrained rigid-body chain. The upper key ring remains held while
 * the short links, jump ring and fused artwork react independently to gravity
 * and impulses. No animation curve drives the motion. The renderer owns RAF.
 *
 * All physics coordinates are normalized to a two-unit artwork, so a 300-pixel
 * piece and a small charm share the same stable solver settings. Mesh groups
 * are the only changed transforms; colors, picking and silhouette glow remain
 * attached to their corresponding physical object.
 */
export function createKeychainPhysics(art, { mode = 'viewer', reducedMotion = false } = {}) {
  if (art?.style !== 'pendant' || !art.metrics?.links?.length || !art.metrics?.jumpRing) return inertPhysics();
  const content = art.content || art.metrics.content || art.body.group.parent;
  const unit = Math.max(1, art.bounds.bodyWidth || art.body.bounds.width, art.bounds.bodyHeight || art.body.bounds.height) / 2;
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0), allowSleep: true });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.solver.iterations = 36;
  world.solver.tolerance = 1e-9;
  world.defaultContactMaterial.friction = .22;
  world.defaultContactMaterial.restitution = .01;
  world.defaultContactMaterial.contactEquationStiffness = 1e8;
  world.defaultContactMaterial.contactEquationRelaxation = 5;
  const nodes = [], dynamic = [], constraints = [], reparented = [];
  const workBody = art.body.group;
  let disposed = false, idleTime = 0;
  let lastGravity = new THREE.Vector3(0, -9.81, 0);
  const inverseRotation = new THREE.Quaternion(), gravity = new THREE.Vector3();
  const scratchA = new CANNON.Vec3(), scratchB = new CANNON.Vec3();
  const leverA = new CANNON.Vec3(), leverB = new CANNON.Vec3(), velocityA = new CANNON.Vec3(), velocityB = new CANNON.Vec3();
  const report = {
    engine: 'cannon-es', version: '0.20.0', mode, bodyCount: 0,
    dynamicBodyCount: 0, jointCount: 0, maxJointError: 0,
    maxJointErrorWorld: 0, bodyMotion: 0, bodyAngle: 0, energy: 0, settled: false
  };

  const centerOf = object => object.position.clone().add(content.position);
  const boundsOf = object => { object.geometry.computeBoundingBox();return object.geometry.boundingBox.clone(); };
  const makeNode = (objects, position, mass, kind, colliderMesh = null) => {
    const restPosition = position.clone();
    const visual = new THREE.Group();visual.name = `physical-${kind}`;
    visual.position.copy(position).sub(content.position);content.add(visual);
    for (const object of objects.filter(Boolean)) {
      const parent = object.parent, localPosition = object.position.clone(), quaternion = object.quaternion.clone(), scale = object.scale.clone();
      reparented.push({ object, parent, position: localPosition, quaternion, scale });
      object.position.sub(visual.position);visual.add(object);
    }
    const body = new CANNON.Body({
      mass, position: vector(position.clone().multiplyScalar(1 / unit)),
      linearDamping: kind === 'artwork' ? .30 : .22,
      angularDamping: kind === 'artwork' ? .44 : .36,
      allowSleep: true, sleepSpeedLimit: .035, sleepTimeLimit: .8
    });
    body.userData = { kind };
    if (colliderMesh) addWireColliders(body, colliderMesh, unit, kind === 'held-keyring' ? 20 : 10);
    if (kind === 'artwork') {
      body.addShape(new CANNON.Box(new CANNON.Vec3(
        art.body.bounds.width / unit * .5,
        art.body.bounds.height / unit * .5,
        Math.max(.002, (art.metrics.slabThickness || .30) / unit * .5)
      )));
    }
    if (!body.shapes.length) body.addShape(new CANNON.Sphere(.004));
    world.addBody(body);
    const node = { visual, body, restPosition, restQuaternion: new CANNON.Quaternion(), kind, colliderMesh };
    nodes.push(node);if (mass) dynamic.push(node);
    return node;
  };

  const connect = (upper, lower, jointPosition, artwork = false) => {
    const joint = vector(jointPosition.clone().multiplyScalar(1 / unit));
    const pivotA = upper.body.pointToLocalFrame(joint);
    const pivotB = lower.body.pointToLocalFrame(joint);
    const constraint = new CANNON.ConeTwistConstraint(upper.body, lower.body, {
      pivotA, pivotB, axisA: new CANNON.Vec3(0, 1, 0), axisB: new CANNON.Vec3(0, 1, 0),
      angle: artwork ? 1.15 : 1.28, twistAngle: artwork ? .8 : 1.05,
      maxForce: 1e5, collideConnected: false
    });
    for (const equation of constraint.equations) equation.setSpookParams(1e9, 5, FIXED_STEP);
    world.addConstraint(constraint);constraints.push(constraint);
  };
  const meshRange = (mesh, center) => {
    const box = boundsOf(mesh);
    // Chain tube geometry already has its alternating orientation baked in.
    return { low: center.y + box.min.y, high: center.y + box.max.y };
  };
  const rings = [...art.metrics.links].reverse();
  let upper;
  if (art.metrics.keyring && art.metrics.keyringConnector) {
    const ring = art.metrics.keyring, ringCenter = centerOf(ring);
    const accessories = art.metrics.keyringRigidParts || [ring, art.metrics.keyringCollar, ...(art.metrics.keyringSeams || [])];
    upper = makeNode(accessories, ringCenter, 0, 'held-keyring', ring);
    const connector = art.metrics.keyringConnector, center = centerOf(connector);
    const lower = makeNode([connector], center, .14, 'connector', connector);
    const ringRange = meshRange(ring, ringCenter), connectorRange = meshRange(connector, center);
    const joint = new THREE.Vector3(center.x, (ringRange.low + connectorRange.high) / 2, 0);
    connect(upper, lower, joint);upper = lower;
  } else {
    // Existing classic pendants have no large main ring; hold their top link.
    const top = rings.shift();upper = makeNode([top], centerOf(top), 0, 'held-chain-link', top);
  }
  for (const [index, ring] of rings.entries()) {
    const center = centerOf(ring), lower = makeNode([ring], center, .12, `chain-link-${index + 1}`, ring);
    const upperRange = meshRange(upper.colliderMesh, upper.restPosition), lowerRange = meshRange(ring, center);
    connect(upper, lower, new THREE.Vector3(center.x, (upperRange.low + lowerRange.high) / 2, 0));upper = lower;
  }
  const jump = art.metrics.jumpRing, jumpCenter = centerOf(jump);
  const lower = makeNode([jump], jumpCenter, .16, 'jump-ring', jump);
  const upperRange = meshRange(upper.colliderMesh, upper.restPosition), jumpRange = meshRange(jump, jumpCenter);
  connect(upper, lower, new THREE.Vector3(jumpCenter.x, (upperRange.low + jumpRange.high) / 2, 0));
  const piece = makeNode([workBody, art.metrics.eyelet, art.metrics.eyeletGlow], centerOf(workBody), .65, 'artwork');
  const eyeCenter = art.metrics.eyeletCenter.clone();
  const eyeJoint = new THREE.Vector3(eyeCenter.x, (eyeCenter.y + jumpRange.low) / 2, 0);
  connect(lower, piece, eyeJoint, true);
  report.bodyCount = nodes.length;report.dynamicBodyCount = dynamic.length;report.jointCount = constraints.length;

  const syncVisuals = () => {
    for (const node of nodes) {
      node.visual.position.set(node.body.position.x * unit, node.body.position.y * unit, node.body.position.z * unit).sub(content.position);
      node.visual.quaternion.set(node.body.quaternion.x, node.body.quaternion.y, node.body.quaternion.z, node.body.quaternion.w);
    }
    art.group.updateMatrixWorld(true);
  };
  const wake = () => { idleTime = 0;for (const node of dynamic) node.body.wakeUp(); };
  const reset = () => {
    if (disposed) return;
    idleTime = 0;world.accumulator = 0;
    for (const node of nodes) {
      node.body.position.copy(vector(node.restPosition.clone().multiplyScalar(1 / unit)));
      node.body.quaternion.copy(node.restQuaternion);
      node.body.previousPosition.copy(node.body.position);node.body.interpolatedPosition.copy(node.body.position);
      node.body.previousQuaternion.copy(node.body.quaternion);node.body.interpolatedQuaternion.copy(node.body.quaternion);
      node.body.velocity.setZero();node.body.angularVelocity.setZero();node.body.force.setZero();node.body.torque.setZero();
      node.body.aabbNeedsUpdate = true;
      if (reducedMotion || mode==='room' || !node.body.mass) node.body.sleep();else node.body.wakeUp();
    }
    report.maxJointError = 0;report.maxJointErrorWorld = 0;report.energy = 0;report.bodyMotion = 0;report.bodyAngle = 0;report.settled = reducedMotion||mode==='room';
    syncVisuals();
  };
  const updateReport = () => {
    let error = 0, energy = 0;
    for (const constraint of constraints) {
      constraint.bodyA.pointToWorldFrame(constraint.pivotA, scratchA);
      constraint.bodyB.pointToWorldFrame(constraint.pivotB, scratchB);
      error = Math.max(error, scratchA.distanceTo(scratchB));
    }
    for (const node of dynamic) energy += node.body.mass * (node.body.velocity.lengthSquared() + node.body.angularVelocity.lengthSquared() * .09) / 2;
    const rest = vector(piece.restPosition.clone().multiplyScalar(1 / unit));
    report.maxJointError = error;report.maxJointErrorWorld = error * unit;
    report.bodyMotion = piece.body.position.distanceTo(rest);
    report.bodyAngle = 2 * Math.acos(clamp(Math.abs(piece.body.quaternion.w), 0, 1));
    report.energy = energy;report.settled = dynamic.every(node => node.body.sleepState === CANNON.Body.SLEEPING);
  };
  const limitVelocity = body => {
    const speed = body.velocity.length(), angular = body.angularVelocity.length();
    if (speed > 2.4) body.velocity.scale(2.4 / speed, body.velocity);
    if (angular > 5) body.angularVelocity.scale(5 / angular, body.angularVelocity);
  };
  const stabilizeJoints = () => {
    // Position/velocity projection supplements Cannon's impulse solver for a
    // very large artwork on exceptionally short chain links. This preserves
    // the exact hinge location while retaining solved angular motion, rather
    // than letting a small numerical error visibly stretch the metal chain.
    // The constraints form a tree, ordered from its static anchor downwards.
    for (const constraint of constraints) {
      const upper = constraint.bodyA, lower = constraint.bodyB;
      upper.pointToWorldFrame(constraint.pivotA, scratchA);
      lower.pointToWorldFrame(constraint.pivotB, scratchB);
      scratchA.vsub(scratchB, scratchB);lower.position.vadd(scratchB, lower.position);
      upper.quaternion.vmult(constraint.pivotA, leverA);
      lower.quaternion.vmult(constraint.pivotB, leverB);
      upper.angularVelocity.cross(leverA, velocityA);upper.velocity.vadd(velocityA, velocityA);
      lower.angularVelocity.cross(leverB, velocityB);velocityA.vsub(velocityB, lower.velocity);
      lower.interpolatedPosition.copy(lower.position);lower.aabbNeedsUpdate = true;
    }
  };
  reset();
  return {
    step(dt, rootQuaternion) {
      if (disposed || reducedMotion) return;
      gravity.set(0, -9.81, 0);
      if (rootQuaternion) { inverseRotation.copy(rootQuaternion).invert();gravity.applyQuaternion(inverseRotation); }
      if (gravity.distanceToSquared(lastGravity) > .000025) wake();
      lastGravity.copy(gravity);world.gravity.set(gravity.x, gravity.y, gravity.z);
      if (!dynamic.some(node => node.body.sleepState !== CANNON.Body.SLEEPING)) return;
      world.step(FIXED_STEP, clamp(Number(dt) || FIXED_STEP, .001, .05), 6);
      for (const node of dynamic) limitVelocity(node.body);
      stabilizeJoints();
      updateReport();
      if (!Number.isFinite(report.energy) || report.maxJointError > .10) { reset();return; }
      // Once the constrained simulation has truly settled, stop rendering it.
      // The pose is retained; the next touch or changed gravity wakes the rig.
      if (report.energy < (mode==='room'?.0001:.000022) && report.maxJointError < .0015) idleTime += dt;else idleTime = 0;
      if (idleTime > (mode==='room'?.65:.85)) { for (const node of dynamic) node.body.sleep();report.settled = true; }
      syncVisuals();
    },
    impulse(strength = .38, direction = { x: .65, y: 0, z: .18 }) {
      if (disposed || reducedMotion) return false;
      const magnitude = clamp(Number(strength) || 0, -.95, .95);
      const directionVector = new CANNON.Vec3(Number(direction?.x) || 0, Number(direction?.y) || 0, Number(direction?.z) || 0);
      if (directionVector.lengthSquared() < 1e-9 || !magnitude) return false;
      directionVector.normalize();wake();
      for (const node of dynamic) {
        const factor = node === piece ? 1 : .25;
        const force = directionVector.scale(magnitude * node.body.mass * factor);
        node.body.applyImpulse(force);
        if (node === piece) node.body.applyTorque(new CANNON.Vec3(directionVector.z * .04, directionVector.x * .025, -directionVector.x * .035));
        limitVelocity(node.body);
      }
      return true;
    },
    setReducedMotion(value) {
      const next = !!value;if (next === reducedMotion) return;
      reducedMotion = next;if (next) reset();else wake();
    },
    reset,
    get active() { return !disposed && !reducedMotion && dynamic.some(node => node.body.sleepState !== CANNON.Body.SLEEPING); },
    get metrics() { return report; },
    dispose() {
      if (disposed) return;disposed = true;
      for (const constraint of constraints) world.removeConstraint(constraint);
      for (const node of nodes) world.removeBody(node.body);
      for (const saved of reparented) {
        saved.parent.add(saved.object);saved.object.position.copy(saved.position);saved.object.quaternion.copy(saved.quaternion);saved.object.scale.copy(saved.scale);
      }
      for (const node of nodes) content.remove(node.visual);
      nodes.length = 0;dynamic.length = 0;constraints.length = 0;reparented.length = 0;
    }
  };
}
