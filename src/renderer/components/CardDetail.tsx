import { useEffect } from 'react';
import type { Card } from '../../shared/types';
import ManaSymbols from './ManaSymbols';

interface Props {
  card: Card;
  printings: Card[];
  onClose: () => void;
  onAddToDeck?: (card: Card) => void;
  collectionQuantity?: number;
  onAddToCollection?: (card: Card) => void;
  onUpdateCollectionQuantity?: (cardId: string, quantity: number) => void;
  onRemoveFromCollection?: (cardId: string) => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#8888a0',
  uncommon: '#b0b8c0',
  rare: '#c9a832',
  mythic: '#d35030',
};

export default function CardDetail({
  card, printings, onClose, onAddToDeck,
  collectionQuantity, onAddToCollection, onUpdateCollectionQuantity, onRemoveFromCollection,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto
                   p-6 animate-fade-in mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex gap-6">
          {/* Card image */}
          <div className="flex-shrink-0 w-64">
            {card.image_uri_normal ? (
              <img
                src={card.image_uri_normal}
                alt={card.name}
                className="w-full rounded-xl shadow-2xl shadow-black/50"
              />
            ) : (
              <div className="w-full aspect-[488/680] rounded-xl bg-obsidian border border-slate-mid/30
                              flex items-center justify-center text-bone text-sm">
                {card.name}
              </div>
            )}

            {onAddToDeck && (
              <button
                onClick={() => onAddToDeck(card)}
                className="w-full mt-3 py-2 rounded-xl bg-mana-gold/10 border border-mana-gold/25
                           text-mana-gold/80 font-medium text-xs tracking-wide
                           hover:bg-mana-gold/18 hover:text-mana-gold transition-all cursor-pointer"
              >
                Add to Deck
              </button>
            )}

            {/* Collection actions */}
            {onAddToCollection && (
              <div className="mt-3">
                {(collectionQuantity ?? 0) > 0 ? (
                  <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-obsidian/60 border border-mana-gold/10">
                    <span className="text-[10px] text-ash/50 uppercase tracking-wider">Owned</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button
                        onClick={() => {
                          const newQty = (collectionQuantity ?? 1) - 1;
                          if (newQty <= 0) onRemoveFromCollection?.(card.id);
                          else onUpdateCollectionQuantity?.(card.id, newQty);
                        }}
                        className="w-5 h-5 rounded flex items-center justify-center text-ash/50
                                   hover:text-mana-red hover:bg-white/[0.06] transition-all cursor-pointer"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                      <span className="w-6 text-center text-mana-gold/90 text-xs font-medium tabular-nums">
                        {collectionQuantity}
                      </span>
                      <button
                        onClick={() => onUpdateCollectionQuantity?.(card.id, (collectionQuantity ?? 0) + 1)}
                        className="w-5 h-5 rounded flex items-center justify-center text-ash/50
                                   hover:text-mana-green hover:bg-white/[0.06] transition-all cursor-pointer"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onAddToCollection(card)}
                    className="w-full py-2 rounded-xl bg-obsidian/60 border border-white/[0.06]
                               text-ash/70 font-medium text-xs tracking-wide
                               hover:bg-obsidian hover:text-silver hover:border-mana-gold/20 transition-all cursor-pointer"
                  >
                    Add to Collection
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Card info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h2 className="font-display text-xl font-bold text-bone">{card.name}</h2>
              <button
                onClick={onClose}
                className="text-ash hover:text-bone text-xl leading-none cursor-pointer flex-shrink-0"
              >
                ×
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <ManaSymbols cost={card.mana_cost} size="md" />
              <span className="text-ash text-sm">{card.type_line}</span>
            </div>

            {card.oracle_text && (
              <div className="bg-obsidian/60 rounded-xl p-4 mb-4 border border-slate-mid/20">
                <p className="text-silver text-sm leading-relaxed whitespace-pre-line">
                  {card.oracle_text}
                </p>
              </div>
            )}

            {(card.power || card.toughness) && (
              <p className="text-bone text-sm mb-4 font-medium">
                {card.power}/{card.toughness}
              </p>
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
              <div>
                <span className="text-ash">Set: </span>
                <span className="text-silver">{card.set_name}</span>
              </div>
              <div>
                <span className="text-ash">Rarity: </span>
                <span className="capitalize" style={{ color: RARITY_COLORS[card.rarity] || '#8888a0' }}>
                  {card.rarity}
                </span>
              </div>
              <div>
                <span className="text-ash">Artist: </span>
                <span className="text-silver">{card.artist}</span>
              </div>
              {card.price_usd && (
                <div>
                  <span className="text-ash">Price: </span>
                  <span className="text-mana-gold">${card.price_usd}</span>
                </div>
              )}
            </div>

            {/* Other printings */}
            {printings.length > 1 && (
              <div>
                <h3 className="text-ash text-xs font-medium uppercase tracking-wider mb-2">
                  Other Printings ({printings.length})
                </h3>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {printings.filter(p => p.id !== card.id).slice(0, 20).map(p => (
                    <div
                      key={p.id}
                      className="px-2 py-1 rounded-md bg-obsidian border border-slate-mid/20
                                 text-xs text-silver"
                      title={p.set_name}
                    >
                      {p.set_code.toUpperCase()} #{p.collector_number}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
