# Security design and release gates

Planned controls; none are implemented or certified.

Authenticate every API request with verified Firebase identity and enforce owner checks on referenced files, jobs, workflows, support tickets and downloads. Deny direct client writes to jobs, entitlements, usage and server configuration. Prefer deny-all direct bucket access with API-issued short-lived URLs. Rules are defense in depth; server Admin SDK calls require explicit authorization.

Treat documents as hostile. Validate signatures and parse limits, restrict formats, randomize server paths, never interpolate filenames/settings into shell commands, and never serve user HTML on the application origin. Disable PDF scripts/embedded actions in previews. Isolate native processing with non-root user, read-only root filesystem, bounded scratch volume, dropped capabilities, no host mounts, restricted system calls, network disabled by default, and enforced CPU/memory/process/time/output-size limits. Kill the whole process group on timeout/cancel.

HTML rendering needs an isolated browser with local file access and external networking disabled initially. If URL input is added, validate all DNS results, redirects and IPv4/IPv6 targets through enforced egress filtering; deny private/link-local/metadata destinations. Application string checks alone are insufficient.

Passwords must be ephemeral and excluded from URLs, queue payloads, logs and telemetry. Use a short-lived secret reference for encrypted-document processing and a supported private stdin/file-descriptor mechanism for engine input. Redact filenames, text, document bytes, bearer tokens and signed URLs from logs. Metrics use opaque IDs and error categories.

Reserve quotas transactionally; rate-limit by verified user and IP. Make retry, usage commit and webhook processing idempotent. Cancellation and deletion must fence off in-flight output publication. Separate upload storage from validated outputs; archive extraction and generated ZIP paths must be safe and bounded.

Retention is configurable and must be accurately disclosed after deployment choices. Delete objects and derivatives explicitly, track retryable deletion failures, and align bucket versions, backups and logs with policy. Do not claim immediate irreversible deletion while backups or signed access remain. Account deletion must revoke sessions and enumerate owned objects/records safely.

Before production: emulator rules tests, API cross-owner tests, malicious file corpus, dependency scan, sandbox escape review, SSRF tests, secret/log inspection, load limits, cleanup/restore drills and incident response runbook. No secure-redaction feature is currently planned as implemented; crop and whiteout do not remove sensitive content reliably.
