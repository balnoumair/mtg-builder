export type View = 'collection' | 'my-cards' | 'decks' | 'deck-editor';

export interface AppState {
  view: View;
  activeDeckId: number | null;
}
