import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome } from '../sim/mutation';
import { constructionEnergy, founderReserve, viableEggFunding, reserveCapacity } from '../sim/energy';
import { PRNG } from '../sim/prng';

await initializePhysics();

test('founder reserves are finite, externally accounted, and newborns pay tissue plus reserve', () => {
  const s = new WorldSimulation(9,0);
  try {
    s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;
    const g=createFounderGenome('funded','Funded',new PRNG(11),'planar_swimmer');
    assert.equal(founderReserve(g),Math.min(reserveCapacity(g),4*constructionEnergy(g)));
    assert.equal(viableEggFunding(g),2*constructionEnergy(g));
    const org=s.addOrganism(g,new THREE.Vector3(0,8,0));
    assert.equal(org.reserves,founderReserve(g));
    assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
    org.motorsEnabled=false;
    for(let i=0;i<30;i++)s.stepOuterTick();
    assert.ok(Math.abs(org.totalBasalChemicalSpent-0.5*(g.metabolism.baseUpkeepPerSec+constructionEnergy(g)*.001))<.02);
    assert.equal(org.totalMotorChemicalSpent,0);
    assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
  }finally{s.dispose();}
});

test('starvation and aging are distinct recorded deaths with conserved remains', () => {
  const s = new WorldSimulation(91,0);
  try {
    s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;
    const aged=createFounderGenome('aged','Aged',new PRNG(1),'planar_swimmer');
    aged.metabolism.lifespanSec=.01;
    const old=s.addOrganism(aged,new THREE.Vector3(5,8,0));
    old.motorsEnabled=false;
    const hungry=createFounderGenome('hungry','Hungry',new PRNG(2),'planar_swimmer');
    const starved=s.addOrganism(hungry,new THREE.Vector3(-5,8,0));
    const taken=starved.reserves-.001;starved.reserves-=taken;s.chemicalHeat+=taken;
    starved.motorsEnabled=false;
    s.stepOuterTick();
    assert.equal(s.totalDeaths,2);
    assert.equal(s.deathsByCause.old_age,1);
    assert.equal(s.deathsByCause.starvation,1);
    assert.equal(s.deathsByCause.predation,0);
    assert.ok(s.recentDeaths.some(r=>r.cause==='starvation'&&r.id==='hungry'));
    assert.ok(s.recentDeaths.some(r=>r.cause==='old_age'&&r.id==='aged'));
    assert.equal(s.getTelemetry().deathsByCause.starvation,1);
    assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
  }finally{s.dispose();}
});

test('predator kills prey in the same tick even when prey was visited earlier', () => {
  const s = new WorldSimulation(123,0);
  try {
    s.clearFreeNutrients();s.targetNutrientCount=0;s.nutrientInflowPerSec=0;
    const hunter=createFounderGenome('hunter','Hunter',new PRNG(1),'3d_serpent');
    const pred=s.addOrganism(hunter,new THREE.Vector3(0,8,0));
    const g=createFounderGenome('victim','Victim',new PRNG(2),'planar_swimmer');
    g.parts=g.parts.slice(0,1);
    const prey=s.addOrganism(g,new THREE.Vector3(0,8,-1));
    pred.motorsEnabled=false;prey.motorsEnabled=false;
    const delta=prey.reserves-.01;prey.reserves-=delta;s.chemicalHeat+=delta;
    s.stepOuterTick();
    assert.equal(s.deathsByCause.predation,1);
    assert.ok(!s.organisms.includes(prey),'prey must be decomposed in the same tick');
    assert.ok(s.recentDeaths[0].lifetimePredationLost>0);
    assert.ok(Math.abs(s.getTelemetry().chemicalEnergyLedger.conservationResidual)<1e-5);
  }finally{s.dispose();}
});
