import type { MessageKey } from '../../shared/i18n';

export interface ManaColorMeta {
  hex: string;
  ring: string;
  name: string;
  nameKey: MessageKey;
}

export const MANA_COLORS: Record<string, ManaColorMeta> = {
  W: { hex: '#f1ead0', ring: '#c9bd84', name: 'White', nameKey: 'mana.names.W' },
  U: { hex: '#9fcfee', ring: '#5a9fcf', name: 'Blue', nameKey: 'mana.names.U' },
  B: { hex: '#9b948d', ring: '#5d564f', name: 'Black', nameKey: 'mana.names.B' },
  R: { hex: '#e7a294', ring: '#c5654a', name: 'Red', nameKey: 'mana.names.R' },
  G: { hex: '#a8c79c', ring: '#5d8c63', name: 'Green', nameKey: 'mana.names.G' },
  C: { hex: '#bdb7af', ring: '#7e7870', name: 'Colorless', nameKey: 'mana.names.C' },
  M: { hex: '#c9a86c', ring: '#a97d2f', name: 'Multicolor', nameKey: 'mana.names.M' },
  X: { hex: '#bdb7af', ring: '#7e7870', name: 'X', nameKey: 'mana.names.X' },
};

export function parseManaCost(manaCost: string): string[] {
  const symbols: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;
  while ((match = regex.exec(manaCost)) !== null) {
    symbols.push(match[1]);
  }
  return symbols;
}

export function getManaMeta(symbol: string): ManaColorMeta {
  return MANA_COLORS[symbol] || MANA_COLORS.C;
}

/** Translation key for a mana color's display name. */
export function manaNameKey(symbol: string): MessageKey {
  return getManaMeta(symbol).nameKey;
}

export function getCardTypeCategory(typeLine: string): string {
  const t = typeLine.toLowerCase();
  if (t.includes('creature')) return 'Creature';
  if (t.includes('planeswalker')) return 'Planeswalker';
  if (t.includes('instant')) return 'Instant';
  if (t.includes('sorcery')) return 'Sorcery';
  if (t.includes('enchantment')) return 'Enchantment';
  if (t.includes('artifact')) return 'Artifact';
  if (t.includes('land')) return 'Land';
  return 'Other';
}

export const TYPE_ORDER = [
  'Creature', 'Planeswalker', 'Instant', 'Sorcery',
  'Enchantment', 'Artifact', 'Land', 'Other',
];

const TYPE_CATEGORY_KEYS: Record<string, MessageKey> = {
  Creature: 'mana.types.Creature',
  Planeswalker: 'mana.types.Planeswalker',
  Instant: 'mana.types.Instant',
  Sorcery: 'mana.types.Sorcery',
  Enchantment: 'mana.types.Enchantment',
  Artifact: 'mana.types.Artifact',
  Land: 'mana.types.Land',
  Other: 'mana.types.Other',
};

/**
 * Translation key for a type category from getCardTypeCategory / TYPE_ORDER,
 * or the 'Land' group from getCmcGroup.
 */
export function typeCategoryKey(category: string): MessageKey {
  return TYPE_CATEGORY_KEYS[category] ?? TYPE_CATEGORY_KEYS.Other;
}

export const CMC_GROUP_ORDER = ['0', '1', '2', '3', '4', '5', '6', '7+', 'Land'] as const;

export function getCmcGroup(cmc: number, typeLine: string): string {
  if (typeLine.toLowerCase().includes('land')) return 'Land';
  if (cmc >= 7) return '7+';
  return String(cmc);
}
