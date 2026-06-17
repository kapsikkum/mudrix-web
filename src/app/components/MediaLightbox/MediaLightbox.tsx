import { useState, useEffect, useCallback, useRef } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import {
  XIcon,
  DownloadSimpleIcon,
  PlusIcon,
  MinusIcon,
  UploadSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import * as css from './MediaLightbox.css';

interface MediaLightboxProps {
  src: string;
  name: string;
  filename?: string;
  client?: MatrixClient | null;
  avatarMxc?: string | null;
  onClose: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
}

export function MediaLightbox({
  src,
  name,
  filename,
  client,
  avatarMxc,
  onClose,
  onReplace,
  onRemove,
}: MediaLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [fitW, setFitW] = useState(0);
  const [fitH, setFitH] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setZoom(1);
    setFitW(0);
    setFitH(0);
  }, [src]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setFitW(rect.width);
    setFitH(rect.height);
  }, []);

  const isZoomed = zoom > 1 && fitW > 0 && fitH > 0;

  let imgClassName = css.image;
  let imgStyle: React.CSSProperties = {};

  if (isZoomed) {
    imgClassName = css.imageZoomed;
    imgStyle.width = fitW * zoom;
    imgStyle.height = fitH * zoom;
    imgStyle.flexShrink = 0;
  }

  const zoomPercent = zoom === 1 ? 'Fit' : `${Math.round(zoom * 100)}%`;
  const canZoomOut = zoom > 1;
  const canZoomIn = zoom < 10;

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 10));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 1));
  }, []);

  const toolbarContent = (
    <div className={css.toolbar}>
      <Avatar name={name} mxcUrl={avatarMxc} client={client} size="xs" />
      <div className={css.toolbarMeta}>
        <span className={css.senderName}>{name}</span>
        {filename && <span className={css.imageName}>{filename}</span>}
      </div>

      <button
        type="button"
        className={css.zoomBtn}
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
      >
        <MinusIcon size={14} />
      </button>

      <button
        type="button"
        className={css.zoomLabel}
        onClick={() => setZoom(1)}
        disabled={zoom === 1}
      >
        {zoomPercent}
      </button>

      <button
        type="button"
        className={css.zoomBtn}
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
      >
        <PlusIcon size={14} />
      </button>

      {onReplace && (
        <button type="button" className={css.actionBtn} onClick={onReplace}>
          <UploadSimpleIcon size={14} /> Replace
        </button>
      )}
      {onRemove && (
        <button type="button" className={css.actionBtn} onClick={onRemove}>
          <TrashIcon size={14} /> Remove
        </button>
      )}
      <a href={src} download={filename ?? 'image.png'} className={css.downloadBtn}>
        <DownloadSimpleIcon size={14} />
        Download
      </a>
    </div>
  );

  return (
    <div className={css.overlay} onClick={handleOverlayClick} onContextMenu={handleContextMenu}>
      <button type="button" className={css.closeBtn} onClick={onClose} aria-label="Close">
        <XIcon size={20} />
      </button>
      <div className={css.mediaWrap} style={{ overflow: isZoomed ? 'auto' : 'hidden' }}>
        <img
          ref={imgRef}
          src={src}
          alt=""
          className={imgClassName}
          style={imgStyle}
          onLoad={handleImgLoad}
          draggable={false}
        />
      </div>
      {toolbarContent}
    </div>
  );
}
