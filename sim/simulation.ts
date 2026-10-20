import * as THREE from 'three';
import { OrganismInstance } from './organism';
import { PRNG } from './prng';
import { createFounderGenome, mutateGenome } from './mutation';
import { OrganismGenome, getMouthApertureLocal, isContactingMouthAperture } from './genome';

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
    dissipatedMetabolicWork: number;
  };
}

export class WorldSimulation {
  public prng: PRNG;
  public organisms: OrganismInstance[] = [];
  public nutrients: Nutrient[] = [];
  public eggs: Egg[] = [];
  public tankBounds = new THREE.Vector3(26, 16, 26); // Tank bounds [-13..13, 1..17, -13..13]
  public simTime: number = 0;
  public nutrientInflowPerSec: number = 15;
  public targetNutrientCount: number = 400;
  public maxOrganisms: number = 45;
  public totalBirths: number = 0;
  public totalDeaths: number = 0;
  public totalFoodConsumed: number = 0;
  public highestGenerationReached: number = 1;
  public externalEnergyAdded: number = 0;
  public nextIdCounter: number = 100;
  public waterDragCoeff: number = 3.5;
  public physicsStepCount: number = 0;
  private nutrientAccumulator: number = 0;

  constructor(seed: number = 4242, initialOrganisms: number = 14) {
    this.prng = new PRNG(seed);
    this.reset(initialOrganisms);
  }

  public reset(initialOrganisms: number = 14) {
    this.organisms = [];
    this.nutrients = [];
    this.eggs = [];
    this.simTime = 0;
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.totalFoodConsumed = 0;
    this.highestGenerationReached = 1;
    this.externalEnergyAdded = 0;
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
    const org = new OrganismInstance(genome, pos, rot);
    this.organisms.push(org);
    this.externalEnergyAdded += org.reserves + org.structuralEnergy;
    return org;
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
        if (this.organisms.length < this.maxOrganisms) {
          const childOrg = this.addOrganism(egg.genome, egg.pos.clone());
          childOrg.reserves = egg.fundingRemaining;
          this.totalBirths++;
          this.highestGenerationReached = Math.max(this.highestGenerationReached, egg.genome.generation);
          this.eggs.splice(i, 1);
        }
      }
    }

    // 3. Sensory updates & Brain step (Outer simulation frequency)
    for (const org of this.organisms) {
      if (org.isDead) continue;
      org.ageSec += outerDt;
      org.reserves -= org.genome.metabolism.baseUpkeepPerSec * outerDt;
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
        org.updatePhysicsSubstep(subDt, this.waterDragCoeff);
        this.containInTank(org);
      }
    }

    // 5. Feeding, Reproduction, and Life cycles
    for (let oIdx = this.organisms.length - 1; oIdx >= 0; oIdx--) {
      const org = this.organisms[oIdx];
      if (org.isDead) continue;

      this.checkFeeding(org, outerDt);

      // Reproduction
      if (
        org.reserves > org.genome.metabolism.reproduceReserveThreshold &&
        org.ageSec - org.lastReproduceSec > org.genome.metabolism.reproduceCooldownSec &&
        this.organisms.length + this.eggs.length < this.maxOrganisms + 5
      ) {
        const eggCost = org.genome.metabolism.eggEnergyFunding;
        if (org.reserves >= eggCost + 50) {
          org.reserves -= eggCost;
          org.lastReproduceSec = org.ageSec;
          const mutatedGenome = mutateGenome(org.genome, this.prng, `org-${this.nextIdCounter++}`);
          this.eggs.push({
            id: `egg-${this.nextIdCounter++}`,
            parentId: org.genome.id,
            genome: mutatedGenome,
            pos: org.com.clone().add(new THREE.Vector3(0, -0.4, 0)),
            fundingRemaining: eggCost,
            initialFunding: eggCost,
            incubationRemainingSec: org.genome.metabolism.eggIncubationSec,
          });
        }
      }

      // Death check
      if (org.reserves <= 0 || org.ageSec >= org.genome.metabolism.lifespanSec) {
        org.isDead = true;
        this.totalDeaths++;
        const spawnCount = Math.min(6, Math.max(1, Math.floor(org.structuralEnergy / 25)));
        for (let k = 0; k < spawnCount; k++) {
          this.nutrients.push({
            id: `nut-${this.nextIdCounter++}`,
            pos: org.com.clone().add(
              new THREE.Vector3(this.prng.range(-0.5, 0.5), this.prng.range(-0.5, 0.5), this.prng.range(-0.5, 0.5))
            ),
            energy: 35,
          });
        }
        this.organisms.splice(oIdx, 1);
      }
    }
  }

  private containInTank(org: OrganismInstance) {
    const halfX = this.tankBounds.x * 0.48;
    const halfZ = this.tankBounds.z * 0.48;
    const minY = 1.0;
    const maxY = this.tankBounds.y - 1.0;

    for (const body of org.bodies) {
      if (body.pos.x < -halfX) {
        body.pos.x = -halfX;
        body.linVel.x = Math.abs(body.linVel.x) * 0.5;
      } else if (body.pos.x > halfX) {
        body.pos.x = halfX;
        body.linVel.x = -Math.abs(body.linVel.x) * 0.5;
      }
      if (body.pos.z < -halfZ) {
        body.pos.z = -halfZ;
        body.linVel.z = Math.abs(body.linVel.z) * 0.5;
      } else if (body.pos.z > halfZ) {
        body.pos.z = halfZ;
        body.linVel.z = -Math.abs(body.linVel.z) * 0.5;
      }
      if (body.pos.y < minY) {
        body.pos.y = minY;
        body.linVel.y = Math.abs(body.linVel.y) * 0.5;
      } else if (body.pos.y > maxY) {
        body.pos.y = maxY;
        body.linVel.y = -Math.abs(body.linVel.y) * 0.5;
      }
    }
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
    inArr[inIdx++] = Math.min(1.0, org.reserves / 400);
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
            const intake = Math.min(nut.energy, maxIntake);
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

                if (nut.energy <= 0.01) {
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
              const intake = Math.min(egg.fundingRemaining, maxIntake);
              if (intake > 0) {
                egg.fundingRemaining -= intake; // Deduct from egg FIRST
                const gained = intake * TROPHIC_EFFICIENCY;
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

                if (egg.fundingRemaining <= 0.01) {
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
            const intake = Math.min(prey.reserves, maxIntake);
            if (intake > 0) {
              prey.reserves -= intake; // Subtract from prey FIRST
              const gained = intake * TROPHIC_EFFICIENCY;
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
    let dissipatedWork = 0;
    let totalAnchorError = 0;
    let jointCount = 0;

    for (const o of this.organisms) {
      orgReserves += Math.max(0, o.reserves);
      orgTissue += o.structuralEnergy;
      dissipatedWork += o.totalWorkJoules;
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
        organismReserves: Math.round(orgReserves),
        organismTissue: Math.round(orgTissue),
        eggEnergy: Math.round(eggEnergy),
        nutrientEnergy: Math.round(nutEnergy),
        dissipatedMetabolicWork: Math.round(dissipatedWork),
      },
    };
  }
}
