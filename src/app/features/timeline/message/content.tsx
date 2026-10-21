import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtomValue } from 'jotai';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { M_POLL_START } from 'matrix-js-sdk';
import {
  FileTextIcon,
  EyeIcon,
  DownloadSimpleIcon,
  ProhibitIcon,
  LockIcon,
  TrashIcon,
  MapPinIcon,
  ArrowsOutSimpleIcon,
  StickerIcon,
} from '@phosphor-icons/react';
import { CopyButton } from '@/app/components/Button';
import {
  FilePreviewModal,
  TEXT_CARD_MAX_BYTES,
  TextFileCard,
  getFilePreviewKind,
} from './FilePreviewModal';
import { Tooltip } from '@/app/components/Tooltip';
import { highlightQuery } from '@/app/hooks/useSearch';
import type { ImagePackImage } from '@/app/hooks/useImagePacks';
import { getEncryptedFile } from '../encryptedMedia';
import { renderTextContent, isRenderedEmojiOnly, getMediaCaption } from './textContent';
import { getMediaBlobUrl, getMediaAnimates } from './media';
import { MediaSpoiler } from './MediaSpoiler';
import type { MediaCover } from './MediaSpoiler';
import { AnimatedImage } from './AnimatedImage';
import { GifFavouriteButton } from './GifFavouriteButton';
import { StickerPackPreviewModal } from './StickerPackPreviewModal';
import { findPackSourceForImage, type RoomPackSummary } from '@/app/hooks/useUserPacks';
import { getStateEventContent } from '@/util/matrix';
import { prettifyLinksAtom } from '@/app/store/atoms';
import { AudioFilePlayer } from '@/app/components/AudioFilePlayer/AudioFilePlayer';
import { VoiceMessagePlayer } from '@/app/components/VoiceMessagePlayer/VoiceMessagePlayer';
import { PollViewer } from './PollViewer';
import { LinkPreview } from './LinkPreview';
import { extractFirstUrl } from '@/util/extractFirstUrl';
import { formatFileSize } from '@/util/format';
import { mxcUrlToHttp } from '@/util/matrix/mxcUrl';
import { isMxcUrl } from '@/app/features/settings/emojis/imagePackTypes';
import { fetchMediaBlobUrl } from '@/app/components/Avatar';
import { UndecryptableMessage } from './UndecryptableMessage';
import { useToast } from '@/app/hooks/useToast';
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

/**
 * Intrinsic media size from the event metadata, used to reserve layout space before
 * any bytes load. Falls back to the thumbnail's size, which has the same aspect ratio.
 */
function getMediaDimensions(
  info: Record<string, unknown> | undefined
): { w: number; h: number } | undefined {
  const pick = (source: Record<string, unknown> | undefined) => {
    const w = source?.w;
    const h = source?.h;
    return typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 ? { w, h } : undefined;
  };
  return pick(info) ?? pick(info?.thumbnail_info as Record<string, unknown> | undefined);
}

const packsCache = new WeakMap<Map<string, ImagePackImage>, Map<string, string>>();

