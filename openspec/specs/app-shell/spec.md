# App Shell Specification

## Purpose

Defines the Electron application shell: process model, window lifecycle, IPC surface, local SQLite persistence, schema migrations, and auto-update. This is the foundation every other capability builds on.

## Requirements

### Requirement: Single main BrowserWindow with hidden titlebar

The application SHALL launch a single `BrowserWindow` (1400×900 default, 1000×700 minimum) with a hidden titlebar, dark background (`#0a0a0f`), and a preload script that exposes the IPC API on `window.electronAPI`.

#### Scenario: First launch on macOS

- **WHEN** the user starts the app on macOS
- **THEN** the dock icon is set from `assets/icon.png`, the window opens with `titleBarStyle: 'hidden'` and no `titleBarOverlay`

#### Scenario: First launch on Windows / Linux

- **WHEN** the user starts the app on a non-darwin platform
- **THEN** the window opens with a `titleBarOverlay` (color `#0a0a0f`, symbol color `#ffffff`, height 40)

#### Scenario: All windows closed on non-macOS

- **WHEN** every window is closed and the platform is not macOS
- **THEN** the application quits

#### Scenario: Activate with no windows on macOS

- **WHEN** the app is activated and no windows exist
- **THEN** a new main window is created

### Requirement: Squirrel startup short-circuit and Windows auto-update

The application SHALL exit immediately when launched by Squirrel for install/update events, and SHALL register `update-electron-app` on Windows when packaged.

#### Scenario: Squirrel install event

- **WHEN** the process is started by Squirrel (`electron-squirrel-startup` returns true)
- **THEN** the app calls `app.quit()` before any window is created

#### Scenario: Packaged Windows app

- **WHEN** the platform is `win32` and `app.isPackaged` is true
- **THEN** `updateElectronApp()` is invoked at startup

### Requirement: SQLite database in userData

The application SHALL maintain a single better-sqlite3 database at `<userData>/mtg-builder.db`, created on first access, with `journal_mode = WAL` and `foreign_keys = ON`.

#### Scenario: First-ever launch

- **WHEN** `getDb()` is called and the userData directory does not exist
- **THEN** the directory is created recursively and the database file is initialised with the schema below

#### Scenario: Subsequent calls

- **WHEN** `getDb()` is called after the database has been opened
- **THEN** the cached `Database` instance is returned (no re-open)

#### Scenario: App quit

- **WHEN** the app receives `before-quit`
- **THEN** `closeDb()` is invoked and the cached handle is cleared

### Requirement: Database schema

The database SHALL contain the following tables, created with `CREATE TABLE IF NOT EXISTS` on first run:

- `cards` — primary key `id` (Scryfall print id), with `oracle_id`, `name`, `mana_cost`, `cmc`, `type_line`, `oracle_text`, JSON-string `colors` / `color_identity` / `keywords` / `legalities`, `power`, `toughness`, `rarity`, `set_code`, `set_name`, `collector_number`, `layout`, four `image_uri_*` columns, two `face_back_*` columns, `price_usd`, `price_eur`, `released_at`, `artist`, `block_code`, `block_name`.
- `decks` — `id` autoincrement, `name`, `format`, `description`, `cover_card_id`, `owned` (0/1), `created_at`, `updated_at`.
- `deck_cards` — `id` autoincrement, `deck_id` (FK to `decks` with `ON DELETE CASCADE`), `card_id` (FK to `cards`), `quantity`, `board`, with `UNIQUE(deck_id, card_id, board)`.
- `collection` — `card_id` PK (FK to `cards`), `quantity`, `added_at`.

#### Scenario: Schema present on fresh DB

- **WHEN** the database is opened for the first time
- **THEN** all four tables exist with the columns and constraints above

### Requirement: Lightweight column migrations

The application SHALL run idempotent migrations on every open that add missing columns introduced after the initial schema, without dropping data.

#### Scenario: Pre-`owned` database

- **WHEN** the `decks` table exists but lacks the `owned` column
- **THEN** `ALTER TABLE decks ADD COLUMN owned INTEGER DEFAULT 0` is run

#### Scenario: Pre-block database

- **WHEN** the `cards` table lacks `block_code` or `block_name`
- **THEN** the missing columns are added via `ALTER TABLE`

### Requirement: IPC surface exposed to the renderer

The main process SHALL register an `ipcMain.handle` handler for each channel below, and the preload script SHALL expose them via `window.electronAPI`. Renderer code MUST NOT access Node APIs directly.

| Channel | Purpose |
| --- | --- |
| `db:status` | Returns `{ ready, cardCount }` based on `cards` row count |
| `sync:cards` | Triggers a full Scryfall sync; emits `sync:progress` events |
| `cards:search` | Paginated, filtered card search |
| `cards:get` | Fetch a single card by print id |
| `cards:printings` | All printings for an `oracle_id`, newest first |
| `cards:sets` | Distinct set list with block info |
| `decks:list` / `decks:create` / `decks:update` / `decks:delete` | Deck CRUD |
| `decks:getCards` / `decks:addCard` / `decks:updateQuantity` / `decks:removeCard` | Deck contents |
| `decks:claim` | Mark a deck owned and deduct from collection |
| `collection:get` / `collection:quantities` / `collection:add` / `collection:update` / `collection:remove` / `collection:stats` | Collection management |

#### Scenario: Renderer requests DB status before any sync

- **WHEN** the renderer calls `electronAPI.getDbStatus()` against an empty database
- **THEN** the response is `{ ready: false, cardCount: 0 }`

#### Scenario: Renderer requests DB status after sync

- **WHEN** the renderer calls `electronAPI.getDbStatus()` after a successful sync
- **THEN** `ready` is `true` and `cardCount` is the row count of `cards`

### Requirement: Sync progress streamed to the originating window

The `sync:cards` handler SHALL stream `sync:progress` events (carrying `{ current, total, phase }`) only to the `BrowserWindow` that initiated the sync.

#### Scenario: Progress during download phase

- **WHEN** the bulk file is downloading
- **THEN** the renderer receives events with `phase: 'downloading'` and byte counts

#### Scenario: Progress during card import

- **WHEN** rows are being inserted
- **THEN** the renderer receives `phase: 'reading'` events with running card count and an estimated total

#### Scenario: Indexing and completion

- **WHEN** indexes are being rebuilt
- **THEN** a single `phase: 'indexing'` event is emitted, followed by exactly one `phase: 'done'` event when sync finishes
