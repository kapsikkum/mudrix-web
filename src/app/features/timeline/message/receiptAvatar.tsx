import { useState, useEffect } from 'react';
import type { MatrixClient } from 'matrix-js-sdk';
import { fetchAvatarBlobUrl } from '@/app/components/Avatar';
import type { ReceiptUser } from '@/app/hooks/useRoomReceipts';
import * as css from '../Timeline.css';

export function ReceiptAvatar({ user, client }: { user: ReceiptUser; client: MatrixClient }) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!user.avatarUrl) return;
    let cancelled = false;
    fetchAvatarBlobUrl(user.avatarUrl, client).then((url) => {
      if (!cancelled) setImgSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [user.avatarUrl, client]);

  const { initial, hue } = (() => {
    const safeName = user.displayName || '?';
    const code = safeName.codePointAt(0) ?? 63;
    return { initial: safeName.charAt(0).toUpperCase(), hue: Math.round((code * 137.508) % 360) };
  })();

  return (
    <div
      className={css.readReceiptAvatar}
      style={imgSrc ? undefined : { backgroundColor: `hsl(${hue}, 60%, 42%)` }}
      title={user.displayName}
      aria-label={user.displayName}
    >
      {imgSrc ? (
        <img src={imgSrc} alt={user.displayName} className={css.readReceiptAvatarImg} />
      ) : (
        initial
      )}
    </div>
  );
}
