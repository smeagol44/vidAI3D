import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics, PHYSICS_DT } from '../sim/physics';
import { OrganismInstance, bodyLayout } from '../sim/organism';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome, mutateGenome } from '../sim/mutation';
import { validateGenome } from '../sim/genome';
import { PRNG } from '../sim/prng';

await initializePhysics();
const make = (seed = 4242) => createFounderGenome('rhythm','Rhythm',new PRNG(seed),'planar_swimmer');

test('missing rhythm-mix allele preserves legacy gait; direct neural posture silences prescribed waves', () => {
  const base=make();
  const mixed=structuredClone(base);
  const direct=structuredClone(base);
  mixed.parts[1].motorRhythmMix=.5;
  direct.parts[1].motorRhythmMix=0;
  const pose=new THREE.Vector3(0,8,0);
  const organisms=[base,mixed,direct].map(g=>new OrganismInstance(g,pose));
  try {
    const [legacy,half,silent]=organisms;
    for(const o of organisms) {
      o.brain.outputs.fill(0);
      o.joints[0].jointPhase=Math.PI*.5 - .02;
      o.preparePhysicsSubstep(PHYSICS_DT,250);
    }
    const gene=base.parts[1],rest=gene.restAngle;
    assert.equal(legacy.joints[0].targetAngle,
      THREE.MathUtils.clamp(rest+(gene.maxAngle-gene.minAngle)*.45*Math.sin(legacy.joints[0].jointPhase),gene.minAngle,gene.maxAngle));
    assert.ok(Math.abs(half.joints[0].targetAngle-rest)<Math.abs(legacy.joints[0].targetAngle-rest));
    assert.equal(silent.joints[0].targetAngle,rest,'direct mode has no mandatory wave at zero neural command');
    silent.brain.outputs[0]=.7;
    silent.preparePhysicsSubstep(PHYSICS_DT,250);
    const target=THREE.MathUtils.clamp(rest+.7*(gene.maxAngle-gene.minAngle)*.5,gene.minAngle,gene.maxAngle);
    assert.ok(Math.abs(silent.joints[0].targetAngle-target)<1e-6,'existing angle command directly controls real joint target');
    assert.ok(silent.joints[0].appliedTorque!==0);
    silent.motorsEnabled=false;
    silent.preparePhysicsSubstep(PHYSICS_DT,250);
    assert.equal(silent.joints[0].appliedTorque,0,'no free torque when motors disengaged');
  } finally {for(const o of organisms)o.dispose();}
});

test('new mixing allele mutates, validates, and never rewrites parental DNA', () => {
  const old=make();
  const snapshot=JSON.stringify(old);
  let variants=0;
  for(let seed=1;seed<=60;seed++){
    const next=mutateGenome(old,new PRNG(seed),'child-'+seed);
    if(next!==old && next.parts.some(p=>p.parentId!==null && p.motorRhythmMix!==undefined)) variants++;
  }
  assert.ok(variants>0,'mutations can produce a heritable direct/rhythm mixture');
  assert.equal(JSON.stringify(old),snapshot);
  assert.ok(old.parts.every(p=>p.motorRhythmMix===undefined),'old founder DNA stays absent');
  for(const bad of [-.01,1.01,Number.NaN,Infinity]){
    const g=make();g.parts[1].motorRhythmMix=bad;
    assert.equal(validateGenome(g),false);
    assert.throws(()=>bodyLayout(g,new THREE.Vector3(),new THREE.Quaternion()),/Invalid physical part/);
  }
  const g=make();g.parts[1].motorRhythmMix=0;
  assert.equal(validateGenome(g),true);
  assert.equal(structuredClone(g).parts[1].motorRhythmMix,0);
});

