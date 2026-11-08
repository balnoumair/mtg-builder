import { useEffect, useMemo, useState } from 'react';
import type { ExternalDeck } from '../../shared/types';
import DeckRowColorIdentity from './DeckRowColorIdentity';
import DeckSetGroupLabel from './DeckSetGroupLabel';
import FilterDropdown, { type FilterOption } from './FilterDropdown';
import PillLabel from './PillLabel';
import ViewToggle from './ViewToggle';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  active: boolean;
  /** Bumped by the sync section so a pull elsewhere refreshes this list. */
  syncVersion: number;
}

const HIDDEN_PLAYERS_KEY = 'others-decks-hidden-players';
const HIDDEN_SETS_KEY = 'others-decks-hidden-sets';
// Also the persisted filter value, so it stays fixed whatever the UI language.
const NO_BLOCK = 'Sin bloque';

const PLAYER_PILL = {
  color: '#9fcfee',
  border: 'rgba(95, 159, 207, 0.35)',
  background: 'rgba(95, 159, 207, 0.1)',
};

const SET_PILL = {
  color: '#c9a86c',
  border: 'rgba(201, 168, 108, 0.35)',
  background: 'rgba(201, 168, 108, 0.1)',
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
  const { t } = useI18n();
  const [decks, setDecks] = useState<ExternalDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenPlayers, setHiddenPlayers] = useState<string[]>(() => loadHidden(HIDDEN_PLAYERS_KEY));
  const [hiddenSets, setHiddenSets] = useState<string[]>(() => loadHidden(HIDDEN_SETS_KEY));
  const [viewMode, setViewMode] = useState<'player' | 'set'>('player');

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
  const blockOf = (deck: ExternalDeck) => deck.set_label || deck.block_label || NO_BLOCK;
  const blockName = (block: string) => (block === NO_BLOCK ? t('othersDecks.noBlock') : block);

  const playerOptions = useMemo(() => countBy(decks, (d) => d.player), [decks]);
  const setOptions = useMemo(
    () => countBy(decks, blockOf).map((option) => ({ ...option, label: blockName(option.value) })),
    [decks, t],
  );

  const visible = useMemo(
    () =>
      decks.filter(
        (d) => !hiddenPlayers.includes(d.player) && !hiddenSets.includes(blockOf(d)),
      ),
    [decks, hiddenPlayers, hiddenSets],
  );

  // Query order is player, then the sheet's own block order, so plain
  // insertion order reproduces it.
  const playerSections = useMemo(() => {
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

  const setSections = useMemo(() => {
    const bySet = new Map<string, ExternalDeck[]>();
    for (const deck of visible) {
      const block = blockOf(deck);
      if (!bySet.has(block)) bySet.set(block, []);
      bySet.get(block)!.push(deck);
    }

    return [...bySet.entries()]
      .map(([label, setDecks]) => {
        const byName = new Map<string, ExternalDeck[]>();
        for (const deck of setDecks) {
          const variantKey = `${deck.name}\u0000${deck.colors.join('')}`;
          if (!byName.has(variantKey)) byName.set(variantKey, []);
          byName.get(variantKey)!.push(deck);
        }
        return {
          label,
          total: setDecks.length,
          sortKey: setDecks.reduce((latest, deck) => {
            const candidate = deck.set_sort_key ?? '';
            return candidate > latest ? candidate : latest;
          }, ''),
          groups: [...byName.entries()]
            .map(([variantKey, nameDecks]) => ({
              name: nameDecks[0].name,
              variantKey,
              decks: [...nameDecks].sort((a, b) => a.player.localeCompare(b.player)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name) || a.variantKey.localeCompare(b.variantKey)),
        };
      })
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) {
          if (!a.sortKey) return 1;
          if (!b.sortKey) return -1;
          return b.sortKey.localeCompare(a.sortKey);
        }
        return a.label.localeCompare(b.label);
      });
  }, [visible]);

  const sections = viewMode === 'player' ? playerSections : setSections;

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
            {t('othersDecks.title')}
          </h1>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-mute)' }}>
            {filtered ? `${visible.length}/${decks.length}` : decks.length}
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'player', label: t('othersDecks.viewPlayer') },
                { value: 'set', label: t('othersDecks.viewSet') },
              ]}
            />
            <FilterDropdown
              label={t('othersDecks.playersFilter')}
              options={playerOptions}
              hidden={hiddenPlayers}
              onHiddenChange={setHiddenPlayers}
              emptyHint={t('othersDecks.playersFilterEmpty')}
            />
            <FilterDropdown
              label={t('othersDecks.setsFilter')}
              options={setOptions}
              hidden={hiddenSets}
              onHiddenChange={setHiddenSets}
              emptyHint={t('othersDecks.setsFilterEmpty')}
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
          {lastSynced
            ? t('othersDecks.sourcePulled', { date: new Date(lastSynced).toLocaleString() })
            : t('othersDecks.source')}
        </p>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--pad)' }}>
        {loading ? (
          <div style={{ color: 'var(--text-mute)', fontSize: 12 }}>{t('app.loading')}</div>
        ) : decks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>{t('othersDecks.empty')}</p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
              {t('othersDecks.emptyHint')}
            </p>
          </div>
        ) : sections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>
              {t('othersDecks.allHidden')}
            </p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, marginTop: 6 }}>
              {t('othersDecks.allHiddenHint')}
            </p>
          </div>
        ) : viewMode === 'player' ? (
          playerSections.map((section) => (
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
                  <DeckSetGroupLabel label={blockName(group.label)} />
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
        ) : (
          setSections.map((section) => (
            <section key={section.label} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 8px' }}>
                <PillLabel style={SET_PILL}>{blockName(section.label)}</PillLabel>
                <span
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-faint)' }}
                >
                  {section.total}
                </span>
              </div>
              <div
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                }}
              >
                {section.groups.map((group, groupIndex) => (
                  <div
                    key={group.variantKey}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 44,
                      padding: '6px 14px',
                      borderTop: groupIndex ? '1px solid var(--border)' : 'none',
                    }}
                    title={`${blockName(section.label)} · ${group.decks.map((deck) => deck.player).join(', ')}`}
                  >
                    <DeckRowColorIdentity colors={group.decks[0].colors} />
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
                      {group.name}
                    </span>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                        gap: 5,
                      }}
                    >
                      {group.decks.map((deck) => (
                        <PillLabel key={deck.id} style={PLAYER_PILL} compact>
                          {deck.player}
                        </PillLabel>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
