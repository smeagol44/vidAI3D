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

### Reproducible sustained-swimming evaluation (development only)

Run `npm run benchmark:locomotion -- --seed 4242 --seconds 8` for current planar, nonplanar serpent and fin-tail founders, each with identical DNA examined under two starting yaw orientations (0 and π). This creates independent **production** physical worlds, one organism per trial, with 0 nutrients, 0 nutrient inflow, no egg funding, unmodified recurrent brain outputs, and normal motor charges.

The JSON report separates:
- **Final net distance** from **total COM path**, and **peak radius** from the original COM: swaying, circling and early distance peaks should not be called sustained swimming.
- **First-half and second-half net movement** and late-window path straightness: exposes animals that move only initially or spend time circling.
- Signed progress along the original body-facing `-Z` axis (positive/negative, both perfectly valid outcomes), and real final-root heading deflection.
- Charged **motor-only chemical cost** and metres per motor-energy unit, separate from ordinary basal upkeep; measures physical hinge-anchor error and world energy-conservation residual.

The same routine supports a physically disabled-motors reference and a **counterfactual genotype** in which every physical joint's inherited `motorRhythmMix` is zero.

### Inherited head-first planar swimming

Newly created **planar six-link** founders have genetically assigned **−π/2** phase increments from one segment to the next, whereas the **3D serpent** retains its distinct mixed-axis phase configuration. All phase values remain inheritable and mutable, and every imported genome retains its stored phase settings without modification. This is a **founder-gene calibration**, not a physical-body displacement correction, automated steering controller, or organism-level selection rule.

With the real recurrent controller and Rapier physics, newly spawned planar founders achieved **+1.346**, **+1.295**, and **+1.415 m** of signed mouth-first COM progress over eight simulated seconds in isolated food-free trials (seeds **4242**, **17**, and **2026**). Their corresponding charged chemical motor work was **43.93**, **46.57**, and **53.01** units. A six-second full 14-creature seed-4242 world produced **+0.611 to +1.039 m** of mouth-first progress across its five planar founders, with a conserved chemical ledger. The 20-second live recurrent-control test also preserves sustained positive mouth-first strokes.

**Not all founders swim mouth-first:** the current nonplanar serpent still has **−1.089 m** of signed frontward movement in the eight-second seed-4242 reference. Simply reversing the serpent's phase progression reduces locomotion to **+0.138 m**, so that genotype deliberately remains unmodified. The fin-tail's independently evolved blades already produced **+0.229 m** initial-face-forward signed progress in the same measured reference. All observations distinguish measured swimming from actual autonomous food seeking, which remains unproven.

The tests do **not** choose reproductive winners, influence mutation probabilities, set environmental targets, or assert that a trial's fastest configuration is ecologically beneficial. Different environments, a real food-reaching test and selection through funded reproduction are later work.


## Limits

Fresh planar founders have a corrected mouth-first rhythmic phase progression; serpent and fin-tail founders retain their existing inherited rhythms. Historical genomes still execute their own stored phases. New direct-control genotypes need an evolved neural signal that varies appropriately in time; the ability to disable rhythm **does not automatically make the default creatures faster**. Normal-only drag, real motor work and energy conversion are unchanged. Long-run ecology and more useful swimming selection remain future work.
