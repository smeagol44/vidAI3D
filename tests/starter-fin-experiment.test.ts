import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
import {validateGenome} from '../sim/genome';
await initializePhysics();
type Opt={tail:number;fins:boolean;root:'tri_limb'|'planar_swimmer';strokeDuty:number;pitch:number;tailPhase:number;axis:'Y'|'Z';torque:number;reverse:boolean};

function built(o:Opt, seed=4242){
 const g=createFounderGenome('trial',o.root,new PRNG(seed),o.root);
 let root=g.parts[0], left=g.parts[1],right=g.parts[2];
 if(o.root==='planar_swimmer'){
   // Keep the proven axial swim body, place paired fins beside the root.
   g.parts=g.parts.slice(0,Math.max(2,Math.min(6,o.tail+1)));
   root=g.parts[0];
   left={...g.parts[1],id:'wing-left',parentId:root.id,parentFace:'+X',attachFace:'-X',dimX:2,dimY:1,dimZ:2,hasMouth:false,hasEye:false};
   right={...left,id:'wing-right',parentFace:'-X',attachFace:'+X'};
   g.parts.push(left,right);
 } else {
   g.parts=[root,left,right];
   let previous=root.id;
   for(let i=0;i<o.tail;i++){
     const original=g.parts[1];
     const p={...original,id:'axial-'+i,parentId:previous,parentFace:'+Z' as const,attachFace:'-Z' as const,
       dimX:1,dimY:1,dimZ:3,hingeAxis:'Y' as const,motorPhase:(i+1)*o.tailPhase*Math.PI,
       motorFrequency:.65,motorMaxTorque:400,hasMouth:false,hasEye:false};
     g.parts.push(p);previous=p.id;
   }
 }
 for(const [i,w] of [left,right].entries()){
   w.hingeAxis=o.axis;w.motorMaxTorque=o.torque;w.motorPhase=i*Math.PI;
   w.dimX=2;w.dimY=1;w.dimZ=2;
   if(o.fins)w.motorStrokeDuty=o.strokeDuty;
 }
 if(o.fins){
   const tips=[left,right].map((p,i)=>({
    ...p,id:'blade-'+i,parentId:p.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    dimX:1,dimY:1,dimZ:4,thicknessScaleY:.2,
    hingeAxis:'Z' as const,motorMaxTorque:o.torque,
    motorPhase:i*Math.PI+Math.PI*.5,
    restAngle:(i===0?1:-1)*o.pitch,
    motorFeatherAngle:(i===0?-1:1)*(o.reverse?-o.pitch:o.pitch),
    minAngle:-Math.PI*.49,maxAngle:Math.PI*.49,
    hasMouth:false,hasEye:false
   }));
   g.parts.push(...tips);
 }
 g.brain.outputWeights=g.brain.outputWeights.slice(0,Math.max(0,(g.parts.length-1)*4));
 g.brain.outputBiases=g.brain.outputBiases.slice(0,Math.max(0,(g.parts.length-1)*4));
 while(g.brain.outputWeights.length<(g.parts.length-1)*4){
   const i=g.brain.outputWeights.length;
   const scale=i%4===0 || i%4===3 ?.15:1;
   g.brain.outputBiases.push(0);
   g.brain.outputWeights.push(Array.from({length:g.brain.hiddenCount},()=>0*scale));
 }
 if(!validateGenome(g))throw Error('genome invalid');
 return g;
}
function run(opt:Opt,seconds=12,seed=4242,steering=0){
 const s=new WorldSimulation(seed,0);
 try{
  s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;
  const g=built(opt,seed);
  const a=s.addOrganism(g,new THREE.Vector3(0,8,0));
  const start=a.com.clone(),initial=a.reserves,old=a.brain.step.bind(a.brain);
  if(steering!==0){
   const ids=a.joints.map(j=>j.child.id);
   const il=ids.indexOf(opt.root==='tri_limb'?'part-1':'wing-left'),ir=ids.indexOf(opt.root==='tri_limb'?'part-2':'wing-right');
   a.brain.step=(dt:number)=>{
    old(dt);
    if(il>=0&&ir>=0){
      a.brain.outputs[il*4]=steering;
      a.brain.outputs[ir*4]=-steering;
    }
   };
  }
  const startOrientation=new THREE.Vector3(0,0,-1).applyQuaternion(a.bodies[0].rot);
  let gap=0,axis=0,path=0,half=0,steps=0;const prev=start.clone();
  for(let t=0;t<seconds*60;t++){
   s.stepOuterTick();steps++;
   path+=prev.distanceTo(a.com);prev.copy(a.com);
   for(const j of a.joints){gap=Math.max(gap,j.anchorError);axis=Math.max(axis,j.axisError);}
   if(t===seconds*30-1)half=a.com.distanceTo(start);
   if(!s.organisms.includes(a))break;
  }
  const heading=new THREE.Vector3(0,0,-1).applyQuaternion(a.bodies[0].rot);
  const yaw=Math.atan2(heading.x, -heading.z)-Math.atan2(startOrientation.x,-startOrientation.z);
  const wrappedYaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
  const displacement=a.com.clone().sub(start);
  return{opt,seed,steering,steps,parts:a.bodies.length,net:displacement.length(),
   forward:-displacement.z,side:displacement.x,y:displacement.y,half,path,yaw:wrappedYaw,
   reserve:a.reserves,spent:initial-a.reserves,eff:(initial-a.reserves)>0?displacement.length()/(initial-a.reserves):0,
   work:a.totalWorkJoules,gap,axis,ledger:s.getTelemetry().chemicalEnergyLedger.conservationResidual,alive:s.organisms.includes(a)};
 }catch(e){return{opt,seed,steering,error:String(e)};}finally{s.dispose();}
}
test('explore hybrid fin and axial starter designs through real ecosystem ticks',()=>{
 const options:Opt[]=[];
 for(const root of ['tri_limb','planar_swimmer'] as const)
 for(const tail of root==='tri_limb'?[0,1,2,3]:[3,4,5])
 for(const fins of [false,true])
 for(const pitch of fins?[.75,1.35]:[0]){
  options.push({root,tail,fins,pitch,strokeDuty:.5,tailPhase:.5,axis:'Y',torque:800,reverse:false});
 }
 for(const axis of ['Y','Z'] as const)
 for(const duty of [.25,.5,.75])
 for(const pitch of [.75,1.35])
 options.push({root:'tri_limb',tail:2,fins:true,pitch,strokeDuty:duty,tailPhase:.5,axis,torque:800,reverse:false});
 const results=options.map(x=>run(x));
 console.log('STARTER_FIN_SWEEP',JSON.stringify({
  count:results.length,
  topNet:results.filter(x=>'net'in x).sort((a,b)=>(b.net??0)-(a.net??0)).slice(0,20),
  topForward:results.filter(x=>'forward'in x).sort((a,b)=>(b.forward??0)-(a.forward??0)).slice(0,20),
  errors:results.filter(x=>'error'in x)
 }));
});

