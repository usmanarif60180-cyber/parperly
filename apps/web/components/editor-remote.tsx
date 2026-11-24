"use client";
import { useEffect, useState } from "react";
import { useApp } from "./context";
import { readImage } from "./editor-signature";
export type Region = {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
};
export type RemoteOperation =
  | { kind: "ocr" }
  | { kind: "replaceText"; rect: Region; text: string }
  | { kind: "replaceImage"; rect: Region; image: string };
export const editorApi = (process.env.NEXT_PUBLIC_EDITOR_API_URL || "").replace(
  /\/$/,
  "",
);
export async function requestRemote(
  pdf: Uint8Array,
  operation: unknown,
  token: string,
) {
  let binary = "";
  for (let i = 0; i < pdf.length; i += 32768)
    binary += String.fromCharCode(...pdf.subarray(i, i + 32768));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 125000);
  try {
    const res = await fetch(editorApi + "/v1/editor", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ pdf: btoa(binary), operation }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw Error(e.message || e.error || `Processing failed (${res.status}).`);
    }
    if (!res.headers.get("content-type")?.includes("application/pdf"))
      throw Error("Processing server did not return a PDF.");
    return new Uint8Array(await res.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}
export function RemoteEditorPanel({
  region,
  onSelect,
  onRun,
  busy,
}: {
  region: Region | null;
  onSelect: (mode: string) => void;
  onRun: (op: RemoteOperation, token: string) => Promise<void>;
  busy: boolean;
}) {
  const { user } = useApp();
  const [cap, setCap] = useState({ contentEditing: false, ocr: false }),
    [status, setStatus] = useState(
      editorApi
        ? "Checking processing service…"
        : "Licensed processing service is not connected.",
    ),
    [text, setText] = useState(""),
    [image, setImage] = useState(""),
    [consent, setConsent] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (region) setText(region.text || "");
  }, [region]);
  useEffect(() => {
    if (!editorApi) return;
    let stopped = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    (async () => {
      try {
        const u = new URL(editorApi);
        if (
          u.protocol !== "https:" &&
          u.hostname !== "127.0.0.1" &&
          u.hostname !== "localhost"
        )
          throw Error("Processing requires HTTPS.");
        const r = await fetch(editorApi + "/v1/editor/capabilities", {
          signal: controller.signal,
        });
        if (!r.ok) throw Error("Processing service unavailable.");
        const c = await r.json();
        if (!stopped) {
          setCap({
            contentEditing: c.contentEditing === true,
            ocr: c.ocr === true,
          });
          setStatus(
            c.contentEditing || c.ocr
              ? "Apryse processing service connected."
              : "The service needs its license/modules configured.",
          );
        }
      } catch {
        if (!stopped)
          setStatus(
            "Processing service unavailable. Local editing remains available.",
          );
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);
  async function run(op: RemoteOperation) {
    setError("");
    try {
      if (!user)
        throw Error(
          "Sign in before using server processing. Download local edits before leaving this page.",
        );
      if (!consent)
        throw Error("Confirm sending this document to the processing server.");
      await onRun(op, await user.getIdToken());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Processing failed.");
    }
  }
  return (
    <details className="pe-remote">
      <summary>Existing content & OCR</summary>
      <p role="status">{status}</p>
      <p className="pe-help">
        Original text and image editing uses a licensed engine; it never uses
        whiteout. The local tools work without it.
      </p>
      {(cap.contentEditing || cap.ocr) && (
        <>
          <p className="pe-help">
            Server operations send the current PDF to Parperly’s configured
            service. Files are processed in memory in an isolated process and
            not saved by this service. Current added objects become PDF content
            after processing; Undo restores the prior editable workspace.
          </p>
          <label className="pe-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I agree to send this PDF to the processing server for this edit.
          </label>
          {!user && <p>Sign in to use licensed server processing.</p>}
          {cap.contentEditing && (
            <>
              <button disabled={busy} onClick={() => onSelect("existing-text")}>
                Select existing text
              </button>
              <p className="pe-help">
                Click a text run on the page. Replacement uses the original
                predominant font and style. Subset fonts, ligatures and complex
                layouts can limit accuracy; overflowing replacement text can be
                clipped. Review the actual PDF after applying.
              </p>
              {region && (
                <>
                  <label>
                    Replacement text
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={busy || !consent || !user || text === region.text}
                    onClick={() =>
                      run({ kind: "replaceText", rect: region, text })
                    }
                  >
                    Apply existing-text edit
                  </button>
                </>
              )}
              <button
                disabled={busy}
                onClick={() => onSelect("existing-image")}
              >
                Select existing image area
              </button>
              <p className="pe-help">
                Drag around an existing image. The engine replaces the image
                that best matches this region; composite/vector artwork may not
                be replaceable.
              </p>
              <label>
                Replacement PNG / JPEG
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={async (e) => {
                    try {
                      if (e.target.files?.[0])
                        setImage((await readImage(e.target.files[0])).data);
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                />
              </label>
              <button
                disabled={busy || !consent || !user || !image || !region}
                onClick={() =>
                  region && run({ kind: "replaceImage", rect: region, image })
                }
              >
                Replace existing image
              </button>
            </>
          )}
          {cap.ocr && (
            <>
              <button
                disabled={busy || !consent || !user}
                onClick={() => run({ kind: "ocr" })}
              >
                Run OCR on PDF
              </button>
              <p className="pe-warning">
                OCR adds searchable text to scans. It does not turn raster
                letters into editable page graphics; editing recognized hidden
                text will not change the visible scanned image.
              </p>
            </>
          )}
        </>
      )}
      {!cap.contentEditing && (
        <p className="pe-help">
          Existing text/image editing: unavailable until the licensed service is
          configured.
        </p>
      )}
      {!cap.ocr && (
        <p className="pe-help">
          OCR: unavailable until its licensed module is configured.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
