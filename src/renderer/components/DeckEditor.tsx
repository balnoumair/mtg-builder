import { useState, useMemo } from 'react';
import type { Card, Deck } from '../../shared/types';
import { useCards, useCardDetail } from '../hooks/useCards';
import { useDeckCards } from '../hooks/useDecks';
import { getCardTypeCategory, TYPE_ORDER } from '../lib/mana';
import CardFiltersBar from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';
import DeckStats from './DeckStats';
import ManaSymbols from './ManaSymbols';

interface Props {
  deckId: number;
  decks: Deck[];
  onUpdateDeck: (id: number, updates: Partial<Deck>) => void;
  onDeckCardsChanged: () => void;
}

export default function DeckEditor({ deckId, decks, onUpdateDeck, onDeckCardsChanged }: Props) {
  const deck = decks.find(d => d.id === deckId);
  const { filters, updateFilters, setPage, result, loading } = useCards();
  const { cards: deckCards, addCard, updateQuantity, removeCard } = useDeckCards(deckId);
  const { card: detailCard, printings, open: detailOpen, showCard, close: closeDetail } = useCardDetail();
  const [activeBoard, setActiveBoard] = useState<'main' | 'sideboard'>('main');
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const handleAddCard = async (card: Card) => {
    await addCard(card.id, activeBoard);
    onDeckCardsChanged();
  };

  const handleQuantityChange = async (cardId: string, board: string, delta: number) => {
    const dc = deckCards.find(c => c.card_id === cardId && c.board === board);
    if (!dc) return;
    const newQty = dc.quantity + delta;
    if (newQty <= 0) {
      await removeCard(cardId, board);
    } else {
      await updateQuantity(cardId, board, newQty);
    }
    onDeckCardsChanged();
  };

  const boardCards = useMemo(() => {
    return deckCards.filter(c => c.board === activeBoard);
  }, [deckCards, activeBoard]);

  const groupedCards = useMemo(() => {
    const groups: Record<string, typeof boardCards> = {};
    for (const dc of boardCards) {
      if (!dc.card) continue;
      const cat = getCardTypeCategory(dc.card.type_line);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(dc);
    }
    return TYPE_ORDER
      .filter(t => groups[t]?.length)
      .map(t => ({ type: t, cards: groups[t], count: groups[t].reduce((s, c) => s + c.quantity, 0) }));
  }, [boardCards]);

  const mainCount = deckCards.filter(c => c.board === 'main').reduce((s, c) => s + c.quantity, 0);
  const sideCount = deckCards.filter(c => c.board === 'sideboard').reduce((s, c) => s + c.quantity, 0);

  const handleStartRename = () => {
    setNameValue(deck?.name || '');
    setEditingName(true);
  };

  const handleFinishRename = () => {
    if (nameValue.trim() && nameValue.trim() !== deck?.name) {
      onUpdateDeck(deckId, { name: nameValue.trim() });
    }
    setEditingName(false);
  };

  return (
    <div className="h-full flex">
      {/* Left: Card search */}
      <div className="w-[55%] h-full flex flex-col border-r border-white/5">
        <div className="flex-shrink-0 p-4 pb-0 space-y-3">
          <input
            type="text"
            placeholder="Search cards to add..."
            value={filters.query || ''}
            onChange={e => updateFilters({ query: e.target.value || undefined })}
            className="w-full bg-obsidian border border-slate-mid/30 rounded-xl px-4 py-2.5
                       text-sm text-bone placeholder:text-ash/50
                       focus:outline-none focus:border-mana-gold/40 transition-colors"
          />
          <CardFiltersBar filters={filters} onUpdate={updateFilters} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <CardGrid
            cards={result.cards}
            loading={loading}
            onCardClick={showCard}
            onAddToDeck={handleAddCard}
          />

          {Math.ceil(result.total / (filters.pageSize || 60)) > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pb-2">
              <button
                onClick={() => setPage((filters.page || 1) - 1)}
                disabled={(filters.page || 1) <= 1}
                className="px-3 py-1 rounded-lg text-xs text-ash hover:text-bone
                           disabled:opacity-30 cursor-pointer hover:bg-obsidian"
              >
                Prev
              </button>
              <span className="text-ash text-xs">
                {filters.page || 1} / {Math.ceil(result.total / (filters.pageSize || 60))}
              </span>
              <button
                onClick={() => setPage((filters.page || 1) + 1)}
                disabled={(filters.page || 1) >= Math.ceil(result.total / (filters.pageSize || 60))}
                className="px-3 py-1 rounded-lg text-xs text-ash hover:text-bone
                           disabled:opacity-30 cursor-pointer hover:bg-obsidian"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Deck contents */}
      <div className="w-[45%] h-full flex flex-col bg-abyss/50">
        {/* Deck header */}
        <div className="flex-shrink-0 p-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            {editingName ? (
              <input
                autoFocus
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingName(false); }}
                onBlur={handleFinishRename}
                className="bg-transparent border-b border-mana-gold/40 text-bone font-display text-lg font-bold
                           focus:outline-none px-0 py-0"
              />
            ) : (
              <h2
                className="font-display text-lg font-bold text-bone cursor-pointer hover:text-mana-gold transition-colors"
                onClick={handleStartRename}
                title="Click to rename"
              >
                {deck?.name || 'Deck'}
              </h2>
            )}
            {deck?.format && (
              <span className="px-2 py-0.5 rounded-md bg-mana-gold/10 text-mana-gold text-xs capitalize">
                {deck.format}
              </span>
            )}
          </div>

          {/* Board tabs */}
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => setActiveBoard('main')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${activeBoard === 'main'
                  ? 'bg-obsidian text-bone'
                  : 'text-ash hover:text-silver'
                }`}
            >
              Main Deck ({mainCount})
            </button>
            <button
              onClick={() => setActiveBoard('sideboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${activeBoard === 'sideboard'
                  ? 'bg-obsidian text-bone'
                  : 'text-ash hover:text-silver'
                }`}
            >
              Sideboard ({sideCount})
            </button>
          </div>

          <DeckStats cards={deckCards} board={activeBoard} />
        </div>

        {/* Deck card list */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedCards.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ash text-sm">No cards in {activeBoard}</p>
              <p className="text-ash/50 text-xs mt-1">Search and add cards from the left panel</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedCards.map(group => (
                <div key={group.type}>
                  <h4 className="text-ash text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center gap-2">
                    {group.type}
                    <span className="text-ash/50">({group.count})</span>
                  </h4>
                  <div className="space-y-0.5">
                    {group.cards.map(dc => (
                      <div
                        key={dc.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg
                                   hover:bg-obsidian/50 transition-colors group"
                      >
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleQuantityChange(dc.card_id, dc.board, -1)}
                            className="w-5 h-5 rounded flex items-center justify-center
                                       text-ash hover:text-mana-red text-xs cursor-pointer
                                       opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            −
                          </button>
                          <span className="w-5 text-center text-bone text-sm font-medium">
                            {dc.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(dc.card_id, dc.board, 1)}
                            className="w-5 h-5 rounded flex items-center justify-center
                                       text-ash hover:text-mana-green text-xs cursor-pointer
                                       opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            +
                          </button>
                        </div>

                        {/* Card name */}
                        <span
                          className="flex-1 text-silver text-sm truncate cursor-pointer hover:text-bone transition-colors"
                          onClick={() => dc.card && showCard(dc.card)}
                        >
                          {dc.card?.name}
                        </span>

                        {/* Mana cost */}
                        <ManaSymbols cost={dc.card?.mana_cost || ''} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card detail modal */}
      {detailOpen && detailCard && (
        <CardDetail
          card={detailCard}
          printings={printings}
          onClose={closeDetail}
          onAddToDeck={handleAddCard}
        />
      )}
    </div>
  );
}
