import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixEvent } from 'matrix-js-sdk';
import { Tooltip } from '@/app/components/Tooltip';
import {
  ArrowBendUpLeftIcon,
  ChatDotsIcon,
  SmileyIcon,
  PushPinIcon,
  PushPinSlashIcon,
  PencilSimpleIcon,
  TrashIcon,
  CodeIcon,
} from '@phosphor-icons/react';
import * as css from '../Timeline.css';

interface MessageActionToolbarProps {
  event: MatrixEvent;
  isOwn: boolean;
  isPinned: boolean;
  devModeEnabled: boolean;
  onReply: (event: MatrixEvent) => void;
  onReact: (event: MatrixEvent, anchor?: HTMLElement) => void;
  onEdit: (event: MatrixEvent) => void;
  onDelete: (event: MatrixEvent) => void;
  onPin: () => void;
  onViewSource: (event: MatrixEvent) => void;
  onThreadClick?: (event: MatrixEvent) => void;
}

export const MessageActionToolbar = memo(function MessageActionToolbar({
  event,
  isOwn,
  isPinned,
  devModeEnabled,
  onReply,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onViewSource,
  onThreadClick,
}: MessageActionToolbarProps) {
  const { t } = useTranslation();

  const handleReply = useCallback(() => onReply(event), [onReply, event]);
  const handleThreadClick = useCallback(() => onThreadClick?.(event), [onThreadClick, event]);
  const handleReact = useCallback(
    (e: React.MouseEvent) => onReact(event, e.currentTarget as HTMLElement),
    [onReact, event]
  );
  const handleEdit = useCallback(() => onEdit(event), [onEdit, event]);
  const handleDelete = useCallback(() => onDelete(event), [onDelete, event]);
  const handleViewSource = useCallback(() => onViewSource(event), [onViewSource, event]);

  return (
    <div className={`${css.msgActions} ${css.actionsVisible}`}>
      <Tooltip content={t('timeline.reply')} placement="top">
        <button
          type="button"
          className={css.msgActionBtn}
          aria-label={t('timeline.reply')}
          onClick={handleReply}
        >
          <ArrowBendUpLeftIcon size={14} />
        </button>
      </Tooltip>
      {onThreadClick && (
        <Tooltip content={t('timeline.replyInThread')} placement="top">
          <button
            type="button"
            className={css.msgActionBtn}
            aria-label={t('timeline.replyInThread')}
            onClick={handleThreadClick}
          >
            <ChatDotsIcon size={14} />
          </button>
        </Tooltip>
      )}
      <Tooltip content={t('timeline.react')} placement="top">
        <button
          type="button"
          className={css.msgActionBtn}
          aria-label={t('timeline.react')}
          onClick={handleReact}
        >
          <SmileyIcon size={14} />
        </button>
      </Tooltip>
      <Tooltip content={isPinned ? t('timeline.unpin') : t('timeline.pin')} placement="top">
        <button
          type="button"
          className={isPinned ? css.msgActionBtnPinned : css.msgActionBtn}
          aria-label={isPinned ? t('timeline.unpin') : t('timeline.pin')}
          onClick={onPin}
        >
          {isPinned ? <PushPinSlashIcon size={14} /> : <PushPinIcon size={14} />}
        </button>
      </Tooltip>
      {devModeEnabled && (
        <Tooltip content={t('timeline.viewSource')} placement="top">
          <button
            type="button"
            className={css.msgActionBtn}
            aria-label={t('timeline.viewSource')}
            onClick={handleViewSource}
          >
            <CodeIcon size={14} />
          </button>
        </Tooltip>
      )}
      {isOwn && (
        <Tooltip content={t('timeline.editAction')} placement="top">
          <button
            type="button"
            className={css.msgActionBtn}
            aria-label={t('timeline.editAction')}
            onClick={handleEdit}
          >
            <PencilSimpleIcon size={14} />
          </button>
        </Tooltip>
      )}
      {isOwn && (
        <Tooltip content={t('timeline.deleteAction')} placement="top">
          <button
            type="button"
            className={css.msgActionBtn}
            aria-label={t('timeline.deleteAction')}
            onClick={handleDelete}
          >
            <TrashIcon size={14} />
          </button>
        </Tooltip>
      )}
    </div>
  );
});
