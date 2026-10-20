import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome, mutateGenome} from '../sim/mutation';
import {validateGenome} from '../sim/genome';
import {PRNG} from '../sim/prng';

await initializePhysics();

type Control = 'natural' | 'turn-left' | 'turn-right';
function measure(seed:number,control:Control='natural',seconds=18){
 const s=new WorldSimulation(seed,0);
 try{
  s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
  const g=createFounderGenome('f-'+seed,'Fin-tailed founder',new PRNG(seed),'fin_tail');
  const o=s.addOrganism(g,new THREE.Vector3(0,8,0));
  const head=o.bodies[0],before=o.com.clone(),startingReserve=o.reserves;
  const forward=new THREE.Vector3(0,0,-1);
  const initialForward=forward.clone().applyQuaternion(head.rot);
  if(control!=='natural'){
    // A *test-only* controlled input to the ordinary neural output channels,
    // not a scripted movement, kinematic steer, or extra force. All other
    // outputs are still calculated by the genuine inherited recurrent brain.
    const left=o.joints.findIndex(j=>j.child.id==='blade-0');
    const right=o.joints.findIndex(j=>j.child.id==='blade-1');
    assert.ok(left>=0&&right>=0);
    const brainStep=o.brain.step.bind(o.brain);
    const amount=control==='turn-left'?-1:.5;
    o.brain.step=(dt:number)=>{
      brainStep(dt);
      o.brain.outputs[left*4]=amount;
      o.brain.outputs[right*4]=-amount;
    };
  }
  let path=0,maxGap=0,maxAxis=0;const previous=before.clone();
  for(let n=0;n<seconds*60;n++){
   s.stepOuterTick();path+=o.com.distanceTo(previous);previous.copy(o.com);
   for(const j of o.joints){maxGap=Math.max(maxGap,j.anchorError);maxAxis=Math.max(maxAxis,j.axisError);}
  }
  const finalForward=forward.clone().applyQuaternion(head.rot);
  const angle=Math.atan2(finalForward.x,-finalForward.z)-Math.atan2(initialForward.x,-initialForward.z);
  const yaw=Math.atan2(Math.sin(angle),Math.cos(angle));
  const delta=o.com.clone().sub(before),net=delta.length(),spent=startingReserve-o.reserves;
  return{seed,control,seconds,parts:o.bodies.length,outputs:o.brain.outputs.length,
   net,forward:-delta.z,side:delta.x,vertical:delta.y,yaw,path,spent,
   efficiency:net/spent,remaining:o.reserves,startingReserve,maxGap,maxAxis,
   ledgerResidual:s.getTelemetry().chemicalEnergyLedger.conservationResidual,
   work:o.totalWorkJoules,alive:s.organisms.includes(o),simTime:s.simTime,steps:s.physicsStepCount};
 }finally{s.dispose();}
}

test('fin-tail is a valid original heritable specimen with real blades, full neural channels and morphology costs',()=>{
 const g=createFounderGenome('fin','F-tail',new PRNG(4242),'fin_tail');
 assert.ok(validateGenome(g));
 assert.equal(g.parts.length,7);
 assert.equal(g.parts.filter(p=>p.parentId!==null).length,6);
 assert.deepEqual(g.parts.slice(-2).map(p=>p.thicknessScaleY),[.2,.2]);
 assert.deepEqual(g.parts.slice(-2).map(p=>p.hingeAxis),['Z','Z']);
 assert.deepEqual(g.parts.slice(-2).map(p=>p.motorFeatherAngle),[-1.35,1.35]);
 assert.ok(g.parts.some(p=>p.motorStrokeDuty===.25));
 assert.equal(g.brain.outputWeights.length,24);
 assert.equal(g.brain.outputBiases.length,24);
 assert.ok(g.brain.outputWeights.slice(20).some(row=>row.some(w=>w!==0)),
   'added axial/fin joint outputs must be genuinely connected to live neurons');
 const previous=JSON.stringify(g);
 const mutated=Array.from({length:12},(_,i)=>mutateGenome(g,new PRNG(i+1),'offspring-'+i));
 assert.equal(JSON.stringify(g),previous,'offspring must never alter live parent DNA');
 assert.ok(mutated.some(x=>x!==g));
 assert.ok(mutated.every(x=>x===g||validateGenome(x)));
 const legacy=createFounderGenome('old','Old tri-limb',new PRNG(4242),'tri_limb');
 assert.equal(legacy.parts.length,3,'older saved starter genotype remains supported separately');
});

