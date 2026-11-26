import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import type { WebViewerInstance } from "@pdftron/webviewer";
import {
  collectWebViewerPdf,
  webViewerMode,
} from "../packages/pdf-editor/webviewer";
test("trial activation is restricted to explicit localhost opt-in; production needs license and flag", () => {
  assert.equal(webViewerMode(false, "", true, "parperly.com"), "unconfigured");
  assert.equal(
    webViewerMode(false, "", true, "localhost.evil.example"),
    "unconfigured",
  );
  assert.equal(webViewerMode(true, "", false, "parperly.com"), "unconfigured");
  assert.equal(
    webViewerMode(false, "browser-key", false, "parperly.com"),
    "unconfigured",
  );
  assert.equal(webViewerMode(false, "", true, "127.0.0.1"), "local-trial");
  assert.equal(
    webViewerMode(true, "browser-key", false, "parperly.com"),
    "licensed",
  );
});
test("SDK bridge commits current text before exporting annotations and validates the returned PDF", async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([300, 500]);
  const bytes = await pdf.save();
  const calls: string[] = [];
  const instance = {
    Core: {
      documentViewer: {
        getContentEditManager: () => ({
          endContentEditMode: async () => {
            calls.push("commit");
          },
        }),
        getDocument: () => ({
          getFileData: async (options: unknown) => {
            calls.push("save");
            assert.deepEqual(options, {
              xfdfString: "<xfdf/>",
              flatten: false,
              downloadType: "pdf",
            });
            return bytes.buffer;
          },
        }),
      },
      annotationManager: {
        exportAnnotations: async () => {
          calls.push("annotations");
          return "<xfdf/>";
        },
      },
    },
  } as unknown as WebViewerInstance;
  const out = await collectWebViewerPdf(instance);
  assert.deepEqual(calls, ["commit", "annotations", "save"]);
  assert.equal((await PDFDocument.load(out)).getPage(0).getWidth(), 300);
});
test("SDK bridge does not return corrupt output or proceed after content commit fails", async () => {
  let saves = 0;
  const fake = {
    Core: {
      documentViewer: {
        getContentEditManager: () => ({
          endContentEditMode: async () => {
            throw Error("commit failed");
          },
        }),
        getDocument: () => ({
          getFileData: async () => {
            saves++;
            return new ArrayBuffer(0);
          },
        }),
      },
      annotationManager: { exportAnnotations: async () => "" },
    },
  } as unknown as WebViewerInstance;
  await assert.rejects(collectWebViewerPdf(fake), /commit failed/);
  assert.equal(saves, 0);
  fake.Core.documentViewer.getContentEditManager = () =>
    ({ endContentEditMode: async () => {} }) as any;
  await assert.rejects(collectWebViewerPdf(fake));
});
