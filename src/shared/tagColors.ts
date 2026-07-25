/**
 * Tag palette. Deliberately disjoint from the mana colors in `lib/mana`: those
 * already carry meaning on a deck row (color identity), so reusing them for a
 * user-authored label would read as a claim about the deck's colors.
 *
 * Each hue is desaturated to stay legible at 9–10px on the panel background.
 * `ink` is the label/spine color, `line` the tab border, `wash` the hover fill.
 */

export const TAG_COLOR_KEYS = [
  'slate',
  'moss',
  'clay',
  'plum',
  'teal',
  'rose',
  'lime',
  'steel',
] as const;

export type TagColor = (typeof TAG_COLOR_KEYS)[number];

export const DEFAULT_TAG_COLOR: TagColor = 'slate';

export interface TagColorTokens {
  ink: string;
  line: string;
  wash: string;
}

export const TAG_COLORS: Record<TagColor, TagColorTokens> = {
  slate: { ink: '#8ea6c4', line: 'rgba(142, 166, 196, 0.32)', wash: 'rgba(142, 166, 196, 0.1)' },
  moss: { ink: '#8fb492', line: 'rgba(143, 180, 146, 0.32)', wash: 'rgba(143, 180, 146, 0.1)' },
  clay: { ink: '#cf9077', line: 'rgba(207, 144, 119, 0.32)', wash: 'rgba(207, 144, 119, 0.1)' },
  plum: { ink: '#ab8fd0', line: 'rgba(171, 143, 208, 0.32)', wash: 'rgba(171, 143, 208, 0.1)' },
  teal: { ink: '#74b6ad', line: 'rgba(116, 182, 173, 0.32)', wash: 'rgba(116, 182, 173, 0.1)' },
  rose: { ink: '#d18aa6', line: 'rgba(209, 138, 166, 0.32)', wash: 'rgba(209, 138, 166, 0.1)' },
  lime: { ink: '#a8bd6a', line: 'rgba(168, 189, 106, 0.32)', wash: 'rgba(168, 189, 106, 0.1)' },
  steel: { ink: '#9a9aa8', line: 'rgba(154, 154, 168, 0.32)', wash: 'rgba(154, 154, 168, 0.1)' },
};

export function isTagColor(value: unknown): value is TagColor {
  return typeof value === 'string' && (TAG_COLOR_KEYS as readonly string[]).includes(value);
}

export function tagColorTokens(color: string): TagColorTokens {
  return TAG_COLORS[isTagColor(color) ? color : DEFAULT_TAG_COLOR];
}

/**
 * Next color for a new tag: the first palette entry nobody is using, falling
 * back to the least-used one so a ninth tag still contrasts with its neighbours.
 */
export function nextTagColor(inUse: readonly string[]): TagColor {
  const counts = new Map<TagColor, number>(TAG_COLOR_KEYS.map((key) => [key, 0]));
  for (const color of inUse) {
    if (isTagColor(color)) counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let best: TagColor = DEFAULT_TAG_COLOR;
  let bestCount = Infinity;
  for (const key of TAG_COLOR_KEYS) {
    const count = counts.get(key) ?? 0;
    if (count < bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}
