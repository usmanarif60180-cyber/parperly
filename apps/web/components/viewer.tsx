"use client";
import { useEffect, useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  Trash2,
  PenLine,
  Type,
  Highlighter,
  Square,
  ImagePlus,
  MousePointer2,
} from "lucide-react";
import { openPdf } from "./pdf-client";
export type Edit = {
  id: string;
  page: number;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  size: number;
  color: string;
  data?: string;
};
export function Viewer({
  bytes,
  editable = false,
  edits = [],
  onEdits,
}: {
  bytes: Uint8Array;
  editable?: boolean;
  edits?: Edit[];
  onEdits?: (e: Edit[]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    wrapper = useRef<HTMLDivElement>(null),
    doc = useRef<any>(null),
    viewport = useRef<any>(null);
  const [pages, setPages] = useState(0),
    [page, setPage] = useState(1),
    [zoom, setZoom] = useState(0.9),
    [error, setError] = useState(""),
    [kind, setKind] = useState("select"),
    [text, setText] = useState("Your text"),
    [size, setSize] = useState(16),
    [color, setColor] = useState("#166534"),
    [selected, setSelected] = useState(""),
    [image, setImage] = useState(""),
    [signature, setSignature] = useState(false),
    [rendered, setRendered] = useState(0);
  const history = useRef<Edit[][]>([]),
    redo = useRef<Edit[][]>([]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let stopped = false;
    setPage(1);
    setError("");
    history.current = [];
    redo.current = [];
    openPdf(bytes)
      .then((d) => {
        if (stopped) {
          d.destroy();
          return;
        }
        doc.current = d;
        setPages(d.numPages);
        setRendered((r) => r + 1);
      })
      .catch((e) =>
        setError(
          /password/i.test(String(e))
            ? "Password-protected PDF preview is not supported."
            : "This PDF could not be rendered.",
        ),
      );
    return () => {
      stopped = true;
      doc.current?.destroy();
      doc.current = null;
    };
  }, [bytes]);
  useEffect(() => {
    if (!doc.current || !canvas.current) return;
    let stopped = false,
      task: any;
    doc.current
      .getPage(page)
      .then((p: any) => {
        if (stopped) return;
        const v = p.getViewport({ scale: zoom });
        if (v.width * v.height > 16e6) {
          setError("Preview is too large. Reduce zoom.");
          return;
        }
        viewport.current = v;
        canvas.current!.width = v.width;
        canvas.current!.height = v.height;
        task = p.render({
          canvas: canvas.current,
          canvasContext: canvas.current!.getContext("2d"),
          viewport: v,
        });
        return task.promise;
      })
      .then(() => {
        if (!stopped) setRevision((v) => v + 1);
      })
      .catch((e: any) => {
        if (!stopped && e.name !== "RenderingCancelledException")
          setError("Preview could not render this page.");
      });
    return () => {
      stopped = true;
      task?.cancel();
    };
  }, [page, zoom, rendered]);
  function commit(next: Edit[]) {
    history.current.push(edits);
    redo.current = [];
    onEdits?.(next);
  }
  function undo() {
    const prev = history.current.pop();
    if (prev) {
      redo.current.push(edits);
      onEdits?.(prev);
    }
  }
  function redoAction() {
    const next = redo.current.pop();
    if (next) {
      history.current.push(edits);
      onEdits?.(next);
    }
  }
  function place(e: React.PointerEvent<HTMLDivElement>) {
    if (!editable || kind === "select" || !viewport.current) return;
    const rect = canvas.current!.getBoundingClientRect();
    const [x, y] = viewport.current.convertToPdfPoint(
      ((e.clientX - rect.left) * canvas.current!.width) / rect.width,
      ((e.clientY - rect.top) * canvas.current!.height) / rect.height,
    );
    if (kind === "image" && !image) return;
    const item: Edit = {
      id: crypto.randomUUID(),
      page: page - 1,
      kind,
      x,
      y,
      width: kind === "image" ? 150 : 120,
      height: kind === "image" ? 60 : 24,
      text,
      size,
      color,
      data: kind === "image" ? image : undefined,
    };
    commit([...edits, item]);
    setSelected(item.id);
    setKind("select");
  }
  const selectedEdit = edits.find((e) => e.id === selected);
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <div>
          <button
            className="icon-btn"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            Page {page} / {pages || "…"}
          </span>
          <button
            className="icon-btn"
            aria-label="Next page"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div>
          <button
            className="icon-btn"
            aria-label="Zoom out"
            disabled={zoom <= 0.3}
            onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
          >
            <ZoomOut size={18} />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button
            className="icon-btn"
            aria-label="Zoom in"
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
          >
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
      {editable && (
        <>
          <div className="editor-toolbar">
            {[
              ["select", MousePointer2, "Select"],
              ["text", Type, "Text"],
              ["highlight", Highlighter, "Highlight"],
              ["rectangle", Square, "Rectangle"],
              ["whiteout", Square, "Whiteout"],
            ].map(([k, C, label]: any) => (
              <button
                key={k}
                className={kind === k ? "active" : ""}
                onClick={() => setKind(k)}
                title={label}
              >
                <C size={17} />
                {label}
              </button>
            ))}
            <label className="upload-mini">
              <ImagePlus size={17} />
              PNG
              <input
                type="file"
                accept="image/png"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5e6) {
                    setError("Choose a PNG under 5 MB.");
                    return;
                  }
                  const r = new FileReader();
                  r.onload = () => {
                    setImage(String(r.result));
                    setKind("image");
                  };
                  r.readAsDataURL(f);
                }}
              />
            </label>
            <button onClick={() => setSignature(!signature)}>
              <PenLine size={17} />
              Signature
            </button>
            <button
              aria-label="Undo"
              onClick={undo}
              disabled={!history.current.length}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="Redo"
              onClick={redoAction}
              disabled={!redo.current.length}
            >
              <Redo2 size={17} />
            </button>
          </div>
          <div className="editor-options">
            <label>
              Text
              <input
                value={text}
                maxLength={300}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label>
              Size
              <input
                type="number"
                min={6}
                max={150}
                value={size}
                onChange={(e) =>
                  setSize(Math.min(150, Math.max(6, Number(e.target.value))))
                }
              />
            </label>
            <label>
              Color
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
          </div>
          <p className="hint">
            Choose a tool, then click the page to place it. Select an object to
            change its position or size. Whiteout covers content visually; it
            does not securely redact it.
          </p>
          {signature && (
            <Signature
              onSave={(data) => {
                setImage(data);
                setKind("image");
                setSignature(false);
              }}
            />
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="canvas-scroll">
        <div
          className="canvas-wrap"
          ref={wrapper}
          onPointerDown={place}
          style={{ cursor: kind === "select" ? "default" : "crosshair" }}
        >
          <canvas ref={canvas} />
          {editable &&
            viewport.current &&
            edits
              .filter((e) => e.page === page - 1)
              .map((e) => {
                const v = viewport.current;
                const [left, top] = v.convertToViewportPoint(
                  e.x,
                  e.y + (e.kind === "text" ? e.size * 0.85 : e.height),
                );
                return (
                  <button
                    key={e.id}
                    aria-label={`Select ${e.kind} object`}
                    className={
                      "edit-object " + (selected === e.id ? "selected" : "")
                    }
                    onPointerDown={(ev) => {
                      ev.stopPropagation();
                      setSelected(e.id);
                      setKind("select");
                    }}
                    style={{
                      left,
                      top,
                      width: Math.max(20, e.width * zoom),
                      height: Math.max(15, e.height * zoom),
                      color: e.color,
                      fontSize: e.size * zoom,
                      background:
                        e.kind === "whiteout"
                          ? "white"
                          : e.kind === "highlight"
                            ? e.color + "55"
                            : e.kind === "rectangle"
                              ? e.color
                              : "transparent",
                      border: undefined,
                    }}
                  >
                    {e.kind === "text" ? (
                      e.text
                    ) : e.kind === "image" ? (
                      <img src={e.data} alt="Placed signature or image" />
                    ) : null}
                  </button>
                );
              })}
        </div>
      </div>
      {editable && selectedEdit && (
        <div className="object-properties">
          <b>Selected {selectedEdit.kind}</b>
          {(["x", "y", "width", "height"] as const).map((k) => (
            <label key={k}>
              {k}
              <input
                type="number"
                value={Math.round(selectedEdit[k])}
                onChange={(ev) =>
                  commit(
                    edits.map((e) =>
                      e.id === selected
                        ? { ...e, [k]: Number(ev.target.value) }
                        : e,
                    ),
                  )
                }
              />
            </label>
          ))}
          {selectedEdit.kind === "text" && (
            <label>
              Text
              <input
                value={selectedEdit.text}
                onChange={(ev) =>
                  commit(
                    edits.map((e) =>
                      e.id === selected ? { ...e, text: ev.target.value } : e,
                    ),
                  )
                }
              />
            </label>
          )}
          <button
            className="btn danger"
            onClick={() => {
              commit(edits.filter((e) => e.id !== selected));
              setSelected("");
            }}
          >
            <Trash2 size={15} />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
function Signature({ onSave }: { onSave: (data: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null),
    drawing = useRef(false),
    ink = useRef(false);
  return (
    <div className="signature">
      <p>
        Draw your signature below, then place it on the page. This is a visual
        signature, not a certificate-based digital signature.
      </p>
      <canvas
        width={500}
        height={150}
        ref={ref}
        onPointerDown={(e) => {
          drawing.current = true;
          ink.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect(),
            c = ref.current!.getContext("2d")!;
          c.beginPath();
          c.moveTo(
            ((e.clientX - r.left) * 500) / r.width,
            ((e.clientY - r.top) * 150) / r.height,
          );
          c.lineWidth = 2;
          c.strokeStyle = "#152e23";
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const r = e.currentTarget.getBoundingClientRect(),
            c = ref.current!.getContext("2d")!;
          c.lineTo(
            ((e.clientX - r.left) * 500) / r.width,
            ((e.clientY - r.top) * 150) / r.height,
          );
          c.stroke();
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerCancel={() => (drawing.current = false)}
      />
      <div className="flex">
        <button
          className="btn"
          onClick={() => {
            ref.current!.getContext("2d")!.clearRect(0, 0, 500, 150);
            ink.current = false;
          }}
        >
          Clear
        </button>
        <button
          className="btn primary"
          onClick={() => {
            if (ink.current) onSave(ref.current!.toDataURL("image/png"));
          }}
        >
          Use signature
        </button>
      </div>
    </div>
  );
}
