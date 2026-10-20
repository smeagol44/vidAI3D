import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { type FaceDirection, type VoxelPartGene, partPhysicalSize } from './genome';

export const PHYSICS_DT = 1 / 120;
export const BODY_DENSITY = 1000; // kg/m^3; metres, seconds, N, N m throughout physics.
export const DEFAULT_WATER_RESISTANCE = 250;
let initialization: Promise<void> | undefined;
let initialized = false;
export function initializePhysics(): Promise<void> {
  return initialization ??= RAPIER.init().then(() => { initialized = true; });
}

export function faceNormal(face: FaceDirection): THREE.Vector3 {
  return new THREE.Vector3(face.endsWith('X') ? 1 : 0, face.endsWith('Y') ? 1 : 0, face.endsWith('Z') ? 1 : 0)
    .multiplyScalar(face.startsWith('-') ? -1 : 1);
}
export function faceAnchor(face: FaceDirection, p: VoxelPartGene): THREE.Vector3 {
  return faceNormal(face).multiply(new THREE.Vector3(...partPhysicalSize(p))).multiplyScalar(0.5);
}
export function axisVector(axis: 'X' | 'Y' | 'Z'): THREE.Vector3 {
  return new THREE.Vector3(axis === 'X' ? 1 : 0, axis === 'Y' ? 1 : 0, axis === 'Z' ? 1 : 0);
}

/** Exactly the existing integrated normal-only resistance law; no swimming thrust. */
export function cuboidResistance(a: number, b: number, c: number, velocity: THREE.Vector3, omega: THREE.Vector3, mu: number) {
  return {
    force: new THREE.Vector3(-2 * mu * b * c * velocity.x, -2 * mu * a * c * velocity.y, -2 * mu * a * b * velocity.z),
    torque: new THREE.Vector3(-mu * omega.x * a * (b ** 3 + c ** 3) / 6,
      -mu * omega.y * b * (a ** 3 + c ** 3) / 6, -mu * omega.z * c * (a ** 3 + b ** 3) / 6),
  };
}

/** One authoritative Rapier world per ecosystem. Reference organisms can own an isolated world. */
export class PhysicsWorld {
  readonly raw: RAPIER.World;
  readonly bodies = new Set<RigidCuboid>();
  steps = 0;
  disposed = false;
  constructor(readonly bounds?: THREE.Vector3) {
    if (!initialized) throw new Error('Call initializePhysics() before constructing a simulation.');
    this.raw = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.raw.timestep = PHYSICS_DT;
    this.raw.numSolverIterations = 12;
    this.raw.integrationParameters.numInternalPgsIterations = 2;
    if (bounds) {
      const hx = bounds.x / 2, hz = bounds.z / 2, middle = bounds.y / 2, hy = middle - 1;
      const wall = (x: number, y: number, z: number, a: number, b: number, c: number) => {
        this.raw.createCollider(RAPIER.ColliderDesc.cuboid(a, b, c).setTranslation(x, y, z).setFriction(0).setRestitution(0));
      };
      wall(-hx - .25, middle, 0, .25, hy + .5, hz + .5); wall(hx + .25, middle, 0, .25, hy + .5, hz + .5);
      wall(0, middle, -hz - .25, hx + .5, hy + .5, .25); wall(0, middle, hz + .25, hx + .5, hy + .5, .25);
      wall(0, .75, 0, hx + .5, .25, hz + .5); wall(0, bounds.y - .75, 0, hx + .5, .25, hz + .5);
    }
  }
  step(dt = PHYSICS_DT) {
    if (this.disposed) throw new Error('Physics world has been disposed.');
    if (Math.abs(dt - PHYSICS_DT) > 1e-12) throw new Error('Physics timestep must stay fixed at 1/120 s.');
    for (const b of this.bodies) b.flushForces();
    this.raw.step(); this.steps++;
    for (const b of this.bodies) b.sync();
  }
  dispose() { if (!this.disposed) { this.disposed = true; this.bodies.clear(); this.raw.free(); } }
}

