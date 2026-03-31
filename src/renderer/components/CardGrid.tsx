import type { Card } from '../../shared/types';
import ManaSymbols from './ManaSymbols';

interface Props {
  cards: Card[];
  loading: boolean;
  onCardClick: (card: Card) => void;
  onAddToDeck?: (card: Card) => void;
}

export default function CardGrid({ cards, loading, onCardClick, onAddToDeck }: Props) {
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

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3 p-1">
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="group relative cursor-pointer animate-fade-in"
          style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}
        >
          {card.image_uri_small ? (
            <img
              src={card.image_uri_small}
              alt={card.name}
              loading="lazy"
              onClick={() => onCardClick(card)}
              className="w-full rounded-xl shadow-lg shadow-black/30
                         transition-all duration-200
                         group-hover:scale-[1.03] group-hover:shadow-xl group-hover:shadow-black/50
                         group-hover:ring-1 group-hover:ring-mana-gold/30"
            />
          ) : (
            <div
              onClick={() => onCardClick(card)}
              className="w-full aspect-[488/680] rounded-xl bg-obsidian border border-slate-mid/30
                         flex flex-col items-center justify-center gap-2 p-3
                         transition-all duration-200 group-hover:border-mana-gold/30"
            >
              <span className="text-bone text-xs font-medium text-center leading-tight">{card.name}</span>
              <ManaSymbols cost={card.mana_cost} />
            </div>
          )}

          {onAddToDeck && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddToDeck(card); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full
                         bg-mana-green/80 text-white text-lg font-bold
                         flex items-center justify-center
                         opacity-0 group-hover:opacity-100 transition-opacity
                         hover:bg-mana-green cursor-pointer shadow-lg"
              title="Add to deck"
            >
              +
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
