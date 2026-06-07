interface Props {
  label: string;
  compact?: boolean;
}

export default function DeckSetGroupLabel({ label, compact = false }: Props) {
  return (
    <div
      style={{
        padding: compact ? '6px 8px 2px 12px' : '0 0 6px',
        marginTop: compact ? 2 : 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? 9 : 10,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-faint)',
          userSelect: 'none',
        }}
      >
        {label}
      </span>
    </div>
  );
}
