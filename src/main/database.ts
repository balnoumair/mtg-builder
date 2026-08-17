import type BetterSqlite3 from 'better-sqlite3';
import { app } from 'electron';
import { dedupeCardPrints } from './dedupe';
import path from 'node:path';
import fs from 'node:fs';

// better-sqlite3 is a native module that Vite cannot bundle, so in production
// it lives in extraResources. It ships Node-API prebuilds and locates them
// relative to its own package directory, so no module-path fixup is needed.
const Database: typeof BetterSqlite3 = app.isPackaged
  ? require(path.join(process.resourcesPath, 'better-sqlite3'))
  : require('better-sqlite3');

let db: BetterSqlite3.Database | null = null;

export function getDb(): BetterSqlite3.Database {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const dbPath = path.join(userDataPath, 'mtg-builder.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  runMigrations(db);

  // Databases synced before within-set variants were collapsed still hold
  // every art; dedupe them on startup (no-op once collapsed).
  if (dedupeCardPrints(db) > 0) {
    db.exec('VACUUM');
  }

  return db;
}

function initSchema(db: BetterSqlite3.Database): void {
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
      artist TEXT
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

    -- Tag names are the user-facing identity, so they collide case-insensitively.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_deck_tags_tag ON deck_tags(tag_id);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Other players' decks pulled from the shared playgroup sheet. Replaced
    -- wholesale on every pull; deliberately outside decks so they never enter
    -- deck lists, tags, or the backup JSON.
    CREATE TABLE IF NOT EXISTS external_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player TEXT NOT NULL,
      block_label TEXT NOT NULL DEFAULT '',
      colors TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      row_index INTEGER,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    -- Block/edition vocabulary mirrored from the sheet's EDICIONES tab.
    -- set_codes is a JSON array; manual = 1 marks a user-assigned mapping
    -- that must survive dictionary reseeds.
    CREATE TABLE IF NOT EXISTS sheet_blocks (
      label TEXT PRIMARY KEY,
      position REAL NOT NULL DEFAULT 0,
      set_codes TEXT NOT NULL DEFAULT '[]',
      manual INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export function runMigrations(db: BetterSqlite3.Database): void {
  const deckCols = db.prepare("PRAGMA table_info(decks)").all() as { name: string }[];
  if (!deckCols.some(c => c.name === 'owned')) {
    db.exec("ALTER TABLE decks ADD COLUMN owned INTEGER DEFAULT 0");
  }
  if (!deckCols.some(c => c.name === 'uuid')) {
    db.exec('ALTER TABLE decks ADD COLUMN uuid TEXT');
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_decks_uuid ON decks(uuid)');

  const cardCols = db.prepare("PRAGMA table_info(cards)").all() as { name: string }[];
  if (!cardCols.some(c => c.name === 'block_code')) {
    db.exec("ALTER TABLE cards ADD COLUMN block_code TEXT");
  }
  if (!cardCols.some(c => c.name === 'block_name')) {
    db.exec("ALTER TABLE cards ADD COLUMN block_name TEXT");
  }
  // Prices are intentionally not tracked; drop them from databases created
  // before their removal.
  if (cardCols.some(c => c.name === 'price_usd')) {
    db.exec("ALTER TABLE cards DROP COLUMN price_usd");
  }
  if (cardCols.some(c => c.name === 'price_eur')) {
    db.exec("ALTER TABLE cards DROP COLUMN price_eur");
  }

  const deckCardCols = db.prepare("PRAGMA table_info(deck_cards)").all() as { name: string }[];
  if (!deckCardCols.some(c => c.name === 'owned_quantity')) {
    db.exec("ALTER TABLE deck_cards ADD COLUMN owned_quantity INTEGER");
    // Existing owned decks are already confirmed as-is.
    db.exec(`
      UPDATE deck_cards SET owned_quantity = quantity
      WHERE deck_id IN (SELECT id FROM decks WHERE owned = 1)
    `);
  }
  if (!deckCardCols.some(c => c.name === 'ignore_copy_limit')) {
    db.exec("ALTER TABLE deck_cards ADD COLUMN ignore_copy_limit INTEGER DEFAULT 0");
  }
}

export function createIndexes(db: BetterSqlite3.Database): void {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_oracle_id ON cards(oracle_id);
    CREATE INDEX IF NOT EXISTS idx_cards_set_code ON cards(set_code);
    CREATE INDEX IF NOT EXISTS idx_cards_cmc ON cards(cmc);
    CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
    CREATE INDEX IF NOT EXISTS idx_cards_type_line ON cards(type_line);
    CREATE INDEX IF NOT EXISTS idx_deck_cards_deck ON deck_cards(deck_id);
  `);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
