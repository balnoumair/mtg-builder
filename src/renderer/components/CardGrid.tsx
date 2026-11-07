import { useState } from 'react';
import type { Card } from '../../shared/types';
import CardImage from './CardImage';
import { previewOnModifiedClick } from '../lib/cardClick';
import { cardHoverBar, cardHoverButton, cardRowButton } from '../lib/cardControls';
import ManaSymbols, { ColorIdentity } from './ManaSymbols';
import { getManaMeta } from '../lib/mana';
import CardSizeControl from './CardSizeControl';
import CountTag from './CountTag';
import { CARD_GRID_MIN_WIDTH, useCardSize } from '../lib/cardSize';
import { getMaxCopies, PLAYSET_SIZE } from '../../shared/deckLimits';

interface Props {
  cards: Card[];
  loading: boolean;
  onCardClick: (card: Card) => void;
  onViewCard?: (card: Card) => void;
  onAddToDeck?: (card: Card) => void;
  onAddPlayset?: (card: Card) => void;
  /**
   * Where the +4 button adds copies. Only decks enforce the copy limit;
   * the collection takes any number.
   */
  playsetTarget?: 'deck' | 'collection';
  onRemoveFromCollection?: (card: Card) => void;
  /** Card names exempted from the copy limit in the target deck. */
  unlimitedNames?: Set<string>;
  ownedQuantities?: Record<string, number>;
  deckQuantities?: Record<string, number>;
  /**
   * Copies held in owned decks, shown as their own tag next to the free
   * (loose) copies; together they are everything the user owns.
   */
  inDecksQuantities?: Record<string, number>;
  /**
   * Confirmed copies in the deck being edited. When present, the in-decks tag
   * leaves them out and reads "in other decks", so this deck's copies aren't
   * shown twice next to the in-deck tag.
   */
  currentDeckQuantities?: Record<string, number>;
  /**
   * Copies of deckQuantities added to an owned deck since its last confirm.
   * Shown as "+N new" and left out of the in-deck tag, so none count twice.
   */
  newQuantities?: Record<string, number>;
  selectedId?: string | null;
  view?: 'grid' | 'list';
}

const RARITY_SHORT: Record<string, string> = {
  common: 'C',
  uncommon: 'U',
  rare: 'R',
  mythic: 'M',
};

