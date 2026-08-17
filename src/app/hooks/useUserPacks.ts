import { useState, useCallback, useMemo } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { EventTimeline } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

const PONIES_ROOM_EMOTES = 'im.ponies.room_emotes';
const PONIES_USER_EMOTES = 'im.ponies.user_emotes';
const PONIES_EMOTE_ROOMS = 'im.ponies.emote_rooms';

const DEFAULT_USAGE: PackUsage[] = ['emoticon', 'sticker'];

type WritableAccountDataEventKey = Parameters<MatrixClient['setAccountData']>[0];

export type PackUsage = 'emoticon' | 'sticker';

export interface UserPackImage {
  url: string;
  usage: string[];
  body?: string;
  mimetype?: string;
  info?: Record<string, unknown>;
}

export interface UserPackData {
  displayName: string;
  usage: PackUsage[];
  images: Record<string, UserPackImage>;
}

export interface RoomPackSummary {
  roomId: string;
  stateKey: string;
  displayName: string;
  usage: PackUsage[];
  avatarMxc: string | undefined;
}

function getClientAccountData(client: MatrixClient, eventType: string): MatrixEvent | undefined {
  return (
    client as unknown as { getAccountData(t: string): MatrixEvent | undefined }
  ).getAccountData(eventType);
}

function getStateEventsFromRoom(room: Room, eventType: string): MatrixEvent[] {
  const state = room.getLiveTimeline().getState(EventTimeline.FORWARDS);
  if (!state) return [];
  const raw = state.getStateEvents(eventType);
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

function parseUsage(raw: unknown): PackUsage[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter((u): u is PackUsage => u === 'emoticon' || u === 'sticker');
  }
  return DEFAULT_USAGE;
}

function parsePackImages(content: Record<string, unknown>): Record<string, UserPackImage> {
  const imagesRaw = content.images as Record<string, unknown> | undefined;
  if (!imagesRaw) return {};
  const images: Record<string, UserPackImage> = {};
  for (const [shortcode, imgRaw] of Object.entries(imagesRaw)) {
    const img = imgRaw as Record<string, unknown>;
    if (img && typeof img.url === 'string') {
      images[shortcode] = {
        url: img.url,
        usage: parseUsage(img.usage),
        body: typeof img.body === 'string' ? img.body : undefined,
        mimetype: typeof img.mimetype === 'string' ? img.mimetype : undefined,
        info:
          img.info && typeof img.info === 'object'
            ? (img.info as Record<string, unknown>)
            : undefined,
      };
    }
  }
  return images;
}

function readUserPack(client: MatrixClient): UserPackData | null {
  const event = getClientAccountData(client, PONIES_USER_EMOTES);
  if (!event) return null;
  const content = event.getContent() as Record<string, unknown>;
  const pack = content.pack as Record<string, unknown> | undefined;
  const displayName =
    typeof pack?.display_name === 'string' && pack.display_name.length > 0
      ? pack.display_name
      : 'personal';
  const usage = pack ? parseUsage(pack.usage) : DEFAULT_USAGE;
  return { displayName, usage, images: parsePackImages(content) };
}

function readFavoritePacks(client: MatrixClient): RoomPackSummary[] {
  const event = getClientAccountData(client, PONIES_EMOTE_ROOMS);
  if (!event) return [];
  const content = event.getContent() as { rooms?: Record<string, Record<string, unknown>> };
  const rooms = content?.rooms;
  if (!rooms) return [];

  const result: RoomPackSummary[] = [];
  for (const [roomId, stateKeys] of Object.entries(rooms)) {
    const room = client.getRoom(roomId);
    if (!room) continue;
    const allPacks = getStateEventsFromRoom(room, PONIES_ROOM_EMOTES as string);
    const filtered = allPacks.filter((ev) => {
      const sk = ev.getStateKey();
      return typeof sk === 'string' && sk in stateKeys;
    });
    for (const ev of filtered) {
      const stateKey = ev.getStateKey();
      if (typeof stateKey !== 'string') continue;
      const packContent = ev.getContent() as Record<string, unknown>;
      const pack = packContent.pack as Record<string, unknown> | undefined;
      const displayName =
        typeof pack?.display_name === 'string' && pack.display_name.length > 0
          ? pack.display_name
          : stateKey;
      const usage = pack ? parseUsage(pack.usage) : DEFAULT_USAGE;
      const images = parsePackImages(packContent);
      const firstImage = Object.values(images)[0];
      result.push({
        roomId,
        stateKey,
        displayName,
        usage,
        avatarMxc: firstImage?.url,
      });
    }
  }
  return result.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function useUserPack(client: MatrixClient | null): UserPackData | null {
  const [revision, setRevision] = useState(0);
  const packs = useMemo(() => (client ? readUserPack(client) : null), [client, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() === PONIES_USER_EMOTES) bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);

  return packs;
}

export function useFavoritePacks(client: MatrixClient | null): RoomPackSummary[] {
  const [revision, setRevision] = useState(0);
  const packs = useMemo(() => (client ? readFavoritePacks(client) : []), [client, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() === PONIES_EMOTE_ROOMS) bump();
    },
    [bump]
  );
  const handleRoomState = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() === PONIES_ROOM_EMOTES) bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);
  useMatrixEvent(client, 'RoomState.events', handleRoomState);

  return packs;
}

