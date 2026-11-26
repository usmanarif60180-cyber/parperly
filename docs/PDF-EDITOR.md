# Parperly PDF Editor

The existing `/tools/pdf-editor/` route now opens a dedicated editing workspace. It keeps the established green/white site styling; visible branding is corrected to **Parperly**. Other tool implementations are unchanged.

## Working local features

- File picker and drag/drop opening; PDF.js page rendering, lazy thumbnails, navigation, zoom and fit modes.
- Added-object selection, drag movement, resize/rotation handles, numerical positioning, duplication and deletion; 80-step undo/redo, dirty state and discard confirmation.
- Added multiline text with Helvetica, Times and Courier, bold/italic, size, color, alignment and line spacing. Find/replace operates on added text. Built-in fonts support Latin/WinAnsi; unsupported text fails export explicitly.
- PNG/JPEG insertion/replacement, transparency, aspect-preserving resize, rotation and opacity.
- Drawn, typed and uploaded signatures/initials; placement on current/all/range-selected pages. Optional reusable signature storage is localStorage, explicitly disclosed and removable.
- Original text fields, checkboxes, radio groups and dropdowns. Original field dictionaries/widgets survive default exports and reordering. Unsupported field types and multi-select dropdowns are retained but not editable; their existing values are preserved.
- URI and internal page links; external URL validation; replacement/removal of original URL links and removal of original annotations.
- Highlight, underline and strikeout by clicking an embedded text run or dragging an area; freehand ink and actual sticky-note annotations. Color, opacity, thickness and annotation appearance streams are written to the PDF.
- Rectangles, circles, ellipses, lines, arrows and checkmarks. Whiteout is an opaque visual cover, explicitly **not secure redaction**.
- Portrait/landscape blank pages, append another PDF after the current page, duplicate, delete, rotate, reorder by dragging or buttons.
- Actual PDF export with custom filename and reopened page-count validation. Apply opens the generated PDF for visual review. No-edits requests do not report an editing success. Optional flattening covers original forms and newly added annotations; original annotations and links remain interactive.

## Deliberate limitations

pdf-lib cannot rewrite original page text or images. No overlay is presented as original-text editing. The licensed bridge below is required for those operations. OCR adds a searchable hidden text layer; it does not replace scanned pixels with editable lettering.

Original annotations removed/replaced in the editor remain visible in the base canvas until Apply refreshes the generated-PDF preview. Imported and duplicated form fields are flattened, while original document fields remain interactive. Named/internal links in imported pages and complex document-level structures (tags, scripts, outlines, digital signatures) are not guaranteed to survive page copying; signed documents require separate validation after any modification. The editor does not implement secure redaction, digital signing, Unicode font embedding, or arbitrary original-text font restyling.

## Licensed integration: prepared, not enabled

`apps/editor-service` is a separate Node service. It is **not deployed, license-validated, or advertised as active** without server setup. It uses `@pdftron/pdfnet-node` **12.2.1**, a commercial Apryse Server SDK dependency. Its methods were checked against that package's shipped TypeScript declarations:

- `PDFNet.ContentReplacer.addText(rect, replacement)` removes/replaces actual text within a PDF-space rectangle and retains the predominant existing font/style. Reflow is confined to that region; text can overflow, fonts may lack glyphs, and complex layouts need review.
- `ContentReplacer.addImage(rect, image.getSDFObj())` replaces the image best matching the selected region. It does not edit vector drawings as images.
- `PDFNet.OCRModule.processPDF(doc)` requires the separately installed/licensed OCR resources. `isModuleAvailable()` gates OCR availability.

A WebViewer-only license does not establish entitlement to the Server SDK. Confirm license scope with Apryse. The optional browser-based WebViewer integration is described below; it requires a separate browser-distributable license and explicit approval for client delivery. Server SDK secrets remain server-side.

The browser reads only `NEXT_PUBLIC_EDITOR_API_URL`, never an SDK key. The optional panel checks capabilities, requires sign-in and explicit upload consent, and posts the current PDF to `/v1/editor`. The service verifies Firebase ID tokens and verified email, restricts origins, caps request size/rate/concurrency, and runs native processing in a disposable child with a 120-second deadline. Inputs/outputs are not persisted or logged by this service. It validates the resulting PDF before returning it. Undo restores the pre-server-edit workspace; returned content becomes the new PDF source.

### Deployment steps (requires VPS access and license)

