import en from './locales/en.json';
import es from './locales/es.json';

export const APP_LOCALES = [
  { code: 'en', labelKey: 'settings.localeEn' },
  { code: 'es', labelKey: 'settings.localeEs' },
] as const;

export type AppLocale = (typeof APP_LOCALES)[number]['code'];

export const DEFAULT_APP_LOCALE: AppLocale = 'en';

const catalogs: Record<AppLocale, typeof en> = { en, es };

export type MessageTree = typeof en;

type NestedKeyOf<T, P extends string = ''> = T extends object
  ? {
      [K in keyof T & string]: NestedKeyOf<T[K], P extends '' ? K : `${P}.${K}`>;
    }[keyof T & string]
  : P;

export type MessageKey = NestedKeyOf<MessageTree>;

function lookup(tree: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = tree;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object' || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function isAppLocale(value: string): value is AppLocale {
  return value === 'en' || value === 'es';
}

export function translate(
  locale: AppLocale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = lookup(catalogs[locale] as unknown as Record<string, unknown>, key)
    ?? lookup(catalogs.en as unknown as Record<string, unknown>, key)
    ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : `{${name}}`,
  );
}

/** Flat catalog export for tooling / tests. */
export function getCatalog(locale: AppLocale): MessageTree {
  return catalogs[locale];
}
