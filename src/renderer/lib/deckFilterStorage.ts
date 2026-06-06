import type { CardFilters } from '../../shared/types';

const storageKey = (deckId: number) => `deck-search-filters:${deckId}`;

export function loadDeckSetsFilter(deckId: number): string[] | undefined {
  try {
    const raw = localStorage.getItem(storageKey(deckId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { sets?: string[] };
    return parsed.sets?.length ? parsed.sets : undefined;
  } catch {
    return undefined;
  }
}

export function saveDeckSetsFilter(deckId: number, sets: CardFilters['sets']): void {
  try {
    if (sets?.length) {
      localStorage.setItem(storageKey(deckId), JSON.stringify({ sets }));
    } else {
      localStorage.removeItem(storageKey(deckId));
    }
  } catch {
    // ignore quota / private mode
  }
}
