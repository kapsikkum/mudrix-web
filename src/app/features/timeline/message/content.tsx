import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { M_POLL_START } from 'matrix-js-sdk';
import {
  FileTextIcon,
  ProhibitIcon,
  LockIcon,
  TrashIcon,
  MapPinIcon,
  ArrowsOutSimpleIcon,
} from '@phosphor-icons/react';
import { CopyButton } from '@/app/components/Button';
import { highlightQuery } from '@/app/hooks/useSearch';
import type { ImagePackImage } from '@/app/hooks/useImagePacks';
import { getEncryptedFile } from '../encryptedMedia';
import { renderTextContent, isRenderedEmojiOnly, getMediaCaption } from './textContent';
import { getMediaBlobUrl, getMediaAnimates } from './media';
import { MediaSpoiler } from './MediaSpoiler';
import type { MediaCover } from './MediaSpoiler';
import { AnimatedImage } from './AnimatedImage';
import { prettifyLinksAtom } from '@/app/store/atoms';
import { VoiceMessagePlayer } from '@/app/components/VoiceMessagePlayer/VoiceMessagePlayer';
import { PollViewer } from './PollViewer';
import { LinkPreview } from './LinkPreview';
import { extractFirstUrl } from '@/util/extractFirstUrl';
import * as css from '../Timeline.css';
import * as headerCss from '../RoomHeader.css';

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

function renderRichTextHtml(
  content: Record<string, unknown>,
  client: MatrixClient,
  imagePacks: Map<string, ImagePackImage> | undefined,
  myId: string,
  prettifyLinks: boolean
): string {
  // Convert mxc:// to HTTP in formatted_body before DOMPurify touches it
  const formattedBody = content.formatted_body as string | undefined;
  let renderContent = content;
  if (formattedBody && formattedBody.includes('mxc://')) {
    renderContent = {
      ...content,
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
  return html;
}

type RichSegment =
  | { type: 'html'; html: string }
  | { type: 'code'; element: HTMLElement }
  | { type: 'spoiler'; index: number; element: HTMLElement };

type RichEntry =
  | { kind: 'html'; html: string }
  | { kind: 'code'; element: HTMLElement }
  | { kind: 'spoiler'; index: number; element: HTMLElement };

function escapeHtmlText(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function serializeOpenTag(el: HTMLElement): string {
  let out = `<${el.tagName.toLowerCase()}`;
  for (const attr of Array.from(el.attributes)) {
    out += ` ${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`;
  }
  return `${out}>`;
}

function splitRichHtml(html: string): RichSegment[] {
  if (!html.includes('<pre') && !html.includes('data-mx-spoiler')) {
    return [{ type: 'html', html }];
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  const out: RichEntry[] = [];
  const pushHtml = (chunk: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === 'html') last.html += chunk;
    else out.push({ kind: 'html', html: chunk });
  };
  let spoilerIndex = 0;
  const walkChildren = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        pushHtml(escapeHtmlText(child.nodeValue ?? ''));
        continue;
      }
      const el = child as HTMLElement;
      if (el.tagName === 'PRE') {
        out.push({ kind: 'code', element: el });
        continue;
      }
      if (el.hasAttribute('data-mx-spoiler')) {
        out.push({ kind: 'spoiler', index: spoilerIndex++, element: el });
        continue;
      }
      if (el.querySelector('pre, [data-mx-spoiler]')) {
        pushHtml(serializeOpenTag(el));
        walkChildren(el);
        pushHtml(`</${el.tagName.toLowerCase()}>`);
      } else {
        pushHtml(el.outerHTML);
      }
    }
  };
  walkChildren(div);
  return out.map((e) =>
    e.kind === 'html'
      ? { type: 'html', html: e.html }
      : e.kind === 'code'
        ? { type: 'code', element: e.element }
        : { type: 'spoiler', index: e.index, element: e.element }
  );
}

