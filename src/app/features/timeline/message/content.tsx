import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { M_POLL_START } from 'matrix-js-sdk';
import {
  FileTextIcon,
  ProhibitIcon,
  LockIcon,
  CopyIcon,
  CheckIcon,
  TrashIcon,
  MapPinIcon,
} from '@phosphor-icons/react';
import { createRoot, type Root } from 'react-dom/client';
import { IconButton } from '@/app/components/Button';
import { highlightQuery } from '@/app/hooks/useSearch';
import type { ImagePackImage } from '@/app/hooks/useImagePacks';
import { getEncryptedFile } from '../encryptedMedia';
import { renderTextContent, isRenderedEmojiOnly, getMediaCaption } from './textContent';
import { getMediaBlobUrl, getMediaAnimates } from './media';
import { AnimatedImage } from './AnimatedImage';
import { prettifyLinksAtom } from '@/app/store/atoms';
import { VoiceMessagePlayer } from '@/app/components/VoiceMessagePlayer/VoiceMessagePlayer';
import { PollViewer } from './PollViewer';
import { LinkPreview } from './LinkPreview';
import { extractFirstUrl } from '@/util/extractFirstUrl';
import * as css from '../Timeline.css';
import * as headerCss from '../RoomHeader.css';

function CodeBlockCopyButton({ text }: { text: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!copied && !failed) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [copied, failed]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => setFailed(true));
  };

  const tooltip = failed ? t('common.copyFailed') : copied ? t('common.copied') : t('common.copy');

  return (
    <IconButton
      size="sm"
      className={css.codeCopyBtn}
      tooltip={tooltip}
      aria-label={tooltip}
      onClick={handleClick}
    >
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </IconButton>
  );
}

