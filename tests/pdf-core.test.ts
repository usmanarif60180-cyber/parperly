import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib";
import {
  processPdf,
  pageRange,
  limits,
  type Settings,
} from "../packages/pdf-core/index";
async function sample() {
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 3; i++) {
    const p = d.addPage([300 + i * 20, 400 + i * 30]);
    p.drawText(`Page ${i + 1} — Invoice ${i + 1}`, {
      x: 30,
      y: 350,
      size: 16,
      font,
    });
    p.drawRectangle({
      x: 30,
      y: 40,
      width: 100,
      height: 40,
      color: rgb(i / 3, 0.4, 0.6),
    });
  }
  return { name: "sample.pdf", bytes: await d.save() };
}
async function read(o: any) {
  return PDFDocument.load(o.bytes);
}
test("page ranges preserve order, duplicates, odd/even and reject invalid ranges", () => {
  assert.deepEqual(pageRange("3,1-2,3", 3), [2, 0, 1, 2]);
  assert.deepEqual(pageRange("odd", 5), [0, 2, 4]);
  assert.deepEqual(pageRange("even", 5), [1, 3]);
  for (const r of ["0", "4", "2-1", "x", "1.5"])
    assert.throws(() => pageRange(r, 3));
});
test("merge and interleave preserve input page order and dimensions", async () => {
  const f = await sample();
  for (const tool of ["merge-pdf", "alternate-mix-pdf"]) {
    const [o] = await processPdf(tool, [f, f]);
    const d = await read(o);
    assert.equal(d.getPageCount(), 6);
    assert.equal(d.getPage(1).getWidth(), tool === "merge-pdf" ? 320 : 300);
  }
});
test("merge per-file ranges and grouped reverse interleave", async () => {
  const f = await sample();
  const [o] = await processPdf("merge-pdf", [f, f], { ranges: "3;1-2" });
  assert.deepEqual(
    (await read(o)).getPages().map((p) => p.getWidth()),
    [340, 300, 320],
  );
  const [mix] = await processPdf("alternate-mix-pdf", [f, f], {
    group: 2,
    reverse: true,
  });
  assert.deepEqual(
    (await read(mix)).getPages().map((p) => p.getWidth()),
    [340, 320, 340, 320, 300, 300],
  );
});
test("organize, extract, delete produce requested pages", async () => {
  const f = await sample();
  for (const tool of ["organize-pdf", "extract-pdf-pages"]) {
    const [o] = await processPdf(tool, [f], { pages: "3,1,3" });
    assert.deepEqual(
      (await read(o)).getPages().map((p) => p.getWidth()),
      [340, 300, 340],
    );
  }
  const [o] = await processPdf("delete-pdf-pages", [f], { pages: "2" });
  assert.deepEqual(
    (await read(o)).getPages().map((p) => p.getWidth()),
    [300, 340],
  );
  await assert.rejects(
    processPdf("delete-pdf-pages", [f], { pages: "all" }),
    /Keep/,
  );
});
test("split by page groups, separate extraction, text boundaries and size", async () => {
  const f = await sample();
  assert.deepEqual(
    (await processPdf("split-by-pages", [f], { every: 2 })).map((o) => o.pages),
    [2, 1],
  );
  assert.equal(
    (
      await processPdf("extract-pdf-pages", [f], {
        pages: "1,3",
        separate: true,
      })
    ).length,
    2,
  );
  assert.deepEqual(
    (await processPdf("split-by-text", [f], { boundaries: "1,2" })).map(
      (o) => o.pages,
    ),
    [1, 1, 1],
  );
  const result = await processPdf("split-by-file-size", [f], { sizeMB: 0.01 });
  assert.ok(result.every((o) => o.bytes.length <= 0.01 * 1024 * 1024));
  await assert.rejects(
    processPdf("split-by-file-size", [f], { sizeMB: 0.001 }),
    /Invalid/,
  );
});
test("split scanned spreads into halves with correct geometry", async () => {
  const f = await sample();
  for (const direction of ["vertical", "horizontal"]) {
    const [o] = await processPdf("split-in-half", [f], {
      pages: "1",
      direction,
    });
    const d = await read(o);
    assert.equal(d.getPageCount(), 2);
    assert.equal(d.getPage(0).getWidth(), direction === "vertical" ? 150 : 300);
    assert.equal(
      d.getPage(0).getHeight(),
      direction === "horizontal" ? 200 : 400,
    );
  }
});
test("rotate selected pages only, normalize angles and validate angle", async () => {
  const f = await sample();
  const [o] = await processPdf("rotate-pdf", [f], { pages: "2", angle: 90 });
  assert.deepEqual(
    (await read(o)).getPages().map((p) => p.getRotation().angle),
    [0, 90, 0],
  );
  await assert.rejects(processPdf("rotate-pdf", [f], { angle: 45 }), /90/);
});
test("crop preserves media box and changes selected crop box", async () => {
  const f = await sample();
  const [o] = await processPdf("crop-pdf", [f], { pages: "1", margin: 20 });
  const d = await read(o);
  assert.equal(d.getPage(0).getMediaBox().width, 300);
  assert.equal(d.getPage(0).getCropBox().width, 260);
  assert.equal(d.getPage(1).getCropBox().width, 320);
  await assert.rejects(processPdf("crop-pdf", [f], { margin: 500 }), /whole/);
});
test("resize, flip and N-up create parseable output with intended dimensions", async () => {
  const f = await sample();
  const [r] = await processPdf("resize-pdf", [f], { width: 612, height: 792 });
  assert.equal((await read(r)).getPage(0).getWidth(), 612);
  for (const direction of ["horizontal", "vertical"]) {
    const [o] = await processPdf("flip-pdf", [f], { direction });
    assert.equal(o.pages, 3);
  }
  const [n] = await processPdf("n-up-pdf", [f], { columns: 2, rows: 2 });
  assert.equal(n.pages, 1);
  assert.equal((await read(n)).getPage(0).getWidth(), 841.89);
});
for (const tool of [
  "watermark-pdf",
  "add-page-numbers",
  "header-footer",
  "bates-numbering",
])
  test(`${tool} produces new page content`, async () => {
    const f = await sample();
    const [o] = await processPdf(tool, [f], {
      text: "Page {page} of {total}",
      prefix: "CASE-",
      fontSize: 14,
      color: "#225533",
      start: 10,
    });
    assert.equal(o.pages, 3);
    assert.notDeepEqual(o.bytes, f.bytes);
    assert.ok((await read(o)).getPage(0).node.Contents());
  });
