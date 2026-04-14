import { useState } from 'react';
import type { Deck } from '../../shared/types';
import type { View } from '../lib/types';

interface Props {
  view: View;
  onNavigate: (view: View) => void;
  decks: Deck[];
  onOpenDeck: (id: number) => void;
  onCreateDeck: (name: string, format?: string) => void;
  activeDeckId: number | null;
  onSync: () => void;
}

function IconCollection() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="4" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="4" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" strokeDasharray="0"/>
      <path d="M4 1h7a1.5 1.5 0 0 1 1.5 1.5V12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

function IconMyCards() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="2" y="3" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5 1.5h5M4 6.5l3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconDecks() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8" y="1" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="1" y="8" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
      <rect x="8" y="8" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

function IconSync() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M11.5 6.5A5 5 0 1 1 6.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M6.5 1.5L9 4M6.5 1.5L9.5 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
      <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export default function Sidebar({ view, onNavigate, decks, onOpenDeck, onCreateDeck, activeDeckId, onSync }: Props) {
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  const handleCreate = () => {
    if (!newDeckName.trim()) return;
    onCreateDeck(newDeckName.trim());
    setNewDeckName('');
    setShowNewDeck(false);
  };

  return (
    <aside className="w-56 h-full flex flex-col pt-10 border-r border-white/[0.05]"
      style={{ background: 'linear-gradient(180deg, #0e0e16 0%, #0a0a12 100%)' }}>

      {/* Brand */}
      <div className="px-5 mb-7">
        <h1 className="font-display text-sm font-normal tracking-[0.18em] text-bone/90 uppercase">
          MTG Builder
        </h1>
      </div>

      {/* Main nav */}
      <nav className="px-3 space-y-0.5">
        <NavItem
          label="Collection"
          icon={<IconCollection />}
          active={view === 'collection'}
          onClick={() => onNavigate('collection')}
        />
        <NavItem
          label="My Cards"
          icon={<IconMyCards />}
          active={view === 'my-cards'}
          onClick={() => onNavigate('my-cards')}
        />
        <NavItem
          label="My Decks"
          icon={<IconDecks />}
          active={view === 'decks'}
          onClick={() => onNavigate('decks')}
        />
      </nav>

      {/* Divider */}
      <div className="mx-4 my-4 border-t border-white/[0.05]" />

      {/* Decks section */}
      <div className="px-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-ash/50">Decks</span>
          <button
            onClick={() => setShowNewDeck(v => !v)}
            className="w-5 h-5 rounded flex items-center justify-center text-ash/50 hover:text-silver
                       hover:bg-slate-mid/20 transition-all cursor-pointer"
            title="New deck"
          >
            <IconPlus />
          </button>
        </div>

        {showNewDeck && (
          <div className="mb-2 px-1">
            <input
              autoFocus
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowNewDeck(false);
              }}
              placeholder="Deck name…"
              className="w-full bg-slate-dark/50 border border-slate-mid/30 rounded-lg px-3 py-1.5
                         text-xs text-bone placeholder:text-ash/40
                         focus:outline-none focus:border-mana-gold/40 transition-colors"
            />
          </div>
        )}

        <div className="space-y-0.5 overflow-y-auto flex-1">
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => onOpenDeck(deck.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all cursor-pointer group
                ${activeDeckId === deck.id
                  ? 'bg-mana-gold/8 border-l-2 border-mana-gold/60 pl-2.5 text-mana-gold/90'
                  : 'text-silver/60 hover:text-silver hover:bg-white/[0.04] border-l-2 border-transparent'
                }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-medium truncate">{deck.name}</span>
                {deck.owned && (
                  <span className="w-1.5 h-1.5 rounded-full bg-mana-green/50 flex-shrink-0" title="Owned" />
                )}
              </div>
              {deck.format && (
                <div className={`text-[10px] mt-0.5 capitalize ${activeDeckId === deck.id ? 'text-mana-gold/50' : 'text-ash/40'}`}>
                  {deck.format}
                </div>
              )}
            </button>
          ))}
          {decks.length === 0 && !showNewDeck && (
            <p className="text-[11px] text-ash/30 px-3 py-2 italic">No decks yet</p>
          )}
        </div>
      </div>

      {/* Sync */}
      <div className="px-3 pb-5 pt-2">
        <button
          onClick={onSync}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium
                     text-ash/50 hover:text-silver hover:bg-white/[0.04] transition-all cursor-pointer"
        >
          <IconSync />
          Sync Cards
        </button>
      </div>
    </aside>
  );
}

function NavItem({ label, icon, active, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium
                  transition-all cursor-pointer border-l-2
                  ${active
                    ? 'bg-white/[0.06] text-bone border-mana-gold/60'
                    : 'text-ash/60 hover:text-silver hover:bg-white/[0.04] border-transparent'
                  }`}
    >
      <span className={active ? 'text-mana-gold/80' : ''}>{icon}</span>
      {label}
    </button>
  );
}
