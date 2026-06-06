import { useCallback, useState } from 'react';
import type { Card } from '../../shared/types';
import { useInfiniteCardSearch } from './useInfiniteCardSearch';

export function useCards() {
  return useInfiniteCardSearch();
}

export function useCardDetail() {
  const [card, setCard] = useState<Card | null>(null);
  const [printings, setPrintings] = useState<Card[]>([]);
  const [open, setOpen] = useState(false);

  const showCard = useCallback(async (c: Card) => {
    setCard(c);
    setOpen(true);
    const prints = await window.electronAPI.getCardPrintings(c.oracle_id);
    setPrintings(prints);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setCard(null);
    setPrintings([]);
  }, []);

  return { card, printings, open, showCard, close };
}