function mxcFromAuthMediaUrl(src: string): string | null {
  try {
    const url = new URL(src);
    const m = /\/_matrix\/client\/v1\/media\/(?:download|thumbnail)\/([^/]+)\/([^/?]+)/.exec(
      url.pathname
    );
    return m ? `mxc://${m[1]}/${m[2]}` : null;
  } catch {
    return null;
  }
}

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
      const src = mxcUrlToHttp(
        client,
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
      img.alt = '';
      img.title = match[0];
      img.className = css.inlinePackEmoji;
      if (pack.url.startsWith('mxc://')) {
        img.dataset.mediaMxc = pack.url;
      } else {
        img.src = src;
      }
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
  // Convert mxc:// to HTTP in formatted_body before DOMPurify touches it, and
  // record the origins we produce so the sanitizer only trusts those for <img>.
  const formattedBody = content.formatted_body as string | undefined;
  let renderContent = content;
  const allowedImgOrigins = new Set<string>();
  if (formattedBody && formattedBody.includes('mxc://')) {
    renderContent = {
      ...content,
      formatted_body: formattedBody.replace(/mxc:\/\/([^"'\s>)}]+)/g, (match) => {
        const converted =
          mxcUrlToHttp(
            client,
            match,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            true
          ) || match;
        if (converted !== match) {
          try {
            allowedImgOrigins.add(new URL(converted).origin);
          } catch {
            // Ignore URLs we can't parse.
          }
        }
        return converted;
      }),
    };
  }
  let html = renderTextContent(renderContent, myId, prettifyLinks, allowedImgOrigins);
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
  client?: MatrixClient | null;
  onClick?: (e: React.MouseEvent) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  revealedSpoilers: ReadonlySet<number>;
  onRevealSpoiler: (index: number) => void;
}

function RichHtml({
  html,
  className,
  client,
  onClick,
  onKeyDown,
  revealedSpoilers,
  onRevealSpoiler,
}: RichHtmlProps) {
  const segments = useMemo(() => splitRichHtml(html), [html]);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = wrapRef.current;
    if (!root || !client) return;

    for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
      if (img.dataset.mediaLoadHooked === 'done') continue;
      img.dataset.mediaLoadHooked = 'done';
      if (img.complete && img.naturalWidth > 0) {
        img.dataset.mediaLoaded = 'true';
      } else {
        img.addEventListener('load', () => {
          img.dataset.mediaLoaded = 'true';
        });
      }
    }

    const pending = root.querySelectorAll<HTMLImageElement>('img[data-media-mxc]:not([src])');
    for (const img of pending) {
      if (img.dataset.mediaMxcDone === 'done') continue;
      img.dataset.mediaMxcDone = 'done';
      const mxc = img.dataset.mediaMxc;
      if (!mxc) continue;
      fetchMediaBlobUrl(mxc, client)
        .then((url) => {
          if (url && url.startsWith('blob:') && img.isConnected) {
            img.src = url;
          }
        })
        .catch(() => {
          // Keep the placeholder glyph instead of showing a broken image.
        });
    }

    const imgs = root.querySelectorAll<HTMLImageElement>('img[src*="/_matrix/client/v1/media/"]');
    for (const img of imgs) {
      if (img.dataset.mxAuthMedia === 'done') continue;
      img.dataset.mxAuthMedia = 'done';
      const mxc = mxcFromAuthMediaUrl(img.src);
      if (!mxc) continue;
      fetchMediaBlobUrl(mxc, client)
        .then((url) => {
          if (url && url.startsWith('blob:') && img.isConnected) {
            img.src = url;
          }
        })
        .catch(() => {
          // keep as is
        });
    }
  }, [html, client, revealedSpoilers]);

  return (
    <span ref={wrapRef} className={className} onClick={onClick} onKeyDown={onKeyDown}>
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

interface StickerBoxProps {
  src: string | null;
  alt: string;
  mimeType?: string;
  isAnimated: boolean;
  mediaFailed: boolean;
  info?: Record<string, unknown>;
  requestFullRes?: () => Promise<string | null>;
  overlay?: React.ReactNode;
  onClick?: () => void;
}

function StickerBox({
  src,
  alt,
  mimeType,
  isAnimated,
  mediaFailed,
  info,
  requestFullRes,
  overlay,
  onClick,
}: StickerBoxProps) {
  const [measured, setMeasured] = useState<{ src: string; w: number; h: number } | null>(null);
  const infoDims = getMediaDimensions(info);
  const infoW = infoDims?.w;
  const infoH = infoDims?.h;
  const current = measured?.src === src ? measured : undefined;
  const w = infoW ?? current?.w;
  const h = infoH ?? current?.h;
  const boxStyle = w && h ? { aspectRatio: `${w} / ${h}` } : { aspectRatio: '1 / 1' };

  return (
    <div className={css.stickerBox} style={boxStyle}>
      {src ? (
        <AnimatedImage
          src={src}
          alt={alt}
          mimeType={mimeType}
          className={onClick ? [css.mediaFill, css.mediaClickable].join(' ') : css.mediaFill}
          wrapperClassName={css.mediaBoxFillWrap}
          isAnimated={isAnimated}
          fadeIn
          requestFullRes={requestFullRes}
          onClick={onClick}
          onLoad={
            infoW && infoH
              ? undefined
              : (img) => {
                  if (img.naturalWidth > 0 && img.naturalHeight > 0 && src) {
                    setMeasured({ src, w: img.naturalWidth, h: img.naturalHeight });
                  }
                }
          }
        />
      ) : mediaFailed ? (
        <MediaError />
      ) : (
        <div className={css.mediaBoxPulse}>
          <StickerIcon size={32} className={css.stickerPulseGlyph} />
        </div>
      )}
      {overlay}
    </div>
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

/** "Preview" button for PDF and text attachments, with its modal. */
function FilePreviewButton({
  src,
  filename,
  mimetype,
}: {
  src: string;
  filename: string;
  mimetype?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const kind = getFilePreviewKind(filename, mimetype);
  if (!kind) return null;
  return (
    <>
      <Tooltip content={t('timeline.filePreview.open')}>
        <button
          type="button"
          className={css.fileDownload}
          aria-label={t('timeline.filePreview.open')}
          onClick={() => setOpen(true)}
        >
          <EyeIcon size={16} />
        </button>
      </Tooltip>
      {open && (
        <FilePreviewModal
          src={src}
          filename={filename}
          kind={kind}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
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
  const toast = useToast();
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
  const [stickerPackPreview, setStickerPackPreview] = useState<RoomPackSummary | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<ReadonlySet<number>>(() => new Set());
  const [unencryptedMediaFailed, setUnencryptedMediaFailed] = useState(false);
  const handleMediaLoadFailed = useCallback(() => setUnencryptedMediaFailed(true), []);

  const handleStickerClick = useCallback(
    (mxcUrl: string) => {
      const pack = findPackSourceForImage(client, mxcUrl);
      if (!pack) {
        toast.info(t('timeline.stickerPack.unknown'));
        return;
      }
      const room = client.getRoom(pack.roomId);
      const isPublic =
        getStateEventContent(room ?? null, 'm.room.join_rules').join_rule === 'public';
      if (!isPublic) {
        toast.info(t('timeline.stickerPack.notPublic'));
        return;
      }
      setStickerPackPreview(pack);
    },
    [client, t, toast]
  );
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
    return <UndecryptableMessage event={event} client={client} />;
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
      const isDirect = Boolean(mxcUrl) && !isMxcUrl(mxcUrl as string);
      const src =
        mediaSrc ??
        (!encFile && mxcUrl
          ? isDirect
            ? (mxcUrl as string)
            : getMediaBlobUrl(mxcUrl as string, client, onMediaLoad)
          : null);
      const stickerInfo = content?.info as Record<string, unknown> | undefined;
      const mimeType = (stickerInfo?.mimetype as string) ?? undefined;
      const stickerDims = getMediaDimensions(stickerInfo);
      // A GIF is a gif-typed sticker event that isn't an image from a known sticker pack
      // (the GIF picker sends GIFs as sticker events, often encrypted, so pack membership
      // is what tells them apart from animated pack stickers). Only GIFs get the favourite
      // star, and only stickers open their pack. Favourites reuse the existing upload (or the
      // encrypted file descriptor) instead of re-downloading.
      const isPackSticker =
        !encFile && !isDirect && typeof mxcUrl === 'string'
          ? findPackSourceForImage(client, mxcUrl) !== null
          : false;
      const isGif = mimeType === 'image/gif' && !isPackSticker;
      const favouriteUrl = encFile?.url ?? (!isDirect ? mxcUrl : undefined);
      const canFavourite = isGif && typeof favouriteUrl === 'string';
      const canShowPack = isPackSticker && typeof mxcUrl === 'string';
      return (
        <>
          <StickerBox
            src={src}
            alt={(content?.body as string) ?? 'sticker'}
            mimeType={mimeType}
            mediaFailed={mediaFailed}
            isAnimated={getMediaAnimates(event)}
            info={stickerInfo}
            requestFullRes={requestFullRes}
            onClick={canShowPack ? () => handleStickerClick(mxcUrl as string) : undefined}
            overlay={
              canFavourite ? (
                <GifFavouriteButton
                  item={{
                    id: event.getId() ?? (favouriteUrl as string),
                    title: (content?.body as string) ?? 'GIF',
                    thumbUrl: favouriteUrl as string,
                    sendUrl: favouriteUrl as string,
                    width: stickerDims?.w ?? 0,
                    height: stickerDims?.h ?? 0,
                    provider: 'giphy',
                    mxcUrl: encFile ? undefined : mxcUrl,
                    mxcFile: encFile ?? undefined,
                    mxcInfo: {
                      mimetype: mimeType,
                      size: stickerInfo?.size as number | undefined,
                      is_animated: stickerInfo?.is_animated as boolean | undefined,
                    },
                  }}
                />
              ) : undefined
            }
          />
          {stickerPackPreview && (
            <StickerPackPreviewModal
              client={client}
              pack={stickerPackPreview}
              onClose={() => setStickerPackPreview(null)}
            />
          )}
        </>
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
      (!isCovered && !encFile && mxcUrl && !unencryptedMediaFailed
        ? getMediaBlobUrl(mxcUrl, client, onMediaLoad, handleMediaLoadFailed)
        : null);

    const info = content?.info as Record<string, unknown> | undefined;
    const imgDims = getMediaDimensions(info);
    // Reserve a box sized from the event metadata so the layout never changes while
    // the media bytes are fetched, decrypted or loaded. Both dimensions are scaled down
    // together (not just height clamped) so the box always matches the image's own
    // aspect ratio exactly - otherwise object-fit: contain would letterbox tall or wide
    // images, showing the box's background colour as bars around the picture.
    const MAX_MEDIA_W = 320;
    const MAX_MEDIA_H = 420;
    const boxStyle = imgDims
      ? (() => {
          const scale = Math.min(MAX_MEDIA_W / imgDims.w, MAX_MEDIA_H / imgDims.h, 1);
          return {
            width: Math.round(imgDims.w * scale),
            height: Math.round(imgDims.h * scale),
          };
        })()
      : { width: MAX_MEDIA_W, height: 200 };

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
            fadeIn
            onClick={() => onMediaClick?.(src)}
            requestFullRes={requestFullRes}
          />
        </div>
      ) : mediaFailed || unencryptedMediaFailed ? (
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
            client={client}
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
    const audioMeta = content['org.matrix.msc1767.audio'] as
      | { duration?: number; waveform?: number[] }
      | undefined;
    const info = content.info as { duration?: number; size?: number } | undefined;
    const durationMs =
      typeof audioMeta?.duration === 'number'
        ? audioMeta.duration
        : typeof info?.duration === 'number'
          ? info.duration
          : undefined;
    const waveform = Array.isArray(audioMeta?.waveform) ? audioMeta.waveform : undefined;
    const isVoiceMessage = content['org.matrix.msc3245.voice'] != null || audioMeta != null;
    if (isDecrypting) {
      return isVoiceMessage ? (
        <MediaSkeleton className={css.msgAudioSkeleton} />
      ) : (
        <MediaSkeleton className={css.fileSkeleton}>
          <FileTextIcon size={20} />
        </MediaSkeleton>
      );
    }
    if (encFile || mxcUrl) {
      if (src) {
        if (isVoiceMessage) {
          return <VoiceMessagePlayer src={src} waveform={waveform} durationMs={durationMs} />;
        }
        const fileName = (content?.body as string | undefined) ?? t('timeline.audioFile');
        const size = typeof info?.size === 'number' && info.size >= 0 ? info.size : undefined;
        return (
          <AudioFilePlayer src={src} fileName={fileName} size={size} durationMs={durationMs} />
        );
      }
      return mediaFailed ? (
        <MediaError />
      ) : isVoiceMessage ? (
        <MediaSkeleton className={css.msgAudioSkeleton} />
      ) : (
        <MediaSkeleton className={css.fileSkeleton}>
          <FileTextIcon size={20} />
        </MediaSkeleton>
      );
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
    const vidDims = getMediaDimensions(info);
    const boxStyle = vidDims
      ? (() => {
          const scale = Math.min(320 / vidDims.w, 420 / vidDims.h, 1);
          return {
            width: Math.round(vidDims.w * scale),
            height: Math.round(vidDims.h * scale),
          };
        })()
      : { width: 320, height: 200 };
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
            client={client}
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
          <FileTextIcon size={20} />
        </MediaSkeleton>
      );
    }
    if (encFile || mxcUrl) {
      const captionHtml = renderCaptionHtml(content as Record<string, unknown>);
      const info = content?.info as Record<string, unknown> | undefined;
      const size = typeof info?.size === 'number' && info.size >= 0 ? info.size : undefined;
      const mimetype = typeof info?.mimetype === 'string' ? info.mimetype : undefined;
      const textPreview =
        src &&
        getFilePreviewKind(filename, mimetype) === 'text' &&
        (size === undefined || size <= TEXT_CARD_MAX_BYTES);
      const media = src ? (
        textPreview ? (
          <TextFileCard src={src} filename={filename} size={size} />
        ) : (
          <div className={css.fileCard}>
            <span className={css.fileIcon}>
              <FileTextIcon size={20} />
            </span>
            <span className={css.fileInfo}>
              <Tooltip content={filename} multiline>
                <span className={css.fileName}>{filename}</span>
              </Tooltip>
              {size !== undefined && <span className={css.fileSize}>{formatFileSize(size)}</span>}
            </span>
            <FilePreviewButton src={src} filename={filename} mimetype={mimetype} />
            <Tooltip content={t('mediaLightbox.download')}>
              <a
                href={src}
                download={filename}
                className={css.fileDownload}
                aria-label={t('mediaLightbox.download')}
              >
                <DownloadSimpleIcon size={16} />
              </a>
            </Tooltip>
          </div>
        )
      ) : mediaFailed ? (
        <MediaError />
      ) : (
        <MediaSkeleton className={css.fileSkeleton}>
          <FileTextIcon size={20} />
        </MediaSkeleton>
      );
      return captionHtml ? (
        <div className={css.mediaWrap}>
          {media}
          <RichHtml
            html={captionHtml}
            client={client}
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
          client={client}
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
        client={client}
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
    const mscLocation = locationContent['org.matrix.msc3488.location'] as
      | { description?: string }
      | undefined;
    const label =
      mscLocation?.description ??
      (locationContent['title'] as string | undefined) ??
      (locationContent['org.matrix.msc3488.body'] as string | undefined);
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
        client={client}
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
