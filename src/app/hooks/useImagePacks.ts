import { useState, useCallback, useEffect } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { EventTimeline } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomState } from '@/util/matrix';

function getClientAccountData(client: MatrixClient, eventType: string): MatrixEvent | undefined {
  return (
    client as unknown as { getAccountData(t: string): MatrixEvent | undefined }
  ).getAccountData(eventType);
}

export interface ImagePackImage {
  url: string;
  usage: string[];
  body?: string;
  mimetype?: string;
}

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';
const PONIES_USER_EMOTES = 'im.ponies.user_emotes';
const PONIES_EMOTE_ROOMS = 'im.ponies.emote_rooms';

function getStateEvents(room: Room, eventType: string): MatrixEvent[] {
  const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
  if (!state) return [];
  const raw = state.getStateEvents(eventType);
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function extractPacks(events: MatrixEvent[], existing: Map<string, ImagePackImage>): void {
  for (const event of events) {
    const content = event.getContent() as Record<string, unknown>;
    const images = content?.images as
      | Record<string, { url: string; usage?: string[]; body?: string; mimetype?: string }>
      | undefined;
    if (!images) continue;
    for (const [shortcode, img] of Object.entries(images)) {
      if (img?.url && !existing.has(shortcode)) {
        existing.set(shortcode, {
          url: img.url,
          usage: img.usage ?? ['emoticon'],
          body: img.body,
          mimetype: img.mimetype,
        });
      }
    }
  }
}

export function useImagePacks(
  client: MatrixClient | null,
  roomId: string | null
): Map<string, ImagePackImage> {
  const [packs, setPacks] = useState<Map<string, ImagePackImage>>(new Map());

  const rebuild = useCallback(() => {
    const result = new Map<string, ImagePackImage>();
    if (!client || !roomId) {
      setPacks(result);
      return;
    }
    const room = client.getRoom(roomId);
    if (!room) {
      setPacks(result);
      return;
    }

    extractPacks(getStateEvents(room, PONIES_ROOM_EMOTES), result);

    const parentEvents = roomState(room).events.get('m.space.parent');
    if (parentEvents) {
      for (const [, ev] of parentEvents) {
        const parentRoomId = ev.getStateKey();
        if (parentRoomId) {
          const parentRoom = client.getRoom(parentRoomId);
          if (parentRoom) {
            extractPacks(getStateEvents(parentRoom, PONIES_ROOM_EMOTES), result);
          }
        }
      }
    }

    const stdPackEvents = roomState(room).events.get('m.room.image_pack');
    if (stdPackEvents) {
      extractPacks(Array.from(stdPackEvents.values()), result);
    }

    try {
      const userPackEvent = getClientAccountData(client, PONIES_USER_EMOTES);
      if (userPackEvent) {
        extractPacks([userPackEvent], result);
      }
    } catch {
      /* noop */
    }

    try {
      const emoteRoomsEvent = getClientAccountData(client, PONIES_EMOTE_ROOMS);
      if (emoteRoomsEvent) {
        const content = emoteRoomsEvent.getContent() as {
          rooms?: Record<string, Record<string, unknown>>;
        };
        const rooms = content?.rooms;
        if (rooms) {
          for (const [rid, stateKeys] of Object.entries(rooms)) {
            const r = client.getRoom(rid);
            if (!r) continue;
            const allPacks = getStateEvents(r, PONIES_ROOM_EMOTES);
            const filtered = allPacks.filter((ev) => {
              const sk = ev.getStateKey();
              return typeof sk === 'string' && sk in stateKeys;
            });
            extractPacks(filtered, result);
          }
        }
      }
    } catch {
      /* noop */
    }

    setPacks(result);
  }, [client, roomId]);

  useEffect(() => {
    rebuild();
  }, [rebuild]);

  const handleStateEvent = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (
        et === PONIES_ROOM_EMOTES ||
        et === 'm.room.image_pack' ||
        et === PONIES_USER_EMOTES ||
        et === PONIES_EMOTE_ROOMS
      ) {
        rebuild();
      }
    },
    [rebuild]
  );
  useMatrixEvent(client, 'RoomState.events', handleStateEvent);
  useMatrixEvent(client, 'AccountData', handleStateEvent);

  return packs;
}
