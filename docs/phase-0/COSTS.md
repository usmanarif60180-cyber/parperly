# Infrastructure and cost planning

No provider quotes or prices are assumed. Costs depend on deployment region, concurrency, document sizes and retention.

Budget for frontend/API hosting, Redis service, worker CPU and memory (especially OCR), Firestore reads/writes/indexes, private storage and egress, monitoring, backups, fonts/language data and any commercial conversion/editor SDK. Billing processing fees and customer support are additional costs.

Measure per-tool worker-seconds, peak memory, input/output bytes, Firestore operations and download egress against a representative corpus before setting plan prices. Estimate monthly compute from tasks × measured runtime × concurrency efficiency; storage from daily retained bytes × retention days; add retries and peak headroom. Bound abuse with quotas and reservations before launching free processing.

Free/pass/monthly/annual/team plans remain configurable product definitions until pricing and provider integration are chosen. Do not display active paid entitlements without verified provider events. Domain, hosting region, retention policy, SDK selection and expected traffic remain unresolved launch inputs, not blockers to local Phase 1 work.
