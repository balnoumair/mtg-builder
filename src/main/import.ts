import fs from 'node:fs';
import readline from 'node:readline';
import type Database from 'better-sqlite3';
import { createIndexes } from './database';
import { VALID_LAYOUTS } from './queries/cards';

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

type ProgressCallback = (current: number, total: number) => void;

export function importCards(
  db: Database.Database,
  filePath: string,
  onProgress: ProgressCallback
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
      // Strip leading [ or trailing ] or comma
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
      createIndexes(db);
      resolve();
    });

    rl.on('error', (err: Error) => {
      reject(err);
    });
  });
}
