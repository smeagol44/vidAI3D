# Thin plate morphology and fin articulation — VIDA 3D v0.2.4

> **Next result:** v0.2.5 adds heritable, phase-coupled power/recovery timing with a measured 20-second same-geometry net-distance and energy advantage. See [FIN_POWER_RECOVERY.md](FIN_POWER_RECOVERY.md). The negative symmetrical-fin measurements below remain the original v0.2.4 historical evidence.

## Scope and assumptions

This phase enables **real, sub-voxel physical thickness** of a part without changing the voxel-grid length/width or abandoning a single Rapier world. The user requested thinner, wider parts and independently articulated fins as a locomotion direction. Existing published six-link swimmer founders remain unchanged until faster motion is demonstrated through living-ecosystem tests. No 2D code was changed.

A `VoxelPartGene` has a new **optional** `thicknessScaleY` (valid range `0.15..1`), which multiplies the **physical local Y** dimension, after applying the legacy 0.3m integer grid. Existing DNA with the field omitted is interpreted as `1`, with unchanged old geometry and cost. A 1×1×2 voxel part with `thicknessScaleY = 0.2` becomes **0.3 × 0.06 × 0.6 m** in physics and on screen. It is not a flat, massless plane and never bypasses collisions.

The same `partPhysicalSize` is consumed by Rapier cuboids (mass/inertia at fixed density), `faceAnchor` and rest OBB/validity checks, world spawning, the water resistance model (actual cuboid surface areas and rotational resistance), and the renderer. Construction energy uses actual physical volume expressed as voxel equivalents; capacity, upkeep and funded offspring follow from that. Mouth aperture offsets and visual overlays use the actual Y dimension, too. Thin body segments are ordinary inheritable DNA; a non-root part can mutate the scale by at most 0.2 per mutation event with a valid lower bound. Existing genomes are not rewritten.

## Two-axis fin kinematics

A physical fin can consist of an inner powered stalk and an outer thin plate linked by **two independent revolute joints with perpendicular axes**, e.g. a Y-axis sweep and a Z-axis pitch/feather. Both are genuine ordinary gene-defined hinges and receive their own four neural motor outputs (angle offset, phase/frequency, torque allowance, stiffness). Rapier constrains the hinge anchors; normal-only hydrodynamics turns actual rigid-body velocities and orientations into forces. This is not a kinematic shape animation, a fictional fin impulse, or a new hidden actuator. The construction is tested as a 5-part custom genome rather than added blindly to all existing starters.

## Verification and locomotion evidence

`tests/thin-fins.test.ts` exercises real Rapier mass, local dimensions, hinge anchor placement, independently oriented joints, motion under a 1/120s physical step, volume-cost difference, validation of invalid scales, inherited mutation and the full recurrent ecosystem including the chemical energy ledger.

The controlled seven-second isolated live-recursion fin sweep gave:

| Outer Y thickness | Trial details | Maximum forward distance in sampled phases |
| --- | --- | ---: |
| 0.06 m (0.2 scale) | Two independent Y/Z hinged fins with several phase offsets | 0.0049 m |
| 0.15 m (0.5 scale) | Same | 0.0087 m |
| 0.30 m (1.0 scale) | Same | 0.0131 m |

These candidates remain **too slow**. At the thinnest scale, some variants spent **~70–105 chemical reserve units in seven seconds** and moved only millimetres forward. Closed-system conservation residuals were ~1e-11 units and joint anchor gaps remained below 0.003 mm in the sampled fixtures. Therefore **no claim of faster swimming**, viable foraging or solved three-limb locomotion is made.

The preceding research branch [PR #5](https://github.com/smeagol44/vidAI3D/pull/5) also tested 228 broad single-joint variants, 288 two-joint variants and 84 six-link fins without producing a beneficial general morphology. This phase supplies the missing physical thin-plate capability, but further gait/brain design is necessary to obtain a real biological advantage. In particular, active feathers may need asymmetric power/recovery phase or controllable pitch in response to external water forces. No lift or fictitious thrust was added. Additional work should benchmark net **body lengths per second** and **distance per energy spent**, not path length alone.

Limits: only **local-Y** thinness is supported; the genetic X and Z dimensions remain integer voxel multiples. True freely oriented plates/continuous widths, two-axis joint coupling integrated into viable founder designs, and extensive collision robustness for large evolved appendages remain future scoped changes. Headless physics tests do not establish browser/WebGL visual quality.
