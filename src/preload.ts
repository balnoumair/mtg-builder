import { contextBridge, ipcRenderer } from 'electron';
import type { CardFilters, Deck, ElectronAPI, ImportProgress } from './shared/types';

const api: ElectronAPI = {
  getDbStatus: () => ipcRenderer.invoke('db:status'),
  syncCards: () => ipcRenderer.invoke('sync:cards'),
  onSyncProgress: (callback: (progress: ImportProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ImportProgress) => callback(progress);
    ipcRenderer.on('sync:progress', handler);
    return () => { ipcRenderer.removeListener('sync:progress', handler); };
  },
  searchCards: (filters: CardFilters) => ipcRenderer.invoke('cards:search', filters),
  getCard: (id: string) => ipcRenderer.invoke('cards:get', id),
  getSets: () => ipcRenderer.invoke('cards:sets'),
  getDecks: () => ipcRenderer.invoke('decks:list'),
  getTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (input: { name: string; color?: string }) => ipcRenderer.invoke('tags:create', input),
  updateTag: (id: number, updates: { name?: string; color?: string }) => ipcRenderer.invoke('tags:update', id, updates),
  deleteTag: (id: number) => ipcRenderer.invoke('tags:delete', id),
  setDeckTags: (deckId: number, tagIds: number[]) => ipcRenderer.invoke('decks:setTags', deckId, tagIds),
  exportBackup: (filterSetsByUuid?: Record<string, string[]>) =>
    ipcRenderer.invoke('backup:export', filterSetsByUuid ?? {}),
  importBackup: () => ipcRenderer.invoke('backup:import'),
  createDeck: (deck: { name: string; format?: string }) => ipcRenderer.invoke('decks:create', deck),
  updateDeck: (id: number, updates: Partial<Deck>) => ipcRenderer.invoke('decks:update', id, updates),
  deleteDeck: (id: number) => ipcRenderer.invoke('decks:delete', id),
  getDeckCards: (deckId: number) => ipcRenderer.invoke('decks:getCards', deckId),
  addCardToDeck: (deckId: number, cardId: string, board?: string, count?: number) => ipcRenderer.invoke('decks:addCard', deckId, cardId, board, count),
  updateCardQuantity: (deckId: number, cardId: string, board: string, quantity: number) => ipcRenderer.invoke('decks:updateQuantity', deckId, cardId, board, quantity),
  removeCardFromDeck: (deckId: number, cardId: string, board: string) => ipcRenderer.invoke('decks:removeCard', deckId, cardId, board),
  setDeckCardIgnoreLimit: (deckId: number, cardId: string, ignore: boolean) => ipcRenderer.invoke('decks:setCardIgnoreLimit', deckId, cardId, ignore),
  claimDeckFromCollection: (deckId: number) => ipcRenderer.invoke('decks:claim', deckId),
  confirmDeckChanges: (deckId: number) => ipcRenderer.invoke('decks:confirmChanges', deckId),
  discardDeckChanges: (deckId: number) => ipcRenderer.invoke('decks:discardChanges', deckId),
  getCollection: (filters: CardFilters) => ipcRenderer.invoke('collection:get', filters),
  getCollectionQuantities: (cardIds: string[]) => ipcRenderer.invoke('collection:quantities', cardIds),
  addToCollection: (cardId: string, quantity?: number) => ipcRenderer.invoke('collection:add', cardId, quantity),
  updateCollectionQuantity: (cardId: string, quantity: number) => ipcRenderer.invoke('collection:update', cardId, quantity),
  removeFromCollection: (cardId: string) => ipcRenderer.invoke('collection:remove', cardId),
  getCollectionStats: () => ipcRenderer.invoke('collection:stats'),
  getWants: () => ipcRenderer.invoke('wants:list'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
