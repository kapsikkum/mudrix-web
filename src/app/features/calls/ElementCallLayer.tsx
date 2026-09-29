import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { PhoneIcon, ArrowSquareOutIcon, ArrowsInIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { elementCallEmbedAtom, elementCallUiAtom } from '@/app/store/atoms/elementCall';
import { themeAtom } from '@/app/store/atoms/settings';
import { getElementCallThemeKind } from '@/app/plugins/call/useCallEmbed';
import { useElementCallContainer } from '@/app/plugins/call/CallEmbedProvider';
import { useIncomingElementCall } from './useIncomingElementCall';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import * as css from './ElementCallLayer.css';

interface Props {
  client: MatrixClient | null;
}

const DEFAULT_EMBED_HEIGHT = 360;
const RATIO_W_TO_H = 16 / 9;
const MIN_EMBED_HEIGHT = 280;
const MAX_EMBED_HEIGHT_FRACTION = 0.5;

function computeEmbedDefaultHeight(el: HTMLElement): number {
  const width = el.clientWidth;
  if (width <= 0) return DEFAULT_EMBED_HEIGHT;
  return Math.max(
    MIN_EMBED_HEIGHT,
    Math.min(width / RATIO_W_TO_H, Math.round(window.innerHeight * MAX_EMBED_HEIGHT_FRACTION))
  );
}

const PIP_W = 420;
const PIP_H = 270;
const PIP_BOTTOM = 88;
const PIP_RIGHT = 24;

export function ElementCallLayer({ client }: Props) {
  const { t } = useTranslation();
  const ui = useAtomValue(elementCallUiAtom);
  const embed = useAtomValue(elementCallEmbedAtom);
  const theme = useAtomValue(themeAtom);
  const setUi = useSetAtom(elementCallUiAtom);
  const { containerRef } = useElementCallContainer();

  const { accept, dismiss } = useIncomingElementCall(client);

  const inCall = ui.roomId !== null;
  const isPip = inCall && ui.popOut;

  const joined = ui.phase === 'joined';
  const roomName = embed?.room.name ?? ui.roomId ?? '';

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [embedHeight, setEmbedHeight] = useState(DEFAULT_EMBED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);

  const pipPosRef = useRef<{ x: number; y: number } | null>(null);
  const cancelCollapseRef = useRef<(() => void) | null>(null);
  const defaultHeightRef = useRef<number | null>(null);
  const userResizedRef = useRef(false);

  // Grab the container element once mounted so we can portal chrome into it.
  useEffect(() => {
    setContainerEl(containerRef.current);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Cancel any pending collapse so a re-join expands cleanly from 0.
    cancelCollapseRef.current?.();
    cancelCollapseRef.current = null;

    if (!inCall) {
      el.classList.add(css.embedContainerActive);
      el.classList.remove(css.pip);
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.height = '0px';

      let cancelled = false;
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        el.classList.remove(css.embedContainerActive, css.pip);
        cancelCollapseRef.current = null;
      }, 320);
      cancelCollapseRef.current = () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
      return;
    }

    el.classList.add(css.embedContainerActive);
    if (isPip) {
      el.classList.add(css.pip);
      el.style.height = '';
      const pos = pipPosRef.current ?? {
        x: window.innerWidth - PIP_W - PIP_RIGHT,
        y: window.innerHeight - PIP_H - PIP_BOTTOM,
      };
      pipPosRef.current = pos;
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    } else {
      el.classList.remove(css.pip);
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      if (defaultHeightRef.current === null) {
        defaultHeightRef.current = computeEmbedDefaultHeight(el);
      }
      const targetHeight = userResizedRef.current ? embedHeight : defaultHeightRef.current;
      el.style.height = `${targetHeight}px`;
      if (embedHeight !== targetHeight) setEmbedHeight(targetHeight);
    }
  }, [inCall, isPip, embedHeight, containerRef]);

  useEffect(() => {
    return () => {
      cancelCollapseRef.current?.();
    };
  }, []);

  useEffect(() => {
    if (embed) embed.setTheme(getElementCallThemeKind(theme));
  }, [embed, theme]);

  const togglePopOut = useCallback(() => {
    setUi((prev) => ({ ...prev, popOut: !prev.popOut }));
  }, [setUi]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (isPip) return;
      e.preventDefault();
      userResizedRef.current = true;
      setIsDragging(true);
      const el = containerRef.current;
      if (el) el.style.transition = 'none';
      const startY = e.clientY;
      const startHeight = embedHeight;
      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        const newHeight = Math.max(120, Math.min(startHeight + delta, window.innerHeight * 0.8));
        setEmbedHeight(newHeight);
      };
      const handleMouseUp = () => {
        setIsDragging(false);
        if (el) el.style.transition = '';
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [embedHeight, isPip, containerRef]
  );

  const handlePipDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isPip) return;
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = pipPosRef.current ?? {
        x: window.innerWidth - PIP_W - PIP_RIGHT,
        y: window.innerHeight - PIP_H - PIP_BOTTOM,
      };
      pipPosRef.current = startPos;
      const handleMouseMove = (ev: MouseEvent) => {
        const x = Math.max(
          0,
          Math.min(ev.clientX - (startX - startPos.x), window.innerWidth - PIP_W)
        );
        const y = Math.max(
          0,
          Math.min(ev.clientY - (startY - startPos.y), window.innerHeight - PIP_H)
        );
        pipPosRef.current = { x, y };
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      };
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isPip, containerRef]
  );

  return (
    <>
      {inCall &&
        !isPip &&
        containerEl &&
        createPortal(
          <div className={css.embedHeader}>
            <span className={css.embedHeaderTitle}>
              <PhoneIcon size={14} />
              {roomName}
            </span>
            <Tooltip content={t('voice.popOut')}>
              <button
                type="button"
                className={css.embedHeaderBtn}
                aria-label={t('voice.popOut')}
                onClick={togglePopOut}
              >
                <ArrowSquareOutIcon size={14} />
              </button>
            </Tooltip>
          </div>,
          containerEl
        )}

      {inCall &&
        isPip &&
        containerEl &&
        createPortal(
          <div className={css.pipNav} onMouseDown={handlePipDragStart}>
            <span className={css.pipNavTitle}>
              <PhoneIcon size={14} />
              {roomName}
            </span>
            <Tooltip content={t('voice.backToChat')}>
              <button
                type="button"
                className={css.pipNavBtn}
                aria-label={t('voice.backToChat')}
                onClick={togglePopOut}
              >
                <ArrowsInIcon size={14} />
              </button>
            </Tooltip>
          </div>,
          containerEl
        )}

      {inCall &&
        !isPip &&
        containerEl &&
        createPortal(
          <>
            {isDragging && <div className={css.dragOverlay} />}
            <div
              className={css.resizeBar}
              onMouseDown={handleResizeStart}
              style={{ transition: isDragging ? 'none' : undefined }}
            />
          </>,
          containerEl
        )}

      {inCall &&
        !joined &&
        containerEl &&
        createPortal(
          <div className={css.joiningOverlay}>
            <div className={css.joiningSpinner} />
            <span>{t('voice.statusConnecting')}</span>
          </div>,
          containerEl
        )}

      {ui.incoming && client && (
        <IncomingCallOverlay
          callerName={ui.incoming.callerName}
          callerId={ui.incoming.callerId}
          client={client}
          onAccept={() => accept(ui.incoming!)}
          onDecline={dismiss}
        />
      )}
    </>
  );
}
