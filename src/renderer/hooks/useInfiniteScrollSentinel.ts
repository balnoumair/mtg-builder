import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
}

export function useInfiniteScrollSentinel(
  scrollRef: RefObject<HTMLElement | null>,
  { hasMore, loading, loadingMore, onLoadMore, rootMargin = '240px' }: Options,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
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
  }, [scrollRef, hasMore, loading, loadingMore, onLoadMore, rootMargin]);

  return sentinelRef;
}
