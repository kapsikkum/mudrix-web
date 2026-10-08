import { useCallback } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Tooltip } from '@/app/components/Tooltip';
import { useAvatarBlobUrl } from '@/app/components/Avatar/useAvatarBlobUrl';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import * as css from '../Timeline.css';

export function ReceiptAvatar({
  user,
  client,
  onClick,
}: {
  user: ReceiptUser;
  client: MatrixClient;
  onClick?: (el: HTMLElement) => void;
}) {
  const { data: imgSrc, refetch } = useAvatarBlobUrl(user.avatarUrl, client);

  const handleImgError = useCallback(() => {
    refetch();
  }, [refetch]);

  const { initial, hue } = (() => {
    const safeName = user.displayName || '?';
    const code = safeName.codePointAt(0) ?? 63;
    return { initial: safeName.charAt(0).toUpperCase(), hue: Math.round((code * 137.508) % 360) };
  })();

  const avatarStyle = imgSrc ? undefined : { backgroundColor: `hsl(${hue}, 60%, 42%)` };

  const child = imgSrc ? (
    <img
      src={imgSrc}
      alt={user.displayName}
      className={css.readReceiptAvatarImg}
      onError={handleImgError}
    />
  ) : (
    initial
  );

  if (onClick) {
    return (
      <Tooltip content={user.displayName}>
        <button
          type="button"
          className={[css.readReceiptAvatar, css.readReceiptAvatarBtn].join(' ')}
          style={avatarStyle}
          aria-label={user.displayName}
          aria-haspopup="listbox"
          onClick={(e) => onClick(e.currentTarget)}
        >
          {child}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={user.displayName}>
      <div className={css.readReceiptAvatar} style={avatarStyle} aria-label={user.displayName}>
        {child}
      </div>
    </Tooltip>
  );
}
