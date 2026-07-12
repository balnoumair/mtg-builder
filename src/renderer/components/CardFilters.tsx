import { useState, useEffect, useMemo, useRef } from 'react';
import type { CardFilters as Filters, CardSet } from '../../shared/types';
import { buildSetDropdownEntries } from '../../shared/setOrdering';
import { Mana } from './ManaSymbols';
import { getManaMeta } from '../lib/mana';
import { useSets } from '../hooks/useSets';

const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;
const CMC_VALUES: (number | '7+')[] = [0, 1, 2, 3, 4, 5, 6, '7+'];
const TYPES = ['All', 'Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land'];

interface Props {
  filters: Filters;
  onUpdate: (updates: Partial<Filters>) => void;
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-mute)',
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function SetIcon({ uri, code, size = 16 }: { uri?: string | null; code: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = uri ?? `https://svgs.scryfall.io/sets/${code.toLowerCase()}.svg`;
  if (failed) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      style={{
        flexShrink: 0,
        objectFit: 'contain',
        display: 'block',
        filter: 'brightness(0) invert(1)',
        opacity: 0.72,
      }}
    />
  );
}

function SetRow({
  s,
  checked,
  onToggle,
}: {
  s: CardSet;
  checked: boolean;
  onToggle: (code: string) => void;
}) {
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onToggle(s.code)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle(s.code);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-row-hov)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <div
        style={{
          width: 13,
          height: 13,
          borderRadius: 3,
          background: checked ? 'var(--accent)' : 'transparent',
          border: `1px solid ${checked ? 'var(--accent)' : 'var(--border-strong)'}`,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1.5 4L3.5 6L6.5 2"
              stroke="var(--accent-ink)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      <SetIcon uri={s.iconSvgUri} code={s.code} size={16} />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: 'var(--text-dim)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {s.name}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-mute)',
          textTransform: 'uppercase',
        }}
      >
        {s.code}
      </span>
    </div>
  );
}

function BlockHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 8px 2px' }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-faint)',
          userSelect: 'none',
        }}
      >
        {children}
      </span>
    </div>
  );
}

