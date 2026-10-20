import { useState, useCallback, useEffect, useMemo } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import {
  EMOTE_ROOMS_STABLE,
  EMOTE_ROOMS_UNSTABLE,
  ROOM_PACK_TYPES,
  USER_PACK,
  getClientAccountData,
  mergePackImageMap,
  mergePackInfo,
  parsePackInfo,
  readRoomPackEvents,
  type PackImage,
} from '@/app/features/settings/emojis/imagePackTypes';
import { packTimer } from '@/util/packDebug';
import { sameContent, withRateLimitRetry } from '@/app/features/room/roomsettings/packContent';

const DEFAULT_USAGE: PackUsage[] = ['emoticon', 'sticker'];

type WritableAccountDataEventKey = Parameters<MatrixClient['setAccountData']>[0];

export type PackUsage =
  | 'emoticon'
  | 'sticker'
  | 'profile_decoration'
  | 'avatar_frame'
  | 'profile_effect';

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
  attribution?: string;
}

/**
 * Pack lists are derived from room state across every joined room, which is expensive with many
 * large packs. All derived lists are memoised per client and invalidated by a generation counter
 * that only moves when pack-related state actually changes, so the several hooks that mount
 * together (decorations, effects, favourites, stickers) share one computation per change instead
 * of each re-reading every pack on every render.
 */
interface PackTracker {
  gen: number;
  cache: Map<string, { gen: number; value: unknown }>;
  /** Subscriptions just chosen in the UI, shown until the account-data echo catches up. */
  optimistic: RoomPackSummary[] | null;
  optimisticTimer: ReturnType<typeof setTimeout> | null;
}

const packChangeListeners = new Set<() => void>();

/** Lets hooks re-render when the optimistic subscription list changes (no server event yet). */
function useOptimisticPackRevision(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const cb = () => setRev((n) => n + 1);
    packChangeListeners.add(cb);
    return () => {
      packChangeListeners.delete(cb);
    };
  }, []);
  return rev;
}

const subscriptionKey = (roomId: string, stateKey: string) => roomId + '/' + stateKey;

const packTrackers = new WeakMap<MatrixClient, PackTracker>();

const SUBSCRIPTION_TYPES = new Set<string>([
  ...ROOM_PACK_TYPES,
  EMOTE_ROOMS_STABLE,
  EMOTE_ROOMS_UNSTABLE,
  USER_PACK,
  'm.space.parent',
]);

const SUBSCRIPTION_ACCOUNT_TYPES = new Set<string>([EMOTE_ROOMS_STABLE, EMOTE_ROOMS_UNSTABLE]);

function clearOptimistic(tracker: PackTracker): void {
  if (!tracker.optimistic) return;
  tracker.optimistic = null;
  if (tracker.optimisticTimer) clearTimeout(tracker.optimisticTimer);
  tracker.optimisticTimer = null;
  tracker.gen += 1;
  packChangeListeners.forEach((cb) => cb());
}

function readRawSubscriptions(client: MatrixClient): Record<string, Record<string, unknown>> {
  return mergeSubscriptionRooms(
    getClientAccountData(client, EMOTE_ROOMS_UNSTABLE)?.getContent() as
      | Record<string, unknown>
      | undefined,
    getClientAccountData(client, EMOTE_ROOMS_STABLE)?.getContent() as
      | Record<string, unknown>
      | undefined
  );
}

function getPackTracker(client: MatrixClient): PackTracker {
  let tracker = packTrackers.get(client);
  if (tracker) return tracker;
  const created: PackTracker = {
    gen: 0,
    cache: new Map(),
    optimistic: null,
    optimisticTimer: null,
  };
  tracker = created;
  packTrackers.set(client, created);
  const bump = (ev?: MatrixEvent) => {
    if (ev && typeof ev.getType === 'function' && !SUBSCRIPTION_TYPES.has(ev.getType())) return;
    created.gen += 1;
    if (created.optimistic && ev && SUBSCRIPTION_ACCOUNT_TYPES.has(ev.getType())) {
      const server = new Set<string>();
      for (const [roomId, keys] of Object.entries(readRawSubscriptions(client))) {
        for (const sk of Object.keys(keys)) server.add(subscriptionKey(roomId, sk));
      }
      const wanted = created.optimistic.map((f) => subscriptionKey(f.roomId, f.stateKey));
      // Echo caught up: the server state lists every pack we asked for and nothing else.
      if (server.size === wanted.length && wanted.every((k) => server.has(k))) {
        clearOptimistic(created);
      }
    }
  };
  const emitter = client as unknown as {
    on(event: string, cb: (...args: never[]) => void): void;
  };
  emitter.on('RoomState.events', bump);
  emitter.on('accountData', bump);
  emitter.on('Room.myMembership', () => bump());
  emitter.on('deleteRoom', () => bump());
  return created;
}

