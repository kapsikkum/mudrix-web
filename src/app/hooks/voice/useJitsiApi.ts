import { useCallback } from 'react';
import type { SetStateAction } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import type { VoiceState } from '@/app/store/atoms';
import { getMemberDisplayName } from '@/util/matrix';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';
import { THEME_TOKENS } from '@/theme/themeTokens';
import { STORAGE_KEY_THEME } from '@/const/storageKeys';
import type { VoiceRefs } from './types';
import { VOICE_STATE_TYPE } from './types';
import { sanitizeName } from './voiceHelpers';

function getJitsiTheme() {
  const raw = localStorage.getItem(STORAGE_KEY_THEME) ?? '"Carbon"';
  let themeName: string;
  try {
    themeName = JSON.parse(raw);
  } catch {
    themeName = raw;
  }
  const t = THEME_TOKENS[themeName] ?? THEME_TOKENS.Carbon;
  return { background: t.color.bgPrimary };
}

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
      const {
        containerRef,
        jitsiRef,
        readyRef,
        localJitsiIdRef,
        jitsiIdToNameRef,
        mutedIdsRef,
        cameraOnIdsRef,
        screensharingIdsRef,
        voiceStateCacheRef,
      } = refs;

      const container = containerRef.current;
      if (!container || !client) return;

      const room = client.getRoom(roomId);
      const roomName = room?.name ?? roomId;
      const confId = sanitizeName(roomName, roomId);
      const userId = client.getUserId() ?? '';
      const displayName = getMemberDisplayName(userId, client, roomId);
      const jitsiTheme = getJitsiTheme();

      jitsiRef.current = new window.JitsiMeetExternalAPI(domain, {
        roomName: confId,
        width: '100%',
        height: '100%',
        parentNode: container,
        userInfo: { displayName },
        configOverwrite: {
          prejoinConfig: { enabled: false },
          startWithVideoMuted: true,
          startWithAudioMuted: false,
          disableThirdPartyRequests: true,
          disabledSounds: ['PARTICIPANT_JOINED_SOUND', 'PARTICIPANT_LEFT_SOUND'],
          deeplinking: { disabled: true },
          notifications: [],
          hideConferenceSubject: true,
          hideConferenceTimer: true,
          disableSelfViewSettings: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: ['desktop', 'tileview'],
          SHOW_ON_HUD: ['desktop', 'tileview'],
          DEFAULT_BACKGROUND: jitsiTheme.background,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
      });

      const api = jitsiRef.current;

      api.on('videoConferenceJoined', (({ id }: { id: string }) => {
        readyRef.current = true;
        localJitsiIdRef.current = id;
        jitsiIdToNameRef.current.set(id, displayName);
        voiceStateCacheRef.current = {
          participating: true,
          joined_at: Date.now(),
          jitsi_id: id,
        };
        client
          .sendStateEvent(
            roomId,
            VOICE_STATE_TYPE as UntypedStateEventType,
            voiceStateCacheRef.current as RawStateContent,
            voiceStateKey()
          )
          .catch(() => {});
        setVoiceState((prev) => ({ ...prev, ready: true }));
        refreshParticipants(roomId);
        api.executeCommand('toggleTileView');
      }) as (...a: unknown[]) => void);

      api.on('audioMuteStatusChanged', (({ muted }: { muted: boolean }) => {
        if (localJitsiIdRef.current) {
          if (muted) mutedIdsRef.current.add(localJitsiIdRef.current);
          else mutedIdsRef.current.delete(localJitsiIdRef.current);
        }
        setVoiceState((prev) => ({ ...prev, isMuted: muted }));
        pushVoiceState(roomId, { muted });
        if (readyRef.current) playVoiceSound(muted ? 'mute' : 'unmute');
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('videoMuteStatusChanged', (({ muted }: { muted: boolean }) => {
        if (localJitsiIdRef.current) {
          if (muted) cameraOnIdsRef.current.delete(localJitsiIdRef.current);
          else cameraOnIdsRef.current.add(localJitsiIdRef.current);
        }
        setVoiceState((prev) => ({ ...prev, isVideoMuted: muted }));
        pushVoiceState(roomId, { video_muted: muted });
        if (readyRef.current) playVoiceSound(muted ? 'camera-off' : 'camera-on');
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('dominantSpeakerChanged', (({ id }: { id: string }) => {
        const jitsiId = id === 'local' ? localJitsiIdRef.current : id;
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
        jitsiIdToNameRef.current.set(id, dn ?? '');
        refreshParticipants(roomId);
        if (readyRef.current) playVoiceSound('join');
      }) as (...a: unknown[]) => void);

      api.on('participantLeft', (({ id }: { id: string }) => {
        jitsiIdToNameRef.current.delete(id);
        mutedIdsRef.current.delete(id);
        cameraOnIdsRef.current.delete(id);
        screensharingIdsRef.current.delete(id);
        refreshParticipants(roomId);
        if (readyRef.current) playVoiceSound('leave');
      }) as (...a: unknown[]) => void);

      api.on('screenSharingStatusChanged', (({
        on,
        details,
      }: {
        on: boolean;
        details?: { sourceType?: string };
      }) => {
        const localId = localJitsiIdRef.current;
        if (localId) {
          if (on) screensharingIdsRef.current.add(localId);
          else screensharingIdsRef.current.delete(localId);
        }
        pushVoiceState(roomId, { screensharing: on });
        if (readyRef.current) playVoiceSound(on ? 'screenshare-on' : 'screenshare-off');
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
        if (muted) mutedIdsRef.current.add(id);
        else mutedIdsRef.current.delete(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('participantVideoMuteStatusChanged', (({
        id,
        muted,
      }: {
        id: string;
        muted: boolean;
      }) => {
        if (muted) cameraOnIdsRef.current.delete(id);
        else cameraOnIdsRef.current.add(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('participantScreenshareStatusChanged', (({ id, on }: { id: string; on: boolean }) => {
        if (on) screensharingIdsRef.current.add(id);
        else screensharingIdsRef.current.delete(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('_requestDesktopSources', ((
        request: {
          options: { types: string[]; thumbnailSize?: { width: number; height: number } };
        },
        callback: (result: { sources?: unknown[]; error?: unknown }) => void
      ) => {
        if (!window.electronAPI?.getDesktopSources) {
          callback({ sources: [] });
          return;
        }
        window.electronAPI
          .getDesktopSources(request.options)
          .then((sources) => callback({ sources }))
          .catch((error: unknown) => callback({ error }));
      }) as (...a: unknown[]) => void);

      api.on('readyToClose', (() => leaveVoice()) as (...a: unknown[]) => void);

      const ea = window.electronAPI;
      if (ea?.onOpenDesktopPicker) {
        ea.onOpenDesktopPicker(async () => {
          if (!jitsiRef.current) {
            ea.selectDesktopSource?.(null);
            return;
          }
          try {
            const result = await jitsiRef.current._openDesktopPicker();
            ea.selectDesktopSource?.(result?.source ?? null);
          } catch {
            ea.selectDesktopSource?.(null);
          }
        });
      }
    },
    [client, refs, voiceStateKey, pushVoiceState, refreshParticipants, setVoiceState, leaveVoice]
  );

  return { startJitsi };
}
