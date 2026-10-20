import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics, PHYSICS_DT } from '../sim/physics';
import { strokeWave, recoveryFeatherWeight } from '../sim/gait';
import { createFounderGenome, mutateGenome } from '../sim/mutation';
import { WorldSimulation } from '../sim/simulation';
import { OrganismInstance } from '../sim/organism';
import { validateGenome } from '../sim/genome';
import { PRNG } from '../sim/prng';
await initializePhysics();

test('legacy stroke remains sinusoidal; power/recovery asymmetry is smooth and bounded',()=>{
  for(let i=-200;i<200;i++){
    const phase=i*.04;
    assert.ok(Math.abs(strokeWave(phase,.5)-Math.sin(phase))<1e-12);
    for(const duty of [.2,.3,.7,.8]){
      const v=strokeWave(phase,duty);
      assert.ok(Number.isFinite(v)&&Math.abs(v)<=1+1e-12);
    }
  }
  assert.ok(recoveryFeatherWeight(0)<.01);
  assert.ok(recoveryFeatherWeight(Math.PI)>.99);
  assert.ok(recoveryFeatherWeight(2*Math.PI)<.01);
  assert.ok(Math.abs(strokeWave(2*Math.PI*(.3-.25),.3)-1)<1e-10);
  assert.ok(Math.abs(strokeWave(3*Math.PI/2,.7)+1)<1e-10);
});

function fins(duty=.5, feather=0, width=2, legacy=false){
  const g=createFounderGenome('recovery','tri_limb',new PRNG(4242),'tri_limb');
  const [root,left,right]=g.parts;
  for(const p of [left,right]){
    p.dimX=1;p.dimY=1;p.dimZ=2;p.hingeAxis='Y';p.motorMaxTorque=800;
    if(!legacy)p.motorStrokeDuty=duty;
  }
  left.motorPhase=0;right.motorPhase=Math.PI;
  const leftTip={...left,id:'part-3',parentId:left.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    hingeAxis:'Z' as const,minAngle:-Math.PI*.49,maxAngle:Math.PI*.49,
    motorPhase:Math.PI*.5,dimZ:width,thicknessScaleY:.2,hasEye:false,hasMouth:false};
  const rightTip={...right,id:'part-4',parentId:right.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    hingeAxis:'Z' as const,minAngle:-Math.PI*.49,maxAngle:Math.PI*.49,
    motorPhase:Math.PI*1.5,dimZ:width,thicknessScaleY:.2,hasEye:false,hasMouth:false};
  if(!legacy) {leftTip.motorFeatherAngle=feather;rightTip.motorFeatherAngle=-feather;}
  g.parts=[root,left,leftTip,right,rightTip];
  assert.ok(validateGenome(g));
  return g;
}
test('a feather hinge uses its parent phase, still consumes real motor work and respects limits',()=>{
 const genome=fins(.32,1,2),o=new OrganismInstance(genome,new THREE.Vector3(0,8,0));
 try {
  assert.equal(o.joints.length,4);
  // Positive parent stroke holds the blade close to its broad-face target.
  o.joints[0].jointPhase=0;
  o.joints[1].jointPhase=Math.PI*.5;
  o.preparePhysicsSubstep(PHYSICS_DT,250);
  const duringPower=o.joints[1].targetAngle;
  o.joints[0].jointPhase=Math.PI;
  o.joints[1].jointPhase=Math.PI*1.5;
  o.preparePhysicsSubstep(PHYSICS_DT,250);
  const duringRecovery=o.joints[1].targetAngle;
  assert.ok(duringRecovery-duringPower>.9,{duringRecovery,duringPower}.toString());
  assert.ok(duringRecovery <= o.joints[1].maxAngle);
  // With the parent held at the same phase, neural modulation of the child
  // relative oscillator still advances its feathering transition.
  o.joints[1].jointPhase=Math.PI;
  o.preparePhysicsSubstep(PHYSICS_DT,250);
  const changedRelativePhase=o.joints[1].targetAngle;
  assert.ok(Math.abs(changedRelativePhase-duringRecovery)>.05,
    'relative feather frequency channel must not become a dead neural output');
  for(let i=0;i<240;i++ )o.updatePhysicsSubstep();
  assert.ok(o.totalWorkJoules>0);
  assert.ok(o.joints.every(j=>j.anchorError<.005 && j.axisError<.01));
 }finally{o.dispose();}
});

