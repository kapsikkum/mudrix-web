import { useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { contextMenuAtom } from '../features/contextMenu/contextMenuAtom';
import type { ContextMenuItem } from '../features/contextMenu/contextMenuAtom';

export function useContextMenu() {
  const setMenu = useSetAtom(contextMenuAtom);

  const openContextMenu = useCallback(
    (e: React.MouseEvent, items: ContextMenuItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [setMenu]
  );

  const closeContextMenu = useCallback(() => {
    setMenu(null);
  }, [setMenu]);

  return { openContextMenu, closeContextMenu };
}