function CodeBlock({ element }: { element: HTMLElement }) {
  const codeEl = element.querySelector('code');
  const text = codeEl?.textContent ?? element.textContent ?? '';
  const codeHtml = codeEl?.innerHTML ?? element.innerHTML;
  return (
    <div className={css.codeBlock}>
      <div className={css.codeBlockHeader}>
        <span className={css.codeBlockLabel}>code</span>
        <CopyButton text={text} className={css.codeCopyBtn} />
      </div>
      <pre dangerouslySetInnerHTML={{ __html: codeHtml }} />
    </div>
  );
}

function Spoiler({
  element,
  revealed,
  onReveal,
}: {
  element: HTMLElement;
  revealed: boolean;
  onReveal: () => void;
}) {
  const reason = element.getAttribute('data-mx-spoiler');
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onReveal();
    }
  };
  return (
    <>
      {reason && <span className="spoiler-reason">{`(${reason})`}</span>}
      <span
        data-mx-spoiler={reason ?? ''}
        data-mx-spoiler-revealed={revealed ? 'true' : undefined}
        role="button"
        tabIndex={0}
        onClick={onReveal}
        onKeyDown={handleKeyDown}
        dangerouslySetInnerHTML={{ __html: element.innerHTML }}
      />
    </>
  );
}

interface RichHtmlProps {
  html: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  revealedSpoilers: ReadonlySet<number>;
  onRevealSpoiler: (index: number) => void;
}

function RichHtml({
  html,
  className,
  onClick,
  onKeyDown,
  revealedSpoilers,
  onRevealSpoiler,
}: RichHtmlProps) {
  const segments = useMemo(() => splitRichHtml(html), [html]);
  return (
    <span className={className} onClick={onClick} onKeyDown={onKeyDown}>
      {segments.map((seg, i) => {
        if (seg.type === 'html') {
          return (
            <span
              key={i}
              className={css.richHtmlSegment}
              dangerouslySetInnerHTML={{ __html: seg.html }}
            />
          );
        }
        if (seg.type === 'code') {
          return <CodeBlock key={i} element={seg.element} />;
        }
        return (
          <Spoiler
            key={i}
            element={seg.element}
            revealed={revealedSpoilers.has(seg.index)}
            onReveal={() => onRevealSpoiler(seg.index)}
          />
        );
      })}
    </span>
  );
}

