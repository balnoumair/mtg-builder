import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

interface Props {
  label: string;
  options: FilterOption[];
  /** Values that are currently hidden; everything else shows. */
  hidden: string[];
  onHiddenChange: (next: string[]) => void;
  emptyHint?: ReactNode;
  /**
   * Which edge the panel hangs from. Defaults to the right, because these live
   * in a right-aligned toolbar where a left-anchored panel would open past the
   * window edge and get clipped.
   */
  align?: 'left' | 'right';
}

/**
 * A checklist dropdown that hides values rather than selecting them, so the
 * default (nothing chosen) shows everything. The checkbox toggles one value;
 * clicking the name isolates it, and clicking the name of an already-isolated
 * value returns to showing everything.
 */
export default function FilterDropdown({
  label,
  options,
  hidden,
  onHiddenChange,
  emptyHint,
  align = 'right',
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const hiddenCount = hidden.length;
  const allValues = options.map((o) => o.value);

  const toggle = (value: string) =>
    onHiddenChange(
      hidden.includes(value) ? hidden.filter((v) => v !== value) : [...hidden, value],
    );

  const solo = (value: string) => {
    const isSolo = hidden.length === allValues.length - 1 && !hidden.includes(value);
    onHiddenChange(isSolo ? [] : allValues.filter((v) => v !== value));
  };

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          background: hiddenCount > 0 ? 'var(--accent-soft)' : 'var(--bg-chip)',
          border: `1px solid ${hiddenCount > 0 ? 'var(--accent-line)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-sm)',
          color: hiddenCount > 0 ? 'var(--accent)' : 'var(--text)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
        }}
      >
        {label}
        {hiddenCount > 0 && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>−{hiddenCount}</span>
        )}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            zIndex: 30,
            minWidth: 220,
            maxWidth: 320,
            maxHeight: 320,
            overflowY: 'auto',
            padding: 6,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-mute)' }}>
              {emptyHint ?? 'Nothing to filter yet'}
            </div>
          ) : (
            <>
              {options.map((opt) => {
                const isHidden = hidden.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 12,
                      color: isHidden ? 'var(--text-mute)' : 'var(--text)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-row-hov)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggle(opt.value)}
                      title={isHidden ? 'Show this' : 'Hide this'}
                      style={{ accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <button
                      onClick={() => solo(opt.value)}
                      title="Show only this"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'inherit',
                        fontSize: 12,
                        fontFamily: 'var(--font-ui)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: isHidden ? 'line-through' : 'none',
                      }}
                    >
                      {opt.label}
                    </button>
                    <span
                      style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}
                    >
                      {opt.count}
                    </span>
                  </div>
                );
              })}
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  marginTop: 4,
                  paddingTop: 4,
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  onClick={() => onHiddenChange([])}
                  disabled={hiddenCount === 0}
                  style={footerBtn(hiddenCount === 0)}
                >
                  Show all
                </button>
                <button
                  onClick={() => onHiddenChange(allValues)}
                  disabled={hiddenCount === allValues.length}
                  style={footerBtn(hiddenCount === allValues.length)}
                >
                  Hide all
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function footerBtn(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '5px 8px',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    color: disabled ? 'var(--text-faint)' : 'var(--text-mute)',
    fontSize: 11,
    cursor: disabled ? 'default' : 'pointer',
    textAlign: 'center',
    fontFamily: 'var(--font-ui)',
  };
}
