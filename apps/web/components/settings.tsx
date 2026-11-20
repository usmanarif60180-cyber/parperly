"use client";
import type { Settings } from "../../../packages/pdf-core";
type Field = {
  key: string;
  label: string;
  type?: string;
  value?: string | number | boolean;
  options?: string[];
  note?: string;
  min?: number;
  max?: number;
};
const pages: Field = {
  key: "pages",
  label: "Pages",
  value: "all",
  note: "Use all, odd, even, 1,3-5. Order and duplicates are preserved.",
};
const margin: Field = {
  key: "margin",
  label: "Margin (PDF points)",
  type: "number",
  value: 24,
  min: 0,
  max: 1000,
};
const text: Field = { key: "text", label: "Text", value: "CONFIDENTIAL" };
const font: Field = {
  key: "fontSize",
  label: "Font size",
  type: "number",
  value: 14,
  min: 6,
  max: 150,
};
const color: Field = {
  key: "color",
  label: "Color",
  type: "color",
  value: "#166534",
};
export const fields: Record<string, Field[]> = {
  "merge-pdf": [
    {
      key: "ranges",
      label: "Page ranges per file",
      note: "Separate each file’s selection with ; e.g. 1-3;all. Empty means all pages.",
    },
    {
      key: "flatten",
      label: "Flatten form fields before merging",
      type: "checkbox",
      value: false,
    },
  ],
  "alternate-mix-pdf": [
    {
      key: "group",
      label: "Pages per group",
      type: "number",
      value: 1,
      min: 1,
      max: 100,
    },
    { key: "reverse", label: "Reverse each input document", type: "checkbox" },
  ],
  "organize-pdf": [pages],
  "delete-pdf-pages": [{ ...pages, label: "Pages to delete", value: "1" }],
  "extract-pdf-pages": [
    pages,
    { key: "separate", label: "One PDF per selected page", type: "checkbox" },
  ],
  "split-by-pages": [
    pages,
    {
      key: "every",
      label: "Pages per output file",
      type: "number",
      value: 1,
      min: 1,
      max: 300,
    },
  ],
  "split-in-half": [
    pages,
    {
      key: "direction",
      label: "Split direction",
      type: "select",
      options: ["vertical", "horizontal"],
      value: "vertical",
    },
  ],
  "split-by-file-size": [
    pages,
    {
      key: "sizeMB",
      label: "Maximum part size (MB)",
      type: "number",
      value: 5,
      min: 0.01,
      max: 40,
    },
  ],
  "split-by-text": [
    {
      key: "pattern",
      label: "Text marking the start of a new document",
      value: "Invoice",
      note: "Literal, case-sensitive text. A matching page starts a new part. Scans need OCR first.",
    },
  ],
  "rotate-pdf": [
    pages,
    {
      key: "angle",
      label: "Clockwise rotation",
      type: "select",
      options: ["90", "180", "270"],
      value: "90",
    },
  ],
  "flip-pdf": [
    pages,
    {
      key: "direction",
      label: "Mirror direction",
      type: "select",
      options: ["horizontal", "vertical"],
      value: "horizontal",
    },
  ],
  "crop-pdf": [pages, margin],
  "resize-pdf": [
    pages,
    {
      key: "width",
      label: "Page width (points)",
      type: "number",
      value: 595.28,
      min: 72,
      max: 3000,
    },
    {
      key: "height",
      label: "Page height (points)",
      type: "number",
      value: 841.89,
      min: 72,
      max: 3000,
    },
    margin,
  ],
  "n-up-pdf": [
    pages,
    {
      key: "columns",
      label: "Columns",
      type: "number",
      value: 2,
      min: 1,
      max: 4,
    },
    { key: "rows", label: "Rows", type: "number", value: 2, min: 1, max: 4 },
    margin,
  ],
  "watermark-pdf": [
    pages,
    text,
    { ...font, value: 40 },
    color,
    {
      key: "opacity",
      label: "Opacity (0.05 to 1)",
      type: "number",
      value: 0.25,
      min: 0.05,
      max: 1,
    },
    {
      key: "angle",
      label: "Angle (degrees)",
      type: "number",
      value: 0,
      min: -180,
      max: 180,
    },
  ],
  "add-page-numbers": [
    pages,
    {
      key: "start",
      label: "First page number",
      type: "number",
      value: 1,
      min: 0,
      max: 999999,
    },
    font,
    color,
    {
      key: "position",
      label: "Position",
      type: "select",
      value: "bottom",
      options: ["bottom", "top"],
    },
  ],
  "header-footer": [
    pages,
    {
      ...text,
      value: "Page {page} of {total}",
      note: "Supports {page} and {total}.",
    },
    font,
    color,
    {
      key: "position",
      label: "Position",
      type: "select",
      value: "bottom",
      options: ["bottom", "top"],
    },
  ],
  "bates-numbering": [
    pages,
    { key: "prefix", label: "Prefix", value: "DOC-" },
    { key: "suffix", label: "Suffix", value: "" },
    {
      key: "start",
      label: "Starting number",
      type: "number",
      value: 1,
      min: 0,
      max: 999999,
    },
    {
      key: "digits",
      label: "Minimum digits",
      type: "number",
      value: 6,
      min: 1,
      max: 12,
    },
    font,
    color,
  ],
  "create-bookmarks": [
    {
      key: "bookmarks",
      label: "Bookmarks",
      type: "textarea",
      value: "Introduction|1",
      note: "One Title|page per line. Creates a flat outline and replaces any existing outline.",
    },
  ],
  "edit-pdf-metadata": [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "subject", label: "Subject" },
    { key: "keywords", label: "Keywords (comma separated)" },
  ],
  "rename-pdf": [{ key: "filename", label: "New filename", value: "document" }],
  "remove-annotations": [pages],
  "flatten-pdf": [],
  "images-to-pdf": [
    {
      key: "size",
      label: "Page size",
      type: "select",
      value: "A4",
      options: ["A4", "original"],
    },
    {
      key: "orientation",
      label: "Orientation",
      type: "select",
      value: "portrait",
      options: ["portrait", "landscape"],
    },
    margin,
  ],
  "pdf-to-images": [
    pages,
    {
      key: "format",
      label: "Image format",
      type: "select",
      value: "png",
      options: ["png", "jpeg"],
    },
    {
      key: "dpi",
      label: "Resolution (DPI)",
      type: "select",
      value: "144",
      options: ["72", "144", "216"],
    },
    {
      key: "quality",
      label: "JPEG quality (0.1 to 1)",
      type: "number",
      value: 0.9,
      min: 0.1,
      max: 1,
    },
  ],
  "pdf-to-text": [pages],
  "grayscale-pdf": [
    pages,
    {
      key: "dpi",
      label: "Resolution (DPI)",
      type: "select",
      value: "144",
      options: ["72", "144", "216"],
    },
  ],
  "create-pdf-forms": [
    {
      key: "page",
      label: "Page number",
      type: "number",
      value: 1,
      min: 1,
      max: 300,
    },
    {
      key: "fieldType",
      label: "Field type",
      type: "select",
      value: "text",
      options: ["text", "checkbox", "dropdown"],
    },
    { key: "fieldName", label: "Unique field name", value: "name" },
    { key: "defaultValue", label: "Default text", value: "" },
    { key: "options", label: "Dropdown options", value: "Option 1,Option 2" },
    {
      key: "x",
      label: "X position (points from left)",
      type: "number",
      value: 50,
      min: 0,
      max: 3000,
    },
    {
      key: "y",
      label: "Y position (points from bottom)",
      type: "number",
      value: 50,
      min: 0,
      max: 3000,
    },
    {
      key: "width",
      label: "Width (points)",
      type: "number",
      value: 200,
      min: 15,
      max: 500,
    },
    { key: "required", label: "Required field", type: "checkbox" },
  ],
};
export function defaults(tool: string): Settings {
  return Object.fromEntries(
    (fields[tool] || []).map((f) => [
      f.key,
      f.value ?? (f.type === "checkbox" ? false : ""),
    ]),
  );
}
export function SettingsForm({
  tool,
  settings,
  onChange,
  disabled = false,
}: {
  tool: string;
  settings: Settings;
  onChange: (v: Settings) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="settings-form">
      {(fields[tool] || []).map((f) => (
        <label
          className={f.type === "checkbox" ? "check-label" : "field"}
          key={f.key}
        >
          <span>{f.label}</span>
          {f.type === "select" ? (
            <select
              value={String(settings[f.key] ?? f.value ?? "")}
              onChange={(e) =>
                onChange({ ...settings, [f.key]: e.target.value })
              }
            >
              {f.options?.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : f.type === "textarea" ? (
            <textarea
              rows={4}
              value={String(settings[f.key] ?? f.value ?? "")}
              onChange={(e) =>
                onChange({ ...settings, [f.key]: e.target.value })
              }
            />
          ) : f.type === "checkbox" ? (
            <input
              type="checkbox"
              checked={Boolean(settings[f.key])}
              onChange={(e) =>
                onChange({ ...settings, [f.key]: e.target.checked })
              }
            />
          ) : (
            <input
              type={f.type || "text"}
              min={f.min}
              max={f.max}
              step="any"
              maxLength={500}
              value={String(settings[f.key] ?? f.value ?? "")}
              onChange={(e) =>
                onChange({ ...settings, [f.key]: e.target.value })
              }
            />
          )}{" "}
          {f.note && <small>{f.note}</small>}
        </label>
      ))}
    </fieldset>
  );
}
