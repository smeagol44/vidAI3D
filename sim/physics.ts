import * as THREE from 'three';
import { FaceDirection, VoxelPartGene, VOXEL_UNIT } from './genome';

// 3x3 Matrix Inversion Helper
function invertMatrix3(m: number[], out: number[]): boolean {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[3], a11 = m[4], a12 = m[5];
  const a20 = m[6], a21 = m[7], a22 = m[8];

  const b01 = a22 * a11 - a12 * a21;
  const b11 = -a22 * a10 + a12 * a20;
  const b21 = a21 * a10 - a11 * a20;

  const det = a00 * b01 + a01 * b11 + a02 * b21;
  if (Math.abs(det) < 1e-12) return false;

  const invDet = 1.0 / det;

  out[0] = b01 * invDet;
  out[1] = (-a22 * a01 + a02 * a21) * invDet;
  out[2] = (a12 * a01 - a02 * a11) * invDet;
  out[3] = b11 * invDet;
  out[4] = (a22 * a00 - a02 * a20) * invDet;
  out[5] = (-a12 * a00 + a02 * a10) * invDet;
  out[6] = b21 * invDet;
  out[7] = (-a21 * a00 + a01 * a20) * invDet;
  out[8] = (a11 * a00 - a01 * a10) * invDet;

  return true;
}

export class RigidCuboid {
  public id: string;
  public partGene: VoxelPartGene;
  public dimX: number;
  public dimY: number;
  public dimZ: number;
  public mass: number;
  public invMass: number;
  public inertiaLocal: THREE.Vector3;
  public invInertiaLocal: THREE.Vector3;

  // 6-DOF State
  public pos: THREE.Vector3 = new THREE.Vector3();
  public rot: THREE.Quaternion = new THREE.Quaternion();
  public linVel: THREE.Vector3 = new THREE.Vector3();
  public angVel: THREE.Vector3 = new THREE.Vector3();

  // Accumulators
  public forceAcc: THREE.Vector3 = new THREE.Vector3();
  public torqueAcc: THREE.Vector3 = new THREE.Vector3();

  constructor(gene: VoxelPartGene, density: number = 1000) {
    this.id = gene.id;
    this.partGene = gene;
    this.dimX = gene.dimX * VOXEL_UNIT;
    this.dimY = gene.dimY * VOXEL_UNIT;
    this.dimZ = gene.dimZ * VOXEL_UNIT;

    const volume = this.dimX * this.dimY * this.dimZ;
    this.mass = Math.max(0.05, volume * density);
    this.invMass = 1.0 / this.mass;

    const ix = (this.mass * (this.dimY * this.dimY + this.dimZ * this.dimZ)) / 12;
    const iy = (this.mass * (this.dimX * this.dimX + this.dimZ * this.dimZ)) / 12;
    const iz = (this.mass * (this.dimX * this.dimX + this.dimY * this.dimY)) / 12;

    this.inertiaLocal = new THREE.Vector3(ix, iy, iz);
    this.invInertiaLocal = new THREE.Vector3(1 / ix, 1 / iy, 1 / iz);
  }

  public getInertiaTensorWorldInv(outMatrix: THREE.Matrix3): THREE.Matrix3 {
    const rotMat = new THREE.Matrix4().makeRotationFromQuaternion(this.rot);
    const el = rotMat.elements;
    const r00 = el[0], r01 = el[4], r02 = el[8];
    const r10 = el[1], r11 = el[5], r12 = el[9];
    const r20 = el[2], r21 = el[6], r22 = el[10];

    const ix = this.invInertiaLocal.x;
    const iy = this.invInertiaLocal.y;
    const iz = this.invInertiaLocal.z;

    outMatrix.set(
      r00 * ix * r00 + r01 * iy * r01 + r02 * iz * r02,
      r00 * ix * r10 + r01 * iy * r11 + r02 * iz * r12,
      r00 * ix * r20 + r01 * iy * r21 + r02 * iz * r22,

      r10 * ix * r00 + r11 * iy * r01 + r12 * iz * r02,
      r10 * ix * r10 + r11 * iy * r11 + r12 * iz * r12,
      r10 * ix * r20 + r11 * iy * r21 + r12 * iz * r22,

      r20 * ix * r00 + r21 * iy * r01 + r22 * iz * r02,
      r20 * ix * r10 + r21 * iy * r11 + r22 * iz * r12,
      r20 * ix * r20 + r21 * iy * r21 + r22 * iz * r22
    );
    return outMatrix;
  }

