import { useState, useMemo, useEffect } from 'react';
import type { DeckCard } from '../../shared/types';
import { BASIC_LAND_NAMES } from '../../shared/basicLands';
import { getCardTypeCategory, TYPE_ORDER } from '../lib/mana';
import { copyText } from '../lib/clipboard';
import ManaSymbols from './ManaSymbols';

interface Props {
  deckName: string;
  deckCards: DeckCard[];
  onClose: () => void;
}

export default function ExportDeckModal({ deckName, deckCards, onClose }: Props) {
  const [excludeBasicLands, setExcludeBasicLands] = useState(false);
  const [excludedCardIds, setExcludedCardIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const mainCards = useMemo(() => deckCards.filter((dc) => dc.board === 'main'), [deckCards]);
  const sideCards = useMemo(() => deckCards.filter((dc) => dc.board === 'sideboard'), [deckCards]);

  const filterCards = (cards: DeckCard[]) =>
    cards.filter((dc) => {
      if (!dc.card) return false;
      if (excludeBasicLands && BASIC_LAND_NAMES.has(dc.card.name)) return false;
      if (excludedCardIds.has(dc.card_id)) return false;
      return true;
    });

  const filteredMain = useMemo(
    () => filterCards(mainCards),
    [mainCards, excludeBasicLands, excludedCardIds],
  );
  const filteredSide = useMemo(
    () => filterCards(sideCards),
    [sideCards, excludeBasicLands, excludedCardIds],
  );

  const groupedMain = useMemo(() => {
    const groups: Record<string, DeckCard[]> = {};
    for (const dc of filteredMain) {
      if (!dc.card) continue;
      const cat = getCardTypeCategory(dc.card.type_line);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(dc);
    }
    return TYPE_ORDER.filter((t) => groups[t]?.length).map((t) => ({ type: t, cards: groups[t] }));
  }, [filteredMain]);

  const toggleExclude = (cardId: string) => {
    setExcludedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const totalMain = filteredMain.reduce((s, c) => s + c.quantity, 0);
  const totalSide = filteredSide.reduce((s, c) => s + c.quantity, 0);

  const exportText = useMemo(() => {
    const lines: string[] = [];
    if (deckName) lines.push(`// ${deckName}`, '');
    for (const group of groupedMain) {
      lines.push(`// ${group.type}`);
      for (const dc of group.cards) lines.push(`${dc.quantity} ${dc.card?.name}`);
      lines.push('');
    }
    if (filteredSide.length > 0) {
      lines.push('// Sideboard');
      for (const dc of filteredSide) lines.push(`${dc.quantity} ${dc.card?.name}`);
    }
    return lines.join('\n').trim();
  }, [deckName, groupedMain, filteredSide]);

  const handleCopy = async () => {
    await copyText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '85vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 18,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>
              Export deck
            </h2>
            <p style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 2, marginBottom: 0 }}>
              {deckName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-mute)',
              fontSize: 18,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 12,
          }}
        >
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              color: 'var(--text-dim)',
            }}
          >
            <input
              type="checkbox"
              checked={excludeBasicLands}
              onChange={(e) => setExcludeBasicLands(e.target.checked)}
            />
            Exclude basic lands
          </label>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-mute)',
              marginLeft: 'auto',
            }}
          >
            {totalMain} main{totalSide > 0 ? ` · ${totalSide} side` : ''}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {groupedMain.length === 0 && filteredSide.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 32,
                color: 'var(--text-mute)',
                fontSize: 12,
              }}
            >
              No cards to export
            </div>
          ) : (
            <>
              {groupedMain.map((group) => (
                <ExportGroup
                  key={group.type}
                  title={group.type}
                  cards={group.cards}
                  onExclude={toggleExclude}
                />
              ))}
              {filteredSide.length > 0 && (
                <ExportGroup title="Sideboard" cards={filteredSide} onExclude={toggleExclude} />
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 12px',
              background: 'transparent',
              color: 'var(--text-mute)',
              border: 'none',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 14px',
              background: copied ? 'rgba(134,169,140,0.12)' : 'var(--accent-soft)',
              color: copied ? 'var(--good)' : 'var(--accent)',
              border: `1px solid ${copied ? 'rgba(134,169,140,0.4)' : 'var(--accent-line)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExportGroup({
  title,
  cards,
  onExclude,
}: {
  title: string;
  cards: DeckCard[];
  onExclude: (id: string) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          paddingBottom: 4,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-mute)',
          }}
        >
          {title}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
          {cards.reduce((s, c) => s + c.quantity, 0)}
        </span>
      </div>
      {cards.map((dc) => (
        <div
          key={dc.id}
          className="group"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '3px 6px',
            fontSize: 12,
          }}
        >
          <span
            style={{
              width: 22,
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-dim)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {dc.quantity}
          </span>
          <span
            style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
          >
            {dc.card?.name}
          </span>
          <ManaSymbols cost={dc.card?.mana_cost || ''} size={11} />
          <button
            onClick={() => onExclude(dc.card_id)}
            className="opacity-0 group-hover:opacity-100"
            title="Exclude from export"
            style={{
              width: 18,
              height: 18,
              borderRadius: 'var(--radius-sm)',
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--text-mute)',
              cursor: 'pointer',
              transition: 'opacity 120ms',
              padding: 0,
            }}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ margin: 'auto' }}>
              <path
                d="M1 1l6 6M7 1l-6 6"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
