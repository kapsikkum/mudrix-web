import { useCallback, useEffect, useRef } from 'react';
import {
  EventType,
  MatrixError,
  safeGetRetryAfterMs,
  type MatrixClient,
  type MatrixEvent,
  type Room,
} from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { SPACE_AUTO_JOIN_STATE_TYPE, readSpaceAutoJoin } from '@/app/features/space/spaceAutoJoin';
import { SPACE_LIST_STYLE_STATE_TYPE } from '@/app/features/space/spaceListStyle';
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
/** Waits for a rate limit within one pass, before the rest is left for a later pass. */
const MAX_RATE_LIMIT_WAITS = 5;
const DEFAULT_RATE_LIMIT_MS = 5000;
const MAX_RATE_LIMIT_MS = 5 * 60_000;
/** Later passes after a network error or rate limit: 30s, 1m, 2m, ... up to 15m, then stop. */
const LATER_BASE_MS = 30_000;
const LATER_MAX_MS = 15 * 60_000;
const MAX_LATER_PASSES = 6;
/**
 * A space just joined can show up before its type or its settings are known. It is kept here for
 * a while and looked at again as its state arrives; past this, or past the cap, it is let go.
 */
const PENDING_MS = 16_000;
const MAX_PENDING = 100;
const SWEEP_MS = 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

interface HierarchyRoom {
  room_id: string;
  room_type?: string;
  join_rule?: string | null;
}

/**
 * 'done': joined. 'refused': the server said no for this room (it may say yes a moment later,
 * right after joining a space). 'later': rate limited or the server could not be reached; never
 * given up on, only put off.
 */
type JoinOutcome = 'done' | 'refused' | 'later';

/** Refusals about the room itself, which trying again will not change. */
const PERMANENT_ERRCODES = new Set([
  'M_FORBIDDEN',
  'M_NOT_FOUND',
  'M_UNSUPPORTED_ROOM_VERSION',
  'M_INCOMPATIBLE_ROOM_VERSION',
  'M_BAD_JSON',
  'M_NOT_JSON',
  'M_INVALID_PARAM',
  'M_UNRECOGNIZED',
  'M_BAD_STATE',
  'M_GUEST_ACCESS_FORBIDDEN',
]);

function isRateLimit(err: unknown): boolean {
  return (
    err instanceof MatrixError && (err.errcode === 'M_LIMIT_EXCEEDED' || err.httpStatus === 429)
  );
}

function rateLimitDelay(err: unknown): number {
  return Math.min(
    Math.max(safeGetRetryAfterMs(err, DEFAULT_RATE_LIMIT_MS), 500),
    MAX_RATE_LIMIT_MS
  );
}

