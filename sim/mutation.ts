import * as THREE from 'three';
import { OrganismGenome, VoxelPartGene, NeuralGene, FaceDirection, isBroadFace, VOXEL_UNIT, validateGenome } from './genome';
import { PRNG } from './prng';

export function createFounderGenome(id: string, name: string, prng: PRNG, type: 'planar_swimmer' | '3d_serpent' | 'tri_limb'): OrganismGenome {
  const parts: VoxelPartGene[] = [];
  const palette = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#10b981', '#14b8a6'];
  const color = palette[prng.rangeInt(0, palette.length - 1)];

  if (type === 'planar_swimmer') {
    // 3-part nonreciprocal planar swimmer
    parts.push({
      id: 'part-0',
      parentId: null,
      parentFace: null,
      attachFace: null,
      dimX: 2,
      dimY: 1,
      dimZ: 3,
      hingeAxis: 'Y',
      minAngle: -Math.PI / 3,
      maxAngle: Math.PI / 3,
      restAngle: 0,
      motorMaxTorque: 25,
      motorFrequency: 1.2,
      motorPhase: 0,
      hasMouth: true,
      mouthFace: '-Z',
      mouthDiet: 'herbivore',
      hasEye: true,
      eyeFace: '-Z',
      eyeFov: 1.2,
      eyeRange: 20,
    });
    // Middle fin segment
    parts.push({
      id: 'part-1',
      parentId: 'part-0',
      parentFace: '+Z',
      attachFace: '-Z',
      dimX: 2,
      dimY: 1,
      dimZ: 2,
      hingeAxis: 'Y',
      minAngle: -Math.PI / 3,
      maxAngle: Math.PI / 3,
      restAngle: 0,
      motorMaxTorque: 20,
      motorFrequency: 1.2,
      motorPhase: 0.8, // nonreciprocal phase shift
      hasMouth: false,
      hasEye: false,
    });
    // Tail paddle
    parts.push({
      id: 'part-2',
      parentId: 'part-1',
      parentFace: '+Z',
      attachFace: '-Z',
      dimX: 1,
      dimY: 2,
      dimZ: 3,
      hingeAxis: 'Y',
      minAngle: -Math.PI / 3,
      maxAngle: Math.PI / 3,
      restAngle: 0,
      motorMaxTorque: 22,
      motorFrequency: 1.2,
      motorPhase: 1.6,
      hasMouth: false,
      hasEye: false,
    });
  } else if (type === '3d_serpent') {
    // Nonplanar 3D undulating swimmer (twisting pitch and yaw)
    parts.push({
      id: 'part-0',
      parentId: null,
      parentFace: null,
      attachFace: null,
      dimX: 2,
      dimY: 2,
      dimZ: 3,
      hingeAxis: 'Y',
      minAngle: -Math.PI / 4,
      maxAngle: Math.PI / 4,
      restAngle: 0,
      motorMaxTorque: 30,
      motorFrequency: 1.0,
      motorPhase: 0,
      hasMouth: true,
      mouthFace: '-Z',
      mouthDiet: 'omnivore',
      hasEye: true,
      eyeFace: '-Z',
      eyeFov: 1.4,
      eyeRange: 22,
    });
    parts.push({
      id: 'part-1',
      parentId: 'part-0',
      parentFace: '+Z',
      attachFace: '-Z',
      dimX: 2,
      dimY: 2,
      dimZ: 2,
      hingeAxis: 'X', // Pitch bending
      minAngle: -Math.PI / 4,
      maxAngle: Math.PI / 4,
      restAngle: 0,
      motorMaxTorque: 25,
      motorFrequency: 1.0,
      motorPhase: 0.9,
      hasMouth: false,
      hasEye: false,
    });
    parts.push({
      id: 'part-2',
      parentId: 'part-1',
      parentFace: '+Z',
      attachFace: '-Z',
      dimX: 2,
      dimY: 1,
      dimZ: 2,
      hingeAxis: 'Y', // Yaw bending (nonplanar!)
      minAngle: -Math.PI / 4,
      maxAngle: Math.PI / 4,
      restAngle: 0,
      motorMaxTorque: 25,
      motorFrequency: 1.0,
      motorPhase: 1.8,
      hasMouth: false,
      hasEye: false,
    });
  } else {
    // Tri-limb organism
    parts.push({
      id: 'part-0',
      parentId: null,
      parentFace: null,
      attachFace: null,
      dimX: 3,
      dimY: 2,
      dimZ: 3,
      hingeAxis: 'Y',
      minAngle: -Math.PI / 4,
      maxAngle: Math.PI / 4,
      restAngle: 0,
      motorMaxTorque: 30,
      motorFrequency: 1.1,
      motorPhase: 0,
      hasMouth: true,
      mouthFace: '-Z',
      mouthDiet: 'carnivore',
      hasEye: true,
      eyeFace: '-Z',
      eyeFov: 1.5,
      eyeRange: 25,
    });
    parts.push({
      id: 'part-1',
      parentId: 'part-0',
      parentFace: '+X',
      attachFace: '-X',
      dimX: 2,
      dimY: 1,
      dimZ: 2,
      hingeAxis: 'Z',
      minAngle: -Math.PI / 4,
      maxAngle: Math.PI / 4,
      restAngle: 0,
      motorMaxTorque: 18,
      motorFrequency: 1.1,
      motorPhase: 0.4,
      hasMouth: false,
      hasEye: false,
    });
    parts.push({
      id: 'part-2',
      parentId: 'part-0',
      parentFace: '-X',
      attachFace: '+X',
      dimX: 2,
      dimY: 1,
      dimZ: 2,
      hingeAxis: 'Z',
      minAngle: -Math.PI / 4,
      maxAngle: Math.PI / 4,
      restAngle: 0,
      motorMaxTorque: 18,
      motorFrequency: 1.1,
      motorPhase: 0.4,
      hasMouth: false,
      hasEye: false,
    });
  }

  // Named inherited gaits calibrated with SI cuboid inertia and normal-only water resistance.
  // Existing/custom genomes are not rewritten; these settings define newly created founders.
  if(type === 'planar_swimmer') {
    for(const [i,p] of parts.entries()) { p.dimX=1; p.dimY=1; p.dimZ=3; p.motorPhase=i*Math.PI/2; }
  }
  if(type === '3d_serpent') {
    parts.push({...parts[2],id:'part-3',parentId:'part-2'});
    for(const [i,p] of parts.entries()) {
      p.dimX=1; p.dimY=1; p.dimZ=3; p.minAngle=-Math.PI/3; p.maxAngle=Math.PI/3;
      p.hingeAxis=i===2?'X':'Y'; p.motorPhase=[0,0,Math.PI/2,Math.PI/2][i];
    }
  }
  if(type === 'tri_limb') parts[2].motorPhase=parts[1].motorPhase+Math.PI/2;
  for(const p of parts) { p.motorFrequency=.65; p.motorMaxTorque=400; }

  const hiddenCount = 24;
  const timeConstants: number[] = [];
  const biases: number[] = [];
  const recurrentWeights: number[][] = [];
  const inputWeights: number[][] = [];
  const outputWeights: number[][] = [];
  const outputBiases: number[] = [];

  for (let h = 0; h < hiddenCount; h++) {
    timeConstants.push(prng.range(0.08, 0.25));
    biases.push(prng.range(-0.1, 0.1));

    const recRow: number[] = [];
    for (let j = 0; j < hiddenCount; j++) {
      // Moderate sparse initial connectivity
      recRow.push(prng.next() < 0.35 ? prng.range(-0.4, 0.4) : 0);
    }
    recurrentWeights.push(recRow);

    const inRow: number[] = [];
    for (let i = 0; i < 60; i++) {
      inRow.push(prng.next() < 0.25 ? prng.range(-0.5, 0.5) : 0);
    }
    inputWeights.push(inRow);
  }

  for (let o = 0; o < 20; o++) {
    outputBiases.push(prng.range(-0.05, 0.05));
    const outRow: number[] = [];
    for (let h = 0; h < hiddenCount; h++) {
      outRow.push(prng.next() < 0.35 ? prng.range(-0.4, 0.4) : 0);
    }
    outputWeights.push(outRow);
  }

  const brain: NeuralGene = {
    hiddenCount,
    timeConstants,
    biases,
    recurrentWeights,
    inputWeights,
    outputWeights,
    outputBiases,
  };

  return {
    id,
    name,
    generation: 1,
    ancestorId: null,
    color,
    parts,
    brain,
    metabolism: {
      baseUpkeepPerSec: 0.4,
      eggIncubationSec: 15,
      eggEnergyFunding: 140,
      reproduceReserveThreshold: 300,
      reproduceCooldownSec: 20,
      lifespanSec: 160,
    },
  };
}

