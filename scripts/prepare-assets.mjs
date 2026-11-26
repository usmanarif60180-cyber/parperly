import { build } from "esbuild";
import { mkdir, copyFile, cp, rm } from "node:fs/promises";
const out = "apps/web/public";
await mkdir(out, { recursive: true });
await build({
  entryPoints: ["packages/pdf-core/worker.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  outfile: out + "/pdf-worker.js",
  minify: true,
});
await copyFile(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  out + "/pdf.worker.min.mjs",
);
for (const dir of ["cmaps", "standard_fonts", "wasm"])
  await cp("node_modules/pdfjs-dist/" + dir, out + "/" + dir, {
    recursive: true,
  });

await import("./notices.mjs");

// Browser license must be explicitly approved for client delivery. Never use a Server SDK secret.
const nativeEnabled =
  process.env.NEXT_PUBLIC_APRYSE_CONTENT_EDIT_ENABLED === "true";
const nativeTrial = process.env.NEXT_PUBLIC_APRYSE_LOCAL_TRIAL === "true";
if (
  nativeEnabled &&
  (!process.env.NEXT_PUBLIC_APRYSE_WEBVIEWER_LICENSE_KEY ||
    process.env.APRYSE_BROWSER_LICENSE_APPROVED !== "true")
) {
  throw Error(
    "WebViewer activation needs an approved browser license. Do not use a Server SDK secret.",
  );
}
await rm(out + "/webviewer", { recursive: true, force: true });
if (nativeEnabled || nativeTrial)
  await cp("node_modules/@pdftron/webviewer/public", out + "/webviewer", {
    recursive: true,
  });
