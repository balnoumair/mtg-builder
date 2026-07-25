import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { exportBackup, importBackup, BACKUP_KIND, BACKUP_VERSION } from '../backup';
import { createTestDb, insertTestCard } from '../queries/__tests__/helpers';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

function createDeck(
  name: string,
  overrides: Partial<{ uuid: string; format: string; description: string; owned: number; cover_card_id: string }> = {},
): number {
  return db.prepare(
    'INSERT INTO decks (uuid, name, format, description, owned, cover_card_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    overrides.uuid ?? randomUUID(),
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
  it('exports decks with uuid, confirmed/unconfirmed counts, notes, and the collection', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'bbb' });
    const uuid = randomUUID();
    const deckId = createDeck('My Deck', { uuid, format: 'modern', description: 'notes here', owned: 1, cover_card_id: 'p-1' });
    addDeckCard(deckId, 'p-1', { quantity: 4, owned_quantity: 2, board: 'main' });
    addToCollection('p-2', 3);

    const backup = exportBackup(db, { [uuid]: ['aaa', 'bbb'] });

    expect(backup.kind).toBe(BACKUP_KIND);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.decks).toHaveLength(1);
    const deck = backup.decks[0];
    expect(deck).toMatchObject({
      uuid,
      name: 'My Deck',
      format: 'modern',
      description: 'notes here',
      owned: 1,
      filter_sets: ['aaa', 'bbb'],
    });
    expect(deck.cover).toEqual({ oracle_id: 'o-1', set_code: 'aaa' });
    expect(deck.cards).toEqual([
      { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', board: 'main', quantity: 4, owned_quantity: 2, ignore_copy_limit: 0 },
    ]);
    expect(backup.collection).toHaveLength(1);
    expect(backup.collection[0]).toMatchObject({ name: 'Beta', oracle_id: 'o-2', set_code: 'bbb', quantity: 3 });
  });

  it('omits filter_sets when empty or absent', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    const uuid = randomUUID();
    createDeck('Bare', { uuid });
    const backup = exportBackup(db, { [uuid]: [] });
    expect(backup.decks[0].filter_sets).toBeUndefined();
    expect('filter_sets' in backup.decks[0]).toBe(false);
  });
});

