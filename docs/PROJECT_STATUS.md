# VIDA 3D project status

## 2026-10-20 — v0.2.8 Phase A: measured mortality and finite, funded survival calibration

A deterministic 45 simulated-second default 14-founder world on v0.2.7 had **14 alive at 10 s**, **11 at 40 s**, and **9 at 45 s**, with **0 eggs laid**. Planar/serpent founders began with 314 reserve and fin-tails 482. Basal costs were 0.557/0.641 chemical units per second, but six-link motor costs reached ~230–254 units by 30 s for several founders. Total real-mouth food intake across the world was ~305 units in 45 s, insufficient to support all organisms; age expiry was 160 s and not a plausible cause of early death. Five-fold simulation speed would compress 45 simulated seconds into roughly nine wall seconds **only when achieved throughput permits**. Energy ledger residual was ~5×10⁻¹⁰.

**Correction:** new externally seeded founders now receive up to **four times morphology construction energy** (bounded by existing storage capacity, and explicitly counted as an external input), rather than two times. Funded eggs now include a newborn reserve equal to at least one construction-energy budget instead of a fixed 60-unit reserve; all funding still comes from the parent and remaining reserve is genuinely transferred on hatch. This is a finite calibration, not a new source of energy or a guarantee of sustainable foraging; the higher egg cost introduces a genuine parent/offspring trade-off. Basal, motors, genome traits, water drag and chemical conversion remain unchanged.

**Causal observability:** lifetime basal/motor spending, egg funding and predation losses are separated from actual food gain. Starvation, physical-bite depletion and old-age deaths are counted and a bounded recent death history exposed; deaths are now processed *after all oral contacts* so an organism consumed late in a tick cannot erroneously survive that tick. The UI inspector and energy ledger expose these values in simulated seconds. A current-only Lifecycle-and-Energy Wiki page documents the implementation.

**Limits:** Any later mortality still requires actual nutrition, locomotion and predator/prey improvements. These changes preserve the existing genome schema, including legacy tri-limb constructor. No change to VIDA 2D or nonphysical survival mechanism.

## 2026-10-20 — v0.2.7 Phase A: UI identity, audio looping and current Wiki source

The visible version now follows `package.json` on the header, start screen and simulation menu, with the exact creator credit. The manual pioneer button offers current planar/serpent/fin-tail starters rather than the legacy default tri-limb, without removing that genotype or changing saves.

The audio component adopts the existing 2D Web Audio decoded sample-boundary trim/equal-power seam technique; HTML audio remains a fallback. New static/synthetic PCM checks exercise version consistency and loop endpoints. Added current-only Wiki source pages for the UI and music and a publishing workflow to update the **actual 3D Wiki repository** after merge.

**Limitations:** The remote track, CORS and audible behavior require real-browser investigation only if necessary; HTML fallback is not gapless by guarantee. This release does **not fix** the ~10-second observed deaths or poor net locomotion: causal diagnosis and correction remain next in Phase A/B. Physics, metabolism, the energy ledger and genome formats were not changed. CI, Pages and Wiki publishing require post-merge verification.

## 2026-10-20 — v0.2.6 independent fin-tail founder with measured neural steering

User-approved next locomotion milestone: integrate the physical thin-plate power/recovery mechanics into a **useful new starting body plan**, and validate sustained swimming and controllable steering across different brains. Following 33 physical fin/tail combinations and 24 further phase/mirror variants, the promising genotype consists of the original tri-limb torso with **two additional axial tail joints and two real Y/Z articulated thin plates**, producing seven dynamic parts and 24 real, mutable neural outputs. It is introduced under the **new type `fin_tail`**, not by rewriting `tri_limb` or any saved DNA. The default 14-creature founder mix now spawns 5 planar, 5 serpent and 4 fin-tail creatures instead of using the almost-stationary old tri-limb slot.

