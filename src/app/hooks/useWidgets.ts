import { useState, useCallback, useEffect } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { useAtom } from 'jotai';
import { widgetsRefreshAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

export const WIDGET_TYPES = {
  STICKER_PICKER: 'm.stickerpicker',
  JITSI_VOICE_CHANNEL: 'jitsi-voice-channel',
} as const;

export interface RoomWidget {
  stateKey: string;
  type: string;
  url: string;
  name: string;
  data: Record<string, unknown>;
  creatorUserId: string;
}

// Registry mirrors WidgetManager.#widgetRegistry
const WIDGET_REGISTRY: Record<string, { name: string; defaultUrl: string | null }> = {
  [WIDGET_TYPES.STICKER_PICKER]: {
    name: 'Sticker Picker',
    defaultUrl: 'https://stickerpicker.wizardchat.org/',
  },
  [WIDGET_TYPES.JITSI_VOICE_CHANNEL]: {
    name: 'Meeting Room',
    defaultUrl: null,
  },
};

export function useWidgets(client: MatrixClient | null, roomId: string | null) {
  const [, setRefresh] = useAtom(widgetsRefreshAtom);
  const [widgets, setWidgets] = useState<RoomWidget[]>([]);

  const rebuild = useCallback(() => {
    if (!client || !roomId) {
      setWidgets([]);
      return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
      setWidgets([]);
      return;
    }

    const result: RoomWidget[] = [];
    const stateEvents = room.currentState.events;
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
    setWidgets(result);
  }, [client, roomId]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  // Refresh on any room widget state change
  const handleStateEvent = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() === 'm.room.widget' && event.getRoomId() === roomId) {
        rebuild();
        setRefresh((n) => n + 1);
      }
    },
    [roomId, rebuild, setRefresh]
  );
  useMatrixEvent(client, 'RoomState.events', handleStateEvent);

  const stickerWidget = widgets.find((w) => w.type === WIDGET_TYPES.STICKER_PICKER);
  const voiceWidget = widgets.find((w) => w.type === WIDGET_TYPES.JITSI_VOICE_CHANNEL);
  const hasSticker = !!stickerWidget;
  const hasVoiceChannel = !!voiceWidget;
  const jitsiDomain: string | null = (() => {
    if (!voiceWidget) return null;
    if (voiceWidget.data?.jitsiDomain) return voiceWidget.data.jitsiDomain as string;
    // Fall back to parsing the hostname out of the widget url
    try {
      return new URL(voiceWidget.url).hostname || null;
    } catch {
      return null;
    }
  })();
  const jitsiConfId = (voiceWidget?.data?.confId as string) ?? '';

  const addWidget = useCallback(
    async (type: string, customData: { url?: string; data?: Record<string, unknown> } = {}) => {
      if (!client || !roomId) return;
      const reg = WIDGET_REGISTRY[type];
      if (!reg) throw new Error(`Unknown widget type: ${type}`);
      const widgetId =
        type === WIDGET_TYPES.STICKER_PICKER ? 'stickerpicker' : `${type}-${Date.now()}`;
      const url = customData.url ?? reg.defaultUrl ?? '';
      await client.sendStateEvent(
        roomId,
        'm.room.widget' as UntypedStateEventType,
        {
          type,
          url,
          name: reg.name,
          creatorUserId: client.getUserId(),
          data: customData.data ?? {},
        } as RawStateContent,
        widgetId
      );
    },
    [client, roomId]
  );

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
    voiceWidget,
    hasSticker,
    hasVoiceChannel,
    jitsiDomain,
    jitsiConfId,
    addWidget,
    removeWidget,
    updateWidget,
  };
}
