import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome } from '../sim/mutation';
import { PRNG } from '../sim/prng';

await initializePhysics();
type Shape = 'planar_swimmer' | '3d_serpent' | 'tri_limb';

function measure(shape: Shape, seconds=10) {
  const sim = new WorldSimulation(4242,0);
  try {
    sim.clearFreeNutrients();
    sim.targetNutrientCount=0;
    sim.nutrientInflowPerSec=0;
    const g=createFounderGenome('speed-test',shape,new PRNG(4242),shape);
    const o=sim.addOrganism(g,new THREE.Vector3(0,8,0));
    const start=o.com.clone(),prev=start.clone(),startingReserve=o.reserves;
    let path=0,gap=0,axis=0,half=0;
    for(let i=0;i<seconds*60;i++){
      sim.stepOuterTick();
      path+=prev.distanceTo(o.com);prev.copy(o.com);
      for(const joint of o.joints){gap=Math.max(gap,joint.anchorError);axis=Math.max(axis,joint.axisError);}
      if(i===seconds*30-1)half=o.com.distanceTo(start);
    }
    return {shape,parts:o.bodies.length,joints:o.joints.length,seconds,
      net:o.com.distanceTo(start),worldZ:o.com.z-start.z,towardMouth:start.z-o.com.z,path,half,
      remainingReserve:o.reserves,startingReserve,motorWork:o.totalWorkJoules,
      gap,axis,worldSteps:sim.physicsStepCount,
      residual:sim.getTelemetry().chemicalEnergyLedger.conservationResidual,
      neuralChannels:o.brain.outputs.length};
  } finally {sim.dispose();}
}

test('new planar and 3D serpent founders move farther under living neural control',()=>{
  const planar=measure('planar_swimmer'),serpent=measure('3d_serpent');
  console.log('LIVING_SPEED_023',JSON.stringify({planar,serpent}));
  for(const o of [planar,serpent]){
    assert.equal(o.parts,6);assert.equal(o.joints,5);
    assert.equal(o.neuralChannels,20);
    assert.equal(o.worldSteps,1200);
    assert.ok(o.gap<.005 && o.axis<.01);
    assert.ok(o.path>=o.net && o.half>0);
    assert.ok(o.remainingReserve>0&&o.remainingReserve<o.startingReserve&&o.motorWork>0);
    assert.ok(Math.abs(o.residual)<1e-5);
  }
  assert.ok(planar.towardMouth>1.65,'new planar founder swims mouth-first, not tail-first');
  assert.ok(serpent.worldZ>.95,'nonplanar serpent retains its measured +Z swimming pending a viable head-first gait');
});

test('trilimb slow gait is measured without claiming an untested speed improvement',()=>{
  const tri=measure('tri_limb');
  console.log('TRILIMB_SPEED_CONTROL_023',JSON.stringify(tri));
  assert.equal(tri.parts,3);
  assert.ok(Number.isFinite(tri.net)&&tri.gap<.005&&Math.abs(tri.residual)<1e-5);
});

test('full 14-creature seed remains finite and conserves energy as new mobile bodies swim',()=>{
  const s=new WorldSimulation(4242,14);
  try {
    const starts=new Map(s.organisms.map(o=>[o.genome.id,o.com.clone()]));
    for(let i=0;i<360;i++)s.stepOuterTick();
    const observations=s.organisms.map(o=>({
      id:o.genome.id,parts:o.bodies.length,net:o.com.distanceTo(starts.get(o.genome.id)!),
      remainingReserve:o.reserves,maxAnchor:Math.max(0,...o.joints.map(j=>j.anchorError))
    }));
    console.log('POPULATION_SWIM_023',JSON.stringify({observations,time:s.simTime,
      residual:s.getTelemetry().chemicalEnergyLedger.conservationResidual}));
    assert.equal(s.organisms.length,14);
    assert.ok(observations.every(o=>Number.isFinite(o.net)&&o.maxAnchor<.005&&o.remainingReserve>0));
    assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
    assert.ok(observations.some(o=>o.parts===6&&o.net>.2),'at least one mobile founder must traverse space in the full tank');
  } finally {s.dispose();}
});
