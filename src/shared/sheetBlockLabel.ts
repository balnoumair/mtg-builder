export interface SetNameInfo {
  code: string;
  name: string;
  block_name: string | null;
}

/**
 * The sheet writes block/edition names in Spanish ("Las tierras salvajes de
 * Eldraine"); the app shows English everywhere else. The label's mapped set
 * codes are the bridge back to the local `sets` table.
 *
 * Bonus sheets are folded into their parent label (woe + wot), so a plain
 * multi-code label shows just the parent set. A real multi-set block keeps
 * every name, since that is the information the label carries.
 */
export function englishBlockLabel(
  spanishLabel: string,
  setCodes: string[],
  sets: Map<string, SetNameInfo>,
): string {
  const resolved = setCodes
    .map((code) => sets.get(code.toLowerCase()))
    .filter((s): s is SetNameInfo => !!s);

  // Unmapped label, or sets the card database has not synced yet: the sheet's
  // own wording is the only thing left to show.
  if (resolved.length === 0) return spanishLabel;
  if (resolved.length === 1) return resolved[0].name;

  const blockNames = new Set(resolved.map((s) => s.block_name).filter(Boolean));
  if (blockNames.size === 1) return [...blockNames][0]!;

  if (spanishLabel.includes('(Bloque)')) {
    return resolved.map((s) => s.name).join(' · ');
  }
  return resolved[0].name;
}
