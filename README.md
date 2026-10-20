# VIDA 3D

Voxel aquatic evolution simulator, imported from `project-files (20).zip`.

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
npm run typecheck
npm run build
npm run preview
```

GitHub Actions builds pull requests and deploys successful pushes to `main`. Pages must use **GitHub Actions** as its publishing source in repository settings.

## Initial baseline

The first import preserves the supplied simulation behavior. Successful builds and publication do **not** certify swimming, feeding, evolution, or the built-in verification claims. The initial audit records measured behavior and proposed follow-up work before gameplay changes are selected.

The export includes a local fake Playground SDK; running the app requires no Playground account or service. Music currently uses external Google-hosted URLs. Optional audio availability does not block simulation startup.

Third-party notices from the export are retained in `THIRD_PARTY_NOTICES.md`. That file also lists packages used by the export environment that this application does not import.
