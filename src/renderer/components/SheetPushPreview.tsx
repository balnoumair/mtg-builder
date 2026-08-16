import { useEffect, useMemo, useState } from 'react';
import type { SheetPushPlan, SheetPushRowChange } from '../../shared/types';

interface Props {
  plan: SheetPushPlan;
  onClose: () => void;
  onDone: (message: string) => void;
  /** Inline drops the dimmed overlay so the plan can sit inside a page. */
  variant?: 'modal' | 'inline';
}

function Shell({
  variant,
  pushing,
  onClose,
  children,
}: {
  variant: 'modal' | 'inline';
  pushing: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (variant === 'inline') {
    return (
      <div
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 18,
          textAlign: 'left',
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      onClick={() => !pushing && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '80vh',
          margin: '0 24px',
          padding: 20,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflowY: 'auto',
          textAlign: 'left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

type ChangeKind = 'update' | 'append' | 'clear' | 'matched';

const SECTIONS: { kind: ChangeKind; title: string; tone: string }[] = [
  { kind: 'update', title: 'Update', tone: 'var(--accent)' },
  { kind: 'append', title: 'Add', tone: 'var(--accent)' },
  { kind: 'clear', title: 'Remove', tone: 'var(--danger)' },
];

/** Sheet rows are unique within a kind, so this identifies a planned change. */
const keyOf = (kind: ChangeKind, change: SheetPushRowChange) => `${kind}:${change.sheetRow}`;

function rowText(cells: string[]): string {
  const [, block, colors, name] = cells;
  if (!block && !name) return '(empty)';
  return [block, colors, name].filter(Boolean).join(' · ');
}

/**
 * Nothing is written until the user ticks rows and confirms — the main process
 * re-verifies every target row still matches `before` before writing. Rows
 * start unticked so a first push is deliberate rather than wholesale.
 */
export default function SheetPushPreview({
  plan,
  onClose,
  onDone,
  variant = 'modal',
}: Props) {
  const [labels, setLabels] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<Record<number, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changesFor = (kind: ChangeKind): SheetPushRowChange[] =>
    kind === 'update' ? plan.updates : kind === 'append' ? plan.appends : plan.clears;

  const allKeys = useMemo(
    () => SECTIONS.flatMap(({ kind }) => changesFor(kind).map((c) => keyOf(kind, c))),
    [plan],
  );

  useEffect(() => {
    window.electronAPI.getSheetBlockLabels().then(setLabels);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pushing) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, pushing]);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleSection = (kind: ChangeKind) => {
    const keys = changesFor(kind).map((c) => keyOf(kind, c));
    const allOn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (allOn) next.delete(k);
        else next.add(k);
      }
      return next;
    });
  };

  const selectedRemovals = plan.matched.filter((c) => selected.has(keyOf('matched', c)));
  const selectedCount = allKeys.filter((k) => selected.has(k)).length + selectedRemovals.length;

  const handleAssign = async (deckId: number, setCodes: string[], label: string) => {
    if (!label) return;
    setAssignments((prev) => ({ ...prev, [deckId]: label }));
    await window.electronAPI.assignSheetBlock(label, setCodes);
  };

  const handleConfirm = async () => {
    setPushing(true);
    setError(null);

    // Appends were numbered sequentially from the first free row; keeping only
    // some of them would leave blank rows behind, so re-number what survives.
    const firstFreeRow = plan.appends.length
      ? Math.min(...plan.appends.map((c) => c.sheetRow))
      : 0;
    const selectedPlan: SheetPushPlan = {
      ...plan,
      updates: plan.updates.filter((c) => selected.has(keyOf('update', c))),
      // Rows the user chose to take back out of the sheet clear the same way
      // as decks that no longer exist locally.
      clears: [...plan.clears.filter((c) => selected.has(keyOf('clear', c))), ...selectedRemovals],
      appends: plan.appends
        .filter((c) => selected.has(keyOf('append', c)))
        .sort((a, b) => a.sheetRow - b.sheetRow)
        .map((c, i) => ({ ...c, sheetRow: firstFreeRow + i })),
    };

    const result = await window.electronAPI.executeSheetPush(selectedPlan);
    if (result.error) {
      setError(result.error);
      setPushing(false);
      return;
    }
    onDone(`Pushed ${result.written} row${result.written === 1 ? '' : 's'} to the sheet.`);
  };

  return (
    <Shell variant={variant} pushing={pushing} onClose={onClose}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600 }}>
          Push to sheet — pick what to write
        </h2>
        <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6, marginBottom: 14 }}>
          Writing as <strong style={{ color: 'var(--text-dim)' }}>{plan.playerName}</strong>. Only
          ticked rows are written; {plan.matched.length} already match.
        </p>

        {allKeys.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setSelected(new Set(allKeys))} style={smallBtn}>
              Select all ({allKeys.length})
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={selectedCount === 0}
              style={{ ...smallBtn, opacity: selectedCount === 0 ? 0.5 : 1 }}
            >
              Select none
            </button>
          </div>
        )}

        {SECTIONS.map(({ kind, title, tone }) => {
          const changes = changesFor(kind);
          if (changes.length === 0) return null;
          const keys = changes.map((c) => keyOf(kind, c));
          const allOn = keys.every((k) => selected.has(k));

          return (
            <div key={kind} style={{ marginBottom: 14 }}>
              <button
                onClick={() => toggleSection(kind)}
                title={allOn ? 'Untick this group' : 'Tick this group'}
                style={{
                  display: 'block',
                  padding: 0,
                  marginBottom: 5,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: tone,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {title} ({changes.length})
              </button>
              {changes.map((c) => {
                const key = keyOf(kind, c);
                const on = selected.has(key);
                return (
                  <label
                    key={key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '3px 4px',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: on ? 'var(--text-dim)' : 'var(--text-faint)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(key)}
                      style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <span style={{ color: 'var(--text-mute)', flexShrink: 0 }}>row {c.sheetRow}</span>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {kind === 'update' ? (
                        <>
                          {rowText(c.before)} →{' '}
                          <span style={{ color: on ? 'var(--text)' : 'inherit' }}>
                            {rowText(c.row)}
                          </span>
                        </>
                      ) : kind === 'clear' ? (
                        <span style={{ textDecoration: 'line-through' }}>{rowText(c.before)}</span>
                      ) : (
                        <span style={{ color: on ? 'var(--text)' : 'inherit' }}>
                          {rowText(c.row)}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}

        {plan.matched.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-mute)',
                marginBottom: 4,
              }}
            >
              Already in the sheet ({plan.matched.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-mute)', margin: '0 0 6px' }}>
              These match your decks, so nothing is written. Tick one to take it back out of the
              sheet — the deck stays in the app.
            </p>
            {plan.matched.map((c) => {
              const key = keyOf('matched', c);
              const on = selected.has(key);
              return (
                <label
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '3px 4px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: on ? 'var(--danger)' : 'var(--text-faint)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(key)}
                    title="Remove this row from the sheet"
                    style={{ accentColor: 'var(--danger)', flexShrink: 0 }}
                  />
                  <span style={{ color: 'var(--text-mute)', flexShrink: 0 }}>row {c.sheetRow}</span>
                  <span
                    style={{
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      textDecoration: on ? 'line-through' : 'none',
                    }}
                  >
                    {rowText(c.before)}
                  </span>
                </label>
              );
            })}
          </div>
        )}

        {plan.unmapped.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--danger)',
                marginBottom: 4,
              }}
            >
              No matching block ({plan.unmapped.length})
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-mute)', margin: '0 0 6px' }}>
              These decks aren&rsquo;t pushed. Pick the sheet block they belong to, then re-run the
              preview.
            </p>
            {plan.unmapped.map((u) => (
              <div
                key={u.deckId}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
              >
                <span
                  style={{
                    fontSize: 11,
                    flex: 1,
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {u.deckName}
                  <span
                    style={{
                      color: 'var(--text-mute)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                    }}
                  >
                    {' '}
                    {u.setCodes.join(', ') || 'no sets'}
                  </span>
                </span>
                <select
                  value={assignments[u.deckId] ?? ''}
                  onChange={(e) => void handleAssign(u.deckId, u.setCodes, e.target.value)}
                  style={{
                    maxWidth: 200,
                    padding: '3px 6px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-input)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text)',
                    fontSize: 10,
                  }}
                >
                  <option value="">Choose block…</option>
                  {labels.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {(plan.duplicates.length > 0 || plan.warnings.length > 0) && (
          <div style={{ marginBottom: 12, fontSize: 10, color: 'var(--danger)' }}>
            {plan.duplicates.map((d) => (
              <div key={d}>Duplicate row skipped: {d}</div>
            ))}
            {plan.warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}

        {allKeys.length === 0 && plan.matched.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--text-mute)' }}>
            Nothing to write — the sheet already matches your decks.
          </p>
        )}

        {error && (
          <div
            style={{
              margin: '10px 0',
              padding: '8px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(201,123,114,0.08)',
              border: '1px solid rgba(201,123,114,0.3)',
              color: 'var(--danger)',
              fontSize: 11,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={pushing} style={ghostBtn}>
            {variant === 'inline' ? 'Discard plan' : 'Cancel'}
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={pushing || selectedCount === 0}
            style={{
              ...ghostBtn,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              opacity: pushing || selectedCount === 0 ? 0.6 : 1,
            }}
          >
            {pushing
              ? 'Writing…'
              : `Write ${selectedCount} row${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
    </Shell>
  );
}

const ghostBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};

const smallBtn: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-mute)',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
