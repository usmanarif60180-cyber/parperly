import test from "node:test";
import assert from "node:assert/strict";
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFArray,
  PDFString,
  PDFHexString,
  degrees,
} from "pdf-lib";
import {
  readDocument,
  exportEditor,
  flattenedSource,
} from "../packages/pdf-editor/engine";
import {
  defaultObject,
  rotatedPage,
  reorderPage,
  safeUrl,
  type EditorState,
} from "../packages/pdf-editor/model";
import { writeFile, mkdir } from "node:fs/promises";
const n = PDFName.of;
async function sample() {
  const d = await PDFDocument.create();
  const p = d.addPage([600, 800]);
  p.drawText("Original page one", { x: 30, y: 750, size: 16 });
  const p2 = d.addPage([400, 600]);
  p2.drawText("Original page two", { x: 30, y: 550, size: 16 });
  const f = d.getForm();
  const t = f.createTextField("Name");
  t.setText("Before");
  t.addToPage(p, { x: 50, y: 620, width: 200, height: 30 });
  const c = f.createCheckBox("Agree");
  c.addToPage(p, { x: 50, y: 580, width: 20, height: 20 });
  const r = f.createRadioGroup("Plan");
  r.addOptionToPage("Basic", p, { x: 50, y: 540, width: 20, height: 20 });
  r.addOptionToPage("Pro", p, { x: 90, y: 540, width: 20, height: 20 });
  const dd = f.createDropdown("Country");
  dd.addOptions(["France", "United Kingdom"]);
  dd.select("France");
  dd.addToPage(p, { x: 50, y: 490, width: 200, height: 30 });
  const link = d.context.register(
    d.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [30, 700, 150, 720],
      A: { S: "URI", URI: PDFString.of("https://example.org") },
    }),
  );
  p.node.addAnnot(link);
  const bytes = await d.save();
  const info = await readDocument(bytes, 0, "original");
  return {
    bytes,
    info,
    link,
    state: {
      pages: info.pages,
      objects: [],
      values: Object.fromEntries(info.fields.map((f) => [f.name, f.value])),
      removed: [],
    } as EditorState,
  };
}
function annots(d: PDFDocument, i = 0) {
  return (d.getPage(i).node.Annots()?.asArray() || []).map((a) =>
    d.context.lookup(a, PDFDict),
  );
}
function subtype(d: PDFDict) {
  return d.get(n("Subtype"))?.toString();
}
test("detects form text, checkbox, radio and dropdown with options", async () => {
  const { info } = await sample();
  assert.deepEqual(
    info.fields.map((f) => f.type),
    ["text", "checkbox", "radio", "dropdown"],
  );
  assert.deepEqual(info.fields[2].options, ["Basic", "Pro"]);
  assert.deepEqual(info.fields[0].pages, ["original-0"]);
});
test("edits forms and preserves fillable widgets when pages are reordered", async () => {
  const { bytes, state } = await sample();
  state.values = {
    Name: "Parperly edited",
    Agree: true,
    Plan: "Pro",
    Country: "United Kingdom",
  };
  const s = reorderPage(state, 0, 1);
  const out = await exportEditor([bytes], s);
  const d = await PDFDocument.load(out);
  assert.equal(d.getPage(0).getWidth(), 400);
  assert.equal(d.getPage(1).getWidth(), 600);
  assert.equal(d.getForm().getTextField("Name").getText(), "Parperly edited");
  assert.equal(d.getForm().getCheckBox("Agree").isChecked(), true);
  assert.equal(d.getForm().getRadioGroup("Plan").getSelected(), "Pro");
  assert.deepEqual(d.getForm().getDropdown("Country").getSelected(), [
    "United Kingdom",
  ]);
  assert.equal(annots(d, 1).filter((a) => subtype(a) === "/Widget").length, 5);
});
test("exports real text, transparent images, signatures, shapes, links and annotations", async () => {
  const { bytes, state } = await sample();
  const p = state.pages[0].id;
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
  state.objects = [
    {
      ...defaultObject("text", p, 50, 240),
      text: "Edited text\nSecond line",
      bold: true,
      italic: true,
      align: "center",
    },
    ...(["image", "signature"] as const).map((kind, i) => ({
      ...defaultObject(kind, p, 50 + i * 120, 350),
      data: png,
      width: 80,
      height: 60,
    })),
    ...(
      [
        "rectangle",
        "ellipse",
        "arrow",
        "line",
        "checkmark",
        "whiteout",
      ] as const
    ).map((kind, i) => ({
      ...defaultObject(kind, p, 40 + i * 80, 440),
      width: 50,
      height: 40,
      fill: "#e5f5e9",
    })),
    {
      ...defaultObject("link", p, 250, 100),
      url: "https://parperly.com",
      thickness: 0,
    },
    {
      ...defaultObject("link", p, 250, 160),
      target: state.pages[1].id,
      thickness: 0,
    },
    ...(
      ["highlight", "underline", "strikeout", "comment", "draw"] as const
    ).map((kind, i) => ({
      ...defaultObject(kind, p, 50 + i * 100, 550),
      text: "Review note",
      width: 80,
      height: 35,
      points: [
        [0, 0],
        [0.5, 1],
        [1, 0],
      ],
      opacity: 0.4,
    })),
  ];
  const out = await exportEditor([bytes], state);
  assert.notDeepEqual(out, bytes);
  const d = await PDFDocument.load(out);
  assert.equal(d.getPageCount(), 2);
  const types = annots(d).map(subtype);
  for (const kind of [
    "Link",
    "Highlight",
    "Underline",
    "StrikeOut",
    "Text",
    "Ink",
  ])
    assert.ok(types.includes("/" + kind), kind);
  const links = annots(d).filter((a) => subtype(a) === "/Link");
  assert.equal(links.length, 3);
  assert.equal(
    links[2].lookup(n("Dest"), PDFArray).get(0).toString(),
    d.getPage(1).ref.toString(),
  );
  assert.ok(
    d.getPage(0).node.Resources()?.lookup(n("XObject"), PDFDict).keys().length,
  );
  await mkdir("tests/fixtures", { recursive: true });
  await writeFile("tests/fixtures/editor-comprehensive.pdf", out);
  await writeFile("tests/fixtures/editor-forms.pdf", bytes);
});
test("removes a selected original link without removing form widgets", async () => {
  const { bytes, state, link } = await sample();
  state.removed = [`${state.pages[0].id}:${link.objectNumber}R`];
  const d = await PDFDocument.load(await exportEditor([bytes], state));
  assert.equal(annots(d).filter((a) => subtype(a) === "/Link").length, 0);
  assert.equal(d.getForm().getFields().length, 4);
});
test("page deletion removes orphan fields while keeping a valid document", async () => {
  const { bytes, state } = await sample();
  state.pages = state.pages.slice(1);
  const d = await PDFDocument.load(await exportEditor([bytes], state));
  assert.equal(d.getPageCount(), 1);
  assert.equal(d.getForm().getFields().length, 0);
});
test("flattening makes fields read-only and bakes new marks but keeps links", async () => {
  const { bytes, state } = await sample();
  state.objects = [
    { ...defaultObject("highlight", state.pages[0].id, 20, 20), opacity: 0.4 },
  ];
  const d = await PDFDocument.load(await exportEditor([bytes], state, true));
  assert.equal(d.getForm().getFields().length, 0);
  assert.equal(annots(d).filter((a) => subtype(a) === "/Highlight").length, 0);
  assert.equal(annots(d).filter((a) => subtype(a) === "/Link").length, 1);
});
test("inserts blank landscape and imported pages and preserves original form fields", async () => {
  const { bytes, state } = await sample();
  const flat = await flattenedSource(bytes);
  const imported = await readDocument(flat, 1, "imported");
  state.pages.splice(
    1,
    0,
    {
      id: "blank",
      source: -1,
      index: 0,
      width: 842,
      height: 595,
      rotation: 0,
      cropX: 0,
      cropY: 0,
    },
    imported.pages[0],
  );
  const d = await PDFDocument.load(await exportEditor([bytes, flat], state));
  assert.deepEqual(
    d.getPages().map((p) => p.getWidth()),
    [600, 842, 600, 400],
  );
  assert.equal(d.getForm().getFields().length, 4);
});
test("rotating a page moves overlays with page content and preserves undo state", async () => {
  const { bytes, state } = await sample();
  state.objects = [
    {
      ...defaultObject("text", state.pages[0].id, 40, 60),
      width: 100,
      height: 30,
      text: "Rotation marker",
    },
  ];
  const changed = rotatedPage(state, state.pages[0].id);
  assert.equal(state.pages[0].rotation, 0);
  assert.equal(changed.pages[0].rotation, 90);
  assert.equal(changed.objects[0].rotation, 90);
  const d = await PDFDocument.load(await exportEditor([bytes], changed));
  assert.equal(d.getPage(0).getRotation().angle, 90);
  await writeFile("tests/fixtures/editor-rotated.pdf", await d.save());
});
test("rejects dangerous links and dangling internal destinations", async () => {
  assert.throws(() => safeUrl("javascript:alert(1)"));
  const { bytes, state } = await sample();
  state.objects = [
    { ...defaultObject("link", state.pages[0].id, 0, 0), target: "missing" },
  ];
  await assert.rejects(exportEditor([bytes], state), /deleted page/);
});
test("reports unsupported added text rather than pretending export succeeded", async () => {
  const { bytes, state } = await sample();
  state.objects = [
    { ...defaultObject("text", state.pages[0].id, 0, 0), text: "漢字" },
  ];
  await assert.rejects(exportEditor([bytes], state), /cannot encode/);
});