test('power stroke and recovery pitch are genetically inherited and can mutate',()=>{
 const parent=fins(.3,1,2),old=JSON.stringify(parent);
 let strokes=0,pitches=0;
 for(let i=1;i<=100;i++){
  const child=mutateGenome(parent,new PRNG(i), 'child-'+i);
  if(child===parent)continue;
  if(child.parts[1]?.motorStrokeDuty !== parent.parts[1].motorStrokeDuty)strokes++;
  if(child.parts[2]?.motorFeatherAngle !== parent.parts[2].motorFeatherAngle)pitches++;
 }
 assert.equal(JSON.stringify(parent),old);
 assert.ok(strokes>0&&pitches>0);
 for(const invalid of [{motorStrokeDuty:0},{motorStrokeDuty:1},{motorStrokeDuty:NaN},{motorFeatherAngle:100},{motorFeatherAngle:Infinity}]){
  const g=fins();Object.assign(g.parts[1],invalid);
  assert.equal(validateGenome(g),false);
 }
});

test('living full-ecosystem feather orientation / duty: true physical signed travel and net per energy',()=>{
 const options=[{duty:.5,pitch:0,width:2,legacy:true},{duty:.5,pitch:0,width:4,legacy:true}];
 for(const duty of [.25,.5,.75])
 for(const pitch of [-1.35,-.75,0,.75,1.35])
 for(const width of [2,4])
   options.push({duty,pitch,width,legacy:false});
 const records: {duty:number;pitch:number;width:number;legacy:boolean;net:number;forward:number;lateral:number;path:number;energy:number;travelPerEnergy:number;remain:number;motorWork:number;maxGap:number;residual:number}[]=[];
 for(const p of options){
  const sim=new WorldSimulation(4242,0);
  try{
   sim.clearFreeNutrients();sim.targetNutrientCount=0;sim.nutrientInflowPerSec=0;
   const genome=fins(p.duty,0,p.width,p.legacy);
   if(!p.legacy){
     const leftPlate=genome.parts[2],rightPlate=genome.parts[4];
     // Face-on broad plate on the power sweep; return to the thin edge
     // on recovery. Sign mirrored across the body.
     leftPlate.restAngle=p.pitch;rightPlate.restAngle=-p.pitch;
     leftPlate.motorFeatherAngle=-p.pitch;rightPlate.motorFeatherAngle=p.pitch;
   }
   const o=sim.addOrganism(genome,new THREE.Vector3(0,8,0));
   const start=o.com.clone(),previous=start.clone(),startingEnergy=o.reserves;
   let path=0,maxGap=0;
   for(let n=0;n<600;n++){
    sim.stepOuterTick();
    path+=o.com.distanceTo(previous);previous.copy(o.com);
    for(const j of o.joints)maxGap=Math.max(maxGap,j.anchorError);
   }
   const net=o.com.distanceTo(start),energy=startingEnergy-o.reserves;
   records.push({...p,net,forward:o.com.z-start.z,lateral:o.com.x-start.x,path,
    energy,travelPerEnergy:energy>0?net/energy:0,remain:o.reserves,
    motorWork:o.totalWorkJoules,maxGap,
    residual:sim.getTelemetry().chemicalEnergyLedger.conservationResidual});
  }catch(error){
    console.log('FEATHER_ORIENTATION_INVALID',JSON.stringify({p,error:String(error)}));
    throw error;
  }finally{sim.dispose();}
 }
 const ranked=[...records].sort((a,b)=>b.forward-a.forward);
 console.log('POWER_RECOVERY_GAIT_EVIDENCE',JSON.stringify({baseline:records[0],largeBladeControl:records[1],best:ranked.slice(0,15),
   worst:ranked.slice(-5),cases:records.length}));
 assert.ok(records.every(r=>Number.isFinite(r.net)&&r.path>=r.net&&r.energy>0&&r.maxGap<.005
  &&Math.abs(r.residual)<1e-5&&r.remain>0));
});
