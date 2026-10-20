# Working on VIDA 3D

- This repository is the 3D project. The separate `smeagol44/vidAI` repository is a read-only 2D reference unless the user explicitly requests changes there.
- Read `docs/PROJECT_STATUS.md` first. The imported baseline is intentionally preserved and has documented failed swimming and energy invariants. A successful Pages build does not certify ecological correctness.
- The user approved the physics-foundation repair after the initial audit. Keep subsequent energy, perception/mouth and UI work scoped to the user's direction.
- After the initial import/audit, use a branch and PR for gameplay changes. Preserve the voxel presentation, useful observation interface and independent inherited body pigment unless the task concerns them.
- `sim/` contains the production kernel. Diagnostics and regression tests must call those same modules. Distinguish controlled physical swimming, neural response and ecological outcomes.
- Keep one authoritative physical state. Preserve the requested 3D integrated normal-only cuboid surface-resistance model; do not replace it with invented thrust, forced displacement or target-coordinate steering.
- Keep runtime organism identities separate from inherited genomes and ancestry. Validate topology, finite data, dimensions and neural channel identities before constructing imported organisms or replacing a world.
- Keep reserve, construction energy, capacity, mechanical work, chemical heat and external interventions distinct. No hidden refills, immunity, automatic replacement creatures or fabricated passing diagnostics.
- Default verification is `npm run test:fast` and `npm run build`; do not open a browser for manual/published-game verification unless the user asks. Prefer pure geometry/state assertions and short production-module tests. Use small targeted production-module checks for relevant invariants. `npm run audit` now reports focused reference physics; the original broad audit script remains reproducible at commit dca99b9. Run extra simulations only for a concrete unresolved concern. Prefer focused automated/static checks over repeated long simulations or manual browser exploration.
- Report actual measurements and unexecuted conditions. If WebGL/browser infrastructure is unavailable, state that limit; do not claim visual QA passed.
- Record material decisions, results and limitations in `docs/PROJECT_STATUS.md`. Retain baseline evidence; new results should have their own identity.