**Living 18-second closed-water tests with three independent neural seeds:** new fin-tail net COM displacements **0.859 m, 0.721 m, 0.675 m** (old three-part tri-limb only **0.025 m, 0.009 m, 0.014 m** in equivalent exploratory runs). New specimens remained alive, with 334–342 reserve units left of 482; longitudinal -Z travel **0.687 m, 0.593 m, 0.452 m**, with noticeable lateral and vertical drift. All physical hinge and world energy-ledger checks passed. **Neural controllability:** injecting test-only differential left/right blade output commands caused opposite signed root yaw in all three brains across 12-second runs, but especially one leftward turn was minimal (-0.013 rad). This demonstrates available steering actuators—not learned prey-following or stable autonomous heading.

**Full-world test:** the new four fin-tail founders spawned and advanced **0.214–0.262 m** each through six seconds in the regular 14-founder shared Rapier world. No founder was removed, hinge gaps remained tiny and the energy ledger residual was effectively zero. Previous six-link planar/serpent genetics and physical drag were not touched. The original named `tri_limb` generator and imported specimens remain intact, but that phenotype no longer occupies default starting slots.

**Important limitations:** the new morphology is more energetically costly than the old tri-limb and still turns substantially during uncommanded swimming. No food-finding, predation, reproduction, multi-generation viability, 14-founder long-duration performance, or visual browser QA is claimed. Detailed anatomy, evidence and follow-ups: [FIN_TAIL_STARTER.md](FIN_TAIL_STARTER.md). Existing v0.2.5 fin controls retain their inherited mutable nature. No fake propulsion, body teleportation or hidden reserve intervention was added. **No changes whatsoever to the separate 2D VIDA repo.**

## 2026-10-20 — v0.2.5 evolvable physical fin power/recovery stroke

The user prioritized sustained faster VIDA 3D locomotion rather than progressing to feeding and perception. After v0.2.4 delivered actual physical thin plates but inefficient fin swimming, this phase added **optional inherited motor stroke duty** (0.2–0.8, legacy 0.5 exactly sinusoidal) and **optional powered recovery feather pitch** (up to ±π/2) on joint genes. Both control real Rapier revolute motors, not position steering. The plate target is coordinated to its stalk's phase and still responds to the child's independent live neural frequency output, with retained motor torque/energy and original normal-only cuboid resistance. Both traits mutate in thin-fin lineages; invalid imported values are rejected before physics construction.

**Controlled 20s physics/brain/energy benchmark with identical custom five-part fin geometry:** the legacy sinusoidal stroke traveled **0.2443 m net**, used **229.32 reserve units**, and traveled **-0.1986 m along Z**. The opposite-handed feathered power/return phenotype traveled **0.4232 m net**, spent **151.69 reserve units**, and traveled **-0.3657 m along Z**. Thus net travel +73%, chemical expenditure -34%, and net travel/energy >2.6× in this one fixture; maximum hinge anchor errors were under 1 mm and both energy ledgers closed to ~1e-11 units. The body also drifts vertically and laterally: this does **not** establish reliable directed foraging, navigation or viable population-level swimming.

The mutation and UI inspection paths now expose these optional settings. Existing six-link planar and serpent swimmers and the old slow three-limb founder are unchanged; we did not silently replace starter DNA with this unproven special-purpose rig. Normal old sine oscillators are preserved under absent genes, and a same-geometry regression fails if net travel, signed longitudinal progress, or reserve efficiency regress. Full findings and limitations: [FIN_POWER_RECOVERY.md](FIN_POWER_RECOVERY.md). No browser/visual QA was attempted.

**Strict repo boundary:** only `smeagol44/vidAI3D` was changed; 2D VIDA was not accessed for modifications.

## 2026-10-20 — v0.2.4 physically thin inheritable fin foundation (speed still unresolved)

Following the user's suggestion to make creature parts **thinner yet wider**, we implemented optional continuous physical thickness on local Y, from 15% to 100% of an integer voxel unit, propagated consistently through Rapier collider mass and inertia, real integrated normal-only water drag, attachment anchors, rest-body overlap/spawn clearance, tissue construction energy, visuals and mouth placement. The field is optional and inherited; old genomes and all existing founder shapes remain unchanged. Non-root thickness can mutate in descendants. Selected-organism anatomy now reports actual centimetre dimensions for thin parts.

