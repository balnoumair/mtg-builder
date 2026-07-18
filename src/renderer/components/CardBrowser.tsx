import { useMemo, useState, useCallback, useRef } from 'react';
import type { Card } from '../../shared/types';
import { useCards, useCardDetail } from '../hooks/useCards';
import { useCollectionLookup, useCollectionActions } from '../hooks/useCollection';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import CardFilters from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';
import ViewToggle from './ViewToggle';
import InfiniteScrollFooter from './InfiniteScrollFooter';

interface Props {
  onCollectionChanged?: () => void;
}

export default function CardBrowser({ onCollectionChanged }: Props) {
  const { filters, updateFilters, cards, total, loading, loadingMore, hasMore, loadMore } = useCards();
  const { card, open, showCard, close } = useCardDetail();
  const [colVersion, setColVersion] = useState(0);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const scrollRef = useRef<HTMLDivElement>(null);

  const cardIds = useMemo(() => cards.map((c) => c.id), [cards]);
  const ownedQuantities = useCollectionLookup(cardIds, colVersion);

  const refreshCol = useCallback(() => {
    setColVersion((v) => v + 1);
    onCollectionChanged?.();
  }, [onCollectionChanged]);
  const { addToCollection, updateCollectionQuantity, removeFromCollection } = useCollectionActions(refreshCol);

  const handleAddToCollection = useCallback((c: Card) => addToCollection(c.id), [addToCollection]);

  const sentinelRef = useInfiniteScrollSentinel(scrollRef, {
    hasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
  });

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
      {/* Header */}
      <div
        style={{
          padding: 'var(--pad) var(--pad) var(--pad-tight)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
            }}
          >
            Card Browser
          </h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            {total.toLocaleString()}
          </span>
          <div style={{ flex: 1 }} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 11px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-input)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 10,
            maxWidth: 360,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.5 }}>
            <circle cx="5.5" cy="5.5" r="3.8" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8.2 8.2L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={filters.query || ''}
            onChange={(e) => updateFilters({ query: e.target.value || undefined })}
            placeholder="Search cards…"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: 'var(--font-ui)',
              fontSize: 13,
              color: 'var(--text)',
            }}
          />
        </div>

        <CardFilters filters={filters} onUpdate={updateFilters} />
      </div>

      {/* Body */}
      <div ref={scrollRef} className="scroll-hidden" style={{ flex: 1, overflowY: 'auto', padding: 'var(--pad)' }}>
        <CardGrid
          cards={cards}
          loading={loading}
          onCardClick={showCard}
          ownedQuantities={ownedQuantities}
          view={viewMode}
        />
        <div ref={sentinelRef} style={{ height: 1 }} />
        <InfiniteScrollFooter
          loadingMore={loadingMore}
          hasMore={hasMore}
          loadedCount={cards.length}
          total={total}
        />
      </div>

      {open && card && (
        <CardDetail
          card={card}
          onClose={close}
          collectionQuantity={ownedQuantities[card.id] ?? 0}
          onAddToCollection={handleAddToCollection}
          onUpdateCollectionQuantity={updateCollectionQuantity}
          onRemoveFromCollection={removeFromCollection}
        />
      )}
    </div>
  );
}
