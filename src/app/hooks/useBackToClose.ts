import { useEffect, useRef } from 'react';

const MARKER = 'mxBackClose';

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
    let poppedByUser = false;
    window.history.pushState({ ...(window.history.state ?? {}), [MARKER]: true }, '');
    const onPop = () => {
      poppedByUser = true;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop, { once: true });
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!poppedByUser && window.history.state?.[MARKER]) window.history.back();
    };
  }, [active]);
}
