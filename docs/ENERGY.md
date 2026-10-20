# VIDA 3D — chemical energy, mortality and funded lifecycle

The simulation uses chemical reserve units, **not SI joules**. Real motor work in physical joules is converted by `0.005 chemical units / motor joule`; it must never be added to stored chemical energy before conversion. The ledger checks external input minus external removal against living reserves, tissue, egg funding, nutrients and accumulated chemical heat.

## Current biological budgets

- Body construction: **5 per voxel** (including inherited thin-plate thickness), **15 per mouth**, **10 per eye**, **6 per hinge** and **0.5 per recurrent neuron**.
- Basal upkeep: inherited `baseUpkeepPerSec` plus **0.001 × construction energy each simulated second**.
- Capacity: **max(500, ceil(6 × construction energy))**.
- Initial **externally seeded** founder reserve: **min(capacity, max(250, ceil(4 × construction energy)))**, all recorded as external input. Existing saved DNA is not rewritten.
- Required egg funding: **construction energy + max(60, construction energy)**, ensuring every valid hatch has a reserve of at least a construction-energy budget. Parent funding is deducted once. Reproduction is blocked unless the parent can preserve at least **one own-body construction-energy budget** afterwards; the actual mutant-child funding is checked again before laying, so reproduction cannot drain the parent below that amount. No energy enters at hatching.
- Prior default founder reserves were 314 for six-link planar/serpent and 482 for fin-tail; new defaults are 628 and 964 respectively. This is a larger explicitly-funded initial allocation, not hidden energy regeneration.

The evolved brain, physical motors and inherited traits are unchanged. Newborns do not receive the founder reserve grant; they receive precisely egg funding minus the cost to construct their tissues. If egg funding is insufficient, it becomes conserved edible material. If physical clearance fails, incubation completes but hatching remains blocked at the egg's actual location.

## Death and diagnostics

Each production physics tick first charges basal upkeep, physical motor work and oral interactions. **All deaths are then resolved in a final pass**. A prey depleted by a predator's actual mouth contact dies on the same tick irrespective of organism iteration order. If a depleted organism was not killed by a bite this tick, its recorded cause is starvation/reserve exhaustion. A creature reaching its inherited lifespan with positive reserves is old-age death. When aging and exhaustion coincide, depletion takes precedence. A death converts its remaining chemical reserve plus original tissue energy into funded nutrient remains with no invented energy.

The organism inspector shows separate *lifetime* motor and basal chemical spending, egg funding, victim reserve consumed by bites, actual oral gain and remaining lifespan. The energy ledger includes cumulative death counts and the most recent death's simulated age/cause. Recent death entries are bounded for display and are not biological inputs; resetting the world clears them. No saved genome field or neural signal was added.

## Evidence and limitations

In the v0.2.7 14-founder, 400-nutrient, 45-s production audit (seed 4242), 5 founders died and no eggs were laid. Several six-link founders spent 230–254 units on motors within 30 seconds, while basal upkeep was 0.557/s. Only ~305 units total were eaten in 45 seconds by all 14 combined. This justifies a **finite initial viability window** and physically funded hatchling reserves rather than changing the water model or inventing food. Follow-up tests should distinguish the effects of better funding from actual feeding and multi-generation self-sufficiency; no sustainable ecology claim is made.

The retained `tests/energy.test.ts` and new mortality tests check energy conservation and causal death recording. No browser QA was performed.
