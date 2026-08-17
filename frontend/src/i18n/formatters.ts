export function formatNumber(value: number, locale: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(value: Date | number, locale: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(locale, options).format(value instanceof Date ? value : new Date(value));
}

export function formatCount(value: number, locale: string): string {
  return formatNumber(value, locale);
}
