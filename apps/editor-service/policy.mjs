import { z } from "zod";
const rect = z
  .tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
  ])
  .refine(
    ([x1, y1, x2, y2]) =>
      x2 > x1 && y2 > y1 && [x1, y1, x2, y2].every((v) => Math.abs(v) < 100000),
    "Invalid PDF rectangle",
  );
export const operationSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("replaceText"),
      page: z.number().int().min(1).max(300),
      rect,
      text: z.string().max(2000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("replaceImage"),
      page: z.number().int().min(1).max(300),
      rect,
      image: z
        .string()
        .max(11000000)
        .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/),
    })
    .strict(),
  z.object({ kind: z.literal("ocr") }).strict(),
]);
export const requestSchema = z
  .object({
    pdf: z
      .string()
      .min(20)
      .max(56000000)
      .regex(/^[A-Za-z0-9+/]+=*$/),
    operation: operationSchema,
  })
  .strict();
export function validatePdf(data) {
  const bytes = Buffer.from(data, "base64");
  if (
    bytes.length > 40 * 1024 * 1024 ||
    !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))
  )
    throw Error("INVALID_PDF");
  return bytes;
}
