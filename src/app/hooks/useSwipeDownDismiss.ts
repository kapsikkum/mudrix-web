import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  enabled: boolean;
  /** The sheet that follows the finger. */
  sheetRef: RefObject<HTMLElement | null>;
  /** The scrolling content; a drag only takes over while this is at its top. */
  scrollRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const CLOSE_DISTANCE = 110;
const CLOSE_VELOCITY = 0.6; // px per ms

/**
 * Bottom-sheet behaviour: dragging down from the top of the sheet moves it with the finger and
 * dismisses it past a distance (or a quick flick); otherwise it springs back.
 */
export function useSwipeDownDismiss({ enabled, sheetRef, scrollRef, onClose }: Options) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!enabled || !sheet) return undefined;
    let startY = 0;
    let startT = 0;
    let dragging = false;
    let armed = false;

    const reset = (animate: boolean) => {
      sheet.style.transition = animate ? 'transform 200ms ease' : 'none';
      sheet.style.transform = '';
    };

    const onStart = (e: TouchEvent) => {
      dragging = false;
      armed = e.touches.length === 1 && (scrollRef.current?.scrollTop ?? 0) <= 0;
      startY = e.touches[0].clientY;
      startT = Date.now();
    };

    const onMove = (e: TouchEvent) => {
      if (!armed) return;
      const dy = e.touches[0].clientY - startY;
      if (!dragging) {
        if (dy < -4) {
          armed = false; // scrolling up through the content
          return;
        }
        if (dy > 8 && (scrollRef.current?.scrollTop ?? 0) <= 0) dragging = true;
        else return;
      }
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
    };

    const onEnd = (e: TouchEvent) => {
      if (!dragging) return;
      dragging = false;
      armed = false;
      const dy = e.changedTouches[0].clientY - startY;
      const velocity = dy / Math.max(1, Date.now() - startT);
      if (dy > CLOSE_DISTANCE || (dy > 40 && velocity > CLOSE_VELOCITY)) {
        sheet.style.transition = 'transform 180ms ease';
        sheet.style.transform = 'translateY(110%)';
        window.setTimeout(() => closeRef.current(), 160);
      } else {
        reset(true);
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: true });
    sheet.addEventListener('touchend', onEnd, { passive: true });
    sheet.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, sheetRef, scrollRef]);
}
