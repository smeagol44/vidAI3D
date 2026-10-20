import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
import {bodyLayout} from '../sim/organism';
await initializePhysics();
type Variant={rootX:number;wingTorque:number;tailTorque:number;phase:number;wingAxis:'Z'|'Y'};
function run(opt:Variant,seconds=10){
 const s=new WorldSimulation(4242,0);
 try{
  s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
  const g=createFounderGenome('t','tri_limb',new PRNG(4242),'tri_limb');
  const [root,wing1,wing2]=g.parts;
  root.dimX=opt.rootX;
  const chain=[];
  let parentId=root.id;
  for(let i=0;i<3;i++){
   const id='part-'+(i+3);
   const tail={...wing1,id,parentId,parentFace:'+Z' as const,attachFace:'-Z' as const,
    hingeAxis:'Y' as const,dimX:1,dimY:1,dimZ:3,motorPhase:i*opt.phase*Math.PI,
    motorMaxTorque:opt.tailTorque,hasEye:false,hasMouth:false};
   chain.push(tail);parentId=id;
  }
  wing1.hingeAxis=opt.wingAxis;wing2.hingeAxis=opt.wingAxis;
  wing1.motorMaxTorque=opt.wingTorque;wing2.motorMaxTorque=opt.wingTorque;
  wing1.motorPhase=0;wing2.motorPhase=opt.phase*Math.PI;
  g.parts=[root,...chain,wing1,wing2];
  const layout=bodyLayout(g,new THREE.Vector3(0,8,0),new THREE.Quaternion());
  const aabb=new THREE.Box3();for(const q of layout)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
   aabb.expandByPoint(new THREE.Vector3(x*q.gene.dimX*.15,y*q.gene.dimY*.15,z*q.gene.dimZ*.15).applyQuaternion(q.rot).add(q.pos));
  const size=aabb.getSize(new THREE.Vector3());const bodyLength=Math.max(size.x,size.y,size.z);
  const o=s.addOrganism(g,new THREE.Vector3(0,8,0)),initial=o.com.clone(),startReserve=o.reserves;
  let gap=0,life=0;
  for(let i=0;i<seconds*60;i++){
   s.stepOuterTick();life+=1/60;
   for(const j of o.joints)gap=Math.max(gap,j.anchorError);
   if(!s.organisms.includes(o))break;
  }
  return{opt,bodyLength,life,net:o.com.distanceTo(initial),z:o.com.z-initial.z,x:o.com.x-initial.x,
   BLperSec:o.com.distanceTo(initial)/bodyLength/life,used:startReserve-o.reserves,remaining:o.reserves,
   gap,alive:s.organisms.includes(o)};
 }catch(e){return {opt,error:String(e)};}finally{s.dispose();}
}
test('diagnostic: test three-link tail for genuinely forward trilimb swimming',()=>{
 const results:ReturnType<typeof run>[]=[];
 for(const rootX of [1,2,3])
 for(const wingTorque of [0,100,400])
 for(const phase of [.25,.5,.75])
  results.push(run({rootX,wingTorque,tailTorque:800,phase,wingAxis:'Z'}));
 const ok=results.filter((x):x is Exclude<typeof x,{error:string}>=>!('error'in x));
 console.log('TRILIMB_THREE_TAIL_MATRIX',JSON.stringify({best:ok.sort((a,b)=>b.BLperSec-a.BLperSec).slice(0,20),errors:results.filter(x=>'error'in x)}));
});
