import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'node:fs';
import { getDb } from './database';
import { syncCards } from './import';
import { exportBackup, importBackup } from './backup';
import * as cardQueries from './queries/cards';
import * as deckQueries from './queries/decks';
import * as collectionQueries from './queries/collection';
import * as wantsQueries from './queries/wants';
import * as tagQueries from './queries/tags';
import * as settingsQueries from './queries/settings';
import * as externalDeckQueries from './queries/externalDecks';
import {
  pullFromSheet,
  getSheetBlocks,
  getSheetBlockMappings,
  setSheetBlockCodes,
  resetSheetBlockCodes,
  parseSpreadsheetId,
} from './sheet-sync/pull';
import { planPush, executePush, assignBlockMapping } from './sheet-sync/push';
import { copyServiceAccountKey } from './sheet-sync/googleAuth';
import { parseDriveFileId, pullBackupFromDrive, pushBackupToDrive } from './drive-sync';
import type { CardFilters, Deck, SheetPushPlan, SheetSyncSettings } from '../shared/types';

export function registerIpcHandlers(): void {
  ipcMain.handle('db:status', () => {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
    return { ready: row.count > 0, cardCount: row.count };
  });

  ipcMain.handle('sync:cards', async (event) => {
    const db = getDb();
    const win = BrowserWindow.fromWebContents(event.sender);
    await syncCards(db, (current, total, phase) => {
      win?.webContents.send('sync:progress', { current, total, phase });
    });
  });

  ipcMain.handle('cards:search', (_event, filters: CardFilters) => {
    return cardQueries.searchCards(getDb(), filters);
  });

  ipcMain.handle('cards:get', (_event, id: string) => {
    return cardQueries.getCard(getDb(), id);
  });

  ipcMain.handle('cards:sets', () => {
    return cardQueries.getSets(getDb());
  });

  ipcMain.handle('cards:allSets', () => {
    return cardQueries.getAllSets(getDb());
  });

  ipcMain.handle('decks:list', () => {
    return deckQueries.getDecks(getDb());
  });

  ipcMain.handle('backup:export', async (event, filterSetsByUuid: Record<string, string[]> = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { saved: false };
    const backup = exportBackup(getDb(), filterSetsByUuid);
    if (backup.decks.length === 0 && backup.collection.length === 0) {
      return { saved: false, error: 'Nothing to back up' };
    }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: `mtg-builder-backup-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'mtg-builder backup', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { saved: false };
    try {
      fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
      return { saved: true, path: filePath };
    } catch (err) {
      return { saved: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('backup:import', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      return {
        decksImported: 0,
        decksUpdated: 0,
        collectionCards: 0,
        tagsImported: 0,
        missing: [],
        filterSets: [],
      };
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      filters: [{ name: 'mtg-builder backup', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths[0]) {
      return {
        decksImported: 0,
        decksUpdated: 0,
        collectionCards: 0,
        tagsImported: 0,
        missing: [],
        filterSets: [],
        canceled: true,
      };
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
      return importBackup(getDb(), parsed);
    } catch (err) {
      return {
        decksImported: 0,
        decksUpdated: 0,
        collectionCards: 0,
        tagsImported: 0,
        missing: [],
        filterSets: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('tags:list', () => {
    return tagQueries.getTags(getDb());
  });

  ipcMain.handle('tags:create', (_event, input: { name: string; color?: string }) => {
    return tagQueries.createTag(getDb(), input);
  });

  ipcMain.handle('tags:update', (_event, id: number, updates: { name?: string; color?: string }) => {
    return tagQueries.updateTag(getDb(), id, updates);
  });

  ipcMain.handle('tags:delete', (_event, id: number) => {
    return tagQueries.deleteTag(getDb(), id);
  });

  ipcMain.handle('decks:setTags', (_event, deckId: number, tagIds: number[]) => {
    return tagQueries.setDeckTags(getDb(), deckId, tagIds);
  });

  ipcMain.handle('decks:create', (_event, deck: { name: string; format?: string }) => {
    return deckQueries.createDeck(getDb(), deck);
  });

  ipcMain.handle('decks:update', (_event, id: number, updates: Partial<Deck>) => {
    return deckQueries.updateDeck(getDb(), id, updates);
  });

  ipcMain.handle('decks:delete', (_event, id: number) => {
    return deckQueries.deleteDeck(getDb(), id);
  });

  ipcMain.handle('decks:getCards', (_event, deckId: number) => {
    return deckQueries.getDeckCards(getDb(), deckId);
  });

  ipcMain.handle('decks:addCard', (_event, deckId: number, cardId: string, board?: string, count?: number) => {
    return deckQueries.addCardToDeck(getDb(), deckId, cardId, board, count);
  });

  ipcMain.handle('decks:updateQuantity', (_event, deckId: number, cardId: string, board: string, quantity: number) => {
    return deckQueries.updateCardQuantity(getDb(), deckId, cardId, board, quantity);
  });

  ipcMain.handle('decks:removeCard', (_event, deckId: number, cardId: string, board: string) => {
    return deckQueries.removeCardFromDeck(getDb(), deckId, cardId, board);
  });

  ipcMain.handle('decks:setCardIgnoreLimit', (_event, deckId: number, cardId: string, ignore: boolean) => {
    return deckQueries.setDeckCardIgnoreLimit(getDb(), deckId, cardId, ignore);
  });

  ipcMain.handle('decks:claim', (_event, deckId: number) => {
    return deckQueries.claimDeckFromCollection(getDb(), deckId);
  });

  ipcMain.handle('decks:confirmChanges', (_event, deckId: number) => {
    return deckQueries.confirmDeckChanges(getDb(), deckId);
  });

  ipcMain.handle('decks:discardChanges', (_event, deckId: number) => {
    return deckQueries.discardDeckChanges(getDb(), deckId);
  });

  // Collection
  ipcMain.handle('collection:get', (_event, filters: CardFilters) => {
    return collectionQueries.getCollection(getDb(), filters);
  });

  ipcMain.handle('collection:quantities', (_event, cardIds: string[]) => {
    return collectionQueries.getCollectionQuantities(getDb(), cardIds);
  });

  ipcMain.handle('collection:add', (_event, cardId: string, quantity?: number) => {
    return collectionQueries.addToCollection(getDb(), cardId, quantity);
  });

  ipcMain.handle('collection:update', (_event, cardId: string, quantity: number) => {
    return collectionQueries.updateCollectionQuantity(getDb(), cardId, quantity);
  });

  ipcMain.handle('collection:remove', (_event, cardId: string) => {
    return collectionQueries.removeFromCollection(getDb(), cardId);
  });

  ipcMain.handle('collection:stats', () => {
    return collectionQueries.getCollectionStats(getDb());
  });

  ipcMain.handle('wants:list', () => {
    return wantsQueries.getWants(getDb());
  });

  // Playgroup sheet sync
  ipcMain.handle('sheet:getSettings', () => {
    return settingsQueries.getSheetSyncSettings(getDb());
  });

  ipcMain.handle('sheet:updateSettings', (_event, updates: Partial<SheetSyncSettings>) => {
    const db = getDb();
    if (updates.playerName !== undefined) {
      settingsQueries.setSetting(db, 'sheetSync.playerName', updates.playerName);
    }
    if (updates.spreadsheetId !== undefined) {
      // Accept a pasted sheet URL as readily as a bare id.
      settingsQueries.setSetting(
        db,
        'sheetSync.spreadsheetId',
        parseSpreadsheetId(updates.spreadsheetId),
      );
    }
    if (updates.serviceAccountKeyPath !== undefined) {
      settingsQueries.setSetting(
        db, 'sheetSync.serviceAccountKeyPath', updates.serviceAccountKeyPath
      );
    }
    return settingsQueries.getSheetSyncSettings(db);
  });

  ipcMain.handle('sheet:pickKey', async (event) => {
    const db = getDb();
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return settingsQueries.getSheetSyncSettings(db);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Select Google service-account key',
      filters: [{ name: 'Service account key', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!canceled && filePaths[0]) {
      const localKeyPath = copyServiceAccountKey(filePaths[0], app.getPath('userData'));
      settingsQueries.setSetting(db, 'sheetSync.serviceAccountKeyPath', localKeyPath);
    }
    return settingsQueries.getSheetSyncSettings(db);
  });

  ipcMain.handle('drive:getSettings', () => {
    return settingsQueries.getDriveSyncSettings(getDb());
  });

  ipcMain.handle('drive:updateSettings', (_event, updates: { backupFileId?: string }) => {
    const db = getDb();
    if (updates.backupFileId !== undefined) {
      settingsQueries.setSetting(
        db,
        'driveSync.backupFileId',
        parseDriveFileId(updates.backupFileId),
      );
    }
    return settingsQueries.getDriveSyncSettings(db);
  });

  ipcMain.handle('drive:pushBackup', async (_event, filterSetsByUuid: Record<string, string[]> = {}) => {
    try {
      return await pushBackupToDrive(getDb(), filterSetsByUuid);
    } catch (err) {
      return {
        pushed: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('drive:pullBackup', async () => {
    try {
      return await pullBackupFromDrive(getDb());
    } catch (err) {
      return {
        decksImported: 0,
        decksUpdated: 0,
        collectionCards: 0,
        tagsImported: 0,
        missing: [],
        filterSets: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('sheet:pull', async () => {
    try {
      return await pullFromSheet(getDb());
    } catch (err) {
      return {
        imported: 0,
        players: [],
        blockLabels: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('sheet:externalDecks', () => {
    return externalDeckQueries.getExternalDecks(getDb());
  });

  ipcMain.handle('sheet:blockLabels', () => {
    return getSheetBlocks(getDb()).map((b) => b.label);
  });

  ipcMain.handle('sheet:blockMappings', () => {
    return getSheetBlockMappings(getDb());
  });

  ipcMain.handle('sheet:setBlockCodes', (_event, label: string, setCodes: string[]) => {
    return setSheetBlockCodes(getDb(), label, setCodes);
  });

  ipcMain.handle('sheet:resetBlockCodes', (_event, label: string) => {
    return resetSheetBlockCodes(getDb(), label);
  });

  ipcMain.handle('sheet:planPush', async () => {
    try {
      return await planPush(getDb());
    } catch (err) {
      return {
        playerName: '',
        spreadsheetId: '',
        updates: [],
        appends: [],
        clears: [],
        matched: [],
        unmapped: [],
        duplicates: [],
        warnings: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  ipcMain.handle('sheet:executePush', async (_event, plan: SheetPushPlan) => {
    try {
      return await executePush(getDb(), plan);
    } catch (err) {
      return { written: 0, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('sheet:assignBlock', (_event, label: string, setCodes: string[]) => {
    return assignBlockMapping(getDb(), label, setCodes);
  });
}
