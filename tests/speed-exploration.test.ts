import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
import {bodyLayout} from '../sim/organism';
await initializePhysics();
interface Options {wingTorque:number;tailTorque:number;tailLength:number;phase:number;wingAxis:'Z'|'Y';tailAxis:'Y'|'X'}
function run(opt:Options,seconds=8){
 const s=new WorldSimulation(4242,0);
 try{
  s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
  const g=createFounderGenome('t','tri_limb',new PRNG(4242),'tri_limb');
  const [root,wing1,wing2]=g.parts;
  const tail1={...wing1,id:'part-3',parentId:root.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    hingeAxis:opt.tailAxis,dimX:1,dimY:1,dimZ:opt.tailLength,motorPhase:0,motorMaxTorque:opt.tailTorque,hasEye:false,hasMouth:false};
  const tail2={...tail1,id:'part-4',parentId:'part-3',motorPhase:opt.phase*Math.PI};
  wing1.hingeAxis=opt.wingAxis;wing2.hingeAxis=opt.wingAxis;
  wing1.motorMaxTorque=opt.wingTorque;wing2.motorMaxTorque=opt.wingTorque;
  wing1.motorPhase=opt.phase*Math.PI;wing2.motorPhase=(opt.phase+.5)*Math.PI;
  g.parts=[root,tail1,tail2,wing1,wing2];
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
    bodyLengthsPerSec:o.com.distanceTo(initial)/bodyLength/life,used:startReserve-o.reserves,remaining:o.reserves,
    gap,alive:s.organisms.includes(o)};
 }catch(e){return {opt,error:String(e)};}finally{s.dispose();}
}
test('diagnostic: front-body first vs tail-led physically jointed trilimb swimming',()=>{
 const results:ReturnType<typeof run>[]=[];
 for(const wingTorque of [0,50,200,400])
 for(const tailLength of [2,3,4,5])
 for(const phase of [.25,.5,.75,1])
   results.push(run({wingTorque,tailTorque:800,tailLength,phase,wingAxis:'Z',tailAxis:'Y'}));
 for(const wingTorque of [0,100,400])
 for(const phase of [.25,.5,.75])
   results.push(run({wingTorque,tailTorque:800,tailLength:3,phase,wingAxis:'Y',tailAxis:'Y'}));
 const ok=results.filter((x):x is Exclude<typeof x,{error:string}> => !('error'in x));
 console.log('TRILIMB_TAIL_MATRIX',JSON.stringify({
  best:ok.sort((a,b)=>b.bodyLengthsPerSec-a.bodyLengthsPerSec).slice(0,25),
  errors:results.filter(x=>'error'in x)
 }));
});
