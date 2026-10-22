import { useEffect, useRef } from 'react';

const MARKER = 'mxBackClose';

// Set while an overlay removes its own history entry, so overlays beneath it ignore that pop.
let selfPop = false;

// Open overlays, oldest first. A single back press must close only the topmost one.
const stack: symbol[] = [];

/**
 * Lets the Android back button / iOS swipe-back dismiss a transient overlay instead of
 * navigating away: while `active`, a throwaway history entry is pushed and popping it calls
 * `onClose`. If the overlay closes some other way, the entry is removed again.
 */
export function useBackToClose(active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    const id = Symbol('overlay');
    stack.push(id);
    let poppedByUser = false;
    window.history.pushState({ ...(window.history.state ?? {}), [MARKER]: true }, '');
    const onPop = () => {
      // Another overlay is on top (or we are removing our own entry): stay open and keep listening.
      if (selfPop || stack[stack.length - 1] !== id) {
        window.addEventListener('popstate', onPop, { once: true });
        return;
      }
      poppedByUser = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop, { once: true });
    return () => {
      window.removeEventListener('popstate', onPop);
      const at = stack.indexOf(id);
      if (at >= 0) stack.splice(at, 1);
      if (!poppedByUser && window.history.state?.[MARKER]) {
        selfPop = true;
        window.addEventListener(
          'popstate',
          () => {
            selfPop = false;
          },
          { once: true, capture: true }
        );
        window.history.back();
      }
    };
  }, [active]);
}