function memoByGeneration<T>(client: MatrixClient, key: string, compute: () => T): T {
  const tracker = getPackTracker(client);
  const hit = tracker.cache.get(key);
  if (hit && hit.gen === tracker.gen) return hit.value as T;
  const done = packTimer(`derive ${key}`);
  const value = compute();
  done();
  tracker.cache.set(key, { gen: tracker.gen, value });
  return value;
}

function firstImageUrl(contents: Record<string, unknown>[]): string | undefined {
  for (const content of contents) {
    const images = content?.images as Record<string, PackImage> | undefined;
    if (!images || typeof images !== 'object') continue;
    for (const img of Object.values(images)) {
      if (img?.url) return img.url;
    }
  }
  return undefined;
}

function summarizeRoomPack(
  roomId: string,
  stateKey: string,
  events: MatrixEvent[]
): RoomPackSummary | null {
  const contents = events.map((ev) => ev.getContent() as Record<string, unknown>);
  const info = mergePackInfo(...contents);
  return {
    roomId,
    stateKey,
    displayName: info.displayName || stateKey,
    usage: info.usage && info.usage.length > 0 ? parseUsage(info.usage) : DEFAULT_USAGE,
    avatarMxc: info.avatarUrl || firstImageUrl(contents),
    attribution: info.attribution,
  };
}

function summarizeRoomPacks(client: MatrixClient, roomId: string): RoomPackSummary[] {
  const room = client.getRoom(roomId);
  if (!room) return [];
  const result: RoomPackSummary[] = [];
  for (const [stateKey, events] of readRoomPackEvents(room)) {
    const summary = summarizeRoomPack(roomId, stateKey, events);
    if (summary) result.push(summary);
  }
  return result;
}

/** Pack classification used to keep avatar decorations, profile effects and emoji/stickers apart. */
export type PackKind = 'decoration' | 'effect' | 'emoji';

export function packKindOf(usage: readonly string[]): PackKind {
  if (usage.includes('profile_effect')) return 'effect';
  if (usage.includes('profile_decoration') || usage.includes('avatar_frame')) return 'decoration';
  return 'emoji';
}

/** `undefined` when the image sets no usage of its own (it then inherits the pack's). */
function parseImageUsage(raw: unknown): PackUsage[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const parsed = parseUsage(raw);
  return parsed.length > 0 ? parsed : undefined;
}

function parseUsage(raw: unknown): PackUsage[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter(
      (u): u is PackUsage =>
        u === 'emoticon' ||
        u === 'sticker' ||
        u === 'profile_decoration' ||
        u === 'avatar_frame' ||
        u === 'profile_effect'
    );
  }
  return DEFAULT_USAGE;
}

