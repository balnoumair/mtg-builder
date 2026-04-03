import { useState, useEffect, useRef } from 'react';
import type { CardFilters as Filters } from '../../shared/types';

const COLORS = [
  { code: 'W', label: 'White', color: '#f9faf4' },
  { code: 'U', label: 'Blue', color: '#0e68ab' },
  { code: 'B', label: 'Black', color: '#6b5c7a' },
  { code: 'R', label: 'Red', color: '#d3202a' },
  { code: 'G', label: 'Green', color: '#00733e' },
];

const TYPES = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];
const RARITIES = ['common', 'uncommon', 'rare', 'mythic'];
const FORMATS = ['standard', 'modern', 'pioneer', 'legacy', 'vintage', 'pauper', 'commander'];

interface Props {
  filters: Filters;
  onUpdate: (updates: Partial<Filters>) => void;
}

export default function CardFilters({ filters, onUpdate }: Props) {
  const [sets, setSets] = useState<{ code: string; name: string }[]>([]);
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

  const filteredSets = sets.filter(s =>
    s.name.toLowerCase().includes(setSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(setSearch.toLowerCase())
  );

  const hasFilters = (filters.colors?.length || 0) > 0
    || (filters.types?.length || 0) > 0
    || (filters.rarity?.length || 0) > 0
    || filters.format
    || filters.cmcMin !== undefined
    || filters.cmcMax !== undefined
    || (filters.sets?.length || 0) > 0;

  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      {/* Color filters */}
      <div className="flex items-center gap-1">
        {COLORS.map(c => (
          <button
            key={c.code}
            onClick={() => toggleColor(c.code)}
            title={c.label}
            className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer flex items-center justify-center text-[10px] font-bold
              ${(filters.colors || []).includes(c.code)
                ? 'border-white/40 scale-110'
                : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            style={{ backgroundColor: c.color + '30', color: c.color }}
          >
            {c.code}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-slate-mid/30" />

      {/* Type filter */}
      <div className="flex flex-wrap gap-1">
        {TYPES.map(t => (
          <button
            key={t}
            onClick={() => toggleType(t)}
            className={`px-2 py-1 rounded-md text-xs transition-all cursor-pointer
              ${(filters.types || []).includes(t)
                ? 'bg-mana-gold/15 text-mana-gold border border-mana-gold/30'
                : 'text-ash hover:text-silver border border-transparent hover:bg-obsidian'
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-slate-mid/30" />

      {/* Rarity filter */}
      <div className="flex gap-1">
        {RARITIES.map(r => (
          <button
            key={r}
            onClick={() => toggleRarity(r)}
            className={`px-2 py-1 rounded-md text-xs capitalize transition-all cursor-pointer
              ${(filters.rarity || []).includes(r)
                ? 'bg-obsidian text-bone border border-slate-mid/50'
                : 'text-ash hover:text-silver border border-transparent'
              }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-slate-mid/30" />

      {/* Format */}
      <select
        value={filters.format || ''}
        onChange={e => onUpdate({ format: e.target.value || undefined })}
        className="bg-obsidian border border-slate-mid/30 rounded-lg px-2 py-1
                   text-xs text-silver focus:outline-none focus:border-mana-gold/40 cursor-pointer"
      >
        <option value="">All Formats</option>
        {FORMATS.map(f => (
          <option key={f} value={f} className="capitalize">{f}</option>
        ))}
      </select>

      {/* CMC range */}
      <div className="flex items-center gap-1">
        <span className="text-ash text-xs">CMC</span>
        <input
          type="number"
          min="0"
          max="20"
          placeholder="min"
          value={filters.cmcMin ?? ''}
          onChange={e => onUpdate({ cmcMin: e.target.value ? Number(e.target.value) : undefined })}
          className="w-12 bg-obsidian border border-slate-mid/30 rounded-md px-1.5 py-1
                     text-xs text-silver text-center focus:outline-none focus:border-mana-gold/40"
        />
        <span className="text-ash text-xs">-</span>
        <input
          type="number"
          min="0"
          max="20"
          placeholder="max"
          value={filters.cmcMax ?? ''}
          onChange={e => onUpdate({ cmcMax: e.target.value ? Number(e.target.value) : undefined })}
          className="w-12 bg-obsidian border border-slate-mid/30 rounded-md px-1.5 py-1
                     text-xs text-silver text-center focus:outline-none focus:border-mana-gold/40"
        />
      </div>

      <div className="w-px h-6 bg-slate-mid/30" />

      {/* Set picker */}
      <div className="relative" ref={setDropdownRef}>
        <button
          onClick={() => setSetDropdownOpen(!setDropdownOpen)}
          className={`bg-obsidian border rounded-lg px-2 py-1 text-xs transition-all cursor-pointer
            ${(filters.sets?.length || 0) > 0
              ? 'border-mana-gold/40 text-mana-gold'
              : 'border-slate-mid/30 text-silver'
            } focus:outline-none focus:border-mana-gold/40`}
        >
          Sets{(filters.sets?.length || 0) > 0 ? ` (${filters.sets!.length})` : ''}
        </button>
        {setDropdownOpen && (
          <div className="absolute top-full mt-1 left-0 z-50 w-64 bg-obsidian border border-slate-mid/30 rounded-lg shadow-lg">
            <input
              type="text"
              placeholder="Search sets..."
              value={setSearch}
              onChange={e => setSetSearch(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-transparent border-b border-slate-mid/30
                         text-bone placeholder:text-ash/50 focus:outline-none"
              autoFocus
            />
            <div className="max-h-60 overflow-y-auto p-1">
              {filteredSets.map(s => (
                <label
                  key={s.code}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-mid/10 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={(filters.sets || []).includes(s.code)}
                    onChange={() => toggleSet(s.code)}
                    className="accent-amber-500"
                  />
                  <span className="text-xs text-silver truncate">{s.name}</span>
                  <span className="text-xs text-ash ml-auto shrink-0">{s.code.toUpperCase()}</span>
                </label>
              ))}
              {filteredSets.length === 0 && (
                <p className="text-xs text-ash px-2 py-2">No sets found</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clear button */}
      {hasFilters && (
        <button
          onClick={() => onUpdate({
            colors: undefined, types: undefined, rarity: undefined,
            format: undefined, cmcMin: undefined, cmcMax: undefined, sets: undefined,
          })}
          className="text-xs text-ash hover:text-mana-red transition-colors cursor-pointer"
        >
          Clear
        </button>
      )}
    </div>
  );
}
