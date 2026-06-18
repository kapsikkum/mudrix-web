import { useTranslation } from 'react-i18next';
import type { MatrixEvent } from 'matrix-js-sdk';
import { ArrowBendUpLeftIcon, XIcon } from '@phosphor-icons/react';
import { Tooltip } from '@/app/components/Tooltip';
import { formatUserId } from '@/util/matrix';
import * as css from '../Composer.css';

interface ReplyPreviewProps {
  replyTo: MatrixEvent;
  onClear: () => void;
}

export function ReplyPreview({ replyTo, onClear }: ReplyPreviewProps) {
  const { t } = useTranslation();
  return (
    <div className={css.replyPreview}>
      <ArrowBendUpLeftIcon size={14} />
      <span>
        <strong>{formatUserId(replyTo.getSender())}: </strong>
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
