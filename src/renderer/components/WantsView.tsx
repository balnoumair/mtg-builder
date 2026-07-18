import { useEffect, useMemo, useState } from 'react';
import type { WantItem } from '../../shared/types';
import { BASIC_LAND_NAMES } from '../../shared/basicLands';
import { copyText } from '../lib/clipboard';
import { useCardDetail } from '../hooks/useCards';
import CardDetail from './CardDetail';
import ManaSymbols from './ManaSymbols';

interface Props {
  active: boolean;
  collectionVersion: number;
}

const GRID_COLUMNS = '40px minmax(0, 1fr) 88px';

export default function WantsView({ active, collectionVersion }: Props) {
  const [items, setItems] = useState<WantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [excludeBasicLands, setExcludeBasicLands] = useState(true);
  const [copied, setCopied] = useState(false);
  const { card, printings, open, showCard, close } = useCardDetail();

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

  const visible = useMemo(
    () => (excludeBasicLands ? items.filter((i) => !BASIC_LAND_NAMES.has(i.name)) : items),
    [items, excludeBasicLands],
  );

  const totalCopies = useMemo(
    () => visible.reduce((sum, item) => sum + item.to_buy, 0),
    [visible],
  );

  const exportText = useMemo(
    () => visible.map((i) => `${i.to_buy} ${i.name}`).join('\n'),
    [visible],
  );

  const handleCopy = async () => {
    await copyText(exportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const detailOwned = card ? (items.find((i) => i.name === card.name)?.owned ?? 0) : 0;
  const hiddenBasics = items.length - (excludeBasicLands ? visible.length : items.length);

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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            Wants
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
              <span style={{ color: 'var(--text-dim)' }}>{visible.length}</span> cards
            </span>
            <span>
              <span style={{ color: 'var(--text-dim)' }}>{totalCopies}</span> copies
            </span>
          </div>
          <div style={{ flex: 1 }} />
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
            Exclude basic lands
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
            {copied ? 'Copied!' : 'Copy list'}
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <p style={{ padding: 'var(--pad)', fontSize: 12, color: 'var(--text-mute)' }}>Loading…</p>
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
            <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: 0 }}>Nothing to buy</p>
            <p style={{ color: 'var(--text-mute)', fontSize: 11, margin: 0, maxWidth: 380 }}>
              Cards you still need for wishlist decks and unconfirmed deck additions show up here
              once they're missing from My Cards.
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
              <span style={{ textAlign: 'right' }}>Buy</span>
              <span>Card</span>
              <span style={{ textAlign: 'right' }}>Owned</span>
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
          printings={printings}
          onClose={close}
          collectionQuantity={detailOwned}
        />
      )}
    </div>
  );
}

function WantRow({ item, onClick }: { item: WantItem; onClick: () => void }) {
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
                  ? `Unconfirmed addition to ${source.deck_name}`
                  : `Wanted by wishlist deck ${source.deck_name}`
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
              {item.owned} of {item.needed}
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
