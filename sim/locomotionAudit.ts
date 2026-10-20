/**
 * Read-only controlled locomotion observations, not a fitness/reproduction system.
 * Runs the SAME WorldSimulation, BrainInstance, Rapier joints and energy ledger as
 * production. No manual forces, scripted propulsion, food placement or subsidies.
 *
 * All metrics are physical COM measurements sampled from completed 1/60-s ticks.
 * Different gaits have different start shape/orientations; compare paired DNA,
 * seeds and initial headings rather than assuming positive world-Z is forward.
 */
import * as THREE from 'three';
import { WorldSimulation } from './simulation';
import { createFounderGenome } from './mutation';
import { PRNG } from './prng';

export type LocomotionFounder = 'planar_swimmer' | '3d_serpent' | 'fin_tail' | 'tri_limb';

export interface LocomotionTrialOptions {
  founder: LocomotionFounder;
  seed: number;
  /** Yaw in radians; rotated geometry, not an implicit heading controller. */
  yawRadians: number;
  /** Positive whole seconds, at 60 actual simulated outer ticks/second. */
  seconds: number;
  /** Optional counterfactual allele; absent preserves the actual founder genome. */
  motorRhythmMix?: number;
  /** Test-only muscle shutoff control; there is no external propulsion. */
  motorsEnabled?: boolean;
}

export interface LocomotionTrialResult {
  founder: LocomotionFounder;
  seed: number;
  yawRadians: number;
  seconds: number;
  motorRhythmMix: number | null;
  motorsEnabled: boolean;
  bodyParts: number;
  physicalJoints: number;
  simulatedTicks: number;
  aliveAtEnd: boolean;
  netMeters: number;
  pathMeters: number;
  /** Peak distance from original COM (Sims-style), not cumulative path. */
  peakRadiusMeters: number;
  straightness: number;
  /** Early vs late window net displacement; exposes stop-and-coast cases. */
  firstHalfNetMeters: number;
  lastHalfNetMeters: number;
  lastHalfPathMeters: number;
  lateStraightness: number;
  /** Positive is initial body -Z, negative is movement toward its rear. */
  signedInitialForwardMeters: number;
  signedLastHalfForwardMeters: number;
  /** End heading is inferred from the real root rigid body's orientation. */
  finalHeadingErrorDegrees: number;
  endingCOMSpeedMetersPerSec: number;
  motorChemicalSpent: number;
  basalChemicalSpent: number;
  mechanicalWorkJoules: number;
  netMetersPerMotorChemical: number;
  lateNetMetersPerMotorChemical: number;
  lastHalfMotorChemicalSpent: number;
  endingReserves: number;
  foodActuallyEaten: number;
  eggsLaid: number;
  maxHingeAnchorGapMeters: number;
  maxHingeAxisErrorRadians: number;
  worldConservationResidual: number;
}

