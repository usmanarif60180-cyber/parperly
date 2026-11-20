# Paperly feature matrix

Baseline: 2026-11-20. All engines below are proposed, not installed. All tools are **Planned**; all test statuses are **Not run**. Engine selection and licence review are prerequisites, not claims of support.

Allowed implementation states: Planned, In Development, Implemented, Tested, Production Ready, Blocked. Implemented requires working code and validated output; Tested requires recorded relevant test evidence; Production Ready additionally requires security, load, deployment and operational gates. Use Blocked when a started feature cannot proceed due to a concrete dependency.

Common acceptance suite for every tool: real representative fixtures; malformed, encrypted, empty, oversized and spoofed inputs; page/text/image invariants; download and multi-output ZIP checks; mobile/desktop and keyboard operation; owner isolation; cancellation/retry; expiry/deletion. The final column adds tool-specific checks. No tests in this matrix have been executed.

Licence keys: L1 pdf-lib MIT; L2 PDF.js Apache-2.0; L3 qpdf Apache-2.0; L4 OCR stack needs component/deployment review; L5 LibreOffice bundled licences; L6 commercial/other engine not selected, blocked from adoption until review; L7 BullMQ MIT plus separately reviewed Redis terms. See LICENCES.md.

| # | Tool | Status | Proposed processing engine | Test status | Known limitations | External dependencies / licensing requirements | Additional acceptance tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | PDF Editor | Planned | pdf-lib + PDF.js; SDK evaluation | Not run | Additive editing first; existing text/font editing not covered | L1, L2, L6; pinned versions pending | Overlay positions, export, undo/redo |
| 2 | Fill & Sign | Planned | pdf-lib | Not run | AcroForms and drawn signatures; no certificate signing | L1; pinned versions pending | Field values, appearances, signature placement |
| 3 | Create PDF Forms | Planned | pdf-lib | Not run | AcroForms only; no XFA promise | L1; pinned versions pending | Field types, names, tab order and round-trip |
| 4 | Remove Annotations | Planned | Engine evaluation | Not run | Must preserve content and distinguish widgets | L6; pinned versions pending | Annotation removal with forms preserved |
| 5 | Merge PDF | Planned | pdf-lib | Not run | Bookmarks, forms and signatures need explicit handling | L1; pinned versions pending | Page order, text/images, mixed dimensions |
| 6 | Alternate & Mix PDF | Planned | pdf-lib | Not run | Define unequal-length and reverse-input behavior | L1; pinned versions pending | Interleaving and trailing pages |
| 7 | Organize PDF | Planned | pdf-lib | Not run | Thumbnails must map to immutable source IDs | L1; pinned versions pending | Reorder, duplicates and rotation |
| 8 | Delete PDF Pages | Planned | pdf-lib | Not run | Reject removing every page | L1; pinned versions pending | Selected removals and remaining order |
| 9 | Extract PDF Pages | Planned | pdf-lib | Not run | Validate ranges and duplicate policy | L1; pinned versions pending | Exact selection and ZIP entries |
| 10 | Split by Pages | Planned | pdf-lib | Not run | Bound output count | L1; pinned versions pending | Ranges, per-page files and archive |
| 11 | Split by Bookmarks | Planned | qpdf + outline adapter evaluation | Not run | Nested/destination semantics need validation | L3, L6; pinned versions pending | Named destinations and hierarchy |
| 12 | Split in Half | Planned | pdf-lib | Not run | Offer page-count split and explicit geometric split modes | L1; pinned versions pending | Odd page counts; geometry and rotation |
| 13 | Split by File Size | Planned | pdf-lib iterative writer | Not run | Single page may exceed target; no absolute guarantee | L1; pinned versions pending | Actual serialized sizes and impossible targets |
| 14 | Split by Text | Planned | Text extraction adapter + pdf-lib | Not run | Scans require OCR; matching boundaries explicit | L1; pinned versions pending | Unicode, repeated matches and no-match errors |
| 15 | Compress PDF | Planned | qpdf; optional raster optimizer evaluation | Not run | Lossless optimization may not reduce size | L3, L6; pinned versions pending | Readable output, size comparison and fidelity |
| 16 | OCR PDF | Planned | OCRmyPDF + Tesseract | Not run | Language packs; scans and recognition quality vary | L4; pinned versions pending | Searchable text, page alignment and sidecar |
| 17 | Deskew PDF | Planned | OCRmyPDF evaluation | Not run | Raster pages; may alter image fidelity | L4, L6; pinned versions pending | Rotation correction and text preservation |
| 18 | Repair PDF | Planned | qpdf | Not run | Best effort; cannot recover all corrupt content | L3; pinned versions pending | Recoverable and unrecoverable corruption |
| 19 | Grayscale PDF | Planned | Color-conversion engine evaluation | Not run | Color spaces/transparency need fidelity tests | L6; pinned versions pending | Rendered color and page integrity |
| 20 | PDF to Word | Planned | Commercial SDK evaluation | Not run | No reliable engine chosen; no fidelity guarantee | L6; pinned versions pending | Tables, columns, fonts and editable output |
| 21 | PDF to Excel / CSV | Planned | Table extraction/SDK evaluation | Not run | Tables versus free text; spreadsheet formula injection | L6; pinned versions pending | Cell structure, CSV escaping and scanned tables |
| 22 | PDF to PowerPoint | Planned | Commercial SDK evaluation | Not run | Editable layouts differ from raster slides | L6; pinned versions pending | Slide count, text editability and layout |
| 23 | PDF to Images | Planned | Isolated renderer evaluation | Not run | DPI, memory and output-count bounds; JPG/PNG/TIFF | L6; pinned versions pending | Pixel dimensions, transparency and ZIP |
| 24 | PDF to Text | Planned | Text extractor evaluation | Not run | Reading order and scanned pages | L6; pinned versions pending | Unicode, columns and empty-text handling |
| 25 | Extract Images from PDF | Planned | Image extractor evaluation | Not run | Embedded images differ from rendered pages | L6; pinned versions pending | Masks, color spaces and duplicate policy |
| 26 | Images to PDF | Planned | pdf-lib + image decoder evaluation | Not run | JPEG/PNG native; TIFF requires decoder | L1, L6; pinned versions pending | Orientation, DPI, multi-frame TIFF and sizing |
| 27 | Word to PDF | Planned | LibreOffice | Not run | Missing fonts and macros; fidelity varies | L5; pinned versions pending | DOC/DOCX layout and safe conversion |
| 28 | HTML to PDF | Planned | Sandboxed browser evaluation | Not run | Remote fetching disabled initially | L6; pinned versions pending | Pagination, scripts disabled and SSRF probes |
| 29 | Protect PDF | Planned | qpdf | Not run | Permissions are viewer-dependent | L3; pinned versions pending | Password opening and selected permissions |
| 30 | Unlock PDF | Planned | qpdf | Not run | Require authorized password when encrypted | L3; pinned versions pending | Correct/wrong password and readable result |
| 31 | Watermark PDF | Planned | pdf-lib | Not run | Unicode fonts require licensed embedding | L1; pinned versions pending | Opacity, placement and page ranges |
| 32 | Flatten PDF | Planned | pdf-lib forms; annotations adapter evaluation | Not run | Form flattening differs from all annotation flattening | L1, L6; pinned versions pending | Appearances preserved and fields removed |
| 33 | Crop PDF | Planned | pdf-lib | Not run | Crop box hides content; not secure redaction | L1; pinned versions pending | Boxes, rotation and hidden-content disclosure |
| 34 | Resize PDF | Planned | pdf-lib | Not run | Specify canvas resize versus content scaling | L1; pinned versions pending | Dimensions, aspect ratio and clipping |
| 35 | Rotate PDF | Planned | pdf-lib | Not run | Normalize existing rotations | L1; pinned versions pending | Angles and mixed orientations |
| 36 | Flip PDF | Planned | pdf-lib | Not run | Transform content; annotations need handling | L1; pinned versions pending | Horizontal/vertical geometry and text |
| 37 | N-up PDF | Planned | pdf-lib | Not run | Define ordering, gutters and sheet size | L1; pinned versions pending | Placement, last sheet and scaling |
| 38 | Add Page Numbers | Planned | pdf-lib | Not run | Font coverage and page-range settings | L1; pinned versions pending | Offsets, placement and ranges |
| 39 | Header & Footer | Planned | pdf-lib | Not run | May overlap existing content | L1; pinned versions pending | Margins, templates and Unicode |
| 40 | Bates Numbering | Planned | pdf-lib | Not run | Not a certification or legal compliance claim | L1; pinned versions pending | Prefixes, padding and cross-file sequence |
| 41 | Create Bookmarks | Planned | Outline adapter evaluation | Not run | Named and explicit destinations | L6; pinned versions pending | Hierarchy, destinations and reader compatibility |
| 42 | Edit PDF Metadata | Planned | pdf-lib; XMP adapter evaluation | Not run | Info dictionary and XMP may disagree | L1, L6; pinned versions pending | Round-trip and synchronized supported fields |
| 43 | Rename PDF | Planned | Private storage/download metadata | Not run | Rename only; preserve bytes | L6; pinned versions pending | Safe filename, headers and identical checksum |
| 44 | PDF Workflow Builder | Planned | Typed registry + BullMQ orchestration | Not run | Only implemented compatible steps; bounded DAG/linear sequence first | L7; pinned versions pending | Reorder, compatibility, cancellation and summary |

