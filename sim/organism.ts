import * as THREE from 'three';
import { FaceDirection, OrganismGenome, VoxelPartGene, VOXEL_UNIT } from './genome';
import { RigidCuboid, RevoluteJoint } from './physics';

export class BrainInstance {
  public hiddenState: Float32Array;
  public prevHiddenState: Float32Array;
  public inputs: Float32Array;
  public outputs: Float32Array;
  public genome: any;

  constructor(genome: any, inputCount: number, outputCount: number) {
    this.genome = genome;
    this.hiddenState = new Float32Array(genome.hiddenCount);
    this.prevHiddenState = new Float32Array(genome.hiddenCount);
    this.inputs = new Float32Array(inputCount);
    this.outputs = new Float32Array(outputCount);
  }

  public step(dt: number) {
    const H = this.genome.hiddenCount;
    const I = this.inputs.length;
    const O = this.outputs.length;

    for (let h = 0; h < H; h++) {
      this.prevHiddenState[h] = this.hiddenState[h];
    }

    // Leaky recurrent integration: target = tanh(W_in * input + W_rec * prevHidden + bias)
    for (let h = 0; h < H; h++) {
      let sum = this.genome.biases[h] || 0;
      const inW = this.genome.inputWeights[h];
      if (inW) {
        for (let i = 0; i < I && i < inW.length; i++) {
          sum += inW[i] * this.inputs[i];
        }
      }
      const recW = this.genome.recurrentWeights[h];
      if (recW) {
        for (let j = 0; j < H && j < recW.length; j++) {
          sum += recW[j] * this.prevHiddenState[j];
        }
      }
      const target = Math.tanh(sum);
      const tau = Math.max(0.02, this.genome.timeConstants[h] || 0.1);
      const alpha = 1 - Math.exp(-dt / tau);
      this.hiddenState[h] = this.prevHiddenState[h] + alpha * (target - this.prevHiddenState[h]);
    }

    for (let o = 0; o < O; o++) {
      let sum = (this.genome.outputBiases && this.genome.outputBiases[o]) || 0;
      const outW = this.genome.outputWeights[o];
      if (outW) {
        for (let h = 0; h < H && h < outW.length; h++) {
          sum += outW[h] * this.hiddenState[h];
        }
      }
      this.outputs[o] = Math.tanh(sum);
    }
  }
}

export interface FeedingEvent {
  timeSec: number;
  partId: string;
  mouthFace: FaceDirection;
  foodType: 'nutrient' | 'egg' | 'prey';
  energyGained: number;
}

export class OrganismInstance {
  public genome: OrganismGenome;
  public bodies: RigidCuboid[] = [];
  public joints: RevoluteJoint[] = [];
  public brain: BrainInstance;
  public reserves: number = 250;
  public structuralEnergy: number = 100;
  public ageSec: number = 0;
  public isDead: boolean = false;
  public lastReproduceSec: number = 0;
  public totalFoodEaten: number = 0;
  public totalWorkJoules: number = 0;
  public eyeRayRGBs: THREE.Color[] = [];
  public com: THREE.Vector3 = new THREE.Vector3();
  public comVel: THREE.Vector3 = new THREE.Vector3();
  public mass: number = 1;
  public motorsEnabled: boolean = true;
  public hasPhysicsError: boolean = false;
  public lastFeedingHighlightSec: Record<string, number> = {};
  public recentFeedingEvents: FeedingEvent[] = [];

  constructor(genome: OrganismGenome, spawnPos: THREE.Vector3, spawnRot: THREE.Quaternion = new THREE.Quaternion()) {
    this.genome = genome;

    let totalInputs = 0;
    let totalOutputs = 0;

    for (let i = 1; i < genome.parts.length; i++) {
      totalInputs += 2;
      totalOutputs += 4;
    }
    totalInputs += 3;

    for (const p of genome.parts) {
      if (p.hasEye) totalInputs += 27;
      if (p.hasMouth) totalInputs += 1;
    }
    totalInputs += genome.parts.length;

    this.brain = new BrainInstance(genome.brain, totalInputs, Math.max(4, totalOutputs));
    this.initPhysicsHierarchy(spawnPos, spawnRot);
  }

  private getFaceOffset(face: FaceDirection, dimX: number, dimY: number, dimZ: number): THREE.Vector3 {
    const halfX = (dimX * VOXEL_UNIT) / 2;
    const halfY = (dimY * VOXEL_UNIT) / 2;
    const halfZ = (dimZ * VOXEL_UNIT) / 2;

    switch (face) {
      case '+X': return new THREE.Vector3(halfX, 0, 0);
      case '-X': return new THREE.Vector3(-halfX, 0, 0);
      case '+Y': return new THREE.Vector3(0, halfY, 0);
      case '-Y': return new THREE.Vector3(0, -halfY, 0);
      case '+Z': return new THREE.Vector3(0, 0, halfZ);
      case '-Z': return new THREE.Vector3(0, 0, -halfZ);
      default: return new THREE.Vector3(0, 0, halfZ);
    }
  }

