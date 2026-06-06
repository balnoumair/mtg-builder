import { parseManaCost, getManaMeta } from '../lib/mana';

interface ManaProps {
  symbol: string;
  size?: number;
}

export function Mana({ symbol, size = 12 }: ManaProps) {
  const isNumeric = /^\d+$/.test(symbol);
  const meta = getManaMeta(isNumeric ? 'C' : symbol);
  const label = isNumeric ? symbol : (symbol === 'C' ? '' : symbol.charAt(0));
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: meta.hex,
        color: '#15130f',
        fontFamily: 'var(--font-mono)',
        fontSize: Math.max(8, size * 0.58),
        fontWeight: 700,
        lineHeight: 1,
        textAlign: 'center',
        boxShadow: `inset 0 0 0 1px ${meta.ring}`,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

interface ManaSymbolsProps {
  cost: string;
  size?: 'sm' | 'md' | number;
}

export default function ManaSymbols({ cost, size = 'sm' }: ManaSymbolsProps) {
  if (!cost) return null;
  const symbols = parseManaCost(cost);
  const px = typeof size === 'number'
    ? size
    : (size === 'sm' ? 12 : 16);

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, verticalAlign: 'middle' }}>
      {symbols.map((s, i) => <Mana key={i} symbol={s} size={px} />)}
    </span>
  );
}

interface ColorIdentityProps {
  colors: string[];
  size?: number;
}

export function ColorIdentity({ colors, size = 10 }: ColorIdentityProps) {
  const list = colors && colors.length ? colors : ['C'];
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {list.map((c, i) => <Mana key={`${c}-${i}`} symbol={c} size={size} />)}
    </span>
  );
}
