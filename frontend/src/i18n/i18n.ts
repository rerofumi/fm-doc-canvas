import i18next, { type i18n as I18nInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import type { CatalogShape, SupportedLocale } from "./catalogTypes";
import { en } from "./resources/en";
import { ja } from "./resources/ja";
import { formatCount } from "./formatters";

export const resources = {
  ja: { translation: ja },
  en: { translation: en },
} as const;

export type TranslationCatalog = CatalogShape<typeof ja>;

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: TranslationCatalog };
    returnNull: false;
    strictKeyChecks: true;
    enableSelector: true;
  }
}

export const i18n = i18next.createInstance();

const initOptions = (lng: SupportedLocale) => ({
  lng,
  fallbackLng: "en",
  supportedLngs: ["ja", "en"],
  resources,
  defaultNS: "translation",
  ns: ["translation"],
  returnNull: false,
  returnEmptyString: false,
  enableSelector: true,
  // A missing catalog entry must never leak its semantic key into production UI.
  // The catalog parity/type gates should catch this before shipping; this is the
  // runtime safety net for an unexpected bundle/configuration mismatch.
  parseMissingKeyHandler: () => "",
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

let initialized = false;

const registerFormatters = (): void => {
  i18n.services.formatter?.add("count", (value: unknown, lng: string | undefined) =>
    typeof value === "number" ? formatCount(value, lng === "ja" ? "ja-JP" : "en-US") : String(value ?? ""),
  );
};

export const initI18n = async (locale: SupportedLocale): Promise<I18nInstance> => {
  if (!initialized) {
    try {
      await i18n.use(initReactI18next).init(initOptions(locale));
      registerFormatters();
      initialized = true;
    } catch (error) {
      console.error("Failed to initialize bundled i18n resources", error);
      if (!i18n.isInitialized) {
        await i18n.use(initReactI18next).init(initOptions("en"));
        registerFormatters();
      } else if (i18n.language !== "en") {
        await i18n.changeLanguage("en");
      }
      initialized = true;
    }
  } else if (i18n.language !== locale) {
    await i18n.changeLanguage(locale);
  }

  registerFormatters();

  syncDocumentLanguage(i18n.language === "ja" ? "ja" : "en");
  return i18n;
};

export const syncDocumentLanguage = (locale: SupportedLocale): void => {
  if (typeof document !== "undefined") document.documentElement.lang = locale;
};

export const getI18n = (): I18nInstance => i18n;

/** Snapshot the effective locale at an application-boundary call. */
export const getEffectiveLocale = (): SupportedLocale =>
  i18n.language === "ja" ? "ja" : "en";
