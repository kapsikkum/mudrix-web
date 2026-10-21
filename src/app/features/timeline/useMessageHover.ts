import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const CLEAR_DELAY_MS = 160;

/** The message row holding the current non-empty text selection, if any. */
function selectedMessageRow(): Element | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const node = sel.anchorNode;
  const el = node instanceof Element ? node : (node?.parentElement ?? null);
  return el?.closest('[data-hovered]') ?? null;
}

export function useMessageHover() {
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClear = useCallback(() => {
    if (clearTimerRef.current !== null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  const savedRange = useRef<Range | null>(null);

  const onHover = useCallback(
    (eventId: string | null) => {
      // Hover changes re-render rows and the action toolbar, which must never drop a selection
      // the user is making or copying from: keep the current hover until it is cleared.
      const selectedRow = selectedMessageRow();
      if (selectedRow) {
        savedRange.current = window.getSelection()?.getRangeAt(0).cloneRange() ?? null;
        if (eventId === null || selectedRow.getAttribute('data-hovered') === 'true') return;
      }
      cancelClear();
      if (eventId === null) {
        clearTimerRef.current = setTimeout(() => {
          clearTimerRef.current = null;
          setHoveredEventId(null);
        }, CLEAR_DELAY_MS);
        return;
      }
      setHoveredEventId(eventId);
    },
    [cancelClear]
  );

  // Safety net: if a hover render still collapsed the selection, put it back.
  useLayoutEffect(() => {
    const range = savedRange.current;
    savedRange.current = null;
    const sel = window.getSelection();
    if (!range || !sel || !sel.isCollapsed || !range.startContainer.isConnected) return;
    if (range.collapsed) return;
    sel.removeAllRanges();
    sel.addRange(range);
  }, [hoveredEventId]);

  useEffect(() => cancelClear, [cancelClear]);

  return [hoveredEventId, onHover] as const;
}
