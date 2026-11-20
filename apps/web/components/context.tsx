"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import en from "../../../packages/i18n/en.json";
import fr from "../../../packages/i18n/fr.json";
import config from "../../../packages/config/firebase-public.json";
import type { User } from "firebase/auth";
const Context = createContext({
  lang: "en",
  setLang: (_v: string) => {},
  t: en,
  user: null as User | null,
});
export function Providers({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState("en"),
    [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const match = location.hash.match(/^#tool\/([a-z0-9-]+)$/);
    if (match) location.replace(asset("tools/" + match[1] + "/"));
    setLang(localStorage.getItem("paperly-language") || "en");
    let clean: undefined | (() => void);
    let mounted = true;
    getAuthClient()
      .then(async (auth) => {
        const { onAuthStateChanged } = await import("firebase/auth");
        if (mounted) clean = onAuthStateChanged(auth, setUser);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      clean?.();
    };
  }, []);
  function change(v: string) {
    setLang(v);
    localStorage.setItem("paperly-language", v);
    document.documentElement.lang = v;
  }
  return (
    <Context.Provider
      value={{ lang, setLang: change, t: lang === "fr" ? fr : en, user }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
export async function getAuthClient() {
  const { getApps, initializeApp } = await import("firebase/app");
  const { getAuth } = await import("firebase/auth");
  return getAuth(getApps()[0] || initializeApp(config));
}
export const asset = (p: string) =>
  (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/" + p;