A physically articulated fin can use two chained perpendicular Y/Z revolute hinges with separate genetically controlled neural motor outputs. Production-code tests cover finite bodies and dual-axis articulation, proper physical thickness/energy, mutation and the live ecosystem chemical ledger. CI must pass before merging. See [THIN_FINS.md](THIN_FINS.md) for the detailed contract and measured negative performance evidence.

**Critical limitation:** These capabilities do **not yet** make the three-limbed founder swim quickly. In 7-second controlled recurrent-brain trials, a 0.06m plate managed at most **0.0049m of forward travel** across three phase choices; the tested 0.15m and 0.30m plates did not exceed ~0.009m and 0.013m, respectively. Some very thin variants consumed 70–105 reserve units. Previous broad-fin shape sweeps similarly failed to achieve efficient net motion. Accordingly the v0.2.3 planar/serpent founder gaits, physics, water resistance coefficient, and default tri-limb are **not** replaced by unproven plates. The appropriate next locomotion phase is power/recovery stroke asymmetry and carefully measured fin feather-control coordination, with net COM body lengths and chemical cost as the acceptance metrics.

No manual browser/WebGL QA and **no changes to the separate 2D `smeagol44/vidAI` repo**.

## 2026-10-20 — v0.2.3 measured live swimming speed improvements

**Reason for this phase:** After the v0.2.2 movement/energy fixes, the user still found locomotion *extremely slow* and prioritized speed over feeding/perception. Only `smeagol44/vidAI3D` was modified. The physics state, Rapier joints, analytical normal-only cuboid resistance and chemical energy accounting remain authoritative. No position steering, fabricated forces, genome retrofits or hidden refills.

**Diagnosis:** The existing 26 m tank was large relative to movement: a living planar founder covered **0.968 m / 10 simulated seconds**, the nonplanar serpent **0.497 m**, and the three-part tri-limb **0.149 m** (nearly entirely lateral drift). The headless 14-founder, 400-nutrient production simulation completed 1 simulated second in about 87 ms on a CI runner (not a guarantee of WebGL/desktop throughput); physical displacement per simulated second is a material problem. Increasing the 0.65 Hz stroke frequency to 1.3 Hz reduced planar travel to ~0.62 m/10s; raising torque beyond 800 N m saturated, without useful additional speed. Changes to global water drag and wide paddles likewise did not fix slow net travel. Large appendage/phase sweeps also did not produce a useful fast tri-limb.

**Implemented bounded speed improvement:** Fresh planar and nonplanar founder genomes now inherit **six dynamic, 0.9 m-long ordinary links** (five physical motor hinges, supported by the existing 20 evolved output channels) and nonreciprocal traveling phase offsets. The serpent retains a real X hinge for out-of-plane motion. It uses an inherited 600 N m maximum torque versus 400 N m planar; both retain the 0.65 Hz nominal frequency. The entire chain remains regular mutable anatomy with normal density, resistance and metabolic work. Mutating six-link parents to seven-link offspring also allocates four additional neural motor output rows instead of silently assigning uncontrolled extra joints; leaf removal drops the corresponding four motor channels.

**Measured live 10-second isolated production-tick results** (recurrent brain, sensory step, metabolism, real Rapier and zero feeding/contacts): planar **1.888 m net, 1.888 m forward** (1.95× v0.2.2), nonplanar serpent **1.478 m net, 1.474 m forward** (2.97× v0.2.2). Physical motor work used 11,491 J and 15,067 J, respectively; both remained alive with substantial reserves. Maximum anchor gaps were 0.012 mm and 0.061 mm, respectively, and the closed-system ledger residuals stayed near zero. Neutral 30 s physics references also passed. The calibrated planar live controller covered **4.143 m / 20 s** (previously 2.151 m). These faster *absolute metre* speeds come largely from longer bodies; body-lengths-per-second remains modest. The tri-limb is **not** fixed or claimed fast: its 10 s control remains ~0.149 m lateral, negligible forward progress.

