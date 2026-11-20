# Current architecture

The selected architecture is preserved: Next.js/TypeScript React frontend; dedicated Node API and BullMQ workers; Firebase identity and planned Firestore/private storage metadata boundary. Because server hosting was initially absent, supported PDF operations run locally in an isolated browser worker. This is an additional processing path, not a claim that browser tools provide full native-engine capability.

`apps/web` statically exports for GitHub Pages. `packages/pdf-core` is shared worker-compatible processing code; `packages/tool-registry` owns the capability directory; `packages/config` centralizes brand and public Firebase identifiers; `packages/i18n` contains EN/FR UI dictionaries. Firebase SDK is lazily initialized for identity. No document bytes are persisted by the frontend. Local job history excludes filenames and content; workflow settings may contain user text and are explicitly stored only when saving a preset.

`apps/api` verifies Firebase tokens and owner/expiry predicates, enforces Redis rate limits and Firestore task reservations, accepts bounded PDF uploads, enqueues jobs and signs short-lived downloads. `apps/worker-node` uses a separate bounded Node/native process, validates outputs, fences publication against cancellation, and sweeps expired files. This backend is not exposed to the frontend and remains in development until real infrastructure and integration tests exist. It currently lacks complete crash recovery/retry/outbox handling and a hardened hostile-document sandbox.

Preserve these boundaries for future engines. OCR/Office/HTML conversion and encryption require separately reviewed native dependencies or licensed conversion SDKs. Do not expose them based on a UI route alone.