export default function CardFilters({ filters, onUpdate }: Props) {
  const sets = useSets();
  const [setMenuOpen, setSetMenuOpen] = useState(false);
  const [setSearch, setSetSearch] = useState('');
  const setMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!setMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (setMenuRef.current && !setMenuRef.current.contains(e.target as Node)) {
        setSetMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setMenuOpen]);

  const activeColors = filters.colors ?? [];
  const activeType = filters.types && filters.types.length === 1 ? filters.types[0] : 'All';
  const activeSets = filters.sets ?? [];

  const activeCmc: number | '7+' | null = (() => {
    if (filters.cmcMin === 7 && filters.cmcMax === undefined) return '7+';
    if (filters.cmcMin !== undefined && filters.cmcMin === filters.cmcMax) return filters.cmcMin;
    return null;
  })();

  const toggleColor = (code: string) => {
    const next = activeColors.includes(code)
      ? activeColors.filter((c) => c !== code)
      : [...activeColors, code];
    onUpdate({ colors: next.length > 0 ? next : undefined });
  };

  const setType = (t: string) => {
    onUpdate({ types: t === 'All' ? undefined : [t] });
  };

  const toggleCmc = (v: number | '7+') => {
    if (v === '7+') {
      if (activeCmc === '7+') onUpdate({ cmcMin: undefined, cmcMax: undefined });
      else onUpdate({ cmcMin: 7, cmcMax: undefined });
    } else {
      if (activeCmc === v) onUpdate({ cmcMin: undefined, cmcMax: undefined });
      else onUpdate({ cmcMin: v, cmcMax: v });
    }
  };

  const toggleSet = (code: string) => {
    const next = activeSets.includes(code)
      ? activeSets.filter((s) => s !== code)
      : [...activeSets, code];
    onUpdate({ sets: next.length > 0 ? next : undefined });
  };

  const sortedSets = useMemo(
    () => [...sets].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt)),
    [sets],
  );

  const filteredSets = useMemo(() => {
    const s = setSearch.toLowerCase();
    return sortedSets.filter(
      (x) => !s || x.name.toLowerCase().includes(s) || x.code.toLowerCase().includes(s),
    );
  }, [sortedSets, setSearch]);

  const groupedEntries = useMemo(() => {
    if (setSearch) return null;
    return buildSetDropdownEntries(sets);
  }, [sets, setSearch]);

  const hasFilters =
    activeColors.length > 0 ||
    activeType !== 'All' ||
    activeCmc !== null ||
    activeSets.length > 0 ||
    !!(filters.query && filters.query.length > 0);

  const clearAll = () => {
    onUpdate({
      query: undefined,
      colors: undefined,
      types: undefined,
      rarity: undefined,
      sets: undefined,
      cmcMin: undefined,
      cmcMax: undefined,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Row 1: Color · Cost · Edition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterGroup label="Color">
          <div style={{ display: 'flex', gap: 3 }}>
            {COLOR_KEYS.map((c) => {
              const active = activeColors.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleColor(c)}
                  title={getManaMeta(c).name}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 0,
                  }}
                >
                  <Mana symbol={c} size={12} />
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup label="Cost">
          <div style={{ display: 'flex', gap: 2 }}>
            {CMC_VALUES.map((v) => {
              const active = activeCmc === v;
              const label = v === '7+' ? '7+' : String(v);
              const title = v === '7+' ? 'CMC 7 or more' : `CMC ${v}`;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleCmc(v)}
                  title={title}
                  style={{
                    minWidth: 22,
                    height: 22,
                    padding: '0 5px',
                    borderRadius: 'var(--radius-sm)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
                    color: active ? 'var(--text)' : 'var(--text-dim)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        {/* Edition dropdown */}
        <div ref={setMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setSetMenuOpen((o) => !o)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 9px',
              background: activeSets.length ? 'var(--accent-soft)' : 'var(--bg-chip)',
              border: `1px solid ${activeSets.length ? 'var(--accent-line)' : 'var(--border-strong)'}`,
              color: activeSets.length ? 'var(--text)' : 'var(--text-dim)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7 }}>
              <rect x="1" y="1" width="4" height="4" rx="0.8" fill="currentColor" />
              <rect x="7" y="1" width="4" height="4" rx="0.8" fill="currentColor" />
              <rect x="1" y="7" width="4" height="4" rx="0.8" fill="currentColor" />
              <rect x="7" y="7" width="4" height="4" rx="0.8" fill="currentColor" />
            </svg>
            Edition{activeSets.length ? ` · ${activeSets.length}` : ''}
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{
                opacity: 0.5,
                transform: setMenuOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 120ms',
              }}
            >
              <path
                d="M1 2.5L4 5.5L7 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {setMenuOpen && (
            <div
              className="animate-popover-in"
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                zIndex: 50,
                width: 280,
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 18px 40px rgba(0,0,0,0.55)',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                <input
                  autoFocus
                  value={setSearch}
                  onChange={(e) => setSetSearch(e.target.value)}
                  placeholder="Search sets…"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text)',
                    fontSize: 12,
                    fontFamily: 'var(--font-ui)',
                  }}
                />
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: 4 }}>
                {groupedEntries ? (
                  groupedEntries.length === 0 ? (
                    <div
                      style={{
                        padding: '10px',
                        fontSize: 11,
                        color: 'var(--text-mute)',
                        textAlign: 'center',
                      }}
                    >
                      No sets found
                    </div>
                  ) : (
                    groupedEntries.map((entry, idx) => {
                      if (entry.kind === 'block') {
                        return (
                          <div key={`b-${entry.group.blockCode}`}>
                            <BlockHeader>{entry.group.blockName}</BlockHeader>
                            {entry.group.sets.map((s) => (
                              <SetRow
                                key={s.code}
                                s={s}
                                checked={activeSets.includes(s.code)}
                                onToggle={toggleSet}
                              />
                            ))}
                          </div>
                        );
                      }
                      const prev = groupedEntries[idx - 1];
                      const showHeader = !prev || prev.kind !== 'standalone';
                      return (
                        <div key={`s-${entry.set.code}`}>
                          {showHeader && <BlockHeader>Standalone</BlockHeader>}
                          <SetRow
                            s={entry.set}
                            checked={activeSets.includes(entry.set.code)}
                            onToggle={toggleSet}
                          />
                        </div>
                      );
                    })
                  )
                ) : filteredSets.length === 0 ? (
                  <div
                    style={{
                      padding: '10px',
                      fontSize: 11,
                      color: 'var(--text-mute)',
                      textAlign: 'center',
                    }}
                  >
                    No sets found
                  </div>
                ) : (
                  filteredSets.map((s) => (
                    <SetRow
                      key={s.code}
                      s={s}
                      checked={activeSets.includes(s.code)}
                      onToggle={toggleSet}
                    />
                  ))
                )}
              </div>
              {activeSets.length > 0 && (
                <div
                  style={{
                    borderTop: '1px solid var(--border)',
                    padding: '6px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}
                  >
                    {activeSets.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdate({ sets: undefined })}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-mute)',
              cursor: 'pointer',
              fontSize: 11,
              fontFamily: 'var(--font-ui)',
            }}
          >
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
              <path
                d="M2 2L8 8M8 2L2 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Clear
          </button>
        )}
      </div>

      {/* Row 2: Types */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {TYPES.map((t) => {
          const active = activeType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              style={{
                padding: '3px 8px',
                background: active ? 'var(--bg-row-sel)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--text-mute)',
                border: `1px solid ${active ? 'var(--border-strong)' : 'transparent'}`,
                borderRadius: 'var(--radius-sm)',
                fontSize: 11,
                fontFamily: 'var(--font-ui)',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
