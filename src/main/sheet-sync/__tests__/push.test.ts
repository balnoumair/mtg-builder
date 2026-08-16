import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, insertTestCard, insertTestSet } from '../../queries/__tests__/helpers';
import { computePushPlan } from '../push';
import { refreshSheetBlocks } from '../pull';
import type { MazosRow } from '../pull';

const EDICIONES = [
  ['Nº', 'BLOQUES'],
  ['1', 'Bloomburrow'],
  ['2', 'Kaldheim'],
];

let db: Database.Database;

function addDeck(name: string, opts: { owned?: boolean; setCode?: string; colors?: string[] } = {}) {
  const { owned = true, setCode = 'blb', colors = ['G'] } = opts;
  const info = db
    .prepare('INSERT INTO decks (name, uuid, owned) VALUES (?, ?, ?)')
    .run(name, `uuid-${name}`, owned ? 1 : 0);
  const deckId = Number(info.lastInsertRowid);
  const cardId = insertTestCard(db, {
    set_code: setCode,
    color_identity: colors,
    name: `${name} Card`,
  });
  db.prepare(
    "INSERT INTO deck_cards (deck_id, card_id, quantity, board) VALUES (?, ?, 1, 'main')",
  ).run(deckId, cardId);
  return deckId;
}

function row(sheetRow: number, player: string, blockLabel: string, colors: string, deckName: string): MazosRow {
  return { sheetRow, player, blockLabel, colors, deckName };
}

function plan(existing: MazosRow[], player = 'Bryan') {
  return computePushPlan(db, player, 'sheet-id', existing);
}

beforeEach(() => {
  db = createTestDb();
  insertTestSet(db, { code: 'blb', name: 'Bloomburrow' });
  insertTestSet(db, { code: 'khm', name: 'Kaldheim' });
  refreshSheetBlocks(db, EDICIONES);
});

describe('computePushPlan', () => {
  it('appends an owned deck that is not in the sheet yet', () => {
    addDeck('Ratones', { setCode: 'blb', colors: ['W', 'R'] });
    const result = plan([row(2, 'Toni', 'Bloomburrow', '⚫🟢', 'Elfos')]);

    expect(result.appends).toHaveLength(1);
    expect(result.appends[0].row).toEqual(['Bryan', 'Bloomburrow', '⚪🔴', 'Ratones']);
    expect(result.appends[0].sheetRow).toBe(3);
    expect(result.updates).toHaveLength(0);
    expect(result.clears).toHaveLength(0);
  });

  it('never plans a write against another player row', () => {
    addDeck('Ratones', { setCode: 'blb' });
    const others = [
      row(2, 'Toni', 'Bloomburrow', '⚫🟢', 'Elfos'),
      row(3, 'Kevin', 'Kaldheim', '🔵', 'Gigantes'),
    ];
    const result = plan(others);

    const touched = [...result.updates, ...result.clears, ...result.appends].map((c) => c.sheetRow);
    expect(touched).not.toContain(2);
    expect(touched).not.toContain(3);
  });

  it('updates in place when only the colors changed', () => {
    addDeck('Enanos', { setCode: 'khm', colors: ['W', 'R'] });
    const result = plan([row(5, 'Bryan', 'Kaldheim', '⚪', 'Enanos')]);

    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].sheetRow).toBe(5);
    expect(result.updates[0].row).toEqual(['Bryan', 'Kaldheim', '⚪🔴', 'Enanos']);
    expect(result.appends).toHaveLength(0);
  });

  it('reports an identical row as matched and writes nothing', () => {
    addDeck('Enanos', { setCode: 'khm', colors: ['W', 'R'] });
    const result = plan([row(5, 'Bryan', 'Kaldheim', '⚪🔴', 'Enanos')]);

    expect(result.matched).toHaveLength(1);
    expect(result.updates).toHaveLength(0);
    expect(result.appends).toHaveLength(0);
    expect(result.clears).toHaveLength(0);
  });

  it('offers a matched row as a ready-made clear so it can be un-pushed', () => {
    addDeck('Enanos', { setCode: 'khm', colors: ['W', 'R'] });
    const result = plan([row(5, 'Bryan', 'Kaldheim', '⚪🔴', 'Enanos')]);

    expect(result.matched[0]).toMatchObject({ sheetRow: 5, row: ['', '', '', ''] });
    expect(result.matched[0].before[3]).toBe('Enanos');
  });

  it('clears my row when the deck is gone locally', () => {
    const result = plan([row(4, 'Bryan', 'Bloomburrow', '🟢', 'Borrado')]);

    expect(result.clears).toHaveLength(1);
    expect(result.clears[0].sheetRow).toBe(4);
    expect(result.clears[0].row).toEqual(['', '', '', '']);
    expect(result.clears[0].before[3]).toBe('Borrado');
  });

  it('ignores decks that are not owned', () => {
    addDeck('Prestado', { owned: false });
    const result = plan([]);
    expect(result.appends).toHaveLength(0);
    expect(result.unmapped).toHaveLength(0);
  });

  it('reports a deck whose sets match no sheet block instead of pushing it', () => {
    insertTestSet(db, { code: 'zzz', name: 'Unknown Set' });
    addDeck('Sin bloque', { setCode: 'zzz' });
    const result = plan([]);

    expect(result.appends).toHaveLength(0);
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0]).toMatchObject({ deckName: 'Sin bloque', setCodes: ['zzz'] });
  });

  it('matches my rows case-insensitively on the player name', () => {
    addDeck('Enanos', { setCode: 'khm', colors: ['W', 'R'] });
    const result = plan([row(5, 'bryan', 'Kaldheim', '⚪🔴', 'Enanos')]);
    expect(result.matched).toHaveLength(1);
    expect(result.clears).toHaveLength(0);
  });

  it('flags two decks that collapse onto the same sheet row identity', () => {
    addDeck('Ratones', { setCode: 'blb', colors: ['W'] });
    // A second deck with the same name in the same block is indistinguishable
    // in the sheet, which only stores block + name.
    const second = db
      .prepare('INSERT INTO decks (name, uuid, owned) VALUES (?, ?, 1)')
      .run('Ratones', 'uuid-dup');
    const cardId = insertTestCard(db, { set_code: 'blb', color_identity: ['R'] });
    db.prepare(
      "INSERT INTO deck_cards (deck_id, card_id, quantity, board) VALUES (?, ?, 1, 'main')",
    ).run(Number(second.lastInsertRowid), cardId);

    const result = plan([]);
    expect(result.duplicates).toHaveLength(1);
    expect(result.appends).toHaveLength(1);
  });

  it('appends after the last row in the sheet, including other players rows', () => {
    addDeck('Ratones', { setCode: 'blb' });
    const result = plan([
      row(2, 'Toni', 'Bloomburrow', '⚫🟢', 'Elfos'),
      row(44, 'Kevin', 'Kaldheim', '🔵', 'Gigantes'),
    ]);
    expect(result.appends[0].sheetRow).toBe(45);
  });

  it('warns when an append would land outside the sheet stats ranges', () => {
    addDeck('Ratones', { setCode: 'blb' });
    const result = plan([row(2001, 'Toni', 'Bloomburrow', '⚫🟢', 'Elfos')]);
    expect(result.appends[0].sheetRow).toBe(2002);
    expect(result.warnings.join(' ')).toMatch(/2001/);
  });
});
