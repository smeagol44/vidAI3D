import * as THREE from 'three';
import { FaceDirection, OrganismGenome, VoxelPartGene, isBroadFace, partPhysicalSize, MIN_THICKNESS_SCALE_Y } from './genome';
import { RigidCuboid, RevoluteJoint, PhysicsWorld, PHYSICS_DT, faceAnchor, faceNormal, axisVector } from './physics';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { constructionEnergy, founderReserve, reserveCapacity, CHEMICAL_UNITS_PER_MOTOR_JOULE } from './energy';
import { strokeWave, recoveryFeatherWeight } from './gait';

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

export function bodyLayout(genome: OrganismGenome, position: THREE.Vector3, rotation: THREE.Quaternion) {
  if (!genome.parts?.length || genome.parts.length > 10 || genome.parts.filter(p => p.parentId === null).length !== 1)
    throw new Error('An organism must have exactly one root and 1–10 parts.');
  if (!position.toArray().every(Number.isFinite) || !rotation.toArray().every(Number.isFinite) || rotation.lengthSq() < .99)
    throw new Error('Invalid organism transform.');
  const poses = new Map<string, { gene: VoxelPartGene; pos: THREE.Vector3; rot: THREE.Quaternion; alignment: THREE.Quaternion; box: OBB }>();
  const ids = new Set<string>();
  for (const p of genome.parts) {
    if (ids.has(p.id) || !['X','Y','Z'].includes(p.hingeAxis) || ![p.dimX,p.dimY,p.dimZ].every(n=>Number.isInteger(n)&&n>=1&&n<=5)
      || (p.thicknessScaleY !== undefined && (!Number.isFinite(p.thicknessScaleY) || p.thicknessScaleY < MIN_THICKNESS_SCALE_Y || p.thicknessScaleY > 1))
      || (p.motorStrokeDuty !== undefined && (!Number.isFinite(p.motorStrokeDuty) || p.motorStrokeDuty < .2 || p.motorStrokeDuty > .8))
      || (p.motorFeatherAngle !== undefined && (!Number.isFinite(p.motorFeatherAngle) || Math.abs(p.motorFeatherAngle) > Math.PI / 2))
      || ![p.minAngle,p.maxAngle,p.restAngle,p.motorMaxTorque,p.motorFrequency,p.motorPhase].every(Number.isFinite)
      || p.minAngle > p.maxAngle || p.restAngle < p.minAngle || p.restAngle > p.maxAngle || p.minAngle <= -Math.PI || p.maxAngle >= Math.PI || p.motorMaxTorque < 0 || p.motorFrequency < 0)
      throw new Error('Invalid physical part: ' + p.id);
    ids.add(p.id);
  }
  let pending = [...genome.parts];
  while (pending.length) {
    const next: VoxelPartGene[] = [];
    for (const p of pending) {
      if (p.parentId !== null && !poses.has(p.parentId)) { next.push(p); continue; }
      let pos = position.clone(), rot = rotation.clone().normalize(), alignment = new THREE.Quaternion();
      if (p.parentId !== null) {
        if (!p.parentFace || !p.attachFace || !['+X','-X','+Y','-Y','+Z','-Z'].includes(p.parentFace) || !['+X','-X','+Y','-Y','+Z','-Z'].includes(p.attachFace)) throw new Error('Invalid attachment face: '+p.id);
        const parent = poses.get(p.parentId)!;
        if(isBroadFace(p.parentFace,parent.gene.dimX,parent.gene.dimY,parent.gene.dimZ,parent.gene.thicknessScaleY)&&isBroadFace(p.attachFace,p.dimX,p.dimY,p.dimZ,p.thicknessScaleY))
          throw new Error('Broad-to-broad attachment: '+p.id);
        alignment.setFromUnitVectors(faceNormal(p.attachFace), faceNormal(p.parentFace).negate());
        rot = parent.rot.clone().multiply(new THREE.Quaternion().setFromAxisAngle(axisVector(p.hingeAxis), THREE.MathUtils.clamp(p.restAngle,p.minAngle,p.maxAngle))).multiply(alignment).normalize();
        pos = faceAnchor(p.parentFace,parent.gene).applyQuaternion(parent.rot).add(parent.pos)
          .sub(faceAnchor(p.attachFace,p).applyQuaternion(rot));
      }
      const half = new THREE.Vector3(...partPhysicalSize(p)).multiplyScalar(.5);
      const box = new OBB(new THREE.Vector3(),half.clone().addScalar(-1e-5));
      box.applyMatrix4(new THREE.Matrix4().compose(pos,rot,new THREE.Vector3(1,1,1)));
      for (const other of poses.values()) if (box.intersectsOBB(other.box)) throw new Error('Overlapping rest anatomy: '+p.id+' / '+other.gene.id);
      poses.set(p.id,{gene:p,pos,rot,alignment,box});
    }
    if (next.length === pending.length) throw new Error('Disconnected or cyclic body tree.');
    pending = next;
  }
  return genome.parts.map(p=>poses.get(p.id)!);
}

