import { useCallback, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { EventType, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import {
  autoJoinSpaceRoomsAtom,
  roomListStyleAtom,
  roomListStyleBySpaceAtom,
} from '@/app/store/atoms/settings';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { isActiveSpaceChild, roomStateMaybe } from '@/util/matrix';

const DONE_KEY_PREFIX = 'wz_autojoin_done::';
/** Rooms tried per pass and in parallel: a big space should not hammer the server. */
const MAX_PER_PASS = 300;
const PARALLEL = 3;
const HIERARCHY_DEPTH = 6;
const MAX_REMEMBERED = 5000;

interface HierarchyRoom {
  room_id: string;
  room_type?: string;
  join_rule?: string | null;
}

function loadDone(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DONE_KEY_PREFIX + userId) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

function saveDone(userId: string, done: Set<string>): void {
  try {
    localStorage.setItem(
      DONE_KEY_PREFIX + userId,
      JSON.stringify([...done].slice(-MAX_REMEMBERED))
    );
  } catch {
    // remembering is best effort; the worst case is one more try at a room
  }
}

/**
 * Private (invite only) rooms are left alone. The server leaves the join rule out for some rooms,
 * so a missing one is tried: the join itself says no if it is not allowed.
 */
function joinable(room: HierarchyRoom): boolean {
  const rule = room.join_rule;
  return (
    rule === undefined ||
    rule === null ||
    rule === 'public' ||
    rule === 'restricted' ||
    rule === 'knock_restricted'
  );
}

function viaOf(client: MatrixClient, spaceId: string, roomId: string): string[] {
  const ev = roomStateMaybe(client.getRoom(spaceId))
    ?.getStateEvents(EventType.SpaceChild, roomId)
    ?.getContent() as { via?: string[] } | undefined;
  return Array.isArray(ev?.via) && ev.via.length > 0 ? ev.via : [];
}

/**
 * In the modern room list, only rooms you are in show up, so a space whose rooms you have not
 * joined looks empty. With the setting on, joining a space also joins its rooms, and rooms added to
 * it later. A room is tried once: leaving one is never undone, and a private one (invite only) is
 * left alone.
 */
export function useAutoJoinSpaceRooms(): void {
  const client = getMatrixClientOrNull();
  const enabled = useAtomValue(autoJoinSpaceRoomsAtom);
  const globalStyle = useAtomValue(roomListStyleAtom);
  const styleBySpace = useAtomValue(roomListStyleBySpaceAtom);
  const syncReady = useSyncReady();

  const stateRef = useRef({ enabled, globalStyle, styleBySpace, syncReady });
  stateRef.current = { enabled, globalStyle, styleBySpace, syncReady };
  const running = useRef(new Set<string>());

  const wantsAutoJoin = useCallback((spaceId: string): boolean => {
    const s = stateRef.current;
    return s.enabled && (s.styleBySpace[spaceId] ?? s.globalStyle) === 'modern';
  }, []);

  const tryJoin = useCallback(
    async (mx: MatrixClient, roomId: string, via: string[], done: Set<string>) => {
      const userId = mx.getUserId();
      if (!userId || done.has(roomId)) return;
      if (mx.getRoom(roomId)?.getMyMembership() === 'join') return;
      try {
        await mx.joinRoom(roomId, via.length > 0 ? { viaServers: via } : undefined);
        done.add(roomId);
      } catch (err) {
        const code = (err as { errcode?: string }).errcode;
        // Permanent: never going to work for this person, so don't try again at every start.
        if (code === 'M_FORBIDDEN' || code === 'M_NOT_FOUND') done.add(roomId);
      }
      saveDone(userId, done);
    },
    []
  );

  /** Joins what is in the space now: its categories first (rooms may be restricted to them). */
  const joinAll = useCallback(
    async (mx: MatrixClient, spaceId: string) => {
      const userId = mx.getUserId();
      if (!userId || running.current.has(spaceId)) return;
      running.current.add(spaceId);
      try {
        const done = loadDone(userId);
        const found: HierarchyRoom[] = [];
        let from: string | undefined;
        for (let page = 0; page < 20 && found.length < MAX_PER_PASS * 2; page++) {
          const res = await mx.getRoomHierarchy(spaceId, 100, HIERARCHY_DEPTH, false, from);
          found.push(...(res.rooms as HierarchyRoom[]).filter((r) => r.room_id !== spaceId));
          if (!res.next_batch) break;
          from = res.next_batch;
        }
        const todo = found.filter(
          (r) =>
            joinable(r) &&
            !done.has(r.room_id) &&
            mx.getRoom(r.room_id)?.getMyMembership() !== 'join'
        );
        const via = [mx.getDomain() ?? ''].filter(Boolean);
        const spaces = todo.filter((r) => r.room_type === 'm.space');
        const rooms = todo.filter((r) => r.room_type !== 'm.space').slice(0, MAX_PER_PASS);
        for (const sp of spaces) {
          await tryJoin(mx, sp.room_id, viaOf(mx, spaceId, sp.room_id).concat(via), done);
        }
        const queue = [...rooms];
        await Promise.all(
          Array.from({ length: PARALLEL }, async () => {
            while (queue.length > 0) {
              const next = queue.shift()!;

              await tryJoin(mx, next.room_id, via, done);
            }
          })
        );
      } catch {
        // the hierarchy can be unavailable or rate limited; the next space join or child event retries
      } finally {
        running.current.delete(spaceId);
      }
    },
    [tryJoin]
  );

  // Joining a space (not merely starting up with it): join what it holds.
  useMatrixEvent(client, 'Room.myMembership', (room: Room, membership: string, prev?: string) => {
    if (!client || !stateRef.current.syncReady) return;
    if (membership !== 'join' || prev === 'join' || !room.isSpaceRoom()) return;
    if (!wantsAutoJoin(room.roomId)) return;
    void joinAll(client, room.roomId);
  });

  // A room or category added to a space you are in, while you are using the app.
  useMatrixEvent(client, 'RoomState.events', (event: MatrixEvent) => {
    if (!client || !stateRef.current.syncReady) return;
    if (event.getType() !== EventType.SpaceChild || !isActiveSpaceChild(event)) return;
    const spaceId = event.getRoomId();
    const childId = event.getStateKey();
    if (!spaceId || !childId || event.getSender() === client.getUserId()) return;
    const space = client.getRoom(spaceId);
    if (!space?.isSpaceRoom() || space.getMyMembership() !== 'join' || !wantsAutoJoin(spaceId)) {
      return;
    }
    // Only fresh events: the same listener sees the whole space's state when it first loads.
    if (Date.now() - event.getTs() > 60_000) return;
    void joinAll(client, spaceId);
  });
}
