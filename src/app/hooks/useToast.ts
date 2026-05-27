import { useSetAtom } from 'jotai';
import { toastsAtom, type Toast } from '@/app/store/atoms';
import { useCallback } from 'react';

let _counter = 0;

const MAX_VISIBLE = 5;

export function useToast() {
  const setToasts = useSetAtom(toastsAtom);

  const show = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 4000) => {
      const id = `toast-${++_counter}-${Date.now()}`;
      setToasts((prev) => {
        // Deduplicate: if same message+type already exists, skip
        if (prev.some((t) => t.message === message && t.type === type)) return prev;

        const next = [...prev, { id, message, type, duration }];
        // Cap at MAX_VISIBLE, trim oldest
        if (next.length > MAX_VISIBLE) next.splice(0, next.length - MAX_VISIBLE);
        return next;
      });
    },
    [setToasts]
  );

  return {
    info: (msg: string, duration?: number) => show(msg, 'info', duration),
    success: (msg: string, duration?: number) => show(msg, 'success', duration),
    error: (msg: string, duration?: number) => show(msg, 'error', duration),
    warning: (msg: string, duration?: number) => show(msg, 'warning', duration),
  };
}
