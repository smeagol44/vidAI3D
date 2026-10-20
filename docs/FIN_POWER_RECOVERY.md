# Real power/recovery fin coordination — VIDA 3D v0.2.5

This change adds two **optional, heritable and mutable** actuation traits to ordinary physical revolute-joint parts. It preserves Rapier's unique authoritative world state, the normal-only cuboid drag law, measured motor torque/work/chemical expenditure, and every existing founder's unchanged genome when fields are missing.

## Motor genetics and physics

- `motorStrokeDuty?: number` in **[0.2,0.8]**, default **0.5**. This distributes the inherited motor oscillator cycle asymmetrically between positive ("power") and negative ("return") angular sweeps. The target remains a smooth bounded sinusoidal stroke reparameterized in *time*, with `duty=0.5` reproducing **sin(phase)** numerically. Joint torque is never overruled; physical angular responses still come from Rapier.
- `motorFeatherAngle?: number` in **[-π/2, π/2]**. On an outer pitch/feather hinge, replace its usual symmetric angle target with `restAngle + featherAngle * recoveryWeight` (plus the inherited and evolving neural trim, physically clamped to its hinge limits). `recoveryWeight` continuously transitions from 0 during the parent's positive sweep to 1 during its negative recovery; it is never a discrete mesh flip or an imposed fluid force.
- The plate's timing is coordinated with the **parent stalk's oscillator**. The child remains able to advance or lag through its own *live neural frequency modulation*; the inherited relative-phase offset and 3/s phase entrainment remain authoritative. Existing four motor output channels per joint (trim, frequency, allowance and stiffness) are retained and mutable. Pitch and duty are ordinary genome traits, not a new hidden propulsion controller.
- New fin traits can evolve when an articulated part becomes physically thin, and mutate further once present; no existing or imported genome is rewritten. Imported or mutated trait values outside physical bounds are rejected by **both** `validateGenome` and `bodyLayout` before construction. The selected-organism joint inspector shows non-default power duty and feather pitch in degrees.

**Physical requirement:** A useful blade needs geometry and articulation together. A thin local-Y plate sweeping in the local XZ plane has its broad face aligned mostly *parallel* to its movement if left unpitched. With a second real hinge on a perpendicular axis, a nonzero power-stroke `restAngle` can expose the broad face, and a `motorFeatherAngle` of opposite sign can return the plate edge-on. This must come from the organism's real inherited body/joint geometry, not an invented force.

## Measured same-geometry control (2026-10-20)

A deliberately small closed-world fixture ran `WorldSimulation.stepOuterTick()` for **20 simulated seconds**, with the same five dynamic parts (two articulating side stalks and two 0.06m-thick outer plates, each 1×1×4 grid units), identical inherited recurrent brain seed, normal hydrodynamics and chemical-energy costs. Only motor wave/power-feather genes and their physical rest-pitch setting differ. The control's outer plates run their legacy sinusoidal motor targets. In the experimental gait the stalks use 50% duty, the two outer plates use opposite rest pitches of ±1.35 rad and recovery feather shifts of ∓1.35 rad, so each turns edge-on during return.

| Metric, 20s | Legacy same-geometry | Power/recovery |
| --- | ---: | ---: |
| COM net displacement | **0.2443 m** | **0.4232 m** |
| Signed local Z travel | -0.1986 m | -0.3657 m |
| Chemical reserve spent | 229.32 | **151.69** |
| Net metres / chemical reserve unit | 0.00107 | **0.00279** |
| Mechanical work | 43,548 J | 28,022 J |
| Maximum hinge anchor gap | 0.580 mm | 0.820 mm |
| World chemical conservation residual | ~1.3e-11 | ~1.8e-11 |

**In this deterministic fixture**, feathering yields ~73% more COM net travel and ~34% less chemical energy use, and >2.6× travel per energy unit. The direction is not purely forward: vertical and lateral translation remain. This is a reproducible **physical efficiency improvement for one custom fin genotype**, not proof that the original tri-limb founder is a fast swimmer. Both versions stay alive with ample reserve; the test checks world-physics steps, hinge stability, energy, net displacement and signed Z travel. The earlier ten-second 32-gait calibration matrix also found feathered configurations with improved net/energy, but some moved backward or sideways; it is retained as evidence, not applied indiscriminately.

## Remaining limits

- The published tri-limb, planar and serpent founder DNA is unchanged. Fin actuation traits are usable by descendant DNA or custom specimens with articulating plates; **no claim of an automatic population speed-up** is made.
- Controlled water without walls/feeding does not establish usable predator chasing, foraging, sustained course-holding, multi-generation fitness or safe performance across all random genotypes.
- The model uses *linear local-axis cuboid surface resistance*, not simulated fluid lift, vortex shedding, flexible membranes or variable flow. A feathered blade has lower resistance depending on the velocity direction, but genuine efficient swimming will require evolved phase/heading correction and usable sensory inputs.
- Voxel surface width/length are still integer dimensions; sub-voxel scaling applies to **local Y thickness** only.
- No manual browser/WebGL verification was requested or performed; validation consists of real production-module tests and TypeScript/Vite build.

The preceding negative experimental history and physical plate foundation are recorded in [THIN_FINS.md](THIN_FINS.md) and v0.2.4's historical [PROJECT_STATUS.md](PROJECT_STATUS.md) section.
