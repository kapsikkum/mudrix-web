import { useEffect, useRef, type RefObject } from 'react';

interface Options {
  enabled: boolean;
  /** The sheet that follows the finger. */
  sheetRef: RefObject<HTMLElement | null>;
  /** Extra scroller to respect; scrollers between the touch and the sheet are checked anyway. */
  scrollRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

const START_SLOP = 8; // px before a touch counts as a drag
const CLOSE_FRACTION = 0.4; // dragged past this share of the sheet's height: close
const FLICK_VELOCITY = 0.5; // px per ms; a downward flick faster than this closes
const FLICK_MIN_DISTANCE = 24;
const VELOCITY_WINDOW = 100; // ms of recent movement that counts as "how fast it ended"
const SPRING = 'transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1)';

/** Whether a scroller between the touch and the sheet is scrolled away from its top. */
function scrolledAway(from: EventTarget | null, sheet: HTMLElement): boolean {
  let el = from instanceof HTMLElement ? from : null;
  while (el && el !== sheet) {
    const { overflowY } = getComputedStyle(el);
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 1 &&
      el.scrollTop > 0
    ) {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** The sheet's current vertical offset, including one that a transition is part-way through. */
function currentOffset(sheet: HTMLElement): number {
  const { transform } = getComputedStyle(sheet);
  if (!transform || transform === 'none') return 0;
  return new DOMMatrixReadOnly(transform).m42;
}

/**
 * Bottom-sheet behaviour. The sheet follows the finger down and back up, and a drag picks up
 * wherever the sheet currently is, so it can be caught mid-animation. Letting go past 40% of its
 * height, or flicking down, carries it the rest of the way off screen at the speed of the flick
 * and then calls `onClose`; anything less springs back. Only one motion runs at a time: touching
 * the sheet finishes any entrance animation and cancels a spring in flight, and a sheet that is
 * already leaving ignores touches.
 */
export function useSwipeDownDismiss({ enabled, sheetRef, scrollRef, onClose }: Options) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!enabled || !sheet) return undefined;

    let startY = 0;
    let startOffset = 0;
    let samples: { y: number; t: number }[] = [];
    let dragging = false;
    let armed = false;
    let leaving = false;
    let timer: number | undefined;

    const clearStyles = () => {
      sheet.style.transition = '';
      sheet.style.transform = '';
    };

    /** Runs `done` when the transform transition ends (or shortly after, if it never fires). */
    const afterTransition = (ms: number, done: () => void) => {
      window.clearTimeout(timer);
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        sheet.removeEventListener('transitionend', onEnd);
        window.clearTimeout(timer);
        done();
      };
      const onEnd = (e: TransitionEvent) => {
        if (e.target === sheet && e.propertyName === 'transform') finish();
      };
      sheet.addEventListener('transitionend', onEnd);
      timer = window.setTimeout(finish, ms + 80);
    };

    const settle = () => {
      sheet.style.transition = SPRING;
      sheet.style.transform = 'translateY(0)';
      afterTransition(240, clearStyles);
    };

    const leave = (from: number, velocity: number) => {
      leaving = true;
      const distance = sheet.offsetHeight - from;
      const duration = Math.round(Math.min(260, Math.max(110, distance / Math.max(velocity, 0.9))));
      sheet.style.transition = `transform ${duration}ms ease-out`;
      sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
      afterTransition(duration, () => closeRef.current());
    };

    const onStart = (e: TouchEvent) => {
      if (leaving || e.touches.length !== 1) {
        armed = false;
        return;
      }
      // One motion at a time: finish the entrance animation and stop a spring mid-flight,
      // keeping the sheet exactly where the finger finds it.
      sheet.getAnimations().forEach((a) => a.finish());
      const at = currentOffset(sheet);
      window.clearTimeout(timer);
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${at}px)`;

      dragging = false;
      armed =
        !scrolledAway(e.target, sheet) && (scrollRef?.current?.scrollTop ?? 0) <= 0 && at >= 0;
      startOffset = at;
      startY = e.touches[0].clientY;
      samples = [{ y: startY, t: e.timeStamp }];
      // Caught mid-spring: carry on dragging without waiting for the slop.
      if (armed && at > 1) dragging = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed || leaving) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (!dragging) {
        if (dy < -4) {
          armed = false; // scrolling up through the content
          return;
        }
        if (dy <= START_SLOP) return;
        dragging = true;
      }
      if (e.cancelable) e.preventDefault();
      samples.push({ y, t: e.timeStamp });
      while (samples.length > 2 && e.timeStamp - samples[0].t > VELOCITY_WINDOW) samples.shift();
      sheet.style.transform = `translateY(${Math.max(0, startOffset + dy)}px)`;
    };

    const onEnd = (e: TouchEvent) => {
      if (!armed || leaving) return;
      armed = false;
      if (!dragging) {
        // A tap or an abandoned gesture: put back what onStart froze.
        if (startOffset > 0) settle();
        else clearStyles();
        return;
      }
      dragging = false;
      const offset = Math.max(0, currentOffset(sheet));
      const first = samples[0];
      const last = samples[samples.length - 1];
      const velocity = last.t > first.t ? (last.y - first.y) / (last.t - first.t) : 0;
      const cancelled = e.type === 'touchcancel';
      const flicked = velocity > FLICK_VELOCITY && offset > FLICK_MIN_DISTANCE;
      if (!cancelled && (flicked || offset > sheet.offsetHeight * CLOSE_FRACTION)) {
        leave(offset, velocity);
      } else {
        settle();
      }
    };

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd, { passive: true });
    sheet.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.clearTimeout(timer);
      sheet.removeEventListener('touchstart', onStart);
      sheet.removeEventListener('touchmove', onMove);
      sheet.removeEventListener('touchend', onEnd);
      sheet.removeEventListener('touchcancel', onEnd);
      clearStyles();
    };
  }, [enabled, sheetRef, scrollRef]);
}
