import { useEffect, useRef } from 'react';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { callActionsAtom, callSessionAtom, callUiAtom } from '@/app/store/atoms/call';
import { hideCallPopout, isTauriDesktop, onCallPopoutClosed, showCallPopout } from '@/util/desktop';
import { useReturnToCall } from './useReturnToCall';
import { useCallSnapshot } from './stage/useCallSnapshot';

/**
 * Desktop "pop out": a window of its own (always on top), not a tile inside the app. The call
 * itself stays in the main window, so the other window only mirrors its video (the screen share
 * if there is one, otherwise the first participant with video) and has a few buttons. The two
 * pages talk over a BroadcastChannel (they share an origin); `public/desktop/call-popout.js` is
 * the other end, so keep the message shapes in step with it.
 */
export const callPopoutOpenAtom = atom(false);

const POPOUT_CHANNEL = 'mudrix-call-popout';
/** The window is small, so frames are scaled down and sent at a modest rate. */
const FRAME_INTERVAL_MS = 66;
const FRAME_MAX_WIDTH = 960;

export function canOpenCallPopoutWindow(): boolean {
  return isTauriDesktop();
}

export function CallPopoutWindow() {
  const [open, setOpen] = useAtom(callPopoutOpenAtom);
  const session = useAtomValue(callSessionAtom);
  const snapshot = useCallSnapshot();
  const ui = useAtomValue(callUiAtom);
  const actions = useAtomValue(callActionsAtom);
  const returnToCall = useReturnToCall();
  const videoRef = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // The screen share if there is one, otherwise the first camera.
  const shown =
    snapshot?.participants.find((p) => p.screenTrack && !p.isLocal)?.screenTrack ??
    snapshot?.participants.find((p) => p.cameraTrack && !p.isLocal)?.cameraTrack ??
    snapshot?.participants.find((p) => p.cameraTrack)?.cameraTrack ??
    null;

  // Always the latest, for the channel handler that is set up once per window.
  const latest = useRef({ actions, returnToCall });
  latest.current = { actions, returnToCall };

  // Closing the window (its own close button) is all it takes; the call carries on in the app.
  useEffect(() => {
    if (!open) return undefined;
    return onCallPopoutClosed(() => setOpen(false));
  }, [open, setOpen]);

  // The call ended: close the window.
  useEffect(() => {
    if (open && !session) {
      setOpen(false);
      hideCallPopout();
    }
  }, [open, session, setOpen]);

  const muted = ui.isMuted;
  const hasVideo = !!shown;
  const stateRef = useRef({ muted, hasVideo });
  stateRef.current = { muted, hasVideo };

  const sendState = () => {
    channelRef.current?.postMessage({ type: 'state', ...stateRef.current });
  };

  useEffect(() => {
    if (!open) return undefined;
    const channel = new BroadcastChannel(POPOUT_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (e: MessageEvent<{ type?: string }>) => {
      switch (e.data?.type) {
        case 'ready':
          sendState();
          break;
        case 'mute':
          latest.current.actions?.toggleMute();
          break;
        case 'hangup':
          latest.current.actions?.hangup();
          break;
        case 'return':
          latest.current.returnToCall();
          break;
        default:
      }
    };
    sendState();
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (open) sendState();
  }, [open, muted, hasVideo]);

  // Frames of the shown video, copied from a hidden video element in this window.
  useEffect(() => {
    const video = videoRef.current;
    if (!open || !video || !shown) return undefined;
    shown.attach(video);
    let busy = false;
    const timer = window.setInterval(() => {
      const channel = channelRef.current;
      if (busy || !channel || video.readyState < 2 || !video.videoWidth) return;
      busy = true;
      const scale = Math.min(1, FRAME_MAX_WIDTH / video.videoWidth);
      createImageBitmap(video, {
        resizeWidth: Math.round(video.videoWidth * scale),
        resizeHeight: Math.round(video.videoHeight * scale),
        resizeQuality: 'low',
      })
        .then((bitmap) => {
          channelRef.current?.postMessage({ type: 'frame', bitmap });
          bitmap.close();
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    }, FRAME_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      shown.detach(video);
    };
  }, [open, shown]);

  if (!open) return null;

  // Muted: the call's own audio already plays in this window. Not hidden with display:none, which
  // browsers may stop decoding for.
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      aria-hidden
      style={{
        position: 'fixed',
        width: 2,
        height: 2,
        opacity: 0,
        pointerEvents: 'none',
        left: 0,
        top: 0,
      }}
    />
  );
}

/** Opens the window (or brings it forward). Call it from the pop out button. */
export function useOpenCallPopout(): () => void {
  const { t } = useTranslation();
  const [, setOpen] = useAtom(callPopoutOpenAtom);
  return () => {
    showCallPopout({
      title: t('voice.popOut'),
      mute: t('voice.mute'),
      unmute: t('voice.unmute'),
      back: t('voice.returnToCall'),
      hangup: t('voice.hangup'),
      noVideo: t('voice.noVideo'),
    })
      .then(() => setOpen(true))
      .catch((err) => console.warn('[calls] could not open the call window', err));
  };
}
