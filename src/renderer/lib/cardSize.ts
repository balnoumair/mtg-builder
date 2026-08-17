import { useCallback, useEffect, useState } from 'react';

export type CardSize = 'small' | 'standard' | 'large';

export const CARD_SIZE_ORDER: CardSize[] = ['small', 'standard', 'large'];

export const CARD_SIZE_LABELS: Record<CardSize, string> = {
  small: 'S',
  standard: 'M',
  large: 'L',
};

export const CARD_GRID_MIN_WIDTH: Record<CardSize, number> = {
  small: 190,
  standard: 230,
  large: 300,
};

export const CARD_DETAIL_WIDTH: Record<CardSize, number> = {
  small: 240,
  standard: 280,
  large: 340,
};

const STORAGE_KEY = 'mtg-builder.card-size';
const CARD_SIZE_EVENT = 'mtg-builder:card-size-changed';

function readCardSize(): CardSize {
  if (typeof window === 'undefined') return 'standard';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && CARD_SIZE_ORDER.includes(saved as CardSize)) return saved as CardSize;
  } catch {
    // localStorage may be unavailable in a restricted renderer context.
  }
  return 'standard';
}

export function useCardSize(): [CardSize, (size: CardSize) => void] {
  const [size, setSize] = useState<CardSize>(readCardSize);

  useEffect(() => {
    const handleChange = (event: Event) => {
      const next = (event as CustomEvent<CardSize>).detail;
      if (CARD_SIZE_ORDER.includes(next)) setSize(next);
    };
    window.addEventListener(CARD_SIZE_EVENT, handleChange);
    return () => window.removeEventListener(CARD_SIZE_EVENT, handleChange);
  }, []);

  const update = useCallback((next: CardSize) => {
    setSize(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new CustomEvent<CardSize>(CARD_SIZE_EVENT, { detail: next }));
    } catch {
      // Keep the in-memory setting even when persistence is unavailable.
    }
  }, []);

  return [size, update];
}

export function stepCardSize(size: CardSize, direction: -1 | 1): CardSize {
  const index = CARD_SIZE_ORDER.indexOf(size);
  return CARD_SIZE_ORDER[Math.max(0, Math.min(CARD_SIZE_ORDER.length - 1, index + direction))];
}
