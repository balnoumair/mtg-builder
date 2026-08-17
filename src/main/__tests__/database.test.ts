import { describe, it, expect, vi } from 'vitest';
import { createTestDb, insertTestCard } from '../queries/__tests__/helpers';
import { createDeck, addCardToDeck, claimDeckFromCollection } from '../queries/decks';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

import { runMigrations } from '../database';

describe('runMigrations', () => {
  it('does not turn pending additions into confirmed cards on restart', () => {
    const db = createTestDb();
    const ownedCard = insertTestCard(db, { name: 'Owned card' });
    const addedCard = insertTestCard(db, { name: 'Added card' });
    const deck = createDeck(db, { name: 'Owned deck' });

    addCardToDeck(db, deck.id, ownedCard);
    claimDeckFromCollection(db, deck.id);
    addCardToDeck(db, deck.id, addedCard);

    runMigrations(db);

    const row = db.prepare(
      'SELECT quantity, owned_quantity FROM deck_cards WHERE deck_id = ? AND card_id = ?',
    ).get(deck.id, addedCard) as { quantity: number; owned_quantity: number | null };
    expect(row).toEqual({ quantity: 1, owned_quantity: null });
  });
});
