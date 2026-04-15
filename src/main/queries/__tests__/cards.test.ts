import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { searchCards, getCard, getCardPrintings, getSets } from '../cards';
import { createTestDb, insertTestCard } from './helpers';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('searchCards', () => {
  it('returns all cards when no filters are applied', () => {
    insertTestCard(db, { name: 'Alpha' });
    insertTestCard(db, { name: 'Beta' });
    const result = searchCards(db, {});
    expect(result.total).toBe(2);
    expect(result.cards).toHaveLength(2);
  });

  it('filters by name query', () => {
    insertTestCard(db, { name: 'Lightning Bolt' });
    insertTestCard(db, { name: 'Counterspell' });
    const result = searchCards(db, { query: 'Lightning' });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Lightning Bolt');
  });

  it('filters by oracle_text query', () => {
    insertTestCard(db, { name: 'Bolt', oracle_text: 'deals 3 damage' });
    insertTestCard(db, { name: 'Counter', oracle_text: 'counter target spell' });
    const result = searchCards(db, { query: 'damage' });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Bolt');
  });

  describe('color filters', () => {
    beforeEach(() => {
      insertTestCard(db, { name: 'Red Card', color_identity: ['R'] });
      insertTestCard(db, { name: 'Blue Card', color_identity: ['U'] });
      insertTestCard(db, { name: 'Red-Blue Card', color_identity: ['R', 'U'] });
      insertTestCard(db, { name: 'Colorless Card', color_identity: [] });
    });

    it('include mode: returns cards that contain the color', () => {
      const result = searchCards(db, { colors: ['R'], colorMode: 'include' });
      const names = result.cards.map(c => c.name);
      expect(names).toContain('Red Card');
      expect(names).toContain('Red-Blue Card');
      expect(names).not.toContain('Blue Card');
    });

    it('exact mode: returns cards with exactly those colors', () => {
      const result = searchCards(db, { colors: ['R'], colorMode: 'exact' });
      const names = result.cards.map(c => c.name);
      expect(names).toContain('Red Card');
      expect(names).not.toContain('Red-Blue Card');
      expect(names).not.toContain('Blue Card');
    });

    it('at_most mode: returns cards using only those colors (including colorless)', () => {
      const result = searchCards(db, { colors: ['R'], colorMode: 'at_most' });
      const names = result.cards.map(c => c.name);
      expect(names).toContain('Red Card');
      expect(names).toContain('Colorless Card');
      expect(names).not.toContain('Red-Blue Card');
      expect(names).not.toContain('Blue Card');
    });
  });

  it('filters by rarity', () => {
    insertTestCard(db, { name: 'Common Card', rarity: 'common' });
    insertTestCard(db, { name: 'Rare Card', rarity: 'rare' });
    const result = searchCards(db, { rarity: ['rare'] });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Rare Card');
  });

  it('filters by multiple rarities', () => {
    insertTestCard(db, { name: 'Common Card', rarity: 'common' });
    insertTestCard(db, { name: 'Rare Card', rarity: 'rare' });
    insertTestCard(db, { name: 'Mythic Card', rarity: 'mythic' });
    const result = searchCards(db, { rarity: ['rare', 'mythic'] });
    expect(result.total).toBe(2);
  });

  it('filters by CMC range', () => {
    insertTestCard(db, { name: 'Cheap', cmc: 1 });
    insertTestCard(db, { name: 'Mid', cmc: 3 });
    insertTestCard(db, { name: 'Expensive', cmc: 7 });
    const result = searchCards(db, { cmcMin: 2, cmcMax: 5 });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Mid');
  });

  it('filters by format legality', () => {
    insertTestCard(db, {
      name: 'Legal Card',
      legalities: { standard: 'legal' },
    });
    insertTestCard(db, {
      name: 'Banned Card',
      legalities: { standard: 'banned' },
    });
    const result = searchCards(db, { format: 'standard' });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Legal Card');
  });

  it('filters by set', () => {
    insertTestCard(db, { name: 'Alpha Card', set_code: 'lea' });
    insertTestCard(db, { name: 'Beta Card', set_code: 'leb' });
    const result = searchCards(db, { sets: ['lea'] });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Alpha Card');
  });

  it('filters by type', () => {
    insertTestCard(db, { name: 'Dragon', type_line: 'Creature — Dragon' });
    insertTestCard(db, { name: 'Forest', type_line: 'Basic Land — Forest' });
    const result = searchCards(db, { types: ['Creature'] });
    expect(result.total).toBe(1);
    expect(result.cards[0].name).toBe('Dragon');
  });

  it('deduplicates by oracle_id when uniqueBy is set', () => {
    insertTestCard(db, { id: 'c1', oracle_id: 'o1', name: 'Bolt', released_at: '2020-01-01' });
    insertTestCard(db, { id: 'c2', oracle_id: 'o1', name: 'Bolt', released_at: '2021-01-01' });
    insertTestCard(db, { id: 'c3', oracle_id: 'o2', name: 'Counter', released_at: '2020-01-01' });
    const result = searchCards(db, { uniqueBy: 'oracle_id' });
    expect(result.total).toBe(2);
    expect(result.cards).toHaveLength(2);
  });

  it('paginates results', () => {
    insertTestCard(db, { name: 'Alpha' });
    insertTestCard(db, { name: 'Beta' });
    insertTestCard(db, { name: 'Gamma' });
    const page1 = searchCards(db, { pageSize: 2, page: 1 });
    const page2 = searchCards(db, { pageSize: 2, page: 2 });
    expect(page1.total).toBe(3);
    expect(page1.cards).toHaveLength(2);
    expect(page2.cards).toHaveLength(1);
  });

  it('falls back to name sort for invalid sortBy', () => {
    insertTestCard(db, { name: 'Zap' });
    insertTestCard(db, { name: 'Aardvark' });
    // Should not throw, and should sort by name
    const result = searchCards(db, { sortBy: 'invalid' as never });
    expect(result.cards[0].name).toBe('Aardvark');
  });
});

