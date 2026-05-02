# Deck Management Specification

## Purpose

Lets users build, edit, organise, claim, and export Magic decks against the local card mirror. Decks are stored alongside the user's data in SQLite and survive resyncs. Each deck consists of a `main` board and an optional `sideboard` board.

## Requirements

### Requirement: Deck CRUD

The application SHALL expose deck-level CRUD via IPC:

- `decks:list` — every deck with derived `card_count` (sum of main-board quantities), ordered by `updated_at DESC`
- `decks:create({ name, format? })` — inserts a new deck (`format` defaults to `''`) and returns the full row
- `decks:update(id, partial)` — patches any of `name`, `format`, `description`, `cover_card_id`, `owned`; always bumps `updated_at`
- `decks:delete(id)` — deletes the deck (cascades to `deck_cards` via FK)

The `owned` column SHALL be exposed as a JS `boolean` in the `Deck` type even though it is stored as `INTEGER` (0/1).

#### Scenario: Create with default format

- **WHEN** `createDeck(db, { name: 'My Deck' })` is called
- **THEN** a row is inserted with `format: ''` and the returned object has `owned: false`, `created_at` and `updated_at` set to "now"

#### Scenario: Partial update

- **WHEN** `updateDeck(db, 7, { description: 'aggro list' })` runs
- **THEN** only `description` and `updated_at` are written; `name`, `format`, etc. are unchanged

#### Scenario: Listing sums only main board

- **WHEN** a deck has 60 main-board copies and 15 sideboard copies
- **THEN** its `card_count` in `decks:list` is 60

### Requirement: Deck contents on two boards

A deck's cards SHALL live in `deck_cards` with a `board` value of `'main'` or `'sideboard'`. The unique constraint `(deck_id, card_id, board)` SHALL ensure at most one row per card per board, with `quantity` representing copies.

#### Scenario: Same card in both boards

- **WHEN** card X is in `main` (qty 4) and also `sideboard` (qty 2)
- **THEN** two distinct `deck_cards` rows exist, neither violating the unique constraint

### Requirement: Deck card listing joins card data

The `decks:getCards(deckId)` handler SHALL return every `deck_cards` row for the deck, joined with the matching `cards` row, ordered by `cmc ASC, name ASC`. Each item SHALL carry the full `Card` payload nested as `card` and have `colors` / `color_identity` / `keywords` / `legalities` parsed back from JSON.

#### Scenario: Sorting

- **WHEN** a deck contains a 1-cmc and a 4-cmc card
- **THEN** the 1-cmc card appears first

### Requirement: Add card increments existing rows

The `decks:addCard(deckId, cardId, board?)` handler SHALL insert with `quantity: 1` and `board` defaulting to `'main'`. When a row already exists for that `(deck_id, card_id, board)` triple, the existing quantity SHALL be incremented by 1. The deck's `updated_at` SHALL be bumped.

#### Scenario: First copy

- **WHEN** the card is not yet in the main board
- **THEN** a row with `quantity: 1, board: 'main'` is inserted

#### Scenario: Second copy

- **WHEN** the same card is added again to the same board
- **THEN** the row's quantity becomes 2 (no second row inserted)

### Requirement: Update and remove deck cards

The `decks:updateQuantity(deckId, cardId, board, quantity)` handler SHALL set the quantity, deleting the row entirely when the new quantity is `<= 0`. The `decks:removeCard` handler SHALL delete the row outright. Both SHALL bump the deck's `updated_at`.

#### Scenario: Quantity to zero

- **WHEN** `updateCardQuantity(db, deckId, cardId, 'main', 0)` runs
- **THEN** the corresponding row is deleted

#### Scenario: Sideboard-only removal

- **WHEN** `removeCardFromDeck(db, deckId, cardId, 'sideboard')` runs
- **THEN** the sideboard row is deleted but any main-board row for the same card remains

### Requirement: Claim deck from collection

The `decks:claim(deckId)` handler SHALL run inside a single transaction that:

