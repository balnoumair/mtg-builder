import { ipcMain, dialog, BrowserWindow } from 'electron';
import { getDb } from './database';
import { importCards } from './import';
import * as cardQueries from './queries/cards';
import * as deckQueries from './queries/decks';
import type { CardFilters, Deck } from '../shared/types';

export function registerIpcHandlers(): void {
  ipcMain.handle('db:status', () => {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM cards').get() as { count: number };
    return { ready: row.count > 0, cardCount: row.count };
  });

  ipcMain.handle('dialog:selectFile', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('import:cards', async (event, filePath: string) => {
    const db = getDb();
    const win = BrowserWindow.fromWebContents(event.sender);
    await importCards(db, filePath, (current, total) => {
      win?.webContents.send('import:progress', { current, total, phase: 'reading' });
    });
    win?.webContents.send('import:progress', { current: 0, total: 0, phase: 'done' });
  });

  ipcMain.handle('cards:search', (_event, filters: CardFilters) => {
    return cardQueries.searchCards(getDb(), filters);
  });

  ipcMain.handle('cards:get', (_event, id: string) => {
    return cardQueries.getCard(getDb(), id);
  });

  ipcMain.handle('cards:printings', (_event, oracleId: string) => {
    return cardQueries.getCardPrintings(getDb(), oracleId);
  });

  ipcMain.handle('cards:sets', () => {
    return cardQueries.getSets(getDb());
  });

  ipcMain.handle('decks:list', () => {
    return deckQueries.getDecks(getDb());
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

  ipcMain.handle('decks:addCard', (_event, deckId: number, cardId: string, board?: string) => {
    return deckQueries.addCardToDeck(getDb(), deckId, cardId, board);
  });

  ipcMain.handle('decks:updateQuantity', (_event, deckId: number, cardId: string, board: string, quantity: number) => {
    return deckQueries.updateCardQuantity(getDb(), deckId, cardId, board, quantity);
  });

  ipcMain.handle('decks:removeCard', (_event, deckId: number, cardId: string, board: string) => {
    return deckQueries.removeCardFromDeck(getDb(), deckId, cardId, board);
  });
}
