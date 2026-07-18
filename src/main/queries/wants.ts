import type Database from 'better-sqlite3';
import type { WantItem } from '../../shared/types';
import { rowToCard } from './collection';

/**
 * Cards still needed to complete wishlist decks and unconfirmed additions to
 * owned decks, minus copies already in the collection. Needs and owned copies
 * are matched by card name, so owning any printing counts.
 */
export function getWants(db: Database.Database): WantItem[] {
  const rows = db.prepare(`
    SELECT dc.quantity AS want_quantity,
           COALESCE(dc.owned_quantity, 0) AS confirmed_quantity,
           d.id AS deck_id, d.name AS deck_name, d.owned AS deck_owned,
           c.*
    FROM deck_cards dc
    JOIN decks d ON d.id = dc.deck_id
    JOIN cards c ON c.id = dc.card_id
    ORDER BY c.name ASC, d.id ASC
  `).all() as Record<string, unknown>[];

  const collectionRows = db.prepare(`
    SELECT c.name AS name, SUM(col.quantity) AS quantity
    FROM collection col
    JOIN cards c ON c.id = col.card_id
    GROUP BY c.name
  `).all() as { name: string; quantity: number }[];
  const ownedByName = new Map(collectionRows.map((r) => [r.name, r.quantity]));

  const items = new Map<string, WantItem>();
  for (const row of rows) {
    const pending = !!(row.deck_owned as number);
    const quantity = row.want_quantity as number;
    const confirmed = row.confirmed_quantity as number;
    // Wishlist decks need every copy; owned decks only the unconfirmed delta.
    const need = pending ? quantity - confirmed : quantity;
    if (need <= 0) continue;

    const name = row.name as string;
    let item = items.get(name);
    if (!item) {
      const cardRow = { ...row };
      for (const key of ['want_quantity', 'confirmed_quantity', 'deck_id', 'deck_name', 'deck_owned']) {
        delete cardRow[key];
      }
      item = {
        name,
        needed: 0,
        owned: ownedByName.get(name) ?? 0,
        to_buy: 0,
        card: rowToCard(cardRow),
        sources: [],
      };
      items.set(name, item);
    }
    item.needed += need;

    const source = item.sources.find((s) => s.deck_id === (row.deck_id as number));
    if (source) {
      source.need += need;
    } else {
      item.sources.push({
        deck_id: row.deck_id as number,
        deck_name: row.deck_name as string,
        pending,
        need,
      });
    }
  }

  const result: WantItem[] = [];
  for (const item of items.values()) {
    item.to_buy = Math.max(0, item.needed - item.owned);
    if (item.to_buy > 0) result.push(item);
  }
  return result;
}
