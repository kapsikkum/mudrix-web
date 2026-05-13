import { useCallback, useRef, useEffect } from 'react';
import { useAtom } from 'jotai';
import { EventType } from 'matrix-js-sdk';
import type { MatrixClient } from 'matrix-js-sdk';
import type { UntypedStateEventType, RawStateContent } from '@/types/matrix';
import { voiceStateAtom, type VoiceParticipant } from '@/app/store/atoms';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { playVoiceSound } from '../features/voice/voiceSounds';
import { formatUserId } from '@/util/matrix';

const VOICE_STATE_TYPE = 'org.wizard.voice.member';
const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds
const PARTICIPANT_TTL_MS = 3 * 60_000; // 3 minutes — stale threshold

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (domain: string, opts: Record<string, unknown>) => JitsiAPI;
  }
}

interface JitsiAPI {
  dispose(): void;
  executeCommand(cmd: string, ...args: unknown[]): void;
  on(event: string, cb: (...a: unknown[]) => void): void;
  getParticipantsInfo(): Array<{ id: string; displayName: string }>;
}

async function loadJitsiApi(domain: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://${domain}/external_api.js`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Jitsi API'));
    document.head.appendChild(s);
  });
}

function sanitizeName(roomName: string, roomId: string) {
  return `Matrix-${roomName}-${roomId}`.replace(/[^a-zA-Z0-9-_]/g, '_');
}

