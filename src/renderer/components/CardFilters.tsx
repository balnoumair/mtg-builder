import { useState, useEffect, useMemo, useRef } from 'react';
import type { CardFilters as Filters } from '../../shared/types';

const COLORS = [
  { code: 'W', label: 'White', color: '#e8e4cc', glow: 'rgba(232,228,204,0.35)' },
  { code: 'U', label: 'Blue',  color: '#2e8fd4', glow: 'rgba(46,143,212,0.35)' },
  { code: 'B', label: 'Black', color: '#b09acc', glow: 'rgba(176,154,204,0.35)' },
  { code: 'R', label: 'Red',   color: '#e84040', glow: 'rgba(232,64,64,0.35)' },
  { code: 'G', label: 'Green', color: '#1db868', glow: 'rgba(29,184,104,0.35)' },
];

const CMC_VALUES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

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

function SetRow({ s, selected, onToggle }: { s: { code: string; name: string }; selected: boolean; onToggle: (code: string) => void }) {
  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={() => onToggle(s.code)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle(s.code); } }}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-mid/15 cursor-pointer group"
    >
      <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition-all
        ${selected ? 'bg-mana-gold/80 border-mana-gold' : 'border-slate-mid/40 group-hover:border-slate-mid/70'}`}>
        {selected && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path d="M1.5 4L3.5 6L6.5 2" stroke="#0a0a0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className="text-xs text-silver/80 truncate group-hover:text-silver transition-colors">{s.name}</span>
      <span className="text-[10px] text-ash/50 ml-auto shrink-0 font-mono">{s.code.toUpperCase()}</span>
    </div>
  );
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="font-display text-[9px] tracking-[0.18em] text-ash/40 uppercase select-none leading-none">
    {children}
  </span>
);

export default function CardFilters({ filters, onUpdate }: Props) {
  const [sets, setSets] = useState<{ code: string; name: string; releasedAt: string; blockCode: string | null; blockName: string | null }[]>([]);
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

  const toggleCmc = (val: number) => {
    const is7Plus = val === 7;
    const activeExact = !is7Plus && filters.cmcMin === val && filters.cmcMax === val;
    const active7Plus = is7Plus && filters.cmcMin === 7 && filters.cmcMax === undefined;
    if (activeExact || active7Plus) {
      onUpdate({ cmcMin: undefined, cmcMax: undefined });
    } else if (is7Plus) {
      onUpdate({ cmcMin: 7, cmcMax: undefined });
    } else {
      onUpdate({ cmcMin: val, cmcMax: val });
    }
  };

  type SetEntry = typeof sets[number];
  type BlockGroup = { blockCode: string; blockName: string; sets: SetEntry[]; latestRelease: string };
  type DropdownEntry =
    | { kind: 'block'; group: BlockGroup; sortKey: string }
    | { kind: 'standalone'; set: SetEntry; sortKey: string };

  const sortedSets = useMemo(
    () => [...sets].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt)),
    [sets],
  );

  const filteredSets = useMemo(
    () => sortedSets.filter(s =>
      s.name.toLowerCase().includes(setSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(setSearch.toLowerCase())
    ),
    [sortedSets, setSearch],
  );

  const groupedEntries = useMemo<DropdownEntry[] | null>(() => {
    if (setSearch) return null;
    const blockMap = new Map<string, BlockGroup>();
    const entries: DropdownEntry[] = [];
    for (const s of sortedSets) {
      if (s.blockCode && s.blockName && s.blockName !== 'Core Set') {
        if (!blockMap.has(s.blockCode)) {
          const group: BlockGroup = { blockCode: s.blockCode, blockName: s.blockName, sets: [], latestRelease: '' };
          blockMap.set(s.blockCode, group);
          entries.push({ kind: 'block', group, sortKey: '' });
        }
        const g = blockMap.get(s.blockCode)!;
        g.sets.push(s);
        if (s.releasedAt > g.latestRelease) g.latestRelease = s.releasedAt;
      } else {
        entries.push({ kind: 'standalone', set: s, sortKey: s.releasedAt });
      }
    }
    for (const e of entries) {
      if (e.kind === 'block') e.sortKey = e.group.latestRelease;
    }
    entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
    return entries;
  }, [sortedSets, setSearch]);

  const hasFilters = (filters.colors?.length || 0) > 0
    || (filters.types?.length || 0) > 0
    || (filters.rarity?.length || 0) > 0
    || (filters.sets?.length || 0) > 0
    || filters.cmcMin !== undefined
    || filters.cmcMax !== undefined;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-slate-dark/20 border border-slate-mid/10 px-4 py-3">

      {/* Row 1: Visual filters — Color · CMC · Rarity */}
      <div className="flex items-end justify-evenly">

        {/* Colors */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Color</SectionLabel>
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
                    backgroundColor: active ? c.color + '38' : c.color + '12',
                    borderColor: active ? c.color + 'cc' : c.color + '44',
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
        </div>

        <div className="w-px h-8 bg-slate-mid/15 self-end mb-0.5" />

        {/* Mana Cost */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Mana</SectionLabel>
          <div className="flex items-center gap-1">
            {CMC_VALUES.map(val => {
              const is7Plus = val === 7;
              const active = is7Plus
                ? filters.cmcMin === 7 && filters.cmcMax === undefined
                : filters.cmcMin === val && filters.cmcMax === val;
              return (
                <button
                  key={val}
                  onClick={() => toggleCmc(val)}
                  title={is7Plus ? 'CMC 7 or more' : `CMC ${val}`}
                  className={`w-6.5 h-6.5 rounded-md border transition-all duration-150 cursor-pointer flex items-center justify-center text-[10px] font-bold select-none
                    ${active
                      ? 'bg-violet-500/20 border-violet-400/60 text-violet-300'
                      : 'bg-slate-dark/30 border-slate-mid/15 text-silver/40 hover:text-silver/70 hover:border-slate-mid/30 hover:bg-slate-dark/50'
                    }`}
                  style={active ? { boxShadow: '0 0 8px rgba(139,92,246,0.35)' } : undefined}
                >
                  {is7Plus ? '7+' : val}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-px h-8 bg-slate-mid/15 self-end mb-0.5" />

        {/* Rarity */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Rarity</SectionLabel>
          <div className="flex items-center gap-1.5">
            {RARITIES.map(r => {
              const active = (filters.rarity || []).includes(r.key);
              return (
                <button
                  key={r.key}
                  onClick={() => toggleRarity(r.key)}
                  title={r.key}
                  className="w-7 h-7 rounded-full border-2 transition-all duration-150 cursor-pointer flex items-center justify-center text-[10px] font-bold tracking-wide select-none capitalize"
                  style={{
                    backgroundColor: active ? r.color + '30' : r.color + '0a',
                    borderColor: active ? r.color + 'cc' : r.color + '35',
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
        </div>
      </div>

      {/* Divider between rows */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-mid/15 to-transparent" />

      {/* Row 2: Text filters — Types · Sets · Clear */}
      <div className="flex items-center gap-3">

        {/* Type pills */}
        <div className="flex items-center gap-1">
          {TYPES.map(t => {
            const active = (filters.types || []).includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-2 py-1 rounded-md text-[11px] transition-all cursor-pointer border
                  ${active
                    ? 'bg-mana-gold/12 text-mana-gold border-mana-gold/35 shadow-[0_0_6px_rgba(201,168,50,0.15)]'
                    : 'text-silver/45 border-slate-mid/15 bg-transparent hover:text-silver/75 hover:border-slate-mid/30 hover:bg-slate-dark/30'
                  }`}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div className="w-px h-5 bg-slate-mid/15" />

        {/* Set picker */}
        <div className="relative" ref={setDropdownRef}>
          <button
            onClick={() => setSetDropdownOpen(!setDropdownOpen)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer border
              ${(filters.sets?.length || 0) > 0
                ? 'bg-mana-gold/10 border-mana-gold/40 text-mana-gold'
                : 'bg-transparent border-slate-mid/15 text-silver/45 hover:text-silver/75 hover:border-slate-mid/30'
              }`}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="opacity-60">
              <rect x="1" y="1" width="4" height="4" rx="0.8" fill="currentColor"/>
              <rect x="7" y="1" width="4" height="4" rx="0.8" fill="currentColor"/>
              <rect x="1" y="7" width="4" height="4" rx="0.8" fill="currentColor"/>
              <rect x="7" y="7" width="4" height="4" rx="0.8" fill="currentColor"/>
            </svg>
            Sets{(filters.sets?.length || 0) > 0 ? ` (${filters.sets!.length})` : ''}
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className={`opacity-40 transition-transform duration-150 ${setDropdownOpen ? 'rotate-180' : ''}`}>
              <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {setDropdownOpen && (
            <div
              className="absolute top-full mt-1.5 left-0 z-50 w-64 rounded-xl border border-slate-mid/25 shadow-2xl overflow-hidden animate-popover-in"
              style={{ background: 'rgba(18,18,28,0.98)' }}
            >
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
                {groupedEntries ? (
                  <>
                    {groupedEntries.map((entry, idx) => {
                      if (entry.kind === 'block') {
                        return (
                          <div key={`b-${entry.group.blockCode}`}>
                            <div className="px-2 pt-2 pb-0.5">
                              <span className="text-[9px] tracking-[0.15em] uppercase text-ash/40 font-medium select-none">{entry.group.blockName}</span>
                            </div>
                            {entry.group.sets.map(s => <SetRow key={s.code} s={s} selected={(filters.sets || []).includes(s.code)} onToggle={toggleSet} />)}
                          </div>
                        );
                      }
                      const prev = groupedEntries[idx - 1];
                      const showHeader = !prev || prev.kind !== 'standalone';
                      return (
                        <div key={`s-${entry.set.code}`}>
                          {showHeader && (
                            <div className="px-2 pt-2 pb-0.5">
                              <span className="text-[9px] tracking-[0.15em] uppercase text-ash/40 font-medium select-none">Standalone</span>
                            </div>
                          )}
                          <SetRow s={entry.set} selected={(filters.sets || []).includes(entry.set.code)} onToggle={toggleSet} />
                        </div>
                      );
                    })}
                    {groupedEntries.length === 0 && (
                      <p className="text-xs text-ash/50 px-2 py-3 text-center">No sets found</p>
                    )}
                  </>
                ) : (
                  <>
                    {filteredSets.map(s => <SetRow key={s.code} s={s} selected={(filters.sets || []).includes(s.code)} onToggle={toggleSet} />)}
                    {filteredSets.length === 0 && (
                      <p className="text-xs text-ash/50 px-2 py-3 text-center">No sets found</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => onUpdate({ colors: undefined, types: undefined, rarity: undefined, sets: undefined, cmcMin: undefined, cmcMax: undefined })}
            className="ml-auto flex items-center gap-1 text-[10px] text-ash/40 hover:text-mana-red/70 transition-colors cursor-pointer"
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
}
