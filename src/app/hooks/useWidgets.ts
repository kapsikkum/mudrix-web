import { useState, useMemo, useCallback } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

import { roomState } from '@/util/matrix';

export const WIDGET_TYPES = {
  STICKER_PICKER: 'm.stickerpicker',
} as const;

export interface RoomWidget {
  stateKey: string;
  type: string;
  url: string;
  name: string;
  data: Record<string, unknown>;
  creatorUserId: string;
}

export function useWidgets(client: MatrixClient | null, roomId: string | null) {
  const [revision, setRevision] = useState(0);

  const widgets = useMemo(() => {
    if (!client || !roomId) return [];
    const room = client.getRoom(roomId);
    if (!room) return [];

    const result: RoomWidget[] = [];
    const stateEvents = roomState(room).events;
    const widgetEvents = stateEvents.get('m.room.widget');
    if (widgetEvents) {
      for (const [stateKey, event] of widgetEvents) {
        const content = event.getContent();
        if (content && content.type) {
          result.push({
            stateKey,
            type: content.type as string,
            url: (content.url as string) ?? '',
            name: (content.name as string) ?? '',
            data: (content.data as Record<string, unknown>) ?? {},
            creatorUserId: (content.creatorUserId as string) ?? '',
          });
        }
      }
    }
    return result;
  }, [client, roomId, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);

  // Refresh on any room widget state change
  const handleStateEvent = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() === 'm.room.widget' && event.getRoomId() === roomId) {
        bump();
      }
    },
    [roomId, bump]
  );
  useMatrixEvent(client, 'RoomState.events', handleStateEvent);

  const stickerWidget = widgets.find((w) => w.type === WIDGET_TYPES.STICKER_PICKER);
  const hasSticker = !!stickerWidget;

  const removeWidget = useCallback(
    async (stateKey: string) => {
      if (!client || !roomId) return;
      await client.sendStateEvent(
        roomId,
        'm.room.widget' as UntypedStateEventType,
        {} as RawStateContent,
        stateKey
      );
    },
    [client, roomId]
  );

  const updateWidget = useCallback(
    async (
      stateKey: string,
      changes: { url?: string; data?: Record<string, unknown>; name?: string }
    ) => {
      if (!client || !roomId) return;
      const existing = widgets.find((w) => w.stateKey === stateKey);
      if (!existing) throw new Error(`Widget not found: ${stateKey}`);
      await client.sendStateEvent(
        roomId,
        'm.room.widget' as UntypedStateEventType,
        {
          type: existing.type,
          url: changes.url ?? existing.url,
          name: changes.name ?? existing.name,
          creatorUserId: existing.creatorUserId,
          data: changes.data ?? existing.data,
        } as RawStateContent,
        stateKey
      );
    },
    [client, roomId, widgets]
  );

  return {
    widgets,
    stickerWidget,
    hasSticker,
    removeWidget,
    updateWidget,
  };
}
