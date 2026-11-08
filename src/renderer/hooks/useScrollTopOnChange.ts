import { useEffect, useRef, type RefObject } from 'react';

/** Jumps the scroll container back to the top whenever `key` changes identity. */
export function useScrollTopOnChange(scrollRef: RefObject<HTMLElement | null>, key: unknown) {
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [scrollRef, key]);
}
