import { useState, useEffect, useMemo, useRef } from 'react';
import type { CardFilters as Filters, CardSet } from '../../shared/types';
import { buildSetDropdownEntries, type SetDropdownEntry } from '../../shared/setOrdering';
import { Mana } from './ManaSymbols';
import { manaNameKey, typeCategoryKey } from '../lib/mana';
import { useSets } from '../hooks/useSets';
import { useI18n } from '../i18n/I18nProvider';

const COLOR_KEYS = ['W', 'U', 'B', 'R', 'G'] as const;
const COLOR_CATEGORY_FILTERS = [
  { value: 'multicolor' as const, symbol: 'M', color: '#c9a86c' },
  { value: 'colorless' as const, symbol: 'C', color: '#bdb7af' },
];
const MANA_VALUE_VALUES: (number | '7+')[] = [0, 1, 2, 3, 4, 5, 6, '7+'];
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

function BlockHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ padding: '8px 8px 2px', display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          flex: 1,
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
      {action}
    </div>
  );
}

function BlockToggle({ allSelected, blockName, onClick }: { allSelected: boolean; blockName: string; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(allSelected ? 'filters.deselectAllInBlock' : 'filters.selectAllInBlock', { block: blockName })}
      style={{
        padding: 0,
        background: 'transparent',
        border: 'none',
        color: 'var(--text-mute)',
        fontFamily: 'var(--font-ui)',
        fontSize: 10,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--accent)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-mute)';
      }}
    >
      {allSelected ? t('filters.deselectAll') : t('filters.selectAll')}
    </button>
  );
}

const SET_MENU_W = 280;
const SET_MENU_MARGIN = 8;

