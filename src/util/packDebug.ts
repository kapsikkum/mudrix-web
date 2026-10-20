/**
 * Opt-in diagnostics for pack saving / media loading. Enable in the browser console with
 * `localStorage.setItem('mudrix.debugPacks', '1')` and reload. Silent otherwise.
 */
export function packDebugEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('mudrix.debugPacks') === '1';
  } catch {
    return false;
  }
}

export function packDebug(label: string, ...args: unknown[]): void {
  if (!packDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.debug(`[packs] ${label}`, ...args);
}

/** Returns a function that logs the elapsed time (ms) when called. */
export function packTimer(label: string): (extra?: Record<string, unknown>) => void {
  if (!packDebugEnabled()) return () => {};
  const start = performance.now();
  return (extra) => {
    // eslint-disable-next-line no-console
    console.debug(`[packs] ${label}: ${Math.round(performance.now() - start)} ms`, extra ?? '');
  };
}
