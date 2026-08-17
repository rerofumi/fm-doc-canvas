/** Widen catalog leaves while preserving the canonical nested key shape. */
export type CatalogShape<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? CatalogShape<T[K]>
      : never;
};

export type SupportedLocale = "ja" | "en";
export type LocalePreference = "system" | SupportedLocale;

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["ja", "en"] as const;

export const isSupportedLocale = (value: string): value is SupportedLocale =>
  value === "ja" || value === "en";

