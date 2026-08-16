import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk';
import { useDecryptedMedia } from './encryption';
import { getEncryptedFile } from '../encryptedMedia';
import { getMediaBlobUrl, getMediaAnimates } from './media';
import { AnimatedImage } from './AnimatedImage';
import { MediaLightbox } from '@/app/components/MediaLightbox/MediaLightbox';
import * as css from '../Timeline.css';

const MAX_VISIBLE = 8;

interface GalleryReady {
  src: string | null;
  requestFullRes: () => Promise<string | null>;
}

interface GalleryImageProps {
  index: number;
  event: MatrixEvent;
  client: MatrixClient;
  style?: CSSProperties;
  className?: string;
  onReady?: (index: number, ready: GalleryReady) => void;
  onOpen?: (index: number) => void;
}

function GalleryImage({
  index,
  event,
  client,
  style,
  className,
  onReady,
  onOpen,
}: GalleryImageProps) {
  const content = event.getContent() as Record<string, unknown>;
  const { mediaSrc, setMediaSrc, requestFullRes } = useDecryptedMedia(event, content, client);

  const encFile = getEncryptedFile(content);
  const mxcUrl = content.url as string | undefined;
  const src =
    mediaSrc ?? (!encFile && mxcUrl ? getMediaBlobUrl(mxcUrl, client, setMediaSrc) : null);
  const body = (content.body as string) ?? 'image';

  useEffect(() => {
    onReady?.(index, { src: mediaSrc, requestFullRes });
  }, [index, onReady, mediaSrc, requestFullRes]);

  const handleClick = useCallback(() => onOpen?.(index), [onOpen, index]);

  return (
    <button
      type="button"
      className={className ?? css.galleryTile}
      style={style}
      onClick={handleClick}
      aria-label={body}
      title={body}
    >
      {src ? (
        <AnimatedImage
          src={src}
          alt={body}
          mimeType={
            ((content.info as Record<string, unknown> | undefined)?.mimetype as
              | string
              | undefined) ?? undefined
          }
          className={css.galleryTileImg}
          wrapperClassName={css.animatedImageFill}
          isAnimated={getMediaAnimates(event)}
        />
      ) : (
        <div className={css.galleryTileSkeleton} />
      )}
    </button>
  );
}

const MemoGalleryImage = memo(GalleryImage);

interface MessageGalleryProps {
  events: MatrixEvent[];
  client: MatrixClient;
  senderName: string;
  senderAvatar: string | null;
}

export function MessageGallery({ events, client, senderName, senderAvatar }: MessageGalleryProps) {
  const count = events.length;
  const visibleCount = Math.min(count, MAX_VISIBLE);
  const extras = count > MAX_VISIBLE ? count - MAX_VISIBLE : 0;
  const cols = count >= 5 ? 3 : 2;

  const srcsRef = useRef<Array<GalleryReady | undefined>>([]);
  const [tick, setTick] = useState(0);

  const handleReady = useCallback((index: number, ready: GalleryReady) => {
    srcsRef.current[index] = ready;
    setTick((n) => n + 1);
  }, []);

  // Lightbox items are derived directly from the events array on every render, so
  // the count and the image at each index can never drift from the grid.
  const items = useMemo(
    () =>
      events.map((e, i) => ({
        src: srcsRef.current[i]?.src ?? null,
        filename: ((e.getContent()?.body as string | undefined) ?? 'image') || 'image',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, tick]
  );

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxTick, setLightboxTick] = useState(0);

  // Mount hidden decrypters for every out-of-view image once the lightbox opens,
  // so each slide resolves to the correct source.
  useEffect(() => {
    if (lightboxIndex === null) return;
    setLightboxTick((n) => n + 1);
  }, [lightboxIndex]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const ready = srcsRef.current[lightboxIndex];
    if (!ready?.src) return;
    void (async () => {
      const full = await ready.requestFullRes();
      if (full && srcsRef.current[lightboxIndex]?.src !== full) {
        srcsRef.current[lightboxIndex] = { ...ready, src: full };
        setTick((n) => n + 1);
      }
    })();
  }, [lightboxIndex, lightboxTick, tick]);

  const goPrev = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : (i - 1 + count) % count));
  }, [count]);

  const goNext = useCallback(() => {
    setLightboxIndex((i) => (i === null ? i : (i + 1) % count));
  }, [count]);

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };

  return (
    <>
      <div className={css.gallery} style={gridStyle}>
        {events.slice(0, visibleCount).map((event, idx) => {
          const isTall = count === 3 && idx === 0;
          return (
            <MemoGalleryImage
              key={event.getId() ?? idx}
              index={idx}
              event={event}
              client={client}
              style={isTall ? { gridRow: 'span 2' } : { aspectRatio: '1 / 1' }}
              onReady={handleReady}
              onOpen={setLightboxIndex}
            />
          );
        })}
        {extras > 0 && (
          <button
            type="button"
            className={css.galleryMore}
            style={{ aspectRatio: '1 / 1' }}
            onClick={() => setLightboxIndex(visibleCount)}
            aria-label={`+${extras}`}
          >
            +{extras}
          </button>
        )}
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox
          items={items}
          itemIndex={lightboxIndex}
          onPrev={goPrev}
          onNext={goNext}
          name={senderName}
          avatarMxc={senderAvatar}
          client={client}
          onClose={closeLightbox}
        />
      )}

      {lightboxIndex !== null &&
        Array.from({ length: count }, (_, i) => i)
          .filter((i) => i >= visibleCount)
          .map((i) => (
            <span key={i} style={{ display: 'none' }}>
              <MemoGalleryImage index={i} event={events[i]} client={client} onReady={handleReady} />
            </span>
          ))}
    </>
  );
}