  public applyHydrodynamics(mu: number) {
    if (mu <= 0) return;
    const invRot = this.rot.clone().invert();
    const localLinVel = this.linVel.clone().applyQuaternion(invRot);
    const localAngVel = this.angVel.clone().applyQuaternion(invRot);

    const a = this.dimX;
    const b = this.dimY;
    const c = this.dimZ;

    const fx = -2 * mu * b * c * localLinVel.x;
    const fy = -2 * mu * a * c * localLinVel.y;
    const fz = -2 * mu * a * b * localLinVel.z;

    const tx = (-mu * localAngVel.x * a * (b * b * b + c * c * c)) / 6;
    const ty = (-mu * localAngVel.y * b * (a * a * a + c * c * c)) / 6;
    const tz = (-mu * localAngVel.z * c * (a * a * a + b * b * b)) / 6;

    const worldForce = new THREE.Vector3(fx, fy, fz).applyQuaternion(this.rot);
    const worldTorque = new THREE.Vector3(tx, ty, tz).applyQuaternion(this.rot);

    this.forceAcc.add(worldForce);
    this.torqueAcc.add(worldTorque);
  }

  public integrateForces(dt: number) {
    this.linVel.addScaledVector(this.forceAcc, this.invMass * dt);

    if (this.torqueAcc.lengthSq() > 1e-12) {
      const invIWorld = new THREE.Matrix3();
      this.getInertiaTensorWorldInv(invIWorld);
      const deltaW = this.torqueAcc.clone().applyMatrix3(invIWorld).multiplyScalar(dt);
      this.angVel.add(deltaW);
    }

    // Velocity clamp sanity safeguard against numerical runaway
    const maxSpeed = 15.0;
    if (this.linVel.lengthSq() > maxSpeed * maxSpeed) {
      this.linVel.normalize().multiplyScalar(maxSpeed);
    }
    const maxAngSpeed = 30.0;
    if (this.angVel.lengthSq() > maxAngSpeed * maxAngSpeed) {
      this.angVel.normalize().multiplyScalar(maxAngSpeed);
    }

    this.forceAcc.set(0, 0, 0);
    this.torqueAcc.set(0, 0, 0);
  }

  public integrateVelocity(dt: number) {
    this.pos.addScaledVector(this.linVel, dt);

    const wLen = this.angVel.length();
    if (wLen > 1e-8) {
      const axis = this.angVel.clone().normalize();
      const angle = wLen * dt;
      const deltaQ = new THREE.Quaternion().setFromAxisAngle(axis, angle);
      this.rot.premultiply(deltaQ).normalize();
    }
  }
}

export class RevoluteJoint {
  public parent: RigidCuboid;
  public child: RigidCuboid;
  public parentLocalAnchor: THREE.Vector3;
  public childLocalAnchor: THREE.Vector3;
  public parentLocalHingeAxis: THREE.Vector3;
  public childLocalHingeAxis: THREE.Vector3;
  public minAngle: number;
  public maxAngle: number;
  public restAngle: number;
  public motorMaxTorque: number;
  public currentAngle: number = 0;
  public currentRelAngularVel: number = 0;
  public anchorError: number = 0;
  public jointPhase: number = 0;

  constructor(
    parent: RigidCuboid,
    child: RigidCuboid,
    parentAnchor: THREE.Vector3,
    childAnchor: THREE.Vector3,
    hingeAxis: 'X' | 'Y' | 'Z',
    minAngle: number,
    maxAngle: number,
    restAngle: number,
    motorMaxTorque: number,
    initialPhase: number
  ) {
    this.parent = parent;
    this.child = child;
    this.parentLocalAnchor = parentAnchor.clone();
    this.childLocalAnchor = childAnchor.clone();

    const axis = hingeAxis === 'X' ? new THREE.Vector3(1, 0, 0) : hingeAxis === 'Y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    this.parentLocalHingeAxis = axis.clone();
    this.childLocalHingeAxis = axis.clone();

    this.minAngle = minAngle;
    this.maxAngle = maxAngle;
    this.restAngle = restAngle;
    this.motorMaxTorque = motorMaxTorque;
    this.jointPhase = initialPhase;
  }

  public getWorldHingeAxis(): THREE.Vector3 {
    return this.parentLocalHingeAxis.clone().applyQuaternion(this.parent.rot).normalize();
  }

