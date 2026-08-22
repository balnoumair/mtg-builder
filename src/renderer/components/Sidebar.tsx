import type { View } from '../lib/types';

interface Props {
  view: View;
  width: number;
  onNavigate: (view: View) => void;
  onSync: () => void;
  cardCount?: number;
}

type NavIconKind = 'grid' | 'box' | 'stack' | 'tag' | 'people';

const NAV_ITEMS: { key: View; label: string; icon: NavIconKind }[] = [
  { key: 'collection', label: 'Card Browser', icon: 'grid' },
  { key: 'my-cards', label: 'My Cards', icon: 'box' },
  { key: 'wants', label: 'Wants', icon: 'tag' },
  { key: 'decks', label: 'Decks', icon: 'stack' },
  { key: 'others-decks', label: "Others' Decks", icon: 'people' },
];

function NavIcon({ icon }: { icon: NavIconKind }) {
  const shapes = {
    grid: (
      <>
        <rect x="1.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" />
        <rect x="7.5" y="1.5" width="4" height="4" rx="0.5" stroke="currentColor" />
        <rect x="1.5" y="7.5" width="4" height="4" rx="0.5" stroke="currentColor" />
        <rect x="7.5" y="7.5" width="4" height="4" rx="0.5" stroke="currentColor" />
      </>
    ),
    box: (
      <>
        <path d="M6.5 1L11.5 3.2v6.6L6.5 12L1.5 9.8V3.2L6.5 1z" stroke="currentColor" />
        <path d="M1.5 3.2L6.5 5.4L11.5 3.2M6.5 5.4V12" stroke="currentColor" />
      </>
    ),
    stack: (
      <>
        <path d="M1.5 4L6.5 1.7L11.5 4L6.5 6.3L1.5 4z" stroke="currentColor" />
        <path d="M1.5 6.5L6.5 8.8L11.5 6.5" stroke="currentColor" />
        <path d="M1.5 9L6.5 11.3L11.5 9" stroke="currentColor" />
      </>
    ),
    tag: (
      <>
        <path d="M1.5 1.5H6.1L11.5 6.9L6.9 11.5L1.5 6.1V1.5z" stroke="currentColor" strokeLinejoin="round" />
        <circle cx="4.2" cy="4.2" r="1" stroke="currentColor" />
      </>
    ),
    people: (
      <>
        <circle cx="5" cy="4.3" r="2.1" stroke="currentColor" />
        <path d="M1.6 11.2c0-1.9 1.5-3.2 3.4-3.2s3.4 1.3 3.4 3.2" stroke="currentColor" strokeLinecap="round" />
        <path d="M9 2.6a2.1 2.1 0 010 3.9M9.6 8.3c1.2.4 1.9 1.5 1.9 2.9" stroke="currentColor" strokeLinecap="round" />
      </>
    ),
  };
  return (
    <svg width="15" height="15" viewBox="0 0 13 13" fill="none" strokeWidth="1.1">
      {shapes[icon]}
    </svg>
  );
}

function NavRow({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: NavIconKind;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 34,
        padding: '8px 10px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: active ? 'var(--bg-row-sel)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        fontSize: 13,
        marginBottom: 2,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-row-hov)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
    >
      <span style={{ opacity: active ? 0.95 : 0.7, display: 'inline-flex' }}>
        <NavIcon icon={icon} />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function Sidebar({
  view,
  width,
  onNavigate,
  onSync,
  cardCount,
}: Props) {
  return (
    <aside
      style={{
        width,
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        flexShrink: 0,
        height: '100%',
      }}
    >
      {/* Nav */}
      <div style={{ padding: '8px 10px 12px' }}>
        {NAV_ITEMS.map((item) => (
          <NavRow
            key={item.key}
            label={item.label}
            icon={item.icon}
            active={view === item.key}
            onClick={() => onNavigate(item.key)}
          />
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0 }} />

      {/* Footer */}
      <button
        onClick={onSync}
        title="Sync cards"
        style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'var(--text-mute)',
          background: 'transparent',
          border: 'none',
          borderTopWidth: 1,
          borderTopStyle: 'solid',
          borderTopColor: 'var(--border)',
          cursor: 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)' }} />
        <span style={{ flex: 1 }}>
          {cardCount != null ? `Synced · ${cardCount.toLocaleString()} cards` : 'Sync cards'}
        </span>
      </button>
    </aside>
  );
}
