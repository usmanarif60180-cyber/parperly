import { readFile, writeFile } from "node:fs/promises";
import { processPdf } from "../../../packages/pdf-core/index.js";
const job = JSON.parse(await readFile(process.argv[2], "utf8"));
const files = await Promise.all(
  job.paths.map(async (path: string) => ({
    name: "input.pdf",
    bytes: new Uint8Array(await readFile(path)),
  })),
);
const outputs = await processPdf(job.tool, files, job.settings);
if (outputs.length !== 1)
  throw Error("Server adapter currently supports one PDF output.");
await writeFile(job.output, outputs[0].bytes);
