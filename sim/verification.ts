import * as THREE from 'three';
import { PRNG } from './prng';
import { createFounderGenome } from './mutation';
import { OrganismInstance } from './organism';
import { DEFAULT_WATER_RESISTANCE, PHYSICS_DT } from './physics';

export interface VerificationReport { testName: string; passed: boolean; measurement: string; details: string }
export type FounderType = 'planar_swimmer' | '3d_serpent' | 'tri_limb';

/** Production-path, isolated physical reference. No biology changes or replenishment. */
export function measureReference(type: FounderType, options: {seconds?: number; mu?: number; motors?: boolean; rotation?: THREE.Quaternion} = {}) {
  const seconds=options.seconds??30, mu=options.mu??DEFAULT_WATER_RESISTANCE;
  const org=new OrganismInstance(createFounderGenome('reference',type,new PRNG(4242),type),new THREE.Vector3(),options.rotation);
  org.motorsEnabled=options.motors??true;
  const start=org.com.clone(), previous=start.clone();
  const bounds=new THREE.Box3();
  const inverse=(options.rotation??new THREE.Quaternion()).clone().invert();
  for(const b of org.bodies) for(const x of [-1,1]) for(const y of [-1,1]) for(const z of [-1,1]) {
    bounds.expandByPoint(new THREE.Vector3(x*b.dimX/2,y*b.dimY/2,z*b.dimZ/2).applyQuaternion(b.rot).add(b.pos).applyQuaternion(inverse));
  }
  const dimensions=bounds.getSize(new THREE.Vector3()), bodyLength=Math.max(dimensions.x,dimensions.y,dimensions.z);
  let path=0, maxAnchor=0, maxAxis=0, maxLimitViolation=0, maxSpeed=0, contacts=0, maxNonplanarity=0;
  const perStroke: number[]=[]; let strokeStart=start.clone(), phase=org.joints[0].jointPhase;
  try {
    for(let i=0;i<Math.round(seconds/PHYSICS_DT);i++) {
      org.updatePhysicsSubstep(PHYSICS_DT,mu);
      path+=previous.distanceTo(org.com);previous.copy(org.com);
      if(org.bodies.length>=4) {
        const origin=org.bodies[0].pos;
        const a=org.bodies[1].pos.clone().sub(origin),b=org.bodies[2].pos.clone().sub(origin),c=org.bodies[3].pos.clone().sub(origin);
        const normal=a.cross(b);
        if(normal.length()>1e-6) maxNonplanarity=Math.max(maxNonplanarity,Math.abs(normal.dot(c))/normal.length());
      }
      for(const j of org.joints) {
        maxAnchor=Math.max(maxAnchor,j.anchorError);maxAxis=Math.max(maxAxis,j.axisError);
        maxLimitViolation=Math.max(maxLimitViolation,j.minAngle-j.currentAngle,j.currentAngle-j.maxAngle);
      }
      for(const b of org.bodies) {
        maxSpeed=Math.max(maxSpeed,b.linVel.length());
        org.physics.raw.contactPairsWith(b.collider,other=>{
          org.physics.raw.contactPair(b.collider,other,manifold=>{
            for(let k=0;k<manifold.numContacts();k++) if(manifold.contactDist(k)<0) contacts++;
          });
        });
      }
      if(org.joints[0].jointPhase<phase) {perStroke.push(org.com.distanceTo(strokeStart));strokeStart.copy(org.com);}
      phase=org.joints[0].jointPhase;
    }
    const momentum=new THREE.Vector3();for(const b of org.bodies)momentum.addScaledVector(b.linVel,b.mass);
    return {type,seconds,mu,bodyLength,netMeters:org.com.distanceTo(start),pathMeters:path,
      displacement:org.com.clone().sub(start).toArray(),bodyLengths:org.com.distanceTo(start)/bodyLength,
      maxAnchorErrorMeters:maxAnchor,maxAxisErrorRadians:maxAxis,maxLimitViolationRadians:maxLimitViolation,
      maxSpeedMetersPerSec:maxSpeed,contactSamples:contacts,maxNonplanarityMeters:maxNonplanarity,strokeDisplacementsMeters:perStroke,
      workJoules:org.totalWorkJoules,reserves:org.reserves,momentum:momentum.toArray(),
      finite:[...org.com.toArray(),...org.comVel.toArray(),path,maxAnchor,maxAxis].every(Number.isFinite)};
  } finally {org.dispose();}
}

/** Short isolated checks; deliberately makes no claims about feeding or ecological sustainability. */
export function runLocomotionAndPhysicsVerification(): VerificationReport[] {
  const stationary=measureReference('planar_swimmer',{seconds:1,motors:false});
  const vacuum=measureReference('planar_swimmer',{mu:0});
  const planar=measureReference('planar_swimmer');
  const nonplanar=measureReference('3d_serpent');
  const stable=(r:ReturnType<typeof measureReference>)=>r.finite&&r.maxAnchorErrorMeters<.005&&r.maxAxisErrorRadians<.01&&r.maxLimitViolationRadians<.02&&r.contactSamples===0;
  return [
    {testName:'Motors-off rest',passed:stationary.netMeters<1e-5&&stationary.workJoules===0,
      measurement:`${stationary.netMeters.toExponential(3)} m net; ${stationary.workJoules} J motor work`,details:'One second in still water, no contacts or external forces.'},
    {testName:'Zero-drag linear momentum',passed:vacuum.finite&&vacuum.netMeters<.001&&new THREE.Vector3(...vacuum.momentum as [number,number,number]).length()<.01,
      measurement:`${vacuum.netMeters.toExponential(3)} m COM drift over 30s`,details:'Same articulated production solver; no water resistance, walls or other organisms.'},
    {testName:'Planar reference swimming',passed:stable(planar)&&planar.bodyLengths>=1&&planar.reserves>0,
      measurement:`${planar.netMeters.toFixed(3)} m / ${planar.bodyLengths.toFixed(2)} body lengths in 30s`,details:'Neutral recurrent outputs, inherited gait, real analytical water resistance; no refills or pose animation.'},
    {testName:'Nonplanar reference swimming',passed:stable(nonplanar)&&nonplanar.netMeters>.5&&nonplanar.maxNonplanarityMeters>.01&&nonplanar.reserves>0,
      measurement:`${nonplanar.netMeters.toFixed(3)} m; axis error ${(nonplanar.maxAxisErrorRadians*180/Math.PI).toFixed(4)}°`,details:'Four dynamic cuboids with Y/X/Y hinges and out-of-plane articulation. This test does not require one whole body length.'},
    {testName:'Physical hinge anchors, axes and limits',passed:stable(planar)&&stable(nonplanar),
      measurement:`Max gap ${(Math.max(planar.maxAnchorErrorMeters,nonplanar.maxAnchorErrorMeters)*1000).toFixed(3)} mm`,details:'Checks post-step geometry of planar and nonplanar bodies, angular limits, finiteness and absence of reference contacts.'},
  ];
}
