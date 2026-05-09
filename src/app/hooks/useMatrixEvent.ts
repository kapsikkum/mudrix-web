import { useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

export function useMatrixEvent(
  client: MatrixClient | null | undefined,
  event: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (...args: any[]) => void
): void {
  useEffect(() => {
    if (!client) return;
    client.on(event as Parameters<typeof client.on>[0], handler);
    return () => {
      client.off(event as Parameters<typeof client.off>[0], handler);
    };
  }, [client, event, handler]);
}
