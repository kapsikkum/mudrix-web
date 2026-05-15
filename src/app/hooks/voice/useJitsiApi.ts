import { useCallback } from 'react';
import type { SetStateAction } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import type { VoiceState } from '@/app/store/atoms';
import { getMemberDisplayName } from '@/util/matrix';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';
import type { VoiceRefs } from './types';
import { VOICE_STATE_TYPE } from './types';
import { sanitizeName } from './voiceHelpers';

export function useJitsiApi(
  client: MatrixClient | null,
  refs: Pick<
    VoiceRefs,
    | 'jitsiRef'
    | 'containerRef'
    | 'readyRef'
    | 'localJitsiIdRef'
    | 'jitsiIdToNameRef'
    | 'mutedIdsRef'
    | 'cameraOnIdsRef'
    | 'screensharingIdsRef'
    | 'voiceStateCacheRef'
  >,
  voiceStateKey: () => string,
  pushVoiceState: (roomId: string, updates: Record<string, unknown>) => void,
  refreshParticipants: (roomId: string) => void,
  setVoiceState: (updater: SetStateAction<VoiceState>) => void,
  leaveVoice: () => Promise<void>
) {
  const startJitsi = useCallback(
    (roomId: string, domain: string) => {
      const container = refs.containerRef.current;
      if (!container || !client) return;

      const room = client.getRoom(roomId);
      const roomName = room?.name ?? roomId;
      const confId = sanitizeName(roomName, roomId);
      const userId = client.getUserId() ?? '';
      const displayName = getMemberDisplayName(userId, client, roomId);

      refs.jitsiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName: confId,
        width: '100%',
        height: '100%',
        parentNode: container,
        userInfo: { displayName },
        configOverwrite: {
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          startWithVideoMuted: true,
          startWithAudioMuted: false,
          disableThirdPartyRequests: true,
          filmstripOnly: false,
          autoTileViewEnabled: true,
          startTileView: true,
          disableJoinLeaveSounds: true,
          disableDeepLinking: true,
          notifications: [],
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          TOOLBAR_BUTTONS: ['desktop', 'tileview'],
          SHOW_ON_HUD: ['desktop', 'tileview'],
          DEFAULT_BACKGROUND: '#1a1a1a',
        },
      });

      const api = refs.jitsiRef.current;

      api.on('videoConferenceJoined', (({ id }: { id: string }) => {
        refs.readyRef.current = true;
        refs.localJitsiIdRef.current = id;
        refs.jitsiIdToNameRef.current.set(id, displayName);
        refs.voiceStateCacheRef.current = {
          participating: true,
          joined_at: Date.now(),
          jitsi_id: id,
        };
        client
          .sendStateEvent(
            roomId,
            VOICE_STATE_TYPE as UntypedStateEventType,
            refs.voiceStateCacheRef.current as RawStateContent,
            voiceStateKey()
          )
          .catch(() => {});
        setVoiceState((prev) => ({ ...prev, ready: true }));
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('audioMuteStatusChanged', (({ muted }: { muted: boolean }) => {
        if (refs.localJitsiIdRef.current) {
          if (muted) refs.mutedIdsRef.current.add(refs.localJitsiIdRef.current);
          else refs.mutedIdsRef.current.delete(refs.localJitsiIdRef.current);
        }
        setVoiceState((prev) => ({ ...prev, isMuted: muted }));
        pushVoiceState(roomId, { muted });
        if (refs.readyRef.current) playVoiceSound(muted ? 'mute' : 'unmute');
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('videoMuteStatusChanged', (({ muted }: { muted: boolean }) => {
        if (refs.localJitsiIdRef.current) {
          if (muted) refs.cameraOnIdsRef.current.delete(refs.localJitsiIdRef.current);
          else refs.cameraOnIdsRef.current.add(refs.localJitsiIdRef.current);
        }
        setVoiceState((prev) => ({ ...prev, isVideoMuted: muted }));
        pushVoiceState(roomId, { video_muted: muted });
        if (refs.readyRef.current) playVoiceSound(muted ? 'camera-off' : 'camera-on');
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('dominantSpeakerChanged', (({ id }: { id: string }) => {
        const jitsiId = id === 'local' ? refs.localJitsiIdRef.current : id;
        setVoiceState((prev) => ({ ...prev, dominantSpeakerId: jitsiId }));
      }) as (...a: unknown[]) => void);

      api.on('connectionQualityUpdated', (({ quality }: { quality: number }) => {
        setVoiceState((prev) => ({ ...prev, connectionQuality: quality }));
      }) as (...a: unknown[]) => void);

      api.on('participantJoined', (({
        id,
        displayName: dn,
      }: {
        id: string;
        displayName: string;
      }) => {
        refs.jitsiIdToNameRef.current.set(id, dn ?? '');
        refreshParticipants(roomId);
        if (refs.readyRef.current) playVoiceSound('join');
      }) as (...a: unknown[]) => void);

      api.on('participantLeft', (({ id }: { id: string }) => {
        refs.jitsiIdToNameRef.current.delete(id);
        refs.mutedIdsRef.current.delete(id);
        refs.cameraOnIdsRef.current.delete(id);
        refs.screensharingIdsRef.current.delete(id);
        refreshParticipants(roomId);
        if (refs.readyRef.current) playVoiceSound('leave');
      }) as (...a: unknown[]) => void);

      api.on('screenSharingStatusChanged', (({
        on,
        details,
      }: {
        on: boolean;
        details?: { sourceType?: string };
      }) => {
        const localId = refs.localJitsiIdRef.current;
        if (localId) {
          if (on) refs.screensharingIdsRef.current.add(localId);
          else refs.screensharingIdsRef.current.delete(localId);
        }
        pushVoiceState(roomId, { screensharing: on });
        if (refs.readyRef.current) playVoiceSound(on ? 'screenshare-on' : 'screenshare-off');
        refreshParticipants(roomId);
        void details;
      }) as (...a: unknown[]) => void);

      api.on('participantAudioMuteStatusChanged', (({
        id,
        muted,
      }: {
        id: string;
        muted: boolean;
      }) => {
        if (muted) refs.mutedIdsRef.current.add(id);
        else refs.mutedIdsRef.current.delete(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('participantVideoMuteStatusChanged', (({
        id,
        muted,
      }: {
        id: string;
        muted: boolean;
      }) => {
        if (muted) refs.cameraOnIdsRef.current.delete(id);
        else refs.cameraOnIdsRef.current.add(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('participantScreenshareStatusChanged', (({ id, on }: { id: string; on: boolean }) => {
        if (on) refs.screensharingIdsRef.current.add(id);
        else refs.screensharingIdsRef.current.delete(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('readyToClose', (() => leaveVoice()) as (...a: unknown[]) => void);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, voiceStateKey, pushVoiceState, refreshParticipants, setVoiceState]
  );

  return { startJitsi };
}
