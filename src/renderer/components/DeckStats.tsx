import { useState } from 'react';
import type { DeckCard } from '../../shared/types';

interface Props {
  cards: DeckCard[];
  board: 'main' | 'sideboard';
  targetTotal?: number;
  targetLands?: number;
}

interface CurveBucket {
  creatures: number;
  spells: number;
}

const CURVE_KEYS = ['0', '1', '2', '3', '4', '5', '6+'] as const;

function emptyCurve(): Record<string, CurveBucket> {
  return Object.fromEntries(CURVE_KEYS.map((k) => [k, { creatures: 0, spells: 0 }]));
}

function cmcKey(cmc: number): string {
  return cmc >= 6 ? '6+' : String(Math.floor(cmc));
}

function formatCurveTooltip(bucket: CurveBucket): string {
  const total = bucket.creatures + bucket.spells;
  if (total === 0) return 'No cards';
  const parts: string[] = [];
  if (bucket.creatures > 0) {
    parts.push(`${bucket.creatures} creature${bucket.creatures === 1 ? '' : 's'}`);
  }
  if (bucket.spells > 0) {
    parts.push(`${bucket.spells} spell${bucket.spells === 1 ? '' : 's'}`);
  }
  return parts.join(', ');
}

export default function DeckStats({ cards, board, targetTotal = 60, targetLands = 24 }: Props) {
  const boardCards = cards.filter((c) => c.board === board);

  let total = 0;
  let lands = 0;
  let creatures = 0;
  let spells = 0;
  const curve = emptyCurve();

  for (const dc of boardCards) {
    if (!dc.card) continue;
    const tl = dc.card.type_line.toLowerCase();
    total += dc.quantity;
    if (tl.includes('land')) {
      lands += dc.quantity;
    } else if (tl.includes('creature')) {
      creatures += dc.quantity;
      const k = cmcKey(dc.card.cmc);
      curve[k].creatures += dc.quantity;
    } else {
      spells += dc.quantity;
      const k = cmcKey(dc.card.cmc);
      curve[k].spells += dc.quantity;
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
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
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

function ManaCurve({ curve }: { curve: Record<string, CurveBucket> }) {
  const max = Math.max(
    1,
    ...CURVE_KEYS.map((k) => {
      const b = curve[k];
      return (b?.creatures ?? 0) + (b?.spells ?? 0);
    }),
  );
  const chartHeight = 34;

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
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 4,
          height: chartHeight + 18,
          maxWidth: 260,
        }}
      >
        {CURVE_KEYS.map((k) => {
          const bucket = curve[k] ?? { creatures: 0, spells: 0 };
          const total = bucket.creatures + bucket.spells;
          const barHeight = total > 0 ? Math.max(2, Math.round((total / max) * chartHeight)) : 0;
          return (
            <CurveBar
              key={k}
              cmc={k}
              bucket={bucket}
              barHeight={barHeight}
              tooltip={formatCurveTooltip(bucket)}
              total={total}
            />
          );
        })}
      </div>
    </div>
  );
}

function CurveBar({
  cmc,
  bucket,
  barHeight,
  tooltip,
  total,
}: {
  cmc: string;
  bucket: CurveBucket;
  barHeight: number;
  tooltip: string;
  total: number;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 3,
        position: 'relative',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={tooltip}
    >
      {hover && total > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 6,
            padding: '5px 7px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
            fontSize: 10,
            lineHeight: 1.35,
            color: 'var(--text-dim)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          {bucket.creatures > 0 && (
            <div>
              {bucket.creatures} creature{bucket.creatures === 1 ? '' : 's'}
            </div>
          )}
          {bucket.spells > 0 && (
            <div>
              {bucket.spells} spell{bucket.spells === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}
      {total > 0 && (
        <span
          style={{
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: hover ? 'var(--text)' : 'var(--text-dim)',
            lineHeight: 1,
            marginBottom: 2,
          }}
        >
          {total}
        </span>
      )}
      <div
        style={{
          width: '100%',
          height: barHeight,
          background: 'var(--accent)',
          opacity: total > 0 ? (hover ? 1 : 0.85) : 0,
          borderRadius: 2,
          transition: 'opacity 120ms',
        }}
      />
      <div
        style={{
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: hover ? 'var(--text-dim)' : 'var(--text-mute)',
        }}
      >
        {cmc}
      </div>
    </div>
  );
}
