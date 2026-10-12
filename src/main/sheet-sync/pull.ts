import type Database from 'better-sqlite3';
import { SHEET_BLOCK_SETS, emojiToColors, type SheetBlock } from './blockMap';
import type {
  SheetBlockMapping,
  SheetPullApplyPayload,
  SheetPullPreview,
  SheetPullRow,
} from '../../shared/types';
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

export type SheetLabelStatus = 'ediciones' | 'mazos' | 'removed';

export interface SheetLabel {
  label: string;
  position: number;
  status: Exclude<SheetLabelStatus, 'removed'>;
}

/**
 * Every label the sheet currently uses: the EDICIONES vocabulary in its own
 * order, then labels that MAZOS rows use without EDICIONES listing them (the
 * group sometimes types a block straight into MAZOS). Those trail the
 * vocabulary in first-appearance order.
 */
export function collectSheetLabels(edicionesRows: string[][], mazosLabels: string[]): SheetLabel[] {
  const out: SheetLabel[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < edicionesRows.length; i++) {
    const label = (edicionesRows[i][1] ?? '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, position: parseFloat(edicionesRows[i][0] ?? '') || i, status: 'ediciones' });
  }
  let next = out.reduce((max, l) => Math.max(max, l.position), 0);
  for (const raw of mazosLabels) {
    const label = raw.trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push({ label, position: ++next, status: 'mazos' });
  }
  return out;
}

/**
 * Upserts one sheet_blocks row per label the sheet uses. Manual mappings are
 * the user's corrections and always survive; everything else is reseeded from
 * the dictionary so seed updates propagate. Labels the sheet no longer uses
 * are marked removed rather than deleted, so a manual mapping is still there
 * if the label comes back.
 */
export function refreshSheetBlocks(
  db: Database.Database,
  edicionesRows: string[][],
  mazosLabels: string[] = [],
): void {
  const upsert = db.prepare(`
    INSERT INTO sheet_blocks (label, position, set_codes, sheet_status)
    VALUES (@label, @position, @set_codes, @status)
    ON CONFLICT(label) DO UPDATE SET
      position = @position,
      sheet_status = @status,
      set_codes = CASE WHEN manual = 1 THEN set_codes ELSE @set_codes END
  `);
  const txn = db.transaction(() => {
    db.prepare("UPDATE sheet_blocks SET sheet_status = 'removed'").run();
    for (const { label, position, status } of collectSheetLabels(edicionesRows, mazosLabels)) {
      upsert.run({
        label,
        position,
        status,
        set_codes: JSON.stringify(SHEET_BLOCK_SETS[label] ?? []),
      });
    }
  });
  txn();
}

/** Labels the sheet still uses — removed ones are never push targets. */
export function getSheetBlocks(db: Database.Database): SheetBlock[] {
  const rows = db.prepare(
    "SELECT label, position, set_codes FROM sheet_blocks WHERE sheet_status != 'removed' ORDER BY position",
  ).all() as { label: string; position: number; set_codes: string }[];
  return rows.map((r) => ({
    label: r.label,
    position: r.position,
    setCodes: JSON.parse(r.set_codes) as string[],
  }));
}

/**
 * Mapping rows for the editor, removed labels included (listed last): adds
 * the manual flag, reset availability and where the sheet uses the label.
 */
export function getSheetBlockMappings(db: Database.Database): SheetBlockMapping[] {
  const rows = db.prepare(`
    SELECT label, position, set_codes, manual, sheet_status FROM sheet_blocks
    ORDER BY sheet_status = 'removed', position
  `).all() as {
    label: string;
    position: number;
    set_codes: string;
    manual: number;
    sheet_status: SheetLabelStatus;
  }[];
  return rows.map((r) => ({
    label: r.label,
    position: r.position,
    setCodes: JSON.parse(r.set_codes) as string[],
    manual: !!r.manual,
    hasDefault: hasSeededMapping(r.label),
    sheetStatus: r.sheet_status,
  }));
}

/**
 * What applying a pull would do to the label list: labels new to this device
 * (or back after being removed), labels the sheet dropped, and labels that
 * would have no sets after the reseed.
 */
export function previewLabelChanges(
  db: Database.Database,
  sheetLabels: SheetLabel[],
): SheetPullPreview['labels'] {
  const existing = new Map(
    (db.prepare('SELECT label, set_codes, manual, sheet_status FROM sheet_blocks').all() as {
      label: string;
      set_codes: string;
      manual: number;
      sheet_status: SheetLabelStatus;
    }[]).map((r) => [r.label, r]),
  );
  const inSheet = new Set(sheetLabels.map((l) => l.label));

  const added: string[] = [];
  const unmapped: string[] = [];
  for (const { label } of sheetLabels) {
    const current = existing.get(label);
    if (!current || current.sheet_status === 'removed') added.push(label);
    const codes = current?.manual
      ? (JSON.parse(current.set_codes) as string[])
      : SHEET_BLOCK_SETS[label] ?? [];
    if (codes.length === 0) unmapped.push(label);
  }
  const removed = [...existing.values()]
    .filter((r) => r.sheet_status !== 'removed' && !inSheet.has(r.label))
    .map((r) => r.label);

  return { added, removed, unmapped };
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

  const parsed = parseMazosRows(mazos);
  // Every row's label counts, mine included: the vocabulary is the sheet's,
  // not just the part of it this device caches.
  const mazosLabels = [...new Set(parsed.map((r) => r.blockLabel).filter(Boolean))];
  const others = parsed.filter(
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
  const sheetLabels = collectSheetLabels(ediciones, mazosLabels);
  return {
    ...changes,
    labels: previewLabelChanges(db, sheetLabels),
    rows: rows as SheetPullRow[],
    ediciones,
    mazosLabels,
    players: [...new Set(rows.map((r) => r.player))],
    blockLabels: sheetLabels.length,
  };
}

export function applySheetPull(
  db: Database.Database,
  input: SheetPullApplyPayload,
): PullResult {
  refreshSheetBlocks(db, input.ediciones, input.mazosLabels);
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
