import { ColorIdentity } from './ManaSymbols';

const GAP = 2;

function columnWidth(symbolSize: number, count = 5) {
  return count * symbolSize + (count - 1) * GAP;
}

interface Props {
  colors?: string[];
  /** Sidebar uses compact sizing to fit the narrow column. */
  compact?: boolean;
}

export default function DeckRowColorIdentity({ colors, compact = false }: Props) {
  const size = compact ? 10 : 11;
  const width = columnWidth(size);

  if (!colors?.length) {
    return <span style={{ width, minWidth: width, flexShrink: 0 }} aria-hidden />;
  }

  return (
    <span
      style={{
        width,
        minWidth: width,
        maxWidth: width,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: GAP,
        overflow: 'hidden',
      }}
    >
      <ColorIdentity colors={colors} size={size} />
    </span>
  );
}
