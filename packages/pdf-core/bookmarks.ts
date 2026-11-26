import {
  PDFDocument,
  PDFArray,
  PDFDict,
  PDFName,
  PDFString,
  PDFHexString,
  PDFRef,
  type PDFObject,
} from "pdf-lib";
const n = PDFName.of;
export function bookmarkBoundaries(doc: PDFDocument, level: number): number[] {
  if (!Number.isInteger(level) || level < 1 || level > 20)
    throw Error("Bookmark level must be 1–20.");
  const lookup = (v: PDFObject | undefined) =>
    v ? doc.context.lookup(v) : undefined;
  const text = (v: PDFObject | undefined) =>
    v instanceof PDFString || v instanceof PDFHexString || v instanceof PDFName
      ? v.decodeText()
      : undefined;
  const named = new Map<string, PDFObject>();
  const legacy = lookup(doc.catalog.get(n("Dests")));
  if (legacy instanceof PDFDict)
    for (const [key, value] of legacy.entries())
      named.set(key.decodeText(), value);
  const names = lookup(doc.catalog.get(n("Names")));
  const tree = names instanceof PDFDict ? names.get(n("Dests")) : undefined;
  const seenNames = new Set<PDFObject>();
  function visitNames(raw: PDFObject | undefined) {
    const d = lookup(raw);
    if (!(d instanceof PDFDict)) return;
    if (seenNames.has(d) || seenNames.size >= 10000)
      throw Error("Malformed or oversized bookmark destination tree.");
    seenNames.add(d);
    const entries = lookup(d.get(n("Names")));
    if (entries instanceof PDFArray)
      for (let i = 0; i + 1 < entries.size(); i += 2) {
        const key = text(lookup(entries.get(i)));
        if (key !== undefined) named.set(key, entries.get(i + 1));
      }
    const kids = lookup(d.get(n("Kids")));
    if (kids instanceof PDFArray)
      for (const kid of kids.asArray()) visitNames(kid);
  }
  visitNames(tree);
  const pages = new Map(doc.getPages().map((p, i) => [p.ref.toString(), i]));
  function destination(raw: PDFObject | undefined): number {
    const seen = new Set<PDFObject>();
    while (raw) {
      if (seen.has(raw) || seen.size > 32) break;
      seen.add(raw);
      const d = lookup(raw);
      if (d instanceof PDFArray) {
        const page = d.get(0);
        // Local explicit destinations must reference an existing page object.
        if (page instanceof PDFRef && pages.has(page.toString()))
          return pages.get(page.toString())!;
        break;
      }
      if (d instanceof PDFDict) {
        raw = d.get(n("D"));
        continue;
      }
      const key = text(d);
      if (key === undefined) break;
      raw = named.get(key);
    }
    throw Error(
      "A selected bookmark has an unresolved or external destination. Choose another level or repair the bookmark.",
    );
  }
  const root = lookup(doc.catalog.get(n("Outlines")));
  if (!(root instanceof PDFDict))
    throw Error("No bookmarks found in this PDF.");
  const seen = new Set<PDFObject>();
  const starts = new Set<number>();
  function walk(raw: PDFObject | undefined, depth: number) {
    while (raw) {
      const d = lookup(raw);
      if (!(d instanceof PDFDict) || seen.has(d) || seen.size >= 10000)
        throw Error("Malformed or oversized bookmark outline.");
      seen.add(d);
      if (depth === level) {
        let dest = d.get(n("Dest"));
        if (!dest) {
          const action = lookup(d.get(n("A")));
          if (
            !(action instanceof PDFDict) ||
            action.get(n("S"))?.toString() !== "/GoTo"
          )
            throw Error(
              "A selected bookmark points outside this PDF or has no page destination.",
            );
          dest = action.get(n("D"));
        }
        starts.add(destination(dest));
      }
      if (depth < level) walk(d.get(n("First")), depth + 1);
      raw = d.get(n("Next"));
    }
  }
  walk(root.get(n("First")), 1);
  if (!starts.size) throw Error("No bookmarks found at the selected level.");
  starts.add(0);
  if (starts.size < 2)
    throw Error(
      "No split boundary after the first page at this bookmark level.",
    );
  return [...starts].sort((a, b) => a - b);
}
