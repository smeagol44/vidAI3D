/**
 * Optional asymmetry for a real revolute motor. The oscillator's carrier phase
 * still advances using the inherited frequency and the live neural frequency
 * command. A duty fraction changes *target timing*, never the physical state.
 *
 * At duty=0.5 the output is exactly sin(phase), preserving all old genomes.
 * Duty<0.5 gives the positive sweep less time, duty>0.5 gives it more time.
 */
export function strokeWave(phase: number, duty = 0.5): number {
  const circle = 2 * Math.PI;
  const normalized = (((phase / circle + 0.25) % 1) + 1) % 1;
  const cycle = normalized < duty
    ? normalized * 0.5 / duty
    : 0.5 + (normalized - duty) * 0.5 / (1 - duty);
  return -Math.cos(circle * cycle);
}

/**
 * A feathered plate is face-on during the parent joint's positive sweep
 * (cos phase > 0) and pitched edge-on during its negative return. The
 * continuous shoulder avoids impulsive angle targets at phase boundaries.
 * Returns 0..1, not a kinematic pose or an externally applied force.
 */
export function recoveryFeatherWeight(parentPhase: number): number {
  return (1 - Math.tanh(5 * Math.cos(parentPhase))) * 0.5;
}