/** Whether an error is the server refusing this room for good (not a limit, an outage or auth). */
function isPermanent(err: unknown): boolean {
  if (!(err instanceof MatrixError)) return false;
  if (err.errcode && PERMANENT_ERRCODES.has(err.errcode)) return true;
  const status = err.httpStatus ?? 0;
  // other 4xx are about the request; 401 (session), 408 (timeout) and 429 (limit) are not
  return status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429;
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

/** Whether the room's create event (and so whether it is a space) has arrived. */
function typeKnown(room: Room): boolean {
  return !!roomStateMaybe(room)?.getStateEvents(EventType.RoomCreate, '');
}

/**
 * In the modern room list, only rooms you are in show up, so a space whose rooms you have not
 * joined looks empty. With the setting on (the default for Modern spaces), joining a space also
 * joins its rooms, and rooms added to it later. A room is tried until it is joined or refused:
 * leaving one is never undone, and a private one (invite only) is left alone.
 */
export function useAutoJoinSpaceRooms(): void {
  const client = getMatrixClientOrNull();
  const syncReady = useSyncReady();

  const stateRef = useRef({ syncReady });
  stateRef.current = { syncReady };
  const running = useRef(new Set<string>());
  /** No join is sent before this time: one rate limit pauses every space's joins. */
  const pauseUntil = useRef(0);
  /** Later passes per space: how many so far, and the one timer waiting. */
  const later = useRef(new Map<string, { count: number; timer?: ReturnType<typeof setTimeout> }>());
  /** Spaces just joined whose type or settings are still on the way, with when to let them go. */
  const pending = useRef(new Map<string, number>());
  const sweepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timers = later.current;
    const waiting = pending.current;
    return () => {
      for (const entry of timers.values()) if (entry.timer) clearTimeout(entry.timer);
      timers.clear();
      if (sweepTimer.current !== null) clearTimeout(sweepTimer.current);
      sweepTimer.current = null;
      waiting.clear();
    };
  }, [client]);

  const wantsAutoJoin = useCallback(
    (spaceId: string): boolean => !!client && readSpaceAutoJoin(client, spaceId),
    [client]
  );

  const waitForPause = useCallback(async () => {
    for (let wait = pauseUntil.current - Date.now(); wait > 0; ) {
      await sleep(wait);
      wait = pauseUntil.current - Date.now();
    }
  }, []);

  /** Runs a request, waiting out rate limits a few times; anything else is thrown. */
  const withRateLimit = useCallback(
    async <T>(request: () => Promise<T>): Promise<T> => {
      for (let waits = 0; ; waits++) {
        await waitForPause();
        try {
          return await request();
        } catch (err) {
          if (!isRateLimit(err) || waits >= MAX_RATE_LIMIT_WAITS) throw err;
          pauseUntil.current = Math.max(pauseUntil.current, Date.now() + rateLimitDelay(err));
        }
      }
    },
    [waitForPause]
  );

  const tryJoin = useCallback(
    async (mx: MatrixClient, roomId: string, via: string[]): Promise<JoinOutcome> => {
      if (mx.getRoom(roomId)?.getMyMembership() === 'join') return 'done';
      try {
        await withRateLimit(() =>
          mx.joinRoom(roomId, via.length > 0 ? { viaServers: via } : undefined)
        );
        return 'done';
      } catch (err) {
        return isPermanent(err) ? 'refused' : 'later';
      }
    },
    [withRateLimit]
  );

  // `joinAll` and `scheduleLater` call each other; the ref breaks the cycle.
  const joinAllRef = useRef<(mx: MatrixClient, spaceId: string) => Promise<void>>(async () => {});

  /** Puts a space off after a rate limit or an outage, waiting longer each time. */
  const scheduleLater = useCallback((mx: MatrixClient, spaceId: string) => {
    const entry = later.current.get(spaceId) ?? { count: 0 };
    if (entry.timer || entry.count >= MAX_LATER_PASSES) return;
    const delay = Math.min(LATER_BASE_MS * 2 ** entry.count, LATER_MAX_MS);
    entry.count += 1;
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      const space = mx.getRoom(spaceId);
      if (space?.getMyMembership() !== 'join' || !readSpaceAutoJoin(mx, spaceId)) return;
      void joinAllRef.current(mx, spaceId);
    }, delay);
    later.current.set(spaceId, entry);
  }, []);

  /** Joins what is in the space now: its categories first (rooms may be restricted to them). */
  const joinAll = useCallback(
    async (mx: MatrixClient, spaceId: string) => {
      const userId = mx.getUserId();
      if (!userId || running.current.has(spaceId)) return;
      running.current.add(spaceId);
      let putOff = false;
      try {
        const done = loadDone(userId);
        const via = [mx.getDomain() ?? ''].filter(Boolean);
        let finished = false;
        for (let attempt = 0; attempt < ATTEMPTS && !putOff; attempt++) {
          if (attempt > 0) await sleep(RETRY_DELAY_MS);
          const found: HierarchyRoom[] = [];
          let from: string | undefined;
          try {
            for (let page = 0; page < 20 && found.length < MAX_PER_PASS * 2; page++) {
              const res = await withRateLimit(() =>
                mx.getRoomHierarchy(spaceId, 100, HIERARCHY_DEPTH, false, from)
              );
              found.push(...(res.rooms as HierarchyRoom[]).filter((r) => r.room_id !== spaceId));
              if (!res.next_batch) break;
              from = res.next_batch;
            }
          } catch (err) {
            // Just joined, the server may not show the space yet: the next attempt tries again.
            // A limit or an outage is left for a later pass.
            if (!isPermanent(err)) putOff = true;
            continue;
          }
          const todo = found.filter(
            (r) =>
              joinable(r) &&
              !done.has(r.room_id) &&
              mx.getRoom(r.room_id)?.getMyMembership() !== 'join'
          );
          if (todo.length === 0) {
            finished = true;
            break;
          }
          const last = attempt === ATTEMPTS - 1;
          const settle = (roomId: string, outcome: JoinOutcome) => {
            // A refusal is only final on the last attempt; a limit or an outage never is.
            if (outcome === 'done' || (outcome === 'refused' && last)) done.add(roomId);
            if (outcome === 'later') putOff = true;
          };
          const spaces = todo.filter((r) => r.room_type === 'm.space');
          const rooms = todo.filter((r) => r.room_type !== 'm.space').slice(0, MAX_PER_PASS);
          for (const sp of spaces) {
            if (putOff) break;
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
              // Once the server is out of reach or limiting us, the rest waits for a later pass.
              while (queue.length > 0 && !putOff) {
                const next = queue.shift()!;
                const outcome = await tryJoin(mx, next.room_id, via);
                settle(next.room_id, outcome);
              }
            })
          );
          saveDone(userId, done);
        }
        if (finished && !putOff) later.current.delete(spaceId);
      } finally {
        running.current.delete(spaceId);
      }
      if (putOff) scheduleLater(mx, spaceId);
    },
    [tryJoin, withRateLimit, scheduleLater]
  );
  joinAllRef.current = joinAll;

  /** Joins a just-joined space's rooms once it is known to be a space that wants it. */
  const consider = useCallback(
    (room: Room) => {
      if (!client) return;
      const roomId = room.roomId;
      const until = pending.current.get(roomId);
      if (until !== undefined && Date.now() > until) {
        pending.current.delete(roomId);
        return;
      }
      if (room.getMyMembership() !== 'join') {
        pending.current.delete(roomId);
        return;
      }
      if (typeKnown(room) && !room.isSpaceRoom()) {
        pending.current.delete(roomId);
        return;
      }
      if (room.isSpaceRoom() && wantsAutoJoin(roomId)) {
        pending.current.delete(roomId);
        void joinAll(client, roomId);
        return;
      }
      // Its type or its setting is still on the way: look again when that state arrives, or on
      // the next sweep.
      if (until === undefined) {
        const now = Date.now();
        for (const [id, at] of pending.current) if (now > at) pending.current.delete(id);
        if (pending.current.size >= MAX_PENDING) return;
        pending.current.set(roomId, now + PENDING_MS);
        startSweep();
      }
    },
    [client, wantsAutoJoin, joinAll]
  );
  const considerRef = useRef(consider);
  considerRef.current = consider;

  /**
   * One timer for every pending space, not one per room: the state of a room just joined does not
   * always come through as events, so the pending ones are looked at again every so often.
   */
  function startSweep() {
    if (sweepTimer.current !== null) return;
    sweepTimer.current = setTimeout(function sweep() {
      const mx = getMatrixClientOrNull();
      for (const id of [...pending.current.keys()]) {
        const room = mx?.getRoom(id);
        if (room) considerRef.current(room);
        else pending.current.delete(id);
      }
      sweepTimer.current = pending.current.size > 0 ? setTimeout(sweep, SWEEP_MS) : null;
    }, SWEEP_MS);
  }

  // Joining a space (not merely starting up with it): join what it holds.
  useMatrixEvent(client, 'Room.myMembership', (room: Room, membership: string, prev?: string) => {
    if (!client || !stateRef.current.syncReady) return;
    if (membership !== 'join' || prev === 'join') return;
    consider(room);
  });

  useMatrixEvent(client, 'RoomState.events', (event: MatrixEvent) => {
    if (!client || !stateRef.current.syncReady) return;
    const type = event.getType();
    const spaceId = event.getRoomId();

    // A space just joined whose type or setting has now arrived.
    if (
      spaceId &&
      pending.current.has(spaceId) &&
      (type === EventType.RoomCreate ||
        type === SPACE_AUTO_JOIN_STATE_TYPE ||
        type === SPACE_LIST_STYLE_STATE_TYPE)
    ) {
      const room = client.getRoom(spaceId);
      if (room) consider(room);
      return;
    }

    // A room or category added to a space you are in, while you are using the app.
    if (type !== EventType.SpaceChild || !isActiveSpaceChild(event)) return;
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
