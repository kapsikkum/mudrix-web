import { useCallback, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom, useStore } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { Room } from 'matrix-js-sdk';
import { CallSession, type CallSnapshot, type PreferredDevices } from 'mudrix-rtc';
import {
  callActionsAtom,
  callPanelAtom,
  callRtcOverrideDomainAtom,
  callSessionAtom,
  callUiAtom,
  callUserAudioAtom,
  callVolumesAtom,
  leavingCallRoomIdAtom,
  pendingCallRoomIdAtom,
  pushToTalkModeAtom,
  showNonVideoParticipantsAtom,
  showOwnScreenShareAtom,
  type CallPresentation,
} from '@/app/store/atoms/call';
import { currentRoomIdAtom } from '@/app/store/atoms/rooms';
import { settingsOpenAtom, settingsPageAtom } from '@/app/store/atoms/ui';
import {
  audioInputDeviceAtom,
  audioOutputDeviceAtom,
  autoGainControlAtom,
  deafenedAtom,
  echoCancellationAtom,
  micMutedAtom,
  noiseSuppressionAtom,
  notificationSoundPackAtom,
  soundOverridesAtom,
  videoInputDeviceAtom,
} from '@/app/store/atoms/settings';
import { useToast } from '@/app/hooks/useToast';
import { fetchMatrixRtcSupport } from '@/util/serverCapabilities';
import { isDmRoom } from '@/util/matrix';
import { resolveSoundPack } from '@/util/notificationSounds';
import { playVoiceSound } from '@/app/features/voice/voiceSounds';
import { onSessionEnd } from '@/client/initMatrix';
import { hideScreenShareBar, onScreenShareStop, showScreenShareBar } from '@/util/desktop';
import { hasOngoingCall } from './callSlot';
import { installNativeScreenCapture } from './nativeCapture/installNativeScreenCapture';
import { usePushToTalk } from './usePushToTalk';

/** How long a left call's room stays marked as leaving, if its membership never confirms. */
const LEAVE_CONFIRM_TIMEOUT_MS = 30_000;

const IDLE_UI = {
  roomId: null,
  phase: 'idle' as const,
  presentation: 'hidden' as const,
  isMuted: false,
  isDeafened: false,
  isVideoMuted: false,
  isScreenSharing: false,
  isSpotlight: true,
};

/** Mirrors the call's screen-share state onto the desktop shell's floating share bar. */
function useDesktopScreenShareBar(sharing: boolean, alive: boolean, toggleScreenshare: () => void) {
  const { t } = useTranslation();
  const shownRef = useRef(false);
  const sharingRef = useRef(sharing);
  sharingRef.current = sharing;
  const toggleRef = useRef(toggleScreenshare);
  toggleRef.current = toggleScreenshare;
  const active = sharing && alive;

  useEffect(() => {
    if (active === shownRef.current) return;
    shownRef.current = active;
    if (active) {
      showScreenShareBar({
        title: t('voice.sharingTitle'),
        stop: t('voice.stopShare'),
        back: t('voice.returnToCall'),
      });
    } else {
      hideScreenShareBar();
    }
  }, [active, t]);

  useEffect(
    () => () => {
      if (!shownRef.current) return;
      shownRef.current = false;
      hideScreenShareBar();
    },
    []
  );

  useEffect(
    () =>
      onScreenShareStop(() => {
        if (sharingRef.current) toggleRef.current();
      }),
    []
  );
}

/**
 * Owns the call session: starts and ends it, mirrors its state into the UI atoms, and exposes the
 * actions the rest of the app uses (control bar, sidebar panel, commands). Mount it once.
 */
