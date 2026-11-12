import type { SheetPushRowChange } from './types';

type PickedChanges = {
  updates: SheetPushRowChange[];
  appends: SheetPushRowChange[];
  clears: SheetPushRowChange[];
};

const blockOf = (cells: string[]) => (cells[1] ?? '').trim().toLowerCase();

/**
 * Decides which sheet row each new deck goes into. `picked.appends` should
 * already be in the order they belong in the sheet (edition order).
 *
 * 1. A row this push is clearing goes first to a new deck from the same
 *    block, so a renamed deck stays in its own row.
 * 2. The other new decks, in order, take the remaining free rows lowest
 *    first: rows still being cleared, then rows already fully blank above the
 *    last used row, then rows past the end.
 *
 * When a new deck takes a row being cleared, the two become one overwrite of
 * that row (an update whose `before` is the old deck). Otherwise the write
 * would expect an empty row that still holds the old deck.
 *
 * `placements[i]` is the row given to `picked.appends[i]`.
 */
export function placeAppends(
  picked: PickedChanges,
  blankRows: number[],
  endRow: number,
): PickedChanges & { placements: number[] } {
  const updatedRows = new Set(picked.updates.map((c) => c.sheetRow));
  const clears = picked.clears.filter((c) => !updatedRows.has(c.sheetRow)).sort((a, b) => a.sheetRow - b.sheetRow);
  const clearsByRow = new Map(clears.map((c) => [c.sheetRow, c]));
  const placements: (number | undefined)[] = picked.appends.map(() => undefined);
  const taken = new Set<number>();

  for (const cleared of clears) {
    const i = picked.appends.findIndex(
      (add, idx) => placements[idx] === undefined && blockOf(add.row) === blockOf(cleared.before),
    );
    if (i === -1) continue;
    placements[i] = cleared.sheetRow;
    taken.add(cleared.sheetRow);
  }

  const free = [...new Set([...clearsByRow.keys(), ...blankRows.filter((r) => r < endRow)])]
    .filter((r) => !updatedRows.has(r) && !taken.has(r))
    .sort((a, b) => a - b);
  let nextFree = 0;
  let nextEnd = endRow;
  for (let i = 0; i < placements.length; i++) {
    if (placements[i] === undefined) placements[i] = nextFree < free.length ? free[nextFree++] : nextEnd++;
  }

  const updates = [...picked.updates];
  const appends: SheetPushRowChange[] = [];
  const reused = new Set<number>();
  picked.appends.forEach((add, i) => {
    const sheetRow = placements[i] as number;
    const cleared = clearsByRow.get(sheetRow);
    if (cleared) {
      reused.add(sheetRow);
      updates.push({ sheetRow, before: cleared.before, row: add.row });
    } else {
      appends.push({ sheetRow, before: ['', '', '', ''], row: add.row });
    }
  });

  return {
    updates,
    appends,
    clears: picked.clears.filter((c) => !reused.has(c.sheetRow)),
    placements: placements as number[],
  };
}
