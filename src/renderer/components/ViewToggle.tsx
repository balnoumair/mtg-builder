interface Props<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options?: { value: T; label: string }[];
}

export default function ViewToggle<T extends string = 'grid' | 'list'>({
  value,
  onChange,
  options,
}: Props<T>) {
  const opts =
    options ??
    ([
      { value: 'grid' as T, label: 'grid' },
      { value: 'list' as T, label: 'list' },
    ] as { value: T; label: string }[]);

  return (
    <div
      style={{
        display: 'flex',
        gap: 1,
        background: 'var(--border)',
        padding: 1,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={{
            padding: '3px 9px',
            background: value === o.value ? 'var(--bg-row-sel)' : 'var(--bg-panel)',
            color: value === o.value ? 'var(--text)' : 'var(--text-mute)',
            border: 'none',
            borderRadius: 3,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
