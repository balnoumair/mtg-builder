import { describe, it, expect } from 'vitest';
import { deckSearchDefaults } from '../useDeckEditorCards';
import type { Deck } from '../../../shared/types';

const deck = (overrides: Partial<Deck>) => ({ id: 1, name: 'Deck', ...overrides }) as Deck;

describe('deckSearchDefaults', () => {
  it('starts from the deck sets and colors, plus colorless and multicolor', () => {
    expect(deckSearchDefaults(deck({ search_sets: ['aaa', 'bbb'], color_identity: ['W', 'B'] }))).toEqual({
      sets: ['aaa', 'bbb'],
      colors: ['W', 'B'],
      colorCategories: ['multicolor', 'colorless'],
    });
  });

  it('leaves sets and colors unfiltered when the deck has none', () => {
    expect(deckSearchDefaults(deck({ search_sets: [], color_identity: [] }))).toEqual({});
    expect(deckSearchDefaults(undefined)).toEqual({});
  });

  it('derives each axis independently', () => {
    expect(deckSearchDefaults(deck({ search_sets: [], color_identity: ['G'] }))).toEqual({
      colors: ['G'],
      colorCategories: ['multicolor', 'colorless'],
    });
    expect(deckSearchDefaults(deck({ search_sets: ['aaa'], color_identity: [] }))).toEqual({ sets: ['aaa'] });
  });
});
