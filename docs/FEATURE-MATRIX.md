# Feature matrix — current release

2026-11-20. 31 local tool workflows have real processing paths; 13 are not available. No feature is marked Production Ready. “Implemented” covers the limited mode described here, not every subfeature in the master brief.

| Tool | Status | Engine | Test evidence | Limitations / remaining work | External dependency |
| --- | --- | --- | --- | --- | --- |
| PDF Editor | Implemented | PDF.js + pdf-lib | Browser output verified; full corpus pending | Additive text, PNGs, rectangles, highlights, whiteout, object position/size, undo/redo. No existing-text editing, links, freehand annotation, font substitution or secure redaction. Latin fonts only. | None for local processing |
| Fill & Sign | Implemented | PDF.js + pdf-lib | Unit smoke tests; full corpus pending | Existing AcroForm text and checkboxes; drawn PNG signature placement. No certificate signing; dropdown filling UI not implemented. | None for local processing |
| Create PDF Forms | Implemented | pdf-lib | Unit smoke tests; full corpus pending | One text, checkbox or dropdown per run; repeat on output for additional fields. No radio button builder or XFA. | None for local processing |
| Remove Annotations | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Removes annotations except widgets; per-page selection. Does not offer individual comment selection. | None for local processing |
| Merge PDF | Implemented | pdf-lib | Browser output verified; full corpus pending | PDF inputs, explicit per-file ranges, file order/sorting and optional form flattening. No image inputs, covers, TOC or bookmarks. | None for local processing |
| Alternate & Mix PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Organize PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Page ranges specify reorder/duplicates; viewer is page-by-page, not a drag-and-drop multi-document thumbnail board. | None for local processing |
| Delete PDF Pages | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Extract PDF Pages | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Split by Pages | Implemented | pdf-lib | Browser output verified; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Split by Bookmarks | Planned | BullMQ orchestration (planned) | Not run | Bookmark destination resolution is not yet implemented. | Bookmark destination resolution is not yet implemented. |
| Split in Half | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Geometric horizontal/vertical splitting; reject rotated input until normalized. | None for local processing |
| Split by File Size | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Split by Text | Implemented | PDF.js + pdf-lib | Unit smoke tests; full corpus pending | Literal matching starts a new output at matching pages. Does not detect changing regex values. | None for local processing |
| Compress PDF | Blocked | BullMQ orchestration (planned) | Not run | A server-side image optimization engine is required. Re-saving a PDF alone is not compression. | A server-side image optimization engine is required. Re-saving a PDF alone is not compression. |
| OCR PDF | Blocked | BullMQ orchestration (planned) | Not run | OCRmyPDF/Tesseract worker hosting and licensing review are required. | OCRmyPDF/Tesseract worker hosting and licensing review are required. |
| Deskew PDF | Blocked | BullMQ orchestration (planned) | Not run | An isolated scan-processing worker is required. | An isolated scan-processing worker is required. |
| Repair PDF | Blocked | BullMQ orchestration (planned) | Not run | A hosted qpdf worker is required for structural repair. | A hosted qpdf worker is required for structural repair. |
| Grayscale PDF | Implemented | PDF.js + pdf-lib | Build/type checks; browser acceptance pending | Rasterizes selected pages; loses searchable text, links, forms and vector objects. | None for local processing |
| PDF to Word | Blocked | BullMQ orchestration (planned) | Not run | An evaluated DOCX conversion engine is required. | An evaluated DOCX conversion engine is required. |
| PDF to Excel / CSV | Blocked | BullMQ orchestration (planned) | Not run | An evaluated table extraction engine is required. | An evaluated table extraction engine is required. |
| PDF to PowerPoint | Blocked | BullMQ orchestration (planned) | Not run | An evaluated presentation conversion engine is required. | An evaluated presentation conversion engine is required. |
| PDF to Images | Implemented | PDF.js + pdf-lib | Browser output verified; full corpus pending | PNG/JPEG only, 72–216 DPI, 80 pages and pixel/output limits. TIFF not implemented. | None for local processing |
| PDF to Text | Implemented | PDF.js + pdf-lib | Build/type checks; browser acceptance pending | Embedded text only. No OCR; reading order depends on source text items. | None for local processing |
| Extract Images from PDF | Planned | BullMQ orchestration (planned) | Not run | An embedded-image extraction adapter is required; rendered pages are available separately. | An embedded-image extraction adapter is required; rendered pages are available separately. |
| Images to PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | JPEG/PNG; A4 or original size; margins/orientation. TIFF/EXIF orientation handling not implemented. | None for local processing |
| Word to PDF | Blocked | BullMQ orchestration (planned) | Not run | An isolated LibreOffice worker is required. | An isolated LibreOffice worker is required. |
| HTML to PDF | Blocked | BullMQ orchestration (planned) | Not run | An isolated browser worker with restricted network access is required. | An isolated browser worker with restricted network access is required. |
| Protect PDF | Blocked | BullMQ orchestration (planned) | Not run | A hosted qpdf encryption worker is required. | A hosted qpdf encryption worker is required. |
| Unlock PDF | Blocked | BullMQ orchestration (planned) | Not run | A hosted qpdf password-handling worker is required. | A hosted qpdf password-handling worker is required. |
| Watermark PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Flatten PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Supported AcroForm fields only; no general annotation or XFA flattening. | None for local processing |
| Crop PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Resize PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Rotate PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Flip PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| N-up PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Add Page Numbers | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Header & Footer | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Basic mode; advanced structures/signatures may not be preserved. Full acceptance corpus pending. | None for local processing |
| Bates Numbering | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Single document at a time. No cross-document numbering continuity UI. | None for local processing |
| Create Bookmarks | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Flat Title|page outline replaces existing bookmarks; hierarchical editing not implemented. | None for local processing |
| Edit PDF Metadata | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Info fields supported; old XMP removed to avoid conflicts. | None for local processing |
| Rename PDF | Implemented | pdf-lib | Unit smoke tests; full corpus pending | Manual safe filename only; batch suffixes. Text-based automatic naming not implemented. | None for local processing |
| PDF Workflow Builder | Implemented | Local orchestration | Browser output verified; full corpus pending | 11 compatible local PDF-to-PDF steps, up to 8 steps, multiple inputs processed sequentially; local per-account presets. No cloud preset storage. | None for local processing |

