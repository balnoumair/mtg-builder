import { useEffect, useState } from 'react';
import type { SheetPushPlan, SheetSyncSettings } from '../../shared/types';
import SheetMappings from './SheetMappings';
import SheetPushPreview from './SheetPushPreview';

interface Props {
  onPulled?: () => void;
}

/**
 * Playgroup sheet sync, as a section of the import/export screen: identity,
 * pull, push (with the plan rendered inline rather than in a modal), and the
 * block/set mapping editor.
 */
export default function SheetSyncSection({ onPulled }: Props) {
  const [settings, setSettings] = useState<SheetSyncSettings | null>(null);
  const [playerDraft, setPlayerDraft] = useState('');
  const [sheetDraft, setSheetDraft] = useState('');
  const [busy, setBusy] = useState<'pull' | 'plan' | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<SheetPushPlan | null>(null);
  const [showMappings, setShowMappings] = useState(false);

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
      setError("That doesn't look like a Google Sheets link or id.");
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
    const result = await window.electronAPI.pullSheet();
    if (result.error) {
      setError(result.error);
    } else {
      setStatus(
        `Pulled ${result.imported} deck${result.imported === 1 ? '' : 's'} from ${result.players.join(', ') || 'nobody'}.`,
      );
      setSettings(await window.electronAPI.getSheetSyncSettings());
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
    setSettings(await window.electronAPI.pickServiceAccountKey());
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
          Playgroup sheet
        </h2>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
          {settings.lastPulledAt
            ? `pulled ${new Date(settings.lastPulledAt).toLocaleString()}`
            : 'never pulled'}
        </span>
      </div>
      <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
        Pulling reads everyone else&rsquo;s decks. Pushing writes only rows under your name, and
        only after you tick them.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Card title="Spreadsheet">
          <input
            value={sheetDraft}
            onChange={(e) => setSheetDraft(e.target.value)}
            onBlur={() => void commitSpreadsheet()}
            placeholder="Paste the Google Sheets link…"
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
              ? 'Paste a full sheet link or its id; the link is stored as an id.'
              : 'Required. Pulling needs the sheet shared as “anyone with the link can view”.'}
          </p>
        </Card>

        <Card title="Who you are in the sheet">
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: 'var(--text-dim)',
            }}
          >
            <span style={{ flexShrink: 0 }}>Jugador</span>
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
            Must match column A exactly — rows under this name are the only ones a push writes.
          </p>
        </Card>

        <Card title="Pull others' decks">
          <button
            onClick={() => void handlePull()}
            disabled={busy !== null || !hasSheet}
            style={{ ...actionBtn, opacity: busy !== null || !hasSheet ? 0.5 : 1 }}
          >
            {busy === 'pull' ? 'Pulling…' : 'Pull now'}
          </button>
          <p style={hint}>
            {hasSheet
              ? "Replaces the local copy of everyone else's decks. Needs no Google account."
              : 'Add the spreadsheet above first.'}
          </p>
        </Card>

        <Card title="Push my decks">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => void handlePlanPush()}
              disabled={busy !== null || !hasSheet}
              style={{ ...actionBtn, opacity: busy !== null || !hasSheet ? 0.5 : 1 }}
            >
              {busy === 'plan' ? 'Preparing…' : plan ? 'Rebuild plan' : 'Prepare push'}
            </button>
            <button onClick={() => void handlePickKey()} style={ghostBtn}>
              {hasKey ? 'Change key' : 'Set service-account key'}
            </button>
          </div>
          <p style={{ ...hint, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            {hasKey
              ? `Key: ${settings.serviceAccountKeyPath}`
              : 'Pushing needs a service-account key with editor access to the sheet.'}
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
          title="Set mappings"
          action={
            <button onClick={() => setShowMappings((v) => !v)} style={ghostBtn}>
              {showMappings ? 'Hide' : 'Show'}
            </button>
          }
        >
          {showMappings ? (
            <div style={{ marginTop: 8 }}>
              <SheetMappings />
            </div>
          ) : (
            <p style={{ ...hint, marginTop: 0 }}>
              Which Scryfall sets each Spanish block label covers. Edit these if the group renames a
              label or adds a new one.
            </p>
          )}
        </Card>

        {(status || error) && (
          <p
            onClick={() => {
              setStatus(null);
              setError(null);
            }}
            title="Dismiss"
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
