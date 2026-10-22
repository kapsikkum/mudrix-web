import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { computePosition, autoUpdate, flip, shift, offset } from '@floating-ui/dom';
import { CheckIcon, CaretRightIcon, CaretLeftIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { contextMenuAtom, type ContextMenuItem } from './contextMenuAtom';
import { emojiPickerAtom } from '@/app/store/atoms';
import { useMediaQuery } from '@/app/hooks/useMediaQuery';
import * as css from './ContextMenu.css';

const SUBMENU_CLOSE_DELAY = 150;

/** Phones and tablets get a bottom sheet; a touchscreen laptop keeps the floating menu. */
const SHEET_QUERY = '(max-width: 768px), (pointer: coarse) and (max-width: 1100px)';
const SHEET_DISMISS_DISTANCE = 90;

function enabledIndexes(items: ContextMenuItem[], baseIndex = 0): number[] {
  return items
    .map((item, i) => (item.divider || item.disabled ? -1 : baseIndex + i))
    .filter((i) => i !== -1);
}

export function ContextMenu() {
  const { t } = useTranslation();
  const [menu, setMenu] = useAtom(contextMenuAtom);
  const [picker, setPicker] = useAtom(emojiPickerAtom);
  const sheetMode = useMediaQuery(SHEET_QUERY);
  const menuRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const closeTimer = useRef<number | null>(null);
  const [openSubIndex, setOpenSubIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [suppressHover, setSuppressHover] = useState(false);
  const activeIndexRef = useRef<number | null>(null);
  const lastMenuRef = useRef(menu);

  const setActive = useCallback((index: number | null) => {
    setActiveIndex(index);
    activeIndexRef.current = index;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleSubmenuClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpenSubIndex(null), SUBMENU_CLOSE_DELAY);
  }, [clearCloseTimer]);

  const closeMenu = useCallback(() => {
    if (picker?.anchor?.closest('[role="menu"]')) setPicker(null);
    setMenu(null);
    setOpenSubIndex(null);
    setActive(null);
  }, [picker, setPicker, setMenu, setActive]);

  const activateItem = useCallback(
    (item: ContextMenuItem) => {
      if (!item.keepOpen) closeMenu();
      item.onClick(menuRef.current);
    },
    [closeMenu]
  );

  const submenuItems = useMemo(() => {
    if (!menu) return undefined;
    const openItem = openSubIndex !== null ? menu.items[openSubIndex] : undefined;
    return openItem?.submenu;
  }, [menu, openSubIndex, sheetMode]);

  const totalMainCount = menu?.items.length ?? 0;

  const itemAt = useCallback(
    (index: number | null): ContextMenuItem | null => {
      if (!menu || index === null) return null;
      if (index >= 0 && index < totalMainCount) return menu.items[index];
      if (submenuItems && index >= totalMainCount && index < totalMainCount + submenuItems.length) {
        return submenuItems[index - totalMainCount] ?? null;
      }
      return null;
    },
    [menu, submenuItems, totalMainCount]
  );

  const enabledAll = useMemo(() => {
    if (!menu) return [];
    return [...enabledIndexes(menu.items), ...enabledIndexes(submenuItems ?? [], totalMainCount)];
  }, [menu, submenuItems, totalMainCount]);

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!menu) return;

    if (sheetMode) {
      // The backdrop closes the sheet; scrolling inside it must not.
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') closeMenu();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }

    const isInsidePicker = (target: EventTarget | null): boolean =>
      target instanceof Element && target.closest('[data-emoji-picker]') !== null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const handleMousedown = (e: MouseEvent) => {
      if (!isInsidePicker(e.target)) closeMenu();
    };
    const handleContextmenu = (e: MouseEvent) => {
      if (!isInsidePicker(e.target)) closeMenu();
    };
    const handleScroll = (e: Event) => {
      if (!isInsidePicker(e.target)) closeMenu();
    };
    const handleBlur = () => closeMenu();

    document.addEventListener('mousedown', handleMousedown);
    document.addEventListener('contextmenu', handleContextmenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleMousedown);
      document.removeEventListener('contextmenu', handleContextmenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [menu, closeMenu, sheetMode]);

  useLayoutEffect(() => {
    if (!menu || sheetMode) return;
    const menuEl = menuRef.current;
    if (!menuEl) return;
    const anchor = menu.anchor;
    const reference: Parameters<typeof computePosition>[0] = {
      getBoundingClientRect: () => ({
        x: anchor.x,
        y: anchor.y,
        top: anchor.y,
        left: anchor.x,
        right: anchor.x + anchor.width,
        bottom: anchor.y + anchor.height,
        width: anchor.width,
        height: anchor.height,
      }),
    };
    const middleware = [offset(8), flip(), shift({ padding: 8, crossAxis: true })];
    return autoUpdate(reference, menuEl, () => {
      if (!menuRef.current) return;
      computePosition(reference, menuRef.current, {
        placement: anchor.placement,
        strategy: 'fixed',
        middleware,
      }).then(({ x, y }) => {
        const current = menuRef.current;
        if (!current) return;
        current.style.left = `${x}px`;
        current.style.top = `${y}px`;
      });
    });
  }, [menu, sheetMode]);

  useLayoutEffect(() => {
    if (!menu || sheetMode || openSubIndex === null) return;
    const parentEl = itemRefs.current[openSubIndex];
    const subEl = submenuRef.current;
    if (!parentEl || !subEl) return;
    return autoUpdate(parentEl, subEl, () => {
      if (!submenuRef.current) return;
      computePosition(parentEl, submenuRef.current, {
        placement: 'right-start',
        strategy: 'fixed',
        middleware: [offset(6), flip(), shift({ padding: 8 })],
      }).then(({ x, y }) => {
        const current = submenuRef.current;
        if (!current) return;
        current.style.left = `${x}px`;
        current.style.top = `${y}px`;
      });
    });
  }, [menu, openSubIndex]);

  useEffect(() => {
    if (!menu) {
      setOpenSubIndex(null);
      setActive(null);
      return;
    }
    menuRef.current?.focus();
  }, [menu, setActive]);

  useEffect(() => {
    if (!menu) return;
    setSuppressHover(true);
    const onPointerMove = () => setSuppressHover(false);
    document.addEventListener('pointermove', onPointerMove, { once: true });
    return () => document.removeEventListener('pointermove', onPointerMove);
  }, [menu]);

  useEffect(() => {
    const prev = lastMenuRef.current;
    lastMenuRef.current = menu;
    if (prev && !menu) {
      const opener = prev.opener;
      if (opener && opener.isConnected && typeof opener.focus === 'function') {
        requestAnimationFrame(() => {
          const active = document.activeElement;
          const focusLost = !active || active === document.body;
          if (focusLost && document.hasFocus()) opener.focus({ preventScroll: true });
        });
      }
    }
  }, [menu]);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const enabled = enabledAll;
    if (enabled.length === 0) return;

    const current = activeIndexRef.current;
    const currentPos = current !== null ? enabled.indexOf(current) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive(
          currentPos >= 0 ? enabled[Math.min(currentPos + 1, enabled.length - 1)] : enabled[0]
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive(currentPos > 0 ? enabled[currentPos - 1] : enabled[enabled.length - 1]);
        break;
      case 'Home':
        e.preventDefault();
        setActive(enabled[0]);
        break;
      case 'End':
        e.preventDefault();
        setActive(enabled[enabled.length - 1]);
        break;
      case 'ArrowRight': {
        const item = itemAt(current);
        if (item?.submenu && !item.disabled && openSubIndex !== current) {
          e.preventDefault();
          setOpenSubIndex(current);
          const sub = enabledIndexes(item.submenu, totalMainCount);
          setActive(sub[0] ?? current);
        }
        break;
      }
      case 'ArrowLeft': {
        if (openSubIndex !== null) {
          e.preventDefault();
          setOpenSubIndex(null);
          setActive(openSubIndex);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const item = itemAt(current);
        if (!item) break;
        if (item.submenu && !item.disabled) {
          setOpenSubIndex(current);
          const sub = enabledIndexes(item.submenu, totalMainCount);
          setActive(sub[0] ?? current);
        } else {
          activateItem(item);
        }
        break;
      }
      case 'Escape':
        if (openSubIndex !== null) {
          e.preventDefault();
          e.stopPropagation();
          setOpenSubIndex(null);
        }
        break;
      default:
        break;
    }

    if (activeIndexRef.current !== current) {
      itemRefs.current[activeIndexRef.current ?? -1]?.focus();
    }
  };

  const onGrabStart = (e: React.PointerEvent) => {
    dragStartRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onGrabMove = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    const el = menuRef.current;
    if (start === null || !el) return;
    const dy = Math.max(0, e.clientY - start);
    el.style.transition = 'none';
    el.style.transform = `translateY(${dy}px)`;
  };
  const onGrabEnd = (e: React.PointerEvent) => {
    const start = dragStartRef.current;
    const el = menuRef.current;
    dragStartRef.current = null;
    if (start === null || !el) return;
    const dy = e.clientY - start;
    if (dy > SHEET_DISMISS_DISTANCE) {
      closeMenu();
      return;
    }
    el.style.transition = 'transform 160ms ease-out';
    el.style.transform = '';
  };

  if (!menu) return null;

  const openItem = openSubIndex !== null ? menu.items[openSubIndex] : undefined;
  const submenu = openItem?.submenu;
  const menuLabel = t('common.menu');

  const renderItems = (items: ContextMenuItem[], baseIndex: number, closeHover = false) =>
    items.map((item, i) => {
      if (item.divider) {
        return <div key={i} className={css.menuDivider} role="separator" />;
      }
      const absoluteIndex = baseIndex + i;
      const isSubmenuParent = !!item.submenu && !item.disabled;
      const isActive = activeIndex === absoluteIndex;
      const baseClass = item.disabled
        ? css.menuItemDisabled
        : item.danger
          ? css.menuItemDanger
          : css.menuItem;
      const activeClass =
        isActive && !item.disabled
          ? item.danger
            ? css.menuItemDangerActive
            : css.menuItemActive
          : '';

      return (
        <div
          key={i}
          ref={(el) => {
            itemRefs.current[absoluteIndex] = el;
          }}
          className={[baseClass, activeClass].filter(Boolean).join(' ')}
          role={item.checked ? 'menuitemcheckbox' : 'menuitem'}
          aria-checked={item.checked ? 'true' : undefined}
          aria-disabled={item.disabled || undefined}
          aria-haspopup={isSubmenuParent ? 'menu' : undefined}
          tabIndex={-1}
          onFocus={() => setActive(absoluteIndex)}
          onMouseEnter={() => {
            if (isSubmenuParent) {
              clearCloseTimer();
              setOpenSubIndex(absoluteIndex);
              return;
            }
            if (closeHover && openSubIndex !== null) scheduleSubmenuClose();
          }}
          onMouseLeave={() => {
            if (isSubmenuParent) scheduleSubmenuClose();
          }}
          onClick={() => {
            if (item.disabled) return;
            if (isSubmenuParent) {
              setOpenSubIndex(absoluteIndex);
              return;
            }
            activateItem(item);
          }}
        >
          {item.icon && <span className={css.menuItemIcon}>{item.icon}</span>}
          <span className={css.menuItemLabel}>{item.label}</span>
          {item.submenu && <CaretRightIcon size={12} weight="bold" className={css.menuItemCarat} />}
          {item.checked && <CheckIcon size={14} weight="bold" className={css.menuItemCheck} />}
        </div>
      );
    });

  if (sheetMode) {
    const showingSub = !!submenu && openSubIndex !== null;
    const parentLabel = showingSub ? menu.items[openSubIndex].label : '';
    return (
      <>
        <div className={css.sheetBackdrop} onClick={closeMenu} aria-hidden="true" />
        <div
          ref={menuRef}
          className={css.sheet}
          role="menu"
          aria-label={menuLabel}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={css.sheetGrabber}
            onPointerDown={onGrabStart}
            onPointerMove={onGrabMove}
            onPointerUp={onGrabEnd}
            onPointerCancel={onGrabEnd}
          >
            <div className={css.sheetGrabberBar} />
          </div>
          {showingSub && (
            <div
              className={css.sheetBack}
              role="button"
              tabIndex={0}
              onClick={() => setOpenSubIndex(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setOpenSubIndex(null);
              }}
            >
              <CaretLeftIcon size={20} weight="bold" />
              {parentLabel}
            </div>
          )}
          {!showingSub && menu.quickReactions && (
            <div className={css.quickRow} role="group" aria-label={t('timeline.react')}>
              {menu.quickReactions.keys.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={
                    menu.quickReactions?.active?.includes(key) ? css.quickBtnActive : css.quickBtn
                  }
                  onClick={() => {
                    const pick = menu.quickReactions?.onPick;
                    closeMenu();
                    pick?.(key);
                  }}
                >
                  {key}
                </button>
              ))}
            </div>
          )}
          <div className={css.sheetList}>
            {showingSub && submenu
              ? renderItems(submenu, totalMainCount)
              : renderItems(menu.items, 0)}
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={menuRef}
      className={css.menu}
      data-suppress-hover={suppressHover ? 'true' : undefined}
      role="menu"
      aria-label={menuLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {renderItems(menu.items, 0, true)}

      {submenu && openSubIndex !== null && (
        <div
          ref={submenuRef}
          className={css.menuSubmenu}
          role="menu"
          aria-label={menuLabel}
          tabIndex={-1}
          onMouseEnter={() => clearCloseTimer()}
          onMouseLeave={() => scheduleSubmenuClose()}
        >
          {renderItems(submenu, totalMainCount)}
        </div>
      )}
    </div>
  );
}
