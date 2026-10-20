import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
await initializePhysics();
interface Gait{axis:'Y'|'Z';span:number;chord:number;phaseLag:number;rightBasePhase:number;rightPhaseSign:number;torque:number}
function run(cfg:Gait,seconds=7){
 const s=new WorldSimulation(4242,0);
 try{
  s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;
  const g=createFounderGenome('fins','tri_limb',new PRNG(4242),'tri_limb');
  const [root,originalLeft,originalRight]=g.parts;
  root.dimY=1;
  const left={...originalLeft,dimX:1,dimY:cfg.span,dimZ:cfg.chord,hingeAxis:cfg.axis,motorPhase:0,motorMaxTorque:cfg.torque};
  const right={...originalRight,dimX:1,dimY:cfg.span,dimZ:cfg.chord,hingeAxis:cfg.axis,motorPhase:Math.PI*cfg.rightBasePhase,motorMaxTorque:cfg.torque};
  const leftTip={...left,id:'part-3',parentId:left.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    motorPhase:Math.PI*cfg.phaseLag,hasMouth:false,hasEye:false};
  const rightTip={...right,id:'part-4',parentId:right.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    motorPhase:Math.PI*(cfg.rightBasePhase+cfg.rightPhaseSign*cfg.phaseLag),hasMouth:false,hasEye:false};
  g.parts=[root,left,leftTip,right,rightTip];
  const o=s.addOrganism(g,new THREE.Vector3(0,8,0)),start=o.com.clone(),reserve=o.reserves;
  let maxGap=0,peakPhase=0;
  for(let i=0;i<seconds*60;i++){
   s.stepOuterTick();
   for(const j of o.joints)maxGap=Math.max(maxGap,j.anchorError);
   if(!s.organisms.includes(o))break;
  }
  return{cfg,net:o.com.distanceTo(start),forward:o.com.z-start.z,lateral:o.com.x-start.x,
    initialReserve:reserve,reserve:o.reserves,spent:reserve-o.reserves,
    maxGap,alive:s.organisms.includes(o),residual:s.getTelemetry().chemicalEnergyLedger.conservationResidual};
 }catch(e){return{cfg,error:String(e)};}finally{s.dispose();}
}
test('diagnostic: two hinged thin broad fins and asymmetric traveling phases',()=>{
 const measurements:ReturnType<typeof run>[]=[];
 for(const axis of ['Y','Z'] as const)
 for(const span of [1,3,5])
 for(const chord of [2,4])
 for(const phaseLag of [.25,.5,.75])
 for(const rightBasePhase of [0,.5,1,1.5])
 for(const rightPhaseSign of [-1,1])
  measurements.push(run({axis,span,chord,phaseLag,rightBasePhase,rightPhaseSign,torque:800}));
 const good=measurements.filter((x):x is ReturnType<typeof run> & {forward:number;net:number;alive:boolean} => typeof x.forward==='number' && x.alive===true && Number.isFinite(x.forward));
 console.log('MULTIJOINT_FIN_SWEEP',JSON.stringify({
  candidates:measurements.length,valid:good.length,
  topForward:good.sort((a,b)=>b.forward-a.forward).slice(0,30),
  topBack:good.sort((a,b)=>a.forward-b.forward).slice(0,8),
  errors:measurements.filter(x=>'error'in x).slice(0,15)
 }));
});
