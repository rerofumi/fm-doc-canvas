import type { LocalePreference, SupportedLocale } from "./catalogTypes";
import { isSupportedLocale } from "./catalogTypes";

export const LOCALE_STORAGE_KEY = "fm-doc-canvas.locale";

const getBrowserStorage = (): Storage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const normalizeLanguage = (value: string | undefined): string =>
  typeof value === "string" ? value.trim().toLowerCase().replace(/_/g, "-") : "";

const languageMatches = (value: string, language: SupportedLocale): boolean => {
  const normalized = normalizeLanguage(value);
  return normalized === language || normalized.startsWith(`${language}-`);
};

export const normalizeLocalePreference = (
  value: unknown,
): LocalePreference => {
  if (value === "ja" || value === "en" || value === "system") return value;
  return "system";
};

export const resolveSystemLocale = (
  languages: readonly string[] | undefined,
  language: string | undefined,
): SupportedLocale => {
  const candidates = [
    ...(Array.isArray(languages) ? languages : []),
    ...(language ? [language] : []),
  ];

  for (const candidate of candidates) {
    if (languageMatches(candidate, "ja")) return "ja";
    if (languageMatches(candidate, "en")) return "en";
  }

  return "en";
};

export const resolveEffectiveLocale = (
  preference: LocalePreference | unknown,
  languages: readonly string[] | undefined = typeof navigator === "undefined" ? undefined : navigator.languages,
  language: string | undefined = typeof navigator === "undefined" ? undefined : navigator.language,
): SupportedLocale => {
  const normalized = normalizeLocalePreference(preference);
  return normalized === "system"
    ? resolveSystemLocale(languages, language)
    : isSupportedLocale(normalized)
      ? normalized
      : "en";
};

export const readLocalePreference = (
  storage: Pick<Storage, "getItem"> | undefined = getBrowserStorage(),
): LocalePreference => {
  try {
    return normalizeLocalePreference(storage?.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return "system";
  }
};

export const writeLocalePreference = (
  preference: LocalePreference,
  storage: Pick<Storage, "setItem"> | undefined = getBrowserStorage(),
): boolean => {
  if (!storage) return false;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
};
