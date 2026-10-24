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
import {
  elementCallActionsAtom,
  elementCallEmbedAtom,
  elementCallUiAtom,
} from '@/app/store/atoms/elementCall';
import { isTauriDesktop } from '@/util/desktop';

/**
 * Desktop "pop out": a real window of its own (Document Picture-in-Picture, always on top), not a
 * tile inside the app. The call itself stays in the main window (moving the Element Call iframe
 * would reload it and drop the call), so this window mirrors its video: the screen share if
 * there is one, otherwise the first participant with video.
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

const MIRROR_POLL_MS = 1000;

function pickStream(doc: Document | null | undefined): MediaStream | null {
  if (!doc) return null;
  const withVideo = (video: HTMLVideoElement | null) => {
    const stream = video?.srcObject;
    return stream instanceof (doc.defaultView?.MediaStream ?? MediaStream) &&
      (stream as MediaStream).getVideoTracks().some((t) => t.readyState === 'live')
      ? (stream as MediaStream)
      : null;
  };
  const screen = withVideo(doc.querySelector<HTMLVideoElement>('[data-mx-screen] video'));
  if (screen) return screen;
  for (const video of doc.querySelectorAll<HTMLVideoElement>('[data-mx-tile] video')) {
    const stream = withVideo(video);
    if (stream) return stream;
  }
  return null;
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
  const embed = useAtomValue(elementCallEmbedAtom);
  const ui = useAtomValue(elementCallUiAtom);
  const actions = useAtomValue(elementCallActionsAtom);
  const videoRef = useRef<HTMLVideoElement>(null);
  const emptyRef = useRef<HTMLDivElement>(null);

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
  const open = !!win && !!embed && ui.presentation === 'tile';
  useEffect(() => {
    if (win && !open) {
      setWin(null);
      win.close();
    }
  }, [win, open, setWin]);

  useEffect(() => {
    if (!open) return undefined;
    const sync = () => {
      const video = videoRef.current;
      if (!video) return;
      const stream = pickStream(embed?.document);
      if (video.srcObject !== stream) {
        video.srcObject = stream;
        if (stream) video.play().catch(() => {});
      }
      if (emptyRef.current) emptyRef.current.style.display = stream ? 'none' : 'flex';
      video.style.display = stream ? 'block' : 'none';
    };
    sync();
    const timer = window.setInterval(sync, MIRROR_POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, embed]);

  if (!win || !open) return null;

  const micTitle = ui.isMuted ? t('voice.unmute') : t('voice.mute');
  return createPortal(
    <div style={css(s.root)}>
      {/* Muted: the call's own audio already plays in the main window. */}
      <video ref={videoRef} style={css(s.video)} autoPlay playsInline muted />
      <div ref={emptyRef} style={css(s.empty)}>
        {t('voice.noVideo')}
      </div>
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
