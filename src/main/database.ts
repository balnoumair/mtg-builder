import type BetterSqlite3 from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

// better-sqlite3 is a native module that Vite cannot bundle.
// In production it and its deps (bindings, file-uri-to-path) live in extraResources.
// We add resourcesPath to NODE_PATH so `require('bindings')` resolves correctly
// when called internally by better-sqlite3.
if (app.isPackaged) {
  process.env.NODE_PATH = process.resourcesPath;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('module').Module._initPaths();
}

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
}

function runMigrations(db: BetterSqlite3.Database): void {
  const deckCols = db.prepare("PRAGMA table_info(decks)").all() as { name: string }[];
  if (!deckCols.some(c => c.name === 'owned')) {
    db.exec("ALTER TABLE decks ADD COLUMN owned INTEGER DEFAULT 0");
  }

  const cardCols = db.prepare("PRAGMA table_info(cards)").all() as { name: string }[];
  if (!cardCols.some(c => c.name === 'block_code')) {
    db.exec("ALTER TABLE cards ADD COLUMN block_code TEXT");
  }
  if (!cardCols.some(c => c.name === 'block_name')) {
    db.exec("ALTER TABLE cards ADD COLUMN block_name TEXT");
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
