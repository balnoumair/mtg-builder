# Card Browser Specification

## Purpose

Lets the user search, filter, and inspect every card in the local Scryfall mirror. Powers the deck-builder's "add card" surface and is the default landing view of the app.

## Requirements

### Requirement: Paginated, filtered search

The `cards:search` IPC handler SHALL accept a `CardFilters` object and return `{ cards: Card[]; total: number }`, where `total` reflects the number of rows matched before pagination.

Defaults applied when fields are missing:

- `pageSize`: 60
- `page`: 1
- `sortBy`: `'name'` (only `name`, `cmc`, `rarity`, `released_at` are honoured; anything else falls back to `name`)
- `colorMode`: `'include'`

Results SHALL be sorted ascending on the chosen column.

#### Scenario: No filters

- **WHEN** `searchCards(db, {})` is called
- **THEN** the query returns the first 60 cards ordered by `name` ascending, and `total` equals the row count of `cards`

#### Scenario: Pagination

- **WHEN** `page: 3, pageSize: 60`
- **THEN** rows 121–180 (by the chosen sort) are returned

### Requirement: Text query searches name and oracle text

When `filters.query` is set, the search SHALL match cards whose `name` or `oracle_text` contains the substring (case-insensitive, anchored by SQLite `LIKE '%…%'`).

#### Scenario: Substring match

- **WHEN** `query: "lightning"`
- **THEN** "Lightning Bolt" and any card whose oracle text mentions "lightning" are included

### Requirement: Color identity filter with three modes

When `filters.colors` is non-empty, the search SHALL apply `filters.colorMode`:

- `include` (default): the card's `color_identity` must contain *every* requested color (additional colors allowed)
- `exact`: the card's `color_identity` must be exactly the requested set (same colors, same length)
- `at_most`: the card's `color_identity` must be a subset of the requested colors (colorless allowed)

#### Scenario: Include mode for `[U, R]`

- **WHEN** `colors: ['U','R'], colorMode: 'include'`
- **THEN** Izzet, Grixis, Jeskai, etc. cards are returned; mono-blue and mono-red are excluded

#### Scenario: Exact mode for `[U, R]`

- **WHEN** `colors: ['U','R'], colorMode: 'exact'`
- **THEN** only cards with color identity exactly `{U, R}` are returned

#### Scenario: At-most mode for `[U, R]`

- **WHEN** `colors: ['U','R'], colorMode: 'at_most'`
- **THEN** colorless, mono-U, mono-R, and UR cards are returned; cards containing W/B/G are excluded

### Requirement: Type, rarity, set, CMC, and format filters

The search SHALL additionally support:

- `types: string[]` — OR'd substring matches on `type_line`
- `rarity: string[]` — exact `IN` match on `rarity`
- `sets: string[]` — exact `IN` match on `set_code`
- `cmcMin` / `cmcMax` — inclusive numeric bounds on `cmc`
- `format: string` — only cards whose `legalities[format] === 'legal'`

All filters SHALL be combined with logical AND.

#### Scenario: Standard-legal blue creatures, CMC ≤ 3

- **WHEN** `colors: ['U'], types: ['Creature'], cmcMax: 3, format: 'standard'`
- **THEN** only standard-legal blue creatures with cmc ≤ 3 are returned

### Requirement: Unique-by-oracle deduplication

When `filters.uniqueBy === 'oracle_id'` the result SHALL contain at most one row per `oracle_id`, choosing the most recent printing (`released_at DESC`, then numeric `collector_number ASC`). The returned `total` SHALL also be deduplicated.

#### Scenario: Reprinted card

- **WHEN** Lightning Bolt has 12 printings and `uniqueBy: 'oracle_id'` is set
- **THEN** exactly one Lightning Bolt is returned, from its most recent set

### Requirement: Single-card and printings lookups

The browser SHALL expose two read endpoints:

- `cards:get(id)` returns the single `Card` with that print id, or `null`
- `cards:printings(oracle_id)` returns every printing with that `oracle_id`, ordered `released_at DESC`

#### Scenario: Unknown id

- **WHEN** `getCard(db, 'no-such-id')` is called
- **THEN** the result is `null` (not an exception)

### Requirement: Set list

The `cards:sets` handler SHALL return one row per distinct `(set_code, set_name)` pair in the `cards` table, with `releasedAt = MIN(released_at)` and the block info, sorted by `name` ascending.

#### Scenario: Block info present

- **WHEN** the cards table includes set `'rtr'` whose rows carry `block_code: 'rtr'`
- **THEN** the set list entry for `rtr` exposes `blockCode: 'rtr'` and the corresponding `blockName`

### Requirement: Renderer browser UI

The renderer SHALL render `CardBrowser` for `view === 'collection'`, providing:

- a sidebar of filters (`CardFilters` component) covering search, colors + mode, types, rarity, sets, CMC range, format
- a paginated card grid (`CardGrid` / `useCards` hook)
- a card detail drawer (`CardDetail`) that shows full text, mana cost rendered via `ManaSymbols`, all printings, and legality badges

#### Scenario: Click a card

- **WHEN** the user clicks a card in the grid
- **THEN** the detail drawer opens for that card and lazy-loads its printings via `cards:printings`
