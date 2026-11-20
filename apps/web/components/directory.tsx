"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Search,
  FileText,
  Layers,
  Scissors,
  PenLine,
  RotateCw,
  Image,
  Lock,
  ArrowDownToLine,
  WandSparkles,
  Workflow,
  Type,
  Check,
} from "lucide-react";
import tools from "../../../packages/tool-registry/tools.json";
import { useApp } from "./context";
export function ToolIcon({ category }: { category: string }) {
  const C =
    (
      {
        "Edit & sign": PenLine,
        Organize: Layers,
        Split: Scissors,
        Optimize: WandSparkles,
        Convert: Image,
        Security: Lock,
        Utilities: RotateCw,
        Workflows: Workflow,
      } as Record<string, typeof FileText>
    )[category] || FileText;
  return <C size={23} />;
}
export function Directory({ home = false }: { home?: boolean }) {
  const { t, lang } = useApp();
  const [q, setQ] = useState(""),
    [category, setCategory] = useState("All"),
    [only, setOnly] = useState(false);
  const list = tools.filter(
    (x) =>
      (category === "All" || x.category === category) &&
      (!only || x.available) &&
      `${x.name} ${x.fr}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <section className="directory-section" id="tools">
      <div className="section-head">
        <div>
          <span className="eyebrow">{t.toolkit}</span>
          <h2>{t.heading}</h2>
        </div>
        <label className="search-box">
          <Search size={19} />
          <input
            aria-label={t.search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
          />
        </label>
      </div>
      <div className="filters">
        {["All", ...new Set(tools.map((t) => t.category))].map((c) => (
          <button
            key={c}
            className={category === c ? "active" : ""}
            onClick={() => setCategory(c)}
          >
            {c === "All" ? t.allCategories : c}
          </button>
        ))}
        <label>
          <input
            type="checkbox"
            checked={only}
            onChange={(e) => setOnly(e.target.checked)}
          />
          {t.availableOnly}
        </label>
      </div>
      <div className="tool-grid">
        {list.map((x) => (
          <Link href={`/tools/${x.id}/`} className="tool-card" key={x.id}>
            <span className="tool-icon">
              <ToolIcon category={x.category} />
            </span>
            <span className={"badge " + (x.available ? "green" : "")}>
              {x.available ? t.local : t.planned}
            </span>
            <h3>{lang === "fr" ? x.fr : x.name}</h3>
            <p>
              {lang === "fr"
                ? "Paramètres, aperçu et téléchargement de votre document."
                : x.description}
            </p>
          </Link>
        ))}
      </div>
      {!list.length && <p className="empty">{t.empty}</p>}
    </section>
  );
}
export function Home() {
  const { t } = useApp();
  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">
            <span className="dot" />
            {t.heroLabel}
          </span>
          <h1>{t.hero}</h1>
          <p>{t.intro}</p>
          <div className="hero-actions">
            <Link className="btn primary" href="/tools/pdf-editor/">
              <PenLine size={17} />
              {t.edit}
            </Link>
            <Link className="btn" href="/tools/">
              {t.browse}
            </Link>
          </div>
          <small className="muted flex">
            <Check size={15} />
            Local tools process your files on this device
          </small>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit" />
          <div className="paper-back" />
          <div className="paper-front">
            <div className="paper-top">
              <b>P.</b>
              <span>THE NEXT CHAPTER</span>
            </div>
            <h3>
              Good things
              <br />
              start on paper.
            </h3>
            <div className="paper-lines" />
            <div className="bars">
              {[30, 43, 54, 65, 80].map((h, i) => (
                <span
                  key={h}
                  style={{
                    height: h,
                    background: [
                      "#d7eadb",
                      "#a5ccb0",
                      "#72a888",
                      "#38825b",
                      "#155c3c",
                    ][i],
                  }}
                />
              ))}
            </div>
            <small>YOUR IDEAS, IN ORDER.</small>
          </div>
          <div className="art-tag">
            PDF <span>made simple</span>
          </div>
          <div className="art-check">
            <Check size={35} />
          </div>
          <div className="art-bottom">
            <FileText size={20} />A fresh perspective.
            <span className="dot" />
          </div>
        </div>
      </section>
      <Directory home />
      <section className="how">
        <div>
          <span className="eyebrow">LESS FRICTION. MORE FLOW.</span>
          <h2>{t.how}</h2>
        </div>
        {[t.how1, t.how2, t.how3].map((h, i) => (
          <article key={h}>
            <span>
              {i === 0 ? (
                <FileText />
              ) : i === 1 ? (
                <PenLine />
              ) : (
                <ArrowDownToLine />
              )}
            </span>
            <h3>{h}</h3>
            <p>
              {
                [
                  "Choose a supported file. Your original stays unchanged.",
                  "Preview the pages and adjust the tool settings.",
                  "Save generated files individually or together as a ZIP.",
                ][i]
              }
            </p>
          </article>
        ))}
      </section>
      <section className="privacy-band">
        <Lock size={38} />
        <div>
          <span className="eyebrow">{t.privacyTitle}</span>
          <h2>{t.privacyNote}</h2>
          <p>{t.privacy}</p>
        </div>
        <Link href="/privacy/" className="btn">
          Privacy details
        </Link>
      </section>
      <section className="faq">
        <h2>{t.faq}</h2>
        {[
          [t.faq1, t.privacy],
          [t.faq2, t.answer2],
          [t.faq3, t.answer3],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </>
  );
}
