import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { contextMenuAtom } from '../features/contextMenu/contextMenuAtom';
import type { ContextMenuItem } from '../features/contextMenu/contextMenuAtom';

export type MenuAnchor = {
  x: number;
  y: number;
  opener?: HTMLElement | null;
};

export function isMenuOpenKey(e: React.KeyboardEvent | KeyboardEvent): boolean {
  if (e.key === 'ContextMenu') return true;
  return e.key === 'F10' && e.shiftKey;
}

export function syntheticMouseEvent(x: number, y: number, target: HTMLElement | null) {
  return {
    clientX: x,
    clientY: y,
    currentTarget: target,
    preventDefault() {},
    stopPropagation() {},
  } as unknown as React.MouseEvent;
}

function currentTargetEl(e: React.SyntheticEvent): HTMLElement | null {
  return e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
}

function anchorFromElement(el: HTMLElement | null): MenuAnchor {
  const rect = el?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { x: rect.left, y: rect.bottom + 4, opener: el };
  }
  return { x: 0, y: 0, opener: el };
}

function anchorFromMouseEvent(e: React.MouseEvent): MenuAnchor {
  if (e.clientX !== 0 || e.clientY !== 0) {
    return { x: e.clientX, y: e.clientY, opener: currentTargetEl(e) };
  }
  return anchorFromElement(currentTargetEl(e));
}

export function useContextMenu() {
  const setMenu = useSetAtom(contextMenuAtom);

  const openContextMenu = useCallback(
    (e: React.MouseEvent, items: ContextMenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      if (items.length === 0) return;
      setMenu({ items, ...anchorFromMouseEvent(e) });
    },
    [setMenu]
  );

  const openContextMenuAt = useCallback(
    (items: ContextMenuItem[], anchor: MenuAnchor) => {
      if (items.length === 0) return;
      setMenu({ items, x: anchor.x, y: anchor.y, opener: anchor.opener ?? null });
    },
    [setMenu]
  );

  const closeContextMenu = useCallback(() => {
    setMenu(null);
  }, [setMenu]);

  return { openContextMenu, openContextMenuAt, closeContextMenu };
}
