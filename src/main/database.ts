import type BetterSqlite3 from 'better-sqlite3';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { dedupeCardPrints } from './dedupe';
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

  // Databases synced before prints were collapsed to one per card still hold
  // every printing; dedupe them on startup (no-op once collapsed).
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
  `);
}

function runMigrations(db: BetterSqlite3.Database): void {
  const deckCols = db.prepare("PRAGMA table_info(decks)").all() as { name: string }[];
  if (!deckCols.some(c => c.name === 'owned')) {
    db.exec("ALTER TABLE decks ADD COLUMN owned INTEGER DEFAULT 0");
  }
  if (!deckCols.some(c => c.name === 'uuid')) {
    db.exec('ALTER TABLE decks ADD COLUMN uuid TEXT');
  }
  // Existing decks (and any row still missing one) get a stable id once.
  const missing = db.prepare('SELECT id FROM decks WHERE uuid IS NULL').all() as { id: number }[];
  if (missing.length > 0) {
    const setUuid = db.prepare('UPDATE decks SET uuid = ? WHERE id = ?');
    const fill = db.transaction(() => {
      for (const row of missing) {
        setUuid.run(randomUUID(), row.id);
      }
    });
    fill();
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
  } else {
    // Repair any owned-deck rows that are missing a confirmed baseline.
    db.exec(`
      UPDATE deck_cards SET owned_quantity = quantity
      WHERE owned_quantity IS NULL
        AND deck_id IN (SELECT id FROM decks WHERE owned = 1)
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
