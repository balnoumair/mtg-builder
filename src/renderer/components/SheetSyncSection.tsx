import { useEffect, useState } from 'react';
import type { SheetPullPreview, SheetPushPlan, SheetSyncSettings } from '../../shared/types';
import SheetMappings from './SheetMappings';
import SheetPushPreview from './SheetPushPreview';
import SheetPullPreviewView from './SheetPullPreview';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  onPulled?: () => void;
}

/**
 * Playgroup sheet sync, as a section of the import/export screen: identity,
 * pull, push (with the plan rendered inline rather than in a modal), and the
 * block/set mapping editor.
 */
export default function SheetSyncSection({ onPulled }: Props) {
  const { t } = useI18n();
  const [settings, setSettings] = useState<SheetSyncSettings | null>(null);
  const [playerDraft, setPlayerDraft] = useState('');
  const [sheetDraft, setSheetDraft] = useState('');
  const [busy, setBusy] = useState<'pull' | 'apply' | 'plan' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<SheetPushPlan | null>(null);
  const [pullPreview, setPullPreview] = useState<SheetPullPreview | null>(null);
  const [showMappings, setShowMappings] = useState(false);
  // Bumped after each applied pull so an open mapping list reloads the labels.
  const [mappingsVersion, setMappingsVersion] = useState(0);

  useEffect(() => {
    window.electronAPI.getSheetSyncSettings().then((s) => {
      setSettings(s);
      setPlayerDraft(s.playerName);
      setSheetDraft(s.spreadsheetId);
    });
  }, []);

  const commitSpreadsheet = async () => {
    const value = sheetDraft.trim();
    if (!settings || value === settings.spreadsheetId) return;
    const next = await window.electronAPI.updateSheetSyncSettings({ spreadsheetId: value });
    setSettings(next);
    setSheetDraft(next.spreadsheetId);
    setPlan(null);
    if (value && !next.spreadsheetId) {
      setError(t('sheetSync.invalidSheet'));
    }
  };

  const commitPlayerName = async () => {
    const name = playerDraft.trim();
    if (!settings || name === settings.playerName) return;
    setSettings(await window.electronAPI.updateSheetSyncSettings({ playerName: name }));
    setPlan(null);
  };

  const handlePull = async () => {
    setBusy('pull');
    setStatus(null);
    setError(null);
    const result = await window.electronAPI.previewSheetPull();
    if (result.error) {
      setError(result.error);
    } else if (result.preview) {
      setPullPreview(result.preview);
    } else {
      setError(t('sheetSync.pullPreviewFailed'));
    }
    setBusy(null);
  };

  const applyPull = async () => {
    if (!pullPreview) return;
    setBusy('apply');
    setStatus(null);
    setError(null);
    const result = await window.electronAPI.applySheetPull({
      rows: pullPreview.rows,
      ediciones: pullPreview.ediciones,
      mazosLabels: pullPreview.mazosLabels,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setStatus(
        t(result.imported === 1 ? 'sheetSync.pulledOne' : 'sheetSync.pulledOther', {
          count: result.imported,
          players: result.players.join(', ') || t('sheetSync.nobody'),
        }),
      );
      setSettings(await window.electronAPI.getSheetSyncSettings());
      setPullPreview(null);
      setMappingsVersion((v) => v + 1);
      onPulled?.();
    }
    setBusy(null);
  };

  const handlePlanPush = async () => {
    setBusy('plan');
    setStatus(null);
    setError(null);
    const result = await window.electronAPI.planSheetPush();
    if (result.error) setError(result.error);
    else setPlan(result);
    setBusy(null);
  };

  const handlePickKey = async () => {
    setError(null);
    try {
      setSettings(await window.electronAPI.pickServiceAccountKey());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (!settings) return null;

  const hasKey = !!settings.serviceAccountKeyPath;
  const hasSheet = !!settings.spreadsheetId;

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
          {t('sheetSync.title')}
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
          {settings.lastPulledAt
            ? t('sheetSync.lastPulled', { date: new Date(settings.lastPulledAt).toLocaleString() })
            : t('sheetSync.neverPulled')}
        </span>
      </div>
      <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
        {t('sheetSync.intro')}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card title={t('sheetSync.spreadsheetCard')}>
          <input
            value={sheetDraft}
            onChange={(e) => setSheetDraft(e.target.value)}
            onBlur={() => void commitSpreadsheet()}
            placeholder={t('sheetSync.spreadsheetPlaceholder')}
            spellCheck={false}
            style={{
              width: '100%',
              padding: '5px 9px',
              background: 'var(--bg-input)',
              border: `1px solid ${hasSheet ? 'var(--border-input)' : 'rgba(201,123,114,0.5)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              outline: 'none',
            }}
          />
          <p style={hint}>
            {hasSheet
              ? t('sheetSync.spreadsheetHint')
              : t('sheetSync.spreadsheetRequired')}
          </p>
        </Card>

        <Card title={t('sheetSync.identityCard')}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ flexShrink: 0 }}>{t('sheetSync.playerLabel')}</span>
            <input
              value={playerDraft}
              onChange={(e) => setPlayerDraft(e.target.value)}
              onBlur={() => void commitPlayerName()}
              placeholder="Bryan"
              style={{
                flex: 1,
                minWidth: 0,
                padding: '5px 9px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-input)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </label>
          <p style={hint}>
            {t('sheetSync.playerHint')}
          </p>
        </Card>

        <Card title={t('sheetSync.pullCard')}>
          <button
            onClick={() => void handlePull()}
            disabled={busy !== null || !hasSheet || !hasKey}
            style={{ ...actionBtn, opacity: busy !== null || !hasSheet || !hasKey ? 0.5 : 1 }}
          >
            {busy === 'pull' ? t('sheetSync.pulling') : t('sheetSync.pullNow')}
          </button>
          <p style={hint}>
            {!hasSheet
              ? t('sheetSync.pullNeedsSheet')
                : !hasKey
                  ? t('sheetSync.pullNeedsKey')
                : t('sheetSync.pullHint')}
          </p>
        </Card>

        {pullPreview && (
          <SheetPullPreviewView
            preview={pullPreview}
            busy={busy === 'apply'}
            onCancel={() => setPullPreview(null)}
            onConfirm={() => void applyPull()}
          />
        )}

        <Card title={t('sheetSync.pushCard')}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => void handlePlanPush()}
              disabled={busy !== null || !hasSheet || !hasKey}
              style={{ ...actionBtn, opacity: busy !== null || !hasSheet || !hasKey ? 0.5 : 1 }}
            >
              {busy === 'plan'
                ? t('sheetSync.preparing')
                : plan
                  ? t('sheetSync.rebuildPlan')
                  : t('sheetSync.preparePush')}
            </button>
            <button onClick={() => void handlePickKey()} style={ghostBtn}>
              {hasKey ? t('sheetSync.changeKey') : t('sheetSync.setKey')}
            </button>
          </div>
          <p style={{ ...hint, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            {hasKey
              ? t('sheetSync.keyConfigured')
              : t('sheetSync.keyNeeded')}
          </p>
        </Card>

        {plan && (
          <SheetPushPreview
            plan={plan}
            variant="inline"
            onClose={() => setPlan(null)}
            onDone={(message) => {
              setPlan(null);
              setStatus(message);
            }}
          />
        )}

        <Card
          title={t('sheetSync.mappingsCard')}
          action={
            <button onClick={() => setShowMappings((v) => !v)} style={ghostBtn}>
              {showMappings ? t('sheetSync.hide') : t('sheetSync.show')}
            </button>
          }
        >
          {showMappings ? (
            <div style={{ marginTop: 8 }}>
              <SheetMappings key={mappingsVersion} />
            </div>
          ) : (
            <p style={{ ...hint, marginTop: 0 }}>
              {t('sheetSync.mappingsHint')}
            </p>
          )}
        </Card>

        {(status || error) && (
          <p
            onClick={() => {
              setStatus(null);
              setError(null);
            }}
            title={t('settings.dismiss')}
            style={{
              margin: 0,
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
      </div>
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-mute)',
            fontWeight: 600,
          }}
        >
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
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

const ghostBtn: React.CSSProperties = {
  padding: '5px 11px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
};
