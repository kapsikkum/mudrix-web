import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom, useAtomValue } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { CallEvent, CallState as SDKCallState, CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call';
import type { MatrixCall, CallError } from 'matrix-js-sdk/lib/webrtc/call';
import { callStateAtom, CALL_INITIAL_STATE } from '@/app/store/atoms/call';
import { audioDeviceStateAtom } from '@/app/store/atoms/audioDevices';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useToast } from '@/app/hooks/useToast';
import { supportsSinkId } from '@/app/hooks/useAudioDeviceSettings';

const RING_TIMEOUT_MS = 30_000;

function friendlyStatus(state: SDKCallState | string, t: (key: string) => string): string {
  switch (state) {
    case SDKCallState.Ringing:
      return t('voice.statusRinging');
    case SDKCallState.InviteSent:
      return t('voice.statusCalling');
    case SDKCallState.Connecting:
    case SDKCallState.CreateAnswer:
    case SDKCallState.CreateOffer:
    case SDKCallState.WaitLocalMedia:
      return t('voice.statusConnecting');
    case SDKCallState.Connected:
      return t('voice.statusConnected');
    case SDKCallState.Ended:
      return t('voice.statusCallEnded');
    default:
      return String(state);
  }
}

interface AudioRig {
  remoteAudioEl: HTMLAudioElement;
  audioCtx: AudioContext | null;
  gainNode: GainNode | null;
  gainDest: MediaStreamAudioDestinationNode | null;
}

type SinkableAudio = HTMLAudioElement & { setSinkId(id: string): Promise<void> };

function createAudioRig(): AudioRig {
  const remoteAudioEl = document.createElement('audio');
  remoteAudioEl.autoplay = true;
  remoteAudioEl.style.display = 'none';
  document.body.appendChild(remoteAudioEl);
  return { remoteAudioEl, audioCtx: null, gainNode: null, gainDest: null };
}

function destroyAudioRig(rig: AudioRig | null) {
  if (!rig) return;
  rig.remoteAudioEl.pause();
  rig.remoteAudioEl.srcObject = null;
  rig.remoteAudioEl.remove();
  rig.gainNode?.disconnect();
  rig.gainDest?.disconnect();
  rig.audioCtx?.close().catch(() => {});
}

async function applyRemoteStream(
  rig: AudioRig,
  stream: MediaStream,
  speakerId: string,
  outputVolume: number
) {
  rig.remoteAudioEl.srcObject = stream;
  rig.remoteAudioEl.volume = outputVolume;
  if (supportsSinkId && speakerId) {
    await (rig.remoteAudioEl as SinkableAudio).setSinkId(speakerId).catch(() => {});
  }
}

async function applyInputGain(
  rig: AudioRig,
  call: MatrixCall,
  rawStream: MediaStream,
  inputVolume: number
) {
  if (rawStream.getAudioTracks().length === 0) return;

  if (!rig.audioCtx || rig.audioCtx.state === 'closed') {
    rig.audioCtx = new AudioContext();
  }

  rig.gainNode?.disconnect();
  rig.gainDest?.disconnect();

  const source = rig.audioCtx.createMediaStreamSource(rawStream);
  const gain = rig.audioCtx.createGain();
  gain.gain.value = inputVolume;
  const dest = rig.audioCtx.createMediaStreamDestination();

  source.connect(gain);
  gain.connect(dest);

  rig.gainNode = gain;
  rig.gainDest = dest;

  const processedStream = dest.stream;
  rawStream.getVideoTracks().forEach((t) => processedStream.addTrack(t));

  await call.updateLocalUsermediaStream(processedStream, true, false).catch(() => {});
}