function parsePackImages(
  content: Record<string, unknown>,
  packUsage: PackUsage[]
): Record<string, UserPackImage> {
  const imagesRaw = content.images as Record<string, unknown> | undefined;
  if (!imagesRaw) return {};
  const images: Record<string, UserPackImage> = {};
  for (const [shortcode, imgRaw] of Object.entries(imagesRaw)) {
    const img = imgRaw as Record<string, unknown>;
    if (img && typeof img.url === 'string') {
      images[shortcode] = {
        url: img.url,
        usage: parseImageUsage(img.usage) ?? packUsage,
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
  return memoByGeneration(client, 'userPack', () => readUserPackUncached(client));
}

function readUserPackUncached(client: MatrixClient): UserPackData | null {
  const event = getClientAccountData(client, USER_PACK);
  if (!event) return null;
  const content = event.getContent() as Record<string, unknown>;
  const info = parsePackInfo(content);
  const displayName =
    info.displayName && info.displayName.length > 0 ? info.displayName : 'personal';
  const usage = info.usage ? parseUsage(info.usage) : DEFAULT_USAGE;
  return { displayName, usage, images: parsePackImages(content, usage) };
}

function mergeSubscriptionRooms(
  ...contents: (Record<string, unknown> | undefined)[]
): Record<string, Record<string, unknown>> {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const content of contents) {
    const rooms = content?.rooms as Record<string, Record<string, unknown>> | undefined;
    if (!rooms) continue;
    for (const [roomId, stateKeys] of Object.entries(rooms)) {
      if (!stateKeys || typeof stateKeys !== 'object') continue;
      const existing = merged[roomId] ?? {};
      merged[roomId] = { ...existing, ...stateKeys };
    }
  }
  return merged;
}

function readFavoritePacks(client: MatrixClient): RoomPackSummary[] {
  return memoByGeneration(client, 'favorites', () => readFavoritePacksUncached(client));
}

function readFavoritePacksUncached(client: MatrixClient): RoomPackSummary[] {
  const optimistic = getPackTracker(client).optimistic;
  if (optimistic) {
    return [...optimistic].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  const subUnstable = getClientAccountData(client, EMOTE_ROOMS_UNSTABLE);
  const subStable = getClientAccountData(client, EMOTE_ROOMS_STABLE);
  const rooms = mergeSubscriptionRooms(
    subUnstable?.getContent() as Record<string, unknown> | undefined,
    subStable?.getContent() as Record<string, unknown> | undefined
  );
  if (Object.keys(rooms).length === 0) return [];

  const result: RoomPackSummary[] = [];
  for (const [roomId, stateKeys] of Object.entries(rooms)) {
    const room = client.getRoom(roomId);
    if (!room) continue;
    const byStateKey = readRoomPackEvents(room);
    for (const [sk] of Object.entries(stateKeys)) {
      const events = byStateKey.get(sk);
      if (!events || events.length === 0) continue;
      const summary = summarizeRoomPack(roomId, sk, events);
      if (summary) result.push(summary);
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
      if (event.getType() === USER_PACK) bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);

  return packs;
}

export function useFavoritePacks(client: MatrixClient | null): RoomPackSummary[] {
  const [revision, setRevision] = useState(0);
  const optimisticRevision = useOptimisticPackRevision();
  const packs = useMemo(
    () => (client ? readFavoritePacks(client) : []),
    [client, revision, optimisticRevision]
  );

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === EMOTE_ROOMS_UNSTABLE || et === EMOTE_ROOMS_STABLE) bump();
    },
    [bump]
  );
  const handleRoomState = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === ROOM_PACK_TYPES[0] || et === ROOM_PACK_TYPES[1]) bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);
  useMatrixEvent(client, 'RoomState.events', handleRoomState);

  return packs;
}

export function useStickerPacks(client: MatrixClient | null): StickerPackGroup[] {
  const [revision, setRevision] = useState(0);
  const optimisticRevision = useOptimisticPackRevision();
  const packs = useMemo(
    () => (client ? getStickerPacks(client) : []),
    [client, revision, optimisticRevision]
  );

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === USER_PACK || et === EMOTE_ROOMS_UNSTABLE || et === EMOTE_ROOMS_STABLE) bump();
    },
    [bump]
  );
  const handleRoomState = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === ROOM_PACK_TYPES[0] || et === ROOM_PACK_TYPES[1] || et === 'm.space.parent') bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);
  useMatrixEvent(client, 'RoomState.events', handleRoomState);

  return packs;
}

export async function saveUserPack(client: MatrixClient, pack: UserPackData): Promise<void> {
  const done = packTimer('save user pack');
  const sameUsage = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((u) => b.includes(u));
  const imageContent: Record<string, Record<string, unknown>> = {};
  for (const [shortcode, img] of Object.entries(pack.images)) {
    const entry: Record<string, unknown> = { url: img.url };
    // Absent usage means "inherit the pack's" (MSC2545), so only differing usage is stored.
    if (img.usage && img.usage.length > 0 && !sameUsage(img.usage, pack.usage)) {
      entry.usage = img.usage;
    }
    entry.body = img.body ?? shortcode;
    if (img.mimetype) entry.mimetype = img.mimetype;
    if (img.info && Object.keys(img.info).length > 0) entry.info = img.info;
    imageContent[shortcode] = entry;
  }
  const content = {
    pack: { display_name: pack.displayName, usage: pack.usage },
    images: imageContent,
  };
  const existing = getClientAccountData(client, USER_PACK)?.getContent();
  if (existing && sameContent(existing, content)) {
    done({ skipped: true });
    return;
  }
  await withRateLimitRetry(() =>
    client.setAccountData(USER_PACK as WritableAccountDataEventKey, content)
  );
  done({ images: Object.keys(imageContent).length });
}

