export interface BackupDeckCard {
  name: string;
  oracle_id: string;
  set_code: string;
  board: string;
  quantity: number;
  owned_quantity: number | null;
  ignore_copy_limit: number;
}

export interface BackupDeck {
  /** Stable deck identity; absent on backups written before uuids existed. */
  uuid?: string;
  name: string;
  format: string;
  description: string;
  owned: number;
  cover: { oracle_id: string; set_code: string } | null;
  filter_sets?: string[];
  tags?: string[];
  cards: BackupDeckCard[];
}

export interface BackupTag {
  uuid: string;
  name: string;
  color: string;
}

export interface BackupCollectionCard {
  name: string;
  oracle_id: string;
  set_code: string;
  quantity: number;
  added_at: string | null;
}

export interface AppBackup {
  kind: 'mtg-builder-backup';
  version: number;
  exported_at: string;
  tags?: BackupTag[];
  decks: BackupDeck[];
  collection: BackupCollectionCard[];
}

export type BackupApplyMode = 'merge' | 'replace';

export interface BackupPreviewDeck {
  name: string;
  uuid?: string;
  action: 'add' | 'overwrite';
  existingName?: string;
  cardCount: number;
}

export interface BackupPreviewCard {
  name: string;
  quantity: number;
}

export interface BackupPreview {
  exportedAt: string;
  decks: {
    add: BackupPreviewDeck[];
    overwrite: BackupPreviewDeck[];
    remove: string[];
  };
  collection: {
    add: BackupPreviewCard[];
    overwrite: BackupPreviewCard[];
    remove: number;
  };
  tags: {
    add: string[];
    remove: string[];
  };
  missing: Array<{ deck: string | null; card: string; quantity: number }>;
}

export interface BackupPreviewResult {
  preview?: BackupPreview;
  backup?: AppBackup;
  filePath?: string;
  fileId?: string;
  fileName?: string;
  modifiedTime?: string;
  canceled?: boolean;
  error?: string;
}
