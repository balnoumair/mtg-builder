import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import type { ElectronAPI } from '../../shared/types';
import { invalidateSetsCache } from '../hooks/useSets';

const createElectronApiMock = (): ElectronAPI =>
  ({
    getDbStatus: vi.fn(),
    syncCards: vi.fn(),
    onSyncProgress: vi.fn(() => () => undefined),
    searchCards: vi.fn(),
    getCard: vi.fn(),
    getSets: vi.fn().mockResolvedValue([]),
    getAllSets: vi.fn().mockResolvedValue([]),
    getAvailableCardLanguages: vi.fn().mockResolvedValue(['en']),
    getAppSettings: vi.fn().mockResolvedValue({
      locale: 'en',
      syncLanguages: ['en'],
      browseLanguage: 'en',
    }),
    updateAppSettings: vi.fn(async (updates) => ({
      locale: 'en',
      syncLanguages: ['en'],
      browseLanguage: 'en',
      ...updates,
    })),
    getDecks: vi.fn(),
    getTags: vi.fn().mockResolvedValue([]),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    setDeckTags: vi.fn(),
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
    previewBackupImport: vi.fn(),
    applyBackupImport: vi.fn(),
    createDeck: vi.fn(),
    updateDeck: vi.fn(),
    deleteDeck: vi.fn(),
    getDeckCards: vi.fn(),
    addCardToDeck: vi.fn(),
    updateCardQuantity: vi.fn(),
    removeCardFromDeck: vi.fn(),
    setDeckCardIgnoreLimit: vi.fn(),
    setDeckCardIgnoreColors: vi.fn(),
    claimDeckFromCollection: vi.fn(),
    confirmDeckChanges: vi.fn(),
    discardDeckChanges: vi.fn(),
    getCollection: vi.fn(),
    getCollectionQuantities: vi.fn(),
    getInDeckQuantities: vi.fn(),
    addToCollection: vi.fn(),
    updateCollectionQuantity: vi.fn(),
    removeFromCollection: vi.fn(),
    getCollectionStats: vi.fn(),
    getWants: vi.fn(),
    getSheetSyncSettings: vi.fn(),
    updateSheetSyncSettings: vi.fn(),
    pickServiceAccountKey: vi.fn(),
    getDriveSyncSettings: vi.fn(),
    updateDriveSyncSettings: vi.fn(),
    pushBackupToDrive: vi.fn(),
    pullBackupFromDrive: vi.fn(),
    previewBackupFromDrive: vi.fn(),
    applyBackupFromDrive: vi.fn(),
    pullSheet: vi.fn(),
    previewSheetPull: vi.fn(),
    applySheetPull: vi.fn(),
    getExternalDecks: vi.fn(),
    getSheetBlockLabels: vi.fn(),
    getSheetBlockMappings: vi.fn(),
    setSheetBlockCodes: vi.fn(),
    resetSheetBlockCodes: vi.fn(),
    planSheetPush: vi.fn(),
    executeSheetPush: vi.fn(),
    assignSheetBlock: vi.fn(),
  }) as ElectronAPI;

beforeEach(() => {
  invalidateSetsCache();
  if (typeof window !== 'undefined') {
    window.electronAPI = createElectronApiMock();
  }
});

afterEach(() => {
  cleanup();
});
