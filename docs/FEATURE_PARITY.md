# Current 2D → 3D feature comparison

Reference: [vidAI at 7ff4900](https://github.com/smeagol44/vidAI/tree/7ff4900904db9448d792510b81a849b5177591a4), version 0.6.1. Target: the published 3D import at `927b377`. This is a source-based comparison of implemented systems, not a proposal to change 2D or copy its numeric constants into 3D. Physics defects and measured evidence are in [INITIAL_AUDIT.md](INITIAL_AUDIT.md).

**Missing** means no corresponding production path was found. **Partial** means something exists but omits a material part of 2D's behavior. **Present** does not certify correct physics or every edge case. Features in the 2D design documents alone are not counted as implemented.

## Simulation, founders and control

| Feature in current 2D | Current 3D | Recommended treatment |
| --- | --- | --- |
| 51 distinct blueprints: 50 revised originals plus Moonbell Jellyfish, with families and diets | Missing; three hard-coded founder morphologies are repeatedly instantiated. | Add a varied 3D catalogue after a reference swimmer works; avoid renamed duplicates. |
| Searchable/filterable catalogue, previews, persistent custom specimens and curated tags | Partial; in-memory genome bank, color swatch and export/spawn only. | Port the curation workflow with a small 3D body preview, stable runtime identities and persistence. |
| Balanced versus unbiased founder-brain initialization | Missing; sparse random networks only. | Keep the distinction between inherited priors and trained behavior explicit if adding modes. |
| Seeded startup across up to five uniformly sampled distinct designs, independent genomes and selectable presets | Partial; a fixed repeating founder sequence with random poses. Both games now default to 400 nutrients. | Add seeded distribution controls after repairing food/energy balance. |
| Stable shared face slots: one physical connection or up to three combined organs, counting both hinge ends | Missing; 3D permits at most one eye and one mouth per part and has no slot occupancy model. | Adapt surface organs to six cuboid faces using the same frames for sensing, feeding, markers and previews. |
| Stable semantic neural input/output IDs with schema migration | Missing; positional channels and fixed weight matrix sizes. | Essential for reliable structural evolution and persistence. |
| Six outputs per joint: angle, frequency, torque, stiffness, amplitude, engagement | Partial; first four exist, amplitude is inherited/fixed and engagement is a runtime flag rather than a neural channel. | Adapt after calibrated physical actuation exists. |
| Smooth motor command ramps, exact disengagement and continuation during rest | Partial; continuous oscillator phase exists, but command ramps and independent neural engagement do not. | Preserve phase integration and add only tested motor authority. |
| Causal edible-contact and absorbed-intake feedback per mouth | Missing; a mouth input is allocated but never written. | Add real production feedback with stable channel IDs. |
| Aggregate actual-feeding flag and normalized COM depth/pressure | Missing. | Add causal completed-tick feeding and tank-normalized vertical COM depth. Preserve existing reserve sensing rather than duplicating it. |
| Current reserve, oscillator and joint proprioception inputs | Present; normalization/layout is simpler. | Preserve and document meanings/units; add capacity-aware reserve normalization. |
| Anatomy-dependent retinal RGB and normalized hit-distance channels | Partial; RGB only, fixed cone, ignored face/FOV, no retained hit distance. | Replace approximate sensing with shared real geometry and hit records. |
| Evaluated controlled motor commands and paired vision/no-vision benchmarks | Missing; generic built-in reference tests do not test causal controller behavior. | Add small targeted checks as controls are repaired; do not confuse motor response with successful hunting. |
| Mutation of input/recurrent/output weights and anatomy-aware network remapping | Partial; output pathways do not mutate and topology changes shift channel meanings. | Repair before claiming open-ended controller evolution. |
| Heritable pigment independent of diet; a pigment-variability trait | Partial; body color is already independent and can drift, but variability is a fixed mutation probability. | Preserve current pigment; add the trait only if selected. |

Sources: [2D simulation.ts](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/simulation.ts), [founders.ts](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/founders.ts), [versioned project status](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/docs/PROJECT_STATUS.md).

## Feeding, energy and life history

| Feature in current 2D | Current 3D | Recommended treatment |
| --- | --- | --- |
| Herbivore, carnivore and omnivore mouth permissions | Present in the newest ZIP; specialist/half-rate rules pass isolated checks. | Preserve; this is no longer the previous export's universal nutrient-eating bug. |
| Shared physical mouth aperture used for food contact and visualization | Partial; face placement is shared, but a front-filtered radius is used rather than the visible aperture/actual prey surface. | Unify geometry and overlay; retain red/green/purple diet markers. |
| One per-mouth per-tick intake budget shared across food sources | Missing; nutrients, eggs and prey each get a separate allowance. | Add one time-scaled shared budget. |
| 2,400 J/s specialist and 1,200 J/s omnivore gross intake, with 80% assimilation on all food categories and cumulative heat | Partial; 3D rates are 60 J/s nutrients and 50 J/s meat before the omnivore factor. Nutrients have no assimilation loss; meat loses an unrecorded 20%. | Copy consistent budgeting/heat policy, then calibrate rates for the 3D energy scale. |
| Capacity-limited intake, leaving unabsorbed food available | Missing; reserves have no maximum capacity. | Introduce a documented storage model without destroying food at full capacity. |
| Live prey and foreign-egg predation | Present in simplified form; prey reserves only and own-egg protection. | Fix causal lethal-bite attribution/accounting; do not mistake this for tissue damage simulation. |
| Kinship toggle covering relevant siblings/eggs | Partial; only self/own-egg exclusions. | Add explicit lineage-based protection if selected. |
| Carrion distinct from plant nutrients, scavenging and timed mineralization | Missing; dead bodies immediately become generic green nutrients, with wrong energy totals. | Add only alongside conserved decomposition. |
| Mouth-specific recent feeding events, highlights and feeding-driven opening/ripple animation | Partial; event data and emissive flashes exist, but no comparable opening animation; initial highlight/overlay geometry are wrong. | Preserve data, fix false flashes/contact geometry, and animate real intake without changing physical reach. |
| Geometry-dependent construction budget and energy-storage capacity | Missing; fixed 100 J tissue for all morphologies and no capacity field. | Define consistent 3D size/organ economics. |
| Basal, sensory/neural and motor expenditure breakdown | Partial; fixed basal deduction and scaled mechanical work, with an incomplete ledger. | Implement cumulative heat accounting and explain each rate. |
| Funded egg construction plus reserve, including damaged-egg viability | Missing; egg funding becomes reserve and tissue is created for free. | Critical repair before balancing generations. |
| Safe whole-body hatching envelope and tank containment; blocked eggs retain funding and stored orientation | Missing; 3D hatches at the egg location without obstacle clearance. | Add deterministic clearance checks through actual 3D geometry and wait when blocked instead of spawning intertwined bodies. |
| Maturity, clutch sizing, protected parent reserve and detailed reproduction affordability | Partial; simple age cooldown and reserve threshold, single egg. | Adopt funded eligibility/status first; choose how much life-history complexity to port later. |
| Current life stage, remaining lifespan and aging display | Partial; age is tracked but there is no comparable life-stage/eligibility presentation. | Add real states derived from implemented rules, without pretending growth exists. |
| Cumulative energy ledger, recorded losses and conservation residual | Partial and incorrect; losses and internal births are misclassified, work is transient. | Critical repair with exact internal totals. |
| Death causes, recent-death history and lineage records | Missing; only totalDeaths and a genome ancestor ID. | Add causal lifecycle events and retained lineage after unique identities are fixed. |
| Population diet counts, birth/death totals and richer ecosystem statistics | Partial; basic counts and highest generation only, with inconsistent birth/food units. | Add statistics derived from authoritative events, rather than separate counters that drift. |

## Observation, windows and experiments

| Feature in current 2D | Current 3D | Recommended treatment |
| --- | --- | --- |
| Hit rays start at eyes, stop at nearest surfaces and expose hit type/color/distance | Partial; lines start at body centres and run to full range; RGB alone is stored. | Fix sensor geometry once and draw those exact results. |
| Black empty retinal space, invisible tank/effects, white physical eggs and distance attenuation toward black | Partial; walls are already omitted in 3D, but empty space is blue, eggs are amber and near/far RGB is identical. | Preserve invisible walls; separate physical RGB from display glow and implement black-background attenuation with white eggs. |
| Visual retinal input display with meaningful channel labels | Partial; at most 24 generic-index inputs are shown. | Show the complete actual layout, with sensor identity and RGB grouping. |
| Live weighted recurrent network graph with functional threshold filter | Missing; activity bars and a threshold slider with no graph. | Adapt `BrainGraph` concepts to the real 3D channel layout. |
| Organism COM trail toggle and traveled-distance history | Missing; instantaneous COM speed only. | Useful early visual aid after locomotion is honest. |
| Detailed morphology and per-mouth diet-permission inspector | Partial; joint/segment counts and mouth faces/rules exist, but no comprehensive anatomy view. | Extend current inspector in small sections; retain useful joint error telemetry. |
| Energy reserve/capacity, endurance, burn rates and reproduction eligibility inspector | Partial; reserve and cumulative work display only. | Add after energy accounting is corrected. |
| Lineage and deaths inspection | Missing; “Specimen Bank & Ancestry” has no lineage tree/history. | Implement real retained data before using ancestry labels. |
| Movable/resizable panels bounded to the tank area, scrolling content and nonblocking notifications | Partial; several 3D panels scroll, but are mostly fixed overlays. | Adopt viewport-safe window behavior, not a wholesale visual redesign. |
| Camera pan/zoom, centering and tracking | Present in 3D-specific form, plus orbit/top/front/side presets. | Keep the 3D camera; fix input capture over UI and validate touch separately. |
| Visible version and creator credits | Missing in current 3D UI; package version exists only in the new build setup. | Add a small version indicator/credits in a later UI patch. |
| Live world dimensions, viscosity, gravity, food targets/inflow, population and mutation settings | Mostly missing from independent 3D UI; exported config contains values but most ecological ones do not drive the kernel. | Create validated live settings; a 3D tank needs three dimensions and proper collider resizing. |
| Feed selected/all and clear free plant food with accounting | Partial; feed-all and add-food exist; no clear-food workflow or selected feed counterpart. | Preserve deliberate user interventions and record external inputs/removals. |
| One capped plant-food creation API for automatic/manual feeding, including target-zero behavior | Missing; 3D manual nutrient spawning ignores the target and can exceed the 800 visible instances. | Keep logical/render capacity consistent and record manual inputs; never delete decomposition energy silently. |
| Full-world JSON save/load with PRNG, controller state, phases and schema migration | Missing. | Add exact continuation and validate imports before swapping the world. |
| Persistent specimen bank plus validated genome import/export | Partial; export and in-memory saving/spawning only. | Add storage/import after runtime IDs and schema validation are repaired. |
| Copyable diagnostic report with settings, seed, selected state, deaths and ledger error | Missing. | Port the report concept; the audit JSON is a development artifact, not an implemented game feature. |
| Extinction handling and observation feedback | Partial; an empty 3D tank continues without the 2D extinction overlay/history. | Choose a clear observation state without secretly reseeding the ecosystem. |
| Birth/death/feeding event audio and separate persistent SFX/music sliders with independent mute | Partial; 3D has UI sound effects and mute controls, but no comparable simulation-event wiring or independent volume sliders. Music uses external URLs. | Preserve optional audio, connect real events and keep the two volume controls independent. |
| Production-module tests, browser scenarios and versioned behavior diagnostics | Partial; a synchronous ten-case in-game suite exists, but assertions omit major invariants and both swimming cases fail. Build CI and a reproducible audit were added during import. | Replace broad success claims with focused regressions as each subsystem is repaired. |
| Solid inter-organism and nonadjacent self-contact on a shared substep clock, with adjacent hinge exclusions | Missing; only per-body tank-centre clamping exists. | Use 3D colliders/constraints. Current 2D SAT/contact code is a behavioral reference, not a drop-in 3D solver. |

Sources: [2D App.tsx](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/App.tsx), [BrainGraph.tsx](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/BrainGraph.tsx), [persistence.ts](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/persistence.ts), [world.ts](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/world.ts), [diagnostics.ts](https://github.com/smeagol44/vidAI/blob/7ff4900904db9448d792510b81a849b5177591a4/diagnostics.ts).

## Do not mistake these for implemented 2D features

- Current 2D has solid rectangle contacts, a spatial broad phase and joint repair, plus safe whole-envelope hatching. It remains a discrete frictionless solver without continuous collision detection; it does not certify penetration-free 3D physics by analogy.
- Tissue injury/repair, actual juvenile body growth, evolved brain structure and within-lifetime learning are not solved in the inspected 2D production kernel. A life-stage label is not growth physics.
- Reliable intelligent hunting/foraging is not established by 2D's current benchmarks. Its own report finds no consistent vision advantage in the sampled food-seeking comparison. Port controller authority and honest evaluation, not an intelligence claim.
- Current 2D now implements the requested invisible walls, black retinal background, white eggs and fading toward black. Earlier 0.3.0 notes about cyan walls and amber eggs are historical.
- 2D pixel distances and 3D metre distances are not directly comparable. Compare assembled body lengths per simulated second/stroke under documented conditions.
- Do not transplant 2D drag anisotropy or joule constants blindly: preserve the requested 3D analytical normal-surface-resistance model and calibrate the combined physical system.

The highest-value additions after foundation repairs are trustworthy mouth/ray/brain aids, usable environment settings, reserve/reproduction telemetry, trails, and persistence. A 51-creature catalogue, larger UI expansion and advanced evolutionary features should follow a working physical and chemical model.

Current 2D uses fast geometry/state tests and builds by default; extended simulation/browser runs are opt-in. Apply the same restrained validation policy to future 3D work.
