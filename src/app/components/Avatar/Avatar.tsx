import { useState, useEffect, memo } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { fetchAvatarBlobUrl } from './avatarCache';
import * as css from './Avatar.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'fill';

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: css.avatarXs,
  sm: css.avatarSm,
  md: css.avatar,
  lg: css.avatarLg,
  xl: css.avatarXl,
  fill: css.avatarFill,
};

function getInitialAndHue(name: string): { initial: string; hue: number } {
  const safeName = name || '?';
  const code = safeName.codePointAt(0) ?? 63;
  const hue = Math.round((code * 137.508) % 360);
  return { initial: safeName.charAt(0).toUpperCase(), hue };
}

interface Props {
  name: string;
  mxcUrl?: string | null;
  client?: MatrixClient | null;
  size?: AvatarSize;
  className?: string;
}

export const Avatar = memo(function Avatar({
  name,
  mxcUrl,
  client,
  size = 'md',
  className,
}: Props) {
  const { initial, hue } = getInitialAndHue(name);

  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!mxcUrl || !client) {
      setImgSrc(null);
      return;
    }
    let cancelled = false;
    fetchAvatarBlobUrl(mxcUrl, client).then((url) => {
      if (!cancelled) setImgSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [mxcUrl, client]);

  const sizeClass = SIZE_CLASS[size];
  const combinedClass = className ? `${sizeClass} ${className}` : sizeClass;

  if (imgSrc) {
    return (
      <div className={combinedClass}>
        <img src={imgSrc} alt={name} className={css.avatarImg} />
      </div>
    );
  }

  return (
    <div
      className={combinedClass}
      style={{ backgroundColor: `hsl(${hue}, 60%, 42%)` }}
      aria-label={name}
    >
      {initial}
    </div>
  );
});
