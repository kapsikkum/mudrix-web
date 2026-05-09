import { useSetAtom } from 'jotai';
import { toastsAtom, type Toast } from '@/app/store/atoms';
import { useCallback } from 'react';

let _counter = 0;

export function useToast() {
  const setToasts = useSetAtom(toastsAtom);

  const show = useCallback(
    (message: string, type: Toast['type'] = 'info', duration = 4000) => {
      const id = `toast-${++_counter}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, type, duration }]);
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
