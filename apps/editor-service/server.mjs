import express from "express";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { PDFDocument } from "pdf-lib";
import { requestSchema, validatePdf } from "./policy.mjs";
const app = express();
app.disable("x-powered-by");
const origins = new Set(
  (process.env.ALLOWED_ORIGINS || "https://parperly.com").split(","),
);
initializeApp({
  credential: applicationDefault(),
  projectId: process.env.FIREBASE_PROJECT_ID || "parperly",
});
let active = false;
const rates = new Map();
function run(input, res) {
  return new Promise((resolve, reject) => {
    const child = fork(
      fileURLToPath(new URL("./runner.mjs", import.meta.url)),
      [],
      { stdio: ["ignore", "ignore", "ignore", "ipc"], env: process.env },
    );
    let finished = false;
    const finish = (err, data) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      res?.off("close", cancel);
      child.kill("SIGKILL");
      err ? reject(err) : resolve(data);
    };
    const cancel = () => {
      if (!res.writableEnded) finish(Error("CANCELLED"));
    };
    const timer = setTimeout(() => finish(Error("ENGINE_TIMEOUT")), 120000);
    res?.once("close", cancel);
    child.on("message", (message) =>
      message.ok ? finish(null, message) : finish(Error(message.error)),
    );
    child.on("error", () => finish(Error("ENGINE_UNAVAILABLE")));
    child.on("exit", () => {
      if (!finished) finish(Error("ENGINE_UNAVAILABLE"));
    });
    child.send(input);
  });
}
let capabilities = { contentEditing: false, ocr: false };
if (process.env.APRYSE_LICENSE_KEY) {
  try {
    const result = await run({ capabilities: true });
    capabilities = { contentEditing: result.contentEditing, ocr: result.ocr };
  } catch {
    console.error("Apryse unavailable; editor service is disabled.");
  }
}
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    Vary: "Origin",
  });
  const origin = req.headers.origin;
  if (origin && !origins.has(origin)) return res.sendStatus(403);
  if (origin) res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.get("/v1/editor/capabilities", (_req, res) =>
  res.json({
    ...capabilities,
    engine: "Apryse Server SDK 12.2.1",
    retention: "No document persistence; isolated process per request.",
  }),
);
app.post(
  "/v1/editor",
  async (req, res, next) => {
    if (!capabilities.contentEditing && !capabilities.ocr)
      return res.status(503).json({ error: "ENGINE_NOT_CONFIGURED" });
    try {
      const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
      if (!token) return res.sendStatus(401);
      const identity = await getAuth().verifyIdToken(token, true);
      if (!identity.email_verified)
        return res.status(403).json({ error: "VERIFY_EMAIL" });
      const now = Date.now();
      for (const [k, v] of rates) if (now - v.start > 60000) rates.delete(k);
      const rate = rates.get(identity.uid) || { start: now, count: 0 };
      if (++rate.count > 10)
        return res.status(429).json({ error: "RATE_LIMITED" });
      rates.set(identity.uid, rate);
      if (active) return res.status(503).json({ error: "ENGINE_BUSY" });
      active = true;
      const release = () => {
        active = false;
      };
      res.once("finish", release);
      res.once("close", release);
      next();
    } catch {
      return res.sendStatus(401);
    }
  },
  express.json({ limit: "56mb" }),
  async (req, res) => {
    try {
      const body = requestSchema.parse(req.body);
      const bytes = validatePdf(body.pdf);
      const source = await PDFDocument.load(bytes);
      if (source.getPageCount() > 300) throw Error("PAGE_LIMIT");
      if (body.operation.kind === "ocr" && !capabilities.ocr)
        return res.status(503).json({ error: "OCR_NOT_CONFIGURED" });
      if (body.operation.kind !== "ocr" && !capabilities.contentEditing)
        return res
          .status(503)
          .json({ error: "CONTENT_EDITING_NOT_CONFIGURED" });
      const result = await run(body, res);
      const edited = Buffer.from(result.pdf, "base64");
      const reopened = await PDFDocument.load(edited);
      if (reopened.getPageCount() !== source.getPageCount())
        throw Error("OUTPUT_VALIDATION_FAILED");
      if (
        createHash("sha256").update(bytes).digest("hex") ===
        createHash("sha256").update(edited).digest("hex")
      )
        throw Error("NO_CHANGE");
      res.type("application/pdf").send(edited);
    } catch (e) {
      if (res.destroyed) return;
      res
        .status(422)
        .json({
          error: ["ENGINE_TIMEOUT", "ENGINE_BUSY", "NO_CHANGE"].includes(
            e.message,
          )
            ? e.message
            : "EDIT_FAILED",
          message:
            "The engine could not complete this edit. Check licensing, fonts and the selected region. Your original file is unchanged.",
        });
    }
  },
);
app.use((err, _req, res, _next) =>
  res
    .status(err.status === 413 ? 413 : 400)
    .json({ error: err.status === 413 ? "FILE_TOO_LARGE" : "INVALID_REQUEST" }),
);
app.listen(
  Number(process.env.PORT || 8081),
  process.env.HOST || "127.0.0.1",
  () => console.log("Parperly editor service listening"),
);
