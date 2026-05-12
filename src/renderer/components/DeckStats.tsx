import type { DeckCard } from '../../shared/types';

interface Props {
  cards: DeckCard[];
  board: 'main' | 'sideboard';
  targetTotal?: number;
  targetLands?: number;
}

export default function DeckStats({ cards, board, targetTotal = 60, targetLands = 24 }: Props) {
  const boardCards = cards.filter((c) => c.board === board);

  let total = 0;
  let lands = 0;
  let creatures = 0;
  let spells = 0;
  const curve: Record<string, number> = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0 };

  for (const dc of boardCards) {
    if (!dc.card) continue;
    const tl = dc.card.type_line.toLowerCase();
    total += dc.quantity;
    if (tl.includes('land')) {
      lands += dc.quantity;
    } else if (tl.includes('creature')) {
      creatures += dc.quantity;
      const k = dc.card.cmc >= 6 ? '6+' : String(Math.floor(dc.card.cmc));
      curve[k] = (curve[k] || 0) + dc.quantity;
    } else {
      spells += dc.quantity;
      const k = dc.card.cmc >= 6 ? '6+' : String(Math.floor(dc.card.cmc));
      curve[k] = (curve[k] || 0) + dc.quantity;
    }
  }

  const tiles = [
    { l: 'Cards', v: total, t: targetTotal },
    { l: 'Lands', v: lands, t: targetLands },
    { l: 'Creatures', v: creatures },
    { l: 'Spells', v: spells },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 1,
          background: 'var(--border)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
        }}
      >
        {tiles.map((s) => (
          <div key={s.l} style={{ background: 'var(--bg-panel)', padding: '6px 9px' }}>
            <div
              style={{
                fontSize: 9,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-mute)',
              }}
            >
              {s.l}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginTop: 2 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.v}
              </span>
              {s.t != null && (
                <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  /{s.t}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <ManaCurve curve={curve} />
    </div>
  );
}

function ManaCurve({ curve }: { curve: Record<string, number> }) {
  const keys = ['0', '1', '2', '3', '4', '5', '6+'];
  const max = Math.max(1, ...keys.map((k) => curve[k] || 0));
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-mute)',
          marginBottom: 6,
        }}
      >
        Curve
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 42 }}>
        {keys.map((k) => {
          const v = curve[k] || 0;
          const h = (v / max) * 100;
          return (
            <div
              key={k}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <div
                style={{
                  flex: 1,
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'flex-end',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: `${h}%`,
                    minHeight: v ? 2 : 0,
                    background: 'var(--accent)',
                    opacity: 0.7,
                    borderRadius: 2,
                  }}
                />
              </div>
              <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-mute)' }}>
                {k}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
