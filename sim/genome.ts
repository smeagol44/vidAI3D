export type FaceDirection = '+X' | '-X' | '+Y' | '-Y' | '+Z' | '-Z';

export interface VoxelPartGene {
  id: string;
  parentId: string | null;
  attachFace: FaceDirection | null; // Face of parent to attach to
  parentFace: FaceDirection | null;
  // Integer dimensions N x M x P in local voxel grid units (0.2m per voxel)
  dimX: number; // e.g. 1 to 4
  dimY: number; // e.g. 1 to 4
  dimZ: number; // e.g. 1 to 4
  // Joint definition relative to parent connection
  hingeAxis: 'X' | 'Y' | 'Z';
  minAngle: number; // in radians, e.g. -Math.PI / 4
  maxAngle: number; // in radians, e.g. Math.PI / 4
  restAngle: number;
  motorMaxTorque: number;
  motorFrequency: number;
  motorPhase: number;
  hasMouth: boolean;
  mouthFace?: FaceDirection;
  mouthDiet?: 'herbivore' | 'carnivore' | 'omnivore';
  hasEye: boolean;
  eyeFace?: FaceDirection;
  eyeFov?: number;
  eyeRange?: number;
}

export interface NeuralGene {
  hiddenCount: number; // founder ~24
  timeConstants: number[]; // leaky integrator tau per hidden neuron
  biases: number[];
  inputWeights: number[][]; // [hidden][input]
  recurrentWeights: number[][]; // [hidden][hidden]
  outputWeights: number[][]; // [output][hidden]
  outputBiases: number[];
}

export interface OrganismGenome {
  id: string;
  name: string;
  generation: number;
  ancestorId: string | null;
  color: string; // hex #RRGGBB
  parts: VoxelPartGene[];
  brain: NeuralGene;
  metabolism: {
    baseUpkeepPerSec: number;
    eggIncubationSec: number;
    eggEnergyFunding: number;
    reproduceReserveThreshold: number;
    reproduceCooldownSec: number;
    lifespanSec: number;
  };
}

export const VOXEL_UNIT = 0.3; // 1 integer voxel = 0.3 meters

export interface MouthApertureData {
  localPos: THREE.Vector3;
  localNormal: THREE.Vector3;
  localEuler: THREE.Euler;
  plateWidth: number;
  plateHeight: number;
  radius: number;
}

import * as THREE from 'three';

/**
 * Computes the local-space transform and dimensions of the mouth aperture plate
 * based on mouthFace (+X, -X, +Y, -Y, +Z, -Z) and integer cuboid dimensions.
 */
export function getMouthApertureLocal(
  face: FaceDirection,
  dimX: number,
  dimY: number,
  dimZ: number
): MouthApertureData {
  const halfX = (dimX * VOXEL_UNIT) / 2;
  const halfY = (dimY * VOXEL_UNIT) / 2;
  const halfZ = (dimZ * VOXEL_UNIT) / 2;

  const localPos = new THREE.Vector3();
  const localNormal = new THREE.Vector3();
  const localEuler = new THREE.Euler();
  let plateWidth = 0.5;
  let plateHeight = 0.5;
  let radius = 0.4;

  switch (face) {
    case '+X':
      localPos.set(halfX + 0.02, 0, 0);
      localNormal.set(1, 0, 0);
      localEuler.set(0, Math.PI / 2, 0);
      plateWidth = dimZ * VOXEL_UNIT * 0.6;
      plateHeight = dimY * VOXEL_UNIT * 0.5;
      radius = Math.max(0.3, Math.min(dimY, dimZ) * VOXEL_UNIT * 0.5 + 0.15);
      break;
    case '-X':
      localPos.set(-halfX - 0.02, 0, 0);
      localNormal.set(-1, 0, 0);
      localEuler.set(0, -Math.PI / 2, 0);
      plateWidth = dimZ * VOXEL_UNIT * 0.6;
      plateHeight = dimY * VOXEL_UNIT * 0.5;
      radius = Math.max(0.3, Math.min(dimY, dimZ) * VOXEL_UNIT * 0.5 + 0.15);
      break;
    case '+Y':
      localPos.set(0, halfY + 0.02, 0);
      localNormal.set(0, 1, 0);
      localEuler.set(-Math.PI / 2, 0, 0);
      plateWidth = dimX * VOXEL_UNIT * 0.6;
      plateHeight = dimZ * VOXEL_UNIT * 0.5;
      radius = Math.max(0.3, Math.min(dimX, dimZ) * VOXEL_UNIT * 0.5 + 0.15);
      break;
    case '-Y':
      localPos.set(0, -halfY - 0.02, 0);
      localNormal.set(0, -1, 0);
      localEuler.set(Math.PI / 2, 0, 0);
      plateWidth = dimX * VOXEL_UNIT * 0.6;
      plateHeight = dimZ * VOXEL_UNIT * 0.5;
      radius = Math.max(0.3, Math.min(dimX, dimZ) * VOXEL_UNIT * 0.5 + 0.15);
      break;
    case '+Z':
      localPos.set(0, 0, halfZ + 0.02);
      localNormal.set(0, 0, 1);
      localEuler.set(0, Math.PI, 0);
      plateWidth = dimX * VOXEL_UNIT * 0.6;
      plateHeight = dimY * VOXEL_UNIT * 0.5;
      radius = Math.max(0.3, Math.min(dimX, dimY) * VOXEL_UNIT * 0.5 + 0.15);
      break;
    case '-Z':
    default:
      localPos.set(0, 0, -halfZ - 0.02);
      localNormal.set(0, 0, -1);
      localEuler.set(0, 0, 0);
      plateWidth = dimX * VOXEL_UNIT * 0.6;
      plateHeight = dimY * VOXEL_UNIT * 0.5;
      radius = Math.max(0.3, Math.min(dimX, dimY) * VOXEL_UNIT * 0.5 + 0.15);
      break;
  }

  return { localPos, localNormal, localEuler, plateWidth, plateHeight, radius };
}

