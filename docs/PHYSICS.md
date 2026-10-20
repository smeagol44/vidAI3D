# Physics foundation, v0.2.0

> **Historical foundation baseline:** the calibrated physical-only measurements below remain the v0.2.0 references. The subsequent live-brain phase-coordination and mutable founder-prior repair is documented in [PROJECT_STATUS.md](PROJECT_STATUS.md) and [live-locomotion-results-0.2.1.json](live-locomotion-results-0.2.1.json); it does not redefine or erase the original isolated reference evidence.

> **Current live locomotion:** v0.2.3 uses six-link planar/nonplanar founding gaits and a six-link serpent with an X hinge. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the real recurrent-brain speed benchmarks. The original v0.2.0 3- and 4-link reference anatomy, measurements and calibration tables below remain historical records; they are not the current founder defaults.

Rapier 0.21.0 replaces the custom rigid-body integrator and constraint solver. Every part, including the root, is dynamic in one shared ecosystem world. Rapier owns poses and velocities; rendering and senses read snapshots. Physics uses metres, seconds, kilograms, newtons and newton-metres, with zero gravity and initially still water.

Both attachment faces determine the rest orientation and coincident anchors. Separate local hinge frames preserve the same world axis even when attachment faces differ. Rest geometry is validated before construction. Physical joints enforce anchors and limits. Only adjacent connected-body contacts are disabled; other bodies and all six walls participate in contacts. CCD is enabled, though the tests do not establish universal collision robustness for every possible evolved anatomy.

The original analytical integrated normal-only cuboid resistance formula is unchanged. Actual COM/angular velocity is transformed into each body's local frame, and the resulting forces/torques return to world space. Persistent Rapier force accumulators are reset every substep. There is no artificial thrust, unrelated damping, child pose overwrite or parent-velocity copy.

## Calibration

| Parameter | Value |
| --- | --- |
| Voxel edge | 0.3 m |
| Density | 1,000 kg/m³ |
| Normal resistance coefficient μ | 250 kg/(m²·s), configurable 0–1,000 |
| Outer tick / physical step | 1/60 s / 1/120 s |
| Solver iterations / internal PGS iterations | 12 / 2 |
| Inherited frequency | 0.65 Hz |
| Maximum torque / neutral allowance | 400 / 200 N·m |
| Neutral stiffness / damping | 450 N·m/rad / 60 N·m·s/rad |
| Stroke amplitude | 45% of angular range |
| Planar template | Three 1×1×3-voxel links; two Y hinges; phase offsets π/2, π |
| Nonplanar template | Four 1×1×3-voxel links; Y/X/Y hinges; offsets 0, π/2, π/2 |

The old resistance value of 3.5 was too weak for this density and gait. Calibration changes **new founder templates**, including uniform planar links and expansion of the serpent from three to four links. The trilimb retains its geometry with a phase shift to break stroke symmetry. Imported genomes keep their parameters; they are not promised the reference performance. Invalid or initially penetrating assemblies fail validation.

The four recurrent outputs per hinge control angle offset, frequency, torque allowance and stiffness. Frequency modulation changes the derivative of a continuously integrated phase. Allowance zero, motor disable and exhausted reserves each produce exactly zero active torque. PD torques are bounded and applied equally/oppositely to the bodies; Rapier supplies passive joint reactions.

Mechanical expenditure is the absolute active torque times the trapezoidal relative angular displacement, in joules. Passive constraint/limit impulses are excluded. The existing **0.005 reserve units per mechanical joule** remains an explicitly retained game-economy conversion, not a physical muscle-efficiency claim. A full chemical-energy model is pending. References start with the normal 250 reserve units and receive no refills.

## Measured outcomes

Measurements use fresh isolated production organisms and independent PRNGs, neutral recurrent modulation, inherited gaits and no walls/food/other creatures. Biology is not advanced in these physical references. Reference contact samples are zero.

