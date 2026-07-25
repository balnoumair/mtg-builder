import { useState, useRef, useEffect } from 'react';
import type { Tag } from '../../shared/types';
import DeckTag from './DeckTag';

interface Props {
  /** Every tag that exists, for the picker list. */
  tags: Tag[];
  /** Tags currently on this deck. */
  deckTags: Tag[];
  onChange: (tagIds: number[]) => void;
  onCreate: (name: string) => Promise<Tag>;
}

/**
 * The deck's tag row plus the popover that edits it. Creating and attaching are
 * the same gesture: type a name that does not exist yet and press Enter.
 */
export default function DeckTagPicker({ tags, deckTags, onChange, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const selectedIds = new Set(deckTags.map((t) => t.id));

  const toggle = (tagId: number) => {
    const next = new Set(selectedIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    onChange([...next]);
  };

  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();
  const visible = needle
    ? tags.filter((t) => t.name.toLowerCase().includes(needle))
    : tags;
  const exact = tags.find((t) => t.name.toLowerCase() === needle);

  const submit = async () => {
    if (!trimmed) return;
    if (exact) {
      if (!selectedIds.has(exact.id)) toggle(exact.id);
      setQuery('');
      return;
    }
    const tag = await onCreate(trimmed);
    onChange([...new Set([...selectedIds, tag.id])]);
    setQuery('');
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
      {deckTags.map((tag) => (
        <DeckTag
          key={tag.id}
          tag={tag}
          size="md"
          onRemove={() => toggle(tag.id)}
        />
      ))}

      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          background: open ? 'var(--bg-row-sel)' : 'transparent',
          border: '1px dashed var(--border-strong)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--text-mute)',
          fontSize: 11,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        {deckTags.length === 0 ? 'Add tags' : 'Edit tags'}
      </button>

      {open && (
        <div
          className="animate-popover-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            width: 224,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder="Find or create a tag"
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 8px',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ maxHeight: 220, overflowY: 'auto', padding: 4 }}>
            {trimmed && !exact && (
              <PickerRow onClick={() => void submit()}>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  Create <span style={{ color: 'var(--text)' }}>{trimmed}</span>
                </span>
              </PickerRow>
            )}

            {visible.map((tag) => (
              <PickerRow key={tag.id} onClick={() => toggle(tag.id)}>
                <DeckTag tag={tag} active={selectedIds.has(tag.id)} />
                <span style={{ flex: 1 }} />
                {selectedIds.has(tag.id) && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path
                      d="M2 5.2L4.1 7.3L8 2.8"
                      stroke="var(--text-dim)"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </PickerRow>
            ))}

            {visible.length === 0 && !trimmed && (
              <p style={{ margin: 0, padding: '10px 8px', fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>
                No tags yet. Type a name to make one.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PickerRow({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: '4px 6px',
        background: 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        cursor: 'pointer',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-row-hov)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}
