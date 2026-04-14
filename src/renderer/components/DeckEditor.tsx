import { useState, useMemo, useCallback } from 'react';
import type { Card, Deck } from '../../shared/types';
import { useCards, useCardDetail } from '../hooks/useCards';
import { useDeckCards } from '../hooks/useDecks';
import { useCollectionLookup, useCollectionActions } from '../hooks/useCollection';
import { getCardTypeCategory, TYPE_ORDER } from '../lib/mana';
import CardFiltersBar from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';
import DeckStats from './DeckStats';
import ManaSymbols from './ManaSymbols';
import ExportDeckModal from './ExportDeckModal';
import ClaimDeckModal from './ClaimDeckModal';

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
  const [colVersion, setColVersion] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  // Ownership lookup for search results
  const searchCardIds = useMemo(() => result.cards.map(c => c.id), [result.cards]);
  const searchOwnedQtys = useCollectionLookup(searchCardIds, colVersion);

  // Ownership lookup for deck cards
  const deckCardIds = useMemo(() => deckCards.map(c => c.card_id), [deckCards]);
  const deckOwnedQtys = useCollectionLookup(deckCardIds, colVersion);

  const refreshCol = useCallback(() => setColVersion(v => v + 1), []);
  const { addToCollection, updateCollectionQuantity, removeFromCollection } = useCollectionActions(refreshCol);

  const handleAddToCollection = useCallback((c: Card) => {
    addToCollection(c.id);
  }, [addToCollection]);

  const handleClaimDeck = async () => {
    await window.electronAPI.claimDeckFromCollection(deckId);
    onUpdateDeck(deckId, { owned: true });
    refreshCol();
    setShowClaim(false);
  };

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
        <div className="flex-shrink-0 p-4 pb-3 space-y-3">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ash/40 pointer-events-none"
              fill="none" viewBox="0 0 16 16"
            >
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 10L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search cards to add…"
              value={filters.query || ''}
              onChange={e => updateFilters({ query: e.target.value || undefined })}
              className="w-full bg-slate-dark/40 border border-slate-mid/20 rounded-xl pl-10 pr-4 py-2.5
                         text-sm text-bone placeholder:text-ash/40
                         focus:outline-none focus:border-mana-gold/35 focus:bg-slate-dark/60 transition-all"
            />
          </div>
          <CardFiltersBar filters={filters} onUpdate={updateFilters} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <CardGrid
            cards={result.cards}
            loading={loading}
            onCardClick={showCard}
            onAddToDeck={handleAddCard}
            ownedQuantities={searchOwnedQtys}
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
      <div className="w-[45%] h-full flex flex-col" style={{ background: 'linear-gradient(180deg, #0e0e18 0%, #0a0a12 100%)' }}>
        {/* Deck header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-white/[0.05]">
          <div className="mb-4">
            <div className="flex items-center gap-3">
              {editingName ? (
                <input
                  autoFocus
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleFinishRename(); if (e.key === 'Escape') setEditingName(false); }}
                  onBlur={handleFinishRename}
                  className="bg-transparent border-b border-mana-gold/40 text-bone font-display text-xl
                             font-normal tracking-[0.12em] uppercase focus:outline-none px-0 py-0 flex-1"
                />
              ) : (
                <h2
                  className="font-display text-xl font-normal tracking-[0.12em] uppercase text-bone/90
                             cursor-pointer hover:text-mana-gold/90 transition-colors leading-none"
                  onClick={handleStartRename}
                  title="Click to rename"
                >
                  {deck?.name || 'Deck'}
                </h2>
              )}
              {deck?.owned ? (
                <span className="px-2 py-0.5 rounded-md bg-mana-green/10 border border-mana-green/25
                                 text-mana-green/80 text-[9px] font-medium uppercase tracking-wider flex-shrink-0">
                  Owned
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08]
                                 text-ash/50 text-[9px] font-medium uppercase tracking-wider flex-shrink-0">
                  Wishlist
                </span>
              )}
            </div>

            {/* Deck actions */}
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => setShowExport(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium
                           text-ash/50 hover:text-silver hover:bg-white/[0.05] transition-all cursor-pointer"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v6M2.5 4.5L5 7l2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M1 8.5h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                Export
              </button>
              {!deck?.owned && (
                <button
                  onClick={() => setShowClaim(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium
                             text-mana-gold/50 hover:text-mana-gold/80 hover:bg-mana-gold/8 transition-all cursor-pointer"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M3.5 5L5 6.5 7 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1"/>
                  </svg>
                  Claim as Owned
                </button>
              )}
            </div>
          </div>

          {/* Board tabs */}
          <div className="flex border-b border-white/[0.06] mb-4 -mx-5 px-5">
            <button
              onClick={() => setActiveBoard('main')}
              className={`pb-2.5 mr-5 text-xs font-medium tracking-wide transition-all cursor-pointer border-b-2 -mb-px
                ${activeBoard === 'main'
                  ? 'text-bone border-mana-gold/60'
                  : 'text-ash/50 border-transparent hover:text-ash'
                }`}
            >
              Main
              <span className={`ml-1.5 text-[10px] ${activeBoard === 'main' ? 'text-mana-gold/60' : 'text-ash/30'}`}>
                {mainCount}
              </span>
            </button>
            <button
              onClick={() => setActiveBoard('sideboard')}
              className={`pb-2.5 text-xs font-medium tracking-wide transition-all cursor-pointer border-b-2 -mb-px
                ${activeBoard === 'sideboard'
                  ? 'text-bone border-mana-gold/60'
                  : 'text-ash/50 border-transparent hover:text-ash'
                }`}
            >
              Sideboard
              <span className={`ml-1.5 text-[10px] ${activeBoard === 'sideboard' ? 'text-mana-gold/60' : 'text-ash/30'}`}>
                {sideCount}
              </span>
            </button>
          </div>

          <DeckStats cards={deckCards} board={activeBoard} />
        </div>

        {/* Deck card list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {groupedCards.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-ash/50 text-sm">No cards yet</p>
              <p className="text-ash/30 text-xs mt-1">Click any card on the left to add it</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedCards.map(group => (
                <div key={group.type}>
                  <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/[0.04]">
                    <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-ash/50">
                      {group.type}
                    </h4>
                    <span className="text-[10px] text-ash/30">{group.count}</span>
                  </div>
                  <div className="space-y-px">
                    {group.cards.map(dc => (
                      <div
                        key={dc.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg
                                   hover:bg-white/[0.04] transition-colors group"
                      >
                        {/* Quantity badge + controls */}
                        <div className="flex items-center gap-0.5 flex-shrink-0 w-14">
                          <button
                            onClick={() => handleQuantityChange(dc.card_id, dc.board, -1)}
                            className="w-4 h-4 rounded flex items-center justify-center text-ash/40
                                       hover:text-mana-red text-xs cursor-pointer
                                       opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                          <span className="w-5 text-center text-bone/80 text-xs font-medium tabular-nums">
                            {dc.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(dc.card_id, dc.board, 1)}
                            className="w-4 h-4 rounded flex items-center justify-center text-ash/40
                                       hover:text-mana-green text-xs cursor-pointer
                                       opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M4 1v6M1 4h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                          </button>
                        </div>

                        {/* Card name */}
                        <span
                          className="flex-1 text-silver/75 text-xs truncate cursor-pointer hover:text-bone transition-colors"
                          onClick={() => dc.card && showCard(dc.card)}
                        >
                          {dc.card?.name}
                        </span>

                        {/* Owned indicator */}
                        {(() => {
                          const owned = deckOwnedQtys[dc.card_id] ?? 0;
                          if (owned <= 0) return null;
                          const need = dc.quantity - owned;
                          if (need > 0) {
                            return (
                              <span className="text-[9px] text-mana-red/60 font-medium flex-shrink-0"
                                    title={`Own ${owned}, need ${need} more`}>
                                need {need}
                              </span>
                            );
                          }
                          return (
                            <span className="w-1.5 h-1.5 rounded-full bg-mana-gold/60 flex-shrink-0"
                                  title={`Owned: ${owned}`} />
                          );
                        })()}

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
          collectionQuantity={searchOwnedQtys[detailCard.id] ?? deckOwnedQtys[detailCard.id] ?? 0}
          onAddToCollection={handleAddToCollection}
          onUpdateCollectionQuantity={updateCollectionQuantity}
          onRemoveFromCollection={removeFromCollection}
        />
      )}

      {showExport && (
        <ExportDeckModal
          deckName={deck?.name || 'Deck'}
          deckCards={deckCards}
          onClose={() => setShowExport(false)}
        />
      )}

      {showClaim && (
        <ClaimDeckModal
          deckName={deck?.name || 'Deck'}
          deckCards={deckCards}
          ownedQuantities={deckOwnedQtys}
          onConfirm={handleClaimDeck}
          onClose={() => setShowClaim(false)}
        />
      )}
    </div>
  );
}