test("server-result snapshots preserve original form fields and allow undo to prior source", async () => {
  const { bytes, state } = await sample();
  const serverDoc = await PDFDocument.load(bytes);
  serverDoc.getForm().getTextField("Name").setText("Server result");
  const returned = await serverDoc.save();
  const info = await readDocument(returned, 1, "server");
  const next: EditorState = {
    baseSource: 1,
    pages: info.pages,
    objects: [],
    values: Object.fromEntries(info.fields.map((f) => [f.name, f.value])),
    removed: [],
  };
  const after = await PDFDocument.load(
    await exportEditor([bytes, returned], next),
  );
  assert.equal(after.getForm().getTextField("Name").getText(), "Server result");
  const before = await PDFDocument.load(
    await exportEditor([bytes, returned], state),
  );
  assert.equal(before.getForm().getTextField("Name").getText(), "Before");
});

test("clears selected radio and dropdown fields on export", async () => {
  const { bytes, state } = await sample();
  state.values.Plan = "";
  state.values.Country = "";
  const doc = await PDFDocument.load(await exportEditor([bytes], state));
  assert.equal(doc.getForm().getRadioGroup("Plan").getSelected(), undefined);
  assert.deepEqual(doc.getForm().getDropdown("Country").getSelected(), []);
});

test("removes annotations from imported pages without changing sibling copies", async () => {
  const { bytes, state } = await sample();
  const imported = await flattenedSource(bytes);
  const info = await readDocument(imported, 1, "imported");
  const source = await PDFDocument.load(imported);
  const ref = source.getPage(0).node.Annots()!.asArray()[0];
  const id = ref
    .toString()
    .replace(/ (\d+) R$/, (_, g) => `R${g === "0" ? "" : g}`);
  state.pages.push(info.pages[0], { ...info.pages[0], id: "sibling" });
  state.removed.push(`${info.pages[0].id}:${id}`);
  const out = await PDFDocument.load(
    await exportEditor([bytes, imported], state),
  );
  assert.equal(annots(out, 2).filter((a) => subtype(a) === "/Link").length, 0);
  assert.equal(annots(out, 3).filter((a) => subtype(a) === "/Link").length, 1);
});

