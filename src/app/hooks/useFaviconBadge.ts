import { useEffect, useCallback } from 'react';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { useMatrixEvent } from '@/app/hooks/useMatrixEvent';

const FAVICON_DEFAULT = '/assets/images/logo.svg';
const FAVICON_NOTIF = '/assets/images/logo-notification.svg';

function setFavicon(href: string) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link && link.getAttribute('href') !== href) {
    link.setAttribute('href', href);
  }
}

export function useFaviconBadge() {
  const client = getMatrixClientOrNull();

  const checkUnread = useCallback(() => {
    if (!client) {
      setFavicon(FAVICON_DEFAULT);
      return;
    }
    const hasUnread = client.getRooms().some((room) => {
      const membership = room.getMyMembership();
      if (!['join', 'invite'].includes(membership)) return false;
      return (room.getUnreadNotificationCount() ?? 0) > 0;
    });
    setFavicon(hasUnread ? FAVICON_NOTIF : FAVICON_DEFAULT);
  }, [client]);

  useEffect(() => {
    checkUnread();
  }, [checkUnread]);

  useMatrixEvent(client, 'Room.UnreadNotifications', checkUnread);
  useMatrixEvent(client, 'Room.timeline', checkUnread);
  useMatrixEvent(client, 'Room.receipt', checkUnread);
  useMatrixEvent(client, 'sync', checkUnread);
}
