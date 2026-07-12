import type Database from 'better-sqlite3';
import type { Deck, DeckCard } from '../../shared/types';
import { addToCollection } from './collection';
import {
  classifyDeckSetGroup,
  type DeckCardSetInfo,
  type DeckSetGroup,
  MIXED_DECK_SET_GROUP,
} from '../../shared/deckSetGroup';
import {
  buildBlockSortKeys,
  buildSetReleaseDates,
  type SetCatalogEntry,
} from '../../shared/setOrdering';
import { getMaxCopies } from '../../shared/deckLimits';

const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'] as const;

function getDeckColorIdentities(db: Database.Database): Map<number, string[]> {
  const rows = db.prepare(`
    SELECT dc.deck_id, c.color_identity
    FROM deck_cards dc
    JOIN cards c ON c.id = dc.card_id
    WHERE dc.board = 'main'
  `).all() as { deck_id: number; color_identity: string }[];

  const sets = new Map<number, Set<string>>();
  for (const row of rows) {
    const colors = JSON.parse(row.color_identity || '[]') as string[];
    if (!sets.has(row.deck_id)) sets.set(row.deck_id, new Set());
    const set = sets.get(row.deck_id)!;
    for (const c of colors) {
      if ((COLOR_ORDER as readonly string[]).includes(c)) set.add(c);
    }
  }

  const result = new Map<number, string[]>();
  for (const [deckId, set] of sets) {
    result.set(deckId, COLOR_ORDER.filter((c) => set.has(c)));
  }
  return result;
}

function loadSetCatalog(db: Database.Database): SetCatalogEntry[] {
  const rows = db.prepare(`
    SELECT code, name, released_at, block_code, block_name
    FROM sets
    WHERE released_at IS NOT NULL AND released_at != ''
  `).all() as {
    code: string;
    name: string;
    released_at: string;
    block_code: string | null;
    block_name: string | null;
  }[];

  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    releasedAt: r.released_at,
    blockCode: r.block_code,
    blockName: r.block_name,
  }));
}

function getDeckSetGroups(db: Database.Database): Map<number, DeckSetGroup> {
  const catalog = loadSetCatalog(db);
  const blockSortKeys = buildBlockSortKeys(catalog);
  const setReleaseDates = buildSetReleaseDates(catalog);

  const rows = db.prepare(`
    SELECT dc.deck_id, c.name, c.set_code, c.set_name, c.block_code, c.block_name, c.released_at
    FROM deck_cards dc
    JOIN cards c ON c.id = dc.card_id
    WHERE dc.board = 'main'
  `).all() as (DeckCardSetInfo & { deck_id: number })[];

  const byDeck = new Map<number, DeckCardSetInfo[]>();
  for (const row of rows) {
    if (!byDeck.has(row.deck_id)) byDeck.set(row.deck_id, []);
    byDeck.get(row.deck_id)!.push({
      name: row.name,
      set_code: row.set_code,
      set_name: row.set_name,
      block_code: row.block_code,
      block_name: row.block_name,
      released_at: row.released_at,
    });
  }

  const result = new Map<number, DeckSetGroup>();
  for (const [deckId, cards] of byDeck) {
    result.set(deckId, classifyDeckSetGroup(cards, blockSortKeys, setReleaseDates));
  }
  return result;
}

export function getDecks(db: Database.Database): Deck[] {
  const colorIdentities = getDeckColorIdentities(db);
  const setGroups = getDeckSetGroups(db);
  const rows = db.prepare(`
    SELECT d.*, COALESCE(SUM(dc.quantity), 0) as card_count
    FROM decks d
    LEFT JOIN deck_cards dc ON dc.deck_id = d.id AND dc.board = 'main'
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `).all() as (Omit<Deck, 'owned'> & { owned: number })[];
  return rows.map((r) => ({
    ...r,
    owned: !!r.owned,
    color_identity: colorIdentities.get(r.id) ?? [],
    set_group: setGroups.get(r.id) ?? MIXED_DECK_SET_GROUP,
  }));
}

function rowToDeck(row: Record<string, unknown>): Deck {
  return { ...row, owned: !!(row.owned as number) } as Deck;
}

