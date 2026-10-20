import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {initializePhysics,PhysicsWorld,RigidCuboid,PHYSICS_DT,cuboidResistance} from '../sim/physics';
import {OrganismInstance,bodyLayout} from '../sim/organism';
import {createFounderGenome} from '../sim/mutation';
import {PRNG} from '../sim/prng';
import {measureReference} from '../sim/verification';
import {WorldSimulation} from '../sim/simulation';
import {SimulationClock} from '../sim/clock';
await initializePhysics();
const gene=(type:'planar_swimmer'|'3d_serpent'|'tri_limb'='planar_swimmer')=>createFounderGenome('test',type,new PRNG(4242),type);
const close=(a:number,b:number,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b} (tolerance ${tolerance})`);

test('analytical cuboid resistance retains normal-only formula and dissipates power',()=>{
  const v=new THREE.Vector3(1,2,3),w=new THREE.Vector3(.4,.5,.6),r=cuboidResistance(1,2,3,v,w,3.5);
  assert.deepEqual(r.force.toArray(),[-42,-42,-42]);
  close(r.torque.x,-3.5*.4*(8+27)/6);close(r.torque.y,-3.5*.5*2*(1+27)/6);close(r.torque.z,-3.5*.6*3*(1+8)/6);
  assert.ok(r.force.dot(v)+r.torque.dot(w)<0);
  assert.equal(cuboidResistance(1,2,3,v,w,0).force.length(),0);
});

test('Rapier derives cuboid mass and inertia from physical dimensions and density',()=>{
  const world=new PhysicsWorld();try {
    const b=new RigidCuboid(world,gene().parts[0]);
    close(b.mass,b.dimX*b.dimY*b.dimZ*1000,1e-4);
    close(b.inertiaLocal.x,b.mass*(b.dimY**2+b.dimZ**2)/12,1e-4);
    close(b.inertiaLocal.z,b.mass*(b.dimX**2+b.dimY**2)/12,1e-4);
  }finally{world.dispose();}
});

test('face frames support different parent/child faces and a rotated initial assembly',()=>{
  const g=gene();g.parts=g.parts.slice(0,2);g.parts[1].parentFace='+X';g.parts[1].attachFace='+Z';g.parts[1].hingeAxis='Z';
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.7,-.3));
  const o=new OrganismInstance(g,new THREE.Vector3(2,3,4),q);
  try {for(let n=0;n<120;n++)o.updatePhysicsSubstep();for(const j of o.joints){assert.ok(j.anchorError<.005);assert.ok(j.axisError<.01);}}
  finally{o.dispose();}
});

test('malformed or penetrating rest anatomy is rejected before solver construction',()=>{
  const g=gene();g.parts[0].dimX=1.5;assert.throws(()=>bodyLayout(g,new THREE.Vector3(),new THREE.Quaternion()),/Invalid physical part/);
  const cycle=gene();cycle.parts[1].parentId='part-2';assert.throws(()=>bodyLayout(cycle,new THREE.Vector3(),new THREE.Quaternion()),/cyclic/);
  const bad=gene();bad.parts[1].parentFace='+Z';bad.parts[1].attachFace='+Z';bad.parts[2].parentFace='+Z';
  // This face reversal folds the third part back through the root and must be rejected.
  assert.throws(()=>bodyLayout(bad,new THREE.Vector3(),new THREE.Quaternion()),/Overlapping rest anatomy/);
});

test('reference swims a body length with stable physical hinges, no contacts and no energy refill',()=>{
  const r=measureReference('planar_swimmer');
  assert.ok(r.finite);assert.ok(r.bodyLengths>=1,JSON.stringify(r));assert.ok(r.pathMeters>=r.netMeters);
  assert.ok(r.maxAnchorErrorMeters<.005);assert.ok(r.maxAxisErrorRadians<.01);assert.ok(r.maxLimitViolationRadians<.02);
  assert.equal(r.contactSamples,0);assert.ok(r.reserves>0&&r.reserves<250);assert.ok(r.strokeDisplacementsMeters.length>=19);
  console.log('Planar reference:',JSON.stringify(r));
});

test('nonplanar hinges stay aligned and propel a four-link body',()=>{
  const r=measureReference('3d_serpent');assert.ok(r.netMeters>.5,JSON.stringify(r));assert.ok(r.maxNonplanarityMeters>.01);assert.ok(r.maxAxisErrorRadians<.01);
  assert.ok(r.maxAnchorErrorMeters<.005);assert.ok(r.maxLimitViolationRadians<.02);assert.equal(r.contactSamples,0);assert.ok(r.reserves>0);
  console.log('Nonplanar reference:',JSON.stringify(r));
});

test('motors-off stays at rest, and zero drag conserves linear momentum',()=>{
  const off=measureReference('planar_swimmer',{seconds:1,motors:false});assert.ok(off.netMeters<1e-5);assert.equal(off.workJoules,0);
  const zero=measureReference('planar_swimmer',{mu:0});assert.ok(zero.netMeters<.001,JSON.stringify(zero));
  assert.ok(new THREE.Vector3(...zero.momentum as [number,number,number]).length()<.01);
});

test('rotating a reference setup rotates its swimming displacement',()=>{
  const normal=measureReference('planar_swimmer',{seconds:3});
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.4,.8,.3));
  const rotated=measureReference('planar_swimmer',{seconds:3,rotation:q});
  const expected=new THREE.Vector3(...normal.displacement as [number,number,number]).applyQuaternion(q);
  assert.ok(expected.distanceTo(new THREE.Vector3(...rotated.displacement as [number,number,number]))<.001);
});

test('zero motor allowance clears active torque while passive constraints remain',()=>{
  const o=new OrganismInstance(gene(),new THREE.Vector3());try{
    for(let i=0;i<30;i++)o.updatePhysicsSubstep();
    for(let i=2;i<o.brain.outputs.length;i+=4)o.brain.outputs[i]=-1;
    const before=o.totalWorkJoules;
    for(let i=0;i<10;i++)o.updatePhysicsSubstep();
    assert.equal(o.totalWorkJoules,before);assert.ok(o.joints.every(j=>j.appliedTorque===0&&j.anchorError<.005));
  }finally{o.dispose();}
});

test('phase wraps continuously and frequency modulation changes its derivative only',()=>{
  const o=new OrganismInstance(gene(),new THREE.Vector3());try{
    const j=o.joints[0];j.jointPhase=2*Math.PI-.001;o.brain.outputs[1]=1;
    const expected=(j.jointPhase+2*Math.PI*j.child.partGene.motorFrequency*1.5*PHYSICS_DT)%(2*Math.PI);
    o.updatePhysicsSubstep();close(j.jointPhase,expected,1e-12);
    o.brain.outputs[1]=-1;const before=j.jointPhase;o.updatePhysicsSubstep();
    close(j.jointPhase-before,2*Math.PI*j.child.partGene.motorFrequency*.5*PHYSICS_DT,1e-12);
  }finally{o.dispose();}
});

test('solid body contacts prevent pass-through and tank walls constrain body extents',()=>{
  const world=new PhysicsWorld(new THREE.Vector3(26,16,26));try{
    const p=gene().parts[0],a=new RigidCuboid(world,p,new THREE.Vector3(-.6,8,0)),b=new RigidCuboid(world,p,new THREE.Vector3(.6,8,0));
    a.setVelocities(new THREE.Vector3(1,0,0));b.setVelocities(new THREE.Vector3(-1,0,0));
    for(let i=0;i<120;i++)world.step();assert.ok(a.pos.x<b.pos.x);assert.ok(b.pos.x-a.pos.x>=.29);
    close(a.linVel.x*a.mass+b.linVel.x*b.mass,0,.001);
    const wall=new RigidCuboid(world,p,new THREE.Vector3(12,8,3));wall.setVelocities(new THREE.Vector3(3,0,0));
    for(let i=0;i<120;i++)world.step();assert.ok(wall.pos.x+wall.dimX/2<=13.005);
  }finally{world.dispose();}
});

test('ecosystem advances one shared world twice per tick and frees old worlds on reset',()=>{
  const s=new WorldSimulation(4242,0);try{
    s.nutrients=[];s.nutrientInflowPerSec=0;
    const a=s.addOrganism(gene(),new THREE.Vector3(-4,8,0)),b=s.addOrganism(gene('3d_serpent'),new THREE.Vector3(4,8,0));
    assert.equal(a.physics,b.physics);assert.equal(a.physics,s.physics);
    const count=s.physics.raw.bodies.len();s.stepOuterTick();assert.equal(s.physics.steps,2);assert.equal(s.physics.raw.bodies.len(),count);
    assert.throws(()=>a.updatePhysicsSubstep(),/Shared organisms/);
    const old=s.physics;s.reset(0);assert.equal(old.disposed,true);assert.equal(s.physics.raw.bodies.len(),0);
    assert.throws(()=>s.stepOuterTick(1/30),/fixed/);
  }finally{s.dispose();}
});


test('torque-free asymmetric spin conserves angular momentum within the integrator tolerance',()=>{
  const world=new PhysicsWorld();try{
    const b=new RigidCuboid(world,gene().parts[0]);b.setVelocities(new THREE.Vector3(),new THREE.Vector3(1,2,3));
    const momentum=()=>b.angVel.clone().applyMatrix3(b.getInertiaTensorWorldInv(new THREE.Matrix3()).invert());
    const initial=momentum();let error=0;
    for(let i=0;i<120;i++){world.step();error=Math.max(error,momentum().distanceTo(initial)/initial.length());}
    assert.ok(error<.005,`Angular momentum error ${error}`);
  }finally{world.dispose();}
});

test('all six attachment faces share coincident anchors without overwriting genotype',()=>{
  const faces=['+X','-X','+Y','-Y','+Z','-Z'] as const;
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(.2,.3,.4));
  for(const parentFace of faces)for(const attachFace of faces){
    const g=gene();g.parts=g.parts.slice(0,2);for(const p of g.parts){p.dimX=1;p.dimY=1;p.dimZ=1;}g.parts[1].parentFace=parentFace;g.parts[1].attachFace=attachFace;
    const before=JSON.stringify(g);const poses=bodyLayout(g,new THREE.Vector3(1,2,3),q);
    const parent=poses[0],child=poses[1];
    const axis=(face:typeof parentFace,p:typeof g.parts[0])=>new THREE.Vector3(face.endsWith('X')?p.dimX:0,face.endsWith('Y')?p.dimY:0,face.endsWith('Z')?p.dimZ:0).multiplyScalar((face.startsWith('-')?-1:1)*.15);
    const a=axis(parentFace,parent.gene).applyQuaternion(parent.rot).add(parent.pos),b=axis(attachFace,child.gene).applyQuaternion(child.rot).add(child.pos);
    assert.ok(a.distanceTo(b)<1e-12);assert.equal(JSON.stringify(g),before);
  }
});

test('default founders use the production recurrent controller and removal leaves no ghost colliders',()=>{
  const s=new WorldSimulation(4242,14);try{
    s.nutrients=[];s.nutrientInflowPerSec=0;
    for(let i=0;i<12;i++)s.stepOuterTick();
    assert.equal(s.organisms.length,14);
    for(const o of s.organisms){assert.ok(o.reserves>0);assert.ok(o.com.toArray().every(Number.isFinite));assert.ok(o.joints.every(j=>j.axisError<.01));}
    const victim=s.organisms[0],parts=victim.bodies.length,before=s.physics.raw.bodies.len();victim.reserves=0;
    s.stepOuterTick();assert.equal(s.organisms.length,13);assert.equal(s.physics.raw.bodies.len(),before-parts);
  }finally{s.dispose();}
});


test('production physics and neural state are equivalent across rendering rates and normal speeds',()=>{
  const run=(fps:number,speed:number)=>{
    const s=new WorldSimulation(4242,0),clock=new SimulationClock();
    try {
      s.nutrients=[];s.nutrientInflowPerSec=0;
      const o=s.addOrganism(gene(),new THREE.Vector3(0,8,0));
      // One simulated second at each requested speed; sufficient computation is available.
      for(let frame=0;frame<fps;frame++)clock.advance(1/(fps*speed),true,speed,dt=>s.stepOuterTick(dt),()=>0);
      return {steps:s.physics.steps,time:s.simTime,reserves:o.reserves,
        bodies:o.bodies.map(b=>[...b.pos.toArray(),...b.rot.toArray(),...b.linVel.toArray(),...b.angVel.toArray()]),
        phase:o.joints.map(j=>j.jointPhase),outputs:Array.from(o.brain.outputs)};
    } finally {s.dispose();}
  };
  const expected=run(60,1);assert.equal(expected.steps,120);
  for(const fps of [30,60,144])for(const speed of [1,2,5])assert.deepEqual(run(fps,speed),expected);
});
