import { useEffect, useState, type RefObject } from 'react';

interface Options {
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

/**
 * Returns a callback ref for the sentinel element. It is a callback (not a
 * ref object) so the observer re-attaches when the sentinel remounts, e.g.
 * when a collapsed pane is expanded again, even if no loading state changed.
 */
export function useInfiniteScrollSentinel(
  scrollRef: RefObject<HTMLElement | null>,
  { hasMore, loading, loadingMore, onLoadMore, rootMargin = '240px' }: Options,
) {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && !loadingMore) {
          onLoadMore();
        }
      },
      { root, rootMargin, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [scrollRef, sentinel, hasMore, loading, loadingMore, onLoadMore, rootMargin]);

  return setSentinel;
}
