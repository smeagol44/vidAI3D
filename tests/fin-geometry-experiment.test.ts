import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
await initializePhysics();

type Wing={thick:number;span:number;chord:number;leftPhase:number;rightPhase:number;axis:'Y'|'Z';torque:number;rootY:number};
function measureWing(opt:Wing,seconds=7){
 const sim=new WorldSimulation(4242,0);
 try{
  sim.clearFreeNutrients();sim.nutrientInflowPerSec=0;sim.targetNutrientCount=0;
  const g=createFounderGenome('wing-probe','tri_limb',new PRNG(4242),'tri_limb');
  g.parts[0].dimY=opt.rootY;
  for(const [i,p] of g.parts.slice(1).entries()){
   p.dimX=opt.thick;p.dimY=opt.span;p.dimZ=opt.chord;
   p.hingeAxis=opt.axis;p.motorMaxTorque=opt.torque;
   p.motorPhase=(i===0?opt.leftPhase:opt.rightPhase)*Math.PI;
  }
  const org=sim.addOrganism(g,new THREE.Vector3(0,8,0));
  const start=org.com.clone(),r0=org.reserves;
  let maxGap=0;
  for(let i=0;i<seconds*60;i++){
   sim.stepOuterTick();
   for(const j of org.joints)maxGap=Math.max(maxGap,j.anchorError);
   if(!sim.organisms.includes(org))break;
  }
  return{opt,net:org.com.distanceTo(start),forward:org.com.z-start.z,lateral:org.com.x-start.x,
    spent:r0-org.reserves,work:org.totalWorkJoules,gap:maxGap,alive:sim.organisms.includes(org)};
 }catch(e){return{opt,error:String(e)};}finally{sim.dispose();}
}
test('diagnostic: thin and broad side fin orientation / phase sweep',()=>{
 const results:ReturnType<typeof measureWing>[]=[];
 for(const axis of ['Y','Z'] as const)
 for(const span of [1,2,3,4,5])
 for(const chord of [2,3,4])
 for(const rightPhase of [0,.25,.5,.75,1,1.25,1.5])
  results.push(measureWing({thick:1,span,chord,leftPhase:0,rightPhase,axis,torque:800,rootY:1}));
 for(const thick of [1,2])
 for(const span of [1,3,5])
 for(const rightPhase of [.25,.5,.75])
  results.push(measureWing({thick,span,chord:3,leftPhase:.25,rightPhase,axis:'Y',torque:800,rootY:2}));
 const good=results.filter((r):r is Extract<typeof r,{net:number}>=>'net'in r && Number.isFinite(r.net));
 console.log('THIN_BROAD_WING_SWEEP',JSON.stringify({
  topForward:good.filter(x=>x.alive).sort((a,b)=>b.forward-a.forward).slice(0,25),
  topNet:good.sort((a,b)=>b.net-a.net).slice(0,15),
  baseline:measureWing({thick:2,span:1,chord:2,leftPhase:0,rightPhase:.5,axis:'Z',torque:400,rootY:2}),
  errors:results.filter(x=>'error'in x).slice(0,12),count:results.length
 }));
});