**Regression and limits:** `tests/locomotion-speed.test.ts` verifies real tick travel, neural channel counts, stability, motor cost, energy conservation, and a 14-founder full-tank run. Existing physics/recurrent/clock/energy suites remain in CI. This is **an intermediate meaningful improvement**, not a claim of fish-like movement speeds, foraging success or long-term ecological survival. The tri-limb body plan likely needs a separate viable locomotor design. The UI's instantaneous COM speed can overstate net travel; a future rolling-window locomotion metric would help. No manual browser/WebGL validation was performed.

## 2026-10-20 — v0.2.2 funded lifecycle and clear-water presentation

The user confirmed that creatures now travel but are **still visibly too slow**, and explicitly requested removing the distracting glitter effect in the water. Further swim-speed tuning is a separate pending benchmark; no locomotion forces, water resistance or timing parameters changed in this release. The aquarium's 180 cyan random `points` motes were removed from `Game.tsx`, retaining wall outlines, seabed and voxel anatomy.

**Energy and lifecycle fixes:** Bodies have documented voxel/organ/neuron/hinge tissue construction costs, limited reserve capacity and morphology-aware starting funding. Egg construction and reserve are paid from the parent once, and hatching no longer records artificial external input. Egg orientation is preserved, and a consumed/nonviable egg becomes exactly its remaining amount of food rather than unfunded tissue. A malformed mutation cannot reuse a parent's original object/ID for a child. Internal births remain subject to exact-location physical clearance and population limits.

The simulation now accumulates basal chemical heat, motor chemical expenditure, feeding trophic losses and separate physical motor work. All chemical reservoirs and explicit external input/removal counters contribute to a published conservation residual. Feeding and external feed-all interventions respect reserve capacity. On death, only real remaining tissue and reserves become edible remains. Reproduction eligibility is available as a live reason rather than an unexplained refusal.

**Tests:** Added 8 targeted `tests/energy.test.ts` cases for morphology, natural death, parent-funded hatch, nonviable egg, capacity-limited external feeding, nutrient feeding, egg predation and live prey predation. Together with the 22 existing tests, the PR CI ran **30/30 passing** plus a successful TypeScript/production build (GitHub Actions run 39396820807). The regression cases verify the conserved ledger with near-zero residual. The legacy 3D reference swimming physics remained operational.

See [ENERGY.md](ENERGY.md) for costs, conservation equation and documented limitations. Remaining: full shared per-mouth intake budgets and exact contact geometry; causal predation injury/scavenging, identity migration, hatch envelope validation, meaningful lifespan/juvenile progression and multi-generation ecological calibration. No browser/WebGL manual QA was attempted. **No 2D repository changes.**

## 2026-10-20 — v0.2.1 production-path neural locomotion repair

**Scope and identity:** A post-v0.2.0 player report said creatures articulated but did not travel visibly in the published ecosystem. We reproduced a reduced, fresh, deterministic *live* planar founder in `WorldSimulation.stepOuterTick()`, with sensory inputs, recurrent updates, normal metabolic cost, two Rapier substeps per outer tick and actual physical work. A neutral-output control received identical ticks/biology. No feeding, walls or other organisms contacted the test swimmer. The 2D repository was strictly untouched.

**Demonstrated causes:** Newly founded brains had randomly strong angle-offset and stiffness outputs that disrupted the otherwise useful inherited oscillator gait. More severely, each joint independently integrated neural frequency modulation forever, gradually unwinding the inherited phase relationships: the original recurrent swimmer reversed travel and made progressively weaker strokes; enabling *only* the frequency channels still reversed movement. This was a motor/controller integration and founder-initialization problem, not evidence to replace Rapier or inject forces.

