import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import type { MatrixClient } from 'matrix-js-sdk';
import { CallEvent, CallState as SDKCallState, CallErrorCode } from 'matrix-js-sdk/lib/webrtc/call';
import type { MatrixCall, CallError } from 'matrix-js-sdk/lib/webrtc/call';
import { callStateAtom, CALL_INITIAL_STATE } from '@/app/store/atoms/call';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { useToast } from '@/app/hooks/useToast';

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

export function useCall(client: MatrixClient | null) {
  const { t } = useTranslation();
  const [callState, setCallState] = useAtom(callStateAtom);
  const callRef = useRef<MatrixCall | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();

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
  }, [clearRingTimer, setCallState]);

  const setupCallListeners = useCallback(
    (call: MatrixCall) => {
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
          toast.error(t('voice.toastCallError', { error: msg || 'Unknown error' }));
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
          }
          if (newState === SDKCallState.Ended) {
            reset();
          }
        }
      );
    },
    [clearRingTimer, reset, setCallState, toast, t]
  );

  const handleIncoming = useCallback(
    (call: MatrixCall) => {
      if (callRef.current) {
        call.hangup(CallErrorCode.UserHangup, false);
        return;
      }

      callRef.current = call;
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
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      );
      reset();
    }
  }, [clearRingTimer, reset, setCallState, toast, t]);

  const decline = useCallback(() => {
    callRef.current?.hangup(CallErrorCode.UserHangup, false);
    reset();
  }, [reset]);

  const hangup = useCallback(() => {
    callRef.current?.hangup(CallErrorCode.UserHangup, false);
    reset();
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
        const { createNewMatrixCall } = await import('matrix-js-sdk');
        const call = createNewMatrixCall(client, roomId);
        if (!call) throw new Error(t('voice.webrtcNotSupported'));
        callRef.current = call;
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
        const msg = err instanceof Error ? err.message : 'Unknown error';
        if (msg.includes('microphone') || msg.includes('media') || msg.includes('Permission')) {
          toast.error(t('voice.toastMicDeniedRetry'));
        } else {
          toast.error(t('voice.toastCallFailed', { error: msg }));
        }
        reset();
      }
    },
    [client, reset, setCallState, setupCallListeners, toast, t]
  );

  return { callState, accept, decline, hangup, toggleMute, placeCall };
}
