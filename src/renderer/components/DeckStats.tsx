import type { DeckCard } from '../../shared/types';

interface Props {
  cards: DeckCard[];
  board: 'main' | 'sideboard';
}

const COLOR_META: Record<string, { color: string; glow: string }> = {
  W: { color: '#e8e4cc', glow: 'rgba(232,228,204,0.3)' },
  U: { color: '#2e8fd4', glow: 'rgba(46,143,212,0.3)' },
  B: { color: '#b09acc', glow: 'rgba(176,154,204,0.3)' },
  R: { color: '#e84040', glow: 'rgba(232,64,64,0.3)' },
  G: { color: '#1db868', glow: 'rgba(29,184,104,0.3)' },
};

export default function DeckStats({ cards, board }: Props) {
  const boardCards = cards.filter(c => c.board === board);

  const curve: Record<number, number> = {};
  for (const dc of boardCards) {
    if (!dc.card) continue;
    if (dc.card.type_line.toLowerCase().includes('land')) continue;
    const cmc = Math.min(Math.floor(dc.card.cmc), 7);
    curve[cmc] = (curve[cmc] || 0) + dc.quantity;
  }
  const maxCurve = Math.max(1, ...Object.values(curve));

  const colorCounts: Record<string, number> = {};
  for (const dc of boardCards) {
    if (!dc.card) continue;
    for (const c of dc.card.color_identity) {
      colorCounts[c] = (colorCounts[c] || 0) + dc.quantity;
    }
  }

  const activeColors = Object.entries(COLOR_META).filter(([code]) => colorCounts[code] > 0);

  return (
    <div className="flex items-end gap-5 px-1">
      {/* Mana curve */}
      <div>
        <p className="text-[9px] uppercase tracking-[0.12em] text-ash/40 mb-2">Curve</p>
        <div className="flex items-end gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(cmc => {
            const count = curve[cmc] || 0;
            const heightPx = count > 0 ? Math.max(6, (count / maxCurve) * 52) : 3;
            return (
              <div key={cmc} className="flex flex-col items-center gap-1">
                {count > 0 && (
                  <span className="text-[9px] text-bone/60 leading-none">{count}</span>
                )}
                <div
                  className="w-4 rounded-t-sm transition-all duration-300"
                  style={{
                    height: `${heightPx}px`,
                    background: count > 0
                      ? 'linear-gradient(to top, rgba(201,168,50,0.7), rgba(201,168,50,0.35))'
                      : 'rgba(53,53,74,0.25)',
                  }}
                />
                <span className="text-[9px] text-ash/40 leading-none">{cmc === 7 ? '7+' : cmc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Colors */}
      {activeColors.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-[0.12em] text-ash/40 mb-2">Colors</p>
          <div className="flex items-center gap-1.5">
            {activeColors.map(([code, { color, glow }]) => (
              <div key={code} className="flex flex-col items-center gap-1">
                <span className="text-[9px] leading-none" style={{ color }}>{colorCounts[code]}</span>
                <div
                  className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold"
                  style={{
                    backgroundColor: color + '22',
                    borderColor: color + '88',
                    color,
                    boxShadow: `0 0 6px ${glow}`,
                  }}
                >
                  {code}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
