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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Aggregate deck cards by card_id (across boards)
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl max-w-xl w-full max-h-[80vh] flex flex-col
                   animate-fade-in mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b border-white/[0.06]">
          <h2 className="font-display text-lg font-normal tracking-[0.12em] text-bone/90 uppercase">
            Claim as Owned
          </h2>
          <p className="text-ash/50 text-xs mt-1">
            Mark <span className="text-bone/70">{deckName}</span> as a deck you physically own
          </p>
        </div>

        {/* Explanation */}
        <div className="px-5 py-3 border-b border-white/[0.04]">
          <div className="flex items-start gap-3 text-xs">
            <div className="w-6 h-6 rounded-lg bg-mana-gold/10 border border-mana-gold/20
                            flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v4M6 8v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                      className="text-mana-gold/70"/>
              </svg>
            </div>
            <div className="text-silver/60 leading-relaxed">
              {fromCollection.length > 0 ? (
                <>
                  <span className="text-mana-gold/80 font-medium">{cardsMoving}</span> cards
                  from your collection will be deducted (they're now part of this deck).
                  {cardsMoving < totalDeckCards && (
                    <span className="text-ash/50"> The remaining {totalDeckCards - cardsMoving} are
                      cards you don't have in your singles collection.</span>
                  )}
                </>
              ) : (
                <>
                  None of this deck's cards are in your singles collection.
                  The deck will simply be marked as owned.
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card list showing what moves */}
        {fromCollection.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <div className="text-[10px] uppercase tracking-wider text-ash/40 mb-2">
              Cards moving from collection
            </div>
            <div className="space-y-px">
              {fromCollection.map(([cardId, c]) => {
                const moving = Math.min(c.deckQty, c.ownedQty);
                const remaining = c.ownedQty - moving;
                return (
                  <div key={cardId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
                    <span className="text-mana-gold/70 text-xs font-medium tabular-nums w-5 text-center">
                      -{moving}
                    </span>
                    <span className="flex-1 text-silver/70 text-xs truncate">{c.name}</span>
                    <ManaSymbols cost={c.manaCost} />
                    {remaining > 0 && (
                      <span className="text-[9px] text-ash/40" title={`${remaining} will remain in collection`}>
                        {remaining} left
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-ash/60 hover:text-silver text-xs cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="px-5 py-2.5 rounded-xl bg-mana-gold/12 border border-mana-gold/30
                       text-mana-gold/85 font-medium text-xs tracking-wide
                       hover:bg-mana-gold/20 hover:text-mana-gold transition-all cursor-pointer
                       disabled:opacity-50 disabled:cursor-default"
          >
            {confirming ? 'Claiming…' : 'Confirm & Claim'}
          </button>
        </div>
      </div>
    </div>
  );
}
