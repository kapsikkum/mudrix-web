import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAtomValue } from 'jotai';
import { ThreadEvent } from 'matrix-js-sdk';
import type { MatrixClient, Thread } from 'matrix-js-sdk';
import { threadLastSeenAtom } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useThrottle } from '@/app/hooks/useThrottle';
import { isThreadUnread } from '@/util/threads';

const MAX_THREADS = 50;
/** How many of the most recently active rooms get their thread list fetched from the server. */
const FETCH_ROOMS = 25;
const FETCH_CONCURRENCY = 3;
const fetchedRooms = new Set<string>();

export interface InboxThread {
  thread: Thread;
  unread: boolean;
  ts: number;
}

export interface UseThreadsInboxResult {
  threads: InboxThread[];
  unreadCount: number;
}

/**
 * Threads you take part in, across every joined room, newest activity first. Only threads the
 * client has already loaded are listed (those from sync and from rooms you have opened).
 */
export function useThreadsInbox(
  client: MatrixClient | null,
  enabled: boolean
): UseThreadsInboxResult {
  const lastSeen = useAtomValue(threadLastSeenAtom);
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((n) => n + 1), []);
  const throttledBump = useThrottle(bump, 400);

  const threads = useMemo((): InboxThread[] => {
    void revision;
    if (!enabled || !client) return [];
    const out: InboxThread[] = [];
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join' || room.isSpaceRoom()) continue;
      for (const thread of room.getThreads()) {
        if (!thread.hasCurrentUserParticipated || !thread.rootEvent) continue;
        out.push({
          thread,
          unread: isThreadUnread(thread, lastSeen),
          ts: thread.lastReply()?.getTs() ?? thread.rootEvent.getTs(),
        });
      }
    }
    return out.sort((a, b) => b.ts - a.ts).slice(0, MAX_THREADS);
  }, [client, enabled, lastSeen, revision]);

  // Threads only exist locally for rooms that have been opened, so the busiest rooms are asked
  // for theirs once, the first time the list is shown.
  useEffect(() => {
    if (!enabled || !client) return undefined;
    let cancelled = false;
    const rooms = client
      .getRooms()
      .filter(
        (room) =>
          room.getMyMembership() === 'join' && !room.isSpaceRoom() && !fetchedRooms.has(room.roomId)
      )
      .sort((a, b) => (b.getLastLiveEvent()?.getTs() ?? 0) - (a.getLastLiveEvent()?.getTs() ?? 0))
      .slice(0, FETCH_ROOMS);
    const queue = [...rooms];
    const worker = async () => {
      for (let room = queue.shift(); room && !cancelled; room = queue.shift()) {
        fetchedRooms.add(room.roomId);
        try {
          await room.createThreadsTimelineSets();
          await room.fetchRoomThreads();
        } catch {
          // A room that cannot list its threads simply contributes none.
        }
        if (!cancelled) setRevision((n) => n + 1);
      }
    };
    for (let i = 0; i < FETCH_CONCURRENCY; i += 1) void worker();
    return () => {
      cancelled = true;
    };
  }, [client, enabled]);

  useMatrixEvent(client, ThreadEvent.New, throttledBump);
  useMatrixEvent(client, ThreadEvent.Update, throttledBump);
  useMatrixEvent(client, ThreadEvent.NewReply, throttledBump);
  useMatrixEvent(client, 'Room.timeline', throttledBump);

  return { threads, unreadCount: threads.filter((t) => t.unread).length };
}
