import { isBasicLand } from './basicLands';
import { isBlockSet, type SetCatalogEntry } from './setOrdering';

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

export const MIXED_DECK_SET_GROUP_LABEL_KEY = 'deckList.mixedSetGroup';

function cardBlockInfo(card: DeckCardSetInfo): { blockCode: string; blockName: string } | null {
  if (!isBlockSet({ blockCode: card.block_code, blockName: card.block_name })) return null;
  return { blockCode: card.block_code!, blockName: card.block_name! };
}

type DeckSetSource =
  | { kind: 'block'; blockCode: string; blockName: string; card: DeckCardSetInfo; singleSet: boolean }
  | { kind: 'set'; card: DeckCardSetInfo };

/**
 * The one block or set a deck's non-basic cards come from, or null when they
 * span several (or the deck has none).
 */
function resolveDeckSetSource(cards: DeckCardSetInfo[]): DeckSetSource | null {
  const relevant = cards.filter((c) => !isBasicLand(c.name));
  if (relevant.length === 0) return null;

  const setCodes = new Set(relevant.map((c) => c.set_code.toLowerCase()));
  const blockInfos = relevant.map(cardBlockInfo);
  const uniqueBlocks = new Set(
    blockInfos.filter(Boolean).map((b) => b!.blockCode),
  );

  if (setCodes.size === 1) {
    const card = relevant[0];
    const block = cardBlockInfo(card);
    if (block) return { kind: 'block', ...block, card, singleSet: true };
    return { kind: 'set', card };
  }

  if (uniqueBlocks.size === 1 && blockInfos.every(Boolean)) {
    return { kind: 'block', ...blockInfos[0]!, card: relevant[0], singleSet: false };
  }

  return null;
}

export function classifyDeckSetGroup(
  cards: DeckCardSetInfo[],
  blockSortKeys: Map<string, string>,
  setReleaseDates: Map<string, string>,
): DeckSetGroup {
  const source = resolveDeckSetSource(cards);
  if (!source) return MIXED_DECK_SET_GROUP;

  if (source.kind === 'block') {
    return {
      kind: 'block',
      label: source.blockName,
      sortKey: blockSortKeys.get(source.blockCode) ?? (source.singleSet ? source.card.released_at : ''),
    };
  }
  return {
    kind: 'set',
    label: source.card.set_name,
    sortKey: setReleaseDates.get(source.card.set_code.toLowerCase()) ?? source.card.released_at,
  };
}

/**
 * Edition filter a deck's card search starts with: every set in the deck's
 * block, or its one standalone set. Mixed and empty decks get no filter.
 */
export function deckSearchSetCodes(cards: DeckCardSetInfo[], catalog: SetCatalogEntry[]): string[] {
  const source = resolveDeckSetSource(cards);
  if (!source) return [];
  if (source.kind === 'set') return [source.card.set_code];

  const blockSets = catalog
    .filter((s) => isBlockSet(s) && s.blockCode === source.blockCode)
    .map((s) => s.code);
  return blockSets.length > 0
    ? blockSets
    : [...new Set(cards.filter((c) => !isBasicLand(c.name)).map((c) => c.set_code))];
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
