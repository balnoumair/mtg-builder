import type Database from 'better-sqlite3';

export const SETTINGS_DEFAULTS = {
  'sheetSync.playerName': 'Bryan',
  // No default: the spreadsheet is configured by hand, like the credentials.
  'sheetSync.spreadsheetId': '',
  'sheetSync.serviceAccountKeyPath': '',
  'sheetSync.lastPulledAt': '',
  'sheetSync.lastPushedAt': '',
} as const;

export type SettingKey = keyof typeof SETTINGS_DEFAULTS;

export function getSetting(db: Database.Database, key: SettingKey): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? SETTINGS_DEFAULTS[key];
}

export function setSetting(db: Database.Database, key: SettingKey, value: string): void {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (@key, @value)
    ON CONFLICT(key) DO UPDATE SET value = @value
  `).run({ key, value });
}

export function getSheetSyncSettings(db: Database.Database) {
  return {
    playerName: getSetting(db, 'sheetSync.playerName'),
    spreadsheetId: getSetting(db, 'sheetSync.spreadsheetId'),
    serviceAccountKeyPath: getSetting(db, 'sheetSync.serviceAccountKeyPath'),
    lastPulledAt: getSetting(db, 'sheetSync.lastPulledAt'),
  };
}
