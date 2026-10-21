/** Regression: prove that newly created planar DNA swims toward its actual mouth
 * while historic saved genomes retain their old motor-phase semantics.
 * Every result uses the unchanged production RNN, Rapier, water drag and ledger. */
import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';

await initializePhysics();

function measure(seed:number,legacy=false,seconds=8) {
 const sim=new WorldSimulation(seed,0);
 try{
   sim.clearFreeNutrients();sim.targetNutrientCount=0;sim.nutrientInflowPerSec=0;sim.maxOrganisms=1;
   const g=createFounderGenome('planar-test','planar-test',new PRNG(seed),'planar_swimmer');
   if(legacy){
     for(let i=0;i<g.parts.length;i++)g.parts[i].motorPhase=i*Math.PI/2;
   }
   const o=sim.addOrganism(g,new THREE.Vector3(0,8,0));
   const face=new THREE.Vector3(0,0,-1).applyQuaternion(o.bodies[0].rot);
   const start=o.com.clone();let gap=0;
   for(let t=0;t<seconds*60;t++){
     sim.stepOuterTick();
     for(const j of o.joints)gap=Math.max(gap,j.anchorError);
   }
   const displacement=o.com.clone().sub(start);
   return {seed,legacy,headward:displacement.dot(face),net:displacement.length(),
     spent:o.totalMotorChemicalSpent,basal:o.totalBasalChemicalSpent,path:o.totalTravelMeters,
     maxGap:gap,ledger:sim.getTelemetry().chemicalEnergyLedger.conservationResidual,
     alive:!o.isDead,food:o.totalFoodEaten,eggs:sim.eggs.length,
     phases:g.parts.map(p=>p.motorPhase)};
 }finally{sim.dispose();}
}

test('new planar founder uses negative inherited phase progression without changing face or brain identity',()=>{
 const g=createFounderGenome('s','s',new PRNG(4242),'planar_swimmer');
 const expected=[0,3*Math.PI/2,Math.PI,Math.PI/2,0,3*Math.PI/2];
 assert.equal(g.parts[0].mouthFace,'-Z');
 assert.equal(g.parts[0].eyeFace,'-Z');
 for(let i=0;i<expected.length;i++)assert.ok(Math.abs(g.parts[i].motorPhase-expected[i])<1e-12);
 assert.equal(g.brain.hiddenCount,24);
 assert.equal(g.brain.outputWeights.length,20);
});

test('isolated living founders swim head-first under real neural and energy control',()=>{
 for(const seed of [4242,17,2026]){
   const modern=measure(seed), old=measure(seed,true);
   console.log('PLANAR_HEADFIRST_SEEDED_0211',JSON.stringify({modern,old}));
   for(const v of [modern,old]){
     assert.ok(v.alive && v.food===0 && v.eggs===0);
     assert.ok(v.net>0 && v.path+1e-8>=v.net && v.spent>0 && v.basal>0);
     assert.ok(v.maxGap<.005 && Math.abs(v.ledger)<1e-5);
   }
   assert.ok(modern.headward>1,'new DNA swims mouth-first across tested seeds');
   assert.ok(old.headward< -1,'unchanged old DNA still swims tail-first');
   assert.ok(modern.spent<=old.spent*1.2,'no excessive chemical cost for head-first swimming');
 }
});

test('full default ecosystem preserves finite physically funded motion with new planar founders',()=>{
 const s=new WorldSimulation(4242,14);
 try{
  const planar=s.organisms.filter(o=>o.genome.id.match(/^founder-(1|4|7|10|13)$/));
  assert.equal(planar.length,5);
  const starts=planar.map(o=>({o,p:o.com.clone(),forward:new THREE.Vector3(0,0,-1).applyQuaternion(o.bodies[0].rot)}));
  for(let t=0;t<360;t++)s.stepOuterTick();
  const progress=starts.map(({o,p,forward})=>({
    id:o.genome.id,headward:o.com.clone().sub(p).dot(forward),net:o.com.distanceTo(p),
    motor:o.totalMotorChemicalSpent
  }));
  console.log('PLANAR_FULL_WORLD_0211',JSON.stringify({progress,energy:s.getTelemetry().chemicalEnergyLedger.conservationResidual}));
  assert.ok(progress.every(v=>Number.isFinite(v.headward)&&Number.isFinite(v.net)));
  assert.ok(progress.every(v=>v.headward>.25),'every planar founder in this physical 14-creature trial progresses toward its own mouth');
  assert.ok(progress.every(v=>v.motor>0),'all real swimming must have paid chemical motor work');
  assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
 } finally{s.dispose();}
});
