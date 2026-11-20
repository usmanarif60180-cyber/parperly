import test from "node:test";
import assert from "node:assert/strict";
import {
  owns,
  downloadAllowed,
  safeSettings,
  serverTools,
} from "../apps/api/src/policy";
test("ownership rejects other users, missing and expired metadata", () => {
  assert.ok(owns("a", { ownerId: "a", expiresAt: Date.now() + 10000 }));
  assert.equal(owns("b", { ownerId: "a" }), false);
  assert.equal(owns("a", undefined), false);
  assert.equal(owns("a", { ownerId: "a", expiresAt: 0 }), false);
  assert.equal(owns("a", { ownerId: "a", expiresAt: 1 }), false);
});
test("downloads require owner, unexpired data and completed status", () => {
  for (const state of [
    "uploaded",
    "queued",
    "processing",
    "validating",
    "failed",
    "cancelled",
    "expired",
  ])
    assert.equal(downloadAllowed("a", { ownerId: "a", state }), false);
  assert.ok(downloadAllowed("a", { ownerId: "a", state: "completed" }));
});
test("settings reject paths, commands, passwords, nested objects and oversized strings", () => {
  for (const v of [
    { password: "secret" },
    { command: "qpdf" },
    { pages: {} },
    { text: "x".repeat(2001) },
  ])
    assert.throws(() => safeSettings(v));
  assert.deepEqual(safeSettings({ pages: "1-2", angle: 90 }), {
    pages: "1-2",
    angle: 90,
  });
  assert.equal(serverTools.has("html-to-pdf"), false);
});