1. Confirm a Linux-compatible Apryse **Server SDK** license covering content replacement, plus OCR entitlement/resources if required.
2. On the VPS, copy `apps/editor-service`; create `.env` from `.env.example` with restrictive file permissions. Enter `APRYSE_LICENSE_KEY` there using the server's secret mechanism, never chat, Git, GitHub variables, CLI arguments, or `NEXT_PUBLIC_*`.
3. Configure a least-privilege Firebase Admin identity for project `parperly` through Application Default Credentials (the compose example mounts `secrets/firebase-service-account.json` read-only). Install licensed OCR resources under `resources/`. These paths are gitignored.
4. Enable only licensed, tested features with `ENABLE_CONTENT_EDITING=true` / `ENABLE_OCR=true`. Build/start the supplied Docker compose service behind the VPS's existing HTTPS reverse proxy; it binds the host loopback port 8081. Preserve existing hosting services. The container limits CPU/memory, runs non-root, has a read-only root filesystem and a bounded temporary filesystem.
5. Run `RUN_LICENSED_EDITOR_TEST=1 npm test` with the license provided in the server environment. This must actually replace and re-extract original PDF text. Validate OCR with scans and image replacement with representative PDFs before exposing the endpoint.
6. Serve the service at an HTTPS API domain, configure its DNS/certificate, and set GitHub repository variable `EDITOR_API_URL` to that public base URL. Redeploy the Pages workflow. No secret belongs in this variable.
7. Verify authenticated text/image/OCR operations end to end, download/reopen results and confirm no original text remains in the replaced region. Until that is done, do not claim these capabilities are production-ready.

## Validation

Automated tests reopen exports and check page order/dimensions, text/image content streams, annotation subtypes/appearances, internal destinations, form values/widgets, deletion and flattening. Server policy tests reject arbitrary operations, paths and malformed rectangles. The licensed integration test is skipped unless explicitly configured with a genuine license; a skipped test is not evidence of engine functionality.

Browser QA uses synthetic PDFs: text formatting and dragging, undo/redo, real form controls, applying/exporting and independent pypdf extraction of the downloaded PDF. Poppler renders are reviewed for coordinate/layout correctness. Additional browser checks cover signatures and page operations. No customer files are used in automated tests.

References: [pdf-lib limitations](https://github.com/Hopding/pdf-lib#limitations), [Apryse Node Server SDK](https://docs.apryse.com/core/get-started/frameworks/nodejs), [Apryse content replacement](https://docs.apryse.com/core/guides/features/edit/replace/php), [Sejda functional reference](https://www.sejda.com/pdf-editor).

## Browser-based original-content editing (2026-11-26)

The **Edit existing text** entry opens a separate WebViewer workspace with `@pdftron/webviewer` pinned to **12.3.0**. The implementation enables `UI.Feature.ContentEdit`, starts `ContentEditManager` on the current exported PDF, and commits the active editing session before obtaining actual PDF bytes using `getFileData` with exported XFDF. It reopens and validates the result before adding it as an undoable source snapshot. Forms metadata now belongs to each history snapshot, so undoing a content-engine result also restores the correct form controls. Embedded document JavaScript is disabled.

**Production activation is pending.** A license string alone does not prove Content Editing entitlement. No keys have been configured, no license entitlement has been verified, and production content editing must not be described as working until a licensed text replacement/export/reopen test passes. The ordinary editor remains available.

A WebViewer browser license is necessarily delivered to clients. It cannot be kept secret by storing it as a GitHub secret or returning it from an endpoint. Never use an Apryse Server SDK secret/API key here. Obtain an explicitly browser-distributable license, licensed for Content Editing and the production domain, and obtain owner approval for its client delivery. If the license must remain secret, keep the server architecture instead.

After that approval, configure GitHub secret `APRYSE_WEBVIEWER_BROWSER_LICENSE` and repository variables `APRYSE_CONTENT_EDIT_ENABLED=true`, `APRYSE_BROWSER_LICENSE_APPROVED=true`. The workflow maps the license into its browser configuration. Assets are self-hosted and copied only when activation is explicitly enabled; the build fails if activation has no key or no approval flag. No Apryse CDN document upload is implemented. Never print the license in logs or add it to Git.

For local vendor evaluation only, the SDK package documents a limited no-key trial. `NEXT_PUBLIC_APRYSE_LOCAL_TRIAL=true npm run dev` copies assets and permits that evaluation only on localhost/127.0.0.1. It is explicitly labelled as a trial and may watermark output. The public workflow never sets this flag. Trial success is not production license validation.

Validation includes bridge tests (commit ordering, annotations, real PDF reopening, failure handling), browser-mode gating tests, and the existing PDF editor suite. These contract tests do not establish that a commercial license is valid. Reference: [Apryse Content Editing](https://apryse.com/blog/search-and-replace-pdf-webviewer), [ContentEditManager API](https://sdk.apryse.com/api/web/Core.ContentEditManager.html).

Local trial browser verification: replaced the synthetic fixture's original `Original page one` string with `Parperly revised text`, applied, downloaded and reopened with independent pypdf extraction. The original string was absent, replacement text was present (wrapped within the original box), the effective font remained Helvetica 16 pt, and both pages plus all four AcroForm fields survived. The trial watermark is expected. Undo/redo restored the prior form controls. This validates the local trial integration, not a production license.

Follow-up browser QA verified reopening the workspace repeatedly and rejecting Apply when no content changed. Content-edit placeholder annotations are excluded from dirty tracking. A keyboard-by-keyboard replacement to `abc` was downloaded and independently re-extracted with both pages and four fields intact. Bulk synthetic input/paste produced a DOM-versus-export mismatch during automation, so that input path is not claimed validated; the successful keyboard test is the supported evidence.
