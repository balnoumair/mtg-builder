import {
  CARD_SIZE_LABEL_KEYS,
  stepCardSize,
  type CardSize,
} from '../lib/cardSize';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  value: CardSize;
  onChange: (size: CardSize) => void;
}

export default function CardSizeControl({ value, onChange }: Props) {
  const { t } = useI18n();
  const smaller = stepCardSize(value, -1);
  const larger = stepCardSize(value, 1);
  const atSmallest = smaller === value;
  const atLargest = larger === value;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-chip)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
      }}
      role="group"
      aria-label={t('cardSize.label')}
    >
      <button
        onClick={() => onChange(smaller)}
        disabled={atSmallest}
        aria-label={t('cardSize.decrease')}
        title={t('cardSize.decrease')}
        style={sizeButton(atSmallest)}
      >
        −
      </button>
      <span style={{ minWidth: 22, textAlign: 'center', color: 'var(--text-mute)' }}>
        {t(CARD_SIZE_LABEL_KEYS[value])}
      </span>
      <button
        onClick={() => onChange(larger)}
        disabled={atLargest}
        aria-label={t('cardSize.increase')}
        title={t('cardSize.increase')}
        style={sizeButton(atLargest)}
      >
        +
      </button>
    </div>
  );
}

function sizeButton(disabled: boolean): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    padding: 0,
    border: 'none',
    borderRadius: 3,
    background: 'transparent',
    color: 'var(--text-dim)',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.35 : 1,
    lineHeight: 1,
  };
}
