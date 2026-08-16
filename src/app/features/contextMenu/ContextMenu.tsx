import { useEffect, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { CheckIcon, CaretRightIcon } from '@phosphor-icons/react';
import { contextMenuAtom, type ContextMenuItem } from './contextMenuAtom';
import * as css from './ContextMenu.css';

const MENU_WIDTH = 190;
const SUBMENU_WIDTH = 188;
const MENU_ITEM_HEIGHT = 36;
const MENU_PADDING = 8;
const SUBMENU_CLOSE_DELAY = 150;

function estimateHeight(items: ContextMenuItem[]) {
  const itemCount = items.filter((i) => !i.divider).length;
  const dividerCount = items.filter((i) => i.divider).length;
  return itemCount * MENU_ITEM_HEIGHT + dividerCount * 9 + MENU_PADDING;
}

function renderItems(
  items: ContextMenuItem[],
  itemRefs: React.RefObject<(HTMLDivElement | null)[]>,
  baseIndex: number,
  openSubIndex: number | null,
  setOpenSubIndex: (i: number | null) => void,
  closeTimer: React.RefObject<number | null>,
  setMenu: (menu: null) => void,
  closeHover = false
) {
  const clearCloseTimer = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpenSubIndex(null), SUBMENU_CLOSE_DELAY);
  };

  return items.map((item, i) => {
    if (item.divider) {
      return <div key={i} className={css.menuDivider} />;
    }
    const itemClass = item.disabled
      ? css.menuItemDisabled
      : item.danger
        ? css.menuItemDanger
        : css.menuItem;
    const absoluteIndex = baseIndex + i;
    const isSubmenuParent = !!item.submenu && !item.disabled;

    return (
      <div
        key={i}
        ref={(el) => {
          itemRefs.current[absoluteIndex] = el;
        }}
        className={itemClass}
        onMouseEnter={() => {
          if (isSubmenuParent) {
            clearCloseTimer();
            setOpenSubIndex(absoluteIndex);
            return;
          }
          if (closeHover && openSubIndex !== null) scheduleClose();
        }}
        onMouseLeave={() => {
          if (isSubmenuParent) scheduleClose();
        }}
        onClick={() => {
          if (item.disabled) return;
          if (isSubmenuParent) return;
          setMenu(null);
          item.onClick();
        }}
      >
        {item.icon && <span className={css.menuItemIcon}>{item.icon}</span>}
        <span className={css.menuItemLabel}>{item.label}</span>
        {item.submenu && <CaretRightIcon size={12} weight="bold" className={css.menuItemCarat} />}
        {item.checked && <CheckIcon size={14} weight="bold" className={css.menuItemCheck} />}
      </div>
    );
  });
}

export function ContextMenu() {
  const [menu, setMenu] = useAtom(contextMenuAtom);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const closeTimer = useRef<number | null>(null);
  const [openSubIndex, setOpenSubIndex] = useState<number | null>(null);

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!menu) return;

    const close = () => {
      setMenu(null);
      setOpenSubIndex(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };

    document.addEventListener('mousedown', close);
    document.addEventListener('contextmenu', close);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', close);
    window.addEventListener('scroll', close, true);

    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('contextmenu', close);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menu, setMenu]);

  useEffect(() => {
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (!menu) return null;

  const x = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);
  const y = Math.min(menu.y, window.innerHeight - estimateHeight(menu.items) - 8);

  const menuWidth = menuRef.current?.clientWidth ?? MENU_WIDTH;
  const openItem = openSubIndex !== null ? menu.items[openSubIndex] : undefined;
  const submenuItems = openItem?.submenu;

  let submenuLeft = menuWidth - 6;
  let submenuTop = 0;
  if (submenuItems && openSubIndex !== null) {
    const parentEl = itemRefs.current[openSubIndex];
    submenuTop = parentEl?.offsetTop ?? 0;

    const overflowsRight = x + menuWidth + SUBMENU_WIDTH > window.innerWidth;
    submenuLeft = overflowsRight ? -(SUBMENU_WIDTH - 6) : menuWidth - 6;
    submenuTop = Math.max(
      0,
      Math.min(submenuTop, window.innerHeight - estimateHeight(submenuItems) - 8)
    );
  }

  return (
    <div
      ref={menuRef}
      className={css.menu}
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {renderItems(
        menu.items,
        itemRefs,
        0,
        openSubIndex,
        setOpenSubIndex,
        closeTimer,
        setMenu,
        true
      )}

      {submenuItems && openSubIndex !== null && (
        <div
          className={css.menuSubmenu}
          style={{ left: submenuLeft, top: submenuTop }}
          onMouseEnter={() => {
            if (closeTimer.current !== null) {
              window.clearTimeout(closeTimer.current);
              closeTimer.current = null;
            }
          }}
          onMouseLeave={() => {
            closeTimer.current = window.setTimeout(
              () => setOpenSubIndex(null),
              SUBMENU_CLOSE_DELAY
            );
          }}
        >
          {renderItems(
            submenuItems,
            itemRefs,
            menu.items.length,
            openSubIndex,
            setOpenSubIndex,
            closeTimer,
            setMenu
          )}
        </div>
      )}
    </div>
  );
}
