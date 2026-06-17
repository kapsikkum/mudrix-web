import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { IconButton } from '@/app/components/Button';
import * as css from './Drawer.css';

interface DrawerProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  titleIcon?: React.ReactNode;
  children: React.ReactNode;
}

export function Drawer({ open, onClose, title, titleIcon, children }: DrawerProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setClosing(false);
      setMounted(true);
    } else if (mounted) {
      setClosing(true);
      timerRef.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, 150);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [open, mounted]);

  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose?.();
    },
    [onClose]
  );

  if (!mounted) return null;

  const overlayClass = closing ? css.overlayClosing : css.overlay;
  const drawerClass = closing ? css.drawerClosing : css.drawer;

  return (
    <div className={overlayClass} role="presentation" onClick={handleOverlayClick}>
      <div className={drawerClass} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className={css.header}>
            <span className={css.title}>
              {titleIcon && <span>{titleIcon}</span>}
              {title}
            </span>
            {onClose && (
              <IconButton size="sm" onClick={onClose} aria-label={t('common.close')}>
                <XIcon size={16} />
              </IconButton>
            )}
          </div>
        )}
        <div className={css.body}>{children}</div>
      </div>
    </div>
  );
}