export default function CardFilters({ filters, onUpdate }: Props) {
  const { t } = useI18n();
  const sets = useSets();
  const [setMenuOpen, setSetMenuOpen] = useState(false);
  const [setSearch, setSetSearch] = useState('');
  const [setMenuPos, setSetMenuPos] = useState({ top: 0, left: 0, maxListHeight: 280 });
  const setMenuRef = useRef<HTMLDivElement>(null);
  const setMenuBtnRef = useRef<HTMLButtonElement>(null);
  const setListRef = useRef<HTMLDivElement>(null);

  // The menu renders position:fixed so it can overlap neighboring panes
  // instead of being squeezed by a narrow search panel.
  const toggleSetMenu = () => {
    if (setMenuOpen) {
      setSetMenuOpen(false);
      return;
    }
    const rect = setMenuBtnRef.current?.getBoundingClientRect();
    if (rect) {
      const top = rect.bottom + 6;
      const left = Math.max(
        SET_MENU_MARGIN,
        Math.min(rect.left, window.innerWidth - SET_MENU_W - SET_MENU_MARGIN),
      );
      const maxListHeight = Math.min(280, window.innerHeight - top - 48);
      setSetMenuPos({ top, left, maxListHeight });
    }
    setSetMenuOpen(true);
  };

  useEffect(() => {
    if (!setMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (setMenuRef.current && !setMenuRef.current.contains(e.target as Node)) {
        setSetMenuOpen(false);
      }
    };
    const close = () => setSetMenuOpen(false);
    document.addEventListener('mousedown', handler);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', handler);
      window.removeEventListener('resize', close);
    };
  }, [setMenuOpen]);

  const activeColors = filters.colors ?? [];
  const activeColorCategories = filters.colorCategories ?? [];
  const activeType = filters.types && filters.types.length === 1 ? filters.types[0] : 'All';
  const activeSets = filters.sets ?? [];
  const activeManaValues = filters.manaValues ?? [];

  const toggleColor = (code: string) => {
    const next = activeColors.includes(code)
      ? activeColors.filter((c) => c !== code)
      : [...activeColors, code];
    onUpdate({ colors: next.length > 0 ? next : undefined });
  };

  const toggleColorCategory = (category: 'multicolor' | 'colorless') => {
    const next = activeColorCategories.includes(category)
      ? activeColorCategories.filter((value) => value !== category)
      : [...activeColorCategories, category];
    onUpdate({ colorCategories: next.length > 0 ? next : undefined });
  };

  const setType = (type: string) => {
    onUpdate({ types: type === 'All' ? undefined : [type] });
  };

  const toggleManaValue = (value: number | '7+') => {
    const next = activeManaValues.includes(value)
      ? activeManaValues.filter((v) => v !== value)
      : [...activeManaValues, value];
    onUpdate({
      manaValues: next.length > 0 ? next : undefined,
      cmcMin: undefined,
      cmcMax: undefined,
    });
  };

  const toggleSet = (code: string) => {
    const next = activeSets.includes(code)
      ? activeSets.filter((s) => s !== code)
      : [...activeSets, code];
    onUpdate({ sets: next.length > 0 ? next : undefined });
  };

  // Selects every set in a block, or clears them all when the block is
  // already fully selected.
  const toggleBlock = (codes: string[]) => {
    const allSelected = codes.every((code) => activeSets.includes(code));
    const next = allSelected
      ? activeSets.filter((code) => !codes.includes(code))
      : [...activeSets, ...codes.filter((code) => !activeSets.includes(code))];
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

  // Blocks with any selected set float to the top as a whole so the
  // block-level select/deselect toggle stays within reach.
  const [pinnedEntries, otherEntries] = useMemo(() => {
    const pinned: SetDropdownEntry[] = [];
    const rest: SetDropdownEntry[] = [];
    for (const entry of groupedEntries ?? []) {
      const codes = entry.kind === 'block' ? entry.group.sets.map((s) => s.code) : [entry.set.code];
      (codes.some((code) => activeSets.includes(code)) ? pinned : rest).push(entry);
    }
    return [pinned, rest];
  }, [groupedEntries, activeSets]);

  // Follow a block to the top when it gets pinned, so the selection stays in view.
  const prevPinnedKeysRef = useRef<string[] | null>(null);
  useEffect(() => {
    const keys = pinnedEntries.map((e) => (e.kind === 'block' ? e.group.blockCode : e.set.code));
    const prev = prevPinnedKeysRef.current;
    prevPinnedKeysRef.current = keys;
    if (prev && keys.some((key) => !prev.includes(key))) {
      setListRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    }
  }, [pinnedEntries]);

  const renderSetEntries = (entries: SetDropdownEntry[]) =>
    entries.map((entry, idx) => {
      if (entry.kind === 'block') {
        const codes = entry.group.sets.map((s) => s.code);
        return (
          <div key={`b-${entry.group.blockCode}`}>
            <BlockHeader
              action={
                <BlockToggle
                  allSelected={codes.every((code) => activeSets.includes(code))}
                  blockName={entry.group.blockName}
                  onClick={() => toggleBlock(codes)}
                />
              }
            >
              {entry.group.blockName}
            </BlockHeader>
            {entry.group.sets.map((s) => (
              <SetRow key={s.code} s={s} checked={activeSets.includes(s.code)} onToggle={toggleSet} />
            ))}
          </div>
        );
      }
      const prev = entries[idx - 1];
      const showHeader = !prev || prev.kind !== 'standalone';
      return (
        <div key={`s-${entry.set.code}`}>
          {showHeader && <BlockHeader>{t('filters.standalone')}</BlockHeader>}
          <SetRow s={entry.set} checked={activeSets.includes(entry.set.code)} onToggle={toggleSet} />
        </div>
      );
    });

  const hasFilters =
    activeColors.length > 0 ||
    activeColorCategories.length > 0 ||
    activeType !== 'All' ||
    activeManaValues.length > 0 ||
    filters.cmcMin !== undefined ||
    filters.cmcMax !== undefined ||
    activeSets.length > 0 ||
    !!(filters.query && filters.query.length > 0);

  const clearAll = () => {
    onUpdate({
      query: undefined,
      colors: undefined,
      colorCategories: undefined,
      types: undefined,
      rarity: undefined,
      sets: undefined,
      manaValues: undefined,
      cmcMin: undefined,
      cmcMax: undefined,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Row 1: Color · Mana value · Edition */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <FilterGroup label={t('filters.color')}>
          <div style={{ display: 'flex', gap: 3 }}>
            {COLOR_KEYS.map((c) => {
              const active = activeColors.includes(c);
              const name = t(manaNameKey(c));
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleColor(c)}
                  title={name}
                  aria-label={name}
                  aria-pressed={active}
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
                  <Mana symbol={c} size={12} showLabel={false} />
                </button>
              );
            })}
            <span
              aria-hidden
              style={{ height: 18, borderLeft: '1px solid var(--border)', margin: '0 2px' }}
            />
            {COLOR_CATEGORY_FILTERS.map((category) => {
              const active = activeColorCategories.includes(category.value);
              const name = t(manaNameKey(category.symbol));
              return (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => toggleColorCategory(category.value)}
                  title={name}
                  aria-label={name}
                  aria-pressed={active}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 'var(--radius-sm)',
                    background: active ? `${category.color}24` : 'transparent',
                    border: `1px solid ${active ? category.color : 'var(--border)'}`,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    padding: 0,
                  }}
                >
                  <Mana symbol={category.symbol} size={12} showLabel={false} />
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup label={t('filters.manaValue')}>
          <div style={{ display: 'flex', gap: 2 }}>
            {MANA_VALUE_VALUES.map((value) => {
              const active = activeManaValues.includes(value);
              const label = value === '7+' ? '7+' : String(value);
              const title = value === '7+'
                ? t('filters.manaValueOrMoreTitle', { value: 7 })
                : t('filters.manaValueTitle', { value });
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleManaValue(value)}
                  title={title}
                  aria-pressed={active}
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
            ref={setMenuBtnRef}
            type="button"
            onClick={toggleSetMenu}
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
            {t('filters.edition')}{activeSets.length ? ` · ${activeSets.length}` : ''}
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
                position: 'fixed',
                top: setMenuPos.top,
                left: setMenuPos.left,
                zIndex: 90,
                width: SET_MENU_W,
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
                  placeholder={t('filters.searchSets')}
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
              <div ref={setListRef} style={{ maxHeight: setMenuPos.maxListHeight, overflowY: 'auto', padding: 4 }}>
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
                      {t('filters.noSets')}
                    </div>
                  ) : (
                    <>
                      {pinnedEntries.length > 0 && (
                        <div
                          style={{
                            borderBottom: otherEntries.length > 0 ? '1px solid var(--border)' : 'none',
                            paddingBottom: 4,
                            marginBottom: 4,
                          }}
                        >
                          {renderSetEntries(pinnedEntries)}
                        </div>
                      )}
                      {renderSetEntries(otherEntries)}
                    </>
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
                    {t('filters.noSets')}
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
                    {t('filters.selectedCount', { count: activeSets.length })}
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
                    {t('filters.clear')}
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
            {t('filters.clear')}
          </button>
        )}
      </div>

      {/* Row 2: Types */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {TYPES.map((type) => {
          const active = activeType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setType(type)}
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
              {type === 'All' ? t('filters.all') : t(typeCategoryKey(type))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