  public initPhysicsHierarchy(spawnPos: THREE.Vector3, spawnRot: THREE.Quaternion) {
    this.bodies = [];
    this.joints = [];
    this.mass = 0;

    const partMap = new Map<string, RigidCuboid>();

    // 1. Instantiate Rigid Bodies
    for (let i = 0; i < this.genome.parts.length; i++) {
      const g = this.genome.parts[i];
      const body = new RigidCuboid(g, 1000);
      this.bodies.push(body);
      partMap.set(g.id, body);
      this.mass += body.mass;

      if (i === 0) {
        body.pos.copy(spawnPos);
        body.rot.copy(spawnRot).normalize();
      }
    }

    // 2. Compute tree placements so anchors coincide at rest:
    // parentPos + parentRot * parentAnchor = childPos + childRot * childAnchor
    for (let i = 1; i < this.genome.parts.length; i++) {
      const g = this.genome.parts[i];
      const childBody = this.bodies[i];
      const parentBody = partMap.get(g.parentId || '') || this.bodies[0];

      const pFace = g.parentFace || '+Z';
      const cFace = g.attachFace || '-Z';

      const parentLocalAnchor = this.getFaceOffset(pFace, parentBody.partGene.dimX, parentBody.partGene.dimY, parentBody.partGene.dimZ);
      const childLocalAnchor = this.getFaceOffset(cFace, g.dimX, g.dimY, g.dimZ);

      // Child rest rotation
      const hingeAxis = g.hingeAxis === 'X' ? new THREE.Vector3(1, 0, 0) : g.hingeAxis === 'Y' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
      const restRelRot = new THREE.Quaternion().setFromAxisAngle(hingeAxis, g.restAngle);
      childBody.rot.copy(parentBody.rot).multiply(restRelRot).normalize();

      // World anchor of parent
      const parentWorldAnchor = parentLocalAnchor.clone().applyQuaternion(parentBody.rot).add(parentBody.pos);
      // Position child so childWorldAnchor == parentWorldAnchor
      const childAnchorRotated = childLocalAnchor.clone().applyQuaternion(childBody.rot);
      childBody.pos.copy(parentWorldAnchor).sub(childAnchorRotated);

      // Create Revolute Joint
      const joint = new RevoluteJoint(
        parentBody,
        childBody,
        parentLocalAnchor,
        childLocalAnchor,
        g.hingeAxis,
        g.minAngle,
        g.maxAngle,
        g.restAngle,
        g.motorMaxTorque,
        g.motorPhase
      );
      this.joints.push(joint);
    }

    this.updateCOM();
  }

  public updateCOM() {
    this.com.set(0, 0, 0);
    this.comVel.set(0, 0, 0);
    let totalMass = 0;
    for (const b of this.bodies) {
      if (isNaN(b.pos.x) || isNaN(b.linVel.x)) {
        this.hasPhysicsError = true;
        continue;
      }
      totalMass += b.mass;
      this.com.addScaledVector(b.pos, b.mass);
      this.comVel.addScaledVector(b.linVel, b.mass);
    }
    if (totalMass > 0) {
      this.com.divideScalar(totalMass);
      this.comVel.divideScalar(totalMass);
    }
  }

  public updatePhysicsSubstep(subDt: number, mu: number) {
    if (this.isDead || this.hasPhysicsError) return;

    // 1. Update Joint kinematics (angles, relative velocities, anchor errors)
    for (const joint of this.joints) {
      joint.updateJointKinematics();
    }

    // 2. Apply Hydrodynamics to all bodies
    for (const body of this.bodies) {
      body.applyHydrodynamics(mu);
    }

    // 3. Integrate oscillator phase & Motor drives
    let outIdx = 0;
    for (let j = 0; j < this.joints.length; j++) {
      const joint = this.joints[j];
      const g = joint.child.partGene;

      // Check available energy: if reserves depleted, motor torque is zero
      const hasEnergy = this.reserves > 0 && this.motorsEnabled;
      const neuralOffset = (this.brain.outputs[outIdx] || 0) * (g.maxAngle - g.minAngle) * 0.5;
      const freqMod = 1.0 + (this.brain.outputs[outIdx + 1] || 0) * 0.5;
      const instFreq = Math.max(0.05, g.motorFrequency * freqMod);
      const torqueAllowance = hasEnergy ? Math.max(0, (this.brain.outputs[outIdx + 2] + 1) * 0.5 * g.motorMaxTorque) : 0;
      const stiffness = Math.max(0.5, (this.brain.outputs[outIdx + 3] + 1) * 0.5 * 25);
      const damping = 2.0;
      outIdx += 4;

      // Integrate joint oscillator phase continuously
      joint.jointPhase = (joint.jointPhase + 2 * Math.PI * instFreq * subDt) % (2 * Math.PI);

      // Target angle = restAngle + neuralOffset + strokeAmp * sin(phase)
      const strokeAmp = (g.maxAngle - g.minAngle) * 0.45;
      const oscAngle = strokeAmp * Math.sin(joint.jointPhase);
      const targetAngle = g.restAngle + neuralOffset + oscAngle;

      const workJoules = joint.applyMotorAndLimits(targetAngle, torqueAllowance, stiffness, damping, subDt);
      this.totalWorkJoules += workJoules;
      // Deduct only actual muscular work, ensuring reserves never drop below 0
      const cost = workJoules * 0.005;
      this.reserves = Math.max(0, this.reserves - cost);
    }

    // 4. Integrate Forces and Torques into Velocities
    for (const body of this.bodies) {
      body.integrateForces(subDt);
    }

    // 5. Projected Gauss-Seidel Constraint Solver (Anchors & Limits)
    for (let iter = 0; iter < 6; iter++) {
      for (const joint of this.joints) {
        joint.solveVelocityAndPositionConstraints(subDt);
      }
    }

    // 6. Integrate Velocities into Positions & Orientations
    for (const body of this.bodies) {
      body.integrateVelocity(subDt);
    }

    this.updateCOM();
  }
}
