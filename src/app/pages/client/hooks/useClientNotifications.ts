import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentRoomIdAtom } from '@/app/store/atoms';
import {
  notificationSoundsAtom,
  notificationBannersAtom,
  notificationSoundPackAtom,
  notificationMentionSoundPackAtom,
  notificationSoundVolumeAtom,
} from '@/app/store/atoms/settings';
import {
  showBrowserNotification,
  playNotificationSound,
  getNotifLevelSync,
} from '@/app/hooks/useNotifications';
import { RoomEvent, MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import type { IRoomTimelineData } from 'matrix-js-sdk/lib/models/event-timeline-set';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId, isDmRoom } from '@/util/matrix';
import { isReplyToUser } from '@/util/mentions';
import { useSyncReady } from '@/app/hooks/useSync';
import { isDesktopWindowHidden } from '@/util/desktop';
import { stripBase } from '@/util/publicUrl';

export function useClientNotifications() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const navigate = useNavigate();
  const notificationSounds = useAtomValue(notificationSoundsAtom);
  const [notificationBanners, setNotificationBanners] = useAtom(notificationBannersAtom);
  const syncReady = useSyncReady();

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const currentRoomIdRef = useRef<string | null>(null);
  const [currentRoomId] = useAtom(currentRoomIdAtom);
  currentRoomIdRef.current = currentRoomId;

  const notificationSoundsRef = useRef(notificationSounds);
  notificationSoundsRef.current = notificationSounds;

  const soundPack = useAtomValue(notificationSoundPackAtom);
  const mentionSoundPack = useAtomValue(notificationMentionSoundPackAtom);
  const soundVolume = useAtomValue(notificationSoundVolumeAtom);
  const soundSettingsRef = useRef({
    pack: soundPack,
    mentionPack: mentionSoundPack,
    volume: soundVolume,
  });
  soundSettingsRef.current = {
    pack: soundPack,
    mentionPack: mentionSoundPack,
    volume: soundVolume,
  };

  const notificationBannersRef = useRef(notificationBanners);
  notificationBannersRef.current = notificationBanners;

  const tRef = useRef(t);
  tRef.current = t;

  const syncReadyRef = useRef(syncReady);
  syncReadyRef.current = syncReady;

  const pendingEncryptedRef = useRef<Set<string>>(new Set());

  const notifyForEvent = useRef((event: MatrixEvent, room: Room) => {
    const mx = getMatrixClientOrNull();
    const myId = mx?.getUserId?.();
    if (event.getSender?.() === myId) return;
    if (event.getType?.() !== 'm.room.message') return;

    const actions = mx?.getPushActionsForEvent?.(event);
    if (!actions?.notify) {
      if (!mx || !myId || !isReplyToUser(event, room, myId)) return;
      if (getNotifLevelSync(mx, room.roomId) === 'mute') return;
    }

    const isWindowVisible = document.visibilityState === 'visible' && !isDesktopWindowHidden();
    const isCurrentRoom = room.roomId === currentRoomIdRef.current;
    if (isWindowVisible && isCurrentRoom) return;

    const senderId = event.getSender?.() ?? '';
    const senderName = room.getMember?.(senderId)?.name ?? senderId;
    const content = event.getContent?.() ?? {};
    const formattedBody = content.formatted_body as string | undefined;
    const hasSpoiler = formattedBody?.includes('data-mx-spoiler') ?? false;
    const body = hasSpoiler
      ? tRef.current('common.spoilerNotification')
      : ((content.body as string) ?? tRef.current('common.newMessage'));

    if (!isWindowVisible && notificationBannersRef.current) {
      const roomUrl = isDmRoom(room, mx!)
        ? `/dm/${encodeURIComponent(room.roomId)}`
        : `/r/${encodeURIComponent(room.roomId)}`;
      showBrowserNotification(`${senderName} in ${room.name ?? room.roomId}`, body, roomUrl);
    }
    const priority = isDmRoom(room, mx!) || !!actions?.tweaks?.highlight;
    playNotificationSound(notificationSoundsRef.current, soundSettingsRef.current, priority);
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'navigateTo' && typeof event.data.url === 'string') {
        const url = new URL(event.data.url);
        navigateRef.current(stripBase(url.pathname) + url.search + url.hash);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    const onOpenRoom = (url: string) => navigateRef.current(url);
    window.electronAPI?.onOpenRoom?.(onOpenRoom);
    window.electronAPI
      ?.getPendingRoom?.()
      .then((url) => {
        if (url) navigateRef.current(url);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'notifications' }).then((status) => {
      const handler = () => {
        if (status.state !== 'granted') {
          setNotificationBanners(false);
        }
      };
      status.addEventListener('change', handler);
      return () => status.removeEventListener('change', handler);
    });
  }, [setNotificationBanners]);

  useEffect(() => {
    if (!client) return;

    const handleTimeline = (
      event: MatrixEvent,
      room: Room | undefined,
      _toStartOfTimeline: boolean | undefined,
      _removed: boolean,
      data: IRoomTimelineData
    ) => {
      if (!room) return;
      if (!syncReadyRef.current) return;
      if (!data?.liveEvent) return;

      const type = event.getType?.();

      if (type === 'm.room.encrypted') {
        const id = event.getId?.();
        if (!id) return;
        pendingEncryptedRef.current.add(id);

        const onDecrypted = (decryptedEvent: MatrixEvent, err?: Error) => {
          event.off(MatrixEventEvent.Decrypted, onDecrypted);
          if (err || decryptedEvent.isDecryptionFailure?.()) return;
          const eventId = decryptedEvent.getId?.();
          if (!eventId || !pendingEncryptedRef.current.has(eventId)) return;
          pendingEncryptedRef.current.delete(eventId);
          notifyForEvent.current(decryptedEvent, room);
        };

        event.on(MatrixEventEvent.Decrypted, onDecrypted);
        return;
      }

      notifyForEvent.current(event, room);
    };

    client.on(RoomEvent.Timeline, handleTimeline);
    return () => {
      client.off(RoomEvent.Timeline, handleTimeline);
      pendingEncryptedRef.current.clear();
    };
  }, [client]);

  useEffect(() => {
    if (!client) return;
    const handleMembership = (room: Room, newMembership: string) => {
      if (!syncReadyRef.current) return;
      if (newMembership !== 'invite') return;
      const myId = client.getUserId();
      const myMember = myId ? room.getMember(myId) : null;
      const inviterUserId: string | null =
        myMember?.getDMInviter?.() ?? myMember?.events.member?.getSender() ?? null;
      const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
      const inviterName =
        inviterUser?.displayName ??
        (inviterUserId ? formatUserId(inviterUserId) : null) ??
        t('invite.unknownInviter');

      const msg = t('invite.receivedInviteSimple', { user: inviterName });

      if (
        (document.visibilityState !== 'visible' || isDesktopWindowHidden()) &&
        notificationBannersRef.current
      ) {
        showBrowserNotification(t('invite.newInvite'), msg);
      }
      playNotificationSound(notificationSoundsRef.current, soundSettingsRef.current, true);
    };
    client.on(RoomEvent.MyMembership, handleMembership);
    return () => {
      client.off(RoomEvent.MyMembership, handleMembership);
    };
  }, [client, t]);
}
