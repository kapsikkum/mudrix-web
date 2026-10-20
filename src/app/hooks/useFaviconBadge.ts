import { useEffect, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';
import { effectiveThemeAtom, themedAppIconAtom } from '@/app/store/atoms';
import { resolveLogoAssets } from '@/theme/themeLogos';

import { roomState } from '@/util/matrix';
import { getRoomUnreadState } from '@/util/mentions';
import { setDesktopUnreadCount } from '@/util/desktop';

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
  const theme = useAtomValue(effectiveThemeAtom);
  const themedAppIcon = useAtomValue(themedAppIconAtom);

  const checkUnread = useCallback(() => {
    const assets = resolveLogoAssets(theme, themedAppIcon);
    if (!client) {
      setFavicon(assets.logo);
      setDesktopUnreadCount(0, 0);
      return;
    }
    let total = 0;
    let mentionRooms = 0;
    for (const room of client.getRooms()) {
      if (room.getMyMembership() !== 'join') continue;
      if (roomState(room).getStateEvents('m.room.tombstone', '')) continue;
      const { count, hasMention } = getRoomUnreadState(client, room);
      total += count;
      if (hasMention) mentionRooms++;
    }
    setFavicon(total > 0 ? assets.notification : assets.logo);
    // Tray icon, taskbar overlay and dock badge in the desktop app (no-op in a browser).
    setDesktopUnreadCount(total, mentionRooms);
  }, [client, theme, themedAppIcon]);

  useEffect(() => {
    checkUnread();
  }, [checkUnread]);

  useMatrixEvent(client, 'Room.UnreadNotifications', checkUnread);
  useMatrixEvent(client, 'Room.timeline', checkUnread);
  useMatrixEvent(client, 'Room.receipt', checkUnread);
  useMatrixEvent(client, 'Room.accountData', checkUnread);
  useMatrixEvent(client, 'sync', checkUnread);
}
