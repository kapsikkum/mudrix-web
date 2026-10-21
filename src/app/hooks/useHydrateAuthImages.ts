import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { hydrateAuthImages } from '@/util/hydrateAuthImages';

/**
 * Loads authenticated inline images (custom emoji) wherever message HTML is rendered: replies,
 * pins, search results, threads and so on, not only the main message body.
 */
export function useHydrateAuthImages(client: MatrixClient | null): void {
  useEffect(() => {
    if (!client) return undefined;
    let frame = 0;
    const run = () => {
      frame = 0;
      hydrateAuthImages(document.body, client);
    };
    const observer = new MutationObserver(() => {
      if (!frame) frame = window.requestAnimationFrame(run);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    run();
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [client]);
}
