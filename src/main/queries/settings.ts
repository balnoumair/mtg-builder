import type Database from 'better-sqlite3';
import {
  DEFAULT_CARD_LANGUAGE,
  parseSyncLanguages,
  serializeSyncLanguages,
  type CardLanguageCode,
} from '../../shared/cardLanguages';
import { DEFAULT_APP_LOCALE, isAppLocale, type AppLocale } from '../../shared/i18n';
import type { AppSettings } from '../../shared/types';

export const SETTINGS_DEFAULTS = {
  'sheetSync.playerName': 'Bryan',
  // No default: the spreadsheet is configured by hand, like the credentials.
  'sheetSync.spreadsheetId': '',
  'sheetSync.serviceAccountKeyPath': '',
  'sheetSync.lastPulledAt': '',
  'sheetSync.lastPushedAt': '',
  'driveSync.backupFileId': '',
  'driveSync.lastPushedAt': '',
  'driveSync.lastPulledAt': '',
  'app.locale': DEFAULT_APP_LOCALE,
  'cards.syncLanguages': serializeSyncLanguages([DEFAULT_CARD_LANGUAGE]),
  'cards.browseLanguage': DEFAULT_CARD_LANGUAGE,
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
    lastPushedAt: getSetting(db, 'sheetSync.lastPushedAt'),
  };
}

export function getDriveSyncSettings(db: Database.Database) {
  return {
    backupFileId: getSetting(db, 'driveSync.backupFileId'),
    lastPushedAt: getSetting(db, 'driveSync.lastPushedAt'),
    lastPulledAt: getSetting(db, 'driveSync.lastPulledAt'),
  };
}

export function getAppSettings(db: Database.Database): AppSettings {
  const localeRaw = getSetting(db, 'app.locale');
  const browseRaw = getSetting(db, 'cards.browseLanguage');
  return {
    locale: isAppLocale(localeRaw) ? localeRaw : DEFAULT_APP_LOCALE,
    syncLanguages: parseSyncLanguages(getSetting(db, 'cards.syncLanguages')),
    browseLanguage: browseRaw || DEFAULT_CARD_LANGUAGE,
  };
}

export function updateAppSettings(
  db: Database.Database,
  updates: Partial<AppSettings>,
): AppSettings {
  if (updates.locale !== undefined && isAppLocale(updates.locale)) {
    setSetting(db, 'app.locale', updates.locale as AppLocale);
  }
  if (updates.syncLanguages !== undefined) {
    setSetting(
      db,
      'cards.syncLanguages',
      serializeSyncLanguages(updates.syncLanguages as CardLanguageCode[]),
    );
  }
  if (updates.browseLanguage !== undefined) {
    setSetting(db, 'cards.browseLanguage', updates.browseLanguage);
  }
  return getAppSettings(db);
}

export function getSyncLanguages(db: Database.Database): CardLanguageCode[] {
  return parseSyncLanguages(getSetting(db, 'cards.syncLanguages'));
}
