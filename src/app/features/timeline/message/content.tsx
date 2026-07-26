import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { M_POLL_START } from 'matrix-js-sdk';
import { FileTextIcon, ProhibitIcon, LockIcon } from '@phosphor-icons/react';
import { highlightQuery } from '@/app/hooks/useSearch';
import type { ImagePackImage } from '@/app/hooks/useImagePacks';
import { getEncryptedFile } from '../encryptedMedia';
import { renderTextContent, isEmojiOnly } from './textContent';
import { getMediaBlobUrl } from './media';
import { preferencesAtom } from '@/app/store/atoms';
import { VoiceMessagePlayer } from '@/app/components/VoiceMessagePlayer/VoiceMessagePlayer';
import { PollViewer } from './PollViewer';
import { LinkPreview } from './LinkPreview';
import { extractFirstUrl } from '@/util/extractFirstUrl';
import * as css from '../Timeline.css';
import * as headerCss from '../RoomHeader.css';

interface MessageContentProps {
  event: MatrixEvent;
  client: MatrixClient;
  mediaSrc: string | null;
  isDecrypting: boolean;
  isRedacted: boolean;
  isEventDecrypting: boolean;
  isUndecryptable: boolean;
  searchQuery: string;
  myId: string;
  senderName: string;
  onMediaLoad: (url: string) => void;
  onMediaClick?: (src: string) => void;
  roomId?: string;
  onMentionClick?: (userId: string, rect: DOMRect) => void;
  optimisticBody?: string | null;
  imagePacks?: Map<string, ImagePackImage>;
}

