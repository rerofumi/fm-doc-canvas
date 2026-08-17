import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LocalePreference, SupportedLocale } from "./catalogTypes";
import {
  LOCALE_STORAGE_KEY,
  readLocalePreference,
  resolveEffectiveLocale,
  writeLocalePreference,
} from "./localePreference";
import { syncDocumentLanguage } from "./i18n";

type LocaleContextValue = {
  preference: LocalePreference;
  effectiveLocale: SupportedLocale;
  setPreference: (preference: LocalePreference) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

type LocaleProviderProps = { children: React.ReactNode; initialPreference?: LocalePreference };

export const LocaleProvider: React.FC<LocaleProviderProps> = ({ children, initialPreference }) => {
  const { i18n } = useTranslation();
  const [preference, setPreferenceState] = useState<LocalePreference>(
    initialPreference ?? readLocalePreference(),
  );
  const [effectiveLocale, setEffectiveLocale] = useState<SupportedLocale>(() =>
    resolveEffectiveLocale(initialPreference ?? readLocalePreference()),
  );

  const applyEffectiveLocale = useCallback(async (next: SupportedLocale) => {
    if (i18n.language !== next) await i18n.changeLanguage(next);
    syncDocumentLanguage(next);
    setEffectiveLocale(next);
  }, [i18n]);

  const setPreference = useCallback(async (nextPreference: LocalePreference) => {
    const nextEffective = resolveEffectiveLocale(nextPreference);
    if (!writeLocalePreference(nextPreference)) {
      console.warn(`Unable to persist locale preference (${LOCALE_STORAGE_KEY})`);
    }
    setPreferenceState(nextPreference);
    await applyEffectiveLocale(nextEffective);
  }, [applyEffectiveLocale]);

  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const handleLanguageChange = () => {
      const next = resolveEffectiveLocale("system");
      if (next !== effectiveLocale) void applyEffectiveLocale(next);
    };
    window.addEventListener("languagechange", handleLanguageChange);
    return () => window.removeEventListener("languagechange", handleLanguageChange);
  }, [applyEffectiveLocale, effectiveLocale, preference]);

  const value = useMemo(() => ({ preference, effectiveLocale, setPreference }), [effectiveLocale, preference, setPreference]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = (): LocaleContextValue => {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
};
