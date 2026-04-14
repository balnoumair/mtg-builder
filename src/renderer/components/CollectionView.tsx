import { useMemo, useCallback } from 'react';
import type { Card } from '../../shared/types';
import { useCollection, useCollectionActions } from '../hooks/useCollection';
import { useCardDetail } from '../hooks/useCards';
import CardFiltersBar from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';

interface Props {
  onNavigateToBrowse: () => void;
}

export default function CollectionView({ onNavigateToBrowse }: Props) {
  const { filters, updateFilters, setPage, result, stats, loading, refresh } = useCollection();
  const { card, printings, open, showCard, close } = useCardDetail();
  const { addToCollection, updateCollectionQuantity, removeFromCollection } = useCollectionActions(refresh);

  const totalPages = Math.ceil(result.total / (filters.pageSize || 60));
  const currentPage = filters.page || 1;

  // Build ownedQuantities map from collection results
  const ownedQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cc of result.cards) {
      map[cc.card_id] = cc.quantity;
    }
    return map;
  }, [result.cards]);

  // Extract just the Card objects for CardGrid
  const cards = useMemo(() => result.cards.map(cc => cc.card), [result.cards]);

  const handleAddToCollection = useCallback((card: Card) => {
    addToCollection(card.id);
  }, [addToCollection]);

  // Get the current detail card's collection quantity
  const detailCollectionQty = card ? (ownedQuantities[card.id] ?? 0) : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-5 pb-4 space-y-4">
        <div className="flex items-end gap-3 mb-1">
          <h2 className="font-display text-2xl font-normal tracking-[0.14em] text-bone/90 uppercase leading-none">
            My Cards
          </h2>
          <span className="text-ash/50 text-xs tracking-wide pb-0.5">{result.total.toLocaleString()} cards</span>
        </div>

        {/* Stats row */}
        {stats.uniqueCards > 0 && (
          <div className="flex gap-3">
            <StatBlock label="Unique" value={stats.uniqueCards.toLocaleString()} />
            <StatBlock label="Total Copies" value={stats.totalCopies.toLocaleString()} />
            {stats.estimatedValue !== null && (
              <StatBlock label="Est. Value" value={`$${stats.estimatedValue.toFixed(2)}`} accent />
            )}
          </div>
        )}

        {/* Search */}
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
            placeholder="Search your collection…"
            value={filters.query || ''}
            onChange={e => updateFilters({ query: e.target.value || undefined })}
            className="w-full bg-slate-dark/40 border border-slate-mid/20 rounded-xl pl-10 pr-4 py-2.5
                       text-sm text-bone placeholder:text-ash/40
                       focus:outline-none focus:border-mana-gold/35 focus:bg-slate-dark/60 transition-all"
          />
        </div>

        {/* Filters */}
        <CardFiltersBar filters={filters} onUpdate={updateFilters} />
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-5">
        {!loading && result.total === 0 && !filters.query && (!filters.colors || filters.colors.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-mana-gold/8 border border-mana-gold/15
                            flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" strokeWidth="1.5"
                      strokeLinejoin="round" className="text-mana-gold/60"/>
                <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" className="text-mana-gold/40"/>
                <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" className="text-mana-gold/50"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-ash/60 text-sm">Your collection is empty</p>
              <p className="text-ash/35 text-xs mt-1">Browse cards and add them to start tracking what you own</p>
            </div>
            <button
              onClick={onNavigateToBrowse}
              className="px-4 py-2 rounded-xl bg-mana-gold/10 border border-mana-gold/25
                         text-mana-gold/80 font-medium text-xs tracking-wide
                         hover:bg-mana-gold/18 hover:text-mana-gold transition-all cursor-pointer"
            >
              Browse Cards
            </button>
          </div>
        ) : (
          <>
            <CardGrid
              cards={cards}
              loading={loading}
              onCardClick={showCard}
              ownedQuantities={ownedQuantities}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pb-4">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-lg text-sm text-ash hover:text-bone
                             disabled:opacity-30 disabled:cursor-default cursor-pointer
                             hover:bg-obsidian transition-all"
                >
                  Prev
                </button>
                <span className="text-ash text-sm">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-sm text-ash hover:text-bone
                             disabled:opacity-30 disabled:cursor-default cursor-pointer
                             hover:bg-obsidian transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail modal */}
      {open && card && (
        <CardDetail
          card={card}
          printings={printings}
          onClose={close}
          collectionQuantity={detailCollectionQty}
          onAddToCollection={handleAddToCollection}
          onUpdateCollectionQuantity={updateCollectionQuantity}
          onRemoveFromCollection={removeFromCollection}
        />
      )}
    </div>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="glass rounded-xl px-4 py-2.5 min-w-[100px]">
      <div className={`text-sm font-medium tabular-nums ${accent ? 'text-mana-gold' : 'text-bone/85'}`}>
        {value}
      </div>
      <div className="text-[10px] text-ash/50 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
