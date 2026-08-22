import { useEffect, useMemo, useRef, useState } from 'react';
import type { Deck } from '../../shared/types';
import { groupDecksBySetGroup } from '../../shared/deckSetGroup';
import DeckGroupLabel, { partitionDecks } from './DeckGroupLabel';
import DeckRowColorIdentity from './DeckRowColorIdentity';
import DeckSetGroupLabel from './DeckSetGroupLabel';

interface Props {
  decks: Deck[];
  activeDeckId: number | null;
  onOpenDeck: (id: number) => void;
  onClose: () => void;
}

export default function DeckSwitcherModal({ decks, activeDeckId, onOpenDeck, onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredDecks = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return decks;
    return decks.filter((deck) =>
      [deck.name, deck.format, deck.set_group?.label]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalized)),
    );
  }, [decks, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (filteredDecks.length === 0) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex((index) => Math.min(index, filteredDecks.length - 1));
    }
  }, [filteredDecks.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const openSelectedDeck = () => {
    const deck = filteredDecks[selectedIndex];
    if (deck) onOpenDeck(deck.id);
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(filteredDecks.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      openSelectedDeck();
    }
  };

  const renderDeckSection = (group: 'owned' | 'wishlist', sectionDecks: Deck[]) => {
    if (sectionDecks.length === 0) return null;
    const subgroups = groupDecksBySetGroup(sectionDecks);

    return (
      <section key={group}>
        <DeckGroupLabel group={group} count={sectionDecks.length} compact />
        {subgroups.map(({ group: setGroup, decks: subgroupDecks }) => (
          <div key={`${group}-${setGroup.kind}-${setGroup.label}`}>
            <DeckSetGroupLabel label={setGroup.label} compact />
            {subgroupDecks.map((deck) => {
              const index = filteredDecks.findIndex((candidate) => candidate.id === deck.id);
              const selected = index === selectedIndex;
              const active = deck.id === activeDeckId;
              return (
                <div
                  key={deck.id}
                  role="option"
                  aria-selected={selected}
                  onClick={() => onOpenDeck(deck.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    background: selected ? 'var(--bg-row-hov)' : active ? 'var(--bg-row-sel)' : 'transparent',
                    color: selected || active ? 'var(--text)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    outline: selected ? '1px solid var(--border-strong)' : 'none',
                  }}
                >
                  <DeckRowColorIdentity colors={deck.color_identity} />
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {deck.name}
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--text-mute)',
                    }}
                  >
                    {deck.format || `${deck.card_count ?? 0} cards`}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </section>
    );
  };

  const { owned: ownedDecks, wishlist: wishlistDecks } = partitionDecks(filteredDecks);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 120,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'min(18vh, 140px) 24px 24px',
        background: 'rgba(0,0,0,0.58)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Switch deck"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 560px)',
          maxHeight: 'min(620px, 72vh)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 12,
          boxShadow: '0 28px 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
          color: 'var(--text)',
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              padding: '9px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.55, flexShrink: 0 }}>
              <circle cx="5.5" cy="5.5" r="3.8" stroke="currentColor" strokeWidth="1.2" />
              <path d="M8.4 8.4L11.3 11.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type a deck name…"
              aria-label="Search decks"
              style={{
                flex: 1,
                minWidth: 0,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--text)',
                fontSize: 14,
              }}
            />
            <kbd
              style={{
                flexShrink: 0,
                padding: '2px 5px',
                border: '1px solid var(--border)',
                borderRadius: 3,
                background: 'var(--bg-chip)',
                color: 'var(--text-mute)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
              }}
            >
              esc
            </kbd>
          </div>
        </div>

        <div
          role="listbox"
          aria-label="Decks"
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 10px 12px' }}
        >
          {filteredDecks.length === 0 ? (
            <p style={{ margin: 0, padding: '24px 10px', textAlign: 'center', color: 'var(--text-mute)', fontSize: 12 }}>
              No decks match “{query}”.
            </p>
          ) : (
            <>
              {renderDeckSection('owned', ownedDecks)}
              {renderDeckSection('wishlist', wishlistDecks)}
            </>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '9px 14px',
            borderTop: '1px solid var(--border)',
            color: 'var(--text-faint)',
            fontFamily: 'var(--font-mono)',
            fontSize: 9.5,
          }}
        >
          <span><b style={{ color: 'var(--text-mute)' }}>↑↓</b> navigate</span>
          <span><b style={{ color: 'var(--text-mute)' }}>↵</b> open</span>
          <span style={{ marginLeft: 'auto' }}>⌘E / Ctrl+E</span>
        </div>
      </div>
    </div>
  );
}
