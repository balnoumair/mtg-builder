import { describe, it, expect } from 'vitest';
import { colorComboKey, colorComboName, countDecksByColorCombo } from '../colorCombos';

describe('colorComboKey', () => {
  it('orders colors WUBRG regardless of input order', () => {
    expect(colorComboKey(['G', 'W'])).toBe('WG');
    expect(colorComboKey(['R', 'B', 'U'])).toBe('UBR');
  });

  it('treats missing or empty identity as colorless', () => {
    expect(colorComboKey(undefined)).toBe('');
    expect(colorComboKey([])).toBe('');
    expect(colorComboName('')).toBe('Colorless');
  });

  it('names all 32 combinations', () => {
    const letters = ['W', 'U', 'B', 'R', 'G'];
    for (let mask = 0; mask < 32; mask++) {
      const key = colorComboKey(letters.filter((_, i) => mask & (1 << i)));
      expect(colorComboName(key)).not.toBe(key || undefined);
    }
  });
});

describe('countDecksByColorCombo', () => {
  it('counts decks per combination with an owned/wishlist split, most common first', () => {
    const rows = countDecksByColorCombo([
      { owned: true, color_identity: ['R'] },
      { owned: false, color_identity: ['U', 'W'] },
      { owned: true, color_identity: ['W', 'U'] },
      { owned: true, color_identity: ['R'] },
      { owned: false, color_identity: ['R'] },
      { owned: true },
    ]);
    expect(rows.map((r) => [r.key, r.total, r.owned, r.wishlist])).toEqual([
      ['R', 3, 2, 1],
      ['WU', 2, 1, 1],
      ['', 1, 1, 0],
    ]);
  });

  it('breaks ties by fewer colors first, then WUBRG order', () => {
    const rows = countDecksByColorCombo([
      { owned: true, color_identity: ['B', 'G'] },
      { owned: true, color_identity: ['G'] },
      { owned: true, color_identity: ['W'] },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['W', 'G', 'BG']);
  });
});
