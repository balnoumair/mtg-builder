import { useEffect, useRef, useState } from 'react';
import type { Tag } from '../../shared/types';
import { TAG_COLOR_KEYS, tagColorTokens } from '../../shared/tagColors';

interface Props {
  tags: Tag[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  onRename: (id: number, name: string) => void;
  onRecolor: (id: number, color: string) => void;
  onDelete: (id: number) => void;
}

/**
 * A compact tag control for the Decks view. The full tag collection lives in
 * a bounded, searchable popover so adding tags never makes the page header
 * grow with it.
 */
export default function TagFilterRail({
  tags,
  selectedIds,
  onToggle,
  onClear,
  onRename,
  onRecolor,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = new Set(selectedIds);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setEditing(false);
        setEditingId(null);
        setQuery('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        setEditing(false);
        setEditingId(null);
        setQuery('');
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const commitRename = (tag: Tag, close = false) => {
    const name = draftName.trim();
    if (name && name !== tag.name) onRename(tag.id, name);
    if (close) setEditingId(null);
  };

  if (tags.length === 0) return null;

  const needle = query.trim().toLowerCase();
  const candidates = editing
    ? tags
    : tags.filter((tag) => (tag.deck_count ?? 0) > 0 || selected.has(tag.id));
  const visible = candidates.filter((tag) => tag.name.toLowerCase().includes(needle));

  return (
    <div ref={rootRef} style={{ position: 'relative', padding: '6px 0 8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '5px 9px',
            background: open ? 'var(--bg-row-sel)' : 'var(--bg-chip)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Tags
          </span>
          <span style={{ color: 'var(--text-mute)' }}>
            {selected.size > 0 ? `${selected.size} selected` : 'Filter decks'}
          </span>
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" aria-hidden>
            <path
              d="M2 3.5L4.5 6L7 3.5"
              stroke="currentColor"
              strokeWidth="1.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {selected.size > 0 && (
          <button type="button" onClick={onClear} style={compactTextButton}>
            Clear filters
          </button>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Filter decks by tag"
          style={{
            position: 'absolute',
            zIndex: 30,
            top: 'calc(100% - 2px)',
            left: 0,
            width: 'min(360px, calc(100vw - 32px))',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 14px 34px rgba(0, 0, 0, 0.28)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 10px 7px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
              {editing ? 'Manage tags' : 'Filter decks'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
              {tags.length}
            </span>
            <button
              type="button"
              onClick={() => {
                setEditing((value) => !value);
                setEditingId(null);
              }}
              style={{ ...compactTextButton, color: editing ? 'var(--text)' : 'var(--text-mute)' }}
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          </div>

          <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={editing ? 'Search tags to edit…' : 'Search tags…'}
              aria-label="Search tags"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 8px',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ maxHeight: 280, overflowY: 'auto', padding: 6 }}>
            {visible.length === 0 ? (
              <p style={{ margin: 0, padding: '12px 8px', color: 'var(--text-faint)', fontSize: 11 }}>
                {query ? 'No matching tags.' : 'No tags are currently used by a deck.'}
              </p>
            ) : (
              visible.map((tag) => {
                const c = tagColorTokens(tag.color);
                const isActive = selected.has(tag.id);
                const isEditingRow = editing && editingId === tag.id;

                return (
                  <div key={tag.id}>
                    <button
                      type="button"
                      aria-pressed={editing ? undefined : isActive}
                      title={editing ? `Edit ${tag.name}` : `${isActive ? 'Stop filtering' : 'Filter'} by ${tag.name}`}
                      onClick={() => {
                        if (!editing) {
                          onToggle(tag.id);
                          return;
                        }
                        setEditingId(isEditingRow ? null : tag.id);
                        setDraftName(tag.name);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 7px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: !editing && isActive ? c.wash : 'transparent',
                      }}
                      onMouseEnter={(event) => {
                        if (editing || !isActive) event.currentTarget.style.background = 'var(--bg-row-hov)';
                      }}
                      onMouseLeave={(event) => {
                        event.currentTarget.style.background = !editing && isActive ? c.wash : 'transparent';
                      }}
                    >
                      <span
                        aria-hidden
                        style={{ width: 3, height: 16, flexShrink: 0, borderRadius: 1, background: c.ink }}
                      />
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12,
                          color: !editing && isActive ? c.ink : 'var(--text-dim)',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {tag.name}
                      </span>
                      {editing ? (
                        <svg
                          width="9"
                          height="9"
                          viewBox="0 0 9 9"
                          fill="none"
                          aria-hidden
                          style={{
                            flexShrink: 0,
                            color: 'var(--text-mute)',
                            transform: isEditingRow ? 'rotate(90deg)' : 'none',
                          }}
                        >
                          <path
                            d="M3 1.5L6 4.5L3 7.5"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
                          {tag.deck_count ?? 0}
                        </span>
                      )}
                    </button>

                    {isEditingRow && (
                      <div
                        style={{
                          margin: '2px 4px 8px',
                          padding: 8,
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-input)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <input
                          autoFocus
                          value={draftName}
                          onChange={(event) => setDraftName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') commitRename(tag, true);
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => commitRename(tag)}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: 'var(--bg-window)',
                            border: '1px solid var(--border-input)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '4px 7px',
                            color: 'var(--text)',
                            fontSize: 12,
                            outline: 'none',
                          }}
                        />

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '8px 0 2px' }}>
                          {TAG_COLOR_KEYS.map((key) => (
                            <button
                              type="button"
                              key={key}
                              title={key}
                              onClick={() => onRecolor(tag.id, key)}
                              style={{
                                width: 14,
                                height: 14,
                                padding: 0,
                                borderRadius: 3,
                                cursor: 'pointer',
                                background: tagColorTokens(key).ink,
                                border: `1.5px solid ${tag.color === key ? 'var(--text)' : 'transparent'}`,
                              }}
                            />
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const used = tag.deck_count ?? 0;
                            const warning = used
                              ? `Delete "${tag.name}"? It will be removed from ${used} deck${used === 1 ? '' : 's'}.`
                              : `Delete "${tag.name}"?`;
                            if (confirm(warning)) {
                              onDelete(tag.id);
                              setEditingId(null);
                            }
                          }}
                          style={{
                            marginTop: 8,
                            padding: '3px 8px',
                            background: 'transparent',
                            border: '1px solid var(--border-strong)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--danger)',
                            fontSize: 11,
                            cursor: 'pointer',
                          }}
                        >
                          Delete tag
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const compactTextButton: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: 'var(--text-mute)',
  fontSize: 10,
  cursor: 'pointer',
};
