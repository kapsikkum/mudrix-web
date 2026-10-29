import { useMemo } from 'react';
import { useAtomValue } from 'jotai';
import { callUiAtom } from '@/app/store/atoms/call';
import type { VoiceParticipant } from '@/app/features/calls/types';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId } from '@/util/matrix';
import { useCallMemberships, uniqueMembers } from './useCallMemberships';
import { liveStateByUser, useCallSnapshot, type CallLiveState } from './stage/useCallSnapshot';

const NO_LIVE_STATE = new Map<string, CallLiveState>();

export { uniqueMembers };

/** Live state (muted, speaking, ...) of a room's call participants; only known while we are in it. */
export function useCallLiveState(roomId: string): Map<string, CallLiveState> {
  const snapshot = useCallSnapshot();
  return useMemo(
    () => (snapshot && snapshot.roomId === roomId ? liveStateByUser(snapshot) : NO_LIVE_STATE),
    [snapshot, roomId]
  );
}

/** True once we are connected, so the call stage has something to show. */
export function useCallTileVisible(): boolean {
  return useCallSnapshot()?.phase === 'joined';
}

export function useCallParticipants(roomId: string): VoiceParticipant[] {
  const client = getMatrixClientOrNull();
  const ui = useAtomValue(callUiAtom);
  const membershipsMap = useCallMemberships(client, [roomId]);
  const memberships = useMemo(() => membershipsMap.get(roomId) ?? [], [membershipsMap, roomId]);
  const liveState = useCallLiveState(roomId);
  const localInCall = ui.roomId === roomId;

  const participants = useMemo(() => {
    const room = client?.getRoom(roomId) ?? null;
    const myUserId = client?.getUserId();

    const result: VoiceParticipant[] = uniqueMembers(memberships).map((member) => {
      const userId = member.userId;
      const memberInfo = room?.getMember(userId) ?? null;
      const live = liveState.get(userId);
      const isLocal = userId === myUserId;

      return {
        userId,
        name: memberInfo?.name ?? formatUserId(userId),
        mxcAvatar: memberInfo?.getMxcAvatarUrl?.() ?? null,
        muted: localInCall ? (live ? live.muted : isLocal ? ui.isMuted : false) : false,
        deafened: localInCall && isLocal && ui.isDeafened,
        videoMuted: localInCall
          ? live
            ? live.videoMuted
            : isLocal
              ? ui.isVideoMuted
              : true
          : true,
        screensharing: localInCall ? (live?.screensharing ?? false) : false,
        speaking: localInCall ? (live?.speaking ?? false) : false,
      };
    });

    return result;
  }, [
    client,
    roomId,
    memberships,
    liveState,
    localInCall,
    ui.isMuted,
    ui.isDeafened,
    ui.isVideoMuted,
  ]);

  return participants;
}
