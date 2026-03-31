import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card, CardFilters, CardSearchResult } from '../../shared/types';

export function useCards() {
  const [filters, setFilters] = useState<CardFilters>({
    page: 1,
    pageSize: 60,
    sortBy: 'name',
    uniqueBy: 'oracle_id',
  });
  const [result, setResult] = useState<CardSearchResult>({ cards: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (f: CardFilters) => {
    setLoading(true);
    try {
      const res = await window.electronAPI.searchCards(f);
      setResult(res);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(filters), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, search]);

  const updateFilters = useCallback((updates: Partial<CardFilters>) => {
    setFilters(prev => ({ ...prev, ...updates, page: updates.page ?? 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  return { filters, updateFilters, setPage, result, loading };
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