1. Sets the deck's `owned = 1` and bumps `updated_at`.
2. For each distinct card in the deck (summing quantities across boards), reduces the corresponding `collection.quantity` by the deck's total quantity.
3. Deletes the collection row when the remaining quantity is `<= 0`; updates the row otherwise.
4. Skips any deck card that is not present in the collection (no error, no implicit zero).

#### Scenario: Card present in sufficient quantity

- **WHEN** the collection has 4 copies of card X and the deck uses 2 across both boards
- **THEN** after claim, the collection row for X has `quantity: 2`

#### Scenario: Card present in insufficient quantity

- **WHEN** the collection has 1 copy of card X and the deck uses 3
- **THEN** after claim, the collection row for X is deleted (no negative quantity is stored)

#### Scenario: Card absent from collection

- **WHEN** the deck contains card Y and `collection` has no row for Y
- **THEN** the claim succeeds, no row is created, and the deck is marked owned

#### Scenario: Idempotency considered

- **WHEN** `claimDeckFromCollection` is called twice on the same already-owned deck
- **THEN** the second call further deducts collection quantities; callers SHOULD prevent re-claiming via the UI

### Requirement: Renderer deck list and editor

The renderer SHALL provide:

- `DeckList` (view `decks`) — grid of decks with cover card art, format, card count, owned badge; supports create, rename, delete
- `DeckEditor` (view `deck-editor` with `activeDeckId`) — split view with deck contents (grouped by type, per-board sections), live mana curve / stats (`DeckStats`), card-add search panel (reusing `CardBrowser`), inline quantity adjusters, cover-card selector, format selector, claim and export actions
- Sidebar deck navigation that can open a specific deck via `onOpenDeck(id)`

#### Scenario: Open a deck from the sidebar

- **WHEN** the user clicks a deck in the sidebar
- **THEN** the active view becomes `deck-editor` with `activeDeckId` set to that deck

#### Scenario: After mutating deck contents

- **WHEN** the user adds, removes, or changes the quantity of a card
- **THEN** the deck editor calls back to refresh `decks:list`, so the sidebar `card_count` and `updated_at` ordering update without reloading the app

### Requirement: Export deck to plain-text list

`ExportDeckModal` SHALL produce a copy-to-clipboard text export of a deck with:

- a leading `// <deck name>` comment line when a name is set, followed by a blank line
- main-board cards grouped by type category (using `getCardTypeCategory` and the `TYPE_ORDER` from `lib/mana`), each group preceded by a `// <Type>` comment, with one `<qty> <card name>` line per card and a trailing blank line per group
- sideboard cards (if any) under a final `// Sideboard` header

The modal SHALL support:

- a toggle to exclude basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes)
- per-card exclusion toggles (click the X on a row)
- a primary "Copy to Clipboard" action with a 2-second "Copied!" confirmation, falling back to a hidden `<textarea>` + `document.execCommand('copy')` if the Clipboard API rejects
- closing on `Escape`, on backdrop click, and via the explicit Cancel button

#### Scenario: Export with sideboard and basics excluded

- **WHEN** the deck has main creatures + 24 basics and 2 sideboard cards, and "Exclude basic lands" is checked
- **THEN** the export omits the basic-land lines and the sideboard appears under `// Sideboard`

#### Scenario: Per-card exclusion

- **WHEN** the user clicks the X next to a card in the preview
- **THEN** that card disappears from both the preview and the copied output (and the running totals update)

### Requirement: Claim flow UX

`ClaimDeckModal` SHALL:

- aggregate deck cards by `card_id` across both boards before display
- pre-fetch collection quantities so the modal can show, per card, how many will be deducted (`min(deckQty, ownedQty)`) and how many will remain
- summarise the total cards that will move from collection to deck, plus the count that aren't in the collection at all
- only enable "Confirm & Claim" when not already submitting; show a "Claiming…" state while the IPC call is in flight
- close on `Escape` or backdrop click

#### Scenario: No deck cards in collection

- **WHEN** none of the deck's cards exist in the collection
- **THEN** the modal explains that nothing will be deducted and only marks the deck as owned on confirm
