import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import ManaSymbols from './ManaSymbols';

export interface PendingChangeEntry {
  cardId: string;
  name: string;
  manaCost: string;
  count: number;
  /** Copies of this card currently in the singles collection. */
  collectionQty: number;
}

interface Props {
  deckName: string;
  additions: PendingChangeEntry[];
  removals: PendingChangeEntry[];
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export default function DeckChangesModal({ deckName, additions, removals, onConfirm, onClose }: Props) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const addedCount = additions.reduce((s, e) => s + e.count, 0);
  const removedCount = removals.reduce((s, e) => s + e.count, 0);
  const deducted = additions.reduce((s, e) => s + Math.min(e.count, e.collectionQty), 0);
  const [subtitleBefore, subtitleAfter] = t('deckModals.changes.subtitle').split('{name}');
  const [removedBefore, removedAfter] = t(
    removedCount === 1 ? 'deckModals.changes.removedOne' : 'deckModals.changes.removedOther',
  ).split('{count}');
  const [addedBefore, addedAfter] = t(
    addedCount === 1 ? 'deckModals.changes.addedOne' : 'deckModals.changes.addedOther',
  ).split('{count}');

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '80vh',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ padding: 18, borderBottom: '1px solid var(--border)' }}>
          <h2
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            {t('deckModals.changes.title')}
          </h2>
          <p style={{ color: 'var(--text-mute)', fontSize: 12, marginTop: 4, marginBottom: 0 }}>
            {subtitleBefore}
            <span style={{ color: 'var(--text-dim)' }}>{deckName}</span>
            {subtitleAfter}
          </p>
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border)',
            fontSize: 12,
            color: 'var(--text-dim)',
            lineHeight: 1.5,
          }}
        >
          {removedCount > 0 && (
            <>
              {removedBefore}
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{removedCount}</span>
              {removedAfter}{' '}
            </>
          )}
          {addedCount > 0 && (
            <>
              {addedBefore}
              <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{addedCount}</span>
              {addedAfter}
              {deducted > 0 ? (
                <span style={{ color: 'var(--text-mute)' }}>
                  {' '}
                  {t('deckModals.changes.deducted', { count: deducted })}
                </span>
              ) : null}
              .
            </>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px' }}>
          {removals.length > 0 && (
            <ChangeList
              title={t('deckModals.changes.movingToCollection')}
              entries={removals}
              sign="−"
              signColor="var(--danger)"
            />
          )}
          {additions.length > 0 && (
            <ChangeList
              title={t('deckModals.changes.joiningDeck')}
              entries={additions}
              sign="+"
              signColor="var(--good)"
              noteFor={(e) =>
                e.collectionQty > 0
                  ? t('deckModals.changes.fromCollection', { count: Math.min(e.count, e.collectionQty) })
                  : t('deckModals.changes.notInCollection')
              }
            />
          )}
        </div>

        <div
          style={{
            padding: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '7px 12px',
              background: 'transparent',
              color: 'var(--text-mute)',
              border: 'none',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {t('deckModals.cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              padding: '7px 14px',
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--accent-line)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: confirming ? 'default' : 'pointer',
              opacity: confirming ? 0.6 : 1,
            }}
          >
            {confirming ? t('deckModals.changes.confirming') : t('deckModals.changes.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChangeList({
  title,
  entries,
  sign,
  signColor,
  noteFor,
}: {
  title: string;
  entries: PendingChangeEntry[];
  sign: string;
  signColor: string;
  noteFor?: (e: PendingChangeEntry) => string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-mute)',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {entries.map((e) => (
        <div
          key={e.cardId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 6px',
            fontSize: 12,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: signColor,
              width: 28,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {sign}
            {e.count}
          </span>
          <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {e.name}
          </span>
          <ManaSymbols cost={e.manaCost} size={11} />
          {noteFor && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-mute)' }}>
              {noteFor(e)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
