import { useEffect, useMemo, useState } from 'react';
import type { CardSet, SheetBlockMapping } from '../../shared/types';

/**
 * The sheet's block/edition vocabulary and the Scryfall sets each label covers.
 * Sets are picked from the catalog rather than typed, so a mapping can only
 * ever contain real set codes.
 */
export default function SheetMappings() {
  const [mappings, setMappings] = useState<SheetBlockMapping[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [onlyUnmapped, setOnlyUnmapped] = useState(false);

  const refresh = async () => setMappings(await window.electronAPI.getSheetBlockMappings());

  useEffect(() => {
    void (async () => {
      const [maps, allSets] = await Promise.all([
        window.electronAPI.getSheetBlockMappings(),
        // Every set in the catalog, not just ones with cards imported: bonus
        // sheets are legitimate mapping targets.
        window.electronAPI.getAllSets(),
      ]);
      setMappings(maps);
      setSets(allSets);
      setLoading(false);
    })();
  }, []);

  const setsByCode = useMemo(
    () => new Map(sets.map((s) => [s.code.toLowerCase(), s])),
    [sets],
  );

  const save = async (label: string, codes: string[]) => {
    await window.electronAPI.setSheetBlockCodes(label, codes);
    await refresh();
  };

  const reset = async (label: string) => {
    await window.electronAPI.resetSheetBlockCodes(label);
    await refresh();
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mappings.filter((m) => {
      if (onlyUnmapped && m.setCodes.length > 0) return false;
      if (!q) return true;
      return (
        m.label.toLowerCase().includes(q) ||
        m.setCodes.some(
          (c) =>
            c.toLowerCase().includes(q) ||
            setsByCode.get(c.toLowerCase())?.name.toLowerCase().includes(q),
        )
      );
    });
  }, [mappings, query, onlyUnmapped, setsByCode]);

  const unmappedCount = mappings.filter((m) => m.setCodes.length === 0).length;

  if (loading) return <div style={{ color: 'var(--text-mute)', fontSize: 12 }}>Loading…</div>;

  if (mappings.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 16px' }}>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>No mappings yet</p>
        <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
          Pull the sheet once — these labels come from its EDICIONES tab.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search label or set…"
          style={{
            flex: 1,
            minWidth: 150,
            padding: '5px 9px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-input)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: 12,
            outline: 'none',
          }}
        />
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: unmappedCount > 0 ? 'var(--danger)' : 'var(--text-mute)',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={onlyUnmapped}
            onChange={(e) => setOnlyUnmapped(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Unmapped only{unmappedCount > 0 ? ` (${unmappedCount})` : ''}
        </label>
      </div>

      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        {visible.map((m, i) => (
          <MappingRow
            key={m.label}
            mapping={m}
            sets={sets}
            setsByCode={setsByCode}
            first={i === 0}
            editing={editing === m.label}
            onEdit={() => setEditing(editing === m.label ? null : m.label)}
            onSave={(codes) => void save(m.label, codes)}
            onReset={() => void reset(m.label)}
          />
        ))}
        {visible.length === 0 && (
          <div style={{ padding: '14px 12px', fontSize: 11, color: 'var(--text-mute)' }}>
            No labels match that search.
          </div>
        )}
      </div>

      <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 8, marginBottom: 0 }}>
        Labels come from the sheet and refresh on every pull. Your edits are kept; unedited labels
        are re-seeded from the built-in dictionary.
      </p>
    </div>
  );
}

function MappingRow({
  mapping,
  sets,
  setsByCode,
  first,
  editing,
  onEdit,
  onSave,
  onReset,
}: {
  mapping: SheetBlockMapping;
  sets: CardSet[];
  setsByCode: Map<string, CardSet>;
  first: boolean;
  editing: boolean;
  onEdit: () => void;
  onSave: (codes: string[]) => void;
  onReset: () => void;
}) {
  const [search, setSearch] = useState('');
  const codes = mapping.setCodes.map((c) => c.toLowerCase());

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sets
      .filter((s) => !codes.includes(s.code.toLowerCase()))
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.blockName ?? '').toLowerCase().includes(q),
      )
      .slice(0, 40);
  }, [sets, search, codes]);

  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: first ? 'none' : '1px solid var(--border)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {mapping.label}
            </span>
            {mapping.manual && (
              <span
                title="Edited by you; survives pulls"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  color: 'var(--accent)',
                  border: '1px solid var(--accent-line)',
                  borderRadius: 3,
                  padding: '0 4px',
                  flexShrink: 0,
                }}
              >
                edited
              </span>
            )}
          </div>

          {mapping.setCodes.length === 0 ? (
            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 3 }}>
              No sets mapped — decks from this block cannot be pushed. Add the sets it covers.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                marginTop: 4,
              }}
            >
              {mapping.setCodes.map((code) => {
                const set = setsByCode.get(code.toLowerCase());
                return (
                  <span
                    key={code}
                    title={set ? `${set.name} (${code})` : `${code} — not in the set catalog`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '2px 6px',
                      background: 'var(--bg-chip)',
                      border: `1px solid ${set ? 'var(--border)' : 'rgba(201,123,114,0.5)'}`,
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 10,
                      color: set ? 'var(--text-dim)' : 'var(--danger)',
                      maxWidth: 240,
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {set ? set.name : `${code} — unknown code`}
                    </span>
                    {editing && (
                      <button
                        onClick={() => onSave(mapping.setCodes.filter((c) => c !== code))}
                        title="Remove this set"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: 0,
                          color: 'var(--text-mute)',
                          cursor: 'pointer',
                          fontSize: 11,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={onEdit} style={editing ? primaryBtn : smallBtn}>
            {editing ? 'Done' : 'Edit'}
          </button>
          {mapping.manual && mapping.hasDefault && (
            <button onClick={onReset} title="Restore the built-in mapping" style={smallBtn}>
              Reset
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div style={{ marginTop: 8 }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add a set — search by name, code or block…"
            style={{
              width: '100%',
              padding: '5px 9px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-input)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontSize: 11,
              outline: 'none',
            }}
          />
          <div
            style={{
              marginTop: 4,
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            {matches.map((s) => (
              <button
                key={s.code}
                onClick={() => {
                  onSave([...mapping.setCodes, s.code.toLowerCase()]);
                  setSearch('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: 11,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-row-hov)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                  {s.blockName && (
                    <span style={{ color: 'var(--text-faint)' }}> · {s.blockName}</span>
                  )}
                </span>
                <span
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-faint)' }}
                >
                  {s.code} · {(s.releasedAt ?? '').slice(0, 4)}
                </span>
              </button>
            ))}
            {matches.length === 0 && (
              <div style={{ padding: '8px', fontSize: 10, color: 'var(--text-mute)' }}>
                No sets match “{search}”.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  padding: '4px 9px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-mute)',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};

const primaryBtn: React.CSSProperties = {
  ...smallBtn,
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
};
