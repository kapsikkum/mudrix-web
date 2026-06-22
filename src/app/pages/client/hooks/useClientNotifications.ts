import { useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentRoomIdAtom } from '@/app/store/atoms';
import { preferencesAtom } from '@/app/store/atoms/settings';
import { useToast } from '@/app/hooks/useToast';
import { showBrowserNotification, playNotificationSound } from '@/app/hooks/useNotifications';
import { RoomEvent, MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId } from '@/util/matrix';

export function useClientNotifications() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const { notificationSounds, notificationBanners } = useAtomValue(preferencesAtom);
  const setPrefs = useSetAtom(preferencesAtom);

  const currentRoomIdRef = useRef<string | null>(null);
  const [currentRoomId] = useAtom(currentRoomIdAtom);
  currentRoomIdRef.current = currentRoomId;

  const notificationSoundsRef = useRef(notificationSounds);
  notificationSoundsRef.current = notificationSounds;

  const notificationBannersRef = useRef(notificationBanners);
  notificationBannersRef.current = notificationBanners;

  const tRef = useRef(t);
  tRef.current = t;

  const pendingEncryptedRef = useRef<Set<string>>(new Set());

  const notifyForEvent = useRef((event: MatrixEvent, room: Room) => {
    const myId = getMatrixClientOrNull()?.getUserId?.();
    if (event.getSender?.() === myId) return;
    if (event.getType?.() !== 'm.room.message') return;

    const isWindowVisible = document.visibilityState === 'visible';
    const isCurrentRoom = room.roomId === currentRoomIdRef.current;
    if (isWindowVisible && isCurrentRoom) return;

    const senderId = event.getSender?.() ?? '';
    const senderName = room.getMember?.(senderId)?.name ?? senderId;
    const body = event.getContent?.()?.body ?? tRef.current('common.newMessage');

    if (!isWindowVisible && notificationBannersRef.current) {
      showBrowserNotification(`${senderName} in ${room.name ?? room.roomId}`, body);
    }
    playNotificationSound(notificationSoundsRef.current);
  });

  useEffect(() => {
    if (!('permissions' in navigator)) return;
    navigator.permissions.query({ name: 'notifications' }).then((status) => {
      const handler = () => {
        if (status.state !== 'granted') {
          setPrefs((prev) => ({ ...prev, notificationBanners: false }));
        }
      };
      status.addEventListener('change', handler);
      return () => status.removeEventListener('change', handler);
    });
  }, [setPrefs]);

  useEffect(() => {
    if (!client) return;

    const handleTimeline = (event: MatrixEvent, room: Room | undefined) => {
      if (!room) return;

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
      const roomName: string = room?.name ?? room?.roomId ?? t('invite.unknownRoom');
      const msg = t('invite.receivedInvite', { user: inviterName, room: roomName });
      toast.info(msg);
      if (document.visibilityState !== 'visible' && notificationBannersRef.current) {
        showBrowserNotification(t('invite.newInvite'), msg);
      }
      playNotificationSound(notificationSoundsRef.current);
    };
    client.on(RoomEvent.MyMembership, handleMembership);
    return () => {
      client.off(RoomEvent.MyMembership, handleMembership);
    };
  }, [client, toast, t]);
}
