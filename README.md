# Paperly

A Next.js PDF workspace with Firebase accounts and real local PDF processing.

**Current scope:** 31 local tool workflows, 44 dedicated tool routes, PDF.js viewer, additive editor, forms, ZIP downloads and reusable local workflows. This is not yet the complete production SaaS. Thirteen advanced workflows remain unavailable; every tool page states its current limits.

## Run locally

Requires Node >=24.12.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8766. Run `npm test`, `npm run typecheck`, `npm run typecheck:server`, and `npm audit --omit=dev` before releasing. `npm run fixtures` regenerates synthetic test PDFs.

## Structure

- `apps/web`: Next.js frontend, statically exported to GitHub Pages
- `apps/api`: in-development Firebase-verified API (disabled by default)
- `apps/worker-node`: in-development queued processing and cleanup
- `packages/pdf-core`: shared PDF processing engine
- `packages/tool-registry`: actual capability registry
- `packages/config`: brand and public Firebase config
- `packages/i18n`: English/French dictionaries (full French coverage pending)
- `firebase`: deny-all rules for future private cloud storage
- `tests`: synthetic fixtures, processing/policy tests and optional real-auth smoke test
- `legacy-preview`: original static preview retained for reference

[Feature matrix](docs/FEATURE-MATRIX.md) · [Release evidence](docs/RELEASE-REPORT.md) · [Setup and deployment](docs/DEPLOYMENT.md) · [Architecture](docs/ARCHITECTURE.md) · [Licences](docs/LICENCES.md)

## Deployment

Push to main to run the pinned GitHub Pages workflow. The custom domain is https://parperly.com/. The root-domain build uses an empty NEXT_PUBLIC_BASE_PATH. Backend deployment requires VPS access, private storage/Redis, server identity and further integration/security tests. No payment provider or paid plans are enabled.
