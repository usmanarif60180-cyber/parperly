import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFNumber,
  PDFString,
  StandardFonts,
  degrees,
  rgb,
} from "pdf-lib";
export type InputFile = { name: string; bytes: Uint8Array };
export type Settings = Record<string, string | number | boolean | undefined>;
export type Output = {
  name: string;
  bytes: Uint8Array;
  type: string;
  pages?: number;
};
export const limits = { bytes: 40 * 1024 * 1024, pages: 300, outputs: 300 };
export function pageRange(value: string | undefined, count: number) {
  if (!value?.trim() || value === "all")
    return Array.from({ length: count }, (_, i) => i);
  if (value === "odd" || value === "even")
    return Array.from({ length: count }, (_, i) => i).filter(
      (i) => i % 2 === (value === "odd" ? 0 : 1),
    );
  const result: number[] = [];
  for (const term of value.split(",")) {
    const m = term.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!m) throw Error("Use pages such as 1, 3-5, odd, even or all.");
    const a = Number(m[1]),
      b = Number(m[2] || a);
    if (a < 1 || b < a || b > count)
      throw Error(`Page range must be between 1 and ${count}.`);
    for (let i = a; i <= b; i++) result.push(i - 1);
    if (result.length > limits.pages) throw Error("Too many output pages.");
  }
  return result;
}
export function safeName(name: string) {
  return (
    name
      .replace(/[\x00-\x1f<>:"/\\|?*]/g, "-")
      .replace(/^\.+/, "")
      .trim() || "document"
  ).slice(0, 100);
}
const num = (s: Settings, k: string, d: number, min = -10000, max = 10000) => {
  const n = Number(s[k] ?? d);
  if (!Number.isFinite(n) || n < min || n > max)
    throw Error(`Invalid ${k}: use ${min} to ${max}.`);
  return n;
};
const int = (s: Settings, k: string, d: number, min = 0, max = 10000) => {
  const n = num(s, k, d, min, max);
  if (!Number.isInteger(n)) throw Error(`${k} must be a whole number.`);
  return n;
};
const color = (v: unknown) => {
  const s = String(v || "#166534");
  if (!/^#[0-9a-f]{6}$/i.test(s)) throw Error("Choose a valid color.");
  return rgb(
    parseInt(s.slice(1, 3), 16) / 255,
    parseInt(s.slice(3, 5), 16) / 255,
    parseInt(s.slice(5), 16) / 255,
  );
};
async function load(f: InputFile) {
  if (f.bytes.length === 0) throw Error("The file is empty.");
  if (!new TextDecoder().decode(f.bytes.slice(0, 1024)).includes("%PDF-"))
    throw Error("This file does not have a PDF signature.");
  try {
    const doc = await PDFDocument.load(f.bytes, { updateMetadata: false });
    if (doc.getPageCount() < 1 || doc.getPageCount() > limits.pages)
      throw Error("PDF must contain 1–300 pages.");
    return doc;
  } catch (e) {
    if (/encrypt/i.test(String(e)))
      throw Error(
        "Password-protected PDFs need to be unlocked before using local tools.",
      );
    throw e;
  }
}
export async function processPdf(
  tool: string,
  files: InputFile[],
  s: Settings = {},
  progress: (p: string) => void = () => {},
): Promise<Output[]> {
  if (!files.length) throw Error("Choose at least one file.");
  if (files.reduce((n, f) => n + f.bytes.length, 0) > limits.bytes)
    throw Error("The total file limit is 40 MB.");
  progress("Reading documents");
  const outputs: Output[] = [];
  async function save(doc: PDFDocument, name = "paperly.pdf") {
    progress("Validating output");
    if (!doc.getPageCount() || doc.getPageCount() > limits.pages)
      throw Error("Output must contain 1–300 pages.");
    const bytes = await doc.save();
    if (
      bytes.length + outputs.reduce((n, o) => n + o.bytes.length, 0) >
      limits.bytes * 2
    )
      throw Error("Output exceeds 80 MB.");
    const check = await PDFDocument.load(bytes);
    if (check.getPageCount() !== doc.getPageCount())
      throw Error("Output page validation failed.");
    outputs.push({
      name: safeName(name),
      bytes,
      type: "application/pdf",
      pages: check.getPageCount(),
    });
  }
  if (tool === "images-to-pdf") {
    const doc = await PDFDocument.create();
    for (const f of files) {
      const b = f.bytes;
      let img;
      if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71)
        img = await doc.embedPng(b);
      else if (b[0] === 255 && b[1] === 216) img = await doc.embedJpg(b);
      else throw Error("Only PNG and JPEG images are supported.");
      const margin = num(s, "margin", 24, 0, 150);
      let w = s.size === "original" ? img.width : 595.28,
        h = s.size === "original" ? img.height : 841.89;
      if (s.orientation === "landscape") [w, h] = [h, w];
      if (w > 10000 || h > 10000 || w <= margin * 2 || h <= margin * 2)
        throw Error("Image dimensions or margins exceed supported limits.");
      const p = doc.addPage([w, h]);
      const scale = Math.min(
        (w - 2 * margin) / img.width,
        (h - 2 * margin) / img.height,
      );
      p.drawImage(img, {
        x: (w - img.width * scale) / 2,
        y: (h - img.height * scale) / 2,
        width: img.width * scale,
        height: img.height * scale,
      });
    }
    await save(doc, "images.pdf");
    return outputs;
  }
  const docs = [];
  let total = 0;
  for (const f of files) {
    const doc = await load(f);
    total += doc.getPageCount();
    if (total > limits.pages) throw Error("The total page limit is 300.");
    docs.push(doc);
  }
  const doc = docs[0],
    count = doc.getPageCount(),
    selected = pageRange(String(s.pages || "all"), count);
  progress("Processing pages");
  if (tool === "rename-pdf") {
    for (let i = 0; i < files.length; i++)
      outputs.push({
        name:
          safeName(
            String(s.filename || "document").replace(/\.pdf$/i, "") +
              (files.length > 1 ? `-${i + 1}` : ""),
          ) + ".pdf",
        bytes: files[i].bytes,
        type: "application/pdf",
        pages: docs[i].getPageCount(),
      });
    return outputs;
  }
  if (tool === "merge-pdf" || tool === "alternate-mix-pdf") {
    if (docs.length < 2) throw Error("Choose at least two PDFs.");
    const out = await PDFDocument.create();
    if (tool === "merge-pdf") {
      for (let i = 0; i < docs.length; i++) {
        const d = docs[i];
        if (s.flatten) d.getForm().flatten();
        const ranges = String(s.ranges || "").split(";");
        for (const p of await out.copyPages(
          d,
          pageRange(ranges[i], d.getPageCount()),
        ))
          out.addPage(p);
      }
    } else {
      const group = int(s, "group", 1, 1, 100);
      for (
        let offset = 0;
        offset < Math.max(...docs.map((d) => d.getPageCount()));
        offset += group
      ) {
        for (const d of docs) {
          let indices = d.getPageIndices();
          if (s.reverse) indices.reverse();
          for (const p of await out.copyPages(
            d,
            indices.slice(offset, offset + group),
          ))
            out.addPage(p);
        }
      }
    }
    await save(out, "combined.pdf");
    return outputs;
  }
  if (
    [
      "organize-pdf",
      "extract-pdf-pages",
      "delete-pdf-pages",
      "split-by-pages",
      "split-by-file-size",
      "split-by-text",
    ].includes(tool)
  ) {
    let groups: number[][] = [];
    if (tool === "delete-pdf-pages") {
      const remove = new Set(selected);
      groups = [doc.getPageIndices().filter((i) => !remove.has(i))];
      if (!groups[0].length) throw Error("Keep at least one page.");
    } else if (tool === "split-by-pages") {
      const each = int(s, "every", 1, 1, 300);
      for (let i = 0; i < selected.length; i += each)
        groups.push(selected.slice(i, i + each));
    } else if (tool === "split-by-text") {
      const starts = String(s.boundaries || "")
        .split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0 && n < count);
      const boundaries = [0, ...new Set(starts), count].sort((a, b) => a - b);
      for (let i = 0; i < boundaries.length - 1; i++)
        groups.push(
          doc.getPageIndices().slice(boundaries[i], boundaries[i + 1]),
        );
    } else if (tool === "split-by-file-size") {
      const target = num(s, "sizeMB", 5, 0.01, 40) * 1024 * 1024;
      let group: number[] = [];
      for (const i of selected) {
        const test = await PDFDocument.create();
        for (const p of await test.copyPages(doc, [...group, i]))
          test.addPage(p);
        const bytes = await test.save();
        if (bytes.length > target) {
          if (!group.length)
            throw Error(
              `Page ${i + 1} alone exceeds the target size. Increase the limit.`,
            );
          groups.push(group);
          group = [i];
          const single = await PDFDocument.create();
          single.addPage((await single.copyPages(doc, [i]))[0]);
          if ((await single.save()).length > target)
            throw Error(`Page ${i + 1} alone exceeds the target size.`);
        } else group.push(i);
      }
      if (group.length) groups.push(group);
    } else groups = s.separate ? selected.map((i) => [i]) : [selected];
    for (let i = 0; i < groups.length; i++) {
      const out = await PDFDocument.create();
      for (const p of await out.copyPages(doc, groups[i])) out.addPage(p);
      await save(
        out,
        groups.length === 1
          ? "pages.pdf"
          : `part-${String(i + 1).padStart(3, "0")}.pdf`,
      );
    }
    return outputs;
  }
  if (tool === "split-in-half") {
    const out = await PDFDocument.create();
    for (const i of selected) {
      const page = doc.getPage(i);
      if (page.getRotation().angle !== 0)
        throw Error(
          "Normalize page rotation before splitting scanned spreads.",
        );
      const { x, y, width: w, height: h } = page.getCropBox();
      const boxes =
        s.direction === "horizontal"
          ? [
              { left: x, bottom: y + h / 2, right: x + w, top: y + h },
              { left: x, bottom: y, right: x + w, top: y + h / 2 },
            ]
          : [
              { left: x, bottom: y, right: x + w / 2, top: y + h },
              { left: x + w / 2, bottom: y, right: x + w, top: y + h },
            ];
      for (const b of boxes) {
        const embedded = await out.embedPage(page, b);
        const p = out.addPage([b.right - b.left, b.top - b.bottom]);
        p.drawPage(embedded);
      }
    }
    await save(out, "split-spreads.pdf");
    return outputs;
  }
  if (tool === "n-up-pdf" || tool === "resize-pdf" || tool === "flip-pdf") {
    const out = await PDFDocument.create();
    if (tool === "n-up-pdf") {
      const cols = int(s, "columns", 2, 1, 4),
        rows = int(s, "rows", 2, 1, 4),
        margin = num(s, "margin", 20, 0, 100),
        w = 841.89,
        h = 595.28,
        cw = (w - 2 * margin) / cols,
        ch = (h - 2 * margin) / rows;
      for (let start = 0; start < selected.length; start += cols * rows) {
        const p = out.addPage([w, h]);
        for (let j = 0; j < cols * rows && start + j < selected.length; j++) {
          const e = await out.embedPage(doc.getPage(selected[start + j]));
          const scale = Math.min((cw - 10) / e.width, (ch - 10) / e.height);
          p.drawPage(e, {
            x: margin + (j % cols) * cw + (cw - e.width * scale) / 2,
            y:
              h -
              margin -
              (Math.floor(j / cols) + 1) * ch +
              (ch - e.height * scale) / 2,
            width: e.width * scale,
            height: e.height * scale,
          });
        }
      }
    } else
      for (let i = 0; i < count; i++) {
        const source = doc.getPage(i);
        if (!selected.includes(i)) {
          out.addPage((await out.copyPages(doc, [i]))[0]);
          continue;
        }
        const e = await out.embedPage(source);
        const w =
            tool === "resize-pdf" ? num(s, "width", 595.28, 72, 3000) : e.width,
          h =
            tool === "resize-pdf"
              ? num(s, "height", 841.89, 72, 3000)
              : e.height;
        const p = out.addPage([w, h]);
        if (tool === "flip-pdf")
          p.drawPage(e, {
            x: s.direction === "vertical" ? 0 : w,
            y: s.direction === "vertical" ? h : 0,
            xScale: s.direction === "vertical" ? 1 : -1,
            yScale: s.direction === "vertical" ? -1 : 1,
          });
        else {
          const margin = num(s, "margin", 20, 0, 150);
          if (2 * margin >= Math.min(w, h))
            throw Error("Margins leave no space for content.");
          const scale = Math.min(
            (w - 2 * margin) / e.width,
            (h - 2 * margin) / e.height,
          );
          p.drawPage(e, {
            x: (w - e.width * scale) / 2,
            y: (h - e.height * scale) / 2,
            width: e.width * scale,
            height: e.height * scale,
          });
        }
      }
    await save(out);
    return outputs;
  }
  if (tool === "rotate-pdf") {
    const angle = num(s, "angle", 90, 0, 270);
    if (angle % 90) throw Error("Use 90, 180 or 270 degrees.");
    for (const i of selected)
      doc
        .getPage(i)
        .setRotation(
          degrees((doc.getPage(i).getRotation().angle + angle) % 360),
        );
  } else if (tool === "crop-pdf") {
    const m = num(s, "margin", 24, 0, 1000);
    for (const i of selected) {
      const p = doc.getPage(i),
        b = p.getCropBox();
      if (2 * m >= Math.min(b.width, b.height))
        throw Error("Margins would remove the whole page.");
      p.setCropBox(b.x + m, b.y + m, b.width - 2 * m, b.height - 2 * m);
    }
  } else if (
    [
      "watermark-pdf",
      "add-page-numbers",
      "header-footer",
      "bates-numbering",
    ].includes(tool)
  ) {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const size = num(s, "fontSize", tool === "watermark-pdf" ? 40 : 12, 6, 150),
      c = color(s.color);
    for (const i of selected) {
      const p = doc.getPage(i);
      const text =
        tool === "add-page-numbers"
          ? String(i + int(s, "start", 1, 0, 999999))
          : tool === "bates-numbering"
            ? String(s.prefix || "") +
              String(i + int(s, "start", 1, 0, 999999)).padStart(
                int(s, "digits", 6, 1, 12),
                "0",
              ) +
              String(s.suffix || "")
            : String(s.text || "")
                .replaceAll("{page}", String(i + 1))
                .replaceAll("{total}", String(count));
      if (!text) throw Error("Enter text to add.");
      if (text.length > 300) throw Error("Use at most 300 characters.");
      let x = (p.getWidth() - font.widthOfTextAtSize(text, size)) / 2,
        y = s.position === "top" ? p.getHeight() - size - 24 : 24;
      if (tool === "watermark-pdf") y = (p.getHeight() - size) / 2;
      p.drawText(text, {
        x: Math.max(8, x),
        y,
        size,
        font,
        color: c,
        opacity:
          tool === "watermark-pdf" ? num(s, "opacity", 0.25, 0.05, 1) : 1,
        rotate: degrees(
          tool === "watermark-pdf" ? num(s, "angle", 0, -180, 180) : 0,
        ),
      });
    }
  } else if (tool === "edit-pdf-metadata") {
    doc.setTitle(String(s.title || ""));
    doc.setAuthor(String(s.author || ""));
    doc.setSubject(String(s.subject || ""));
    doc.setKeywords(
      String(s.keywords || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    );
    doc.catalog.delete(PDFName.of("Metadata"));
  } else if (tool === "flatten-pdf") doc.getForm().flatten();
  else if (tool === "remove-annotations") {
    for (const i of selected) {
      const p = doc.getPage(i),
        ann = p.node.Annots();
      if (ann) {
        const keep = [];
        for (let j = 0; j < ann.size(); j++) {
          const a = ann.lookup(j, PDFDict);
          if (a.get(PDFName.of("Subtype"))?.toString() === "/Widget")
            keep.push(ann.get(j));
        }
        p.node.set(PDFName.of("Annots"), doc.context.obj(keep));
      }
    }
  } else if (tool === "create-bookmarks") {
    const lines = String(s.bookmarks || "")
      .split("\n")
      .filter((x) => x.trim());
    if (!lines.length || lines.length > 100)
      throw Error("Enter up to 100 bookmarks, one Title|page per line.");
    const outline = doc.context.obj({ Type: "Outlines" }),
      ref = doc.context.register(outline);
    const entries = lines.map((line) => {
      const pos = line.lastIndexOf("|"),
        title = line.slice(0, pos),
        page = Number(line.slice(pos + 1));
      if (pos < 1 || !Number.isInteger(page) || page < 1 || page > count)
        throw Error(
          "Each bookmark must be Title|page with a valid page number.",
        );
      const item = doc.context.obj({
        Title: PDFString.of(title),
        Parent: ref,
        Dest: [doc.getPage(page - 1).ref, "Fit"],
      });
      return { item, ref: doc.context.register(item) };
    });
    entries.forEach((e, i) => {
      if (i) e.item.set(PDFName.of("Prev"), entries[i - 1].ref);
      if (i < entries.length - 1)
        e.item.set(PDFName.of("Next"), entries[i + 1].ref);
    });
    outline.set(PDFName.of("First"), entries[0].ref);
    outline.set(PDFName.of("Last"), entries.at(-1)!.ref);
    outline.set(PDFName.of("Count"), PDFNumber.of(entries.length));
    doc.catalog.set(PDFName.of("Outlines"), ref);
  } else if (tool === "create-pdf-forms") {
    const form = doc.getForm(),
      page = doc.getPage(int(s, "page", 1, 1, count) - 1),
      name = String(s.fieldName || "field");
    if (form.getFields().some((f) => f.getName() === name))
      throw Error("A field with this name already exists.");
    const x = num(s, "x", 50, 0, page.getWidth()),
      y = num(s, "y", 50, 0, page.getHeight()),
      width = num(s, "width", 200, 15, 500),
      height = 30;
    if (x + width > page.getWidth() || y + height > page.getHeight())
      throw Error("Field exceeds the page bounds.");
    if (s.fieldType === "checkbox") {
      const f = form.createCheckBox(name);
      f.addToPage(page, { x, y, width: 20, height: 20 });
      if (s.required) f.enableRequired();
    } else if (s.fieldType === "dropdown") {
      const f = form.createDropdown(name);
      f.addOptions(String(s.options || "Option 1,Option 2").split(","));
      f.addToPage(page, { x, y, width, height });
      if (s.required) f.enableRequired();
    } else {
      const f = form.createTextField(name);
      f.setText(String(s.defaultValue || ""));
      f.addToPage(page, { x, y, width, height });
      if (s.required) f.enableRequired();
    }
  } else if (tool === "pdf-editor" || tool === "fill-sign") {
    const edits = JSON.parse(String(s.edits || "[]")) as {
      page: number;
      kind: string;
      x: number;
      y: number;
      width?: number;
      height?: number;
      text?: string;
      size?: number;
      color?: string;
      data?: string;
    }[];
    if (edits.length > 1000) throw Error("Too many edits.");
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (const e of edits) {
      const p = doc.getPage(e.page);
      if (!p || ![e.x, e.y].every(Number.isFinite))
        throw Error("Invalid edit position.");
      const c = color(e.color);
      if (e.kind === "text")
        p.drawText(e.text || "", {
          x: e.x,
          y: e.y,
          size: e.size || 16,
          font,
          color: c,
        });
      else if (e.kind === "image") {
        const img = await doc.embedPng(e.data!);
        p.drawImage(img, {
          x: e.x,
          y: e.y,
          width: e.width || 120,
          height: e.height || 50,
        });
      } else
        p.drawRectangle({
          x: e.x,
          y: e.y,
          width: e.width || 100,
          height: e.height || 25,
          color: e.kind === "whiteout" ? rgb(1, 1, 1) : c,
          opacity: e.kind === "highlight" ? 0.3 : 1,
        });
    }
    const fieldValues = JSON.parse(String(s.fieldValues || "{}"));
    for (const [name, val] of Object.entries(fieldValues)) {
      const f: any = doc.getForm().getField(name);
      if (typeof val === "boolean" && typeof f.check === "function")
        val ? f.check() : f.uncheck();
      else if (typeof f.setText === "function") f.setText(String(val));
      else if (typeof f.select === "function") f.select(String(val));
    }
  } else throw Error("This processing engine is not available.");
  await save(doc, `${tool}.pdf`);
  return outputs;
}