export function createDeck(db: Database.Database, deck: { name: string; format?: string }): Deck {
  const result = db.prepare(
    "INSERT INTO decks (name, format) VALUES (@name, @format)"
  ).run({ name: deck.name, format: deck.format || '' });

  return rowToDeck(db.prepare('SELECT * FROM decks WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>);
}

export function updateDeck(db: Database.Database, id: number, updates: Partial<Deck>): Deck {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.name !== undefined) { fields.push('name = @name'); params.name = updates.name; }
  if (updates.format !== undefined) { fields.push('format = @format'); params.format = updates.format; }
  if (updates.description !== undefined) { fields.push('description = @description'); params.description = updates.description; }
  if (updates.cover_card_id !== undefined) { fields.push('cover_card_id = @cover_card_id'); params.cover_card_id = updates.cover_card_id; }
  if (updates.owned !== undefined) { fields.push('owned = @owned'); params.owned = updates.owned ? 1 : 0; }

  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE decks SET ${fields.join(', ')} WHERE id = @id`).run(params);

  if (updates.owned === true) {
    db.prepare(
      'UPDATE deck_cards SET owned_quantity = quantity WHERE deck_id = ? AND owned_quantity IS NULL'
    ).run(id);
  } else if (updates.owned === false) {
    db.prepare('DELETE FROM deck_cards WHERE deck_id = ? AND quantity <= 0').run(id);
    db.prepare('UPDATE deck_cards SET owned_quantity = NULL WHERE deck_id = ?').run(id);
  }

  return rowToDeck(db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as Record<string, unknown>);
}

export function deleteDeck(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM decks WHERE id = ?').run(id);
}

export function getDeckCards(db: Database.Database, deckId: number): DeckCard[] {
  return db.prepare(`
    SELECT dc.*, c.name, c.mana_cost, c.cmc, c.type_line, c.oracle_text,
           c.colors, c.color_identity, c.keywords, c.power, c.toughness,
           c.rarity, c.set_code, c.set_name, c.collector_number, c.layout,
           c.image_uri_small, c.image_uri_normal, c.image_uri_large, c.image_uri_art_crop,
           c.face_back_name, c.face_back_image_uri_normal,
           c.legalities, c.price_usd, c.price_eur, c.released_at, c.artist,
           c.oracle_id
    FROM deck_cards dc
    JOIN cards c ON c.id = dc.card_id
    WHERE dc.deck_id = ?
    ORDER BY c.cmc ASC, c.name ASC
  `).all(deckId).map((row: Record<string, unknown>) => {
    const deckCard: DeckCard = {
      id: row.id as number,
      deck_id: row.deck_id as number,
      card_id: row.card_id as string,
      quantity: row.quantity as number,
      owned_quantity: (row.owned_quantity as number | null) ?? null,
      ignore_copy_limit: !!(row.ignore_copy_limit as number),
      board: row.board as 'main' | 'sideboard',
      card: {
        id: row.card_id as string,
        oracle_id: row.oracle_id as string,
        name: row.name as string,
        mana_cost: row.mana_cost as string,
        cmc: row.cmc as number,
        type_line: row.type_line as string,
        oracle_text: row.oracle_text as string,
        colors: JSON.parse((row.colors as string) || '[]'),
        color_identity: JSON.parse((row.color_identity as string) || '[]'),
        keywords: JSON.parse((row.keywords as string) || '[]'),
        power: row.power as string | null,
        toughness: row.toughness as string | null,
        rarity: row.rarity as string,
        set_code: row.set_code as string,
        set_name: row.set_name as string,
        collector_number: row.collector_number as string,
        layout: row.layout as string,
        image_uri_small: row.image_uri_small as string | null,
        image_uri_normal: row.image_uri_normal as string | null,
        image_uri_large: row.image_uri_large as string | null,
        image_uri_art_crop: row.image_uri_art_crop as string | null,
        face_back_name: row.face_back_name as string | null,
        face_back_image_uri_normal: row.face_back_image_uri_normal as string | null,
        legalities: JSON.parse((row.legalities as string) || '{}'),
        price_usd: row.price_usd as string | null,
        price_eur: row.price_eur as string | null,
        released_at: row.released_at as string,
        artist: row.artist as string,
      },
    };
    return deckCard;
  }) as DeckCard[];
}

/**
 * Copies of a card name already in the deck (main + sideboard combined),
 * optionally excluding one row so its own quantity can be replaced.
 */
function countCopiesOfName(
  db: Database.Database,
  deckId: number,
  cardName: string,
  exclude?: { cardId: string; board: string },
): number {
  const row = db.prepare(`
    SELECT COALESCE(SUM(dc.quantity), 0) as total
    FROM deck_cards dc
    JOIN cards c ON c.id = dc.card_id
    WHERE dc.deck_id = @deckId AND c.name = @cardName
      AND NOT (dc.card_id = @excludeCardId AND dc.board = @excludeBoard)
  `).get({
    deckId,
    cardName,
    excludeCardId: exclude?.cardId ?? '',
    excludeBoard: exclude?.board ?? '',
  }) as { total: number };
  return row.total;
}

function getCardLimitInfo(db: Database.Database, cardId: string) {
  return db.prepare(
    'SELECT name, type_line FROM cards WHERE id = ?'
  ).get(cardId) as { name: string; type_line: string } | undefined;
}

/**
 * Whether removals from an owned deck should be kept as quantity-0 rows
 * (pending confirmation) instead of deleted outright.
 */
function isOwnedDeck(db: Database.Database, deckId: number): boolean {
  const row = db.prepare('SELECT owned FROM decks WHERE id = ?').get(deckId) as
    | { owned: number }
    | undefined;
  return !!row?.owned;
}

/**
 * A card name is exempt from the copy limit in a deck when the user flagged
 * any of its rows there (e.g. a Relentless Rats deck), regardless of board
 * or printing.
 */
function nameIgnoresCopyLimit(db: Database.Database, deckId: number, cardName: string): boolean {
  const row = db.prepare(`
    SELECT 1 FROM deck_cards dc
    JOIN cards c ON c.id = dc.card_id
    WHERE dc.deck_id = @deckId AND c.name = @cardName AND dc.ignore_copy_limit = 1
    LIMIT 1
  `).get({ deckId, cardName });
  return !!row;
}

export function setDeckCardIgnoreLimit(
  db: Database.Database, deckId: number, cardId: string, ignore: boolean
): void {
  db.prepare(
    'UPDATE deck_cards SET ignore_copy_limit = @ignore WHERE deck_id = @deckId AND card_id = @cardId'
  ).run({ deckId, cardId, ignore: ignore ? 1 : 0 });
}

export function addCardToDeck(
  db: Database.Database, deckId: number, cardId: string, board = 'main', count = 1
): void {
  const card = getCardLimitInfo(db, cardId);
  if (!card || count <= 0) return;

  const max = nameIgnoresCopyLimit(db, deckId, card.name) ? null : getMaxCopies(card);
  if (max !== null) {
    const current = countCopiesOfName(db, deckId, card.name);
    count = Math.min(count, max - current);
    if (count <= 0) return;
  }

  db.prepare(`
    INSERT INTO deck_cards (deck_id, card_id, quantity, board)
    VALUES (@deckId, @cardId, @count, @board)
    ON CONFLICT(deck_id, card_id, board) DO UPDATE SET quantity = quantity + @count
  `).run({ deckId, cardId, board, count });

  db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
}

export function updateCardQuantity(
  db: Database.Database, deckId: number, cardId: string, board: string, quantity: number
): void {
  if (quantity > 0) {
    const card = getCardLimitInfo(db, cardId);
    const max = card && !nameIgnoresCopyLimit(db, deckId, card.name) ? getMaxCopies(card) : null;
    if (card && max !== null) {
      const others = countCopiesOfName(db, deckId, card.name, { cardId, board });
      quantity = Math.min(quantity, Math.max(0, max - others));
    }
  }

  if (quantity <= 0) {
    removeCardFromDeck(db, deckId, cardId, board);
    return;
  }
  db.prepare(
    'UPDATE deck_cards SET quantity = @quantity WHERE deck_id = @deckId AND card_id = @cardId AND board = @board'
  ).run({ deckId, cardId, board, quantity });
  db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
}

export function removeCardFromDeck(
  db: Database.Database, deckId: number, cardId: string, board: string
): void {
  // In an owned deck, confirmed cards linger at quantity 0 (a pending
  // removal) so the change can be confirmed or discarded later.
  if (isOwnedDeck(db, deckId)) {
    db.prepare(`
      UPDATE deck_cards SET quantity = 0
      WHERE deck_id = @deckId AND card_id = @cardId AND board = @board
        AND COALESCE(owned_quantity, 0) > 0
    `).run({ deckId, cardId, board });
  }
  db.prepare(`
    DELETE FROM deck_cards
    WHERE deck_id = @deckId AND card_id = @cardId AND board = @board
      AND COALESCE(owned_quantity, 0) = 0 AND quantity != 0
  `).run({ deckId, cardId, board });
  db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
}

/**
 * Marks a deck as owned and deducts matching cards from the collection.
 * For each card in the deck, reduces the collection quantity by the deck quantity.
 * If collection quantity drops to 0 or below, removes from collection.
 */
function deductFromCollection(db: Database.Database, cardId: string, count: number): void {
  const colRow = db.prepare(
    'SELECT quantity FROM collection WHERE card_id = ?'
  ).get(cardId) as { quantity: number } | undefined;

  if (!colRow) return; // Card not in collection, skip

  const remaining = colRow.quantity - count;
  if (remaining <= 0) {
    db.prepare('DELETE FROM collection WHERE card_id = ?').run(cardId);
  } else {
    db.prepare('UPDATE collection SET quantity = ? WHERE card_id = ?').run(remaining, cardId);
  }
}

export function claimDeckFromCollection(db: Database.Database, deckId: number): void {
  const txn = db.transaction(() => {
    // Mark deck as owned; current quantities become the confirmed baseline
    db.prepare("UPDATE decks SET owned = 1, updated_at = datetime('now') WHERE id = ?").run(deckId);
    db.prepare('UPDATE deck_cards SET owned_quantity = quantity WHERE deck_id = ?').run(deckId);

    // Get all cards in this deck
    const deckCards = db.prepare(
      'SELECT card_id, SUM(quantity) as total_qty FROM deck_cards WHERE deck_id = ? GROUP BY card_id'
    ).all(deckId) as { card_id: string; total_qty: number }[];

    for (const dc of deckCards) {
      deductFromCollection(db, dc.card_id, dc.total_qty);
    }
  });

  txn();
}

/**
 * Confirms pending edits to an owned deck: copies removed since the last
 * confirmation return to the collection (you still own them, they're just no
 * longer in the deck), copies added are deducted from the collection when
 * present (mirroring the claim flow), and current quantities become the new
 * confirmed baseline.
 */
export function confirmDeckChanges(db: Database.Database, deckId: number): void {
  if (!isOwnedDeck(db, deckId)) return;

  const txn = db.transaction(() => {
    const diffs = db.prepare(`
      SELECT card_id,
             SUM(CASE
                   WHEN COALESCE(owned_quantity, 0) > quantity
                   THEN COALESCE(owned_quantity, 0) - quantity
                   ELSE 0
                 END) as freed,
             SUM(CASE
                   WHEN quantity > COALESCE(owned_quantity, 0)
                   THEN quantity - COALESCE(owned_quantity, 0)
                   ELSE 0
                 END) as added
      FROM deck_cards
      WHERE deck_id = ?
      GROUP BY card_id
    `).all(deckId) as { card_id: string; freed: number; added: number }[];

    for (const diff of diffs) {
      if (diff.freed > 0) addToCollection(db, diff.card_id, diff.freed);
      if (diff.added > 0) deductFromCollection(db, diff.card_id, diff.added);
    }

    db.prepare('DELETE FROM deck_cards WHERE deck_id = ? AND quantity <= 0').run(deckId);
    db.prepare('UPDATE deck_cards SET owned_quantity = quantity WHERE deck_id = ?').run(deckId);
    db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
  });

  txn();
}

/** Reverts pending edits to an owned deck back to the last confirmed state. */
export function discardDeckChanges(db: Database.Database, deckId: number): void {
  if (!isOwnedDeck(db, deckId)) return;

  const txn = db.transaction(() => {
    db.prepare(
      'DELETE FROM deck_cards WHERE deck_id = ? AND COALESCE(owned_quantity, 0) = 0'
    ).run(deckId);
    db.prepare(
      'UPDATE deck_cards SET quantity = owned_quantity WHERE deck_id = ? AND quantity != owned_quantity'
    ).run(deckId);
    db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
  });

  txn();
}
