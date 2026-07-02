import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentRoomIdAtom } from '@/app/store/atoms';
import { preferencesAtom } from '@/app/store/atoms/settings';
import { useToast } from '@/app/hooks/useToast';
import { showBrowserNotification, playNotificationSound } from '@/app/hooks/useNotifications';
import { RoomEvent, MatrixEventEvent } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import type { IRoomTimelineData } from 'matrix-js-sdk/lib/models/event-timeline-set';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { formatUserId, isDmRoom } from '@/util/matrix';
import { useSyncReady } from '@/app/hooks/useSync';

export function useClientNotifications() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();
  const navigate = useNavigate();
  const { notificationSounds, notificationBanners } = useAtomValue(preferencesAtom);
  const setPrefs = useSetAtom(preferencesAtom);
  const syncReady = useSyncReady();

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const currentRoomIdRef = useRef<string | null>(null);
  const [currentRoomId] = useAtom(currentRoomIdAtom);
  currentRoomIdRef.current = currentRoomId;

  const notificationSoundsRef = useRef(notificationSounds);
  notificationSoundsRef.current = notificationSounds;

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
    if (!actions?.notify) return;

    const isWindowVisible = document.visibilityState === 'visible';
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

      const url = room.isSpaceRoom()
        ? `/space/${encodeURIComponent(room.roomId)}`
        : isDmRoom(room, client)
          ? `/dm/${encodeURIComponent(room.roomId)}`
          : `/r/${encodeURIComponent(room.roomId)}`;
      const onClick = () => navigateRef.current(url);

      toast.info(msg, { onClick, actionLabel: t('common.view') });
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
