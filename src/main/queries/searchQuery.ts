/**
 * Free-text card search: bare words match name or rules text, and a `field:`
 * prefix narrows a term to one column.
 *
 *   dragon              name or oracle text contains "dragon"
 *   t:human             type line contains "human"
 *   o:sacrifice         oracle text contains "sacrifice"
 *   n:bolt t:instant    name contains "bolt" AND type line contains "instant"
 *   t:"human soldier"   type line contains the phrase
 *
 * Terms are ANDed. Type is deliberately not part of a bare word: "creature"
 * or "instant" would otherwise match most of the catalog.
 */

export type SearchField = 'name' | 'oracle' | 'type' | 'any';

export interface SearchTerm {
  field: SearchField;
  value: string;
}

const FIELD_ALIASES: Record<string, SearchField> = {
  n: 'name',
  name: 'name',
  o: 'oracle',
  oracle: 'oracle',
  text: 'oracle',
  t: 'type',
  type: 'type',
};

const FIELD_COLUMNS: Record<SearchField, string[]> = {
  name: ['name'],
  oracle: ['oracle_text'],
  type: ['type_line'],
  any: ['name', 'oracle_text'],
};

interface RawToken {
  text: string;
  /** Index of the first colon outside quotes, or -1. */
  fieldColon: number;
}

/**
 * Splits on whitespace, with double quotes grouping a phrase. Quotes are
 * stripped, and a colon inside them is content rather than a field separator,
 * so `o:"whenever this dies:"` keeps its trailing colon.
 */
function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  let text = '';
  let fieldColon = -1;
  let inQuotes = false;

  const flush = () => {
    if (text.length > 0) tokens.push({ text, fieldColon });
    text = '';
    fieldColon = -1;
  };

  for (const ch of input) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && /\s/.test(ch)) {
      flush();
      continue;
    }
    if (!inQuotes && ch === ':' && fieldColon === -1) fieldColon = text.length;
    text += ch;
  }
  flush();

  return tokens;
}

export function parseSearchQuery(input: string): SearchTerm[] {
  const terms: SearchTerm[] = [];

  for (const token of tokenize(input)) {
    if (token.fieldColon > 0) {
      const field = FIELD_ALIASES[token.text.slice(0, token.fieldColon).toLowerCase()];
      if (field) {
        const value = token.text.slice(token.fieldColon + 1);
        // A prefix with nothing after it yet is someone mid-keystroke, not a
        // request for cards whose name contains "t:".
        if (value.length > 0) terms.push({ field, value });
        continue;
      }
    }
    terms.push({ field: 'any', value: token.text });
  }

  return terms;
}

/**
 * SQL for a query string. `columnPrefix` is the table alias joins need
 * (`'c.'`), empty when the statement selects from `cards` directly.
 */
export function buildSearchConditions(
  input: string,
  columnPrefix = ''
): { conditions: string[]; params: Record<string, string> } {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  parseSearchQuery(input).forEach((term, i) => {
    const param = `q${i}`;
    params[param] = term.value;
    const checks = FIELD_COLUMNS[term.field].map(
      (column) => `${columnPrefix}${column} LIKE '%' || @${param} || '%'`
    );
    conditions.push(`(${checks.join(' OR ')})`);
  });

  return { conditions, params };
}
