import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, PDFString, PDFHexString } from "pdf-lib";
import { processPdf } from "../packages/pdf-core";
import { bookmarkBoundaries } from "../packages/pdf-core/bookmarks";
const n = PDFName.of;
async function fixture() {
  const d = await PDFDocument.create();
  for (let i = 0; i < 5; i++) d.addPage([200 + i * 10, 300]);
  const outline = d.context.obj({ Type: "Outlines" }),
    root = d.context.register(outline);
  const a = d.context.obj({
    Title: PDFString.of("First"),
    Parent: root,
    Dest: [d.getPage(1).ref, "Fit"],
  });
  const b = d.context.obj({
    Title: PDFString.of("Second"),
    Parent: root,
    A: { S: "GoTo", D: PDFString.of("chapter-two") },
  });
  const ar = d.context.register(a),
    br = d.context.register(b);
  a.set(n("Next"), br);
  outline.set(n("First"), ar);
  outline.set(n("Last"), br);
  d.catalog.set(n("Outlines"), root);
  d.catalog.set(
    n("Names"),
    d.context.obj({
      Dests: {
        Kids: [
          {
            Names: [
              PDFHexString.fromText("chapter-two"),
              { D: [d.getPage(3).ref, "Fit"] },
            ],
          },
        ],
      },
    }),
  );
  return { d, a, b, ar };
}
test("bookmark split resolves direct and named GoTo destinations and preserves preamble/order", async () => {
  const { d } = await fixture();
  const f = d.getForm().createTextField("Value");
  f.setText("Keep me");
  f.addToPage(d.getPage(1));
  const outputs = await processPdf("split-by-bookmarks", [
    { name: "book.pdf", bytes: await d.save() },
  ]);
  assert.deepEqual(
    outputs.map((o) => o.pages),
    [1, 2, 2],
  );
  const widths = [];
  for (const out of outputs) {
    const pdf = await PDFDocument.load(out.bytes);
    widths.push(...pdf.getPages().map((p) => p.getWidth()));
    assert.equal(pdf.getForm().getFields().length, 0);
    for (const p of pdf.getPages())
      for (const a of p.node.Annots()?.asArray() || [])
        assert.ok(pdf.context.lookup(a));
  }
  assert.deepEqual(widths, [200, 210, 220, 230, 240]);
});
test("bookmark levels, duplicate and unordered destinations are handled deterministically", async () => {
  const { d, a, b } = await fixture();
  a.set(
    n("First"),
    d.context.register(
      d.context.obj({
        Title: PDFString.of("Child"),
        Dest: [d.getPage(2).ref, "Fit"],
      }),
    ),
  );
  assert.deepEqual(bookmarkBoundaries(d, 2), [0, 2]);
  b.set(n("Dest"), d.context.obj([d.getPage(1).ref, "Fit"]));
  assert.deepEqual(bookmarkBoundaries(d, 1), [0, 1]);
  a.set(n("Dest"), d.context.obj([d.getPage(4).ref, "Fit"]));
  assert.deepEqual(bookmarkBoundaries(d, 1), [0, 1, 4]);
});
test("malformed, external, empty and invalid bookmark levels fail explicitly", async () => {
  const { d, b, ar } = await fixture();
  b.set(n("Next"), ar);
  assert.throws(() => bookmarkBoundaries(d, 1), /Malformed/);
  b.delete(n("Next"));
  b.set(
    n("A"),
    d.context.obj({ S: "URI", URI: PDFString.of("https://example.org") }),
  );
  assert.throws(() => bookmarkBoundaries(d, 1), /outside/);
  assert.throws(() => bookmarkBoundaries(d, 0), /level/);
  assert.throws(() => bookmarkBoundaries(d, 2), /No bookmarks/);
});
