import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import type { MatrixClient } from 'matrix-js-sdk';
import { CaretDownIcon, SpeakerHighIcon } from '@phosphor-icons/react';
import {
  callDedicatedScreenAtom,
  callActionsAtom,
  callEffectiveViewAtom,
  callSessionAtom,
  callIsVoiceRoomAtom,
  callUiAtom,
} from '@/app/store/atoms/call';
import type { CallPresentation, CallView } from '@/app/store/atoms/call';
import { useCallContainer } from '@/app/features/calls/CallContainer';
import { useIncomingCall } from './useIncomingCall';
import { useCallSounds } from './useCallSounds';
import { useSoundboardReceiver } from '@/app/features/soundboard/useSoundboardReceiver';
import { IncomingCallOverlay } from './IncomingCallOverlay';
import { CallControlBar } from './CallControlBar';
import { CallReactionsRail } from './CallReactionsRail';
import { CallStage } from './stage/CallStage';
import { ScreenShareNotice } from './ScreenShareNotice';
import { ScreenSharePicker } from './ScreenSharePicker';
import { CallPopoutWindow, callPopoutOpenAtom } from './CallPopoutWindow';
import { OutgoingCallScreen } from './OutgoingCallScreen';
import { useOutgoingCallState } from './useOutgoingCallState';
import * as controlsCss from './CallControlBar.css';
import * as css from './ElementCallLayer.css';
import { EMBED_HEADER_HEIGHT } from './ElementCallLayer.css';

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
  // On a phone the call takes most of the screen and the chat keeps a small strip at the bottom;
  // the resize bar moves that split.
  if (window.innerWidth <= 768) return Math.round(window.innerHeight * 0.76);
  return Math.max(
    MIN_EMBED_HEIGHT,
    Math.min(width / RATIO_W_TO_H, Math.round(window.innerHeight * MAX_EMBED_HEIGHT_FRACTION))
  );
}

const PIP_W = 420;
const PIP_H = 270;
const PIP_BOTTOM = 88;
const PIP_RIGHT = 24;

/** Floating-window size and margins; mirrors the phone override in ElementCallLayer.css.ts. */
function pipMetrics() {
  const phone = window.innerWidth <= 768;
  const w = phone ? Math.min(PIP_W, window.innerWidth - 24) : PIP_W;
  const h = phone ? Math.min(PIP_H, Math.round(w * 0.64)) : PIP_H;
  return { w, h, right: phone ? 12 : PIP_RIGHT, bottom: phone ? 72 : PIP_BOTTOM };
}

function defaultPipPos() {
  const m = pipMetrics();
  return {
    x: window.innerWidth - m.w - m.right,
    y: window.innerHeight - m.h - m.bottom,
  };
}

