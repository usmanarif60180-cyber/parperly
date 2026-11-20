"use client";
import Link from "next/link";
import { FileText, Menu, X, Globe, UserRound } from "lucide-react";
import { useState } from "react";
import { useApp, asset } from "./context";
import brand from "../../../packages/config/brand.json";
export function Header() {
  const { t, lang, setLang, user } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link href="/" className="brand">
        <span className="brand-icon">
          <FileText size={25} />
        </span>
        {brand.name}
        <span className="brand-dot">.</span>
      </Link>
      <nav className={open ? "nav open" : "nav"}>
        <Link href="/tools/" onClick={() => setOpen(false)}>
          {t.all}
        </Link>
        <Link href="/workflows/" onClick={() => setOpen(false)}>
          {t.workflow}
        </Link>
        <Link href="/pricing/" onClick={() => setOpen(false)}>
          {t.pricing}
        </Link>
        <Link href="/help/" onClick={() => setOpen(false)}>
          {t.help}
        </Link>
      </nav>
      <div className="nav-actions">
        <button
          className="icon-btn"
          onClick={() => setLang(lang === "en" ? "fr" : "en")}
          aria-label="Change language"
        >
          <Globe size={16} />
          {lang === "en" ? "FR" : "EN"}
        </button>
        <Link href="/account/" className="account-link">
          <UserRound size={16} />
          <span>{user ? t.account : t.login}</span>
        </Link>
        <button
          className="icon-btn menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
export function Footer() {
  const { t } = useApp();
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand" href="/">
          {brand.name}
          <span className="brand-dot">.</span>
        </Link>
        <p>{t.footer}</p>
      </div>
      <nav>
        {[
          "about",
          "help",
          "privacy",
          "security",
          "terms",
          "cookies",
          "contact",
          "desktop",
          "developer",
        ].map((p) => (
          <Link key={p} href={`/${p}/`}>
            {p[0].toUpperCase() + p.slice(1)}
          </Link>
        ))}
      <a href={asset("THIRD-PARTY-NOTICES.txt")}>Software notices</a>
      </nav>
      <small>
        Local tools available • Cloud processing not connected • No paid plans
        active
      </small>
    </footer>
  );
}
