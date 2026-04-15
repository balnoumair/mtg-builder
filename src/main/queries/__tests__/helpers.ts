import Database from 'better-sqlite3';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      oracle_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mana_cost TEXT DEFAULT '',
      cmc REAL DEFAULT 0,
      type_line TEXT DEFAULT '',
      oracle_text TEXT DEFAULT '',
      colors TEXT DEFAULT '[]',
      color_identity TEXT DEFAULT '[]',
      keywords TEXT DEFAULT '[]',
      power TEXT,
      toughness TEXT,
      rarity TEXT DEFAULT '',
      set_code TEXT DEFAULT '',
      set_name TEXT DEFAULT '',
      collector_number TEXT DEFAULT '',
      layout TEXT DEFAULT 'normal',
      image_uri_small TEXT,
      image_uri_normal TEXT,
      image_uri_large TEXT,
      image_uri_art_crop TEXT,
      face_back_name TEXT,
      face_back_image_uri_normal TEXT,
      legalities TEXT DEFAULT '{}',
      price_usd TEXT,
      price_eur TEXT,
      released_at TEXT,
      artist TEXT
    );

    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      format TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover_card_id TEXT,
      owned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deck_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      card_id TEXT NOT NULL REFERENCES cards(id),
      quantity INTEGER DEFAULT 1,
      board TEXT DEFAULT 'main',
      UNIQUE(deck_id, card_id, board)
    );

    CREATE TABLE IF NOT EXISTS collection (
      card_id TEXT NOT NULL REFERENCES cards(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      added_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (card_id)
    );
  `);

  return db;
}

let cardSeq = 0;

export function insertTestCard(
  db: Database.Database,
  overrides: Partial<{
    id: string;
    oracle_id: string;
    name: string;
    mana_cost: string;
    cmc: number;
    type_line: string;
    oracle_text: string;
    colors: string[];
    color_identity: string[];
    keywords: string[];
    rarity: string;
    set_code: string;
    set_name: string;
    collector_number: string;
    legalities: Record<string, string>;
    released_at: string;
    price_usd: string | null;
    artist: string;
  }> = {}
): string {
  cardSeq++;
  const id = overrides.id ?? `card-${cardSeq}`;
  const oracle_id = overrides.oracle_id ?? `oracle-${cardSeq}`;

  db.prepare(`
    INSERT INTO cards (
      id, oracle_id, name, mana_cost, cmc, type_line, oracle_text,
      colors, color_identity, keywords, rarity, set_code, set_name,
      collector_number, legalities, released_at, price_usd, artist
    ) VALUES (
      @id, @oracle_id, @name, @mana_cost, @cmc, @type_line, @oracle_text,
      @colors, @color_identity, @keywords, @rarity, @set_code, @set_name,
      @collector_number, @legalities, @released_at, @price_usd, @artist
    )
  `).run({
    id,
    oracle_id,
    name: overrides.name ?? `Test Card ${cardSeq}`,
    mana_cost: overrides.mana_cost ?? '{1}',
    cmc: overrides.cmc ?? 1,
    type_line: overrides.type_line ?? 'Creature',
    oracle_text: overrides.oracle_text ?? '',
    colors: JSON.stringify(overrides.colors ?? []),
    color_identity: JSON.stringify(overrides.color_identity ?? []),
    keywords: JSON.stringify(overrides.keywords ?? []),
    rarity: overrides.rarity ?? 'common',
    set_code: overrides.set_code ?? 'tst',
    set_name: overrides.set_name ?? 'Test Set',
    collector_number: overrides.collector_number ?? String(cardSeq),
    legalities: JSON.stringify(overrides.legalities ?? {}),
    released_at: overrides.released_at ?? '2024-01-01',
    price_usd: overrides.price_usd ?? null,
    artist: overrides.artist ?? 'Test Artist',
  });

  return id;
}
