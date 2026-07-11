import { useState, useMemo, useCallback, useRef } from 'react';
import type { Card, Deck, DeckCard } from '../../shared/types';
import { useCardDetail } from '../hooks/useCards';
import { useDeckEditorCards } from '../hooks/useDeckEditorCards';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import { useDeckCards } from '../hooks/useDecks';
import { useCollectionLookup, useCollectionActions } from '../hooks/useCollection';
import { getCardTypeCategory, TYPE_ORDER, CMC_GROUP_ORDER, getCmcGroup, getManaMeta } from '../lib/mana';
import { getMaxCopies, PLAYSET_SIZE } from '../../shared/deckLimits';
import CardFilters from './CardFilters';
import CardGrid from './CardGrid';
import CardDetail from './CardDetail';
import DeckStats from './DeckStats';
import ManaSymbols from './ManaSymbols';
import ViewToggle from './ViewToggle';
import ExportDeckModal from './ExportDeckModal';
import ClaimDeckModal from './ClaimDeckModal';
import DeckChangesModal, { type PendingChangeEntry } from './DeckChangesModal';
import SplitPane, { PanelCollapseButton } from './SplitPane';
import InfiniteScrollFooter from './InfiniteScrollFooter';
import { COST_PILL, TYPE_PILL, GroupPillHeader, formatCostGroupLabel, type PillStyle } from './PillLabel';

const REMOVED_PILL: PillStyle = {
  color: '#d98a8a',
  border: 'rgba(217, 138, 138, 0.35)',
  background: 'rgba(217, 138, 138, 0.1)',
};

interface Props {
  deckId: number;
  decks: Deck[];
  onUpdateDeck: (id: number, updates: Partial<Deck>) => void;
  onDeckCardsChanged: () => void;
}

