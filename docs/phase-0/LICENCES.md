# Dependency and licensing review

Preliminary research on 2026-11-20. No packages are installed and no version lockfile exists. These findings do not constitute a complete licence clearance or vulnerability scan. Review exact pinned versions, transitive dependencies, native binaries, fonts, models and container layers before introducing each dependency.

| Candidate | Evidence and risk | Adoption gate |
| --- | --- | --- |
| pdf-lib | [Upstream MIT licence](https://github.com/Hopding/pdf-lib/blob/master/LICENSE.md); [documented scope](https://github.com/Hopding/pdf-lib) is not a full existing-content editor | Preserve notices; benchmark supported operations |
| PDF.js | [Upstream Apache licence](https://github.com/mozilla/pdf.js/blob/master/LICENSE) | Retain applicable notices and review bundled assets |
| qpdf | [Upstream licensing](https://github.com/qpdf/qpdf/blob/main/manual/license.rst) states Apache-2.0 | Inspect pinned binary and dependencies |
| BullMQ core | [Maintainer description](https://bullmq.io/about/) states MIT | Keep core and paid Pro/dashboard terms separate |
| Redis | [Official licence table](https://redis.io/legal/licenses/) varies by version; Redis 8 offers RSALv2, SSPLv1 or AGPLv3 | Select explicit version/licence/deployment terms; do not assume BSD; consider a reviewed managed offering |
| OCRmyPDF stack | [Upstream cloud guidance](https://github.com/ocrmypdf/OCRmyPDF/blob/main/docs/cloud.md) flags Ghostscript AGPL implications; [contributing/licensing](https://ocrmypdf.readthedocs.io/en/stable/contributing.html) describes project licensing | Review OCRmyPDF, Tesseract, Ghostscript, optional optimizers and language data together; commercial licensing may be needed for intended distribution/service model |
| LibreOffice | [Official licence page](https://www.libreoffice.org/licenses/) directs users to bundled licence information | Inspect exact distribution and fonts; preserve notices and satisfy applicable obligations |
| Next.js, React, TypeScript, Tailwind, Node, Firebase SDKs, validators, test tooling | Requested/candidate stack; exact packages and versions not selected or reviewed | Read upstream and installed licence files before adoption; check runtime support and security advisories |
| Renderers, image decoders, extractors, browser runtime, Python libraries | Unselected | Review full transitive/native dependency tree; do not silently introduce copyleft SDKs |
| Commercial conversion/editor SDK | No vendor chosen | Confirm server/SaaS/OCR rights, quotas, data handling, hosting region and recurring fees |

Isolation behind a subprocess or service boundary is not by itself a conclusion about licence obligations. Resolve uncertain obligations before implementation depends on the engine.

Generate an SBOM from each release lockfile/container, record SPDX identifier and source/version, retain required notices, and block unknown/disallowed licences in CI. Run advisory scans after locking dependencies and before deployment. Do not choose an obsolete release solely for its older licence.
