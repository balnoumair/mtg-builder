import {
  CARD_SIZE_LABELS,
  stepCardSize,
  type CardSize,
} from '../lib/cardSize';

interface Props {
  value: CardSize;
  onChange: (size: CardSize) => void;
}

export default function CardSizeControl({ value, onChange }: Props) {
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
      aria-label="Card size"
    >
      <button
        onClick={() => onChange(smaller)}
        disabled={atSmallest}
        aria-label="Decrease card size"
        title="Decrease card size"
        style={sizeButton(atSmallest)}
      >
        −
      </button>
      <span style={{ minWidth: 22, textAlign: 'center', color: 'var(--text-mute)' }}>
        {CARD_SIZE_LABELS[value]}
      </span>
      <button
        onClick={() => onChange(larger)}
        disabled={atLargest}
        aria-label="Increase card size"
        title="Increase card size"
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