test('fin-tail moves its physical COM and stays funded and stable across inherited brains',()=>{
 const results=[4242,6001,9037].map(seed=>measure(seed));
 console.log('FIN_TAIL_LIVE_SEEDS',JSON.stringify(results));
 for(const r of results){
  assert.equal(r.parts,7);assert.equal(r.outputs,24);
  assert.equal(r.steps,2160);assert.ok(r.alive);
  assert.ok(r.net>.35,'new fin-tail must materially exceed original tri-limb .01-.03 m / 18s');
  assert.ok(r.path>=r.net&&r.forward>.15,'travel must have longitudinal component');
  assert.ok(r.spent>0&&r.remaining>150,'no hidden refills or immediate reserve exhaustion');
  assert.ok(r.work>0&&r.maxGap<.005&&r.maxAxis<.01);
  assert.ok(Math.abs(r.ledgerResidual)<1e-5);
 }
});

test('both steering directions are controllable through ordinary independent blade neural outputs',()=>{
 const cases=[4242,6001,9037].map(seed=>({
  natural:measure(seed,'natural',12),
  left:measure(seed,'turn-left',12),
  right:measure(seed,'turn-right',12)
 }));
 console.log('FIN_TAIL_NEURAL_STEERING',JSON.stringify(cases));
 for(const x of cases){
  assert.ok(x.left.yaw < .02,
    'left pitch command must shift yaw to the negative side of the initial heading');
  assert.ok(x.right.yaw > .1,
    'opposing pitch command must shift yaw to the positive side');
  assert.ok(x.right.yaw - x.left.yaw > .25,
    'left and right neural motor commands must cause meaningfully different headings');
  for(const r of [x.natural,x.left,x.right]){
   assert.ok(r.net>=0&&r.work>0&&r.maxGap<.005&&r.remaining>0);
   assert.ok(Math.abs(r.ledgerResidual)<1e-5);
  }
 }
});

test('a seeded 14-founder tank with independent fin-tails stays stable and chemically conserved',()=>{
 const s=new WorldSimulation(4242,14);
 try{
  const before=new Map(s.organisms.map(o=>[o.genome.id,o.com.clone()]));
  const finTails=s.organisms.filter(o=>o.genome.parts.some(p=>p.motorFeatherAngle!==undefined));
  assert.equal(finTails.length,4);
  assert.equal(s.organisms.length,14);
  assert.ok(finTails.every(o=>o.brain.outputs.length===24&&o.bodies.length===7));
  for(let n=0;n<360;n++)s.stepOuterTick();
  const result=finTails.map(o=>({id:o.genome.id,
    net:o.com.distanceTo(before.get(o.genome.id)!),
    energy:o.reserves,
    hinge:Math.max(...o.joints.map(j=>j.anchorError))
  }));
  console.log('FIN_TAIL_POPULATION_6S',JSON.stringify({result,
    residual:s.getTelemetry().chemicalEnergyLedger.conservationResidual}));
  assert.equal(s.physicsStepCount,720);
  assert.equal(s.organisms.length,14);
  assert.ok(result.every(x=>Number.isFinite(x.net)&&x.hinge<.005&&x.energy>0));
  assert.ok(result.some(x=>x.net>.1));
  assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
 }finally{s.dispose();}
});
