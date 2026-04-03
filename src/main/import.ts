import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import type Database from 'better-sqlite3';
import { createIndexes } from './database';
import { VALID_LAYOUTS } from './queries/cards';

const STANDARD_SET_TYPES = new Set(['core', 'expansion']);

interface ScryCard {
  id: string;
  oracle_id: string;
  name: string;
  lang: string;
  layout: string;
  mana_cost?: string;
  cmc?: number;
  type_line?: string;
  oracle_text?: string;
  colors?: string[];
  color_identity?: string[];
  keywords?: string[];
  power?: string;
  toughness?: string;
  rarity?: string;
  set?: string;
  set_name?: string;
  set_type?: string;
  collector_number?: string;
  image_uris?: {
    small?: string;
    normal?: string;
    large?: string;
    art_crop?: string;
  };
  card_faces?: Array<{
    name?: string;
    mana_cost?: string;
    oracle_text?: string;
    type_line?: string;
    image_uris?: {
      small?: string;
      normal?: string;
      large?: string;
      art_crop?: string;
    };
  }>;
  legalities?: Record<string, string>;
  prices?: {
    usd?: string;
    eur?: string;
  };
  released_at?: string;
  artist?: string;
}

interface BulkDataEntry {
  type: string;
  download_uri: string;
}

interface BulkDataResponse {
  data: BulkDataEntry[];
}

type ProgressCallback = (current: number, total: number, phase: 'downloading' | 'reading' | 'indexing' | 'done') => void;

async function fetchBulkDataUrl(): Promise<string> {
  const res = await fetch('https://api.scryfall.com/bulk-data');
  if (!res.ok) throw new Error(`Scryfall API error: ${res.status}`);
  const body = (await res.json()) as BulkDataResponse;
  const entry = body.data.find((d) => d.type === 'default_cards');
  if (!entry) throw new Error('default_cards bulk data not found');
  return entry.download_uri;
}

function downloadFile(
  url: string,
  dest: string,
  onProgress: (downloaded: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress).then(resolve, reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      const file = fs.createWriteStream(dest);
      res.on('data', (chunk: Buffer) => {
        downloaded += chunk.length;
        onProgress(downloaded, totalBytes);
      });
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
      res.on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    }).on('error', reject);
  });
}

