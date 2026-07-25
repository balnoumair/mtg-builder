import { useState } from 'react';
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
 * The tag rail. Spines line up down the left edge like the tabs in a card
 * binder, and the tag you are filtering by slides out of the stack.
 *
 * Two modes on one list: normally a row toggles the filter; in edit mode a row
 * opens its own name/colour/delete editor. Managing tags lives here rather than
 * in the deck picker because this is the only place that shows every tag with
 * its deck count — the context you need to decide what to rename or remove.
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
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState('');

  const selected = new Set(selectedIds);

  // A tag no deck uses would only ever filter to nothing, so it stays out of
  // the rail — except in edit mode, which is the only place left to rename or
  // delete it. A tag you are already filtering by stays put regardless, so the
  // row never vanishes from under the click that selected it.
  const visible = editing
    ? tags
    : tags.filter((t) => (t.deck_count ?? 0) > 0 || selected.has(t.id));

  const stopEditing = () => {
    setEditing(false);
    setEditingId(null);
  };

  /**
   * Saves the name; only closes the editor when asked. Closing on blur would
   * unmount the swatches and Delete on mousedown, before their own click could
   * land — so blur saves and stays put.
   */
  const commitRename = (tag: Tag, close = false) => {
    const name = draftName.trim();
    if (name && name !== tag.name) onRename(tag.id, name);
    if (close) setEditingId(null);
  };

  // No tags at all: the whole section goes, like any other empty group. Tags
  // that exist but sit unused keep the section alive, because Edit is the only
  // way left to reach them.
  if (tags.length === 0) return null;

  return (
    <div style={{ padding: '4px 8px 8px' }}>
      <div
        style={{
          padding: '6px 6px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-mute)',
          }}
        >
          Tags
        </span>
        <div style={{ flex: 1 }} />
        {selected.size > 0 && !editing && (
          <button onClick={onClear} style={railTextBtn} title="Show all decks">
            Clear
          </button>
        )}
        <button
          onClick={() => (editing ? stopEditing() : setEditing(true))}
          style={{ ...railTextBtn, color: editing ? 'var(--text)' : 'var(--text-mute)' }}
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* The rail stays visible with no tags: hiding it made the whole feature
          invisible on a fresh database, since tags are only created from a
          deck's own editor. */}
      {visible.length === 0 && (
        <p
          style={{
            margin: 0,
            padding: '2px 8px 4px',
            fontSize: 11,
            lineHeight: 1.5,
            color: 'var(--text-faint)',
          }}
        >
          No tags are in use. Choose Edit to rename or delete them.
        </p>
      )}

      {visible.map((tag) => {
        const c = tagColorTokens(tag.color);
        const isActive = selected.has(tag.id);
        const isEditingRow = editing && editingId === tag.id;

        return (
          <div key={tag.id}>
            <button
              type="button"
              className="tag-rail-row group"
              data-active={!editing && isActive}
              aria-pressed={editing ? undefined : isActive}
              title={
                editing
                  ? `Edit ${tag.name}`
                  : isActive
                    ? `Stop filtering by ${tag.name}`
                    : `Filter decks tagged ${tag.name}`
              }
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
                padding: '4px 8px 4px 0',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                textAlign: 'left',
                background: !editing && isActive ? c.wash : 'transparent',
                marginBottom: 1,
              }}
              onMouseEnter={(e) => {
                if (editing || !isActive) e.currentTarget.style.background = 'var(--bg-row-hov)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = !editing && isActive ? c.wash : 'transparent';
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 2,
                  alignSelf: 'stretch',
                  flexShrink: 0,
                  borderRadius: 1,
                  background: c.ink,
                  opacity: !editing && isActive ? 1 : 0.75,
                }}
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
                    transition: 'transform 120ms ease',
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
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-faint)',
                  }}
                >
                  {tag.deck_count ?? 0}
                </span>
              )}
            </button>

            {isEditingRow && (
              <div
                style={{
                  margin: '2px 0 8px 10px',
                  padding: 8,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-input)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <input
                  autoFocus
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(tag, true);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => commitRename(tag)}
                  style={{
                    width: '100%',
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
      })}
    </div>
  );
}

const railTextBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  color: 'var(--text-mute)',
  fontSize: 10,
  cursor: 'pointer',
};
