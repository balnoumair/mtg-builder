import { useState, useEffect, useCallback, useRef } from 'react';
import type { CardFilters, CollectionCard, CollectionStats } from '../../shared/types';

export function useCollection() {
  const [filters, setFilters] = useState<CardFilters>({
    page: 1,
    pageSize: 60,
    sortBy: 'name',
  });
  const [result, setResult] = useState<{ cards: CollectionCard[]; total: number }>({ cards: [], total: 0 });
  const [stats, setStats] = useState<CollectionStats>({ uniqueCards: 0, totalCopies: 0, estimatedValue: null });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchStats = useCallback(async () => {
    try {
      const s = await window.electronAPI.getCollectionStats();
      setStats(s);
    } catch (err) {
      console.error('Failed to fetch collection stats:', err);
    }
  }, []);

  const search = useCallback(async (f: CardFilters) => {
    setLoading(true);
    try {
      const res = await window.electronAPI.getCollection(f);
      setResult(res);
    } catch (err) {
      console.error('Collection search failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(filters), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, search]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const updateFilters = useCallback((updates: Partial<CardFilters>) => {
    setFilters(prev => ({ ...prev, ...updates, page: updates.page ?? 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  const refresh = useCallback(() => {
    search(filters);
    fetchStats();
  }, [filters, search, fetchStats]);

  return { filters, updateFilters, setPage, result, stats, loading, refresh };
}

export function useCollectionLookup(cardIds: string[], version = 0) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const idsKey = cardIds.join(',');

  useEffect(() => {
    if (cardIds.length === 0) {
      setQuantities({});
      return;
    }
    window.electronAPI.getCollectionQuantities(cardIds).then(setQuantities).catch(console.error);
  }, [idsKey, version]);

  return quantities;
}

export function useCollectionActions(onChanged?: () => void) {
  const addToCollection = useCallback(async (cardId: string, quantity?: number) => {
    await window.electronAPI.addToCollection(cardId, quantity);
    onChanged?.();
  }, [onChanged]);

  const updateCollectionQuantity = useCallback(async (cardId: string, quantity: number) => {
    await window.electronAPI.updateCollectionQuantity(cardId, quantity);
    onChanged?.();
  }, [onChanged]);

  const removeFromCollection = useCallback(async (cardId: string) => {
    await window.electronAPI.removeFromCollection(cardId);
    onChanged?.();
  }, [onChanged]);

  return { addToCollection, updateCollectionQuantity, removeFromCollection };
}
