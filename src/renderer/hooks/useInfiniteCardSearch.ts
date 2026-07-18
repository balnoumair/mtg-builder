import { useState, useEffect, useCallback, useRef } from 'react';
import type { Card, CardFilters } from '../../shared/types';

export const CARD_PAGE_SIZE = 60;

export const DEFAULT_CARD_FILTERS: CardFilters = {
  page: 1,
  pageSize: CARD_PAGE_SIZE,
  sortBy: 'name',
};

interface Options {
  getInitialFilters?: () => Partial<CardFilters>;
  onSetsChange?: (sets: CardFilters['sets']) => void;
  resetKey?: number | string;
  enabled?: boolean;
}

export function useInfiniteCardSearch(options: Options = {}) {
  const { getInitialFilters, onSetsChange, resetKey, enabled = true } = options;

  const [filters, setFilters] = useState<CardFilters>(() => ({
    ...DEFAULT_CARD_FILTERS,
    ...getInitialFilters?.(),
  }));
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const pageRef = useRef(1);
  const requestIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchImmediately = useRef(true);
  const skipNextResetKey = useRef(resetKey !== undefined);
  const lastFetchedFiltersRef = useRef<CardFilters | null>(null);

  const fetchPage = useCallback(async (f: CardFilters, page: number, append: boolean) => {
    const requestId = ++requestIdRef.current;
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await window.electronAPI.searchCards({
        ...f,
        page,
        pageSize: CARD_PAGE_SIZE,
      });
      if (requestId !== requestIdRef.current) return;

      setTotal(res.total);
      setCards((prev) => (append ? [...prev, ...res.cards] : res.cards));
      pageRef.current = page;
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (resetKey === undefined) return;
    if (skipNextResetKey.current) {
      skipNextResetKey.current = false;
      return;
    }
    searchImmediately.current = true;
    pageRef.current = 1;
    // Keep the previous results on screen (dimmed via `loading`) instead of
    // flashing the skeleton grid; the refetch below replaces them in place.
    setLoading(true);
    setFilters({ ...DEFAULT_CARD_FILTERS, ...getInitialFilters?.() });
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onSetsChange?.(filters.sets);
  }, [filters.sets, onSetsChange]);

  useEffect(() => {
    if (!enabled) return;
    // Re-enabled (e.g. tab became visible) with these exact filters already
    // fetched: the card pool can't have changed, so skip the refetch instead
    // of visibly dimming the grid for nothing.
    if (lastFetchedFiltersRef.current === filters) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = searchImmediately.current ? 0 : 300;
    searchImmediately.current = false;

    debounceRef.current = setTimeout(() => {
      // Marked here, not when scheduling: a debounce cancelled by a tab
      // switch must still count as unfetched on return.
      lastFetchedFiltersRef.current = filters;
      pageRef.current = 1;
      requestIdRef.current += 1;
      fetchPage(filters, 1, false);
    }, delay);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, fetchPage, enabled]);

  const updateFilters = useCallback((updates: Partial<CardFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates, page: 1 }));
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || cards.length >= total) return;
    fetchPage(filters, pageRef.current + 1, true);
  }, [loading, loadingMore, cards.length, total, filters, fetchPage]);

  const hasMore = cards.length < total;

  return {
    filters,
    updateFilters,
    cards,
    total,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    result: { cards, total },
  };
}