test("metadata updates and rename preserves exact bytes", async () => {
  const f = await sample();
  const [m] = await processPdf("edit-pdf-metadata", [f], {
    title: "Test title",
    author: "Paperly",
    keywords: "one,two",
  });
  const d = await read(m);
  assert.equal(d.getTitle(), "Test title");
  assert.equal(d.getAuthor(), "Paperly");
  const [r] = await processPdf("rename-pdf", [f], { filename: "../../report" });
  assert.ok(!r.name.includes("/"));
  assert.deepEqual(r.bytes, f.bytes);
});
test("forms can be created, filled, and flattened", async () => {
  const f = await sample();
  const [o] = await processPdf("create-pdf-forms", [f], {
    fieldName: "Name",
    x: 30,
    y: 50,
    width: 150,
    defaultValue: "Before",
    required: true,
  });
  const d = await read(o);
  assert.equal(d.getForm().getTextField("Name").getText(), "Before");
  assert.equal(d.getForm().getTextField("Name").isRequired(), true);
  const [filled] = await processPdf(
    "fill-sign",
    [{ name: "form.pdf", bytes: o.bytes }],
    { fieldValues: JSON.stringify({ Name: "After" }) },
  );
  assert.equal(
    (await read(filled)).getForm().getTextField("Name").getText(),
    "After",
  );
  const [flat] = await processPdf("flatten-pdf", [
    { name: "form.pdf", bytes: filled.bytes },
  ]);
  assert.equal((await read(flat)).getForm().getFields().length, 0);
  for (const fieldType of ["checkbox", "dropdown"]) {
    const [x] = await processPdf("create-pdf-forms", [f], {
      fieldType,
      fieldName: fieldType,
      x: 30,
      y: 50,
      width: 150,
    });
    assert.equal((await read(x)).getForm().getFields().length, 1);
  }
});
test("annotation removal retains form widgets", async () => {
  const f = await sample();
  const [form] = await processPdf("create-pdf-forms", [f], {
    fieldName: "Name",
    x: 30,
    y: 50,
    width: 150,
  });
  const d = await read(form);
  const page = d.getPage(0);
  const ann = d.context.register(
    d.context.obj({
      Type: "Annot",
      Subtype: "Text",
      Rect: [10, 10, 30, 30],
      Contents: "Comment",
    }),
  );
  page.node.addAnnot(ann);
  const [o] = await processPdf("remove-annotations", [
    { name: "ann.pdf", bytes: await d.save() },
  ]);
  const check = await read(o);
  assert.equal(check.getPage(0).node.Annots()?.size(), 1);
  assert.equal(check.getForm().getFields().length, 1);
});
test("bookmarks create valid outline destination references", async () => {
  const [o] = await processPdf("create-bookmarks", [await sample()], {
    bookmarks: "Intro|1\nEnd|3",
  });
  const d = await read(o);
  assert.ok(d.catalog.get(PDFName.of("Outlines")));
  await assert.rejects(
    processPdf("create-bookmarks", [await sample()], { bookmarks: "Bad|9" }),
    /valid page/,
  );
});
test("editor adds text and overlays without removing original pages", async () => {
  const edits = [
    {
      page: 0,
      kind: "text",
      x: 20,
      y: 20,
      size: 12,
      text: "Added text",
      color: "#222222",
    },
    {
      page: 1,
      kind: "highlight",
      x: 20,
      y: 30,
      width: 100,
      height: 20,
      color: "#ffff00",
    },
    { page: 1, kind: "whiteout", x: 20, y: 80, width: 100, height: 20 },
  ];
  const [o] = await processPdf("pdf-editor", [await sample()], {
    edits: JSON.stringify(edits),
  });
  assert.equal(o.pages, 3);
});
test("PNG images convert to a real PDF and reject unsupported images", async () => {
  const bytes = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const [o] = await processPdf("images-to-pdf", [{ name: "pixel.png", bytes }]);
  assert.equal(o.pages, 1);
  assert.equal((await read(o)).getPage(0).getWidth(), 595.28);
  await assert.rejects(
    processPdf("images-to-pdf", [
      { name: "fake.jpg", bytes: new Uint8Array([1, 2]) },
    ]),
    /PNG/,
  );
});
test("reject empty, invalid, malformed, oversized and unsupported processing", async () => {
  for (const bytes of [
    new Uint8Array(),
    new Uint8Array([1, 2, 3]),
    new TextEncoder().encode("%PDF-malformed"),
  ])
    await assert.rejects(
      processPdf("rotate-pdf", [{ name: "bad.pdf", bytes }]),
    );
  await assert.rejects(
    processPdf("rotate-pdf", [
      { name: "large.pdf", bytes: new Uint8Array(limits.bytes + 1) },
    ]),
    /40 MB/,
  );
  await assert.rejects(
    processPdf("compress-pdf", [await sample()]),
    /not available/,
  );
  await assert.rejects(processPdf("merge-pdf", [await sample()]), /two/);
});
test("integer-only layout and grouping settings reject fractions", async () => {
  const f = await sample();
  await assert.rejects(
    processPdf("split-by-pages", [f], { every: 1.5 }),
    /whole number/,
  );
  await assert.rejects(
    processPdf("n-up-pdf", [f], { rows: 1.5 }),
    /whole number/,
  );
});
