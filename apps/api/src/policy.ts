export const serverTools = new Set([
  "merge-pdf",
  "extract-pdf-pages",
  "rotate-pdf",
  "watermark-pdf",
  "repair-pdf",
  "compress-pdf",
]);
export function owns(
  uid: string,
  record: { ownerId?: string; expiresAt?: number } | undefined,
) {
  return Boolean(
    record &&
    record.ownerId === uid &&
    (record.expiresAt === undefined || record.expiresAt > Date.now()),
  );
}
export function downloadAllowed(
  uid: string,
  record: { ownerId?: string; expiresAt?: number; state?: string } | undefined,
) {
  return owns(uid, record) && record?.state === "completed";
}
export function safeSettings(input: Record<string, unknown>) {
  const keys = new Set([
    "pages",
    "angle",
    "text",
    "fontSize",
    "color",
    "opacity",
    "ranges",
    "flatten",
  ]);
  for (const [k, v] of Object.entries(input)) {
    if (
      !keys.has(k) ||
      !["string", "number", "boolean"].includes(typeof v) ||
      String(v).length > 2000
    )
      throw Error("Invalid settings");
  }
  return input;
}
