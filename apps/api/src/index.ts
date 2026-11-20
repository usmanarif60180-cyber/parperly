import express from "express";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { services } from "./shared.js";
import { owns, downloadAllowed, serverTools, safeSettings } from "./policy.js";
const app = express();
app.disable("x-powered-by");
const enabled = process.env.ENABLE_SERVER_PROCESSING === "true";
const svc = enabled ? services() : null;
const retention = 60 * 60 * 1000;
const origins = new Set(
  (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean),
);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  const origin = req.headers.origin;
  if (origin && !origins.has(origin))
    return res.status(403).json({ code: "ORIGIN_DENIED" });
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.get("/health", (_req, res) =>
  res.json({ service: "Paperly API", processing: enabled }),
);
app.use("/v1", async (req, res, next) => {
  if (!svc) return res.status(503).json({ code: "PROCESSING_NOT_CONFIGURED" });
  try {
    const m = req.headers.authorization?.match(/^Bearer (.+)$/);
    if (!m) return res.status(401).json({ code: "AUTH_REQUIRED" });
    const token = await getAuth().verifyIdToken(m[1], true);
    if (!token.email_verified)
      return res.status(403).json({ code: "VERIFY_EMAIL" });
    res.locals.uid = token.uid;
    const key = `rate:${token.uid}:${Math.floor(Date.now() / 60000)}`;
    const redis = await svc.queue.getBackend().client;
    redis.defineCommand("paperlyRate", {
      numberOfKeys: 1,
      lua: "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],120) end; return n",
    });
    const count = await redis.runCommand("paperlyRate", [key]);
    if (count > 60) return res.status(429).json({ code: "RATE_LIMITED" });
    next();
  } catch {
    res.status(401).json({ code: "INVALID_IDENTITY" });
  }
});
app.post(
  "/v1/files",
  express.raw({ type: "application/pdf", limit: "40mb" }),
  async (req, res, next) => {
    try {
      if (
        !Buffer.isBuffer(req.body) ||
        !req.body.subarray(0, 1024).includes(Buffer.from("%PDF-"))
      )
        return res.status(400).json({ code: "INVALID_PDF" });
      const id = randomUUID(),
        ownerId = res.locals.uid,
        key = `private/${ownerId}/${id}.pdf`,
        expiresAt = Date.now() + retention;
      const ref = svc!.db.collection("files").doc(id);
      await ref.set({
        ownerId,
        key,
        expiresAt,
        state: "uploading",
        bytes: req.body.length,
        createdAt: Date.now(),
      });
      try {
        await svc!.bucket
          .file(key)
          .save(req.body, {
            resumable: false,
            metadata: {
              contentType: "application/pdf",
              cacheControl: "private,no-store",
            },
          });
        await ref.update({ state: "uploaded" });
      } catch (e) {
        await svc!.bucket.file(key).delete({ ignoreNotFound: true });
        await ref.delete();
        throw e;
      }
      res.status(201).json({ id, expiresAt, state: "uploaded" });
    } catch (e) {
      next(e);
    }
  },
);
app.use(express.json({ limit: "32kb" }));
const bodySchema = z
  .object({
    tool: z.string().max(80),
    inputIds: z.array(z.string().uuid()).min(1).max(20),
    settings: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();
app.post("/v1/jobs", async (req, res, next) => {
  try {
    const body = bodySchema.parse(req.body);
    if (!serverTools.has(body.tool))
      return res.status(400).json({ code: "UNSUPPORTED_TOOL" });
    safeSettings(body.settings);
    const uid = res.locals.uid,
      id = randomUUID(),
      ref = svc!.db.collection("jobs").doc(id),
      usage = svc!.db
        .collection("usage")
        .doc(`${uid}-${new Date().toISOString().slice(0, 10)}`);
    await svc!.db.runTransaction(async (tx) => {
      const inputs = await Promise.all(
        body.inputIds.map((x) => tx.get(svc!.db.collection("files").doc(x))),
      );
      if (
        inputs.some(
          (x) => !owns(uid, x.data()) || x.data()?.state !== "uploaded",
        )
      )
        throw Error("INPUT_DENIED");
      const u = await tx.get(usage);
      if ((u.data()?.tasks || 0) >= Number(process.env.DAILY_TASK_LIMIT || 20))
        throw Error("QUOTA_EXCEEDED");
      tx.set(
        usage,
        { ownerId: uid, tasks: (u.data()?.tasks || 0) + 1 },
        { merge: true },
      );
      tx.set(ref, {
        ownerId: uid,
        tool: body.tool,
        inputIds: body.inputIds,
        settings: body.settings,
        state: "uploaded",
        attempt: 1,
        createdAt: Date.now(),
        expiresAt: Date.now() + retention,
      });
    });
    try {
      await svc!.queue.add(
        body.tool,
        { id, attempt: 1 },
        {
          jobId: `${id}-1`,
          attempts: 1,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      await svc!.db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.state === "uploaded")
          tx.update(ref, { state: "queued" });
      });
    } catch {
      await ref.update({ state: "failed", error: "QUEUE_UNAVAILABLE" });
      return res.status(503).json({ code: "QUEUE_UNAVAILABLE", id });
    }
    res.status(202).json({ id });
  } catch (e) {
    next(e);
  }
});
app.get("/v1/jobs/:id", async (req, res, next) => {
  try {
    const d = (
      await svc!.db.collection("jobs").doc(String(req.params.id)).get()
    ).data();
    if (!owns(res.locals.uid, d))
      return res.status(404).json({ code: "NOT_FOUND" });
    res.json({
      id: req.params.id,
      state: d!.state,
      stage: d!.stage,
      error: d!.error,
      createdAt: d!.createdAt,
      expiresAt: d!.expiresAt,
      outputId: d!.outputId,
    });
  } catch (e) {
    next(e);
  }
});
app.post("/v1/jobs/:id/cancel", async (req, res, next) => {
  try {
    const ref = svc!.db.collection("jobs").doc(String(req.params.id));
    await svc!.db.runTransaction(async (tx) => {
      const s = await tx.get(ref),
        d = s.data();
      if (!owns(res.locals.uid, d)) throw Error("NOT_FOUND");
      if (!["completed", "failed", "cancelled", "expired"].includes(d!.state))
        tx.update(ref, { state: "cancelled" });
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
app.get("/v1/jobs/:id/download", async (req, res, next) => {
  try {
    const d = (
      await svc!.db.collection("jobs").doc(String(req.params.id)).get()
    ).data();
    if (!downloadAllowed(res.locals.uid, d))
      return res.status(404).json({ code: "NOT_FOUND" });
    const f = (await svc!.db.collection("files").doc(d!.outputId).get()).data();
    if (!owns(res.locals.uid, f))
      return res.status(404).json({ code: "NOT_FOUND" });
    const [url] = await svc!.bucket
      .file(f!.key)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 60000,
        responseDisposition: 'attachment; filename="paperly.pdf"',
      });
    res.json({ url, expiresIn: 60 });
  } catch (e) {
    next(e);
  }
});
app.delete("/v1/files/:id", async (req, res, next) => {
  try {
    const ref = svc!.db.collection("files").doc(String(req.params.id));
    const d = (await ref.get()).data();
    if (!d || d.ownerId !== res.locals.uid)
      return res.status(404).json({ code: "NOT_FOUND" });
    await ref.update({ state: "deleting", expiresAt: 0 });
    await svc!.bucket.file(d.key).delete({ ignoreNotFound: true });
    await ref.delete();
    res.sendStatus(204);
  } catch (e) {
    next(e);
  }
});
app.use(
  (
    e: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const m = e instanceof Error ? e.message : "";
    const known = ["NOT_FOUND", "INPUT_DENIED", "QUOTA_EXCEEDED"];
    res
      .status(
        e instanceof z.ZodError
          ? 400
          : known.includes(m)
            ? m === "QUOTA_EXCEEDED"
              ? 429
              : 404
            : 500,
      )
      .json({
        code:
          e instanceof z.ZodError
            ? "INVALID_REQUEST"
            : known.includes(m)
              ? m
              : "REQUEST_FAILED",
      });
  },
);
app.listen(Number(process.env.PORT || 8080), "0.0.0.0", () =>
  console.info(
    "Paperly API listening; processing " + (enabled ? "enabled" : "disabled"),
  ),
);