interface FavoriteQueue {
  running: boolean;
  latest: RoomPackSummary[] | null;
  waiters: { resolve: () => void; reject: (err: unknown) => void }[];
}

const favoriteQueues = new WeakMap<MatrixClient, FavoriteQueue>();

type SubscriptionRooms = Record<string, Record<string, unknown>>;

async function writeFavoritePacks(
  client: MatrixClient,
  favorites: RoomPackSummary[]
): Promise<void> {
  const rooms: SubscriptionRooms = {};
  // Subscriptions to rooms this client does not know (left, not yet synced) cannot be listed in
  // the UI; keep them rather than silently dropping them on every save.
  const existingMerged = mergeSubscriptionRooms(
    getClientAccountData(client, EMOTE_ROOMS_UNSTABLE)?.getContent() as
      | Record<string, unknown>
      | undefined,
    getClientAccountData(client, EMOTE_ROOMS_STABLE)?.getContent() as
      | Record<string, unknown>
      | undefined
  );
  for (const [roomId, keys] of Object.entries(existingMerged)) {
    if (!client.getRoom(roomId)) rooms[roomId] = keys;
  }
  for (const fav of favorites) {
    const roomToState = rooms[fav.roomId] ?? {};
    roomToState[fav.stateKey] = {};
    rooms[fav.roomId] = roomToState;
  }
  const writes = [EMOTE_ROOMS_UNSTABLE, EMOTE_ROOMS_STABLE].filter((type) => {
    const current = (getClientAccountData(client, type)?.getContent() ?? {}) as Record<
      string,
      unknown
    >;
    return !sameContent(current.rooms ?? {}, rooms);
  });
  await Promise.all(
    writes.map((type) =>
      withRateLimitRetry(() =>
        client.setAccountData(type as WritableAccountDataEventKey, { rooms })
      )
    )
  );
}

async function drainFavoriteQueue(client: MatrixClient, queue: FavoriteQueue): Promise<void> {
  queue.running = true;
  try {
    while (queue.latest) {
      const favorites = queue.latest;
      const waiters = queue.waiters;
      queue.latest = null;
      queue.waiters = [];
      try {
        await writeFavoritePacks(client, favorites);
        waiters.forEach((w) => w.resolve());
      } catch (err) {
        if (!queue.latest) clearOptimistic(getPackTracker(client));
        waiters.forEach((w) => w.reject(err));
      }
    }
  } finally {
    queue.running = false;
  }
}

/**
 * Subscribes to exactly `favorites`. Calls are serialised and coalesced: while a write is in
 * flight only the most recent request is kept, so rapid toggling in the picker produces at most
 * one write per round trip and can never land out of order. Unchanged state is not re-sent.
 */
export function saveFavoritePacks(
  client: MatrixClient,
  favorites: RoomPackSummary[]
): Promise<void> {
  let queue = favoriteQueues.get(client);
  if (!queue) {
    queue = { running: false, latest: null, waiters: [] };
    favoriteQueues.set(client, queue);
  }
  const q = queue;
  q.latest = favorites;
  const tracker = getPackTracker(client);
  tracker.optimistic = favorites;
  tracker.gen += 1;
  if (tracker.optimisticTimer) clearTimeout(tracker.optimisticTimer);
  // Safety net: never keep showing a local guess for long if the echo never matches.
  tracker.optimisticTimer = setTimeout(() => clearOptimistic(tracker), 15_000);
  packChangeListeners.forEach((cb) => cb());
  return new Promise<void>((resolve, reject) => {
    q.waiters.push({ resolve, reject });
    if (!q.running) void drainFavoriteQueue(client, q);
  });
}