/** Read snapshots for rendering/senses; Rapier alone integrates and owns physical state. */
export class RigidCuboid {
  readonly id: string;
  readonly dimX: number; readonly dimY: number; readonly dimZ: number;
  readonly raw: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly pos = new THREE.Vector3(); readonly rot = new THREE.Quaternion();
  readonly linVel = new THREE.Vector3(); readonly angVel = new THREE.Vector3();
  readonly forceAcc = new THREE.Vector3(); readonly torqueAcc = new THREE.Vector3();
  constructor(readonly world: PhysicsWorld, readonly partGene: VoxelPartGene,
    position = new THREE.Vector3(), rotation = new THREE.Quaternion(), density = BODY_DENSITY) {
    this.id = partGene.id;
    [this.dimX, this.dimY, this.dimZ] = partPhysicalSize(partGene);
    this.raw = world.raw.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z)
      .setRotation(rotation).setCanSleep(false).setCcdEnabled(true).setLinearDamping(0).setAngularDamping(0));
    this.collider = world.raw.createCollider(RAPIER.ColliderDesc.cuboid(this.dimX / 2, this.dimY / 2, this.dimZ / 2)
      .setDensity(density).setFriction(0).setRestitution(0), this.raw);
    this.raw.recomputeMassPropertiesFromColliders();
    world.bodies.add(this); this.sync();
  }
  get mass() { return this.raw.mass(); }
  get invMass() { return 1 / this.mass; }
  get inertiaLocal() { return new THREE.Vector3().copy(this.raw.principalInertia()); }
  getInertiaTensorWorldInv(out: THREE.Matrix3): THREE.Matrix3 {
    const m = this.raw.effectiveWorldInvInertia();
    return out.set(m.m11, m.m12, m.m13, m.m12, m.m22, m.m23, m.m13, m.m23, m.m33);
  }
  sync() { this.pos.copy(this.raw.translation()); this.rot.copy(this.raw.rotation()); this.linVel.copy(this.raw.linvel()); this.angVel.copy(this.raw.angvel()); }
  setVelocities(linear: THREE.Vector3, angular = new THREE.Vector3()) { this.raw.setLinvel(linear, true); this.raw.setAngvel(angular, true); this.sync(); }
  applyHydrodynamics(mu: number) {
    if (!Number.isFinite(mu) || mu < 0) throw new Error('Water resistance must be finite and nonnegative.');
    const inverse = this.rot.clone().invert();
    const drag = cuboidResistance(this.dimX, this.dimY, this.dimZ, this.linVel.clone().applyQuaternion(inverse), this.angVel.clone().applyQuaternion(inverse), mu);
    this.forceAcc.add(drag.force.applyQuaternion(this.rot)); this.torqueAcc.add(drag.torque.applyQuaternion(this.rot));
  }
  flushForces() {
    const values = [...this.pos.toArray(), ...this.rot.toArray(), ...this.linVel.toArray(), ...this.angVel.toArray(), ...this.forceAcc.toArray(), ...this.torqueAcc.toArray()];
    if (!values.every(Number.isFinite)) throw new Error(`Non-finite body state: ${this.id}`);
    // Rapier user forces persist until reset. Clear every substep, including zero-drag/motor-off steps.
    this.raw.resetForces(false); this.raw.resetTorques(false);
    this.raw.addForce(this.forceAcc, true); this.raw.addTorque(this.torqueAcc, true);
    this.forceAcc.set(0, 0, 0); this.torqueAcc.set(0, 0, 0);
  }
  dispose() { if (!this.world.disposed) { this.world.bodies.delete(this); this.world.raw.removeRigidBody(this.raw); } }
}

export class RevoluteJoint {
  readonly raw: RAPIER.RevoluteImpulseJoint;
  readonly parentLocalHingeAxis: THREE.Vector3;
  readonly childLocalHingeAxis: THREE.Vector3;
  readonly frame1: THREE.Quaternion;
  readonly frame2: THREE.Quaternion;
  currentAngle = 0; currentRelAngularVel = 0; anchorError = 0; axisError = 0;
  jointPhase = 0; appliedTorque = 0; targetAngle = 0;
  private omegaBefore = 0;
  constructor(readonly parent: RigidCuboid, readonly child: RigidCuboid,
    readonly parentLocalAnchor: THREE.Vector3, readonly childLocalAnchor: THREE.Vector3,
    axis: 'X' | 'Y' | 'Z', readonly minAngle: number, readonly maxAngle: number,
    readonly restAngle: number, readonly motorMaxTorque: number, initialPhase: number,
    faceAlignment = new THREE.Quaternion()) {
    this.parentLocalHingeAxis = axisVector(axis);
    this.childLocalHingeAxis = this.parentLocalHingeAxis.clone().applyQuaternion(faceAlignment.clone().invert());
    this.frame1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.parentLocalHingeAxis);
    this.frame2 = faceAlignment.clone().invert().multiply(this.frame1);
    const data = RAPIER.JointData.revolute(parentLocalAnchor, childLocalAnchor, this.parentLocalHingeAxis);
    this.raw = parent.world.raw.createImpulseJoint(data, parent.raw, child.raw, true) as RAPIER.RevoluteImpulseJoint;
    this.raw.setLocalFrame1(parentLocalAnchor, this.frame1); this.raw.setLocalFrame2(childLocalAnchor, this.frame2);
    this.raw.setLimits(minAngle, maxAngle); this.raw.setContactsEnabled(false);
    this.jointPhase = initialPhase; this.updateJointKinematics();
  }
  getWorldHingeAxis() { return this.parentLocalHingeAxis.clone().applyQuaternion(this.parent.rot); }
  updateJointKinematics() {
    const p = this.parentLocalAnchor.clone().applyQuaternion(this.parent.rot).add(this.parent.pos);
    const c = this.childLocalAnchor.clone().applyQuaternion(this.child.rot).add(this.child.pos);
    this.anchorError = p.distanceTo(c);
    const hinge = this.getWorldHingeAxis();
    this.axisError = hinge.angleTo(this.childLocalHingeAxis.clone().applyQuaternion(this.child.rot));
    const a = this.parent.rot.clone().multiply(this.frame1), b = this.child.rot.clone().multiply(this.frame2);
    const relative = a.invert().multiply(b).normalize();
    this.currentAngle = THREE.MathUtils.euclideanModulo(2 * Math.atan2(relative.x, relative.w) + Math.PI, 2 * Math.PI) - Math.PI;
    this.currentRelAngularVel = this.child.angVel.clone().sub(this.parent.angVel).dot(hinge);
  }
  applyMotorAndLimits(targetAngle: number, torqueAllowance: number, stiffness: number, damping: number) {
    this.targetAngle = THREE.MathUtils.clamp(targetAngle, this.minAngle, this.maxAngle);
    this.omegaBefore = this.currentRelAngularVel;
    this.appliedTorque = torqueAllowance <= 0 ? 0 : THREE.MathUtils.clamp(
      (this.targetAngle - this.currentAngle) * stiffness - damping * this.currentRelAngularVel, -torqueAllowance, torqueAllowance);
    const torque = this.getWorldHingeAxis().multiplyScalar(this.appliedTorque);
    this.child.torqueAcc.add(torque); this.parent.torqueAcc.sub(torque);
  }
  /** Trapezoidal actual relative angular displacement; never charge passive constraint impulses. */
  motorWork(dt: number) { return Math.abs(this.appliedTorque * (this.omegaBefore + this.currentRelAngularVel) * .5 * dt); }
}
