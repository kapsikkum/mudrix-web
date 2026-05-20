import { useState, useEffect, useCallback } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { XIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { Avatar } from '@/app/components/Avatar';
import * as css from './MediaLightbox.css';

const ZOOM_LEVELS = [0, 2, 4] as const;

interface MediaLightboxProps {
  src: string;
  name: string;
  filename?: string;
  client?: MatrixClient | null;
  avatarMxc?: string | null;
  onClose: () => void;
}

export function MediaLightbox({
  src,
  name,
  filename,
  client,
  avatarMxc,
  onClose,
}: MediaLightboxProps) {
  const [zoomIndex, setZoomIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleMediaClick = useCallback(() => {
    setZoomIndex((prev) => (prev + 1) % ZOOM_LEVELS.length);
  }, []);

  const zoom = ZOOM_LEVELS[zoomIndex];
  const isZoomed = zoom > 0;

  const toolbarContent = (
    <div className={css.toolbar}>
      <Avatar name={name} mxcUrl={avatarMxc} client={client} size="xs" />
      <div className={css.toolbarMeta}>
        <span className={css.senderName}>{name}</span>
        {filename && <span className={css.imageName}>{filename}</span>}
      </div>
      <a href={src} download={filename ?? 'image.png'} className={css.downloadBtn}>
        <DownloadSimpleIcon size={16} />
        Download
      </a>
    </div>
  );

  return (
    <div className={css.overlay} onClick={handleOverlayClick}>
      <button className={css.closeBtn} onClick={onClose} aria-label="Close">
        <XIcon size={20} />
      </button>
      <div className={css.mediaWrap} style={{ overflow: isZoomed ? 'auto' : undefined }}>
        <img
          src={src}
          alt=""
          className={isZoomed ? css.imageZoomed : css.image}
          style={{
            cursor: isZoomed ? 'zoom-out' : 'zoom-in',
            ...(isZoomed ? { transform: `scale(${zoom})`, transformOrigin: '0 0' } : {}),
          }}
          onClick={handleMediaClick}
          draggable={false}
        />
      </div>
      {toolbarContent}
    </div>
  );
}
