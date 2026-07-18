import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { ElectronAPI } from '../../shared/types';
import { invalidateSetsCache } from '../hooks/useSets';

const createElectronApiMock = (): ElectronAPI => ({
  getDbStatus: vi.fn(),
  syncCards: vi.fn(),
  onSyncProgress: vi.fn(() => () => undefined),
  searchCards: vi.fn(),
  getCard: vi.fn(),
  getSets: vi.fn().mockResolvedValue([]),
  getDecks: vi.fn(),
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  createDeck: vi.fn(),
  updateDeck: vi.fn(),
  deleteDeck: vi.fn(),
  getDeckCards: vi.fn(),
  addCardToDeck: vi.fn(),
  updateCardQuantity: vi.fn(),
  removeCardFromDeck: vi.fn(),
  claimDeckFromCollection: vi.fn(),
  getCollection: vi.fn(),
  getCollectionQuantities: vi.fn(),
  addToCollection: vi.fn(),
  updateCollectionQuantity: vi.fn(),
  removeFromCollection: vi.fn(),
  getCollectionStats: vi.fn(),
});

beforeEach(() => {
  invalidateSetsCache();
  if (typeof window !== 'undefined') {
    window.electronAPI = createElectronApiMock();
  }
});

afterEach(() => {
  cleanup();
});
