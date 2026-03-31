import type Database from 'better-sqlite3';
import type { Deck, DeckCard } from '../../shared/types';

export function getDecks(db: Database.Database): Deck[] {
  return db.prepare(`
    SELECT d.*, COALESCE(SUM(dc.quantity), 0) as card_count
    FROM decks d
    LEFT JOIN deck_cards dc ON dc.deck_id = d.id AND dc.board = 'main'
    GROUP BY d.id
    ORDER BY d.updated_at DESC
  `).all() as Deck[];
}

export function createDeck(db: Database.Database, deck: { name: string; format?: string }): Deck {
  const result = db.prepare(
    "INSERT INTO decks (name, format) VALUES (@name, @format)"
  ).run({ name: deck.name, format: deck.format || '' });

  return db.prepare('SELECT * FROM decks WHERE id = ?').get(result.lastInsertRowid) as Deck;
}

export function updateDeck(db: Database.Database, id: number, updates: Partial<Deck>): Deck {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.name !== undefined) { fields.push('name = @name'); params.name = updates.name; }
  if (updates.format !== undefined) { fields.push('format = @format'); params.format = updates.format; }
  if (updates.description !== undefined) { fields.push('description = @description'); params.description = updates.description; }
  if (updates.cover_card_id !== undefined) { fields.push('cover_card_id = @cover_card_id'); params.cover_card_id = updates.cover_card_id; }

  fields.push("updated_at = datetime('now')");

  db.prepare(`UPDATE decks SET ${fields.join(', ')} WHERE id = @id`).run(params);
  return db.prepare('SELECT * FROM decks WHERE id = ?').get(id) as Deck;
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
