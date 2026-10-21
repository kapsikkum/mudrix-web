import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  XIcon,
  DownloadSimpleIcon,
  UploadSimpleIcon,
  TrashIcon,
  CaretLeftIcon,
  CaretRightIcon,
} from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/app/components/Avatar';
import { MediaSpoiler } from '@/app/features/timeline/message/MediaSpoiler';
import { DownloadLink } from '@/app/components/DownloadLink/DownloadLink';
import * as css from './MediaLightbox.css';

interface LightboxMedia {
  src: string | null;
  filename?: string;
  isSpoiler?: boolean;
  spoilerReason?: string;
  label?: string;
  revealed?: boolean;
}

interface MediaLightboxProps {
  src?: string;
  name?: string;
  filename?: string;
  client?: MatrixClient | null;
  avatarMxc?: string | null;
  type?: 'image' | 'video';
  initialTime?: number;
  onClose: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
  items?: LightboxMedia[];
  itemIndex?: number;
  onPrev?: () => void;
  onNext?: () => void;
  onRevealItem?: (index: number) => void;
}

const DEFAULT_ZOOM = 2.5;

export function MediaLightbox({
  src,
  name,
  filename,
  client,
  avatarMxc,
  type = 'image',
  initialTime = 0,
  onClose,
  onReplace,
  onRemove,
  items,
  itemIndex = 0,
  onPrev,
  onNext,
  onRevealItem,
}: MediaLightboxProps) {
  // Click the image to zoom in on it; while zoomed, moving the pointer pans across the picture
  // (the mouse position maps onto the image, like Discord) and the wheel changes the zoom.
  const [zoomed, setZoomed] = useState(false);
  const [zoomFactor, setZoomFactor] = useState(DEFAULT_ZOOM);
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [fitW, setFitW] = useState(0);
  const [fitH, setFitH] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasStartedPlayback = useRef(false);

  const isCarousel = items && items.length > 0;
  const curIndex = isCarousel
    ? Math.max(0, Math.min(itemIndex, (items as LightboxMedia[]).length - 1))
    : 0;
  const current = isCarousel ? (items as LightboxMedia[])[curIndex] : null;
  const curSrc = isCarousel ? (current?.src ?? '') : src;
  const curFilename = isCarousel ? (current?.filename ?? '') : (filename ?? '');

  useEffect(() => {
    setZoomed(false);
    setZoomFactor(DEFAULT_ZOOM);
    setFitW(0);
    setFitH(0);
  }, [curIndex, src]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (isCarousel && e.key === 'ArrowLeft') onPrev?.();
      if (isCarousel && e.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onPrev, onNext, isCarousel]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== e.currentTarget) return;
      if (zoomed) setZoomed(false);
      else onClose();
    },
    [onClose, zoomed]
  );

  const panTo = useCallback((clientX: number, clientY: number) => {
    setPan({
      x: Math.min(Math.max(clientX / window.innerWidth, 0), 1),
      y: Math.min(Math.max(clientY / window.innerHeight, 0), 1),
    });
  }, []);

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (zoomed) {
        setZoomed(false);
        return;
      }
      panTo(e.clientX, e.clientY);
      setZoomed(true);
    },
    [zoomed, panTo]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (zoomed) panTo(e.clientX, e.clientY);
    },
    [zoomed, panTo]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!zoomed) return;
      setZoomFactor((f) => Math.min(Math.max(f * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1.25), 10));
    },
    [zoomed]
  );

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFitW(rect.width);
    setFitH(rect.height);
  }, []);

  const isZoomed = zoomed && fitW > 0 && fitH > 0;

  let imgClassName = css.image;
  const imgStyle: React.CSSProperties = {};

  if (isZoomed) {
    const w = fitW * zoomFactor;
    const h = fitH * zoomFactor;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    imgClassName = css.imageZoomed;
    imgStyle.width = w;
    imgStyle.height = h;
    // An axis that still fits stays centred; one that overflows pans with the pointer.
    const tx = w <= vw ? (vw - w) / 2 : (vw - w) * pan.x;
    const ty = h <= vh ? (vh - h) / 2 : (vh - h) * pan.y;
    imgStyle.transform = `translate(${tx}px, ${ty}px)`;
  }

  const { t } = useTranslation();

  const toolbarContent = (
    <div className={css.toolbar}>
      {name ? (
        <>
          <Avatar name={name} mxcUrl={avatarMxc} client={client} size="xs" placeholder="logo" />
          <div className={css.toolbarMeta}>
            <span className={css.senderName}>{name}</span>
            {curFilename && <span className={css.imageName}>{curFilename}</span>}
          </div>
        </>
      ) : (
        curFilename && (
          <div className={css.toolbarMeta}>
            <span className={css.imageName}>{curFilename}</span>
          </div>
        )
      )}

      {isCarousel && (
        <>
          <span className={css.counter}>
            {curIndex + 1}/{items?.length}
          </span>
          <button
            type="button"
            className={css.navBtn}
            onClick={onPrev}
            aria-label={t('mediaLightbox.previous')}
          >
            <CaretLeftIcon size={18} weight="bold" />
          </button>
          <button
            type="button"
            className={css.navBtn}
            onClick={onNext}
            aria-label={t('mediaLightbox.next')}
          >
            <CaretRightIcon size={18} weight="bold" />
          </button>
        </>
      )}

      {onReplace && (
        <button type="button" className={css.actionBtn} onClick={onReplace}>
          <UploadSimpleIcon size={14} /> {t('mediaLightbox.replace')}
        </button>
      )}
      {onRemove && (
        <button type="button" className={css.actionBtn} onClick={onRemove}>
          <TrashIcon size={14} /> {t('mediaLightbox.remove')}
        </button>
      )}
      {curSrc && (
        <DownloadLink
          href={curSrc}
          filename={curFilename || 'image.png'}
          className={css.downloadBtn}
        >
          <DownloadSimpleIcon size={14} />
          {t('mediaLightbox.download')}
        </DownloadLink>
      )}
    </div>
  );

  return createPortal(
    <div
      className={css.overlay}
      role="presentation"
      onClick={handleOverlayClick}
      onContextMenu={handleContextMenu}
      onPointerMove={handlePointerMove}
      onWheel={handleWheel}
    >
      <button
        type="button"
        className={css.closeBtn}
        onClick={onClose}
        aria-label={t('common.close')}
      >
        <XIcon size={20} />
      </button>
      <div className={css.mediaWrap}>
        {isCarousel && current?.isSpoiler && !current.revealed ? (
          <div className={css.spoilerSlide}>
            <MediaSpoiler
              reason={current.spoilerReason}
              label={current.label}
              onReveal={() => onRevealItem?.(curIndex)}
            />
          </div>
        ) : curSrc && type === 'video' ? (
          <video
            ref={videoRef}
            src={curSrc}
            className={css.video}
            controls
            autoPlay
            playsInline
            onPlay={() => {
              hasStartedPlayback.current = true;
            }}
            onLoadedMetadata={() => {
              const el = videoRef.current;
              if (el && initialTime > 0 && !hasStartedPlayback.current) {
                el.currentTime = initialTime;
              }
            }}
            onContextMenu={(e) => e.stopPropagation()}
          />
        ) : curSrc ? (
          <img
            ref={imgRef}
            src={curSrc}
            alt=""
            className={imgClassName}
            style={imgStyle}
            onLoad={handleImgLoad}
            onClick={handleImageClick}
            draggable={false}
          />
        ) : (
          <div className={css.loading} />
        )}
      </div>
      {toolbarContent}
    </div>,
    document.body
  );
}
