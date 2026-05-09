import { useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { currentRoomIdAtom } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { showBrowserNotification } from '@/app/hooks/useNotifications';
import { RoomEvent } from 'matrix-js-sdk';
import type { MatrixEvent, Room } from 'matrix-js-sdk';
import { getMatrixClientOrNull } from '@/client/initMatrix';

export function useClientNotifications() {
  const { t } = useTranslation();
  const client = getMatrixClientOrNull();
  const toast = useToast();

  // Keep a stable ref to the current room so the timeline handler
  // doesn't need to be re-registered on every room change.
  const currentRoomIdRef = useRef<string | null>(null);
  const [currentRoomId] = useAtom(currentRoomIdAtom);
  currentRoomIdRef.current = currentRoomId;

  // Browser notification for messages in non-focused rooms
  useEffect(() => {
    if (!client) return;
    const handleTimeline = (event: MatrixEvent, room: Room | undefined) => {
      if (!room) return;
      if (event.getSender?.() === client.getUserId?.()) return; // own message
      if (event.getType?.() !== 'm.room.message') return;
      if (document.visibilityState === 'visible' && room.roomId === currentRoomIdRef.current)
        return;
      const senderId = event.getSender?.() ?? '';
      const senderName = room.getMember?.(senderId)?.name ?? senderId;
      const body = event.getContent?.()?.body ?? t('common.newMessage');
      showBrowserNotification(`${senderName} in ${room.name ?? room.roomId}`, body);
    };
    client.on(RoomEvent.Timeline, handleTimeline);
    return () => {
      client.off(RoomEvent.Timeline, handleTimeline);
    };
  }, [client, t]);

  // Toast + browser notification on new invite
  useEffect(() => {
    if (!client) return;
    const handleMembership = (room: Room, newMembership: string) => {
      if (newMembership !== 'invite') return;
      // Find who invited us from the room member state
      const myId = client.getUserId();
      const myMember = myId ? room.getMember(myId) : null;
      const inviterUserId: string | null =
        myMember?.getDMInviter?.() ?? myMember?.events.member?.getSender() ?? null;
      const inviterUser = inviterUserId ? client.getUser(inviterUserId) : null;
      const inviterName =
        inviterUser?.displayName ??
        (inviterUserId ? inviterUserId.split(':')[0].substring(1) : null) ??
        t('invite.unknownInviter');
      const roomName: string = room?.name ?? room?.roomId ?? t('invite.unknownRoom');
      const msg = t('invite.receivedInvite', { user: inviterName, room: roomName });
      toast.info(msg);
      showBrowserNotification(t('invite.newInvite'), msg);
    };
    client.on(RoomEvent.MyMembership, handleMembership);
    return () => {
      client.off(RoomEvent.MyMembership, handleMembership);
    };
  }, [client, toast, t]);
}
