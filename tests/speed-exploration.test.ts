import {test} from 'node:test';
import * as THREE from 'three';
import { initializePhysics } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome } from '../sim/mutation';
import { bodyLayout } from '../sim/organism';
import { PRNG } from '../sim/prng';

await initializePhysics();
type Shape = 'planar_swimmer' | '3d_serpent' | 'tri_limb';

function measure(shape:Shape, variant:string, seconds=10) {
  const sim=new WorldSimulation(101,0);
  try {
    sim.clearFreeNutrients(); sim.targetNutrientCount=0; sim.nutrientInflowPerSec=0;
    const g=createFounderGenome('probe',shape,new PRNG(4242),shape);
    const joints=g.parts.filter(p=>p.parentId!==null);
    if (variant.includes('fast15')) for(const p of joints)p.motorFrequency*=1.5;
    if (variant.includes('fast20')) for(const p of joints)p.motorFrequency*=2;
    if (variant.includes('fast30')) for(const p of joints)p.motorFrequency*=3;
    if (variant.includes('torque15')) for(const p of joints)p.motorMaxTorque*=1.5;
    if (variant.includes('torque20')) for(const p of joints)p.motorMaxTorque*=2;
    if (variant.includes('mu500')) sim.waterDragCoeff=500;
    if (variant.includes('mu100')) sim.waterDragCoeff=100;
    if (variant.includes('tail') && shape==='tri_limb'){
      g.parts.push({...g.parts[1],id:'part-3',parentId:'part-0',parentFace:'+Z',attachFace:'-Z',
       dimX:1,dimY:1,dimZ:3,hingeAxis:'Y',motorPhase:Math.PI,hasMouth:false,hasEye:false});
    }
    const layout=bodyLayout(g,new THREE.Vector3(0,8,0),new THREE.Quaternion());
    const box=new THREE.Box3();
    for(const p of layout)for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      box.expandByPoint(new THREE.Vector3(x*p.gene.dimX*.15,y*p.gene.dimY*.15,z*p.gene.dimZ*.15).applyQuaternion(p.rot).add(p.pos));
    }
    const size=box.getSize(new THREE.Vector3()),length=Math.max(size.x,size.y,size.z);
    const o=sim.addOrganism(g,new THREE.Vector3(0,8,0));
    const start=o.com.clone(),prev=start.clone();
    let path=0,maxJointGap=0,maxAxisError=0, maxSpeed=0;
    for(let i=0;i<seconds*60;i++){
      sim.stepOuterTick();
      path+=o.com.distanceTo(prev);prev.copy(o.com);
      for(const j of o.joints){maxJointGap=Math.max(maxJointGap,j.anchorError);maxAxisError=Math.max(maxAxisError,j.axisError);}
      maxSpeed=Math.max(maxSpeed,...o.bodies.map(b=>b.linVel.length()));
      if(!sim.organisms.includes(o))break;
    }
    return {shape,variant,length,seconds,net:o.com.distanceTo(start),signedZ:o.com.z-start.z,
      path,bodyLengthsPerSec:o.com.distanceTo(start)/length/seconds,
      energySpent:(o.reserveCapacity?undefined:0),startReserve:undefined,
      reserve:o.reserves, motorWork:o.totalWorkJoules,
      maxJointGap,maxAxisError,maxPartSpeed:maxSpeed,alive:sim.organisms.includes(o)};
  }catch(error){return {shape,variant,error:String(error)};}
  finally{sim.dispose();}
}

test('diagnostic: real recurrent speed calibration sweeps (no assertions on intended outcomes)',()=>{
  const candidates=['base','fast15','fast20','fast20_torque20','fast30_torque20','torque20','mu500_torque20','mu100_torque15','tail','tail_fast20_torque20'];
  const results=[] as ReturnType<typeof measure>[];
  for(const shape of ['planar_swimmer','3d_serpent','tri_limb'] as const)
    for(const variant of candidates){
      if(variant.includes('tail')&&shape!=='tri_limb')continue;
      if(!variant.includes('tail')&&shape==='tri_limb'&&variant==='fast30_torque20')continue;
      results.push(measure(shape,variant,10));
    }
  console.log('SPEED_CALIBRATION_V022',JSON.stringify(results));
});