export function getAllRoomsPacks(client: MatrixClient): RoomPackSummary[] {
  return memoByGeneration(client, 'allRooms', () => getAllRoomsPacksUncached(client));
}

function getAllRoomsPacksUncached(client: MatrixClient): RoomPackSummary[] {
  const result: RoomPackSummary[] = [];
  for (const room of client.getRooms()) {
    if (room.getMyMembership() !== 'join') continue;
    result.push(...summarizeRoomPacks(client, room.roomId));
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
  return memoByGeneration(client, 'stickers', () => getStickerPacksUncached(client));
}

function getStickerPacksUncached(client: MatrixClient): StickerPackGroup[] {
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
    const events = readRoomPackEvents(room).get(fav.stateKey);
    if (!events) continue;
    const images: Record<string, UserPackImage> = {};
    for (const [shortcode, img] of Object.entries(
      mergePackImageMap(...events.map((ev) => ev.getContent() as Record<string, unknown>))
    )) {
      images[shortcode] = {
        url: img.url,
        usage: parseImageUsage(img.usage) ?? fav.usage,
        body: img.body,
        mimetype: img.mimetype,
        info: img.info,
      };
    }
    addImages(fav.displayName, fav.usage, images);
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

export interface DecorationPackImage {
  id: string; // mxc://...
  shortcode: string;
  name: string;
  category: string;
  url: string;
  isCustom?: boolean;
}

export interface DecorationPackGroup {
  packName: string;
  category: string;
  decorations: DecorationPackImage[];
}

export function getDecorationPacks(client: MatrixClient): DecorationPackGroup[] {
  return memoByGeneration(client, 'decorations', () => getDecorationPacksUncached(client));
}

function getDecorationPacksUncached(client: MatrixClient): DecorationPackGroup[] {
  const groups: DecorationPackGroup[] = [];

  // 1. User personal pack decorations
  const userPack = readUserPack(client);
  if (userPack) {
    const userDecos: DecorationPackImage[] = [];
    for (const [shortcode, img] of Object.entries(userPack.images)) {
      if (!img.url) continue;
      const effectiveUsage = img.usage && img.usage.length > 0 ? img.usage : userPack.usage;
      if (
        effectiveUsage.includes('profile_decoration') ||
        effectiveUsage.includes('avatar_frame')
      ) {
        userDecos.push({
          id: img.url,
          shortcode,
          name: img.body || shortcode,
          category: 'My Uploads',
          url: img.url,
          isCustom: true,
        });
      }
    }
    if (userDecos.length > 0) {
      groups.push({
        packName: 'My Uploads',
        category: 'My Uploads',
        decorations: userDecos,
      });
    }
  }

  // 2. Subscribed favorite packs + room packs with decoration usage
  const favoritePacks = readFavoritePacks(client);
  const seenPacks = new Set<string>();

  const processPack = (
    roomId: string,
    stateKey: string,
    displayName: string,
    usage: PackUsage[]
  ) => {
    const packKey = `${roomId}/${stateKey}`;
    if (seenPacks.has(packKey)) return;
    seenPacks.add(packKey);

    const room = client.getRoom(roomId);
    if (!room) return;
    const events = readRoomPackEvents(room).get(stateKey);
    if (!events) return;

    const mergedImages = mergePackImageMap(
      ...events.map((ev) => ev.getContent() as Record<string, unknown>)
    );
    const items: DecorationPackImage[] = [];
    for (const [shortcode, img] of Object.entries(mergedImages)) {
      if (!img.url) continue;
      const effectiveUsage = parseImageUsage(img.usage) ?? usage;
      if (
        effectiveUsage.includes('profile_decoration') ||
        effectiveUsage.includes('avatar_frame')
      ) {
        items.push({
          id: img.url,
          shortcode,
          name: img.body || shortcode,
          category: displayName,
          url: img.url,
          isCustom: false,
        });
      }
    }

    if (items.length > 0) {
      groups.push({
        packName: displayName,
        category: displayName,
        decorations: items,
      });
    }
  };

  // Only packs the user subscribed to (Select Packs) are offered; unsubscribed room packs must
  // not leak into the picker.
  for (const fav of favoritePacks) {
    processPack(fav.roomId, fav.stateKey, fav.displayName, fav.usage);
  }

  return groups;
}

export function useDecorationPacks(client: MatrixClient | null): DecorationPackGroup[] {
  const [revision, setRevision] = useState(0);
  const optimisticRevision = useOptimisticPackRevision();
  const packs = useMemo(
    () => (client ? getDecorationPacks(client) : []),
    [client, revision, optimisticRevision]
  );

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === USER_PACK || et === EMOTE_ROOMS_UNSTABLE || et === EMOTE_ROOMS_STABLE) bump();
    },
    [bump]
  );
  const handleRoomState = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === ROOM_PACK_TYPES[0] || et === ROOM_PACK_TYPES[1] || et === 'm.space.parent') bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);
  useMatrixEvent(client, 'RoomState.events', handleRoomState);

  return packs;
}

