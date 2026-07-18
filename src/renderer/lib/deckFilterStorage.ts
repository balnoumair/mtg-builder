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

/** Collect non-empty Edition filters keyed by deck uuid for backup export. */
export function collectDeckSetsFiltersForBackup(
  decks: Array<{ id: number; uuid?: string | null }>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const deck of decks) {
    if (!deck.uuid) continue;
    const sets = loadDeckSetsFilter(deck.id);
    if (sets?.length) out[deck.uuid] = sets;
  }
  return out;
}

/** Apply backup Edition filters to localStorage, matched by uuid → current deck id. */
export function applyDeckSetsFiltersFromBackup(
  filterSets: Array<{ uuid: string; sets: string[] }>,
  decks: Array<{ id: number; uuid?: string | null }>,
): void {
  const idByUuid = new Map<string, number>();
  for (const deck of decks) {
    if (deck.uuid) idByUuid.set(deck.uuid, deck.id);
  }
  for (const entry of filterSets) {
    const id = idByUuid.get(entry.uuid);
    if (id === undefined) continue;
    saveDeckSetsFilter(id, entry.sets.length ? entry.sets : undefined);
  }
}
