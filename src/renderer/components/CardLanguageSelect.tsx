import { CARD_LANGUAGES, type CardLanguageCode } from '../../shared/cardLanguages';
import type { MessageKey } from '../../shared/i18n';
import { useI18n } from '../i18n/I18nProvider';

const CARD_LANGUAGE_NAME_KEYS: Record<CardLanguageCode, MessageKey> = {
  en: 'cardLanguage.names.en',
  es: 'cardLanguage.names.es',
  fr: 'cardLanguage.names.fr',
  de: 'cardLanguage.names.de',
  it: 'cardLanguage.names.it',
  pt: 'cardLanguage.names.pt',
  ja: 'cardLanguage.names.ja',
  ko: 'cardLanguage.names.ko',
  ru: 'cardLanguage.names.ru',
  zhs: 'cardLanguage.names.zhs',
  zht: 'cardLanguage.names.zht',
};

interface Props {
  value: CardLanguageCode;
  available: CardLanguageCode[];
  onChange: (lang: CardLanguageCode) => void;
}

export default function CardLanguageSelect({ value, available, onChange }: Props) {
  const { t } = useI18n();
  const options = CARD_LANGUAGES.filter((l) => available.includes(l.code));
  if (options.length <= 1 && options[0]?.code === 'en') {
    // Still show the control so users know the concept exists once more langs
    // are synced; keep it usable with a single option.
  }

  return (
    <label
      title={t('cardLanguage.title')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'var(--text-mute)',
        flexShrink: 0,
      }}
    >
      <span>{t('cardLanguage.label')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as CardLanguageCode)}
        style={{
          padding: '4px 8px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-input)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        {(options.length > 0 ? options : CARD_LANGUAGES.filter((l) => l.code === value)).map((l) => (
          <option key={l.code} value={l.code}>
            {t(CARD_LANGUAGE_NAME_KEYS[l.code])}
          </option>
        ))}
      </select>
    </label>
  );
}
