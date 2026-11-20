import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
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
