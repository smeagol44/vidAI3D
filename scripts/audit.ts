/** Read-only baseline probes. Fixtures call the same production modules as the app.
 * Failed observations are report data, not a reason to fabricate a passing result.
 * Run: npm run audit > docs/audit-baseline.json
 */
import * as THREE from 'three';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WorldSimulation } from '../sim/simulation';
import { OrganismInstance } from '../sim/organism';
import { RigidCuboid } from '../sim/physics';
import { createFounderGenome, mutateGenome } from '../sim/mutation';
import { getMouthApertureLocal, validateGenome, type OrganismGenome } from '../sim/genome';
import { PRNG } from '../sim/prng';
import { runLocomotionAndPhysicsVerification } from '../sim/verification';

const DT = 1 / 60;
const genome = (id: string, type: 'planar_swimmer' | '3d_serpent' | 'tri_limb' = 'planar_swimmer') =>
  createFounderGenome(id, id, new PRNG(4242), type);
function empty() {
  const s = new WorldSimulation(4242, 0);
  s.nutrients = []; s.nutrientInflowPerSec = 0; s.externalEnergyAdded = 0;
  return s;
}
function single(id: string, diet = 'herbivore') {
  const g = genome(id); g.parts = [g.parts[0]];
  g.parts[0].mouthDiet = diet as 'herbivore';
  g.metabolism.baseUpkeepPerSec = 0;
  g.metabolism.reproduceReserveThreshold = 1e9;
  return g;
}
function stored(s: WorldSimulation) {
  return s.organisms.reduce((n, o) => n + Math.max(0, o.reserves) + o.structuralEnergy, 0)
    + s.eggs.reduce((n, e) => n + e.fundingRemaining, 0)
    + s.nutrients.reduce((n, p) => n + p.energy, 0);
}
// These TypeScript-private methods remain ordinary JS methods. Direct calls isolate
// production feeding and sensing from unrelated fixture movement and metabolism.
const feed = (s: WorldSimulation, o: OrganismInstance, dt = DT) => (s as any).checkFeeding(o, dt);
const sense = (s: WorldSimulation, o: OrganismInstance) => (s as any).populateSensoryInputs(o);
const ray = (s: WorldSimulation, o: OrganismInstance, origin: THREE.Vector3, dir: THREE.Vector3) =>
  (s as any).castVisionRay(origin, dir, o, 20) as THREE.Color;
function aperture(o: OrganismInstance) {
  const b = o.bodies[0], p = b.partGene;
  const a = getMouthApertureLocal(p.mouthFace || '-Z', p.dimX, p.dimY, p.dimZ);
  return { pos: a.localPos.clone().applyQuaternion(b.rot).add(b.pos), normal: a.localNormal.clone().applyQuaternion(b.rot), local: a };
}
function geometry(o: OrganismInstance) {
  let anchor = 0, axis = 0;
  for (const j of o.joints) {
    const a = j.parentLocalAnchor.clone().applyQuaternion(j.parent.rot).add(j.parent.pos);
    const b = j.childLocalAnchor.clone().applyQuaternion(j.child.rot).add(j.child.pos);
    anchor = Math.max(anchor, a.distanceTo(b));
    const p = j.parentLocalHingeAxis.clone().applyQuaternion(j.parent.rot);
    const c = j.childLocalHingeAxis.clone().applyQuaternion(j.child.rot);
    axis = Math.max(axis, p.angleTo(c));
  }
  return { anchor, axis };
}
function swimmer(type: 'planar_swimmer' | '3d_serpent' | 'tri_limb', mu = 3.5, rotation = new THREE.Quaternion()) {
  const o = new OrganismInstance(genome('reference', type), new THREE.Vector3(), rotation);
  const start = o.com.clone(); let previous = start.clone(); let path = 0, maxAnchor = 0, maxAxis = 0;
  const ranges = o.joints.map(() => ({ min: Infinity, max: -Infinity }));
  const cycles: number[] = []; let cycleStart = start.clone(), previousPhase = o.joints[0]?.jointPhase || 0;
  let maxSpeed = 0, maxAngularSpeed = 0;
  for (let i = 0; i < 30 * 120; i++) {
    o.updatePhysicsSubstep(1 / 120, mu);
    path += previous.distanceTo(o.com); previous.copy(o.com);
    const g = geometry(o); maxAnchor = Math.max(maxAnchor, g.anchor); maxAxis = Math.max(maxAxis, g.axis);
    for (const b of o.bodies) { maxSpeed = Math.max(maxSpeed, b.linVel.length()); maxAngularSpeed = Math.max(maxAngularSpeed, b.angVel.length()); }
    o.joints.forEach((j, k) => { ranges[k].min = Math.min(ranges[k].min, j.currentAngle); ranges[k].max = Math.max(ranges[k].max, j.currentAngle); });
    if (o.joints[0].jointPhase < previousPhase) { cycles.push(o.com.distanceTo(cycleStart)); cycleStart.copy(o.com); }
    previousPhase = o.joints[0].jointPhase;
  }
  return { type, seconds: 30, mu, neuralOutputs: 'held neutral at zero; production inherited oscillator active',
    netMeters: o.com.distanceTo(start), displacement: o.com.clone().sub(start).toArray(), pathMeters: path,
    maxAnchorErrorMeters: maxAnchor, maxHingeAxisMisalignmentDegrees: maxAxis * 180 / Math.PI,
    actualJointRangesRadians: ranges, targetStrokePeakToPeakRadians: o.joints.map(j => .9 * (j.maxAngle - j.minAngle)),
    netDisplacementPerCompletedStrokeMeters: cycles, maxSpeed, maxAngularSpeed, workJoules: o.totalWorkJoules };
}

