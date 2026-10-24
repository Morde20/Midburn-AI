"use client";

/**
 * lib/i18n/LanguageProvider.tsx
 *
 * Client-side language context. Hebrew is the default locale (see
 * DEFAULT_LOCALE in dictionary.ts) and app/layout.tsx already renders the
 * initial <html lang="he" dir="rtl"> to match, so there's no flash of the
 * wrong direction on first load. This provider only takes over from there:
 * it holds the current locale in state, persists the user's choice in
 * localStorage, and flips `document.documentElement`'s `lang`/`dir` when
 * the user toggles.
 *
 * Consumed via the `useLanguage()` hook below — components read `t` (the
 * full, typed dictionary for the current locale) rather than calling a
 * `t("some.key")` string-lookup function, so renames/typos are caught by
 * TypeScript instead of failing silently at runtime.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_LOCALE, getDictionary, type Locale } from "./dictionary";

const STORAGE_KEY = "habak-locale";

type LanguageContextValue = {
  locale: Locale;
  t: ReturnType<typeof getDictionary>;
  dir: "rtl" | "ltr";
  toggleLocale: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyToDocument(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);

  // On mount, restore a previously chosen language (if any) from localStorage.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored === "he" || stored === "en") {
      setLocale(stored);
      applyToDocument(stored);
    }
  }, []);

  function toggleLocale() {
    const next: Locale = locale === "he" ? "en" : "he";
    setLocale(next);
    applyToDocument(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  const value: LanguageContextValue = {
    locale,
    t: getDictionary(locale),
    dir: locale === "he" ? "rtl" : "ltr",
    toggleLocale,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}
