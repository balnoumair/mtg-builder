import { useState, useEffect } from 'react';
import type { AppBackup, BackupApplyMode, BackupPreview } from '../../shared/backup';
import {
  CARD_LANGUAGES,
  DEFAULT_CARD_LANGUAGE,
  type CardLanguageCode,
} from '../../shared/cardLanguages';
import { APP_LOCALES, type AppLocale } from '../../shared/i18n';
import type { ImportProgress } from '../../shared/types';
import { useI18n } from '../i18n/I18nProvider';
import DriveBackupSection from './DriveBackupSection';
import SheetSyncSection from './SheetSyncSection';
import BackupPreviewView from './BackupPreview';

interface Props {
  onComplete: () => void;
  onCancel?: () => void;
  onBackupImported?: () => void;
  onSheetPulled?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const sectionStyle: React.CSSProperties = {
  marginTop: 22,
  paddingTop: 16,
  borderTop: '1px solid var(--border)',
  textAlign: 'left',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 4px',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
};

const sectionHintStyle: React.CSSProperties = {
  color: 'var(--text-mute)',
  fontSize: 11,
  margin: '0 0 12px',
};

export default function ImportScreen({
  onComplete,
  onCancel,
  onBackupImported,
  onSheetPulled,
}: Props) {
  const { t, locale, setLocale } = useI18n();
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingBackup, setPendingBackup] = useState<AppBackup | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [syncLanguages, setSyncLanguages] = useState<CardLanguageCode[]>([DEFAULT_CARD_LANGUAGE]);

  useEffect(() => {
    void window.electronAPI.getAppSettings().then((s) => {
      if (s.syncLanguages?.length) {
        setSyncLanguages(s.syncLanguages as CardLanguageCode[]);
      }
    }).catch(() => {});
  }, []);

  const handleBackup = async () => {
    const result = await window.electronAPI.exportBackup();
    if (result.error) setBackupStatus(t('settings.backupFailed', { error: result.error }));
    else if (result.saved) setBackupStatus(t('settings.backupSaved', { path: result.path ?? '' }));
  };

  const handleImportBackup = async () => {
    setBackupStatus(null);
    const result = await window.electronAPI.previewBackupImport();
    if (result.error) {
      setBackupStatus(t('settings.importFailed', { error: result.error }));
      return;
    }
    if (result.canceled) return;
    if (!result.preview || !result.backup) {
      setBackupStatus(t('settings.importPreviewFailed'));
      return;
    }
    setBackupPreview(result.preview);
    setPendingBackup(result.backup);
  };

  const applyBackup = async (mode: BackupApplyMode) => {
    if (!pendingBackup) return;
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const result = await window.electronAPI.applyBackupImport(pendingBackup, mode);
      if (result.error) {
        setBackupStatus(t('settings.importFailed', { error: result.error }));
        return;
      }
      onBackupImported?.();
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
      setBackupStatus(
        result.missing.length === 0
          ? t(mode === 'replace' ? 'settings.replacedSummary' : 'settings.importedSummary', { summary })
          : t(mode === 'replace' ? 'settings.replacedSummaryMissing' : 'settings.importedSummaryMissing', {
              summary,
              missing: result.missing.map((m) => `${m.quantity}× ${m.card}`).join(', '),
            }),
      );
      setBackupPreview(null);
      setPendingBackup(null);
    } catch (err) {
      setBackupStatus(t('settings.importFailed', { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBackupBusy(false);
    }
  };

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

  const persistSyncLanguages = async (next: CardLanguageCode[]) => {
    const langs = next.length > 0 ? next : [DEFAULT_CARD_LANGUAGE];
    setSyncLanguages(langs);
    await window.electronAPI.updateAppSettings({ syncLanguages: langs });
  };

  const toggleSyncLanguage = (code: CardLanguageCode) => {
    const next = syncLanguages.includes(code)
      ? syncLanguages.filter((l) => l !== code)
      : [...syncLanguages, code];
    void persistSyncLanguages(next);
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await window.electronAPI.updateAppSettings({ syncLanguages });
      await window.electronAPI.syncCards();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.syncFailed'));
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
        return t('settings.downloading', {
          current: formatBytes(progress.current),
          total: progress.total > 0 ? ` / ${formatBytes(progress.total)}` : '',
        });
      case 'reading':
        return t('settings.importing', { count: progress.current.toLocaleString() });
      case 'indexing':
        return t('settings.indexing');
      case 'restoring':
        return t('settings.restoring');
      case 'done':
        return t('settings.done');
    }
  })();

