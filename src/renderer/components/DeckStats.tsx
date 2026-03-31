import type { DeckCard } from '../../shared/types';

interface Props {
  cards: DeckCard[];
  board: 'main' | 'sideboard';
}

export default function DeckStats({ cards, board }: Props) {
  const boardCards = cards.filter(c => c.board === board);
  const totalCards = boardCards.reduce((sum, c) => sum + c.quantity, 0);

  // Mana curve
  const curve: Record<number, number> = {};
  for (const dc of boardCards) {
    if (!dc.card) continue;
    if (dc.card.type_line.toLowerCase().includes('land')) continue;
    const cmc = Math.min(Math.floor(dc.card.cmc), 7); // 7+ grouped
    curve[cmc] = (curve[cmc] || 0) + dc.quantity;
  }
  const maxCurve = Math.max(1, ...Object.values(curve));

  // Color distribution
  const colorCounts: Record<string, number> = {};
  for (const dc of boardCards) {
    if (!dc.card) continue;
    for (const c of dc.card.color_identity) {
      colorCounts[c] = (colorCounts[c] || 0) + dc.quantity;
    }
  }

  const COLOR_DISPLAY: Record<string, { label: string; color: string }> = {
    W: { label: 'W', color: '#f9faf4' },
    U: { label: 'U', color: '#0e68ab' },
    B: { label: 'B', color: '#6b5c7a' },
    R: { label: 'R', color: '#d3202a' },
    G: { label: 'G', color: '#00733e' },
  };

  return (
    <div className="flex items-end gap-6 px-1">
      {/* Total count */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-bone text-lg font-display font-bold">{totalCards}</span>
        <span className="text-ash text-xs">cards</span>
      </div>

      {/* Mana curve */}
      <div className="flex items-end gap-1">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(cmc => {
          const count = curve[cmc] || 0;
          const height = count > 0 ? Math.max(4, (count / maxCurve) * 32) : 2;
          return (
            <div key={cmc} className="flex flex-col items-center gap-0.5">
              <span className="text-ash text-[9px]">{count || ''}</span>
              <div
                className="w-4 rounded-sm transition-all duration-300"
                style={{
                  height: `${height}px`,
                  backgroundColor: count > 0 ? 'rgba(201,168,50,0.5)' : 'rgba(53,53,74,0.3)',
                }}
              />
              <span className="text-ash/60 text-[9px]">{cmc === 7 ? '7+' : cmc}</span>
            </div>
          );
        })}
      </div>

      {/* Color distribution */}
      <div className="flex items-center gap-2">
        {Object.entries(COLOR_DISPLAY).map(([code, { label, color }]) => {
          const count = colorCounts[code] || 0;
          if (count === 0) return null;
          return (
            <span
              key={code}
              className="flex items-center gap-1 text-xs"
              style={{ color }}
            >
              <span className="w-3 h-3 rounded-full opacity-60" style={{ backgroundColor: color }} />
              {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}
