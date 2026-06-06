import { useCallback, useRef } from 'react';
import { loadDeckSetsFilter, saveDeckSetsFilter } from '../lib/deckFilterStorage';
import { useInfiniteCardSearch } from './useInfiniteCardSearch';

export function useDeckEditorCards(deckId: number) {
  const deckIdRef = useRef(deckId);
  deckIdRef.current = deckId;

  const persistSets = useCallback((sets: ReturnType<typeof loadDeckSetsFilter>) => {
    saveDeckSetsFilter(deckIdRef.current, sets);
  }, []);

  return useInfiniteCardSearch({
    resetKey: deckId,
    getInitialFilters: () => ({ sets: loadDeckSetsFilter(deckId) }),
    onSetsChange: persistSets,
  });
}
