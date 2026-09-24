import type Database from 'better-sqlite3';
import { SHEET_BLOCK_SETS, emojiToColors, type SheetBlock } from './blockMap';
import type { SheetBlockMapping, SheetPullPreview, SheetPullRow } from '../../shared/types';
import {
  getExternalDeckRows,
  replaceExternalDecks,
  type ExternalDeckRow,
} from '../queries/externalDecks';
import { getAccessToken } from './googleAuth';
import { getSheetSyncSettings, setSetting } from '../queries/settings';

export const MAZOS_SHEET = 'MAZOS';
export const EDICIONES_SHEET = 'EDICIONES';
const EXPECTED_HEADER = ['Jugador', 'Bloque/Edición', 'Colores', 'Mazo'];
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * Accepts either a bare spreadsheet id or any Google Sheets URL containing
 * one, so the setting can be filled by pasting the address bar.
 */
export function parseSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const fromUrl = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl) return fromUrl[1];
  const bare = trimmed.match(/^[a-zA-Z0-9-_]+$/);
  return bare ? trimmed : '';
}

export function requireSpreadsheetId(spreadsheetId: string): string {
  if (!spreadsheetId) {
    throw new Error('No spreadsheet configured — paste the sheet link in the Playgroup sheet settings first.');
  }
  return spreadsheetId;
}

export async function sheetsApi(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${SHEETS_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const error = body.error as { message?: string; status?: string } | undefined;
    if (error?.status === 'PERMISSION_DENIED') {
      throw new Error(
        'The service account has no access — share the spreadsheet with its client_email (Viewer is enough for pull; Editor is required for push).',
      );
    }
    throw new Error(`Sheets API error: ${error?.message ?? res.status}`);
  }
  return body;
}

