import type { BackupApplyMode, BackupPreview as BackupPreviewData } from '../../shared/backup';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  preview: BackupPreviewData;
  sourceLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (mode: BackupApplyMode) => void;
}

export default function BackupPreview({
  preview,
  sourceLabel,
  busy,
  onCancel,
  onConfirm,
}: Props) {
  const { t } = useI18n();
  const deckCards = (deck: { name: string; cardCount: number }) =>
    t(deck.cardCount === 1 ? 'backup.deckCardsOne' : 'backup.deckCardsOther', {
      name: deck.name,
      count: deck.cardCount,
    });
  const hasChanges = preview.decks.add.length > 0 ||
    preview.decks.overwrite.length > 0 ||
    preview.decks.remove.length > 0 ||
    preview.collection.add.length > 0 ||
    preview.collection.overwrite.length > 0 ||
    preview.collection.remove > 0 ||
    preview.tags.add.length > 0 ||
    preview.tags.remove.length > 0;

  return (
    <section style={panel} aria-label={t('backup.ariaLabel', { source: sourceLabel })}>
      <div style={eyebrow}>{t('backup.eyebrow')}</div>
      <h3 style={title}>{sourceLabel}</h3>
      <p style={copy}>
        {t('backup.intro')}
      </p>

      {!hasChanges && (
        <p style={{ ...copy, color: 'var(--text-dim)' }}>{t('backup.nothingChanges')}</p>
      )}

      <div style={summaryGrid}>
        <Summary label={t('backup.newDecks')} value={preview.decks.add.length} tone="add" />
        <Summary label={t('backup.decksOverwritten')} value={preview.decks.overwrite.length} tone="overwrite" />
        <Summary label={t('backup.collectionEntries')} value={preview.collection.add.length + preview.collection.overwrite.length} />
        <Summary label={t('backup.newTags')} value={preview.tags.add.length} tone="add" />
      </div>

      <ChangeGroup
        title={t('backup.willAdd')}
        tone="add"
        items={preview.decks.add.map(deckCards)}
        empty={t('backup.noNewDecks')}
      />
      <ChangeGroup
        title={t('backup.willOverwrite')}
        tone="overwrite"
        items={preview.decks.overwrite.map((deck) =>
          deck.existingName && deck.existingName !== deck.name
            ? `${deck.existingName} → ${deck.name}`
            : deckCards(deck),
        )}
        empty={t('backup.noExistingMatched')}
      />

      {(preview.decks.remove.length > 0 || preview.collection.remove > 0 || preview.tags.remove.length > 0) && (
        <div style={warningBox}>
          <strong>{t('backup.replaceRemovesTitle')}</strong>
          <span>
            {t('backup.replaceRemoves', {
              decks: t(preview.decks.remove.length === 1 ? 'backup.removeDecksOne' : 'backup.removeDecksOther', {
                count: preview.decks.remove.length,
              }),
              entries: t(preview.collection.remove === 1 ? 'backup.removeEntriesOne' : 'backup.removeEntriesOther', {
                count: preview.collection.remove,
              }),
              tags: t(preview.tags.remove.length === 1 ? 'backup.removeTagsOne' : 'backup.removeTagsOther', {
                count: preview.tags.remove.length,
              }),
            })}
          </span>
          {preview.decks.remove.length > 0 && (
            <span style={detail}>{t('backup.removeDeckList', { names: preview.decks.remove.join(', ') })}</span>
          )}
        </div>
      )}

      {preview.missing.length > 0 && (
        <div style={missingBox}>
          <strong>
            {t(preview.missing.length === 1 ? 'backup.missingOne' : 'backup.missingOther', {
              count: preview.missing.length,
            })}
          </strong>
          <span style={detail}>
            {preview.missing.map((item) => `${item.quantity}× ${item.card}`).join(', ')}
          </span>
        </div>
      )}

      <div style={actions}>
        <button onClick={onCancel} disabled={busy} style={secondaryBtn}>
          {t('backup.cancel')}
        </button>
        <button onClick={() => onConfirm('merge')} disabled={busy} style={primaryBtn}>
          {busy ? t('backup.applying') : t('backup.merge')}
        </button>
        <button onClick={() => onConfirm('replace')} disabled={busy} style={replaceBtn}>
          {busy ? t('backup.applying') : t('backup.replace')}
        </button>
      </div>
      <p style={footnote}>
        {t('backup.footnote')}
      </p>
    </section>
  );
}

