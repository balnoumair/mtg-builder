import { useEffect, useMemo, useState } from 'react';
import type { WantItem } from '../../shared/types';
import { BASIC_LAND_NAMES } from '../../shared/basicLands';
import { copyText } from '../lib/clipboard';
import { useCardDetail } from '../hooks/useCards';
import CardDetail from './CardDetail';
import ManaSymbols from './ManaSymbols';
import FilterDropdown from './FilterDropdown';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  active: boolean;
  collectionVersion: number;
}

const GRID_COLUMNS = '40px minmax(0, 1fr) 88px';

export default function WantsView({ active, collectionVersion }: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<WantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [excludeBasicLands, setExcludeBasicLands] = useState(true);
  const [hiddenDecks, setHiddenDecks] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const { card, open, showCard, close } = useCardDetail();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    window.electronAPI.getWants().then((result) => {
      if (cancelled) return;
      setItems(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [active, collectionVersion]);

  const decks = useMemo(() => {
    const options = new Map<string, { value: string; label: string; count: number }>();
    for (const item of items) {
      for (const source of item.sources) {
        const value = String(source.deck_id);
        const option = options.get(value) ?? { value, label: source.deck_name, count: 0 };
        option.count += source.need;
        options.set(value, option);
      }
    }
    return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  const selectedItems = useMemo(() => items.map((item) => {
    const sources = item.sources.filter((source) => !hiddenDecks.includes(String(source.deck_id)));
    const needed = sources.reduce((sum, source) => sum + source.need, 0);
    return { ...item, sources, needed, to_buy: Math.max(0, needed - item.owned) };
  }).filter((item) => item.to_buy > 0), [items, hiddenDecks]);

  const visible = useMemo(
    () => (excludeBasicLands ? selectedItems.filter((i) => !BASIC_LAND_NAMES.has(i.name)) : selectedItems),
    [selectedItems, excludeBasicLands],
  );

  const totalCopies = useMemo(
    () => visible.reduce((sum, item) => sum + item.to_buy, 0),
    [visible],
  );

  const exportText = useMemo(
    () => visible.map((i) => `${i.to_buy} ${i.name}`).join('\n'),
    [visible],
  );

  useEffect(() => { setCopied(false); }, [exportText]);

  const handleCopy = async () => {
    await copyText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detailOwned = card ? (items.find((i) => i.name === card.name)?.owned ?? 0) : 0;
  const hiddenBasics = selectedItems.length - visible.length;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui)',
        color: 'var(--text)',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--pad) var(--pad) var(--pad-tight)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            {t('wants.title')}
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 12,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-mute)',
            }}
          >
            <span>
              <span style={{ color: 'var(--text-dim)' }}>{visible.length}</span>{' '}
              {visible.length === 1 ? t('wants.cardsOne') : t('wants.cardsOther')}
            </span>
            <span>
              <span style={{ color: 'var(--text-dim)' }}>{totalCopies}</span>{' '}
              {totalCopies === 1 ? t('wants.copiesOne') : t('wants.copiesOther')}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <FilterDropdown
            label={t('wants.decksFilter')}
            options={decks}
            hidden={hiddenDecks.filter((id) => decks.some((deck) => deck.value === id))}
            onHiddenChange={setHiddenDecks}
            emptyHint={t('wants.decksFilterEmpty')}
          />
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: 'var(--text-dim)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              type="checkbox"
              checked={excludeBasicLands}
              onChange={(e) => setExcludeBasicLands(e.target.checked)}
            />
            {t('wants.excludeBasicLands')}
            {hiddenBasics > 0 && (
              <span style={{ color: 'var(--text-mute)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                ({hiddenBasics})
              </span>
            )}
          </label>
          <button
            onClick={handleCopy}
            disabled={visible.length === 0}
            style={{
              padding: '6px 12px',
              background: copied ? 'rgba(134,169,140,0.12)' : 'var(--accent-soft)',
              color: copied ? 'var(--good)' : 'var(--accent)',
              border: `1px solid ${copied ? 'rgba(134,169,140,0.4)' : 'var(--accent-line)'}`,
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              cursor: visible.length === 0 ? 'default' : 'pointer',
              opacity: visible.length === 0 ? 0.4 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            {copied ? t('wants.copied') : t('wants.copyList')}
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <p style={{ padding: 'var(--pad)', fontSize: 12, color: 'var(--text-mute)' }}>{t('app.loading')}</p>
        ) : visible.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '64px 24px',
              textAlign: 'center',
            }}
          >
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>{hiddenDecks.length > 0 ? t('wants.emptySelected') : t('wants.empty')}</p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, margin: 0, maxWidth: 380 }}>
              {t('wants.emptyHint')}
            </p>
          </div>
        ) : (
          <div style={{ padding: '6px var(--pad) var(--pad)' }}>
            {/* Column header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLUMNS,
                gap: 12,
                padding: '8px 10px 6px',
                borderBottom: '1px solid var(--border-strong)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-mute)',
              }}
            >
              <span style={{ textAlign: 'right' }}>{t('wants.columnBuy')}</span>
              <span>{t('wants.columnCard')}</span>
              <span style={{ textAlign: 'right' }}>{t('wants.columnOwned')}</span>
            </div>

            {visible.map((item) => (
              <WantRow key={item.name} item={item} onClick={() => showCard(item.card)} />
            ))}
          </div>
        )}
      </div>

      {open && card && (
        <CardDetail
          card={card}
          onClose={close}
          collectionQuantity={detailOwned}
        />
      )}
    </div>
  );
}

function WantRow({ item, onClick }: { item: WantItem; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLUMNS,
        gap: 12,
        alignItems: 'center',
        padding: '7px 10px',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-row-hov)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      <span
        style={{
          textAlign: 'right',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {item.to_buy}
      </span>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {item.name}
          </span>
          <ManaSymbols cost={item.card.mana_cost || ''} size={11} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              textTransform: 'uppercase',
              color: 'var(--text-mute)',
              flexShrink: 0,
            }}
          >
            {item.card.set_code}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {item.sources.map((source) => (
            <span
              key={source.deck_id}
              title={
                source.pending
                  ? t('wants.sourcePending', { deck: source.deck_name })
                  : t('wants.sourceWishlist', { deck: source.deck_name })
              }
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                padding: '1px 7px',
                borderRadius: 999,
                background: 'var(--bg-chip)',
                border: '1px solid var(--border)',
                color: source.pending ? 'var(--good)' : 'var(--text-dim)',
                maxWidth: 180,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {source.pending ? '+ ' : ''}
              {source.deck_name} ×{source.need}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        {item.owned > 0 ? (
          <>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-dim)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t('wants.ownedOfNeeded', { owned: item.owned, needed: item.needed })}
            </span>
            <span
              style={{
                width: 40,
                height: 2,
                borderRadius: 1,
                background: 'var(--border-strong)',
                overflow: 'hidden',
                display: 'block',
              }}
            >
              <span
                style={{
                  display: 'block',
                  height: '100%',
                  width: `${Math.min(100, (item.owned / item.needed) * 100)}%`,
                  background: 'var(--good)',
                }}
              />
            </span>
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>—</span>
        )}
      </div>
    </div>
  );
}
