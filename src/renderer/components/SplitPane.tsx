import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface PaneControls {
  collapse: () => void;
}

type PaneContent = ReactNode | ((controls: PaneControls) => ReactNode);

interface Props {
  left: PaneContent;
  right: PaneContent;
  leftLabel?: string;
  rightLabel?: string;
  defaultRightWidth?: number;
  minLeft?: number;
  minRight?: number;
  storageKey?: string;
}

const DIVIDER_W = 4;
const COLLAPSED_W = 28;

function loadWidth(key: string | undefined, fallback: number) {
  if (!key) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function renderPane(content: PaneContent, collapse: () => void) {
  return typeof content === 'function' ? content({ collapse }) : content;
}

function CollapsedRail({
  label,
  side,
  onExpand,
}: {
  label: string;
  side: 'left' | 'right';
  onExpand: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onExpand}
      title={`Show ${label}`}
      style={{
        width: COLLAPSED_W,
        flexShrink: 0,
        alignSelf: 'stretch',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        background: 'var(--bg-panel)',
        border: 'none',
        borderRight: side === 'left' ? '1px solid var(--border)' : 'none',
        borderLeft: side === 'right' ? '1px solid var(--border)' : 'none',
        color: 'var(--text-mute)',
        cursor: 'pointer',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-row-hov)';
        e.currentTarget.style.color = 'var(--text-dim)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-panel)';
        e.currentTarget.style.color = 'var(--text-mute)';
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        {side === 'left' ? (
          <path d="M3.5 2L7 5L3.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M6.5 2L3 5L6.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
      <span
        style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: side === 'left' ? 'rotate(180deg)' : 'none',
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
    </button>
  );
}

export default function SplitPane({
  left,
  right,
  leftLabel = 'Search',
  rightLabel = 'Deck',
  defaultRightWidth = 360,
  minLeft = 300,
  minRight = 260,
  storageKey,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastRightWidth = useRef(loadWidth(storageKey, defaultRightWidth));
  const [rightWidth, setRightWidth] = useState(lastRightWidth.current);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const clampRightWidth = useCallback(
    (width: number) => {
      const container = containerRef.current;
      if (!container) return Math.max(minRight, width);
      const maxRight = container.clientWidth - minLeft - DIVIDER_W;
      return Math.max(minRight, Math.min(maxRight, width));
    },
    [minLeft, minRight],
  );

  useEffect(() => {
    if (!storageKey || leftCollapsed || rightCollapsed) return;
    try {
      localStorage.setItem(storageKey, String(rightWidth));
    } catch {
      // ignore quota / private mode
    }
    lastRightWidth.current = rightWidth;
  }, [rightWidth, storageKey, leftCollapsed, rightCollapsed]);

  useEffect(() => {
    const onResize = () => setRightWidth((w) => clampRightWidth(w));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampRightWidth]);

  const collapseLeft = useCallback(() => {
    setLeftCollapsed(true);
    setRightCollapsed(false);
  }, []);

  const collapseRight = useCallback(() => {
    setRightCollapsed(true);
    setLeftCollapsed(false);
    if (rightWidth > 0) lastRightWidth.current = rightWidth;
  }, [rightWidth]);

  const expandLeft = () => setLeftCollapsed(false);

  const expandRight = () => {
    setRightCollapsed(false);
    setRightWidth(clampRightWidth(lastRightWidth.current || defaultRightWidth));
  };

  const onDividerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (leftCollapsed || rightCollapsed) return;
    dragRef.current = { startX: e.clientX, startWidth: rightWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onDividerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startX - e.clientX;
    setRightWidth(clampRightWidth(dragRef.current.startWidth + delta));
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const resetWidth = () => {
    setRightWidth(clampRightWidth(defaultRightWidth));
  };

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {leftCollapsed ? (
        <CollapsedRail label={leftLabel} side="left" onExpand={expandLeft} />
      ) : (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {renderPane(left, collapseLeft)}
        </div>
      )}

      {!leftCollapsed && !rightCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={rightWidth}
          className="split-divider"
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={resetWidth}
          title="Drag to resize · Double-click to reset"
          style={{
            width: DIVIDER_W,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'var(--border)',
            touchAction: 'none',
          }}
        />
      )}

      {rightCollapsed ? (
        <CollapsedRail label={rightLabel} side="right" onExpand={expandRight} />
      ) : (
        <div
          style={{
            ...(leftCollapsed
              ? { flex: 1, minWidth: 0 }
              : { width: rightWidth, flexShrink: 0 }),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {renderPane(right, collapseRight)}
        </div>
      )}
    </div>
  );
}

export function PanelCollapseButton({
  onClick,
  title,
  direction,
}: {
  onClick: () => void;
  title: string;
  direction: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 22,
        height: 22,
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        border: '1px solid var(--border)',
        color: 'var(--text-mute)',
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-row-hov)';
        e.currentTarget.style.color = 'var(--text-dim)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--text-mute)';
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        {direction === 'left' ? (
          <path d="M2.5 2L6 5L2.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M7.5 2L4 5L7.5 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}
