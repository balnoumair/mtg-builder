import type Database from 'better-sqlite3';
import type { Deck, DeckCard } from '../../shared/types';

export function getDecks(db: Database.Database): Deck[] {
  const rows = db.prepare(`
    SELECT d.*, COALESCE(SUM(dc.quantity), 0) as card_count
    FROM decks d
    LEFT JOIN deck_cards dc ON dc.deck_id = d.id AND dc.board = 'main'
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `).all() as (Omit<Deck, 'owned'> & { owned: number })[];
  return rows.map(r => ({ ...r, owned: !!r.owned }));
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

export function addCardToDeck(
  db: Database.Database, deckId: number, cardId: string, board = 'main'
): void {
  db.prepare(`
    INSERT INTO deck_cards (deck_id, card_id, quantity, board)
    VALUES (@deckId, @cardId, 1, @board)
    ON CONFLICT(deck_id, card_id, board) DO UPDATE SET quantity = quantity + 1
  `).run({ deckId, cardId, board });

  db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
}

export function updateCardQuantity(
  db: Database.Database, deckId: number, cardId: string, board: string, quantity: number
): void {
  if (quantity <= 0) {
    db.prepare(
      'DELETE FROM deck_cards WHERE deck_id = @deckId AND card_id = @cardId AND board = @board'
    ).run({ deckId, cardId, board });
  } else {
    db.prepare(
      'UPDATE deck_cards SET quantity = @quantity WHERE deck_id = @deckId AND card_id = @cardId AND board = @board'
    ).run({ deckId, cardId, board, quantity });
  }
  db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
}

export function removeCardFromDeck(
  db: Database.Database, deckId: number, cardId: string, board: string
): void {
  db.prepare(
    'DELETE FROM deck_cards WHERE deck_id = @deckId AND card_id = @cardId AND board = @board'
  ).run({ deckId, cardId, board });
  db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
}

/**
 * Marks a deck as owned and deducts matching cards from the collection.
 * For each card in the deck, reduces the collection quantity by the deck quantity.
 * If collection quantity drops to 0 or below, removes from collection.
 */
export function claimDeckFromCollection(db: Database.Database, deckId: number): void {
  const txn = db.transaction(() => {
    // Mark deck as owned
    db.prepare("UPDATE decks SET owned = 1, updated_at = datetime('now') WHERE id = ?").run(deckId);

    // Get all cards in this deck
    const deckCards = db.prepare(
      'SELECT card_id, SUM(quantity) as total_qty FROM deck_cards WHERE deck_id = ? GROUP BY card_id'
    ).all(deckId) as { card_id: string; total_qty: number }[];

    for (const dc of deckCards) {
      // Get current collection quantity
      const colRow = db.prepare(
        'SELECT quantity FROM collection WHERE card_id = ?'
      ).get(dc.card_id) as { quantity: number } | undefined;

      if (!colRow) continue; // Card not in collection, skip

      const remaining = colRow.quantity - dc.total_qty;
      if (remaining <= 0) {
        db.prepare('DELETE FROM collection WHERE card_id = ?').run(dc.card_id);
      } else {
        db.prepare('UPDATE collection SET quantity = ? WHERE card_id = ?').run(remaining, dc.card_id);
      }
    }
  });

  txn();
}
