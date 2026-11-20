# Dependency licence and security record

Direct package licence metadata was checked on the official npm registry before installation. Locked versions and the complete dependency graph are in package-lock.json. This is a technical inventory, not a legal opinion.

| Dependency | Licence | Use |
| --- | --- | --- |
| Next.js, React, React DOM | MIT | Frontend |
| TypeScript | Apache-2.0 | Types/compiler |
| Tailwind CSS / PostCSS plugin | MIT | Styling |
| pdf-lib 1.17.1 | MIT | PDF manipulation |
| pdfjs-dist 6.5.438 | Apache-2.0 | Rendering/extraction |
| fflate 0.8.3 | MIT | ZIP creation |
| lucide-react 1.77.0 | ISC | Icons |
| Firebase client and admin SDKs | Apache-2.0 | Identity / future server metadata |
| BullMQ core | MIT | Future queue processing |
| Express, Zod, esbuild, tsx, TypeScript declaration packages | MIT (TypeScript compiler itself Apache-2.0) | API/build/tests |
| qpdf native package in proposed Docker image | Apache-2.0; inspect exact distribution dependencies | Structural repair/optimization, not deployed |

No Redis server binary has been installed. Select and review the exact managed Redis version/terms before deployment; modern Redis is not universally BSD-licensed. No Ghostscript, OCRmyPDF, LibreOffice or commercial SDK has been introduced. Their deployment/asset/font/model terms remain adoption gates.

Production npm audit initially found vulnerable transitive @grpc/grpc-js and a vulnerable Zod version. Zod is now 4.6.7 and the compatible gRPC override is >=1.14; the repeated production dependency audit reports zero advisories at release time. Retain upstream licence notices in packages/assets and re-run the audit before releases. GitHub Actions references are pinned to verified release SHAs.
