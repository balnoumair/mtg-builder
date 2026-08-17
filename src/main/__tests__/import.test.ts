import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { gzipSync } from 'node:zlib';
import type Database from 'better-sqlite3';
import { createTestDb } from '../queries/__tests__/helpers';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    getPath: () => os.tmpdir(),
  },
}));

const { importCardsFromFile, syncCards } = await import('../import');
const { dedupeCardPrints } = await import('../dedupe');

interface BulkCardOverrides {
  id?: string;
  oracle_id?: string;
  name?: string;
  lang?: string;
  layout?: string;
  set?: string;
  set_type?: string;
  collector_number?: string;
  released_at?: string;
  type_line?: string;
  mana_cost?: string;
  booster?: boolean;
  digital?: boolean;
  promo_types?: string[];
  image_uris?: { normal?: string };
  card_faces?: Array<{ name?: string; mana_cost?: string; type_line?: string; oracle_text?: string }>;
}

let cardSeq = 0;

function bulkCard(overrides: BulkCardOverrides = {}) {
  cardSeq += 1;
  return {
    id: `id-${cardSeq}`,
    oracle_id: `oracle-${cardSeq}`,
    name: `Card ${cardSeq}`,
    lang: 'en',
    layout: 'normal',
    set: 'aaa',
    set_name: 'Test Set',
    set_type: 'core',
    collector_number: String(cardSeq),
    released_at: '2024-01-01',
    type_line: 'Sorcery',
    booster: true,
    digital: false,
    ...overrides,
  };
}

function writeBulkFile(cards: object[]): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bulk-test-')), 'cards.json');
  const lines = ['[', ...cards.map((c, i) => JSON.stringify(c) + (i < cards.length - 1 ? ',' : '')), ']'];
  fs.writeFileSync(file, lines.join('\n'));
  return file;
}

async function importCards(db: Database.Database, cards: object[]): Promise<void> {
  await importCardsFromFile(db, writeBulkFile(cards), new Map(), () => {});
}

function cardNames(db: Database.Database): string[] {
  return (db.prepare('SELECT name FROM cards ORDER BY name').all() as Array<{ name: string }>).map((r) => r.name);
}

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('importCardsFromFile filters', () => {
  it('imports plain main-set prints', async () => {
    await importCards(db, [bulkCard({ name: 'Plain' })]);
    expect(cardNames(db)).toEqual(['Plain']);
  });

  it('keeps booster prints even when tagged as bundled in side products', async () => {
    await importCards(db, [
      bulkCard({ name: 'Starter Tagged', booster: true, promo_types: ['startercollection'] }),
      bulkCard({ name: 'Beginner Tagged', booster: true, promo_types: ['beginnerbox', 'startercollection'] }),
    ]);
    expect(cardNames(db)).toEqual(['Beginner Tagged', 'Starter Tagged']);
  });

  it('excludes product-only prints that are not found in boosters', async () => {
    await importCards(db, [
      bulkCard({ name: 'Beginner Only', booster: false, promo_types: ['beginnerbox', 'startercollection'] }),
      bulkCard({ name: 'Extension Only', booster: false, promo_types: ['setextension'] }),
    ]);
    expect(cardNames(db)).toEqual([]);
  });

  it('keeps tagged prints from sets where booster is always false (2026+ sets)', async () => {
    await importCards(db, [
      bulkCard({ name: 'UB Print', set_type: 'expansion', booster: false, promo_types: ['universesbeyond'] }),
    ]);
    expect(cardNames(db)).toEqual(['UB Print']);
  });

  it('excludes digital-only prints', async () => {
    await importCards(db, [bulkCard({ name: 'Rebalanced', digital: true, promo_types: ['alchemy', 'rebalanced'] })]);
    expect(cardNames(db)).toEqual([]);
  });

  it('excludes non-English prints and non-standard set types', async () => {
    await importCards(db, [
      bulkCard({ name: 'Non English', lang: 'ja' }),
      bulkCard({ name: 'Commander Set Card', set_type: 'commander' }),
    ]);
    expect(cardNames(db)).toEqual([]);
  });

  it('imports prepare-layout cards (SOS), using the front face for oracle_text and the top-level image', async () => {
    // Shape confirmed against the live Scryfall API: prepare cards carry a
    // single combined image_uris/mana_cost/type_line at the top level (like
    // split/adventure), while card_faces only carry name/oracle_text/etc per side.
    await importCards(db, [
      bulkCard({
        name: 'Abigale, Poet Laureate // Heroic Stanza',
        set: 'sos',
        set_type: 'expansion',
        layout: 'prepare',
        collector_number: '170',
        mana_cost: '{1}{W}{B} // {1}{W/B}',
        type_line: 'Legendary Creature — Bird Bard // Sorcery',
        image_uris: { normal: 'https://cards.scryfall.io/normal/front/abigale.jpg' },
        card_faces: [
          {
            name: 'Abigale, Poet Laureate',
            mana_cost: '{1}{W}{B}',
            type_line: 'Legendary Creature — Bird Bard',
            oracle_text: 'Flying\nWhenever you cast a creature spell, Abigale becomes prepared.',
          },
          {
            name: 'Heroic Stanza',
            mana_cost: '{1}{W/B}',
            type_line: 'Sorcery',
            oracle_text: 'Put a +1/+1 counter on target creature.',
          },
        ],
      }),
    ]);

    const row = db.prepare(
      'SELECT mana_cost, type_line, oracle_text, image_uri_normal, face_back_name FROM cards'
    ).get() as {
      mana_cost: string;
      type_line: string;
      oracle_text: string;
      image_uri_normal: string | null;
      face_back_name: string | null;
    };

    expect(row.mana_cost).toBe('{1}{W}{B} // {1}{W/B}');
    expect(row.type_line).toBe('Legendary Creature — Bird Bard // Sorcery');
    expect(row.oracle_text).toBe('Flying\nWhenever you cast a creature spell, Abigale becomes prepared.');
    expect(row.image_uri_normal).toBe('https://cards.scryfall.io/normal/front/abigale.jpg');
    expect(row.face_back_name).toBe('Heroic Stanza');
  });
});