**Bounded corrections:**
- Keep the leading joint's inherited frequency plus real neural modulation. The remaining joints continue to respond to *their own* frequency channels, with a 3/s phase-error correction toward their **inherited mutable** relative offsets. This prevents indefinite phase drift without overriding joint angles, forces, velocities or the solver.
- New founders retain sparse, nonzero recurrent controllers; their initially random angle-trim and stiffness output weights/biases are scaled to 15% of the previous range so a useful inherited stroke survives early neural activity. Existing/imported genomes are not rewritten.
- Output weights and biases now mutate in offspring; the founding gait prior is not frozen across generations.

**Measured 20-second production-path test:** Original neutral 2.291 m net; original live recurrent 1.208 m net with -1.207 m signed progress (reversed). With frequency channels alone, the pre-fix 0.563 m net was also backwards. Corrected live recurrent: **2.135 m net and 2.135 m forward**, 2.151 m COM path; final five completed strokes each advance 0.178–0.180 m. With frequency channels alone: **2.268 m net and forward**. Recurrent output activity remained nonzero (mean absolute 0.0674); reserves finished at 199.91 versus 202.21 neutral, with no refills. Maximum relative oscillator phase error was 0.137 rad; maximum joint anchor gap 0.046 mm. The repaired live swimmer reached about 93% of neutral-reference travel in this fixture. Raw evidence and exact test/run identities: [live-locomotion-results-0.2.1.json](live-locomotion-results-0.2.1.json).

**Regression:** `tests/live-locomotion.test.ts` exercises the same full production tick, verifies positive forward net travel, persistent per-stroke progress, meaningful neural activity, bounded phase error, work/energy, hinge integrity, and actual mutability of motor outputs. The pre-fix 1.208 m and 0.563 m cases fail the new travel thresholds. The previous 20 physical/clock tests remain in the suite. Validation uses GitHub Actions with `npm ci`, `npm run test:fast` and `npm run build` (22 tests).

**Limits:** These results establish a real cause and useful travel for **one** fresh planar founder, not population-wide reliable movement, all imported specimens, active foraging, or long-term ecological survival. A 2.7 m swimmer still only covers about 0.79 body lengths in 20 seconds within a 26 m tank. The trilimb is not newly certified. Separate energy, feeding, vision and identity defects remain. No manual/published-game browser validation was performed.

## 2026-10-20 — approved physics and timing repair, v0.2.0

The user approved replacing the custom solver with Rapier before energy, perception/mouth and UI work. They explicitly prefer focused automated/static checks over manually opening the published game. This implementation follows that scope; the 2D repository was not modified.

### Implemented

- One shared Rapier 0.21.0 world; dynamic cuboid mass/inertia from density and dimensions; physical revolute joints, face-aware anchors/frames, angular limits, contacts and tank walls. Bodies are removed on death and old worlds freed on reset.
- Retained the analytical normal-only cuboid drag law, applied to actual physical linear/angular velocity. Removed custom integration, pose/velocity overwrites, invented reaction forces and unrelated damping.
- Four bounded neural motor channels, equal/opposite active torques, continuous oscillator integration and genuine zero motor allowance. Passive constraints never incur muscular-work charges.
- Calibrated supplied founder templates, including a four-link nonplanar swimmer. Existing imported genomes are not silently rewritten; invalid or penetrating rest anatomies are rejected.
- Fixed-step accumulator, computation-budgeted MAX mode, measured throughput/achieved speed, bounded React snapshots and direct physics-to-mesh transforms. Founder/specimen insertion uses organism construction and clearance checks.
- 20 fast production-module/geometry/clock tests and TypeScript/production build checks; both run in Pages CI. Browser/manual verification was deliberately omitted.

### Actual physical measurements