  public updateJointKinematics() {
    const pWorldAnchor = this.parentLocalAnchor.clone().applyQuaternion(this.parent.rot).add(this.parent.pos);
    const cWorldAnchor = this.childLocalAnchor.clone().applyQuaternion(this.child.rot).add(this.child.pos);
    this.anchorError = pWorldAnchor.distanceTo(cWorldAnchor);

    const hingeWorld = this.getWorldHingeAxis();
    const relRot = this.child.rot.clone().premultiply(this.parent.rot.clone().invert());
    const euler = new THREE.Euler().setFromQuaternion(relRot, 'YXZ');
    if (this.child.partGene.hingeAxis === 'X') this.currentAngle = euler.x;
    else if (this.child.partGene.hingeAxis === 'Y') this.currentAngle = euler.y;
    else this.currentAngle = euler.z;

    const relAngVel = this.child.angVel.clone().sub(this.parent.angVel);
    this.currentRelAngularVel = relAngVel.dot(hingeWorld);
  }

  public applyMotorAndLimits(targetAngle: number, torqueAllowance: number, stiffness: number, damping: number, dt: number): number {
    if (torqueAllowance <= 0) return 0;

    const clampedTarget = THREE.MathUtils.clamp(targetAngle, this.minAngle, this.maxAngle);
    const angleError = clampedTarget - this.currentAngle;
    const hingeAxisWorld = this.getWorldHingeAxis();

    let desiredTorque = angleError * stiffness - this.currentRelAngularVel * damping;
    desiredTorque = THREE.MathUtils.clamp(desiredTorque, -torqueAllowance, torqueAllowance);

    if (Math.abs(desiredTorque) > 1e-6) {
      const torqueVector = hingeAxisWorld.clone().multiplyScalar(desiredTorque);
      this.child.torqueAcc.add(torqueVector);
      this.parent.torqueAcc.sub(torqueVector);
    }

    // Active mechanical muscular work only (no passive constraint noise)
    return Math.abs(desiredTorque * this.currentRelAngularVel * dt);
  }

