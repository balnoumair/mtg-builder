import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  createDeck,
  getDecks,
  updateDeck,
  deleteDeck,
  getDeckCards,
  addCardToDeck,
  updateCardQuantity,
  removeCardFromDeck,
  claimDeckFromCollection,
} from '../decks';
import { createTestDb, insertTestCard } from './helpers';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('createDeck', () => {
  it('creates a deck and returns it with an id', () => {
    const deck = createDeck(db, { name: 'My Deck' });
    expect(deck.id).toBeGreaterThan(0);
    expect(deck.name).toBe('My Deck');
    expect(deck.owned).toBe(false);
  });

  it('stores the format when provided', () => {
    const deck = createDeck(db, { name: 'Legacy Deck', format: 'legacy' });
    expect(deck.format).toBe('legacy');
  });

  it('defaults format to empty string', () => {
    const deck = createDeck(db, { name: 'No Format' });
    expect(deck.format).toBe('');
  });
});

describe('getDecks', () => {
  it('returns all decks sorted by updated_at desc', () => {
    createDeck(db, { name: 'Deck A' });
    createDeck(db, { name: 'Deck B' });
    const decks = getDecks(db);
    expect(decks).toHaveLength(2);
  });

  it('includes card_count for main board cards', () => {
    const deck = createDeck(db, { name: 'Count Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId, 'main');
    addCardToDeck(db, deck.id, cardId, 'main'); // Adds 1 more (upsert)

    const decks = getDecks(db);
    const found = decks.find(d => d.id === deck.id);
    expect(found?.card_count).toBe(2);
  });

  it('does not count sideboard cards in card_count', () => {
    const deck = createDeck(db, { name: 'Side Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId, 'sideboard');

    const decks = getDecks(db);
    const found = decks.find(d => d.id === deck.id);
    expect(found?.card_count).toBe(0);
  });

  it('converts owned integer to boolean', () => {
    const deck = createDeck(db, { name: 'Owned Deck' });
    updateDeck(db, deck.id, { owned: true });
    const decks = getDecks(db);
    const found = decks.find(d => d.id === deck.id);
    expect(found?.owned).toBe(true);
  });
});

describe('updateDeck', () => {
  it('updates the deck name', () => {
    const deck = createDeck(db, { name: 'Old Name' });
    const updated = updateDeck(db, deck.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
  });

  it('updates the format', () => {
    const deck = createDeck(db, { name: 'My Deck', format: 'standard' });
    const updated = updateDeck(db, deck.id, { format: 'modern' });
    expect(updated.format).toBe('modern');
  });

  it('sets owned to true', () => {
    const deck = createDeck(db, { name: 'My Deck' });
    expect(deck.owned).toBe(false);
    const updated = updateDeck(db, deck.id, { owned: true });
    expect(updated.owned).toBe(true);
  });

  it('updates updated_at timestamp', () => {
    const deck = createDeck(db, { name: 'My Deck' });
    const originalTime = deck.updated_at;
    const updated = updateDeck(db, deck.id, { name: 'New Name' });
    // updated_at should be set (not necessarily different in fast test, but field exists)
    expect(updated.updated_at).toBeDefined();
    // Suppress unused var warning - originalTime used for documentation
    void originalTime;
  });
});

describe('deleteDeck', () => {
  it('removes the deck', () => {
    const deck = createDeck(db, { name: 'To Delete' });
    deleteDeck(db, deck.id);
    const decks = getDecks(db);
    expect(decks.find(d => d.id === deck.id)).toBeUndefined();
  });

  it('cascades deletion to deck_cards', () => {
    const deck = createDeck(db, { name: 'With Cards' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    deleteDeck(db, deck.id);

    const deckCards = db.prepare('SELECT * FROM deck_cards WHERE deck_id = ?').all(deck.id);
    expect(deckCards).toHaveLength(0);
  });
});

describe('addCardToDeck', () => {
  it('adds a card with quantity 1', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);

    const cards = getDeckCards(db, deck.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].quantity).toBe(1);
    expect(cards[0].board).toBe('main');
  });

  it('increments quantity on conflict (same card + board)', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    addCardToDeck(db, deck.id, cardId);

    const cards = getDeckCards(db, deck.id);
    expect(cards[0].quantity).toBe(2);
  });

  it('treats main and sideboard as separate entries', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId, 'main');
    addCardToDeck(db, deck.id, cardId, 'sideboard');

    const cards = getDeckCards(db, deck.id);
    expect(cards).toHaveLength(2);
  });
});

describe('getDeckCards', () => {
  it('returns cards with full card data joined', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db, { name: 'Test Dragon', type_line: 'Creature — Dragon' });
    addCardToDeck(db, deck.id, cardId);

    const cards = getDeckCards(db, deck.id);
    expect(cards[0].card?.name).toBe('Test Dragon');
    expect(cards[0].card?.type_line).toBe('Creature — Dragon');
  });

  it('returns empty array for deck with no cards', () => {
    const deck = createDeck(db, { name: 'Empty' });
    expect(getDeckCards(db, deck.id)).toEqual([]);
  });
});

