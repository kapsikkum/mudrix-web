import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtom } from 'jotai';
import { CheckIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
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

function enabledIndexes(items: ContextMenuItem[], baseIndex = 0): number[] {
  return items
    .map((item, i) => (item.divider || item.disabled ? -1 : baseIndex + i))
    .filter((i) => i !== -1);
}

export function ContextMenu() {
  const { t } = useTranslation();
  const [menu, setMenu] = useAtom(contextMenuAtom);
  const menuRef = useRef<HTMLDivElement>(null);
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
    setMenu(null);
    setOpenSubIndex(null);
    setActive(null);
  }, [setMenu, setActive]);

  const activateItem = useCallback(
    (item: ContextMenuItem) => {
      closeMenu();
      item.onClick();
    },
    [closeMenu]
  );

  const submenuItems = useMemo(() => {
    if (!menu) return undefined;
    const openItem = openSubIndex !== null ? menu.items[openSubIndex] : undefined;
    return openItem?.submenu;
  }, [menu, openSubIndex]);

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };

    document.addEventListener('mousedown', closeMenu);
    document.addEventListener('contextmenu', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      document.removeEventListener('mousedown', closeMenu);
      document.removeEventListener('contextmenu', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [menu, closeMenu]);

  // Focus the first enabled item when the menu opens via keyboard; otherwise
  // focus the menu container so pointer-opened menus don't pre-highlight.
  useEffect(() => {
    if (!menu) return;
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
          opener.focus({ preventScroll: true });
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

  if (!menu) return null;

  const x = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);
  const y = Math.min(menu.y, window.innerHeight - estimateHeight(menu.items) - 8);

  const menuWidth = menuRef.current?.clientWidth ?? MENU_WIDTH;
  const openItem = openSubIndex !== null ? menu.items[openSubIndex] : undefined;
  const submenu = openItem?.submenu;
  const menuLabel = t('common.menu');

  let submenuLeft = menuWidth - 6;
  let submenuTop = 0;
  if (submenu && openSubIndex !== null) {
    const parentEl = itemRefs.current[openSubIndex];
    submenuTop = parentEl?.offsetTop ?? 0;

    const overflowsRight = x + menuWidth + SUBMENU_WIDTH > window.innerWidth;
    submenuLeft = overflowsRight ? -(SUBMENU_WIDTH - 6) : menuWidth - 6;
    submenuTop = Math.max(
      0,
      Math.min(submenuTop, window.innerHeight - estimateHeight(submenu) - 8)
    );
  }

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

  return (
    <div
      ref={menuRef}
      className={css.menu}
      data-suppress-hover={suppressHover ? 'true' : undefined}
      role="menu"
      aria-label={menuLabel}
      tabIndex={-1}
      style={{ left: x, top: y }}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {renderItems(menu.items, 0, true)}

      {submenu && openSubIndex !== null && (
        <div
          className={css.menuSubmenu}
          role="menu"
          aria-label={menuLabel}
          tabIndex={-1}
          style={{ left: submenuLeft, top: submenuTop }}
          onMouseEnter={() => clearCloseTimer()}
          onMouseLeave={() => scheduleSubmenuClose()}
        >
          {renderItems(submenu, totalMainCount)}
        </div>
      )}
    </div>
  );
}
