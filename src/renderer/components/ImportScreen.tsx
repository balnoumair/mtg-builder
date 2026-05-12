import { useState, useEffect } from 'react';
import type { ImportProgress } from '../../shared/types';

interface Props {
  onComplete: () => void;
  onCancel?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function ImportScreen({ onComplete, onCancel }: Props) {
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

  useEffect(() => {
    if (!onCancel) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !syncing) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, syncing]);

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
        return `Downloading… ${formatBytes(progress.current)}${progress.total > 0 ? ` / ${formatBytes(progress.total)}` : ''}`;
      case 'reading':
        return `Importing… ${progress.current.toLocaleString()} cards`;
      case 'indexing':
        return 'Building indexes…';
      case 'done':
        return 'Done.';
    }
  })();

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-window)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {onCancel && !syncing && (
        <button
          onClick={onCancel}
          title="Back (Esc)"
          style={{
            position: 'absolute',
            top: 'calc(var(--titlebar-h) + 12px)',
            left: 16,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 9px 5px 7px',
            background: 'transparent',
            color: 'var(--text-dim)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M7 2L3 5.5L7 9"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back
        </button>
      )}
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          margin: '0 24px',
          padding: 28,
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          MTG Builder
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 6, marginBottom: 22 }}>
          Sync your card database from Scryfall to begin.
        </p>

        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(201,123,114,0.08)',
              border: '1px solid rgba(201,123,114,0.3)',
              color: 'var(--danger)',
              fontSize: 12,
              textAlign: 'left',
            }}
          >
            {error}
          </div>
        )}

        {!syncing ? (
          <button
            onClick={handleSync}
            style={{
              padding: '8px 16px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-ui)',
            }}
          >
            Sync from Scryfall
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 12, margin: 0 }}>{statusText}</p>
            <div
              style={{
                width: '100%',
                height: 4,
                background: 'var(--bg-input)',
                borderRadius: 999,
                overflow: 'hidden',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: 'var(--accent)',
                  opacity: 0.7,
                  transition: 'width 200ms',
                }}
              />
            </div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--text-mute)',
                margin: 0,
              }}
            >
              {pct}%
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
