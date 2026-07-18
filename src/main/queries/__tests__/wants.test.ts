import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { getWants } from '../wants';
import { createTestDb, insertTestCard } from './helpers';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

function insertDeck(name: string, owned = 0): number {
  const result = db.prepare('INSERT INTO decks (name, owned) VALUES (?, ?)').run(name, owned);
  return Number(result.lastInsertRowid);
}

function insertDeckCard(
  deckId: number,
  cardId: string,
  quantity: number,
  opts: { owned_quantity?: number | null; board?: string } = {},
): void {
  db.prepare(`
    INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, board)
    VALUES (?, ?, ?, ?, ?)
  `).run(deckId, cardId, quantity, opts.owned_quantity ?? null, opts.board ?? 'main');
}

function addToCollection(cardId: string, quantity: number): void {
  db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, quantity);
}

describe('getWants', () => {
  it('wants every copy from a wishlist deck', () => {
    const cardId = insertTestCard(db, { name: 'Wanted Creature' });
    const deckId = insertDeck('Wishlist Deck');
    insertDeckCard(deckId, cardId, 4);

    const wants = getWants(db);
    expect(wants).toHaveLength(1);
    expect(wants[0].name).toBe('Wanted Creature');
    expect(wants[0].needed).toBe(4);
    expect(wants[0].to_buy).toBe(4);
  });

  it('wants only the unconfirmed delta from an owned deck', () => {
    const cardId = insertTestCard(db, { name: 'Upgraded Creature' });
    const deckId = insertDeck('Owned Deck', 1);
    insertDeckCard(deckId, cardId, 4, { owned_quantity: 1 });

    const wants = getWants(db);
    expect(wants).toHaveLength(1);
    expect(wants[0].to_buy).toBe(3);
    expect(wants[0].sources[0].pending).toBe(true);
  });

  it('ignores confirmed cards and pending removals in owned decks', () => {
    const confirmed = insertTestCard(db, { name: 'Confirmed Creature' });
    const removed = insertTestCard(db, { name: 'Removed Creature' });
    const deckId = insertDeck('Owned Deck', 1);
    insertDeckCard(deckId, confirmed, 4, { owned_quantity: 4 });
    insertDeckCard(deckId, removed, 0, { owned_quantity: 2 });

    expect(getWants(db)).toHaveLength(0);
  });

  it('subtracts collection copies of any printing of the same name', () => {
    const wantedPrint = insertTestCard(db, { name: 'Reprinted Creature', set_code: 'aaa' });
    const ownedPrint = insertTestCard(db, { name: 'Reprinted Creature', set_code: 'bbb' });
    const deckId = insertDeck('Wishlist Deck');
    insertDeckCard(deckId, wantedPrint, 4);
    addToCollection(ownedPrint, 3);

    const wants = getWants(db);
    expect(wants).toHaveLength(1);
    expect(wants[0].needed).toBe(4);
    expect(wants[0].owned).toBe(3);
    expect(wants[0].to_buy).toBe(1);
  });

  it('omits cards fully covered by the collection', () => {
    const cardId = insertTestCard(db, { name: 'Covered Creature' });
    const deckId = insertDeck('Wishlist Deck');
    insertDeckCard(deckId, cardId, 2);
    addToCollection(cardId, 2);

    expect(getWants(db)).toHaveLength(0);
  });

  it('aggregates the same name across decks and boards with per-deck sources', () => {
    const cardId = insertTestCard(db, { name: 'Shared Creature' });
    const wishlistId = insertDeck('Wishlist Deck');
    const ownedId = insertDeck('Owned Deck', 1);
    insertDeckCard(wishlistId, cardId, 3, { board: 'main' });
    insertDeckCard(wishlistId, cardId, 1, { board: 'sideboard' });
    insertDeckCard(ownedId, cardId, 2, { owned_quantity: 0 });

    const wants = getWants(db);
    expect(wants).toHaveLength(1);
    expect(wants[0].needed).toBe(6);
    expect(wants[0].to_buy).toBe(6);
    expect(wants[0].sources).toHaveLength(2);

    const wishlistSource = wants[0].sources.find((s) => s.deck_id === wishlistId);
    const ownedSource = wants[0].sources.find((s) => s.deck_id === ownedId);
    expect(wishlistSource).toMatchObject({ pending: false, need: 4 });
    expect(ownedSource).toMatchObject({ pending: true, need: 2 });
  });

  it('returns a card payload with parsed JSON fields', () => {
    const cardId = insertTestCard(db, { name: 'Parsed Creature', colors: ['G'] });
    const deckId = insertDeck('Wishlist Deck');
    insertDeckCard(deckId, cardId, 1);

    const wants = getWants(db);
    expect(wants[0].card.id).toBe(cardId);
    expect(wants[0].card.colors).toEqual(['G']);
  });
});