| Isolated condition | 30-second result |
| --- | --- |
| Planar, neutral neural modulation, water resistance 250 | 3.5500 m net, 1.3148 body lengths; 3.5651 m path |
| Four-link Y/X/Y swimmer, neutral modulation | 1.4286 m net; 1.4676 m path; 0.3831 m maximum out-of-plane height |
| Planar, zero drag | 0.0441 mm COM drift; final momentum magnitude below 0.001 kg·m/s |
| Maximum reference anchor separation | 0.0406 mm; no reference contact samples |

Motors-off rest is separately tested over one second with zero displacement and zero motor work. The new tests also compare full body/oscillator/output state across 30/60/144 render rates and 1×/2×/5× speeds. See [PHYSICS.md](PHYSICS.md) for calibration, test tolerances and limitations; raw results are in [physics-results-0.2.0.json](physics-results-0.2.0.json).

### Remaining work

Energy conservation is the next recommended phase. The existing chemical cost multiplier (0.005 reserve units per mechanical joule), hatch funding, decomposition, intervention accounting and ledger defects remain. This is not an ecological-survival certification. Perception, diet/mouth contact geometry, channel identity, runtime organism identity and UI work remain documented in the initial audit. The feature comparison below remains a historical baseline, not a claim that all 54 items were repaired.

The initial publication/audit record follows unchanged.

## 2026-10-20 — standalone import, publication and initial audit

The supplied `project-files (20).zip` is now maintained in `smeagol44/vidAI3D` and published at https://smeagol44.github.io/vidAI3D/.

The user authorized initial publication, followed by an audit and comparison with current 2D. Gameplay changes have **not** been selected or implemented. The user wants further development directly in this repository, without returning to Playground.

### Completed

- Preserved all supplied simulation modules; added standalone Vite/React build, local Tailwind styling, dependency lock and GitHub Actions Pages deployment.
- TypeScript and the production build passed for initial publication. Actions run 39357753399 deployed baseline `927b377020a235fb00d0ab46f292cf39de3d5ccb` successfully.
- Executed bounded production-module probes and retained their actual results in [audit-baseline.json](audit-baseline.json). No diagnostic modifies the live browser ecosystem.
- Compared with current 2D version 0.6.1 at commit `7ff4900904db9448d792510b81a849b5177591a4`. Updated the comparison after 2D advanced during the paused task. The 2D checkout was read-only; no 2D changes were made.
- Recorded [37 findings and repair recommendations](INITIAL_AUDIT.md) and the [54-item 2D feature comparison](FEATURE_PARITY.md).

### Main findings

- Planar reference: 0.1444 mm net displacement in 30 seconds, with approximately 0.00437 mm maximum anchor error. Both supplied swimming acceptance tests fail.
- Nonplanar hinge axes reach 178.51° misalignment. The custom solver is not a complete physical revolute-joint implementation.
- Hatching creates 100 J unfunded tissue and incorrectly records 350 J external input. Decomposition turns 100 J into 140 J. The ledger omits multiple losses and mixes mechanical work with chemical heat.
- Default seed 4242 has no births and is extinct by 180 simulated seconds. This is one measured trajectory, not a universal claim about all seeds.
- Latest diet permissions and mouth-face placement work, but contact geometry, intake budgets and rendered contact overlays are inconsistent.
- Vision ignores eye face/FOV and uses fixed-radius centre approximations; there is no sensed distance attenuation. Oral/contact feedback, brain channel remapping and motor-output mutation are incomplete.
- Identity/validation/persistence and several UI/clock details need repair. The obsolete effective-mass sign error is already corrected in the supplied archive.

### Verification limit

The live application and menu loaded, but this cloud browser has WebGL disabled. Tank rendering, camera/picking and mobile visual QA were not completed. Do not report those as passed. The diagnostic script runs the actual production simulation independently of WebGL.

### Original proposed next decision (subsequently approved above)

Choose a bounded physics-foundation repair: replace the custom integrator/constraints with an established solver while retaining the drag model, genomes, neural controller and voxel presentation. Establish one measured reference swimmer before adding features. Energy conservation is the next critical workstream. See the audit for dependencies and alternatives. Await the user's direction before implementing these gameplay changes.
