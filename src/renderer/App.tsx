import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { DbStatus } from '../shared/types';
import type { View } from './lib/types';
import ImportScreen from './components/ImportScreen';
import Sidebar from './components/Sidebar';
import Titlebar from './components/Titlebar';
import CardBrowser from './components/CardBrowser';
import DeckList from './components/DeckList';
import DeckEditor from './components/DeckEditor';
import CollectionView from './components/CollectionView';
import WantsView from './components/WantsView';
import ExternalDecksView from './components/ExternalDecksView';
import { useDecks } from './hooks/useDecks';
import { useTags } from './hooks/useTags';

const SIDEBAR_DEFAULT_W = 224;
const SIDEBAR_MIN_W = 170;
const SIDEBAR_MAX_W = 420;
const SIDEBAR_W_KEY = 'sidebar-width';

function clampSidebarWidth(width: number): number {
  return Math.max(SIDEBAR_MIN_W, Math.min(SIDEBAR_MAX_W, width));
}

function loadSidebarWidth(): number {
  try {
    const n = Number(localStorage.getItem(SIDEBAR_W_KEY));
    return Number.isFinite(n) && n > 0 ? clampSidebarWidth(n) : SIDEBAR_DEFAULT_W;
  } catch {
    return SIDEBAR_DEFAULT_W;
  }
}

