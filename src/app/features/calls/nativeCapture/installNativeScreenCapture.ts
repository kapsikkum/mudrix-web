import {
  captureStart,
  captureStop,
  isNativeCaptureAvailable,
  type CaptureStartResult,
} from '@/util/desktop';
import {
  attachCaptureStream,
  closeCaptureStream,
  installCaptureReceiver,
  type CaptureStream,
} from './captureReceiver';
import {
  createNativeTracks,
  isNativeTrackApiSupported,
  type CaptureRealm,
  type NativeTracks,
} from './nativeTracks';
import { requestScreenSharePick } from './screenSharePickerBus';

/** How long to wait for the audio buffer after `capture_start` before sharing without audio. */
const AUDIO_BUFFER_WAIT_MS = 500;

interface Session {
  captureId: string;
  stream: CaptureStream;
  tracks: NativeTracks;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForAudioBuffer(stream: CaptureStream): Promise<void> {
  const deadline = performance.now() + AUDIO_BUFFER_WAIT_MS;
  while (!stream.audioBuffer && !stream.ended && performance.now() < deadline) {
    await sleep(25);
  }
}

/**
 * On the Windows desktop app, replaces `navigator.mediaDevices.getDisplayMedia`: Mudrix's own
 * picker opens, and the returned stream is fed by the native capture instead of WebView2's picker.
 * Does nothing anywhere else. Returns a dispose function that restores it and ends any share still
 * running.
 */
export function installNativeScreenCapture(
  win: CaptureRealm = window as unknown as CaptureRealm
): () => void {
  let disposed = false;
  const sessions = new Set<Session>();
  let cancelPick: (() => void) | null = null;

  const stopSession = (session: Session): void => {
    if (!sessions.delete(session)) return;
    session.stream.onEnded = null;
    captureStop(session.captureId)
      .catch((err) => console.warn('[capture] capture_stop failed', err))
      .finally(() => closeCaptureStream(session.captureId));
  };

  const endSession = (session: Session): void => {
    // `end` fires `ended` on the tracks, and stopping them calls back into stopSession.
    session.tracks.end();
    stopSession(session);
  };

  let restore: (() => void) | null = null;

  const install = (): void => {
    const devices = win.navigator?.mediaDevices;
    if (!devices || !isNativeTrackApiSupported(win) || !installCaptureReceiver()) return;

    const getDisplayMedia = async (
      constraints?: DisplayMediaStreamOptions
    ): Promise<MediaStream> => {
      if (constraints?.video === false) {
        throw new win.TypeError("Failed to execute 'getDisplayMedia': video must be requested");
      }
      const wantAudio = !!constraints?.audio;

      const pick = requestScreenSharePick(wantAudio);
      cancelPick = pick.cancel;
      const choice = await pick.promise;
      cancelPick = null;
      if (!choice) throw new win.DOMException('Permission denied', 'NotAllowedError');
      if (disposed) {
        throw new win.DOMException('The call was closed', 'AbortError');
      }

      let started: CaptureStartResult;
      try {
        started = await captureStart({
          sourceId: choice.source.id,
          maxHeight: choice.maxHeight,
          fps: choice.fps,
          audio: wantAudio && choice.audio,
          cursor: choice.cursor,
        });
      } catch (err) {
        console.warn('[capture] capture_start failed', err);
        throw new win.DOMException(
          err instanceof Error ? err.message : String(err),
          'NotReadableError'
        );
      }

      const stream = attachCaptureStream(started.captureId);
      const abort = (message: string): never => {
        stream.onFrame = null;
        captureStop(started.captureId)
          .catch(() => {})
          .finally(() => closeCaptureStream(started.captureId));
        throw new win.DOMException(message, 'NotReadableError');
      };
      if (stream.ended) abort('The shared window or screen closed');
      if (wantAudio && choice.audio) await waitForAudioBuffer(stream);
      if (disposed) abort('The call was closed');

      let session: Session | null = null;
      let tracks: NativeTracks;
      try {
        tracks = createNativeTracks(
          win,
          stream,
          {
            width: started.width,
            height: started.height,
            fps: choice.fps,
            kind: choice.source.kind,
            cursor: choice.cursor,
          },
          wantAudio && choice.audio,
          () => {
            if (session) stopSession(session);
          }
        );
      } catch (err) {
        console.warn('[capture] could not create tracks', err);
        return abort('Could not create the capture tracks');
      }
      session = { captureId: started.captureId, stream, tracks };
      sessions.add(session);
      const created = session;
      stream.onEnded = () => {
        sessions.delete(created);
        tracks.end();
      };
      if (stream.ended) {
        sessions.delete(created);
        tracks.end();
      }
      return tracks.stream;
    };

    const original = Object.getOwnPropertyDescriptor(devices, 'getDisplayMedia');
    Object.defineProperty(devices, 'getDisplayMedia', {
      configurable: true,
      writable: true,
      value: getDisplayMedia,
    });
    const onPageHide = () => sessions.forEach(endSession);
    win.addEventListener('pagehide', onPageHide);
    restore = () => {
      win.removeEventListener('pagehide', onPageHide);
      if (original) Object.defineProperty(devices, 'getDisplayMedia', original);
      else delete (devices as { getDisplayMedia?: unknown }).getDisplayMedia;
    };
  };

  void isNativeCaptureAvailable().then((available) => {
    if (!available || disposed) return;
    try {
      install();
    } catch (err) {
      console.warn('[capture] could not install the native screen capture', err);
    }
  });

  return () => {
    disposed = true;
    cancelPick?.();
    sessions.forEach(endSession);
    restore?.();
  };
}
