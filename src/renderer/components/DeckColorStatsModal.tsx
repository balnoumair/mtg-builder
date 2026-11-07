import { useEffect, useMemo } from 'react';
import type { Deck } from '../../shared/types';
import { countDecksByColorCombo } from '../../shared/colorCombos';
import { ColorIdentity } from './ManaSymbols';

interface Props {
  decks: Deck[];
  /** True when list filters hide some decks, so the title can say so. */
  filtered: boolean;
  onClose: () => void;
}

export default function DeckColorStatsModal({ decks, filtered, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const rows = useMemo(() => countDecksByColorCombo(decks), [decks]);
  const max = rows[0]?.total ?? 0;

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
        aria-label="Deck color stats"
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
            Deck colors
          </h2>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
            {filtered ? ' shown' : ''}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Close"
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
            <div style={{ padding: '18px', fontSize: 12, color: 'var(--text-mute)' }}>No decks.</div>
          ) : (
            rows.map((row) => (
              <div
                key={row.key || 'colorless'}
                title={`${row.owned} owned · ${row.wishlist} wishlist`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr 90px 28px',
                  alignItems: 'center',
                  gap: 10,
                  padding: '5px 18px',
                  fontSize: 12.5,
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
                  {row.name}
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
