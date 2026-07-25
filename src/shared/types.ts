import type { DeckSetGroup } from './deckSetGroup';
import type { TagColor } from './tagColors';

export interface Tag {
  id: number;
  /** Stable identity for backup import; assigned on create. */
  uuid: string;
  name: string;
  color: TagColor;
  /** Decks carrying this tag; present on the tag list, omitted on a deck's own tags. */
  deck_count?: number;
}

export interface Card {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  keywords: string[];
  power: string | null;
  toughness: string | null;
  rarity: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  layout: string;
  image_uri_small: string | null;
  image_uri_normal: string | null;
  image_uri_large: string | null;
  image_uri_art_crop: string | null;
  face_back_name: string | null;
  face_back_image_uri_normal: string | null;
  legalities: Record<string, string>;
  released_at: string;
  artist: string;
}

export interface Deck {
  id: number;
  /** Stable identity for backup import; assigned on create / migration. */
  uuid: string;
  name: string;
  format: string;
  description: string;
  cover_card_id: string | null;
  owned: boolean;
  created_at: string;
  updated_at: string;
  card_count?: number;
  color_identity?: string[];
  set_group?: DeckSetGroup;
  tags?: Tag[];
}

export interface DeckCard {
  id: number;
  deck_id: number;
  card_id: string;
  quantity: number;
  /** Confirmed quantity for owned decks; null for unowned decks and pending additions. */
  owned_quantity: number | null;
  /** When true, the copy limit is not enforced for this card in this deck. */
  ignore_copy_limit: boolean;
  board: 'main' | 'sideboard';
  card?: Card;
}

export interface CardFilters {
  query?: string;
  colors?: string[];
  colorMode?: 'include' | 'exact' | 'at_most';
  types?: string[];
  rarity?: string[];
  sets?: string[];
  cmcMin?: number;
  cmcMax?: number;
  format?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'name' | 'cmc' | 'rarity' | 'released_at';
}

export interface CardSearchResult {
  cards: Card[];
  total: number;
}

export interface CardSet {
  code: string;
  name: string;
  releasedAt: string;
  blockCode: string | null;
  blockName: string | null;
  iconSvgUri?: string | null;
}

export interface CollectionCard {
  card_id: string;
  quantity: number;
  added_at: string;
  card: Card;
}

export interface CollectionStats {
  uniqueCards: number;
  totalCopies: number;
}

export interface WantSource {
  deck_id: number;
  deck_name: string;
  /** True when the need is an unconfirmed addition to an owned deck (vs a wishlist deck). */
  pending: boolean;
  need: number;
}

/** A card still to buy: needs and owned copies are matched by name across printings. */
export interface WantItem {
  name: string;
  /** Copies wanted across all wishlist decks and pending additions. */
  needed: number;
  /** Copies of any printing already in the collection. */
  owned: number;
  /** max(needed - owned, 0); items are omitted when 0. */
  to_buy: number;
  /** Representative printing, for image/mana display. */
  card: Card;
  sources: WantSource[];
}

export interface ImportProgress {
  current: number;
  total: number;
  phase: 'downloading' | 'reading' | 'indexing' | 'done';
}

export interface DbStatus {
  ready: boolean;
  cardCount: number;
}

export interface ExportBackupResult {
  saved: boolean;
  path?: string;
  error?: string;
}

export interface ImportBackupResult {
  /** Decks newly inserted (no matching local uuid). */
  decksImported: number;
  /** Existing local decks replaced by the backup copy (matched by uuid). */
  decksUpdated: number;
  /** Collection cards written from the backup (new or overwritten). */
  collectionCards: number;
  /** Tags newly created; tags matched to an existing local tag are not counted. */
  tagsImported: number;
  /** Cards from the backup that no longer exist in the local database; deck is null for collection entries. */
  missing: Array<{ deck: string | null; card: string; quantity: number }>;
  /** Edition filters to restore into localStorage (empty sets = clear). Absent on cancel/error. */
  filterSets?: Array<{ uuid: string; sets: string[] }>;
  canceled?: boolean;
  error?: string;
}

export interface ElectronAPI {
  getDbStatus(): Promise<DbStatus>;
  syncCards(): Promise<void>;
  onSyncProgress(callback: (progress: ImportProgress) => void): () => void;
  searchCards(filters: CardFilters): Promise<CardSearchResult>;
  getCard(id: string): Promise<Card | null>;
  getSets(): Promise<CardSet[]>;
  getDecks(): Promise<Deck[]>;
  getTags(): Promise<Tag[]>;
  createTag(input: { name: string; color?: string }): Promise<Tag>;
  updateTag(id: number, updates: { name?: string; color?: string }): Promise<Tag>;
  deleteTag(id: number): Promise<void>;
  setDeckTags(deckId: number, tagIds: number[]): Promise<void>;
  exportBackup(filterSetsByUuid?: Record<string, string[]>): Promise<ExportBackupResult>;
  importBackup(): Promise<ImportBackupResult>;
  createDeck(deck: { name: string; format?: string }): Promise<Deck>;
  updateDeck(id: number, updates: Partial<Deck>): Promise<Deck>;
  deleteDeck(id: number): Promise<void>;
  getDeckCards(deckId: number): Promise<DeckCard[]>;
  addCardToDeck(deckId: number, cardId: string, board?: string, count?: number): Promise<void>;
  updateCardQuantity(deckId: number, cardId: string, board: string, quantity: number): Promise<void>;
  removeCardFromDeck(deckId: number, cardId: string, board: string): Promise<void>;
  setDeckCardIgnoreLimit(deckId: number, cardId: string, ignore: boolean): Promise<void>;
  claimDeckFromCollection(deckId: number): Promise<void>;
  confirmDeckChanges(deckId: number): Promise<void>;
  discardDeckChanges(deckId: number): Promise<void>;
  getCollection(filters: CardFilters): Promise<{ cards: CollectionCard[]; total: number }>;
  getCollectionQuantities(cardIds: string[]): Promise<Record<string, number>>;
  addToCollection(cardId: string, quantity?: number): Promise<void>;
  updateCollectionQuantity(cardId: string, quantity: number): Promise<void>;
  removeFromCollection(cardId: string): Promise<void>;
  getCollectionStats(): Promise<CollectionStats>;
  getWants(): Promise<WantItem[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
