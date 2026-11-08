import { useEffect, useMemo } from 'react';
import type { Deck } from '../../shared/types';
import { countDecksByColorCombo } from '../../shared/colorCombos';
import type { MessageKey } from '../../shared/i18n';
import { useI18n } from '../i18n/I18nProvider';
import { ColorIdentity } from './ManaSymbols';

const COMBO_NAME_KEYS: Record<string, MessageKey> = {
  '': 'deckModals.colorStats.combos.colorless',
  W: 'deckModals.colorStats.combos.monoWhite',
  U: 'deckModals.colorStats.combos.monoBlue',
  B: 'deckModals.colorStats.combos.monoBlack',
  R: 'deckModals.colorStats.combos.monoRed',
  G: 'deckModals.colorStats.combos.monoGreen',
  WUBRG: 'deckModals.colorStats.combos.fiveColor',
};

interface Props {
  decks: Deck[];
  /** True when list filters hide some decks, so the title can say so. */
  filtered: boolean;
  onClose: () => void;
}

export default function DeckColorStatsModal({ decks, filtered, onClose }: Props) {
  const { t } = useI18n();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const rows = useMemo(() => countDecksByColorCombo(decks), [decks]);
  const max = Math.max(0, ...rows.map((r) => r.total));
  const one = decks.length === 1;
  const deckCountKey: MessageKey = filtered
    ? (one ? 'deckModals.colorStats.shownDeckCountOne' : 'deckModals.colorStats.shownDeckCountOther')
    : (one ? 'deckModals.colorStats.deckCountOne' : 'deckModals.colorStats.deckCountOther');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
      }}
    >
      <div
        role="dialog"
        aria-label={t('deckModals.colorStats.ariaLabel')}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '85vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
            {t('deckModals.colorStats.title')}
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            {t(deckCountKey, { count: decks.length })}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label={t('deckModals.colorStats.close')}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-mute)',
              fontSize: 14,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '8px 0' }}>
          {rows.length === 0 ? (
            <div style={{ padding: '18px', fontSize: 12, color: 'var(--text-mute)' }}>
              {t('deckModals.colorStats.empty')}
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.key || 'colorless'}
                title={t('deckModals.colorStats.rowTitle', { owned: row.owned, wishlist: row.wishlist })}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 90px 28px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '5px 18px',
                  fontSize: 12.5,
                  opacity: row.total === 0 ? 0.4 : 1,
                }}
              >
                <span style={{ display: 'inline-flex' }}>
                  {row.colors.length > 0 ? (
                    <ColorIdentity colors={row.colors} size={11} />
                  ) : (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>—</span>
                  )}
                </span>
                <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {row.key in COMBO_NAME_KEYS ? t(COMBO_NAME_KEYS[row.key]) : row.name}
                  {row.key && (
                    <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
                      {row.key}
                    </span>
                  )}
                </span>
                <span style={{ height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
                  <span
                    style={{
                      display: 'block',
                      height: '100%',
                      width: `${max ? (row.total / max) * 100 : 0}%`,
                      background: 'var(--text-dim)',
                      borderRadius: 3,
                    }}
                  />
                </span>
                <span
                  style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.total}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
