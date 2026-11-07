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
  it('counts decks per combination with an owned/wishlist split', () => {
    const rows = countDecksByColorCombo([
      { owned: true, color_identity: ['R'] },
      { owned: false, color_identity: ['U', 'W'] },
      { owned: true, color_identity: ['W', 'U'] },
      { owned: true, color_identity: ['R'] },
      { owned: false, color_identity: ['R'] },
    ]);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, [r.total, r.owned, r.wishlist]]));
    expect(byKey.R).toEqual([3, 2, 1]);
    expect(byKey.WU).toEqual([2, 1, 1]);
  });

  it('lists every one-, two- and three-color combination even with no decks', () => {
    const rows = countDecksByColorCombo([]);
    expect(rows).toHaveLength(5 + 10 + 10);
    expect(rows.every((r) => r.total === 0)).toBe(true);
  });

  it('lists colorless, four- and five-color rows only when a deck has them', () => {
    const keys = countDecksByColorCombo([
      { owned: true },
      { owned: true, color_identity: ['U', 'B', 'R', 'G'] },
    ]).map((r) => r.key);
    expect(keys).toContain('');
    expect(keys).toContain('UBRG');
    expect(keys).not.toContain('WUBRG');
  });

  it('orders rows by number of colors, not by deck count', () => {
    const rows = countDecksByColorCombo([
      { owned: true },
      { owned: true, color_identity: ['B', 'G'] },
      { owned: true, color_identity: ['B', 'G'] },
      { owned: true, color_identity: ['G'] },
    ]);
    const sizes = rows.map((r) => r.colors.length);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    expect(rows.slice(0, 6).map((r) => r.key)).toEqual(['', 'W', 'U', 'B', 'R', 'G']);
  });
});
