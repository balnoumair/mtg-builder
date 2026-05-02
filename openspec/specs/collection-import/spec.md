# Collection Import (Scryfall Sync) Specification

## Purpose

Pulls the full English card corpus from Scryfall's `default_cards` bulk dump and the set/block index, normalises it into the local `cards` table, and rebuilds search indexes. This is what turns a fresh install into a usable app, and what users re-run when Scryfall publishes new cards.

The import is destructive on `cards` but preserves user-owned data (`decks`, `deck_cards`, `decks.cover_card_id`) across runs.

## Requirements

### Requirement: Sync entry screen blocks the app until cards exist

The renderer SHALL show an `ImportScreen` and refuse to render the main UI until `db:status` reports `ready: true` (i.e. `cards` table has at least one row).

#### Scenario: First launch

- **WHEN** the app starts and the database has no cards
- **THEN** only the import screen is rendered, with a "Sync from Scryfall" call to action

#### Scenario: User re-triggers sync from inside the app

- **WHEN** the user invokes Sync from the sidebar
- **THEN** the renderer re-mounts `ImportScreen` and calls `electronAPI.syncCards()`

### Requirement: Bulk download from Scryfall

The sync SHALL fetch the `default_cards` entry from `https://api.scryfall.com/bulk-data`, follow up to one HTTP redirect, and stream the file to a unique path under `os.tmpdir()` named `scryfall-bulk-<timestamp>.json`. The temp file SHALL be removed on success or failure.

#### Scenario: Successful download

- **WHEN** the bulk-data endpoint returns 200 and the download URL streams successfully
- **THEN** progress is reported with `phase: 'downloading'` and bytes-downloaded / total-bytes from the response `Content-Length`

#### Scenario: HTTP error from Scryfall

- **WHEN** `https://api.scryfall.com/bulk-data` returns a non-2xx status
- **THEN** sync rejects with `Error: Scryfall API error: <status>` and no temp file remains

#### Scenario: Redirect during download

- **WHEN** the download URL responds 3xx with a `Location` header
- **THEN** the redirect is followed once

#### Scenario: HTTP error during download

- **WHEN** the download URL responds with a 4xx/5xx status
- **THEN** sync rejects with `Error: Download failed: HTTP <status>` and the partial temp file is unlinked

### Requirement: Block map fetched in parallel

The sync SHALL fetch the paginated set list from `https://api.scryfall.com/sets`, follow `next_page` until exhausted, and build a map keyed by lowercase set code carrying `{ block_code, block_name }`.

#### Scenario: Paginated traversal

- **WHEN** a `/sets` response has `has_more: true`
- **THEN** the next page URL is fetched and merged into the same map

#### Scenario: Set without a block

- **WHEN** a set lacks `block_code` or `block`
- **THEN** the corresponding map entry stores `null` for the missing field

### Requirement: Card filtering during import

While streaming the bulk JSON line-by-line, the import SHALL skip any card that:

- has `lang !== 'en'`
- has a `layout` outside the supported set (`normal`, `split`, `flip`, `transform`, `modal_dfc`, `meld`, `leveler`, `class`, `case`, `saga`, `adventure`, `mutate`, `prototype`, `battle`, `planar`, `scheme`)
- has a `set_type` other than `core` or `expansion`
- has `booster === false`

Malformed JSON lines SHALL be silently skipped without aborting the import.

#### Scenario: Non-English card

- **WHEN** a card has `lang: 'ja'`
- **THEN** it is not inserted

#### Scenario: Token / promo set

- **WHEN** a card has `set_type: 'token'`
- **THEN** it is not inserted

#### Scenario: Funny / unbooster card

- **WHEN** a card has `booster: false`
- **THEN** it is not inserted

### Requirement: Card normalisation

For each accepted card the import SHALL insert one row into `cards` with:

- `mana_cost`, `oracle_text`, `type_line` defaulting to the front face when the top-level field is absent
- `image_uri_*` defaulting to the front face's `image_uris` when top-level `image_uris` is absent
- `face_back_name` and `face_back_image_uri_normal` populated from `card_faces[1]` when present
- `colors` / `color_identity` / `keywords` / `legalities` stored as JSON strings (empty array / object when absent)
- `cmc` defaulting to `0`
- `block_code` / `block_name` taken from the block map for the card's `set`, or `null` if unknown

Inserts SHALL use `INSERT OR IGNORE` (idempotent on `id`) and SHALL be batched in transactions of 500 rows.

#### Scenario: Double-faced card

- **WHEN** a card has two `card_faces` and no top-level `image_uris`
- **THEN** the front face's images and `face_back_*` fields are populated from face 1 and face 2 respectively

#### Scenario: Card with no prices

- **WHEN** Scryfall returns no `prices.usd` / `prices.eur`
- **THEN** the corresponding columns are `NULL`

### Requirement: Preserve user data across resync

Before wiping `cards`, the sync SHALL snapshot `deck_cards` (all rows) and the non-null `cover_card_id` values from `decks`. After the new card data is loaded, it SHALL restore deck contents and cover cards only for `card_id`s that still exist in `cards`.

#### Scenario: Card still present after resync

- **WHEN** a card was in a deck before sync and remains in the new `cards` data
- **THEN** the `deck_cards` row is restored with its original `quantity` and `board`

#### Scenario: Card removed by Scryfall

- **WHEN** a card was in a deck before sync but is absent from the new bulk data
- **THEN** that `deck_cards` row is dropped silently and the deck's other cards are unaffected

#### Scenario: Cover card removed

- **WHEN** a deck's `cover_card_id` no longer exists in the new `cards` data
- **THEN** the `cover_card_id` is left at whatever value it had (the conditional `UPDATE` no-ops); deck integrity is preserved

### Requirement: Index lifecycle around bulk insert

The sync SHALL drop search indexes (`idx_cards_name`, `idx_cards_oracle_id`, `idx_cards_set_code`, `idx_cards_cmc`, `idx_cards_rarity`, `idx_cards_type_line`) before the bulk insert and re-create them via `createIndexes()` afterwards. Foreign keys SHALL be temporarily disabled to allow the `DELETE FROM cards` to bypass cascades.

#### Scenario: Index rebuild

- **WHEN** the import finishes inserting rows
- **THEN** a `phase: 'indexing'` progress event is emitted before indexes are recreated, and a `phase: 'done'` event is emitted after recreation

### Requirement: Progress events

The sync SHALL emit `sync:progress` events with `{ current, total, phase }` covering:

- `phase: 'downloading'` — `current` and `total` are bytes
- `phase: 'reading'` — `current` is cards inserted so far, `total` is an estimate (`fileSize / 4700`) until the final flush, then equals `current`
- `phase: 'indexing'` — `current = 0`, `total = 0`
- `phase: 'done'` — `current = 0`, `total = 0`, emitted exactly once at the end

#### Scenario: Renderer progress UI

- **WHEN** the renderer receives a `phase: 'done'` event
- **THEN** `ImportScreen` waits 500 ms and then calls `onComplete`, which re-fetches DB status and unmounts the import screen
