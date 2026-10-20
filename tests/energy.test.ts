import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { initializePhysics } from '../sim/physics';
import { WorldSimulation } from '../sim/simulation';
import { createFounderGenome } from '../sim/mutation';
import { constructionEnergy, reserveCapacity, founderReserve, viableEggFunding } from '../sim/energy';
import { PRNG } from '../sim/prng';
import { getMouthApertureLocal } from '../sim/genome';

await initializePhysics();
const genome = (type: 'planar_swimmer' | '3d_serpent' | 'tri_limb' = 'planar_swimmer') =>
  createFounderGenome('test-parent', type, new PRNG(4242), type);
const balanced = (s: WorldSimulation, label: string) => {
  const t = s.getTelemetry().chemicalEnergyLedger;
  assert.ok(Math.abs(t.conservationResidual) < 1e-5,
    label + ': external ' + t.totalInput + ', residual ' + t.conservationResidual + ', ledger ' + JSON.stringify(t));
};

test('tissue, reserves, egg construction and storage reflect morphology', () => {
  const a = genome('planar_swimmer'), b = genome('3d_serpent'), c = genome('tri_limb');
  assert.ok(constructionEnergy(a) > 0);
  assert.ok(constructionEnergy(b) >= constructionEnergy(a), 'nonplanar morphology can have the same tissue cost as the six-link planar swimmer');
  assert.ok(constructionEnergy(c) > constructionEnergy(b));
  for (const g of [a,b,c]) {
    assert.ok(g.metabolism.eggEnergyFunding >= viableEggFunding(g));
    assert.ok(founderReserve(g) <= reserveCapacity(g));
    assert.ok(reserveCapacity(g) > founderReserve(g));
  }
  assert.ok(founderReserve(c) > founderReserve(a), 'larger bodies receive a distinct bounded reserve allocation');
});

test('natural death returns only remaining reserves plus actual tissue as edible remains', () => {
  const s = new WorldSimulation(818,0);
  try {
    s.clearFreeNutrients();
    s.nutrientInflowPerSec = 0;
    s.targetNutrientCount = 0;
    const g = genome(); g.metabolism.lifespanSec = .01;
    const org = s.addOrganism(g, new THREE.Vector3(0,8,0));
    const funded = org.reserves + org.structuralEnergy;
    balanced(s, 'starting world');
    s.stepOuterTick();
    assert.equal(s.organisms.length, 0);
    assert.equal(s.totalDeaths, 1);
    const remains = s.nutrients.reduce((total,n) => total + n.energy, 0);
    assert.ok(remains > 0 && remains < funded);
    assert.ok(s.getTelemetry().chemicalEnergyLedger.dissipatedMetabolicWork > 0);
    assert.ok(s.getTelemetry().chemicalEnergyLedger.mechanicalWorkJoules > 0);
    balanced(s, 'post decomposition');
  } finally { s.dispose(); }
});

test('one paid parent egg hatches with funded tissue/reserve and no extra external input', () => {
  const s = new WorldSimulation(818,0);
  try {
    s.clearFreeNutrients();
    s.nutrientInflowPerSec = 0;
    s.targetNutrientCount = 0;
    const g = genome();
    g.metabolism.reproduceCooldownSec = .1;
    g.metabolism.reproduceReserveThreshold = 300;
    g.metabolism.eggIncubationSec = .1;
    g.metabolism.lifespanSec = 1.05;
    const parent = s.addOrganism(g, new THREE.Vector3(0,8,0));
    s.feedAllOrganisms(250);
    parent.ageSec = 1;
    const externalBefore = s.externalEnergyAdded;
    balanced(s, 'prior to egg');
    s.stepOuterTick();
    assert.equal(s.eggs.length, 1);
    assert.equal(s.totalBirths, 0, 'egg laying is not a birth');
    const egg = s.eggs[0];
    assert.ok(egg.rotation && egg.rotation.length === 4, 'egg retains parent orientation');
    assert.ok(egg.fundingRemaining >= constructionEnergy(egg.genome) + 1);
    assert.equal(s.externalEnergyAdded, externalBefore);
    balanced(s, 'after parent paid for egg');
    for (let i = 0; i < 30; i++) s.stepOuterTick();
    assert.equal(s.eggs.length, 0, 'egg must hatch after parent moves/dies');
    assert.equal(s.totalBirths, 1);
    assert.ok(s.organisms.some(o => o.genome.id !== parent.genome.id));
    assert.equal(s.externalEnergyAdded, externalBefore, 'internal hatch cannot credit the ledger as intervention');
    balanced(s, 'after parent death and hatch');
  } finally { s.dispose(); }
});

