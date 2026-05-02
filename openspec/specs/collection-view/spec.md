# Collection View Specification

## Purpose

Tracks the cards the user physically owns as singles. The collection is a single quantity-per-card store (no per-print/foil distinction) that drives the "My Cards" screen, supplies stats, and is the pool consumed when a deck is claimed as owned.

## Requirements

### Requirement: Collection storage

The collection SHALL be persisted in a `collection` table with one row per `card_id` (PK), carrying `quantity` and `added_at`. The `card_id` SHALL be a foreign key to `cards.id`.

#### Scenario: Add a card not yet in the collection

- **WHEN** `addToCollection(db, cardId)` is called for a card with no existing row
- **THEN** a new row is inserted with `quantity: 1` and `added_at = datetime('now')`

#### Scenario: Add an additional copy

- **WHEN** `addToCollection(db, cardId, 3)` is called for a card already at quantity 2
- **THEN** the existing row's quantity becomes 5 (`ON CONFLICT DO UPDATE SET quantity = quantity + @quantity`)

### Requirement: Set absolute quantity

The `collection:update` handler SHALL set the quantity to a specific value, removing the row entirely when the new quantity is `<= 0`.

#### Scenario: Decrease to a positive value

- **WHEN** `updateCollectionQuantity(db, cardId, 2)` runs
- **THEN** the row's quantity becomes 2

#### Scenario: Decrease to zero

- **WHEN** `updateCollectionQuantity(db, cardId, 0)` runs
- **THEN** the row is deleted

#### Scenario: Negative input

- **WHEN** `updateCollectionQuantity(db, cardId, -3)` runs
- **THEN** the row is deleted (negatives are clamped to delete)

### Requirement: Bulk remove

The `collection:remove` handler SHALL delete the row for the given `card_id` outright, regardless of quantity.

#### Scenario: Remove a multi-copy entry

- **WHEN** the collection has 4 copies of a card and `removeFromCollection` is called
- **THEN** the row is deleted in one statement

### Requirement: Filtered collection listing

The `collection:get` handler SHALL accept the same `CardFilters` shape as the card browser and return `{ cards: CollectionCard[]; total: number }`, joining `collection` against `cards` so each entry carries the full card payload, owned `quantity`, and `added_at`. Filtering, color modes (`include` / `exact` / `at_most`), pagination, and sort behaviour SHALL match the card browser exactly (see card-browser spec).

#### Scenario: Filter by color identity within collection

- **WHEN** `getCollection(db, { colors: ['G'], colorMode: 'include' })` is called
- **THEN** only owned cards whose color identity contains `G` are returned, paginated and sorted as in the card browser

### Requirement: Bulk quantity lookup

The `collection:quantities` handler SHALL accept an array of `cardIds` and return a `Record<card_id, quantity>` containing only the ids that are present in the collection. An empty input SHALL yield an empty object without querying the database.

#### Scenario: Mixed presence

- **WHEN** the input is `['a', 'b', 'c']` and only `a` and `c` are in the collection
- **THEN** the result is `{ a: 2, c: 1 }` (no key for `b`)

### Requirement: Collection stats

The `collection:stats` handler SHALL return:

- `uniqueCards`: count of rows in `collection`
- `totalCopies`: sum of `quantity`
- `estimatedValue`: sum of `CAST(price_usd AS REAL) * quantity` over the join, or `null` when the sum is `0`

#### Scenario: Empty collection

- **WHEN** the collection has no rows
- **THEN** the response is `{ uniqueCards: 0, totalCopies: 0, estimatedValue: null }`

#### Scenario: All cards lack USD prices

- **WHEN** every owned card has `price_usd: null`
- **THEN** `estimatedValue` is `null` rather than `0`

### Requirement: Renderer "My Cards" view

The renderer SHALL render `CollectionView` for `view === 'my-cards'`, allowing the user to:

- search and filter the collection using the same controls as the card browser
- adjust per-card quantities inline (calls `collection:update`) or remove entries
- see live stats (unique cards, total copies, estimated USD value)
- navigate to the full card browser when the collection is empty

#### Scenario: Empty collection state

- **WHEN** the user opens "My Cards" with an empty collection
- **THEN** an empty state is shown with a CTA that switches the view to the card browser
