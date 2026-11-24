import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFRef,
  PDFHexString,
  PDFString,
  StandardFonts,
  rgb,
  degrees,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  type PDFPage,
  type PDFFont,
} from "pdf-lib";
import {
  dimensions,
  safeUrl,
  type EditorObject,
  type EditorPage,
  type EditorState,
  type Field,
} from "./model";
const n = PDFName.of;
const color = (v: string) => {
  if (!/^#[0-9a-f]{6}$/i.test(v)) throw Error("Invalid color.");
  return rgb(
    parseInt(v.slice(1, 3), 16) / 255,
    parseInt(v.slice(3, 5), 16) / 255,
    parseInt(v.slice(5, 7), 16) / 255,
  );
};
export async function readDocument(
  bytes: Uint8Array,
  source = 0,
  prefix = "page",
) {
  const doc = await PDFDocument.load(bytes);
  if (doc.isEncrypted) throw Error("Use an unlocked PDF copy.");
  const pages = doc.getPages().map((p, i) => {
    const b = p.getCropBox();
    return {
      id: `${prefix}-${i}`,
      source,
      index: i,
      width: b.width,
      height: b.height,
      cropX: b.x,
      cropY: b.y,
      rotation: ((p.getRotation().angle % 360) + 360) % 360,
    } as EditorPage;
  });
  if (!pages.length || pages.length > 300)
    throw Error("Choose a PDF with 1–300 pages.");
  const fields: Field[] = doc
    .getForm()
    .getFields()
    .map((f) => {
      let type: Field["type"] = "unsupported",
        value: string | boolean = "",
        options: string[] = [];
      if (f instanceof PDFTextField) {
        type = "text";
        value = f.getText() || "";
      } else if (f instanceof PDFCheckBox) {
        type = "checkbox";
        value = f.isChecked();
      } else if (f instanceof PDFRadioGroup) {
        type = "radio";
        value = f.getSelected() || "";
        options = f.getOptions();
      } else if (f instanceof PDFDropdown) {
        type = "dropdown";
        value = f.getSelected()[0] || "";
        options = f.getOptions();
      }
      const refs = f.acroField.getWidgets().map((w) => w.P()?.toString());
      const fieldPages = doc.getPages().flatMap((p, i) => {
        const annots =
          p.node
            .Annots()
            ?.asArray()
            .map((a) => a.toString()) || [];
        return refs.includes(p.ref.toString()) ||
          f.acroField
            .getWidgets()
            .some((w) =>
              annots.some(
                (r) =>
                  doc.context.lookup(PDFRef.of(Number(r.split(" ")[0]))) ===
                  w.dict,
              ),
            )
          ? [pages[i].id]
          : [];
      });
      return {
        name: f.getName(),
        type,
        value,
        options,
        readOnly: f.isReadOnly(),
        pages: fieldPages,
      };
    });
  return { pages, fields };
}
export async function flattenedSource(bytes: Uint8Array) {
  const d = await PDFDocument.load(bytes);
  const f = d.getForm();
  if (f.getFields().length) f.flatten();
  for (const p of d.getPages()) {
    const a = p.node.Annots();
    if (a)
      for (let i = a.size() - 1; i >= 0; i--)
        if (!d.context.lookup(a.get(i))) a.remove(i);
  }
  return d.save();
}
function matrix(
  p: EditorPage,
): [number, number, number, number, number, number] {
  const { width: w, height: h, cropX: x, cropY: y } = p;
  switch (p.rotation) {
    case 90:
      return [0, 1, -1, 0, x + w, y];
    case 180:
      return [-1, 0, 0, -1, x + w, y + h];
    case 270:
      return [0, -1, 1, 0, x, y + h];
    default:
      return [1, 0, 0, 1, x, y];
  }
}
function point(p: EditorPage, x: number, y: number) {
  const [a, b, c, d, e, f] = matrix(p);
  const h = dimensions(p).height;
  return [a * x + c * (h - y) + e, b * x + d * (h - y) + f];
}
function corners(o: EditorObject) {
  const rad = (o.rotation * Math.PI) / 180,
    c = Math.cos(rad),
    s = Math.sin(rad),
    cx = o.x + o.width / 2,
    cy = o.y + o.height / 2;
  return [
    [0, 0],
    [o.width, 0],
    [0, o.height],
    [o.width, o.height],
  ].map(([x, y]) => {
    x -= o.width / 2;
    y -= o.height / 2;
    return [cx + x * c - y * s, cy + x * s + y * c];
  });
}
function annotation(
  doc: PDFDocument,
  page: PDFPage,
  props: Record<string, unknown>,
) {
  const a = doc.context.obj(props as any);
  page.node.addAnnot(doc.context.register(a));
}
function removeAnnots(doc: PDFDocument, page: PDFPage, removed: string[]) {
  const a = page.node.Annots();
  if (!a) return;
  for (let i = a.size() - 1; i >= 0; i--) {
    const ref = a.get(i);
    const id =
      ref instanceof PDFRef
        ? `${ref.objectNumber}R${ref.generationNumber || ""}`
        : "";
    if (removed.includes(id)) a.remove(i);
  }
}
function fontKey(o: EditorObject): StandardFonts {
  const suffix =
    o.bold && o.italic
      ? "BoldOblique"
      : o.bold
        ? "Bold"
        : o.italic
          ? "Oblique"
          : "";
  if (o.font === "TimesRoman")
    return {
      "": StandardFonts.TimesRoman,
      Bold: StandardFonts.TimesRomanBold,
      Oblique: StandardFonts.TimesRomanItalic,
      BoldOblique: StandardFonts.TimesRomanBoldItalic,
    }[suffix];
  return (StandardFonts as any)[o.font + suffix];
}
function appearance(
  doc: PDFDocument,
  rect: number[],
  o: EditorObject,
  points: number[][],
  mode: "fill" | "line",
) {
  const c = color(o.color),
    nums = (p: number[]) => p.map((v) => Number(v.toFixed(4))).join(" ");
  const path = points.map((p, i) => `${nums(p)} ${i ? "l" : "m"}`).join(" ");
  const stream = doc.context.flateStream(
    `q /GS gs ${c.red} ${c.green} ${c.blue} rg ${c.red} ${c.green} ${c.blue} RG ${o.thickness} w 1 J 1 j ${path} ${mode === "fill" ? "h f" : "S"} Q`,
    {
      Type: "XObject",
      Subtype: "Form",
      BBox: rect,
      Resources: {
        ExtGState: { GS: { Type: "ExtGState", ca: o.opacity, CA: o.opacity } },
      },
    },
  );
  return { N: doc.context.register(stream) };
}
export async function exportEditor(
  sources: Uint8Array[],
  state: EditorState,
  flatten = false,
): Promise<Uint8Array> {
  if (!state.pages.length) throw Error("Keep at least one page.");
  const baseSource = state.baseSource ?? 0;
  const doc = await PDFDocument.load(sources[baseSource]);
  const originals = doc.getPages();
  const form = doc.getForm();
  for (const f of form.getFields()) {
    const value = state.values[f.getName()];
    if (value === undefined || f.isReadOnly()) continue;
    if (f instanceof PDFTextField && value !== (f.getText() || ""))
      f.setText(String(value));
    if (f instanceof PDFCheckBox) value ? f.check() : f.uncheck();
    if (f instanceof PDFRadioGroup || f instanceof PDFDropdown) {
      if (value) f.select(String(value));
      else f.clear();
    }
  }
  // Keep original page references and AcroForm tree; imported/duplicated sources are flattened on import.
  const kept = new Set(
    state.pages
      .filter((p) => p.source === baseSource)
      .map((p) => originals[p.index].ref.toString()),
  );
  for (const f of form.getFields()) {
    const widgets = f.acroField.getWidgets();
    for (let i = widgets.length - 1; i >= 0; i--) {
      const w = widgets[i];
      let owner = w.P()?.toString();
      if (!owner)
        owner = originals
          .find((p) =>
            p.node
              .Annots()
              ?.asArray()
              .some((a) => doc.context.lookup(a) === w.dict),
          )
          ?.ref.toString();
      if (owner && !kept.has(owner)) f.acroField.removeWidget(i);
    }
    if (!f.acroField.getWidgets().length) form.removeField(f);
  }
  while (doc.getPageCount()) doc.removePage(0);
  const loaded = new Map<number, PDFDocument>();
  for (const p of state.pages) {
    let page: PDFPage;
    if (p.source === baseSource) page = originals[p.index];
    else if (p.source < 0) page = doc.addPage([p.width, p.height]);
    else {
      let source = loaded.get(p.source);
      if (!source) {
        source = await PDFDocument.load(sources[p.source]);
        loaded.set(p.source, source);
      }
      [page] = await doc.copyPages(source, [p.index]);
    }
    if (p.source >= 0) doc.addPage(page);
    page.setRotation(degrees(p.rotation));
    if (p.source === baseSource)
      removeAnnots(
        doc,
        page,
        state.removed
          .filter((r) => r.startsWith(p.id + ":"))
          .map((r) => r.slice(p.id.length + 1)),
      );
  }
  const fonts = new Map<string, PDFFont>();
  for (let i = 0; i < state.pages.length; i++) {
    const descriptor = state.pages[i],
      page = doc.getPage(i),
      dim = dimensions(descriptor);
    for (const o of state.objects.filter((o) => o.page === descriptor.id)) {
      if (
        ![
          o.x,
          o.y,
          o.width,
          o.height,
          o.rotation,
          o.size,
          o.opacity,
          o.thickness,
          o.lineHeight,
        ].every(Number.isFinite) ||
        o.width <= 0 ||
        o.height <= 0
      )
        throw Error("Object dimensions must be positive finite values.");
      const pts = corners(o).map(([x, y]) => point(descriptor, x, y));
      const xs = pts.map((p) => p[0]),
        ys = pts.map((p) => p[1]);
      const rect = [
        Math.min(...xs),
        Math.min(...ys),
        Math.max(...xs),
        Math.max(...ys),
      ];
      const common = {
        Type: "Annot",
        Rect: rect,
        P: page.ref,
        F: 4,
        C: [color(o.color).red, color(o.color).green, color(o.color).blue],
        CA: o.opacity,
        NM: PDFHexString.fromText(o.id),
      };
      if (o.kind === "link") {
        const target = state.pages.findIndex((p) => p.id === o.target);
        if (o.target && target < 0)
          throw Error(
            "A link points to a deleted page. Choose a new destination or remove it.",
          );
        annotation(doc, page, {
          ...common,
          Subtype: "Link",
          Border: [0, 0, o.thickness],
          ...(o.target
            ? { Dest: [doc.getPage(target).ref, "Fit"] }
            : { A: { S: "URI", URI: PDFString.of(safeUrl(o.url || "")) } }),
        });
        continue;
      }
      if (o.kind === "comment" && !flatten) {
        annotation(doc, page, {
          ...common,
          Subtype: "Text",
          Name: "Comment",
          Contents: PDFHexString.fromText(o.text),
          T: PDFHexString.fromText("Parperly"),
          Open: false,
        });
        continue;
      }
      if (
        ["highlight", "underline", "strikeout"].includes(o.kind) &&
        !flatten
      ) {
        annotation(doc, page, {
          ...common,
          Subtype: (
            {
              highlight: "Highlight",
              underline: "Underline",
              strikeout: "StrikeOut",
            } as any
          )[o.kind],
          AP: appearance(
            doc,
            rect,
            o,
            o.kind === "highlight"
              ? [pts[0], pts[1], pts[3], pts[2]]
              : o.kind === "underline"
                ? [pts[2], pts[3]]
                : [
                    [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2],
                    [(pts[1][0] + pts[3][0]) / 2, (pts[1][1] + pts[3][1]) / 2],
                  ],
            o.kind === "highlight" ? "fill" : "line",
          ),
          QuadPoints: pts.flat(),
          Contents: PDFHexString.fromText(o.text === "Your text" ? "" : o.text),
          BS: { W: o.thickness, S: "S" },
        });
        continue;
      }
      if (o.kind === "draw" && !flatten) {
        const ink = (o.points || []).map(([x, y]) => {
          const rad = (o.rotation * Math.PI) / 180;
          const dx = x * o.width - o.width / 2,
            dy = y * o.height - o.height / 2;
          return point(
            descriptor,
            o.x + o.width / 2 + dx * Math.cos(rad) - dy * Math.sin(rad),
            o.y + o.height / 2 + dx * Math.sin(rad) + dy * Math.cos(rad),
          );
        });
        annotation(doc, page, {
          ...common,
          Subtype: "Ink",
          InkList: [ink.flat()],
          AP: appearance(doc, rect, o, ink, "line"),
          BS: { W: o.thickness, S: "S" },
        });
        continue;
      }
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(...matrix(descriptor)),
      );
      const x = o.x,
        y = dim.height - o.y - o.height,
        cx = x + o.width / 2,
        cy = y + o.height / 2,
        r = (-o.rotation * Math.PI) / 180;
      page.pushOperators(
        concatTransformationMatrix(
          Math.cos(r),
          Math.sin(r),
          -Math.sin(r),
          Math.cos(r),
          cx - Math.cos(r) * cx + Math.sin(r) * cy,
          cy - Math.sin(r) * cx - Math.cos(r) * cy,
        ),
      );
      const stroke = color(o.color),
        fill = o.fill === "none" ? undefined : color(o.fill),
        options = { opacity: o.opacity, borderOpacity: o.opacity };
      if (o.kind === "text") {
        const key = fontKey(o);
        let font = fonts.get(key);
        if (!font) {
          font = await doc.embedFont(key);
          fonts.set(key, font);
        }
        for (const [lineIndex, line] of o.text.split("\n").entries()) {
          let width: number;
          try {
            width = font.widthOfTextAtSize(line, o.size);
          } catch {
            throw Error(
              "This font cannot encode one of your characters. Use Latin text with the built-in fonts; Unicode font embedding requires an additional font integration.",
            );
          }
          const offset =
            o.align === "center"
              ? (o.width - width) / 2
              : o.align === "right"
                ? o.width - width
                : 0;
          page.drawText(line, {
            x: x + offset,
            y: y + o.height - o.size - lineIndex * o.size * o.lineHeight,
            font,
            size: o.size,
            color: stroke,
            opacity: o.opacity,
          });
        }
      } else if (o.kind === "image" || o.kind === "signature") {
        if (!o.data) throw Error("Image data missing.");
        const image = o.data.startsWith("data:image/jpeg")
          ? await doc.embedJpg(o.data)
          : await doc.embedPng(o.data);
        page.drawImage(image, {
          x,
          y,
          width: o.width,
          height: o.height,
          opacity: o.opacity,
        });
      } else if (o.kind === "ellipse" || o.kind === "circle")
        page.drawEllipse({
          x: cx,
          y: cy,
          xScale: o.width / 2,
          yScale: o.height / 2,
          borderColor: stroke,
          borderWidth: o.thickness,
          color: fill,
          ...options,
        });
      else if (
        [
          "line",
          "arrow",
          "underline",
          "strikeout",
          "checkmark",
          "draw",
        ].includes(o.kind)
      ) {
        let points: number[][] =
          o.kind === "draw"
            ? (o.points || []).map(([px, py]) => [
                x + px * o.width,
                y + (1 - py) * o.height,
              ])
            : o.kind === "checkmark"
              ? [
                  [x, y + o.height * 0.5],
                  [x + o.width * 0.35, y],
                  [x + o.width, y + o.height],
                ]
              : o.kind === "underline"
                ? [
                    [x, y],
                    [x + o.width, y],
                  ]
                : o.kind === "strikeout"
                  ? [
                      [x, cy],
                      [x + o.width, cy],
                    ]
                  : [
                      [x, y],
                      [x + o.width, y + o.height],
                    ];
        const line = (a: number[], b: number[]) =>
          page.drawLine({
            start: { x: a[0], y: a[1] },
            end: { x: b[0], y: b[1] },
            color: stroke,
            thickness: o.thickness,
            opacity: o.opacity,
          });
        for (let j = 1; j < points.length; j++) line(points[j - 1], points[j]);
        if (o.kind === "arrow") {
          const a = Math.atan2(o.height, o.width),
            end = points[1];
          for (const d of [-0.45, 0.45])
            line(end, [
              end[0] - 12 * Math.cos(a + d),
              end[1] - 12 * Math.sin(a + d),
            ]);
        }
      } else if (o.kind === "comment") {
        page.drawRectangle({
          x,
          y,
          width: o.width,
          height: o.height,
          color: rgb(1, 0.95, 0.65),
          borderColor: stroke,
          borderWidth: 1,
        });
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText(o.text, {
          x: x + 3,
          y: y + o.height - 14,
          font,
          size: 10,
          maxWidth: Math.max(10, o.width - 6),
          lineHeight: 12,
          color: stroke,
        });
      } else
        page.drawRectangle({
          x,
          y,
          width: o.width,
          height: o.height,
          color:
            o.kind === "whiteout"
              ? color(o.fill === "none" ? "#ffffff" : o.fill)
              : o.kind === "highlight"
                ? stroke
                : fill,
          borderColor:
            o.kind === "whiteout" || o.kind === "highlight"
              ? undefined
              : stroke,
          borderWidth: o.kind === "whiteout" ? 0 : o.thickness,
          opacity: o.kind === "whiteout" ? 1 : o.opacity,
          borderOpacity: o.opacity,
        });
      page.pushOperators(popGraphicsState());
    }
  }
  if (flatten) {
    form.flatten();
    for (const page of doc.getPages()) {
      const a = page.node.Annots();
      if (a)
        for (let i = a.size() - 1; i >= 0; i--)
          if (!doc.context.lookup(a.get(i))) a.remove(i);
    }
  }
  doc.setProducer("Parperly PDF Editor");
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  const reopened = await PDFDocument.load(bytes);
  if (reopened.getPageCount() !== state.pages.length)
    throw Error("Export page validation failed.");
  return bytes;
}

export function pdfRectangle(
  page: EditorPage,
  rect: { x: number; y: number; width: number; height: number },
) {
  const a = point(page, rect.x, rect.y),
    b = point(page, rect.x + rect.width, rect.y + rect.height);
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
  ];
}
