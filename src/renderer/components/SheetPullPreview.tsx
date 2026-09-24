import type { SheetPullPreview as SheetPullPreviewData } from '../../shared/types';

interface Props {
  preview: SheetPullPreviewData;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SheetPullPreview({ preview, busy, onCancel, onConfirm }: Props) {
  const totalChanges = preview.added.length + preview.updated.length + preview.removed.length;

  return (
    <section style={panel} aria-label="Playgroup sheet pull preview">
      <div style={eyebrow}>Read-only source review</div>
      <h3 style={title}>Pull others&rsquo; decks</h3>
      <p style={copy}>
        Google Sheets is only read here. Applying this preview replaces the cached copy on this
        device; it never edits the sheet or anyone else&rsquo;s deck.
      </p>

      <div style={summaryGrid}>
        <Summary label="Added" value={preview.added.length} tone="add" />
        <Summary label="Changed" value={preview.updated.length} tone="update" />
        <Summary label="Removed" value={preview.removed.length} tone="remove" />
        <Summary label="Total after pull" value={preview.rows.length} />
      </div>

      <ChangeGroup title="New in sheet" items={preview.added.map(formatRow)} tone="add" empty="No new decks" />
      <ChangeGroup title="Changed in sheet" items={preview.updated.map((row) => `${formatRow(row)} · was ${formatRow(row.previous!)}`)} tone="update" empty="No changed decks" />
      <ChangeGroup title="Removed from sheet" items={preview.removed.map(formatRow)} tone="remove" empty="No removed decks" />

      <div style={actions}>
        <button onClick={onCancel} disabled={busy} style={secondaryBtn}>Cancel</button>
        <button onClick={onConfirm} disabled={busy} style={primaryBtn}>
          {busy ? 'Pulling…' : totalChanges === 0 ? 'Keep local cache in sync' : 'Apply pull locally'}
        </button>
      </div>
      <p style={footnote}>
        The local cache, pull timestamp, and set-label mappings update only after you apply.
      </p>
    </section>
  );
}

function formatRow(row: { player: string; block_label: string; name: string }): string {
  return `${row.player} · ${row.name} · ${row.block_label}`;
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'add' | 'update' | 'remove';
}) {
  const color = tone === 'add'
    ? 'var(--accent)'
    : tone === 'update'
      ? '#d7a45c'
      : tone === 'remove'
        ? 'var(--danger)'
        : 'var(--text)';
  return (
    <div style={summaryCell}>
      <span style={{ ...summaryValue, color }}>{value}</span>
      <span style={summaryLabel}>{label}</span>
    </div>
  );
}

function ChangeGroup({
  title: heading,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: 'add' | 'update' | 'remove';
  empty: string;
}) {
  const color = tone === 'add' ? 'var(--accent)' : tone === 'update' ? '#d7a45c' : 'var(--danger)';
  return (
    <div style={group}>
      <div style={{ ...groupHeading, color }}>
        {heading} <span style={count}>{items.length}</span>
      </div>
      <div style={itemList}>
        {(items.length ? items : [empty]).map((item) => (
          <span key={item} style={{ ...itemRow, color: items.length ? 'var(--text-dim)' : 'var(--text-faint)' }}>
            {items.length ? (tone === 'add' ? '+' : tone === 'update' ? '↻' : '−') : '·'} {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  border: '1px solid rgba(95, 159, 207, 0.35)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(135deg, rgba(95, 159, 207, 0.08), var(--bg-panel) 42%)',
  textAlign: 'left',
};

const eyebrow: React.CSSProperties = {
  color: '#9fcfee',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const title: React.CSSProperties = {
  margin: '4px 0 0',
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 600,
};

const copy: React.CSSProperties = {
  margin: '6px 0 12px',
  color: 'var(--text-mute)',
  fontSize: 11,
  lineHeight: 1.45,
};

const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 1,
  marginBottom: 12,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
};

const summaryCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  padding: '8px 7px',
  background: 'var(--bg-input)',
};

const summaryValue: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 16, lineHeight: 1 };
const summaryLabel: React.CSSProperties = { color: 'var(--text-faint)', fontSize: 9, lineHeight: 1.2 };
const group: React.CSSProperties = { padding: '9px 0', borderTop: '1px solid var(--border)' };
const groupHeading: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600 };
const count: React.CSSProperties = { color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 400 };
const itemList: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 116, marginTop: 6, overflowY: 'auto' };
const itemRow: React.CSSProperties = {
  display: 'block',
  flex: '0 0 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  lineHeight: 1.3,
};
const actions: React.CSSProperties = { display: 'flex', gap: 7, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 12 };
const secondaryBtn: React.CSSProperties = { padding: '6px 10px', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' };
const primaryBtn: React.CSSProperties = { ...secondaryBtn, background: 'rgba(95, 159, 207, 0.12)', borderColor: 'rgba(95, 159, 207, 0.35)', color: '#9fcfee' };
const footnote: React.CSSProperties = { margin: '9px 0 0', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', fontSize: 9, lineHeight: 1.4 };
