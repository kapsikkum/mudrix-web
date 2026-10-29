import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import {
  ArrowSquareInIcon,
  MicrophoneIcon,
  MicrophoneSlashIcon,
  PhoneXIcon,
} from '@phosphor-icons/react';
import { callActionsAtom, callSessionAtom, callUiAtom } from '@/app/store/atoms/call';
import { isTauriDesktop } from '@/util/desktop';
import { useCallSnapshot } from './stage/useCallSnapshot';

/**
 * Desktop "pop out": a real window of its own (Document Picture-in-Picture, always on top), not a
 * tile inside the app. The call itself stays in the main window, so this window mirrors its video:
 * the screen share if there is one, otherwise the first participant with video.
 */
export const callPopoutWindowAtom = atom<Window | null>(null);

interface DocumentPictureInPicture {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

function documentPip(): DocumentPictureInPicture | null {
  return (
    (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture })
      .documentPictureInPicture ?? null
  );
}

export function canOpenCallPopoutWindow(): boolean {
  return isTauriDesktop() && documentPip() !== null;
}

/** Must be called from a click handler (the browser requires a user gesture). */
export async function openCallPopoutWindow(): Promise<Window | null> {
  const pip = documentPip();
  if (!pip) return null;
  const win = await pip.requestWindow({ width: 480, height: 300 });
  // Same styles and theme as the app.
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    win.document.head.appendChild(node.cloneNode(true));
  });
  Array.from(document.documentElement.attributes).forEach((attr) => {
    win.document.documentElement.setAttribute(attr.name, attr.value);
  });
  win.document.body.className = document.body.className;
  win.document.title = document.title;
  return win;
}

const s = {
  root: 'position:fixed;inset:0;display:flex;flex-direction:column;background:#000;color:#fff;',
  video: 'flex:1;min-height:0;width:100%;object-fit:contain;background:#000;',
  empty:
    'flex:1;display:flex;align-items:center;justify-content:center;opacity:.6;font:14px sans-serif;',
  bar: 'display:flex;justify-content:center;gap:8px;padding:8px;background:rgba(20,20,22,.95);',
  btn: 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;border:0;border-radius:10px;cursor:pointer;color:#fff;background:#2b2d31;',
  danger: 'background:#da373c;',
};

function css(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split(';')
      .filter(Boolean)
      .map((rule) => {
        const [k, ...v] = rule.split(':');
        return [k.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()), v.join(':')];
      })
  );
}

export function CallPopoutWindow() {
  const { t } = useTranslation();
  const [win, setWin] = useAtom(callPopoutWindowAtom);
  const session = useAtomValue(callSessionAtom);
  const snapshot = useCallSnapshot();
  const ui = useAtomValue(callUiAtom);
  const actions = useAtomValue(callActionsAtom);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Closing the window (its own close button) returns the call to the app.
  useEffect(() => {
    if (!win) return undefined;
    const onClose = () => {
      setWin(null);
      actions?.setPresentation('room');
    };
    win.addEventListener('pagehide', onClose);
    return () => win.removeEventListener('pagehide', onClose);
  }, [win, setWin, actions]);

  // The call ended or was brought back into the app: close the window.
  const open = !!win && !!session && ui.presentation === 'tile';
  useEffect(() => {
    if (win && !open) {
      setWin(null);
      win.close();
    }
  }, [win, open, setWin]);

  // The screen share if there is one, otherwise the first camera.
  const shown =
    snapshot?.participants.find((p) => p.screenTrack && !p.isLocal)?.screenTrack ??
    snapshot?.participants.find((p) => p.cameraTrack && !p.isLocal)?.cameraTrack ??
    snapshot?.participants.find((p) => p.cameraTrack)?.cameraTrack ??
    null;

  useEffect(() => {
    const video = videoRef.current;
    if (!open || !video || !shown) return undefined;
    shown.attach(video);
    return () => {
      shown.detach(video);
    };
  }, [open, shown]);

  if (!win || !open) return null;

  const micTitle = ui.isMuted ? t('voice.unmute') : t('voice.mute');
  return createPortal(
    <div style={css(s.root)}>
      {/* Muted: the call's own audio already plays in the main window. */}
      <video
        ref={videoRef}
        style={css(s.video + (shown ? '' : 'display:none;'))}
        autoPlay
        playsInline
        muted
      />
      {!shown && <div style={css(s.empty)}>{t('voice.noVideo')}</div>}
      <div style={css(s.bar)}>
        <button
          type="button"
          style={css(s.btn)}
          title={micTitle}
          aria-label={micTitle}
          onClick={() => actions?.toggleMute()}
        >
          {ui.isMuted ? <MicrophoneSlashIcon size={20} /> : <MicrophoneIcon size={20} />}
        </button>
        <button
          type="button"
          style={css(s.btn)}
          title={t('voice.returnToCall')}
          aria-label={t('voice.returnToCall')}
          onClick={() => {
            actions?.setPresentation('room');
            window.focus();
          }}
        >
          <ArrowSquareInIcon size={20} />
        </button>
        <button
          type="button"
          style={css(s.btn + s.danger)}
          title={t('voice.hangup')}
          aria-label={t('voice.hangup')}
          onClick={() => actions?.hangup()}
        >
          <PhoneXIcon size={20} />
        </button>
      </div>
    </div>,
    win.document.body
  );
}