export function runLocomotionTrial(options: LocomotionTrialOptions): LocomotionTrialResult {
  const {founder, seed, yawRadians, seconds, motorRhythmMix, motorsEnabled = true} = options;
  if (!['planar_swimmer','3d_serpent','fin_tail','tri_limb'].includes(founder)
      || !Number.isInteger(seed) || !Number.isFinite(yawRadians)
      || !Number.isInteger(seconds) || seconds < 2 || seconds > 60
      || (motorRhythmMix !== undefined
        && (!Number.isFinite(motorRhythmMix) || motorRhythmMix < 0 || motorRhythmMix > 1))) {
    throw new Error('Invalid bounded locomotion trial parameters');
  }

  // Build the same real world as production; disable environmental intake and
  // a second organism, because either would contaminate locomotor energy costs.
  const world = new WorldSimulation(seed, 0);
  try {
    world.clearFreeNutrients();
    world.targetNutrientCount = 0;
    world.nutrientInflowPerSec = 0;
    world.maxOrganisms = 1; // Prevent real egg funding from entering this controlled comparison.
    const genome = createFounderGenome('swim-audit', 'Swimming reference', new PRNG(seed), founder);
    if (motorRhythmMix !== undefined) {
      for (const part of genome.parts) if (part.parentId !== null) part.motorRhythmMix = motorRhythmMix;
    }
    const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRadians);
    const swim = world.addOrganism(genome, new THREE.Vector3(0, 8, 0), rotation);
    swim.motorsEnabled = motorsEnabled;
    const start = swim.com.clone();
    const initialForward = new THREE.Vector3(0, 0, -1).applyQuaternion(swim.bodies[0].rot);
    const halfTick = seconds * 30;
    let halfCOM: THREE.Vector3 | undefined;
    let halfPath = 0, halfMotorEnergy = 0;
    let peakRadius = 0, maxGap = 0, maxAxisError = 0;
    const ticks = seconds * 60;
    for (let i = 0; i < ticks; i++) {
      world.stepOuterTick();
      peakRadius = Math.max(peakRadius, swim.com.distanceTo(start));
      for (const joint of swim.joints) {
        maxGap = Math.max(maxGap, joint.anchorError);
        maxAxisError = Math.max(maxAxisError, joint.axisError);
      }
      if (i + 1 === halfTick) {
        halfCOM = swim.com.clone();
        halfPath = swim.totalTravelMeters;
        halfMotorEnergy = swim.totalMotorChemicalSpent;
      }
      if (swim.isDead) break; // Never turn death into an apparent stopped swimmer.
    }
    if (!halfCOM) throw new Error('Organism died before the halfway observation');
    const displacement = swim.com.clone().sub(start);
    const lateDisplacement = swim.com.clone().sub(halfCOM);
    const net = displacement.length(), path = swim.totalTravelMeters;
    const lateNet = lateDisplacement.length(), latePath = path - halfPath;
    const chemical = swim.totalMotorChemicalSpent, lateChemical = chemical - halfMotorEnergy;
    const finalForward = new THREE.Vector3(0, 0, -1).applyQuaternion(swim.bodies[0].rot);
    const ledger = world.getTelemetry().chemicalEnergyLedger;
    return {
      founder,seed,yawRadians,seconds,motorRhythmMix:motorRhythmMix??null,motorsEnabled,
      bodyParts:swim.bodies.length,physicalJoints:swim.joints.length,
      simulatedTicks:world.physicsStepCount/2,aliveAtEnd:!swim.isDead,
      netMeters:net,pathMeters:path,peakRadiusMeters:peakRadius,
      straightness:path>0?Math.min(1,net/path):0,
      firstHalfNetMeters:halfCOM.distanceTo(start),lastHalfNetMeters:lateNet,
      lastHalfPathMeters:latePath,lateStraightness:latePath>0?Math.min(1,lateNet/latePath):0,
      signedInitialForwardMeters:displacement.dot(initialForward),
      signedLastHalfForwardMeters:lateDisplacement.dot(initialForward),
      finalHeadingErrorDegrees:THREE.MathUtils.radToDeg(initialForward.angleTo(finalForward)),
      endingCOMSpeedMetersPerSec:swim.comVel.length(),
      motorChemicalSpent:chemical,basalChemicalSpent:swim.totalBasalChemicalSpent,
      mechanicalWorkJoules:swim.totalWorkJoules,
      netMetersPerMotorChemical:chemical>0?net/chemical:0,
      lateNetMetersPerMotorChemical:lateChemical>0?lateNet/lateChemical:0,
      lastHalfMotorChemicalSpent:lateChemical,
      endingReserves:swim.reserves,
      foodActuallyEaten:swim.totalFoodEaten,
      eggsLaid:world.eggs.length,
      maxHingeAnchorGapMeters:maxGap,maxHingeAxisErrorRadians:maxAxisError,
      worldConservationResidual:ledger.conservationResidual
    };
  } finally {
    world.dispose();
  }
}
