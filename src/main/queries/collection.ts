import type Database from 'better-sqlite3';
import type { Card, CardFilters, CollectionCard, CollectionStats } from '../../shared/types';
import { buildSearchConditions } from './searchQuery';
import { BASIC_LAND_NAMES } from '../../shared/basicLands';

export function rowToCard(row: Record<string, unknown>): Card {
  return {
    ...row,
    colors: JSON.parse((row.colors as string) || '[]'),
    color_identity: JSON.parse((row.color_identity as string) || '[]'),
    keywords: JSON.parse((row.keywords as string) || '[]'),
    legalities: JSON.parse((row.legalities as string) || '{}'),
  } as Card;
}

function rowToCollectionCard(row: Record<string, unknown>): CollectionCard {
  return {
    card_id: row.card_id as string,
    quantity: row.quantity as number,
    in_decks: row.in_decks as number,
    added_at: (row.added_at as string | null) ?? null,
    card: rowToCard(row),
  };
}

// Confirmed copies sitting in owned decks, per card. Pending (unconfirmed)
// deck edits are excluded: owned_quantity is the physical baseline. Basic
// lands are left out: every deck carries a pile of them, and counting those
// would flood My Cards with lands the user never tracked as cards.
const BASIC_NAMES_SQL = [...BASIC_LAND_NAMES].map((n) => `'${n}'`).join(', ');
const IN_DECKS_SQL = `
  SELECT dc.card_id, dc.owned_quantity AS in_decks
  FROM deck_cards dc
  JOIN decks d ON d.id = dc.deck_id
  JOIN cards bc ON bc.id = dc.card_id
  WHERE d.owned = 1 AND dc.owned_quantity > 0 AND bc.name NOT IN (${BASIC_NAMES_SQL})
`;

// Everything the user owns, per card: loose copies in the collection plus
// copies in owned decks. Claiming a deck deducts its cards from the
// collection, so the two never overlap.
const HOLDINGS_CTE = `
  WITH holdings AS (
    SELECT card_id, SUM(loose) AS quantity, SUM(in_decks) AS in_decks, MAX(added_at) AS added_at
    FROM (
      SELECT card_id, quantity AS loose, 0 AS in_decks, added_at FROM collection
      UNION ALL
      SELECT card_id, 0, in_decks, NULL FROM (${IN_DECKS_SQL})
    )
    GROUP BY card_id
  )
`;

export function getCollection(
  db: Database.Database,
  filters: CardFilters
): { cards: CollectionCard[]; total: number } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.query) {
    const search = buildSearchConditions(filters.query, 'c.');
    conditions.push(...search.conditions);
    Object.assign(params, search.params);
  }

  const colorCategoryChecks: string[] = [];
  if (filters.colorCategories?.includes('multicolor')) {
    colorCategoryChecks.push('json_array_length(c.color_identity) > 1');
  }
  if (filters.colorCategories?.includes('colorless')) {
    colorCategoryChecks.push('json_array_length(c.color_identity) = 0');
  }

  if ((filters.colors && filters.colors.length > 0) || colorCategoryChecks.length > 0) {
    const mode = filters.colorMode || 'include';
    const selectedColors = filters.colors ?? [];
    if (mode === 'include') {
      const colorChecks = selectedColors.map(c => `c.color_identity LIKE '%"${c}"%'`);
      conditions.push(`(${[...colorChecks, ...colorCategoryChecks].join(' OR ')})`);
    } else if (mode === 'exact') {
      for (const color of selectedColors) {
        conditions.push(`c.color_identity LIKE '%"${color}"%'`);
      }
      if (selectedColors.length) {
        conditions.push(`json_array_length(c.color_identity) = ${selectedColors.length}`);
      }
    } else if (mode === 'at_most') {
      if (selectedColors.length) {
        const colorChecks = selectedColors.map(c => `c.color_identity LIKE '%"${c}"%'`);
        conditions.push(`(json_array_length(c.color_identity) = 0 OR (${colorChecks.join(' OR ')}))`);
        for (const color of ['W', 'U', 'B', 'R', 'G']) {
          if (!selectedColors.includes(color)) {
            conditions.push(`c.color_identity NOT LIKE '%"${color}"%'`);
          }
        }
      }
    }

    if (mode !== 'include' && colorCategoryChecks.length > 0) {
      conditions.push(`(${colorCategoryChecks.join(' OR ')})`);
    }
  }

  if (filters.types && filters.types.length > 0) {
    const typeConditions = filters.types.map((_, i) => `c.type_line LIKE '%' || @type${i} || '%'`);
    conditions.push(`(${typeConditions.join(' OR ')})`);
    filters.types.forEach((t, i) => { params[`type${i}`] = t; });
  }

  if (filters.rarity && filters.rarity.length > 0) {
    const rarityPlaceholders = filters.rarity.map((_, i) => `@rarity${i}`);
    conditions.push(`c.rarity IN (${rarityPlaceholders.join(',')})`);
    filters.rarity.forEach((r, i) => { params[`rarity${i}`] = r; });
  }

  if (filters.sets && filters.sets.length > 0) {
    const setPlaceholders = filters.sets.map((_, i) => `@set${i}`);
    conditions.push(`c.set_code IN (${setPlaceholders.join(',')})`);
    filters.sets.forEach((s, i) => { params[`set${i}`] = s; });
  }

  if (filters.manaValues && filters.manaValues.length > 0) {
    const manaValueChecks: string[] = [];
    filters.manaValues.forEach((value, i) => {
      if (value === '7+') {
        manaValueChecks.push('c.cmc >= 7');
      } else {
        manaValueChecks.push(`c.cmc = @manaValue${i}`);
        params[`manaValue${i}`] = value;
      }
    });
    conditions.push(`(${manaValueChecks.join(' OR ')})`);
  }

  if (filters.cmcMin !== undefined) {
    conditions.push('c.cmc >= @cmcMin');
    params.cmcMin = filters.cmcMin;
  }

  if (filters.cmcMax !== undefined) {
    conditions.push('c.cmc <= @cmcMax');
    params.cmcMax = filters.cmcMax;
  }

  if (filters.format) {
    conditions.push(`json_extract(c.legalities, '$.' || @format) = 'legal'`);
    params.format = filters.format;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const pageSize = filters.pageSize || 60;
  const page = filters.page || 1;
  const offset = (page - 1) * pageSize;

  const sortColumn = filters.sortBy || 'name';
  const validSorts = ['name', 'cmc', 'rarity', 'released_at'];
  const sort = validSorts.includes(sortColumn) ? sortColumn : 'name';

  const countSql = `${HOLDINGS_CTE} SELECT COUNT(*) as total FROM holdings col JOIN cards c ON c.id = col.card_id ${whereClause}`;
  const dataSql = `
    ${HOLDINGS_CTE}
    SELECT c.*, col.card_id, col.quantity, col.in_decks, col.added_at
    FROM holdings col
    JOIN cards c ON c.id = col.card_id
    ${whereClause}
    ORDER BY c.${sort} ASC
    LIMIT @limit OFFSET @offset
  `;

  params.limit = pageSize;
  params.offset = offset;

  const countRow = db.prepare(countSql).get(params) as { total: number };
  const rows = db.prepare(dataSql).all(params) as Record<string, unknown>[];

  return {
    cards: rows.map(rowToCollectionCard),
    total: countRow.total,
  };
}

