import { Worker } from "bullmq";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { services } from "../../api/src/shared.js";
if (process.env.ENABLE_SERVER_PROCESSING !== "true")
  throw Error("Server processing is not enabled.");
const { db, bucket, connection } = services();
const w = new Worker(
  "paperly",
  async (job) => {
    const { id, attempt } = job.data,
      ref = db.collection("jobs").doc(id);
    const d = await db.runTransaction(async (tx) => {
      const s = await tx.get(ref),
        v = s.data();
      if (
        !v ||
        v.attempt !== attempt ||
        !["uploaded", "queued"].includes(v.state) ||
        v.expiresAt < Date.now()
      )
        return null;
      tx.update(ref, { state: "processing", stage: "Validating inputs" });
      return v;
    });
    if (!d) return;
    const scratch = await mkdtemp(join(tmpdir(), "paperly-"));
    let uploadedKey: string | undefined;
    try {
      const paths = [];
      let bytesTotal = 0,
        pagesTotal = 0;
      for (const inputId of d.inputIds) {
        const f = (await db.collection("files").doc(inputId).get()).data();
        if (
          !f ||
          f.ownerId !== d.ownerId ||
          f.expiresAt < Date.now() ||
          f.state !== "uploaded"
        )
          throw Error("INPUT_EXPIRED");
        const [bytes] = await bucket.file(f.key).download();
        bytesTotal += bytes.length;
        if (bytesTotal > 40 * 1024 * 1024) throw Error("LIMIT_EXCEEDED");
        const doc = await PDFDocument.load(bytes);
        pagesTotal += doc.getPageCount();
        if (pagesTotal > 300) throw Error("LIMIT_EXCEEDED");
        const path = join(scratch, `${paths.length}.pdf`);
        await writeFile(path, bytes, { mode: 0o600 });
        paths.push(path);
      }
      const output = join(scratch, "output.pdf");
      let command = process.execPath,
        args = [
          "--max-old-space-size=256",
          "--import",
          "tsx",
          resolve("apps/worker-node/src/runner.ts"),
          join(scratch, "job.json"),
        ];
      if (d.tool === "repair-pdf" || d.tool === "compress-pdf") {
        if (paths.length !== 1) throw Error("ONE_INPUT_REQUIRED");
        command = "qpdf";
        args =
          d.tool === "compress-pdf"
            ? [
                "--object-streams=generate",
                "--recompress-flate",
                "--compression-level=9",
                paths[0],
                output,
              ]
            : [paths[0], output];
      } else
        await writeFile(
          join(scratch, "job.json"),
          JSON.stringify({ tool: d.tool, settings: d.settings, paths, output }),
          { mode: 0o600 },
        );
      await ref.update({ stage: "Processing document" });
      await new Promise<void>((resolveRun, reject) => {
        const child = spawn(command, args, {
          stdio: ["ignore", "ignore", "ignore"],
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "production",
            HOME: scratch,
          },
          detached: process.platform !== "win32",
        });
        let ended = false;
        const kill = () => {
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        };
        const timeout = setTimeout(() => {
          kill();
          finish(Error("TIME_LIMIT"));
        }, 120000);
        const poll = setInterval(async () => {
          try {
            const current = (await ref.get()).data();
            if (
              !current ||
              current.state === "cancelled" ||
              current.attempt !== attempt ||
              current.expiresAt < Date.now()
            ) {
              kill();
              finish(Error("CANCELLED"));
            }
          } catch {
            kill();
            finish(Error("STATE_UNAVAILABLE"));
          }
        }, 1000);
        function finish(e?: Error) {
          if (ended) return;
          ended = true;
          clearTimeout(timeout);
          clearInterval(poll);
          e ? reject(e) : resolveRun();
        }
        child.on("error", () => finish(Error("ENGINE_UNAVAILABLE")));
        child.on("exit", (code) =>
          finish(code === 0 ? undefined : Error("ENGINE_FAILED")),
        );
      });
      const current = (await ref.get()).data();
      if (current?.state === "cancelled" || current?.attempt !== attempt)
        throw Error("CANCELLED");
      await ref.update({ state: "validating" });
      if ((await stat(output)).size > 80 * 1024 * 1024)
        throw Error("OUTPUT_LIMIT");
      const bytes = await readFile(output);
      const check = await PDFDocument.load(bytes);
      if (check.getPageCount() < 1 || check.getPageCount() > 300)
        throw Error("INVALID_OUTPUT");
      if (d.tool === "compress-pdf" && bytes.length >= bytesTotal)
        throw Error("NO_SIZE_REDUCTION");
      const outputId = randomUUID();
      uploadedKey = `private/${d.ownerId}/${outputId}.pdf`;
      await bucket
        .file(uploadedKey)
        .save(bytes, {
          resumable: false,
          metadata: {
            contentType: "application/pdf",
            cacheControl: "private,no-store",
          },
        });
      const key = uploadedKey;
      const committed = await db.runTransaction(async (tx) => {
        const s = await tx.get(ref),
          v = s.data();
        if (
          v?.state !== "validating" ||
          v.attempt !== attempt ||
          v.expiresAt < Date.now()
        )
          return false;
        tx.set(db.collection("files").doc(outputId), {
          ownerId: d.ownerId,
          key,
          bytes: bytes.length,
          pages: check.getPageCount(),
          expiresAt: d.expiresAt,
          state: "completed",
          createdAt: Date.now(),
        });
        tx.update(ref, { state: "completed", outputId, stage: "Validated" });
        return true;
      });
      if (!committed) await bucket.file(key).delete({ ignoreNotFound: true });
      uploadedKey = undefined;
    } catch (e) {
      if (uploadedKey)
        await bucket.file(uploadedKey).delete({ ignoreNotFound: true });
      await db.runTransaction(async (tx) => {
        const s = await tx.get(ref),
          v = s.data();
        if (
          v &&
          v.attempt === attempt &&
          !["cancelled", "expired", "completed"].includes(v.state)
        )
          tx.update(ref, {
            state: "failed",
            error:
              e instanceof Error && /^[A-Z_]+$/.test(e.message)
                ? e.message
                : "PROCESSING_FAILED",
          });
      });
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
  },
  { connection, concurrency: 1 },
);
w.on("error", () => console.error("Worker connection error"));
let sweeping = false;
const sweep = setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    const files = await db
      .collection("files")
      .where("expiresAt", "<=", Date.now())
      .limit(100)
      .get();
    for (const f of files.docs) {
      await bucket.file(f.data().key).delete({ ignoreNotFound: true });
      await f.ref.delete();
    }
    const jobs = await db
      .collection("jobs")
      .where("expiresAt", "<=", Date.now())
      .limit(100)
      .get();
    for (const j of jobs.docs)
      if (j.data().state === "expired") await j.ref.delete();
      else
        await j.ref.update({
          state: "expired",
          expiredAt: Date.now(),
          expiresAt: Date.now() + 86400000,
        });
  } catch {
    console.error("Retention cleanup failed; will retry");
  } finally {
    sweeping = false;
  }
}, 60000);
process.on("SIGTERM", async () => {
  clearInterval(sweep);
  await w.close();
  process.exit(0);
});