export default function CardGrid({
  cards,
  loading,
  onCardClick,
  onViewCard,
  onAddToDeck,
  onAddPlayset,
  playsetTarget = 'deck',
  onRemoveFromCollection,
  unlimitedNames,
  ownedQuantities,
  deckQuantities,
  inDecksQuantities,
  currentDeckQuantities,
  newQuantities,
  selectedId,
  view = 'grid',
}: Props) {
  const otherDecks = (cardId: string, decked: number) =>
    currentDeckQuantities ? Math.max(0, decked - (currentDeckQuantities[cardId] ?? 0)) : undefined;
  const [cardSize, setCardSize] = useCardSize();
  const minTileWidth = CARD_GRID_MIN_WIDTH[cardSize];
  const sizeControl = view === 'grid' ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
      <CardSizeControl value={cardSize} onChange={setCardSize} />
    </div>
  ) : null;

  if (loading && cards.length === 0) {
    return (
      <>
        {sizeControl}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${minTileWidth}px, 1fr))`,
            gap: 14,
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="card-skeleton" style={{ aspectRatio: '488 / 680' }} />
          ))}
        </div>
      </>
    );
  }

  if (cards.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
          color: 'var(--text-mute)',
          fontSize: 13,
        }}
      >
        No cards found. Try adjusting your filters.
      </div>
    );
  }

  if (view === 'list') {
    return (
      <div
        className={`card-results${loading ? ' refreshing' : ''}`}
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        {cards.map((card, i) => {
          const qty = ownedQuantities?.[card.id] ?? 0;
          const inDeck = deckQuantities?.[card.id] ?? 0;
          const max = onAddPlayset && playsetTarget === 'deck' && !unlimitedNames?.has(card.name)
            ? getMaxCopies(card)
            : null;
          const atMax = max !== null && inDeck >= max;
          const decked = inDecksQuantities?.[card.id] ?? 0;
          const sel = selectedId === card.id;
          return (
            <div
              key={card.id}
              className="group"
              onClickCapture={(e) => previewOnModifiedClick(e, onViewCard ? () => onViewCard(card) : undefined)}
              onClick={() => onCardClick(card)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 var(--pad)',
                height: 'var(--row-h)',
                borderTop: i ? '1px solid var(--border)' : 'none',
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
              <ColorIdentity colors={card.color_identity ?? []} size={9} />
              <span
                style={{
                  flex: 1,
                  fontSize: 12.5,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {card.name}
              </span>
              <CountTags
                inDeck={inDeck}
                newCount={newQuantities?.[card.id] ?? 0}
                owned={qty}
                decked={inDecksQuantities ? decked : undefined}
                otherDecks={otherDecks(card.id, decked)}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-mute)',
                  minWidth: 120,
                  textAlign: 'right',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {card.type_line}
              </span>
              <ManaSymbols cost={card.mana_cost} size={11} />
              {onAddPlayset && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!atMax) onAddPlayset(card);
                  }}
                  disabled={atMax}
                  style={{
                    ...detailBtnStyle,
                    width: 28,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    cursor: atMax ? 'default' : 'pointer',
                    opacity: atMax ? 0.4 : 1,
                  }}
                  title={atMax ? `Copy limit reached (${max})` : playsetTitle(playsetTarget)}
                >
                  +{PLAYSET_SIZE}
                </button>
              )}
              {onViewCard ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewCard(card);
                  }}
                  style={detailBtnStyle}
                  title="View card details"
                >
                  <ViewIcon />
                </button>
              ) : (
                onAddToDeck && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToDeck(card);
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
                    +
                  </button>
                )
              )}
              {onRemoveFromCollection && qty > 0 && (
                <RemoveCollectionButton card={card} quantity={qty} onRemove={() => onRemoveFromCollection(card)} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {sizeControl}
      <div
        className={`card-results${loading ? ' refreshing' : ''}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minTileWidth}px, 1fr))`,
          gap: 14,
        }}
      >
        {cards.map((card) => {
          const inDeck = deckQuantities?.[card.id] ?? 0;
          const max = onAddPlayset && playsetTarget === 'deck' && !unlimitedNames?.has(card.name)
            ? getMaxCopies(card)
            : null;
          const atMax = max !== null && inDeck >= max;
          return (
            <CardTile
              key={card.id}
              card={card}
              owned={ownedQuantities?.[card.id] ?? 0}
              inDeck={inDeck}
              newCount={newQuantities?.[card.id] ?? 0}
              decked={inDecksQuantities ? inDecksQuantities[card.id] ?? 0 : undefined}
              otherDecks={otherDecks(card.id, inDecksQuantities?.[card.id] ?? 0)}
              selected={selectedId === card.id}
              onClick={() => onCardClick(card)}
              onView={onViewCard ? () => onViewCard(card) : undefined}
              onAdd={!onViewCard && onAddToDeck ? () => onAddToDeck(card) : undefined}
              onAddPlayset={onAddPlayset && !atMax ? () => onAddPlayset(card) : undefined}
              playsetTitle={playsetTitle(playsetTarget)}
              onRemove={onRemoveFromCollection ? () => onRemoveFromCollection(card) : undefined}
            />
          );
        })}
      </div>
    </>
  );
}

interface TileProps {
  card: Card;
  owned: number;
  inDeck: number;
  /** Part of inDeck added since the deck's last confirm. */
  newCount: number;
  /** Copies in owned decks; undefined when the view doesn't track them. */
  decked?: number;
  /** Copies in owned decks other than the one being edited, when editing one. */
  otherDecks?: number;
  selected: boolean;
  onClick: () => void;
  onView?: () => void;
  onAdd?: () => void;
  onAddPlayset?: () => void;
  playsetTitle: string;
  onRemove?: () => void;
}

/** The in-decks tag, or "in other decks" when a deck is open. */
function DecksTag({ decked, otherDecks, overlay }: { decked?: number; otherDecks?: number; overlay?: boolean }) {
  if (otherDecks !== undefined) {
    return otherDecks > 0 ? <CountTag kind="inOtherDecks" count={otherDecks} overlay={overlay} /> : null;
  }
  return decked ? <CountTag kind="inDecks" count={decked} overlay={overlay} /> : null;
}

/** In-deck and new tags: confirmed copies and unconfirmed additions, never overlapping. */
function DeckTags({ inDeck, newCount, overlay }: { inDeck: number; newCount: number; overlay?: boolean }) {
  const fresh = Math.max(0, Math.min(newCount, inDeck));
  return (
    <>
      {inDeck - fresh > 0 && <CountTag kind="inDeck" count={inDeck - fresh} overlay={overlay} />}
      {fresh > 0 && (
        <CountTag kind="new" count={fresh} overlay={overlay} title={`${fresh} added since last confirm — not yet owned`} />
      )}
    </>
  );
}

/** In-deck, new, free and in-decks tags for one card, in that fixed order. */
function CountTags({ inDeck, newCount, owned, decked, otherDecks }: { inDeck: number; newCount: number; owned: number; decked?: number; otherDecks?: number }) {
  const total = owned + (decked ?? 0);
  if (inDeck <= 0 && total <= 0) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexShrink: 0 }}>
      <DeckTags inDeck={inDeck} newCount={newCount} />
      {owned > 0 && <CountTag kind="free" count={owned} title={ownedSplitTitle(owned, decked)} />}
      <DecksTag decked={decked} otherDecks={otherDecks} />
    </span>
  );
}

/** Tooltip for the free count: loose copies, not in any deck, and the total owned. */
function ownedSplitTitle(loose: number, decked: number | undefined): string {
  return `Not in any deck · ${loose + (decked ?? 0)} owned in total`;
}

function playsetTitle(target: 'deck' | 'collection'): string {
  return target === 'collection'
    ? `Add ${PLAYSET_SIZE} copies to My Cards`
    : `Add playset (${PLAYSET_SIZE} copies)`;
}

function CardTile({ card, owned, inDeck, newCount, decked, otherDecks, selected, onClick, onView, onAdd, onAddPlayset, playsetTitle, onRemove }: TileProps) {
  const [hover, setHover] = useState(false);
  const total = owned + (decked ?? 0);
  const hasImage = !!card.image_uri_normal;
  const tint = card.color_identity?.[0] ? getManaMeta(card.color_identity[0]) : null;
  const rarityShort = RARITY_SHORT[card.rarity];
  const removeControl = hover && onRemove && owned > 0 ? (
    <div style={cardHoverBar}>
      <div style={{ flex: 1 }} />
      <RemoveCollectionButton card={card} quantity={owned} onRemove={onRemove} tile />
    </div>
  ) : null;

  if (hasImage) {
    return (
      <div
        onClickCapture={(e) => previewOnModifiedClick(e, onView)}
        onClick={onClick}
        className="group"
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-tile)',
          overflow: 'hidden',
          background: 'var(--bg-panel)',
          border: `1px solid ${selected ? 'var(--accent-line)' : 'var(--border)'}`,
          cursor: 'pointer',
          aspectRatio: '488 / 680',
        }}
        onMouseEnter={(e) => {
          setHover(true);
          if (!selected) e.currentTarget.style.borderColor = 'var(--border-strong)';
        }}
        onMouseLeave={(e) => {
          setHover(false);
          if (!selected) e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <CardImage src={card.image_uri_normal!} alt={card.name} />
        {inDeck > 0 && (
          <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 3 }}>
            <DeckTags inDeck={inDeck} newCount={newCount} overlay />
          </div>
        )}
        {total > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 3,
            }}
          >
            {owned > 0 && <CountTag kind="free" count={owned} overlay title={ownedSplitTitle(owned, decked)} />}
            <DecksTag decked={decked} otherDecks={otherDecks} overlay />
          </div>
        )}
        {removeControl}
        {onView && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
            }}
            className="opacity-0 group-hover:opacity-100"
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'var(--text)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              padding: 0,
              transition: 'opacity 120ms',
              backdropFilter: 'blur(6px)',
            }}
            title="View card details"
          >
            <ViewIcon size={13} />
          </button>
        )}
        {onAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            className="opacity-0 group-hover:opacity-100"
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              transition: 'opacity 120ms',
              backdropFilter: 'blur(6px)',
            }}
            title="Add to deck"
          >
            +
          </button>
        )}
        {onAddPlayset && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddPlayset();
            }}
            className="opacity-0 group-hover:opacity-100"
            style={{
              position: 'absolute',
              bottom: 8,
              left: 8,
              height: 28,
              padding: '0 9px',
              borderRadius: 14,
              background: 'rgba(0,0,0,0.65)',
              border: '1px solid rgba(255,255,255,0.18)',
              color: 'var(--text)',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              lineHeight: 1,
              transition: 'opacity 120ms',
              backdropFilter: 'blur(6px)',
            }}
            title={playsetTitle}
          >
            +{PLAYSET_SIZE}
          </button>
        )}
      </div>
    );
  }

  // Imageless fallback: use the design's text-rich tile
  return (
    <div
      onClickCapture={(e) => previewOnModifiedClick(e, onView)}
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-tile)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'border-color 120ms',
      }}
      onMouseEnter={(e) => {
        setHover(true);
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
        setHover(false);
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(0,0,0,0.28)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--text)',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {card.name}
        </span>
        <ManaSymbols cost={card.mana_cost} size={11} />
      </div>
      <div
        style={{
          position: 'relative',
          aspectRatio: '63 / 38',
          background: tint
            ? `linear-gradient(160deg, ${tint.hex}30, ${tint.hex}08 60%, transparent)`
            : 'var(--bg-row)',
          backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 7px, transparent 7px 16px)${tint ? `, linear-gradient(160deg, ${tint.hex}30, ${tint.hex}08 60%, transparent)` : ''}`,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 8,
            left: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-faint)',
          }}
        >
          art
        </span>
        {card.power !== null && card.toughness !== null && (
          <span
            style={{
              position: 'absolute',
              bottom: 8,
              right: 10,
              padding: '2px 7px',
              fontSize: 11,
              fontWeight: 600,
              background: 'rgba(0,0,0,0.55)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {card.power}/{card.toughness}
          </span>
        )}
      </div>
      <div
        style={{
          padding: '6px 10px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-mute)',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-row)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.type_line}</span>
        {rarityShort && <span style={{ color: 'var(--text-faint)' }}>{rarityShort}</span>}
      </div>
      <div
        style={{
          padding: '9px 10px 10px',
          fontSize: 11.5,
          lineHeight: 1.42,
          color: 'var(--text-dim)',
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: 5,
          overflow: 'hidden',
          minHeight: 76,
        }}
      >
        {card.oracle_text || '—'}
      </div>
      {(total > 0 || inDeck > 0) && (
        <div
          style={{
            padding: '6px 10px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-panel)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <CountTags inDeck={inDeck} newCount={newCount} owned={owned} decked={decked} otherDecks={otherDecks} />
        </div>
      )}
      {removeControl}
    </div>
  );
}

function RemoveCollectionButton({ card, quantity, onRemove, tile = false }: { card: Card; quantity: number; onRemove: () => void; tile?: boolean }) {
  const label = `Remove all ${quantity} copies of ${card.name} from My Cards`;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      aria-label={label}
      title={label}
      className={tile ? undefined : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}
      style={{ ...(tile ? cardHoverButton : cardRowButton), color: 'var(--danger)' }}
    >
      ✕
    </button>
  );
}

function ViewIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M1 6s1.6-3.5 5-3.5 5 3.5 5 3.5-1.6 3.5-5 3.5S1 6 1 6z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const detailBtnStyle: React.CSSProperties = {
  width: 22,
  height: 20,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  padding: 0,
};
