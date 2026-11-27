import { PDFDocument } from "pdf-lib";
import type { WebViewerInstance } from "@pdftron/webviewer";
export function webViewerMode(
  enabled: boolean,
  key: string,
  trial: boolean,
  hostname: string,
  evaluation = false,
) {
  if (enabled && key.trim())
    return evaluation || key.trim().startsWith("demo:")
      ? "public-trial"
      : "licensed";
  if (trial && ["localhost", "127.0.0.1", "[::1]"].includes(hostname))
    return "local-trial";
  return "unconfigured";
}
export async function collectWebViewerPdf(instance: WebViewerInstance) {
  // Commit the active text box before serializing; a screenshot/overlay is never exported.
  await instance.Core.documentViewer
    .getContentEditManager()
    .endContentEditMode();
  const doc = instance.Core.documentViewer.getDocument();
  if (!doc) throw Error("No PDF is loaded in the content editor.");
  const xfdfString = await instance.Core.annotationManager.exportAnnotations();
  const bytes = new Uint8Array(
    await doc.getFileData({ xfdfString, flatten: false, downloadType: "pdf" }),
  );
  if (bytes.length > 60e6) throw Error("Edited PDF exceeds 60 MB.");
  const check = await PDFDocument.load(bytes);
  if (!check.getPageCount() || check.getPageCount() > 300)
    throw Error("Edited PDF must contain 1–300 pages.");
  return bytes;
}
