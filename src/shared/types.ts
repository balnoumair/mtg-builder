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
  price_usd: string | null;
  price_eur: string | null;
  released_at: string;
  artist: string;
}

export interface Deck {
  id: number;
  name: string;
  format: string;
  description: string;
  cover_card_id: string | null;
  created_at: string;
  updated_at: string;
  card_count?: number;
}

export interface DeckCard {
  id: number;
  deck_id: number;
  card_id: string;
  quantity: number;
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
  uniqueBy?: 'oracle_id';
}

export interface CardSearchResult {
  cards: Card[];
  total: number;
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

export interface ElectronAPI {
  getDbStatus(): Promise<DbStatus>;
  syncCards(): Promise<void>;
  onSyncProgress(callback: (progress: ImportProgress) => void): () => void;
  searchCards(filters: CardFilters): Promise<CardSearchResult>;
  getCard(id: string): Promise<Card | null>;
  getCardPrintings(oracleId: string): Promise<Card[]>;
  getSets(): Promise<{ code: string; name: string; releasedAt: string }[]>;
  getDecks(): Promise<Deck[]>;
  createDeck(deck: { name: string; format?: string }): Promise<Deck>;
  updateDeck(id: number, updates: Partial<Deck>): Promise<Deck>;
  deleteDeck(id: number): Promise<void>;
  getDeckCards(deckId: number): Promise<DeckCard[]>;
  addCardToDeck(deckId: number, cardId: string, board?: string): Promise<void>;
  updateCardQuantity(deckId: number, cardId: string, board: string, quantity: number): Promise<void>;
  removeCardFromDeck(deckId: number, cardId: string, board: string): Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
