import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  addToCollection,
  getCollection,
  getCollectionQuantities,
  updateCollectionQuantity,
  removeFromCollection,
  getCollectionStats,
} from '../collection';
import { createTestDb, insertTestCard } from './helpers';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('addToCollection', () => {
  it('creates a collection entry with quantity 1 by default', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId);
    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId) as { quantity: number };
    expect(row.quantity).toBe(1);
  });

  it('creates a collection entry with a specified quantity', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId, 3);
    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId) as { quantity: number };
    expect(row.quantity).toBe(3);
  });

  it('increments quantity when card is already in collection', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId, 2);
    addToCollection(db, cardId, 2);
    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId) as { quantity: number };
    expect(row.quantity).toBe(4);
  });
});

describe('getCollection', () => {
  it('returns collection cards with joined card data', () => {
    const cardId = insertTestCard(db, { name: 'My Dragon' });
    addToCollection(db, cardId);
    const result = getCollection(db, {});
    expect(result.total).toBe(1);
    expect(result.cards[0].card.name).toBe('My Dragon');
    expect(result.cards[0].quantity).toBe(1);
  });

  it('returns empty when collection is empty', () => {
    const result = getCollection(db, {});
    expect(result.total).toBe(0);
    expect(result.cards).toHaveLength(0);
  });

  it('filters by name query', () => {
    const c1 = insertTestCard(db, { name: 'Lightning Bolt' });
    const c2 = insertTestCard(db, { name: 'Counterspell' });
    addToCollection(db, c1);
    addToCollection(db, c2);
    const result = getCollection(db, { query: 'Lightning' });
    expect(result.total).toBe(1);
    expect(result.cards[0].card.name).toBe('Lightning Bolt');
  });

  it('filters by rarity', () => {
    const c1 = insertTestCard(db, { rarity: 'rare' });
    const c2 = insertTestCard(db, { rarity: 'common' });
    addToCollection(db, c1);
    addToCollection(db, c2);
    const result = getCollection(db, { rarity: ['rare'] });
    expect(result.total).toBe(1);
    expect(result.cards[0].card.rarity).toBe('rare');
  });

  it('paginates results', () => {
    const ids = [
      insertTestCard(db, { name: 'Alpha' }),
      insertTestCard(db, { name: 'Beta' }),
      insertTestCard(db, { name: 'Gamma' }),
    ];
    for (const id of ids) addToCollection(db, id);

    const page1 = getCollection(db, { pageSize: 2, page: 1 });
    const page2 = getCollection(db, { pageSize: 2, page: 2 });
    expect(page1.total).toBe(3);
    expect(page1.cards).toHaveLength(2);
    expect(page2.cards).toHaveLength(1);
  });
});

describe('getCollectionQuantities', () => {
  it('returns a map of card_id to quantity', () => {
    const c1 = insertTestCard(db);
    const c2 = insertTestCard(db);
    addToCollection(db, c1, 3);
    addToCollection(db, c2, 5);
    const result = getCollectionQuantities(db, [c1, c2]);
    expect(result[c1]).toBe(3);
    expect(result[c2]).toBe(5);
  });

  it('returns empty object for empty input', () => {
    const result = getCollectionQuantities(db, []);
    expect(result).toEqual({});
  });

  it('omits cards not in collection', () => {
    const c1 = insertTestCard(db);
    const c2 = insertTestCard(db);
    addToCollection(db, c1, 2);
    const result = getCollectionQuantities(db, [c1, c2]);
    expect(result[c1]).toBe(2);
    expect(result[c2]).toBeUndefined();
  });
});

describe('updateCollectionQuantity', () => {
  it('updates the quantity of an existing entry', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId, 3);
    updateCollectionQuantity(db, cardId, 7);
    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId) as { quantity: number };
    expect(row.quantity).toBe(7);
  });

  it('removes the entry when quantity is set to 0', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId);
    updateCollectionQuantity(db, cardId, 0);
    const row = db.prepare('SELECT * FROM collection WHERE card_id = ?').get(cardId);
    expect(row).toBeUndefined();
  });

  it('removes the entry when quantity is negative', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId);
    updateCollectionQuantity(db, cardId, -5);
    const row = db.prepare('SELECT * FROM collection WHERE card_id = ?').get(cardId);
    expect(row).toBeUndefined();
  });
});

describe('removeFromCollection', () => {
  it('removes the card from the collection', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId);
    removeFromCollection(db, cardId);
    const row = db.prepare('SELECT * FROM collection WHERE card_id = ?').get(cardId);
    expect(row).toBeUndefined();
  });

  it('does not throw when card is not in collection', () => {
    const cardId = insertTestCard(db);
    expect(() => removeFromCollection(db, cardId)).not.toThrow();
  });
});

describe('getCollectionStats', () => {
  it('returns zero stats for an empty collection', () => {
    const stats = getCollectionStats(db);
    expect(stats.uniqueCards).toBe(0);
    expect(stats.totalCopies).toBe(0);
    expect(stats.estimatedValue).toBeNull();
  });

  it('counts unique cards and total copies correctly', () => {
    const c1 = insertTestCard(db);
    const c2 = insertTestCard(db);
    addToCollection(db, c1, 4);
    addToCollection(db, c2, 2);
    const stats = getCollectionStats(db);
    expect(stats.uniqueCards).toBe(2);
    expect(stats.totalCopies).toBe(6);
  });

  it('calculates estimated value from price_usd', () => {
    const c1 = insertTestCard(db, { price_usd: '2.50' });
    addToCollection(db, c1, 3); // 3 * 2.50 = 7.50
    const stats = getCollectionStats(db);
    expect(stats.estimatedValue).toBeCloseTo(7.5);
  });

  it('returns null for estimatedValue when all prices are null', () => {
    const c1 = insertTestCard(db, { price_usd: null });
    addToCollection(db, c1, 1);
    const stats = getCollectionStats(db);
    expect(stats.estimatedValue).toBeNull();
  });
});
