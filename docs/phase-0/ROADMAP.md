# Implementation roadmap

Follow the requested phases with small reviewable increments. At every phase report delivered capabilities, exact test evidence, remaining defects and external dependencies. Never enable a capability just to fill the directory.

| Phase | Work | Exit gate | External prerequisites |
| --- | --- | --- | --- |
| 0 | Audit, architecture, 44-tool matrix, branding, licence triage | Document consistency checks; empty-workspace limitation recorded | Existing repository, if one was intended |
| 1 | Next.js design system, original SVG logo, public/tool routes, registry, EN/FR, responsive navigation | Production frontend build, route/translation coverage, keyboard/mobile inspection; unavailable tools clearly gated | Package versions/licences, domain later |
| 2 | API, Firebase auth/emulators, metadata/rules, private storage, Redis/BullMQ, workers, state/outbox, quotas and cleanup | Auth/ownership/rules tests; worker crash, cancellation, expiry and upload attack tests | Firebase project for staging, private storage, Redis terms and worker host |
| 3 | First end-to-end merge; then split/extract/delete/organize/rotate/watermark; qpdf protect/unlock and conservative compression | Each tool passes real output and security tests before activation | Pinned engines and representative fixtures |
| 4 | Images/Word conversions, OCR, deskew, repair, HTML sandbox, PDF-to-Office evaluation | Fidelity corpus and resource tests; unsupported conversions remain unavailable | OCR licence path, fonts/languages, conversion SDK if needed |
| 5 | Additive editor, forms and drawn signatures, annotation removal | Render/export coordinate tests, undo/redo and appearance preservation; limitations visible | Existing-content editing SDK only if adopted |
| 6 | Remaining advanced utilities and split modes | Tool-specific invariants including boxes, bookmarks, text/image extraction and metadata | Evaluated adapters/renderers |
| 7 | Dashboard, transactional usage, saved typed workflows, support, billing | Ownership, concurrency, workflow compatibility, webhook/replay and subscription tests | Provider account/credentials; team membership design before team billing |
| 8 | Full regression, security review, performance, monitoring, deployment and final matrix | Reproducible staging deployment, adversarial tests, restore/cleanup drills, operational review | Production region/domain, legal identity/policies, service credentials and budget |

Safest sequence: establish the Phase 1 interface without live uploads, then implement the Phase 2 security boundary. Use merge as the first real upload-to-download vertical slice before expanding the engine surface. Investigate conversion and OCR licensing early during architecture/dependency selection, so expensive feature work does not depend on an unapproved engine. Ship only independently tested capabilities.

## Test strategy

Build a versioned fixture corpus with provenance/licences: vector text, scans, mixed orientation/size, Unicode, forms/XFA, bookmarks, annotations, signatures, encrypted PDFs, damaged xrefs, embedded images, complex tables and large inputs. Use independent parsing/rendering checks rather than merely checking that an output file exists. Keep golden text/page invariants and visual comparisons with explicit tolerances; do not promise byte equality after rewrites.

Integration tests exercise API-to-queue-to-worker-to-storage. Security tests cover owner A versus B, forged tokens, settings injection, path traversal, poisoned filenames, stale download URLs, decompression bombs, SSRF including redirects/IPv6, webhook replay, quota races and cancellation/completion races. Firebase emulator rule tests must include allow and deny cases; Admin SDK bypass means API authorization needs separate tests.

Browser tests cover both languages, narrow/wide screens, keyboard focus, accessible status announcements, real preview and download, retries and input removal. Load tests establish concurrency, memory, disk and deadline limits using actual fixture workloads. Record test command, commit, environment, fixture set and results in phase reports.
