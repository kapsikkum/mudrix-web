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
  EyeSlashIcon,
  LinkSimpleIcon,
  ArrowBendUpRightIcon,
  BookmarkSimpleIcon,
  AlarmIcon,
  CopyIcon,
} from '@phosphor-icons/react';
import type { useContextMenu, MenuOpenEvent } from '@/app/hooks/useContextMenu';
import type { QuickReactions } from '@/app/features/contextMenu/contextMenuAtom';
import { createElement } from 'react';
import { makeEventPermalink } from '@/util/matrix';
import { stripReplyFallback } from './textContent';
import { REMINDER_PRESETS, reminderTime, type ReminderPreset } from '@/util/reminders';

type ContextMenuController = ReturnType<typeof useContextMenu>;

export interface ContextMenuCallbacks {
  onReply: (event: MatrixEvent) => void;
  onThreadClick?: (event: MatrixEvent) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent, skipConfirm?: boolean) => void;
  onReport: (event: MatrixEvent) => void;
  onEndPoll?: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent, anchorEl?: HTMLElement) => void;
  onPin: () => void;
  onSave: () => void;
  /** Remind me about this message at the given time (epoch ms). */
  onRemind: (at: number) => void;
  onHideMedia: () => void;
  onViewSource: (event: MatrixEvent) => void;
  onForward?: (event: MatrixEvent) => void;
}

const TEXT_MSGTYPES = new Set(['m.text', 'm.notice', 'm.emote']);

/** The plain-text body of a text message, without the reply fallback; empty for anything else. */
function copyableText(event: MatrixEvent): string {
  const content = event.getContent();
  if (!TEXT_MSGTYPES.has(content?.msgtype as string) || typeof content.body !== 'string') return '';
  return stripReplyFallback(content.body);
}

export function openMessageContextMenu(
  e: MenuOpenEvent,
  event: MatrixEvent,
  {
    canEdit,
    canRedact,
    canPin,
    canEndPoll,
    canHideMedia,
    isDecrypting,
    isUndecryptable,
    isRedacted,
    isPinned,
    isSaved,
    isOwn,
    devModeEnabled,
    t,
    openContextMenu,
    callbacks,
    quickReactions,
  }: {
    canEdit: boolean;
    canRedact: boolean;
    canPin: boolean;
    canEndPoll: boolean;
    canHideMedia: boolean;
    isDecrypting: boolean;
    isUndecryptable: boolean;
    isRedacted: boolean;
    isPinned: boolean;
    isSaved: boolean;
    /** Sent by the signed-in user: there is nothing to report. */
    isOwn: boolean;
    devModeEnabled: boolean;
    t: TFunction;
    openContextMenu: ContextMenuController['openContextMenu'];
    callbacks: ContextMenuCallbacks;
    /** One-tap reactions for the touch layout; omitted where reacting is not possible. */
    quickReactions?: QuickReactions;
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
      keepOpen: true,
      onClick: (menuEl?: HTMLElement | null) => callbacks.onReact(event, menuEl ?? undefined),
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
    {
      label: isSaved ? t('timeline.unsaveMessage') : t('timeline.saveMessage'),
      icon: createElement(BookmarkSimpleIcon, { size: 14, weight: isSaved ? 'fill' : 'regular' }),
      onClick: callbacks.onSave,
    },
    {
      label: t('timeline.remind.title'),
      icon: createElement(AlarmIcon, { size: 14 }),
      submenu: REMINDER_PRESETS.map((preset: ReminderPreset) => ({
        label: t(`timeline.remind.${preset}`),
        onClick: () => callbacks.onRemind(reminderTime(preset)),
      })),
      onClick: () => {},
    },
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
    ...(canHideMedia && !isRedacted
      ? [
          {
            label: t('timeline.hideMedia'),
            icon: createElement(EyeSlashIcon, { size: 14 }),
            onClick: callbacks.onHideMedia,
          },
        ]
      : []),
  ];

  // Text selection is off on touch screens (it fought the long-press sheet), so copying is an item.
  const textBody = copyableText(event);

  const middleItems = [
    ...(textBody
      ? [
          {
            label: t('timeline.copyText'),
            icon: createElement(CopyIcon, { size: 14 }),
            onClick: () => {
              navigator.clipboard.writeText(textBody).catch(() => {});
            },
          },
        ]
      : []),
    ...(event.getRoomId() && event.getId()
      ? [
          {
            label: t('common.copyLink'),
            icon: createElement(LinkSimpleIcon, { size: 14 }),
            onClick: () => {
              navigator.clipboard
                .writeText(makeEventPermalink(event.getRoomId()!, event.getId()!))
                .catch(() => {});
            },
          },
        ]
      : []),
    ...(callbacks.onForward && event.getRoomId() && event.getId()
      ? [
          {
            label: t('timeline.forward'),
            icon: createElement(ArrowBendUpRightIcon, { size: 14 }),
            onClick: () => callbacks.onForward!(event),
          },
        ]
      : []),
    ...(isOwn
      ? []
      : [
          {
            label: t('timeline.report'),
            icon: createElement(FlagIcon, { size: 14 }),
            onClick: () => callbacks.onReport(event),
          },
        ]),
    ...(devModeEnabled
      ? [
          {
            label: t('timeline.viewSource'),
            icon: createElement(CodeIcon, { size: 14 }),
            onClick: () => callbacks.onViewSource(event),
          },
        ]
      : []),
  ];

  const deleteItems =
    canRedact && !isRedacted
      ? [
          {
            label: t('common.delete'),
            icon: createElement(TrashIcon, { size: 14 }),
            danger: true,
            // Shift-click skips the confirmation. The menu's click handler gets no event, so ask
            // the one being handled.
            onClick: () =>
              callbacks.onDelete(
                event,
                (window.event as MouseEvent | KeyboardEvent | undefined)?.shiftKey === true
              ),
          },
        ]
      : [];

  const divider = { label: '', divider: true as const, onClick: () => {} };

  const items = [
    ...baseItems,
    ...(middleItems.length > 0 ? [divider, ...middleItems] : []),
    ...(deleteItems.length > 0 ? [divider, ...deleteItems] : []),
  ];

  openContextMenu(e, items, quickReactions);
}
