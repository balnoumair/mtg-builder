import type { Deck } from '../../shared/types';

export type DeckGroup = 'owned' | 'wishlist';

const GROUP_META: Record<
  DeckGroup,
  { label: string; color: string; border: string; background: string }
> = {
  owned: {
    label: 'Owned',
    color: 'var(--good)',
    border: 'rgba(134, 169, 140, 0.35)',
    background: 'rgba(134, 169, 140, 0.1)',
  },
  wishlist: {
    label: 'Wishlist',
    color: '#c9a86c',
    border: 'rgba(201, 168, 108, 0.35)',
    background: 'rgba(201, 168, 108, 0.1)',
  },
};

export function partitionDecks(decks: Deck[]) {
  return {
    owned: decks.filter((d) => d.owned),
    wishlist: decks.filter((d) => !d.owned),
  };
}

interface LabelProps {
  group: DeckGroup;
  count: number;
  compact?: boolean;
}

export default function DeckGroupLabel({ group, count, compact = false }: LabelProps) {
  const meta = GROUP_META[group];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: compact ? '8px 8px 4px' : '0 0 8px',
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: compact ? '2px 7px' : '3px 9px',
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: meta.color,
          background: meta.background,
          border: `1px solid ${meta.border}`,
          borderRadius: 'var(--radius-sm)',
        }}
      >
        {group === 'owned' ? <OwnedIcon /> : <WishlistIcon />}
        {meta.label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? 10 : 11,
          color: 'var(--text-faint)',
        }}
      >
        {count}
      </span>
    </div>
  );
}

function OwnedIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M2 5.2L4.1 7.3L8 2.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WishlistIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
      <path
        d="M5 1.8l.9 1.9 2.1.3-1.5 1.5.4 2.1L5 6.8 3.1 7.6l.4-2.1L2 4l2.1-.3L5 1.8z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}