function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'add' | 'overwrite';
}) {
  return (
    <div style={summaryCell}>
      <span style={{ ...summaryValue, color: tone === 'add' ? 'var(--accent)' : tone === 'overwrite' ? '#d7a45c' : 'var(--text)' }}>
        {value}
      </span>
      <span style={summaryLabel}>{label}</span>
    </div>
  );
}

function ChangeGroup({
  title: groupTitle,
  tone,
  items,
  empty,
}: {
  title: string;
  tone: 'add' | 'overwrite';
  items: string[];
  empty: string;
}) {
  return (
    <div style={group}>
      <div style={{ ...groupHeading, color: tone === 'add' ? 'var(--accent)' : '#d7a45c' }}>
        {groupTitle} <span style={count}>{items.length}</span>
      </div>
      <div style={itemList}>
        {(items.length ? items : [empty]).map((item) => (
          <span key={item} style={{ ...itemRow, color: items.length ? 'var(--text-dim)' : 'var(--text-faint)' }}>
            {items.length ? (tone === 'add' ? '+' : '↻') : '·'} {item}
          </span>
        ))}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  border: '1px solid var(--accent-line)',
  borderRadius: 'var(--radius)',
  background: 'linear-gradient(135deg, rgba(116, 173, 142, 0.07), var(--bg-panel) 42%)',
  textAlign: 'left',
};

const eyebrow: React.CSSProperties = {
  color: 'var(--accent)',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const title: React.CSSProperties = {
  margin: '4px 0 0',
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 600,
};

const copy: React.CSSProperties = {
  margin: '6px 0 12px',
  color: 'var(--text-mute)',
  fontSize: 11,
  lineHeight: 1.45,
};

const summaryGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: 1,
  marginBottom: 12,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
};

const summaryCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  padding: '8px 7px',
  background: 'var(--bg-input)',
};

const summaryValue: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 16,
  lineHeight: 1,
};

const summaryLabel: React.CSSProperties = {
  color: 'var(--text-faint)',
  fontSize: 9,
  lineHeight: 1.2,
};

const group: React.CSSProperties = {
  padding: '9px 0',
  borderTop: '1px solid var(--border)',
};

const groupHeading: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
};

const count: React.CSSProperties = {
  color: 'var(--text-faint)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  fontWeight: 400,
};

const itemList: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  maxHeight: 116,
  marginTop: 6,
  overflowY: 'auto',
};

const itemRow: React.CSSProperties = {
  display: 'block',
  flex: '0 0 auto',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  lineHeight: 1.3,
};

const warningBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 9,
  padding: '8px 9px',
  border: '1px solid rgba(215,164,92,0.35)',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(215,164,92,0.08)',
  color: '#d7a45c',
  fontSize: 10,
  lineHeight: 1.4,
};

const missingBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginTop: 9,
  padding: '8px 9px',
  border: '1px solid rgba(201,123,114,0.35)',
  borderRadius: 'var(--radius-sm)',
  background: 'rgba(201,123,114,0.08)',
  color: 'var(--danger)',
  fontSize: 10,
  lineHeight: 1.4,
};

const detail: React.CSSProperties = {
  color: 'var(--text-mute)',
  overflowWrap: 'anywhere',
};

const actions: React.CSSProperties = {
  display: 'flex',
  gap: 7,
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  marginTop: 12,
};

const secondaryBtn: React.CSSProperties = {
  padding: '6px 10px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-dim)',
  fontSize: 11,
  cursor: 'pointer',
};

const primaryBtn: React.CSSProperties = {
  ...secondaryBtn,
  background: 'var(--accent-soft)',
  borderColor: 'var(--accent-line)',
  color: 'var(--accent)',
};

const replaceBtn: React.CSSProperties = {
  ...secondaryBtn,
  background: 'rgba(201,123,114,0.1)',
  borderColor: 'rgba(201,123,114,0.35)',
  color: 'var(--danger)',
};

const footnote: React.CSSProperties = {
  margin: '9px 0 0',
  color: 'var(--text-faint)',
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  lineHeight: 1.4,
};
