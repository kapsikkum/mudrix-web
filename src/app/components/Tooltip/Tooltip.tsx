import { useState, useRef, useEffect, useCallback, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import {
  computePosition,
  autoUpdate,
  flip,
  shift,
  offset,
  arrow,
  type Placement,
} from '@floating-ui/dom';
import * as css from './Tooltip.css';

interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: Placement;
  delay?: number;
}

const staticSideMap = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
} as const;

const arrowClassMap: Record<string, string | undefined> = {
  top: css.arrowDown,
  bottom: css.arrowUp,
  right: css.arrowLeft,
  left: css.arrowRight,
};

export function Tooltip({ content, children, placement = 'bottom', delay = 300 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const cleanup = autoUpdate(triggerRef.current, tooltipRef.current, () => {
      if (!triggerRef.current || !tooltipRef.current) return;
      computePosition(triggerRef.current, tooltipRef.current, {
        placement,
        middleware: [
          offset(8),
          flip(),
          shift({ padding: 8 }),
          arrow({ element: arrowRef.current! }),
        ],
      }).then(({ x, y, middlewareData, placement: computedPlacement }) => {
        Object.assign(tooltipRef.current!.style, {
          left: `${x}px`,
          top: `${y}px`,
        });

        const arrowData = middlewareData.arrow;
        if (arrowData && arrowRef.current) {
          const base = computedPlacement.split('-')[0] as keyof typeof staticSideMap;
          const side = staticSideMap[base];
          Object.assign(arrowRef.current.style, {
            left: arrowData.x != null ? `${arrowData.x}px` : '',
            top: arrowData.y != null ? `${arrowData.y}px` : '',
            right: '',
            bottom: '',
            [side]: '-4px',
          });

          for (const cls of [css.arrowUp, css.arrowDown, css.arrowLeft, css.arrowRight]) {
            arrowRef.current.classList.remove(cls);
          }
          const arrowCls = arrowClassMap[base];
          if (arrowCls) arrowRef.current.classList.add(arrowCls);
        }
      });
    });

    return cleanup;
  }, [visible, placement]);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const setTriggerRef = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node;
  }, []);

  type ChildProps = {
    ref?: React.Ref<HTMLElement>;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  };

  const child = children as React.ReactElement<ChildProps>;

  const trigger = cloneElement(child, {
    ref: setTriggerRef,
    onMouseEnter(e: React.MouseEvent) {
      child.props.onMouseEnter?.(e);
      show();
    },
    onMouseLeave(e: React.MouseEvent) {
      child.props.onMouseLeave?.(e);
      hide();
    },
    onFocus(e: React.FocusEvent) {
      child.props.onFocus?.(e);
      show();
    },
    onBlur(e: React.FocusEvent) {
      child.props.onBlur?.(e);
      hide();
    },
  });

  return (
    <>
      {trigger}
      {visible &&
        createPortal(
          <div ref={tooltipRef} role="tooltip" className={css.tooltipPortal}>
            {content}
            <div ref={arrowRef} className={css.arrow} />
          </div>,
          document.body
        )}
    </>
  );
}
