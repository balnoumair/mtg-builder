import { useEffect, useState } from 'react';
import type { AppBackup, BackupApplyMode, BackupPreview } from '../../shared/backup';
import type { DriveSyncSettings } from '../../shared/types';
import BackupPreviewView from './BackupPreview';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  onImported?: () => void;
}

/** Pushes and pulls the app's full JSON snapshot through one shared Drive file. */
export default function DriveBackupSection({ onImported }: Props) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<DriveSyncSettings | null>(null);
  const [fileDraft, setFileDraft] = useState('');
  const [busy, setBusy] = useState<'push' | 'pull' | 'apply' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingBackup, setPendingBackup] = useState<AppBackup | null>(null);
  const [pendingFile, setPendingFile] = useState<{
    fileId: string;
    fileName?: string;
    modifiedTime?: string;
  } | null>(null);

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
      setError(t('drive.invalidFile'));
    } else {
      setError(null);
    }
  };

  const handlePush = async () => {
    setBusy('push');
    setStatus(null);
    setError(null);
    try {
      const result = await window.electronAPI.pushBackupToDrive();
      if (result.error) {
        setError(result.error);
      } else {
        setStatus(
          result.fileName
            ? t('drive.pushedFile', { file: result.fileName })
            : t('drive.pushed'),
        );
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
      const result = await window.electronAPI.previewBackupFromDrive();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.preview || !result.backup || !result.fileId) {
        setError(t('drive.previewFailed'));
        return;
      }
      setBackupPreview(result.preview);
      setPendingBackup(result.backup);
      setPendingFile({
        fileId: result.fileId,
        fileName: result.fileName,
        modifiedTime: result.modifiedTime,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const applyPull = async (mode: BackupApplyMode) => {
    if (!pendingBackup || !pendingFile) return;
    setBusy('apply');
    setStatus(null);
    setError(null);
    try {
      const result = await window.electronAPI.applyBackupFromDrive({
        backup: pendingBackup,
        mode,
        ...pendingFile,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onImported?.();

      const parts: string[] = [];
      if (result.decksImported > 0) {
        parts.push(t(result.decksImported === 1 ? 'backup.summary.newDecksOne' : 'backup.summary.newDecksOther', { count: result.decksImported }));
      }
      if (result.decksUpdated > 0) {
        parts.push(t(result.decksUpdated === 1 ? 'backup.summary.decksUpdatedOne' : 'backup.summary.decksUpdatedOther', { count: result.decksUpdated }));
      }
      if (result.decksImported === 0 && result.decksUpdated === 0) parts.push(t('backup.summary.noDecks'));
      parts.push(t(result.collectionCards === 1 ? 'backup.summary.collectionCardsOne' : 'backup.summary.collectionCardsOther', { count: result.collectionCards }));
      if (result.tagsImported > 0) {
        parts.push(t(result.tagsImported === 1 ? 'backup.summary.newTagsOne' : 'backup.summary.newTagsOther', { count: result.tagsImported }));
      }

      const summary = parts.join(', ');
      setStatus(
        result.missing.length === 0
          ? t(mode === 'replace' ? 'drive.replacedSummary' : 'drive.pulledSummary', { summary })
          : t(mode === 'replace' ? 'drive.replacedSummaryMissing' : 'drive.pulledSummaryMissing', {
              summary,
              missing: result.missing.map((m) => `${m.quantity}× ${m.card}`).join(', '),
            }),
      );
      setSettings(await window.electronAPI.getDriveSyncSettings());
      setBackupPreview(null);
      setPendingBackup(null);
      setPendingFile(null);
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
        settings.lastPushedAt
          ? t('drive.lastPushed', { date: new Date(settings.lastPushedAt).toLocaleString() })
          : '',
        settings.lastPulledAt
          ? t('drive.lastPulled', { date: new Date(settings.lastPulledAt).toLocaleString() })
          : '',
      ].filter(Boolean).join(' · ')
    : t('drive.neverUsed');

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
          {t('drive.title')}
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
          {lastActivity}
        </span>
      </div>
      <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
        {t('drive.intro')}
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
          {t('drive.fileHeading')}
        </h3>
        <input
          value={fileDraft}
          onChange={(e) => setFileDraft(e.target.value)}
          onBlur={() => void commitFile()}
          placeholder={t('drive.filePlaceholder')}
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
            ? t('drive.fileHint')
            : t('drive.fileRequired')}
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => void handlePush()}
            disabled={disabled}
            style={{ ...actionBtn, opacity: disabled ? 0.5 : 1 }}
          >
            {busy === 'push' ? t('drive.pushing') : t('drive.push')}
          </button>
          <button
            onClick={() => void handlePull()}
            disabled={disabled}
            style={{ ...actionBtn, opacity: disabled ? 0.5 : 1 }}
          >
            {busy === 'pull' ? t('drive.pulling') : t('drive.pull')}
          </button>
        </div>
        <p style={{ ...hint, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
          {t('drive.keyHint')}
        </p>

        {backupPreview && pendingBackup && pendingFile && (
          <BackupPreviewView
            preview={backupPreview}
            sourceLabel={t('drive.title')}
            busy={busy === 'apply'}
            onCancel={() => {
              setBackupPreview(null);
              setPendingBackup(null);
              setPendingFile(null);
            }}
            onConfirm={(mode) => void applyPull(mode)}
          />
        )}

        {(status || error) && (
          <p
            onClick={() => {
              setStatus(null);
              setError(null);
            }}
            title={t('settings.dismiss')}
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
