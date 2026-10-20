import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializePhysics } from '../sim/physics';
import { runLocomotionTrial } from '../sim/locomotionAudit';

await initializePhysics();

function grounded(result: ReturnType<typeof runLocomotionTrial>) {
  assert.equal(result.simulatedTicks, result.seconds*60);
  assert.ok(result.aliveAtEnd,'must measure actual living swimming');
  assert.equal(result.foodActuallyEaten,0,'no food can subsidize swimming in isolated water');
  assert.equal(result.eggsLaid,0,'no reproduction funding should contaminate motor cost');
  for(const [key,value] of Object.entries(result))if(typeof value==='number'){
    assert.ok(Number.isFinite(value),'non-finite '+key+': '+value);
  }
  assert.ok(result.netMeters>=0);
  assert.ok(result.pathMeters+1e-8>=result.netMeters,'COM path cannot be shorter than net');
  assert.ok(result.peakRadiusMeters+1e-8>=result.netMeters,'peak radius must include final position');
  assert.ok(result.lastHalfPathMeters+1e-8>=result.lastHalfNetMeters);
  assert.ok(result.straightness>=0&&result.straightness<=1);
  assert.ok(result.lateStraightness>=0&&result.lateStraightness<=1);
  assert.ok(result.motorChemicalSpent>=0&&result.lastHalfMotorChemicalSpent>=0);
  assert.ok(result.maxHingeAnchorGapMeters<.005&&result.maxHingeAxisErrorRadians<.01);
  assert.ok(Math.abs(result.worldConservationResidual)<1e-5);
}

test('three production founders have sustained, funded physical swimming measurements',()=>{
  for(const founder of ['planar_swimmer','3d_serpent','fin_tail'] as const){
    const r=runLocomotionTrial({founder,seed:4242,yawRadians:0,seconds:8});
    grounded(r);
    assert.ok(r.netMeters>0.02,'sustained net physical displacement expected for '+founder);
    assert.ok(r.motorChemicalSpent>0);
    assert.ok(r.lastHalfMotorChemicalSpent>0);
    assert.ok(r.lastHalfNetMeters>0,'the latter half actually swims');
    assert.ok(r.netMetersPerMotorChemical>0);
    console.log('SIMS_SWIM_EVIDENCE_0210',JSON.stringify(r));
  }
});

test('paired headings, unchanged real genotype, support fair diagnostic comparisons',()=>{
  const forward=runLocomotionTrial({founder:'planar_swimmer',seed:4242,yawRadians:0,seconds:6});
  const reversed=runLocomotionTrial({founder:'planar_swimmer',seed:4242,yawRadians:Math.PI,seconds:6});
  for(const r of [forward,reversed])grounded(r);
  assert.ok(forward.netMeters>.02&&reversed.netMeters>.02);
  // Symmetric still-water physics should not turn yaw rotation into an
  // unreported hidden drive or free motor energy. Allow solver roundoff.
  assert.ok(Math.abs(forward.netMeters-reversed.netMeters)<.2,
    'paired orientation should yield comparable physical net travel');
});

test('real motor-off and inherited all-direct counterfactuals remain energy honest',()=>{
  const stopped=runLocomotionTrial({founder:'planar_swimmer',seed:4242,yawRadians:0,seconds:4,motorsEnabled:false});
  const direct=runLocomotionTrial({founder:'planar_swimmer',seed:4242,yawRadians:0,seconds:6,motorRhythmMix:0});
  for(const r of [stopped,direct])grounded(r);
  assert.equal(stopped.motorChemicalSpent,0,'no active motor work without muscle torque');
  assert.equal(stopped.netMetersPerMotorChemical,0,'zero cost must not be infinity');
  assert.ok(stopped.basalChemicalSpent>0,'ordinary living metabolism continues');
  assert.equal(direct.motorRhythmMix,0);
  assert.ok(direct.motorChemicalSpent>=0);
  console.log('SIMS_SWIM_CONTROLS_0210',JSON.stringify({motorsOff:stopped,direct}));
});

test('invalid horizons and counterfactual alleles fail before simulation',()=>{
  for(const bad of [
    {seconds:0},{seconds:1},{seconds:61},{seconds:1.2},
    {yawRadians:Infinity},{seed:NaN},{motorRhythmMix:-.1},
    {motorRhythmMix:1.1},{motorRhythmMix:Infinity}
  ]){
    assert.throws(()=>runLocomotionTrial({
      founder:'planar_swimmer',seed:4242,yawRadians:0,seconds:6,...bad
    }),/Invalid bounded locomotion trial/);
  }
});
