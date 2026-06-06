interface Props {
  loadingMore: boolean;
  hasMore: boolean;
  loadedCount: number;
  total: number;
}

export default function InfiniteScrollFooter({ loadingMore, hasMore, loadedCount, total }: Props) {
  if (loadedCount === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '12px 0 4px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-mute)',
      }}
    >
      {loadingMore ? (
        'Loading more…'
      ) : hasMore ? (
        'Scroll for more'
      ) : (
        `${loadedCount.toLocaleString()} of ${total.toLocaleString()} cards`
      )}
    </div>
  );
}
