import { useEffect, useCallback, useRef, useState } from 'react';
import { useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { MicrophoneIcon, LinkIcon, ArrowSquareOutIcon, ArrowsInIcon } from '@phosphor-icons/react';
import { voiceStateAtom } from '@/app/store/atoms';
import * as css from './JitsiEmbed.css';

// PIP defaults
const PIP_W = 420;
const PIP_H = 270;
const PIP_BOTTOM = 80;
const PIP_RIGHT = 20;

interface Props {
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onPopOut: () => void;
  onPopIn: () => void;
  onAttachContainer: (el: HTMLDivElement | null) => void;
}

export function JitsiEmbed({ onLeave: _onLeave, onPopOut, onPopIn, onAttachContainer }: Props) {
  const { t } = useTranslation();
  const voiceState = useAtomValue(voiceStateAtom);
  const [embedHeight, setEmbedHeight] = useState(320);
  const [isDragging, setIsDragging] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null); // the persistent iframe container
  const chromeRef = useRef<HTMLDivElement>(null); // PIP chrome overlay

  const roomId = voiceState.roomId;
  const roomName = voiceState.roomName ?? roomId ?? '';
  const isInCall = !!roomId;
  const isPip = voiceState.popOut;

  const handleSlotRef = useCallback(
    (el: HTMLDivElement | null) => {
      (slotRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
      onAttachContainer(el);
    },
    [onAttachContainer]
  );

  useEffect(() => {
    const slot = slotRef.current;
    const chrome = chromeRef.current;
    if (!slot) return;

    if (isPip && isInCall) {
      // Lift the slot out of flow visually via fixed positioning.
      // Use current chrome position if it was already dragged, otherwise defaults.
      const left = chrome ? chrome.offsetLeft : window.innerWidth - PIP_W - PIP_RIGHT;
      const top = chrome ? chrome.offsetTop : window.innerHeight - PIP_H - PIP_BOTTOM;
      slot.style.cssText = [
        'position:fixed',
        `left:${left}px`,
        `top:${top}px`,
        `width:${PIP_W}px`,
        `height:${PIP_H}px`,
        'z-index:1000',
        `border-radius:${getComputedStyle(document.documentElement).getPropertyValue('--radius-md') || '8px'}`,
        'overflow:hidden',
        'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      ].join(';');
    } else {
      // Back to embed: fill the iframeWrap
      slot.style.cssText = 'position:absolute;inset:0;';
    }
  }, [isPip, isInCall]);

  const setupDrag = useCallback(() => {
    const slot = slotRef.current;
    const chrome = chromeRef.current;
    if (!slot || !chrome) return () => {};

    let isDragging = false,
      isResizing = false;
    let startX = 0,
      startY = 0;
    let initLeft = 0,
      initTop = 0;
    let initW = PIP_W,
      initH = PIP_H;

    const syncChromeToSlot = () => {
      chrome.style.left = slot.style.left;
      chrome.style.top = slot.style.top;
      chrome.style.width = slot.style.width;
      chrome.style.height = slot.style.height;
      chrome.style.right = 'auto';
      chrome.style.bottom = 'auto';
    };

    const header = chrome.querySelector<HTMLElement>('[data-drag-handle]');
    const resizeEl = chrome.querySelector<HTMLElement>('[data-resize-handle]');

    const onMouseDown = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest('[data-pip-control]') &&
        !(e.target as HTMLElement).closest('[data-resize-handle]')
      )
        return;

      if (resizeEl?.contains(e.target as Node)) {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        initW = slot.offsetWidth;
        initH = slot.offsetHeight;
        e.preventDefault();
      } else if (header?.contains(e.target as Node)) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initLeft = slot.offsetLeft;
        initTop = slot.offsetTop;
        e.preventDefault();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        const w = Math.max(320, initW + e.clientX - startX);
        const h = Math.max(200, initH + e.clientY - startY);
        slot.style.width = `${w}px`;
        slot.style.height = `${h}px`;
        slot.style.right = 'auto';
        slot.style.bottom = 'auto';
        syncChromeToSlot();
      } else if (isDragging) {
        slot.style.left = `${initLeft + e.clientX - startX}px`;
        slot.style.top = `${initTop + e.clientY - startY}px`;
        slot.style.right = 'auto';
        slot.style.bottom = 'auto';
        syncChromeToSlot();
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      isResizing = false;
    };

    chrome.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      chrome.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!isPip) return;
    return setupDrag();
  }, [isPip, setupDrag]);

  useEffect(() => {
    const chrome = chromeRef.current;
    const slot = slotRef.current;
    if (!isPip || !chrome || !slot) return;
    // Mirror slot's initial fixed position onto the chrome overlay
    chrome.style.left = slot.style.left;
    chrome.style.top = slot.style.top;
    chrome.style.width = slot.style.width;
    chrome.style.height = slot.style.height;
    chrome.style.right = 'auto';
    chrome.style.bottom = 'auto';
  }, [isPip]);

  const copyMeetingUrl = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      const jitsiDomain = voiceState.jitsiDomain;
      if (!jitsiDomain) return;
      const confId = `Matrix-${roomName}-${roomId}`.replace(/[^a-zA-Z0-9-_]/g, '_');
      const url = `https://${jitsiDomain}/${confId}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* ignore */
      }
    },
    [voiceState.jitsiDomain, roomId, roomName]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const startY = e.clientY;
      const startHeight = embedHeight;
      const handleMouseMove = (e: MouseEvent) => {
        const delta = e.clientY - startY;
        const newHeight = Math.max(180, Math.min(startHeight + delta, window.innerHeight * 0.8));
        setEmbedHeight(newHeight);
      };
      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [embedHeight]
  );

  return (
    <>
      {/* ── Embed panel — always in flow, collapses when PIP or not in call ── */}
      <div
        className={isInCall && !isPip ? css.embed : `${css.embed} ${css.embedHidden}`}
        style={{
          height: isInCall && !isPip ? embedHeight : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        aria-hidden={!isInCall || isPip}
      >
        {/* Header (embed mode only) */}
        {isInCall && !isPip && (
          <div className={css.header}>
            <span className={css.headerTitle}>
              <MicrophoneIcon size={14} style={{ opacity: 0.7 }} />
              {roomName}
            </span>
            <div className={css.headerControls}>
              <button
                className={css.headerBtn}
                title={t('voice.copyMeetingLink')}
                onClick={copyMeetingUrl}
                data-pip-control
              >
                <LinkIcon size={14} />
              </button>
              <button
                className={css.headerBtn}
                title={t('voice.popOut')}
                onClick={onPopOut}
                data-pip-control
              >
                <ArrowSquareOutIcon size={14} />
              </button>
            </div>
          </div>
        )}

        {/* The ONLY iframeWrap — the slot never leaves this div */}
        <div className={css.iframeWrap}>
          {/* Slot: always here, CSS-repositioned to fixed when in PIP mode */}
          <div ref={handleSlotRef} style={{ position: 'absolute', inset: 0 }} />
        </div>
        {isInCall && !isPip && <div className={css.resizeBar} onMouseDown={handleResizeStart} />}
      </div>

      {/* ── PIP chrome overlay — sits on top of the CSS-fixed slot ─────────── */}
      {/* Rendered only in PIP mode. Contains header (drag) + resize handle.   */}
      {/* pointerEvents:none on the chrome shell lets clicks reach the iframe;  */}
      {/* header and resize handle re-enable pointer events selectively.        */}
      {isPip && isInCall && (
        <div className={css.pipChrome} ref={chromeRef}>
          <div className={css.pipHeader} data-drag-handle>
            <span className={css.headerTitle}>
              <MicrophoneIcon size={14} style={{ opacity: 0.7 }} />
              {roomName}
            </span>
            <div className={css.headerControls}>
              <button
                className={css.headerBtn}
                title={t('voice.copyMeetingLink')}
                onClick={copyMeetingUrl}
                data-pip-control
              >
                <LinkIcon size={14} />
              </button>
              <button
                className={css.headerBtn}
                title={t('voice.backToChat')}
                onClick={onPopIn}
                data-pip-control
              >
                <ArrowsInIcon size={14} />
              </button>
            </div>
          </div>
          <div className={css.resizeHandle} data-resize-handle />
        </div>
      )}
    </>
  );
}
