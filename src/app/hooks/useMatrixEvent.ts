import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

export function useMatrixEvent<Args extends unknown[]>(
  client: MatrixClient | null | undefined,
  event: string,
  handler: (...args: Args) => void
): void {
  useEffect(() => {
    if (!client) return;
    client.on(event as Parameters<typeof client.on>[0], handler);
    return () => {
      client.off(event as Parameters<typeof client.off>[0], handler);
    };
  }, [client, event, handler]);
}
