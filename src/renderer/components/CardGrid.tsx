import type { Card } from '../../shared/types';
import ManaSymbols from './ManaSymbols';

interface Props {
  cards: Card[];
  loading: boolean;
  onCardClick: (card: Card) => void;
  onAddToDeck?: (card: Card) => void;
  ownedQuantities?: Record<string, number>;
}

export default function CardGrid({ cards, loading, onCardClick, onAddToDeck, ownedQuantities }: Props) {
  if (loading && cards.length === 0) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-1">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="card-skeleton aspect-[488/680] rounded-xl" />
        ))}
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-ash text-sm">
        No cards found. Try adjusting your filters.
      </div>
    );
  }

  // When in deck-editor mode: primary click = add to deck, secondary button = view detail
  // When in browse mode: primary click = view detail
  const handlePrimary = onAddToDeck
    ? (card: Card) => onAddToDeck(card)
    : (card: Card) => onCardClick(card);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-1">
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="group relative cursor-pointer animate-fade-in"
          style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}
          onClick={() => handlePrimary(card)}
        >
          {/* Owned quantity badge */}
          {ownedQuantities?.[card.id] ? (
            <div className="absolute top-1.5 right-1.5 bg-mana-gold/85 text-void
                            text-[9px] font-bold rounded-full min-w-[18px] h-[18px]
                            flex items-center justify-center px-1 shadow-sm shadow-black/30
                            pointer-events-none z-10">
              {ownedQuantities[card.id]}
            </div>
          ) : null}

          {(card.image_uri_normal || card.image_uri_small) ? (
            <img
              src={card.image_uri_normal || card.image_uri_small}
              alt={card.name}
              loading="lazy"
              className="w-full rounded-xl shadow-lg shadow-black/30
                         transition-all duration-200
                         group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/50
                         group-hover:ring-1 group-hover:ring-mana-gold/30"
            />
          ) : (
            <div
              className="w-full aspect-[488/680] rounded-xl bg-obsidian border border-slate-mid/30
                         flex flex-col items-center justify-center gap-2 p-3
                         transition-all duration-200 group-hover:border-mana-gold/30"
            >
              <span className="text-bone text-xs font-medium text-center leading-tight">{card.name}</span>
              <ManaSymbols cost={card.mana_cost} />
            </div>
          )}

          {/* Add overlay — shown on hover in deck mode */}
          {onAddToDeck && (
            <div className="absolute inset-0 rounded-xl flex items-center justify-center
                            opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="w-9 h-9 rounded-full bg-black/60 border border-white/20 backdrop-blur-sm
                              flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          )}

          {/* Expand button — opens detail without adding */}
          {onAddToDeck && (
            <button
              onClick={(e) => { e.stopPropagation(); onCardClick(card); }}
              className="absolute top-2 left-2 w-6 h-6 rounded-md
                         bg-black/55 backdrop-blur-sm border border-white/10
                         flex items-center justify-center
                         opacity-0 group-hover:opacity-100 transition-opacity
                         hover:border-white/30 hover:bg-black/70 cursor-pointer"
              title="View details"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M6 1h3v3M9 1L5.5 4.5M4 9H1V6M1 9l3.5-3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
