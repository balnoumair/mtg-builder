export const DEFAULT_COPY_LIMIT = 4;
export const PLAYSET_SIZE = 4;

interface CardLimitInfo {
  type_line: string;
}

/**
 * Maximum copies of a card allowed in a deck (main + sideboard combined),
 * or null when unlimited. 4 per name, basic lands unlimited. Card-specific
 * exceptions (Relentless Rats, Seven Dwarves, …) exist only in rules text,
 * which can't be matched reliably; the user exempts such a card per deck via
 * the deck_cards ignore_copy_limit flag instead.
 */
export function getMaxCopies(card: CardLimitInfo): number | null {
  const typeLine = card.type_line.toLowerCase();
  if (typeLine.includes('basic') && typeLine.includes('land')) return null;
  return DEFAULT_COPY_LIMIT;
}
