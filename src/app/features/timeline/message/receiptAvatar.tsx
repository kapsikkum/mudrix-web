import { useCallback } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { Tooltip } from '@/app/components/Tooltip';
import { useAvatarBlobUrl } from '@/app/components/Avatar/useAvatarBlobUrl';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import * as css from '../Timeline.css';

export function ReceiptAvatar({ user, client }: { user: ReceiptUser; client: MatrixClient }) {
  const { data: imgSrc, refetch } = useAvatarBlobUrl(user.avatarUrl, client);

  const handleImgError = useCallback(() => {
    refetch();
  }, [refetch]);

  const { initial, hue } = (() => {
    const safeName = user.displayName || '?';
    const code = safeName.codePointAt(0) ?? 63;
    return { initial: safeName.charAt(0).toUpperCase(), hue: Math.round((code * 137.508) % 360) };
  })();

  return (
    <Tooltip content={user.displayName}>
      <div
        className={css.readReceiptAvatar}
        style={imgSrc ? undefined : { backgroundColor: `hsl(${hue}, 60%, 42%)` }}
        aria-label={user.displayName}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={user.displayName}
            className={css.readReceiptAvatarImg}
            onError={handleImgError}
          />
        ) : (
          initial
        )}
      </div>
    </Tooltip>
  );
}