export function useVoice(client: MatrixClient | null) {
  const [voiceState, setVoiceState] = useAtom(voiceStateAtom);
  const jitsiRef = useRef<JitsiAPI | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readyRef = useRef(false); // gates sound playback
  const localJitsiIdRef = useRef<string | null>(null);
  const jitsiIdToNameRef = useRef<Map<string, string>>(new Map());
  // Set of Jitsi participant IDs currently screensharing (local + remote)
  const screensharingIdsRef = useRef<Set<string>>(new Set());
  // Set of Jitsi participant IDs currently with camera on (local + remote)
  const cameraOnIdsRef = useRef<Set<string>>(new Set());
  // Set of Jitsi participant IDs currently muted (local + remote)
  const mutedIdsRef = useRef<Set<string>>(new Set());
  // Per-device AV state cache (mirrors #voiceStateCache)
  const voiceStateCacheRef = useRef<Record<string, unknown>>({});

  const voiceStateKey = useCallback(() => client?.getDeviceId() ?? '', [client]);

  const buildParticipants = useCallback(
    (roomId: string): VoiceParticipant[] => {
      if (!client) return [];
      const room = client.getRoom(roomId);
      if (!room) return [];

      let events = room.currentState.getStateEvents(VOICE_STATE_TYPE) ?? [];
      if (!Array.isArray(events)) events = [events];

      const byUser = new Map<
        string,
        {
          muted: boolean;
          videoMuted: boolean;
          screensharing: boolean;
          jitsiId: string | null;
        }
      >();
      const matrixNames = new Set<string>();

      for (const ev of events) {
        const content = ev.getContent();
        const uid = ev.getSender() ?? '';
        if (!uid || !content?.participating) continue;

        // TTL check: treat participant as gone if their last heartbeat is too old.
        // Use last_seen if present, otherwise fall back to joined_at.
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
        // Prefer live Jitsi AV state (populated by Jitsi events) when we have a
        // jitsiId AND are currently inside the call (jitsiRef is active).
        // Fall back to Matrix state events for all three fields so that remote
        // participants' state is correctly reflected even before Jitsi has emitted
        // an event for them.
        const jid = data.jitsiId;
        // Only trust the live Jitsi tracking sets when they actually contain an
        // entry for this participant — sets are only populated after a
        // Jitsi event fires for that id. If the set has no entry yet, fall
        // back to the Matrix state event which is always up-to-date.
        const jitsiMuted = jid && mutedIdsRef.current.has(jid) ? true : data.muted;
        const jitsiCamOff = jid && cameraOnIdsRef.current.has(jid) ? false : data.videoMuted;
        const isScreensharing =
          jid && screensharingIdsRef.current.has(jid) ? true : data.screensharing;
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

      // Add external Jitsi-only participants
      const seen = new Set<string>();
      for (const jp of jitsiRef.current?.getParticipantsInfo() ?? []) {
        const dn = jp.displayName?.toLowerCase() ?? '';
        if (matrixNames.has(dn) || seen.has(dn)) continue;
        seen.add(dn);
        result.push({
          userId: null,
          name: jp.displayName ?? 'Guest',
          mxcAvatar: null,
          jitsiId: jp.id,
          muted: mutedIdsRef.current.has(jp.id),
          videoMuted: !cameraOnIdsRef.current.has(jp.id),
          screensharing: screensharingIdsRef.current.has(jp.id),
          external: true,
        });
      }

      return result;
    },
    [client]
  );

  const refreshParticipants = useCallback(
    (roomId: string) => {
      clearTimeout(refreshTimerRef.current ?? undefined);
      refreshTimerRef.current = setTimeout(() => {
        const participants = buildParticipants(roomId);
        setVoiceState((prev) => ({ ...prev, participants }));
      }, 100);
    },
    [buildParticipants, setVoiceState]
  );

  const pushVoiceState = useCallback(
    (roomId: string, updates: Record<string, unknown>) => {
      if (!client) return;
      voiceStateCacheRef.current = { ...voiceStateCacheRef.current, ...updates };
      client
        .sendStateEvent(
          roomId,
          VOICE_STATE_TYPE as UntypedStateEventType,
          voiceStateCacheRef.current as RawStateContent,
          voiceStateKey()
        )
        .catch(() => {});
    },
    [client, voiceStateKey]
  );

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      /* battery saver or not supported */
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState === 'visible' && voiceState.roomId && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [voiceState.roomId]);

  // Best-effort cleanup on tab close via fetch keepalive.
  // keepalive:true survives page unload and supports proper Authorization headers,
  // unlike sendBeacon which cannot set headers and may be rejected by Matrix servers.
  useEffect(() => {
    const handleUnload = () => {
      const roomId = voiceState.roomId;
      if (!client || !roomId) return;

      const baseUrl = client.baseUrl;
      const accessToken = client.getAccessToken();
      const deviceKey = voiceStateKey();
      if (!accessToken || !deviceKey) return;

      const encodedRoom = encodeURIComponent(roomId);
      const encodedType = encodeURIComponent(VOICE_STATE_TYPE);
      const encodedKey = encodeURIComponent(deviceKey);
      const url = `${baseUrl}/_matrix/client/v3/rooms/${encodedRoom}/state/${encodedType}/${encodedKey}`;

      fetch(url, {
        method: 'PUT',
        keepalive: true,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ participating: false }),
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [client, voiceState.roomId, voiceStateKey]);

  const startPing = useCallback(() => {
    const run = async () => {
      const start = performance.now();
      try {
        await fetch('/', { method: 'HEAD', cache: 'no-store' });
        const ms = Math.round(performance.now() - start);
        const quality = ms < 80 ? 95 : ms < 200 ? 55 : 20;
        setVoiceState((prev) => ({ ...prev, pingMs: ms, connectionQuality: quality }));
      } catch {
        setVoiceState((prev) => ({ ...prev, pingMs: null, connectionQuality: 20 }));
      }
    };
    run();
    pingIntervalRef.current = setInterval(run, 10_000);
  }, [setVoiceState]);

  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  /**
   * Start the 60-second heartbeat + reconciliation loop.
   *
   * Each tick:
   * 1. Writes `last_seen` into our own Matrix state event so others can detect
   *    that we are still alive.
   * 2. Reads all Matrix participants marked as `participating` and compares them
   *    against Jitsi's live participant list. Anyone present in Matrix state but
   *    absent from Jitsi gets a `participating: false` state event written on
   *    their behalf (using our own device key — they won't overwrite the stale
   *    event because their client is gone).
   *
   * NOTE: We only push `participating: false` for *other* users, never for
   * ourselves — that is handled by leaveVoice() and beforeunload.
   */
  const startHeartbeat = useCallback(
    (roomId: string) => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

      heartbeatIntervalRef.current = setInterval(() => {
        if (!client) return;

        // 1. Own heartbeat — update last_seen in our cached state event.
        pushVoiceState(roomId, { last_seen: Date.now() });

        // 2. Jitsi reconciliation — only meaningful when we are inside the call.
        const api = jitsiRef.current;
        if (!api) return;

        const room = client.getRoom(roomId);
        if (!room) return;

        // Build the set of display names currently visible inside Jitsi.
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

          // Check TTL — if stale, mark them as not participating.
          const heartbeatTs: number | undefined = content.last_seen ?? content.joined_at;
          const isStale = heartbeatTs ? now - heartbeatTs > PARTICIPANT_TTL_MS : false;

          // Check Jitsi presence — look up their Matrix display name in the Jitsi list.
          const member = room.getMember(senderUid);
          const displayName = (member?.name ?? formatUserId(senderUid)).toLowerCase();
          const absentFromJitsi = jitsiNames.size > 0 && !jitsiNames.has(displayName);

          if (isStale || absentFromJitsi) {
            // Write participating:false using their stateKey (the device ID stored
            // in the state event's state_key). Fall back to our own device key only
            // if we cannot determine theirs — in practice the state_key IS the device id.
            const staleKey = ev.getStateKey() ?? myDeviceKey;
            client
              .sendStateEvent(
                roomId,
                VOICE_STATE_TYPE as UntypedStateEventType,
                { participating: false } as RawStateContent,
                staleKey
              )
              .then(() => {
                // Immediately refresh local participants — don't wait for the
                // Matrix sync echo which may be delayed or filtered by the
                // own-sender guard.
                refreshParticipants(roomId);
              })
              .catch(() => {});
          }
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    [client, voiceStateKey, pushVoiceState, refreshParticipants]
  );

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

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
          {
            ...pl,
            events: { ...(pl.events ?? {}), [VOICE_STATE_TYPE]: 0 },
          },
          ''
        );
      } catch {
        /* ignore */
      }
    },
    [client]
  );

  const startJitsi = useCallback(
    (roomId: string, domain: string) => {
      const container = containerRef.current;
      if (!container || !client) return;

      const room = client.getRoom(roomId);
      const roomName = room?.name ?? roomId;
      const confId = sanitizeName(roomName, roomId);
      const userId = client.getUserId() ?? '';
      const member = room?.getMember(userId);
      const displayName =
        member?.name ?? client.getUser(userId)?.displayName ?? formatUserId(userId);

      jitsiRef.current = new window.JitsiMeetExternalAPI(domain, {
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

      const api = jitsiRef.current;

      api.on('videoConferenceJoined', (({ id }: { id: string }) => {
        readyRef.current = true;
        localJitsiIdRef.current = id;
        jitsiIdToNameRef.current.set(id, displayName);
        voiceStateCacheRef.current = { participating: true, joined_at: Date.now(), jitsi_id: id };
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
      }) as (...a: unknown[]) => void);

      api.on('audioMuteStatusChanged', (({ muted }: { muted: boolean }) => {
        // Update local participant's muted state in tracking set
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
        // Update local participant's camera state in tracking set
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

      // Local screenshare toggle
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
        void details; // suppress unused warning
      }) as (...a: unknown[]) => void);

      // Remote participant audio mute changes
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

      // Remote participant video mute changes
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

      // Remote participant screenshare changes
      api.on('participantScreenshareStatusChanged', (({ id, on }: { id: string; on: boolean }) => {
        if (on) screensharingIdsRef.current.add(id);
        else screensharingIdsRef.current.delete(id);
        refreshParticipants(roomId);
      }) as (...a: unknown[]) => void);

      api.on('readyToClose', (() => leaveVoice()) as (...a: unknown[]) => void);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [client, voiceStateKey, pushVoiceState, refreshParticipants, setVoiceState]
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
      const joinedRoomName = joinedRoom?.name ?? roomId;

      setVoiceState((prev) => ({
        ...prev,
        roomId,
        roomName: joinedRoomName,
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
      // and containerRef.current is populated before startJitsi reads it.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      startJitsi(roomId, domain);
      startPing();
      startHeartbeat(roomId);
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

  const toggleMute = useCallback(() => {
    jitsiRef.current?.executeCommand('toggleAudio');
  }, []);

  const toggleVideo = useCallback(() => {
    jitsiRef.current?.executeCommand('toggleVideo');
  }, []);

  const popOut = useCallback(() => {
    setVoiceState((prev) => ({ ...prev, popOut: true }));
  }, [setVoiceState]);

  const popIn = useCallback(() => {
    setVoiceState((prev) => ({ ...prev, popOut: false }));
  }, [setVoiceState]);

  const attachContainer = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
  }, []);

  const handleVoiceStateEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      const roomId = voiceState.roomId;
      if (event.getType?.() !== VOICE_STATE_TYPE) return;
      if (event.getRoomId?.() !== roomId) return;
      // Do NOT skip own-sent events: we push participating:false on behalf of
      // stale participants during reconciliation and need the local UI to update.

      const content = event.getContent?.() ?? {};
      const prev = event.getPrevContent?.() ?? {};

      // Sound cues only for *other* users' state changes (gated on readyRef).
      // participating:false evictions never trigger sounds regardless.
      const isOwnEvent = event.getSender?.() === client?.getUserId();
      if (!isOwnEvent && readyRef.current && content.participating) {
        if (prev.video_muted !== false && content.video_muted === false)
          playVoiceSound('camera-on');
      }

      if (roomId) refreshParticipants(roomId);
    },
    [client, voiceState.roomId, refreshParticipants]
  );
  useMatrixEvent(client, 'RoomState.events', handleVoiceStateEvent);

  useEffect(() => {
    if (!client) return;
    try {
      const stored = localStorage.getItem('voice-rejoin');
      if (!stored) return;
      const { roomId, domain, ts } = JSON.parse(stored) as {
        roomId: string;
        domain: string;
        ts: number;
      };
      if (Date.now() - ts > 60_000) {
        localStorage.removeItem('voice-rejoin');
        return;
      }
      // Attempt silent rejoin after a short delay (so client is fully synced)
      const timer = setTimeout(() => {
        const room = client.getRoom(roomId);
        if (room && domain) joinVoice(roomId, domain);
        else localStorage.removeItem('voice-rejoin');
      }, 1500);
      return () => clearTimeout(timer);
    } catch {
      /* malformed JSON */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount only

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
