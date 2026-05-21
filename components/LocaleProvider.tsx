"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { type Locale, type TranslationKey, detectLocale, t } from "@/lib/i18n";

const LocaleContext = createContext<Locale>("en");

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(detectLocale());
  }, []);

  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useT() {
  const locale = useLocale();
  return (key: TranslationKey) => t(locale, key);
}