export function ElementCallLayer({ client }: Props) {
  const { t } = useTranslation();
  const ui = useAtomValue(callUiAtom);
  const callSession = useAtomValue(callSessionAtom);
  const setUi = useSetAtom(callUiAtom);
  const { containerRef } = useCallContainer();

  const { accept, dismiss } = useIncomingCall(client);
  useCallSounds(client);
  useSoundboardReceiver(client);

  const inCall = ui.roomId !== null;
  const view = useAtomValue(callEffectiveViewAtom);
  const dedicatedScreen = useAtomValue(callDedicatedScreenAtom);
  const isVoiceRoomCall = useAtomValue(callIsVoiceRoomAtom);
  const isHidden = view === 'hidden';
  const isPip = view === 'tile';
  const isFullscreen = view === 'fullscreen';
  const isDocked = view === 'docked';
  // Phones and tablets: the fullscreen call has a header of its own, with a way to minimize it.
  const isDedicatedScreen = isFullscreen && dedicatedScreen;
  const popoutWindow = useAtomValue(callPopoutOpenAtom);

  // Popped out into its own window (desktop): the in-app tile steps aside but keeps running.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    el.style.visibility = isPip && popoutWindow ? 'hidden' : '';
    return () => {
      el.style.visibility = '';
    };
  }, [containerRef, isPip, popoutWindow]);

  const joined = ui.phase === 'joined';
  const roomName = callSession?.matrixRoom.name ?? ui.roomId ?? '';
  const actions = useAtomValue(callActionsAtom);
  const { ringing } = useOutgoingCallState(client);
  const showOutgoing = inCall && !isHidden && ringing && !!client && ui.roomId !== null;

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const [embedHeight, setEmbedHeight] = useState(DEFAULT_EMBED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);

  const pipPosRef = useRef<{ x: number; y: number } | null>(null);
  const cancelCollapseRef = useRef<(() => void) | null>(null);
  const defaultHeightRef = useRef<number | null>(null);
  const userResizedRef = useRef(false);
  const lastViewRef = useRef<CallView>('hidden');
  const cancelSnapRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef(false);

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

    const previousView = lastViewRef.current;
    lastViewRef.current = view;
    const instant =
      previousView !== view &&
      [previousView, view].some((v) => v === 'hidden' || v === 'fullscreen');
    const pendingSnap = cancelSnapRef.current;
    cancelSnapRef.current = null;
    if (instant) {
      el.style.transition = 'none';
      const restore = () => {
        cancelSnapRef.current = null;
        if (draggingRef.current) return;
        el.style.transition = '';
      };
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(restore);
      });
      cancelSnapRef.current = () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    } else if (pendingSnap && !draggingRef.current) {
      el.style.transition = '';
    }

    if (!inCall) {
      if (previousView === 'hidden') {
        // The call wasn't on screen, so there is nothing to collapse.
        el.classList.remove(css.embedContainerActive, css.pip, css.fullscreen);
        el.style.left = '';
        el.style.top = '';
        el.style.right = '';
        el.style.bottom = '';
        el.style.height = '0px';
        el.style.paddingTop = '0px';
        return;
      }
      el.classList.add(css.embedContainerActive);
      el.classList.remove(css.pip, css.fullscreen);
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.height = '0px';
      el.style.paddingTop = '0px';

      let cancelled = false;
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        el.classList.remove(css.embedContainerActive, css.pip, css.fullscreen);
        cancelCollapseRef.current = null;
      }, 320);
      cancelCollapseRef.current = () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
      return;
    }

    if (isHidden) {
      el.classList.remove(css.embedContainerActive, css.fullscreen);
      el.classList.add(css.pip);
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.height = '';
      el.style.paddingTop = '0px';
      return;
    }

    el.classList.add(css.embedContainerActive);
    if (isFullscreen) {
      el.classList.remove(css.pip);
      el.classList.add(css.fullscreen);
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.height = '';
      el.style.paddingTop = isDedicatedScreen ? `${EMBED_HEADER_HEIGHT}px` : '0px';
    } else if (isPip) {
      el.classList.remove(css.fullscreen);
      el.classList.add(css.pip);
      el.style.height = '';
      el.style.paddingTop = '0px';
      const pos = pipPosRef.current ?? defaultPipPos();
      pipPosRef.current = pos;
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    } else {
      el.classList.remove(css.pip, css.fullscreen);
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      el.style.paddingTop = `${EMBED_HEADER_HEIGHT}px`;
      if (defaultHeightRef.current === null) {
        defaultHeightRef.current = computeEmbedDefaultHeight(el);
      }
      const targetHeight = userResizedRef.current ? embedHeight : defaultHeightRef.current;
      el.style.height = `${targetHeight}px`;
      if (embedHeight !== targetHeight) setEmbedHeight(targetHeight);
    }
  }, [inCall, view, isHidden, isPip, isFullscreen, isDedicatedScreen, embedHeight, containerRef]);

  useEffect(() => {
    return () => {
      cancelCollapseRef.current?.();
      cancelSnapRef.current?.();
    };
  }, []);

  const showPresentation = useCallback(
    (next: CallPresentation) => {
      setUi((prev) => ({ ...prev, presentation: next }));
    },
    [setUi]
  );

  useEffect(() => {
    if (!isFullscreen || isVoiceRoomCall) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"]'
        )
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;
      showPresentation('room');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, isVoiceRoomCall, showPresentation]);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (view !== 'docked') return;
      e.preventDefault();
      userResizedRef.current = true;
      setIsDragging(true);
      const el = containerRef.current;
      if (el) el.style.transition = 'none';
      draggingRef.current = true;
      const startY = e.clientY;
      const startHeight = embedHeight;
      // Pointer events so the same drag works with a finger as with a mouse.
      const maxFraction = window.innerWidth <= 768 ? 0.88 : 0.8;
      const handleMove = (ev: PointerEvent) => {
        const delta = ev.clientY - startY;
        const newHeight = Math.max(
          120,
          Math.min(startHeight + delta, window.innerHeight * maxFraction)
        );
        setEmbedHeight(newHeight);
      };
      const handleUp = () => {
        setIsDragging(false);
        draggingRef.current = false;
        if (el) el.style.transition = '';
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
        document.removeEventListener('pointercancel', handleUp);
      };
      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
      document.addEventListener('pointercancel', handleUp);
    },
    [embedHeight, view, containerRef]
  );

  const handlePipDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!isPip) return;
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startPos = pipPosRef.current ?? defaultPipPos();
      pipPosRef.current = startPos;
      const handleMouseMove = (ev: MouseEvent) => {
        const x = Math.max(
          0,
          Math.min(ev.clientX - (startX - startPos.x), window.innerWidth - pipMetrics().w)
        );
        const y = Math.max(
          0,
          Math.min(ev.clientY - (startY - startPos.y), window.innerHeight - pipMetrics().h)
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
      {isDocked &&
        containerEl &&
        createPortal(
          <div className={css.embedHeader}>
            <span className={css.embedHeaderTitle}>
              <SpeakerHighIcon size={14} className={css.embedHeaderIcon} />
              {roomName}
            </span>
          </div>,
          containerEl
        )}

      {isDedicatedScreen &&
        containerEl &&
        createPortal(
          <div className={css.embedHeader}>
            <button
              type="button"
              className={css.embedHeaderButton}
              onClick={() => showPresentation('tile')}
              aria-label={t('voice.minimizeCall')}
            >
              <CaretDownIcon size={20} />
            </button>
            <span className={css.embedHeaderTitle}>
              <SpeakerHighIcon size={14} className={css.embedHeaderIcon} />
              {roomName}
            </span>
          </div>,
          containerEl
        )}

      {isPip &&
        containerEl &&
        createPortal(
          <div className={css.pipNav} onMouseDown={handlePipDragStart}>
            <span className={css.pipNavTitle}>
              <SpeakerHighIcon size={14} />
              {roomName}
            </span>
          </div>,
          containerEl
        )}

      {isDocked &&
        containerEl &&
        createPortal(
          <>
            {isDragging && <div className={css.dragOverlay} />}
            <div
              className={css.resizeBar}
              onPointerDown={handleResizeStart}
              style={{ transition: isDragging ? 'none' : undefined }}
            />
          </>,
          containerEl
        )}

      {inCall &&
        callSession &&
        !isHidden &&
        !showOutgoing &&
        containerEl &&
        createPortal(<CallStage />, containerEl)}

      {inCall &&
        joined &&
        !isHidden &&
        !showOutgoing &&
        containerEl &&
        createPortal(
          <div className={controlsCss.controlsLayer}>
            <CallControlBar />
            <CallReactionsRail />
          </div>,
          containerEl
        )}

      {inCall &&
        joined &&
        ui.isScreenSharing &&
        !isHidden &&
        !isPip &&
        !showOutgoing &&
        containerEl &&
        createPortal(<ScreenShareNotice />, containerEl)}

      {showOutgoing &&
        client &&
        ui.roomId &&
        containerEl &&
        createPortal(
          <OutgoingCallScreen
            client={client}
            roomId={ui.roomId}
            onHangup={() => actions?.hangup()}
          />,
          containerEl
        )}

      {inCall &&
        !isHidden &&
        !joined &&
        !showOutgoing &&
        containerEl &&
        createPortal(
          <div className={css.joiningOverlay}>
            <div className={css.joiningSpinner} />
            <span>{t('voice.statusConnecting')}</span>
          </div>,
          containerEl
        )}

      <ScreenSharePicker />
      <CallPopoutWindow />

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
