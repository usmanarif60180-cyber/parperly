export type Kind =
  | "text"
  | "image"
  | "signature"
  | "link"
  | "highlight"
  | "underline"
  | "strikeout"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "draw"
  | "whiteout"
  | "comment"
  | "checkmark";
export type EditorObject = {
  id: string;
  page: string;
  kind: Kind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  fill: string;
  opacity: number;
  thickness: number;
  text: string;
  size: number;
  font: "Helvetica" | "TimesRoman" | "Courier";
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  lineHeight: number;
  data?: string;
  points?: number[][];
  url?: string;
  target?: string;
};
export type EditorPage = {
  id: string;
  source: number;
  index: number;
  width: number;
  height: number;
  rotation: number;
  cropX: number;
  cropY: number;
};
export type Field = {
  name: string;
  type: "text" | "checkbox" | "radio" | "dropdown" | "unsupported";
  value: string | boolean;
  options: string[];
  readOnly: boolean;
  pages: string[];
};
export type ExistingAnnotation = {
  id: string;
  page: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  url?: string;
  target?: string;
};
export type EditorState = {
  fields?: Field[];
  baseSource?: number;
  pages: EditorPage[];
  objects: EditorObject[];
  values: Record<string, string | boolean>;
  removed: string[];
};
export const uid = () => globalThis.crypto.randomUUID();
export function dimensions(p: EditorPage) {
  return p.rotation % 180
    ? { width: p.height, height: p.width }
    : { width: p.width, height: p.height };
}
export function defaultObject(
  kind: Kind,
  page: string,
  x: number,
  y: number,
): EditorObject {
  return {
    id: uid(),
    kind,
    page,
    x,
    y,
    width: 160,
    height: 60,
    rotation: 0,
    color: "#14532d",
    fill: "none",
    opacity: 1,
    thickness: 2,
    text: kind === "comment" ? "Comment" : "Your text",
    size: 18,
    font: "Helvetica",
    bold: false,
    italic: false,
    align: "left",
    lineHeight: 1.25,
  };
}
export function rotatedPage(state: EditorState, id: string): EditorState {
  const p = state.pages.find((p) => p.id === id)!;
  const d = dimensions(p);
  return {
    ...state,
    pages: state.pages.map((p) =>
      p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
    ),
    objects: state.objects.map((o) =>
      o.page === id
        ? {
            ...o,
            x: d.height - (o.y + o.height / 2) - o.width / 2,
            y: o.x + o.width / 2 - o.height / 2,
            rotation: (o.rotation + 90) % 360,
          }
        : o,
    ),
  };
}
export function safeUrl(value: string) {
  const u = new URL(value);
  if (!["https:", "http:", "mailto:"].includes(u.protocol))
    throw Error("Links must start with https://, http:// or mailto:.");
  return u.href;
}
export function reorderPage(s: EditorState, from: number, to: number) {
  const pages = [...s.pages];
  const [p] = pages.splice(from, 1);
  pages.splice(to, 0, p);
  return { ...s, pages };
}

export function assertCurrentSnapshot(
  expected: EditorState,
  current: EditorState,
) {
  if (expected !== current)
    throw Error(
      "The document changed while loading. Your latest edits were kept; please retry the import.",
    );
}
