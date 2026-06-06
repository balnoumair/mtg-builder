import type { ReactNode } from 'react';

export interface PillStyle {
  color: string;
  border: string;
  background: string;
}

export const WISHLIST_PILL: PillStyle = {
  color: '#c9a86c',
  border: 'rgba(201, 168, 108, 0.35)',
  background: 'rgba(201, 168, 108, 0.1)',
};

export const COST_PILL: PillStyle = {
  color: '#9fcfee',
  border: 'rgba(95, 159, 207, 0.35)',
  background: 'rgba(95, 159, 207, 0.1)',
};

export const TYPE_PILL: PillStyle = {
  color: '#b09acc',
  border: 'rgba(176, 154, 204, 0.35)',
  background: 'rgba(176, 154, 204, 0.1)',
};

interface Props {
  children: ReactNode;
  style: PillStyle;
  compact?: boolean;
  icon?: ReactNode;
}

export default function PillLabel({ children, style, compact = false, icon }: Props) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: compact ? '2px 7px' : '3px 9px',
        fontFamily: 'var(--font-mono)',
        fontSize: compact ? 9 : 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        color: style.color,
        background: style.background,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {icon}
      {children}
    </span>
  );
}

export function formatCostGroupLabel(key: string): string {
  if (key === 'Land') return 'Land';
  return key;
}

interface GroupHeaderProps {
  label: string;
  style: PillStyle;
  count: number;
  compact?: boolean;
}

export function GroupPillHeader({ label, style, count, compact = true }: GroupHeaderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <PillLabel style={style} compact={compact}>
        {label}
      </PillLabel>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? 10 : 11,
          color: 'var(--text-faint)',
        }}
      >
        {count}
      </span>
    </div>
  );
}
