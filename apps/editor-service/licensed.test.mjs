import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { PDFDocument } from "pdf-lib";
// Run only after securely configuring a real Server SDK license. Never substitutes trial success.
test(
  "licensed Apryse engine rewrites original text content",
  { skip: process.env.RUN_LICENSED_EDITOR_TEST !== "1" },
  async () => {
    assert.ok(
      process.env.APRYSE_LICENSE_KEY,
      "Set APRYSE_LICENSE_KEY on the server",
    );
    const source = await PDFDocument.create();
    source
      .addPage([400, 400])
      .drawText("Original text", { x: 40, y: 300, size: 16 });
    const bytes = await source.save();
    const result = await new Promise((resolve, reject) => {
      const c = fork(new URL("./runner.mjs", import.meta.url), [], {
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        env: { ...process.env, ENABLE_CONTENT_EDITING: "true" },
      });
      const timeout = setTimeout(() => {
        c.kill("SIGKILL");
        reject(Error("Timed out"));
      }, 120000);
      c.once("message", (r) => {
        clearTimeout(timeout);
        c.kill();
        r.ok
          ? resolve(r)
          : reject(Error("Licensed SDK rejected the operation"));
      });
      c.once("error", reject);
      c.send({
        pdf: Buffer.from(bytes).toString("base64"),
        operation: {
          kind: "replaceText",
          page: 1,
          rect: [35, 290, 250, 330],
          text: "Replaced text",
        },
      });
    });
    const output = Buffer.from(result.pdf, "base64");
    assert.equal((await PDFDocument.load(output)).getPageCount(), 1);
    assert.notDeepEqual(output, Buffer.from(bytes));
    // SDK extraction checks actual content, not a white overlay.
    const { PDFNet } = await import("@pdftron/pdfnet-node");
    await PDFNet.runWithCleanup(async () => {
      const d = await PDFNet.PDFDoc.createFromBuffer(output),
        p = await d.getPage(1),
        ex = await PDFNet.TextExtractor.create();
      await ex.begin(p);
      const text = await ex.getAsText();
      assert.match(text, /Replaced text/);
      assert.doesNotMatch(text, /Original text/);
    }, process.env.APRYSE_LICENSE_KEY);
  },
);
