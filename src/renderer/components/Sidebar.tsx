import { useState } from 'react';
import type { Deck } from '../../shared/types';
import type { View } from '../lib/types';
import DeckGroupLabel, { partitionDecks } from './DeckGroupLabel';
import DeckRowColorIdentity from './DeckRowColorIdentity';

interface Props {
  view: View;
  onNavigate: (view: View) => void;
  decks: Deck[];
  onOpenDeck: (id: number) => void;
  onCreateDeck: (name: string, format?: string) => void;
  activeDeckId: number | null;
  onSync: () => void;
  cardCount?: number;
}

const NAV_ITEMS: { key: View; label: string; icon: 'grid' | 'box' | 'stack' }[] = [
  { key: 'collection', label: 'Card Browser', icon: 'grid' },
  { key: 'my-cards', label: 'My Cards', icon: 'box' },
  { key: 'decks', label: 'Decks', icon: 'stack' },
];

function NavIcon({ icon }: { icon: 'grid' | 'box' | 'stack' }) {
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
  };
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" strokeWidth="1.1">
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
  icon: 'grid' | 'box' | 'stack';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        padding: '5px 8px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        background: active ? 'var(--bg-row-sel)' : 'transparent',
        color: active ? 'var(--text)' : 'var(--text-dim)',
        fontSize: 12,
        marginBottom: 1,
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
  onNavigate,
  decks,
  onOpenDeck,
  onCreateDeck,
  activeDeckId,
  onSync,
  cardCount,
}: Props) {
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [query, setQuery] = useState('');

  const handleCreate = () => {
    if (!newDeckName.trim()) return;
    onCreateDeck(newDeckName.trim());
    setNewDeckName('');
    setShowNewDeck(false);
  };

  const filteredDecks = query
    ? decks.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
    : decks;
  const { owned: ownedDecks, wishlist: wishlistDecks } = partitionDecks(filteredDecks);

  const renderDeckRow = (deck: Deck) => {
    const active = activeDeckId === deck.id && view === 'deck-editor';
    return (
      <div
        key={deck.id}
        onClick={() => onOpenDeck(deck.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          background: active ? 'var(--bg-row-sel)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--text-dim)',
          marginBottom: 1,
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = 'var(--bg-row-hov)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
      >
        <DeckRowColorIdentity colors={deck.color_identity} compact />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {deck.name}
        </span>
      </div>
    );
  };

  return (
    <aside
      style={{
        width: 'var(--sidebar-w)',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        flexShrink: 0,
        height: '100%',
      }}
    >
      {/* Search */}
      <div style={{ padding: '10px 12px 8px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 9px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-input)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
            <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7.5 7.5L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          <kbd
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              padding: '0 4px',
              borderRadius: 3,
              background: 'var(--bg-chip)',
              color: 'var(--text-mute)',
              border: '1px solid var(--border)',
            }}
          >
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: '0 8px 6px' }}>
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

      {/* Decks header */}
      <div
        style={{
          padding: '10px 14px 4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-mute)',
          }}
        >
          Decks
        </span>
        <button
          title="New deck"
          onClick={() => setShowNewDeck((v) => !v)}
          style={{
            width: 16,
            height: 16,
            borderRadius: 3,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-mute)',
            fontSize: 13,
            lineHeight: 1,
            padding: 0,
          }}
        >
          +
        </button>
      </div>

      {showNewDeck && (
        <div style={{ padding: '0 12px 6px' }}>
          <input
            autoFocus
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowNewDeck(false);
            }}
            placeholder="Deck name…"
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              borderRadius: 'var(--radius-sm)',
              padding: '5px 9px',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Decks list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 10px', minHeight: 0 }}>
        {filteredDecks.length === 0 && !showNewDeck ? (
          <p style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
            {query ? 'No matches' : 'No decks yet'}
          </p>
        ) : (
          <>
            <DeckGroupLabel group="owned" count={ownedDecks.length} compact />
            {ownedDecks.length > 0 ? (
              ownedDecks.map(renderDeckRow)
            ) : (
              <p style={{ padding: '2px 10px 8px', fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                No owned decks
              </p>
            )}
            <DeckGroupLabel group="wishlist" count={wishlistDecks.length} compact />
            {wishlistDecks.length > 0 ? (
              wishlistDecks.map(renderDeckRow)
            ) : (
              <p style={{ padding: '2px 10px 8px', fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                No wishlist decks
              </p>
            )}
          </>
        )}
      </div>

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