describe('syncCards', () => {
  it('imports the current gzip-compressed JSONL bulk format', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/gzip' });
      res.end(gzipSync(`${JSON.stringify(bulkCard({ name: 'Current bulk card' }))}\n`));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    try {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not start');
      const downloadUrl = `http://127.0.0.1:${address.port}/default-cards.jsonl.gz`;

      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ type: 'default_cards', jsonl_download_uri: downloadUrl }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        }));

      await syncCards(db, () => {});

      expect(cardNames(db)).toEqual(['Current bulk card']);
    } finally {
      vi.unstubAllGlobals();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});

describe('dedupeCardPrints', () => {
  it('keeps reprints across different sets (only collapses arts within a set)', async () => {
    await importCards(db, [
      bulkCard({ name: 'Reprint', oracle_id: 'o-1', set: 'aaa', released_at: '2020-01-01' }),
      bulkCard({ name: 'Reprint', oracle_id: 'o-1', set: 'bbb', set_type: 'expansion', released_at: '2023-06-01' }),
    ]);
    dedupeCardPrints(db);
    const rows = db.prepare('SELECT set_code FROM cards ORDER BY set_code').all() as Array<{ set_code: string }>;
    expect(rows).toEqual([{ set_code: 'aaa' }, { set_code: 'bbb' }]);
  });

  it('prefers the lowest-numbered print within the same set, numerically', async () => {
    await importCards(db, [
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '300' }),
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '42' }),
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '381', promo_types: ['boosterfun'] }),
    ]);
    dedupeCardPrints(db);
    const rows = db.prepare('SELECT collector_number FROM cards').all() as Array<{ collector_number: string }>;
    expect(rows).toEqual([{ collector_number: '42' }]);
  });

  it('keeps one basic land print per set, dropping variant arts within a set', async () => {
    await importCards(db, [
      bulkCard({ name: 'Basic', oracle_id: 'o-1', type_line: 'Basic Land — Basic', set: 'aaa', collector_number: '262' }),
      bulkCard({ name: 'Basic', oracle_id: 'o-1', type_line: 'Basic Land — Basic', set: 'aaa', collector_number: '263' }),
      bulkCard({ name: 'Basic', oracle_id: 'o-1', type_line: 'Basic Land — Basic', set: 'bbb', set_type: 'expansion', collector_number: '90' }),
    ]);
    dedupeCardPrints(db);
    const rows = db.prepare('SELECT set_code, collector_number FROM cards ORDER BY set_code').all();
    expect(rows).toEqual([
      { set_code: 'aaa', collector_number: '262' },
      { set_code: 'bbb', collector_number: '90' },
    ]);
  });

  it('re-points a variant basic land at its own set’s plain print, not another set’s', async () => {
    await importCards(db, [
      bulkCard({ id: 'aaa-plain', name: 'Basic', oracle_id: 'o-1', type_line: 'Basic Land — Basic', set: 'aaa', collector_number: '262', released_at: '2020-01-01' }),
      bulkCard({ id: 'aaa-art', name: 'Basic', oracle_id: 'o-1', type_line: 'Basic Land — Basic', set: 'aaa', collector_number: '263', released_at: '2020-01-01' }),
      bulkCard({ id: 'bbb-plain', name: 'Basic', oracle_id: 'o-1', type_line: 'Basic Land — Basic', set: 'bbb', set_type: 'expansion', collector_number: '90', released_at: '2023-01-01' }),
    ]);
    db.prepare("INSERT INTO decks (id, name) VALUES (1, 'Deck')").run();
    db.prepare("INSERT INTO deck_cards (deck_id, card_id, quantity, board) VALUES (1, 'aaa-art', 8, 'main')").run();

    dedupeCardPrints(db);

    const rows = db.prepare('SELECT card_id, quantity FROM deck_cards').all();
    expect(rows).toEqual([{ card_id: 'aaa-plain', quantity: 8 }]);
  });

  it('is a no-op when every card already has a single print', async () => {
    await importCards(db, [bulkCard({ name: 'Solo' }), bulkCard({ name: 'Other' })]);
    expect(dedupeCardPrints(db)).toBe(0);
    expect(cardNames(db)).toEqual(['Other', 'Solo']);
  });

  it('re-points deck entries at the surviving print within the same set and merges duplicates', async () => {
    await importCards(db, [
      bulkCard({ id: 'variant', oracle_id: 'o-1', name: 'Dupe', set: 'aaa', collector_number: '300', released_at: '2020-01-01' }),
      bulkCard({ id: 'plain', oracle_id: 'o-1', name: 'Dupe', set: 'aaa', collector_number: '42', released_at: '2020-01-01' }),
      bulkCard({ id: 'other-set', oracle_id: 'o-1', name: 'Dupe', set: 'bbb', set_type: 'expansion', collector_number: '10', released_at: '2023-01-01' }),
    ]);
    db.prepare("INSERT INTO decks (id, name, cover_card_id) VALUES (1, 'Deck', 'variant')").run();
    db.prepare(
      "INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, board) VALUES (1, 'variant', 2, 1, 'main')"
    ).run();
    db.prepare(
      "INSERT INTO deck_cards (deck_id, card_id, quantity, owned_quantity, board) VALUES (1, 'plain', 1, NULL, 'main')"
    ).run();

    dedupeCardPrints(db);

    const rows = db.prepare('SELECT card_id, quantity, owned_quantity FROM deck_cards ORDER BY card_id').all();
    expect(rows).toEqual([{ card_id: 'plain', quantity: 3, owned_quantity: 1 }]);
    const deck = db.prepare('SELECT cover_card_id FROM decks WHERE id = 1').get() as { cover_card_id: string };
    expect(deck.cover_card_id).toBe('plain');
    const sets = db.prepare('SELECT set_code FROM cards ORDER BY set_code').all();
    expect(sets).toEqual([{ set_code: 'aaa' }, { set_code: 'bbb' }]);
  });

  it('re-points collection rows at the surviving print within the same set and merges quantities', async () => {
    await importCards(db, [
      bulkCard({ id: 'variant', oracle_id: 'o-1', name: 'Dupe', set: 'aaa', collector_number: '300' }),
      bulkCard({ id: 'plain', oracle_id: 'o-1', name: 'Dupe', set: 'aaa', collector_number: '42' }),
      bulkCard({ id: 'other-set', oracle_id: 'o-1', name: 'Dupe', set: 'bbb', set_type: 'expansion', collector_number: '10' }),
    ]);
    db.prepare("INSERT INTO collection (card_id, quantity) VALUES ('variant', 3)").run();
    db.prepare("INSERT INTO collection (card_id, quantity) VALUES ('plain', 1)").run();
    db.prepare("INSERT INTO collection (card_id, quantity) VALUES ('other-set', 2)").run();

    dedupeCardPrints(db);

    const rows = db.prepare('SELECT card_id, quantity FROM collection ORDER BY card_id').all();
    expect(rows).toEqual([
      { card_id: 'other-set', quantity: 2 },
      { card_id: 'plain', quantity: 4 },
    ]);
  });
});
