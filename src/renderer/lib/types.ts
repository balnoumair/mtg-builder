export type View = 'collection' | 'my-cards' | 'wants' | 'decks' | 'deck-editor';

export interface AppState {
  view: View;
  activeDeckId: number | null;
}
