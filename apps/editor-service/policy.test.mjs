import test from "node:test";
import assert from "node:assert/strict";
import { operationSchema, requestSchema, validatePdf } from "./policy.mjs";
test("rejects arbitrary commands, file paths and malformed regions", () => {
  for (const operation of [
    { kind: "shell", command: "x" },
    { kind: "replaceText", page: 0, rect: [0, 0, 10, 10], text: "x" },
    { kind: "replaceText", page: 1, rect: [10, 0, 0, 10], text: "x" },
    { kind: "ocr", path: "/tmp/input.pdf" },
  ])
    assert.equal(operationSchema.safeParse(operation).success, false);
});
test("accepts bounded content replacement and OCR contracts", () => {
  assert.ok(
    operationSchema.safeParse({
      kind: "replaceText",
      page: 1,
      rect: [0, 0, 100, 30],
      text: "New text",
    }).success,
  );
  assert.ok(operationSchema.safeParse({ kind: "ocr" }).success);
  assert.throws(() => validatePdf(Buffer.from("not pdf").toString("base64")));
  assert.equal(
    requestSchema.safeParse({
      pdf: "x",
      operation: { kind: "ocr" },
      license: "secret",
    }).success,
    false,
  );
});
