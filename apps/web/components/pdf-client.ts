import { asset } from "./context";
import {
  pageRange,
  processPdf,
  type InputFile,
  type Output,
  type Settings,
} from "../../../packages/pdf-core";
let lib: Promise<typeof import("pdfjs-dist")> | null = null;
export async function pdfjs() {
  if (!lib)
    lib = import("pdfjs-dist").then((m) => {
      m.GlobalWorkerOptions.workerSrc = asset("pdf.worker.min.mjs");
      return m;
    });
  return lib;
}
export async function openPdf(bytes: Uint8Array) {
  const m = await pdfjs();
  const task = m.getDocument({
    data: bytes.slice(),
    cMapUrl: asset("cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: asset("standard_fonts/"),
    wasmUrl: asset("wasm/"),
  });
  const doc = await task.promise;
  return Object.assign(doc, { destroy: () => task.destroy() });
}
export async function textPages(bytes: Uint8Array) {
  const doc = await openPdf(bytes);
  try {
    const result = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const c = await (await doc.getPage(n)).getTextContent();
      result.push(
        c.items.map((i: any) => i.str + (i.hasEOL ? "\n" : " ")).join(""),
      );
    }
    return result;
  } finally {
    await doc.destroy();
  }
}
export async function rasterProcess(
  tool: string,
  file: InputFile,
  s: Settings,
  onProgress: (s: string) => void,
  signal: AbortSignal,
): Promise<Output[]> {
  const doc = await openPdf(file.bytes);
  const result: Output[] = [];
  try {
    const indices = pageRange(String(s.pages || "all"), doc.numPages);
    if (indices.length > 80 && tool !== "pdf-to-text")
      throw Error("Image export is limited to 80 pages per operation.");
    if (tool === "pdf-to-text") {
      const texts = [];
      for (const i of indices) {
        if (signal.aborted) throw Error("Cancelled");
        onProgress(`Extracting text: ${texts.length + 1} / ${indices.length}`);
        const c = await (await doc.getPage(i + 1)).getTextContent();
        texts.push(
          c.items.map((v: any) => v.str + (v.hasEOL ? "\n" : " ")).join(""),
        );
      }
      if (!texts.some((t) => t.trim()))
        throw Error("No embedded text was found. This document needs OCR.");
      return [
        {
          name: "document.txt",
          bytes: new TextEncoder().encode(texts.join("\n\n")),
          type: "text/plain",
        },
      ];
    }
    const { PDFDocument } = await import("pdf-lib");
    const gray = tool === "grayscale-pdf" ? await PDFDocument.create() : null;
    let bytesTotal = 0;
    for (const i of indices) {
      if (signal.aborted) throw Error("Cancelled");
      onProgress(
        `Rendering page ${i + 1} (${result.length + 1} / ${indices.length})`,
      );
      const p = await doc.getPage(i + 1),
        scale = Number(s.dpi || 144) / 72;
      if (!Number.isFinite(scale) || scale < 1 || scale > 3)
        throw Error("Resolution must be 72 to 216 DPI.");
      const viewport = p.getViewport({ scale });
      if (viewport.width * viewport.height > 16e6)
        throw Error("Page is too large to render at this resolution.");
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d")!;
      const render = p.render({ canvas, canvasContext: context, viewport });
      const cancel = () => render.cancel();
      signal.addEventListener("abort", cancel, { once: true });
      try {
        await render.promise;
      } finally {
        signal.removeEventListener("abort", cancel);
      }
      if (gray) {
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        for (let j = 0; j < pixels.data.length; j += 4) {
          const g = Math.round(
            0.2126 * pixels.data[j] +
              0.7152 * pixels.data[j + 1] +
              0.0722 * pixels.data[j + 2],
          );
          pixels.data[j] = pixels.data[j + 1] = pixels.data[j + 2] = g;
        }
        context.putImageData(pixels, 0, 0);
      }
      const type = s.format === "jpeg" && !gray ? "image/jpeg" : "image/png";
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(Error("Image export failed."))),
          type,
          Number(s.quality || 0.9),
        ),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      bytesTotal += bytes.length;
      if (bytesTotal > 80 * 1024 * 1024)
        throw Error(
          "Rendered output exceeds 80 MB. Use fewer pages or lower DPI.",
        );
      if (gray) {
        const image = await gray.embedPng(bytes);
        const gp = gray.addPage([
          viewport.width / scale,
          viewport.height / scale,
        ]);
        gp.drawImage(image, {
          x: 0,
          y: 0,
          width: gp.getWidth(),
          height: gp.getHeight(),
        });
      } else
        result.push({
          name: `page-${String(i + 1).padStart(3, "0")}.${type === "image/png" ? "png" : "jpg"}`,
          bytes,
          type,
        });
      canvas.width = canvas.height = 0;
      p.cleanup();
    }
    if (gray) {
      const bytes = await gray.save();
      const check = await PDFDocument.load(bytes);
      if (check.getPageCount() !== indices.length)
        throw Error("Output validation failed.");
      return [
        {
          name: "grayscale.pdf",
          bytes,
          type: "application/pdf",
          pages: indices.length,
        },
      ];
    }
    return result;
  } finally {
    await doc.destroy();
  }
}
export function runWorker(
  tool: string,
  files: InputFile[],
  settings: Settings,
  onProgress: (s: string) => void,
  signal: AbortSignal,
): Promise<Output[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(Error("Cancelled"));
    const w = new Worker(asset("pdf-worker.js"));
    const end = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      w.terminate();
    };
    const cancel = () => {
      end();
      reject(Error("Cancelled"));
    };
    const timer = setTimeout(() => {
      end();
      reject(Error("Processing exceeded two minutes. Try a smaller document."));
    }, 120000);
    signal.addEventListener("abort", cancel, { once: true });
    w.onmessage = (e) => {
      if (e.data.stage) onProgress(e.data.stage);
      else {
        end();
        e.data.error ? reject(Error(e.data.error)) : resolve(e.data.outputs);
      }
    };
    w.onerror = () => {
      end();
      reject(Error("The PDF worker could not finish. Try a smaller document."));
    };
    w.postMessage({ tool, files, settings });
  });
}
export function saveDownload(output: Output) {
  const blob = new Blob([output.bytes.slice().buffer as ArrayBuffer], {
    type: output.type,
  });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = output.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
