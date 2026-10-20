# VIDA 3D — chemical energy, tissue and funded lifecycle (current v0.2.3)

This document describes the **simulation economy**, not physical conservation of SI mechanical energy. The visual UI previously labelled reserve units as J, but a motor's mechanical work (physical J) is converted to chemical reserve units by a retained **0.005 energy units per motor J** coefficient. The two quantities must not be added without that conversion. All accounting below uses *chemical energy units*.

## Biological costs and capacity

These are initial game-economy rules, to be tuned after reliable feeding and multi-generation experiments, not measured biological tissue densities.

| Cost | Energy units |
| --- | ---: |
| Cuboid tissue | 5 per 0.3 m voxel |
| Mouth | 15 |
| Eye | 10 |
| Hinged attachment | 6 |
| Recurrent neuron | 0.5 |
| Basal upkeep | genome base upkeep + 0.001 × construction energy / second |
| Reserve capacity | max(500, ceil(6 × construction energy)) |
| Externally seeded reserve | min(capacity, max(250, ceil(2 × construction energy))) |
| Founder's egg funding | max(140, ceil(construction energy + 60)) |

New founder examples (actual generated morphologies):

| Shape | Tissue construction | Initial reserve | Reserve capacity | Funded egg |
| --- | ---: | ---: | ---: | ---: |
| Planar swimmer, six links | 157 | 314 | 942 | 217 |
| Nonplanar serpent, six links | 157 | 314 | 942 | 217 |
| Tri-limb, three parts | 179 | 358 | 1074 | 239 |

Both six-link shapes use the same number and size of voxels but different hinge axes and inherited motor phases, so equal construction costs do not imply equal swimming performance. v0.2.2 had shorter three- and four-link mobile founders; those figures are historical, not current. Existing/imported genome traits are not silently rewritten; reproduction checks the **actual** predicted offspring construction cost and protects a minimum parental reserve. A mutated invalid child gets a separate independent unmutated child genome/ID, not the parent's live object. Newborn reserve is **remaining egg funding minus its own tissue cost**; it is not allocated from a new external grant.

A mature egg with insufficient funding for tissue **and at least one reserve unit** becomes an equivalent amount of free nutrient energy, not a living creature. If hatching is physically blocked, the egg remains funded and waits at its original position and preserved orientation; the current OBB spawn test is per-part, and more sophisticated full-envelope collision avoidance remains pending.

## Conserved transfers

- External founder insertion, nutrient seeding and explicit feed-all intervention increment cumulative external input by **exactly what enters**. A full reserve cannot gain more from feed-all.
- Explicit removal of free nutrients increments cumulative external removal; internal decomposition or hatching must **never** increment either external counter.
- Herbivore food transfers actual consumed free-nutrient energy into available reserve capacity, leaving unabsorbed food in place.
- Carnivore/omnivore egg and prey intake deducts the actual gross amount from the victim, credits 80% to predator reserve, and records the remaining 20% as chemical heat. Source depletion is capacity limited. **Shared per-mouth intake across food types is still outstanding.**
- Basal energy burn and active motor chemical cost are charged into cumulative heat, even after individual organisms die. Active motor physical work is accumulated separately in SI joules. No chemical cost is charged for passive joint reaction forces.
- Death converts **only existing tissue plus remaining nonnegative reserve** into evenly funded nutrient remains. It does not create 35 units per nutrient regardless of original energy.
- No automatic replacement creatures, synthetic propulsion or hidden reserve top-ups were added.

The world-wide conservation check is

```
residual = externalInput - externalRemovals
  - (livingReserves + livingTissue + fundedEggs + freeNutrients + cumulativeChemicalHeat)
```

This is computed from unrounded values and shown in the Chemical Energy Ledger. Near-zero residual is expected during normal production operations. Arbitrary direct mutation of `org.reserves`, `sim.nutrients`, or `egg.fundingRemaining` outside these APIs can make the residual nonzero; test-only damage scenarios explicitly balance destroyed energy into heat. The `totalFoodConsumed` counter retains its earlier meaning of assimilated units, not all gross intake.

## Validation and limitations

Dedicated `tests/energy.test.ts` runs real production ecosystem ticks to check morphology costs, capacity, intervention removal, natural death decomposition, funded reproduction/hatching, consumed nonviable eggs and all three feeding pathways. The previous swimming, hinge and timing suite stays in CI. The selected tests verify closed-world conservation residuals within `1e-5` chemical units; untested extended ecosystems are **not** certified.

Remaining work includes shared mouth budgets and correct contact geometry, a complete carcass/tissue injury system, detailed death causes, sophisticated non-interlocking hatch envelope clearance, lifespan and juvenile growth, broader identity/validation repairs and multi-generation survival calibration. Swimming speed is separately pending: approximately 0.1 m/s for the controlled planar founder means a 26-m tank is large relative to travel per stroke. Optimize with measured locomotion and ecological objectives rather than ungrounded forces.

Visual presentation: the 180 random cyan point motes previously rendered inside the aquarium were removed at user request; box walls, seabed, creature mesh and hydrodynamics remain untouched. No browser/WebGL manual validation was performed.
