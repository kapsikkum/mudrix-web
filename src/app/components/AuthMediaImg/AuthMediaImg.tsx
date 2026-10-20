import type { MatrixClient } from 'matrix-js-sdk';
import { SmileyStickerIcon, StickerIcon } from '@phosphor-icons/react';
import { useMediaBlobUrl } from '@/app/components/Avatar/useMediaBlobUrl';
import { useInView } from '@/app/hooks/useInView';
import * as css from './AuthMediaImg.css';

export type MediaPlaceholderKind = 'emoji' | 'sticker' | 'none';

export interface AuthMediaImgProps extends Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width' | 'height'
> {
  client: MatrixClient | null | undefined;
  mxcUrl: string | undefined | null;
  width?: number;
  height?: number;
  placeholder?: MediaPlaceholderKind;
  /** Only fetch while the image is near the viewport (use in big grids and lists). */
  lazy?: boolean;
}

export function AuthMediaImg({
  client,
  mxcUrl,
  width,
  height,
  alt,
  placeholder = 'emoji',
  lazy = false,
  className,
  style,
  ...rest
}: AuthMediaImgProps) {
  const [viewRef, inView] = useInView<HTMLElement>();
  const { src } = useMediaBlobUrl(client, mxcUrl, {
    width,
    height,
    enabled: !lazy || inView,
  });

  if (!src && mxcUrl && placeholder !== 'none') {
    const Glyph = placeholder === 'sticker' ? StickerIcon : SmileyStickerIcon;
    return (
      <span
        ref={lazy ? viewRef : undefined}
        className={[className, css.placeholderBox].filter(Boolean).join(' ')}
        style={{ ...style, display: 'inline-flex' }}
        role="img"
        aria-label={alt || undefined}
        aria-hidden={alt ? undefined : true}
      >
        <Glyph />
      </span>
    );
  }

  return (
    <img
      {...rest}
      ref={lazy ? (viewRef as (node: HTMLImageElement | null) => void) : undefined}
      className={className}
      style={style}
      src={src}
      alt={alt}
    />
  );
}

export default AuthMediaImg;
