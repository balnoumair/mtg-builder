import { useMemo, useEffect, useState } from 'react';
import type { DeckCard } from '../../shared/types';
import ManaSymbols from './ManaSymbols';

interface Props {
  deckName: string;
  deckCards: DeckCard[];
  ownedQuantities: Record<string, number>;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ClaimDeckModal({ deckName, deckCards, ownedQuantities, onConfirm, onClose }: Props) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const aggregated = useMemo(() => {
    const map: Record<string, { name: string; manaCost: string; deckQty: number; ownedQty: number }> = {};
    for (const dc of deckCards) {
      if (!dc.card) continue;
      if (!map[dc.card_id]) {
        map[dc.card_id] = {
          name: dc.card.name,
          manaCost: dc.card.mana_cost,
          deckQty: 0,
          ownedQty: ownedQuantities[dc.card_id] ?? 0,
        };
      }
      map[dc.card_id].deckQty += dc.quantity;
    }
    return Object.entries(map).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [deckCards, ownedQuantities]);

  const fromCollection = aggregated.filter(([, c]) => c.ownedQty > 0);
  const cardsMoving = fromCollection.reduce((s, [, c]) => s + Math.min(c.deckQty, c.ownedQty), 0);
  const totalDeckCards = aggregated.reduce((s, [, c]) => s + c.deckQty, 0);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Claim as owned
          </h2>
          <p style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
            Mark <span style={{ color: 'var(--text-dim)' }}>{deckName}</span> as a deck you physically own
          </p>
        </div>

        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          {fromCollection.length > 0 ? (
            <>
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{cardsMoving}</span> cards from your collection will be deducted (they’re now part of this deck).
              {cardsMoving < totalDeckCards && (
                <span style={{ color: 'var(--text-mute)' }}>
                  {' '}The remaining {totalDeckCards - cardsMoving} are cards you don’t have in your singles collection.
                </span>
              )}
            </>
          ) : (
            <>None of this deck’s cards are in your singles collection. The deck will simply be marked as owned.</>
          )}
        </div>

        {fromCollection.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-mute)',
                marginBottom: 8,
              }}
            >
              Cards moving from collection
            </div>
            {fromCollection.map(([cardId, c]) => {
              const moving = Math.min(c.deckQty, c.ownedQty);
              const remaining = c.ownedQty - moving;
              return (
                <div
                  key={cardId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 6px',
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--danger)',
                      width: 28,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    −{moving}
                  </span>
                  <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </span>
                  <ManaSymbols cost={c.manaCost} size={11} />
                  {remaining > 0 && (
                    <span
                      title={`${remaining} will remain in collection`}
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}
                    >
                      {remaining} left
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div
          style={{
            padding: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 12px',
              background: 'transparent',
              color: 'var(--text-mute)',
              border: 'none',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              padding: '7px 14px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: confirming ? 'default' : 'pointer',
              opacity: confirming ? 0.6 : 1,
            }}
          >
            {confirming ? 'Claiming…' : 'Confirm & Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
