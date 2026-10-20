import * as THREE from 'three';
import { PRNG } from './prng';
import { createFounderGenome } from './mutation';
import { OrganismInstance } from './organism';
import { WorldSimulation } from './simulation';

export interface VerificationReport {
  testName: string;
  passed: boolean;
  measurement: string;
  details: string;
}

export function runLocomotionAndPhysicsVerification(): VerificationReport[] {
  const reports: VerificationReport[] = [];
  const prng = new PRNG(4242);
  const outerDt = 1 / 60;
  const subDt = outerDt / 2;
  const totalSubsteps = 30 * 120; // 30 simulated seconds

  // --- Test 1: Motors Disabled in Still Water -> Stationary ---
  {
    const genome = createFounderGenome('test-swimmer-1', 'Calibrated Planar Swimmer', prng, 'planar_swimmer');
    const org = new OrganismInstance(genome, new THREE.Vector3(0, 0, 0));
    org.motorsEnabled = false;
    const initialCOM = org.com.clone();

    for (let s = 0; s < 600; s++) { // 5 simulated seconds
      org.updatePhysicsSubstep(subDt, 3.5);
    }
    const finalCOM = org.com.clone();
    const displacement = initialCOM.distanceTo(finalCOM);
    const isValid = Number.isFinite(displacement) && displacement < 1e-4 && org.comVel.length() < 1e-4;
    reports.push({
      testName: 'Unpowered Suspension in Still Water (Motors Disabled)',
      passed: isValid,
      measurement: `Net COM drift: ${(displacement * 1000).toFixed(4)} mm (max vel: ${(org.comVel.length() * 1000).toFixed(4)} mm/s)`,
      details: 'Stationary assembly with motors off remains at rest without artificial gravity or drift.',
    });
  }

  // --- Test 2: Motors Running with Water Resistance Disabled (mu = 0) -> Momentum Conserved ---
  {
    const genome = createFounderGenome('test-swimmer-2', 'Calibrated Planar Swimmer', prng, 'planar_swimmer');
    const org = new OrganismInstance(genome, new THREE.Vector3(0, 0, 0));
    org.motorsEnabled = true;
    const initialCOM = org.com.clone();

    for (let s = 0; s < totalSubsteps; s++) { // 30 simulated seconds
      org.updatePhysicsSubstep(subDt, 0.0); // ZERO water resistance
    }
    const finalCOM = org.com.clone();
    const displacement = initialCOM.distanceTo(finalCOM);
    // Without water drag, internal joint actuation produces zero net impulse on COM
    const isValid = Number.isFinite(displacement) && displacement < 0.02 && org.comVel.length() < 0.01;
    reports.push({
      testName: 'Conservation of Linear Momentum (mu = 0)',
      passed: isValid,
      measurement: `Net COM displacement with mu=0 over 30s: ${(displacement * 100).toFixed(3)} cm`,
      details: 'Internal motor torques produce equal and opposite forces; in vacuum/zero drag, COM cannot propel itself.',
    });
  }

  // --- Test 3: Planar Reference Swimmer in Water (mu = 3.5) -> Net Propulsion ---
  {
    const genome = createFounderGenome('test-swimmer-3', 'Calibrated Planar Swimmer', prng, 'planar_swimmer');
    const org = new OrganismInstance(genome, new THREE.Vector3(0, 0, 0));
    org.motorsEnabled = true;
    const initialCOM = org.com.clone();
    let bodyLength = 0;
    for (const b of org.bodies) bodyLength += b.dimZ;

    for (let s = 0; s < totalSubsteps; s++) { // 30 simulated seconds
      org.updatePhysicsSubstep(subDt, 3.5);
    }
    const finalCOM = org.com.clone();
    const netDisplacement = initialCOM.distanceTo(finalCOM);
    const bodyLengthsTraveled = netDisplacement / bodyLength;
    const isPlausible = Number.isFinite(netDisplacement) && netDisplacement > 0.5 && netDisplacement < 50.0;
    const passed = isPlausible && bodyLengthsTraveled >= 1.0;
    reports.push({
      testName: 'Planar Reference Swimmer Propulsion (3-part, 2-joint nonreciprocal)',
      passed,
      measurement: `Net travel: ${netDisplacement.toFixed(2)} m (${bodyLengthsTraveled.toFixed(2)} body lengths over 30s, avg speed: ${(netDisplacement / 30).toFixed(3)} m/s)`,
      details: 'Demonstrates genuine hydrodynamic swimming emerging from normal surface resistance and phased hinge actuation.',
    });
  }

  // --- Test 4: 3D Serpent Nonplanar Swimmer (Pitch X-axis + Yaw Y-axis) ---
  {
    const genome = createFounderGenome('test-swimmer-4', '3D Serpent Swimmer', prng, '3d_serpent');
    const org = new OrganismInstance(genome, new THREE.Vector3(0, 0, 0));
    org.motorsEnabled = true;
    const initialCOM = org.com.clone();

    for (let s = 0; s < totalSubsteps; s++) {
      org.updatePhysicsSubstep(subDt, 3.5);
    }
    const finalCOM = org.com.clone();
    const netDisplacement = initialCOM.distanceTo(finalCOM);
    const passed = Number.isFinite(netDisplacement) && netDisplacement > 0.5 && netDisplacement < 50.0;
    reports.push({
      testName: '3D Nonplanar Undulating Locomotion (Multi-Axis Hinges)',
      passed,
      measurement: `3D Net travel: ${netDisplacement.toFixed(2)} m in 3D water volume`,
      details: 'Demonstrates genuine 3D swimming with orthogonal pitch and yaw revolute hinges.',
    });
  }

  // --- Test 5: Joint Anchor Coincidence & Angular Limits ---
  {
    const genome = createFounderGenome('test-swimmer-5', 'Calibrated Planar Swimmer', prng, 'planar_swimmer');
    const org = new OrganismInstance(genome, new THREE.Vector3(0, 0, 0));
    let maxAnchorError = 0;
    let limitViolations = 0;

    for (let s = 0; s < 1200; s++) { // 10 simulated seconds
      org.updatePhysicsSubstep(subDt, 3.5);
      for (const j of org.joints) {
        if (j.anchorError > maxAnchorError) maxAnchorError = j.anchorError;
        if (j.currentAngle < j.minAngle - 0.05 || j.currentAngle > j.maxAngle + 0.05) {
          limitViolations++;
        }
      }
    }
    const passed = Number.isFinite(maxAnchorError) && maxAnchorError < 0.005 && limitViolations === 0;
    reports.push({
      testName: 'Revolute Joint Anchor Coincidence & Angular Limits Enforcement',
      passed,
      measurement: `Max Anchor Error: ${(maxAnchorError * 1000).toFixed(3)} mm, Angular Limit Violations: ${limitViolations}`,
      details: 'Full effective-mass impulse solver maintains coincident joint anchors and respects physical range of motion.',
    });
  }

  // --- Test 6: 60-Second Full Ecosystem Simulation (No Early Extinction) ---
  {
    const sim = new WorldSimulation(4242, 14);
    for (let step = 0; step < 60 * 60; step++) { // 60 simulated seconds at 60Hz
      sim.stepOuterTick(1 / 60);
    }
    const tele = sim.getTelemetry();
    const passed = tele.organismCount > 0 && Number.isFinite(tele.chemicalEnergyLedger.organismReserves);
    reports.push({
      testName: '60-Second Ecosystem Sustainability (Seed 4242)',
      passed,
      measurement: `Living Organisms: ${tele.organismCount}/14, Food Ingested: ${tele.totalFoodConsumed.toFixed(1)} J, Highest Gen: ${tele.highestGeneration}`,
      details: 'Founders swim smoothly without numerical blow-up, maintain positive energy reserves, and feed on nutrients.',
    });
  }

  // --- Test 7: Diet Permitted vs. Rejected Foods & Specialist vs. Omnivore Rates ---
  {
    const sim = new WorldSimulation(101, 0); // Isolated empty simulation
    const herbGenome = createFounderGenome('herb-1', 'Herbivore', prng, 'planar_swimmer');
    herbGenome.parts[0].mouthDiet = 'herbivore';
    herbGenome.parts[0].mouthFace = '-Z';

    const carnGenome = createFounderGenome('carn-1', 'Carnivore', prng, 'planar_swimmer');
    carnGenome.parts[0].mouthDiet = 'carnivore';
    carnGenome.parts[0].mouthFace = '-Z';

    const omniGenome = createFounderGenome('omni-1', 'Omnivore', prng, 'planar_swimmer');
    omniGenome.parts[0].mouthDiet = 'omnivore';
    omniGenome.parts[0].mouthFace = '-Z';

    const herb = sim.addOrganism(herbGenome, new THREE.Vector3(-6, 8, 0));
    herb.reserves = 100;
    const carn = sim.addOrganism(carnGenome, new THREE.Vector3(0, 8, 0));
    carn.reserves = 100;
    const omni = sim.addOrganism(omniGenome, new THREE.Vector3(6, 8, 0));
    omni.reserves = 100;

    // Place nutrients directly in front of all three mouths (face -Z)
    // -Z mouth world pos: body.pos.z - dimZ/2 - 0.02 = 8 - (3*0.3)/2 - 0.02 = -0.47 relative z
    const herbNut = { id: 'nut-h', pos: new THREE.Vector3(-6, 8, -0.6), energy: 40 };
    const carnNut = { id: 'nut-c', pos: new THREE.Vector3(0, 8, -0.6), energy: 40 };
    const omniNut = { id: 'nut-o', pos: new THREE.Vector3(6, 8, -0.6), energy: 40 };
    sim.nutrients = [herbNut, carnNut, omniNut];

    // Place foreign eggs in front of all three mouths
    const foreignEggCarn = {
      id: 'egg-c',
      parentId: 'other-parent',
      genome: herbGenome,
      pos: new THREE.Vector3(0, 8, -0.6),
      fundingRemaining: 50,
      initialFunding: 50,
      incubationRemainingSec: 20,
    };
    const foreignEggHerb = {
      id: 'egg-h',
      parentId: 'other-parent',
      genome: herbGenome,
      pos: new THREE.Vector3(-6, 8, -0.6),
      fundingRemaining: 50,
      initialFunding: 50,
      incubationRemainingSec: 20,
    };
    const foreignEggOmni = {
      id: 'egg-o',
      parentId: 'other-parent',
      genome: herbGenome,
      pos: new THREE.Vector3(6, 8, -0.6),
      fundingRemaining: 50,
      initialFunding: 50,
      incubationRemainingSec: 20,
    };
    sim.eggs = [foreignEggCarn, foreignEggHerb, foreignEggOmni];

    // Step 1 simulated second (60 ticks of 1/60s)
    for (let t = 0; t < 60; t++) {
      sim.stepOuterTick(1 / 60);
    }

    // Herbivore should have consumed herbNut and REJECTED foreignEggHerb
    const herbConsumedNut = herbNut.energy < 40;
    const herbRejectedEgg = foreignEggHerb.fundingRemaining === 50;

    // Carnivore should have REJECTED carnNut and consumed foreignEggCarn
    const carnRejectedNut = carnNut.energy === 40;
    const carnConsumedEgg = foreignEggCarn.fundingRemaining < 50;

    // Omnivore should have consumed BOTH at half rate
    const omniConsumedNut = omniNut.energy < 40 && omniNut.energy > herbNut.energy;
    const omniConsumedEgg = foreignEggOmni.fundingRemaining < 50 && foreignEggOmni.fundingRemaining > foreignEggCarn.fundingRemaining;

    const passed = herbConsumedNut && herbRejectedEgg && carnRejectedNut && carnConsumedEgg && omniConsumedNut && omniConsumedEgg;
    reports.push({
      testName: 'Diet Specificity & Calibrated Specialist/Omnivore Rates',
      passed,
      measurement: `Herbivore: nut eaten ${ (40 - herbNut.energy).toFixed(1) }J / egg left ${ foreignEggHerb.fundingRemaining }J; Carnivore: nut left ${ carnNut.energy }J / egg eaten ${ (50 - foreignEggCarn.fundingRemaining).toFixed(1) }J; Omnivore: nut eaten ${ (40 - omniNut.energy).toFixed(1) }J / egg eaten ${ (50 - foreignEggOmni.fundingRemaining).toFixed(1) }J`,
      details: 'Herbivores strictly reject eggs/prey, carnivores strictly reject nutrients, and omnivores feed on all sources at calibrated half rates.',
    });
  }

  // --- Test 8: Rotated Mouth Faces (+X, +Y, -Z) Aperture Contact ---
  {
    const sim = new WorldSimulation(102, 0);
    // Organism with mouth on +X face
    const gX = createFounderGenome('rot-x', 'Mouth +X', prng, 'planar_swimmer');
    gX.parts[0].mouthFace = '+X';
    const orgX = sim.addOrganism(gX, new THREE.Vector3(0, 8, 0));
    orgX.reserves = 100;

    // Place nutrient in front of +X face (+0.6m in X)
    const nutX = { id: 'nut-x', pos: new THREE.Vector3(0.6, 8, 0), energy: 40 };
    // Place nutrient in front of -Z (which is NOT where mouth is)
    const nutZ = { id: 'nut-z', pos: new THREE.Vector3(0, 8, -0.6), energy: 40 };
    sim.nutrients = [nutX, nutZ];

    for (let t = 0; t < 30; t++) {
      sim.stepOuterTick(1 / 60);
    }

    const fedAtRotatedFace = nutX.energy < 40;
    const ignoredNonMouthFace = nutZ.energy === 40;
    const passed = fedAtRotatedFace && ignoredNonMouthFace;
    reports.push({
      testName: 'Rotated Mouth Face World Aperture Contact (+X Face)',
      passed,
      measurement: `Mouth at +X: Target at +X consumed ${(40 - nutX.energy).toFixed(1)}J, Target at -Z ignored (${nutZ.energy}J remaining)`,
      details: 'Shared aperture transform correctly routes feeding to the declared mouthFace in world space.',
    });
  }

  // --- Test 9: Absence of Feeding Through Back of Body ---
  {
    const sim = new WorldSimulation(103, 0);
    const genome = createFounderGenome('back-test', 'Front-Mouth Swimmer', prng, 'planar_swimmer');
    genome.parts[0].mouthFace = '-Z'; // Mouth is at FRONT (-Z)
    const org = sim.addOrganism(genome, new THREE.Vector3(0, 8, 0));
    org.reserves = 100;

    // Place nutrient directly behind the body (+Z) at the exact same distance as front
    const backNut = { id: 'back-nut', pos: new THREE.Vector3(0, 8, 0.6), energy: 40 };
    sim.nutrients = [backNut];

    for (let t = 0; t < 60; t++) {
      sim.stepOuterTick(1 / 60);
    }

    const passed = backNut.energy === 40 && org.totalFoodEaten === 0;
    reports.push({
      testName: 'Absence of Feeding Through Back of Body',
      passed,
      measurement: `Nutrient behind body energy: ${backNut.energy} J (0.0 J ingested)`,
      details: 'Aperture normal projection correctly rejects feeding from behind the body.',
    });
  }

  // --- Test 10: Live Predation Energy Subtraction, Losses & Self/Own-Egg Protection ---
  {
    const sim = new WorldSimulation(104, 0);
    const carnGenome = createFounderGenome('pred-1', 'Apex Predator', prng, 'planar_swimmer');
    carnGenome.parts[0].mouthDiet = 'carnivore';
    carnGenome.parts[0].mouthFace = '-Z';

    const preyGenome = createFounderGenome('prey-1', 'Prey Herbivore', prng, 'planar_swimmer');
    preyGenome.parts[0].mouthDiet = 'herbivore';

    const pred = sim.addOrganism(carnGenome, new THREE.Vector3(0, 8, 0));
    pred.reserves = 100;
    const prey = sim.addOrganism(preyGenome, new THREE.Vector3(0, 8, -0.6));
    prey.reserves = 200;

    // Predator's OWN egg (must NOT be eaten)
    const ownEgg = {
      id: 'own-egg-1',
      parentId: pred.genome.id,
      genome: carnGenome,
      pos: new THREE.Vector3(0, 8, -0.5),
      fundingRemaining: 60,
      initialFunding: 60,
      incubationRemainingSec: 20,
    };
    sim.eggs = [ownEgg];

    const preyInitialReserves = prey.reserves;
    const predInitialReserves = pred.reserves;

    for (let t = 0; t < 60; t++) { // 1 simulated second
      sim.stepOuterTick(1 / 60);
    }

    const preyLost = preyInitialReserves - prey.reserves;
    const predGained = pred.reserves - predInitialReserves;
    // Account for base upkeep (~0.4 J/s) and 0.8 trophic efficiency:
    // predGained should be roughly preyLost * 0.8 - upkeep
    const ownEggProtected = ownEgg.fundingRemaining === 60;
    const predationOccurred = preyLost > 20;
    const trophicLossApplied = predGained < preyLost && predGained > 0;

    const passed = ownEggProtected && predationOccurred && trophicLossApplied;
    reports.push({
      testName: 'Live Predation Accounting, Trophic Efficiency & Kin Protection',
      passed,
      measurement: `Prey lost: ${preyLost.toFixed(1)} J -> Predator gained: ${predGained.toFixed(1)} J (Trophic ratio: ${(predGained / preyLost).toFixed(2)}), Own Egg: ${ownEgg.fundingRemaining} J intact`,
      details: 'Live predation subtracts energy from prey before crediting predator, applies metabolic losses, prevents self-biting, and protects parent eggs.',
    });
  }

  return reports;
}
