import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Database from 'better-sqlite3';
import { BACKUP_KIND, BACKUP_VERSION } from '../backup';
import { parseDriveFileId, pullBackupFromDrive, pushBackupToDrive } from '../drive-sync';
import { getAccessToken } from '../sheet-sync/googleAuth';
import { setSetting } from '../queries/settings';
import { createTestDb, insertTestCard } from '../queries/__tests__/helpers';

vi.mock('../sheet-sync/googleAuth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
}));

let db: Database.Database;
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  db = createTestDb();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.mocked(getAccessToken).mockClear();
  setSetting(db, 'sheetSync.serviceAccountKeyPath', '/tmp/test-service-account.json');
  setSetting(db, 'driveSync.backupFileId', 'drive-file-123');
});

describe('parseDriveFileId', () => {
  it('accepts a bare id and common Drive file links', () => {
    expect(parseDriveFileId('drive-file-123')).toBe('drive-file-123');
    expect(parseDriveFileId('https://drive.google.com/file/d/drive-file-123/view?usp=sharing')).toBe(
      'drive-file-123',
    );
    expect(parseDriveFileId('https://drive.google.com/open?id=drive-file-123')).toBe('drive-file-123');
    expect(parseDriveFileId('https://drive.google.com/uc?id=drive-file-123&export=download')).toBe(
      'drive-file-123',
    );
  });

  it('rejects empty values, malformed URLs, and folder links', () => {
    expect(parseDriveFileId('')).toBe('');
    expect(parseDriveFileId('not a drive link')).toBe('');
    expect(parseDriveFileId('https://example.com/open?id=drive-file-123')).toBe('');
    expect(parseDriveFileId('https://drive.google.com/drive/folders/folder-123')).toBe('');
  });
});

describe('pushBackupToDrive', () => {
  it('replaces the configured Drive file with the current backup', async () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    db.prepare('INSERT INTO collection (card_id, quantity) VALUES (?, ?)').run('p-1', 2);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ id: 'drive-file-123', name: 'mtg-builder-backup.json' }))
      .mockResolvedValueOnce(jsonResponse({
        id: 'drive-file-123',
        name: 'mtg-builder-backup.json',
        modifiedTime: '2026-08-29T10:00:00.000Z',
      }));

    const result = await pushBackupToDrive(db);

    expect(result).toMatchObject({
      pushed: true,
      fileId: 'drive-file-123',
      fileName: 'mtg-builder-backup.json',
    });
    expect(getAccessToken).toHaveBeenCalledWith('/tmp/test-service-account.json');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const uploadCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(uploadCall[0]).toContain('/upload/drive/v3/files/drive-file-123');
    expect(uploadCall[1].method).toBe('PATCH');
    expect(uploadCall[1].body).toContain(BACKUP_KIND);
    expect(uploadCall[1].body).toContain('Alpha');
  });
});

describe('pullBackupFromDrive', () => {
  it('downloads and imports the configured Drive file', async () => {
    insertTestCard(db, { id: 'p-1', oracle_id: 'o-1', name: 'Alpha', set_code: 'aaa' });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        id: 'drive-file-123',
        name: 'mtg-builder-backup.json',
        modifiedTime: '2026-08-29T10:00:00.000Z',
      }))
      .mockResolvedValueOnce(jsonResponse({
        kind: BACKUP_KIND,
        version: BACKUP_VERSION,
        exported_at: '2026-08-29T09:00:00.000Z',
        decks: [],
        collection: [{
          name: 'Alpha',
          oracle_id: 'o-1',
          set_code: 'aaa',
          quantity: 4,
          added_at: null,
        }],
      }));

    const result = await pullBackupFromDrive(db);

    expect(result).toMatchObject({
      fileId: 'drive-file-123',
      fileName: 'mtg-builder-backup.json',
      collectionCards: 1,
      missing: [],
    });
    expect(db.prepare('SELECT card_id, quantity FROM collection').all()).toEqual([
      { card_id: 'p-1', quantity: 4 },
    ]);
    expect(fetchMock.mock.calls[1][0]).toContain('alt=media');
  });
});
