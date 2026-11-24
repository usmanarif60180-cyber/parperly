// Each operation runs in a separate process. No license or document is logged.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
process.once("message", async (input) => {
  try {
    if (!process.env.APRYSE_LICENSE_KEY) throw Error("ENGINE_NOT_CONFIGURED");
    const { PDFNet } = require("@pdftron/pdfnet-node");
    let result;
    await PDFNet.runWithCleanup(async () => {
      if (process.env.APRYSE_RESOURCE_PATH)
        await PDFNet.addResourceSearchPath(process.env.APRYSE_RESOURCE_PATH);
      if (input.capabilities) {
        result = {
          contentEditing: process.env.ENABLE_CONTENT_EDITING === "true",
          ocr:
            process.env.ENABLE_OCR === "true" &&
            (await PDFNet.OCRModule.isModuleAvailable()),
        };
        return;
      }
      const doc = await PDFNet.PDFDoc.createFromBuffer(
        Buffer.from(input.pdf, "base64"),
      );
      if (!(await doc.initSecurityHandler())) throw Error("ENCRYPTED_PDF");
      const count = await doc.getPageCount();
      if (count > 300) throw Error("PAGE_LIMIT");
      const op = input.operation;
      if (op.kind === "ocr") {
        if (
          process.env.ENABLE_OCR !== "true" ||
          !(await PDFNet.OCRModule.isModuleAvailable())
        )
          throw Error("OCR_NOT_CONFIGURED");
        await PDFNet.OCRModule.processPDF(doc);
      } else {
        if (process.env.ENABLE_CONTENT_EDITING !== "true")
          throw Error("CONTENT_EDITING_NOT_CONFIGURED");
        if (op.page > count) throw Error("INVALID_PAGE");
        const page = await doc.getPage(op.page),
          box = await PDFNet.Rect.init(...op.rect),
          replacer = await PDFNet.ContentReplacer.create();
        if (op.kind === "replaceText") await replacer.addText(box, op.text);
        else {
          const image = await PDFNet.Image.createFromMemory2(
            doc,
            Buffer.from(op.image.split(",")[1], "base64"),
          );
          await replacer.addImage(box, await image.getSDFObj());
        }
        await replacer.process(page);
      }
      result = {
        pdf: Buffer.from(
          await doc.saveMemoryBuffer(PDFNet.SDFDoc.SaveOptions.e_remove_unused),
        ).toString("base64"),
      };
    }, process.env.APRYSE_LICENSE_KEY);
    process.send?.({ ok: true, ...result }, () => process.exit(0));
  } catch {
    process.send?.({ ok: false, error: "ENGINE_OPERATION_FAILED" }, () =>
      process.exit(1),
    );
  }
});
