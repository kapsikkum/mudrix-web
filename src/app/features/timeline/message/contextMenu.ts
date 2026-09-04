import type { MatrixEvent } from 'matrix-js-sdk';
import type { TFunction } from 'i18next';
import {
  ArrowBendUpLeftIcon,
  ChatDotsIcon,
  SmileyIcon,
  PushPinIcon,
  PushPinSlashIcon,
  PencilSimpleIcon,
  TrashIcon,
  CodeIcon,
  XSquareIcon,
  FlagIcon,
} from '@phosphor-icons/react';
import type { useContextMenu } from '@/app/hooks/useContextMenu';
import { createElement } from 'react';

type ContextMenuController = ReturnType<typeof useContextMenu>;

export interface ContextMenuCallbacks {
  onReply: (event: MatrixEvent) => void;
  onThreadClick?: (event: MatrixEvent) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent) => void;
  onReport: (event: MatrixEvent) => void;
  onEndPoll?: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent) => void;
  onPin: () => void;
  onViewSource: (event: MatrixEvent) => void;
}

export function openMessageContextMenu(
  e: React.MouseEvent,
  event: MatrixEvent,
  {
    canEdit,
    canRedact,
    canPin,
    canEndPoll,
    isDecrypting,
    isUndecryptable,
    isRedacted,
    isPinned,
    devModeEnabled,
    t,
    openContextMenu,
    callbacks,
  }: {
    canEdit: boolean;
    canRedact: boolean;
    canPin: boolean;
    canEndPoll: boolean;
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
  if (isDecrypting || isUndecryptable || isRedacted) return;

  const baseItems = [
    {
      label: t('timeline.reply'),
      icon: createElement(ArrowBendUpLeftIcon, { size: 14 }),
      onClick: () => callbacks.onReply(event),
    },
    ...(callbacks.onThreadClick
      ? [
          {
            label: t('timeline.replyInThread'),
            icon: createElement(ChatDotsIcon, { size: 14 }),
            onClick: () => callbacks.onThreadClick!(event),
          },
        ]
      : []),
    {
      label: t('timeline.react'),
      icon: createElement(SmileyIcon, { size: 14 }),
      onClick: () => callbacks.onReact(event),
    },
    ...(canPin
      ? [
          {
            label: isPinned ? t('timeline.unpin') : t('timeline.pin'),
            icon: isPinned
              ? createElement(PushPinSlashIcon, { size: 14 })
              : createElement(PushPinIcon, { size: 14 }),
            onClick: callbacks.onPin,
          },
        ]
      : []),
    ...(canEdit && !isRedacted
      ? [
          {
            label: t('common.edit'),
            icon: createElement(PencilSimpleIcon, { size: 14 }),
            onClick: () => callbacks.onEdit(event),
          },
        ]
      : []),
    ...(canEndPoll && !isRedacted
      ? [
          {
            label: t('timeline.poll.end'),
            icon: createElement(XSquareIcon, { size: 14 }),
            onClick: () => callbacks.onEndPoll?.(event),
          },
        ]
      : []),
  ];

  const moreItems = [
    ...(devModeEnabled
      ? [
          {
            label: t('timeline.viewSource'),
            icon: createElement(CodeIcon, { size: 14 }),
            onClick: () => callbacks.onViewSource(event),
          },
        ]
      : []),
    {
      label: t('timeline.report'),
      icon: createElement(FlagIcon, { size: 14 }),
      onClick: () => callbacks.onReport(event),
    },
    ...(canRedact && !isRedacted
      ? [
          {
            label: t('common.delete'),
            icon: createElement(TrashIcon, { size: 14 }),
            danger: true,
            onClick: () => callbacks.onDelete(event),
          },
        ]
      : []),
  ];

  const items = [
    ...baseItems,
    ...(moreItems.length > 0
      ? [{ label: '', divider: true as const, onClick: () => {} }, ...moreItems]
      : []),
  ];

  openContextMenu(e, items);
}
