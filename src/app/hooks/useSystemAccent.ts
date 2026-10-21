import { useEffect, useState } from 'react';
import { getSystemAccent, isTauri } from '@/util/desktop';

/**
 * The operating system's accent colour while `enabled` (desktop app only). It is read once and
 * again whenever the window regains focus, which is when a change made in the system settings
 * is noticed.
 */
export function useSystemAccent(enabled: boolean): string | null {
  const [accent, setAccent] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !isTauri()) {
      setAccent(null);
      return undefined;
    }
    let cancelled = false;
    const refresh = () => {
      getSystemAccent().then((value) => {
        if (!cancelled) setAccent(value);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
    };
  }, [enabled]);

  return accent;
}
