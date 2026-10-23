import { useEffect, useMemo, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { elementCallEmbedAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { isDmRoom } from '@/util/matrix';
import { uniqueMembers, useElementCallMemberships } from './useElementCallMemberships';

// Matches the window in which useIncomingElementCall keeps an incoming call ringing.
export const RING_TIMEOUT_MS = 45_000;

export interface OutgoingCallState {
  /** In a DM call that nobody else has joined since we started it. */
  awaitingAnswer: boolean;
  /** awaitingAnswer, until the callee's ring would have timed out. */
  ringing: boolean;
}

export function useOutgoingCallState(client: MatrixClient | null): OutgoingCallState {
  const ui = useAtomValue(elementCallUiAtom);
  const embed = useAtomValue(elementCallEmbedAtom);

  const callRoomId = ui.roomId;
  const callRoom = callRoomId && client ? client.getRoom(callRoomId) : null;
  const isDmCall = !!client && !!callRoom && isDmRoom(callRoom, client);
  const watchedRoomIds = useMemo(
    () => (isDmCall && callRoomId ? [callRoomId] : []),
    [isDmCall, callRoomId]
  );
  const memberships = useElementCallMemberships(client, watchedRoomIds);
  const myId = client?.getUserId() ?? null;
  const remoteJoined =
    !!callRoomId && uniqueMembers(memberships.get(callRoomId) ?? []).some((m) => m.userId !== myId);

  // Once the other side has been seen in this call, a later "alone again" must not ring back.
  const remoteSeenRef = useRef<{ embed: unknown; seen: boolean }>({ embed: null, seen: false });
  if (remoteSeenRef.current.embed !== embed) remoteSeenRef.current = { embed, seen: false };
  if (remoteJoined) remoteSeenRef.current.seen = true;

  // Wait for the first memberships lookup so joining an already-running DM call never blips.
  const membershipsKnown = !!callRoomId && memberships.has(callRoomId);
  const awaitingAnswer = isDmCall && membershipsKnown && !remoteSeenRef.current.seen;

  const [expiredEmbed, setExpiredEmbed] = useState<unknown>(null);
  useEffect(() => {
    if (!awaitingAnswer || !embed) return undefined;
    const timer = window.setTimeout(() => setExpiredEmbed(embed), RING_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingAnswer, embed]);

  return { awaitingAnswer, ringing: awaitingAnswer && expiredEmbed !== embed };
}
