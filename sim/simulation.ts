import * as THREE from 'three';
import { OrganismInstance, bodyLayout } from './organism';
import { PhysicsWorld, DEFAULT_WATER_RESISTANCE } from './physics';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { PRNG } from './prng';
import { createFounderGenome, mutateGenome } from './mutation';
import { OrganismGenome, getMouthApertureLocal, isContactingMouthAperture } from './genome';
import { basalUpkeepPerSecond, constructionEnergy, viableEggFunding } from './energy';

export interface Nutrient {
  id: string;
  pos: THREE.Vector3;
  energy: number;
}

export interface Egg {
  id: string;
  parentId: string;
  genome: OrganismGenome;
  pos: THREE.Vector3;
  fundingRemaining: number;
  initialFunding: number;
  incubationRemainingSec: number;
  rotation?: [number, number, number, number];
}

export interface EcosystemTelemetry {
  simulatedTimeSec: number;
  fps: number;
  physicsThroughput: number;
  achievedSimSpeed: number;
  organismCount: number;
  nutrientCount: number;
  eggCount: number;
  highestGeneration: number;
  totalBirths: number;
  totalDeaths: number;
  totalFoodConsumed: number;
  averageAnchorError: number;
  chemicalEnergyLedger: {
    totalInput: number;
    organismReserves: number;
    organismTissue: number;
    eggEnergy: number;
    nutrientEnergy: number;
    dissipatedMetabolicWork: number; // retained UI field: chemical heat, not mechanical joules
    mechanicalWorkJoules: number;
    externalRemovals: number;
    conservationResidual: number;
  };
}

export class WorldSimulation {
  public prng: PRNG;
  public organisms: OrganismInstance[] = [];
  public nutrients: Nutrient[] = [];
  public eggs: Egg[] = [];
  public tankBounds = new THREE.Vector3(26, 16, 26); // Physical interior: x/z [-13,13], y [1,15].
  public simTime: number = 0;
  public nutrientInflowPerSec: number = 15;
  public targetNutrientCount: number = 400;
  public maxOrganisms: number = 45;
  public totalBirths: number = 0;
  public totalDeaths: number = 0;
  public totalFoodConsumed: number = 0;
  public highestGenerationReached: number = 1;
  public externalEnergyAdded: number = 0;
  public externalEnergyRemoved: number = 0;
  public chemicalHeat: number = 0;
  public cumulativeMechanicalWorkJoules: number = 0;
  public nextIdCounter: number = 100;
  public waterDragCoeff: number = DEFAULT_WATER_RESISTANCE;
  public physics!: PhysicsWorld;
  public physicsStepCount: number = 0;
  private nutrientAccumulator: number = 0;

  constructor(seed: number = 4242, initialOrganisms: number = 14) {
    this.prng = new PRNG(seed);
    this.reset(initialOrganisms);
  }

