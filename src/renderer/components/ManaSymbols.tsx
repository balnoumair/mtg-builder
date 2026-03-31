import { parseManaCost, getManaColor, getManaBg } from '../lib/mana';

interface Props {
  cost: string;
  size?: 'sm' | 'md';
}

export default function ManaSymbols({ cost, size = 'sm' }: Props) {
  if (!cost) return null;
  const symbols = parseManaCost(cost);

  const dims = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs';

  return (
    <span className="inline-flex gap-0.5 items-center">
      {symbols.map((sym, i) => {
        const isNumeric = /^\d+$/.test(sym);
        return (
          <span
            key={i}
            className={`${dims} rounded-full inline-flex items-center justify-center font-bold flex-shrink-0`}
            style={{
              backgroundColor: isNumeric ? 'rgba(144,152,160,0.15)' : getManaBg(sym),
              color: isNumeric ? '#9098a0' : getManaColor(sym),
            }}
          >
            {isNumeric ? sym : sym.charAt(0)}
          </span>
        );
      })}
    </span>
  );
}
