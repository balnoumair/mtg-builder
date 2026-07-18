import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';

// Backups identify cards by oracle_id + name + set_code, never by print id:
// print ids change when prints are re-collapsed or Scryfall data shifts, so a
// backup file stays importable across syncs, devices, and app versions.
// Decks carry a stable uuid so re-importing the same backup skips decks that
// are already present (collection merge stays idempotent separately).

export const BACKUP_KIND = 'mtg-builder-backup';
export const BACKUP_VERSION = 1;

interface BackupDeckCard {
  name: string;
  oracle_id: string;
  set_code: string;
  board: string;
  quantity: number;
  owned_quantity: number | null;
  ignore_copy_limit: number;
}

interface BackupDeck {
  /** Stable deck identity; absent on backups written before uuids existed. */
  uuid?: string;
  name: string;
  format: string;
  description: string;
  owned: number;
  cover: { oracle_id: string; set_code: string } | null;
  cards: BackupDeckCard[];
}

interface BackupCollectionCard {
  name: string;
  oracle_id: string;
  set_code: string;
  quantity: number;
  added_at: string | null;
}

export interface AppBackup {
  kind: typeof BACKUP_KIND;
  version: number;
  exported_at: string;
  decks: BackupDeck[];
  collection: BackupCollectionCard[];
}

export interface BackupImportSummary {
  decksImported: number;
  decksSkipped: number;
  /** Collection cards newly added or whose quantity increased. */
  collectionCards: number;
  /** Collection cards already present with equal or higher quantity. */
  collectionCardsSkipped: number;
  /** Cards that no longer exist in the local database; deck is null for collection entries. */
  missing: Array<{ deck: string | null; card: string; quantity: number }>;
}

export function exportBackup(db: Database.Database): AppBackup {
  const deckRows = db.prepare(
    'SELECT id, uuid, name, format, description, owned, cover_card_id FROM decks ORDER BY name'
  ).all() as Array<{
    id: number;
    uuid: string;
    name: string;
    format: string;
    description: string;
    owned: number;
    cover_card_id: string | null;
  }>;

  const cardsStmt = db.prepare(`
    SELECT c.name, c.oracle_id, c.set_code, dc.board, dc.quantity, dc.owned_quantity, dc.ignore_copy_limit
    FROM deck_cards dc JOIN cards c ON c.id = dc.card_id
    WHERE dc.deck_id = ?
    ORDER BY dc.board, c.name
  `);
  const coverStmt = db.prepare('SELECT oracle_id, set_code FROM cards WHERE id = ?');

  const collection = db.prepare(`
    SELECT c.name, c.oracle_id, c.set_code, col.quantity, col.added_at
    FROM collection col JOIN cards c ON c.id = col.card_id
    ORDER BY c.name
  `).all() as BackupCollectionCard[];

  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    decks: deckRows.map((deck) => ({
      uuid: deck.uuid,
      name: deck.name,
      format: deck.format,
      description: deck.description,
      owned: deck.owned,
      cover: deck.cover_card_id
        ? (coverStmt.get(deck.cover_card_id) as BackupDeck['cover']) ?? null
        : null,
      cards: cardsStmt.all(deck.id) as BackupDeckCard[],
    })),
    collection,
  };
}

function isCardIdentity(value: unknown): value is { name: string; oracle_id: string; set_code: string; quantity: number } {
  const c = value as { name: string; oracle_id: string; set_code: string; quantity: number };
  return (
    !!c && typeof c === 'object' &&
    typeof c.name === 'string' &&
    typeof c.oracle_id === 'string' &&
    typeof c.set_code === 'string' &&
    Number.isInteger(c.quantity) && c.quantity > 0
  );
}

function isBackupDeckCard(value: unknown): value is BackupDeckCard {
  const c = value as BackupDeckCard;
  return (
    isCardIdentity(value) &&
    (c.board === 'main' || c.board === 'sideboard') &&
    (c.owned_quantity === null || Number.isInteger(c.owned_quantity))
  );
}