export function MessageContent({
  event,
  client,
  mediaSrc,
  isDecrypting,
  isRedacted,
  isEventDecrypting,
  isUndecryptable,
  searchQuery,
  myId,
  senderName,
  onMediaLoad,
  onMediaClick,
  onMentionClick,
  roomId,
  optimisticBody = null,
  imagePacks,
}: MessageContentProps) {
  const { t } = useTranslation();
  const prefs = useAtomValue(preferencesAtom);

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

  const contentRef = useRef<HTMLSpanElement>(null);
  const revealedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const spoilers = el.querySelectorAll<HTMLElement>('[data-mx-spoiler]');
    if (!spoilers.length) return;

    // Remove stale labels from previous render
    el.querySelectorAll('.spoiler-reason').forEach((l) => l.remove());

    // Restore revealed state that survives DOM recreation
    spoilers.forEach((s, i) => {
      if (revealedRef.current.has(i)) {
        s.setAttribute('data-mx-spoiler-revealed', 'true');
      }
    });

    const handlers: ((e: MouseEvent) => void)[] = [];
    const labels: HTMLSpanElement[] = [];
    spoilers.forEach((s, i) => {
      const reason = s.getAttribute('data-mx-spoiler');
      if (reason) {
        const label = document.createElement('span');
        label.className = 'spoiler-reason';
        label.textContent = `(${reason})`;
        s.parentNode?.insertBefore(label, s);
        labels.push(label);
      }
      s.tabIndex = 0;
      const handler = () => {
        s.setAttribute('data-mx-spoiler-revealed', 'true');
        revealedRef.current.add(i);
      };
      s.addEventListener('click', handler);
      handlers.push(handler);
    });
    return () => {
      spoilers.forEach((s, i) => s.removeEventListener('click', handlers[i]));
      labels.forEach((l) => l.remove());
    };
  });

  // When an edit is in-flight, use the optimistic body instead of the SDK content
  const rawContent = event.getContent();
  const content =
    optimisticBody !== null
      ? { ...rawContent, body: optimisticBody, formatted_body: undefined }
      : rawContent;
  const type = event.getType();

  if (isRedacted) {
    return (
      <span className={css.redactedMsg}>
        <ProhibitIcon size={14} /> {t('timeline.messageDeleted')}
      </span>
    );
  }

  if (isUndecryptable) {
    return (
      <span className={css.redactedMsg}>
        <LockIcon size={14} /> {t('timeline.couldNotDecrypt')}
      </span>
    );
  }

  if (isEventDecrypting) return null;

  if (M_POLL_START.matches(type)) {
    return <PollViewer event={event} client={client} />;
  }

  const msgtype = content?.msgtype as string | undefined;

  if (type === 'm.sticker' || msgtype === 'm.sticker') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    if (encFile || mxcUrl) {
      const src =
        mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
      return src ? (
        <img src={src} alt={(content?.body as string) ?? 'sticker'} className={css.msgSticker} />
      ) : (
        <div className={css.stickerSkeleton} />
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
      return (
        <div
          className={css.msgImageSkeleton}
          style={hasDimensions ? { aspectRatio: `${imgW} / ${imgH}` } : { height: 200 }}
        />
      );
    }
    if (encFile || mxcUrl) {
      return src ? (
        <img
          src={src}
          alt={(content?.body as string) ?? 'image'}
          className={css.msgImage}
          width={hasDimensions ? imgW : undefined}
          height={hasDimensions ? imgH : undefined}
          style={hasDimensions ? { aspectRatio: `${imgW} / ${imgH}` } : undefined}
          loading="lazy"
          onClick={() => onMediaClick?.(src)}
        />
      ) : (
        <div
          className={css.msgImageSkeleton}
          style={hasDimensions ? { aspectRatio: `${imgW} / ${imgH}` } : { height: 200 }}
        />
      );
    }
    return null;
  }

  if (msgtype === 'm.audio') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const src =
      mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
    if (isDecrypting) {
      return <div className={css.msgAudioSkeleton} />;
    }
    if (encFile || mxcUrl) {
      if (src) {
        return <VoiceMessagePlayer src={src} />;
      }
      return <div className={css.msgAudioSkeleton} />;
    }
    return null;
  }

  if (msgtype === 'm.video') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const src =
      mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
    const info = content?.info as Record<string, unknown> | undefined;
    const vidW = info?.w as number | undefined;
    const vidH = info?.h as number | undefined;
    const hasDimensions =
      typeof vidW === 'number' && typeof vidH === 'number' && vidW > 0 && vidH > 0;
    if (isDecrypting) {
      return (
        <div
          className={css.msgImageSkeleton}
          style={hasDimensions ? { aspectRatio: `${vidW} / ${vidH}` } : { height: 200 }}
        />
      );
    }
    if (encFile || mxcUrl) {
      if (src) {
        return (
          <video
            src={src}
            controls
            className={css.msgVideo}
            style={hasDimensions ? { aspectRatio: `${vidW} / ${vidH}` } : undefined}
          />
        );
      }
      return (
        <div
          className={css.msgImageSkeleton}
          style={hasDimensions ? { aspectRatio: `${vidW} / ${vidH}` } : { height: 200 }}
        />
      );
    }
    return null;
  }

  if (msgtype === 'm.file') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const filename = (content?.body as string) ?? 'file';
    const src =
      mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
    if (isDecrypting || (encFile && !src)) {
      return (
        <span className={css.fileSkeleton}>
          <FileTextIcon size={14} />
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
        <span className={css.fileSkeleton}>
          <FileTextIcon size={14} />
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
    const html = renderTextContent(content as Record<string, unknown>, myId, prefs.prettifyLinks);
    return (
      <span
        ref={contentRef}
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

  // Convert mxc:// to HTTP in formatted_body before DOMPurify touches it
  const contentObj = content as Record<string, unknown>;
  const formattedBody = contentObj?.formatted_body as string | undefined;
  let renderContent = contentObj;
  if (formattedBody && formattedBody.includes('mxc://')) {
    renderContent = {
      ...contentObj,
      formatted_body: formattedBody.replace(/mxc:\/\/([^"'\s>)}]+)/g, (match) => {
        return (
          client.mxcUrlToHttp(match, undefined, undefined, undefined, undefined, undefined, true) ??
          match
        );
      }),
    };
  }
  let html = renderTextContent(renderContent, myId, prefs.prettifyLinks);
  if (imagePacks && imagePacks.size > 0) {
    html = html.replace(/:([a-z0-9_+]+):/gi, (match, shortcode) => {
      const pack = imagePacks.get(shortcode);
      if (!pack || !pack.usage.includes('emoticon')) return match;
      const src = client.mxcUrlToHttp(
        pack.url,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      if (!src) return match;
      return `<img src="${src.replace(/"/g, '&quot;')}" alt="${match}" class="${css.inlinePackEmoji}" />`;
    });
  }
  const firstUrl = extractFirstUrl(
    content?.body as string | undefined,
    content?.formatted_body as string | undefined
  );
  const isEncrypted =
    !!roomId && (roomId ? client.getRoom(roomId)?.hasEncryptionStateEvent() === true : false);
  const emojiOnlyMsg = isEmojiOnly(body);

  return (
    <div style={{ display: 'block' }}>
      <span
        ref={contentRef}
        className={emojiOnlyMsg ? css.emojiOnly : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleContentClick}
      />
      {firstUrl && <LinkPreview url={firstUrl} client={client} isEncrypted={isEncrypted} />}
    </div>
  );
}
