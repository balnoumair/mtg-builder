import { useEffect } from 'react';
import type { Card } from '../../shared/types';
import ManaSymbols from './ManaSymbols';
import { getManaMeta } from '../lib/mana';

interface Props {
  card: Card;
  onClose: () => void;
  onAddToDeck?: (card: Card) => void;
  collectionQuantity?: number;
  onAddToCollection?: (card: Card) => void;
  onUpdateCollectionQuantity?: (cardId: string, quantity: number) => void;
  onRemoveFromCollection?: (cardId: string) => void;
}

const RARITY_LABEL: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
};

export default function CardDetail({
  card,
  onClose,
  onAddToDeck,
  collectionQuantity,
  onAddToCollection,
  onUpdateCollectionQuantity,
  onRemoveFromCollection,
}: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const tint = card.color_identity?.[0] ? getManaMeta(card.color_identity[0]) : null;
  const rarity = RARITY_LABEL[card.rarity] || card.rarity;
  const power = card.power;
  const toughness = card.toughness;
  const hasPT = power !== null && toughness !== null;
  const owned = collectionQuantity ?? 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        animation: 'cardPreviewIn 140ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          gap: 18,
          maxWidth: 760,
          width: '100%',
          maxHeight: '100%',
          fontFamily: 'var(--font-ui)',
          color: 'var(--text)',
        }}
      >
        {/* Card face */}
        <div
          style={{
            flex: '0 0 280px',
            aspectRatio: '63 / 88',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {card.image_uri_normal ? (
            <img
              src={card.image_uri_normal}
              alt={card.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <>
              <div
                style={{
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(0,0,0,0.3)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 13.5,
                    fontWeight: 600,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {card.name}
                </span>
                <ManaSymbols cost={card.mana_cost} size={12} />
              </div>
              <div
                style={{
                  flex: 1,
                  background: tint
                    ? `linear-gradient(160deg, ${tint.hex}38, ${tint.hex}10 60%, transparent)`
                    : 'var(--bg-input)',
                  backgroundImage: `repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 8px, transparent 8px 18px)${tint ? `, linear-gradient(160deg, ${tint.hex}38, ${tint.hex}10 60%, transparent)` : ''}`,
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: 10,
                    left: 12,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-faint)',
                  }}
                >
                  art
                </span>
                {hasPT && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: 10,
                      right: 12,
                      padding: '3px 8px',
                      fontSize: 13,
                      fontWeight: 600,
                      background: 'rgba(0,0,0,0.55)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {power}/{toughness}
                  </span>
                )}
              </div>
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 11.5,
                  color: 'var(--text-dim)',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-row)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{card.type_line}</span>
                <div style={{ flex: 1 }} />
                {rarity && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-mute)',
                    }}
                  >
                    {rarity}
                  </span>
                )}
              </div>
              <div
                style={{
                  padding: '12px 12px 14px',
                  background: 'var(--bg-panel)',
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: 'var(--text)',
                  flexShrink: 0,
                }}
              >
                {(card.oracle_text || '').split('\n').map((line, i) => (
                  <p key={i} style={{ margin: i ? '6px 0 0' : 0 }}>
                    {line || ' '}
                  </p>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Side panel */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: 18,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: '0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9.5,
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-mute)',
                marginBottom: 6,
              }}
            >
              Card
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
              }}
            >
              {card.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{card.type_line}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              background: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
            }}
          >
            {[
              { l: 'Cost', v: <ManaSymbols cost={card.mana_cost} size={11} /> },
              { l: 'CMC', v: String(card.cmc ?? '—') },
              { l: 'Rarity', v: rarity || '—' },
              { l: 'Owned', v: String(owned) },
            ].map((s, i) => (
              <div key={i} style={{ background: 'var(--bg-panel)', padding: '7px 10px' }}>
                <div
                  style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-mute)',
                  }}
                >
                  {s.l}
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 13,
                    color: 'var(--text)',
                    minHeight: 16,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {onAddToDeck && (
              <button onClick={() => onAddToDeck(card)} style={primaryBtn}>
                + Add to deck
              </button>
            )}
            {onAddToCollection && owned === 0 && (
              <button onClick={() => onAddToCollection(card)} style={secondaryBtn}>
                + Collection
              </button>
            )}
            {owned > 0 && onUpdateCollectionQuantity && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-strong)',
                  background: 'var(--bg-chip)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              >
                <button
                  onClick={() => {
                    const next = owned - 1;
                    if (next <= 0) onRemoveFromCollection?.(card.id);
                    else onUpdateCollectionQuantity(card.id, next);
                  }}
                  style={stepBtn}
                  aria-label="Decrease owned"
                >
                  −
                </button>
                <span style={{ minWidth: 18, textAlign: 'center', color: 'var(--text)' }}>×{owned}</span>
                <button
                  onClick={() => onUpdateCollectionQuantity(card.id, owned + 1)}
                  style={stepBtn}
                  aria-label="Increase owned"
                >
                  +
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-faint)',
            }}
          >
            <span>{card.artist && `Art by ${card.artist}`}</span>
            <span>esc to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const primaryBtn: React.CSSProperties = {
  padding: '7px 12px',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  padding: '7px 12px',
  background: 'transparent',
  color: 'var(--text-dim)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-ui)',
  fontSize: 12,
  fontWeight: 500,
  cursor: 'pointer',
};

const stepBtn: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  lineHeight: 1,
  padding: 0,
};
