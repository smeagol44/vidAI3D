import type { OrganismGenome } from './genome';

/**
 * Chemical energy is stored in simulation reserve units (shown as J-equivalent
 * in the existing UI). Mechanical motor work remains physical joules and is
 * converted to these units by the separate, retained 0.005 scaling.
 *
 * Explicit biological budget for one constructed organism:
 * 5 per voxel, 15 per mouth, 10 per eye, 6 per hinged attachment and
 * 0.5 per recurrent neuron. It is deliberately an economy model, not an
 * assertion about real biochemical tissue density.
 */
export function constructionEnergy(genome: OrganismGenome): number {
  const voxels = genome.parts.reduce((n, p) => n + p.dimX * p.dimY * p.dimZ * (p.thicknessScaleY ?? 1), 0);
  const mouths = genome.parts.filter(p => p.hasMouth).length;
  const eyes = genome.parts.filter(p => p.hasEye).length;
  const joints = genome.parts.filter(p => p.parentId !== null).length;
  return voxels * 5 + mouths * 15 + eyes * 10 + joints * 6 + genome.brain.hiddenCount * .5;
}

/** Storage capacity is not a free starting grant or an infinite sink for food. */
export function reserveCapacity(genome: OrganismGenome): number {
  return Math.max(500, Math.ceil(constructionEnergy(genome) * 6));
}

export function founderReserve(genome: OrganismGenome): number {
  return Math.min(reserveCapacity(genome), Math.max(250, Math.ceil(constructionEnergy(genome) * 4)));
}

/** Newborn must receive funded tissue plus a positive usable reserve. */
export function viableEggFunding(genome: OrganismGenome): number {
  return constructionEnergy(genome) + Math.max(60, constructionEnergy(genome));
}

/** Basal upkeep is a chemical loss, including a small anatomy-dependent load. */
export function basalUpkeepPerSecond(genome: OrganismGenome): number {
  return genome.metabolism.baseUpkeepPerSec + constructionEnergy(genome) * .001;
}

export const CHEMICAL_UNITS_PER_MOTOR_JOULE = .005;
