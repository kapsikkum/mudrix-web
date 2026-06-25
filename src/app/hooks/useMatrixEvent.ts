import { useEffect, useRef } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';

export function useMatrixEvent<Args extends unknown[]>(
  client: MatrixClient | null | undefined,
  event: string,
  handler: (...args: Args) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!client) return;

    const wrapper = (...args: Args) => handlerRef.current(...args);

    client.on(event as Parameters<typeof client.on>[0], wrapper as Parameters<typeof client.on>[1]);
    return () => {
      client.off(
        event as Parameters<typeof client.off>[0],
        wrapper as Parameters<typeof client.off>[1]
      );
    };
  }, [client, event]);
}
