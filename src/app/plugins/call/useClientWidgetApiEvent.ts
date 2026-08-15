import { useEffect } from 'react';
import type { ClientWidgetApi } from 'matrix-widget-api';

export function useClientWidgetApiEvent<T>(
  client: ClientWidgetApi | undefined,
  eventName: string,
  callback: (ev: CustomEvent<T>) => void
) {
  useEffect(() => {
    if (!client) return;
    client.on(eventName, callback as (...args: unknown[]) => void);
    return () => {
      client.off(eventName, callback as (...args: unknown[]) => void);
    };
  }, [client, eventName, callback]);
}
