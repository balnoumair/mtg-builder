import { contextBridge, ipcRenderer } from 'electron';
import type { CardFilters, Deck, ElectronAPI, ImportProgress } from './shared/types';

const api: ElectronAPI = {
  getDbStatus: () => ipcRenderer.invoke('db:status'),
  selectFile: () => ipcRenderer.invoke('dialog:selectFile'),
  importCards: (filePath: string) => ipcRenderer.invoke('import:cards', filePath),
  onImportProgress: (callback: (progress: ImportProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ImportProgress) => callback(progress);
    ipcRenderer.on('import:progress', handler);
    return () => { ipcRenderer.removeListener('import:progress', handler); };
  },
  searchCards: (filters: CardFilters) => ipcRenderer.invoke('cards:search', filters),
  getCard: (id: string) => ipcRenderer.invoke('cards:get', id),
  getCardPrintings: (oracleId: string) => ipcRenderer.invoke('cards:printings', oracleId),
  getSets: () => ipcRenderer.invoke('cards:sets'),
  getDecks: () => ipcRenderer.invoke('decks:list'),
  createDeck: (deck: { name: string; format?: string }) => ipcRenderer.invoke('decks:create', deck),
  updateDeck: (id: number, updates: Partial<Deck>) => ipcRenderer.invoke('decks:update', id, updates),
  deleteDeck: (id: number) => ipcRenderer.invoke('decks:delete', id),
  getDeckCards: (deckId: number) => ipcRenderer.invoke('decks:getCards', deckId),
  addCardToDeck: (deckId: number, cardId: string, board?: string) => ipcRenderer.invoke('decks:addCard', deckId, cardId, board),
  updateCardQuantity: (deckId: number, cardId: string, board: string, quantity: number) => ipcRenderer.invoke('decks:updateQuantity', deckId, cardId, board, quantity),
  removeCardFromDeck: (deckId: number, cardId: string, board: string) => ipcRenderer.invoke('decks:removeCard', deckId, cardId, board),
};

contextBridge.exposeInMainWorld('electronAPI', api);