describe('importBackup', () => {
  it('round-trips a deck onto a fresh database and preserves its uuid', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'bbb' });
    const uuid = randomUUID();
    const deckId = createDeck('My Deck', { uuid, format: 'modern', description: 'notes', owned: 1, cover_card_id: 'p-1' });
    addDeckCard(deckId, 'p-1', { quantity: 4, owned_quantity: 2 });
    addToCollection('p-2', 3);

    const backup = exportBackup(db, { [uuid]: ['aaa'] });
    db.prepare('DELETE FROM deck_cards').run();
    db.prepare('DELETE FROM decks').run();
    db.prepare('DELETE FROM collection').run();

    const summary = importBackup(db, backup);

    expect(summary).toEqual({
      decksImported: 1,
      decksUpdated: 0,
      collectionCards: 1,
      tagsImported: 0,
      missing: [],
      filterSets: [{ uuid, sets: ['aaa'] }],
    });
    const decks = db.prepare('SELECT uuid, name, format, description, owned, cover_card_id FROM decks').all() as Array<Record<string, unknown>>;
    expect(decks).toEqual([{ uuid, name: 'My Deck', format: 'modern', description: 'notes', owned: 1, cover_card_id: 'p-1' }]);
    const cards = db.prepare('SELECT card_id, quantity, owned_quantity, board FROM deck_cards').all();
    expect(cards).toEqual([{ card_id: 'p-1', quantity: 4, owned_quantity: 2, board: 'main' }]);
    expect(db.prepare('SELECT card_id, quantity FROM collection').all()).toEqual([{ card_id: 'p-2', quantity: 3 }]);
  });

  it('replaces an existing deck with the backup copy when uuids match', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'bbb' });
    const uuid = randomUUID();
    const deckId = createDeck('Old Name', { uuid, format: 'modern', description: 'old', owned: 0, cover_card_id: 'p-1' });
    addDeckCard(deckId, 'p-1', { quantity: 4, owned_quantity: 2 });

    const summary = importBackup(db, emptyBackup({
      decks: [{
        uuid,
        name: 'Backup Name',
        format: 'standard',
        description: 'from backup',
        owned: 1,
        cover: { oracle_id: 'o-2', set_code: 'bbb' },
        filter_sets: ['bbb'],
        cards: [
          { name: 'Beta', oracle_id: 'o-2', set_code: 'bbb', board: 'main', quantity: 2, owned_quantity: 1, ignore_copy_limit: 0 },
        ],
      }],
    }));

    expect(summary).toEqual({
      decksImported: 0,
      decksUpdated: 1,
      collectionCards: 0,
      tagsImported: 0,
      missing: [],
      filterSets: [{ uuid, sets: ['bbb'] }],
    });
    expect(db.prepare('SELECT COUNT(*) n FROM decks').get()).toEqual({ n: 1 });
    const deck = db.prepare('SELECT uuid, name, format, description, owned, cover_card_id FROM decks WHERE id = ?').get(deckId);
    expect(deck).toEqual({
      uuid,
      name: 'Backup Name',
      format: 'standard',
      description: 'from backup',
      owned: 1,
      cover_card_id: 'p-2',
    });
    expect(db.prepare('SELECT card_id, quantity, owned_quantity, board FROM deck_cards').all()).toEqual([
      { card_id: 'p-2', quantity: 2, owned_quantity: 1, board: 'main' },
    ]);
  });

  it('returns filter_sets for updated decks so localStorage can be overwritten', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    const uuid = randomUUID();
    createDeck('My Deck', { uuid });

    const summary = importBackup(db, emptyBackup({
      decks: [{
        uuid,
        name: 'My Deck',
        format: '',
        description: '',
        owned: 0,
        cover: null,
        filter_sets: ['mkm', 'dsk'],
        cards: [],
      }],
    }));

    expect(summary.decksUpdated).toBe(1);
    expect(summary.filterSets).toEqual([{ uuid, sets: ['mkm', 'dsk'] }]);
  });

  it('overwrites collection quantities with the backup values', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    insertTestCard(db, { id: 'p-2', oracle_id: 'o-2', name: 'Beta', set_code: 'aaa' });
    addToCollection('p-1', 5);

    const summary = importBackup(db, emptyBackup({
      collection: [
        { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', quantity: 2, added_at: null },
        { name: 'Beta', oracle_id: 'o-2', set_code: 'aaa', quantity: 4, added_at: null },
      ],
    }));

    expect(summary).toEqual({
      decksImported: 0,
      decksUpdated: 0,
      collectionCards: 2,
      tagsImported: 0,
      missing: [],
      filterSets: [],
    });
    expect(db.prepare('SELECT card_id, quantity FROM collection ORDER BY card_id').all()).toEqual([
      { card_id: 'p-1', quantity: 2 },
      { card_id: 'p-2', quantity: 4 },
    ]);
  });

  it('imports legacy decks that have no uuid as new decks', () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    createDeck('Local', { uuid: randomUUID() });

    const summary = importBackup(db, emptyBackup({
      decks: [{
        name: 'Legacy',
        format: '',
        description: '',
        owned: 0,
        cover: null,
        cards: [
          { name: 'Alpha', oracle_id: 'o-1', set_code: 'aaa', board: 'main', quantity: 1, owned_quantity: null, ignore_copy_limit: 0 },
        ],
      }],
    }));

    expect(summary).toMatchObject({ decksImported: 1, decksUpdated: 0 });
    expect(db.prepare('SELECT COUNT(*) n FROM decks').get()).toEqual({ n: 2 });
    const imported = db.prepare("SELECT uuid FROM decks WHERE name = 'Legacy'").get() as { uuid: string };
    expect(imported.uuid).toBeTruthy();
  });

  it('re-importing the same backup is idempotent and keeps backup quantities', () => {
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
      { card_id: 'p-1', quantity: 2 },
      { card_id: 'p-2', quantity: 4 },
    ]);
  });

  it('prefers the recorded set, then falls back to the kept print', () => {
    insertTestCard(db, { id: 'newer', oracle_id: 'o-1', name: 'Alpha', set_code: 'bbb', released_at: '2023-01-01' });
    insertTestCard(db, { id: 'recorded-set', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa', released_at: '2020-01-01' });
    insertTestCard(db, { id: 'other', oracle_id: 'o-2', name: 'Beta', set_code: 'ccc', released_at: '2021-01-01' });

    const summary = importBackup(db, emptyBackup({
      decks: [{
        uuid: randomUUID(),
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
        uuid: randomUUID(),
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
        uuid: randomUUID(),
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
    expect(() => importBackup(db, emptyBackup({
      decks: [{ uuid: '', name: 'Bad', format: '', description: '', owned: 0, cover: null, cards: [] }],
    }))).toThrow('invalid uuid');
    expect(() => importBackup(db, emptyBackup({
      decks: [{
        uuid: randomUUID(),
        name: 'Bad filters',
        format: '',
        description: '',
        owned: 0,
        cover: null,
        filter_sets: [''],
        cards: [],
      }],
    }))).toThrow('invalid filter_sets');
    expect(db.prepare('SELECT COUNT(*) n FROM decks').get()).toEqual({ n: 0 });
  });
});

describe('tags', () => {
  function tagDeck(deckId: number, name: string, color = 'slate'): string {
    const uuid = randomUUID();
    const tagId = db.prepare('INSERT INTO tags (uuid, name, color) VALUES (?, ?, ?)')
      .run(uuid, name, color).lastInsertRowid as number;
    db.prepare('INSERT INTO deck_tags (deck_id, tag_id) VALUES (?, ?)').run(deckId, tagId);
    return uuid;
  }

  function deckTagNames(deckId: number): string[] {
    return (db.prepare(`
      SELECT t.name FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
      WHERE dt.deck_id = ? ORDER BY t.name
    `).all(deckId) as { name: string }[]).map((r) => r.name);
  }

  it('round-trips a deck\'s tags through export and import', () => {
    const uuid = randomUUID();
    const deckId = createDeck('Tagged', { uuid });
    tagDeck(deckId, 'Fast');
    tagDeck(deckId, 'Cheap', 'plum');

    const backup = exportBackup(db);
    const fresh = createTestDb();
    const summary = importBackup(fresh, JSON.parse(JSON.stringify(backup)));

    expect(summary.tagsImported).toBe(2);
    const restored = fresh.prepare('SELECT id FROM decks WHERE uuid = ?').get(uuid) as { id: number };
    const names = (fresh.prepare(`
      SELECT t.name, t.color FROM deck_tags dt JOIN tags t ON t.id = dt.tag_id
      WHERE dt.deck_id = ? ORDER BY t.name
    `).all(restored.id) as { name: string; color: string }[]);
    expect(names).toEqual([
      { name: 'Cheap', color: 'plum' },
      { name: 'Fast', color: 'slate' },
    ]);
  });

  it('omits the tag fields entirely when nothing is tagged', () => {
    createDeck('Plain');
    const backup = exportBackup(db) as Record<string, unknown>;

    expect(backup.tags).toBeUndefined();
    expect(backup.decks as unknown[]).toHaveLength(1);
    expect((backup.decks as Record<string, unknown>[])[0].tags).toBeUndefined();
  });

  it('imports a backup written before tags existed', () => {
    const uuid = randomUUID();
    const summary = importBackup(db, {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      decks: [{ uuid, name: 'Legacy', format: '', description: '', owned: 0, cover: null, cards: [] }],
      collection: [],
    });

    expect(summary.tagsImported).toBe(0);
    expect(summary.decksImported).toBe(1);
  });

  it('reuses a local tag of the same name instead of forking it', () => {
    const uuid = randomUUID();
    const deckId = createDeck('Source', { uuid });
    tagDeck(deckId, 'Commander');
    const backup = JSON.parse(JSON.stringify(exportBackup(db)));

    // A second machine typed the same tag name by hand, so its uuid differs.
    const fresh = createTestDb();
    fresh.prepare('INSERT INTO tags (uuid, name, color) VALUES (?, ?, ?)')
      .run(randomUUID(), 'commander', 'teal');

    const summary = importBackup(fresh, backup);

    expect(summary.tagsImported).toBe(0);
    const tags = fresh.prepare('SELECT name, color FROM tags').all();
    expect(tags).toEqual([{ name: 'commander', color: 'teal' }]);
  });

  it('replaces the tags on a deck the backup already knows', () => {
    const uuid = randomUUID();
    const deckId = createDeck('Deck', { uuid });
    tagDeck(deckId, 'Keep');
    const backup = JSON.parse(JSON.stringify(exportBackup(db)));

    tagDeck(deckId, 'AddedLater');
    expect(deckTagNames(deckId)).toEqual(['AddedLater', 'Keep']);

    importBackup(db, backup);

    expect(deckTagNames(deckId)).toEqual(['Keep']);
  });

  it('falls back to an auto colour when the backup names an unknown one', () => {
    const uuid = randomUUID();
    const deckId = createDeck('Deck', { uuid });
    const tagUuid = tagDeck(deckId, 'Weird');
    const backup = JSON.parse(JSON.stringify(exportBackup(db)));
    backup.tags = [{ uuid: tagUuid, name: 'Weird', color: 'ultraviolet' }];

    const fresh = createTestDb();
    importBackup(fresh, backup);

    const tag = fresh.prepare('SELECT color FROM tags WHERE name = ?').get('Weird') as { color: string };
    expect(tag.color).not.toBe('ultraviolet');
  });

  it('rejects a tag entry with no name', () => {
    expect(() => importBackup(db, {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      tags: [{ uuid: randomUUID(), name: '  ', color: 'slate' }],
      decks: [],
      collection: [],
    })).toThrow(/tag without a name/i);
  });

  it('rejects deck tags that are not a list of uuids', () => {
    expect(() => importBackup(db, {
      kind: BACKUP_KIND,
      version: BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      decks: [{ uuid: randomUUID(), name: 'Bad', format: '', description: '', owned: 0, cover: null, cards: [], tags: [7] }],
      collection: [],
    })).toThrow(/invalid tags/i);
  });
});
