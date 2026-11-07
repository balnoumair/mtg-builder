const WUBRG = ['W', 'U', 'B', 'R', 'G'] as const;

/** Common names for each color combination, keyed by WUBRG-ordered letters. */
const COMBO_NAMES: Record<string, string> = {
  '': 'Colorless',
  W: 'Mono-White',
  U: 'Mono-Blue',
  B: 'Mono-Black',
  R: 'Mono-Red',
  G: 'Mono-Green',
  WU: 'Azorius',
  UB: 'Dimir',
  BR: 'Rakdos',
  RG: 'Gruul',
  WG: 'Selesnya',
  WB: 'Orzhov',
  UR: 'Izzet',
  BG: 'Golgari',
  WR: 'Boros',
  UG: 'Simic',
  WUG: 'Bant',
  WUB: 'Esper',
  UBR: 'Grixis',
  BRG: 'Jund',
  WRG: 'Naya',
  WBG: 'Abzan',
  WUR: 'Jeskai',
  UBG: 'Sultai',
  WBR: 'Mardu',
  URG: 'Temur',
  UBRG: 'Glint-Eye',
  WBRG: 'Dune-Brood',
  WURG: 'Ink-Treader',
  WUBG: 'Witch-Maw',
  WUBR: 'Yore-Tiller',
  WUBRG: 'Five-Color',
};

/** WUBRG-ordered key for a color identity; unknown letters are dropped. */
export function colorComboKey(colors: readonly string[] | undefined): string {
  const set = new Set(colors ?? []);
  return WUBRG.filter((c) => set.has(c)).join('');
}

export function colorComboName(key: string): string {
  return COMBO_NAMES[key] ?? key;
}

export interface ColorComboCount {
  /** WUBRG-ordered letters; '' for colorless. */
  key: string;
  colors: string[];
  name: string;
  total: number;
  owned: number;
  wishlist: number;
}

/**
 * Decks counted per color identity, ordered by number of colors (colorless
 * first) and then in the usual combination order. Every one-, two- and
 * three-color combination is listed even with no decks; colorless, four- and
 * five-color rows appear only when some deck has them.
 */
export function countDecksByColorCombo(
  decks: readonly { owned: boolean; color_identity?: string[] }[],
): ColorComboCount[] {
  const byKey = new Map<string, ColorComboCount>();
  for (const key of Object.keys(COMBO_NAMES)) {
    byKey.set(key, { key, colors: key.split('').filter(Boolean), name: colorComboName(key), total: 0, owned: 0, wishlist: 0 });
  }
  for (const deck of decks) {
    const row = byKey.get(colorComboKey(deck.color_identity))!;
    row.total += 1;
    if (deck.owned) row.owned += 1;
    else row.wishlist += 1;
  }
  return [...byKey.values()].filter(
    (row) => row.total > 0 || (row.key.length >= 1 && row.key.length <= 3),
  );
}
