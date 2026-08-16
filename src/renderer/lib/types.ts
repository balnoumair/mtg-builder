export type View =
  | 'collection'
  | 'my-cards'
  | 'wants'
  | 'decks'
  | 'others-decks'
  | 'deck-editor';

export interface AppState {
  view: View;
  activeDeckId: number | null;
}
