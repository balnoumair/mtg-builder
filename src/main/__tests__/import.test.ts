import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type Database from 'better-sqlite3';
import { createTestDb } from '../queries/__tests__/helpers';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    getPath: () => os.tmpdir(),
  },
}));

const { importCardsFromFile, dedupeCardPrints } = await import('../import');

interface BulkCardOverrides {
  id?: string;
  oracle_id?: string;
  name?: string;
  lang?: string;
  layout?: string;
  set?: string;
  set_type?: string;
  collector_number?: string;
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

describe('dedupeCardPrints', () => {
  it('keeps only the lowest-numbered print of a card within a set', async () => {
    await importCards(db, [
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '112' }),
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '327', promo_types: ['boosterfun'] }),
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '381', promo_types: ['manafoil', 'boosterfun'] }),
    ]);
    dedupeCardPrints(db);
    const rows = db.prepare('SELECT collector_number FROM cards').all() as Array<{ collector_number: string }>;
    expect(rows).toEqual([{ collector_number: '112' }]);
  });

  it('orders collector numbers numerically, not lexically', async () => {
    await importCards(db, [
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '300' }),
      bulkCard({ name: 'Dupe', oracle_id: 'o-1', collector_number: '42' }),
    ]);
    dedupeCardPrints(db);
    const rows = db.prepare('SELECT collector_number FROM cards').all() as Array<{ collector_number: string }>;
    expect(rows).toEqual([{ collector_number: '42' }]);
  });

  it('keeps the same card across different sets', async () => {
    await importCards(db, [
      bulkCard({ name: 'Reprint', oracle_id: 'o-1', set: 'aaa', collector_number: '10' }),
      bulkCard({ name: 'Reprint', oracle_id: 'o-1', set: 'bbb', set_type: 'expansion', collector_number: '20' }),
    ]);
    dedupeCardPrints(db);
    expect(cardNames(db)).toEqual(['Reprint', 'Reprint']);
  });

  it('keeps every basic land art', async () => {
    await importCards(db, [
      bulkCard({ name: 'Plains', oracle_id: 'o-1', type_line: 'Basic Land — Plains', collector_number: '262' }),
      bulkCard({ name: 'Plains', oracle_id: 'o-1', type_line: 'Basic Land — Plains', collector_number: '263' }),
    ]);
    dedupeCardPrints(db);
    expect(cardNames(db)).toEqual(['Plains', 'Plains']);
  });
});
