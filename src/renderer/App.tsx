import { useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import type { DbStatus } from '../shared/types';
import type { View } from './lib/types';
import ImportScreen from './components/ImportScreen';
import Sidebar from './components/Sidebar';
import Titlebar from './components/Titlebar';
import CardBrowser from './components/CardBrowser';
import DeckList from './components/DeckList';
import DeckEditor from './components/DeckEditor';
import CollectionView from './components/CollectionView';
import { useDecks } from './hooks/useDecks';

export default function App() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [view, setView] = useState<View>('collection');
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [collectionVersion, setCollectionVersion] = useState(0);
  const bumpCollection = useCallback(() => setCollectionVersion((v) => v + 1), []);
  const { decks, loading: decksLoading, createDeck, deleteDeck, updateDeck, refresh: refreshDecks } = useDecks();

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
          onNavigate={setView}
          decks={decks}
          onOpenDeck={handleOpenDeck}
          onCreateDeck={handleCreateDeck}
          onDeleteDeck={handleDeleteDeck}
          onRenameDeck={(id, name) => updateDeck(id, { name })}
          activeDeckId={activeDeckId}
          onSync={handleSync}
          cardCount={dbStatus.cardCount}
        />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', minWidth: 0 }}>
          {/* The three primary views stay mounted and toggle visibility so
              switching between them never remounts and re-fetches (which would
              flash a loading/empty state). The per-deck editor stays conditional. */}
          <ViewPane active={view === 'collection'}>
            <CardBrowser />
          </ViewPane>
          <ViewPane active={view === 'my-cards'}>
            <CollectionView
              collectionVersion={collectionVersion}
              onNavigateToBrowse={() => setView('collection')}
            />
          </ViewPane>
          <ViewPane active={view === 'decks'}>
            <DeckList
              decks={decks}
              loading={decksLoading}
              onOpenDeck={handleOpenDeck}
              onCreateDeck={handleCreateDeck}
              onDeleteDeck={handleDeleteDeck}
              onRenameDeck={(id, name) => updateDeck(id, { name })}
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
