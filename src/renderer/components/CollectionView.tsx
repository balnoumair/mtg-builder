import { useMemo, useCallback, useState } from 'react';
import type { Card } from '../../shared/types';
import { useCollection, useCollectionActions } from '../hooks/useCollection';
import { useCardDetail } from '../hooks/useCards';
import CardFilters from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';
import ViewToggle from './ViewToggle';

interface Props {
  onNavigateToBrowse: () => void;
  collectionVersion?: number;
}

export default function CollectionView({ onNavigateToBrowse, collectionVersion = 0 }: Props) {
  const { filters, updateFilters, setPage, result, stats, loading, refresh } = useCollection(collectionVersion);
  const { card, printings, open, showCard, close } = useCardDetail();
  const { addToCollection, updateCollectionQuantity, removeFromCollection } = useCollectionActions(refresh);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const totalPages = Math.ceil(result.total / (filters.pageSize || 60));
  const currentPage = filters.page || 1;

  const ownedQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cc of result.cards) map[cc.card_id] = cc.quantity;
    return map;
  }, [result.cards]);

  const cards = useMemo(() => result.cards.map((cc) => cc.card), [result.cards]);

  const handleAddToCollection = useCallback((c: Card) => addToCollection(c.id), [addToCollection]);
  const detailQty = card ? ownedQuantities[card.id] ?? 0 : 0;

  const empty = !loading && result.total === 0 && !filters.query && !filters.colors?.length;

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
            My Cards
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-mute)',
            }}
          >
            <span>
              <span style={{ color: 'var(--text-dim)' }}>{stats.uniqueCards.toLocaleString()}</span> unique
            </span>
            <span>
              <span style={{ color: 'var(--text-dim)' }}>{stats.totalCopies.toLocaleString()}</span> copies
            </span>
            {stats.estimatedValue !== null && (
              <span>
                <span style={{ color: 'var(--text-dim)' }}>${stats.estimatedValue.toFixed(2)}</span> est.
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </div>

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
            placeholder="Filter collection…"
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
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--pad)' }}>
        {empty ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '48px 16px',
            }}
          >
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Your collection is empty</p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, margin: 0 }}>
              Browse cards and add them to start tracking what you own
            </p>
            <button
              onClick={onNavigateToBrowse}
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
              Browse cards
            </button>
          </div>
        ) : (
          <>
            <CardGrid
              cards={cards}
              loading={loading}
              onCardClick={showCard}
              ownedQuantities={ownedQuantities}
              view={viewMode}
            />
            {totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 16,
                  paddingBottom: 8,
                }}
              >
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  style={pageBtn(currentPage <= 1)}
                >
                  Prev
                </button>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  style={pageBtn(currentPage >= totalPages)}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {open && card && (
        <CardDetail
          card={card}
          printings={printings}
          onClose={close}
          collectionQuantity={detailQty}
          onAddToCollection={handleAddToCollection}
          onUpdateCollectionQuantity={updateCollectionQuantity}
          onRemoveFromCollection={removeFromCollection}
        />
      )}
    </div>
  );
}

function pageBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: 'var(--bg-chip)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-dim)',
    fontSize: 11,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.3 : 1,
  };
}
