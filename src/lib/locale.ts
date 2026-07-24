import i18n from '@/i18n/config';

export function getCurrentLocale(): string {
  const lang = i18n.language?.split('-')[0] || 'en';
  const map: Record<string, string> = {
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    ar: 'ar-SA',
  };
  return map[lang] || 'en-US';
}

export function formatDate(
  value: Date | string | number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getCurrentLocale(), options).format(date);
}

export function formatDateTime(value: Date | string | number): string {
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getCurrentLocale(), options).format(value);
}

export function formatCurrency(
  value: number,
  currency = 'USD',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(getCurrentLocale(), {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

export function formatRelativeCount(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}
