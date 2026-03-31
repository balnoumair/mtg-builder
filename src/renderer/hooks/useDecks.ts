import { useState, useEffect, useCallback } from 'react';
import type { Deck, DeckCard } from '../../shared/types';

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const list = await window.electronAPI.getDecks();
    setDecks(list);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const createDeck = useCallback(async (name: string, format?: string) => {
    const deck = await window.electronAPI.createDeck({ name, format });
    await refresh();
    return deck;
  }, [refresh]);

  const deleteDeck = useCallback(async (id: number) => {
    await window.electronAPI.deleteDeck(id);
    await refresh();
  }, [refresh]);

  const updateDeck = useCallback(async (id: number, updates: Partial<Deck>) => {
    await window.electronAPI.updateDeck(id, updates);
    await refresh();
  }, [refresh]);

  return { decks, loading, createDeck, deleteDeck, updateDeck, refresh };
}

export function useDeckCards(deckId: number | null) {
  const [cards, setCards] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!deckId) { setCards([]); return; }
    setLoading(true);
    const list = await window.electronAPI.getDeckCards(deckId);
    setCards(list);
    setLoading(false);
  }, [deckId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addCard = useCallback(async (cardId: string, board = 'main') => {
    if (!deckId) return;
    await window.electronAPI.addCardToDeck(deckId, cardId, board);
    await refresh();
  }, [deckId, refresh]);

  const updateQuantity = useCallback(async (cardId: string, board: string, quantity: number) => {
    if (!deckId) return;
    await window.electronAPI.updateCardQuantity(deckId, cardId, board, quantity);
    await refresh();
  }, [deckId, refresh]);

  const removeCard = useCallback(async (cardId: string, board: string) => {
    if (!deckId) return;
    await window.electronAPI.removeCardFromDeck(deckId, cardId, board);
    await refresh();
  }, [deckId, refresh]);

  return { cards, loading, addCard, updateQuantity, removeCard, refresh };
}
