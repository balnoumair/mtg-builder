import { useState } from 'react';
import type { Deck, Tag } from '../../shared/types';
import type { View } from '../lib/types';
import { groupDecksBySetGroup } from '../../shared/deckSetGroup';
import DeckGroupLabel, { partitionDecks } from './DeckGroupLabel';
import DeckRowColorIdentity from './DeckRowColorIdentity';
import DeckSetGroupLabel from './DeckSetGroupLabel';
import TagFilterRail from './TagFilterRail';
import { tagColorTokens } from '../../shared/tagColors';

interface Props {
  view: View;
  width: number;
  onNavigate: (view: View) => void;
  decks: Deck[];
  onOpenDeck: (id: number) => void;
  onCreateDeck: (name: string, format?: string) => void;
  onDeleteDeck: (id: number) => void;
  onRenameDeck: (id: number, name: string) => void;
  activeDeckId: number | null;
  onSync: () => void;
  cardCount?: number;
  tags: Tag[];
  tagFilter: number[];
  onToggleTagFilter: (id: number) => void;
  onClearTagFilter: () => void;
  onRenameTag: (id: number, name: string) => void;
  onRecolorTag: (id: number, color: string) => void;
  onDeleteTag: (id: number) => void;
}

type NavIconKind = 'grid' | 'box' | 'stack' | 'tag';

const NAV_ITEMS: { key: View; label: string; icon: NavIconKind }[] = [
  { key: 'collection', label: 'Card Browser', icon: 'grid' },
  { key: 'my-cards', label: 'My Cards', icon: 'box' },
  { key: 'wants', label: 'Wants', icon: 'tag' },
  { key: 'decks', label: 'Decks', icon: 'stack' },
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
  width,
  onNavigate,
  decks,
  onOpenDeck,
  onCreateDeck,
  onDeleteDeck,
  onRenameDeck,
  activeDeckId,
  onSync,
  cardCount,
  tags,
  tagFilter,
  onToggleTagFilter,
  onClearTagFilter,
  onRenameTag,
  onRecolorTag,
  onDeleteTag,
}: Props) {
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    if (!newDeckName.trim()) return;
    onCreateDeck(newDeckName.trim());
    setNewDeckName('');
    setShowNewDeck(false);
  };

  const commitRename = (id: number) => {
    const current = decks.find((d) => d.id === id);
    if (renameValue.trim() && renameValue.trim() !== current?.name) {
      onRenameDeck(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const filteredDecks = query
    ? decks.filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
    : decks;
  const { owned: ownedDecks, wishlist: wishlistDecks } = partitionDecks(filteredDecks);

  const renderDeckRow = (deck: Deck) => {
    const active = activeDeckId === deck.id && view === 'deck-editor';
    const renaming = renamingId === deck.id;
    return (
      <div
        key={deck.id}
        className="group"
        onClick={() => !renaming && onOpenDeck(deck.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 8px',
          borderRadius: 'var(--radius-sm)',
          cursor: renaming ? 'default' : 'pointer',
          background: active ? 'var(--bg-row-sel)' : 'transparent',
          color: active ? 'var(--text)' : 'var(--text-dim)',
          marginBottom: 1,
        }}
        onMouseEnter={(e) => {
          if (!active && !renaming) e.currentTarget.style.background = 'var(--bg-row-hov)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
      >
        <DeckRowColorIdentity colors={deck.color_identity} compact />
        {renaming ? (
          <input
            autoFocus
            value={renameValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(deck.id);
              if (e.key === 'Escape') setRenamingId(null);
            }}
            onBlur={() => commitRename(deck.id)}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
            }}
          />
        ) : (
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
        )}
        {!renaming && deck.tags && deck.tags.length > 0 && (
          <span
            title={deck.tags.map((t) => t.name).join(', ')}
            style={{ display: 'inline-flex', gap: 2, flexShrink: 0 }}
          >
            {deck.tags.slice(0, 4).map((tag) => (
              <span
                key={tag.id}
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: tagColorTokens(tag.color).ink,
                }}
              />
            ))}
          </span>
        )}
        {!renaming && (
          <div
            style={{ display: 'inline-flex', gap: 4, opacity: 0, transition: 'opacity 120ms' }}
            className="group-hover:opacity-100"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenamingId(deck.id);
                setRenameValue(deck.name);
              }}
              style={iconBtn}
              title="Rename"
            >
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                <path
                  d="M7.5 1.5L9.5 3.5L3.5 9.5H1.5V7.5L7.5 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${deck.name}"?`)) onDeleteDeck(deck.id);
              }}
              style={iconBtn}
              title="Delete"
            >
              <svg width="10" height="10" viewBox="0 0 11 11" fill="none">
                <path
                  d="M2 3h7M4 3V2h3v1M3 3l.5 7h4l.5-7"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  // An empty section is hidden outright; the "No decks yet" / "No matches"
  // message below covers the case where nothing is left at all.
  const renderDeckSection = (group: 'owned' | 'wishlist', sectionDecks: Deck[]) => {
    if (sectionDecks.length === 0) return null;
    const subgroups = groupDecksBySetGroup(sectionDecks);
    return (
      <>
        <DeckGroupLabel group={group} count={sectionDecks.length} compact />
        {subgroups.map(({ group: setGroup, decks: subgroupDecks }) => (
          <div key={`${group}-${setGroup.kind}-${setGroup.label}`}>
            <DeckSetGroupLabel label={setGroup.label} compact />
            {subgroupDecks.map(renderDeckRow)}
          </div>
        ))}
      </>
    );
  };

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

      {/* Tag rail */}
      <TagFilterRail
        tags={tags}
        selectedIds={tagFilter}
        onToggle={onToggleTagFilter}
        onClear={onClearTagFilter}
        onRename={onRenameTag}
        onRecolor={onRecolorTag}
        onDelete={onDeleteTag}
      />

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
            {query || tagFilter.length > 0 ? 'No matches' : 'No decks yet'}
          </p>
        ) : (
          <>
            {renderDeckSection('wishlist', wishlistDecks)}
            {renderDeckSection('owned', ownedDecks)}
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

const iconBtn: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-mute)',
  cursor: 'pointer',
  display: 'inline-grid',
  placeItems: 'center',
  padding: 0,
  flexShrink: 0,
};
