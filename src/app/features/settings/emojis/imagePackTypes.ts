import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import type { UntypedStateEventType } from '@/types/matrix';
import { roomStateMaybe } from '@/util/matrix';

export const ROOM_PACK_STABLE = 'm.room.image_pack';
export const ROOM_PACK_UNSTABLE = 'im.ponies.room_emotes';
export const EMOTE_ROOMS_STABLE = 'm.image_pack.rooms';
export const EMOTE_ROOMS_UNSTABLE = 'im.ponies.emote_rooms';

export const USER_PACK = 'im.ponies.user_emotes';

export const ROOM_PACK_TYPES = [ROOM_PACK_UNSTABLE, ROOM_PACK_STABLE] as const;
export const EMOTE_ROOMS_TYPES = [EMOTE_ROOMS_UNSTABLE, EMOTE_ROOMS_STABLE] as const;

export function getStateEventsForType(room: Room, eventType: string): MatrixEvent[] {
  const state = roomStateMaybe(room);
  if (!state) return [];
  const raw = state.getStateEvents(eventType as UntypedStateEventType);
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function isMeaningfulPackContent(content: Record<string, unknown> | undefined): boolean {
  if (!content || typeof content !== 'object') return false;
  const pack = content.pack;
  if (pack && typeof pack === 'object' && Object.keys(pack as Record<string, unknown>).length > 0) {
    return true;
  }
  const images = content.images;
  return !!images && typeof images === 'object';
}

export function readRoomPackEvents(room: Room): Map<string, MatrixEvent[]> {
  const byStateKey = new Map<string, MatrixEvent[]>();
  for (const type of ROOM_PACK_TYPES) {
    for (const ev of getStateEventsForType(room, type)) {
      const stateKey = ev.getStateKey();
      if (typeof stateKey !== 'string') continue;
      const list = byStateKey.get(stateKey);
      if (list) list.push(ev);
      else byStateKey.set(stateKey, [ev]);
    }
  }
  for (const [stateKey, events] of byStateKey) {
    const contents = events.map((ev) => ev.getContent() as Record<string, unknown>);
    if (!contents.some(isMeaningfulPackContent)) byStateKey.delete(stateKey);
  }
  return byStateKey;
}

export function readRoomPackEventsWithAncestors(
  room: Room,
  client: MatrixClient,
  visited: Set<string> = new Set([room.roomId]),
  depth = 1,
  maxDepth = 5
): Map<string, MatrixEvent[]> {
  const merged = readRoomPackEvents(room);
  if (depth > maxDepth) return merged;

  const parents = roomStateMaybe(room)?.events.get('m.space.parent');
  if (!parents) return merged;

  for (const [, ev] of parents) {
    const content = ev.getContent() as Record<string, unknown>;
    if (!content?.canonical) continue;

    const parentRoomId = ev.getStateKey();
    if (!parentRoomId || visited.has(parentRoomId)) continue;
    visited.add(parentRoomId);

    const parentRoom = client.getRoom(parentRoomId);
    if (!parentRoom) continue;

    const parentPacks = readRoomPackEventsWithAncestors(
      parentRoom,
      client,
      visited,
      depth + 1,
      maxDepth
    );
    for (const [stateKey, events] of parentPacks) {
      const existing = merged.get(stateKey);
      merged.set(stateKey, existing ? [...existing, ...events] : events);
    }
  }
  return merged;
}

export function getClientAccountData(
  client: MatrixClient,
  eventType: string
): MatrixEvent | undefined {
  return (
    client as unknown as { getAccountData(t: string): MatrixEvent | undefined }
  ).getAccountData(eventType);
}

export interface PackImage {
  url: string;
  usage?: string[];
  body?: string;
  mimetype?: string;
  info?: Record<string, unknown>;
}

export function mergePackImages(...contents: (Record<string, unknown> | undefined)[]): PackImage[] {
  const merged = new Map<string, PackImage>();
  for (const content of contents) {
    const images = content?.images as Record<string, PackImage> | undefined;
    if (!images || typeof images !== 'object') continue;
    for (const [shortcode, img] of Object.entries(images)) {
      if (!img?.url || merged.has(shortcode)) continue;
      merged.set(shortcode, img);
    }
  }
  return Array.from(merged.values());
}

export function parsePackInfo(content: Record<string, unknown> | undefined): {
  displayName?: string;
  usage?: string[];
  avatarUrl?: string;
  attribution?: string;
} {
  const pack = content?.pack as Record<string, unknown> | undefined;
  if (!pack) return {};
  return {
    displayName: typeof pack.display_name === 'string' ? pack.display_name : undefined,
    usage: Array.isArray(pack.usage) ? (pack.usage as string[]) : undefined,
    avatarUrl: typeof pack.avatar_url === 'string' ? pack.avatar_url : undefined,
    attribution: typeof pack.attribution === 'string' ? pack.attribution : undefined,
  };
}

export function mergePackInfo(...contents: (Record<string, unknown> | undefined)[]): {
  displayName?: string;
  usage?: string[];
  avatarUrl?: string;
  attribution?: string;
} {
  const merged: ReturnType<typeof parsePackInfo> = {};
  for (const content of contents) {
    const info = parsePackInfo(content);
    merged.displayName ??= info.displayName;
    merged.usage ??= info.usage;
    merged.avatarUrl ??= info.avatarUrl;
    merged.attribution ??= info.attribution;
  }
  return merged;
}

export function packImages(content: Record<string, unknown> | undefined): PackImage[] {
  return mergePackImages(content);
}

export function mergePackImageMap(
  ...contents: (Record<string, unknown> | undefined)[]
): Record<string, PackImage> {
  const merged: Record<string, PackImage> = {};
  for (const content of contents) {
    const images = content?.images as Record<string, PackImage> | undefined;
    if (!images || typeof images !== 'object') continue;
    for (const [shortcode, img] of Object.entries(images)) {
      if (!img?.url || shortcode in merged) continue;
      merged[shortcode] = img;
    }
  }
  return merged;
}

export function isMxcUrl(url: string): boolean {
  return url.startsWith('mxc://');
}
