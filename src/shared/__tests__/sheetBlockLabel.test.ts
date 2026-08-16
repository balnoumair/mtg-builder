import { describe, it, expect } from 'vitest';
import { englishBlockLabel, type SetNameInfo } from '../sheetBlockLabel';

const sets = new Map<string, SetNameInfo>([
  ['blb', { code: 'blb', name: 'Bloomburrow', block_name: null }],
  ['woe', { code: 'woe', name: 'Wilds of Eldraine', block_name: null }],
  ['wot', { code: 'wot', name: 'Wilds of Eldraine: Enchanting Tales', block_name: null }],
  ['mid', { code: 'mid', name: 'Innistrad: Midnight Hunt', block_name: null }],
  ['vow', { code: 'vow', name: 'Innistrad: Crimson Vow', block_name: null }],
  ['ice', { code: 'ice', name: 'Ice Age', block_name: 'Ice Age' }],
  ['all', { code: 'all', name: 'Alliances', block_name: 'Ice Age' }],
  ['csp', { code: 'csp', name: 'Coldsnap', block_name: 'Ice Age' }],
]);

describe('englishBlockLabel', () => {
  it('translates a single-set label', () => {
    expect(englishBlockLabel('Bloomburrow', ['blb'], sets)).toBe('Bloomburrow');
  });

  it('uses the shared block name when every set belongs to one block', () => {
    expect(englishBlockLabel('Era Glacial (Bloque)', ['ice', 'all', 'csp'], sets)).toBe('Ice Age');
  });

  it('keeps every set name for a real multi-set block with no Scryfall block', () => {
    expect(
      englishBlockLabel('Innistrad: Midnight Hunt / Crimsom Vow (Bloque)', ['mid', 'vow'], sets),
    ).toBe('Innistrad: Midnight Hunt · Innistrad: Crimson Vow');
  });

  it('shows only the parent set when a bonus sheet is folded in', () => {
    expect(englishBlockLabel('Las tierras salvajes de Eldraine', ['woe', 'wot'], sets)).toBe(
      'Wilds of Eldraine',
    );
  });

  it('falls back to the sheet wording for an unmapped label', () => {
    expect(englishBlockLabel('Bloque inventado', [], sets)).toBe('Bloque inventado');
  });

  it('falls back when the sets are not in the local database yet', () => {
    expect(englishBlockLabel('Edición futura', ['zzz'], sets)).toBe('Edición futura');
  });

  it('ignores unknown codes but still translates the known ones', () => {
    expect(englishBlockLabel('Bloomburrow', ['blb', 'zzz'], sets)).toBe('Bloomburrow');
  });

  it('matches set codes case-insensitively', () => {
    expect(englishBlockLabel('Bloomburrow', ['BLB'], sets)).toBe('Bloomburrow');
  });
});
