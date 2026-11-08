import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { useInfiniteScrollSentinel } from '../useInfiniteScrollSentinel';
import { useScrollTopOnChange } from '../useScrollTopOnChange';

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;

const observers: Array<{ callback: ObserverCallback; targets: Element[]; disconnected: boolean }> = [];

class FakeIntersectionObserver {
  private record: (typeof observers)[number];
  constructor(callback: ObserverCallback) {
    this.record = { callback, targets: [], disconnected: false };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.targets.push(target);
  }
  disconnect() {
    this.record.disconnected = true;
  }
}

function Pane({ shown, onLoadMore }: { shown: boolean; onLoadMore: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useInfiniteScrollSentinel(scrollRef, {
    hasMore: true,
    loading: false,
    loadingMore: false,
    onLoadMore,
  });
  if (!shown) return null;
  return (
    <div ref={scrollRef}>
      <div ref={sentinelRef} data-testid="sentinel" />
    </div>
  );
}

describe('useInfiniteScrollSentinel', () => {
  const original = globalThis.IntersectionObserver;
  beforeEach(() => {
    observers.length = 0;
    globalThis.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  });
  afterEach(() => {
    globalThis.IntersectionObserver = original;
  });

  it('re-observes a remounted sentinel even when no loading state changed', () => {
    const onLoadMore = vi.fn();
    const { rerender, getByTestId } = render(<Pane shown onLoadMore={onLoadMore} />);
    const first = getByTestId('sentinel');

    rerender(<Pane shown={false} onLoadMore={onLoadMore} />);
    rerender(<Pane shown onLoadMore={onLoadMore} />);
    const second = getByTestId('sentinel');
    expect(second).not.toBe(first);

    const live = observers.filter((o) => !o.disconnected);
    expect(live).toHaveLength(1);
    expect(live[0].targets).toHaveLength(1);
    expect(live[0].targets[0]).toBe(second);

    act(() => live[0].callback([{ isIntersecting: true }]));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});

function ScrollPane({ filterKey }: { filterKey: object }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollTopOnChange(scrollRef, filterKey);
  return <div ref={scrollRef} data-testid="scroller" />;
}

describe('useScrollTopOnChange', () => {
  it('scrolls to the top when the key changes, but not on mount or same-key rerenders', () => {
    const scrollTo = vi.fn();
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    HTMLElement.prototype.scrollTo = scrollTo;
    try {
      const filters = { query: 'a' };
      const { rerender } = render(<ScrollPane filterKey={filters} />);
      rerender(<ScrollPane filterKey={filters} />);
      expect(scrollTo).not.toHaveBeenCalled();

      rerender(<ScrollPane filterKey={{ query: 'ab' }} />);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    } finally {
      HTMLElement.prototype.scrollTo = originalScrollTo;
    }
  });
});
