import type { CSSProperties } from 'react';

export const cardRowButton: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
};

export const cardHoverButton: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(0,0,0,0.55)',
  border: '1px solid rgba(255,255,255,0.14)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  cursor: 'pointer',
  lineHeight: 1,
  padding: 0,
  backdropFilter: 'blur(6px)',
};

export const cardHoverBar: CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: 6,
  display: 'flex',
  gap: 4,
  background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7) 50%)',
};
