export interface SetCatalogEntry {
  code: string;
  name: string;
  releasedAt: string;
  blockCode: string | null;
  blockName: string | null;
}

export type SetBlockGroup = {
  blockCode: string;
  blockName: string;
  sets: SetCatalogEntry[];
  latestRelease: string;
};

export type SetDropdownEntry =
  | { kind: 'block'; group: SetBlockGroup; sortKey: string }
  | { kind: 'standalone'; set: SetCatalogEntry; sortKey: string };

export function isBlockSet(set: Pick<SetCatalogEntry, 'blockCode' | 'blockName'>): boolean {
  return !!(set.blockCode && set.blockName && set.blockName !== 'Core Set');
}

export function buildSetDropdownEntries(sets: SetCatalogEntry[]): SetDropdownEntry[] {
  const sortedSets = [...sets].sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  const blockMap = new Map<string, SetBlockGroup>();
  const entries: SetDropdownEntry[] = [];

  for (const s of sortedSets) {
    if (isBlockSet(s)) {
      if (!blockMap.has(s.blockCode!)) {
        const group: SetBlockGroup = {
          blockCode: s.blockCode!,
          blockName: s.blockName!,
          sets: [],
          latestRelease: '',
        };
        blockMap.set(s.blockCode!, group);
        entries.push({ kind: 'block', group, sortKey: '' });
      }
      const g = blockMap.get(s.blockCode!)!;
      g.sets.push(s);
      if (s.releasedAt > g.latestRelease) g.latestRelease = s.releasedAt;
    } else {
      entries.push({ kind: 'standalone', set: s, sortKey: s.releasedAt });
    }
  }

  for (const e of entries) {
    if (e.kind === 'block') e.sortKey = e.group.latestRelease;
  }
  entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  return entries;
}

export function buildBlockSortKeys(sets: SetCatalogEntry[]): Map<string, string> {
  const keys = new Map<string, string>();
  for (const entry of buildSetDropdownEntries(sets)) {
    if (entry.kind === 'block') {
      keys.set(entry.group.blockCode, entry.sortKey);
    }
  }
  return keys;
}

export function buildSetReleaseDates(sets: SetCatalogEntry[]): Map<string, string> {
  const dates = new Map<string, string>();
  for (const s of sets) {
    dates.set(s.code.toLowerCase(), s.releasedAt);
  }
  return dates;
}
