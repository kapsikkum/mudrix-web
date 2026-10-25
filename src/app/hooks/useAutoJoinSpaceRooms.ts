import { useCallback, useRef } from 'react';
import { EventType, type MatrixClient, type MatrixEvent, type Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { readSpaceAutoJoin } from '@/app/features/space/spaceAutoJoin';
import { useSyncReady } from '@/app/hooks/useSync';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { isActiveSpaceChild, roomStateMaybe } from '@/util/matrix';

const DONE_KEY_PREFIX = 'wz_autojoin_done::';
/** Rooms tried per pass and in parallel: a big space should not hammer the server. */
const MAX_PER_PASS = 300;
const PARALLEL = 3;
const HIERARCHY_DEPTH = 6;
const MAX_REMEMBERED = 5000;
/** Passes over a space: the server may not count us as a member for a moment after joining. */
const ATTEMPTS = 3;
const RETRY_DELAY_MS = 4000;
const TYPE_WAIT_TRIES = 20;
const SETTING_WAIT_TRIES = 12;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  const syncReady = useSyncReady();

  const stateRef = useRef({ syncReady });
  stateRef.current = { syncReady };
  const running = useRef(new Set<string>());

  const wantsAutoJoin = useCallback(
    (spaceId: string): boolean => !!client && readSpaceAutoJoin(client, spaceId),
    [client]
  );

  /** 'done': joined or never going to work; 'retry': might work a moment later. */
  const tryJoin = useCallback(
    async (mx: MatrixClient, roomId: string, via: string[]): Promise<'done' | 'retry'> => {
      if (mx.getRoom(roomId)?.getMyMembership() === 'join') return 'done';
      try {
        await mx.joinRoom(roomId, via.length > 0 ? { viaServers: via } : undefined);
        return 'done';
      } catch (err) {
        // Right after joining the space the server may not yet count us as a member (restricted
        // rooms), so a refusal is tried again before it is given up on.
        void err;
        return 'retry';
      }
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
        const via = [mx.getDomain() ?? ''].filter(Boolean);
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
          if (attempt > 0) await sleep(RETRY_DELAY_MS);
          const found: HierarchyRoom[] = [];
          let from: string | undefined;
          try {
            for (let page = 0; page < 20 && found.length < MAX_PER_PASS * 2; page++) {
              const res = await mx.getRoomHierarchy(spaceId, 100, HIERARCHY_DEPTH, false, from);
              found.push(...(res.rooms as HierarchyRoom[]).filter((r) => r.room_id !== spaceId));
              if (!res.next_batch) break;
              from = res.next_batch;
            }
          } catch {
            // not available yet (just joined) or rate limited: the next attempt tries again
            continue;
          }
          const todo = found.filter(
            (r) =>
              joinable(r) &&
              !done.has(r.room_id) &&
              mx.getRoom(r.room_id)?.getMyMembership() !== 'join'
          );
          if (todo.length === 0) break;
          const last = attempt === ATTEMPTS - 1;
          const settle = (roomId: string, outcome: 'done' | 'retry') => {
            // Only the last attempt gives up on a room for good.
            if (outcome === 'done' || last) done.add(roomId);
          };
          const spaces = todo.filter((r) => r.room_type === 'm.space');
          const rooms = todo.filter((r) => r.room_type !== 'm.space').slice(0, MAX_PER_PASS);
          for (const sp of spaces) {
            const outcome = await tryJoin(
              mx,
              sp.room_id,
              viaOf(mx, spaceId, sp.room_id).concat(via)
            );
            settle(sp.room_id, outcome);
          }
          const queue = [...rooms];
          await Promise.all(
            Array.from({ length: PARALLEL }, async () => {
              while (queue.length > 0) {
                const next = queue.shift()!;
                const outcome = await tryJoin(mx, next.room_id, via);
                settle(next.room_id, outcome);
              }
            })
          );
          saveDone(userId, done);
        }
      } finally {
        running.current.delete(spaceId);
      }
    },
    [tryJoin]
  );

  // Joining a space (not merely starting up with it): join what it holds. A space joined from
  // Explore can show up before its room type is known, so wait a little for it.
  useMatrixEvent(client, 'Room.myMembership', (room: Room, membership: string, prev?: string) => {
    if (!client || !stateRef.current.syncReady) return;
    if (membership !== 'join' || prev === 'join') return;
    void (async () => {
      for (let i = 0; i < TYPE_WAIT_TRIES && !room.isSpaceRoom(); i++) await sleep(500);
      if (!room.isSpaceRoom() || room.getMyMembership() !== 'join') return;
      // The space's own setting arrives with its state, which can be a moment behind the join.
      for (let i = 0; i < SETTING_WAIT_TRIES && !wantsAutoJoin(room.roomId); i++) await sleep(500);
      if (!wantsAutoJoin(room.roomId)) return;
      await joinAll(client, room.roomId);
    })();
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
