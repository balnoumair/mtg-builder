import { useState } from 'react';
import type { Deck } from '../../shared/types';

interface Props {
  decks: Deck[];
  loading: boolean;
  onOpenDeck: (id: number) => void;
  onCreateDeck: (name: string) => void;
  onDeleteDeck: (id: number) => void;
  onRenameDeck: (id: number, name: string) => void;
}

export default function DeckList({ decks, loading, onOpenDeck, onCreateDeck, onDeleteDeck, onRenameDeck }: Props) {
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

  const startRename = (deck: Deck, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(deck.id);
    setRenameValue(deck.name);
  };

  const commitRename = (id: number) => {
    if (renameValue.trim() && renameValue.trim() !== decks.find(d => d.id === id)?.name) {
      onRenameDeck(id, renameValue.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-end justify-between mb-6">
        <h2 className="font-display text-2xl font-normal tracking-[0.14em] uppercase text-bone/90 leading-none">
          My Decks
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 rounded-lg bg-mana-gold/10 border border-mana-gold/25
                     text-mana-gold/80 text-xs font-medium tracking-wide
                     hover:bg-mana-gold/18 hover:text-mana-gold transition-all cursor-pointer"
        >
          New Deck
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
              placeholder="Deck name…"
              className="flex-1 bg-slate-dark/50 border border-slate-mid/30 rounded-lg px-3 py-2
                         text-sm text-bone placeholder:text-ash/40
                         focus:outline-none focus:border-mana-gold/40 transition-colors"
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-mana-gold/10 border border-mana-gold/25 text-mana-gold/80
                         text-sm font-medium hover:bg-mana-gold/18 transition-all cursor-pointer"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 text-ash/50 hover:text-silver text-sm cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-ash/50 text-sm">Loading…</div>
      ) : decks.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-ash/50 text-sm mb-2">No decks yet</p>
          <p className="text-ash/30 text-xs">Create your first deck to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {decks.map((deck, i) => (
            <div
              key={deck.id}
              className="glass glass-hover rounded-xl overflow-hidden cursor-pointer
                         transition-all duration-200 hover:scale-[1.01] animate-fade-in group"
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => renamingId !== deck.id && onOpenDeck(deck.id)}
            >
              {/* Header area */}
              <div className="h-28 bg-gradient-to-br from-obsidian to-slate-dark relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-abyss/90 to-transparent" />
                <div className="absolute bottom-3 left-4 right-4">
                  {renamingId === deck.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitRename(deck.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      onBlur={() => commitRename(deck.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-full bg-transparent border-b border-mana-gold/50 text-bone
                                 font-display font-normal text-lg tracking-[0.1em] uppercase
                                 focus:outline-none pb-0.5"
                    />
                  ) : (
                    <h3 className="font-display font-normal tracking-[0.1em] uppercase text-bone/90 text-lg leading-tight">
                      {deck.name}
                    </h3>
                  )}
                </div>
              </div>

              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-ash/50 text-xs">{deck.card_count || 0} cards</span>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={(e) => startRename(deck, e)}
                    className="text-ash/50 hover:text-silver text-xs cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M7.5 1.5L9.5 3.5L3.5 9.5H1.5V7.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    </svg>
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${deck.name}"?`)) onDeleteDeck(deck.id);
                    }}
                    className="text-ash/50 hover:text-mana-red text-xs cursor-pointer transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
