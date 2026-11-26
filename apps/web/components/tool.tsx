"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  UploadCloud,
  Trash2,
  MoveUp,
  MoveDown,
  CheckCircle2,
  Download,
  LoaderCircle,
  ShieldCheck,
  FileText,
} from "lucide-react";
import tools from "../../../packages/tool-registry/tools.json";
import {
  limits,
  type InputFile,
  type Output,
  type Settings,
} from "../../../packages/pdf-core";
import { useApp } from "./context";
import { ToolIcon } from "./directory";
import { SettingsForm, defaults } from "./settings";
import { Viewer, type Edit } from "./viewer";
import {
  runWorker,
  rasterProcess,
  textPages,
  saveDownload,
} from "./pdf-client";
import { zip } from "fflate";
export type ToolInfo = (typeof tools)[number];
type Item = InputFile & { id: string; pages?: number };
export function Tool({ tool }: { tool: ToolInfo }) {
  const { t, lang, user } = useApp();
  const [files, setFiles] = useState<Item[]>([]),
    [settings, setSettings] = useState<Settings>(defaults(tool.id)),
    [error, setError] = useState(""),
    [stage, setStage] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false),
    [outputs, setOutputs] = useState<Output[]>([]),
    [preview, setPreview] = useState(0),
    [edits, setEdits] = useState<Edit[]>([]),
    [formFields, setFormFields] = useState<
      { name: string; type: string; value: string | boolean }[]
    >([]),
    [fieldValues, setFieldValues] = useState<Record<string, string | boolean>>(
      {},
    );
  const controller = useRef<AbortController | null>(null),
    version = useRef(0),
    picker = useRef<HTMLInputElement>(null);
  const editable = ["pdf-editor", "fill-sign"].includes(tool.id);
  const multiple = [
    "merge-pdf",
    "alternate-mix-pdf",
    "images-to-pdf",
    "rename-pdf",
  ].includes(tool.id);
  useEffect(
    () => () => {
      version.current++;
      controller.current?.abort();
    },
    [],
  );
  function invalidate() {
    setOutputs([]);
    setError("");
  }
  async function add(incoming: FileList | File[] | null) {
    if (!incoming || busy || loading) return;
    const batch = Array.from(incoming);
    if (!multiple && batch.length > 1) {
      setError("This tool accepts one document at a time.");
      return;
    }
    const initial = multiple ? files : [];
    if (
      [...batch, ...initial.map((f) => ({ size: f.bytes.length }))].reduce(
        (n, f) => n + f.size,
        0,
      ) > limits.bytes
    ) {
      setError("Choose files totaling 40 MB or less.");
      return;
    }
    setLoading(true);
    setError("");
    const v = ++version.current;
    try {
      const { PDFDocument } = await import("pdf-lib");
      let total = initial.reduce((n, f) => n + (f.pages || 1), 0);
      const added: Item[] = [];
      for (const f of batch) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (!bytes.length) throw Error(`${f.name} is empty.`);
        let count;
        if (tool.id === "images-to-pdf") {
          if (!(
            (bytes[0] === 137 &&
              bytes[1] === 80 &&
              bytes[2] === 78 &&
              bytes[3] === 71) ||
            (bytes[0] === 255 && bytes[1] === 216)
          ))
            throw Error("Choose PNG or JPEG images.");
          count = 1;
        } else {
          if (!new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-"))
            throw Error("Choose a file with a valid PDF signature.");
          const d = await PDFDocument.load(bytes);
          count = d.getPageCount();
          if (count < 1) throw Error("The PDF has no pages.");
          if (editable) {
            const fields = d
              .getForm()
              .getFields()
              .map((field: any) => ({
                name: field.getName(),
                type:
                  typeof field.isChecked === "function"
                    ? "checkbox"
                    : typeof field.getText === "function"
                      ? "text"
                      : "unsupported",
                value:
                  typeof field.isChecked === "function"
                    ? field.isChecked()
                    : typeof field.getText === "function"
                      ? field.getText() || ""
                      : "",
              }));
            setFormFields(fields);
            setFieldValues(
              Object.fromEntries(
                fields
                  .filter((f) => f.type !== "unsupported")
                  .map((f) => [f.name, f.value]),
              ),
            );
          }
        }
        total += count;
        if (total > limits.pages)
          throw Error("Select no more than 300 pages in total.");
        added.push({
          id: crypto.randomUUID(),
          name: f.name,
          bytes,
          pages: count,
        });
      }
      if (v !== version.current) return;
      setFiles([...initial, ...added]);
      setPreview(0);
      setEdits([]);
      setOutputs([]);
    } catch (e) {
      if (v === version.current)
        setError(
          /encrypt/i.test(String(e))
            ? "Encrypted PDF: use an unlocked copy."
            : e instanceof Error
              ? e.message
              : "The file could not be opened.",
        );
    } finally {
      if (v === version.current) setLoading(false);
      if (picker.current) picker.current.value = "";
    }
  }
  function move(i: number, d: number) {
    const copy = [...files];
    [copy[i], copy[i + d]] = [copy[i + d], copy[i]];
    setFiles(copy);
    invalidate();
  }
  async function run() {
    if (busy || loading) return;
    if (!files.length) {
      setError("Choose your document first.");
      return;
    }
    setBusy(true);
    setError("");
    setOutputs([]);
    setStage("Preparing documents");
    const c = new AbortController();
    controller.current = c;
    const v = ++version.current;
    try {
      let s = { ...settings };
      if (editable) {
        s.edits = JSON.stringify(edits);
        s.fieldValues = JSON.stringify(fieldValues);
      }
      if (tool.id === "split-by-text") {
        const pattern = String(s.pattern || "");
        if (!pattern) throw Error("Enter text marking a new document.");
        const text = await textPages(files[0].bytes);
        if (c.signal.aborted) throw Error("Cancelled");
        if (!text.some((x) => x.trim()))
          throw Error("No embedded text found. This document needs OCR.");
        const starts = text
          .map((x, i) => (i > 0 && x.includes(pattern) ? i : -1))
          .filter((i) => i >= 0);
        if (!starts.length)
          throw Error(
            "No matching split boundary was found after the first page.",
          );
        s.boundaries = starts.join(",");
      }
      const result = ["pdf-to-images", "pdf-to-text", "grayscale-pdf"].includes(
        tool.id,
      )
        ? await rasterProcess(tool.id, files[0], s, setStage, c.signal)
        : await runWorker(tool.id, files, s, setStage, c.signal);
      if (c.signal.aborted || v !== version.current) return;
      if (!result.length) throw Error("The engine did not generate an output.");
      setOutputs(result);
      setStage("Completed");
      try {
        const key = "paperly-history-" + (user?.uid || "guest");
        const old = JSON.parse(localStorage.getItem(key) || "[]");
        localStorage.setItem(
          key,
          JSON.stringify(
            [
              {
                id: crypto.randomUUID(),
                tool: tool.name,
                at: new Date().toISOString(),
                files: result.length,
                pages: result.reduce((n, f) => n + (f.pages || 0), 0),
              },
              ...old,
            ].slice(0, 50),
          ),
        );
      } catch {}
    } catch (e) {
      if (v === version.current) {
        setError(
          c.signal.aborted
            ? "Cancelled. No output was published."
            : e instanceof Error
              ? e.message
              : "Processing failed.",
        );
        setStage("");
      }
    } finally {
      if (v === version.current) setBusy(false);
    }
  }
  function reset() {
    version.current++;
    controller.current?.abort();
    setBusy(false);
    setLoading(false);
    setFiles([]);
    setOutputs([]);
    setEdits([]);
    setFieldValues({});
    setFormFields([]);
    setError("");
    setStage("");
  }
  function zipAll() {
    setError("");
    zip(
      Object.fromEntries(
        outputs.map((o, i) => [
          `${String(i + 1).padStart(3, "0")}-${o.name}`,
          o.bytes,
        ]),
      ),
      { level: 0 },
      (err, bytes) => {
        if (err)
          setError("ZIP creation failed. Download the files separately.");
        else
          saveDownload({
            name: "parperly-outputs.zip",
            bytes,
            type: "application/zip",
          });
      },
    );
  }
  const warning =
    (
      {
        "crop-pdf":
          "Cropping hides content outside the crop box. It does not securely remove it.",
        "grayscale-pdf":
          "This mode rasterizes selected pages: searchable text, forms, links and vector content are replaced by page images. Only selected pages are included.",
        "flatten-pdf":
          "Flattens supported AcroForm fields. Other annotations and XFA forms are not flattened.",
        "remove-annotations":
          "Removes page annotations except form widgets. Existing signatures may be invalidated.",
        "pdf-editor":
          "Additive editing only. Existing text replacement, secure redaction and certificate signing are not supported.",
        "fill-sign":
          "Fill supported text/checkbox AcroForm fields or place a visual signature. Not certificate signing.",
        "merge-pdf":
          "Page content is copied. Bookmarks, attachments, links and form interactivity may not be preserved; flatten forms if needed.",
        "edit-pdf-metadata":
          "Updates supported Info metadata and removes the old XMP stream to avoid conflicting metadata.",
      } as Record<string, string>
    )[tool.id] ||
    "Review your output before sharing. PDF rewrites can invalidate existing digital signatures and may not preserve advanced interactive structures.";
  return (
    <div className="tool-page">
      <Link href="/tools/" className="back-link">
        {t.back}
      </Link>
      <div className="tool-heading">
        <span className="tool-icon">
          <ToolIcon category={tool.category} />
        </span>
        <div>
          <span className="eyebrow">
            {tool.available ? t.local : t.planned}
          </span>
          <h1>{lang === "fr" ? tool.fr : tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>
      {!tool.available ? (
        <div className="unavailable">
          <ShieldCheck size={32} />
          <h2>{t.unavailable}</h2>
          <p>{tool.reason}</p>
          <p>
            No file is accepted for this tool. No simulated processing or output
            is provided.
          </p>
          <Link href="/tools/" className="btn primary">
            {t.browse}
          </Link>
        </div>
      ) : (
        <>
          <div className="notice">{warning}</div>
          <div className="workspace">
            <section className="document-area">
              <div
                className={"drop-zone " + (loading ? "loading" : "")}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  add(e.dataTransfer.files);
                }}
              >
                <UploadCloud size={32} />
                <h2>{loading ? "Reading and validating files…" : t.upload}</h2>
                <p>{t.limits}</p>
                <label className="btn primary">
                  {tool.id === "images-to-pdf"
                    ? "Choose images"
                    : "Choose PDFs"}
                  <input
                    ref={picker}
                    type="file"
                    accept={
                      tool.id === "images-to-pdf"
                        ? ".jpg,.jpeg,.png"
                        : ".pdf,application/pdf"
                    }
                    multiple={multiple}
                    disabled={busy || loading}
                    onChange={(e) => add(e.target.files)}
                    className="file-input"
                  />
                </label>
              </div>
              {files.length > 0 && (
                <div className="file-list">
                  <div className="list-head">
                    <h3>
                      {t.selected} ({files.length})
                    </h3>
                    {multiple && (
                      <button
                        disabled={busy}
                        className="text-btn"
                        onClick={() => {
                          setFiles(
                            [...files].sort((a, b) =>
                              a.name.localeCompare(b.name),
                            ),
                          );
                          invalidate();
                        }}
                      >
                        Sort A–Z
                      </button>
                    )}
                  </div>
                  {files.map((f, i) => (
                    <div
                      className={
                        "file-row " + (i === preview ? "selected" : "")
                      }
                      key={f.id}
                    >
                      <button
                        className="file-name"
                        disabled={busy}
                        onClick={() => setPreview(i)}
                      >
                        <FileText size={18} />
                        <span>
                          {f.name}
                          <small>
                            {(f.bytes.length / 1024).toFixed(1)} KB · {f.pages}{" "}
                            pages
                          </small>
                        </span>
                      </button>
                      <div className="flex">
                        {i > 0 && (
                          <button
                            className="icon-btn"
                            disabled={busy}
                            aria-label={`Move ${f.name} up`}
                            onClick={() => move(i, -1)}
                          >
                            <MoveUp size={15} />
                          </button>
                        )}
                        {i < files.length - 1 && (
                          <button
                            className="icon-btn"
                            disabled={busy}
                            aria-label={`Move ${f.name} down`}
                            onClick={() => move(i, 1)}
                          >
                            <MoveDown size={15} />
                          </button>
                        )}
                        <button
                          className="icon-btn"
                          disabled={busy}
                          aria-label={`Remove ${f.name}`}
                          onClick={() => {
                            setFiles(files.filter((_, n) => n !== i));
                            setPreview(0);
                            invalidate();
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {files[preview] && tool.id !== "images-to-pdf" && (
                <div className={busy ? "interaction-disabled" : ""}>
                  <Viewer
                    bytes={files[preview].bytes}
                    editable={editable}
                    edits={edits}
                    onEdits={(e) => {
                      setEdits(e);
                      invalidate();
                    }}
                  />
                </div>
              )}
            </section>
            <aside className="settings-panel">
              <h2>{t.settings}</h2>
              <SettingsForm
                tool={tool.id}
                settings={settings}
                onChange={(s) => {
                  setSettings(s);
                  invalidate();
                }}
                disabled={busy}
              />
              {editable && formFields.length > 0 && (
                <fieldset disabled={busy} className="settings-form">
                  <h3>Existing form fields</h3>
                  {formFields.map((f) => (
                    <label className="field" key={f.name}>
                      <span>{f.name}</span>
                      {f.type === "text" ? (
                        <input
                          value={String(fieldValues[f.name] || "")}
                          onChange={(e) => {
                            setFieldValues({
                              ...fieldValues,
                              [f.name]: e.target.value,
                            });
                            invalidate();
                          }}
                        />
                      ) : f.type === "checkbox" ? (
                        <input
                          type="checkbox"
                          checked={Boolean(fieldValues[f.name])}
                          onChange={(e) => {
                            setFieldValues({
                              ...fieldValues,
                              [f.name]: e.target.checked,
                            });
                            invalidate();
                          }}
                        />
                      ) : (
                        <small>
                          This field type is not editable in this release.
                        </small>
                      )}
                    </label>
                  ))}
                </fieldset>
              )}
              <button
                className="btn primary full"
                disabled={busy || loading || !files.length}
                onClick={run}
              >
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Download size={18} />
                )}{" "}
                {busy ? t.working : t.process}
              </button>
              {busy && (
                <button
                  className="btn full"
                  onClick={() => controller.current?.abort()}
                >
                  {t.cancel}
                </button>
              )}
              <button
                className="text-btn full"
                disabled={!files.length && !error}
                onClick={reset}
              >
                {t.restart}
              </button>
              <p className="privacy-caption">
                <ShieldCheck size={15} />
                {t.privacy}
              </p>
            </aside>
          </div>
          <div aria-live="polite">
            {busy && (
              <div className="progress-state">
                <LoaderCircle className="spin" size={18} />
                {stage}
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}
                {files.length > 0 && !busy && (
                  <button className="btn" onClick={run}>
                    {t.retry}
                  </button>
                )}
              </div>
            )}
            {outputs.length > 0 && (
              <section className="results">
                <div className="result-heading">
                  <CheckCircle2 size={25} />
                  <div>
                    <h2>{t.ready}</h2>
                    <p>
                      {outputs.length} output file
                      {outputs.length > 1 ? "s" : ""}. Generated from your
                      document.
                    </p>
                  </div>
                  {outputs.length > 1 && (
                    <button className="btn primary" onClick={zipAll}>
                      {t.downloadAll}
                    </button>
                  )}
                </div>
                {outputs.map((o, i) => (
                  <div className="output-row" key={i}>
                    <span>
                      {o.name}
                      <small>
                        {(o.bytes.length / 1024).toFixed(1)} KB
                        {o.pages ? ` · ${o.pages} pages` : ""}
                      </small>
                    </span>
                    <button className="btn" onClick={() => saveDownload(o)}>
                      <Download size={16} />
                      {t.download}
                    </button>
                  </div>
                ))}
              </section>
            )}
          </div>
        </>
      )}
      <section className="tool-help">
        <h2>How to use {tool.name}</h2>
        <ol>
          <li>
            Choose supported input files. Review the limits and tool notes.
          </li>
          <li>Adjust the settings and preview the document where available.</li>
          <li>Create the output, review it, and download a new copy.</li>
        </ol>
        <h3>{t.related}</h3>
        <div className="related-links">
          {tools
            .filter((x) => x.category === tool.category && x.id !== tool.id)
            .slice(0, 4)
            .map((x) => (
              <Link className="btn" href={`/tools/${x.id}/`} key={x.id}>
                {lang === "fr" ? x.fr : x.name}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
