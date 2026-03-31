export type View = 'collection' | 'decks' | 'deck-editor';

export interface AppState {
  view: View;
  activeDeckId: number | null;
}
