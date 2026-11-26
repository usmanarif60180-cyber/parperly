"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import { openPdf, saveDownload } from "./pdf-client";
import { Viewer } from "./viewer";
import {
  RemoteEditorPanel,
  requestRemote,
  editorApi,
  type Region,
  type RemoteOperation,
} from "./editor-remote";
import { PageCanvas, ObjectGraphic } from "./editor-canvas";
import { SignatureDialog, readImage } from "./editor-signature";
import {
  readDocument,
  exportEditor,
  flattenedSource,
  pdfRectangle,
} from "../../../packages/pdf-editor/engine";
import {
  assertCurrentSnapshot,
  defaultObject,
  dimensions,
  reorderPage,
  rotatedPage,
  uid,
  safeUrl,
  type EditorObject,
  type EditorState,
  type Field,
  type ExistingAnnotation,
  type Kind,
} from "../../../packages/pdf-editor/model";
import { pageRange } from "../../../packages/pdf-core";
const empty: EditorState = { pages: [], objects: [], values: {}, removed: [] };
const tools: [string, string][] = [
  ["select", "Select"],
  ["text", "Text"],
  ["image", "Images"],
  ["signature", "Signature"],
  ["link", "Links"],
  ["forms", "Forms"],
  ["highlight", "Highlight"],
  ["underline", "Underline"],
  ["strikeout", "Strikethrough"],
  ["shapes", "Shapes"],
  ["draw", "Draw"],
  ["whiteout", "Whiteout"],
  ["comment", "Comments"],
];
export function PdfEditor() {
  const [state, setState] = useState<EditorState>(empty),
    [sources, setSources] = useState<Uint8Array[]>([]),
    [docs, setDocs] = useState<any[]>([]),
    [fields, setFields] = useState<Field[]>([]),
    [name, setName] = useState("edited-document.pdf"),
    [originalName, setOriginalName] = useState(""),
    [pageIndex, setPageIndex] = useState(0),
    [tool, setTool] = useState("select"),
    [shape, setShape] = useState<Kind>("rectangle"),
    [selected, setSelected] = useState(""),
    [zoom, setZoom] = useState(0.9),
    [fit, setFit] = useState("width"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [signature, setSignature] = useState(false),
    [texts, setTexts] = useState<any[]>([]),
    [annotations, setAnnotations] = useState<ExistingAnnotation[]>([]),
    [scan, setScan] = useState(false),
    [flatten, setFlatten] = useState(false),
    [output, setOutput] = useState<Uint8Array | null>(null),
    [preview, setPreview] = useState(false),
    [find, setFind] = useState(""),
    [replace, setReplace] = useState(""),
    [showLimits, setShowLimits] = useState(false),
    [historyCount, setHistoryCount] = useState(0),
    [redoCount, setRedoCount] = useState(0);
  const history = useRef<EditorState[]>([]),
    future = useRef<EditorState[]>([]),
    saved = useRef(empty),
    initial = useRef(empty),
    current = useRef(state),
    docRefs = useRef<any[]>([]),
    picker = useRef<HTMLInputElement>(null),
    importPicker = useRef<HTMLInputElement>(null),
    imagePicker = useRef<HTMLInputElement>(null),
    replaceImage = useRef(false),
    scroll = useRef<HTMLDivElement>(null),
    svg = useRef<SVGSVGElement>(null),
    dragPage = useRef(-1),
    operation = useRef(0);
  const [remoteRegion, setRemoteRegion] = useState<Region | null>(null);
  const [defaults, setDefaults] = useState(defaultObject("text", "", 0, 0));
  const gesture = useRef<{
    mode: string;
    start: number[];
    before: EditorState;
    object?: EditorObject;
    id?: string;
    points?: number[][];
  } | null>(null);
  const page = state.pages[pageIndex],
    dim = page ? dimensions(page) : { width: 612, height: 792 },
    object = state.objects.find((o) => o.id === selected),
    settings = object || defaults,
    formatKind = object?.kind || (tool === "shapes" ? shape : tool),
    dirty = state !== saved.current;
  current.current = state;
  const commit = useCallback((next: EditorState) => {
    history.current.push(current.current);
    if (history.current.length > 80) history.current.shift();
    future.current = [];
    current.current = next;
    setState(next);
    setHistoryCount(history.current.length);
    setRedoCount(0);
    setOutput(null);
    setPreview(false);
    setError("");
  }, []);
  function undo() {
    if (busy) return;
    const p = history.current.pop();
    if (!p) return;
    future.current.push(current.current);
    current.current = p;
    setState(p);
    setPageIndex((i) => Math.min(i, p.pages.length - 1));
    setHistoryCount(history.current.length);
    setRedoCount(future.current.length);
    setOutput(null);
    setPreview(false);
    setSelected("");
  }
  function redo() {
    if (busy) return;
    const p = future.current.pop();
    if (!p) return;
    history.current.push(current.current);
    current.current = p;
    setState(p);
    setPageIndex((i) => Math.max(0, Math.min(i, p.pages.length - 1)));
    setHistoryCount(history.current.length);
    setRedoCount(future.current.length);
    setOutput(null);
    setPreview(false);
    setSelected("");
  }
  useEffect(
    () => () => {
      operation.current++;
      docRefs.current.forEach((d) => d?.destroy());
    },
    [],
  );
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (current.current !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const nav = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      if (
        a &&
        current.current !== saved.current &&
        !window.confirm("Discard unsaved PDF changes and leave the editor?")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", nav, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", nav, true);
    };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (busy) return;
      if (
        (e.target as HTMLElement).closest(
          "input,textarea,select,[contenteditable]",
        )
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        commit({
          ...current.current,
          objects: current.current.objects.filter((o) => o.id !== selected),
        });
        setSelected("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [selected, commit, busy]);
  useEffect(() => {
    if (!page || !scroll.current || fit === "manual") return;
    const el = scroll.current;
    const calc = () => {
      const d = dimensions(page);
      setZoom(
        Math.max(
          0.1,
          Math.min(
            3,
            (el.clientWidth - 48) / d.width,
            fit === "page"
              ? (Math.max(320, el.clientHeight) - 48) / d.height
              : 3,
          ),
        ),
      );
    };
    calc();
    const r = new ResizeObserver(calc);
    r.observe(el);
    return () => r.disconnect();
  }, [page?.id, page?.rotation, fit]);
  useEffect(() => {
    setSelected("");
    setTexts([]);
    setAnnotations([]);
    setScan(false);
    setRemoteRegion(null);
  }, [page?.id, page?.rotation]);
  async function upload(file?: File) {
    if (!file || busy) return;
    if (
      dirty &&
      !window.confirm("Discard unsaved changes and open another PDF?")
    )
      return;
    setBusy(true);
    setError("");
    const v = ++operation.current;
    try {
      if (file.size > 40e6) throw Error("Choose a PDF under 40 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = await readDocument(bytes, 0, uid());
      const d = await openPdf(bytes);
      if (v !== operation.current) {
        d.destroy();
        return;
      }
      docRefs.current.forEach((x) => x?.destroy());
      docRefs.current = [d];
      setDocs([d]);
      setSources([bytes]);
      setFields(info.fields);
      const s = {
        ...empty,
        pages: info.pages,
        values: Object.fromEntries(info.fields.map((f) => [f.name, f.value])),
      };
      saved.current = s;
      initial.current = s;
      current.current = s;
      setState(s);
      history.current = [];
      future.current = [];
      setHistoryCount(0);
      setRedoCount(0);
      setPageIndex(0);
      setOriginalName(file.name);
      setName(file.name.replace(/\.pdf$/i, "") + "-edited.pdf");
      setOutput(null);
      setPreview(false);
      setTool("select");
      setNotice(
        "Document opened. Changes stay on this device until you download.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open PDF.");
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }
  function update(patch: Partial<EditorObject>) {
    if (object)
      commit({
        ...state,
        objects: state.objects.map((o) =>
          o.id === object.id ? { ...o, ...patch } : o,
        ),
      });
    else setDefaults({ ...defaults, ...patch });
  }
  function add(o: EditorObject) {
    commit({ ...state, objects: [...state.objects, o] });
    setSelected(o.id);
    setTool("select");
  }
  function coords(e: React.PointerEvent) {
    const r = svg.current!.getBoundingClientRect();
    return [
      Math.max(
        0,
        Math.min(dim.width, ((e.clientX - r.left) * dim.width) / r.width),
      ),
      Math.max(
        0,
        Math.min(dim.height, ((e.clientY - r.top) * dim.height) / r.height),
      ),
    ];
  }
  function start(e: React.PointerEvent, id?: string, mode = "move") {
    if (busy || preview) return;
    const pos = coords(e);
    e.preventDefault();
    e.stopPropagation();
    svg.current!.setPointerCapture(e.pointerId);
    if (id) {
      setSelected(id);
      setTool("select");
      gesture.current = {
        mode,
        start: pos,
        before: state,
        object: state.objects.find((o) => o.id === id),
        id,
      };
      return;
    }
    if (["select", "forms", "image", "signature"].includes(tool)) {
      setSelected("");
      return;
    }
    if (tool === "existing-text") {
      const hit = texts.find(
        (t) =>
          pos[0] >= t.x &&
          pos[0] <= t.x + t.width &&
          pos[1] >= t.y &&
          pos[1] <= t.y + t.height,
      );
      if (hit) setRemoteRegion(hit);
      else
        setNotice(
          "Choose a text run. Scanned pages need OCR first; scan pixels are not editable text.",
        );
      return;
    }
    if (tool === "existing-image") {
      setRemoteRegion({ x: pos[0], y: pos[1], width: 1, height: 1 });
      gesture.current = {
        mode: "remote",
        start: pos,
        before: state,
        object: defaultObject("rectangle", page.id, pos[0], pos[1]),
      };
      return;
    }
    const kind = (tool === "shapes" ? shape : tool) as Kind;
    const o = {
      ...defaultObject(kind, page.id, ...(pos as [number, number])),
      ...defaults,
      id: uid(),
      kind,
      page: page.id,
      x: pos[0],
      y: pos[1],
      rotation: 0,
    };
    if (kind === "whiteout") o.opacity = 1;
    if (kind === "link") {
      o.url = "";
      o.thickness = 0;
    }
    if (kind === "comment") {
      o.text = "Comment";
      o.width = 180;
      o.height = 60;
    }
    if (kind === "text") {
      o.width = 220;
      o.height = 80;
      add(o);
      return;
    }
    if (kind === "comment" || kind === "checkmark") {
      if (kind === "checkmark") {
        o.width = 24;
        o.height = 24;
      }
      add(o);
      return;
    }
    if (["highlight", "underline", "strikeout"].includes(kind)) {
      const hit = texts.find(
        (t) =>
          pos[0] >= t.x &&
          pos[0] <= t.x + t.width &&
          pos[1] >= t.y &&
          pos[1] <= t.y + t.height,
      );
      if (hit) {
        add({
          ...o,
          x: hit.x,
          y: hit.y,
          width: hit.width,
          height: hit.height,
          text: hit.text,
        });
        return;
      }
    }
    o.width = 1;
    o.height = 1;
    if (kind === "draw") o.points = [[0, 0]];
    gesture.current = {
      mode: "create",
      start: pos,
      before: state,
      object: o,
      id: o.id,
      points: [pos],
    };
    setState({ ...state, objects: [...state.objects, o] });
    setSelected(o.id);
  }
  function move(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g || !g.object) return;
    const pos = coords(e),
      dx = pos[0] - g.start[0],
      dy = pos[1] - g.start[1];
    let o = { ...g.object };
    if (g.mode === "remote") {
      setRemoteRegion({
        x: Math.min(g.start[0], pos[0]),
        y: Math.min(g.start[1], pos[1]),
        width: Math.max(2, Math.abs(dx)),
        height: Math.max(2, Math.abs(dy)),
      });
      return;
    }
    if (g.mode === "move") {
      o.x += dx;
      o.y += dy;
    } else if (g.mode === "resize") {
      const angle = (o.rotation * Math.PI) / 180;
      const lx = dx * Math.cos(angle) + dy * Math.sin(angle),
        ly = -dx * Math.sin(angle) + dy * Math.cos(angle);
      o.width = Math.max(8, o.width + lx);
      o.height = ["image", "signature", "circle"].includes(o.kind)
        ? (o.width * g.object.height) / g.object.width
        : Math.max(8, o.height + ly);
      const dw = o.width - g.object.width,
        dh = o.height - g.object.height;
      o.x += (Math.cos(angle) * dw - Math.sin(angle) * dh - dw) / 2;
      o.y += (Math.sin(angle) * dw + Math.cos(angle) * dh - dh) / 2;
    } else if (g.mode === "rotate") {
      o.rotation = Math.round(
        (Math.atan2(pos[1] - o.y - o.height / 2, pos[0] - o.x - o.width / 2) *
          180) /
          Math.PI +
          90,
      );
    } else {
      o.x = Math.min(g.start[0], pos[0]);
      o.y = Math.min(g.start[1], pos[1]);
      o.width = Math.max(2, Math.abs(dx));
      o.height = o.kind === "circle" ? o.width : Math.max(2, Math.abs(dy));
      if (o.kind === "draw") {
        g.points!.push(pos);
        const xs = g.points!.map((p) => p[0]),
          ys = g.points!.map((p) => p[1]);
        o.x = Math.min(...xs);
        o.y = Math.min(...ys);
        o.width = Math.max(2, Math.max(...xs) - o.x);
        o.height = Math.max(2, Math.max(...ys) - o.y);
        o.points = g.points!.map((p) => [
          (p[0] - o.x) / o.width,
          (p[1] - o.y) / o.height,
        ]);
      }
    }
    const base =
      g.mode === "create"
        ? [...g.before.objects, o]
        : g.before.objects.map((x) => (x.id === o.id ? o : x));
    setState({ ...g.before, objects: base });
  }
  function end() {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    if (g.mode === "remote") {
      setTool("select");
      return;
    }
    const next = current.current;
    current.current = g.before;
    if (JSON.stringify(next) !== JSON.stringify(g.before)) commit(next);
    setTool("select");
  }
  async function imageFile(f?: File) {
    if (!f || busy) return;
    const snapshot = current.current;
    try {
      const image = await readImage(f);
      assertCurrentSnapshot(snapshot, current.current);
      if (replaceImage.current && object)
        update({
          data: image.data,
          height: (object.width * image.height) / image.width,
        });
      else
        add({
          ...defaultObject("image", page.id, 40, 40),
          data: image.data,
          width: 180,
          height: (180 * image.height) / image.width,
        });
    } catch (e) {
      setError(String(e));
    } finally {
      replaceImage.current = false;
      if (imagePicker.current) imagePicker.current.value = "";
    }
  }
  async function importPdf(file?: File, duplicate = false) {
    if (busy) return;
    const snapshot = current.current;
    setBusy(true);
    setError("");
    try {
      let raw: Uint8Array;
      if (duplicate) {
        raw = await exportEditor(sources, { ...state, objects: [] }, false);
        const flat = await flattenedSource(raw);
        const d = await PDFDocument.load(flat),
          single = await PDFDocument.create();
        const [copy] = await single.copyPages(d, [pageIndex]);
        single.addPage(copy);
        raw = await single.save();
      } else {
        if (!file) return;
        if (file.size + sources.reduce((n, b) => n + b.length, 0) > 60e6)
          throw Error("Combined source files must be under 60 MB.");
        raw = await flattenedSource(new Uint8Array(await file.arrayBuffer()));
      }
      const source = sources.length,
        info = await readDocument(raw, source, uid());
      if (state.pages.length + info.pages.length > 300)
        throw Error("Maximum 300 pages.");
      const d = await openPdf(raw);
      if (current.current !== snapshot) {
        await d.destroy();
        assertCurrentSnapshot(snapshot, current.current);
      }
      docRefs.current.push(d);
      setDocs([...docs, d]);
      setSources([...sources, raw]);
      const pages = [...state.pages];
      pages.splice(pageIndex + 1, 0, ...info.pages);
      let objects = [...state.objects];
      if (duplicate)
        objects.push(
          ...state.objects
            .filter((o) => o.page === page.id)
            .map((o) => ({ ...o, id: uid(), page: info.pages[0].id })),
        );
      commit({ ...state, pages, objects });
      setPageIndex(pageIndex + 1);
      setNotice(
        "Pages added. Form fields on imported or duplicated pages become read-only; fields on original pages stay fillable.",
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      if (importPicker.current) importPicker.current.value = "";
    }
  }
  function blank(landscape: boolean) {
    if (state.pages.length >= 300) {
      setError("Maximum 300 pages.");
      return;
    }
    const p = {
      id: uid(),
      source: -1,
      index: 0,
      width: landscape ? 842 : 595,
      height: landscape ? 595 : 842,
      rotation: 0,
      cropX: 0,
      cropY: 0,
    };
    const pages = [...state.pages];
    pages.splice(pageIndex + 1, 0, p);
    commit({ ...state, pages });
    setPageIndex(pageIndex + 1);
  }
  function deletePage() {
    if (state.pages.length === 1) return;
    if (!window.confirm(`Delete page ${pageIndex + 1}? You can undo this.`))
      return;
    commit({
      ...state,
      pages: state.pages.filter((p) => p.id !== page.id),
      objects: state.objects.filter((o) => o.page !== page.id),
    });
    setPageIndex(Math.max(0, pageIndex - 1));
  }
  async function apply(download = false) {
    if (busy) return;
    if (state === initial.current && !flatten) {
      setNotice("No edits yet. Make a change before applying or downloading.");
      return;
    }
    const snapshot = state;
    setBusy(true);
    setError("");
    try {
      const bytes = output || (await exportEditor(sources, state, flatten));
      if (current.current !== snapshot) {
        setNotice(
          "The document changed during processing. Apply changes again to include the latest edits.",
        );
        return;
      }
      setOutput(bytes);
      if (download) {
        saveDownload({
          name:
            (name.trim() || "edited-document").replace(/\.pdf$/i, "") + ".pdf",
          bytes,
          type: "application/pdf",
          pages: state.pages.length,
        });
        saved.current = state;
        setNotice("Edited PDF validated and downloaded.");
      } else {
        setPreview(true);
        setNotice(
          "Changes applied to a new PDF. Review the actual export below, then download.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  async function runRemote(op: RemoteOperation, token: string) {
    if (busy) return;
    const snapshot = state;
    setBusy(true);
    setError("");
    try {
      const currentPdf = await exportEditor(sources, snapshot, false);
      const operation =
        op.kind === "ocr"
          ? op
          : { ...op, page: pageIndex + 1, rect: pdfRectangle(page, op.rect) };
      const bytes = await requestRemote(currentPdf, operation, token);
      if (current.current !== snapshot)
        throw Error(
          "The document changed during server processing. Please retry from the latest version.",
        );
      const source = sources.length,
        info = await readDocument(bytes, source, uid());
      if (info.pages.length !== snapshot.pages.length)
        throw Error("Server output page count did not match.");
      const doc = await openPdf(bytes);
      docRefs.current.push(doc);
      setDocs([...docs, doc]);
      setSources([...sources, bytes]);
      setFields(info.fields);
      commit({
        baseSource: source,
        pages: info.pages,
        objects: [],
        values: Object.fromEntries(info.fields.map((f) => [f.name, f.value])),
        removed: [],
      });
      setRemoteRegion(null);
      setSelected("");
      setTool("select");
      setNotice(
        op.kind === "ocr"
          ? "OCR completed. Recognized text is searchable; the original scan image is still unchanged. Review the result."
          : "Original PDF content updated by Apryse. Review the result, especially fonts and layout. Undo restores the prior workspace.",
      );
    } finally {
      setBusy(false);
    }
  }
  const onContent = useCallback((t: any[], a: ExistingAnnotation[]) => {
    setTexts(t);
    setAnnotations(a);
    setScan(!t.length);
  }, []);
  const pageObjects = state.objects.filter((o) => o.page === page?.id);
  function selectTool(t: string) {
    setTool(t);
    setPreview(false);
    setSelected("");
    if (t === "whiteout")
      setDefaults((d) => ({ ...d, fill: "#ffffff", opacity: 1 }));
    if (t === "highlight")
      setDefaults((d) => ({ ...d, color: "#facc15", opacity: 0.35 }));
    if (t === "image") {
      replaceImage.current = false;
      imagePicker.current?.click();
    }
    if (t === "signature") setSignature(true);
  }
  function annotationRemove(a: ExistingAnnotation) {
    commit({ ...state, removed: [...state.removed, `${page.id}:${a.id}`] });
    setNotice(
      "Annotation removed from export. Apply changes to refresh the original PDF appearance.",
    );
  }
  return (
    <main id="main" className="pe-editor">
      <header className="pe-heading">
        <div>
          <p className="eyebrow">PARPERLY • PDF EDITOR</p>
          <h1>Edit your PDF</h1>
          <p>
            Place text, fill forms, sign and organize pages. Local edits stay on
            this device; licensed server operations require your consent.
          </p>
        </div>
        <button onClick={() => setShowLimits((v) => !v)}>
          Editing capabilities
        </button>
      </header>
      <input
        ref={picker}
        hidden
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => upload(e.target.files?.[0])}
      />
      <input
        ref={importPicker}
        hidden
        type="file"
        accept="application/pdf,.pdf"
        onChange={(e) => importPdf(e.target.files?.[0])}
      />
      <input
        ref={imagePicker}
        hidden
        type="file"
        accept="image/png,image/jpeg"
        onChange={(e) => imageFile(e.target.files?.[0])}
      />
      {showLimits && (
        <section className="pe-notice">
          <h2>What this editor can change</h2>
          <p>
            Added text and images are editable. Existing interactive forms can
            be filled. Original page text and images cannot be rewritten by the
            current engine. Embedded subsets, missing fonts and complex layouts
            require a dedicated content-editing engine; overlay text is not a
            substitute.
          </p>
          <p>
            Existing-text/image editing and OCR require the optional licensed
            service. A licensed content-editing/OCR engine and processing
            service must be connected before those features can be used. No
            documents are sent to an external service here.
          </p>
          <p>
            Built-in added-text fonts support Latin/WinAnsi characters. Newlines
            are explicit; line spacing and alignment are supported. Unsupported
            characters produce an export error, never silent substitution.
            Imported/duplicated form fields are flattened. Original fields are
            retained unless flattening is selected.
          </p>
        </section>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="pe-status" role="status">
          {notice}
        </p>
      )}
      {!page ? (
        <section
          className="pe-upload"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length !== 1)
              setError("Drop one PDF to open.");
            else upload(e.dataTransfer.files[0]);
          }}
        >
          <h2>Start with your PDF</h2>
          <p>
            Drag and drop a PDF here, or choose a file. Up to 40 MB / 300 pages.
          </p>
          <button
            className="btn primary"
            disabled={busy}
            onClick={() => picker.current?.click()}
          >
            {busy ? "Opening PDF…" : "Choose PDF"}
          </button>
          <p>
            Existing text editing and OCR require an additional engine. Added
            objects, forms and page editing work locally.
          </p>
        </section>
      ) : (
        <>
          <div className="pe-document-bar">
            <strong>{originalName}</strong>
            <span className={dirty ? "pe-dirty" : ""}>
              {dirty ? "Unsaved changes" : "Saved / unchanged"}
            </span>
            <button disabled={busy} onClick={() => picker.current?.click()}>
              Open another PDF
            </button>
            <button disabled={busy || !historyCount} onClick={undo}>
              Undo
            </button>
            <button disabled={busy || !redoCount} onClick={redo}>
              Redo
            </button>
            <button className="primary" disabled={busy} onClick={() => apply()}>
              {busy ? "Processing…" : "Apply changes"}
            </button>
            <button disabled={busy} onClick={() => apply(true)}>
              Download
            </button>
          </div>
          <div className="pe-toolbar" aria-label="Editor toolbar">
            {tools.map(([t, label]) => (
              <button
                key={t}
                disabled={busy}
                aria-pressed={tool === t}
                onClick={() => selectTool(t)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pe-notice pe-compact">
            {editorApi
              ? "Licensed text/image editing and OCR depend on the connected service. Open Existing content & OCR for status."
              : "Original text/image editing is not connected. Add text creates new content."}{" "}
            <button onClick={() => setShowLimits((v) => !v)}>
              Details & OCR
            </button>
          </div>
          {preview && output ? (
            <section>
              <div className="pe-row">
                <h2>Applied PDF preview</h2>
                <button onClick={() => setPreview(false)}>
                  Back to editing
                </button>
              </div>
              <Viewer bytes={output} />
            </section>
          ) : (
            <div className="pe-workspace">
              <aside className="pe-pages" aria-label="Page thumbnails">
                <h2>Pages</h2>
                <div className="pe-page-actions">
                  <button
                    disabled={busy || state.pages.length >= 300}
                    onClick={() => blank(false)}
                  >
                    Blank portrait
                  </button>
                  <button
                    disabled={busy || state.pages.length >= 300}
                    onClick={() => blank(true)}
                  >
                    Blank landscape
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => importPicker.current?.click()}
                  >
                    Add PDF pages
                  </button>
                </div>
                <p className="pe-help">Drag thumbnails to reorder.</p>
                {state.pages.map((p, i) => (
                  <button
                    className={"pe-thumb " + (i === pageIndex ? "active" : "")}
                    key={p.id}
                    draggable={!busy}
                    aria-label={`Go to page ${i + 1}`}
                    aria-current={i === pageIndex ? "page" : undefined}
                    onDragStart={() => (dragPage.current = i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragPage.current >= 0) {
                        commit(reorderPage(state, dragPage.current, i));
                        setPageIndex(i);
                        dragPage.current = -1;
                      }
                    }}
                    onClick={() => setPageIndex(i)}
                  >
                    <div className="pe-thumb-sheet">
                      {p.source >= 0 ? (
                        <PageCanvas
                          doc={docs[p.source]}
                          page={p}
                          scale={90 / dimensions(p).width}
                          thumbnail
                        />
                      ) : (
                        <div
                          style={{
                            width: 90,
                            height:
                              (90 * dimensions(p).height) / dimensions(p).width,
                            background: "white",
                          }}
                        />
                      )}
                      <svg
                        viewBox={`0 0 ${dimensions(p).width} ${dimensions(p).height}`}
                        className="pe-thumb-overlay"
                      >
                        {state.objects
                          .filter((o) => o.page === p.id)
                          .map((o) => (
                            <ObjectGraphic key={o.id} o={o} />
                          ))}
                      </svg>
                    </div>
                    <span>Page {i + 1}</span>
                  </button>
                ))}
              </aside>
              <section className="pe-center">
                <div className="pe-view-controls">
                  <button
                    disabled={!pageIndex}
                    aria-label="Previous page"
                    onClick={() => setPageIndex((i) => i - 1)}
                  >
                    Previous
                  </button>
                  <label>
                    Page{" "}
                    <input
                      type="number"
                      min={1}
                      max={state.pages.length}
                      value={pageIndex + 1}
                      onChange={(e) =>
                        setPageIndex(
                          Math.max(
                            0,
                            Math.min(
                              state.pages.length - 1,
                              Number(e.target.value) - 1,
                            ),
                          ),
                        )
                      }
                    />
                  </label>
                  <span>of {state.pages.length}</span>
                  <button
                    disabled={pageIndex === state.pages.length - 1}
                    onClick={() => setPageIndex((i) => i + 1)}
                  >
                    Next
                  </button>
                  <button
                    aria-label="Zoom out"
                    onClick={() => {
                      setFit("manual");
                      setZoom((z) => Math.max(0.15, z - 0.15));
                    }}
                  >
                    −
                  </button>
                  <span>{Math.round(zoom * 100)}%</span>
                  <button
                    aria-label="Zoom in"
                    onClick={() => {
                      setFit("manual");
                      setZoom((z) => Math.min(3, z + 0.15));
                    }}
                  >
                    +
                  </button>
                  <button
                    aria-pressed={fit === "width"}
                    onClick={() => setFit("width")}
                  >
                    Fit width
                  </button>
                  <button
                    aria-pressed={fit === "page"}
                    onClick={() => setFit("page")}
                  >
                    Fit page
                  </button>
                </div>
                <div className="pe-page-actions">
                  <button
                    disabled={busy}
                    onClick={() => commit(rotatedPage(state, page.id))}
                  >
                    Rotate page 90°
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => importPdf(undefined, true)}
                  >
                    Duplicate page
                  </button>
                  <button
                    disabled={busy || state.pages.length === 1}
                    onClick={deletePage}
                  >
                    Delete page
                  </button>
                  <button
                    disabled={pageIndex === 0 || busy}
                    onClick={() => {
                      commit(reorderPage(state, pageIndex, pageIndex - 1));
                      setPageIndex((i) => i - 1);
                    }}
                  >
                    Move earlier
                  </button>
                  <button
                    disabled={pageIndex === state.pages.length - 1 || busy}
                    onClick={() => {
                      commit(reorderPage(state, pageIndex, pageIndex + 1));
                      setPageIndex((i) => i + 1);
                    }}
                  >
                    Move later
                  </button>
                </div>
                {scan && (
                  <p className="pe-scan">
                    No embedded text detected on this page. It may be scanned.
                    OCR is not connected; you can add text, signatures and
                    annotations. OCR alone would not make the original scan
                    editable.{" "}
                    <button onClick={() => setShowLimits(true)}>
                      OCR requirements
                    </button>
                  </p>
                )}
                <div className="pe-page-scroll" ref={scroll}>
                  <div
                    className="pe-sheet"
                    style={{
                      width: dim.width * zoom,
                      height: dim.height * zoom,
                    }}
                  >
                    {page.source >= 0 ? (
                      <PageCanvas
                        doc={docs[page.source]}
                        page={page}
                        scale={zoom}
                        onContent={onContent}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "white",
                        }}
                      />
                    )}
                    <svg
                      ref={svg}
                      className="pe-overlay"
                      aria-label="PDF editing canvas"
                      viewBox={`0 0 ${dim.width} ${dim.height}`}
                      style={{
                        cursor: tool === "select" ? "default" : "crosshair",
                      }}
                      onPointerDown={(e) => start(e)}
                      onPointerMove={move}
                      onPointerUp={end}
                      onPointerCancel={() => {
                        if (gesture.current) {
                          setState(gesture.current.before);
                          gesture.current = null;
                        }
                      }}
                    >
                      {[
                        "highlight",
                        "underline",
                        "strikeout",
                        "existing-text",
                      ].includes(tool) &&
                        texts.map((t, i) => (
                          <rect
                            key={i}
                            x={t.x}
                            y={t.y}
                            width={t.width}
                            height={t.height}
                            fill="transparent"
                            stroke="#15803d"
                            strokeOpacity={0.2}
                          />
                        ))}
                      {remoteRegion && (
                        <rect
                          x={remoteRegion.x}
                          y={remoteRegion.y}
                          width={remoteRegion.width}
                          height={remoteRegion.height}
                          fill="#2563eb18"
                          stroke="#2563eb"
                          strokeDasharray="4 3"
                          pointerEvents="none"
                        />
                      )}
                      {pageObjects.map((o) => (
                        <g
                          key={o.id}
                          onPointerDown={(e) => start(e, o.id)}
                          role="button"
                          tabIndex={0}
                          aria-label={`Select ${o.kind} ${o.text.slice(0, 30)}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setSelected(o.id);
                              setTool("select");
                            }
                          }}
                        >
                          <ObjectGraphic o={o} />
                          <rect
                            x={o.x}
                            y={o.y}
                            width={o.width}
                            height={o.height}
                            transform={`rotate(${o.rotation} ${o.x + o.width / 2} ${o.y + o.height / 2})`}
                            fill="transparent"
                            stroke={
                              o.id === selected ? "#047857" : "transparent"
                            }
                            strokeWidth={1 / zoom}
                          />
                        </g>
                      ))}
                      {object && object.page === page.id && (
                        <g
                          transform={`rotate(${object.rotation} ${object.x + object.width / 2} ${object.y + object.height / 2})`}
                        >
                          <rect
                            x={object.x + object.width - 5 / zoom}
                            y={object.y + object.height - 5 / zoom}
                            width={10 / zoom}
                            height={10 / zoom}
                            fill="#047857"
                            stroke="white"
                            onPointerDown={(e) => start(e, object.id, "resize")}
                            aria-label="Resize selected object"
                          />
                          <line
                            x1={object.x + object.width / 2}
                            y1={object.y}
                            x2={object.x + object.width / 2}
                            y2={object.y - 18 / zoom}
                            stroke="#047857"
                          />
                          <circle
                            cx={object.x + object.width / 2}
                            cy={object.y - 22 / zoom}
                            r={5 / zoom}
                            fill="#047857"
                            onPointerDown={(e) => start(e, object.id, "rotate")}
                            aria-label="Rotate selected object"
                          />
                        </g>
                      )}
                    </svg>
                  </div>
                </div>
              </section>
              <aside
                className="pe-properties"
                aria-label="Formatting and objects"
              >
                <h2>
                  {object
                    ? `Selected ${object.kind}`
                    : tool === "forms"
                      ? "Form fields"
                      : "Formatting"}
                </h2>
                {tool === "shapes" && (
                  <label>
                    Shape
                    <select
                      value={shape}
                      onChange={(e) => setShape(e.target.value as Kind)}
                    >
                      <option value="rectangle">Rectangle</option>
                      <option value="circle">Circle</option>
                      <option value="ellipse">Ellipse</option>
                      <option value="line">Line</option>
                      <option value="arrow">Arrow</option>
                      <option value="checkmark">Checkmark</option>
                    </select>
                  </label>
                )}
                {tool === "whiteout" && (
                  <p className="pe-warning">
                    Whiteout only covers content visually. Underlying text and
                    images remain recoverable. This is not secure redaction.
                  </p>
                )}
                {(object?.kind === "text" ||
                  tool === "text" ||
                  object?.kind === "comment") && (
                  <>
                    <label>
                      {object?.kind === "comment"
                        ? "Comment"
                        : "Text (Enter for a new line)"}
                      <textarea
                        aria-label="Object text"
                        value={settings.text}
                        onChange={(e) => update({ text: e.target.value })}
                        rows={4}
                      />
                    </label>
                    {object?.kind !== "comment" && (
                      <>
                        <label>
                          Font family
                          <select
                            value={settings.font}
                            onChange={(e) =>
                              update({ font: e.target.value as any })
                            }
                          >
                            <option>Helvetica</option>
                            <option>TimesRoman</option>
                            <option>Courier</option>
                          </select>
                        </label>
                        <label>
                          Font size
                          <input
                            type="number"
                            min={4}
                            max={180}
                            value={settings.size}
                            onChange={(e) =>
                              update({
                                size: Math.max(
                                  4,
                                  Math.min(180, +e.target.value),
                                ),
                              })
                            }
                          />
                        </label>
                        <div className="pe-row">
                          <button
                            aria-pressed={settings.bold}
                            onClick={() => update({ bold: !settings.bold })}
                          >
                            Bold
                          </button>
                          <button
                            aria-pressed={settings.italic}
                            onClick={() => update({ italic: !settings.italic })}
                          >
                            Italic
                          </button>
                        </div>
                        <label>
                          Alignment
                          <select
                            value={settings.align}
                            onChange={(e) =>
                              update({ align: e.target.value as any })
                            }
                          >
                            <option>left</option>
                            <option>center</option>
                            <option>right</option>
                          </select>
                        </label>
                        <label>
                          Line spacing
                          <input
                            type="number"
                            min={0.8}
                            max={3}
                            step={0.1}
                            value={settings.lineHeight}
                            onChange={(e) =>
                              update({
                                lineHeight: Math.max(
                                  0.8,
                                  Math.min(3, +e.target.value),
                                ),
                              })
                            }
                          />
                        </label>
                        <p className="pe-help">
                          Text uses explicit line breaks; resize the box to
                          adjust alignment. Standard fonts support Latin
                          characters.
                        </p>
                      </>
                    )}
                  </>
                )}
                {(object ||
                  !["select", "forms", "signature", "image"].includes(
                    tool,
                  )) && (
                  <>
                    {!["image", "signature", "whiteout"].includes(
                      formatKind,
                    ) && (
                      <label>
                        Color
                        <input
                          type="color"
                          value={settings.color}
                          onChange={(e) => update({ color: e.target.value })}
                        />
                      </label>
                    )}
                    {["rectangle", "circle", "ellipse", "whiteout"].includes(
                      formatKind,
                    ) && (
                      <>
                        <label>
                          Fill color
                          <input
                            type="color"
                            value={
                              settings.fill === "none"
                                ? "#ffffff"
                                : settings.fill
                            }
                            onChange={(e) => update({ fill: e.target.value })}
                          />
                        </label>
                        {formatKind !== "whiteout" && (
                          <button onClick={() => update({ fill: "none" })}>
                            No fill
                          </button>
                        )}
                      </>
                    )}
                    <label>
                      Opacity
                      <input
                        type="range"
                        min={0.05}
                        max={1}
                        step={0.05}
                        disabled={
                          object?.kind === "whiteout" || tool === "whiteout"
                        }
                        value={settings.opacity}
                        onChange={(e) => update({ opacity: +e.target.value })}
                      />
                    </label>
                    {[
                      "rectangle",
                      "circle",
                      "ellipse",
                      "line",
                      "arrow",
                      "draw",
                      "checkmark",
                      "link",
                      "underline",
                      "strikeout",
                    ].includes(formatKind) && (
                      <label>
                        Line / border thickness
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={settings.thickness}
                          onChange={(e) =>
                            update({
                              thickness: Math.max(
                                0,
                                Math.min(20, +e.target.value),
                              ),
                            })
                          }
                        />
                      </label>
                    )}
                  </>
                )}
                {object && (
                  <>
                    <div className="pe-numbers">
                      {(["x", "y", "width", "height", "rotation"] as const).map(
                        (k) => (
                          <label key={k}>
                            {k}
                            <input
                              type="number"
                              step={1}
                              value={Math.round(object[k] * 10) / 10}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                if (!Number.isFinite(v)) return;
                                let patch: Partial<EditorObject> = {
                                  [k]:
                                    k === "width" || k === "height"
                                      ? Math.max(2, v)
                                      : v,
                                };
                                if (
                                  ["image", "signature", "circle"].includes(
                                    object.kind,
                                  )
                                ) {
                                  if (k === "width")
                                    patch.height =
                                      (Math.max(2, v) * object.height) /
                                      object.width;
                                  if (k === "height")
                                    patch.width =
                                      (Math.max(2, v) * object.width) /
                                      object.height;
                                }
                                update(patch);
                              }}
                            />
                          </label>
                        ),
                      )}
                    </div>
                    {["image", "signature"].includes(object.kind) && (
                      <button
                        onClick={() => {
                          replaceImage.current = true;
                          imagePicker.current?.click();
                        }}
                      >
                        Replace image
                      </button>
                    )}
                    {object.kind === "link" && (
                      <>
                        <label>
                          Link destination
                          <select
                            value={object.target ? "page" : "url"}
                            onChange={(e) =>
                              update(
                                e.target.value === "page"
                                  ? { target: page.id, url: undefined }
                                  : {
                                      target: undefined,
                                      url: "https://example.com",
                                    },
                              )
                            }
                          >
                            <option value="url">External URL</option>
                            <option value="page">Page in this PDF</option>
                          </select>
                        </label>
                        {object.target ? (
                          <label>
                            Target page
                            <select
                              value={object.target}
                              onChange={(e) =>
                                update({ target: e.target.value })
                              }
                            >
                              {state.pages.map((p, i) => (
                                <option key={p.id} value={p.id}>
                                  Page {i + 1}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : (
                          <label>
                            URL
                            <input
                              value={object.url || ""}
                              onChange={(e) => update({ url: e.target.value })}
                            />
                          </label>
                        )}
                      </>
                    )}
                    <div className="pe-row">
                      <button
                        onClick={() =>
                          add({
                            ...object,
                            id: uid(),
                            x: object.x + 12,
                            y: object.y + 12,
                          })
                        }
                      >
                        Duplicate object
                      </button>
                      <button
                        onClick={() => {
                          commit({
                            ...state,
                            objects: state.objects.filter(
                              (o) => o.id !== selected,
                            ),
                          });
                          setSelected("");
                        }}
                      >
                        Delete object
                      </button>
                    </div>
                  </>
                )}
                {tool === "forms" && (
                  <>
                    <p>
                      Fill original interactive fields. Changes appear in the
                      applied PDF preview.
                    </p>
                    {!fields.length && (
                      <p>
                        No interactive fields found. Use Text or Checkmark to
                        fill this document.
                      </p>
                    )}
                    <button
                      onClick={() => {
                        setShape("checkmark");
                        setTool("shapes");
                      }}
                    >
                      Add checkmark
                    </button>
                    {fields
                      .filter(
                        (f) =>
                          !f.pages.length ||
                          f.pages.some((id) =>
                            state.pages.some((p) => p.id === id),
                          ),
                      )
                      .map((f) => (
                        <label key={f.name}>
                          {f.name} {f.readOnly ? "(read-only)" : ""}
                          {f.type === "checkbox" ? (
                            <input
                              type="checkbox"
                              disabled={f.readOnly}
                              checked={!!state.values[f.name]}
                              onChange={(e) =>
                                commit({
                                  ...state,
                                  values: {
                                    ...state.values,
                                    [f.name]: e.target.checked,
                                  },
                                })
                              }
                            />
                          ) : f.type === "text" ? (
                            <textarea
                              disabled={f.readOnly}
                              value={String(state.values[f.name] || "")}
                              onChange={(e) =>
                                commit({
                                  ...state,
                                  values: {
                                    ...state.values,
                                    [f.name]: e.target.value,
                                  },
                                })
                              }
                            />
                          ) : ["radio", "dropdown"].includes(f.type) ? (
                            <select
                              disabled={f.readOnly}
                              value={String(state.values[f.name] || "")}
                              onChange={(e) =>
                                commit({
                                  ...state,
                                  values: {
                                    ...state.values,
                                    [f.name]: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">Choose…</option>
                              {f.options.map((o) => (
                                <option key={o}>{o}</option>
                              ))}
                            </select>
                          ) : (
                            <span>
                              Unsupported field type; retained on export.
                            </span>
                          )}
                        </label>
                      ))}
                  </>
                )}
                <RemoteEditorPanel
                  region={remoteRegion}
                  onSelect={(mode) => {
                    setTool(mode);
                    setSelected("");
                    setRemoteRegion(null);
                  }}
                  onRun={runRemote}
                  busy={busy}
                />
                <details>
                  <summary>Find & replace added text</summary>
                  <label>
                    Find
                    <input
                      value={find}
                      onChange={(e) => setFind(e.target.value)}
                    />
                  </label>
                  <label>
                    Replace with
                    <input
                      value={replace}
                      onChange={(e) => setReplace(e.target.value)}
                    />
                  </label>
                  <button
                    disabled={!find}
                    onClick={() => {
                      const count = state.objects.filter(
                        (o) => o.kind === "text" && o.text.includes(find),
                      ).length;
                      if (!count) {
                        setNotice(
                          "No added text matched. Original PDF text is not rewritten.",
                        );
                        return;
                      }
                      commit({
                        ...state,
                        objects: state.objects.map((o) =>
                          o.kind === "text"
                            ? { ...o, text: o.text.split(find).join(replace) }
                            : o,
                        ),
                      });
                      setNotice(`Replaced text in ${count} added text boxes.`);
                    }}
                  >
                    Replace all added matches
                  </button>
                </details>
                <details>
                  <summary>Objects on this page ({pageObjects.length})</summary>
                  {pageObjects.map((o) => (
                    <button
                      className="pe-list"
                      key={o.id}
                      onClick={() => {
                        setSelected(o.id);
                        setTool("select");
                      }}
                    >
                      {o.kind}: {o.text.slice(0, 28)}
                    </button>
                  ))}
                </details>
                <details>
                  <summary>Original annotations ({annotations.length})</summary>
                  <p className="pe-help">
                    Original annotations remain visible until Apply changes. URL
                    links can be replaced; other annotations can be removed.
                    Internal/named links are retained unless removed.
                  </p>
                  {annotations.map((a) => (
                    <div key={a.id} className="pe-annotation">
                      <span>
                        {a.kind}: {a.url || a.text.slice(0, 50) || a.id}
                      </span>
                      <button
                        disabled={
                          state.removed.includes(`${page.id}:${a.id}`) ||
                          page.source !== (state.baseSource ?? 0)
                        }
                        onClick={() => annotationRemove(a)}
                      >
                        Remove
                      </button>
                      {a.kind === "Link" && a.url && (
                        <button
                          disabled={
                            page.source !== (state.baseSource ?? 0) ||
                            state.removed.includes(`${page.id}:${a.id}`)
                          }
                          onClick={() => {
                            try {
                              safeUrl(a.url!);
                              const o = {
                                ...defaultObject("link", page.id, a.x, a.y),
                                width: a.width,
                                height: a.height,
                                url: a.url,
                                thickness: 0,
                              };
                              commit({
                                ...state,
                                removed: [
                                  ...state.removed,
                                  `${page.id}:${a.id}`,
                                ],
                                objects: [...state.objects, o],
                              });
                              setSelected(o.id);
                              setTool("select");
                            } catch (e) {
                              setError(String(e));
                            }
                          }}
                        >
                          Edit link
                        </button>
                      )}
                    </div>
                  ))}
                </details>
                <p className="pe-help">
                  Select an added object to move it. Drag the square handle to
                  resize, or the round handle to rotate. Images keep their
                  aspect ratio.
                </p>
              </aside>
            </div>
          )}
          <footer className="pe-export">
            <label>
              Download filename
              <input
                value={name}
                maxLength={180}
                onChange={(e) =>
                  setName(e.target.value.replace(/[\\/:*?"<>|]/g, "-"))
                }
              />
            </label>
            <label className="pe-check">
              <input
                type="checkbox"
                checked={flatten}
                disabled={busy}
                onChange={(e) => {
                  setFlatten(e.target.checked);
                  setOutput(null);
                  setPreview(false);
                }}
              />
              Flatten form fields and new annotations
            </label>
            <p className="pe-help">
              Default export preserves original fillable fields, links and
              annotations. Flattening makes forms read-only and draws new
              annotations into page content; existing annotations and links
              remain interactive.
            </p>
          </footer>
        </>
      )}
      {signature && page && (
        <SignatureDialog
          onClose={() => setSignature(false)}
          onUse={(data, ratio, range) => {
            try {
              const indices =
                range === "current"
                  ? [pageIndex]
                  : pageRange(range, state.pages.length);
              const objects = indices.map((i) => ({
                ...defaultObject("signature", state.pages[i].id, 40, 40),
                data,
                width: 180,
                height: 180 / ratio,
              }));
              commit({ ...state, objects: [...state.objects, ...objects] });
              setSelected(objects[0].id);
              setPageIndex(indices[0]);
              setSignature(false);
              setTool("select");
            } catch (e) {
              setError(String(e));
            }
          }}
        />
      )}
    </main>
  );
}
