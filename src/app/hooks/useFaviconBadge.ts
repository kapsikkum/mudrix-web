import { useEffect, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { themeAtom } from '@/app/store/atoms';
import { THEME_LOGO_ASSETS } from '@/theme/themeLogos';

import { roomState } from '@/util/matrix';

function setFavicon(href: string) {
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')) {
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  }
}

export function useFaviconBadge() {
  const client = getMatrixClientOrNull();
  const theme = useAtomValue(themeAtom);

  const checkUnread = useCallback(() => {
    const assets = THEME_LOGO_ASSETS[theme];
    if (!client) {
      setFavicon(assets.logo);
      return;
    }
    const hasUnread = client.getRooms().some((room) => {
      if (room.getMyMembership() !== 'join') return false;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) return false;
      return (room.getRoomUnreadNotificationCount() ?? 0) > 0;
    });
    setFavicon(hasUnread ? assets.notification : assets.logo);
  }, [client, theme]);

  useEffect(() => {
    checkUnread();
  }, [checkUnread]);

  useMatrixEvent(client, 'Room.UnreadNotifications', checkUnread);
  useMatrixEvent(client, 'Room.timeline', checkUnread);
  useMatrixEvent(client, 'Room.receipt', checkUnread);
  useMatrixEvent(client, 'sync', checkUnread);
}
