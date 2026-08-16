import type Database from 'better-sqlite3';
import type { ExternalDeck } from '../../shared/types';
import { englishBlockLabel, type SetNameInfo } from '../../shared/sheetBlockLabel';

export interface ExternalDeckRow {
  player: string;
  block_label: string;
  colors: string;
  name: string;
  row_index: number;
}

/** Pull semantics: the sheet is the source of truth, so replace everything. */
export function replaceExternalDecks(db: Database.Database, rows: ExternalDeckRow[]): void {
  const txn = db.transaction(() => {
    db.prepare('DELETE FROM external_decks').run();
    const insert = db.prepare(`
      INSERT INTO external_decks (player, block_label, colors, name, row_index)
      VALUES (@player, @block_label, @colors, @name, @row_index)
    `);
    for (const row of rows) insert.run(row);
  });
  txn();
}

interface SetInfoRow extends SetNameInfo {
  released_at: string | null;
}

function loadSetInfo(db: Database.Database): Map<string, SetInfoRow> {
  const rows = db.prepare(
    'SELECT code, name, block_name, released_at FROM sets',
  ).all() as SetInfoRow[];
  return new Map(rows.map((r) => [r.code.toLowerCase(), r]));
}

export function getExternalDecks(db: Database.Database): ExternalDeck[] {
  const rows = db.prepare(`
    SELECT e.id, e.player, e.block_label, e.colors, e.name, e.synced_at, e.row_index,
           COALESCE(b.position, 9999) as block_position,
           COALESCE(b.set_codes, '[]') as set_codes
    FROM external_decks e
    LEFT JOIN sheet_blocks b ON b.label = e.block_label
  `).all() as (Omit<ExternalDeck, 'colors' | 'set_label'> & {
    colors: string;
    set_codes: string;
    row_index: number;
  })[];

  const sets = loadSetInfo(db);

  // Blocks are ordered the way the Decks view orders them — by newest release
  // in the block, not by the sheet's own EDICIONES row order.
  const sortKeyFor = (setCodes: string[]): string =>
    setCodes.reduce((latest, code) => {
      const released = sets.get(code.toLowerCase())?.released_at ?? '';
      return released > latest ? released : latest;
    }, '');

  const decks = rows.map(({ set_codes, row_index, ...r }) => {
    const codes = JSON.parse(set_codes) as string[];
    return {
      deck: {
        ...r,
        colors: r.colors.split(''),
        set_label: englishBlockLabel(r.block_label, codes, sets),
      } as ExternalDeck,
      rowIndex: row_index,
      sortKey: sortKeyFor(codes),
    };
  });

  decks.sort((a, b) => {
    if (a.deck.player !== b.deck.player) return a.deck.player.localeCompare(b.deck.player);
    // Blocks we can't date (unmapped labels) sink to the bottom, like Mixed.
    if (a.sortKey !== b.sortKey) {
      if (!a.sortKey) return 1;
      if (!b.sortKey) return -1;
      return b.sortKey.localeCompare(a.sortKey);
    }
    if (a.deck.set_label !== b.deck.set_label) {
      return a.deck.set_label.localeCompare(b.deck.set_label);
    }
    return a.rowIndex - b.rowIndex;
  });

  return decks.map((d) => d.deck);
}
