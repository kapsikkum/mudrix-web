import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { ArrowBendUpLeftIcon, XIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { formatUserId } from '@/util/matrix';
import * as css from '../Composer.css';

interface ReplyPreviewProps {
  replyTo: MatrixEvent;
  onClear: () => void;
  client: MatrixClient;
  roomId: string;
}

export function ReplyPreview({ replyTo, onClear, client, roomId }: ReplyPreviewProps) {
  const { t } = useTranslation();
  const senderId = replyTo.getSender() ?? '';
  const room = client.getRoom(roomId);
  const displayName = room?.getMember(senderId)?.name ?? formatUserId(senderId);

  return (
    <div className={css.replyPreview}>
      <ArrowBendUpLeftIcon size={14} />
      <span>
        <strong>{displayName}: </strong>
        {((replyTo.getContent()?.body as string) ?? '').substring(0, 80)}
      </span>
      <Tooltip content={t('composer.cancelReply')}>
        <button
          type="button"
          className={css.replyCancel}
          onClick={onClear}
          aria-label={t('composer.cancelReply')}
        >
          <XIcon size={14} />
        </button>
      </Tooltip>
    </div>
  );
}
