// The playgroup sheet's EDICIONES tab is the label vocabulary (Spanish, with
// custom groupings Scryfall doesn't have, like pairing MID/VOW as one block).
// Scryfall has no localized set names, so each label is seeded here with the
// Scryfall set codes it covers. Bonus/companion sets (sta, wot, otp, big, brr,
// mat, tsb, fca) are folded into their parent label so decks holding those
// prints still match. Labels the seed doesn't know surface as unmapped in the
// sync UI and get a user-assigned mapping in sheet_blocks (manual = 1).
export const SHEET_BLOCK_SETS: Record<string, string[]> = {
  'Arabian Nights': ['arn'],
  'Antiquities': ['atq'],
  'Legends': ['leg'],
  'The Dark': ['drk'],
  'Fallen Empires': ['fem'],
  'Era Glacial (Bloque)': ['ice', 'all', 'csp'],
  'Homelands': ['hml'],
  'Espejismo (Bloque)': ['mir', 'vis', 'wth'],
  'Tempestad (Bloque)': ['tmp', 'sth', 'exo'],
  'Urza (Bloque)': ['usg', 'ulg', 'uds'],
  'Máscaras de Mercadia (Bloque)': ['mmq', 'nem', 'pcy'],
  'Invasión (Bloque)': ['inv', 'pls', 'apc'],
  'Odisea (Bloque)': ['ody', 'tor', 'jud'],
  'Embestida (Bloque)': ['ons', 'lgn', 'scg'],
  'Mirrodin (Bloque)': ['mrd', 'dst', '5dn'],
  'Kamigawa (Bloque)': ['chk', 'bok', 'sok'],
  'Ravnica (Bloque)': ['rav', 'gpt', 'dis'],
  'Espiral del tiempo (Bloque)': ['tsp', 'tsb', 'plc', 'fut'],
  'Lorwyn (Bloque)': ['lrw', 'mor'],
  'Páramo Sombrío (Bloque)': ['shm', 'eve'],
  'Alara (Bloque)': ['ala', 'con', 'arb'],
  'Zendikar (Bloque)': ['zen', 'wwk', 'roe'],
  'Cicatrices de Mirrodin (Bloque)': ['som', 'mbs', 'nph'],
  'Innistrad (Bloque)': ['isd', 'dka', 'avr'],
  'Regreso a Ravnica (Bloque)': ['rtr', 'gtc', 'dgm'],
  'Theros (Bloque)': ['ths', 'bng', 'jou'],
  'Khans of Tarkir (Bloque)': ['ktk', 'frf', 'dtk'],
  'Batalla por Zendikar (Bloque)': ['bfz', 'ogw'],
  'Sombras sobre Innistrad (Bloque)': ['soi', 'emn'],
  'Kaladesh (Bloque)': ['kld', 'aer'],
  'Amonkhet (Bloque)': ['akh', 'hou'],
  'Ixalan (Bloque)': ['xln', 'rix'],
  'Dominaria': ['dom'],
  'Gremios de Ravnica (Bloque)': ['grn', 'rna', 'war'],
  'El Trono de Eldraine': ['eld'],
  'Theros más allá de la muerte': ['thb'],
  'Ikoria: Mundo de behemots': ['iko'],
  'El Resurgir de Zendikar': ['znr'],
  'Kaldheim': ['khm'],
  'Strixhaven: Escuela de magos': ['stx', 'sta'],
  'Innistrad: Midnight Hunt / Crimsom Vow (Bloque)': ['mid', 'vow'],
  'Kamigawa: Dinastía de neón': ['neo'],
  'Calles de Nueva Capenna': ['snc'],
  'Dominaria unida': ['dmu'],
  'La Guerra de los Hermanos': ['bro', 'brr'],
  'Phyrexia: Todos serán uno': ['one'],
  'Marcha de las máquinas': ['mom', 'mat'],
  'Las tierras salvajes de Eldraine': ['woe', 'wot'],
  'Las cavernas perdidas de Ixalan': ['lci'],
  'Asesinatos en la mansión Karlov': ['mkm'],
  'Forajidos de Cruce de Truenos': ['otj', 'otp', 'big'],
  'Bloomburrow': ['blb'],
  'Duskmourn: La casa de los horrores': ['dsk'],
  'Cimientos': ['fdn'],
  'Aetherdrift': ['dft'],
  'Tarkir: tormenta de Dragones': ['tdm'],
  'FINAL FANTASY': ['fin', 'fca'],
  'El Confín de la Eternidad': ['eoe'],
  "Marvel's Spider-Man": ['spm'],
  'Avatar: La leyenda de Aang': ['tla'],
  'Lorwyn eclipsado': ['ecl'],
  'Tortugas Ninja': ['tmt'],
  'Secretos de Strixhaven': ['sos'],
  'Marvel Super Heroes': ['msh'],
  'El Hobbit': ['hob'],
};

const COLOR_TO_EMOJI: Record<string, string> = {
  W: '⚪',
  U: '🔵',
  B: '⚫',
  R: '🔴',
  G: '🟢',
};

const EMOJI_TO_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(COLOR_TO_EMOJI).map(([letter, emoji]) => [emoji, letter]),
);

const WUBRG = ['W', 'U', 'B', 'R', 'G'];

/** WUBRG-ordered color identity → the sheet's emoji notation ("BG" → "⚫🟢"). */
export function colorsToEmoji(colors: string[]): string {
  return WUBRG.filter((c) => colors.includes(c)).map((c) => COLOR_TO_EMOJI[c]).join('');
}

/** Sheet emoji notation → WUBRG-ordered letters; unknown symbols are dropped. */
export function emojiToColors(text: string): string[] {
  const found = new Set<string>();
  for (const symbol of text) {
    const letter = EMOJI_TO_COLOR[symbol];
    if (letter) found.add(letter);
  }
  return WUBRG.filter((c) => found.has(c));
}

export interface SheetBlock {
  label: string;
  position: number;
  setCodes: string[];
}

/**
 * The sheet label whose sets cover every set the deck draws from, preferring
 * the most specific candidate (fewest sets). Null when nothing covers it —
 * the deck is unmapped and needs a manual assignment.
 */
export function matchBlockLabel(deckSetCodes: string[], blocks: SheetBlock[]): string | null {
  if (deckSetCodes.length === 0) return null;
  const codes = deckSetCodes.map((c) => c.toLowerCase());
  let best: SheetBlock | null = null;
  for (const block of blocks) {
    const blockCodes = new Set(block.setCodes.map((c) => c.toLowerCase()));
    if (!codes.every((c) => blockCodes.has(c))) continue;
    if (!best || block.setCodes.length < best.setCodes.length) best = block;
  }
  return best?.label ?? null;
}