export async function fetchSheetValues(
  token: string,
  spreadsheetId: string,
  sheetName: string,
): Promise<string[][]> {
  requireSpreadsheetId(spreadsheetId);
  const range = encodeURIComponent(`${sheetName}!A:D`);
  const body = await sheetsApi(
    token,
    `/${spreadsheetId}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
  );
  return (body.values ?? []) as string[][];
}

export function assertMazosHeader(rows: string[][]): void {
  const header = rows[0] ?? [];
  const actual = header.slice(0, EXPECTED_HEADER.length).map((h) => h.trim());
  if (EXPECTED_HEADER.some((expected, i) => actual[i] !== expected)) {
    throw new Error(
      `MAZOS columns changed: expected [${EXPECTED_HEADER.join(', ')}], found [${actual.join(', ')}]. Sync aborted to avoid corrupting the sheet.`,
    );
  }
}

export interface MazosRow {
  /** 1-based spreadsheet row (CSV row 0 is sheet row 1, the header). */
  sheetRow: number;
  player: string;
  blockLabel: string;
  colors: string;
  deckName: string;
}

export function parseMazosRows(rows: string[][]): MazosRow[] {
  const out: MazosRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const [player = '', blockLabel = '', colors = '', deckName = ''] = rows[i];
    if (!player.trim() && !deckName.trim()) continue;
    out.push({
      sheetRow: i + 1,
      player: player.trim(),
      blockLabel: blockLabel.trim(),
      colors: colors.trim(),
      deckName: deckName.trim(),
    });
  }
  return out;
}

/**
 * Upserts one sheet_blocks row per EDICIONES label. Manual mappings are the
 * user's corrections and always survive; everything else is reseeded from the
 * dictionary so seed updates propagate.
 */
export function refreshSheetBlocks(
  db: Database.Database,
  edicionesRows: string[][],
): void {
  const upsert = db.prepare(`
    INSERT INTO sheet_blocks (label, position, set_codes)
    VALUES (@label, @position, @set_codes)
    ON CONFLICT(label) DO UPDATE SET
      position = @position,
      set_codes = CASE WHEN manual = 1 THEN set_codes ELSE @set_codes END
  `);
  const txn = db.transaction(() => {
    for (let i = 1; i < edicionesRows.length; i++) {
      const label = (edicionesRows[i][1] ?? '').trim();
      if (!label) continue;
      const position = parseFloat(edicionesRows[i][0] ?? '') || i;
      upsert.run({
        label,
        position,
        set_codes: JSON.stringify(SHEET_BLOCK_SETS[label] ?? []),
      });
    }
  });
  txn();
}

export function getSheetBlocks(db: Database.Database): SheetBlock[] {
  const rows = db.prepare(
    'SELECT label, position, set_codes FROM sheet_blocks ORDER BY position',
  ).all() as { label: string; position: number; set_codes: string }[];
  return rows.map((r) => ({
    label: r.label,
    position: r.position,
    setCodes: JSON.parse(r.set_codes) as string[],
  }));
}

/** Mapping rows for the editor: adds the manual flag and reset availability. */
export function getSheetBlockMappings(db: Database.Database): SheetBlockMapping[] {
  const rows = db.prepare(
    'SELECT label, position, set_codes, manual FROM sheet_blocks ORDER BY position',
  ).all() as { label: string; position: number; set_codes: string; manual: number }[];
  return rows.map((r) => ({
    label: r.label,
    position: r.position,
    setCodes: JSON.parse(r.set_codes) as string[],
    manual: !!r.manual,
    hasDefault: hasSeededMapping(r.label),
  }));
}

/** Replaces a label's set codes with the user's own list (a manual mapping). */
export function setSheetBlockCodes(
  db: Database.Database,
  label: string,
  setCodes: string[],
): void {
  const cleaned = [
    ...new Set(setCodes.map((c) => c.trim().toLowerCase()).filter(Boolean)),
  ];
  const result = db.prepare(
    'UPDATE sheet_blocks SET set_codes = ?, manual = 1 WHERE label = ?',
  ).run(JSON.stringify(cleaned), label);
  if (result.changes === 0) throw new Error(`Unknown sheet label: ${label}`);
}

/** Drops a manual override, restoring the seeded dictionary mapping. */
export function resetSheetBlockCodes(db: Database.Database, label: string): void {
  const result = db.prepare(
    'UPDATE sheet_blocks SET set_codes = ?, manual = 0 WHERE label = ?',
  ).run(JSON.stringify(SHEET_BLOCK_SETS[label] ?? []), label);
  if (result.changes === 0) throw new Error(`Unknown sheet label: ${label}`);
}

/** Whether the seed dictionary knows this label, i.e. a reset would restore something. */
export function hasSeededMapping(label: string): boolean {
  return !!SHEET_BLOCK_SETS[label];
}

export interface PullResult {
  imported: number;
  players: string[];
  blockLabels: number;
}

function sameSheetRow(a: ExternalDeckRow, b: ExternalDeckRow): boolean {
  return a.player === b.player &&
    a.block_label === b.block_label &&
    a.colors === b.colors &&
    a.name === b.name &&
    a.row_index === b.row_index;
}

function previewRows(
  current: ExternalDeckRow[],
  incoming: ExternalDeckRow[],
): Pick<SheetPullPreview, 'added' | 'updated' | 'removed'> {
  const currentByRow = new Map(current.map((row) => [row.row_index, row]));
  const incomingByRow = new Map(incoming.map((row) => [row.row_index, row]));
  const added: SheetPullPreview['added'] = [];
  const updated: SheetPullPreview['updated'] = [];
  const removed: SheetPullPreview['removed'] = [];

  for (const row of incoming) {
    const previous = currentByRow.get(row.row_index);
    if (!previous) added.push(row);
    else if (!sameSheetRow(previous, row)) updated.push({ ...row, previous });
  }
  for (const row of current) {
    if (!incomingByRow.has(row.row_index)) removed.push(row);
  }

  return { added, updated, removed };
}

export async function previewSheetPull(db: Database.Database): Promise<SheetPullPreview> {
  const { playerName: configuredPlayer, spreadsheetId: configuredSheet, serviceAccountKeyPath } =
    getSheetSyncSettings(db);
  const spreadsheetId = requireSpreadsheetId(configuredSheet);
  const playerName = configuredPlayer.trim().toLowerCase();
  const token = await getAccessToken(serviceAccountKeyPath);

  const [mazos, ediciones] = await Promise.all([
    fetchSheetValues(token, spreadsheetId, MAZOS_SHEET),
    fetchSheetValues(token, spreadsheetId, EDICIONES_SHEET),
  ]);
  assertMazosHeader(mazos);

  const others = parseMazosRows(mazos).filter(
    (r) => r.player.toLowerCase() !== playerName,
  );
  const rows: ExternalDeckRow[] = others.map((r) => ({
    player: r.player,
    block_label: r.blockLabel,
    colors: emojiToColors(r.colors).join(''),
    name: r.deckName,
    row_index: r.sheetRow,
  }));

  // The preview must not mutate the cached decks or the pull timestamp. The
  // EDICIONES tab is needed for the eventual local apply, so it travels with
  // the preview payload. It is intentionally never sent back to Google.
  const current = getExternalDeckRows(db);
  const changes = previewRows(current, rows);
  return {
    ...changes,
    rows: rows as SheetPullRow[],
    ediciones,
    players: [...new Set(rows.map((r) => r.player))],
    blockLabels: ediciones.length > 0 ? ediciones.length - 1 : 0,
  };
}

export function applySheetPull(
  db: Database.Database,
  input: { rows: SheetPullRow[]; ediciones: string[][] },
): PullResult {
  refreshSheetBlocks(db, input.ediciones);
  replaceExternalDecks(db, input.rows);
  setSetting(db, 'sheetSync.lastPulledAt', new Date().toISOString());

  return {
    imported: input.rows.length,
    players: [...new Set(input.rows.map((r) => r.player))],
    blockLabels: getSheetBlocks(db).length,
  };
}

export async function pullFromSheet(db: Database.Database): Promise<PullResult> {
  const preview = await previewSheetPull(db);
  return applySheetPull(db, preview);
}
