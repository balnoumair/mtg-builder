import type { CSSProperties } from 'react';
import { DEFAULT_APP_LOCALE, translate, type MessageKey } from '../../shared/i18n';
import { useI18n } from '../i18n/I18nProvider';

/**
 * Kinds of card counts. Each kind has one color, used on every page, so a
 * count reads the same wherever it appears. Free, in-deck and in-decks are
 * separate piles: shown together they never count the same copy twice.
 */
export type CountKind = 'free' | 'inDeck' | 'inDecks' | 'inOtherDecks' | 'new' | 'need';

const KIND_COLOR: Record<CountKind, string> = {
  free: 'var(--count-free)',
  inDeck: 'var(--count-in-deck)',
  inDecks: 'var(--count-in-decks)',
  inOtherDecks: 'var(--count-in-decks)',
  new: 'var(--count-new)',
  need: 'var(--count-need)',
};

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const englishT: Translate = (key, vars) => translate(DEFAULT_APP_LOCALE, key, vars);

export function countLabel(kind: CountKind, count: number, t: Translate = englishT): string {
  const vars = { count: count.toLocaleString() };
  const one = count === 1;
  switch (kind) {
    case 'free': return t(one ? 'counts.freeOne' : 'counts.freeOther', vars);
    case 'inDeck': return t('counts.inDeck', vars);
    case 'inDecks': return t('counts.inDecks', vars);
    case 'inOtherDecks': return t('counts.inOtherDecks', vars);
    case 'new': return t(one ? 'counts.newOne' : 'counts.newOther', vars);
    case 'need': return t(one ? 'counts.needOne' : 'counts.needOther', vars);
  }
}

interface Props {
  kind: CountKind;
  count: number;
  title?: string;
  /** Dark backing for tags laid over card art. */
  overlay?: boolean;
  /** Smaller text for dense spots such as deck tiles. */
  compact?: boolean;
  /** Extra markers after the label, e.g. ∞ or ⊘. */
  suffix?: string;
  style?: CSSProperties;
}

export default function CountTag({ kind, count, title, overlay = false, compact = false, suffix, style }: Props) {
  const { t } = useI18n();
  const color = KIND_COLOR[kind];
  return (
    <span
      title={title}
      data-count-kind={kind}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        padding: compact ? '1px 5px' : '1px 6px',
        fontFamily: 'var(--font-mono)',
        fontSize: compact ? 9 : 10,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        color,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        background: overlay
          ? 'rgba(0, 0, 0, 0.7)'
          : `color-mix(in srgb, ${color} 10%, transparent)`,
        backdropFilter: overlay ? 'blur(4px)' : undefined,
        borderRadius: 3,
        ...style,
      }}
    >
      {countLabel(kind, count, t)}
      {suffix}
    </span>
  );
}
