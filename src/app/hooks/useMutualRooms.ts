import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClientPrefix, Method, type MatrixClient } from 'matrix-js-sdk';
import { isDmRoom, isSpace } from '@/util/matrix';

export interface MutualRoom {
  roomId: string;
  name: string;
  avatarMxc: string | null;
}

export interface MutualRooms {
  rooms: MutualRoom[];
  spaces: MutualRoom[];
}

type MutualSource = 'server' | 'local';

interface MutualRoomIds {
  ids: string[];
  source: MutualSource;
}

/** Safety valve for the paginated endpoint. */
const MAX_PAGES = 20;

/** GET /_matrix/client/v3/user/mutual_rooms (Matrix spec v1.19), following next_batch_token. */
async function fetchStableMutualRooms(client: MatrixClient, userId: string): Promise<string[]> {
  const ids: string[] = [];
  let token: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: Record<string, string> = { user_id: userId };
    if (token) query.batch_token = token;
    const res = await client.http.authedRequest<{ joined?: unknown; next_batch_token?: string }>(
      Method.Get,
      '/user/mutual_rooms',
      query,
      undefined,
      { prefix: ClientPrefix.V3 }
    );
    if (Array.isArray(res.joined)) {
      for (const id of res.joined) if (typeof id === 'string') ids.push(id);
    }
    if (!res.next_batch_token) break;
    token = res.next_batch_token;
  }
  return ids;
}

/** Mutual rooms from the homeserver, or null when it offers no (working) lookup. */
async function fetchServerMutualRooms(
  client: MatrixClient,
  userId: string
): Promise<string[] | null> {
  if (await client.isVersionSupported('v1.19').catch(() => false)) {
    try {
      return await fetchStableMutualRooms(client, userId);
    } catch {
      // fall through to the unstable variants, then to local data
    }
  }
  try {
    // Feature-detects uk.half-shot.msc2666.{mutual_rooms,query_mutual_rooms} and throws without.
    return await client._unstable_getSharedRooms(userId);
  } catch {
    return null;
  }
}

/** Fallback: rooms we are in where the user is a joined member, from what the client has synced. */
function localMutualRooms(client: MatrixClient, userId: string): string[] {
  return client
    .getRooms()
    .filter(
      (room) => room.getMyMembership() === 'join' && room.getMember(userId)?.membership === 'join'
    )
    .map((room) => room.roomId);
}

async function resolveMutualRoomIds(client: MatrixClient, userId: string): Promise<MutualRoomIds> {
  const server = await fetchServerMutualRooms(client, userId);
  if (server) return { ids: server, source: 'server' };
  return { ids: localMutualRooms(client, userId), source: 'local' };
}

/**
 * Rooms and spaces we share with `userId`, DMs excluded. Uses the homeserver lookup when it
 * has one and falls back to the locally known membership otherwise.
 */
export function useMutualRooms(client: MatrixClient | null, userId: string | null, enabled = true) {
  const { data, isLoading } = useQuery<MutualRoomIds>({
    queryKey: ['mutual-rooms', client?.getUserId(), userId],
    queryFn: async () => {
      if (!client || !userId) return { ids: [], source: 'local' };
      return resolveMutualRoomIds(client, userId);
    },
    enabled: enabled && !!client && !!userId,
    staleTime: 5 * 60_000,
  });

  const result = useMemo<MutualRooms>(() => {
    const rooms: MutualRoom[] = [];
    const spaces: MutualRoom[] = [];
    if (!client || !data) return { rooms, spaces };
    const seen = new Set<string>();
    for (const id of data.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      const room = client.getRoom(id);
      if (!room || room.getMyMembership() !== 'join') continue;
      const entry: MutualRoom = {
        roomId: id,
        name: room.name || id,
        avatarMxc: room.getMxcAvatarUrl() ?? null,
      };
      if (isSpace(room)) spaces.push(entry);
      else if (!isDmRoom(room, client)) rooms.push(entry);
    }
    const byName = (a: MutualRoom, b: MutualRoom) => a.name.localeCompare(b.name);
    return { rooms: rooms.sort(byName), spaces: spaces.sort(byName) };
  }, [client, data]);

  return { ...result, source: data?.source ?? null, loading: isLoading };
}
