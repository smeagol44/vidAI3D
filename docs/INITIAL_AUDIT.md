# VIDA 3D initial audit

The current game has real articulated state and applies the requested cuboid drag equations, but it does not yet have a complete revolute-joint solver or a useful calibrated swimmer. Its chemical energy accounting also cannot support trustworthy evolutionary conclusions. Preserve the voxel presentation and the useful interfaces; repair the simulation foundation before adding more ecological complexity.

## Scope and identities

- Imported archive: `project-files (20).zip`; SHA-256 and every original file hash are in [import-provenance.json](import-provenance.json).
- Published baseline: [`927b377`](https://github.com/smeagol44/vidAI3D/commit/927b377020a235fb00d0ab46f292cf39de3d5ccb).
- Current 2D reference inspected: [`7ff4900`](https://github.com/smeagol44/vidAI/tree/7ff4900904db9448d792510b81a849b5177591a4), version 0.6.1. This supersedes the older ZIP and the 0.3.0 repository state inspected before the task paused. The final source comparison includes new face slots, contacts, safe hatching, optics, internal senses and audio controls. No 3D measurement depends on 2D execution.
- The first import changed only the entry point's CSS import and TypeScript exclusions among supplied files. Added files provide Vite, local Tailwind CSS, dependency locking, documentation, and Pages deployment. All seven production simulation modules remain byte-for-byte identical to the archive.
- This audit adds an executable diagnostic script and documentation, not gameplay repairs. The initial Pages workflow deliberately checks buildability, not successful swimming.

## Evidence and limits

`node --import tsx scripts/audit.ts` calls the production modules used by the app. [audit-baseline.json](audit-baseline.json) contains raw results, source hashes, fixture conditions, and the reference commit. `npm run audit` is the convenient equivalent after dependency installation; use `npm run --silent audit > results.json` for pure JSON.

Executed: all ten supplied verification cases; isolated neutral-controller swimmers for 30 simulated seconds; a zero-drag and rotated reference; a torque-free asymmetric cuboid; isolated feeding, life-cycle, validation and identity probes; 60-second default ecosystems at seeds 4242, 71 and 1901, plus 300 seconds at seed 4242. These are bounded diagnostics, not a claim of indefinite ecosystem stability.

The published HTML, CSS, JavaScript, menu and start action were reachable. GitHub Actions run [39357753399](https://github.com/smeagol44/vidAI3D/actions/runs/39357753399) completed successfully. The cloud browser reports `GL_VENDOR = Disabled` and cannot create a WebGL context. Consequently, rendered tank appearance, picking, camera interactions, mobile behavior and visual frame rate were **not validated**. Headless physics results are independent of this browser limitation. The 2D comparison is source review; its existing benchmark claims were not rerun.

In the findings below, **measured** means reproduced in the saved production-module probes; **source** means established by code inspection. Proposed repairs and priorities are recommendations, not completed changes.

## What already works and should be preserved

- The former effective-mass sign error is corrected in this ZIP. Do not reapply the obsolete sign fix.
- Initial joint anchors coincide, force and torque accumulators are used, and body orientations have actual angular velocities. The original pose-copying and invented reaction-force propulsion are gone.
- Motors-off rest and zero-drag linear COM conservation pass. The neutral planar reference's rotation covariance error was about `3.3e-15 m`.
- A normal-speed accumulator, lazy ecosystem initialization and an organism-construction API exist. Normal 1×/2×/5× clock arithmetic is essentially frame-rate independent when there is enough compute, apart from fixed-step rounding.
- All three mouth diet permissions now work in isolated checks. Omnivores have half the corresponding specialist rates. Mouth face placement is shared with feeding; live predation subtracts reserves first; self-biting and own-egg eating are excluded.
- Inherited body pigment is independent of mouth type. The recurrent 24-neuron core, camera presets, follow mode, specimen export, per-mouth inspector and feeding-event data are useful foundations.

## Measured movement

Neutral outputs held at zero, production inherited oscillators active, still water, no contacts, 30 seconds:

| Founder | Net COM travel | COM path length | Maximum anchor gap | Maximum hinge-axis mismatch |
| --- | ---: | ---: | ---: | ---: |
| Planar swimmer | 0.1444 mm | 0.3350 mm | 0.00437 mm | 0° |
| 3D serpent | 0.0884 mm | 0.1387 mm | 0.00923 mm | 178.51° |
| Tri-limb | Approximately zero | Approximately zero | 0.00856 mm | 0° |

The planar body is 2.4 m long in its initial straight assembly. Its net travel is only about `0.000060` body lengths. The requested target was one body length in 30 seconds. The existing planar and nonplanar propulsion tests both fail; their rounded display of `0.00 m` conceals the small nonzero values.

The planar target excursion is 1.885 rad peak-to-peak, while the measured joint ranges are about 0.199 and 0.200 rad. The motor/body/fluid combination does not realize its commanded stroke. This establishes a calibration problem without proving that any one coefficient alone is responsible. The tri-limb has a symmetric inherited gait and essentially no neutral COM motion; it is not an independently validated reference swimmer.

## Findings and recommended dispositions

### Physics and locomotion

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A01 | Critical | **Incomplete revolute joints.** `RevoluteJoint.solveVelocityAndPositionConstraints` constrains the anchor and limits one Euler-derived angle, but never locks the other two angular DOFs or aligns the two hinge axes. The serpent reaches 178.51° axis mismatch while its anchors remain close. Measured and source. | Replace the custom constraint/integration layer with an established rigid-body solver, preferably Rapier as originally requested. A complete custom hinge would require substantially more solver work and verification. |
| A02 | Critical | **No calibrated useful swimmer.** Both production swimming tests fail. Actual planar strokes are about one tenth of the target excursion and travel is negligible. Measured. | After A01, calibrate mass/inertia, joint control response, frequency, phase, stroke and drag together using one named founder. Measure body lengths and displacement per cycle. Preserve the analytical drag model; do not add thrust or target-coordinate steering. |
| A03 | High | **Incorrect general free-body rotational dynamics.** An asymmetric torque-free cuboid with initial angular velocity (1,2,3) has an 85.6% maximum relative world angular-momentum error over 10 s. The integrator holds world angular velocity without the necessary asymmetric-body dynamics. Measured. | Let the chosen solver integrate rotation and angular momentum. Avoid maintaining a second independent body state integrator. |
| A04 | High | **No solid inter-organism or self contact; tank handling clamps each body's centre separately.** Dimensions/orientation do not define wall contact, and per-part position changes can separate anchors. Source: `containInTank`, production physics. | Add cuboid colliders, tank boundaries and adjacent-body collision exclusions through the authoritative solver. Use safe nonoverlapping spawn placement. Keep locomotion acceptance tests contact-free. |
| A05 | High | **Attachment frames do not establish valid face-to-face anatomy in general.** Placement makes anchor points coincide but rest orientation is only a rotation around the named hinge axis. Arbitrary parent/child face pairs can penetrate or point into the same space; generated mutations do not test collisions. Source: `initPhysicsHierarchy`, `mutateGenome`. | Define face frames and opposing normals, a topologically ordered construction and nonpenetrating rest configurations. Resolve geometry before creating bodies. |
| A06 | High | **Numerical safeguards are incomplete.** `updateCOM` checks only NaN in x position/velocity, not all components, infinities, orientations or neural values. Velocity clamps occur before constraint impulses, and impulse clamps conceal rather than diagnose solver failure. Source. | Validate all authoritative state, record diagnostic failures and bound work consistently. Keep clamps as explicit emergency guards; do not count clamped motion as verified physics. |

### Energy, reproduction and ecology

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A07 | Critical | **Hatching creates unfunded tissue and records an internal transfer as external energy.** A 140 J egg becomes 140 J reserve plus 100 J tissue; `addOrganism` also adds 350 J to external input. Measured isolated hatch. | Separate external spawning from internally funded births. Allocate egg energy between construction and usable reserves; damaged eggs must fund the body or become nonviable. |
| A08 | Critical | **Decomposition can create energy.** A dead organism with 100 J tissue and zero reserve produces four 35 J nutrients: 140 J. Remaining reserves are otherwise discarded without accounting. Measured. | Transfer the actual available tissue/reserve budget into remains, conserving leftovers and recording genuine losses. |
| A09 | Critical | **The ledger is not a conserved chemical budget.** Basal upkeep and trophic losses are not accumulated; the displayed work sums mechanical joules while reserve cost is multiplied by 0.005. Work disappears from the ledger when the organism is removed. A motor-off organism loses 0.4 J in one second while reported dissipation stays zero. Measured and source. | Keep cumulative basal/sensory/motor heat and explicit losses independent of living organisms. Define the motor conversion's units. Display a residual error using unrounded internal totals. |
| A10 | High | **Morphology has essentially free economic scaling.** Every founder starts with 250 J reserve and 100 J structural energy regardless of part count/volume; base upkeep is a fixed 0.4 J/s and sensing has no separate cost. There is no storage-capacity field or upper reserve bound. Source. | Derive construction, upkeep and capacity from documented geometry/organ costs. Increasing starting reserve is a calibration choice, distinct from adding larger storage. Do not copy 2D joule constants without reconciling the 3D scale. |
| A11 | High | **Short-term survival is being mistaken for sustainable evolution.** Seed 4242 has 14 living founders at 60/120 s, no offspring, then zero organisms/eggs by 180 s; all 14 deaths are recorded. Seeds 71 and 1901 retain their founders at 60 s, with one birth only in 1901. Measured. | Repair locomotion and accounting first, then balance encounters, intake, lifespan and reproduction. A 60-second survival flag does not establish a functioning multigeneration ecosystem. |
| A12 | High | **Life history and egg viability are shallow.** Reproduction has a fixed reserve threshold/cooldown and one lump-sum egg, with no construction allocation, maturity state, clutch-budget reasoning, starvation endurance policy or damaged-body viability check. Hatching has no whole-newborn obstacle clearance test, allowing interlocked births. Eggs/nutrients have no physical motion. Source. | Adopt funded reproduction, safe whole-body hatch clearance and explicit eligibility telemetry before adding clutch/growth complexity. Decide whether suspended resources are intentional. Keep asexual reproduction unless another model is requested. |

### Mouths and feeding

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A13 | High | **The visible aperture is not the feeding contact geometry.** Feeding uses a front-filtered sphere and target centre radii. A long prey surface 0.01 m from the mouth is missed, while a nutrient 0.52 m sideways is eaten despite lying beyond the rendered plate. Measured. | Use one mouth aperture/contact representation shared by feeding and overlays, intersecting actual oriented target geometry. Retain the corrected diet permissions and face placement. |
| A14 | High | **One mouth has separate simultaneous budgets for nutrients, eggs and prey.** An omnivore can remove 80 J in one second across all three categories, absorbing 70 J. The 2D model has one shared per-mouth allowance. Measured. | Apply one documented time-scaled intake budget per mouth, with the omnivore trade-off and any source-specific efficiencies. Bound intake before removing source energy. |
| A15 | High | **Predation lacks correct death attribution and scavenging.** It drains reserves only, skips reserve-empty prey, and relies on the victim's later lifecycle update for generic death/removal. There are no death causes or edible carrion categories. Source. | Record lethal predation at the causal bite. Add conserved remains and dietary scavenging when repairing A08; tissue injury/regrowth would be a separate feature, not something 2D already solves. |

### Vision, brains and evolution

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A16 | High | **Vision is a distance-to-centre approximation, not actual surface ray intersection.** Fixed 0.6/0.7/0.8 m target radii ignore rendered nutrient size and cuboid dimensions/orientation. A ray 0.5 m sideways from a 0.35 m nutrient still sees it. Source selection uses centre distance, so correct nearest-surface occlusion is not guaranteed. Measured and source. | Raycast against actual world geometry, returning nearest hit distance, point, type and RGB. Share results with the overlay. |
| A17 | High | **`eyeFace` and `eyeFov` are ignored.** Both sensors and drawn eyes/rays assume −Z and a fixed cone; sensing starts at the body centre. Changing the eye face and FOV leaves all inputs unchanged. Measured and source. | Share a face-aware eye frame between sensing and rendering; cast from the eye surface using the declared FOV and range. |
| A18 | Medium | **No sensed distance attenuation or retained hit data.** The same nutrient at 2 m and 15 m returns identical RGB. Only RGB is retained; the ray overlay always runs to maximum range, with a different fallback range from sensing. Measured and source. | Add the desired distance signal/attenuation and show actual hit endpoints. Follow current 2D optics: black empty retinal space, white physical eggs and attenuation toward black. Preserve the already invisible 3D walls. |
| A19 | High | **Mouth feedback is allocated but unwritten, and physical-contact inputs are always zero.** Input counts reserve a channel per mouth, but `populateSensoryInputs` supplies no oral event. The new feeding events are UI data only. Aggregate actual-feeding and normalized COM depth inputs from current 2D are absent. Source. | Define stable channel identities and supply causal edible-contact/absorbed-intake feedback, an actual-feeding flag and normalized depth. Real contact sensing depends on A04. Energy reserve sensing already exists and should be preserved. |
| A20 | High | **Brain channels are positional and matrix sizes are fixed.** Inputs are initially provisioned with 60 weight columns and outputs with 20 rows; runtime layout depends on anatomy, without identity-based remapping when parts are removed/added. Seven-part organisms need 24 motor outputs. Source. | Use anatomy-derived stable IDs and remap weights and memory across structural mutation. New organs must receive valid channels without shifting old meanings. |
| A21 | High | **Motor-output weights/biases never mutate.** The 500-child sample changed zero output-weight matrices; the mutation routine changes input/recurrent weights and hidden biases only. Mouth/eye traits and metabolism also have no mutation path. Source and measured output-weight sample. | Extend inherited mutation deliberately, including output pathways and valid organ/life-history traits. Preserve bounded values and record mutations. There is no implemented within-lifetime synaptic plasticity to preserve. |
| A22 | Medium | **The controller has less authority than current 2D.** Four outputs cover offset/frequency/torque/stiffness; oscillator amplitude is fixed, there is no neural engagement channel or command smoothing, and a finite tanh output does not normally command an exact zero torque allowance. A runtime `motorsEnabled` flag does correctly disable actuation. Source. | After physical calibration, consider 2D's amplitude/engagement channels and response ramps. Treat brain-schema migration as part of that change. |

### Identity, validation and persistence

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A23 | High | **Genome validation does not validate an articulated genome.** Fractional dimensions, multiple roots and a disconnected parent cycle all pass. It does not enforce finite complete neural/metabolic values, integer dimensions, root-first construction or full reachability. Measured and source. | Validate data before constructing bodies or replacing state. Separate schema validation, topology, channel shape and geometric validity. Adapt 2D shared surface-organ slots to six faces when that anatomy extension is selected. |
| A24 | High | **Failed mutation returns the exact parent object and ID.** Ten of 500 generated children reused the parent object and ID. This can create offspring sharing an identity with a living parent and can alias mutable data. Measured. | Revert rejected traits on an independent child with a new runtime identity; never return a parent instance as its offspring. |
| A25 | High | **Genome IDs are used as runtime organism IDs.** Spawning one saved genome twice produces two organisms with the same selection/React key and the same genome object. `addOrganism` itself does not enforce the population cap. Source and measured duplicate spawning. | Separate unique runtime IDs from inherited genome/lineage IDs, clone spawn data and enforce the cap in the common API. Make counters' units explicit: founders, births, particles eaten and joules consumed are currently mixed or inconsistently named. |
| A26 | Medium | **Reset is neither reproducible same-seed restart nor explicit new-seed creation.** It continues the current PRNG/ID counter; UI says “New Seed” but no new seed is chosen or shown. Pioneer type/ID also uses `Math.random` and `Date.now`. Measured reset and source. | Store/display a seed and define restart versus new seed. Use world-owned deterministic identity/type selection where reproducibility is intended. |
| A27 | Medium | **No world save/load, validated genome import or durable specimen bank.** The bank is React state and genome export only; reload loses the bank, and snapshots cannot preserve PRNG, joint phases or recurrent activations. The imported Upload icon is not an import implementation. Source. | Add versioned, validated persistence with exact continuation, then durable specimen curation. Keep this a bounded feature, not a reason to rewrite the renderer. |

### Timing, rendering and UI

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A28 | Medium | **MAX is still eight outer ticks per rendered frame.** Clock replay over 10 real seconds gives 40/80/192 simulated seconds at 30/60/144 FPS. This is a replay of the inspected arithmetic, not a browser benchmark. Source and arithmetic probe. | Use a measured wall-time computation budget. Preserve fixed physics dt; keep normal-speed accumulation, with explicit dropped backlog and requested/achieved speed. |
| A29 | Medium | **Telemetry/render state updates are not bounded.** App sets React telemetry and score every animation frame; scene part transforms then flow through React props. FPS/throughput use counts per timer interval without dividing by the exact interval, and achieved speed is computed but not clearly surfaced. Source. | Update body refs directly per render, publish inspector snapshots at a bounded rate, and normalize counters by measured elapsed time. |
| A30 | Medium | **Rendering allocates heavily and has a hidden nutrient limit.** New vectors, matrices, arrays and edge geometries are created repeatedly. Nutrient rendering always loops over 800 instances, while manual additions/decomposition can exceed 800 actual particles. Vision has no spatial index. Source. | Reuse geometry/math scratch state and choose measured limits/instancing. Make logical and visible counts agree; profile before moving computation to a worker. |
| A31 | Medium | **Mouth overlays misrepresent contact.** The cylinder primitive runs along local Y, its reach is translated along +Z, and ±Z mouth frames point that reach opposite to the outward feeding normal. Unfed mouths also flash during the first 0.25 s because missing timestamps default to zero. Source and orientation probe. | Draw the actual A13 aperture/contact region, orient it from the shared frame, and require an actual feeding event before highlighting. |
| A32 | Medium | **The brain inspector is incomplete.** It hides every input after the first 24 and labels channels with indices. The synapse threshold only updates its label/slider; no connection graph uses it. Source. | Show all semantic inputs/outputs and real weighted connections, with a working filter. Preserve the recurrent-state view. |
| A33 | Medium | **Window and camera handling lacks the 2D safeguards.** Panels are mostly fixed rather than movable/resizable. The camera listens to window pointer/wheel events; only some UI is marked `.ui-layer`, and wheel input is not filtered for panels. Source. | Bound/scroll panels within the viewport and scope camera gestures to the canvas. Validate touch, pinch, drag cancellation and small screens when WebGL QA is available. |
| A34 | Medium | **Most exported ecological configuration is not connected to an independent UI.** Only water drag is read into the simulation at initial construction; inflow, target and population retain class defaults. No live environment settings screen exists. Source. | Add one validated settings state applied to the production kernel; include seed, drag, nutrient input and population before considering gravity/other experiments. |

### Verification, presentation and cleanup

| ID | Priority | Finding and evidence | Disposition |
| --- | --- | --- | --- |
| A35 | High | **Verification descriptions overstate their assertions.** The 60-second case checks only population > 0 and a finite rounded energy sum, yet says founders swim smoothly and feed. The anchor test exercises only the planar founder. “Kin Protection” tests own eggs, not siblings. Verification runs synchronously on the UI thread, and several cases share one PRNG. Both locomotion cases actually fail. Source and measured. | Turn each repaired invariant into focused production-module regression tests. Separate rest, hinge validity, controlled swimming, neural response and ecology. Yield/report progress for interactive diagnostics; retain failing evidence. |
| A36 | Medium | **Unsupported-platform errors are not handled.** Canvas has no explicit unsupported-WebGL fallback; the test cloud browser cannot render it. Music remains an external Google URL and audio availability was not verified. Source and browser observation. | Add clear startup/error states, then validate on a WebGL-capable browser. Preserve optional audio, handle loading failure and consider local licensed assets later. |
| A37 | Medium | **Descriptions and legacy scaffolding promise more than the code provides.** The guide/design claim exact occluding vision, physical revolute joints and a closed funded ledger. Fake SDK lifecycle/RPC, unused imports/helpers and the export type shim remain. Source. | Correct claims to match measured behavior. Remove unused Playground scaffolding once direct startup is covered; retain provenance and third-party notices. Keep useful voxel/camera/UI code. |

## Recommended sequence for a decision

1. **Physics foundation:** A01–A06 plus a calibrated named swimmer and honest invariant checks. Prefer replacing the custom solver, keeping the drag functions, genomes, brain and presentation behind a body/joint adapter. This is the proposed next implementation scope, not approval already granted.
2. **Energy and ecological integrity:** A07–A15. Define mass/construction/reserve/capacity/heat separately, fund births and remains, then retune encounter/intake/reproduction balance. Do not mask failures with hidden reserves, invulnerability or replacement creatures.
3. **Trustworthy perception and feedback:** A16–A22. Make surfaces, eye frames, channels and actual motor authority consistent before claiming learned hunting or food seeking.
4. **Identity and persistence:** A23–A27. Some identity/validation fixes may be prerequisites of earlier work; full save/load should precede long evolutionary experiments.
5. **Observation and performance:** A28–A37 and selected gaps in [FEATURE_PARITY.md](FEATURE_PARITY.md). Prioritize real mouth/ray/brain information and usable settings/windows; avoid a general interface redesign.

The order is driven by dependencies. Mouth colors and more panels cannot fix locomotion; more initial energy cannot correct an unfunded egg; a large travel value is not swimming if hinges or momentum fail. None of these proposed gameplay changes was implemented during the import/audit task.