export default function DeckEditor({ deckId, decks, onUpdateDeck, onDeckCardsChanged }: Props) {
  const deck = decks.find((d) => d.id === deckId);
  const { filters, updateFilters, cards: searchCards, total: searchTotal, loading, loadingMore, hasMore, loadMore } =
    useDeckEditorCards(deckId);
  const { cards: deckCards, addCard, updateQuantity, removeCard, setIgnoreLimit, confirmChanges, discardChanges } =
    useDeckCards(deckId);
  const { card: detailCard, printings, open: detailOpen, showCard, close: closeDetail } = useCardDetail();
  const [activeBoard, setActiveBoard] = useState<'main' | 'sideboard'>('main');
  const [deckView, setDeckView] = useState<'list' | 'visual'>('visual');
  const [deckGroupBy, setDeckGroupBy] = useState<'type' | 'cost'>('cost');
  const [searchView, setSearchView] = useState<'grid' | 'list'>('grid');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [colVersion, setColVersion] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showClaim, setShowClaim] = useState(false);
  const [showChanges, setShowChanges] = useState(false);

  const searchScrollRef = useRef<HTMLDivElement>(null);

  const searchCardIds = useMemo(() => searchCards.map((c) => c.id), [searchCards]);
  const searchOwnedQtys = useCollectionLookup(searchCardIds, colVersion);

  const deckCardIds = useMemo(() => deckCards.map((c) => c.card_id), [deckCards]);
  const deckOwnedQtys = useCollectionLookup(deckCardIds, colVersion);

  const refreshCol = useCallback(() => setColVersion((v) => v + 1), []);
  const { addToCollection, updateCollectionQuantity, removeFromCollection } = useCollectionActions(refreshCol);

  const searchDeckQtys = useMemo(() => {
    const qtys: Record<string, number> = {};
    for (const dc of deckCards) {
      qtys[dc.card_id] = (qtys[dc.card_id] ?? 0) + dc.quantity;
    }
    return qtys;
  }, [deckCards]);

  const handleSearchCardAdd = useCallback(
    async (c: Card) => {
      setSelectedCardId(c.id);
      await addCard(c.id, activeBoard);
      onDeckCardsChanged();
    },
    [addCard, activeBoard, onDeckCardsChanged],
  );

  const handleAddPlayset = useCallback(
    async (c: Card) => {
      setSelectedCardId(c.id);
      await addCard(c.id, activeBoard, PLAYSET_SIZE);
      onDeckCardsChanged();
    },
    [addCard, activeBoard, onDeckCardsChanged],
  );

  const handleSearchCardClick = useCallback(
    (c: Card) => {
      setSelectedCardId(c.id);
      showCard(c);
    },
    [showCard],
  );

  const handleAddToCollection = useCallback((c: Card) => addToCollection(c.id), [addToCollection]);

  const handleAddCard = async (card: Card) => {
    await addCard(card.id, activeBoard);
    onDeckCardsChanged();
  };

  const handleQuantityChange = async (cardId: string, board: string, delta: number) => {
    const dc = deckCards.find((c) => c.card_id === cardId && c.board === board);
    if (!dc) return;
    const newQty = dc.quantity + delta;
    if (newQty <= 0) await removeCard(cardId, board);
    else await updateQuantity(cardId, board, newQty);
    onDeckCardsChanged();
  };

  const handleRestore = async (dc: DeckCard) => {
    await updateQuantity(dc.card_id, dc.board, dc.owned_quantity ?? 0);
    onDeckCardsChanged();
  };

  const handleRemoveAll = async (dc: DeckCard) => {
    await removeCard(dc.card_id, dc.board);
    onDeckCardsChanged();
  };

  const handleClaimDeck = async () => {
    await window.electronAPI.claimDeckFromCollection(deckId);
    onUpdateDeck(deckId, { owned: true });
    refreshCol();
    setShowClaim(false);
  };

  const isOwned = !!deck?.owned;

  // Copies per card name across both boards, for enforcing the copy limit in the UI.
  const nameTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const dc of deckCards) {
      if (!dc.card) continue;
      totals[dc.card.name] = (totals[dc.card.name] ?? 0) + dc.quantity;
    }
    return totals;
  }, [deckCards]);

  // Card names the user exempted from the copy limit in this deck.
  const unlimitedNames = useMemo(() => {
    const names = new Set<string>();
    for (const dc of deckCards) {
      if (dc.ignore_copy_limit && dc.card) names.add(dc.card.name);
    }
    return names;
  }, [deckCards]);

  const canAddMore = useCallback(
    (card: Card | undefined) => {
      if (!card) return false;
      if (unlimitedNames.has(card.name)) return true;
      const max = getMaxCopies(card);
      return max === null || (nameTotals[card.name] ?? 0) < max;
    },
    [nameTotals, unlimitedNames],
  );

  const handleToggleIgnoreLimit = useCallback(
    async (dc: DeckCard) => {
      await setIgnoreLimit(dc.card_id, !dc.ignore_copy_limit);
    },
    [setIgnoreLimit],
  );

  // Pending edits on an owned deck: quantities that differ from the confirmed baseline.
  const pending = useMemo(() => {
    if (!isOwned) return { additions: [] as PendingChangeEntry[], removals: [] as PendingChangeEntry[] };
    const additions: Record<string, PendingChangeEntry> = {};
    const removals: Record<string, PendingChangeEntry> = {};
    for (const dc of deckCards) {
      if (!dc.card) continue;
      const baseline = dc.owned_quantity ?? 0;
      const delta = dc.quantity - baseline;
      if (delta === 0) continue;
      const bucket = delta > 0 ? additions : removals;
      if (!bucket[dc.card_id]) {
        bucket[dc.card_id] = {
          cardId: dc.card_id,
          name: dc.card.name,
          manaCost: dc.card.mana_cost,
          count: 0,
          collectionQty: deckOwnedQtys[dc.card_id] ?? 0,
        };
      }
      bucket[dc.card_id].count += Math.abs(delta);
    }
    const byName = (a: PendingChangeEntry, b: PendingChangeEntry) => a.name.localeCompare(b.name);
    return {
      additions: Object.values(additions).sort(byName),
      removals: Object.values(removals).sort(byName),
    };
  }, [deckCards, isOwned, deckOwnedQtys]);

  const addedCount = pending.additions.reduce((s, e) => s + e.count, 0);
  const removedCount = pending.removals.reduce((s, e) => s + e.count, 0);
  const hasPending = addedCount > 0 || removedCount > 0;

  const handleConfirmChanges = async () => {
    await confirmChanges();
    onDeckCardsChanged();
    refreshCol();
    setShowChanges(false);
  };

  const handleDiscardChanges = async () => {
    await discardChanges();
    onDeckCardsChanged();
  };

  const boardCards = useMemo(
    () => deckCards.filter((c) => c.board === activeBoard && c.quantity > 0),
    [deckCards, activeBoard],
  );

  // Pending removals on the active board, shown in a separate "Removed" section.
  const removedRows = useMemo(
    () =>
      isOwned
        ? deckCards.filter((c) => c.board === activeBoard && c.quantity < (c.owned_quantity ?? 0))
        : [],
    [deckCards, activeBoard, isOwned],
  );

  const groupedCards = useMemo(() => {
    const groups: Record<string, DeckCard[]> = {};
    for (const dc of boardCards) {
      if (!dc.card) continue;
      const key =
        deckGroupBy === 'cost'
          ? getCmcGroup(dc.card.cmc, dc.card.type_line)
          : getCardTypeCategory(dc.card.type_line);
      if (!groups[key]) groups[key] = [];
      groups[key].push(dc);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort(
        (a, b) =>
          (a.card?.cmc ?? 0) - (b.card?.cmc ?? 0) ||
          (a.card?.name || '').localeCompare(b.card?.name || ''),
      );
    }
    const order = deckGroupBy === 'cost' ? CMC_GROUP_ORDER : TYPE_ORDER;
    return order
      .filter((t) => groups[t]?.length)
      .map((t) => ({
        key: t,
        cards: groups[t],
        count: groups[t].reduce((s, c) => s + c.quantity, 0),
      }));
  }, [boardCards, deckGroupBy]);

  const searchSentinelRef = useInfiniteScrollSentinel(searchScrollRef, {
    hasMore,
    loading,
    loadingMore,
    onLoadMore: loadMore,
  });

  const mainCount = deckCards.filter((c) => c.board === 'main').reduce((s, c) => s + c.quantity, 0);
  const sideCount = deckCards.filter((c) => c.board === 'sideboard').reduce((s, c) => s + c.quantity, 0);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-main)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        height: '100%',
      }}
    >
      <SplitPane
        storageKey="deck-editor-split"
        defaultRightWidth={360}
        minLeft={300}
        minRight={260}
        leftLabel="Search"
        rightLabel="Deck"
        left={({ collapse }) => (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                height: '100%',
              }}
            >
              <div
                style={{
                  padding: 'var(--pad) var(--pad) var(--pad-tight)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 11px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-input)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.5 }}>
                      <circle cx="5.5" cy="5.5" r="3.8" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M8.2 8.2L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <input
                      value={filters.query || ''}
                      onChange={(e) => updateFilters({ query: e.target.value || undefined })}
                      placeholder="Search cards to add…"
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
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
                      {searchTotal.toLocaleString()}
                    </span>
                  </div>
                  <ViewToggle value={searchView} onChange={setSearchView} />
                  <PanelCollapseButton
                    direction="left"
                    title="Hide search panel"
                    onClick={collapse}
                  />
                </div>
                <CardFilters filters={filters} onUpdate={updateFilters} />
              </div>

              <div
                ref={searchScrollRef}
                className="scroll-hidden"
                style={{ flex: 1, overflowY: 'auto', padding: searchView === 'grid' ? 'var(--pad)' : 0 }}
              >
                <CardGrid
                  cards={searchCards}
                  loading={loading}
                  view={searchView}
                  selectedId={selectedCardId}
                  deckQuantities={searchDeckQtys}
                  ownedQuantities={searchOwnedQtys}
                  onCardClick={handleSearchCardAdd}
                  onViewCard={handleSearchCardClick}
                  onAddPlayset={handleAddPlayset}
                  unlimitedNames={unlimitedNames}
                />
                <div ref={searchSentinelRef} style={{ height: 1 }} />
                <InfiniteScrollFooter
                  loadingMore={loadingMore}
                  hasMore={hasMore}
                  loadedCount={searchCards.length}
                  total={searchTotal}
                />
              </div>
            </div>
        )}
        right={({ collapse }) => (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                height: '100%',
                width: '100%',
                minWidth: 0,
                background: 'var(--bg-panel)',
              }}
            >
        <div
          style={{
            padding: 'var(--pad) var(--pad) var(--pad-tight)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 8,
              minWidth: 0,
            }}
          >
            {[
              { k: 'main' as const, l: 'Main', n: mainCount },
              { k: 'sideboard' as const, l: 'Sideboard', n: sideCount },
            ].map((tab) => {
              const active = activeBoard === tab.k;
              return (
                <button
                  key={tab.k}
                  onClick={() => setActiveBoard(tab.k)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 5,
                    flexShrink: 0,
                    color: active ? 'var(--text)' : 'var(--text-mute)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 14,
                    fontWeight: 500,
                    paddingBottom: 4,
                    borderBottom: `1.5px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
                  }}
                >
                  {tab.l}
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: active ? 'var(--text-dim)' : 'var(--text-faint)',
                    }}
                  >
                    {tab.n}
                  </span>
                </button>
              );
            })}
            <div style={{ flex: 1, minWidth: 0 }} />
            <PanelCollapseButton direction="right" title="Hide deck panel" onClick={collapse} />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
              marginBottom: 10,
            }}
          >
            <ViewToggle
              value={deckView}
              onChange={setDeckView}
              options={[
                { value: 'list', label: 'list' },
                { value: 'visual', label: 'visual' },
              ]}
            />
            <ViewToggle
              value={deckGroupBy}
              onChange={setDeckGroupBy}
              options={[
                { value: 'type', label: 'type' },
                { value: 'cost', label: 'cost' },
              ]}
            />
            <button onClick={() => setShowExport(true)} style={chipBtn}>
              Export
            </button>
            {!deck?.owned && (
              <button onClick={() => setShowClaim(true)} style={chipBtn}>
                Claim
              </button>
            )}
          </div>

          <DeckStats cards={deckCards} board={activeBoard} />

          {hasPending && (
            <div
              style={{
                marginTop: 10,
                padding: '7px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-line)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                color: 'var(--text-dim)',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {[
                  addedCount > 0 ? `${addedCount} added` : null,
                  removedCount > 0 ? `${removedCount} removed` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                <span style={{ color: 'var(--text-mute)' }}>unconfirmed</span>
              </span>
              <button onClick={handleDiscardChanges} style={chipBtn} title="Revert to the last confirmed deck">
                Discard
              </button>
              <button
                onClick={() => setShowChanges(true)}
                style={{
                  ...chipBtn,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-line)',
                  color: 'var(--accent)',
                }}
              >
                Confirm…
              </button>
            </div>
          )}
        </div>

        <div
          className="scroll-hidden"
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            width: '100%',
            overflowY: 'auto',
            padding: deckView === 'visual' ? 'var(--pad-tight) var(--pad) var(--pad)' : '6px 0 12px',
          }}
        >
          {groupedCards.length === 0 && removedRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>No cards yet</p>
              <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
                Click any card on the left to add it
              </p>
            </div>
          ) : (
            <>
            {groupedCards.map(({ key, cards, count }) => (
              <div key={key} style={{ marginTop: 8 }}>
                <div style={{ padding: deckView === 'visual' ? '4px 0 8px' : '4px var(--pad)' }}>
                  <GroupPillHeader
                    label={deckGroupBy === 'cost' ? formatCostGroupLabel(key) : key}
                    style={deckGroupBy === 'cost' ? COST_PILL : TYPE_PILL}
                    count={count}
                  />
                </div>
                {deckView === 'visual' ? (
                  <div
                    style={{
                      display: 'grid',
                      width: '100%',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                      gap: 14,
                    }}
                  >
                    {cards.map((dc) => (
                      <DeckCardTile
                        key={dc.id}
                        deckCard={dc}
                        selected={selectedCardId === dc.card_id}
                        newCount={isOwned ? dc.quantity - (dc.owned_quantity ?? 0) : 0}
                        canAdd={canAddMore(dc.card)}
                        onClick={() => {
                          if (!dc.card) return;
                          setSelectedCardId(dc.card_id);
                          showCard(dc.card);
                        }}
                        onAdd={() => handleQuantityChange(dc.card_id, dc.board, 1)}
                        onRemove={() => handleQuantityChange(dc.card_id, dc.board, -1)}
                        onRemoveAll={() => handleRemoveAll(dc)}
                        onToggleLimit={
                          dc.card && getMaxCopies(dc.card) !== null
                            ? () => handleToggleIgnoreLimit(dc)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  cards.map((dc) => {
                    const sel = selectedCardId === dc.card_id;
                    const owned = deckOwnedQtys[dc.card_id] ?? 0;
                    const need = dc.quantity - owned;
                    const newCount = isOwned ? dc.quantity - (dc.owned_quantity ?? 0) : 0;
                    const canAdd = canAddMore(dc.card);
                    return (
                      <div
                        key={dc.id}
                        className="group"
                        onClick={() => {
                          if (!dc.card) return;
                          setSelectedCardId(dc.card_id);
                          showCard(dc.card);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '0 var(--pad)',
                          height: 'var(--row-h)',
                          cursor: 'pointer',
                          background: sel ? 'var(--bg-row-sel)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!sel) e.currentTarget.style.background = 'var(--bg-row-hov)';
                        }}
                        onMouseLeave={(e) => {
                          if (!sel) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            color: 'var(--text-dim)',
                          }}
                        >
                          {dc.quantity}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 12.5,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {dc.card?.name}
                        </span>
                        {dc.ignore_copy_limit && (
                          <span
                            title="Copy limit ignored for this card"
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 10,
                              color: 'var(--accent)',
                              flexShrink: 0,
                            }}
                          >
                            ∞
                          </span>
                        )}
                        {newCount > 0 && (
                          <span
                            title={`${newCount} added since last confirm — not yet owned`}
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: 9,
                              color: '#c9a86c',
                              flexShrink: 0,
                            }}
                          >
                            +{newCount} new
                          </span>
                        )}
                        <span
                          style={{
                            width: 48,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                          }}
                        >
                          {owned > 0 && need > 0 && (
                            <span
                              title={`Own ${owned}, need ${need} more`}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: 9,
                                color: 'var(--danger)',
                              }}
                            >
                              need {need}
                            </span>
                          )}
                          {owned > 0 && need <= 0 && (
                            <span
                              title={`Owned: ${owned}`}
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--good)',
                              }}
                            />
                          )}
                        </span>
                        <span
                          style={{
                            width: 52,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ManaSymbols cost={dc.card?.mana_cost || ''} size={11} />
                        </span>
                        <div
                          className="opacity-0 group-hover:opacity-100"
                          style={{
                            width: 82,
                            display: 'flex',
                            gap: 2,
                            flexShrink: 0,
                            justifyContent: 'flex-end',
                            transition: 'opacity 120ms',
                          }}
                        >
                          {dc.card && getMaxCopies(dc.card) !== null && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleIgnoreLimit(dc);
                              }}
                              style={
                                dc.ignore_copy_limit
                                  ? {
                                      ...miniBtn,
                                      background: 'var(--accent-soft)',
                                      border: '1px solid var(--accent-line)',
                                      color: 'var(--accent)',
                                    }
                                  : miniBtn
                              }
                              title={
                                dc.ignore_copy_limit
                                  ? 'Copy limit ignored for this card — click to enforce it again'
                                  : 'Ignore the copy limit for this card in this deck'
                              }
                            >
                              ∞
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuantityChange(dc.card_id, dc.board, -1);
                            }}
                            style={miniBtn}
                            title="Remove one"
                          >
                            −
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (canAdd) handleQuantityChange(dc.card_id, dc.board, 1);
                            }}
                            disabled={!canAdd}
                            style={{ ...miniBtn, opacity: canAdd ? 1 : 0.35, cursor: canAdd ? 'pointer' : 'default' }}
                            title={canAdd ? 'Add one' : 'Copy limit reached'}
                          >
                            +
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveAll(dc);
                            }}
                            style={{ ...miniBtn, color: 'var(--danger)' }}
                            title={`Remove all ${dc.quantity} copies`}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
            {removedRows.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ padding: deckView === 'visual' ? '4px 0 8px' : '4px var(--pad)' }}>
                  <GroupPillHeader
                    label="Removed"
                    style={REMOVED_PILL}
                    count={removedRows.reduce((s, dc) => s + ((dc.owned_quantity ?? 0) - dc.quantity), 0)}
                  />
                </div>
                {removedRows.map((dc) => {
                  const removedQty = (dc.owned_quantity ?? 0) - dc.quantity;
                  return (
                    <div
                      key={dc.id}
                      className="group"
                      onClick={() => {
                        if (!dc.card) return;
                        setSelectedCardId(dc.card_id);
                        showCard(dc.card);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: deckView === 'visual' ? 0 : '0 var(--pad)',
                        height: 'var(--row-h)',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          color: 'var(--danger)',
                          flexShrink: 0,
                        }}
                      >
                        −{removedQty}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          color: 'var(--text-dim)',
                          textDecoration: 'line-through',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {dc.card?.name}
                      </span>
                      <ManaSymbols cost={dc.card?.mana_cost || ''} size={11} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(dc);
                        }}
                        className="opacity-0 group-hover:opacity-100"
                        style={{ ...miniBtn, width: 'auto', padding: '0 6px', transition: 'opacity 120ms' }}
                        title="Put back in the deck"
                      >
                        restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            </>
          )}
        </div>
            </div>
        )}
      />

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
          deckCards={deckCards.filter((c) => c.quantity > 0)}
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

      {showChanges && (
        <DeckChangesModal
          deckName={deck?.name || 'Deck'}
          additions={pending.additions}
          removals={pending.removals}
          onConfirm={handleConfirmChanges}
          onClose={() => setShowChanges(false)}
        />
      )}
    </div>
  );
}

interface TileProps {
  deckCard: DeckCard;
  selected: boolean;
  newCount: number;
  canAdd: boolean;
  onClick: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onRemoveAll: () => void;
  onToggleLimit?: () => void;
}

function DeckCardTile({ deckCard, selected, newCount, canAdd, onClick, onAdd, onRemove, onRemoveAll, onToggleLimit }: TileProps) {
  const [hover, setHover] = useState(false);
  const card = deckCard.card;
  if (!card) return null;
  const tint = card.color_identity?.[0] ? getManaMeta(card.color_identity[0]) : null;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-tile)',
        overflow: 'hidden',
        background: 'var(--bg-row)',
        border: `1px solid ${selected ? 'var(--accent-line)' : 'var(--border)'}`,
        cursor: 'pointer',
        aspectRatio: '488 / 680',
      }}
    >
      {card.image_uri_normal ? (
        <img
          src={card.image_uri_normal}
          alt={card.name}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: tint
              ? `linear-gradient(160deg, ${tint.hex}22, ${tint.hex}08 60%, transparent)`
              : 'var(--bg-input)',
            backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.025) 0 6px, transparent 6px 14px)`,
          }}
        >
          <div
            style={{
              padding: '5px 7px',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--text)',
              background: 'rgba(0,0,0,0.25)',
              borderBottom: '1px solid var(--border)',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {card.name}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              padding: '5px 7px',
              borderTop: '1px solid var(--border)',
              background: 'var(--bg-panel)',
              fontSize: 9.5,
              lineHeight: 1.32,
              color: 'var(--text-dim)',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 4,
              overflow: 'hidden',
            }}
          >
            {card.oracle_text}
          </div>
        </div>
      )}

      <span
        style={{
          position: 'absolute',
          top: 5,
          left: 6,
          padding: '1px 5px',
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          background: 'rgba(0,0,0,0.65)',
          color: 'var(--text)',
          borderRadius: 3,
          fontVariantNumeric: 'tabular-nums',
          backdropFilter: 'blur(4px)',
        }}
      >
        ×{deckCard.quantity}
        {deckCard.ignore_copy_limit ? ' ∞' : ''}
      </span>

      {newCount > 0 && (
        <span
          title={`${newCount} added since last confirm — not yet owned`}
          style={{
            position: 'absolute',
            top: 5,
            right: 6,
            padding: '1px 5px',
            fontSize: 9,
            fontFamily: 'var(--font-mono)',
            background: 'rgba(0,0,0,0.65)',
            color: '#c9a86c',
            border: '1px solid rgba(201, 168, 108, 0.35)',
            borderRadius: 3,
            backdropFilter: 'blur(4px)',
          }}
        >
          +{newCount} new
        </span>
      )}

      {hover && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 6,
            display: 'flex',
            gap: 4,
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7) 50%)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            style={hoverBtn}
            title="Remove one"
          >
            −
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canAdd) onAdd();
            }}
            disabled={!canAdd}
            style={{ ...hoverBtn, opacity: canAdd ? 1 : 0.35, cursor: canAdd ? 'pointer' : 'default' }}
            title={canAdd ? 'Add one' : 'Copy limit reached'}
          >
            +
          </button>
          {onToggleLimit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLimit();
              }}
              style={
                deckCard.ignore_copy_limit
                  ? { ...hoverBtn, border: '1px solid var(--accent-line)', color: 'var(--accent)' }
                  : hoverBtn
              }
              title={
                deckCard.ignore_copy_limit
                  ? 'Copy limit ignored for this card — click to enforce it again'
                  : 'Ignore the copy limit for this card in this deck'
              }
            >
              ∞
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemoveAll();
            }}
            style={{ ...hoverBtn, color: 'var(--danger)' }}
            title={`Remove all ${deckCard.quantity} copies`}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  padding: '4px 10px',
  background: 'var(--bg-chip)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-ui)',
  fontSize: 11,
  cursor: 'pointer',
  flexShrink: 0,
};

const miniBtn: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
};

const hoverBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
  backdropFilter: 'blur(6px)',
};
