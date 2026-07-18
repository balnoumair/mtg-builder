import fs from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { app } from 'electron';
import type Database from 'better-sqlite3';
import { createIndexes } from './database';
import { dedupeCardPrints } from './dedupe';
import { VALID_LAYOUTS } from './queries/cards';

const STANDARD_SET_TYPES = new Set(['core', 'expansion']);

// Prints that only exist in side products sold next to a set (Foundations
// Beginner Box, Starter Collection set extension) rather than in the set's
// boosters. `booster: true` overrides these tags: main-set prints can carry
// them when the same print is also bundled in the side product.
const PRODUCT_ONLY_PROMO_TYPES = new Set(['beginnerbox', 'setextension']);

// Scryfall rejects requests without a real User-Agent and Accept header (HTTP 400).
// https://scryfall.com/docs/api — "Required Headers"
const SCRYFALL_HEADERS = {
  'User-Agent': `mtg-builder/${app.getVersion()}`,
  Accept: 'application/json',
};


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
  released_at?: string;
  artist?: string;
  booster?: boolean;
  digital?: boolean;
  promo?: boolean;
  variation?: boolean;
  full_art?: boolean;
  border_color?: string;
  frame_effects?: string[];
  promo_types?: string[];
}

interface BulkDataEntry {
  type: string;
  download_uri: string;
}

interface BulkDataResponse {
  data: BulkDataEntry[];
}

interface ScrySet {
  code: string;
  name: string;
  released_at?: string;
  block?: string;
  block_code?: string;
  icon_svg_uri?: string;
}

interface SetsResponse {
  data: ScrySet[];
  has_more?: boolean;
  next_page?: string;
}

interface SetMetadata {
  block_code: string | null;
  block_name: string | null;
  icon_svg_uri: string | null;
  name: string;
  released_at: string | null;
}

export type SetMetadataMap = Map<string, SetMetadata>;

async function fetchSetMetadata(): Promise<SetMetadataMap> {
  const map: SetMetadataMap = new Map();
  let url: string | undefined = 'https://api.scryfall.com/sets';
  while (url) {
    const res = await fetch(url, { headers: SCRYFALL_HEADERS });
    if (!res.ok) throw new Error(`Scryfall sets API error: ${res.status}`);
    const body = (await res.json()) as SetsResponse;
    for (const s of body.data) {
      map.set(s.code.toLowerCase(), {
        block_code: s.block_code || null,
        block_name: s.block || null,
        icon_svg_uri: s.icon_svg_uri || null,
        name: s.name,
        released_at: s.released_at || null,
      });
    }
    url = body.has_more ? body.next_page : undefined;
  }
  return map;
}

function syncSetsTable(db: Database.Database, setMetadata: SetMetadataMap): void {
  db.exec('DELETE FROM sets');
  const insertSet = db.prepare(`
    INSERT INTO sets (code, name, released_at, block_code, block_name, icon_svg_uri)
    VALUES (@code, @name, @released_at, @block_code, @block_name, @icon_svg_uri)
  `);
  const insertMany = db.transaction((rows: Array<{ code: string } & SetMetadata>) => {
    for (const row of rows) {
      insertSet.run(row);
    }
  });
  insertMany([...setMetadata.entries()].map(([code, meta]) => ({ code, ...meta })));
}

type ProgressCallback = (current: number, total: number, phase: 'downloading' | 'reading' | 'indexing' | 'done') => void;

