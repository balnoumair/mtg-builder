import { isBasicLand } from './basicLands';
import { isBlockSet } from './setOrdering';

export interface DeckSetGroup {
  kind: 'block' | 'set' | 'mixed';
  label: string;
  sortKey: string;
}

export interface DeckCardSetInfo {
  name: string;
  set_code: string;
  set_name: string;
  block_code: string | null;
  block_name: string | null;
  released_at: string;
}

export const MIXED_DECK_SET_GROUP: DeckSetGroup = {
  kind: 'mixed',
  label: 'Mixed',
  sortKey: '',
};

function cardBlockInfo(card: DeckCardSetInfo): { blockCode: string; blockName: string } | null {
  if (!isBlockSet({ blockCode: card.block_code, blockName: card.block_name })) return null;
  return { blockCode: card.block_code!, blockName: card.block_name! };
}

export function classifyDeckSetGroup(
  cards: DeckCardSetInfo[],
  blockSortKeys: Map<string, string>,
  setReleaseDates: Map<string, string>,
): DeckSetGroup {
  const relevant = cards.filter((c) => !isBasicLand(c.name));
  if (relevant.length === 0) return MIXED_DECK_SET_GROUP;

  const setCodes = new Set(relevant.map((c) => c.set_code.toLowerCase()));
  const blockInfos = relevant.map(cardBlockInfo);
  const uniqueBlocks = new Set(
    blockInfos.filter(Boolean).map((b) => b!.blockCode),
  );

  if (setCodes.size === 1) {
    const card = relevant[0];
    const block = cardBlockInfo(card);
    if (block) {
      return {
        kind: 'block',
        label: block.blockName,
        sortKey: blockSortKeys.get(block.blockCode) ?? card.released_at,
      };
    }
    return {
      kind: 'set',
      label: card.set_name,
      sortKey: setReleaseDates.get(card.set_code.toLowerCase()) ?? card.released_at,
    };
  }

  if (uniqueBlocks.size === 1 && blockInfos.every(Boolean)) {
    const blockCode = [...uniqueBlocks][0];
    const blockName = blockInfos.find(Boolean)!.blockName;
    return {
      kind: 'block',
      label: blockName,
      sortKey: blockSortKeys.get(blockCode) ?? '',
    };
  }

  return MIXED_DECK_SET_GROUP;
}

export interface DeckWithSetGroup {
  set_group?: DeckSetGroup;
}

export function groupDecksBySetGroup<T extends DeckWithSetGroup>(decks: T[]): { group: DeckSetGroup; decks: T[] }[] {
  const buckets = new Map<string, { group: DeckSetGroup; decks: T[] }>();

  for (const deck of decks) {
    const group = deck.set_group ?? MIXED_DECK_SET_GROUP;
    const key = `${group.kind}:${group.label}`;
    if (!buckets.has(key)) buckets.set(key, { group, decks: [] });
    buckets.get(key)!.decks.push(deck);
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.group.kind === 'mixed') return 1;
    if (b.group.kind === 'mixed') return -1;
    return b.group.sortKey.localeCompare(a.group.sortKey);
  });
}
