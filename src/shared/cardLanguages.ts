/** Scryfall `lang` codes we expose for download / browse. */
export const CARD_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ru', label: 'Russian' },
  { code: 'zhs', label: 'Simplified Chinese' },
  { code: 'zht', label: 'Traditional Chinese' },
] as const;

export type CardLanguageCode = (typeof CARD_LANGUAGES)[number]['code'];

export const DEFAULT_CARD_LANGUAGE: CardLanguageCode = 'en';

export function isCardLanguageCode(value: string): value is CardLanguageCode {
  return CARD_LANGUAGES.some((l) => l.code === value);
}

export function parseSyncLanguages(raw: string): CardLanguageCode[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [DEFAULT_CARD_LANGUAGE];
    const codes = parsed.filter((v): v is CardLanguageCode => typeof v === 'string' && isCardLanguageCode(v));
    return codes.length > 0 ? [...new Set(codes)] : [DEFAULT_CARD_LANGUAGE];
  } catch {
    return [DEFAULT_CARD_LANGUAGE];
  }
}

export function serializeSyncLanguages(langs: CardLanguageCode[]): string {
  const unique = [...new Set(langs.filter(isCardLanguageCode))];
  return JSON.stringify(unique.length > 0 ? unique : [DEFAULT_CARD_LANGUAGE]);
}

export function cardLanguageLabel(code: string): string {
  return CARD_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
