import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { CheckIcon } from '@phosphor-icons/react';
import { contextMenuAtom } from './contextMenuAtom';
import * as css from './ContextMenu.css';

const MENU_WIDTH = 190;
const MENU_ITEM_HEIGHT = 36;
const MENU_PADDING = 8;

export function ContextMenu() {
  const [menu, setMenu] = useAtom(contextMenuAtom);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!menu) return;

    const close = () => setMenu(null);

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

  if (!menu) return null;

  // Clamp to viewport edges
  const itemCount = menu.items.filter((i) => !i.divider).length;
  const dividerCount = menu.items.filter((i) => i.divider).length;
  const estimatedHeight = itemCount * MENU_ITEM_HEIGHT + dividerCount * 9 + MENU_PADDING;

  const x = Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8);
  const y = Math.min(menu.y, window.innerHeight - estimatedHeight - 8);

  return (
    <div
      ref={menuRef}
      className={css.menu}
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {menu.items.map((item, i) => {
        if (item.divider) {
          return <div key={i} className={css.menuDivider} />;
        }
        const itemClass = item.disabled
          ? css.menuItemDisabled
          : item.danger
            ? css.menuItemDanger
            : css.menuItem;
        return (
          <div
            key={i}
            className={itemClass}
            onClick={() => {
              if (item.disabled) return;
              setMenu(null);
              item.onClick();
            }}
          >
            {item.icon && <span className={css.menuItemIcon}>{item.icon}</span>}
            <span className={css.menuItemLabel}>{item.label}</span>
            {item.checked && <CheckIcon size={14} weight="bold" className={css.menuItemCheck} />}
          </div>
        );
      })}
    </div>
  );
}