export function useStickerPacks(client: MatrixClient | null): StickerPackGroup[] {
  const [revision, setRevision] = useState(0);
  const packs = useMemo(() => (client ? getStickerPacks(client) : []), [client, revision]);

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === PONIES_USER_EMOTES || et === PONIES_EMOTE_ROOMS) bump();
    },
    [bump]
  );
  const handleRoomState = useCallback(
    (event: MatrixEvent) => {
      if (event.getType() === PONIES_ROOM_EMOTES) bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);
  useMatrixEvent(client, 'RoomState.events', handleRoomState);

  return packs;
}

export async function saveUserPack(client: MatrixClient, pack: UserPackData): Promise<void> {
  const imageContent: Record<string, Partial<UserPackImage> & { url: string }> = {};
  for (const [shortcode, img] of Object.entries(pack.images)) {
    imageContent[shortcode] = {
      url: img.url,
      usage: pack.usage.length > 0 ? pack.usage : undefined,
      body: img.body ?? shortcode,
      mimetype: img.mimetype,
    };
  }
  await client.setAccountData(PONIES_USER_EMOTES as WritableAccountDataEventKey, {
    pack: { display_name: pack.displayName, usage: pack.usage },
    images: imageContent,
  });
}

export async function saveFavoritePacks(
  client: MatrixClient,
  favorites: RoomPackSummary[]
): Promise<void> {
  const rooms: Record<string, Record<string, unknown>> = {};
  for (const fav of favorites) {
    const roomToState = rooms[fav.roomId] ?? {};
    roomToState[fav.stateKey] = {};
    rooms[fav.roomId] = roomToState;
  }
  await client.setAccountData(PONIES_EMOTE_ROOMS as WritableAccountDataEventKey, { rooms });
}

export function getAllRoomsPacks(client: MatrixClient): RoomPackSummary[] {
  const result: RoomPackSummary[] = [];
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    const allPacks = getStateEventsFromRoom(room, PONIES_ROOM_EMOTES as string);
    for (const ev of allPacks) {
      const stateKey = ev.getStateKey();
      if (typeof stateKey !== 'string') continue;
      const packContent = ev.getContent() as Record<string, unknown>;
      const pack = packContent.pack as Record<string, unknown> | undefined;
      const displayName =
        typeof pack?.display_name === 'string' && pack.display_name.length > 0
          ? pack.display_name
          : stateKey;
      const usage = pack ? parseUsage(pack.usage) : DEFAULT_USAGE;
      const images = parsePackImages(packContent);
      const firstImage = Object.values(images)[0];
      result.push({
        roomId: room.roomId,
        stateKey,
        displayName,
        usage,
        avatarMxc: firstImage?.url,
      });
    }
  }
  return result;
}

export interface StickerPackGroup {
  packName: string;
  stickers: {
    shortcode: string;
    url: string;
    body?: string;
    mimetype?: string;
    info?: Record<string, unknown>;
  }[];
}

export function getStickerPacks(client: MatrixClient): StickerPackGroup[] {
  const groups = new Map<
    string,
    Map<string, { url: string; body?: string; mimetype?: string; info?: Record<string, unknown> }>
  >();
  const addImages = (
    packName: string,
    packUsage: PackUsage[],
    images: Record<string, UserPackImage>
  ) => {
    const list = groups.get(packName) ?? new Map();
    for (const [shortcode, img] of Object.entries(images)) {
      if (!img.url) continue;
      const effectiveUsage = img.usage.length > 0 ? img.usage : packUsage;
      if (!effectiveUsage.includes('sticker')) continue;
      if (list.has(shortcode)) continue;
      list.set(shortcode, {
        url: img.url,
        body: img.body,
        mimetype: img.mimetype,
        info: img.info,
      });
    }
    groups.set(packName, list);
  };

  const userPack = readUserPack(client);
  if (userPack) {
    addImages(userPack.displayName, userPack.usage, userPack.images);
  }

  const favoritePacks = readFavoritePacks(client);
  for (const fav of favoritePacks) {
    const room = client.getRoom(fav.roomId);
    if (!room) continue;
    const packEvents = getStateEventsFromRoom(room, PONIES_ROOM_EMOTES as string).filter(
      (ev) => ev.getStateKey() === fav.stateKey
    );
    for (const ev of packEvents) {
      const packContent = ev.getContent() as Record<string, unknown>;
      const pack = packContent.pack as Record<string, unknown> | undefined;
      const usage = pack ? parseUsage(pack.usage) : DEFAULT_USAGE;
      const images = parsePackImages(packContent);
      addImages(fav.displayName, usage, images);
    }
  }

  return Array.from(groups.entries())
    .map(([packName, stickerMap]) => ({
      packName,
      stickers: Array.from(stickerMap.entries())
        .map(([shortcode, s]) => ({ shortcode, ...s }))
        .sort((a, b) => a.shortcode.localeCompare(b.shortcode)),
    }))
    .sort((a, b) => a.packName.localeCompare(b.packName))
    .filter((g) => g.stickers.length > 0);
}