function validateBackup(parsed: unknown): AppBackup {
  const backup = parsed as AppBackup;
  if (!backup || typeof backup !== 'object' || backup.kind !== BACKUP_KIND) {
    throw new Error('Not a backup file');
  }
  if (backup.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version ${backup.version}`);
  }
  if (!Array.isArray(backup.decks) || !Array.isArray(backup.collection)) {
    throw new Error('Backup file is malformed');
  }
  for (const deck of backup.decks) {
    if (!deck || typeof deck !== 'object' || typeof deck.name !== 'string' || !deck.name) {
      throw new Error('Backup contains a deck without a name');
    }
    if (deck.uuid !== undefined && (typeof deck.uuid !== 'string' || !deck.uuid)) {
      throw new Error(`Deck "${deck.name}" has an invalid uuid`);
    }
    if (!Array.isArray(deck.cards) || !deck.cards.every(isBackupDeckCard)) {
      throw new Error(`Deck "${deck.name}" has invalid card entries`);
    }
  }
  if (!backup.collection.every(isCardIdentity)) {
    throw new Error('Backup has invalid collection entries');
  }
  return backup;
}

// Imports decks that are not already present (matched by uuid). Decks without
// a uuid (legacy backups) always insert as new. Collection merges by keeping
// the larger of the local and backup counts, so re-importing the same file is
// idempotent for collection and never reduces local copies. Cards resolve to
// the print of the same card in the recorded set when possible, falling back
// to the card's kept print, then to a name match. Cards not in the database
// at all are skipped and reported.
export function importBackup(db: Database.Database, parsed: unknown): BackupImportSummary {
  const backup = validateBackup(parsed);

  const resolveCard = db.prepare(`
    SELECT COALESCE(
      (SELECT id FROM cards WHERE oracle_id = @oracle_id AND set_code = @set_code
         ORDER BY CAST(collector_number AS INTEGER) ASC, collector_number ASC LIMIT 1),
      (SELECT id FROM cards WHERE oracle_id = @oracle_id
         ORDER BY released_at DESC, CAST(collector_number AS INTEGER) ASC LIMIT 1),
      (SELECT id FROM cards WHERE name = @name
         ORDER BY released_at DESC, CAST(collector_number AS INTEGER) ASC LIMIT 1)
    ) AS id
  `);
  const findDeckByUuid = db.prepare('SELECT id FROM decks WHERE uuid = ?');
  const insertDeck = db.prepare(
    'INSERT INTO decks (uuid, name, format, description, owned) VALUES (@uuid, @name, @format, @description, @owned)'
  );
  const insertDeckCard = db.prepare(`
    INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, ignore_copy_limit, board)
    VALUES (@deck_id, @card_id, @quantity, @owned_quantity, @ignore_copy_limit, @board)
    ON CONFLICT(deck_id, card_id, board) DO UPDATE SET
      quantity = quantity + excluded.quantity,
      owned_quantity = CASE
        WHEN owned_quantity IS NULL AND excluded.owned_quantity IS NULL THEN NULL
        ELSE COALESCE(owned_quantity, 0) + COALESCE(excluded.owned_quantity, 0)
      END,
      ignore_copy_limit = MAX(ignore_copy_limit, excluded.ignore_copy_limit)
  `);
  const setCover = db.prepare('UPDATE decks SET cover_card_id = ? WHERE id = ?');
  const getCollectionQty = db.prepare('SELECT quantity FROM collection WHERE card_id = ?');
  const mergeCollectionCard = db.prepare(`
    INSERT INTO collection (card_id, quantity, added_at)
    VALUES (@card_id, @quantity, COALESCE(@added_at, datetime('now')))
    ON CONFLICT(card_id) DO UPDATE SET
      quantity = MAX(quantity, excluded.quantity)
  `);

  const missing: BackupImportSummary['missing'] = [];
  let collectionCards = 0;
  let collectionCardsSkipped = 0;
  let decksImported = 0;
  let decksSkipped = 0;

  const run = db.transaction(() => {
    for (const deck of backup.decks) {
      const uuid = typeof deck.uuid === 'string' && deck.uuid ? deck.uuid : randomUUID();
      if (typeof deck.uuid === 'string' && deck.uuid && findDeckByUuid.get(uuid)) {
        decksSkipped += 1;
        continue;
      }

      const deckId = insertDeck.run({
        uuid,
        name: deck.name,
        format: typeof deck.format === 'string' ? deck.format : '',
        description: typeof deck.description === 'string' ? deck.description : '',
        owned: deck.owned ? 1 : 0,
      }).lastInsertRowid as number;
      decksImported += 1;

      for (const card of deck.cards) {
        const resolved = resolveCard.get(card) as { id: string | null };
        if (!resolved.id) {
          missing.push({ deck: deck.name, card: card.name, quantity: card.quantity });
          continue;
        }
        insertDeckCard.run({
          deck_id: deckId,
          card_id: resolved.id,
          quantity: card.quantity,
          owned_quantity: card.owned_quantity,
          ignore_copy_limit: card.ignore_copy_limit ? 1 : 0,
          board: card.board,
        });
      }

      if (deck.cover && typeof deck.cover.oracle_id === 'string') {
        const cover = resolveCard.get({
          oracle_id: deck.cover.oracle_id,
          set_code: typeof deck.cover.set_code === 'string' ? deck.cover.set_code : '',
          name: '',
        }) as { id: string | null };
        if (cover.id) setCover.run(cover.id, deckId);
      }
    }

    for (const card of backup.collection) {
      const resolved = resolveCard.get({
        oracle_id: card.oracle_id,
        set_code: card.set_code,
        name: card.name,
      }) as { id: string | null };
      if (!resolved.id) {
        missing.push({ deck: null, card: card.name, quantity: card.quantity });
        continue;
      }
      const existing = getCollectionQty.get(resolved.id) as { quantity: number } | undefined;
      if (existing && existing.quantity >= card.quantity) {
        collectionCardsSkipped += 1;
        continue;
      }
      mergeCollectionCard.run({
        card_id: resolved.id,
        quantity: card.quantity,
        added_at: typeof card.added_at === 'string' ? card.added_at : null,
      });
      collectionCards += 1;
    }
  });
  run();

  return { decksImported, decksSkipped, collectionCards, collectionCardsSkipped, missing };
}