export function getCollectionQuantities(
  db: Database.Database,
  cardIds: string[]
): Record<string, number> {
  if (cardIds.length === 0) return {};

  const placeholders = cardIds.map((_, i) => `@id${i}`).join(',');
  const params: Record<string, string> = {};
  cardIds.forEach((id, i) => { params[`id${i}`] = id; });

  const rows = db.prepare(
    `SELECT card_id, quantity FROM collection WHERE card_id IN (${placeholders})`
  ).all(params) as { card_id: string; quantity: number }[];

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.card_id] = row.quantity;
  }
  return result;
}

/** Copies of each card held in owned decks, keyed by card id; absent when none. */
export function getInDeckQuantities(
  db: Database.Database,
  cardIds: string[]
): Record<string, number> {
  if (cardIds.length === 0) return {};

  const placeholders = cardIds.map((_, i) => `@id${i}`).join(',');
  const params: Record<string, string> = {};
  cardIds.forEach((id, i) => { params[`id${i}`] = id; });

  const rows = db.prepare(`
    SELECT card_id, SUM(in_decks) AS in_decks
    FROM (${IN_DECKS_SQL})
    WHERE card_id IN (${placeholders})
    GROUP BY card_id
  `).all(params) as { card_id: string; in_decks: number }[];

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.card_id] = row.in_decks;
  }
  return result;
}

export function addToCollection(
  db: Database.Database,
  cardId: string,
  quantity = 1
): void {
  db.prepare(`
    INSERT INTO collection (card_id, quantity)
    VALUES (@cardId, @quantity)
    ON CONFLICT(card_id) DO UPDATE SET quantity = quantity + @quantity
  `).run({ cardId, quantity });
}

export function updateCollectionQuantity(
  db: Database.Database,
  cardId: string,
  quantity: number
): void {
  if (quantity <= 0) {
    db.prepare('DELETE FROM collection WHERE card_id = @cardId').run({ cardId });
  } else {
    db.prepare('UPDATE collection SET quantity = @quantity WHERE card_id = @cardId').run({ cardId, quantity });
  }
}

export function removeFromCollection(
  db: Database.Database,
  cardId: string
): void {
  db.prepare('DELETE FROM collection WHERE card_id = @cardId').run({ cardId });
}

export function getCollectionStats(db: Database.Database): CollectionStats {
  return db.prepare(`
    ${HOLDINGS_CTE}
    SELECT
      COUNT(*) as uniqueCards,
      COALESCE(SUM(quantity), 0) as totalCopies,
      COALESCE(SUM(in_decks), 0) as inDeckCopies
    FROM holdings
  `).get() as CollectionStats;
}
