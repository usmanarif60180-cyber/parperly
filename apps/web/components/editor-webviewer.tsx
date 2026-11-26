"use client";
import { useEffect, useRef, useState } from "react";
import type { WebViewerInstance } from "@pdftron/webviewer";
import { asset } from "./context";
import {
  collectWebViewerPdf,
  webViewerMode,
} from "../../../packages/pdf-editor/webviewer";
const key = process.env.NEXT_PUBLIC_APRYSE_WEBVIEWER_LICENSE_KEY || "";
export const webViewerConfigured =
  process.env.NEXT_PUBLIC_APRYSE_CONTENT_EDIT_ENABLED === "true" &&
  !!key.trim();
export function ExistingTextEditor({
  bytes,
  filename,
  onApply,
  onClose,
}: {
  bytes: Uint8Array;
  filename: string;
  onApply: (bytes: Uint8Array) => Promise<void>;
  onClose: () => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    instance = useRef<WebViewerInstance | null>(null),
    changed = useRef(false);
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Checking editor configuration…");
  const [mode, setMode] = useState("unconfigured");
  useEffect(() => {
    const mode = webViewerMode(
      webViewerConfigured,
      key,
      process.env.NEXT_PUBLIC_APRYSE_LOCAL_TRIAL === "true",
      location.hostname,
    );
    setMode(mode);
    if (mode === "unconfigured") {
      setStatus("Awaiting WebViewer Content Editing license activation.");
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled)
        setError(
          "The content editor took too long to load. Return to your document and try again.",
        );
    }, 90000);
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    (async () => {
      setStatus("Loading the content-editing engine…");
      const { default: WebViewer } = await import("@pdftron/webviewer");
      if (cancelled) return;
      const viewer = await WebViewer(
        {
          path: asset("webviewer"),
          licenseKey: mode === "licensed" ? key : undefined,
          fullAPI: true,
          enableFilePicker: false,
          disabledElements: [
            "downloadButton",
            "saveAsButton",
            "printButton",
            "filePickerButton",
          ],
          preloadWorker: "contentEdit",
        },
        host.current!,
      );
      if (cancelled) {
        await viewer.UI.dispose({ shouldClearConsole: false });
        return;
      }
      instance.current = viewer;
      viewer.Core.disableEmbeddedJavaScript();
      viewer.UI.enableFeatures([viewer.UI.Feature.ContentEdit]);
      await viewer.UI.loadDocument(
        new Blob([bytes.slice().buffer], { type: "application/pdf" }),
        { filename },
      );
      if (cancelled) return;
      await viewer.Core.documentViewer
        .getContentEditManager()
        .startContentEditMode();
      if (cancelled) return;
      clearTimeout(timeout);
      changed.current = false;
      viewer.Core.documentViewer.addEventListener(
        "pagesUpdated",
        (changes: Record<string, unknown>) => {
          if (
            Object.entries(changes)
              .filter(([name]) => name !== "annotationsChanged")
              .some(([, value]) =>
                Array.isArray(value)
                  ? value.length > 0
                  : value &&
                    typeof value === "object" &&
                    Object.keys(value).length > 0,
              )
          )
            changed.current = true;
        },
      );
      viewer.Core.annotationManager.addEventListener(
        "annotationChanged",
        (
          annotations: { isContentEditPlaceholder?: () => boolean }[],
          _action: string,
          info: { imported?: boolean },
        ) => {
          if (
            !info?.imported &&
            annotations.some(
              (annotation) => !annotation.isContentEditPlaceholder?.(),
            )
          )
            changed.current = true;
        },
      );
      setReady(true);
      setError("");
      setStatus(
        "Click existing text to edit. Review font substitutions before applying.",
      );
    })().catch(() => {
      if (!cancelled) {
        clearTimeout(timeout);
        setError(
          "Content editing could not start. Check WebViewer licensing, domain entitlement and self-hosted SDK assets. Your original workspace is unchanged.",
        );
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      window.removeEventListener("beforeunload", warn);
      const v = instance.current;
      instance.current = null;
      if (v) void v.UI.dispose({ shouldClearConsole: false }).catch(() => {});
    };
  }, [bytes, filename]);
  async function apply() {
    if (!instance.current || !ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await collectWebViewerPdf(instance.current);
      if (!changed.current) {
        setStatus(
          "No content changes detected. Edit text or images before applying.",
        );
        await instance.current.Core.documentViewer
          .getContentEditManager()
          .startContentEditMode();
        return;
      }
      await onApply(result);
    } catch {
      setError(
        "The edited PDF could not be saved or validated. Your original workspace has been kept. Review the document and retry.",
      );
    } finally {
      setSaving(false);
    }
  }
  function close() {
    if (saving) return;
    if (
      ready &&
      !window.confirm(
        "Discard this content-editing session and return to your previous workspace?",
      )
    )
      return;
    onClose();
  }
  return (
    <main id="main" className="pe-editor pe-native-editor">
      <header className="pe-heading">
        <div>
          <p className="eyebrow">PARPERLY • EXISTING TEXT</p>
          <h1>Edit existing text & images</h1>
          <p>
            Click a text block, change its letters, and keep the original
            styling where supported.
          </p>
        </div>
        <button onClick={close} disabled={saving}>
          Back to PDF workspace
        </button>
      </header>
      <section className="pe-notice" aria-live="polite">
        <strong>{status}</strong>
        <p>
          Embedded font subsets may not contain new characters. Missing fonts
          can require substitution; scanned lettering needs OCR and is not
          directly editable. Check the saved PDF carefully.
        </p>
        {mode === "local-trial" && (
          <p>
            <strong>
              Local evaluation only. Trial output may carry a watermark; this is
              not a production license.
            </strong>
          </p>
        )}
        {mode === "unconfigured" && (
          <p>
            The browser editor is integrated but not active. The site owner must
            configure an Apryse WebViewer license with Content Editing for
            parperly.com. The existing local tools remain available. No server
            purchase is required for this browser editor.
          </p>
        )}
      </section>
      {error && (
        <p className="pe-error" role="alert">
          {error}
        </p>
      )}
      {mode !== "unconfigured" && (
        <>
          <div className="pe-document-bar">
            <strong>{filename}</strong>
            <button
              className="primary"
              disabled={!ready || saving}
              onClick={apply}
            >
              {saving ? "Saving PDF…" : "Apply & return to workspace"}
            </button>
          </div>
        </>
      )}
      <div
        ref={host}
        hidden={mode === "unconfigured"}
        inert={saving}
        className="pe-native-host"
        aria-label="Existing PDF content editor"
      />
      <p className="pe-help">
        Processing uses the browser SDK. Apply returns a validated PDF to
        Parperly; Download remains available in the normal workspace. Undo there
        restores the previous document.
      </p>
    </main>
  );
}