export default function App() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [view, setView] = useState<View>('collection');
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [collectionVersion, setCollectionVersion] = useState(0);
  const bumpCollection = useCallback(() => setCollectionVersion((v) => v + 1), []);
  const [sheetSyncVersion, setSheetSyncVersion] = useState(0);
  const bumpSheetSync = useCallback(() => setSheetSyncVersion((v) => v + 1), []);
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_W_KEY, String(sidebarWidth));
    } catch {
      // ignore quota / private mode
    }
  }, [sidebarWidth]);

  const onSidebarDividerPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onSidebarDividerPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!sidebarDragRef.current) return;
    const delta = e.clientX - sidebarDragRef.current.startX;
    setSidebarWidth(clampSidebarWidth(sidebarDragRef.current.startWidth + delta));
  };

  const endSidebarDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!sidebarDragRef.current) return;
    sidebarDragRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  const { decks, loading: decksLoading, createDeck, deleteDeck, updateDeck, refresh: refreshDecks } = useDecks();
  const { tags, createTag, updateTag, deleteTag, refresh: refreshTags } = useTags();
  // Session-only: a tag filter left over from last launch would look like
  // missing decks.
  const [tagFilter, setTagFilter] = useState<number[]>([]);

  const handleSetDeckTags = useCallback(async (deckId: number, tagIds: number[]) => {
    await window.electronAPI.setDeckTags(deckId, tagIds);
    await Promise.all([refreshDecks(), refreshTags()]);
  }, [refreshDecks, refreshTags]);

  const toggleTagFilter = useCallback((id: number) => {
    setTagFilter((current) =>
      current.includes(id) ? current.filter((t) => t !== id) : [...current, id]
    );
  }, []);

  const handleDeleteTag = useCallback(async (id: number) => {
    await deleteTag(id);
    setTagFilter((current) => current.filter((t) => t !== id));
    await refreshDecks();
  }, [deleteTag, refreshDecks]);

  // Any of the selected tags matches, so each extra tag widens the list.
  const visibleDecks = useMemo(
    () =>
      tagFilter.length === 0
        ? decks
        : decks.filter((d) => d.tags?.some((t) => tagFilter.includes(t.id))),
    [decks, tagFilter],
  );

  useEffect(() => {
    window.electronAPI.getDbStatus().then(setDbStatus);
  }, []);

  const handleSyncComplete = () => {
    window.electronAPI.getDbStatus().then(setDbStatus);
    setSyncing(false);
  };

  const handleOpenDeck = (id: number) => {
    setActiveDeckId(id);
    setView('deck-editor');
  };

  const handleDeleteDeck = async (id: number) => {
    await deleteDeck(id);
    if (activeDeckId === id) {
      setActiveDeckId(null);
      setView('decks');
    }
  };

  const handleCreateDeck = async (name: string, format?: string) => {
    const deck = await createDeck(name, format);
    setActiveDeckId(deck.id);
    setView('deck-editor');
  };

  const handleSync = () => {
    setSyncing(true);
  };

  const titleInfo = useMemo(() => {
    if (view === 'deck-editor' && activeDeckId) {
      const d = decks.find((x) => x.id === activeDeckId);
      return { title: d?.name || 'Deck', subtitle: d?.format || '' };
    }
    if (view === 'collection') return { title: 'Card Browser', subtitle: '' };
    if (view === 'my-cards') return { title: 'My Cards', subtitle: '' };
    if (view === 'wants') return { title: 'Wants', subtitle: '' };
    if (view === 'others-decks') return { title: "Others' Decks", subtitle: '' };
    return { title: 'Decks', subtitle: '' };
  }, [view, activeDeckId, decks]);

  if (dbStatus === null) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-window)',
          color: 'var(--text-dim)',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    );
  }

  if (!dbStatus.ready || syncing) {
    return (
      <ImportScreen
        onComplete={handleSyncComplete}
        onCancel={dbStatus.ready ? () => setSyncing(false) : undefined}
        onBackupImported={() => {
          refreshDecks();
          refreshTags();
          bumpCollection();
        }}
        onSheetPulled={bumpSheetSync}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--bg-window)',
        color: 'var(--text)',
        overflow: 'hidden',
      }}
    >
      <Titlebar title={titleInfo.title} subtitle={titleInfo.subtitle} />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <Sidebar
          view={view}
          width={sidebarWidth}
          onNavigate={setView}
          decks={visibleDecks}
          onOpenDeck={handleOpenDeck}
          onCreateDeck={handleCreateDeck}
          onDeleteDeck={handleDeleteDeck}
          onRenameDeck={(id, name) => updateDeck(id, { name })}
          activeDeckId={activeDeckId}
          onSync={handleSync}
          cardCount={dbStatus.cardCount}
          tags={tags}
          tagFilter={tagFilter}
          onToggleTagFilter={toggleTagFilter}
          onClearTagFilter={() => setTagFilter([])}
          onRenameTag={(id, name) => updateTag(id, { name })}
          onRecolorTag={(id, color) => updateTag(id, { color })}
          onDeleteTag={handleDeleteTag}
        />
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={sidebarWidth}
          className="split-divider"
          onPointerDown={onSidebarDividerPointerDown}
          onPointerMove={onSidebarDividerPointerMove}
          onPointerUp={endSidebarDrag}
          onPointerCancel={endSidebarDrag}
          onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT_W)}
          title="Drag to resize · Double-click to reset"
          style={{
            width: 4,
            flexShrink: 0,
            cursor: 'col-resize',
            background: 'var(--border)',
            touchAction: 'none',
          }}
        />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
          {/* The three primary views stay mounted and toggle visibility so
              switching between them never remounts and re-fetches (which would
              flash a loading/empty state). The per-deck editor stays conditional. */}
          <ViewPane active={view === 'collection'}>
            <CardBrowser onCollectionChanged={bumpCollection} />
          </ViewPane>
          <ViewPane active={view === 'my-cards'}>
            <CollectionView
              collectionVersion={collectionVersion}
              onNavigateToBrowse={() => setView('collection')}
            />
          </ViewPane>
          <ViewPane active={view === 'wants'}>
            <WantsView active={view === 'wants'} collectionVersion={collectionVersion} />
          </ViewPane>
          <ViewPane active={view === 'decks'}>
            <DeckList
              decks={visibleDecks}
              loading={decksLoading}
              onOpenDeck={handleOpenDeck}
              onCreateDeck={handleCreateDeck}
              onDeleteDeck={handleDeleteDeck}
              onRenameDeck={(id, name) => updateDeck(id, { name })}
              totalDeckCount={decks.length}
              filterTags={tags.filter((t) => tagFilter.includes(t.id))}
              onClearTagFilter={() => setTagFilter([])}
            />
          </ViewPane>
          <ViewPane active={view === 'others-decks'}>
            <ExternalDecksView
              active={view === 'others-decks'}
              syncVersion={sheetSyncVersion}
            />
          </ViewPane>
          {activeDeckId !== null && (
            <ViewPane active={view === 'deck-editor'}>
              <DeckEditor
                deckId={activeDeckId}
                active={view === 'deck-editor'}
                decks={decks}
                onUpdateDeck={updateDeck}
                onRenameDeck={(id, name) => updateDeck(id, { name })}
                onDeleteDeck={handleDeleteDeck}
                onDeckCardsChanged={refreshDecks}
                onCollectionChanged={bumpCollection}
                tags={tags}
                onSetDeckTags={handleSetDeckTags}
                onCreateTag={createTag}
              />
            </ViewPane>
          )}
        </main>
      </div>
    </div>
  );
}

function ViewPane({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: active ? 'flex' : 'none', overflow: 'hidden' }}>
      {children}
    </div>
  );
}
