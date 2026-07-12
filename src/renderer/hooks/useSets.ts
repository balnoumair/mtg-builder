import { useEffect, useState } from 'react';
import type { CardSet } from '../../shared/types';

let cachedSets: CardSet[] | null = null;
let setsPromise: Promise<CardSet[]> | null = null;

function loadSets(): Promise<CardSet[]> {
  if (cachedSets) return Promise.resolve(cachedSets);
  if (!setsPromise) {
    setsPromise = window.electronAPI.getSets().then((sets) => {
      cachedSets = sets;
      return sets;
    });
  }
  return setsPromise;
}

/** Cached set catalog shared across filter panels. */
export function useSets() {
  const [sets, setSets] = useState<CardSet[]>(cachedSets ?? []);

  useEffect(() => {
    let cancelled = false;
    loadSets().then((next) => {
      if (!cancelled) setSets(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return sets;
}

export function invalidateSetsCache(): void {
  cachedSets = null;
  setsPromise = null;
}
