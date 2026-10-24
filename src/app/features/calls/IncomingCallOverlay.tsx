import { useCallback, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PhoneIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import type { MatrixClient } from 'matrix-js-sdk';
import * as css from './IncomingCallOverlay.css';

const POSITION_KEY = 'mudrix.incomingCallPosition';
const EDGE = 8;

interface Position {
  x: number;
  y: number;
}

/** Keep the whole dialog on screen, e.g. after the window shrank since it was placed. */
function clampToViewport(pos: Position, el: HTMLElement | null): Position {
  const w = el?.offsetWidth ?? 300;
  const h = el?.offsetHeight ?? 260;
  return {
    x: Math.min(Math.max(EDGE, pos.x), Math.max(EDGE, window.innerWidth - w - EDGE)),
    y: Math.min(Math.max(EDGE, pos.y), Math.max(EDGE, window.innerHeight - h - EDGE)),
  };
}

function loadPosition(): Position | null {
  try {
    const raw = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null');
    return raw && typeof raw.x === 'number' && typeof raw.y === 'number' ? raw : null;
  } catch {
    return null;
  }
}

function savePosition(pos: Position): void {
  try {
    localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
  } catch {
    // storage unavailable: it just opens centred next time
  }
}

/** Phones show the ring full screen, so there is nothing to drag. */
const isFullScreenRing = () => window.matchMedia('(max-width: 768px)').matches;

interface Props {
  callerName: string;
  callerId: string;
  client: MatrixClient;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallOverlay({ callerName, callerId, client, onAccept, onDecline }: Props) {
  const { t } = useTranslation();
  const user = client.getUser(callerId);
  const avatarMxc = user?.avatarUrl ?? null;

  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(() => {
    const saved = loadPosition();
    return saved ? clampToViewport(saved, null) : null;
  });
  const drag = useRef<{ dx: number; dy: number; id: number } | null>(null);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.button !== 0 || isFullScreenRing()) return;
    if ((e.target as Element).closest('button')) return;
    const rect = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, id: e.pointerId };
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setPosition(clampToViewport({ x: e.clientX - d.dx, y: e.clientY - d.dy }, ref.current));
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      drag.current = null;
      if (ref.current) ref.current.style.cursor = '';
      if (position) savePosition(position);
    },
    [position]
  );

  const placed: CSSProperties | undefined =
    position && !isFullScreenRing()
      ? { left: position.x, top: position.y, transform: 'none' }
      : undefined;

  return (
    <div
      ref={ref}
      style={placed}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={css.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      aria-describedby="incoming-call-note"
    >
      <div className={css.ringIdentity}>
        <div className={css.ringAvatar}>
          <Avatar
            name={callerName}
            mxcUrl={avatarMxc}
            client={client}
            size="fill"
            placeholder="logo"
          />
        </div>
        <div id="incoming-call-title" className={css.ringName}>
          {callerName}
        </div>
        <div id="incoming-call-note" className={css.ringNote}>
          {t('voice.isCallingYou')}
        </div>
      </div>
      <div className={css.actions}>
        <div className={css.action}>
          <button
            type="button"
            className={css.btnDecline}
            onClick={onDecline}
            aria-label={t('voice.decline')}
          >
            <PhoneIcon size={24} weight="fill" className={css.iconRotated} />
          </button>
          <span aria-hidden="true">{t('voice.declineShort')}</span>
        </div>
        <div className={css.action}>
          <button
            type="button"
            className={css.btnAccept}
            onClick={onAccept}
            aria-label={t('voice.accept')}
          >
            <PhoneIcon size={24} weight="fill" />
          </button>
          <span aria-hidden="true">{t('voice.pickUp')}</span>
        </div>
      </div>
    </div>
  );
}
