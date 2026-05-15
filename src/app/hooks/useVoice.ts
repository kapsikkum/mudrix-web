import { useCallback, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { voiceStateAtom } from '@/app/store/atoms';
import { playVoiceSound } from '../features/voice/voiceSounds';
import { useWakeLock } from './voice/useWakeLock';
import { useNetworkQuality } from './voice/useNetworkQuality';
import { useParticipants } from './voice/useParticipants';
import { useVoiceMatrixState } from './voice/useVoiceMatrixState';
import { useJitsiApi } from './voice/useJitsiApi';
import { useAutoRejoin } from './voice/useAutoRejoin';
import { VOICE_STATE_TYPE } from './voice/types';
import { loadJitsiApi } from './voice/voiceHelpers';

export function useVoice(client: MatrixClient | null) {
  const [voiceState, setVoiceState] = useAtom(voiceStateAtom);

  const jitsiRef = useRef<InstanceType<typeof window.JitsiMeetExternalAPI> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false);
  const localJitsiIdRef = useRef<string | null>(null);
  const jitsiIdToNameRef = useRef<Map<string, string>>(new Map());
  const screensharingIdsRef = useRef<Set<string>>(new Set());
  const cameraOnIdsRef = useRef<Set<string>>(new Set());
  const mutedIdsRef = useRef<Set<string>>(new Set());
  const voiceStateCacheRef = useRef<Record<string, unknown>>({});

  const refs = {
    jitsiRef,
    containerRef,
    wakeLockRef,
    pingIntervalRef,
    heartbeatIntervalRef,
    refreshTimerRef,
    readyRef,
    localJitsiIdRef,
    jitsiIdToNameRef,
    screensharingIdsRef,
    cameraOnIdsRef,
    mutedIdsRef,
    voiceStateCacheRef,
  };

  const voiceStateKey = useCallback(() => client?.getDeviceId() ?? '', [client]);

  const { acquireWakeLock, releaseWakeLock } = useWakeLock(wakeLockRef, voiceState.roomId);
  const { startPing, stopPing } = useNetworkQuality(pingIntervalRef, setVoiceState);
  const { refreshParticipants, startHeartbeat, stopHeartbeat } = useParticipants(
    client,
    refs,
    voiceStateKey,
    setVoiceState
  );
  const { pushVoiceState } = useVoiceMatrixState(
    client,
    voiceState.roomId,
    voiceStateKey,
    voiceStateCacheRef,
    readyRef,
    refreshParticipants
  );

  const leaveVoiceRef = useRef<() => Promise<void>>(async () => {});

  const { startJitsi } = useJitsiApi(
    client,
    refs,
    voiceStateKey,
    pushVoiceState,
    refreshParticipants,
    setVoiceState,
    () => leaveVoiceRef.current()
  );

  const ensureVoicePL = useCallback(
    async (roomId: string) => {
      if (!client) return;
      const room = client.getRoom(roomId);
      if (!room) return;
      const plEvent = room.currentState.getStateEvents('m.room.power_levels', '');
      type PowerLevels = {
        events?: Record<string, number>;
        users?: Record<string, number>;
        users_default?: number;
        state_default?: number;
        [k: string]: unknown;
      };
      const pl =
        ((Array.isArray(plEvent) ? plEvent[0] : plEvent)?.getContent() as PowerLevels) ?? {};
      if ((pl.events?.[VOICE_STATE_TYPE] ?? -1) === 0) return;
      const myPl = pl.users?.[client.getUserId() ?? ''] ?? pl.users_default ?? 0;
      const plRequired = pl.state_default ?? 50;
      if (myPl < plRequired) return;
      try {
        await client.sendStateEvent(
          roomId,
          EventType.RoomPowerLevels,
          { ...pl, events: { ...(pl.events ?? {}), [VOICE_STATE_TYPE]: 0 } },
          ''
        );
      } catch {
        /* ignore */
      }
    },
    [client]
  );

  const joinVoice = useCallback(
    async (roomId: string, domain: string) => {
      if (!client) return;
      if (voiceState.roomId === roomId) return;

      // Leave any existing call first
      if (voiceState.roomId) {
        await client.sendStateEvent(
          voiceState.roomId,
          VOICE_STATE_TYPE as UntypedStateEventType,
          { participating: false } as RawStateContent,
          voiceStateKey()
        );
        jitsiRef.current?.dispose();
        jitsiRef.current = null;
      }

      const joinedRoom = client.getRoom(roomId);
      setVoiceState((prev) => ({
        ...prev,
        roomId,
        roomName: joinedRoom?.name ?? roomId,
        jitsiDomain: domain,
        isMuted: false,
        isVideoMuted: true,
        ready: false,
        participants: [],
        dominantSpeakerId: null,
        pingMs: null,
        connectionQuality: 100,
      }));

      localStorage.setItem('voice-rejoin', JSON.stringify({ roomId, domain, ts: Date.now() }));

      await ensureVoicePL(roomId);

      voiceStateCacheRef.current = { participating: true, joined_at: Date.now() };
      await client
        .sendStateEvent(
          roomId,
          VOICE_STATE_TYPE as UntypedStateEventType,
          voiceStateCacheRef.current as RawStateContent,
          voiceStateKey()
        )
        .catch(() => {});

      await loadJitsiApi(domain);
      // Wait for the next animation frame so JitsiEmbed's callback ref fires
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      startJitsi(roomId, domain);
      startPing();
      startHeartbeat(roomId, pushVoiceState);
      acquireWakeLock();
      playVoiceSound('join');
    },
    [
      client,
      voiceState.roomId,
      voiceStateKey,
      ensureVoicePL,
      startJitsi,
      startPing,
      startHeartbeat,
      pushVoiceState,
      acquireWakeLock,
      setVoiceState,
    ]
  );

  const leaveVoice = useCallback(async () => {
    const roomId = voiceState.roomId;
    if (!client || !roomId) return;
    localStorage.removeItem('voice-rejoin');

    await client
      .sendStateEvent(
        roomId,
        VOICE_STATE_TYPE as UntypedStateEventType,
        { participating: false } as RawStateContent,
        voiceStateKey()
      )
      .catch(() => {});

    jitsiRef.current?.dispose();
    jitsiRef.current = null;
    readyRef.current = false;
    localJitsiIdRef.current = null;
    jitsiIdToNameRef.current.clear();
    screensharingIdsRef.current.clear();
    cameraOnIdsRef.current.clear();
    mutedIdsRef.current.clear();
    voiceStateCacheRef.current = {};

    stopPing();
    stopHeartbeat();
    releaseWakeLock();
    clearTimeout(refreshTimerRef.current ?? undefined);

    playVoiceSound('leave');
    setVoiceState({
      roomId: null,
      roomName: null,
      jitsiDomain: null,
      isMuted: false,
      isVideoMuted: true,
      popOut: false,
      connectionQuality: 100,
      pingMs: null,
      participants: [],
      dominantSpeakerId: null,
      ready: false,
    });
  }, [
    client,
    voiceState.roomId,
    voiceStateKey,
    stopPing,
    stopHeartbeat,
    releaseWakeLock,
    setVoiceState,
  ]);

  // Keep the leaveVoiceRef in sync so Jitsi's readyToClose handler always
  // calls the latest closure without recreating all event bindings.
  leaveVoiceRef.current = leaveVoice;

  const toggleMute = useCallback(() => jitsiRef.current?.executeCommand('toggleAudio'), []);
  const toggleVideo = useCallback(() => jitsiRef.current?.executeCommand('toggleVideo'), []);
  const popOut = useCallback(
    () => setVoiceState((prev) => ({ ...prev, popOut: true })),
    [setVoiceState]
  );
  const popIn = useCallback(
    () => setVoiceState((prev) => ({ ...prev, popOut: false })),
    [setVoiceState]
  );
  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  useAutoRejoin(client, joinVoice);

  useEffect(() => {
    return () => {
      jitsiRef.current?.dispose();
      stopPing();
      stopHeartbeat();
      releaseWakeLock();
    };
  }, [stopPing, stopHeartbeat, releaseWakeLock]);

  return {
    voiceState,
    joinVoice,
    leaveVoice,
    toggleMute,
    toggleVideo,
    popOut,
    popIn,
    attachContainer,
    refreshParticipants,
  };
}
