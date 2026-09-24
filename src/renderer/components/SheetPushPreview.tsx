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
        style={reviewPanel}
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
          ...reviewPanel,
          width: '100%',
          maxWidth: 560,
          maxHeight: '80vh',
          margin: '0 24px',
          overflowY: 'auto',
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
        <div style={reviewEyebrow}>Shared sheet write review</div>
        <h2 style={reviewTitle}>Push my decks</h2>
        <p style={reviewCopy}>
          Review the rows that will be written to the shared sheet. Nothing is sent until you select rows and confirm.
          Writing as <strong>{plan.playerName}</strong>.
        </p>

        <div style={summaryGrid}>
          <SummaryCell label="New rows" value={plan.appends.length} color="var(--accent)" />
          <SummaryCell label="Changed" value={plan.updates.length} color="var(--accent)" />
          <SummaryCell label="To clear" value={plan.clears.length} color="var(--danger)" />
          <SummaryCell label="Already match" value={plan.matched.length} color="var(--text)" />
        </div>

        {allKeys.length > 0 && (
          <div style={selectionBar}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{selectedCount} row(s) selected</span>
            <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelected(new Set(allKeys))} style={smallBtn}>
              Select all changes
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={selectedCount === 0}
              style={{ ...smallBtn, opacity: selectedCount === 0 ? 0.5 : 1 }}
            >
              Select none
            </button>
            </div>
          </div>
        )}

        {SECTIONS.map(({ kind, title, tone }) => {
          const changes = changesFor(kind);
          if (changes.length === 0) return null;
          const keys = changes.map((c) => keyOf(kind, c));
          const allOn = keys.every((k) => selected.has(k));

          return (
            <section key={kind} style={changeGroup}>
              <button
                onClick={() => toggleSection(kind)}
                title={allOn ? 'Untick this group' : 'Tick this group'}
                style={sectionToggle}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: tone }}>{title}</strong>
                  <span style={sectionCount}>{changes.length}</span>
                </span>
                <span style={sectionAction}>{allOn ? 'Clear group' : 'Select group'}</span>
              </button>
              <div style={changeList}>
                {changes.map((c) => {
                const key = keyOf(kind, c);
                const on = selected.has(key);
                return (
                  <label
                    key={key}
                    style={{ ...changeRow, color: on ? 'var(--text)' : 'var(--text-muted)' }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(key)}
                      style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                    />
                    <span style={{ color: 'var(--text-subtle)', minWidth: 42 }}>row {c.sheetRow}</span>
                    <span style={rowValue}>
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
            </section>
          );
        })}

        {plan.matched.length > 0 && (
          <section style={secondaryGroup}>
            <div
              style={sectionHeadingMuted}
            >
              Already in the sheet — optionally remove <span style={sectionCount}>{plan.matched.length}</span>
            </div>
            <p style={sectionDescription}>
              These match your decks, so nothing is written. Tick one to take it back out of the
              sheet — the deck stays in the app.
            </p>
            <div style={changeList}>
              {plan.matched.map((c) => {
              const key = keyOf('matched', c);
              const on = selected.has(key);
              return (
                <label
                  key={key}
                  style={{ ...changeRow, color: on ? 'var(--danger)' : 'var(--text-muted)' }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(key)}
                    title="Remove this row from the sheet"
                    style={{ accentColor: 'var(--danger)', flexShrink: 0 }}
                  />
                  <span style={{ color: 'var(--text-subtle)', minWidth: 42 }}>row {c.sheetRow}</span>
                  <span style={{ ...rowValue, textDecoration: on ? 'line-through' : 'none' }}>
                    {rowText(c.before)}
                  </span>
                </label>
              );
              })}
            </div>
          </section>
        )}

        {plan.unmapped.length > 0 && (
          <section style={warningPanel}>
            <div style={{ color: 'var(--warning)', fontSize: 12, fontWeight: 600, marginBottom: 7 }}>
              No matching block ({plan.unmapped.length})
            </div>
            <p style={sectionDescription}>
              These decks aren&rsquo;t pushed. Pick the sheet block they belong to, then re-run the
              preview.
            </p>
            {plan.unmapped.map((u) => (
              <div
                key={u.deckId}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}
              >
                <span
                  style={unmappedName}
                >
                  {u.deckName}
                  <span style={{ color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    {' '}
                    {u.setCodes.join(', ') || 'no sets'}
                  </span>
                </span>
                <select
                  value={assignments[u.deckId] ?? ''}
                  onChange={(e) => void handleAssign(u.deckId, u.setCodes, e.target.value)}
                  style={selectStyle}
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
          </section>
        )}

        {(plan.duplicates.length > 0 || plan.warnings.length > 0) && (
          <div style={warningText}>
            {plan.duplicates.map((d) => (
              <div key={d}>Duplicate row skipped: {d}</div>
            ))}
            {plan.warnings.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>
        )}

        {allKeys.length === 0 && plan.matched.length === 0 && (
          <p style={emptyText}>
            Nothing to write — the sheet already matches your decks.
          </p>
        )}

        {error && (
          <div style={errorBox}>
            {error}
          </div>
        )}

        <div style={actionRow}>
          <span style={actionHint}>Only selected rows are written.</span>
          <button onClick={onClose} disabled={pushing} style={ghostBtn}>
            {variant === 'inline' ? 'Discard plan' : 'Cancel'}
          </button>
          <button
            onClick={() => void handleConfirm()}
            disabled={pushing || selectedCount === 0}
            style={{ ...primaryBtn, opacity: pushing || selectedCount === 0 ? 0.6 : 1 }}
          >
            {pushing
              ? 'Writing…'
              : `Write ${selectedCount} row${selectedCount === 1 ? '' : 's'}`}
          </button>
        </div>
    </Shell>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={summaryCell}>
      <div style={{ ...summaryValue, color }}>{value}</div>
      <div style={summaryLabel}>{label}</div>
    </div>
  );
}

const reviewPanel: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(116, 173, 142, 0.07), var(--bg-panel) 42%)',
  border: '1px solid rgba(116, 173, 142, 0.38)',
  borderRadius: 10,
  padding: 18,
  textAlign: 'left',
};

const reviewEyebrow: React.CSSProperties = {
  color: 'var(--accent)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  marginBottom: 8,
};

const reviewTitle: React.CSSProperties = { margin: '0 0 8px', fontSize: 19 };

const reviewCopy: React.CSSProperties = {
  margin: '0 0 14px',
  color: 'var(--text-muted)',
  fontSize: 13,
  lineHeight: 1.5,
};

const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  border: '1px solid var(--border)',
  borderRadius: 6,
  overflow: 'hidden',
  marginBottom: 14,
};

const summaryCell: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.12)',
  padding: '9px 11px',
  borderRight: '1px solid var(--border)',
};

