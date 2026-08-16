import { describe, it, expect } from 'vitest';
import {
  colorsToEmoji,
  emojiToColors,
  matchBlockLabel,
  SHEET_BLOCK_SETS,
  type SheetBlock,
} from '../blockMap';

const blocks: SheetBlock[] = Object.entries(SHEET_BLOCK_SETS).map(([label, setCodes], i) => ({
  label,
  position: i,
  setCodes,
}));

describe('color conversion', () => {
  it('renders colors in WUBRG order regardless of input order', () => {
    expect(colorsToEmoji(['G', 'B'])).toBe('⚫🟢');
    expect(colorsToEmoji(['R', 'W'])).toBe('⚪🔴');
  });

  it('renders colorless as an empty string', () => {
    expect(colorsToEmoji([])).toBe('');
  });

  it('round-trips through the sheet notation', () => {
    expect(emojiToColors(colorsToEmoji(['W', 'U', 'B', 'R', 'G']))).toEqual([
      'W', 'U', 'B', 'R', 'G',
    ]);
  });

  it('ignores unknown symbols in the sheet cell', () => {
    expect(emojiToColors('⚫? 🟢')).toEqual(['B', 'G']);
  });
});

describe('matchBlockLabel', () => {
  it('maps a single-set deck to its Spanish label', () => {
    expect(matchBlockLabel(['blb'], blocks)).toBe('Bloomburrow');
    expect(matchBlockLabel(['woe'], blocks)).toBe('Las tierras salvajes de Eldraine');
  });

  it('maps a deck spanning a block to the block label', () => {
    expect(matchBlockLabel(['mid', 'vow'], blocks)).toBe(
      'Innistrad: Midnight Hunt / Crimsom Vow (Bloque)',
    );
  });

  it('matches bonus sheets folded into their parent label', () => {
    expect(matchBlockLabel(['woe', 'wot'], blocks)).toBe('Las tierras salvajes de Eldraine');
    expect(matchBlockLabel(['stx', 'sta'], blocks)).toBe('Strixhaven: Escuela de magos');
  });

  it('is case-insensitive about set codes', () => {
    expect(matchBlockLabel(['BLB'], blocks)).toBe('Bloomburrow');
  });

  it('returns null when sets span unrelated blocks', () => {
    expect(matchBlockLabel(['blb', 'woe'], blocks)).toBeNull();
  });

  it('returns null for a deck with no sets', () => {
    expect(matchBlockLabel([], blocks)).toBeNull();
  });

  it('prefers the most specific label when several cover the deck', () => {
    const overlapping: SheetBlock[] = [
      { label: 'Broad', position: 0, setCodes: ['mid', 'vow', 'neo'] },
      { label: 'Narrow', position: 1, setCodes: ['mid', 'vow'] },
    ];
    expect(matchBlockLabel(['mid'], overlapping)).toBe('Narrow');
  });
});