export class OrganismInstance {
  public genome: OrganismGenome;
  public bodies: RigidCuboid[] = [];
  public joints: RevoluteJoint[] = [];
  public brain: BrainInstance;
  public reserves: number;
  public structuralEnergy: number;
  public reserveCapacity: number;
  public totalMotorChemicalSpent: number = 0;
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

  readonly physics: PhysicsWorld;
  private readonly ownsPhysics: boolean;
  private disposed = false;

  constructor(genome: OrganismGenome, spawnPos: THREE.Vector3, spawnRot = new THREE.Quaternion(), physics?: PhysicsWorld) {
    const layout = bodyLayout(genome,spawnPos,spawnRot);
    this.genome = genome;
    this.structuralEnergy = constructionEnergy(genome);
    this.reserveCapacity = reserveCapacity(genome);
    this.reserves = founderReserve(genome);
    this.ownsPhysics = !physics;
    this.physics = physics ?? new PhysicsWorld();
    const inputCount = (genome.parts.length-1)*2 + 3 + genome.parts.reduce((n,p)=>n+(p.hasEye?27:0)+(p.hasMouth?1:0)+1,0);
    this.brain = new BrainInstance(genome.brain,inputCount,Math.max(4,(genome.parts.length-1)*4));
    for (const pose of layout) this.bodies.push(new RigidCuboid(this.physics,pose.gene,pose.pos,pose.rot));
    const bodies = new Map(this.bodies.map(b=>[b.id,b]));
    for (const pose of layout) {
      const g=pose.gene;
      if (g.parentId === null) continue;
      const parent=bodies.get(g.parentId)!, child=bodies.get(g.id)!;
      this.joints.push(new RevoluteJoint(parent,child,faceAnchor(g.parentFace!,parent.partGene),faceAnchor(g.attachFace!,g),
        g.hingeAxis,g.minAngle,g.maxAngle,g.restAngle,g.motorMaxTorque,g.motorPhase,pose.alignment));
    }
    this.updateCOM();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.ownsPhysics) this.physics.dispose();
    else for(const b of this.bodies) b.dispose();
  }

  public updateCOM() {
    this.com.set(0,0,0); this.comVel.set(0,0,0); this.mass=0;
    for(const b of this.bodies) {
      const values=[...b.pos.toArray(),...b.rot.toArray(),...b.linVel.toArray(),...b.angVel.toArray()];
      if(!values.every(Number.isFinite)) { this.hasPhysicsError=true; throw new Error('Non-finite organism: '+this.genome.id); }
      this.mass+=b.mass; this.com.addScaledVector(b.pos,b.mass); this.comVel.addScaledVector(b.linVel,b.mass);
    }
    this.com.divideScalar(this.mass); this.comVel.divideScalar(this.mass);
  }

  preparePhysicsSubstep(subDt: number, mu: number) {
    if (this.disposed) throw new Error('Organism has been disposed.');
    if(Math.abs(subDt-PHYSICS_DT)>1e-12) throw new Error('Physics timestep must stay fixed at 1/120 s.');
    if(this.isDead) return;
    for(const joint of this.joints) joint.updateJointKinematics();
    for(const b of this.bodies) b.applyHydrodynamics(mu);
    if(!Array.from(this.brain.outputs).every(Number.isFinite)) throw new Error('Non-finite neural motor command.');
    // Couple the inherited multi-joint gait instead of letting independent neural
    // frequency perturbations accumulate unlimited phase drift. The first joint is
    // the carrier; all joints still respond to their own neural frequency commands,
    // and inherited phase offsets (which mutation can change) remain authoritative.
    // This is oscillator coordination, not a force or position correction.
    const leader = this.joints[0];
    const leaderPhase = leader?.jointPhase ?? 0;
    const leaderGeneticPhase = leader?.child.partGene.motorPhase ?? 0;
    const phaseCouplingPerSecond = 3;
    // Snapshot phases before applying this substep. Child fin-pitch joints
    // feather in response to the parent stalk's *physical motor oscillator*,
    // never an animation-only timer or an imposed body translation.
    const phases = new Map(this.joints.map(j => [j.child.id, j.jointPhase]));
    const genesByChild = new Map(this.joints.map(j => [j.child.id, j.child.partGene]));
    let outIdx=0;
    for(const joint of this.joints) {
      const g=joint.child.partGene, outputs=this.brain.outputs;
      const offset=(outputs[outIdx]||0)*(g.maxAngle-g.minAngle)*.5;
      const frequency=g.motorFrequency*(1+(outputs[outIdx+1]||0)*.5);
      const allowance=this.reserves>0&&this.motorsEnabled ? Math.max(0,((outputs[outIdx+2]??0)+1)*.5*g.motorMaxTorque) : 0;
      const stiffness=Math.max(0,((outputs[outIdx+3]??0)+1)*.5*900);
      const desiredDifference = g.motorPhase - leaderGeneticPhase;
      const differenceError = joint.jointPhase - leaderPhase - desiredDifference;
      const wrappedError = Math.atan2(Math.sin(differenceError), Math.cos(differenceError));
      const correction = joint === leader ? 0 : -phaseCouplingPerSecond * wrappedError;
      joint.jointPhase=THREE.MathUtils.euclideanModulo(joint.jointPhase+(2*Math.PI*frequency+correction)*subDt,2*Math.PI);
      const parentPhase = phases.get(g.parentId ?? '');
      const parentGene = genesByChild.get(g.parentId ?? '');
      // Relative-frequency neural output on the feather motor must still matter.
      // The child oscillator is entrained to the parent but can lead/lag its
      // inherited offset through its own independent neural frequency channel.
      const inheritedOffset = g.motorPhase - (parentGene?.motorPhase ?? 0);
      const phaseError = parentPhase === undefined ? 0 : Math.atan2(
        Math.sin(joint.jointPhase - parentPhase - inheritedOffset),
        Math.cos(joint.jointPhase - parentPhase - inheritedOffset));
      const featherPhase = (parentPhase ?? joint.jointPhase) + phaseError;
      const target = g.motorFeatherAngle === undefined
        ? g.restAngle + offset + (g.maxAngle-g.minAngle) * .45 * strokeWave(joint.jointPhase, g.motorStrokeDuty ?? .5)
        : THREE.MathUtils.clamp(
            g.restAngle + offset + g.motorFeatherAngle * recoveryFeatherWeight(featherPhase),
            g.minAngle, g.maxAngle
          );
      joint.applyMotorAndLimits(target,allowance,stiffness,60);
      outIdx+=4;
    }
  }
  finishPhysicsSubstep(subDt: number) {
    if(this.isDead) return;
    for(const joint of this.joints) {
      joint.updateJointKinematics();
      const work=joint.motorWork(subDt);
      this.totalWorkJoules+=work;
      // Existing chemical conversion retained for this physics-only change; full ledger repair is separate.
      const spent = Math.min(Math.max(0, this.reserves), work * CHEMICAL_UNITS_PER_MOTOR_JOULE);
      this.reserves -= spent;
      this.totalMotorChemicalSpent += spent;
    }
    this.updateCOM();
  }
  public updatePhysicsSubstep(subDt=PHYSICS_DT, mu=250) {
    if(!this.ownsPhysics) throw new Error('Shared organisms must be stepped by WorldSimulation.');
    this.preparePhysicsSubstep(subDt,mu); this.physics.step(subDt); this.finishPhysicsSubstep(subDt);
  }
}
