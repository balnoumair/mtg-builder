import { useEffect, useMemo, useState } from 'react';
import type { ExternalDeck } from '../../shared/types';
import DeckRowColorIdentity from './DeckRowColorIdentity';
import DeckSetGroupLabel from './DeckSetGroupLabel';
import FilterDropdown, { type FilterOption } from './FilterDropdown';
import PillLabel from './PillLabel';

interface Props {
  active: boolean;
  /** Bumped by the sync section so a pull elsewhere refreshes this list. */
  syncVersion: number;
}

const HIDDEN_PLAYERS_KEY = 'others-decks-hidden-players';
const HIDDEN_SETS_KEY = 'others-decks-hidden-sets';

const PLAYER_PILL = {
  color: '#9fcfee',
  border: 'rgba(95, 159, 207, 0.35)',
  background: 'rgba(95, 159, 207, 0.1)',
};

function loadHidden(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(raw) ? (raw as string[]) : [];
  } catch {
    return [];
  }
}

function saveHidden(key: string, values: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch {
    // ignore quota / private mode
  }
}

function countBy(decks: ExternalDeck[], pick: (d: ExternalDeck) => string): FilterOption[] {
  const counts = new Map<string, number>();
  for (const deck of decks) {
    const value = pick(deck);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export default function ExternalDecksView({ active, syncVersion }: Props) {
  const [decks, setDecks] = useState<ExternalDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenPlayers, setHiddenPlayers] = useState<string[]>(() => loadHidden(HIDDEN_PLAYERS_KEY));
  const [hiddenSets, setHiddenSets] = useState<string[]>(() => loadHidden(HIDDEN_SETS_KEY));

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    window.electronAPI.getExternalDecks().then((result) => {
      if (cancelled) return;
      setDecks(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [active, syncVersion]);

  useEffect(() => saveHidden(HIDDEN_PLAYERS_KEY, hiddenPlayers), [hiddenPlayers]);
  useEffect(() => saveHidden(HIDDEN_SETS_KEY, hiddenSets), [hiddenSets]);

  // An older main-process build (or an unmapped label) can leave set_label
  // empty; fall back to the sheet's own wording so rows always group by block.
  const blockOf = (deck: ExternalDeck) => deck.set_label || deck.block_label || 'Sin bloque';

  const playerOptions = useMemo(() => countBy(decks, (d) => d.player), [decks]);
  const setOptions = useMemo(() => countBy(decks, blockOf), [decks]);

  const visible = useMemo(
    () =>
      decks.filter(
        (d) => !hiddenPlayers.includes(d.player) && !hiddenSets.includes(blockOf(d)),
      ),
    [decks, hiddenPlayers, hiddenSets],
  );

  // Query order is player, then the sheet's own block order, so plain
  // insertion order reproduces it.
  const sections = useMemo(() => {
    const byPlayer = new Map<string, Map<string, ExternalDeck[]>>();
    for (const deck of visible) {
      if (!byPlayer.has(deck.player)) byPlayer.set(deck.player, new Map());
      const bySet = byPlayer.get(deck.player)!;
      const block = blockOf(deck);
      if (!bySet.has(block)) bySet.set(block, []);
      bySet.get(block)!.push(deck);
    }
    return [...byPlayer.entries()]
      .map(([player, bySet]) => ({
        player,
        total: [...bySet.values()].reduce((sum, list) => sum + list.length, 0),
        groups: [...bySet.entries()].map(([label, groupDecks]) => ({ label, decks: groupDecks })),
      }))
      .sort((a, b) => b.total - a.total || a.player.localeCompare(b.player));
  }, [visible]);

  const lastSynced = decks[0]?.synced_at;
  const filtered = visible.length !== decks.length;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        height: '100%',
      }}
    >
      <div style={{ padding: 'var(--pad)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            Others&rsquo; Decks
          </h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            {filtered ? `${visible.length}/${decks.length}` : decks.length}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FilterDropdown
              label="Players"
              options={playerOptions}
              hidden={hiddenPlayers}
              onHiddenChange={setHiddenPlayers}
              emptyHint="Pull the sheet to see players"
            />
            <FilterDropdown
              label="Sets"
              options={setOptions}
              hidden={hiddenSets}
              onHiddenChange={setHiddenSets}
              emptyHint="Pull the sheet to see sets"
            />
          </div>
        </div>

        <p
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-faint)',
          }}
        >
          Read-only, from the playgroup sheet
          {lastSynced ? ` · pulled ${new Date(lastSynced).toLocaleString()}` : ''}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--pad)' }}>
        {loading ? (
          <div style={{ color: 'var(--text-mute)', fontSize: 12 }}>Loading…</div>
        ) : decks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>No decks pulled yet</p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
              Open the sync screen from the card count at the bottom of the sidebar, then use
              Playgroup sheet &rarr; Pull others&rsquo; decks.
            </p>
          </div>
        ) : sections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
              Everything is hidden
            </p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
              Re-enable a player or a set to see decks again.
            </p>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.player} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 8px' }}>
                <PillLabel style={PLAYER_PILL}>{section.player}</PillLabel>
                <span
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}
                >
                  {section.total}
                </span>
              </div>
              {section.groups.map((group, groupIndex) => (
                <div
                  key={`${section.player}-${group.label}`}
                  style={{ marginTop: groupIndex ? 14 : 0 }}
                >
                  <DeckSetGroupLabel label={group.label} />
                  <div
                    style={{
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      overflow: 'hidden',
                    }}
                  >
                    {group.decks.map((deck, i) => (
                      <div
                        key={deck.id}
                        title={`${deck.block_label} · ${deck.player}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '0 14px',
                          height: 44,
                          borderTop: i ? '1px solid var(--border)' : 'none',
                        }}
                      >
                        <DeckRowColorIdentity colors={deck.colors} />
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {deck.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