test("preserves multi-select dropdown choices during unrelated edits", async () => {
  const { bytes } = await sample();
  const doc = await PDFDocument.load(bytes);
  const field = doc.getForm().getDropdown("Country");
  field.enableMultiselect();
  field.select(["France", "United Kingdom"]);
  const raw = await doc.save();
  const info = await readDocument(raw);
  const state: EditorState = {
    pages: info.pages,
    objects: [],
    removed: [],
    values: Object.fromEntries(info.fields.map((f) => [f.name, f.value])),
  };
  state.values.Name = "Unrelated edit";
  const out = await PDFDocument.load(await exportEditor([raw], state));
  assert.deepEqual(out.getForm().getDropdown("Country").getSelected(), [
    "France",
    "United Kingdom",
  ]);
});

test("rejects export beyond the supported 300-page workspace limit", async () => {
  const doc = await PDFDocument.create();
  doc.addPage([100, 100]);
  const bytes = await doc.save();
  const info = await readDocument(bytes);
  const pages = Array.from({ length: 301 }, (_, i) => ({
    ...info.pages[0],
    source: -1,
    id: `blank-${i}`,
  }));
  await assert.rejects(
    exportEditor([bytes], { pages, objects: [], values: {}, removed: [] }),
    /300 pages/,
  );
});

test("stale async imports cannot replace a newer edit or undone state", async () => {
  const { assertCurrentSnapshot } =
    await import("../packages/pdf-editor/model");
  const { state } = await sample();
  const newer = { ...state, values: { ...state.values, Name: "Latest edit" } };
  assert.doesNotThrow(() => assertCurrentSnapshot(state, state));
  assert.throws(
    () => assertCurrentSnapshot(state, newer),
    /latest edits were kept/,
  );
  assert.throws(
    () => assertCurrentSnapshot(newer, state),
    /latest edits were kept/,
  );
  assert.equal(newer.values.Name, "Latest edit");
});
