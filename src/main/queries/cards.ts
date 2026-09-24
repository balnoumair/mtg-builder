import type Database from 'better-sqlite3';
import type { Card, CardFilters, CardSearchResult, CardSet } from '../../shared/types';
import { buildSearchConditions } from './searchQuery';

const VALID_LAYOUTS = new Set([
  'normal', 'split', 'flip', 'transform', 'modal_dfc', 'meld',
  'leveler', 'class', 'case', 'saga', 'adventure', 'mutate',
  'prototype', 'battle', 'planar', 'scheme', 'prepare',
]);

function rowToCard(row: Record<string, unknown>): Card {
  return {
    ...row,
    colors: JSON.parse((row.colors as string) || '[]'),
    color_identity: JSON.parse((row.color_identity as string) || '[]'),
    keywords: JSON.parse((row.keywords as string) || '[]'),
    legalities: JSON.parse((row.legalities as string) || '{}'),
  } as Card;
}

export function searchCards(db: Database.Database, filters: CardFilters): CardSearchResult {
  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.query) {
    const search = buildSearchConditions(filters.query);
    conditions.push(...search.conditions);
    Object.assign(params, search.params);
  }

  const colorCategoryChecks: string[] = [];
  if (filters.colorCategories?.includes('multicolor')) {
    colorCategoryChecks.push('json_array_length(color_identity) > 1');
  }
  if (filters.colorCategories?.includes('colorless')) {
    colorCategoryChecks.push('json_array_length(color_identity) = 0');
  }

  if ((filters.colors && filters.colors.length > 0) || colorCategoryChecks.length > 0) {
    const mode = filters.colorMode || 'include';
    const selectedColors = filters.colors ?? [];
    if (mode === 'include') {
      const colorChecks = selectedColors.map(c => `color_identity LIKE '%"${c}"%'`);
      conditions.push(`(${[...colorChecks, ...colorCategoryChecks].join(' OR ')})`);
    } else if (mode === 'exact') {
      for (const color of selectedColors) {
        conditions.push(`color_identity LIKE '%"${color}"%'`);
      }
      if (selectedColors.length) {
        conditions.push(`json_array_length(color_identity) = ${selectedColors.length}`);
      }
    } else if (mode === 'at_most') {
      if (selectedColors.length) {
        const colorChecks = selectedColors.map(c => `color_identity LIKE '%"${c}"%'`);
        conditions.push(`(json_array_length(color_identity) = 0 OR (${colorChecks.join(' OR ')}))`);
        for (const c of ['W', 'U', 'B', 'R', 'G']) {
          if (!selectedColors.includes(c)) {
            conditions.push(`color_identity NOT LIKE '%"${c}"%'`);
          }
        }
      }
    }

    if (mode !== 'include' && colorCategoryChecks.length > 0) {
      conditions.push(`(${colorCategoryChecks.join(' OR ')})`);
    }
  }

  if (filters.types && filters.types.length > 0) {
    const typeConditions = filters.types.map((_, i) => `type_line LIKE '%' || @type${i} || '%'`);
    conditions.push(`(${typeConditions.join(' OR ')})`);
    filters.types.forEach((t, i) => { params[`type${i}`] = t; });
  }

  if (filters.rarity && filters.rarity.length > 0) {
    const rarityPlaceholders = filters.rarity.map((_, i) => `@rarity${i}`);
    conditions.push(`rarity IN (${rarityPlaceholders.join(',')})`);
    filters.rarity.forEach((r, i) => { params[`rarity${i}`] = r; });
  }

  if (filters.sets && filters.sets.length > 0) {
    const setPlaceholders = filters.sets.map((_, i) => `@set${i}`);
    conditions.push(`set_code IN (${setPlaceholders.join(',')})`);
    filters.sets.forEach((s, i) => { params[`set${i}`] = s; });
  }

  if (filters.manaValues && filters.manaValues.length > 0) {
    const manaValueChecks: string[] = [];
    filters.manaValues.forEach((value, i) => {
      if (value === '7+') {
        manaValueChecks.push('cmc >= 7');
      } else {
        manaValueChecks.push(`cmc = @manaValue${i}`);
        params[`manaValue${i}`] = value;
      }
    });
    conditions.push(`(${manaValueChecks.join(' OR ')})`);
  }

  if (filters.cmcMin !== undefined) {
    conditions.push('cmc >= @cmcMin');
    params.cmcMin = filters.cmcMin;
  }

  if (filters.cmcMax !== undefined) {
    conditions.push('cmc <= @cmcMax');
    params.cmcMax = filters.cmcMax;
  }

  if (filters.format) {
    conditions.push(`json_extract(legalities, '$.' || @format) = 'legal'`);
    params.format = filters.format;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const pageSize = filters.pageSize || 60;
  const page = filters.page || 1;
  const offset = (page - 1) * pageSize;

  const sortColumn = filters.sortBy || 'name';
  const validSorts = ['name', 'cmc', 'rarity', 'released_at'];
  const sort = validSorts.includes(sortColumn) ? sortColumn : 'name';

  const countSql = `SELECT COUNT(*) as total FROM cards ${whereClause}`;
  const dataSql = `
    SELECT * FROM cards ${whereClause}
    ORDER BY ${sort} ASC
    LIMIT @limit OFFSET @offset
  `;

  params.limit = pageSize;
  params.offset = offset;

  const countRow = db.prepare(countSql).get(params) as { total: number };
  const rows = db.prepare(dataSql).all(params) as Record<string, unknown>[];

  return {
    cards: rows.map(rowToCard),
    total: countRow.total,
  };
}

export function getCard(db: Database.Database, id: string): Card | null {
  const row = db.prepare('SELECT * FROM cards WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToCard(row) : null;
}

export function getSets(db: Database.Database): CardSet[] {
  // Aggregate cards into set groups before joining `sets`: the LOWER() join
  // can't use the sets PK index, so joining per card row instead of per set
  // group makes this query ~45x slower on a full Scryfall import.
  return db.prepare(`
    SELECT
      g.code,
      g.name,
      g.releasedAt,
      g.blockCode,
      g.blockName,
      s.icon_svg_uri as iconSvgUri
    FROM (
      SELECT
        set_code as code,
        set_name as name,
        MIN(released_at) as releasedAt,
        MAX(block_code) as blockCode,
        MAX(block_name) as blockName
      FROM cards
      GROUP BY set_code, set_name
    ) g
    LEFT JOIN sets s ON LOWER(s.code) = LOWER(g.code)
    ORDER BY g.name ASC
  `).all() as CardSet[];
}

/**
 * Every set in the catalog, including ones with no cards imported locally
 * (bonus sheets like `fca` are real sets you can still map a block to).
 * `getSets` deliberately reports only sets you own cards from, so it is the
 * wrong source for anything that validates or offers set choices.
 */
export function getAllSets(db: Database.Database): CardSet[] {
  return db.prepare(`
    SELECT
      code,
      name,
      released_at as releasedAt,
      block_code as blockCode,
      block_name as blockName,
      icon_svg_uri as iconSvgUri
    FROM sets
    ORDER BY released_at DESC, name ASC
  `).all() as CardSet[];
}

export { VALID_LAYOUTS };
