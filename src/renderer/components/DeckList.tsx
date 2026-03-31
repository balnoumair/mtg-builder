import { useState } from 'react';
import type { Deck } from '../../shared/types';

interface Props {
  decks: Deck[];
  loading: boolean;
  onOpenDeck: (id: number) => void;
  onCreateDeck: (name: string, format?: string) => void;
  onDeleteDeck: (id: number) => void;
}

const FORMATS = ['', 'standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper', 'commander'];

export default function DeckList({ decks, loading, onOpenDeck, onCreateDeck, onDeleteDeck }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [format, setFormat] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    onCreateDeck(name.trim(), format || undefined);
    setName('');
    setFormat('');
    setShowCreate(false);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold text-bone">My Decks</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 rounded-xl bg-mana-gold/15 border border-mana-gold/25
                     text-mana-gold text-sm font-medium
                     hover:bg-mana-gold/25 transition-all cursor-pointer"
        >
          + New Deck
        </button>
      </div>

      {/* Create deck form */}
      {showCreate && (
        <div className="glass rounded-xl p-4 mb-6 animate-fade-in">
          <div className="flex gap-3">
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
              placeholder="Deck name..."
              className="flex-1 bg-obsidian border border-slate-mid/30 rounded-lg px-3 py-2
                         text-sm text-bone placeholder:text-ash/50
                         focus:outline-none focus:border-mana-gold/40"
            />
            <select
              value={format}
              onChange={e => setFormat(e.target.value)}
              className="bg-obsidian border border-slate-mid/30 rounded-lg px-3 py-2
                         text-sm text-silver focus:outline-none cursor-pointer"
            >
              <option value="">No format</option>
              {FORMATS.filter(Boolean).map(f => (
                <option key={f} value={f} className="capitalize">{f}</option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-mana-green/20 text-mana-green text-sm font-medium
                         hover:bg-mana-green/30 transition-all cursor-pointer"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 text-ash hover:text-bone text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-ash text-sm">Loading...</div>
      ) : decks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-ash text-sm mb-2">No decks yet</p>
          <p className="text-ash/60 text-xs">Create your first deck to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {decks.map((deck, i) => (
            <div
              key={deck.id}
              className="glass glass-hover rounded-xl overflow-hidden cursor-pointer
                         transition-all duration-200 hover:scale-[1.01] animate-fade-in group"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => onOpenDeck(deck.id)}
            >
              {/* Deck card art background */}
              <div className="h-28 bg-gradient-to-br from-obsidian to-slate-dark relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-abyss/90 to-transparent" />
                <div className="absolute bottom-3 left-4">
                  <h3 className="font-display font-bold text-bone text-lg">{deck.name}</h3>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {deck.format && (
                    <span className="px-2 py-0.5 rounded-md bg-mana-gold/10 text-mana-gold text-xs capitalize">
                      {deck.format}
                    </span>
                  )}
                  <span className="text-ash text-xs">
                    {deck.card_count || 0} cards
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${deck.name}"?`)) onDeleteDeck(deck.id);
                  }}
                  className="text-ash hover:text-mana-red text-xs opacity-0 group-hover:opacity-100
                             transition-all cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
