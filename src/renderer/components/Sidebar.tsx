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
}

export default function Sidebar({ view, onNavigate, decks, onOpenDeck, onCreateDeck, activeDeckId }: Props) {
  const [showNewDeck, setShowNewDeck] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');

  const handleCreate = () => {
    if (!newDeckName.trim()) return;
    onCreateDeck(newDeckName.trim());
    setNewDeckName('');
    setShowNewDeck(false);
  };

  return (
    <aside className="w-60 h-full bg-abyss border-r border-white/5 flex flex-col pt-10">
      <div className="px-5 mb-6">
        <h1 className="font-display text-lg font-bold text-bone tracking-wider">
          MTG Builder
        </h1>
      </div>

      <nav className="px-3 space-y-1">
        <NavItem
          label="Collection"
          icon="◆"
          active={view === 'collection'}
          onClick={() => onNavigate('collection')}
        />
        <NavItem
          label="My Decks"
          icon="▣"
          active={view === 'decks'}
          onClick={() => onNavigate('decks')}
        />
      </nav>

      <div className="px-3 mt-6">
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="text-ash text-xs font-medium uppercase tracking-wider">Decks</span>
          <button
            onClick={() => setShowNewDeck(true)}
            className="text-ash hover:text-bone text-lg leading-none cursor-pointer transition-colors"
            title="New deck"
          >
            +
          </button>
        </div>

        {showNewDeck && (
          <div className="mb-2 px-1">
            <input
              autoFocus
              value={newDeckName}
              onChange={e => setNewDeckName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNewDeck(false); }}
              placeholder="Deck name..."
              className="w-full bg-obsidian border border-slate-mid/50 rounded-lg px-3 py-1.5
                         text-sm text-bone placeholder:text-ash/50
                         focus:outline-none focus:border-mana-gold/40"
            />
          </div>
        )}

        <div className="space-y-0.5 overflow-y-auto max-h-[calc(100vh-260px)]">
          {decks.map(deck => (
            <button
              key={deck.id}
              onClick={() => onOpenDeck(deck.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all cursor-pointer
                ${activeDeckId === deck.id
                  ? 'bg-mana-gold/10 text-mana-gold border border-mana-gold/20'
                  : 'text-silver hover:bg-obsidian hover:text-bone border border-transparent'
                }`}
            >
              <div className="font-medium truncate">{deck.name}</div>
              {deck.format && (
                <div className="text-xs text-ash mt-0.5 capitalize">{deck.format}</div>
              )}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function NavItem({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                  transition-all cursor-pointer
                  ${active
                    ? 'bg-obsidian text-bone'
                    : 'text-ash hover:text-silver hover:bg-obsidian/50'
                  }`}
    >
      <span className="text-xs">{icon}</span>
      {label}
    </button>
  );
}
