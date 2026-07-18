import { useCallback, useState } from 'react';
import type { Card } from '../../shared/types';
import { useInfiniteCardSearch } from './useInfiniteCardSearch';

export function useCards() {
  return useInfiniteCardSearch();
}

export function useCardDetail() {
  const [card, setCard] = useState<Card | null>(null);
  const [open, setOpen] = useState(false);

  const showCard = useCallback((c: Card) => {
    setCard(c);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setCard(null);
  }, []);

  return { card, open, showCard, close };
}
