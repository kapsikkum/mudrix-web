import { useRef, useCallback, useEffect } from 'react';

export function useThrottle<T extends (...args: unknown[]) => void>(fn: T, delay = 200): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttled = useCallback(
    (...args: unknown[]) => {
      if (timerRef.current !== null) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        fn(...args);
      }, delay);
    },
    [fn, delay]
  ) as unknown as T;

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    []
  );

  return throttled;
}