| Measure, 30 simulated seconds | Planar | Nonplanar |
| --- | ---: | ---: |
| Assembled straight body length | 2.70 m | 3.60 m |
| Mass-weighted COM net displacement | 3.5500 m | 1.4286 m |
| Net displacement / body length | 1.3148 | 0.3968 |
| COM path length | 3.5651 m | 1.4676 m |
| Maximum anchor gap | 0.0406 mm | 0.0318 mm |
| Maximum hinge-axis error | <0.00002° | 0.0140° |
| Maximum limit overrun | 0.001046 rad | 0.000318 rad |
| Maximum part speed | 0.951 m/s | 1.196 m/s |
| Ending reserves | 190.12 | 140.79 |

The planar reference completes 19 cycles, with settled per-cycle net displacement about 0.193–0.194 m. Raw per-stroke values and work appear in [physics-results-0.2.0.json](physics-results-0.2.0.json). Nonplanar articulation reaches a tetrahedral height of 0.3831 m between the four body centres. Its acceptance threshold is 0.5 m travel, not one whole body length.

With μ=0, the same active planar assembly drifts only 0.0441 mm over 30 seconds; final linear momentum magnitude is below 0.001 kg·m/s. Tests require drift below 1 mm and momentum below 0.01 kg·m/s. Motors-off remains stationary over one second with zero work. Rotating the setup rotates its displacement within 1 mm over three seconds. Reference hinge tests require gaps below 5 mm, axis errors below 0.01 rad and limit overruns below 0.02 rad. These are numerical tolerances, not exact-conservation claims.

## Timing and verification

`SimulationClock` is the scheduler used by App and tests. Normal modes accumulate elapsed real time times requested speed, then execute fixed outer ticks and two physical steps each. Work has a 6 ms frame budget, a 256-tick ceiling and a 0.25 s backlog cap. Long frame intervals are capped at 0.1 s; discarded time is counted. MAX consumes the computation budget rather than a fixed tick count. The HUD reports measured achieved speed and physical steps per real second.

Pause prevents every simulation tick, including feeding/inflow/incubation, and retains fractional clock and neural/oscillator state. React telemetry refreshes at most 10 Hz; mesh transforms copy physical snapshots each render. Rapier initializes asynchronously before App construction. Its embedded WASM adds a separately cached chunk of approximately 1.64 MB gzip.

`npm run test:fast` runs 20 focused tests. They cover formulas, mass/inertia, face geometry, malformed anatomy, joint frames, active/disabled swimming, momentum, out-of-plane movement, rotated covariance, phase wrapping, contacts/walls, shared-world stepping/disposal, asymmetric spin and the actual recurrent-controller startup. Scheduler tests cover pause, overload and computation-budgeted MAX. Full body poses, velocities, phases, neural outputs and reserves match across 30/60/144 rendering rates and 1×/2×/5× normal speeds for equal simulated time. `npm run build` checks TypeScript and production bundling. CI performs both commands.

Browser interaction, camera/picking, mobile rendering and the published WebGL experience were **not manually tested**, following the user's instruction. Compilation and production-kernel tests do not prove those visual interactions. No browser was opened for this repair.

## Limits and follow-up

The 14-founder production-brain startup check covers 0.2 simulated seconds, not ecosystem sustainability. Controlled inherited swimming does not establish learned navigation or food seeking. Existing hatch/decomposition/ledger, perception, mouth/contact, identity and mutation/channel-remapping findings still need work. Do not interpret the physical reference results as ecology verification.

Spawn validation checks each oriented body and tank containment against existing parts; it is not the complete 2D whole-envelope/interlocking prevention feature. Mutations that generate invalid anatomy can remain unhatched; robust evolutionary repair is separate work. Specimen JSON validation remains incomplete outside the physical-layout checks. Energy conservation should be repaired next, then perception/mouths and observation UI, in bounded changes directed by the user.
