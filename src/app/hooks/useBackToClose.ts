import { useEffect, useRef } from 'react';

const MARKER = 'mxBackClose';

// History steps that overlays took themselves (removing their own entry). Those pops must not
// close any overlay, including one that opened in the same tick (React re-running the effect).
let pendingSelfPops = 0;
let currentPopIsSelf = false;

if (typeof window !== 'undefined') {
  // Registered once at load, in the capture phase, so it classifies a pop before overlay handlers run.
  window.addEventListener(
    'popstate',
    () => {
      currentPopIsSelf = pendingSelfPops > 0;
      if (currentPopIsSelf) pendingSelfPops -= 1;
    },
    true
  );
}

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
      // Our own entry removal, or another overlay is on top: stay open and keep listening.
      if (currentPopIsSelf || stack[stack.length - 1] !== id) {
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
        pendingSelfPops += 1;
        window.history.back();
      }
    };
  }, [active]);
}
