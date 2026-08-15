import { useCallback, memo } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import type { PresenceState } from '@/app/store/atoms';
import { useAvatarBlobUrl } from './useAvatarBlobUrl';
import { getInitialAndHue } from './avatarHue';
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

const PRESENCE_DOT_CLASS: Record<AvatarSize, string> = {
  xs: css.presenceDotXs,
  sm: css.presenceDotSm,
  md: css.presenceDotMd,
  lg: css.presenceDotLg,
  xl: css.presenceDotXl,
  fill: css.presenceDotFill,
};

const PRESENCE_COLOR_CLASS: Record<PresenceState, string> = {
  online: css.presenceOnline,
  unavailable: css.presenceUnavailable,
  offline: css.presenceOffline,
};

interface Props {
  name: string;
  mxcUrl?: string | null;
  client?: MatrixClient | null;
  size?: AvatarSize;
  className?: string;
  presence?: PresenceState;
}

export const Avatar = memo(function Avatar({
  name,
  mxcUrl,
  client,
  size = 'md',
  className,
  presence,
}: Props) {
  const { initial, hue } = getInitialAndHue(name);
  const { data: imgSrc, refetch } = useAvatarBlobUrl(mxcUrl, client);

  const handleImgError = useCallback(() => {
    refetch();
  }, [refetch]);

  const sizeClass = SIZE_CLASS[size];
  const combinedClass = className ? `${sizeClass} ${className}` : sizeClass;
  const wrapClass = size === 'fill' ? css.avatarWrapFill : css.avatarWrap;

  const dot = presence ? (
    <span
      className={`${PRESENCE_DOT_CLASS[size]} ${PRESENCE_COLOR_CLASS[presence]}`}
      aria-label={presence}
    />
  ) : null;

  if (imgSrc) {
    return (
      <div className={wrapClass}>
        <div className={combinedClass}>
          <img src={imgSrc} alt={name} className={css.avatarImg} onError={handleImgError} />
        </div>
        {dot}
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <div
        className={combinedClass}
        style={{ backgroundColor: `hsl(${hue}, 60%, 42%)` }}
        aria-label={name}
      >
        {initial}
      </div>
      {dot}
    </div>
  );
});
