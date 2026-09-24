import { useCallback } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { inviteModalRoomIdAtom } from '@/app/store/atoms';
import { useConfirm } from '@/app/hooks/useConfirm';
import type { InviteModalState } from '@/app/store/atoms';
import { currentRoomIdAtom, currentSpaceIdAtom } from '@/app/store/atoms/rooms';
import { useToast } from '@/app/hooks/useToast';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';

export function useRoomActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const [, setInviteRoomId] = useAtom(inviteModalRoomIdAtom);
  const currentRoomId = useAtomValue(currentRoomIdAtom);
  const currentSpaceId = useAtomValue(currentSpaceIdAtom);
  const toast = useToast();
  const client = getMatrixClientOrNull();

  const confirm = useCallback(
    (title: string, message: string, danger = false): Promise<boolean> =>
      confirmDialog({ title, message, danger }),
    [confirmDialog]
  );

  const markRoomLeft = useCallback(
    (roomId: string) => {
      const room = client?.getRoom(roomId);
      if (room && room.getMyMembership() !== 'leave') {
        room.updateMyMembership('leave');
      }
    },
    [client]
  );

  const leaveRoom = useCallback(
    async (roomId: string, roomName: string) => {
      const ok = await confirm(
        t('room.leaveRoom'),
        t('room.leaveRoomConfirm', { name: roomName }),
        true
      );
      if (!ok || !client) return;
      try {
        await client.leave(roomId);
        markRoomLeft(roomId);
        await client.forget(roomId);
        if (currentRoomId === roomId) navigate('/');
      } catch (err) {
        toast.error(t('room.leaveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirm, toast, t, currentRoomId, navigate, markRoomLeft]
  );

  const leaveSpace = useCallback(
    async (spaceId: string, spaceName: string) => {
      const ok = await confirm(
        t('room.space.leave'),
        t('room.space.leaveConfirm', { name: spaceName }),
        true
      );
      if (!ok || !client) return;
      try {
        await client.leave(spaceId);
        markRoomLeft(spaceId);
        await client.forget(spaceId);
        if (currentSpaceId === spaceId) navigate('/');
      } catch (err) {
        toast.error(t('room.leaveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirm, toast, t, currentSpaceId, navigate, markRoomLeft]
  );

  const inviteToRoom = useCallback(
    (inviteState: InviteModalState) => {
      setInviteRoomId(inviteState);
    },
    [setInviteRoomId]
  );

  return { leaveRoom, leaveSpace, inviteToRoom, markRoomLeft, client };
}
