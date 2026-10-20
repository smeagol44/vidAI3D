# VIDA 3D

Voxel aquatic evolution simulator with Rapier rigid-body articulation and analytical cuboid water resistance. Originally imported from `project-files (20).zip`.

**Play:** https://smeagol44.github.io/vidAI3D/

This repository is the development home for the 3D project. The separate [2D reference](https://github.com/smeagol44/vidAI) is used for feature comparison.

## Development

Use Node.js 24 and npm:

```sh
npm ci
npm run dev
```

The development URL includes `/vidAI3D/`, matching the GitHub Pages subdirectory.

```sh
npm run test:fast
npm run build
npm run preview
```

GitHub Actions runs the focused automated suite and builds pull requests and deploys successful pushes to `main`. Pages must use **GitHub Actions** as its publishing source in repository settings.

## Physics foundation — v0.2.0

The custom solver has been replaced by one authoritative Rapier world. New founders use calibrated inherited gaits; the existing genome schema, recurrent controller and voxel observation interface remain. The clock now uses fixed ticks independent of rendering FPS, with bounded work and measured achieved speed.

In isolated production-module tests, the planar founder travels **3.55 m (1.31 body lengths)** in 30 simulated seconds; the four-link nonplanar founder travels **1.43 m**. Neither contacts another body or wall. These controlled physical references do not establish intelligent feeding or sustainable evolution.

- [Implementation, calibration and verification](docs/PHYSICS.md)
- [Current project status and remaining work](docs/PROJECT_STATUS.md)
- [Current measured physics results](docs/physics-results-0.2.0.json)
- [Original defect audit](docs/INITIAL_AUDIT.md), [2D → 3D comparison](docs/FEATURE_PARITY.md) and [baseline measurements](docs/audit-baseline.json)

`npm run test:fast` executes 20 short tests against the production modules, including real Rapier stepping, contacts, joint frames, swimming and scheduling. `npm run build` includes TypeScript checking. No manual browser verification was performed for this repair, per user direction.

`npm run audit` now reports only the focused physical references. For JSON output, use `npm run --silent audit > results.json`. The original broad audit script is retained in Git history at commit `dca99b9`.

The export includes a local fake Playground SDK; running the app requires no Playground account or service. Music currently uses external Google-hosted URLs. Optional audio availability does not block simulation startup.

Third-party notices from the export are retained in `THIRD_PARTY_NOTICES.md`. That file also lists packages used by the export environment that this application does not import.
