import { useState, useEffect, useRef } from 'react';
import type { CardFilters as Filters } from '../../shared/types';

const COLORS = [
  { code: 'W', label: 'White', color: '#e8e4cc', glow: 'rgba(232,228,204,0.35)' },
  { code: 'U', label: 'Blue',  color: '#2e8fd4', glow: 'rgba(46,143,212,0.35)' },
  { code: 'B', label: 'Black', color: '#b09acc', glow: 'rgba(176,154,204,0.35)' },
  { code: 'R', label: 'Red',   color: '#e84040', glow: 'rgba(232,64,64,0.35)' },
  { code: 'G', label: 'Green', color: '#1db868', glow: 'rgba(29,184,104,0.35)' },
];

const TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];
const RARITIES: { key: string; label: string; color: string }[] = [
  { key: 'common',   label: 'C', color: '#8888a0' },
  { key: 'uncommon', label: 'U', color: '#b0b8c0' },
  { key: 'rare',     label: 'R', color: '#c9a832' },
  { key: 'mythic',   label: 'M', color: '#d35030' },
];

interface Props {
  filters: Filters;
  onUpdate: (updates: Partial<Filters>) => void;
}

export default function CardFilters({ filters, onUpdate }: Props) {
  const [sets, setSets] = useState<{ code: string; name: string; releasedAt: string }[]>([]);
  const [setDropdownOpen, setSetDropdownOpen] = useState(false);
  const [setSearch, setSetSearch] = useState('');
  const setDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.electronAPI.getSets().then(setSets);
  }, []);

  useEffect(() => {
    if (!setDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (setDropdownRef.current && !setDropdownRef.current.contains(e.target as Node)) {
        setSetDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setDropdownOpen]);

  const toggleColor = (code: string) => {
    const current = filters.colors || [];
    const next = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    onUpdate({ colors: next.length > 0 ? next : undefined });
  };

  const toggleType = (type: string) => {
    const current = filters.types || [];
    const next = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    onUpdate({ types: next.length > 0 ? next : undefined });
  };

  const toggleRarity = (rarity: string) => {
    const current = filters.rarity || [];
    const next = current.includes(rarity)
      ? current.filter(r => r !== rarity)
      : [...current, rarity];
    onUpdate({ rarity: next.length > 0 ? next : undefined });
  };

  const toggleSet = (code: string) => {
    const current = filters.sets || [];
    const next = current.includes(code)
      ? current.filter(s => s !== code)
      : [...current, code];
    onUpdate({ sets: next.length > 0 ? next : undefined });
  };

  const sortedSets = [...sets].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));

  const filteredSets = sortedSets.filter(s =>
    s.name.toLowerCase().includes(setSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(setSearch.toLowerCase())
  );

  const hasFilters = (filters.colors?.length || 0) > 0
    || (filters.types?.length || 0) > 0
    || (filters.rarity?.length || 0) > 0
    || (filters.sets?.length || 0) > 0;

  return (
    <div className="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-dark/30 border border-slate-mid/15">

      {/* Set picker */}
      <div className="relative" ref={setDropdownRef}>
        <button
          onClick={() => setSetDropdownOpen(!setDropdownOpen)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer border
            ${(filters.sets?.length || 0) > 0
              ? 'bg-mana-gold/10 border-mana-gold/40 text-mana-gold'
              : 'bg-slate-dark/60 border-slate-mid/25 text-silver/70 hover:text-silver hover:border-slate-mid/50'
            }`}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="opacity-70">
            <rect x="1" y="1" width="4" height="4" rx="0.8" fill="currentColor"/>
            <rect x="7" y="1" width="4" height="4" rx="0.8" fill="currentColor"/>
            <rect x="1" y="7" width="4" height="4" rx="0.8" fill="currentColor"/>
            <rect x="7" y="7" width="4" height="4" rx="0.8" fill="currentColor"/>
          </svg>
          Sets{(filters.sets?.length || 0) > 0 ? ` (${filters.sets!.length})` : ''}
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`opacity-50 transition-transform ${setDropdownOpen ? 'rotate-180' : ''}`}>
            <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {setDropdownOpen && (
          <div className="absolute top-full mt-1.5 left-0 z-50 w-64 rounded-xl border border-slate-mid/25 shadow-2xl overflow-hidden"
            style={{ background: 'rgba(18,18,28,0.97)', backdropFilter: 'blur(16px)' }}>
            <div className="px-3 py-2 border-b border-slate-mid/20">
              <input
                type="text"
                placeholder="Search sets…"
                value={setSearch}
                onChange={e => setSetSearch(e.target.value)}
                className="w-full text-xs bg-transparent text-bone placeholder:text-ash/40 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto p-1.5">
              {filteredSets.map(s => (
                <label
                  key={s.code}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-mid/15 cursor-pointer group"
                >
                  <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all
                    ${(filters.sets || []).includes(s.code)
                      ? 'bg-mana-gold/80 border-mana-gold'
                      : 'border-slate-mid/40 group-hover:border-slate-mid/70'
                    }`}>
                    {(filters.sets || []).includes(s.code) && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <input type="checkbox" checked={(filters.sets || []).includes(s.code)} onChange={() => toggleSet(s.code)} className="sr-only" />
                  </div>
                  <span className="text-xs text-silver/80 truncate group-hover:text-silver transition-colors">{s.name}</span>
                  <span className="text-[10px] text-ash/50 ml-auto shrink-0 font-mono">{s.code.toUpperCase()}</span>
                </label>
              ))}
              {filteredSets.length === 0 && (
                <p className="text-xs text-ash/50 px-2 py-3 text-center">No sets found</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-slate-mid/25 self-center" />

      {/* Color filters */}
      <div className="flex items-center gap-1.5">
        {COLORS.map(c => {
          const active = (filters.colors || []).includes(c.code);
          return (
            <button
              key={c.code}
              onClick={() => toggleColor(c.code)}
              title={c.label}
              className="w-7 h-7 rounded-full border-2 transition-all duration-150 cursor-pointer flex items-center justify-center text-[10px] font-bold tracking-wide select-none"
              style={{
                backgroundColor: active ? c.color + '38' : c.color + '18',
                borderColor: active ? c.color + 'cc' : c.color + '55',
                color: c.color,
                boxShadow: active ? `0 0 10px ${c.glow}, inset 0 0 8px ${c.color}15` : 'none',
                transform: active ? 'scale(1.12)' : 'scale(1)',
              }}
            >
              {c.code}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-slate-mid/25 self-center" />

      {/* Type filter */}
      <div className="flex flex-wrap gap-1">
        {TYPES.map(t => {
          const active = (filters.types || []).includes(t);
          return (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-2 py-1 rounded-md text-xs transition-all cursor-pointer border
                ${active
                  ? 'bg-mana-gold/12 text-mana-gold border-mana-gold/35'
                  : 'text-silver/55 border-slate-mid/20 bg-slate-dark/40 hover:text-silver hover:border-slate-mid/40 hover:bg-slate-dark/70'
                }`}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="w-px h-5 bg-slate-mid/25 self-center" />

      {/* Rarity filter */}
      <div className="flex gap-1">
        {RARITIES.map(r => {
          const active = (filters.rarity || []).includes(r.key);
          return (
            <button
              key={r.key}
              onClick={() => toggleRarity(r.key)}
              title={r.key}
              className="w-7 h-7 rounded-full border-2 transition-all duration-150 cursor-pointer flex items-center justify-center text-[10px] font-bold tracking-wide select-none capitalize"
              style={{
                backgroundColor: active ? r.color + '30' : r.color + '12',
                borderColor: active ? r.color + 'cc' : r.color + '40',
                color: r.color,
                boxShadow: active ? `0 0 8px ${r.color}50` : 'none',
                transform: active ? 'scale(1.12)' : 'scale(1)',
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Clear */}
      {hasFilters && (
        <button
          onClick={() => onUpdate({ colors: undefined, types: undefined, rarity: undefined, sets: undefined })}
          className="ml-1 flex items-center gap-1 text-[11px] text-ash/50 hover:text-mana-red/80 transition-colors cursor-pointer"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}