const builtInVerification = runLocomotionAndPhysicsVerification();
const referenceSwimmers = ['planar_swimmer', '3d_serpent', 'tri_limb'].map(t => swimmer(t as any));
const zeroDrag = swimmer('planar_swimmer', 0);
const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, .7, .2));
const rotated = swimmer('planar_swimmer', 3.5, q);
const covarianceErrorMeters = new THREE.Vector3(...referenceSwimmers[0].displacement as [number, number, number])
  .applyQuaternion(q).distanceTo(new THREE.Vector3(...rotated.displacement as [number, number, number]));

// A torque-free asymmetric cuboid should conserve world angular momentum.
const freeBody = new RigidCuboid(genome('spin').parts[0]); freeBody.angVel.set(1, 2, 3);
const angularMomentum = () => freeBody.angVel.clone().applyMatrix3(freeBody.getInertiaTensorWorldInv(new THREE.Matrix3()).invert());
const initialL = angularMomentum(); let maxLDrift = 0;
for (let i = 0; i < 1200; i++) { freeBody.integrateForces(1 / 120); freeBody.integrateVelocity(1 / 120); maxLDrift = Math.max(maxLDrift, angularMomentum().distanceTo(initialL)); }

const accounting: Record<string, unknown> = {};
{
  const s = empty(), o = s.addOrganism(genome('upkeep'), new THREE.Vector3(0, 8, 0)); o.motorsEnabled = false;
  const before = stored(s); for (let i = 0; i < 60; i++) s.stepOuterTick(DT);
  accounting.upkeep = { before, after: stored(s), unreportedLossJ: before - stored(s), ledger: s.getTelemetry().chemicalEnergyLedger };
}
{
  const s = empty(), g = single('hatch');
  s.eggs.push({ id: 'funded', parentId: 'parent', genome: g, pos: new THREE.Vector3(0, 8, 0), fundingRemaining: 140, initialFunding: 140, incubationRemainingSec: 0 });
  s.externalEnergyAdded = 140; const before = stored(s), externalBefore = s.externalEnergyAdded;
  s.stepOuterTick(DT);
  accounting.hatching = { eggFundingJ: before, afterStoredJ: stored(s), storedIncreaseJ: stored(s) - before,
    falselyRecordedExternalInputJ: s.externalEnergyAdded - externalBefore, hatchlingTissueJ: s.organisms[0]?.structuralEnergy };
}
{
  const s = empty(), g = single('death'); const o = s.addOrganism(g, new THREE.Vector3(0, 8, 0)); o.reserves = 0; o.motorsEnabled = false;
  const before = stored(s); s.stepOuterTick(DT);
  accounting.decomposition = { beforeStoredJ: before, afterStoredJ: stored(s), createdJ: stored(s) - before, particles: s.nutrients.length };
}