## Platform coverage

All items below are Planned / Not run.

| Area | Deliverables | Release evidence |
| --- | --- | --- |
| Design and discovery | Responsive navigation, hero/search/editor entry, popular tools, categorized directory, how-it-works, privacy explanation, advantages, FAQs, footer | Real links, no fake claims, keyboard and mobile checks |
| Shared tool UI | Drop/picker upload, format/size/page validation, multi-file handling, thumbnails, settings, progress, cancel/retry/remove/start over, downloads/ZIP, instructions and related tools | Contract/UI tests against actual jobs |
| Editor interaction | Rendering, zoom/navigation, text/font/color, images, selection/move/resize/delete, shapes, drawing, highlights/underline/strike, links, whiteout, undo/redo, export | Coordinate and export tests; unsupported controls absent |
| Identity | Firebase registration/login/logout, email verification/reset, profile/security settings | Emulator and staging auth tests |
| Processing | Private storage, API, Redis/BullMQ, workers, validation, quotas, retries, cancellation and cleanup | Crash/race/timeout/isolation tests |
| Dashboard | Overview, own history, usage, saved workflows, subscription and deletion controls | Cross-user authorization and accurate usage |
| Billing | Configurable free/pass/month/year/team plan definitions; provider integration gated | Signed webhook replay/idempotency and real sandbox events |
| Workflows | Multiple documents, configure/reorder/remove steps, type validation, persistence, step status, final download and summary | Actual multi-step outputs and partial failure tests |
| Localization | Separate English/French dictionaries, locale routing and RTL-ready layout | Translation completeness and accessible localized errors |
| Public content | Home, directory, tool pages, pricing, about/contact/help/FAQ, privacy/terms/cookies/security/API docs | Accurate copy, metadata, canonical URLs, sitemap and robots |
| Support | Owned support tickets and configured delivery channel | Submission persisted; no false sent status |
| Operations | Docker, env templates, Firebase rules/indexes, deployment, monitoring, retention and cost docs | Reproducible build, restore and staging smoke test |

## Local prototype increment

Merge, extraction and rotation now have limited browser-only implementations in `preview/`. Synthetic smoke tests passed: merge page count, extraction order/dimensions, rotation angle, invalid range and invalid signature rejection. This is not the complete tool acceptance suite; production matrix statuses above remain Planned for the full server-backed workflows. Preview UI and merge dialog were inspected in browser. Full localization, mobile interaction testing, real-document corpus, accounts and infrastructure remain outstanding.