export async function uploadUserDecoration(
  client: MatrixClient,
  file: File
): Promise<{ url: string; shortcode: string; name: string }> {
  const mimetype = file.type || 'image/png';
  const { content_uri: url } = await client.uploadContent(file, {
    name: file.name,
    type: mimetype,
  });
  const current = readUserPack(client) ?? {
    displayName: 'personal',
    usage: DEFAULT_USAGE,
    images: {},
  };
  const baseCode =
    file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'decoration';
  let shortcode = baseCode;
  let counter = 1;
  while (current.images[shortcode]) {
    shortcode = `${baseCode}_${counter++}`;
  }
  const name = file.name.replace(/\.[^.]+$/, '');
  const updatedImages = {
    ...current.images,
    [shortcode]: {
      url,
      usage: ['profile_decoration' as PackUsage],
      body: name,
      mimetype: file.type || 'image/png',
    },
  };
  await saveUserPack(client, {
    ...current,
    images: updatedImages,
  });
  return { url, shortcode, name };
}

export async function deleteUserDecoration(
  client: MatrixClient,
  urlOrShortcode: string
): Promise<void> {
  const current = readUserPack(client);
  if (!current) return;
  const newImages = { ...current.images };
  for (const [shortcode, img] of Object.entries(newImages)) {
    if (img.url === urlOrShortcode || shortcode === urlOrShortcode) {
      delete newImages[shortcode];
    }
  }
  await saveUserPack(client, { ...current, images: newImages });
}

export interface EffectPackImage {
  id: string; // mxc://...
  shortcode: string;
  name: string;
  category: string;
  url: string;
  isCustom?: boolean;
}

export interface EffectPackGroup {
  packName: string;
  category: string;
  effects: EffectPackImage[];
}

export function getEffectPacks(client: MatrixClient): EffectPackGroup[] {
  return memoByGeneration(client, 'effects', () => getEffectPacksUncached(client));
}

function getEffectPacksUncached(client: MatrixClient): EffectPackGroup[] {
  const groups: EffectPackGroup[] = [];

  // 1. User personal pack effects
  const userPack = readUserPack(client);
  if (userPack) {
    const userEffects: EffectPackImage[] = [];
    for (const [shortcode, img] of Object.entries(userPack.images)) {
      if (!img.url) continue;
      const effectiveUsage = img.usage && img.usage.length > 0 ? img.usage : userPack.usage;
      if (effectiveUsage.includes('profile_effect')) {
        userEffects.push({
          id: img.url,
          shortcode,
          name: img.body || shortcode,
          category: 'My Uploads',
          url: img.url,
          isCustom: true,
        });
      }
    }
    if (userEffects.length > 0) {
      groups.push({
        packName: 'My Uploads',
        category: 'My Uploads',
        effects: userEffects,
      });
    }
  }

  // 2. Subscribed favorite packs + room packs with effect usage
  const favoritePacks = readFavoritePacks(client);
  const seenPacks = new Set<string>();

  const processPack = (
    roomId: string,
    stateKey: string,
    displayName: string,
    usage: PackUsage[]
  ) => {
    const packKey = `${roomId}/${stateKey}`;
    if (seenPacks.has(packKey)) return;
    seenPacks.add(packKey);

    const room = client.getRoom(roomId);
    if (!room) return;
    const events = readRoomPackEvents(room).get(stateKey);
    if (!events) return;

    const mergedImages = mergePackImageMap(
      ...events.map((ev) => ev.getContent() as Record<string, unknown>)
    );
    const items: EffectPackImage[] = [];

    for (const [shortcode, img] of Object.entries(mergedImages)) {
      if (!img.url) continue;
      const effectiveUsage = parseImageUsage(img.usage) ?? usage;
      if (effectiveUsage.includes('profile_effect')) {
        items.push({
          id: img.url,
          shortcode,
          name: img.body || shortcode,
          category: displayName,
          url: img.url,
          isCustom: false,
        });
      }
    }

    if (items.length > 0) {
      groups.push({
        packName: displayName,
        category: displayName,
        effects: items,
      });
    }
  };

  for (const fav of favoritePacks) {
    processPack(fav.roomId, fav.stateKey, fav.displayName, fav.usage);
  }

  return groups;
}

