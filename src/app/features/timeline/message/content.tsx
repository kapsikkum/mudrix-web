import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { FileTextIcon, ProhibitIcon, LockIcon } from '@phosphor-icons/react';
import { highlightQuery } from '@/app/hooks/useSearch';
import { getEncryptedFile } from '../encryptedMedia';
import { renderTextContent } from './textContent';
import { getMediaBlobUrl } from './media';
import * as css from '../Timeline.css';
import * as headerCss from '../RoomHeader.css';

interface MessageContentProps {
  event: MatrixEvent;
  client: MatrixClient;
  mediaSrc: string | null;
  isDecrypting: boolean;
  isRedacted: boolean;
  isEncrypted: boolean;
  searchQuery: string;
  myId: string;
  senderName: string;
  onMediaLoad: (url: string) => void;
  onMediaClick?: (src: string) => void;
  roomId?: string;
  onMentionClick?: (userId: string, rect: DOMRect) => void;
}

export function MessageContent({
  event,
  client,
  mediaSrc,
  isDecrypting,
  isRedacted,
  isEncrypted,
  searchQuery,
  myId,
  senderName,
  onMediaLoad,
  onMediaClick,
  onMentionClick,
}: MessageContentProps) {
  const { t } = useTranslation();

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      const pill = (e.target as HTMLElement).closest('.mention-pill');
      if (pill && onMentionClick) {
        const userId = pill.getAttribute('data-user-id');
        if (userId) {
          onMentionClick(userId, pill.getBoundingClientRect());
        }
      }
    },
    [onMentionClick]
  );

  const content = event.getContent();
  const type = event.getType();

  if (isRedacted) {
    return (
      <span className={css.redactedMsg}>
        <ProhibitIcon size={14} /> {t('timeline.messageDeleted')}
      </span>
    );
  }

  if (isEncrypted) {
    return (
      <span className={css.redactedMsg}>
        <LockIcon size={14} /> {t('timeline.couldNotDecrypt')}
      </span>
    );
  }

  const msgtype = content?.msgtype as string | undefined;

  if (type === 'm.sticker' || msgtype === 'm.sticker') {
    const mxcUrl = content?.url as string;
    if (mxcUrl) {
      const src = mediaSrc ?? getMediaBlobUrl(mxcUrl, client, onMediaLoad);
      const info = content?.info as Record<string, unknown> | undefined;
      const imgW = info?.w as number | undefined;
      const imgH = info?.h as number | undefined;
      const hasDimensions =
        typeof imgW === 'number' && typeof imgH === 'number' && imgW > 0 && imgH > 0;
      return src ? (
        <img
          src={src}
          alt={(content?.body as string) ?? 'sticker'}
          className={css.msgSticker}
          width={hasDimensions ? imgW : undefined}
          height={hasDimensions ? imgH : undefined}
          onClick={() => onMediaClick?.(src)}
        />
      ) : (
        <span className={css.loadingText}>{t('timeline.loadingSticker')}</span>
      );
    }
  }

  if (msgtype === 'm.image') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;

    // File types that should not be rendered inline (SVG, TIFF, etc.)
    const mimetype = (content?.info?.mimetype as string) ?? '';
    const noInline = ['image/svg+xml'];
    if (noInline.includes(mimetype)) {
      return <span>{(content?.body as string) ?? 'file'}</span>;
    }

    const src =
      mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);

    const info = content?.info as Record<string, unknown> | undefined;
    const imgW = info?.w as number | undefined;
    const imgH = info?.h as number | undefined;
    const hasDimensions =
      typeof imgW === 'number' && typeof imgH === 'number' && imgW > 0 && imgH > 0;

    if (isDecrypting) {
      return <span className={css.loadingText}>{t('timeline.decrypting')}</span>;
    }
    if (encFile || mxcUrl) {
      return src ? (
        <img
          src={src}
          alt={(content?.body as string) ?? 'image'}
          className={css.msgImage}
          width={hasDimensions ? imgW : undefined}
          height={hasDimensions ? imgH : undefined}
          loading="lazy"
          onClick={() => onMediaClick?.(src)}
        />
      ) : (
        <span className={css.loadingText}>{t('timeline.loadingImage')}</span>
      );
    }
    return null;
  }

  if (msgtype === 'm.video') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const src =
      mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
    if (isDecrypting) {
      return <span className={css.loadingText}>{t('timeline.decrypting')}</span>;
    }
    if (encFile || mxcUrl) {
      if (src) {
        const info = content?.info as Record<string, unknown> | undefined;
        const vidW = info?.w as number | undefined;
        const vidH = info?.h as number | undefined;
        const hasDimensions =
          typeof vidW === 'number' && typeof vidH === 'number' && vidW > 0 && vidH > 0;
        return (
          <video
            src={src}
            controls
            className={css.msgVideo}
            width={hasDimensions ? vidW : undefined}
            height={hasDimensions ? vidH : undefined}
          />
        );
      }
      return <span className={css.loadingText}>{t('timeline.loadingVideo')}</span>;
    }
    return null;
  }

  if (msgtype === 'm.file') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const filename = (content?.body as string) ?? 'file';
    const src =
      mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
    if (isDecrypting) {
      return (
        <span className={css.loadingRow}>
          <FileTextIcon size={14} /> {t('timeline.decrypting')}
        </span>
      );
    }
    if (encFile || mxcUrl) {
      if (src) {
        return (
          <a href={src} download={filename} className={css.fileLink}>
            <FileTextIcon size={14} /> {filename}
          </a>
        );
      }
      return (
        <span className={css.loadingRow}>
          <FileTextIcon size={14} /> {t('timeline.loadingFile', { name: filename })}
        </span>
      );
    }
  }

  if (msgtype === 'm.emote') {
    return (
      <em className={css.emoteMsg}>
        * {senderName} {(content?.body as string) ?? ''}
      </em>
    );
  }

  if (msgtype === 'm.notice') {
    const html = renderTextContent(content as Record<string, unknown>, myId);
    return (
      <span
        className={css.noticeMsg}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleContentClick}
      />
    );
  }

  const body = (content?.body as string) ?? '';
  if (searchQuery && body) {
    const parts = highlightQuery(body, searchQuery);
    return (
      <span>
        {parts.map((p, i) =>
          p.highlighted ? (
            <mark key={i} className={headerCss.searchHighlight}>
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </span>
    );
  }

  const html = renderTextContent(content as Record<string, unknown>, myId);
  return <span dangerouslySetInnerHTML={{ __html: html }} onClick={handleContentClick} />;
}
