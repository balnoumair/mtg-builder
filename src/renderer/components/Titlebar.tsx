interface Props {
  title: string;
  subtitle?: string;
}

export default function Titlebar({ title, subtitle }: Props) {
  return (
    <div
      style={{
        height: 'var(--titlebar-h)',
        background: 'var(--bg-window)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-ui)',
          fontSize: 12,
          color: 'var(--text-dim)',
          pointerEvents: 'none',
        }}
      >
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{title}</span>
        {subtitle && (
          <>
            <span style={{ color: 'var(--text-faint)' }}>—</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
              {subtitle}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
