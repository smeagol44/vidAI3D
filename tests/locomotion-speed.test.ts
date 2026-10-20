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
      net:o.com.distanceTo(start),forward:o.com.z-start.z,path,half,
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
  assert.ok(planar.forward>1.65,'planar improvement over 0.968m baseline');
  assert.ok(serpent.forward>.95,'serpent improvement over 0.497m baseline');
});

test('trilimb slow gait is measured without claiming an untested speed improvement',()=>{
  const tri=measure('tri_limb');
  console.log('TRILIMB_SPEED_CONTROL_023',JSON.stringify(tri));
  assert.equal(tri.parts,3);
  assert.ok(Number.isFinite(tri.net)&&tri.gap<.005&&Math.abs(tri.residual)<1e-5);
});
