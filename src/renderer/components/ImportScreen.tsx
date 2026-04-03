import { useState, useEffect } from 'react';
import type { ImportProgress } from '../../shared/types';

interface Props {
  onComplete: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ImportScreen({ onComplete }: Props) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = window.electronAPI.onSyncProgress((p) => {
      setProgress(p);
      if (p.phase === 'done') {
        setTimeout(onComplete, 500);
      }
    });
    return unsub;
  }, [onComplete]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await window.electronAPI.syncCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      setSyncing(false);
    }
  };

  const pct = (() => {
    if (!progress || progress.total <= 0) return 0;
    return Math.min(100, Math.round((progress.current / progress.total) * 100));
  })();

  const statusText = (() => {
    if (!progress) return '';
    switch (progress.phase) {
      case 'downloading':
        return `Downloading card data... ${formatBytes(progress.current)}${progress.total > 0 ? ` / ${formatBytes(progress.total)}` : ''}`;
      case 'reading':
        return `Importing cards... ${progress.current.toLocaleString()} cards`;
      case 'indexing':
        return 'Building indexes...';
      case 'done':
        return 'Sync complete!';
    }
  })();

  return (
    <div className="flex h-screen items-center justify-center bg-void relative overflow-hidden">
      {/* Background arcane circles */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className="w-[600px] h-[600px] rounded-full border border-slate-mid/20"
          style={{ animation: 'pulse-glow 4s ease-in-out infinite' }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full border border-mana-gold/10"
          style={{ animation: 'pulse-glow 4s ease-in-out infinite 1s' }}
        />
        <div
          className="absolute w-[200px] h-[200px] rounded-full border border-mana-blue/15"
          style={{ animation: 'pulse-glow 4s ease-in-out infinite 2s' }}
        />
      </div>

      <div className="glass rounded-2xl p-10 max-w-md w-full text-center relative z-10 animate-fade-in">
        <h1 className="font-display text-3xl font-bold text-bone mb-2 tracking-wide">
          MTG Builder
        </h1>
        <p className="text-ash text-sm mb-8">
          Sync your card database from Scryfall to begin
        </p>

        {error && (
          <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!syncing ? (
          <button
            onClick={handleSync}
            className="px-8 py-3 rounded-xl bg-mana-gold/20 border border-mana-gold/30
                       text-mana-gold font-body font-medium text-sm
                       hover:bg-mana-gold/30 hover:border-mana-gold/50
                       transition-all duration-200 cursor-pointer"
          >
            Sync from Scryfall
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-silver text-sm">{statusText}</p>
            <div className="w-full h-2 bg-obsidian rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-mana-gold/60 to-mana-gold rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-ash text-xs">{pct}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