async function fetchBulkDataUrl(): Promise<string> {
  const res = await fetch('https://api.scryfall.com/bulk-data', { headers: SCRYFALL_HEADERS });
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
    proto.get(url, { headers: { ...SCRYFALL_HEADERS, Accept: '*/*' } }, (res) => {
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

export function importCardsFromFile(
  db: Database.Database,
  filePath: string,
  setMetadata: SetMetadataMap,
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
        legalities, released_at, artist,
        block_code, block_name
      ) VALUES (
        @id, @oracle_id, @name, @mana_cost, @cmc, @type_line, @oracle_text,
        @colors, @color_identity, @keywords, @power, @toughness,
        @rarity, @set_code, @set_name, @collector_number, @layout,
        @image_uri_small, @image_uri_normal, @image_uri_large, @image_uri_art_crop,
        @face_back_name, @face_back_image_uri_normal,
        @legalities, @released_at, @artist,
        @block_code, @block_name
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
      // Digital-only prints (Arena Alchemy rebalances) are not paper cards.
      if (value.digital) return;
      if (
        value.booster !== true &&
        value.promo_types?.some((t) => PRODUCT_ONLY_PROMO_TYPES.has(t))
      ) return;
      // Variant prints (showcase frames, special foils, …) are imported here
      // and collapsed afterwards by dedupeCardPrints.

      const faces = value.card_faces;
      const frontFace = faces?.[0];
      const backFace = faces?.[1];

      const imageUris = value.image_uris || frontFace?.image_uris;
      const oracleText = value.oracle_text ?? frontFace?.oracle_text ?? '';
      const manaCost = value.mana_cost ?? frontFace?.mana_cost ?? '';
      const typeLine = value.type_line ?? frontFace?.type_line ?? '';

      const blockInfo = value.set ? setMetadata.get(value.set.toLowerCase()) : undefined;

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
        released_at: value.released_at || '',
        artist: value.artist || '',
        block_code: blockInfo?.block_code ?? null,
        block_name: blockInfo?.block_name ?? null,
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
  // 1. Fetch the download URL from Scryfall bulk data API and set metadata
  const [downloadUrl, setMetadata] = await Promise.all([fetchBulkDataUrl(), fetchSetMetadata()]);

  // 2. Download the file to a temp location
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `scryfall-bulk-${Date.now()}.json`);

  try {
    await downloadFile(downloadUrl, tmpFile, (downloaded, total) => {
      onProgress(downloaded, total, 'downloading');
    });

    // 3. Back up deck contents, the collection, and deck covers before wiping
    // cards. Print ids can change between syncs, so each backup row also
    // records oracle_id and set_code: restore prefers the exact print, then
    // the same card in the same set, then any print of that card.
    const deckCards = db.prepare(`
      SELECT dc.deck_id, dc.card_id, c.oracle_id, c.set_code,
             dc.quantity, dc.owned_quantity, dc.ignore_copy_limit, dc.board
      FROM deck_cards dc JOIN cards c ON c.id = dc.card_id
    `).all() as Array<{
      deck_id: number;
      card_id: string;
      oracle_id: string;
      set_code: string;
      quantity: number;
      owned_quantity: number | null;
      ignore_copy_limit: number;
      board: string;
    }>;
    const collectionCards = db.prepare(`
      SELECT col.card_id, c.oracle_id, c.set_code, col.quantity, col.added_at
      FROM collection col JOIN cards c ON c.id = col.card_id
    `).all() as Array<{
      card_id: string;
      oracle_id: string;
      set_code: string;
      quantity: number;
      added_at: string | null;
    }>;
    const coverCards = db.prepare(`
      SELECT d.id, d.cover_card_id AS card_id, c.oracle_id, c.set_code
      FROM decks d JOIN cards c ON c.id = d.cover_card_id
      WHERE d.cover_card_id IS NOT NULL
    `).all() as Array<{
      id: number;
      card_id: string;
      oracle_id: string;
      set_code: string;
    }>;

    // 4. Disable FK, delete all cards (avoids cascade), re-enable FK
    db.pragma('foreign_keys = OFF');
    db.exec('DELETE FROM deck_cards');
    db.exec('DELETE FROM collection');
    db.exec('DELETE FROM cards');
    db.exec('DROP INDEX IF EXISTS idx_cards_name');
    db.exec('DROP INDEX IF EXISTS idx_cards_oracle_id');
    db.exec('DROP INDEX IF EXISTS idx_cards_set_code');
    db.exec('DROP INDEX IF EXISTS idx_cards_cmc');
    db.exec('DROP INDEX IF EXISTS idx_cards_rarity');
    db.exec('DROP INDEX IF EXISTS idx_cards_type_line');
    db.pragma('foreign_keys = ON');

    // 5. Import cards from downloaded file
    await importCardsFromFile(db, tmpFile, setMetadata, (current, total) => {
      onProgress(current, total, 'reading');
    });

    // 6. Sync set metadata (including edition icons)
    syncSetsTable(db, setMetadata);

    // 7. Create indexes
    onProgress(0, 0, 'indexing');
    createIndexes(db);

    // 8. Restore decks/collection while every set still has its prints, so
    // set_code matching can land on the right set (not a newer reprint).
    const survivorSql = `
      COALESCE(
        (SELECT id FROM cards WHERE id = @card_id),
        (SELECT id FROM cards WHERE oracle_id = @oracle_id AND set_code = @set_code
           ORDER BY CAST(collector_number AS INTEGER) ASC, collector_number ASC LIMIT 1),
        (SELECT id FROM cards WHERE oracle_id = @oracle_id
           ORDER BY released_at DESC, CAST(collector_number AS INTEGER) ASC LIMIT 1)
      )
    `;
    const restoreDeckCard = db.prepare(`
      INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, ignore_copy_limit, board)
      SELECT @deck_id, target.id, @quantity, @owned_quantity, @ignore_copy_limit, @board
      FROM (SELECT ${survivorSql} AS id) target
      WHERE target.id IS NOT NULL
      ON CONFLICT(deck_id, card_id, board) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        owned_quantity = CASE
          WHEN owned_quantity IS NULL AND excluded.owned_quantity IS NULL THEN NULL
          ELSE COALESCE(owned_quantity, 0) + COALESCE(excluded.owned_quantity, 0)
        END,
        ignore_copy_limit = MAX(ignore_copy_limit, excluded.ignore_copy_limit)
    `);
    const restoreCollectionCard = db.prepare(`
      INSERT INTO collection (card_id, quantity, added_at)
      SELECT target.id, @quantity, @added_at
      FROM (SELECT ${survivorSql} AS id) target
      WHERE target.id IS NOT NULL
      ON CONFLICT(card_id) DO UPDATE SET
        quantity = quantity + excluded.quantity,
        added_at = MIN(added_at, excluded.added_at)
    `);
    const restoreMany = db.transaction(() => {
      for (const row of deckCards) {
        restoreDeckCard.run(row);
      }
      for (const row of collectionCards) {
        restoreCollectionCard.run(row);
      }
    });
    restoreMany();

    // 9. Restore deck covers (cleared when the card left the data entirely)
    const restoreCover = db.prepare(`
      UPDATE decks SET cover_card_id = ${survivorSql} WHERE id = @id
    `);
    for (const row of coverCards) {
      restoreCover.run(row);
    }

    // 10. Collapse variant arts within each set only (not across sets)
    dedupeCardPrints(db);

    // 11. Reclaim free pages left by the DELETE + reinsert; without this the
    // file grows by the full dataset size on every sync.
    db.exec('VACUUM');

    onProgress(0, 0, 'done');
  } finally {
    // Clean up temp file
    fs.unlink(tmpFile, () => {});
  }
}
