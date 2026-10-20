import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics} from '../sim/physics';
import {WorldSimulation} from '../sim/simulation';
import {createFounderGenome} from '../sim/mutation';
import {bodyLayout} from '../sim/organism';
import {PRNG} from '../sim/prng';
await initializePhysics();

type Shape='planar_swimmer'|'3d_serpent'|'tri_limb';
function measure(shape:Shape, variant:string, seconds=8){
  const sim=new WorldSimulation(101,0);
  try{
    sim.clearFreeNutrients();sim.targetNutrientCount=0;sim.nutrientInflowPerSec=0;
    const g=createFounderGenome('probe',shape,new PRNG(4242),shape);
    const p=g.parts.filter(p=>p.parentId!==null);
    const basePhase=p.map(x=>x.motorPhase);
    if(variant.startsWith('freq:')){const f=Number(variant.split(':')[1]);for(const x of p)x.motorFrequency=f;}
    if(variant.startsWith('phase:')){const f=Number(variant.split(':')[1]);for(let i=0;i<p.length;i++)p[i].motorPhase=(i+1)*f*Math.PI;}
    if(variant.startsWith('phaseReverse:')){const f=Number(variant.split(':')[1]);for(let i=0;i<p.length;i++)p[i].motorPhase=-(i+1)*f*Math.PI;}
    if(variant.startsWith('paddleY:'))p[p.length-1].dimY=Number(variant.split(':')[1]);
    if(variant.startsWith('paddleX:'))p[p.length-1].dimX=Number(variant.split(':')[1]);
    if(variant.startsWith('middleY:'))p[0].dimY=Number(variant.split(':')[1]);
    if(variant.startsWith('torque:'))for(const x of p)x.motorMaxTorque=Number(variant.split(':')[1]);
    if(variant.startsWith('serpent:')){
      const [axes,phases]=variant.slice('serpent:'.length).split('|');
      for(let i=0;i<p.length;i++){p[i].hingeAxis=axes[i] as 'X'|'Y'|'Z';p[i].motorPhase=Number(phases.split(',')[i])*Math.PI;}
    }
    if(variant.startsWith('tri:')){
      const [axes,phases]=variant.slice('tri:'.length).split('|');
      for(let i=0;i<p.length;i++){p[i].hingeAxis=axes[i] as 'X'|'Y'|'Z';p[i].motorPhase=Number(phases.split(',')[i])*Math.PI;}
    }
    if(variant.startsWith('tail:')){
      const [axes,phases]=variant.slice('tail:'.length).split('|');
      for(let i=0;i<p.length;i++){p[i].hingeAxis=axes[i] as 'X'|'Y'|'Z';p[i].motorPhase=Number(phases.split(',')[i])*Math.PI;}
      g.parts.push({...g.parts[1],id:'part-3',parentId:'part-0',parentFace:'+Z',attachFace:'-Z',dimX:1,dimY:1,dimZ:3,hingeAxis:'Y',motorPhase:Math.PI,hasMouth:false,hasEye:false});
    }
    // Avoid geometry counted as movement: report centre of mass of the same simulated individual.
    const layout=bodyLayout(g,new THREE.Vector3(0,8,0),new THREE.Quaternion());
    const box=new THREE.Box3();for(const q of layout)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
      box.expandByPoint(new THREE.Vector3(x*q.gene.dimX*.15,y*q.gene.dimY*.15,z*q.gene.dimZ*.15).applyQuaternion(q.rot).add(q.pos));
    const d=box.getSize(new THREE.Vector3());const length=Math.max(d.x,d.y,d.z);
    const org=sim.addOrganism(g,new THREE.Vector3(0,8,0));
    const start=org.com.clone(),previous=start.clone(),startReserve=org.reserves;
    let path=0,anchor=0;
    for(let n=0;n<seconds*60;n++){
      sim.stepOuterTick();
      path+=org.com.distanceTo(previous);previous.copy(org.com);
      for(const j of org.joints)anchor=Math.max(anchor,j.anchorError);
      if(!sim.organisms.includes(org))break;
    }
    return{shape,variant,length,net:org.com.distanceTo(start),z:org.com.z-start.z,
      x:org.com.x-start.x,y:org.com.y-start.y,path,
      speedBL:org.com.distanceTo(start)/length/seconds,
      reserve:org.reserves,spent:startReserve-org.reserves,anchor,alive:sim.organisms.includes(org)};
  }catch(e){return{shape,variant,error:String(e)};}
  finally{sim.dispose();}
}
test('diagnostic: morphology and gait speed matrix through living WorldSimulation',()=>{
  const matrix:Record<Shape,string[]>={
    planar_swimmer:['base','torque:800','freq:0.3','freq:0.45','freq:0.9','freq:1.1','phase:0.25','phase:0.33','phase:0.5','phase:0.66','phase:0.75','phase:1','phaseReverse:0.25','phaseReverse:0.5','paddleY:2','paddleY:3','paddleY:4','paddleX:2','middleY:2'],
    '3d_serpent':['base','torque:800','freq:0.3','freq:0.45','freq:0.9','freq:1.1','phase:0.25','phase:0.33','phase:0.5','phase:0.66','phaseReverse:0.5','paddleY:2','paddleY:3','serpent:YXY|0,.5,1','serpent:YXY|0,0,1','serpent:YXY|0,1,0','serpent:YYX|0,.5,1','serpent:YYX|0,.5,.5','serpent:XYY|0,.5,1','serpent:YYY|0,.5,1'],
    tri_limb:['base','torque:800','freq:0.3','freq:0.9','phase:0.5','phase:1','tri:YY|0,.5','tri:YY|0,1','tri:YY|.5,1','tri:YY|.5,1.5','tri:XY|0,.5','tri:YZ|0,.5','tri:ZZ|0,.5','tri:XX|0,.5','tri:YY|0,0','tail:YY|0,.5','tail:YY|0,1','tail:YZ|0,.5','tail:ZZ|0,.5']
  };
  const out=[] as ReturnType<typeof measure>[];
  for(const shape of ['planar_swimmer','3d_serpent','tri_limb'] as const)
    for(const variant of matrix[shape])out.push(measure(shape,variant));
  console.log('SWIM_GAIT_MATRIX_V022',JSON.stringify(out));
});
