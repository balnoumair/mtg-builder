const MANA_COLORS: Record<string, string> = {
  W: '#f9faf4',
  U: '#0e68ab',
  B: '#6b5c7a',
  R: '#d3202a',
  G: '#00733e',
  C: '#9098a0',
  X: '#9098a0',
};

const MANA_BG: Record<string, string> = {
  W: 'rgba(249,250,244,0.15)',
  U: 'rgba(14,104,171,0.2)',
  B: 'rgba(107,92,122,0.2)',
  R: 'rgba(211,32,42,0.2)',
  G: 'rgba(0,115,62,0.2)',
  C: 'rgba(144,152,160,0.15)',
  X: 'rgba(144,152,160,0.15)',
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

export function getManaColor(symbol: string): string {
  return MANA_COLORS[symbol] || '#9098a0';
}

export function getManaBg(symbol: string): string {
  return MANA_BG[symbol] || 'rgba(144,152,160,0.15)';
}

export function getCardTypeCategory(typeLine: string): string {
  const t = typeLine.toLowerCase();
  if (t.includes('creature')) return 'Creatures';
  if (t.includes('planeswalker')) return 'Planeswalkers';
  if (t.includes('instant')) return 'Instants';
  if (t.includes('sorcery')) return 'Sorceries';
  if (t.includes('enchantment')) return 'Enchantments';
  if (t.includes('artifact')) return 'Artifacts';
  if (t.includes('land')) return 'Lands';
  return 'Other';
}

export const TYPE_ORDER = [
  'Creatures', 'Planeswalkers', 'Instants', 'Sorceries',
  'Enchantments', 'Artifacts', 'Lands', 'Other',
];
