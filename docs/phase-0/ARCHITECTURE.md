# Paperly architecture proposal

Status: proposed for implementation; no deployed components. Preserve the requested Next.js/TypeScript, dedicated Node API, Firebase, Redis/BullMQ and isolated workers architecture.

## Components and boundaries

- `apps/web`: Next.js, React, TypeScript, Tailwind, accessible shared components, PDF.js rendering and English/French locale routes. Never ship administrative credentials or trust client validation.
- `apps/api`: dedicated Node/TypeScript HTTP API. Verify Firebase ID tokens, validate schemas, authorize ownership, reserve quotas, sign uploads/downloads and expose job status. No CPU-heavy PDF work in request handlers.
- `apps/worker-node`: BullMQ orchestration and pdf-lib operations. Launch native engine processes in bounded isolated execution units.
- `apps/worker-python`: private Python task runner for OCR and specialized processing. A Node BullMQ consumer invokes it through a constrained local process/container interface; do not assume a Python BullMQ client is interchangeable.
- Firestore: metadata and authoritative job/usage state. Private Google Cloud Storage/Firebase Storage buckets: document bytes. Redis: durable queue and rate-limiting coordination, never the sole job record.
- `packages/contracts`: versioned API/settings schemas; `tool-registry`: stable IDs, capability gates, input/output MIME types, engine and limits; `pdf-core`: processing adapters; `config`: branding and validated environment/plan limits; `i18n`: separate `en.json`/`fr.json`; `ui`: reusable interface.
- `infrastructure`: independent frontend/API/worker deployment, private Redis network, bucket lifecycle rules and container sandbox policies. Docker Compose is local development, not a production isolation guarantee.

## Processing lifecycle

1. Authenticated client asks for an upload allocation. API checks quota and creates an opaque owner-scoped object key and short-lived upload authorization.
2. On upload completion, server checks object size, signature, allowed format and parsing/page limits in an isolated preflight. Reject MIME/extension spoofing and oversized decompressed inputs. Only accepted uploads become `uploaded`.
3. Job creation validates registered capability and settings, checks every input owner, reserves usage transactionally and records an outbox entry. Dispatcher sends an idempotent BullMQ task. Reconciliation repairs Firestore/Redis partial failures.
4. Job states: `uploaded → queued → processing → validating → completed`. Nonterminal jobs may become `failed` or `cancelled`; retention makes stored results `expired`. Record monotonic state version, attempt ID, timestamps, progress stage and safe error code.
5. Worker uses lease/attempt fencing, bounded scratch space and deadlines. Publish output metadata only if the current attempt still owns the job and cancellation is absent. Crash retries cannot duplicate charges or publish stale outputs.
6. Independent validation checks output MIME, parseability, expected page count/order and tool-specific invariants. Store checksums and validation summary. Publish a completed state only after private output persistence succeeds.
7. Download API rechecks ownership, completion and expiry before issuing a short-lived signed URL. Cancel/delete revokes application access immediately; already issued URLs last until expiry unless the object is removed.
8. Cleanup removes originals, intermediate files, outputs and temporary archives on expiry or deletion, retries failures and reconciles orphan objects. Firestore TTL alone does not delete files.

Progress is measured from actual stages/pages where supported; otherwise show an indeterminate stage. Cancellation removes queued work or terminates the active process group and cleans scratch data. Retry creates a new attempt, only for retryable errors and retained valid inputs.

## Metadata schema

All user data carries immutable `ownerId`, creation/update times and schema version. Server-controlled fields cannot be changed by clients.

| Collection | Main fields and access |
| --- | --- |
| users | UID, profile, locale; user-editable allowlisted profile fields |
| files | Owner, opaque bucket key, MIME, bytes, pages, checksum, expiresAt, deletion state; API-managed |
| jobs | Owner, tool ID/version, input/output IDs, validated settings, state, attempt, progress, error, expiresAt |
| workflows | Owner, version, ordered typed steps, validated settings |
| subscriptions | Owner/team, provider IDs, entitlement state; verified webhook writes only |
| usage | Owner, period, reservations and committed counters; transactional server writes |
| supportTickets | Owner, message and consented attachments; no automatic document inclusion |
| systemConfig | Versioned limits/capability flags; admin-only writes, safe public subset exposed by API |

Index jobs by owner/createdAt and owner/status/createdAt, files by expiry and deletion state, and outbox by dispatch state/time. Define indexes alongside actual queries. Start single-user ownership; team ACLs require a separate membership model before team plans launch.

## Capability decisions

Use pdf-lib for additive content, basic forms and page manipulation; PDF.js for previews. Use qpdf for structural checks and password/security operations after verification. OCRmyPDF/Tesseract and LibreOffice run only in dedicated workers after licence and resource review. Evaluate a licensed commercial SDK for PDF-to-Office and existing-content editing; no chosen vendor or promised fidelity yet.

HTML-to-PDF initially accepts uploaded HTML with remote requests disabled. URL conversion requires a separate egress proxy with DNS/IP and redirect validation. Do not expose unrestricted browser navigation.

Sites hosting is not selected for the processing backend: its Worker runtime is not the required native-process/container environment. The requested architecture is unchanged. Use conventional Node/container hosting; any future optional Sites frontend must call the same secured API.

## UI and routing

Use `/en` and `/fr` locale prefixes and `/[locale]/tools/[tool-slug]`, with stable tool IDs independent of translations. Tool pages share upload, measured status, cancel/retry, settings, previews, verified downloads, related tools and FAQs. Inactive tools explain availability and have no executable start action. Search filters the actual registry. Locale files cover errors and accessibility labels too.

Public pages: home, directory, pricing, about, contact, help, FAQ, privacy, terms, cookies, security and API docs. Generate metadata, canonical/hreflang URLs and sitemap from a configured origin and published capabilities. Draft legal pages must reflect actual infrastructure before launch.
