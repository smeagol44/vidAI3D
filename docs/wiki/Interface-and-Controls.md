# Interface and controls

The top HUD shows **VIDA 3D**, its package-derived version and the exact creator credit **by Hernán Garro and Federico Regueira** (header creator text is displayed on wide screens). The start screen and simulation menu also display the creators and version.

The HUD reports simulated time, nutrients, living organisms, highest generation, renderer frame rate, physics throughput and achieved simulation speed. Some counters collapse on small displays. The header provides 1×, 2×, 5× and MAX simulation speed, pause/play, energy-ledger/verification controls, and Menu.

Quick controls add 30 nutrients, create one pioneer (random planar swimmer, nonplanar serpent or fin-tail starter), externally feed all organisms and open the specimen bank. The camera offers Free, Top, Front and Side presets. Selected-organism/brain/chemical-energy information is available in the observation panels. The selected-organism inspector also shows the measured physical net COM displacement since birth, total COM travel (path), and net distance per chemical unit spent on motors. These observational measurements do not control the organism.

Music and SFX have separate mute controls in the Menu. Manual feeding is explicitly accounted for as external chemical-energy input; adding a pioneer is a manual external intervention, not autonomous reproduction. The original `tri_limb` genome remains supported for existing specimens but is no longer chosen by the default pioneer button.

**Limitations:** There is not yet freely draggable UI parity with 2D, persistent specimen-bank storage or the full suite of 2D ecology graphs and environment sliders. The displayed version comes from `package.json` at build time, never manually duplicated in menu text.
