import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '@phosphor-icons/react';
import { IconButton } from '@/app/components/Button';
import * as css from './Modal.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  titleIcon?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  zIndex?: number;
}

export function Modal({
  open,
  onClose,
  title,
  titleIcon,
  size = 'md',
  children,
  footer,
  zIndex,
}: ModalProps) {
  const { t } = useTranslation();
  // Close on Escape
  useEffect(() => {
    if (!open || !onClose) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const overlayStyle = zIndex !== undefined ? { zIndex } : undefined;

  return (
    <div className={css.overlay} style={overlayStyle} onClick={onClose}>
      <div className={css.sizes[size]} onClick={(e) => e.stopPropagation()}>
        {/* Header — only rendered when a title is provided */}
        {title && (
          <div className={css.header}>
            <span className={css.title}>
              {titleIcon && <span className={css.titleIcon}>{titleIcon}</span>}
              {title}
            </span>
            {onClose && (
              <IconButton size="sm" onClick={onClose} aria-label={t('common.close')}>
                <XIcon size={16} />
              </IconButton>
            )}
          </div>
        )}

        {/* Body */}
        <div className={css.body}>{children}</div>

        {/* Footer */}
        {footer && <div className={css.footer}>{footer}</div>}
      </div>
    </div>
  );
}
