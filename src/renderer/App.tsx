import { useState, useEffect } from 'react';
import type { DbStatus } from '../shared/types';
import type { View } from './lib/types';
import ImportScreen from './components/ImportScreen';
import Sidebar from './components/Sidebar';
import CardBrowser from './components/CardBrowser';
import DeckList from './components/DeckList';
import DeckEditor from './components/DeckEditor';
import { useDecks } from './hooks/useDecks';

export default function App() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [view, setView] = useState<View>('collection');
  const [activeDeckId, setActiveDeckId] = useState<number | null>(null);
  const { decks, loading: decksLoading, createDeck, deleteDeck, updateDeck, refresh: refreshDecks } = useDecks();

  useEffect(() => {
    window.electronAPI.getDbStatus().then(setDbStatus);
  }, []);

  const handleImportComplete = () => {
    window.electronAPI.getDbStatus().then(setDbStatus);
  };

  const handleOpenDeck = (id: number) => {
    setActiveDeckId(id);
    setView('deck-editor');
  };

  const handleCreateDeck = async (name: string, format?: string) => {
    const deck = await createDeck(name, format);
    setActiveDeckId(deck.id);
    setView('deck-editor');
  };

  if (dbStatus === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-void">
        <div className="text-ash font-body text-lg">Loading...</div>
      </div>
    );
  }

  if (!dbStatus.ready) {
    return <ImportScreen onComplete={handleImportComplete} />;
  }

  return (
    <div className="flex h-screen bg-void">
      {/* Titlebar drag region */}
      <div
        className="fixed top-0 left-0 right-0 h-10 z-50"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      />
      <Sidebar
        view={view}
        onNavigate={(v) => { setView(v); if (v !== 'deck-editor') setActiveDeckId(null); }}
        decks={decks}
        onOpenDeck={handleOpenDeck}
        onCreateDeck={handleCreateDeck}
        activeDeckId={activeDeckId}
      />
      <main className="flex-1 overflow-hidden">
        {view === 'collection' && <CardBrowser />}
        {view === 'decks' && (
          <DeckList
            decks={decks}
            loading={decksLoading}
            onOpenDeck={handleOpenDeck}
            onCreateDeck={handleCreateDeck}
            onDeleteDeck={deleteDeck}
          />
        )}
        {view === 'deck-editor' && activeDeckId && (
          <DeckEditor
            deckId={activeDeckId}
            decks={decks}
            onUpdateDeck={updateDeck}
            onDeckCardsChanged={refreshDecks}
          />
        )}
      </main>
    </div>
  );
}