export function useEffectPacks(client: MatrixClient | null): EffectPackGroup[] {
  const [revision, setRevision] = useState(0);
  const optimisticRevision = useOptimisticPackRevision();
  const packs = useMemo(
    () => (client ? getEffectPacks(client) : []),
    [client, revision, optimisticRevision]
  );

  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const handleAccountData = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === USER_PACK || et === EMOTE_ROOMS_UNSTABLE || et === EMOTE_ROOMS_STABLE) bump();
    },
    [bump]
  );
  const handleRoomState = useCallback(
    (event: MatrixEvent) => {
      const et = event.getType();
      if (et === ROOM_PACK_TYPES[0] || et === ROOM_PACK_TYPES[1] || et === 'm.space.parent') bump();
    },
    [bump]
  );
  useMatrixEvent(client, 'accountData', handleAccountData);
  useMatrixEvent(client, 'RoomState.events', handleRoomState);

  return packs;
}

export async function uploadUserEffect(
  client: MatrixClient,
  file: File
): Promise<{ url: string; shortcode: string; name: string }> {
  const mimetype = file.type || 'image/png';
  const { content_uri: url } = await client.uploadContent(file, {
    name: file.name,
    type: mimetype,
  });
  const current = readUserPack(client) ?? {
    displayName: 'personal',
    usage: DEFAULT_USAGE,
    images: {},
  };
  const baseCode =
    file.name
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || 'effect';
  let shortcode = baseCode;
  let counter = 1;
  while (current.images[shortcode]) {
    shortcode = `${baseCode}_${counter++}`;
  }
  const name = file.name.replace(/\.[^.]+$/, '');
  const updatedImages = {
    ...current.images,
    [shortcode]: {
      url,
      usage: ['profile_effect' as PackUsage],
      body: name,
      mimetype,
    },
  };
  await saveUserPack(client, {
    ...current,
    images: updatedImages,
  });
  return { url, shortcode, name };
}

export async function deleteUserEffect(
  client: MatrixClient,
  urlOrShortcode: string
): Promise<void> {
  const current = readUserPack(client);
  if (!current) return;
  const newImages = { ...current.images };
  for (const [shortcode, img] of Object.entries(newImages)) {
    if (img.url === urlOrShortcode || shortcode === urlOrShortcode) {
      delete newImages[shortcode];
    }
  }
  await saveUserPack(client, { ...current, images: newImages });
}

export interface PackImageRef {
  name: string;
  packName: string;
}

/**
 * Finds a pack image by its mxc URL across every joined room (subscribed or not). Used to keep a
 * selected decoration/effect visible after its pack was unsubscribed. The index is only built on
 * first use and rebuilt when pack state changes.
 */
export function lookupPackImage(client: MatrixClient, mxc: string): PackImageRef | null {
  const index = memoByGeneration(client, 'imageIndex', () => {
    const map = new Map<string, PackImageRef>();
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      for (const [stateKey, events] of readRoomPackEvents(room)) {
        const contents = events.map((ev) => ev.getContent() as Record<string, unknown>);
        const packName = mergePackInfo(...contents).displayName || stateKey;
        for (const [shortcode, img] of Object.entries(mergePackImageMap(...contents))) {
          if (img.url && !map.has(img.url)) {
            map.set(img.url, { name: img.body || shortcode, packName });
          }
        }
      }
    }
    return map;
  });
  return index.get(mxc) ?? null;
}
