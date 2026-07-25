import type { Tag } from '../../shared/types';
import { tagColorTokens } from '../../shared/tagColors';

/**
 * A tag reads as a binder divider tab: a colored spine on the leading edge, the
 * user's own words beside it. System-derived pills (Owned, Wishlist, cost/type)
 * are fully tinted uppercase mono — keeping tags visually separate stops a
 * label someone typed from looking like something the app worked out.
 *
 * The label stays neutral at rest so a row of three tags does not shout; the
 * spine carries the hue, and `active` promotes the label to it.
 */

interface Props {
  tag: Tag;
  size?: 'sm' | 'md';
  active?: boolean;
  count?: number;
  onRemove?: () => void;
}

export default function DeckTag({ tag, size = 'sm', active = false, count, onRemove }: Props) {
  const c = tagColorTokens(tag.color);
  const small = size === 'sm';

  return (
    <span
      className="group/tag"
      style={{
        display: 'inline-flex',
        alignItems: 'stretch',
        maxWidth: '100%',
        // No resting border: the spine is the edge. A full outline would make
        // these read as buttons and would compete with the tinted system pills.
        background: active ? c.wash : 'var(--bg-chip)',
        border: `1px solid ${active ? c.line : 'transparent'}`,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ width: 2, flexShrink: 0, background: c.ink }} />
      <span
        style={{
          padding: small ? '2px 6px 2px 5px' : '3px 8px 3px 6px',
          fontFamily: 'var(--font-ui)',
          fontSize: small ? 10 : 11,
          fontWeight: 500,
          color: active ? c.ink : 'var(--text-dim)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {tag.name}
      </span>
      {count !== undefined && (
        <span
          style={{
            padding: small ? '2px 6px 2px 0' : '3px 8px 3px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: small ? 9 : 10,
            color: 'var(--text-faint)',
          }}
        >
          {count}
        </span>
      )}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title={`Remove ${tag.name}`}
          className="opacity-0 group-hover/tag:opacity-100"
          style={{
            padding: '0 5px 0 1px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-mute)',
            cursor: 'pointer',
            fontSize: 12,
            lineHeight: 1,
            transition: 'opacity 120ms',
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}
