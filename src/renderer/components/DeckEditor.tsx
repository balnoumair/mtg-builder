import { useState, useMemo, useCallback } from 'react';
import type { Card, Deck, DeckCard } from '../../shared/types';
import { useCards, useCardDetail } from '../hooks/useCards';
import { useDeckCards } from '../hooks/useDecks';
import { useCollectionLookup, useCollectionActions } from '../hooks/useCollection';
import { getCardTypeCategory, TYPE_ORDER, getManaMeta } from '../lib/mana';
import CardFilters from './CardFilters';
import CardDetail from './CardDetail';
import DeckStats from './DeckStats';
import ManaSymbols, { ColorIdentity } from './ManaSymbols';
import ViewToggle from './ViewToggle';
import ExportDeckModal from './ExportDeckModal';
import ClaimDeckModal from './ClaimDeckModal';

interface Props {
  deckId: number;
  decks: Deck[];
  onUpdateDeck: (id: number, updates: Partial<Deck>) => void;
  onDeckCardsChanged: () => void;
}

export default function DeckEditor({ deckId, decks, onUpdateDeck, onDeckCardsChanged }: Props) {
  const deck = decks.find((d) => d.id === deckId);
  const { filters, updateFilters, result, loading } = useCards();
  const { cards: deckCards, addCard, updateQuantity, removeCard } = useDeckCards(deckId);
  const { card: detailCard, printings, open: detailOpen, showCard, close: closeDetail } = useCardDetail();
  const [activeBoard, setActiveBoard] = useState<'main' | 'sideboard'>('main');
  const [deckView, setDeckView] = useState<'list' | 'visual'>('list');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [colVersion, setColVersion] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [showClaim, setShowClaim] = useState(false);

  const searchCardIds = useMemo(() => result.cards.map((c) => c.id), [result.cards]);
  const searchOwnedQtys = useCollectionLookup(searchCardIds, colVersion);

  const deckCardIds = useMemo(() => deckCards.map((c) => c.card_id), [deckCards]);
  const deckOwnedQtys = useCollectionLookup(deckCardIds, colVersion);

  const refreshCol = useCallback(() => setColVersion((v) => v + 1), []);
  const { addToCollection, updateCollectionQuantity, removeFromCollection } = useCollectionActions(refreshCol);

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

  const handleClaimDeck = async () => {
    await window.electronAPI.claimDeckFromCollection(deckId);
    onUpdateDeck(deckId, { owned: true });
    refreshCol();
    setShowClaim(false);
  };

  const boardCards = useMemo(() => deckCards.filter((c) => c.board === activeBoard), [deckCards, activeBoard]);

  const groupedCards = useMemo(() => {
    const groups: Record<string, DeckCard[]> = {};
    for (const dc of boardCards) {
      if (!dc.card) continue;
      const cat = getCardTypeCategory(dc.card.type_line);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(dc);
    }
    for (const k of Object.keys(groups)) {
      groups[k].sort((a, b) => (a.card?.cmc ?? 0) - (b.card?.cmc ?? 0) || (a.card?.name || '').localeCompare(b.card?.name || ''));
    }
    return TYPE_ORDER.filter((t) => groups[t]?.length).map((t) => ({
      type: t,
      cards: groups[t],
      count: groups[t].reduce((s, c) => s + c.quantity, 0),
    }));
  }, [boardCards]);

  const mainCount = deckCards.filter((c) => c.board === 'main').reduce((s, c) => s + c.quantity, 0);
  const sideCount = deckCards.filter((c) => c.board === 'sideboard').reduce((s, c) => s + c.quantity, 0);

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 360px',
        overflow: 'hidden',
        background: 'var(--bg-main)',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        height: '100%',
      }}
    >
      {/* LEFT: search + results */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            padding: 'var(--pad) var(--pad) var(--pad-tight)',
            borderBottom: '1px solid var(--border)',
          }}
        >
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
              {result.total.toLocaleString()}
            </span>
          </div>
          <CardFilters filters={filters} onUpdate={updateFilters} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && result.cards.length === 0 && (
            <div style={{ padding: 14, color: 'var(--text-mute)', fontSize: 12 }}>Searching…</div>
          )}
          {result.cards.map((c) => {
            const inDeck = deckCards
              .filter((d) => d.card_id === c.id)
              .reduce((s, d) => s + d.quantity, 0);
            const sel = selectedCardId === c.id;
            return (
              <div
                key={c.id}
                onClick={() => {
                  setSelectedCardId(c.id);
                  showCard(c);
                }}
                onDoubleClick={() => handleAddCard(c)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
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
                <ColorIdentity colors={c.color_identity ?? []} size={8} />
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-mute)',
                    minWidth: 110,
                    textAlign: 'right',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {c.type_line}
                </span>
                <ManaSymbols cost={c.mana_cost} size={11} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddCard(c);
                  }}
                  style={{
                    width: 22,
                    height: 20,
                    borderRadius: 'var(--radius-sm)',
                    background: inDeck ? 'var(--accent-soft)' : 'transparent',
                    border: `1px solid ${inDeck ? 'var(--accent-line)' : 'var(--border-strong)'}`,
                    color: inDeck ? 'var(--accent)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    lineHeight: 1,
                    padding: 0,
                  }}
                  title={inDeck ? `${inDeck} in deck — click to add another` : 'Add to deck'}
                >
                  {inDeck ? `×${inDeck}` : '+'}
                </button>
                {searchOwnedQtys[c.id] > 0 && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--good)',
                      width: 22,
                      textAlign: 'right',
                    }}
                    title={`Owned: ${searchOwnedQtys[c.id]}`}
                  >
                    ◉
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: deck panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-panel)',
        }}
      >
        <div
          style={{
            padding: 'var(--pad) var(--pad) var(--pad-tight)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10 }}>
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
            <div style={{ flex: 1 }} />
            <ViewToggle
              value={deckView}
              onChange={setDeckView}
              options={[
                { value: 'list', label: 'list' },
                { value: 'visual', label: 'visual' },
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
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: deckView === 'visual' ? 'var(--pad-tight) var(--pad) var(--pad)' : '6px 0 12px',
          }}
        >
          {groupedCards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>No cards yet</p>
              <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
                Click any card on the left to add it
              </p>
            </div>
          ) : (
            groupedCards.map(({ type, cards, count }) => (
              <div key={type} style={{ marginTop: 8 }}>
                <div style={{ padding: deckView === 'visual' ? '4px 0 8px' : '4px var(--pad)' }}>
                  <SectionLabel count={count}>{type}</SectionLabel>
                </div>
                {deckView === 'visual' ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                      gap: 8,
                    }}
                  >
                    {cards.map((dc) => (
                      <DeckCardTile
                        key={dc.id}
                        deckCard={dc}
                        selected={selectedCardId === dc.card_id}
                        onClick={() => {
                          if (!dc.card) return;
                          setSelectedCardId(dc.card_id);
                          showCard(dc.card);
                        }}
                        onAdd={() => handleQuantityChange(dc.card_id, dc.board, 1)}
                        onRemove={() => handleQuantityChange(dc.card_id, dc.board, -1)}
                      />
                    ))}
                  </div>
                ) : (
                  cards.map((dc) => {
                    const sel = selectedCardId === dc.card_id;
                    const owned = deckOwnedQtys[dc.card_id] ?? 0;
                    const need = dc.quantity - owned;
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
                        <ManaSymbols cost={dc.card?.mana_cost || ''} size={11} />
                        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
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
                              handleQuantityChange(dc.card_id, dc.board, 1);
                            }}
                            style={miniBtn}
                            title="Add one"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))
          )}
        </div>
      </div>

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

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-mute)',
      }}
    >
      <span>{children}</span>
      {count != null && <span style={{ color: 'var(--text-faint)' }}>{count}</span>}
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

interface TileProps {
  deckCard: DeckCard;
  selected: boolean;
  onClick: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

function DeckCardTile({ deckCard, selected, onClick, onAdd, onRemove }: TileProps) {
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
        aspectRatio: '63 / 88',
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
          right: 6,
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
      </span>

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
              onAdd();
            }}
            style={hoverBtn}
            title="Add one"
          >
            +
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
