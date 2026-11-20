"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, MoveUp, Play, Download } from "lucide-react";
import { useApp } from "./context";
import { SettingsForm, defaults } from "./settings";
import { runWorker, saveDownload } from "./pdf-client";
import {
  type Settings,
  type InputFile,
  type Output,
  limits,
} from "../../../packages/pdf-core";
import tools from "../../../packages/tool-registry/tools.json";
import { zip } from "fflate";
const allowed = [
  "rotate-pdf",
  "watermark-pdf",
  "add-page-numbers",
  "header-footer",
  "bates-numbering",
  "crop-pdf",
  "resize-pdf",
  "flip-pdf",
  "edit-pdf-metadata",
  "flatten-pdf",
  "remove-annotations",
];
type Step = { id: string; tool: string; settings: Settings };
export function WorkflowBuilder() {
  const { t, user } = useApp();
  const [steps, setSteps] = useState<Step[]>([
      { id: "initial", tool: "rotate-pdf", settings: defaults("rotate-pdf") },
    ]),
    [files, setFiles] = useState<File[]>([]),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [outputs, setOutputs] = useState<Output[]>([]),
    [error, setError] = useState(""),
    [presets, setPresets] = useState<{ name: string; steps: Step[] }[]>([]),
    [name, setName] = useState("My workflow");
  const controller = useRef<AbortController | null>(null),
    summary = useRef<object[]>([]);
  const key = "paperly-workflows-" + (user?.uid || "guest");
  useEffect(() => {
    try {
      setPresets(JSON.parse(localStorage.getItem(key) || "[]"));
    } catch {
      setPresets([]);
    }
  }, [key]);
  useEffect(() => () => controller.current?.abort(), []);
  function save() {
    try {
      const next = [
        ...presets.filter((p) => p.name !== name),
        { name: name.trim() || "My workflow", steps },
      ].slice(-20);
      localStorage.setItem(key, JSON.stringify(next));
      setPresets(next);
      setStatus("Workflow saved on this browser. No documents were saved.");
    } catch {
      setError("Browser storage is unavailable.");
    }
  }
  async function run() {
    if (!files.length) {
      setError("Choose at least one PDF.");
      return;
    }
    if (!steps.length || steps.some((s) => !allowed.includes(s.tool)))
      return setError("Choose supported PDF-to-PDF steps.");
    if (files.reduce((n, f) => n + f.size, 0) > limits.bytes)
      return setError("Total file limit is 40 MB.");
    const c = new AbortController();
    controller.current = c;
    setBusy(true);
    setError("");
    setOutputs([]);
    summary.current = [];
    const completed: Output[] = [];
    try {
      for (let f = 0; f < files.length; f++) {
        let input: InputFile = {
          name: files[f].name,
          bytes: new Uint8Array(await files[f].arrayBuffer()),
        };
        for (let i = 0; i < steps.length; i++) {
          if (c.signal.aborted) throw Error("Cancelled");
          const step = steps[i];
          const result = await runWorker(
            step.tool,
            [input],
            step.settings,
            (s) =>
              setStatus(
                `Document ${f + 1}/${files.length} · Step ${i + 1}/${steps.length}: ${s}`,
              ),
            c.signal,
          );
          if (result.length !== 1 || result[0].type !== "application/pdf")
            throw Error("Step output is incompatible with the next PDF step.");
          input = { name: result[0].name, bytes: result[0].bytes };
          summary.current.push({
            document: f + 1,
            step: i + 1,
            tool: step.tool,
            status: "completed",
            pages: result[0].pages,
          });
        }
        completed.push({
          ...input,
          name: `workflow-${f + 1}.pdf`,
          type: "application/pdf",
        });
      }
      setOutputs(completed);
      setStatus("All steps completed. Final PDFs are ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Workflow failed.");
      summary.current.push({
        status: c.signal.aborted ? "cancelled" : "failed",
      });
      setStatus("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="tool-page">
      <span className="eyebrow">REPEAT LESS. DO MORE.</span>
      <h1>{t.workflow}</h1>
      <p className="lead">
        Chain available PDF-to-PDF tools. Each document follows the same steps.
        Presets stay on this browser; files stay in memory.
      </p>
      <div className="workflow-layout">
        <div>
          <label className="drop-zone">
            <Plus size={28} />
            <b>{t.upload}</b>
            <input
              disabled={busy}
              type="file"
              multiple
              accept=".pdf"
              onChange={(e) => {
                setFiles(Array.from(e.target.files || []));
                setOutputs([]);
              }}
            />
            <span>{files.length} PDF files selected · 40 MB total</span>
          </label>
          {steps.map((s, i) => (
            <article className="workflow-step" key={s.id}>
              <div className="step-title">
                <b>Step {i + 1}</b>
                <select
                  aria-label={`Tool for step ${i + 1}`}
                  disabled={busy}
                  value={s.tool}
                  onChange={(e) => {
                    setSteps(
                      steps.map((x, n) =>
                        n === i
                          ? {
                              ...x,
                              tool: e.target.value,
                              settings: defaults(e.target.value),
                            }
                          : x,
                      ),
                    );
                    setOutputs([]);
                  }}
                >
                  {allowed.map((id) => (
                    <option key={id} value={id}>
                      {tools.find((t) => t.id === id)?.name}
                    </option>
                  ))}
                </select>
                {i > 0 && (
                  <button
                    className="icon-btn"
                    disabled={busy}
                    aria-label="Move step up"
                    onClick={() => {
                      const a = [...steps];
                      [a[i - 1], a[i]] = [a[i], a[i - 1]];
                      setSteps(a);
                      setOutputs([]);
                    }}
                  >
                    <MoveUp size={17} />
                  </button>
                )}
                <button
                  className="icon-btn"
                  aria-label="Remove step"
                  disabled={busy || steps.length === 1}
                  onClick={() => {
                    setSteps(steps.filter((_, n) => n !== i));
                    setOutputs([]);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <SettingsForm
                tool={s.tool}
                settings={s.settings}
                disabled={busy}
                onChange={(settings) => {
                  setSteps(
                    steps.map((x, n) => (n === i ? { ...x, settings } : x)),
                  );
                  setOutputs([]);
                }}
              />
            </article>
          ))}
          <button
            className="btn"
            disabled={busy || steps.length >= 8}
            onClick={() =>
              setSteps([
                ...steps,
                {
                  id: crypto.randomUUID(),
                  tool: "watermark-pdf",
                  settings: defaults("watermark-pdf"),
                },
              ])
            }
          >
            <Plus size={17} />
            {t.addStep}
          </button>
        </div>
        <aside className="settings-panel">
          <h2>Run & save</h2>
          <button
            className="btn primary full"
            disabled={busy || !files.length}
            onClick={run}
          >
            <Play size={17} />
            {t.runWorkflow}
          </button>
          {busy && (
            <button
              className="btn full"
              onClick={() => controller.current?.abort()}
            >
              {t.cancel}
            </button>
          )}
          <label className="field">
            Preset name
            <input
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="btn full" onClick={save} disabled={busy}>
            {t.save} preset
          </button>
          <h3>Saved on this device</h3>
          {presets.map((p, i) => (
            <div key={i} className="preset">
              <button
                className="text-btn"
                disabled={busy}
                onClick={() => {
                  setSteps(
                    p.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
                  );
                  setName(p.name);
                  setOutputs([]);
                }}
              >
                {p.name}
              </button>
              <button
                className="icon-btn"
                aria-label={`Delete ${p.name}`}
                onClick={() => {
                  const next = presets.filter((_, n) => n !== i);
                  setPresets(next);
                  localStorage.setItem(key, JSON.stringify(next));
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </aside>
      </div>
      <div role="status" className="status-line">
        {status}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {outputs.length > 0 && (
        <section className="results">
          <h2>{t.ready}</h2>
          {outputs.map((o) => (
            <button
              className="btn"
              key={o.name}
              onClick={() => saveDownload(o)}
            >
              <Download size={16} />
              {o.name}
            </button>
          ))}
          <button
            className="btn"
            onClick={() =>
              zip(
                Object.fromEntries(outputs.map((o) => [o.name, o.bytes])),
                { level: 0 },
                (e, b) => {
                  if (e) setError("ZIP generation failed.");
                  else
                    saveDownload({
                      name: "workflow.zip",
                      bytes: b,
                      type: "application/zip",
                    });
                },
              )
            }
          >
            {t.downloadAll}
          </button>
          <button
            className="btn"
            onClick={() =>
              saveDownload({
                name: "processing-summary.json",
                type: "application/json",
                bytes: new TextEncoder().encode(
                  JSON.stringify(summary.current, null, 2),
                ),
              })
            }
          >
            Processing summary
          </button>
        </section>
      )}
    </section>
  );
}