/**
 * Checks contact between a world-space mouth aperture and a target in 3D.
 * Contact requires distance within (mouthRadius + targetRadius) and target in front of the mouth face normal.
 */
export function isContactingMouthAperture(
  mouthWorldPos: THREE.Vector3,
  mouthWorldNormal: THREE.Vector3,
  mouthRadius: number,
  targetPos: THREE.Vector3,
  targetRadius: number = 0.25
): boolean {
  const rel = targetPos.clone().sub(mouthWorldPos);
  const dist = rel.length();
  if (dist > mouthRadius + targetRadius) return false;
  // Ensure target is on or in front of the aperture plane (prevents back-of-body feeding)
  const forwardProjection = rel.dot(mouthWorldNormal);
  if (forwardProjection < -0.1) return false;
  return true;
}

/**
 * Proposed 3D Broad-to-Broad Connection Rule:
 * A face is narrow/neutral if its normal axis has length at least as large as both other local dimensions.
 * Otherwise it is broad. Reject broad-to-broad connections.
 */
export function isBroadFace(face: FaceDirection, dimX: number, dimY: number, dimZ: number): boolean {
  if (dimX === dimY && dimY === dimZ) return false; // Cubes are neutral on every face
  if (face === '+X' || face === '-X') {
    return dimX < dimY || dimX < dimZ;
  }
  if (face === '+Y' || face === '-Y') {
    return dimY < dimX || dimY < dimZ;
  }
  if (face === '+Z' || face === '-Z') {
    return dimZ < dimX || dimZ < dimY;
  }
  return false;
}

export function validateGenome(genome: OrganismGenome): boolean {
  if (!genome.parts || genome.parts.length === 0 || genome.parts.length > 10) return false;
  const root = genome.parts.find((p) => p.parentId === null);
  if (!root) return false;

  const partIds = new Set<string>();
  for (const part of genome.parts) {
    if (partIds.has(part.id)) return false;
    partIds.add(part.id);
    if (part.dimX < 1 || part.dimY < 1 || part.dimZ < 1) return false;
    if (part.dimX > 5 || part.dimY > 5 || part.dimZ > 5) return false;
  }

  // Check connectivity & 3D face rules
  for (const part of genome.parts) {
    if (part.parentId !== null) {
      const parent = genome.parts.find((p) => p.id === part.parentId);
      if (!parent || !part.parentFace || !part.attachFace) return false;
      const parentBroad = isBroadFace(part.parentFace, parent.dimX, parent.dimY, parent.dimZ);
      const childBroad = isBroadFace(part.attachFace, part.dimX, part.dimY, part.dimZ);
      if (parentBroad && childBroad) return false;
    }
  }
  return true;
}
