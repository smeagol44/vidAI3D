# Fin-tail founder — VIDA 3D v0.2.6

## Decision

Replace the *default spawn-slot* used by the nearly immobile `tri_limb` with an **independent, evolvable `fin_tail` founder type**. The historical `tri_limb` constructor and imported/saved genomes remain unchanged; only the default 14-founder mix now alternates planar, nonplanar serpent, and fin-tail. Four of 14 default specimens use the new type. It is a **locomotion-capable starting morphology**, not a claim that its predators can hunt, reproduce reliably, or survive generation after generation. Feeding, perception and lifetime-learning behavior are unchanged.

This selection followed 33 deterministic production-path candidates, a 24-case phase/mirror check, and 3-brain/real neural steering checks, all through `WorldSimulation.stepOuterTick()` with Rapier. Discarded broad exploratory test code was not merged; measured outcomes and focused regression tests are retained.

## Mutable anatomy and motors

The new founder contains seven ordinary dynamic cuboids:

- One original large eye/mouth-bearing, pigmented `tri_limb` root, retaining the same carnivore mouth and eye semantics
- Two side motor stalks hinged on the Y axis; each stalk has 800 N·m max inherited torque, 0.65 Hz default frequency, and a 25%-cycle positive/power sweep
- Two linked axial tail segments behind the root, each a 1×1×3-voxel cuboid with Y hinges, 400 N·m motor torque and inherited half-π phase spacing
- Two physically thin outer blade plates, each 1×1×4 voxels and 0.2× local-Y thickness (0.06 m), hinged on a perpendicular Z axis. Their ±1.35-radian rest/power face orientations and ∓1.35-radian return feather-pitch traits are inherited and mutable

The body uses **six actual revolute joints and 24 neural outputs** (four channels per joint). Previously the three-part reference needed only eight active motor outputs; the starter brain now initializes the necessary additional output rows with real sparse, mutable synapses. No physical thrust is fabricated, no pose/velocity is teleported, and no power is free: motor work, chemical heat, tissue construction and storage capacity follow the same production paths as all other organisms.

## Measurements

### Single-body living closed-water test (18 simulated seconds)

All cases have a real recurrent controller and sensor updates, two Rapier steps per 1/60-second ecosystem tick, normal-only resistance, no food/contacts, and no artificial energy replenishment.

| Different inherited brain seed | Original 3-part `tri_limb` net (m) | New `fin_tail` net (m) | New fin-tail signed +forward (m) | Chemical reserve spent | Remaining reserve |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4242 | 0.025 | 0.859 | 0.687 | 148.42 | 333.58 |
| 6001 | 0.009 | 0.721 | 0.593 | 144.96 | 337.04 |
| 9037 | 0.014 | 0.675 | 0.452 | 139.51 | 342.49 |

The original 3-part baseline uses the same 18-second simulated time and deterministic seed family; the new positive signed component is measured along initial root -Z. The new body remains more expensive and slower than the existing efficient six-link swimmers. It still curves: unsteered yaw in the isolated 18-second runs ranged about **0.83–1.28 radians**, with side and vertical drift. These are measured flaws, not improvements hidden by net path metrics. All new specimens remained alive with normal reserve depletion, stable physical hinges, and conservation residual near 3×10⁻¹¹ chemical units.

### Neural steering authority is real but not learned navigation

Test-only controlled differential offsets were fed into the **two existing fin-pitch neural output channels**, leaving the other recurrent neural outputs operational. No body force or rotation was imposed. Across the same three brain seeds, over 12 simulated seconds:

| Brain seed | Left-command yaw (rad) | Right-command yaw (rad) | Uncontrolled yaw (rad) |
| --- | ---: | ---: | ---: |
| 4242 | -0.277 | +0.333 | +0.882 |
| 6001 | -0.013 | +0.303 | +0.844 |
| 9037 | -0.130 | +0.263 | +0.651 |

These commands move heading on opposite sides of the initial heading in each tested seed (some turns are **very weak**), but consume energy and frequently reduce longitudinal progress. They establish **motor-level bidirectional control**, not that an untrained brain will learn to keep a course or steer toward food. Also, no universal turn rate is guaranteed across arbitrary mutated genomes.

### Default 14-creature world

A fresh `WorldSimulation(4242,14)` now includes exactly **four** fin-tail founders. All four spawned through normal clearance and remained stable in a six-second full-tank run, moving about **0.214–0.262 m** each without reserve exhaustion. The complete world kept a near-zero chemical-energy residual (~-7.3×10⁻¹²). Published build and tests do not imply this short scenario certifies collisions, multi-generation reproduction or real-time rendering on every machine.

## Follow-up

The next locomotion challenge is to reduce default curved swimming while preserving net progress, ideally using genetically adaptable differential blade pitches and relevant sensory/heading feedback—not a built-in "go straight" rule. More comprehensive ecological studies must examine carnivore access to prey, energy replacement by eating, egg reproduction, lifespan, realistic population/part-count throughput and evolved genome stability.

The separate 2D VIDA repository was not modified. No manual browser/WebGL exploration was undertaken.
