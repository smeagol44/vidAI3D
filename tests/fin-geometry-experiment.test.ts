import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
await initializePhysics();
type Kind='planar_swimmer'|'3d_serpent';
type Shape={kind:Kind; pattern:'baseline'|'all-wide'|'tail-wide'|'alternating-wide'|'distal-wide'|'tapered'|'all-long-wide';torque:number;frequency:number};
function measure(o:Shape,seconds=10){
 const s=new WorldSimulation(4242,0);
 try{
  s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
  const g=createFounderGenome('blade',o.kind,new PRNG(4242),o.kind);
  for(const [i,p] of g.parts.entries()){
   if(o.pattern==='all-wide')p.dimY=3;
   if(o.pattern==='tail-wide'&&i>=4)p.dimY=3;
   if(o.pattern==='alternating-wide'&&i%2===1)p.dimY=3;
   if(o.pattern==='distal-wide'&&i===5)p.dimY=3;
   if(o.pattern==='tapered')p.dimY=i<=1?3:i<=3?2:1;
   if(o.pattern==='all-long-wide'){p.dimY=4;p.dimZ=4;}
   if(i>0){p.motorMaxTorque=o.torque;p.motorFrequency=o.frequency;}
  }
  const organism=s.addOrganism(g,new THREE.Vector3(0,8,0)),first=organism.com.clone(),initialReserve=organism.reserves;
  let maxGap=0,half=0;
  for(let i=0;i<seconds*60;i++){
   s.stepOuterTick();
   if(i===seconds*30-1)half=organism.com.distanceTo(first);
   for(const j of organism.joints)maxGap=Math.max(maxGap,j.anchorError);
   if(!s.organisms.includes(organism))break;
  }
  return{opt:o,net:organism.com.distanceTo(first),forward:organism.com.z-first.z,lateral:organism.com.x-first.x,
   half,spent:initialReserve-organism.reserves,work:organism.totalWorkJoules,reserve:organism.reserves,
   maxGap,residual:s.getTelemetry().chemicalEnergyLedger.conservationResidual,alive:s.organisms.includes(organism)};
 }catch(e){return{opt:o,error:String(e)};}finally{s.dispose();}
}
test('diagnostic: same-thickness six-link fish with thin broad fins of several profiles',()=>{
 const results:ReturnType<typeof measure>[]=[];
 for(const kind of ['planar_swimmer','3d_serpent'] as const)
 for(const pattern of ['baseline','all-wide','tail-wide','alternating-wide','distal-wide','tapered','all-long-wide'] as const)
 for(const torque of [400,800,1600])
 for(const frequency of [.5,.65])
 results.push(measure({kind,pattern,torque,frequency}));
 const good=results.filter((x):x is ReturnType<typeof measure> & {net:number;forward:number;alive:boolean}=>typeof x.forward==='number'&&x.alive===true);
 const summary={} as Record<string,unknown>;
 for(const kind of ['planar_swimmer','3d_serpent'] as const){
  summary[kind]=good.filter(x=>x.opt.kind===kind).sort((a,b)=>b.forward-a.forward).slice(0,25);
  summary[kind+'-baseline']=good.filter(x=>x.opt.kind===kind&&x.opt.pattern==='baseline');
 }
 summary.errors=results.filter(x=>'error'in x);
 console.log('THIN_WIDE_SWIMMERS',JSON.stringify(summary));
});
