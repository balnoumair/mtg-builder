import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, insertTestCard } from './helpers';
import {
  createTag,
  deleteTag,
  getTags,
  getTagsByDeck,
  setDeckTags,
  updateTag,
} from '../tags';
import { createDeck, getDecks, addCardToDeck } from '../decks';
import { TAG_COLOR_KEYS } from '../../../shared/tagColors';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('createTag', () => {
  it('assigns an unused palette colour to each new tag', () => {
    const colors = TAG_COLOR_KEYS.map((_, i) => createTag(db, { name: `tag-${i}` }).color);
    expect(new Set(colors).size).toBe(TAG_COLOR_KEYS.length);
  });

  it('reuses the least-used colour once the palette is exhausted', () => {
    for (let i = 0; i < TAG_COLOR_KEYS.length; i++) createTag(db, { name: `tag-${i}` });
    const extra = createTag(db, { name: 'one-past-the-palette' });
    expect(TAG_COLOR_KEYS).toContain(extra.color);
  });

  it('returns the existing tag when the name is already taken, ignoring case', () => {
    const first = createTag(db, { name: 'Sealed Pool' });
    const again = createTag(db, { name: 'sealed pool' });

    expect(again.id).toBe(first.id);
    expect(again.name).toBe('Sealed Pool');
    expect(getTags(db)).toHaveLength(1);
  });

  it('trims surrounding whitespace and rejects a blank name', () => {
    expect(createTag(db, { name: '  spaced  ' }).name).toBe('spaced');
    expect(() => createTag(db, { name: '   ' })).toThrow(/required/i);
  });

  it('honours an explicit colour and falls back for an unknown one', () => {
    expect(createTag(db, { name: 'explicit', color: 'plum' }).color).toBe('plum');
    expect(TAG_COLOR_KEYS).toContain(createTag(db, { name: 'bogus', color: 'chartreuse' }).color);
  });
});

describe('updateTag', () => {
  it('renames a tag', () => {
    const tag = createTag(db, { name: 'before' });
    expect(updateTag(db, tag.id, { name: 'after' }).name).toBe('after');
  });

  it('refuses a name another tag already holds', () => {
    createTag(db, { name: 'taken' });
    const other = createTag(db, { name: 'free' });
    expect(() => updateTag(db, other.id, { name: 'TAKEN' })).toThrow(/already exists/i);
  });

  it('lets a tag keep its own name', () => {
    const tag = createTag(db, { name: 'stable' });
    expect(updateTag(db, tag.id, { name: 'stable', color: 'teal' }).color).toBe('teal');
  });

  it('ignores a colour outside the palette', () => {
    const tag = createTag(db, { name: 'coloured', color: 'moss' });
    expect(updateTag(db, tag.id, { color: 'not-a-colour' }).color).toBe('moss');
  });
});

describe('setDeckTags', () => {
  it('replaces the deck tag set rather than adding to it', () => {
    const deck = createDeck(db, { name: 'Deck' });
    const a = createTag(db, { name: 'a' });
    const b = createTag(db, { name: 'b' });
    const c = createTag(db, { name: 'c' });

    setDeckTags(db, deck.id, [a.id, b.id]);
    setDeckTags(db, deck.id, [c.id]);

    expect(getTagsByDeck(db).get(deck.id)?.map((t) => t.name)).toEqual(['c']);
  });

  it('collapses duplicate ids in one call', () => {
    const deck = createDeck(db, { name: 'Deck' });
    const tag = createTag(db, { name: 'once' });

    setDeckTags(db, deck.id, [tag.id, tag.id]);

    expect(getTagsByDeck(db).get(deck.id)).toHaveLength(1);
  });

  it('clears every tag when given an empty list', () => {
    const deck = createDeck(db, { name: 'Deck' });
    setDeckTags(db, deck.id, [createTag(db, { name: 'temporary' }).id]);

    setDeckTags(db, deck.id, []);

    expect(getTagsByDeck(db).has(deck.id)).toBe(false);
  });
});

describe('tag lifecycle', () => {
  it('counts the decks carrying each tag', () => {
    const shared = createTag(db, { name: 'shared' });
    const lonely = createTag(db, { name: 'lonely' });
    setDeckTags(db, createDeck(db, { name: 'One' }).id, [shared.id]);
    setDeckTags(db, createDeck(db, { name: 'Two' }).id, [shared.id, lonely.id]);

    const counts = Object.fromEntries(getTags(db).map((t) => [t.name, t.deck_count]));
    expect(counts).toEqual({ shared: 2, lonely: 1 });
  });

  it('detaches a deleted tag from its decks and leaves the decks alone', () => {
    const deck = createDeck(db, { name: 'Survivor' });
    const tag = createTag(db, { name: 'doomed' });
    setDeckTags(db, deck.id, [tag.id]);

    deleteTag(db, tag.id);

    expect(getTags(db)).toHaveLength(0);
    expect(getTagsByDeck(db).has(deck.id)).toBe(false);
    expect(getDecks(db).map((d) => d.name)).toEqual(['Survivor']);
  });

  it('drops tag links when the deck is deleted', () => {
    const deck = createDeck(db, { name: 'Doomed' });
    const tag = createTag(db, { name: 'orphan-check' });
    setDeckTags(db, deck.id, [tag.id]);

    db.prepare('DELETE FROM decks WHERE id = ?').run(deck.id);

    expect(getTags(db)[0].deck_count).toBe(0);
  });

  it('sorts a deck\'s tags by name regardless of attachment order', () => {
    const deck = createDeck(db, { name: 'Deck' });
    const zeta = createTag(db, { name: 'zeta' });
    const alpha = createTag(db, { name: 'alpha' });

    setDeckTags(db, deck.id, [zeta.id, alpha.id]);

    expect(getTagsByDeck(db).get(deck.id)?.map((t) => t.name)).toEqual(['alpha', 'zeta']);
  });
});

describe('getDecks', () => {
  it('carries each deck\'s tags, and an empty list for untagged decks', () => {
    const tagged = createDeck(db, { name: 'Tagged' });
    createDeck(db, { name: 'Untagged' });
    const cardId = insertTestCard(db);
    addCardToDeck(db, tagged.id, cardId);
    setDeckTags(db, tagged.id, [createTag(db, { name: 'carried' }).id]);

    const byName = Object.fromEntries(getDecks(db).map((d) => [d.name, d.tags]));
    expect(byName.Tagged?.map((t) => t.name)).toEqual(['carried']);
    expect(byName.Untagged).toEqual([]);
  });
});