export function CallController() {
  const { t } = useTranslation();
  const store = useStore();
  const toast = useToast();
  const session = useAtomValue(callSessionAtom);
  const setSession = useSetAtom(callSessionAtom);
  const setUi = useSetAtom(callUiAtom);
  const setActions = useSetAtom(callActionsAtom);
  const setPanel = useSetAtom(callPanelAtom);
  const setOverrideDomain = useSetAtom(callRtcOverrideDomainAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Read through a ref so changing the pack mid-call does not rebuild the session subscription.
  const soundPack = useAtomValue(notificationSoundPackAtom);
  const soundOverrides = useAtomValue(soundOverridesAtom);
  const soundRef = useRef({ soundPack, soundOverrides });
  soundRef.current = { soundPack, soundOverrides };

  const resetUi = useCallback(() => {
    setUi((prev) => ({ ...prev, ...IDLE_UI }));
    setPanel(null);
  }, [setUi, setPanel]);

  const start = useCallback(
    async (room: Room, opts: { voiceOnly?: boolean; presentation?: CallPresentation } = {}) => {
      const runStart = async () => {
        const presentation = opts.presentation ?? 'room';
        const previous = sessionRef.current;
        const previousRoomId = store.get(callUiAtom).roomId;
        store.set(
          leavingCallRoomIdAtom,
          previous && previousRoomId !== room.roomId ? previousRoomId : null
        );
        if (previous) {
          setSession(null);
          setUi((prev) => ({ ...prev, roomId: null, phase: 'idle', incoming: null, presentation }));
          await previous.leave();
        } else {
          setUi((prev) => ({ ...prev, incoming: null, presentation }));
        }

        const micMuted = store.get(micMutedAtom);
        const deafened = store.get(deafenedAtom);
        const voiceOnly = !!opts.voiceOnly;
        const next = new CallSession(room.client, room);
        for (const [userId, audio] of Object.entries(store.get(callUserAudioAtom))) {
          next.setUserVolume(userId, audio.volume);
          next.setUserMuted(userId, audio.muted);
          if (audio.streamVolume !== undefined) next.setStreamVolume(userId, audio.streamVolume);
        }
        setSession(next);
        store.set(showNonVideoParticipantsAtom, true);
        store.set(showOwnScreenShareAtom, true);
        setUi((prev) => ({
          ...prev,
          roomId: room.roomId,
          phase: 'joining',
          voiceOnly,
          isMuted: micMuted || deafened,
          isDeafened: deafened,
          isVideoMuted: true,
          isScreenSharing: false,
          isSpotlight: true,
          presentation,
        }));
        store.set(pendingCallRoomIdAtom, null);

        // Joining a call that is already running never rings; starting one rings a DM and
        // notifies a room.
        const ongoing = await hasOngoingCall(room.client, room);
        const notificationType = ongoing
          ? undefined
          : isDmRoom(room, room.client)
            ? ('ring' as const)
            : ('notification' as const);

        const devices: PreferredDevices = {};
        const audioInput = store.get(audioInputDeviceAtom);
        const audioOutput = store.get(audioOutputDeviceAtom);
        const videoInput = store.get(videoInputDeviceAtom);
        if (audioInput) devices.audioinput = audioInput;
        if (audioOutput) devices.audiooutput = audioOutput;
        if (videoInput) devices.videoinput = videoInput;

        try {
          await next.join({
            voiceOnly,
            micEnabled: !micMuted,
            deafened,
            devices,
            audioProcessing: {
              noiseSuppression: store.get(noiseSuppressionAtom),
              echoCancellation: store.get(echoCancellationAtom),
              autoGainControl: store.get(autoGainControlAtom),
            },
            inputVolume: store.get(callVolumesAtom).input,
            outputVolume: store.get(callVolumesAtom).output,
            pushToTalk: store.get(pushToTalkModeAtom),
            callIntent: voiceOnly ? 'audio' : 'video',
            notificationType,
          });
        } catch {
          // Reported through the session snapshot (phase 'error')
        }
      };

      const client = room.client;
      const domain = client.getDomain();
      const overrideDomain = store.get(callRtcOverrideDomainAtom);
      store.set(pendingCallRoomIdAtom, room.roomId);
      const supported = overrideDomain === domain || (await fetchMatrixRtcSupport(client));
      if (!supported) {
        store.set(pendingCallRoomIdAtom, null);
        toast.error(t('call.homeserverUnsupported'), {
          duration: 10000,
          actionLabel: t('call.tryAnyway'),
          onClick: () => {
            if (domain) setOverrideDomain(domain);
            void runStart();
          },
        });
        return;
      }
      await runStart();
    },
    [store, setSession, setUi, setOverrideDomain, toast, t]
  );

  // On the Windows desktop app a share goes through Mudrix's own picker and native capture.
  const inCall = session !== null;
  useEffect(() => (inCall ? installNativeScreenCapture() : undefined), [inCall]);

  const pushToTalkMode = useAtomValue(pushToTalkModeAtom);
  useEffect(() => {
    session?.setPushToTalk(pushToTalkMode);
  }, [session, pushToTalkMode]);

  // Devices chosen in settings take effect in the running call.
  const audioInput = useAtomValue(audioInputDeviceAtom);
  const audioOutput = useAtomValue(audioOutputDeviceAtom);
  const videoInput = useAtomValue(videoInputDeviceAtom);
  useEffect(() => {
    if (!session || session.getSnapshot().phase !== 'joined') return;
    const apply = (kind: 'audioinput' | 'audiooutput' | 'videoinput', id: string) => {
      if (id && session.getActiveDevice(kind) !== id) {
        session.switchDevice(kind, id).catch(() => {});
      }
    };
    apply('audioinput', audioInput);
    apply('audiooutput', audioOutput);
    apply('videoinput', videoInput);
  }, [session, audioInput, audioOutput, videoInput]);

  // The session's state, mirrored into the UI atoms; the rest of the app reads those.
  useEffect(() => {
    if (!session) return undefined;
    let previous: CallSnapshot | null = null;
    const sync = () => {
      const snap = session.getSnapshot();
      if (snap.phase === 'error' || snap.phase === 'left') {
        if (snap.phase === 'error' && snap.error) {
          toast.error(
            snap.error.kind === 'no-sfu'
              ? t('call.noSfu')
              : t('call.startFailed', { error: snap.error.message })
          );
        }
        if (sessionRef.current === session) {
          setSession(null);
          resetUi();
        }
        return;
      }
      if (previous?.phase === 'joined' && snap.phase === 'joined') {
        const { soundPack: main, soundOverrides: overrides } = soundRef.current;
        const play = (kind: 'unmute' | 'mute' | 'camera-on' | 'camera-off') => {
          const pack = resolveSoundPack(kind, main, overrides);
          if (pack) playVoiceSound(kind, pack);
        };
        if (previous.local.microphone !== snap.local.microphone) {
          play(snap.local.microphone ? 'unmute' : 'mute');
        }
        if (previous.local.camera !== snap.local.camera) {
          play(snap.local.camera ? 'camera-on' : 'camera-off');
        }
      }
      previous = snap;
      setUi((prev) =>
        prev.roomId !== snap.roomId
          ? prev
          : snap.phase !== 'joined'
            ? { ...prev, phase: 'joining' }
            : {
                ...prev,
                phase: 'joined',
                isMuted: !snap.local.microphone,
                isDeafened: !snap.local.sound,
                isVideoMuted: !snap.local.camera,
                isScreenSharing: snap.local.screenshare,
              }
      );
    };
    sync();
    return session.subscribe(sync);
  }, [session, setSession, setUi, resetUi, toast, t]);

  const hangup = useCallback(() => {
    const current = sessionRef.current;
    store.set(leavingCallRoomIdAtom, current ? store.get(callUiAtom).roomId : null);
    setSession(null);
    resetUi();
    void current?.leave();
  }, [setSession, resetUi, store]);

  const leavingRoomId = useAtomValue(leavingCallRoomIdAtom);
  useEffect(() => {
    if (!leavingRoomId) return undefined;
    const timer = setTimeout(
      () => store.set(leavingCallRoomIdAtom, null),
      LEAVE_CONFIRM_TIMEOUT_MS
    );
    return () => clearTimeout(timer);
  }, [leavingRoomId, store]);

  const run = useCallback(
    (action: (s: CallSession, snap: CallSnapshot) => Promise<void>) => {
      const current = sessionRef.current;
      if (!current) return;
      action(current, current.getSnapshot()).catch((err: unknown) =>
        toast.error(err instanceof Error ? err.message : String(err))
      );
    },
    [toast]
  );

  const setMicrophone = useCallback(
    (enabled: boolean) => run((s) => s.setMicrophone(enabled)),
    [run]
  );
  const setTransmitting = useCallback((on: boolean) => {
    sessionRef.current?.setTransmitting(on);
  }, []);
  const toggleMute = useCallback(
    () =>
      run((s, snap) => {
        const enable = !snap.local.microphone;
        store.set(micMutedAtom, !enable);
        if (enable && !snap.local.sound) store.set(deafenedAtom, false); // unmuting undeafens
        return s.setMicrophone(enable);
      }),
    [run, store]
  );
  const toggleDeafen = useCallback(
    () =>
      run(async (s, snap) => {
        const deafen = snap.local.sound;
        store.set(deafenedAtom, deafen);
        await s.setDeafened(deafen);
        if (!deafen && !store.get(micMutedAtom)) await s.setMicrophone(true);
      }),
    [run, store]
  );
  const toggleVideo = useCallback(() => run((s, snap) => s.setCamera(!snap.local.camera)), [run]);
  const toggleScreenshare = useCallback(
    () => run((s, snap) => s.setScreenShare(!snap.local.screenshare)),
    [run]
  );
  const setSpotlight = useCallback(
    (spotlight: boolean) => setUi((prev) => ({ ...prev, isSpotlight: spotlight })),
    [setUi]
  );
  const openReactions = useCallback(
    (emoji?: string) => {
      if (emoji) {
        void sessionRef.current?.sendReaction(emoji, emoji).catch(() => {});
        return;
      }
      setPanel((p) => (p === 'reactions' ? null : 'reactions'));
    },
    [setPanel]
  );
  const setPresentation = useCallback(
    (presentation: CallPresentation) => setUi((prev) => ({ ...prev, presentation })),
    [setUi]
  );

  // The call's options live on Mudrix's Voice & Audio page.
  const setSettingsPage = useSetAtom(settingsPageAtom);
  const setSettingsOpen = useSetAtom(settingsOpenAtom);
  const openSettings = useCallback(() => {
    setSettingsPage('voice');
    setSettingsOpen(true);
  }, [setSettingsPage, setSettingsOpen]);

  usePushToTalk(session ? setTransmitting : null);

  const ui = useAtomValue(callUiAtom);
  useDesktopScreenShareBar(ui.isScreenSharing, session !== null, toggleScreenshare);

  const roomId = ui.roomId;
  useEffect(() => {
    if (roomId === null || currentRoomId === roomId) return;
    setUi((prev) =>
      prev.presentation === 'fullscreen' ? { ...prev, presentation: 'room' } : prev
    );
  }, [roomId, currentRoomId, setUi]);

  useEffect(() => {
    setActions({
      start,
      hangup,
      toggleMute,
      setMicrophone,
      toggleDeafen,
      toggleVideo,
      toggleScreenshare,
      setSpotlight,
      openReactions,
      openSettings,
      setPresentation,
    });
    return () => setActions(null);
  }, [
    start,
    hangup,
    toggleMute,
    setMicrophone,
    toggleDeafen,
    toggleVideo,
    toggleScreenshare,
    setSpotlight,
    openReactions,
    openSettings,
    setPresentation,
    setActions,
  ]);

  // Switching account or signing out ends the call first, so it doesn't carry into the next session.
  useEffect(
    () =>
      onSessionEnd(async () => {
        const current = sessionRef.current;
        if (!current) return;
        setSession(null);
        resetUi();
        await current.leave();
      }),
    [setSession, resetUi]
  );

  useEffect(() => {
    const onUnload = () => void sessionRef.current?.leave();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return null;
}
