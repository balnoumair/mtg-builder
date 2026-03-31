import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
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

  return db;
}

function initSchema(db: Database.Database): void {
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
  `);
}

export function createIndexes(db: Database.Database): void {
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
