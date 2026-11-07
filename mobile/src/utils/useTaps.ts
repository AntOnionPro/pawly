import { useEffect, useRef } from 'react';

/** Two taps closer than this are a double tap. */
export const DOUBLE_TAP_MS = 300;

interface Taps {
  onTap?: () => void;
  onDoubleTap?: () => void;
}

/**
 * One press handler for a single tap and a double tap. With both, the single tap waits a moment
 * to be sure no second tap follows; with only one of them, there is no wait.
 */
export function useTaps({ onTap, onDoubleTap }: Taps): () => void {
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (pending.current) clearTimeout(pending.current);
    },
    [],
  );

  return () => {
    const now = Date.now();
    if (onDoubleTap && now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      onDoubleTap();
      return;
    }
    lastTap.current = now;
    if (!onTap) return;
    if (!onDoubleTap) {
      onTap();
      return;
    }
    pending.current = setTimeout(() => {
      pending.current = null;
      onTap();
    }, DOUBLE_TAP_MS);
  };
}
