# Deployment plan

No build or deployment commands are runnable yet: there is no application, package manifest, Docker image or infrastructure configuration. Produce those during implementation; do not represent scaffolding as a successful deployment.

Target separate deployments for Next.js frontend, Node API and isolated worker pools. Use private networking for Redis, least-privilege service identities for Firestore/object storage, TLS, managed secrets and a chosen data region. Start local development with Firebase emulators, Redis and disposable storage; never use production documents as fixtures.

Planned configuration categories: public Firebase client configuration; server Firebase credentials via workload identity; bucket and region; private Redis connection; allowed frontend origins; signing TTL; max bytes/pages/output count; per-tool time/memory limits; daily quotas; retention; engine versions; OCR language packs; optional provider secrets and webhook key. None should receive invented production values. Public Firebase configuration is distinct from privileged service credentials.

Before staging, add pinned dependencies, workspace scripts, multi-stage non-root Dockerfiles, compose services with health checks, Firestore/storage rules and indexes, CI tests, and documented startup/migration steps. Before production, verify secret injection, sandbox restrictions, queue reconciliation, cleanup scheduler, object lifecycle, alert routing, backups/restores, rollback and capacity limits.

Monitor queue age, failures by safe category, stage duration, memory/disk exhaustion, orphan objects, cleanup lag, quota discrepancies and validation failures. Avoid document contents and filenames in telemetry. Keep engine/capability kill switches available. A deployment report must name actual tested build commands, image digests and staging smoke-test evidence.