const mouthChecks: unknown[] = [];
for (const diet of ['herbivore', 'carnivore', 'omnivore']) {
  for (const food of ['nutrient', 'egg', 'prey']) {
    const s = empty(), o = s.addOrganism(single('eater', diet), new THREE.Vector3(0, 8, 0)), a = aperture(o);
    const p = a.pos.clone().addScaledVector(a.normal, .15);
    if (food === 'nutrient') s.nutrients.push({ id: 'food', pos: p, energy: 100 });
    if (food === 'egg') s.eggs.push({ id: 'food', parentId: 'foreign', genome: single('egg'), pos: p, fundingRemaining: 100, initialFunding: 100, incubationRemainingSec: 20 });
    if (food === 'prey') { const prey = s.addOrganism(single('prey'), p); prey.reserves = 100; }
    const before = o.reserves, sumBefore = stored(s); feed(s, o);
    mouthChecks.push({ diet, food, absorbedJ: o.reserves - before, lostFromSystemJ: sumBefore - stored(s), recordedHeatJ: s.getTelemetry().chemicalEnergyLedger.dissipatedMetabolicWork });
  }
}
{
  const s = empty(), o = s.addOrganism(single('mixed', 'omnivore'), new THREE.Vector3(0, 8, 0)), a = aperture(o);
  const p = a.pos.clone().addScaledVector(a.normal, .15);
  s.nutrients.push({ id: 'food', pos: p, energy: 100 });
  s.eggs.push({ id: 'food', parentId: 'foreign', genome: single('egg'), pos: p.clone(), fundingRemaining: 100, initialFunding: 100, incubationRemainingSec: 20 });
  const prey = s.addOrganism(single('prey'), p.clone()); prey.reserves = 100;
  const before = o.reserves; feed(s, o, 1);
  mouthChecks.push({ case: 'one mouth simultaneously contacting three food categories for one second', absorbedJ: o.reserves - before,
    removedFromSourcesJ: 100 - s.nutrients[0].energy + 100 - s.eggs[0].fundingRemaining + 100 - prey.reserves });
}
{
  const s = empty(), o = s.addOrganism(single('miss', 'carnivore'), new THREE.Vector3(0, 8, 0)), a = aperture(o);
  const pg = single('long-prey'); pg.parts[0].dimX = 1; pg.parts[0].dimY = 1; pg.parts[0].dimZ = 5;
  s.addOrganism(pg, a.pos.clone().addScaledVector(a.normal, .76)); const before = o.reserves; feed(s, o);
  mouthChecks.push({ case: 'long prey surface 0.01m ahead of mouth; centre 0.76m away', absorbedJ: o.reserves - before });
}
{
  const s = empty(), o = s.addOrganism(single('plate'), new THREE.Vector3(0, 8, 0)), a = aperture(o);
  s.nutrients.push({ id: 'outside', pos: a.pos.clone().add(new THREE.Vector3(.52, 0, -.02)), energy: 100 });
  const before = o.reserves; feed(s, o);
  mouthChecks.push({ case: 'nutrient beyond rendered plate edge (0.52m lateral offset)', absorbedJ: o.reserves - before,
    plateHalfWidth: a.local.plateWidth / 2, renderedNutrientHalfWidth: .175 });
}

const vision: Record<string, unknown> = {};
{
  const s = empty(), o = s.addOrganism(single('eye'), new THREE.Vector3(0, 8, 0));
  const origin = o.bodies[0].pos.clone(), dir = new THREE.Vector3(0, 0, -1);
  s.nutrients = [{ id: 'food', pos: origin.clone().add(new THREE.Vector3(0, 0, -2)), energy: 40 }];
  const near = ray(s, o, origin, dir).toArray(); s.nutrients[0].pos.z = -15;
  vision.nearFar = { nearRGB: near, farRGB: ray(s, o, origin, dir).toArray() };
  s.nutrients[0].pos.set(.5, 8, -2);
  vision.phantomSurfaceHit = { lateralOffset: .5, renderedNutrientHalfWidth: .175, sensedRGB: ray(s, o, origin, dir).toArray() };
  s.nutrients[0].pos.set(0, 8, -2); sense(s, o); const before = Array.from(o.brain.inputs);
  o.genome.parts[0].eyeFace = '+X'; o.genome.parts[0].eyeFov = .1; sense(s, o);
  vision.eyeGeneIgnored = { inputsUnchangedAfterFaceAndFovChange: JSON.stringify(before) === JSON.stringify(Array.from(o.brain.inputs)) };
  const cardinal = (['+X','-X','+Y','-Y','+Z','-Z'] as const).map(face => {
    const ap = getMouthApertureLocal(face, 2, 1, 3);
    const renderedOutward = new THREE.Vector3(0, 0, 1).applyEuler(ap.localEuler);
    return { face, renderedPositiveZDotMouthNormal: renderedOutward.dot(ap.localNormal) };
  });
  vision.apertureOverlayDirections = cardinal;
}