test('diagnostic: several brains and symmetric steering controls on physically finite hybrid swimmers',()=>{
 const baseline:Opt={root:'tri_limb',tail:0,fins:false,pitch:0,strokeDuty:.5,tailPhase:.5,axis:'Z',torque:400,reverse:false};
 const tailOnly:Opt={root:'tri_limb',tail:2,fins:false,pitch:0,strokeDuty:.5,tailPhase:.5,axis:'Y',torque:800,reverse:false};
 const hybrid:Opt={root:'tri_limb',tail:2,fins:true,pitch:1.35,strokeDuty:.25,tailPhase:.5,axis:'Y',torque:800,reverse:false};
 const planarControl:Opt={root:'planar_swimmer',tail:5,fins:false,pitch:0,strokeDuty:.5,tailPhase:.5,axis:'Y',torque:800,reverse:false};
 const opts=[baseline,tailOnly,hybrid,planarControl];
 const trials:ReturnType<typeof run>[]=[];
 for(const seed of [4242,6001,9037]){
  for(const opt of opts){
   for(const steer of opt===hybrid ? [-.65,0,.65] : [0])
    trials.push(run(opt,18,seed,steer));
  }
 }
 console.log('MULTISEED_STEERING_SWEEP',JSON.stringify(trials));
});
