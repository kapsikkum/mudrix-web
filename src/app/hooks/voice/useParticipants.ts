import { useCallback } from 'react';
import type { SetStateAction } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { VoiceParticipant, VoiceState } from '@/app/store/atoms';
import { formatUserId, getMemberDisplayName } from '@/util/matrix';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import type { VoiceRefs } from './types';
import { VOICE_STATE_TYPE, HEARTBEAT_INTERVAL_MS, PARTICIPANT_TTL_MS } from './types';

export function useParticipants(
  client: MatrixClient | null,
  refs: Pick<
    VoiceRefs,
    | 'jitsiRef'
    | 'heartbeatIntervalRef'
    | 'refreshTimerRef'
    | 'mutedIdsRef'
    | 'cameraOnIdsRef'
    | 'screensharingIdsRef'
  >,
  voiceStateKey: () => string,
  setVoiceState: (updater: SetStateAction<VoiceState>) => void
) {
  const buildParticipants = useCallback(
    (roomId: string): VoiceParticipant[] => {
      if (!client) return [];
      const room = client.getRoom(roomId);
      if (!room) return [];

      let events = room.currentState.getStateEvents(VOICE_STATE_TYPE) ?? [];
      if (!Array.isArray(events)) events = [events];

      const byUser = new Map<
        string,
        { muted: boolean; videoMuted: boolean; screensharing: boolean; jitsiId: string | null }
      >();
      const matrixNames = new Set<string>();

      for (const ev of events) {
        const content = ev.getContent();
        const uid = ev.getSender() ?? '';
        if (!uid || !content?.participating) continue;

        // TTL check — treat participant as gone if their last heartbeat is too old
        const heartbeatTs: number | undefined = content.last_seen ?? content.joined_at;
        if (heartbeatTs && Date.now() - heartbeatTs > PARTICIPANT_TTL_MS) continue;

        const existing = byUser.get(uid);
        if (!existing) {
          byUser.set(uid, {
            muted: content.muted ?? false,
            videoMuted: content.video_muted ?? true,
            screensharing: content.screensharing ?? false,
            jitsiId: content.jitsi_id ?? null,
          });
        } else {
          byUser.set(uid, {
            muted: existing.muted || (content.muted ?? false),
            videoMuted:
              existing.videoMuted === false || content.video_muted === false ? false : true,
            screensharing: existing.screensharing || (content.screensharing ?? false),
            jitsiId: existing.jitsiId ?? content.jitsi_id ?? null,
          });
        }
      }

      const result: VoiceParticipant[] = [];
      for (const [uid, data] of byUser) {
        const member = room.getMember(uid);
        const name = member?.name ?? formatUserId(uid);
        matrixNames.add(name.toLowerCase());

        // Prefer live Jitsi AV state when available; fall back to Matrix state events
        const jid = data.jitsiId;
        const jitsiMuted = jid && refs.mutedIdsRef.current.has(jid) ? true : data.muted;
        const jitsiCamOff = jid && refs.cameraOnIdsRef.current.has(jid) ? false : data.videoMuted;
        const isScreensharing =
          jid && refs.screensharingIdsRef.current.has(jid) ? true : data.screensharing;

        result.push({
          userId: uid,
          name,
          mxcAvatar: member?.getMxcAvatarUrl?.() ?? null,
          jitsiId: jid,
          muted: jitsiMuted,
          videoMuted: jitsiCamOff,
          screensharing: isScreensharing,
          external: false,
        });
      }

      // Add external Jitsi-only participants (not joined via client)
      const seen = new Set<string>();
      for (const jp of refs.jitsiRef.current?.getParticipantsInfo() ?? []) {
        const dn = jp.displayName?.toLowerCase() ?? '';
        if (matrixNames.has(dn) || seen.has(dn)) continue;
        seen.add(dn);
        result.push({
          userId: null,
          name: jp.displayName ?? 'Guest',
          mxcAvatar: null,
          jitsiId: jp.id,
          muted: refs.mutedIdsRef.current.has(jp.id),
          videoMuted: !refs.cameraOnIdsRef.current.has(jp.id),
          screensharing: refs.screensharingIdsRef.current.has(jp.id),
          external: true,
        });
      }

      return result;
    },
    [client, refs]
  );

  // Debounced refresh — batches rapid consecutive updates
  const refreshParticipants = useCallback(
    (roomId: string) => {
      clearTimeout(refs.refreshTimerRef.current ?? undefined);
      refs.refreshTimerRef.current = setTimeout(() => {
        const participants = buildParticipants(roomId);
        setVoiceState((prev) => ({ ...prev, participants }));
      }, 100);
    },
    [buildParticipants, refs.refreshTimerRef, setVoiceState]
  );

  const startHeartbeat = useCallback(
    (
      roomId: string,
      pushVoiceState: (roomId: string, updates: Record<string, unknown>) => void
    ) => {
      if (refs.heartbeatIntervalRef.current) clearInterval(refs.heartbeatIntervalRef.current);

      refs.heartbeatIntervalRef.current = setInterval(() => {
        if (!client) return;

        // 1. Own heartbeat
        pushVoiceState(roomId, { last_seen: Date.now() });

        // 2. Jitsi reconciliation — only meaningful when inside the call
        const api = refs.jitsiRef.current;
        if (!api) return;

        const room = client.getRoom(roomId);
        if (!room) return;

        const jitsiNames = new Set<string>(
          api.getParticipantsInfo().map((p) => (p.displayName ?? '').toLowerCase())
        );

        let events = room.currentState.getStateEvents(VOICE_STATE_TYPE) ?? [];
        if (!Array.isArray(events)) events = [events];

        const myUserId = client.getUserId() ?? '';
        const myDeviceKey = voiceStateKey();
        const now = Date.now();

        for (const ev of events) {
          const content = ev.getContent();
          const senderUid = ev.getSender() ?? '';
          if (!senderUid || !content?.participating) continue;
          if (senderUid === myUserId) continue; // never evict ourselves here

          const heartbeatTs: number | undefined = content.last_seen ?? content.joined_at;
          const isStale = heartbeatTs ? now - heartbeatTs > PARTICIPANT_TTL_MS : false;

          const member = room.getMember(senderUid);
          const displayName = (
            member?.name ?? getMemberDisplayName(senderUid, client, roomId)
          ).toLowerCase();
          const absentFromJitsi = jitsiNames.size > 0 && !jitsiNames.has(displayName);

          if (isStale || absentFromJitsi) {
            const staleKey = ev.getStateKey() ?? myDeviceKey;
            client
              .sendStateEvent(
                roomId,
                VOICE_STATE_TYPE as UntypedStateEventType,
                { participating: false } as RawStateContent,
                staleKey
              )
              .then(() => refreshParticipants(roomId))
              .catch(() => {});
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [client, refs, voiceStateKey, refreshParticipants]
  );

  const stopHeartbeat = useCallback(() => {
    if (refs.heartbeatIntervalRef.current) {
      clearInterval(refs.heartbeatIntervalRef.current);
      refs.heartbeatIntervalRef.current = null;
    }
  }, [refs.heartbeatIntervalRef]);

  return { buildParticipants, refreshParticipants, startHeartbeat, stopHeartbeat };
}
