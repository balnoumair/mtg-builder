import { describe, it, expect } from 'vitest';
import {
  classifyDeckSetGroup,
  groupDecksBySetGroup,
  MIXED_DECK_SET_GROUP,
  type DeckCardSetInfo,
} from '../deckSetGroup';
import { buildBlockSortKeys, buildSetReleaseDates, buildSetDropdownEntries } from '../setOrdering';

const catalog = [
  { code: 'avr', name: 'Avacyn Restored', releasedAt: '2012-05-04', blockCode: 'innistrad', blockName: 'Innistrad' },
  { code: 'isd', name: 'Innistrad', releasedAt: '2011-09-30', blockCode: 'innistrad', blockName: 'Innistrad' },
  { code: 'dka', name: 'Dark Ascension', releasedAt: '2012-02-03', blockCode: 'innistrad', blockName: 'Innistrad' },
  { code: 'mkm', name: 'Murders at Karlov Manor', releasedAt: '2024-02-09', blockCode: null, blockName: null },
  { code: 'znr', name: 'Zendikar Rising', releasedAt: '2020-09-25', blockCode: null, blockName: null },
];

const blockSortKeys = buildBlockSortKeys(catalog);
const setReleaseDates = buildSetReleaseDates(catalog);

function card(overrides: Partial<DeckCardSetInfo> & Pick<DeckCardSetInfo, 'name' | 'set_code' | 'set_name'>): DeckCardSetInfo {
  return {
    block_code: null,
    block_name: null,
    released_at: '2020-01-01',
    ...overrides,
  };
}

describe('classifyDeckSetGroup', () => {
  it('groups a single-set block deck under the block name', () => {
    const group = classifyDeckSetGroup(
      [card({
        name: 'Delver of Secrets',
        set_code: 'isd',
        set_name: 'Innistrad',
        block_code: 'innistrad',
        block_name: 'Innistrad',
        released_at: '2011-09-30',
      })],
      blockSortKeys,
      setReleaseDates,
    );
    expect(group).toEqual({
      kind: 'block',
      label: 'Innistrad',
      sortKey: '2012-05-04',
    });
  });

  it('groups a standalone single-set deck under the set name', () => {
    const group = classifyDeckSetGroup(
      [card({ name: 'Card', set_code: 'mkm', set_name: 'Murders at Karlov Manor', released_at: '2024-02-09' })],
      blockSortKeys,
      setReleaseDates,
    );
    expect(group).toEqual({
      kind: 'set',
      label: 'Murders at Karlov Manor',
      sortKey: '2024-02-09',
    });
  });

  it('groups multi-set same-block decks under the block name', () => {
    const group = classifyDeckSetGroup(
      [
        card({
          name: 'A',
          set_code: 'isd',
          set_name: 'Innistrad',
          block_code: 'innistrad',
          block_name: 'Innistrad',
        }),
        card({
          name: 'B',
          set_code: 'dka',
          set_name: 'Dark Ascension',
          block_code: 'innistrad',
          block_name: 'Innistrad',
        }),
      ],
      blockSortKeys,
      setReleaseDates,
    );
    expect(group.kind).toBe('block');
    expect(group.label).toBe('Innistrad');
  });

  it('returns mixed for cross-block decks', () => {
    const group = classifyDeckSetGroup(
      [
        card({ name: 'A', set_code: 'isd', set_name: 'Innistrad', block_code: 'innistrad', block_name: 'Innistrad' }),
        card({ name: 'B', set_code: 'mkm', set_name: 'Murders at Karlov Manor' }),
      ],
      blockSortKeys,
      setReleaseDates,
    );
    expect(group).toEqual(MIXED_DECK_SET_GROUP);
  });

  it('ignores basic lands when classifying', () => {
    const group = classifyDeckSetGroup(
      [
        card({ name: 'Forest', set_code: 'm21', set_name: 'Core Set 2021' }),
        card({ name: 'Card', set_code: 'znr', set_name: 'Zendikar Rising', released_at: '2020-09-25' }),
      ],
      blockSortKeys,
      setReleaseDates,
    );
    expect(group.kind).toBe('set');
    expect(group.label).toBe('Zendikar Rising');
  });

  it('returns mixed for empty and basic-only decks', () => {
    expect(classifyDeckSetGroup([], blockSortKeys, setReleaseDates)).toEqual(MIXED_DECK_SET_GROUP);
    expect(
      classifyDeckSetGroup(
        [card({ name: 'Plains', set_code: 'm21', set_name: 'Core Set 2021' })],
        blockSortKeys,
        setReleaseDates,
      ),
    ).toEqual(MIXED_DECK_SET_GROUP);
  });
});

describe('groupDecksBySetGroup', () => {
  it('orders groups like the set dropdown and puts mixed last', () => {
    const grouped = groupDecksBySetGroup([
      { id: 1, set_group: { kind: 'mixed', label: 'Mixed', sortKey: '' } },
      { id: 2, set_group: { kind: 'set', label: 'Zendikar Rising', sortKey: '2020-09-25' } },
      { id: 3, set_group: { kind: 'block', label: 'Innistrad', sortKey: '2012-05-04' } },
      { id: 4, set_group: { kind: 'set', label: 'Murders at Karlov Manor', sortKey: '2024-02-09' } },
    ]);

    expect(grouped.map((g) => g.group.label)).toEqual([
      'Murders at Karlov Manor',
      'Zendikar Rising',
      'Innistrad',
      'Mixed',
    ]);
  });
});

describe('buildSetDropdownEntries', () => {
  it('matches block sort keys used for deck grouping', () => {
    const entries = buildSetDropdownEntries(catalog);
    expect(entries[0].kind).toBe('standalone');
    if (entries[0].kind === 'standalone') {
      expect(entries[0].set.code).toBe('mkm');
    }
  });
});
