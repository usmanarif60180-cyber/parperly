"use client";
import { useEffect, useRef, useState } from "react";
import {
  dimensions,
  type EditorObject,
  type EditorPage,
  type ExistingAnnotation,
} from "../../../packages/pdf-editor/model";
export function PageCanvas({
  doc,
  page,
  scale,
  onContent,
  thumbnail = false,
}: {
  doc: any;
  page: EditorPage;
  scale: number;
  thumbnail?: boolean;
  onContent?: (texts: any[], annotations: ExistingAnnotation[]) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(!thumbnail);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!thumbnail) return;
    const observer = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) setVisible(true);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [thumbnail]);
  useEffect(() => {
    if (!doc || !visible) return;
    let cancelled = false,
      task: any;
    const canvas = ref.current!;
    (async () => {
      setError("");
      const p = await doc.getPage(page.index + 1);
      if (cancelled) return;
      const viewport = p.getViewport({ scale, rotation: page.rotation });
      const ratio = thumbnail ? 1 : Math.min(devicePixelRatio || 1, 2);
      if (viewport.width * viewport.height * ratio * ratio > 20e6)
        throw Error("Reduce zoom to render this large page.");
      canvas.width = Math.ceil(viewport.width * ratio);
      canvas.height = Math.ceil(viewport.height * ratio);
      task = p.render({
        canvas,
        canvasContext: canvas.getContext("2d"),
        viewport,
        transform: [ratio, 0, 0, ratio, 0, 0],
      });
      await task.promise;
      if (cancelled || !onContent) return;
      const natural = p.getViewport({ scale: 1, rotation: page.rotation });
      const text = await p.getTextContent();
      const annotations = await p.getAnnotations();
      if (cancelled) return;
      onContent(
        text.items
          .filter((i: any) => i.str)
          .map((i: any) => {
            const [a, b, c, d, x, y] = i.transform;
            const norm = Math.hypot(a, b) || 1;
            const wx = (a / norm) * i.width,
              wy = (b / norm) * i.width;
            const pts = [
              [x, y],
              [x + wx, y + wy],
              [x + c, y + d],
              [x + wx + c, y + wy + d],
            ].map(([px, py]) => natural.convertToViewportPoint(px, py));
            const xs = pts.map((p: number[]) => p[0]),
              ys = pts.map((p: number[]) => p[1]);
            return {
              text: i.str,
              x: Math.min(...xs),
              y: Math.min(...ys),
              width: Math.max(4, Math.max(...xs) - Math.min(...xs)),
              height: Math.max(4, Math.max(...ys) - Math.min(...ys)),
            };
          }),
        annotations
          .filter((a: any) => a.subtype !== "Widget")
          .map((a: any) => {
            const r = [
              ...natural.convertToViewportPoint(a.rect[0], a.rect[1]),
              ...natural.convertToViewportPoint(a.rect[2], a.rect[3]),
            ];
            return {
              id: a.id,
              page: page.id,
              kind: a.subtype,
              x: Math.min(r[0], r[2]),
              y: Math.min(r[1], r[3]),
              width: Math.abs(r[2] - r[0]),
              height: Math.abs(r[3] - r[1]),
              text: a.contentsObj?.str || "",
              url: a.url,
            };
          }),
      );
    })().catch((e) => {
      if (!cancelled && e.name !== "RenderingCancelledException")
        setError(String(e.message || e));
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page.index, page.rotation, scale, visible]);
  const d = dimensions(page);
  return (
    <>
      <canvas
        ref={ref}
        aria-label={thumbnail ? "Page thumbnail" : "PDF page"}
        style={{
          display: "block",
          width: d.width * scale,
          height: d.height * scale,
          background: "white",
        }}
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function ObjectGraphic({ o }: { o: EditorObject }) {
  const p = {
    stroke: o.color,
    strokeWidth: o.thickness,
    fill: o.fill,
    opacity: o.opacity,
  };
  const x = o.x,
    y = o.y,
    w = o.width,
    h = o.height;
  let graphic;
  if (o.kind === "text")
    graphic = (
      <text
        x={o.align === "center" ? x + w / 2 : o.align === "right" ? x + w : x}
        y={y + o.size}
        fill={o.color}
        opacity={o.opacity}
        fontSize={o.size}
        fontFamily={
          o.font === "TimesRoman"
            ? "Times New Roman,serif"
            : o.font === "Courier"
              ? "Courier New,monospace"
              : "Arial,sans-serif"
        }
        fontWeight={o.bold ? "bold" : "normal"}
        fontStyle={o.italic ? "italic" : "normal"}
        textAnchor={
          o.align === "center"
            ? "middle"
            : o.align === "right"
              ? "end"
              : "start"
        }
      >
        {o.text.split("\n").map((s, i) => (
          <tspan
            key={i}
            x={
              o.align === "center" ? x + w / 2 : o.align === "right" ? x + w : x
            }
            dy={i ? o.size * o.lineHeight : 0}
          >
            {s || " "}
          </tspan>
        ))}
      </text>
    );
  else if (o.kind === "image" || o.kind === "signature")
    graphic = (
      <image
        href={o.data}
        x={x}
        y={y}
        width={w}
        height={h}
        preserveAspectRatio="none"
        opacity={o.opacity}
      />
    );
  else if (o.kind === "ellipse" || o.kind === "circle")
    graphic = (
      <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...p} />
    );
  else if (o.kind === "link")
    graphic = (
      <>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          fill="#3b82f620"
          stroke={o.color}
          strokeWidth={Math.max(1, o.thickness)}
          strokeDasharray="5 3"
        />
        <text x={x + 4} y={y + 14} fontSize={11} fill={o.color}>
          Link
        </text>
      </>
    );
  else if (o.kind === "comment")
    graphic = (
      <>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={3}
          fill="#fff3b0"
          opacity={o.opacity}
          stroke={o.color}
        />
        <text x={x + 5} y={y + 15} fontSize={11} fill={o.color}>
          {o.text.slice(0, 45)}
        </text>
      </>
    );
  else if (o.kind === "draw")
    graphic = (
      <polyline
        points={(o.points || [])
          .map(([a, b]) => `${x + a * w},${y + b * h}`)
          .join(" ")}
        {...p}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  else if (o.kind === "checkmark")
    graphic = (
      <polyline
        points={`${x},${y + h * 0.5} ${x + w * 0.35},${y + h} ${x + w},${y}`}
        {...p}
        fill="none"
      />
    );
  else if (["line", "arrow", "underline", "strikeout"].includes(o.kind)) {
    const y1 = o.kind === "strikeout" ? y + h / 2 : y + h,
      y2 =
        o.kind === "underline" ? y + h : o.kind === "strikeout" ? y + h / 2 : y;
    const a = Math.atan2(y2 - y1, w);
    graphic = (
      <>
        <line x1={x} y1={y1} x2={x + w} y2={y2} {...p} />
        {o.kind === "arrow" &&
          [-0.45, 0.45].map((d) => (
            <line
              key={d}
              x1={x + w}
              y1={y2}
              x2={x + w - 12 * Math.cos(a + d)}
              y2={y2 - 12 * Math.sin(a + d)}
              {...p}
            />
          ))}
      </>
    );
  } else
    graphic = (
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        {...p}
        fill={
          o.kind === "whiteout"
            ? o.fill === "none"
              ? "#ffffff"
              : o.fill
            : o.kind === "highlight"
              ? o.color
              : o.fill
        }
        opacity={o.kind === "whiteout" ? 1 : o.opacity}
        stroke={
          o.kind === "whiteout" || o.kind === "highlight" ? "none" : o.color
        }
      />
    );
  return (
    <g transform={`rotate(${o.rotation} ${x + w / 2} ${y + h / 2})`}>
      {graphic}
    </g>
  );
}
