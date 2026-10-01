import { useState, useMemo, useCallback, createContext, useContext, createElement } from 'react';
import type { ReactNode } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { roomState } from '@/util/matrix';
import {
  EMOTE_ROOMS_STABLE,
  EMOTE_ROOMS_UNSTABLE,
  ROOM_PACK_TYPES,
  USER_PACK,
  getClientAccountData,
  readRoomPackEvents,
} from '@/app/features/settings/emojis/imagePackTypes';

export interface ImagePackImage {
  url: string;
  usage: string[];
  body?: string;
  mimetype?: string;
  info?: Record<string, unknown>;
  packName: string;
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

    for (const events of readRoomPackEvents(parentRoom).values()) extractPacks(events, existing);

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
      const rooms: Record<string, Record<string, unknown>> = {};
      for (const type of [EMOTE_ROOMS_UNSTABLE, EMOTE_ROOMS_STABLE]) {
        const ev = getClientAccountData(client, type);
        const content = ev?.getContent() as { rooms?: Record<string, Record<string, unknown>> };
        for (const [rid, stateKeys] of Object.entries(content?.rooms ?? {})) {
          if (!stateKeys || typeof stateKeys !== 'object') continue;
          rooms[rid] = { ...(rooms[rid] ?? {}), ...stateKeys };
        }
      }
      for (const [rid, stateKeys] of Object.entries(rooms)) {
        const r = client.getRoom(rid);
        if (!r) continue;
        for (const [sk, events] of readRoomPackEvents(r)) {
          if (sk in stateKeys) extractPacks(events, result);
        }
      }
    } catch {
      /* noop */
    }

    try {
      const userPackEvent = getClientAccountData(client, USER_PACK);
      if (userPackEvent) {
        extractPacks([userPackEvent], result);
      }
    } catch {
      /* noop */
    }

    for (const events of readRoomPackEvents(room).values()) extractPacks(events, result);

    const visited = new Set<string>([roomId]);
    extractSpacePacks(room, client, result, visited, 1);

    return result;
  }, [client, roomId, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);

  const handleStateEvent = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (
        et === ROOM_PACK_TYPES[0] ||
        et === ROOM_PACK_TYPES[1] ||
        et === USER_PACK ||
        et === EMOTE_ROOMS_UNSTABLE ||
        et === EMOTE_ROOMS_STABLE
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
