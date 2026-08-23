import { atom } from 'jotai';
import type { ReactNode } from 'react';

export interface ContextMenuItem {
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
  checked?: boolean;
  submenu?: ContextMenuItem[];
  onClick: () => void;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  opener?: HTMLElement | null;
}

export const contextMenuAtom = atom<ContextMenuState | null>(null);
