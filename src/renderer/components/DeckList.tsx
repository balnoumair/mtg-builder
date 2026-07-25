import { useState } from 'react';
import type { Deck, Tag } from '../../shared/types';
import { groupDecksBySetGroup } from '../../shared/deckSetGroup';
import DeckGroupLabel, { partitionDecks } from './DeckGroupLabel';
import DeckRowColorIdentity from './DeckRowColorIdentity';
import DeckSetGroupLabel from './DeckSetGroupLabel';
import DeckTag from './DeckTag';

interface Props {
  decks: Deck[];
  loading: boolean;
  onOpenDeck: (id: number) => void;
  onCreateDeck: (name: string) => void;
  onDeleteDeck: (id: number) => void;
  onRenameDeck: (id: number, name: string) => void;
  /** Decks before the tag filter, so the header can say what is hidden. */
  totalDeckCount: number;
  filterTags: Tag[];
  onClearTagFilter: () => void;
}

export default function DeckList({
  decks,
  loading,
  onOpenDeck,
  onCreateDeck,
  onDeleteDeck,
  onRenameDeck,
  totalDeckCount,
  filterTags,
  onClearTagFilter,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateDeck(name.trim());
    setName('');
    setShowCreate(false);
  };

  const commitRename = (id: number) => {
    const current = decks.find((d) => d.id === id);
    if (renameValue.trim() && renameValue.trim() !== current?.name) {
      onRenameDeck(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  const { owned: ownedDecks, wishlist: wishlistDecks } = partitionDecks(decks);

  const renderDeckRow = (deck: Deck, rowIndex: number) => {
    const renaming = renamingId === deck.id;
    return (
      <div
        key={deck.id}
        className="group"
        onClick={() => !renaming && onOpenDeck(deck.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 14px',
          height: 44,
          borderTop: rowIndex ? '1px solid var(--border)' : 'none',
          cursor: renaming ? 'default' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!renaming) e.currentTarget.style.background = 'var(--bg-row-hov)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <DeckRowColorIdentity colors={deck.color_identity} />
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
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px 8px',
              color: 'var(--text)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        ) : (
          <span
            style={{
              flex: '0 1 auto',
              minWidth: 0,
              fontSize: 13,
              fontWeight: 500,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {deck.name}
          </span>
        )}
        {!renaming && deck.tags && deck.tags.length > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {deck.tags.slice(0, 3).map((tag) => (
              <DeckTag key={tag.id} tag={tag} />
            ))}
            {deck.tags.length > 3 && (
              <span
                title={deck.tags.slice(3).map((t) => t.name).join(', ')}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}
              >
                +{deck.tags.length - 3}
              </span>
            )}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 12 }} />
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-mute)',
            width: 90,
          }}
        >
          {deck.format || ''}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-mute)',
            width: 50,
            textAlign: 'right',
          }}
        >
          {deck.card_count ?? 0}
        </span>
        <div
          style={{ display: 'inline-flex', gap: 6, opacity: 0, transition: 'opacity 120ms' }}
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
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
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
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
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
      </div>
    );
  };

  // An empty section is hidden outright; the whole-list empty state below
  // covers the case where nothing is left at all.
  const renderDeckSection = (group: 'owned' | 'wishlist', sectionDecks: Deck[]) => {
    if (sectionDecks.length === 0) return null;
    const subgroups = groupDecksBySetGroup(sectionDecks);

    return (
      <section style={{ marginBottom: 20 }}>
        <DeckGroupLabel group={group} count={sectionDecks.length} />
        {
          subgroups.map(({ group: setGroup, decks: subgroupDecks }, subgroupIndex) => (
            <div key={`${group}-${setGroup.kind}-${setGroup.label}`} style={{ marginTop: subgroupIndex ? 14 : 0 }}>
              <DeckSetGroupLabel label={setGroup.label} />
              <div
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}
              >
                {subgroupDecks.map((deck, i) => renderDeckRow(deck, i))}
              </div>
            </div>
          ))
        }
      </section>
    );
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        height: '100%',
      }}
    >
      <div style={{ padding: 'var(--pad)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            Decks
          </h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            {filterTags.length > 0 ? `${decks.length}/${totalDeckCount}` : decks.length}
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              padding: '5px 11px',
              background: 'var(--bg-chip)',
              border: '1px solid var(--border-strong)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            + New Deck
          </button>
        </div>


        {filterTags.length > 0 && (
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-mute)' }}>Tagged</span>
            {filterTags.map((tag) => (
              <DeckTag key={tag.id} tag={tag} active />
            ))}
            <button
              onClick={onClearTagFilter}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                marginLeft: 2,
                color: 'var(--text-mute)',
                fontSize: 11,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Show all
            </button>
          </div>
        )}

        {showCreate && (
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') {
                  setShowCreate(false);
                  setName('');
                }
              }}
              placeholder="Deck name…"
              style={{
                flex: 1,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 10px',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreate}
              style={{
                padding: '6px 12px',
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent-line)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreate(false);
                setName('');
              }}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                color: 'var(--text-mute)',
                border: 'none',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--pad)' }}>
        {loading ? (
          <div style={{ color: 'var(--text-mute)', fontSize: 12 }}>Loading…</div>
        ) : decks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
              {filterTags.length > 0 ? 'No decks with these tags' : 'No decks yet'}
            </p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
              {filterTags.length > 0
                ? 'Pick a different tag, or show all decks.'
                : 'Create your first deck to get started'}
            </p>
          </div>
        ) : (
          <>
            {renderDeckSection('wishlist', wishlistDecks)}
            {renderDeckSection('owned', ownedDecks)}
          </>
        )}
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-mute)',
  cursor: 'pointer',
  display: 'inline-grid',
  placeItems: 'center',
  padding: 0,
};
