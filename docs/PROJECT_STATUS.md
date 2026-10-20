# VIDA 3D project status

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

### Proposed next decision

Choose a bounded physics-foundation repair: replace the custom integrator/constraints with an established solver while retaining the drag model, genomes, neural controller and voxel presentation. Establish one measured reference swimmer before adding features. Energy conservation is the next critical workstream. See the audit for dependencies and alternatives. Await the user's direction before implementing these gameplay changes.
