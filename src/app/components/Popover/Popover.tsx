import { useRef, useEffect, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { computePosition, autoUpdate, flip, shift, offset, type Placement } from '@floating-ui/dom';
import * as css from './Popover.css';

interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: React.ReactNode;
  placement?: Placement;
}

export function Popover({
  open,
  onClose,
  anchorRef,
  children,
  placement = 'bottom-start',
}: PopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !anchorRef.current || !popoverRef.current) return;
    const cleanup = autoUpdate(anchorRef.current, popoverRef.current, () => {
      if (!anchorRef.current || !popoverRef.current) return;
      computePosition(anchorRef.current, popoverRef.current, {
        placement,
        middleware: [offset(8), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        Object.assign(popoverRef.current!.style, { left: `${x}px`, top: `${y}px` });
      });
    });
    return cleanup;
  }, [open, placement, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const el = e.target as Node;
      if (anchorRef.current?.contains(el)) return;
      if (popoverRef.current?.contains(el)) return;
      onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div ref={popoverRef} className={css.popover} role="menu">
      {children}
    </div>,
    document.body
  );
}
