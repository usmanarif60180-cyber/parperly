"use client";
import { useEffect, useRef, useState } from "react";
export async function readImage(
  file: File,
): Promise<{ data: string; width: number; height: number }> {
  if (file.size > 8e6) throw Error("Choose a PNG or JPEG under 8 MB.");
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw Error("Choose a PNG or JPEG image.");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.width * image.height > 25e6)
        return reject(Error("Image exceeds 25 megapixels."));
      resolve({ data, width: image.width, height: image.height });
    };
    image.onerror = () => reject(Error("Invalid image."));
    image.src = data;
  });
}
export function SignatureDialog({
  onUse,
  onClose,
}: {
  onUse: (data: string, ratio: number, pages: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    dialog = useRef<HTMLDivElement>(null),
    ink = useRef(false),
    drawing = useRef(false);
  const [tab, setTab] = useState("draw"),
    [text, setText] = useState(""),
    [style, setStyle] = useState("cursive"),
    [remember, setRemember] = useState(false),
    [pages, setPages] = useState("current"),
    [error, setError] = useState(""),
    [uploaded, setUploaded] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);
  function use(data: string, ratio: number) {
    if (remember) {
      try {
        localStorage.setItem(
          "parperly-signature",
          JSON.stringify({ data, ratio }),
        );
      } catch {
        setError(
          "Browser storage is full. Uncheck saving to use this signature.",
        );
        return;
      }
    }
    onUse(data, ratio, pages);
  }
  return (
    <div
      className="pe-modal"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="Create signature"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key !== "Tab") return;
        const items = Array.from(
          dialog.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input,select,textarea",
          ),
        ).filter((x) => x.offsetParent !== null);
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="pe-dialog">
        <div className="pe-row">
          <h2>Signature & initials</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <p>Visual signature, not a certificate-based digital signature.</p>
        <div className="pe-row">
          {["draw", "type", "upload", "initials"].map((t) => (
            <button
              key={t}
              aria-pressed={tab === t}
              onClick={() => {
                if (t !== tab) ink.current = false;
                setTab(t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "draw" ? (
          <>
            <canvas
              ref={ref}
              width={600}
              height={180}
              className="pe-sign-canvas"
              onPointerDown={(e) => {
                drawing.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                const r = e.currentTarget.getBoundingClientRect(),
                  c = e.currentTarget.getContext("2d")!;
                c.beginPath();
                c.moveTo(
                  ((e.clientX - r.left) * 600) / r.width,
                  ((e.clientY - r.top) * 180) / r.height,
                );
                c.lineWidth = 3;
                c.lineCap = "round";
                c.strokeStyle = "#172d25";
              }}
              onPointerMove={(e) => {
                if (!drawing.current) return;
                ink.current = true;
                const r = e.currentTarget.getBoundingClientRect(),
                  c = e.currentTarget.getContext("2d")!;
                c.lineTo(
                  ((e.clientX - r.left) * 600) / r.width,
                  ((e.clientY - r.top) * 180) / r.height,
                );
                c.stroke();
              }}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
            />
            <button
              onClick={() => {
                ref.current?.getContext("2d")?.clearRect(0, 0, 600, 180);
                ink.current = false;
              }}
            >
              Clear drawing
            </button>
          </>
        ) : tab === "upload" ? (
          <label>
            Signature image
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={async (e) => {
                try {
                  const f = e.target.files?.[0];
                  if (f) setUploaded((await readImage(f)).data);
                } catch (e) {
                  setError(String(e));
                }
              }}
            />
            {uploaded && (
              <img
                src={uploaded}
                alt="Signature preview"
                style={{ maxHeight: 120, maxWidth: "100%" }}
              />
            )}
          </label>
        ) : (
          <>
            <label>
              {tab === "initials" ? "Initials" : "Signature name"}
              <input
                value={text}
                maxLength={tab === "initials" ? 8 : 80}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <label>
              Signature style
              <select value={style} onChange={(e) => setStyle(e.target.value)}>
                <option value="cursive">Handwritten</option>
                <option value="serif">Classic italic</option>
                <option value="monospace">Monospaced</option>
              </select>
            </label>
            <p style={{ fontFamily: style, fontStyle: "italic", fontSize: 40 }}>
              {text}
            </p>
          </>
        )}
        <label>
          Place on pages
          <input
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="current, all, or 1,3-5"
          />
        </label>
        <label className="pe-check">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Save reusable signature on this browser
        </label>
        <p className="pe-help">
          Optional saving uses this browser’s local storage on this device.
          Anyone using this browser profile can access it. It is never sent to a
          server.
        </p>
        <div className="pe-row">
          <button
            onClick={() => {
              try {
                const saved = JSON.parse(
                  localStorage.getItem("parperly-signature") || "null",
                );
                if (!saved?.data) throw Error("No saved signature.");
                onUse(saved.data, saved.ratio, pages);
              } catch (e) {
                setError(String(e));
              }
            }}
          >
            Use saved signature
          </button>
          <button
            onClick={() => {
              localStorage.removeItem("parperly-signature");
              setError("Saved signature removed from this browser.");
            }}
          >
            Forget saved signature
          </button>
          <button
            className="primary"
            onClick={async () => {
              setError("");
              if (tab === "draw") {
                if (!ink.current) return setError("Draw a signature first.");
                use(ref.current!.toDataURL("image/png"), 600 / 180);
              } else if (tab === "upload") {
                if (!uploaded) return setError("Choose an image first.");
                const image = new Image();
                image.onload = () => use(uploaded, image.width / image.height);
                image.src = uploaded;
              } else {
                if (!text.trim()) return setError("Enter a name or initials.");
                await document.fonts.ready;
                const c = document.createElement("canvas");
                c.width = 900;
                c.height = 150;
                const ctx = c.getContext("2d")!;
                ctx.font = `italic 64px ${style}`;
                ctx.fillStyle = "#172d25";
                ctx.fillText(text, 15, 95, 870);
                use(c.toDataURL(), 6);
              }
            }}
          >
            Use signature
          </button>
        </div>
        {error && <p role="status">{error}</p>}
      </div>
    </div>
  );
}
