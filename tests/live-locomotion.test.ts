import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome } from '../sim/mutation';
import { PRNG } from '../sim/prng';

await initializePhysics();

type Mode = 'neutral' | 'recurrent' | 'no-frequency' | 'no-offset' | 'no-torque' | 'no-stiffness' | 'only-frequency';

/** Same world tick as the app, not the isolated physics-only reference. */
function runLiveSwimmer(mode: Mode, seconds = 20) {
  const sim = new WorldSimulation(4242, 0);
  try {
    sim.nutrients = [];
    sim.targetNutrientCount = 0;
    sim.nutrientInflowPerSec = 0;
    const genome = createFounderGenome('probe', 'planar_swimmer', new PRNG(4242), 'planar_swimmer');
    const org = sim.addOrganism(genome, new THREE.Vector3(0, 8, 0));
    if (mode === 'neutral') org.brain.step = () => { org.brain.outputs.fill(0); };
    else if (mode !== 'recurrent') {
      const nativeStep = org.brain.step.bind(org.brain);
      const blocked = mode === 'no-offset' ? 0 : mode === 'no-frequency' ? 1 : mode === 'no-torque' ? 2 : 3;
      org.brain.step = (dt: number) => {
        nativeStep(dt);
        for (let i = 0; i < org.joints.length * 4; i++) {
          if (mode === 'only-frequency' ? i % 4 !== 1 : i % 4 === blocked) org.brain.outputs[i] = 0;
        }
      };
    }
    const initial = org.com.clone(), previous = initial.clone();
    const initialReserve = org.reserves;
    let path = 0, targetSpan = 0, actualSpan = 0, outputAbs = 0, outputCount = 0;
    let minTarget = Infinity, maxTarget = -Infinity, minActual = Infinity, maxActual = -Infinity;
    const strokes: number[] = [];
    let phase = org.joints[0].jointPhase, lastStroke = initial.clone();
    const ticks = Math.round(seconds * 60);
    for (let i = 0; i < ticks; i++) {
      sim.stepOuterTick();
      path += org.com.distanceTo(previous);
      previous.copy(org.com);
      const joint = org.joints[0];
      minTarget = Math.min(minTarget, joint.targetAngle);
      maxTarget = Math.max(maxTarget, joint.targetAngle);
      minActual = Math.min(minActual, joint.currentAngle);
      maxActual = Math.max(maxActual, joint.currentAngle);
      for (const value of org.brain.outputs) { outputAbs += Math.abs(value); outputCount++; }
      if (joint.jointPhase < phase) { strokes.push(org.com.distanceTo(lastStroke)); lastStroke.copy(org.com); }
      phase = joint.jointPhase;
    }
    targetSpan = maxTarget - minTarget; actualSpan = maxActual - minActual;
    return {
      mode, seconds, simulatedSeconds: sim.simTime, bodyLength: 2.7,
      net: org.com.distanceTo(initial), path, displacement: org.com.clone().sub(initial).toArray(),
      strokes, targetSpan, actualSpan, meanAbsNeuralOutput: outputAbs / outputCount,
      reserveSpent: initialReserve - org.reserves, remainingReserve: org.reserves,
      births: sim.totalBirths, deaths: sim.totalDeaths, worldSteps: sim.physicsStepCount,
      finite: [path, targetSpan, actualSpan, org.reserves, ...org.com.toArray()].every(Number.isFinite),
    };
  } finally { sim.dispose(); }
}

test('report neutral vs inherited-recurrent swimmer through complete ecosystem ticks', () => {
  const neutral = runLiveSwimmer('neutral');
  const live = runLiveSwimmer('recurrent');
  const ablations = (['no-frequency', 'no-offset', 'no-torque', 'no-stiffness', 'only-frequency'] as const).map(run => runLiveSwimmer(run));
  console.log('LIVE_SWIMMING_ABLATIONS', JSON.stringify({ neutral, live, ablations }));
  assert.ok(neutral.finite && live.finite);
  assert.equal(neutral.worldSteps, 2400);
  assert.equal(live.worldSteps, 2400);
  assert.ok(neutral.remainingReserve > 0 && live.remainingReserve > 0);
});
