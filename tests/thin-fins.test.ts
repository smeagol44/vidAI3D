import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics, PhysicsWorld, RigidCuboid, PHYSICS_DT, cuboidResistance, faceAnchor } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { bodyLayout, OrganismInstance } from '../sim/organism';
import { partPhysicalSize, validateGenome, getMouthApertureLocal } from '../sim/genome';
import { createFounderGenome, mutateGenome } from '../sim/mutation';
import { constructionEnergy } from '../sim/energy';
import { PRNG } from '../sim/prng';
await initializePhysics();

function finGenome() {
  const g = createFounderGenome('fin-test','tri_limb',new PRNG(4242),'tri_limb');
  const left=g.parts[1],right=g.parts[2];
  for(const p of [left,right]){
    p.dimX=1;p.dimY=1;p.dimZ=2;p.hingeAxis='Y';p.motorMaxTorque=800;
  }
  left.motorPhase=0;right.motorPhase=Math.PI;
  const leftFin={...left,id:'part-3',parentId:left.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    hingeAxis:'Z' as const,motorPhase:Math.PI*.5,thicknessScaleY:.2,hasMouth:false,hasEye:false};
  const rightFin={...rightFinDefinition(right),id:'part-4',motorPhase:Math.PI*1.5};
  g.parts=[g.parts[0],left,leftFin,right,rightFin];
  return g;
}
function rightFinDefinition(p:ReturnType<typeof finGenome>['parts'][number]) {
  return {...p,parentId:p.id,parentFace:'+Z' as const,attachFace:'-Z' as const,
    hingeAxis:'Z' as const,thicknessScaleY:.2,hasMouth:false,hasEye:false};
}

test('a 0.2-scale physical fin uses 0.06m collision, drag, volume and anchor dimensions',()=>{
  const g=finGenome(), fin=g.parts[2]; // intentionally check actual left fin (index 2)
  assert.ok(validateGenome(g));
  assert.deepEqual(partPhysicalSize(fin),[.3,.06,.6]);
  const original=JSON.stringify(g);
  const place=bodyLayout(g,new THREE.Vector3(0,8,0),new THREE.Quaternion());
  assert.equal(JSON.stringify(g),original);
  const parent=place.find(p=>p.gene.id===fin.parentId)!;
  const tip=place.find(p=>p.gene.id===fin.id)!;
  const a=faceAnchor(fin.parentFace!,parent.gene).applyQuaternion(parent.rot).add(parent.pos);
  const b=faceAnchor(fin.attachFace!,tip.gene).applyQuaternion(tip.rot).add(tip.pos);
  assert.ok(a.distanceTo(b)<1e-9);
  const normal=g.parts.map(p=>({...p,thicknessScaleY:undefined}));
  const full={...g,parts:normal};
  assert.ok(constructionEnergy(g)<constructionEnergy(full));
  const world=new PhysicsWorld();
  try{
    const r=new RigidCuboid(world,fin);
    assert.ok(Math.abs(r.dimY-.06)<1e-9);
    assert.ok(Math.abs(r.mass-1000*.3*.06*.6)<1e-4);
    assert.ok(Math.abs(r.dimX*r.dimY*r.dimZ*1000-r.mass)<1e-4);
    const vel=new THREE.Vector3(0,2,0),omega=new THREE.Vector3(.5,0,0);
    const normalDrag=cuboidResistance(.3,.3,.6,vel,omega,250);
    const thinDrag=cuboidResistance(r.dimX,r.dimY,r.dimZ,vel,omega,250);
    assert.ok(Math.abs(normalDrag.force.y-thinDrag.force.y)<1e-9, 'same broad face projected drag');
    assert.ok(Math.abs(thinDrag.torque.x)<Math.abs(normalDrag.torque.x));
  }finally{world.dispose();}
  const ap=getMouthApertureLocal('+Y',fin.dimX,fin.dimY,fin.dimZ,fin.thicknessScaleY);
  assert.ok(Math.abs(ap.localPos.y-(.03+.02))<1e-9);
});

test('invalid, nonfinite and undersized fins are rejected before Rapier construction',()=>{
 const g=finGenome(), index=2;
 for(const scale of [0, -.1, .1, 1.001, NaN, Infinity]){
   const clone=JSON.parse(JSON.stringify(g));
   clone.parts[index].thicknessScaleY=scale;
   assert.equal(validateGenome(clone),false);
   assert.throws(()=>bodyLayout(clone,new THREE.Vector3(),new THREE.Quaternion()),/Invalid physical part/);
 }
});

test('two independent physical hinge axes and real motor work drive a thin plate',()=>{
 const g=finGenome();
 const o=new OrganismInstance(g,new THREE.Vector3(0,8,0));
 try{
   assert.equal(o.joints.length,4);
   assert.equal(o.brain.outputs.length,16);
   assert.equal(o.joints[0].child.partGene.hingeAxis,'Y');
   assert.equal(o.joints[1].child.partGene.hingeAxis,'Z');
   const before=o.com.clone();
   for(let i=0;i<240;i++)o.updatePhysicsSubstep(PHYSICS_DT,250);
   assert.ok(o.bodies.every(p=>Number.isFinite(p.mass)&&p.mass>0));
   assert.ok(o.joints.every(j=>j.anchorError<.005&&j.axisError<.01));
   assert.ok(o.totalWorkJoules>0);
   assert.ok(o.com.distanceTo(before)>0);
   assert.ok(o.reserves>0);
 }finally{o.dispose();}
});

test('offspring fin thickness remains a valid evolvable feature',()=>{
 const g=finGenome();
 const original=JSON.stringify(g);
 let changed=0;
 for(let seed=1;seed<=24;seed++){
   const child=mutateGenome(g,new PRNG(seed), 'mut-'+seed);
   if(child===g)continue;
   const p=child.parts.find(p=>p.id==='part-3');
   if(p && p.thicknessScaleY!==g.parts[2].thicknessScaleY)changed++;
 }
 assert.equal(JSON.stringify(g),original);
 assert.ok(changed>0);
});

test('measured isolated full-ecosystem articulated fin candidates',()=>{
 const variants=[.2,.5,1].flatMap(scale=>[0,.5,1].map(phase=>({scale,phase})));
 const records=[];
 for(const {scale,phase} of variants){
   const s=new WorldSimulation(4242,0);
   try{
     s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
     const g=finGenome();
     for(const p of g.parts.filter(p=>p.id==='part-3'||p.id==='part-4'))p.thicknessScaleY=scale;
     g.parts[4].motorPhase=Math.PI*phase;
     const o=s.addOrganism(g,new THREE.Vector3(0,8,0));
     const start=o.com.clone(),energy=o.reserves;
     for(let t=0;t<420;t++)s.stepOuterTick();
     const residual=s.getTelemetry().chemicalEnergyLedger.conservationResidual;
     records.push({scale,phase,net:o.com.distanceTo(start),forward:o.com.z-start.z,side:o.com.x-start.x,
       energySpent:energy-o.reserves,alive:s.organisms.includes(o),
       gap:Math.max(...o.joints.map(j=>j.anchorError)),residual});
   }finally{s.dispose();}
 }
 console.log('THIN_FEATHER_FIN_EVIDENCE',JSON.stringify(records));
 assert.ok(records.every(x=>x.alive&&Number.isFinite(x.net)&&x.gap<.005&&Math.abs(x.residual)<1e-5));
});
