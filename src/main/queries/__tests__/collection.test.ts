import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  addToCollection,
  getCollection,
  getCollectionQuantities,
  getInDeckQuantities,
  updateCollectionQuantity,
  removeFromCollection,
  getCollectionStats,
} from '../collection';
import { addCardToDeck, claimDeckFromCollection, createDeck } from '../decks';
import { createTestDb, insertTestCard } from './helpers';
import { BASIC_LAND_NAMES } from '../../../shared/basicLands';

const basicLandName = [...BASIC_LAND_NAMES][0];

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

  it('filters by type line with a t: query prefix', () => {
    const c1 = insertTestCard(db, { name: 'Typed Card', type_line: 'Creature — Alpha' });
    const c2 = insertTestCard(db, { name: 'Texted Card', oracle_text: 'Alpha creatures.' });
    addToCollection(db, c1);
    addToCollection(db, c2);

    const typed = getCollection(db, { query: 't:alpha' });
    expect(typed.cards.map((c) => c.card.name)).toEqual(['Typed Card']);

    const bare = getCollection(db, { query: 'alpha' });
    expect(bare.cards.map((c) => c.card.name)).toEqual(['Texted Card', 'Typed Card']);
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

  it('filters by multiple mana values', () => {
    const one = insertTestCard(db, { name: 'One', cmc: 1 });
    const three = insertTestCard(db, { name: 'Three', cmc: 3 });
    const five = insertTestCard(db, { name: 'Five', cmc: 5 });
    addToCollection(db, one);
    addToCollection(db, three);
    addToCollection(db, five);

    const result = getCollection(db, { manaValues: [1, 5] });
    expect(result.cards.map((entry) => entry.card.name)).toEqual(['Five', 'One']);
  });

  it('filters by multicolor and colorless categories', () => {
    const multicolor = insertTestCard(db, { name: 'Gold', color_identity: ['R', 'U'] });
    const colorless = insertTestCard(db, { name: 'Silver', color_identity: [] });
    const red = insertTestCard(db, { name: 'Red', color_identity: ['R'] });
    addToCollection(db, multicolor);
    addToCollection(db, colorless);
    addToCollection(db, red);

    const result = getCollection(db, { colorCategories: ['multicolor', 'colorless'] });
    expect(result.cards.map((entry) => entry.card.name)).toEqual(['Gold', 'Silver']);
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

  it('reports loose copies and copies held in owned decks separately', () => {
    const cardId = insertTestCard(db, { name: 'Split Card' });
    addToCollection(db, cardId, 5);
    const deck = createDeck(db, { name: 'Owned' });
    addCardToDeck(db, deck.id, cardId, 'main', 3);
    claimDeckFromCollection(db, deck.id);

    const result = getCollection(db, {});
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0].quantity).toBe(2);
    expect(result.cards[0].in_decks).toBe(3);
  });

  it('lists cards held only in owned decks with zero loose copies', () => {
    const cardId = insertTestCard(db, { name: 'Deck Only' });
    const deck = createDeck(db, { name: 'Owned' });
    addCardToDeck(db, deck.id, cardId, 'main', 2);
    claimDeckFromCollection(db, deck.id);

    const result = getCollection(db, {});
    expect(result.total).toBe(1);
    expect(result.cards[0].card.name).toBe('Deck Only');
    expect(result.cards[0].quantity).toBe(0);
    expect(result.cards[0].in_decks).toBe(2);
    expect(result.cards[0].added_at).toBeNull();
  });

  it('ignores unowned decks and unconfirmed additions to owned decks', () => {
    const planned = insertTestCard(db, { name: 'Planned' });
    const pending = insertTestCard(db, { name: 'Pending' });
    const unowned = createDeck(db, { name: 'Unowned' });
    addCardToDeck(db, unowned.id, planned, 'main', 4);
    const owned = createDeck(db, { name: 'Owned' });
    claimDeckFromCollection(db, owned.id);
    addCardToDeck(db, owned.id, pending, 'main', 1);

    expect(getCollection(db, {}).total).toBe(0);
  });

  it('leaves out basic lands held only in decks but keeps loose basics', () => {
    const deckBasic = insertTestCard(db, { name: basicLandName });
    const looseBasic = insertTestCard(db, { name: basicLandName });
    addToCollection(db, looseBasic, 1);
    const deck = createDeck(db, { name: 'Owned' });
    addCardToDeck(db, deck.id, deckBasic, 'main', 17);
    claimDeckFromCollection(db, deck.id);

    const result = getCollection(db, {});
    expect(result.cards.map((cc) => cc.card_id)).toEqual([looseBasic]);
    expect(result.cards[0].in_decks).toBe(0);
    expect(getCollectionStats(db).inDeckCopies).toBe(0);
  });
});

describe('getInDeckQuantities', () => {
  it('sums copies across owned decks, skipping unowned decks and basic lands', () => {
    const shared = insertTestCard(db);
    const planned = insertTestCard(db);
    const basic = insertTestCard(db, { name: basicLandName });
    const first = createDeck(db, { name: 'First' });
    const second = createDeck(db, { name: 'Second' });
    addCardToDeck(db, first.id, shared, 'main', 2);
    addCardToDeck(db, first.id, basic, 'main', 10);
    addCardToDeck(db, second.id, shared, 'sideboard', 1);
    claimDeckFromCollection(db, first.id);
    claimDeckFromCollection(db, second.id);
    const unowned = createDeck(db, { name: 'Unowned' });
    addCardToDeck(db, unowned.id, planned, 'main', 4);

    expect(getInDeckQuantities(db, [shared, planned, basic])).toEqual({ [shared]: 3 });
  });

  it('returns an empty map for no ids', () => {
    expect(getInDeckQuantities(db, [])).toEqual({});
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
  it('removes all copies of the card from the collection', () => {
    const cardId = insertTestCard(db);
    addToCollection(db, cardId, 4);
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
    expect(stats.inDeckCopies).toBe(0);
  });

  it('counts copies in owned decks apart from loose copies', () => {
    const shared = insertTestCard(db);
    const deckOnly = insertTestCard(db);
    addToCollection(db, shared, 4);
    const deck = createDeck(db, { name: 'Owned' });
    addCardToDeck(db, deck.id, shared, 'main', 1);
    addCardToDeck(db, deck.id, deckOnly, 'sideboard', 2);
    claimDeckFromCollection(db, deck.id);

    const stats = getCollectionStats(db);
    expect(stats.uniqueCards).toBe(2);
    expect(stats.totalCopies).toBe(3);
    expect(stats.inDeckCopies).toBe(3);
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
});
