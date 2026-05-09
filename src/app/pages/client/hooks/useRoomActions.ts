import { useCallback } from 'react';
import { useAtom } from 'jotai';
import { useTranslation } from 'react-i18next';
import { confirmModalAtom, inviteModalRoomIdAtom } from '@/app/store/atoms';
import type { InviteModalState } from '@/app/store/atoms';
import { useToast } from '@/app/hooks/useToast';
import { getMatrixClientOrNull } from '@/client/initMatrix';
import { getErrorMessage } from '@/util/error';

export function useRoomActions() {
  const { t } = useTranslation();
  const [, setConfirm] = useAtom(confirmModalAtom);
  const [, setInviteRoomId] = useAtom(inviteModalRoomIdAtom);
  const toast = useToast();
  const client = getMatrixClientOrNull();

  const confirm = useCallback(
    (title: string, message: string, danger = false): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirm({ open: true, title, message, danger, resolve });
      });
    },
    [setConfirm]
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
        toast.success(t('room.leaveSuccess', { name: roomName }));
      } catch (err) {
        toast.error(t('room.leaveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirm, toast, t]
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
        await client.forget(spaceId);
        toast.success(t('room.leaveSuccess', { name: spaceName }));
      } catch (err) {
        toast.error(t('room.leaveFailed', { error: getErrorMessage(err) }));
      }
    },
    [client, confirm, toast, t]
  );

  const inviteToRoom = useCallback(
    (inviteState: InviteModalState) => {
      setInviteRoomId(inviteState);
    },
    [setInviteRoomId]
  );

  return { leaveRoom, leaveSpace, inviteToRoom, client };
}