function parseGeoUri(uri: string | undefined): { lat: number; lon: number } | null {
  if (!uri) return null;
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(uri);
  if (!m) return null;
  const lat = Number.parseFloat(m[1]);
  const lon = Number.parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

const packsCache = new WeakMap<Map<string, ImagePackImage>, Map<string, string>>();

function applyImagePacks(
  baseHtml: string,
  imagePacks: Map<string, ImagePackImage>,
  client: MatrixClient
): string {
  let inner = packsCache.get(imagePacks);
  if (!inner) {
    inner = new Map();
    packsCache.set(imagePacks, inner);
  }
  const cached = inner.get(baseHtml);
  if (cached !== undefined) return cached;
  const scratchDiv = document.createElement('div');
  scratchDiv.innerHTML = baseHtml;
  const SHORTCODE_RE = /:([a-zA-Z0-9_-]+):/g;
  const walker = document.createTreeWalker(scratchDiv, NodeFilter.SHOW_TEXT);
  const replacements: Array<{ node: Text; fragments: (string | HTMLImageElement)[] }> = [];
  let node: Text | null;
  while ((node = walker.nextNode() as Text | null)) {
    const text = node.nodeValue ?? '';
    if (!text.includes(':')) continue;
    SHORTCODE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let lastIdx = 0;
    const fragments: (string | HTMLImageElement)[] = [];
    let hadMatch = false;
    while ((match = SHORTCODE_RE.exec(text)) !== null) {
      const shortcode = match[1];
      const pack = imagePacks.get(shortcode);
      if (!pack || !pack.usage.includes('emoticon')) continue;
      const src = client.mxcUrlToHttp(
        pack.url,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        true
      );
      if (!src) continue;
      hadMatch = true;
      if (match.index > lastIdx) fragments.push(text.slice(lastIdx, match.index));
      const img = document.createElement('img');
      img.src = src;
      img.alt = match[0];
      img.className = css.inlinePackEmoji;
      fragments.push(img);
      lastIdx = match.index + match[0].length;
    }
    if (hadMatch) {
      if (lastIdx < text.length) fragments.push(text.slice(lastIdx));
      replacements.push({ node, fragments });
    }
  }
  for (const { node: textNode, fragments } of replacements) {
    const parent = textNode.parentNode;
    if (!parent) continue;
    for (const frag of fragments) {
      if (typeof frag === 'string') {
        parent.insertBefore(document.createTextNode(frag), textNode);
      } else {
        parent.insertBefore(frag, textNode);
      }
    }
    parent.removeChild(textNode);
  }
  const result = scratchDiv.innerHTML;
  if (inner.size > 200) inner.clear();
  inner.set(baseHtml, result);
  return result;
}

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
  requestFullRes?: () => Promise<string | null>;
  onRetryDecrypt?: () => void;
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
  requestFullRes,
  onRetryDecrypt,
}: MessageContentProps) {
  const { t } = useTranslation();
  const prettifyLinks = useAtomValue(prettifyLinksAtom);

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

  const handleContentKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const pill = (e.target as HTMLElement).closest('.mention-pill');
      if (!pill || !onMentionClick) return;
      e.preventDefault();
      const userId = pill.getAttribute('data-user-id');
      if (userId) {
        onMentionClick(userId, pill.getBoundingClientRect());
      }
    },
    [onMentionClick]
  );

  const contentRef = useRef<HTMLSpanElement>(null);
  const revealedRef = useRef<Set<number>>(new Set());
  const copyRootsRef = useRef<Map<HTMLElement, Root>>(new Map());

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

    const handlers: ((e: Event) => void)[] = [];
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
      s.setAttribute('role', 'button');
      const handler = () => {
        s.setAttribute('data-mx-spoiler-revealed', 'true');
        revealedRef.current.add(i);
      };
      const keyHandler = (e: Event) => {
        const ke = e as KeyboardEvent;
        if (ke.key === 'Enter' || ke.key === ' ') {
          ke.preventDefault();
          handler();
        }
      };
      s.addEventListener('click', handler);
      s.addEventListener('keydown', keyHandler);
      handlers.push(handler, keyHandler);
    });
    return () => {
      spoilers.forEach((s, i) => {
        s.removeEventListener('click', handlers[i * 2]);
        s.removeEventListener('keydown', handlers[i * 2 + 1]);
      });
      labels.forEach((l) => l.remove());
    };
  });

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    copyRootsRef.current.forEach((root) => root.unmount());
    copyRootsRef.current.clear();
    el.querySelectorAll<HTMLElement>('[data-code-copy-host]').forEach((h) => h.remove());

    const roots = new Map<HTMLElement, Root>();
    el.querySelectorAll('pre').forEach((pre) => {
      const codeEl = pre.querySelector('code');
      const text = codeEl?.textContent ?? pre.textContent ?? '';
      if (!text.trim()) return;

      const host = document.createElement('span');
      host.dataset.codeCopyHost = 'true';
      pre.appendChild(host);

      const root = createRoot(host);
      root.render(<CodeBlockCopyButton text={text} />);
      roots.set(host, root);
    });
    copyRootsRef.current = roots;

    return () => {
      copyRootsRef.current.forEach((root) => root.unmount());
      copyRootsRef.current.clear();
    };
  });

  // When an edit is in-flight, use the optimistic body instead of the SDK content
  const rawContent = event.getContent();
  const content =
    optimisticBody !== null
      ? { ...rawContent, body: optimisticBody, formatted_body: undefined }
      : rawContent;
  const type = event.getType();

  const renderCaptionHtml = useCallback(
    (captionContent: Record<string, unknown>): string | undefined => {
      if (getMediaCaption(captionContent) === undefined) return undefined;
      const formattedBody = captionContent.formatted_body as string | undefined;
      let renderContent = captionContent;
      if (formattedBody && formattedBody.includes('mxc://')) {
        renderContent = {
          ...captionContent,
          formatted_body: formattedBody.replace(/mxc:\/\/([^"'\s>)}]+)/g, (match) => {
            return (
              client.mxcUrlToHttp(
                match,
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                true
              ) ?? match
            );
          }),
        };
      }
      let html = renderTextContent(renderContent, myId, prettifyLinks);
      if (imagePacks && imagePacks.size > 0) {
        html = applyImagePacks(html, imagePacks, client);
      }
      return html;
    },
    [client, myId, prettifyLinks, imagePacks]
  );

  if (isRedacted) {
    const isUserDeleted = event.isRedacted()
      ? (() => {
          const redaction = event.getRedactionEvent();
          const sender =
            redaction && typeof redaction === 'object' && 'sender' in redaction
              ? (redaction as { sender?: string }).sender
              : undefined;
          return sender !== undefined ? sender === event.getSender() : false;
        })()
      : true;
    return (
      <span className={css.redactedMsg}>
        {isUserDeleted ? <TrashIcon size={14} /> : <ProhibitIcon size={14} />}{' '}
        {t('timeline.messageDeleted')}
      </span>
    );
  }

  if (isUndecryptable) {
    return (
      <span className={css.redactedMsg}>
        <LockIcon size={14} /> {t('timeline.couldNotDecrypt')}
        {onRetryDecrypt && (
          <button type="button" className={css.mediaRetry} onClick={onRetryDecrypt}>
            {t('common.retry')}
          </button>
        )}
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
        <AnimatedImage
          src={src}
          alt={(content?.body as string) ?? 'sticker'}
          mimeType={(content?.info?.mimetype as string) ?? undefined}
          className={css.msgSticker}
          wrapperClassName={css.animatedImageWrap}
          isAnimated={getMediaAnimates(event)}
          requestFullRes={requestFullRes}
        />
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
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const media = src ? (
        <AnimatedImage
          src={src}
          alt={(content?.body as string) ?? 'image'}
          mimeType={mimetype}
          className={css.msgImage}
          wrapperClassName={css.animatedImageWrap}
          isAnimated={getMediaAnimates(event)}
          style={hasDimensions ? { aspectRatio: `${imgW} / ${imgH}` } : undefined}
          onClick={() => onMediaClick?.(src)}
          requestFullRes={requestFullRes}
        />
      ) : (
        <div
          className={css.msgImageSkeleton}
          style={hasDimensions ? { aspectRatio: `${imgW} / ${imgH}` } : { height: 200 }}
        />
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <span
            ref={contentRef}
            className={css.mediaCaption}
            dangerouslySetInnerHTML={{ __html: captionHtml }}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
          />
        </div>
      ) : (
        media
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
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const media = src ? (
        <video
          src={src}
          controls
          className={css.msgVideo}
          style={hasDimensions ? { aspectRatio: `${vidW} / ${vidH}` } : undefined}
        />
      ) : (
        <div
          className={css.msgImageSkeleton}
          style={hasDimensions ? { aspectRatio: `${vidW} / ${vidH}` } : { height: 200 }}
        />
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <span
            ref={contentRef}
            className={css.mediaCaption}
            dangerouslySetInnerHTML={{ __html: captionHtml }}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
          />
        </div>
      ) : (
        media
      );
    }
    return null;
  }

  if (msgtype === 'm.file') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const filename =
      (content?.filename as string | undefined) ?? (content?.body as string) ?? 'file';
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
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const media = src ? (
        <a href={src} download={filename} className={css.fileLink}>
          <FileTextIcon size={14} /> {filename}
        </a>
      ) : (
        <span className={css.fileSkeleton}>
          <FileTextIcon size={14} />
        </span>
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <span
            ref={contentRef}
            className={css.mediaCaption}
            dangerouslySetInnerHTML={{ __html: captionHtml }}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
          />
        </div>
      ) : (
        media
      );
    }
  }

  if (msgtype === 'm.emote') {
    const html = renderTextContent(content as Record<string, unknown>, myId, prettifyLinks);
    return (
      <em className={css.emoteMsg}>
        * {senderName}{' '}
        <span
          ref={contentRef}
          dangerouslySetInnerHTML={{ __html: html }}
          onClick={handleContentClick}
          onKeyDown={handleContentKeyDown}
        />
      </em>
    );
  }

  if (msgtype === 'm.notice') {
    const html = renderTextContent(content as Record<string, unknown>, myId, prettifyLinks);
    return (
      <span
        ref={contentRef}
        className={css.noticeMsg}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleContentClick}
        onKeyDown={handleContentKeyDown}
      />
    );
  }

  if (msgtype === 'm.location') {
    const locationContent = content as Record<string, unknown>;
    const geo = parseGeoUri(locationContent.geo_uri as string | undefined);
    const label =
      (locationContent['org.matrix.msc3488.body'] as string | undefined) ??
      (locationContent['title'] as string | undefined);
    return (
      <span className={css.locationMsg}>
        <MapPinIcon size={14} weight="fill" />
        <span>{label ?? t('timeline.locationShared')}</span>
        {geo && (
          <a
            href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lon}#map=16/${geo.lat}/${geo.lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className={css.locationLink}
          >
            {t('timeline.openInOpenStreetMap')}
          </a>
        )}
      </span>
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
  let html = renderTextContent(renderContent, myId, prettifyLinks);
  const baseHtml = html;
  if (imagePacks && imagePacks.size > 0) {
    html = applyImagePacks(baseHtml, imagePacks, client);
  }
  const firstUrl = extractFirstUrl(
    content?.body as string | undefined,
    content?.formatted_body as string | undefined
  );
  const isEncrypted =
    !!roomId && (roomId ? client.getRoom(roomId)?.hasEncryptionStateEvent() === true : false);
  const emojiOnlyMsg = isRenderedEmojiOnly(html);

  return (
    <div style={{ display: 'block' }}>
      <span
        ref={contentRef}
        className={emojiOnlyMsg ? css.emojiOnly : undefined}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={handleContentClick}
        onKeyDown={handleContentKeyDown}
      />
      {firstUrl && <LinkPreview url={firstUrl} client={client} isEncrypted={isEncrypted} />}
    </div>
  );
}
