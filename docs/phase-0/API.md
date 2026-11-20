# Proposed API contracts

Draft v1; no endpoints exist. All protected endpoints require Firebase bearer identity and server-side authorization. Validate bodies with shared versioned schemas. Errors use `{code, messageKey, requestId, retryable}` without document contents or stack traces.

| Endpoint | Purpose |
| --- | --- |
| GET /v1/tools | Public capability registry and accepted types/limits; no secrets |
| POST /v1/uploads | Reserve owned upload; return bounded short-lived upload URL and file ID |
| POST /v1/uploads/:id/complete | Verify uploaded object and run isolated preflight |
| DELETE /v1/files/:id | Deny access immediately; schedule physical deletion |
| POST /v1/jobs | Tool ID, input IDs, schema-versioned settings, idempotency key; return job ID |
| GET /v1/jobs/:id | Owned status, stage, measured progress and safe failure information |
| GET /v1/jobs | Owner-scoped paginated history |
| POST /v1/jobs/:id/cancel | Idempotent cancel request with attempt fencing |
| POST /v1/jobs/:id/retry | New bounded attempt only when inputs are retained and error is retryable |
| GET /v1/jobs/:id/download | Authorize completed retained output and sign short-lived URL |
| GET/POST/PATCH/DELETE /v1/workflows[/:id] | Owner-scoped typed reusable steps; validate compatibility |
| POST /v1/workflows/:id/runs | Execute immutable workflow version with owned inputs |
| GET /v1/me/usage | Transactionally accounted quotas/reservations |
| POST /v1/support-tickets | Persist authenticated request; delivery claim only on confirmed integration |
| POST /v1/billing/checkout | Enabled only with configured real provider and validated plan |
| POST /v1/billing/webhook | Provider signature verification, replay protection, authoritative entitlements |

Generate OpenAPI from actual schemas during implementation; this table is not a usable developer API. Reject arbitrary object keys, filesystem paths and executable names from clients. Enforce settings allowlists and input/output compatibility centrally.
