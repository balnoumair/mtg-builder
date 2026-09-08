import { useEffect, useState } from 'react';
import type { DriveSyncSettings } from '../../shared/types';
import {
  applyDeckSetsFiltersFromBackup,
  collectDeckSetsFiltersForBackup,
} from '../lib/deckFilterStorage';

interface Props {
  onImported?: () => void;
}

/** Pushes and pulls the app's full JSON snapshot through one shared Drive file. */
export default function DriveBackupSection({ onImported }: Props) {
  const [settings, setSettings] = useState<DriveSyncSettings | null>(null);
  const [fileDraft, setFileDraft] = useState('');
  const [busy, setBusy] = useState<'push' | 'pull' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI.getDriveSyncSettings().then((s) => {
      setSettings(s);
      setFileDraft(s.backupFileId);
    });
  }, []);

  const commitFile = async () => {
    const value = fileDraft.trim();
    if (!settings || value === settings.backupFileId) return;
    const next = await window.electronAPI.updateDriveSyncSettings({ backupFileId: value });
    setSettings(next);
    setFileDraft(next.backupFileId);
    setStatus(null);
    if (value && !next.backupFileId) {
      setError("That doesn't look like a Google Drive file link or id.");
    } else {
      setError(null);
    }
  };

  const handlePush = async () => {
    setBusy('push');
    setStatus(null);
    setError(null);
    try {
      const decks = await window.electronAPI.getDecks();
      const filterSetsByUuid = collectDeckSetsFiltersForBackup(decks);
      const result = await window.electronAPI.pushBackupToDrive(filterSetsByUuid);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus(`Pushed backup to Drive${result.fileName ? ` — ${result.fileName}` : ''}.`);
        setSettings(await window.electronAPI.getDriveSyncSettings());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const handlePull = async () => {
    setBusy('pull');
    setStatus(null);
    setError(null);
    try {
      const result = await window.electronAPI.pullBackupFromDrive();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.filterSets?.length) {
        const decks = await window.electronAPI.getDecks();
        applyDeckSetsFiltersFromBackup(result.filterSets, decks);
      }
      onImported?.();

      const parts: string[] = [];
      if (result.decksImported > 0) {
        parts.push(`${result.decksImported} new deck${result.decksImported === 1 ? '' : 's'}`);
      }
      if (result.decksUpdated > 0) {
        parts.push(`${result.decksUpdated} deck${result.decksUpdated === 1 ? '' : 's'} updated`);
      }
      if (result.decksImported === 0 && result.decksUpdated === 0) parts.push('0 decks');
      parts.push(`${result.collectionCards} collection card${result.collectionCards === 1 ? '' : 's'}`);
      if (result.tagsImported > 0) {
        parts.push(`${result.tagsImported} new tag${result.tagsImported === 1 ? '' : 's'}`);
      }

      const summary = parts.join(', ');
      setStatus(
        result.missing.length === 0
          ? `Pulled backup — ${summary}.`
          : `Pulled backup — ${summary}; missing from database: ${result.missing
              .map((m) => `${m.quantity}× ${m.card}`)
              .join(', ')}`,
      );
      setSettings(await window.electronAPI.getDriveSyncSettings());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!settings) return null;

  const hasFile = !!settings.backupFileId;
  const disabled = busy !== null || !hasFile;
  const lastActivity = settings.lastPushedAt || settings.lastPulledAt
    ? [
        settings.lastPushedAt ? `pushed ${new Date(settings.lastPushedAt).toLocaleString()}` : '',
        settings.lastPulledAt ? `pulled ${new Date(settings.lastPulledAt).toLocaleString()}` : '',
      ].filter(Boolean).join(' · ')
    : 'never used';

  return (
    <div
      style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: '1px solid var(--border)',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <h2
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Drive backup
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
          {lastActivity}
        </span>
      </div>
      <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
        Push replaces one backup file in Drive. Pull restores that snapshot on this device.
      </p>

      <section
        style={{
          background: 'var(--bg-panel)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 12,
        }}
      >
        <h3
          style={{
            margin: '0 0 8px',
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-mute)',
            fontWeight: 600,
          }}
        >
          Backup file
        </h3>
        <input
          value={fileDraft}
          onChange={(e) => setFileDraft(e.target.value)}
          onBlur={() => void commitFile()}
          placeholder="Paste the Google Drive file link…"
          spellCheck={false}
          style={{
            width: '100%',
            padding: '5px 9px',
            background: 'var(--bg-input)',
            border: `1px solid ${hasFile ? 'var(--border-input)' : 'rgba(201,123,114,0.5)'}`,
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            outline: 'none',
          }}
        />
        <p style={hint}>
          {hasFile
            ? 'Paste a full Drive file link or its id; the link is stored as an id.'
            : 'Required. Upload the JSON once, then share that file with the service account as Editor.'}
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => void handlePush()}
            disabled={disabled}
            style={{ ...actionBtn, opacity: disabled ? 0.5 : 1 }}
          >
            {busy === 'push' ? 'Pushing…' : 'Push to Drive'}
          </button>
          <button
            onClick={() => void handlePull()}
            disabled={disabled}
            style={{ ...actionBtn, opacity: disabled ? 0.5 : 1 }}
          >
            {busy === 'pull' ? 'Pulling…' : 'Pull from Drive'}
          </button>
        </div>
        <p style={{ ...hint, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
          Uses the service-account key configured in the Playgroup sheet section below.
        </p>

        {(status || error) && (
          <p
            onClick={() => {
              setStatus(null);
              setError(null);
            }}
            title="Dismiss"
            style={{
              margin: '10px 0 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: error ? 'var(--danger)' : 'var(--text-dim)',
              cursor: 'pointer',
              overflowWrap: 'anywhere',
            }}
          >
            {error ?? status}
          </p>
        )}
      </section>
    </div>
  );
}

const hint: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-faint)',
  marginTop: 8,
  marginBottom: 0,
};

const actionBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: '1px solid var(--accent-line)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