const summaryValue: React.CSSProperties = { fontSize: 20, fontWeight: 700, lineHeight: 1.1 };
const summaryLabel: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 11, marginTop: 4 };

const selectionBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  flexWrap: 'wrap',
  padding: '8px 10px',
  marginBottom: 14,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'rgba(0, 0, 0, 0.1)',
};

const changeGroup: React.CSSProperties = { marginBottom: 14, paddingTop: 2 };

const secondaryGroup: React.CSSProperties = {
  marginTop: 18,
  paddingTop: 14,
  borderTop: '1px solid var(--border)',
};

const sectionToggle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  width: '100%',
  border: 0,
  background: 'transparent',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
};

const sectionHeadingMuted: React.CSSProperties = {
  color: 'var(--text-muted)',
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 7,
};

const sectionCount: React.CSSProperties = { color: 'var(--text-subtle)', fontSize: 12, fontWeight: 500 };
const sectionAction: React.CSSProperties = { color: 'var(--text-subtle)', fontSize: 11 };

const sectionDescription: React.CSSProperties = {
  margin: '0 0 8px',
  color: 'var(--text-muted)',
  fontSize: 11,
  lineHeight: 1.45,
};

const changeList: React.CSSProperties = {
  maxHeight: 220,
  overflowY: 'auto',
  marginTop: 7,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const changeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  flex: '0 0 auto',
  padding: '5px 6px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg-input)',
  fontSize: 12,
  cursor: 'pointer',
};

const rowValue: React.CSSProperties = {
  minWidth: 0,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const warningPanel: React.CSSProperties = {
  marginTop: 18,
  padding: 10,
  border: '1px solid var(--warning)',
  borderRadius: 6,
  background: 'rgba(214, 161, 72, 0.05)',
};

const warningText: React.CSSProperties = {
  margin: '14px 0 0',
  color: 'var(--warning)',
  fontSize: 12,
  lineHeight: 1.45,
};

const emptyText: React.CSSProperties = {
  margin: '14px 0 0',
  color: 'var(--text-muted)',
  fontSize: 13,
};

const errorBox: React.CSSProperties = {
  margin: '10px 0',
  padding: '8px 10px',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(201,123,114,0.08)',
  border: '1px solid rgba(201,123,114,0.3)',
  color: 'var(--danger)',
  fontSize: 11,
};

const unmappedName: React.CSSProperties = {
  fontSize: 11,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const selectStyle: React.CSSProperties = {
  maxWidth: 200,
  padding: '3px 6px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  fontSize: 10,
};

const actionRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
  marginTop: 18,
};

const actionHint: React.CSSProperties = { marginRight: 'auto', color: 'var(--text-subtle)', fontSize: 11 };

const primaryBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};

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
