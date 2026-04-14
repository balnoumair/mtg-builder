import type Database from 'better-sqlite3';
import type { Card, CardFilters, CollectionCard, CollectionStats } from '../../shared/types';

function rowToCard(row: Record<string, unknown>): Card {
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
    added_at: row.added_at as string,
    card: rowToCard(row),
  };
}

export function getCollection(
  db: Database.Database,
  filters: CardFilters
): { cards: CollectionCard[]; total: number } {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.query) {
    conditions.push("(c.name LIKE '%' || @query || '%' OR c.oracle_text LIKE '%' || @query || '%')");
    params.query = filters.query;
  }

  if (filters.colors && filters.colors.length > 0) {
    const mode = filters.colorMode || 'include';
    if (mode === 'include') {
      for (let i = 0; i < filters.colors.length; i++) {
        conditions.push(`c.color_identity LIKE '%"${filters.colors[i]}"%'`);
      }
    } else if (mode === 'exact') {
      for (let i = 0; i < filters.colors.length; i++) {
        conditions.push(`c.color_identity LIKE '%"${filters.colors[i]}"%'`);
      }
      conditions.push(`json_array_length(c.color_identity) = ${filters.colors.length}`);
    } else if (mode === 'at_most') {
      const colorChecks = filters.colors.map(c => `c.color_identity LIKE '%"${c}"%'`);
      conditions.push(`(json_array_length(c.color_identity) = 0 OR (${colorChecks.join(' OR ')}))`);
      for (const color of ['W', 'U', 'B', 'R', 'G']) {
        if (!filters.colors.includes(color)) {
          conditions.push(`c.color_identity NOT LIKE '%"${color}"%'`);
        }
      }
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

  const countSql = `SELECT COUNT(*) as total FROM collection col JOIN cards c ON c.id = col.card_id ${whereClause}`;
  const dataSql = `
    SELECT col.card_id, col.quantity, col.added_at, c.*
    FROM collection col
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
  const row = db.prepare(`
    SELECT
      COUNT(*) as uniqueCards,
      COALESCE(SUM(col.quantity), 0) as totalCopies,
      COALESCE(SUM(CAST(c.price_usd AS REAL) * col.quantity), 0) as estimatedValue
    FROM collection col
    JOIN cards c ON c.id = col.card_id
  `).get() as { uniqueCards: number; totalCopies: number; estimatedValue: number };

  return {
    uniqueCards: row.uniqueCards,
    totalCopies: row.totalCopies,
    estimatedValue: row.estimatedValue > 0 ? row.estimatedValue : null,
  };
}
