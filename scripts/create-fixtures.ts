import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("tests/fixtures", { recursive: true });
for (const name of ["alpha", "beta"]) {
  const d = await PDFDocument.create();
  const font = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const p = d.addPage([595.28, 841.89]);
    p.drawText(`${name.toUpperCase()} — Page ${i}`, {
      x: 50,
      y: 750,
      size: 28,
      font,
    });
    p.drawText(
      `Invoice ${i}\nPaperly test fixture — synthetic, no personal data.`,
      { x: 50, y: 680, size: 14, font, lineHeight: 24 },
    );
    p.drawRectangle({
      x: 50,
      y: 300,
      width: 250,
      height: 120,
      color: rgb(i / 4, 0.6, 0.4),
    });
  }
  await writeFile(`tests/fixtures/${name}.pdf`, await d.save());
}
await writeFile("tests/fixtures/invalid.pdf", "Not a PDF");
console.log("Synthetic fixtures generated.");
