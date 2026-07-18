import type Database from 'better-sqlite3';

// The app tracks cards, not printings: a card reprinted across sets (or as a
// showcase frame, special foil, alternate art) is still one card. Keep a
// single print per oracle_id — the most recent release, preferring the plain
// (lowest-numbered) print within it. Basic lands instead keep one plain print
// per set, so each set's lands stay browsable. Decks, the collection, and
// deck covers are pointed at the surviving print before the rest is deleted.
//
// Runs after every Scryfall import and once per startup (idempotent: once
// collapsed the remap table is empty and nothing happens). Returns the number
// of deleted prints.
export function dedupeCardPrints(db: Database.Database): number {
  const dedupe = db.transaction((): number => {
    db.exec(`
      CREATE TEMP TABLE print_remap AS
      SELECT c.id AS old_id, k.id AS new_id
      FROM cards c
      JOIN (
        SELECT id, oracle_id FROM (
          SELECT id, oracle_id, ROW_NUMBER() OVER (
            PARTITION BY oracle_id
            ORDER BY released_at DESC,
                     CAST(collector_number AS INTEGER) ASC,
                     collector_number ASC,
                     id ASC
          ) AS rn
          FROM cards WHERE type_line NOT LIKE 'Basic%'
        ) WHERE rn = 1
      ) k ON k.oracle_id = c.oracle_id
      WHERE c.type_line NOT LIKE 'Basic%' AND c.id <> k.id
      UNION ALL
      SELECT c.id, k.id
      FROM cards c
      JOIN (
        SELECT id, set_code, oracle_id FROM (
          SELECT id, set_code, oracle_id, ROW_NUMBER() OVER (
            PARTITION BY set_code, oracle_id
            ORDER BY CAST(collector_number AS INTEGER) ASC,
                     collector_number ASC,
                     id ASC
          ) AS rn
          FROM cards WHERE type_line LIKE 'Basic%'
        ) WHERE rn = 1
      ) k ON k.oracle_id = c.oracle_id AND k.set_code = c.set_code
      WHERE c.type_line LIKE 'Basic%' AND c.id <> k.id
    `);

    // Deck entries move onto the surviving print; rows landing on the same
    // (deck, card, board) key merge quantities.
    db.exec(`
      INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, ignore_copy_limit, board)
      SELECT dc.deck_id, r.new_id, dc.quantity, dc.owned_quantity, dc.ignore_copy_limit, dc.board
      FROM deck_cards dc JOIN print_remap r ON r.old_id = dc.card_id
      WHERE true
      ON CONFLICT(deck_id, card_id, board) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        owned_quantity = CASE
          WHEN owned_quantity IS NULL AND excluded.owned_quantity IS NULL THEN NULL
          ELSE COALESCE(owned_quantity, 0) + COALESCE(excluded.owned_quantity, 0)
        END,
        ignore_copy_limit = MAX(ignore_copy_limit, excluded.ignore_copy_limit)
    `);
    db.exec('DELETE FROM deck_cards WHERE card_id IN (SELECT old_id FROM print_remap)');

    db.exec(`
      INSERT INTO collection (card_id, quantity, added_at)
      SELECT r.new_id, col.quantity, col.added_at
      FROM collection col JOIN print_remap r ON r.old_id = col.card_id
      WHERE true
      ON CONFLICT(card_id) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        added_at = MIN(added_at, excluded.added_at)
    `);
    db.exec('DELETE FROM collection WHERE card_id IN (SELECT old_id FROM print_remap)');

    db.exec(`
      UPDATE decks SET cover_card_id = (SELECT new_id FROM print_remap WHERE old_id = cover_card_id)
      WHERE cover_card_id IN (SELECT old_id FROM print_remap)
    `);

    const deleted = db
      .prepare('DELETE FROM cards WHERE id IN (SELECT old_id FROM print_remap)')
      .run().changes;
    db.exec('DROP TABLE print_remap');
    return deleted;
  });
  return dedupe();
}
