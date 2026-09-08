import type Database from 'better-sqlite3';
import { exportBackup, importBackup } from './backup';
import { getAccessToken } from './sheet-sync/googleAuth';
import { getDriveSyncSettings, getSheetSyncSettings, setSetting } from './queries/settings';
import type { DrivePullResult, DrivePushResult } from '../shared/types';

const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

interface DriveFile {
  id: string;
  name?: string;
  mimeType?: string;
  modifiedTime?: string;
}

interface DriveErrorBody {
  error?: {
    message?: string;
    status?: string;
    code?: number;
  };
}

/** Accept a Drive file URL or a bare file id, like the sheet setting does. */
export function parseDriveFileId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.toLowerCase();
    if (host !== 'drive.google.com' && host !== 'docs.google.com') return '';

    const pathMatch = url.pathname.match(
      /\/(?:file\/d|document\/d|spreadsheets\/d)\/([a-zA-Z0-9_-]+)/,
    );
    if (pathMatch) return pathMatch[1];

    const queryId = url.searchParams.get('id');
    if (queryId && /^[a-zA-Z0-9_-]+$/.test(queryId)) return queryId;
  } catch {
    // The caller reports an invalid value through the settings UI.
  }

  return '';
}

function requireBackupFileId(db: Database.Database): string {
  const { backupFileId } = getDriveSyncSettings(db);
  if (!backupFileId) {
    throw new Error('No Drive backup file configured — paste the Drive file link in the backup settings first.');
  }
  return backupFileId;
}

function requireServiceAccountKey(db: Database.Database): string {
  const { serviceAccountKeyPath } = getSheetSyncSettings(db);
  if (!serviceAccountKeyPath) {
    throw new Error('No service-account key configured — pick the key in the Playgroup sheet settings first.');
  }
  return serviceAccountKeyPath;
}

async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function driveError(response: Response, body: unknown): Error {
  const error = body && typeof body === 'object'
    ? (body as DriveErrorBody).error
    : undefined;

  if (response.status === 403) {
    return new Error(
      'Drive access denied — share the backup file with the service account as Editor and make sure the Drive API is enabled.',
    );
  }
  if (response.status === 404) {
    return new Error('Drive backup file not found — check the file link and its sharing permissions.');
  }

  return new Error(`Drive API error: ${error?.message ?? response.status}`);
}

async function driveRequest(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers });
  const body = await responseBody(response);
  if (!response.ok) throw driveError(response, body);
  return body;
}

async function getBackupFile(token: string, fileId: string): Promise<DriveFile> {
  const body = await driveRequest(
    token,
    `${DRIVE_FILES_API}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime&supportsAllDrives=true`,
  );
  const file = body as Partial<DriveFile>;
  if (!file.id) throw new Error('Drive did not return a valid backup file.');
  return file as DriveFile;
}

export async function pushBackupToDrive(
  db: Database.Database,
  filterSetsByUuid: Record<string, string[]> = {},
): Promise<DrivePushResult> {
  const backup = exportBackup(db, filterSetsByUuid);
  if (backup.decks.length === 0 && backup.collection.length === 0) {
    throw new Error('Nothing to back up');
  }

  const fileId = requireBackupFileId(db);
  const token = await getAccessToken(requireServiceAccountKey(db));
  const file = await getBackupFile(token, fileId);
  const body = await driveRequest(
    token,
    `${DRIVE_UPLOAD_API}/${encodeURIComponent(file.id)}?uploadType=media&supportsAllDrives=true&fields=id,name,mimeType,modifiedTime`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(backup, null, 2),
    },
  );

  const updated = body as Partial<DriveFile>;
  const pushedAt = new Date().toISOString();
  setSetting(db, 'driveSync.backupFileId', file.id);
  setSetting(db, 'driveSync.lastPushedAt', pushedAt);

  return {
    pushed: true,
    fileId: file.id,
    fileName: updated.name ?? file.name,
    modifiedTime: updated.modifiedTime ?? pushedAt,
  };
}

export async function pullBackupFromDrive(db: Database.Database): Promise<DrivePullResult> {
  const fileId = requireBackupFileId(db);
  const token = await getAccessToken(requireServiceAccountKey(db));
  const file = await getBackupFile(token, fileId);
  const parsed = await driveRequest(
    token,
    `${DRIVE_FILES_API}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`,
    { headers: { Accept: 'application/json' } },
  );
  const summary = importBackup(db, parsed);
  setSetting(db, 'driveSync.backupFileId', file.id);
  setSetting(db, 'driveSync.lastPulledAt', new Date().toISOString());

  return {
    ...summary,
    fileId: file.id,
    fileName: file.name,
    modifiedTime: file.modifiedTime,
  };
}
