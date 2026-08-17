import { describe, it, expect, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, insertTestSet } from '../../queries/__tests__/helpers';
import {
  assertMazosHeader,
  fetchSheetValues,
  getSheetBlocks,
  parseMazosRows,
  parseSpreadsheetId,
  refreshSheetBlocks,
  requireSpreadsheetId,
} from '../pull';
import { getExternalDecks, replaceExternalDecks } from '../../queries/externalDecks';
import { emojiToColors } from '../blockMap';

const HEADER = ['Jugador', 'Bloque/Edición', 'Colores', 'Mazo'];

describe('assertMazosHeader', () => {
  it('accepts the sheet layout, including trailing columns', () => {
    expect(() => assertMazosHeader([[...HEADER, 'extra']])).not.toThrow();
  });

  it('rejects reordered columns rather than writing garbage', () => {
    expect(() => assertMazosHeader([['Mazo', 'Jugador', 'Colores', 'Bloque/Edición']])).toThrow(
      /columns changed/i,
    );
  });

  it('rejects an empty sheet', () => {
    expect(() => assertMazosHeader([])).toThrow();
  });
});

describe('parseSpreadsheetId', () => {
  const id = '1ZKGlHcXW3r-uX79ytGBZb1DZROlLNkETwyadP2CxqOA';

  it('takes the id out of a pasted sheet link', () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`)).toBe(id);
  });

  it('accepts a link with no trailing path', () => {
    expect(parseSpreadsheetId(`https://docs.google.com/spreadsheets/d/${id}`)).toBe(id);
  });

  it('accepts a bare id', () => {
    expect(parseSpreadsheetId(id)).toBe(id);
  });

  it('trims surrounding whitespace', () => {
    expect(parseSpreadsheetId(`  ${id}  `)).toBe(id);
  });

  it('rejects something that is neither', () => {
    expect(parseSpreadsheetId('https://example.com/not-a-sheet')).toBe('');
    expect(parseSpreadsheetId('')).toBe('');
  });
});

describe('requireSpreadsheetId', () => {
  it('refuses to sync when no spreadsheet is configured', () => {
    expect(() => requireSpreadsheetId('')).toThrow(/No spreadsheet configured/);
  });

  it('passes a configured id straight through', () => {
    expect(requireSpreadsheetId('abc123')).toBe('abc123');
  });
});

describe('fetchSheetValues', () => {
  it('reads raw tab values through the Sheets API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ values: [['Jugador'], ['Toni']] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await expect(fetchSheetValues('token', 'sheet-id', 'MAZOS')).resolves.toEqual([
        ['Jugador'],
        ['Toni'],
      ]);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://sheets.googleapis.com/v4/spreadsheets/sheet-id/values/MAZOS!A%3AD?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE',
        {
          headers: {
            Authorization: 'Bearer token',
            'Content-Type': 'application/json',
          },
        },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('parseMazosRows', () => {
  const rows = [
    HEADER,
    ['Toni', 'Bloomburrow', '⚪🔴', 'Ratones'],
    ['', '', '', ''],
    ['Bryan', 'Kaldheim', '⚪🔴', 'Enanos'],
  ];

  it('skips blank rows and reports 1-based sheet rows', () => {
    const parsed = parseMazosRows(rows);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ sheetRow: 2, player: 'Toni', deckName: 'Ratones' });
    expect(parsed[1].sheetRow).toBe(4);
  });

  it('trims surrounding whitespace', () => {
    expect(parseMazosRows([HEADER, [' Toni ', ' Bloomburrow ', '⚪', ' Ratones ']])[0]).toMatchObject({
      player: 'Toni',
      blockLabel: 'Bloomburrow',
      deckName: 'Ratones',
    });
  });
});

