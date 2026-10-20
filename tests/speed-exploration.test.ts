import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {bodyLayout} from '../sim/organism';
import {PRNG} from '../sim/prng';
await initializePhysics();
type Shape='planar_swimmer'|'3d_serpent'|'tri_limb';
type Opt={links:number; torque:number; frequency:number; rootY:number; tailY:number; phaseStep:number; axes:string};
function measure(shape:Shape,opt:Opt,seconds=8){
 const sim=new WorldSimulation(101,0);
 try{
  sim.clearFreeNutrients();sim.targetNutrientCount=0;sim.nutrientInflowPerSec=0;
  const g=createFounderGenome('probe',shape,new PRNG(4242),shape);
  const oldNum=g.parts.length;
  const tailAt=shape==='tri_limb'?0:oldNum-1;
  let previous='part-'+tailAt;
  for(let k=0;k<opt.links;k++){
   const id='part-'+(oldNum+k);
   g.parts.push({
    ...g.parts[oldNum-1],id,parentId:previous,parentFace:'+Z',attachFace:'-Z',
    dimX:1,dimY:opt.tailY,dimZ:3,hingeAxis:opt.axes[k%opt.axes.length] as 'X'|'Y'|'Z',
    motorFrequency:opt.frequency,motorMaxTorque:opt.torque,motorPhase:(k+2)*opt.phaseStep*Math.PI,
    hasMouth:false,hasEye:false
   });
   previous=id;
  }
  g.parts[0].dimY=opt.rootY;
  const joints=g.parts.filter(p=>p.parentId!==null);
  for(let i=0;i<joints.length;i++){joints[i].motorFrequency=opt.frequency;joints[i].motorMaxTorque=opt.torque;}
  if(shape==='tri_limb' && opt.links>0){
   g.parts[1].hingeAxis='Z';g.parts[2].hingeAxis='Z';
   for(let i=3;i<g.parts.length;i++)g.parts[i].motorPhase=(i-2)*opt.phaseStep*Math.PI;
  }else if(shape!=='tri_limb'&&opt.links>0){
   for(let i=1;i<g.parts.length;i++)g.parts[i].motorPhase=i*opt.phaseStep*Math.PI;
  }
  const layout=bodyLayout(g,new THREE.Vector3(0,8,0),new THREE.Quaternion());
  const box=new THREE.Box3();for(const q of layout)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
   box.expandByPoint(new THREE.Vector3(x*q.gene.dimX*.15,y*q.gene.dimY*.15,z*q.gene.dimZ*.15).applyQuaternion(q.rot).add(q.pos));
  const d=box.getSize(new THREE.Vector3()),bodyLength=Math.max(d.x,d.y,d.z);
  const o=sim.addOrganism(g,new THREE.Vector3(0,8,0)),start=o.com.clone(),prev=start.clone(),begin=o.reserves;
  let path=0,gap=0;
  for(let i=0;i<seconds*60;i++){
   sim.stepOuterTick();path+=prev.distanceTo(o.com);prev.copy(o.com);
   for(const j of o.joints)gap=Math.max(gap,j.anchorError);
   if(!sim.organisms.includes(o))break;
  }
  return{shape,opt,net:o.com.distanceTo(start),z:o.com.z-start.z,bodyLength,BLperSec:o.com.distanceTo(start)/bodyLength/seconds,
    reserve:o.reserves,spent:begin-o.reserves,path,gap,alive:sim.organisms.includes(o)};
 }catch(e){return{shape,opt,error:String(e)};}finally{sim.dispose();}
}
test('diagnostic: enlarged connected swimmers and asymmetric heads',()=>{
 const variants:Opt[]=[];
 for(const links of [0,1,2,3]){
   for(const phaseStep of [.33,.5,.66]){
     variants.push({links,torque:600,frequency:.65,rootY:1,tailY:1,phaseStep,axes:'Y'});
   }
 }
 for(const tailY of [1,2,3]){
  for(const rootY of [1,2,3]){
   variants.push({links:2,torque:700,frequency:.6,rootY,tailY,phaseStep:.5,axes:'Y'});
  }
 }
 for(const frequency of [.5,.65,.8]){
  variants.push({links:2,torque:800,frequency,rootY:2,tailY:1,phaseStep:.5,axes:'Y'});
 }
 const results=[] as ReturnType<typeof measure>[];
 for(const shape of ['planar_swimmer','3d_serpent','tri_limb'] as const){
  for(const opt of variants){
    if((shape==='3d_serpent'&&opt.links>=3)||(shape==='tri_limb'&&opt.links>=3))continue;
    results.push(measure(shape,opt));
  }
 }
 const summary={} as Record<string,unknown>;
 for(const shape of ['planar_swimmer','3d_serpent','tri_limb'] as const){
  summary[shape]=results.filter(v=>v.shape===shape&&!('error'in v)).sort((a,b)=>(b.net||0)-(a.net||0)).slice(0,12);
  summary[shape+'_errors']=results.filter(v=>v.shape===shape&&'error'in v);
 }
 console.log('LONG_SWIMMER_MATRIX_V022',JSON.stringify(summary));
});
