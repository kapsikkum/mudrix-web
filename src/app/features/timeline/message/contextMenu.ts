import type { MatrixEvent } from 'matrix-js-sdk';
import type { TFunction } from 'i18next';
import {
  ArrowBendUpLeftIcon,
  SmileyIcon,
  PushPinIcon,
  PushPinSlashIcon,
  PencilSimpleIcon,
  TrashIcon,
  CodeIcon,
} from '@phosphor-icons/react';
import type { useContextMenu } from '@/app/hooks/useContextMenu';
import { createElement } from 'react';

type ContextMenuController = ReturnType<typeof useContextMenu>;

export interface ContextMenuCallbacks {
  onReply: (event: MatrixEvent) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent) => void;
  onPin: () => void;
  onViewSource: (event: MatrixEvent) => void;
}

export function openMessageContextMenu(
  e: React.MouseEvent,
  event: MatrixEvent,
  {
    isOwn,
    isDecrypting,
    isUndecryptable,
    isRedacted,
    isPinned,
    devModeEnabled,
    t,
    openContextMenu,
    callbacks,
  }: {
    isOwn: boolean;
    isDecrypting: boolean;
    isUndecryptable: boolean;
    isRedacted: boolean;
    isPinned: boolean;
    devModeEnabled: boolean;
    t: TFunction;
    openContextMenu: ContextMenuController['openContextMenu'];
    callbacks: ContextMenuCallbacks;
  }
): void {
  if (isDecrypting || isUndecryptable) return;

  const items = [
    {
      label: t('timeline.reply'),
      icon: createElement(ArrowBendUpLeftIcon, { size: 14 }),
      onClick: () => callbacks.onReply(event),
    },
    {
      label: t('timeline.react'),
      icon: createElement(SmileyIcon, { size: 14 }),
      onClick: () => callbacks.onReact(event),
    },
    {
      label: isPinned ? t('timeline.unpin') : t('timeline.pin'),
      icon: isPinned
        ? createElement(PushPinSlashIcon, { size: 14 })
        : createElement(PushPinIcon, { size: 14 }),
      onClick: callbacks.onPin,
    },
    ...(devModeEnabled
      ? [
          {
            label: t('timeline.viewSource'),
            icon: createElement(CodeIcon, { size: 14 }),
            onClick: () => callbacks.onViewSource(event),
          },
        ]
      : []),
    ...(isOwn && !isRedacted
      ? [
          {
            label: t('timeline.editAction'),
            icon: createElement(PencilSimpleIcon, { size: 14 }),
            onClick: () => callbacks.onEdit(event),
          },
          {
            label: t('timeline.deleteAction'),
            icon: createElement(TrashIcon, { size: 14 }),
            danger: true,
            onClick: () => callbacks.onDelete(event),
          },
        ]
      : []),
  ];

  openContextMenu(e, items);
}
