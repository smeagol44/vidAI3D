# Motor control and locomotion

VIDA 3D uses **physical** revolute joints between real Rapier rigid cuboids. Motor torques rotate the hinged anatomy; integrated normal-only resistance on the moving cuboid faces is what allows useful net displacement through the water. There are no body translations, velocity overrides, nonphysical swim forces or scripted navigation.

## Evolvable rhythmic/direct mixing

Each joint has four existing recurrent neural outputs: **angle (posture/trim)**, oscillator **frequency**, motor **torque allowance**, and **stiffness**. A new **optional** inherited part trait, `motorRhythmMix` in the range **0–1**, determines how much of the prescribed oscillator's target is mixed into the current physical joint target:

`target = rhythmMix × legacyRhythmicTarget + (1 - rhythmMix) × directAngleTarget`

The legacy target is the original inherited `restAngle + neuralTrim + rhythmicStroke` (or optional feathered stroke), with its existing hinge clamping. The direct target is `(minAngle + maxAngle)/2 + neuralAngle × (maxAngle - minAngle)/2`, allowing the same neural Angle output to access the **full hinge range even when restAngle is asymmetric**.

- **Absent** or **1:** existing rhythmic motor formula and genetic phase/feathering, unchanged for existing founders and saved DNA.
- **0:** rhythmic target contribution is disabled. The *same recurrent angle output* can drive full-range direct joint posture within the physical hinge limits. A silent/constant angle output supplies no artificial locomotion.
- **Between 0 and 1:** neural posture and rhythmic drive are blended, including proportionally scaling the optional power/recovery feather target.

The rhythmic phase may still advance as internal motor state when the mix is zero, but cannot apply an oscillatory target while disabled. A small rare ordinary genome mutation can introduce or alter this trait in descendants; there is no new hardcoded behavioral response or extra neural channel. Both import validation and physical-body construction reject invalid or nonfinite mixing values. Mutations do not modify the parent. Genomes lacking the trait remain valid and retain their exact motor target and torque calculations.

## Measuring useful swimming

The organism inspector reports **net COM displacement** (distance from original mass-weighted center of mass), **total COM path length** (accumulated actual physics substeps), and **net metres per chemical motor-energy unit**. It also displays instantaneous COM speed and cumulative motor work. Net displacement distinguishes traversing the tank from wiggling in place; the energy ratio distinguishes energy-efficient motion from excessive actuation. These are observational-only runtime values, do not feed the neural network, and do not alter the global chemical-energy ledger.

These measurements start on each organism's actual construction/hatching. They are not inherited and are not persisted as a new genome schema field. Distance alone does **not** establish navigation toward food, predator avoidance, course-holding or population fitness.

## Limits

Existing planar, serpent and fin-tail founders still use their old (rhythmic) motor settings. New direct-control genotypes need an evolved neural signal that varies appropriately in time; the ability to disable rhythm **does not automatically make the default creatures faster**. Normal-only drag, real motor work and energy conversion are unchanged. Long-run ecology and more useful swimming selection remain future work.
