# VIDA 3D project status

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
