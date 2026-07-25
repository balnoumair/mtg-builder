import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Tag } from '../../shared/types';
import { DEFAULT_TAG_COLOR, isTagColor, nextTagColor } from '../../shared/tagColors';

interface TagRow {
  id: number;
  uuid: string;
  name: string;
  color: string;
  deck_count: number;
}

function rowToTag(row: TagRow): Tag {
  return {
    id: row.id,
    uuid: row.uuid,
    name: row.name,
    color: isTagColor(row.color) ? row.color : DEFAULT_TAG_COLOR,
    deck_count: row.deck_count,
  };
}

const SELECT_TAGS = `
  SELECT t.id, t.uuid, t.name, t.color, COUNT(dt.deck_id) AS deck_count
  FROM tags t
  LEFT JOIN deck_tags dt ON dt.tag_id = t.id
  GROUP BY t.id
  ORDER BY t.name COLLATE NOCASE ASC
`;

export function getTags(db: Database.Database): Tag[] {
  return (db.prepare(SELECT_TAGS).all() as TagRow[]).map(rowToTag);
}

function getTagById(db: Database.Database, id: number): Tag {
  const row = db.prepare(`
    SELECT t.id, t.uuid, t.name, t.color, COUNT(dt.deck_id) AS deck_count
    FROM tags t
    LEFT JOIN deck_tags dt ON dt.tag_id = t.id
    WHERE t.id = ?
    GROUP BY t.id
  `).get(id) as TagRow | undefined;
  if (!row) throw new Error(`Tag ${id} not found`);
  return rowToTag(row);
}

/** Tags attached to every deck, keyed by deck id, for the deck list. */
export function getTagsByDeck(db: Database.Database): Map<number, Tag[]> {
  const rows = db.prepare(`
    SELECT dt.deck_id, t.id, t.uuid, t.name, t.color
    FROM deck_tags dt
    JOIN tags t ON t.id = dt.tag_id
    ORDER BY t.name COLLATE NOCASE ASC
  `).all() as Array<Omit<TagRow, 'deck_count'> & { deck_id: number }>;

  const byDeck = new Map<number, Tag[]>();
  for (const row of rows) {
    if (!byDeck.has(row.deck_id)) byDeck.set(row.deck_id, []);
    byDeck.get(row.deck_id)!.push(rowToTag({ ...row, deck_count: 0 }));
  }
  return byDeck;
}

/**
 * Creates a tag, or returns the existing one when the name is already taken
 * (case-insensitively). Typing a name that exists should attach that tag, not
 * fail — the picker never needs to distinguish the two outcomes.
 */
export function createTag(
  db: Database.Database,
  input: { name: string; color?: string },
): Tag {
  const name = input.name.trim();
  if (!name) throw new Error('Tag name is required');

  const existing = db.prepare(
    'SELECT id FROM tags WHERE name = ? COLLATE NOCASE'
  ).get(name) as { id: number } | undefined;
  if (existing) return getTagById(db, existing.id);

  const inUse = (db.prepare('SELECT color FROM tags').all() as { color: string }[])
    .map((r) => r.color);
  const color = isTagColor(input.color) ? input.color : nextTagColor(inUse);

  const result = db.prepare(
    'INSERT INTO tags (uuid, name, color) VALUES (@uuid, @name, @color)'
  ).run({ uuid: randomUUID(), name, color });

  return getTagById(db, result.lastInsertRowid as number);
}

export function updateTag(
  db: Database.Database,
  id: number,
  updates: { name?: string; color?: string },
): Tag {
  const fields: string[] = [];
  const params: Record<string, unknown> = { id };

  if (updates.name !== undefined) {
    const name = updates.name.trim();
    if (!name) throw new Error('Tag name is required');
    const clash = db.prepare(
      'SELECT id FROM tags WHERE name = ? COLLATE NOCASE AND id != ?'
    ).get(name, id) as { id: number } | undefined;
    if (clash) throw new Error(`A tag named "${name}" already exists`);
    fields.push('name = @name');
    params.name = name;
  }
  if (updates.color !== undefined && isTagColor(updates.color)) {
    fields.push('color = @color');
    params.color = updates.color;
  }

  if (fields.length > 0) {
    db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = @id`).run(params);
  }
  return getTagById(db, id);
}

/** Deleting a tag detaches it from every deck; the decks themselves are untouched. */
export function deleteTag(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM tags WHERE id = ?').run(id);
}

/** Replaces a deck's tags wholesale with `tagIds`. */
export function setDeckTags(db: Database.Database, deckId: number, tagIds: number[]): void {
  const unique = [...new Set(tagIds)];
  const insert = db.prepare('INSERT OR IGNORE INTO deck_tags (deck_id, tag_id) VALUES (?, ?)');

  const txn = db.transaction(() => {
    db.prepare('DELETE FROM deck_tags WHERE deck_id = ?').run(deckId);
    for (const tagId of unique) insert.run(deckId, tagId);
    db.prepare("UPDATE decks SET updated_at = datetime('now') WHERE id = ?").run(deckId);
  });
  txn();
}