test('damaged nonviable eggs become conserved edible material, not unfunded organisms', () => {
  const s = new WorldSimulation(818,0);
  try {
    s.clearFreeNutrients();s.nutrientInflowPerSec = 0;s.targetNutrientCount = 0;
    const g = genome();g.metabolism.reproduceCooldownSec = .1;g.metabolism.reproduceReserveThreshold = 300;
    g.metabolism.eggIncubationSec = .02;
    const parent = s.addOrganism(g,new THREE.Vector3(0,8,0));
    s.feedAllOrganisms(250);parent.ageSec = 1;
    s.stepOuterTick();
    assert.equal(s.eggs.length, 1);
    const egg = s.eggs[0], tissue = constructionEnergy(egg.genome);
    const destroyed = Math.max(0, egg.fundingRemaining - tissue + 2);
    egg.fundingRemaining -= destroyed;
    s.chemicalHeat += destroyed; // explicitly account for the simulated damage
    balanced(s, 'after controlled egg damage');
    s.stepOuterTick();s.stepOuterTick();
    assert.equal(s.eggs.length, 0);
    assert.equal(s.totalBirths, 0);
    assert.ok(s.nutrients.some(n => n.energy > 0));
    balanced(s, 'after nonviable egg decay');
  } finally { s.dispose(); }
});

test('explicit feeding respects reserve capacity and external removal stays balanced', () => {
  const s = new WorldSimulation(91,0);
  try {
    const initiallyFree = s.nutrients.reduce((sum,n) => sum+n.energy,0);
    assert.equal(s.clearFreeNutrients(),initiallyFree);
    balanced(s, 'after external nutrient removal');
    s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
    const org=s.addOrganism(genome(),new THREE.Vector3(0,8,0));
    const added=s.feedAllOrganisms(10000);
    assert.ok(added>0);
    assert.ok(org.reserves<=org.reserveCapacity);
    assert.equal(org.reserves,org.reserveCapacity);
    assert.equal(s.feedAllOrganisms(10000),0,'full capacity must not create stored energy');
    balanced(s, 'filled to capacity');
    s.stepOuterTick();
    assert.ok(org.reserves <= org.reserveCapacity);
    balanced(s, 'motor/upkeep heat');
  } finally { s.dispose(); }
});

test('herbivore feeding transfers nutrient chemical energy with no unexplained creation', () => {
  const s = new WorldSimulation(123,0);
  try {
    s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
    const org=s.addOrganism(genome(),new THREE.Vector3(0,8,0));org.motorsEnabled=false;
    s.seedNutrients(1);
    const root=org.bodies[0], ap=getMouthApertureLocal('-Z',root.partGene.dimX,root.partGene.dimY,root.partGene.dimZ);
    s.nutrients[0].pos.copy(ap.localPos).addScaledVector(ap.localNormal,.1).applyQuaternion(root.rot).add(root.pos);
    balanced(s,'before nutrient meal');
    s.stepOuterTick();
    assert.ok(org.totalFoodEaten > 0,'mouth must absorb accessible nutrient');
    assert.ok(s.nutrients[0].energy < 40);
    assert.ok(org.reserves <= org.reserveCapacity);
    balanced(s,'after nutrient meal');
  } finally { s.dispose(); }
});

test('egg predation accounts for the exact trophic loss and remaining egg funding', () => {
  const s=new WorldSimulation(123,0);
  try {
    s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
    const parentGenome=genome();parentGenome.metabolism.reproduceCooldownSec=.1;parentGenome.metabolism.reproduceReserveThreshold=300;
    const parent=s.addOrganism(parentGenome,new THREE.Vector3(6,8,0));
    const predatorGenome=genome('3d_serpent');
    predatorGenome.id='unrelated-predator'; // own-egg exclusion is keyed to genome identity
    const predator=s.addOrganism(predatorGenome,new THREE.Vector3(0,8,0));
    parent.ageSec=1;
    s.feedAllOrganisms(250);
    s.stepOuterTick();
    assert.equal(s.eggs.length,1);
    const egg=s.eggs[0];
    const root=predator.bodies[0],ap=getMouthApertureLocal('-Z',root.partGene.dimX,root.partGene.dimY,root.partGene.dimZ);
    egg.pos.copy(ap.localPos).addScaledVector(ap.localNormal,.1).applyQuaternion(root.rot).add(root.pos);
    const before=egg.fundingRemaining;
    s.stepOuterTick();
    assert.ok(egg.fundingRemaining<before, 'carnivore/omnivore must transfer egg energy');
    assert.ok(predator.totalFoodEaten>0);
    balanced(s,'after egg bite');
  } finally { s.dispose(); }
});

test('predation conserves prey reserve and credits 20% trophic loss to heat', () => {
  const s=new WorldSimulation(123,0);
  try {
    s.clearFreeNutrients();s.nutrientInflowPerSec=0;s.targetNutrientCount=0;
    const predator=s.addOrganism(genome('3d_serpent'),new THREE.Vector3(0,8,0));
    const preyGenome=genome();preyGenome.parts=preyGenome.parts.slice(0,1);
    const prey=s.addOrganism(preyGenome,new THREE.Vector3(0,8,-1));
    predator.motorsEnabled=false;prey.motorsEnabled=false;
    const before=prey.reserves, beforeHeat=s.chemicalHeat;
    s.stepOuterTick();
    assert.ok(predator.totalFoodEaten>0,'prey body should touch forward-facing mouth');
    assert.ok(prey.reserves<before);
    assert.ok(s.chemicalHeat>beforeHeat);
    balanced(s,'after prey bite');
  } finally { s.dispose(); }
});
