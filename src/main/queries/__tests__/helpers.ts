import Database from 'better-sqlite3';
import { afterEach } from 'vitest';

const testDbs: Database.Database[] = [];

// Test databases are closed after each test, and then deliberately kept
// referenced for the life of the worker.
//
// Closing releases SQLite's resources, but it does not stop better-sqlite3's
// C++ destructor from running when V8 finalizes the wrapper object. That
// destructor calls RemoveEnvironmentCleanupHook, which aborts the process if
// it runs after the worker's environment is already gone:
//
//   node::RemoveEnvironmentCleanupHook … Assertion failed: (env) != nullptr
//   Error: Worker exited unexpectedly
//
// No test fails when that happens — the worker dies and its whole file's
// results go missing. Objects that stay reachable are never finalized, so
// holding the references avoids the race entirely. The retained wrappers are
// empty once closed, so this costs nothing.
afterEach(() => {
  for (const db of testDbs) {
    if (db.open) db.close();
  }
});

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  testDbs.push(db);
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
      released_at TEXT,
      artist TEXT,
      block_code TEXT,
      block_name TEXT
    );

    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
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
      owned_quantity INTEGER,
      ignore_copy_limit INTEGER DEFAULT 0,
      board TEXT DEFAULT 'main',
      UNIQUE(deck_id, card_id, board)
    );

    CREATE TABLE IF NOT EXISTS collection (
      card_id TEXT NOT NULL REFERENCES cards(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      added_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (card_id)
    );

    CREATE TABLE IF NOT EXISTS sets (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      released_at TEXT,
      block_code TEXT,
      block_name TEXT,
      icon_svg_uri TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'slate',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deck_tags (
      deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (deck_id, tag_id)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_deck_tags_tag ON deck_tags(tag_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS external_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player TEXT NOT NULL,
      block_label TEXT NOT NULL DEFAULT '',
      colors TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      row_index INTEGER,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sheet_blocks (
      label TEXT PRIMARY KEY,
      position REAL NOT NULL DEFAULT 0,
      set_codes TEXT NOT NULL DEFAULT '[]',
      manual INTEGER NOT NULL DEFAULT 0
    );
  `);

  return db;
}

export function insertTestSet(
  db: Database.Database,
  overrides: Partial<{
    code: string;
    name: string;
    released_at: string;
    block_code: string | null;
    block_name: string | null;
    icon_svg_uri: string | null;
  }> = {},
): void {
  db.prepare(`
    INSERT INTO sets (code, name, released_at, block_code, block_name, icon_svg_uri)
    VALUES (@code, @name, @released_at, @block_code, @block_name, @icon_svg_uri)
  `).run({
    code: overrides.code ?? 'tst',
    name: overrides.name ?? 'Test Set',
    released_at: overrides.released_at ?? '2024-01-01',
    block_code: overrides.block_code ?? null,
    block_name: overrides.block_name ?? null,
    icon_svg_uri: overrides.icon_svg_uri ?? null,
  });
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
    artist: string;
    block_code: string | null;
    block_name: string | null;
  }> = {}
): string {
  cardSeq++;
  const id = overrides.id ?? `card-${cardSeq}`;
  const oracle_id = overrides.oracle_id ?? `oracle-${cardSeq}`;

  db.prepare(`
    INSERT INTO cards (
      id, oracle_id, name, mana_cost, cmc, type_line, oracle_text,
      colors, color_identity, keywords, rarity, set_code, set_name,
      collector_number, legalities, released_at, artist,
      block_code, block_name
    ) VALUES (
      @id, @oracle_id, @name, @mana_cost, @cmc, @type_line, @oracle_text,
      @colors, @color_identity, @keywords, @rarity, @set_code, @set_name,
      @collector_number, @legalities, @released_at, @artist,
      @block_code, @block_name
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
    artist: overrides.artist ?? 'Test Artist',
    block_code: overrides.block_code ?? null,
    block_name: overrides.block_name ?? null,
  });

  return id;
}
