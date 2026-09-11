"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Lang, DictKey, t as translate } from "@/lib/i18n";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "en",
  setLang: () => {},
  t: (k) => translate("en", k),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // Restore the saved preference once mounted (avoids SSR hydration mismatch)
  useEffect(() => {
    const saved = window.localStorage.getItem("edoctorsbd-lang");
    if (saved === "bn" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("edoctorsbd-lang", l);
  }, []);

  const t = useCallback((key: DictKey) => translate(lang, key), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