describe('getCard', () => {
  it('returns a card by id', () => {
    insertTestCard(db, { id: 'abc123', name: 'Lightning Bolt' });
    const card = getCard(db, 'abc123');
    expect(card).not.toBeNull();
    expect(card!.name).toBe('Lightning Bolt');
  });

  it('parses JSON fields correctly', () => {
    insertTestCard(db, { id: 'abc124', colors: ['R'], color_identity: ['R'], keywords: ['Flying'] });
    const card = getCard(db, 'abc124');
    expect(card!.colors).toEqual(['R']);
    expect(card!.color_identity).toEqual(['R']);
    expect(card!.keywords).toEqual(['Flying']);
  });

  it('returns null for a nonexistent id', () => {
    const card = getCard(db, 'nonexistent');
    expect(card).toBeNull();
  });
});

describe('getCardPrintings', () => {
  it('returns all printings for a given oracle_id sorted by released_at desc', () => {
    insertTestCard(db, { id: 'p1', oracle_id: 'o1', released_at: '2020-01-01' });
    insertTestCard(db, { id: 'p2', oracle_id: 'o1', released_at: '2022-01-01' });
    insertTestCard(db, { id: 'p3', oracle_id: 'o2', released_at: '2021-01-01' });
    const printings = getCardPrintings(db, 'o1');
    expect(printings).toHaveLength(2);
    expect(printings[0].id).toBe('p2'); // Most recent first
    expect(printings[1].id).toBe('p1');
  });

  it('returns empty array for unknown oracle_id', () => {
    expect(getCardPrintings(db, 'unknown')).toEqual([]);
  });
});

describe('getSets', () => {
  it('returns deduplicated set list sorted by name', () => {
    insertTestCard(db, { set_code: 'znr', set_name: 'Zendikar Rising' });
    insertTestCard(db, { set_code: 'znr', set_name: 'Zendikar Rising' });
    insertTestCard(db, { set_code: 'afr', set_name: 'Adventures in the Forgotten Realms' });
    const sets = getSets(db);
    expect(sets).toHaveLength(2);
    expect(sets[0].name).toBe('Adventures in the Forgotten Realms');
    expect(sets[1].code).toBe('znr');
  });

  it('returns empty array when no cards exist', () => {
    expect(getSets(db)).toEqual([]);
  });
});