function importCardsFromFile(
  db: Database.Database,
  filePath: string,
  onProgress: (current: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const fileSize = fs.statSync(filePath).size;
    const estimatedTotal = Math.round(fileSize / 4700);

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO cards (
        id, oracle_id, name, mana_cost, cmc, type_line, oracle_text,
        colors, color_identity, keywords, power, toughness,
        rarity, set_code, set_name, collector_number, layout,
        image_uri_small, image_uri_normal, image_uri_large, image_uri_art_crop,
        face_back_name, face_back_image_uri_normal,
        legalities, price_usd, price_eur, released_at, artist
      ) VALUES (
        @id, @oracle_id, @name, @mana_cost, @cmc, @type_line, @oracle_text,
        @colors, @color_identity, @keywords, @power, @toughness,
        @rarity, @set_code, @set_name, @collector_number, @layout,
        @image_uri_small, @image_uri_normal, @image_uri_large, @image_uri_art_crop,
        @face_back_name, @face_back_image_uri_normal,
        @legalities, @price_usd, @price_eur, @released_at, @artist
      )
    `);

    let count = 0;
    let batch: Record<string, unknown>[] = [];
    const BATCH_SIZE = 500;

    const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows) {
        insertStmt.run(row);
      }
    });

    function flushBatch() {
      if (batch.length === 0) return;
      insertMany(batch);
      batch = [];
    }

    function processCard(value: ScryCard) {
      if (value.lang !== 'en') return;
      if (!VALID_LAYOUTS.has(value.layout)) return;
      if (!value.set_type || !STANDARD_SET_TYPES.has(value.set_type)) return;

      const faces = value.card_faces;
      const frontFace = faces?.[0];
      const backFace = faces?.[1];

      const imageUris = value.image_uris || frontFace?.image_uris;
      const oracleText = value.oracle_text ?? frontFace?.oracle_text ?? '';
      const manaCost = value.mana_cost ?? frontFace?.mana_cost ?? '';
      const typeLine = value.type_line ?? frontFace?.type_line ?? '';

      batch.push({
        id: value.id,
        oracle_id: value.oracle_id,
        name: value.name,
        mana_cost: manaCost,
        cmc: value.cmc ?? 0,
        type_line: typeLine,
        oracle_text: oracleText,
        colors: JSON.stringify(value.colors || []),
        color_identity: JSON.stringify(value.color_identity || []),
        keywords: JSON.stringify(value.keywords || []),
        power: value.power || null,
        toughness: value.toughness || null,
        rarity: value.rarity || '',
        set_code: value.set || '',
        set_name: value.set_name || '',
        collector_number: value.collector_number || '',
        layout: value.layout,
        image_uri_small: imageUris?.small || null,
        image_uri_normal: imageUris?.normal || null,
        image_uri_large: imageUris?.large || null,
        image_uri_art_crop: imageUris?.art_crop || null,
        face_back_name: backFace?.name || null,
        face_back_image_uri_normal: backFace?.image_uris?.normal || null,
        legalities: JSON.stringify(value.legalities || {}),
        price_usd: value.prices?.usd || null,
        price_eur: value.prices?.eur || null,
        released_at: value.released_at || '',
        artist: value.artist || '',
      });
      count++;

      if (batch.length >= BATCH_SIZE) {
        flushBatch();
        onProgress(count, estimatedTotal);
      }
    }

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line: string) => {
      let trimmed = line.trim();
      if (trimmed === '[' || trimmed === ']') return;
      if (trimmed.endsWith(',')) trimmed = trimmed.slice(0, -1);
      if (!trimmed.startsWith('{')) return;

      try {
        const card = JSON.parse(trimmed) as ScryCard;
        processCard(card);
      } catch {
        // Skip malformed lines
      }
    });

    rl.on('close', () => {
      flushBatch();
      onProgress(count, count);
      resolve();
    });

    rl.on('error', (err: Error) => {
      reject(err);
    });
  });
}

export async function syncCards(
  db: Database.Database,
  onProgress: ProgressCallback,
): Promise<void> {
  // 1. Fetch the download URL from Scryfall bulk data API
  const downloadUrl = await fetchBulkDataUrl();

  // 2. Download the file to a temp location
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `scryfall-bulk-${Date.now()}.json`);

  try {
    await downloadFile(downloadUrl, tmpFile, (downloaded, total) => {
      onProgress(downloaded, total, 'downloading');
    });

    // 3. Back up deck_cards and cover_card_id before wiping cards
    const deckCards = db.prepare('SELECT deck_id, card_id, quantity, board FROM deck_cards').all() as Array<{
      deck_id: number;
      card_id: string;
      quantity: number;
      board: string;
    }>;
    const coverCards = db.prepare('SELECT id, cover_card_id FROM decks WHERE cover_card_id IS NOT NULL').all() as Array<{
      id: number;
      cover_card_id: string;
    }>;

    // 4. Disable FK, delete all cards (avoids cascade), re-enable FK
    db.pragma('foreign_keys = OFF');
    db.exec('DELETE FROM deck_cards');
    db.exec('DELETE FROM cards');
    db.exec('DROP INDEX IF EXISTS idx_cards_name');
    db.exec('DROP INDEX IF EXISTS idx_cards_oracle_id');
    db.exec('DROP INDEX IF EXISTS idx_cards_set_code');
    db.exec('DROP INDEX IF EXISTS idx_cards_cmc');
    db.exec('DROP INDEX IF EXISTS idx_cards_rarity');
    db.exec('DROP INDEX IF EXISTS idx_cards_type_line');
    db.pragma('foreign_keys = ON');

    // 5. Import cards from downloaded file
    await importCardsFromFile(db, tmpFile, (current, total) => {
      onProgress(current, total, 'reading');
    });

    // 6. Create indexes
    onProgress(0, 0, 'indexing');
    createIndexes(db);

    // 7. Restore deck_cards (only for cards that exist in the new data)
    const restoreDeckCard = db.prepare(`
      INSERT OR IGNORE INTO deck_cards (deck_id, card_id, quantity, board)
      SELECT @deck_id, @card_id, @quantity, @board
      WHERE EXISTS (SELECT 1 FROM cards WHERE id = @card_id)
    `);
    const restoreMany = db.transaction((rows: typeof deckCards) => {
      for (const row of rows) {
        restoreDeckCard.run(row);
      }
    });
    restoreMany(deckCards);

    // 8. Restore cover_card_id where card still exists
    const restoreCover = db.prepare(`
      UPDATE decks SET cover_card_id = @cover_card_id
      WHERE id = @id AND EXISTS (SELECT 1 FROM cards WHERE id = @cover_card_id)
    `);
    for (const row of coverCards) {
      restoreCover.run(row);
    }

    onProgress(0, 0, 'done');
  } finally {
    // Clean up temp file
    fs.unlink(tmpFile, () => {});
  }
}