const mutation: Record<string, unknown> = {};
{
  const g = genome('parent'), rng = new PRNG(93); let sameObject = 0, sameId = 0, changedOutputs = 0, duplicatePartIds = 0;
  for (let i = 0; i < 500; i++) {
    const c = mutateGenome(g, rng, 'child-' + i);
    if (c === g) sameObject++; if (c.id === g.id) sameId++;
    if (JSON.stringify(c.brain.outputWeights) !== JSON.stringify(g.brain.outputWeights)) changedOutputs++;
    if (new Set(c.parts.map(p => p.id)).size !== c.parts.length) duplicatePartIds++;
  }
  mutation.singleGenerationSample = { count: 500, returnedParentObject: sameObject, reusedParentId: sameId, changedOutputWeightMatrices: changedOutputs, duplicatePartIds };
  const fraction = structuredClone(g); fraction.parts[0].dimX = 1.5;
  const cycle = structuredClone(g); cycle.parts[1].parentId = 'part-2'; cycle.parts[2].parentId = 'part-1';
  const multiRoot = structuredClone(g); multiRoot.parts[1].parentId = null;
  mutation.validation = { fractionalDimensionsAccepted: validateGenome(fraction), disconnectedCycleAccepted: validateGenome(cycle), multipleRootsAccepted: validateGenome(multiRoot) };
  const a = empty(); a.addOrganism(g, new THREE.Vector3(0, 8, 0)); a.addOrganism(g, new THREE.Vector3(2, 8, 0));
  mutation.repeatedSpecimenSpawning = { runtimeIds: a.organisms.map(o => o.genome.id), sameGenomeObject: a.organisms[0].genome === a.organisms[1].genome };
  const s = new WorldSimulation(4242, 3), snapshot = () => JSON.stringify({ organisms: s.organisms.map(o => ({ color:o.genome.color, pos:o.com.toArray() })), nutrients:s.nutrients.map(n=>n.pos.toArray()) });
  const first = snapshot(); s.reset(3); mutation.reset = { sameSeedSameWorld: first === snapshot() };
}

const ecosystem: Array<{ seed: number; samples: Array<Record<string, unknown>> }> = [];
for (const seed of [4242, 71, 1901]) {
  const s = new WorldSimulation(seed, 14), starts = new Map(s.organisms.map(o => [o, o.com.clone()]));
  const samples: Array<Record<string, unknown>> = []; const stop = seed === 4242 ? 300 : 60;
  for (let tick = 1; tick <= stop * 60; tick++) {
    s.stepOuterTick(DT);
    if (tick % 3600 === 0) samples.push({ seconds:tick / 60, living:s.organisms.length, foundersAlive:s.organisms.filter(o=>starts.has(o)).length,
      eggs:s.eggs.length, generation:s.highestGenerationReached, births:s.totalBirths, deaths:s.totalDeaths,
      duplicateRuntimeIds:s.organisms.length-new Set(s.organisms.map(o=>o.genome.id)).size,
      maxSurvivingFounderDisplacementMeters:Math.max(0,...s.organisms.filter(o=>starts.has(o)).map(o=>o.com.distanceTo(starts.get(o)!))),
      actualStoredJ:stored(s), reportedLedger:s.getTelemetry().chemicalEnergyLedger });
  }
  ecosystem.push({ seed, samples });
}

// Replay the exact current App loop's clock arithmetic without DOM/rendering.
function clock(fps:number, speed:number) {
  let accumulator=0, ticks=0;
  for(let i=0;i<fps*10;i++) {
    if(speed===99) ticks+=8;
    else { accumulator+=Math.min(1/fps,.1)*speed; let n=0;
      while(accumulator>=DT&&n<Math.max(1,Math.min(12,Math.ceil(speed*4)))){ticks++;accumulator-=DT;n++;}
      if(accumulator>DT*4)accumulator=0;
    }
  }
  return {fps,speed,realSeconds:10,simulatedSeconds:ticks*DT};
}
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const sourceHashes = Object.fromEntries(['physics','organism','genome','mutation','simulation','verification','prng'].map(n=>
  [n+'.ts', createHash('sha256').update(readFileSync(new URL('../sim/'+n+'.ts', import.meta.url))).digest('hex')]));
console.log(JSON.stringify({ baselineCommit:'927b377020a235fb00d0ab46f292cf39de3d5ccb', reference2DCommit:'7ff4900904db9448d792510b81a849b5177591a4',
  initialReference2DCommit:'654e77bf06424cf90b734248a90f8fcbcc192f71',
  referenceReviewNote:'The 3D probes have no dependency on 2D code. Final source-only feature comparison updated to 2D 0.6.1 after main advanced during the paused task.',
  runtime:process.version, sourceHashes, builtInVerification, referenceSwimmers, zeroDrag,
  rotationCovariance:{errorMeters:covarianceErrorMeters}, freeSpin:{seconds:10,maxRelativeAngularMomentumError:maxLDrift/initialL.length()},
  accounting,mouthChecks,vision,mutation,ecosystem,
  clockArithmetic:[30,60,144].flatMap(fps=>[1,2,5,99].map(speed=>clock(fps,speed))),
  staticUiChecks:{ brainInputsTruncatedTo24:app.includes('.slice(0, 24)'), thresholdIdentifierOccurrences:app.match(/synapseThreshold/g)?.length,
    wholeWorldPersistencePresent:/localStorage|createSnapshot|restoreSnapshot/.test(app) },
  limitations:['Cloud browser WebGL is disabled; 3D rendering and pointer/camera interactions were not validated there.',
    'The 2D comparison is a source review at the pinned commit; its published performance reports were not rerun in this audit.',
    'Clock arithmetic reproduces the inspected App loop; it is not a browser rendering-rate measurement.'] },null,2));