  // Opened from inside the app (Back available) this doubles as settings:
  // language, sync, backups, playgroup sheet — needs room and scroll.
  const manageMode = !!onCancel && !syncing;
  const showConfig = !syncing;

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        height: '100vh',
        alignItems: manageMode ? 'flex-start' : 'center',
        justifyContent: 'center',
        overflowY: manageMode || showConfig ? 'auto' : 'hidden',
        padding: manageMode || (showConfig && onCancel) ? 'calc(var(--titlebar-h) + 52px) 0 40px' : 'calc(var(--titlebar-h) + 24px) 0 40px',
        background: 'var(--bg-window)',
        color: 'var(--text)',
        fontFamily: 'var(--font-ui)',
      }}
    >
      {onCancel && !syncing && (
        <button
          onClick={onCancel}
          title={t('settings.backTitle')}
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
          {t('settings.back')}
        </button>
      )}
      <div
        style={{
          width: '100%',
          maxWidth: manageMode || showConfig ? 680 : 420,
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
          {onCancel ? t('sidebar.settings') : t('app.brand')}
        </h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 6, marginBottom: 22 }}>
          {onCancel ? t('settings.introManage') : t('settings.introFirstRun')}
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

        {showConfig && (
          <div style={{ ...sectionStyle, marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <h2 style={sectionTitleStyle}>{t('settings.appLanguage')}</h2>
            <p style={sectionHintStyle}>{t('settings.appLanguageHint')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {APP_LOCALES.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => setLocale(opt.code as AppLocale)}
                  style={{
                    ...backupBtn,
                    borderColor: locale === opt.code ? 'var(--accent-line)' : 'var(--border-strong)',
                    color: locale === opt.code ? 'var(--accent)' : 'var(--text-dim)',
                    background: locale === opt.code ? 'var(--accent-soft)' : 'transparent',
                  }}
                >
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}

        {showConfig && (
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>{t('settings.syncSection')}</h2>
            <p style={sectionHintStyle}>{t('settings.syncHint')}</p>
            <p style={{ ...sectionHintStyle, marginBottom: 8, color: 'var(--text-dim)' }}>
              {t('settings.cardLanguages')}
            </p>
            <p style={sectionHintStyle}>{t('settings.cardLanguagesHint')}</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 6,
                marginBottom: 14,
              }}
            >
              {CARD_LANGUAGES.map((lang) => {
                const checked = syncLanguages.includes(lang.code);
                return (
                  <label
                    key={lang.code}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: checked ? 'var(--accent-soft)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSyncLanguage(lang.code)}
                    />
                    {t(`cardLanguage.names.${lang.code}`)}
                  </label>
                );
              })}
            </div>
            {!syncing ? (
              <button
                onClick={() => void handleSync()}
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
                {t('settings.syncButton')}
              </button>
            ) : null}
          </div>
        )}

        {syncing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
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

        {!syncing && onCancel && (
          <div style={sectionStyle}>
            <p style={{ ...sectionHintStyle, marginBottom: 10 }}>
              {t('settings.backupHint')}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-start' }}>
              <button onClick={() => void handleBackup()} style={backupBtn}>
                {t('settings.backup')}
              </button>
              <button onClick={() => void handleImportBackup()} style={backupBtn}>
                {t('settings.importBackup')}
              </button>
            </div>
            {backupStatus && (
              <p
                onClick={() => setBackupStatus(null)}
                title={t('settings.dismiss')}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--text-dim)',
                  marginTop: 12,
                  marginBottom: 0,
                  cursor: 'pointer',
                  overflowWrap: 'anywhere',
                }}
              >
                {backupStatus}
              </p>
            )}
            {backupPreview && pendingBackup && (
              <BackupPreviewView
                preview={backupPreview}
                sourceLabel={t('settings.localBackupFile')}
                busy={backupBusy}
                onCancel={() => {
                  setBackupPreview(null);
                  setPendingBackup(null);
                }}
                onConfirm={(mode) => void applyBackup(mode)}
              />
            )}
            <DriveBackupSection onImported={onBackupImported} />
            <SheetSyncSection onPulled={onSheetPulled} />
          </div>
        )}
      </div>
    </div>
  );
}

const backupBtn: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