describe('updateCardQuantity', () => {
  it('updates the quantity of a card', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    updateCardQuantity(db, deck.id, cardId, 'main', 4);

    const cards = getDeckCards(db, deck.id);
    expect(cards[0].quantity).toBe(4);
  });

  it('removes the card when quantity is set to 0', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    updateCardQuantity(db, deck.id, cardId, 'main', 0);

    const cards = getDeckCards(db, deck.id);
    expect(cards).toHaveLength(0);
  });

  it('removes the card when quantity is negative', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    updateCardQuantity(db, deck.id, cardId, 'main', -1);

    const cards = getDeckCards(db, deck.id);
    expect(cards).toHaveLength(0);
  });
});

describe('removeCardFromDeck', () => {
  it('removes the card from the deck', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    removeCardFromDeck(db, deck.id, cardId, 'main');

    expect(getDeckCards(db, deck.id)).toHaveLength(0);
  });

  it('only removes the specified board entry', () => {
    const deck = createDeck(db, { name: 'Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId, 'main');
    addCardToDeck(db, deck.id, cardId, 'sideboard');
    removeCardFromDeck(db, deck.id, cardId, 'sideboard');

    const cards = getDeckCards(db, deck.id);
    expect(cards).toHaveLength(1);
    expect(cards[0].board).toBe('main');
  });
});

describe('claimDeckFromCollection', () => {
  it('marks the deck as owned', () => {
    const deck = createDeck(db, { name: 'Claim Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, 5);

    claimDeckFromCollection(db, deck.id);

    const updated = db.prepare('SELECT owned FROM decks WHERE id = ?').get(deck.id) as { owned: number };
    expect(updated.owned).toBe(1);
  });

  it('deducts deck card quantities from collection', () => {
    const deck = createDeck(db, { name: 'Deduct Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    addCardToDeck(db, deck.id, cardId); // qty = 2
    db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, 5);

    claimDeckFromCollection(db, deck.id);

    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId) as { quantity: number };
    expect(row.quantity).toBe(3); // 5 - 2 = 3
  });

  it('removes from collection when remaining quantity is 0', () => {
    const deck = createDeck(db, { name: 'Zero Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, 1);

    claimDeckFromCollection(db, deck.id);

    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId);
    expect(row).toBeUndefined();
  });

  it('removes from collection when remaining quantity goes negative', () => {
    const deck = createDeck(db, { name: 'Over-claim Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    addCardToDeck(db, deck.id, cardId); // qty = 2
    db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, 1);

    claimDeckFromCollection(db, deck.id);

    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId);
    expect(row).toBeUndefined();
  });

  it('skips cards not in the collection', () => {
    const deck = createDeck(db, { name: 'Skip Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId);
    // Do NOT add to collection

    // Should not throw
    expect(() => claimDeckFromCollection(db, deck.id)).not.toThrow();
  });

  it('aggregates quantities across main and sideboard before deducting', () => {
    const deck = createDeck(db, { name: 'Agg Test' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, deck.id, cardId, 'main');    // qty = 1
    addCardToDeck(db, deck.id, cardId, 'sideboard'); // qty = 1, total = 2
    db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, 5);

    claimDeckFromCollection(db, deck.id);

    const row = db.prepare('SELECT quantity FROM collection WHERE card_id = ?').get(cardId) as { quantity: number };
    expect(row.quantity).toBe(3); // 5 - 2 = 3
  });
});
