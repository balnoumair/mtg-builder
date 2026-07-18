import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { exportBackup, importBackup, BACKUP_KIND, BACKUP_VERSION } from '../backup';
import { createTestDb, insertTestCard } from '../queries/__tests__/helpers';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

function createDeck(name: string, overrides: Partial<{ format: string; description: string; owned: number; cover_card_id: string }> = {}): number {
  return db.prepare(
    'INSERT INTO decks (name, format, description, owned, cover_card_id) VALUES (?, ?, ?, ?, ?)'
  ).run(
    name,
    overrides.format ?? '',
    overrides.description ?? '',
    overrides.owned ?? 0,
    overrides.cover_card_id ?? null,
  ).lastInsertRowid as number;
}

function addDeckCard(
  deckId: number,
  cardId: string,
  overrides: Partial<{ quantity: number; owned_quantity: number | null; ignore_copy_limit: number; board: string }> = {},
): void {
  db.prepare(
    'INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, ignore_copy_limit, board) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    deckId,
    cardId,
    overrides.quantity ?? 1,
    overrides.owned_quantity ?? null,
    overrides.ignore_copy_limit ?? 0,
    overrides.board ?? 'main',
  );
}

function addToCollection(cardId: string, quantity: number): void {
  db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run(cardId, quantity);
}

function emptyBackup(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exported_at: '',
    decks: [],
    collection: [],
    ...overrides,
  };
}

describe('exportBackup', () => {
  it('exports decks with confirmed/unconfirmed counts, notes, and the collection', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'bbb' });
    const deckId = createDeck('My Deck', { format: 'modern', description: 'notes here', owned: 1, cover_card_id: 'p-1' });
    addDeckCard(deckId, 'p-1', { quantity: 4, owned_quantity: 2, board: 'main' });
    addToCollection('p-2', 3);

    const backup = exportBackup(db);

    expect(backup.kind).toBe(BACKUP_KIND);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.decks).toHaveLength(1);
    const deck = backup.decks[0];
    expect(deck).toMatchObject({ name: 'My Deck', format: 'modern', description: 'notes here', owned: 1 });
    expect(deck.cover).toEqual({ oracle_id: 'o-1', set_code: 'aaa' });
    expect(deck.cards).toEqual([
      { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', board: 'main', quantity: 4, owned_quantity: 2, ignore_copy_limit: 0 },
    ]);
    expect(backup.collection).toHaveLength(1);
    expect(backup.collection[0]).toMatchObject({ name: 'Beta', oracle_id: 'o-2', set_code: 'bbb', quantity: 3 });
  });
});

