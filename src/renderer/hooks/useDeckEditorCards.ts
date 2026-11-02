import { useRef } from 'react';
import type { CardFilters, Deck } from '../../shared/types';
import { useInfiniteCardSearch } from './useInfiniteCardSearch';

/**
 * Filters a deck's card search starts with, derived from the deck itself
 * rather than saved: its block or set, and its colors plus colorless and
 * multicolor. Empty and mixed decks start unfiltered on that axis.
 */
export function deckSearchDefaults(deck: Deck | undefined): Partial<CardFilters> {
  const sets = deck?.search_sets ?? [];
  const colors = deck?.color_identity ?? [];
  return {
    ...(sets.length > 0 ? { sets } : {}),
    ...(colors.length > 0 ? { colors, colorCategories: ['multicolor', 'colorless'] } : {}),
  };
}

export function useDeckEditorCards(deckId: number, options?: { enabled?: boolean; deck?: Deck }) {
  // Read at open time only: later deck edits must not reset a search in progress.
  const deckRef = useRef(options?.deck);
  deckRef.current = options?.deck;

  return useInfiniteCardSearch({
    resetKey: deckId,
    getInitialFilters: () => deckSearchDefaults(deckRef.current),
    enabled: options?.enabled,
  });
}