test('actual physical COM travel and motor-energy efficiency are observational, finite and ledger-safe', () => {
  const s=new WorldSimulation(2026,0);
  try {
    s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;s.maxOrganisms=1;
    const g=make();
    const o=s.addOrganism(g,new THREE.Vector3(0,8,0));
    assert.equal(o.netTravelMeters,0); assert.equal(o.totalTravelMeters,0);
    for(let i=0;i<300;i++)s.stepOuterTick();
    assert.ok(o.totalTravelMeters>0 && o.netTravelMeters>0);
    assert.ok(o.totalTravelMeters+1e-8>=o.netTravelMeters);
    assert.ok(o.netMetersPerMotorUnit>0 && Number.isFinite(o.netMetersPerMotorUnit));
    assert.ok(o.totalMotorChemicalSpent>0);
    assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
    assert.ok(o.joints.every(j=>j.anchorError<.005 && j.axisError<.01));
    console.log('PHASE_B_TRAVEL_029',JSON.stringify({net:o.netTravelMeters,path:o.totalTravelMeters,perMotorUnit:o.netMetersPerMotorUnit,spent:o.totalMotorChemicalSpent}));
  } finally{s.dispose();}
});

test('without neural angle motion direct-only joints cannot invent propulsion', () => {
  const g=make();
  for(const p of g.parts)if(p.parentId!==null)p.motorRhythmMix=0;
  const o=new OrganismInstance(g,new THREE.Vector3(0,8,0));
  try {
    o.brain.outputs.fill(0);
    for(let i=0;i<120;i++)o.updatePhysicsSubstep(PHYSICS_DT,250);
    assert.ok(o.netTravelMeters<1e-5);
    assert.ok(o.totalTravelMeters<1e-5);
    assert.equal(o.totalMotorChemicalSpent,0);
  }finally{o.dispose();}
});

test('asymmetric feather hinge direct mode reaches both physical angle limits without oscillator', () => {
  const g=createFounderGenome('fin-direct','Fin',new PRNG(4242),'fin_tail');
  const blade=g.parts.find(p=>p.id==='blade-0')!;
  assert.ok(blade.restAngle!==0 && blade.maxAngle>0 && blade.minAngle<0);
  blade.motorRhythmMix=0;
  const o=new OrganismInstance(g,new THREE.Vector3(0,8,0));
  try {
    const index=o.joints.findIndex(j=>j.child.id===blade.id);
    assert.ok(index>=0);
    o.brain.outputs.fill(0);
    o.brain.outputs[index*4]=1;
    o.preparePhysicsSubstep(PHYSICS_DT,250);
    assert.ok(Math.abs(o.joints[index].targetAngle-blade.maxAngle)<1e-9);
    o.brain.outputs[index*4]=-1;
    o.preparePhysicsSubstep(PHYSICS_DT,250);
    assert.ok(Math.abs(o.joints[index].targetAngle-blade.minAngle)<1e-9);
  }finally{o.dispose();}
});

test('time-varying neural Angle outputs propel a direct-only body through real water', () => {
  const g=make();
  for(const p of g.parts)if(p.parentId!==null)p.motorRhythmMix=0;
  const o=new OrganismInstance(g,new THREE.Vector3(0,8,0));
  try {
    const start=o.com.clone();
    for(let i=0;i<600;i++){
      // Laboratory-only neural stimulation: production provides these channels
      // from the inherited recurrent network instead of a scripted oscillator.
      for(let j=0;j<o.joints.length;j++){
        o.brain.outputs[j*4]=.85*Math.sin(i*PHYSICS_DT*2*Math.PI*.7+j*.8);
      }
      o.updatePhysicsSubstep(PHYSICS_DT,250);
    }
    console.log('DIRECT_NEURAL_PHYSICAL_SWIM_029',JSON.stringify({
      net:o.netTravelMeters,path:o.totalTravelMeters,spent:o.totalMotorChemicalSpent
    }));
    assert.ok(o.netTravelMeters>.005,'direct neural commands must move the physical COM');
    assert.ok(o.totalTravelMeters>=o.netTravelMeters);
    assert.ok(o.totalMotorChemicalSpent>0 && o.reserves>0);
    assert.ok(o.joints.every(j=>j.anchorError<.005&&j.axisError<.01));
    assert.ok(o.com.distanceTo(start)>0);
  }finally{o.dispose();}
});