export function mutateGenome(parent: OrganismGenome, prng: PRNG, newId: string): OrganismGenome {
  // Deep clone
  const child: OrganismGenome = JSON.parse(JSON.stringify(parent));
  child.id = newId;
  child.generation = parent.generation + 1;
  child.ancestorId = parent.id;

  // 1. Numerical color drift
  if (prng.next() < 0.4) {
    const col = new THREE.Color(child.color);
    const hsl = { h: 0, s: 0, l: 0 };
    col.getHSL(hsl);
    hsl.h = (hsl.h + prng.range(-0.06, 0.06) + 1) % 1;
    hsl.s = THREE.MathUtils.clamp(hsl.s + prng.range(-0.05, 0.05), 0.3, 1.0);
    hsl.l = THREE.MathUtils.clamp(hsl.l + prng.range(-0.05, 0.05), 0.3, 0.8);
    col.setHSL(hsl.h, hsl.s, hsl.l);
    child.color = '#' + col.getHexString();
  }

  // 2. Part mutations (dimensions, motor frequencies, limits)
  for (const p of child.parts) {
    if (prng.next() < 0.2) {
      // Dimensions integer drift +/- 1
      const dimChoice = prng.rangeInt(0, 2);
      if (dimChoice === 0) p.dimX = THREE.MathUtils.clamp(p.dimX + (prng.next() < 0.5 ? -1 : 1), 1, 4);
      if (dimChoice === 1) p.dimY = THREE.MathUtils.clamp(p.dimY + (prng.next() < 0.5 ? -1 : 1), 1, 4);
      if (dimChoice === 2) p.dimZ = THREE.MathUtils.clamp(p.dimZ + (prng.next() < 0.5 ? -1 : 1), 1, 4);
    }
    if (prng.next() < 0.3) {
      p.motorFrequency = THREE.MathUtils.clamp(p.motorFrequency + prng.range(-0.15, 0.15), 0.2, 3.0);
    }
    if (prng.next() < 0.25) {
      p.motorPhase = (p.motorPhase + prng.range(-0.4, 0.4) + Math.PI * 2) % (Math.PI * 2);
    }
    if (prng.next() < 0.25) {
      p.motorMaxTorque = THREE.MathUtils.clamp(p.motorMaxTorque + prng.range(-30, 30), 50, 800);
    }
  }

  // 3. Rare structural addition or leaf removal
  if (prng.next() < 0.08 && child.parts.length < 7) {
    // Add child part to a random existing part
    const parentPart = child.parts[prng.rangeInt(0, child.parts.length - 1)];
    const faces: FaceDirection[] = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
    const pFace = faces[prng.rangeInt(0, 5)];
    const aFace = faces[prng.rangeInt(0, 5)];
    const axes: ('X' | 'Y' | 'Z')[] = ['X', 'Y', 'Z'];

    const newPart: VoxelPartGene = {
      id: `part-${child.parts.length}`,
      parentId: parentPart.id,
      parentFace: pFace,
      attachFace: aFace,
      dimX: prng.rangeInt(1, 3),
      dimY: prng.rangeInt(1, 2),
      dimZ: prng.rangeInt(1, 3),
      hingeAxis: axes[prng.rangeInt(0, 2)],
      minAngle: -Math.PI / 3,
      maxAngle: Math.PI / 3,
      restAngle: 0,
      motorMaxTorque: prng.range(200, 400),
      motorFrequency: prng.range(0.8, 1.8),
      motorPhase: prng.range(0, Math.PI * 2),
      hasMouth: false,
      hasEye: false,
    };
    child.parts.push(newPart);
  } else if (prng.next() < 0.05 && child.parts.length > 2) {
    // Remove a leaf part
    const leafIndex = child.parts.findIndex((pt, idx) => idx > 0 && !child.parts.some((other) => other.parentId === pt.id));
    if (leafIndex > 0) {
      child.parts.splice(leafIndex, 1);
    }
  }

  // 4. Neural synaptic weights mutation
  const H = child.brain.hiddenCount;
  for (let h = 0; h < H; h++) {
    if (prng.next() < 0.25) {
      child.brain.timeConstants[h] = THREE.MathUtils.clamp(child.brain.timeConstants[h] + prng.range(-0.02, 0.02), 0.04, 0.5);
    }
    if (prng.next() < 0.2) {
      child.brain.biases[h] = THREE.MathUtils.clamp(child.brain.biases[h] + prng.range(-0.08, 0.08), -1, 1);
    }
    for (let j = 0; j < H; j++) {
      if (prng.next() < 0.15) {
        child.brain.recurrentWeights[h][j] = THREE.MathUtils.clamp(child.brain.recurrentWeights[h][j] + prng.range(-0.1, 0.1), -1.5, 1.5);
      }
    }
    if (child.brain.inputWeights[h]) {
      for (let i = 0; i < child.brain.inputWeights[h].length; i++) {
        if (prng.next() < 0.15) {
          child.brain.inputWeights[h][i] = THREE.MathUtils.clamp(child.brain.inputWeights[h][i] + prng.range(-0.1, 0.1), -1.5, 1.5);
        }
      }
    }
  }

  // 5. Validate child genome
  if (!validateGenome(child)) {
    return parent; // Revert mutation if physically/topologically invalid
  }

  return child;
}