describe('refreshSheetBlocks', () => {
  let db: Database.Database;
  const ediciones = [
    ['Nº', 'BLOQUES / EDICIONES (editable)'],
    ['1', 'Bloomburrow'],
    ['2', 'Las tierras salvajes de Eldraine'],
    ['3', 'Bloque inventado del grupo'],
  ];

  it('seeds known labels from the dictionary and leaves unknown ones empty', () => {
    db = createTestDb();
    refreshSheetBlocks(db, ediciones);
    const blocks = getSheetBlocks(db);
    expect(blocks.find((b) => b.label === 'Bloomburrow')?.setCodes).toEqual(['blb']);
    expect(blocks.find((b) => b.label === 'Bloque inventado del grupo')?.setCodes).toEqual([]);
  });

  it('preserves a manual mapping across reseeds but still updates position', () => {
    db = createTestDb();
    refreshSheetBlocks(db, ediciones);
    db.prepare("UPDATE sheet_blocks SET set_codes = '[\"xyz\"]', manual = 1 WHERE label = ?").run(
      'Bloque inventado del grupo',
    );

    refreshSheetBlocks(db, [
      ediciones[0],
      ['1', 'Bloomburrow'],
      ['2', 'Las tierras salvajes de Eldraine'],
      ['7', 'Bloque inventado del grupo'],
    ]);

    const custom = getSheetBlocks(db).find((b) => b.label === 'Bloque inventado del grupo');
    expect(custom?.setCodes).toEqual(['xyz']);
    expect(custom?.position).toBe(7);
  });

  it('orders blocks by their position in the sheet', () => {
    db = createTestDb();
    refreshSheetBlocks(db, ediciones);
    expect(getSheetBlocks(db).map((b) => b.label)).toEqual([
      'Bloomburrow',
      'Las tierras salvajes de Eldraine',
      'Bloque inventado del grupo',
    ]);
  });
});

describe('external deck storage', () => {
  it('replaces previous contents so the sheet stays the source of truth', () => {
    const db = createTestDb();
    replaceExternalDecks(db, [
      { player: 'Toni', block_label: 'Bloomburrow', colors: 'WR', name: 'Ratones', row_index: 2 },
    ]);
    replaceExternalDecks(db, [
      { player: 'Kevin', block_label: 'Kaldheim', colors: 'U', name: 'Gigantes', row_index: 3 },
    ]);

    const stored = getExternalDecks(db);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ player: 'Kevin', name: 'Gigantes' });
    expect(stored[0].colors).toEqual(['U']);
  });

  it('orders blocks by newest release, matching the Decks view, not sheet order', () => {
    const db = createTestDb();
    insertTestSet(db, { code: 'blb', name: 'Bloomburrow', released_at: '2024-08-02' });
    insertTestSet(db, { code: 'khm', name: 'Kaldheim', released_at: '2021-02-05' });
    // The sheet lists Bloomburrow first, but Kaldheim is the older set, so the
    // newer block must still come first.
    refreshSheetBlocks(db, [
      ['Nº', 'BLOQUES'],
      ['1', 'Kaldheim'],
      ['2', 'Bloomburrow'],
    ]);
    replaceExternalDecks(db, [
      { player: 'Toni', block_label: 'Kaldheim', colors: 'B', name: 'Viejo', row_index: 5 },
      { player: 'Toni', block_label: 'Bloomburrow', colors: 'G', name: 'Nuevo', row_index: 9 },
    ]);
    expect(getExternalDecks(db).map((d) => d.name)).toEqual(['Nuevo', 'Viejo']);
  });

  it('sinks undatable blocks to the bottom and keeps sheet row order within a block', () => {
    const db = createTestDb();
    insertTestSet(db, { code: 'blb', name: 'Bloomburrow', released_at: '2024-08-02' });
    refreshSheetBlocks(db, [
      ['Nº', 'BLOQUES'],
      ['1', 'Bloque inventado'],
      ['2', 'Bloomburrow'],
    ]);
    replaceExternalDecks(db, [
      { player: 'Toni', block_label: 'Bloque inventado', colors: 'B', name: 'Sin fecha', row_index: 2 },
      { player: 'Toni', block_label: 'Bloomburrow', colors: 'G', name: 'Segundo', row_index: 9 },
      { player: 'Toni', block_label: 'Bloomburrow', colors: 'R', name: 'Primero', row_index: 4 },
    ]);
    expect(getExternalDecks(db).map((d) => d.name)).toEqual(['Primero', 'Segundo', 'Sin fecha']);
  });

  it('stores colors decoded from the sheet emoji', () => {
    const db = createTestDb();
    replaceExternalDecks(db, [
      {
        player: 'Toni',
        block_label: 'Bloomburrow',
        colors: emojiToColors('⚫🟢').join(''),
        name: 'Elfos',
        row_index: 2,
      },
    ]);
    expect(getExternalDecks(db)[0].colors).toEqual(['B', 'G']);
  });
});