export function useCall(client: MatrixClient | null) {
  const { t } = useTranslation();
  const [callState, setCallState] = useAtom(callStateAtom);
  const audioDevices = useAtomValue(audioDeviceStateAtom);
  const callRef = useRef<MatrixCall | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rigRef = useRef<AudioRig | null>(null);
  const toast = useToast();

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    rig.remoteAudioEl.volume = audioDevices.outputVolume;
    if (supportsSinkId && audioDevices.speakerId) {
      (rig.remoteAudioEl as SinkableAudio).setSinkId(audioDevices.speakerId).catch(() => {});
    }
  }, [audioDevices.outputVolume, audioDevices.speakerId]);

  useEffect(() => {
    if (rigRef.current?.gainNode) {
      rigRef.current.gainNode.gain.value = audioDevices.inputVolume;
    }
  }, [audioDevices.inputVolume]);

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current !== null) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearRingTimer();
    setCallState(CALL_INITIAL_STATE);
    callRef.current = null;
    destroyAudioRig(rigRef.current);
    rigRef.current = null;
  }, [clearRingTimer, setCallState]);

  const setupCallListeners = useCallback(
    (call: MatrixCall) => {
      call.on(CallEvent.FeedsChanged, ((_feeds: unknown[]) => {
        const remoteStream = call.remoteUsermediaStream;
        if (!remoteStream || !rigRef.current) return;
        const { speakerId, outputVolume } = audioDevices;
        applyRemoteStream(rigRef.current, remoteStream, speakerId, outputVolume);
      }) as (...args: unknown[]) => void);

      call.on(CallEvent.Hangup, (endedCall: MatrixCall) => {
        const reason = endedCall.hangupReason;
        if (reason === CallErrorCode.UserHangup) {
          toast.info(t('voice.toastCallEnded'));
        } else if (reason === 'invite_timeout') {
          toast.warning(t('voice.toastCallTimeout'));
        } else if (reason === CallErrorCode.NoUserMedia) {
          toast.error(t('voice.toastMicDenied'));
        }
        reset();
      });

      call.on(CallEvent.Error, (err: CallError) => {
        const msg = err.message ?? '';
        if (msg.includes('media') || err.code === CallErrorCode.NoUserMedia) {
          toast.error(t('voice.toastMicAccessFailed'));
        } else if (msg.includes('ice') || msg.includes('ICE')) {
          toast.error(t('voice.toastNetworkFailed'));
        } else {
          toast.error(t('voice.toastCallError', { error: msg || t('common.unknownError') }));
        }
        reset();
      });

      call.on(
        CallEvent.State,
        (newState: SDKCallState, _oldState: SDKCallState, _call: MatrixCall) => {
          setCallState((prev) => ({ ...prev, status: friendlyStatus(newState, t) }));
          if (newState === SDKCallState.Connected) {
            clearRingTimer();
            setCallState((prev) => ({ ...prev, active: true, incoming: false }));
            const localStream = call.localUsermediaFeed?.stream;
            if (localStream && rigRef.current) {
              applyInputGain(rigRef.current, call, localStream, audioDevices.inputVolume);
            }
          }
        }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clearRingTimer, reset, setCallState, toast, t]
  );

  const applyDevicesToMediaHandler = useCallback(async () => {
    if (!client) return;
    const { micId, cameraId } = audioDevices;
    const mh = client.getMediaHandler();
    if (micId) await mh.setAudioInput(micId).catch(() => {});
    if (cameraId) await mh.setVideoInput(cameraId).catch(() => {});
  }, [client, audioDevices]);

  const handleIncoming = useCallback(
    (call: MatrixCall) => {
      if (callRef.current) {
        call.hangup(CallErrorCode.UserHangup, false);
        return;
      }

      callRef.current = call;
      rigRef.current = createAudioRig();

      const member = call.getOpponentMember?.();
      const callerId = member?.userId ?? t('voice.unknownCaller');
      const callerName = member?.name ?? callerId;

      setCallState({
        ...CALL_INITIAL_STATE,
        incoming: true,
        callerId,
        callerName,
        status: friendlyStatus(SDKCallState.Ringing, t),
        roomId: call.roomId ?? null,
      });

      setupCallListeners(call);

      ringTimerRef.current = setTimeout(() => {
        if (callRef.current === call) {
          call.hangup(CallErrorCode.UserHangup, false);
          toast.warning(t('voice.toastMissedCall'));
          reset();
        }
      }, RING_TIMEOUT_MS);
    },
    [reset, setCallState, setupCallListeners, toast, t]
  );

  useMatrixEvent(client, 'Call.incoming', handleIncoming);

  const accept = useCallback(async () => {
    if (!callRef.current) return;
    clearRingTimer();
    await applyDevicesToMediaHandler();
    try {
      await callRef.current.answer();
      setCallState((prev) => ({
        ...prev,
        incoming: false,
        active: true,
        status: t('voice.statusConnecting'),
      }));
    } catch (err) {
      toast.error(
        t('voice.toastAnswerFailed', {
          error: err instanceof Error ? err.message : t('common.unknownError'),
        })
      );
      reset();
    }
  }, [applyDevicesToMediaHandler, clearRingTimer, reset, setCallState, toast, t]);

  const decline = useCallback(() => {
    if (callRef.current) {
      callRef.current.hangup(CallErrorCode.UserHangup, false);
    } else {
      reset();
    }
  }, [reset]);

  const hangup = useCallback(() => {
    if (callRef.current) {
      callRef.current.hangup(CallErrorCode.UserHangup, false);
    } else {
      reset();
    }
  }, [reset]);

  const toggleMute = useCallback(() => {
    if (!callRef.current) return;
    const muted = !callState.isMuted;
    callRef.current.setMicrophoneMuted(muted);
    setCallState((prev) => ({ ...prev, isMuted: muted }));
  }, [callState.isMuted, setCallState]);

  const placeCall = useCallback(
    async (roomId: string) => {
      if (!client) return;
      if (callRef.current) {
        toast.warning(t('voice.toastAlreadyInCall'));
        return;
      }
      try {
        await applyDevicesToMediaHandler();

        const { createNewMatrixCall } = await import('matrix-js-sdk');
        const call = createNewMatrixCall(client, roomId);
        if (!call) throw new Error(t('voice.webrtcNotSupported'));

        callRef.current = call;
        rigRef.current = createAudioRig();
        setupCallListeners(call);

        const room = client.getRoom(roomId);
        const myId = client.getUserId() ?? '';
        const remoteMember = room?.getMembers().find((m) => m.userId !== myId);
        const callerName = remoteMember?.name ?? remoteMember?.userId ?? null;
        const callerId = remoteMember?.userId ?? null;

        setCallState({
          ...CALL_INITIAL_STATE,
          active: false,
          incoming: false,
          callerId,
          callerName,
          status: friendlyStatus(SDKCallState.InviteSent, t),
          roomId,
        });

        await call.placeVoiceCall();
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('common.unknownError');
        if (msg.includes('microphone') || msg.includes('media') || msg.includes('Permission')) {
          toast.error(t('voice.toastMicDeniedRetry'));
        } else {
          toast.error(t('voice.toastCallFailed', { error: msg }));
        }
        reset();
      }
    },
    [applyDevicesToMediaHandler, client, reset, setCallState, setupCallListeners, toast, t]
  );

  return { callState, accept, decline, hangup, toggleMute, placeCall };
}