## Platform status

- Next.js/React/TypeScript/Tailwind frontend and static GitHub Pages export: implemented, production build passes.
- PDF.js real rendering and local cancellable PDF worker: implemented; browser smoke tests pass.
- Firebase email/password registration/login: configured and live REST smoke tested with a disposable identity, then deleted. Google provider enabled and official GitHub Pages domain authorized; interactive Google login has not been completed by QA.
- Password reset, verification and profile update: connected to Firebase SDK; actual email delivery and user interaction not tested.
- Local per-account job history and workflow presets: implemented. Browser-local metadata is not cloud storage or an enforceable paid usage ledger.
- EN/FR navigation, directory and common tool UI: implemented. Settings, errors, account/legal content still contain English; complete French localization is pending.
- Node API/BullMQ/GCS worker: in development, typechecked, ownership helper tests pass. No Redis/storage credentials or hosting configured; not connected to public frontend. Distributed crash recovery, retries, retention races and sandbox penetration testing remain required.
- Firestore/storage deny-all rules: supplied, not deployed or emulator tested. No browser document access is enabled.
- Paid plans, billing, teams, cloud dashboard/history, private support tickets, Drive/Dropbox integrations: planned, not configured.
- Mobile CSS and keyboard focus styles exist. Fixed mobile viewport QA could not be completed because the browser viewport override was not applied; native mobile testing remains outstanding.
- Domain parperly.com: user purchased through OVH; DNS/HTTPS switch not yet authorized for execution or configured. VPS details requested.
