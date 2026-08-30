import { useState, useMemo, useCallback, createContext, useContext, createElement } from 'react';
import type { ReactNode } from 'react';
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
  info?: Record<string, unknown>;
  packName: string;
}

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';
const PONIES_USER_EMOTES = 'im.ponies.user_emotes';
const PONIES_EMOTE_ROOMS = 'im.ponies.emote_rooms';
const STD_IMAGE_PACK = 'm.room.image_pack';

function getStateEventsFromRoom(room: Room, eventType: string): MatrixEvent[] {
  const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
  if (!state) return [];
  const raw = state.getStateEvents(eventType);
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function extractPacks(events: MatrixEvent[], existing: Map<string, ImagePackImage>): void {
  for (const event of events) {
    const content = event.getContent() as Record<string, unknown>;
    const packLevel = content?.pack as Record<string, unknown> | undefined;
    const packUsage = Array.isArray(packLevel?.usage) ? (packLevel!.usage as string[]) : null;
    const packName =
      (packLevel?.display_name as string | undefined) || (event.getStateKey() ?? '') || '';

    const images = content?.images as
      | Record<
          string,
          {
            url: string;
            usage?: string[];
            body?: string;
            mimetype?: string;
            info?: Record<string, unknown>;
          }
        >
      | undefined;
    if (!images) continue;

    for (const [shortcode, img] of Object.entries(images)) {
      if (!img?.url || existing.has(shortcode)) continue;

      const imgUsageRaw = Array.isArray(img.usage) ? img.usage : null;
      const effectiveUsage =
        imgUsageRaw && imgUsageRaw.length > 0
          ? imgUsageRaw
          : packUsage && packUsage.length > 0
            ? packUsage
            : ['emoticon', 'sticker'];

      existing.set(shortcode, {
        url: img.url,
        usage: effectiveUsage,
        body: img.body,
        mimetype: img.mimetype,
        info: img.info,
        packName,
      });
    }
  }
}

function extractSpacePacks(
  room: Room,
  client: MatrixClient,
  existing: Map<string, ImagePackImage>,
  visited: Set<string>,
  depth: number,
  maxDepth = 5
): void {
  if (depth > maxDepth) return;

  const parentEvents = roomState(room).events.get('m.space.parent');
  if (!parentEvents) return;

  for (const [, ev] of parentEvents) {
    const content = ev.getContent() as Record<string, unknown>;
    if (!content?.canonical) continue;

    const parentRoomId = ev.getStateKey();
    if (!parentRoomId || visited.has(parentRoomId)) continue;
    visited.add(parentRoomId);

    const parentRoom = client.getRoom(parentRoomId);
    if (!parentRoom) continue;

    extractPacks(getStateEventsFromRoom(parentRoom, PONIES_ROOM_EMOTES), existing);
    const stdEvents = roomState(parentRoom).events.get(STD_IMAGE_PACK);
    if (stdEvents) extractPacks(Array.from(stdEvents.values()), existing);

    extractSpacePacks(parentRoom, client, existing, visited, depth + 1, maxDepth);
  }
}

export function useImagePacks(
  client: MatrixClient | null,
  roomId: string | null
): Map<string, ImagePackImage> {
  const [revision, setRevision] = useState(0);

  const packs = useMemo(() => {
    const result = new Map<string, ImagePackImage>();
    if (!client || !roomId) return result;
    const room = client.getRoom(roomId);
    if (!room) return result;

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
            const allPacks = getStateEventsFromRoom(r, PONIES_ROOM_EMOTES);
            const filtered = allPacks.filter((ev) => {
              const sk = ev.getStateKey();
              return typeof sk === 'string' && sk in stateKeys;
            });
            extractPacks(filtered, result);
            // Also query the stable m.room.image_pack event type
            const stdPacks = roomState(r).events.get(STD_IMAGE_PACK);
            if (stdPacks) {
              const filteredStd = Array.from(stdPacks.values()).filter((ev) => {
                const sk = ev.getStateKey();
                return typeof sk === 'string' && sk in stateKeys;
              });
              extractPacks(filteredStd, result);
            }
          }
        }
      }
    } catch {
      /* noop */
    }

    try {
      const userPackEvent = getClientAccountData(client, PONIES_USER_EMOTES);
      if (userPackEvent) {
        extractPacks([userPackEvent], result);
      }
    } catch {
      /* noop */
    }

    extractPacks(getStateEventsFromRoom(room, PONIES_ROOM_EMOTES), result);
    const stdPackEvents = roomState(room).events.get(STD_IMAGE_PACK);
    if (stdPackEvents) extractPacks(Array.from(stdPackEvents.values()), result);

    const visited = new Set<string>([roomId]);
    extractSpacePacks(room, client, result, visited, 1);

    return result;
  }, [client, roomId, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const handleStateEvent = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (
        et === PONIES_ROOM_EMOTES ||
        et === STD_IMAGE_PACK ||
        et === PONIES_USER_EMOTES ||
        et === PONIES_EMOTE_ROOMS
      ) {
        bump();
      }
    },
    [bump]
  );
  useMatrixEvent(client, 'RoomState.events', handleStateEvent);
  useMatrixEvent(client, 'accountData', handleStateEvent);

  return packs;
}

const ImagePacksContext = createContext<Map<string, ImagePackImage>>(new Map());

export function ImagePacksProvider({
  client,
  roomId,
  children,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  children: ReactNode;
}) {
  const packs = useImagePacks(client, roomId);
  return createElement(ImagePacksContext.Provider, { value: packs }, children);
}

export function useImagePacksContext(): Map<string, ImagePackImage> {
  return useContext(ImagePacksContext);
}
