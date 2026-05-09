import { useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { InfoIcon, CheckCircleIcon, XCircleIcon, WarningIcon } from '@phosphor-icons/react';
import { toastsAtom, type Toast } from '@/app/store/atoms';
import * as css from './Toast.css';

const TYPE_CLASS: Record<Toast['type'], string> = {
  info: css.toastInfo,
  success: css.toastSuccess,
  error: css.toastError,
  warning: css.toastWarning,
};

const TYPE_ICON = {
  info: <InfoIcon size={16} />,
  success: <CheckCircleIcon size={16} />,
  error: <XCircleIcon size={16} />,
  warning: <WarningIcon size={16} />,
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <div className={TYPE_CLASS[toast.type]}>
      {TYPE_ICON[toast.type]}
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useAtom(toastsAtom);

  const dismiss = useCallback(
    (id: string) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [setToasts]
  );

  if (toasts.length === 0) return null;

  return (
    <div className={css.container}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}