  public solveVelocityAndPositionConstraints(dt: number) {
    // 1. Point-to-Point Coincident Anchor Constraint with Full 3x3 Effective Mass Matrix K
    const r1 = this.parentLocalAnchor.clone().applyQuaternion(this.parent.rot);
    const r2 = this.childLocalAnchor.clone().applyQuaternion(this.child.rot);
    const p1 = this.parent.pos.clone().add(r1);
    const p2 = this.child.pos.clone().add(r2);
    const posError = p2.clone().sub(p1);
    this.anchorError = posError.length();

    // Relative anchor velocity: v_rel = (v2 + w2 x r2) - (v1 + w1 x r1)
    const v1 = this.parent.linVel.clone().add(this.parent.angVel.clone().cross(r1));
    const v2 = this.child.linVel.clone().add(this.child.angVel.clone().cross(r2));
    const vRel = v2.sub(v1);

    // Baumgarte stabilization term
    const beta = 0.15;
    const bias = posError.clone().multiplyScalar(beta / dt);
    const targetDeltaV = vRel.clone().add(bias).negate();

    // Construct full 3x3 K matrix: K = (1/m1 + 1/m2)*I - [r1_x] I1_inv [r1_x] - [r2_x] I2_inv [r2_x]
    const invI1 = new THREE.Matrix3();
    const invI2 = new THREE.Matrix3();
    this.parent.getInertiaTensorWorldInv(invI1);
    this.child.getInertiaTensorWorldInv(invI2);

    const m1_inv = this.parent.invMass;
    const m2_inv = this.child.invMass;

    // Helper: compute C = S * invI * S^T where S is the skew-symmetric cross-product matrix of r.
    // In Three.js, invI.elements is stored in column-major order:
    // [i00, i10, i20, i01, i11, i21, i02, i12, i22].
    // The returned array `out` is a 9-element 3x3 matrix in row-major order:
    // [C00, C01, C02, C10, C11, C12, C20, C21, C22].
    const computeRotInertiaContribution = (r: THREE.Vector3, invI: THREE.Matrix3, out: number[]) => {
      const el = invI.elements;
      const i00 = el[0], i10 = el[1], i20 = el[2];
      const i01 = el[3], i11 = el[4], i21 = el[5];
      const i02 = el[6], i12 = el[7], i22 = el[8];

      // S = [r_x]
      // Step 1: M = S * invI
      const m00 = -r.z * i10 + r.y * i20;
      const m01 = -r.z * i11 + r.y * i21;
      const m02 = -r.z * i12 + r.y * i22;

      const m10 = r.z * i00 - r.x * i20;
      const m11 = r.z * i01 - r.x * i21;
      const m12 = r.z * i02 - r.x * i22;

      const m20 = -r.y * i00 + r.x * i10;
      const m21 = -r.y * i01 + r.x * i11;
      const m22 = -r.y * i02 + r.x * i12;

      // Step 2: C = M * S^T
      out[0] = -m01 * r.z + m02 * r.y;
      out[1] = m00 * r.z - m02 * r.x;
      out[2] = -m00 * r.y + m01 * r.x;

      out[3] = -m11 * r.z + m12 * r.y;
      out[4] = m10 * r.z - m12 * r.x;
      out[5] = -m10 * r.y + m11 * r.x;

      out[6] = -m21 * r.z + m22 * r.y;
      out[7] = m20 * r.z - m22 * r.x;
      out[8] = -m20 * r.y + m21 * r.x;
    };

    const c1 = [0,0,0, 0,0,0, 0,0,0];
    const c2 = [0,0,0, 0,0,0, 0,0,0];
    computeRotInertiaContribution(r1, invI1, c1);
    computeRotInertiaContribution(r2, invI2, c2);

    const K = [
      m1_inv + m2_inv + c1[0] + c2[0], c1[1] + c2[1], c1[2] + c2[2],
      c1[3] + c2[3], m1_inv + m2_inv + c1[4] + c2[4], c1[5] + c2[5],
      c1[6] + c2[6], c1[7] + c2[7], m1_inv + m2_inv + c1[8] + c2[8]
    ];

    const invK = [0,0,0, 0,0,0, 0,0,0];
    if (invertMatrix3(K, invK)) {
      const impulse = new THREE.Vector3(
        invK[0]*targetDeltaV.x + invK[1]*targetDeltaV.y + invK[2]*targetDeltaV.z,
        invK[3]*targetDeltaV.x + invK[4]*targetDeltaV.y + invK[5]*targetDeltaV.z,
        invK[6]*targetDeltaV.x + invK[7]*targetDeltaV.y + invK[8]*targetDeltaV.z
      );

      // Clamp impulse for extreme stability
      const maxImpulse = 200.0;
      if (impulse.lengthSq() > maxImpulse * maxImpulse) {
        impulse.normalize().multiplyScalar(maxImpulse);
      }

      this.child.linVel.addScaledVector(impulse, m2_inv);
      this.parent.linVel.addScaledVector(impulse, -m1_inv);

      const torque2 = r2.clone().cross(impulse);
      const torque1 = r1.clone().cross(impulse.clone().negate());

      this.child.angVel.add(torque2.applyMatrix3(invI2));
      this.parent.angVel.add(torque1.applyMatrix3(invI1));
    }

    // 2. Angular Limit Enforcement along Hinge Axis
    const hingeWorld = this.getWorldHingeAxis();
    let limitImpulse = 0;
    if (this.currentAngle < this.minAngle) {
      const error = this.minAngle - this.currentAngle;
      const relW = this.child.angVel.clone().sub(this.parent.angVel).dot(hingeWorld);
      const K_ang = hingeWorld.clone().applyMatrix3(invI1).dot(hingeWorld) + hingeWorld.clone().applyMatrix3(invI2).dot(hingeWorld);
      if (K_ang > 1e-6) {
        limitImpulse = Math.max(0, (error * (0.2 / dt) - relW) / K_ang);
      }
    } else if (this.currentAngle > this.maxAngle) {
      const error = this.maxAngle - this.currentAngle;
      const relW = this.child.angVel.clone().sub(this.parent.angVel).dot(hingeWorld);
      const K_ang = hingeWorld.clone().applyMatrix3(invI1).dot(hingeWorld) + hingeWorld.clone().applyMatrix3(invI2).dot(hingeWorld);
      if (K_ang > 1e-6) {
        limitImpulse = Math.min(0, (error * (0.2 / dt) - relW) / K_ang);
      }
    }

    if (Math.abs(limitImpulse) > 1e-6) {
      const angImpulseVec = hingeWorld.clone().multiplyScalar(limitImpulse);
      this.child.angVel.add(angImpulseVec.clone().applyMatrix3(invI2));
      this.parent.angVel.sub(angImpulseVec.clone().applyMatrix3(invI1));
    }
  }
}
