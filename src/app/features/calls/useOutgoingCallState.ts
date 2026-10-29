import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { callSessionAtom, callUiAtom } from '@/app/store/atoms/call';
import { isDmRoom } from '@/util/matrix';
import { uniqueMembers, useCallMemberships } from './useCallMemberships';

// Matches the window in which useIncomingCall keeps an incoming call ringing.
export const RING_TIMEOUT_MS = 45_000;

export interface OutgoingCallState {
  /** In a DM call that nobody else has joined since we started it. */
  awaitingAnswer: boolean;
  /** awaitingAnswer, until the callee's ring would have timed out. */
  ringing: boolean;
}

export function useOutgoingCallState(client: MatrixClient | null): OutgoingCallState {
  const ui = useAtomValue(callUiAtom);
  const session = useAtomValue(callSessionAtom);

  const callRoomId = ui.roomId;
  const callRoom = callRoomId && client ? client.getRoom(callRoomId) : null;
  const isDmCall = !!client && !!callRoom && isDmRoom(callRoom, client);
  const watchedRoomIds = useMemo(
    () => (isDmCall && callRoomId ? [callRoomId] : []),
    [isDmCall, callRoomId]
  );
  const memberships = useCallMemberships(client, watchedRoomIds);
  const myId = client?.getUserId() ?? null;
  const remoteJoined =
    !!callRoomId && uniqueMembers(memberships.get(callRoomId) ?? []).some((m) => m.userId !== myId);

  // Once the other side has been seen in this call, a later "alone again" must not ring back.
  const remoteSeenRef = useRef<{ session: unknown; seen: boolean }>({
    session: null,
    seen: false,
  });
  if (remoteSeenRef.current.session !== session) remoteSeenRef.current = { session, seen: false };
  if (remoteJoined) remoteSeenRef.current.seen = true;

  // Wait for the first memberships lookup so joining an already-running DM call never blips.
  const membershipsKnown = !!callRoomId && memberships.has(callRoomId);
  const awaitingAnswer = isDmCall && membershipsKnown && !remoteSeenRef.current.seen;

  const [expiredSession, setExpiredSession] = useState<unknown>(null);
  useEffect(() => {
    if (!awaitingAnswer || !session) return undefined;
    const timer = window.setTimeout(() => setExpiredSession(session), RING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingAnswer, session]);

  return { awaitingAnswer, ringing: awaitingAnswer && expiredSession !== session };
}
