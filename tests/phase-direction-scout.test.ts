/** Disposable diagnostic: compare inherited axial motor wave direction on production physics. */
import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
await initializePhysics();
const circle = 2*Math.PI;
const wrap = (x:number) => ((x % circle)+circle)%circle;
const changes = ['baseline','reverse','shift-pi','reverse-shift-pi','flat','quarter-reverse'] as const;
function sample(founder:'planar_swimmer'|'3d_serpent',mode:typeof changes[number],seed:number){
 const s = new WorldSimulation(seed,0);
 try {
  s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;s.maxOrganisms=1;
  const genome=createFounderGenome('test','Test',new PRNG(seed),founder);
  const increments = founder==='planar_swimmer'?Math.PI/2:Math.PI/3;
  for(let i=1;i<genome.parts.length;i++){
   const p=genome.parts[i];
   if(mode==='reverse')p.motorPhase=wrap(-i*increments);
   if(mode==='shift-pi')p.motorPhase=wrap(i*increments+Math.PI);
   if(mode==='reverse-shift-pi')p.motorPhase=wrap(-i*increments+Math.PI);
   if(mode==='flat')p.motorPhase=0;
   if(mode==='quarter-reverse')p.motorPhase=wrap(-i*Math.PI/4);
  }
  const o=s.addOrganism(genome,new THREE.Vector3(0,8,0));
  const start=o.com.clone(),head=new THREE.Vector3(0,0,-1).applyQuaternion(o.bodies[0].rot);
  let half=0,maxGap=0;
  for(let i=0;i<480;i++){
   s.stepOuterTick();
   if(i===239)half=o.com.clone().sub(start).dot(head);
   for(const j of o.joints)maxGap=Math.max(maxGap,j.anchorError);
  }
  const d=o.com.clone().sub(start);
  return {founder,mode,seed,headFirst:d.dot(head),halfHeadFirst:half,net:d.length(),motor:o.totalMotorChemicalSpent,
   eff:d.dot(head)/Math.max(.001,o.totalMotorChemicalSpent),hinge:maxGap,ledger:s.getTelemetry().chemicalEnergyLedger.conservationResidual};
 } finally{s.dispose()}
}
test('disposable directional phase comparison',()=>{
 for(const founder of ['planar_swimmer','3d_serpent'] as const){
  for(const mode of changes)console.log('PHASE_DIRECTION_SCOUT',JSON.stringify(sample(founder,mode,4242)));
 }
});
