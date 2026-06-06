import type { Deck } from '../../shared/types';
import PillLabel from './PillLabel';

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
      <PillLabel
        style={{ color: meta.color, border: meta.border, background: meta.background }}
        compact={compact}
        icon={group === 'owned' ? <OwnedIcon /> : <WishlistIcon />}
      >
        {meta.label}
      </PillLabel>
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