describe('importBackup', () => {
  it('round-trips decks and collection', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'bbb' });
    const deckId = createDeck('My Deck', { format: 'modern', description: 'notes', owned: 1, cover_card_id: 'p-1' });
    addDeckCard(deckId, 'p-1', { quantity: 4, owned_quantity: 2 });
    addToCollection('p-2', 3);

    const summary = importBackup(db, exportBackup(db));

    expect(summary).toEqual({ decksImported: 1, collectionCards: 1, missing: [] });
    const decks = db.prepare('SELECT id, name, format, description, owned, cover_card_id FROM decks ORDER BY id').all() as Array<Record<string, unknown>>;
    expect(decks).toHaveLength(2);
    expect(decks[1]).toMatchObject({ name: 'My Deck', format: 'modern', description: 'notes', owned: 1, cover_card_id: 'p-1' });
    const cards = db.prepare('SELECT card_id, quantity, owned_quantity, board FROM deck_cards WHERE deck_id = ?').all(decks[1].id);
    expect(cards).toEqual([{ card_id: 'p-1', quantity: 4, owned_quantity: 2, board: 'main' }]);
    expect(db.prepare('SELECT card_id, quantity FROM collection').all()).toEqual([{ card_id: 'p-2', quantity: 3 }]);
  });

  it('merges collection counts by keeping the larger quantity, so re-import is idempotent', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'aaa' });
    addToCollection('p-1', 5);

    const backup = emptyBackup({
      collection: [
        { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', quantity: 2, added_at: null },
        { name: 'Beta', oracle_id: 'o-2', set_code: 'aaa', quantity: 4, added_at: null },
      ],
    });
    importBackup(db, backup);
    importBackup(db, backup);

    const rows = db.prepare('SELECT card_id, quantity FROM collection ORDER BY card_id').all();
    expect(rows).toEqual([
      { card_id: 'p-1', quantity: 5 },
      { card_id: 'p-2', quantity: 4 },
    ]);
  });

  it('prefers the recorded set, then falls back to the kept print', () => {
    insertTestCard(db, { id: 'newer', oracle_id: 'o-1', name: 'Alpha', set_code: 'bbb', released_at: '2023-01-01' });
    insertTestCard(db, { id: 'recorded-set', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa', released_at: '2020-01-01' });
    insertTestCard(db, { id: 'other', oracle_id: 'o-2', name: 'Beta', set_code: 'ccc', released_at: '2021-01-01' });

    const summary = importBackup(db, emptyBackup({
      decks: [{
        name: 'Restored',
        format: '',
        description: '',
        owned: 0,
        cover: null,
        cards: [
          { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', board: 'main', quantity: 1, owned_quantity: null, ignore_copy_limit: 0 },
          { name: 'Beta', oracle_id: 'o-2', set_code: 'gone', board: 'main', quantity: 2, owned_quantity: null, ignore_copy_limit: 0 },
        ],
      }],
    }));

    expect(summary.missing).toEqual([]);
    const cards = db.prepare('SELECT card_id, quantity FROM deck_cards ORDER BY card_id').all();
    expect(cards).toEqual([
      { card_id: 'other', quantity: 2 },
      { card_id: 'recorded-set', quantity: 1 },
    ]);
  });

  it('reports cards missing from the database instead of failing', () => {
    const summary = importBackup(db, emptyBackup({
      decks: [{
        name: 'Sparse',
        format: '',
        description: '',
        owned: 0,
        cover: null,
        cards: [
          { name: 'Unknown Card', oracle_id: 'o-x', set_code: 'zzz', board: 'main', quantity: 3, owned_quantity: null, ignore_copy_limit: 0 },
        ],
      }],
      collection: [
        { name: 'Unknown Single', oracle_id: 'o-y', set_code: 'zzz', quantity: 1, added_at: null },
      ],
    }));

    expect(summary.decksImported).toBe(1);
    expect(summary.collectionCards).toBe(0);
    expect(summary.missing).toEqual([
      { deck: 'Sparse', card: 'Unknown Card', quantity: 3 },
      { deck: null, card: 'Unknown Single', quantity: 1 },
    ]);
    expect(db.prepare('SELECT COUNT(*) n FROM deck_cards').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT COUNT(*) n FROM collection').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT name FROM decks').all()).toEqual([{ name: 'Sparse' }]);
  });

  it('merges deck entries whose prints resolve to the same card', () => {
    insertTestCard(db, { id: 'only-print', oracle_id: 'o-1', name: 'Alpha', set_code: 'bbb' });

    const summary = importBackup(db, emptyBackup({
      decks: [{
        name: 'Merged',
        format: '',
        description: '',
        owned: 0,
        cover: null,
        cards: [
          { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', board: 'main', quantity: 2, owned_quantity: null, ignore_copy_limit: 0 },
          { name: 'Alpha', oracle_id: 'o-1', set_code: 'ccc', board: 'main', quantity: 3, owned_quantity: null, ignore_copy_limit: 0 },
        ],
      }],
    }));

    expect(summary.missing).toEqual([]);
    const cards = db.prepare('SELECT card_id, quantity FROM deck_cards').all();
    expect(cards).toEqual([{ card_id: 'only-print', quantity: 5 }]);
  });

  it('rejects files that are not backups', () => {
    expect(() => importBackup(db, { some: 'json' })).toThrow('Not a backup file');
    expect(() => importBackup(db, emptyBackup({ version: 99 }))).toThrow('Unsupported backup version');
    expect(() => importBackup(db, emptyBackup({ collection: undefined }))).toThrow('malformed');
    expect(() => importBackup(db, emptyBackup({
      decks: [{ name: 'Bad', cards: [{ name: 'X' }] }],
    }))).toThrow('invalid card entries');
    expect(db.prepare('SELECT COUNT(*) n FROM decks').get()).toEqual({ n: 0 });
  });
});
