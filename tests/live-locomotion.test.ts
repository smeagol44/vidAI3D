import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome, mutateGenome } from '../sim/mutation';
import { PRNG } from '../sim/prng';

await initializePhysics();

type Control = 'neutral' | 'recurrent' | 'frequency-only';

/** Real ecological outer ticks, with sensory processing, motors and metabolic cost. */
function measureLiveTravel(control: Control, seconds = 20) {
  const sim = new WorldSimulation(4242, 0);
  try {
    // Independent no-contact/no-feeding fixture; nothing is added to the world.
    sim.nutrients = [];
    sim.targetNutrientCount = 0;
    sim.nutrientInflowPerSec = 0;
    const genome = createFounderGenome('probe', 'planar_swimmer', new PRNG(4242), 'planar_swimmer');
    const org = sim.addOrganism(genome, new THREE.Vector3(0, 8, 0));
    if (control === 'neutral') org.brain.step = () => { org.brain.outputs.fill(0); };
    if (control === 'frequency-only') {
      const actualStep = org.brain.step.bind(org.brain);
      org.brain.step = (dt: number) => {
        actualStep(dt);
        for (let i = 0; i < org.joints.length * 4; i++)
          if (i % 4 !== 1) org.brain.outputs[i] = 0;
      };
    }
    const start = org.com.clone(), previous = start.clone(), strokeStart = start.clone();
    let path = 0, previousPhase = org.joints[0].jointPhase, outputMagnitude = 0, outputCount = 0;
    let maxPhaseError = 0, maxAnchorGap = 0, minTarget = Infinity, maxTarget = -Infinity;
    let minReal = Infinity, maxReal = -Infinity;
    const strokeProgress: number[] = [];
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      sim.stepOuterTick();
      path += previous.distanceTo(org.com);
      previous.copy(org.com);
      const lead = org.joints[0];
      minTarget = Math.min(minTarget, lead.targetAngle);
      maxTarget = Math.max(maxTarget, lead.targetAngle);
      minReal = Math.min(minReal, lead.currentAngle);
      maxReal = Math.max(maxReal, lead.currentAngle);
      for (const joint of org.joints) {
        maxAnchorGap = Math.max(maxAnchorGap, joint.anchorError);
        const inheritedDifference = joint.child.partGene.motorPhase - lead.child.partGene.motorPhase;
        const phaseError = joint.jointPhase - lead.jointPhase - inheritedDifference;
        maxPhaseError = Math.max(maxPhaseError, Math.abs(Math.atan2(Math.sin(phaseError), Math.cos(phaseError))));
      }
      for (const value of org.brain.outputs) { outputMagnitude += Math.abs(value); outputCount++; }
      if (lead.jointPhase < previousPhase) {
        strokeProgress.push(strokeStart.z - org.com.z);
        strokeStart.copy(org.com);
      }
      previousPhase = lead.jointPhase;
    }
    return {
      control, seconds, netMeters: org.com.distanceTo(start), pathMeters: path,
      headFirstMeters: start.z - org.com.z, strokeProgress, maxPhaseError,
      maxAnchorGap, targetSpan: maxTarget - minTarget, realizedSpan: maxReal - minReal,
      meanAbsOutput: outputMagnitude / outputCount, reserve: org.reserves,
      work: org.totalWorkJoules, worldSteps: sim.physicsStepCount,
      births: sim.totalBirths, deaths: sim.totalDeaths,
      finite: [path, org.reserves, org.totalWorkJoules, maxPhaseError, maxAnchorGap, ...org.com.toArray()].every(Number.isFinite)
    };
  } finally { sim.dispose(); }
}

test('live recurrent founder travels usefully without losing the inherited stroke', () => {
  const neutral = measureLiveTravel('neutral');
  const recurrent = measureLiveTravel('recurrent');
  const frequencyOnly = measureLiveTravel('frequency-only');
  console.log('LIVE_SWIMMING_REGRESSION', JSON.stringify({ neutral, recurrent, frequencyOnly }));
  for (const measurement of [neutral, recurrent, frequencyOnly]) {
    assert.ok(measurement.finite, JSON.stringify(measurement));
    assert.equal(measurement.worldSteps, 2400);
    assert.equal(measurement.births, 0);
    assert.equal(measurement.deaths, 0);
    assert.ok(measurement.reserve > 150 && measurement.reserve < 250);
    assert.ok(measurement.work > 0);
    assert.ok(measurement.maxAnchorGap < .005);
    assert.ok(measurement.realizedSpan > 1.6);
    assert.ok(measurement.pathMeters >= measurement.netMeters);
  }
  assert.ok(neutral.netMeters > 2.2);
  // Positive head-first progress points toward the actual root mouth/eye (-Z).
  // The old positive-world-Z check accidentally rewarded tail-first swimming.
  assert.ok(recurrent.headFirstMeters > 1.9, 'real recurrent outputs must preserve mouth-first progress');
  assert.ok(recurrent.netMeters > neutral.netMeters * .8);
  assert.ok(recurrent.meanAbsOutput > .02, 'do not silently neutralize the live brain');
  assert.ok(recurrent.strokeProgress.slice(-5).every(v => v > .13), 'last five strokes must keep producing forward travel');
  assert.ok(recurrent.maxPhaseError < .5, 'neural modulation must not unwind the inherited phase relationships');
  assert.ok(frequencyOnly.headFirstMeters > 1.8, 'frequency modulation alone must not reverse or stall mouth-first swimming');
});

test('new motor-output priors are heritable and can evolve through mutations', () => {
  const parent = createFounderGenome('parent', 'planar_swimmer', new PRNG(4242), 'planar_swimmer');
  const originalWeights = JSON.stringify(parent.brain.outputWeights);
  const originalBiases = JSON.stringify(parent.brain.outputBiases);
  const children = Array.from({ length: 8 }, (_, seed) => mutateGenome(parent, new PRNG(seed + 1), 'child-' + seed));
  const mutatedOutputs = children.filter(child => child !== parent &&
    (JSON.stringify(child.brain.outputWeights) !== originalWeights || JSON.stringify(child.brain.outputBiases) !== originalBiases));
  assert.ok(mutatedOutputs.length > 0, 'at least one valid child must mutate an output pathway');
  assert.equal(JSON.stringify(parent.brain.outputWeights), originalWeights);
  assert.equal(JSON.stringify(parent.brain.outputBiases), originalBiases);
});
