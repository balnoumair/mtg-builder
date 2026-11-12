import { describe, it, expect } from 'vitest';
import { placeAppends } from '../sheetPushRows';
import type { SheetPushRowChange } from '../types';

const EMPTY = ['', '', '', ''];
const add = (name: string, block = 'Bloomburrow'): SheetPushRowChange => ({
  sheetRow: 0,
  before: EMPTY,
  row: ['Bryan', block, '🟢', name],
});
const clear = (sheetRow: number, name: string, block = 'Bloomburrow'): SheetPushRowChange => ({
  sheetRow,
  before: ['Bryan', block, '🟢', name],
  row: EMPTY,
});

describe('placeAppends', () => {
  it('puts a renamed deck back into the row its old name is cleared from', () => {
    const result = placeAppends({ updates: [], appends: [add('Nuevo')], clears: [clear(7, 'Viejo')] }, [], 20);

    expect(result.placements).toEqual([7]);
    expect(result.clears).toHaveLength(0);
    expect(result.appends).toHaveLength(0);
    expect(result.updates).toEqual([
      { sheetRow: 7, before: ['Bryan', 'Bloomburrow', '🟢', 'Viejo'], row: ['Bryan', 'Bloomburrow', '🟢', 'Nuevo'] },
    ]);
  });

  it('places the rest in the given order: free rows lowest first, then the end of the sheet', () => {
    const result = placeAppends(
      { updates: [], appends: [add('A', 'Kaldheim'), add('B', 'Kaldheim'), add('C'), add('D')], clears: [clear(9, 'X', 'Zendikar')] },
      [4],
      20,
    );

    expect(result.placements).toEqual([4, 9, 20, 21]);
    expect(result.appends.map((a) => a.sheetRow)).toEqual([4, 20, 21]);
    expect(result.updates.map((u) => u.sheetRow)).toEqual([9]);
  });

  it('gives a cleared row to a new deck from the same block before edition order', () => {
    const result = placeAppends(
      {
        updates: [],
        appends: [add('Antes', 'Bloomburrow'), add('Renombrado', 'Kaldheim')],
        clears: [clear(3, 'Viejo', 'Kaldheim')],
      },
      [5],
      10,
    );

    expect(result.placements).toEqual([5, 3]);
    expect(result.updates).toEqual([
      { sheetRow: 3, before: ['Bryan', 'Kaldheim', '🟢', 'Viejo'], row: ['Bryan', 'Kaldheim', '🟢', 'Renombrado'] },
    ]);
  });

  it('keeps clears that no new deck needs', () => {
    const result = placeAppends(
      { updates: [], appends: [add('A')], clears: [clear(3, 'X'), clear(8, 'Y')] },
      [],
      20,
    );

    expect(result.placements).toEqual([3]);
    expect(result.clears.map((c) => c.sheetRow)).toEqual([8]);
  });

  it('ignores blank rows at or past the end row', () => {
    const result = placeAppends({ updates: [], appends: [add('A')], clears: [] }, [25], 20);
    expect(result.placements).toEqual([20]);
  });

  it('never targets a row twice', () => {
    const result = placeAppends(
      { updates: [], appends: [add('A'), add('B'), add('C')], clears: [clear(5, 'X')] },
      [5, 6],
      7,
    );
    const rows = [...result.updates, ...result.appends, ...result.clears].map((c) => c.sheetRow);
    expect(new Set(rows).size).toBe(rows.length);
    expect(result.placements).toEqual([5, 6, 7]);
  });
});
