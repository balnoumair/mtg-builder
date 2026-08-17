import type { Card } from '../../shared/types';
import CardImage from './CardImage';
import ManaSymbols, { ColorIdentity } from './ManaSymbols';
import { getManaMeta } from '../lib/mana';
import CardSizeControl from './CardSizeControl';
import { CARD_GRID_MIN_WIDTH, useCardSize } from '../lib/cardSize';
import { getMaxCopies, PLAYSET_SIZE } from '../../shared/deckLimits';

interface Props {
  cards: Card[];
  loading: boolean;
  onCardClick: (card: Card) => void;
  onCardDoubleClick?: (card: Card) => void;
  onViewCard?: (card: Card) => void;
  onAddToDeck?: (card: Card) => void;
  onAddPlayset?: (card: Card) => void;
  /** Card names exempted from the copy limit in the target deck. */
  unlimitedNames?: Set<string>;
  ownedQuantities?: Record<string, number>;
  deckQuantities?: Record<string, number>;
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
  onCardDoubleClick,
  onViewCard,
  onAddToDeck,
  onAddPlayset,
  unlimitedNames,
  ownedQuantities,
  deckQuantities,
  selectedId,
  view = 'grid',
}: Props) {
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
          const max = onAddPlayset && !unlimitedNames?.has(card.name) ? getMaxCopies(card) : null;
          const atMax = max !== null && inDeck >= max;
          const sel = selectedId === card.id;
          return (
            <div
              key={card.id}
              onClick={() => onCardClick(card)}
              onDoubleClick={
                onViewCard
                  ? () => onViewCard(card)
                  : onCardDoubleClick
                    ? () => onCardDoubleClick(card)
                    : undefined
              }
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
              {qty > 0 && (
                <span
                  style={{
                    width: 22,
                    textAlign: 'right',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-dim)',
                  }}
                >
                  ×{qty}
                </span>
              )}
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
                  title={atMax ? `Copy limit reached (${max})` : `Add playset (${PLAYSET_SIZE} copies)`}
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
                    {inDeck ? `×${inDeck}` : '+'}
                  </button>
                )
              )}
              {qty > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--good)',
                    width: 22,
                    textAlign: 'right',
                  }}
                  title={`Owned: ${qty}`}
                >
                  ◉
                </span>
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
          const max = onAddPlayset && !unlimitedNames?.has(card.name) ? getMaxCopies(card) : null;
          const atMax = max !== null && inDeck >= max;
          return (
            <CardTile
              key={card.id}
              card={card}
              owned={ownedQuantities?.[card.id] ?? 0}
              inDeck={inDeck}
              selected={selectedId === card.id}
              onClick={() => onCardClick(card)}
              onDoubleClick={
                onViewCard
                  ? () => onViewCard(card)
                  : onCardDoubleClick
                    ? () => onCardDoubleClick(card)
                    : undefined
              }
              onView={onViewCard ? () => onViewCard(card) : undefined}
              onAdd={!onViewCard && onAddToDeck ? () => onAddToDeck(card) : undefined}
              onAddPlayset={onAddPlayset && !atMax ? () => onAddPlayset(card) : undefined}
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
  selected: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onView?: () => void;
  onAdd?: () => void;
  onAddPlayset?: () => void;
}

function CardTile({ card, owned, inDeck, selected, onClick, onDoubleClick, onView, onAdd, onAddPlayset }: TileProps) {
  const hasImage = !!card.image_uri_normal;
  const tint = card.color_identity?.[0] ? getManaMeta(card.color_identity[0]) : null;
  const rarityShort = RARITY_SHORT[card.rarity];

  if (hasImage) {
    return (
      <div
        onClick={onClick}
        onDoubleClick={onDoubleClick}
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
          if (!selected) e.currentTarget.style.borderColor = 'var(--border-strong)';
        }}
        onMouseLeave={(e) => {
          if (!selected) e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        <CardImage src={card.image_uri_normal!} alt={card.name} />
        {inDeck > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              padding: '2px 7px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              background: 'rgba(0,0,0,0.65)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 3,
              fontVariantNumeric: 'tabular-nums',
              backdropFilter: 'blur(4px)',
            }}
          >
            ×{inDeck}
          </span>
        )}
        {owned > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '2px 7px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              background: 'rgba(0,0,0,0.65)',
              color: 'var(--text)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 3,
              fontVariantNumeric: 'tabular-nums',
              backdropFilter: 'blur(4px)',
            }}
          >
            ×{owned}
          </span>
        )}
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
            title={`Add playset (${PLAYSET_SIZE} copies)`}
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
      onClick={onClick}
      style={{
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
        e.currentTarget.style.borderColor = 'var(--border-strong)';
      }}
      onMouseLeave={(e) => {
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
      <div
        style={{
          padding: '6px 10px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-mute)',
        }}
      >
        <span>CMC {card.cmc ?? 0}</span>
        {owned > 0 && <span style={{ color: 'var(--text-dim)' }}>×{owned}</span>}
      </div>
    </div>
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
