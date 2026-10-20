import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
await initializePhysics();
type Shape='planar_swimmer'|'3d_serpent'|'tri_limb';
function probe(shape:Shape,torque:number,frequency:number,seconds=5){
 const sim=new WorldSimulation(101,0);
 try{
  sim.clearFreeNutrients();sim.targetNutrientCount=0;sim.nutrientInflowPerSec=0;
  const g=createFounderGenome('probe',shape,new PRNG(4242),shape);
  for(const p of g.parts)if(p.parentId){p.motorFrequency=frequency;p.motorMaxTorque=torque;}
  const o=sim.addOrganism(g,new THREE.Vector3(0,8,0)),start=o.com.clone(),prev=start.clone(),reserve=o.reserves;
  let path=0,aliveTime=0,gap=0,axis=0;
  for(let i=0;i<seconds*60;i++){
   sim.stepOuterTick();aliveTime+=1/60;
   path+=o.com.distanceTo(prev);prev.copy(o.com);
   for(const j of o.joints){gap=Math.max(gap,j.anchorError);axis=Math.max(axis,j.axisError);}
   if(!sim.organisms.includes(o))break;
  }
  return{shape,torque,frequency,aliveTime,net:o.com.distanceTo(start),signedZ:o.com.z-start.z,
   x:o.com.x-start.x,speed:o.com.distanceTo(start)/aliveTime, reserve:o.reserves,
   spent:reserve-o.reserves,work:o.totalWorkJoules,path,gap,axis,dead:!sim.organisms.includes(o),
   residual:sim.getTelemetry().chemicalEnergyLedger.conservationResidual};
 }catch(e){return{shape,torque,frequency,error:String(e)};}
 finally{sim.dispose();}
}
test('diagnostic: physical torque vs stroke speed and real chemical exhaustion',()=>{
 const runs=[];
 for(const sh of ['planar_swimmer','3d_serpent','tri_limb'] as const)
  for(const frequency of [.65,1,1.5,2,3])
   for(const torque of [400,800,1600,3200,6400])
    runs.push(probe(sh,torque,frequency));
 const summary:Record<string,unknown>={};
 for(const sh of ['planar_swimmer','3d_serpent','tri_limb']){
  const xs=runs.filter(x=>x.shape===sh&&!('error'in x));
  summary[sh]=xs.sort((a,b)=>(b.speed||0)-(a.speed||0)).slice(0,14);
  summary[sh+'_baseline']=runs.find(x=>x.shape===sh&&x.frequency===.65&&x.torque===400);
  summary[sh+'_errors']=runs.filter(x=>x.shape===sh&&'error'in x);
 }
 console.log('HIGH_MOTOR_MATRIX_V022',JSON.stringify(summary));
});
test('diagnostic: default 14-organism full ecology throughput at 60 outer ticks',()=>{
 const world=new WorldSimulation(4242,14);
 try{
  const before=world.organisms.map(o=>({id:o.genome.id,shape:o.genome.parts.length,point:o.com.clone()}));
  const start=performance.now();
  for(let tick=0;tick<60;tick++)world.stepOuterTick();
  const elapsed=performance.now()-start;
  const byShape=world.organisms.map(o=>{
   const prior=before.find(a=>a.id===o.genome.id);
   return{id:o.genome.id,parts:o.bodies.length,reserves:o.reserves,net:prior?o.com.distanceTo(prior.point):null};
  });
  console.log('ECOSYSTEM_1S_THROUGHPUT',JSON.stringify({
   simulatedSeconds:world.simTime,wallTimeMs:elapsed,relativeToRealTime:1000/elapsed,
   organismCount:world.organisms.length,nutrientCount:world.nutrients.length,
   physicsSteps:world.physicsStepCount,byShape,ledgerResidual:world.getTelemetry().chemicalEnergyLedger.conservationResidual
  }));
 }finally{world.dispose();}
});
