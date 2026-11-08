import type { Card } from './types';

/** Prefer printed (localized) name when present. */
export function displayCardName(card: Pick<Card, 'name' | 'printed_name'>): string {
  return card.printed_name?.trim() || card.name;
}

export function displayTypeLine(card: Pick<Card, 'type_line' | 'printed_type_line'>): string {
  return card.printed_type_line?.trim() || card.type_line;
}

export function displayOracleText(card: Pick<Card, 'oracle_text' | 'printed_text'>): string {
  return card.printed_text?.trim() || card.oracle_text;
}
