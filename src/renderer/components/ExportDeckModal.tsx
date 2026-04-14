import { useState, useMemo, useEffect } from 'react';
import type { DeckCard } from '../../shared/types';
import { getCardTypeCategory, TYPE_ORDER } from '../lib/mana';
import ManaSymbols from './ManaSymbols';

interface Props {
  deckName: string;
  deckCards: DeckCard[];
  onClose: () => void;
}

const BASIC_LANDS = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']);

export default function ExportDeckModal({ deckName, deckCards, onClose }: Props) {
  const [excludeBasicLands, setExcludeBasicLands] = useState(false);
  const [excludedCardIds, setExcludedCardIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const mainCards = useMemo(() => deckCards.filter(dc => dc.board === 'main'), [deckCards]);
  const sideCards = useMemo(() => deckCards.filter(dc => dc.board === 'sideboard'), [deckCards]);

  const filterCards = (cards: DeckCard[]) => {
    return cards.filter(dc => {
      if (!dc.card) return false;
      if (excludeBasicLands && BASIC_LANDS.has(dc.card.name)) return false;
      if (excludedCardIds.has(dc.card_id)) return false;
      return true;
    });
  };

  const filteredMain = useMemo(() => filterCards(mainCards), [mainCards, excludeBasicLands, excludedCardIds]);
  const filteredSide = useMemo(() => filterCards(sideCards), [sideCards, excludeBasicLands, excludedCardIds]);

  // Group by type for the preview
  const groupedMain = useMemo(() => {
    const groups: Record<string, DeckCard[]> = {};
    for (const dc of filteredMain) {
      if (!dc.card) continue;
      const cat = getCardTypeCategory(dc.card.type_line);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(dc);
    }
    return TYPE_ORDER.filter(t => groups[t]?.length).map(t => ({ type: t, cards: groups[t] }));
  }, [filteredMain]);

  const toggleExclude = (cardId: string) => {
    setExcludedCardIds(prev => {
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

    // Main deck grouped by type
    for (const group of groupedMain) {
      lines.push(`// ${group.type}`);
      for (const dc of group.cards) {
        lines.push(`${dc.quantity} ${dc.card?.name}`);
      }
      lines.push('');
    }

    // Sideboard
    if (filteredSide.length > 0) {
      lines.push('// Sideboard');
      for (const dc of filteredSide) {
        lines.push(`${dc.quantity} ${dc.card?.name}`);
      }
    }

    return lines.join('\n').trim();
  }, [deckName, groupedMain, filteredSide]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = exportText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col
                   animate-fade-in mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-white/[0.06]">
          <div>
            <h2 className="font-display text-lg font-normal tracking-[0.12em] text-bone/90 uppercase">
              Export Deck
            </h2>
            <p className="text-ash/50 text-xs mt-1">{deckName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-ash hover:text-bone text-xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Options */}
        <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={excludeBasicLands}
              onChange={e => setExcludeBasicLands(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-mid/40 bg-slate-dark/50
                         checked:bg-mana-gold/60 checked:border-mana-gold/80
                         focus:ring-0 focus:ring-offset-0 accent-[#c9a832] cursor-pointer"
            />
            <span className="text-xs text-silver/70">Exclude basic lands</span>
          </label>
          <span className="text-ash/30 text-[10px]">
            {totalMain} main{totalSide > 0 ? ` · ${totalSide} side` : ''}
          </span>
        </div>

        {/* Card list preview */}
        <div className="flex-1 overflow-y-auto p-5">
          {groupedMain.length === 0 && filteredSide.length === 0 ? (
            <div className="text-center py-12 text-ash/40 text-sm">No cards to export</div>
          ) : (
            <div className="space-y-4">
              {groupedMain.map(group => (
                <div key={group.type}>
                  <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/[0.04]">
                    <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-ash/50">
                      {group.type}
                    </h4>
                    <span className="text-[10px] text-ash/30">
                      {group.cards.reduce((s, c) => s + c.quantity, 0)}
                    </span>
                  </div>
                  <div className="space-y-px">
                    {group.cards.map(dc => (
                      <div
                        key={dc.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/[0.03] group"
                      >
                        <span className="text-bone/60 text-xs font-medium tabular-nums w-5 text-center">
                          {dc.quantity}
                        </span>
                        <span className="flex-1 text-silver/70 text-xs truncate">
                          {dc.card?.name}
                        </span>
                        <ManaSymbols cost={dc.card?.mana_cost || ''} />
                        <button
                          onClick={() => toggleExclude(dc.card_id)}
                          className="w-5 h-5 rounded flex items-center justify-center
                                     text-ash/30 hover:text-mana-red/70 cursor-pointer
                                     opacity-0 group-hover:opacity-100 transition-all"
                          title="Exclude from export"
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {filteredSide.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-white/[0.04]">
                    <h4 className="text-[10px] font-medium uppercase tracking-[0.14em] text-ash/50">
                      Sideboard
                    </h4>
                    <span className="text-[10px] text-ash/30">{totalSide}</span>
                  </div>
                  <div className="space-y-px">
                    {filteredSide.map(dc => (
                      <div
                        key={dc.id}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/[0.03] group"
                      >
                        <span className="text-bone/60 text-xs font-medium tabular-nums w-5 text-center">
                          {dc.quantity}
                        </span>
                        <span className="flex-1 text-silver/70 text-xs truncate">
                          {dc.card?.name}
                        </span>
                        <ManaSymbols cost={dc.card?.mana_cost || ''} />
                        <button
                          onClick={() => toggleExclude(dc.card_id)}
                          className="w-5 h-5 rounded flex items-center justify-center
                                     text-ash/30 hover:text-mana-red/70 cursor-pointer
                                     opacity-0 group-hover:opacity-100 transition-all"
                          title="Exclude from export"
                        >
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M1 1l6 6M7 1l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-ash/60 hover:text-silver text-xs cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCopy}
            className={`px-5 py-2.5 rounded-xl font-medium text-xs tracking-wide transition-all cursor-pointer
              ${copied
                ? 'bg-mana-green/15 border border-mana-green/30 text-mana-green'
                : 'bg-mana-gold/10 border border-mana-gold/25 text-mana-gold/80 hover:bg-mana-gold/18 hover:text-mana-gold'
              }`}
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