interface MediaSkeletonProps {
  className: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

function MediaSkeleton({ className, style, children }: MediaSkeletonProps) {
  return (
    <div className={className} style={style}>
      {children}
    </div>
  );
}

function MediaError() {
  const { t } = useTranslation();
  return (
    <span className={css.mediaError}>
      <LockIcon size={14} />
      <span>{t('timeline.couldNotDecrypt')}</span>
    </span>
  );
}

interface MessageContentProps {
  event: MatrixEvent;
  client: MatrixClient;
  mediaSrc: string | null;
  thumbnailSrc?: string | null;
  isDecrypting: boolean;
  mediaFailed: boolean;
  isRedacted: boolean;
  isEventDecrypting: boolean;
  isUndecryptable: boolean;
  searchQuery: string;
  myId: string;
  senderName: string;
  onMediaLoad: (url: string) => void;
  onMediaClick?: (src: string, type?: 'image' | 'video', opts?: { currentTime?: number }) => void;
  roomId?: string;
  onMentionClick?: (userId: string, rect: DOMRect) => void;
  optimisticBody?: string | null;
  imagePacks?: Map<string, ImagePackImage>;
  requestFullRes?: () => Promise<string | null>;
  mediaCover?: MediaCover | null;
  onRevealMedia?: () => void;
}

export function MessageContent({
  event,
  client,
  mediaSrc,
  thumbnailSrc = null,
  isDecrypting,
  mediaFailed,
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
  mediaCover = null,
  onRevealMedia,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<ReadonlySet<number>>(() => new Set());
  const handleRevealSpoiler = useCallback((index: number) => {
    setRevealedSpoilers((prev) => new Set(prev).add(index));
  }, []);

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
      return renderRichTextHtml(captionContent, client, imagePacks, myId, prettifyLinks);
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

  if (isUndecryptable || event.isDecryptionFailure()) {
    return (
      <span className={css.redactedMsg}>
        <LockIcon size={14} /> {t('timeline.couldNotDecrypt')}
      </span>
    );
  }

  if (isEventDecrypting || event.isBeingDecrypted()) {
    return (
      <span className={css.redactedMsg}>
        <LockIcon size={14} /> {t('timeline.decrypting')}
      </span>
    );
  }

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
      const info = content?.info as Record<string, unknown> | undefined;
      const sW = typeof info?.w === 'number' && info.w > 0 ? info.w : undefined;
      const sH = typeof info?.h === 'number' && info.h > 0 ? info.h : undefined;
      const boxStyle = sW && sH ? { aspectRatio: `${sW} / ${sH}` } : { aspectRatio: '1 / 1' };
      return (
        <div className={css.stickerBox} style={boxStyle}>
          {src ? (
            <AnimatedImage
              src={src}
              alt={(content?.body as string) ?? 'sticker'}
              mimeType={(content?.info?.mimetype as string) ?? undefined}
              className={css.mediaFill}
              wrapperClassName={css.mediaBoxFillWrap}
              isAnimated={getMediaAnimates(event)}
              requestFullRes={requestFullRes}
            />
          ) : mediaFailed ? (
            <MediaError />
          ) : (
            <div className={css.mediaBoxPulse} />
          )}
        </div>
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

    const isCovered = mediaCover != null;
    const src =
      mediaSrc ??
      (!isCovered && !encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);

    const info = content?.info as Record<string, unknown> | undefined;
    const imgW = info?.w as number | undefined;
    const imgH = info?.h as number | undefined;
    const hasDimensions =
      typeof imgW === 'number' && typeof imgH === 'number' && imgW > 0 && imgH > 0;
    // Reserve a fixed box from the event metadata so the layout never changes
    // while the media bytes are fetched, decrypted or loaded.
    const boxStyle = hasDimensions ? { aspectRatio: `${imgW} / ${imgH}` } : { height: 200 };

    if (encFile || mxcUrl) {
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const media = isCovered ? (
        <div className={css.mediaBox} style={boxStyle}>
          <MediaSpoiler
            label={mediaCover?.label}
            reason={mediaCover?.reason}
            onReveal={() => onRevealMedia?.()}
          />
        </div>
      ) : src ? (
        <div className={css.mediaBox} style={boxStyle}>
          <AnimatedImage
            src={src}
            alt={(content?.body as string) ?? 'image'}
            mimeType={mimetype}
            className={[css.mediaFill, css.mediaClickable].join(' ')}
            wrapperClassName={css.mediaBoxFillWrap}
            isAnimated={getMediaAnimates(event)}
            onClick={() => onMediaClick?.(src)}
            requestFullRes={requestFullRes}
          />
        </div>
      ) : mediaFailed ? (
        <MediaError />
      ) : (
        <div className={css.mediaBox} style={boxStyle}>
          <div className={css.mediaBoxPulse} />
        </div>
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <RichHtml
            html={captionHtml}
            className={css.mediaCaption}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
            revealedSpoilers={revealedSpoilers}
            onRevealSpoiler={handleRevealSpoiler}
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
      return <MediaSkeleton className={css.msgAudioSkeleton} />;
    }
    if (encFile || mxcUrl) {
      if (src) {
        return <VoiceMessagePlayer src={src} />;
      }
      return mediaFailed ? <MediaError /> : <MediaSkeleton className={css.msgAudioSkeleton} />;
    }
    return null;
  }

  if (msgtype === 'm.video') {
    const encFile = getEncryptedFile(content as Record<string, unknown>);
    const mxcUrl = content?.url as string | undefined;
    const isCovered = mediaCover != null;
    const src =
      mediaSrc ??
      (!isCovered && !encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, onMediaLoad) : null);
    const info = content?.info as Record<string, unknown> | undefined;
    const vidW = info?.w as number | undefined;
    const vidH = info?.h as number | undefined;
    const hasDimensions =
      typeof vidW === 'number' && typeof vidH === 'number' && vidW > 0 && vidH > 0;
    const boxStyle = hasDimensions ? { aspectRatio: `${vidW} / ${vidH}` } : { height: 200 };
    if (encFile || mxcUrl) {
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const media = isCovered ? (
        <div className={css.mediaBox} style={boxStyle}>
          <MediaSpoiler
            label={mediaCover?.label}
            reason={mediaCover?.reason}
            onReveal={() => onRevealMedia?.()}
          />
        </div>
      ) : src || thumbnailSrc ? (
        <div className={css.mediaBox} style={boxStyle}>
          <video
            ref={videoRef}
            src={src ?? undefined}
            poster={thumbnailSrc ?? undefined}
            controls
            playsInline
            className={css.mediaFill}
          />
          {src && (
            <button
              type="button"
              className={css.videoExpandBtn}
              onClick={(e) => {
                e.stopPropagation();
                videoRef.current?.pause();
                onMediaClick?.(src, 'video', {
                  currentTime: videoRef.current?.currentTime ?? 0,
                });
              }}
              aria-label={(content?.body as string) ?? 'video'}
            >
              <ArrowsOutSimpleIcon size={16} weight="bold" />
            </button>
          )}
        </div>
      ) : mediaFailed ? (
        <MediaError />
      ) : (
        <div className={css.mediaBox} style={boxStyle}>
          <div className={css.mediaBoxPulse} />
        </div>
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <RichHtml
            html={captionHtml}
            className={css.mediaCaption}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
            revealedSpoilers={revealedSpoilers}
            onRevealSpoiler={handleRevealSpoiler}
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
    if (isDecrypting) {
      return (
        <MediaSkeleton className={css.fileSkeleton}>
          <FileTextIcon size={14} />
        </MediaSkeleton>
      );
    }
    if (encFile || mxcUrl) {
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const media = src ? (
        <a href={src} download={filename} className={css.fileLink}>
          <FileTextIcon size={14} /> {filename}
        </a>
      ) : mediaFailed ? (
        <MediaError />
      ) : (
        <MediaSkeleton className={css.fileSkeleton}>
          <FileTextIcon size={14} />
        </MediaSkeleton>
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <RichHtml
            html={captionHtml}
            className={css.mediaCaption}
            onClick={handleContentClick}
            onKeyDown={handleContentKeyDown}
            revealedSpoilers={revealedSpoilers}
            onRevealSpoiler={handleRevealSpoiler}
          />
        </div>
      ) : (
        media
      );
    }
  }

  if (msgtype === 'm.emote') {
    const html = renderRichTextHtml(
      content as Record<string, unknown>,
      client,
      imagePacks,
      myId,
      prettifyLinks
    );
    return (
      <em className={css.emoteMsg}>
        * {senderName}{' '}
        <RichHtml
          html={html}
          onClick={handleContentClick}
          onKeyDown={handleContentKeyDown}
          revealedSpoilers={revealedSpoilers}
          onRevealSpoiler={handleRevealSpoiler}
        />
      </em>
    );
  }

  if (msgtype === 'm.notice') {
    const html = renderRichTextHtml(
      content as Record<string, unknown>,
      client,
      imagePacks,
      myId,
      prettifyLinks
    );
    return (
      <RichHtml
        html={html}
        className={css.noticeMsg}
        onClick={handleContentClick}
        onKeyDown={handleContentKeyDown}
        revealedSpoilers={revealedSpoilers}
        onRevealSpoiler={handleRevealSpoiler}
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

  const contentObj = content as Record<string, unknown>;
  let html = renderRichTextHtml(contentObj, client, imagePacks, myId, prettifyLinks);
  const firstUrl = extractFirstUrl(
    content?.body as string | undefined,
    content?.formatted_body as string | undefined
  );
  const isEncrypted =
    !!roomId && (roomId ? client.getRoom(roomId)?.hasEncryptionStateEvent() === true : false);
  const emojiOnlyMsg = isRenderedEmojiOnly(html);

  return (
    <div style={{ display: 'block' }}>
      <RichHtml
        html={html}
        className={emojiOnlyMsg ? css.emojiOnly : undefined}
        onClick={handleContentClick}
        onKeyDown={handleContentKeyDown}
        revealedSpoilers={revealedSpoilers}
        onRevealSpoiler={handleRevealSpoiler}
      />
      {firstUrl && <LinkPreview url={firstUrl} client={client} isEncrypted={isEncrypted} />}
    </div>
  );
}