  public reset(initialOrganisms: number = 14) {
    this.physics?.dispose();
    this.physics = new PhysicsWorld(this.tankBounds);
    this.organisms = [];
    this.nutrients = [];
    this.eggs = [];
    this.simTime = 0;
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.totalFoodConsumed = 0;
    this.highestGenerationReached = 1;
    this.externalEnergyAdded = 0;
    this.externalEnergyRemoved = 0;
    this.chemicalHeat = 0;
    this.cumulativeMechanicalWorkJoules = 0;
    this.nextIdCounter = 100;
    this.nutrientAccumulator = 0;
    this.physicsStepCount = 0;

    // Seed initial nutrients
    this.seedNutrients(this.targetNutrientCount);

    // Seed calibrated founder organisms
    for (let i = 0; i < initialOrganisms; i++) {
      const typeChoice = i % 3 === 0 ? 'planar_swimmer' : i % 3 === 1 ? '3d_serpent' : 'tri_limb';
      const genome = createFounderGenome(`founder-${i + 1}`, `V-Swimmer #${i + 1}`, this.prng, typeChoice);
      const pos = new THREE.Vector3(
        this.prng.range(-this.tankBounds.x * 0.4, this.tankBounds.x * 0.4),
        this.prng.range(3, this.tankBounds.y - 3),
        this.prng.range(-this.tankBounds.z * 0.4, this.tankBounds.z * 0.4)
      );
      const rot = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(this.prng.range(-0.3, 0.3), this.prng.range(0, Math.PI * 2), this.prng.range(-0.3, 0.3))
      );
      this.addOrganism(genome, pos, rot);
    }
  }

  public addOrganism(genome: OrganismGenome, pos: THREE.Vector3, rot: THREE.Quaternion = new THREE.Quaternion()): OrganismInstance {
    // External insertion can search nearby clear positions; internal hatching never teleports an egg.
    const offsets=[new THREE.Vector3()];
    for(const radius of [1.5,3,4.5,6]) for(const axis of [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)])
      for(const sign of [-1,1]) offsets.push(axis.clone().multiplyScalar(radius*sign));
    const place=offsets.map(v=>v.add(pos)).find(p=>this.canSpawn(genome,p,rot));
    if(!place) throw new Error('No clear space for this organism.');
    const org = this.constructOrganism(genome, place, rot);
    this.externalEnergyAdded += org.reserves + org.structuralEnergy;
    return org;
  }

  /** Internal construction does not count parent-funded births as external input. */
  private constructOrganism(genome: OrganismGenome, pos: THREE.Vector3, rot: THREE.Quaternion) {
    if (this.organisms.length >= this.maxOrganisms) throw new Error('Organism population limit reached.');
    const org = new OrganismInstance(genome, pos, rot, this.physics);
    this.organisms.push(org);
    return org;
  }

  /** Explicit user intervention; credits exactly the energy actually delivered. */
  public feedAllOrganisms(amount: number): number {
    if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid external feeding amount.');
    let added = 0;
    for (const org of this.organisms) {
      if (org.isDead) continue;
      const gain = Math.min(amount, Math.max(0, org.reserveCapacity - org.reserves));
      org.reserves += gain;
      added += gain;
    }
    this.externalEnergyAdded += added;
    return added;
  }

  public reproductionBlockReason(org: OrganismInstance): string | null {
    if (org.isDead || org.reserves <= 0) return 'Not alive';
    if (this.organisms.length + this.eggs.length >= this.maxOrganisms) return 'Population limit';
    if (org.ageSec - org.lastReproduceSec <= org.genome.metabolism.reproduceCooldownSec) return 'Reproduction cooldown';
    if (org.reserves <= org.genome.metabolism.reproduceReserveThreshold) return 'Below reproduction threshold';
    const funding = Math.max(org.genome.metabolism.eggEnergyFunding, viableEggFunding(org.genome));
    if (org.reserves - funding < Math.max(50, org.structuralEnergy * .25)) return 'Insufficient reserve after egg funding';
    return null;
  }

  /** Discard free nutrients explicitly as an external sink, never silently. */
  public clearFreeNutrients(): number {
    const removed = this.nutrients.reduce((sum, nutrient) => sum + nutrient.energy, 0);
    this.nutrients = [];
    this.externalEnergyRemoved += removed;
    return removed;
  }

  public seedNutrients(count: number) {
    for (let i = 0; i < count; i++) {
      const pos = new THREE.Vector3(
        this.prng.range(-this.tankBounds.x * 0.45, this.tankBounds.x * 0.45),
        this.prng.range(1.5, this.tankBounds.y - 1.5),
        this.prng.range(-this.tankBounds.z * 0.45, this.tankBounds.z * 0.45)
      );
      this.nutrients.push({
        id: `nut-${this.nextIdCounter++}`,
        pos,
        energy: 40,
      });
      this.externalEnergyAdded += 40;
    }
  }

  public stepOuterTick(outerDt: number = 1 / 60) {
    if(Math.abs(outerDt-1/60)>1e-12) throw new Error('Outer ticks must stay fixed at 1/60 s.');
    this.simTime += outerDt;

    // 1. Replenish nutrients if below target
    if (this.nutrientInflowPerSec > 0 && this.nutrients.length < this.targetNutrientCount) {
      this.nutrientAccumulator += this.nutrientInflowPerSec * outerDt;
      while (this.nutrientAccumulator >= 1 && this.nutrients.length < this.targetNutrientCount) {
        this.nutrientAccumulator -= 1;
        const pos = new THREE.Vector3(
          this.prng.range(-this.tankBounds.x * 0.45, this.tankBounds.x * 0.45),
          this.prng.range(1.5, this.tankBounds.y - 1.5),
          this.prng.range(-this.tankBounds.z * 0.45, this.tankBounds.z * 0.45)
        );
        this.nutrients.push({
          id: `nut-${this.nextIdCounter++}`,
          pos,
          energy: 40,
        });
        this.externalEnergyAdded += 40;
      }
    }

    // 2. Step Eggs
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      egg.incubationRemainingSec -= outerDt;
      if (egg.incubationRemainingSec <= 0) {
        const tissue = constructionEnergy(egg.genome);
        // A consumed/damaged egg cannot create unfunded tissue; transfer every
        // remaining unit into edible remains instead.
        if (egg.fundingRemaining < tissue + 1) {
          if (egg.fundingRemaining > 0) this.nutrients.push({
            id: `nut-${this.nextIdCounter++}`, pos: egg.pos.clone(), energy: egg.fundingRemaining
          });
          this.eggs.splice(i, 1);
          continue;
        }
        if (this.organisms.length >= this.maxOrganisms) continue;
        const rot = egg.rotation ? new THREE.Quaternion().fromArray(egg.rotation) : new THREE.Quaternion();
        if (!this.canSpawn(egg.genome, egg.pos, rot)) continue;
        const child = this.constructOrganism(egg.genome, egg.pos.clone(), rot);
        child.reserves = egg.fundingRemaining - child.structuralEnergy;
        // Egg funding was already deducted from the parent; no external grant.
        this.totalBirths++;
        this.highestGenerationReached = Math.max(this.highestGenerationReached, egg.genome.generation);
        this.eggs.splice(i, 1);
      }
    }

    // 3. Sensory updates & Brain step (Outer simulation frequency)
    for (const org of this.organisms) {
      if (org.isDead) continue;
      org.ageSec += outerDt;
      const upkeep = Math.min(Math.max(0, org.reserves), basalUpkeepPerSecond(org.genome) * outerDt);
      org.reserves -= upkeep;
      this.chemicalHeat += upkeep;
      this.populateSensoryInputs(org);
      org.brain.step(outerDt);
    }

    // 4. Run Two 1/120s Physics Substeps
    const substeps = 2;
    const subDt = outerDt / substeps;
    for (let sub = 0; sub < substeps; sub++) {
      this.physicsStepCount++;
      for (const org of this.organisms) {
        if (org.isDead) continue;
        org.preparePhysicsSubstep(subDt, this.waterDragCoeff);
      }
      this.physics.step(subDt);
      for(const org of this.organisms) {
        const oldCost = org.totalMotorChemicalSpent;
        const oldWork = org.totalWorkJoules;
        org.finishPhysicsSubstep(subDt);
        this.chemicalHeat += org.totalMotorChemicalSpent - oldCost;
        this.cumulativeMechanicalWorkJoules += org.totalWorkJoules - oldWork;
      }
    }

    // 5. Feeding, Reproduction, and Life cycles
    for (let oIdx = this.organisms.length - 1; oIdx >= 0; oIdx--) {
      const org = this.organisms[oIdx];
      if (org.isDead) continue;

      this.checkFeeding(org, outerDt);

      // Every egg must be paid for by the parent, including mutated anatomy.
      if (this.reproductionBlockReason(org) === null) {
        const childId = `org-${this.nextIdCounter++}`;
        let childGenome = mutateGenome(org.genome, this.prng, childId);
        if (childGenome === org.genome) {
          // Mutation failure must not reuse the live parent's object or ID.
          childGenome = JSON.parse(JSON.stringify(org.genome)) as OrganismGenome;
          childGenome.id = childId;
          childGenome.ancestorId = org.genome.id;
          childGenome.generation = org.genome.generation + 1;
        }
        const funding = Math.max(org.genome.metabolism.eggEnergyFunding, Math.ceil(viableEggFunding(childGenome)));
        if (org.reserves - funding >= Math.max(50, org.structuralEnergy * .25)) {
          org.reserves -= funding;
          org.lastReproduceSec = org.ageSec;
          this.eggs.push({
            id: `egg-${this.nextIdCounter++}`,
            parentId: org.genome.id,
            genome: childGenome,
            pos: org.com.clone().add(new THREE.Vector3(0, -0.4, 0)),
            rotation: org.bodies[0].rot.toArray() as [number, number, number, number],
            fundingRemaining: funding,
            initialFunding: funding,
            incubationRemainingSec: org.genome.metabolism.eggIncubationSec,
          });
        }
      }

      // Death check
      if (org.reserves <= 0 || org.ageSec >= org.genome.metabolism.lifespanSec) {
        org.isDead = true;
        this.totalDeaths++;
        const remains = org.structuralEnergy + Math.max(0, org.reserves);
        if (remains > 0) {
          const spawnCount = Math.min(6, Math.max(1, Math.ceil(remains / 40)));
          for (let k = 0; k < spawnCount; k++) {
            this.nutrients.push({
              id: `nut-${this.nextIdCounter++}`,
              pos: org.com.clone().add(new THREE.Vector3(
                this.prng.range(-0.5, 0.5), this.prng.range(-0.5, 0.5), this.prng.range(-0.5, 0.5)
              )),
              energy: remains / spawnCount,
            });
          }
        }
        org.dispose();
        this.organisms.splice(oIdx, 1);
      }
    }
  }

  public dispose() { this.physics.dispose(); }

  /** Conservative spawn clearance using exact oriented part boxes and full tank extents. */
  public canSpawn(genome: OrganismGenome, pos: THREE.Vector3, rot = new THREE.Quaternion()): boolean {
    let layout: ReturnType<typeof bodyLayout>;
    try { layout=bodyLayout(genome,pos,rot); } catch { return false; }
    for(const pose of layout) {
      const half=new THREE.Vector3(pose.gene.dimX,pose.gene.dimY,pose.gene.dimZ).multiplyScalar(.15);
      for(const x of [-1,1]) for(const y of [-1,1]) for(const z of [-1,1]) {
        const p=new THREE.Vector3(x*half.x,y*half.y,z*half.z).applyQuaternion(pose.rot).add(pose.pos);
        if(Math.abs(p.x)>this.tankBounds.x/2 || Math.abs(p.z)>this.tankBounds.z/2 || p.y<1 || p.y>this.tankBounds.y-1) return false;
      }
      for(const body of this.physics.bodies) {
        const box=new OBB(new THREE.Vector3(),new THREE.Vector3(body.dimX,body.dimY,body.dimZ).multiplyScalar(.5));
        box.applyMatrix4(new THREE.Matrix4().compose(body.pos,body.rot,new THREE.Vector3(1,1,1)));
        if(pose.box.intersectsOBB(box)) return false;
      }
    }
    return true;
  }

  private populateSensoryInputs(org: OrganismInstance) {
    let inIdx = 0;
    const inArr = org.brain.inputs;

    // 1. Joint angles & actual relative angular velocities
    for (const joint of org.joints) {
      inArr[inIdx++] = joint.currentAngle / Math.PI;
      inArr[inIdx++] = joint.currentRelAngularVel / 5.0;
    }

    // 2. Normalized reserves and primary joint phase
    inArr[inIdx++] = Math.min(1.0, Math.max(0, org.reserves / org.reserveCapacity));
    const primPhase = org.joints[0]?.jointPhase || 0;
    inArr[inIdx++] = Math.sin(primPhase);
    inArr[inIdx++] = Math.cos(primPhase);

    // 3. Eye 3D RGB Raycasting (3x3 cone)
    org.eyeRayRGBs = [];
    for (const body of org.bodies) {
      if (body.partGene.hasEye) {
        const eyeOrigin = body.pos.clone();
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(body.rot);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(body.rot);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(body.rot);

        for (let ry = -1; ry <= 1; ry++) {
          for (let rx = -1; rx <= 1; rx++) {
            const rayDir = fwd.clone()
              .addScaledVector(right, rx * 0.3)
              .addScaledVector(up, ry * 0.3)
              .normalize();

            const hitColor = this.castVisionRay(eyeOrigin, rayDir, org, body.partGene.eyeRange || 20);
            org.eyeRayRGBs.push(hitColor);
            inArr[inIdx++] = hitColor.r;
            inArr[inIdx++] = hitColor.g;
            inArr[inIdx++] = hitColor.b;
          }
        }
      }
    }

    // 4. Contact signals
    for (let k = 0; k < org.bodies.length; k++) {
      inArr[inIdx++] = 0;
    }
  }

  private castVisionRay(origin: THREE.Vector3, dir: THREE.Vector3, selfOrg: OrganismInstance, maxRange: number): THREE.Color {
    let closestDist = maxRange;
    const hitColor = new THREE.Color(0.04, 0.1, 0.2);
    const ray = new THREE.Ray(origin, dir);

    // Nutrients (Emerald Green)
    for (const nut of this.nutrients) {
      const d = ray.distanceToPoint(nut.pos);
      if (d < 0.6) {
        const dist = origin.distanceTo(nut.pos);
        if (dist < closestDist) {
          closestDist = dist;
          hitColor.setRGB(0.1, 0.9, 0.4);
        }
      }
    }

    // Eggs (Amber)
    for (const egg of this.eggs) {
      const d = ray.distanceToPoint(egg.pos);
      if (d < 0.7) {
        const dist = origin.distanceTo(egg.pos);
        if (dist < closestDist) {
          closestDist = dist;
          hitColor.setRGB(0.95, 0.8, 0.2);
        }
      }
    }

    // Other organisms
    for (const other of this.organisms) {
      if (other === selfOrg) continue;
      for (const b of other.bodies) {
        const d = ray.distanceToPoint(b.pos);
        if (d < 0.8) {
          const dist = origin.distanceTo(b.pos);
          if (dist < closestDist) {
            closestDist = dist;
            hitColor.set(other.genome.color);
          }
        }
      }
    }

    return hitColor;
  }

  private checkFeeding(org: OrganismInstance, dt: number) {
    if (org.isDead) return;

    // Specialist intake rates (J / simulated second)
    const NUTRIENT_RATE_HERB = 60.0;
    const EGG_RATE_CARN = 50.0;
    const PREY_RATE_CARN = 50.0;
    const TROPHIC_EFFICIENCY = 0.8; // 20% metabolic loss on predation

    for (const body of org.bodies) {
      if (!body.partGene.hasMouth) continue;

      const diet = body.partGene.mouthDiet || 'herbivore';
      const face = body.partGene.mouthFace || '-Z';
      const ap = getMouthApertureLocal(face, body.partGene.dimX, body.partGene.dimY, body.partGene.dimZ);
      const mouthWorldPos = ap.localPos.clone().applyQuaternion(body.rot).add(body.pos);
      const mouthWorldNormal = ap.localNormal.clone().applyQuaternion(body.rot).normalize();
      const mouthRadius = ap.radius;

      // 1. Nutrients (Herbivores: 1.0 rate, Omnivores: 0.5 rate, Carnivores: 0 rate)
      if (diet === 'herbivore' || diet === 'omnivore') {
        const rateFactor = diet === 'omnivore' ? 0.5 : 1.0;
        const maxIntake = NUTRIENT_RATE_HERB * rateFactor * dt;

        for (let i = this.nutrients.length - 1; i >= 0; i--) {
          const nut = this.nutrients[i];
          if (isContactingMouthAperture(mouthWorldPos, mouthWorldNormal, mouthRadius, nut.pos, 0.25)) {
            const intake = Math.min(nut.energy, maxIntake, Math.max(0, org.reserveCapacity - org.reserves));
              if (intake > 0) {
                nut.energy -= intake;
                org.reserves += intake;
                org.totalFoodEaten += intake;
                this.totalFoodConsumed += intake;
                org.lastFeedingHighlightSec[body.id] = this.simTime;
                org.recentFeedingEvents.unshift({
                  timeSec: this.simTime,
                  partId: body.id,
                  mouthFace: face,
                  foodType: 'nutrient',
                  energyGained: intake,
                });
                if (org.recentFeedingEvents.length > 8) org.recentFeedingEvents.pop();

                if (nut.energy <= 1e-9) {
                  // Retain numerical slivers as explicitly accounted chemical heat.
                  this.chemicalHeat += Math.max(0, nut.energy);
                  this.nutrients.splice(i, 1);
                }
              }
            break; // One nutrient ingested per mouth per step
          }
        }
      }

      // 2. Eggs (Carnivores: 1.0 rate, Omnivores: 0.5 rate, Herbivores: 0 rate)
      // Preserves own-egg protection: egg.parentId !== org.genome.id
      if (diet === 'carnivore' || diet === 'omnivore') {
        const rateFactor = diet === 'omnivore' ? 0.5 : 1.0;
        const maxIntake = EGG_RATE_CARN * rateFactor * dt;

        for (let i = this.eggs.length - 1; i >= 0; i--) {
          const egg = this.eggs[i];
          if (egg.parentId !== org.genome.id) {
            if (isContactingMouthAperture(mouthWorldPos, mouthWorldNormal, mouthRadius, egg.pos, 0.35)) {
              const intake = Math.min(egg.fundingRemaining, maxIntake, Math.max(0, org.reserveCapacity - org.reserves) / TROPHIC_EFFICIENCY);
              if (intake > 0) {
                egg.fundingRemaining -= intake; // Deduct from egg FIRST
                const gained = intake * TROPHIC_EFFICIENCY;
                this.chemicalHeat += intake - gained;
                org.reserves += gained;
                org.totalFoodEaten += gained;
                this.totalFoodConsumed += gained;
                org.lastFeedingHighlightSec[body.id] = this.simTime;
                org.recentFeedingEvents.unshift({
                  timeSec: this.simTime,
                  partId: body.id,
                  mouthFace: face,
                  foodType: 'egg',
                  energyGained: gained,
                });
                if (org.recentFeedingEvents.length > 8) org.recentFeedingEvents.pop();

                if (egg.fundingRemaining <= 1e-9) {
                  this.chemicalHeat += Math.max(0, egg.fundingRemaining);
                  this.eggs.splice(i, 1);
                }
              }
              break;
            }
          }
        }
      }

      // 3. Live Organism Predation (Carnivores: 1.0 rate, Omnivores: 0.5 rate, Herbivores: 0 rate)
      // Prevents self-biting: prey !== org
      if (diet === 'carnivore' || diet === 'omnivore') {
        const rateFactor = diet === 'omnivore' ? 0.5 : 1.0;
        const maxIntake = PREY_RATE_CARN * rateFactor * dt;

        for (const prey of this.organisms) {
          if (prey === org || prey.isDead || prey.reserves <= 0) continue;

          let contacted = false;
          for (const preyBody of prey.bodies) {
            const preyBodyRadius = Math.min(preyBody.dimX, preyBody.dimY, preyBody.dimZ) * 0.5 + 0.1;
            if (isContactingMouthAperture(mouthWorldPos, mouthWorldNormal, mouthRadius, preyBody.pos, preyBodyRadius)) {
              contacted = true;
              break;
            }
          }

          if (contacted) {
            const intake = Math.min(prey.reserves, maxIntake, Math.max(0, org.reserveCapacity - org.reserves) / TROPHIC_EFFICIENCY);
            if (intake > 0) {
              prey.reserves -= intake; // Subtract from prey FIRST
              const gained = intake * TROPHIC_EFFICIENCY;
              this.chemicalHeat += intake - gained;
              org.reserves += gained; // Credit predator after losses
              org.totalFoodEaten += gained;
              this.totalFoodConsumed += gained;
              org.lastFeedingHighlightSec[body.id] = this.simTime;
              org.recentFeedingEvents.unshift({
                timeSec: this.simTime,
                partId: body.id,
                mouthFace: face,
                foodType: 'prey',
                energyGained: gained,
              });
              if (org.recentFeedingEvents.length > 8) org.recentFeedingEvents.pop();
            }
            break;
          }
        }
      }
    }
  }

  public getTelemetry(renderFps: number = 60, measuredStepsPerSec: number = 120, achievedSpeed: number = 1.0): EcosystemTelemetry {
    let orgReserves = 0;
    let orgTissue = 0;
    let totalAnchorError = 0;
    let jointCount = 0;

    for (const o of this.organisms) {
      orgReserves += Math.max(0, o.reserves);
      orgTissue += o.structuralEnergy;
      for (const j of o.joints) {
        totalAnchorError += j.anchorError;
        jointCount++;
      }
    }

    let eggEnergy = 0;
    for (const e of this.eggs) eggEnergy += e.fundingRemaining;

    let nutEnergy = 0;
    for (const n of this.nutrients) nutEnergy += n.energy;

    return {
      simulatedTimeSec: this.simTime,
      fps: renderFps,
      physicsThroughput: measuredStepsPerSec,
      achievedSimSpeed: achievedSpeed,
      organismCount: this.organisms.length,
      nutrientCount: this.nutrients.length,
      eggCount: this.eggs.length,
      highestGeneration: this.highestGenerationReached,
      totalBirths: this.totalBirths,
      totalDeaths: this.totalDeaths,
      totalFoodConsumed: this.totalFoodConsumed,
      averageAnchorError: jointCount > 0 ? totalAnchorError / jointCount : 0,
      chemicalEnergyLedger: {
        totalInput: this.externalEnergyAdded,
        organismReserves: orgReserves,
        organismTissue: orgTissue,
        eggEnergy,
        nutrientEnergy: nutEnergy,
        dissipatedMetabolicWork: this.chemicalHeat,
        mechanicalWorkJoules: this.cumulativeMechanicalWorkJoules,
        externalRemovals: this.externalEnergyRemoved,
        conservationResidual: this.externalEnergyAdded - this.externalEnergyRemoved -
          (orgReserves + orgTissue + eggEnergy + nutEnergy + this.chemicalHeat),
      },
    };
  }
}
